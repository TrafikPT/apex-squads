/**
 * A small click-through window over the game for kill/death popups. It is a
 * plain always-on-top window, so it shows over Apex only in borderless
 * windowed mode; Overwolf's in-game overlay replaces it once the app is
 * approved (DESIGN.md §12).
 */
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { Popup } from './ui/popup-card';

const WIDTH = 380;
const HEIGHT = 240;
const MARGIN = 24;
/** How long a popup stays up; a newer one replaces it and restarts the clock. */
const SHOW_MS = 7000;

export class PopupWindow {
  private win: BrowserWindow | null = null;
  private ready: Promise<void> | null = null;
  private hideTimer: NodeJS.Timeout | null = null;

  show(popup: Popup): void {
    const win = this.window();
    void this.ready!.then(() => {
      win.webContents.send('apex:popup', popup);
      win.showInactive();
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => win.hide(), SHOW_MS);
    });
  }

  /** Exposed for the replay preview's screenshots. */
  get browserWindow(): BrowserWindow {
    return this.window();
  }

  private window(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const area = screen.getPrimaryDisplay().workArea;
    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      x: area.x + area.width - WIDTH - MARGIN,
      y: area.y + MARGIN * 4,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      hasShadow: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true);
    this.ready = win.loadFile(path.join(__dirname, '..', 'ui', 'popup.html'));
    this.win = win;
    return win;
  }
}
