const test = require("node:test");
const assert = require("node:assert/strict");
const cfg = require("../js/config.js");

test('rain-port removes stacked survival penalties while retaining its stage identity',()=>{
  const stages=require('../js/words.js'),rain=stages.getStage('rain-port'),night=stages.getStage('night-town');
  assert.equal(rain.pacing.goalDeliveries,6);
  assert.equal(rain.pacing.xpNeedScale,1);
  assert.ok(rain.pacing.spawnIntervalScale>=1.15);
  assert.ok(rain.enemy.speedScale<=1);
  assert.equal(rain.enemy.shooterChance,0.06);
  assert.ok(rain.enemy.bossHpScale<=1);
  assert.equal(rain.pacing.runSeconds,600);assert.deepEqual(rain.pacing.bossTimes,[210,420,590]);
  assert.equal(night.pacing.spawnIntervalScale,1);assert.equal(night.pacing.goalDeliveries,6);
  assert.equal(rain.visual.weather,'rain');
});

test("run pacing is ten minutes with a final boss just before dawn", () => {
  assert.equal(cfg.RUN_SECONDS, 600);
  assert.deepEqual(cfg.BOSS_TIMES, [180, 360, 540, 590]);
  assert.equal(cfg.GOAL_DELIVERIES, 6);
});

test("xp curve rises steadily and avoids the old low early thresholds", () => {
  const values = Array.from({ length: 35 }, (_, i) => cfg.xpNeed(i + 1));
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
  assert.ok(values[0] >= 30);
  const toLevel30 = values.slice(0, 29).reduce((a, b) => a + b, 0);
  assert.ok(toLevel30 >= 4000 && toLevel30 <= 5000);
});

test("enemy density ramps across the whole ten-minute run", () => {
  assert.equal(cfg.spawnCount(0), 1);
  assert.equal(cfg.spawnCount(599), 6);
  assert.ok(cfg.spawnInterval(0) > cfg.spawnInterval(300));
  assert.ok(cfg.spawnInterval(300) > cfg.spawnInterval(600));
  assert.ok(cfg.spawnInterval(600) >= 0.48);
});

test("a theoretical full clear of base spawns lands in the low-30 level range", () => {
  let t = 8;
  let spawned = 0;
  while (t < cfg.RUN_SECONDS) {
    spawned += cfg.spawnCount(t);
    t += cfg.spawnInterval(t);
  }
  let xp = spawned * 2;
  let level = 1;
  while (xp >= cfg.xpNeed(level)) {
    xp -= cfg.xpNeed(level);
    level++;
  }
  assert.ok(level >= 30 && level <= 34, `expected low-30s, got Lv.${level}`);
});

test("overtime keeps raising enemy tier without raising spawn pressure", () => {
  assert.ok(cfg.enemyTier(900) > cfg.enemyTier(600));
  assert.ok(cfg.enemyTier(600) > cfg.enemyTier(0));
  assert.equal(cfg.spawnInterval(900), cfg.spawnInterval(600));
  assert.equal(cfg.spawnCount(900), cfg.spawnCount(600));
  assert.ok(Math.abs(cfg.enemyTier(670) - cfg.enemyTier(600) - 1) < 1e-9);
});

test("orders teach the loop gradually instead of flooding the opening", () => {
  assert.equal(cfg.orderSlots(0, 0), 1);
  assert.equal(cfg.orderSlots(60, 1), 2);
  assert.equal(cfg.orderSlots(180, 1), 3);
});
