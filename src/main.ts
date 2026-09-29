/**
 * ow-electron entry point: wires Overwolf's Game Events Provider (GEP) to the
 * Recorder, and opens the dashboard window. Runs on in the tray when the window
 * is closed. Logs go to the terminal. Windows only (GEP requirement); use
 * preview-main.ts to work on the UI elsewhere.
 */
import { app, globalShortcut, type BrowserWindow } from 'electron';
import crypto from 'node:crypto';
import path from 'node:path';
import type { OverwolfGameEventPackage } from '@overwolf/ow-electron-packages-types';
import { AccountIdFile } from './account-ids';
import { dataDir } from './data-dir';
import { GameOverlay } from './game-overlay';
import { GameStatusTracker } from './game-status';
import { Hotkeys } from './hotkeys';
import { JsonlSink } from './jsonl-sink';
import { PlayerHistory } from './player-history';
import { PopupService } from './popup-service';
import { PopupWindow } from './popup-window';
import { ApexStatusClient } from './rank-client';
import { readRecordings } from './recordings';
import { APEX_GAME_ID, Recorder, systemClock, type Sink } from './recorder';
import { loadSettings, onSettingsSaved } from './settings-store';
import { createTray, startedHidden } from './tray';
import { createMainWindow } from './window';

const SET_FEATURES_ATTEMPTS = 10;
const SET_FEATURES_RETRY_MS = 3000;

function log(...args: unknown[]): void {
  console.log(new Date().toISOString(), ...args);
}

const startedAt = new Date();
const sessionId = `${startedAt.toISOString().replace(/[:.]/g, '-')}_${crypto.randomBytes(3).toString('hex')}`;
const recordingsDir = path.join(dataDir(), 'recordings');

// Everything met in earlier sessions, for the popups' history (met before, K/D).
const history = new PlayerHistory();
for (const line of readRecordings([recordingsDir])) history.add(line);

const sink = new JsonlSink(recordingsDir, `${sessionId}.jsonl`);
const apiKey = process.env.APEX_STATUS_API_KEY;
const rankClient = apiKey ? new ApexStatusClient(apiKey) : null;
// Every recorded line also goes to the popups (kill/death and lobby cards).
let popups: PopupService | null = null;
const tee: Sink = {
  write: (line) => {
    sink.write(line);
    popups?.onLine(line);
  },
};
// My EA ID per account, so the lobby's RP lookup works before the first match.
const recorder = new Recorder(sessionId, tee, rankClient, systemClock, new AccountIdFile(path.join(dataDir(), 'accounts.json')));
// The cards go inside the game once Overwolf's overlay is in it; a plain window until then.
const overlay = new GameOverlay(log);
const popupWindow = new PopupWindow(overlay);
// The title bar's status: recording, Overwolf's game data health, where the cards go.
const status = new GameStatusTracker(log);
overlay.onCardsPlaceChanged((cards) => status.set({ cards }));
popups = new PopupService({
  history,
  show: (popup) => {
    if (app.isReady()) popupWindow.show(popup);
  },
});

if (!app.requestSingleInstanceLock()) {
  log('Another recorder is already running; exiting.');
  app.quit();
} else {
  // Personal tool: opt out of Overwolf analytics/ads features. Must run before app ready.
  app.overwolf.disableAnonymousAnalytics();
  app.overwolf.disableAdsOptimization();

  recorder.lifecycle('session_start', {
    app_version: app.getVersion(),
    versions: process.versions,
    rp_snapshots_enabled: Boolean(apiKey),
  });
  log(`Recording to ${sink.filePath}`);
  if (!apiKey) log('APEX_STATUS_API_KEY not set: RP snapshots disabled.');

  app.overwolf.packages.on('ready', (_e, packageName, version) => {
    log(`Overwolf package ready: ${packageName} ${version}`);
    recorder.lifecycle('package_ready', { package: packageName, version });
    if (packageName === 'gep') setupGep(app.overwolf.packages.gep);
    if (packageName === 'overlay') overlay.attach(app.overwolf.packages.overlay);
  });
  app.overwolf.packages.on('failed-to-initialize', (_e, packageName) => {
    log(`Overwolf package FAILED to initialize: ${packageName}`);
    recorder.lifecycle('package_failed', { package: packageName });
  });
  app.overwolf.packages.on('crashed', (_e, canRecover) => {
    log(`Overwolf package crashed (canRecover=${canRecover})`);
    recorder.lifecycle('package_crashed', { can_recover: canRecover });
  });

  app.whenReady().then(() => {
    status.startPolling();
    createTray({ openDashboard, quit: () => app.quit() });
    // Started by the login item: wait in the tray until the user opens the dashboard.
    if (!startedHidden()) openDashboard();
    // Hotkeys follow the settings, and move into the game with the overlay and back out.
    const hotkeys = new Hotkeys(overlay, globalShortcut, { hideCard: () => popupWindow.hideNow(), toggleCards: () => popupWindow.toggleCards() }, log);
    hotkeys.apply(loadSettings());
    onSettingsSaved((settings) => hotkeys.apply(settings));
    overlay.onGameInjected(() => hotkeys.apply(loadSettings()));
    overlay.onGameExit(() => hotkeys.apply(loadSettings()));
    app.on('will-quit', () => hotkeys.clear());
  });
  // Launching the app again (e.g. its desktop icon) while it runs in the tray.
  app.on('second-instance', () => openDashboard());
  // Closing the window must not stop recording: the app runs on in the tray until Quit.
  app.on('window-all-closed', () => undefined);
  app.on('before-quit', () => {
    recorder.lifecycle('session_end');
    recorder.dispose();
  });
}

let dashboard: BrowserWindow | null = null;

/** Shows the dashboard, or opens it again if it was closed (closing frees its memory). */
function openDashboard(): void {
  if (dashboard && !dashboard.isDestroyed()) {
    if (dashboard.isMinimized()) dashboard.restore();
    dashboard.show();
    dashboard.focus();
    return;
  }
  dashboard = createMainWindow([recordingsDir], {
    popups: popupWindow,
    status,
    installOverlayHelper: () => overlay.installHelper(),
  });
}

function setupGep(gep: OverwolfGameEventPackage): void {
  gep.removeAllListeners();

  gep.on('game-detected', (event, gameId, name) => {
    recorder.lifecycle('game_detected', { game_id: gameId, name });
    if (gameId !== APEX_GAME_ID) return;
    log(`Apex Legends detected (${name}); enabling game events.`);
    status.set({ game: 'starting' });
    void status.refreshEvents();
    event.enable();
    void registerFeatures(gep);
  });

  gep.on('elevated-privileges-required', (_e, gameId, name) => {
    log(`${name} runs as administrator: run this recorder as administrator too.`);
    recorder.lifecycle('elevated_privileges_required', { game_id: gameId, name });
    if (gameId === APEX_GAME_ID) status.set({ game: 'needs-admin' });
  });

  gep.on('new-info-update', (_e, gameId, data) => {
    if (gameId !== APEX_GAME_ID) return;
    recorder.onInfoUpdate(data);
    if (data.category === 'game_info' && data.key === 'phase') {
      log(`Phase: ${String(data.value)}`);
      void snapshotInfo(gep);
    }
  });

  gep.on('new-game-event', (_e, gameId, data) => {
    if (gameId !== APEX_GAME_ID) return;
    recorder.onGameEvent(data);
  });

  gep.on('error', (_e, gameId, error, ...args) => {
    log(`GEP error (game ${gameId}): ${error}`, ...args);
    recorder.lifecycle('gep_error', { game_id: gameId, error, args });
  });

  gep.on('game-exit', (_e, gameId, gameName) => {
    log(`Game exited: ${gameName}`);
    recorder.lifecycle('game_exit', { game_id: gameId, name: gameName });
    if (gameId === APEX_GAME_ID) status.set({ game: 'none' });
  });
}

/**
 * Subscribe to every Apex feature. Overwolf staff: the list is a filter and no list
 * means everything (docs/overwolf/gep-and-compliance.md §3). GEP may need a few tries
 * right after launch.
 */
async function registerFeatures(gep: OverwolfGameEventPackage): Promise<void> {
  for (let attempt = 1; attempt <= SET_FEATURES_ATTEMPTS; attempt++) {
    try {
      // The typings say `string[] | undefined`; Overwolf's own sample passes null for "all".
      await gep.setRequiredFeatures(APEX_GAME_ID, null as unknown as undefined);
      // setRequiredFeatures reports nothing back; getFeatures lists what Apex supports.
      const features = await gep.getFeatures(APEX_GAME_ID);
      log(`Subscribed to all features; Apex supports ${features.length}: ${features.join(', ')}.`);
      recorder.lifecycle('features_set', { attempt, features });
      status.set({ game: 'recording' });
      await snapshotInfo(gep);
      return;
    } catch (err) {
      recorder.lifecycle('features_set_failed', { attempt, error: String(err) });
      log(`setRequiredFeatures attempt ${attempt} failed: ${String(err)}`);
      await new Promise((resolve) => setTimeout(resolve, SET_FEATURES_RETRY_MS));
    }
  }
  log('Giving up on setRequiredFeatures; no game data will be recorded this session.');
  status.set({ game: 'no-data' });
}

/** Full current state; lets the views recover values set before the recorder started. */
async function snapshotInfo(gep: OverwolfGameEventPackage): Promise<void> {
  try {
    recorder.onInfoSnapshot(await gep.getInfo(APEX_GAME_ID));
  } catch (err) {
    recorder.lifecycle('get_info_failed', { error: String(err) });
  }
}
