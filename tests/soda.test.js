import test from "node:test";
import assert from "node:assert/strict";
import { createSoda } from "../soda.js";

test("bubbles survive hidden zero-size panels and resume when visible", () => {
  let size = { width: 0, height: 0 }, resized, arcs = 0, frames = 0;
  const events = {};
  const ctx = {
    setTransform() {}, clearRect() {}, beginPath() {}, fill() {},
    arc(x, y, r) { assert.ok(Number.isFinite(x) && Number.isFinite(y) && r > 0); arcs++; }
  };
  const canvas = { getContext: () => ctx, getBoundingClientRect: () => size };
  globalThis.document = { body: {}, hidden: true, addEventListener(name, fn) { events[name] = fn; } };
  globalThis.window = { addEventListener() {} };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  globalThis.devicePixelRatio = 1;
  globalThis.ResizeObserver = class { constructor(fn) { resized = fn; } observe() {} };
  globalThis.requestAnimationFrame = () => ++frames;
  globalThis.cancelAnimationFrame = () => {};
  const soda = createSoda(canvas);
  soda.setActive(true);
  assert.equal(frames, 0);
  size = { width: 400, height: 900 };
  resized();
  document.hidden = false;
  events.visibilitychange();
  assert.ok(frames > 0);
  assert.equal(canvas.height, 900);
  size = { width: 0, height: 0 };
  resized();
  size = { width: 360, height: 720 };
  resized();
  assert.ok(arcs >= 88);
});
