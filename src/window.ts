/**
 * The app's main window: frameless look with our own dark title bar. On
 * Windows the native min/max/close buttons are overlaid on it; on macOS the
 * traffic lights sit inside it.
 */
import { BrowserWindow, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const TITLE_BAR_HEIGHT = 40;
const BACKGROUND = '#0e0f11';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    title: 'Apex Squads',
    backgroundColor: BACKGROUND,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: BACKGROUND, symbolColor: '#c3c2b7', height: TITLE_BAR_HEIGHT },
    trafficLightPosition: { x: 14, y: 13 },
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // APEX_UI_VIEW opens a specific screen (dev aid, handy with APEX_UI_SCREENSHOT).
  const query: Record<string, string> = { platform: process.platform };
  if (process.env.APEX_UI_VIEW) query.view = process.env.APEX_UI_VIEW;
  if (process.env.APEX_UI_MATCH) query.match = process.env.APEX_UI_MATCH;
  win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'), { query });
  win.once('ready-to-show', () => win.show());

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
