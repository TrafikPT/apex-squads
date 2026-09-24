/**
 * Window-only entry point for working on the UI without Overwolf (e.g. on
 * macOS): `npm run app:preview`. The real app entry is main.ts.
 *
 * Shows the anonymized real matches in fixtures/recordings, or the folder in
 * APEX_RECORDINGS_DIR. APEX_UI_QUERY="data=sample" shows the generated sample data.
 */
import { app } from 'electron';
import path from 'node:path';
import { createMainWindow } from './window';

const recordings = process.env.APEX_RECORDINGS_DIR || path.join(__dirname, '..', 'fixtures', 'recordings');

app.whenReady().then(() => createMainWindow([recordings]));
app.on('window-all-closed', () => app.quit());
