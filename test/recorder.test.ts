import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { AccountIdFile } from '../src/account-ids';
import { JsonlSink } from '../src/jsonl-sink';
import {
  AccountIds,
  Clock,
  POST_MATCH_DELAYS_S,
  PlayerQuery,
  RankFetcher,
  Recorder,
  RecordLine,
  Sink,
} from '../src/recorder';

class MemorySink implements Sink {
  lines: RecordLine[] = [];
  write(line: RecordLine): void {
    this.lines.push(line);
  }
}

class FakeClock implements Clock {
  private t = Date.parse('2026-09-23T20:00:00Z');
  private timers = new Map<number, { at: number; fn: () => void }>();
  private nextId = 1;
  now(): Date {
    return new Date(this.t);
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }
  pendingCount(): number {
    return this.timers.size;
  }
  /** Advance time, firing due timers in order. */
  advance(ms: number): void {
    const end = this.t + ms;
    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.t = due[1].at;
      due[1].fn();
    }
    this.t = end;
  }
}

class FakeRank implements RankFetcher {
  /** Name, or "uid:<id>" for lookups by ID. */
  calls: string[] = [];
  fail = false;
  async fetchPlayer(query: PlayerQuery) {
    this.calls.push('uid' in query ? `uid:${query.uid}` : query.name);
    if (this.fail) throw new Error('boom');
    return { status: 200, body: { global: { rank: { rankScore: 1234 } } } };
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

class MemoryIds implements AccountIds {
  constructor(readonly ids: Record<string, string> = {}) {}
  get(name: string) {
    return this.ids[name] ?? null;
  }
  set(name: string, uid: string) {
    this.ids[name] = uid;
  }
}

function setup(ids: AccountIds | null = null) {
  const sink = new MemorySink();
  const clock = new FakeClock();
  const rank = new FakeRank();
  const recorder = new Recorder('s1', sink, rank, clock, ids);
  const phase = (value: string) =>
    recorder.onInfoUpdate({ feature: 'game_info', category: 'game_info', key: 'phase', value });
  const name = (value: string) =>
    recorder.onInfoUpdate({ feature: 'me', category: 'me', key: 'name', value });
  const matchId = (value: string) =>
    recorder.onInfoUpdate({
      feature: 'match_info',
      category: 'match_info',
      key: 'pseudo_match_id',
      value,
    });
  return { sink, clock, rank, recorder, phase, name, matchId };
}

const rpLines = (sink: MemorySink) => sink.lines.filter((l) => l.kind === 'rp_snapshot');

test('lines are sequential and keep the raw payload untouched', () => {
  const { sink, recorder } = setup();
  const raw = '{"targetName":"x","damageAmount":"14","armor":"true","headshot":"false"}';
  recorder.onGameEvent({ feature: 'damage', key: 'damage', value: raw });
  recorder.lifecycle('session_start');
  assert.deepEqual(
    sink.lines.map((l) => l.seq),
    [0, 1],
  );
  assert.equal(sink.lines[0].value, raw);
  assert.equal(sink.lines[0].kind, 'event');
  assert.equal(sink.lines[0].received_at, '2026-09-23T20:00:00.000Z');
});

test('an RP lookup by name drops the clan tag: the API only knows the bare name', async () => {
  const { rank, name, phase } = setup();
  phase('lobby');
  name('[SOY] MiracleOfFatima');
  await flush();
  assert.deepEqual(rank.calls, ['MiracleOfFatima']);
});

const localRoster = (name: string, originId: string) => ({
  feature: 'roster', category: 'match_info', key: 'roster_0',
  value: JSON.stringify({ name, is_local: '1', platform_id: '765', origin_id: originId }),
});

test("a saved EA ID makes the session's first lobby lookup go by ID", async () => {
  const { rank, name, phase } = setup(new MemoryIds({ MiracleOfFatima: '101' }));
  phase('lobby');
  name('[SOY] MiracleOfFatima');
  await flush();
  assert.deepEqual(rank.calls, ['uid:101']);
});

test("the match roster saves my EA ID under my name without the clan tag", () => {
  const ids = new MemoryIds();
  const { recorder } = setup(ids);
  recorder.onInfoUpdate(localRoster('[SOY] MiracleOfFatima', '101'));
  assert.deepEqual(ids.ids, { MiracleOfFatima: '101' });
});

test("switching accounts doesn't keep the last account's EA ID", async () => {
  const { rank, recorder, name, phase } = setup(new MemoryIds());
  phase('lobby');
  name('[SOY] Main');
  recorder.onInfoUpdate(localRoster('[SOY] Main', '101'));
  name('Alt');
  await flush();
  assert.equal(rank.calls.at(-1), 'Alt');
});

test('the EA ID file survives a restart, and a missing file starts empty', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ids-')), 'accounts.json');
  assert.equal(new AccountIdFile(file).get('MiracleOfFatima'), null);
  new AccountIdFile(file).set('MiracleOfFatima', '101');
  assert.equal(new AccountIdFile(file).get('MiracleOfFatima'), '101');
});

test('lines are tagged with the match id until back in the lobby', () => {
  const { sink, recorder, phase, matchId } = setup();
  phase('loading_screen');
  matchId('m-1');
  recorder.onGameEvent({ feature: 'kill', key: 'kill', value: '1' });
  phase('lobby');
  recorder.onGameEvent({ feature: 'x', key: 'y', value: null });

  const byKey = (k: string) => sink.lines.find((l) => l.key === k)!;
  assert.equal(byKey('pseudo_match_id').match_id, 'm-1', 'the line setting the id carries it');
  assert.equal(byKey('kill').match_id, 'm-1');
  assert.equal(byKey('y').match_id, null);
});

test('entering the lobby with a known player takes one lobby snapshot', async () => {
  const { sink, rank, name, phase } = setup();
  name('Player1');
  phase('lobby');
  await flush();
  assert.deepEqual(rank.calls, ['Player1']);
  assert.equal(rpLines(sink)[0].key, 'lobby');
});

test('player name arriving after the lobby phase still triggers a snapshot', async () => {
  const { rank, name, phase } = setup();
  phase('lobby');
  name('Player1');
  await flush();
  assert.deepEqual(rank.calls, ['Player1']);
});

test('after a match, snapshots follow the post-match schedule', async () => {
  const { sink, clock, rank, name, phase } = setup();
  name('Player1');
  phase('lobby');
  phase('loading_screen'); // match_start snapshot
  phase('landed');
  phase('match_summary');
  phase('lobby');
  clock.advance(POST_MATCH_DELAYS_S[POST_MATCH_DELAYS_S.length - 1] * 1000);
  await flush();

  const triggers = rpLines(sink).map((l) => l.key);
  assert.deepEqual(triggers, [
    'lobby',
    'match_start',
    ...POST_MATCH_DELAYS_S.map(() => 'post_match'),
  ]);
  assert.equal(rank.calls.length, 2 + POST_MATCH_DELAYS_S.length);
});

test('queueing again cancels remaining post-match snapshots', async () => {
  const { sink, clock, name, phase } = setup();
  name('Player1');
  phase('landed'); // app started mid-match
  phase('match_summary');
  clock.advance(30_000); // 0s and 30s fire
  phase('loading_screen');
  phase('legend_selection');
  clock.advance(600_000);
  await flush();

  assert.deepEqual(
    rpLines(sink).map((l) => l.key),
    ['match_start', 'post_match', 'post_match', 'match_start'],
  );
  assert.equal(clock.pendingCount(), 0);
});

test('back-to-back matches without a lobby phase still get snapshots', async () => {
  // The phase sequence GEP actually sent between matches (DESIGN.md §9).
  const { sink, clock, name, phase } = setup();
  name('Player1');
  phase('lobby');
  for (let i = 0; i < 2; i++) {
    for (const p of ['legend_selection', 'aircraft', 'freefly', 'landed', 'match_summary', 'loading_screen']) {
      phase(p);
    }
    clock.advance(POST_MATCH_DELAYS_S[POST_MATCH_DELAYS_S.length - 1] * 1000);
  }
  await flush();

  const oneMatch = ['match_start', ...POST_MATCH_DELAYS_S.map(() => 'post_match')];
  assert.deepEqual(
    rpLines(sink).map((l) => l.key),
    ['lobby', ...oneMatch, ...oneMatch],
  );
});

test('quitting a match straight to the lobby counts as the match ending', async () => {
  const { sink, clock, name, phase } = setup();
  name('Player1');
  phase('landed');
  phase('lobby');
  clock.advance(0);
  await flush();
  assert.deepEqual(
    rpLines(sink).map((l) => l.key),
    ['match_start', 'post_match'],
  );
});

test('switching account in the lobby snapshots the new account', async () => {
  const { sink, rank, name, phase } = setup();
  name('Main');
  phase('lobby');
  name('Smurf');
  await flush();
  assert.deepEqual(rank.calls, ['Main', 'Smurf']);
  assert.equal(rpLines(sink)[1].key, 'account_change');
});

test('once the roster shows my EA ID, snapshots look me up by it instead of by name', async () => {
  const { rank, clock, recorder, name, phase } = setup();
  name('Player1');
  phase('legend_selection');
  recorder.onInfoUpdate({
    feature: 'roster',
    category: 'match_info',
    key: 'roster_0',
    value: JSON.stringify({ name: 'Player1', is_local: '1', platform_id: '765', origin_id: '101' }),
  });
  phase('match_summary');
  clock.advance(0); // the first post-match snapshot
  await flush();
  assert.deepEqual(rank.calls, ['Player1', 'uid:101']);
});

test('API failures are recorded, not thrown', async () => {
  const { sink, rank, name, phase } = setup();
  rank.fail = true;
  name('Player1');
  phase('lobby');
  await flush();
  const value = rpLines(sink)[0].value as { error: string };
  assert.match(value.error, /boom/);
});

test('no snapshots without an API client', async () => {
  const sink = new MemorySink();
  const recorder = new Recorder('s1', sink, null, new FakeClock());
  recorder.onInfoUpdate({ feature: 'me', category: 'me', key: 'name', value: 'P' });
  recorder.onInfoUpdate({ feature: 'game_info', category: 'game_info', key: 'phase', value: 'lobby' });
  await flush();
  assert.equal(rpLines(sink).length, 0);
});

test('JsonlSink writes one parseable line per record', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-tracker-'));
  const sink = new JsonlSink(dir, 'session.jsonl');
  const recorder = new Recorder('s1', sink, null, new FakeClock());
  recorder.lifecycle('a');
  recorder.onGameEvent({ feature: 'kill_feed', key: 'kill_feed', value: 'line\nbreak' });
  sink.close();
  const lines = fs.readFileSync(sink.filePath, 'utf8').trimEnd().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[1]).value, 'line\nbreak');
  assert.throws(() => sink.write(JSON.parse(lines[0])), /closed/);
});

test('JsonlSink appends to an existing file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-tracker-'));
  fs.writeFileSync(path.join(dir, 'session.jsonl'), '{"existing":true}\n');
  const sink = new JsonlSink(dir, 'session.jsonl');
  new Recorder('s1', sink, null, new FakeClock()).lifecycle('a');
  sink.close();
  const lines = fs.readFileSync(sink.filePath, 'utf8').trimEnd().split('\n');
  assert.deepEqual(JSON.parse(lines[0]), { existing: true });
  assert.equal(JSON.parse(lines[1]).key, 'a');
});
