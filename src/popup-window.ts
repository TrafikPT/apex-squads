/**
 * Where the kill/death and lobby cards show. Inside the game through Overwolf's
 * overlay when it's in the game (src/game-overlay.ts): fullscreen too, never
 * taking focus. Otherwise a small click-through always-on-top window, which
 * shows over Apex only in borderless windowed mode (DESIGN.md §12).
 */
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import type { GameArea, GameOverlay } from './game-overlay';
import { loadSettings } from './settings-store';
import { hotkeyLabel, type PopupPosition } from './ui/app-settings';
import type { Popup } from './ui/popup-card';

const WIDTH = 380;
const HEIGHT = 240;
const MARGIN = 24;
/** Top and bottom positions keep clear of the HUD's edges (compass, squad bars). */
const EDGE_GAP = MARGIN * 4;
/** The overlay window's name: unique, 20 characters or fewer, never per user or session. */
const OVERLAY_NAME = 'squad-cards';

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A window that can show the cards, with the area its positions are within. */
interface Surface {
  win: BrowserWindow;
  ready: Promise<void>;
  area: Area;
}

export class PopupWindow {
  private plain: { win: BrowserWindow; ready: Promise<void> } | null = null;
  private inGame: { win: BrowserWindow; ready: Promise<void> } | null = null;
  private creatingInGame: Promise<void> | null = null;
  /** The window showing a card now, to hide it when the next one goes elsewhere. */
  private shown: BrowserWindow | null = null;
  private hideTimer: NodeJS.Timeout | null = null;
  /** Cards turned off with the hotkey, until it turns them on again or the app restarts. */
  private paused = false;
  /** The session's first card carries the hotkey reminder. */
  private reminded = false;

  constructor(private readonly overlay: GameOverlay | null = null) {
    overlay?.onGameExit(() => {
      if (this.inGame && !this.inGame.win.isDestroyed()) this.inGame.win.destroy();
      this.inGame = null;
    });
  }

  /**
   * Shows a popup where the settings say, for as long as they say; skipped
   * when its kind is switched off, unless `force` (the Settings test button).
   * A newer popup replaces the one showing and restarts the clock.
   */
  show(popup: Popup, force = false): void {
    const { popups, hotkeys } = loadSettings();
    const enabled = popup.moment === 'notice' || (popup.moment === 'lobby' ? popups.lobby : popups.encounters);
    if (!force && (!enabled || (this.paused && popup.moment !== 'notice'))) return;
    if (!this.reminded && popup.moment !== 'notice') {
      this.reminded = true;
      popup = { ...popup, hint: `${hotkeyLabel(hotkeys.hide)} hides a card · ${hotkeyLabel(hotkeys.toggle)} turns cards off` };
    }
    void this.surface().then(async ({ win, ready, area }) => {
      if (this.shown && this.shown !== win && !this.shown.isDestroyed()) this.shown.hide();
      win.setBounds(bounds(popups.position, area));
      await ready;
      win.webContents.send('apex:popup', { ...popup, anchor: popups.position.startsWith('bottom') ? 'bottom' : 'top' });
      win.showInactive();
      this.shown = win;
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        if (!win.isDestroyed()) win.hide();
      }, popups.seconds * 1000);
    }).catch((err: unknown) => console.error('Popup failed:', err));
  }

  /** The hide hotkey: the card showing now goes away. */
  hideNow(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    if (this.shown && !this.shown.isDestroyed()) this.shown.hide();
  }

  /** The cards on/off hotkey; says which way it went, on a card of its own. */
  toggleCards(): void {
    this.paused = !this.paused;
    const key = hotkeyLabel(loadSettings().hotkeys.toggle);
    this.show({
      moment: 'notice',
      at: new Date().toISOString(),
      text: this.paused ? `Cards off until you press ${key} again` : 'Cards back on',
    });
  }

  /** Exposed for the replay preview's screenshots. */
  get browserWindow(): BrowserWindow {
    return this.plainSurface().win;
  }

  /** In the game when the overlay is there and knows the game window; else the plain window. */
  private async surface(): Promise<Surface> {
    const area = this.overlay?.gameArea();
    if (area) {
      await this.ensureInGame();
      if (this.inGame && !this.inGame.win.isDestroyed()) return { ...this.inGame, area: inGameArea(area) };
    }
    return this.plainSurface();
  }

  /** The in-game window, created once per game (the overlay's windows close with the game). */
  private ensureInGame(): Promise<void> {
    if (this.inGame && !this.inGame.win.isDestroyed()) return Promise.resolve();
    this.creatingInGame ??= this.overlay!.createWindow({
      name: OVERLAY_NAME,
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      // Cards only show things: every click and key stays with the game.
      passthrough: 'passThrough',
      ignoreKeyboardInput: true,
      zOrder: 'topMost',
      strictToGameWindow: true,
      dpiAware: true,
      webPreferences: webPreferences(),
    }).then((win) => {
      if (win) this.inGame = { win, ready: win.loadFile(popupPage()) };
    }).catch((err: unknown) => {
      console.error('Overlay window failed; cards stay in their own window:', err);
    }).finally(() => {
      this.creatingInGame = null;
    });
    return this.creatingInGame;
  }

  private plainSurface(): Surface {
    if (!this.plain || this.plain.win.isDestroyed()) {
      const win = new BrowserWindow({
        ...bounds(loadSettings().popups.position, screenArea()),
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        show: false,
        hasShadow: false,
        webPreferences: webPreferences(),
      });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setIgnoreMouseEvents(true);
      this.plain = { win, ready: win.loadFile(popupPage()) };
    }
    return { ...this.plain, area: screenArea() };
  }
}

function webPreferences(): Electron.WebPreferences {
  return { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') };
}

function popupPage(): string {
  return path.join(__dirname, '..', 'ui', 'popup.html');
}

/** The primary screen's work area: where the plain window goes. */
function screenArea(): Area {
  return screen.getPrimaryDisplay().workArea;
}

/**
 * The game window, for overlay windows. Assumed to be in the game window's own
 * coordinates, which the docs don't say; for fullscreen on the main monitor
 * that's the same as the screen's. Check with a windowed game (next-steps.md).
 */
function inGameArea(game: GameArea): Area {
  return { x: 0, y: 0, width: game.width, height: game.height };
}

/** Where in an area a popup at this position goes. */
function bounds(position: PopupPosition, area: Area): Area {
  const [vertical, horizontal] = position.split('-');
  const x = horizontal === 'left' ? area.x + MARGIN
    : horizontal === 'center' ? area.x + Math.round((area.width - WIDTH) / 2)
      : area.x + area.width - WIDTH - MARGIN;
  const y = vertical === 'top' ? area.y + EDGE_GAP : area.y + area.height - HEIGHT - EDGE_GAP;
  return { x, y, width: WIDTH, height: HEIGHT };
}
