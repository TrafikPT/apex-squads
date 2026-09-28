import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceleratorFor } from '../src/hotkeys';
import { DEFAULT_SETTINGS, hotkeyLabel, withDefaults } from '../src/ui/app-settings';

test('settings: nothing stored gives the defaults', () => {
  assert.deepEqual(withDefaults(null), DEFAULT_SETTINGS);
  assert.deepEqual(withDefaults({}), DEFAULT_SETTINGS);
});

test('settings: valid values are kept, anything else falls back to its default', () => {
  const s = withDefaults({ popups: { encounters: false, lobby: 'no', position: 'bottom-left', seconds: 9, extra: 1 }, other: true, welcomeSeen: 'yes' });
  assert.deepEqual(s, { popups: { encounters: false, lobby: true, position: 'bottom-left', seconds: 7 }, hotkeys: DEFAULT_SETTINGS.hotkeys, welcomeSeen: false });
  assert.equal(withDefaults({ welcomeSeen: true }).welcomeSeen, true);
  assert.equal(withDefaults({ popups: { position: 'middle' } }).popups.position, 'top-right');
  assert.equal(withDefaults({ popups: { seconds: 15 } }).popups.seconds, 15);
});

test('settings: hotkeys keep valid keys, drop unknown ones, and never share a key', () => {
  const ctrlH = { code: 'KeyH', ctrl: true, alt: false, shift: false };
  assert.deepEqual(withDefaults({ hotkeys: { hide: ctrlH } }).hotkeys, { hide: ctrlH, toggle: DEFAULT_SETTINGS.hotkeys.toggle });
  assert.deepEqual(withDefaults({ hotkeys: { hide: { code: 'Escape' } } }).hotkeys.hide, DEFAULT_SETTINGS.hotkeys.hide);
  assert.deepEqual(withDefaults({ hotkeys: { hide: ctrlH, toggle: ctrlH } }).hotkeys.toggle, DEFAULT_SETTINGS.hotkeys.toggle);
  const f10 = DEFAULT_SETTINGS.hotkeys.toggle;
  assert.deepEqual(withDefaults({ hotkeys: { hide: f10, toggle: f10 } }).hotkeys, { hide: f10, toggle: DEFAULT_SETTINGS.hotkeys.hide });
});

test('hotkeys: names for people and for Electron', () => {
  const h = (code: string, ctrl = false, alt = false, shift = false) => ({ code, ctrl, alt, shift });
  assert.equal(hotkeyLabel(h('F9')), 'F9');
  assert.equal(hotkeyLabel(h('KeyH', true, false, true)), 'Ctrl+Shift+H');
  assert.equal(hotkeyLabel(h('Numpad5', false, true)), 'Alt+Num 5');
  assert.equal(acceleratorFor(h('F9')), 'F9');
  assert.equal(acceleratorFor(h('KeyH', true, false, true)), 'Ctrl+Shift+H');
  assert.equal(acceleratorFor(h('Numpad5', false, true)), 'Alt+num5');
  assert.equal(acceleratorFor(h('Backquote')), '`');
});
