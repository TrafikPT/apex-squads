# Overwolf Developer Console and Monetization (ow-electron)

Distilled from dev.overwolf.com/ow-electron on 2026-09-28. Check the source URL before relying on anything time-sensitive.

Scope: the Developer Console (access, users, keys, stats, release management, testing channels, store listing), monetization (payments, ads, ad policy, ad sizes, the `<owadview/>` SDK, CMP, special ad units, user identity, Gamer Grid, subscriptions via Tebex). All base URLs below are `https://dev.overwolf.com/ow-electron/...` unless written in full.

---

## 1. Developer Console: access and structure

- URL: https://console.overwolf.com (also called "the Dev Console").
- Access is gated on QA approval. Verbatim: "You will be given access to the Overwolf console ONLY after you submit your app and it's been approved by our QA team."
- Access is granted by your DevRel. Log in with "the account you sent to your DevRel to login (typically a Google account)".
- After login: the **All Apps** screen lists apps you are allowed to manage; search bar to find others you have access to; click an app to open its console.
- App visibility: "An application does not have to be public to appear in the console. It can exist in hidden mode where it can only be downloaded using a link to the app." Contact DevRel for details.
- Integrations: works with the `ow-cli` tool; exposes public release notes through a public endpoint (see 4.6).

Console sections:

- **Management Console** (account level): Profile, Notifications, Users and Permissions.
- **App Developers Console** (per app):
  - Dashboard
  - Performance Statistics
  - Release: Production, Testing
  - Grow: Store Listing, Games Statistics (Affiliations also exists as a Grow page, see 7.2)
  - Monetize: Revenue Statistics, Predicted LTV, House ads

UI chrome:

- Header toolbar: burger menu collapses/expands sidebar; `Overwolf {dev}` icon returns to home (All applications); circular arrow refreshes console data without reloading the page; user icon to log out.
- Footer toolbar (pages with editable fields): `Save`, `Discard changes`.
- Paging footer (long lists): results per page, page switching.

Source: https://dev.overwolf.com/ow-electron/developers-console/the-developers-console

### 1.1 All applications and Settings

- All applications page: type part of an app name to list apps you are authorized to manage; select one to reach Dashboard, Performance statistics, Release management, App growth (store listing), Monetization data (revenue stats).
- **Settings > Profile**: generate or revoke an API key with the "Revoke and get a new key" button; "Copy key" copies it.
- **Settings > Users and permissions**: search users by email; filter by partner. Hierarchy:
  - A Partner represents a team or company.
  - A User can be in many Partners; a Partner can contain many users.
  - A Partner can own many apps; an app is owned by only one Partner.
  - A User can be part of, or own, many apps; an app can contain many users.
  - "Partners can only be added by the DevRel team."
- Users table columns: User email, Partner, Status, Manage button.
- Add a user: Add new user -> enter email, select partner -> Add an app -> select app(s) -> select role (permissions list updates automatically; default role: **Member**) -> Apply -> Add user.
- Manage a user: Manage on the user row -> App permissions table (App name, User roles, Remove app, Manage) -> Manage on an app -> select/deselect roles -> Apply. "Remove app" removes the app from the user.
- The docs do not list the available role names other than the default "Member".

Source: https://dev.overwolf.com/ow-electron/developers-console/console-management/all-applications

### 1.2 Profile / API keys

- Some services (e.g. the Overwolf CLI) need a Developer Console API key. Profile lets you revoke/generate the key linked to your account.
- Warning (paraphrased closely): the key lets the service act on your behalf through the console; only give it to trusted services and revoke it as soon as you suspect a leak.

Source: https://dev.overwolf.com/ow-electron/developers-console/console-management/profile

### 1.3 Notifications center

- Channel for DevRel to send platform updates, alerts, actionable events (e.g. SDK changes, monetization updates, reviews).
- Severities: **Critical** (needs immediate attention), **Warning** (potential issue that could escalate), **Informative** (neutral/routine).
- Search bar across all notifications; "Filter by" severity.
- Fields: severity icon, title, timestamp. Some expand to show additional text and action buttons (links to a website or a console page).

Source: https://dev.overwolf.com/ow-electron/developers-console/console-management/notifications-center

---

## 2. Dashboard and statistics

### 2.1 Dashboard (per app)

Graphs:

- Daily Active Users (DAU): unique users interacting with the app in a 24-hour period.
- Daily Ads Revenue (Gross vs Net): total ads (video and display) revenue per day.
- App Installs (total vs unique) per day.
- App Uninstalls (total vs unique) per day.

Source: https://dev.overwolf.com/ow-electron/developers-console/dashboard

### 2.2 All Apps Performance dashboard

- Only appears for partner accounts with multiple apps under the same partner; single-app partners use the regular Performance Statistics.
- User must have permissions for all apps in the partner's portfolio.
- Widgets: DAU (across all apps), Daily Ads Revenue (Gross vs Net), Daily Ads Revenue by app (Gross/Net dropdown), Month to Date Revenue (this vs previous month, Net), Daily App Installs (Total), Daily App Uninstalls (Total), App Subscriptions by Source (active subscriptions across all apps).

Source: https://dev.overwolf.com/ow-electron/developers-console/console-management/all-apps-performance

### 2.3 Performance Statistics

- Active users: DAU; Monthly Active Users (MAU) = "the amount of unique users who have had an app window open at least once in a specific month"; DAU per Country.
- App specific: App Installs (total vs unique); App Uninstalls (total vs unique); App Version by DAU; Window Open Count Per Day (filterable by window name; window names are controlled per the "Window names" guide at `guides/product-guidelines/app-screen-behavior/window-names`); Median Window Open Duration Per Day (seconds); App Window Open Duration Distribution.
- Note: the docs define Window Open Count Per Day as "the amount of times an average user closes a given app's window per day" (sic, says "closes").
- User retention: Daily, Weekly, Monthly retention matrices (percentage of users who installed on a date/week/month and were active N days/weeks/months later; darker cells = higher retention).

Source: https://dev.overwolf.com/ow-electron/developers-console/performance-statistics

### 2.4 Developer Console stats APIs

- "The Overwolf Developer Console API allows you to programmatically access your app's statistics and data, making it easy to integrate with third-party Business Intelligence (BI) tools."
- Per-endpoint stats API pages exist on the site but were not captured in this knowledge base; only the overview was read.
- Getting a key: console -> Settings -> Profile -> "Revoke and get new API key" -> Confirm -> copy immediately ("You will not be able to retrieve it"; if lost, issue a new one).
- Auth: auth type "API Token", `key` = `authorization`, value = `Key {user.email@overwolf.com}:{api_key}`, "add to" = `Header`. That is, HTTP header `authorization: Key <your-email>:<api_key>`.

Source: https://dev.overwolf.com/ow-electron/developers-console/dev-console-apis/overview

---

## 3. App keys (signing)

- "App keys enable Overwolf to sign and verify your app builds, ensuring security and package integrity."
- Verbatim: "Unsigned builds will run but restricted Overwolf packages will fail to load - always sign your build prior to distribution."
- In the console: eye icon shows the app signature key; copy button copies it.
- How to include the key: see `guides/dev-tools/app-signing` and `guides/dev-tools/dev-mode` (other KB files).

Source: https://dev.overwolf.com/ow-electron/developers-console/releases-management/app-keys

---

## 4. Release management

Two kinds of release channels:

- **Testing**: "the release channel for pre-release apps that needs to be tested by users prior to deployment."
- **Production**: "the release channel where you upload qualified and tested versions of your app to the App Store." Public-facing and the default channel for App Store downloads.

Source: https://dev.overwolf.com/ow-electron/developers-console/releases-management/release-management

### 4.1 Production channel panes and columns

- Panes: **New Release** (upload), **Public Releases** (currently live versions), **Release History** (past versions, paged).
- Version details columns: Version; Uploaded; Rollout (active versions table only: a rollout percentage for the phased version, `HALTED`, or `Full rollout` for the live version); Download size (size of the raw `.exe`); Installs (non-unique, all time); Active Installs (last 30 days); Direct download.
- Opening a row lets you edit internal notes or add release notes.

### 4.2 Uploading a new release

- Requires "a valid `.exe` file".
- File size: "Recommended file size is up to 300 MB, where most apps on the platform are between 100 MB and 200 MB." No hard maximum is stated.
- Drag the `.exe` (or `Upload`) -> creates a new version called **draft** -> after upload, a **Release Review** screen.
- Version review rules (verbatim-ish):
  - "Mandatory version reviews may not be needed once your app is deemed stable after several version reviews. If you don't have mandatory reviews, then you can skip directly to the Release rollout percentage to start your rollout."
  - "Test Channels are always exempt from mandatory version reviews."
  - "It is recommended to submit major versions for review, even if reviews are no longer mandatory."
- Review flow: Add internal notes (visible only to your app's team and Overwolf) -> screen switches to the review process -> `Submit` sends for review by the Overwolf team -> `Cancel Request` pulls it back. "The release process begins once the version is approved."
- After approval (production): Add release notes (public) -> set rollout % -> `Start rollout` -> `Confirm` releases the version from draft; it becomes a full release in Public Releases.
- `Discard release` + `Confirm` deletes a draft at any point.

### 4.3 Rollout / phasing

- "You can only change the rollout percentage of the latest version of the app."
- For versions not fully rolled out: enter a new number, press `Increase`.
- Phased versions can be `Halt`ed and `Resume`d.
- "You can halt a rollout even after you have phased it to 99%. Users will no longer be able to download this version. Users who have downloaded the halted version will not be rolled back to the previous version."
- "You can resume a rollout even after you have halted it at 100%. Users who haven't downloaded this version yet, will now be able to do so."

### 4.4 Release notes

- **Internal release notes**: visible only to your app's staff and the Overwolf team.
- **Public release notes**: viewable by anyone, including via the public endpoint. Edited in a CommonMark editor; `Cancel`/`Save`.
- Public notes toggles: **Publish** (on = public; off = draft) and **Important** (marks major/time-critical versions).
- Changes to public notes take "approximately 5 minutes to update".

### 4.5 Release notes endpoint (public)

```
https://console-api.overwolf.com/v1/apps/${app-id}/versions/${version}/release-notes/${page}
```

- `app-id`: app's unique id. `version`: most recent version you wish to display. `page`: changelog page, up to three changelogs per page; pages start at 1, page 0 is treated as page 1.
- Response: `{ "versions": [ { "important": boolean, "version": string, "html": string, "timestamp": number } ], "meta": { "perPage": number } }`.
- Versions without a published public changelog are skipped. `versions` holds up to three entries; past the end the array is empty.
- Example app id used in docs: `npijmgiaiiemcnijaljcfddgeihcbifdbhpffihe`, version `6.0.71`.

### 4.6 Electron auto-updates with the console

- Uses `electron-updater`'s `autoUpdater` (docs link Electron's built-in auto-updater). Self-hosting requires your own CDN link in `autoUpdater.setFeedURL`.
- If hosted on the Overwolf console, you only need your app id, which is in the console URL: `https://console.overwolf.com/#/applications/{your_app_id}/main-dashboard`.

```js
const { autoUpdater } = require("electron-updater");
autoUpdater.setFeedURL({
  provider: 'generic',
  url: `https://electron-updates.overwolf.com/electron-updates/electron/${your_app_id}`
});
```

- Channels: add `channel` to `setFeedURL` to pull from a testing channel instead of Production. "`channel` must match the name of a channel you created in the Developers Console (for example `Dev`, `QA`, or `Beta`). Leave it unset to use the Production channel." (The code example uses lowercase `'beta'`.)
- "`setFeedURL` applies the same channel to every install of your app. You own the logic for which of your users land on which channel". Example:

```js
const feedOptions = { provider: 'generic', url: `https://electron-updates.overwolf.com/electron-updates/electron/${your_app_id}` };
if (isBetaTester(currentUser)) { feedOptions.channel = 'beta'; }
autoUpdater.setFeedURL(feedOptions);
autoUpdater.checkForUpdates();
```

Source: https://dev.overwolf.com/ow-electron/developers-console/releases-management/release-management

### 4.7 Testing channels

- Limit: "You can create and manage up to 10 test channels." (release-management page)
- Testing channels are custom channels; "App's are downloaded using the direct download link." They "allow you to deploy different versions of your app to specific, hand-picked users."
- Verbatim notes:
  - "Users are not able to download testing versions of your app from the Overwolf App Store. If a user downloads your app from the store, they will instead be subscribed to the Production Channel."
  - "Using testing channels are only available with custom installer."
- Suggested names: `Dev` (latest dev builds for the team), `QA` (QA team), `Beta` (trusted beta testers).
- Create: Release management -> Testing -> `Create channel` -> name -> Create -> drop/upload an `exe` in the **New test release** pane. "Your `exe` will be verified, and if it passes the verification process, then you will be prompted with the New test release pane." The pane shows release details, a direct download link, a release notes editor, and a release rollout percentage.
- Add release notes (seen by users of the app); set a "Release rollout percentage to enable the release to a random percentage of users" -> `Start rollout` -> `Rollout`. `Discard release` discards.
- Review: "Test channels are always exempt from mandatory version review. However, you can still choose to request a review if you wish."
- Manage: Release management -> Testing -> select channel -> Manage. "Public link for testers" -> `Copy link` to send to testers. In the test releases table: add internal notes, change rollout %, halt (prevents downloads) and resume.

Source: https://dev.overwolf.com/ow-electron/developers-console/releases-management/testing , https://dev.overwolf.com/ow-electron/developers-console/releases-management/release-management

---

## 5. Monetization overview and payment terms

- Two methods: **Ads** (must comply with the Advertising Policy) and **Subscriptions** (upsell extra features, keep core features free).
- Exclusivity, verbatim (repeated on several pages): "For apps with monetization plans, Overwolf won't approve any 3rd party monetization. Overwolf will only approve apps that integrate and use Overwolf ads, Overwolf subscriptions, or both."
- Payment terms:
  - NET 60 ("January's credit will be paid in April").
  - Minimum payment $200 (net) "based on the agreed revenue share"; smaller amounts roll over until the total reaches $200.
  - Paid via Payoneer (ask DevRel for the registration link).
  - USD only. International instructions: https://dev.overwolf.com/assets/files/payment-process-international-partners-5e836e3bac5ae464f6c65fb48ecbefb6.pdf
  - Dashboard revenue numbers "are not final"; final numbers are emailed after reconciliation.
- The ads revenue-share percentage is not stated on these pages (see Contradictions and gaps).

Source: https://dev.overwolf.com/ow-electron/monetization/overview

---

## 6. Advertising

### 6.1 What the Ads SDK is

- "The Overwolf Ads SDK is a JavaScript library that allows App developers to show ads inside their applications. Overwolf manages, filters, and hosts these ads, which are then served in the app through the SDK."
- In ow-electron the SDK is the `<owadview/>` tag (see 6.6).

### 6.2 Ad container technical rules

- Container min width and height >= the largest ad size selected for that container.
- Container has no child elements other than the one generated by the SDK.
- Container should always be visible. To stop ads temporarily, set CSS `display: none` on the container.
- Container should not change/refresh when moving between menus/pages/views of a multi-view window. If you must change containers, "do not recycle them. Shut down each changed container and open a new one in the new target location."

### 6.3 Ad policy

- Only ads through Overwolf's proprietary advertising platform. "If you manage an external website, you may not implement 3rd party `<iframes/>` with ads inside of your Overwolf app."
- Avoid adjusting ad opacity.
- Ad containers must be visually part of the app's content; they:
  - "May not be placed in a window without any other app content."
  - "Must always be directly adjacent to other app content clearly marking them as part of the app."
- Overwolf follows IAB standards (https://iabtechlab.com/wp-content/uploads/2022/03/Ad-Format-Guidelines_DV-CTV.pdf).
- Ads traffic is scanned with third-party anti-fraud and viewability tools.
- General ad-experience rules:
  - No actively intrusive ad experiences that clash with basic usage.
  - "No more than one video Ad container may be placed on a single page at any moment."
  - No manipulation (bots, auto clickers, constant page reloading, faking impressions, etc.).
  - No ads on dead-end/empty screens: Thank You pages, Login pages, Dialogue/Error/Notification pages.

### 6.4 Integration process (verbatim steps condensed)

1. Review the Ad planning guidelines.
2. Follow the Ads SDK integration guidelines (`reference/ads/ads-sdk-api/overwolf-ad-view`).
3. "Once you have finished integrating ads in your app, the QA team will perform a final series of tests and provide feedback to make sure that everything is working as intended."
4. "If all the tests pass, ads will be enabled and served to the users of your app."

- Ad data appears in the console dashboard only after ads are enabled; you also get a dedicated ad-performance dashboard.
- Demographics: bigger budgets in Tier 1 countries (e.g. US, UK, CA, AU, DE); Tier 1-heavy user bases likely see higher CPM and yield.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/overview

### 6.5 Ad planning guidelines and sizes

Placement rules:

- Any window with an ad container "should have real tangible and continuous value for the user."
- Ads must NEVER be displayed in: app signup/login windows; app error/notification windows; windows displaying just the ad container.
- Containers should not be in their own window without other meaningful content, and "should not be separated from the rest of the App's content by any invisible or transparent spaces."
- Avoid too many active containers per window.
- Keep containers stable across views of a window.
- Place where they won't be hidden; pop-ups must not block containers.
- Place where they are seen for more than a short moment, e.g. game "dead" moments (loading screens, post-game screens, respawn timers).
- Video: keep continuous visibility high. "A good average open time for video ads is 30 seconds." "A good average Completion Rate* for video ads is 70%." (Completion Rate = completions / total ad views.)
- Design advice: use unused margins, empty corners, areas often hidden by other windows.
- Advertiser constraints: preset container sizes, no movement while playing, no competing with each other, always fully visible.

Supported container sizes (Ads SDK):

| Container | Video ads | Banner ads | ow-electron container CSS |
|---|---|---|---|
| 400x300 | 400x300 / 300x250 | 336x280 / 300x250 / 250x250 | `min-width: 400px; min-height: 300px;` |
| 400x600 | 400x300 / 300x250 | 336x280 / 300x600 / 300x250 / 250x250 | `min-width: 400px; min-height: 600px;` |
| 300x250 | N/A | 300x250 / 250x250 | `min-width: 300px; min-height: 250px;` |
| 160x600 | N/A | 160x600 / 120x600 | `min-width: 160px; min-height: 600px;` |
| 728x90 | N/A | 728x90 / 468x60 / 234x60 / 320x50 / 300x50 / 400x60 | `min-width: 728px; min-height: 90px;` |
| 970x90 | N/A | 970x90 / 728x90 / 468x60 / 234x60 / 320x50 / 300x50 / 400x60 | `min-width: 970px; min-height: 90px;` |
| 400x60 | N/A | 400x60 | `min-width: 400px; min-height: 60px;` |

- The table also has an ow-plat "size value snippet" column (e.g. `{ width: 400, height: 300 }`). "Make sure to only enter values from a single line of the `Size value snippet`! Any unsupported values will potentially cause no ads to show!" For edge cases or several sizes in one container, contact Overwolf.
- Only 400x300 and 400x600 containers support video.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/standard-ads/working-with-ads

### 6.6 Recommended layouts (revenue estimates from platform-wide aggregate data)

| Layout | Revenue est. | Dimensions | Multiple ads in container | Formats |
|---|---|---|---|---|
| Combo Classic | $$$$$ | 400x600 + 300x250 | True | Video, Display |
| Tall Duo | $$$$$ | 400x600 + 160x600 | True | Video, Display |
| Tower Plus | $$$$ | 400x600 and 400x60 | True | Video, Display |
| Studio Tower | $$$$ | 400x300 + 160x600 | (not stated) | Video, Display |
| Tower | $$$$ | 400x600 and 728x90 | True | Video, Display |
| Studio | $$$ | 400x300 and 728x90 | (not stated) | Video, Display |
| Studio Plus | $$ | 400x300 and 400x60 | (not stated) | Video, Display |
| PopUp Studio Plus | $$ | 400x300 and 400x60 | (not stated) | Video, Display |

- "Based on real-time optimization one or more containers in this layout may contain multiple ads at the same time."
- PopUp Studio Plus is "Typically used for short sessions with limited screen space in small windows that appear on top of games during gameplay or loading screens."
- "Ad sizes of 400x60 must be placed at the top of the ad container to prevent it from being hidden."
- Recommended: try a few layouts, experiment, get feedback.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/standard-ads/recommended-ads-layouts

### 6.7 `<owadview/>` (ads SDK for ow-electron)

- Based on Electron's `<webview/>`; "automatically hosts and manages ads in your app". Put it inside a `<div>` sized to a standard IAB ad unit:

```html
<div style="width: 400px; height: 300px; background: transparent;">
  <owadview cid="myContainerId"/>
</div>
```

- Ad enablement, verbatim: "In order for your app to display ads, we first have to set up our backend to support your app's uid. You can test how ads will look and behave in your app, by passing in the `--test-ad` command-line argument." Contact Overwolf for details.
- Verbatim: "To enable ads for users in areas with more strict data collection regulations, you will be required to fully follow the Consent Management Platform (CMP) Implementation Guidelines."
- `background: transparent` lets your app show a fallback background image when there is no inventory.
- Starts muted by default; change with `<owadview>.setAudioMuted(muted)`.
- "automatically managed and already handles any issues involving ad visibility or crashes."
- **`cid`** (container ID): breaks down reporting per container in the console. Max 20 characters (longer strings trimmed to first 20).
- **Mandatory**: two identical ad units in the same window need unique `cid`s ("required to comply with ad policy, allowing only one video ad per window at a time"). Format `appname_widthXheight_window_position`, e.g. `myApp_400x300_desktop_top`, `myApp_400x300_desktop_bottom`.
- **`customTracking`** attribute: JSON string of context passed into the ad guest renderer, e.g. `customTracking='{"placement":"main-menu","screen":"home"}'`.
  - Since `ow-electron@42.7.1`, changing it after attachment reaches the running ad page (`adview.customTracking = JSON.stringify(obj)` or `setAttribute('customTracking', ...)`; empty string clears).
  - Must be a JSON string (assigning an object yields `"[object Object]"`, which fails to parse and clears the value). Each update replaces the whole object. Invalid JSON clears silently. Values set before attachment are picked up. Updating does not request a new ad; applies to subsequent requests. Last value survives reload/crash recovery.
  - Keys: not case-sensitive, can't start with a number, no spaces, underscore allowed. Values: not case-sensitive, may be numeric, may contain spaces (then double-quoted), always treated as strings.
  - Invalid characters in keys/values: `"` `'` `=` `!` `+` `#` `*` `~` `;` `^` `()` `<>` `[]` `,` `&` `:` (applies to key/value text, not the JSON syntax wrapping it).
  - Another example on the page uses a `slotsize="300x250"` attribute; the page does not otherwise document `slotsize`.
- House ads: if events are enabled on house ads in the console, use the `house-ad-action` event to trigger an action on click.

Source: https://dev.overwolf.com/ow-electron/reference/ads/ads-sdk-api/overwolf-ad-view

### 6.8 Consent Management Platform (CMP)

- "OW-Electron comes with a built in CMP which your app can utilize out of the box." It lets you check whether a user must be shown the CMP and show it, applying settings to the entire OW-Electron package.
- Two layers:
  - **First layer**: consent screen summarizing processing, with Accept/Reject (e.g. "Accept All" and "Manage Settings").
  - **Second layer**: detailed privacy settings in your app's settings page (per purpose and per vendor).

| Your installer | Who shows the first layer | What you implement |
|---|---|---|
| Overwolf Electron installer | The installer (built in) | The second layer only |
| Your own installer | Your app (your responsibility) | First layer in your app's FTUE, and the second layer |

- Own installer: do not show the first layer from your installer. `app.overwolf.isCMPRequired()` and `app.owElectronApp.overwolf.openAdPrivacySettingsWindow()` "are app-level ow-electron APIs. They exist only inside the installed app at runtime". Earliest point = first app launch.
- Required flow ("Using the CMP APIs"):
  1. On first launch call `app.overwolf.isCMPRequired()`.
  2. If `true`, show the first layer during FTUE, before the first ad is served.
  3. If `false`, continue FTUE without it.
  4. "Regardless of `app.overwolf.isCMPRequired()`, implement a Privacy section in your app's settings."
  5. Add a Manage button calling `app.owElectronApp.overwolf.openAdPrivacySettingsWindow();`. "Show the button to every user. It does not need to be gated on `app.overwolf.isCMPRequired()`."
- `isCMPRequired()` "returns `true` where local law requires consent, typically for users in Europe."
- First-layer text template (build it yourself when using your own installer; link `{ad vendors}` to the vendors tab; Manage opens the second layer):

```
{App Name} may display in-app ads to help provide you with a free high-quality app.
In order to deliver ads that are relevant for you, {App Name} and trusted {ad vendors}
store and/or access information on your computer, and process personal data such as IP address and cookies.
Click on the "Manage" button to control your consents,
or to object to the processing of your data when done on the basis of legitimate interest.
You can change your preferences at any time via the settings screen.
Purposes we use: Store and/or access information on a device,
personalized ads and content, ad and content measurement,
audience insights and product development.
```

- The CMP and privacy settings change based on the user's country.
- `openAdPrivacySettingsWindow(CMPWindowOptions)` options: `purposes` (enum `purposes`, `features`, `vendors`; opens that tab; default Purposes), `modal` (bool, only when child; default `true`), `parent` (BrowserWindow; default `null`), `center` (bool; default `true`), `backgroundColor` (preloader background), `preLoaderSpinnerColor`, `width`, `height`, `x`, `y`, `language`.
- Languages: `en`, `de`, `pt`, `es`, `fr`, `it`, `pl`.
- Deprecated: `app.overwolf.openCMPWindow({ tab?: 'purposes' | 'features' | 'vendors' })`. "Use `app.overwolf.openAdPrivacySettingsWindow()` instead."

```js
import { app } from 'electron';
if (await app.overwolf.isCMPRequired()) {
  // Render first layer before the first ad; Manage -> app.owElectronApp.overwolf.openAdPrivacySettingsWindow()
}
```

Source: https://dev.overwolf.com/ow-electron/reference/ads/consent-management-platform

### 6.9 House ads

- Images shown in the standard ad container when there is no programmatic fill. Uploaded in the console to promote features, promotions, tutorials. Optional click-through link; optional event name to trigger an in-app action.
- Deployable globally or per region; regional ads, when active, show only in their regions and override active global ads there.
- "House ads are not to be used with external ad campaigns. External ad campaigns are managed and monitored by Overwolf."
- "House ads won't be displayed in your app if there is an active ad blocker running."
- Console: left menu House Ads -> Ads control; table columns Ad size, Global ad (Not active / Not defined / Active), Regional ads, Statistics, Edit container. Pick a size -> Edit.
- Upload: Global ad tab (or Regional ad tab + choose countries) -> image in PNG, JPG, WebP, or GIF (animated GIFs play) -> optional link -> optional event name -> "Ad activated" checkbox -> Save. `+ New regional ad` / `+ Create` for more.
- Statistics table: Date, Impressions, Clicks, Conversion rate; default sorted date descending; filters Date (last 30 or 90 days, default 30), Country, Window, Size.
- Event example on the standard-ads house-ads page:

```js
owAdInstance.addEventListener('house_ad_action', (e) => { console.log('house_ad_action', e); });
// result: { "action": "NAME" }
```

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/standard-ads/house-ads , https://dev.overwolf.com/ow-electron/developers-console/monetize/house-ads

### 6.10 High Impact ads

- Demand comes from Brand Partnerships direct deals, not programmatic; "Reach out to your DevRel to find out if you qualify." (Same note on In-stream and Interstitial.)
- Occupy an entire ad zone (parent `<div>`), temporarily hiding surrounding content; standard ads return afterward.
- Ad zone requirements: minimum 440x670px; width fixed at 440px; height responsive to window height, min 670px; must span the full window height and stretch with the window; at least one ad container inside; with multiple containers "ONLY one is eligible for high impact ads". Smaller than 440x670 = will not render correctly.
- Enable: add `adstyle="high-impact-ad;"` to one `<owadview>` in the zone.
- Events on that owadview: `high-impact-ad-loaded` (remove other containers/elements from the zone, set eligible container to 100% width/height) and `high-impact-ad-removed` (restore all containers and original sizes). If no high-impact creative, `high-impact-ad-loaded` never fires; keep default layout.
- Testing: with `webPreferences: {devTools: true}`, open DevTools (Ctrl+Shift+I), run `localStorage.owAdTestAd = true`, press F5. For your own .exe: run with `--remote-debugging-port=9222` and `--test-ad`, open `http://localhost:9222/`.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/unique-ad-sizes/high-impact-ads

### 6.11 Interstitial ads

- Full-window overlay; user clicks through or closes. Creative is banner or video depending on campaign availability. Direct-sold via Brand Partnerships; performance-driven payouts.
- Prerequisite: minimum window size **1000x600**.
- Guidelines: consider intrusiveness; show at app launch or on user interaction; clear close button; background dimming; avoid frequent use; "Never show ads during active gameplay."; do not load any other ad unit in the background while an interstitial occupies the window.
- Create: `document.createElement('owadview')`, `setAttribute('performance', '')`, optional `adstyle` (`background-color: rgba(...)`; `background-blur: -1` removes blur, `3` keeps blur, default `0`), append to `document.body`.
- Events: `complete` (video), `impression` (video), `shutdown`, `performance_ad_no_fill`, `performance_ad_dismiss`, `performance_ad_loaded`, `performance_ad_clicked`, `performance_ad_video_complete` (video), `performance_ad_video_skipped` (video).

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/unique-ad-sizes/interstitial-ads

### 6.12 In-stream ads

- For video capture apps: pre-roll video (with sound) inside your own video player. Skippable or not per advertiser; must be user-initiated (click to play); sound on. External embedded players (YouTube, Twitch, existing video ad containers) will not play them.
- Requirements: use `owadview`; video > 5 sec; transparent iframe same size as the video and responsive to the player; min player 640 x 480; click-to-play; sound on.
- Properties: `instream` (bool, M), `streamDurationMs` (M), `streamVideoCount` (M), `video_ad_skipped` event (M, pass to `owad.shutdown`), `complete` event (M, pass to `owad.shutdown`), `streamPlayCountPlay`, `containerSize`, `volume` (0-1, default 1), `containerId`, `impression` event.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/unique-ad-sizes/instream-ads

### 6.13 User identity / hashed emails

- Advertisers target via hashed emails instead of third-party cookies. Steps: obtain email consensually (e.g. via Overwolf OIDC), normalize, hash, expose to identity providers (LiveRamp, ID5, The Trade Desk, Yahoo, among others).
- `app.overwolf.generateUserEmailHashes("test.email@overwolf.com")` (Overwolf normalizes and hashes, stores only hashes).
- `app.overwolf.setUserEmailHashes({ SHA1, SHA256, MD5 })` if you hash yourself; `app.overwolf.setUserEmailHashes({})` clears.
- Requires a privacy policy update: ow-electron apps follow Exhibit A and also Exhibit B of the developer terms (https://legal.overwolf.com/docs/overwolf/developers/developer-terms/).
- Available to any app on the platform; no guaranteed uplift.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/user-identity

### 6.14 Gamer Grid

- Overwolf Ads' audience-identification layer (first-party signals such as games played, frequency, hardware; third-party data from Experian, LiveRamp). Used only for direct-deal campaigns with eligibility requirements (e.g. 21+, specific country).
- Unvalidated users excluded by default; some apps excluded by default (e.g. Minecraft and Roblox apps from age-restricted campaigns).
- Every app is opted in by default; no code, permission, or manifest change needed. Opt out (all such campaigns, not selectively) via DevRel.

Source: https://dev.overwolf.com/ow-electron/monetization/advertising/gamer-grid

---

## 7. Console: Monetize and Grow pages

### 7.1 Revenue Statistics and Predicted LTV

- Revenue Statistics widgets (most with 30/90/180-day dropdown and CSV download): Daily ads revenue (Gross & net); Month to date revenue (Net) vs last month and last year; Video ads general metrics (opportunity, impressions; filter by window name); Video ads revenue (net) per window; Display ads general metrics; Display ads revenue (Net); Video ads completion rate per window; Video and Display detailed metrics (filter by days, size, country, window); All ads metrics (monthly video/display/total gross and net, adjustments); Video/Display ads metrics (opportunity, impressions, fill, gross, net, Net CPM); Average ads container open time per window; Daily average revenue (Gross) per DAU per country (top 50), US vs benchmark, Non-US vs benchmark; Ads Revenue (Net) 13 months rolling; Monthly Ads Metrics (total gross revenue, ARPMAU in cents).
- Predicted LTV: lifetime value from video and display revenue (no subscriptions). Widgets: LTV US, LTV Top Non-US Country, LTV 2nd Top Non-US Country, LTV Monthly Trend by Country (12 months rolling), LTV Table Browser. All CSV-downloadable.

Source: https://dev.overwolf.com/ow-electron/developers-console/monetize/revenue-stats , https://dev.overwolf.com/ow-electron/developers-console/monetize/predicted-ltv

### 7.2 Affiliations (UTM campaigns)

- Create UTM-tagged links: Campaign source (App, Influencer, Social media, Google, Twitch, Youtube); Campaign medium (auto, not editable); Campaign name; target App installer or App page; description -> Create URL.
- Current URLs / Archived URLs tables (name, auto ID, created date, target type, URL, statistics, edit name/description, archive/unarchive, active toggle). "Data from deactivated links aren't aggregated in the statistics."
- Campaign statistics: total installs, total users, total gross revenue, daily gross revenue, DAU, installs, uninstalls, daily average revenue per DAU (30 or 180 days), month to date gross revenue.

Source: https://dev.overwolf.com/ow-electron/developers-console/grow/affiliations

### 7.3 Games Statistics

- Platform-wide, not app-specific. Top games trend (indexed sessions, 60 days), Game geo distribution (top 50 games, updated every 12 hours), Top games yesterday (top 30 by average session time and sessions per user; 11 per page).

Source: https://dev.overwolf.com/ow-electron/developers-console/grow/games-stats

### 7.4 Store listing

- App details: App Name ("You can't use an app name that contains the word `bot`."); Creator display name; App URL (view only, DevRel); Monetization summary (view only, DevRel); Short description (plain text); Full description (CommonMark, Preview button).
- App download preferences: Main download button mandatory, defaults from the Production release; fields Platform, Button label, App version (Native/Electron, only if multiple app types), Manual link; `Add more` for extra buttons. Contact DevRel to configure.
- Creator details: About the creator; Social links; Support link (used by the store review module for technical assistance).
- Graphic assets:

| Asset | Format | Size | Required |
|---|---|---|---|
| App icon | PNG or WebP | 55x55 px | mandatory |
| Tile image | JPG (72PPI) or WebP | 258 x 198 px | mandatory |
| Hero image | PNG or WebP | 1920 x 560 px | optional |
| Creator tile | PNG or WebP | 400 x 320 px | optional |
| Video URLs | YouTube links | "Only three YouTube links are supported" | optional |
| Screenshots | JPG or WebP | 1200 x 675 px, 100Kb max, 1 to 5 | mandatory |

- "The 1200 x 750 px screenshot size is no longer supported", but existing ones stay featured until you add a video or at least one 1200x675 screenshot.
- More detail is in console tooltips and https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/prepare-your-assets.

Source: https://dev.overwolf.com/ow-electron/developers-console/grow/store-listing

---

## 8. Subscriptions (Tebex)

- Tebex enables one-time purchases, recurring subscriptions, tiered plans, paid premium features. Tebex is Merchant of Record (tax, fraud, payments), provides chargeback protection when eligible, and expedited support for Overwolf developers.
- Options compared in the "Which payment plan works for you" table: App Subscriptions API, Tebex Headless API, Tebex Checkout API.
  - Headless API: your own storefront, packages managed in the Tebex creator panel, Tebex.js inline checkout, fulfillment via commands/webhooks.
  - Checkout API: packages created in your backend (dynamic catalogs), Tebex.js checkout, webhooks. "Approval is required for using the Tebex Checkout API."
- Comparison (App Subscriptions API / Headless / Checkout): pay direct on your website (no / yes / yes); pre-made package management (yes / yes / no); Overwolf app with in-app purchases (yes / yes / no); dynamic products (no / no / yes); backend user management (yes / no / no); coupons and discounts (yes / yes / no). Support: developers@overwolf.com for App Subscriptions API; Tebex Support for the other two.
- Fees: total 15% of the original purchase (excluding gateway fees) = Overwolf Apps Platform 10% + Tebex 5%; gateway fees variable. Described as "a discount from the platform's standard 30% revenue share".

Source: https://dev.overwolf.com/ow-electron/monetization/subscriptions/overview , https://dev.overwolf.com/ow-electron/monetization/subscriptions/tebex-integrated-solutions

---

## Contradictions and gaps

Contradictions and inconsistencies between pages:

1. **Console access vs submission.** The Developer's Console page says access is given "ONLY after you submit your app and it's been approved by our QA team." The Release your app page (`getting-started/release-your-app`, not one of this file's pages) says to submit "by uploading your latest build and filling out the necessary details in the Developer Console" and also links a submission form (https://wkf.ms/3KL8b1m). The same page later says "After the initial submission passes the QA team, Overwolf will grant you access to the developer console." So the first submission apparently goes through the form, not the console.
2. **House ad event name.** The standard-ads house-ads page uses `house_ad_action` (underscores) on `owAdInstance`. The `<owadview/>` reference says `house-ad-action` (hyphens). `owAdInstance` is not defined anywhere on the ow-electron pages.
3. **CMP API path.** Everywhere else the second-layer API is `app.owElectronApp.overwolf.openAdPrivacySettingsWindow()`, but the deprecation note for `openCMPWindow` says to use `app.overwolf.openAdPrivacySettingsWindow()`, and the code example calls `owElectronApp.overwolf.openAdPrivacySettingsWindow(...)`. The `CMPWindowOptions` tab-selector parameter is listed as `purposes`, while the deprecated API used `tab`.
4. **"One video ad" scope.** The ad policy says one video container "on a single page". The owadview page says "one video ad per window at a time" and requires unique `cid`s for identical units in the same window.
5. **400x60 placement.** The layouts page says 400x60 "must be placed at the top of the ad container", but the High Impact example places the 400x60 container below the 400x600.
6. **Testing audience.** Testing channels are for "specific, hand-picked users" via a direct link, but the rollout percentage enables the release "to a random percentage of users". How the percentage applies to a link-based channel is not explained.
7. **Channel name case.** The auto-update section says `channel` "must match the name of a channel you created" (examples `Dev`, `QA`, `Beta`) but the code uses `'beta'`. Case sensitivity is not stated.
8. **Broken or missing cross-links.** The testing page links `release-management#what-are-release-channels` (no such section). Several pages link a `releases-management/production` page and a `console-management/users-and-permissions` page, which were not in the captured set; the Users and permissions content is on the All applications page. The Release your app page links permissions at `https://console.overwolf.com/#/permissions/users-permissions`. Several ow-electron pages link ow-native pages (dashboard, contact-us, prepare-your-assets).
9. **Window Open Count Per Day** is defined as how often a user "closes" a window.

Questions the docs do not answer:

- Whether having ads (or planning them) affects QA priority or go-live speed. None of these pages says so. The closest statements are the Release your app checklist ("make sure you have designed your app to best utilize monetization strategies, even if at first you are not planning to monetize your app") and the overview note that monetizing apps may only use Overwolf ads/subscriptions.
- Whether testing channels require prior QA approval. Testing channel versions are "always exempt from mandatory version review", but the channels live in the console, and console access requires the initial QA approval. The docs do not say whether a testing channel can be used before the app's first approval.
- What "custom installer" means in "Using testing channels are only available with custom installer" (the Overwolf Electron installer, your own installer, or either). The Release your app checklist uses "Custom Installer" for the choice between "the Overwolf custom installer, or your own installer".
- What the testing `exe` "verification process" checks (signing? app key?).
- How many reviews make an app "deemed stable", and who decides that mandatory reviews stop.
- A hard maximum `.exe` size (only a 300 MB recommendation).
- The ads revenue-share percentage. Payment terms mention "the agreed revenue share"; the Tebex page mentions a "standard 30% revenue share" without saying what it applies to.
- Which role names exist besides the default "Member", and what each permits.
- What `app.overwolf.disableAdsOptimization()` and `app.overwolf.disableAnonymousAnalytics()` do to ad serving or approval. Neither is mentioned on the monetization or console pages. Elsewhere, the API reference describes them only as "Disable Ads optimization" and "Disable sending any anonymous analytics, this should be called before app.ready". The first-app page says analytics is on by default and opting out reduces collection "to the mandatory minimum". There is also `disableAdsFPD()` ("Opt out from using first party data (email address) for ad targeting").
- Whether `--test-ad` works before Overwolf enables ads for the app uid.
- The house ad sizes available (presumably the container sizes; not stated).
- What `slotsize` on `<owadview>` does (it appears in one example only).
- The per-endpoint Developer Console stats API specs (not captured here).

---

## What this means for Apex Squads

Facts from above, applied to this app (main window currently 1280x800; `src/main.ts` calls `app.overwolf.disableAnonymousAnalytics()` and `app.overwolf.disableAdsOptimization()`).

Adding ads would require:

1. **Placement.** Put ad containers in the dashboard window, which has continuous value. They must be adjacent to app content, with no transparent gap. Never put them in a window that holds only an ad, and never on login, error or notification screens. The kill/death popups are notification-type windows, so they should not carry ads (the rule names "App error/notification windows"). High-value layouts from the docs: Combo Classic (400x600 + 300x250) or Tall Duo (400x600 + 160x600). A side rail of 400x600 fits a 1280x800 window. Only 400x300 and 400x600 containers can show video, and at most one video container per page/window.
2. **Markup.** `<div style="width:400px;height:600px;background:transparent"><owadview cid="..."/></div>`, with a unique `cid` of 20 characters or fewer per container (format `appname_widthXheight_window_position`). The container should hold no other children. Keep it mounted across the dashboard's tabs, and hide it with `display: none` rather than recreating it. Optionally set `customTracking` per tab (ow-electron 42.7.1 or later for runtime updates). The view starts muted.
3. **Consent (CMP).** Add a Privacy section in settings with a Manage button, shown to every user, that calls `app.owElectronApp.overwolf.openAdPrivacySettingsWindow()`. If the app ships its own installer, it must also call `app.overwolf.isCMPRequired()` on first launch and show the first-layer screen in the FTUE before the first ad. With the Overwolf Electron installer, the installer shows the first layer. The Release your app checklist lists "confirm CMP integration" for every submission.
4. **Enablement.** Overwolf must configure its backend for the app uid. Test locally with `--test-ad`, or `localStorage.owAdTestAd = true` in DevTools. After integration, "the QA team will perform a final series of tests", and ads are served only if those pass.
5. **What to turn back on (speculation, not stated in the docs).** No page says `disableAdsOptimization()` blocks ads or approval, but its name suggests it works against ad performance. Removing that call is the obvious candidate once ads are added. `disableAnonymousAnalytics()` is documented only as reducing analytics to a minimum. Nothing ties it to ads, so keep or drop it on privacy grounds, and ask DevRel whether it affects ad yield. If you ever call `generateUserEmailHashes`, the privacy policy must be updated per Exhibit A and B. Apex Squads has no sign-in, so this does not apply now.
6. **Optional extras.** Upload house ads in the console as no-fill fallbacks (PNG/JPG/WebP/GIF). Interstitials need a window of at least 1000x600, must never appear during active gameplay, and depend on DevRel-qualified direct deals, as do High Impact ads. High Impact ads would need a 440px-wide, at least 670px-tall full-height ad zone.
7. **Policy constraint.** If the app monetizes, it may use only Overwolf ads and/or Overwolf subscriptions (Tebex), with no third-party monetization.

Beta testing through testing channels requires:

- Developer Console access, which the docs say comes only after the app passes its initial QA approval. The docs do not say whether a testing channel can be used before that approval.
- A "custom installer" (meaning ambiguous, see gaps) and a signed build. Unsigned builds "will run but restricted Overwolf packages will fail to load", and GEP is one of those packages.
- Create a channel (up to 10), for example `Beta`. Upload the `.exe` (it is verified), add release notes, set the rollout % and start the rollout. Then send testers the "Public link for testers". Store installs always get Production.
- No mandatory version review for test channels ("always exempt"). A review can still be requested.
- For testers to keep getting beta updates, the app's `electron-updater` must call `setFeedURL({ provider: 'generic', channel: '<channel name>', url: 'https://electron-updates.overwolf.com/electron-updates/electron/<app_id>' })`. Choosing which users get the channel is the app's own logic.
