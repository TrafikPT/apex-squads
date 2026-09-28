# Overwolf knowledge base

Distilled from the official ow-electron docs (https://dev.overwolf.com/ow-electron/)
on 2026-09-28, so agents don't have to reread them. All 170 relevant pages
were read in full: everything under ow-electron except the other games' GEP
pages (only Apex Legends), the video recorder's API details (overview only)
and the console stats API endpoints (overview only). Each file cites the
source page after every section and lists contradictions and gaps at the end.
Check the source before relying on anything time-sensitive; refresh with
`node scripts/fetch-overwolf-docs.mjs <out dir>` and a re-read.

| File | Covers |
|---|---|
| [setup-and-release.md](setup-and-release.md) | Roadmap phases, whitelisting, Dev Mode keys, app signing, the Overwolf installer, package channels, CLI, Overwolf's test checklist, submission, QA, Console access, go-live, changelog (with Apex GEP changes) |
| [console-and-monetization.md](console-and-monetization.md) | Developer Console, app keys, release management (production/testing channels), ads (containers, sizes, placement rules, CMP consent), subscriptions, payments, store assets |
| [product-guidelines.md](product-guidelines.md) | UX guidelines QA checks against: windows, desktop/in-game, hotkeys, FTUE, pop-ups, errors, empty states, settings, support, branding/IP, growth programs |
| [gep-and-compliance.md](gep-and-compliance.md) | Game Events Provider, the full Apex Legends reference (every feature and key), event status endpoints, game compliance rules (all games and per game) |
| [api-reference.md](api-reference.md) | ow-electron APIs: app.overwolf, packages, gep, overlay, utility, crn, OIDC, with notes on how src/main.ts uses them |

## What matters most for Apex Squads (as of 2026-09-28)

**Path to release and beta testers**
1. App idea whitelisted (done 2026-09-27); Developer status Approved on dev.overwolf.com.
2. Build and self-test in Dev Mode (`OW_DEV_KEY`; see below).
3. Submit the first build to DevRel QA with the form https://wkf.ms/3KL8b1m.
4. QA cycles until it meets their bar. The Developer Console (console.overwolf.com) opens
   "ONLY after you submit your app and it's been approved by our QA team".
5. In the Console: App UID, app keys (`OW_BUILD_KEY`), production and testing channels.
   Beta testers get builds from a testing channel's public link; "Using the Overwolf
   installer is the only way to access and test different versions in the Developers
   Console testing Channels." Test channels are exempt from mandatory version review.
6. Go-live: Overwolf enables ads, Payoneer registration.

So beta testers come after the first QA pass, not before. Testers can't use Dev Mode:
it "can't activate on a distributed or packaged app".

**Signing** (setup-and-release.md §6): a distributed build needs two signatures or GEP
won't load: Overwolf's (via `@overwolf/ow-electron-builder` 26.9.0+ with `OW_CLI_EMAIL`,
`OW_CLI_API_KEY`, `OW_BUILD_KEY`) and our own Authenticode certificate from a trusted CA.
The App UID comes from `productName` + `author.name`, which must stay the same across
versions: they are "Apex Squads" and "TrafikPT" (renamed from "Apex Tracker" on
2026-09-28, before any signed build). Don't change them again.

**Dev Mode** (setup-and-release.md §5): `OW_DEV_KEY` from the dev.overwolf.com profile, or
the `OW_CLI_EMAIL` + `OW_CLI_API_KEY` pair, which takes precedence. The key expires
(ours: 14 days) and is extended on the profile page.

**Ads** (console-and-monetization.md §5-6): only Overwolf ads and/or subscriptions are
allowed. Ads go in `<owadview/>` containers of fixed sizes, never in login, error or
notification windows. The CMP privacy/consent rules apply. Overwolf told us apps without
ads "from the beginning" aren't prioritised in QA and go-live; the docs don't say so.

**Compliance** (gep-and-compliance.md §8-9, product-guidelines.md §4):
- Pop-ups "appear in the desktop environment of your app and never during gameplay".
- "Apps that display persistent overlays during gameplay will not be approved."
- Nothing Apex-specific, but Warzone's rules forbid "singling out specific players".

Our kill/death and lobby cards appear during matches and highlight players, so ask
DevRel before submitting (DESIGN.md §10).

**GEP and our code** (api-reference.md, gep-and-compliance.md §7):
- "Subscribed to N features" in main.ts logs `getFeatures()`, the features the game
  supports, not what we subscribed to. Passing `null` to `setRequiredFeatures` for
  "all" is undocumented.
- Apex game id 21566. Status: https://game-events-status.overwolf.com/21566_prod.json
  (0 unsupported, 1 green, 2 yellow, 3 red).
- Keys we record but don't use yet include `team_damage_dealt` (teammate damage).
- In-game overlay: Apex is an exclusive-mode (hidden cursor) game; see api-reference.md
  `overlay`.

## Open questions (ask DevRel or check the developers' Discord)
- How is the first QA build signed, when signing needs Console items (App UID,
  `OW_BUILD_KEY`) and the Console opens only after QA?
- Do ads really gate QA priority, and can an ad-free app go live?
- Can testing channels (beta) be used before the first QA approval?
- Are small kill/death cards during a match "pop-ups" or "persistent overlays"? Is showing
  opponents' K/D and "killed you before" allowed for Apex? Precedent: TRN's Apex Legends
  Tracker, an approved Overwolf app, shows similar cards. Ours are a stopgap (plain
  always-on-top windows) until the in-game overlay replaces them.
- Which code-signing certificate do individual developers use?
- Is Apex in PROD or DEV for ow-electron GEP? The docs' games table loads by script and
  wasn't captured; in practice GEP works for Apex in Dev Mode.

## Findings from our own use (not in the docs)
- 2026-09-27: `OW_CLI_EMAIL` + `OW_CLI_API_KEY` failed with "invalid verification";
  `OW_DEV_KEY` worked.
- Closing the Overwolf client mid-session stopped our app's game events; started without
  the client, the app works. Don't run the client alongside it.
- The Console's Google login failed ("Something went wrong") before QA approval.
