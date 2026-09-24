import { el } from '../dom';
import { fixed, fmtInt, pct, place, signed } from '../format';
import { legendBadge } from '../portraits';
import { kpis, Kpis, legendStats, LegendRow } from '../stats';
import type { ViewContext, ViewResult } from './context';
import { clickable, damageText, markSample, MIN_SAMPLE, rpCell, rpPerMatch, sampleNote, SortColumn, sortableHead, sortRows, SortState,
  vsAverage } from './shared';

const COLUMNS: SortColumn<LegendRow>[] = [
  { label: 'Legend' },
  { label: 'Games', value: (r) => r.games, better: 'high' },
  { label: 'Avg place', value: (r) => r.me.avgPlacement, better: 'low' },
  { label: 'vs avg', value: (r) => r.me.avgPlacement, better: 'low' },
  { label: 'Wins', value: (r) => r.me.winRate, better: 'high' },
  { label: 'Top 5', value: (r) => r.me.top5Rate, better: 'high' },
  { label: 'K/D', value: (r) => r.me.kd, better: 'high' },
  { label: 'Avg kills', value: (r) => r.me.avgKills, better: 'high' },
  { label: 'Avg dmg', value: (r) => r.me.avgDamage, better: 'high' },
  { label: 'RP/match', value: (r) => rpPerMatch(r.me), better: 'high' },
];

/** Current sort, kept across re-renders. */
let sort: SortState = { column: 1, direction: 'desc' };

export function legendsView(ctx: ViewContext): ViewResult {
  const rows = legendStats(ctx.matches);
  return {
    node: el('div', { class: 'view view-legends' },
      insights(rows),
      legendsCard(ctx, rows, kpis(ctx.matches)),
    ),
  };
}

// ---------------------------------------------------------------- insights

function insights(rows: LegendRow[]): HTMLElement {
  const eligible = rows.filter((r) => r.games >= MIN_SAMPLE);
  const best = (value: (r: LegendRow) => number | null, better: 'high' | 'low') =>
    eligible
      .filter((r) => value(r) !== null)
      .sort((a, b) => (better === 'high' ? value(b)! - value(a)! : value(a)! - value(b)!))[0];

  const tile = (label: string, row: LegendRow | undefined, sub: (r: LegendRow) => string, empty: string) =>
    el('div', { class: 'tile insight with-portrait' },
      row ? legendBadge(row.legend) : el('span', { class: 'legend-badge random' }, '?'),
      el('div', { class: 'insight-text' },
        el('div', { class: 'label' }, label),
        el('div', { class: 'value' }, row?.legend ?? '–'),
        el('div', { class: 'sub' }, row ? sub(row) : empty),
      ),
    );

  const need = `needs ${MIN_SAMPLE}+ games on a legend`;
  return el('div', { class: 'insights' },
    tile('Most played', rows[0], (r) => `${r.games} games · ${pct(r.pickRate)} of matches`, 'no matches yet'),
    tile('Best placement', best((r) => r.me.avgPlacement, 'low'), (r) => `${place(r.me.avgPlacement)} avg · ${r.games} games`, need),
    tile('Best RP', best((r) => rpPerMatch(r.me), 'high'), (r) => `${signed(rpPerMatch(r.me)!)} RP per match · ${r.games} games`, need),
    tile('Best K/D', best((r) => r.me.kd, 'high'), (r) => `${fixed(r.me.kd, 2)} K/D · ${r.games} games`, need),
  );
}

// ---------------------------------------------------------------- table

function legendsCard(ctx: ViewContext, rows: LegendRow[], baseline: Kpis): HTMLElement {
  const card = el('section', { class: 'card table-card' },
    el('h2', { class: 'card-title' }, 'Legends', el('span', { class: 'aside' }, 'click a header to sort · click a legend to filter')));
  if (!rows.length) {
    card.append(el('div', { class: 'empty' }, 'No matches for these filters'));
    return card;
  }

  const sorted = sortRows(rows, COLUMNS, sort);
  const maxGames = Math.max(...rows.map((r) => r.games));
  const head = sortableHead(COLUMNS, sort, (next) => {
    sort = next;
    ctx.setView('legends');
  });

  const body = el('tbody', {});
  let faded = false;
  for (const r of sorted) {
    const row = el('tr', {},
      el('td', {}, el('div', { class: 'who' }, legendBadge(r.legend), el('span', { class: 'legend-name' }, r.legend))),
      el('td', { class: 'num' }, el('div', { class: 'games-cell' },
        el('div', { class: 'bar-track' }, el('div', { class: 'bar', style: `width: ${(r.games / maxGames) * 100}%` })),
        el('span', {}, fmtInt(r.games)))),
      el('td', { class: 'num' }, place(r.me.avgPlacement)),
      vsAverage(baseline, r.me),
      el('td', { class: 'num' }, pct(r.me.winRate)),
      el('td', { class: 'num' }, pct(r.me.top5Rate)),
      el('td', { class: 'num' }, fixed(r.me.kd, 2)),
      el('td', { class: 'num' }, fixed(r.me.avgKills, 2)),
      el('td', { class: 'num' }, damageText(r.me)),
      rpCell(rpPerMatch(r.me)),
    );
    faded = markSample(row, r.games) || faded;
    clickable(row, `Show matches as ${r.legend}`, () => ctx.setView('overview', { legend: r.legend }));
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', { class: 'legends-table' }, el('thead', {}, head), body)), sampleNote(faded));
  return card;
}
