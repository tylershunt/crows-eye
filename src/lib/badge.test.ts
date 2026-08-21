import assert from "node:assert/strict";
import test from "node:test";
import type { SectionConfig, SectionResult } from "../../shared/types.js";
import { badgeCount } from "./badge.js";

function section(id: string, totalCount: number, countsTowardBadge: boolean): SectionResult {
  const config: SectionConfig = {
    id,
    title: id,
    query: "is:pr",
    limit: 50,
    collapsed: false,
    color: "#000000",
    countsTowardBadge,
  };

  return { config, pullRequests: [], totalCount, countIsPartial: false, error: null };
}

test("the badge adds up the sections asked to count towards it", () => {
  const sections = [section("a", 3, true), section("b", 40, false), section("c", 4, true)];

  assert.equal(badgeCount(sections), 7);
});

test("the badge reads zero when no section is asked to count towards it", () => {
  assert.equal(badgeCount([section("a", 9, false)]), 0);
  assert.equal(badgeCount([]), 0);
});

test("a section counts what it holds, not what it could show", () => {
  const capped = section("a", 250, true);
  capped.config.limit = 50;

  assert.equal(badgeCount([capped]), 250);
});
