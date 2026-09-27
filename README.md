# Apex Tracker

A personal Apex Legends match recorder. It is phase 1 of [DESIGN.md](DESIGN.md):
a background app that saves every Overwolf game event to JSONL files. The
dashboard's stats are computed from those files in the app
(`src/build-dataset.ts`); `sql/` has DuckDB queries for exploring them.

## Run it on the Windows PC

### One-time setup
1. Install **Node.js 22.12 or newer** (LTS) and **Git** for Windows.
2. Get an **Overwolf Developer Key**. You need an approved Overwolf
   developer account (DESIGN.md §10). Log in on https://dev.overwolf.com,
   open your profile (top right) → **Developer Key**, and copy it into
   `OW_DEV_KEY` in `.env`. It expires every 14 days: press **Extend** there
   (possible from 2 days before). An expired key fails with "invalid
   verification" at start. (The Console's `OW_CLI_EMAIL` + `OW_CLI_API_KEY`
   pair is the other option; it didn't verify for us.)
3. Get an **apexlegendsstatus API key** from the developer portal linked on
   https://apexlegendsapi.com/ (free). Optional: without it, RP isn't recorded.
4. In Apex: **Settings → Gameplay → Obituaries: On**. The kill feed, and so
   kills per weapon, depends on it.
5. Clone the repo, then in PowerShell:
   ```powershell
   npm install
   copy .env.example .env   # then fill in the values in .env
   ```

### Each time you play
```powershell
npm start
```
Leave the window open, then launch Apex. You should see
`Apex Legends detected` and `Subscribed to N features`, followed by
`Phase: ...` lines as you queue and play. Stop the recorder with Ctrl+C.

If it logs "runs as administrator", start PowerShell with "Run as
administrator" and run `npm start` again.

The app brings its own Overwolf packages: the Overwolf client isn't needed.
Don't run the client alongside it: closing the client mid-session stopped our
app's game events (2026-09-27).

Recordings are saved to `Documents\ApexTracker\recordings\`, one `.jsonl`
file per session. The dashboard and `app:preview` show them, and my EA ID per
account is kept in `Documents\ApexTracker\accounts.json` for RP lookups.

## Look at the data (Mac or Windows)
Copy the `.jsonl` files into this repo's `recordings/` folder, then from the
repo root:
```bash
uv run --with duckdb python -c "import duckdb; c=duckdb.connect(); c.execute(open('sql/bronze.sql').read()); print(c.sql('select kind, feature, key, count(*) from bronze_lines group by all order by all'))"
```
`sql/spike.sql` has the queries for the spike questions in DESIGN.md §7.

### Real data without our recorder
The Overwolf client logs every game event it hands to apps (for example
while another Apex app like TRN's tracker runs). This replays that log
through our `Recorder` into `recordings/`, one file per Overwolf session:
```powershell
npm run import:gep-log                     # reads %LOCALAPPDATA%\Overwolf\Log\Apps\Overwolf General GameEvents Provider
node dist/import-gep-log.js "<log folder or files>" --out recordings   # other paths (npm mangles spaces)
```
Overwolf rotates these logs after a few sessions, so copy them somewhere
first. They lack info snapshots and API RP snapshots (see DESIGN.md §9.1).

Plain recordings contain other players' names and IDs: keep them out of git.
To add matches to the anonymized set in git (`fixtures/recordings/`), import
with `--anonymize`, keeping friends by name (you are always kept):
```powershell
node dist/import-gep-log.js "<log folder>" --out fixtures/recordings --anonymize --keep santoznma
```

## Development
```bash
npm test         # recorder and stats tests; runs on any OS
npm run build
npm run lint     # ESLint; style otherwise follows .editorconfig (no Prettier)
npm run ui:check # type-check the dashboard
```
CI (`.github/workflows/ci.yml`) runs all of these on every push.

## Dashboard
```bash
npm run app:preview     # the app window, without Overwolf (works on macOS)
npm run ui:watch        # rebuild the UI on save; reload the window with Cmd/Ctrl+R
```
The preview shows what the app has recorded (`Documents\ApexTracker\recordings\`),
like `npm start` does. `APEX_RECORDINGS_DIR=<folder>` points it at other
recordings (`fixtures/recordings` has the anonymized ones in git, for tests
and for working on the UI on another machine), and
`APEX_UI_QUERY="data=sample"` shows the generated sample data instead.

## Popups (kill/death and lobby cards)
```bash
npm run popup:preview   # replays your latest recorded match's popups, 4 s apart
```
`APEX_REPLAY_MATCH=<match id>` picks another match. The cards use only the
recordings (no API key needed); see DESIGN.md §12.

### Live, from the Overwolf client's log (before we had Dev Mode)
Superseded by `npm start`; kept for replaying old logs. While another Apex
app (e.g. TRN's tracker) runs, the Overwolf client logs
every game event. This follows that log and shows the cards as you play:
```powershell
npm run popup:live
```
It also writes the session to `recordings/` as it goes (under the importer's
name, so a later `import:gep-log` replaces it). Point the dashboard at that
folder and it reloads by itself when a match finishes:
```powershell
$env:APEX_RECORDINGS_DIR = (Resolve-Path recordings).Path; npm run app:preview
```
The popup shows over Apex only in borderless windowed mode. During a match
the dashboard can't take focus, so it never pulls the mouse pointer over the
game.

Launching Electron from VS Code's terminal on Windows can fail with
`Cannot read properties of undefined (reading 'whenReady')`: VS Code sets
`ELECTRON_RUN_AS_NODE`. Clear it first (`Remove-Item Env:ELECTRON_RUN_AS_NODE`;
on macOS, prefix the command with `env -u ELECTRON_RUN_AS_NODE`).
