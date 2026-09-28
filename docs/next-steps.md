# Next steps

The work queue, in order. Updated 2026-09-28. Take one item at a time; when an
item is done, move it to "Done" with the date and commit. Overwolf facts come
from [overwolf/](overwolf/README.md); decisions and their reasons go in DESIGN.md.

## Now

### 1. Record about 10 ranked matches with `npm start`
The recorder's first milestone (DESIGN.md §8), and the first end-to-end test of
RP from our own recorder.
- Start the app before Apex, with the Overwolf client closed.
- Done when: 10 ranked matches recorded, each with real RP (not the formula's
  estimate) and none left out as incomplete. Check the RP snapshot lines: the
  lobby lookup should now go by EA ID (`accounts.json`).

### 2. Email DevRel the open questions
The list is in [overwolf/README.md](overwolf/README.md#open-questions-ask-devrel-or-check-the-developers-discord), plus:
- Can a friend alpha-test with my Developer Key until I have Console access, or
  should he apply for his own?
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
  reach the game. Proposed defaults (check they don't clash with Apex's):
  - hide the current card now;
  - cards on/off for the session;
  - show the last card again.
  TRN's tracker uses separate show and hide keys; decide after trying it.
- Rebindable in a settings screen (item 5), with a conflict warning.
- Hotkey reminder: shown in the dashboard (settings and a hint on the home
  view), and once in game on the first card of a session ("Ctrl+H hides cards").
- Done when: the keys work mid-match, can be changed and persist, and the
  reminder is visible.

### 5. Settings screen in the dashboard
None exists yet (the sidebar has a placeholder). Holds: hotkeys, cards on/off,
the apexlegendsstatus key (testers won't have ours), where the data is kept.
Later: the Privacy section with the consent "Manage" button that ads require
(overwolf/console-and-monetization.md §6).

## Before the first QA submission
Order within this block is flexible. Submission form: https://wkf.ms/3KL8b1m.
- **Ads decision.** Overwolf: apps without ads "from the beginning" aren't
  prioritised in QA and go-live. If yes: `<owadview/>` containers of the allowed
  sizes, the consent (CMP) flow, and reconsider `disableAdsOptimization()`
  (overwolf/console-and-monetization.md §6).
- **First-time experience, empty states, support, FAQ, release notes** per
  overwolf/product-guidelines.md (its checklist at the end).
- **Launch behavior:** today the app starts from a terminal. Decide the tray
  icon, start with Windows or with Apex, and what closing the window does.
  Overwolf's docs don't cover this.
- **Terms of Use and Privacy Policy** on public URLs without login; the
  installer must ask users to accept them.
- **Packaging and signing:** `@overwolf/ow-electron-builder`, the Overwolf
  installer, and our own code-signing certificate (a real cost; see
  overwolf/setup-and-release.md §6-7). How to sign the first QA build before
  having the Console is an open question for DevRel.
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
- DiscordChatExporter export of the Overwolf developers' server, to answer the
  knowledge base's open questions.
- Small: the "Subscribed to N features" log line counts the features the game
  supports, not our subscription (overwolf/api-reference.md, notes for
  src/main.ts). Log what `setRequiredFeatures` actually did instead.
- `Documents\ApexTracker\gep-log-backup` holds the old Overwolf client logs;
  delete when no longer needed.

## Done
- 2026-09-28: data moved to `%APPDATA%\Apex Squads`; app renamed to Apex
  Squads; Overwolf knowledge base in docs/overwolf/.
- 2026-09-27: Overwolf whitelisting; first match recorded by our own app (Dev
  Mode, no Overwolf client); EA ID remembered between sessions.
