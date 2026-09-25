/**
 * Ranked RP for one match, estimated from placement, kills and assists: shown
 * until GEP's season stats bring the real RP (15-30 s after the match), and
 * kept for matches whose real RP never came.
 *
 * Season 30 table from apexseasons.online's calculator, with the placement
 * bands corrected from real matches without kills or assists (9th-10th are
 * worth 10, 11th-15th 5). On 34 real matches (2026-09-25) it was exact for 16,
 * within 10 RP for 29, off by 4.6 RP on average: GEP's assists aren't always
 * the game's. Respawn retunes it most seasons: check it against real RP then.
 */
import { rankOf } from './ranks';

/** By placement; 16th and below: 0. */
const PLACEMENT_RP = [125, 95, 70, 55, 45, 30, 20, 20, 10, 10, 5, 5, 5, 5, 5];
/** Per kill or assist, by placement; 13th and below: 10. */
const KILL_RP = [26, 22, 18, 16, 16, 16, 14, 14, 14, 12, 12, 12];
const ENTRY_COST: Record<string, number> = {
  Rookie: 0, Bronze: 10, Silver: 20, Gold: 38, Platinum: 48, Diamond: 65, Master: 90,
};
/** Kills and assists past this count half. */
const FULL_KILLS = 8;

export interface RpInput {
  placement: number;
  kills: number;
  assists: number;
  /** RP before the match, for the tier's entry cost. */
  rpBefore: number;
  /** Top-5 finishes in a row, this match included (0 if it wasn't top 5). */
  topFiveStreak: number;
}

export function estimateRp(m: RpInput): number {
  const i = m.placement - 1;
  const takedowns = m.kills + m.assists;
  const counted = Math.min(takedowns, FULL_KILLS) + Math.max(0, takedowns - FULL_KILLS) / 2;
  // +10 for the 2nd top-5 in a row, up to +40 from the 5th on.
  const streak = m.topFiveStreak < 2 ? 0 : Math.min(40, (m.topFiveStreak - 1) * 10);
  return Math.round(
    -(ENTRY_COST[rankOf(m.rpBefore).tier] ?? 0) + (PLACEMENT_RP[i] ?? 0) + (KILL_RP[i] ?? 10) * counted + streak,
  );
}
