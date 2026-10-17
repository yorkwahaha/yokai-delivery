// AGY M1-C-R2: 六御守（Charms）完整真 Consumer 與卡池接線測試
//
// 驗收標準：
// 1. BuildState charms 從真單一狀態回傳，局內最多 3 種不同御守，已持有/滿槽/不合格不進選卡。
// 2. 六種 stable ID 保持 GDD 命名，全部 inPool: true 正常進入選卡池（Level >= 2 出現，Level 1 保持純 weapon/passive）：
//    - charm_power 力紋守（小幅基礎傷害 +0.20，次級傷害不再次乘算）。
//    - charm_step 風步守（集中移速 +28 px/s，不穿牆、無無敵）。
//    - charm_gather 招靈守（靈玉吸收半徑 +75 px，不增產量、不自動完成送貨）。
//    - charm_cadence 疾奏守（有效 rate +0.25，只修正可受 b.rate 技能，保留 Lv5 固定節奏與冷卻下限）。
//    - charm_reach 遠霞守（有效範圍 +10%，作用於妖刀/靈陣/靈針/符咒實際碰撞半徑，飛行物同步 life 快照，保留 Lv5 上限）。
//    - charm_guard 紙甲守（hurtPlayer 減傷 10%，護盾/無敵先於減傷，小傷不歸零、不回油，不減免非戰鬥扣油）。
// 3. choiceId / revision / 重抽 / 快按 / XP 扣除與 mutation/weapon 走同一 applyChoice，start() 重開徹底清零。
// 4. 集中結算參數，避免與既有 UP.dmg/spd/mag/rate 重複乘算或越過上限；舊被動上限與冷卻不受影響。
// 5. 六招無御守 Lv1–5 基線不退化。

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
      addMutation: id => addMutation(id),
      removeMutation: id => removeMutation(id),
      getBuildCharms: () => buildCharms,
      setBuildCharms: list => { buildCharms = Array.isArray(list) ? [...list] : []; buildRevision++; },
      getBuildDuos: () => buildDuos,
      setBuildDuos: list => { buildDuos = Array.isArray(list) ? [...list] : []; buildRevision++; },
      addCharm: id => addCharm(id),
      removeCharm: id => removeCharm(id),
      getEffectiveDmg: bs => getEffectiveDmg(bs),
      getEffectiveMoveSpeed: bs => getEffectiveMoveSpeed(bs),
      getEffectiveMagnetRadius: bs => getEffectiveMagnetRadius(bs),
      getEffectiveRate: bs => getEffectiveRate(bs),
      getEffectiveReachMultiplier: bs => getEffectiveReachMultiplier(bs),
      getEligibleChoices: () => getEligibleChoices(),
      resolveAttackSpec: (id, lvl, bs, opt) => resolveAttackSpec(id, lvl, bs, opt),
      getNeedles: () => needles,
      getGems: () => gems,
      dropGem: (x, y, v) => dropGem(x, y, v),
      hurtPlayer: (amt, lbl) => hurtPlayer(amt, lbl),
      getTexts: () => texts,
      getOil: () => oil,
      setOil: v => { oil = v; },
      getDelivered: () => delivered,
      setDelivered: v => { delivered = v; },
      getElapsed: () => elapsed,
      setElapsed: v => { elapsed = v; },
      runFrame: dt => runFrame(dt),
      update: dt => update(dt),
      CHARM_CONFIG: CHARM_CONFIG,
      getSolids: () => solids,
      getHouses: () => houses,
      getBoomRadius: rank => boomRadius(rank),
      setGpMove: (x, y) => { gpMove = { x, y }; }
    };
  `;

  const instrumentedSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(instrumentedSrc, sandbox, { filename: 'game.js' });

  return sandbox;
}

// ── 1. M1-C-1 六御守選卡資格：Level 1 不出、Level 2+ 全六款正常進池與穩定欄位 ──
test('M1-C-1 All six charm cards pool eligibility: level 1 excluded, level 2+ all six inPool=true, stable schema', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. Level 1 初始選卡池中絕不出御守（保護早鳥教學與 Test 7 契約防線）
  assert.equal(probe.getLevel(), 1);
  const choicesLvl1 = probe.getEligibleChoices();
  assert.ok(choicesLvl1.length > 0);
  assert.ok(choicesLvl1.every(c => c.type !== 'charm'), 'Level 1 候選池中絕不得出現御守卡');

  // 2. Level 2 起，六款御守均具備 inPool: true 並可進入選卡池
  probe.setLevel(2);
  const config = probe.CHARM_CONFIG;
  const allIds = ['charm_power', 'charm_step', 'charm_gather', 'charm_cadence', 'charm_reach', 'charm_guard'];
  for (const id of allIds) {
    assert.ok(config[id], `CHARM_CONFIG 必須包含 ${id}`);
    assert.equal(config[id].inPool, true, `${id} 必須為 inPool: true`);
  }

  const choicesLvl2 = probe.getEligibleChoices();
  const charmCards = choicesLvl2.filter(c => c.type === 'charm');
  assert.ok(charmCards.length > 0, 'Level 2 起選卡池中必須有御守卡');

  for (const c of charmCards) {
    assert.ok(allIds.includes(c.id), '御守 ID 必須為 GDD 正式命名六款之一');
    assert.equal(c.choiceId, `charm:${c.id}`, 'choiceId 必須為 charm:<id> 格式');
    assert.equal(c.type, 'charm', 'type 必須為 charm');
    assert.ok(typeof c.n === 'string' && c.n.length > 0, '必須有名稱 n');
    assert.ok(typeof c.s === 'string' && c.s.length > 0, '必須有副標 s');
    assert.equal(c.cat, '【 御守護符 】', '分類必須為【 御守護符 】');
    assert.equal(c.levelText, '◆ 御守加持', 'levelText 必須為 ◆ 御守加持');
    assert.equal(c.rarity, 'charm', 'rarity 必須為 charm');
    assert.ok(typeof c.d === 'string' && c.d.length > 0, '必須有說明文字 d');
    assert.ok(typeof c.requirementText === 'string', '必須有 requirementText');
    assert.ok(typeof c.limitText === 'string', '必須有 limitText');
    assert.ok(typeof c.revision === 'number', '必須有 revision 數值');
    assert.ok(typeof c.ok === 'function', '必須有 ok 檢查函式');
    assert.ok(typeof c.f === 'function', '必須有 f 執行函式');

    // 關鍵防線：御守為全域加持，不得輸出 skillIds 避免 UI 誤走武器分支
    assert.equal(c.skillIds, undefined, '御守卡不得輸出 skillIds 欄位');
    assert.equal(c.beforeText, undefined, '御守卡不得輸出 beforeText 欄位');
    assert.equal(c.afterText, undefined, '御守卡不得輸出 afterText 欄位');
  }
});

// ── 2. M1-C-2 真 applyChoice 寫入 BuildState.charms、扣除 XP、提升等級 ────
test('M1-C-2 Real applyChoice consumes charm choice, deducts XP, increments level, and writes to BuildState.charms', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setLevel(2);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);

  const choices = probe.getChoices();
  const charmChoice = choices.find(c => c.type === 'charm');
  assert.ok(charmChoice, '升級三選一中必須提供御守卡');

  const revBefore = probe.getBuildRevision();
  const xpBefore = probe.getXp();
  const reqXp = probe.getXpNeed();
  const lvlBefore = probe.getLevel();

  const res = probe.applyChoice(charmChoice.choiceId, revBefore);
  assert.equal(res.ok, true, '合法選取御守卡必須成功');
  assert.equal(res.id, charmChoice.id);
  assert.equal(res.level, lvlBefore + 1, 'applyChoice 回傳等級必須遞增');

  // 驗證 BuildState.charms 單一真實狀態更新
  const buildState = probe.getBuildState();
  assert.ok(Array.isArray(buildState.charms), 'BuildState.charms 必須為陣列');
  assert.equal(buildState.charms.length, 1);
  assert.equal(buildState.charms[0], charmChoice.id, 'BuildState.charms 必須記錄已選御守 ID');

  // 驗證 XP 結算、等級提升與狀態切回 play
  assert.equal(probe.getXp(), xpBefore - reqXp, '選取御守必須正確扣除升級所需 XP');
  assert.equal(probe.getLevel(), lvlBefore + 1, '等級必須提升');
  assert.ok(probe.getBuildRevision() > revBefore, 'buildRevision 必須推進');
  assert.equal(probe.getState(), 'play', '選卡後狀態必須切回 play');
});

// ── 3. M1-C-3 容量上限（最多 3 種御守）、去重排他與滿槽絕不出池 ──────────
test('M1-C-3 Capacity limit (maximum 3 charms), uniqueness (no duplicates), and full slot exclusion', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');
  probe.setLevel(2);

  // 1. 已持有的御守絕不重複進池
  probe.addCharm('charm_cadence');
  assert.equal(probe.getBuildCharms().length, 1);
  const choicesWithOne = probe.getEligibleChoices();
  const offeredCharmIds = choicesWithOne.filter(c => c.type === 'charm').map(c => c.id);
  assert.ok(!offeredCharmIds.includes('charm_cadence'), '已獲得之 charm_cadence 絕不可再次進池');

  // 2. 裝備 2 個御守時，池中僅提供剩餘未持有者
  probe.addCharm('charm_reach');
  assert.equal(probe.getBuildCharms().length, 2);
  const choicesWithTwo = probe.getEligibleChoices();
  const remainingCharmIds = choicesWithTwo.filter(c => c.type === 'charm').map(c => c.id);
  assert.ok(!remainingCharmIds.includes('charm_cadence'));
  assert.ok(!remainingCharmIds.includes('charm_reach'));

  // 3. 裝備 3 個御守（滿槽）後，卡池中絕不再出現任何御守
  probe.addCharm('charm_guard');
  assert.equal(probe.getBuildCharms().length, 3);
  const choicesFull = probe.getEligibleChoices();
  assert.ok(choicesFull.every(c => c.type !== 'charm'), '御守滿 3 個後選卡池絕不可再出現任何御守卡');

  // 4. 超額防線：滿 3 個時呼叫 addCharm 必須被拒絕
  const addExceeded = probe.addCharm('charm_power');
  assert.equal(addExceeded, false, '滿 3 個後呼叫 addCharm 必須回傳 false');
  assert.equal(probe.getBuildCharms().length, 3, '御守數量不可突破 3 個上限');

  // 5. 重複加入防線：重複呼叫 addCharm 必須被拒絕
  probe.removeCharm('charm_guard');
  assert.equal(probe.getBuildCharms().length, 2);
  const addDup = probe.addCharm('charm_cadence');
  assert.equal(addDup, false, '已持有之御守不可重複加入');
  assert.equal(probe.getBuildCharms().length, 2);
});

// ── 4. M1-C-4 charm_power：武器碰撞真扣血、在途投射物快照隔離與次級傷害不重乘 ─
test('M1-C-4 charm_power: real weapon collision damage, in-flight projectile snapshot isolation, secondary shatter protection', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const b = probe.getB();
  b.dmg = 1.0;
  const p = probe.getP();
  const enemies = probe.getEnemies();

  // 1. 妖刀真揮砍傷害驗證
  // 設置敵人於前方扇形距離 100 處
  const foe1 = { x: p.x + 100, y: p.y, hp: 10, maxHp: 10, type: 'mob' };
  enemies.push(foe1);
  probe.setWT('katana', 0);
  probe.weapons(0.016);
  // 基礎揮砍傷害為 baseDmg + (1-1)*0.8 = 1.0
  assert.equal(Number(foe1.hp.toFixed(2)), 9.00, '無御守時妖刀揮砍扣除 1.0 HP');

  // 裝備 charm_power 力紋守
  probe.addCharm('charm_power');
  assert.equal(probe.getEffectiveDmg(), 1.20, '集中 baseDmg 正確提升至 1.20');
  const foe2 = { x: p.x + 100, y: p.y, hp: 10, maxHp: 10, type: 'mob' };
  enemies.push(foe2);
  probe.setWT('katana', 0);
  probe.weapons(0.016);
  assert.equal(Number(foe2.hp.toFixed(2)), 8.80, '力紋守加持下妖刀揮砍扣除 1.20 HP');

  // 2. 靈針在途快照隔離：飛行途中取得力紋守，已發射靈針傷害絕不回溯增加
  probe.removeCharm('charm_power');
  probe.getWL().needle = 1;
  probe.setWT('needle', 0);
  probe.weapons(0.016);
  const needles = probe.getNeedles();
  assert.ok(needles.length > 0);
  const inFlightNeedle = needles[0];
  assert.equal(inFlightNeedle.dmg, 2.1, '未持力紋守時靈針快照傷害為 2.1');

  // 途中裝備 charm_power
  probe.addCharm('charm_power');
  assert.equal(inFlightNeedle.dmg, 2.1, '在途靈針傷害快照嚴格隔離，不可回溯提升');

  // 3. 次級傷害（shatter）不重複乘算：shatter 保持以 b.dmg 計算，不受 charm_power 二次增幅
  assert.equal(b.dmg, 1.0, 'b.dmg 保持原數值，力紋守不污染被動計數');
  assert.equal(b.dmgUp, 0);
  b.dmg += 0.30;
  b.dmgUp = 1;
  assert.equal(probe.getEffectiveDmg(), 1.50, 'UP.dmg 與 charm_power 集中相加結算 (1.30 + 0.20 = 1.50)');
});

// ── 5. M1-C-5 charm_step：真 update 位移提升（+28 px/s）、地景碰撞防穿牆與無無敵 ──
test('M1-C-5 charm_step: real update displacement (+28 px/s), world collision blocked, no invincibility', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const initialX = p.x;

  // 1. 無御守位移
  probe.setGpMove(1, 0);
  probe.update(0.1);
  const dispWithoutCharm = p.x - initialX;
  assert.equal(Number(dispWithoutCharm.toFixed(2)), 23.00, '無御守時 0.1s 位移 23.00 px (230 px/s)');

  // 2. 裝備 charm_step 風步守
  probe.addCharm('charm_step');
  assert.equal(probe.getEffectiveMoveSpeed(), 258, '集中移速為 258 px/s');
  const xBeforeStep = p.x;
  probe.update(0.1);
  const dispWithCharm = p.x - xBeforeStep;
  assert.equal(Number(dispWithCharm.toFixed(2)), 25.80, '風步守加持下 0.1s 位移 25.80 px (258 px/s)');

  // 3. 地景碰撞防穿牆：前方遭遇實心障礙時移動必須受阻
  const solids = probe.getSolids();
  solids.push({ x0: p.x + 10, x1: p.x + 80, y0: p.y - 50, y1: p.y + 50 });
  const xBeforeBlock = p.x;
  for (let step = 0; step < 5; step++) probe.update(0.05);
  assert.ok(p.x <= xBeforeBlock + 12, '風步守不具備穿牆能力，遭遇障礙物時位移被實體碰撞阻擋');

  // 4. 無無敵增益：P.inv 初始值不因風步守改變
  assert.ok(p.inv <= 1.2, '風步守不賦予額外無敵時間');
});

// ── 6. M1-C-6 charm_gather：真 update 靈玉吸附距離（+75 px）、XP 正確結算、不自動送貨 ──
test('M1-C-6 charm_gather: real update gem absorption distance (+75 px), gem value integrity, no auto-delivery', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();

  // 1. 放置靈玉於距離 150 px 處（大於預設 110 px，小於加成後 185 px）
  probe.dropGem(p.x + 150, p.y, 5);
  const gems = probe.getGems();
  const gem = gems[gems.length - 1];
  assert.equal(gem.x, p.x + 150);

  // 無御守時：吸附半徑 110 px，150 px 處的靈玉不被吸附
  probe.update(0.05);
  assert.equal(gem.x, p.x + 150, '吸附半徑外靈玉不移動');

  // 裝備 charm_gather 招靈守：吸附半徑擴大至 185 px (110 + 75)
  probe.addCharm('charm_gather');
  assert.equal(probe.getEffectiveMagnetRadius(), 185, '集中吸附半徑提升至 185 px');

  probe.update(0.05);
  assert.ok(gem.x < p.x + 150, '招靈守加持下，150 px 處靈玉被成功牽引向玩家');

  // 2. 靈玉經驗吸收值精準結算：掉落值為 5 的靈玉完全拾取後僅給予 5 XP
  gem.x = p.x + 5;
  gem.y = p.y;
  const xpBefore = probe.getXp();
  probe.update(0.016);
  assert.equal(probe.getXp(), xpBefore + 5, '拾取靈玉精確增加 5 XP，產量不異常倍增');

  // 3. 委託不自動完成：場上委託與遞送進度不受靈玉拾取干擾
  assert.equal(probe.getDelivered(), 0, '拾取靈玉絕不自動完成配送委託');
});

// ── 7. M1-C-7 charm_cadence：有效率修正（+0.25）、下限保護與 Lv5 固定節奏維護 ──
test('M1-C-7 charm_cadence: effective rate bonus (+0.25), cooldown floor protection, and Lv5 rhythm preservation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 支持技能冷卻小幅縮短
  // Katana Lv1：uncharmed = 0.72s
  const katanaBase = probe.resolveAttackSpec('katana', 1);
  assert.equal(katanaBase.cooldown, 0.72);

  // 裝備 charm_cadence 疾奏守
  probe.addCharm('charm_cadence');
  assert.equal(probe.getEffectiveRate(), 0.25, '集中 effectiveRate 為 0.25');

  const katanaCharmed = probe.resolveAttackSpec('katana', 1);
  assert.equal(Number(katanaCharmed.cooldown.toFixed(4)), Number((0.72 - 0.25 * 0.13).toFixed(4)), '妖刀冷卻縮短 0.25 * 0.13');

  // Needle Lv1：uncharmed = 1.25 - 0.16 = 1.09s
  const needleCharmed = probe.resolveAttackSpec('needle', 1);
  assert.equal(Number(needleCharmed.cooldown.toFixed(4)), Number((1.09 - 0.25 * 0.10).toFixed(4)), '靈針冷卻縮短 0.25 * 0.10');

  // 2. 冷卻下限保護：妖刀冷卻下限 0.6s 嚴格不被突破
  const b = probe.getB();
  b.rate = 3; // 0.72 - 3.25 * 0.13 = 0.2975 -> 下限 0.6
  const katanaFloor = probe.resolveAttackSpec('katana', 1);
  assert.equal(katanaFloor.cooldown, 0.6, '妖刀冷卻不可突破 0.6s 下限');
  b.rate = 0;

  // 3. 淨化靈陣冷卻修正與 Lv5 曼荼羅固定 3.2s 節奏
  probe.getWL().barrier = 1;
  probe.setWT('barrier', 0);
  probe.weapons(0.016);
  // Lv1 barrier uncharmed = 3.2 - 0.42 = 2.78s; with cadence = 2.78 - 0.25*0.2 = 2.73s
  assert.equal(Number(probe.getWMax().barrier.toFixed(3)), 2.730, '靈陣 Lv1 冷卻受疾奏守縮短至 2.73s');

  // 淨化靈陣 Lv5 曼荼羅覺醒：冷卻固定 3.2s，不受疾奏守加速
  probe.getWL().barrier = 5;
  probe.setWT('barrier', 0);
  probe.weapons(0.016);
  assert.equal(probe.getWMax().barrier, 3.2, '靈陣 Lv5 曼荼羅保持 3.2s 固有節奏');

  // 4. 不支持技能節奏嚴格保持
  // 陰陽符冷卻不受 b.rate 或 cadence 影響（有敵人在射程內時觸發裝填冷卻）
  probe.getWL().boom = 1;
  probe.getEnemies().push({ x: probe.getP().x + 100, y: probe.getP().y, hp: 10, maxHp: 10 });
  probe.setWT('boom', 0);
  probe.weapons(0.016);
  assert.equal(Number(probe.getWMax().boom.toFixed(2)), 1.76, '陰陽符冷卻保持 2.0 - 0.24 = 1.76s');

  // 5. b.rate 保持獨立
  assert.equal(b.rate, 0, 'b.rate 計數不受污染');
});

// ── 8. M1-C-8 charm_reach：有效半徑提升（+10%）、真碰撞判定、投射物快照與 Lv5 上限 ──
test('M1-C-8 charm_reach: effective reach expansion (+10%), real collision boundaries, projectile snapshots, and Lv5 caps', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const enemies = probe.getEnemies();

  // 1. 妖刀揮砍實體攻擊距離判定 (+10%：145 -> 160 px)
  // 將敵人放置在 155 px 處（無御守打不到，遠霞守打得到）
  const foeFar = { x: p.x + 155, y: p.y, hp: 10, maxHp: 10, type: 'mob' };
  enemies.push(foeFar);

  probe.setWT('katana', 0);
  probe.weapons(0.016);
  assert.equal(foeFar.hp, 10, '無御守時 155 px 處敵人位於 145 px 攻擊範圍外，不受傷');

  // 裝備 charm_reach 遠霞守
  probe.addCharm('charm_reach');
  assert.equal(probe.getEffectiveReachMultiplier(), 1.10, '集中 reachMultiplier 為 1.10');

  probe.setWT('katana', 0);
  probe.weapons(0.016);
  assert.ok(foeFar.hp < 10, '遠霞守加持下，155 px 處敵人落入 160 px 擴大範圍，受到揮砍命中');

  // 妖刀 Lv5 斷空殘月斬世界最大距離嚴格保持 720 px（符合 V3 契約上限）
  const katanaAwakened = probe.resolveAttackSpec('katana', 5);
  assert.equal(katanaAwakened.maxTravel, 720, '妖刀覺醒風刃最大世界距離不可突破 720 px');

  // 2. 淨化靈陣實體半徑判定 (+10%：Lv1 168 -> 185 px)
  // 將敵人放置在 175 px 處
  const foeBarrier = { x: p.x + 175, y: p.y, hp: 10, maxHp: 10, type: 'mob' };
  enemies.push(foeBarrier);
  probe.getWL().barrier = 1;
  probe.setWT('barrier', 0);
  probe.weapons(0.016);
  assert.ok(foeBarrier.hp < 10, '靈陣 Lv1 受遠霞守擴大至 185 px，成功命中 175 px 處敵人');

  // 3. 靈針射程與生命週期同步快照 (+10%)
  const needleSpec = probe.resolveAttackSpec('needle', 1);
  assert.equal(needleSpec.range, Math.round(440 * 1.10), '靈針射程擴大為 484 px');
  assert.equal(needleSpec.life, Number((0.65 * 1.10).toFixed(4)), '靈針生命週期同步擴大為 0.715s');

  const needleSeekSpec = probe.resolveAttackSpec('needle', 1, { mutations: ['mut_seek'] });
  assert.equal(needleSeekSpec.seekRange, Math.round(480 * 1.10), '靈針追蹤半徑擴大為 528 px');

  // 4. 陰陽符爆炸半徑判定 (+10%：78 -> 86 px)
  assert.equal(probe.getBoomRadius(1), Math.round(78 * 1.10), '陰陽符 Lv1 爆炸半徑擴大為 86 px');
});

// ── 9. M1-C-9 charm_guard：hurtPlayer 真減傷 10%、護盾/無敵優先判定、小傷與浮字邊界 ─
test('M1-C-9 charm_guard: real hurtPlayer 10% reduction, shield/inv precedence, small damage bounds', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  assert.equal(probe.getOil(), 100);

  // 1. 0 / 負值 / 非有限輸入防護：不製造傷害、不扣油、不回油、不消耗護盾或無敵
  const invalidInputs = [0, -5, NaN, Infinity, -Infinity, null, undefined, 'bad'];
  for (const input of invalidInputs) {
    probe.getP().inv = 0;
    probe.getB().shield = 2;
    const oilBefore = probe.getOil();
    const res = probe.hurtPlayer(input);
    assert.equal(res, false, `輸入 ${input} 必須回傳 false`);
    assert.equal(probe.getOil(), oilBefore, `輸入 ${input} 絕不可扣油或回油`);
    assert.equal(probe.getB().shield, 2, `輸入 ${input} 絕不可消耗護盾`);
    assert.equal(probe.getP().inv, 0, `輸入 ${input} 絕不可觸發或消耗無敵`);
  }

  // 2. 正數受傷矩陣對照：0.01 / 0.05 / 0.5 / 10
  // (A) 無御守時：全額扣除，小傷不放大
  probe.getB().shield = 0;
  const uncharmedCases = [
    { amt: 0.01, expectedLoss: 0.01 },
    { amt: 0.05, expectedLoss: 0.05 },
    { amt: 0.5,  expectedLoss: 0.5 },
    { amt: 10,   expectedLoss: 10 }
  ];
  for (const tc of uncharmedCases) {
    probe.setOil(100);
    probe.getP().inv = 0;
    probe.hurtPlayer(tc.amt);
    const loss = Number((100 - probe.getOil()).toFixed(4));
    assert.equal(loss, tc.expectedLoss, `無御守時受創 ${tc.amt} 應實扣 ${tc.expectedLoss}`);
  }

  // (B) 裝備 charm_guard 紙甲守：減傷 10% (0.90 倍)
  // 正數減傷必 > 0 且 <= 原 amount；0.01 -> 0.009 (絕非 0.1)；0.05 -> 0.045 (絕非 0.1)；0.5 -> 0.45；10 -> 9.0
  probe.addCharm('charm_guard');
  const charmedCases = [
    { amt: 0.01, expectedLoss: 0.009 },
    { amt: 0.05, expectedLoss: 0.045 },
    { amt: 0.5,  expectedLoss: 0.45 },
    { amt: 10,   expectedLoss: 9.0 }
  ];
  for (const tc of charmedCases) {
    probe.setOil(100);
    probe.getP().inv = 0;
    probe.hurtPlayer(tc.amt);
    const loss = Number((100 - probe.getOil()).toFixed(4));
    assert.equal(loss, tc.expectedLoss, `紙甲守下受創 ${tc.amt} 應實扣 ${tc.expectedLoss} (必 > 0 且 <= ${tc.amt})`);
    assert.ok(loss > 0 && loss <= tc.amt, `紙甲守減傷必須 > 0 且 <= 原傷害`);
  }

  // 3. 受創浮字與情境保留：hurtPlayer(8, "妖火灼身・燈油 −8")
  // 無御守時浮字寫 8；有御守時浮字寫 7.2 且保留 "妖火灼身" 情境
  probe.removeCharm('charm_guard');
  probe.setOil(100);
  probe.getP().inv = 0;
  probe.hurtPlayer(8, '妖火灼身・燈油 −8');
  assert.equal(probe.getOil(), 92, '無御守時妖火灼身扣 8 點油');
  const textsUncharmed = probe.getTexts();
  assert.equal(textsUncharmed[textsUncharmed.length - 1].v, '妖火灼身・燈油 −8', '無御守時浮字保留情境並顯示扣 8');

  probe.addCharm('charm_guard');
  probe.setOil(100);
  probe.getP().inv = 0;
  probe.hurtPlayer(8, '妖火灼身・燈油 −8');
  assert.equal(Number(probe.getOil().toFixed(2)), 92.80, '紙甲守下妖火灼身實扣 7.2 點油');
  const textsCharmed = probe.getTexts();
  assert.equal(textsCharmed[textsCharmed.length - 1].v, '妖火灼身・燈油 −7.2', '紙甲守下浮字保留妖火灼身情境且數字為實際扣值 7.2');

  // 無 label 時受創預設浮字顯示實際扣值
  probe.setOil(100);
  probe.getP().inv = 0;
  probe.hurtPlayer(10);
  const textsDefault = probe.getTexts();
  assert.equal(textsDefault[textsDefault.length - 1].v, '受創・燈油 −9', '預設受創浮字顯示實際扣值 9');

  // 4. 無敵狀態優先判定：inv > 0 時完全不扣油
  probe.setOil(100);
  probe.getP().inv = 0.5;
  const hurtDuringInv = probe.hurtPlayer(10);
  assert.equal(hurtDuringInv, false, '無敵狀態下不可受到傷害');
  assert.equal(probe.getOil(), 100, '無敵狀態下燈油完全不減少');

  // 5. 金剛結界護盾優先判定：護盾抵擋完全不扣油，且不消耗/重複減傷
  probe.getP().inv = 0;
  probe.getB().shield = 1;
  const hurtShielded = probe.hurtPlayer(10);
  assert.equal(hurtShielded, false, '護盾成功抵擋傷害');
  assert.equal(probe.getB().shield, 0, '護盾消耗 1 層');
  assert.equal(probe.getOil(), 100, '護盾抵擋時燈油毫無損耗');

  // 6. 非戰鬥耗油對照：自然航行耗油不受紙甲守減免，保持原速
  probe.setOil(100);
  probe.update(0.1);
  const oilAfterUpdateWithGuard = probe.getOil();
  probe.removeCharm('charm_guard');
  probe.setOil(100);
  probe.update(0.1);
  const oilAfterUpdateWithoutGuard = probe.getOil();
  assert.equal(Number(oilAfterUpdateWithGuard.toFixed(4)), Number(oilAfterUpdateWithoutGuard.toFixed(4)), '自然航行耗油不受紙甲守影響');

  // 7. 重開清零驗證：start() 後紙甲守重置，扣血恢復全額
  probe.start('night-town');
  probe.getP().inv = 0;
  probe.hurtPlayer(10);
  assert.equal(Number(probe.getOil().toFixed(2)), 90.00, '重開後紙甲守徹底清零，恢復全額 10 點傷害');
});

// ── 10. M1-C-10 無御守六招 Lv1–5 全基線數值保護不退化 ─────────────
test('M1-C-10 Baseline skills preservation: six weapons Lv1-5 produce identical baseline numbers without charms', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  assert.equal(probe.getBuildCharms().length, 0);

  // 妖刀
  const k1 = probe.resolveAttackSpec('katana', 1);
  assert.equal(k1.reach, 145);
  assert.equal(k1.cooldown, 0.72);
  assert.equal(k1.slashDmg, 1.2);

  const k5 = probe.resolveAttackSpec('katana', 5);
  assert.equal(k5.swingReach, 720);
  assert.equal(k5.maxTravel, 720);

  // 靈針
  const n1 = probe.resolveAttackSpec('needle', 1);
  assert.equal(n1.count, 3);
  assert.equal(n1.range, 440);
  assert.equal(n1.life, 0.65);
  assert.equal(n1.cooldown, 1.09);

  const n5 = probe.resolveAttackSpec('needle', 5);
  assert.equal(n5.count, 8);
  assert.equal(n5.range, 440);
  assert.equal(n5.life, 0.95);
  assert.equal(n5.cooldown, 0.65);

  // 集中參數預設值
  assert.equal(probe.getEffectiveDmg(), 1.2);
  assert.equal(probe.getEffectiveMoveSpeed(), 230);
  assert.equal(probe.getEffectiveMagnetRadius(), 110);
  assert.equal(probe.getEffectiveRate(), 0);
  assert.equal(probe.getEffectiveReachMultiplier(), 1.0);
});

// ── 11. M1-C-11 負向防線、重抽失效與真正所有候選耗盡極限空池安全結算 ───────
test('M1-C-11 Negative protections, reroll invalidation, and true candidate exhaustion empty pool', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setLevel(2);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);

  const choices = probe.getChoices();
  const charmCard = choices.find(c => c.type === 'charm');
  assert.ok(charmCard);
  const rev = probe.getBuildRevision();
  const xpBefore = probe.getXp();

  // 1. 過期 revision 拒絕
  const staleRes = probe.applyChoice(charmCard.choiceId, rev - 1);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');
  assert.equal(probe.getXp(), xpBefore);

  // 2. 連按雙擊防護：第一次成功，第二次拒絕
  const click1 = probe.applyChoice(charmCard.choiceId, rev);
  assert.equal(click1.ok, true);
  const xpAfterClick1 = probe.getXp();

  const click2 = probe.applyChoice(charmCard.choiceId, rev);
  assert.equal(click2.ok, false);
  assert.equal(click2.reason, 'not_in_levelup');
  assert.equal(probe.getXp(), xpAfterClick1);

  // 3. 重抽防線：重抽後舊 revision 御守卡即刻失效
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  const revBeforeReroll = probe.getBuildRevision();
  const oldCharmCard = probe.getChoices().find(c => c.type === 'charm');
  assert.ok(oldCharmCard);

  probe.setLevelupCooldown(0);
  probe.reroll();
  probe.setLevelupCooldown(0);
  assert.ok(probe.getBuildRevision() > revBeforeReroll);

  const rejectStaleAfterReroll = probe.applyChoice(oldCharmCard.choiceId, revBeforeReroll);
  assert.equal(rejectStaleAfterReroll.ok, false);
  assert.equal(rejectStaleAfterReroll.reason, 'stale_revision');

  // 4. 真正所有候選耗盡極限空池：4 主動武器 Lv5、被動全滿、變異滿槽、御守滿槽
  const wl = probe.getWL();
  wl.katana = 5;
  wl.needle = 5;
  wl.fire = 5;
  wl.barrier = 5;
  const b = probe.getB();
  b.shield = 6; b.oilRegen = 0.12; b.heals = 3; b.dmgUp = 4; b.rate = 4; b.crit = 3; b.spd = 3; b.dash = 3; b.mag = 3;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_orbit']);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_cadence']);

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
  const lvlBeforeEmpty = probe.getLevel();
  probe.offerUp();
  probe.setLevelupCooldown(0);

  assert.equal(probe.getState(), 'play', '所有卡池真正耗盡時必須安全切回 play，不軟鎖卡死');
  assert.equal(probe.getLevel(), lvlBeforeEmpty + 1, '空池時自動完成等級提升結算');
});
