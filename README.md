# 💞 Ortiz Us OS

Chris & Kat's **2-2-2** app — a date night every 2 weeks, a weekend getaway
every ~2 months, a couples destination trip every ~2 years. Tracks the rhythm,
holds the idea backlog, remembers where you've been, and keeps a few
surprises. Fourth app in the Ortiz OS family, alongside
[Home OS](https://ortizzle.github.io/ortiz-home-os/),
[Learning OS](https://ortizzle.github.io/deep-learning-os/), and
[Focus OS](https://ortizzle.github.io/ortiz-focus-os/).

Live at **https://ortizzle.github.io/ortiz-us-os/** — add to home screen.
Built for exactly two phones: his and hers.

**Stack:** vanilla HTML/CSS/JS, ES modules, no build step. Local-first
(localStorage) with optional shared private-Gist sync — both phones point at
the same token + Gist ID (the Home OS gist works; Us OS writes its own
`ortiz-us-os.json` file). Merge is per-record, newest-updatedAt wins,
tombstones keep deletions deleted.

## The model

| | Cadence | Target |
|---|---|---|
| 💞 | Date night | every 2 weeks |
| 🧳 | Weekend getaway | every ~2 months |
| ✈️ | Destination trip | every ~2 years |
| 🎉 | Special occasion | as they come — no due-date pressure |

**The ladder** — every outing climbs the same rungs:

> 💡 *idea* → 📅 *planned* (has a date) → 🔨 *planning* (filling in details) → ✅ *booked* → 💞 *logged* (it happened, rated, remembered)

The app's whole job is making the current rung visible and the next rung easy.

## One-time setup (each phone)

Open the **⚙️ Settings tab** (bottom bar) and set, top to bottom:

1. **This phone belongs to** — 💙 Chris or 💜 Kat. Powers the love-coupon
   books and surprises. *(Also promptable from the Goals tab.)*
2. **Home city + interests** — sharpens ✨ idea suggestions.
3. **Claude API key** *(optional)* — enables all ✨ buttons.
4. **Coupon email nudge** *(optional)* — the shared Apps Script URL; setup
   steps in [COUPON_EMAIL.md](COUPON_EMAIL.md).
5. **Shared sync** — the shared private-Gist token + ID. This is what links
   the two phones.

The version line at the bottom of Settings (e.g. *v13 · polish pass*) tells
you which build a phone is actually running — check it matches on both phones
after an update.

## How it thinks

- **Rhythm (home)** — four status boxes, one per cadence, each showing where
  you stand: `due in 9d`, `3d overdue`, `🔨 planning`, `✅ booked`, or
  `anytime` (occasions). **Tap a box to plan the next one**: pick the date,
  name it (*"date night" is the type — "Odyssey at Harkins" is the title*),
  fill in what you know, then **Just plan it** or **✅ Book it**. A small link
  flips the sheet to *log one that already happened* instead.
- **Details per type** — date nights & occasions: location, time, dress code,
  notes. Getaways & trips: location, end date, what to pack, notes. All
  optional, all editable any time. **Cards have no buttons** — tap a card to
  open its sheet, where every action lives: the booked/still-planning
  **toggle**, **Save**, **Cancel**, and **🗑 Remove**. Logging asks memory
  questions (favorite moment/food/drink for dates; activity/food/a-moment-to-
  keep for getaways and trips).
- **Event owner** — each event belongs to whoever created it. Only the owner
  can lock fields (add surprises); the other of you can edit the open fields
  but not privatise. The sheet names the owner when it isn't you.
- **Idea generation lives in the Ideas tab** (API key required) — scoped
  sensibly: date nights stay local, occasions roam the metro, getaways go
  statewide/~6 h drive, trips go anywhere. Anniversary and birthdays
  auto-surface in ✅ Booked within 45 days — and tapping one opens a **🎁
  private idea stash** for that person (gift ideas, trip thoughts, hints
  they dropped): your phone only, never syncs. The stashes are also
  available year-round from the **Surprise stashes** card on Goals. ✨
  results (deep dives, per-plan ideas) are **cached on-device for ~30
  days** — reopening is free; refresh to spend tokens on a new take.
- **Lookup links** — curated picks and any event with a location get
  link-outs for menu & prices (stays & prices for getaways/trips), map &
  hours, and reviews. Built as live searches, so they can't go stale.
- **Ideas tab** — a running backlog per cadence, plus **curated picks**:
  baked-in, hand-researched Phoenix-area recommendations with ratings and
  why — no API tokens needed. ✨ "Go deeper" fetches insider tips; ✨ also
  generates fresh city-and-interests-aware suggestions. "Plan" turns any idea
  into a dated plan.
- **Goals** — shared commitments with grace built in: the alcohol-free
  stretch through Jan 17, 2027 (12 🎟️ drink tickets, 3 🏖️ escape passes —
  tap to use, tap again to give back), and **💌 love coupons**: ten each,
  his & hers. Send one when you mean it — it lands on the other phone as a
  surprise reveal (plus an email teaser if configured) and lives on their
  shelf tinted the sender's color, 💙 from Chris, 💜 from Kat. Unsent coupons
  never sync, so the surprise always holds.
- **History** — Coming up (with 🔨/✅ status) and Been there (♥ ratings,
  saved memories), newest first. Everything's editable after the fact (✎).
- *…and if you tap the heart in the top corner six times, something's there
  for just you two.* 💗

## 🔒 Surprises

Every field except the date has a lock toggle when planning. Lock a field and
its real value **stays on your phone only** — never synced, never in the
Gist. The other of you sees **"🔒 Kept as a surprise 💝"** in its place: they
know a surprise exists (that's the fun part), just not what it is. Their
edits can't erase it — the value isn't on their phone to erase.

Classic use: a surprise getaway with the **date and what-to-pack visible**,
location and title locked. After the reveal, edit the event and tap the 🔒
off — the field syncs normally from then on and reads right in History.

**Glance-proof:** at a glance — on cards, tiles, and history — a locked
field is masked (🔒 / "🔒 A surprise 💝") on *your* phone too, so someone
glancing over your shoulder sees nothing, and the front stays uncluttered.
The real value only appears when you deliberately **open the event** — its
fields show it, tinted pink and marked "🔒 surprise." The other phone shows
"🔒 Kept as a surprise 💝" throughout. This holds through planning, booked,
and logged — **booking never reveals a locked field.**

For a **full** surprise (a surprise getaway, say), the sheet has a **🙈 Hide
the whole plan** switch — the other of you never sees it exists, not even
the date. And while the title is locked you can type a **cover name** (e.g.
"Surprise date 💝") that shows on the front in place of the real one.

Two honest caveats: a locked value lives *only* on the phone that set it —
clear that phone's browser data and the hidden value is gone (the event
itself survives). And locking isn't retroactive: if a field synced before you
locked it, the other phone already saw it.

## What syncs vs. what stays on your phone

| Syncs between phones ↔ | Stays on this phone only 📱 |
|---|---|
| Logged & planned events (incl. details) | ⚙️ All Settings (keys, tokens, who) |
| Shared ideas & curated-pick reactions | 🔒 Private ideas |
| Goal tickets, bingo squares | 🔒 Locked (surprise) field values |
| **Sent** love coupons | Unsent love coupons (they're not data at all) |
| | 🎁 Surprise idea stashes |
| | ✨ Cached Claude results (~30 days) |

Sync runs a couple of seconds after any change and whenever the app comes
back into view; **⇅ Sync now** in Settings forces one.

## When something looks off

1. **Check the version line** (bottom of Settings) on both phones — if they
   differ, fully close and reopen the stale one (swipe it out of the app
   switcher) to pick up the new build.
2. **Changes not reaching the other phone?** Both need the same Gist token +
   ID; tap ⇅ Sync now on both and check the "last synced" line.
3. **Coupon email didn't arrive?** The coupon itself still arrives in-app —
   the email is best-effort. Troubleshooting in [COUPON_EMAIL.md](COUPON_EMAIL.md).
4. **✨ buttons missing?** No API key on that phone (Settings).

## Run locally

Any static server, e.g.:

```
npx serve .
```

(The ✨ Claude features need HTTPS or localhost; everything else works offline.)

## Repo docs

| File | What it covers |
|---|---|
| [SPEC.md](SPEC.md) | What's built and why — the product spec |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, sync/merge, privacy guarantees |
| [COUPON_EMAIL.md](COUPON_EMAIL.md) | The email-nudge Apps Script + setup |
| [CLAUDE.md](CLAUDE.md) | Working conventions for changing the code |

---

*Current build: v24 · full surprises.*
