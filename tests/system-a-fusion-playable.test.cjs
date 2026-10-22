// tests/system-a-fusion-playable.test.cjs
// SYS-A-FUSION-PLAYABLE focused Gate：五組待實作合技的真 registry／攻擊 consumer／命中上限／
// 生命週期清理與 renderer 接受面。只驗本票；不跑全庫、不讀音訊、不代替真 Chrome／真機。
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
    vm.runInContext(readJs(dep), sandbox, { filename: dep });
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
      getBuildState: () => getBuildState(),
      getBuildDuos: () => buildDuos,
      setBuildDuos: (duos) => { buildDuos = [...duos]; },
      getBuildMutations: () => buildMutations,
      setBuildMutations: (muts) => { buildMutations = [...muts]; },
      getWinds: () => winds,
      setWinds: (arr) => { winds = [...arr]; },
      getBarrierPulses: () => barrierPulses,
      setBarrierPulses: (arr) => { barrierPulses = [...arr]; },
      getSacredSanctuary: () => sacredSanctuary,
      getProj: () => proj,
      setProj: (arr) => { proj = [...arr]; },
      getSplitblasts: () => splitblasts,
      setSplitblasts: (arr) => { splitblasts = [...arr]; },
      getFusionEffects: () => fusionEffects,
      getFusionStats: () => ({ ...fusionStats, byKind: { ...fusionStats.byKind } }),
      getFusionToken: () => fusionToken,
      getBuildRevision: () => buildRevision,
      start: (id) => start(id),
      getEnemies: () => enemies,
      setEnemies: (arr) => { enemies = [...arr]; },
      getPlayer: () => P,
      update: (dt) => update(dt, false),
      getFusionOpened: () => ({ epoch: fusionOpenedEpoch, revision: fusionOpenedRevision }),
      getBtnFusionHeld: () => ({ ...btnFusionHeld }),
      resolveAttackSpec: (id, lv, build, opt) => resolveAttackSpec(id, lv, build, opt),
      loseRun: () => loseRun(),
      startVictory: () => startVictorySequence(),
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

  env.__eventListeners = eventListeners;
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

function damageOf(enemy, hp0 = 1000) {
  return hp0 - enemy.hp;
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
// 1. 十組 registry 全可交易；五組新 runtime 具獨立可辨識 spec
// ---------------------------------------------------------------------------
test('A1: ten recipes implemented/enabled, unique parents, five new specs are distinct', () => {
  const FUSION = require(path.join(ROOT, 'js', 'fusion.js'));
  FUSION.reset();
  const ids = [
    'fusion_inkblade', 'fusion_slashwheel', 'fusion_foxiai', 'fusion_exorcistblade',
    'fusion_foxfirebarrier', 'fusion_foxthunderlantern', 'fusion_flamefestival',
    'fusion_thundercircle', 'fusion_exorcistseal', 'fusion_thundertalisman'
  ];
  assert.deepEqual(Object.keys(FUSION.RECIPES), ids, '十組固定 ID 與順序保留');

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
  const pairs = new Set();
  for (const id of ids) {
    const recipe = FUSION.RECIPES[id];
    assert.equal(recipe.id, id);
    assert.deepEqual([...recipe.parents], expectedParents[id], `${id} parents 固定`);
    assert.notEqual(recipe.parents[0], recipe.parents[1], `${id} 不得自我配對`);
    const pair = [...recipe.parents].sort().join(',');
    assert.ok(!pairs.has(pair), `${pair} 不得重複配方`);
    pairs.add(pair);
    assert.equal(recipe.implemented, true, `${id} 有真 consumer，必須 implemented`);
    assert.equal(recipe.enabled, true, `${id} 有真 consumer，必須 enabled`);
    const newFive = ['fusion_slashwheel', 'fusion_foxthunderlantern', 'fusion_flamefestival', 'fusion_thundercircle', 'fusion_thundertalisman'];
    if (newFive.includes(id)) {
      assert.equal(recipe.status, 'TECH_PENDING', `${id} 只可 TECH_PENDING（無新核准圖）`);
    }
  }
  assert.equal(pairs.size, 10);

  const allParentsLv5 = {
    WL: { katana: 5, fire: 5, barrier: 5, thunder: 5, boom: 5, needle: 0 },
    ownedActiveCount: 5
  };
  assert.deepEqual(
    FUSION.getEligibleRecipes(allParentsLv5).map(r => r.id),
    ids,
    '十組皆可進 eligible viewModel'
  );
  FUSION.reset();
  FUSION.bindGame(null);

  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const build = { WL: {} };
  const specs = {};
  for (const id of ['fusion_slashwheel', 'fusion_foxthunderlantern', 'fusion_flamefestival', 'fusion_thundercircle', 'fusion_thundertalisman']) {
    const spec = probe.resolveAttackSpec(id, 1, build, { faceAng: 0 });
    specs[id] = spec;
    assert.equal(spec.skillId, id);
    assert.equal(spec.source, 'fusion');
    assert.equal(spec.derivationDepth, 0);
    assert.ok(spec.cooldown >= 2.0 && spec.cooldown <= 2.4, `${id} 獨立冷卻`);
  }
  assert.ok(specs.fusion_slashwheel.bands.length === 2, '斬界輪必須有內外雙環');
  assert.equal(specs.fusion_foxthunderlantern.count, 3, '狐雷天燈三盞');
  assert.equal(specs.fusion_flamefestival.count, 4, '炎符祭四符');
  assert.ok(specs.fusion_flamefestival.emberTicks === 2, '炎符祭短期燼');
  assert.equal(specs.fusion_thundercircle.pulseCount, 5, '雷陣封界五脈衝');
  assert.equal(specs.fusion_thundertalisman.count, 5, '雷符神罰五符');
  assert.equal(specs.fusion_thundertalisman.chainScale, 0.5, '單次連鎖半傷');
});

// ---------------------------------------------------------------------------
// 2. 斬界輪：360 度擴散雙環、每環每敵一次、負向與 Boss 不受控
// ---------------------------------------------------------------------------
test('A2: slashwheel real 360 dual-ring damage, dedupe, negatives, boss no control', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  equipFusion(probe, 'fusion_slashwheel');
  const inner = enemyAt(probe, 150);
  const outer = enemyAt(probe, 320);
  const behind = enemyAt(probe, -150);
  const outside = enemyAt(probe, 430);
  const shielded = enemyAt(probe, 150, 30, { shield: true });
  const dead = enemyAt(probe, 150, -30, { hp: 0 });
  const boss = enemyAt(probe, 0, 160, { type: 'boss', hp: 10000, max: 10000 });
  probe.setEnemies([inner, outer, behind, outside, shielded, dead, boss]);

  withSeed(sandbox, 777, () => {
    probe.update(0.02);
    const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_slashwheel');
    assert.ok(fx, '必須建立斬界輪特效');
    assert.equal(fx.phase, 'warn');
    assert.equal(inner.hp, 1000, '預警期不得先扣血');
    advance(probe, 0.22);
    assert.ok(damageOf(inner) > 0, '內環必須命中 150px 目標');
    assert.ok(damageOf(behind) > 0, '斬界輪為 360 度，後方 150px 亦命中');
    assert.equal(outer.hp, 1000, '外環尚未抵達前不得先扣血');
    advance(probe, 0.3);
    assert.ok(damageOf(outer) > 0, '外環必須命中 320px 目標');
    assert.ok(damageOf(boss, 10000) > 0, 'Boss 只吃傷害');
    assert.equal(outside.hp, 1000, '半徑外不得命中');
    assert.equal(shielded.hp, 1000, '護盾不得被 fusion 直傷穿透');
    assert.equal(dead.hp, 0, '死亡目標不得再扣血');
    assert.ok(fx.bands.every(b => b.fired), '內外雙環都觸發');
  });

  const innerAfter = inner.hp;
  const outerAfter = outer.hp;
  probe.update(1.2);
  assert.equal(probe.getFusionEffects().length, 0, '特效 TTL 清理');
  assert.equal(inner.hp, innerAfter, '同環同敵只命中一次');
  assert.equal(outer.hp, outerAfter, '外環同敵只命中一次');
  assert.ok(!boss.knockQueue || boss.knockQueue.length === 0, 'Boss 不受擊退控制');
  const stats = probe.getFusionStats();
  assert.equal(stats.byKind.fusion_slashwheel.casts, 1);
  assert.ok(stats.byKind.fusion_slashwheel.hits >= 4, '四個合法目標都應記錄命中');
});

// ---------------------------------------------------------------------------
// 3. 狐雷天燈：三燈鎖定三目標、預警落雷、濺射上限、去重
// ---------------------------------------------------------------------------
test('A3: foxthunderlantern locks three targets, warn strike, splash cap and dedupe', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  equipFusion(probe, 'fusion_foxthunderlantern');
  const near = enemyAt(probe, 60);
  const mid = enemyAt(probe, 200);
  const far = enemyAt(probe, 260);
  const outside = enemyAt(probe, 520);
  const shielded = enemyAt(probe, 80, 20, { shield: true });
  const dead = enemyAt(probe, 90, -20, { hp: 0 });
  probe.setEnemies([near, mid, far, outside, shielded, dead]);

  withSeed(sandbox, 777, () => {
    probe.update(0.02);
    const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_foxthunderlantern');
    assert.ok(fx, '必須建立狐雷天燈特效');
    assert.equal(fx.lanterns.length, 3, '三盞燈籠');
    assert.equal(near.hp, 1000, '預警期間不得先扣血');
    advance(probe, 0.55);
    assert.ok(damageOf(near) > 0, '第一燈必須命中最近目標');
    advance(probe, 0.2);
    assert.ok(damageOf(mid) > 0, '第二燈必須命中第二目標');
    advance(probe, 0.15);
    assert.ok(damageOf(far) > 0, '第三燈必須命中第三目標');
    assert.equal(outside.hp, 1000, '鎖定範圍外不得命中');
    assert.equal(shielded.hp, 1000, '護盾不得被穿透');
    assert.equal(dead.hp, 0);
    assert.equal(fx.lanterns.filter(l => l.struck).length, 3, '三燈都完成落雷');
  });

  const snapshot = [near.hp, mid.hp, far.hp];
  advance(probe, 0.9);
  assert.deepEqual([near.hp, mid.hp, far.hp], snapshot, '每燈每敵只命中一次（未到下一輪冷卻）');
  assert.equal(probe.getFusionEffects().length, 0, '特效 TTL 清理');
  const stats = probe.getFusionStats().byKind.fusion_foxthunderlantern;
  assert.equal(stats.casts, 1);
  assert.ok(stats.hits >= 3 && stats.hits <= 9, '每燈最多 3 體、三燈共 9 次上限');
});

// ---------------------------------------------------------------------------
// 4. 炎符祭：四符交錯引爆、兩次短燼、派生上限與負向
// ---------------------------------------------------------------------------
test('A4: flamefestival four staggered explosions, bounded embers, negatives', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const p = equipFusion(probe, 'fusion_flamefestival');
  const spec = probe.resolveAttackSpec('fusion_flamefestival', 1, { WL: {} }, { faceAng: 0 });
  const points = [];
  for (let i = 0; i < 4; i++) {
    const ang = (i - 1.5) * 0.42;
    const travel = 150 + i * 40;
    points.push({ x: Math.cos(ang) * travel, y: Math.sin(ang) * travel });
  }
  const enemies = points.map(pt => enemyAt(probe, pt.x, pt.y));
  const shielded = enemyAt(probe, points[0].x, points[0].y + 18, { shield: true });
  const dead = enemyAt(probe, points[1].x, points[1].y - 18, { hp: 0 });
  const behind = enemyAt(probe, -200);
  const outside = enemyAt(probe, 600);
  probe.setEnemies([...enemies, shielded, dead, behind, outside]);

  withSeed(sandbox, 777, () => {
    probe.update(0.02);
    const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_flamefestival');
    assert.ok(fx, '必須建立炎符祭特效');
    assert.equal(fx.talismans.length, 4);
    assert.equal(enemies[0].hp, 1000, '預警期不得先扣血');
    advance(probe, 1.55);
    for (let i = 0; i < enemies.length; i++) {
      assert.ok(damageOf(enemies[i]) > 0, `第 ${i + 1} 枚火符落點目標必須被引爆命中`);
    }
    assert.equal(shielded.hp, 1000, '護盾不得被穿透');
    assert.equal(dead.hp, 0);
    assert.equal(behind.hp, 1000, '後方非落點不得命中');
    assert.equal(outside.hp, 1000, '範圍外不得命中');
    assert.equal(fx.talismans.filter(t => t.exploded).length, 4, '四符都引爆');
    assert.ok(fx.embers.length <= 8, '短燼派生上限 8');
    assert.ok(fx.embers.every(em => em.ticksLeft === 0), '兩次短燼已耗盡，不得無限派生');
    // 落點半徑 62 可重疊：單敵最多 2 次近鄰爆擊 + 4 次近鄰短燼（每燼 2 tick，上限 8 燼）。
    const perEnemyMax = (2 * spec.damage + 4 * spec.emberDamage) * 1.8 + 0.01;
    for (const e of enemies) {
      assert.ok(damageOf(e) <= perEnemyMax, '單一敵人單次炎符祭傷害有上限');
    }
  });

  const snapshot = enemies.map(e => e.hp);
  advance(probe, 0.4);
  assert.deepEqual(enemies.map(e => e.hp), snapshot, '派生結束後不得再扣血（未到下一輪冷卻）');
  assert.equal(probe.getFusionEffects().length, 0, '特效 TTL 清理');
  const stats = probe.getFusionStats().byKind.fusion_flamefestival;
  assert.equal(stats.casts, 1);
  assert.ok(stats.hits >= 4, '四符至少各命中一次');
  assert.ok(p.inv > 0, '受控測試玩家仍具無敵幀，屬合法 fixture 非自然局');
});

// ---------------------------------------------------------------------------
// 5. 雷陣封界：單一大型陣域、五脈衝、警示落雷、Boss 不受控
// ---------------------------------------------------------------------------
test('A5: thundercircle single field, five warned pulses, max one field, boss no control', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  equipFusion(probe, 'fusion_thundercircle');
  const a = enemyAt(probe, 100);
  const b = enemyAt(probe, 180);
  const outside = enemyAt(probe, 300);
  const shielded = enemyAt(probe, 120, 20, { shield: true });
  const boss = enemyAt(probe, 0, 200, { type: 'boss', hp: 10000, max: 10000 });
  probe.setEnemies([a, b, outside, shielded, boss]);

  withSeed(sandbox, 777, () => {
    probe.update(0.02);
    const fx = probe.getFusionEffects().filter(f => f.kind === 'fusion_thundercircle');
    assert.equal(fx.length, 1, '一次只允許一座雷陣');
    assert.equal(a.hp, 1000, '警示期不得先扣血');
    advance(probe, 0.55);
    assert.equal(a.hp, 1000, '第一波警示 0.6 秒內不得先扣血');
    advance(probe, 0.6);
    assert.ok(damageOf(a) > 0 || damageOf(b) > 0, '第一波警示後必須落雷');
    advance(probe, 2.0);
    assert.ok(probe.getFusionEffects().filter(f => f.kind === 'fusion_thundercircle').length === 1, '陣域存續中不得重疊第二座');
    probe.getWT().fusion_thundercircle = 999999; // 停止再施放，只驗第一座 TTL
    advance(probe, 2.6);
  });

  assert.ok(damageOf(a) > 0, '近敵必須被多波命中');
  assert.ok(damageOf(b) > 0, '次近敵必須被多波命中');
  assert.ok(damageOf(boss, 10000) > 0, 'Boss 只吃落雷傷害');
  assert.equal(outside.hp, 1000, '陣域半徑外不得命中');
  assert.equal(shielded.hp, 1000, '護盾不得被穿透');
  assert.ok(!boss.knockQueue || boss.knockQueue.length === 0, 'Boss 不受控場');
  assert.equal(probe.getFusionEffects().length, 0, '陣域 TTL 清理');
  const stats = probe.getFusionStats().byKind.fusion_thundercircle;
  assert.equal(stats.casts, 1);
  assert.ok(stats.hits >= 8, '五波多目標落雷應有足量真命中');
});

// ---------------------------------------------------------------------------
// 6. 雷符神罰：五符落雷、單次連鎖、上限、去重與負向
// ---------------------------------------------------------------------------
test('A6: thundertalisman five warned strikes, one chain per hit, bounded damage', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  equipFusion(probe, 'fusion_thundertalisman');
  const points = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i - 2) * 0.26;
    const travel = 140 + (i % 3) * 50;
    points.push({ x: Math.cos(ang) * travel, y: Math.sin(ang) * travel });
  }
  const direct = points.map(pt => enemyAt(probe, pt.x, pt.y));
  const chainTarget = enemyAt(probe, points[0].x + 70, points[0].y);
  const shielded = enemyAt(probe, points[1].x, points[1].y + 18, { shield: true });
  const dead = enemyAt(probe, points[2].x, points[2].y + 18, { hp: 0 });
  const outside = enemyAt(probe, 600);
  const boss = enemyAt(probe, points[4].x, points[4].y + 10, { type: 'boss', hp: 10000, max: 10000 });
  probe.setEnemies([...direct, chainTarget, shielded, dead, outside, boss]);

  withSeed(sandbox, 777, () => {
    probe.update(0.02);
    const fx = probe.getFusionEffects().find(f => f.kind === 'fusion_thundertalisman');
    assert.ok(fx, '必須建立雷符神罰特效');
    assert.equal(fx.talismans.length, 5);
    assert.equal(direct[0].hp, 1000, '預警期不得先扣血');
    advance(probe, 1.9);
    for (let i = 0; i < direct.length; i++) {
      assert.ok(damageOf(direct[i]) > 0, `第 ${i + 1} 枚雷符落點目標必須被命中`);
    }
    assert.ok(damageOf(chainTarget) > 0, '相鄰目標必須吃到單次連鎖');
    assert.ok(damageOf(boss, 10000) > 0, 'Boss 只吃傷害');
    assert.equal(shielded.hp, 1000, '護盾不得被穿透');
    assert.equal(dead.hp, 0);
    assert.equal(outside.hp, 1000, '範圍外不得命中');
    assert.ok(fx.arcs.length >= 1, '連鎖必須留下實際 arc 證據');
    assert.ok(fx.arcs.length <= 5, '每符最多一次連鎖，不得二次派生');
    assert.ok(fx.talismans.every(t => t.struck), '五符都完成落雷');
  });

  assert.ok(!boss.knockQueue || boss.knockQueue.length === 0, 'Boss 不受控場');
  const snapshot = direct.map(e => e.hp);
  advance(probe, 0.4);
  assert.deepEqual(direct.map(e => e.hp), snapshot, '同符同敵只命中一次（未到下一輪冷卻）');
  assert.equal(probe.getFusionEffects().length, 0, '特效 TTL 清理');
  const stats = probe.getFusionStats().byKind.fusion_thundertalisman;
  assert.equal(stats.casts, 1);
  assert.ok(stats.hits >= 6, '五符＋至少一次連鎖');
});

// ---------------------------------------------------------------------------
// 7. 完整交易生命週期：五組各自 4->3、父技停攻、取消零扣、Boss 一次、清理
// ---------------------------------------------------------------------------
test('A7: full transaction lifecycle for all five new fusions, cancel, once-per-run, cleanup', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  const FUSION = sandbox.window.FUSION;
  const cases = {
    fusion_slashwheel: { parents: ['katana', 'barrier'], keep: ['fire', 'boom'], duos: ['duo_cinderseal'] },
    fusion_foxthunderlantern: { parents: ['fire', 'thunder'], keep: ['katana', 'boom'], duos: [] },
    fusion_flamefestival: { parents: ['fire', 'boom'], keep: ['katana', 'barrier'], duos: [] },
    fusion_thundercircle: { parents: ['barrier', 'thunder'], keep: ['katana', 'fire'], duos: ['duo_inkfire'] },
    fusion_thundertalisman: { parents: ['thunder', 'boom'], keep: ['katana', 'barrier'], duos: [] }
  };

  for (const [id, def] of Object.entries(cases)) {
    probe.start('rain-port');
    probe.setElapsed(380);
    probe.setWL(loadout(Object.fromEntries([...def.parents, ...def.keep].map(k => [k, 5]))));
    probe.getWT()[def.parents[0]] = 0;
    probe.getWT()[def.parents[1]] = 0;
    probe.setBuildDuos(['duo_inkfire', 'duo_cinderseal']);
    const beforeWL = { ...probe.getWL() };

    assert.equal(FUSION.onBossDeath({ type: 'boss', x: 200, y: 300 }), true, `${id} 應取得繪馬`);
    assert.equal(FUSION.pickupTalisman(), true);
    probe.dispatchKey('KeyF');
    assert.equal(probe.getState(), 'fusion');

    if (id === 'fusion_slashwheel') {
      // 取消零扣（新配方面板），再重開保持持有。
      const opened = probe.getFusionOpened();
      const sel = FUSION.selectRecipe(id, opened.epoch, opened.revision);
      assert.equal(sel.ok, true, '新配方必須可選');
      probe.dispatchKey('Escape', 'Escape');
      assert.equal(probe.getState(), 'play');
      assert.equal(FUSION.getState().state, 'held');
      assert.deepEqual({ ...probe.getWL() }, beforeWL, '取消不得扣任何技能');
      probe.dispatchKey('KeyF');
    }

    // 用真 UI consumer：鍵盤移到目標卡、Enter 選取、點 confirm。
    const view = FUSION.getViewModel();
    const eligibleIds = view.eligibleRecipes.map(r => r.id);
    const idx = eligibleIds.indexOf(id);
    assert.ok(idx >= 0, `${id} 必須在 eligible 面板`);
    for (let i = 0; i < idx; i++) probe.dispatchKey('ArrowRight', 'ArrowRight');
    probe.dispatchKey('Enter', 'Enter');
    assert.equal(FUSION.getState().selectedRecipeId, id, `${id} 選取成功`);
    const layout = sandbox.window.UI.fusionLayout(null, FUSION.getViewModel());
    const confirm = layout.buttons.find(b => b.id === 'confirm');
    assert.ok(confirm, 'UI 必須提供 confirm');
    probe.pointerDown(confirm.x + confirm.w / 2, confirm.y + confirm.h / 2, 'touch');
    assert.equal(FUSION.getState().state, 'fused', `${id} UI 確認完成交易`);

    const wl = probe.getWL();
    assert.equal(wl[id], 1, `${id} 裝備`);
    for (const parent of def.parents) {
      assert.equal(wl[parent], 0, `${id} 父技 ${parent} 歸零`);
      assert.ok(probe.getWT()[parent] >= 999999, `${id} 父技 ${parent} 停攻`);
    }
    for (const keep of def.keep) assert.equal(wl[keep], 5, `${id} 非父技 ${keep} 保留`);
    const active = Object.keys(wl).filter(k => wl[k] > 0);
    assert.equal(active.length, 3, `${id} 4 主動 → 3 主動，淨釋 1 槽`);
    assert.equal(probe.getBuildState().ownedActiveCount, 3, 'WI 必須計入新合武');
    assert.deepEqual([...probe.getBuildDuos()], def.duos, '失效 Duo 移除、合法 Duo 保留');
    assert.equal(FUSION.onBossDeath({ type: 'boss', x: 1, y: 1 }), false, `${id} 每局一次`);
    assert.equal(FUSION.pickupTalisman(), false, `${id} 已融合不得再取得繪馬`);
    assert.equal(probe.getState(), 'play');

    // 新合武真的開火，並在死亡/重開時清空。
    const target = enemyAt(probe, 110);
    probe.setEnemies([target]);
    probe.getWT()[id] = 0;
    withSeed(sandbox, 777, () => probe.update(0.05));
    assert.ok(probe.getFusionEffects().some(f => f.kind === id), `${id} 必須有真特效 consumer`);
    probe.loseRun();
    assert.equal(probe.getFusionEffects().length, 0, `${id} 死亡清空特效`);
    probe.start('rain-port');
    assert.equal(probe.getWL()[id], 0, `${id} 重開清空合武`);
    assert.equal(probe.getFusionEffects().length, 0, `${id} 重開清空特效`);
    assert.equal(FUSION.getState().state, 'idle', `${id} 重開重置融合狀態`);
  }
});

// ---------------------------------------------------------------------------
// 8b. 暫停／升級題板凍結、勝利清空、重開歸零
// ---------------------------------------------------------------------------
test('A9: pause/levelup freeze new fusion effects, victory clears, restart resets', () => {
  const { sandbox } = createFullGameSandbox();
  const probe = sandbox.window.__testProbe;
  equipFusion(probe, 'fusion_foxthunderlantern');
  const target = enemyAt(probe, 60);
  probe.setEnemies([target]);

  withSeed(sandbox, 777, () => {
    probe.update(0.02);
    assert.equal(probe.getFusionEffects().length, 1, '先建立狐雷天燈特效');
    probe.setState('pause');
    advance(probe, 1.2);
    assert.equal(target.hp, 1000, 'pause 期間不得落雷扣血');
    assert.equal(probe.getFusionEffects().length, 1, 'pause 凍結而非提前命中');
    probe.setState('levelup');
    advance(probe, 1.2);
    assert.equal(target.hp, 1000, '升級題板期間不得落雷扣血');
    probe.setState('play');
    advance(probe, 0.7);
    assert.ok(damageOf(target) > 0, '回到 play 後才恢復既有排程');
  });

  probe.start('rain-port');
  probe.setElapsed(100);
  probe.setWL(loadout({ fusion_foxthunderlantern: 1 }));
  probe.getWT().fusion_foxthunderlantern = 0;
  probe.setEnemies([enemyAt(probe, 80)]);
  withSeed(sandbox, 777, () => probe.update(0.02));
  assert.equal(probe.getFusionEffects().length, 1);
  probe.startVictory();
  assert.equal(probe.getState(), 'victory');
  assert.equal(probe.getFusionEffects().length, 0, '勝利結算清空合技特效');

  probe.start('rain-port');
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getWL().fusion_foxthunderlantern, 0, '重開清空合武');
  assert.equal(probe.getFusionEffects().length, 0, '重開清空特效');
});

// ---------------------------------------------------------------------------
// 8. Renderer 接受四種新 kind，未知 kind 仍拒收
// ---------------------------------------------------------------------------
test('A8: renderer drawFusionFx accepts new kinds with TECH placeholder', () => {
  const calls = [];
  const ctx = {
    save: () => calls.push('save'), restore: () => calls.push('restore'),
    translate: () => {}, rotate: () => {}, scale: () => {},
    beginPath: () => {}, closePath: () => {}, moveTo: () => {}, lineTo: () => {},
    arc: () => {}, quadraticCurveTo: () => {}, stroke: () => {}, fill: () => {},
    fillRect: () => {}, strokeRect: () => {}, fillText: () => calls.push('text'),
    strokeText: () => {}, drawImage: () => {}, setTransform: () => {}, clearRect: () => {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null
  };
  const env = {
    console, Math, Date, JSON, Set, Map, Number, Array, Object, String,
    matchMedia: () => ({ matches: false }),
    innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    document: { createElement: () => ({ getContext: () => ctx, width: 0, height: 0, style: {} }) }
  };
  env.window = env;
  env.self = env;
  const sandbox = vm.createContext(env);
  vm.runInContext(readJs('renderer.js'), sandbox, { filename: 'renderer.js' });
  const RENDERER = sandbox.RENDERER;
  assert.ok(RENDERER && typeof RENDERER.drawFusionFx === 'function');

  const base = { x: 100, y: 100, phase: 'active', progress: 0.5, seed: 3, life: 1, burnAge: 0.2 };
  const effects = [
    { kind: 'fusion_slashwheel', radius: 320, currentRadius: 200, bands: [{ at: 150 }, { at: 320 }] },
    { kind: 'fusion_foxthunderlantern', lanterns: [{ x: 90, y: 80, fromX: 90, fromY: 80, targetX: 140, targetY: 140, struck: true, delay: 0.5 }], strikeRadius: 64 },
    { kind: 'fusion_flamefestival', talismans: [{ x: 130, y: 120, fromX: 100, fromY: 100, targetX: 160, targetY: 140, exploded: true, delay: 0.4 }], embers: [{ x: 130, y: 120, ticksLeft: 1 }], landRadius: 62, emberRadius: 48, emberTicks: 2 },
    { kind: 'fusion_thundertalisman', talismans: [{ x: 150, y: 100, fromX: 100, fromY: 100, targetX: 180, targetY: 100, struck: true, delay: 0.4 }], arcs: [{ x1: 150, y1: 100, x2: 200, y2: 120 }], strikeRadius: 70 }
  ];
  for (const effect of effects) {
    assert.equal(RENDERER.drawFusionFx(ctx, { ...base, ...effect }), true, `${effect.kind} 必須被 renderer 接受`);
  }
  assert.ok(calls.filter(c => c === 'text').length >= 4, '必須留下 TECH WAITING_ART 文字占位');
  assert.equal(RENDERER.drawFusionFx(ctx, { ...base, kind: 'fusion_not_real' }), false, '未知 kind 必須拒收');
  assert.equal(RENDERER.drawFusionFx(ctx, null), false);
});
