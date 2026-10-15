import test from "node:test";
import assert from "node:assert/strict";
import { restoreDisplayMode, setDisplayMode } from "../display-mode.js";

test("default side panel, switch both ways, restore preference and rollback failure", async () => {
  let storage = {}, popup, behavior, options, fail = false;
  globalThis.chrome = {
    storage: { local: {
      async get() { return { ...storage }; },
      async set(value) { storage = { ...storage, ...value }; }
    } },
    action: { async setPopup(value) { popup = value.popup; } },
    sidePanel: {
      async setPanelBehavior(value) { behavior = value.openPanelOnActionClick; },
      async setOptions(value) {
        if (fail) { fail = false; throw new Error("test failure"); }
        options = value;
      }
    }
  };
  await restoreDisplayMode();
  assert.equal(popup, "");
  assert.equal(behavior, true);
  assert.equal(options.enabled, true);
  await setDisplayMode("popup");
  assert.equal(popup, "popup.html");
  assert.equal(behavior, false);
  assert.equal(options.enabled, true);
  await restoreDisplayMode();
  assert.equal(popup, "popup.html");
  fail = true;
  await assert.rejects(setDisplayMode("panel"));
  assert.equal(storage.displayMode, "popup");
  assert.equal(popup, "popup.html");
  await setDisplayMode("panel");
  assert.equal(storage.displayMode, "panel");
  assert.equal(options.enabled, true);
  await assert.rejects(setDisplayMode("invalid"));
});
