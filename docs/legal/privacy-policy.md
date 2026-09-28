> **DRAFT: not reviewed by a lawyer.** Do not publish until the placeholders in
> [SQUARE BRACKETS] are filled in and the text has been checked. Sections marked
> **[IF ADS]** apply only if ads are added to the app; delete them otherwise.

# Apex Squads Privacy Policy

Effective date: [EFFECTIVE DATE]
Last updated: [LAST UPDATED DATE]

Apex Squads is a free Windows app for Apex Legends. It records what happens in
your matches and turns it into stats on your own PC. This policy explains what
the app stores, what leaves your PC, and your rights.

## The short version

- Apex Squads saves your match data **on your PC only**. The app does not send
  your recordings to us or to anyone else.
- The recordings include **other players' in-game names and IDs** that the game
  shows in your lobby and kill feed. They stay on your PC too.
- There are no accounts to create, no sign-in, no tracking of our own and no
  ads.
- The app runs on Overwolf's platform, which connects to Overwolf's servers.
  Overwolf's own privacy policy covers that.
- If an apexlegendsstatus.com API key is set up, the app looks up **your own**
  rank there, using your EA ID.
- To delete everything, delete the folder `%APPDATA%\Apex Squads`.

## Who we are

Apex Squads is made by [DEVELOPER NAME], an individual developer based in
Portugal ([DEVELOPER ADDRESS]). In this policy, "we" and "us" mean the
developer. Contact: [CONTACT EMAIL].

## What the app stores on your PC

While Apex Legends runs, Overwolf's Game Events service tells the app what
happens in the game. Apex Squads saves every one of these game events, as it
receives them, to a file on your PC: one file per time you start the app.

**About you**, this includes:

- your in-game name, your EA ID and your platform ID (for example a Steam ID);
- your matches: mode, map, legend, placement, kills, knocks, assists, damage,
  revives, weapons used, deaths and who knocked or killed you;
- your ranked points and season stats as the game reports them;
- your position on the game map during a match, if the game sends it (this is
  a position inside the game, not your real-world location);
- if the rank lookup is on (see below), the answer from apexlegendsstatus.com
  about your account (for example rank, points and level).

**About other players**, this includes what the game shows you during a match:

- the names, EA IDs and platform IDs of the players in your lobby, and which
  team each one is on;
- the kill feed: who knocked or killed whom, and with which weapon;
- the damage you dealt to them.

The app uses this to show your stats and the kill, death and lobby cards (for
example "killed you before" or how a player has done in matches you shared).
Players who use Apex's anonymous mode appear under a hidden name; Apex Squads
does not try to find out who they are.

**Other files** in the same folder:

- `settings.json`: your app settings (which cards show, where, for how long,
  your hotkeys, whether you have seen the welcome screen);
- `accounts.json`: your in-game name(s) and the EA ID or platform ID that
  goes with each, so the app knows which of your accounts is playing;
- technical files that the app's runtime keeps there, such as caches and
  Overwolf's own logs.

The app also writes a few technical lines into each recording (for example the
app and runtime versions and any errors), to help find problems.

## Where it is stored, for how long, and how to delete it

Everything above is in `%APPDATA%\Apex Squads` on your PC (Settings, "Your
data" shows the exact folder). It is kept **until you delete it**: the app
never deletes recordings by itself, because your stats are rebuilt from them.

To delete your data:

- delete single recordings from the `recordings` folder (the matches in them
  disappear from your stats), or
- close Apex Squads (Quit in its tray menu) and delete the whole
  `%APPDATA%\Apex Squads` folder.

Uninstalling the app [DOES / DOES NOT] delete this folder. [IF IT DOES NOT: To
remove your data, delete the folder yourself after uninstalling.]

We cannot delete this data for you, and we cannot recover it: we never receive
a copy.

## What leaves your PC

### 1. Overwolf's platform

Apex Squads is built on Overwolf's platform (ow-electron). It needs Overwolf's
services to receive game events and to show cards inside the game. The
platform connects to Overwolf's servers, for example to download and update
its game-events and overlay components.

Apex Squads turns off the optional parts it can: it switches off Overwolf's
anonymous usage analytics and its ad optimization. Overwolf says that with
analytics off it still collects a minimum of "essential, non-identifying
events such as app launch and basic session signals". Overwolf is responsible
for what its platform collects. See Overwolf's privacy policy:
[OVERWOLF PRIVACY POLICY URL].

If you installed Apex Squads with Overwolf's installer, you also accepted
Overwolf's terms there.

### 2. Overwolf's game-events status

The app downloads a small public file from Overwolf
(`game-events-status.overwolf.com`) that says whether Overwolf's game events
for Apex Legends are working, so it can tell you when they are down. It checks
every 10 minutes while the app runs, and when Apex starts. This request contains no information
about you or your matches. Like any internet
request, it shows your IP address to Overwolf's server.

### 3. Rank lookup on apexlegendsstatus.com (only when set up)

apexlegendsstatus.com is an independent, unofficial Apex Legends stats service.
Apex Squads contacts it **only if an apexlegendsstatus API key has been set
up** for the app. [CONFIRM: whether release builds include a key. If they do
not, say: "This is off unless you set up your own key."]

When it is on, the app asks for **your own account's** rank:

- it sends your EA ID (or your platform ID, or your in-game name before the
  game has sent your ID), the platform "PC", and the API key;
- it asks in the lobby, when a match starts and a few times in the first five
  minutes after a match;
- it never looks up other players.

apexlegendsstatus.com also sees your IP address, as with any internet request.
Their own terms and privacy policy apply: [APEXLEGENDSSTATUS PRIVACY URL].

### What the app does not do

- It does not upload your recordings, settings or stats anywhere.
- It has no accounts and no sign-in.
- It has no analytics, crash reporting or tracking of its own.
- It shows no ads today. [IF ADS: see "Ads" below.]
- It does not read game memory or network traffic; it only uses the game
  events Overwolf provides.

## If you contact us

If you contact us through [SUPPORT CHANNEL] or by email, we receive what you
send: your message, your email address or username on that channel, and any
files you attach. The app's "Report a problem" asks you to attach a recording.
**A recording contains other players' names and IDs**, so only send one if you
are comfortable with that, and only to us.

We use what you send only to answer you and fix the problem. We delete support
messages and attached recordings [RETENTION PERIOD, e.g. within 90 days after
the problem is closed], and we never publish them. [CONFIRM: attached
recordings are never used as test data, or only after full anonymization.]

## Legal basis (GDPR)

We are based in the EU, so the EU General Data Protection Regulation (GDPR)
applies to personal data we handle.

- **Data on your PC.** The app processes it on your PC, for you, and we have
  no access to it. [LEGAL REVIEW: whether the developer is a controller for
  data processed only on the user's device, and the position of other players'
  data, see "Other players" below.]
- **Support requests:** our legitimate interest in answering you and fixing
  the app, and taking the steps you ask for (GDPR Article 6(1)(f) and (b)).
- **Rank lookup:** [LEGAL REVIEW: legitimate interest in showing you your
  rank, if release builds include a key; otherwise it is your own choice to set
  up a key.]
- **Overwolf's platform:** Overwolf explains its own legal basis in its privacy
  policy.

## Other players

Apex Squads records what the game shows you about other players, like any
recording of your own matches would. This data:

- stays on your PC and is never sent to us or shared by the app;
- is used only to show you your own history with those players;
- covers only what the game itself shows you. Players in anonymous mode stay
  anonymous.

If you are one of those players and have a question, contact us at
[CONTACT EMAIL]. We do not hold any copy of other users' recordings, so we
cannot look up, change or delete what is on someone else's PC.

Our Terms of Use ask users not to publish or share other players' information
from their recordings.

## Your rights

Under the GDPR you have the right to:

- access the personal data we hold about you, and get a copy;
- have it corrected or deleted;
- restrict or object to how we use it;
- data portability.

The only personal data we can hold about you is what you send us (see "If you
contact us"). Your recordings are already fully in your hands: open, copy or
delete them in `%APPDATA%\Apex Squads`.

To use your rights, write to [CONTACT EMAIL]. We answer within one month.

You can also complain to a data protection authority. In Portugal this is the
Comissão Nacional de Proteção de Dados (CNPD, www.cnpd.pt); you can also
complain in the EU country where you live or work.

## Children

Apex Squads is meant for people old enough to play Apex Legends under its age
rating and EA's rules. Do not use it if you are under [MINIMUM AGE]. We do not
knowingly receive personal data from children; if a child has sent us
something, contact us and we will delete it.

## Security

Your recordings are ordinary files in your Windows user folder, protected by
your Windows account. Anyone who can use your Windows account can read them.
Take care when you copy or send them, since they contain other players' names
and IDs.

## Changes to this policy

If we change this policy, we will publish the new version at [PRIVACY POLICY
URL] with a new date, and [HOW USERS ARE TOLD, e.g. mention it in the app's
"What's new"]. If a change affects what leaves your PC, we will tell you in the
app before it takes effect.

## Contact

[DEVELOPER NAME], [DEVELOPER ADDRESS]
Email: [CONTACT EMAIL]
Support: [SUPPORT CHANNEL]

---

## [IF ADS] Ads

> **Include this section only if ads are added.** Check it against the ads
> actually shipped and Overwolf's CMP guidelines at that time.

Apex Squads shows ads in its dashboard window to stay free. The ads come from
Overwolf's ad platform and its advertising partners ("vendors"). Ads never
appear in the cards shown during a match.

To show ads that are relevant to you, Overwolf and its partners may store
and/or access information on your computer and process personal data such as
your IP address and cookies, for these purposes:

- store and/or access information on a device;
- personalized ads and content;
- ad and content measurement;
- audience insights and product development.

**Your choice.** Where the law requires consent (typically in Europe), you are
asked the first time you use the app [or: when you install it], and no
personalized ads are shown without your consent. You can change your choices
at any time in **Settings, Privacy, Manage**, which opens Overwolf's privacy
settings. There you can see the list of vendors, give or withdraw consent per
purpose and per vendor, and object to processing based on legitimate interest.
Withdrawing consent does not affect processing before you withdrew it.

**Legal basis:** your consent (GDPR Article 6(1)(a)), or the vendor's
legitimate interest where the privacy settings say so, which you can object
to there.

Overwolf and each vendor are responsible for the data they collect for ads.
See Overwolf's privacy policy [OVERWOLF PRIVACY POLICY URL] and the vendor list
in the privacy settings. [IF ADS: also update "What leaves your PC" and "The
short version": the app would no longer switch off Overwolf's ad optimization
[CONFIRM], and "It shows no ads today" goes.]
