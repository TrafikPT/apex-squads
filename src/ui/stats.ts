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

export interface RpPoint {
  day: string; // YYYY-MM-DD (local)
  delta: number;
  cumulative: number;
  /** RP after the day's last match with a known level; null when none had one. */
  level: number | null;
  matches: number;
}

/** Net RP per play day, its running total and the RP level reached, oldest first. */
export function rpByDay(matches: MatchFact[]): RpPoint[] {
  const byDay = new Map<string, { delta: number; matches: number; level: number | null; at: string }>();
  for (const m of matches) {
    if (m.rpDelta === null) continue;
    const day = toLocalDay(new Date(m.startedAt));
    const cur = byDay.get(day) ?? { delta: 0, matches: 0, level: null, at: '' };
    cur.delta += m.rpDelta;
    cur.matches += 1;
    if (m.rpAfter !== null && m.startedAt > cur.at) {
      cur.level = m.rpAfter;
      cur.at = m.startedAt;
    }
    byDay.set(day, cur);
  }
  let cumulative = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, delta: v.delta, cumulative: (cumulative += v.delta), level: v.level, matches: v.matches }));
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
    .filter(([, games]) => games > 1)
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

export interface DayGroup {
  day: string; // YYYY-MM-DD (local)
  /** Newest first. */
  matches: MatchFact[];
  summary: Kpis;
}

/** Matches grouped by local play day, newest day first. */
export function groupByDay(matches: MatchFact[]): DayGroup[] {
  const days = new Map<string, MatchFact[]>();
  for (const m of [...matches].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    const day = toLocalDay(new Date(m.startedAt));
    let list = days.get(day);
    if (!list) days.set(day, (list = []));
    list.push(m);
  }
  return [...days].map(([day, list]) => ({ day, matches: list, summary: kpis(list) }));
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
 * A match's loadout: the two guns that did the most damage in it (grenades and
 * abilities ignored). Simple on purpose; mid-match swaps count toward whichever
 * two guns were actually used most (DESIGN.md §5).
 */
export function matchLoadout(guns: { weapon: string; damage: number }[]): string[] {
  return guns
    .filter((w) => w.weapon !== OTHER_WEAPON)
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 2)
    .map((w) => w.weapon)
    .sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b));
}

/** My results per loadout in the selection, most played first. */
export function loadoutStats(data: Dataset, matches: MatchFact[], minGames = 3): LoadoutRow[] {
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
    const loadout = matchLoadout(gunsByMatch.get(m.matchId) ?? []);
    if (!loadout.length) continue;
    const key = loadout.join('|');
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(m);
  }
  return [...groups]
    .filter(([, g]) => g.length >= minGames)
    .map(([key, g]) => ({ weapons: key.split('|'), games: g.length, me: kpis(g) }))
    .sort((a, b) => b.games - a.games);
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
