/**
 * Kill/death popups: every recorded line goes through here. Lookups are made
 * once per player per session, and each result is recorded as a
 * `player_lookup` line so the peak rank builds up across sessions.
 */
import { cardFor, EncounterTracker, type Seen, type Trigger } from './encounters';
import type { LookupValue, PlayerHistory } from './player-history';
import type { RankFetcher, RecordLine } from './recorder';
import type { Popup } from './ui/popup-card';

export interface PopupServiceOptions {
  history: PlayerHistory;
  /** null without an API key: popups then show no rank. */
  lookup: RankFetcher | null;
  /** Records a lookup; the resulting line must come back through onLine(). */
  recordLookup: (uid: string, value: LookupValue) => void;
  show: (popup: Popup, trigger: Trigger) => void;
  /** How long a popup waits for a rank before showing without one. */
  lookupTimeoutMs?: number;
}

export class PopupService {
  private readonly tracker: EncounterTracker;
  private readonly lookups = new Map<string, Promise<void>>();

  constructor(private readonly opts: PopupServiceOptions) {
    this.tracker = new EncounterTracker(opts.history);
  }

  onLine(line: RecordLine): void {
    this.opts.history.add(line);
    const { triggers, prefetch } = this.tracker.onLine(line);
    for (const p of prefetch) void this.lookup(p.uid, p.name);
    for (const t of triggers) void this.handle(t);
  }

  private lookup(uid: string, name: string): Promise<void> {
    const client = this.opts.lookup;
    if (!client) return Promise.resolve();
    let pending = this.lookups.get(uid);
    if (!pending) {
      pending = client
        .fetchPlayer({ uid })
        .then(({ status, body }) => {
          const global = (body as { global?: unknown } | null)?.global;
          this.opts.recordLookup(uid, { name, status, ...(global ? { global } : {}) });
        })
        .catch((err: unknown) => this.opts.recordLookup(uid, { name, error: String(err) }));
      this.lookups.set(uid, pending);
    }
    return pending;
  }

  private async handle(t: Trigger): Promise<void> {
    const players: Seen[] = [t.player, ...(t.knockedBy ? [t.knockedBy] : [])];
    const ready = Promise.all(players.filter((p) => p.uid).map((p) => this.lookup(p.uid!, p.name)));
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise((resolve) => (timer = setTimeout(resolve, this.opts.lookupTimeoutMs ?? 3000)));
    await Promise.race([ready, timeout]);
    clearTimeout(timer);
    const { history } = this.opts;
    this.opts.show({
      moment: t.moment,
      at: t.at,
      player: cardFor(t.player, t.matchId, history),
      ...(t.knockedBy ? { knockedBy: cardFor(t.knockedBy, t.matchId, history) } : {}),
    }, t);
  }
}
