# Architecture

## Overview

Single-page app, no build step. Four files at the repo root do all the work:

| File | Role |
|---|---|
| `index.html` | Shell: header, tab bar, empty `<main id="view">` |
| `app.js` | Everything — state, rendering, sync, Claude calls |
| `styles.css` | All styling (theme via `data-theme`/`data-accent` attrs) |
| `sw.js` | Service worker: network-first shell cache |
| `manifest.json` | PWA metadata (installable, standalone display) |

`app.js` renders by clearing and rebuilding `#view` on every state change
(`render()` → `renderRhythm` / `renderIdeas` / `renderHistory`) — no virtual
DOM, no diffing. Simple and fast enough at this data scale (a couple's
personal history, not a multi-user dataset).

## Data model

One `localStorage` key, `ortiz-us-os`, holding:

```js
{
  entries: [{ id, type, date, dateEnd, title, cover, loc, time, dress, pack,
              notes, rating, planned, status, owner, private, mem, hidden,
              updatedAt, deleted }],
  secrets: { entryId: { field: value } },   // device-local, never synced
  stash:   { person: [{ id, text, done, createdAt }] }, // device-local, never synced
  deepcache: { key: { text, at } },         // device-local ✨ result cache, ~30 days
  ideas:   [{ id, type, text, source, done, private, updatedAt, deleted }],
  tickets: [{ id, goal, kind, n, used, usedAt, note, updatedAt }],
  coupons: [{ id, from, n, text, note, sentAt, seenAt, updatedAt, deleted }],
  bingo:   [{ id, n, done, updatedAt }],
  bingo2:  [{ id, n, done, updatedAt }],
  recstate: [{ id, state, updatedAt }],
  settings: { apiKey, city, interests, theme, gistToken, gistId, lastSyncAt,
              who, couponHook },
}
```

- `type` is one of `date` | `getaway` | `trip` | `occasion` (see `CADENCES`
  in `app.js`; `occasion` has `days: 0` — no due-date rhythm).
- `entries` are either logged (`planned: false`, `date` in the past) or
  planned (`planned: true` or `date` in the future). `rating` is 0–5 hearts.
  Planning-detail fields (`PLANQ` in `app.js`) are per-type: date nights and
  occasions carry `loc`/`time`/`dress`; getaways and trips carry
  `loc`/`dateEnd`/`pack`. All optional, edited from the event's own sheet.
  `owner` is the creator (`settings.who` at creation): **only the owner can
  lock fields** (`canHide` gates on `iOwnEvent`); the other phone can edit
  open fields but not privatise. Legacy owner-less entries stay open to
  either. All event actions (booked/planning toggle, save, remove) live in
  the sheet — cards carry no buttons.
- **Per-event surprises.** Any hideable field (`HIDEABLE`: title, loc, time,
  dress, dateEnd, pack, notes) can be locked 🔒 on a planned event. The real
  value goes to `secrets[entryId][field]` — **device-local, never in
  `sharedPayload`** — and the synced entry carries only the field key in
  `entry.hidden`. The setting phone overlays the real value (`shownVal`); the
  other phone sees `entry.hidden` and renders a read-only 🔒 teaser, and its
  saves never touch those keys, so a merge from the partner's edits can't wipe
  the secret (same guarantee as private ideas, at field granularity). Secrets
  for deleted/pruned entries are dropped in `pruneTombstones`.
- **`entry.private`** is a *full* surprise: the whole plan is hidden from the
  other phone, not just some fields. `sharedPayload` sends a **tombstone**
  (`{id, type, deleted:true, updatedAt}`) in its place — so the other phone
  drops any copy it had and never sees the content — while this phone keeps
  the real record (the tombstone carries the same `updatedAt`, so a pull
  can't clobber the local original: `mergeCol` keeps local on ties). Setting
  `private:false` later re-syncs the real record (bumped `updatedAt` wins
  over the tombstone) — a clean reveal. `cardVal` masks every field of a
  private plan on the setter's own front too (glance-proof).
- **`entry.cover`** is an editable, synced decoy title shown on the front
  while the real `title` is locked (`titleText`).
- **`stash`** is the 🎁 per-person surprise scratchpad (gift/trip ideas about
  the other), opened from the Surprise-stashes card on Goals (year-round) or
  by tapping a special-date row in ✅ Booked when one is surfaced.
  Device-local like `secrets` — never in `sharedPayload`, saved with
  `save()` not `commit()` since there's nothing to sync.
- **`deepcache`** stores paid-for ✨ responses (curated-pick deep dives keyed
  `rec:<name>`, per-plan idea runs keyed `plan:<entryId>`) so reopening shows
  them instantly instead of re-spending tokens; explicit refresh re-fetches.
  Device-local, aged out after ~30 days in `pruneTombstones`.
- `ideas.source` is `'you'` or `'claude'`.
- `tickets` are goal passes (see `GOALS` in `app.js`). They use
  **deterministic ids** (`goal:kind:n`, e.g. `dry-2027:drink:1`) so both
  phones seed the identical set and merge per-ticket instead of doubling up.
  Seeds carry `updatedAt: ''` so any real tap (a proper ISO timestamp)
  outranks an untouched seed in a merge. Tickets are toggled used/unused,
  never tombstoned.
- `coupons` are 💌 love coupons, and hold **sent coupons only** — the unsent
  book is static code (`COUPON_ITEMS`), so it never transits the network and
  each send lands on the other phone as a surprise. Ids are deterministic
  (`coupon:<kind>:<n>`, kind = `chris` | `kat`). "Take it back" tombstones
  the record; re-sending flips `deleted` back off on the same record. The
  receiver's phone stamps `seenAt` when the in-app reveal is shown, which
  syncs back so the sender's book shows "opened 💗". `settings.who` says
  whose phone this is (whose book you send from); `settings.couponHook` is
  an optional Apps Script URL that emails the other person a teaser on send
  (see [COUPON_EMAIL.md](COUPON_EMAIL.md)). Legacy `love-coupons:*` tickets
  from the old mark-after-done model are migrated into coupon records
  (`migrateCoupons`, idempotent — it copies the ticket's `updatedAt` so both
  phones produce identical records) and otherwise ignored.
- `entries.mem` holds the memory-question answers (`{ moment, food, drink,
  activity }`), keyed by `MEMQ` in `app.js`.
- `entries.status` (`'planning'` | `'booked'`, planned entries only) drives
  the Rhythm tab's Booked / Still-planning split; missing status = planning.
- `bingo` and `bingo2` are the 💗 easter-egg cards (6 taps on the topbar
  heart; then 6 taps on the sweet card's FREE square for the second). Same
  deterministic-id + `updatedAt: ''` seeding trick as tickets (`bingo:n`,
  `bingo2:n`, center square pre-done). Squares toggle, never tombstone.
- `recstate` holds curated-pick reactions keyed `rec:<name>` with `state`
  `'dismissed'` | `'done'` | `''` (restored) — created lazily on first
  reaction, ids deterministic so both phones merge cleanly.
- `RECS` (curated picks) and `SPECIAL` (anniversary/birthdays) are static
  data baked into `app.js` — not stored, not synced, edit in code.
- `settings` is device-local only — it is never included in sync.

## The 2-2-2 model

`CADENCES` defines the three rhythms and their target interval in days:

- Date night — every 14 days
- Weekend getaway — every ~61 days
- Destination trip — every ~730 days

For each cadence, `lastDone(type)` finds the most recent past, non-planned
entry; `nextPlanned(type)` finds the next planned or future entry. The Rhythm
tab derives a countdown and progress bar from `lastDone`'s date + the
cadence's day interval.

## Sync

Optional, opt-in, shared with one other device (Kat's phone) via a private
GitHub Gist — same mechanism as Home OS, but writing to its own file
(`ortiz-us-os.json`) inside that Gist.

- **Trigger:** debounced 2s after any local write (`scheduleSync` →
  `syncNow`), plus on tab re-focus (`visibilitychange`), plus once on boot.
- **Payload:** `sharedPayload()` — `entries`, `ideas`, `tickets`, `coupons`,
  `bingo`, `bingo2`, and `recstate`, with `ideas` filtered to exclude
  `private: true` records. `settings` is never included.
- **Merge:** `mergeCol(local, remote)` — per-record by `id`; if the remote
  record's `updatedAt` is newer than the local one's, remote wins. Otherwise
  local is kept. This is a last-write-wins CRDT-lite merge, not a real CRDT —
  it's sufficient because a single record is basically only ever edited by one
  device at a time (Chris logs a date, or Kat does, not both simultaneously).
- **Deletes:** represented as tombstones (`deleted: true`, `updatedAt`
  bumped) so a delete on one phone beats a stale non-deleted copy on the
  other during merge. `pruneTombstones()` drops tombstones older than 60
  days, on the assumption both devices have synced by then.
- **Privacy:** private ideas are stripped from the payload *before* it's
  written to the Gist — they never transit the network, and the merge logic
  on the other device never sees them, so they can't leak into the shared
  history via a stray sync.

Debug hook: `window.__us = { sharedPayload, mergeCol }` is exposed for
poking at sync state from devtools.

## Claude idea generation

Optional, requires an Anthropic API key in Settings (device-local, never
synced). `generateIdeas(type)` calls `api.anthropic.com/v1/messages` directly
from the browser (`anthropic-dangerous-direct-browser-access: true`) with a
prompt built from the cadence, the user's city/interests, and existing ideas
of that type (to avoid repeats). Requires HTTPS or localhost — the browser
blocks the direct API call over plain HTTP. Generated ideas respect
`privateMode` just like manually-typed ones.

## PWA / offline

`sw.js` is a network-first cache: every same-origin fetch tries the network
first (so a real internet connection always gets current code), and falls
back to the last cached shell response when offline. Cross-origin requests
(the sync API, the Claude API) are passed through untouched — the SW never
caches or intercepts them. `manifest.json` makes the app installable to a
home screen with `display: standalone`.

## Why this architecture

- **No build step** — the whole Ortiz OS suite optimizes for "clone and open
  `index.html`," or "any static host." Adding a bundler would trade that away
  for marginal benefit at this scale.
- **localStorage + Gist instead of a backend** — no server to run or pay
  for, and the trust model (two spouses' phones) doesn't need real
  multi-tenant infrastructure — a shared secret Gist is enough.
- **Last-write-wins merge instead of a real CRDT** — correct for the actual
  usage pattern (near-zero concurrent edits to the same record) and far
  simpler to reason about and debug.
