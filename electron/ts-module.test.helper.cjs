const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");

// Transpiles a src TypeScript module for node tests, resolving relative TS imports recursively.
function loadTsModule(filename, globals = {}, overrides = {}, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename);
  const nodeRequire = createRequire(filename);
  const context = { ...globals, exports: {} };
  cache.set(filename, context.exports);
  context.require = (name) => {
    if (name in overrides) return overrides[name];
    if (name.startsWith("./")) {
      for (const extension of [".ts", ".tsx"]) {
        const candidate = path.join(path.dirname(filename), `${name}${extension}`);
        if (fs.existsSync(candidate)) return loadTsModule(candidate, globals, overrides, cache);
      }
    }
    return nodeRequire(name);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context, { filename });
  cache.set(filename, context.exports);
  return context.exports;
}

module.exports = { loadTsModule };
