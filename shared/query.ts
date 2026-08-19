import type { GlobalFilter } from "./types.js";

/**
 * Combines a section's query with the enabled global filters into the single
 * query sent to GitHub.
 *
 * GitHub's issue search ANDs its terms, so appending a global filter narrows
 * the section rather than widening it.
 */
export function effectiveQuery(sectionQuery: string, globalFilters: GlobalFilter[]): string {
  return [sectionQuery, ...enabledGlobalFilters(globalFilters).map((filter) => filter.query)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function enabledGlobalFilters(globalFilters: GlobalFilter[]): GlobalFilter[] {
  return globalFilters.filter((filter) => filter.enabled && filter.query.trim());
}
