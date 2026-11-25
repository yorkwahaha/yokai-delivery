'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

function offer() {
  const game = loadGame({ phase42: true });
  game.start();
  game.offerUp();
  assert.equal(game.snapshot().state, 'levelup');
  return game;
}

test('Phase42 的觸控命中與真實卡框、間隙、重抽鈕使用同一排版', () => {
  const game = offer();
  const layout = game.env.UI.levelUpLayout(3);
  for (const [index, card] of layout.cards.entries()) {
    assert.equal(game.hitUpgradeCard({ x: card.x + card.w / 2, y: card.y + card.h / 2 }), index);
  }
  assert.equal(game.hitUpgradeCard({ x: layout.cards[0].x + layout.cards[0].w + 16, y: 200 }), -1);
  const button = layout.reroll;
  const point = { x: button.x + button.w / 2, y: button.y + button.h / 2 };
  assert.equal(game.hitUpgradeCard(point), -1);
  assert.equal(game.hitUpgradeReroll(point), true);
});

test('兩張卡時無效數字鍵不清除焦點，手把十字鍵使用相同的卡數邊界', () => {
  const game = offer();
  game.limitChoices(2);
  game.events.keydown({ key: '3', code: 'Digit3', preventDefault() {} });
  assert.equal(game.upgradeInput().focus, 0);
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  game.env.navigator.getGamepads = () => [{ axes: [0, 0], buttons, connected: true }];
  buttons[15].pressed = true;
  game.pollGamepad();
  assert.equal(game.upgradeInput().focus, 1);
  game.pollGamepad();
  assert.equal(game.upgradeInput().focus, 1);
  assert.equal(game.upgradeInput().mode, 'gamepad');
});

test('觸控點卡先預覽，第二下才確認選擇', () => {
  const game = offer();
  game.unlockUpgradeInput();
  const card = game.env.UI.levelUpLayout(3).cards[0];
  const point = { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  game.tapCanvas(point);
  assert.equal(game.upgradeInput().focus, 0);
  assert.equal(game.snapshot().state, 'levelup');
  game.tapCanvas(point);
  assert.equal(game.snapshot().state, 'play');
});

test('鍵盤切換卡片焦點後，觸控需要重新預覽原本的卡', () => {
  const game = offer();
  game.unlockUpgradeInput();
  const card = game.env.UI.levelUpLayout(3).cards[0];
  const point = { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  game.tapCanvas(point);
  game.events.keydown({ key: 'd', code: 'KeyD', preventDefault() {} });
  assert.equal(game.upgradeInput().focus, 1);
  game.tapCanvas(point);
  assert.equal(game.snapshot().state, 'levelup');
  assert.equal(game.upgradeInput().focus, 0);
  game.tapCanvas(point);
  assert.equal(game.snapshot().state, 'play');
});

test('WASD 照常移動焦點，重綁 R 後升級畫面的 R 仍只重抽一次', () => {
  const game = offer();
  game.unlockUpgradeInput();
  const key = (code, repeat = false) => game.events.keydown({key: code.slice(3).toLowerCase(), code, repeat, preventDefault() {}});
  key('KeyA');
  assert.equal(game.upgradeInput().focus, 0);
  key('KeyD');
  assert.equal(game.upgradeInput().focus, 1);
  assert.equal(game.env.CONTROLS.bind('interact', 'KeyR'), true);
  key('KeyR');
  assert.equal(game.snapshot().state, 'levelup');
  assert.equal(game.upgradeInput().rerolls, 1);
  game.unlockUpgradeInput();
  key('KeyR', true);
  assert.equal(game.upgradeInput().rerolls, 1);
});

test('觸控重抽與手把 Y 各扣一次，手把持續按方向不會在重抽後跳焦點', () => {
  const game = offer();
  game.unlockUpgradeInput();
  const r = game.env.UI.levelUpLayout(3).reroll;
  game.tapCanvas({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  assert.equal(game.upgradeInput().rerolls, 1);
  game.unlockUpgradeInput();
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  game.env.navigator.getGamepads = () => [{ axes: [0, 0], buttons, connected: true }];
  buttons[15].pressed = buttons[3].pressed = true;
  game.pollGamepad();
  assert.equal(game.upgradeInput().rerolls, 0);
  const rerolledFocus = game.upgradeInput().focus;
  game.pollGamepad();
  assert.equal(game.upgradeInput().focus, rerolledFocus);
  assert.equal(game.upgradeInput().rerolls, 0);
});
