/**
 * Settings: the popups for now (which ones, where, for how long). Changes are
 * saved at once, and the popup window reads them before each popup, so they
 * apply mid-session without a restart.
 */
import { DEFAULT_SETTINGS, POPUP_POSITIONS, POPUP_SECONDS, type PopupPosition, type Settings } from '../app-settings';
import { el } from '../dom';
import type { ViewContext, ViewResult } from './context';

/** Loaded once from the app, then kept here as it's edited. */
let settings: Settings | null = null;
let loading = false;
/** Why they couldn't be loaded, e.g. an app started before this version (its main process has no settings). */
let loadError: string | null = null;

const POSITION_NAMES: Record<PopupPosition, string> = {
  'top-left': 'Top left', 'top-center': 'Top centre', 'top-right': 'Top right',
  'bottom-left': 'Bottom left', 'bottom-center': 'Bottom centre', 'bottom-right': 'Bottom right',
};

export function settingsView(ctx: ViewContext): ViewResult {
  const bridge = window.apex;
  if (!settings && bridge && !loading) {
    loading = true;
    bridge.loadSettings().then((s) => {
      settings = s;
      ctx.setView('settings');
    }, (err: unknown) => {
      loadError = String(err);
      ctx.setView('settings');
    });
  }
  const current = settings ?? DEFAULT_SETTINGS;
  const editable = Boolean(bridge && settings);
  const update = (patch: Partial<Settings['popups']>) => {
    if (!bridge || !settings) return;
    settings = { ...settings, popups: { ...settings.popups, ...patch } };
    ctx.setView('settings');
    void bridge.saveSettings(settings).then((saved) => {
      settings = saved;
    });
  };
  const p = current.popups;

  const test = el('button', { type: 'button', class: 'button' }, 'Show a test popup');
  test.addEventListener('click', () => void bridge?.testPopup());
  if (!editable) test.setAttribute('disabled', '');

  const card = el('section', { class: 'card settings-card' },
    el('h2', { class: 'card-title' }, 'Popups', el('span', { class: 'aside' }, 'saved as you change them')),
    row('Kill and death cards', "When you're killed, and when you kill someone",
      toggle(p.encounters, editable, (on) => update({ encounters: on }))),
    row('Lobby card', 'At match start, when someone in the lobby killed you before or has a high K/D against your lobbies',
      toggle(p.lobby, editable, (on) => update({ lobby: on }))),
    row('Position', 'Where on the screen they appear', positionPicker(p.position, editable, (position) => update({ position }))),
    row('Stays for', 'A newer popup replaces the one showing',
      segmented(POPUP_SECONDS.map((s) => [s, `${s} s`]), p.seconds, editable, (seconds) => update({ seconds }))),
    el('div', { class: 'settings-actions' }, test,
      el('span', { class: 'footnote' }, 'Popups show over the game only in borderless window mode (Apex: Settings → Video → Display Mode).')),
  );
  if (!bridge) card.append(el('div', { class: 'footnote' }, 'Settings are saved by the app; this browser preview only shows them.'));
  if (loadError) {
    card.insertBefore(el('div', { class: 'settings-error' },
      "Couldn't load your settings, so they can't be changed here. If the app was running before it was updated, restart it."),
    card.children[1]);
  }
  return { node: el('div', { class: 'view view-settings' }, card) };
}

function row(title: string, help: string, control: HTMLElement): HTMLElement {
  return el('div', { class: 'setting' },
    el('div', { class: 'setting-text' }, el('div', { class: 'setting-title' }, title), el('div', { class: 'setting-help' }, help)),
    control);
}

function toggle(on: boolean, enabled: boolean, onChange: (on: boolean) => void): HTMLElement {
  const b = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(on) }, el('span', { class: 'knob' }));
  if (!enabled) b.setAttribute('disabled', '');
  b.addEventListener('click', () => onChange(!on));
  return b;
}

function segmented<T>(options: [T, string][], value: T, enabled: boolean, onChange: (v: T) => void): HTMLElement {
  const group = el('div', { class: 'segmented', role: 'group' });
  for (const [v, label] of options) {
    const b = el('button', { type: 'button', 'aria-pressed': String(v === value) }, label);
    if (!enabled) b.setAttribute('disabled', '');
    b.addEventListener('click', () => onChange(v));
    group.append(b);
  }
  return group;
}

/** A small screen with the six spots to pick from. */
function positionPicker(value: PopupPosition, enabled: boolean, onChange: (p: PopupPosition) => void): HTMLElement {
  const screen = el('div', { class: 'position-picker', role: 'radiogroup', 'aria-label': 'Popup position' });
  for (const position of POPUP_POSITIONS) {
    const b = el('button', { type: 'button', class: 'spot', role: 'radio', 'aria-checked': String(position === value),
      title: POSITION_NAMES[position], 'aria-label': POSITION_NAMES[position] });
    if (!enabled) b.setAttribute('disabled', '');
    b.addEventListener('click', () => onChange(position));
    screen.append(b);
  }
  return el('div', { class: 'position-control' }, screen, el('span', { class: 'setting-help' }, POSITION_NAMES[value]));
}
