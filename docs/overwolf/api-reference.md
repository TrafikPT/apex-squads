# ow-electron API reference

Distilled from dev.overwolf.com/ow-electron on 2026-09-28. Check the source URL before relying on anything time-sensitive.

Scope: the generated "Electron APIs" reference (`reference/Overwolf-electron-APIs/...`), the overlay worked examples (`reference/examples/...`) and the OIDC page (`reference/overwolf-oidc/ow-oidc`). Guides (GEP game pages, overlay guides, packaging, ads) live in other files of this knowledge base.

Conventions in this file:

- Signatures, names and types are copied from the docs. `?` = optional.
- "Inference:" marks anything that is my reading, not a doc statement.
- Where the docs are internally inconsistent, it is flagged inline and collected in "Contradictions and gaps".
- Installed in this repo (from `package.json` / `node_modules`, not from the docs): `@overwolf/ow-electron` 42.7.1, `@overwolf/ow-electron-packages-types` 1.1.11; `package.json` `overwolf.packages` = `["gep"]`. The types package is the one the docs point to for package API types ("For package-specific API types, see `@overwolf/ow-electron-packages-types`").

## Module map

| Module | Reached as | What it is (docs wording, condensed) |
| --- | --- | --- |
| app | `app.overwolf` (Electron `app`) | Core ow-electron APIs built into the runtime (analytics/ads/CMP/payment-id), plus `packages`. |
| packages | `app.overwolf.packages` | Package manager (EventEmitter): package lifecycle events, release channels, relaunch. Also exposes each loaded package as a property (`gep`, `overlay`, `utility`, `crn`, `recorder`). |
| gep | `app.overwolf.packages.gep` | Game Events Provider: game detection, real-time game events and info updates. |
| overlay | `app.overwolf.packages.overlay` | In-game overlay windows, hotkeys, input modes, screenshots, GPU preference. |
| utility | `app.overwolf.packages.utility` | Game launch/exit tracking and installed-game scanning. |
| crn | `app.overwolf.packages.crn` | Content Recommendation Notification settings. |
| recorder | `app.overwolf.packages.recorder` | Audio/video recording and replays (OBS based). Only the Overview was captured here. |

Packages are declared in the app's `package.json` `overwolf.packages` array. The reference says this only indirectly: `setChannel()` throws for a name not in that array and `getAvailableChannels()` throws for a name not in the registered packages list. (Inference: a package not listed there is not loaded.)

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/Overview

---

## app (`app.overwolf`)

"The core ow-electron APIs, exposed on Electron's `app` object as `app.overwolf`. These are the APIs built into the ow-electron runtime itself, as opposed to the optional Overwolf packages."

### interface OverwolfApi

Properties:

| Property | Modifier | Type | Description |
| --- | --- | --- | --- |
| `muid` | readonly | `string` | A unique identifier for the user machine. |
| `packages` | public | `OverwolfPackageManager` | The Overwolf Package Manager instance. |
| `phasePercent` | readonly | `number` | Client persistence phasing percent. |
| `uid` | readonly | `string` | The ow-electron uid (Overwolf App Id). |
| `utmParams` | readonly | `any` | Overwolf installer provided UTM params. |

Methods:

| Signature | Behavior (docs) |
| --- | --- |
| `disableAdsFPD(): void` | Opt out from using first party data (email address) for ad targeting. |
| `disableAdsOptimization(): void` | Disable Ads optimization. (No timing requirement stated.) |
| `disableAnonymousAnalytics(): void` | Disable sending any anonymous analytics. "This should be called before app.ready." |
| `generateUserEmailHashes(email: string): EmailHashes` | Generate a hashed email for better ad performance. "Should be called after app.ready." The email is not stored, only the hash. |
| `isCMPRequired(): Promise<boolean>` | True if the current user should be able to update their CMP configuration (i.e. `openCMPWindow`). Async; "will never throw an exception - the default value is true". |
| `openAdPrivacySettingsWindow(options?: CMPWindowOptions): Promise<void>` | Opens the Ads settings configuration window. |
| `openCMPWindow(options?: CMPWindowOptions): Promise<void>` | Opens the CMP configuration window. Should only be called when `isCMPRequired` returns true. |
| `setExternalPaymentUserId(options: ExternalPaymentUserIdOptions): Promise<void>` | Associates the user's id at an external payment provider (e.g. Tebex) with this machine. Call once on every app launch, after app.ready. Rejects if `userId` is missing. `providerName` defaults to `'tebex'`. Rejects with `'ow-electron is not ready yet!'` if called before app.ready. A failed analytics report does not reject. |
| `setUserEmailHashes(emailHashes?: EmailHashes): void` | Set the user email hashes (see `generateUserEmailHashes`). Call after app.ready. The docs link a Chromium accessibility page for "how to normalize email before creating hash" (link target looks wrong; see gaps). |

### interface CMPWindowOptions

| Property | Type | Description |
| --- | --- | --- |
| `backgroundColor?` | `string` | CMP preloader background window color. |
| `center?` | `boolean` | Center on screen. Default `true`. |
| `cmpURL?` | `string` | Overrides the path of the CMP html. |
| `height?` | `number` | Window height. |
| `language?` | `string` | CMP html language. |
| `modal?` | `boolean` | Modal window; only works when the window is a child window. Default `false`. |
| `parent?` | `any` | Parent window. Default `null`. |
| `preLoaderSpinnerColor?` | `string` | Preloader spinner color. |
| `tab?` | `"purposes" \| "features" \| "vendors"` | Tab to open. Default `'purposes'`. |
| `width?` | `number` | Window width. |
| `x?` | `number` | Left position. |
| `y?` | `number` | Top position. |

### interface EmailHashes

| Property | Modifier | Type |
| --- | --- | --- |
| `md5?` | readonly | `string` |
| `sha1?` | readonly | `string` |
| `sha256?` | readonly | `string` |

### interface ExternalPaymentUserIdOptions

| Property | Type | Description |
| --- | --- | --- |
| `paymentId?` | `string` | The provider's recurring payment (subscription) agreement id. |
| `providerName` | `string` | Name of the external payment provider. (Listed as required in the table, but `setExternalPaymentUserId` says it defaults to `'tebex'`.) |
| `userId` | `string` | The user id your app passes to the provider. |

### type ExternalPaymentProvider

```ts
type ExternalPaymentProvider = "tebex" | string;
```

"A enum of the external payment providers we know about."

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/app/Overview , .../app/interfaces/OverwolfApi , .../app/interfaces/CMPWindowOptions , .../app/interfaces/EmailHashes , .../app/interfaces/ExternalPaymentUserIdOptions , .../app/type-aliases/ExternalPaymentProvider

---

## packages (`app.overwolf.packages`)

### interface OverwolfPackageManager (extends Node `EventEmitter`)

Inherited EventEmitter members (`once`, `off`, `removeListener`, `setMaxListeners`, ...) are available but not listed by the docs.

Properties:

| Property | Modifier | Type | Description |
| --- | --- | --- | --- |
| `logsFolderPath` | readonly | `string` | Path to the application's logs folder. |
| `phasePercent` | readonly | `number` | The ow-electron phase percentage (used by the package manager). |

Events (all return `this`):

| Event | Listener signature | Notes |
| --- | --- | --- |
| `"loading"` | `(event: Event, packageName: string) => void` | A package begins its load sequence. "Fires before 'ready'." |
| `"ready"` | `(event: Event, packageName: string, version: string) => void` | A package is ready. |
| `"failed-to-initialize"` | `(event: Event, packageName: string) => void` | Package initialization failure. |
| `"crashed"` | `(event: Event, canRecover: boolean) => void` | A package crashed. "Calling `event.preventDefault()` will prevent the package from automatically attempting to re-launch itself." Note: no `packageName` argument. |
| `"updated"` | `(event: Event, packageName: string, version: string) => void` | A package was updated. |
| `"package-update-pending"` | `(event: Event, info: PackageInfo[]) => void` | A package is ready to update. |

Methods:

| Signature | Behavior (docs) |
| --- | --- |
| `hasPendingUpdates(): PendingUpdatesResult` | Synchronous. Whether any package updates are pending that require a client restart. |
| `relaunch(): void` | Relaunch the Package Manager to force all pending package updates. "The Overwolf Package Manager will automatically relaunch itself if an update is available and no package is currently running." |
| `getAvailableChannels(...packageNames: string[]): Promise<AvailableChannelsResult>` | Release channels available on the server. No args = all packages registered in the app's `packages` list. Packages with no channels return `[]`. Throws if any supplied name is not in the registered packages list. Example result: `{ overlay: ['pre-release', 'beta'], gep: ['pre-release'], utility: [] }`. |
| `getChannel(...packageNames: string[]): Promise<CurrentChannelsResult>` | Currently active channel per package; `'public'` = default public release. No args = all registered packages plus any package with a stored non-public channel (even if not in `package.json`). Unknown names are silently omitted (no error). |
| `setChannel(packageName: string, channel?: string, ready?: (packageInfo: ChannelPackageInfo) => void): Promise<SetChannelResult>` | Switches a package to a named channel and immediately downloads that version. Preference is persisted and applied on every later update check, including next launch. `undefined`, `null`, `''` or `'public'` restores the public release (all equivalent). `ready` is called with `{ name, version }` once the download completes and a restart is needed; never fires if already at that channel's version. Throws if `packageName` is not in the app's `package.json` `packages` array. |

`setChannel` example from the docs:

```ts
const result = await api.setChannel("overlay", "pre-release", (pkg) => {
  console.log(`overlay v${pkg.version} ready - restart required`);
  api.relaunch();
});
if (!result.success) console.error("setChannel failed:", result.error);
```

### interface OWPackages (extends OverwolfPackageManager)

| Property | Type | Description (docs) |
| --- | --- | --- |
| `crn` | `IOverwolfCRNApi` | "Access to crash reporting and notification APIs." (see contradiction: CRN is Content Recommendation Notification) |
| `gep` | `OverwolfGameEventPackage` | Real-time in-game events and info updates. |
| `overlay` | `IOverwolfOverlayApi` | Overlay window creation, input control, hotkeys. |
| `recorder` | `IOverwolfRecordingApi` | Video recording and replay. |
| `utility` | `IOverwolfUtilityApi` | Game launch tracking and game scanning. |

The `packages` Overview example (quoted as-is, including its odd variable naming):

```ts
const app = overwolf.packages as OWPackages;
app.utility.trackGames({ includeUnsupported: true });
app.utility.on("game-launched", (gameInfo) => { console.log("Game launched:", gameInfo.name); });
await app.recorder.startRecording({ filePath: "C:/Videos/gameplay", audioTrack: 1 });
```

### Other packages types

| Name | Definition |
| --- | --- |
| `interface PackageInfo` | `{ name: string; version: string }` ("Package info") |
| `interface ChannelPackageInfo` | `{ name: string; version: string }`. Passed to `setChannel()`'s `ready` callback; identifies the downloaded package pending a restart. |
| `type PackageName` | `"gep" \| "overlay" \| "recorder" \| "utility" \| "crn" \| string` ("A fake enum for all built-in package names") |
| `type AvailableChannelsResult` | `Record<string, string[]>` |
| `type CurrentChannelsResult` | `Record<string, string>` |
| `type PendingUpdatesResult` | `object` with `details: PackageInfo[]`, `hasPendingUpdate: boolean` |
| `type SetChannelResult` | `object` with `success: boolean`, `error?: "invalid-package" \| "invalid-channel"`. `'invalid-package'` = package not found on the server; `'invalid-channel'` = channel does not exist for that package. |

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/packages/Overview , .../packages/interfaces/OverwolfPackageManager , .../packages/interfaces/OWPackages , .../packages/interfaces/PackageInfo , .../packages/interfaces/ChannelPackageInfo , .../packages/type-aliases/PackageName , .../packages/type-aliases/AvailableChannelsResult , .../packages/type-aliases/CurrentChannelsResult , .../packages/type-aliases/PendingUpdatesResult , .../packages/type-aliases/SetChannelResult

---

## gep (`app.overwolf.packages.gep`)

Flow as described by the gep Overview:

1. A supported game is detected: `game-detected` fires. Call `event.enable()` inside the listener to activate GEP for that game.
2. If the game runs with elevated privileges, `elevated-privileges-required` fires **instead**; the app must also run as administrator for events to be captured.
3. "Before events flow, call `setRequiredFeatures` with the feature names your app needs. GEP will only emit `new-info-update` and `new-game-event` events for features you have registered."
4. `getFeatures` queries which features a game **supports**; `getInfo` reads the current game state at any point.

Event summary (Overview wording): `new-game-event` = discrete in-game event (kill, death, match start, ...); `new-info-update` = change to a persistent info value (health, score, map, ...); `game-detected`; `game-exit` = tracked game process exited; `elevated-privileges-required`; `error` = internal GEP error.

### interface OverwolfGameEventPackage (extends Node `EventEmitter`)

Methods (Overwolf-specific):

| Signature | Behavior (docs) |
| --- | --- |
| `getSupportedGames(): Promise<object[]>` | Array of GEP-supported games. (Installed typings 1.1.11 declare `Promise<{ name: string; id: number }[]>`.) |
| `getFeatures(gameId: number): Promise<string[]>` | "Returns an array of supported Game Event Features for a game." Not the subscribed set. |
| `setRequiredFeatures(gameId: number, features: string[] \| undefined): Promise<void>` | "Sets the requires Game Event Features for a given game ID." `features`: "Array of required Game Event Features." Returns a "Promise reporting the success of the operation." The reference does not say what `undefined` means, does not mention `null`, and does not list rejection reasons. |
| `getInfo(gameId: number): Promise<any>` | "Returns the target game's current Game Info." |

Events (all return `this`, "the current instance of the Overwolf Game Events Package"):

| Event | Listener signature | Notes |
| --- | --- | --- |
| `"game-detected"` | `(event: GepGameLaunchEvent, gameId: number, name: string, ...args: any[]) => void` | Call `event.enable()` to start GEP for this game. |
| `"new-info-update"` | `(event: Event, gameId: number, data: InfoUpdate) => void` | Game Info Updates. |
| `"new-game-event"` | `(event: Event, gameId: number, data: GameEvent) => void` | New Game Events. |
| `"game-exit"` | `(event: Event, gameId: number, gameName: string, pid: number, processName: string, processPath: string, commandLine: string) => void` | Game exit. |
| `"elevated-privileges-required"` | `(event: Event, gameId: number, name: string, pid: number) => void` | Detected game runs as administrator; "the app must also run as administrator in order for Game Events to be detected." |
| `"error"` | `(event: Event, gameId: number, error: string, ...args: any[]) => void` | Errors thrown by the GEP package. eventName: "'error' or the `errorMonitor` symbol". |

Inherited EventEmitter members documented on the page (standard Node semantics, not repeated here): `[captureRejectionSymbol]?`, `addListener`, `emit`, `eventNames`, `getMaxListeners`, `listenerCount`, `listeners`, `off`, `once`, `prependListener`, `prependOnceListener`, `rawListeners`, `removeAllListeners(eventName?)`, `removeListener`, `setMaxListeners`. Node's own note, reproduced on the page: "It is bad practice to remove listeners added elsewhere in the code" (about `removeAllListeners`). Default max listeners warning at 10 per event.

### interface GepGameLaunchEvent

Passed to the `game-detected` listener.

| Property | Type |
| --- | --- |
| `enable` | `() => void` |

### namespace gep: interface GameEvent

`data` of `new-game-event`: "a single discrete in-game occurrence". Extended by `InfoUpdate`.

| Property | Type | Description |
| --- | --- | --- |
| `feature` | `string` | The feature the Event belongs to. |
| `gameId` | `number` | Game id of the source game. |
| `key` | `string` | The name of the Event. |
| `value` | `any` | The value of the Event. |

### namespace gep: interface InfoUpdate (extends GameEvent)

`data` of `new-info-update`: "a change to a persistent game state value".

| Property | Type | Description |
| --- | --- | --- |
| `category` | `string` | The category the Info Item belongs to. |
| `feature` | `string` | (inherited) |
| `gameId` | `number` | (inherited) |
| `key` | `string` | (inherited) |
| `value` | `any` | (inherited) |

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/gep/Overview , .../gep/interfaces/OverwolfGameEventPackage , .../gep/interfaces/GepGameLaunchEvent , .../gep/namespaces/gep/Overview , .../gep/namespaces/gep/interfaces/GameEvent , .../gep/namespaces/gep/interfaces/InfoUpdate

---

## overlay (`app.overwolf.packages.overlay`)

Concepts (Overview):

- **Standard mode**: games where the mouse is visible during play (MOBAs such as League of Legends, Dota 2). You can interact with app windows without pulling keyboard/mouse focus from the game.
- **Exclusive mode**: games where the mouse is not visible (FPS games such as **Apex Legends**, Fortnite). "The only way to interact with the Overwolf app window is by entering exclusive mode. This will show a semi-transparent window overlaid on the game window and doesn't allow keyboard or mouse input to pass into the game."

Minimal lifecycle, assembled from the reference (each step is stated somewhere in the docs; the ordering is my summary):

1. `overlay.registerGames(filter)` to choose which games to track.
2. `on('game-launched', (event, gameInfo) => ...)`: call `event.inject()` (or `event.dismiss()`).
3. `on('game-injected', gameInfo => ...)`: overlay is ready and injected. `takeScreenshot` needs this; hotkeys example registers here.
4. First `on('game-window-changed', ...)`: earliest point where `GameWindowInfo` is available (a few seconds after `game-injected`, once the game's graphics device initializes). Before that `getActiveGameInfo().gameWindowInfo` is `undefined`.
5. `createWindow({ name, ...BrowserWindowConstructorOptions, ...OverlayOptions })` to show UI. (The docs do not say windows must be created after injection; the shared-texture page says a window may be created before availability is known.)
6. `on('game-exit', (gameInfo, wasInjected) => ...)`: authoritative end of session. `game-window-destroyed` may fire seconds earlier (not for OOPO games).

Example on the interface page:

```ts
this._overlayApi.on('game-launched', (event, gameInfo) => {
  if (gameInfo.supported === true) {
    event.inject();
  }
});
```

### interface IOverwolfOverlayApi (extends Node `EventEmitter`)

Properties:

| Property | Modifier | Type | Description |
| --- | --- | --- | --- |
| `hotkeys` | public | `IOverlayHotkeys` | Register/update/remove overlay hotkeys. |
| `version` | readonly | `string` | Current overlay package version. Since 1.7.0. |

Methods:

| Signature | Behavior (docs) |
| --- | --- |
| `registerGames(filter: GamesFilter): any` | Register games to track for overlay injection. |
| `requestGameInjection(classId: number): Promise<void>` | Late injection. If the game is running, `game-launched` is emitted and you can call `event.inject()`. If another game is already injected, the overlay moves to the new game. Throws if the game is not running. |
| `createWindow(options: OverlayWindowOptions): Promise<OverlayBrowserWindow>` | Create a new overlay window. |
| `fromBrowserWindow(browserWindow: BrowserWindow): OverlayBrowserWindow \| null` | Overlay window for a `BrowserWindow`, or `null` if not owned by the overlay system. |
| `fromWebContents(webContents: WebContents): OverlayBrowserWindow \| null` | Overlay window for a `WebContents`, or `null`. |
| `getAllWindows(): OverlayBrowserWindow[]` | All open overlay windows. |
| `getActiveGameInfo(): ActiveGameInfo \| undefined` | Info about the currently active game, if available. |
| `enterExclusiveMode(options?: ExclusiveInputOptions): void` | Enter exclusive mode to intercept input in games where the cursor is hidden. `game-input-exclusive-mode-changed` fires if entered. "NOTE: This is only supported when `getActiveGameInfo().gameInputInfo.canInterceptInput` is `false`." Calling when unsupported is ignored, no exception. |
| `exitExclusiveMode(): void` | Exit exclusive mode, letting input reach the game. "Only effective if `getActiveGameInfo().gameInputInfo.canInterceptInput` is `true`." (See contradictions.) |
| `takeScreenshot(filePath: string, format?: "jpg" \| "bmp"): Promise<void>` | Capture the current game frame to disk. One at a time: a second call while pending rejects immediately. Format precedence: explicit `format`, else `filePath` extension (`.jpg`/`.jpeg`/`.bmp`), else `'bmp'`; the extension is then normalized (`shot.png` + `'jpg'` becomes `shot.jpg`, not doubled). All backends (D3D9/11/12, Vulkan) capture BMP and transcode to JPEG. Docs say it "resolves with the absolute path the file was actually written to" despite the `Promise<void>` signature. Rejects with: `'no active game'` (not injected; wait for `game-injected`), `'screenshot already in progress'`, `'no active graphics device'` (e.g. minimized/device lost), `'capture failed: <backend>'`. |
| `getGpuPreference(): Promise<GpuPreference>` | GPU preference recorded for this app's executable. Resolves `'default'` when no entry exists; never `undefined`. Throws on non-Windows. Since 2.0.5. |
| `setGpuPreference(preference: GpuPreference): Promise<void>` | Records a Windows per-executable GPU preference so Chromium's GPU process runs on the same adapter as the game (needed for shared texture). Restart normally required (DXGI reads it at D3D device creation). Idempotent. Side effects: moves the whole app's rendering to that GPU (battery, discrete GPU stays awake); persistent, user-visible Windows state (Settings > System > Display > Graphics); keyed on exe path (moving/renaming leaves a stale entry). Never applied implicitly. `'default'` removes the entry (recommended on uninstall or when user turns overlay off). Throws if the registry cannot be written or on non-Windows. Since 2.0.5. |
| `installHighElevationHelper?(): Promise<void>` | Optional. Installs ow-electron helpers to `%CommonProgramFiles%\<app-name>` with UAC elevation, allowing injection into high-elevation games. No-op if already present. Throws `HelperInstallError`: `exitCode 1223` = user cancelled UAC (ERROR_CANCELLED); other non-zero `exitCode` = installer failed. Installs `owe-helper-ui.exe` (x64) and `owe-helper-ui-x86.exe` (x86). After installing, "Injection into elevated games now happens automatically on game launch" (example comment). |
| `isHighElevationHelperInstalled?(): Promise<boolean>` | Optional. `true` if the helper is installed in `%CommonProgramFiles%\<app-name>`. |

Events (all return `this`):

| Event | Listener signature | Notes (docs) |
| --- | --- | --- |
| `"game-launched"` | `(event: GameLaunchEvent, gameInfo: GameInfo) => void` | A registered game launched. Call `event.inject()` to enable the overlay. |
| `"game-injected"` | `(gameInfo: GameInfo) => void` | Overlay ready and successfully injected. |
| `"game-injection-error"` | `(gameInfo: GameInfo, error: string, ...args: any[]) => void` | Injection failed. |
| `"game-exit"` | `(gameInfo: GameInfo, wasInjected: boolean) => void` | Registered game process terminated. |
| `"game-focus-changed"` | `(window: GameWindowInfo, gameInfo: GameInfo, focus: boolean) => void` | Game window focus changed. Also fires for a game whose injection was dismissed; that window info has position, size and focus only (no graphics/shared-texture fields), so it is not a substitute for the first `game-window-changed`. |
| `"game-window-changed"` | `(window: GameWindowInfo, gameInfo: GameInfo, reason?: GameWindowUpdateReason) => void` | Window resized/moved, and once when the injected client first reports the window (earliest point `GameWindowInfo` exists). |
| `"game-window-destroyed"` | `(gameInfo: GameInfo) => void` | Injected game's window destroyed, often seconds before process exit. `game-exit` still follows and is authoritative. Not emitted for OOPO games. |
| `"game-input-interception-changed"` | `(info: GameInputInterception) => void` | Input interception capability changed. |
| `"game-input-exclusive-mode-changed"` | `(info: GameInputInterception) => void` | Exclusive input mode state changed. |
| `"shared-texture-unavailable"` | `(reason: SharedTextureUnavailableReason) => void` | Shared-texture path cannot be used for the current game. At most once per injected game. `unsupportedGraphicsApi` and `gpuAdapterMismatch` are detected when graphics are detected (before any frame); `copyFailure` and `handleTransportBlocked` only after frames repeatedly failed. By the time it fires, affected windows are already on the CPU copy path and stay visible/interactive; `isSharedTextureAvailable` reports `false`. Since 2.0.5. |
| `"error"` | `(...args: any[]) => void` | Internal overlay error. |

### interface IOverlayHotkeys

| Signature | Behavior |
| --- | --- |
| `all(): IOverlayHotkey[]` | All active hotkeys. |
| `register(hotKey: IOverlayHotkey, callback: HotkeyCallback): void` | Register a new hotkey. Throws at registration for an unknown `keyCode` string. |
| `update(hotKey: IOverlayHotkey): boolean` | Update an existing hotkey; `false` if it does not exist. |
| `unregister(name: string): boolean` | Remove by name; `false` if it does not exist. |
| `unregisterAll(): void` | Clear all hotkeys. |

```ts
overlay.hotkeys.register(
  { name: "toggleOverlay", keyCode: 192, modifiers: { ctrl: true }, passthrough: false },
  (hotKey, state) => { if (state === "pressed") toggleOverlay(); },
);
```

### interface IOverlayHotkey

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Unique name. |
| `keyCode` | `string \| number` | Numeric Windows Virtual-Key code, or (since 1.13.3, preferred, layout-independent) a W3C `KeyboardEvent.code` string, resolved to VK at registration. Supported strings include `KeyA`-`KeyZ`, `Digit0`-`Digit9`, `F1`-`F24`, `Numpad0`-`Numpad9`, `ArrowUp/Down/Left/Right`, `Tab`, `Enter`, `Space`, `Backspace`, `Delete`, `Escape`, `Home`, `End`, `PageUp`, `PageDown`, `ShiftLeft/Right`, `ControlLeft/Right`, `AltLeft/Right`, `Backquote`, `Minus`, `Equal`, `BracketLeft/Right`, `Semicolon`, `Quote`, `Comma`, `Period`, `Slash`, `Backslash`, media/browser/launch keys. Unknown string throws `Error('Unknown hotkey code: "<value>". Pass a valid KeyboardEvent.code string…')`; validate user input first. |
| `modifiers?` | `object` | Modifier keys that must be held. |
| `modifiers.alt?` | `boolean` | Alt. |
| `modifiers.ctrl?` | `boolean` | Ctrl. |
| `modifiers.shift?` | `boolean` | Shift. |
| `modifiers.meta?` | `boolean` | Windows / Command key. |
| `modifiers.custom?` | `string \| number` | Custom key: VK code or (since 1.13.3) `KeyboardEvent.code` string. |
| `passthrough?` | `boolean` | `true`: captured by the overlay and passed to the game. `false`: captured exclusively by the overlay. Default `false`. |

### type HotkeyCallback / HotkeyState

```ts
type HotkeyCallback = (hotKey: IOverlayHotkey, state: HotkeyState) => void; // fired on press and release
type HotkeyState = "pressed" | "released";
```

### interface OverlayWindowOptions (extends Electron `BrowserWindowConstructorOptions`, `OverlayOptions`)

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Unique name (id) for the window. Required. |
| `passthrough?` | `PassthroughType` | Input handling. Default `'noPassThrough'`. |
| `zOrder?` | `ZOrderType` | Stacking order. Default `'default'`. |
| `ignoreKeyboardInput?` | `boolean` | `true` = overlay won't intercept keyboard input. Default `false`. |
| `strictToGameWindow?` | `boolean` | Confine the window to the game window bounds. Default `false`. Since 1.9.0. |
| `dpiAware?` | `boolean` | DPI aware (main monitor DPI). Default `false`. Since 1.7.0. |
| `enableIsolation?` | `boolean` | Chromium process isolation (sandboxing). |
| `disableHardwareAcceleration?` | `boolean` | Software (CPU) compositing for this window only, unlike app-wide `app.disableHardwareAcceleration()`. Incompatible with and wins over `useSharedTexture`. Requires ow-electron >= 39.8.10 (ignored earlier). Default `false`. Since 1.13.20. |
| `useSharedTexture?` | `boolean` | BETA. Render via GPU shared texture instead of CPU pixel copy per paint. Needs hardware acceleration and a usable path for the game (`GameWindowInfo.isSharedTextureAvailable`); otherwise silently ignored (CPU copy path). No need to wait for availability before creating the window; the path follows the active game. Default `false`. Since 2.0.2. |

### interface OverlayOptions

Subset reused by `OverlayWindowOptions`; also the type of `OverlayBrowserWindow.overlayOptions`. Fields: `ignoreKeyboardInput?`, `passthrough?`, `strictToGameWindow?`, `zOrder?` (same meanings and defaults as above).

### interface OverlayBrowserWindow

| Member | Modifier | Type | Description |
| --- | --- | --- | --- |
| `id` | readonly | `number` | ID assigned to the overlay window. |
| `name` | readonly | `string` | Unique name. |
| `overlayOptions` | readonly | `OverlayOptions` | Options used at creation. (The shared-texture example writes `overlayOptions.passthrough = mode` at runtime and calls `passthrough` "writable".) |
| `scaleFactor` | readonly | `number` | Window DPI as a ratio (1.25 = 125%). |
| `window` | public | `BrowserWindow` | The wrapped Electron window. |
| `startDragging(): void` | method | | Start dragging the window. Works only when visible and focused; triggered from a `mousedown` (renderer sends IPC, main calls `overlayApi.fromWebContents(e.sender).startDragging()`). Same effect as CSS `-webkit-app-region: drag`. |

### interface ActiveGameInfo

| Property | Modifier | Type | Description |
| --- | --- | --- | --- |
| `gameInfo` | readonly | `GameInfo` | Currently running game. |
| `gameInputInfo` | readonly | `GameInputInterception` | Input interception state. |
| `gameWindowInfo` | readonly | `GameWindowInfo` | `undefined` between injection and the first `game-window-changed`. |

### interface GameWindowInfo

Not available at injection time; the first `game-window-changed` delivers it (a few seconds after `game-injected`).

| Property | Modifier | Type | Description |
| --- | --- | --- | --- |
| `bounds?` | readonly | `any` | Window rect in screen coordinates, e.g. `{ x: 100, y: 100, width: 800, height: 600 }`. Since 1.5.11. |
| `focused` | readonly | `boolean` | Window has focus. |
| `graphics` | readonly | `string \| undefined` | Graphics API (e.g. Direct3D 9, 11, 12, Vulkan). |
| `isFullscreen?` | readonly | `boolean` | Fullscreen exclusive. OOPO games only. Since 1.9.0. |
| `isOOPOFullscreenRenderingDisabled?` | readonly | `boolean` | Fullscreen rendering disabled. OOPO games only. Since 1.9.0. |
| `isSharedTextureAvailable?` | readonly | `boolean` | Shared texture actually usable for this game on this machine (supported API, no adapter mismatch, not abandoned after copy failures). Can turn `false` mid-game. `undefined` until graphics init. Since 2.0.5. |
| `isSharedTextureSupported?` | readonly | `boolean` | Capability probe: `true` for D3D11/D3D12, `false` for D3D9/OpenGL/Vulkan. `undefined` until graphics init. Since 2.0.0. |
| `nativeHandle` | readonly | `number` | Native HWND. |
| `screen?` | readonly | `any` | Display info for the window's screen. Since 1.5.11. |
| `size` | readonly | `Size` | Window dimensions. |

### interface GameInputInterception

| Property | Modifier | Type | Description |
| --- | --- | --- | --- |
| `canInterceptInput?` | readonly | `boolean` | Can the overlay window intercept input. |
| `exclusiveMode?` | readonly | `boolean` | Currently in exclusive input mode. |

### interface ExclusiveInputOptions

| Property | Type | Description |
| --- | --- | --- |
| `backgroundColor?` | `string` | Exclusive-mode background. Must be `rgba(...)`; invalid format throws. `rgba(0,0,0,0)` disables. Default written as `'rgba(12, 12, 12, , 0.5)'` (typo in docs). |
| `fadeAnimateInterval?` | `number` | Fade in/out duration in ms; `0` disables. Default `100`. |

### interface GameLaunchEvent

| Property | Type | Description |
| --- | --- | --- |
| `inject` | `(options?: GameLaunchEventOptions) => void` | Inject the overlay. (Options since 1.8.0.) |
| `dismiss` | `() => void` | Skip injection for this game. |

### interface GameLaunchEventOptions (since 1.8.0)

| Property | Type | Description |
| --- | --- | --- |
| `forceOOPO?` | `boolean` | Force OOPO mode (when OOPO is false in the game list). Default `false`. |
| `forceOOPOMixedMode?` | `boolean` | Force OOPO mixed-mode mouse control (debugging / hybrid input). Default `false`. |

OOPO is not expanded anywhere in these pages. (Inference: "out-of-process overlay".)

### interface GamesFilter

| Property | Type | Description |
| --- | --- | --- |
| `all?` | `boolean` | Include all games. |
| `gamesIds?` | `number[]` | Game IDs to track. "If `null` or empty, filters all games." |
| `includeUnsupported?` | `boolean` | Include games unsupported by overlay. Default `false`. |

### interface InjectionError

`{ error: string }`. "Error handler for the overlay injection process." Not referenced by any event signature in the reference.

### type GameInfo

| Property | Type | Description |
| --- | --- | --- |
| `classId` | `number` | Game class ID per the gameslist. Example given: League of Legends class id 54261. |
| `id` | `number` | Game ID per the gameslist. Example given: League of Legends game id 5426. |
| `name` | `string` | Name of the game. |
| `supported` | `boolean` | Game supports Overlay. |
| `type` | `"Game" \| "Launcher"` | Detected as the game or as its launcher. |
| `flags?` | `any` | Gameslist flags. |
| `processInfo?` | `GameProcessInfo` | Process info. |

### type GameProcessInfo

| Property | Type | Description |
| --- | --- | --- |
| `fullPath` | `string` | Full path to the executable. |
| `pid?` | `number` | PID. |
| `commandLine?` | `string` | Command line. |
| `is32Bit?` | `boolean` | Running 32-bit. |
| `isElevated?` | `boolean` | Running as administrator. |

### type InstalledGameInfo

| Property | Type | Description |
| --- | --- | --- |
| `id` | `number` | Game ID per the gameslist. |
| `name?` | `string` | Name. |
| `path?` | `string` | Installation directory. |
| `installFolder?` | `string` | Root install folder (when detected from Steam or Epic). |
| `steamId?` | `number` | Steam store ID. |
| `epicId?` | `string` | Epic store ID. |
| `supported?` | `boolean` | Supports Overlay. |
| `type?` | `GameInfoType` | Game or launcher. |

### Other overlay type aliases

```ts
type GameInfoType = "Game" | "Launcher" | undefined;
type GameWindowUpdateReason = undefined | "resized" | "focus";
type GpuPreference = "default" | "highPerformance";      // since 2.0.5; default = Windows decides (usually primary-display adapter)
type PassthroughType = "noPassThrough" | "passThrough" | "passThroughAndNotify";
//   noPassThrough: all input handled by the window, blocked from the game (default)
//   passThrough: all input passed to the game
//   passThroughAndNotify: passed to the game AND the window is notified of the input events
type ZOrderType = "default" | "topMost" | "bottomMost";
//   default: bring the focused overlay window to front; topMost: above all; bottomMost: below all
type SharedTextureUnavailableReason =
  | "unsupportedGraphicsApi"   // D3D9/OpenGL/Vulkan; nothing to fix
  | "gpuAdapterMismatch"       // game and Chromium on different GPUs; fix with setGpuPreference + restart
  | "copyFailure"              // game repeatedly failed to open handles; setGpuPreference may help
  | "handleTransportBlocked";  // textures could not be handed to the game at all; nothing to do
```

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/overlay/Overview , .../overlay/interfaces/IOverwolfOverlayApi , .../overlay/interfaces/IOverlayHotkeys , .../overlay/interfaces/IOverlayHotkey , .../overlay/interfaces/OverlayWindowOptions , .../overlay/interfaces/OverlayOptions , .../overlay/interfaces/OverlayBrowserWindow , .../overlay/interfaces/ActiveGameInfo , .../overlay/interfaces/GameWindowInfo , .../overlay/interfaces/GameInputInterception , .../overlay/interfaces/ExclusiveInputOptions , .../overlay/interfaces/GameLaunchEvent , .../overlay/interfaces/GameLaunchEventOptions , .../overlay/interfaces/GamesFilter , .../overlay/interfaces/InjectionError , .../overlay/type-aliases/GameInfo , .../overlay/type-aliases/GameInfoType , .../overlay/type-aliases/GameProcessInfo , .../overlay/type-aliases/GameWindowUpdateReason , .../overlay/type-aliases/GpuPreference , .../overlay/type-aliases/HotkeyCallback , .../overlay/type-aliases/HotkeyState , .../overlay/type-aliases/InstalledGameInfo , .../overlay/type-aliases/PassthroughType , .../overlay/type-aliases/SharedTextureUnavailableReason , .../overlay/type-aliases/ZOrderType

---

## utility (`app.overwolf.packages.utility`)

"Utility methods for tracking and managing game-related events such as game launch, exit, and scanning for installed games."

### interface IOverwolfUtilityApi

| Signature | Behavior (docs) |
| --- | --- |
| `trackGames(filter: GamesFilter): Promise<void>` | Register games to track; matching launches/exits trigger the events below. |
| `scan(filter?: any): Promise<InstalledGameInfo[]>` | Scan for installed games matching the filter. A game installed on several platforms (e.g. Steam and Epic) yields one entry per installation. |
| `installHighElevationHelper?(): Promise<void>` | Same text as on the overlay API (UAC install to `%CommonProgramFiles%\<app-name>`, `HelperInstallError` with `exitCode` 1223 on cancel). |
| `isHighElevationHelperInstalled?(): Promise<boolean>` | Same as on the overlay API. |

| Event | Listener signature |
| --- | --- |
| `"game-launched"` | `(gameInfo: GameInfo) => void` |
| `"game-exit"` | `(gameInfo: GameInfo) => void` |

Note the utility events have no `event` first argument (unlike overlay `game-launched`, which passes `(event, gameInfo)`). `GameInfo`, `GamesFilter` and `InstalledGameInfo` are not linked from the utility pages; the only definitions in the reference are the overlay ones above.

Overview example (as written): `const utility: IOverwolfUtilityApi = new OverwolfUtility(); utility.trackGames({ includeUnsupported: true }); utility.on("game-launched", ...); utility.on("game-exit", ...); await utility.scan();`

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/utility/Overview , .../utility/interfaces/IOverwolfUtilityApi

---

## crn (`app.overwolf.packages.crn`)

Content Recommendation Notification: "a tool that recommends new apps for players that could offer them more value".

### interface IOverwolfCRNApi

| Signature | Behavior |
| --- | --- |
| `allowNotifications(enable: boolean): void` | Enable (`true`) or disable (`false`) notifications. |
| `closeNotificationWindow(): void` | Closes the notification (produces action `'ForceClosed'`). |
| `getNotificationStatus(): Promise<boolean>` | `true` if notifications are allowed. |
| `isNotificationVisible(): Promise<boolean>` | `true` if a notification is currently visible. |

| Event | Listener signature | Notes |
| --- | --- | --- |
| `"before-notification"` | `(event: ICRNEvent, args: any) => void` | Before a notification is shown; typically used to `event.abort()` (e.g. bad timing). |
| `"notification-action"` | `(event: CRNActionType) => void` | A notification action happened. |

### interface ICRNEvent

| Property | Type | Description |
| --- | --- | --- |
| `abort` | `() => void` | Cancels the ongoing event. |

### type CRNActionType

| Value | Meaning |
| --- | --- |
| `'Dismissed'` | User clicked X. |
| `'IgnoredByLaunchingGame'` | Closed because another game launched while displayed. |
| `'Timeout'` | Auto-closed with no user action. |
| `'TurnOffNotificationsRequested'` | User chose "Turn off notifications" from the cogwheel. |
| `'OpenExternalUrl'` | User clicked a notification that opens an external URL. |
| `'DownloadExternalApp'` | User clicked a notification that downloads an external app. |
| `'CancelDownloadExternalApp'` | User clicked Cancel during the download. |
| `'CloseClickedWhileDownloadingExternalApp'` | User clicked X during the download. |
| `'ForceClosed'` | Developer closed it with `closeNotificationWindow()`. |

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/crn/Overview , .../crn/interfaces/IOverwolfCRNApi , .../crn/interfaces/ICRNEvent , .../crn/type-aliases/CRNActionType

---

## recorder (overview only)

Only the recorder Overview page was captured (Apex Squads does not record video). Summary:

- Records audio and video, many encoders, two modes: **Standard** (record start to stop, saved to storage) and **Replay** (cached sliding buffer; specify total buffer time and how much before/after to keep; capture on demand).
- Features: capture from a display or a running game; capture any audio input/output (speakers, mic, game sound alone); split files on demand or by timer; multiple audio/video encoders and output formats; bitrate/encoding-rate control; map audio tracks to devices; a "game listener" for game launch/exit; live usage stats while recording (CPU and memory, free disk, FPS, dropped frames).
- Main interface `IOverwolfRecordingApi` ("starting/stopping recordings, replays, configuring capture settings, and querying system capabilities"). Classes: `Colors`, `RecorderError`. About 70 other interfaces (encoder settings for x264/NVENC/AMF/QuickSync, capture sources: monitor/game/window/image/color, audio devices and filters, `RecordingOptions`, `ReplayOptions`, `SplitOptions`, `RecorderStats`, `CrashDumpOptions`, ...) and ~50 type aliases (encoder presets/profiles/rate controls, `kFileFormat`, `CaptureSourceType`, `ErrorCode`, `ObsHostMode` = `process` (default, OBS standalone process) or `dll` (OBS inside a helper process launched by the app), `CrashDumpType` = `off` / `mini` (default) / `full`, callbacks `StartCallback`, `StopCallback`, `SplitCallback`, `ReplayCallback`, `ReplayStopCallback`). Member details were not downloaded.
- Points to the sample app https://github.com/overwolf/ow-electron-packages-sample for recording driven by GEP events.

Source: https://dev.overwolf.com/ow-electron/reference/Overwolf-electron-APIs/recorder/Overview

---

## Examples: overlay shared texture rendering

Index page: "Worked examples for the overlay package"; one example so far, Shared texture rendering.

Default path: each painted overlay frame is sent to the injected game as a CPU-side pixel copy. `useSharedTexture: true` (BETA) hands the GPU texture directly to the game, lowering per-frame CPU cost (most useful for continuously repainting windows).

Requirements:

- ow-electron 39.8.10 or later (earlier: option ignored).
- Game on D3D11 or D3D12 (D3D9/OpenGL/Vulkan use CPU copy).
- App hardware acceleration enabled: do not call `app.disableHardwareAcceleration()`; window must not set `disableHardwareAcceleration`.
- Offscreen (OSR) overlay windows only.
- Opt-in, default `false`, no migration. It is a top-level `createWindow` option, not a `webPreferences` entry.

```ts
const overlay = app.overwolf.packages.overlay;
const window = await overlay.createWindow({
  name: 'my-shared-texture-overlay', width: 1920, height: 1080, transparent: true,
  useSharedTexture: true,
});
```

Behavior:

- Never a blank overlay: unmet requirement = flag silently ignored, CPU copy path.
- Resolved once at `createWindow`: ow-electron version, offscreen rendering, hardware acceleration. An ineligible window never becomes eligible; destroy and recreate it.
- Re-evaluated per game at runtime: graphics API and availability. Windows follow the active game; no need to recreate on game switch.
- Check the outcome via `GameWindowInfo.isSharedTextureSupported` / `isSharedTextureAvailable` on `game-window-changed` (both `undefined` until injection and graphics detection; `isSharedTextureAvailable` can flip to `false` mid-game).
- `shared-texture-unavailable` reasons table on this page lists `unsupportedGraphicsApi`, `gpuAdapterMismatch`, `copyFailure` (omits `handleTransportBlocked`).
- `setGpuPreference('highPerformance')` fixes `gpuAdapterMismatch` after restart; prompt the user first (persistent, app-wide, keyed on exe path). `getGpuPreference()` tells whether already aligned. Revert with `'default'`.
- BETA limitation: shared-texture windows hit-test the whole bounding rectangle (CPU path passes clicks through fully transparent pixels). A full-screen transparent HUD would swallow clicks across the screen. Workaround: create with `passthrough: 'passThroughAndNotify'`, and from the renderer send IPC on `mouseenter` / `mouseleave` of interactive elements to set `overlayWindow.overlayOptions.passthrough` to `'noPassThrough'` / `'passThroughAndNotify'`. Plain `'passThrough'` would deliver no events to the page, so `mouseenter` could not fire. Alternatives: size the window to its content, or stay on the CPU path.
- Hardware acceleration: `app.disableHardwareAcceleration()` is app-wide, only effective before ready, cannot be undone, and costs WebGL and GPU-composited 3D CSS. `app.isHardwareAccelerationEnabled()` is worth logging because a blocklisted GPU/driver can leave it off silently. Per-window `disableHardwareAcceleration: true` suits small static text windows; keep large continuously repainting HUDs on `useSharedTexture`. Both set on one window: `disableHardwareAcceleration` wins.

Full example from the page (condensed):

```ts
import { app } from 'electron';
import type { SharedTextureUnavailableReason } from '@overwolf/ow-electron-packages-types';
const overlay = app.overwolf.packages.overlay;
overlay.on('game-launched', (event, gameInfo) => { if (gameInfo.supported === true) event.inject(); });
overlay.on('shared-texture-unavailable', async (reason: SharedTextureUnavailableReason) => {
  if (reason !== 'gpuAdapterMismatch') return;
  if ((await overlay.getGpuPreference()) === 'highPerformance') return;
  if (!(await askUserToPinGpu())) return;
  await overlay.setGpuPreference('highPerformance');
  promptUserToRestart();
});
async function createOverlayWindow() {
  return overlay.createWindow({ name: 'in-game-hud', width: 1920, height: 1080, transparent: true, useSharedTexture: true });
}
```

Source: https://dev.overwolf.com/ow-electron/reference/examples/overlay , https://dev.overwolf.com/ow-electron/reference/examples/overlay/shared-texture-rendering

---

## Overwolf OIDC (SSO)

Overwolf runs an OAuth2 + OpenID Connect server at `id.overwolf.com` so apps/sites can let users log in with their Overwolf account. Authorization uses PKCE (authorization code flow).

- Discovery document: `https://id.overwolf.com/oidc/.well-known/openid-configuration`
- Endpoints named in the page: authorize `https://id.overwolf.com/oidc/auth`, token `https://id.overwolf.com/oidc/token`, userinfo `https://id.overwolf.com/oidc/me`, dynamic registration `https://id.overwolf.com/oidc/reg`.

Scopes:

| Scope | Grants |
| --- | --- |
| `openid` | Minimum; the Overwolf user id (`sub` claim). |
| `email` | The user's email. |
| `profile` | Profile details (username, nickname, picture). |
| `offline_access` | A refresh token (new access tokens without user interaction). |
| `subscriptions` | The user's subscription details for your service. |

Registering a client:

1. Get an initial registration token from your DevRel contact.
2. `POST /oidc/reg` (Host `id.overwolf.com`, `Content-Type: application/json`, `Authorization: Bearer <initial registration token>`) with `redirect_uris[]`, `post_logout_redirect_uris[]`, `client_name`, `logo_uri`, `policy_uri`, `tos_uri`.
3. Response includes `client_id`, `client_secret`, `registration_access_token` (save it safely), `registration_client_uri` (`https://id.overwolf.com/oidc/reg/<client_id>`), and defaults such as `application_type: "web"`, `grant_types: ["refresh_token","authorization_code"]`, `response_types: ["code"]`, `id_token_signed_response_alg: "RS256"`, `token_endpoint_auth_method: "client_secret_post"`, `subject_type: "public"`, `client_secret_expires_at: 0`.
4. Manage: `GET /oidc/reg/<client_id>` and `PUT /oidc/reg/<client_id>` (same body plus `client_id`), both with `Authorization: Bearer <registration access token>`.

Login flow:

1. Generate a code verifier, hash it into a code challenge, keep the verifier.
2. Redirect to `https://id.overwolf.com/oidc/auth` with `response_type=code`, `client_id`, `redirect_uri` (URL-encoded), `scope` (e.g. `openid%20profile`), `code_challenge`, `code_challenge_method=S256`, `state=<random>`.
3. User returns to `redirect_uri` with `code`. `POST /oidc/token` as `application/x-www-form-urlencoded`: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`, `code_verifier`. Response has `access_token` (and `refresh_token` when requested).
4. `GET https://id.overwolf.com/oidc/me` with `Authorization: Bearer <access_token>`.
5. Handle users who decline some scopes (e.g. `subscriptions` or `email`).

The same flow works for website login ("Login with Overwolf" button redirecting to `/oidc/auth`; the page's button example omits the PKCE parameters).

Source: https://dev.overwolf.com/ow-electron/reference/overwolf-oidc/ow-oidc

---

## Contradictions and gaps

GEP

- `setRequiredFeatures(gameId, features: string[] | undefined)`: the reference never says what `undefined` means, never mentions `null`, and does not say whether an unknown or empty list rejects. The Overview says to pass "the feature names your app needs". Passing `null` for "all features" is not documented in these pages (it may be in the GEP guide pages, which belong to another file of this knowledge base).
- `getFeatures` returns the features the game **supports**, not those you subscribed to. The reference gives no reason it would return an empty array and does not say when the list becomes available (before or after `enable()`, before or after the game finishes loading).
- `setRequiredFeatures` returns "Promise reporting the success of the operation". It does not say it rejects on failure, or that a resolved promise means features are active.
- `getSupportedGames(): Promise<object[]>` in the docs vs `Promise<{ name: string; id: number }[]>` in installed typings 1.1.11.
- The Overview says `elevated-privileges-required` fires "instead" of `game-detected`; the event page only says the app must also run as administrator. The high-elevation helper (`installHighElevationHelper`) is documented only for overlay and utility, not GEP.
- No event-order guarantees are documented for GEP (e.g. whether `game-detected` can fire for a game that was already running when the package became ready, or whether it fires again after a package crash/relaunch).

Packages

- `crashed` listener is `(event, canRecover)`, with no package name, so a listener cannot tell which package crashed. The docs do not say whether `ready` fires again after an automatic relaunch or whether listeners registered on the package object (e.g. on `gep`) survive the relaunch.
- CRN is called "crash report and notification system" / "crash reporting and notification APIs" in the packages Overview and `OWPackages`, but "Content Recommendation Notification" everywhere in the crn section.
- `setChannel` "throws" if the package is not in `package.json`, but `SetChannelResult.error: 'invalid-package'` covers "package not found on the server": two different failure paths.
- The packages Overview example uses `overwolf.packages as OWPackages` (there is no global `overwolf` in ow-electron; elsewhere it is `app.overwolf.packages`) and calls `recorder.startRecording({ filePath, audioTrack })`, whose types are not in the captured pages.
- The utility Overview example constructs `new OverwolfUtility()`, unlike every other page which reaches packages through `app.overwolf.packages`.

App

- `disableAnonymousAnalytics` must be called before app.ready; `disableAdsOptimization` and `disableAdsFPD` state no timing.
- `ExternalPaymentUserIdOptions.providerName` is required in the table but described as defaulting to `'tebex'`.
- `setUserEmailHashes` links a Chromium accessibility design doc for email normalization, which appears to be the wrong link.

Overlay

- `enterExclusiveMode` is "only supported when `canInterceptInput` is `false`" while `exitExclusiveMode` is "only effective if `canInterceptInput` is `true`". Read literally, you enter when the overlay cannot intercept input (hidden cursor games like Apex), and exit when it can (because exclusive mode is on). Inference: `canInterceptInput` becomes `true` while exclusive mode is active. Not stated explicitly.
- `takeScreenshot(): Promise<void>` but "resolves with the absolute path the file was actually written to", and the example uses the resolved value.
- `GameInfo` has `supported` and `name`, but examples use `gameInfo.isSupported` (GameLaunchEvent page) and `gameInfo.title` (ActiveGameInfo page, `game-exit` example). Use `supported` / `name`.
- `GameInfo` example IDs: "League of Legends game class id is: 54261", "game id is: 5426". Inference: these look swapped relative to Overwolf's usual convention (class id 5426, game id 54261), and `registerGames`' `GamesFilter.gamesIds` vs `requestGameInjection(classId)` do not say which id space they use. For Apex, GEP uses 21566 (the value in `src/recorder.ts`); the overlay pages give no Apex id.
- `OverlayBrowserWindow.overlayOptions` is `readonly` in the table, but the shared-texture example assigns `overlayOptions.passthrough` and calls it writable (the reference to the object is readonly, its fields apparently not).
- `PassthroughType` description spells the second value `PassThrough`; the type is `"passThrough"`.
- `ExclusiveInputOptions.backgroundColor` default is written `'rgba(12, 12, 12, , 0.5)'` (extra comma).
- `useSharedTexture` is "Since 2.0.2" (overlay package version) while the example page states "ow-electron 39.8.10 or later" (runtime version); both apply.
- The example page's reasons table omits `handleTransportBlocked`.
- `InjectionError` is defined but not used by any documented signature (`game-injection-error` passes `error: string`).
- OOPO is never defined.
- `GameLaunchEvent.inject` is "Since 1.8.0" but the event itself predates it (inference: the since tag refers to the `options` parameter).

Utility

- Methods reference `GameInfo`, `GamesFilter`, `InstalledGameInfo` without links; the only definitions are in overlay. `scan(filter?: any)` has an untyped filter.

OIDC

- The HTTP spec for `/oidc/token` uses `application/x-www-form-urlencoded`, but the code sample posts a plain object with axios (which sends JSON by default). Follow the form-encoded spec.
- The website "Login with Overwolf" button omits `code_challenge` although the page says the server uses PKCE.

Recorder

- Only the Overview was captured; no member signatures here. Read `.../recorder/interfaces/IOverwolfRecordingApi` before using it.

---

## Notes for Apex Squads (src/main.ts)

What `src/main.ts` does, checked against the reference:

1. `app.overwolf.disableAnonymousAnalytics()` before app ready: matches the docs ("should be called before app.ready"). `disableAdsOptimization()` also runs early; the docs give no timing for it, so the comment "Must run before app ready" is only documented for analytics. If ads are added later, note the related `disableAdsFPD()`, `isCMPRequired()` / `openCMPWindow()` and `generateUserEmailHashes()` / `setUserEmailHashes()` (after ready), which main.ts does not use.
2. Package events: listens to `ready`, `failed-to-initialize`, `crashed` with the documented signatures. Not handled: `loading` (fires before `ready`), `updated`, `package-update-pending` (with `hasPendingUpdates()` / `relaunch()`).
3. `crashed` handler: logs `canRecover` only (the docs pass no package name, so this is all that is available). It does not call `event.preventDefault()`, so per the docs the package automatically tries to relaunch itself. The docs do not say whether `ready` fires again afterwards. main.ts is written for that case: its `ready` handler calls `setupGep()`, which starts with `gep.removeAllListeners()` so re-registration does not duplicate listeners. Inference: if the relaunched package is a new object, `app.overwolf.packages.gep` is re-read on each `ready`, which is correct. If `ready` does not fire again after a crash, nothing re-subscribes features for a game already running; the docs give no event to detect that.
4. `gep.removeAllListeners()` removes every listener on the gep emitter, including any added elsewhere. The Node text reproduced on the gep page calls this "bad practice" for emitters owned by other components. Harmless today since main.ts is the only subscriber.
5. `game-detected`: filters on `gameId === APEX_GAME_ID` (21566), calls `event.enable()`, then `registerFeatures`. Matches the documented flow. The docs do not say whether `setRequiredFeatures` may be called synchronously right after `enable()` or must wait. main.ts does not wait, relying on its retry loop.
6. `setRequiredFeatures(APEX_GAME_ID, null as unknown as undefined)`: the typed signature is `string[] | undefined`. The reference does not document `null` or `undefined` as "all features". The code comment cites "Overwolf's own sample"; that sample is not part of these pages.
7. **"Subscribed to N features" does not report subscriptions.** It logs `getFeatures(APEX_GAME_ID).length`, and the docs define `getFeatures` as the game's **supported** features, independent of what `setRequiredFeatures` set. So "Subscribed to 0 features" means GEP reported an empty supported-features list at that moment. The reference gives no cause. Inferences, none confirmed by the docs:
   - GEP had not finished initializing the game's provider right after `enable()`, so the list was still empty.
   - `setRequiredFeatures` resolved even though nothing was registered. The docs never promise that a resolved promise means success with features active, so the retry loop, which only retries on a thrown error, stops at the first resolve even if the list is empty.
   - `null` was not treated as "all".

   Possible hardening (suggestions, not doc guidance): treat `features.length === 0` as a failed attempt and retry; or first call `getFeatures`, then pass that explicit array to `setRequiredFeatures`, which is the documented contract ("Array of required Game Event Features"). Compare with the `new-info-update` / `new-game-event` traffic that actually arrives. The docs say events are only emitted for registered features, so (inference) events arriving at all mean some registration took effect, whatever the logged count says.
8. `getInfo(APEX_GAME_ID)` returns `Promise<any>` with no documented shape. main.ts wraps it in try/catch, which suits an untyped contract.
9. `error` listener signature `(event, gameId, error: string, ...args)` matches. Registering an `error` listener also matters on a Node EventEmitter: an emitted `'error'` with no listener throws (Node semantics, inference; the page only says the event name may be 'error' or `errorMonitor`).
10. `game-exit` listener uses `(_e, gameId, gameName)`. The docs also pass `pid`, `processName`, `processPath`, `commandLine`, which main.ts ignores.
11. `elevated-privileges-required`: main.ts logs and records it. Per the Overview this fires **instead of** `game-detected`, so no features get set in that session unless the app itself runs elevated. The overlay/utility `installHighElevationHelper()` is documented only for overlay injection into elevated games, not for GEP.

Planning the in-game overlay (from these pages):

- Add `"overlay"` to `package.json` `overwolf.packages`; wait for the packages `ready` event with `packageName === 'overlay'`, then use `app.overwolf.packages.overlay` (same pattern as gep).
- `registerGames({ gamesIds: [...] })` then `on('game-launched', (event, gameInfo) => event.inject())`, then `game-injected`. Which id to put in `gamesIds` for Apex is not stated in the reference (see the classId/id note in gaps). Inference: try 21566 and verify with `gameInfo.classId` / `gameInfo.id` from a `game-launched` with `registerGames({ all: true })`.
- Apex is named by the docs as an **exclusive mode** game: the cursor is hidden, so the user can only interact with overlay windows after `enterExclusiveMode()` (typically bound to a hotkey via `overlay.hotkeys.register`, with `passthrough: false` so the key does not reach the game) and must leave with `exitExclusiveMode()`. Watch `game-input-exclusive-mode-changed`. Purely informational HUD windows (kill/lobby cards) can use `passthrough: 'passThrough'` so they never steal input. Inference: Apex's hidden cursor means `noPassThrough` windows would still block clicks under them.
- `createWindow({ name, width, height, transparent: true, ... })`: `name` is required and unique. Window geometry is only reliable after the first `game-window-changed` (`GameWindowInfo` is undefined before that).
- `useSharedTexture` is BETA and needs a D3D11/D3D12 game. Inference: Apex runs on D3D11 (DX12 is optional in newer builds); not stated in these pages. With a full-screen transparent window, its whole-rectangle hit-testing would block clicks; the documented workaround is `passThroughAndNotify` plus per-element IPC toggling. For a first overlay, the default CPU path is simpler.
- If Apex runs elevated, overlay injection needs `installHighElevationHelper()` (UAC prompt; exitCode 1223 = user cancelled).
- Closing overlay windows on `game-exit` (overlay's own event: `(gameInfo, wasInjected)`, no leading `event` argument, different from GEP's `game-exit`).
