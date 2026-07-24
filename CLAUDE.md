# CLAUDE.md

Guidance for working on **Ortiz Us OS** — Chris & Kat's 2-2-2 app (date nights,
getaways, destination trips). Fourth app in the Ortiz OS family (Home OS,
Learning OS, Focus OS, Us OS) — same stack and conventions across all four.

## Stack

Vanilla HTML/CSS/JS, ES modules, no build step, no framework, no bundler.
Everything lives in four files at the repo root: `index.html`, `app.js`,
`styles.css`, `sw.js`, plus `manifest.json` and `icons/`. Deployed as a static
site via GitHub Pages at https://ortizzle.github.io/ortiz-us-os/.

Do not introduce a build step, package.json, or framework. Keep it a single
`app.js` module unless it grows enough to justify splitting — check with the
user before splitting.

## Data model

Everything lives in one `localStorage` key (`ortiz-us-os`) holding
`{ entries, ideas, settings }`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the
full shape. Key invariants:

- **Deletes are tombstones**, not removals: set `deleted: true` and bump
  `updatedAt`. Tombstones are pruned after 60 days (`pruneTombstones`).
- **Every mutation bumps `updatedAt`** (`now()`, ISO string) — sync's merge
  logic depends on it to pick the newer record.
- **`settings` never syncs.** It's local-only (API key, Gist token, theme).
  Same for **`stash`** (🎁 per-person gift-idea scratchpads) — device-local,
  saved with `save()` not `commit()`.
- **Goal tickets, bingo squares (both cards), curated-pick reactions, love
  coupons, and couple-activity state use deterministic ids** (`goal:kind:n`,
  `bingo:n`, `bingo2:n`, `rec:<name>`, `coupon:<kind>:<n>`, `ynm:<who>:<n>`,
  `wyr:<who>:<n>`, `<game>:ready:<who>`, `q36:progress`, `note:<who>`) — this is what keeps
  both phones from doubling the seeded sets and lets any real tap win the
  merge. New goals go in `GOALS`; never seed shared fixed-size collections
  with random ids.
- **`coupons` holds SENT love coupons only.** The unsent book is static code
  (`COUPON_ITEMS`) rendered per `settings.who`, so unsent coupons never
  transit the Gist — same surprise guarantee as private ideas: never create
  records for unsent coupons.
- **Curated picks (`RECS`), special dates (`SPECIAL`), memory questions
  (`MEMQ`), bingo items, and activity content (`YNM_ITEMS`, `WYR_ITEMS`,
  `Q36`, `TQ_ITEMS`) are static data in `app.js`** — edit in code, don't move them into
  the store. The "hidden until both ready" reveal in the answer games is a
  UI-level game mechanic — those answers DO sync (unlike secrets/private
  ideas); don't promote it to a privacy guarantee or vice versa.
- **Private ideas (`private: true`) never leave the device** —
  `sharedPayload()` filters them out before anything is written to the Gist.
  Don't change this filter without confirming with the user; it's a
  surprise-preserving privacy guarantee, not an implementation detail.
- **`secrets` (locked 🔒 event fields) never leave the device either.** The
  real value lives in `DB.secrets[entryId][field]` (excluded from
  `sharedPayload`); the synced entry carries only the key in `entry.hidden`.
  When saving an entry, fields hidden by the OTHER phone must be preserved
  untouched (see the `!(k in inputs)` branch in `logModal`'s `apply`) —
  breaking that lets one phone's save wipe the other's surprise.

## Sync model

Optional shared private-Gist sync (same Gist infra as Home OS, different file:
`ortiz-us-os.json`). Merge is per-record by `id`, newest `updatedAt` wins
(`mergeCol`). Sync is debounced 2s after a local write (`scheduleSync`) and
also fires on `visibilitychange` when the tab becomes visible again. Never
touches `settings`.

When touching sync code: preserve the "private ideas never leave the device"
guarantee, and preserve tombstone-wins-on-newer-updatedAt semantics — breaking
either causes silent data loss or leaked surprises across the two phones.

## Conventions

- No comments explaining *what* code does — only *why*, and only where
  non-obvious (see the tombstone and private-idea comments in `app.js` as the
  bar).
- `el(tag, attrs, kids)` is the DOM-building helper — use it instead of
  `innerHTML` string templates or a framework.
- Dates are stored as `YYYY-MM-DD` strings and parsed with local-time-safe
  `parse()` — never `new Date(dateString)` directly (timezone drift bugs).
- Service worker (`sw.js`) is network-first with cache fallback, same as the
  rest of the Ortiz suite — bump `CACHE` version string on any shell-file
  change so returning phones pick up new code instead of a stale cache. Keep
  `APP_VERSION` in `app.js` (shown at the bottom of Settings) in step with it,
  so both phones can confirm which build they're actually running.

## Before shipping a change

Run it locally (`npx serve .`) and click through the actual flow — this is a
two-person production app, not a toy. Specifically check:

- Logging/planning an entry updates the Rhythm countdown correctly.
- A deleted item stays deleted after a sync round-trip (tombstone check).
- A private idea does not appear in the Gist payload
  (`window.__us.sharedPayload()` in devtools is the fast check).
- The ✨ Claude idea button only appears when an API key is set, and fails
  gracefully (toast, not a crash) without one or on a bad key.

See the `family-app-debugging` and `family-app-standards` skills for the
recurring failure modes across this app family (stale SW cache, sync
clobbering, deletion resurrection, timezone drift, mobile-Safari-only bugs)
before debugging a reported issue from scratch.
