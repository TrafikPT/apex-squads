/** The recorder's AccountIds, kept in a small JSON file next to the recordings. */
import fs from 'node:fs';
import path from 'node:path';
import type { AccountIds } from './recorder';

export class AccountIdFile implements AccountIds {
  private readonly ids: Record<string, string>;

  constructor(private readonly file: string) {
    let ids: unknown = {};
    try {
      ids = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      // Missing or unreadable: start empty, the next match fills it in.
    }
    this.ids = ids && typeof ids === 'object' && !Array.isArray(ids) ? (ids as Record<string, string>) : {};
  }

  get(name: string): string | null {
    const uid = this.ids[name];
    return typeof uid === 'string' && uid ? uid : null;
  }

  set(name: string, uid: string): void {
    if (this.ids[name] === uid) return;
    this.ids[name] = uid;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(this.ids, null, 2)}\n`);
  }
}
