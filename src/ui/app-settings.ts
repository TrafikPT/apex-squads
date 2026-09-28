/**
 * The user's settings, shared by the dashboard (which edits them) and the
 * popup window (which reads them before each popup). Stored as JSON by
 * src/settings-store.ts; anything missing or invalid falls back to the default.
 */

export const POPUP_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;
export type PopupPosition = (typeof POPUP_POSITIONS)[number];
export const POPUP_SECONDS = [4, 7, 10, 15] as const;

/**
 * A key and its modifiers. `code` is the W3C KeyboardEvent.code ("KeyH", "F9"),
 * which Overwolf's overlay hotkeys take directly and is the same on every
 * keyboard layout.
 */
export interface Hotkey {
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export interface Settings {
  popups: {
    /** "Killed by" and "You killed" cards. */
    encounters: boolean;
    /** The lobby card at match start. */
    lobby: boolean;
    position: PopupPosition;
    /** How long a popup stays up. */
    seconds: number;
  };
  hotkeys: {
    /** Hides the card showing now. */
    hide: Hotkey;
    /** Turns the cards off, or back on, until the app restarts. */
    toggle: Hotkey;
  };
  /** The first-run welcome was dismissed; Help can show it again. */
  welcomeSeen: boolean;
}

/** F-keys: Apex binds none of them by default, unlike Ctrl (crouch) and most letters. */
const key = (code: string): Hotkey => ({ code, ctrl: false, alt: false, shift: false });

export const DEFAULT_SETTINGS: Settings = {
  popups: { encounters: true, lobby: true, position: 'top-right', seconds: 7 },
  hotkeys: { hide: key('F9'), toggle: key('F10') },
  welcomeSeen: false,
};

/**
 * Keys a hotkey can use: the ones both Overwolf's overlay and Electron's global
 * shortcuts understand. Modifier keys alone, Escape, Tab and Enter can't be hotkeys.
 */
const HOTKEY_CODE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad[0-9]|Backquote|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|Insert|Delete|Home|End|PageUp|PageDown)$/;

export function isHotkeyCode(code: string): boolean {
  return HOTKEY_CODE.test(code);
}

/** "Ctrl+Shift+H", "F9". */
export function hotkeyLabel(h: Hotkey): string {
  const keyName = h.code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ');
  return [h.ctrl && 'Ctrl', h.alt && 'Alt', h.shift && 'Shift', keyName].filter(Boolean).join('+');
}

export function sameHotkey(a: Hotkey, b: Hotkey): boolean {
  return a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift;
}

/** A stored settings object made safe: unknown keys dropped, bad values replaced by the defaults. */
export function withDefaults(raw: unknown): Settings {
  const r = raw as { popups?: Record<string, unknown>; hotkeys?: Record<string, unknown>; welcomeSeen?: unknown } | null;
  const p = r?.popups ?? {};
  const d = DEFAULT_SETTINGS.popups;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const hotkey = (v: unknown, fallback: Hotkey): Hotkey => {
    const h = v as Partial<Record<keyof Hotkey, unknown>> | null;
    if (!h || typeof h.code !== 'string' || !isHotkeyCode(h.code)) return fallback;
    return { code: h.code, ctrl: h.ctrl === true, alt: h.alt === true, shift: h.shift === true };
  };
  const hide = hotkey(r?.hotkeys?.hide, DEFAULT_SETTINGS.hotkeys.hide);
  const toggle = hotkey(r?.hotkeys?.toggle, DEFAULT_SETTINGS.hotkeys.toggle);
  return {
    popups: {
      encounters: bool(p.encounters, d.encounters),
      lobby: bool(p.lobby, d.lobby),
      position: POPUP_POSITIONS.includes(p.position as PopupPosition) ? (p.position as PopupPosition) : d.position,
      seconds: (POPUP_SECONDS as readonly number[]).includes(p.seconds as number) ? (p.seconds as number) : d.seconds,
    },
    // Two actions can't share a key: the second falls back to its default.
    hotkeys: sameHotkey(hide, toggle) ? { hide, toggle: sameHotkey(hide, DEFAULT_SETTINGS.hotkeys.toggle) ? DEFAULT_SETTINGS.hotkeys.hide : DEFAULT_SETTINGS.hotkeys.toggle }
      : { hide, toggle },
    welcomeSeen: bool(r?.welcomeSeen, DEFAULT_SETTINGS.welcomeSeen),
  };
}
