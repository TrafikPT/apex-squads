# Overwolf GEP and Game Compliance (ow-electron)

Distilled from dev.overwolf.com/ow-electron on 2026-09-28. Check the source URL before relying on anything time-sensitive.

Scope: the Game Events Provider (GEP) pages, the full Apex Legends GEP reference, and the game-compliance guides. Several pages load tables through a script ("Loading..." in the downloaded text); where that happened, the table's content is not in this file and is marked as missing.

---

## 1. GEP: what it is

- The Overwolf Game Events Provider (GEP) is part of the Overwolf API and provides apps with Live Game Data for supported games.
- Game data is of two kinds:
  - **Game events** (also known as Live Game events).
  - **Game Info** (also known as Game info events), delivered as **info updates**.
- **ow-electron support is rolled out per game.** "GEP for Overwolf Electron is currently being rolled out on a per game basis." Contact Overwolf (https://dev.overwolf.com/ow-electron/support/contact-us) for a game not in the supported list.

### PROD and DEV environments (marked "important" on the page)

- Not all games are available in the PROD environment. The list of games in PROD and DEV is on a Trello card: https://trello.com/c/nqq4eYPg/536-electron-games-support
- All supported games that are not in PROD are in the DEV environment "and are updated regularly".
- Connect your app to the DEV environment with the command line argument:
  `--owepm-packages-url=https://electronapi-qa.overwolf.com/v2/packages`
- You must tell your DevRel once when you are ready to go live, so the game can be moved to PROD.
- After the game has been moved to PROD, remove that command line argument from your app.

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro (the page https://dev.overwolf.com/ow-electron/reference/game-events has identical content)

---

## 2. Game events vs info updates

### Game events

- Real-time events that occur during gameplay. When a specific change of state occurs, an event is triggered containing data about that event.
- **Game events are not stored.** You need a listener configured to catch them.
- Each supported game has its own list of supported events.

Example game event from the docs (generic, not Apex):

```
{
  "name": "player_killed",
  "data": {
    "username": "TestUser"
  }
}
```

### Game info updates

- Describe **persistent** game data that updates during gameplay. Sent in real time and **stored in a dictionary which can be queried at any time** (via `getInfo`).
- An info update is triggered whenever the data of a relevant Game Info item **changes**.
- Game info includes data such as `player` data, `match` data, and more; each game has its own list.

### Resetting info fields (why you see `null`)

Info updates fire only when a value changes, so a value can be stale and unreliable for detecting game state. The docs' example:

1. `score` is set to `0` at the start of every match.
2. If the player ends a match still at `0`, the reset to `0` at the next match would not fire an update.
3. So GEP sets the field to "an illegal, consistent, meaningless value" at the end, e.g. `"score": null`.
4. When the next match starts, `null` -> `0` fires an info update.

Consequence: expect info fields to be cleared (commonly to `null`) between matches, and treat that as a reset, not as data.

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro

---

## 3. Working with GEP in ow-electron

### Game Features

- Many events and info items relate to the same general functionality, grouped as a **Feature** (for example the feature `match` could hold match settings, match score, match start/end events, etc.).
- The GEP API often uses feature names instead of individual event/info names, e.g. when setting required features.
- You can use items individually or as a feature. "Use the individual Game events/info when there may be situations where you don't want to have dependencies between events."

### setRequiredFeatures

- **By default GEP does not listen for any changes in the game.** You must subscribe to features for them to be triggered.
- Benefits of registering: direct feedback on expected data (some features may become temporarily unavailable); only required features get triggered; **GEP will not run in games where no app is using it**.
- Note on the page: "You must set the required Game Features for your app before GEP beings to work. Ideally this should be as soon as the game launches."
- **"Run order matters!"**: in some games, the longer it takes between starting the game and registering GEP, the greater the chance of data issues (missing events, unreliable data, etc.). "This is especially critical if the App was started in the middle of a game session. It is recommended that you show a relevant indication to your users in those cases."

Snippet exactly as on the intro page:

```
app.overwolf.packages.gep.setRequiredFeatures(features);
```

(The intro snippet shows one argument. The API reference page gives the signature `setRequiredFeatures(gameId: number, features: string[] | undefined): Promise<void>;` — see "Contradictions and gaps".)

### Listening and querying

```
app.overwolf.packages.gep.on('new-game-event', (e, gameId, ...args) => {
  // your code here
});
```

```
app.overwolf.packages.gep.getInfo(gameId);
```

```
app.overwolf.packages.gep.on('new-info-update', (e, gameId, ...args) => {
  // your code here
});
```

### Game detection and elevated privileges

The GEP intro and the other pages covered here **do not describe** game detection or elevated privileges. They are documented only on the API reference page (covered by another file of this knowledge base). For orientation, that page states:

- `on("game-detected", (event: GepGameLaunchEvent, gameId: number, name: string, ...args) => void)`: "Register listener for a game being detected. Calling `event.enable()` to start gep for this game."
- `on("elevated-privileges-required", (event: Event, gameId: number, name: string, pid: number) => void)`: "Register listener for when a detected game is ran as administrator. If this fires, it means the app must also run as administrator in order for Game Events to be detected."

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro ; https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/gep/interfaces/OverwolfGameEventPackage

---

## 4. Supported environment (games list)

- The page lists games supported in the development (`dev`) and production (`prod`) environments, in three tabs: "Production", "Dev Env.", "In progress".
- All games in `dev` "are ready to be transferred to `prod` on request". Tell your DevRel if you want to test with any listed game.
- Contact your DevRel if the game you want is in neither environment.
- **The tables themselves did not load in the downloaded copy.** Whether Apex Legends (21566) is in `prod` or `dev` for ow-electron is not recorded here. Check the page or the Trello card in section 1.

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-environment

---

## 5. Event status and health

### Why features go down

Events may become unavailable because of:
- a recent game update causing issues;
- **a request by the relevant game studio to disable this event**;
- discrepancies/issues found with the event's data or reliability.

Overwolf supplies public "Event Status Endpoints" giving the current uptime status of individual features per game. Suggested uses: toggle specific app functionality, toggle less reliable fallback logic, show users an indication of potential issues. "It is highly recommended to communicate errors and warnings to your app users."

### Health levels

| Status code | Description |
|---|---|
| 0 | unsupported |
| 1 | green (Good to go) |
| 2 | yellow (Partial functionality, some game events may be unavailable) |
| 3 | red (Game events are unavailable) |

Individual event health states use the same green/yellow/red scheme. States update automatically; there may be a delay of about 10 minutes ("10~ min") between server state and the real-time status.

### All games

```
https://game-events-status.overwolf.com/gamestatus_prod.json
```

Example response:

```
[
    {"game_id":10878,"state":0},
    {"game_id":7764,"state":1},
    {"game_id":7314,"state":1},
    {"game_id":21216,"state":1},
    {"game_id":10844,"state":3,"maintenance_msg":"Events are disabled","disabled":true},
    {"game_id":10906,"state":1},
    {"game_id":10798,"state":1},
    {"game_id":6365,"state":1}
]
```

Note the optional `maintenance_msg` and `disabled` fields. The page says: if the general status is Yellow or Red, query the specific game.

### One game

```
https://game-events-status.overwolf.com/[your Game ID]_prod.json
```

For Apex Legends this is `https://game-events-status.overwolf.com/21566_prod.json` (the docs' own example uses LoL, `5426_prod.json`).

Example response, verbatim from the docs (it is not valid JSON as printed: the brackets around `assist` and `teams` are unbalanced):

```
{
    "game_id": 5426,
    "state": 1,
    "features": [{
            "name": "abilities",
            "state": 1,
            "keys": [{
                "name": "ability",
                "type": 0,
                "state": 1
            }, {
                "name": "usedAbility",
                "type": 0,
                "state": 1
            }]
        }
    },
    {
        "name": "assist",
        "state": 1,
        "keys": [{
            "name": "assist",
            "type": 0,
            "state": 1
        }]
    }
    "name": "teams",
    "state": 1,
    "keys": [{
        "name": "teams",
        "type": 1,
        "state": 1,
        "category": "game_info"
    }]
}
```

Shape to expect: `{ game_id, state, features: [ { name, state, keys: [ { name, type, state, category? } ] } ] }`. From the example, `type` 0 goes with events and `type` 1 with an info key (the one with `"category": "game_info"`); the docs don't define `type` explicitly.

### Status health page

The "Game events status health" page says "Pick any game to see its full events list", recommends communicating errors and warnings to users, and points to the all-games endpoint above. The per-game status widget did not load in the downloaded copy.

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/verifying-events-for-your-app ; https://dev.overwolf.com/ow-electron/live-game-data-gep/game-events-status-health ; https://dev.overwolf.com/ow-electron/live-game-data-gep/live-game-data-gep-intro

---

## 6. External stats APIs listed by Overwolf

The page "Various external API's for games stats" lists third-party APIs. **Apex Legends is not listed** (nor is apexlegendsstatus.com). The full list:

| Game | API(s) |
|---|---|
| Battlefield | Battlefield 1 and Battlefield 4 statistics: https://github.com/MattMcFarland/battlefield-stats |
| Diablo 3 | Diablo 3 Community API: https://dev.battle.net/ |
| EVE Online | EVE Marketer: https://api.evemarketer.com/ec/ ; zKillboard: https://zkillboard.com/ |
| Guild Wars 2 | http://wiki.guildwars2.com/wiki/API:Main (additional: https://en-forum.guildwars2.com/forum/28-api-development/) ; GW2 Spidy: https://github.com/rubensayshi/gw2spidy |
| Magic: The Gathering | http://mtgapi.com/docs |
| PUBG | https://developer.pubg.com/ |
| Minecraft | Minecraft ID List: http://minecraft-ids.grahamedgecombe.com/api (additional: http://minecraft-ids.grahamedgecombe.com/) |
| Path of Exile | http://www.pathofexile.com/developer/docs |
| Planetside 2 | http://wiki.planetside-universe.com/ps/API |
| Starcraft 2 | Community API: https://develop.battle.net ; Client API: https://github.com/Blizzard/s2client-api |
| Star Wars: The Old Republic | SWTOR Fan API: http://www.swtor.com/community/showthread.php?s=81944b091aa9679fa677a0d706324af1&p=7456215#post7456215 |
| Team Fortress 2 | TF2 Backpack: https://backpack.tf/developer |
| World of Warcraft | WoW Community API: https://develop.battle.net/ |
| World of Warplanes | Wargaming.net API: https://developers.wargaming.net/reference/ |

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/various-external-api-for-games-stats

---

## 7. Apex Legends GEP reference (game id 21566)

General:
- The page tells you to read the GEP intro page for usage.
- Sample app: "APEX game events sample app": https://github.com/overwolf/events-sample-app
- "It is highly recommended to communicate errors and warnings to app users." Status: the status health page or the status API (section 5).
- The page does **not** say anything about compliance rules, EA or Respawn sanction, or restrictions on using the data.

### Payload envelope

All examples use this shape. `value` is almost always a **string**, and for object values it is a **JSON-encoded string** that needs a second `JSON.parse`:

- Info update: `{"gameId":21566,"feature":"<feature>","category":"<category>","key":"<key>","value":"<string or JSON string>"}`
- Event: `{"gameId":21566,"feature":"<feature>","key":"<event name>","value":<null | number | JSON string>}` (no `category`)
- Exception: `gep_internal` uses `{"info":{"gep_internal":{...}},"feature":"gep_internal"}`.

Note the difference from the generic intro example (`{"name": ..., "data": ...}`): the Apex page's examples use `key`/`value`.

Numbers inside the nested JSON are often strings (`"damageAmount":"15.000000"`, `"rank":"12"`, `"x":"93"`), but not always (`tabs`, `player_stats_*`, `team_id`, and the `kill`/`assist` event values are numbers).

### Available features (as listed, in this order)

`gep_internal`, `me`, `localization`, `team`, `kill`, `damage`, `death`, `revive`, `match_state`, `game_info`, `match_info`, `inventory`, `location`, `match_summary`, `roster`, `rank`, `kill_feed`, `player_stats`, `ring`

**`localization` is listed but has no section on the page**: no keys, events or examples are documented for it.

### Summary of all keys

| Feature | Kind | Key / event | Category | Since GEP ver. |
|---|---|---|---|---|
| gep_internal | info | `gep_internal` | gep_internal | 143.0 |
| me | info | `name` | game_info | 128.0 |
| me | info | `ultimate_cooldown` | me | 128.0 |
| game_info | info | `player` | game_info | 221.1.0 |
| game_info | info | `phase` | game_info | 215.0 |
| match_info | info | `pseudo_match_id` | match_info | 130.0 |
| match_info | info | `game_mode` | match_info | 158.0 |
| match_info | info | `tabs` | match_info | 158.0 |
| match_info | info | `map_id` | match_info | 215.0 |
| match_info | info | `arena_score` | match_info | 215.0 |
| match_info | info | `mode_name` | match_info | 241.0 |
| match_info | info | `map_name` | match_info | 241.0 |
| match_state | info | `match_state` | game_info | 128.0 |
| match_state | event | `match_start`, `match_end` | - | 128.0 |
| match_state | event | `round_start`, `round_end` | - | 215.0 |
| team | info | `teammate_X` | match_info | 128.0 |
| team | info | `legendSelect_X` | match_info | 128.0 |
| team | info | `team_info` | match_info | 128.0 |
| roster | info | `roster_XX` | match_info | 128.0 |
| location | info | `location` | match_info | 130.0 |
| rank | info | `victory` | match_info | 128.0 |
| match_summary | info | `match_summary` | match_info | 130.0 |
| damage | info | `totalDamageDealt` | me | 130.0 |
| damage | info | `team_damage_dealt` (example only, not in the table) | damage | not given |
| damage | event | `damage` | - | 130.0 |
| inventory | info | `inventory_XX` | me | 130.0 |
| inventory | info | `weapons` | me | "0.130" (as printed) |
| inventory | info | `inUse` | me | "0.130" (as printed) |
| kill | event | `kill`, `knockdown`, `assist` | - | 130.0 |
| revive | event | `healed_from_ko`, `respawn` | - | 128.0 |
| death | event | `knocked_out`, `death` | - | 128.0 |
| kill_feed | event | `kill_feed` | - | 130.0 |
| player_stats | info | `player_stats_career`, `player_stats_br_ranked_latest`, `player_stats_br_ranked_history`, `player_stats_br_unranked_latest`, `player_stats_br_unranked_history` | player_stats | 312.0 |
| ring | info | `next_ring`, `active_ring` | ring | 312.0 |

Note that the feature name and the category often differ (e.g. `me.name` has category `game_info`; `match_state.match_state` has category `game_info`; `damage.totalDamageDealt` has category `me`).

### gep_internal

| key | Category | Values | Since |
|---|---|---|---|
| gep_internal | gep_internal | Local + Public version number | 143.0 |

```
{"info":{"gep_internal":{"version_info":"{"local_version":"157.0.1","public_version":"157.0.1","is_updated":true}"}},"feature":"gep_internal"}
```

(As printed, the inner quotes are not escaped.) Fields: `local_version`, `public_version`, `is_updated`.

### me

| key | Category | Values | Since |
|---|---|---|---|
| name | game_info | Local Player Name | 128.0 |
| ultimate_cooldown | me | Ultimate ability cooldown (range between 0-100) | 128.0 |

```
{"gameId":21566,"feature":"me","category":"game_info","key":"name","value":"Shargaas"}
{"gameId":21566,"feature":"me","category":"me","key":"ultimate_cooldown","value":"{\"ultimate_cooldown\":\"15\"}"}
```

### game_info

| key | Category | Values | Since |
|---|---|---|---|
| player | game_info | Name of the local player in the lobby and in a match | 221.1.0 |
| phase | game_info | The current phase during the game | 215.0 |

`player` note: "If the local player has special characters in their name the game will display these characters as □ everywhere in the UI except for the lobby."
- `player_name`: local player name as displayed in the lobby.
- `in_game_player_name`: local player name as displayed inside a match; updates once the player enters a match.

```
{"gameId":21566,"feature":"game_info","category":"game_info","key":"player","value":"{\"player_name\":\"~JacksAtWork~\",\"in_game_player_name\":\"□JacksAtWork□\"}"}
```

`phase` possible values:
- Battle Royale: `"lobby"`, `"loading_screen"`, `"legend_selection"`, `"aircraft"`, `"freefly"`, `"landed"`, `"match_summary"`
- Arena: `"lobby"`, `"loading_screen"`, `"legend_selection"`, `"shopping"`, `"combat"`

```
{"gameId":21566,"feature":"game_info","category":"game_info","key":"phase","value":"combat"}
```

### match_info

| key | Category | Values | Notes | Since |
|---|---|---|---|---|
| pseudo_match_id | match_info | The current match's ID code. Example: `0c0ea3df-97ea-4d3a-b1f6-f8e34042251f` | "This is an Overwolf-generated code, unrelated to Respawn." | 130.0 |
| game_mode | match_info | The currently selected game mode. | | 158.0 |
| tabs | match_info | The current amount of squads, players, cash, and kills of the match (about local player). | | 158.0 |
| map_id | match_info | The current played map Id. | | 215.0 |
| arena_score | match_info | The current match score. | | 215.0 |
| mode_name | match_info | The current mode name. | | 241.0 |
| map_name | match_info | The current map name. | | 241.0 |

`game_mode`:

```
{"gameId":21566,"feature":"match_info","category":"match_info","key":"game_mode","value":"#PL_TRIO"}
```

Possible values (as listed, code: display name): `"PL_FIRINGRANGE": "Firing Range"`, `"PL_TRAINING": "Training"`, `"PL_DUO": "Duo"`, `"PL_TRIO": "Trio"`, `"PL_Ranked_Leagues": "Ranked"`, `"TDM_NAME": "Team Deathmatch"`, `"CONTROL_NAME": "Control"`, `"GAME_MODE_GUNGAME": "Gun Run"`, `"GAMEMODE_ARENAS": "Arenas"`, `"GAMEMODE_ARENAS_RANKED": "Ranked Arenas"`, `"SHADOWROYALE_MODE": "Shadow Royale"`, `"SURVIVAL_HARDCORE": "Hardcore Royale"`, `"SURVIVAL_HEATWAVE": "Heatwave"`. "Note that we get these values from the game, so they might be changed from season to season." (The example value has a leading `#`; the list does not.)

`tabs`:

```
{"gameId":21566,"feature":"match_info","category":"match_info","key":"tabs","value":"{\"kills\":2,\"assists\":1,\"teams\":4,\"players\":10,\"damage\":440,\"cash\":10}"}
```

Fields: `kills`, `assists`, `teams`, `players`, `damage`, `cash` (numbers).

`map_id` possible values:

| map_id | Map |
|---|---|
| `mp_rr_canyonlands_staging_mu1` | King canyon (Training) |
| `mp_rr_canyonlands_hu` | King canyon |
| `mp_rr_tropic_island_mu2` | Storm point |
| `mp_rr_desertlands_mu3` | World's edge |
| `mp_rr_olympus_mu2` | Olympus |
| `mp_rr_divided_moon` | Broken Moon |
| `mp_rr_freedm_skulltown` | Skull Town |
| `mp_rr_arena_habitat` | Habitat 4 |
| `mp_rr_aqueduct` | Overflow |
| `mp_rr_party_crasher` | Party crasher |
| `mp_rr_arena_phase_runner` | Phase runner |
| `mp_rr_arena_composite` | Drop off |
| `mp_rr_arena_skygarden ` (trailing space as printed) | Encore |

```
{"gameId":21566,"feature":"match_info","category":"match_info","key":"map_id","value":"mp_rr_canyonlands_staging"}
```

(The example value `mp_rr_canyonlands_staging` is not in the list, which has `_staging_mu1`. The `_muN` suffixes change with map versions, so do not hard-code the list.)

`arena_score`:

```
{"gameId":21566,"feature":"match_info","category":"match_info","key":"arena_score","value":"{\"my_team\":3,\"enemy_team\":4}"}
```

`mode_name` possible values: Firing Range, Training, Duo, Trio, Ranked, Arenas, Ranked Arenas, Shadow Royale, Hardcore Royale, Team Deathmatch, Gun Run, Control, Heatwave, Tournament, Deadeye, Armed and Dangerous, Living Shell Trio, Tricks N' Treats Trios, Three Strikes, Revenant Uprisin (sic).

```
{"gameId":21566,"feature":"match_info","category":"match_info","key":"mode_name","value":"Duo"}
```

`map_name` possible values: King Canyon, Kings Canyon, Storm Point, World's Edge, Olympus, Broken Moon, Habitat 4, Overflow, Party Crasher, Phase Runner, Drop off, Encore, Lobby.

```
{"gameId":21566,"feature":"match_info","category":"match_info","key":"map_name","value":"Olympus"}
```

### match_state

| key | Category | Values | Since |
|---|---|---|---|
| match_state | game_info | active/inactive | 128.0 |

| Event | Event Data | Fired When | Since |
|---|---|---|---|
| match_start | null | Match started | 128.0 |
| match_end | null | Match ended | 128.0 |
| round_start | null | Round started | 215.0 |
| round_end | null | Round ended | 215.0 |

```
{"gameId":21566,"feature":"match_state","category":"game_info","key":"match_state","value":"active"}
{"gameId":21566,"feature":"match_state","category":"game_info","key":"match_state","value":"inactive"}
{"gameId":21566,"feature":"match_state","key":"match_start","value":null}
{"gameId":21566,"feature":"match_state","key":"round_start","value":null}
{"gameId":21566,"feature":"match_state","key":"round_end","value":null}
```

**`match_end` quirk** (verbatim): "Currently, we have a special case where if someone in your team got a yellow knockdown shield (the one that allows you to self-revive), and your entire team was knocked out, the match end will still fire despite no one reaching a death-state. This is a very rare case that does not commonly happen in the game, however, we're still working on fixing it." No `match_end` data example is given.

### team

| key | Category | Values | Since |
|---|---|---|---|
| teammate_X | match_info | This feature provides the list of your squad members. | 128.0 |
| legendSelect_X | match_info | The name of the legend & order of selection for every member of the team, including noting who the jump-master and local player are. | 128.0 |
| team_info | match_info | The current status of the local player's team. | 128.0 |

`teammate_X`: each squad member joining the game is reported as:

```
{"gameId":21566,"feature":"team","category":"match_info","key":"teammate_0","value":"{\"name\":\"JacksAtWork\",\"state\":\"knocked_out\"}"}
```

The page says the object includes `player` (player name) and `state` (alive/death/knocked out). The example uses `name`, not `player`.

`legendSelect_X`: every team member, including the jump-master:

```
{"gameId":21566,"feature":"team","category":"match_info","key":"legendSelect_0","value":"{\"playerName\":\"MrPlayer\",\"legendName\":\"#character_lifeline_NAME\",\"selectionOrder\":\"0\",\"lead\":false,\"is_local\":false}"}
{"gameId":21566,"feature":"team","category":"match_info","key":"legendSelect_1","value":"{\"playerName\":\"apexfan\",\"legendName\":\"#character_horizon_NAME\",\"selectionOrder\":\"1\",\"lead\":false,\"is_local\":false}"}
{"gameId":21566,"feature":"team","category":"match_info","key":"legendSelect_2","value":"{\"playerName\":\"TheGC\",\"legendName\":\"#character_bloodhound_NAME\",\"selectionOrder\":\"2\",\"lead\":true,\"is_local\":true}"}
```

Fields: `playerName`, `legendName` (localization token `#character_<codename>_NAME`), `selectionOrder` (string), `lead` (bool; the jump-master), `is_local` (bool).

`team_info`: the current status of the local player's team (`"active"` or `"eliminated"`):

```
{"gameId":21566,"feature":"team","category":"match_info","key":"team_info","value":"{\"team_state\":\"active\"}"}
```

The page then says "The 'team_info' object includes: Selection order, Legend name, Jumpmaster - Bool True/False", which does not match the example (only `team_state`).

### roster

| key | Category | Values | Since |
|---|---|---|---|
| roster_XX | match_info | Provides the entire list of players in a match (~60 players). | 128.0 |

```
{"gameId":21566,"feature":"roster","category":"match_info","key":"roster_1","value":"{\"name\":\"HelloWork\",\"isTeammate\":true,\"team_id\":3,\"platform_hw\":2,\"state\":\"knocked_out\",\"is_local\":\"1\",\"platform_id\":\"7656119934534254\",\"origin_id\":\"2351105644\"}"}
```

Fields:
- `name`: player name
- `isTeammate` (Bool): player is/isn't a squad member
- `team_id`: numerical value for each squad in-game
- `platform_hw`: the platform the player currently plays on
- `state`: alive / knocked_out / death
- `is_local`: 1 for the local player, else 0 (a string `"1"` in the example)
- `platform_id`: the player ID on the platform currently used
- `origin_id`: the player's Origin / EA ID

`platform_hw` values: `7` = PC/Steam, `2` = PC/Origin/EA App, `1` = PS4 / PS5, `9` = OG Switch, `0` = Xbox one X.

### location

| key | Category | Values | Since |
|---|---|---|---|
| location | match_info | The coordinates of the location for the local player | 130.0 |

Notes:
- Map Center is (0,0,z).
- King's Canyon appears to be 1x1km.
- Location is polled up to two times in 1 second.
- Location is accurate to a 1-meter resolution; do not use fractions of meters.

```
{"gameId":21566,"feature":"location","category":"match_info","key":"location","value":"{\"x\":\"93\",\"y\":\"305\",\"z\":\"49\"}"}
```

### rank

| key | Category | Values | Notes | Since |
|---|---|---|---|---|
| victory | match_info | true/false | Triggers at the end of each round. Value "true" for winning and "false" for losing. | 128.0 |

```
{"gameId":21566,"feature":"rank","category":"match_info","key":"victory","value":"false"}
{"gameId":21566,"feature":"rank","category":"match_info","key":"victory","value":"true"}
```

Despite the feature name, `rank` has nothing about ranked tier, division or RP.

### match_summary

| key | Category | Since |
|---|---|---|
| match_summary | match_info | 130.0 |

After a match, returns: the final position the squad reached (ranked 1-20), the total number of teams in the match, the total number of kills made by the squad.

```
{"gameId":21566,"feature":"match_summary","category":"match_info","key":"match_summary","value":"{\"rank\":\"12\",\"teams\":\"20\",\"squadKills\":\"5\"}"}
```

Here `rank` is the placement, not the ranked tier.

### damage

| key | Category | Values | Since |
|---|---|---|---|
| totalDamageDealt | me | The total amount of damage inflicted in a match of Apex. | 130.0 |

**Quirk** (verbatim): "Note that the game does not count damage that is inflicted on Armor, only Health damage after the armor was broken. However, our damage report includes damage done to armor, so it will always be higher than the in-game damage."

```
{"gameId":21566,"feature":"damage","category":"me","key":"totalDamageDealt","value":"120"}
```

A second example under the same note shows a **team damage** key that is not in the table:

```
{"gameId":21566,"feature":"damage","category":"damage","key":"team_damage_dealt","value":"[{\"player_name\":\"BigApexGuy\",\"damage_dealt\":\"869\"},{\"player_name\":\"MrTesting\",\"damage_dealt\":\"825\"},{\"player_name\":\"TheOne31\",\"damage_dealt\":\"1083\"}]"}
```

`team_damage_dealt`: a JSON array of `{player_name, damage_dealt}` for the squad; category `damage`; no "since" version, no description of when it is sent.

| Event | Event Data | Fired When (announcement) | Since |
|---|---|---|---|
| damage | see example | When the local player deals damage to another player. | 130.0 |

Properties listed: `targetName`, `damageAmount`, `armor`, `headshot`, `grenade`.

```
{"gameId":21566,"feature":"damage","key":"damage","value":"{\"targetName\":\"TMW_JayJay\",\"damageAmount\":\"15.000000\",\"armor\":\"true\",\"headshot\":\"false\"}"}
```

(The example has no `grenade` field; booleans and the amount are strings. There is no weapon field.)

### inventory

| key | Category | Values | Since |
|---|---|---|---|
| inventory_XX | me | Lists the items picked up into the local player's inventory (Tab). Example: `{"name":"unknown_42","amount":"40"}` | 130.0 |
| weapons | me | Weapons currently used by the local player; two slots, marked 0 and 1. Example: `{"weapon0":"Wingman","weapon1":"Alternator SMG"}` | 0.130 (as printed) |
| inUse | me | Items currently used by the local player. Example: `{"inUse":"Kunai Melee"}` | 0.130 (as printed) |

```
{"gameId":21566,"feature":"inventory","category":"me","key":"weapons","value":"{\"weapon0\":\"R-99\",\"weapon1\":\"Melee\"}"}
{"gameId":21566,"feature":"inventory","category":"me","key":"inUse","value":"{\"inUse\":\"R-99\"}"}
```

List of available weapons (as printed, including duplicates): HAVOC, Hemlok Burst AR, VK-47 Flatline, R-301 Carbine, L-Star, Devotion, M600 Spitfire, Wingman, RE-45 Auto, P2020, EVA-8 Auto, Peacekeeper, Mozambique Shotgun, Mastiff Shotgun, Prowler Burst PDW, R-99, Alternator SMG, Volt SMG, Triple Take, Longbow DMR, G7 Scout, Sentinel, Charge Rifle, Kraber .50-cal Sniper, Thermite Grenade, Frag Grenade, Arc Star, Health Drone, Care Package, Dome of Protection, Defensive Bombardment, Grappling Hook, Zipline Gun, Launch Pad, Into the Void, Dimensional Rift, Smoke Launcher, Rolling Thunder, Nox Gas Trap, Nox Gas Grenade, Melee, Kunai Melee, Health/Shield, Knockdown Shield, Empty Handed, Rampage LMG, Bocek Compound Bow, 30-30 Repeater, C.A.R. SMG, Nemesis, Wingman, Prowler Burst PDW.

These are display names (the `weapons`/`inUse` scheme). The list is old (no newer guns) and does not match the kill feed's `weaponName` scheme (see kill_feed).

### kill

| Event | Event Data | Fired When | Since |
|---|---|---|---|
| kill | total kills | Local player killed another player. | 130.0 |
| knockdown | null | Local player knocked out another player. | 130.0 |
| assist | total assists | Local player participated in a team member's kill. | 130.0 |

```
{"gameId":21566,"feature":"kill","key":"kill","value":2}
{"gameId":21566,"feature":"kill","key":"knockdown","value":null}
{"gameId":21566,"feature":"kill","key":"assist","value":5}
```

`kill` and `assist` carry the local player's running total (a number); `knockdown` carries `null` (count the events).

### revive

| Event | Event Data | Fired When | Since |
|---|---|---|---|
| healed_from_ko | null | Local player was revived from knocked out state. | 128.0 |
| respawn | null | Local player was returned to the game at a beacon. | 128.0 |

```
{"gameId":21566,"feature":"revive","key":"healed_from_ko","value":null}
{"gameId":21566,"feature":"revive","key":"respawn","value":null}
```

Both are about the local player being revived/respawned, not about reviving others.

### death

| Event | Event Data | Fired When | Notes | Since |
|---|---|---|---|---|
| knocked_out | null | Local player's health drops to zero. | | 128.0 |
| death | null | Local player died during knocked out state. | "There is another health bar during the knocked out state, it's orange, above the player name." | 128.0 |

```
{"gameId":21566,"feature":"death","key":"knocked_out","value":null}
{"gameId":21566,"feature":"death","key":"death","value":null}
```

### kill_feed

| Event | Event Data | Fired When | Since |
|---|---|---|---|
| kill_feed | see example | When information is presented on the game's UI (top right corner). | 130.0 |

**Requirement:** "To recive the kill_feed event "Obituaries" must be set to "On" in the game's settings."

Properties: `local_player_name`, `attackerName`, `victimName`, `weaponName`, `action`, `action2`.

`action` possible values (as listed): `kill`, `headshot_kill`, `knockdown`, `Bleed_out`, `Finisher`, `Melee`, `Smoke Launcher`, `Creeping Barrage`, `Caustic Gas`, `Kunai Melee`, `Perimeter Security`, `Defensive Bombardment`, `Knuckle Cluster`, `Piercing Spikes`, `Hope's Dusk Melee`, `Butterfly Knife Melee`.

`action2` (verbatim): "`action2` reports the standard combat outcome (e.g. `knockdown`) when `action` is instead set to a special/named ability or event (e.g. `"Sniper's Mark"`). When `action` already holds a standard value like `kill` or `knockdown`, `action2` is `null`."

```
{"gameId":21566,"feature":"kill_feed","key":"kill_feed","value":"{\"local_player_name\":\"Shargaas\",\"attackerName\":\"shayan3200\",\"victimName\":\"i999n\",\"weaponName\":\"alternator\",\"action\":\"knockdown\",\"action2\":null}"}

{"gameId":21566,"feature":"kill_feed","key":"kill_feed","value":"{\"local_player_name\":\"[0000] JacksAtWork\",\"attackerName\":\"[0000]JacksAtWork\",\"victimName\":\"Seer3898\",\"weaponName\":null,\"action\":\"Sniper's Mark\",\"action2\":\"knockdown\"}"}

{"gameId":21566,"feature":"kill_feed","key":"kill_feed","value":"{\"local_player_name\":\"[0000] JacksAtWork\",\"attackerName\":\"JaxJor1719\",\"victimName\":\"Bloodhound8017\",\"weaponName\":\"r45\",\"action\":\"kill\",\"action2\":null}"}
```

Things visible in these examples (not stated as rules by the docs):
- `weaponName` uses short internal names (`alternator`, `r45`), not the inventory display names, and can be `null` for abilities.
- `local_player_name` carries a club tag with a space (`"[0000] JacksAtWork"`) while `attackerName` for the same player has none (`"[0000]JacksAtWork"`).
- Victims named like `Seer3898` / `Bloodhound8017` (legend name plus four digits).

**"Bleed Out" note**: `weaponName` can be `"Bleed Out"`:

```
{"gameId":21566,"feature":"kill_feed","key":"kill_feed","value":"{\"attackerName\":\"Red_Wizard19TTV\",\"victimName\":\"SoSochek_1337\",\"weaponName\":\"Bleed Out\",\"action\":\"Bleed Out\",\"action2\":null}"}
```

"Bleed Out" is when something "external" kills you, which is not an enemy player. For example, when already knocked out and outside the safe zone, HP depletes; when it reaches zero you Bleed Out, and `weaponName` and `action` return `"Bleed Out"`. The same applies to Caustic's gas barrels: if they kill you, you also receive a "Bleed Out". (This example has no `local_player_name`. The action list says `Bleed_out`; the example says `Bleed Out`.)

### player_stats (since 312.0)

| key | Category | Values |
|---|---|---|
| player_stats_career | player_stats | The local player's account level, XP, and lifetime career stats broken down by game mode (Battle Royale and Arenas). |
| player_stats_br_ranked_latest | player_stats | The local player's ranked Battle Royale stats for the current season. |
| player_stats_br_ranked_history | player_stats | A history of the local player's ranked Battle Royale stats from previous seasons. |
| player_stats_br_unranked_latest | player_stats | The local player's unranked (pubs) Battle Royale stats for the current season. |
| player_stats_br_unranked_history | player_stats | A history of the local player's unranked (pubs) Battle Royale stats from previous seasons. |

All five are about the **local player only**.

`player_stats_career`:

```
{"gameId":21566,"feature":"player_stats","category":"player_stats","key":"player_stats_career","value":"{\"level\":7,\"current_xp\":4658,\"needed_xp\":7100,\"total_xp\":28008,\"arenas\":{\"assists\":0,\"damage_dealt\":85,\"deaths\":3,\"games\":1,\"highest_damage\":85,\"highest_kills\":0,\"kills\":0,\"knockdowns\":0,\"longest_win_streak\":0,\"teammates_revived\":0,\"wins\":0,\"win_rate\":0.00,\"average_damage\":85.00,\"kill_death_ratio\":0.00},\"battle_royale\":{\"assists\":5,\"damage_dealt\":3090,\"deaths\":15,\"games\":21,\"highest_damage\":1451,\"highest_kills\":6,\"kills\":10,\"knockdowns\":13,\"longest_win_streak\":1,\"teammates_respawned\":0,\"teammates_revived\":3,\"top_5s\":2,\"wins\":1,\"win_rate\":4.76,\"average_damage\":147.14,\"kill_death_ratio\":0.67}}"}
```

- `level`: current account level. `current_xp`: XP towards the next level. `needed_xp`: XP required for the next level. `total_xp`: total lifetime XP.
- `arenas`: `assists`, `damage_dealt`, `deaths`, `games`, `highest_damage`, `highest_kills`, `kills`, `knockdowns`, `longest_win_streak`, `teammates_revived`, `wins`, `win_rate`, `average_damage`, `kill_death_ratio`.
- `battle_royale`: `assists`, `damage_dealt`, `deaths`, `games`, `highest_damage`, `highest_kills`, `kills`, `knockdowns`, `longest_win_streak`, `teammates_respawned`, `teammates_revived`, `top_5s`, `wins`, `win_rate`, `average_damage`, `kill_death_ratio`.
- `win_rate` is a percentage (4.76 = 1 win in 21 games).

`player_stats_br_ranked_latest`: `season` number, then the same fields as `battle_royale`:

```
{"gameId":21566,"feature":"player_stats","category":"player_stats","key":"player_stats_br_ranked_latest","value":"{\"season\":30,\"assists\":0,\"damage_dealt\":0,\"deaths\":0,\"games\":0,\"highest_damage\":0,\"highest_kills\":0,\"kills\":0,\"knockdowns\":0,\"longest_win_streak\":0,\"teammates_respawned\":0,\"teammates_revived\":0,\"top_5s\":0,\"wins\":0,\"win_rate\":0.00,\"average_damage\":0.00,\"kill_death_ratio\":0.00}"}
```

`player_stats_br_ranked_history`: a list of entries shaped like `player_stats_br_ranked_latest`, for previous seasons; empty if the player has no ranked history:

```
{"gameId":21566,"feature":"player_stats","category":"player_stats","key":"player_stats_br_ranked_history","value":"[]"}
```

`player_stats_br_unranked_latest`: `season` then unranked BR stats; **unlike the ranked and history keys it has no `highest_damage`, `highest_kills` or `longest_win_streak`**:

```
{"gameId":21566,"feature":"player_stats","category":"player_stats","key":"player_stats_br_unranked_latest","value":"{\"season\":30,\"assists\":0,\"damage_dealt\":0,\"deaths\":2,\"games\":2,\"kills\":0,\"knockdowns\":0,\"teammates_respawned\":0,\"teammates_revived\":0,\"top_5s\":0,\"wins\":0,\"win_rate\":0.00,\"average_damage\":0.00,\"kill_death_ratio\":0.00}"}
```

`player_stats_br_unranked_history`: list of previous seasons; each entry has the **full** stat set (`highest_damage`, `highest_kills`, `longest_win_streak`), same shape as `player_stats_br_ranked_latest`:

```
{"gameId":21566,"feature":"player_stats","category":"player_stats","key":"player_stats_br_unranked_history","value":"[{\"season\":26,\"assists\":3,\"damage_dealt\":1451,\"deaths\":0,\"games\":1,\"highest_damage\":1451,\"highest_kills\":6,\"kills\":6,\"knockdowns\":7,\"longest_win_streak\":1,\"teammates_respawned\":0,\"teammates_revived\":2,\"top_5s\":1,\"wins\":1,\"win_rate\":100.00,\"average_damage\":1451.00,\"kill_death_ratio\":0.00},{\"season\":24,\"assists\":1,\"damage_dealt\":289,\"deaths\":1,\"games\":2,\"highest_damage\":289,\"highest_kills\":1,\"kills\":1,\"knockdowns\":1,\"longest_win_streak\":0,\"teammates_respawned\":0,\"teammates_revived\":1,\"top_5s\":1,\"wins\":0,\"win_rate\":0.00,\"average_damage\":144.50,\"kill_death_ratio\":1.00},{\"season\":12,\"assists\":0,\"damage_dealt\":0,\"deaths\":1,\"games\":4,\"highest_damage\":0,\"highest_kills\":0,\"kills\":0,\"knockdowns\":0,\"longest_win_streak\":0,\"teammates_respawned\":0,\"teammates_revived\":0,\"top_5s\":0,\"wins\":0,\"win_rate\":0.00,\"average_damage\":0.00,\"kill_death_ratio\":0.00},{\"season\":11,\"assists\":1,\"damage_dealt\":495,\"deaths\":9,\"games\":9,\"highest_damage\":249,\"highest_kills\":1,\"kills\":1,\"knockdowns\":1,\"longest_win_streak\":0,\"teammates_respawned\":0,\"teammates_revived\":0,\"top_5s\":0,\"wins\":0,\"win_rate\":0.00,\"average_damage\":55.00,\"kill_death_ratio\":0.11},{\"season\":9,\"assists\":0,\"damage_dealt\":855,\"deaths\":2,\"games\":3,\"highest_damage\":919,\"highest_kills\":2,\"kills\":2,\"knockdowns\":4,\"longest_win_streak\":0,\"teammates_respawned\":0,\"teammates_revived\":0,\"top_5s\":0,\"wins\":0,\"win_rate\":0.00,\"average_damage\":285.00,\"kill_death_ratio\":1.00}]"}
```

(The example history is newest first and skips seasons with no games. The docs do not mention an RP/`rank_score` field or a limit on how many seasons are returned.)

### ring (since 312.0)

| key | Category | Values |
|---|---|---|
| next_ring | ring | The position and radius of the next (upcoming) ring. |
| active_ring | ring | The position and radius of the current (active) ring. |

```
{"gameId":21566,"feature":"ring","category":"ring","key":"next_ring","value":"{\"x\":\"7106.97\",\"y\":\"-3570.12\",\"radius\":\"13000\"}"}
{"gameId":21566,"feature":"ring","category":"ring","key":"active_ring","value":"{\"x\":\"-4181.48\",\"y\":\"1583.48\",\"radius\":\"32085.9\"}"}
```

Fields: `x`, `y` (center coordinates), `radius`; `active_ring` is the ring "currently active/closing in". The coordinates here have decimals and are much larger than the `location` example (King's Canyon "appears to be 1x1km"); the docs don't say whether ring and location share units.

Source: https://dev.overwolf.com/ow-electron/live-game-data-gep/supported-games/apex-legends

---

## 8. Game compliance: general rules (all games)

Page title: "App Compliance for In-Game Overlays and Ads". "Apps that fail to adhere to these rules will not be published or approved for distribution."

### General guidelines

- Your app should add value to the player while respecting the game creator and the game itself. It **shouldn't interfere with gameplay, competitiveness, and game developer intentions**.
- Your app **should not in any way encourage queue dodging and/or player discrimination**.
- Your app should follow the game developer's EULA and TOS. "Check with the game developer for specific EULA and TOS that may apply."
- Your app can be inspired by the game UI and should have its own visual identity. **Do not imitate game UI elements.** The app should be recognizable with a name and a window header so the player can tell where the game ends and the app begins (see https://dev.overwolf.com/ow-electron/guides/product-guidelines/branding-intelectual-property/app-identity).
- The app should have a communication channel with its audience so issues are promptly handled (see https://dev.overwolf.com/ow-electron/guides/product-guidelines/user-engagement/user-support).
- Note: "Using Overwolf's APIs require your app idea to be whitelisted. This is only given to app ideas submitted and approved using the App proposal process" (https://dev.overwolf.com/ow-electron/getting-started/project-roadmap#step-5---submit-your-app-idea). "Apps that haven't been approved are considered non-compliant or non-approved Overwolf apps."

### Required in-game user experience

- **Do not cover or interfere with the game UI**; any overlay that obstructs it will be rejected.
- **Avoid displaying overlays during active gameplay**; "overlays should only appear at appropriate moments."
- Ensure overlays are relevant and useful.

### When overlays may be shown

Only at times when they do not interfere with gameplay:
- **During game loading screens** (waiting for a match or level to load).
- **After a match ends** (post-game insights, statistics, highlights).
- **Between rounds or matches** (natural pauses in games with structured breaks).

Note: "**Apps that display persistent overlays during gameplay will not be approved. Overlays must always be easy to dismiss**, ensuring that players have full control over their experience."

### Ads (all apps)

- No in-game ads during active gameplay; only during loading screens, after matches, or in menus.
- Ads never cover important UI elements.
- Reasonable ad frequency.
- Ads dismissible or skippable where applicable.
- "Apps that do not comply with these guidelines will not be approved for the Overwolf Appstore."

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/overview

---

## 9. Game compliance: per-game rules

**There is no Apex Legends, EA or Respawn compliance page** among the game-compliance guides. The per-game pages are: Call of Duty: Warzone, Dota 2, League of Legends, New World, Rainbow 6 Siege, Riot Games (LoL, TFT, Valorant), Riot in-game ads, Teamfight Tactics. Several open with: "Competitive integrity is one of our core values, and we work tirelessly to enforce this value, both in-house and with the cooperation of game developers." They are summarized here because they show how Overwolf treats information about other players; none of them is stated to apply to Apex.

### Call of Duty: Warzone (a battle royale)

Apps are not allowed features which could cause:
- Unfair advantage to your users
- Any effect on player behavior during lobby phase or the match itself
- Any effect on general matchmaking behavior in the game

If tracking live stats:
- No live stats are allowed during warm up before match start
- No live stats are allowed during the match itself
- No DLL injection is allowed
- **No singling out specific players for outstanding behavior/performance**

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/call-of-duty-warzone-caldera

### Dota 2: Pre-Match Phase Anonymity

Valve aims to prevent metagaming and match-history-based target banning. When in matchmaking, other players' usernames/Steam IDs in the lobby must **never be shown before the picking phase ends**. Only during the picking phase: your own name need not be anonymous to you; after the picking phase players can see each other's names.

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/dota-2

### League of Legends

- Riot approval via Riot's 3rd-party application process (https://developer.riotgames.com/docs/portal#_getting-started) is required even if you don't use the Riot API; apps reaching publication without it will be asked to provide one.
- **Champion Select Anonymity** (prevent metagaming and queue dodging): in `Ranked Solo/Duo` champion select, non-party Summoner Names are replaced with `Ally #` (`Ally 1`, `Ally 2`...), including in-lobby text chat and names in the draft area; designations consistent across all clients. Applies only during Champion Select and only to non-party players; your own name isn't anonymous to you; party members are de-anonymized to each other; names visible from the loading screen.
- General feature compliance (Riot Games page): strictly prohibited: notifications when a power spike hits; notifications dictating player action from the current game state; tracking enemy ability cooldowns or summoner spell cooldowns (or helping players track them with timers). Ultimate timers strictly forbidden.
- Brawl game mode: match history not in Riot's public API; Riot does NOT approve any Brawl data being aggregated or visible on third-party apps.
- League Classic: match history not in the public API; Riot does NOT approve any League Classic data being aggregated or displayed, in any form.
- API restrictions: minor rune data no longer visible.

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends ; https://dev.overwolf.com/ow-electron/guides/game-compliance/riot-games

### Riot Games (general)

- Avoid the official Riot logo. Show this standard messaging where users can see it, without mentioning Riot's approval or endorsement: "[Your app name] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc."
- Riot approval required (as above).
- Teamfight Tactics: do not display Legend win rates, Augment win rates, or Augment average game placements (https://www.leagueoflegends.com/en-pl/news/game-updates/teamfight-tactics-patch-13-12-notes/).
- Valorant: spike timers not allowed during a live match. After changes to the Valorant Developer API Policy (https://support-developer.riotgames.com/hc/en-us/articles/22698769097107-VALORANT): private apps are no longer accepted regardless of API use; public apps need formal approval from both Riot Games and Overwolf before hosting.

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/riot-games ; https://dev.overwolf.com/ow-electron/guides/game-compliance/teamfight-tactics

### Riot in-game ads rules

Overwolf recommends its best-practice examples (https://www.figma.com/community/file/1524784631366197139).

1. **Overlays with ads must be opt-in by the user**: only after an explicit player action (hotkey, button, widget click). The app may auto-launch, but in-game windows with ads must not appear automatically. Signal availability with a quiet, static icon or notification; no flashing or animating.
2. **Large ad overlays must dim the game**, with a clear hotkey or button to return to the game. Small companion screens (widgets, compact side panels) don't need dimming.
3. **Overlays can't hide important game UI** (minimaps, scoreboards, shops, ability bars, system menus).
4. **No floating ads**: ads must be inside an overlay the player intentionally opened that provides real value.
5. **No in-game CTAs for ad removal or upgrades**, even in an opted-in overlay; subscription messaging only outside the game session (home screen, pre/post-game).
6. **Be visually distinct by design**: never look like the official game UI; don't copy its design, fonts, colors or interface elements; show your app name or logo clearly. Overwolf reviews each case individually.

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/riot-in-game-ads

### New World: minimaps

A minimap must follow the exact rules of the compass and give no advantage over it; all displayed information must originate from the Overwolf API. It may show player position, group members as on the compass, nodes and AI only if unlocked via tradeskills and within compass range, and quests as on the compass. Apps must not show precise coordinates (rounded, up to 25); GEP coordinates come pre-adjusted. Further reading: https://forums.newworld.com/t/dev-blog-mini-map/535888

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/new-world

### Rainbow 6 Siege (privacy mode)

Since Year 7 Season 2's Privacy Mode:
- Detect and support private mode and other privacy options. Give users **no way to tell whether another user is in private mode**. **Do not identify a user by any kind of behavior (suspected cheater, streamer, smurf and so on).**
- Custom temporary display name: show it (with its suffix, exactly as in game) instead of the username; replace a hidden avatar with the default one.
- **Users information: apps may only display seasonal win%, seasonal K/D, seasonal number of matches played, and current rank.** Avoid displaying any information about a user that originates from that user's profile.
- **No backtracking**: the app must not make it possible to trace a user's profile (e.g. clicking a custom temporary name must not return a traceable profile).

Source: https://dev.overwolf.com/ow-electron/guides/game-compliance/rainbow-6-siege

---

## Contradictions and gaps

### Inside the docs

- **`setRequiredFeatures` arguments.** The GEP intro shows `setRequiredFeatures(features)` (one argument); the API reference gives `setRequiredFeatures(gameId: number, features: string[] | undefined)`. The reference is the one to follow. Neither page says what passing `null`/`undefined` means (Apex Squads passes `null` for "all", following Overwolf's sample; see `src/main.ts`).
- **Game detection / elevated privileges** are not covered by the GEP guide pages at all; only the API reference covers them.
- **Supported environment tables and the per-game status widget** did not load in the downloaded pages. Apex's PROD/DEV status for ow-electron is unknown from this download.
- **Status example JSON is malformed** (unbalanced braces); the field `type` is undefined in prose.
- **Apex `localization` feature** is listed with no documentation.
- **`teammate_X`** fields: prose says `player`, the example says `name`.
- **`team_info`**: prose lists selection order / legend name / jumpmaster; the example has only `team_state`.
- **`damage` event**: `grenade` is listed but absent from the example.
- **`team_damage_dealt`** appears only as an example (category `damage`), not in the key table, with no version or trigger described.
- **`kill_feed` bleed-out**: the action list says `Bleed_out`; the example says `"Bleed Out"` (for both `action` and `weaponName`).
- **`game_mode`**: the example is `"#PL_TRIO"` (with `#`), the list has no `#`, and ranked is listed as `PL_Ranked_Leagues`.
- **`map_id`**: the example `mp_rr_canyonlands_staging` is not in the list; `"mp_rr_arena_skygarden "` has a trailing space; the `_muN` suffixes are old.
- **`inventory.weapons`/`inUse`** "since" version is printed as `0.130` (the others say `130.0`).
- **`gep_internal`** example has unescaped nested quotes (not valid JSON as printed).
- **`match_end` quirk** says "yellow knockdown shield (the one that allows you to self-revive)".
- **The generic event example** (`name`/`data`) differs from the Apex examples (`key`/`value`).
- **`ring` vs `location` units** are not explained (ring values are decimals in the thousands; location is 1 m integers).

### Compared with DESIGN.md section 2.1 (and related parts of section 9.1)

- **"Sanctioned by EA/Respawn"** (2.1): these pages don't say that. The Apex page says nothing about EA/Respawn approval, and there is no Apex compliance page. The docs do say an event can be disabled "by a request by the relevant game studio", and `pseudo_match_id` is "unrelated to Respawn".
- **`me`** (2.1 lists only `name`): the docs also list `ultimate_cooldown` (0-100, as `{"ultimate_cooldown":"15"}`), and `name`'s category is `game_info`.
- **`game_info`** (2.1 lists only `phase` with BR values): docs also have Arena phases (`shopping`, `combat`) and a `player` key with `player_name` / `in_game_player_name` (the `□` quirk comes from this key's note).
- **`match_info`** (2.1): docs also have `map_id` and `arena_score`; `tabs` also has `cash`. DESIGN 9.1 observed `game_mode = "#GAME_MODE_RANKED"`, which is not in the docs' list (`PL_Ranked_Leagues`), `map_name = "UNKNOWN"` for World's Edge (not a listed value), and `map_id` `mp_rr_desertlands_mu5` (docs list `_mu3`). The docs warn mode values "might be changed from season to season".
- **`team`** (2.1): docs also have `team_info` (`team_state` active/eliminated) and `legendSelect_X.lead` (jumpmaster), which 2.1 doesn't mention.
- **`roster`** (2.1): matches. The docs add the `platform_hw` code table and the "~60 players" note, and roster `state` (alive/knocked_out/death) for every player.
- **`kill` / `knockdown` / `assist` "Running totals"** (2.1): per the docs only `kill` and `assist` carry totals; `knockdown` is `null` (DESIGN 9.1 already found this).
- **`damage`** (2.1): the docs' `team_damage_dealt` key (per-squad-member damage) is not in 2.1, and DESIGN 11.1 says teammate damage is something "GEP didn't have". The docs show it exists (unverified in our recordings). `totalDamageDealt` (the info key) isn't in 2.1 either, though 9.1 uses it.
- **`kill_feed`** (2.1): the docs add `local_player_name` and `action2`. 2.1 lists `Bleed_out`; the docs example shows `"Bleed Out"` with `weaponName: "Bleed Out"`, while DESIGN 9.1 observed `Bleed_out` with an empty `weaponName`. Real data wins.
- **Match_end quirk** (2.1): "A self-revive with a gold knockdown shield may trigger `match_end` without a death." The docs say: a teammate with a **yellow** knockdown shield (the self-revive one) **and the entire team knocked out** triggers `match_end` although nobody reached a death state. The trigger is the whole squad knocked, not the self-revive itself.
- **`rank`** (2.1): matches (`victory`), with the added note that it "Triggers at the end of each round".
- **`player_stats`** (2.1): the docs have five keys (career with level/XP and Arenas, ranked latest/history, unranked latest/history). **The docs show no `rank_score`**, yet DESIGN 9.1 says `player_stats_br_ranked_latest` carries `rank_score` (RP). DESIGN 2.2 ("GEP has no RP") and 9.1 ("RP is in GEP") disagree with each other; the docs side with 2.2 by omission, the recordings with 9.1. DESIGN 12 says "GEP only sends the last 5 seasons"; the docs give no limit (their example history has 5 entries).
- **`location` / `ring`** (2.1): documented (location polled up to 2x per second, 1 m resolution; ring since 312.0). DESIGN 9.1 saw none in the provider log. The docs give no reason; possibly compliance-restricted or down (speculation; check `21566_prod.json`).
- **Feature status** (DESIGN 10: "Overwolf publishes feature status"): the concrete endpoints are `https://game-events-status.overwolf.com/gamestatus_prod.json` and `https://game-events-status.overwolf.com/21566_prod.json`, with states 0-3 and about 10 min delay.
- **Not in 2.1 at all**: `gep_internal`, `localization`, `match_state` (`match_state` info, `match_start`/`match_end`/`round_start`/`round_end` events), `inventory_XX`.

Sources: all pages above; DESIGN.md sections 2.1, 2.2, 9.1, 10, 11.1, 12.

---

## What this means for Apex Squads

### Showing opponents' info in popups

What the docs actually say:
- **No Apex-specific rule exists** in these pages, for or against showing other players' names, K/D or encounter history.
- The **general rules apply to every app**, and three of them bear directly on the popups:
  1. "Your app should not in any way encourage queue dodging and/or player discrimination."
  2. "Your app shouldn't interfere with gameplay, competitiveness, and game developer intentions."
  3. "Avoid displaying overlays during active gameplay" and "Apps that display persistent overlays during gameplay will not be approved. Overlays must always be easy to dismiss." Allowed moments: loading screens, after a match, between rounds or matches.
- The other games' pages show Overwolf's pattern for opponent information: hide other players' names before/while picking (Dota 2, LoL), no live stats during warm-up or the match and **no singling out specific players for outstanding behavior/performance** (Warzone, another battle royale), only seasonal win%/K/D/matches/rank and no identifying smurfs or streamers or letting users trace profiles (R6S).

Assessment (speculation, not stated by the docs):
- **Timing is the clearest risk.** The lobby card fires 2 s after `match_start` (during the drop), and the kill card fires when *I kill* someone while still playing. Both appear during active gameplay, which the general rules say to avoid. A death card after my own death (while spectating) or cards at `match_summary` / post-match fit the allowed moments better. Moving the lobby card to `loading_screen` or `legend_selection` would match "during game loading screens", but it is then shown before the match, when the Warzone rule ("effect on player behavior during lobby phase") and the queue-dodging rule become relevant. Whether Overwolf sees a pre-drop Apex card as a queue-dodging risk is not answered by the docs.
- **Content risk.** The lobby card highlights opponents with K/D >= 2 and "killed me before". That is close to Warzone's "singling out specific players for outstanding behavior/performance" and R6S's "do not identify a user due to any kind of behavior". Showing the per-match kill count and "kill leader" live is a live stat during the match, which Warzone forbids. None of these rules is stated for Apex, but Overwolf reviewers may apply the same pattern.
- **Anonymous mode.** The popup already treats anonymous players (legend name + 4 digits) as unidentifiable, which matches the R6S private-mode rules (don't reveal, don't let users trace). Keep it that way.
- **Data source.** Our opponent data comes from GEP (`roster`, `kill_feed`) and the user's own history, not from the players' profiles, which avoids the R6S "information which originates from said user's profile" concern. Using `origin_id` / `platform_id` to look people up on apexlegendsstatus would be closer to that line (already dropped, DESIGN 9.1).
- **Bottom line:** the docs neither allow nor forbid this for Apex. DESIGN 10's plan to confirm with Overwolf before release is right. Ask specifically about (a) timing (during the match vs loading screen vs post-death vs post-match), (b) highlighting high-K/D players, and (c) "killed you before" history. Make every card dismissible and non-persistent in any case, since that rule is explicit.

### Other compliance points for the app

- Our own visual identity; do not imitate the Apex UI (general rule). The use of game portraits and rank badges was cleared separately (DESIGN 10) and is not covered by these pages.
- A support channel for users is expected.
- Using GEP requires the app idea to be whitelisted through the App proposal process (DESIGN 10 already tracks this).
- If Apex is only in the DEV environment for ow-electron, the app needs `--owepm-packages-url=https://electronapi-qa.overwolf.com/v2/packages` until DevRel moves Apex to PROD, and that argument must be removed afterwards. Check the Trello card.

### GEP behavior to design for

- Register features as early as possible after launch; if the app starts mid-match, show the user that data may be incomplete ("Run order matters!").
- Treat `null` info values as resets between matches.
- Poll `https://game-events-status.overwolf.com/21566_prod.json` for the planned Settings > Diagnostics (DESIGN 12) and show yellow/red states to the user, as the docs strongly recommend.
- `kill_feed` depends on the in-game "Obituaries" setting (the planned Obituaries check in DESIGN 12 matches the docs).
- Our damage will always read higher than the in-game number (armor damage included).

### Apex features the app records but doesn't use yet

The app subscribes to all features (`setRequiredFeatures(21566, null)` in `src/main.ts`), so all of these are already in the recordings if GEP sends them. A search of `src/` and `sql/` found no use of:

- **`damage.team_damage_dealt`**: per-teammate damage. If our recordings have it, it would give the "teammate damage" DESIGN 11.1 thought only OCR could give (Squads tab, teammate stats). Worth checking the recordings first.
- **`player_stats_career`**: account level, XP, lifetime BR and Arenas totals.
- **`player_stats_br_unranked_latest` / `_history`**: `build-dataset.ts` mentions "unranked", but the Seasons tab is ranked only.
- **`team.team_info`** (`team_state` active/eliminated): a direct squad-elimination signal for match boundaries and placement timing.
- **`team.legendSelect_X.lead`**: who was jumpmaster.
- **`roster_XX.platform_hw`**: opponent/teammate platform (PC Steam, EA App, PlayStation, Switch, Xbox). Not referenced in code.
- **`rank.victory`** and **`match_state`** info / `round_start` / `round_end`: no code references found.
- **`me.ultimate_cooldown`**: DESIGN 12 decided against ult usage stats.
- **`location`, `ring.next_ring`, `ring.active_ring`**: needed for the planned Maps tab and "contested landings"; DESIGN 9.1 saw none of them in the provider log.
- **`match_info.arena_score`**, Arena phases: not relevant while the app focuses on ranked BR.
- **`game_info.player`** (`player_name` / `in_game_player_name`): used only by the anonymizer; could map the lobby name to the in-match name when it contains special characters.
- **`gep_internal`**: the GEP version; useful in diagnostics and bug reports.
- **`localization`**: undocumented.

Source: the pages cited above, `C:\Users\User\Documents\apex-squads\DESIGN.md`, `C:\Users\User\Documents\apex-squads\src\main.ts`.
