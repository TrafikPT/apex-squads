/**
 * Window-only entry point for working on the UI without Overwolf (e.g. on
 * macOS): `npm run app:preview`. The real app entry is main.ts.
 *
 * Shows what the app has recorded (%APPDATA%\Apex Squads\recordings), or the
 * folder in APEX_RECORDINGS_DIR: fixtures/recordings has anonymized real
 * matches. APEX_UI_QUERY="data=sample" shows the generated sample data.
 *
 * The title bar reads Overwolf's real game events status. APEX_UI_STATUS sets
 * the status instead, as JSON (src/ui/game-status.ts), e.g.
 * '{"game":"recording","events":{"state":2,"disabled":false,"message":null,"degraded":["kill_feed"]}}'.
 */
import { app } from 'electron';
import { recordingsToShow } from './data-dir';
import { GameStatusTracker } from './game-status';
import type { GameStatus } from './ui/game-status';
import { createMainWindow } from './window';

const status = new GameStatusTracker((...args) => console.log(...args));
const fake = process.env.APEX_UI_STATUS;
if (fake) status.set(JSON.parse(fake) as Partial<GameStatus>);
else status.startPolling();

app.whenReady().then(() => createMainWindow([recordingsToShow()], { status }));
app.on('window-all-closed', () => app.quit());
