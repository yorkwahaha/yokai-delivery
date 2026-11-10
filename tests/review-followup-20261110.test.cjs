'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadGame} = require('./helpers/game-runtime.cjs');

test('all stage HUD/hunt paths retain delivery guidance until quota, including night-town', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  const huntRules = [...src.matchAll(/const bossHunt(?:ing)? = ([^;]+);/g)];
  assert.equal(huntRules.length, 3, 'ground arrow, HUD model and HUD draw');
  for (const [, condition] of huntRules) {
    assert.match(condition, /delivered >= GOAL_DELIVERIES/);
    assert.doesNotMatch(condition, /STAGE\.id/);
  }
  assert.match(src, /if \(state === "play" && elapsed >= DAWN && finalBossDefeated && delivered < GOAL_DELIVERIES\)/);
});

test('Lv5 katana reaches off-screen foes within its real maxTravel (normal and longblade)', () => {
  for (const [distance, longblade] of [[695, false], [850, true]]) {
    const g = loadGame({stage: 'night-town', seed: 1107});
    g.start();
    g.stopSpawns();
    g.clearSolids();
    g.combatScene('katana', [
      {id: 'offscreen-foe', dx: distance, dy: 0, hp: 500, max: 500}
    ], [], 5);
    if (longblade) g.setBuildMutations(['mut_longblade']);
    g.setFacingAngle(0);
    g.armWeapons();
    const before = g.snapshot().enemies[0].hp;
    for (let tick = 0; tick < 24; tick++) g.weapons(.025);
    assert.ok(g.snapshot().enemies[0].hp < before,
      `Lv5 ${longblade ? 'longblade' : 'normal'} must hit foe at ${distance}px`);
    assert.equal(g.snapshot().winds.length, 0, 'wind dissipates at its world range');
  }
});

test('current attack specs: Lv5 needle benefits from rate; boom/thunder do not promise it', () => {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync('js/game-attack-specs.js', 'utf8'), context);
  const resolve = context.window.GAME_ATTACK_SPECS.resolveAttackSpec;
  const spec = (skillId, rate) => resolve(skillId, 5, {mutations: [], duos: []}, {}, {
    WL: {}, W: 900, b: {crit: 0}, buildMutations: [], buildDuos: [],
    getEffectiveRate: () => rate,
    getEffectiveDmg: () => 1.2,
    getEffectiveReachMultiplier: () => 1,
    EVOLUTIONS: {
      needleCount: () => 8, boomCount: () => 2
    }
  });
  assert.equal(spec('needle', 0).cooldown, 1);
  assert.ok(spec('needle', 2).cooldown < spec('needle', 0).cooldown);
  assert.equal(spec('boom', 0).cooldown, spec('boom', 2).cooldown);
  assert.equal(spec('thunder', 0).cooldown, spec('thunder', 2).cooldown);
});
