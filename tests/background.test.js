import test from "node:test";
import assert from "node:assert/strict";

test("setup, persistence, conflict, stale tabs, rollback and release", async () => {
  let listener, stored = {}, value = { mode: "system" }, control = "controllable_by_this_extension";
  let reloads = 0, failStorage = false;
  globalThis.chrome = {
    runtime: { id: "test", onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: {
      async get() { return structuredClone(stored); },
      async set(next) { if (failStorage) throw new Error("storage failed"); stored = structuredClone(next); }
    } },
    proxy: { settings: {
      get(args, cb) { cb({ value: structuredClone(value), levelOfControl: control }); },
      set(args, cb) { value = structuredClone(args.value); control = "controlled_by_this_extension"; cb(); },
      clear(args, cb) { value = { mode: "system" }; control = "controllable_by_this_extension"; cb(); }
    } },
    tabs: { async get() { return { id: 1, url: "https://example.com/path" }; }, async reload() { reloads++; } }
  };
  await import("../background.js");
  const send = message => new Promise(resolve => listener(message, { id: "test" }, resolve));
  const toggle = { type: "toggle", tabId: 1, host: "example.com" };
  assert.equal((await send(toggle)).ok, true);
  assert.equal(value.rules.singleProxy.port, 7890);
  assert.deepEqual(stored.state.sites, ["example.com"]);
  assert.deepEqual(value.rules.bypassList, ["example.com"]);
  assert.equal(reloads, 1);
  assert.equal((await send({ ...toggle, host: "old.example.com" })).ok, false);
  assert.deepEqual(stored.state.sites, ["example.com"]);
  failStorage = true;
  assert.equal((await send(toggle)).ok, false);
  assert.equal(value.mode, "fixed_servers");
  assert.deepEqual(value.rules.bypassList, ["example.com"]);
  failStorage = false;
  assert.equal((await send(toggle)).ok, true);
  assert.equal(value.mode, "system");
  assert.deepEqual(stored.state.sites, []);
  control = "controlled_by_other_extensions";
  assert.equal((await send({ ...toggle, port: "7890" })).ok, false);
  assert.equal(value.mode, "system");
  control = "controllable_by_this_extension";
  assert.equal((await send({ ...toggle, port: "7890" })).ok, true);
  assert.equal((await send({ type: "setPort", port: "7897" })).ok, true);
  assert.equal(value.rules.singleProxy.port, 7897);
  // A closed popup must not poison the next request in the worker queue.
  listener({ type: "reset" }, { id: "test" }, () => { throw new Error("closed message port"); });
  assert.equal((await send(toggle)).ok, true);
  assert.deepEqual(stored.state.sites, ["example.com"]);
  assert.equal(value.rules.singleProxy.port, 7897);
  // Simulate worker restart while preserving Chrome settings and storage.
  await import("../background.js?restart");
  assert.equal((await send({ type: "reset" })).ok, true);
  assert.equal((await send(toggle)).ok, true);
  assert.deepEqual(value.rules.bypassList, ["example.com"]);
  assert.equal((await send({ type: "setPort", port: "0" })).ok, false);
  assert.equal(value.rules.singleProxy.port, 7897);
  assert.equal((await send({ type: "reset" })).ok, true);
  assert.equal(value.mode, "system");
  assert.equal(stored.state.base, null);
  assert.equal(stored.state.port, 7897);
  assert.equal((await send(toggle)).ok, true);
  assert.equal(value.rules.singleProxy.port, 7897);
  // Global direct overrides routing without discarding the site's rules.
  const global = enabled => send({ type: "setGlobalDirect", enabled });
  assert.equal((await global(true)).ok, true);
  assert.deepEqual(value, { mode: "direct" });
  assert.deepEqual(stored.state.sites, ["example.com"]);
  assert.equal((await send(toggle)).ok, false);
  await import("../background.js?global-restart");
  assert.equal((await send({ type: "status" })).state.globalDirect, true);
  failStorage = true;
  assert.equal((await global(false)).ok, false);
  assert.deepEqual(value, { mode: "direct" });
  failStorage = false;
  assert.equal((await global(false)).ok, true);
  assert.equal(value.rules.singleProxy.port, 7897);
  assert.deepEqual(value.rules.bypassList, ["example.com"]);
  await global(true);
  await send({ type: "setPort", port: "7898" });
  assert.equal(value.mode, "direct");
  await global(false);
  assert.equal(value.rules.singleProxy.port, 7898);
  await global(true);
  await send({ type: "reset" });
  assert.equal(value.mode, "direct");
  assert.deepEqual(stored.state.sites, []);
  await global(false);
  assert.equal(value.mode, "system");
  await global(true);
  assert.equal(value.mode, "direct");
  await global(false);
  assert.equal(value.mode, "system");
  control = "controlled_by_other_extensions";
  assert.equal((await global(true)).ok, false);
  assert.equal(value.mode, "system");
});
