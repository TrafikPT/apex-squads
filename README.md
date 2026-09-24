# Apex Tracker

A personal Apex Legends match recorder. It is phase 1 of [DESIGN.md](DESIGN.md):
a background app that saves every Overwolf game event to JSONL files. Stats are
computed separately, as DuckDB SQL views over those files (`sql/`).

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

## Development
```bash
npm test         # recorder and stats tests; runs on any OS
npm run build
npm run lint     # ESLint; style otherwise follows .editorconfig (no Prettier)
npm run ui:check # type-check the dashboard
```
CI (`.github/workflows/ci.yml`) runs all of these on every push.

## Dashboard (sample data)
```bash
npm run app:preview     # the app window, without Overwolf (works on macOS)
npm run ui:watch        # rebuild the UI on save; reload the window with Cmd/Ctrl+R
```
