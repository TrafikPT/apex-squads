/**
 * Help: getting started, the FAQ, release notes and how to report a problem, as
 * Overwolf's product guidelines ask of apps (docs/overwolf/product-guidelines.md
 * §3.2, §4.6, §4.7, §5.3). Keep the answers true to what the app does.
 */
import { el } from '../dom';
import type { ViewContext, ViewResult } from './context';

const FAQ: [string, string][] = [
  ["Why wasn't my match recorded?",
    'Apex Squads only records while it runs, so start it before Apex: it can start with Windows and wait in the tray. ' +
    'A match counts once it ends; one you leave early may be left out. After an Apex update, Overwolf sometimes pauses ' +
    'its game data for Apex for a while, and matches played then can\'t be recorded. The top right of this window ' +
    'says when that happens, and when Apex runs as administrator, which stops the recording too (start Apex normally, ' +
    'or run Apex Squads as administrator as well).'],
  ["The kill and death cards don't show over the game.",
    'The cards show inside the game through Overwolf\'s overlay, a few seconds after Apex starts. If the overlay ' +
    "can't get into Apex (while Overwolf has Apex's overlay switched off, or when Apex runs as administrator: then " +
    'Settings → Popups has an Allow button, and Windows asks for permission once), the cards are a separate window instead, which Windows shows over Apex only in borderless window mode ' +
    '(Apex: Settings → Video → Display Mode). Also check the cards aren\'t turned off with the hotkey (F10 by ' +
    'default). Which cards show, where, for how long and the hotkeys are in Settings.'],
  ['Why do some players show as a legend name and four digits?',
    "They play with Apex's anonymous mode on. The game hides who they are, and Apex Squads doesn't try to find out."],
  ['Why does some RP say "estimate"?',
    "A match's RP comes from the game's own stats, which arrive a little after the match. When they don't arrive, " +
    'the match shows an estimate from your placement, kills and assists instead.'],
  ['Where is my data, and what leaves this PC?',
    'Everything is saved on this PC, in %APPDATA%\\Apex Squads: a file of game events per session, and your settings. ' +
    "Besides the Overwolf services the app runs on, the only thing it sends is a lookup of your own account's rank on " +
    "apexlegendsstatus.com. It also reads Overwolf's public status of its Apex game data, which sends nothing about you."],
];

/** Newest first. Written for players: what changed for them, not how. */
const RELEASES: { version: string; date: string; notes: string[] }[] = [
  {
    version: '0.1.0', date: 'in development', notes: [
      'Records every match in the background and keeps running in the tray when the window is closed; can start with Windows.',
      'Overview: your rank, RP match by match, the last session and recent matches.',
      'Squads, Weapons, Legends and Matches: how you do with whom, with what, and in every match.',
      'Seasons: your rank and totals season by season, from the game\'s own stats.',
      'Kill, death and lobby cards during matches, inside the game, with settings for which show, where and for how long.',
      'Hotkeys: F9 hides a card, F10 turns cards off and on; change them in Settings.',
      "The top right of the window says whether your matches are being recorded, and when Overwolf's game data for Apex is down.",
    ],
  },
];

export function helpView(ctx: ViewContext): ViewResult {
  const bridge = window.apex;

  const welcome = el('button', { type: 'button', class: 'button' }, 'Show the welcome again');
  welcome.addEventListener('click', () => ctx.showWelcome());
  const start = el('section', { class: 'card help-card' },
    el('h2', { class: 'card-title' }, 'Getting started'),
    el('ol', { class: 'help-steps' },
      el('li', {}, 'Start Apex Squads before Apex. Closing its window keeps it recording in the tray.'),
      el('li', {}, 'Play as usual. Kill, death and lobby cards show during matches (see Settings).'),
      el('li', {}, 'Your stats appear here after each match ends.')),
    el('div', { class: 'settings-actions' }, welcome),
  );

  const faq = el('section', { class: 'card help-card' }, el('h2', { class: 'card-title' }, 'Questions'));
  for (const [question, answer] of FAQ) {
    faq.append(el('details', { class: 'faq' }, el('summary', {}, question), el('p', {}, answer)));
  }

  const releases = el('section', { class: 'card help-card' }, el('h2', { class: 'card-title' }, "What's new"));
  for (const r of RELEASES) {
    releases.append(
      el('div', { class: 'release' },
        el('div', { class: 'release-head' }, el('span', { class: 'release-version' }, `Version ${r.version}`), el('span', { class: 'muted' }, r.date)),
        el('ul', {}, ...r.notes.map((n) => el('li', {}, n)))),
    );
  }

  const open = el('button', { type: 'button', class: 'button' }, 'Open the recordings folder');
  open.addEventListener('click', () => void bridge?.openRecordingsFolder());
  if (!bridge) open.setAttribute('disabled', '');
  const report = el('section', { class: 'card help-card' },
    el('h2', { class: 'card-title' }, 'Report a problem'),
    el('p', { class: 'help-text' },
      'Say what happened and roughly when, and attach the recording of that session: one file per session, named by its start time.'),
    el('div', { class: 'settings-actions' }, open),
  );

  // Dev aid for screenshots: APEX_UI_QUERY="view=help&faq=open" opens the first question.
  if (new URLSearchParams(location.search).get('faq') === 'open') faq.querySelector('details')?.setAttribute('open', '');
  return { node: el('div', { class: 'view view-help' }, start, faq, releases, report) };
}
