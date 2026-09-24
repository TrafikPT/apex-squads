/**
 * Window-only entry point for working on the UI without Overwolf (e.g. on
 * macOS): `npm run app:preview`. The real app entry is main.ts.
 */
import { app } from 'electron';
import { createMainWindow } from './window';

app.whenReady().then(() => createMainWindow());
app.on('window-all-closed', () => app.quit());
