/** What a popup shows (built by src/encounters.ts, drawn by src/ui/popup.ts). */

export type Moment = 'killed_by' | 'you_killed';

export interface PlayerCard {
  name: string;
  /** Plays in anonymous mode ("Fuse2676"): can't be identified, so no history. */
  anonymous: boolean;
  /** Their kills this match, up to this moment. */
  kills: number;
  /** Most kills in the lobby so far, with at least 3. */
  killLeader: boolean;
  /** When they killed or knocked me: the gun or ability they used, if the kill feed says. */
  weapon: string | null;
  /** When they killed or knocked me: my damage on them this match (armor included). */
  damageFromMe: number | null;
  /** Earlier matches only (this one and any later ones excluded). */
  metBefore: number;
  /** Their K/D over the earlier matches we shared, from the kill feed; null when never met. */
  kd: number | null;
  /** Their kills in those earlier matches (the K/D's sample). */
  killsSeen: number;
  theyKilledMe: number;
  iKilledThem: number;
}

export interface EncounterPopup {
  moment: Moment;
  at: string;
  player: PlayerCard;
  /** When killed: whoever knocked me, if it wasn't the killer. */
  knockedBy?: PlayerCard;
}

/** At match start: opponents who killed me before, or have a high K/D against the lobbies we shared. */
export interface LobbyPopup {
  moment: 'lobby';
  at: string;
  players: PlayerCard[];
}

export type Popup = EncounterPopup | LobbyPopup;
