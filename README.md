# Apex Squads

An Apex Legends match recorder and stats app. It is phase 1 of [DESIGN.md](DESIGN.md):
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
Then launch Apex. You should see `Apex Legends detected` and
`Subscribed to all features; Apex supports N: ...`, followed by `Phase: ...`
lines as you queue and play. Closing the window keeps the app recording in the
tray: its menu reopens the dashboard or quits. Ctrl+C also stops it.
An installed build can start with Windows from the tray menu, in the tray.

If it logs "runs as administrator", start PowerShell with "Run as
administrator" and run `npm start` again.

The app brings its own Overwolf packages: the Overwolf client isn't needed.
Don't run the client alongside it: closing the client mid-session stopped our
app's game events (2026-09-27).

Recordings are saved to `%APPDATA%\Apex Squads\recordings\`, one `.jsonl`
file per session. The dashboard and `app:preview` show them, and my EA ID per
account is kept in `%APPDATA%\Apex Squads\accounts.json` for RP lookups.

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

The app icon's source is `build/icon.svg`. After changing it, `npm run icons`
redraws every icon file from it: `build/icon.ico` (exe and installer),
`build/icon.png`, `build/store-icon-55.png` (Overwolf store listing) and the tray
and window icons in `ui/assets/icon/`. The title bar's copy is in `src/ui/app.ts`.

## Dashboard
```bash
npm run app:preview     # the app window, without Overwolf (works on macOS)
npm run ui:watch        # rebuild the UI on save; reload the window with Cmd/Ctrl+R
```
The preview shows what the app has recorded (`%APPDATA%\Apex Squads\recordings\`),
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

Which popups show, where and for how long is set in the dashboard's Settings
tab and saved to `settings.json` in the app's data folder (`%APPDATA%\Apex Squads`,
or `APEX_SQUADS_DATA_DIR`); every entry point reads it before each popup.
`APEX_SETTINGS_FILE=<file>` uses another file.

In `npm start` the cards show inside the game through Overwolf's overlay, once
it has injected into Apex (the log says "Overlay: in Apex Legends"); until then,
or if it can't, they fall back to a plain always-on-top window.
`APEX_OVERLAY_ANY_GAME=1` injects into any game the overlay supports, for
testing while Apex's overlay is off. Hotkeys (Settings → Hotkeys): F9 hides the
card, F10 turns cards off and on; the log says whether they were registered in
the game or globally. See DESIGN.md §12.

```bash
npm run overlay:check   # the card window and hotkeys against a fake overlay, any OS
```
Plays a game session (Apex starts and closes, the hotkeys, Apex as
administrator) and prints PASS/FAIL per check. `APEX_CHECK_SHOTS=<folder>` also
saves the in-game card as a PNG.

The title bar's status reads Overwolf's live game events status for Apex, in
the preview too. `APEX_UI_STATUS='{"game":"recording","cards":"needs-helper"}'`
sets it instead, for screenshots (the fields are in `src/ui/game-status.ts`).

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
This mode has no overlay and no hotkeys: the popup shows over Apex only in
borderless windowed mode. During a match
the dashboard can't take focus, so it never pulls the mouse pointer over the
game.

Launching Electron from VS Code's terminal on Windows can fail with
`Cannot read properties of undefined (reading 'whenReady')`: VS Code sets
`ELECTRON_RUN_AS_NODE`. Clear it first (`Remove-Item Env:ELECTRON_RUN_AS_NODE`;
on macOS, prefix the command with `env -u ELECTRON_RUN_AS_NODE`).

## Packaging (Windows installer)
```bash
npm run dist:unsigned   # release/Apex-Squads-Setup-<version>.exe, unsigned; works on macOS too
npm run dist            # the signed release build
```
Settings are in `electron-builder.yml` (`@overwolf/ow-electron-builder`, which
packages `@overwolf/ow-electron`, not the `electron` the previews use). The
installer shows `build/license.txt` for the user to accept the Terms of Use and
Privacy Policy; `npm run dist` refuses to build while it still has [PLACEHOLDERS].

On Windows the first build can fail with "Cannot create symbolic link : A required
privilege is not held by the client": the builder's `winCodeSign` download holds
two macOS symlinks, which Windows only creates with Developer Mode on or as admin.
Either turn on Developer Mode, or extract it once without them (the errors about
the two `.dylib` files are expected):
```powershell
$cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
& .\node_modules\7zip-bin\win\x64\7za.exe x -y (Get-ChildItem "$cache\*.7z")[0].FullName "-o$cache\winCodeSign-2.6.0"
```

An unsigned build is only for checking the packaging, the installer and the
tray/start-with-Windows behaviour: Overwolf's packages (GEP, overlay) don't load in
it, so it records nothing. A release needs two signatures
(docs/overwolf/setup-and-release.md §6):
- **Overwolf's**, done by the builder: `OW_CLI_EMAIL`, `OW_CLI_API_KEY` and
  `OW_BUILD_KEY` in `.env` (from the Developer Console). `npm run dist` fails
  without them.
- **Ours on the exe**, standard electron-builder: `CSC_LINK` and
  `CSC_KEY_PASSWORD` for a certificate file, or `win.azureSignOptions` in
  `electron-builder.yml` for Azure. Or, if Overwolf enables it for the app,
  `overwolf.enableOWCertSigning: true` has Overwolf sign it with its own
  certificate (an open question for DevRel).
