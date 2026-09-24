/**
 * The app's main window: frameless look with our own dark title bar. On
 * Windows the native min/max/close buttons are overlaid on it; on macOS the
 * traffic lights sit inside it.
 */
import { BrowserWindow, app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { buildDataset } from './build-dataset';
import { readRecordings } from './recordings';

const TITLE_BAR_HEIGHT = 40;
const BACKGROUND = '#0e0f11';

/** @param recordingsDirs where the dashboard's data comes from (every .jsonl in them). */
export function createMainWindow(recordingsDirs: string[]): BrowserWindow {
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
