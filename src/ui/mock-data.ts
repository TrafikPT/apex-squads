/**
 * Deterministic fake history (≈4 months) for building and demoing the UI
 * before real recordings exist. Numbers are plausible, not realistic.
 */
import type { Account, Dataset, MatchFact, Player, SeasonFact, TeammateFact, WeaponFact } from './facts';
import { rankOf } from './ranks';

const DAY_MS = 86_400_000;

const ACCOUNTS: Account[] = [
  { accountKey: 'acc-main', alias: 'Main', name: 'NightOwl_PT' },
  { accountKey: 'acc-alt', alias: 'Alt', name: 'OwlAlt' },
  { accountKey: 'acc-smurf', alias: 'Smurf', name: 'quietfeathers' },
];
/** RP when the history starts; each account climbs from there. */
const START_RP: Record<string, number> = { 'acc-main': 6_000, 'acc-alt': 4_500, 'acc-smurf': 2_000 };
/** At the season start RP drops to this share (a soft reset). */
const SEASON_RESET = 0.6;

const FRIENDS: Player[] = [
  { playerKey: 'p-rook', name: 'Rook' },
  { playerKey: 'p-nyx', name: 'Nyx_77' },
  { playerKey: 'p-mari', name: 'MarianaGG' },
  { playerKey: 'p-tiago', name: 'tiagoo' },
  { playerKey: 'p-kaiser', name: 'Kaiser' },
];

const LEGENDS = [
  'Bangalore', 'Wraith', 'Pathfinder', 'Bloodhound', 'Octane', 'Lifeline',
  'Horizon', 'Valkyrie', 'Gibraltar', 'Caustic', 'Crypto', 'Newcastle',
];
const MY_LEGENDS: [string, number][] = [
  ['Bangalore', 30], ['Bloodhound', 20], ['Pathfinder', 18], ['Horizon', 12],
  ['Wraith', 8], ['Octane', 7], ['Newcastle', 5],
];
/** Friends mostly stick to a couple of legends. */
const FRIEND_LEGENDS: Record<string, string[]> = {
  'p-rook': ['Gibraltar', 'Newcastle'],
  'p-nyx': ['Wraith', 'Octane'],
  'p-mari': ['Lifeline'],
  'p-tiago': ['Caustic', 'Crypto'],
  'p-kaiser': ['Valkyrie', 'Horizon'],
};
/** Favourite two-gun loadouts (most matches), otherwise a random primary + secondary. */
const LOADOUTS: [[string, string], number][] = [
  [['R-99', 'Peacekeeper'], 30], [['R-301', 'Wingman'], 16], [['Flatline', 'Mastiff'], 12], [['Volt', 'EVA-8'], 10],
  [['R-301', '30-30 Repeater'], 8], [['Havoc', 'Peacekeeper'], 6], [['Nemesis', 'Sentinel'], 5],
];
const PRIMARIES: [string, number][] = [['R-99', 30], ['R-301', 22], ['Flatline', 14], ['Volt', 12], ['Alternator', 8], ['Havoc', 7], ['Nemesis', 7]];
const SECONDARIES: [string, number][] = [['Peacekeeper', 28], ['Mastiff', 20], ['EVA-8', 14], ['Wingman', 14], ['30-30 Repeater', 10], ['Sentinel', 8], ['Triple Take', 6]];
const MAPS = ["World's Edge", 'Storm Point', 'Kings Canyon', 'Olympus', 'Broken Moon', 'E-District'];

/** Common premades: which friends, and how well that squad performs (lower = better placement). */
const SQUADS: { friends: string[]; weight: number; skill: number }[] = [
  { friends: [], weight: 25, skill: 1.0 }, // solo queue with randoms
  { friends: ['p-rook'], weight: 18, skill: 0.85 },
  { friends: ['p-nyx'], weight: 12, skill: 0.95 },
  { friends: ['p-mari'], weight: 8, skill: 0.9 },
  { friends: ['p-rook', 'p-nyx'], weight: 16, skill: 0.7 },
  { friends: ['p-rook', 'p-mari'], weight: 8, skill: 0.8 },
  { friends: ['p-tiago', 'p-kaiser'], weight: 6, skill: 1.05 },
  { friends: ['p-tiago'], weight: 7, skill: 1.1 },
];

const RANDOM_NAMES = [
  'xX_Drift_Xx', 'lagmonster', 'pixelpanda', 'TTV_scarlet', 'b0ngo', 'CrunchyLeaf',
  'vortexx', 'MilkyMoose', 'd3adeye', 'SunnyDaze', 'RuneBear', 'glitchgoblin',
];

// Ranked RP, loosely modelled on a mid-tier lobby.
const ENTRY_COST = -48;
const PLACEMENT_RP = [125, 95, 70, 55, 45, 30, 20, 10, 10, 10];
const RP_PER_KILL = 9;
const KP_CAP = 6;
/** The season being played in the sample; the five before it come as history. */
const CURRENT_SEASON = 30;

export function generateMockData(now = new Date(), seed = 7): Dataset {
  const rnd = mulberry32(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const weighted = <T>(xs: readonly [T, number][]) => {
    let r = rnd() * xs.reduce((s, [, w]) => s + w, 0);
    for (const [x, w] of xs) if ((r -= w) <= 0) return x;
    return xs[xs.length - 1][0];
  };
  const poisson = (mean: number) => {
    let k = 0;
    for (let p = Math.exp(-mean), s = p, u = rnd(); u > s; k++) s += p *= mean / (k + 1);
    return k;
  };

  const players: Player[] = [...FRIENDS];
  const randomPlayer = (): Player => {
    const p = { playerKey: `p-rnd-${players.length}`, name: `${pick(RANDOM_NAMES)}${Math.floor(rnd() * 90) + 10}` };
    players.push(p);
    return p;
  };

  const matches: MatchFact[] = [];
  const teammates: TeammateFact[] = [];
  const weapons: WeaponFact[] = [];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = 120;
  const seasonStart = today - 50 * DAY_MS;
  const rp = new Map(Object.entries(START_RP));
  const resetDone = new Set<string>();

  for (let d = days; d >= 0; d--) {
    if (rnd() > 0.55) continue; // not every day is a play day
    const dayStart = today - d * DAY_MS;
    const account = weighted<Account>([[ACCOUNTS[0], 70], [ACCOUNTS[1], 20], [ACCOUNTS[2], 10]]);
    const squad = weighted(SQUADS.map((s) => [s, s.weight] as [typeof s, number]));
    const dayMap = pick(MAPS);
    let t = dayStart + (18 + rnd() * 4) * 3_600_000; // evening sessions
    const count = 2 + Math.floor(rnd() * 7);

    for (let i = 0; i < count; i++) {
      t += (14 + rnd() * 12) * 60_000;
      if (t > now.getTime()) break;
      const mode = rnd() < 0.85 ? 'ranked' : 'pubs';
      // In a full premade I mostly stick to my comp legends; otherwise anything goes.
      const legend = squad.friends.length === 2 && rnd() < 0.75
        ? weighted<string>([['Bangalore', 5], ['Bloodhound', 3], ['Pathfinder', 2]])
        : weighted(MY_LEGENDS);
      const skill = squad.skill * (account.accountKey === 'acc-smurf' ? 0.8 : 1);
      const placement = Math.min(20, Math.max(1, Math.round(1 + Math.abs(normal(rnd)) * 9 * skill)));
      const survived = (21 - placement) / 20; // 0..1, longer games → more fights
      const kills = poisson(0.5 + 2.6 * survived / skill);
      const assists = poisson(0.4 + 1.5 * survived);
      const knocks = kills + poisson(0.8);
      // Champions usually don't die; otherwise once, twice if respawned and killed again.
      const deaths = placement === 1 && rnd() < 0.8 ? 0 : 1 + (rnd() < 0.12 ? 1 : 0);
      const damage = Math.round(kills * 230 + assists * 90 + rnd() * 380 + survived * 250);

      const mates: Player[] = [
        ...squad.friends.map((k) => FRIENDS.find((f) => f.playerKey === k)!),
      ];
      while (mates.length < 2) mates.push(randomPlayer());
      const matchId = `m-${matches.length.toString().padStart(5, '0')}`;
      const mateLegends = LEGENDS.filter((l) => l !== legend);
      for (const mate of mates) {
        const mk = poisson(0.5 + 2.4 * survived);
        const favourites = (FRIEND_LEGENDS[mate.playerKey] ?? []).filter((l) => l !== legend);
        teammates.push({
          matchId,
          playerKey: mate.playerKey,
          legend: favourites.length && rnd() < 0.8 ? pick(favourites) : pick(mateLegends),
          kills: mk,
          knocks: mk + poisson(0.6),
          deaths: placement === 1 && rnd() < 0.8 ? 0 : 1 + (rnd() < 0.12 ? 1 : 0),
        });
      }

      // Split my kills/knocks/damage over the two guns; ~8% of damage from grenades/abilities.
      const [primary, secondary] = rnd() < 0.85 ? weighted(LOADOUTS) : [weighted(PRIMARIES), weighted(SECONDARIES)];
      const share = 0.45 + rnd() * 0.3;
      const other = Math.round(damage * (0.04 + rnd() * 0.08));
      const primaryDamage = Math.round((damage - other) * share);
      const primaryKills = Math.round(kills * share);
      const primaryKnocks = Math.round(knocks * share);
      weapons.push(
        { matchId, weapon: primary, kills: primaryKills, knocks: primaryKnocks, damage: primaryDamage },
        { matchId, weapon: secondary, kills: kills - primaryKills, knocks: knocks - primaryKnocks, damage: damage - other - primaryDamage },
      );
      if (other) weapons.push({ matchId, weapon: 'Other', kills: 0, knocks: 0, damage: other });

      let rpDelta: number | null = null;
      let rpAfter: number | null = null;
      if (mode === 'ranked') {
        rpDelta = ENTRY_COST + (PLACEMENT_RP[placement - 1] ?? 0) +
          Math.min(kills + assists, KP_CAP) * RP_PER_KILL;
        let level = rp.get(account.accountKey)!;
        if (t >= seasonStart && !resetDone.has(account.accountKey)) {
          resetDone.add(account.accountKey);
          level = Math.round(level * SEASON_RESET);
        }
        rpAfter = Math.max(0, level + rpDelta);
        rp.set(account.accountKey, rpAfter);
      }

      matches.push({
        matchId,
        accountKey: account.accountKey,
        startedAt: new Date(t).toISOString(),
        mode,
        map: mode === 'ranked' ? dayMap : pick(MAPS),
        legend,
        placement,
        teams: 20,
        kills,
        assists,
        knocks,
        deaths,
        damage,
        revivesGiven: poisson(0.5),
        revivesReceived: poisson(0.4),
        rpDelta,
        rpAfter,
        rpEstimated: false,
        loadout: [],
        squadKey: mates.map((m) => m.playerKey).sort().join('|'),
      });
    }
  }

  return {
    accounts: ACCOUNTS.map((a) => {
      const r = rankOf(rp.get(a.accountKey)!);
      return { ...a, rank: { tier: r.tier, division: r.division, rp: rp.get(a.accountKey)! } };
    }),
    players,
    matches,
    teammates,
    weapons,
    seasons: ACCOUNTS.flatMap((a) => mockSeasons(a.accountKey, rp.get(a.accountKey)!, mulberry32(seed + a.accountKey.length))),
    seasonStart: new Date(seasonStart).toISOString().slice(0, 10),
  };
}

/** Six seasons of plausible totals, climbing slowly towards the current RP. */
function mockSeasons(accountKey: string, rpNow: number, rnd: () => number): SeasonFact[] {
  return Array.from({ length: 6 }, (_, i) => {
    const season = CURRENT_SEASON - 5 + i;
    const current = season === CURRENT_SEASON;
    const games = Math.round((current ? 80 : 200) + rnd() * 150);
    const kd = 0.9 + i * 0.05 + rnd() * 0.3;
    const deaths = Math.round(games * (0.9 + rnd() * 0.2));
    const rp = current ? rpNow : Math.round(rpNow * (0.8 + i * 0.05) + (rnd() - 0.5) * 1_500);
    return {
      accountKey, season, current, games,
      wins: Math.round(games * (0.02 + rnd() * 0.04)),
      top5s: Math.round(games * (0.2 + rnd() * 0.1)),
      kills: Math.round(deaths * kd),
      deaths,
      assists: Math.round(games * (0.5 + rnd() * 0.4)),
      knocks: Math.round(deaths * kd * 1.4),
      damage: Math.round(games * (650 + i * 30 + rnd() * 200)),
      mostKills: 6 + Math.floor(rnd() * 6),
      mostDamage: 2_600 + Math.round(rnd() * 1_400),
      revived: Math.round(games * (0.15 + rnd() * 0.15)),
      respawned: Math.round(games * (0.1 + rnd() * 0.15)),
      rp,
      peakRp: current ? rpNow + Math.round(rnd() * 400) : null,
    };
  });
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rnd: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
}
