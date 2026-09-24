import { el } from '../dom';
import { fixed, pct, place, signed } from '../format';
import { legendBadge } from '../portraits';
import { compStats, CompRow, kpis, Kpis, squadStats, SquadRow, teammateStats, TeammateRow } from '../stats';
import type { ViewContext, ViewResult } from './context';
import { clickable, damageText, headRow, markSample, MIN_SAMPLE, rpCell, rpPerMatch, sampleNote, SortColumn, sortableHead, sortRows,
  SortState, vsAverage } from './shared';

/** Teammates per match besides me (trios). Empty slots are shown as randoms. */
const TEAMMATE_SLOTS = 2;

const COMP_COLUMNS: SortColumn<CompRow>[] = [
  { label: 'Comp' },
  { label: 'Games', value: (r) => r.games, better: 'high' },
  { label: 'Avg place', value: (r) => r.me.avgPlacement, better: 'low' },
  { label: 'vs avg', value: (r) => r.me.avgPlacement, better: 'low' },
  { label: 'Wins', value: (r) => r.me.winRate, better: 'high' },
  { label: 'Top 5', value: (r) => r.me.top5Rate, better: 'high' },
  { label: 'Team kills', value: (r) => r.teamKillsPerMatch, better: 'high' },
  { label: 'Team K/D', value: (r) => r.teamKd, better: 'high' },
  { label: 'Your RP/match', value: (r) => rpPerMatch(r.me), better: 'high' },
];

// View state kept across re-renders.
let mode: 'squads' | 'comps' = new URLSearchParams(location.search).get('squads') === 'comps' ? 'comps' : 'squads';
let compSort: SortState = { column: 1, direction: 'desc' };

export function squadsView(ctx: ViewContext): ViewResult {
  const baseline = kpis(ctx.matches);
  const mates = teammateStats(ctx.data, ctx.matches, ctx.regulars);
  let top: HTMLElement;
  let highlights: HTMLElement;
  if (mode === 'comps') {
    const comps = compStats(ctx.data, ctx.matches, ctx.regulars);
    highlights = compInsights(comps);
    top = compsCard(ctx, comps, baseline);
  } else {
    const squads = squadStats(ctx.data, ctx.matches, ctx.regulars);
    // A friend's portrait is the legend they play most with me, across all history.
    const topLegend = new Map(teammateStats(ctx.data, ctx.data.matches, ctx.regulars, 1).map((t) => [t.playerKey, t.topLegend]));
    highlights = insights(ctx, squads, mates);
    top = squadsCard(ctx, squads, baseline, topLegend);
  }
  return {
    node: el('div', { class: 'view view-squads' },
      highlights,
      el('div', { class: 'squads-grid' }, top, teammatesCard(ctx, mates, baseline)),
    ),
  };
}

/** Card title with the Squads / Comps switch. */
function modeTitle(ctx: ViewContext, aside: string): HTMLElement {
  const toggle = el('div', { class: 'segmented small', role: 'group', 'aria-label': 'Group by' });
  for (const [value, label] of [['squads', 'Squads'], ['comps', 'Comps']] as const) {
    const b = el('button', { type: 'button', 'aria-pressed': String(mode === value) }, label);
    b.addEventListener('click', () => {
      mode = value;
      ctx.setView('squads');
    });
    toggle.append(b);
  }
  return el('h2', { class: 'card-title' }, toggle, el('span', { class: 'aside' }, aside));
}

// ---------------------------------------------------------------- insights

function insights(ctx: ViewContext, squads: SquadRow[], mates: TeammateRow[]): HTMLElement {
  const tile = (label: string, value: string, sub: string) =>
    el('div', { class: 'tile insight' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, value),
      el('div', { class: 'sub' }, sub));

  const most = mates[0];
  const bestSquad = squads
    .filter((s) => s.friends.length && s.games >= MIN_SAMPLE)
    .sort((a, b) => (a.me.avgPlacement ?? 99) - (b.me.avgPlacement ?? 99))[0];
  const bestRp = mates
    .filter((t) => t.games >= MIN_SAMPLE && t.me.rpMatches)
    .sort((a, b) => rpPerMatch(b.me)! - rpPerMatch(a.me)!)[0];
  const solo = squads.find((s) => !s.friends.length);

  return el('div', { class: 'insights' },
    most ? tile('Most played with', ctx.playerName(most.playerKey), `${most.games} games together`)
      : tile('Most played with', '–', 'no regular teammates yet'),
    bestSquad ? tile('Best squad', squadName(ctx, bestSquad.friends), `${place(bestSquad.me.avgPlacement)} avg placement · ${bestSquad.games} games`)
      : tile('Best squad', '–', `needs ${MIN_SAMPLE}+ games together`),
    bestRp ? tile('Best RP partner', ctx.playerName(bestRp.playerKey), `${signed(rpPerMatch(bestRp.me)!)} RP per match · ${bestRp.games} games`)
      : tile('Best RP partner', '–', `needs ${MIN_SAMPLE}+ ranked games together`),
    solo ? tile('Solo queue', place(solo.me.avgPlacement), `avg placement with randoms · ${solo.games} games`)
      : tile('Solo queue', '–', 'no games with only randoms'),
  );
}

// ---------------------------------------------------------------- squads table

function squadsCard(ctx: ViewContext, squads: SquadRow[], baseline: Kpis, topLegend: Map<string, string>): HTMLElement {
  const card = el('section', { class: 'card table-card' }, modeTitle(ctx, 'who you queued with'));
  if (!squads.length) {
    card.append(el('div', { class: 'empty' }, 'No squad with 3+ games in this selection'));
    return card;
  }
  const body = el('tbody', {});
  let faded = false;
  for (const s of squads) {
    const faces = el('span', { class: 'faces' });
    for (const f of s.friends) faces.append(legendBadge(topLegend.get(f) ?? ''));
    for (let i = s.friends.length; i < TEAMMATE_SLOTS; i++) {
      faces.append(el('span', { class: 'legend-badge random', title: 'Random teammate' }, '?'));
    }
    const row = el('tr', {},
      el('td', {}, el('div', { class: 'who' }, faces, el('span', {}, squadName(ctx, s.friends)))),
      el('td', { class: 'num' }, String(s.games)),
      el('td', { class: 'num' }, place(s.me.avgPlacement)),
      vsAverage(baseline, s.me),
      el('td', { class: 'num' }, pct(s.me.winRate)),
      el('td', { class: 'num' }, pct(s.me.top5Rate)),
      el('td', { class: 'num' }, fixed(s.me.avgKills, 2)),
      el('td', { class: 'num' }, damageText(s.me)),
      rpCell(rpPerMatch(s.me)),
    );
    faded = markSample(row, s.games) || faded;
    if (s.friends.length) clickable(row, `Show matches with ${squadName(ctx, s.friends)}`, () => ctx.setView('overview', { withPlayers: s.friends }));
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {},
    el('thead', {}, headRow([['Squad', false], ['Games', true], ['Avg place', true], ['vs avg', true], ['Wins', true],
      ['Top 5', true], ['Your kills', true], ['Your dmg', true], ['RP/match', true]])),
    body)), sampleNote(faded));
  return card;
}

// ---------------------------------------------------------------- teammates table

function teammatesCard(ctx: ViewContext, mates: TeammateRow[], baseline: Kpis): HTMLElement {
  const card = el('section', { class: 'card table-card' },
    el('h2', { class: 'card-title' }, 'Teammates', el('span', { class: 'aside' }, 'their numbers, and yours when playing with them')));
  if (!mates.length) {
    card.append(el('div', { class: 'empty' }, 'No teammate with 3+ games in this selection'));
    return card;
  }
  const body = el('tbody', {});
  let faded = false;
  for (const t of mates) {
    const name = ctx.playerName(t.playerKey);
    const row = el('tr', {},
      el('td', {}, el('div', { class: 'who' }, legendBadge(t.topLegend), el('span', {}, name))),
      el('td', { class: 'num' }, String(t.games)),
      el('td', { class: 'num' }, t.killsPerGame.toFixed(2)),
      el('td', { class: 'num' }, t.knocksPerGame.toFixed(2)),
      el('td', { class: 'num' }, place(t.me.avgPlacement)),
      vsAverage(baseline, t.me),
      el('td', { class: 'num' }, fixed(t.me.avgKills, 2)),
      el('td', { class: 'num' }, damageText(t.me)),
      rpCell(rpPerMatch(t.me)),
    );
    faded = markSample(row, t.games) || faded;
    clickable(row, `Show matches with ${name}`, () => ctx.setView('overview', { withPlayers: [t.playerKey] }));
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {},
    el('thead', {}, headRow([['Player', false], ['Games', true], ['Their kills', true], ['Their knocks', true],
      ['Your place', true], ['vs avg', true], ['Your kills', true], ['Your dmg', true], ['RP/match', true]])),
    body)), sampleNote(faded));
  return card;
}

// ---------------------------------------------------------------- helpers

function squadName(ctx: ViewContext, friends: string[]): string {
  if (!friends.length) return 'Solo queue';
  const names = friends.map((f) => ctx.playerName(f));
  return friends.length === 1 ? `${names[0]} + random` : names.join(' + ');
}

// ---------------------------------------------------------------- comps

function compFaces(legends: string[]): HTMLElement {
  const faces = el('span', { class: 'faces' });
  for (const l of legends) faces.append(legendBadge(l));
  return faces;
}

function compInsights(comps: CompRow[]): HTMLElement {
  const eligible = comps.filter((c) => c.games >= MIN_SAMPLE);
  const best = (value: (c: CompRow) => number | null, better: 'high' | 'low') =>
    eligible.filter((c) => value(c) !== null)
      .sort((a, b) => (better === 'high' ? value(b)! - value(a)! : value(a)! - value(b)!))[0];
  const tile = (label: string, comp: CompRow | undefined, sub: (c: CompRow) => string, empty: string) =>
    el('div', { class: 'tile insight comp-insight' },
      el('div', { class: 'label' }, label),
      comp ? compFaces(comp.legends) : el('div', { class: 'value' }, '–'),
      el('div', { class: 'sub' }, comp ? sub(comp) : empty));
  const need = `needs ${MIN_SAMPLE}+ premade games with a comp`;
  const mostPlayed = comps[0];
  return el('div', { class: 'insights' },
    tile('Most played comp', mostPlayed, (c) => `${c.games} games`, 'no comp with 3+ premade games'),
    tile('Best placement', best((c) => c.me.avgPlacement, 'low'), (c) => `${place(c.me.avgPlacement)} avg · ${c.games} games`, need),
    tile('Best team K/D', best((c) => c.teamKd, 'high'), (c) => `${c.teamKd.toFixed(2)} team K/D · ${c.games} games`, need),
    tile('Best for your RP', best((c) => rpPerMatch(c.me), 'high'), (c) => `${signed(rpPerMatch(c.me)!)} RP per match · ${c.games} games`, need),
  );
}

function compsCard(ctx: ViewContext, comps: CompRow[], baseline: Kpis): HTMLElement {
  const card = el('section', { class: 'card table-card' },
    modeTitle(ctx, 'full premades only · RP is yours · team damage needs the summary-screen data'));
  if (!comps.length) {
    card.append(el('div', { class: 'empty' }, 'No comp with 3+ full-premade games in this selection'));
    return card;
  }
  const head = sortableHead(COMP_COLUMNS, compSort, (next) => {
    compSort = next;
    ctx.setView('squads');
  });
  const body = el('tbody', {});
  let faded = false;
  for (const c of sortRows(comps, COMP_COLUMNS, compSort)) {
    const row = el('tr', {},
      el('td', {}, el('div', { class: 'who' }, compFaces(c.legends), el('span', { class: 'comp-names' }, c.legends.join(' · ')))),
      el('td', { class: 'num' }, String(c.games)),
      el('td', { class: 'num' }, place(c.me.avgPlacement)),
      vsAverage(baseline, c.me),
      el('td', { class: 'num' }, pct(c.me.winRate)),
      el('td', { class: 'num' }, pct(c.me.top5Rate)),
      el('td', { class: 'num' }, c.teamKillsPerMatch.toFixed(1)),
      el('td', { class: 'num' }, c.teamKd.toFixed(2)),
      rpCell(rpPerMatch(c.me)),
    );
    faded = markSample(row, c.games) || faded;
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, head), body)), sampleNote(faded));
  return card;
}
