/**
 * Window-only entry point for working on the UI without Overwolf (e.g. on
 * macOS): `npm run app:preview`. The real app entry is main.ts.
 *
 * Shows what the app has recorded (Documents\ApexTracker\recordings), or the
 * folder in APEX_RECORDINGS_DIR: fixtures/recordings has anonymized real
 * matches. APEX_UI_QUERY="data=sample" shows the generated sample data.
 */
import { app } from 'electron';
import { recordingsToShow } from './data-dir';
import { createMainWindow } from './window';

app.whenReady().then(() => createMainWindow([recordingsToShow()]));
app.on('window-all-closed', () => app.quit());
