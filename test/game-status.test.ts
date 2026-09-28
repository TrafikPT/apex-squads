import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameStatusTracker } from '../src/game-status';
import { INITIAL_STATUS, parseEventsHealth, statusLine, type EventsHealth, type GameStatus } from '../src/ui/game-status';

const GREEN: EventsHealth = { state: 1, disabled: false, message: null, degraded: [] };
const status = (patch: Partial<GameStatus>): GameStatus => ({ ...INITIAL_STATUS, events: GREEN, ...patch });

test('events health: read from the live file format, extra fields and all', () => {
  // Trimmed from https://game-events-status.overwolf.com/21566_prod.json on 2026-09-28.
  const live = {
    game_id: 21566, name: 'Apex Legends', state: 1, disabled: false, disabled_electron: false, published: true,
    features: [
      { name: 'kill', state: 1, published: true, keys: [{ name: 'kill', type: 0, state: 1, status_comment: null }] },
      { name: 'kill_feed', state: 2, published: true, keys: [] },
    ],
  };
  assert.deepEqual(parseEventsHealth(live), { state: 1, disabled: false, message: null, degraded: ['kill_feed'] });
  assert.deepEqual(parseEventsHealth({ state: 3, disabled_electron: true, maintenance_msg: ' Events are disabled ' }),
    { state: 3, disabled: true, message: 'Events are disabled', degraded: [] });
  assert.equal(parseEventsHealth(null), null);
  assert.equal(parseEventsHealth({ game_id: 21566 }), null);
  assert.equal(parseEventsHealth('<html>'), null);
});

test('status line: Overwolf switching Apex off beats everything', () => {
  const off = statusLine(status({ game: 'recording', events: { ...GREEN, state: 3, disabled: true, message: 'Anti-cheat update' } }));
  assert.equal(off.tone, 'bad');
  assert.equal(off.text, 'Apex game data is off');
  assert.match(off.detail, /Anti-cheat update/);
  assert.equal(statusLine(status({ events: { ...GREEN, state: 1, disabled: true } })).text, 'Apex game data is off');
  assert.equal(statusLine(status({ events: { ...GREEN, state: 0 } })).tone, 'bad');
});

test('status line: the recorder\'s own trouble, then the cards, then partial outages', () => {
  assert.equal(statusLine(status({ game: 'needs-admin', cards: 'needs-helper' })).text, 'Not recording: Apex runs as administrator');
  assert.equal(statusLine(status({ game: 'no-data' })).tone, 'bad');
  const helper = statusLine(status({ game: 'recording', cards: 'needs-helper', events: { ...GREEN, state: 2 } }));
  assert.deepEqual([helper.tone, helper.toSettings], ['warn', true]);
  const partial = statusLine(status({ game: 'recording', events: { ...GREEN, state: 2, degraded: ['kill_feed', 'rank'] } }));
  assert.equal(partial.tone, 'warn');
  assert.match(partial.detail, /kill feed, rank/);
});

test('status line: all well', () => {
  assert.deepEqual([statusLine(status({})).tone, statusLine(status({})).text], ['idle', 'Waiting for Apex Legends']);
  assert.equal(statusLine(status({ game: 'starting' })).text, 'Apex Legends found');
  const rec = statusLine(status({ game: 'recording', cards: 'in-game' }));
  assert.deepEqual([rec.tone, rec.text], ['ok', 'Recording Apex Legends']);
  assert.match(rec.detail, /inside the game/);
  // A feature that isn't green but leaves the overall state green isn't worth a warning.
  assert.equal(statusLine(status({ events: { ...GREEN, degraded: ['location'] } })).tone, 'idle');
  assert.match(statusLine(INITIAL_STATUS).detail, /Couldn't check/);
});

test('status tracker: reads the file, tells listeners of real changes only, keeps the last state on errors', async () => {
  let reply: unknown = { state: 1, disabled: false, features: [] };
  const tracker = new GameStatusTracker(() => undefined, () => (reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply)));
  const seen: GameStatus[] = [];
  const stop = tracker.onChange((s) => seen.push(s));
  await tracker.refreshEvents();
  await tracker.refreshEvents();
  tracker.set({ game: 'recording' });
  tracker.set({ game: 'recording' });
  assert.equal(seen.length, 2);
  reply = new Error('offline');
  await tracker.refreshEvents();
  assert.equal(tracker.current.events?.state, 1);
  reply = { state: 3, disabled: true };
  await tracker.refreshEvents();
  assert.equal(tracker.current.events?.disabled, true);
  assert.equal(seen.length, 3);
  stop();
  tracker.set({ game: 'none' });
  assert.equal(seen.length, 3);
});
