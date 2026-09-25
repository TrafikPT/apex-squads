import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Dataset, MatchFact } from '../src/ui/facts';
import { generateMockData } from '../src/ui/mock-data';
import { compStats, DEFAULT_FILTERS, filterMatches, groupByDay, kpis, legendStats, loadoutStats, matchLoadout, rankedAccount, rankGames, regularPlayers, rpByDay, squadStats, teammateStats, weaponStats } from '../src/ui/stats';
import { niceTicks } from '../src/ui/format';
import { divisionFloors, rankName, rankOf } from '../src/ui/ranks';
import { weaponClass } from '../src/ui/weapons';

const NOW = new Date(2026, 8, 24, 23, 0); // 24 Sep 2026, local time

function match(id: string, startedAt: Date, patch: Partial<MatchFact> = {}): MatchFact {
  return {
    matchId: id, accountKey: 'a1', startedAt: startedAt.toISOString(), mode: 'ranked', map: 'Olympus',
    legend: 'Bangalore', placement: 10, teams: 20, kills: 2, assists: 1, knocks: 3, deaths: 1, damage: 800,
    revivesGiven: 0, revivesReceived: 0, rpDelta: 10, rpAfter: null, rpEstimated: false, loadout: [], squadKey: '', ...patch,
  };
}

function dataset(matches: MatchFact[], mates: [string, string, number?, string?][] = []): Dataset {
  return {
    accounts: [], players: [], matches, weapons: [], seasons: [], seasonStart: '2026-08-01',
    teammates: mates.map(([matchId, playerKey, kills = 1, legend = 'Wraith']) => ({ matchId, playerKey, legend, kills, knocks: kills, deaths: 1 })),
  };
}

test('period presets include today and count whole days back', () => {
  const data = dataset([
    match('today', new Date(2026, 8, 24, 20)),
    match('day7', new Date(2026, 8, 18, 1)), // 7th day back, counting today
    match('day8', new Date(2026, 8, 17, 23)),
  ]);
  const ids = filterMatches(data, { ...DEFAULT_FILTERS, period: '7d' }, NOW).map((m) => m.matchId);
  assert.deepEqual(ids, ['today', 'day7']);
});

test('custom range is inclusive of both end dates', () => {
  const data = dataset([
    match('before', new Date(2026, 8, 9, 23)),
    match('first', new Date(2026, 8, 10, 0, 30)),
    match('last', new Date(2026, 8, 12, 23, 59)),
    match('after', new Date(2026, 8, 13, 0, 1)),
  ]);
  const f = { ...DEFAULT_FILTERS, period: 'custom' as const, from: '2026-09-10', to: '2026-09-12' };
  assert.deepEqual(filterMatches(data, f, NOW).map((m) => m.matchId), ['first', 'last']);
});

test('"played with" requires every selected teammate', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset(
    [match('ab', d), match('a', d), match('b', d)],
    [['ab', 'A'], ['ab', 'B'], ['a', 'A'], ['a', 'R1'], ['b', 'B'], ['b', 'R2']],
  );
  const run = (withPlayers: string[]) =>
    filterMatches(data, { ...DEFAULT_FILTERS, period: 'all', withPlayers }, NOW).map((m) => m.matchId);
  assert.deepEqual(run(['A']), ['ab', 'a']);
  assert.deepEqual(run(['A', 'B']), ['ab']);
});

test('dimension filters combine', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset([
    match('1', d, { legend: 'Wraith' }),
    match('2', d, { legend: 'Wraith', mode: 'pubs', rpDelta: null }),
    match('3', d, { legend: 'Wraith', accountKey: 'a2' }),
    match('4', d),
  ]);
  const f = { ...DEFAULT_FILTERS, period: 'all' as const, legend: 'Wraith', account: 'a1' };
  assert.deepEqual(filterMatches(data, f, NOW).map((m) => m.matchId), ['1']);
});

test('kpis average over matches; RP only over ranked ones', () => {
  const d = new Date(2026, 8, 20);
  const k = kpis([
    match('1', d, { placement: 1, kills: 4, damage: 1200, rpDelta: 150 }),
    match('2', d, { placement: 9, kills: 0, damage: 400, rpDelta: -25 }),
    match('3', d, { placement: 5, kills: 2, damage: 800, mode: 'pubs', rpDelta: null }),
  ]);
  assert.equal(k.matches, 3);
  assert.equal(k.avgPlacement, 5);
  assert.equal(k.avgKills, 2);
  assert.equal(k.avgDamage, 800);
  assert.equal(k.winRate, 1 / 3);
  assert.equal(k.top5Rate, 2 / 3);
  assert.equal(k.rpNet, 125);
  assert.equal(k.rpMatches, 2);
});

test('K/D divides total kills by total deaths', () => {
  const d = new Date(2026, 8, 20);
  assert.equal(kpis([match('1', d, { kills: 5, deaths: 0 }), match('2', d, { kills: 1, deaths: 2 })]).kd, 3);
  assert.equal(kpis([match('1', d, { kills: 4, deaths: 0 })]).kd, 4, 'no deaths: K/D is the kill count');
});

test('kpis of an empty selection are empty, not zero', () => {
  const k = kpis([]);
  assert.equal(k.avgPlacement, null);
  assert.equal(k.kd, null);
  assert.equal(k.rpNet, null);
});

test('rpByDay sums per local day and keeps a running total', () => {
  const pts = rpByDay([
    match('1', new Date(2026, 8, 21, 22), { rpDelta: 40 }),
    match('2', new Date(2026, 8, 20, 21), { rpDelta: -20 }),
    match('3', new Date(2026, 8, 21, 23), { rpDelta: 10 }),
    match('4', new Date(2026, 8, 21, 23), { rpDelta: null, mode: 'pubs' }),
  ]);
  assert.deepEqual(pts, [
    { day: '2026-09-20', delta: -20, cumulative: -20, level: null, matches: 1 },
    { day: '2026-09-21', delta: 50, cumulative: 30, level: null, matches: 2 },
  ]);
});

test('mock data is deterministic and internally consistent', () => {
  const a = generateMockData(NOW);
  const b = generateMockData(NOW);
  assert.deepEqual(a, b);
  assert.ok(a.matches.length > 100);
  const ids = new Set(a.matches.map((m) => m.matchId));
  for (const t of a.teammates) assert.ok(ids.has(t.matchId));
  for (const m of a.matches) {
    assert.equal(a.teammates.filter((t) => t.matchId === m.matchId).length, 2);
    assert.equal(m.rpDelta === null, m.mode !== 'ranked');
    assert.ok(Date.parse(m.startedAt) <= NOW.getTime());
    const guns = a.weapons.filter((w) => w.matchId === m.matchId);
    assert.equal(guns.reduce((s, w) => s + w.damage, 0), m.damage, 'weapon damage adds up to match damage');
    assert.equal(guns.reduce((s, w) => s + w.kills, 0), m.kills, 'weapon kills add up to match kills');
  }
});

test('regular players are teammates with enough games overall', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset([match('1', d), match('2', d), match('3', d)],
    [['1', 'F'], ['2', 'F'], ['3', 'F'], ['1', 'R1'], ['2', 'R2'], ['3', 'R2']]);
  assert.deepEqual([...regularPlayers(data, 3)], ['F']);
  assert.deepEqual([...regularPlayers(data, 2)].sort(), ['F', 'R2']);
});

test('teammate stats: their kills per game, top legend, and my numbers with them', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset(
    [match('1', d, { placement: 2 }), match('2', d, { placement: 4 }), match('3', d, { placement: 9 }), match('4', d, { placement: 20 })],
    [['1', 'F', 3, 'Lifeline'], ['2', 'F', 1, 'Lifeline'], ['3', 'F', 2, 'Wraith'], ['4', 'R', 0]],
  );
  const rows = teammateStats(data, data.matches, new Set(['F']));
  assert.equal(rows.length, 1);
  const [f] = rows;
  assert.equal(f.playerKey, 'F');
  assert.equal(f.games, 3);
  assert.equal(f.killsPerGame, 2);
  assert.equal(f.kd, 2, '6 kills over 3 deaths');
  assert.equal(f.topLegend, 'Lifeline');
  assert.equal(f.me.avgPlacement, 5, 'match 4 without F is excluded');
});

test('teammate stats only count matches in the selection', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset([match('1', d), match('2', d), match('3', d)], [['1', 'F'], ['2', 'F'], ['3', 'F']]);
  assert.equal(teammateStats(data, data.matches.slice(0, 2), new Set(['F']), 1)[0].games, 2);
});

test('squad stats group by friends in the squad, ignoring randoms', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset(
    [match('ab1', d, { placement: 1 }), match('ab2', d, { placement: 3 }), match('a1', d), match('solo', d, { placement: 15 })],
    [['ab1', 'A'], ['ab1', 'B'], ['ab2', 'B'], ['ab2', 'A'], ['a1', 'A'], ['a1', 'R1'], ['solo', 'R2'], ['solo', 'R3']],
  );
  const rows = squadStats(data, data.matches, new Set(['A', 'B']), 1);
  const byKey = new Map(rows.map((r) => [r.friends.join('+'), r]));
  assert.equal(byKey.get('A+B')?.games, 2);
  assert.equal(byKey.get('A+B')?.me.avgPlacement, 2);
  assert.equal(byKey.get('A')?.games, 1);
  assert.equal(byKey.get('')?.me.avgPlacement, 15, 'solo queue row has no friends');
  assert.equal(rows[0].friends.join('+'), 'A+B', 'most games first');
});

test('groupByDay: newest day first, newest match first, with a summary', () => {
  const groups = groupByDay([
    match('a', new Date(2026, 8, 20, 21), { rpDelta: 30 }),
    match('b', new Date(2026, 8, 21, 20), { rpDelta: -10 }),
    match('c', new Date(2026, 8, 20, 23), { rpDelta: 5 }),
  ]);
  assert.deepEqual(groups.map((g) => g.day), ['2026-09-21', '2026-09-20']);
  assert.deepEqual(groups[1].matches.map((m) => m.matchId), ['c', 'a']);
  assert.equal(groups[1].summary.rpNet, 35);
});

test('legendStats: games, pick rate and my numbers per legend', () => {
  const d = new Date(2026, 8, 20);
  const rows = legendStats([
    match('1', d, { legend: 'Wraith', placement: 2 }),
    match('2', d, { legend: 'Wraith', placement: 6 }),
    match('3', d, { legend: 'Bangalore', placement: 10 }),
    match('4', d, { legend: 'Wraith', placement: 1 }),
  ]);
  assert.deepEqual(rows.map((r) => [r.legend, r.games, r.pickRate]), [['Wraith', 3, 0.75], ['Bangalore', 1, 0.25]]);
  assert.equal(rows[0].me.avgPlacement, 3);
});

test('weaponStats: totals per weapon over selected matches only, with damage share', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset([match('1', d), match('2', d), match('3', d)]);
  data.weapons = [
    { matchId: '1', weapon: 'R-99', kills: 2, knocks: 3, damage: 600 },
    { matchId: '1', weapon: 'Other', kills: 0, knocks: 0, damage: 100 },
    { matchId: '2', weapon: 'R-99', kills: 1, knocks: 1, damage: 300 },
    { matchId: '3', weapon: 'Mastiff', kills: 9, knocks: 9, damage: 5000 },
  ];
  const rows = weaponStats(data, data.matches.slice(0, 2));
  assert.deepEqual(rows.map((r) => [r.weapon, r.matches, r.kills, r.damage]), [['R-99', 2, 3, 900], ['Other', 1, 0, 100]]);
  assert.equal(rows[0].damageShare, 0.9);
});

test('weapon classes: known guns map to a class, anything else is Other', () => {
  assert.equal(weaponClass('R-99'), 'SMG');
  assert.equal(weaponClass('30-30 Repeater'), 'Marksman');
  assert.equal(weaponClass('Some New Gun'), 'Other');
});

test('matchLoadout: the guns held longest, in class order', () => {
  assert.deepEqual(matchLoadout({ loadout: ['Peacekeeper', 'R-301'] }, [{ weapon: 'Kraber', damage: 900 }]), ['R-301', 'Peacekeeper']);
});

test('matchLoadout without slot data: top two guns by damage, grenades ignored, in class order', () => {
  const none = { loadout: [] };
  assert.deepEqual(matchLoadout(none, [
    { weapon: 'Peacekeeper', damage: 400 },
    { weapon: 'Other', damage: 900 },
    { weapon: 'R-99', damage: 300 },
    { weapon: 'Wingman', damage: 50 },
  ]), ['R-99', 'Peacekeeper'], 'SMG before shotgun; Wingman (3rd) and grenades dropped');
  assert.deepEqual(matchLoadout(none, [{ weapon: 'Kraber', damage: 100 }]), ['Kraber']);
  assert.deepEqual(matchLoadout(none, []), []);
});

test('loadoutStats groups matches by loadout with my numbers', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset([
    match('1', d, { kills: 4, deaths: 1 }), match('2', d, { kills: 2, deaths: 1 }), match('3', d, { kills: 9, deaths: 0 }),
  ]);
  data.weapons = [
    { matchId: '1', weapon: 'R-99', kills: 3, knocks: 3, damage: 700 },
    { matchId: '1', weapon: 'Peacekeeper', kills: 1, knocks: 1, damage: 300 },
    { matchId: '2', weapon: 'Peacekeeper', kills: 2, knocks: 2, damage: 500 },
    { matchId: '2', weapon: 'R-99', kills: 0, knocks: 0, damage: 100 },
    { matchId: '3', weapon: 'Kraber', kills: 9, knocks: 9, damage: 1500 },
  ];
  const rows = loadoutStats(data, data.matches, 1);
  assert.deepEqual(rows.map((r) => [r.weapons.join('+'), r.games]), [['R-99+Peacekeeper', 2], ['Kraber', 1]]);
  assert.equal(rows[0].me.kd, 3);
});

test('compStats: full premades only, legends as a set, team kills and K/D', () => {
  const d = new Date(2026, 8, 20);
  const data = dataset(
    [
      match('p1', d, { legend: 'Bangalore', kills: 3, deaths: 1, placement: 2 }),
      match('p2', d, { legend: 'Gibraltar', kills: 1, deaths: 1, placement: 4 }),
      match('rnd', d, { legend: 'Bangalore', kills: 9, deaths: 0 }),
    ],
    [
      ['p1', 'A', 2, 'Gibraltar'], ['p1', 'B', 1, 'Wraith'],
      // Same three legends, different owners: still the same comp.
      ['p2', 'A', 4, 'Bangalore'], ['p2', 'B', 0, 'Wraith'],
      ['rnd', 'A', 1, 'Gibraltar'], ['rnd', 'R', 1, 'Wraith'],
    ],
  );
  const rows = compStats(data, data.matches, new Set(['A', 'B']), 1);
  assert.equal(rows.length, 1, 'the match with a random is not a premade');
  const [c] = rows;
  assert.deepEqual(c.legends, ['Bangalore', 'Gibraltar', 'Wraith']);
  assert.equal(c.games, 2);
  assert.equal(c.teamKillsPerMatch, (3 + 2 + 1 + 1 + 4 + 0) / 2);
  assert.equal(c.teamKd, 11 / 6, 'each teammate died once per match in the fixture');
  assert.equal(c.me.avgPlacement, 3);
});

test('rankGames: RP first when every match has it, else placement, kills, damage', () => {
  const t = new Date(2026, 8, 20);
  const ranked = [
    match('win', t, { placement: 1, rpDelta: 80 }),
    match('bigKills', t, { placement: 4, kills: 9, rpDelta: 95 }),
    match('loss', t, { placement: 18, rpDelta: -35 }),
    match('tieLowDmg', t, { placement: 18, rpDelta: -35, damage: 100 }),
  ];
  assert.deepEqual(rankGames(ranked).map((m) => m.matchId), ['bigKills', 'win', 'loss', 'tieLowDmg']);

  const mixed = [...ranked, match('pubs', t, { mode: 'pubs', placement: 2, rpDelta: null })];
  assert.deepEqual(rankGames(mixed).map((m) => m.matchId), ['win', 'pubs', 'bigKills', 'loss', 'tieLowDmg']);
});

test('niceTicks: whole numbers without duplicates or -0, even for tiny ranges', () => {
  assert.deepEqual(niceTicks(-2, 0, 4), [-2, -1, 0]);
  assert.ok(!Object.is(niceTicks(-2, 0, 4)[2], -0));
  assert.deepEqual(niceTicks(0, 1, 4), [0, 1]);
  assert.deepEqual(niceTicks(-1000, 3000, 4), [-1000, 0, 1000, 2000, 3000]);
});

test('rpByDay: the level is the RP after the day\'s last match', () => {
  const points = rpByDay([
    match('late', new Date(2026, 8, 20, 23), { rpDelta: -20, rpAfter: 6_080 }),
    match('early', new Date(2026, 8, 20, 19), { rpDelta: 100, rpAfter: 6_100 }),
    match('unknown', new Date(2026, 8, 21, 19), { rpDelta: 30, rpAfter: null }),
  ]);
  assert.deepEqual(points.map((p) => [p.day, p.cumulative, p.level]), [['2026-09-20', 80, 6_080], ['2026-09-21', 110, null]]);
});

test('rankedAccount: only when every ranked match is on one account', () => {
  const t = new Date(2026, 8, 20);
  assert.equal(rankedAccount([match('a', t), match('pubs', t, { accountKey: 'a2', rpDelta: null })]), 'a1');
  assert.equal(rankedAccount([match('a', t), match('b', t, { accountKey: 'a2' })]), null);
  assert.equal(rankedAccount([]), null);
});

test('ranks: Season 30 thresholds, uneven divisions, names and floors', () => {
  assert.deepEqual(rankOf(0), { tier: 'Rookie', division: 4, floor: 0, next: 250 });
  assert.deepEqual(rankOf(5_499), { tier: 'Silver', division: 1, floor: 4_500, next: 5_500 });
  assert.deepEqual(rankOf(5_500), { tier: 'Gold', division: 4, floor: 5_500, next: 6_250 });
  assert.deepEqual(rankOf(10_999), { tier: 'Platinum', division: 2, floor: 10_000, next: 11_000 });
  assert.deepEqual(rankOf(11_000), { tier: 'Platinum', division: 1, floor: 11_000, next: 12_000 });
  assert.deepEqual(rankOf(20_000), { tier: 'Master', division: null, floor: 16_000, next: null });
  // What the apexlegendsstatus API called these RP values.
  assert.equal(rankName(rankOf(8_408).tier, rankOf(8_408).division), 'Gold I');
  assert.equal(rankName(rankOf(8_642).tier, rankOf(8_642).division), 'Platinum IV');
  assert.equal(rankName('Gold', 2), 'Gold II');
  assert.equal(rankName('Master', null), 'Master');
  assert.deepEqual(divisionFloors(5_000, 8_500), [5_500, 6_250, 7_000, 7_750, 8_500]);
});
