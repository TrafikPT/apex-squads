import { el } from './dom';
import { divisionNumeral, rankName } from './ranks';

/** The game's badge for a rank, from ui/assets/ranks (scripts/fetch-rank-badges.mjs). */
export function rankBadgeSrc(tier: string, division: number | null): string {
  const slug = tier.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `assets/ranks/${division === null ? slug : `${slug}-${division}`}.png`;
}

/** Badge image named by its title; the rank's name as text if the image is missing. */
export function rankBadge(tier: string, division: number | null, title = rankName(tier, division)): HTMLElement {
  const img = el('img', { class: 'rank-badge', src: rankBadgeSrc(tier, division), alt: rankName(tier, division), title }) as HTMLImageElement;
  img.addEventListener('error', () => img.replaceWith(el('span', { title }, rankName(tier, division))));
  return img;
}

/**
 * Badge plus the division as text ("[badge] IV"): at table size the numeral
 * on the badge itself is too small to read.
 */
export function rankLabel(tier: string, division: number | null, title = rankName(tier, division)): HTMLElement {
  return el('span', { class: 'rank-label', title }, rankBadge(tier, division, title),
    el('span', { class: 'division' }, divisionNumeral(division)));
}
