/**
 * Silver + gold (DESIGN.md §4.3–4.4): turns recorder lines into the Dataset
 * the dashboard draws (src/ui/facts.ts). It runs in the app's main process,
 * which can't load DuckDB without a native module, so the stat rules live
 * here; sql/ stays for exploring the raw lines. Rules follow DESIGN.md §5 and
 * the match-boundary findings in §9.1.
 */
import { baseName, legendName, mapName, weaponName, weaponOrOther } from './game-names';
import type { RecordLine } from './recorder';
import type { Account, Dataset, MatchFact, Mode, Player, TeammateFact, WeaponFact } from './ui/facts';
import { rankOf } from './ui/ranks';
import { estimateRp } from './ui/rp-formula';

export interface BuildResult {
  dataset: Dataset;
  /** Matches left out because they have no match_summary and GEP never ended them (still playing, or recording stopped mid-match). */
  incomplete: number;
}

/** One match's lines: `pre` are the untagged lines since the previous match ended (legend select, map, roster). */
interface MatchLines {
  matchId: string;
  pre: RecordLine[];
  own: RecordLine[];
  gameMode: string | null;
  /** GEP's match_end came after the match's lines: it finished, even without a summary. */
  ended: boolean;
  /** The session's last map before this match; GEP doesn't resend an unchanged map after clearing it. */
  lobbyMap: { id: string | null; name: string | null };
}

interface RosterEntry {
  key: string;
  name: string;
  isTeammate: boolean;
  isLocal: boolean;
}

interface KillFeed {
  attackerName: string;
  victimName: string;
  weaponName: string;
  action: string;
  action2: string;
  local_player_name: string;
}

interface StatsSnapshot {
  at: number;
  season: number;
  games: number;
  rp: number;
  revived: number;
}

const RANKED_STATS = 'player_stats_br_ranked_latest';
const UNRANKED_STATS = 'player_stats_br_unranked_latest';

export function buildDataset(lines: RecordLine[]): BuildResult {
  const snapshots = {
    ranked: statsSnapshots(lines, RANKED_STATS),
    pubs: statsSnapshots(lines, UNRANKED_STATS),
  };
  const accounts = new Map<string, { name: string; lastAt: string; rp: number | null }>();
  const players = new Map<string, string>();
  const matches: MatchFact[] = [];
  const teammates: TeammateFact[] = [];
  const weapons: WeaponFact[] = [];
  const seasons = new Map<string, number>();
  let incomplete = 0;

  const rpBefore = new Map<string, number>();

  for (const m of splitMatches(lines)) {
    const built = buildMatch(m, snapshots);
    if (!built) {
      incomplete++;
      continue;
    }
    matches.push(built.match);
    if (built.rpBefore !== null) rpBefore.set(built.match.matchId, built.rpBefore);
    teammates.push(...built.teammates);
    weapons.push(...built.weapons);
    for (const t of built.roster) players.set(t.key, t.name);
    if (built.season !== null) seasons.set(built.match.matchId, built.season);

    const acc = accounts.get(built.match.accountKey);
    if (!acc || built.match.startedAt > acc.lastAt) {
      accounts.set(built.match.accountKey, {
        name: built.accountName,
        lastAt: built.match.startedAt,
        rp: built.match.rpAfter ?? built.rpBefore ?? acc?.rp ?? null,
      });
    }
  }
  matches.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  estimateMissingRp(matches, rpBefore);

  return {
    dataset: {
      accounts: [...accounts].map(([accountKey, a]): Account => {
        const account: Account = { accountKey, alias: a.name, name: a.name };
        if (a.rp !== null) {
          const r = rankOf(a.rp);
          account.rank = { tier: r.tier, division: r.division, rp: a.rp };
        }
        return account;
      }),
      players: [...players].map(([playerKey, name]): Player => ({ playerKey, name })),
      matches,
      teammates,
      weapons,
      seasonStart: apiSeasonStart(lines) ?? seasonStart(matches, seasons),
    },
    incomplete,
  };
}

// ---------------------------------------------------------------- silver: match boundaries

/**
 * Groups lines by match. GEP only sends pseudo_match_id once the drop starts,
 * so legend select, map and part of the roster arrive untagged; they belong
 * to the next match in the same session (DESIGN.md §9.1).
 */
function splitMatches(lines: RecordLine[]): MatchLines[] {
  const byMatch = new Map<string, MatchLines>();
  for (let session of groupBy(lines, (l) => l.session_id).values()) {
    // The same session file copied into two folders must not count twice.
    session = [...new Map(session.map((l) => [l.seq, l])).values()].sort((a, b) => a.seq - b.seq);
    let pre: RecordLine[] = [];
    let currentId: string | null = null;
    // The last match seen; match_end arrives untagged, after the id is cleared.
    let lastId: string | null = null;
    // Sent only when it changes, in the lobby: carried forward.
    let gameMode: string | null = null;
    // Cleared after each match and resent only when the rotation changes: carried forward.
    const lobbyMap = { id: null as string | null, name: null as string | null };
    for (const l of session) {
      if (l.key === 'game_mode' && typeof l.value === 'string' && l.value) gameMode = l.value;
      if (l.key === 'map_id' && typeof l.value === 'string' && l.value) lobbyMap.id = l.value;
      if (l.key === 'map_name' && typeof l.value === 'string' && l.value) lobbyMap.name = l.value;
      if (!l.match_id) {
        currentId = null;
        if (l.kind === 'event' && l.key === 'match_end' && lastId) byMatch.get(lastId)!.ended = true;
        pre.push(l);
        continue;
      }
      let current = byMatch.get(l.match_id);
      if (currentId !== l.match_id) {
        // A reconnect can continue the same match id in a later session.
        if (!current) byMatch.set(l.match_id, (current = { matchId: l.match_id, pre, own: [], gameMode, ended: false, lobbyMap: { ...lobbyMap } }));
        currentId = l.match_id;
        lastId = l.match_id;
        pre = [];
      }
      current!.own.push(l);
      if (l.key === 'game_mode' && typeof l.value === 'string' && l.value) current!.gameMode = l.value;
    }
  }
  return [...byMatch.values()];
}

// ---------------------------------------------------------------- gold: one match

function buildMatch(m: MatchLines, snapshots: Record<Mode, StatsSnapshot[]>) {
  const all = [...m.pre, ...m.own];
  const summary = lastObject(m.own, 'match_summary') ?? (m.ended ? summaryFromScoreboard(m.own) : null);
  if (!summary) return null;

  const roster = rosterOf(all);
  const me = roster.find((r) => r.isLocal);
  const mates = roster.filter((r) => r.isTeammate && !r.isLocal);
  const meName = me?.name ?? lastString(all, 'name') ?? 'Me';
  const picks = legendPicks(all);

  const startLine = m.own.find((l) => l.key === 'match_start') ?? m.own[0];
  const startedAt = startLine.received_at;
  // Stats brackets start here, not at the end: GEP can send the post-match stats
  // before the match_summary line (seen on a #2 finish).
  const startAt = Date.parse(startedAt);
  const mode: Mode = m.gameMode === '#GAME_MODE_RANKED' ? 'ranked' : 'pubs';
  const mapId = lastString(all, 'map_id') ?? m.lobbyMap.id;

  // My numbers. kill/assist events carry running totals; count them if a value is missing.
  const events = (key: string) => m.own.filter((l) => l.kind === 'event' && l.key === key);
  const runningTotal = (key: string) => {
    const evs = events(key);
    return Math.max(evs.length, ...evs.map((l) => Number(l.value) || 0));
  };

  // Damage goes to the gun in hand at the time (DESIGN.md §5: an estimate).
  const perWeapon = new Map<string, { kills: number; knocks: number; damage: number }>();
  const weaponRow = (w: string) => {
    let row = perWeapon.get(w);
    if (!row) perWeapon.set(w, (row = { kills: 0, knocks: 0, damage: 0 }));
    return row;
  };
  const feed: KillFeed[] = [];
  let inHand = weaponOrOther(null);
  let damage = 0;
  for (const l of m.own) {
    if (l.key === 'inUse') {
      const p = decode(l.value) as { inUse?: string } | null;
      inHand = weaponOrOther(p?.inUse);
    } else if (l.kind === 'event' && l.key === 'damage') {
      const amount = Number((decode(l.value) as { damageAmount?: string } | null)?.damageAmount) || 0;
      damage += amount;
      weaponRow(inHand).damage += amount;
    } else if (l.kind === 'event' && l.key === 'kill_feed') {
      const p = decode(l.value) as KillFeed | null;
      if (p) feed.push(p);
    }
  }

  // Kills and knocks per weapon, from the kill feed. A bleed-out or finisher
  // has no weapon: it goes to the gun that knocked that player.
  const myFeedName = feed.length ? baseName(feed[0].local_player_name) : baseName(meName);
  const knockedWith = new Map<string, string>();
  for (const k of feed) {
    if (baseName(k.attackerName) !== myFeedName) continue;
    const victim = baseName(k.victimName);
    if (isKnock(k)) {
      const w = weaponOrOther(k.weaponName);
      knockedWith.set(victim, w);
      weaponRow(w).knocks++;
    } else {
      weaponRow(k.weaponName ? weaponOrOther(k.weaponName) : (knockedWith.get(victim) ?? weaponOrOther(null))).kills++;
    }
  }

  const teammates: TeammateFact[] = mates.map((t) => {
    const name = baseName(t.name);
    const theirs = feed.filter((k) => baseName(k.attackerName) === name);
    return {
      matchId: m.matchId,
      playerKey: t.key,
      legend: picks.get(name) ?? 'Unknown',
      kills: theirs.filter((k) => !isKnock(k)).length,
      knocks: theirs.filter(isKnock).length,
      deaths: feed.filter((k) => baseName(k.victimName) === name && !isKnock(k)).length,
    };
  });

  const bracket = statsBracket(snapshots[mode], startAt);
  const match: MatchFact = {
    matchId: m.matchId,
    accountKey: me?.key ?? `name:${baseName(meName)}`,
    startedAt,
    mode,
    map: mapName(mapId, lastString(all, 'map_name') ?? m.lobbyMap.name),
    legend: picks.get(LOCAL_PICK) ?? picks.get(baseName(meName)) ?? 'Unknown',
    placement: Number(summary.rank) || 0,
    teams: Number(summary.teams) || 0,
    kills: runningTotal('kill'),
    assists: runningTotal('assist'),
    knocks: events('knockdown').length,
    deaths: events('death').length,
    damage: Math.round(damage),
    revivesGiven: bracket ? bracket.after.revived - bracket.before.revived : 0,
    revivesReceived: events('healed_from_ko').length,
    rpDelta: mode === 'ranked' && bracket ? bracket.after.rp - bracket.before.rp : null,
    rpAfter: mode === 'ranked' && bracket ? bracket.after.rp : null,
    rpEstimated: false,
    loadout: heldLongest(m.own),
    squadKey: mates.map((t) => t.key).sort().join('|'),
  };

  const weapons: WeaponFact[] = [...perWeapon]
    .filter(([, w]) => w.kills || w.knocks || w.damage)
    .map(([weapon, w]) => ({ matchId: m.matchId, weapon, kills: w.kills, knocks: w.knocks, damage: Math.round(w.damage) }));

  const before = mode === 'ranked' ? lastBefore(snapshots.ranked, startAt) : null;
  return {
    match,
    teammates,
    weapons,
    roster: mates,
    accountName: meName,
    rpBefore: before?.rp ?? null,
    season: before?.season ?? null,
  };
}

function isKnock(k: KillFeed): boolean {
  return k.action === 'knockdown' || k.action2 === 'knockdown';
}

/** Everyone in my squad this match, keyed on the platform ID (names change; DESIGN.md §4.2). */
function rosterOf(lines: RecordLine[]): RosterEntry[] {
  const byKey = new Map<string, RosterEntry>();
  for (const l of lines) {
    if (!l.key?.startsWith('roster_')) continue;
    const p = decode(l.value) as Record<string, unknown> | null;
    if (!p || typeof p.name !== 'string' || !p.name) continue;
    const isLocal = p.is_local === '1' || p.is_local === true;
    const isTeammate = p.isTeammate === true || p.isTeammate === 'true';
    if (!isLocal && !isTeammate) continue;
    const key = String(p.platform_id || p.origin_id || `name:${baseName(p.name)}`);
    byKey.set(key, { key, name: p.name, isTeammate, isLocal });
  }
  return [...byKey.values()];
}

const LOCAL_PICK = '\0local';

/** Legend per player (base name), from the last legendSelect_X value per slot; mine also under LOCAL_PICK. */
function legendPicks(lines: RecordLine[]): Map<string, string> {
  const slots = new Map<string, { playerName: string; legendName: string; is_local: unknown }>();
  for (const l of lines) {
    if (!l.key?.startsWith('legendSelect_')) continue;
    const p = decode(l.value) as { playerName?: string; legendName?: string; is_local?: unknown } | null;
    if (p?.playerName && p.legendName) slots.set(l.key, { playerName: p.playerName, legendName: p.legendName, is_local: p.is_local });
  }
  const picks = new Map<string, string>();
  for (const s of slots.values()) {
    const legend = legendName(s.legendName);
    picks.set(baseName(s.playerName), legend);
    if (s.is_local === true || s.is_local === '1') picks.set(LOCAL_PICK, legend);
  }
  return picks;
}

// ---------------------------------------------------------------- RP and revives from GEP's own stats

/**
 * GEP's season stats (`player_stats_br_*_latest`) refresh between matches and
 * include RP (`rank_score`) and `teammates_revived`, so the difference across a
 * match gives its RP change and revives given. Only trusted when exactly one
 * game was added in between; otherwise the change can't be split per match.
 * "Before" is the last snapshot before the match started; "after" the first
 * one that counts it, which may arrive before the match's last line.
 */
function statsBracket(snaps: StatsSnapshot[], startAt: number) {
  const before = lastBefore(snaps, startAt);
  if (!before) return null;
  const after = snaps.find((s) => s.at > startAt && s.games > before.games);
  return after && after.games === before.games + 1 && after.season === before.season ? { before, after } : null;
}

/**
 * Ranked matches without a real RP change (the stats haven't arrived yet, or
 * never did) get the formula's estimate, flagged so the UI can say so. Walks
 * each account's matches in order, for the top-5 streak and the RP before.
 */
function estimateMissingRp(matches: MatchFact[], rpBefore: Map<string, number>): void {
  const perAccount = new Map<string, { streak: number; rp: number | null }>();
  for (const m of matches) {
    if (m.mode !== 'ranked') continue;
    let acc = perAccount.get(m.accountKey);
    if (!acc) perAccount.set(m.accountKey, (acc = { streak: 0, rp: null }));
    acc.streak = m.placement >= 1 && m.placement <= 5 ? acc.streak + 1 : 0;
    const before = rpBefore.get(m.matchId) ?? acc.rp;
    if (m.rpDelta === null && before !== null && m.placement > 0) {
      m.rpDelta = estimateRp({ placement: m.placement, kills: m.kills, assists: m.assists, rpBefore: before, topFiveStreak: acc.streak });
      m.rpEstimated = true;
    }
    acc.rp = m.rpAfter ?? (before !== null && m.rpDelta !== null ? before + m.rpDelta : acc.rp);
  }
}

function lastBefore(snaps: StatsSnapshot[], at: number): StatsSnapshot | null {
  let found: StatsSnapshot | null = null;
  for (const s of snaps) {
    if (s.at > at) break;
    found = s;
  }
  return found;
}

function statsSnapshots(lines: RecordLine[], key: string): StatsSnapshot[] {
  const out: StatsSnapshot[] = [];
  for (const l of lines) {
    if (l.key !== key) continue;
    const p = decode(l.value) as Record<string, unknown> | null;
    if (!p || typeof p.games !== 'number') continue;
    out.push({
      at: Date.parse(l.received_at),
      season: Number(p.season),
      games: p.games,
      rp: Number(p.rank_score) || 0,
      revived: Number(p.teammates_revived) || 0,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Start of the current ranked split, from the newest RP snapshot that has it
 * (apexlegendsstatus `global.rank.rankedSeasonMeta.start`, in epoch seconds).
 */
function apiSeasonStart(lines: RecordLine[]): string | null {
  let best: { at: string; start: number } | null = null;
  for (const l of lines) {
    if (l.kind !== 'rp_snapshot') continue;
    const body = (l.value as { body?: { global?: { rank?: { rankedSeasonMeta?: { start?: number } } } } } | null)?.body;
    const start = body?.global?.rank?.rankedSeasonMeta?.start;
    if (typeof start === 'number' && (!best || l.received_at > best.at)) best = { at: l.received_at, start };
  }
  return best ? localDay(new Date(best.start * 1000)) : null;
}

/**
 * Without an RP snapshot, GEP gives the season number but not its dates: the
 * season starts, as far as we know, at the first recorded match of the latest
 * season seen.
 */
function seasonStart(matches: MatchFact[], seasons: Map<string, number>): string {
  const latest = Math.max(...seasons.values());
  const first = matches.find((m) => seasons.get(m.matchId) === latest) ?? matches[0];
  return localDay(first ? new Date(first.startedAt) : new Date());
}

function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------------------------------------------------------------- helpers

/** GEP often sends JSON as a string; this returns the parsed value (DESIGN.md §4.1). */
function decode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * My loadout: the guns in my two slots (GEP's `weapons`) that I held the
 * longest, so early looting swaps and a gun that never hit anyone don't
 * decide it. One gun if that's all I carried; empty without slot data.
 */
function heldLongest(own: RecordLine[]): string[] {
  const held = new Map<string, number>();
  let pair: string | null = null;
  let since = 0;
  const hold = (until: number) => {
    if (pair !== null) held.set(pair, (held.get(pair) ?? 0) + until - since);
  };
  for (const l of own) {
    if (l.key !== 'weapons') continue;
    const slots = decode(l.value) as { weapon0?: unknown; weapon1?: unknown } | null;
    const guns = [slots?.weapon0, slots?.weapon1]
      .map((w) => (typeof w === 'string' ? weaponName(w) : null))
      .filter((w): w is string => w !== null);
    const at = Date.parse(l.received_at);
    hold(at);
    pair = guns.length ? [...new Set(guns)].sort().join('|') : null;
    since = at;
  }
  if (own.length) hold(Date.parse(own[own.length - 1].received_at));
  const [longest] = [...held].sort((a, b) => b[1] - a[1]);
  return longest ? longest[0].split('|') : [];
}

/**
 * For a match left before its summary screen (GEP ends it without a
 * match_summary): the squads still alive on my last scoreboard (`tabs`) is my
 * placement, and the most it ever showed is the lobby's size. Off by a little
 * if a squad fell in my last seconds, or my teammates played on after I left.
 */
function summaryFromScoreboard(own: RecordLine[]): Record<string, unknown> | null {
  const teams = own
    .filter((l) => l.key === 'tabs')
    .map((l) => Number((decode(l.value) as { teams?: unknown } | null)?.teams))
    .filter((n) => n > 0);
  return teams.length ? { rank: teams[teams.length - 1], teams: Math.max(...teams) } : null;
}

function lastObject(lines: RecordLine[], key: string): Record<string, unknown> | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].key !== key) continue;
    const p = decode(lines[i].value);
    if (p && typeof p === 'object') return p as Record<string, unknown>;
  }
  return null;
}

function lastString(lines: RecordLine[], key: string): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const v = lines[i].value;
    if (lines[i].key === key && typeof v === 'string' && v) return v;
  }
  return null;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(item);
  }
  return groups;
}
