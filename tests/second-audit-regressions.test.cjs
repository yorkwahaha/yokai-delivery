'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/delivery-lexicon.js');
const CONTENT = require('../js/words.js');
const WORLD = require('../js/world.js');
const { loadGame } = require('./helpers/game-runtime.cjs');

test('second audit: night-town always has three teaching houses per chunk and 20-word coverage', () => {
  const stage = CONTENT.getStage('night-town');
  const world = WORLD.createStageWorld(stage, CONTENT);
  const seen = new Set();
  for (let x = -24; x <= 24; x++) for (let y = -5; y <= 5; y++) {
    const houses = world.getChunk(x, y).houses;
    assert.equal(houses.length, 3, `chunk ${x},${y}`);
    for (const h of houses) seen.add(h.word.jp);
  }
  const expected = CONTENT.getStageWords(stage).map(w => w.jp);
  for (const word of expected) assert.ok(seen.has(word), `no house teaches ${word}`);
});

test('second audit: rain-port covers all 20 words across port house lattice', () => {
  const stage = CONTENT.getStage('rain-port');
  const world = WORLD.createStageWorld(stage, CONTENT);
  const seen = new Set();
  for (let x = -50; x <= 50; x++) {
    for (const h of world.getChunk(x, 0).houses) seen.add(h.word.jp);
  }
  for (const word of CONTENT.getStageWords(stage)) {
    assert.ok(seen.has(word.jp), `no port house teaches ${word.jp}`);
  }
});

for (const stage of ['night-town', 'rain-port']) {
  test(`second audit: ${stage} final boss can only grant reward once; dying clone stays`, () => {
    const g = loadGame({ stage, seed: 142 });
    g.start();
    g.stopSpawns();
    g.prepareBoss();
    const original = g.snapshot();
    const boss = original.enemies.find(e => e.type === 'boss');
    Object.assign(boss, { final: true, hp: 1, shield: false, oilReward: 35, speed: 0 });
    // All stages now require both the delivery quota and the final Boss.
    g.meetDeliveryGoal();
    g.hurt(boss, 100);
    const victory = g.snapshot();
    assert.equal(victory.state, 'victory');
    assert.equal(victory.score - original.score, 400);
    const clone = victory.enemies.find(e => e.dying === true);
    assert.ok(clone, 'victory disintegration clone is retained');
    assert.equal(clone.hp, 1);
    g.hurt(clone, 100);
    const after = g.snapshot();
    assert.equal(after.score, victory.score);
    assert.equal(clone.hp, 1);
    assert.equal(after.state, 'victory');
  });

  test(`second audit: ${stage} wrong Boss answer ends safe reading and combat time resumes`, () => {
    const g = loadGame({ stage, seed: 143 });
    g.start();
    g.stopSpawns();
    g.prepareBoss();
    g.setOil(80);
    g.update(0.08);
    const q = g.snapshot().bossQ;
    const boss = g.snapshot().enemies.find(e => e.type === 'boss');
    assert.ok(q);
    g.unlockBoss();
    const wrong = q.ans.findIndex(w => w !== boss.word);
    assert.ok(wrong >= 0);
    g.answerBoss(wrong);
    assert.equal(boss.quizClosed, true, 'wrong choice must close the safe barrier');
    const before = g.snapshot();
    g.update(0.2);
    const after = g.snapshot();
    assert.ok(after.elapsed > before.elapsed, 'world clock must advance');
    assert.ok(after.oil < before.oil, 'normal combat oil drain must resume');
  });
}

test('second audit: rain-port final Boss with insufficient deliveries does not start victory', () => {
  const g = loadGame({ stage: 'rain-port', seed: 144 });
  g.start();
  g.stopSpawns();
  g.prepareBoss();
  const boss = g.snapshot().enemies.find(e => e.type === 'boss');
  Object.assign(boss, { final: true, hp: 1, shield: false, oilReward: 35 });
  const before = g.snapshot();
  g.hurt(boss, 100);
  const after = g.snapshot();
  assert.equal(after.state, 'play');
  assert.equal(after.score - before.score, 400);
  assert.equal(after.finalBossDefeated, true);
  assert.equal(after.enemies.some(e => e.dying), false);
});
