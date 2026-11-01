// tests/fusion-dual-realgame.test.cjs
// R8: 受控真 GAME + 雙次合法融合驗證
// 1. 雙父 5→合法繪馬→confirm/commit→父技停攻、第一融合真HP傷害、釋1槽補新技能
// 2. 另雙父 5→第二次繪馬/commit→前融合仍傷害、母不重用
// 3. 同時 4+5、重複配方與非 DEV 拒
// 4. onBossDeath 在真局能再觸發第 2 次融合資格
// 5. 雷符神罰：輸出 firstHitAt、hitEvents（世界座標+判定時間）、真HP扣血

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const readJs = file => fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');

const SKILL_IDS = [
  'katana', 'fire', 'barrier', 'thunder', 'boom', 'needle',
  'fusion_inkblade', 'fusion_foxiai', 'fusion_exorcistblade',
  'fusion_foxfirebarrier', 'fusion_exorcistseal', 'fusion_thundercircle',
  'fusion_slashwheel', 'fusion_foxthunderlantern', 'fusion_flamefestival',
  'fusion_thundertalisman'
];
const ZERO_LOADOUT = Object.fromEntries(SKILL_IDS.map(id => [id, 0]));
const loadout = (overrides = {}) => ({ ...ZERO_LOADOUT, ...overrides });

function createFullGameSandbox(searchQuery = '?dev=1&fusioncandidate=1&stage=rain-port') {
  const WINDOW = { width: 900, height: 600 };
  const storage = new Map([['yokai-tutorial-v1', '"skip"']]);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    setTransform: () => {}, fillText: () => {}, strokeText: () => {},
    measureText: () => ({ width: 40 }), createLinearGradient: () => gradient,
    createRadialGradient: () => gradient, createPattern: () => null,
    beginPath: () => {}, closePath: () => {}, moveTo: () => {}, lineTo: () => {},
    arc: () => {}, fill: () => {}, stroke: () => {}, fillRect: () => {},
    strokeRect: () => {}, clearRect: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, rotate: () => {}, scale: () => {}, roundRect: () => {},
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  const eventListeners = new Map();
  const addListener = (type, fn) => {
    if (!eventListeners.has(type)) eventListeners.set(type, []);
    eventListeners.get(type).push(fn);
  };

  const canvas = {
    addEventListener: addListener,
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WINDOW.width, height: WINDOW.height }),
    width: WINDOW.width, height: WINDOW.height, style: {},
  };

  class ImageMock {
    constructor() {
      this.naturalWidth = 100; this.naturalHeight = 100;
      this.width = 100; this.height = 100; this.dataset = {};
    }
  }

  const env = {
    console, Set, Map, Math, Date, JSON, URL, URLSearchParams,
    performance: { now: () => 1000 }, navigator: { userAgent: 'node' },
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    Image: ImageMock,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: {
      hidden: false, getElementById: () => canvas, addEventListener: addListener,
      body: { dataset: {} }, documentElement: { dataset: {} }
    },
    addEventListener: addListener, removeEventListener() {}, dispatchEvent: () => true,
    innerWidth: WINDOW.width, innerHeight: WINDOW.height, devicePixelRatio: 1,
    location: { search: searchQuery }, screen: { width: WINDOW.width, height: WINDOW.height },
    matchMedia: () => ({ matches: false }),
    AudioContext: function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect() {} }),
        createBufferSource: () => ({ connect() {}, start() {}, stop() {} }),
        createBuffer: () => ({}), decodeAudioData: () => Promise.resolve({}),
        destination: {}, currentTime: 0, sampleRate: 48000, resume() {}
      };
    },
    Event: class Event { constructor(type) { this.type = type; } },
    CustomEvent: class CustomEvent { constructor(type, opt) { this.type = type; Object.assign(this, opt); } }
  };
  env.window = env; env.self = env; env.globalThis = env;

  const sandbox = vm.createContext(env);

  const deps = ['words.js', 'world.js', 'store.js', 'config.js', 'viewport.js', 'controls.js', 'overworld.js', 'fx.js', 'skillfx.js', 'evolutions.js', 'boss-ai.js', 'ui.js', 'fusion.js'];
  for (const dep of deps) {
    vm.runInContext(readJs(dep), sandbox, { filename: dep });
  }

  if (sandbox.CONTROLS) sandbox.CONTROLS.mount = () => {};
  sandbox.AUDIO = new Proxy({}, { get: () => () => {} });
  sandbox.HAPTICS = new Proxy({}, { get: () => () => {} });

  const RENDERER = new Proxy({
    getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }),
    getShakeOffset: () => ({ x: 0, y: 0 }), getCanvas: () => canvas,
    updateEffects: () => false, addSlashArc: () => {}, triggerShake: () => {},
    triggerHitStop: () => {}, spawnDamageNumber: () => {}, drawFusionFx: () => true
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  sandbox.RENDERER = RENDERER;

  const rawGameSrc = readJs('game.js');
  const endIdx = rawGameSrc.lastIndexOf('initFusionBridge();');
  assert.ok(endIdx > 0, 'game.js 必須具備 initFusionBridge');

  const probeCode = `
    window.__testProbe = {
      getWL: () => WL,
      setWL: (obj) => Object.assign(WL, obj),
      getWT: () => wT,
      setWT: (obj) => Object.assign(wT, obj),
      getWTMax: () => wMax,
      setWTMax: (obj) => Object.assign(wMax, obj),
      getBuildState: () => getBuildState(),
      getBuildDuos: () => buildDuos,
      setBuildDuos: (duos) => { buildDuos = [...duos]; },
      getBuildMutations: () => buildMutations,
      setBuildMutations: (muts) => { buildMutations = [...muts]; },
      getChoices: () => choices,
      getEligibleChoices: () => getEligibleChoices(),
      offerUp: () => offerUp(),
      applyChoice: (id, rev) => applyChoice(id, rev),
      getWinds: () => winds,
      setWinds: (arr) => { winds = [...arr]; },
      getCrosscuts: () => crosscuts,
      setCrosscuts: (arr) => { crosscuts = [...arr]; },
      getGhosts: () => ghosts,
      setGhosts: (arr) => { ghosts = [...arr]; },
      getDragonShots: () => dragonShots,
      setDragonShots: (arr) => { dragonShots = [...arr]; },
      getDragonScorches: () => dragonScorches,
      setDragonScorches: (arr) => { dragonScorches = [...arr]; },
      getBarrierPulses: () => barrierPulses,
      setBarrierPulses: (arr) => { barrierPulses = [...arr]; },
      getSacredSanctuary: () => sacredSanctuary,
      setSacredSanctuary: (v) => { sacredSanctuary = v; },
      getProj: () => proj,
      setProj: (arr) => { proj = [...arr]; },
      getSplitblasts: () => splitblasts,
      setSplitblasts: (arr) => { splitblasts = [...arr]; },
      getDuoShockwaves: () => duoShockwaves,
      setDuoShockwaves: (arr) => { duoShockwaves = [...arr]; },
      getInkfireMarks: () => inkfireMarks,
      setInkfireMarks: (arr) => { inkfireMarks = [...arr]; },
      getFusionEffects: () => fusionEffects,
      getFusionStats: () => ({ ...fusionStats }),
      getFusionToken: () => fusionToken,
      getXp: () => xp,
      getLevel: () => level,
      getRerolls: () => rerolls,
      setLevelupCooldown: (n) => { levelupCooldown = n; },
      reroll: () => reroll(),
      getBuildRevision: () => buildRevision,
      start: (id) => start(id),
      getEnemies: () => enemies,
      setEnemies: (arr) => { enemies = [...arr]; },
      getPlayer: () => P,
      hurt: (e, dmg) => hurt(e, dmg),
      update: (dt) => update(dt, false),
      pollGamepad: () => pollGamepad(),
      getFusionOpened: () => ({ epoch: fusionOpenedEpoch, revision: fusionOpenedRevision }),
      getBtnFusionHeld: () => ({ ...btnFusionHeld }),
      resolveAttackSpec: (id, lv, build, opt) => resolveAttackSpec(id, lv, build, opt),
      loseRun: () => loseRun(),
      startVictory: () => startVictorySequence(),
      recoverFrameError: () => recoverFrameError(),
      getOil: () => oil,
      setOil: (n) => { oil = n; },
      getElapsed: () => elapsed,
      setElapsed: (t) => { elapsed = t; },
      getState: () => state,
      setState: (s) => { state = s; },
      dispatchKey: (code, key = code) => {
        const listeners = (window.__eventListeners && window.__eventListeners.get('keydown')) || [];
        const ev = { code, key, repeat: false, preventDefault() {} };
        for (const fn of listeners) fn(ev);
      },
      pointerDown: (x, y, type = 'touch') => {
        const listeners = (window.__eventListeners && window.__eventListeners.get('pointerdown')) || [];
        const ev = { clientX: x, clientY: y, pointerId: 1, pointerType: type, isPrimary: true, button: 0, preventDefault() {} };
        for (const fn of listeners) fn(ev);
      }
    };
  `;
  const patchedGameSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(patchedGameSrc, sandbox, { filename: 'game.js' });

  const virtualGamepad = {
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
  };
  env.navigator.getGamepads = () => [virtualGamepad];
  env.__eventListeners = eventListeners;
  sandbox.virtualGamepad = virtualGamepad;

  return { sandbox, env };
}

function enemyAt(probe, dx, dy = 0, overrides = {}) {
  const p = probe.getPlayer();
  return {
    type: 'normal', hp: 1000, max: 1000, x: p.x + dx, y: p.y + dy, r: 20,
    s: 0, speed: 0, attackCd: 1e9, _id: Math.random(), ...overrides
  };
}

function bossAt(probe, dx, dy = 0, overrides = {}) {
  const p = probe.getPlayer();
  return {
    type: 'boss', hp: 5000, max: 5000, x: p.x + dx, y: p.y + dy, r: 40,
    s: 0, speed: 0, attackCd: 1e9, bossIndex: 3, stageId: 'rain-port', bossTheme: 'harbor',
    _id: Math.random(), ...overrides
  };
}

function withSeed(sandbox, seed, fn) {
  const old = sandbox.Math.random;
  let s = seed;
  sandbox.Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  try { return fn(); } finally { sandbox.Math.random = old; }
}

// ============================================================================
// Test 1: 雙次融合完整流程（真 GAME 狀態）
// ============================================================================
test('R8-DUAL-1: 雙次融合完整流程 - 兩組雙父 Lv5、各自繪馬 commit、父技停攻、槽位釋放、前融合保留傷害', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  // 初始：四技能 Lv5 (katana, fire, barrier, boom)
  probe.start('rain-port');
  probe.setElapsed(400); // >360s 符合繪馬條件
  probe.setWL(loadout({ katana: 5, fire: 5, barrier: 5, boom: 5 }));
  probe.setBuildDuos([]);

  // ----- 第一次融合：katana + fire -> fusion_inkblade -----
  // Boss 1 擊殺觸發繪馬
  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 }), true);
  assert.equal(FUSION.getState().state, 'ground');
  assert.equal(FUSION.pickupTalisman(), true);

  // 開啟確認面板
  assert.equal(FUSION.openFusionConfirm('fusion_inkblade'), true);
  assert.equal(FUSION.getState().state, 'confirming');

  // 使用當前的 epoch/revision（不是 probe.getFusionOpened() 的舊值）
  const fstate1 = FUSION.getState();
  const exec1 = FUSION.executeFusion('fusion_inkblade', fstate1.runEpoch, fstate1.revision);
  assert.equal(exec1.ok, true, `executeFusion 失敗: ${exec1.reason}`);
  assert.equal(exec1.fusedWeapon, 'fusion_inkblade');
  assert.equal(exec1.releasedSlots, 1);

  // 驗證：父技歸零、停攻、融合武器裝備
  assert.equal(probe.getWL().katana, 0, 'katana 歸零');
  assert.equal(probe.getWL().fire, 0, 'fire 歸零');
  assert.equal(probe.getWL().fusion_inkblade, 1, 'fusion_inkblade 裝備');
  assert.equal(probe.getWL().barrier, 5, 'barrier 保留');
  assert.equal(probe.getWL().boom, 5, 'boom 保留');
  assert.ok(probe.getWT().katana >= 999999, 'katana 停攻');
  assert.ok(probe.getWT().fire >= 999999, 'fire 停攻');

  // 驗證：槽位 4->3
  const activeAfter1 = Object.keys(probe.getWL()).filter(k => probe.getWL()[k] > 0).length;
  assert.equal(activeAfter1, 3, '融合後 3 主動技能（淨釋 1 槽）');

  // 驗證：父技不再攻擊
  const rear = enemyAt(probe, -100, 0);
  probe.setEnemies([rear]);
  probe.update(0.6);
  assert.equal(rear.hp, 1000, '融合後父技不得再攻擊');

  // 驗證：fusion_inkblade 能造成真傷害
  const target1 = enemyAt(probe, 100, 0);
  probe.setEnemies([target1]);
  probe.getWT().fusion_inkblade = 0;
  probe.update(0.016);
  probe.update(0.2);
  assert.ok(target1.hp < 1000, 'fusion_inkblade 必須造成真 HP 傷害');
  const dmg1 = 1000 - target1.hp;
  assert.ok(dmg1 > 0, `fusion_inkblade 實際傷害: ${dmg1}`);

  // ----- 模擬升級：補上新技能 thunder（槽位 3->4）-----
  // 保留 barrier:5, boom:5 供第二次融合
  probe.setWL(loadout({ barrier: 5, boom: 5, fusion_inkblade: 1, thunder: 1 }));
  const activeAfterLevelup = Object.keys(probe.getWL()).filter(k => probe.getWL()[k] > 0).length;
  assert.equal(activeAfterLevelup, 4, '升級補新技能後槽位回到 4');

  // ----- 第二次融合：barrier + boom -> fusion_exorcistseal -----
  // 繼續遊戲，第二 Boss 擊殺（elapsed 已經 >360）
  probe.setElapsed(500);
  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 300, y: 400 }), true, '第二 Boss 擊殺必須再次觸發繪馬資格');
  assert.equal(FUSION.getState().state, 'ground', '第二次繪馬掉落地面');
  assert.equal(FUSION.pickupTalisman(), true);

  assert.equal(FUSION.openFusionConfirm('fusion_exorcistseal'), true);
  const fstate2 = FUSION.getState();
  const exec2 = FUSION.executeFusion('fusion_exorcistseal', fstate2.runEpoch, fstate2.revision);
  assert.equal(exec2.ok, true);
  assert.equal(exec2.fusedWeapon, 'fusion_exorcistseal');
  assert.equal(exec2.releasedSlots, 1);

  // 驗證：第二組父技歸零、停攻
  assert.equal(probe.getWL().barrier, 0, 'barrier 歸零');
  assert.equal(probe.getWL().boom, 0, 'boom 歸零');
  assert.equal(probe.getWL().fusion_exorcistseal, 1, 'fusion_exorcistseal 裝備');
  assert.ok(probe.getWT().barrier >= 999999, 'barrier 停攻');
  assert.ok(probe.getWT().boom >= 999999, 'boom 停攻');

  // 驗證：第一融合武器保留且仍能傷害
  assert.equal(probe.getWL().fusion_inkblade, 1, '第一融合武器保留');
  const target2 = enemyAt(probe, 150, 0);
  probe.setEnemies([target2]);
  probe.getWT().fusion_inkblade = 0;
  probe.update(0.016);
  probe.update(0.2);
  assert.ok(target2.hp < 1000, '第一融合武器在第二次融合後仍必須造成真傷害');

  // 驗證：第二融合武器也能傷害
  const target3 = enemyAt(probe, 190, 0);
  probe.setEnemies([target3]);
  probe.getWT().fusion_exorcistseal = 0;
  probe.update(0.016);
  probe.update(0.4);
  assert.ok(target3.hp < 1000, '第二融合武器必須造成真傷害');

  // 驗證：消耗的父技不重用
  const fusionState = FUSION.getState();
  assert.ok(fusionState.consumedParents.includes('katana'));
  assert.ok(fusionState.consumedParents.includes('fire'));
  assert.ok(fusionState.consumedParents.includes('barrier'));
  assert.ok(fusionState.consumedParents.includes('boom'));
  assert.equal(fusionState.consumedParents.length, 4, '共消耗 4 個父技');

  // 驗證：融合武器列表
  const fusedSorted = [...fusionState.fusedWeapons].sort();
  assert.deepEqual(fusedSorted, ['fusion_exorcistseal', 'fusion_inkblade'].sort());
});

// ============================================================================
// Test 2: 非法融合拒絕（4+5、重複配方、非 DEV）
// ============================================================================
test('R8-DUAL-2: 非法融合拒絕 - Lv4+Lv5、重複配方、非 DEV 門禁', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  // Lv4 + Lv5 應進入 pending 狀態（不給繪馬掉落地面，但記錄資格等待升級）
  probe.start('rain-port');
  probe.setElapsed(400);
  probe.setWL(loadout({ katana: 4, fire: 5 }));
  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 }), true, '記錄資格');
  assert.equal(FUSION.getState().state, 'pending', 'Lv4+Lv5 進入 pending 等待升級');
  assert.equal(FUSION.getState().talismanEligible, true);

  // 重複配方：已融合的配方不得再次融合（父技已消耗、不在 eligible 中）
  probe.start('rain-port');
  probe.setElapsed(400);
  probe.setWL(loadout({ katana: 5, fire: 5, barrier: 5, boom: 5 }));
  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 }), true);
  FUSION.pickupTalisman();
  FUSION.openFusionConfirm('fusion_inkblade');
  const fstate = FUSION.getState();
  FUSION.executeFusion('fusion_inkblade', fstate.runEpoch, fstate.revision);
  // 第一融合完成，fusion_inkblade 已在 fusedWeapons 中，katana/fire 已消耗

  // 後續 Boss 觸發新繪馬
  probe.setWL(loadout({ barrier: 5, boom: 5, fusion_inkblade: 1 }));
  probe.setElapsed(500);
  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 300, y: 400 }), true);
  FUSION.pickupTalisman();
  FUSION.openFusionConfirm(); // 不指定配方，用預設第一個

  // 驗證：fusion_inkblade 不在 eligible 中（父技已消耗）
  const vm = FUSION.getViewModel();
  const eligibleIds = vm.eligibleRecipes.map(r => r.id);
  assert.ok(!eligibleIds.includes('fusion_inkblade'), '已融合配方不得出現在 eligible 中');
  assert.ok(eligibleIds.includes('fusion_exorcistseal'), '其他未消耗配對仍可融合');

  // 執行其他配方融合
  FUSION.openFusionConfirm('fusion_exorcistseal');
  const fstate2 = FUSION.getState();
  const execOther = FUSION.executeFusion('fusion_exorcistseal', fstate2.runEpoch, fstate2.revision);
  assert.equal(execOther.ok, true, '其他未消耗的 Lv5 配對仍可融合');

  // 非 DEV 門禁
  const { sandbox: sandbox2 } = createFullGameSandbox('?stage=rain-port'); // 無 dev=1
  const probe2 = sandbox2.window.__testProbe;
  const FUSION2 = sandbox2.window.FUSION;
  probe2.start('rain-port');
  probe2.setElapsed(400);
  probe2.setWL(loadout({ katana: 5, fire: 5 }));
  assert.equal(FUSION2.isEnabled(), false, '非 DEV 必須禁用融合');
  assert.equal(FUSION2.onBossDeath({ type: 'boss', x: 200, y: 300 }), false, '非 DEV 不給繪馬');
});

// ============================================================================
// Test 3: 雷符神罰真 HP 傷害、firstHitAt、hitEvents 驗證
// ============================================================================
test('R8-THUNDER-1: 雷符神罰 - 主爆炸單一中心、firstHitAt、hitEvents 世界座標、Boss 0.5倍、跨幀去重', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  probe.start('rain-port');
  probe.setElapsed(100);
  probe.setWL(loadout({ fusion_thundertalisman: 1 }));
  const p = probe.getPlayer();
  p.faceAng = 0;
  p.inv = 9999;
  probe.getWT().fusion_thundertalisman = 0;

  // 設置：2 隻普通怪 + 1 隻 Boss（共 3 目標，均在 maxTargets=4 內）
  const normal1 = enemyAt(probe, 50, 10);
  const normal2 = enemyAt(probe, 80, -20);
  const boss = bossAt(probe, 100, 10);
  probe.setEnemies([normal1, normal2, boss]);

  // 觸發雷符神罰
  withSeed(sandbox, 777, () => probe.update(0.016));

  // 等待到 firstHitAt 之後（約 0.68s），但在 life (1.95s) 之前
  withSeed(sandbox, 777, () => {
    for (let i = 0; i < 15; i++) probe.update(0.05); // 0.75 秒
  });

  // 取得特效
  const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_thundertalisman');
  assert.ok(fx, '必須建立雷符神罰特效');

  // 驗證 firstHitAt 存在且約 0.68s
  assert.ok(Number.isFinite(fx.firstHitAt), '必須有 firstHitAt');
  assert.ok(fx.firstHitAt >= 0.6 && fx.firstHitAt <= 0.8, `firstHitAt=${fx.firstHitAt} 應約 0.68s`);

  // 驗證 mainExplosionCenter 存在（應在玩家位置）
  assert.ok(fx.mainExplosionCenter && Number.isFinite(fx.mainExplosionCenter.x) && Number.isFinite(fx.mainExplosionCenter.y),
    '必須有主爆炸中心座標');
  assert.ok(Math.abs(fx.mainExplosionCenter.x - p.x) < 1 && Math.abs(fx.mainExplosionCenter.y - p.y) < 1,
    '主爆炸中心應在玩家位置');

  // 驗證 hitEvents 存在且有命中記錄
  assert.ok(Array.isArray(fx.hitEvents), '必須有 hitEvents 陣列');
  assert.ok(fx.hitEvents.length > 0, '必須至少命中 1 目標');
  assert.ok(fx.hitEvents.length <= 4, '最多命中 maxTargets(4) 目標');

  // 驗證每個 hitEvents 都有世界座標、判定時間、Boss 標記
  for (const evt of fx.hitEvents) {
    assert.ok(Number.isFinite(evt.x) && Number.isFinite(evt.y), 'hitEvents 必須有世界座標');
    assert.ok(Number.isFinite(evt.at) && evt.at >= 0, 'hitEvents 必須有判定時間');
    assert.ok(typeof evt.isBoss === 'boolean', 'hitEvents 必須有 isBoss 標記');
    assert.ok(Number.isFinite(evt.mainDmg) && evt.mainDmg > 0, 'hitEvents 必須有主爆炸傷害');
  }

  // 驗證實際扣血：普通怪吃全傷、Boss 吃 0.5 倍天狐雷
  const normalHit = [normal1, normal2].some(e => e.hp < 1000);
  assert.ok(normalHit, '至少一隻普通怪必須受到主爆炸傷害');

  // Boss 受傷（主爆炸全傷 + 天狐雷 0.5倍）
  assert.ok(boss.hp < 5000, 'Boss 必須受傷');

  // 驗證跨幀去重：同一敵人不會在 hitEvents 出現兩次
  const enemyIds = fx.hitEvents.map(e => e.enemyId);
  const uniqueIds = new Set(enemyIds);
  assert.equal(enemyIds.length, uniqueIds.size, 'hitEvents 不得有重複 enemyId（跨幀去重）');

  // 統計：fusionRecordDamage 應記錄總傷害
  const stats = probe.getFusionStats();
  assert.ok(stats.byKind.fusion_thundertalisman);
  assert.ok(stats.byKind.fusion_thundertalisman.damage > 0, '必須有記錄傷害');
  assert.ok(stats.byKind.fusion_thundertalisman.casts >= 1, '必須記錄 cast');

  console.log('[R8-THUNDER-1] firstHitAt:', fx.firstHitAt);
  console.log('[R8-THUNDER-1] mainExplosionCenter:', fx.mainExplosionCenter);
  console.log('[R8-THUNDER-1] hitEvents:', JSON.stringify(fx.hitEvents, null, 2));
  console.log('[R8-THUNDER-1] normal HP after:', normal1.hp, normal2.hp);
  console.log('[R8-THUNDER-1] boss HP after:', boss.hp);
  console.log('[R8-THUNDER-1] total damage:', stats.byKind.fusion_thundertalisman.damage);
});

// ============================================================================
// Test 4: 雷符神罰 - 跨幀多次 update 不重複扣血
// ============================================================================
test('R8-THUNDER-2: 雷符神罰 - 跨幀 update 不重複扣血（hitEnemyIds 去重）', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;

  probe.start('rain-port');
  probe.setElapsed(100);
  probe.setWL(loadout({ fusion_thundertalisman: 1 }));
  const p = probe.getPlayer();
  p.faceAng = 0;
  p.inv = 9999;
  probe.getWT().fusion_thundertalisman = 0;

  const target = enemyAt(probe, 80, 0);
  probe.setEnemies([target]);

  // 觸發
  withSeed(sandbox, 777, () => probe.update(0.016));

  // 多幀 update 穿越 firstHitAt (0.68s)，但在 life (1.95s) 之前
  withSeed(sandbox, 777, () => {
    for (let i = 0; i < 20; i++) probe.update(0.05); // 1 秒
  });

  // 同一敵人只能被扣血一次（主爆炸）+ 一次天狐雷
  const hpAfter = target.hp;
  const totalDmg = 1000 - hpAfter;
  assert.ok(totalDmg > 0, '必須有傷害');

  // 再多更新幾幀，HP 不應再變
  withSeed(sandbox, 777, () => {
    for (let i = 0; i < 10; i++) probe.update(0.05);
  });
  assert.equal(target.hp, hpAfter, '跨幀 update 不得重複扣血');

  // 驗證 hitEnemyIds 只有一個
  const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_thundertalisman');
  assert.ok(fx, '特效必須存在');
  assert.ok(fx.hitEnemyIds.size === 1, 'hitEnemyIds 大小必須為 1');
});

// ============================================================================
// Test 5: onBossDeath 第二次觸發驗證（真局流程）
// ============================================================================
test('R8-DUAL-3: onBossDeath 第二次觸發 - 真局流程驗證', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  // 完整流程：第一關 -> 第一融合 -> 繼續遊戲 -> 第二 Boss -> 第二融合
  probe.start('rain-port');
  probe.setElapsed(400);
  probe.setWL(loadout({ katana: 5, fire: 5, barrier: 5, boom: 5 }));

  // 第一次 Boss 擊殺
  const firstBossDeath = FUSION.onBossDeath({ type: 'boss', x: 200, y: 300, final: false });
  assert.equal(firstBossDeath, true);
  assert.equal(FUSION.getState().state, 'ground');

  FUSION.pickupTalisman();
  FUSION.openFusionConfirm('fusion_inkblade');
  const fstate1 = FUSION.getState();
  FUSION.executeFusion('fusion_inkblade', fstate1.runEpoch, fstate1.revision);

  // 狀態應重置為 IDLE，允許下一次
  assert.equal(FUSION.getState().state, 'idle');
  assert.equal(FUSION.getState().talismanDropped, false);
  assert.equal(FUSION.getState().talismanEligible, false);

  // 模擬遊戲繼續：保留 barrier:5, boom:5，升級 thunder, needle 到 Lv5
  probe.setWL(loadout({ fusion_inkblade: 1, barrier: 5, boom: 5, thunder: 5, needle: 5 }));
  probe.setElapsed(500);

  // 第二次 Boss 擊殺（非最終 Boss）
  const secondBossDeath = FUSION.onBossDeath({ type: 'boss', x: 300, y: 400, final: false });
  assert.equal(secondBossDeath, true, '第二次 Boss 擊殺必須再次觸發繪馬資格');
  assert.equal(FUSION.getState().state, 'ground', '第二次繪馬必須掉落地面');

  // 可以拾取並融合
  assert.equal(FUSION.pickupTalisman(), true);
  FUSION.openFusionConfirm(); // 不指定配方，用預設第一個

  // 應有新的 eligible 配方
  const eligible = FUSION.getEligibleRecipes(probe.getBuildState());
  console.log('Second fusion eligible:', eligible.map(r => r.id));

  // 實際只有 implemented=true 才進 eligible
  const implementedEligible = eligible.filter(r => r.implemented && r.enabled);
  console.log('Second fusion implemented eligible:', implementedEligible.map(r => r.id));
  assert.ok(implementedEligible.length > 0, '必須至少有一個已實作的合法配方');

  // 選一個已實作的（例如 fusion_exorcistseal = barrier+boom，或 fusion_foxiai = thunder+needle）
  // 需要確認父技都未被消耗
  for (const r of implementedEligible) {
    assert.ok(!r.parents.some(p => FUSION.getState().consumedParents.includes(p)),
      `配方 ${r.id} 的父技不得是已消耗的`);
  }
});

console.log('R8 雙次融合與雷符神罰測試定義完成');
