/**
 * Keeps the facts behind the title bar's status (src/ui/game-status.ts): what
 * the recorder sees of Apex, where the cards go, and Overwolf's health of
 * Apex's game events from its public status file, read now and then.
 */
import { INITIAL_STATUS, parseEventsHealth, type GameStatus } from './ui/game-status';

export const EVENTS_STATUS_URL = 'https://game-events-status.overwolf.com/21566_prod.json';
/** Overwolf's file lags the real state by about 10 minutes anyway. */
const POLL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 15_000;

export class GameStatusTracker {
  private status: GameStatus = INITIAL_STATUS;
  private readonly listeners: ((status: GameStatus) => void)[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly log: (...args: unknown[]) => void,
    private readonly fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
  ) {}

  get current(): GameStatus {
    return this.status;
  }

  onChange(listener: (status: GameStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  set(change: Partial<GameStatus>): void {
    const next = { ...this.status, ...change };
    if (JSON.stringify(next) === JSON.stringify(this.status)) return;
    this.status = next;
    for (const listener of this.listeners) listener(next);
  }

  /** Reads the status file now and every 10 minutes after. */
  startPolling(): void {
    if (this.timer) return;
    void this.refreshEvents();
    this.timer = setInterval(() => void this.refreshEvents(), POLL_MS);
    this.timer.unref();
  }

  /** Reads the status file now (also when Apex starts, so a launch sees the latest). */
  async refreshEvents(): Promise<void> {
    try {
      const events = parseEventsHealth(await this.fetchJson(EVENTS_STATUS_URL));
      if (!events) throw new Error('unexpected contents');
      const before = this.status.events;
      if (!before || before.state !== events.state || before.disabled !== events.disabled) {
        this.log(`Apex game events status: state ${events.state}${events.disabled ? ', disabled' : ''}` +
          `${events.degraded.length ? `, not fully working: ${events.degraded.join(', ')}` : ''}` +
          `${events.message ? ` ("${events.message}")` : ''}.`);
      }
      this.set({ events });
    } catch (err) {
      // Keep the last known state: a network blip shouldn't clear a real outage.
      this.log(`Couldn't read the Apex game events status: ${String(err)}`);
    }
  }
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
