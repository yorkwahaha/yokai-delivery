// tests/opencode-m2-fusion-runtime.test.cjs
// M2-FUSION runtime focused Gate：registry、選卡、四優先真攻擊、清理、受控 30s 曲線。
// 只驗本票；不跑全庫、不讀音訊、不代替真 Chrome/真機。
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
  'fusion_foxfirebarrier', 'fusion_exorcistseal', 'fusion_thundercircle'
];
const ZERO_LOADOUT = Object.fromEntries(SKILL_IDS.map(id => [id, 0]));

function loadout(overrides = {}) {
  return { ...ZERO_LOADOUT, ...overrides };
}

function createFullGameSandbox(searchQuery = '?dev=1&fusioncandidate=1&stage=rain-port') {
  const WINDOW = { width: 900, height: 600 };
  const storage = new Map([['yokai-tutorial-v1', '"skip"']]);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    setTransform: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    roundRect: () => {},
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  const eventListeners = new Map();
  const addListener = (type, fn) => {
    if (!eventListeners.has(type)) eventListeners.set(type, []);
    eventListeners.get(type).push(fn);
  };

  const canvas = {
    addEventListener: addListener,
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WINDOW.width, height: WINDOW.height }),
    width: WINDOW.width,
    height: WINDOW.height,
    style: {},
  };

  class ImageMock {
    constructor() {
      this.naturalWidth = 100;
      this.naturalHeight = 100;
      this.width = 100;
      this.height = 100;
      this.dataset = {};
    }
  }

  const env = {
    console,
    Set,
    Map,
    Math,
    Date,
    JSON,
    URL,
    URLSearchParams,
    performance: { now: () => 1000 },
    navigator: { userAgent: 'node' },
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    Image: ImageMock,
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v)
    },
    document: {
      hidden: false,
      getElementById: () => canvas,
      addEventListener: addListener,
      body: { dataset: {} },
      documentElement: { dataset: {} }
    },
    addEventListener: addListener,
    removeEventListener() {},
    dispatchEvent: () => true,
    innerWidth: WINDOW.width,
    innerHeight: WINDOW.height,
    devicePixelRatio: 1,
    location: { search: searchQuery },
    screen: { width: WINDOW.width, height: WINDOW.height },
    matchMedia: () => ({ matches: false }),
    AudioContext: function () {
      return {
        createGain: () => ({ gain: { value: 0 }, connect() {} }),
        createBufferSource: () => ({ connect() {}, start() {}, stop() {} }),
        createBuffer: () => ({}),
        decodeAudioData: () => Promise.resolve({}),
        destination: {},
        currentTime: 0,
        sampleRate: 48000,
        resume() {}
      };
    },
    Event: class Event { constructor(type) { this.type = type; } },
    CustomEvent: class CustomEvent { constructor(type, opt) { this.type = type; Object.assign(this, opt); } }
  };
  env.window = env;
  env.self = env;
  env.globalThis = env;

  const sandbox = vm.createContext(env);

  const deps = [
    'words.js',
    'world.js',
    'store.js',
    'config.js',
    'viewport.js',
    'controls.js',
    'overworld.js',
    'fx.js',
    'skillfx.js',
    'evolutions.js',
    'boss-ai.js',
    'ui.js',
    'fusion.js'
  ];

  for (const dep of deps) {
    const code = readJs(dep);
    vm.runInContext(code, sandbox, { filename: dep });
  }

  if (sandbox.CONTROLS) sandbox.CONTROLS.mount = () => {};

  sandbox.AUDIO = new Proxy({}, { get: () => () => {} });
  sandbox.HAPTICS = new Proxy({}, { get: () => () => {} });
  sandbox.RENDERER = new Proxy({
    getCtx: () => ctx,
    getDpr: () => 1,
    getCam: () => ({ x: 900, y: 600 }),
    getShakeOffset: () => ({ x: 0, y: 0 }),
    getCanvas: () => canvas,
    updateEffects: () => false,
    addSlashArc: () => {},
    triggerShake: () => {},
    triggerHitStop: () => {},
    spawnDamageNumber: () => {},
    drawFusionFx: () => true
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  const rawGameSrc = readJs('game.js');
  const endIdx = rawGameSrc.lastIndexOf('initFusionBridge();');
  assert.ok(endIdx > 0, 'game.js 必須具備 initFusionBridge');
  const probeCode = `
    window.__testProbe = {
      getWL: () => WL,
      setWL: (obj) => Object.assign(WL, obj),
      getWT: () => wT,
      setElapsed: (t) => { elapsed = t; },
      getElapsed: () => elapsed,
      getState: () => state,
      setState: (s) => { state = s; },
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
    s: 0, speed: 0, attackCd: 1e9, ...overrides
  };
}

function equipFusion(probe, id) {
  probe.start('rain-port');
  probe.setElapsed(100);
  probe.setWL(loadout({ [id]: 1 }));
  const p = probe.getPlayer();
  p.faceAng = 0;
  p.inv = 9999;
  probe.getWT()[id] = 0;
  return p;
}

function withSeed(sandbox, seed, fn) {
  const old = sandbox.Math.random;
  let s = seed;
  sandbox.Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  try { return fn(); } finally { sandbox.Math.random = old; }
}

// ---------------------------------------------------------------------------
// 1. 十 registry、唯一 parents、#8 同 ID 改名但 disabled、Stage1/Hard gate
// ---------------------------------------------------------------------------
test('M2-FUSION-1: registry identity/uniqueness, implemented eligibility, #8 WAITING_IMPLEMENTATION, strict gate', () => {
  const FUSION = require(path.join(ROOT, 'js', 'fusion.js'));
  FUSION.reset();
  const expectedIds = [
    'fusion_inkblade', 'fusion_slashwheel', 'fusion_foxiai', 'fusion_exorcistblade',
    'fusion_foxfirebarrier', 'fusion_foxthunderlantern', 'fusion_flamefestival',
    'fusion_thundercircle', 'fusion_exorcistseal', 'fusion_thundertalisman'
  ];
  assert.deepEqual(Object.keys(FUSION.RECIPES), expectedIds, '十組固定 ID 與順序必須保留');

  const expectedParents = {
    fusion_inkblade: ['katana', 'fire'],
    fusion_slashwheel: ['katana', 'barrier'],
    fusion_foxiai: ['katana', 'thunder'],
    fusion_exorcistblade: ['katana', 'boom'],
    fusion_foxfirebarrier: ['fire', 'barrier'],
    fusion_foxthunderlantern: ['fire', 'thunder'],
    fusion_flamefestival: ['fire', 'boom'],
    fusion_thundercircle: ['barrier', 'thunder'],
    fusion_exorcistseal: ['barrier', 'boom'],
    fusion_thundertalisman: ['thunder', 'boom']
  };
  const seenPairs = new Set();
  for (const id of expectedIds) {
    const recipe = FUSION.RECIPES[id];
    assert.equal(recipe.id, id);
    assert.deepEqual([...recipe.parents], expectedParents[id], `${id} parents 固定`);
    assert.notEqual(recipe.parents[0], recipe.parents[1], `${id} 不得自我配對`);
    const key = [...recipe.parents].sort().join(',');
    assert.ok(!seenPairs.has(key), `${key} 不得重複配方`);
    seenPairs.add(key);
  }
  assert.equal(seenPairs.size, 10, '十組 parents 必須唯一');

  const disabled = ['fusion_slashwheel', 'fusion_foxthunderlantern', 'fusion_flamefestival', 'fusion_thundercircle', 'fusion_thundertalisman'];
  for (const id of disabled) {
    assert.equal(FUSION.RECIPES[id].implemented, false, `${id} 不得宣稱已實作`);
    assert.equal(FUSION.RECIPES[id].enabled, false, `${id} 不得進 enabled`);
    assert.equal(FUSION.RECIPES[id].status, 'WAITING_IMPLEMENTATION');
  }
  assert.equal(FUSION.RECIPES.fusion_thundercircle.name, '奧義・雷陣封界', '#8 沿用同 ID 改顯示名');
  assert.equal(FUSION.RECIPES.fusion_thundercircle.implemented, false, '#8 無真 consumer 前不得標 implemented');
  for (const id of ['fusion_foxiai', 'fusion_exorcistblade', 'fusion_foxfirebarrier', 'fusion_exorcistseal']) {
    assert.equal(FUSION.RECIPES[id].implemented, true);
    assert.equal(FUSION.RECIPES[id].enabled, true);
    assert.equal(FUSION.RECIPES[id].status, 'TECH_PENDING', '四招驗證前只可 TECH_PENDING');
  }

  const allParentsLv5 = {
    WL: { katana: 5, fire: 5, barrier: 5, thunder: 5, boom: 5, needle: 0 },
    ownedActiveCount: 5
  };
  assert.deepEqual(
    FUSION.getEligibleRecipes(allParentsLv5).map(r => r.id),
    ['fusion_inkblade', 'fusion_foxiai', 'fusion_exorcistblade', 'fusion_foxfirebarrier', 'fusion_exorcistseal'],
    'eligible 只含 implemented+enabled+雙父 Lv5'
  );

  const bridge = (stageId, isRainPortNormal, search) => ({
    getEnv: () => ({ stageId, isRainPortNormal, elapsed: 400, search }),
    getBuildState: () => allParentsLv5
  });
  const gateCases = [
    ['night-town', true, '?dev=1&fusioncandidate=1', false, 'Stage1 非雨港 Normal'],
    ['rain-port', false, '?dev=1&fusioncandidate=1', false, 'Hard 必須關閉'],
    ['rain-port', true, '?dev=1&fusioncandidate=1&stage=night-town', true, '雨港 Normal + dev gate'],
    ['rain-port', true, '?dev=1', false, '缺 fusioncandidate'],
    ['rain-port', true, '?fusioncandidate=1', false, '缺 dev=1']
  ];
  for (const [stage, normal, search, expected, label] of gateCases) {
    FUSION.reset();
    FUSION.bindGame(bridge(stage, normal, search));
    assert.equal(FUSION.isEnabled(), expected, label);
  }
  FUSION.reset();
  FUSION.bindGame(null);
});

// ---------------------------------------------------------------------------
// 2. 多 eligible 選非第一、stale/非法原子零扣、4->3、父技/Duo/投射清理、重開
// ---------------------------------------------------------------------------
test('M2-FUSION-2: multi eligible non-first selection, atomic zero-cost rejection, 4->3 cleanup, restart', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  probe.start('rain-port');
  probe.setWL(loadout({ katana: 5, fire: 5, barrier: 5, boom: 5 }));
  probe.setBuildDuos(['duo_cinderseal', 'duo_inkfire']);
  probe.setElapsed(380);

  assert.equal(FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 }), true);
  assert.equal(FUSION.getState().state, 'ground');
  assert.equal(FUSION.pickupTalisman(), true);
  probe.dispatchKey('KeyF');
  assert.equal(probe.getState(), 'fusion');
  assert.equal(FUSION.getState().state, 'confirming');
  const opened = probe.getFusionOpened();
  assert.equal(opened.epoch, FUSION.getState().runEpoch);
  assert.equal(opened.revision, FUSION.getState().revision);
  assert.equal(FUSION.getState().selectedRecipeId, 'fusion_inkblade');

  const beforeWL = { ...probe.getWL() };
  const revisionBefore = opened.revision;
  const staleSelect = FUSION.selectRecipe('fusion_exorcistseal', opened.epoch, opened.revision - 1);
  assert.equal(staleSelect.ok, false);
  assert.equal(staleSelect.reason, 'stale_revision');
  assert.equal(FUSION.getState().selectedRecipeId, 'fusion_inkblade', 'stale select 不得改選');
  assert.equal(FUSION.getState().revision, revisionBefore, 'stale select 不得改 revision');
  assert.deepEqual({ ...probe.getWL() }, beforeWL, 'stale select 零扣');

  const staleEpochSelect = FUSION.selectRecipe('fusion_exorcistseal', opened.epoch - 1, opened.revision);
  assert.equal(staleEpochSelect.ok, false);
  assert.equal(staleEpochSelect.reason, 'stale_epoch');
  assert.equal(FUSION.getState().selectedRecipeId, 'fusion_inkblade', 'stale epoch select 不得改選');
  assert.equal(FUSION.getState().revision, revisionBefore, 'stale epoch select 不得改 revision');

  const illegal = FUSION.selectRecipe('fusion_thundercircle', opened.epoch, opened.revision);
  assert.equal(illegal.ok, false);
  assert.equal(illegal.reason, 'not_available', '#8 未實作不得選');
  const unknown = FUSION.selectRecipe('fusion_does_not_exist', opened.epoch, opened.revision);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'invalid_recipe');
  const missingParent = FUSION.selectRecipe('fusion_foxiai', opened.epoch, opened.revision);
  assert.equal(missingParent.ok, false);
  assert.equal(missingParent.reason, 'parent_not_lv5');
  assert.equal(FUSION.getState().revision, revisionBefore, '非法 select 不得改 revision');

  const staleEpochExecute = FUSION.executeFusion('fusion_exorcistseal', opened.epoch - 1, opened.revision);
  assert.equal(staleEpochExecute.ok, false);
  assert.equal(staleEpochExecute.reason, 'stale_epoch');
  assert.equal(FUSION.getState().state, 'confirming');
  assert.deepEqual({ ...probe.getWL() }, beforeWL, 'stale epoch execute 零扣且未交易');

  const staleExecute = FUSION.executeFusion('fusion_exorcistseal', opened.epoch, opened.revision - 1);
  assert.equal(staleExecute.ok, false);
  assert.equal(staleExecute.reason, 'stale_revision');
  assert.equal(FUSION.getState().state, 'confirming');
  assert.deepEqual({ ...probe.getWL() }, beforeWL, 'stale execute 零扣且未交易');

  // 鍵盤：開面板焦點在第一張合武卡；右移三次到第四張（退魔封陣）再選取。
  for (let i = 0; i < 3; i++) probe.dispatchKey('ArrowRight', 'ArrowRight');
  probe.dispatchKey('Enter', 'Enter');
  assert.equal(FUSION.getState().selectedRecipeId, 'fusion_exorcistseal', '必須能選非第一張合武');
  assert.equal(FUSION.getState().state, 'confirming');
  assert.ok(FUSION.getState().revision > revisionBefore, '選取成功才遞增 revision');
  const synced = probe.getFusionOpened();
  assert.equal(synced.epoch, FUSION.getState().runEpoch, 'game 必須同步選取後 epoch');
  assert.equal(synced.revision, FUSION.getState().revision, 'game 必須同步選取後 revision');

  // 取消零扣，再以 KeyF 重開；選取保持。
  probe.dispatchKey('Escape', 'Escape');
  assert.equal(probe.getState(), 'play');
  assert.equal(FUSION.getState().state, 'held');
  assert.deepEqual({ ...probe.getWL() }, beforeWL, '取消零扣');
  probe.dispatchKey('KeyF');
  assert.equal(probe.getState(), 'fusion');
  assert.equal(FUSION.getState().selectedRecipeId, 'fusion_exorcistseal');

  // 設置父技殘留與非父技投射，確認只清選定 parents。
  probe.setBarrierPulses([{ x: 1, y: 2, life: 1 }]);
  probe.setSacredSanctuary({ x: 1, y: 1, r: 120, life: 1 });
  probe.setProj([{ x: 1, y: 2 }]);
  probe.setSplitblasts([{ x: 1, y: 2 }]);
  probe.setWinds([{
    x: -9999, y: -9999, vx: 0, vy: 0, ang: 0, life: 1,
    originX: -9999, originY: -9999, traveled: 0, maxTravel: 0,
    pierceLimit: 0, hits: new Set()
  }]);

  const layout = sandbox.window.UI.fusionLayout(null, FUSION.getViewModel());
  const confirm = layout.buttons.find(b => b.id === 'confirm');
  assert.ok(confirm, 'UI 必須提供 confirm');
  probe.pointerDown(confirm.x + confirm.w / 2, confirm.y + confirm.h / 2, 'touch');
  assert.equal(probe.getState(), 'play', '觸控確認後回 play');
  assert.equal(FUSION.getState().state, 'fused');
  assert.equal(probe.getWL().barrier, 0, 'barrier 父技歸零');
  assert.equal(probe.getWL().boom, 0, 'boom 父技歸零');
  assert.equal(probe.getWL().fusion_exorcistseal, 1, '退魔封陣裝備');
  assert.equal(probe.getWL().katana, 5, '非父技 katana 保留');
  assert.equal(probe.getWL().fire, 5, '非父技 fire 保留');
  const activeCount = Object.keys(probe.getWL()).filter(k => probe.getWL()[k] > 0).length;
  assert.equal(activeCount, 3, '4 主動 -> 3 主動，淨釋 1 槽');
  assert.deepEqual([...probe.getBuildDuos()], ['duo_inkfire'], '只移除失效 Duo，保留仍合法來源');
  assert.equal(probe.getBarrierPulses().length, 0, 'barrier 殘留清理');
  assert.equal(probe.getSacredSanctuary(), null, '靈陣聖域清理');
  assert.equal(probe.getProj().length, 0, 'boom proj 清理');
  assert.equal(probe.getSplitblasts().length, 0, 'boom splitblasts 清理');
  assert.equal(probe.getWinds().length, 1, '非父技投射必須保留');
  assert.ok(probe.getWT().barrier >= 999999 && probe.getWT().boom >= 999999, '父技計時停攻');

  // 父技停攻：後方靶不在封陣落點，0.6s 內不得再吃到 barrier/boom。
  const rear = enemyAt(probe, -100, 0);
  probe.setEnemies([rear]);
  probe.update(0.6);
  assert.equal(rear.hp, 1000, '融合後父技不得再攻擊');

  probe.start('rain-port');
  assert.equal(probe.getState(), 'play');
  assert.equal(FUSION.getState().state, 'idle');
  assert.equal(probe.getFusionEffects().length, 0, '重開清空融合特效');
  assert.equal(probe.getWL().fusion_exorcistseal, 0, '重開清空合武');
  assert.equal(Object.keys(probe.getWL()).filter(k => probe.getWL()[k] > 0).length, 1, '重開回到初始單妖刀');
});

// ---------------------------------------------------------------------------
// 3. 雷狐居合：真線性命中、預警、去重、負向與目標上限
// ---------------------------------------------------------------------------
test('M2-FUSION-3: foxiai real linear hit, warn, dedupe, negatives and maxTargets', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const p = equipFusion(probe, 'fusion_foxiai');
  const spec = probe.resolveAttackSpec('fusion_foxiai', 1, { WL: { fusion_foxiai: 1 } }, { faceAng: 0 });
  const behind = enemyAt(probe, -120);
  const far = enemyAt(probe, 400);
  const shielded = enemyAt(probe, 150, 0, { shield: true });
  const dead = enemyAt(probe, 160, 0, { hp: 0 });
  const valid = enemyAt(probe, 100, 10);
  probe.setEnemies([behind, far, shielded, dead, valid]);
  withSeed(sandbox, 777, () => {
    probe.update(0.016);
    const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_foxiai');
    assert.ok(fx, '必須建立雷狐居合特效');
    assert.equal(fx.phase, 'warn', '預警期間不得先扣血');
    assert.equal(valid.hp, 1000);
    probe.update(0.2);
  });
  const dmg = 1000 - valid.hp;
  assert.ok(dmg > 0, '正面合法靶必須真扣血');
  assert.ok(dmg >= spec.damage - 0.01 && dmg <= spec.damage * 1.8 + 0.01,
    `真傷 ${dmg} 必須落在 base ${spec.damage} ~ 1.8x`);
  for (const [label, e, hp] of [
    ['後方', behind, 1000], ['超射程', far, 1000], ['護盾', shielded, 1000], ['死亡', dead, 0]
  ]) assert.equal(e.hp, hp, `${label}目標不得受傷`);
  const stats = probe.getFusionStats().byKind.fusion_foxiai;
  assert.equal(stats.casts, 1);
  assert.equal(stats.hits, 1, '每 cast 同敵一次');
  const afterHit = valid.hp;
  probe.update(0.5);
  assert.equal(valid.hp, afterHit, '同一特效不得重複命中');

  // 目標上限：五個直線靶只取最近四個。
  const p2 = equipFusion(probe, 'fusion_foxiai');
  assert.equal(p2, probe.getPlayer());
  const line = [60, 90, 120, 150, 180].map(dx => enemyAt(probe, dx));
  probe.setEnemies(line);
  withSeed(sandbox, 777, () => {
    probe.update(0.016);
    probe.update(0.2);
  });
  assert.equal(line.slice(0, 4).filter(e => e.hp < 1000).length, 4, '四個最近目標必須命中');
  assert.equal(line[4].hp, 1000, '第五目標超出 maxTargets');
});

// ---------------------------------------------------------------------------
// 4. 退魔符刃：前向扇形斬 + 獨立延遲符爆，負向與上限
// ---------------------------------------------------------------------------
test('M2-FUSION-4: exorcistblade real slash then delayed burst, negatives and maxTargets', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const p = equipFusion(probe, 'fusion_exorcistblade');
  const spec = probe.resolveAttackSpec('fusion_exorcistblade', 1, { WL: { fusion_exorcistblade: 1 } }, { faceAng: 0 });
  const behind = enemyAt(probe, -120);
  const far = enemyAt(probe, 320);
  const shielded = enemyAt(probe, 120, 0, { shield: true });
  const dead = enemyAt(probe, 130, 0, { hp: 0 });
  const valid = enemyAt(probe, 100, 0);
  const secondary = enemyAt(probe, 130, 0);
  probe.setEnemies([behind, far, shielded, dead, valid, secondary]);
  withSeed(sandbox, 777, () => {
    probe.update(0.016);
    const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_exorcistblade');
    assert.ok(fx, '必須建立退魔符刃特效');
    assert.equal(fx.marks.length, 2, '兩個合法目標各留一印');
    const slash = 1000 - valid.hp;
    assert.ok(slash > 0, '斬擊必須即時真扣血');
    assert.ok(slash >= spec.slashDmg - 0.01 && slash <= spec.slashDmg * 1.8 + 0.01,
      `斬擊 ${slash} 必須落在 ${spec.slashDmg} ~ 1.8x`);
    const afterSlash = valid.hp;
    const secondaryAfterSlash = secondary.hp;
    for (const [label, e, hp] of [
      ['後方', behind, 1000], ['超射程', far, 1000], ['護盾', shielded, 1000], ['死亡', dead, 0]
    ]) assert.equal(e.hp, hp, `${label}目標不得受斬擊`);
    probe.update(0.3);
    const burst = afterSlash - valid.hp;
    assert.ok(burst > 0, '延遲符爆必須真扣血');
    assert.ok(burst >= spec.burstDmg - 0.01, `符爆 ${burst} 不低於 base ${spec.burstDmg}`);
    assert.ok(secondary.hp < secondaryAfterSlash, '相鄰目標必須吃到濺射符爆');
    for (const [label, e, hp] of [
      ['後方', behind, 1000], ['超射程', far, 1000], ['護盾', shielded, 1000], ['死亡', dead, 0]
    ]) assert.equal(e.hp, hp, `${label}目標不得受符爆`);
  });
  const stats = probe.getFusionStats().byKind.fusion_exorcistblade;
  assert.equal(stats.casts, 1);
  assert.ok(stats.hits >= 3, '斬擊、主符爆、濺射應分開記傷');

  equipFusion(probe, 'fusion_exorcistblade');
  const six = [60, 70, 80, 90, 100, 110].map(dx => enemyAt(probe, dx));
  probe.setEnemies(six);
  withSeed(sandbox, 777, () => probe.update(0.016));
  assert.equal(six.filter(e => e.hp < 1000).length, 4, '斬擊 maxTargets=4，不得只靠欄位宣告');
  assert.equal(probe.getFusionEffects().find(f => f.kind === 'fusion_exorcistblade').marks.length, 4);
});

// ---------------------------------------------------------------------------
// 5. 妖火結界：真脈衝、max1 域、Boss 不擊退、負向
// ---------------------------------------------------------------------------
test('M2-FUSION-5: foxfirebarrier real pulses, max one field, normal knockback, boss control immunity', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  equipFusion(probe, 'fusion_foxfirebarrier');
  const spec = probe.resolveAttackSpec('fusion_foxfirebarrier', 1, { WL: { fusion_foxfirebarrier: 1 } });
  const boss = enemyAt(probe, 80, 0, { type: 'boss', hp: 5000, max: 5000, r: 40, bossIndex: 3, stageId: 'rain-port', bossTheme: 'harbor' });
  const normal = enemyAt(probe, 60);
  const shielded = enemyAt(probe, 70, 0, { shield: true });
  const dead = enemyAt(probe, 70, 0, { hp: 0 });
  const outside = enemyAt(probe, 250);
  probe.setEnemies([boss, normal, shielded, dead, outside]);
  withSeed(sandbox, 777, () => {
    probe.update(0.016);
    assert.equal(normal.hp, 1000, '預警前不得扣血');
    assert.equal(probe.getFusionEffects().filter(f => f.kind === 'fusion_foxfirebarrier').length, 1);
    probe.update(0.15);
    assert.ok(normal.hp < 1000, '第一脈衝必須真扣血');
    assert.ok(boss.hp < 5000, 'Boss 也受傷害');
    assert.equal(shielded.hp, 1000, '護盾不受脈衝傷害');
    assert.equal(dead.hp, 0);
    assert.equal(outside.hp, 1000, '半徑外不受傷害');
    assert.ok(Array.isArray(normal.knockQueue) && normal.knockQueue.length > 0, '普通怪首碰必須擊退');
    assert.equal(boss.knockQueue, undefined, 'Boss 不得被擊退/永久控');
    // 域存在時重置冷卻也不得開啟第二域。
    probe.getWT().fusion_foxfirebarrier = 0;
    probe.update(0.02);
    assert.equal(probe.getFusionEffects().filter(f => f.kind === 'fusion_foxfirebarrier').length, 1, 'max 1 域');
    probe.update(1.1);
  });
  const stats = probe.getFusionStats().byKind.fusion_foxfirebarrier;
  assert.equal(stats.casts, 1, '被 max1 擋下不得記第二次 cast');
  assert.equal(stats.hits, 8, 'Boss+normal 各四脈衝，共 8 次真命中');
  assert.ok(stats.damage >= spec.damage * 8 - 0.02, `四脈衝總傷 ${stats.damage} 不低於 base×8`);
});

// ---------------------------------------------------------------------------
// 6. 退魔封陣：固定落點、四段真脈衝、max2 域、Boss 無控制、負向
// ---------------------------------------------------------------------------
test('M2-FUSION-6: exorcistseal fixed-point real pulses, max two fields, boss no control, negatives', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const p = equipFusion(probe, 'fusion_exorcistseal');
  const spec = probe.resolveAttackSpec('fusion_exorcistseal', 1, { WL: { fusion_exorcistseal: 1 } }, { faceAng: 0 });
  assert.equal(spec.castRange, 190);
  const boss = enemyAt(probe, 190, 0, { type: 'boss', hp: 5000, max: 5000, r: 40, bossIndex: 3, stageId: 'rain-port', bossTheme: 'harbor' });
  const normal = enemyAt(probe, 210);
  const shielded = enemyAt(probe, 190, 0, { shield: true });
  const dead = enemyAt(probe, 190, 0, { hp: 0 });
  const outside = enemyAt(probe, 400);
  const rear = enemyAt(probe, -100);
  probe.setEnemies([boss, normal, shielded, dead, outside, rear]);
  withSeed(sandbox, 777, () => {
    probe.update(0.016);
    const fx = probe.getFusionEffects().filter(f => f.kind === 'fusion_exorcistseal');
    assert.equal(fx.length, 1);
    assert.ok(Math.abs(fx[0].x - (p.x + 190)) < 0.01 && Math.abs(fx[0].y - p.y) < 0.01, '固定前方落點');
    assert.equal(normal.hp, 1000, '預警前不得扣血');
    probe.update(0.4);
    assert.ok(normal.hp < 1000, '第一段必須真扣血');
    assert.ok(boss.hp < 5000, 'Boss 受真傷');
    assert.equal(shielded.hp, 1000, '護盾不受傷');
    assert.equal(dead.hp, 0);
    assert.equal(outside.hp, 1000, '落點半徑外不受傷');
    assert.equal(rear.hp, 1000, '後方不在固定落點');
    assert.equal(boss.knockQueue, undefined, 'Boss 不得被控制/擊退');
    probe.update(0.8);
  });
  const stats = probe.getFusionStats().byKind.fusion_exorcistseal;
  assert.equal(stats.casts, 1);
  assert.equal(stats.hits, 8, 'Boss+normal 各四段真命中');
  assert.ok(stats.damage >= spec.damage * 8 - 0.02, `四段總傷 ${stats.damage} 不低於 base×8`);

  // max 2 域：第二域可存在，第三域被擋。
  equipFusion(probe, 'fusion_exorcistseal');
  const dummy = enemyAt(probe, 190);
  probe.setEnemies([dummy]);
  withSeed(sandbox, 777, () => {
    probe.update(0.016);
    probe.getWT().fusion_exorcistseal = 0;
    probe.update(0.02);
    assert.equal(probe.getFusionEffects().filter(f => f.kind === 'fusion_exorcistseal').length, 2, '第二域可存在');
    probe.getWT().fusion_exorcistseal = 0;
    probe.update(0.02);
    assert.equal(probe.getFusionEffects().filter(f => f.kind === 'fusion_exorcistseal').length, 2, '第三域被 max2 擋下');
  });
});

// ---------------------------------------------------------------------------
// 7. 通用效果上限、pause 凍結、lost/won/start 清理
// ---------------------------------------------------------------------------
test('M2-FUSION-7: global FX cap, pause freeze, lost/won/start cleanup', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;

  equipFusion(probe, 'fusion_foxiai');
  const dummy = enemyAt(probe, 100);
  probe.setEnemies([dummy]);
  const effects = probe.getFusionEffects();
  for (let i = 0; i < 12; i++) effects.push({ kind: 'dummy', life: 99, burnAge: 0, warn: 0 });
  probe.getWT().fusion_foxiai = 0;
  probe.update(0.016);
  assert.equal(effects.length, 12, 'FUSION_FX_MAX=12 時不得再新增特效');
  assert.equal(probe.getFusionStats().casts, 0, '被 FX cap 擋下不得記 cast');
  effects.length = 0;

  // pause 凍結：特效時序與傷害都不得推進。
  equipFusion(probe, 'fusion_foxiai');
  const pausedTarget = enemyAt(probe, 100);
  probe.setEnemies([pausedTarget]);
  withSeed(sandbox, 777, () => probe.update(0.016));
  const frozen = probe.getFusionEffects()[0];
  const frozenAge = frozen.burnAge;
  probe.setState('pause');
  probe.update(1.0);
  assert.equal(pausedTarget.hp, 1000, 'pause 不得造成幽靈傷害');
  assert.equal(frozen.burnAge, frozenAge, 'pause 必須凍結特效時序');
  probe.setState('play');
  withSeed(sandbox, 777, () => probe.update(0.2));
  assert.ok(pausedTarget.hp < 1000, '恢復 play 後才結算');

  // lost：真 loseRun 清空融合特效；state 非 play 不再結算。
  equipFusion(probe, 'fusion_foxiai');
  const lostTarget = enemyAt(probe, 100);
  probe.setEnemies([lostTarget]);
  withSeed(sandbox, 777, () => probe.update(0.016));
  assert.equal(probe.getFusionEffects().length, 1);
  probe.loseRun();
  assert.equal(probe.getState(), 'lampout');
  assert.equal(probe.getFusionEffects().length, 0, 'lost 必須清空融合特效');
  const lostHp = lostTarget.hp;
  probe.update(1.0);
  assert.equal(lostTarget.hp, lostHp, 'lost 後不得幽靈傷害');

  // won：真 startVictorySequence 清空融合特效。
  probe.start('rain-port');
  equipFusion(probe, 'fusion_foxiai');
  const wonTarget = enemyAt(probe, 100);
  probe.setEnemies([wonTarget]);
  withSeed(sandbox, 777, () => probe.update(0.016));
  assert.equal(probe.getFusionEffects().length, 1);
  probe.startVictory();
  assert.equal(probe.getState(), 'victory');
  assert.equal(probe.getFusionEffects().length, 0, 'won 必須清空融合特效');

  // start：完整重置效果、統計、合武與 FUSION 狀態。
  probe.start('rain-port');
  equipFusion(probe, 'fusion_foxiai');
  probe.setEnemies([enemyAt(probe, 100)]);
  withSeed(sandbox, 777, () => probe.update(0.016));
  assert.equal(probe.getFusionEffects().length, 1);
  assert.ok(probe.getFusionStats().casts > 0);
  probe.start('rain-port');
  assert.equal(probe.getFusionEffects().length, 0, 'start 必須清空特效');
  assert.equal(probe.getFusionStats().casts, 0, 'start 必須重置統計');
  assert.equal(probe.getWL().fusion_foxiai, 0);
  assert.equal(FUSION.getState().state, 'idle');
});

// ---------------------------------------------------------------------------
// 8. seed777 受控 30s benchmark：四招各對兩父 Lv5；真 update 0.05×600
// ---------------------------------------------------------------------------
test('M2-FUSION-8: seeded 30s controlled benchmark, each fusion >= parents and < 1400 boss HP', () => {
  function runBenchmark(recipeId, mode, parents) {
    const { sandbox } = createFullGameSandbox();
    const probe = sandbox.window.__testProbe;
    probe.start('rain-port');
    probe.setElapsed(100);
    probe.setState('play');
    const wl = loadout(mode === 'fusion'
      ? { [recipeId]: 1 }
      : Object.fromEntries(parents.map(id => [id, 5])));
    probe.setWL(wl);
    probe.getWT()[recipeId] = 0;
    const p = probe.getPlayer();
    p.faceAng = 0;
    p.inv = 9999;
    const startHP = 1400;
    const target = {
      type: 'boss', hp: startHP, max: startHP, x: p.x + 100, y: p.y, r: 20,
      s: 0, speed: 0, attackCd: 1e9, bossIndex: 3, stageId: 'rain-port',
      bossTheme: 'harbor', shield: false
    };
    probe.setEnemies([target]);
    let maxFx = 0;
    const curve = [];
    withSeed(sandbox, 777, () => {
      for (let i = 0; i < 600; i++) {
        target.x = p.x + 100;
        target.y = p.y;
        target.s = target.speed = 0;
        probe.update(0.05);
        maxFx = Math.max(maxFx, probe.getFusionEffects().length);
        if (i % 100 === 99) {
          curve.push({ seconds: (i + 1) * 0.05, damage: Number((startHP - target.hp).toFixed(2)) });
        }
      }
    });
    const stats = probe.getFusionStats();
    return {
      mode,
      damage30s: Number((startHP - target.hp).toFixed(2)),
      dps: Number(((startHP - target.hp) / 30).toFixed(2)),
      maxFx,
      curve,
      stats
    };
  }

  const cases = [
    ['fusion_foxiai', ['katana', 'thunder']],
    ['fusion_exorcistblade', ['katana', 'boom']],
    ['fusion_foxfirebarrier', ['fire', 'barrier']],
    ['fusion_exorcistseal', ['barrier', 'boom']]
  ];
  const report = [];
  for (const [recipeId, parents] of cases) {
    const fusion = runBenchmark(recipeId, 'fusion', parents);
    const parent = runBenchmark(recipeId, 'parents', parents);
    const row = {
      recipeId,
      parents,
      fusionDamage: fusion.damage30s,
      parentDamage: parent.damage30s,
      fusionDps: fusion.dps,
      parentDps: parent.dps,
      fusionMaxFx: fusion.maxFx,
      parentMaxFx: parent.maxFx,
      fusionCurve: fusion.curve,
      fusionStats: fusion.stats.byKind?.[recipeId],
      fusionCasts: fusion.stats.casts
    };
    report.push(row);
    assert.ok(fusion.damage30s >= parent.damage30s,
      `${recipeId} 30s (${fusion.damage30s}) 必須不低於兩父 Lv5 (${parent.damage30s})`);
    assert.ok(fusion.damage30s < 1400,
      `${recipeId} 30s (${fusion.damage30s}) 必須 < 1400，不得受控秒殺`);
    assert.ok(fusion.maxFx <= 12, `${recipeId} FX 峰值 ${fusion.maxFx} 必須 <= 12`);
    assert.equal(fusion.curve.length, 6, `${recipeId} 必須有 6 個 5 秒曲線點`);
    assert.ok(fusion.stats.casts > 0, `${recipeId} 必須真施放`);
    assert.ok(fusion.stats.byKind?.[recipeId]?.damage > 0, `${recipeId} 必須有真目標傷害`);
  }
  console.log('[M2-FUSION benchmark] ' + JSON.stringify(report));
});
