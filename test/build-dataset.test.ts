import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { buildDataset } from '../src/build-dataset';
import type { RecordLine } from '../src/recorder';
import { readRecordings } from '../src/recordings';

// ---------------------------------------------------------------- real matches (fixtures/recordings, anonymized)

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'recordings');
const realLines = readRecordings([FIXTURES]);
const real = buildDataset(realLines);
const d = real.dataset;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

test('real: every recorded match is built, as ranked, for one account', () => {
  assert.equal(d.matches.length, 23);
  assert.equal(real.incomplete, 0);
  assert.ok(d.matches.every((m) => m.mode === 'ranked'));
  assert.equal(d.accounts.length, 1);
  assert.equal(d.accounts[0].rank?.tier, 'Platinum');
});

test('real: my kills and assists equal the final scoreboard (tabs) of each match', () => {
  for (const m of d.matches) {
    const tabs = realLines
      .filter((l) => l.match_id === m.matchId && l.key === 'tabs' && typeof l.value === 'string')
      .map((l) => JSON.parse(l.value as string) as { kills: number; assists: number } | null)
      .filter((t) => t !== null)
      .pop()!;
    assert.equal(m.kills, tabs.kills, m.matchId);
    assert.equal(m.assists, tabs.assists, m.matchId);
  }
});

test('real: per-weapon kills, knocks and damage add up to the match totals', () => {
  assert.equal(sum(d.weapons, (w) => w.kills), sum(d.matches, (m) => m.kills));
  assert.equal(sum(d.weapons, (w) => w.knocks), sum(d.matches, (m) => m.knocks));
  assert.ok(Math.abs(sum(d.weapons, (w) => w.damage) - sum(d.matches, (m) => m.damage)) <= d.weapons.length);
});

test('real: legend select and map arrive before the match id but are still attributed', () => {
  assert.ok(d.matches.every((m) => m.legend === 'Sparrow'));
  assert.deepEqual([...new Set(d.matches.map((m) => m.map))].sort(), ['Broken Moon', "World's Edge"]);
  assert.ok(d.teammates.every((t) => t.legend !== 'Unknown'));
});

test('real: teammates are keyed on their platform ID, with the friend kept by name', () => {
  assert.ok(d.matches.every((m) => m.squadKey.split('|').length === 2));
  const friend = d.players.find((p) => p.name.includes('santoznma'));
  assert.ok(friend);
  assert.equal(d.teammates.filter((t) => t.playerKey === friend.playerKey).length, 18);
});

test('real: RP change per match comes from the season stats snapshots', () => {
  const first = d.matches[0];
  assert.equal(first.rpDelta, 85);
  assert.equal(first.rpAfter, 8766);
  // Within a day, each match starts from where the previous one ended.
  const rated = d.matches.filter((m) => m.rpDelta !== null && !m.rpEstimated && m.startedAt.startsWith('2026-09-24'));
  for (let i = 1; i < rated.length; i++) {
    assert.equal(rated[i].rpAfter! - rated[i].rpDelta!, rated[i - 1].rpAfter, rated[i].matchId);
  }
});

test('real: stats sent before the match summary still count for that match', () => {
  // The #2 finish: its new RP arrived 12 s before its summary line.
  const second = d.matches.find((m) => m.placement === 2)!;
  assert.deepEqual([second.rpDelta, second.rpAfter, second.rpEstimated], [142, 8642, false]);
});

// ---------------------------------------------------------------- rules, on small made-up sessions

let seq = 0;
function line(match: string | null, kind: RecordLine['kind'], key: string, value: unknown, session = 's1'): RecordLine {
  const n = seq++;
  return {
    schema: 1,
    session_id: session,
    seq: n,
    received_at: new Date(Date.UTC(2026, 8, 24, 12, 0, n)).toISOString(),
    kind,
    match_id: match,
    feature: null,
    category: null,
    key,
    value,
  };
}
const info = (match: string | null, key: string, value: unknown) =>
  line(match, 'info', key, typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
const event = (match: string | null, key: string, value: unknown = null) => line(match, 'event', key, value);
const kf = (attackerName: string, victimName: string, weaponName: string, action: string, action2 = '') =>
  event('m1', 'kill_feed', { local_player_name: '[T] Me', attackerName, victimName, weaponName, action, action2 });

function oneMatch(extra: RecordLine[] = []): RecordLine[] {
  seq = 0;
  return [
    info(null, 'game_mode', '#GAME_MODE_RANKED'),
    info(null, 'map_id', 'mp_rr_tropic_island_mu2'),
    info(null, 'legendSelect_0', { playerName: '[T] Me', legendName: '#character_bangalore_NAME', is_local: true }),
    info(null, 'legendSelect_1', { playerName: 'Mate', legendName: '#character_maggie_NAME', is_local: false }),
    info(null, 'roster_0', { name: '[T] Me', isTeammate: true, is_local: '1', platform_id: 'me-1' }),
    info(null, 'roster_1', { name: 'Mate', isTeammate: true, is_local: '0', platform_id: 'mate-1' }),
    info(null, 'roster_2', { name: 'Enemy', isTeammate: false, is_local: '0', platform_id: 'enemy-1' }),
    info('m1', 'pseudo_match_id', 'm1'),
    event('m1', 'match_start'),
    info('m1', 'inUse', { inUse: 'R-301 Carbine' }),
    event('m1', 'damage', { targetName: 'Enemy', damageAmount: '40.000000', armor: 'true', headshot: 'false' }),
    ...extra,
    info('m1', 'match_summary', { rank: '3', teams: '20', squadKills: '1' }),
    info(null, 'pseudo_match_id', null),
  ];
}

test('untagged lines before the match id belong to that match; mode is carried from the lobby', () => {
  const [m] = buildDataset(oneMatch()).dataset.matches;
  assert.equal(m.legend, 'Bangalore');
  assert.equal(m.map, 'Storm Point');
  assert.equal(m.mode, 'ranked');
  assert.equal(m.accountKey, 'me-1');
  assert.equal(m.squadKey, 'mate-1');
  assert.equal(buildDataset(oneMatch()).dataset.teammates[0].legend, 'Mad Maggie');
});

test('a bleed-out kill counts for the gun that knocked the player', () => {
  const lines = oneMatch([
    kf('[T]Me', 'Enemy', 'r301', 'knockdown'),
    event('m1', 'knockdown'),
    kf('[T]Me', 'Enemy', '', 'Bleed_out', 'kill'),
    event('m1', 'kill', '1'),
  ]);
  const { matches, weapons } = buildDataset(lines).dataset;
  assert.equal(matches[0].kills, 1);
  assert.deepEqual(weapons.map((w) => [w.weapon, w.kills, w.knocks, w.damage]), [['R-301', 1, 1, 40]]);
});

test("teammates' kills and deaths come from the kill feed", () => {
  const lines = oneMatch([
    kf('Mate', 'Enemy', 'flatline', 'knockdown'),
    kf('Mate', 'Enemy', 'flatline', 'headshot_kill'),
    kf('Enemy', 'Mate', 'mastiff', 'kill'),
  ]);
  const [t] = buildDataset(lines).dataset.teammates;
  assert.deepEqual([t.kills, t.knocks, t.deaths], [1, 1, 1]);
});

test('a match without a summary is left out and counted', () => {
  const lines = oneMatch().filter((l) => l.key !== 'match_summary');
  const result = buildDataset(lines);
  assert.equal(result.dataset.matches.length, 0);
  assert.equal(result.incomplete, 1);
});

test('the loadout is the pair of guns held longest, melee and a brief pickup ignored', () => {
  const slots = (weapon0: string, weapon1: string) => info('m1', 'weapons', { weapon0, weapon1 });
  const base = oneMatch();
  const end = base.length - 2; // before the summary
  // One line per second: melee 1 s, CAR alone 1 s, CAR + R-99 1 s, then Spitfire + EVA-8 to the end (3 s).
  const lines = [...base.slice(0, end), slots('Melee', 'Melee'), slots('C.A.R. SMG', 'Melee'), slots('C.A.R. SMG', 'R-99'),
    slots('M600 Spitfire', 'EVA-8 Auto'), event('m1', 'kill', '1'), event('m1', 'kill', '2'), ...base.slice(end)].map((l, i) => ({
    ...l, seq: i, received_at: new Date(Date.UTC(2026, 8, 24, 12, 0, i)).toISOString(),
  }));
  assert.deepEqual(buildDataset(lines).dataset.matches[0].loadout, ['EVA-8', 'Spitfire']);
});

test('a match left before its summary is built from the last scoreboard once GEP ends it', () => {
  const tabs = (teams: number) => info('m1', 'tabs', { kills: 0, assists: 0, teams, players: teams * 3, damage: 40 });
  const base = oneMatch().filter((l) => l.key !== 'match_summary');
  const end = base.length - 1; // pseudo_match_id cleared
  // Renumbered: the dataset keeps one line per session seq.
  const lines = [...base.slice(0, end), tabs(20), tabs(12), tabs(8), base[end]].map((l, i) => ({ ...l, seq: i }));
  assert.equal(buildDataset(lines).dataset.matches.length, 0, 'still playing: left out');
  const [m] = buildDataset([...lines, { ...event(null, 'match_end'), seq: lines.length }]).dataset.matches;
  assert.deepEqual([m.placement, m.teams], [8, 20]);
});

test("the season starts on the API's split start date when an RP snapshot has it", () => {
  const start = new Date(2026, 8, 15, 18).getTime() / 1000; // local 15 Sept
  const snap = line(null, 'rp_snapshot', 'post_match', { body: { global: { rank: { rankedSeasonMeta: { start } } } } });
  assert.equal(buildDataset([...oneMatch(), snap]).dataset.seasonStart, '2026-09-15');
  assert.equal(buildDataset(oneMatch()).dataset.seasonStart, '2026-09-24', 'without one: the first recorded match');
});

/** GEP's ranked season stats, sent at `at` (before the match unless given). */
function rankedStats(games: number, rp: number, at = '2026-09-24T11:59:00.000Z'): RecordLine {
  return { ...info(null, 'player_stats_br_ranked_latest', { season: 30, games, rank_score: rp, teammates_revived: 0 }), received_at: at };
}

test("a ranked match's RP is the change across the season stats around it", () => {
  const lines = oneMatch([rankedStats(11, 8_650, '2026-09-24T12:00:30.000Z')]);
  const [m] = buildDataset([rankedStats(10, 8_600), ...lines]).dataset.matches;
  assert.deepEqual([m.rpDelta, m.rpAfter, m.rpEstimated], [50, 8_650, false]);
});

test('until the stats come, the formula estimates the RP, flagged as such', () => {
  const lines = oneMatch([event('m1', 'kill', '1')]);
  const [m] = buildDataset([rankedStats(10, 8_600), ...lines]).dataset.matches;
  // Platinum entry 48; 3rd place 70; one kill at 3rd 18.
  assert.deepEqual([m.rpDelta, m.rpAfter, m.rpEstimated], [-48 + 70 + 18, null, true]);
});

test('the same session loaded twice counts once', () => {
  const lines = oneMatch([event('m1', 'kill', '1')]);
  const [m] = buildDataset([...lines, ...lines]).dataset.matches;
  assert.equal(m.kills, 1);
  assert.equal(m.damage, 40);
});
