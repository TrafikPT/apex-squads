import { el } from '../dom';

/** Teammates per match besides me (trios). Empty slots are shown as randoms. */
const TEAMMATE_SLOTS = 2;
import { fixed, pct, place, signed } from '../format';
import { legendBadge } from '../portraits';
import { kpis, Kpis, squadStats, SquadRow, teammateStats, TeammateRow } from '../stats';
import type { ViewContext, ViewResult } from './context';
import { clickable, damageText, headRow, rpCell, rpPerMatch, vsAverage } from './shared';

/** Minimum games before a squad or teammate can be called "best". */
const MIN_GAMES_FOR_BEST = 5;

export function squadsView(ctx: ViewContext): ViewResult {
  const baseline = kpis(ctx.matches);
  const squads = squadStats(ctx.data, ctx.matches, ctx.regulars);
  const mates = teammateStats(ctx.data, ctx.matches, ctx.regulars);
  // A friend's portrait is the legend they play most with me, across all history.
  const topLegend = new Map(teammateStats(ctx.data, ctx.data.matches, ctx.regulars, 1).map((t) => [t.playerKey, t.topLegend]));

  return {
    node: el('div', { class: 'view view-squads' },
      insights(ctx, squads, mates),
      el('div', { class: 'squads-grid' },
        squadsCard(ctx, squads, baseline, topLegend),
        teammatesCard(ctx, mates, baseline),
      ),
    ),
  };
}

// ---------------------------------------------------------------- insights

function insights(ctx: ViewContext, squads: SquadRow[], mates: TeammateRow[]): HTMLElement {
  const tile = (label: string, value: string, sub: string) =>
    el('div', { class: 'tile insight' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, value),
      el('div', { class: 'sub' }, sub));

  const most = mates[0];
  const bestSquad = squads
    .filter((s) => s.friends.length && s.games >= MIN_GAMES_FOR_BEST)
    .sort((a, b) => (a.me.avgPlacement ?? 99) - (b.me.avgPlacement ?? 99))[0];
  const bestRp = mates
    .filter((t) => t.games >= MIN_GAMES_FOR_BEST && t.me.rpMatches)
    .sort((a, b) => rpPerMatch(b.me)! - rpPerMatch(a.me)!)[0];
  const solo = squads.find((s) => !s.friends.length);

  return el('div', { class: 'insights' },
    most ? tile('Most played with', ctx.playerName(most.playerKey), `${most.games} games together`)
      : tile('Most played with', '–', 'no regular teammates yet'),
    bestSquad ? tile('Best squad', squadName(ctx, bestSquad.friends), `${place(bestSquad.me.avgPlacement)} avg placement · ${bestSquad.games} games`)
      : tile('Best squad', '–', `needs ${MIN_GAMES_FOR_BEST}+ games together`),
    bestRp ? tile('Best RP partner', ctx.playerName(bestRp.playerKey), `${signed(rpPerMatch(bestRp.me)!)} RP per match · ${bestRp.games} games`)
      : tile('Best RP partner', '–', `needs ${MIN_GAMES_FOR_BEST}+ ranked games together`),
    solo ? tile('Solo queue', place(solo.me.avgPlacement), `avg placement with randoms · ${solo.games} games`)
      : tile('Solo queue', '–', 'no games with only randoms'),
  );
}

// ---------------------------------------------------------------- squads table

function squadsCard(ctx: ViewContext, squads: SquadRow[], baseline: Kpis, topLegend: Map<string, string>): HTMLElement {
  const card = el('section', { class: 'card table-card' },
    el('h2', { class: 'card-title' }, 'Squads', el('span', { class: 'aside' }, 'who you queued with')));
  if (!squads.length) {
    card.append(el('div', { class: 'empty' }, 'No squad with 3+ games in this selection'));
    return card;
  }
  const body = el('tbody', {});
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
    if (s.friends.length) clickable(row, `Show matches with ${squadName(ctx, s.friends)}`, () => ctx.setView('overview', { withPlayers: s.friends }));
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {},
    el('thead', {}, headRow([['Squad', false], ['Games', true], ['Avg place', true], ['vs avg', true], ['Wins', true],
      ['Top 5', true], ['Your kills', true], ['Your dmg', true], ['RP/match', true]])),
    body)));
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
    clickable(row, `Show matches with ${name}`, () => ctx.setView('overview', { withPlayers: [t.playerKey] }));
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {},
    el('thead', {}, headRow([['Player', false], ['Games', true], ['Their kills', true], ['Their knocks', true],
      ['Your place', true], ['vs avg', true], ['Your kills', true], ['Your dmg', true], ['RP/match', true]])),
    body)));
  return card;
}

// ---------------------------------------------------------------- helpers

function squadName(ctx: ViewContext, friends: string[]): string {
  if (!friends.length) return 'Solo queue';
  const names = friends.map((f) => ctx.playerName(f));
  return friends.length === 1 ? `${names[0]} + random` : names.join(' + ');
}
