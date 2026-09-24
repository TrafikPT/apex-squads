export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtInt(Math.abs(n));
export const signedFixed = (n: number, digits: number) => {
  const text = Math.abs(n).toFixed(digits);
  // Values that round to zero get no direction.
  if (Number(text) === 0) return `±${text}`;
  return (n > 0 ? '+' : '−') + text;
};
export const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);
export const fixed = (v: number | null, digits: number) => (v === null ? '–' : v.toFixed(digits));
export const place = (v: number | null) => (v === null ? '–' : `#${v.toFixed(1)}`);

export function dayTime(day: string): number {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d).getTime();
}
export const fmtDay = (day: string) =>
  new Date(dayTime(day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function uniqueSorted(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

/** Round, evenly spaced integer axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  // Integer ticks only: a fractional step would round into duplicates (and -0).
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw)!);
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + 1e-9; t += step) ticks.push(Math.round(t) || 0);
  return ticks;
}

/** At most `max` evenly spread indices out of n, always including the first and last. */
export function xTickIndices(n: number, max: number): number[] {
  if (n <= max) return [...Array(n).keys()];
  const step = (n - 1) / (max - 1);
  return [...Array(max).keys()].map((i) => Math.round(i * step));
}
