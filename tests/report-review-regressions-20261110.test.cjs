'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame} = require('./helpers/game-runtime.cjs');

test('reroll of a mutation offer may offer a mutation again at the same level', () => {
  const g = loadGame({stage: 'night-town', seed: 25});
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('needle', 1);
  assert.equal(g.forceLevelUp(), 'levelup');
  assert.ok(g.currentChoices().some(c => c.type === 'mutation'));
  g.waitLevelUpCooldown();
  g.rerollUpgradeForTest();
  assert.ok(g.currentChoices().some(c => c.type === 'mutation'),
    'discarded offers must not start the three-level mutation cooldown');
});

test('expired delivery is removed and cannot be scored a second time', () => {
  const g = loadGame({stage: 'night-town', seed: 20261110});
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  assert.equal(g.prepareOrder(), true);
  g.atDestination();
  g.update(.05);
  const job = g.snapshot().job;
  assert.equal(job.reading, true);
  const correct = job.ans.indexOf(job.word);
  job.barrierTimer = .01;
  g.update(.05);
  assert.equal(g.snapshot().job, null);
  assert.equal(g.snapshot().failed, 1);
  assert.equal(g.snapshot().delivered, 0);
  g.resolve(correct);
  assert.equal(g.snapshot().failed, 1);
  assert.equal(g.snapshot().delivered, 0);
});

test('night-town final Boss kill alone does not bypass the six deliveries', () => {
  const g = loadGame({stage: 'night-town', seed: 1106});
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.placeBoss(3);
  const boss = g.snapshot().enemies.find(e => e.type === 'boss');
  boss.final = true;
  g.hurt(boss, 100);
  assert.ok(boss.hp <= 0);
  assert.equal(g.snapshot().delivered, 0);
  assert.equal(g.snapshot().state, 'play');
});

test('Lv4 frost mutation shares a death-shatter volley across eight needles', () => {
  const g = loadGame({stage: 'night-town', seed: 407});
  g.start();
  g.stopSpawns();
  g.combatScene('needle', [], [], 4);
  g.setBuildMutations(['mut_frost']);
  g.armWeapons();
  g.weapons(.05);
  const shots = g.snapshot().needles;
  assert.equal(shots.length, 8);
  assert.ok(shots[0].volley);
  assert.ok(shots.every(n => n.frost && n.volley === shots[0].volley));
});
