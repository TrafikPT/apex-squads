/**
 * The card hotkeys (Settings → Hotkeys): hide the card now, and cards off/on for
 * the session. Through Overwolf's overlay while it's in the game, passing the
 * key on to the game too; otherwise Electron's global shortcuts, which keep the
 * key from the game, hence defaults Apex doesn't use (F9, F10). One developer
 * saw overlay hotkeys never fire (docs/overwolf/api-reference.md): if that
 * happens here, the log says which kind was registered.
 */
import type { GlobalShortcut } from 'electron';
import type { GameOverlay } from './game-overlay';
import type { Hotkey, Settings } from './ui/app-settings';
import { hotkeyLabel } from './ui/app-settings';

export interface HotkeyActions {
  hideCard(): void;
  toggleCards(): void;
}

type Name = keyof Settings['hotkeys'];

export class Hotkeys {
  /** What's registered now, to take it off before registering again. */
  private overlayNames: string[] = [];
  private registeredWith: GameOverlay['injectedApi'] = null;
  private accelerators: string[] = [];

  constructor(
    private readonly overlay: GameOverlay,
    /** Electron's globalShortcut, passed in so tests can load this without Electron's binary. */
    private readonly globalShortcut: Pick<GlobalShortcut, 'register' | 'unregister'>,
    private readonly actions: HotkeyActions,
    private readonly log: (...args: unknown[]) => void,
  ) {}

  /** (Re-)registers the keys: at start, when settings change, and when the overlay enters or leaves a game. */
  apply(settings: Settings): void {
    this.clear();
    const bindings: [Name, () => void][] = [['hide', () => this.actions.hideCard()], ['toggle', () => this.actions.toggleCards()]];
    const api = this.overlay.injectedApi;
    this.registeredWith = api;
    for (const [name, action] of bindings) {
      const h = settings.hotkeys[name];
      try {
        if (api) {
          const id = `cards-${name}`;
          api.hotkeys.register(
            { name: id, keyCode: h.code, modifiers: { ctrl: h.ctrl, alt: h.alt, shift: h.shift }, passthrough: true },
            (_hotkey, state) => {
              if (state === 'pressed') action();
            },
          );
          this.overlayNames.push(id);
        } else {
          const accelerator = acceleratorFor(h);
          if (this.globalShortcut.register(accelerator, action)) this.accelerators.push(accelerator);
          else this.log(`Hotkey ${hotkeyLabel(h)} is taken by another app; pick another in Settings.`);
        }
      } catch (err) {
        this.log(`Hotkey ${hotkeyLabel(h)} couldn't be registered: ${String(err)}`);
      }
    }
    this.log(`Hotkeys (${api ? 'in game' : 'global'}): ${hotkeyLabel(settings.hotkeys.hide)} hides the card, ` +
      `${hotkeyLabel(settings.hotkeys.toggle)} turns cards off/on.`);
  }

  clear(): void {
    // After the game exits these are gone with it; unregistering then is harmless.
    for (const id of this.overlayNames) {
      try {
        this.registeredWith?.hotkeys.unregister(id);
      } catch {
        // The overlay may already have dropped them.
      }
    }
    this.overlayNames = [];
    this.registeredWith = null;
    for (const accelerator of this.accelerators) this.globalShortcut.unregister(accelerator);
    this.accelerators = [];
  }
}

const ACCELERATOR_KEYS: Record<string, string> = {
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown',
};

/** Electron's accelerator for a hotkey: "Ctrl+Shift+H", "F9", "num5". */
export function acceleratorFor(h: Hotkey): string {
  const keyName = ACCELERATOR_KEYS[h.code]
    ?? h.code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad(\d)$/, 'num$1');
  return [h.ctrl && 'Ctrl', h.alt && 'Alt', h.shift && 'Shift', keyName].filter(Boolean).join('+');
}
