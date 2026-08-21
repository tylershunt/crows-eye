import type { GlobalFilter } from "./types.js";

/** The global filters narrowing every section, ignoring the ones switched off. */
export function enabledGlobalFilters(globalFilters: GlobalFilter[]): GlobalFilter[] {
  return globalFilters.filter((filter) => filter.enabled && filter.query.trim());
}
