/**
 * Parser for the Overwolf client's own GEP log
 * (%LOCALAPPDATA%\Overwolf\Log\Apps\Overwolf General GameEvents Provider\index.html*.log).
 * The provider logs every event and info update it hands to apps, so replaying
 * those through the Recorder gives recordings that look like ours, minus what
 * only our app adds (info snapshots, RP snapshots, its own lifecycle lines).
 */
import { APEX_GAME_ID, Recorder, type Clock, type GepMessage, type Sink } from './recorder';

export type GepLogEntry =
  | { at: Date; type: 'session_start' }
  | { at: Date; type: 'info'; msg: GepMessage }
  | { at: Date; type: 'event'; msg: GepMessage }
  | { at: Date; type: 'game_launched'; gameId: number }
  | { at: Date; type: 'game_ended'; gameId: number }
  | { at: Date; type: 'unparsed'; text: string };

// 2026-09-24 14:28:22,291 (INFO) </index/index.js> (:2) - [GEP] info update {...}
const LINE = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d),(\d{3}) \((\w+)\) (.*)$/;
const SOURCE_PREFIX = /^<[^>]*> \(:\d+\) - /;

/** Returns null for lines that aren't GEP data or session boundaries (plugin chatter, HUD parser...). */
export function parseGepLogLine(raw: string): GepLogEntry | null {
  const m = LINE.exec(stripBom(raw).trimEnd());
  if (!m) return null;
  // The log is in local time with no offset; this assumes the importing PC's time zone.
  const at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]);
  const text = m[9].replace(SOURCE_PREFIX, '');

  if (text.startsWith('================== new session')) return { at, type: 'session_start' };

  const launched = /^game launched detected, (\d+)/.exec(text);
  if (launched) return { at, type: 'game_launched', gameId: +launched[1] };
  const ended = /^\[GEP\] Supported game ended (\d+)/.exec(text);
  if (ended) return { at, type: 'game_ended', gameId: +ended[1] };

  const info = /^\[GEP\] info update (\{.*\})$/.exec(text);
  if (info) {
    const d = tryParse(info[1]) as {
      featureName?: string;
      categoryName?: string;
      key?: string;
      value?: unknown;
    } | null;
    if (!d || typeof d.featureName !== 'string' || typeof d.key !== 'string') {
      return { at, type: 'unparsed', text };
    }
    return {
      at,
      type: 'info',
      msg: { feature: d.featureName, category: d.categoryName, key: d.key, value: d.value ?? null },
    };
  }

  const event = /^\[GEP\] New Event\s+(\{.*\})$/.exec(text);
  if (event) {
    // Same shape as ow-electron's gep.GameEvent: {gameId, feature, key, value}.
    const d = tryParse(event[1]) as {
      gameId?: number;
      feature?: string;
      key?: string;
      value?: unknown;
    } | null;
    if (!d || typeof d.feature !== 'string' || typeof d.key !== 'string') {
      return { at, type: 'unparsed', text };
    }
    if (d.gameId !== undefined && d.gameId !== APEX_GAME_ID) return null;
    return { at, type: 'event', msg: { feature: d.feature, key: d.key, value: d.value ?? null } };
  }

  return null;
}

/** Groups entries by provider session; sessions without any game data are dropped. */
export function splitSessions(entries: Iterable<GepLogEntry>): GepLogEntry[][] {
  const sessions: GepLogEntry[][] = [];
  let current: GepLogEntry[] = [];
  for (const e of entries) {
    if (e.type === 'session_start' && current.length > 0) {
      sessions.push(current);
      current = [];
    }
    current.push(e);
  }
  sessions.push(current);
  return sessions.filter((s) => s.some((e) => e.type === 'info' || e.type === 'event'));
}

/** Clock that reports the log time of the entry being replayed. Timers never fire. */
class ReplayClock implements Clock {
  at = new Date(0);
  now(): Date {
    return this.at;
  }
  setTimeout(): unknown {
    return null;
  }
  clearTimeout(): void {}
}

/**
 * Feeds one provider session through a Recorder, the way main.ts would have
 * received it live. No RP client: API lookups now wouldn't reflect back then.
 */
export function replaySession(
  session: GepLogEntry[],
  sessionId: string,
  sink: Sink,
  source: Record<string, unknown>,
): { unparsed: number } {
  const clock = new ReplayClock();
  const recorder = new Recorder(sessionId, sink, null, clock);
  let unparsed = 0;

  clock.at = session[0].at;
  recorder.lifecycle('session_start', { imported_from: 'overwolf_gep_log', ...source });
  for (const e of session) {
    clock.at = e.at;
    switch (e.type) {
      case 'info':
        recorder.onInfoUpdate(e.msg);
        break;
      case 'event':
        recorder.onGameEvent(e.msg);
        break;
      case 'game_launched':
        if (e.gameId === APEX_GAME_ID) recorder.lifecycle('game_detected', { game_id: e.gameId });
        break;
      case 'game_ended':
        if (e.gameId === APEX_GAME_ID) recorder.lifecycle('game_exit', { game_id: e.gameId });
        break;
      case 'unparsed':
        unparsed++;
        recorder.lifecycle('import_unparsed_line', { text: e.text });
        break;
    }
  }
  recorder.lifecycle('session_end');
  return { unparsed };
}

/** Each log file starts with a UTF-8 byte order mark. */
function stripBom(line: string): string {
  return line.charCodeAt(0) === 0xfeff ? line.slice(1) : line;
}

function tryParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
