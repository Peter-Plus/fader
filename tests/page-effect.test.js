import test from "node:test";
import assert from "node:assert/strict";
import { effectAndReload, pageEffect } from "../page-effect.js";

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

test("early rAF timestamp cannot leave undefined code and a frozen first frame", async t => {
  const keys = ["document", "window", "location", "matchMedia", "innerWidth", "innerHeight", "devicePixelRatio", "performance", "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "setInterval", "clearInterval"];
  const originals = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  t.after(() => { for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  let now = 1000, nextFrame, watchdog, timeout, removed = false;
  const positions = [], texts = [], fills = [];
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === "fillText") return (text, x, y) => { assert.equal(typeof text, "string"); texts.push(text); };
    if (key === "fillRect") return (...rect) => { fills.push({ rect, alpha: target.globalAlpha, color: target.fillStyle }); };
    if (key === "arc") return (x, y) => { positions.push([x, y]); };
    return () => {};
  } });
  const canvas = { style: {}, getContext: () => ctx };
  const host = { style: { setProperty() {} }, setAttribute() {}, attachShadow: () => ({ append() {} }), remove() { removed = true; } };
  Object.assign(globalThis, {
    document: { createElement: tag => tag === "canvas" ? canvas : host, documentElement: { append() {} } },
    window: { addEventListener() {}, removeEventListener() {} },
    location: { href: "https://example.com/" }, matchMedia: () => ({ matches: false }),
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
    performance: { now: () => now },
    requestAnimationFrame: fn => { nextFrame = fn; return 1; }, cancelAnimationFrame() {},
    setTimeout: fn => { timeout = fn; return 1; }, clearTimeout() {},
    setInterval: fn => { watchdog = fn; return 2; }, clearInterval() {}
  });
  const result = pageEffect(true, location.href);
  // Chrome may supply a frame-start timestamp earlier than performance.now().
  nextFrame(984);
  assert.deepEqual(fills[0], { rect: [0, 0, 1200, 800], alpha: 1, color: "#efefea" });
  assert.ok(texts.length > 0);
  const first = positions[0];
  positions.length = 0; now = 1100;
  nextFrame(1084);
  assert.notDeepEqual(positions[0], first);
  positions.length = 0; now = 1200;
  watchdog();
  assert.ok(positions.length > 0, "timer continues rendering when rAF stops");
  timeout();
  assert.equal(await result, true);
  assert.equal(removed, true);
});
