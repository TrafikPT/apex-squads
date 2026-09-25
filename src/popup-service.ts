/**
 * Popups: every recorded line goes through here. Cards come from our own
 * history of other players, so they show the moment they fire.
 */
import { cardFor, EncounterTracker, lobbyCards } from './encounters';
import type { PlayerHistory } from './player-history';
import type { RecordLine } from './recorder';
import type { Popup } from './ui/popup-card';

export interface PopupServiceOptions {
  history: PlayerHistory;
  show: (popup: Popup, matchId: string) => void;
  /** How long after match_start the lobby card waits for the roster (it arrives within ~0.1 s). */
  lobbyDelayMs?: number;
}

export class PopupService {
  private readonly tracker: EncounterTracker;

  constructor(private readonly opts: PopupServiceOptions) {
    this.tracker = new EncounterTracker(opts.history);
  }

  onLine(line: RecordLine): void {
    const { history } = this.opts;
    history.add(line);
    if (line.kind === 'event' && line.key === 'match_start' && line.match_id) {
      const matchId = line.match_id;
      setTimeout(() => this.showLobby(matchId, line.received_at), this.opts.lobbyDelayMs ?? 2000);
    }
    for (const t of this.tracker.onLine(line)) {
      this.opts.show({
        moment: t.moment,
        at: t.at,
        player: cardFor(t.player, t.matchId, history),
        ...(t.knockedBy ? { knockedBy: cardFor(t.knockedBy, t.matchId, history) } : {}),
      }, t.matchId);
    }
  }

  private showLobby(matchId: string, at: string): void {
    const players = lobbyCards(matchId, this.opts.history);
    if (players.length) this.opts.show({ moment: 'lobby', at, players }, matchId);
  }
}
