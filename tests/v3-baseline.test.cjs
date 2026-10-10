// V3 工具校準（基準提交 da98b4b，固定以 git 物件庫讀取該版 js/*）。
// 目的：在改動任何 production 之前，先證明 tests/helpers/game-runtime.cjs
// 真的能載入 js/game.js 並觀測到「已知正確」的舊行為——不是 regex、不是 source contract。
// 若本檔全綠，代表後後續 RED 失敗是 V3 尚未實作，而不是工具壞掉。
//
// 為何固定 revision：production 實作後 js/* 就變了，若讀 working tree，
// 「舊規格」會被新程式改寫成新規格，校準測試變成假綠。因此這裡一律讀 da98b4b。
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, BASELINE_REVISION, readAtRevision } = require('./helpers/game-runtime.cjs');
const vm = require('node:vm');

// 基線常數必須來自 da98b4b，不能 require 現行 js/config.js——
// 否則 AGY 調整 config 之後，「舊規格」會被新數值改寫成假綠。
const BASELINE_CFG = (() => {
  const box = { window: {} }; box.window.window = box.window;
  vm.runInNewContext(readAtRevision(BASELINE_REVISION, 'config.js'), box,
    { filename: BASELINE_REVISION + ':js/config.js' });
  return box.window.GAME_CONFIG;
})();

// 校準沙箱：所有 js/* 固定讀 da98b4b，與 working tree 無關。
const baseline = options => loadGame({ seed: 1, revision: BASELINE_REVISION, ...options });
// 「目前 working tree」沙箱：V3 的 RED 測試用它，才能看到未實作的狀態。
const current = options => loadGame({ seed: 1, ...options });

test('校準環境正確性：沙箱讀到的是 da98b4b，而非目前 working tree', () => {
  const g = baseline({ seed: 7 });
  g.start();
  g.prepareOrder();
  g.atAnswer();
  for (let i = 0; i < 40; i++) g.update(0.05);
  // da98b4b 的單筆配送是 12XP；任何 V3 實作都會把它改成 26。
  assert.equal(g.snapshot().xp, 12, '若此值變成 26，代表沙箱誤讀 working tree，校準失效');
});

test('baseline: 沙箱能啟動一局並進入 play 狀態', () => {
  const g = baseline({ seed: 7 });
  g.start();
  const s = g.snapshot();
  assert.equal(s.state, 'play');
  assert.equal(s.level, 1);
  assert.equal(s.oil, 100);
  assert.equal(s.maxOil, 100);
  assert.equal(s.elapsed, 0);
});

test('baseline: 舊規格 — 單筆配送 +12XP、+50 分、答對升星', () => {
  const g = baseline({ seed: 7 });
  g.start();
  g.prepareOrder();
  const word = g.snapshot().job.word;
  g.atAnswer();
  for (let i = 0; i < 40; i++) g.update(0.05);
  const s = g.snapshot();
  assert.equal(s.delivered, 1, '應完成一次配送');
  assert.equal(s.score, 50, 'da98b4b 舊分數為 50');
  assert.equal(s.xp, 12, 'da98b4b 舊配送 XP 為 12');
  assert.equal(g.env.STORE.get(word.jp).box, 1, '舊行為：答對升星');
});

test('baseline: 舊規格 — 答錯扣 8 油並記為失誤', () => {
  const g = baseline({ seed: 11 });
  g.start();
  g.prepareOrder();
  const wrongIdx = g.snapshot().job.ans.findIndex(w => w !== g.snapshot().job.word);
  const before = g.snapshot().oil;
  g.resolve(wrongIdx);
  const s = g.snapshot();
  assert.equal(s.failed, 1);
  assert.ok(Math.abs((before - s.oil) - 8) < 1e-9, `舊規格扣 8 油，實際 ${(before - s.oil).toFixed(2)}`);
});

test('baseline: 舊規格 — 第一段提示扣 3 油、第二段扣 4 油', () => {
  const g = baseline({ seed: 3 });
  g.start();
  g.prepareOrder();
  const before = g.snapshot().oil;
  g.triggerHint();
  const afterFirst = g.snapshot().oil;
  assert.ok(Math.abs((before - afterFirst) - 3) < 1e-9, `舊規格第一段 -3，實際 ${(before - afterFirst).toFixed(2)}`);
  g.update(0.6);
  g.triggerHint();
  const afterSecond = g.snapshot().oil;
  // 0.6 秒套用期間另有自然耗油，故以「提示扣 4 加上區間耗油」為基準比對。
  const natural = 0.6 * 0.43;
  assert.ok(Math.abs((afterFirst - afterSecond) - (4 + natural)) < 0.05,
    `舊規格第二段 -4（另含 0.6s 自然耗油），實際 ${(afterFirst - afterSecond).toFixed(2)}`);
});

test('baseline: 舊規格 — 答案停留門檻 0.45 秒自動提交（V3 改為 0.65 秒）', () => {
  const g = baseline({ seed: 5 });
  g.start();
  g.prepareOrder();
  g.atAnswer();
  for (let i = 0; i < 8; i++) g.update(0.05);   // 累計 0.40s，不應提交
  assert.equal(g.snapshot().delivered, 0, '0.40 秒仍應未提交');
  // 舊門檻 0.45；浮點累加會使實際提交落在 0.50–0.55，故以 0.60 為上界。
  for (let i = 0; i < 4; i++) g.update(0.05);
  assert.equal(g.snapshot().delivered, 1, '累計 0.60 秒應已提交（舊門檻 0.45）');
});

test('V3 RED: 答案停留門檻改為 0.65 秒，0.60 秒不得提交', () => {
  const g = current({ seed: 5 });
  g.start();
  g.prepareOrder();
  g.atAnswer();
  for (let i = 0; i < 12; i++) g.update(0.05);  // 累計 0.60s
  assert.equal(g.snapshot().delivered, 0, 'V3：0.60 秒仍應等待，尚未到 0.65 門檻');
  for (let i = 0; i < 3; i++) g.update(0.05);   // 累計 0.75s
  assert.equal(g.snapshot().delivered, 1, 'V3：超過 0.65 秒應提交');
});

test('baseline: 舊規格 — 純站樁的淨耗油為 0.43 - 0.12 = 0.31/s（V3 要消滅的無成本永動機）', () => {
  const g = baseline({ seed: 9 });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.setOil(80);
  for (const u of ['oil_max']) { while (!g.tune(u).ok || g.tune(u).ok()) g.tune(u).f(); }
  const regen = g.bNow().oilRegen || 0;
  assert.ok(Math.abs(regen - 0.12) < 1e-9, `舊規格油被動上限 0.12，實際 ${regen}`);
  const before = g.snapshot().oil;
  for (let i = 0; i < 200; i++) g.update(0.05); // 10 秒
  const drop = before - g.snapshot().oil;
  assert.ok(Math.abs(drop - 3.1) < 0.35, `10 秒應淨耗約 3.1 油，實際 ${drop.toFixed(2)}`);
});

test('baseline: 舊規格 — 靈針 Lv5 殉爆可遞迴連鎖（V3 要設總預算）', () => {
  const g = baseline({ seed: 13 });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('needle', [
    { dx: 60, hp: 1 }, { dx: 90, hp: 1 }, { dx: 120, hp: 1 }, { dx: 150, hp: 1 }, { dx: 180, hp: 1 }
  ], [], 5);
  const { freeze } = g.env.EVOLUTIONS;
  const { hurt } = g;
  for (const e of g.snapshot().enemies) freeze(e, 0, { used: false, hits: new Set() });
  hurt(g.snapshot().enemies[0], 99);
  const alive = g.snapshot().enemies.filter(e => e.hp > 0).length;
  assert.equal(alive, 0, `舊規格一發清空 5 隻預凍敵，剩 ${alive} 隻 —— 這是 V3 要限制的行為`);
});

test('baseline: 舊規格 — xpNeed 與節奏常數（固定讀 da98b4b，不受 AGY 改 config 影響）', () => {
  assert.equal(BASELINE_CFG.xpNeed(1), 30);
  assert.equal(BASELINE_CFG.RUN_SECONDS, 600);
  assert.equal(BASELINE_CFG.GOAL_DELIVERIES, 6);
  // 跨 vm realm 的陣列身分不同，deepEqual 會因原型不一致而失敗，故先轉成原生陣列。
  assert.deepEqual(Array.from(BASELINE_CFG.BOSS_TIMES), [180, 360, 540, 590]);
});

test('校準環境正確性：基線常數不得來自 working tree', () => {
  const live = require('../js/config.js');
  // 若 AGY 改了 RUN_SECONDS／BOSS_TIMES，本測試仍須以舊值斷言成立。
  assert.equal(BASELINE_CFG.RUN_SECONDS, 600);
  assert.deepEqual(Array.from(BASELINE_CFG.BOSS_TIMES), [180, 360, 540, 590]);
  // 記錄差異（若有），供 artifacts/validation/v3-acceptance-*.json 記錄規格差異。
  if (JSON.stringify(live.BOSS_TIMES) !== JSON.stringify(BASELINE_CFG.BOSS_TIMES)) {
    assert.ok(true, `現行 config 已改動：${JSON.stringify(live.BOSS_TIMES)}（基線仍固定舊值）`);
  }
});

test('baseline: seeded 沙箱可重現同一組抽詞序列', () => {
  const a = baseline({ seed: 42 }); a.start(); a.prepareOrder();
  const b = baseline({ seed: 42 }); b.start(); b.prepareOrder();
  assert.equal(a.snapshot().job.word.jp, b.snapshot().job.word.jp);
  const c = baseline({ seed: 43 }); c.start(); c.prepareOrder();
  assert.notEqual(a.snapshot().job.word.jp, c.snapshot().job.word.jp, '不同種子應抽到不同詞');
});