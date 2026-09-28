/**
 * Overwolf's in-game overlay: draws our windows inside the game, so the cards
 * show in fullscreen too and never take focus from it (docs/overwolf/api-reference.md,
 * `overlay`). Injects when Apex starts; until then, or if injection fails, the
 * popups use their plain always-on-top window instead (src/popup-window.ts).
 *
 * APEX_OVERLAY_ANY_GAME=1 injects into any game the overlay supports: for testing
 * while Apex's overlay is switched off (docs/overwolf/gep-and-compliance.md §5).
 */
import type { BrowserWindow } from 'electron';
import type { GameInfo, IOverwolfOverlayApi, OverlayWindowOptions } from '@overwolf/ow-electron-packages-types';
import { APEX_GAME_ID } from './recorder';

/**
 * The overlay names a game by `id` and `classId`, and the docs disagree on which
 * one is GEP's id (Overwatch: id 108441, classId 10844; League of Legends shown
 * the other way round). Register and match both forms of Apex's.
 */
const APEX_OVERLAY_IDS = [APEX_GAME_ID, APEX_GAME_ID * 10 + 1];

export interface GameArea {
  width: number;
  height: number;
}

/**
 * Where the cards go: inside the game, their own window, or their own window
 * because Apex runs as administrator and the overlay needs its helper for that.
 */
export type CardsPlace = 'in-game' | 'window' | 'needs-helper';

/** What installing the overlay's helper for elevated games came to. */
export type HelperResult = 'installed' | 'declined' | 'failed' | 'unavailable';

/** Windows' ERROR_CANCELLED: the user said no to the UAC prompt. */
const UAC_DECLINED = 1223;

export class GameOverlay {
  private api: IOverwolfOverlayApi | null = null;
  /** The game the overlay is in, from `game-injected` to `game-exit`. */
  private game: GameInfo | null = null;
  /** An elevated game the overlay couldn't get into for want of its helper. */
  private blocked: GameInfo | null = null;
  private readonly exitListeners: (() => void)[] = [];
  private readonly injectedListeners: (() => void)[] = [];
  private readonly placeListeners: ((place: CardsPlace) => void)[] = [];

  constructor(
    private readonly log: (...args: unknown[]) => void,
    private readonly anyGame = process.env.APEX_OVERLAY_ANY_GAME === '1',
  ) {}

  /** Call when the overlay package is ready. */
  attach(api: IOverwolfOverlayApi): void {
    this.api = api;
    api.removeAllListeners();
    api.on('game-launched', (event, game) => {
      if (!this.wanted(game)) return;
      if (!game.supported) {
        this.log(`Overlay: ${game.name} doesn't support the overlay; cards stay in their own window.`);
        return;
      }
      this.log(`Overlay: injecting into ${game.name} (id ${game.id}, class ${game.classId})` +
        (game.processInfo?.isElevated ? ', which runs as administrator' : ''));
      event.inject();
    });
    api.on('game-injected', (game) => {
      this.game = game;
      this.blocked = null;
      this.log(`Overlay: in ${game.name}; cards will show in the game.`);
      for (const listener of this.injectedListeners) listener();
      this.placeChanged();
    });
    api.on('game-injection-error', (game, error, ...args) => {
      this.log(`Overlay: couldn't get into ${game.name} (${error}); cards stay in their own window.`, ...args);
      if (game.processInfo?.isElevated) void this.checkHelper(game);
    });
    // Logged once per game, for checking where the cards go in windowed mode (docs/next-steps.md item 3).
    let windowLogged = false;
    api.on('game-window-changed', (info, game) => {
      if (windowLogged) return;
      windowLogged = true;
      this.log(`Overlay: ${game.name}'s window is ${info.size.width}x${info.size.height}, ` +
        `bounds ${JSON.stringify(info.bounds ?? null)}, screen ${JSON.stringify(info.screen?.bounds ?? null)}.`);
    });
    api.on('game-exit', (game) => {
      windowLogged = false;
      if (this.blocked && sameGame(game, this.blocked)) {
        this.blocked = null;
        this.placeChanged();
      }
      if (!this.game || !sameGame(game, this.game)) return;
      this.game = null;
      this.log(`Overlay: ${game.name} closed.`);
      for (const listener of this.exitListeners) listener();
      this.placeChanged();
    });
    api.on('error', (...args) => this.log('Overlay error:', ...args));
    void Promise.resolve(api.registerGames(this.anyGame ? { all: true } : { gamesIds: APEX_OVERLAY_IDS }))
      .catch((err: unknown) => this.log(`Overlay: registering games failed: ${String(err)}`));
  }

  /** The overlay's API while it's in a game (for hotkeys); null otherwise. */
  get injectedApi(): IOverwolfOverlayApi | null {
    return this.game ? this.api : null;
  }

  /**
   * The game window's size, once the game has reported it (a few seconds after
   * injection); null before that or when not in a game. Overlay windows are
   * placed within it.
   */
  gameArea(): GameArea | null {
    if (!this.game) return null;
    const size = this.api?.getActiveGameInfo()?.gameWindowInfo?.size;
    return size && size.width > 0 && size.height > 0 ? { width: size.width, height: size.height } : null;
  }

  /** A window drawn inside the game; null when not in a game. */
  async createWindow(options: OverlayWindowOptions): Promise<BrowserWindow | null> {
    if (!this.game || !this.api) return null;
    const overlayWindow = await this.api.createWindow(options);
    return overlayWindow.window;
  }

  get cardsPlace(): CardsPlace {
    return this.game ? 'in-game' : this.blocked ? 'needs-helper' : 'window';
  }

  /** Runs when the cards move between the game and their own window, or need the helper. */
  onCardsPlaceChanged(listener: (place: CardsPlace) => void): void {
    this.placeListeners.push(listener);
  }

  /**
   * Installs the overlay's helper for games that run as administrator: Windows
   * asks the user first (UAC). Only from the user's click in Settings, never on
   * its own: the prompt would take focus from the game. If Apex is running, the
   * overlay tries again at once.
   */
  async installHelper(): Promise<HelperResult> {
    const api = this.api;
    if (!api?.installHighElevationHelper) return 'unavailable';
    try {
      await api.installHighElevationHelper();
    } catch (err) {
      const exitCode = (err as { exitCode?: unknown } | null)?.exitCode;
      if (exitCode === UAC_DECLINED) {
        this.log('Overlay: the helper for elevated games was declined at the Windows prompt.');
        return 'declined';
      }
      this.log(`Overlay: installing the helper for elevated games failed (exit code ${String(exitCode)}): ${String(err)}`);
      return 'failed';
    }
    this.log('Overlay: helper for elevated games installed.');
    const game = this.blocked;
    if (game) {
      try {
        await api.requestGameInjection(game.classId);
      } catch (err) {
        this.log(`Overlay: trying ${game.name} again failed: ${String(err)}`);
      }
    }
    return 'installed';
  }

  /** Runs when the overlay gets into a game (e.g. to move the hotkeys there). */
  onGameInjected(listener: () => void): void {
    this.injectedListeners.push(listener);
  }

  /** Runs when the game the overlay was in closes: its windows are gone with it. */
  onGameExit(listener: () => void): void {
    this.exitListeners.push(listener);
  }

  /** After an elevated game refused the overlay: is the helper what's missing? */
  private async checkHelper(game: GameInfo): Promise<void> {
    const installed = await this.api?.isHighElevationHelperInstalled?.().catch(() => undefined);
    if (installed !== false) return;
    this.log(`Overlay: ${game.name} runs as administrator; the overlay needs its helper for that ` +
      '(Settings → Popups, which asks Windows for permission).');
    this.blocked = game;
    this.placeChanged();
  }

  private placeChanged(): void {
    for (const listener of this.placeListeners) listener(this.cardsPlace);
  }

  private wanted(game: GameInfo): boolean {
    return this.anyGame || APEX_OVERLAY_IDS.includes(game.id) || APEX_OVERLAY_IDS.includes(game.classId);
  }
}

function sameGame(a: GameInfo, b: GameInfo): boolean {
  return a.id === b.id && a.classId === b.classId;
}
