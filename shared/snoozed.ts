import type { SectionConfig } from "./types.js";

/**
 * The one section the app maintains itself. It holds whatever the snooze store
 * is currently hiding from the sections above it, so it is never sent to GitHub
 * and has no entry in the config for you to edit — hence the empty query and
 * limit, which nothing reads.
 */
export const SNOOZED_SECTION: SectionConfig = {
  id: "snoozed",
  title: "Snoozed",
  query: "",
  limit: 0,
  collapsed: true,
  color: "#71718c",
  countsTowardBadge: false,
};
