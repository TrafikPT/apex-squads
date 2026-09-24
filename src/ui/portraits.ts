import { el } from './dom';

/** Fallback codes when a legend has no portrait yet (e.g. a brand-new legend). */
const LEGEND_CODES: Record<string, string> = {
  Bangalore: 'BG', Bloodhound: 'BH', Pathfinder: 'PF', Horizon: 'HZ', Wraith: 'WR', Octane: 'OC',
  Newcastle: 'NC', Lifeline: 'LL', Valkyrie: 'VK', Gibraltar: 'GB', Caustic: 'CS', Crypto: 'CR',
};

/** Legend portrait from ui/assets/legends (scripts/fetch-legend-portraits.mjs), or a short code if missing. */
export function legendBadge(legend: string): HTMLElement {
  const badge = el('span', { class: 'legend-badge', title: legend });
  const img = el('img', { src: `assets/legends/${legend.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`, alt: legend }) as HTMLImageElement;
  img.addEventListener('error', () => badge.replaceChildren(LEGEND_CODES[legend] ?? legend.slice(0, 2).toUpperCase()));
  badge.append(img);
  return badge;
}
