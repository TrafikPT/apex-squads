/**
 * Ranked Battle Royale tiers and their RP thresholds (the Season 17 ranked
 * rework's table). Every tier below Master has four divisions, IV (lowest) to
 * I, of equal size. Predator is the top 750 Masters, not a threshold, so it
 * isn't listed. Respawn changes these now and then: check at each season start.
 */
export const TIERS = [
  { tier: 'Rookie', floor: 0, division: 250 },
  { tier: 'Bronze', floor: 1_000, division: 500 },
  { tier: 'Silver', floor: 3_000, division: 600 },
  { tier: 'Gold', floor: 5_400, division: 700 },
  { tier: 'Platinum', floor: 8_200, division: 800 },
  { tier: 'Diamond', floor: 11_400, division: 900 },
  { tier: 'Master', floor: 15_000, division: null },
] as const;

const DIVISIONS = 4;
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

function tierIndex(rp: number): number {
  let i = 0;
  while (i + 1 < TIERS.length && rp >= TIERS[i + 1].floor) i++;
  return i;
}

export function rankOf(rp: number): Rank {
  const t = TIERS[tierIndex(Math.max(0, rp))];
  if (t.division === null) return { tier: t.tier, division: null, floor: t.floor, next: null };
  const step = Math.min(DIVISIONS - 1, Math.floor((Math.max(0, rp) - t.floor) / t.division));
  return { tier: t.tier, division: DIVISIONS - step, floor: t.floor + step * t.division, next: t.floor + (step + 1) * t.division };
}

/** "Gold II", "Master". */
export function rankName(tier: string, division: number | null): string {
  return division === null ? tier : `${tier} ${ROMAN[division - 1]}`;
}

/** Every division floor in [min, max], lowest first. */
export function divisionFloors(min: number, max: number): number[] {
  const floors: number[] = [];
  for (const t of TIERS) {
    const count = t.division === null ? 1 : DIVISIONS;
    for (let d = 0; d < count; d++) {
      const rp = t.floor + d * (t.division ?? 0);
      if (rp >= min && rp <= max) floors.push(rp);
    }
  }
  return floors;
}
