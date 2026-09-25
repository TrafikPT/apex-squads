/**
 * A small click-through window over the game for kill/death popups. It is a
 * plain always-on-top window, so it shows over Apex only in borderless
 * windowed mode; Overwolf's in-game overlay replaces it once the app is
 * approved (DESIGN.md §12).
 */
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { loadSettings } from './settings-store';
import type { PopupPosition } from './ui/app-settings';
import type { Popup } from './ui/popup-card';

const WIDTH = 380;
const HEIGHT = 240;
const MARGIN = 24;
/** Top and bottom positions keep clear of the HUD's edges (compass, squad bars). */
const EDGE_GAP = MARGIN * 4;

export class PopupWindow {
  private win: BrowserWindow | null = null;
  private ready: Promise<void> | null = null;
  private hideTimer: NodeJS.Timeout | null = null;

  /**
   * Shows a popup where the settings say, for as long as they say; skipped
   * when its kind is switched off, unless `force` (the Settings test button).
   * A newer popup replaces the one showing and restarts the clock.
   */
  show(popup: Popup, force = false): void {
    const { popups } = loadSettings();
    if (!force && !(popup.moment === 'lobby' ? popups.lobby : popups.encounters)) return;
    const win = this.window();
    win.setBounds(bounds(popups.position));
    void this.ready!.then(() => {
      win.webContents.send('apex:popup', { ...popup, anchor: popups.position.startsWith('bottom') ? 'bottom' : 'top' });
      win.showInactive();
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => win.hide(), popups.seconds * 1000);
    });
  }

  /** Exposed for the replay preview's screenshots. */
  get browserWindow(): BrowserWindow {
    return this.window();
  }

  private window(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const win = new BrowserWindow({
      ...bounds(loadSettings().popups.position),
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

/** Where on the primary screen a popup at this position goes. */
function bounds(position: PopupPosition): { x: number; y: number; width: number; height: number } {
  const area = screen.getPrimaryDisplay().workArea;
  const [vertical, horizontal] = position.split('-');
  const x = horizontal === 'left' ? area.x + MARGIN
    : horizontal === 'center' ? area.x + Math.round((area.width - WIDTH) / 2)
      : area.x + area.width - WIDTH - MARGIN;
  const y = vertical === 'top' ? area.y + EDGE_GAP : area.y + area.height - HEIGHT - EDGE_GAP;
  return { x, y, width: WIDTH, height: HEIGHT };
}
