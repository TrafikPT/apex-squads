/** Where the app keeps what it records; the previews read the same place by default. */
import { app } from 'electron';
import path from 'node:path';

/** Documents\ApexTracker, or APEX_TRACKER_DATA_DIR. */
export function dataDir(): string {
  return process.env.APEX_TRACKER_DATA_DIR || path.join(app.getPath('documents'), 'ApexTracker');
}

/** The recordings to show: APEX_RECORDINGS_DIR (e.g. fixtures/recordings), else the app's own. */
export function recordingsToShow(): string {
  return process.env.APEX_RECORDINGS_DIR || path.join(dataDir(), 'recordings');
}
