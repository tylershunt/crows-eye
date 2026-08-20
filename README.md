# Crow's Eye

A desktop dashboard for the GitHub pull requests that need your attention,
grouped into sections you configure. Each section is a GitHub search query, so
anything you can express in GitHub's issue search you can turn into a section.

Crow's Eye is a [Tauri](https://tauri.app) app: a React interface over a Rust
core that talks to GitHub. Everything stays on your machine, and the built app
has no runtime of its own to install.

## Download

Grab the `.dmg` from [the latest
release](https://github.com/tylershunt/crows-eye/releases/latest) — one
universal build for Apple Silicon and Intel — and drag Crow's Eye to
Applications.

It is ad-hoc signed but not notarized, so macOS asks about it once: open it the
first time with right-click → **Open**, or **System Settings → Privacy &
Security → Open Anyway**. Every launch after that is an ordinary one.

## Requirements

To run the app:

- The [`gh` CLI](https://cli.github.com), authenticated: `gh auth login`

Crow's Eye borrows the token `gh` already stores, so there is nothing else to set
up and no secret to paste anywhere. To use a different credential, set
`GITHUB_TOKEN` (or `GH_TOKEN`) and it takes precedence. The token needs the
`repo` scope to see private pull requests and `read:org` for team review
requests.

To build it, add [Node 20 or newer](https://nodejs.org) and a
[Rust toolchain](https://rustup.rs).

## Running

```bash
npm install
npm run dev     # the app, with the interface hot-reloading
npm run build   # Crow's Eye.app and a .dmg, in src-tauri/target/release/bundle
```

`npm test` runs both suites: the interface's tests under Node's test runner and
the core's under `cargo test`. The one test that calls GitHub is ignored by
default; `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored` runs it
against your own credential.

Pushing a `v*` tag builds the universal `.dmg` on CI and publishes it as a
release, once `codesign` confirms the bundle is sealed.

### Where things live

| Variable                | Default                     | Purpose             |
| ----------------------- | --------------------------- | ------------------- |
| `CROWS_EYE_CONFIG`      | `<app data>/config.json`    | Sections and filters |
| `CROWS_EYE_SNOOZE_DB`   | `<app data>/snoozes.db`     | Snoozed pull requests |
| `CROWS_EYE_WEB_PORT`    | 5273                        | Vite dev server     |

`<app data>` is `~/Library/Application Support/dev.tylershunt.crows-eye` on
macOS.

## Configuring sections

Click **Settings** in the sidebar, or the gear on any section header to jump
straight to that section. You can rename sections, edit their query, reorder
them, set a per-section result limit and accent color, and choose whether a
section starts collapsed. A section whose query currently matches nothing starts
collapsed on its own, so empty sections stay out of the way until they have
something in them.

Changes are written to `config.json` in the app's data directory, which Settings
prints at the top and which you can also edit by hand. It is created on first
run from the defaults in `src-tauri/src/config.rs`.

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

Left to right: a black dot ringed in violet when the pull request has activity
you have not seen, the pull request state, the author's avatar, the title, and
then the repo,
number, author, and diff size. Titles too long for the window get a tooltip
with the full text. On the right: labels, comment count, reviewer
avatars (green ring means they approved, gray initials means they still owe a
review), the overall review decision, the CI check rollup, and how long ago the
pull request was last updated.

Clicking a row opens it in your browser, where you are already signed in to
GitHub. Every link in the app leaves for the browser this way; the window itself
only ever shows the dashboard.

## Burning down a section

The flame on a section header opens every pull request in that section as its
own browser tab, in the order shown. Filter the section down first if you want a
smaller pile.

## Snoozing

Hovering a row reveals a sleeping face at its right edge. Pressing it snoozes
that pull request: it leaves every section, and the burn down, at once. Section
counts drop with it, so `N more match this filter` keeps meaning what it says.

A snooze lasts until the pull request is next touched. Any activity with a
timestamp after the moment you snoozed brings it back on the following refresh,
so a snooze cannot outlive the thing it was hiding from you.

Whatever is currently hidden collects in a **Snoozed** section that the app
maintains at the bottom of the list, marked with the same sleeping face rather
than a crow's foot. It is not in your config, so it has no filter to edit, and
it starts collapsed. Each row there leads with the crow's foot of the section
that would be showing it, in that section's color, so you can see what you are
holding off without opening anything; hovering names the section. Rows offer an
alarm clock in place of the sleeping face: pressing it wakes that pull request
immediately and returns it to the sections it belongs to.

A pull request only appears here while some section's query still returns
it — one that has fallen out of every query is not shown, since the dashboard
would not have shown it anyway.

Snoozes live in `snoozes.db`, a SQLite file beside your config, keyed by the
pull request's GitHub node id. Deleting the file un-snoozes everything.

## Sidebar

Press `b`, or click the panel button beside the wordmark, to collapse the
sidebar to an icon rail. The rail keeps every section's color and count, so you
can still see what is waiting and jump to a section; hovering a track names it.
The choice survives a restart.

## Stacks

Pull requests stacked on one another are moved next to each other and joined by
a bar in the section's color, drawn in the gutter left of the unread marker. Rows are not indented; instead each one names the
pull request it sits on, as `on #1234`. Hovering that gives the parent's title.

Naming the parent rather than indenting means sibling branches read correctly:
two pull requests that both build on `#1234` each say `on #1234`, which says
they are siblings, where indentation would have implied one sat on the other.

A stack is detected structurally: a pull request is stacked on another when it
merges into that one's branch in the same repository. That is how Graphite,
`gh`, and hand-built stacks all express the relationship, so no extra tooling
or token is involved.

Only the members that a section's own query returned can be grouped. A pull
request built on a branch whose pull request is not in that section is instead
marked with a stack icon alone, so it is not mistaken for standalone work;
hover it to see the branch it builds on.

## Keyboard shortcuts

| Key   | Action                          |
| ----- | ------------------------------- |
| `/`   | Focus the filter box            |
| `r`   | Refresh                         |
| `b`   | Collapse or expand the sidebar  |
| `Esc` | Close the settings panel        |

The filter box narrows the pull requests already on screen; it does not re-query
GitHub. Change a section's query when you want different results.

## Refreshing

The dashboard refetches on the interval set in Settings (120 seconds by
default), whenever the window regains focus, and when you press `r`. The sidebar
shows your remaining GitHub GraphQL rate limit; each refresh costs roughly one
point per section out of 5,000 per hour.

## Theme

Each section is marked by a crow's track in its accent color, in the sidebar and
on the section header. The color is per-section and set in Settings.

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
