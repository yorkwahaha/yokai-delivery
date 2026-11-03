'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame} = require('./helpers/game-runtime.cjs');

for (const stage of ['night-town', 'rain-port']) {
  test(`Phase37 ${stage}: delivery takes reading priority over nearby shielded Boss`, () => {
    const g = loadGame({stage, seed: 481});
    g.start(); g.stopSpawns();
    assert.equal(g.prepareOrder(), true);
    g.atDestination();
    g.prepareBoss(); g.moveBoss(120);
    const boss = g.snapshot().enemies.find(e => e.type === 'boss');
    g.update(0.05);
    const start = boss.barrierTimer ?? 10;
    assert.equal(g.snapshot().job.reading, true);
    assert.equal(boss.quizEntered, undefined, 'hidden Boss quiz must not claim an entry');
    for (let i = 0; i < 20; i++) g.update(0.05);
    assert.equal(boss.barrierTimer ?? 10, start, 'delivery cannot consume Boss safety time');
    assert.equal(g.snapshot().elapsed, 0, 'delivery pauses battle');
    const job = g.snapshot().job;
    g.resolve(job.ans.indexOf(job.word));
    assert.equal(g.snapshot().job, null);
    g.update(0.05);
    assert.equal(boss.quizEntered, true, 'Boss reading begins once delivery ends');
    assert.ok(boss.barrierTimer < 10 && boss.barrierTimer > 9.9);
  });

  test(`Phase37 ${stage}: existing Boss reading pauses when delivery starts`, () => {
    const g = loadGame({stage, seed: 482});
    g.start(); g.stopSpawns();
    g.prepareBoss(); g.update(0.05);
    const boss = g.snapshot().enemies.find(e => e.type === 'boss');
    const prior = boss.barrierTimer;
    assert.ok(prior < 10);
    assert.equal(g.prepareOrder(), true);
    g.atDestination(); g.moveBoss(120);
    for (let i = 0; i < 20; i++) g.update(0.05);
    assert.equal(g.snapshot().job.reading, true);
    assert.equal(boss.barrierTimer, prior);
  });
}
