// Scripts Flash Royale writes next to its Steam game launcher on Linux (under Proton or Wine).
//
// Steam reads its non-Steam game list (shortcuts.vdf) only when it starts, and rewrites the file from its in-memory
// copy whenever a non-Steam game closes, so edits made while Steam runs are undone. New entries are therefore added
// through Steam itself, and renames or removals are queued in a pending file next to shortcuts.vdf. The helper below
// applies that queue once Steam has closed. It runs as a transient systemd user unit on the host, so it outlives
// Flash Royale (and its Proton container) without keeping Flash Royale "running" in Steam.

const helperShellName = "flash-royale-steam-helper.sh";
const helperPythonName = "flash-royale-steam-helper.py";
const pendingName = "flash-royale-steam-pending.json";

const helperShell = `#!/bin/sh
# Written by Flash Royale: runs its Steam shortcut helper with whichever Python 3 is available.
case "$1" in
add)
  # Steam's addnonsteamgame URL only adds an entry while this marker exists.
  touch /tmp/addnonsteamgamefile || exit 1
  # Opening Steam's command pipe read-write cannot block when Steam is not reading it.
  printf '"%s" "%s"\\n' "$3" "$2" 1<>"$HOME/.steam/steam.pipe"
  exit $?
  ;;
esac
for p in python3 /usr/bin/python3.[0-9][0-9] /usr/bin/python3.[0-9]; do
  if [ -x "$p" ] || command -v "$p" >/dev/null 2>&1; then exec "$p" "$(dirname "$0")/${helperPythonName}" "$@"; fi
done
echo "Python 3 was not found" >&2
exit 127
`;

const helperPython = String.raw`# Written by Flash Royale: applies queued changes to Steam's non-Steam game list once Steam has closed.
import json, os, signal, socket, struct, sys, time, zlib

PENDING = "PENDING_NAME"


def parse(data):
    pos = 0

    def cstring():
        nonlocal pos
        end = data.index(b"\0", pos)
        value = data[pos:end]
        pos = end + 1
        return value

    def read_map():
        nonlocal pos
        items = []
        while pos < len(data):
            kind = data[pos]
            pos += 1
            if kind == 8:
                return items
            key = cstring()
            if kind == 0:
                items.append([kind, key, read_map()])
            elif kind == 1:
                items.append([kind, key, cstring()])
            elif kind in (2, 3):
                items.append([kind, key, data[pos:pos + 4]])
                pos += 4
            elif kind == 7:
                items.append([kind, key, data[pos:pos + 8]])
                pos += 8
            else:
                raise ValueError("Unsupported Steam shortcuts file")
            if pos > len(data):
                raise ValueError("Invalid Steam shortcuts file")
        raise ValueError("Invalid Steam shortcuts file")

    return read_map()


def serialize(items):
    out = bytearray()

    def write(entries):
        for kind, key, value in entries:
            out.append(kind)
            out.extend(key + b"\0")
            if kind == 0:
                write(value)
            elif kind == 1:
                out.extend(value + b"\0")
            else:
                out.extend(value)
        out.append(8)

    write(items)
    return bytes(out)


def find(entry, name):
    for item in entry[2]:
        if item[1].decode("utf-8", "replace").lower() == name.lower():
            return item
    return None


def app_id(entry):
    item = find(entry, "appid")
    return struct.unpack("<I", item[2])[0] if item and item[0] == 2 else None


def apply_ops(root, ops):
    shortcuts = next(item for item in root if item[0] == 0 and item[1].lower() == b"shortcuts")[2]
    for op in ops:
        matches = [entry for entry in shortcuts if entry[0] == 0 and app_id(entry) == op["appId"]]
        if op.get("remove"):
            shortcuts[:] = [entry for entry in shortcuts if not any(entry is match for match in matches)]
            continue
        if not matches:
            if not op.get("create"):
                continue
            matches = [[0, b"", []]]
            shortcuts.append(matches[0])
        for entry in matches:
            for key, value in op.get("fields", {}).items():
                existing = find(entry, key)
                if existing and key in op.get("keep", []):
                    continue
                if isinstance(value, int):
                    item = [2, key.encode(), struct.pack("<I", value & 0xFFFFFFFF)]
                else:
                    item = [1, key.encode(), str(value).encode()]
                if existing:
                    existing[0], existing[2] = item[0], item[2]
                else:
                    entry[2].append(item)
            if not find(entry, "tags"):
                entry[2].append([0, b"tags", []])
    for index, entry in enumerate(shortcuts):
        entry[1] = str(index).encode()


def apply_pending(config):
    pending = os.path.join(config, PENDING)
    vdf = os.path.join(config, "shortcuts.vdf")
    try:
        with open(pending, "rb") as file:
            raw = file.read()
    except FileNotFoundError:
        return
    ops = [op for op in json.loads(raw).get("ops", []) if isinstance(op.get("appId"), int)]
    try:
        with open(vdf, "rb") as file:
            root = parse(file.read())
    except FileNotFoundError:
        root = [[0, b"shortcuts", []]]
    apply_ops(root, ops)
    temporary = vdf + ".flash-royale.tmp"
    with open(temporary, "wb") as file:
        file.write(serialize(root))
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, vdf)
    try:
        with open(pending, "rb") as file:
            unchanged = file.read() == raw
        if unchanged:
            os.remove(pending)
    except FileNotFoundError:
        pass


def steam_running():
    try:
        with open(os.path.expanduser("~/.steam/steam.pid")) as file:
            pid = int(file.read().strip())
        with open("/proc/%d/comm" % pid) as file:
            return file.read().strip() == "steam"
    except (OSError, ValueError):
        return False


def wait(config):
    # Steam may still be closing when the session stops this unit; its last write must come first.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    signal.signal(signal.SIGHUP, signal.SIG_IGN)
    while os.path.exists(os.path.join(config, PENDING)):
        if not steam_running():
            apply_pending(config)
            return
        time.sleep(1)


class Writer:
    def __init__(self):
        self.data = bytearray()

    def align(self, size):
        self.data.extend(b"\0" * (-len(self.data) % size))

    def byte(self, value):
        self.data.append(value)

    def uint(self, value):
        self.align(4)
        self.data.extend(struct.pack("<I", value))

    def string(self, value):
        encoded = value.encode()
        self.uint(len(encoded))
        self.data.extend(encoded + b"\0")

    def signature(self, value):
        encoded = value.encode()
        self.byte(len(encoded))
        self.data.extend(encoded + b"\0")

    def array(self, size, items, write):
        self.uint(0)
        at = len(self.data) - 4
        self.align(size)
        start = len(self.data)
        for item in items:
            write(item)
        struct.pack_into("<I", self.data, at, len(self.data) - start)


def message(serial, member, interface, signature="", body=b""):
    writer = Writer()
    writer.data.extend(b"l\x01\x00\x01")
    writer.uint(len(body))
    writer.uint(serial)
    destination = "org.freedesktop.systemd1" if interface.startswith("org.freedesktop.systemd1") else "org.freedesktop.DBus"
    path = "/org/freedesktop/systemd1" if interface.startswith("org.freedesktop.systemd1") else "/org/freedesktop/DBus"
    fields = [(1, "o", path), (2, "s", interface), (3, "s", member), (6, "s", destination)]
    if signature:
        fields.append((8, "g", signature))

    def write_field(field):
        code, kind, value = field
        writer.align(8)
        writer.byte(code)
        writer.signature(kind)
        if kind == "g":
            writer.signature(value)
        else:
            writer.string(value)

    writer.array(8, fields, write_field)
    writer.align(8)
    return bytes(writer.data) + body


def connect_session_bus():
    address = os.environ.get("DBUS_SESSION_BUS_ADDRESS") or "unix:path=/run/user/%d/bus" % os.getuid()
    for part in address.split(";"):
        if not part.startswith("unix:"):
            continue
        params = dict(item.split("=", 1) for item in part[5:].split(",") if "=" in item)
        target = params.get("path") or ("\0" + params["abstract"] if "abstract" in params else None)
        if not target:
            continue
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(10)
        try:
            sock.connect(target)
            return sock
        except OSError:
            sock.close()
    raise OSError("The session bus is not available")


def spawn(config):
    """Starts this helper's wait mode as a transient systemd user unit, outside Flash Royale's process tree."""
    sock = connect_session_bus()
    sock.sendall(b"\0AUTH EXTERNAL " + str(os.getuid()).encode().hex().encode() + b"\r\n")
    reply = b""
    while not reply.endswith(b"\r\n"):
        chunk = sock.recv(256)
        if not chunk:
            raise OSError("The session bus closed the connection")
        reply += chunk
    if not reply.startswith(b"OK"):
        raise OSError("The session bus refused the connection")
    sock.sendall(b"BEGIN\r\n")
    sock.sendall(message(1, "Hello", "org.freedesktop.DBus"))

    body = Writer()
    body.string("flash-royale-steam-%08x.service" % zlib.crc32(config.encode()))
    body.string("fail")
    command = ["/bin/sh", os.path.join(os.path.dirname(os.path.abspath(__file__)), "HELPER_SHELL_NAME"), "wait", config]

    def write_command(_):
        body.align(8)
        body.string(command[0])
        body.array(4, command, body.string)
        body.uint(0)

    properties = [
        ("Description", "s", lambda: body.string("Flash Royale Steam shortcut changes")),
        ("CollectMode", "s", lambda: body.string("inactive-or-failed")),
        ("ExecStart", "a(sasb)", lambda: body.array(8, [None], write_command)),
    ]

    def write_property(item):
        name, signature, write = item
        body.align(8)
        body.string(name)
        body.signature(signature)
        write()

    body.array(8, properties, write_property)
    body.array(8, [], None)
    sock.sendall(message(2, "StartTransientUnit", "org.freedesktop.systemd1.Manager", "ssa(sv)a(sa(sv))", bytes(body.data)))

    def read_exact(size):
        data = b""
        while len(data) < size:
            chunk = sock.recv(size - len(data))
            if not chunk:
                raise OSError("The session bus closed the connection")
            data += chunk
        return data

    replies = 0
    while replies < 2:
        head = read_exact(16)
        body_length, _, fields_length = struct.unpack_from("<III", head, 4)
        rest = read_exact(fields_length + (-(16 + fields_length) % 8) + body_length)
        if head[1] in (2, 3):
            replies += 1
            # An existing unit already waits for Steam to close; the newest queue is read when it applies.
            if head[1] == 3 and b"UnitExists" not in rest:
                raise OSError(rest.decode("utf-8", "replace"))
    sock.close()


if __name__ == "__main__":
    mode, config = sys.argv[1], sys.argv[2]
    if mode == "wait":
        wait(config)
    elif mode == "spawn":
        spawn(config)
    elif mode == "apply":
        apply_pending(config)
`.replace("PENDING_NAME", pendingName).replace("HELPER_SHELL_NAME", helperShellName);

module.exports = { helperPython, helperPythonName, helperShell, helperShellName, pendingName };
