import fs from 'node:fs';
import path from 'node:path';
import type { RecordLine, Sink } from './recorder';

/**
 * Appends one JSON object per line. Synchronous appends keep every line on disk
 * even if the app or the PC crashes mid-match; the event rate is low enough
 * (tens per second at most) that this costs nothing noticeable.
 */
export class JsonlSink implements Sink {
  readonly filePath: string;

  constructor(dir: string, fileName: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
  }

  write(line: RecordLine): void {
    fs.appendFileSync(this.filePath, JSON.stringify(line) + '\n', 'utf8');
  }
}
