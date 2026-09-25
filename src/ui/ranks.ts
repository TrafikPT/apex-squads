/**
 * Ranked Battle Royale tiers in Season 30: the RP where each division starts,
 * IV (lowest) first. Divisions aren't all the same size (Platinum III→II is
 * 750, II→I 1,000). Our own data agrees: RP stopped falling at 8,500 (the
 * Platinum IV floor) and the API calls 8,408 Gold I and 8,642 Platinum IV.
 * The Silver I → Gold IV step comes from one guide only (lfcarry.com; another
 * says Gold starts at 5,250). Predator is the top 750 Masters, not a
 * threshold, so it isn't listed. Respawn retunes these: check each season.
 */
const TABLE = [
  { tier: 'Rookie', divisions: [0, 250, 500, 750] },
  { tier: 'Bronze', divisions: [1_000, 1_500, 2_000, 2_500] },
  { tier: 'Silver', divisions: [3_000, 3_500, 4_000, 4_500] },
  { tier: 'Gold', divisions: [5_500, 6_250, 7_000, 7_750] },
  { tier: 'Platinum', divisions: [8_500, 9_250, 10_000, 11_000] },
  { tier: 'Diamond', divisions: [12_000, 13_000, 14_000, 15_000] },
  { tier: 'Master', divisions: [16_000] },
] as const;

/** Each tier and the RP where it starts. */
export const TIERS = TABLE.map((t) => ({ tier: t.tier, floor: t.divisions[0] }));

const ROMAN = ['I', 'II', 'III', 'IV'];

export interface Rank {
  tier: string;
  /** 4 (lowest) to 1; null for Master. */
  division: number | null;
  /** RP where this rank starts. */
  floor: number;
  /** RP where the next rank starts; null for Master. */
  next: number | null;
}

/** Every rank from Rookie IV up, with where it starts and where the next one does. */
const RANKS: Rank[] = TABLE.flatMap((t, ti) => t.divisions.map((floor, i): Rank => ({
  tier: t.tier,
  division: t.divisions.length === 1 ? null : t.divisions.length - i,
  floor,
  next: t.divisions[i + 1] ?? TABLE[ti + 1]?.divisions[0] ?? null,
})));

export function rankOf(rp: number): Rank {
  let found = RANKS[0];
  for (const r of RANKS) if (Math.max(0, rp) >= r.floor) found = r;
  return { ...found };
}

/** "Gold II", "Master". */
export function rankName(tier: string, division: number | null): string {
  return division === null ? tier : `${tier} ${divisionNumeral(division)}`;
}

/** "II" for division 2; "" for Master and Predator. */
export function divisionNumeral(division: number | null): string {
  return division === null ? '' : ROMAN[division - 1];
}

/** Every division floor in [min, max], lowest first. */
export function divisionFloors(min: number, max: number): number[] {
  return RANKS.map((r) => r.floor).filter((rp) => rp >= min && rp <= max);
}
