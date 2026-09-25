/**
 * Seasons: my ranked seasons as the game counts them (every game, recorded
 * or not), one account at a time. Only the Account filter applies: the
 * others can't slice the game's season totals.
 */
import { el, svgEl, svgText } from '../dom';
import type { Account, SeasonFact } from '../facts';
import { fixed, fmtInt, pct } from '../format';
import { rankBadge, rankLabel } from '../rank-badge';
import { rankName, rankOf } from '../ranks';
import type { ViewContext, ViewResult } from './context';
import { drawRankAxis, rankTicks } from './rank-axis';
import { headRow, MIN_SAMPLE } from './shared';

const APPROX_TITLE = 'From the current rank table: the RP thresholds changed between seasons, so older ranks are approximate';
const END_TITLE = "The game's RP for the season, probably where it ended; the peak isn't kept for past seasons";

interface Row {
  s: SeasonFact;
  kd: number;
  winRate: number;
  top5Rate: number;
  avgKills: number;
  avgDamage: number;
}

function row(s: SeasonFact): Row {
  return {
    s,
    // Same rule as the K/D elsewhere: kills when there were no deaths.
    kd: s.kills / Math.max(s.deaths, 1),
    winRate: s.wins / s.games,
    top5Rate: s.top5s / s.games,
    avgKills: s.kills / s.games,
    avgDamage: s.damage / s.games,
  };
}

export function seasonsView(ctx: ViewContext): ViewResult {
  const account = shownAccount(ctx);
  const rows = ctx.data.seasons.filter((s) => s.accountKey === account?.accountKey).map(row);
  const who = account?.name ?? '';
  const aside = ctx.filters.account === 'all' && ctx.data.accounts.length > 1 ? `${who} · pick an account above to switch` : who;
  if (!rows.length) {
    return { node: el('div', { class: 'view' }, el('section', { class: 'card' },
      el('h2', { class: 'card-title' }, 'Seasons', el('span', { class: 'aside' }, aside)),
      el('div', { class: 'empty' }, 'No season stats yet: the game sends them in the lobby, with the first recorded session'))) };
  }
  const chart = chartCard(rows);
  return {
    node: el('div', { class: 'view view-seasons' }, insights(rows), chart.card, tableCard(rows, aside)),
    mounted: chart.draw,
  };
}

/** The picked account, or with "All accounts" the main one (most recorded matches): seasons don't add up across accounts. */
function shownAccount(ctx: ViewContext): Account | undefined {
  const { accounts, matches } = ctx.data;
  if (ctx.filters.account !== 'all') return accounts.find((a) => a.accountKey === ctx.filters.account);
  const played = (a: Account) => matches.filter((m) => m.accountKey === a.accountKey).length;
  return [...accounts].sort((a, b) => played(b) - played(a))[0];
}

function rankText(s: SeasonFact): string {
  const r = rankOf(s.rp);
  return `${s.current ? '' : '≈ '}${rankName(r.tier, r.division)}`;
}

/** Hovering a season's badge names the rank, and says when it's approximate. */
function badgeTitle(s: SeasonFact): string {
  const r = rankOf(s.rp);
  return s.current ? rankName(r.tier, r.division) : `${rankText(s)}. ${APPROX_TITLE}`;
}

function seasonBadge(s: SeasonFact): HTMLElement {
  const r = rankOf(s.rp);
  return rankBadge(r.tier, r.division, badgeTitle(s));
}

/** Badge and division numeral, for the table. */
function seasonRank(s: SeasonFact): HTMLElement {
  const r = rankOf(s.rp);
  return rankLabel(r.tier, r.division, badgeTitle(s));
}

// ---------------------------------------------------------------- insights

function insights(rows: Row[]): HTMLElement {
  const eligible = rows.filter((r) => r.s.games >= MIN_SAMPLE);
  const best = (value: (r: Row) => number, pool = eligible) => [...pool].sort((a, b) => value(b) - value(a))[0];
  const past = best((r) => r.s.rp, eligible.filter((r) => !r.s.current));
  const now = rows.find((r) => r.s.current);

  const tile = (label: string, value: string, sub: string, title = '', badge?: HTMLElement) => {
    const text = [el('div', { class: 'label' }, label), el('div', { class: 'value' }, value), el('div', { class: 'sub' }, sub)];
    return badge
      ? el('div', { class: 'tile insight with-portrait', ...(title ? { title } : {}) }, badge, el('div', { class: 'insight-text' }, ...text))
      : el('div', { class: 'tile insight', ...(title ? { title } : {}) }, ...text);
  };
  const kd = best((r) => r.kd);
  const dmg = best((r) => r.avgDamage);
  const peak = now?.s.peakRp && now.s.peakRp > now.s.rp ? ` · peak ${fmtInt(now.s.peakRp)}` : '';
  return el('div', { class: 'insights' },
    past ? tile('Best season', `${fmtInt(past.s.rp)} RP`, `Season ${past.s.season} · end of season`, END_TITLE, seasonBadge(past.s))
      : tile('Best season', '–', 'no finished season yet'),
    now ? tile('This season', `${fmtInt(now.s.rp)} RP`, `Season ${now.s.season}${peak}`,
      peak ? 'The peak is the highest RP in our recordings of this season' : '', seasonBadge(now.s))
      : tile('This season', '–', 'no games this season yet'),
    kd ? tile('Best K/D', fixed(kd.kd, 2), `Season ${kd.s.season} · ${fmtInt(kd.s.games)} games`) : tile('Best K/D', '–', ''),
    dmg ? tile('Best avg damage', fmtInt(dmg.avgDamage), `Season ${dmg.s.season} · ${fmtInt(dmg.s.games)} games`) : tile('Best avg damage', '–', ''),
  );
}

// ---------------------------------------------------------------- chart

function chartCard(rows: Row[]): { card: HTMLElement; draw: () => void } {
  const host = el('div', { class: 'chart' });
  const card = el('section', { class: 'card rp-card' },
    el('h2', { class: 'card-title' }, 'RP by season', el('span', { class: 'aside' }, 'end of each season · this season so far')),
    host);
  return { card, draw: () => drawSeasonChart(host, rows) };
}

function drawSeasonChart(host: HTMLElement, rows: Row[]): void {
  const width = host.clientWidth || 600;
  const height = Math.max(170, host.clientHeight);
  const m = { top: 18, right: 12, bottom: 22, left: 80 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  // One slot per season number, so a season without games leaves a gap.
  const first = rows[0].s.season;
  const slots = rows[rows.length - 1].s.season - first + 1;
  const x = (season: number) => m.left + ((season - first + 0.5) / slots) * w;
  const ticks = rankTicks(rows.map((r) => r.s.rp));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => m.top + h - ((v - yMin) / (yMax - yMin || 1)) * h;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0',
    'aria-label': `RP by season against the rank thresholds, seasons ${first} to ${first + slots - 1}` });
  drawRankAxis(svg, ticks, y, m.left, width - m.right);
  for (const r of rows) {
    svg.append(svgText(`S${r.s.season}${r.s.current ? ' · now' : ''}`, { class: 'tick', x: x(r.s.season), y: height - 4, 'text-anchor': 'middle' }));
  }
  // Consecutive seasons are joined; the step into the current season is dashed, as it's still moving.
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1].s, rows[i].s];
    if (b.season !== a.season + 1) continue;
    svg.append(svgEl('line', { class: `line${b.current ? ' in-progress' : ''}`, x1: x(a.season), y1: y(a.rp), x2: x(b.season), y2: y(b.rp) }));
  }
  const best = rows.filter((r) => !r.s.current).sort((a, b) => b.s.rp - a.s.rp)[0];
  for (const r of rows) svg.append(svgEl('circle', { class: `dot${r.s.current ? ' now' : ''}`, cx: x(r.s.season), cy: y(r.s.rp), r: 4 }));
  if (best) svg.append(svgText(fmtInt(best.s.rp), { class: 'point-label', x: x(best.s.season), y: y(best.s.rp) - 10, 'text-anchor': 'middle' }));

  // Hover / focus layer: snaps to the nearest season.
  const cross = svgEl('line', { class: 'crosshair', y1: m.top, y2: m.top + h, visibility: 'hidden' });
  const hoverDot = svgEl('circle', { class: 'dot', r: 5, visibility: 'hidden' });
  const hit = svgEl('rect', { x: m.left, y: 0, width: w, height, fill: 'transparent' });
  svg.append(cross, hoverDot, hit);
  const tip = el('div', { class: 'tooltip', hidden: '' });
  host.replaceChildren(svg, tip);

  let active = -1;
  const show = (i: number) => {
    active = i;
    const s = rows[i].s;
    const px = x(s.season);
    const py = y(s.rp);
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', String(px));
    hoverDot.setAttribute('cy', String(py));
    hoverDot.setAttribute('visibility', s.current ? 'hidden' : 'visible');
    const peak = s.peakRp && s.peakRp > s.rp ? ` · peak ${fmtInt(s.peakRp)}` : '';
    tip.replaceChildren(
      el('div', { class: 't-value' }, `${fmtInt(s.rp)} RP`),
      el('div', { class: 't-rank' }, seasonBadge(s), `${rankText(s)} · ${s.current ? `Season ${s.season}, now${peak}` : `end of Season ${s.season}`}`),
      el('div', { class: 't-muted' }, `${fmtInt(s.games)} games · K/D ${fixed(rows[i].kd, 2)} · ${fmtInt(rows[i].avgDamage)} avg dmg`),
      el('div', { class: 't-muted' }, `${fmtInt(s.revived)} revives · ${fmtInt(s.respawned)} respawns · ${fmtInt(s.assists)} assists`),
    );
    tip.hidden = false;
    const scale = host.clientWidth / width;
    tip.style.left = `${Math.min(Math.max(px * scale + 12, 0), host.clientWidth - 220)}px`;
    tip.style.top = `${Math.max(py * scale - 80, 0)}px`;
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
    let nearest = 0;
    for (let i = 1; i < rows.length; i++) if (Math.abs(x(rows[i].s.season) - px) < Math.abs(x(rows[nearest].s.season) - px)) nearest = i;
    show(nearest);
  });
  hit.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(rows.length - 1));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(Math.max(0, (active < 0 ? rows.length : active) - 1));
    else if (e.key === 'ArrowRight') show(Math.min(rows.length - 1, active + 1));
    else return;
    e.preventDefault();
  });
}

// ---------------------------------------------------------------- table

/** Columns whose best season is highlighted, higher being better. */
const BEST: Record<string, (r: Row) => number> = {
  rp: (r) => r.s.rp,
  wins: (r) => r.winRate,
  top5: (r) => r.top5Rate,
  kd: (r) => r.kd,
  kills: (r) => r.avgKills,
  damage: (r) => r.avgDamage,
  mostKills: (r) => r.s.mostKills,
  mostDamage: (r) => r.s.mostDamage,
};

function tableCard(rows: Row[], aside: string): HTMLElement {
  const eligible = rows.filter((r) => r.s.games >= MIN_SAMPLE);
  const top = Object.fromEntries(Object.entries(BEST).map(([k, f]) => [k, Math.max(...eligible.map(f))]));
  const cell = (key: string, r: Row, text: string, attrs: Record<string, string> = {}) =>
    el('td', { class: 'num', ...attrs }, el('span', { class: r.s.games >= MIN_SAMPLE && BEST[key](r) === top[key] ? 'best' : '' }, text));

  const body = el('tbody', {});
  for (const r of [...rows].reverse()) {
    const s = r.s;
    body.append(el('tr', {},
      el('td', {}, `S${s.season}`, s.current ? el('span', { class: 'now-tag' }, 'now') : ''),
      cell('rp', r, fmtInt(s.rp), { title: s.current ? 'RP now' : END_TITLE }),
      el('td', { class: 'rank-cell' }, seasonRank(s), s.current ? '' : el('span', { class: 'muted', title: APPROX_TITLE }, '≈')),
      el('td', { class: 'num' }, fmtInt(s.games)),
      cell('wins', r, pct(r.winRate), { title: `${fmtInt(s.wins)} wins` }),
      cell('top5', r, pct(r.top5Rate), { title: `${fmtInt(s.top5s)} top 5s` }),
      cell('kd', r, fixed(r.kd, 2), { title: `${fmtInt(s.kills)} kills · ${fmtInt(s.deaths)} deaths` }),
      cell('kills', r, fixed(r.avgKills, 2)),
      cell('damage', r, fmtInt(r.avgDamage)),
      cell('mostKills', r, fmtInt(s.mostKills)),
      cell('mostDamage', r, fmtInt(s.mostDamage)),
    ));
  }
  return el('section', { class: 'card table-card' },
    el('h2', { class: 'card-title' }, 'Seasons', el('span', { class: 'aside' }, `${aside} · the game's season totals, so only the Account filter applies`)),
    el('div', { class: 'table-scroll' }, el('table', { class: 'seasons-table' },
      el('thead', {}, headRow([['Season', false], ['RP', true], ['Rank', false], ['Games', true], ['Wins', true], ['Top 5', true],
        ['K/D', true], ['Avg kills', true], ['Avg dmg', true], ['Most kills', true], ['Most dmg', true]])),
      body)),
  );
}
