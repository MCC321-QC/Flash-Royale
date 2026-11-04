const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createPlayerDiscovery } = require("./player-discovery.cjs");

function harness() {
  const children = [];
  const discovery = createPlayerDiscovery({ fork: (...args) => {
    const child = new EventEmitter();
    child.args = args;
    child.messages = [];
    child.kills = 0;
    child.postMessage = message => child.messages.push(message);
    child.kill = () => { child.kills++; return true; };
    children.push(child);
    return child;
  } });
  return { discovery, children };
}

test("discovery isolates the existing resolver and stops its process after results, including unfinished filesystem work", async () => {
  const { discovery, children } = harness();
  const config = { paths: {} }, options = { detected: {}, detect: false, builtIns: {} };
  const pending = discovery.resolve(config, options);
  const child = children[0];
  assert.equal(path.basename(child.args[0]), "player-discovery-process.cjs");
  assert.equal(child.args[2].serviceName, "Player discovery");
  assert.equal(child.messages.length, 0);
  child.emit("spawn");
  assert.deepEqual(child.messages, [{ config, options }]);
  const result = { states: [{ id: "ruffle" }], detected: { "flashpoint-flash": "D:\\Flashpoint" } };
  child.emit("message", result);
  assert.deepEqual(await pending, result);
  assert.equal(child.kills, 1, "Promise timeouts cannot cancel underlying drive I/O, so the helper must exit");
  child.emit("exit", 0);
  discovery.stop();
  assert.equal(child.kills, 1);
});

test("discovery surfaces worker errors, invalid replies, early exits and fork failures", async () => {
  for (const [event, value, pattern] of [
    ["message", { error: "Cannot read configured player" }, /Cannot read configured player/],
    ["message", { states: [] }, /Invalid player discovery response/],
    ["exit", 7, /exited before returning.*7/],
    ["error", new Error("Spawn error"), /Spawn error/],
  ]) {
    const { discovery, children } = harness();
    const pending = discovery.resolve({}, {});
    children[0].emit(event, value);
    await assert.rejects(pending, pattern);
    assert.equal(children[0].kills, event === "exit" ? 0 : 1);
  }
  const discovery = createPlayerDiscovery({ fork() { throw new Error("Fork failed"); } });
  await assert.rejects(discovery.resolve({}, {}), /Fork failed/);
});

test("shutdown cancels every outstanding discovery and prevents late work from restarting it", async () => {
  const { discovery, children } = harness();
  const first = discovery.resolve({}, {}), second = discovery.resolve({}, {});
  const firstFailure = assert.rejects(first, /application is closing/);
  const secondFailure = assert.rejects(second, /application is closing/);
  discovery.stop();
  await Promise.all([firstFailure, secondFailure]);
  assert.deepEqual(children.map(child => child.kills), [1, 1]);
  await assert.rejects(discovery.resolve({}, {}), /application is closing/);
  assert.equal(children.length, 2);
});

test("a hung discovery is terminated at its deadline instead of returning empty player states", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { discovery, children } = harness();
  const failure = assert.rejects(discovery.resolve({}, {}), /discovery timed out/);
  t.mock.timers.tick(60_000);
  await failure;
  assert.equal(children[0].kills, 1);
});

test("failure to terminate a discovery is reported rather than returning success", async () => {
  const { discovery, children } = harness();
  const pending = discovery.resolve({}, {});
  children[0].kill = () => false;
  children[0].emit("message", { states: [], detected: {} });
  await assert.rejects(pending, /Could not stop/);
});

test("the child reuses the normal player resolver, returns detected paths and forwards errors", async () => {
  const source = fs.readFileSync(path.join(__dirname, "player-discovery-process.cjs"), "utf8");
  let receive;
  const replies = [];
  const context = {
    require: name => {
      assert.equal(name, "./players.cjs");
      return { resolvePlayers: async (config, options) => {
        if (config.fail) throw new Error("Detection failed");
        options.detected.custom = "player.exe";
        return [{ id: "ruffle", version: options.builtIns.ruffle.version }];
      } };
    },
    process: { parentPort: { on: (_event, callback) => { receive = callback; }, postMessage: result => replies.push(result) } },
  };
  vm.runInNewContext(source, context);
  const options = { detected: {}, builtIns: { ruffle: { version: "test" } } };
  await receive({ data: { config: {}, options } });
  assert.deepEqual(JSON.parse(JSON.stringify(replies[0])), { states: [{ id: "ruffle", version: "test" }], detected: { custom: "player.exe" } });
  assert.deepEqual(options.detected, {});
  await receive({ data: { config: { fail: true }, options } });
  assert.match(replies[1].error, /Detection failed/);
});
