function u16(value) { const data = Buffer.alloc(2); data.writeUInt16LE(value); return data; }
function u32(value) { const data = Buffer.alloc(4); data.writeUInt32LE(value); return data; }
function bits(values) {
  const text = values.map(([value, width]) => (value < 0 ? 2 ** width + value : value).toString(2).padStart(width, "0")).join("");
  return Buffer.from(text.padEnd(Math.ceil(text.length / 8) * 8, "0").match(/.{8}/g).map(value => parseInt(value, 2)));
}
function rect(width, height) {
  const size = Math.ceil(Math.log2(Math.max(width, height) + 1)) + 1;
  return bits([[size, 5], [0, size], [width, size], [0, size], [height, size]]);
}
function tag(code, data = Buffer.alloc(0)) {
  return Buffer.concat([u16((code << 6) | Math.min(data.length, 63)), ...(data.length >= 63 ? [u32(data.length)] : []), data]);
}
function action(code, data) {
  return data ? Buffer.concat([Buffer.from([code]), u16(data.length), data]) : Buffer.from([code]);
}
const string = value => Buffer.from(value + "\0");
const push = value => action(0x96, Buffer.concat([Buffer.from([0]), string(value)]));
const integer = value => action(0x96, Buffer.concat([Buffer.from([7]), u32(value)]));

// An original AVM1 fixture: two editable fields whose values are traced every frame.
function keyboardTextSwf() {
  const definitions = [];
  for (const [id, name, value, y] of [[1, "first", "old", 60], [2, "second", "two", 130]]) {
    definitions.push(tag(37, Buffer.concat([
      u16(id), rect(310 * 20, 45 * 20), Buffer.from([0x84, 0x08]),
      Buffer.from([236, 245, 255, 255]), string(name), string(value),
    ])));
    const size = 14;
    definitions.push(tag(26, Buffer.concat([Buffer.from([6]), u16(id), u16(id),
      bits([[0, 1], [0, 1], [size, 5], [40 * 20, size], [y * 20, size]]),
    ])));
  }
  const frame = Buffer.concat(["first", "second"].flatMap(name => [
    push(`keyboard:${name}:`), push(name), action(0x1c), action(0x21), action(0x26),
  ]).concat([
    push("keyboard:held:"), integer(65), integer(1), push("Key"), action(0x1c), push("isDown"), action(0x52), action(0x21), action(0x26), action(0),
  ]));
  const script = Buffer.concat([
    push("onEnterFrame"),
    action(0x9b, Buffer.concat([string(""), u16(0), u16(frame.length)])), frame,
    action(0x1d), push("keyboard:ready:yes"), action(0x26), action(0),
  ]);
  const body = Buffer.concat([
    rect(640 * 20, 280 * 20), u16(30 * 256), u16(1),
    tag(69, u32(0)), tag(9, Buffer.from([18, 27, 42])),
    ...definitions, tag(12, script), tag(1), tag(0),
  ]);
  return Buffer.concat([Buffer.from("FWS\x08"), u32(body.length + 8), body]);
}

module.exports = { keyboardTextSwf };
