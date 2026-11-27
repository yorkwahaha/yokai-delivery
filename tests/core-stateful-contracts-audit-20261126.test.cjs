'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

function gameScene() {
  const game = loadGame({ seed: 97 });
  game.start();
  game.clearOrders();
  game.stopSpawns();
  return game;
}

test('max magnet always collects XP when a gem reaches the courier on a long step', () => {
  const game = gameScene();
  game.forcePostCapForTest();
  const { x, y, gems } = game.snapshot();
  gems.push({ x: x + 30, y, v: 3 });
  game.update(.05);
  assert.equal(game.snapshot().xp, 0, 'magnet movement retains the existing pickup timing');
  game.update(.05);
  assert.equal(game.snapshot().xp, 3);
  assert.equal(game.snapshot().gems.length, 0);
});

test('a visible quiz can only break the seal on its live Boss within reading range', () => {
  const game = gameScene();
  game.prepareBoss();
  game.update(.05);
  game.unlockBoss();
  const { bossQ, enemies, x, y } = game.snapshot();
  const owner = enemies.find(e => e.quiz === bossQ);
  owner.x = x + 381;
  const other = game.addMob({ type: 'boss', shield: true, word: bossQ.word, x: x + 200, y });
  game.answerBoss(bossQ.ans.indexOf(bossQ.word));
  assert.equal(owner.shield, true);
  assert.equal(other.shield, true);
});

test('touch uses only the Boss bars that are drawn when a clone is present', () => {
  const game = gameScene();
  game.prepareBoss();
  game.addMob({ type: 'boss', isClone: true, x: 6000, y: 600 });
  game.update(.05);
  game.unlockBoss();
  const { bossQ, enemies } = game.snapshot();
  const boss = enemies.find(e => e.quiz === bossQ);
  const layout = game.env.UI.bossQuizLayout(bossQ.ans.length, 1);
  const answer = layout.options[bossQ.ans.indexOf(bossQ.word)];
  game.tapCanvas({ x: answer.x + answer.w / 2, y: answer.y + answer.h - 2 });
  assert.equal(boss.shield, false);
});

test('the rendered multi-Boss layout and touch both omit dead, dying, clone and summoned bars', () => {
  const game = gameScene();
  game.prepareBoss();
  game.update(.05);
  game.unlockBoss();
  const { bossQ, enemies, x, y } = game.snapshot();
  const owner = enemies.find(enemy => enemy.quiz === bossQ);
  const visible = game.addMob({type:'boss', x:x+500, y, bossIndex:2});
  for (const fields of [{hp:0}, {dying:true}, {isClone:true}, {isSummon:true}, {officialWaveBoss:false}]) {
    game.addMob({type:'boss', x:x+600, y, ...fields});
  }
  let rendered;
  game.env.UI.drawBossQuiz = (_ctx, question, _mode, bars) => { rendered = {question, bars}; };
  game.frame(0);
  assert.equal(rendered.question, bossQ);
  assert.deepEqual(Array.from(rendered.bars), [owner, visible]);
  const layout = count => game.env.UI.bossQuizLayout(bossQ.ans.length,count).options[bossQ.ans.indexOf(bossQ.word)];
  const target = layout(rendered.bars.length);
  const point = {x:target.x + target.w / 2, y:target.y + target.h / 2};
  for (const count of [1,3,7]) {
    const different = layout(count);
    assert.ok(point.y < different.y || point.y > different.y + different.h, 'distinct hitbox at ' + count);
  }
  game.tapCanvas(point);
  assert.equal(owner.shield,false);
});

test('an assisted delivery marks each live shield that uses its word', () => {
  const game = gameScene();
  assert.equal(game.prepareOrder(), true);
  const { job } = game.snapshot();
  const a = game.addMob({ type: 'boss', shield: true, word: job.word });
  const b = game.addMob({ type: 'boss', shield: true, word: job.word });
  job.assisted = true;
  game.resolve(job.ans.indexOf(job.word));
  assert.equal(a.wasAssisted, true);
  assert.equal(b.wasAssisted, true);
});

test('distance pruning preserves solid collision, including corners and tangency', () => {
  const game = gameScene();
  game.combatScene('katana', [], [{ x0: 20, y0: 20, x1: 40, y1: 40 }]);
  const { x, y } = game.snapshot();
  const r = 18;
  assert.equal(game.spotBlocked(x + 2, y + 32, r), false);
  assert.equal(game.spotBlocked(x + 3, y + 32, r), true);
  assert.equal(game.spotBlocked(x + 6, y + 6, r), false);
  assert.equal(game.spotBlocked(x + 8, y + 8, r), true);
  assert.equal(game.spotBlocked(x + 30, y + 30, r), true);
});
