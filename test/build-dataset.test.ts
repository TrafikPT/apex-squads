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
  const rated = d.matches.filter((m) => m.rpDelta !== null && m.startedAt.startsWith('2026-09-24'));
  for (let i = 1; i < rated.length; i++) {
    assert.equal(rated[i].rpAfter! - rated[i].rpDelta!, rated[i - 1].rpAfter, rated[i].matchId);
  }
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

test("the season starts on the API's split start date when an RP snapshot has it", () => {
  const start = new Date(2026, 8, 15, 18).getTime() / 1000; // local 15 Sept
  const snap = line(null, 'rp_snapshot', 'post_match', { body: { global: { rank: { rankedSeasonMeta: { start } } } } });
  assert.equal(buildDataset([...oneMatch(), snap]).dataset.seasonStart, '2026-09-15');
  assert.equal(buildDataset(oneMatch()).dataset.seasonStart, '2026-09-24', 'without one: the first recorded match');
});

test('the same session loaded twice counts once', () => {
  const lines = oneMatch([event('m1', 'kill', '1')]);
  const [m] = buildDataset([...lines, ...lines]).dataset.matches;
  assert.equal(m.kills, 1);
  assert.equal(m.damage, 40);
});
