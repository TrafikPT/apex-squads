# Next steps

The work queue, in order. Updated 2026-09-28. Take one item at a time; when an
item is done, move it to "Done" with the date and commit. Overwolf facts come
from [overwolf/](overwolf/README.md); decisions and their reasons go in DESIGN.md.

## Now

### 1. Record about 10 ranked matches with `npm start`
The recorder's first milestone (DESIGN.md §8), and the first end-to-end test of
RP from our own recorder.
- Start the app before Apex, with the Overwolf client closed.
- **Blocked from 2026-09-29**: Overwolf disables Apex GEP and overlay for EA's
  Javelin anti-cheat update, no ETA (overwolf/gep-and-compliance.md §5). Record
  what you can before then; resume when #tech-announcements says it's back.
- Done when: 10 ranked matches recorded, each with real RP (not the formula's
  estimate) and none left out as incomplete. Check the RP snapshot lines: the
  lobby lookup should now go by EA ID (`accounts.json`).

### 2. Email DevRel the open questions
The list is in [overwolf/README.md](overwolf/README.md#open-questions-ask-devrel-or-check-the-developers-discord), plus:
- Which app name and author the whitelisting registered (we renamed to Apex Squads
  the day after): packaged builds whose UID isn't approved get no GEP. Send from
  the email used on the app idea form.
- How the first ow-electron QA build gets Overwolf-signed without `OW_BUILD_KEY`.
- Does QA expect the app to start when Apex launches ("no launch events")?
- Can a friend alpha-test with my Developer Key until I have Console access, or
  should he apply for his own? (Discord: Dev Mode needs an approved developer
  account; co-developers submit their own app idea.)
- Send it after 2026-10-03: Overwolf's office is closed Oct 1-3.
- Record the answers in overwolf/README.md ("Findings from our own use") and
  update this list.

### 3. In-game overlay for the kill/death and lobby cards
Today the cards are plain always-on-top windows: invisible in fullscreen,
visible only in borderless windowed, and they can take focus from Apex (the
mouse pointer problem). Overwolf's overlay package draws inside the game
instead. API: [overwolf/api-reference.md](overwolf/api-reference.md) (`overlay`).
- Add `"overlay"` to `overwolf.packages` in package.json. On `ready`:
  `registerGames` for Apex (21566), `event.inject()` on `game-launched`, wait
  for `game-injected`.
- The overlay's `game-launched` info has `id` 215661 and `classId` 21566 for
  Apex (expected from the Overwatch case; check the log): match on `classId`.
- Create the card window with the overlay's `createWindow` (a `name` of 20
  characters or fewer, `passthrough` so the game keeps all input). Reuse
  `ui/popup.html` and the card rendering as they are.
- Cards stay brief and dismissible: they already hide after 7 s. Overwolf:
  "Apps that display persistent overlays during gameplay will not be approved.
  Overlays must always be easy to dismiss." (overwolf/gep-and-compliance.md §8)
- Apex running as administrator: injecting needs `installHighElevationHelper()`
  (a UAC prompt; exit code 1223 means the user said no). Tell the user why.
- Keep the old always-on-top window as the fallback when injection fails, until
  the overlay has proven itself.
- Done when: cards show in fullscreen Apex, never take focus, and a real match
  shows them at the right moments.

### 4. Hotkeys and the hotkey reminder
The user must be able to hide the cards at once and turn them off, and must be
told the keys (overwolf/product-guidelines.md §2.4).
- Hotkeys via `overlay.hotkeys.register`, with `passthrough` so the keys still
  reach the game. One developer's overlay hotkeys never fired and another team
  uses Electron's `globalShortcut` instead (overwolf/api-reference.md). Proposed defaults (check they don't clash with Apex's):
  - hide the current card now;
  - cards on/off for the session;
  - show the last card again.
  TRN's tracker uses separate show and hide keys; decide after trying it.
- Rebindable in a settings screen (item 5), with a conflict warning.
- Hotkey reminder: shown in the dashboard (settings and a hint on the home
  view), and once in game on the first card of a session ("Ctrl+H hides cards").
- Done when: the keys work mid-match, can be changed and persist, and the
  reminder is visible.

### 5. Settings screen: the rest
The Settings tab has the popup settings (which cards, where, how long). Still
to add: hotkeys (item 4), the apexlegendsstatus key (testers won't have ours),
where the data is kept.
Later: the Privacy section with the consent "Manage" button that ads require
(overwolf/console-and-monetization.md §6).

## Before the first QA submission
Order within this block is flexible. Submission form: https://wkf.ms/3KL8b1m.
- **Ads decision.** Overwolf: apps without ads "from the beginning" aren't
  prioritised in QA and go-live. The Discord says ads are optional for approval
  (policy wording and members), not what they do to priority. If yes: `<owadview/>` containers of the allowed
  sizes, the consent (CMP) flow, and reconsider `disableAdsOptimization()`
  (overwolf/console-and-monetization.md §6).
- **Support channel.** Help (added 2026-09-28) has the FAQ, release notes and a
  "report a problem" button that opens the recordings folder, but nowhere to send
  a report. Pick one (a Discord server or an email address) and link it from Help;
  Overwolf expects a support channel (product-guidelines.md §5.3).
- **Game-events status in the dashboard**: read `21566_prod.json` and say when
  Apex's game data is down (product-guidelines.md §4.4). The title bar's "Waiting
  for Apex Legends" is fixed text today; make it reflect the game and the status.
- Keep Help's FAQ and "What's new" current with each release (src/ui/views/help.ts).
- **Launch behavior, finish on Windows.** Done on macOS (2026-09-28): tray icon
  (placeholder) with Open / Start with Windows / Quit; closing the window keeps
  recording; a second launch reopens the dashboard; the login item starts with
  `--hidden`. To do on Windows: check the tray icon, left-click and menu; build an
  installed app and test "Start with Windows" (it only works when packaged)
  including a reboot; decide whether anything should open when Apex launches
  (QA flagged an electron app for "no launch events"; opening the dashboard would
  take focus from the game); a real app icon (tray, installer, window).
- **Terms of Use and Privacy Policy** on public URLs without login; the
  installer must ask users to accept them.
- **Packaging and signing:** `@overwolf/ow-electron-builder` 26.9.2, the Overwolf
  installer (ask developers@overwolf.com), and our own code-signing certificate for
  both the installer and the exe: Azure about $10/month if it accepts individuals
  in Portugal (and the builder has its signing queue), otherwise about $500/year
  (overwolf/setup-and-release.md §6-7). How to sign the first QA build before
  having the Console is an open question for DevRel.
- **Test the packaged, signed build on a clean PC**: GEP events arrive, and
  `owpm.log` shows real package versions, not `0/0.0.0` stubs.
- **QA takes weeks** (staff admitted a backlog; members waited 4 weeks to 80+
  days). Send the build with screenshots and a feature list; don't replace it in
  the queue (that moves you to the back), send changes to DevRel instead.
- **Clean VirusTotal scan** of the build: builds with warnings aren't tested.

## After QA passes (Developer Console)
- Add the friend in Users and permissions, so he develops with his own
  credentials.
- Testing channel "Beta" and its public link for testers.
- App UID and `OW_BUILD_KEY` for signed builds.

## Housekeeping
- The Developer Key (`OW_DEV_KEY`) expires 2026-11-10: extend it on the
  dev.overwolf.com profile from 2026-11-08. An expired key fails with
  "invalid verification".
- Refresh the Discord findings now and then (overwolf/README.md, "Sources").
  #issues-and-requests and #tech-announcements matter most.
- `Documents\ApexTracker\gep-log-backup` holds the old Overwolf client logs;
  delete when no longer needed.

## Done
- 2026-09-28: first-run welcome (skippable, reopened from Help), a notice over the
  sample data until the first match, and a Help page (getting started, FAQ,
  release notes, open the recordings folder).
- 2026-09-28: the player name comes from `me.name` or `game_info.player` (Overwolf
  is retiring `me.name`); the features log line says what it counts.
- 2026-09-28: Overwolf Developers Discord exported and distilled into
  docs/overwolf/ (Apex GEP disable, signing and QA realities, Apex in PROD).
- 2026-09-28: data moved to `%APPDATA%\Apex Squads`; app renamed to Apex
  Squads; Overwolf knowledge base in docs/overwolf/.
- 2026-09-27: Overwolf whitelisting; first match recorded by our own app (Dev
  Mode, no Overwolf client); EA ID remembered between sessions.
