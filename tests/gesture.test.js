import test from "node:test";
import assert from "node:assert/strict";
import { releaseState } from "../gesture.js";

test("orb only enables after a completed downward drag into dock", () => {
  assert.equal(releaseState(false, 1, true, true), true);
  assert.equal(releaseState(false, .5, true, true), false);
  assert.equal(releaseState(false, 1, false, true), false);
  assert.equal(releaseState(false, 1, true, false), false);
});
test("active orb remains docked unless dragged upward sufficiently", () => {
  assert.equal(releaseState(true, .3, true, true), false);
  assert.equal(releaseState(true, .7, true, true), true);
  assert.equal(releaseState(true, .3, false, true), true);
  assert.equal(releaseState(true, 0, true, false), true);
});
