const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const filename = path.join(__dirname, "..", "src", "crt-reflection-warp.ts");

function harness(options = {}) {
  const live = new Set(), calls = { define: 0, update: 0, draw: 0, checks: 0, lost: 0, flips: [], shaders: [] };
  const state = { lost: false, error: 0 };
  const create = () => { const value = {}; live.add(value); return value; };
  const remove = value => live.delete(value);
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, LINK_STATUS: 3, COMPILE_STATUS: 4, NO_ERROR: 0, UNPACK_FLIP_Y_WEBGL: 5,
    createShader: create, deleteShader: remove, shaderSource: (_shader, source) => calls.shaders.push(source),
    compileShader() {}, getShaderParameter: () => !options.compileFailure, getShaderInfoLog: () => "compile failed",
    createProgram: create, deleteProgram: remove, attachShader() {}, linkProgram() {},
    getProgramParameter: () => true, getUniformLocation: (_program, name) => options.missingUniform === name ? null : {},
    createVertexArray: create, deleteVertexArray: remove, createTexture: create, deleteTexture: remove,
    bindTexture() {}, texParameteri() {}, activeTexture() {}, useProgram() {}, bindVertexArray() {},
    viewport() {}, uniform1i() {}, uniform2f() {},
    pixelStorei: (_key, value) => calls.flips.push(value),
    texImage2D() { calls.define++; }, texSubImage2D() { calls.update++; }, drawArrays() { calls.draw++; },
    isContextLost: () => state.lost, getError() { calls.checks++; return state.error; },
    getExtension: () => ({ loseContext() { calls.lost++; } }),
  };
  const { createReflectionWarp } = loadTsModule(filename);
  const canvas = { width: 4, height: 3, getContext: () => options.unavailable ? null : gl };
  return { create: () => createReflectionWarp(canvas), calls, live, state };
}

test("reflection GPU mapping reuses textures and never reads lighting pixels back to the CPU", () => {
  const { create, calls, live } = harness();
  const warp = create();
  const map = new Float32Array(4 * 3 * 2);
  warp.setCoordinates(map, 4, 3);
  const frame = { width: 320, height: 240 };
  warp.render(frame);
  const allocations = calls.define;
  for (let index = 0; index < 600; index++) warp.render(frame);
  assert.equal(calls.define, allocations);
  assert.equal(calls.update, 600);
  assert.equal(calls.draw, 601);
  assert.equal(calls.checks, 1, "GPU error checking does not synchronize each lighting update");
  assert.deepEqual(calls.flips.slice(0, 2), [false, true], "CPU coordinate rows and canvas frame rows have explicit orientations");
  assert.ok(calls.shaders.some(source => source.includes("texelFetch(Coordinates") && source.includes("1.0 - uv.y")));
  const count = live.size;
  warp.setCoordinates(map, 4, 3);
  frame.height = 320;
  warp.render(frame);
  assert.equal(calls.define, allocations + 2);
  assert.equal(calls.checks, 2);
  assert.equal(live.size, count, "geometry and rotation changes do not create new GPU resources");
  warp.dispose();
  warp.dispose();
  assert.equal(live.size, 0);
  assert.equal(calls.lost, 1);
  assert.throws(() => warp.render(frame), /GPU context unavailable/);
});

test("missing WebGL support returns the explicit CPU-fallback signal and setup failures clean up", () => {
  assert.equal(harness({ unavailable: true }).create(), null);
  for (const options of [{ compileFailure: true }, { missingUniform: "Coordinates" }]) {
    const h = harness(options);
    assert.throws(h.create, /CRT reflection:/);
    assert.equal(h.live.size, 0);
    assert.equal(h.calls.lost, 1);
  }
});

test("reflection map errors, context loss and GPU draw failures are surfaced for the CPU fallback", () => {
  const { create, state, live } = harness();
  const warp = create();
  assert.throws(() => warp.setCoordinates(new Float32Array(2), 4, 3), /invalid coordinate map/);
  warp.setCoordinates(new Float32Array(24), 4, 3);
  state.error = 1282;
  assert.throws(() => warp.render({ width: 320, height: 240 }), /GPU error 1282/);
  state.lost = true;
  assert.throws(() => warp.render({ width: 320, height: 240 }), /GPU context unavailable/);
  assert.throws(() => warp.setCoordinates(new Float32Array(24), 4, 3), /GPU context unavailable/);
  warp.dispose();
  assert.equal(live.size, 0);
});
