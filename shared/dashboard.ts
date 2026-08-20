import type { DashboardResponse, PullRequest, SectionResult } from "./types.js";

/**
 * Keeps only the pull requests a predicate accepts, shrinking each section's
 * total by the number dropped so that the count of matches withheld by the
 * section limit stays true. Sections are offered in the order they are shown.
 */
export function retainPullRequests(
  dashboard: DashboardResponse,
  keep: (pullRequest: PullRequest, section: SectionResult) => boolean,
): DashboardResponse {
  return {
    ...dashboard,
    sections: dashboard.sections.map((section) => {
      const pullRequests = section.pullRequests.filter((pullRequest) => keep(pullRequest, section));
      return {
        ...section,
        pullRequests,
        totalCount: section.totalCount - (section.pullRequests.length - pullRequests.length),
      };
    }),
  };
}
