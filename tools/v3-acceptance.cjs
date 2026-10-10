#!/usr/bin/env node
// V3 驗收 runner（Hermes 責任範圍）。
//
// 兩類量測，界線必須清楚：
//   A. geometry/probe —— 受控情境下的幾何與節奏量測（木樁 DPS、技能上限、站樁油曲線）。
//      這不是自然遊玩，但足以驗收「數值是否落在 V3 規格內」。
//   B. route/run —— 真步進的完整送單循環：BFS 路徑、遊戲自身互動判定、真正的
//      interact() 取貨、實際答題 dwell 提交、實際 pickUp() 升級。仍屬模擬：
//      沒有真人注意力、反應時間與學習動機，也沒有隔日記憶。
//
// 門檻由 tests/*.test.cjs 斷言；本檔只負責產生可稽核的 JSON。
//
// 用法：node tools/v3-acceptance.cjs [--seed 11] [--out artifacts/validation/v3-acceptance.json]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadGame, BASELINE_REVISION } = require('../tests/helpers/game-runtime.cjs');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SEED = Number(argOf('seed', '11'));
const OUT = path.join(ROOT, argOf('out', 'artifacts/validation/v3-acceptance.json'));

const LIMITS = [
  '本檔為模擬驗收，不是自然實機：不含真人注意力、反應時間與學習動機',
  '隔日記憶成效未驗收；本局 box/次數統計不等於長期熟練',
  'B 類已用真步進與遊戲自身的互動判定，但仍不是玩家操作',
  'Boss 數字為已破盾靜態木樁，不含讀題、護盾、招式迴避與走位成本',
  '時間門檻（Boss 秒數、覺醒時點）為 V3 待驗目標，未達標不得宣稱平衡'
];

const boot = (seed = SEED, revision = null) => {
  const g = loadGame({ seed, revision });
  g.start();
  return g;
};

// ---------------------------------------------------------------- A. geometry

/** 站樁油曲線：停生成、清場、原地不動，量淨耗油／淨回油。 */
function measureStandstill(seed, seconds = 180, weaponRank = 5) {
  const g = boot(seed);
  g.stopSpawns();
  g.clearEnemies();
  if (weaponRank) { g.setWeaponRank('barrier', weaponRank); g.armWeapons(); }
  g.setOil(80);
  const startOil = g.snapshot().oil;
  const samples = [];
  for (let t = 0; t < seconds; t += 15) {
    for (let i = 0; i < 300; i++) g.update(0.05);
    samples.push({ t: t + 15, oil: +g.snapshot().oil.toFixed(2) });
  }
  const endOil = g.snapshot().oil;
  return {
    kind: 'geometry', seed, weaponRank, seconds,
    startOil, endOil: +endOil.toFixed(2), delta: +(endOil - startOil).toFixed(2),
    netPerSecond: +((endOil - startOil) / seconds).toFixed(4),
    samples,
    note: '站樁 + 靈陣 Lv5 + 兩層油被動；停生成不代表玩家能同時清怪'
  };
}

/** 單技四情境清場量測（Lv4 vs MAX），無被動卡、B 固定。 */
function measureSkill(seed, weapon, rank, damageCoefficient = 1.2) {
  const scenarios = {
    single: [{ dx: 150, dy: 0, hp: 60, type: 'ghost' }],
    crowd: Array.from({ length: 8 }, (_, i) => ({ dx: 110 + (i % 4) * 55, dy: Math.floor(i / 4) * 65, hp: 40, type: 'ghost' })),
    corridor: [{ dx: 150, dy: 0, hp: 40, type: 'ghost' }, { dx: 205, dy: 0, hp: 40, type: 'ghost' }, { dx: 260, dy: 0, hp: 40, type: 'ghost' }],
    behindWall: [{ dx: 175, dy: 0, hp: 40, type: 'ghost' }, { dx: 230, dy: 0, hp: 40, type: 'ghost' }]
  };
  const out = {};
  for (const [name, foes] of Object.entries(scenarios)) {
    const g = boot(seed);
    g.stopSpawns();
    g.clearEnemies();
    g.setDamageCoefficient(damageCoefficient);
    const walls = name === 'behindWall' ? [{ x0: 55, x1: 105, y0: -260, y1: 260 }] : [];
    g.combatScene(weapon, foes, walls, rank);
    const before = g.snapshot().enemies.map(e => e.hp);
    const oilStart = g.snapshot().oil;
    let t = 0;
    while (t < 20 && g.snapshot().enemies.some(e => e.hp > 0)) { g.update(1 / 60); t += 1 / 60; }
    const after = g.snapshot().enemies.map(e => e.hp);
    out[name] = {
      rank, seconds: +t.toFixed(2),
      cleared: after.every(hp => hp <= 0),
      damageDealt: before.reduce((s, hp, i) => s + Math.max(0, hp - after[i]), 0),
      oilDelta: +(g.snapshot().oil - oilStart).toFixed(2),
      timeout: t >= 20
    };
  }
  return out;
}

/** 終王擊殺時間：固定 HP、已破盾、站定不動，純量 DPS。 */
function measureBossKill(seed, label, opts) {
  const hp = (opts && opts.hp) || 1400;
  const damageCoefficient = opts && opts.damageCoefficient != null ? opts.damageCoefficient : 1.2;
  const weapons = opts && opts.weapons;
  const maxOut = !opts || opts.maxOut !== false;
  const g = boot(seed);
  g.stopSpawns();
  g.clearEnemies();
  if (weapons) for (const entry of Object.entries(weapons)) g.setWeaponRank(entry[0], entry[1]);
  else if (maxOut) g.maxOutUpgrades();
  g.setDamageCoefficient(damageCoefficient);
  g.armWeapons();
  g.placeBoss(hp);
  const levels = g.weaponLevels();
  let frames = 0;
  // 每幀固定 1/60 秒，因此 t 本身就是「遊戲秒」，不可再除以 60。
  while (frames < 180 * 60 && g.snapshot().enemies.some(e => e.type === 'boss' && e.hp > 0)) { g.update(1 / 60); frames++; }
  const t = frames / 60;
  return {
    kind: 'geometry', seed, label, hp, damageCoefficient, weapons: levels,
    frames, seconds: +t.toFixed(2),
    killed: !g.snapshot().enemies.some(e => e.type === 'boss' && e.hp > 0),
    timeout: frames >= 180 * 60,
    dps: +((hp / t) || 0).toFixed(1),
    note: '已破盾靜態木樁、站定無移動；不含讀題、護盾、招式迴避與走位成本。秒數為遊戲時間。'
  };
}

// ---------------------------------------------------------------- B. real run

/** 真步進的一次完整送單循環。 */
function runOneRun(seed, targetDeliveries, opts) {
  const spawns = !opts || opts.spawns !== false;
  const g = boot(seed);
  if (!spawns) { g.stopSpawns(); g.clearEnemies(); }
  const perDelivery = [];
  const picks = { passive: 0, weapon: 0, awaken: 0 };
  let levelUpsHandled = 0;

  for (let i = 0; i < targetDeliveries; i++) {
    let guard = 0;
    while (guard < 1200 && !g.ordersNow().length) { g.update(0.1); guard++; }
    const orders = g.ordersNow();
    if (!orders.length) { perDelivery.push({ index: i, ok: false, reason: 'no-order-generated' }); break; }
    const order = orders[0];

    g.clearInteract();
    const toPickup = g.walkToInteract(order.from);
    if (!toPickup.reached) { perDelivery.push({ index: i, ok: false, reason: 'pickup-unreachable', walk: toPickup }); break; }
    const picked = g.realPickup();
    if (!picked) { perDelivery.push({ index: i, ok: false, reason: 'interact-failed', walk: toPickup }); break; }
    const job = g.snapshot().job;

    // 收件端不需要「互動」——送到屋邊即可答題。walkToInteract 的互動距離
    // （玩家中心到 clamp 外框 < 46px）比答題區（< 220px 觸發結界、< 270px 可選）
    // 嚴格得多，所以對收件屋改用 walkNear 放寬到可答題範圍。
    const spot = g.nearestHouseFreeSpot(job.to);
    if (!spot) { perDelivery.push({ index: i, ok: false, reason: 'no-free-spot-around-house' }); break; }
    const toDrop = g.walkNear(job.to.x, job.to.y + 110, 190, 60, 1 / 60, 40);
    if (!toDrop.reached) { perDelivery.push({ index: i, ok: false, reason: 'drop-unreachable', walk: toDrop }); break; }
    g.atDestination();
    g.update(1 / 60);
    if (!g.snapshot().job) { perDelivery.push({ index: i, ok: false, reason: 'job-vanished-at-destination' }); break; }
    g.atAnswer();
    let waited = 0;
    while (g.snapshot().job && waited < 4) { g.update(1 / 60); waited += 1 / 60; }

    const s = g.snapshot();
    perDelivery.push({
      index: i, ok: !g.snapshot().job,
      pickupSeconds: toPickup.seconds, dropSeconds: toDrop.seconds,
      totalWalkSeconds: +(toPickup.seconds + toDrop.seconds).toFixed(2),
      dwellWaited: +waited.toFixed(2),
      delivered: s.delivered, xp: s.xp, level: s.level, oil: +s.oil.toFixed(1),
      seals: g.v3().sealCount === undefined ? null : g.v3().sealCount,
      xpSources: g.xpSources()
    });

    let guard2 = 0;
    while (g.snapshot().state === 'levelup' && guard2 < 12) {
      const choices = g.currentChoices() || [];
      if (!choices.length) break;
      const res = g.takeLevelUpChoice(0);
      if (!res.ok) break;
      levelUpsHandled++;
      if (res.type === 'passive') picks.passive++;
      else { picks.weapon++; if (res.lv === 5) picks.awaken++; }
    }
  }

  const s = g.snapshot();
  return {
    kind: 'run', seed, targetDeliveries, spawns,
    delivered: s.delivered, level: s.level, xp: s.xp,
    oil: +s.oil.toFixed(1), elapsed: +s.elapsed.toFixed(1), state: s.state,
    seals: g.v3().sealCount === undefined ? null : g.v3().sealCount,
    levelUpsHandled, picks,
    weapons: g.weaponLevels(), barrier: g.bar(),
    perDelivery
  };
}

// ---------------------------------------------------------------- main

function main() {
  const report = {
    generatedBy: 'tools/v3-acceptance.cjs',
    node: process.version,
    baselineRevision: BASELINE_REVISION,
    seeds: [SEED, SEED + 1, SEED + 2],
    v3Spec: { deliveryXp: 26, sealsPerDeliveries: 3, sealMax: 4, bossHpTable: 'pending' },
    limits: LIMITS,
    notMeasured: ['完整自然通關', '隔日獨立回想', '實機效能與掉幀', '真人學習動機'],
    standstill: [], skillScenarios: {}, bossKill: [], runs: []
  };

  for (const seed of [SEED, SEED + 1, SEED + 2]) {
    report.standstill.push(measureStandstill(seed, 180, 5));
    report.standstill.push(measureStandstill(seed, 180, 0));
  }
  for (const weapon of ['katana', 'barrier', 'needle', 'boom', 'thunder', 'fire']) {
    report.skillScenarios[weapon + '-Lv4'] = measureSkill(SEED, weapon, 4);
    report.skillScenarios[weapon + '-MAX'] = measureSkill(SEED, weapon, 5);
  }

  // 2MAX = 刀 + 針（Codex 獨立木樁校準基準：seed11 = 84 秒）。
  const twoMax = { katana: 5, needle: 5 };
  const threeMax = { katana: 5, needle: 5, fire: 5 };
  const fourMax = { katana: 5, needle: 5, fire: 5, boom: 5 };
  report.bossKill.push(measureBossKill(SEED, '2MAX-katana+needle/B1.2', { hp: 1400, damageCoefficient: 1.2, weapons: twoMax }));
  report.bossKill.push(measureBossKill(SEED, '3MAX-katana+needle+fire/B1.8', { hp: 1400, damageCoefficient: 1.8, weapons: threeMax }));
  report.bossKill.push(measureBossKill(SEED, '4MAX-katana+needle+fire+boom/B2.4', { hp: 1400, damageCoefficient: 2.4, weapons: fourMax }));
  report.bossKill.push(measureBossKill(SEED, 'fullMaxOut/B2.4', { hp: 1400, damageCoefficient: 2.4, maxOut: true }));

  for (const seed of [SEED, SEED + 1]) {
    for (const target of [6, 9, 12]) {
      report.runs.push(runOneRun(seed, target, { spawns: true }));
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    out: path.relative(ROOT, OUT),
    standstillNetPerSecond: report.standstill.map(s => s.netPerSecond),
    bossSeconds: report.bossKill.map(b => b.label + '=' + b.seconds + (b.killed ? '' : '(timeout)')),
    runs: report.runs.map(r => 'seed' + r.seed + '/' + r.targetDeliveries + ': delivered=' + r.delivered + ' lv=' + r.level + ' ' + r.state)
  }, null, 2));
}

main();
