import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateRp } from '../src/ui/rp-formula';

const plat = { rpBefore: 8_600, topFiveStreak: 0, kills: 0, assists: 0 };

test('rp formula: entry cost and placement, matching real Platinum matches without takedowns', () => {
  assert.equal(estimateRp({ ...plat, placement: 17 }), -48);
  assert.equal(estimateRp({ ...plat, placement: 14 }), -43);
  assert.equal(estimateRp({ ...plat, placement: 9 }), -38);
  assert.equal(estimateRp({ ...plat, placement: 8 }), -28);
});

test('rp formula: kills and assists are worth more the higher you place', () => {
  // Real: #8 with 1 kill and 1 assist gave 0; #11 with 5 kills gave +17.
  assert.equal(estimateRp({ ...plat, placement: 8, kills: 1, assists: 1 }), 0);
  assert.equal(estimateRp({ ...plat, placement: 11, kills: 5 }), 17);
  assert.equal(estimateRp({ ...plat, placement: 1, kills: 2 }), -48 + 125 + 52);
});

test('rp formula: takedowns past 8 count half; top-5 streaks add up to 40', () => {
  assert.equal(estimateRp({ ...plat, placement: 1, kills: 6, assists: 4 }), -48 + 125 + 26 * 9);
  assert.equal(estimateRp({ ...plat, placement: 4, topFiveStreak: 2 }), -48 + 55 + 10);
  assert.equal(estimateRp({ ...plat, placement: 4, topFiveStreak: 9 }), -48 + 55 + 40);
});

test('rp formula: the entry cost follows the tier before the match', () => {
  assert.equal(estimateRp({ ...plat, rpBefore: 500, placement: 20 }), 0);
  assert.equal(estimateRp({ ...plat, rpBefore: 12_000, placement: 20 }), -65);
});
