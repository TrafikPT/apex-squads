/** What a kill/death popup shows (built by src/encounters.ts, drawn by src/ui/popup.ts). */

export type Moment = 'killed_by' | 'you_killed';

export interface PlayerCard {
  name: string;
  /** Plays in anonymous mode ("Fuse2676"): can't be identified, so no rank or history. */
  anonymous: boolean;
  /** Their kills and knocks this match, up to this moment. */
  kills: number;
  knocks: number;
  /** Most kills in the lobby so far, with at least 3. */
  killLeader: boolean;
  /** Current rank from the API; null without a key, or when the lookup failed. */
  rank: { tier: string; div: number; score: number } | null;
  /** Highest rank we've ever seen for them; only set when above the current one. */
  peak: { tier: string; div: number; season: string | null } | null;
  level: number | null;
  topPercent: number | null;
  /** Earlier matches only (this one excluded). */
  metBefore: number;
  theyKilledMe: number;
  iKilledThem: number;
}

export interface Popup {
  moment: Moment;
  at: string;
  player: PlayerCard;
  /** When killed: whoever knocked me, if it wasn't the killer. */
  knockedBy?: PlayerCard;
  /** Replay preview with made-up ranks. */
  demo?: boolean;
}
