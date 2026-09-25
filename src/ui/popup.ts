/**
 * The popup (a small transparent window over the game, see
 * src/popup-window.ts). It draws whatever card the main process sends.
 */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/700.css';
import './popup.css';
import './bridge';
import { el } from './dom';
import type { EncounterPopup, LobbyPopup, PlayerCard } from './popup-card';

const root = document.getElementById('popup')!;

window.apex?.onPopup((popup) => {
  root.replaceChildren(popup.moment === 'lobby' ? renderLobby(popup) : render(popup));
});

function render(p: EncounterPopup): HTMLElement {
  const killed = p.moment === 'killed_by';
  return el('div', { class: `card ${killed ? 'killed-by' : 'you-killed'}` },
    el('div', { class: 'moment' }, killed ? 'Killed by' : 'You killed'),
    ...playerLines(p.player),
    ...(p.knockedBy ? [knockedBy(p.knockedBy)] : []),
  );
}

function renderLobby(p: LobbyPopup): HTMLElement {
  return el('div', { class: 'card lobby' },
    el('div', { class: 'moment' }, 'In this lobby'),
    ...p.players.map((c) => el('div', { class: 'lobby-player' },
      el('div', { class: 'who' }, c.name),
      el('div', { class: 'history' }, historyParts(c).join(' · ')),
    )),
  );
}

function playerLines(c: PlayerCard): HTMLElement[] {
  const lines: HTMLElement[] = [el('div', { class: 'name' }, c.name)];

  const fight = [usedText(c.weapon), c.damageFromMe !== null ? `you hit them for ${c.damageFromMe}` : ''].filter(Boolean);
  if (fight.length) lines.push(el('div', { class: 'fight' }, fight.join(' · ')));

  const match = el('div', { class: 'match' }, `${c.kills} ${c.kills === 1 ? 'kill' : 'kills'} this match`);
  if (c.killLeader) match.append(el('span', { class: 'chip' }, 'Kill leader'));
  lines.push(match);

  if (c.anonymous) lines.push(el('div', { class: 'history' }, 'Anonymous mode: no history'));
  else if (c.metBefore || c.theyKilledMe || c.iKilledThem) lines.push(el('div', { class: 'history' }, historyParts(c).join(' · ')));
  return lines;
}

/** "with Flatline"; a knocked player who died in the ring is credited to the knocker, "in the ring". */
function usedText(weapon: string | null): string {
  if (!weapon) return '';
  return weapon === 'The Ring' ? 'in the ring' : `with ${weapon}`;
}

function historyParts(c: PlayerCard): string[] {
  const parts = [`met ${c.metBefore}× before`];
  if (c.kd !== null) parts.push(`K/D ${c.kd.toFixed(2)}`);
  if (c.theyKilledMe) parts.push(`killed you ${c.theyKilledMe}×`);
  if (c.iKilledThem) parts.push(`you killed them ${c.iKilledThem}×`);
  return parts;
}

function knockedBy(c: PlayerCard): HTMLElement {
  const bits = [usedText(c.weapon), c.damageFromMe !== null ? `you hit them for ${c.damageFromMe}` : ''].filter(Boolean);
  return el('div', { class: 'knocked-by' },
    el('span', { class: 'label' }, 'Knocked by '), el('span', { class: 'who' }, c.name),
    bits.length ? ` · ${bits.join(' · ')}` : '');
}
