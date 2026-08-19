import type { Actor, SectionResult } from "../../shared/types.js";
import { Logo } from "./Logo.js";
import { MoonIcon, SettingsIcon, SunIcon } from "./icons.js";

interface SidebarProps {
  viewer: Actor | null;
  sections: SectionResult[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  rateLimitRemaining: number | null;
}

export function Sidebar({
  viewer,
  sections,
  theme,
  onToggleTheme,
  onOpenSettings,
  rateLimitRemaining,
}: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8 shrink-0" />
          <p className="wordmark-sheen bg-clip-text font-script text-2xl leading-tight text-transparent">
            Crow&rsquo;s Eye
          </p>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-500">
          See your PR truth
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pt-3">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Sections
        </p>
        {sections.map(({ config, totalCount, error }) => (
          <a
            key={config.id}
            href={`#section-${config.id}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: config.color }} />
            <span className="truncate">{config.title}</span>
            <span
              className={`ml-auto shrink-0 text-xs tabular-nums ${
                error ? "text-rose-500" : "text-ink-400 dark:text-ink-500"
              }`}
            >
              {error ? "!" : totalCount}
            </span>
          </a>
        ))}

      </nav>

      <div className="border-t border-ink-200 p-2 dark:border-ink-800">
        {viewer && (
          <a
            href={viewer.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <img src={viewer.avatarUrl} alt="" className="h-7 w-7 rounded-full ring-1 ring-sheen-400/40" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{viewer.login}</p>
              {rateLimitRemaining !== null && (
                <p className="truncate text-[11px] text-ink-400 dark:text-ink-500">
                  {rateLimitRemaining.toLocaleString()} API points left
                </p>
              )}
            </div>
          </a>
        )}

        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            Settings
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="rounded-lg px-2 py-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            {theme === "dark" ? <SunIcon className="h-3.5 w-3.5" /> : <MoonIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
