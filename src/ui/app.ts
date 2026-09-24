/**
 * Dashboard window shell: title bar, sidebar navigation and the shared filter
 * bar. Plain DOM, no framework yet: render() rebuilds everything from
 * (data, filters, view) whenever one of them changes.
 */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import { el, svgEl } from './dom';
import type { Account, Dataset } from './facts';
import { uniqueSorted } from './format';
import { generateMockData } from './mock-data';
import { rankName } from './ranks';
import { DEFAULT_FILTERS, Filters, PeriodPreset, filterMatches, frequentTeammates, regularPlayers, teammateIndex } from './stats';
import type { View, ViewContext, ViewResult } from './views/context';
import { legendsView } from './views/legends';
import { matchesView, openMatch } from './views/matches';
import { overviewView } from './views/overview';
import { squadsView } from './views/squads';
import { weaponsView } from './views/weapons';

const PERIODS: [PeriodPreset, string][] = [
  ['7d', '7D'],
  ['30d', '30D'],
  ['90d', '90D'],
  ['season', 'Season'],
  ['all', 'All'],
  ['custom', 'Custom'],
];

const NAV: [View, string, string][] = [
  ['overview', 'Overview', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
  ['squads', 'Squads', 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M21.5 20a6.5 6.5 0 0 0-4-6'],
  ['weapons', 'Weapons', 'M12 3v4M12 17v4M3 12h4M17 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  ['legends', 'Legends', 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z'],
  ['matches', 'Matches', 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'],
];
const SETTINGS_ICON = 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4';

const data: Dataset = generateMockData();
const names = new Map(data.players.map((p) => [p.playerKey, p.name]));
const squadOf = teammateIndex(data);
const regulars = regularPlayers(data);
const teammateChips = frequentTeammates(data, data.matches, 6);

let filters: Filters = { ...DEFAULT_FILTERS };
const params = new URLSearchParams(location.search);
const VIEWS: View[] = ['overview', 'squads', 'weapons', 'legends', 'matches', 'settings'];
let view: View = VIEWS.find((v) => v === params.get('view')) ?? 'overview';
// ?match=<id> or ?match=latest opens that match's details (dev aid for screenshots).
const matchParam = params.get('match');
if (matchParam) {
  openMatch(matchParam === 'latest' ? [...data.matches].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0].matchId : matchParam);
}

const root = document.getElementById('app')!;
const platform = params.get('platform');
if (platform) document.documentElement.classList.add(`platform-${platform}`);

function setFilters(patch: Partial<Filters>): void {
  filters = { ...filters, ...patch };
  render();
}

function setView(next: View, patch: Partial<Filters> = {}): void {
  view = next;
  filters = { ...filters, ...patch };
  render();
}

function render(): void {
  const ctx: ViewContext = {
    data,
    matches: filterMatches(data, filters),
    filters,
    setFilters,
    setView,
    playerName: (key) => names.get(key) ?? key,
    regulars,
    squadOf,
  };
  const content = renderView(ctx);
  root.replaceChildren(
    el('div', { class: 'app' },
      titleBar(),
      el('div', { class: 'body' },
        sidebar(),
        el('main', { class: 'main' }, filterBar(), content.node),
      ),
    ),
  );
  content.mounted?.();
}

function renderView(ctx: ViewContext): ViewResult {
  if (view === 'overview') return overviewView(ctx);
  if (view === 'squads') return squadsView(ctx);
  if (view === 'matches') return matchesView(ctx);
  if (view === 'legends') return legendsView(ctx);
  if (view === 'weapons') return weaponsView(ctx);
  const label = view[0].toUpperCase() + view.slice(1);
  return { node: el('div', { class: 'view' }, el('section', { class: 'card' }, el('h2', { class: 'card-title' }, label),
    el('div', { class: 'empty' }, 'Coming soon'))) };
}

// ---------------------------------------------------------------- title bar

function titleBar(): HTMLElement {
  const mark = svgEl('svg', { class: 'mark', viewBox: '0 0 24 24' });
  mark.append(svgEl('path', { d: 'M12 2 22 21H2z', fill: 'var(--accent)' }), svgEl('path', { d: 'M12 10l4 8H8z', fill: 'var(--page)' }));
  return el('header', { class: 'titlebar' },
    mark,
    el('span', { class: 'name' }, 'Apex Squads'),
    el('span', { class: 'pill' }, 'Sample data'),
    el('span', { class: 'status' }, el('span', { class: 'dot' }), 'Waiting for Apex Legends'),
  );
}

// ---------------------------------------------------------------- sidebar

function sidebar(): HTMLElement {
  const nav = el('nav', { class: 'nav' });
  for (const [key, label, path] of NAV) nav.append(navLink(key, label, path));
  return el('aside', { class: 'sidebar' },
    el('div', { class: 'section-label' }, 'Stats'),
    nav,
    el('div', { class: 'spacer' }),
    el('nav', { class: 'nav', style: 'padding-bottom: 8px' }, navLink('settings', 'Settings', SETTINGS_ICON)),
    el('div', { class: 'foot' },
      el('div', {}, 'v0.1 · data stays on this PC'),
      // Required by EA's fan content policy wherever game content is shown.
      el('div', { class: 'disclaimer' }, 'Not endorsed by or affiliated with EA or its licensors. Legend art © Electronic Arts.'),
    ),
  );
}

function navLink(key: View, label: string, path: string): HTMLElement {
  const icon = svgEl('svg', { viewBox: '0 0 24 24' });
  icon.append(svgEl('path', { d: path }));
  const a = el('a', { href: '#', class: view === key ? 'active' : '', 'aria-current': view === key ? 'page' : '' }, icon, label);
  a.addEventListener('click', (e) => {
    e.preventDefault();
    setView(key);
  });
  return a;
}

// ---------------------------------------------------------------- filters

function filterBar(): HTMLElement {
  const periods = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Time period' });
  for (const [value, label] of PERIODS) {
    const b = el('button', { type: 'button', 'aria-pressed': String(filters.period === value) }, label);
    b.addEventListener('click', () => setFilters({ period: value }));
    periods.append(b);
  }
  const periodFilter = el('div', { class: 'filter' }, periods);
  if (filters.period === 'custom') {
    const from = el('input', { type: 'date', 'aria-label': 'From' }) as HTMLInputElement;
    const to = el('input', { type: 'date', 'aria-label': 'To' }) as HTMLInputElement;
    from.value = filters.from ?? '';
    to.value = filters.to ?? '';
    from.addEventListener('change', () => setFilters({ from: from.value || undefined }));
    to.addEventListener('change', () => setFilters({ to: to.value || undefined }));
    periodFilter.append(from, el('span', { class: 'label' }, 'to'), to);
  }

  const legends = uniqueSorted(data.matches.map((m) => m.legend));
  const maps = uniqueSorted(data.matches.map((m) => m.map));

  const chips = el('div', { class: 'chips' });
  for (const { playerKey, games } of teammateChips) {
    const on = filters.withPlayers.includes(playerKey);
    const chip = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(on) },
      names.get(playerKey) ?? playerKey, el('span', { class: 'count' }, String(games)));
    chip.addEventListener('click', () =>
      setFilters({
        withPlayers: on ? filters.withPlayers.filter((p) => p !== playerKey) : [...filters.withPlayers, playerKey],
      }));
    chips.append(chip);
  }

  const reset = el('button', { type: 'button', class: 'link-button' }, 'Reset');
  reset.addEventListener('click', () => setFilters({ ...DEFAULT_FILTERS }));

  const accountOptions: [string, string][] = [['all', 'All accounts'],
    ...data.accounts.map((a) => [a.accountKey, a.rank ? `${a.name} · ${rankText(a)}` : a.name] as [string, string])];
  return el('div', { class: 'filters' },
    selectFilter('Account', accountOptions, filters.account, (v) => setFilters({ account: v })),
    periodFilter,
    selectFilter('Mode', [['ranked', 'Ranked'], ['pubs', 'Pubs'], ['all', 'All modes']], filters.mode,
      (v) => setFilters({ mode: v as Filters['mode'] })),
    selectFilter('Legend', [['all', 'All legends'], ...legends.map((l) => [l, l] as [string, string])], filters.legend,
      (v) => setFilters({ legend: v })),
    selectFilter('Map', [['all', 'All maps'], ...maps.map((m) => [m, m] as [string, string])], filters.map,
      (v) => setFilters({ map: v })),
    el('div', { class: 'filter' }, el('span', { class: 'label' }, 'Played with'), chips),
    reset,
  );
}

function selectFilter(label: string, options: [string, string][], value: string, onChange: (v: string) => void) {
  const select = el('select', { 'aria-label': label }) as HTMLSelectElement;
  for (const [v, text] of options) {
    const o = el('option', { value: v }, text) as HTMLOptionElement;
    o.selected = v === value;
    select.append(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  return el('div', { class: 'filter' }, el('span', { class: 'label' }, label), select);
}

function rankText(a: Account): string {
  return a.rank ? rankName(a.rank.tier, a.rank.division) : '–';
}

render();
window.addEventListener('resize', () => render());
