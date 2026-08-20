import assert from "node:assert/strict";
import test from "node:test";
import { leavesTheDocument } from "./external.js";

const dashboard = "http://localhost:5273/";

test("a link to a fragment of the page in hand stays in the page in hand", () => {
  assert.equal(leavesTheDocument("#section-snoozed", dashboard), false);
  assert.equal(leavesTheDocument("http://localhost:5273/#section-snoozed", dashboard), false);
});

test("a fragment is no longer of the page in hand once the page differs", () => {
  assert.equal(leavesTheDocument("#comment-1", "https://github.com/o/r/pull/1"), false);
  assert.equal(leavesTheDocument("https://github.com/o/r/pull/2#comment-1", "https://github.com/o/r/pull/1"), true);
});

test("a pull request is somewhere else, fragment or not", () => {
  assert.equal(leavesTheDocument("https://github.com/o/r/pull/1", dashboard), true);
});
