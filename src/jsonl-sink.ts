import fs from 'node:fs';
import path from 'node:path';
import type { RecordLine, Sink } from './recorder';

/**
 * Appends one JSON object per line through a file descriptor held open for the
 * whole session. Each write is synchronous, so a crash of the app loses nothing
 * that was already written; only a power loss can drop the last few lines the
 * OS hasn't flushed yet.
 */
export class JsonlSink implements Sink {
  readonly filePath: string;
  private fd: number | null;

  constructor(dir: string, fileName: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
    this.fd = fs.openSync(this.filePath, 'a');
  }

  write(line: RecordLine): void {
    if (this.fd === null) throw new Error(`JsonlSink is closed: ${this.filePath}`);
    fs.appendFileSync(this.fd, JSON.stringify(line) + '\n', 'utf8');
  }

  /** For tests. The recorder never closes it: the OS does on exit, so late GEP events can't hit a closed file. */
  close(): void {
    if (this.fd === null) return;
    fs.closeSync(this.fd);
    this.fd = null;
  }
}
