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
import './bridge';
import type { Account, Dataset } from './facts';
import { uniqueSorted } from './format';
import { generateMockData } from './mock-data';
import { rankName } from './ranks';
import { DEFAULT_FILTERS, Filters, PeriodPreset, filterMatches, frequentTeammates, regularPlayers, teammateIndex } from './stats';
import type { View, ViewContext, ViewResult } from './views/context';
import { legendsView } from './views/legends';
import { matchesView, openMatch } from './views/matches';
import { helpView } from './views/help';
import { overviewView } from './views/overview';
import { seasonsView } from './views/seasons';
import { settingsView } from './views/settings';
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
  ['seasons', 'Seasons', 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8'],
];
/** Filters shared by every page; each page shows only the ones that change what it shows. */
type FilterKey = 'account' | 'period' | 'mode' | 'legend' | 'map' | 'withPlayers';
const ALL_FILTERS: readonly FilterKey[] = ['account', 'period', 'mode', 'legend', 'map', 'withPlayers'];
const VIEW_FILTERS: Record<View, readonly FilterKey[]> = {
  overview: ALL_FILTERS, squads: ALL_FILTERS, weapons: ALL_FILTERS, legends: ALL_FILTERS, matches: ALL_FILTERS,
  // The game's season totals can only be split by account.
  seasons: ['account'],
  settings: [],
  help: [],
};

/**
 * Filters narrowed from their default, which stay on across pages and are
 * easy to forget. The period isn't one: its choice is always in view.
 */
function activeFilters(shown: readonly FilterKey[]): FilterKey[] {
  const d = DEFAULT_FILTERS;
  const active: FilterKey[] = [];
  if (filters.account !== d.account) active.push('account');
  if (filters.mode !== d.mode) active.push('mode');
  if (filters.legend !== d.legend) active.push('legend');
  if (filters.map !== d.map) active.push('map');
  if (filters.withPlayers.length) active.push('withPlayers');
  return active.filter((k) => shown.includes(k));
}

const SETTINGS_ICON = 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4';
const HELP_ICON = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01';

// Set by useData(): in start(), before the first render, and when a match finishes.
let data: Dataset;
let sample: boolean;
let names: Map<string, string>;
let squadOf: Map<string, Set<string>>;
let regulars: Set<string>;
let teammateChips: { playerKey: string; games: number }[];

let filters: Filters = { ...DEFAULT_FILTERS };
const params = new URLSearchParams(location.search);
const VIEWS: View[] = ['overview', 'squads', 'weapons', 'legends', 'matches', 'seasons', 'settings', 'help'];
let view: View = VIEWS.find((v) => v === params.get('view')) ?? 'overview';
/** The first-run welcome is open (?welcome=1 opens it, for screenshots). */
let welcome = params.get('welcome') === '1';

/** Stats from the recordings via the app (src/preload.ts); sample data when there are none, or with ?data=sample. */
async function loadData(): Promise<{ data: Dataset; sample: boolean }> {
  if (params.get('data') !== 'sample' && window.apex) {
    try {
      const real = await window.apex.loadDataset();
      // Season stats alone are enough: a new install shows its rank and seasons before any match.
      if (real.matches.length || real.seasons.length) return { data: real, sample: false };
    } catch (err) {
      console.error('Could not load the recordings; showing sample data.', err);
    }
  }
  return { data: generateMockData(), sample: true };
}

function useData(loaded: { data: Dataset; sample: boolean }): void {
  ({ data, sample } = loaded);
  names = new Map(data.players.map((p) => [p.playerKey, p.name]));
  squadOf = teammateIndex(data);
  regulars = regularPlayers(data);
  teammateChips = frequentTeammates(data, data.matches, 6);
}

async function start(): Promise<void> {
  useData(await loadData());
  // ?match=<id> or ?match=latest opens that match's details (dev aid for screenshots).
  const matchParam = params.get('match');
  if (matchParam) {
    openMatch(matchParam === 'latest' ? [...data.matches].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0].matchId : matchParam);
  }
  render();
  window.addEventListener('resize', () => render());
  // First run: the welcome, until it's dismissed (Help can show it again).
  window.apex?.loadSettings().then((s) => {
    if (s.welcomeSeen || welcome) return;
    welcome = true;
    render();
  }, () => undefined);
  // A match finished: new numbers, same view and filters.
  window.apex?.onDatasetChanged(async () => {
    if (params.get('data') === 'sample') return;
    useData(await loadData());
    renderInPlace();
  });
}

/**
 * render() for new data that nobody asked for: the rebuilt page keeps each
 * scrolled area where it was, instead of jumping back to the top.
 */
function renderInPlace(): void {
  const scrolled = Array.from(root.querySelectorAll<HTMLElement>('*'))
    .filter((e) => e.scrollTop || e.scrollLeft)
    .map((e) => ({ path: childPath(e), className: e.className, top: e.scrollTop, left: e.scrollLeft }));
  render();
  for (const s of scrolled) {
    // Containers come before the rows in them, so their position in the tree survives new rows.
    const e = s.path.reduce<Element | undefined>((node, i) => node?.children[i], root);
    if (e instanceof HTMLElement && e.className === s.className) {
      e.scrollTop = s.top;
      e.scrollLeft = s.left;
    }
  }
}

function childPath(e: Element): number[] {
  const path: number[] = [];
  for (let node = e; node !== root && node.parentElement; node = node.parentElement) {
    path.unshift(Array.prototype.indexOf.call(node.parentElement.children, node));
  }
  return path;
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
    showWelcome: () => {
      welcome = true;
      render();
    },
  };
  const content = renderView(ctx);
  const filtered = VIEW_FILTERS[view].length > 0;
  // In the app with nothing recorded yet: say that the numbers are made up, and what to do.
  const notice = sample && window.apex && params.get('data') !== 'sample' && view !== 'settings' && view !== 'help' ? sampleNotice() : null;
  root.replaceChildren(
    el('div', { class: 'app' },
      titleBar(),
      el('div', { class: 'body' },
        sidebar(),
        el('main', { class: `main${filtered ? '' : ' no-filters'}${notice ? ' with-notice' : ''}` },
          ...(notice ? [notice] : []), ...(filtered ? [filterBar(VIEW_FILTERS[view])] : []), content.node),
      ),
      ...(welcome ? [welcomeDialog()] : []),
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
  if (view === 'seasons') return seasonsView(ctx);
  if (view === 'help') return helpView(ctx);
  return settingsView(ctx);
}

// ---------------------------------------------------------------- first run

function sampleNotice(): HTMLElement {
  return el('div', { class: 'notice' },
    el('strong', {}, 'No matches recorded yet.'),
    " These are sample numbers to show what you'll get. Keep Apex Squads running while you play: your own stats replace them after your first match.");
}

function welcomeDialog(): HTMLElement {
  const close = () => {
    welcome = false;
    render();
    const bridge = window.apex;
    // Re-read first: Settings may have saved other changes since this window loaded them.
    void bridge?.loadSettings().then((s) => bridge.saveSettings({ ...s, welcomeSeen: true }));
  };
  const start = el('button', { type: 'button', class: 'button' }, "Let's go");
  start.addEventListener('click', close);
  const skip = el('button', { type: 'button', class: 'link-button' }, 'Skip');
  skip.addEventListener('click', close);
  const point = (title: string, text: string) => el('li', {}, el('div', { class: 'setting-title' }, title), el('div', { class: 'setting-help' }, text));
  return el('div', { class: 'welcome-backdrop' },
    el('div', { class: 'welcome', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcome-title' },
      el('h1', { id: 'welcome-title', class: 'welcome-title' }, 'Welcome to Apex Squads'),
      el('p', { class: 'welcome-lead' }, 'Stats for you and your squads, from every match you play.'),
      el('ul', { class: 'welcome-points' },
        point('Records in the background', 'Start it before Apex. Closing the window keeps it recording in the tray.'),
        point('Your squads, weapons and legends', 'How you do with whom and with what, match by match and season by season.'),
        point('Cards during matches', 'Who killed you, who you killed, and who in the lobby to watch out for. Set them up in Settings.'),
        point('Stays on this PC', 'Your matches are saved on this computer, not uploaded.')),
      el('div', { class: 'welcome-actions' }, start, skip)));
}

// ---------------------------------------------------------------- title bar

function titleBar(): HTMLElement {
  const mark = svgEl('svg', { class: 'mark', viewBox: '0 0 24 24' });
  mark.append(svgEl('path', { d: 'M12 2 22 21H2z', fill: 'var(--accent)' }), svgEl('path', { d: 'M12 10l4 8H8z', fill: 'var(--page)' }));
  return el('header', { class: 'titlebar' },
    mark,
    el('span', { class: 'name' }, 'Apex Squads'),
    ...(sample ? [el('span', { class: 'pill' }, 'Sample data')] : []),
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
    el('nav', { class: 'nav', style: 'padding-bottom: 8px' }, navLink('help', 'Help', HELP_ICON), navLink('settings', 'Settings', SETTINGS_ICON)),
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

function filterBar(shown: readonly FilterKey[]): HTMLElement {
  const active = activeFilters(shown);
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

  const reset = el('button', { type: 'button', class: `link-button${active.length ? ' active' : ''}`,
    title: active.length ? `${active.length} ${active.length === 1 ? 'filter narrows' : 'filters narrow'} every page` : 'Back to the default filters' },
  active.length ? `Reset (${active.length})` : 'Reset');
  reset.addEventListener('click', () => setFilters({ ...DEFAULT_FILTERS }));

  const accountOptions: [string, string][] = [['all', 'All accounts'],
    ...data.accounts.map((a) => [a.accountKey, a.rank ? `${a.name} · ${rankText(a)}` : a.name] as [string, string])];
  const parts: Record<FilterKey, HTMLElement> = {
    account: selectFilter('Account', accountOptions, filters.account, active.includes('account'), (v) => setFilters({ account: v })),
    period: periodFilter,
    mode: selectFilter('Mode', [['ranked', 'Ranked'], ['pubs', 'Pubs'], ['all', 'All modes']], filters.mode, active.includes('mode'),
      (v) => setFilters({ mode: v as Filters['mode'] })),
    legend: selectFilter('Legend', [['all', 'All legends'], ...legends.map((l) => [l, l] as [string, string])], filters.legend,
      active.includes('legend'), (v) => setFilters({ legend: v })),
    map: selectFilter('Map', [['all', 'All maps'], ...maps.map((m) => [m, m] as [string, string])], filters.map, active.includes('map'),
      (v) => setFilters({ map: v })),
    withPlayers: el('div', { class: 'filter' }, el('span', { class: 'label' }, 'Played with'), chips),
  };
  return el('div', { class: 'filters' }, ...ALL_FILTERS.filter((k) => shown.includes(k)).map((k) => parts[k]), reset);
}

/** A labelled dropdown; `active` (narrowed from its default) gets the accent outline. */
function selectFilter(label: string, options: [string, string][], value: string, active: boolean, onChange: (v: string) => void) {
  const select = el('select', { 'aria-label': label }) as HTMLSelectElement;
  for (const [v, text] of options) {
    const o = el('option', { value: v }, text) as HTMLOptionElement;
    o.selected = v === value;
    select.append(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  return el('div', { class: `filter${active ? ' active' : ''}` }, el('span', { class: 'label' }, label), select);
}

function rankText(a: Account): string {
  return a.rank ? rankName(a.rank.tier, a.rank.division) : '–';
}

void start();
