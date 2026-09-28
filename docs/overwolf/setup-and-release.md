# Overwolf ow-electron: Setup, Signing, Testing and Release

Distilled from dev.overwolf.com/ow-electron on 2026-09-28. Check the source URL before relying on anything time-sensitive.

Scope: the "Getting started" pages, the dev-tools guides (dev mode, app signing, installer, package channels, CLI, AI assistants, storage, non-Windows dev), the testing guides, the Overwolf log guides, the changelog (current + archive), support/community pages and the webinars page. Base URL for every source below: `https://dev.overwolf.com/ow-electron/`.

---

## 1. Platform in one paragraph

- ow-electron is "a fork of the Electron.js project, complete with built-in integration with several of Overwolf's services". Closed source ("most of Overwolf Electron's changes will remain closed source").
- White label: "a seamless white-label experience, with no Overwolf branding".
- Marketing claims on the overview page: 1,500+ supported games, "over 45M monthly active gamers" via the Overwolf Appstore, monetization via ads and subscriptions.
- Apps can live as in-game overlays, independent desktop windows, and second-screen views.
- Configuration lives in `package.json` (there is no `manifest.json` like Overwolf Native). Windows are created in your `.js`/`.ts` code, not declared in `package.json`.
- You may "share your app with anyone you like as well as host the app in any location you prefer" (FAQ).
- OS support: the FAQ and the non-Windows page say "Currently only ad services are supported for Mac and Linux. Overwolf services such as overlay, game events, and recording are currently in development." (see Contradictions for the frameworks page wording).

Source: getting-started/overview, getting-started/onboarding-resources/ow-electron-faq, getting-started/onboarding-resources/frameworks-overview

---

## 2. Project roadmap: the four phases

The onboarding journey "consists of four phases and it's important to go through each phase of the program."

| Phase | Page | Gate to leave the phase |
|---|---|---|
| 1 - App Idea to Submission | getting-started/project-roadmap | DevRel approves the app idea (whitelisting) |
| 2 - Develop Your App | getting-started/develop-your-idea | Ready "to submit your app to the DevRel QA team" |
| 3 - Release Your App | getting-started/release-your-app | Initial submission passes QA; Console access granted |
| 4 - Grow Your App | getting-started/grow-your-app | Go-live: QA approval, store listing, ads enabled, Payoneer |

### Phase 1 - App idea to submission (app proposal and whitelisting)

Disclaimer rules (verbatim-ish, keep exact):
- Build on your own code, designs and ideas; avoid copying functionality, UI/UX or branding from other apps; no misinformation/negative reviews/false claims about competitors.
- "For apps with monetization plans, Overwolf won't approve any 3rd party monetization. Overwolf will only approve apps that integrate and use Overwolf ads, Overwolf subscriptions, or both."
- "Using Overwolf APIs requires your app idea to be whitelisted. Whitelisting is only granted to ideas submitted and approved via the App proposal process. Unapproved apps won't have full access to the Overwolf Packages features."
- Apps that haven't been approved "are considered non-compliant or non-approved Overwolf apps."

Steps:
1. **App Ideation** - DevRel gives feedback and classifies the app as Public or Private.
   - Public app: available to everyone from the Overwolf app store; may be monetized with Overwolf ads/subscriptions. "Public apps must have at least one desktop window indicating the app is running."
   - Private app: personal/small-scale/private use, not planned for the Appstore, and/or "a faceless bridge to another service".
   - "Overwolf currently doesn't approve private apps." To proceed, change the idea to public and comply with ToS and the game's policies (public-facing feature descriptions, UI/UX guidelines, monetization plan).
   - "Overwolf won't be able to test or approve apps that only have background processes. You must have at least one window in your app."
   - Unsure public vs private: developers@overwolf.com.
2. **Why OW-Electron** - see the framework comparison (section 4).
3. **Game compliance** - app must not give an unfair advantage and must comply with each supported game's ToS; some studios have extra rules (example given: Riot). Link: guides/game-compliance/overview.
4. **Optional monetization** - ads (must comply with the Advertising Policy) and/or subscriptions. "The level of support you will get from Overwolf depends on whether you plan to monetize your app using our tools." Private/non-public projects "will only be able to receive limited support".
5. **Submit your app idea** - sign in / create an Overwolf account, then fill the form: **https://dev.overwolf.com/app-idea-form**. "The more details you can provide on your form, the easier it will be to have your app approved".

After approval: Discord community (https://discord.gg/overwolf-developers) for dev discussion, support, SDK issue reports and feature requests.

Source: getting-started/project-roadmap

### Phase 2 - Develop your app

- After approval "You should have received an email from your DevRel that includes links to help you develop your app and outline the next phases".
- "After your app idea has been approved and your account is whitelisted, you gain access to Overwolf's development tools."
- To run gaming packages (GEP, Overlay, Recorder) locally before signing: Dev Mode (section 5).
- Install the three npm packages (section 4).
- Product guidelines highlighted: hotkeys (intuitive defaults, rebindable in settings, non-intrusive feedback); second screen ("30% of users having multiple monitors"); responsive layouts (apps aren't always full screen); plan ad integration early; personalization; Electron autoUpdater (developers-console/releases-management/release-management#setting-up-electron-auto-updates).
- Phase ends when you are ready to "pre-test and submit the first version of your app for review and QA by the DevRel team".

Source: getting-started/develop-your-idea

### Phase 3 and 4

Covered in sections 11-13 below.

---

## 3. Building your first app (sample app, package.json, App UID)

Prerequisites: Node.js 18 or higher; npm or Yarn; an IDE; `@overwolf/ow-electron`; the sample app. "Make sure that all your prerequisites are configured and installed globally."

Sample app: https://github.com/overwolf/ow-electron-packages-sample (main process, renderer process, Overwolf services).

Commands:
- Install: `npm install` / `yarn`
- Dev run: `npm run build` then `npm run start` (Windows: command line "with administrator privileges"; after build you can press F5 using the included `.vscode/launch.json`).
- Production build: `npm run build` then `npm run build:ow-electron`.

Packages are selected in `package.json`:
```
"overwolf": { "packages": ["gep", "overlay"] }
```
Available: `gep` (live game data), `overlay`, `recorder` ("currently in beta" on this page).

### Unique App ID (App UID)

- Every Overwolf app has a unique app id, "automatically generated, and is based on the app's name, and the app's author's name."
- App name = `productName` (defaults to `name` if missing). App author = `author.name`. `build.productName` (the builder field) is "unrelated".
- "You can't use an app name that contains the word `bot`" (ad partners may flag/block it).
- App ids are used for ads optimization and for the optional app usage analytics in the Console.
- Read it at runtime (only exists once the app is ready):
```
app.whenReady().then(() => { const appID = process.env.OVERWOLF_APP_UID; });
```
- Also: `overwolf.uid` (app UID), `overwolf.muid` (machine UID), `overwolf.phasePercent` exposed on the public Overwolf API since ow-electron 39.8.10 (changelog).
- CLI: `ow client calc-uid` "calculates an app's UID using its name and author."
- Pre-submission and testing checklists: keep `Product Name` (or Name) and `Author` in the `package.json` inside `app.asar` consistent across all versions.

Monetization testing: run the sample app with `--test-ad` to enable Overwolf's test ad.

App usage analytics: on by default. Opt out of full collection with `app.overwolf.disableAnonymousAnalytics()`; collection is then reduced "to the mandatory minimum (limited to essential, non-identifying events such as app launch and basic session signals)". Governed by Overwolf's privacy policy.

Source: getting-started/onboarding-resources/first-app, guides/dev-tools/ow-cli, getting-started/changelog/ow-changelog

---

## 4. Technical overview and frameworks comparison

### npm packages

| Package | Based on | Purpose |
|---|---|---|
| `@overwolf/ow-electron` | `electron` | Runtime, adds Overwolf features |
| `@overwolf/ow-electron-builder` | `electron-builder` | Builds (and, since 26.9.0, Overwolf-signs) ow-electron apps |
| `@overwolf/electron-is-overwolf` | like `electron-is-dev` | Detect whether running as ow-electron or plain electron |
| `@overwolf/ow-electron-packages-types` | - | Type definitions for the gaming packages (archive changelog 22.3.13). Changelog requires `1.1.5-2`+ (ow-electron 39.8.10) and `1.1.6`+ (overlay 2.0.5 features) |

You can run ow-electron and plain Electron side by side in one project (upstream compatibility "for specific versions") and use `electron-is-overwolf` to tell them apart / disable Overwolf features for "vanilla" builds.

### How the Overwolf packages are downloaded and loaded

- The gaming packages (GEP, Overlay, Recorder) are not bundled in your app; they are managed by the Overwolf Electron Package Manager (`owepm`), added in ow-electron 22.3.13 (archive).
- FAQ "How are packages updated?": "Every few hours your app will check for a new version of the packages. If a package is found to be outdated, then the latest one will be downloaded. Installation of the package occurs when the app is started." Check with `app.overwolf.packages.hasPendingUpdates()` (added 31.4.0; returns whether an update is pending, which package, what version).
- "When a new package is installed, the previous version of the same package is deleted."
- "Yes, you app will need to restart in order for the package to update." Archive note: restart "only when the app is in 'idle' mode and is not currently in-game."
- Package versions can be published as staged (phased) rollouts; which version a machine gets is decided from the machine identifier (package-channels page).
- Loading requires authentication: in dev mode via dev credentials (section 5); in distributed builds via Overwolf signing + your own exe code signature (section 6).
- ow-electron-builder 23.6.0 (archive): "Core Overwolf utilities will now be automatically included in the built executable."
- GEP support for games "must be enabled on a per-app basis. For more details, contact us." (frameworks-overview).

### Other features on the technical overview page

- `<owadview/>` tag (based on `<webview/>`): place it, no attributes required, inside a `<div>` sized to a standard IAB ad unit.
- Built-in CMP (Consent Management Platform): check whether the user must be shown the CMP, and show it.
- Distribution resources: CDN (free hosting of release files, managed via the Console), Custom Installer (with CMP intro flow), Updater Endpoint (an electron-updater endpoint).
- Code signing: "With ow-electron you will need to provide your own code signing certificate from a trusted Certificate Authority (e.g., DigiCert, Sectigo, etc.)."

### Frameworks comparison (Native vs Electron)

Both: web-dev approach, Overwolf Ads stack (GDPR compliant), app usage analytics, in-game overlay, live game events on Windows, deployment/distribution with customizable installer.

Table values as scraped (the column headers were lost in conversion; the page lists Native first and Electron second in its text, so the first value is presumably Native - unverified):

| Row | Value 1 | Value 2 |
|---|---|---|
| CPU idle | 0.2% | 0.1% |
| CPU avg window interaction | 3% | 0.5% |
| RAM peak | 420 MB | 380 MB |
| Running processes | 9 | 7 |
| Installer | Yes | Optional |
| Coupled with Overwolf Client | Yes | No |
| Ads revshare | 70/30 | 70/30 |
| App Subscriptions API revshare | 85/15 | 85/15 |

All growth/support/tech rows (analytics, marketing, funding, dev support, Appstore presence, own branding, overlay SDK, realtime game events, ad-fraud protection, Dev Console) are "Yes" for both.

Electron specifics: direct fork of Electron.js; full native node module support; Windows, macOS (partial), Linux (partial); installed as-is and runs on its own; package features/bugfixes shipped as package versions "with updating/rollout schedules left entirely up to the app's discretion"; "App specific code certificates are not provided, and are highly recommended for proper app distribution" (now outdated, see section 6). Native: CEF wrapper, `manifest.json`, needs no app-specific certificate, Windows only.

Revenue: FAQ says no difference in how the platforms generate revenue, but monetization policies differ per platform.

Source: getting-started/onboarding-resources/ow-electron-technical-overview, getting-started/onboarding-resources/frameworks-overview, getting-started/onboarding-resources/ow-electron-faq, support/changelog-archive/ow-changelog

---

## 5. Dev Mode (running GEP/Overlay/Recorder before signing)

| Property | Value |
|---|---|
| Minimum version | `ow-electron-builder@26.9.0` and `ow-electron@39.8.10` |
| Platform | Windows |
| When | Local development, before the app is signed or packaged |
| Credentials | "An Overwolf Console account with an API key, or an Overwolf developer account with Approved developer status." |

What it is:
- "Dev mode is a path in the package manager (`owepm`) that skips most production integrity checks."
- "Dev mode can't activate on a distributed or packaged app. If any condition is false, the app routes to the production validation path, where a missing or invalid signature stops gaming packages from loading." (The page does not list the conditions.)
- "Even in dev mode, you authenticate with Overwolf before gaming packages load."
- "If `OW_CLI_EMAIL`, `OW_CLI_API_KEY`, or `OW_DEV_KEY` are all absent, dev mode credential verification fails and gaming packages don't load. The app itself still runs."
- With valid credentials a dev-mode build runs the full set: GEP, Overlay, Recorder.

Credential variables:

| Variable | Purpose | Where to get it |
|---|---|---|
| `OW_CLI_EMAIL` | Dev mode credential check | Your Overwolf Console account email |
| `OW_CLI_API_KEY` | Dev mode credential check | Overwolf Console, Profile > API Keys |
| `OW_DEV_KEY` | Alternative; "Replaces `OW_CLI_EMAIL` and `OW_CLI_API_KEY` for runtime verification" | https://dev.overwolf.com/profile once Developer status is Approved |

Options (all set environment variables on the launched process):
- **Option A - shell env vars** (recommended for CI and most workflows). PowerShell: `$env:OW_CLI_EMAIL = '...'`, `$env:OW_CLI_API_KEY = '...'`. "Use single quotes in PowerShell so it doesn't interpret the `$` characters in the key." Launch with `yarn start` / `npm start`. The VS Code F5 debugger does not inherit the terminal environment.
- **Option B - `"env"` block in VS Code `launch.json`** debug configuration (same keys). Other IDEs: set them in the run/debug configuration. Also: replace any `--owepm-packages-url` launch arg with `--owepm-package-channel=gep:dev,overlay:dev` (section 8).
- **Option C - `OW_DEV_KEY`**:
  1. Submit the app idea; DevRel reviews manually; on approval you get an email and profile Developer status changes Pending -> Approved.
  2. Log in at https://dev.overwolf.com/login, open https://dev.overwolf.com/profile, confirm Approved.
  3. Under "Developer Key": no key yet -> "Generate key". Renewing -> "Extend". "Extend stays disabled until you're close to the key's expiry. The text under the button tells you exactly when it unlocks."
  4. Key is masked; eye icon reveals, copy icon copies. Set it as `OW_DEV_KEY` (`$env:OW_DEV_KEY = '<your-dev-token>'`, or `"env": { "OW_DEV_KEY": "<your-dev-token>" }`).
  - "`OW_DEV_KEY` is equivalent to `OW_CLI_EMAIL:OW_CLI_API_KEY` for dev mode verification. It uses `Bearer` authentication instead of `Key`."
  - Changelog (Documentation, Aug 2026): the dev.overwolf.com login/profile lets you "generate your own Developer Key for Dev Mode instead of waiting for Overwolf to issue one".

Precedence: "Environment variables take precedence over `OW_DEV_KEY`." Order given:
```
OW_CLI_EMAIL env var (highest)
  -> OW_CLI_API_KEY env var
    -> OW_DEV_KEY env var (alternative path, not combined with the above)
```

Expiry: the Developer Key expires (hence "Extend"), but the actual lifetime is not stated anywhere.

Source: guides/dev-tools/dev-mode, getting-started/changelog/ow-changelog

---

## 6. App signing for production

| Property | Value |
|---|---|
| Minimum version | `ow-electron-builder@26.9.0` and `ow-electron@39.8.10` |
| Platform | Windows |
| Your certificate | "A code-signing certificate for your `exe` (your own certificate, not Overwolf's)" |

Key warning (verbatim): "Code-signing your `exe` with your own certificate is now required (previously optional). Overwolf signs the gaming package integrity and you sign the `exe`. Without both, the gaming packages (GEP, Overlay, Recorder) will not load at runtime."

Two signatures, therefore:
1. **Overwolf signing** - done by `ow-electron-builder` against Overwolf's signing server using your Console credentials. Changelog 39.8.10: "the build signs the app and embeds a verification binary". Changelog builder 26.9.0: "when `OW_CLI_EMAIL`, `OW_CLI_API_KEY`, and `OW_BUILD_KEY` are set, the builder signs the app during packaging. Builds without these credentials still complete, but are unsigned (with a warning) and the Overwolf package manager won't load packages from an unsigned app."
2. **Your Authenticode signature on the exe** - from a trusted CA (DigiCert, Sectigo, etc.). Release page: "Without a signed `exe`, the gaming packages (GEP, Overlay, Recorder) do not load at runtime in a distributed build, and Windows warns users when they install your app."

Signing variables:

| Variable | Purpose | Where |
|---|---|---|
| `OW_CLI_EMAIL` | Signing server authentication | Console account email |
| `OW_CLI_API_KEY` | Signing server authentication | Console, Profile > API Keys |
| `OW_BUILD_KEY` | Signing server authentication for the build step | Console, **Release management > App Keys** |

Prerequisites:
- "A registered app in the Overwolf Console with an assigned App UID."
- Valid `OW_CLI_EMAIL` / `OW_CLI_API_KEY` "for an account that owns the app".
- `OW_BUILD_KEY` from the Console.
- Your own exe code-signing certificate.
- `@overwolf/ow-electron-builder` installed.

Steps:
1. Export the three variables, or put them in a `.env` at project root:
   ```
   OW_CLI_EMAIL="your-email@example.com"
   OW_CLI_API_KEY="your-api-key"
   OW_BUILD_KEY="your-build-key"
   ```
   Wire dotenv into the build script, either
   `"build:ow-electron": "dotenv --override --no-expand -- ow-electron-builder --publish=never"` (`--no-expand` stops `$` in the API key being expanded; `--override` makes `.env` win over shell vars), or
   `"build:ow-electron": "node -r dotenv/config ./node_modules/.bin/ow-electron-builder --publish=never"` (`dotenv/config` does not expand `$` by default - "Confirm this against your own `dotenv` version").
2. Build and sign: `npx @overwolf/ow-electron-builder`.

Related builder behavior (changelog 26.9.0): "ASAR integrity validation enabled by default on Windows - the `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` Electron fuses are now `true` for all Windows builds and cannot be changed. Electron validates the ASAR hash at startup and will not load app code from outside the archive."

Not documented: how to configure the Authenticode certificate in ow-electron-builder (no config keys given; presumably standard electron-builder Windows signing, but the docs don't say), and which builder config (`build` section) is required beyond the defaults.

Source: guides/dev-tools/app-signing, getting-started/release-your-app, getting-started/onboarding-resources/ow-electron-technical-overview, getting-started/onboarding-resources/ow-electron-faq, getting-started/changelog/ow-changelog

---

## 7. The Overwolf installer (custom vs your own)

Choice: "you can choose the installer for your app between traditional Electron installer packages or the Overwolf Installer." Frameworks table marks the installer as "Optional" for one of the frameworks (presumably Electron).

Overwolf Installer advantages (as listed):
- Appstore listing always provides the latest version; downloads via Overwolf's CDN.
- Includes the initial CMP pop-up ("so that you only need CMP settings in your app") and a full CMP flow for European users.
- User acknowledges and accepts Overwolf's ToS (https://legal.overwolf.com/docs/overwolf/website/terms-of-use).
- Includes CRN from other apps.
- "No additional code signing needed for the installer."
- Customizable: target install directory, custom images, custom branding.
- **"Using the Overwolf installer is the only way to access and test different versions in the Developers Console testing Channels."**
- Windows only.
- Decoupled from your app; Overwolf maintains dependencies, UI/UX, security fixes, anti-virus issues, minimum system requirement changes.
- Minimal file: it does not contain your app files; it fetches the latest version from the CDN.
- UTM tracking shown in the Console dashboard: `utm_source` (required), `utm_medium`, `utm_campaign`.
- Builder 24.7.0 (archive): check that an app cannot be installed twice on the same machine (Overwolf pre-built installer only).

How to use: "If you are interested in using the Overwolf Installer for your Electron app, contact your DevRel for specific details."

Customizable assets:
- App icon (installer `.exe` icon): `.ico` with 16x16, 32x32, 48x48, 256x256. Taken from the App icon uploaded in Console Store listing.
- App Splash Image (welcome screen): `.png`, 144x144px, transparent background optional.
- App Promotion Image (while downloading): `.png`, transparent background, 521x145px.
- Installation location: custom path - "Contact your DevRel to enable".

Legal and compliance requirements:
- Terms of Use URL (public page describing your app's terms) and Privacy Policy URL (public, covering data collection and usage).
- URLs must be hosted on a stable, publicly reachable domain; accessible without authentication; in English (or include an English version).
- Release checklist wording: "your installer should ask users to accept a Terms of Use or a Privacy Policy. These documents MUST be accessible through valid, publicly available, URLs as part of your submission. The URLs MUST not require login and should accurately describe data collection, storage, and usage."

Source: guides/dev-tools/overwolf-installer, getting-started/release-your-app, getting-started/onboarding-resources/frameworks-overview, support/changelog-archive/ow-changelog

---

## 8. Package channels (dev/QA builds of GEP, Overlay, Recorder)

- Minimum version on the page: `ow-electron@38.9.12` (changelog says the feature arrived in 39.8.12 - see Contradictions). Windows.
- Replaces `--owepm-packages-url=https://electronapi-qa.overwolf.com/v2/packages`: "`--owepm-packages-url` is no longer required." Channels are fetched "from the same production endpoint".

CLI override at launch:
```
my-app.exe --owepm-package-channel=gep:dev
my-app.exe --owepm-package-channel=gep:dev,overlay:dev
```
- Since `ow-electron@42.7.1` the override "applies to a single run only and is never stored". An invalid channel name drops the override for that run.
- Before 42.7.1 it was persisted (same `localStorage` preference as `setChannel()`), and stays stored on machines that used it. Clear once with `await app.overwolf.packages.setChannel('<package>', 'public')` or delete the `owepm.package-channels` key.

Staged rollout forcing:
```
my-app.exe --force-phased-package            (every package)
my-app.exe --force-phased-package=overlay,gep
```
"This switch is for local testing only. Never ship a build that carries it to your users." Added in 39.8.13; combinable with channels.

API on `app.overwolf.packages` (cast to `IOverwolfPackageApi` from `ow-electron-package-manager/src/browser/api/overwolf-package-api.interface`):
- `setChannel(packageName, channel?, ready?) : Promise<SetChannelResult>` - persists in `localStorage`, downloads immediately (can downgrade), `ready(packageInfo)` fires when download completes; restart required (`api.relaunch()` / `app.relaunch()`). Resolves when the preference is stored and download starts, not when it finishes. If already on that channel version, `ready` never fires.
- `'public'`, `''`, `undefined` or omitted all clear the stored channel.
- Errors: `{success:false, error:'invalid-package'}` (not on server), `'invalid-channel'` (channel doesn't exist); throws if the package isn't in `package.json` `overwolf.packages`.
- `getChannel(...names)` -> `Record<string,string>`, `'public'` default; unknown names silently omitted; includes stored non-public channels even for unlisted packages.
- `getAvailableChannels(...names)` -> `Record<string,string[]>` (example `{ overlay: ['dev','beta'], gep: ['dev'] }`); throws for unregistered names.
- Or listen for `PackageUpdatePending`.
- Stale channel auto-recovery: if a stored channel is deleted server-side, falls back to public on the next update check.

Source: guides/dev-tools/package-channels, getting-started/changelog/ow-changelog

---

## 9. Overwolf CLI (`@overwolf/ow-cli`)

- "The Overwolf CLI is only used if you have apps that are distributed using the Overwolf App Store."
- Install: `npm i -g @overwolf/ow-cli`. Help: `ow help`.
- Credentials = Console email + API key, via `ow config` (stored locally in the user's root folder; `ow dev config` deprecated) or env vars `OW_CLI_EMAIL` / `OW_CLI_API_KEY` (not stored).
- API key: Console left menu `Settings => Profile`, "revoke and regenerate". "Revoking your API key means that the previous key will stop working immediately. There is no option to recover your API key."
- Commands: `config`; `client calc-uid`; `electron upload` (uploads a setup exe; needs app id and permissions; can target a test channel; `-w/--wait` waits for processing; prints version ID); `versions release -p <percent>`; `versions promote-to-prod -aid <appID> -sc <test-channel> -v <version>` (creates a draft in production); `versions halt` / `versions resume` / `versions discard` (by version ID or `-vid`); `versions release-notes` / `rn` with `-rn <file>`, `-in <file>` (internal notes), `-imp` (important), `-pub` (publish; otherwise draft).
- Pipeline example: `ow electron upload ./path/to/your/version.exe -aid <appId> -w | xargs ow versions release -p 25`.
- Test channel ID: found in the channel page URL in the Dev Console.
- Can be used from Node (`OwCliContainer.init()`, `OwCliContainer.resolve(SignAppCommand)`).

Source: guides/dev-tools/ow-cli

---

## 10. Testing your app (Overwolf's checklist)

"Once you submitted your app, the Overwolf team will review and test it. This applied to both first time submissions and app updates."

Checklist on the testing page (this is what QA can be expected to exercise):
- **Consistent UID**: Product Name (or Name) and Author in `package.json` inside `app.asar` consistent across versions.
- **DevTools**: `webPreferences: {devTools: true}` -> Ctrl+Shift+I. For an exe: `--remote-debugging-port=9222`, open http://localhost:9222/. Script: `"start": "ow-electron --remote-debugging-port=9222"`.
- **Resolution**: start at DPI 100% and 1920x1080; then check the window stays on screen at 1366x720@100, 1366x768@100, 1920x1080@125, 2560x1440@100, 3840x2160@150.
- **Window states**: game full screen and windowed.
- **Out of focus**: overlays only in-game when the game is in focus; after Alt+Tab or minimize "no app window should appear" on the desktop; Alt+Tab back works.
- **Overlay in-game**: hotkey opens overlay properly; features work; clicks on the app never pass through to game UI underneath.
- **Hotkeys**: launch/minimize with hotkey; change hotkey, change appears in settings and works without relaunch; settings panel lets the user change the combination.
- **Mid-game install**: uninstall, install while in-game, then repeat hotkey tests; hotkey changes update both functionality and UI.
- **Desktop**: window appears in "about 10 seconds or less" (a loader is acceptable); on close, all windows and all app processes close; relaunch works.
- **Game-specific apps**: runs when the supported game launches and doesn't launch for other games.
- **Performance**: no hang/lag; memory should rise and fall (else possible leak); watch Task Manager for CPU/memory/network spikes.
- **Internet**: launches offline; shows a "check your internet connection" type message; tell users the app needs internet (`navigator.onLine`).
- **Ads**: enable test ads (console command from the owadview reference, or `localStorage.owAdTestAd = true` then F5, or run the exe with `--remote-debugging-port=9222 --test-ad`); ads visible in designated places; elements hiding ads must not open ads; clicking an ad opens a browser; click an ad 5 times -> 5 browser windows without crashing or hurting performance; no ad processes when no ads are shown; ads close when the window is minimized/closed (no ad processes left in localhost).
- **Pre-release virus scan**: "Before sending any opk file for approval, check that it is virus free. Use virustotal.com to check for potential issues. Any OPK which virustotal has warnings for will not be tested." (https://www.virustotal.com/gui/home/upload)

Non-Windows development: develop anywhere, but test in a Windows VM with GPU passthrough (e.g. QEMU/KVM) and internet access. "The Overwolf client and Overwolf Electron apps will only run on Windows based systems."

Overwolf logs pages (Trace, OBS, Overlay game HTML, OverwolfPerf, DxDiag): these describe Overwolf **client** logs (paths like `C:\Program Files (x86)\Overwolf\`, `.Game.html` injection logs, OBS recording logs, HAGS checks, driver checks, DxDiag via Win+R `dxdiag` > "Save all information"). Several links point to ow-native pages. Useful for support triage; they do not document ow-electron app log locations.

Source: guides/test-your-app/how-to-test-your-app, guides/dev-tools/non-windows-dev, guides/test-your-app/ow-logs/understanding-ow-logs, guides/test-your-app/ow-logs/trace, guides/test-your-app/ow-logs/obs, guides/test-your-app/ow-logs/overlay-game-html, guides/test-your-app/ow-logs/overwolfperf, guides/test-your-app/ow-logs/dxdiag

---

## 11. Submission (Phase 3)

Pre-submission checklist (Phase 3 page, each item):
1. Consistent naming (`Product Name`/Name and `Author` in `package.json` in `app.asar`).
2. Digital code signatures - "code signing is required"; sign your `exe` with a trusted-CA certificate (section 6).
3. Custom installer - Overwolf installer or your own (section 7).
4. CMP - review the CMP docs and "confirm CMP integration into your app".
5. GEP supported environments - support one or more games on the Electron games support list (live-game-data-gep/supported-environment) and read the GEP notes.
6. App Store visibility - if listing, prepare store assets.
7. Install the latest OW Electron version (recommended).
8. Monetization - design for it "even if at first you are not planning to monetize your app".
9. Game compliance.
10. Legal compliance - ToU/Privacy Policy public URLs, no login, accurate (section 7).
11. User experience; 12. FTUE; 13. Advertising compliance (placements follow the advertising policy and size requirements); 14. Hotkey reminder accessible in settings or game window; 15. Resolution and compatibility; 16. Second screen support.

Submitting:
- "Submit your app to the DevRel QA team for review by uploading your latest build and filling out the necessary details in the Developer Console."
- Submission form link on the same page: **https://wkf.ms/3KL8b1m** ("Use this submission form.").
- Whitelisting required (only approved app ideas).
- Must have at least one desktop window indicating the app is running; follow Front app and FTUE guidelines.
- The docs do not list the form's fields (what to include beyond "your latest build" and "the necessary details").

Store assets (prepare-your-assets page):
- Appstore tile: JPG 258x198 at 72PPI.
- Icon: PNG 55x55, must look good on dark and bright backgrounds.
- Hero image: JPG (72PPI) or WebP, 258x198 px (as stated).
- Creator title image: PNG or WebP 400x320 px.
- Screenshots: 1 to 5, JPG, 1200x750, max 100Kb each - but the note says 1200x750 "is no longer supported" and 1200x675 is "newly supported".
- Description: markdown, max 2000 characters including spaces.

Source: getting-started/release-your-app, getting-started/onboarding-resources/prepare-your-assets

---

## 12. QA review, Developer Console access, testing channels

QA:
- "After submitting, your app will go through an initial QA cycle. Expect feedback on necessary adjustments, covering aspects like functionality, design, and compliance."
- Duration: "the QA cycle includes initial testing, feedback, and retesting as needed to meet MVP standards." No time figure. FAQ: time "can vary on a number of different factors"; prepare using the pre-submission checklist and FTUE guidelines; contact Overwolf if it takes long.
- "the QA team will send you a checklist of identified issues to address in order to complete the release process."
- Virus scan gate: any build with VirusTotal warnings "will not be tested".

Developer Console access timing:
- Phase 3: "After the initial submission passes the QA team, Overwolf will grant you access to the developer console." Same page also: "Access and Permissions: after submission, you'll gain access to the Developer Console."
- Prepare-your-assets: "After submitting your OPK to the store for the first time, you should get access to the Overwolf Developer's Console (https://console.overwolf.com)."
- Console features: team permissions (https://console.overwolf.com/#/permissions/users-permissions), Release Management with **Production and Testing Channels** ("upload builds to either for app release, or to the testing channel so that you can test your app in the real world"), Store Listing, Game Stats, Performance Stats (DAU/installs/retention, post-launch), Revenue Stats (once ads are live).
- FAQ: your Electron app is "a new instance in the dev console".

Testing channels / beta:
- Testing channels live in the Console (releases-management/testing, not in this page set).
- "Using the Overwolf installer is the only way to access and test different versions in the Developers Console testing Channels."
- CLI supports uploading to and releasing in test channels and `promote-to-prod`.
- Alternatively, since you may host/share the app anywhere (FAQ), a self-distributed build is possible; gaming packages still only load if both signatures are present.

Source: getting-started/release-your-app, getting-started/onboarding-resources/prepare-your-assets, getting-started/onboarding-resources/ow-electron-faq, guides/dev-tools/overwolf-installer, guides/dev-tools/ow-cli

---

## 13. Go-live and growth (Phase 4)

- QA approval: "before going live, ensure your app's release candidate version is QA approved. This includes verifying that ads are correctly enabled and functional."
- "Go live process - complete the QA review, finalize your store listing, enable ads, and complete Payoneer registration."
- "Ads enablement - the revenue and QA teams will verify and enable ads for your app."
- Payoneer: wait for DevRel's message with registration instructions.
- Keep updating (bugs, features, more games).
- Overwolf promotion eligibility: generally "500+ DAU, 50% second-week retention for four weeks, a store rating of 4, and some form of monetization (e.g., ads or subscriptions)". "Overwolf may approve or decline ANY promotion request". Methods: CRN (pop-up when users launch another app), CRI (pop-up during Overwolf client install), App Carousel (web storefront).
- Paid campaigns: fully managed min $15K/month for 3+ months; partnership campaigns where Overwolf contributes 30-50%.

Source: getting-started/grow-your-app

---

## 14. Changelog summary

The current changelog keeps only 6 months; older entries are in the archive. Tabs: Overwolf Electron (Electron general, Electron builder, Overlay package, Recorder package), GEP, Developer's Console, Documentation Updates. The Electron general and builder entries carry no dates on the page.

### ow-electron (runtime) - undated, newest first
- **42.7.1** - Electron 42.7.1. `app.overwolf.setExternalPaymentUserId({ providerName, userId, paymentId })` (default provider Tebex). Runtime updates to `<owadview>` `customTracking`. Local-time log timestamps `YYYY-MM-DD HH:MM:SS.mmm`. Smaller package-manager memory. Fixes: package manager with `app.enableSandbox()`; mouse events to `<owadview>` in overlay windows; `--owepm-package-channel` no longer persists. Check Electron breaking changes 40/41/42.
- **39.8.13** - `--force-phased-package`. Fix: packages failed to load due to third-party hooks.
- **39.8.12** - `--owepm-package-channel` and Package Channels API (`setChannel/getChannel/getAvailableChannels`). Fixes: "package manager service destroyed" error; pending update not fully extracted.
- **39.8.10** - **Gaming-package security**: exe code signing required for GEP/Overlay/Recorder in distributed builds; App Signing (`OW_BUILD_KEY`, Console > Release management > App Keys; unsigned build completes with a warning); **Dev Mode** introduced. `overwolf.muid`, `overwolf.uid`, `overwolf.phasePercent`. `<owadview customTracking='{...}'>`. `sendInputEvent` `code`/`key`. Breaking: GEP package interfaces removed from `ow-electron.d.ts`; requires `@overwolf/ow-electron-packages-types` `1.1.5-2`+.
- **39.6.0** - AdView validation/viewability improvements; GEP game-detected event supports `async` callbacks; AdView memory leak fix; in-game window resize fix. Electron breaking changes 38/39.
- **37.10.3**, **37.7.0** (crashReporter excludes AdView process), **37.2.6**, **34.5.5** (AdView visibility with `window.hide()`), **34.4.1** (`name` option on `BrowserWindow`, normalized), **34.3.3** (Electron breaking change: a `databases` dir in `userData` is deleted on first run).

### ow-electron-builder - undated
- **26.9.0** - automatic Overwolf signing when `OW_CLI_EMAIL`, `OW_CLI_API_KEY`, `OW_BUILD_KEY` are set; unsigned otherwise and packages won't load. ASAR integrity fuses forced on for Windows.
- **26.8.5** - LF line endings for Linux templates; quote fix for `/d=` install path.
- **26.0.12** - fix: CMP settings reset after update/reinstall. **26.0.11** - electron-builder 26.0.11.

### Overlay package (dated)
- Aug 2026: **2.0.9** (first public release of 2.0.5 features; `handleTransportBlocked` reason; fixes incl. overlay invisible when app or game ran as admin; LoL resize; dpiAware on ow-electron 42; ARC Raiders shared texture - "run your app without administrator rights to keep `useSharedTexture` active"). **2.0.5** (dev build only): `disableHardwareAcceleration`, BETA `useSharedTexture`, `isSharedTextureSupported/Available`, `setGpuPreference/getGpuPreference`, `shared-texture-unavailable`; needs packages-types `1.1.6`+.
- Jun 2026: 1.13.21, 1.13.19, **1.13.18** (`takeScreenshot()`), **1.13.12** (OOPO fullscreen, admin-game injection via `isHighElevationHelperInstalled()`/`installHighElevationHelper()`, W3C keycodes for hotkeys; OSR key layout change "Requires the host to ship Electron 39.6.2 or higher").
- Apr 2026: 1.12.5 (stuck-input fixes), 1.11.6. Mar 2026: 1.10.14. Jan 2026: 1.10.7, 1.10.2.
- 2025: Dec 1.9.12; Nov 1.9.0 (async events, `StrictToGameWindow`, `requestGameInjection`); Oct 1.8.44, 1.8.39; Sep 1.8.32, 1.8.21; Aug 1.8.14; Jul 1.8.7 (OOPO support). Archive: Jun 2025 1.7.2 (IME, `dpiAware` beta), May 2025 1.5.18.
- FAQ note relevant to overlay/admin: "Apps that run with admin privileges can't inject into non-admin running games."

### Recorder package (dated)
- Aug 2026: 0.32.54 (`hostMode: 'dll'`, encoder min/max/step), 0.32.52 (capture elevated games; `ElevationHelperMissing` `-996`). Jul 2026: 0.32.46. Jun 2026: 0.32.44, 0.32.37. May 2026: 0.32.35 (up to 8K HEVC). Apr 2026: 0.32.33. Jan 2026: 0.32.25. 2025: Dec 0.32.20, Oct 0.32.12/0.32.11/0.32.10, Sep 0.32.7; archive Aug 2025 0.32.4.

### GEP - Apex Legends entries only (other games omitted)
| Version | Date header | Apex change |
|---|---|---|
| 312.5.3 | Sep 2026 | Fixed `game_mode` Info Update |
| 312.5.1 | Sep 2026 | New `player_stats` and `ring` Info Updates |
| 312.3.3 | Sep 2026 | "Added a second action parameter to the `kill_feed` Info Update" |
| 311.2.0 | Aug 2026 | Fixed `match_start` when requeuing in ranked mode |
| 309.0.4 | Jul 2026 | Fixed the L-Star rifle in `weapons` |
| 307.4.7 | Jun 2026 | Fixed `weapons` Info Update |
| 307.4.6 | Jun 2026 | Fixed events |
| 298.3.1 | Feb 2026 | Fixed broken events |
| 294.1.9 | Jan 2026 (also listed under Dec 2025) | Fixed events; `damage` and `totalDamageDealt` still WIP |
| 294.1.5 | Dec 2025 | Fixed `match_start` |
| 289.0.2 | Oct 2025 | Fixed `damage` and `totalDamageDealt` |
| 288.1.11 | Oct 2025 | Fixed `weapons` and `inUse` |
| 288.1.3 | Sep 2025 | Fixed `damage` and `totalDamageDealt` |
| 287.0.7 | Sep 2025 | Fixed events; new game mode `Ranked`; new map `Kings Canyon`; `platform_id`, `origin_id` in roster, `tabs` and `kills` still WIP |
| 285.0.8 | Aug 2025 | Fixed E-District map P2020 and RE-45 weapons |
| 284.0.7 | Aug 2025 | Fixed events; game mode `Wildcard`; map `Kings Canyon Wildcard` |
| 284.0.4 | Jul 2025 | Fixed `match_summary` |
| 283.0.2 | Jul 2025 | Fixed events |
| 281.0.3 | Jun 2025 (archive) | Reset logic for `match_summary` |
| 278.1.1 | Jun 2025 (archive) | New map `Storm Point` |
| 277.0.2 | Jun 2025 (archive) | Fixed `knockdown` event |

Other GEP notes: 296.1.2 (Jan 2026) "GEP general - Fixed some issues with game detection". 300.1.1 (Mar 2026) Valorant: fixed running Electron and Overwolf in parallel. GEP versions are frequent (several per month); events are often "temporarily disabled" during fixes.

### Developer's Console (dated)
- Sep 2026: CLI `versions halt`/`resume`/`discard`/`release-notes`.
- Aug 2026: Monetized users ratio widget (Native only, Electron "coming soon").
- Jul 2026: House ads WebP/GIF; 400x600 house ad size deprecated.
- Jun 2026: App Crashes endpoint removed from Performance APIs.
- Feb 2026: Revenue Statistics API; House ads by geography.
- Jan 2026: halt a rollout even at 99%, resume after halting at 100%.
- Dec 2025: All Apps Performance dashboard; Performance APIs. Aug 2025: changelog/roadmap links in nav.

### Documentation updates (dated)
- Sep 2026: 970x90 ad container size.
- Aug 2026: Window `name` guide; **Developer login and profile on dev.overwolf.com** (self-service Developer Key after approval).
- Jul 2026: Influencer marketing guide; Gamer Grid guide.
- Jun 2026: **App Signing and Dev Mode guides** ("Code-signing your `exe` with your own certificate is now required"); AI coding tools (MCP); second screen guide update.
- May 2026: Uninstall survey guide. Feb 2026: subscriptions pages; revenue API; house ads by geo. Jan 2026: Tebex subscription selection guide.
- 2025: Dec all-apps dashboard; Nov testing guide, high impact ads, subscriptions guide; Oct Console Affiliations (UTM links); Sep product-guideline pages (hotkeys, second screen, in-game overlays); Jun Console docs reorganized (incl. "Manage testing channels"); May Electron onboarding journey (4 phases), changelog sub-tabs, performance/reward/house ads; Apr ad layouts; Mar GEP PROD/DEV environment instructions, CMP `openAdPrivacySettingsWindow()`; Jan monetization nav, recorder APIs.

### Archive highlights (ow-electron/builder, undated)
- 31.7.12 new CMP privacy settings; 31.7.8 ads fixes; 31.7.7 improved package updates while running; 31.7.6 owadview visibility and CMP init fixes; 31.7.3 Linux x64/arm64 (adview only), `userData` path fix, phased packages fix; 31.4.0 `packages.hasPendingUpdates()`, `disableAdsFPD()`; 28.3.2; 28.2.5; 22.3.25; **22.3.13 package manager + Overlay and GEP modules**; 22.0.3 initial macOS; 22.0.0 deprecated; 19.1.8 `disableAnonymousAnalytics()`, `isCMPRequired()`, `openCMPWindow()`.
- Builder: 24.13.3 (CVE fix; 24.13.4 macOS signing fix), 24.7.0 (no double install, Overwolf installer only), 23.6.0 (core Overwolf utilities bundled).

Source: getting-started/changelog/ow-changelog, support/changelog-archive/ow-changelog

---

## 15. Roadmap/blog, AI assistant config, storage

- Roadmap page: blog at https://blog.overwolf.com/tag/developers/; roadmap cards tagged Community, GEP, Console, Special Project; "Exact features and timings are subject to change." (The roadmap board content itself was not in the scraped text.)
- AI coding assistants: Overwolf provides a docs MCP server. Claude Code: `claude mcp add --transport http ow-docs-mcp https://V9EMDT18EK.algolia.net/mcp/1/cuI6UtBzTwKOL6E0Hvp-hw/mcp` (add `--scope user` for VSCode). Suggested CLAUDE.md rules: never use vanilla `electron` / `electron-builder`; start script `ow-electron .`; build with `ow-electron-builder`; always include `"overwolf": { "packages": [] }`; check local `node_modules/@overwolf/**/*.d.ts` first; MCP tool `mcp__ow-docs-mcp__algolia_search_index_overwolf` with `facet_docusaurus_tag: docs-ow-electron-current`.
- Client-side storage page: generic overview (cookies 4KB, Web Storage, localStorage "~50Mb (Since Overwolf v0.161...)" - a Native-client figure, IndexedDB no size limit, AppCache, `electron-store` saving `config.json` in `app.getPath('userData')`).

Source: getting-started/changelog/roadmap, guides/dev-tools/ai-coding-assistants-config, guides/dev-tools/choosing-your-apps-client-side-storage-technology

---

## 16. Support and community

- Overwolf Developers Discord (developers): https://discord.gg/overwolf-developers
- Overwolf Discord (app users): https://discord.gg/overwolf
- Email: developers@overwolf.com
- Your assigned Dev-Rel (for apps that have one).
- X: https://x.com/OverwolfDevs ; Facebook: https://www.facebook.com/OverwolfDevs ; Newsletter: http://eepurl.com/dxC30D
- Console: https://console.overwolf.com ; profile/dev key: https://dev.overwolf.com/profile

Source: support/contact-us, support/join-the-developers-community

---

## 17. Webinars

- Apps Academy: recurring 45-minute sessions with an expert; announced in the community Discord announcements channel.
- Entertaineurship - March 9th, 2021 - Uri Marchand (CEO/co-founder).
- Data - December 9th, 2020 - Gil Ben-Itzhak (head of BI): reading app reports.
- Marketing - October 14th, 2020 - Gil Tov-Ly and Sophie Duval: starting a campaign with $100, influencers.
- Monetization - September 9th, 2020 - Elazar Heim (VP revenue): how ads work, metrics, best practices.
- UI/UX - July 8th, 2020 - Jasmin Weizman: app identity, UX/UI methods.
No recordings/links are given on the page.

Source: guides/webinars/webinars-intro

---

## Contradictions and gaps

### Contradictions between pages
1. **When you get Console access vs where you submit.** Release page: submit "by uploading your latest build and filling out the necessary details in the Developer Console" AND "After the initial submission passes the QA team, Overwolf will grant you access to the developer console" AND (same page) "after submission, you'll gain access". Prepare-assets: access comes "After submitting your OPK to the store for the first time". The only concrete submission path is the form https://wkf.ms/3KL8b1m.
2. **Signing needs the Console before QA grants the Console.** App signing requires "A registered app in the Overwolf Console with an assigned App UID" and `OW_BUILD_KEY` from Console > Release management > App Keys; the pre-submission checklist says code signing is required; yet Console access is described as coming after QA passes. How the first QA build gets Overwolf-signed is not explained.
3. **Code signing required vs recommended.** App-signing page, release checklist, FAQ: required ("now required (previously optional)"). Frameworks overview still says certificates are "highly recommended". Installer page: "No additional code signing needed for the installer" (the installer, not your app exe).
4. **Package Channels minimum version.** Page says `ow-electron@38.9.12`; changelog says the flag and API were added in **39.8.12**. Likely a typo on one side.
5. **OS support.** Frameworks overview: "Windows OS, Mac OS (partial support), and several Linux flavors (partial support)". FAQ/non-Windows page: only ad services on Mac/Linux; "The Overwolf client and Overwolf Electron apps will only run on Windows based systems."
6. **Native-client leftovers in Electron pages.** Testing page talks about "opk" files and the "Overwolf task manager"; prepare-assets says "submitting your OPK"; FAQ says test with "the Overwolf Developers client"; storage page cites "Overwolf v0.161"; log pages describe the Overwolf client and link to ow-native. An ow-electron app ships an exe, not an OPK.
7. **Legal docs: "or" vs "and".** Release checklist: installer should ask users to accept "a Terms of Use or a Privacy Policy". Installer page lists both a Terms of Use URL and a Privacy Policy URL as requirements.
8. **Screenshot size.** Prepare-assets requires 1200x750 and in the same breath says 1200x750 "is no longer supported" and 1200x675 is "newly supported". The hero image is listed at 258x198, the same as the tile (possibly an error).
9. **Recorder status.** First-app page: Recorder "(currently in beta)". Dev mode/signing pages treat it as one of the standard gaming packages.
10. **Dev mode wording.** "If `OW_CLI_EMAIL`, `OW_CLI_API_KEY`, or `OW_DEV_KEY` are all absent" mixes "or" and "all". "Environment variables take precedence over `OW_DEV_KEY`" although `OW_DEV_KEY` is itself an env var (meaning: the EMAIL/API_KEY pair wins).
11. **API key location.** Dev mode/signing: Console "Profile > API Keys". CLI page: "Settings => Profile", then revoke and regenerate.
12. **Changelog duplication.** GEP 294.1.9 appears under both Jan 2026 and Dec 2025.

### Questions the docs don't answer
- How long a Developer Key (`OW_DEV_KEY`) lasts and exactly when "Extend" unlocks.
- Whether dev mode works for a second person (for example a beta tester) running from source with their own key, and what the "conditions" for dev mode are (only "can't activate on a distributed or packaged app").
- How to configure the Authenticode certificate in `ow-electron-builder` (config keys, EV vs OV, cloud HSM signing); whether an OV certificate is sufficient.
- What happens to gaming packages if the exe is Overwolf-signed but not Authenticode-signed (only "Without both ... will not load").
- Whether Console registration / App UID / `OW_BUILD_KEY` can be obtained before the first QA pass, and from whom (DevRel?).
- What exactly goes into the submission form (fields, whether a build file or download link is needed, whether the exe must already be signed).
- QA turnaround time.
- Whether testing channels can be used before go-live or before Console access, and how testers are added to a testing channel.
- Whether an app that does not monetize at launch can go live (Phase 4 lists "enable ads" as part of go-live; the checklist says design for monetization "even if at first you are not planning to monetize").
- Whether self-distributed builds (FAQ: "host the app in any location") of an approved, signed app need any further Overwolf approval.
- Which GEP games are enabled for an app by default ("must be enabled on a per-app basis").
- Dates of the ow-electron runtime and builder releases (the page gives none).

---

## What this means for Apex Squads

Based on the facts above. Items marked "Speculation" are not stated by Overwolf. Items marked "Repo" come from this repo's `package.json` as of 2026-09-28, not from the docs.

1. **Whitelisting comes first.** Without an approved app idea, "Unapproved apps won't have full access to the Overwolf Packages features." Submit at https://dev.overwolf.com/app-idea-form as a **Public** app with at least one desktop window (Apex Squads has a dashboard window, which fits). Private or background-only apps are not approved. If there is monetization, it must be Overwolf ads and/or subscriptions only; no third-party monetization.
2. **Local development with GEP** needs dev mode credentials: either `OW_CLI_EMAIL` + `OW_CLI_API_KEY` (a Console account) or `OW_DEV_KEY` (self-generated on dev.overwolf.com/profile once Developer status is Approved). The key expires and must be renewed with "Extend". Dev mode needs `ow-electron@39.8.10`+. Repo: `@overwolf/ow-electron` is `^42.7.1` and `start` is `dotenv -- ow-electron .`. Note that the docs' `--no-expand` warning about `$` in API keys was written for the build script. Whether plain `dotenv --` expands a `$` in `OW_CLI_API_KEY` at start time is not covered; Speculation: it could.
3. **Beta testers cannot use dev mode builds.** Dev mode "can't activate on a distributed or packaged app". Any build handed to testers must be (a) Overwolf-signed by `ow-electron-builder` 26.9.0+ with `OW_CLI_EMAIL`/`OW_CLI_API_KEY`/`OW_BUILD_KEY`, and (b) Authenticode-signed with your own CA certificate. Without both, GEP will not load, so the app would record nothing. `OW_BUILD_KEY` and the App UID come from the Console, so the app must be registered there first (see Contradiction 2 on timing). Repo: `@overwolf/ow-electron-builder` is not yet a dependency, there is no `build:ow-electron` script, and no signing certificate is configured.
4. **The testing-channel route for betas needs the Overwolf installer.** It is "the only way to access and test different versions in the Developers Console testing Channels". Self-hosting a signed build is allowed by the FAQ. Speculation: this is the only beta route before Console access.
5. **The App UID is fixed by name + author.** Repo: `productName` is "Apex Tracker" and `author.name` is "TrafikPT", while the product is called "Apex Squads". The UID derives from `productName` + `author.name`, and QA checks they stay "consistent across all versions". Settle the final name before the first signed or submitted build. The name must not contain "bot".
6. **Pre-submission needs:**
   - the signed exe;
   - installer choice (the Overwolf installer requires contacting DevRel);
   - CMP integration confirmed;
   - public, no-login, English Terms of Use and Privacy Policy URLs;
   - a hotkey reminder, FTUE, second-screen and resolution checks (1366x720 up to 3840x2160@150);
   - all processes exiting on close;
   - offline messaging;
   - a clean VirusTotal scan. A flagged build "will not be tested".
7. **Ads and monetization during review:**
   - If Apex Squads shows ads, QA checks ad visibility, click behavior (5 clicks = 5 browser windows, no crash), that no ad processes remain when minimized or closed, and compliance with the advertising policy and sizes.
   - Go-live includes "enable ads" (done by the revenue and QA teams) and Payoneer registration.
   - The docs don't say whether an ad-free app can go live; ask DevRel.
   - Overwolf promotion requires "some form of monetization".
8. **GEP for Apex must be enabled per app** ("must be enabled on a per-app basis", contact Overwolf). Recent GEP changes to track: `player_stats` and `ring` Info Updates (312.5.1), a second action parameter in `kill_feed` (312.3.3), the `game_mode` fix (312.5.3), and the ranked requeue `match_start` fix (311.2.0).
9. **Admin rights:** "Apps that run with admin privileges can't inject into non-admin running games". This matters only if the overlay package is used; Apex Squads' popups may be plain windows (Speculation).
