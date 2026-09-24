/**
 * The kill/death popup (a small transparent window over the game, see
 * src/popup-window.ts). It draws whatever card the main process sends.
 */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/700.css';
import './popup.css';
import './bridge';
import { el } from './dom';
import type { PlayerCard, Popup } from './popup-card';
import { rankName } from './ranks';

const root = document.getElementById('popup')!;

window.apex?.onPopup((popup) => {
  root.replaceChildren(render(popup));
});

function render(p: Popup): HTMLElement {
  const killed = p.moment === 'killed_by';
  return el('div', { class: `card ${killed ? 'killed-by' : 'you-killed'}` },
    el('div', { class: 'moment' }, killed ? 'Killed by' : 'You killed', p.demo ? el('span', { class: 'demo' }, 'demo ranks') : ''),
    ...playerLines(p.player),
    ...(p.knockedBy ? [knockedBy(p.knockedBy)] : []),
  );
}

function playerLines(c: PlayerCard): HTMLElement[] {
  const lines: HTMLElement[] = [el('div', { class: 'name' }, c.name)];

  const rank = el('div', { class: 'rank' });
  if (c.rank) {
    rank.append(el('span', { class: 'tier' }, rankLabel(c.rank)), ` · ${c.rank.score.toLocaleString('en-GB')} RP`);
  } else if (c.anonymous) {
    rank.append(el('span', { class: 'unknown' }, 'Anonymous mode: rank hidden'));
  } else {
    rank.append(el('span', { class: 'unknown' }, 'Rank unknown'));
  }
  lines.push(rank);
  if (c.peak) lines.push(el('div', { class: 'peak' }, `Peak seen: ${rankLabel(c.peak)}${seasonLabel(c.peak.season)}`));

  const extra = [c.level !== null ? `Level ${c.level}` : '', c.topPercent !== null ? `top ${fmtPct(c.topPercent)}` : ''].filter(Boolean);
  if (extra.length) lines.push(el('div', { class: 'meta' }, extra.join(' · ')));

  const match = el('div', { class: 'match' }, `${c.kills} ${c.kills === 1 ? 'kill' : 'kills'} · ${c.knocks} ${c.knocks === 1 ? 'knock' : 'knocks'} this match`);
  if (c.killLeader) match.append(el('span', { class: 'chip' }, 'Kill leader'));
  lines.push(match);

  if (c.metBefore || c.theyKilledMe || c.iKilledThem) {
    const parts = [`met ${c.metBefore}× before`];
    if (c.theyKilledMe) parts.push(`killed you ${c.theyKilledMe}×`);
    if (c.iKilledThem) parts.push(`you killed them ${c.iKilledThem}×`);
    lines.push(el('div', { class: 'history' }, parts.join(' · ')));
  }
  return lines;
}

function knockedBy(c: PlayerCard): HTMLElement {
  const bits = [c.rank ? rankLabel(c.rank) : c.anonymous ? 'anonymous' : 'rank unknown', `${c.kills} ${c.kills === 1 ? 'kill' : 'kills'}`];
  return el('div', { class: 'knocked-by' }, el('span', { class: 'label' }, 'Knocked by '), el('span', { class: 'who' }, c.name), ` · ${bits.join(' · ')}`);
}

function rankLabel(r: { tier: string; div: number }): string {
  return rankName(r.tier, r.div || null);
}

/** "br_ranked_s29_s2" -> " (S29)". */
function seasonLabel(season: string | null): string {
  const n = season ? /s(\d+)/.exec(season)?.[1] : null;
  return n ? ` (S${n})` : '';
}

function fmtPct(n: number): string {
  return `${n < 1 ? n.toFixed(2) : n < 10 ? n.toFixed(1) : Math.round(n)}%`;
}
