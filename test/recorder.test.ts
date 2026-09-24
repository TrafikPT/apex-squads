import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { JsonlSink } from '../src/jsonl-sink';
import {
  Clock,
  POST_MATCH_DELAYS_S,
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
  calls: string[] = [];
  fail = false;
  async fetchPlayer(name: string) {
    this.calls.push(name);
    if (this.fail) throw new Error('boom');
    return { status: 200, body: { global: { rank: { rankScore: 1234 } } } };
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup() {
  const sink = new MemorySink();
  const clock = new FakeClock();
  const rank = new FakeRank();
  const recorder = new Recorder('s1', sink, rank, clock);
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
  phase('aircraft');
  phase('lobby');
  clock.advance(30_000); // 0s and 30s fire
  phase('loading_screen');
  clock.advance(600_000);
  await flush();

  assert.deepEqual(
    rpLines(sink).map((l) => l.key),
    ['post_match', 'post_match', 'match_start'],
  );
  assert.equal(clock.pendingCount(), 0);
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
  const lines = fs.readFileSync(sink.filePath, 'utf8').trimEnd().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[1]).value, 'line\nbreak');
});
