import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { LogTail } from '../src/log-tail';

function tempLog(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-tail-')), 'index.html.log');
}

test('log tail: returns only complete new lines, keeping a partial one for later', () => {
  const file = tempLog();
  fs.writeFileSync(file, 'a\nb\n');
  const tail = new LogTail(file);
  assert.deepEqual(tail.read().lines, ['a', 'b']);
  fs.appendFileSync(file, 'c\nd');
  assert.deepEqual(tail.read().lines, ['c']);
  fs.appendFileSync(file, 'e\n');
  assert.deepEqual(tail.read().lines, ['de']);
});

test('log tail: on rotation, the rest of the renamed file comes before the new one', () => {
  const file = tempLog();
  fs.writeFileSync(file, 'one\n');
  const tail = new LogTail(file);
  assert.deepEqual(tail.read().lines, ['one']);
  // Written after our last read, then Overwolf renames the file and starts a new one.
  fs.appendFileSync(file, 'roster\nlast-unterminated');
  fs.renameSync(file, path.join(path.dirname(file), 'index.html.21.log'));
  fs.writeFileSync(file, 'new\n');
  const { lines, restarted } = tail.read();
  assert.equal(restarted, true);
  assert.deepEqual(lines, ['roster', 'last-unterminated', 'new']);
  fs.appendFileSync(file, 'next\n');
  assert.deepEqual(tail.read().lines, ['next']);
});
