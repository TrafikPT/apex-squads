/**
 * The app's main window: frameless look with our own dark title bar. On
 * Windows the native min/max/close buttons are overlaid on it; on macOS the
 * traffic lights sit inside it.
 */
import { BrowserWindow, app, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { buildDataset } from './build-dataset';
import type { HelperResult } from './game-overlay';
import type { GameStatusTracker } from './game-status';
import { PopupWindow } from './popup-window';
import { IN_MATCH_PHASES } from './recorder';
import { readRecordings } from './recordings';
import { loadSettings, saveSettings, settingsFile } from './settings-store';
import type { Settings } from './ui/app-settings';
import { INITIAL_STATUS } from './ui/game-status';
import type { Popup } from './ui/popup-card';

const TITLE_BAR_HEIGHT = 40;
const BACKGROUND = '#0e0f11';
/** How often the recordings are checked for a newly finished match. */
const WATCH_MS = 5000;
/** How often the latest game phase is read, to keep the window from taking focus in a match. */
const PHASE_MS = 1000;
/** Loading into a match counts: Apex can let go of focus as the drop starts. */
const NO_FOCUS_PHASES: ReadonlySet<string> = new Set([...IN_MATCH_PHASES, 'loading_screen']);
/** A newest recording untouched for this long is from a game that's over, whatever its last phase. */
const STALE_MS = 5 * 60_000;
/** Enough of a recording's end to hold its last phase line: a match writes several lines a second. */
const TAIL_BYTES = 256 * 1024;

/** What the Settings test button shows: a made-up death card. */
const TEST_POPUP: Popup = {
  moment: 'killed_by',
  at: new Date(0).toISOString(),
  player: {
    name: 'Test popup', anonymous: false, kills: 3, killLeader: true, weapon: 'R-301', damageFromMe: 142,
    metBefore: 2, kd: 1.5, killsSeen: 3, theyKilledMe: 1, iKilledThem: 0,
  },
};
let testPopups: PopupWindow | null = null;

/** What the real app (main.ts) lends the dashboard; the previews go without. */
export interface AppServices {
  /** The app's card window, so the test card goes where real ones do (in the game when the overlay is there) and the hotkeys work on it. */
  popups?: PopupWindow;
  /** The title bar's status. */
  status?: GameStatusTracker;
  /** Settings' button for elevated Apex (src/game-overlay.ts). */
  installOverlayHelper?: () => Promise<HelperResult>;
}

/** @param recordingsDirs where the dashboard's data comes from (every .jsonl in them). */
export function createMainWindow(recordingsDirs: string[], services: AppServices = {}): BrowserWindow {
  const { popups, status } = services;
  ipcMain.removeHandler('apex:settings');
  ipcMain.handle('apex:settings', () => loadSettings());
  ipcMain.removeHandler('apex:save-settings');
  ipcMain.handle('apex:save-settings', (_e, settings: Settings) => saveSettings(settings));
  ipcMain.removeHandler('apex:test-popup');
  ipcMain.handle('apex:test-popup', () => {
    testPopups ??= popups ?? new PopupWindow();
    testPopups.show(TEST_POPUP, true);
  });

  ipcMain.removeHandler('apex:status');
  ipcMain.handle('apex:status', () => status?.current ?? INITIAL_STATUS);
  ipcMain.removeHandler('apex:install-overlay-helper');
  ipcMain.handle('apex:install-overlay-helper', () => services.installOverlayHelper?.() ?? 'unavailable');

  ipcMain.removeHandler('apex:open-recordings');
  ipcMain.handle('apex:open-recordings', async () => {
    fs.mkdirSync(recordingsDirs[0], { recursive: true });
    const error = await shell.openPath(recordingsDirs[0]);
    if (error) console.error(`Could not open ${recordingsDirs[0]}: ${error}`);
  });

  ipcMain.removeHandler('apex:data-info');
  ipcMain.handle('apex:data-info', () => {
    const dir = recordingsDirs[0];
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')) : [];
    return {
      recordingsFolder: path.resolve(dir),
      sessions: files.length,
      bytes: files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0),
      settingsFile: settingsFile(),
    };
  });

  ipcMain.removeHandler('apex:dataset');
  ipcMain.handle('apex:dataset', () => {
    // Rebuilt from the raw lines on every load, so stat fixes apply to all history.
    const started = Date.now();
    const lines = readRecordings(recordingsDirs);
    const { dataset, incomplete } = buildDataset(lines);
    console.log(
      `Dataset: ${dataset.matches.length} matches from ${lines.length} lines in ${Date.now() - started} ms` +
        (incomplete ? ` (${incomplete} incomplete matches left out)` : '') +
        ` [${recordingsDirs.join(', ')}]`,
    );
    return dataset;
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    title: 'Apex Squads',
    // Installed builds show the exe's icon; this covers dev runs (npm run icons).
    icon: path.join(__dirname, '..', 'ui', 'assets', 'icon', 'window.png'),
    backgroundColor: BACKGROUND,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: BACKGROUND, symbolColor: '#c3c2b7', height: TITLE_BAR_HEIGHT },
    trafficLightPosition: { x: 14, y: 13 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Dev aid, handy with APEX_UI_SCREENSHOT: APEX_UI_QUERY="view=squads&squads=comps"
  // opens a specific screen/state (see the query params read in src/ui).
  const query: Record<string, string> = {
    ...Object.fromEntries(new URLSearchParams(process.env.APEX_UI_QUERY ?? '')),
    platform: process.platform,
  };
  win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'), { query });
  win.once('ready-to-show', () => win.show());
  watchForFinishedMatches(recordingsDirs, win);
  if (status) {
    const stop = status.onChange((next) => {
      if (!win.isDestroyed()) win.webContents.send('apex:status-changed', next);
    });
    win.on('closed', stop);
  }
  noFocusInMatches(recordingsDirs, win);

  // Dev aid: APEX_UI_SCREENSHOT=out.png renders the window to a file and quits.
  const shot = process.env.APEX_UI_SCREENSHOT;
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        fs.writeFileSync(shot, image.toPNG());
        app.quit();
      }, 800);
    });
  }
  return win;
}

/**
 * Tells the window to reload its data when the finished matches (those with a
 * match_summary) change, not on every line written mid-match. That includes a
 * match's RP, which GEP's stats bring 15-30 s after the match ends. Polls
 * sizes: on Windows, appends to a file held open don't reliably reach fs.watch.
 */
function watchForFinishedMatches(recordingsDirs: string[], win: BrowserWindow): void {
  const finished = (): string => JSON.stringify(buildDataset(readRecordings(recordingsDirs)).dataset.matches);
  let files = fileSizes(recordingsDirs);
  let matches = finished();
  const timer = setInterval(() => {
    const now = fileSizes(recordingsDirs);
    if (now === files) return;
    files = now;
    const next = finished();
    if (next === matches) return;
    matches = next;
    console.log('Finished matches changed: reloading the dashboard.');
    win.webContents.send('apex:dataset-changed');
  }, WATCH_MS);
  win.on('closed', () => clearInterval(timer));
}

/**
 * While a match is on, the window can't take focus: when Apex lets go of it
 * (seen as the drop starts), Windows would hand it to this window, and the
 * mouse pointer would show over the game. Clicks and scrolling still work;
 * between matches it behaves like any window.
 */
function noFocusInMatches(recordingsDirs: string[], win: BrowserWindow): void {
  let blocked = false;
  const timer = setInterval(() => {
    const phase = latestPhase(recordingsDirs);
    const next = phase !== null && NO_FOCUS_PHASES.has(phase);
    if (next === blocked || win.isDestroyed()) return;
    blocked = next;
    win.setFocusable(!blocked);
    console.log(blocked ? `In a match (${phase}): the dashboard won't take focus.` : 'Match over: the dashboard can take focus again.');
  }, PHASE_MS);
  win.on('closed', () => clearInterval(timer));
}

/** The last game phase in the newest recording, or null if there's none or it's stale. */
function latestPhase(dirs: string[]): string | null {
  const newest = dirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).map((n) => path.join(dir, n)))
    .map((file) => ({ file, stat: fs.statSync(file) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0];
  if (!newest || Date.now() - newest.stat.mtimeMs > STALE_MS) return null;

  const length = Math.min(TAIL_BYTES, newest.stat.size);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(newest.file, 'r');
  try {
    fs.readSync(fd, buffer, 0, length, newest.stat.size - length);
  } finally {
    fs.closeSync(fd);
  }
  const lines = buffer.toString('utf8').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"key":"phase"')) continue;
    try {
      const value = (JSON.parse(lines[i]) as { value?: unknown }).value;
      if (typeof value === 'string') return value;
    } catch {
      // The first line of the tail is usually cut; keep looking.
    }
  }
  return null;
}

function fileSizes(dirs: string[]): string {
  return dirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) =>
      fs.readdirSync(dir)
        .filter((n) => n.endsWith('.jsonl'))
        .map((n) => `${n}:${fs.statSync(path.join(dir, n)).size}`),
    )
    .join(',');
}
