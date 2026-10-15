import test from "node:test";
import assert from "node:assert/strict";
import { effectAndReload } from "../page-effect.js";

test("wait for overlay before reload; skip new destinations; injection failure is cosmetic", async () => {
  const tab = { id: 1, url: "https://example.com/" };
  let current = tab, fail = false, events = [];
  globalThis.chrome = {
    scripting: { async executeScript(options) {
      assert.deepEqual(options.args, [true, tab.url]);
      events.push("overlay");
      if (fail) throw new Error("protected page");
      await Promise.resolve();
      events.push("finished");
      return [{ result: true }];
    } },
    tabs: { async get() { return current; }, async reload() { events.push("reload"); } }
  };
  assert.deepEqual(await effectAndReload(tab, true), { overlayPlayed: true, reloadFailed: false });
  assert.deepEqual(events, ["overlay", "finished", "reload"]);
  events = []; current = { ...tab, url: "https://other.example/" };
  await effectAndReload(tab, true);
  assert.ok(!events.includes("reload"));
  events = []; current = tab; fail = true;
  assert.deepEqual(await effectAndReload(tab, true), { overlayPlayed: false, reloadFailed: false });
  assert.deepEqual(events, ["overlay", "reload"]);
});
