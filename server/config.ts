import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig, GlobalFilter, SectionConfig } from "../shared/types.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = process.env.CROWS_EYE_CONFIG ?? join(projectRoot, "data", "config.json");

export const DEFAULT_CONFIG: AppConfig = {
  refreshIntervalSeconds: 120,
  globalFilters: [],
  sections: [
    {
      id: "needs-your-review",
      title: "Needs your review",
      query: "is:open is:pr review-requested:@me archived:false",
      limit: 50,
      collapsed: false,
      color: "#f5c451",
    },
    {
      id: "changes-requested",
      title: "Changes requested",
      query: "is:open is:pr author:@me review:changes-requested archived:false",
      limit: 50,
      collapsed: false,
      color: "#e5484d",
    },
    {
      id: "ready-to-merge",
      title: "Ready to merge",
      query: "is:open is:pr author:@me review:approved -is:draft archived:false",
      limit: 50,
      collapsed: false,
      color: "#3dd68c",
    },
    {
      id: "waiting-on-reviewers",
      title: "Waiting on reviewers",
      query:
        "is:open is:pr author:@me -review:approved -review:changes-requested -is:draft archived:false",
      limit: 50,
      collapsed: false,
      color: "#4f8cff",
    },
    {
      id: "mentions-you",
      title: "Mentions you",
      query: "is:open is:pr mentions:@me -author:@me archived:false",
      limit: 25,
      collapsed: false,
      color: "#a78bfa",
    },
    {
      id: "your-drafts",
      title: "Your drafts",
      query: "is:open is:pr author:@me is:draft archived:false",
      limit: 25,
      collapsed: true,
      color: "#9292ad",
    },
    {
      id: "recently-merged",
      title: "Recently merged",
      query: "is:pr author:@me is:merged archived:false",
      limit: 10,
      collapsed: true,
      color: "#2dd4bf",
    },
  ],
};

export async function readConfig(): Promise<AppConfig> {
  try {
    return parseConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

export async function writeConfig(config: AppConfig): Promise<AppConfig> {
  const normalized = parseConfig(config);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export function configLocation(): string {
  return configPath;
}

/** Raised when a config payload is structurally invalid; `message` names the offending field. */
export class InvalidConfigError extends Error {}

function parseConfig(raw: unknown): AppConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidConfigError("Config must be an object.");
  }
  const { sections, globalFilters, refreshIntervalSeconds } = raw as Partial<AppConfig>;

  if (!Array.isArray(sections)) {
    throw new InvalidConfigError("Config field `sections` must be an array.");
  }
  if (globalFilters !== undefined && !Array.isArray(globalFilters)) {
    throw new InvalidConfigError("Config field `globalFilters` must be an array.");
  }

  const seen = new Set<string>();
  const parsedSections = sections.map((section, index) => {
    const parsed = parseSection(section, index);
    if (seen.has(parsed.id)) {
      throw new InvalidConfigError(`Duplicate section id \`${parsed.id}\`.`);
    }
    seen.add(parsed.id);
    return parsed;
  });

  return {
    sections: parsedSections,
    globalFilters: (globalFilters ?? []).map(parseGlobalFilter),
    refreshIntervalSeconds: clamp(
      typeof refreshIntervalSeconds === "number" ? refreshIntervalSeconds : 120,
      15,
      3600,
    ),
  };
}

function parseGlobalFilter(raw: unknown, index: number): GlobalFilter {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidConfigError(`Global filter at index ${index} must be an object.`);
  }
  const filter = raw as Partial<GlobalFilter>;

  const query = typeof filter.query === "string" ? filter.query.trim() : "";
  if (!query) {
    throw new InvalidConfigError(`Global filter at index ${index} needs a query.`);
  }

  return {
    id: typeof filter.id === "string" && filter.id.trim() ? filter.id.trim() : `global-${index}`,
    query,
    enabled: filter.enabled !== false,
  };
}

function parseSection(raw: unknown, index: number): SectionConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidConfigError(`Section at index ${index} must be an object.`);
  }
  const section = raw as Partial<SectionConfig>;

  const title = typeof section.title === "string" ? section.title.trim() : "";
  if (!title) {
    throw new InvalidConfigError(`Section at index ${index} needs a title.`);
  }

  const query = typeof section.query === "string" ? section.query.trim() : "";
  if (!query) {
    throw new InvalidConfigError(`Section "${title}" needs a search query.`);
  }

  const id = typeof section.id === "string" && section.id.trim() ? section.id.trim() : `section-${index}`;

  return {
    id,
    title,
    query,
    limit: clamp(typeof section.limit === "number" ? section.limit : 50, 1, 100),
    collapsed: section.collapsed === true,
    color: typeof section.color === "string" && /^#[0-9a-f]{6}$/i.test(section.color)
      ? section.color
      : "#9292ad",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
