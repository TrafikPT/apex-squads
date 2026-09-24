import { el, svgEl } from '../dom';
import type { MatchFact, TeammateFact, WeaponFact } from '../facts';
import { fixed, fmtDateTime, fmtInt, place, signed } from '../format';
import { legendBadge } from '../portraits';
import { groupByDay, toLocalDay } from '../stats';
import type { ViewContext, ViewResult } from './context';
import { rpCell } from './shared';

/** The one expanded match; kept across re-renders and set from other views. */
let expanded: string | null = null;

/** Opens a match's details the next time the Matches view renders. */
export function openMatch(matchId: string): void {
  expanded = matchId;
}

const COLUMNS = 9;
/** Chevron, legend, time and squad: the day's name spans these. */
const LEAD_COLUMNS = 4;
/** Matches rendered per "Show more" step; whole days are always shown. */
const PAGE_SIZE = 100;
let shown = PAGE_SIZE;
/** The filters `shown` applies to: a new selection starts from one page again. */
let shownFor = '';

export function matchesView(ctx: ViewContext): ViewResult {
  const days = groupByDay(ctx.matches);
  const card = el('section', { class: 'card table-card' },
    el('h2', { class: 'card-title' }, 'Match history', el('span', { class: 'aside' }, `${ctx.matches.length} in selection`)));
  if (!days.length) {
    card.append(el('div', { class: 'empty' }, 'No matches for these filters'));
    return { node: el('div', { class: 'view view-matches' }, card) };
  }

  const mates = groupBy(ctx.data.teammates, (t) => t.matchId);
  const guns = groupBy(ctx.data.weapons, (w) => w.matchId);
  const accountName = new Map(ctx.data.accounts.map((a) => [a.accountKey, a.name]));

  const filterKey = JSON.stringify(ctx.filters);
  if (filterKey !== shownFor) {
    shownFor = filterKey;
    shown = PAGE_SIZE;
  }
  const openAt = days.flatMap((d) => d.matches).findIndex((m) => m.matchId === expanded);
  const limit = Math.max(shown, openAt + 1);

  const body = el('tbody', {});
  let expandedRow: HTMLElement | null = null;
  let rendered = 0;
  for (const day of days) {
    if (rendered >= limit) break;
    rendered += day.matches.length;
    // The day's averages sit under the columns they summarize; RP is the day's net.
    const s = day.summary;
    const dayStat = (text: string, title: string, cls = '') => el('td', { class: `num day-stat ${cls}`, title }, text);
    body.append(el('tr', { class: 'day-row' },
      el('td', { colspan: String(LEAD_COLUMNS) },
        el('span', { class: 'day-name' }, fmtLongDay(day.day)),
        el('span', { class: 'day-sum' }, `${s.matches} ${s.matches === 1 ? 'match' : 'matches'} · day averages`)),
      dayStat(place(s.avgPlacement), 'Average placement'),
      dayStat(fixed(s.kd, 2), "The day's K/D: all kills over all deaths"),
      dayStat('', ''),
      dayStat(s.avgDamage === null ? '–' : fmtInt(Math.round(s.avgDamage)), 'Average damage'),
      s.rpNet === null ? dayStat('–', 'No RP data for this day')
        : dayStat(`${signed(s.rpNet)} RP`, 'Net RP for the day', s.rpNet >= 0 ? 'good' : 'bad'),
    ));
    for (const m of day.matches) {
      const open = expanded === m.matchId;
      const row = matchRow(ctx, m, open);
      body.append(row);
      if (open) {
        expandedRow = row;
        body.append(el('tr', { class: 'detail-row' }, el('td', { colspan: String(COLUMNS) },
          matchDetail(ctx, m, mates.get(m.matchId) ?? [], guns.get(m.matchId) ?? [], accountName.get(m.accountKey) ?? m.accountKey))));
      }
    }
  }

  const head = el('tr', {});
  for (const [label, num] of [['', false], ['Legend', false], ['Time', false], ['Squad', false], ['Place', true],
    ['K/D', true], ['K / D / A / Kn', true], ['Damage', true], ['RP', true]] as const) {
    head.append(el('th', { class: num ? 'num' : '' }, label));
  }
  const scroll = el('div', { class: 'table-scroll' }, el('table', { class: 'matches-table' }, el('thead', {}, head), body));
  const remaining = ctx.matches.length - rendered;
  if (remaining > 0) {
    const more = el('button', { type: 'button', class: 'link-button show-more' },
      `Show ${fmtInt(Math.min(remaining, PAGE_SIZE))} more (${fmtInt(remaining)} left)`);
    more.addEventListener('click', () => {
      shown = rendered + PAGE_SIZE;
      ctx.setView('matches');
    });
    scroll.append(more);
  }
  card.append(scroll);
  return {
    node: el('div', { class: 'view view-matches' }, card),
    mounted: () => expandedRow?.scrollIntoView({ block: 'nearest' }),
  };
}

function matchRow(ctx: ViewContext, m: MatchFact, open: boolean): HTMLElement {
  const chevron = svgEl('svg', { class: 'chevron', viewBox: '0 0 24 24' });
  chevron.append(svgEl('path', { d: 'M9 6l6 6-6 6' }));
  const squad = el('td', {});
  [...(ctx.squadOf.get(m.matchId) ?? [])].forEach((p, i) => {
    if (i) squad.append(', ');
    squad.append(el('span', { class: ctx.regulars.has(p) ? 'squad-friend' : 'squad-random' }, ctx.playerName(p)));
  });
  const row = el('tr', { class: `match-row clickable${open ? ' open' : ''}`, tabindex: '0', 'aria-expanded': String(open),
    title: open ? 'Hide details' : 'Show details' },
    el('td', { class: 'chevron-col' }, chevron),
    el('td', { class: 'legend-col' }, legendBadge(m.legend)),
    el('td', {}, new Date(m.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
    squad,
    el('td', { class: 'num' }, el('span', { class: `place${m.placement === 1 ? ' win' : ''}` }, `#${m.placement}`)),
    // Same rule as the K/D elsewhere: kills when there were no deaths.
    el('td', { class: 'num' }, (m.kills / Math.max(m.deaths, 1)).toFixed(2)),
    el('td', { class: 'num' }, `${m.kills} / ${m.deaths} / ${m.assists} / ${m.knocks}`),
    el('td', { class: 'num' }, fmtInt(m.damage)),
    rpCell(m.rpDelta),
  );
  const toggle = () => {
    expanded = open ? null : m.matchId;
    ctx.setView('matches');
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  return row;
}

// ---------------------------------------------------------------- detail panel

function matchDetail(ctx: ViewContext, m: MatchFact, mates: TeammateFact[], guns: WeaponFact[], account: string): HTMLElement {
  const header = el('div', { class: 'detail-head' },
    el('div', { class: 'detail-legend' }, legendBadge(m.legend),
      el('div', {},
        el('div', { class: 'detail-title' }, m.legend),
        el('div', { class: 'detail-meta' }, [m.map, m.mode === 'ranked' ? 'Ranked' : 'Pubs', account, fmtDateTime(m.startedAt)].join(' · ')),
      ),
    ),
    el('div', { class: 'detail-result' },
      el('div', {}, el('div', { class: `detail-place${m.placement === 1 ? ' win' : ''}` }, `#${m.placement}`),
        el('div', { class: 'detail-meta' }, `of ${m.teams} squads`)),
      m.rpDelta === null ? '' : el('div', {}, el('div', { class: `detail-rp ${m.rpDelta >= 0 ? 'good' : 'bad'}` }, signed(m.rpDelta)),
        el('div', { class: 'detail-meta' }, 'RP')),
    ),
  );

  const stat = (label: string, value: string) =>
    el('div', { class: 'stat' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, value));
  const mine = section('Your match',
    el('div', { class: 'stat-grid' },
      stat('Kills', String(m.kills)), stat('Assists', String(m.assists)), stat('Knocks', String(m.knocks)),
      stat('Deaths', String(m.deaths)), stat('Damage', fmtInt(m.damage)),
      stat('Revives', `${m.revivesGiven} · ${m.revivesReceived}`),
    ),
    el('div', { class: 'footnote' }, 'Revives: given · received'),
  );

  const squadList = el('div', { class: 'squad-list' },
    el('div', { class: 'squad-member' }, legendBadge(m.legend),
      el('span', { class: 'squad-friend' }, account, el('span', { class: 'you' }, 'you')),
      el('span', { class: 'member-stats' }, memberStats(m.kills, m.deaths, m.knocks))),
  );
  for (const t of mates) {
    squadList.append(el('div', { class: 'squad-member' }, legendBadge(t.legend),
      el('span', { class: ctx.regulars.has(t.playerKey) ? 'squad-friend' : 'squad-random' }, ctx.playerName(t.playerKey)),
      el('span', { class: 'member-stats' }, memberStats(t.kills, t.deaths, t.knocks))));
  }
  const squad = section('Squad', squadList);

  const sorted = [...guns].sort((a, b) => (a.weapon === 'Other' ? 1 : b.weapon === 'Other' ? -1 : b.damage - a.damage));
  const maxDamage = Math.max(1, ...sorted.map((w) => w.damage));
  const weaponList = el('div', { class: 'weapon-list' });
  for (const w of sorted) {
    const bar = el('div', { class: 'bar-track' }, el('div', { class: 'bar', style: `width: ${(w.damage / maxDamage) * 100}%` }));
    weaponList.append(el('div', { class: 'weapon-row' },
      el('span', { class: 'weapon-name' }, w.weapon === 'Other' ? 'Grenades & abilities' : w.weapon),
      el('span', { class: 'member-stats' }, w.weapon === 'Other' ? '' : `${w.kills} K · ${w.knocks} Kn`),
      el('span', { class: 'weapon-dmg' }, fmtInt(w.damage)),
      bar,
    ));
  }
  const weapons = section('Weapons', weaponList,
    el('div', { class: 'footnote' }, 'Damage per weapon is estimated from the weapon in hand'));

  return el('div', { class: 'match-detail' }, header, el('div', { class: 'detail-sections' }, mine, squad, weapons));
}

function section(title: string, ...children: (HTMLElement | string)[]): HTMLElement {
  return el('div', { class: 'detail-section' }, el('div', { class: 'section-title' }, title), ...children);
}

// ---------------------------------------------------------------- helpers

/** Short, like the weapon rows next to it, so it fits beside a long name. */
function memberStats(kills: number, deaths: number, knocks: number): string {
  return `${kills} K · ${deaths} D · ${knocks} Kn`;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    let list = out.get(k);
    if (!list) out.set(k, (list = []));
    list.push(x);
  }
  return out;
}

function fmtLongDay(day: string): string {
  const [y, mo, d] = day.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const today = toLocalDay(new Date());
  const yesterday = toLocalDay(new Date(Date.now() - 86_400_000));
  const label = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return day === today ? `Today · ${label}` : day === yesterday ? `Yesterday · ${label}` : label;
}
