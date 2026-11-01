'use strict';
// B3 / night-town: Boss quiz must attach to the nearby shielded Boss,
// even if an earlier shielded Boss is alive elsewhere.
// Controlled VM test only: does not simulate a complete player run.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

test('B3 near second shielded Boss shows its quiz and unlocks only that Boss', () => {
  const g = loadGame({ seed: 37 });
  g.start();
  g.stopSpawns();
  const words = g.env.CONTENT.getStageWords('night-town');
  assert.ok(words.length >= 2);
  g.prepareBoss(words[0]);
  g.prepareBoss(words[1]);
  const { x, y, enemies } = g.snapshot();
  const bosses = enemies.filter(e => e.type === 'boss');
  assert.equal(bosses.length, 2);
  // The first Boss is still alive and shielded, but is outside quiz range.
  Object.assign(bosses[0], { x: x + 900, y, speed: 0 });
  Object.assign(bosses[1], { x: x + 120, y, speed: 0 });
  g.update(0.05);
  const q = g.snapshot().bossQ;
  assert.ok(q, 'player near second Boss must receive a quiz');
  assert.equal(q.word.jp, bosses[1].word.jp, 'quiz must belong to nearby Boss');
  g.unlockBoss();
  const answer = q.ans.indexOf(bosses[1].word);
  assert.ok(answer >= 0);
  g.answerBoss(answer);
  assert.equal(bosses[1].shield, false, 'answer removes the nearby Boss shield');
  assert.equal(bosses[0].shield, true, 'distant first Boss remains shielded');
});

test('B3 single shielded Boss can still be answered normally', () => {
  const g = loadGame({ seed: 38 });
  g.start();
  g.stopSpawns();
  g.prepareBoss();
  g.update(0.05);
  const q = g.snapshot().bossQ;
  assert.ok(q);
  g.unlockBoss();
  const b = g.snapshot().enemies.find(e => e.type === 'boss');
  assert.ok(b);
  const idx = q.ans.indexOf(b.word);
  assert.ok(idx >= 0);
  g.answerBoss(idx);
  assert.equal(b.shield, false);
});

test('B3 two visible shielded Bosses select the closer Boss, not list order', () => {
  const g = loadGame({ seed: 39 });
  g.start();
  g.stopSpawns();
  const words = g.env.CONTENT.getStageWords('night-town');
  g.prepareBoss(words[0]);
  g.prepareBoss(words[1]);
  const { x, y, enemies } = g.snapshot();
  const [near, farther] = enemies.filter(e => e.type === 'boss');
  Object.assign(near, { x: x + 100, y, speed: 0 });
  Object.assign(farther, { x: x + 320, y, speed: 0 });
  g.update(0.05);
  const q = g.snapshot().bossQ;
  assert.ok(q);
  assert.equal(q.word.jp, near.word.jp, 'closest Boss should own the active quiz');
  g.unlockBoss();
  g.answerBoss(q.ans.indexOf(near.word));
  assert.equal(near.shield, false);
  assert.equal(farther.shield, true);
});
