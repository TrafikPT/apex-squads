/**
 * Core recorder logic, independent of Electron/Overwolf so it can be tested
 * anywhere. It lands every GEP message untouched as one JSONL line and adds
 * only two things: the current match id, and RP snapshots taken in the lobby.
 */

export const APEX_GAME_ID = 21566;

/** Bump when the shape of RecordLine changes (see DESIGN.md §4.1). */
export const SCHEMA_VERSION = 1;

export type RecordKind =
  | 'event' // GEP new-game-event
  | 'info' // GEP new-info-update
  | 'info_snapshot' // result of gep.getInfo()
  | 'rp_snapshot' // apexlegendsstatus API response
  | 'lifecycle'; // app/game/GEP status (startup, game detected, errors...)

export interface RecordLine {
  schema: number;
  session_id: string;
  seq: number;
  received_at: string;
  kind: RecordKind;
  /** pseudo_match_id in effect when the line was written; null outside a match. */
  match_id: string | null;
  feature: string | null;
  category: string | null;
  key: string | null;
  /** Payload exactly as received (GEP values are often JSON-encoded strings). */
  value: unknown;
}

export interface Sink {
  write(line: RecordLine): void;
}

export interface RankFetcher {
  /** Returns the raw API response; throws on network/HTTP failure. */
  fetchPlayer(playerName: string): Promise<{ status: number; body: unknown }>;
}

export interface GepMessage {
  feature: string;
  category?: string;
  key: string;
  value: unknown;
}

export type RpTrigger = 'lobby' | 'post_match' | 'match_start' | 'account_change';

/** GEP `game_info.phase` values between legend select and the end of a match. */
export const IN_MATCH_PHASES: ReadonlySet<string> = new Set([
  'legend_selection',
  'aircraft',
  'freefly',
  'landed',
]);

/** After a match, snapshot at these offsets so RP has time to update in the API. */
export const POST_MATCH_DELAYS_S = [0, 30, 90, 180, 300];

export interface Clock {
  now(): Date;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => new Date(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export class Recorder {
  private seq = 0;
  private matchId: string | null = null;
  private phase: string | null = null;
  /** A match ended and no new one started yet: post-match snapshots cover the lobby. */
  private afterMatch = false;
  private playerName: string | null = null;
  private pendingRp: unknown[] = [];

  constructor(
    private readonly sessionId: string,
    private readonly sink: Sink,
    private readonly rank: RankFetcher | null,
    private readonly clock: Clock = systemClock,
  ) {}

  onInfoUpdate(msg: GepMessage): void {
    // Update state before writing so the line that starts a match is tagged with it.
    if (msg.category === 'match_info' && msg.key === 'pseudo_match_id') {
      this.matchId = asString(msg.value) || null;
    }
    this.write('info', msg);

    if (msg.category === 'game_info' && msg.key === 'phase') {
      this.onPhase(asString(msg.value));
    } else if (msg.category === 'me' && msg.key === 'name') {
      this.onPlayerName(asString(msg.value));
    }
  }

  onGameEvent(msg: GepMessage): void {
    this.write('event', msg);
  }

  onInfoSnapshot(info: unknown): void {
    this.write('info_snapshot', { feature: null, key: null, value: info });
  }

  lifecycle(key: string, value: unknown = null): void {
    this.write('lifecycle', { feature: null, key, value });
  }

  /** Cancel pending RP snapshots (call on shutdown). */
  dispose(): void {
    this.cancelPendingRp();
  }

  private onPhase(phase: string): void {
    const previous = this.phase;
    this.phase = phase;
    if (phase === previous) return;

    // Real sessions rarely pass through 'lobby' between matches
    // (match_summary -> loading_screen -> legend_selection), so matches are
    // delimited by the in-match phases instead.
    const wasInMatch = previous !== null && IN_MATCH_PHASES.has(previous);
    const isInMatch = IN_MATCH_PHASES.has(phase);

    if (isInMatch && !wasInMatch) {
      // Queued into a match: last chance for a "before" value. RP only moves
      // when a match ends, so this also holds when the app starts mid-match.
      this.afterMatch = false;
      this.cancelPendingRp();
      void this.snapshotRp('match_start');
    } else if (wasInMatch && !isInMatch) {
      // Match over (summary, or quit straight to the lobby / loading screen).
      this.afterMatch = true;
      this.cancelPendingRp();
      for (const delay of POST_MATCH_DELAYS_S) {
        this.pendingRp.push(
          this.clock.setTimeout(() => void this.snapshotRp('post_match'), delay * 1000),
        );
      }
    }

    if (phase === 'lobby') {
      this.matchId = null;
      if (!this.afterMatch) void this.snapshotRp('lobby');
    }
  }

  private onPlayerName(name: string): void {
    if (!name || name === this.playerName) return;
    const isSwitch = this.playerName !== null;
    this.playerName = name;
    if (this.phase === 'lobby') {
      void this.snapshotRp(isSwitch ? 'account_change' : 'lobby');
    }
  }

  private cancelPendingRp(): void {
    for (const handle of this.pendingRp) this.clock.clearTimeout(handle);
    this.pendingRp = [];
  }

  private async snapshotRp(trigger: RpTrigger): Promise<void> {
    const playerName = this.playerName;
    if (!this.rank || !playerName) return;
    const base = { trigger, player_name: playerName };
    try {
      const { status, body } = await this.rank.fetchPlayer(playerName);
      this.write('rp_snapshot', { feature: null, key: trigger, value: { ...base, status, body } });
    } catch (err) {
      this.write('rp_snapshot', {
        feature: null,
        key: trigger,
        value: { ...base, error: String(err) },
      });
    }
  }

  private write(
    kind: RecordKind,
    msg: { feature: string | null; category?: string; key: string | null; value: unknown },
  ): void {
    this.sink.write({
      schema: SCHEMA_VERSION,
      session_id: this.sessionId,
      seq: this.seq++,
      received_at: this.clock.now().toISOString(),
      kind,
      match_id: this.matchId,
      feature: msg.feature,
      category: msg.category ?? null,
      key: msg.key,
      value: msg.value,
    });
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}
