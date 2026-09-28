/**
 * The title bar's status: whether Apex is being recorded, whether Overwolf's
 * game data for Apex is working, and whether the cards can show in the game.
 * Overwolf asks apps to tell users when game events are down
 * (docs/overwolf/product-guidelines.md §4.4). The main process tracks the facts
 * (src/game-status.ts); this turns them into the words.
 */

/** Overwolf's health of Apex's game events, from its public status file. */
export interface EventsHealth {
  /** 0 unsupported, 1 working, 2 partly working, 3 down. */
  state: number;
  /** Switched off on purpose (e.g. for an anti-cheat update). */
  disabled: boolean;
  /** Overwolf's own words about it, when it gives any. */
  message: string | null;
  /** Features that aren't fully working, by Overwolf's names ("kill_feed"). */
  degraded: string[];
}

export interface GameStatus {
  /** Null until the status file has been read, or when it can't be. */
  events: EventsHealth | null;
  /**
   * Apex as the recorder sees it: not running; running, game data starting;
   * recording; game data didn't start; running as administrator, which the
   * recorder then has to do too.
   */
  game: 'none' | 'starting' | 'recording' | 'no-data' | 'needs-admin';
  /** Where the cards go (src/game-overlay.ts). */
  cards: 'in-game' | 'window' | 'needs-helper';
}

export const INITIAL_STATUS: GameStatus = { events: null, game: 'none', cards: 'window' };

export interface StatusLine {
  tone: 'idle' | 'ok' | 'warn' | 'bad';
  text: string;
  /** The longer story, for the tooltip. */
  detail: string;
  /** Settings has the fix. */
  toSettings?: boolean;
}

/** The one thing the title bar says: the most serious first. */
export function statusLine(s: GameStatus): StatusLine {
  const e = s.events;
  if (e && (e.disabled || e.state === 3 || e.state === 0)) {
    return {
      tone: 'bad',
      text: 'Apex game data is off',
      detail: `Overwolf has switched off its game data for Apex${e.message ? ` ("${e.message}")` : ''}. ` +
        'Matches played now can\'t be recorded, and cards won\'t show. It comes back on by itself when Overwolf turns it on.',
    };
  }
  if (s.game === 'needs-admin') {
    return {
      tone: 'bad',
      text: 'Not recording: Apex runs as administrator',
      detail: 'Windows only lets Apex Squads read the game when both run as administrator. ' +
        'Start Apex normally, or run Apex Squads as administrator too.',
    };
  }
  if (s.game === 'no-data') {
    return {
      tone: 'bad',
      text: "Not recording: game data didn't start",
      detail: "Overwolf's game data for Apex didn't start this time. Restarting Apex Squads, then Apex, usually fixes it.",
    };
  }
  if (s.cards === 'needs-helper') {
    return {
      tone: 'warn',
      text: "Cards can't show in the game",
      detail: 'Apex runs as administrator, so the in-game cards need a one-time permission. Allow it in Settings → Popups.',
      toSettings: true,
    };
  }
  if (e && e.state === 2) {
    const which = e.degraded.map((name) => name.replace(/_/g, ' '));
    return {
      tone: 'warn',
      text: 'Some Apex game data is down',
      detail: `Overwolf reports problems with ${which.length ? which.join(', ') : 'some of its game data'} for Apex` +
        `${e.message ? ` ("${e.message}")` : ''}. Matches still record, but some numbers may be missing.`,
    };
  }
  if (s.game === 'recording') {
    return {
      tone: 'ok',
      text: 'Recording Apex Legends',
      detail: s.cards === 'in-game' ? 'Matches are being recorded. Cards show inside the game.' : 'Matches are being recorded.',
    };
  }
  if (s.game === 'starting') {
    return { tone: 'ok', text: 'Apex Legends found', detail: "Starting Overwolf's game data for Apex." };
  }
  return {
    tone: 'idle',
    text: 'Waiting for Apex Legends',
    detail: 'Start Apex and your matches are recorded.' + (e ? '' : " (Couldn't check Overwolf's game data status.)"),
  };
}

/**
 * Reads Overwolf's status file for one game
 * (https://game-events-status.overwolf.com/21566_prod.json; format in
 * docs/overwolf/gep-and-compliance.md §5). Null if it doesn't look like one.
 */
export function parseEventsHealth(raw: unknown): EventsHealth | null {
  const r = raw as { state?: unknown; disabled?: unknown; disabled_electron?: unknown; maintenance_msg?: unknown; features?: unknown } | null;
  if (!r || typeof r.state !== 'number') return null;
  const features = Array.isArray(r.features) ? (r.features as { name?: unknown; state?: unknown }[]) : [];
  return {
    state: r.state,
    // disabled_electron: seen in the live file, not in the docs; we're an ow-electron app.
    disabled: r.disabled === true || r.disabled_electron === true,
    message: typeof r.maintenance_msg === 'string' && r.maintenance_msg.trim() ? r.maintenance_msg.trim() : null,
    degraded: features.filter((f) => typeof f.name === 'string' && f.state !== 1).map((f) => f.name as string),
  };
}
