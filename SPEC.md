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

## Features

### Rhythm (home tab)
- One card per cadence showing: last time it happened, days until due (or
  days overdue), a progress bar toward the next one, and anything already
  planned.
- **Log one** — record something that already happened (date, optional
  title/notes, 1–5 ♥ rating).
- **Plan ahead** — schedule a future one; it stops the countdown and shows
  as "planned" until its date passes.
- Jump straight to that cadence's filtered idea list.

### Up Next
- The anticipation tab: everything planned, soonest first, each with a
  countdown ("in 12 days", "tomorrow", "today!").
- Any cadence with nothing planned appears under "Needs a plan" with quick
  Plan / Ideas shortcuts — the pipeline should never silently run dry.

### Ideas
- A running backlog per cadence, freeform text entries.
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
- Tap an unused ticket to use it (date + optional occasion note); tap a used
  one to see the occasion or give it back.
- Goal definitions live in `GOALS` in `app.js` — adding a future goal is a
  new entry there, not new machinery.

### History
- "Coming up" — planned/future entries.
- "Been there" — past logged entries, most recent first, with ♥ ratings
  (out of 5) and notes.
- Delete any entry.

### Settings
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
- Notifications/reminders — the app shows the countdown when opened; it
  doesn't push anything.

## Open questions / possible future work

- Push notifications when a cadence goes overdue (would need a backend or a
  scheduled-notification API — currently out of scope).
- Photo attachments on history entries.
- More than 3 cadences, or user-defined cadences.

Check with Chris before starting on any of the above — this file describes
what's built, not a committed roadmap.
