import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { cardFor, EncounterTracker, lobbyCards, type Trigger } from '../src/encounters';
import { isAnonymousName } from '../src/game-names';
import { PlayerHistory } from '../src/player-history';
import { PopupService } from '../src/popup-service';
import type { RecordLine } from '../src/recorder';
import { readRecordings } from '../src/recordings';
import type { Popup } from '../src/ui/popup-card';

let seq = 0;
function line(match: string | null, kind: RecordLine['kind'], key: string, value: unknown, at = seq): RecordLine {
  return {
    schema: 1, session_id: 's1', seq: seq++, received_at: new Date(Date.UTC(2026, 8, 24, 12, 0, at)).toISOString(),
    kind, match_id: match, feature: null, category: null, key, value,
  };
}
const roster = (m: string, slot: number, name: string, uid: string, local = false, teammate = local) =>
  line(m, 'info', `roster_${slot}`, JSON.stringify({ name, is_local: local ? '1' : '0', isTeammate: String(teammate), origin_id: uid }));
const feed = (m: string, attackerName: string, victimName: string, action: string, action2 = '', weaponName = 'r301') =>
  line(m, 'event', 'kill_feed', { local_player_name: '[T] Me', attackerName, victimName, weaponName, action, action2 });
const damage = (m: string, targetName: string, amount: number) =>
  line(m, 'event', 'damage', { targetName, damageAmount: amount.toFixed(6), armor: 'true', headshot: 'false' });

function lobby(m: string): RecordLine[] {
  return [roster(m, 0, '[T] Me', 'me', true), roster(m, 1, '[BAD] Shark', 'u-shark'), roster(m, 2, 'Minnow', 'u-minnow')];
}

// ---------------------------------------------------------------- triggers and cards

function track(lines: RecordLine[]) {
  const history = new PlayerHistory();
  const tracker = new EncounterTracker(history);
  const triggers: Trigger[] = [];
  for (const l of lines) {
    history.add(l);
    triggers.push(...tracker.onLine(l));
  }
  return { history, triggers };
}

test('a kill by me and my death each fire once; knocks fire nothing', () => {
  const { triggers } = track([
    ...lobby('m1'),
    feed('m1', '[T]Me', 'Minnow', 'knockdown'),
    feed('m1', '[T]Me', 'Minnow', 'kill'),
    feed('m1', '[BAD]Shark', '[T]Me', 'knockdown'),
    feed('m1', '[BAD]Shark', '[T]Me', 'Bleed_out', 'kill', ''),
  ]);
  assert.deepEqual(triggers.map((t) => `${t.moment}:${t.player.name}:${t.player.uid}`), ['you_killed:Minnow:u-minnow', 'killed_by:Shark:u-shark']);
  assert.equal(triggers[1].knockedBy, undefined, 'knocked and killed by the same player');
});

test('killed after someone else knocked me: both are on the card', () => {
  const { triggers } = track([...lobby('m1'), feed('m1', 'Minnow', '[T]Me', 'knockdown'), feed('m1', '[BAD]Shark', '[T]Me', 'kill')]);
  assert.equal(triggers[0].player.name, 'Shark');
  assert.equal(triggers[0].knockedBy?.name, 'Minnow');
});

test('a revive clears the knock, so a later death credits no stale knocker', () => {
  const { triggers } = track([
    ...lobby('m1'),
    feed('m1', 'Minnow', '[T]Me', 'knockdown'),
    line('m1', 'event', 'healed_from_ko', null),
    feed('m1', '[BAD]Shark', '[T]Me', 'kill'),
  ]);
  assert.equal(triggers[0].knockedBy, undefined);
});

test('kill leader needs the most kills in the lobby and at least 3; knocks are not kills', () => {
  const kills = (n: number) => Array.from({ length: n }, () => feed('m1', '[BAD]Shark', 'Someone', 'kill'));
  assert.equal(track([...lobby('m1'), ...kills(2), feed('m1', '[BAD]Shark', '[T]Me', 'kill')]).triggers[0].player.killLeader, true, '3 kills with mine');
  assert.equal(track([...lobby('m1'), ...kills(1), feed('m1', '[BAD]Shark', '[T]Me', 'kill')]).triggers[0].player.killLeader, false);
  const knocks = Array.from({ length: 3 }, () => feed('m1', '[BAD]Shark', 'Someone', 'knockdown'));
  assert.equal(track([...lobby('m1'), ...knocks, feed('m1', '[BAD]Shark', '[T]Me', 'kill')]).triggers[0].player.kills, 1);
});

test('death card: the weapon they used and my damage on them this match', () => {
  const { history, triggers } = track([
    ...lobby('m1'),
    damage('m1', '[BAD]Shark', 40.5),
    damage('m1', '[BAD]Shark', 21),
    damage('m1', 'Minnow', 99),
    feed('m1', '[BAD]Shark', '[T]Me', 'knockdown', '', 'mozambique_akimbo_active'),
    feed('m1', '[BAD]Shark', '[T]Me', 'Bleed_out', 'kill', ''),
  ]);
  const card = cardFor(triggers[0].player, 'm1', history);
  assert.equal(card.weapon, 'Mozambique', 'a bleed-out has no weapon: the knock gun');
  assert.equal(card.damageFromMe, 62);
});

test('death card: the knocker gets their own weapon; abilities and unknown guns still show', () => {
  const { triggers } = track([
    ...lobby('m1'),
    feed('m1', 'Minnow', '[T]Me', 'Knuckle Cluster', 'knockdown', ''),
    feed('m1', '[BAD]Shark', '[T]Me', 'kill', '', 'brand_new_gun'),
  ]);
  assert.equal(triggers[0].player.weapon, 'brand_new_gun');
  assert.equal(triggers[0].player.damageFromMe, 0);
  assert.equal(triggers[0].knockedBy?.weapon, 'Knuckle Cluster');
});

test('death card: grenades by name; a knocked player who dies in the ring is credited to the knocker', () => {
  const { triggers } = track([
    ...lobby('m1'),
    feed('m1', '[BAD]Shark', '[T]Me', 'kill', '', 'rui/ordnance_icons/grenade_arc'),
    ...lobby('m2'),
    feed('m2', 'Minnow', '[T]Me', 'knockdown'),
    feed('m2', 'Minnow', '[T]Me', 'The Ring', 'kill', ''),
  ]);
  assert.deepEqual(triggers.map((t) => t.player.weapon), ['Arc Star', 'The Ring']);
});

test('kill card: no weapon or damage line', () => {
  const { history, triggers } = track([...lobby('m1'), damage('m1', 'Minnow', 80), feed('m1', '[T]Me', 'Minnow', 'kill')]);
  const card = cardFor(triggers[0].player, 'm1', history);
  assert.deepEqual([card.weapon, card.damageFromMe], [null, null]);
});

test('card: history counts earlier matches only', () => {
  const { history, triggers } = track([
    ...lobby('m0'),
    feed('m0', '[BAD]Shark', '[T]Me', 'kill'),
    ...lobby('m1'),
    feed('m1', '[T]Me', '[BAD]Shark', 'kill'),
    ...lobby('m2'),
  ]);
  const card = cardFor(triggers[1].player, 'm1', history);
  assert.deepEqual([card.metBefore, card.theyKilledMe, card.iKilledThem], [1, 1, 0], 'm2 came later: not counted');
});

test('card: K/D is theirs over earlier shared matches, from the whole kill feed', () => {
  const { history, triggers } = track([
    ...lobby('m0'),
    feed('m0', '[BAD]Shark', 'Someone', 'knockdown'),
    feed('m0', '[BAD]Shark', 'Someone', 'Bleed_out', 'kill', ''),
    feed('m0', '[BAD]Shark', 'Minnow', 'kill'),
    feed('m0', '[BAD]Shark', '[T]Me', 'headshot_kill'),
    feed('m0', 'Someone', '[BAD]Shark', 'kill'),
    ...lobby('m1'),
    feed('m1', '[BAD]Shark', 'Someone', 'kill'),
    feed('m1', '[T]Me', '[BAD]Shark', 'kill'),
  ]);
  const shark = cardFor(triggers.at(-1)!.player, 'm1', history);
  assert.equal(shark.kd, 3, '3 kills, 1 death in m0; m1 (this match) left out');
  assert.equal(shark.kills, 1, 'this match: kills only, knocks not counted');
  assert.equal(cardFor(triggers[0].player, 'm0', history).kd, null, 'never met before: no K/D');
});

test('lobby card: players who killed me before first, then high K/D over 2+ matches and 4+ kills; teammates never', () => {
  const kills = (m: string, who: string, n: number) => Array.from({ length: n }, () => feed(m, who, 'Someone', 'kill'));
  const lobbyOf = (m: string) => [
    roster(m, 0, '[T] Me', 'me', true),
    roster(m, 1, 'Mate', 'u-mate', false, true),
    roster(m, 2, '[BAD] Shark', 'u-shark'),
    roster(m, 3, 'Ace', 'u-ace'),
    roster(m, 4, 'Minnow', 'u-minnow'),
    roster(m, 5, 'Lucky', 'u-lucky'),
  ];
  const { history } = track([
    ...lobbyOf('m0'), ...kills('m0', 'Ace', 3), ...kills('m0', 'Mate', 5), feed('m0', 'Minnow', '[T]Me', 'kill'),
    ...kills('m0', 'Lucky', 1),
    ...lobbyOf('m1'), ...kills('m1', 'Ace', 2), ...kills('m1', 'Shark', 1), ...kills('m1', 'Lucky', 1),
    ...lobbyOf('m2'),
  ]);
  assert.deepEqual(lobbyCards('m2', history).map((c) => c.name), ['Minnow', 'Ace'], 'Shark: K/D 1; Lucky: 2 kills; Mate: teammate');
  assert.deepEqual(lobbyCards('m1', history).map((c) => c.name), ['Minnow'], 'Ace met only once before m1');
  assert.deepEqual(lobbyCards('m0', history), [], 'first match: nothing to say');
});

test('real matches: one "you killed" per kill of mine; popup players are identified or anonymous', () => {
  const lines = readRecordings([path.join(__dirname, '..', '..', 'fixtures', 'recordings')]);
  const { triggers } = track(lines);
  const kills = lines.filter((l) => l.kind === 'event' && l.key === 'kill').length;
  assert.equal(triggers.filter((t) => t.moment === 'you_killed').length, kills);
  const deaths = triggers.filter((t) => t.moment === 'killed_by');
  assert.ok(deaths.length >= 23);
  assert.ok(deaths.every((t) => t.player.weapon), 'every recorded death has a weapon or ability');
  const unknown = triggers.filter((t) => t.player.uid === null);
  assert.ok(unknown.every((t) => isAnonymousName(t.player.name)), unknown.map((t) => t.player.name).join(', '));
});

test('anonymous-mode names are recognized, including legends with a space', () => {
  assert.ok(isAnonymousName('Fuse2676'));
  assert.ok(isAnonymousName('Mad Maggie1234'));
  assert.ok(isAnonymousName('[TAG]Wraith0042'));
  assert.ok(!isAnonymousName('Fuse26'));
  assert.ok(!isAnonymousName('Dragonite761493'));
  assert.ok(!isAnonymousName('Player2024'));
});

// ---------------------------------------------------------------- service

test('service: kill/death cards show at once; the lobby card after match_start, only when it has players', async () => {
  const shown: [string, Popup][] = [];
  const service = new PopupService({ history: new PlayerHistory(), lobbyDelayMs: 0, show: (p, m) => shown.push([m, p]) });
  for (const l of [line('m0', 'event', 'match_start', null), ...lobby('m0'), feed('m0', '[BAD]Shark', '[T]Me', 'kill')]) service.onLine(l);
  assert.deepEqual(shown.map(([m, p]) => `${m}:${p.moment}`), ['m0:killed_by'], 'synchronous');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(shown.length, 1, 'm0: first meeting, no lobby card');

  for (const l of [line('m1', 'event', 'match_start', null), ...lobby('m1')]) service.onLine(l);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const [m, p] = shown[1];
  assert.equal(m, 'm1');
  assert.ok(p.moment === 'lobby' && p.players.map((c) => c.name).join() === 'Shark');
});
