/**
 * The user's settings, shared by the dashboard (which edits them) and the
 * popup window (which reads them before each popup). Stored as JSON by
 * src/settings-store.ts; anything missing or invalid falls back to the default.
 */

export const POPUP_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;
export type PopupPosition = (typeof POPUP_POSITIONS)[number];
export const POPUP_SECONDS = [4, 7, 10, 15] as const;

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
  /** The first-run welcome was dismissed; Help can show it again. */
  welcomeSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  popups: { encounters: true, lobby: true, position: 'top-right', seconds: 7 },
  welcomeSeen: false,
};

/** A stored settings object made safe: unknown keys dropped, bad values replaced by the defaults. */
export function withDefaults(raw: unknown): Settings {
  const r = raw as { popups?: Record<string, unknown>; welcomeSeen?: unknown } | null;
  const p = r?.popups ?? {};
  const d = DEFAULT_SETTINGS.popups;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    popups: {
      encounters: bool(p.encounters, d.encounters),
      lobby: bool(p.lobby, d.lobby),
      position: POPUP_POSITIONS.includes(p.position as PopupPosition) ? (p.position as PopupPosition) : d.position,
      seconds: (POPUP_SECONDS as readonly number[]).includes(p.seconds as number) ? (p.seconds as number) : d.seconds,
    },
    welcomeSeen: bool(r?.welcomeSeen, DEFAULT_SETTINGS.welcomeSeen),
  };
}
