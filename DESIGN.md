# Apex Tracker — Design

Status: **draft v5**: recorder built (untested against the real game). Overwolf proposal submitted 2026-09-24; Plan B (OCR) designed in §11.
Last updated: 2026-09-24

A free, local-first companion app for Apex Legends (Windows PC, Overwolf) that records
every ranked match and computes stats: kills, knocks, assists, damage, revives,
RP, broken down per match, per legend and per weapon.

---

## 1. Goals and non-goals

### Goals
- Record every match automatically while playing, with no manual input.
- Focus on **ranked Battle Royale**. Record all modes, but stats views filter
  to ranked.
- Stats per match, per legend, per weapon, and trends over time.
- **Multiple accounts** (currently 3). Every stat is available per account
  *and* rolled up across all accounts, e.g. weapon stats overall or RP
  gained this month across every account.
- **Teammate and squad analytics** (the main differentiator):
  - how many matches I've played with each teammate, and their kills and
    knocks per game when playing with me;
  - my placement, kills and damage when I play with one specific friend, or
    with a specific pair of friends (a full premade squad).
- **Filters that combine freely** on every view: time period (last 7/30
  days, season, custom range), legend, teammate(s), account, map, mode. For
  example: "last 30 days, as Bangalore, with friend X".
- Keep raw data forever, so stats can be recomputed when definitions improve.
  New stats added later apply to past matches too.
- **Public, free Overwolf app** (decided 2026-09-24): built for my own needs
  first, then shared with friends and the community. Overwolf only approves
  public apps with at least one window.

### Non-goals (for now)
- Console support. Overwolf is Windows PC only.
- Information about the rest of the lobby: opponents' names, ranks or kills
  (TRN's overlay shows this). This keeps us clear of game-policy questions
  about competitive advantage.
- Any UI in the PoC: SQL queries are the interface. The overlay and
  dashboard are phase 3.
- Anything that reads game memory or network traffic. Easy Anti-Cheat bans
  for that. Only Overwolf's sanctioned Game Events Provider (GEP) is used.

---

## 2. Data sources

### 2.1 Overwolf Game Events Provider (GEP)
Real-time events and info updates from the game, sanctioned by EA/Respawn.
Docs: https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/apex-legends/

Features that matter to us:

| Feature | Type | Content |
|---|---|---|
| `match_info` | info | `pseudo_match_id`, `game_mode`, `map_name`, `mode_name`, `tabs` (kills, assists, damage, teams, players) |
| `game_info` | info | `phase`: lobby, loading_screen, legend_selection, aircraft, freefly, landed, match_summary |
| `me` | info | `name` of the local player |
| `team` | info | `legendSelect_X` (legend picked, `is_local` flag), `teammate_X` state (alive/knocked_out/death) |
| `roster` | info | Every player in the lobby: name, team, platform, platform/origin ID, local flag |
| `inventory` | info | `weapons` (weapon0/weapon1), **`inUse`** (e.g. `{"inUse":"R-99"}`) |
| `damage` | event | `targetName`, `damageAmount`, `armor`, `headshot`, `grenade` — **no weapon field** |
| `kill` / `knockdown` / `assist` | event | Running totals |
| `kill_feed` | event | `attackerName`, `victimName`, **`weaponName`**, `action` (kill, headshot_kill, knockdown, Bleed_out, Finisher, Melee, abilities). Needs **Obituaries enabled** in game settings. |
| `revive` | event | `healed_from_ko` (you were revived), `respawn` (you were respawned at a beacon) |
| `death` | event | `knocked_out`, `death` |
| `match_summary` | info | Final squad placement, total teams, squad kills |
| `rank` | info | `victory` true/false |
| `player_stats` | info | `player_stats_br_ranked_latest`: season totals incl. **`teammates_revived`**, `teammates_respawned`, kills, damage, games, wins |
| `location` | info | x, y, z (1 m resolution) |
| `ring` | info | Current and next ring center and radius |

Known quirks (from Overwolf docs):
- Overwolf damage **includes armor damage**. The in-game number counts only
  health damage, so our number will be higher.
- Special characters in names show as `□` during a match (fine in the lobby).
- A self-revive with a gold knockdown shield may trigger `match_end` without
  a death.

### 2.2 apexlegendsstatus.com API (for RP)
GEP has **no RP, rank tier or division**. We take before/after snapshots from
this API instead.
- `GET https://api.apexlegendsstatus.com/bridge?player=<name>&platform=PC`,
  with header `Authorization: <key>` (free key; 5 req/s by default).
- Expected fields: `global.rank.rankScore`, `rankName`, `rankDiv`. **Not
  verified yet**: confirm with a real call.
- The key comes from the developer portal linked on https://apexlegendsapi.com/.
  It's free, one per project and person, and the API is unofficial with no
  uptime guarantee.
- Risk: their data may lag behind the game. After each match the recorder
  takes snapshots on a fixed schedule (0–300 s, see §6), and the views pick
  the first one that changed.

---

## 3. Architecture

```
┌──────────── Windows PC ─────────────────────────────────────────┐
│                                                                  │
│  Apex Legends ──► Overwolf GEP ──► Recorder (ow-electron, TS)    │
│                                        │                         │
│  apexlegendsstatus API ◄── RP snapshot ┤  (lobby: before / after)│
│                                        ▼                         │
│                     recordings/<session>.jsonl  (landing zone)   │
└──────────────────────────────────────┬───────────────────────────┘
                                       │ copy
┌──────────── Mac (development) ───────▼──────────────────────────┐
│  DuckDB views over the JSONL: bronze → silver → gold · tests     │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 Components

**Recorder.** A small background program on the Windows PC. In the PoC it
runs in a terminal (`npm start`); a tray icon and autostart come later. In
data-engineering terms it is the **ingestion job**: it subscribes to
Overwolf's game events and lands each one, untransformed, as a line in an
append-only JSONL file (one file per session). It computes no stats. Its only
other jobs:
- tagging each line with the current `pseudo_match_id`;
- taking RP snapshots from the API when you're in the lobby (it follows
  `me.name`, so it always looks up the account currently logged in);
- logging its own health (errors, GEP status) as `lifecycle` lines.

Size: my rough guess is a few thousand events per match, on the order of
1 MB per match. Recording every mode is cheap.

**Stats layer.** DuckDB views that read the JSONL files directly (bronze →
silver → gold). No database file to maintain and no loader job: queries always
see every file in `recordings/`.

**UI (phase 3).** Dashboard and overlay reading the gold views.

### 3.2 Principles
1. **The recorder is simple.** It writes every GEP event and info update as
   it arrives, tagged with `pseudo_match_id`. It has no stat logic, so it
   rarely needs changes or redeploys to Windows.
2. **All stat logic lives in SQL views** over the raw lines (bronze →
   silver → gold). If we fix a definition, all history is recomputed
   automatically.
3. **Replay = the recordings themselves.** Recorded matches are the test
   fixtures, and the views can be developed and tested on the Mac with no
   game running.
4. **Record everything, filter late.** All modes are recorded, and the
   ranked filter lives in the views.
5. **Silver is source-agnostic.** Each capture source (Overwolf GEP, screen
   OCR) has an adapter that maps its bronze lines to the same canonical
   silver tables. Gold, the dashboard and history never depend on the source,
   so switching or combining sources throws nothing away (see §11.7).

### 3.3 Tech stack
| Concern | Choice | Why |
|---|---|---|
| App runtime | **ow-electron** 42.x (`@overwolf/ow-electron`) | GEP is a JS API. ow-electron supports Apex GEP (game ID 21566) and the overlay (for phase 3). |
| Language | TypeScript | Type safety on event payloads |
| Storage | **JSONL files**, one per session | No native modules in the Electron app (these are a common Windows build problem). A crash loses at most the line being written. Easy to copy. |
| Stats | **DuckDB** views reading the JSONL | `read_json` over a glob, JSON operators, and **`ASOF JOIN`**, which is exactly "damage → weapon in use at that moment". |
| RP | apexlegendsstatus API via `fetch` | The only RP source that doesn't read the screen |
| Code transfer | Private GitHub repo | Mac for development ↔ Windows for running |

_Changed in v4:_ SQLite (via `better-sqlite3`) was replaced by JSONL + DuckDB,
for the reasons above.

---

## 4. Data model

### 4.1 Bronze: the landing-file contract

Each session is one file, `recordings/<session_id>.jsonl`, with one JSON
object per line (implemented in `src/recorder.ts`, read by `sql/bronze.sql`
as the view `bronze_lines`):

| Field | Type | Meaning |
|---|---|---|
| `schema` | int | Line format version (currently 1) |
| `session_id` | string | One per recorder launch: start time + random suffix |
| `seq` | int | Order within the session. Timestamps can tie, and ordering matters for weapon attribution. |
| `received_at` | ISO-8601 UTC | When the recorder received it (ms precision) |
| `kind` | string | `event` · `info` · `info_snapshot` (full `getInfo()` state) · `rp_snapshot` · `lifecycle` |
| `match_id` | string / null | `pseudo_match_id` in effect, null in the lobby |
| `feature`, `category`, `key` | string / null | GEP routing fields, as received |
| `value` | any | Payload **exactly as received**. The view adds a decoded `payload` column, because GEP often sends JSON as a string. |

What each `kind` carries:
- `event` / `info`: GEP messages, untouched.
- `info_snapshot`: the full game state from `getInfo()`, taken when features
  are registered and at every phase change. Lets views recover values that
  were set before the recorder started.
- `rp_snapshot`: `key` = trigger (`lobby`, `match_start`, `post_match`,
  `account_change`); `value` = `{player_name, status, body}` (the full API
  response) or `{player_name, error}`.
- `lifecycle`: session start/end, package ready or failed, game detected or
  exited, features registered, GEP errors. This is the recorder's health log.

The lines have no account column on purpose. They stay what GEP sent, and
the account is derived per match in silver (from the `me` and `roster` lines
inside the match). RP snapshots carry `player_name`, the name the API was
queried with.

### 4.2 Accounts

The account list is derived, not maintained: a view over the `roster` lines
with the local flag set.

```
d_account      (account_key, current_name, first_seen_at, last_seen_at)  -- view
account_names  (account_key, name, first_seen_at, last_seen_at)          -- view, name history
accounts.csv   (account_key, alias)                                      -- optional, your labels
```

- A new account appears automatically the first time you play on it, so
  there is no setup per account. `accounts.csv` only adds labels like
  "main" or "smurf".
- Keyed on the platform ID, not the name: names can change and can show
  as `□` mid-match.
- RP snapshots are matched to an account through `player_name` → name
  history. Switching accounts in the lobby triggers an `account_change`
  snapshot for the new account.

### 4.3 Silver (views: typed, one row per game fact)
- `s_matches`: one row per match_id, with **account_key**, start/end, mode,
  map, `is_ranked`, legend, placement, total teams, victory.
- `s_damage_hits`: each damage event plus the **attributed weapon** (§5).
- `s_kill_feed_squad`: kill feed rows where the attacker or victim is me or
  a teammate.
- `s_match_players`: one row per squad member per match (me + teammates):
  player_key (stable roster ID), name, legend, is_me.
- `s_my_events`: kills, knocks, assists, deaths, revives received, respawns.
- `s_weapon_timeline`: `inUse` changes with valid-from/valid-to times.
- `s_player_stats_snapshots`: parsed `player_stats_br_ranked_latest`
  updates.

### 4.4 Gold (views: a small star schema)
Designed so that any breakdown is just a `GROUP BY`, including across
accounts (leave `account_key` out of the grouping).

Facts (one row per thing that happened):
- `f_match`: account_key, match_id, date, season, mode, is_ranked, map,
  legend, placement, kills, knocks, assists, damage, headshot hits, hits,
  revives given/received, RP delta.
  Plus **`squad_key`**: the sorted list of teammate player_keys, so "with
  exactly X and Y" is a simple equality filter.
- `f_weapon_match`: account_key, match_id, date, legend, weapon: kills,
  knocks, damage, headshot hits, hits. (One row per weapon used per match.)
- `f_match_teammate`: a bridge table with one row per teammate per match:
  match_id, teammate player_key, their legend, their kills and knocks (from
  the kill feed). It answers "with friend X" (join on one teammate) and
  "how many games with X / their kills per game with me".

Dimensions:
- `d_account` (alias, current name), `d_date` (day, week, month, season).
- `d_player`: everyone I've been teamed with (player_key, current name, name
  history, optional friend alias / favourite flag). My own accounts are
  players too.

**Filtering.** Every dashboard view is a query over the facts with the same
filter set: date range, legend, account, map, mode, teammates. Teammate
filters come in two forms: "includes friend X" (semi-join on
`f_match_teammate`) and "exactly this squad" (`squad_key`). DuckDB computes
these on demand. At the volumes a single player generates (thousands of
matches), nothing needs to be pre-aggregated.

Convenience views for everyday questions, all built on the facts:
- `g_legend_stats`, `g_weapon_stats`, `g_daily`, each with an
  `account_key` column where `'ALL'` = all accounts combined.

Example: RP gained this month across all accounts:
```sql
SELECT SUM(rp_delta) FROM f_match
WHERE is_ranked AND date >= date_trunc('month', current_date);
```

---

## 5. Stat definitions

| Stat | Source | Rule | Confidence |
|---|---|---|---|
| Kills / knocks / assists | Events + final `tabs` | Pick whichever matches the in-game summary (spike Q2) | High |
| Damage | `damage` events | Sum of `damageAmount`, armor included | High (different definition from the game) |
| Headshot % | `damage.headshot` | Headshot hits / all hits | High |
| Legend | `legendSelect_X` where the local flag is true | — | High |
| Placement / win | `match_summary`, `rank.victory` | — | High |
| Kills/knocks per weapon | `kill_feed`, attacker = me | `weaponName` as given | High (needs Obituaries on) |
| **Damage per weapon** | `damage` + `s_weapon_timeline` | Weapon = latest `inUse` before the hit (DuckDB `ASOF JOIN` on `seq`). `grenade=true` → "Grenade". An `inUse` that isn't a weapon → "Other". | **Medium**, an estimate |
| **Loadout** | per-weapon damage per match | The match's two highest-damage guns (grenades/abilities ignored), shown in class order. Simple on purpose: mid-match swaps count toward whichever two guns were used most. Later option: the two guns held longest, from `inventory.weapons` + `inUse`. | Medium |
| Revives received | `revive.healed_from_ko` | Count | High |
| Respawned | `revive.respawn` | Count | High |
| **Revives given** | `player_stats_br_ranked_latest.teammates_revived` | Difference between the last snapshot before the match and the first one after it | Depends on refresh timing (spike Q7) |
| **RP delta** | `rp_snapshot` lines | First changed `rankScore` after the match − last value before it (same account). If RP only changed after several matches, the change is assigned to that group of matches. | Medium (API lag; back-to-back matches) |
| Is ranked | `match_info.game_mode` | Value TBD (spike Q1) | — |
| Teammates in a match | `team.teammate_X` + `roster` (teammate flag, platform ID) | Stable `player_key` from the roster ID, not the name | High (spike Q10) |
| Teammate legend | `team.legendSelect_X` | — | High |
| **Teammate kills / knocks** | `kill_feed`, attacker = teammate | Count | High, if the kill feed covers the whole lobby (spike Q10) |
| Teammate damage | — | **Not available**: GEP damage events are only the local player's | — |
| Stats "with friend X" | `f_match` ⋈ `f_match_teammate` | Averages of my stats over matches that include X | High |

"Me" (and therefore the account) is identified by the `roster` entry with
the local flag, using its platform/origin ID (§4.2). `me.name` is the
fallback. Revives-given and RP deltas are only computed between snapshots
**of the same account**.

---

## 6. Match lifecycle

```
lobby ──► loading_screen ──► legend_selection ──► aircraft ──► freefly ──► landed
  ▲                                                                           │
  └──────────────── match_summary ◄───── (knocked ⇄ alive, death, respawn) ◄──┘
```

The recorder uses phases only for these side effects (implemented and tested
in `src/recorder.ts`):
- Entering **`lobby` after a match** → RP snapshots at 0, 30, 90, 180 and
  300 s, so the API has time to catch up (`post_match`).
- Entering **`lobby` otherwise** (app start), or `me.name` appearing or
  changing in the lobby → one snapshot (`lobby` / `account_change`).
- **Leaving the lobby** (queued into a match) → cancel pending post-match
  snapshots and take one final `match_start` snapshot, the "before" value.
- Every phase change → an `info_snapshot` of the full game state.
- Entering `lobby` also clears the current match id.

Match grouping itself comes from `pseudo_match_id`, not from our own state
machine.

Edge cases to handle in views (not in the recorder):
- Quitting before the match ends (no `match_summary`).
- App started mid-match (partial match, marked incomplete).
- Disconnect and reconnect (two sessions, same match_id?).
- Game or app crash (no end phase).

---

## 7. Recorder spike: questions to answer

Build the minimal recorder, play about 10 **ranked** matches (plus 1–2 pubs
for comparison), and answer:

1. What `game_mode` / `mode_name` value identifies ranked?
2. Do event counts and final `tabs` match the in-game summary for kills,
   assists and damage?
3. How often does `inUse` update? Does it reliably come before damage after
   a weapon swap? What does it show for grenades, heals and abilities?
4. What does a revive look like in the stream, both given and received?
5. What happens on disconnect, early quit, and respawn?
6. Do names with special characters break "is this me?" matching?
7. When does `player_stats_br_ranked_latest` refresh: in the lobby after
   each match, or only at app start?
8. How long until apexlegendsstatus `rankScore` reflects a finished match?
9. Which `roster` ID is stable per account? Does it work as the
   apexlegendsstatus `uid`? Does `me` / `roster` fire in the lobby, so we
   know the account before the match starts? (Play at least one match on a
   second account.)
10. Teammates: does `roster` give each teammate a stable ID, and is it
    present for randoms as well as friends? Does the kill feed include
    every kill in the lobby, so teammates' kills are countable?

Answers go into §9 of this document.

---

## 8. Phases and estimate

| Phase | Scope | Estimate |
|---|---|---|
| 0. Setup | Overwolf app proposal (https://dev.overwolf.com/app-idea-form/) and approval → Dev Console API key. apexlegendsstatus API key. Windows: Node 22.12+, Git. | 1 evening + **waiting for Overwolf approval** |
| 1. Recorder spike | ~~Build the recorder~~ (done: `src/`, 10 tests passing, untested against the real game). Run it on Windows and play ~10 ranked matches. | Play time |
| 2. PoC stats | Silver/gold views, validated against in-game summaries | 1–2 weekends |
| 3. UI | Dashboard window + in-game overlay. **Dashboard done on sample data (2026-09-24):** Overview, Squads, Matches (expandable details), Legends, Weapons, sharing one filter bar; `npm run app:preview`. Still to do: Settings, overlay, real data source. | 2–3 weekends |

Workflow: code on the Mac → push to a private GitHub repo → pull on Windows
to run. Recorded JSONL files come back to the Mac (copied into `recordings/`,
which git ignores) for stats development.

---

## 9. Spike findings

_Empty until phase 1 runs._

---

## 10. Open decisions / risks

- **Overwolf approval: the biggest risk.** GEP only runs in Dev Mode with
  Dev Console credentials (`OW_CLI_EMAIL` + `OW_CLI_API_KEY`, or
  `OW_DEV_KEY`), and Dev Console access requires an approved app proposal and
  a whitelisted account. Overwolf confirmed it **doesn't approve private
  apps**, and apps need at least one window. We are therefore submitting it
  as a public app (§1), named **Apex Squads**, framework ow-electron.
  Submitted 2026-09-24. If it is declined: **Plan B, screen capture + OCR
  (§11)**. Respawn's Live API was ruled out: almost certainly custom lobbies
  only.
- **Game updates** can break GEP features for days. Overwolf publishes
  feature status. `lifecycle` lines help spot silent features.
- **apexlegendsstatus**: response shape not yet verified (§2.2). The key is
  one per project/person. Their terms require the credit "Data provided by
  Apex Legends Status" if we show their leaderboard data (not needed for a
  personal DB).
- **Transferring recordings**: copied manually for now. Committing them to
  the private repo is possible later if copying gets tedious.
- **Recorder autostart and tray icon**: deferred; the PoC runs in a terminal.
- **Overlay tech** (phase 3): not designed yet.
- **Legend portraits** (resolved 2026-09-24): EA's content policy lets fans
  use original characters in free, personal projects, provided assets aren't
  data-mined, nothing implies EA endorsement, and EA logos aren't merged
  with our branding. `scripts/fetch-legend-portraits.mjs` downloads the
  official "grid tile" portraits from ea.com's characters pages (28 legends)
  and crops them to 128 px; rerun it when new legends release. The app shows
  "Not endorsed by or affiliated with EA or its licensors" in the sidebar.
  **Now shipping the game's portraits (2026-09-24):** Overwolf confirmed on
  Discord that the app may use the game's square legend portraits (3D face
  renders, from the community wiki as "Portrait <Legend> square"). Keep a
  screenshot of that message with the project in case EA or a store reviewer
  asks. `scripts/fetch-legend-portraits.mjs` fetches them, falling back to the
  EA-website art for legends the wiki doesn't have yet.
  **Open point:** the policy also says not to incorporate EA trademarks into
  our own branding. "Apex" in "Apex Squads" may be close to that line, so
  reconsider the name before a public release.

---

## 11. Plan B: screen capture + OCR (if Overwolf declines)

Only the **capture layer** changes. The recorder writes the same JSONL
landing contract (§4.1) with new `kind`s, and the DuckDB silver/gold views
and the dashboard stay the same.

### 11.1 What is on screen

| Source | When | Gives us |
|---|---|---|
| **HUD counters**: kills, assists, kill participation, **damage** | Live, whole match | Running totals, so per-weapon attribution works (§11.3) |
| **Equipped weapon name** (HUD, bottom-right) | Live | Weapon in use, like GEP's `inUse` |
| **Kill feed** | Live, each entry a few seconds | Kills and knocks per weapon (the weapon is an **icon**: template matching, not OCR), teammates' kills |
| **Squad summary screen** | End of match | Per player (me + teammates): kills, damage, revives, respawns, survival time; placement. Official totals, and **teammate damage**, which GEP didn't have. |
| **Ranked summary screen** | End of ranked match | RP gained, with the breakdown (placement, kills, entry cost) |
| Legend select / lobby | Before match | Legends, account name, match boundaries |

### 11.2 Capture rates

| What | Rate | Area |
|---|---|---|
| Screen-state detection (lobby / legend select / in match / summary) | ~1 fps | Tiny downscaled frame, image comparison (no OCR) |
| HUD counters + weapon name | ~2 fps | A few small crops |
| Kill feed | ~2 fps | One crop; entries stay long enough to catch each one |
| Summary screens | 2–3 full screenshots per match | Full frame, also **saved as PNG** |

Capture uses Windows Graphics Capture (the method OBS and Discord use). It is
read-only with no injection into the game, so it is anti-cheat-safe. At these
rates it has no noticeable effect on frame rate.

### 11.3 Damage per weapon
For each change in the HUD damage counter, the difference goes to the weapon
shown in the HUD at that moment. Grenade, ability and ultimate damage gets
misassigned (user estimate: ~90% accurate). Each match is **reconciled against
the official total** from the squad summary screen, and any gap is shown as
"unattributed". The accuracy is visible for every match rather than assumed.

### 11.4 Reading techniques
- **Digits** (counters, summary numbers): template matching against the HUD
  font's 0–9, calibrated once per resolution. It's faster and more reliable
  than general OCR.
- **Text with a known vocabulary** (weapon names, legends): OCR plus fuzzy
  match to the known list, so a misread letter still resolves.
- **Free text** (player names): OCR, then a **vision model** reads the 2–3
  summary screenshots per match. That's fractions of a cent per match, and
  more robust on a busy layout.
- The saved summary PNGs are the raw data here. As with the "keep raw data"
  principle, better readers can re-process old matches later.

### 11.5 New constraints compared with GEP
- **Screen layout dependency**: resolution, HUD scale, colour-blind mode and
  game language all affect crops and templates. We need a calibration step on
  first run, and English only at first.
- **Identity by name only**: no platform IDs, so a friend's name change
  splits their history. Fix: a manual "merge players" action.
- **Overlay**: a transparent always-on-top window instead of Overwolf's
  overlay. It only works in borderless-windowed mode.
- **Maintenance**: HUD redesigns in new seasons can break crops or
  templates.
- **Effort**: roughly +2–3 weekends compared with the GEP route, mostly
  calibration and robustness.

### 11.6 Needed to design it
Reference screenshots at your resolution and HUD settings:
1. In-match HUD with a few kills and damage on the counters, holding a weapon.
2. Kill feed with several entries, including one of your kills.
3. Squad summary screen at the end of a match.
4. Ranked summary / RP screen.
5. Lobby and legend select.
Plus your resolution, HUD scale and display mode.

### 11.7 Build order if we start before Overwolf answers
1. **Now:** summary-screen OCR + canonical silver + gold + first dashboard.
   All of it survives either way, and summary-screen OCR stays useful next to
   GEP (teammate damage, official RP breakdown).
2. **Wait** for Overwolf before building live HUD OCR, the only part a GEP
   approval would throw away.
3. **Approved:** add the GEP adapter and keep summary OCR (hybrid).
   **Declined:** build live HUD OCR (§11.2–11.4).

Rough reuse if Overwolf approves later: ~70%. OCR-period players are keyed by
name and GEP players by platform ID; they are linked with "merge players".
