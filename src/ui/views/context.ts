import type { Dataset, MatchFact } from '../facts';
import type { Filters } from '../stats';

export type View = 'overview' | 'squads' | 'weapons' | 'legends' | 'matches' | 'seasons' | 'settings';

/** Everything a view needs to render; views never touch app state directly. */
export interface ViewContext {
  data: Dataset;
  /** Matches after the global filters. */
  matches: MatchFact[];
  filters: Filters;
  setFilters(patch: Partial<Filters>): void;
  setView(view: View, filters?: Partial<Filters>): void;
  playerName(playerKey: string): string;
  /** Teammates with 3+ games together: shown as friends, everyone else is a random. */
  regulars: Set<string>;
  squadOf: Map<string, Set<string>>;
}

export interface ViewResult {
  node: HTMLElement;
  /** Runs after the node is in the document (for anything that needs layout sizes). */
  mounted?: () => void;
}
