/**
 * Gold-layer shapes the dashboard consumes (DESIGN.md §4.4). Real data will
 * come from the DuckDB gold views; for now src/ui/mock-data.ts produces them.
 */

export type Mode = 'ranked' | 'pubs';

export interface Account {
  accountKey: string;
  alias: string;
  name: string;
  /** Latest RP snapshot for this account, if any. */
  rank?: { tier: string; division: number; rp: number };
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
  /** null outside ranked, or when no RP snapshot bracketed the match. */
  rpDelta: number | null;
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
