/** Where the app keeps what it records; the previews read the same place by default. */
import { app } from 'electron';
import path from 'node:path';

/**
 * The app's userData folder, as Overwolf's storage guide does it:
 * %APPDATA%\Apex Squads (package.json productName). Spelled out because the
 * previews run Electron on a file, where userData would be Electron's own.
 */
const APP_FOLDER = 'Apex Squads';

/** %APPDATA%\Apex Squads, or APEX_SQUADS_DATA_DIR. */
export function dataDir(): string {
  return process.env.APEX_SQUADS_DATA_DIR || path.join(app.getPath('appData'), APP_FOLDER);
}

/** The recordings to show: APEX_RECORDINGS_DIR (e.g. fixtures/recordings), else the app's own. */
export function recordingsToShow(): string {
  return process.env.APEX_RECORDINGS_DIR || path.join(dataDir(), 'recordings');
}
