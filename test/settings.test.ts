import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, withDefaults } from '../src/ui/app-settings';

test('settings: nothing stored gives the defaults', () => {
  assert.deepEqual(withDefaults(null), DEFAULT_SETTINGS);
  assert.deepEqual(withDefaults({}), DEFAULT_SETTINGS);
});

test('settings: valid values are kept, anything else falls back to its default', () => {
  const s = withDefaults({ popups: { encounters: false, lobby: 'no', position: 'bottom-left', seconds: 9, extra: 1 }, other: true, welcomeSeen: 'yes' });
  assert.deepEqual(s, { popups: { encounters: false, lobby: true, position: 'bottom-left', seconds: 7 }, welcomeSeen: false });
  assert.equal(withDefaults({ welcomeSeen: true }).welcomeSeen, true);
  assert.equal(withDefaults({ popups: { position: 'middle' } }).popups.position, 'top-right');
  assert.equal(withDefaults({ popups: { seconds: 15 } }).popups.seconds, 15);
});
