/** Table cells and behaviours shared by the stats views. */
import { el } from '../dom';
import { fmtInt, signed, signedFixed } from '../format';
import type { Kpis } from '../stats';

export function rpPerMatch(k: Kpis): number | null {
  return k.rpNet === null || !k.rpMatches ? null : k.rpNet / k.rpMatches;
}

/** Signed RP value, green/red; '–' when there's no ranked data. */
export function rpCell(rp: number | null): HTMLElement {
  const td = el('td', { class: 'num' });
  td.append(rp === null ? el('span', { class: 'muted' }, '–') : el('span', { class: rp >= 0 ? 'good' : 'bad' }, signed(rp)));
  return td;
}

export function damageText(k: Kpis): string {
  return k.avgDamage === null ? '–' : fmtInt(k.avgDamage);
}

/** Placement vs the selection's average: positive = places better. */
export function vsAverage(baseline: Kpis, k: Kpis): HTMLElement {
  const td = el('td', { class: 'num' });
  if (baseline.avgPlacement === null || k.avgPlacement === null) return td;
  const d = baseline.avgPlacement - k.avgPlacement;
  const cls = d > 0.05 ? 'good' : d < -0.05 ? 'bad' : 'muted';
  td.append(el('span', { class: cls, title: 'places better (+) or worse (−) than your average in this selection' }, signedFixed(d, 1)));
  return td;
}

export function headRow(cols: [string, boolean][]): HTMLElement {
  const tr = el('tr', {});
  for (const [label, num] of cols) tr.append(el('th', { class: num ? 'num' : '' }, label));
  return tr;
}

/** Makes a table row act like a button (mouse and keyboard). */
export function clickable(row: HTMLElement, title: string, onClick: () => void): void {
  row.classList.add('clickable');
  row.setAttribute('title', title);
  row.setAttribute('tabindex', '0');
  row.addEventListener('click', onClick);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });
}

// ---------------------------------------------------------------- sortable tables

export interface SortColumn<R> {
  label: string;
  /** Sort value; null sorts last. Columns without one aren't sortable. */
  value?: (r: R) => number | null;
  /** Which direction is "better"; the first click sorts best-first. */
  better?: 'high' | 'low';
}

export interface SortState {
  column: number;
  direction: 'asc' | 'desc';
}

export function sortRows<R>(rows: R[], columns: SortColumn<R>[], sort: SortState): R[] {
  const value = columns[sort.column].value!;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return sort.direction === 'asc' ? va - vb : vb - va;
  });
}

/** Header row where sortable columns toggle the sort on click/Enter. */
export function sortableHead<R>(columns: SortColumn<R>[], sort: SortState, onChange: (next: SortState) => void): HTMLElement {
  const head = el('tr', {});
  columns.forEach((c, i) => {
    if (!c.value) {
      head.append(el('th', {}, c.label));
      return;
    }
    const active = i === sort.column;
    const th = el('th', { class: `num sortable${active ? ' sorted' : ''}`, tabindex: '0',
      'aria-sort': active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none' },
      // Arrow before the label so right-aligned headers still line up with their numbers.
      ...(active ? [el('span', { class: 'sort-arrow' }, sort.direction === 'asc' ? '▲' : '▼')] : []), c.label);
    const toggle = () =>
      onChange(active
        ? { column: i, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { column: i, direction: c.better === 'low' ? 'asc' : 'desc' });
    th.addEventListener('click', toggle);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    head.append(th);
  });
  return head;
}
