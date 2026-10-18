'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// 重用 N2 移動／選卡與 N4 真 hurt 擊殺統計；不 require 舊 test，避免順帶跑長局。
function helpers(name, names, transform = s => s) {
  const file = path.join(__dirname, name);
  const source = fs.readFileSync(file, 'utf8');
  const boundary = source.indexOf('\ntest(');
  assert.ok(boundary > 0, '既有 helper/test 邊界必須存在');
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(transform(source.slice(0, boundary)) + '\nmodule.exports={' + names.join(',') + '};', file);
  return m.exports;
}

const policies = helpers('agy-m1-n2.test.cjs',
  ['stepPolicy0', 'stepPolicy1', 'stepPolicy2', 'handleLevelUp', 'executeOneDelivery']);
const { createSandbox } = helpers('agy-m1-n4.test.cjs', ['createSandbox'], source => {
  source = source.replace('function createSandbox(seed = 777)', 'function createSandbox(seed = 777, difficulty = "normal")');
  source = source.replace("  const rawGame = readJs('game.js');", `
  const originalGetStage = sandbox.CONTENT.getStage;
  sandbox.CONTENT = { ...sandbox.CONTENT, getStage(id) {
    const stage = originalGetStage(id);
    return { ...stage, pacing: { ...stage.pacing, mobDifficulty: difficulty } };
  } };
  const rawGame = readJs('game.js');`);
  return source.replace('getSurgeT: () => surgeT', `getSurgeT: () => surgeT,
      getProfile: () => MOB_DIFFICULTY,
      getProfiles: () => MOB_DIFFICULTY_PROFILES,
      getPacing: (t, power) => mobPacing(t, power),
      getStage: () => STAGE,
      getDawn: () => DAWN,
      testXpNeed: lv => { const previous = level; try { level = lv; return xpNeed(); } finally { level = previous; } },
      bossBlueprint: i => bossBlueprint(i),
      testSpawn: (t, power, roll) => {
        elapsed = t;
        const previousPosition = spawnPosition, previousRandom = Math.random;
        const before = enemies.length;
        try {
          // 統計單測只 stub 出生座標與抽型亂數；HP／速度仍經真正 spawnEnemy。
          spawnPosition = () => ({ x: P.x + 600, y: P.y });
          Math.random = () => roll;
          spawnEnemy(mobPacing(t, power).tier, 560, 0, false);
          return enemies.length > before ? enemies[enemies.length - 1] : null;
        } finally { spawnPosition = previousPosition; Math.random = previousRandom; }
      },
      prepareCapScene: count => {
        enemies = Array.from({ length: count }, () => ({ type: 'ghost', hp: 10000, max: 10000,
          x: P.x + 600, y: P.y, speed: 0, flash: 0, wob: 0 }));
        spawnT = 0; surgeWarningT = 0.01; surgePendingCount = 20; surgePendingTier = 1;
        bossT = 9999;
      }`);
});
const json = x => JSON.parse(JSON.stringify(x));
const round = x => Number(x.toFixed(3));

function simulate(difficulty, policy, seed = 777) {
  const probe = createSandbox(seed, difficulty);
  probe.start('night-town');
  let now = 1000, deliveryIndex = 0, iterations = 0;
  const schedule = [25, 75, 135, 165, 230, 290];
  const checkpoints = {};
  const started = Date.now();
  // 受控導航／正確答題／略過選卡等待；無 XP、油、傷害、無敵、Build 或跳秒注入。
  while (probe.getState() === 'play' && probe.getElapsed() < 360 && iterations++ < 8000) {
    assert.ok(Date.now() - started < 55000, '單案不可超過 55 秒牆鐘預算');
    if (deliveryIndex < schedule.length && probe.getElapsed() >= schedule[deliveryIndex]) {
      deliveryIndex++;
      now = policies.executeOneDelivery(probe, now);
    }
    const quiz = probe.getBossQ();
    if (quiz && quiz.lock <= 0) {
      const boss = probe.getEnemies().find(e => e.type === 'boss' && e.shield && e.word);
      const correct = boss ? quiz.ans.findIndex(w => w.jp === boss.word.jp) : -1;
      if (correct >= 0) probe.answerBoss(correct);
    }
    if (policy === 0) policies.stepPolicy0(probe, now + 50);
    else if (policy === 1) policies.stepPolicy1(probe, now + 50);
    else policies.stepPolicy2(probe, now, probe.getOrders()[0]?.from);
    now += 50;
    probe.runFrame(now);
    policies.handleLevelUp(probe);
    for (const t of [180, 360]) {
      if (!checkpoints[t] && probe.getElapsed() >= t) {
        checkpoints[t] = { oil: round(probe.getOil()), level: probe.getLevel(), kills: probe.getKills(),
          boss: probe.getBossLog().map(b => ({ index: b.index, hp: round(b.bossRef.hp), shield: b.bossRef.shield })) };
      }
    }
  }
  assert.ok(iterations < 8000, '不得把卡住時鐘／未完成模擬誤當存活成功');
  const result = { difficulty, policy, seed, elapsed: round(probe.getElapsed()), state: probe.getState(),
    oil: round(probe.getOil()), level: probe.getLevel(), kills: probe.getKills(), delivered: probe.getDelivered(),
    enemies: probe.getEnemies().filter(e => e.hp > 0).length, checkpoints,
    weapons: json(probe.getWL()),
    bosses: probe.getBossLog().map(b => ({ index: b.index, hp: round(b.bossRef.hp), shield: b.bossRef.shield, defeated: b.defeated })),
    damageTaken: round(probe.getPlayerDamageLog().reduce((n, d) => n + d.amount, 0)),
    wallMs: Date.now() - started };
  console.log('S1_DIFFICULTY_TELEMETRY ' + JSON.stringify(result));
  return result;
}

test('S1 difficulty: normal defaults, immutable hard baseline, bounded growth, and no player-level arms race', () => {
  const p = createSandbox(); p.start('night-town');
  assert.deepEqual(json(p.getProfile()), { hpScale: .65, speedScale: .82, timeScale: .35, powerScale: 0,
    intervalScale: 1.15, cap: 57, surgeCountScale: .6, surgePacingScale: 2, capSurges: true, xpNeedScale: .75 });
  assert.deepEqual(json(p.getProfiles().hard), { hpScale: 1, speedScale: 1, timeScale: 1, powerScale: 1,
    intervalScale: 1, cap: 95, surgeCountScale: 1, surgePacingScale: 1, capSurges: false, xpNeedScale: 1 });
  const cfg = require('../js/config.js');
  const hard = createSandbox(777, 'hard'); hard.start('night-town');
  for (const lv of [1, 5, 10]) {
    assert.equal(p.testXpNeed(lv), Math.round(cfg.xpNeed(lv) * .75));
    assert.equal(hard.testXpNeed(lv), cfg.xpNeed(lv), 'hard XP 需求不變');
  }
  assert.ok(Object.isFrozen(p.getProfiles()) && Object.isFrozen(p.getProfiles().hard));
  assert.equal(p.getDawn(), 600, '不縮短破曉');
  assert.equal(p.getSurgeT(), 150);
  for (const t of [60, 180, 360, 540]) {
    assert.deepEqual(json(p.getPacing(t, 2.2)), json(p.getPacing(t, 11.2)), '升級不再加厚 normal 小怪');
  }
  assert.deepEqual(json(p.getPacing(600, 11.2)), json(p.getPacing(900, 11.2)), '破曉後小怪曲線不再成長');
  for (const [i, hp] of [150, 325, 60, 910].entries()) assert.equal(p.bossBlueprint(i).hp, hp);
});

test('S1 difficulty: actual spawn HP/speed at 60/180/360/540 and Lv1/5/10 examples; other seven stages unchanged', () => {
  const cfg = require('../js/config.js');
  const normalGhostHp = [2, 2, 3, 4];
  const normalGhostSpeed = [44.57725, 48.45175, 54.2635, 60.07525];
  const p = createSandbox(); p.start('night-town');
  for (const [index, t] of [60, 180, 360, 540].entries()) {
    for (const lv of [1, 5, 10]) {
      const ghost = p.testSpawn(t, lv + 1.2, .9);
      assert.equal(ghost.type, 'ghost');
      assert.equal(ghost.hp, normalGhostHp[index]);
      assert.ok(Math.abs(ghost.speed - normalGhostSpeed[index]) < 1e-9, '實際速度符合未四捨五入的數值表');
      if (t > 90) {
        const runner = p.testSpawn(t, lv + 1.2, .1);
        assert.equal(runner.type, 'runner');
        assert.equal(runner.hp, [null, 2, 2, 3][index]);
      }
      if (t > 200) {
        const tank = p.testSpawn(t, lv + 1.2, .3);
        assert.equal(tank.type, 'tank');
        assert.equal(tank.hp, [null, null, 9, 12][index]);
      }
    }
  }
  for (const stage of ['rain-port', 'sakura-pass', 'bamboo-maze', 'hyakki-kyoto', 'snow-temple', 'spirit-ferry', 'yomi']) {
    // 即使 fixture 要求 normal，非夜行町仍必須使用原曲線。
    p.start(stage);
    const data = p.getStage();
    for (const lv of [1, 5, 10]) assert.equal(p.testXpNeed(lv), Math.round(cfg.xpNeed(lv) * data.pacing.xpNeedScale), stage + ' XP 不變');
    assert.equal(p.getProfile().hpScale, 1, stage);
    assert.equal(p.getProfile().cap, 95, stage);
    assert.equal(p.getSurgeT(), data.pacing.surgeFirst, stage);
    for (const t of [60, 180, 360, 540]) {
      for (const lv of [1, 5, 10]) {
        const power = lv + 1.2;
        assert.deepEqual(json(p.getPacing(t, power)), {
          tier: cfg.enemyTier(t, power), interval: cfg.spawnInterval(t) * data.pacing.spawnIntervalScale,
          count: Math.max(1, cfg.spawnCount(t) + data.pacing.spawnCountBonus)
        }, stage);
        for (const [roll, type, hpFactor, speedBase, speedFactor] of [
          [.9, 'ghost', 2, 52, .9], [.1, 'runner', 1.5, 110, 1.1], [.3, 'tank', 7, 32, .4]
        ]) {
          if ((type === 'runner' && t <= 90) || (type === 'tank' && t <= 200)) continue;
          const e = p.testSpawn(t, power, roll);
          assert.equal(e.type, type, stage);
          assert.equal(e.hp, Math.ceil(hpFactor * cfg.enemyTier(t, power)), stage);
          assert.equal(e.speed, (speedBase + t / 600 * 75 * speedFactor) * data.enemy.speedScale, stage);
        }
        if (stage === 'rain-port') {
          const shiome = p.testSpawn(t, power, .6);
          assert.equal(shiome.type, 'shiome');
          assert.equal(shiome.hp, Math.ceil(2.2 * cfg.enemyTier(t, power)));
          assert.equal(shiome.speed, (46 + t / 600 * 75 * .7) * data.enemy.speedScale);
        }
        if (t > 160 && data.enemy.shots !== false && data.enemy.shooterChance > 0) {
          const roll = (t > 200 ? .36 : .22) + data.enemy.shooterChance / 2;
          const shooter = p.testSpawn(t, power, roll);
          assert.equal(shooter.type, 'shooter', stage);
          assert.equal(shooter.hp, Math.ceil(cfg.enemyTier(t, power)), stage);
          assert.equal(shooter.speed, (48 + t / 600 * 75 * .8) * data.enemy.speedScale, stage);
        }
      }
    }
  }
});

test('S1 difficulty: normal surge obeys cap 57; hard preserves original cap-95 bypass', () => {
  for (const difficulty of ['normal', 'hard']) {
    const p = createSandbox(777, difficulty); p.start('night-town');
    const cap = p.getProfile().cap;
    p.prepareCapScene(cap - 1);
    p.runFrame(1050);
    if (difficulty === 'normal') assert.equal(p.getEnemies().length, 57);
    else assert.ok(p.getEnemies().length > 95, 'hard 原包圍波不受普通生成上限限制');
  }
});

const historical = [
  { elapsed: 129.1, level: 2, kills: 4, delivered: 2, enemies: 70 },
  { elapsed: 208.95, level: 8, kills: 164, delivered: 4, enemies: 35 },
  { elapsed: 205, level: 8, kills: 196, delivered: 4, enemies: 28 }
];
for (const policy of [0, 1, 2]) {
  test(`S1 hard policy ${policy}: exact pre-change seed777 telemetry is preserved`, { timeout: 60000 }, () => {
    const result = simulate('hard', policy);
    assert.equal(result.state, 'lampout');
    assert.equal(result.oil, 0);
    for (const [key, value] of Object.entries(historical[policy])) assert.equal(result[key], value, key);
  });
  test(`S1 normal policy ${policy}: bounded 360s telemetry`, { timeout: 60000 }, () => {
    const result = simulate('normal', policy);
    if (policy > 0) {
      assert.ok(result.checkpoints[180], '一般策略應越過首 Boss 出場');
      assert.ok(result.checkpoints[180].oil >= 35, '首 Boss 出場時須有餘油可戰鬥');
      assert.ok(result.elapsed > historical[policy].elapsed, '調整後存活須超過原曲線');
      assert.ok(result.bosses.some(b => b.index === 0 && b.hp < 150), '存活後必須真的有餘力傷害首 Boss');
    }
  });
}

test('S1 normal policy 2: second-seed checkpoint and real Boss combat', { timeout: 60000 }, () => {
  const result = simulate('normal', 2, 42);
  assert.ok(result.checkpoints[180] && result.checkpoints[180].oil >= 35);
  assert.ok(result.bosses.some(b => b.index === 0 && b.hp < 150));
});
