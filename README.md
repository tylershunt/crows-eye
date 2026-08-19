# Crow's Eye

A local dashboard for the GitHub pull requests that need your attention, grouped
into sections you configure. Each section is a GitHub search query, so anything
you can express in GitHub's issue search you can turn into a section.

## Requirements

- Node 20 or newer
- The [`gh` CLI](https://cli.github.com), authenticated: `gh auth login`

Crow's Eye borrows the token `gh` already stores, so there is nothing else to set
up and no secret to paste anywhere. To use a different credential, set
`GITHUB_TOKEN` (or `GH_TOKEN`) and it takes precedence. The token needs the
`repo` scope to see private pull requests and `read:org` for team review
requests.

## Running

```bash
npm install
npm run dev
```

Then open http://localhost:5273. `npm run dev` starts two processes: the Vite
dev server for the UI and a sidecar Node server on port 8787 that talks to
GitHub. The UI never holds your token; it only calls the sidecar.

For a production-style run that serves the built assets from the sidecar alone:

```bash
npm start   # builds, then serves everything on http://localhost:8787
```

### Ports

| Variable                | Default            | Purpose            |
| ----------------------- | ------------------ | ------------------ |
| `CROWS_EYE_WEB_PORT`    | 5273               | Vite dev server    |
| `CROWS_EYE_SERVER_PORT` | 8787               | Sidecar API server |
| `CROWS_EYE_CONFIG`      | `data/config.json` | Config location    |

## Configuring sections

Click **Settings** in the sidebar, or the gear on any section header to jump
straight to that section. You can rename sections, edit their query, reorder
them, set a per-section result limit and accent color, and choose whether a
section starts collapsed. A section whose query currently matches nothing starts
collapsed on its own, so empty sections stay out of the way until they have
something in them.

Changes are written to `data/config.json`, which you can also edit by hand. That
file is not in the repository; it is created on first run from the defaults in
`server/config.ts`.

Sections are ordinary [GitHub issue search
queries](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests).
The defaults are:

| Section              | Query                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Needs your review    | `is:open is:pr review-requested:@me archived:false`                                              |
| Changes requested    | `is:open is:pr author:@me review:changes-requested archived:false`                               |
| Ready to merge       | `is:open is:pr author:@me review:approved -is:draft archived:false`                              |
| Waiting on reviewers | `is:open is:pr author:@me -review:approved -review:changes-requested -is:draft archived:false`   |
| Mentions you         | `is:open is:pr mentions:@me -author:@me archived:false`                                          |
| Your drafts          | `is:open is:pr author:@me is:draft archived:false`                                               |
| Recently merged      | `is:pr author:@me is:merged archived:false`                                                      |

Useful things to add: `org:your-org` to scope to one organization, `repo:o/r`
for a single repo, `label:urgent`, `team-review-requested:org/team`, or
`updated:>2026-01-01`.

The **Test on GitHub** link next to each query opens the same search on
github.com, which is the fastest way to check that a query does what you meant.

## Global filters

Global filters are search terms appended to *every* section's query, so one
rule can narrow the whole dashboard. They live at the top of Settings. Because
GitHub's issue search ANDs its terms, a global filter can only remove pull
requests from a section, never add them.

The usual use is exclusions:

| Filter                    | Effect                                  |
| ------------------------- | --------------------------------------- |
| `-author:app/dependabot`  | Hide Dependabot pull requests everywhere |
| `-author:app/renovate`    | Hide Renovate pull requests everywhere   |
| `org:your-org`            | Restrict the whole dashboard to one org  |
| `-repo:owner/noisy-repo`  | Drop one repo from every section         |
| `-label:wip`              | Hide anything labelled `wip`             |

Each filter has a checkbox, so you can switch one off temporarily without
deleting it. Disabled filters are ignored entirely.

When any global filter is active, a chip appears in the top bar showing how many
are applied; hovering it lists them and clicking it opens Settings. This exists
so that pull requests are never missing for invisible reasons. In Settings, each
section shows a **Runs as:** line with the exact combined query that will be
sent to GitHub, and the **Test on GitHub** link uses that combined query too.

Two things worth knowing. A global filter applies to *every* section including
`Recently merged`, so scope filters like `org:` affect your history view as
well. And a global filter that contradicts a section's own query (for example a
global `-is:draft` against the `Your drafts` section, which asks for
`is:draft`) produces a self-contradictory search; GitHub does not error on
these, it just returns something you probably did not intend.

## What each row shows

A gold bar down the left edge marks a pull request with activity you have not
seen. Left to right, the row then shows the pull request state, the author's
avatar, the title, and then the repo, number, author, and diff size. Titles too
long for the window get a tooltip with the full text. On the right: labels,
comment count, reviewer
avatars (green ring means they approved, gray initials means they still owe a
review), the overall review decision, the CI check rollup, and how long ago the
pull request was last updated. Clicking a row opens it on GitHub.

## Keyboard shortcuts

| Key   | Action                     |
| ----- | -------------------------- |
| `/`   | Focus the filter box       |
| `r`   | Refresh                    |
| `Esc` | Close the settings panel   |

The filter box narrows the pull requests already on screen; it does not re-query
GitHub. Change a section's query when you want different results.

## Refreshing

The dashboard refetches on the interval set in Settings (120 seconds by
default), whenever the window regains focus, and when you press `r`. The sidebar
shows your remaining GitHub GraphQL rate limit; each refresh costs roughly one
point per section out of 5,000 per hour.

## Theme

The palette follows a crow: `ink` for the cool near-black neutrals, `sheen` for
the violet iridescence on the wing, `plume` for its teal edge, and `glint` for
the gold catchlight in the eye. These are defined in `src/index.css` and are
ordinary Tailwind color scales, so `bg-ink-900` and `text-sheen-400` work the
way you would expect. Light and dark modes are both supported; the toggle is at
the bottom of the sidebar.

The wordmark is set in Great Vibes (loaded from Google Fonts, falling back to
Snell Roundhand and Apple Chancery) with the iridescence clipped into the
letterforms. To use a different script face, change `--font-script` in
`src/index.css` and the stylesheet link in `index.html`.

## License

[MIT](LICENSE).
