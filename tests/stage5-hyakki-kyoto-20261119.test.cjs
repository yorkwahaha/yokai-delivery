'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

const location = { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=hyakki-kyoto' };
const boot = () => loadGame({ location, stage: 'hyakki-kyoto' });
test('京都選同一商街時保留跨店距離、避開占用店家，附近無合法目的地時才跨街', () => {
  const { KYOTO_PROCESSION } = boot().env;
  const from = { id: 'a', x: 0, y: 0, chunkKey: '0,0' };
  const near = { id: 'b', x: 440, y: 0, chunkKey: '0,0' };
  const next = { id: 'c', x: 50, y: 650, chunkKey: '0,1' };
  const occupied = { id: 'd', x: 910, y: 0, chunkKey: '1,0' };
  const busy = new Set([occupied.id]);
  const result = KYOTO_PROCESSION.destinationPool([from, near, next, occupied], from, busy);
  assert.deepEqual(Array.from(result, stop => stop.id), ['b']);
  const fallback = KYOTO_PROCESSION.destinationPool([from, next, occupied], from, busy);
  assert.deepEqual(Array.from(fallback, stop => stop.id), ['c']);
});

test('巡行報信有前搖、每次至多帶動兩隻普通妖，對封印 Boss、混亂怪及式神追兵無效', () => {
  const { KYOTO_PROCESSION } = boot().env;
  const leader = { x: 0, y: 0, processionLeader: true, type: 'runner', hp: 20 };
  const player = { x: 180, y: 20 };
  const boss = { x: 10, y: 0, type: 'boss', hp: 30 };
  const confused = { x: 20, y: 0, type: 'grunt', hp: 30, confusedT: 3 };
  const guards = Array.from({ length: 5 }, (_, i) => ({ x: 25 + 10 * i, y: 0, type: 'grunt', hp: 30 }));
  const mobs = [leader, boss, confused, ...guards];
  const diverted = e => e === guards[0];
  assert.equal(KYOTO_PROCESSION.step(leader, player, mobs, .05, diverted), 'warning');
  assert.equal(guards.filter(e => e.kyotoRally).length, 0);
  assert.equal(KYOTO_PROCESSION.step(leader, player, mobs, .9, diverted), 'rally');
  assert.equal(guards.filter(e => e.kyotoRally).length, 2);
  assert.equal(guards[0].kyotoRally, undefined);
  assert.equal(boss.kyotoRally, undefined);
  assert.equal(confused.kyotoRally, undefined);
  assert.equal(KYOTO_PROCESSION.step(leader, player, mobs, .03, diverted), null);
});

test('S4 勝利置位後才有京都進度資格，公開地圖仍關閉；京都主循環能開獨立市場委託', () => {
  const game = boot();
  assert.equal(game.store().isStageUnlocked('hyakki-kyoto'), false);
  game.store().finish('bamboo-maze', 10, 2, false);
  assert.equal(game.store().isStageUnlocked('hyakki-kyoto'), false);
  game.store().finish('bamboo-maze', 900, 6, true);
  assert.equal(game.store().isStageUnlocked('hyakki-kyoto'), true);
  assert.equal(game.env.CONTENT.getStage('hyakki-kyoto').mapReleased, false);
  assert.equal(game.env.CONTENT.getStageWords('hyakki-kyoto').length, 20);
  game.start('hyakki-kyoto');
  const scene = game.snapshot();
  assert.ok(scene.orders.length > 0);
  assert.ok(game.worldSolids().some(s => s.kind === 'kyoto-stall'));
  const stopIds = scene.orders.flatMap(order => [order.from.id, order.to.id]);
  assert.equal(new Set(stopIds).size, stopIds.length);
  for (const order of scene.orders) {
    assert.match(order.from.bType, /^kyoto_/);
    assert.match(order.to.bType, /^kyoto_/);
    for (const p of game.env.WORLD.answerPositions(order.to)) {
      assert.equal(game.spotBlocked(p.x, p.y, 18), false);
    }
  }
  game.winStage();
  game.start('hyakki-kyoto');
  assert.equal(game.snapshot().enemies.length, 0);
});

test('京都終王半血封街逐段重做預警，封印與暫停保留，實際傷害對齊已鎖定的路線', () => {
  const game = boot();
  const ai = game.env.BOSS_AI;
  const boss = { x: 0, y: 0, hp: 100, max: 250, final: true, shield: true, stageId: 'hyakki-kyoto' };
  const player = { x: 180, y: 80 };
  assert.equal(ai.step(boss, player, .1).started, false);
  boss.shield = false;
  assert.equal(ai.step(boss, player, .1).cue, 'crossingWarning');
  const hazard = boss.hazard;
  assert.equal(hazard.kind, 'kyotoCrossing');
  assert.equal(hazard.lanes.length, 2);
  const original = hazard.remaining;
  ai.step(boss, player, 5, { paused: true });
  assert.equal(hazard.remaining, original);
  assert.equal(ai.step(boss, { x: player.x, y: player.y + 100 }, 2).hit, null);
  const first = hazard.lanes[0];
  assert.equal(ai.step(boss, first, .02).hit.kind, 'kyotoCrossing');
  assert.equal(ai.step(boss, first, .02).hit, null);
  ai.step(boss, first, 1);
  assert.equal(ai.step(boss, first, 1).cue, 'crossingWarning');
  assert.equal(hazard.phase, 'telegraph');
  assert.equal(hazard.index, 1);
  assert.deepEqual([first.x, first.y], [player.x, player.y]);
  boss.shield = true;
  assert.equal(ai.step(boss, player, 1).hit, null);
  assert.equal(boss.hazard, undefined);
});

test('京都報信與封街由真實更新推進，離開危險帶不受傷，勝利清掉預警', () => {
  const game = boot();
  game.start('hyakki-kyoto');
  game.stopSpawns();
  game.clearOrders();
  const { x, y } = game.snapshot();
  const leader = game.addMob({ x: x + 145, y, type: 'runner', processionLeader: true });
  const mob = game.addMob({ x: x + 115, y });
  game.update(.05);
  assert.ok(leader.kyotoWarning > 0);
  assert.equal(mob.kyotoRally, undefined);
  game.update(.81);
  assert.ok(mob.kyotoRally > 0);
  const ai = game.env.BOSS_AI;
  const boss = game.addMob({ type: 'boss', x: x - 135, y, stageId: 'hyakki-kyoto' });
  const player = { x, y };
  assert.equal(ai.step(boss, player, .1).started, true);
  assert.equal(boss.hazard.lanes.length, 1);
  ai.step(boss, player, 2);
  const safe = { x, y: y + 90 };
  assert.equal(ai.step(boss, safe, .5).hit, null);
  assert.equal(ai.step(boss, safe, .6).finished, true);
  ai.start(boss, player);
  game.hurt(boss, boss.hp + 1);
  assert.equal(boss.hazard, undefined);
  const next = game.addMob({ type: 'boss', x: x - 135, y, stageId: 'hyakki-kyoto' });
  ai.start(next, player);
  game.winStage();
  assert.equal(next.hazard, undefined);
  assert.equal(mob.kyotoRally, undefined);
});
