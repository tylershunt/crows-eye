/** Types shared by the browser bundle and the local sidecar server. */

/** Aggregate state of the commit status checks on a pull request's head commit. */
export type CheckState = "SUCCESS" | "FAILURE" | "ERROR" | "PENDING" | "EXPECTED" | "NONE";

/** GitHub's summary of whether a pull request has satisfied its review requirements. */
export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "NONE";

export type PullRequestState = "OPEN" | "CLOSED" | "MERGED";

export type ReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

export interface Actor {
  login: string;
  avatarUrl: string;
  url: string;
}

export interface Label {
  name: string;
  color: string;
}

export interface Review {
  state: ReviewState;
  author: Actor | null;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  isPrivate: boolean;
  isDraft: boolean;
  /** The branch this pull request merges into. */
  baseRef: string;
  /** The branch holding this pull request's commits. */
  headRef: string;
  /**
   * Whether `baseRef` is a branch other than the repository's default.
   *
   * True for a pull request stacked on another branch, whether that stack was
   * built by Graphite, `gh`, or by hand, and regardless of whether the parent
   * pull request is among the results being displayed.
   */
  targetsNonDefaultBranch: boolean;
  state: PullRequestState;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commentCount: number;
  /** False when the pull request has activity the viewer has not looked at yet. */
  isRead: boolean;
  checkState: CheckState;
  reviewDecision: ReviewDecision;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  author: Actor | null;
  labels: Label[];
  /** Reviewers with an outstanding request, by login for users and by name for teams. */
  requestedReviewers: string[];
  latestReviews: Review[];
}

/** A user-configured group of pull requests, defined by a GitHub search query. */
export interface SectionConfig {
  id: string;
  title: string;
  /** GitHub issue-search syntax, e.g. `is:open is:pr review-requested:@me`. */
  query: string;
  /** Maximum pull requests to fetch and display; GitHub caps a search page at 100. */
  limit: number;
  collapsed: boolean;
  /** Hex accent color for the section header dot. */
  color: string;
}

/**
 * Search terms ANDed into every section's query, narrowing all sections at once.
 *
 * Typically exclusions such as `-author:app/dependabot`, but any GitHub search
 * syntax is allowed.
 */
export interface GlobalFilter {
  id: string;
  query: string;
  enabled: boolean;
}

export interface AppConfig {
  sections: SectionConfig[];
  globalFilters: GlobalFilter[];
  refreshIntervalSeconds: number;
}

/** One section's config paired with the pull requests its query returned. */
export interface SectionResult {
  config: SectionConfig;
  /** The section's own query combined with the enabled global filters. */
  effectiveQuery: string;
  pullRequests: PullRequest[];
  /** Total matches on GitHub, which may exceed `pullRequests.length` when capped by `limit`. */
  totalCount: number;
  error: string | null;
}

export interface DashboardResponse {
  viewer: Actor;
  sections: SectionResult[];
  fetchedAt: string;
  rateLimitRemaining: number;
}
