import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SectionResult } from "../../shared/types.js";

/**
 * What the dock badge should read: the matches held by the sections asked to
 * count towards it, and zero when none of them is.
 */
export function badgeCount(sections: SectionResult[]): number {
  return sections
    .filter((section) => section.config.countsTowardBadge)
    .reduce((total, section) => total + section.totalCount, 0);
}

/** Puts `count` on the app's dock icon, or takes the badge off at zero. */
export async function showOnTheDock(count: number): Promise<void> {
  await getCurrentWindow().setBadgeCount(count || undefined);
}
