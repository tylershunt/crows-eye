import type { Actor, SectionResult } from "../../shared/types.js";
import { Logo } from "./Logo.js";
import { MoonIcon, SettingsIcon, SidebarIcon, SunIcon } from "./icons.js";

interface SidebarProps {
  viewer: Actor | null;
  sections: SectionResult[];
  theme: "light" | "dark";
  /** Narrows the sidebar to an icon rail that keeps section jumps reachable. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  rateLimitRemaining: number | null;
}

export function Sidebar({
  viewer,
  sections,
  theme,
  collapsed,
  onToggleCollapsed,
  onToggleTheme,
  onOpenSettings,
  rateLimitRemaining,
}: SidebarProps) {
  const iconButton =
    "rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100";

  const collapseToggle = (
    <button
      type="button"
      onClick={onToggleCollapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={`${collapsed ? "Expand" : "Collapse"} sidebar (b)`}
      className={iconButton}
    >
      <SidebarIcon className="h-4 w-4" />
    </button>
  );

  const themeToggle = (
    <button
      type="button"
      onClick={onToggleTheme}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={iconButton}
    >
      {theme === "dark" ? <SunIcon className="h-3.5 w-3.5" /> : <MoonIcon className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-ink-200 bg-white transition-[width] duration-200 dark:border-ink-800 dark:bg-ink-900 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-2 pb-3 pt-4">
          <Logo className="h-8 w-8" />
          {collapseToggle}
        </div>
      ) : (
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 shrink-0" />
            <p className="wordmark-sheen bg-clip-text font-script text-2xl leading-tight text-transparent">
              Crow&rsquo;s Eye
            </p>
            <div className="ml-auto">{collapseToggle}</div>
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-500">
            See your PR truth
          </p>
        </div>
      )}

      <nav className={`flex-1 overflow-y-auto pt-3 ${collapsed ? "px-1.5" : "px-2"}`}>
        {!collapsed && (
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Sections
          </p>
        )}

        {sections.map(({ config, totalCount, error }) =>
          collapsed ? (
            <a
              key={config.id}
              href={`#section-${config.id}`}
              title={`${config.title} — ${error ? "query failed" : totalCount}`}
              className="flex flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
              <span
                className={`text-[10px] leading-none tabular-nums ${
                  error ? "text-rose-500" : "text-ink-400 dark:text-ink-500"
                }`}
              >
                {error ? "!" : totalCount}
              </span>
            </a>
          ) : (
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
          ),
        )}
      </nav>

      {collapsed ? (
        <div className="flex flex-col items-center gap-1 border-t border-ink-200 p-2 dark:border-ink-800">
          {viewer && (
            <a
              href={viewer.url}
              target="_blank"
              rel="noreferrer"
              title={
                rateLimitRemaining === null
                  ? viewer.login
                  : `${viewer.login} — ${rateLimitRemaining.toLocaleString()} API points left`
              }
              className="rounded-full transition-opacity hover:opacity-80"
            >
              <img src={viewer.avatarUrl} alt="" className="h-7 w-7 rounded-full ring-1 ring-sheen-400/40" />
            </a>
          )}
          <button type="button" onClick={onOpenSettings} title="Settings" className={iconButton}>
            <SettingsIcon className="h-3.5 w-3.5" />
          </button>
          {themeToggle}
        </div>
      ) : (
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
            {themeToggle}
          </div>
        </div>
      )}
    </aside>
  );
}
