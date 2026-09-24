/**
 * What we know about other players, from every recording: lobbies shared
 * with me, fights with me, and every rank an API lookup returned. The peak
 * rank is the highest one *we* have seen for them, so it grows over the years.
 */
import { baseName } from './game-names';
import type { RecordLine } from './recorder';

export interface RankSeen {
  /** As the API names it: "Gold", "Apex Predator"... */
  tier: string;
  /** 4 (lowest) to 1; 0 for Master and Predator. */
  div: number;
  score: number;
  season: string | null;
  at: string;
}

export type EncounterKind = 'killed_me' | 'knocked_me' | 'i_killed' | 'i_knocked';

export interface PlayerRecord {
  uid: string;
  name: string;
  lobbies: Set<string>;
  encounters: { matchId: string; kind: EncounterKind }[];
  latest: RankSeen | null;
  peak: RankSeen | null;
  level: number | null;
  /** "Top X%" of players apexlegendsstatus tracks; null when unknown. */
  topPercent: number | null;
}

/** Value of a `player_lookup` line (src/popup-service.ts writes it). */
export interface LookupValue {
  name: string;
  status?: number;
  /** `global` from the API response: name, uid, level, rank... */
  global?: unknown;
  error?: string;
}

const TIERS = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Apex Predator'];

/** Orders ranks: tier first, then division (IV lowest). Unknown tiers sort lowest. */
export function rankValue(r: { tier: string; div: number }): number {
  return TIERS.indexOf(r.tier) * 10 + (r.div ? 5 - r.div : 5);
}

export class PlayerHistory {
  private players = new Map<string, PlayerRecord>();
  /** Per match: base name -> EA ID, from the roster (the kill feed only has names). */
  private rosters = new Map<string, Map<string, string>>();

  /** Feed recorder lines in order (per session); anything irrelevant is ignored. */
  add(l: RecordLine): void {
    if (l.kind === 'player_lookup') {
      this.addLookup(l);
      return;
    }
    if (!l.match_id || !l.key) return;
    if (l.key.startsWith('roster_')) {
      const p = decode(l.value) as { name?: string; is_local?: unknown; origin_id?: string; platform_id?: string } | null;
      if (!p?.name || p.is_local === '1' || p.is_local === true) return;
      const uid = p.origin_id || p.platform_id;
      if (!uid) return;
      let roster = this.rosters.get(l.match_id);
      if (!roster) this.rosters.set(l.match_id, (roster = new Map()));
      roster.set(baseName(p.name), uid);
      const rec = this.ensure(uid);
      rec.name = baseName(p.name);
      rec.lobbies.add(l.match_id);
    } else if (l.key === 'kill_feed') {
      const p = decode(l.value) as { local_player_name?: string; attackerName?: string; victimName?: string; action?: string; action2?: string } | null;
      if (!p?.local_player_name) return;
      const me = baseName(p.local_player_name);
      const attacker = baseName(p.attackerName ?? '');
      const victim = baseName(p.victimName ?? '');
      const knock = p.action === 'knockdown' || p.action2 === 'knockdown';
      if (attacker === me && victim && victim !== me) this.encounter(l.match_id, victim, knock ? 'i_knocked' : 'i_killed');
      if (victim === me && attacker && attacker !== me) this.encounter(l.match_id, attacker, knock ? 'knocked_me' : 'killed_me');
    }
  }

  /** EA ID of a player in a match, by the name the kill feed uses. */
  uidOf(matchId: string, name: string): string | null {
    return this.rosters.get(matchId)?.get(baseName(name)) ?? null;
  }

  get(uid: string): PlayerRecord | undefined {
    return this.players.get(uid);
  }

  private encounter(matchId: string, name: string, kind: EncounterKind): void {
    const uid = this.uidOf(matchId, name);
    if (uid) this.ensure(uid).encounters.push({ matchId, kind });
  }

  private addLookup(l: RecordLine): void {
    const v = l.value as LookupValue | null;
    const g = v?.global as { level?: number; rank?: Record<string, unknown> } | undefined;
    if (!l.key || !g?.rank) return;
    const rec = this.ensure(l.key);
    if (v?.name) rec.name = v.name;
    const r = g.rank;
    const seen: RankSeen = {
      tier: String(r.rankName ?? ''),
      div: Number(r.rankDiv) || 0,
      score: Number(r.rankScore) || 0,
      season: typeof r.rankedSeason === 'string' ? r.rankedSeason : null,
      at: l.received_at,
    };
    if (!rec.latest || seen.at >= rec.latest.at) {
      rec.latest = seen;
      if (typeof g.level === 'number') rec.level = g.level;
      // 100 is what the API returns when it has no ranking for the player.
      const top = Number(r.ALStopPercent);
      rec.topPercent = top > 0 && top < 100 ? top : null;
    }
    if (!rec.peak || rankValue(seen) > rankValue(rec.peak) || (rankValue(seen) === rankValue(rec.peak) && seen.score > rec.peak.score)) {
      rec.peak = seen;
    }
  }

  private ensure(uid: string): PlayerRecord {
    let rec = this.players.get(uid);
    if (!rec) {
      rec = { uid, name: '', lobbies: new Set(), encounters: [], latest: null, peak: null, level: null, topPercent: null };
      this.players.set(uid, rec);
    }
    return rec;
  }
}

function decode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
