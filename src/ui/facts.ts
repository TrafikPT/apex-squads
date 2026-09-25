/**
 * Gold-layer shapes the dashboard consumes (DESIGN.md §4.4). Produced from the
 * recordings by src/build-dataset.ts, or by src/ui/mock-data.ts for sample data.
 */

export type Mode = 'ranked' | 'pubs';

export interface Account {
  accountKey: string;
  alias: string;
  name: string;
  /** Latest RP snapshot for this account, if any. */
  rank?: { tier: string; division: number | null; rp: number };
}

export interface Player {
  playerKey: string;
  name: string;
}

/** f_match: one row per match played by one of my accounts. */
export interface MatchFact {
  matchId: string;
  accountKey: string;
  startedAt: string; // ISO-8601
  mode: Mode;
  map: string;
  legend: string;
  placement: number;
  teams: number;
  kills: number;
  assists: number;
  knocks: number;
  deaths: number;
  damage: number;
  revivesGiven: number;
  revivesReceived: number;
  /**
   * null outside ranked. From the season stats around the match, or, until
   * they arrive (or if they never do), the formula's estimate (rpEstimated).
   */
  rpDelta: number | null;
  /** The account's RP right after the match (first changed snapshot); null when unknown or estimated. */
  rpAfter: number | null;
  /** rpDelta is src/ui/rp-formula.ts's estimate, not the real change. */
  rpEstimated: boolean;
  /** The one or two guns I held longest (GEP's weapon slots); empty without slot data. */
  loadout: string[];
  /** Sorted teammate player keys joined with '|'. */
  squadKey: string;
}

/** f_match_teammate: one row per teammate per match. */
export interface TeammateFact {
  matchId: string;
  playerKey: string;
  legend: string;
  kills: number;
  knocks: number;
  /** From the kill feed (victim = teammate). */
  deaths: number;
}

/**
 * f_weapon_match: my numbers per weapon per match. Damage is attributed to the
 * weapon in hand (an estimate, DESIGN.md §5); 'Other' holds grenade/ability damage.
 */
export interface WeaponFact {
  matchId: string;
  weapon: string;
  kills: number;
  knocks: number;
  damage: number;
}

export interface Dataset {
  accounts: Account[];
  players: Player[];
  matches: MatchFact[];
  teammates: TeammateFact[];
  weapons: WeaponFact[];
  /** Start of the current ranked season (ISO date). */
  seasonStart: string;
}
