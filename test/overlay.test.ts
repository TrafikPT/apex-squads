import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BrowserWindow } from 'electron';
import { FakeOverlayApi } from '../src/fake-overlay';
import { GameOverlay, type CardsPlace } from '../src/game-overlay';
import { Hotkeys } from '../src/hotkeys';
import { DEFAULT_SETTINGS } from '../src/ui/app-settings';

const APEX = { id: 21566, classId: 215661, name: 'Apex Legends', width: 2560, height: 1440 };
const OTHER = { id: 5426, classId: 54261, name: 'League of Legends' };

function setup(anyGame = false) {
  const fake = new FakeOverlayApi(() => ({ isDestroyed: () => false, destroy: () => undefined }) as unknown as BrowserWindow);
  const logs: string[] = [];
  const overlay = new GameOverlay((...args) => logs.push(args.map(String).join(' ')), anyGame);
  const places: CardsPlace[] = [];
  overlay.onCardsPlaceChanged((p) => places.push(p));
  overlay.attach(fake.api);
  return { fake, overlay, logs, places };
}

/** Lets the overlay's promise chains (helper checks) run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('overlay: registers Apex under both of its ids, and only Apex', () => {
  const { fake } = setup();
  assert.deepEqual(fake.registered, { gamesIds: [21566, 215661] });
  fake.launch(OTHER);
  assert.deepEqual(fake.injectCalls, []);
});

test('overlay: Apex is recognised by id or by classId', () => {
  for (const game of [APEX, { ...APEX, id: 215661, classId: 21566 }]) {
    const { fake, overlay } = setup();
    fake.launch(game);
    assert.deepEqual(fake.injectCalls, ['Apex Legends']);
    assert.equal(overlay.cardsPlace, 'in-game');
  }
});

test('overlay: APEX_OVERLAY_ANY_GAME takes any game', () => {
  const { fake, overlay } = setup(true);
  assert.deepEqual(fake.registered, { all: true });
  fake.launch(OTHER);
  assert.equal(overlay.cardsPlace, 'in-game');
});

test('overlay: a game without overlay support is left alone', () => {
  const { fake, overlay } = setup();
  fake.launch({ ...APEX, supported: false });
  assert.deepEqual(fake.injectCalls, []);
  assert.equal(overlay.cardsPlace, 'window');
});

test('overlay: the game area comes from the game window; gone when the game closes', () => {
  const { fake, overlay, places } = setup();
  let injected = 0;
  let exited = 0;
  overlay.onGameInjected(() => injected++);
  overlay.onGameExit(() => exited++);
  assert.equal(overlay.gameArea(), null);
  assert.equal(overlay.injectedApi, null);
  fake.launch(APEX);
  assert.deepEqual(overlay.gameArea(), { width: 2560, height: 1440 });
  assert.equal(overlay.injectedApi, fake.api);
  fake.exit();
  assert.equal(overlay.gameArea(), null);
  assert.equal(overlay.cardsPlace, 'window');
  assert.deepEqual([injected, exited], [1, 1]);
  assert.deepEqual(places, ['in-game', 'window']);
});

test('overlay: createWindow only while in a game', async () => {
  const { fake, overlay } = setup();
  assert.equal(await overlay.createWindow({ name: 'squad-cards' }), null);
  fake.launch(APEX);
  assert.ok(await overlay.createWindow({ name: 'squad-cards' }));
  assert.equal(fake.created.length, 1);
});

test('overlay: elevated Apex without the helper asks for it; installing it gets the cards in', async () => {
  const { fake, overlay, places } = setup();
  fake.launch({ ...APEX, elevated: true });
  await settle();
  assert.equal(overlay.cardsPlace, 'needs-helper');
  assert.equal(await overlay.installHelper(), 'installed');
  assert.equal(overlay.cardsPlace, 'in-game');
  assert.deepEqual(places, ['needs-helper', 'in-game']);
  assert.deepEqual(fake.injectCalls, ['Apex Legends', 'Apex Legends']);
});

test('overlay: helper declined at the UAC prompt, or failing, leaves the cards in their window', async () => {
  for (const [outcome, result] of [['declined', 'declined'], ['failed', 'failed']] as const) {
    const { fake, overlay } = setup();
    fake.helperOutcome = outcome;
    fake.launch({ ...APEX, elevated: true });
    await settle();
    assert.equal(await overlay.installHelper(), result);
    assert.equal(overlay.cardsPlace, 'needs-helper');
    fake.exit();
    assert.equal(overlay.cardsPlace, 'window');
  }
});

test('overlay: elevated Apex with the helper already there just goes in', async () => {
  const { fake, overlay } = setup();
  fake.helperInstalled = true;
  fake.launch({ ...APEX, elevated: true });
  await settle();
  assert.equal(overlay.cardsPlace, 'in-game');
});

test('overlay: installing the helper before any overlay is unavailable', async () => {
  const overlay = new GameOverlay(() => undefined);
  assert.equal(await overlay.installHelper(), 'unavailable');
});

test('hotkeys: in the game they are overlay hotkeys that pass the key on, and fire their actions', () => {
  const { fake, overlay } = setup();
  const done: string[] = [];
  const hotkeys = new Hotkeys(overlay, { register: () => false, unregister: () => undefined }, { hideCard: () => done.push('hide'), toggleCards: () => done.push('toggle') }, () => undefined);
  fake.launch(APEX);
  hotkeys.apply(DEFAULT_SETTINGS);
  assert.deepEqual(fake.hotkeys.all().map((h) => [h.name, h.keyCode, h.passthrough]), [['cards-hide', 'F9', true], ['cards-toggle', 'F10', true]]);
  fake.hotkeys.press('cards-hide');
  fake.hotkeys.press('cards-toggle');
  assert.deepEqual(done, ['hide', 'toggle'], 'once per press, not again on release');
  hotkeys.apply({ ...DEFAULT_SETTINGS, hotkeys: { ...DEFAULT_SETTINGS.hotkeys, hide: { code: 'KeyH', ctrl: true, alt: false, shift: false } } });
  const hide = fake.hotkeys.all().find((h) => h.name === 'cards-hide');
  assert.deepEqual([hide?.keyCode, hide?.modifiers], ['KeyH', { ctrl: true, alt: false, shift: false }]);
  hotkeys.clear();
  assert.deepEqual(fake.hotkeys.all(), []);
});
