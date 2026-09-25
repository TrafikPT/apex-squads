/**
 * The RP-level axis the rank charts share (Overview's RP chart, Seasons):
 * division gridlines, tier lines, a faint band on every other tier, and the
 * rank's badge mid-band, so the band a point falls in is its rank.
 */
import { svgEl, svgText } from '../dom';
import { rankBadgeSrc } from '../rank-badge';
import { divisionFloors, divisionNumeral, rankName, rankOf, TIERS } from '../ranks';

/** Largest badge on the axis; smaller when the division bands are thinner. */
const BADGE_MAX = 28;
/** Room right of the badge for the division numeral (the badge's own is unreadable this small). */
const NUMERAL_WIDTH = 22;

/** Division floors from the lowest value's division to the start of the one above the highest. */
export function rankTicks(values: number[]): number[] {
  const high = Math.max(...values);
  const top = rankOf(high);
  const ticks = divisionFloors(rankOf(Math.min(...values)).floor, top.next ?? high + 500);
  if (top.next === null) ticks.push(high + 500);
  return ticks;
}

/** Draws the bands, lines and labels between x1 and x2; labels end 8px left of x1. */
export function drawRankAxis(svg: SVGElement, ticks: number[], y: (rp: number) => number, x1: number, x2: number): void {
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  // Every other tier gets a faint band, so tiers read as blocks without colour.
  TIERS.forEach((t, i) => {
    const lo = Math.max(t.floor, yMin);
    const hi = Math.min(TIERS[i + 1]?.floor ?? Infinity, yMax);
    if (i % 2 && hi > lo) svg.append(svgEl('rect', { class: 'band', x: x1, width: x2 - x1, y: y(hi), height: y(lo) - y(hi) }));
  });
  const tierFloors = new Set<number>(TIERS.map((t) => t.floor));
  for (const t of ticks) {
    svg.append(svgEl('line', { class: tierFloors.has(t) ? 'tier-line' : 'gridline', x1, x2, y1: y(t), y2: y(t) }));
  }
  // A badge per division; when divisions get too thin for one, name the tiers instead.
  const label = (text: string, lo: number, hi: number) =>
    svg.append(svgText(text, { class: 'tick', x: x1 - 8, y: (y(lo) + y(hi)) / 2 + 4, 'text-anchor': 'end' }));
  // Divisions differ in size: the thinnest band decides.
  const band = Math.min(...ticks.slice(1).map((t, i) => y(ticks[i]) - y(t)));
  if (ticks.length <= 9 && band >= 16) {
    const size = Math.min(BADGE_MAX, band - 2);
    for (let i = 0; i + 1 < ticks.length; i++) {
      const r = rankOf(ticks[i]);
      const mid = (y(ticks[i]) + y(ticks[i + 1])) / 2;
      const image = svgEl('image', { class: 'axis-badge', href: rankBadgeSrc(r.tier, r.division), width: size, height: size,
        x: x1 - 8 - NUMERAL_WIDTH - size, y: mid - size / 2 });
      svg.append(svgText(divisionNumeral(r.division), { class: 'tick', x: x1 - 8, y: mid + 4, 'text-anchor': 'end' }));
      const name = svgEl('title', {});
      name.textContent = rankName(r.tier, r.division);
      image.append(name);
      svg.append(image);
    }
  } else {
    TIERS.forEach((t, i) => {
      const lo = Math.max(t.floor, yMin);
      const hi = Math.min(TIERS[i + 1]?.floor ?? Infinity, yMax);
      if (y(lo) - y(hi) >= 16) label(t.tier, lo, hi);
    });
  }
}
