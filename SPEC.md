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
  occasions show `anytime`) plus a one-line meta that always answers **when
  the next one is**: the planned event when there is one, otherwise the
  projected next slot (`next ~ Aug 20`, the same rhythm the calendar's hold
  weeks draw). It falls back to `last:` only once that projected date is
  behind you — at which point the status line is already saying
  "Nd overdue", so the last one is the more useful thing to show — and to
  `no history yet` when there's nothing to project from.
  The meta names the event through **`titleText`**, the same helper
  every other surface uses, so a box can't describe an event differently
  from its own card. Where `titleText` falls back to the cadence name (an
  untitled event), the box shows its **location** instead — the box heading
  already says which cadence this is — or just the date when there's no
  location either. It used to print the literal word "planned" there, which
  read as a different event from the card beside it. Tapping a box goes
  straight to picking a date — plans-forward
  first — with a Title field ("date night" is the type; "Odyssey at
  Harkins" is the title) and a small "…or log one that already happened"
  link that flips the sheet into log mode.
- **Event details** — tapping a status box opens the plan sheet with the
  full per-type detail fields (`PLANQ`) right there: date nights & occasions
  get location / time / dress code / notes; getaways & trips get location /
  end date / what-to-pack / notes. New plans save via **Just plan it** (still
  planning) or **✅ Book it** (booked). **Cards carry no buttons** — the whole
  card opens the event. The status also shows as a chip on the card. Details
  render on the card and history rows ("Jul 20 – Jul 24 · 7:30 PM · Sedona").
- **Booked details view** — a 🔨 still-planning card taps straight into the
  edit sheet (it's a work in progress), where every action lives: the
  booked/still-planning **toggle**, **Save**, **Cancel**, and **🗑 Remove**.
  A ✅ **booked** card instead opens a **read-only details sheet**
  (`eventSheet`): when (date, countdown, through-date), the per-type detail
  fields, 🔗 look-it-up / 📍 map / menu-or-stays / reviews links, notes, and
  — once the date has passed — memories and the ♥ rating. **✎ Edit** flips
  into the normal edit sheet. Privacy rules match editing exactly: own 🔒
  fields show, the partner's stay teasers, and a secret location gets
  city-only links.
- **🗓 Calendar view** (`renderCalendar`, reached from Rhythm's "🗓 Calendar
  view" button) — a month grid over every non-deleted entry, planned or
  logged, plus `SPECIAL` birthdays/anniversary landing that month. A
  getaway/trip's full `date`–`dateEnd` span is marked on every day it
  touches (clamped to the visible month, so a trip that started last month
  or runs into next doesn't look like it starts mid-air) — not just its
  first day. A day's marker(s) are purely a `cadenceOf(e.type).emoji` (or
  the special's own emoji); tapping a marked day opens a sheet listing that
  day's items, and tapping an item hands off to the SAME real views
  everywhere else — `eventSheet` for anything already booked or logged,
  `logModal` for a still-planning entry, `stashSheet` for a special date —
  so the calendar is a lens over the real data, not a second copy of it.
  Privacy matches every other glance view: `cardVal`'s masking (private
  plans, locked fields) applies here too, and a locked `dateEnd` collapses
  the marker to a single day rather than revealing how long the trip runs.
  Month navigation (‹ / today / ›) resets to the current month on leaving
  the view, same as the fridge's doors closing behind you.
- **Cadence holds** (`holdWindows`) — the rhythm projected FORWARD as
  computed-not-stored placeholder weeks, so either of you can plan months
  ahead rather than only ever seeing the next slot. Anchored on the last
  entry you actually DID (falling back to the earliest one on the books when
  nothing's logged yet), then stepped by `cadenceOf(type).days`, emitting
  the week around each due date out to `HOLD_HORIZON` (400d — past that it's
  fiction). Dashed-bordered and faded on the calendar to read as *not
  booked* against a real entry's solid marker. Occasions get none
  (`days === 0`, not cadence-based).
  - **A taken week is not a hold**: any real entry of that type overlapping
    the week (a getaway's whole span counts) fills the slot, and that
    entry's `owner` — not the alternation — sets who's up next. So booking
    something doesn't just delete one hold, it re-phases every later one.
  - **Whose turn** alternates slot to slot, starting from the OTHER of
    whoever owned the anchor; unknown (omitted) if that entry predates the
    `owner` field. No new state to track, nothing written to `DB` — the
    whole series is recomputed on every render.
  - The generator steps one week past the requested range, because a slot
    due just after a month boundary can still *start* inside it; the
    overlap test (`to >= fromDate && from <= toDate`) decides what's
    actually emitted.
  - Tapping a hold day opens a sheet naming the cadence, the due week, and
    whose turn — the row itself is the plan-it button
    (`logModal(type, { planned: true })`), same forward-planning entry
    point as Rhythm's status boxes.
- **Event owner** — each event belongs to its creator (`owner`). Only the
  owner can lock fields (add surprises); the other of you can edit the open
  fields but not privatise. The sheet names the owner when it isn't you.
- **Per-event surprises** — every field but the date has a 🔒 toggle in the
  sheet (on plans and on existing entries). Locking one keeps its value on
  your phone only (never synced); the other of you sees "🔒 Kept as a
  surprise 💝" in its place. **Glance-proof:** at a glance (cards, tiles,
  history) a locked field is masked with 🔒 on the setter's phone too
  (`cardVal`), so a shoulder-surf reveals nothing — the real value shows
  only inside the event's own sheet (`shownVal`, tinted, marked "🔒
  surprise"). The front carries no per-field badge; the masked title already
  reads as a surprise. After the reveal, edit the event and toggle the 🔒 off
  — the field then syncs normally, reads right in History. Booking never
  reveals a locked field.
- **Full surprise (`🙈 Hide the whole plan`)** — a per-event switch that hides
  the *entire* plan from the other phone (not even the date/existence shows).
  `entry.private`; `sharedPayload` sends a tombstone in its place, so they
  drop any prior copy, while this phone keeps the real record. Best set at
  creation; ideal for a surprise getaway. Toggling it off later cleanly
  reveals the plan.
- **Cover name** — while the title is locked, an optional editable decoy
  (`entry.cover`) shows on the front instead of "🔒 A surprise 💝", so you
  control the visible title. City-only area links for a secret location now
  use the **location's own city** (parsed from the address) when it can be
  read, falling back to the Home city.
- **✨ idea generation lives in the Ideas tab** (was also a per-event "Plan
  with Claude" button; removed to keep event cards button-free). The Ideas
  tab's Claude suggestions are scoped by cadence via `IDEA_SCOPE`: date
  nights stay local (Chandler/Gilbert/southeast valley), special occasions
  range across the metro, getaways reach statewide or within ~6 hours'
  drive, trips go destination-wide.
- **Section order on Rhythm** — ♥ How was it? (the only thing waiting on
  you) → **✅ Booked** → **Plan & log** → **🔨 Still planning** → 💫 This
  week in your story. What's locked in leads, everything actionable stays
  contiguous, and the nostalgia block sits last rather than splitting the
  actionable sections.
- **✅ Booked** — plans that are locked in, soonest first, with countdowns.
  Only real entries with `status === 'booked'` appear here: a birthday or
  anniversary is **not** booked (nothing is locked in for it — it just
  arrives), so special dates sit under 🔨 Still planning instead, which is
  what they actually want from you.
- **Special dates** (anniversary Sep 12, 2013 with years count; birthdays
  Chris Feb 26, Kat Aug 15) surface under 🔨 Still planning only when
  within 45 days — clean the rest of the year (defined in `SPECIAL` in
  `app.js`). Tapping a special-date row opens a **🎁 private stash** for
  that person/occasion — gift ideas, trip thoughts, hints they dropped —
  device-local, never synced, so it works like a surprise scratchpad. All
  three stashes (Kat, Chris, Anniversary) are reachable year-round from the
  **Surprise stashes** card on Goals, without special dates cluttering
  Rhythm out of season.
- **✨ results are keepers** — deep dives and per-plan idea runs cache
  on-device for ~30 days (`deepcache`) and show instantly on reopen; an
  explicit ↻ refresh is the only thing that re-spends tokens.
- **Lookup links** — curated-pick sheets and any event with a known,
  non-hidden location get link-outs for menu & prices (or stays & prices for
  getaways/trips), map & hours, and reviews. Links are constructed searches
  (Google/Maps/Yelp), not hardcoded venue URLs, so they can't rot. A locked
  🔒 location shows **no** links (they'd name the surprise venue even on the
  setter's own screen). A secret location instead offers **city-only** area
  links (from `settings.city`) so the exact address never reaches a search
  URL, only the city.
- **🔨 Still planning** — plans with a date but details not locked in. Every
  planned entry carries a `status` flag (`planning` default → `booked`),
  toggled right on the card. Getaways/trips in planning carry a reminder to
  build a trip-guide app (like Jerome).
- **Logging** — via the flip link on the plan sheet, or automatically when a
  planned event's date passes into history: 1–5 ♥ rating and **memory
  questions** (date night: favorite moment / food / drink; getaway & trip:
  favorite activity / food / a moment to keep). Memories show in History.
- Plan-date defaults scale with the cadence (date +2wk, getaway +6wk, trip
  +6mo) to encourage planning getaways and trips early.
- Everything is **editable after submission** — tap an upcoming card, or ✎
  on any history row. Editing a past entry shows the detail fields too, so
  where-you-went can be recorded (or a surprise unlocked) after the fact.
- **Auto-retire to History** — a plan that is **booked, past, and rated**
  graduates out of Rhythm to History's "Been there" (`shouldGraduate` /
  `graduatePast`, run on open, after sync, and on save). A still-*planning*
  past plan stays put (it never got confirmed).
- **♥ How was it? (v46)** — the other half of that rule (`awaitingRating`):
  booked + past + unrated. These used to sit in Rhythm's ✅ Booked list and
  History's "Coming up" chipped `✅ booked`, indistinguishable from a genuinely
  future plan and counting down "in -1d" — the app was asking for a rating
  without saying so, and the details sheet offered only Close/✎ Edit, so the
  rating wasn't even reachable from where the nudge landed. Now they get their
  own **♥ How was it?** section leading Rhythm (with a jump chip) and heading
  History, are chipped `✅ happened · rate it`, count *back* ("yesterday",
  "3d ago"), and the details sheet carries a live 5-♥ control: one tap rates
  it, retires it, and files it under Been there. The stat boxes say `♥ rate it`
  too. Every section and chip vanishes on its own once nothing is waiting.
- **📝 The recap (v47)** — the three `MEMQ` short prompts (per type: favorite
  moment / food / drink, etc.) plus a free-form **`recap`** textarea, in one
  sheet. It's offered automatically the FIRST time you rate something (the
  moment you're already thinking about it — a re-rating never re-asks), and is
  reachable any time from an event's sheet via **📝 Add recap / 📝 Recap**.
  Tapping a History row's body now opens that sheet (same as a fridge magnet),
  so the recap isn't stuck behind ✎ Edit. Skipping it still keeps the rating.
  `recap` is separate from `notes` on purpose: `notes` is the plan you followed
  ("dinner at 5:45 first"), `recap` is what happened, so writing one can never
  overwrite the other. Both show, separately, on the event sheet.
- **📖 The recap book (v48)** — a sub-view off History (`current = 'recaps'`,
  alongside 🎞 Rewind, which now links into it). Where Rewind *counts* things,
  this one *quotes* you: every completed entry that has a recap or any `mem`
  answer, all-time, newest first, grouped by year — labelled prompt answers
  plus the write-up as a quote-ruled block in the hand font, so it reads as a
  journal rather than a dashboard. Header counts recaps against total logged
  and nudges the ones still blank. Planning `notes` are deliberately excluded.
  Titles go through `titleText()` like everywhere else, so a 🔒 locked title
  shows its cover here too. Tapping an entry opens its event sheet.
- **📄 Save as PDF (v49)** — `window.print()` plus a real `@media print` block,
  no PDF library (Chrome's print sheet on Android writes the file; iPhone is
  Share → Print). The printed page IS the document: app chrome, both `.seg`
  rows and the on-screen hints are hidden, a `.print-only` byline
  ("Chris & Kat · Ortiz Us OS · saved <date>") appears, the palette is forced
  light regardless of the phone's theme, and `break-inside: avoid` keeps an
  entry from splitting across pages (year headings won't strand either).
- **Printed as a scrapbook (v50)** — on paper each entry becomes a card taped
  onto a cream page: a deterministic alternating tilt (`sb-l`/`sb-r`, by index
  so both phones and any reprint match), a washi strip (`.rb-tape`, side
  borders only so it reads as tape not a label), and hand-lettered year
  dividers. All print-only — the on-screen book stays flat and untilted. The
  look leans on borders and transforms rather than fills, because Chrome's
  "background graphics" setting can override `print-color-adjust`.
- **History reworked (v50)** — the tab dropped **Coming up** entirely: Rhythm's
  ✅ Booked / 🔨 Still planning already own what's ahead, and mirroring them
  made the two tabs read as copies. History is retrospective now — ♥ How was
  it? then Been there, grouped by year with `.hyear` dividers. Rows became
  `historyCard()` in the recap book's clothes (rating chip, `mem` answers, the
  recap clamped to 2 lines with the full read a tap away in 📖), keeping 📷 /
  📝 / ✎ and a ✕ that finally **asks first** via `confirmSheet` — it was a
  one-tap tombstone on a 35px target beside ✎, on rows that now carry the
  recaps. The old `historyRow()` is gone.

### Rhythm delights (v31)
- **💫 This week in your story** — past entries whose month-day falls within
  ±3 days of today, from any earlier year, shown as tappable memory rows
  (years-ago, hearts, a saved memory quote). Straight month-day window — no
  Dec/Jan wrap-around, deliberately.
- *(v31 note: the fridge door and tonight's question debuted on Rhythm and
  moved to the dedicated 🧲 Fridge tab in v32.)*

### 🧲 The Fridge tab (v32)
A sixth tab: one skeuomorphic fridge (steel door, left-hand handles), three
zones. Requires `settings.who` (a friendly gate points to Settings).
Everything is discovery — the tab carries no instruction text.
- **Freezer — tonight's question.** 40 dinner-table questions (`TQ_ITEMS`,
  static), picked deterministically from the date so both phones match with
  zero sync. Each of you answers on your own phone (`tq:ans:<who>` — one
  record per person, overwritten daily); tapping your own saved answer (v51)
  reopens the same input, prefilled, to revise it. A **heart in the card's bottom-right
  corner** (v41) is the keep — a like button, not a labelled action. It only
  appears once BOTH of you have answered (before that there's nothing to
  keep, and no disabled control sits there explaining itself); tapping it
  snapshots the question + both answers (`tq:keep:<date>`) as a rose in
  History's vase, and tapping the filled heart takes it back out. Undo
  tombstones the record (`deleted: true`) rather than dropping it, so the
  other phone doesn't re-add the rose on the next sync — the vase and the
  card both skip tombstoned keeps. Today's snapshot self-heals from the live
  answers if it was kept before the partner's answer synced in. A tiny paper plane on
  the card (v40) opens the share sheet with the question, a nudge line that
  adapts to who's answered so far ("Mine's already on the fridge — your move
  😏"), and a link to the app that deep-links straight to the Fridge tab
  (`#fridge`). Answers never ride along in the share text, and the share is
  stateless — nothing new syncs. Saving your answer while the other of you
  hasn't answered also offers the nudge right then (one yes/no modal, never
  outside that moment).
- **Door — the post-its.** One note each (`note:<who>`), blue paper for
  Chris, blush for Kat, auto-signed "— Love, Chris"/"— Love, Kat" in your ink
  colors. On your own note, tapping the paper opens the write-a-new-one flow
  anytime, not just when it's empty, and the existing text opens
  **preselected** (v44) — type to replace it outright, or tap once to drop
  the cursor in and edit; neither path needs a delete first. The **folded
  corner** is a separate zone (v44): it opens a shuffleable **fun nudge**
  to text the other of you (🎲 for another, "Send it" opens the share sheet
  with the line + the `#fridge` link). The pool is playful one-liners, plus
  pointed "still unread" ones when your note is pinned and unseen; the note's
  own text never rides along. The fold stays a plain paper triangle with no
  added graphic — the invisible catcher over it just gained a better job than
  duplicating the paper's own tap — and the signature shifts left so the
  corner can be thumb-sized without stealing taps meant for it.
  Sound note logic: reading is
  free (❤️ saving is opt-in); a synced seen-receipt (`note:seen:<who>`) shows
  the writer "seen 💗" (coupon-style); replacing a note the other hasn't read
  warns first and archives the old text as **💌 one you missed** (`notemiss:`)
  on their fridge until opened; 🗑 is an intentional retraction — no archive.
  **Nothing tappable sits on the paper any more (v45)** — those were 17–20px
  targets. Tapping *their* note opens a reading sheet with full-size **Close /
  ❤️ Jar / 🔥 On ice** (same buttons as a 💌 missed note; sweet → their jar,
  spicy → the freezer, `notekeep:`, and the note stays pinned either way).
  🗑 moved into your own note's editor as a `btn-danger` action. The only
  thing left on the paper is the non-interactive "seen 💗 / not seen yet"
  status and the folded corner's nudge zone.
  Pinning a note offers a nudge (v40): a yes/no modal, then the share sheet
  with a teaser ("📌 Just left you a little something on our fridge — come
  see 👀") + the `#fridge` link. The note text itself never rides along —
  the note is the reason to open the app, and personal words stay off
  lock-screen previews. Taking a note down never offers it.
- **Door — souvenir magnets.** One per logged getaway/trip, shape derived
  from title/loc keywords (mine cart, mesa, pine, eighth-note, sun-over-
  wave; hashed-color oval + cadence emoji as fallback) — deterministic, so
  both phones render the identical fridge. The magnet band grows the door's
  height as more trips are logged, so the fridge elongates to keep them all
  on its face. Tap = wobble; double-tap opens
  the memory (`eventSheet`). Up to two ghost-outlined "someday" magnets
  from planned getaways/trips tap through to Ideas.
- **Three easter eggs.** C ♥ K letter magnets: six quick taps opens Just us
  💗 (the wordmark-heart door stays too). The **door** handle: four taps
  swings the fridge door open (handles disappear) onto comfort food that
  serves your ❤️-saved **sweet** notes. The **freezer**: six taps on the
  freezer face opens it onto a frosty shelf of ice cream that serves — and
  where ➕ composes — **spicy 🔥** notes (`notekeep.spicy`), kept out of the
  jars and comfort shelf so the freezer is their own private stash. The two
  compartments open independently and each keeps the fridge's size.
  **Closing mirrors whatever opened it** (v42): the door opens by its handle,
  so one more tap on that same handle shuts it; the freezer opens by its
  face, so a tap anywhere on the open face shuts it (its handle works too).
  Taps on the contents — a treat, ➕, "close the freezer" — belong to that
  content and never close by accident. The handles stay exactly where they
  were when open (invisible, `opacity:0`, still hit-testable), and each
  carries an invisible 44px collar (`.fhandle::before`) so the 9px of drawn
  chrome is actually thumb-sized — it sits in the left padding gutter, over
  nothing else.
- **In History:** the 🌹 vase (top) — a closed bud per kept question, 3
  overlapping petals staggered in depth (`roseBloom`, not a flat dot), reads
  as a rose even solo; tap to read the Q&As — each person's answer gets its
  own block (v43), names in one column and answers in another with a hanging
  indent, so a long reply no longer runs into the other's name mid-line; and
  🫙 jars (bottom) —
  per-person collections of saved notes. Both appear only once they have
  contents.

### 🎞 The Rewind (v31)
Reached from History: the trailing 12 months computed purely from existing
records — counts per cadence (stat tiles), the highest-rated "night of the
year" with saved memories (latest wins ties), average rating, coupons sent
per person, bingo squares marked in the window (seeds and FREE squares
excluded), 36 Questions progress, and the yes/no/maybe both-yes count (only
once revealed). Nothing new is stored.

### Planning quality-of-life (v31)
- **🎰 Surprise us** (Ideas tab) — mood chips (tonight-ish / big night /
  whisk us away / dream big → the four cadences), then a decelerating
  slot-machine draw over open ideas + live curated picks. "Plan it" opens
  the plan sheet prefilled (marking a source idea done on save). Private
  ideas are excluded from the draw so a surprise can't leak into a shared
  plan title.
- **🧳 Packing checklist** — in the booked details view, the what-to-pack
  text renders as a tickable checklist (items parsed from commas/newlines;
  ticked state is the item strings in `entry.packDone`, synced with the
  entry — renaming an item resets its tick). Single-item and secret pack
  fields render as before.
- **📷 Photo album links** — `entry.album`, one synced URL per event
  (scheme auto-prefixed), editable on plans and existing entries; a 📷 link
  in the booked details sheet and on History rows. This is the deliberate
  photo strategy: link a shared album, store no images.

### 💾 Backup & restore (v31)
Settings card. Download captures the ENTIRE store — including device-local
secrets, stashes, private ideas, and settings/keys (the file is as sensitive
as the phone; the UI says so). Restore **merges, never replaces**: `mergeCol`
per record collection (newest `updatedAt` wins, same as sync), local-wins
for `secrets`/`stash`/`deepcache` objects, and `settings` fills gaps only —
so an old file can't clobber newer data, and a fresh phone recovers
everything. `restoreData` is exposed on `window.__us` for debugging.

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

### 💗 Beyond the card (content-driven activities)
Three activities below the sweet bingo card, each synced via the `acts`
collection (deterministic ids — see ARCHITECTURE.md). The two answer games
require `settings.who` (a friendly gate points to Settings otherwise) and
use an **agreed-reveal** mechanic: each of you answers solo, the other's
answers stay hidden (only counts and per-item "answered 🤫" hints show)
until **both** tap "I'm ready to reveal" — then everything flips face up.
Either can hide theirs again; answers stay editable throughout. The hiding
is UI-level (a game mechanic, not a privacy guarantee — answers do sync,
unlike 🔒 secrets).
- **💌 Yes / No / Maybe** — 22 flirty-to-adventurous prompts (`YNM_ITEMS`).
  Post-reveal verdicts: 💚 both-yes ("it's a date"), 🌱 yes+maybe ("worth a
  conversation"), 🤍 two maybes; **any no retires the item flatly** — YNM
  etiquette, nobody litigates a no.
- **🕯️ The 36 Questions** — Aron et al.'s 1997 closeness-study interview
  (the NYT-famous one), full text baked in (`Q36`), run as a paced card
  runner: three sets of 12, both answer aloud before advancing, position
  shared+synced (`q36:progress`) so pausing mid-set survives. The closer:
  4 minutes of silent eye contact with a built-in countdown timer that
  ends on "Now kiss 💋". "Start over" resets.
- **🎲 Would You Rather** — 18 couple dilemmas (`WYR_ITEMS`) as stacked
  either/or buttons; agreed-reveal shows 🎯 matches or both picks side by
  side.

### Ideas
- A running backlog per cadence, freeform text entries.
- **Curated picks** — baked-in, hand-researched recommendations (`RECS` in
  `app.js`): 28 date nights (with a deliberate Chandler / Gilbert / Queen
  Creek lean — home turf), 7 getaways, 5 destinations, each with area, star
  rating, a one-line why, and a longer insider take behind a tap. Zero API tokens. "Add to ideas" copies one
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
  **each of you gets your own** 12 🎟️ drink tickets and 3 🏖️ weekend escape
  passes for the whole stretch — spending yours never moves the other's
  total. Ids are `dry-2027:<kind>:<who>:<n>` (`PASS_OWNERS`), so the sets are
  seeded deterministically on both phones and the merge stays idempotent;
  the owner is the record's **`who`**, not who happened to tap it.
  - **Your set renders first and is the only tappable one**; theirs shows
    below in `.tickets.theirs` (dimmed, solid-bordered) and taps open a
    read-only `peekTicket` — you can see where they're at, not spend it.
    With no `settings.who` yet, neither set is spendable and a line points
    at Settings. Used passes take their owner's colour
    (`.ticket.used.from-<who>`, which must override `.used`'s grayscale).
  - **Migration from the old shared pool** (`migrateTickets`, run right
    after `seedTickets`): passes were once one shared pool
    (`dry-2027:<kind>:<n>`, 3 id segments — `isSharedPass`). A used shared
    pass carrying **`by`** moves into that person's own set, assigned in
    order so both phones derive identical records, timestamps and occasion
    included. Claims from before `by` existed can't be attributed and are
    **left behind rather than guessed at**. Old records stay untouched so a
    phone still on the shared build keeps working.
  - The already-migrated marker (**`moved`**) sits on the *source* record,
    which syncs — deliberately **not** in `settings`, which doesn't. A local
    flag would let a phone with no such flag (a fresh install pulling the
    Gist) re-run the migration and resurrect a pass its owner had since
    given back.
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
  Script webhook; see [COUPON_EMAIL.md](COUPON_EMAIL.md). Chris's book
  carries an 11th ✨ **introduction coupon** ("I made this for us 💞 …the
  grand tour…", full-width in his book) meant to be the very first send. Coupons:
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

### Settings (v37: appearance up front, everything else collapsed)
- **Appearance** — light / dark / auto, a single segmented pill at the top
  of the page. Tapping applies immediately (`applyTheme()`) — no Save step,
  since it's the control used every visit.
- **Account, sync & advanced** — This phone belongs to, home city +
  interests, Claude API key, coupon email nudge, and shared sync (token +
  Gist ID) all live inside one collapsible row, since they're set once and
  rarely touched again. Collapsed by default (`settingsExpanded`, resets to
  `false` on every app boot) — except it force-opens before "This phone
  belongs to" is set (first-run setup), and a Save keeps it open through
  that session so the confirmation is visible. The collapsed row's subtitle
  summarizes current state (who, sync on/off, ✨ key set) so the essentials
  are still glanceable without expanding. 💾 Backup & restore sits inside
  the same collapsed area.
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

## Non-goals

- Multi-user support beyond the two-device Chris/Kat pair.
- A backend or hosted database — local-first with Gist sync is the whole
  infrastructure, intentionally.
- Rich media (photos, attachments) on entries — text notes only, for now.
  (Photos were considered and deliberately deferred: base64 images would
  blow past localStorage and Gist size limits quickly. The v31 answer is
  `entry.album` — one link to a shared iCloud/Google Photos album per
  event; actual image storage remains out of scope.)
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
