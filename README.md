# Apex Tracker

A personal Apex Legends match recorder. It is phase 1 of [DESIGN.md](DESIGN.md):
a background app that saves every Overwolf game event to JSONL files. The
dashboard's stats are computed from those files in the app
(`src/build-dataset.ts`); `sql/` has DuckDB queries for exploring them.

## Run it on the Windows PC

### One-time setup
1. Install **Node.js 22.12 or newer** (LTS) and **Git** for Windows.
2. Get **Overwolf Dev Mode credentials**. You need an approved Overwolf
   developer account; see DESIGN.md §10. Then go to Developer Console →
   Settings → Profile → "Revoke and get new API key".
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

Recordings are saved to `Documents\ApexTracker\recordings\`, one `.jsonl`
file per session.

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
The preview shows the real (anonymized) matches in `fixtures/recordings/`.
`APEX_RECORDINGS_DIR=<folder>` points it at other recordings, and
`APEX_UI_QUERY="data=sample"` shows the generated sample data instead. The
real app (`npm start`) shows what it recorded, or sample data until then.

## Kill/death popup
```bash
npm run popup:preview   # replays your latest recorded match's popups, 4 s apart
```
The preview uses made-up ranks (it never calls the API: fixture IDs are
fake). `APEX_REPLAY_MATCH=<match id>` picks another match. In the real app
(`npm start`) the popups use `APEX_STATUS_API_KEY` for ranks; see DESIGN.md §12.

Launching Electron from VS Code's terminal on Windows can fail with
`Cannot read properties of undefined (reading 'whenReady')`: VS Code sets
`ELECTRON_RUN_AS_NODE`. Clear it first (`Remove-Item Env:ELECTRON_RUN_AS_NODE`).
