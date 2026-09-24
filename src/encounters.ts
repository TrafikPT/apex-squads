/**
 * Watches the kill feed as lines are recorded and decides when a popup fires
 * (DESIGN.md §12): when I'm killed (the killer, plus whoever knocked me if
 * that was someone else) and when I kill someone. Knocks only prefetch ranks,
 * so the popup is ready when the kill follows.
 */
import { baseName, isAnonymousName } from './game-names';
import { rankValue, type PlayerHistory } from './player-history';
import type { RecordLine } from './recorder';
import type { Moment, PlayerCard } from './ui/popup-card';

/** Kills needed before "kill leader" means anything. */
const KILL_LEADER_MIN = 3;

export interface Seen {
  name: string;
  uid: string | null;
  kills: number;
  knocks: number;
  killLeader: boolean;
}

export interface Trigger {
  moment: Moment;
  matchId: string;
  at: string;
  player: Seen;
  knockedBy?: Seen;
}

export interface TrackerOutput {
  triggers: Trigger[];
  /** Players worth looking up now: they knocked me, or I knocked them. */
  prefetch: { uid: string; name: string }[];
}

export class EncounterTracker {
  private matchId: string | null = null;
  private stats = new Map<string, { kills: number; knocks: number }>();
  /** Who knocked me, until I'm revived, respawned or killed. */
  private knockedMeBy: string | null = null;

  constructor(private readonly history: PlayerHistory) {}

  onLine(l: RecordLine): TrackerOutput {
    const out: TrackerOutput = { triggers: [], prefetch: [] };
    if (!l.match_id) return out;
    if (l.match_id !== this.matchId) {
      this.matchId = l.match_id;
      this.stats = new Map();
      this.knockedMeBy = null;
    }
    if (l.kind === 'event' && (l.key === 'healed_from_ko' || l.key === 'respawn')) this.knockedMeBy = null;
    if (l.key !== 'kill_feed') return out;

    const p = decode(l.value) as { local_player_name?: string; attackerName?: string; victimName?: string; action?: string; action2?: string } | null;
    if (!p?.local_player_name) return out;
    const me = baseName(p.local_player_name);
    const attacker = baseName(p.attackerName ?? '');
    const victim = baseName(p.victimName ?? '');
    const knock = p.action === 'knockdown' || p.action2 === 'knockdown';
    if (attacker) {
      const s = this.stats.get(attacker) ?? { kills: 0, knocks: 0 };
      if (knock) s.knocks++;
      else s.kills++;
      this.stats.set(attacker, s);
    }
    if (!attacker || !victim || attacker === victim) return out;

    const fetch = (name: string) => {
      const uid = this.history.uidOf(l.match_id!, name);
      if (uid) out.prefetch.push({ uid, name });
    };
    if (victim === me && knock) {
      this.knockedMeBy = attacker;
      fetch(attacker);
    } else if (victim === me) {
      const knocker = this.knockedMeBy && this.knockedMeBy !== attacker ? this.knockedMeBy : null;
      this.knockedMeBy = null;
      fetch(attacker);
      out.triggers.push({
        moment: 'killed_by',
        matchId: l.match_id,
        at: l.received_at,
        player: this.seen(attacker),
        ...(knocker ? { knockedBy: this.seen(knocker) } : {}),
      });
    } else if (attacker === me && knock) {
      fetch(victim);
    } else if (attacker === me) {
      fetch(victim);
      out.triggers.push({ moment: 'you_killed', matchId: l.match_id, at: l.received_at, player: this.seen(victim) });
    }
    return out;
  }

  private seen(name: string): Seen {
    const s = this.stats.get(name) ?? { kills: 0, knocks: 0 };
    const top = Math.max(0, ...[...this.stats.values()].map((x) => x.kills));
    return {
      name,
      uid: this.history.uidOf(this.matchId!, name),
      kills: s.kills,
      knocks: s.knocks,
      killLeader: s.kills >= KILL_LEADER_MIN && s.kills === top,
    };
  }
}

/** The card for one player, from the moment's numbers plus everything history knows. */
export function cardFor(seen: Seen, matchId: string, history: PlayerHistory): PlayerCard {
  const rec = seen.uid ? history.get(seen.uid) : undefined;
  const before = rec?.encounters.filter((e) => e.matchId !== matchId) ?? [];
  const latest = rec?.latest ?? null;
  const peak = rec?.peak && latest && rankValue(rec.peak) > rankValue(latest) ? rec.peak : null;
  return {
    name: seen.name,
    anonymous: !seen.uid && isAnonymousName(seen.name),
    kills: seen.kills,
    knocks: seen.knocks,
    killLeader: seen.killLeader,
    rank: latest ? { tier: latest.tier, div: latest.div, score: latest.score } : null,
    peak: peak ? { tier: peak.tier, div: peak.div, season: peak.season } : null,
    level: rec?.level ?? null,
    topPercent: rec?.topPercent ?? null,
    metBefore: rec ? [...rec.lobbies].filter((m) => m !== matchId).length : 0,
    theyKilledMe: before.filter((e) => e.kind === 'killed_me').length,
    iKilledThem: before.filter((e) => e.kind === 'i_killed').length,
  };
}

function decode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
