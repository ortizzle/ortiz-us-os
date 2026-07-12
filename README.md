# Ortiz Us OS

Chris & Kat's **2-2-2** app — a date night every 2 weeks, a weekend getaway
every ~2 months, a couples destination trip every ~2 years. Tracks the rhythm,
holds the idea backlog, and remembers where you've been. Fourth app in the
Ortiz OS family, alongside
[Home OS](https://ortizzle.github.io/ortiz-home-os/),
[Learning OS](https://ortizzle.github.io/deep-learning-os/), and
[Focus OS](https://ortizzle.github.io/ortiz-focus-os/).

**Stack:** vanilla HTML/CSS/JS, ES modules, no build step. Local-first
(localStorage) with optional shared private-Gist sync — both phones point at
the same token + Gist ID (the Home OS gist works; Us OS writes its own
`ortiz-us-os.json` file). Merge is per-record, newest-updatedAt wins,
tombstones keep deletions deleted.

## How it thinks

- **Rhythm** — special-date countdowns (anniversary + birthdays) up top,
  then "Coming up" (everything planned, soonest first, with countdowns and
  a trip-guide-app reminder for getaways/trips), then each cadence's card.
  Log what happened — with memory questions (favorite moment/food/drink for
  dates; activity/food/a-moment-to-keep for getaways and trips) — or plan
  what's next. Everything's editable after the fact (✎).
- **Ideas** — a running backlog per cadence, plus **curated picks**: baked-in,
  hand-researched Phoenix-area recommendations (restaurants, getaways,
  destinations) with ratings and why — no API tokens needed. Tap for the full
  story; ✨ "Go deeper" (with an API key) fetches insider tips. With a key,
  ✨ also generates fresh city-and-interests-aware suggestions. "Plan" turns
  any idea into a scheduled date.
- **🔒 Private ideas** — the lock next to the add box. Locked ideas (including
  Claude-generated ones while locked) are stripped from the sync payload and
  never leave the device. For surprises.
- **Goals** — shared commitments with grace built in: the alcohol-free
  stretch through Jan 17, 2027 ships with 12 🎟️ drink tickets and 3 🏖️
  weekend escape passes — tap one to use it (with an occasion note), tap a
  used one to give it back. Ticket state syncs to both phones.
- **History** — been there, with ♥ ratings out of 5 and saved memories.
- *…and if you tap the heart in the top corner six times, something's there
  for just you two.* 💗

## Run locally

Any static server, e.g.:

```
npx serve .
```

(The ✨ Claude feature needs HTTPS or localhost; everything else works offline.)
