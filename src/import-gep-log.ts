/**
 * Turns the Overwolf client's GEP log into recordings/<session>.jsonl files, so
 * the views and tests can run on real matches before our app can record them.
 *
 *   npm run import:gep-log -- [log dir or files...] [--out <dir>]
 *                             [--anonymize [--keep <player name>]...]
 *
 * Defaults to the local Overwolf log folder and the repo's recordings/ folder.
 * Session ids are derived from the log, so rerunning replaces the same files.
 * Without --anonymize the recordings contain other players' names and IDs:
 * keep those out of git (fixtures/recordings/ holds anonymized ones).
 */
import fs from 'node:fs';
import path from 'node:path';
import { anonymize } from './anonymize';
import {
  OVERWOLF_GEP_LOG_DIR,
  parseGepLogLine,
  replaySession,
  sessionIdFor,
  splitSessions,
  type GepLogEntry,
} from './gep-log';
import { JsonlSink } from './jsonl-sink';
import type { RecordLine } from './recorder';

function main(): void {
  const args = process.argv.slice(2);
  let outDir = 'recordings';
  let anonymized = false;
  const keep: string[] = [];
  const inputs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outDir = args[++i];
    else if (args[i] === '--anonymize') anonymized = true;
    else if (args[i] === '--keep') keep.push(args[++i]);
    else inputs.push(args[i]);
  }
  if (inputs.length === 0) inputs.push(OVERWOLF_GEP_LOG_DIR);

  const files = inputs.flatMap(listLogFiles);
  if (files.length === 0) {
    console.error(`No GEP log files found in: ${inputs.join(', ')}`);
    process.exit(1);
  }

  // Rotation numbers don't sort as text (.9 before .10), and the newest file has
  // none: order by each file's first timestamp instead.
  const parsed = files
    .map((file) => ({ file, entries: readEntries(file) }))
    .filter((f) => f.entries.length > 0)
    .sort((a, b) => a.entries[0].at.getTime() - b.entries[0].at.getTime());

  const sessions = splitSessions(parsed.flatMap((f) => f.entries));
  console.log(`${files.length} log files, ${sessions.length} sessions with game data.`);

  let lines: RecordLine[] = [];
  for (const session of sessions) {
    const start = session[0].at;
    const end = session[session.length - 1].at;
    const sessionId = sessionIdFor(start);
    const sourceFiles = parsed
      .filter((f) => f.entries.some((e) => e.at >= start && e.at <= end))
      .map((f) => path.basename(f.file));
    const { unparsed } = replaySession(session, sessionId, { write: (l) => lines.push(l) }, { files: sourceFiles });
    if (unparsed) console.log(`${sessionId}: ${unparsed} unparsed GEP lines`);
  }

  if (anonymized) {
    // Across all sessions at once, so a player keeps the same alias everywhere.
    const result = anonymize(lines, keep);
    if (result.leaks.length) {
      console.error(`Anonymizing left ${result.leaks.length} original names/IDs in the output; nothing written.`);
      // Printed so the cause can be fixed; this is the local terminal, not a file.
      for (const leak of result.leaks) console.error(`  ${leak}`);
      process.exit(1);
    }
    console.log(`Anonymized ${result.aliases} players (kept: the local player${keep.map((k) => `, ${k}`).join('')}).`);
    lines = result.lines;
  }

  for (const [sessionId, sessionLines] of groupBy(lines, (l) => l.session_id)) {
    fs.rmSync(path.join(outDir, `${sessionId}.jsonl`), { force: true });
    const sink = new JsonlSink(outDir, `${sessionId}.jsonl`);
    for (const l of sessionLines) sink.write(l);
    sink.close();
    const matches = new Set(sessionLines.map((l) => l.match_id).filter(Boolean));
    console.log(`${sessionId}.jsonl: ${sessionLines.length} lines, ${matches.size} matches`);
  }
  console.log(`Written to ${path.resolve(outDir)}`);
}

function listLogFiles(input: string): string[] {
  if (!fs.existsSync(input)) {
    console.error(`Not found: ${input}`);
    return [];
  }
  if (!fs.statSync(input).isDirectory()) return [input];
  return fs
    .readdirSync(input)
    .filter((name) => /^index\.html(\.\d+)?\.log$/.test(name))
    .map((name) => path.join(input, name));
}

function readEntries(file: string): GepLogEntry[] {
  const entries: GepLogEntry[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const entry = parseGepLogLine(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(item);
  }
  return groups;
}

main();
