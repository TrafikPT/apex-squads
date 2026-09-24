import { el, svgEl, svgText } from '../dom';
import type { MatchFact } from '../facts';
import { dayTime, fixed, fmtDateTime, fmtDay, fmtInt, niceTicks, pct, signed, xTickIndices } from '../format';
import { legendBadge } from '../portraits';
import { openMatch } from './matches';
import { kpis, rpByDay, RpPoint } from '../stats';
import type { ViewContext, ViewResult } from './context';

export function overviewView(ctx: ViewContext): ViewResult {
  const { card, points, host } = rpCard(ctx.matches);
  return {
    node: el('div', { class: 'view view-overview' },
      el('div', { class: 'top' }, card, tiles(ctx.matches)),
      recentMatches(ctx),
    ),
    mounted: () => {
      if (host) drawRpChart(host, points);
    },
  };
}

function rpCard(matches: MatchFact[]) {
  const k = kpis(matches);
  const card = el('section', { class: 'card' }, el('h2', { class: 'card-title' }, 'Net RP'));
  if (k.rpNet === null) {
    card.append(el('div', { class: 'hero' }, '–'), el('div', { class: 'empty' }, 'No ranked matches in this selection'));
    return { card, points: [], host: null };
  }
  const host = el('div', { class: 'chart' });
  card.append(
    el('div', { class: `hero ${k.rpNet >= 0 ? 'good' : 'bad'}` }, signed(k.rpNet)),
    el('div', { class: 'hero-sub' }, `over ${k.rpMatches} ranked ${k.rpMatches === 1 ? 'match' : 'matches'} · running total by day`),
    host,
  );
  return { card, points: rpByDay(matches), host };
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

function recentMatches(ctx: ViewContext): HTMLElement {
  const sorted = [...ctx.matches].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const card = el('section', { class: 'card table-card' },
    el('h2', { class: 'card-title' }, 'Recent matches', el('span', { class: 'aside' }, `${sorted.length} in selection`)));
  if (!sorted.length) {
    card.append(el('div', { class: 'empty' }, 'No matches for these filters'));
    return card;
  }
  const head = el('tr', {});
  const cols: [string, boolean][] = [['Legend', false], ['Date', false], ['Squad', false],
    ['Place', true], ['K / A / Kn', true], ['Damage', true], ['RP', true]];
  for (const [label, num] of cols) head.append(el('th', { class: num ? 'num' : '' }, label));

  const body = el('tbody', {});
  for (const m of sorted.slice(0, 100)) {
    const squad = el('td', {});
    [...(ctx.squadOf.get(m.matchId) ?? [])].forEach((p, i) => {
      if (i) squad.append(', ');
      squad.append(el('span', { class: ctx.regulars.has(p) ? 'squad-friend' : 'squad-random' }, ctx.playerName(p)));
    });
    const rp = el('td', { class: 'num' });
    if (m.rpDelta === null) rp.append(el('span', { class: 'muted' }, '–'));
    else rp.append(el('span', { class: m.rpDelta >= 0 ? 'good' : 'bad' }, signed(m.rpDelta)));
    const row = el('tr', { class: 'clickable', tabindex: '0', title: 'Show match details' },
      el('td', { class: 'legend-col' }, legendBadge(m.legend)),
      el('td', {}, fmtDateTime(m.startedAt)),
      squad,
      el('td', { class: 'num' }, el('span', { class: `place${m.placement === 1 ? ' win' : ''}` }, `#${m.placement}`)),
      el('td', { class: 'num' }, `${m.kills} / ${m.assists} / ${m.knocks}`),
      el('td', { class: 'num' }, fmtInt(m.damage)),
      rp,
    );
    const open = () => {
      openMatch(m.matchId);
      ctx.setView('matches');
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, head), body)));
  return card;
}

function drawRpChart(host: HTMLElement, points: RpPoint[]): void {
  const width = host.clientWidth || 600;
  const height = 170;
  const m = { top: 8, right: 12, bottom: 22, left: 44 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const times = points.map((p) => dayTime(p.day));
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const x = (t: number) => m.left + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const values = points.map((p) => p.cumulative);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => m.top + h - ((v - yMin) / (yMax - yMin || 1)) * h;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0',
    'aria-label': `Net RP running total, ${points.length} play days` });
  for (const t of ticks) {
    svg.append(
      svgEl('line', { class: t === 0 ? 'zero' : 'gridline', x1: m.left, x2: width - m.right, y1: y(t), y2: y(t) }),
      svgText(fmtInt(t), { class: 'tick', x: m.left - 8, y: y(t) + 4, 'text-anchor': 'end' }),
    );
  }
  for (const i of xTickIndices(points.length, Math.max(2, Math.floor(w / 110)))) {
    svg.append(svgText(fmtDay(points[i].day), {
      class: 'tick', x: x(times[i]), y: height - 4,
      'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
    }));
  }
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join('');
  const area = `${line}L${x(t1).toFixed(1)},${y(0).toFixed(1)}L${x(t0).toFixed(1)},${y(0).toFixed(1)}Z`;
  svg.append(svgEl('path', { class: 'area', d: area }), svgEl('path', { class: 'line', d: line }));
  const last = points[points.length - 1];
  svg.append(svgEl('circle', { class: 'dot', cx: x(t1), cy: y(last.cumulative), r: 4 }));

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
    const py = y(p.cumulative);
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', String(px));
    hoverDot.setAttribute('cy', String(py));
    hoverDot.setAttribute('visibility', 'visible');
    tip.replaceChildren(
      el('div', { class: 't-value' }, signed(p.cumulative)),
      el('div', {}, el('span', { class: 't-key' }), 'Net RP so far'),
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
