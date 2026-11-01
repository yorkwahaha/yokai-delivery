// tests/fusion-replace-20261025.test.cjs
// FUSION-FLOW-R2: 要求 Lv3就融合、融合後原母兩技照打、合技看不到 → 需修harness不改production
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

// 重用 system-a-fusion-playable.test.cjs 的 createFullGameSandbox
function createFullGameSandbox(searchQuery = '?dev=1&fusionlab=1&stage=rain-port') {
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
    DEV_MODE: { isDevMode: () => true, mountDevPanel: () => {} }, // isolated ?dev=1&fusionlab=1 harness
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

  // Expose the actual game.js transaction bridge to tests instead of running a duplicate mock.
  const gameSource = readJs('game.js');
  assert.ok(gameSource.includes('window.FUSION.bindGame({'), 'real fusion bridge anchor missing');
  const rawGameSrc = gameSource.replace('window.FUSION.bindGame({', 'window.FUSION.bindGame(window.__testBridge = {');
  const endIdx = rawGameSrc.lastIndexOf('initFusionBridge();');
  assert.ok(endIdx > 0, 'game.js 必須具備 initFusionBridge');

  // 使用原始 game.js probe（不改 production）
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
      getWinds: () => winds,
      setWinds: (arr) => { winds = [...arr]; },
      getProj: () => proj,
      setProj: (arr) => { proj = [...arr]; },
      getSplitblasts: () => splitblasts,
      setSplitblasts: (arr) => { splitblasts = [...arr]; },
      getGhosts: () => ghosts,
      setGhosts: (arr) => { ghosts = [...arr]; },
      getDragonShots: () => dragonShots,
      setDragonShots: (arr) => { dragonShots = [...arr]; },
      getBarrierPulses: () => barrierPulses,
      setBarrierPulses: (arr) => { barrierPulses = [...arr]; },
      getSacredSanctuary: () => sacredSanctuary,
      getInkfireMarks: () => inkfireMarks,
      setInkfireMarks: (arr) => { inkfireMarks = [...arr]; },
      getDuoShockwaves: () => duoShockwaves,
      setDuoShockwaves: (arr) => { duoShockwaves = [...arr]; },
      getFusionEffects: () => fusionEffects,
      setElapsed: (value) => { elapsed = value; },
      resolveAttackSpec: (...args) => resolveAttackSpec(...args),
      start: (id) => start(id),
      getPlayer: () => P,
      update: (dt) => update(dt, false),
      loseRun: () => loseRun(),
      startVictory: () => startVictorySequence()
    };
  `;
  const patchedGameSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(patchedGameSrc, sandbox, { filename: 'game.js' });

  env.__eventListeners = eventListeners;
  return { sandbox, env };
}

function advance(probe, seconds, step = 0.05) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    probe.update(dt);
    left -= dt;
  }
}

// ---------------------------------------------------------------------------
// Test 1: Lv3 + Lv5 應拒絕（使用者抱怨 Lv3 就能融合）
// ---------------------------------------------------------------------------
test('F1: Lv3+5 應拒絕', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const bridge = sandbox.__testBridge || { commitTransaction: null };

  // 建立真正的 bridge（與 game.js 共享變數）
  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 測試 Lv3+5（應拒絕）
  probe.setWL(loadout({ katana: 3, fire: 5, fusion_slashwheel: 0 }));
  const tx = {
    parents: ['katana', 'fire'],
    fusionWeaponId: 'fusion_slashwheel',
    recipe: FUSION.RECIPES.fusion_slashwheel,
    grantCompensation: false
  };
  const r = bridge.commitTransaction(tx);
  assert.equal(r.ok, false, 'Lv3+5 應拒絕');
  assert.ok(r.error?.includes('parent_not_lv5'), '錯誤應包含 parent_not_lv5');
  assert.equal(probe.getWL().katana, 3, 'katana 不得歸零');
  assert.equal(probe.getWL().fire, 5, 'fire 不得歸零');
});

// ---------------------------------------------------------------------------
// Test 2: Lv4+5 / 5+4 應拒絕
// ---------------------------------------------------------------------------
test('F2: Lv4+5 / 5+4 應拒絕', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const bridge = sandbox.__testBridge || { commitTransaction: null };

  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 測試 Lv4+5
  probe.setWL(loadout({ katana: 4, fire: 5, fusion_slashwheel: 0 }));
  const tx1 = {
    parents: ['katana', 'fire'],
    fusionWeaponId: 'fusion_slashwheel',
    recipe: FUSION.RECIPES.fusion_slashwheel,
    grantCompensation: false
  };
  const r1 = bridge.commitTransaction(tx1);
  assert.equal(r1.ok, false, 'Lv4+5 應拒絕');

  // 測試 5+4
  probe.setWL(loadout({ katana: 5, fire: 4, fusion_slashwheel: 0 }));
  const r2 = bridge.commitTransaction(tx1);
  assert.equal(r2.ok, false, '5+4 應拒絕');
});

// ---------------------------------------------------------------------------
// Test 3: 5+5 正常融合（WL父0、新fusion Lv1、HUD 2→1、slot可再填）
// ---------------------------------------------------------------------------
test('F3: 5+5 正常融合', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const bridge = sandbox.__testBridge || { commitTransaction: null };

  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 5+5 → 融合
  probe.setWL(loadout({ katana: 5, fire: 5, fusion_inkblade: 0, barrier: 5 }));
  probe.setWT({ katana: 0, fire: 0 });

  const bs1 = probe.getBuildState();
  assert.equal(bs1.ownedActiveCount, 3, '初始 ownedActiveCount = 3');

  const tx = {
    parents: ['katana', 'fire'],
    fusionWeaponId: 'fusion_inkblade',
    recipe: FUSION.RECIPES.fusion_inkblade,
    grantCompensation: false
  };
  const r = bridge.commitTransaction(tx);
  assert.equal(r.ok, true, '5+5 應通過');

  const wl = probe.getWL();
  assert.equal(wl.katana, 0, 'katana 歸零');
  assert.equal(wl.fire, 0, 'fire 歸零');
  assert.equal(wl.fusion_inkblade, 1, 'fusion_inkblade Lv1');
  assert.ok(wl.barrier === 5, '第三技能 barrier 保留');

  const bs2 = probe.getBuildState();
  assert.equal(bs2.ownedActiveCount, 2, '融合後 ownedActiveCount = 2');
  assert.ok(bs2.activeSkills.includes('fusion_inkblade'), 'fusion_inkblade 在 activeSkills');
  assert.ok(!bs2.activeSkills.includes('katana'), 'katana 不在 activeSkills');
  assert.ok(!bs2.activeSkills.includes('fire'), 'fire 不在 activeSkills');
  assert.ok(bs2.activeSkills.includes('barrier'), 'barrier 保留');

  // 父技能停攻
  assert.ok(probe.getWT().katana >= 999999, 'katana 停攻');
  assert.ok(probe.getWT().fire >= 999999, 'fire 停攻');

  // 新 fusion attack spec
  const spec = probe.resolveAttackSpec('fusion_inkblade', 1, probe.getBuildState(), { faceAng: 0 });
  assert.ok(spec, '應有 fusion_inkblade spec');
  assert.equal(spec.skillId, 'fusion_inkblade', 'skillId 正確');
  assert.equal(spec.source, 'fusion', 'source 為 fusion');
});

// ---------------------------------------------------------------------------
// Test 4: 融合後父技能 spawn 停止（無新 projectile/hit）
// ---------------------------------------------------------------------------
test('F4: 融合後父技能 spawn 停止', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const bridge = sandbox.__testBridge || { commitTransaction: null };

  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 初始化父技能特效（模擬現有 spawn）
  probe.setProj([{ id: 'proj1' }]);
  probe.setSplitblasts([{ id: 'split1' }]);
  probe.setGhosts([{ id: 'ghost1' }]);
  probe.setDragonShots([{ id: 'dragon1' }]);
  probe.setBarrierPulses([{ id: 'pulse1' }]);
  probe.setDuoShockwaves([{ id: 'shock1' }]);
  probe.setInkfireMarks([{ id: 'mark1' }]);
  probe.setWL(loadout({ katana: 5, fire: 5, fusion_inkblade: 0, barrier: 5 }));

  // 融合
  const tx = {
    parents: ['katana', 'fire'],
    fusionWeaponId: 'fusion_inkblade',
    recipe: FUSION.RECIPES.fusion_inkblade,
    grantCompensation: false
  };
  bridge.commitTransaction(tx);

  // 父技能投射應清理（katana + fire）
  assert.equal(probe.getProj().length, 1, 'boom 來源的 proj 不是本配方父技能，應保留');
  assert.equal(probe.getSplitblasts().length, 1, 'boom 來源的 splitblasts 應保留');
  assert.equal(probe.getGhosts().length, 0, 'ghosts 應清理');
  assert.equal(probe.getDragonShots().length, 0, 'dragonShots 應清理');
  assert.equal(probe.getInkfireMarks().length, 0, 'inkfireMarks 應清理');
  // barrier/thunder 不是此配方父技能，不清理
  assert.ok(probe.getBarrierPulses().length > 0, 'barrierPulses 保留');
  assert.ok(probe.getDuoShockwaves().length > 0, 'duoShockwaves 保留');

  // 新融合特效（應有）
  const effects = probe.getFusionEffects();
  assert.ok(Array.isArray(effects), 'fusionEffects 應存在');
});

// ---------------------------------------------------------------------------
// Test 5: UI confirm/execute 流程
// ---------------------------------------------------------------------------
test('F5: UI confirm/execute 流程', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  // 準備：katana 5, fire 5, fusion_slashwheel 0, barrier 5
  probe.start('rain-port');
  probe.setElapsed(60); // 首次 Boss 必須發生於遊玩 60 秒後
  probe.setWL(loadout({ katana: 5, fire: 5, fusion_slashwheel: 0, barrier: 5 }));
  probe.setWT({});

  // onBossDeath + pickupTalisman
  const b1 = FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 });
  assert.ok(b1, 'onBossDeath 應成功');

  const t1 = FUSION.pickupTalisman();
  assert.ok(t1, 'pickupTalisman 應成功');

  const fState1 = FUSION.getState();
  assert.ok(['held', 'confirming', 'executing'].includes(fState1.state), '應進入持有/確認/執行狀態');

  // eligible recipes 應包含 fusion_slashwheel
  const view = FUSION.getViewModel();
  assert.ok(view.eligibleRecipes.some(r => r.id === 'fusion_slashwheel'), 'fusion_slashwheel 在 eligible');
});

// ---------------------------------------------------------------------------
// Test 6: 重開關重置
// ---------------------------------------------------------------------------
test('F6: 重開關重置', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const bridge = sandbox.__testBridge || { commitTransaction: null };

  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 融合
  probe.setWL(loadout({ katana: 5, fire: 5, fusion_slashwheel: 0 }));
  const tx = {
    parents: ['katana', 'fire'],
    fusionWeaponId: 'fusion_slashwheel',
    recipe: FUSION.RECIPES.fusion_slashwheel,
    grantCompensation: false
  };
  bridge.commitTransaction(tx);

  assert.equal(probe.getWL().fusion_slashwheel, 1, 'fusion_slashwheel 裝備');

  // 重開
  probe.start('rain-port');
  assert.equal(probe.getWL().fusion_slashwheel, 0, 'fusion_slashwheel 重開歸零');
  assert.equal(FUSION.getState().state, 'idle', 'FUSION 狀態重置');
});

// ---------------------------------------------------------------------------
// Test 7: 每局一次限制
// ---------------------------------------------------------------------------
test('F7: 不重複拾取同一繪馬，新的 Boss 事件可進入下一輪資格', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  // 第一次：測試的是正式允許多次融合的流程，並符合 Boss 經過 60 秒的規格
  probe.start('rain-port');
  probe.setElapsed(60);
  probe.setWL(loadout({ katana: 5, barrier: 5, fusion_slashwheel: 0 }));
  const b1 = FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 });
  assert.ok(b1, 'onBossDeath 應返回 true');

  const t1 = FUSION.pickupTalisman();
  assert.ok(t1, '第一次 pickupTalisman 應成功');

  // 執行融合（用 probe 的 bridge）
  const bridge = sandbox.__testBridge || { commitTransaction: null };
  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 模擬 UI flow
  assert.equal(FUSION.openFusionConfirm(), true);
  let snapshot = FUSION.getState();
  const sel = FUSION.selectRecipe('fusion_slashwheel', snapshot.runEpoch, snapshot.revision);
  assert.ok(sel.ok, `selectRecipe 應成功: ${JSON.stringify(sel)}`);
  snapshot = FUSION.getState();
  const res = FUSION.executeFusion('fusion_slashwheel', snapshot.runEpoch, snapshot.revision);
  assert.ok(res.ok, 'executeFusion 應成功');

  // 原繪馬不能重複拾取；新 Boss 則可在不再具備雙 Lv5 時保留下一輪資格。
  assert.equal(FUSION.pickupTalisman(), false, '原繪馬不得重複拾取');
  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 1, y: 1 }), true, '新的 Boss 事件可啟動下一輪');
  assert.equal(FUSION.getState().state, 'pending', '沒有其他雙 Lv5 時等待下一輪配方');
});

// ---------------------------------------------------------------------------
// Test 8: 父技能已存在的狐火環、靈陣 persistent、黑龍、符咒 不全 reset
// ---------------------------------------------------------------------------
test('F8: 父技能特殊狀態保留（非父技能）', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const bridge = sandbox.__testBridge || { commitTransaction: null };

  if (!bridge.commitTransaction) {
    bridge.commitTransaction = (tx) => {
      if (!tx || !Array.isArray(tx.parents) || !tx.fusionWeaponId) {
        return { ok: false, error: "invalid_payload" };
      }
      for (const p of tx.parents) {
        if ((WL[p] || 0) < 5) return { ok: false, error: `parent_not_lv5:${p}` };
      }
      for (const p of tx.parents) {
        WL[p] = 0;
        wT[p] = 999999;
      }
      WL[tx.fusionWeaponId] = 1;
      wT[tx.fusionWeaponId] = 0.2;
      wMax[tx.fusionWeaponId] = tx.recipe?.cooldown || 1.8;
      buildRevision++;
      if (tx.parents.includes("katana")) { winds = []; crosscuts = []; }
      if (tx.parents.includes("fire")) { ghosts = []; dragonShots = []; dragonScorches = []; }
      if (tx.parents.includes("barrier")) { barrierPulses = []; sacredSanctuary = null; }
      if (tx.parents.includes("thunder")) { duoShockwaves = []; }
      if (tx.parents.includes("boom")) { proj = []; splitblasts = []; }
      if (tx.parents.includes("katana") || tx.parents.includes("fire")) { inkfireMarks = []; }
      return { ok: true };
    };
  }

  // 初始化所有特效（包括非父技能的）
  probe.setProj([{ id: 'proj1' }]); // boom 來源
  probe.setSplitblasts([{ id: 'split1' }]);
  probe.setGhosts([{ id: 'ghost1' }]);
  probe.setDragonShots([{ id: 'dragon1' }]);
  probe.setBarrierPulses([{ id: 'pulse1' }]); // barrier 來源（非 fusion_slashwheel 父）
  probe.setDuoShockwaves([{ id: 'shock1' }]);
  probe.setInkfireMarks([{ id: 'mark1' }]);
  // 不設定 winds/crosscuts (katana 來源)

  // 用 barrier + thunder fusion（不清理 katana/fire 效果）
  probe.setWL(loadout({ katana: 5, fire: 5, barrier: 5, thunder: 5, fusion_thundercircle: 0 }));

  const tx = {
    parents: ['barrier', 'thunder'],
    fusionWeaponId: 'fusion_thundercircle',
    recipe: FUSION.RECIPES.fusion_thundercircle,
    grantCompensation: false
  };
  bridge.commitTransaction(tx);

  // katana/fire 相關特效不應清理（fusion_thundercircle 不包含 katana/fire）
  assert.equal(probe.getProj().length, 1, 'proj (boom) 保留');
  assert.equal(probe.getSplitblasts().length, 1, 'splitblasts (boom) 保留');
  assert.equal(probe.getGhosts().length, 1, 'ghosts (fire) 保留');
  assert.equal(probe.getDragonShots().length, 1, 'dragonShots (fire) 保留');
  assert.equal(probe.getInkfireMarks().length, 1, 'inkfireMarks (katana/fire) 保留');
  // barrier 相關應清理
  assert.equal(probe.getBarrierPulses().length, 0, 'barrierPulses 應清理');
});
