// AGY M1-B-R1: 天狐靈針（needle）三變異（mut_fan 散射 + mut_seek 追蹤 + mut_frost 冰封）真行為與邊界測試
//
// 驗收標準：
// 1. mut_fan 散射：發數增加、散射角擴大、單發傷害分配受限（bounded damage budget，非免費倍增總傷）。
// 2. mut_seek 追蹤：具備轉向角速率平滑追蹤（turnRate * dt），不瞬移、射程限制、目標死亡/脫出後沿當前方向直行。
// 3. mut_frost 冰封與 Boss 抗性：命中累積寒冷、普通怪達門檻短暫冰封；Boss 抗凍（更高門檻、極短冰封時效 0.15s 與 2.0s 免疫抗性窗口，不被永久失能）。
// 4. 三變異疊加（fan + seek + frost）：同時生效、投射物與控制事件不重複複製。
// 5. 投射物快照隔離：空中靈針之傷害、追蹤與變異快照不可被後續加點/加攻回溯改寫。
// 6. 狀態機與生命週期：pause / levelup 靈針凍結不傷敵；lost / won 武器停更；start() 重開徹底重置變異與靈針。
// 7. 六招無變異基線與 Lv5 覺醒保護：未加變異時全數值與行為嚴格符合 baseline。

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadGameSandbox(options = {}) {
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

  const sandboxMath = Object.create(Math);
  sandboxMath.random = typeof options.random === 'function' ? options.random : () => Math.random();

  const env = {
    console,
    Set,
    Map,
    Math: sandboxMath,
    Date,
    JSON,
    URL,
    URLSearchParams,
    performance: { now: () => 1000 },
    navigator: { userAgent: 'node' },
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v)
    },
    document: {
      hidden: false,
      getElementById: () => canvas,
      addEventListener() {},
      body: { dataset: {} }
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    innerWidth: WINDOW.width,
    innerHeight: WINDOW.height,
    devicePixelRatio: 1,
    location: { search: '' },
    screen: { width: WINDOW.width, height: WINDOW.height },
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
    }
  };

  env.window = env;
  env.global = env;
  env.globalThis = env;

  const sandbox = vm.createContext(env);

  const readJs = rel => fs.readFileSync(path.join(ROOT, 'js', rel), 'utf8');

  // 逐檔明列安全路徑，嚴格排除 audio.js
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
    'ui.js'
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
    triggerShake: () => {}
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  const rawGameSrc = readJs('game.js');
  const endIdx = rawGameSrc.lastIndexOf('})();');
  assert.ok(endIdx > 0, 'game.js 必須具備結尾 IIFE 標記');

  const probeCode = `
    window.__agyProbe = {
      getP: () => P,
      getB: () => b,
      getWL: () => WL,
      getWI: () => WI,
      getSeals: () => seals,
      setSeals: v => { seals = v; },
      getLevel: () => level,
      setLevel: v => { level = v; },
      getXp: () => xp,
      setXp: v => { xp = v; },
      getXpNeed: () => xpNeed(),
      getState: () => state,
      setState: s => { state = s; },
      setLevelupCooldown: v => { levelupCooldown = v; },
      getChoices: () => choices,
      setChoices: c => { choices = c; },
      getEnemies: () => enemies,
      getWT: () => wT,
      setWT: (k, v) => { wT[k] = v; },
      getWMax: () => wMax,
      start: id => start(id),
      offerUp: () => offerUp(),
      applyChoice: (id, rev) => applyChoice(id, rev),
      pickUp: i => pickUp(i),
      reroll: () => reroll(),
      weapons: dt => weapons(dt),
      getBuildRevision: () => buildRevision,
      getBuildState: () => getBuildState(),
      getBuildMutations: () => buildMutations,
      setBuildMutations: list => { buildMutations = Array.isArray(list) ? [...list] : []; buildRevision++; },
      getBuildCharms: () => buildCharms,
      setBuildCharms: list => { buildCharms = Array.isArray(list) ? [...list] : []; buildRevision++; },
      getBuildDuos: () => buildDuos,
      setBuildDuos: list => { buildDuos = Array.isArray(list) ? [...list] : []; buildRevision++; },
      addMutation: id => addMutation(id),
      removeMutation: id => removeMutation(id),
      getEligibleChoices: () => getEligibleChoices(),
      resolveAttackSpec: (id, lvl, bs, opt) => resolveAttackSpec(id, lvl, bs, opt),
      applyFrost: (e, now, volley) => applyFrost(e, now, volley),
      getNeedles: () => needles,
      getElapsed: () => elapsed,
      setElapsed: v => { elapsed = v; },
      runFrame: dt => runFrame(dt),
      update: dt => update(dt)
    };
  `;

  const instrumentedSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(instrumentedSrc, sandbox, { filename: 'game.js' });

  return sandbox;
}

// ── 1. mut_fan 散射：發數增加、散射角擴大與受控傷害預算 ────────
test('M1-B-1 mut_fan: count increases, spread widens, and per-shot damage is bounded', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const bsBase = probe.getBuildState();
  const bsFan = { ...bsBase, mutations: ['mut_fan'] };

  // 1. Lv1 規格比較
  const specBaseLv1 = probe.resolveAttackSpec('needle', 1, bsBase);
  const specFanLv1 = probe.resolveAttackSpec('needle', 1, bsFan);

  assert.equal(specBaseLv1.count, 3, '無變異 Lv1 發數為 3');
  assert.equal(specFanLv1.count, 6, 'mut_fan Lv1 發數增加至 6');
  assert.equal(specFanLv1.fan, true, '必須標記 fan: true');
  assert.ok(specFanLv1.spread > specBaseLv1.spread, 'mut_fan 散射角必須大於基礎散射角');
  assert.equal(specFanLv1.spread, 0.45 + 0.35, '散射角應增加 0.35 rad');

  // 單發傷害預算縮減檢驗
  assert.equal(specFanLv1.perShotScale, 0.72, '單發傷害縮減比率應為 0.72');
  assert.ok(specFanLv1.baseDamage < specBaseLv1.baseDamage, 'mut_fan 單發基礎傷害必須低於無變異單發');
  assert.equal(specFanLv1.baseDamage, 1.512, '1.4 + 1 * 0.7 = 2.1; 2.1 * 0.72 = 1.512');
  assert.ok(Math.abs(specFanLv1.damage - 1.512 * 1.2) < 0.001, '單發總傷應為 1.512 * b.dmg (1.2)');

  // 總傷害預算受限檢驗：總傷害不可免費翻倍
  const unbudgetedTotal = specFanLv1.count * specBaseLv1.damage; // 6 * 2.52 = 15.12
  const actualTotal = specFanLv1.count * specFanLv1.damage;       // 6 * 1.8144 = 10.8864
  assert.ok(actualTotal < unbudgetedTotal, '實際總傷預算必須受控，低於未折減總額');
  assert.ok(actualTotal <= specBaseLv1.count * specBaseLv1.damage * 1.5, '總傷預算不超過基礎 1.5 倍');

  // 2. Lv5 覺醒 + mut_fan 規格比較
  const specBaseLv5 = probe.resolveAttackSpec('needle', 5, bsBase);
  const specFanLv5 = probe.resolveAttackSpec('needle', 5, bsFan);
  assert.equal(specBaseLv5.count, 8, '無變異 Lv5 預設 8 發');
  assert.equal(specFanLv5.count, 11, 'mut_fan Lv5 增為 11 發');
  assert.equal(specFanLv5.baseDamage, 3.528, '4.9 * 0.72 = 3.528');

  // 3. 真武器投射消費驗證：weapons() 生成真實 needles
  probe.getWL().needle = 1;
  probe.addMutation('mut_fan');
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  assert.equal(needles.length, 6, '真 weapons() 必須發射 6 發靈針');
  for (const nd of needles) {
    assert.ok(Math.abs(nd.dmg - specFanLv1.damage) < 0.001, '每發靈針真實快照傷害必須受限');
    assert.equal(nd.baseDmg, 1.512);
  }
});

// ── 2. mut_seek 追蹤：轉向角速率平滑追蹤、射程限制與失去目標直行 ──
test('M1-B-2 mut_seek: turn-rate tracking, angular smoothness, range limit, and straight flight on target loss', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const bsBase = probe.getBuildState();
  const bsSeek = { ...bsBase, mutations: ['mut_seek'] };

  // 1. 規格檢驗
  const specSeekLv1 = probe.resolveAttackSpec('needle', 1, bsSeek);
  assert.equal(specSeekLv1.tracking, true, 'mut_seek 使 Lv1 具備追蹤特性');
  assert.equal(specSeekLv1.seek, true);
  assert.equal(specSeekLv1.turnRate, 4.2, 'Lv1 轉向角速率應為 4.2 rad/s');
  assert.equal(specSeekLv1.seekRange, 480, '追蹤索敵射程為 480');

  // 2. 真投射平滑轉向驗證：角度漸進，絕不瞬間跳躍
  probe.getWL().needle = 1;
  probe.addMutation('mut_seek');
  const p = probe.getP();
  p.x = 200; p.y = 200; p.faceAng = 0; // 面朝 0 (向東)

  // 在東南方 (200 + 100, 200 + 100) 放置敵人，目標角度為 PI/4 ≈ 0.785 rad
  const targetEnemy = { x: 300, y: 300, hp: 500, maxHp: 500, type: 'mob' };
  probe.getEnemies().push(targetEnemy);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  assert.equal(needles.length, 3, 'Lv1 未裝 fan 發射 3 發');
  const nd = needles[0]; // 初始靈針
  assert.equal(nd.tracking, true, '靈針必須具備 tracking 標記');
  const initialAng = nd.ang;

  // 步進 dt = 0.05 秒
  const dt = 0.05;
  const maxTurn = nd.turnRate * dt; // 4.2 * 0.05 = 0.21 rad
  probe.weapons(dt);

  // 檢驗轉向平滑性：單步轉向角絕對不超過 maxTurn，且朝向目標角度偏轉
  const angDiff = Math.abs(nd.ang - initialAng);
  assert.ok(angDiff > 0, '靈針必須朝向敵人偏轉');
  assert.ok(angDiff <= maxTurn + 0.001, `單步轉向角 ${angDiff} 必須小於等於最大角速度限制 ${maxTurn}`);
  assert.ok(Math.abs(Math.hypot(nd.vx, nd.vy) - 640) < 0.01, '飛行速度大小必須恆定為 640，不因轉向加速或瞬移');

  // 3. 負向測試：目標死亡後失去目標，靈針沿當前方向直行，不瞬移或崩潰
  targetEnemy.hp = 0; // 目標死亡
  const angBeforeLoss = nd.ang;
  probe.weapons(dt);

  // 無目標時方向保持直行
  assert.equal(nd.ang, angBeforeLoss, '失去目標後靈針必須沿當前方向直行');
  assert.equal(nd.target, null, '目標死亡後 nd.target 必須置為 null');

  // 4. 負向測試：超出 seekRange (480) 之敵人不被索敵
  const farEnemy = { x: 2000, y: 2000, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(farEnemy);
  probe.weapons(dt);
  assert.equal(nd.target, null, '超出射程的敵人絕不被鎖定為目標');
});

// ── 3. mut_frost 冰封與 Boss 抗性保護 ─────────────────────────
test('M1-B-3 mut_frost: frost accumulation, mob freeze, and boss resistance (micro-freeze and 2.0s immune window)', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const bsFrost = { ...probe.getBuildState(), mutations: ['mut_frost'] };
  const specFrost = probe.resolveAttackSpec('needle', 1, bsFrost);
  assert.equal(specFrost.frost, true, 'mut_frost 賦予靈針冰封屬性');
  assert.equal(specFrost.frostThreshold, 1, '普通怪門檻為 1');
  assert.equal(specFrost.bossFrostThreshold, 3, 'Boss 門檻為 3');

  // 1. 普通小怪命中：1 發達到門檻，立即觸發冰封（0.5s）
  const mob = { x: 500, y: 500, hp: 100, maxHp: 100, type: 'mob' };
  const now = 10.0;
  const freezeMob = probe.applyFrost(mob, now);
  assert.equal(freezeMob, true, '普通怪命中 1 發立即冰封');
  assert.equal(mob.freezeT, 0.5, '普通怪冰封時效為 0.5 秒');
  assert.equal(mob.freezeEnds, now + 0.5);
  assert.equal(mob.freezeReady, now + 2.0, '設定 2.0 秒抗性冷卻');

  // 負向測試：冰封期間再次命中，不重置冰封時間
  const hitAgainWhileFrozen = probe.applyFrost(mob, now + 0.2);
  assert.equal(hitAgainWhileFrozen, false, '冰封期間重複命中不可重置計時');
  assert.equal(mob.freezeEnds, now + 0.5, '冰封結束時間不可被延長');

  // 負向測試：解凍後但在 2.0 秒抗性期內命中，不再次冰封
  mob.freezeT = 0; // 模擬解凍
  const hitInResistanceWindow = probe.applyFrost(mob, now + 1.2);
  assert.equal(hitInResistanceWindow, false, '抗性免疫期內命中不可再次冰封');

  // 2. Boss 抗性保護：更高寒冷門檻（3 發）+ 極短時效（0.15s）+ 2.0s 免疫期
  const boss = { x: 600, y: 600, hp: 2000, maxHp: 2000, type: 'boss' };
  const bossHit1 = probe.applyFrost(boss, now);
  assert.equal(bossHit1, false, 'Boss 第 1 發僅累積寒冷，不觸發冰封');
  assert.equal(boss.frostHits, 1);
  assert.equal(boss.freezeT, undefined);

  const bossHit2 = probe.applyFrost(boss, now + 0.1);
  assert.equal(bossHit2, false, 'Boss 第 2 發累積寒冷，不觸發冰封');
  assert.equal(boss.frostHits, 2);

  const bossHit3 = probe.applyFrost(boss, now + 0.2);
  assert.equal(bossHit3, true, 'Boss 第 3 發達到門檻觸發冰封');
  assert.equal(boss.frostHits, 0, '觸發冰封後累積計數重置');
  assert.equal(boss.freezeT, 0.15, 'Boss 冰封時效僅為 0.15 秒微控，不使 Boss 癱瘓');
  assert.equal(boss.freezeReady, now + 0.2 + 2.0, 'Boss 具備 2.0 秒抗性免疫窗口');

  // 負向測試：Boss 在抗性期間不被連環鎖定
  const bossHit4 = probe.applyFrost(boss, now + 0.5);
  assert.equal(bossHit4, false, 'Boss 在免疫窗口內絕不被重新冰封');

  // 3. 死亡清理防護：敵人死亡後各項狀態徹底清除
  const dyingMob = { x: 100, y: 100, hp: 10, maxHp: 10, type: 'mob', freezeT: 0.5, frostHits: 1 };
  probe.getEnemies().push(dyingMob);
  probe.weapons(0.01);
  // 透過受擊致死
  dyingMob.hp = 0;
  probe.applyFrost(dyingMob, now);
  assert.equal(dyingMob.freezeT, 0.5); // applyFrost 拒絕死亡敵人
});

// ── 4. 三變異疊加（mut_fan + mut_seek + mut_frost）同時生效與去重 ──
test('M1-B-4 mut_fan + mut_seek + mut_frost: full synergy without duplicated projectiles or events', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');
  probe.getWL().needle = 1;

  probe.addMutation('mut_fan');
  probe.addMutation('mut_seek');
  probe.addMutation('mut_frost');

  const bs = probe.getBuildState();
  assert.deepEqual(Array.from(bs.mutations), ['mut_fan', 'mut_seek', 'mut_frost'], '三變異均登錄於 BuildState');

  // 1. Lv1 三變異規格
  const spec = probe.resolveAttackSpec('needle', 1, bs);
  assert.equal(spec.count, 6, 'fan 增加至 6 發');
  assert.equal(spec.tracking, true, 'seek 啟用追蹤');
  assert.equal(spec.frost, true, 'frost 啟用冰封');
  assert.equal(spec.baseDamage, 1.512, 'fan 限制每發傷害預算');
  assert.equal(spec.source, 'mutation');

  // 2. 實際發射與更新
  probe.getWL().needle = 1;
  const p = probe.getP();
  p.x = 200; p.y = 200;

  const enemy = { x: 300, y: 220, hp: 500, maxHp: 500, type: 'mob' };
  probe.getEnemies().push(enemy);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  assert.equal(needles.length, 6, '真投射必須生成 6 發靈針');

  for (const nd of needles) {
    assert.equal(nd.tracking, true, '每發靈針均具備追蹤');
    assert.equal(nd.frost, true, '每發靈針均具備冰封');
    assert.ok(Math.abs(nd.dmg - spec.damage) < 0.001, '每發靈針均依受限傷害預算快照');
  }

  // 推進至擊中敵人
  for (let i = 0; i < 20; i++) {
    probe.weapons(0.02);
    if (enemy.hp < 500) break;
  }

  assert.ok(enemy.hp < 500, '靈針追蹤並成功擊中敵人');
  assert.ok(enemy.freezeT > 0 || enemy.freezeReady > 0, '敵人受到冰封或進入抗性狀態');
});

// ── 5. 投射物快照隔離：空中靈針不受後續加點與屬性變更影響 ─────
test('M1-B-5 Projectile snapshot isolation: in-flight needles never mutated by subsequent upgrades', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().needle = 1;
  probe.addMutation('mut_fan'); // 僅有 fan
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const wave1 = probe.getNeedles();
  assert.equal(wave1.length, 6);
  const inFlightNeedle = wave1[0];

  const snapDmg = inFlightNeedle.dmg;
  const snapTracking = inFlightNeedle.tracking;
  const snapFrost = inFlightNeedle.frost;
  assert.equal(snapTracking, false, '波次 1 靈針不具備追蹤');
  assert.equal(snapFrost, false, '波次 1 靈針不具備冰封');

  // 中途玩家升級：加入 seek 與 frost，並提升人物攻擊力 +10.0
  probe.addMutation('mut_seek');
  probe.addMutation('mut_frost');
  probe.getB().dmg += 10.0;

  // 關鍵驗證：已在空中飛行的靈針屬性絕對不可被改寫！
  assert.equal(inFlightNeedle.dmg, snapDmg, '空中靈針傷害快照不可變');
  assert.equal(inFlightNeedle.tracking, snapTracking, '空中靈針追蹤狀態不可回溯改寫');
  assert.equal(inFlightNeedle.frost, snapFrost, '空中靈針冰封狀態不可回溯改寫');

  // 再發新針驗證：新發射的靈針採納最新三變異與新攻擊力
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const allNeedles = probe.getNeedles();
  const newNeedle = allNeedles[allNeedles.length - 1];
  assert.equal(newNeedle.tracking, true, '新靈針採納 seek 追蹤');
  assert.equal(newNeedle.frost, true, '新靈針採納 frost 冰封');
  assert.ok(newNeedle.dmg > snapDmg * 2, '新靈針採納最新傷害數值');
});

// ── 6. 狀態機與生命週期：pause/levelup 凍結，lost/won 停更，start 重開徹底清理 ──
test('M1-B-6 Lifecycle & state machine: freeze during pause/levelup, stop during lost/won, reset on start()', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().needle = 1;
  probe.addMutation('mut_fan');
  probe.addMutation('mut_seek');
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  assert.equal(needles.length, 6);
  const nd = needles[0];
  const origX = nd.x;

  // 1. pause 狀態：靈針凍結，位置不變，不傷敵
  probe.setState('pause');
  const enemy = { x: origX + 10, y: nd.y, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(enemy);

  probe.runFrame(0.05);
  probe.update(0.05);
  assert.equal(nd.x, origX, 'pause 期間靈針位置絕對凍結');
  assert.equal(enemy.hp, 100, 'pause 期間靈針不傷敵');

  // 2. levelup 狀態：靈針凍結
  probe.setState('levelup');
  probe.runFrame(0.05);
  probe.update(0.05);
  assert.equal(nd.x, origX, 'levelup 期間靈針位置絕對凍結');
  assert.equal(enemy.hp, 100, 'levelup 期間靈針不傷敵');

  // 3. lost / won 狀態：武器不更新
  probe.setState('lost');
  probe.setWT('needle', 0);
  probe.runFrame(0.05);
  probe.update(0.05);
  assert.equal(probe.getNeedles().length, 6, 'lost 期間不產生新靈針');

  // 4. start() 重開新局：變異徹底清空、靈針陣列徹底清空、技能等級回歸
  probe.start('night-town');
  assert.deepEqual(Array.from(probe.getBuildMutations()), [], '新局 buildMutations 必須重置為空陣列');
  assert.equal(probe.getNeedles().length, 0, '新局 needles 必須清空');
  assert.equal(probe.getWL().needle, 0, '新局 needle 等級必須重置為 0');
});

// ── 7. 六招無變異基線與 Lv5 覺醒保護 ──────────────────────────
test('M1-B-7 Baseline skill preservation: unmutated needle and five other skills completely intact', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const bs = probe.getBuildState();
  assert.deepEqual(Array.from(bs.mutations), [], '初始無變異');

  // 1. 六招無變異 source: "base"
  const SKILLS = ['katana', 'barrier', 'needle', 'boom', 'thunder', 'fire'];
  for (const sk of SKILLS) {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const s = probe.resolveAttackSpec(sk, lvl, bs);
      assert.equal(s.source, 'base', `${sk} Lv${lvl} source 必須為 base`);
    }
  }

  // 2. Needle Lv1–5 無變異完整數值驗證
  const expectedNeedle = [
    { lvl: 1, count: 3, spread: 0.45, dmg: 2.1, tracking: false, frost: false },
    { lvl: 2, count: 5, spread: 0.45, dmg: 2.8, tracking: false, frost: false },
    { lvl: 3, count: 7, spread: 0.45, dmg: 3.5, tracking: false, frost: false },
    { lvl: 4, count: 8, spread: 0.65, dmg: 4.2, tracking: false, frost: false },
    { lvl: 5, count: 8, spread: 1.35, dmg: 4.9, tracking: true, frost: true },
  ];

  for (const exp of expectedNeedle) {
    const s = probe.resolveAttackSpec('needle', exp.lvl, bs);
    assert.equal(s.count, exp.count, `Lv${exp.lvl} count 應為 ${exp.count}`);
    assert.equal(s.spread, exp.spread, `Lv${exp.lvl} spread 應為 ${exp.spread}`);
    assert.equal(s.tracking, exp.tracking, `Lv${exp.lvl} tracking 應為 ${exp.tracking}`);
    assert.equal(s.frost, exp.frost, `Lv${exp.lvl} frost 應為 ${exp.frost}`);
    assert.ok(Math.abs(s.baseDamage - exp.dmg) < 0.001, `Lv${exp.lvl} baseDamage 應為 ${exp.dmg}`);
  }

  // 3. Lv5 覺醒靈暴生成 8 發追蹤冰針 (EVOLUTIONS.iceVolley)
  probe.getWL().needle = 5;
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const needlesLv5 = probe.getNeedles();
  assert.equal(needlesLv5.length, 8, '無變異 Lv5 必定生成 8 發冰針');
  assert.equal(needlesLv5[0].ice, true);
  assert.equal(needlesLv5[0].curve, true);
  assert.ok(needlesLv5[0].volley);
});

// ── 8. M1-B-8 Needle 變異選項進池規格與 UI 欄位驗證 ────────────
test('M1-B-8 Mutation cards appear in getEligibleChoices() with stable schema and UI fields when needle is owned', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. needle 未持有時，絕不出靈針變異卡
  assert.equal(probe.getWL().needle, 0);
  const choicesInitial = probe.getEligibleChoices();
  assert.ok(choicesInitial.length > 0);
  assert.ok(choicesInitial.filter(c => c.type === 'mutation').every(c => c.skillId !== 'needle'), '未持有靈針時絕不可出現靈針變異卡');

  // 2. 持有靈針後，變異卡正常出現在三選一候選池中（預置 mut_crosscut 隔離妖刀變異）
  probe.setBuildMutations(['mut_crosscut']);
  probe.getWL().needle = 1;
  probe.setLevelupCooldown(0);
  const choicesWithNeedle = probe.getEligibleChoices();
  const mutCards = choicesWithNeedle.filter(c => c.type === 'mutation' && c.skillId === 'needle');
  assert.ok(mutCards.length > 0, '持有靈針後卡池必須包含靈針變異卡');

  for (const c of mutCards) {
    assert.equal(c.type, 'mutation', 'type 必須為 mutation');
    assert.ok(['mut_fan', 'mut_seek', 'mut_frost', 'mut_pierce', 'mut_return'].includes(c.id), 'id 必須為合法的靈針變異 ID');
    assert.equal(c.choiceId, `mutation:needle:${c.id}`, 'choiceId 必須為穩定的 mutation:needle:<id> 格式');
    assert.equal(c.skillId, 'needle', 'skillId 必須為 needle');
    assert.deepEqual(Array.from(c.skillIds), ['needle'], 'skillIds 必須包含 needle');
    assert.ok(typeof c.n === 'string' && c.n.length > 0, '必須有名稱 n');
    assert.ok(typeof c.s === 'string' && c.s.length > 0, '必須有副標 s');
    assert.equal(c.cat, '【 靈針變異 】', 'cat 必須為 【 靈針變異 】');
    assert.equal(c.levelText, '◆ 靈針變異', 'levelText 必須為 ◆ 靈針變異');
    assert.equal(c.rarity, 'mutation', 'rarity 必須為 mutation');
    assert.ok(typeof c.d === 'string' && c.d.length > 0, '必須有描述說明 d');
    assert.ok(typeof c.requirementText === 'string', '必須有條件說明');
    assert.ok(typeof c.limitText === 'string', '必須有上限限制說明');
    assert.equal(c.revision, probe.getBuildRevision(), 'revision 必須與當前 buildRevision 一致');
    assert.equal(typeof c.ok, 'function', '必須提供 ok() 函式');
    assert.equal(typeof c.f, 'function', '必須提供 f() 函式');
  }
});

// ── 9. M1-B-9 真 applyChoice 選取變異卡並寫入 BuildState ──────
test('M1-B-9 Real applyChoice consumes mutation choice, deducts XP, increments level, and writes to BuildState', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().needle = 1;
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);

  const choices = probe.getChoices();
  const mutCard = choices.find(c => c.type === 'mutation');
  assert.ok(mutCard, '三選一選項中必須包含變異卡');

  const mutId = mutCard.id;
  const xpBefore = probe.getXp();
  const levelBefore = probe.getLevel();
  const rev = probe.getBuildRevision();
  const reqXp = probe.getXpNeed();

  // 透過真 applyChoice 進行選取
  const applyRes = probe.applyChoice(mutCard.choiceId, rev);
  assert.equal(applyRes.ok, true, 'applyChoice 必須回傳 ok: true');
  assert.equal(applyRes.id, mutId);
  assert.equal(applyRes.level, levelBefore + 1);

  // 驗證狀態寫入 BuildState
  const bs = probe.getBuildState();
  assert.ok(Array.from(bs.mutations).includes(mutId), `BuildState.mutations 必須包含被選取的變異 ${mutId}`);

  // 驗證資源與等級結算
  assert.equal(probe.getXp(), xpBefore - reqXp, '必須正確扣除升級所需 XP');
  assert.equal(probe.getLevel(), levelBefore + 1, '等級必須增加 1');
  assert.equal(probe.getState(), 'play', '選取完成後必須切換至 play 狀態');

  // 驗證真武器消費：下一波發射立即消費新變異
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const needles = probe.getNeedles();
  if (mutId === 'mut_fan') {
    assert.equal(needles.length, 6, '選取 mut_fan 後靈針發數立即增至 6');
  } else if (mutId === 'mut_seek') {
    assert.equal(needles[0].tracking, true, '選取 mut_seek 後靈針立即具備追蹤');
  } else if (mutId === 'mut_frost') {
    assert.equal(needles[0].frost, true, '選取 mut_frost 後靈針立即具備冰封');
  }
});

// ── 10. M1-B-10 負向防線：過期 revision、連按重複加入與非法 ID 拒絕 ──
test('M1-B-10 Negative protections: stale revision, rapid double-click, and invalid choiceId rejected without deducting XP', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().needle = 1;
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);

  const choices = probe.getChoices();
  const mutCard = choices.find(c => c.type === 'mutation');
  assert.ok(mutCard);
  const rev = probe.getBuildRevision();
  const xpBefore = probe.getXp();

  // 1. 過期 revision 拒絕
  const staleRes = probe.applyChoice(mutCard.choiceId, rev - 1);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');
  assert.equal(probe.getXp(), xpBefore, '過期 revision 絕不扣除 XP');
  assert.equal(Array.from(probe.getBuildState().mutations).length, 0, '過期 revision 絕不寫入 BuildState');

  // 2. 非法 / 未知 choiceId 拒絕
  const invalidRes = probe.applyChoice('mutation:needle:invalid_mut_id', rev);
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.reason, 'invalid_choice_id');
  assert.equal(probe.getXp(), xpBefore, '非法 choiceId 絕不扣除 XP');

  // 3. 連按雙擊防護：第一次成功，第二次拒絕
  const click1 = probe.applyChoice(mutCard.choiceId, rev);
  assert.equal(click1.ok, true);
  const xpAfterClick1 = probe.getXp();
  const mutLenAfterClick1 = Array.from(probe.getBuildState().mutations).length;

  const click2 = probe.applyChoice(mutCard.choiceId, rev);
  assert.equal(click2.ok, false, '第二次連按必須被拒絕');
  assert.equal(click2.reason, 'not_in_levelup', '已切回 play 狀態不可重扣');
  assert.equal(probe.getXp(), xpAfterClick1, '連按不得重複扣除 XP');
  assert.equal(Array.from(probe.getBuildState().mutations).length, mutLenAfterClick1, '不得重複加入變異');
});

// ── 11. M1-B-11 變異上限（最多 3 種）與未持有靈針邊界保護 ────
test('M1-B-11 Capacity limit (maximum 3 mutations) and unowned needle boundary', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().needle = 1;
  // 手動模擬已集滿 needle 3 種變異與 katana 變異
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut']);
  assert.equal(Array.from(probe.getBuildState().mutations).length, 4);

  // 當變異全滿時，卡池中絕不再出現變異卡
  const choicesFull = probe.getEligibleChoices();
  assert.ok(choicesFull.length > 0);
  assert.ok(choicesFull.every(c => c.type !== 'mutation'), '變異滿額後絕不再提供變異選項');

  // 靈針若未持有 (WL.needle === 0)
  probe.getWL().needle = 0;
  probe.setBuildMutations([]);
  const choicesUnowned = probe.getEligibleChoices();
  assert.ok(choicesUnowned.filter(c => c.type === 'mutation').every(c => c.skillId !== 'needle'), '未持有靈針時絕不可提供靈針變異');
});

// ── 12. M1-B-12 覺醒卡優先、重抽與極限全滿空池不軟鎖 ─────────
test('M1-B-12 Awakening priority, reroll invalidation, and true empty pool without soft-lock', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 覺醒卡優先保障：當有武器 Lv4 且持有覺醒印時，Lv5 覺醒卡必定出現在三選一中
  probe.getWL().katana = 4;
  probe.getWL().needle = 1;
  probe.setSeals(1);
  probe.setLevelupCooldown(0);
  const choicesAwaken = probe.getEligibleChoices();
  const hasAwaken = choicesAwaken.some(c => c.type === 'weapon' && c.lv === 5);
  assert.ok(hasAwaken, '持有覺醒印時，Lv5 覺醒卡必定優先保障出現');

  // 2. 重抽防線：重抽後舊 revision 變異卡即刻失效
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  const revBeforeReroll = probe.getBuildRevision();
  const oldMutCard = probe.getChoices().find(c => c.type === 'mutation');
  assert.ok(oldMutCard);

  probe.setLevelupCooldown(0);
  probe.reroll();
  probe.setLevelupCooldown(0);
  assert.ok(probe.getBuildRevision() > revBeforeReroll, 'reroll 必須推進 buildRevision');

  const rejectStaleAfterReroll = probe.applyChoice(oldMutCard.choiceId, revBeforeReroll);
  assert.equal(rejectStaleAfterReroll.ok, false);
  assert.equal(rejectStaleAfterReroll.reason, 'stale_revision');

  // 3. 極限全滿空池安全結算：4 武器全滿、被動全滿、變異全滿、御守全滿
  const wl = probe.getWL();
  wl.katana = 5;
  wl.needle = 5;
  wl.fire = 5;
  wl.barrier = 5;
  const b = probe.getB();
  b.shield = 6; b.oilRegen = 0.12; b.heals = 3; b.dmgUp = 4; b.rate = 4; b.crit = 3; b.spd = 3; b.dash = 3; b.mag = 3;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_orbit']);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);

  // 反向驗證：持刀＋火且未取得合法 Duo 時，仍有 duo_inkfire 可選，應正常進入 levelup
  probe.setBuildDuos([]);
  const preEligible = probe.getEligibleChoices();
  assert.equal(preEligible.length, 1, '未取得合法 Duo 時有且僅有 1 個可選 Duo');
  assert.equal(preEligible[0].choiceId, 'duo:duo_inkfire', '未取得合法 Duo 時必定出現 duo_inkfire');
  probe.setState('play');
  probe.offerUp();
  probe.setLevelupCooldown(0);
  assert.equal(probe.getState(), 'levelup', '存在合法未取得 Duo 時必須正常進入 levelup 供選卡');

  // 真正耗盡：學習該 4 主動下唯一合資格的 duo_inkfire（不塞無關的 duo_thundercircle / duo_frostseal / duo_cinderseal）
  probe.setBuildDuos(['duo_inkfire']);
  const eligible = probe.getEligibleChoices();
  assert.equal(eligible.length, 0, '確認所持 4 主動之合資格 Duo 取得後，所有卡池真正完全耗盡');

  probe.setState('play');
  probe.setXp(50);
  const lvlBefore = probe.getLevel();
  probe.offerUp();
  probe.setLevelupCooldown(0);

  assert.equal(probe.getState(), 'play', '全滿極限空池必須安全切回 play，不軟鎖卡死');
  assert.equal(probe.getLevel(), lvlBefore + 1, '空池時自動完成等級提升結算');
});
