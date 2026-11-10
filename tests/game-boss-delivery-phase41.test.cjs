'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

function deliveryScene(stage, withBoss, { oil = 100, curse = 0 } = {}) {
  const g = loadGame({ stage, seed: 481 });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  assert.equal(g.prepareOrder(), true);
  g.atDestination();
  if (withBoss) { g.prepareBoss(); g.moveBoss(120); }
  g.update(0.05);
  assert.equal(g.snapshot().job.reading, true);
  g.setOil(oil);
  g.setInvulnerability(0);
  g.setCurseSeconds(curse);
  return g;
}

function frozenBullet(g) {
  const s = g.snapshot();
  s.enemyBullets.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 2 });
}

for (const stage of ['night-town', 'rain-port']) {
  test(`Phase41 ${stage}: delivery expiry with nearby Boss keeps safety and its timer`, () => {
    const g = deliveryScene(stage, true);
    const before = g.snapshot();
    const boss = before.enemies.find(e => e.type === 'boss');
    before.job.barrierTimer = 0.025;
    frozenBullet(g);
    const elapsed = before.elapsed, oil = before.oil;
    g.update(0.05);
    const after = g.snapshot();
    assert.equal(after.job, null, 'expired parcel must be settled and removed once');
    assert.equal(after.failed, before.failed + 1);
    assert.equal(after.elapsed, elapsed, 'Boss must protect expiry handoff frame');
    assert.equal(after.oil, oil - 5, 'only the delivery expiry penalty applies');
    assert.equal(after.enemyBullets.length, 1, 'bullet remains frozen');
    assert.equal(boss.barrierTimer ?? 10, 10, 'handoff cannot spend Boss countdown');
    g.update(0.05);
    assert.equal(g.snapshot().elapsed, elapsed, 'Boss remains readable next frame');
    assert.ok(boss.barrierTimer < 10 && boss.barrierTimer > 9.9);
  });

  test(`Phase41 ${stage}: low oil survives expiry when Boss protects the handoff`, () => {
    const g = deliveryScene(stage, true, { oil: 10 });
    g.snapshot().job.barrierTimer = 0.025;
    frozenBullet(g);
    g.update(0.05);
    assert.equal(g.snapshot().state, 'play');
    assert.equal(g.snapshot().oil, 5);
    assert.equal(g.snapshot().enemyBullets.length, 1);
  });

  test(`Phase41 ${stage}: expiry without Boss resumes combat immediately`, () => {
    const g = deliveryScene(stage, false);
    const before = g.snapshot();
    before.job.barrierTimer = 0.025;
    frozenBullet(g);
    g.update(0.05);
    const after = g.snapshot();
    assert.equal(after.job, null);
    assert.equal(after.elapsed, before.elapsed + 0.05);
    assert.ok(after.oil < before.oil - 5, 'unprotected player takes bullet damage');
    assert.equal(after.enemyBullets.length, 0);
  });

  test(`Phase41 ${stage}: leaving reading barrier near Boss protects without spending timer`, () => {
    const g = deliveryScene(stage, true);
    const before = g.snapshot();
    const boss = before.enemies.find(e => e.type === 'boss');
    const elapsed = before.elapsed;
    g.placeAt(before.job.to.x + 450, before.job.to.y + 110);
    g.moveBoss(120);
    g.update(0.05);
    const after = g.snapshot();
    assert.equal(after.job.reading, false);
    assert.equal(after.job.readClosed, true);
    assert.equal(after.elapsed, elapsed);
    assert.equal(boss.barrierTimer ?? 10, 10);
  });

  test(`Phase41 ${stage}: active curse prevents Boss protection after delivery expires`, () => {
    const g = deliveryScene(stage, true, { curse: 1 });
    const before = g.snapshot();
    before.job.barrierTimer = 0.025;
    frozenBullet(g);
    g.update(0.05);
    const after = g.snapshot();
    assert.equal(after.job, null);
    assert.equal(after.elapsed, before.elapsed + 0.05);
    assert.ok(after.oil < before.oil - 5);
    assert.equal(after.enemyBullets.length, 0);
    assert.ok(g.combatPhase().curse < 1);
  });
}
