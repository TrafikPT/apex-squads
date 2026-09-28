/**
 * Runs the real card window and hotkeys against a fake Overwolf overlay
 * (src/fake-overlay.ts), on any OS: `npm run overlay:check`. Plays a game
 * session (no game, cards in their own window; Apex starts, cards go in; the
 * hotkeys; Apex closes and starts again; Apex as administrator and the helper)
 * and checks where each card went. Prints one line per check and exits 1 if
 * any failed. APEX_CHECK_SHOTS=<folder> also saves the in-game card as a PNG.
 *
 * What it can't check is Overwolf's side (injection, coordinates, whether
 * overlay hotkeys fire): that's the Windows checklist in docs/next-steps.md.
 */
import { app, BrowserWindow, globalShortcut } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FakeOverlayApi } from './fake-overlay';
import { GameOverlay } from './game-overlay';
import { Hotkeys } from './hotkeys';
import { PopupWindow } from './popup-window';
import { loadSettings } from './settings-store';
import type { Popup } from './ui/popup-card';

// A settings file of our own: the defaults (F9, F10, top right), whatever the user has saved.
process.env.APEX_SETTINGS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'apex-overlay-check-')), 'settings.json');

const APEX = { id: 21566, classId: 215661, name: 'Apex Legends', width: 2560, height: 1440 };
const KILL: Popup = {
  moment: 'you_killed',
  at: new Date(0).toISOString(),
  player: {
    name: 'Overlay check', anonymous: false, kills: 2, killLeader: false, weapon: 'R-301', damageFromMe: 180,
    metBefore: 1, kd: 1, killsSeen: 2, theyKilledMe: 0, iKilledThem: 1,
  },
};

/** What each window was sent, and where it was put. */
interface Watched {
  win: BrowserWindow;
  sent: Popup[];
  bounds: Electron.Rectangle[];
}

function watch(win: BrowserWindow): Watched {
  const w: Watched = { win, sent: [], bounds: [] };
  const send = win.webContents.send.bind(win.webContents);
  win.webContents.send = (channel: string, ...args: unknown[]) => {
    if (channel === 'apex:popup') w.sent.push(args[0] as Popup);
    send(channel, ...args);
  };
  const setBounds = win.setBounds.bind(win);
  win.setBounds = (b: Partial<Electron.Rectangle>, animate?: boolean) => {
    w.bounds.push(b as Electron.Rectangle);
    setBounds(b, animate);
  };
  return w;
}

let failed = 0;
function check(what: string, ok: boolean, detail = ''): void {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${!ok && detail ? `  (${detail})` : ''}`);
}

async function until(condition: () => boolean, ms = 3000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return condition();
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  const inGame: Watched[] = [];
  const fake = new FakeOverlayApi((options) => {
    const win = new BrowserWindow({ ...options, show: false });
    inGame.push(watch(win));
    return win;
  });
  const overlay = new GameOverlay(() => undefined);
  const popups = new PopupWindow(overlay);
  const hotkeys = new Hotkeys(overlay, { hideCard: () => popups.hideNow(), toggleCards: () => popups.toggleCards() }, () => undefined);
  overlay.onGameInjected(() => hotkeys.apply(loadSettings()));
  overlay.onGameExit(() => hotkeys.apply(loadSettings()));
  overlay.attach(fake.api);
  hotkeys.apply(loadSettings());
  const plain = watch(popups.browserWindow);
  const latestInGame = () => inGame[inGame.length - 1];

  // No game yet: the plain window, global shortcuts.
  check('no game: F9 and F10 are global shortcuts', globalShortcut.isRegistered('F9') && globalShortcut.isRegistered('F10'));
  popups.show(KILL);
  check('no game: the card goes to the plain window', await until(() => plain.sent.length === 1 && plain.win.isVisible()));
  check('the session\'s first card carries the hotkey reminder', plain.sent[0]?.hint === 'F9 hides a card · F10 turns cards off', String(plain.sent[0]?.hint));

  // Apex starts: the overlay gets in.
  fake.launch(APEX);
  check('in game: hotkeys move into the overlay, passing keys on', fake.hotkeys.all().every((h) => h.passthrough) &&
    fake.hotkeys.all().map((h) => h.name).join() === 'cards-hide,cards-toggle' && !globalShortcut.isRegistered('F9'));
  popups.show(KILL);
  check('in game: the card goes to an overlay window', await until(() => inGame.length === 1 && latestInGame().sent.length === 1 && latestInGame().win.isVisible()));
  const options = fake.created[0]?.options;
  check('in game: the overlay window passes input through and stays in the game window',
    options?.name === 'squad-cards' && options.passthrough === 'passThrough' && options.strictToGameWindow === true && options.zOrder === 'topMost');
  check('in game: the plain window is hidden', !plain.win.isVisible());
  const b = latestInGame().bounds.at(-1);
  check('in game: top right of the 2560x1440 game window', b?.x === 2560 - 380 - 24 && b?.y === 96, JSON.stringify(b));
  check('in game: only the first card has the reminder', latestInGame().sent[0]?.hint === undefined);
  const shots = process.env.APEX_CHECK_SHOTS;
  if (shots) {
    await pause(400);
    fs.mkdirSync(shots, { recursive: true });
    fs.writeFileSync(path.join(shots, 'in-game-card.png'), (await latestInGame().win.webContents.capturePage()).toPNG());
  }

  // The hotkeys.
  fake.hotkeys.press('cards-hide');
  check('F9 hides the card at once', await until(() => !latestInGame().win.isVisible()));
  fake.hotkeys.press('cards-toggle');
  check('F10 says the cards are off', await until(() => latestInGame().sent.at(-1)?.moment === 'notice' &&
    (latestInGame().sent.at(-1) as { text?: string }).text === 'Cards off until you press F10 again'));
  const before = latestInGame().sent.length;
  popups.show(KILL);
  await pause(300);
  check('cards off: no card', latestInGame().sent.length === before);
  fake.hotkeys.press('cards-toggle');
  check('F10 again: cards back on', await until(() => (latestInGame().sent.at(-1) as { text?: string }).text === 'Cards back on'));
  popups.show(KILL);
  check('cards on: the card shows', await until(() => latestInGame().sent.at(-1)?.moment === 'you_killed'));

  // Apex closes: its overlay windows go, the cards and keys come back out.
  const first = latestInGame();
  fake.exit();
  check('game closed: its overlay window is gone', first.win.isDestroyed());
  check('game closed: F9 and F10 are global again', globalShortcut.isRegistered('F9') && globalShortcut.isRegistered('F10'));
  const plainBefore = plain.sent.length;
  popups.show(KILL);
  check('game closed: the card goes to the plain window', await until(() => plain.sent.length === plainBefore + 1));

  // Apex again: a new overlay window.
  fake.launch(APEX);
  popups.show(KILL);
  check('game again: a new overlay window gets the card', await until(() => inGame.length === 2 && latestInGame().sent.length === 1));
  fake.exit();

  // Apex as administrator: the plain window until the helper is installed.
  fake.launch({ ...APEX, elevated: true });
  check('elevated Apex: the helper is asked for', await until(() => overlay.cardsPlace === 'needs-helper'));
  const plainElevated = plain.sent.length;
  popups.show(KILL);
  check('elevated Apex: the card goes to the plain window', await until(() => plain.sent.length === plainElevated + 1));
  fake.helperOutcome = 'declined';
  check('helper declined: reported as declined', await overlay.installHelper() === 'declined' && overlay.cardsPlace === 'needs-helper');
  fake.helperOutcome = 'installed';
  check('helper installed: the overlay gets in', await overlay.installHelper() === 'installed' && overlay.cardsPlace === 'in-game');
  popups.show(KILL);
  check('helper installed: the card goes in the game', await until(() => inGame.length === 3 && latestInGame().sent.length === 1));
  fake.exit();

  hotkeys.clear();
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
}

app.whenReady()
  .then(run)
  .catch((err: unknown) => {
    failed++;
    console.error('Overlay check crashed:', err);
  })
  .finally(() => app.exit(failed ? 1 : 0));
