/**
 * The first screen: where I stand (rank now, from the game's season stats, so
 * it shows before any match is recorded), how the last session went, RP match
 * by match, the recent matches, and the selection's numbers against my season.
 */
import { el, svgEl, svgText } from '../dom';
import type { Account, MatchFact } from '../facts';
import { fixed, fmtDateTime, fmtInt, niceTicks, pct, signed, xTickIndices } from '../format';
import { legendBadge } from '../portraits';
import { rankBadge } from '../rank-badge';
import { rankName, rankOf } from '../ranks';
import { kpis, playSessions, rankedAccount, rankGames, RpStep, rpSteps, SeasonBaseline, seasonBaseline } from '../stats';
import type { ViewContext, ViewResult } from './context';
import { openMatch } from './matches';
import { drawRankAxis, rankTicks } from './rank-axis';
import { clickable, rpText } from './shared';

const RECENT_MATCHES = 5;
/** Within this share of the season value, a tile says "≈ season" instead of better or worse. */
const SAME_AS_SEASON = 0.03;

export function overviewView(ctx: ViewContext): ViewResult {
  const account = shownAccount(ctx);
  const chart = rpCard(ctx);
  return {
    node: el('div', { class: 'view view-overview' },
      rankCard(ctx, account),
      sessionCard(ctx),
      chart.card,
      recentCard(ctx),
      tiles(ctx),
    ),
    mounted: chart.draw,
  };
}

/** The picked account, or with "All accounts" the main one (most recorded matches). */
function shownAccount(ctx: ViewContext): Account | undefined {
  const { accounts, matches } = ctx.data;
  if (ctx.filters.account !== 'all') return accounts.find((a) => a.accountKey === ctx.filters.account);
  const played = (a: Account) => matches.filter((m) => m.accountKey === a.accountKey).length;
  return [...accounts].sort((a, b) => played(b) - played(a))[0];
}

// ---------------------------------------------------------------- rank now

/** Rank now, whatever the filters say: from the game's season stats, else the last recorded match. */
function rankCard(ctx: ViewContext, account: Account | undefined): HTMLElement {
  const season = ctx.data.seasons.find((s) => s.current && s.accountKey === account?.accountKey);
  const rp = season?.rp ?? account?.rank?.rp ?? null;
  const card = el('section', { class: 'card rank-card' },
    el('h2', { class: 'card-title' }, 'Your rank',
      el('span', { class: 'aside' }, account ? `${account.name}${ctx.filters.account === 'all' && ctx.data.accounts.length > 1 ? ' · pick an account above to switch' : ''}` : '')));
  if (rp === null) {
    card.append(el('div', { class: 'empty' }, 'No rank yet: it shows after your first session in the lobby'));
    return card;
  }
  const r = rankOf(rp);
  const next = r.next === null ? null : rankOf(r.next);
  const progress = r.next === null ? 1 : (rp - r.floor) / (r.next - r.floor);
  const facts = [
    season ? `Season ${season.season}` : '',
    season?.peakRp && season.peakRp > rp ? `peak ${fmtInt(season.peakRp)}` : '',
    season ? `${fmtInt(season.games)} games` : '',
  ].filter(Boolean);
  card.append(el('div', { class: 'rank-now' },
    rankBadge(r.tier, r.division),
    el('div', { class: 'rank-text' },
      el('div', { class: 'rank-line' }, el('span', { class: 'rank-name' }, rankName(r.tier, r.division)), el('span', { class: 'rank-rp' }, `${fmtInt(rp)} RP`)),
      el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(progress * 100)) },
        el('div', { class: 'progress-fill', style: `width: ${Math.min(100, progress * 100)}%` })),
      el('div', { class: 'rank-sub' },
        next ? `${fmtInt(r.next! - rp)} to ${rankName(next.tier, next.division)}` : 'top tier',
        facts.length ? ` · ${facts.join(' · ')}` : ''),
    ),
  ));
  return card;
}

// ---------------------------------------------------------------- last session

function sessionCard(ctx: ViewContext): HTMLElement {
  const session = playSessions(ctx.matches).at(-1);
  const card = el('section', { class: 'card session-card' });
  if (!session) {
    card.append(el('h2', { class: 'card-title' }, 'Last session'), el('div', { class: 'empty' }, 'No matches for these filters'));
    return card;
  }
  const first = new Date(session[0].startedAt);
  const last = new Date(session[session.length - 1].startedAt);
  const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const k = kpis(session);
  const wins = session.filter((m) => m.placement === 1).length;
  card.append(
    el('h2', { class: 'card-title' }, 'Last session',
      el('span', { class: 'aside' }, `${first.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${time(first)}–${time(last)}`)),
    el('div', { class: 'session-line' },
      el('span', { class: 'session-count' }, `${session.length} ${session.length === 1 ? 'match' : 'matches'}`),
      k.rpNet === null ? '' : el('span', { class: `session-rp ${k.rpNet >= 0 ? 'good' : 'bad'}` }, `${signed(k.rpNet)} RP`),
      el('span', { class: 'session-facts' }, [wins ? `${wins} ${wins === 1 ? 'win' : 'wins'}` : '', `top 5 ${pct(k.top5Rate)}`, `K/D ${fixed(k.kd, 2)}`].filter(Boolean).join(' · ')),
    ),
  );
  if (session.length > 1) {
    const ranked = rankGames(session);
    card.append(gameLine(ctx, 'Best', ranked[0]), gameLine(ctx, 'Worst', ranked[ranked.length - 1]));
  }
  return card;
}

/** A match as one line; opens its details. */
function gameLine(ctx: ViewContext, label: string, m: MatchFact): HTMLElement {
  const line = el('div', { class: 'game-line' },
    el('span', { class: 'game-label' }, label),
    legendBadge(m.legend),
    el('span', { class: `place${m.placement === 1 ? ' win' : ''}` }, `#${m.placement}`),
    el('span', { class: 'game-facts' }, `${m.kills} ${m.kills === 1 ? 'kill' : 'kills'} · ${fmtInt(m.damage)} dmg`),
    m.rpDelta === null ? '' : el('span', { class: `game-rp ${m.rpDelta >= 0 ? 'good' : 'bad'}${m.rpEstimated ? ' estimate' : ''}` }, rpText(m.rpDelta, m.rpEstimated)),
  );
  clickable(line, 'Show match details', () => {
    openMatch(m.matchId);
    ctx.setView('matches');
  });
  return line;
}

// ---------------------------------------------------------------- RP, match by match

function rpCard(ctx: ViewContext): { card: HTMLElement; draw?: () => void } {
  const steps = rpSteps(ctx.matches, ctx.data.matches);
  const card = el('section', { class: 'card rp-card' });
  const title = el('h2', { class: 'card-title' }, 'RP, match by match');
  card.append(title);
  if (!steps.length) {
    card.append(el('div', { class: 'empty' }, 'No ranked matches in this selection'));
    return { card };
  }
  const net = steps[steps.length - 1].cumulative;
  const single = steps.every((s) => s.level !== null);
  const unrecorded = steps.reduce((n, s) => n + s.unrecorded, 0);
  const parts = [`${signed(net)} RP in ${steps.length} ${steps.length === 1 ? 'match' : 'matches'}`];
  if (unrecorded) parts.push(`${signed(unrecorded)} in games not recorded`);
  if (single) {
    const start = steps[0].level! - steps[0].match.rpDelta!;
    parts.unshift(`${fmtInt(start)} → ${fmtInt(steps[steps.length - 1].level!)}`);
  } else if (rankedAccount(ctx.matches) === null) {
    parts.push('running total: pick one account to see your rank');
  }
  title.append(el('span', { class: 'aside' }, parts.join(' · ')));
  const host = el('div', { class: 'chart' });
  card.append(host);
  return { card, draw: () => drawSteps(ctx, host, steps, single) };
}

function drawSteps(ctx: ViewContext, host: HTMLElement, steps: RpStep[], ranked: boolean): void {
  const width = host.clientWidth || 600;
  const height = Math.max(170, host.clientHeight);
  const m = { top: 10, right: 12, bottom: 22, left: ranked ? 80 : 44 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const x = (i: number) => m.left + (steps.length === 1 ? w / 2 : (i / (steps.length - 1)) * w);
  const value = (s: RpStep) => (ranked ? s.level! : s.cumulative);
  const values = steps.map(value);
  const ticks = ranked ? rankTicks(values) : niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => m.top + h - ((v - yMin) / (yMax - yMin || 1)) * h;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0',
    'aria-label': ranked ? `RP after each of ${steps.length} ranked matches, against the rank thresholds`
      : `Net RP running total over ${steps.length} ranked matches` });
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

  // Sessions: a faint line before each one, and its day under the first match (when there's room).
  const sessionAt = steps.map((s, i) => (s.sessionStart ? i : -1)).filter((i) => i >= 0);
  let lastLabel = -Infinity;
  for (const i of sessionAt) {
    const sx = i === 0 ? x(0) : (x(i - 1) + x(i)) / 2;
    if (i > 0) svg.append(svgEl('line', { class: 'session-divider', x1: sx, x2: sx, y1: m.top, y2: m.top + h }));
    if (x(i) - lastLabel < 70) continue;
    lastLabel = x(i);
    svg.append(svgText(new Date(steps[i].match.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      { class: 'tick', x: x(i), y: height - 4, 'text-anchor': i === steps.length - 1 && i > 0 ? 'end' : 'start' }));
  }
  if (!sessionAt.length) {
    for (const i of xTickIndices(steps.length, 2)) {
      svg.append(svgText(fmtDateTime(steps[i].match.startedAt), { class: 'tick', x: x(i), y: height - 4, 'text-anchor': i ? 'end' : 'start' }));
    }
  }

  // The line; a step with RP from unrecorded games before it is dashed, labelled when there's room.
  for (let i = 1; i < steps.length; i++) {
    const gap = steps[i].unrecorded !== 0;
    svg.append(svgEl('line', { class: `line${gap ? ' in-progress' : ''}`, x1: x(i - 1), y1: y(value(steps[i - 1])), x2: x(i), y2: y(value(steps[i])) }));
    if (gap && x(i) - x(i - 1) >= 24) {
      svg.append(svgText(`${signed(steps[i].unrecorded)} not recorded`, { class: 'point-label',
        x: (x(i - 1) + x(i)) / 2, y: Math.min(y(value(steps[i - 1])), y(value(steps[i]))) - 8, 'text-anchor': 'middle' }));
    }
  }
  const dotR = steps.length > 60 ? 2 : 3;
  steps.forEach((s, i) => svg.append(svgEl('circle', { class: 'dot', cx: x(i), cy: y(value(s)), r: i === steps.length - 1 ? 4 : dotR })));

  // Hover / focus layer: snaps to the nearest match; click opens it.
  const cross = svgEl('line', { class: 'crosshair', y1: m.top, y2: m.top + h, visibility: 'hidden' });
  const hoverDot = svgEl('circle', { class: 'dot', r: 5, visibility: 'hidden' });
  const hit = svgEl('rect', { x: m.left - 6, y: 0, width: w + 12, height, fill: 'transparent', style: 'cursor: pointer' });
  svg.append(cross, hoverDot, hit);
  const tip = el('div', { class: 'tooltip', hidden: '' });
  host.replaceChildren(svg, tip);

  let active = -1;
  const show = (i: number) => {
    active = i;
    const s = steps[i];
    const mt = s.match;
    const px = x(i);
    const py = y(value(s));
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', String(px));
    hoverDot.setAttribute('cy', String(py));
    hoverDot.setAttribute('visibility', 'visible');
    const r = s.level === null ? null : rankOf(s.level);
    tip.replaceChildren(
      el('div', { class: 't-value' }, `${rpText(mt.rpDelta!, mt.rpEstimated)} RP`),
      el('div', {}, el('span', { class: 't-key' }),
        ranked && r ? `${fmtInt(s.level!)} RP · ${rankName(r.tier, r.division)}` : `${signed(s.cumulative)} so far`),
      el('div', { class: 't-muted' }, `#${mt.placement} · ${mt.kills} ${mt.kills === 1 ? 'kill' : 'kills'} · ${fmtInt(mt.damage)} dmg · ${mt.map}`),
      el('div', { class: 't-muted' }, fmtDateTime(mt.startedAt)),
      ...(s.unrecorded ? [el('div', { class: 't-muted' }, `${signed(s.unrecorded)} RP before it, in games not recorded`)] : []),
    );
    tip.hidden = false;
    const scale = host.clientWidth / width;
    tip.style.left = `${Math.min(Math.max(px * scale + 12, 0), host.clientWidth - 220)}px`;
    tip.style.top = `${Math.max(py * scale - 90, 0)}px`;
  };
  const hide = () => {
    active = -1;
    cross.setAttribute('visibility', 'hidden');
    hoverDot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const nearest = (clientX: number) => {
    const box = svg.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * width;
    return Math.max(0, Math.min(steps.length - 1, Math.round(((px - m.left) / (w || 1)) * (steps.length - 1))));
  };
  const open = (i: number) => {
    openMatch(steps[i].match.matchId);
    ctx.setView('matches');
  };
  hit.addEventListener('pointermove', (e) => show(nearest((e as PointerEvent).clientX)));
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('click', (e) => open(nearest((e as MouseEvent).clientX)));
  svg.addEventListener('focus', () => show(steps.length - 1));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(Math.max(0, (active < 0 ? steps.length : active) - 1));
    else if (e.key === 'ArrowRight') show(Math.min(steps.length - 1, active + 1));
    else if (e.key === 'Enter' && active >= 0) open(active);
    else return;
    e.preventDefault();
  });
}

// ---------------------------------------------------------------- recent matches

function recentCard(ctx: ViewContext): HTMLElement {
  const recent = [...ctx.matches].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, RECENT_MATCHES);
  const card = el('section', { class: 'card recent-card' });
  const all = el('button', { type: 'button', class: 'link-button' }, 'All matches');
  all.addEventListener('click', () => ctx.setView('matches'));
  card.append(el('h2', { class: 'card-title' }, 'Recent matches', el('span', { class: 'aside' }, all)));
  if (!recent.length) {
    card.append(el('div', { class: 'empty' }, 'No matches for these filters'));
    return card;
  }
  for (const m of recent) {
    const row = el('div', { class: 'recent-row' },
      legendBadge(m.legend),
      el('div', { class: 'recent-text' },
        el('div', { class: 'recent-main' },
          el('span', { class: `place${m.placement === 1 ? ' win' : ''}` }, `#${m.placement}`),
          el('span', {}, `${m.kills} / ${m.deaths} / ${m.assists}`),
          el('span', { class: 'muted' }, `${fmtInt(m.damage)} dmg`)),
        el('div', { class: 'recent-sub' }, `${fmtDateTime(m.startedAt)} · ${m.map}`)),
      m.rpDelta === null ? el('span', {}) : el('span', { class: `recent-rp ${m.rpDelta >= 0 ? 'good' : 'bad'}${m.rpEstimated ? ' estimate' : ''}` }, rpText(m.rpDelta, m.rpEstimated)),
    );
    clickable(row, 'Show match details', () => {
      openMatch(m.matchId);
      ctx.setView('matches');
    });
    card.append(row);
  }
  return card;
}

// ---------------------------------------------------------------- tiles vs season

/**
 * The selection's numbers, each against the current season as the game counts
 * it (ranked only: the game's season stats are ranked). Placement has no
 * season value.
 */
function tiles(ctx: ViewContext): HTMLElement {
  const k = kpis(ctx.matches);
  const accounts = ctx.filters.account === 'all' ? ctx.data.accounts.map((a) => a.accountKey) : [ctx.filters.account];
  const season = ctx.filters.mode === 'ranked' ? seasonBaseline(ctx.data, accounts) : null;
  const tile = (label: string, value: string, mine: number | null, base: (s: SeasonBaseline) => number, format: (v: number) => string) =>
    el('div', { class: 'tile' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, value),
      season && mine !== null ? versus(mine, base(season), format, season) : el('div', { class: 'vs' }, ''));
  return el('div', { class: 'tiles overview-tiles' },
    el('div', { class: 'tile' }, el('div', { class: 'label' }, 'Avg placement'),
      el('div', { class: 'value' }, k.avgPlacement === null ? '–' : `#${k.avgPlacement.toFixed(1)}`),
      el('div', { class: 'vs' }, `${fmtInt(k.matches)} ${k.matches === 1 ? 'match' : 'matches'}`)),
    tile('K/D', fixed(k.kd, 2), k.kd, (s) => s.kd, (v) => v.toFixed(2)),
    tile('Avg kills', fixed(k.avgKills, 2), k.avgKills, (s) => s.avgKills, (v) => v.toFixed(2)),
    tile('Avg damage', k.avgDamage === null ? '–' : fmtInt(k.avgDamage), k.avgDamage, (s) => s.avgDamage, fmtInt),
    tile('Top 5', pct(k.top5Rate), k.top5Rate, (s) => s.top5Rate, pct),
    tile('Wins', pct(k.winRate), k.winRate, (s) => s.winRate, pct),
  );
}

/** "season 1.23 ▼": better or worse than the season, or about the same. */
function versus(mine: number, season: number, format: (v: number) => string, s: SeasonBaseline): HTMLElement {
  const same = Math.abs(mine - season) <= Math.abs(season) * SAME_AS_SEASON;
  const better = mine > season;
  return el('div', { class: 'vs', title: `Season ${s.season}: ${fmtInt(s.games)} games, as the game counts them` },
    `season ${format(season)} `,
    same ? el('span', { class: 'muted' }, '≈') : el('span', { class: better ? 'good' : 'bad' }, better ? '▲' : '▼'));
}
