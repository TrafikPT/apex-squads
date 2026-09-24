/** Reads the recorder's JSONL files back (DESIGN.md §4.1). */
import fs from 'node:fs';
import path from 'node:path';
import type { RecordLine } from './recorder';

/**
 * Every line of every `.jsonl` file in the given folders; missing folders are
 * skipped. A line that doesn't parse (the last one, after a crash mid-write)
 * is skipped too.
 */
export function readRecordings(dirs: string[]): RecordLine[] {
  const lines: RecordLine[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
      for (const text of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
        if (!text.trim()) continue;
        try {
          lines.push(JSON.parse(text) as RecordLine);
        } catch {
          // Partial line: nothing else in the file is affected.
        }
      }
    }
  }
  return lines;
}
