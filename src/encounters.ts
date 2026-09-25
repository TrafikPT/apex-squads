/**
 * Watches the recorded lines and decides when a popup fires (DESIGN.md §12):
 * when I'm killed (the killer, plus whoever knocked me if that was someone
 * else), when I kill someone, and at match start when the lobby has players
 * worth knowing about. Everything comes from our own recordings: no API.
 */
import { baseName, isAnonymousName, ordnanceName, weaponName } from './game-names';
import type { PlayerHistory } from './player-history';
import type { RecordLine } from './recorder';
import type { Moment, PlayerCard } from './ui/popup-card';

/** Kills needed before "kill leader" means anything. */
const KILL_LEADER_MIN = 3;
/**
 * Lobby card: a strong player has this K/D over at least this many earlier
 * shared matches and kills, so 2 kills and a death isn't enough (on 43 real
 * matches that alone put a card in 1 lobby out of 3).
 */
const STRONG_KD = 2;
const STRONG_MIN_MATCHES = 2;
const STRONG_MIN_KILLS = 4;
const LOBBY_MAX_PLAYERS = 4;
/** Kill feed actions that aren't a weapon or an ability. */
const PLAIN_ACTIONS = new Set(['kill', 'knockdown', 'headshot_kill', 'Bleed_out', 'Finisher']);

export interface Seen {
  name: string;
  uid: string | null;
  kills: number;
  killLeader: boolean;
  /** Only when they killed or knocked me: what they used, and my damage on them this match. */
  weapon?: string | null;
  damageFromMe?: number;
}

export interface Trigger {
  moment: Moment;
  matchId: string;
  at: string;
  player: Seen;
  knockedBy?: Seen;
}

interface KillFeed {
  local_player_name?: string;
  attackerName?: string;
  victimName?: string;
  weaponName?: string;
  action?: string;
  action2?: string;
}

export class EncounterTracker {
  private matchId: string | null = null;
  /** Kills this match, per attacker name. */
  private kills = new Map<string, number>();
  /** My damage this match, per target name. */
  private damage = new Map<string, number>();
  /** Who knocked me and with what, until I'm revived, respawned or killed. */
  private knockedMe: { name: string; weapon: string | null } | null = null;

  constructor(private readonly history: PlayerHistory) {}

  onLine(l: RecordLine): Trigger[] {
    if (!l.match_id) return [];
    if (l.match_id !== this.matchId) {
      this.matchId = l.match_id;
      this.kills = new Map();
      this.damage = new Map();
      this.knockedMe = null;
    }
    if (l.kind === 'event' && (l.key === 'healed_from_ko' || l.key === 'respawn')) this.knockedMe = null;
    if (l.kind === 'event' && l.key === 'damage') {
      const d = decode(l.value) as { targetName?: string; damageAmount?: string } | null;
      const target = baseName(d?.targetName ?? '');
      if (target) this.damage.set(target, (this.damage.get(target) ?? 0) + (Number(d?.damageAmount) || 0));
    }
    if (l.key !== 'kill_feed') return [];

    const p = decode(l.value) as KillFeed | null;
    if (!p?.local_player_name) return [];
    const me = baseName(p.local_player_name);
    const attacker = baseName(p.attackerName ?? '');
    const victim = baseName(p.victimName ?? '');
    const knock = p.action === 'knockdown' || p.action2 === 'knockdown';
    if (attacker && !knock) this.kills.set(attacker, (this.kills.get(attacker) ?? 0) + 1);
    if (!attacker || !victim || attacker === victim) return [];

    if (victim === me && knock) {
      this.knockedMe = { name: attacker, weapon: usedOnMe(p) };
    } else if (victim === me) {
      const knocked = this.knockedMe;
      this.knockedMe = null;
      // Bleed-outs and finishers have no weapon: the one that knocked me tells the story.
      const weapon = usedOnMe(p) ?? (knocked?.name === attacker ? knocked.weapon : null);
      return [{
        moment: 'killed_by',
        matchId: l.match_id,
        at: l.received_at,
        player: this.attackerOfMe(attacker, weapon),
        ...(knocked && knocked.name !== attacker ? { knockedBy: this.attackerOfMe(knocked.name, knocked.weapon) } : {}),
      }];
    } else if (attacker === me && !knock) {
      return [{ moment: 'you_killed', matchId: l.match_id, at: l.received_at, player: this.seen(victim) }];
    }
    return [];
  }

  private seen(name: string): Seen {
    const kills = this.kills.get(name) ?? 0;
    const top = Math.max(0, ...this.kills.values());
    return {
      name,
      uid: this.history.uidOf(this.matchId!, name),
      kills,
      killLeader: kills >= KILL_LEADER_MIN && kills === top,
    };
  }

  private attackerOfMe(name: string, weapon: string | null): Seen {
    return { ...this.seen(name), weapon, damageFromMe: Math.round(this.damage.get(name) ?? 0) };
  }
}

/** The card for one player, from the moment's numbers plus everything history knows. */
export function cardFor(seen: Seen, matchId: string, history: PlayerHistory): PlayerCard {
  const rec = seen.uid ? history.get(seen.uid) : undefined;
  // Only matches before this one: a replay's history already holds the later ones.
  const earlier = (m: string) => history.isEarlier(m, matchId);
  const before = rec?.encounters.filter((e) => earlier(e.matchId)) ?? [];
  const fights = rec ? [...rec.fights].filter(([m]) => earlier(m)).map(([, f]) => f) : [];
  const kills = fights.reduce((n, f) => n + f.kills, 0);
  const deaths = fights.reduce((n, f) => n + f.deaths, 0);
  const metBefore = rec ? [...rec.lobbies].filter(earlier).length : 0;
  return {
    name: seen.name,
    anonymous: !seen.uid && isAnonymousName(seen.name),
    kills: seen.kills,
    killLeader: seen.killLeader,
    weapon: seen.weapon ?? null,
    damageFromMe: seen.damageFromMe ?? null,
    metBefore,
    // Same rule as the dashboard's K/D: kills when there were no deaths.
    kd: metBefore ? kills / Math.max(deaths, 1) : null,
    killsSeen: kills,
    theyKilledMe: before.filter((e) => e.kind === 'killed_me').length,
    iKilledThem: before.filter((e) => e.kind === 'i_killed').length,
  };
}

/**
 * Opponents in this lobby worth knowing about: whoever killed me before, then
 * players with a high K/D over enough shared matches. Empty: no lobby card.
 */
export function lobbyCards(matchId: string, history: PlayerHistory): PlayerCard[] {
  return history.opponents(matchId)
    .map((uid) => cardFor({ name: history.get(uid)?.name ?? '', uid, kills: 0, killLeader: false }, matchId, history))
    .filter((c) => c.theyKilledMe > 0 || (c.metBefore >= STRONG_MIN_MATCHES && c.killsSeen >= STRONG_MIN_KILLS && (c.kd ?? 0) >= STRONG_KD))
    .sort((a, b) => b.theyKilledMe - a.theyKilledMe || (b.kd ?? 0) - (a.kd ?? 0))
    .slice(0, LOBBY_MAX_PLAYERS);
}

/** What a player used on me: the gun's dashboard name or a grenade's, else the ability ("Knuckle Cluster"). */
function usedOnMe(p: KillFeed): string | null {
  if (p.weaponName) return weaponName(p.weaponName) ?? ordnanceName(p.weaponName) ?? p.weaponName;
  return [p.action, p.action2].find((a) => a && !PLAIN_ACTIONS.has(a)) ?? null;
}

function decode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
