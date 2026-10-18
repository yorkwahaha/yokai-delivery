// tests/agy-m1-stage1-balance.test.cjs
// M1 第一關 (night-town) P0 Runtime 驗證：
// 1. 小 Boss 血量降為 50%，最終大妖鬼降為 65%（限定第一關，其他關卡維持 100%），驗證 actual spawnBoss 數值。
// 2. 取消至少配送六件過關條件，改為天亮 (elapsed >= DAWN) 且最終 Boss 已擊敗 (finalBossDefeated) 即勝利。
// 3. 驗證零配送仍能勝利、Boss 存活或天未亮不能勝利、其他關卡維持原有交付契約。
// 4. menuButtons 在 won 狀態只回傳 world 按鈕，並禁止隱藏 restart/menu/review 被觸發；lost 狀態保留三主按鈕。
// 5. 結算 runSummary.elapsedSeconds 為本局戰鬥 elapsed 秒數快照，不被 DAWN / now 截斷，演出/暫停不累積；STORE.finish 僅呼叫一次。
// 每項測試短於 15 秒，不跑完整遊戲通關。

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function createSandbox() {
  const WINDOW = { width: 900, height: 600 };
  const storage = new Map([
    ['yokai-tutorial-v1', '"skip"'],
    ['yokai-delivery-v1', JSON.stringify({
      best: 0, bestDel: 0, m: {},
      progress: {
        unlocked: { 'night-town': true, 'rain-port': true, 'sakura-pass': true },
        completed: {},
        stages: { 'night-town': { bestScore: 0, bestDeliveries: 0, clears: 0, attempts: 0 } }
      }
    })]
  ]);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    setTransform: () => {}, fillText: () => {}, strokeText: () => {}, measureText: () => ({ width: 40 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient, createPattern: () => null,
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const canvas = {
    addEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WINDOW.width, height: WINDOW.height }),
    width: WINDOW.width, height: WINDOW.height, style: {}
  };

  let virtualClock = 1000;
  const env = {
    console, Set, Map, Math, Date, JSON, URL, URLSearchParams,
    performance: { now: () => virtualClock },
    setPerfClock: t => { virtualClock = t; },
    navigator: { userAgent: 'node' },
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)) },
    document: { hidden: false, getElementById: () => canvas, addEventListener() {}, body: { dataset: {} } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    innerWidth: WINDOW.width, innerHeight: WINDOW.height, devicePixelRatio: 1, location: { search: '' },
    screen: { width: WINDOW.width, height: WINDOW.height },
    AudioContext: function() { return { createGain: () => ({ gain: { value: 0 }, connect() {} }), createBufferSource: () => ({ connect() {}, start() {}, stop() {} }), createBuffer: () => ({}), decodeAudioData: () => Promise.resolve({}), destination: {}, currentTime: 0, sampleRate: 48000, resume() {} }; },
    Event: class { constructor(t) { this.type = t; } },
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } }
  };
  env.window = env; env.self = env;

  const sandbox = vm.createContext(env);
  const readJs = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const deps = ['words.js','world.js','store.js','config.js','viewport.js','controls.js','overworld.js','fx.js','skillfx.js','evolutions.js','boss-ai.js','story-dialogue.js','card-collection.js','card-delivery-bridge.js'];
  for (const d of deps) vm.runInContext(readJs(d), sandbox, { filename: d });
  if (sandbox.CONTROLS) sandbox.CONTROLS.mount = () => {};

  const finishCalls = env.__finishCalls = [];
  const origFinish = sandbox.STORE.finish;
  sandbox.STORE.finish = (...args) => {
    finishCalls.push(args);
    if (typeof origFinish === 'function') origFinish.apply(sandbox.STORE, args);
  };

  const END_BTNS = [
    { id: 'restart', x: 200, y: 500, w: 140, h: 44 },
    { id: 'world', x: 380, y: 500, w: 140, h: 44 },
    { id: 'menu', x: 560, y: 500, w: 140, h: 44 }
  ];

  const uiTarget = {
    END_BTNS,
    endScreenButtons: (state) => {
      const all = END_BTNS.map(b => ({ ...b }));
      if (state === "won") return all.filter(b => b.id === "world");
      return all;
    },
    reviewButtons: (misses = []) => misses.slice(0, 3).map((w, i) => ({ id: `review-${i}`, word: w, x: 300 + i * 150, y: 400, w: 140, h: 44 })),
    pressButton: () => {},
    setButtonHover: () => {},
    drawEndScreen: () => {},
    PAUSE_BTNS: [],
    MENU_BTNS: [{ id: 'start' }],
    EXIT_BTNS: [{ id: 'exit-cancel' }, { id: 'exit-confirm' }]
  };
  sandbox.UI = new Proxy(uiTarget, {
    get: (target, prop) => (prop in target ? target[prop] : () => ({}))
  });

  sandbox.AUDIO = new Proxy({}, { get: () => () => {} });
  sandbox.HAPTICS = new Proxy({}, { get: () => () => {} });
  sandbox.RENDERER = new Proxy({ getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({ x: 0, y: 0 }), getCanvas: () => canvas, updateEffects: () => false }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  const rawGame = readJs('game.js');
  const endIdx = rawGame.lastIndexOf('})();');

  const probeCode = `
    window.__agyStage1Probe = {
      start: id => start(id),
      getStageId: () => STAGE.id,
      bossBlueprint: idx => bossBlueprint(idx),
      checkVictoryCondition: () => checkVictoryCondition(),
      getFinalBossDefeated: () => finalBossDefeated,
      setFinalBossDefeated: v => { finalBossDefeated = v; },
      getElapsed: () => elapsed,
      setElapsed: v => { elapsed = v; },
      getDelivered: () => delivered,
      setDelivered: v => { delivered = v; },
      getDawn: () => DAWN,
      getGoalDeliveries: () => GOAL_DELIVERIES,
      getState: () => state,
      setState: s => { state = s; },
      runFrame: now => { window.setPerfClock?.(now); runFrame(now); },
      getEnemies: () => enemies,
      setEnemies: arr => { enemies = arr; },
      hurt: (e, dmg) => hurt(e, dmg),
      CFG_BOSS_HP_BASE: () => CFG.BOSS_HP_BASE,
      menuButtons: () => menuButtons(),
      activateMenu: id => activateMenu(id),
      getRunSummary: () => runSummary,
      getGems: () => gems,
      dropGem: (x, y, v) => dropGem(x, y, v),
      getEndCooldown: () => endCooldown,
      setEndCooldown: v => { endCooldown = v; },
      setMisses: arr => { misses = arr; },
      getFinishCalls: () => window.__finishCalls,
      startVictorySequence: () => startVictorySequence(),
      setBossT: v => { bossT = v; },
      setBossStage: v => { bossStage = v; },
      getUI: () => UI,
      setUIEndScreenButtons: fn => { UI.endScreenButtons = fn; }
    };
  `;
  vm.runInContext(rawGame.slice(0, endIdx) + probeCode + rawGame.slice(endIdx), sandbox, { filename: 'game.js' });
  return sandbox.__agyStage1Probe;
}

// ── Test 1: 第一關 Boss 血量倍率驗證（小 Boss 50%，最終大妖鬼 65%，限定第一關，且實測 spawnBoss 生成） ──
test('M1-G-S1-1 Stage 1 Boss HP scaling: minibosses 50%, final boss 65%, unchanged for other stages', () => {
  const probe = createSandbox();

  // 1. 第一關 (night-town)
  probe.start('night-town');
  assert.equal(probe.getStageId(), 'night-town');

  const baseHp = [...probe.CFG_BOSS_HP_BASE()]; // [300, 650, 120, 1400]
  assert.deepEqual(baseHp, [300, 650, 120, 1400]);

  const s1_b0 = probe.bossBlueprint(0);
  const s1_b1 = probe.bossBlueprint(1);
  const s1_b2 = probe.bossBlueprint(2);
  const s1_b3 = probe.bossBlueprint(3);

  // 小 Boss: 降為 50%
  assert.equal(s1_b0.hp, 150, `Stage 1 Boss 0 (mid) 必須降為 50% (300 -> 150), 實得: ${s1_b0.hp}`);
  assert.equal(s1_b1.hp, 325, `Stage 1 Boss 1 (mid) 必須降為 50% (650 -> 325), 實得: ${s1_b1.hp}`);
  assert.equal(s1_b2.hp, 60, `Stage 1 Boss 2 (gate) 必須降為 50% (120 -> 60), 實得: ${s1_b2.hp}`);

  // 最終大妖鬼: 降為 65%
  assert.equal(s1_b3.hp, 910, `Stage 1 Boss 3 (final) 必須降為 65% (1400 -> 910), 實得: ${s1_b3.hp}`);

  // 驗證實際 spawnBoss 生成實體的 HP (Item 1 介面實測)
  probe.setBossT(0);
  probe.setBossStage(0);
  probe.runFrame(1050);
  const spawnedBoss = probe.getEnemies().find(e => e.type === "boss");
  assert.ok(spawnedBoss, '實際幀循環中必須生成 boss');
  assert.equal(spawnedBoss.hp, 150, `night-town 實際生成 boss hp 必須為 150, 實得: ${spawnedBoss.hp}`);
  assert.equal(spawnedBoss.max, 150, `night-town 實際生成 boss max 必須為 150, 實得: ${spawnedBoss.max}`);

  // 2. 第二關 (rain-port)：其他關卡維持原有 100%
  probe.start('rain-port');
  assert.equal(probe.getStageId(), 'rain-port');

  const s2_b0 = probe.bossBlueprint(0);
  const s2_b1 = probe.bossBlueprint(1);
  const s2_b2 = probe.bossBlueprint(2);
  const s2_b3 = probe.bossBlueprint(3);

  assert.equal(s2_b0.hp, 300, `Stage 2 Boss 0 必須維持 300, 實得: ${s2_b0.hp}`);
  assert.equal(s2_b1.hp, 650, `Stage 2 Boss 1 必須維持 650, 實得: ${s2_b1.hp}`);
  assert.equal(s2_b2.hp, 120, `Stage 2 Boss 2 必須維持 120, 實得: ${s2_b2.hp}`);
  assert.equal(s2_b3.hp, 1400, `Stage 2 Boss 3 必須維持 1400, 實得: ${s2_b3.hp}`);

  // 驗證第二關實際生成 Boss
  probe.setBossT(0);
  probe.setBossStage(0);
  probe.runFrame(1100);
  const s2Spawned = probe.getEnemies().find(e => e.type === "boss");
  assert.ok(s2Spawned, '第二關必須生成 boss');
  assert.equal(s2Spawned.hp, 300, `rain-port 實際生成 boss hp 必須維持 300, 實得: ${s2Spawned.hp}`);
  assert.equal(s2Spawned.max, 300, `rain-port 實際生成 boss max 必須維持 300, 實得: ${s2Spawned.max}`);
});

// ── Test 2: 第一關勝利條件：零配送 (delivered = 0) 在天亮且最終 Boss 已擊敗時仍能勝利 ──
test('M1-G-S1-2 Stage 1 Victory Rule: Zero deliveries still achieves victory when dawn arrives and final boss is defeated', () => {
  const probe = createSandbox();
  probe.start('night-town');

  // 設定：0 配送、最終 Boss 已擊敗、天亮已至
  probe.setDelivered(0);
  probe.setFinalBossDefeated(true);
  probe.setElapsed(probe.getDawn());

  // 驗證勝利判斷函數
  assert.equal(probe.checkVictoryCondition(), true, '第一關在天亮且最終 Boss 已擊敗時，即使 0 配送也必須判定勝利條件達成');

  // 推進一幀更新遊戲狀態
  probe.runFrame(1050);

  // 斷言：進入勝利演出序列
  assert.equal(probe.getState(), 'victory', `遊戲狀態必須進入 victory, 實得: ${probe.getState()}`);
});

// ── Test 3: 第一關反例 1：最終 Boss 存活時，即使天亮且完成六件配送也不能勝利 ──
test('M1-G-S1-3 Stage 1 Negative Rule 1: Boss alive cannot trigger victory, even if dawn arrived and deliveries completed', () => {
  const probe = createSandbox();
  probe.start('night-town');

  // 設定：完成 6 件配送、天亮已過 (DAWN + 20 秒)、但最終 Boss 仍存活
  probe.setDelivered(6);
  probe.setFinalBossDefeated(false);
  probe.setElapsed(probe.getDawn() + 20);

  // 驗證勝利判斷函數
  assert.equal(probe.checkVictoryCondition(), false, '最終 Boss 存活時不可判定勝利');

  // 推進一幀更新遊戲狀態
  probe.runFrame(1050);

  // 斷言：遊戲狀態依然保持 play，絕不可觸發勝利
  assert.equal(probe.getState(), 'play', `Boss 存活時遊戲狀態必須保持 play, 實得: ${probe.getState()}`);
});

// ── Test 4: 第一關反例 2：天未亮 (elapsed < DAWN) 時不能勝利，天亮後立即勝利 ──
test('M1-G-S1-4 Stage 1 Negative Rule 2: Cannot win if dawn not arrived, then wins immediately upon reaching dawn', () => {
  const probe = createSandbox();
  probe.start('night-town');

  const dawn = probe.getDawn(); // 600 秒

  // 階段 A：550 秒擊敗最終 Boss，天未亮 (550 < 600)
  probe.setDelivered(0);
  probe.setFinalBossDefeated(true);
  probe.setElapsed(550);

  assert.equal(probe.checkVictoryCondition(), false, '天未亮時 (550s < 600s) 不可判定勝利');
  probe.runFrame(1050);
  assert.equal(probe.getState(), 'play', '天未亮時狀態必須保持 play');

  // 階段 B：時鐘推進至破曉 (600 秒)
  probe.setElapsed(dawn);
  assert.equal(probe.checkVictoryCondition(), true, '時鐘抵達 DAWN (600s) 時立即判定勝利');
  probe.runFrame(1100);
  assert.equal(probe.getState(), 'victory', '抵達破曉時立即進入 victory 狀態');
});

// ── Test 5: 其他關卡邊界隔離：非第一關 (如 rain-port) 仍嚴格要求 delivered >= GOAL_DELIVERIES ──
test('M1-G-S1-5 Stage Boundary Isolation: Other stages (rain-port) still strictly require deliveries', () => {
  const probe = createSandbox();
  probe.start('rain-port');

  probe.setFinalBossDefeated(true);
  probe.setElapsed(probe.getDawn() + 10);

  // 0 配送在第二關：不能勝利
  probe.setDelivered(0);
  assert.equal(probe.checkVictoryCondition(), false, '第二關 0 配送即使天亮且擊敗 Boss 也不能勝利');
  probe.runFrame(1050);
  assert.equal(probe.getState(), 'play', '第二關 0 配送不能觸發勝利');

  // 5 配送在第二關 (< 6)：仍不能勝利
  probe.setDelivered(5);
  assert.equal(probe.checkVictoryCondition(), false, '第二關 5 配送 (< 6) 不能勝利');

  // 6 配送在第二關 (>= GOAL_DELIVERIES)：勝利
  probe.setDelivered(6);
  assert.equal(probe.checkVictoryCondition(), true, '第二關滿 6 配送且擊敗 Boss 判定勝利');
  probe.runFrame(1100);
  assert.equal(probe.getState(), 'victory', '第二關滿配送後進入 victory 狀態');
});

// ── Test 6: Item 4 結算按鈕與輸入隔離驗證（won 僅 world 按鈕，禁隱藏 restart/menu；lost 保三主鈕） ──
test('M1-G-S1-6 Item 4 End Screen Menu Buttons: won state returns ONLY world button, blocks hidden triggers; lost keeps 3 buttons', () => {
  const probe = createSandbox();
  probe.start('night-town');

  // 1. won 狀態檢驗
  probe.setState('won');
  probe.setEndCooldown(0);

  const wonBtns = probe.menuButtons();
  assert.ok(Array.isArray(wonBtns), 'menuButtons() 必須回傳陣列');
  assert.equal(wonBtns.length, 1, `won 狀態下 menuButtons 必須僅有 1 個按鈕，實得: ${wonBtns.length}`);
  assert.equal(wonBtns[0].id, 'world', `won 狀態下唯一按鈕必須是 world, 實得: ${wonBtns[0].id}`);

  // 測試在 won 狀態下嘗試呼叫隱藏按鈕 (restart / menu / review) 必須被拒絕，不改變狀態
  probe.activateMenu('restart');
  assert.equal(probe.getState(), 'won', 'won 狀態下呼叫 activateMenu("restart") 必須被忽略，不可重開');

  probe.activateMenu('menu');
  assert.equal(probe.getState(), 'won', 'won 狀態下呼叫 activateMenu("menu") 必須被忽略，不可回到主選單');

  probe.activateMenu('review-0');
  assert.equal(probe.getState(), 'won', 'won 狀態下呼叫 activateMenu("review-0") 必須被忽略');

  // 測試呼叫可見按鈕 world: 必須切換至 overworld
  probe.activateMenu('world');
  assert.equal(probe.getState(), 'overworld', 'won 狀態下呼叫 activateMenu("world") 必須進入 overworld');

  // 2. lost 狀態檢驗
  probe.setState('lost');
  probe.setEndCooldown(0);
  probe.setMisses([{ jp: 'ねこ' }, { jp: 'いぬ' }]);

  const lostBtns = probe.menuButtons();
  assert.ok(Array.isArray(lostBtns), 'lost 狀態下 menuButtons 必須回傳陣列');
  const mainLostIds = lostBtns.map(b => b.id);
  assert.ok(mainLostIds.includes('restart'), 'lost 狀態必須包含 restart');
  assert.ok(mainLostIds.includes('world'), 'lost 狀態必須包含 world');
  assert.ok(mainLostIds.includes('menu'), 'lost 狀態必須包含 menu');
  assert.ok(mainLostIds.includes('review-0'), 'lost 狀態有錯題時必須包含 review-0');

  // lost 狀態下 restart 應可正常啟動遊戲重開
  probe.activateMenu('restart');
  assert.equal(probe.getState(), 'play', 'lost 狀態下 activateMenu("restart") 必須可重新開始遊戲');

  // 3. 測試 UI.endScreenButtons 為 undefined 時的 fallback 行為
  probe.setState('won');
  probe.setEndCooldown(0);
  probe.setUIEndScreenButtons(undefined);

  const fallbackWonBtns = probe.menuButtons();
  assert.ok(Array.isArray(fallbackWonBtns));
  assert.equal(fallbackWonBtns.length, 1, '即使 UI.endScreenButtons 缺失，fallback 亦必須僅提供 world 按鈕');
  assert.equal(fallbackWonBtns[0].id, 'world');
});

// ── Test 7: Item 5 結算 elapsedSeconds 直接快照、各狀態計時隔離（play 前進、pause/levelup/victory 凍結）與 STORE.finish 單次呼叫 ──
test('M1-G-S1-7 Item 5 Run Summary elapsedSeconds direct snapshot, timing isolation, and STORE.finish single invocation', () => {
  const probe = createSandbox();
  probe.start('night-town');

  // 1. 測試 play 狀態下 elapsed 隨幀時間 (dt) 前進
  probe.setElapsed(100.0);
  let now = 1000;
  now += 50;
  probe.runFrame(now);
  const playElapsed = probe.getElapsed();
  assert.ok(playElapsed > 100.0, 'play 狀態下 elapsed 必須前進');

  // 2. 測試 pause 狀態下 elapsed 凍結不增加
  probe.setState('pause');
  const pauseStart = probe.getElapsed();
  now += 50;
  probe.runFrame(now);
  assert.equal(probe.getElapsed(), pauseStart, 'pause 狀態下 elapsed 絕不增加');

  // 3. 測試 levelup 狀態下 elapsed 凍結不增加
  probe.setState('levelup');
  const levelupStart = probe.getElapsed();
  now += 50;
  probe.runFrame(now);
  assert.equal(probe.getElapsed(), levelupStart, 'levelup 狀態下 elapsed 絕不增加');

  // 4. 設定戰鬥時間為 625.404 秒（超逾 DAWN = 600s，含小數微秒）
  probe.setState('play');
  probe.setElapsed(625.404);
  probe.setFinalBossDefeated(true);

  // 觸發勝利序列
  probe.startVictorySequence();
  assert.equal(probe.getState(), 'victory');
  const victoryStartElapsed = probe.getElapsed();

  // 5. 模擬勝利序列推進至結算（VICTORY.settle = 5.0 秒，推進 115 幀 = 5.75s）
  for (let step = 0; step < 115; step++) {
    now += 50;
    probe.runFrame(now);
  }

  // 斷言：進入 won 狀態，且 victory 演出期間 elapsed 絕不增加
  assert.equal(probe.getState(), 'won', `5.75 秒後狀態必須進入 won, 實得: ${probe.getState()}`);
  assert.equal(probe.getElapsed(), victoryStartElapsed, 'victory 演出期間戰鬥 elapsed 絕不增加');

  const summary = probe.getRunSummary();
  assert.ok(summary, '結算 runSummary 必須已生成');
  assert.equal(summary.elapsedSeconds, 625.404, `runSummary.elapsedSeconds 必須直接保存 raw elapsed 625.404 快照（不經 toFixed 提早跨秒），實得: ${summary.elapsedSeconds}`);

  // 驗證 STORE.finish 僅被呼叫一次，且第四個參數 (won) 為 true
  const finishCalls = probe.getFinishCalls();
  assert.equal(finishCalls.length, 1, `STORE.finish 必須僅被呼叫 1 次, 實得: ${finishCalls.length}`);
  assert.equal(finishCalls[0][0], 'night-town');
  assert.equal(finishCalls[0][3], true, 'STORE.finish 的 won 參數必須為 true');

  // 再推進 3 幀，確認 STORE.finish 不會重複觸發且 elapsedSeconds 保持相同快照
  for (let i = 0; i < 3; i++) {
    now += 50;
    probe.runFrame(now);
  }
  assert.equal(probe.getFinishCalls().length, 1, 'STORE.finish 在後續幀不可重複觸發');
  assert.equal(probe.getRunSummary().elapsedSeconds, 625.404, 'runSummary.elapsedSeconds 在後續幀保持完全一致快照');
});

// ── Test 8: Item 2 勝利演出清除靈玉防止 XP 競態升級 ──
test('M1-G-S1-8 Item 2 Victory Sequence clears gems to prevent race with levelup', () => {
  const probe = createSandbox();
  probe.start('night-town');

  // 在地圖上放置 5 顆靈玉
  for (let i = 0; i < 5; i++) {
    probe.dropGem(100 + i * 20, 100, 25);
  }
  assert.equal(probe.getGems().length, 5, '放置後靈玉數量必須為 5');

  // 觸發勝利序列
  probe.startVictorySequence();
  assert.equal(probe.getState(), 'victory');

  // 靈玉陣列必須被清空
  assert.equal(probe.getGems().length, 0, '進入勝利序列時 gems 陣列必須被清空');

  // 推進一幀，確保不會因撿拾靈玉觸發 levelup
  probe.runFrame(1050);
  assert.equal(probe.getState(), 'victory', '勝利序列期間絕不可被 levelup 覆蓋');
});

// ── Test 9: P0 破曉時鐘契約：終王於 540–599s 先死仍保持 play，XP 升級不搶勝，至 600s 準時 victory（0 配送） ──
test('M1-G-S1-9 P0 Dawn Timing Contract: Final boss defeated at 560s stays in play, XP/levelup does not preempt victory, reaches 600s to enter victory (0 deliveries)', () => {
  const probe = createSandbox();
  probe.start('night-town');

  // 1. 0 配送
  assert.equal(probe.getDelivered(), 0);

  // 2. 推進時鐘至 560s（落於 540–599s 終王戰鬥時段）
  probe.setElapsed(560.0);
  probe.setFinalBossDefeated(true);

  // 斷言：天未亮 (560 < 600)，即使終王已擊敗且 0 配送，仍不可判定勝利
  assert.equal(probe.checkVictoryCondition(), false, '560s (天未亮) 擊殺終王不可判定勝利');

  // 推進一幀 (560.05s)
  probe.runFrame(1050);
  assert.equal(probe.getState(), 'play', '天未亮時狀態必須維持 play，不可提前勝出');

  // 模擬推進至 580s
  probe.setElapsed(580.0);
  probe.runFrame(1100);
  assert.equal(probe.checkVictoryCondition(), false, '580s 仍不可判定勝利');
  assert.equal(probe.getState(), 'play', '580s 仍保持 play');

  // 3. 時鐘到達破曉 600s (DAWN)
  probe.setElapsed(600.0);
  assert.equal(probe.checkVictoryCondition(), true, '抵達破曉 600s (DAWN) 勝利條件達成');

  // 推進一幀更新
  probe.runFrame(1150);
  assert.equal(probe.getState(), 'victory', '600s 時正式切換至 victory 演出狀態');
  assert.equal(probe.getDelivered(), 0, '全程 0 配送確認');
});
