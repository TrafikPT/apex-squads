/**
 * Filtering and aggregation over gold facts. Pure functions, so they're unit
 * tested and reused unchanged when real data replaces the mock.
 */
import type { Dataset, MatchFact, Mode, TeammateFact } from './facts';
import { OTHER_WEAPON, WEAPON_CLASSES, weaponClass } from './weapons';

export type PeriodPreset = '7d' | '30d' | '90d' | 'season' | 'all' | 'custom';

export interface Filters {
  period: PeriodPreset;
  /** Inclusive ISO dates, used when period = 'custom'. */
  from?: string;
  to?: string;
  account: string | 'all';
  legend: string | 'all';
  map: string | 'all';
  mode: Mode | 'all';
  /** Matches must include every one of these teammates. */
  withPlayers: string[];
}

export const DEFAULT_FILTERS: Filters = {
  period: '30d',
  account: 'all',
  legend: 'all',
  map: 'all',
  mode: 'ranked',
  withPlayers: [],
};

const DAY_MS = 86_400_000;

/** [start, end) in epoch ms for the selected period. */
export function periodRange(f: Filters, data: Dataset, now: Date): [number, number] {
  const end = now.getTime() + 1;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const daysBack = (n: number) => startOfToday.getTime() - (n - 1) * DAY_MS;
  switch (f.period) {
    case '7d':
      return [daysBack(7), end];
    case '30d':
      return [daysBack(30), end];
    case '90d':
      return [daysBack(90), end];
    case 'season':
      return [localDate(data.seasonStart), end];
    case 'custom': {
      const from = f.from ? localDate(f.from) : -Infinity;
      const to = f.to ? localDate(f.to) + DAY_MS : end;
      return [from, to];
    }
    default:
      return [-Infinity, end];
  }
}

export function filterMatches(data: Dataset, f: Filters, now = new Date()): MatchFact[] {
  const [start, end] = periodRange(f, data, now);
  return matchesBetween(data, f, start, end);
}

/** The matches between two times that pass every other filter. */
function matchesBetween(data: Dataset, f: Filters, start: number, end: number): MatchFact[] {
  const squadOf = teammateIndex(data);
  return data.matches.filter((m) => {
    const t = Date.parse(m.startedAt);
    if (t < start || t >= end) return false;
    if (f.account !== 'all' && m.accountKey !== f.account) return false;
    if (f.legend !== 'all' && m.legend !== f.legend) return false;
    if (f.map !== 'all' && m.map !== f.map) return false;
    if (f.mode !== 'all' && m.mode !== f.mode) return false;
    if (f.withPlayers.length) {
      const mates = squadOf.get(m.matchId);
      if (!mates || !f.withPlayers.every((p) => mates.has(p))) return false;
    }
    return true;
  });
}

export interface Kpis {
  matches: number;
  avgPlacement: number | null;
  top5Rate: number | null;
  winRate: number | null;
  avgKills: number | null;
  avgDamage: number | null;
  /** Total kills / total deaths; total kills when there were no deaths. */
  kd: number | null;
  avgRevives: number | null;
  rpNet: number | null;
  rpMatches: number;
}

export function kpis(matches: MatchFact[]): Kpis {
  const n = matches.length;
  const avg = (sel: (m: MatchFact) => number) =>
    n ? matches.reduce((s, m) => s + sel(m), 0) / n : null;
  const rated = matches.filter((m) => m.rpDelta !== null);
  const kills = matches.reduce((s, m) => s + m.kills, 0);
  const deaths = matches.reduce((s, m) => s + m.deaths, 0);
  return {
    matches: n,
    avgPlacement: avg((m) => m.placement),
    top5Rate: avg((m) => (m.placement <= 5 ? 1 : 0)),
    winRate: avg((m) => (m.placement === 1 ? 1 : 0)),
    avgKills: avg((m) => m.kills),
    avgDamage: avg((m) => m.damage),
    kd: n ? kills / Math.max(deaths, 1) : null,
    avgRevives: avg((m) => m.revivesGiven),
    rpNet: rated.length ? rated.reduce((s, m) => s + (m.rpDelta ?? 0), 0) : null,
    rpMatches: rated.length,
  };
}

/** A break this long between two matches starts a new play session. */
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000;

/** Play sessions, oldest first, each with its matches oldest first. */
export function playSessions(matches: MatchFact[]): MatchFact[][] {
  const sessions: MatchFact[][] = [];
  let last = -Infinity;
  for (const m of [...matches].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const t = Date.parse(m.startedAt);
    if (t - last >= SESSION_GAP_MS) sessions.push([]);
    sessions[sessions.length - 1].push(m);
    last = t;
  }
  return sessions;
}

export interface RpStep {
  match: MatchFact;
  /** RP after the match; null across several accounts (levels don't add up) or when unknown. */
  level: number | null;
  /** Net RP of the selection's matches up to this one. */
  cumulative: number;
  /**
   * RP that changed between the account's previous recorded match and this
   * one: games played while nothing was recording. 0 across several accounts.
   */
  unrecorded: number;
  /** First match of a play session. */
  sessionStart: boolean;
}

/**
 * The selection's ranked matches, oldest first, with the RP level after each.
 * "Unrecorded" compares with the account's previous match in all the data,
 * not the selection, so a filter that hides matches doesn't count as missing.
 */
export function rpSteps(matches: MatchFact[], all: MatchFact[]): RpStep[] {
  const single = rankedAccount(matches) !== null;
  const previous = new Map<string, MatchFact>();
  const lastOf = new Map<string, MatchFact>();
  for (const m of [...all].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (m.rpDelta === null) continue;
    const prev = lastOf.get(m.accountKey);
    if (prev) previous.set(m.matchId, prev);
    lastOf.set(m.accountKey, m);
  }
  const starts = new Set(playSessions(matches).map((s) => s[0].matchId));
  const steps: RpStep[] = [];
  let cumulative = 0;
  let level: number | null = null;
  for (const m of [...matches].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (m.rpDelta === null) continue;
    cumulative += m.rpDelta;
    let unrecorded = 0;
    if (single) {
      const known = m.rpAfter !== null && !m.rpEstimated;
      const prev = previous.get(m.matchId);
      if (known && prev?.rpAfter != null && !prev.rpEstimated) unrecorded = m.rpAfter! - m.rpDelta - prev.rpAfter;
      level = known ? m.rpAfter : level === null ? null : level + m.rpDelta;
    }
    steps.push({ match: m, level: single ? level : null, cumulative, unrecorded, sessionStart: starts.has(m.matchId) });
  }
  return steps;
}

/** The rates the Overview tiles compare. */
export interface Rates {
  kd: number;
  avgKills: number;
  avgDamage: number;
  top5Rate: number;
  winRate: number;
}

export interface Comparison {
  /** What it is, as the tile says it: "prev 30 days", "last season". */
  label: string;
  /** How many games it covers. */
  games: number;
  rates: Rates;
}

/** Fewest games a comparison needs before the tiles show it. */
export const MIN_COMPARE = 5;

const PREVIOUS_LABEL: Partial<Record<PeriodPreset, string>> = { '7d': 'prev 7 days', '30d': 'prev 30 days', '90d': 'prev 90 days', custom: 'prev period' };

/**
 * What the Overview tiles compare with, so "better or worse" has a fair
 * reference. 7/30/90 days and custom ranges: the period just before, same
 * length, with the same filters (recorded matches; a season boundary doesn't
 * matter, only RP resets). Season: last season, from the game's own totals
 * (ranked only). All time: nothing. Null when there's too little to compare
 * with, as for a new install.
 */
export function comparisonFor(data: Dataset, f: Filters, now = new Date()): Comparison | null {
  if (f.period === 'season') {
    if (f.mode !== 'ranked') return null;
    const keys = f.account === 'all' ? data.accounts.map((a) => a.accountKey) : [f.account];
    const rows = keys.flatMap((key) => {
      const current = data.seasons.find((s) => s.accountKey === key && s.current);
      return current ? data.seasons.filter((s) => s.accountKey === key && s.season === current.season - 1) : [];
    });
    const games = rows.reduce((n, s) => n + s.games, 0);
    if (games < MIN_COMPARE) return null;
    const sum = (k: 'kills' | 'deaths' | 'damage' | 'top5s' | 'wins') => rows.reduce((n, s) => n + s[k], 0);
    return {
      label: 'last season',
      games,
      rates: { kd: sum('kills') / Math.max(sum('deaths'), 1), avgKills: sum('kills') / games, avgDamage: sum('damage') / games,
        top5Rate: sum('top5s') / games, winRate: sum('wins') / games },
    };
  }
  const label = PREVIOUS_LABEL[f.period];
  const [start, end] = periodRange(f, data, now);
  if (!label || !Number.isFinite(start)) return null;
  const before = matchesBetween(data, f, start - (end - start), start);
  if (before.length < MIN_COMPARE) return null;
  const k = kpis(before);
  return { label, games: before.length, rates: { kd: k.kd!, avgKills: k.avgKills!, avgDamage: k.avgDamage!, top5Rate: k.top5Rate!, winRate: k.winRate! } };
}

/**
 * The one account whose ranked matches make up the selection, or null when
 * there are several (their RP levels can't be added up) or none.
 */
export function rankedAccount(matches: MatchFact[]): string | null {
  const keys = new Set(matches.filter((m) => m.rpDelta !== null).map((m) => m.accountKey));
  return keys.size === 1 ? [...keys][0] : null;
}

/** Teammates by games played with me in the given matches, most frequent first. */
export function frequentTeammates(data: Dataset, matches: MatchFact[], limit: number) {
  const ids = new Set(matches.map((m) => m.matchId));
  const counts = new Map<string, number>();
  for (const t of data.teammates) {
    if (ids.has(t.matchId)) counts.set(t.playerKey, (counts.get(t.playerKey) ?? 0) + 1);
  }
  return [...counts.entries()]
    // Regulars only (3+ games, as elsewhere): a random met twice isn't worth a chip.
    .filter(([, games]) => games >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([playerKey, games]) => ({ playerKey, games }));
}

export function teammateIndex(data: Dataset): Map<string, Set<string>> {
  const idx = new Map<string, Set<string>>();
  for (const t of data.teammates) {
    let s = idx.get(t.matchId);
    if (!s) idx.set(t.matchId, (s = new Set()));
    s.add(t.playerKey);
  }
  return idx;
}

export function toLocalDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function localDate(isoDay: string): number {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

// ---------------------------------------------------------------- squads

/** Teammates seen in at least `minGames` matches overall; everyone else counts as a random. */
export function regularPlayers(data: Dataset, minGames = 3): Set<string> {
  const counts = new Map<string, number>();
  for (const t of data.teammates) counts.set(t.playerKey, (counts.get(t.playerKey) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n >= minGames).map(([key]) => key));
}

export interface TeammateRow {
  playerKey: string;
  games: number;
  /** Their numbers in the matches with me. */
  killsPerGame: number;
  knocksPerGame: number;
  /** Their kills / their deaths (kill feed); their kills when they never died. */
  kd: number;
  topLegend: string;
  /** My numbers in the matches with them. */
  me: Kpis;
}

/** One row per regular teammate in the selection, most games together first. */
export function teammateStats(data: Dataset, matches: MatchFact[], regulars: Set<string>, minGames = 3): TeammateRow[] {
  const byId = new Map(matches.map((m) => [m.matchId, m]));
  const acc = new Map<string, { matches: MatchFact[]; kills: number; knocks: number; deaths: number; legends: Map<string, number> }>();
  for (const t of data.teammates) {
    const m = byId.get(t.matchId);
    if (!m || !regulars.has(t.playerKey)) continue;
    let a = acc.get(t.playerKey);
    if (!a) acc.set(t.playerKey, (a = { matches: [], kills: 0, knocks: 0, deaths: 0, legends: new Map() }));
    a.matches.push(m);
    a.kills += t.kills;
    a.knocks += t.knocks;
    a.deaths += t.deaths;
    a.legends.set(t.legend, (a.legends.get(t.legend) ?? 0) + 1);
  }
  return [...acc]
    .filter(([, a]) => a.matches.length >= minGames)
    .map(([playerKey, a]) => ({
      playerKey,
      games: a.matches.length,
      killsPerGame: a.kills / a.matches.length,
      knocksPerGame: a.knocks / a.matches.length,
      kd: a.kills / Math.max(a.deaths, 1),
      topLegend: [...a.legends].sort((x, y) => y[1] - x[1])[0][0],
      me: kpis(a.matches),
    }))
    .sort((a, b) => b.games - a.games);
}

export interface SquadRow {
  /** Regular teammates in the squad (sorted); empty = solo queue with randoms. */
  friends: string[];
  games: number;
  me: Kpis;
}

/** My results grouped by which friends were in the squad; randoms are ignored. */
export function squadStats(data: Dataset, matches: MatchFact[], regulars: Set<string>, minGames = 3): SquadRow[] {
  const mates = teammateIndex(data);
  const groups = new Map<string, MatchFact[]>();
  for (const m of matches) {
    const key = [...(mates.get(m.matchId) ?? [])].filter((p) => regulars.has(p)).sort().join('|');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(m);
  }
  return [...groups]
    .filter(([, g]) => g.length >= minGames)
    .map(([key, g]) => ({ friends: key ? key.split('|') : [], games: g.length, me: kpis(g) }))
    .sort((a, b) => b.games - a.games);
}

// ---------------------------------------------------------------- match history

export interface SessionGroup {
  /** The session's first match: stable while the session grows. */
  id: string;
  /** ISO times of its first and last match. */
  start: string;
  end: string;
  /** Newest first. */
  matches: MatchFact[];
  summary: Kpis;
}

/**
 * Match history by play session (a 2-hour break starts a new one), newest
 * first: a late night stays one group across midnight, and two sittings on
 * the same day are two.
 */
export function groupBySession(matches: MatchFact[]): SessionGroup[] {
  return playSessions(matches).reverse().map((s) => ({
    id: s[0].matchId,
    start: s[0].startedAt,
    end: s[s.length - 1].startedAt,
    matches: [...s].reverse(),
    summary: kpis(s),
  }));
}

/**
 * Matches ordered best first. When every match has an RP delta they're compared
 * on RP (what ranked is scored on); otherwise, and to break ties, on placement,
 * then kills, then damage.
 */
export function rankGames(matches: MatchFact[]): MatchFact[] {
  const byRp = matches.every((m) => m.rpDelta !== null);
  return [...matches].sort((a, b) =>
    (byRp ? b.rpDelta! - a.rpDelta! : 0) || a.placement - b.placement || b.kills - a.kills || b.damage - a.damage);
}

// ---------------------------------------------------------------- legends

export interface LegendRow {
  legend: string;
  games: number;
  /** Share of the selection's matches played on this legend. */
  pickRate: number;
  me: Kpis;
}

/** One row per legend played in the selection, most played first. */
export function legendStats(matches: MatchFact[]): LegendRow[] {
  const byLegend = new Map<string, MatchFact[]>();
  for (const m of matches) {
    let list = byLegend.get(m.legend);
    if (!list) byLegend.set(m.legend, (list = []));
    list.push(m);
  }
  return [...byLegend]
    .map(([legend, list]) => ({ legend, games: list.length, pickRate: list.length / matches.length, me: kpis(list) }))
    .sort((a, b) => b.games - a.games || a.legend.localeCompare(b.legend));
}

// ---------------------------------------------------------------- weapons

export interface WeaponRow {
  weapon: string;
  /** Matches where the weapon did damage or got a kill/knock. */
  matches: number;
  kills: number;
  knocks: number;
  damage: number;
  /** Share of all my damage in the selection. */
  damageShare: number;
}

/** My totals per weapon over the selected matches, most damage first. */
export function weaponStats(data: Dataset, matches: MatchFact[]): WeaponRow[] {
  const ids = new Set(matches.map((m) => m.matchId));
  const acc = new Map<string, WeaponRow>();
  let total = 0;
  for (const w of data.weapons) {
    if (!ids.has(w.matchId)) continue;
    let r = acc.get(w.weapon);
    if (!r) acc.set(w.weapon, (r = { weapon: w.weapon, matches: 0, kills: 0, knocks: 0, damage: 0, damageShare: 0 }));
    r.matches += 1;
    r.kills += w.kills;
    r.knocks += w.knocks;
    r.damage += w.damage;
    total += w.damage;
  }
  return [...acc.values()]
    .map((r) => ({ ...r, damageShare: total ? r.damage / total : 0 }))
    .sort((a, b) => b.damage - a.damage);
}

// ---------------------------------------------------------------- loadouts

export interface LoadoutRow {
  /** The two guns, in class order (e.g. SMG before shotgun); one entry if only one gun was used. */
  weapons: string[];
  games: number;
  me: Kpis;
}

const classRank = (weapon: string) => {
  const i = WEAPON_CLASSES.indexOf(weaponClass(weapon) as (typeof WEAPON_CLASSES)[number]);
  return i < 0 ? WEAPON_CLASSES.length : i;
};

/**
 * A match's loadout: the guns I held longest (MatchFact.loadout), or, for
 * matches without weapon-slot data, the two that did the most damage
 * (grenades and abilities ignored). In class order.
 */
export function matchLoadout(m: Pick<MatchFact, 'loadout'>, guns: { weapon: string; damage: number }[]): string[] {
  const weapons = m.loadout.length ? [...m.loadout] : guns
    .filter((w) => w.weapon !== OTHER_WEAPON)
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 2)
    .map((w) => w.weapon);
  return weapons.sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b));
}

/** My results per loadout in the selection, most played first; every loadout by default. */
export function loadoutStats(data: Dataset, matches: MatchFact[], minGames = 1): LoadoutRow[] {
  return [...loadoutGroups(data, matches)]
    .filter(([, g]) => g.length >= minGames)
    .map(([key, g]) => ({ weapons: key.split('|'), games: g.length, me: kpis(g) }))
    .sort((a, b) => b.games - a.games);
}

export interface GunLoadoutRow {
  weapon: string;
  /** Games where this gun was one of my two. */
  games: number;
  me: Kpis;
  /** The loadouts it was part of, most played first. */
  pairings: LoadoutRow[];
}

/** Loadouts grouped by gun: 31 loadouts in 43 games is too thin to compare, a gun's games aren't. */
export function gunLoadoutStats(data: Dataset, matches: MatchFact[]): GunLoadoutRow[] {
  const groups = loadoutGroups(data, matches);
  const byGun = new Map<string, { games: MatchFact[]; pairings: LoadoutRow[] }>();
  for (const [key, g] of groups) {
    const weapons = key.split('|');
    for (const gun of weapons) {
      let row = byGun.get(gun);
      if (!row) byGun.set(gun, (row = { games: [], pairings: [] }));
      row.games.push(...g);
      row.pairings.push({ weapons, games: g.length, me: kpis(g) });
    }
  }
  return [...byGun]
    .map(([weapon, r]) => ({ weapon, games: r.games.length, me: kpis(r.games), pairings: r.pairings.sort((a, b) => b.games - a.games) }))
    .sort((a, b) => b.games - a.games);
}

/** My matches per loadout ("R-301|EVA-8"); matches without a loadout are left out. */
function loadoutGroups(data: Dataset, matches: MatchFact[]): Map<string, MatchFact[]> {
  const ids = new Set(matches.map((m) => m.matchId));
  const gunsByMatch = new Map<string, { weapon: string; damage: number }[]>();
  for (const w of data.weapons) {
    if (!ids.has(w.matchId)) continue;
    let list = gunsByMatch.get(w.matchId);
    if (!list) gunsByMatch.set(w.matchId, (list = []));
    list.push(w);
  }
  const groups = new Map<string, MatchFact[]>();
  for (const m of matches) {
    const loadout = matchLoadout(m, gunsByMatch.get(m.matchId) ?? []);
    if (!loadout.length) continue;
    const key = loadout.join('|');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(m);
  }
  return groups;
}

// ---------------------------------------------------------------- comps

export interface CompRow {
  /** The three legends, alphabetical (who played what doesn't matter). */
  legends: string[];
  games: number;
  /** Squad-level numbers: me + both teammates. */
  teamKillsPerMatch: number;
  teamKd: number;
  /** My numbers (placement is the squad's; RP is only mine). */
  me: Kpis;
}

/**
 * Stats per three-legend comp, from full premades only (both teammates are
 * regulars): that's when a squad deliberately runs a comp for a few games.
 */
export function compStats(data: Dataset, matches: MatchFact[], regulars: Set<string>, minGames = 3): CompRow[] {
  const mates = new Map<string, TeammateFact[]>();
  for (const t of data.teammates) {
    let list = mates.get(t.matchId);
    if (!list) mates.set(t.matchId, (list = []));
    list.push(t);
  }
  const groups = new Map<string, { matches: MatchFact[]; kills: number; deaths: number }>();
  for (const m of matches) {
    const squad = mates.get(m.matchId) ?? [];
    if (squad.length !== 2 || !squad.every((t) => regulars.has(t.playerKey))) continue;
    const key = [m.legend, ...squad.map((t) => t.legend)].sort().join('|');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { matches: [], kills: 0, deaths: 0 }));
    g.matches.push(m);
    g.kills += m.kills + squad.reduce((s, t) => s + t.kills, 0);
    g.deaths += m.deaths + squad.reduce((s, t) => s + t.deaths, 0);
  }
  return [...groups]
    .filter(([, g]) => g.matches.length >= minGames)
    .map(([key, g]) => ({
      legends: key.split('|'),
      games: g.matches.length,
      teamKillsPerMatch: g.kills / g.matches.length,
      teamKd: g.kills / Math.max(g.deaths, 1),
      me: kpis(g.matches),
    }))
    .sort((a, b) => b.games - a.games);
}
