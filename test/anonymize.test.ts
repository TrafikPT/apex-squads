import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anonymize } from '../src/anonymize';
import type { RecordLine } from '../src/recorder';

let seq = 0;
const line = (key: string, value: unknown, category: string | null = 'match_info'): RecordLine => ({
  schema: 1,
  session_id: 's1',
  seq: seq++,
  received_at: '2026-09-24T12:00:00.000Z',
  kind: key === 'kill_feed' ? 'event' : 'info',
  match_id: 'm1',
  feature: null,
  category,
  key,
  value,
});

const LINES = [
  line('name', '[T] Me', 'me'),
  line('roster_0', JSON.stringify({ name: '[T] Me', is_local: '1', isTeammate: true, platform_id: '111', origin_id: '112' })),
  line('roster_1', JSON.stringify({ name: '[T] Friend', is_local: '0', isTeammate: true, platform_id: '221', origin_id: '222' })),
  line('roster_2', JSON.stringify({ name: '[XYZ] Stranger', is_local: '0', isTeammate: false, platform_id: '331', origin_id: '332' })),
  line('legendSelect_2', JSON.stringify({ playerName: '[XYZ] Stranger', legendName: '#character_ash_NAME' })),
  line('kill_feed', { local_player_name: '[T] Me', attackerName: '[XYZ]Stranger', victimName: '[T]Friend', weaponName: 'r301', action: 'kill' }),
  line('damage', JSON.stringify({ targetName: 'Stranger', damageAmount: '12' })),
];

test('others get one stable alias in every field and format; me and kept players stay', () => {
  const { lines, aliases, leaks } = anonymize(LINES, ['Friend']);
  const text = lines.map((l) => JSON.stringify(l)).join('\n');
  assert.equal(aliases, 1);
  assert.deepEqual(leaks, []);
  assert.ok(!text.includes('Stranger') && !text.includes('XYZ') && !text.includes('331'));
  assert.ok(text.includes('[T] Friend') && text.includes('[T]Friend') && text.includes('221'));
  assert.ok(text.includes('111'));

  const roster = JSON.parse(lines[3].value as string);
  assert.equal(roster.name, '[CLN] Player-001');
  assert.equal(roster.platform_id, '9000000000001');
  assert.equal((lines[5].value as { attackerName: string }).attackerName, '[CLN]Player-001');
  assert.equal(JSON.parse(lines[6].value as string).targetName, 'Player-001');
});

test('a name left behind anywhere is reported as a leak', () => {
  const extra = line('some_new_key', JSON.stringify({ who: 'Stranger' }));
  assert.deepEqual(anonymize([...LINES, extra], ['Friend']).leaks, ['Stranger']);
});
