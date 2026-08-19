import type { PullRequest } from "../../shared/types.js";

export interface StackRow {
  pullRequest: PullRequest;
  /** Levels below the top of its stack; 0 for a pull request with no parent present. */
  depth: number;
  /**
   * The pull request builds on another branch, but that branch's pull request is
   * not among these results, so its stack cannot be drawn.
   */
  detached: boolean;
}

/**
 * A stack, or a lone pull request when `rows` has a single entry.
 *
 * Rows are ordered parent before child. A parent may have several children, so
 * a stack is a tree rather than a chain.
 */
export interface StackGroup {
  id: string;
  rows: StackRow[];
}

/**
 * Groups pull requests that are stacked on one another, preserving the incoming
 * order otherwise. Every input appears in exactly one group.
 *
 * A pull request is stacked on another when it merges into that one's branch
 * within the same repository, which is how Graphite, `gh`, and hand-built
 * stacks all express the relationship.
 */
export function groupIntoStacks(pullRequests: PullRequest[]): StackGroup[] {
  const byBranch = new Map<string, PullRequest>();
  for (const pullRequest of pullRequests) {
    byBranch.set(branchKey(pullRequest.repo, pullRequest.headRef), pullRequest);
  }

  const parents = new Map<string, PullRequest>();
  const children = new Map<string, PullRequest[]>();
  for (const pullRequest of pullRequests) {
    const parent = byBranch.get(branchKey(pullRequest.repo, pullRequest.baseRef));
    if (!parent || parent.id === pullRequest.id) continue;
    parents.set(pullRequest.id, parent);
    children.set(parent.id, [...(children.get(parent.id) ?? []), pullRequest]);
  }

  const placed = new Set<string>();
  const collect = (current: PullRequest, depth: number, rows: StackRow[]) => {
    if (placed.has(current.id)) return;
    placed.add(current.id);
    rows.push({
      pullRequest: current,
      depth,
      detached: depth === 0 && current.targetsNonDefaultBranch,
    });
    for (const child of children.get(current.id) ?? []) collect(child, depth + 1, rows);
  };

  const groups: StackGroup[] = [];
  const groupFrom = (pullRequest: PullRequest) => {
    const rows: StackRow[] = [];
    collect(pullRequest, 0, rows);
    if (rows.length > 0) groups.push({ id: pullRequest.id, rows });
  };

  for (const pullRequest of pullRequests) {
    if (!parents.has(pullRequest.id)) groupFrom(pullRequest);
  }
  // Branches that form a cycle have no top; emitting them here keeps the
  // grouping total rather than dropping pull requests from the section.
  for (const pullRequest of pullRequests) {
    if (!placed.has(pullRequest.id)) groupFrom(pullRequest);
  }

  return groups;
}

function branchKey(repo: string, branch: string): string {
  return `${repo}\u0000${branch}`;
}
