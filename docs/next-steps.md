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

### 3. Test the in-game overlay, hotkeys and title-bar status on Windows
Coded on macOS on 2026-09-28, where neither can run (DESIGN.md §12, "Popups" and
"Status"). `npm run overlay:check` runs the real card window and hotkeys against a
fake overlay (`src/fake-overlay.ts`) on any OS: 23 checks, all passing on macOS.
It tests our side only; the checklist below is Overwolf's side.
- **Overlay** (`src/game-overlay.ts`, `src/popup-window.ts`): `"overlay"` is in
  `overwolf.packages`; on `game-launched` for Apex it injects, and once the game
  window's size is known the cards go in an overlay window (`squad-cards`:
  `passthrough`, `topMost`, `strictToGameWindow`). Until then, or when injection
  fails, they use the old always-on-top window. Apex is matched as both 21566
  and 215661: the docs disagree on which of `id` and `classId` is GEP's id.
- **Hotkeys** (`src/hotkeys.ts`): F9 hides the card, F10 turns cards off/on for
  the session (a card says which way it went). In the game they are overlay
  hotkeys with `passthrough`; otherwise Electron `globalShortcut`, which keeps the
  key from the game. Re-registered when settings are saved and when the overlay
  enters or leaves the game. Rebindable in Settings → Hotkeys, where a key used
  by the other action is refused. The session's first card carries the reminder
  ("F9 hides a card · F10 turns cards off").
- **Elevated Apex** (run as administrator): after the injection error, if the
  overlay's helper is missing, the title bar says "Cards can't show in the game"
  and Settings → Popups has an Allow button: it installs the helper (UAC prompt)
  and asks the overlay to try the running game again (`requestGameInjection`).
  Never prompted on its own, since UAC would take focus from the game.
- **Title bar status** (`src/game-status.ts`, `src/ui/game-status.ts`): Overwolf's
  `21566_prod.json` every 10 minutes and when Apex starts, plus what the recorder
  and overlay see: "Waiting for Apex Legends", "Recording Apex Legends", "Apex
  game data is off", "Some Apex game data is down", "Not recording: Apex runs as
  administrator", "Cards can't show in the game" (links to Settings).
- **Blocked** like item 1 while Overwolf has Apex's overlay off, except the
  `APEX_OVERLAY_ANY_GAME=1` check below.

Checklist (`npm start`, then read the app's log):
- [ ] `APEX_OVERLAY_ANY_GAME=1` with another overlay-supported game, now: the log
  shows "Overlay: injecting into…" then "Overlay: in <game>"; Settings' test
  button shows the card inside the game; F9/F10 work there and the log says
  "Hotkeys (in game)".
- [ ] Apex: the injection log lines, and which `id`/`classId` the overlay reports
  (then keep only the one that matches, and update overwolf/api-reference.md).
- [ ] Cards show in **fullscreen** Apex at the chosen position, and never take
  focus or the mouse.
- [ ] Positions in **windowed** mode, on a window smaller than the screen: the
  code assumes overlay window bounds are in the game window's coordinates, which
  the docs don't say (`inGameArea` in `src/popup-window.ts`).
- [ ] Overlay hotkeys fire mid-match (one developer's never did) and the key
  still reaches Apex. If they don't fire, use `globalShortcut` in the game too.
- [ ] Without the overlay (Overwolf client closed, or the Apex overlay off): the
  `globalShortcut` fallback, the "taken by another app" log line, and a key
  changed in Settings working at once.
- [ ] Windowed mode: the log line "Overlay: Apex Legends's window is WxH, bounds
  …, screen …" gives the game window's screen position, to compare with where the
  card lands.
- [ ] **Elevated Apex** (run as administrator): the log says the helper is
  missing, the title bar and Settings say so, Allow shows the UAC prompt; No
  leaves the cards in their window, Yes gets them into the running game without
  restarting it. Also GEP's `elevated-privileges-required`: the title bar says
  "Not recording: Apex runs as administrator".
- [ ] Title bar: "Apex Legends found" then "Recording Apex Legends" when Apex
  starts, "Waiting for Apex Legends" after it closes. On macOS too:
  `npm run app:preview` shows the real Overwolf status, so from 2026-09-29 it
  should say "Apex game data is off" (and the log shows the file's state).
  Note what the file says during the disable (`maintenance_msg`,
  `disabled_electron`) in overwolf/gep-and-compliance.md §5.
- [ ] A real match shows the cards at the right moments; then the old window
  can go once the overlay has proven itself.
- Not built, decide after trying it: a "show the last card again" key (TRN uses
  separate show and hide keys), and a hotkey hint on the Overview.

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
- Keep Help's FAQ and "What's new" current with each release (src/ui/views/help.ts).
- **Launch behavior, finish on Windows.** Done on macOS (2026-09-28): tray icon
  with Open / Start with Windows / Quit; closing the window keeps
  recording; a second launch reopens the dashboard; the login item starts with
  `--hidden`. To do on Windows: check the tray icon, left-click and menu; build an
  installed app and test "Start with Windows" (it only works when packaged)
  including a reboot; decide whether anything should open when Apex launches
  (QA flagged an electron app for "no launch events"; opening the dashboard would
  take focus from the game).
- **Terms of Use and Privacy Policy** on public URLs without login; the
  installer must ask users to accept them. Drafts (2026-09-28, not reviewed by a
  lawyer) in [legal/](legal/), checked against the code and
  overwolf/setup-and-release.md §7. To decide before publishing, besides the
  [BRACKETED] placeholders:
  - other players' names and IDs in recordings: get advice on who is the
    controller for data kept only on the user's PC, and what those players are owed;
  - whether release builds ship an apexlegendsstatus key (then every user's EA ID
    goes there under ours) or the lookup stays off;
  - whether uninstalling deletes `%APPDATA%\Apex Squads`;
  - the minimum age (check Apex's rating and EA's account rules);
  - what contact details an individual developer must publish;
  - how long recordings sent with problem reports are kept (they hold other
    players' data).
- **Packaging and signing:** point the builder's `win.icon` at `build/icon.ico`,
  and upload `build/store-icon-55.png` as the store listing's app icon.
  `@overwolf/ow-electron-builder` 26.9.2, the Overwolf
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
- 2026-09-28: the title bar's status (game recording, Overwolf's Apex game data,
  where the cards go), replacing the fixed "Waiting for Apex Legends"; Help's FAQ
  says what it means. Windows parts are in item 3's checklist.
- 2026-09-28: Settings, the rest: a Hotkeys card (item 3) and a Your data card
  (recordings folder, sessions and size, the settings file). No field for the
  apexlegendsstatus key: all it gives is the ranked season's start date. Later,
  with the ads decision: the Privacy section and its consent "Manage" button
  (overwolf/console-and-monetization.md §6).
- 2026-09-28: Overview summarizes the other screens (six highlights: best legend by
  wins and by RP, best teammate, top gun, best map, best loadout) with a compact RP
  chart; promotion bonus RP left out of a match's RP; a Rank column in Matches.
  Check the promotion bonus against the first real promotion (DESIGN.md §5).
- 2026-09-28: app icon "Trio" (build/icon.svg, `npm run icons`) in the tray, window
  and title bar.
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
