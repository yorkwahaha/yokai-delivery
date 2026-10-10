#!/usr/bin/env node
// V3 驗收 runner（Hermes 初稿，Codex 最終整合）。
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
const crypto=require('node:crypto');
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
  g.tune('oil_max').f(); g.tune('oil_max').f();
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
    note: '無敵人受控耗油；兩層油被動、靈陣等級見 weaponRank；非正常戰鬥'
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
    const targets=g.snapshot().enemies.slice();
    const before=targets.map(e=>e.hp);
    let t = 0;
    while(t<20 && targets.some(e=>e.hp>0)){g.setElapsed(t);g.weapons(1/60);t+=1/60;}
    const after=targets.map(e=>e.hp);
    out[name] = {
      rank, seconds: +t.toFixed(2),
      cleared: after.every(hp => hp <= 0),
      damageDealt: before.reduce((s, hp, i) => s + Math.max(0, hp - after[i]), 0),
      note:'Weapon-only stationary targets; no AI, incoming damage, oil or natural progression.',
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

/**
 * B 段：真正 600 秒自然運行。
 *
 * 嚴格禁止（在真實運行分支）：
 *   - atDestination() / atAnswer()（瞬移）
 *   - setXp / giveXP / setWeaponRank / maxOutUpgrades
 *   - 無敵（不動 b.shield 與油量）
 *   - setState 強改狀態跳過選卡
 * 自然分支使用道路規劃、pushKeys / tapKey 正常移動、update 步進、answerBoss 選答案、
 * takeLevelUpChoice（走遊戲自身流程）與 realPickup（走 interact）。
 */

const {runNaturalRun}=require('./v3-natural-run.cjs');
function compareDeliveryVsStandstill(seed,seconds){return {seed,horizon:seconds,delivery:runNaturalRun(seed,{seconds}),standstill:runNaturalRun(seed,{seconds,mode:'standstill'})};}

// ---------------------------------------------------------------- main

function main() {
  const report = {
    generatedBy: 'tools/v3-acceptance.cjs',
    node: process.version,
    baselineRevision: BASELINE_REVISION,
    seeds: [SEED, SEED + 1, SEED + 12],
    sources:Object.fromEntries(['game','config','evolutions','boss-ai','store'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'js',n+'.js'))).digest('hex')])),
    controllerHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/v3-natural-run.cjs'))).digest('hex'),
    v3Spec: { deliveryXp: 26, sealsPerDeliveries: 3, sealMax: 4, bossHpTable: [300,650,120,1400] },
    limits: LIMITS,
    notMeasured: ['完整自然通關', '隔日獨立回想', '實機效能與掉幀', '真人學習動機'],
    standstill: [], skillScenarios: {}, bossKill: [], runs: []
  };

  for (const seed of [SEED, SEED + 1, SEED + 12]) {
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

  // B 段：真正 600 秒自然運行（真步進、遊戲自身選卡流程、有 spawns）。
  for (const seed of [SEED, SEED + 1, SEED + 12]) {
    report.runs.push(runNaturalRun(seed, { wallBudgetMs: 150000 }));
  }
  report.deliveryVsStandstill={seed:SEED,horizon:600,delivery:report.runs[0],standstill:runNaturalRun(SEED,{seconds:600,mode:'standstill'})};

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    out: path.relative(ROOT, OUT),
    standstillNetPerSecond: report.standstill.map(s => s.netPerSecond),
    bossSeconds: report.bossKill.map(b => b.label + '=' + b.seconds + (b.killed ? '' : '(timeout)')),
    runs: report.runs.map(r => [
      'seed' + r.seed,
      'stop=' + r.stopReason,
      'gameElapsed=' + r.gameElapsed,
      'wallMs=' + r.wallMs,
      'delivered=' + r.delivered,
      'lv=' + r.level,
      'seals=' + r.seals,
      'fourSealAt=' + r.fourSealAt,
      'walk=' + r.movementSeconds,
      'passive=' + r.picks.passive,
      'weapon=' + r.picks.weapon,
      'awaken=' + r.picks.awaken,
      'enemyXp=' + r.xpLedger.fromEnemies,
      'maxed=' + (r.maxed.length ? r.maxed.join('+') : 'none'),
      'state=' + r.state
    ].join(' ')),
    deliveryVsStandstill: report.deliveryVsStandstill && {
      seed: report.deliveryVsStandstill.seed,
      delivered: report.deliveryVsStandstill.delivery.delivered,
      seals: report.deliveryVsStandstill.delivery.seals,
      enemyXp: report.deliveryVsStandstill.delivery.xpLedger.fromEnemies,
      passive: report.deliveryVsStandstill.delivery.picks.passive,
      standstillStop:report.deliveryVsStandstill.standstill.stopReason,
      standstillElapsed:report.deliveryVsStandstill.standstill.gameElapsed
    }
  }, null, 2));
}

if(require.main===module)main();
module.exports={runNaturalRun,compareDeliveryVsStandstill};
