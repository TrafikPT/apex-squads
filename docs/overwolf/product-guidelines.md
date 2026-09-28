# Overwolf ow-electron: product guidelines and growth

Distilled from dev.overwolf.com/ow-electron on 2026-09-28. Check the source URL before relying on anything time-sensitive.

Additions marked "Discord" come from the Overwolf Developers Discord (exported 2026-09-28; see README.md "Sources"). "Staff" means a post by an Overwolf Team member; "member" means another developer, so treat it as experience, not policy.

Scope: the 25 pages under `guides/product-guidelines/` and the 8 pages under `guides/growth/`. All URLs below are prefixed `https://dev.overwolf.com/ow-electron/`. Some page slugs contain typos in the real URL (`desktop-scrreens`, `branding-intelectual-property`); they are kept as-is.

How to read this file:

- "Required" lists only statements the docs phrase as must / required / never / always, or that an API enforces. "Recommended" lists everything phrased as should / best practice / consider.
- Almost everything in these pages is phrased as a recommendation. Very few lines are hard requirements. However, other pages (not part of this set) say the DevRel QA team verifies apps against "the guidelines and standards" (see "Contradictions and gaps"), so treat the recommendations as the likely QA checklist.
- Several topics requested for this file (tray icon, minimize/close behavior, auto-launch, "front app", localization, performance numbers) are not covered by any of these pages. They are listed in "Contradictions and gaps", not invented here.

---

## 1. Product guidelines overview

The product guidelines are grouped into five areas:

- User Onboarding Experience: "requirements for first-time user flows, installations, and initial feature discovery."
- App Screens and Behavior: "standards for window management, overlay transitions, and how your app interacts with the game environment."
- App Identity and Compliance: "essential rules regarding branding, legal requirements, and technical compliance for app approval."
- Informing Users: communication, notifications, and "ensuring users understand your app's value and data usage."
- User Engagement: retention and interaction.

The overview calls these "the standards and best practices required to build a successful app on Overwolf" and says they "ensure your product remains compliant".

Source: guides/product-guidelines/overview

---

## 2. App screens and window behavior

### 2.1 Screen sizes and the default window

General principle: "Overwolf apps should act like native desktop applications and not like a website." They "should prioritize clear and useful information within a compact layout that isn't always full-screen." Design "with ad integration in mind" to avoid redesign later.

Popular resolutions to design for:

| Resolution | Share (as stated) |
|---|---|
| 1920x1080 (1080p, FHD) | "the majority of users" |
| 2560x1440 (1440p, QHD) | "second most popular choice, though less common" |
| 1366x768 (HD), 3840x2160 (4K UHD) | "a smaller portion of users" |
| 3440x1440 (UltraWide QHD), 1920x1200, 1600x900, 2560x1600, others | "a very small percentage (~1%)" |

Required:

- Ad policy (flagged "important" in the docs): "the minimum resizing of your app's window shouldn't be smaller than the ad container." (Worded "shouldn't", but tied to ad policy compliance; applies once ads are integrated.)

Recommended:

- "Avoid launching apps on full screen unless this was set by the user."
- "Design for smaller screens - ensure the default window size is compatible with smaller, popular screen sizes": "15" and 13" screens and 1280x720 or 1440x900".
- Allow resizing: "users should be able to dynamically resize the app to their preferred dimensions."
- Use a 16:9 aspect ratio. Recommended default desktop size: **1300x840px** "to allow for optimal ad layouts" (links to monetization/advertising/standard-ads/recommended-ads-layouts).
- Give each window a name as well as a size (see 2.7).
- In-game overlay behavior (from this page):
  - Keep sticky overlay elements non-intrusive; do not cover key game HUD areas.
  - Let users adjust overlay position and resize it.
  - Avoid opening the in-game screen full size on the main or a second screen ("Users often cover or close full-screen apps on a second monitor").
  - Hotkeys and interactions should work across different screen setups.

Source: guides/product-guidelines/app-screen-behavior/app-screen-sizes

### 2.2 Desktop screen

Role: the out-of-game hub "for navigation, settings, and deeper engagement". It is where users "first land", so it is the best place for key features, recent activity and updates. Used mainly when the user is not playing; ideal for: app settings and customization, community and social features, support resources (FAQs, bug reporting), rating and feedback, subscription and monetization.

Recommended:

- "Set clear expectations": if the app needs a game connection or a minimum number of matches before showing data, tell users upfront.
- Use the desktop for more detailed content than overlays.
- "Keep it separate from In-Game screens": the desktop screen "should function as a separate window, both technically and from a UX perspective".
- Monetize here with ads and subscriptions.

Source: guides/product-guidelines/app-screen-behavior/desktop-scrreens

### 2.3 In-game and overlay windows

Types of in-game windows named by the docs:

- Lobby Screen: before a match (player stats, team details).
- Loading Screen: while the game loads (tips, player stats).
- In-Game Overlay: real-time data, recommendations, stats during play.
- Widgets: "small, floating elements" (timers, scores, status indicators).
- Second Screen: companion display (see 2.5).

Recommended design points:

- Hotkey reminders: "include reminders in widgets/screens and use notification prompts."
- "Avoid Blocking Game UI - ensure overlays don't interfere with critical gameplay elements."
- "Opacity Considerations - avoid using semi-transparent widgets or overlays that reduce clarity and game performance."
- Show context-relevant, dynamic, game-specific data.

Overlay modes:

- Standard mode: games with a mouse cursor during play (MOBA: League of Legends, Dota 2). Users interact with app windows without pulling input focus from the game.
- Exclusive mode: games without a cursor (FPS: CS2, Fortnite named). "the only way to interact with the Overwolf app window is by activating exclusive mode." It "will show a semi-transparent window overlaid on the game window and doesn't allow keyboard or mouse input to pass into the game." Use a hotkey to toggle exclusive mode; "Provide a hotkey in your app and the option for users to change and configure the hotkey of their choice" (links to `IOverwolfOverlayApi#enterexclusivemode`).

Special overlays: CSGO, Warzone and Destiny 2 have extra limits. In non-borderless fullscreen, exclusive mode is completely disabled; the app can only notify the user to switch to fullscreen borderless or windowed. "Overwolf allows capturing these games ONLY in fullscreen-borderless mode." (The same paragraph also says capture does not work in windowed mode; see "Contradictions and gaps".) Apex Legends is not named in this list.

From the Discord (members; native-era experience that carries over):
- **DPI and scaling** break window positioning more than screen size does: "when over 100 or 150% overwolf will have problem positioning the overlay correctly" (2024-03-20). Overwolf's user-facing article: https://support.overwolf.com/en/support/solutions/articles/9000176964-scaling-overwolf-apps-to-appear-properly-with-a-high-dpi-setting. Advice given: support the most common resolution/DPI combinations and call the rest unsupported. ow-electron's overlay has `dpiAware` (fixed for ow-electron 42 in Aug 2026).
- **Reuse windows** instead of creating and destroying one per event: a long-running app hit memory leaks from destroyed windows whose scripts lingered, with 5-15 widgets per match (2022-09). Keep the card window alive and hide or show it.
- **Borderless**: for full-screen games, run the game in borderless windowed mode during development to stop the screen flashing on every alt-tab (2024-05-07). Plain always-on-top windows likely show over Apex only in borderless or windowed mode (inference, untested).

Source: guides/product-guidelines/app-screen-behavior/in-game-overlays

### 2.4 Hotkeys, settings, and the hotkey reminder

Key statements:

- Hotkeys are the way to interact with the in-game overlay; "even more crucial in games where users can't access a mouse cursor, such as FPS titles or games running in exclusive mode."
- "Make sure users can easily manage hotkey settings from your app's settings panel."
- "Hotkeys are set inside your app's own settings panel (typically on the desktop view), not through the Overwolf client itself."
- Hotkey reminder: "If an overlay or secondary window doesn't open automatically, it's helpful to notify users about the relevant hotkey through reminders or tips in your UI."
- Conflicts: "Notify users which hotkeys are assigned and when they are changed. When possible, check for conflicts with hotkeys from other apps".
- Platform fact (flagged "important"): "All app hotkeys removed once the extension is uninstalled."

Hotkey types:

| Type | Behavior |
|---|---|
| Toggle | Show/hide the app with one keypress without closing it. "It can activate/launch your app even if the app is closed." Can launch the in-game window. Does not work properly with a transparent background controller window; use a custom hotkey instead. |
| Custom | Assign an action (open a window, trigger a feature). "Custom hotkeys will only function when your app is already running ... Using a custom hotkey with the app closed will do nothing." |
| Hold | Active while the key is held, stops on release (like holding Tab for a scoreboard). Callback receives `state == 'pressed'` / `'released'`. |
| Global | Access app functions across multiple games or outside a single title. |

API (ow-electron overlay package, `IOverlayHotkeys`), as shown in the docs:

- `register(hotKey: IOverlayHotkey, callback: HotkeyCallback): void;` - example object `{ name: 'show/hide', keyCode: 72, modifiers: { ctrl: true }, passthrough: true }`, callback `(hotkey, state) => {...}`.
- `all(): IOverlayHotkey[];` - current hotkey values.
- `unregister(name: string): boolean;`
- `unregisterAll(): void;`
- `passthrough` property on `IOverlayHotkey`: "The key combination will trigger your app hotkey and then will passthrough the game."

Required: none phrased as must.

Recommended:

- Provide a way to reassign hotkeys "directly from within your app" (via `all` / `register` / `unregister` / `unregisterAll`).
- Provide a passthrough option so the hotkey does not interfere with game keys.
- Remind users of hotkeys for windows that do not open automatically.
- Avoid and check for conflicts; notify users of assignments and changes.
- (From getting-started/develop-your-idea, not in this page set: "assign intuitive defaults, let users rebind keys via the app's settings, and provide clear, non-intrusive visual feedback".)

Source: guides/product-guidelines/app-screen-behavior/hot-key-and-settings

### 2.5 Second screen

Facts: "Over 30% of Overwolf users have multiple screens". Types: Main window (desktop-sized, larger ad placements), Companion screen (compact), Multi-app screens (several windows). Users "cannot interact with this screen during gameplay, so ensure all the content is viewable at a glance." Avoid excessive content ("overwhelming or spammy").

Recommended (worded "should"):

- "Second screen windows should launch automatically."
- "Second screen windows should include a hotkey or a close button at the top."
- Allow resizing; if not supported, fit the most common sizes "using 1920X1080 as the default."
- Enable hotkey support for quick toggling.
- Implement second-screen early (eases later monetization).
- Keep the window in the same screen location; keep it on the desktop; "Create a desktop only window (which improves performance)."
- "If you app runs on a second screen with the game, disable any kind of hardware acceleration on the GPU."
- Identify which screen is the second screen; use the transparent background window to share data between windows.

Implementation guidance (best practice):

- Display picker populated at runtime from the OS (`screen.getAllDisplays()`, `screen.getPrimaryDisplay()`), exposed via two `ipcMain` handlers (list + saved selection; set display by ID and persist) with matching `contextBridge` entries. Each entry: `id`, `label`, `bounds` (width/height), `scaleFactor`, primary status. Renderer calls `getDisplays()` on mount; option labels show name, resolution, scale factor; on change call `setWindowDisplay(id)` immediately, "No save button needed".
- Persist the display ID as JSON in a file in `app.getPath('userData')`; on startup, if the saved display is missing, clear it and fall back to `screen.getPrimaryDisplay()`. Load settings inside `createAndShow()` (after `app.whenReady()`), not the constructor.
- Game-aware relocation: on overlay `'game-injected'`, read `getActiveGameInfo()?.gameWindowInfo?.screen`; fallback `'game-window-changed'` (window.screen, "since overlay v1.5.11"); reset on `'game-exit'`. If the app is on the game's display (`screen.getDisplayNearestPoint()` on window center), move it to another display without changing the saved preference; on game exit move back to the saved display.
- DPI-aware sizing: compute size in physical pixels against a reference (e.g. 1920x1080), divide by target `scaleFactor`, clamp to 96% of the display `workArea`, enforce a minimum size. When moving between monitors with different DPI: call `unmaximize()`, then `setPosition` to a point inside the target `workArea`, then `setBounds` (maximized windows ignore `setBounds`; Windows interprets direct `setBounds` in the source display's DPI context).

Source: guides/product-guidelines/app-screen-behavior/second-screen

### 2.6 Post-game behavior

Recommended post-match content: match stats summary (kills, damage, objectives), player comparison with teammates/opponents, event highlights (auto clips), performance insights and improvement tips, achievements and progression, monetization opportunities (premium features, IAP, recommendations; users are "in a more relaxed, engaged state"). Also: a way to connect results with social media.

Source: guides/product-guidelines/app-screen-behavior/post-game-behavior

### 2.7 Window names

| Item | Value |
|---|---|
| Applies to | desktop windows (`BrowserWindow`) and overlay windows (`overlay.createWindow`) |
| Option | `name`, top-level on the window options object |
| Required | "Optional on `BrowserWindow`, required on overlay windows. Overwolf recommends setting it on every window." |
| Limit | 20 characters |

- Every window reports Developers Console data (performance and revenue statistics) under its window name. Without `name`, a `BrowserWindow` "reports under a value derived from its URL instead."
- `name` "may become required in a future ow-electron version" for `BrowserWindow`.
- `name` is not Electron's `title` and not DOM `window.name`; it "is never shown to the user". Setting one does not set the other.
- Naming rules: <= 20 characters ("Longer names aren't supported"); describe the screen not the file (`desktop`, not `desktop.html`); lowercase with hyphens (`main-window`, `in-game`, `post-game`); one name per logical screen, reused across versions; "Never build the name from a value that varies per user or per session."
- Renaming does not rewrite old data; old and new names show side by side until rollout completes. "pick a name you can keep."
- Examples in the docs: `new BrowserWindow({ name: 'desktop', width: 1300, height: 840 })`; `overlay.createWindow({ name: 'in-game', width: 400, height: 600, transparent: true })` with `overlay = app.overwolf.packages.overlay`.

Required: `name` on overlay windows (API). Recommended: `name` on every `BrowserWindow`.

Source: guides/product-guidelines/app-screen-behavior/window-names

---

## 3. Onboarding

### 3.1 Installer and desktop icons

- Overwolf provides the installer; no separate installer needed. If the Overwolf client is installed, the app installs right away; otherwise the client is installed along with the app.
- After installation "the user will have new desktop icons for your app, and clicking it will open your app in Desktop mode." ("For more information, see Desktop mode" has no link.)
- Required components of the app: see "Submitting your app" (getting-started/project-roadmap#step-5---submit-your-app-idea), not in this page set.

Source: guides/product-guidelines/onboarding/installer-desktop-icons

### 3.2 First time user experience (FTUE)

- UX and design "should be able to work in all scenarios where the user first encounters your app (e.g. in game, desktop, etc.)".
- Welcome screen: presents the core value and main features when the app first opens. Design around promotional content, engagement, conversion. "Dismissible by adding clear to see skip or close button."
- Coach marks (tooltips, guided walkthroughs, daily startup tips, instruction page): "You should make your coach marks dismissible using an enable/disable option in the app's settings."
- Demos/tutorials: interactive (simulated app), as short as possible, "Allow users to skip or revisit tutorials as needed."
- Where to implement:
  - Desktop first screen (post-installation): core value, main features, purpose; optional log-in/sign-up; brief.
  - In-game: guide users on overlays and widgets; use empty states with a short explanation; seamless and non-intrusive, "Users should not feel interrupted."
  - Post-match screen: introduce analytics/insights first seen; quick, scannable overview; introduce offers subtly.
- Balance: do not overwhelm; "Make interactions skimmable and skippable ... you should always allow them to skip this part."; show FTUE again for new features to existing users.
- Reference Figma: https://www.figma.com/community/file/1507001157782424803/overwolf-apps-ftue

Required: none phrased as must. Recommended: everything above; skippability appears repeatedly ("always allow them to skip").

Source: guides/product-guidelines/onboarding/ftue

### 3.3 Home screen

- Central hub for navigation; clear starting point and first impression; re-engages with updates.
- Users expect: simple layout, easy access to frequent features, relevant updates/notifications, "Clear instructions if a game connection or match history is required", seamless transition to in-game/second-screen experiences.
- Performance: "minimizing load times and by avoiding heavy animations."
- Consider monetization options when designing it.

Source: guides/product-guidelines/onboarding/home-screen-design

### 3.4 User login

Login is optional ("Consider designing your app with a login feature"). Benefits: personalization, external account data (Steam, Twitch), authentication for profiles/cloud storage, monetization (hashed emails for ad targeting).

Methods: Overwolf OIDC (reference/overwolf-oidc/ow-oidc), third-party SSO (Steam, Twitch), custom login ("Not the best practice").

If offering login: offer a Guest Mode; single-page sign-up with minimal fields; drop redundant fields (e.g. password confirmation); use Google or other leading SSO; clearly separate Login and Sign-Up pages and say clearly when an email has no account. Figma: https://www.figma.com/design/VMAKI8WRrLPSFsCSkxiDxR/Login-and-Signup?node-id=0-1&t=t2hDzINSYtW2Q8Mw-1

Source: guides/product-guidelines/onboarding/user-login-experience

---

## 4. Informing users (notifications, errors, status)

### 4.1 Pop-ups

Definition: "Pop-ups are interactive overlays that appear in the desktop environment of your app and never during gameplay." Uses: time-sensitive promotions, system notifications, prompting actions, feature walkthroughs.

Required:

- "Desktop-only implementation - ensure pop-ups are triggered only on the desktop and never while the user is actively playing a game."
- "Clear close option - always provide an easy-to-find close button."

Recommended: do not show too frequently; subtle background dimming; short messages.

Source: guides/product-guidelines/informing-users/pop-ups

### 4.2 Communicating errors

Identify likely failure points and add targeted messages. Example Overwolf-app errors: game API not available; champion data could not be fetched; connectivity/network errors.

| Type | When | Best practices |
|---|---|---|
| Validation | user input breaks rules | specific wording ("Please enter a valid email address" not "Invalid input"); inline next to the field; "jump to error"; no jargon |
| System | backend failures (HTTP 500, 503, crashes) | simple language; steps to self-diagnose or report the bug; do not expose sensitive/confusing details; offer retry or support contact |
| Connection | cannot reach server/service | say what happened and what to do; easy retry; consider offline caching or queuing |
| Action failure / warning | an action cannot complete | state what failed and why; suggest next step (retry, permissions, contact support); warn before risky actions (deleting data) |
| Informational | limitations, known issues, maintenance, outdated version | calm tone; mention if delay is possible; neutral visuals ("not red or alarming icons"); link to more info |

Some errors relate directly to GEP events and service status (see 4.4).

Source: guides/product-guidelines/informing-users/communicating-errors

### 4.3 Empty states

Types with the docs' example copy:

- First-time use: "No highlights yet? Play a game, and we'll capture your best moments automatically!"
- No data: "Looks like you haven't played any matches yet. Start playing, and your stats will appear here!"
- Error/connection: "We're having trouble retrieving your game data. Please check your connection and try again."
- Completed: "You're all caught up! No new notifications for now."

Best practices: concise; use visuals (icons, illustrations, small animations); provide an actionable next step (button/link); consistent tone; show empathy in error states.

Source: guides/product-guidelines/informing-users/empty-states

### 4.4 Service status (GEP event health)

- Service status = operational health of the game events the app uses (available, may be unavailable, unavailable, unsupported). See live-game-data-gep/verifying-events-for-your-app (event health levels table) and live-game-data-gep/game-events-status-health.
- Communicate disruptions (caused by game updates, studio requests, data discrepancies) to avoid frustration and bad reviews.
- Recommended: integrate the public Event Status Endpoints (live-game-data-gep/verifying-events-for-your-app#review-event-status-for-all-games) to toggle features by event health, switch to fallback logic, and show a visual/text indicator of issues.

- Discord: GEP for the top-10 games was 98.4% stable in 2024, with game patches the main cause of downtime (staff, 2024-11-12). Whole-game disables happen too: Apex GEP and overlay are off from 2026-09-29 for EA's anti-cheat update (gep-and-compliance.md section 5).

Source: guides/product-guidelines/informing-users/service-status

### 4.5 Tooltips

Use to explain non-obvious functions, define terms, give tips, clarify icons. A good tooltip is concise "(ideally under 10 words)", clear, and relevant only to its element. Not "mini help articles".

Source: guides/product-guidelines/informing-users/tool-tips

### 4.6 FAQ

Recommended in-app FAQ: keep it updated; focus on common pain points; organize by category (Account, Features, Troubleshooting); plain language; accessible from a dedicated help/support section, linked from error messages and onboarding; link to support channels/forums; visuals and GIFs; collapsible sections or chatbot; use FAQ search data for product decisions.

Source: guides/product-guidelines/informing-users/add-an-faq

### 4.7 Release notes

- The Developers Console has a release notes feature (developers-console/releases-management/release-management#release-notes); notes are version-specific and "visible directly in the app store", integrated into the release workflow.
- Types: major, minor, hotfix, beta/experimental, security (security "should be clearly communicated").
- Writing: always include version number or date; plain language; structure (summary, new features, fixes, improvements, known issues); focus on user impact; bullet points; honest; friendly tone.
- Visibility: "users should have access to past updates whenever needed, not just when a release note pops up."; highlight the most important change with a visual hero banner.

Source: guides/product-guidelines/informing-users/release-notes

---

## 5. User engagement

### 5.1 Community

- Discord is most popular; Reddit, Telegram, in-app forums also work.
- Integrate: a Community icon in top or side navigation linking to Discord/forum/subreddit; invite new users during onboarding; invite discussion in patch notes; point Support/FAQ to community channels; in-app chat or notifications.
- Manage: right platform; clear rules and moderation; engage regularly; exclusive content/events (AMAs, giveaways, sneak peeks); feature user content; use feedback for the roadmap.

Source: guides/product-guidelines/user-engagement/community

### 5.2 Ratings and reviews

- Wait for "at least 3–5 meaningful interactions" before asking.
- Ask after a positive moment (level completed, achievement, new feature discovered).
- Optional small incentive (in-app currency, content, feature unlock), low-friction.
- Smart follow-up: 1–3 stars -> route to support / private details (can add logs); 4–5 stars -> thank and invite a public store review.
- "Avoid prompting users too often or during active gameplay."
- Figma: https://www.figma.com/design/HXawRAst1eEgOdyzoT16uK/Review---Support--Community-?node-id=225-374&t=PuyEZ1dv7p5jfntd-1

Source: guides/product-guidelines/user-engagement/ratings-reviews

### 5.3 User support

- Choose a platform gamers know (Discord, email: "easy, and cost effective (free)").
- Support conduct: complete profile (name, picture, role); greet/tag the user; ask precise questions to reproduce; end positively, refer to Discord.
- Add a knowledge base / help center (text, pictures, videos).
- Essential in-app support features: support icon in the top bar or side navigation; proactive issue detection (on crash/issue, inform and guide to support); FAQ and self-help (coach marks, FTUE); "Bug reporting feature - users should be able to report bugs easily from within the app."
- In-app channels: support button, Discord channel, help bot, help center/FAQ.
- "Implement Bug reporting with Logs in your app".

Source: guides/product-guidelines/user-engagement/user-support

### 5.4 Uninstall survey

- 15–30 second window; "Limit the survey to a maximum of 3-5 questions."; mostly multiple choice; final question open-ended; adjust terminology to your product; explain purpose; offer alternatives (e.g. forums for patch issues); update periodically.
- The page gives example question banks: primary uninstall reason (13 options, including "I am afraid I'll get banned for using the app", "I liked the app, I just don't want to use Overwolf", "The adverts were annoying me"), technical/performance, product utility/onboarding, pricing, overall experience (1–10 rating, contact email, logs/images).
- No mechanism for showing the survey in ow-electron is described on this page.

Source: guides/product-guidelines/user-engagement/uninstall-survey

---

## 6. Branding, app identity and IP compliance

Required:

- Third-party content rules of the game: "some games have their own guidelines for third-party content, so you must ensure your app complies with these guidelines. Overwolf won't be able to publish an app that breaks them, infringes on game compliance or on another app's intellectual property."
- "Overly Similar Apps May Be Rejected - if your app closely copies the branding, look, or content of a game or another app, it may be removed or rejected from Overwolf."

Recommended:

- App should have its own identity: "Your UI should feel distinct and not simply mimic the look and feel of the game." Game visuals (item icons, characters, stats) are common and helpful but "might be a gray area".
- "Don't Copy Game UI". "Be Careful with Official Assets - don't use official game logos, fonts, or layout styles unless you're certain it's allowed. When in doubt, leave it out."
- Define brand direction: core value, audience, personality; do not pick visuals only because they "look cool".
- Visual basics: logo and icon simple, scalable, recognizable at small sizes, no direct use of game assets; clear palette with a defined base color and a standout CTA color, not too many colors; readable typography for dense data; consistent UI elements.
- Resources: Google Material Design (https://m3.material.io/), Figma Community UI kits, ShadCN UI (https://ui.shadcn.com/), Coolors (https://coolors.co/), Fontpair (https://fontpair.co/), Mobbin (https://mobbin.com/). Also a webinar by Jasmin Weizman (Overwolf UI/UX lead).

- Discord (#devs-help, member, 2025-02, native): QA asked one developer whose overlay blended in too well to make it "obvious it was not part of the game". Relevant to the look of our cards.

Source: guides/product-guidelines/branding-intelectual-property/app-identity

---

## 7. Analytics and performance

- View analytics in the Developers Console (developers-console/the-developers-console).
- Track: daily/weekly/monthly retention widgets; session duration; feature usage; window usage (set a `name` on every window); revenue per user (predicted LTV); ad performance (revenue stats); clicks and flows; feedback; A/B results.
- Best practices: track only actionable metrics; add custom events for app-specific features; remove/redesign unused features; roll back if crash rates spike; "excessive analytics calls can negatively impact speed. Batch or debounce where appropriate."; "stay compliant with data privacy regulations like GDPR by being transparent about what you track".
- Add analytics early: crash and engagement first, then monetization and retention, then custom feature events.

Performance statements found across the page set (there are no numeric CPU/memory/FPS limits in these pages):

- Avoid semi-transparent overlays that reduce "clarity and game performance" (in-game-overlays).
- Home screen: minimize load time, avoid heavy animations (home-screen-design).
- Second screen: desktop-only window "improves performance"; disable GPU hardware acceleration if running on a second screen with the game (second-screen).
- Batch/debounce analytics calls (analytics).

- Discord (members, 2021): Sentry's free tier works well for runtime-error monitoring; sample events (for example 1 in 10) to stay under quota. For ow-electron that's `@sentry/electron`; list it in the privacy policy.

Source: guides/product-guidelines/analytics-performance/analytics

---

## 8. Settings: what the guidelines place in the settings panel

Consolidated from the pages above (no dedicated settings page exists):

- Hotkey management and reassignment, including the exclusive-mode hotkey (hot-key-and-settings, in-game-overlays).
- Enable/disable option for coach marks (ftue).
- Display picker for second-screen windows, applied immediately, persisted (second-screen).
- Settings and customization belong on the desktop screen (desktop-scrreens).
- Opt-out for CRN notifications exists at platform level (app-recommendations); not an app setting.

---

## 9. Growth

### 9.1 Growth overview

Articles: long-term marketing promotion, app recommendations (Store Carousel, CRN), marketing asset requirements, marketing communication guidelines ("Get it on Overwolf" badge), Discord Rich Presence Plugin, subscriptions.

Source: guides/growth/overview

### 9.2 App recommendations: Store Carousel, CRN, CRI

- App Store Carousel: showcases featured apps; become eligible through high-quality UX and alignment with Overwolf best practices.
- CRN (Content Recommendation Notification): shown when a player starts playing a game, only when a relevant app exists. Overwolf's own rules for CRN notifications ("must"): spaced out and capped; only high-quality apps (by retention); never a competitor to apps the player already has; users can opt out. Overwolf says retention is better for players who see CRN.
- CRN promotion eligibility: "once they hit 50% 2nd week retention for a few weeks in a row"; minimum requirements: "500+ DAU, 50% second-week retention for four weeks, a store rating of 4, and some form of monetization (e.g., ads or subscriptions)." Contact your DevRel. CRN also promotes Overwolf Native apps.
- Enabling CRN in your app: add `"crn"` to `overwolf.packages` in `package.json`:
  ```json
  { "overwolf": { "packages": ["crn"] } }
  ```
- CRI: "App creators are automatically added to the CRI promotion tool." The app's installer includes an opt-in offer, checked by default, for a second, non-competing Overwolf app. Clearly labeled; matched to audience; never direct competitors; if accepted, the promoted app installs after yours; if declined, nothing happens.

Source: guides/growth/app-recommendations

### 9.3 Long-term marketing promotion

- For apps with strong product-market fit: open to apps that "surpassed 40% 2nd-week retention for a few weeks in a row" and monetize with Overwolf services (Ads or Subscriptions).
- Includes dedicated creative production (ads, landing pages) and paid boosts (PPC or influencer marketing).
- Opt-in commitment: minimum 6 months; monthly budget minimum $20,000/month; developer covers 70%, Overwolf 30%; the 70% is offset from monthly revenue.
- Opting in also means agreeing to include the app in CRI.
- Monthly report of spend, channels, results on redash. Request by contacting Overwolf.

Source: guides/growth/long-term-marketing-promotion

### 9.4 Influencer marketing

- YouTube pre-rolls: 30–60 second ad by the influencer, within the first two minutes. Pricing by CPM: "$20 CPM or less is the industry standard"; cost based on views 30 days after release; viewcap slightly above average (example: $20 CPM with 200,000 viewcap caps payment at $4,000).
- Campaign rules: require sponsorship disclosure; require a trackable link in the description and a pinned comment (separate campaign URL per influencer); detailed brief; review and approve before live. "Always review and approve the pre-roll before it goes live, and confirm it includes both required elements: the sponsorship disclosure and the trackable link."
- Twitch long-term partnerships: Overwolf "generally advises against" (low ROI); if used, month-by-month. Typical deliverables: on-screen banner, clickable "About Me" banner, chatbot, custom command in title, call-outs, app use. Best-in-class: app visible at all times; logo/app name/CTA banner; app name and command in title at all times; chatbot message every 15–30 minutes; About Me banner; 1–2 social posts for one-off deals.
- Sample brief: https://docs.google.com/presentation/d/16gdmHtb4IhHkeHZ4o1BfVUwN_rWQqAT81LN5RZnv41A/edit?usp=sharing
- Track each influencer with the Affiliation Tool (developers-console/grow/affiliations#create-a-campaign-url), campaign source "Influencer".

Source: guides/growth/influencer-marketing

### 9.5 Marketing asset requirements (media kit for Overwolf-made landing pages)

Example landing pages: https://go.overwolf.com/outplayed/ , https://go.overwolf.com/facecheck-llstylish/ . Overwolf "will never use your assets for anything other than promoting your brand without your consent."

What to provide (Figma design system preferred):

1. Logo: SVG preferred, all approved variations; else high-resolution PNG with no background (JPEG has background; SVG/PNG no background).
2. Fonts: TTF, with which is main/where used, ideally mapped to H1/H2/H3.
3. Brand colors: Figma file, or hex values with use and priority (example: CTA `#e5004c`, Text `#f4f2ff`, BG `#161326` / `#797399`).
4. App description: exact written app name (casing/spacing), short description, differentiating value, titles and descriptions of top 3 features.
5. Full realistic mockups of every page/tab/window, several variants (different players/stats); vector preferred, raster at highest resolution.
6. Special assets: icons, game assets, in-game and interface screenshots, highest resolution or vector.

Source: guides/growth/marketing-asset-requirements

### 9.6 Marketing communication guidelines

- Goals: improve UX, be transparent, explain value and software behavior.
- Clearly say the app runs on Overwolf, so users do not abandon the Overwolf installer thinking they downloaded the wrong product.
- Use the "Get it on Overwolf" badge on landing pages, social media and public settings. Basic: `overwolf.github.io/img/getitonow-base.png`; dark: `overwolf.github.io/img/getitonow-dark.png`.
- Required: "you should always link this and other badges to your app's page in the Overwolf appstore, never a direct download."

Source: guides/growth/marketing-communication-guidelines

### 9.7 Discord Rich Presence Plugin

- Shows app activity in a user's Discord profile: presence/activity, duration, custom artwork, CTA buttons (e.g. download link). Thin Overwolf wrapper around https://github.com/Lachee/discord-rpc-csharp, MIT license. Code: https://github.com/overwolf/overwolf-plugins/tree/master/plugins/discord-rich-presence
- Add a UTM parameter to the button to attribute installs; appears in App installs in the Developers Console (developers-console/performance-statistics#app-installs).
- Best practices: 3 second delay between updates; start the plugin when the game launches, then update once; "Do not show data that could be seen as undesirable unless explicitly agreed to", e.g. usernames, unofficial/private server data, rank, performance statistics.
- Developers Discord: https://discord.gg/overwolf-developers

Source: guides/growth/discord

### 9.8 Subscriptions

- Preferred payment provider: Tebex (https://www.tebex.io/); handles payments, renewals, entitlements, recurring and prepaid plans, currencies, compliance. Setup: monetization/subscriptions/implementation.
- Benefits: ad-free, premium perks, status/recognition (badges, Discord roles). Dedicated subscription page; premium features page for complex perks.
- Offers: monthly; yearly at 20–30% discount; 3 or 6 month prepaid.
- Tools: timed sales (Tebex sales calendar https://docs.tebex.io/creators/growth-and-success/sales-calendar-2026), promo codes, referrals, geo-pricing.
- Design: "Go Premium" CTA above in-app ads, persistent subscription section; clear plan UI; timely upgrade prompts; three tiers, highlight best value.
- Required (Tebex): Tier 1 "must always include digital goods for Tebex payment process compliance".
- Behavior: freemium (e.g. 5 free uses per month); prompts at high-intent moments; urgency and incentives.

Source: guides/growth/subscriptions

---

## Contradictions and gaps

Contradictions and errors inside the pages:

- 16:9 vs 1300x840: app-screen-sizes says "Use a 16:9 aspect ratio" and then recommends a default of 1300x840px, which is about 14.5:9, not 16:9.
- Semi-transparency: in-game-overlays says avoid semi-transparent overlays, while the same page says exclusive mode shows "a semi-transparent window", and window-names / second-screen examples use `transparent: true` windows.
- Special overlays capture: "capturing these games ONLY in fullscreen-borderless mode ... If the game is in fullscreen non-borderless or windowed mode the capture will not work correctly", but the previous sentence tells users to switch to "fullscreen borderless or windowed mode".
- CRN eligibility: "50% 2nd week retention for a few weeks in a row" vs "500+ DAU, 50% second-week retention for four weeks, a store rating of 4, and some form of monetization" on the same page.
- CRN package casing: text says "place the `CRN` string", example uses lowercase `"crn"`.
- CRI: app-recommendations says all creators are "automatically added" to CRI; long-term-marketing-promotion says creators who opt in to the long-term program "agree to include their app in the CRI promotion tool", implying CRI is not automatic.
- Retention thresholds differ by program: 40% 2nd-week (long-term promotion) vs 50% (CRN).
- Hotkeys: `unregisterAll()` is described as "unassign the specified app hotkey" (copy of `unregister`); it takes no name. "All app hotkeys removed once the extension is uninstalled" uses Overwolf-native "extension" wording.
- Pop-ups are defined as "interactive overlays" yet must appear only on the desktop, never during gameplay; the pages do not say whether small in-game notification cards count as pop-ups.
- Second screen: "Keep your app window on the desktop" / "Create a desktop only window" vs "Building a second window experience is ... a normal window which communicates with GEP and has a transparent background window" - unclear whether second-screen windows should be `BrowserWindow`s or overlay windows.
- Discord RPC is a C# wrapper in the `overwolf-plugins` repo (Overwolf native plugin model); the page does not explain how to use it from ow-electron.
- Uninstall survey examples are written for a PC optimization tool (FPS, presets, "optimize"), which the page itself says to adjust.
- Installer page: "see Desktop mode" has no link. Subscriptions links to `implementation.mdx` (malformed URL).

Gaps (topics these 33 pages do not cover at all):

- System tray icon: no guidance.
- Minimize / close behavior (close to tray vs quit, taskbar presence): no guidance.
- Auto-launch (with Windows or on game start): no guidance, except second-screen windows "should launch automatically" and toggle hotkeys "can activate/launch your app even if the app is closed".
- "Front app" / focus behavior: not mentioned.
- Localization / languages: not mentioned.
- Accessibility (contrast, font scaling, screen readers): not mentioned; "accessibility" is used only for hotkeys and second-screen customization.
- Numeric performance limits (CPU, RAM, FPS impact): none given.
- Privacy policy / EULA / data-use disclosure requirements: only "stay compliant with data privacy regulations like GDPR by being transparent about what you track".
- Explicit QA checklist: none in this page set. Pointers outside this set: getting-started/release-your-app says the DevRel QA team reviews "functionality, design, and compliance" and sends "a checklist of identified issues"; getting-started/develop-your-idea says Overwolf "will test your app and verify that it meets the guidelines and standards above"; monetization/advertising/overview describes a final ads QA pass.
- Apex Legends: no game-specific guidance in these pages (not listed among special-overlay games). Game-specific third-party rules are referenced ("some games have their own guidelines") but not listed.

---

## What this means for Apex Squads

Current app state (per the task brief): desktop stats dashboard window, small always-on-top kill/death popup cards, launched from a terminal, no tray, no hotkeys, no in-game overlay, no FTUE, no settings screen, no ads. Items are marked [Req] where the docs use must/never/always or an API enforces it, [Rec] where the docs recommend it, and [Speculation] where the link to QA or to this app is my inference.

Launch and windows:

- [ ] [Rec] Ship through the Overwolf installer; clicking the desktop icon should open the app in desktop mode. Terminal launch is dev-only. [Speculation] QA will install from a build and expect a normal double-click launch.
- [ ] [Rec] Desktop dashboard: not full screen by default; default fits 1280x720 / 1440x900 screens; resizable; recommended default 1300x840.
- [ ] [Rec] Set `name` on every `BrowserWindow` (e.g. `desktop`, and one stable name for the card window such as `kill-card`), lowercase-hyphen, <= 20 chars, never per-user/per-session. [Req] if any window moves to `overlay.createWindow`.
- [ ] [Rec] Keep desktop and in-game windows separate, technically and in UX.
- [ ] [Speculation] Tray icon, close-vs-minimize behavior and auto-launch are not specified in these pages; decide them deliberately and check other docs (or ask DevRel) before QA.

Kill/death popup cards:

- [ ] [Req, if QA classes them as pop-ups] "ensure pop-ups are triggered only on the desktop and never while the user is actively playing a game." [Speculation] Cards shown during a match look more like "widgets" or "in-game overlay" in the docs' taxonomy, but that classification is not stated; confirm with DevRel.
- [ ] [Rec] Cards should not cover key Apex HUD areas; let users move and resize them; avoid semi-transparent styling that reduces clarity.
- [ ] [Rec, Discord] Keep one card window alive and reuse it rather than creating one per card; test at 125% and 150% Windows scaling.
- [ ] [Speculation] Apex is an FPS without a cursor; the docs say interacting with in-game windows in such games requires exclusive mode and a hotkey. Always-on-top `BrowserWindow`s over a fullscreen game are not discussed; the documented path for in-game UI is the overlay package.

Hotkeys and settings:

- [ ] [Rec] Add a settings panel on the desktop window (none exists today). The docs put hotkeys, coach-mark toggle and display selection there.
- [ ] [Rec] Add at least a show/hide toggle hotkey via `overlay.hotkeys.register`, rebindable in settings (`all`/`register`/`unregister`), with a `passthrough` option, and conflict notification.
- [ ] [Rec] Hotkey reminder: if the cards or any in-game window do not open automatically, show the hotkey in the UI (tips, reminders, notification prompts).
- [ ] [Rec, if in-game interaction is added] Provide a user-configurable exclusive-mode hotkey.

Onboarding and informing users:

- [ ] [Rec] FTUE: a skippable welcome screen on first desktop open explaining core value (squad stats from recorded matches) and that stats appear after playing; skippable/revisitable tutorial; coach marks with an enable/disable setting.
- [ ] [Rec] Empty states for "no matches recorded yet" and "cannot read game data", with a next step (docs' example: "Looks like you haven't played any matches yet. Start playing, and your stats will appear here!").
- [ ] [Rec] Tell users upfront that data requires the game running / matches played (desktop-scrreens, home-screen-design).
- [ ] [Rec] Service status: read GEP event health for Apex from the Event Status Endpoints; disable or annotate stats that depend on unhealthy events; show an indicator.
- [ ] [Rec] Error messages by type (connection, system, informational) with retry and a path to support.
- [ ] [Rec] Tooltips (< 10 words) on stat labels and icons.
- [ ] [Rec] In-app release notes with history, version and date.

Support and engagement:

- [ ] [Rec] Support icon in top bar or side nav; in-app bug reporting with logs; FAQ; community (Discord) link.
- [ ] [Rec] Rating prompt only after 3–5 meaningful interactions, never during gameplay.
- [ ] [Rec] Post-match summary screen (kills, damage, teammate comparison) on the desktop.

Branding and compliance:

- [ ] [Req] Comply with Apex Legends / EA third-party content rules (not listed in these pages; must be checked separately). "Overwolf won't be able to publish an app that breaks them".
- [ ] [Req-adjacent] Do not closely copy Apex's UI, logos, fonts or layout ("may be removed or rejected"); own logo, palette and typography. [Speculation] Review any Apex fonts, logos, legend/rank art currently used in the dashboard or cards.

Privacy and data:

- [ ] [Rec] Be transparent about what is tracked (GDPR). [Speculation] The app records GEP events and shows squad/teammate data; a clear statement of what is stored locally and whether anything is uploaded is advisable.
- [ ] [Rec, if Discord RPC is ever added] Do not show usernames, rank or performance stats in Discord presence without explicit consent; 3 s between updates.

Ads and growth (not needed for a free no-ads app, but constraints to plan for):

- [ ] [Req once ads are added] Minimum window resize must not be smaller than the ad container.
- [ ] [Rec] Leave layout room for ads (1300x840 default is sized for ad layouts).
- [ ] CRN, Carousel and long-term promotion all require monetization (ads or subscriptions) and retention thresholds (CRN: 500+ DAU, 50% week-2 retention for four weeks, rating 4; long-term: 40% week-2, $20,000/month budget, 70/30 split, 6 months). A no-ads free app is not eligible for CRN or long-term promotion as written.
- [ ] [Req, marketing] Link "Get it on Overwolf" badges to the Overwolf appstore page, never a direct download; say clearly that the app runs on Overwolf.
- [ ] Note: CRI means the Overwolf installer for the app may show a pre-checked offer for another non-competing Overwolf app (automatic per app-recommendations).
