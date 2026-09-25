import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { cardFor, EncounterTracker, type Trigger } from '../src/encounters';
import { isAnonymousName } from '../src/game-names';
import { PlayerHistory, rankValue } from '../src/player-history';
import { PopupService } from '../src/popup-service';
import type { PlayerQuery, RecordLine } from '../src/recorder';
import { readRecordings } from '../src/recordings';
import type { Popup } from '../src/ui/popup-card';

let seq = 0;
function line(match: string | null, kind: RecordLine['kind'], key: string, value: unknown, at = seq): RecordLine {
  return {
    schema: 1, session_id: 's1', seq: seq++, received_at: new Date(Date.UTC(2026, 8, 24, 12, 0, at)).toISOString(),
    kind, match_id: match, feature: null, category: null, key, value,
  };
}
const roster = (m: string, slot: number, name: string, uid: string, local = false) =>
  line(m, 'info', `roster_${slot}`, JSON.stringify({ name, is_local: local ? '1' : '0', isTeammate: local, origin_id: uid }));
const feed = (m: string, attackerName: string, victimName: string, action: string, action2 = '') =>
  line(m, 'event', 'kill_feed', { local_player_name: '[T] Me', attackerName, victimName, weaponName: 'r301', action, action2 });
const lookup = (uid: string, tier: string, div: number, score: number, season: string, at: number) =>
  line(null, 'player_lookup', uid, { name: 'x', status: 200, global: { level: 100, rank: { rankName: tier, rankDiv: div, rankScore: score, rankedSeason: season, ALStopPercent: 12.5 } } }, at);

function lobby(m: string): RecordLine[] {
  return [roster(m, 0, '[T] Me', 'me', true), roster(m, 1, '[BAD] Shark', 'u-shark'), roster(m, 2, 'Minnow', 'u-minnow')];
}

// ---------------------------------------------------------------- history

test('rank order: tier first, then division (IV lowest), Master above Diamond I', () => {
  assert.ok(rankValue({ tier: 'Gold', div: 1 }) > rankValue({ tier: 'Gold', div: 4 }));
  assert.ok(rankValue({ tier: 'Platinum', div: 4 }) > rankValue({ tier: 'Gold', div: 1 }));
  assert.ok(rankValue({ tier: 'Master', div: 0 }) > rankValue({ tier: 'Diamond', div: 1 }));
  assert.ok(rankValue({ tier: 'Apex Predator', div: 0 }) > rankValue({ tier: 'Master', div: 0 }));
});

test('the peak is the highest rank ever looked up, the latest is the newest', () => {
  const h = new PlayerHistory();
  h.add(lookup('u1', 'Diamond', 2, 12000, 'br_ranked_s29_s2', 1));
  h.add(lookup('u1', 'Gold', 1, 7900, 'br_ranked_s30_s2', 5));
  const rec = h.get('u1')!;
  assert.equal(rec.latest?.tier, 'Gold');
  assert.equal(rec.peak?.tier, 'Diamond');
  assert.equal(rec.topPercent, 12.5);
});

// ---------------------------------------------------------------- triggers and cards

function track(lines: RecordLine[]) {
  const history = new PlayerHistory();
  const tracker = new EncounterTracker(history);
  const triggers: Trigger[] = [];
  const prefetch: string[] = [];
  for (const l of lines) {
    history.add(l);
    const out = tracker.onLine(l);
    triggers.push(...out.triggers);
    prefetch.push(...out.prefetch.map((p) => p.uid));
  }
  return { history, triggers, prefetch };
}

test('a kill by me and my death each fire once; knocks only prefetch', () => {
  const { triggers, prefetch } = track([
    ...lobby('m1'),
    feed('m1', '[T]Me', 'Minnow', 'knockdown'),
    feed('m1', '[T]Me', 'Minnow', 'kill'),
    feed('m1', '[BAD]Shark', '[T]Me', 'knockdown'),
    feed('m1', '[BAD]Shark', '[T]Me', 'Bleed_out', 'kill'),
  ]);
  assert.deepEqual(triggers.map((t) => `${t.moment}:${t.player.name}:${t.player.uid}`), ['you_killed:Minnow:u-minnow', 'killed_by:Shark:u-shark']);
  assert.deepEqual(prefetch, ['u-minnow', 'u-minnow', 'u-shark', 'u-shark']);
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

test('kill leader needs the most kills in the lobby and at least 3', () => {
  const kills = (n: number) => Array.from({ length: n }, () => feed('m1', '[BAD]Shark', 'Someone', 'kill'));
  assert.equal(track([...lobby('m1'), ...kills(2), feed('m1', '[BAD]Shark', '[T]Me', 'kill')]).triggers[0].player.killLeader, true, '3 kills with mine');
  assert.equal(track([...lobby('m1'), ...kills(1), feed('m1', '[BAD]Shark', '[T]Me', 'kill')]).triggers[0].player.killLeader, false);
});

test('card: history counts earlier matches only; peak only when above the current rank', () => {
  const { history, triggers } = track([
    ...lobby('m0'),
    feed('m0', '[BAD]Shark', '[T]Me', 'kill'),
    lookup('u-shark', 'Diamond', 1, 13000, 'br_ranked_s29_s2', 10),
    lookup('u-shark', 'Platinum', 2, 10000, 'br_ranked_s30_s2', 20),
    ...lobby('m1'),
    feed('m1', '[T]Me', '[BAD]Shark', 'kill'),
  ]);
  const card = cardFor(triggers[1].player, 'm1', history);
  assert.deepEqual([card.metBefore, card.theyKilledMe, card.iKilledThem], [1, 1, 0]);
  assert.deepEqual(card.rank, { tier: 'Platinum', div: 2, score: 10000 });
  assert.deepEqual(card.peak, { tier: 'Diamond', div: 1, season: 'br_ranked_s29_s2' });

  history.add(lookup('u-shark', 'Diamond', 1, 13100, 'br_ranked_s30_s2', 30));
  assert.equal(cardFor(triggers[1].player, 'm1', history).peak, null, 'current rank is the peak: not repeated');
});

test('card: K/D is theirs over earlier shared matches, from the whole kill feed', () => {
  const { history, triggers } = track([
    ...lobby('m0'),
    feed('m0', '[BAD]Shark', 'Someone', 'knockdown'),
    feed('m0', '[BAD]Shark', 'Someone', 'Bleed_out', 'kill'),
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

  const first = track([...lobby('m0'), feed('m0', '[T]Me', 'Minnow', 'kill')]);
  assert.equal(cardFor(first.triggers[0].player, 'm0', first.history).kd, null, 'never met before: no K/D');
});

test('real matches: one "you killed" per kill of mine; popup players are identified or anonymous', () => {
  const lines = readRecordings([path.join(__dirname, '..', '..', 'fixtures', 'recordings')]);
  const { triggers } = track(lines);
  const kills = lines.filter((l) => l.kind === 'event' && l.key === 'kill').length;
  assert.equal(triggers.filter((t) => t.moment === 'you_killed').length, kills);
  assert.ok(triggers.filter((t) => t.moment === 'killed_by').length >= 23);
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

test('service: looks each player up once, records it, and shows the rank', async () => {
  const calls: string[] = [];
  const shown: Popup[] = [];
  const service: PopupService = new PopupService({
    history: new PlayerHistory(),
    lookup: {
      async fetchPlayer(q: PlayerQuery) {
        calls.push('uid' in q ? q.uid : q.name);
        return { status: 200, body: { global: { level: 300, rank: { rankName: 'Master', rankDiv: 0, rankScore: 16000 } } } };
      },
    },
    recordLookup: (uid, value) => service.onLine(line(null, 'player_lookup', uid, value)),
    show: (p) => shown.push(p),
  });
  for (const l of [...lobby('m1'), feed('m1', '[BAD]Shark', '[T]Me', 'knockdown'), feed('m1', '[BAD]Shark', '[T]Me', 'kill')]) {
    service.onLine(l);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['u-shark']);
  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].player.rank, { tier: 'Master', div: 0, score: 16000 });
  assert.equal(shown[0].player.level, 300);
});

test('service: without an API key the popup still shows, with no rank', async () => {
  const shown: Popup[] = [];
  const service = new PopupService({ history: new PlayerHistory(), lookup: null, recordLookup: () => undefined, show: (p) => shown.push(p) });
  for (const l of [...lobby('m1'), feed('m1', '[T]Me', 'Minnow', 'kill')]) service.onLine(l);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(shown[0].player.rank, null);
});
