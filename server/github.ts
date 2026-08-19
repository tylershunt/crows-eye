import { effectiveQuery } from "../shared/query.js";
import type {
  Actor,
  AppConfig,
  CheckState,
  DashboardResponse,
  PullRequest,
  PullRequestState,
  ReviewDecision,
  ReviewState,
  SectionConfig,
  SectionResult,
} from "../shared/types.js";
import { resolveGitHubToken } from "./token.js";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

/** Raised when GitHub rejects the whole request, e.g. bad credentials or rate limiting. */
export class GitHubError extends Error {}

const PR_FRAGMENT = `
fragment PullRequestFields on PullRequest {
  id
  number
  title
  url
  isDraft
  state
  createdAt
  updatedAt
  additions
  deletions
  changedFiles
  totalCommentsCount
  isReadByViewer
  reviewDecision
  mergeable
  baseRefName
  headRefName
  repository { nameWithOwner isPrivate defaultBranchRef { name } }
  author { login avatarUrl url }
  labels(first: 10) { nodes { name color } }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User { login }
        ... on Team { name }
      }
    }
  }
  latestReviews(first: 10) {
    nodes { state author { login avatarUrl url } }
  }
  commits(last: 1) {
    nodes { commit { statusCheckRollup { state } } }
  }
}`;

const SEARCH_DOCUMENT = `query SectionSearch($query: String!, $limit: Int!) {
  rateLimit { remaining }
  search(query: $query, type: ISSUE, first: $limit) {
    issueCount
    nodes { ...PullRequestFields }
  }
}
${PR_FRAGMENT}`;

/**
 * Resolves each section's search concurrently.
 *
 * A section whose query GitHub rejects yields a `SectionResult` with `error` set
 * rather than failing the whole dashboard.
 */
export async function fetchDashboard(config: AppConfig): Promise<DashboardResponse> {
  const token = await resolveGitHubToken();

  const viewerRequest = graphql<ViewerOnlyData>(
    token,
    "query { viewer { login avatarUrl url } rateLimit { remaining } }",
    {},
  );
  const sectionRequests = config.sections.map((section) =>
    fetchSection(token, section, effectiveQuery(section.query, config.globalFilters)),
  );

  const [{ viewer, rateLimit }, results] = await Promise.all([
    viewerRequest,
    Promise.all(sectionRequests),
  ]);

  return {
    viewer,
    sections: results.map(({ result }) => result),
    fetchedAt: new Date().toISOString(),
    rateLimitRemaining: Math.min(rateLimit.remaining, ...results.map(({ remaining }) => remaining)),
  };
}

async function fetchSection(
  token: string,
  config: SectionConfig,
  query: string,
): Promise<{ result: SectionResult; remaining: number }> {
  try {
    const { data, errors } = await graphqlAllowingPartial<SectionSearchData>(token, SEARCH_DOCUMENT, {
      query,
      limit: config.limit,
    });
    if (!data?.search) throw new GitHubError(errors?.[0]?.message ?? "GitHub returned no results.");

    return {
      remaining: data.rateLimit?.remaining ?? Number.POSITIVE_INFINITY,
      result: {
        config,
        effectiveQuery: query,
        pullRequests: data.search.nodes.filter(isPullRequestNode).map(toPullRequest),
        totalCount: data.search.issueCount,
        error: null,
      },
    };
  } catch (error) {
    return {
      remaining: Number.POSITIVE_INFINITY,
      result: {
        config,
        effectiveQuery: query,
        pullRequests: [],
        totalCount: 0,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/** Search over `type: ISSUE` also matches issues, which arrive as nodes without a `number`. */
function isPullRequestNode(node: RawPullRequest | Record<string, never>): node is RawPullRequest {
  return typeof (node as RawPullRequest).number === "number";
}

function toPullRequest(raw: RawPullRequest): PullRequest {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    repo: raw.repository.nameWithOwner,
    isPrivate: raw.repository.isPrivate,
    isDraft: raw.isDraft,
    baseRef: raw.baseRefName,
    headRef: raw.headRefName,
    targetsNonDefaultBranch: raw.repository.defaultBranchRef
      ? raw.baseRefName !== raw.repository.defaultBranchRef.name
      : false,
    state: raw.state as PullRequestState,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    commentCount: raw.totalCommentsCount ?? 0,
    isRead: raw.isReadByViewer !== false,
    checkState: (raw.commits.nodes[0]?.commit.statusCheckRollup?.state ?? "NONE") as CheckState,
    reviewDecision: (raw.reviewDecision ?? "NONE") as ReviewDecision,
    mergeable: raw.mergeable,
    author: raw.author,
    labels: raw.labels.nodes,
    requestedReviewers: raw.reviewRequests.nodes
      .map((node) => node.requestedReviewer?.login ?? node.requestedReviewer?.name)
      .filter((name): name is string => Boolean(name)),
    latestReviews: raw.latestReviews?.nodes.map((node) => ({
      state: node.state as ReviewState,
      author: node.author,
    })) ?? [],
  };
}

async function graphql<T>(
  token: string,
  document: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const { data, errors } = await graphqlAllowingPartial<T>(token, document, variables);
  if (errors?.length) throw new GitHubError(errors[0]!.message);
  if (!data) throw new GitHubError("GitHub returned no data.");
  return data;
}

async function graphqlAllowingPartial<T>(
  token: string,
  document: string,
  variables: Record<string, unknown>,
): Promise<{ data: T | null; errors?: GraphQLError[] }> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "User-Agent": "crows-eye",
    },
    body: JSON.stringify({ query: document, variables }),
  });

  if (response.status === 401) {
    throw new GitHubError("GitHub rejected the token. Run `gh auth login` to refresh it.");
  }
  if (!response.ok) {
    throw new GitHubError(`GitHub responded ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  return (await response.json()) as { data: T | null; errors?: GraphQLError[] };
}

interface GraphQLError {
  message: string;
  path?: (string | number)[];
}

interface ViewerOnlyData {
  viewer: Actor;
  rateLimit: { remaining: number };
}

interface SectionSearchData {
  rateLimit: { remaining: number } | null;
  search: SearchResult | null;
}

interface SearchResult {
  issueCount: number;
  nodes: (RawPullRequest | Record<string, never>)[];
}

interface RawPullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  totalCommentsCount: number | null;
  isReadByViewer: boolean | null;
  reviewDecision: string | null;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  baseRefName: string;
  headRefName: string;
  repository: {
    nameWithOwner: string;
    isPrivate: boolean;
    defaultBranchRef: { name: string } | null;
  };
  author: Actor | null;
  labels: { nodes: { name: string; color: string }[] };
  reviewRequests: { nodes: { requestedReviewer: { login?: string; name?: string } | null }[] };
  latestReviews: { nodes: { state: string; author: Actor | null }[] } | null;
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
}
