/**
 * What we know about other players, from every recording: lobbies shared
 * with me, fights with me, and their kills and deaths in the kill feed. It
 * grows with every match, so it says more about a player than their rank
 * (ranked lobbies share one target rank).
 */
import { baseName } from './game-names';
import type { RecordLine } from './recorder';

export type EncounterKind = 'killed_me' | 'knocked_me' | 'i_killed' | 'i_knocked';

export interface PlayerRecord {
  uid: string;
  name: string;
  lobbies: Set<string>;
  encounters: { matchId: string; kind: EncounterKind }[];
  /** Per match: their kills and deaths in the kill feed (it covers the whole lobby). */
  fights: Map<string, { kills: number; deaths: number }>;
}

export class PlayerHistory {
  private players = new Map<string, PlayerRecord>();
  /** Per match: base name -> EA ID, from the roster (the kill feed only has names). */
  private rosters = new Map<string, Map<string, string>>();
  /** Per match: EA IDs of my teammates. */
  private teammates = new Map<string, Set<string>>();
  /** Matches in the order they were first seen. */
  private order = new Map<string, number>();

  /** Feed recorder lines in order (per session); anything irrelevant is ignored. */
  add(l: RecordLine): void {
    if (!l.match_id || !l.key) return;
    if (!this.order.has(l.match_id)) this.order.set(l.match_id, this.order.size);
    if (l.key.startsWith('roster_')) {
      const p = decode(l.value) as { name?: string; is_local?: unknown; isTeammate?: unknown; origin_id?: string; platform_id?: string } | null;
      if (!p?.name || p.is_local === '1' || p.is_local === true) return;
      const uid = p.origin_id || p.platform_id;
      if (!uid) return;
      let roster = this.rosters.get(l.match_id);
      if (!roster) this.rosters.set(l.match_id, (roster = new Map()));
      roster.set(baseName(p.name), uid);
      if (p.isTeammate === true || p.isTeammate === 'true') {
        let mates = this.teammates.get(l.match_id);
        if (!mates) this.teammates.set(l.match_id, (mates = new Set()));
        mates.add(uid);
      }
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
      if (!knock && attacker !== victim) {
        if (attacker) this.fight(l.match_id, attacker).kills++;
        if (victim) this.fight(l.match_id, victim).deaths++;
      }
      if (attacker === me && victim && victim !== me) this.encounter(l.match_id, victim, knock ? 'i_knocked' : 'i_killed');
      if (victim === me && attacker && attacker !== me) this.encounter(l.match_id, attacker, knock ? 'knocked_me' : 'killed_me');
    }
  }

  /** EA ID of a player in a match, by the name the kill feed uses. */
  uidOf(matchId: string, name: string): string | null {
    return this.rosters.get(matchId)?.get(baseName(name)) ?? null;
  }

  /** Whether match `a` came before match `b` (unknown matches come before none). */
  isEarlier(a: string, b: string): boolean {
    const x = this.order.get(a);
    const y = this.order.get(b);
    return x !== undefined && y !== undefined && x < y;
  }

  /** EA IDs of everyone in a match's lobby except me and my teammates. */
  opponents(matchId: string): string[] {
    const mates = this.teammates.get(matchId);
    return [...new Set(this.rosters.get(matchId)?.values())].filter((uid) => !mates?.has(uid));
  }

  get(uid: string): PlayerRecord | undefined {
    return this.players.get(uid);
  }

  private encounter(matchId: string, name: string, kind: EncounterKind): void {
    const uid = this.uidOf(matchId, name);
    if (uid) this.ensure(uid).encounters.push({ matchId, kind });
  }

  /** Kills and deaths of a player in a match; a throwaway row when we can't identify them. */
  private fight(matchId: string, name: string): { kills: number; deaths: number } {
    const uid = this.uidOf(matchId, name);
    if (!uid) return { kills: 0, deaths: 0 };
    const rec = this.ensure(uid);
    let f = rec.fights.get(matchId);
    if (!f) rec.fights.set(matchId, (f = { kills: 0, deaths: 0 }));
    return f;
  }

  private ensure(uid: string): PlayerRecord {
    let rec = this.players.get(uid);
    if (!rec) {
      rec = { uid, name: '', lobbies: new Set(), encounters: [], fights: new Map() };
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
