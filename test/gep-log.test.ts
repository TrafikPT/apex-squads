import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGepLogLine, replaySession, splitSessions, type GepLogEntry } from '../src/gep-log';
import type { RecordLine, Sink } from '../src/recorder';

// Shapes copied from a real provider log; names made up.
const LOG = [
  String.fromCharCode(0xfeff) + '2026-09-24 14:28:22,342 (INFO) ================== new session ==================',
  '2026-09-24 14:28:23,001 (INFO) </index/index.js> (:2) - game launched detected, 21566, waiting for renderer: false',
  '2026-09-24 14:28:24,000 (INFO) </index/index.js> (:2) - [Plugin] info update {"channelId":1,"category":"game_info","key":"phase","value":"lobby"}',
  '2026-09-24 14:28:24,001 (INFO) </index/index.js> (:2) - [GEP] info update {"featureName":"game_info","categoryName":"game_info","key":"phase","value":"lobby"}',
  '2026-09-24 14:30:00,000 (INFO) </index/index.js> (:2) - [GEP] info update {"featureName":"game_info","categoryName":"game_info","key":"phase","value":"loading_screen"}',
  '2026-09-24 14:30:01,500 (INFO) </index/index.js> (:2) - [GEP] info update {"featureName":"match_info","categoryName":"match_info","key":"pseudo_match_id","value":"m-1"}',
  '2026-09-24 14:31:00,250 (INFO) </index/index.js> (:2) - [GEP] New Event  {"gameId":21566,"feature":"kill_feed","key":"kill_feed","value":{"attackerName":"A","victimName":"B","weaponName":"r301","action":"knockdown","action2":""}}',
  '2026-09-24 14:31:01,000 (INFO) </index/index.js> (:2) - [GEP] New Event  {"gameId":5426,"feature":"kill","key":"kill","value":"1"}',
  '2026-09-24 14:31:02,000 (INFO) </index/index.js> (:2) - [GEP] New Event  {"gameId":21566,"feature":"death","key":"death","value":null}',
  '2026-09-24 14:40:00,000 (INFO) </index/index.js> (:2) - [GEP] info update {"featureName":"game_info","categoryName":"game_info","key":"phase","value":"lobby"}',
  '2026-09-24 14:41:00,000 (INFO) </index/index.js> (:2) - [GEP] Supported game ended 21566 ',
  '2026-09-24 20:18:54,270 (INFO) ================== new session ==================',
  '2026-09-24 20:18:55,000 (INFO) </index/index.js> (:2) - Simple Io plugin Init',
];

class MemorySink implements Sink {
  lines: RecordLine[] = [];
  write(line: RecordLine): void {
    this.lines.push(line);
  }
}

const entries = () => LOG.map(parseGepLogLine).filter((e): e is GepLogEntry => e !== null);

test('keeps GEP data and session boundaries, drops plugin chatter and other games', () => {
  assert.deepEqual(
    entries().map((e) => e.type),
    ['session_start', 'game_launched', 'info', 'info', 'info', 'event', 'event', 'info', 'game_ended', 'session_start'],
  );
});

test('maps provider fields to the GEP message shape the app receives', () => {
  const [info, event] = entries().filter((e) => e.type === 'info' || e.type === 'event').slice(2);
  assert.deepEqual(info.type === 'info' && info.msg, {
    feature: 'match_info',
    category: 'match_info',
    key: 'pseudo_match_id',
    value: 'm-1',
  });
  assert.equal(event.type === 'event' && event.msg.feature, 'kill_feed');
  assert.equal(event.type === 'event' && (event.msg.value as { weaponName: string }).weaponName, 'r301');
});

test('reads the timestamp as local time', () => {
  const at = parseGepLogLine(LOG[5])!.at;
  assert.deepEqual(
    [at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds()],
    [2026, 8, 24, 14, 30, 1, 500],
  );
});

test('a JSON payload cut short is reported, not dropped silently', () => {
  const e = parseGepLogLine(
    '2026-09-24 14:31:00,250 (INFO) </index/index.js> (:2) - [GEP] info update {"featureName":"roster","categoryName":"match_info","key":"roster_1","value":"{\\"na}',
  );
  assert.equal(e?.type, 'unparsed');
});

test('sessions without game data are dropped', () => {
  const sessions = splitSessions(entries());
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].length, 9);
});

test('replay produces recorder lines tagged with the match and log time', () => {
  const sink = new MemorySink();
  replaySession(splitSessions(entries())[0], 'imp', sink, { files: ['index.html.log'] });
  const l = sink.lines;

  assert.deepEqual(
    l.map((x) => `${x.kind}:${x.key}`),
    [
      'lifecycle:session_start',
      'lifecycle:game_detected',
      'info:phase',
      'info:phase',
      'info:pseudo_match_id',
      'event:kill_feed',
      'event:death',
      'info:phase',
      'lifecycle:game_exit',
      'lifecycle:session_end',
    ],
  );
  assert.deepEqual(
    l.map((x) => x.match_id),
    // The phase line that returns to the lobby still carries the match; the lines after it don't.
    [null, null, null, null, 'm-1', 'm-1', 'm-1', 'm-1', null, null],
  );
  assert.equal(l[5].received_at, parseGepLogLine(LOG[6])!.at.toISOString());
  assert.deepEqual(l[0].value, { imported_from: 'overwolf_gep_log', files: ['index.html.log'] });
  assert.ok(l.every((x, i) => x.session_id === 'imp' && x.seq === i));
});
