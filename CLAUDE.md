# Apex Squads: notes for agents

A Windows ow-electron app for Apex Legends: it records every Overwolf game event
(GEP) to JSONL, builds a stats dashboard from the recordings, and shows kill/death
and lobby popup cards. Read README.md for commands and DESIGN.md for decisions and
their dates.

## Overwolf
Don't reread Overwolf's docs: `docs/overwolf/` distills all of them (2026-09-28),
with sources, contradictions and open questions. Start with docs/overwolf/README.md.
Refresh with `node scripts/fetch-overwolf-docs.mjs <dir outside the repo>` when
something there looks out of date, and update the files and their date.

## Code map
- `src/main.ts`: the real app (ow-electron + GEP). `src/recorder.ts`: GEP messages to
  JSONL lines, RP snapshots. `src/build-dataset.ts`: recordings to the dashboard's
  facts (matches, RP, loadouts). `src/window.ts`: dashboard window, auto-refresh.
- `src/ui/`: the dashboard and popup renderer (no framework; `el()` helpers).
- `src/import-gep-log.ts`, `src/live-popups.ts`: replay the Overwolf client's own log
  (from before we had Dev Mode).
- `test/`: node:test; `fixtures/recordings/` holds anonymized real matches.

## Rules
- Real recordings contain other players' names and IDs: they stay out of git
  (`recordings/` is ignored; the app writes to `%APPDATA%\Apex Squads\`). Only
  anonymized recordings go in `fixtures/recordings/`: anonymize all sessions in one run
  so aliases stay consistent, and check the existing fixture files come out unchanged.
- Never read, print or commit `.env` values (Overwolf and apexlegendsstatus keys).
- Before committing: `npm run build`, `npm run ui:check`, `npm run lint`, `npm test`.
- The user plays while the app runs: don't open or restart windows during a match
  (they take focus from the game).
- Windows/PowerShell: clear `ELECTRON_RUN_AS_NODE` before launching Electron from VS
  Code's terminal; `git commit -F <file>` for multi-line messages.
