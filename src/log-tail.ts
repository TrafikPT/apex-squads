/** Follows a log file that Overwolf rotates: see LogTail. */
import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

/**
 * Reads what was appended to the log since the last call. When Overwolf
 * rotates it (renames it to index.html.N.log and starts a new one), the rest
 * of the renamed file is read first: a match start's roster can land there
 * in the last moment (lost once, 2026-09-25).
 */
export class LogTail {
  private offset = 0;
  private ino = -1;
  private decoder = new StringDecoder('utf8');
  private partial = '';

  constructor(private readonly file: string) {}

  /** Complete new lines, and whether the file was replaced since the last read. */
  read(): { lines: string[]; restarted: boolean } {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(this.file);
    } catch {
      return { lines: [], restarted: false }; // Between Overwolf's rename and the new file.
    }
    let text = '';
    const restarted = this.ino !== -1 && (stat.ino !== this.ino || stat.size < this.offset);
    if (restarted && stat.ino !== this.ino) {
      const rotated = this.rotatedFile();
      if (rotated) text += this.decoder.write(readRange(rotated.file, this.offset, rotated.size));
    }
    if (restarted || this.ino === -1) {
      // Lines never span files: what's left of the old one ends its last line.
      const rest = this.partial + text + this.decoder.end();
      text = rest && !rest.endsWith('\n') ? `${rest}\n` : rest;
      this.partial = '';
      this.decoder = new StringDecoder('utf8');
      this.offset = 0;
      this.ino = stat.ino;
    }
    if (stat.size > this.offset) {
      text += this.decoder.write(readRange(this.file, this.offset, stat.size));
      this.offset = stat.size;
    }
    const lines = (this.partial + text).split('\n');
    this.partial = lines.pop() ?? '';
    return { lines, restarted };
  }

  /** The renamed old log: the file in the folder that still has its inode. */
  private rotatedFile(): { file: string; size: number } | null {
    const dir = path.dirname(this.file);
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (file === this.file || !name.endsWith('.log')) continue;
      try {
        const s = fs.statSync(file);
        if (s.ino === this.ino) return { file, size: s.size };
      } catch {
        // Deleted while we looked: nothing to recover from it.
      }
    }
    return null;
  }
}

function readRange(file: string, from: number, to: number): Buffer {
  const buffer = Buffer.alloc(Math.max(0, to - from));
  if (!buffer.length) return buffer;
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buffer, 0, buffer.length, from);
  } finally {
    fs.closeSync(fd);
  }
  return buffer;
}
