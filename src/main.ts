/**
 * ow-electron entry point: wires Overwolf's Game Events Provider (GEP) to the
 * Recorder, and opens the dashboard window. Logs go to the terminal. Windows
 * only (GEP requirement); use preview-main.ts to work on the UI elsewhere.
 */
import { app } from 'electron';
import crypto from 'node:crypto';
import path from 'node:path';
import type { OverwolfGameEventPackage } from '@overwolf/ow-electron-packages-types';
import { JsonlSink } from './jsonl-sink';
import { PlayerHistory } from './player-history';
import { PopupService } from './popup-service';
import { PopupWindow } from './popup-window';
import { ApexStatusClient } from './rank-client';
import { readRecordings } from './recordings';
import { APEX_GAME_ID, Recorder, type Sink } from './recorder';
import { createMainWindow } from './window';

const SET_FEATURES_ATTEMPTS = 10;
const SET_FEATURES_RETRY_MS = 3000;

function log(...args: unknown[]): void {
  console.log(new Date().toISOString(), ...args);
}

const startedAt = new Date();
const sessionId = `${startedAt.toISOString().replace(/[:.]/g, '-')}_${crypto.randomBytes(3).toString('hex')}`;
const dataDir =
  process.env.APEX_TRACKER_DATA_DIR || path.join(app.getPath('documents'), 'ApexTracker');
const recordingsDir = path.join(dataDir, 'recordings');

// Everything met in earlier sessions, for the popups' "met before" and peak rank.
const history = new PlayerHistory();
for (const line of readRecordings([recordingsDir])) history.add(line);

const sink = new JsonlSink(recordingsDir, `${sessionId}.jsonl`);
const apiKey = process.env.APEX_STATUS_API_KEY;
const rankClient = apiKey ? new ApexStatusClient(apiKey) : null;
// Every recorded line also goes to the popups (kill/death cards).
let popups: PopupService | null = null;
const tee: Sink = {
  write: (line) => {
    sink.write(line);
    popups?.onLine(line);
  },
};
const recorder = new Recorder(sessionId, tee, rankClient);
const popupWindow = new PopupWindow();
popups = new PopupService({
  history,
  lookup: rankClient,
  recordLookup: (uid, value) => recorder.playerLookup(uid, value),
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
  });
  app.overwolf.packages.on('failed-to-initialize', (_e, packageName) => {
    log(`Overwolf package FAILED to initialize: ${packageName}`);
    recorder.lifecycle('package_failed', { package: packageName });
  });
  app.overwolf.packages.on('crashed', (_e, canRecover) => {
    log(`Overwolf package crashed (canRecover=${canRecover})`);
    recorder.lifecycle('package_crashed', { can_recover: canRecover });
  });

  app.whenReady().then(() => createMainWindow([recordingsDir]));
  // Closing the window must not stop recording: keep running until Ctrl+C (tray icon later).
  app.on('window-all-closed', () => undefined);
  app.on('before-quit', () => {
    recorder.lifecycle('session_end');
    recorder.dispose();
  });
}

function setupGep(gep: OverwolfGameEventPackage): void {
  gep.removeAllListeners();

  gep.on('game-detected', (event, gameId, name) => {
    recorder.lifecycle('game_detected', { game_id: gameId, name });
    if (gameId !== APEX_GAME_ID) return;
    log(`Apex Legends detected (${name}); enabling game events.`);
    event.enable();
    void registerFeatures(gep);
  });

  gep.on('elevated-privileges-required', (_e, gameId, name) => {
    log(`${name} runs as administrator: run this recorder as administrator too.`);
    recorder.lifecycle('elevated_privileges_required', { game_id: gameId, name });
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
  });
}

/** Subscribe to every Apex feature (null = all). GEP may need a few tries right after launch. */
async function registerFeatures(gep: OverwolfGameEventPackage): Promise<void> {
  for (let attempt = 1; attempt <= SET_FEATURES_ATTEMPTS; attempt++) {
    try {
      // The typings say `string[] | undefined`; Overwolf's own sample passes null for "all".
      await gep.setRequiredFeatures(APEX_GAME_ID, null as unknown as undefined);
      const features = await gep.getFeatures(APEX_GAME_ID);
      log(`Subscribed to ${features.length} features.`);
      recorder.lifecycle('features_set', { attempt, features });
      await snapshotInfo(gep);
      return;
    } catch (err) {
      recorder.lifecycle('features_set_failed', { attempt, error: String(err) });
      log(`setRequiredFeatures attempt ${attempt} failed: ${String(err)}`);
      await new Promise((resolve) => setTimeout(resolve, SET_FEATURES_RETRY_MS));
    }
  }
  log('Giving up on setRequiredFeatures; no game data will be recorded this session.');
}

/** Full current state; lets the views recover values set before the recorder started. */
async function snapshotInfo(gep: OverwolfGameEventPackage): Promise<void> {
  try {
    recorder.onInfoSnapshot(await gep.getInfo(APEX_GAME_ID));
  } catch (err) {
    recorder.lifecycle('get_info_failed', { error: String(err) });
  }
}
