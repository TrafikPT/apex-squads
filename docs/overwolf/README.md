# Overwolf knowledge base

Distilled from the official ow-electron docs (https://dev.overwolf.com/ow-electron/)
on 2026-09-28, so agents don't have to reread them. All 170 relevant pages
were read in full: everything under ow-electron except the other games' GEP
pages (only Apex Legends), the video recorder's API details (overview only)
and the console stats API endpoints (overview only). Each file cites the
source page after every section and lists contradictions and gaps at the end.
Check the source before relying on anything time-sensitive; refresh with
`node scripts/fetch-overwolf-docs.mjs <out dir>` and a re-read.

Also distilled: the Overwolf Developers Discord (exported 2026-09-28; see "Sources"
below). Its findings sit in the files above, marked "Discord", with channel and date.

| File | Covers |
|---|---|
| [setup-and-release.md](setup-and-release.md) | Roadmap phases, whitelisting, Dev Mode keys, app signing, the Overwolf installer, package channels, CLI, Overwolf's test checklist, submission, QA, Console access, go-live, changelog (with Apex GEP changes) |
| [console-and-monetization.md](console-and-monetization.md) | Developer Console, app keys, release management (production/testing channels), ads (containers, sizes, placement rules, CMP consent), subscriptions, payments, store assets |
| [product-guidelines.md](product-guidelines.md) | UX guidelines QA checks against: windows, desktop/in-game, hotkeys, FTUE, pop-ups, errors, empty states, settings, support, branding/IP, growth programs |
| [gep-and-compliance.md](gep-and-compliance.md) | Game Events Provider, the full Apex Legends reference (every feature and key), event status endpoints, game compliance rules (all games and per game) |
| [api-reference.md](api-reference.md) | ow-electron APIs: app.overwolf, packages, gep, overlay, utility, crn, OIDC, with notes on how src/main.ts uses them |

## What matters most for Apex Squads (as of 2026-09-28)

**Apex GEP and overlay are off from 2026-09-29** (Discord #tech-announcements, staff,
2026-09-27): "Overwolf will temporarily disable Overlay and GEP support for Apex Legends
while we monitor the new game update, which also includes a new anti-cheat release" (EA
Javelin). No ETA yet; Overwolf will post one once the game update is live. Until then the
app records nothing and the `popup:live` log route gets no events either. Watch
#tech-announcements and `21566_prod.json` (gep-and-compliance.md §5). Anti-cheat
precedents range from 20 hours (Riot Vanguard) to about 6 months (ARC Raiders), and
Battlefield 6, another Javelin game, had GEP connected but silent in 2026-07.

**Path to release and beta testers**
1. App idea whitelisted (done 2026-09-27); Developer status Approved on dev.overwolf.com.
2. Build and self-test in Dev Mode (`OW_DEV_KEY`; see below).
3. Submit the first build to DevRel QA with the form https://wkf.ms/3KL8b1m. Later builds
   go by replying to the QA email with a download link; swapping the queued build puts you
   at the back of the queue (setup-and-release.md §11).
4. QA cycles until it meets their bar. Staff admitted a backlog (2026-03); the automatic
   reply says up to 4 weeks, and members waited 7 weeks to 80+ days for a first result.
   DevRel creates the Console app during the first QA. The Developer Console (console.overwolf.com) opens
   "ONLY after you submit your app and it's been approved by our QA team".
5. In the Console: App UID, app keys (`OW_BUILD_KEY`), production and testing channels.
   Beta testers get builds from a testing channel's public link; "Using the Overwolf
   installer is the only way to access and test different versions in the Developers
   Console testing Channels." Test channels are exempt from mandatory version review.
6. Go-live: Overwolf enables ads, Payoneer registration.

Overwolf's office is closed Oct 1-3, 2026 (and on other holidays), and staff warn that QA
slows then: time the submission around it (setup-and-release.md §16).

So beta testers come after the first QA pass, not before. Testers can't use Dev Mode:
it "can't activate on a distributed or packaged app".

**Signing** (setup-and-release.md §6): a distributed build needs two signatures or GEP
won't load: Overwolf's (via `@overwolf/ow-electron-builder` 26.9.0+ with `OW_CLI_EMAIL`,
`OW_CLI_API_KEY`, `OW_BUILD_KEY`) and our own Authenticode certificate from a trusted CA.
The App UID comes from `productName` + `author.name`, which must stay the same across
versions: they are "Apex Squads" and "TrafikPT" (renamed from "Apex Tracker" on
2026-09-28, before any signed build). Don't change them again. **Confirm the whitelisted
name matches**: since about 2026-05-28, packaged builds whose UID isn't approved get
0.0.0 stub packages (no GEP), while Dev Mode still works (Discord #devs-help; check
`owpm.log`, setup-and-release.md §3). We were whitelisted the day before the rename, so
ask developers@overwolf.com, from the form's email, which name and author they have.
Staff's fix for stub packages is the same address with the App UID and the app's
`app.asar`. Choosing Azure signing? ow-electron-builder lacked the signing queue it
needs (2026-02); check 26.9.2 first. The security update behind
this is mandatory since 2026-08-06: staff say use builder **26.9.2** (with ow-electron
39.8.12+ and types 1.1.6-1+), and rebuild anything signed before a 2026-07-22 fix to
`integrity.dll` (Discord #tech-announcements).

**Dev Mode** (setup-and-release.md §5): `OW_DEV_KEY` from the dev.overwolf.com profile, or
the `OW_CLI_EMAIL` + `OW_CLI_API_KEY` pair, which takes precedence. The key expires
(ours: 14 days) and is extended on the profile page. Per staff, the pair is for developers
with Console access and `OW_DEV_KEY` for approved developers without it, which is us
until QA passes.

**Ads** (console-and-monetization.md §5-6): only Overwolf ads and/or subscriptions are
allowed. Ads go in `<owadview/>` containers of fixed sizes, never in login, error or
notification windows. The CMP privacy/consent rules apply. Overwolf told us apps without
ads "from the beginning" aren't prioritised in QA and go-live; the docs don't say so. The
2026-06-08 policy is conditional ("If your app includes monetization, it must use Overwolf
Ads, Overwolf Subscriptions..."), and a member answered "Ads and subs are optional,
always" (Discord, 2026-09-03): so ads look optional for approval, not for priority.

**Compliance** (gep-and-compliance.md §8-9, product-guidelines.md §4):
- Pop-ups "appear in the desktop environment of your app and never during gameplay".
- "Apps that display persistent overlays during gameplay will not be approved."
- Nothing Apex-specific, but Warzone's rules forbid "singling out specific players".

Our kill/death and lobby cards appear during matches and highlight players, so ask
DevRel before submitting (DESIGN.md §10).

**GEP and our code** (api-reference.md, gep-and-compliance.md §7):
- main.ts logs `getFeatures()`, the features Apex supports; `setRequiredFeatures`
  reports nothing back. Passing `null` to `setRequiredFeatures` for
  "all" is undocumented, but staff say it's a filter and no list means everything
  (Discord, 2026-04); `enable()` in `game-detected` is what turns GEP on.
- Apex game id 21566. Status: https://game-events-status.overwolf.com/21566_prod.json
  (0 unsupported, 1 green, 2 yellow, 3 red).
- Keys we record but don't use yet include `team_damage_dealt` (teammate damage).
- `me.name` is slated for deprecation in favour of `game_info.player` (staff, 2023);
  the recorder and dataset read either (`lobbyPlayerName` in src/game-names.ts).
- In-game overlay: Apex is an exclusive-mode (hidden cursor) game; see api-reference.md
  `overlay`.

## Open questions (ask DevRel or check the developers' Discord)
- How is the first QA build signed, when signing needs Console items (App UID,
  `OW_BUILD_KEY`) and the Console opens only after QA? The Discord doesn't say; staff
  expect pre-Console developers to use `OW_DEV_KEY`, and in 2022 sent a pre-Console
  developer to developers@overwolf.com so DevRel could handle testing. For native, staff
  sign a pre-Console submission themselves; for ow-electron they said "package it as an
  EXE and sign it yourself" (2025-11), without saying where `OW_BUILD_KEY` comes from.
- Do ads really gate QA priority? (An ad-free app can apparently go live: see Ads above.)
- Can testing channels (beta) be used before the first QA approval? Probably not: they
  live in the Console; in 2022 staff routed pre-Console testing through DevRel instead.
- Are small kill/death cards during a match "pop-ups" or "persistent overlays"? Is showing
  opponents' K/D and "killed you before" allowed for Apex? Precedent: TRN's Apex Legends
  Tracker, an approved Overwolf app, shows similar cards. Ours are a stopgap (plain
  always-on-top windows) until the in-game overlay replaces them.
- Which code-signing certificate do individual developers use? A veteran member uses
  Azure's code signing (Trusted/Artifact Signing) at about $10/month; check whether it
  accepts individuals in Portugal. Otherwise SSL.com or Sectigo at about $500; an EU
  developer found 673 EUR/year the cheapest. Sign both the installer and the exe.
- ~~Is Apex in PROD or DEV for ow-electron GEP?~~ PROD: the Trello "Electron Games
  Support" card, embedded in a Discord post on 2025-09-19, lists Apex Legends under Prod.
  Recheck before go-live (https://trello.com/b/1V10E4IB/overwolf-developers-roadmap).
- Staff's workaround for late starts is to launch at Windows startup and wait in the tray
  (2025-11), which also answers QA's "no launch events". Does QA expect the app to start
  when Apex launches? QA flagged an ow-electron app for
  "no launch events" (2026-06). Starting before Apex also matters for data: an app started
  with Apex already open lost the first match's legend select, knockdowns and assists
  (2025-07).

## Findings from our own use (not in the docs)
- 2026-09-27: `OW_CLI_EMAIL` + `OW_CLI_API_KEY` failed with "invalid verification";
  `OW_DEV_KEY` worked. Expected: the pair needs Console access (Discord, 2026-08-03).
- Closing the Overwolf client mid-session stopped our app's game events; started without
  the client, the app works. Don't run the client alongside it.
- The Console's Google login failed ("Something went wrong") before QA approval. Common
  in the Discord: the Console opens only after the first QA pass.

## Sources: the Overwolf Developers Discord
Exported 2026-09-28 with DiscordChatExporter (CLI, run with a user token) from
"Overwolf Developers Community", then read in full by agents. Read so far: #tech-announcements
(2018-2026), #announcements (2020-2026), #devs-tips (2020-2026), #devs-help and #devs-chat
(2025-2026), #dev-resources, #get-started, and #issues-and-requests (2025-2026; #chat and #ask-for-help had nothing since 2025). Hidden from
ordinary members (not readable): the archived per-game channels (including apex-dev-archived),
#devs-knowledge-base, #get-whitelisted, #ask-overwolf, and the Staff category.
Raw exports contain other people's names and messages: keep them out of git, and paraphrase
members without names (Overwolf staff are named only by role).
To refresh (outside the repo): `DiscordChatExporter.Cli export -t <token> -c <channel id>
-f Json --include-threads All --after <last export date> -o <json dir>/`, one channel per
run (a hidden channel aborts a multi-channel run; `channels --include-threads All` stalls on
rate limits, so list channels without threads). Then
`node scripts/discord-to-text.mjs <json dir> <text dir>`, which tags staff and replaces
members' names with aliases, and read what's new.
