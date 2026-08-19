import assert from "node:assert/strict";
import { test } from "node:test";
import type { PullRequest } from "../../shared/types.js";
import { groupIntoStacks } from "./stacks.js";

function pullRequest(
  id: string,
  headRef: string,
  baseRef: string,
  repo = "o/r",
  defaultBranch = "main",
): PullRequest {
  return {
    id,
    headRef,
    baseRef,
    repo,
    targetsNonDefaultBranch: baseRef !== defaultBranch,
    title: id,
  } as unknown as PullRequest;
}

/** Each row as `id@depth`, suffixed with `!` when flagged as detached. */
function shape(pullRequests: PullRequest[]): string[][] {
  return groupIntoStacks(pullRequests).map((group) =>
    group.rows.map((row) => `${row.pullRequest.id}@${row.depth}${row.detached ? "!" : ""}`),
  );
}

test("a stack is emitted from its base upwards, whatever order it arrives in", () => {
  const rows = shape([
    pullRequest("c", "c", "b"),
    pullRequest("a", "a", "main"),
    pullRequest("b", "b", "a"),
  ]);

  assert.deepEqual(rows, [["a@0", "b@1", "c@2"]]);
});

test("two pull requests on the same parent are siblings, not a chain", () => {
  const rows = shape([
    pullRequest("root", "root", "main"),
    pullRequest("x", "x", "root"),
    pullRequest("y", "y", "root"),
  ]);

  assert.deepEqual(rows, [["root@0", "x@1", "y@1"]]);
});

test("a pull request stacked on an absent parent is flagged rather than grouped", () => {
  assert.deepEqual(shape([pullRequest("lone", "lone", "someone-elses-branch")]), [["lone@0!"]]);
});

test("a pull request targeting the default branch is an ordinary row", () => {
  assert.deepEqual(shape([pullRequest("plain", "plain", "main")]), [["plain@0"]]);
});

test("equally named branches in different repositories are unrelated", () => {
  const rows = shape([
    pullRequest("p", "shared", "main", "o/one"),
    pullRequest("q", "other", "shared", "o/two"),
  ]);

  assert.deepEqual(rows, [["p@0"], ["q@0!"]]);
});

test("every pull request is grouped exactly once, including a base/head cycle", () => {
  const input = [
    pullRequest("a", "a", "main"),
    pullRequest("b", "b", "a"),
    pullRequest("orphan", "orphan", "gone"),
    pullRequest("m", "m", "n"),
    pullRequest("n", "n", "m"),
  ];

  const ids = shape(input)
    .flat()
    .map((row) => row.split("@")[0]);

  assert.deepEqual(ids.slice().sort(), ["a", "b", "m", "n", "orphan"]);
});
