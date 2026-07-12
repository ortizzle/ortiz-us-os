# Spec — Ortiz Us OS

## Problem

Chris & Kat want to keep three relationship rhythms alive without either of
them having to be the one who remembers: date nights, weekend getaways, and
destination trips. Left untracked, these drift — "when did we last actually
go somewhere, just the two of us?" This app makes the cadence visible, holds
a backlog of ideas so planning doesn't stall on "I don't know, what do you
want to do," and keeps a shared history of where they've been.

## Users

Exactly two: Chris and Kat, each on their own phone. Not designed for more
than two devices or any other users — see [ARCHITECTURE.md](ARCHITECTURE.md)
for how that assumption simplifies the sync/merge model.

## The 2-2-2 rhythm

Three cadences, each with a target interval:

| Cadence | Interval | Purpose |
|---|---|---|
| 💞 Date night | every 2 weeks | Regular, low-effort connection |
| 🧳 Weekend getaway | every ~2 months | A bigger reset, still local-ish |
| ✈️ Destination trip | every ~2 years | The big one |
| 🎉 Special occasion | as they come | Birthdays, anniversaries, big days — no due-date pressure |

**The ladder** (shared vocabulary across the app): *idea* (interested) →
*✨ go deeper* (looking to plan) → *plan* (intention to book, has a date) →
*✅ booked* (done deal).

## Features

### Rhythm (home tab)
Three sections with jump-chips (a mini table of contents) at the top:
- **Plan & log** — a 2×2 grid of compact status boxes, one per cadence:
  live status (`due in Nd` / `Nd overdue` / `🔨 planning` / `✅ booked`;
  occasions show `anytime`) plus a one-line meta (what's planned, or last
  time). Tapping a box goes straight to picking a date — plans-forward
  first — with a Title field ("date night" is the type; "Odyssey at
  Harkins" is the title) and a small "…or log one that already happened"
  link that flips the sheet into log mode.
- **Event details** — a fresh plan stays lean (date + title). Reopening the
  event from Booked / Still planning (tap anywhere on its card) opens its
  detail sheet with per-type planning fields (`PLANQ`): date nights &
  occasions get location / time / dress code / notes; getaways & trips get
  location / end date / what-to-pack / notes. Details render on the event
  card and history rows ("Jul 20 – Jul 24 · 7:30 PM · Sedona").
- **✅ Booked** — plans that are locked in, soonest first, with countdowns.
  Special dates (anniversary Sep 12, 2013 with years count; birthdays
  Chris Feb 26, Kat Aug 15) auto-surface here only when within 45 days —
  clean the rest of the year (defined in `SPECIAL` in `app.js`).
- **🔨 Still planning** — plans with a date but details not locked. Every
  planned entry carries a `status` flag (`planning` default → `booked`),
  toggled right on the card. Planning cards get **✨ Plan with Claude**
  (API key required): concrete venue suggestions, what to reserve and how
  far ahead, one upgrade idea. Getaways/trips in planning carry a reminder
  to build a trip-guide app (like Jerome).
- Cadence cards' status word speaks the ladder: `🔨 planning`, `✅ booked`,
  `due in Nd` / `Nd overdue`, or `anytime` (occasions). No progress bars —
  they read as noise.
- **Log one** — record something that already happened: date, optional
  title/notes, 1–5 ♥ rating, and **memory questions** (date night: favorite
  moment / food / drink; getaway & trip: favorite activity / food / a moment
  to keep). Memories show in History.
- **Plan ahead** — schedule a future one; planning lead defaults scale with
  the cadence (date +2wk, getaway +6wk, trip +6mo) to encourage planning
  getaways and trips early with Kat.
- Everything is **editable after submission** — ✎ on any upcoming or
  history row reopens it. Editing a planned entry to a past date graduates
  it to history.

### 💗 Easter eggs (two layers)
- Tapping the topbar heart 6 times opens "Just us": a couples' bingo card,
  25 squares (center free) of sweet, intimate prompts — flowers with
  intention, notes on pillows, connection-first warmth. Squares sync;
  completing a line celebrates with a BINGO toast.
- The sweet card's FREE center square hides "After dark" — the card behind
  the card: adult, consensual, higher-temperature prompts (positions, play,
  scenarios; non-graphic language). The door is two-stage: 6 taps earns
  "…keep going 👀", 6 more opens it. Separate synced card (`bingo2`),
  same rules.

### Ideas
- A running backlog per cadence, freeform text entries.
- **Curated picks** — baked-in, hand-researched Phoenix-area
  recommendations (`RECS` in `app.js`): 10 date nights, 7 getaways, 5
  destinations, each with area, star rating, a one-line why, and a longer
  insider take behind a tap. Zero API tokens. "Add to ideas" copies one
  into the backlog; ✨ "Go deeper" (API key required) fetches current
  practical tips on demand. Picks can be ✕ dismissed (hidden, restorable
  via a "dismissed · show" toggle) or marked ✓ done (sinks to the bottom
  with a checkmark) — reactions sync between phones (`recstate`).
- **✨ Claude suggestions** — with an API key set, generate 4 ideas tailored
  to home city and stated interests, avoiding repeats of existing ideas.
- **🔒 Private mode** — a lock toggle on the add box. Ideas added while
  locked (typed or Claude-generated) are marked private and are guaranteed to
  never leave the device — not written to the shared Gist, not visible to
  the other phone. For planning surprises. A 🔒 Private filter chip shows
  them all in one place.
- **Plan** turns an idea directly into a planned entry, prefilled with the
  idea's text, and marks the idea done.
- Delete removes an idea (as a tombstone, so it doesn't resurrect via sync).

### Couple's Goals
- Shared commitments rendered as interactive passes, synced to both phones.
- First goal: **alcohol-free through Jan 17, 2027**, with grace built in —
  12 🎟️ drink tickets and 3 🏖️ weekend escape passes for the whole stretch.
- Second goal: **💌 Love coupons** — his & hers books of 10 acts-of-service
  coupons each (💙 Chris, 💜 Kat), no expiration. **Send semantics**: each
  phone shows only its owner's unsent book (pick "I'm Chris / I'm Kat" once,
  stored device-locally in `settings.who`) plus everything the other person
  has sent — unsent coupons exist only as static code, so they never sync
  and every send lands as a surprise. Sending (with an optional note)
  creates a synced `coupon:<kind>:<n>` record; the receiver gets an in-app
  reveal sheet on their next sync/open, the coupon then lives in Goals as a
  keepsake, and the sender's book shows "opened 💗" once it's been seen.
  Optionally, a send also fires an elegant **teaser email** ("something's
  waiting for you" — never the coupon itself) via a self-hosted Google Apps
  Script webhook; see [COUPON_EMAIL.md](COUPON_EMAIL.md). Coupons:
  worst-chore takeover, sleep-in morning, breakfast in bed, massage, night
  off, solo afternoon, full-date planning, your-pick night, coffee-in-bed
  week, one no-debate "you were right".
- Tap an unused drink/escape ticket to use it (date + optional occasion
  note); tap a used one to see the occasion or give it back. Tap an unsent
  coupon to send it; tap a sent one to see its status or take it back.
- Goal definitions live in `GOALS` in `app.js` — adding a future goal is a
  new entry there, not new machinery.

### History
- "Coming up" — planned/future entries.
- "Been there" — past logged entries, most recent first, with ♥ ratings
  (out of 5) and notes.
- Delete any entry.

### Settings
- This phone belongs to — 💙 Chris / 💜 Kat, powers the coupon send/receive
  split. Device-local, never synced.
- Coupon email nudge — optional Apps Script web-app URL for the 💌 teaser
  email. Device-local, never synced.
- Home city + interests — sharpens Claude's idea suggestions.
- Claude API key — optional, enables ✨ suggestions. Device-local, never
  synced.
- Shared sync — GitHub token (gist scope) + Gist ID, same Gist Home OS uses,
  writing its own file inside it. Manual "Sync now" plus automatic
  background sync.
- Appearance — light / dark / auto.

## Non-goals

- Multi-user support beyond the two-device Chris/Kat pair.
- A backend or hosted database — local-first with Gist sync is the whole
  infrastructure, intentionally.
- Rich media (photos, attachments) on entries — text notes only, for now.
  (Photos were considered and deliberately deferred: base64 images would
  blow past localStorage and Gist size limits quickly. Revisit as a link to
  a shared album, or a separate storage backend.)
- Notifications/reminders — the app shows the countdown when opened; it
  doesn't push anything. (One deliberate exception: the 💌 coupon teaser
  email, which rides on a user-deployed Apps Script rather than a backend.)

## Open questions / possible future work

- Push notifications when a cadence goes overdue (would need a backend or a
  scheduled-notification API — currently out of scope).
- Photo attachments on history entries.
- More than 3 cadences, or user-defined cadences.

Check with Chris before starting on any of the above — this file describes
what's built, not a committed roadmap.
