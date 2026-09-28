/**
 * Settings: the popups (which ones, where, for how long), their hotkeys, and
 * where the data is. Changes are saved at once; the popup window reads them
 * before each popup and the hotkeys re-register, so they apply without a restart.
 */
import { DEFAULT_SETTINGS, type Hotkey, hotkeyLabel, isHotkeyCode, POPUP_POSITIONS, POPUP_SECONDS, type PopupPosition, sameHotkey,
  type Settings } from '../app-settings';
import type { DataInfo } from '../bridge';
import { el } from '../dom';
import { fmtInt } from '../format';
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
      el('span', { class: 'footnote' }, 'In a match they show inside the game. If the overlay can’t get into Apex, they show over it only in borderless window mode (Apex: Settings → Video → Display Mode).')),
  );
  const helper = helperRow(ctx);
  if (helper) card.insertBefore(helper, card.children[1]);
  if (!bridge) card.append(el('div', { class: 'footnote' }, 'Settings are saved by the app; this browser preview only shows them.'));
  if (loadError) {
    card.insertBefore(el('div', { class: 'settings-error' },
      "Couldn't load your settings, so they can't be changed here. If the app was running before it was updated, restart it."),
    card.children[1]);
  }
  const saveHotkey = (name: HotkeyName, h: Hotkey) => {
    if (!bridge || !settings) return;
    settings = { ...settings, hotkeys: { ...settings.hotkeys, [name]: h } };
    ctx.setView('settings');
    void bridge.saveSettings(settings).then((saved) => {
      settings = saved;
    });
  };
  const node = el('div', { class: 'view view-settings' }, card, hotkeyCard(ctx, current, editable, saveHotkey), dataCard(ctx));
  return {
    node,
    // Re-rendered while capturing: the key button keeps the focus that receives the key.
    mounted: () => node.querySelector<HTMLElement>('.key-button.capturing')?.focus(),
  };
}

// ---------------------------------------------------------------- elevated Apex

type HelperState = 'installing' | 'installed' | 'declined' | 'failed' | 'unavailable';
/** The helper install from this screen: running, or how it went. */
let helperState: HelperState | null = null;

const HELPER_RESULTS: Record<HelperState, string> = {
  installing: 'Windows is asking for permission…',
  installed: 'Done. The cards move into the game within a few seconds, and from now on whenever Apex starts.',
  declined: 'Windows didn’t get permission, so the cards stay in their own window. You can try again.',
  failed: 'It couldn’t be installed. Help → Report a problem has the app’s log.',
  unavailable: 'This version of Overwolf’s overlay can’t do it; the cards stay in their own window.',
};

/**
 * Apex runs as administrator and the overlay can't get in without its helper
 * (src/game-overlay.ts). The Windows permission prompt (UAC) only ever comes
 * from this button: the user asked, and isn't mid-match.
 */
function helperRow(ctx: ViewContext): HTMLElement | null {
  const bridge = window.apex;
  const needed = ctx.status.cards === 'needs-helper';
  if (!bridge || (!needed && helperState !== 'installed')) return null;
  if (!needed) {
    return el('div', { class: 'setting helper' },
      el('div', { class: 'setting-text' }, el('div', { class: 'setting-title' }, 'Cards inside the game'),
        el('div', { class: 'setting-help' }, HELPER_RESULTS.installed)));
  }
  const allow = el('button', { type: 'button', class: 'button' }, 'Allow');
  if (helperState === 'installing') allow.setAttribute('disabled', '');
  allow.addEventListener('click', () => {
    helperState = 'installing';
    ctx.setView('settings');
    void bridge.installOverlayHelper().then((result) => {
      helperState = result;
      ctx.setView('settings');
    }, () => {
      helperState = 'failed';
      ctx.setView('settings');
    });
  });
  const why = 'Apex runs as administrator, so Overwolf’s overlay needs a one-time helper to show the cards inside it. ' +
    'Windows asks for permission. Until then they show in their own window.';
  return el('div', { class: 'setting helper' },
    el('div', { class: 'setting-text' }, el('div', { class: 'setting-title' }, 'Cards inside the game'),
      el('div', { class: 'setting-help' }, helperState ? `${why} ${HELPER_RESULTS[helperState]}` : why)),
    allow);
}

// ---------------------------------------------------------------- hotkeys

type HotkeyName = keyof Settings['hotkeys'];

/** The hotkey waiting for its new key, and why the last try was refused. */
let capturing: HotkeyName | null = null;
let hotkeyError: string | null = null;
const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
const HOTKEY_ACTIONS: Record<HotkeyName, string> = { hide: 'hides a card', toggle: 'turns cards off and on' };

function hotkeyCard(ctx: ViewContext, current: Settings, editable: boolean, save: (name: HotkeyName, h: Hotkey) => void): HTMLElement {
  const keyButton = (name: HotkeyName) => {
    const on = capturing === name;
    const b = el('button', { type: 'button', class: `key-button${on ? ' capturing' : ''}` }, on ? 'Press a key…' : hotkeyLabel(current.hotkeys[name]));
    if (!editable) b.setAttribute('disabled', '');
    b.addEventListener('click', () => {
      capturing = on ? null : name;
      hotkeyError = null;
      ctx.setView('settings');
    });
    b.addEventListener('blur', () => {
      if (capturing !== name) return;
      capturing = null;
      ctx.setView('settings');
    });
    b.addEventListener('keydown', (e) => {
      if (capturing !== name) return;
      e.preventDefault();
      if (MODIFIER_CODES.has(e.code)) return; // wait for the key that goes with them
      capturing = null;
      const next: Hotkey = { code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
      const other: HotkeyName = name === 'hide' ? 'toggle' : 'hide';
      if (e.code === 'Escape') hotkeyError = null;
      else if (!isHotkeyCode(e.code)) hotkeyError = `That key can't be a hotkey. Use a letter, a digit or an F-key, with Ctrl, Alt or Shift if you like.`;
      else if (sameHotkey(next, current.hotkeys[other])) hotkeyError = `${hotkeyLabel(next)} already ${HOTKEY_ACTIONS[other]}.`;
      else {
        hotkeyError = null;
        save(name, next);
        return;
      }
      ctx.setView('settings');
    });
    return b;
  };
  const card = el('section', { class: 'card settings-card' },
    el('h2', { class: 'card-title' }, 'Hotkeys', el('span', { class: 'aside' }, 'click a key to change it')),
    row('Hide the card', 'The card showing now goes away', keyButton('hide')),
    row('Cards off and on', 'Until you press it again or restart the app; a card says which way it went', keyButton('toggle')),
  );
  if (hotkeyError) card.append(el('div', { class: 'settings-error' }, hotkeyError));
  card.append(el('div', { class: 'footnote' },
    'In the game the key still reaches Apex too. F-keys are free in Apex by default; a letter may also do something there.'));
  return card;
}

/** Loaded once, when Settings first opens. */
let data: DataInfo | null = null;
let dataLoading = false;

/** Where the recordings and settings are, and how much there is. */
function dataCard(ctx: ViewContext): HTMLElement {
  const bridge = window.apex;
  if (!data && bridge && !dataLoading) {
    dataLoading = true;
    bridge.dataInfo().then((d) => {
      data = d;
      ctx.setView('settings');
    }, () => undefined);
  }
  const open = el('button', { type: 'button', class: 'button' }, 'Open the recordings folder');
  open.addEventListener('click', () => void bridge?.openRecordingsFolder());
  if (!bridge) open.setAttribute('disabled', '');
  const size = data ? `${fmtInt(data.sessions)} ${data.sessions === 1 ? 'session' : 'sessions'} · ${megabytes(data.bytes)}` : '';
  return el('section', { class: 'card settings-card' },
    el('h2', { class: 'card-title' }, 'Your data', el('span', { class: 'aside' }, 'kept on this PC only')),
    row('Recordings', data ? `${data.recordingsFolder}${size ? ` · ${size}` : ''}` : '–',
      el('span', {})),
    row('Settings', data?.settingsFile ?? '–', el('span', {})),
    el('div', { class: 'settings-actions' }, open,
      el('span', { class: 'footnote' }, 'One file of game events per session. Your stats are rebuilt from them each time.')),
  );
}

function megabytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
