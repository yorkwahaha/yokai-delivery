const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../js/config.js');

test('B5: XP curve matches design target Lv36-40 in 10 minutes with actual game XP sources', () => {
  // Simulate actual game XP sources over 10 minutes
  let t = 8;
  let spawned = 0;
  while (t < cfg.RUN_SECONDS) {
    spawned += cfg.spawnCount(t);
    t += cfg.spawnInterval(t);
  }
  
  // Actual game XP sources:
  // - 6 deliveries × 26 XP = 156
  // - Regular enemies: 2 XP per gem (spawned enemies)
  // - 4 bosses × 8 gems × 6 XP = 192
  // - Surge events: ~108 enemies × 2 XP = 216
  const deliveryXP = 6 * cfg.DELIVERY_XP;
  const regularXP = spawned * 2;
  const bossXP = 4 * 8 * 6;
  const surgeXP = 108 * 2;
  const totalXP = deliveryXP + regularXP + bossXP + surgeXP;
  
  // Calculate final level
  let level = 1;
  let xp = totalXP;
  while (xp >= cfg.xpNeed(level)) {
    xp -= cfg.xpNeed(level);
    level++;
  }
  
  // Design target: Lv36-40
  assert.ok(level >= 36 && level <= 40, `Expected Lv36-40, got Lv${level} with ${totalXP} XP`);
  
  // Verify XP curve milestones
  assert.equal(cfg.xpNeed(1), 30);
  assert.equal(cfg.xpNeed(10), 90);
  assert.equal(cfg.xpNeed(20), 90);
  assert.equal(cfg.xpNeed(25), 150);
  assert.equal(cfg.xpNeed(30), 210);
  assert.equal(cfg.xpNeed(40), 330);
  assert.equal(cfg.xpNeed(50), 450);
});

test('B5: XP curve preserves Lv1-20 flat pacing for four awakenings', () => {
  const values = Array.from({ length: 20 }, (_, i) => cfg.xpNeed(i + 1));
  // Lv1-9 should increase
  for (let i = 1; i < 9; i++) {
    assert.ok(values[i] > values[i-1], `Lv${i+1} should be > Lv${i}`);
  }
  // Lv10-20 should be flat at 90
  for (let i = 9; i < 20; i++) {
    assert.equal(values[i], 90, `Lv${i+1} should be 90 (flat for awakenings)`);
  }
});

test('B5: Late game XP need scales linearly +12 per level after 20', () => {
  for (let lv = 21; lv <= 50; lv++) {
    const expected = 90 + (lv - 20) * 12;
    assert.equal(cfg.xpNeed(lv), expected, `Lv${lv} should be ${expected}`);
  }
});

test('B5: 10-minute run pacing constants unchanged', () => {
  assert.equal(cfg.RUN_SECONDS, 600);
  assert.equal(cfg.GOAL_DELIVERIES, 6);
  assert.deepEqual(cfg.BOSS_TIMES, [180, 360, 480, 540]);
  assert.equal(cfg.DELIVERY_XP, 26);
});

test('B5: Spawn rate ramps from 1 to 6 over 10 minutes', () => {
  assert.equal(cfg.spawnCount(0), 1);
  assert.equal(cfg.spawnCount(300), 4);
  assert.equal(cfg.spawnCount(600), 6);
});

test('B5: Spawn interval decreases over time but floors at 0.48', () => {
  assert.ok(cfg.spawnInterval(0) > cfg.spawnInterval(300));
  assert.ok(cfg.spawnInterval(300) > cfg.spawnInterval(600));
  assert.ok(cfg.spawnInterval(600) >= 0.48);
});

test('B5: Enemy tier caps at dawn (600s)', () => {
  assert.equal(cfg.enemyTier(900), cfg.enemyTier(600));
  assert.equal(cfg.enemyTier(1200, 4), cfg.enemyTier(600, 4));
});

test('B5: XP per level table for 30/40/50 verification', () => {
  const table = [30, 40, 50].map(lv => ({
    level: lv,
    xpNeed: cfg.xpNeed(lv),
    cumulative: Array.from({ length: lv }, (_, i) => cfg.xpNeed(i + 1)).reduce((a, b) => a + b, 0)
  }));
  console.log('XP Need Table:', JSON.stringify(table, null, 2));
  assert.deepEqual(table, [
    { level: 30, xpNeed: 210, cumulative: 3086 },
    { level: 40, xpNeed: 330, cumulative: 5846 },
    { level: 50, xpNeed: 450, cumulative: 9806 }
  ]);
});