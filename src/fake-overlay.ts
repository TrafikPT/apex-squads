/**
 * A stand-in for Overwolf's overlay package, for running our overlay code where
 * the real one can't run (macOS, tests, Apex's overlay switched off). It plays
 * the overlay's side of a game session: launch, inject (or fail to), report the
 * game window, exit. Windows come from the factory passed in, so tests need no
 * Electron. What it can't tell us is how Overwolf itself behaves: that's the
 * Windows checklist in docs/next-steps.md item 3.
 */
import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import type { GameInfo, IOverlayHotkey, IOverwolfOverlayApi, OverlayWindowOptions } from '@overwolf/ow-electron-packages-types';

type HotkeyCallback = (hotkey: IOverlayHotkey, state: 'pressed' | 'released') => void;

export interface FakeGame {
  id: number;
  classId: number;
  name: string;
  supported?: boolean;
  elevated?: boolean;
  /** The game window's size, reported after injection. */
  width?: number;
  height?: number;
}

export class FakeOverlayApi extends EventEmitter {
  readonly version = 'fake';
  registered: unknown = null;
  readonly created: { options: OverlayWindowOptions; window: BrowserWindow }[] = [];
  readonly hotkeys = new FakeHotkeys();
  /** Whether the helper for elevated games is there; installing it sets this. */
  helperInstalled = false;
  /** What the UAC prompt comes to: installed, declined (exit code 1223), or failed. */
  helperOutcome: 'installed' | 'declined' | 'failed' = 'installed';
  /** Games that `inject()` was called for. */
  readonly injectCalls: string[] = [];
  private running: FakeGame | null = null;
  private injected: FakeGame | null = null;

  constructor(private readonly makeWindow: (options: OverlayWindowOptions) => BrowserWindow) {
    super();
  }

  /** The typed view our code takes. */
  get api(): IOverwolfOverlayApi {
    return this as unknown as IOverwolfOverlayApi;
  }

  registerGames(filter: unknown): Promise<void> {
    this.registered = filter;
    return Promise.resolve();
  }

  createWindow(options: OverlayWindowOptions): Promise<{ window: BrowserWindow }> {
    if (!this.injected) return Promise.reject(new Error('not injected'));
    const window = this.makeWindow(options);
    this.created.push({ options, window });
    return Promise.resolve({ window });
  }

  getActiveGameInfo(): unknown {
    const g = this.injected;
    if (!g) return undefined;
    return { gameInfo: info(g), gameWindowInfo: { size: { width: g.width ?? 1920, height: g.height ?? 1080 }, focused: true } };
  }

  isHighElevationHelperInstalled(): Promise<boolean> {
    return Promise.resolve(this.helperInstalled);
  }

  installHighElevationHelper(): Promise<void> {
    if (this.helperOutcome === 'installed') {
      this.helperInstalled = true;
      return Promise.resolve();
    }
    return Promise.reject(Object.assign(new Error('HelperInstallError'), { exitCode: this.helperOutcome === 'declined' ? 1223 : 2 }));
  }

  requestGameInjection(classId: number): Promise<void> {
    if (!this.running || this.running.classId !== classId) return Promise.reject(new Error('game not running'));
    this.announce(this.running);
    return Promise.resolve();
  }

  /** The game starts: `game-launched`, then whatever our handler's `inject()` leads to. */
  launch(game: FakeGame): void {
    this.running = game;
    this.announce(game);
  }

  /** The game closes: its overlay windows go with it. */
  exit(): void {
    const game = this.running;
    if (!game) return;
    const wasInjected = this.injected === game;
    this.running = null;
    this.injected = null;
    for (const { window } of this.created) if (!window.isDestroyed()) window.destroy();
    this.emit('game-exit', info(game), wasInjected);
  }

  private announce(game: FakeGame): void {
    const event = {
      inject: () => {
        this.injectCalls.push(game.name);
        if (game.elevated && !this.helperInstalled) {
          this.emit('game-injection-error', info(game), 'elevated process');
          return;
        }
        this.injected = game;
        this.emit('game-injected', info(game));
        const size = { width: game.width ?? 1920, height: game.height ?? 1080 };
        this.emit('game-window-changed', { size, focused: true, bounds: { x: 0, y: 0, ...size } }, info(game), undefined);
      },
      dismiss: () => undefined,
    };
    this.emit('game-launched', event, info(game));
  }
}

export class FakeHotkeys {
  private readonly keys = new Map<string, { hotkey: IOverlayHotkey; callback: HotkeyCallback }>();

  register(hotkey: IOverlayHotkey, callback: HotkeyCallback): void {
    this.keys.set(hotkey.name, { hotkey, callback });
  }

  unregister(name: string): boolean {
    return this.keys.delete(name);
  }

  all(): IOverlayHotkey[] {
    return [...this.keys.values()].map((k) => k.hotkey);
  }

  /** The player presses a registered key. */
  press(name: string): void {
    const key = this.keys.get(name);
    if (!key) throw new Error(`No hotkey ${name}`);
    key.callback(key.hotkey, 'pressed');
    key.callback(key.hotkey, 'released');
  }
}

function info(g: FakeGame): GameInfo {
  return {
    id: g.id, classId: g.classId, name: g.name, supported: g.supported ?? true, type: 'Game',
    processInfo: { isElevated: g.elevated ?? false },
  } as GameInfo;
}
