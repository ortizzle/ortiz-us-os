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

- **Rhythm** — each cadence shows the last one, the next due date, and a
  countdown. Log what happened; plan what's next.
- **Up Next** — everything planned, soonest first, with countdowns — the
  anticipation tab. Cadences with nothing planned get a nudge.
- **Ideas** — a running backlog per cadence. With a Claude API key in
  Settings, ✨ generates real, local-feeling suggestions (city + interests
  aware). "Plan" turns an idea into a scheduled date.
- **🔒 Private ideas** — the lock next to the add box. Locked ideas (including
  Claude-generated ones while locked) are stripped from the sync payload and
  never leave the device. For surprises.
- **Goals** — shared commitments with grace built in: the alcohol-free
  stretch through Jan 17, 2027 ships with 12 🎟️ drink tickets and 3 🏖️
  weekend escape passes — tap one to use it (with an occasion note), tap a
  used one to give it back. Ticket state syncs to both phones.
- **History** — been there, with ♥ ratings out of 5.

## Run locally

Any static server, e.g.:

```
npx serve .
```

(The ✨ Claude feature needs HTTPS or localhost; everything else works offline.)
