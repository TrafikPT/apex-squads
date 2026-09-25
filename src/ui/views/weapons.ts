import { el } from '../dom';
import { fixed, fmtInt, pct } from '../format';
import { kpis, Kpis, loadoutStats, LoadoutRow, weaponStats, WeaponRow } from '../stats';
import { OTHER_WEAPON, WEAPON_CLASSES, WeaponClass, weaponClass, weaponLabel } from '../weapons';
import type { ViewContext, ViewResult } from './context';
import { damageText, MIN_SAMPLE, rpCell, rpPerMatch, SortColumn, sortableHead, sortRows, SortState,
  vsAverage } from './shared';

/**
 * One fixed colour per weapon class (validated categorical palette, dark mode);
 * colour follows the class, never its rank. "Other" is neutral grey.
 */
const CLASS_COLOR: Record<WeaponClass, string> = {
  'Assault rifle': '#3987e5',
  SMG: '#d95926',
  Shotgun: '#199e70',
  LMG: '#c98500',
  Marksman: '#d55181',
  Sniper: '#008300',
  Pistol: '#9085e9',
  Other: '#6b6a66',
};

const perMatch = (total: number, r: WeaponRow) => (r.matches ? total / r.matches : null);
const isGun = (r: WeaponRow) => r.weapon !== OTHER_WEAPON;

const COLUMNS: SortColumn<WeaponRow>[] = [
  { label: 'Weapon' },
  { label: 'Matches', value: (r) => r.matches, better: 'high' },
  { label: 'Kills', value: (r) => (isGun(r) ? r.kills : null), better: 'high' },
  { label: 'Knocks', value: (r) => (isGun(r) ? r.knocks : null), better: 'high' },
  { label: 'Kills/match', value: (r) => (isGun(r) ? perMatch(r.kills, r) : null), better: 'high' },
  { label: 'Damage', value: (r) => r.damage, better: 'high' },
  { label: 'Dmg/match', value: (r) => perMatch(r.damage, r), better: 'high' },
  { label: 'Share of damage', value: (r) => r.damageShare, better: 'high' },
];

const LOADOUT_COLUMNS: SortColumn<LoadoutRow>[] = [
  { label: 'Loadout' },
  { label: 'Games', value: (r) => r.games, better: 'high' },
  { label: 'Avg place', value: (r) => r.me.avgPlacement, better: 'low' },
  { label: 'vs avg', value: (r) => r.me.avgPlacement, better: 'low' },
  { label: 'Wins', value: (r) => r.me.winRate, better: 'high' },
  { label: 'K/D', value: (r) => r.me.kd, better: 'high' },
  { label: 'Avg kills', value: (r) => r.me.avgKills, better: 'high' },
  { label: 'Avg dmg', value: (r) => r.me.avgDamage, better: 'high' },
  { label: 'RP/match', value: (r) => rpPerMatch(r.me), better: 'high' },
];

// View state kept across re-renders.
let tableMode: 'loadouts' | 'weapons' = 'loadouts';
let sort: SortState = { column: 5, direction: 'desc' };
let loadoutSort: SortState = { column: 1, direction: 'desc' };

export function weaponsView(ctx: ViewContext): ViewResult {
  const rows = weaponStats(ctx.data, ctx.matches);
  const loadouts = loadoutStats(ctx.data, ctx.matches);
  return {
    node: el('div', { class: 'view view-weapons' },
      insights(rows, loadouts),
      typeCard(rows),
      tableMode === 'loadouts' ? loadoutsCard(ctx, loadouts, kpis(ctx.matches)) : weaponsCard(ctx, rows),
    ),
  };
}

/** Card title with the Loadouts / Single weapons switch. */
function tableTitle(ctx: ViewContext, aside: string): HTMLElement {
  const toggle = el('div', { class: 'segmented small', role: 'group', 'aria-label': 'Table' });
  for (const [value, label] of [['loadouts', 'Loadouts'], ['weapons', 'Single weapons']] as const) {
    const b = el('button', { type: 'button', 'aria-pressed': String(tableMode === value) }, label);
    b.addEventListener('click', () => {
      tableMode = value;
      ctx.setView('weapons');
    });
    toggle.append(b);
  }
  return el('h2', { class: 'card-title' }, toggle, el('span', { class: 'aside' }, aside));
}

// ---------------------------------------------------------------- insights

function insights(rows: WeaponRow[], loadouts: LoadoutRow[]): HTMLElement {
  const guns = rows.filter(isGun);
  const mostKills = [...guns].sort((a, b) => b.kills - a.kills)[0];
  const mostUsedLoadout = loadouts[0];
  const bestLoadout = loadouts
    .filter((l) => l.games >= MIN_SAMPLE && l.me.kd !== null)
    .sort((a, b) => b.me.kd! - a.me.kd!)[0];
  const types = classShares(rows).filter((c) => c.cls !== 'Other');
  const topType = types.sort((a, b) => b.share - a.share)[0];

  const tile = (label: string, value: string, sub: string) =>
    el('div', { class: 'tile insight' }, el('div', { class: 'label' }, label), el('div', { class: 'value' }, value),
      el('div', { class: 'sub' }, sub));
  return el('div', { class: 'insights' },
    tile('Most used loadout', mostUsedLoadout ? mostUsedLoadout.weapons.join(' + ') : '–',
      mostUsedLoadout ? `${mostUsedLoadout.games} games` : 'no loadouts in this selection'),
    tile('Best loadout', bestLoadout ? bestLoadout.weapons.join(' + ') : '–',
      bestLoadout ? `${fixed(bestLoadout.me.kd, 2)} K/D · ${bestLoadout.games} games` : `needs ${MIN_SAMPLE}+ games with it`),
    tile('Most kills', mostKills?.weapon ?? '–', mostKills ? `${mostKills.kills} kills · ${mostKills.knocks} knocks` : 'no weapon data'),
    tile('Top weapon type', topType?.cls ?? '–', topType ? `${pct(topType.share)} of your damage` : 'no weapon data'),
  );
}

// ---------------------------------------------------------------- damage by type

function classShares(rows: WeaponRow[]): { cls: WeaponClass; damage: number; share: number }[] {
  const total = rows.reduce((s, r) => s + r.damage, 0);
  const byClass = new Map<WeaponClass, number>();
  for (const r of rows) byClass.set(weaponClass(r.weapon), (byClass.get(weaponClass(r.weapon)) ?? 0) + r.damage);
  // Fixed order (class order, Other last) so segments never reshuffle between filters.
  return [...WEAPON_CLASSES, 'Other' as const]
    .filter((cls) => byClass.get(cls))
    .map((cls) => ({ cls, damage: byClass.get(cls)!, share: total ? byClass.get(cls)! / total : 0 }));
}

function typeCard(rows: WeaponRow[]): HTMLElement {
  const card = el('section', { class: 'card type-card' },
    el('h2', { class: 'card-title' }, 'Damage by weapon type', el('span', { class: 'aside' }, 'share of your damage')));
  const shares = classShares(rows);
  if (!shares.length) {
    card.append(el('div', { class: 'empty' }, 'No weapon data for these filters'));
    return card;
  }
  const bar = el('div', { class: 'stack', role: 'img',
    'aria-label': shares.map((s) => `${s.cls} ${pct(s.share)}`).join(', ') });
  const tip = el('div', { class: 'tooltip', hidden: '' });
  const legend = el('div', { class: 'stack-legend' });
  for (const s of shares) {
    const label = s.cls === 'Other' ? 'Grenades & abilities' : s.cls;
    const seg = el('div', { class: 'seg', tabindex: '0', style: `flex: ${s.share}; background: ${CLASS_COLOR[s.cls]}` });
    const show = () => {
      tip.replaceChildren(
        el('div', { class: 't-value' }, pct(s.share)),
        el('div', {}, el('span', { class: 't-key', style: `background: ${CLASS_COLOR[s.cls]}` }), label),
        el('div', { class: 't-muted' }, `${fmtInt(s.damage)} damage`),
      );
      tip.hidden = false;
      const box = seg.getBoundingClientRect();
      const host = card.getBoundingClientRect();
      tip.style.left = `${Math.min(box.left - host.left + box.width / 2 - 80, host.width - 180)}px`;
      tip.style.top = `${box.bottom - host.top + 8}px`;
    };
    const hide = () => {
      tip.hidden = true;
    };
    seg.addEventListener('pointerenter', show);
    seg.addEventListener('pointerleave', hide);
    seg.addEventListener('focus', show);
    seg.addEventListener('blur', hide);
    bar.append(seg);
    legend.append(el('span', { class: 'legend-item' },
      el('span', { class: 'swatch', style: `background: ${CLASS_COLOR[s.cls]}` }), label,
      el('span', { class: 'legend-value' }, pct(s.share))));
  }
  card.append(bar, legend, tip);
  return card;
}

// ---------------------------------------------------------------- table

function weaponsCard(ctx: ViewContext, rows: WeaponRow[]): HTMLElement {
  const card = el('section', { class: 'card table-card' },
    tableTitle(ctx, 'damage per weapon is estimated from the weapon in hand'));
  if (!rows.length) {
    card.append(el('div', { class: 'empty' }, 'No weapon data for these filters'));
    return card;
  }
  const maxShare = Math.max(...rows.map((r) => r.damageShare));
  const head = sortableHead(COLUMNS, sort, (next) => {
    sort = next;
    ctx.setView('weapons');
  });
  const body = el('tbody', {});
  for (const r of sortRows(rows, COLUMNS, sort)) {
    const cls = weaponClass(r.weapon);
    const gun = isGun(r);
    const row = el('tr', {},
      el('td', {}, el('div', { class: 'weapon-cell' },
        el('span', { class: 'weapon-name' }, weaponLabel(r.weapon)),
        gun ? el('span', { class: 'class-tag' }, el('span', { class: 'swatch', style: `background: ${CLASS_COLOR[cls]}` }), cls) : '')),
      el('td', { class: 'num' }, fmtInt(r.matches)),
      el('td', { class: 'num' }, gun ? fmtInt(r.kills) : '–'),
      el('td', { class: 'num' }, gun ? fmtInt(r.knocks) : '–'),
      el('td', { class: 'num' }, gun ? fixed(perMatch(r.kills, r), 2) : '–'),
      el('td', { class: 'num' }, fmtInt(r.damage)),
      el('td', { class: 'num' }, fmtInt(perMatch(r.damage, r) ?? 0)),
      el('td', { class: 'num' }, el('div', { class: 'games-cell' },
        el('div', { class: 'bar-track' }, el('div', { class: 'bar', style: `width: ${(r.damageShare / maxShare) * 100}%` })),
        el('span', { class: 'share' }, pct(r.damageShare)))),
    );
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, head), body)));
  return card;
}

// ---------------------------------------------------------------- loadouts table

function loadoutsCard(ctx: ViewContext, loadouts: LoadoutRow[], baseline: Kpis): HTMLElement {
  const card = el('section', { class: 'card table-card' },
    tableTitle(ctx, 'loadout = the two guns you held longest in the match'));
  if (!loadouts.length) {
    card.append(el('div', { class: 'empty' }, 'No loadouts in this selection'));
    return card;
  }
  const head = sortableHead(LOADOUT_COLUMNS, loadoutSort, (next) => {
    loadoutSort = next;
    ctx.setView('weapons');
  });
  const body = el('tbody', {});
  for (const l of sortRows(loadouts, LOADOUT_COLUMNS, loadoutSort)) {
    const guns = el('div', { class: 'loadout-cell' });
    l.weapons.forEach((w, i) => {
      if (i) guns.append(el('span', { class: 'plus' }, '+'));
      guns.append(el('span', { class: 'gun' }, el('span', { class: 'swatch', style: `background: ${CLASS_COLOR[weaponClass(w)]}` }),
        el('span', { class: 'weapon-name' }, w)));
    });
    const row = el('tr', {},
      el('td', {}, guns),
      el('td', { class: 'num' }, fmtInt(l.games)),
      el('td', { class: 'num' }, l.me.avgPlacement === null ? '–' : `#${l.me.avgPlacement.toFixed(1)}`),
      vsAverage(baseline, l.me),
      el('td', { class: 'num' }, pct(l.me.winRate)),
      el('td', { class: 'num' }, fixed(l.me.kd, 2)),
      el('td', { class: 'num' }, fixed(l.me.avgKills, 2)),
      el('td', { class: 'num' }, damageText(l.me)),
      rpCell(rpPerMatch(l.me)),
    );
    body.append(row);
  }
  card.append(el('div', { class: 'table-scroll' }, el('table', {}, el('thead', {}, head), body)));
  return card;
}
