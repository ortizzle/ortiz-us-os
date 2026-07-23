# Open When

A private legacy time capsule: Chris and Kat write letters, prompt answers,
photo stories, and voice notes for Sedona and River, sealed into "open when…"
envelopes that unlock over the years.

**This folder is temporary staging.** Open When is its own app, destined for
its own repos (the GitHub integration in the build session couldn't create
them):

- App shell → public repo `ortizzle/open-when` (GitHub Pages)
- Media → private repo `ortizzle/open-when-media` (photos + voice via the
  contents API, fetched with auth — raw URLs don't work on private repos)
- Text data → a fresh secret Gist `open-when-data` / `data.json` (created from
  Settings inside the app)

## Architecture

Single `index.html`, no build step, per family-app-standards. localStorage is
the source of truth; Gist sync uses safe-merge + tombstones (newest `updatedAt`
wins, deletes never resurrect, tombstones pruned after 60 days). All date logic
is Arizona time. Zero names-beyond-first-names, birthdates, tokens, or hashes
in the code — everything personal lives in the Gist/media repo behind the
token.

Unlocks are synced records (`unlock_<who>_<milestone>`): birthday envelopes
(13/16/18) auto-unlock from birthdates stored in the synced settings record;
moment envelopes need the keeper passphrase (SHA-256 hash in settings, held by
Kat); any envelope can be unsealed by hand in author mode.

## First-run setup (author phone)

1. Open the app → gear → choose who's writing on this device.
2. Paste the GitHub token (fine-grained: gist read/write + contents read/write
   on `open-when-media`).
3. Tap "Create a fresh Gist" — the id fills in; share token+gist id with the
   other phone.
4. Enter Sedona's and River's birthdates; Kat sets the keeper passphrase.

Reader phones: same token, role "Reader" — that's the whole keeper-sheet flow.
