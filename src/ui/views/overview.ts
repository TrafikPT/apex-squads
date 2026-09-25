import { el, svgEl, svgText } from '../dom';
import type { MatchFact } from '../facts';
import { dayTime, fixed, fmtDateTime, fmtDay, fmtInt, niceTicks, pct, signed, xTickIndices } from '../format';
import { legendBadge } from '../portraits';
import { rankName, rankOf } from '../ranks';
import { kpis, rankedAccount, rankGames, rpByDay } from '../stats';
import type { ViewContext, ViewResult } from './context';
import { openMatch } from './matches';
import { drawRankAxis, rankTicks } from './rank-axis';
import { clickable, MIN_SAMPLE, rpText } from './shared';

/**
 * Insight cards under the headline numbers. Each returns null when it has
 * nothing worth saying for the selection, so the row only shows what's
 * relevant; removing a card is deleting its entry.
 */
const INSIGHT_CARDS: ((ctx: ViewContext) => HTMLElement | null)[] = [
  (ctx) => gameCard(ctx, 'best'),
  (ctx) => gameCard(ctx, 'worst'),
];

export function overviewView(ctx: ViewContext): ViewResult {
  const { card, draw } = rpCard(ctx.matches);
  const cards = INSIGHT_CARDS.map((c) => c(ctx)).filter((c) => c !== null);
  return {
    node: el('div', { class: 'view view-overview' },
      card,
      el('div', { class: 'overview-side' }, tiles(ctx.matches), cards.length ? el('div', { class: 'insights' }, ...cards) : ''),
    ),
    mounted: draw,
  };
}

/** One point per play day: the net RP running total, or the RP level reached (rank mode). */
interface ChartPoint {
  day: string;
  value: number;
  delta: number;
  matches: number;
}

/**
 * Net RP over the selection. When it covers one account the chart shows that
 * account's RP level against the rank thresholds; RP levels of several
 * accounts can't be added up, so across accounts it shows the running total.
 */
function rpCard(matches: MatchFact[]): { card: HTMLElement; draw?: () => void } {
  const k = kpis(matches);
  const card = el('section', { class: 'card rp-card' }, el('h2', { class: 'card-title' }, 'Net RP'));
  if (k.rpNet === null) {
    card.append(el('div', { class: 'hero' }, '–'), el('div', { class: 'empty' }, 'No ranked matches in this selection'));
    return { card };
  }
  const days = rpByDay(matches);
  const single = rankedAccount(matches) !== null;
  const levels = single ? days.filter((p) => p.level !== null) : [];
  const games = `${k.rpMatches} ranked ${k.rpMatches === 1 ? 'match' : 'matches'}`;
  let sub: string;
  if (levels.length) {
    const first = levels[0];
    const from = rankOf(first.level! - first.delta);
    const to = rankOf(levels[levels.length - 1].level!);
    sub = `${rankName(from.tier, from.division)} → ${rankName(to.tier, to.division)} · ${games}`;
  } else {
    sub = `over ${games} · running total by day${single ? '' : ' · pick one account to see your rank'}`;
  }
  const host = el('div', { class: 'chart' });
  card.append(el('div', { class: `hero ${k.rpNet >= 0 ? 'good' : 'bad'}` }, signed(k.rpNet)), el('div', { class: 'hero-sub' }, sub), host);
  const draw = levels.length
    ? () => drawRpChart(host, levels.map((p) => ({ ...p, value: p.level! })), true)
    : () => drawRpChart(host, days.map((p) => ({ ...p, value: p.cumulative })), false);
  return { card, draw };
}

function tiles(matches: MatchFact[]): HTMLElement {
  const k = kpis(matches);
  const tile = (label: string, value: string) =>
    el('div', { class: 'tile' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, value));
  return el('div', { class: 'tiles' },
    tile('Matches', fmtInt(k.matches)),
    tile('Avg placement', k.avgPlacement === null ? '–' : `#${k.avgPlacement.toFixed(1)}`),
    tile('Wins', pct(k.winRate)),
    tile('Top 5', pct(k.top5Rate)),
    tile('K/D', fixed(k.kd, 2)),
    tile('Avg kills', fixed(k.avgKills, 2)),
    tile('Avg damage', k.avgDamage === null ? '–' : fmtInt(Math.round(k.avgDamage))),
    tile('Avg revives', fixed(k.avgRevives, 2)),
  );
}

/** The selection's best or worst game (see rankGames); opens its details. */
function gameCard(ctx: ViewContext, which: 'best' | 'worst'): HTMLElement | null {
  if (ctx.matches.length < MIN_SAMPLE) return null;
  const ranked = rankGames(ctx.matches);
  const m = which === 'best' ? ranked[0] : ranked[ranked.length - 1];
  const sub = [`${fmtInt(m.damage)} dmg`, m.rpDelta === null ? '' : `${rpText(m.rpDelta, m.rpEstimated)} RP`, fmtDateTime(m.startedAt)];
  const card = el('div', { class: 'tile insight with-portrait' },
    legendBadge(m.legend),
    el('div', { class: 'insight-text' },
      el('div', { class: 'label' }, which === 'best' ? 'Best game' : 'Worst game'),
      el('div', { class: 'value' }, `#${m.placement} · ${m.kills} ${m.kills === 1 ? 'kill' : 'kills'}`),
      el('div', { class: 'sub' }, sub.filter(Boolean).join(' · ')),
    ),
  );
  clickable(card, 'Show match details', () => {
    openMatch(m.matchId);
    ctx.setView('matches');
  });
  return card;
}

function drawRpChart(host: HTMLElement, points: ChartPoint[], ranked: boolean): void {
  const width = host.clientWidth || 600;
  const height = Math.max(170, host.clientHeight);
  const m = { top: 8, right: 12, bottom: 22, left: ranked ? 80 : 44 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const times = points.map((p) => dayTime(p.day));
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const x = (t: number) => m.left + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const values = points.map((p) => p.value);
  const ticks = ranked ? rankTicks(values) : niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => m.top + h - ((v - yMin) / (yMax - yMin || 1)) * h;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0',
    'aria-label': ranked ? `RP level by play day against the rank thresholds, ${points.length} play days`
      : `Net RP running total, ${points.length} play days` });
  if (ranked) {
    drawRankAxis(svg, ticks, y, m.left, width - m.right);
  } else {
    for (const t of ticks) {
      svg.append(
        svgEl('line', { class: t === 0 ? 'zero' : 'gridline', x1: m.left, x2: width - m.right, y1: y(t), y2: y(t) }),
        svgText(fmtInt(t), { class: 'tick', x: m.left - 8, y: y(t) + 4, 'text-anchor': 'end' }),
      );
    }
  }
  for (const i of xTickIndices(points.length, Math.max(2, Math.floor(w / 110)))) {
    svg.append(svgText(fmtDay(points[i].day), {
      class: 'tick', x: x(times[i]), y: height - 4,
      'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
    }));
  }
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  // The area shades gains and losses against zero; an RP level has no zero line to shade to.
  if (!ranked) {
    const area = `${line}L${x(t1).toFixed(1)},${y(0).toFixed(1)}L${x(t0).toFixed(1)},${y(0).toFixed(1)}Z`;
    svg.append(svgEl('path', { class: 'area', d: area }));
  }
  svg.append(svgEl('path', { class: 'line', d: line }));
  const last = points[points.length - 1];
  svg.append(svgEl('circle', { class: 'dot', cx: x(t1), cy: y(last.value), r: 4 }));

  // Hover / focus layer: crosshair snaps to the nearest play day.
  const cross = svgEl('line', { class: 'crosshair', y1: m.top, y2: m.top + h, visibility: 'hidden' });
  const hoverDot = svgEl('circle', { class: 'dot', r: 5, visibility: 'hidden' });
  const hit = svgEl('rect', { x: m.left, y: 0, width: w, height, fill: 'transparent' });
  svg.append(cross, hoverDot, hit);
  const tip = el('div', { class: 'tooltip', hidden: '' });
  host.replaceChildren(svg, tip);

  let active = -1;
  const show = (i: number) => {
    active = i;
    const p = points[i];
    const px = x(times[i]);
    const py = y(p.value);
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', String(px));
    hoverDot.setAttribute('cy', String(py));
    hoverDot.setAttribute('visibility', 'visible');
    const r = rankOf(p.value);
    tip.replaceChildren(
      el('div', { class: 't-value' }, ranked ? `${fmtInt(p.value)} RP` : signed(p.value)),
      el('div', {}, el('span', { class: 't-key' }), ranked ? rankName(r.tier, r.division) : 'Net RP so far'),
      el('div', { class: 't-muted' }, `${fmtDay(p.day)} · ${signed(p.delta)} that day · ${p.matches} ${p.matches === 1 ? 'match' : 'matches'}`),
    );
    tip.hidden = false;
    const scale = host.clientWidth / width;
    tip.style.left = `${Math.min(Math.max(px * scale + 12, 0), host.clientWidth - 180)}px`;
    tip.style.top = `${Math.max(py * scale - 70, 0)}px`;
  };
  const hide = () => {
    active = -1;
    cross.setAttribute('visibility', 'hidden');
    hoverDot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  hit.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * width;
    let best = 0;
    for (let i = 1; i < times.length; i++) if (Math.abs(x(times[i]) - px) < Math.abs(x(times[best]) - px)) best = i;
    show(best);
  });
  hit.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(points.length - 1));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(Math.max(0, (active < 0 ? points.length : active) - 1));
    else if (e.key === 'ArrowRight') show(Math.min(points.length - 1, active + 1));
    else return;
    e.preventDefault();
  });
}
