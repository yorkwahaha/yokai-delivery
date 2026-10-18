// AGY M1-A-R1 Runtime BuildState、選卡契約 v1 與攻擊快照驗證測試
//
// 驗收標準：
// 1. 選卡一次與陳舊 revision / 連按不重扣（stale revision 拒絕，不扣 XP、不加等級）。
// 2. 滿 4 主動欄滿級排除與覺醒印邊界（滿 4 欄不學新技能、缺印不覺醒、Lv5 滿級排除）。
// 3. 重抽 (reroll) 與重開 (start) revision 失效防線（新局無法重用舊 revision）。
// 4. 空池安全續行與非法 choiceId 拒絕防護（不拋錯崩潰，不扣 XP）。
// 5. 攻擊快照 resolveAttackSpec 生成與飛行途中升級不回寫（katana 風刃 snapshot 隔離）。
// 6. 無變異基線契約：BuildState 初始 shape 與無變異各招基線 metadata 規格。
// 7. choices 顯示契約安全防護（舊卡不啟用 v1 顯示欄位以防手機端 P1 排版破版，revision 追蹤）。
// 8. levelUpLayout 缺失時 fallback 現役佈局，且卡片與重抽真事件命中正常。
// 9. UI.levelUpLayout 注入新佈局時采納新座標，且舊現役座標嚴格負向不誤選。
// 10. 六招 Lv1–5 無變異真行為與邊界保護（katana風刃上限/barrier Lv5 220範圍1.8緩速不回油不聚怪/fire Lv4離體Lv5黑龍3球3焦土5秒/boom單結算/thunder固定係數不按生命處刑/needle Lv5追蹤冰針）。
// 11. 靈針真快照 resolveAttackSpec 與投射消費隔離（飛行途中升級不回寫、命中同敵去重、重開清理）。
// 12. 六招 Lv1–5 全 30 組真實行為觀測矩陣（真實冷卻、彈數、射程、擊退與固定傷害倍率）。
// 13. 真實 frame 與 update 狀態路徑防護（pause / levelup 靈針凍結不傷敵、lost / won 與 start 重開無幽靈殘留）。

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
    // 嚴格音訊 stub，防止觸發音訊載入
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
  env.Math = sandboxMath;

  const sandbox = vm.createContext(env);

  const readJs = file => fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');

  // 依序載入依賴模組
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

  // 注入音訊、控制與渲染 stub
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

  // 載入 game.js 並注入 AGY 測試探針
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
      getWinds: () => winds,
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
      getDuoShockwaves: () => duoShockwaves,
      getEligibleChoices: () => getEligibleChoices(),
      resolveAttackSpec: (id, lvl, bs, opt) => resolveAttackSpec(id, lvl, bs, opt),
      levelUpLayout: () => levelUpLayout(),
      hitLevelUpCard: p => hitLevelUpCard(p),
      hitLevelUpReroll: p => hitLevelUpReroll(p),
      getLevelupFocus: () => levelupFocus,
      setLevelupFocus: v => { levelupFocus = v; },
      getRerolls: () => rerolls,
      setRerolls: v => { rerolls = v; },
      getNeedles: () => needles,
      getProj: () => proj,
      getGhosts: () => ghosts,
      getDragonShots: () => dragonShots,
      getDragonScorches: () => dragonScorches,
      getSacredSanctuary: () => sacredSanctuary,
      getOil: () => oil,
      setOil: v => { oil = v; },
      getElapsed: () => elapsed,
      setElapsed: v => { elapsed = v; },
      update: (dt, hitStopped) => update(dt, hitStopped),
      runFrame: now => runFrame(now),
      loseRun: () => loseRun(),
      startVictorySequence: () => startVictorySequence(),
      updateLampSequence: dt => updateLampSequence(dt),
      updateVictorySequence: dt => updateVictorySequence(dt),
      setDelivered: v => { delivered = v; },
      getDelivered: () => delivered,
      setFinalBossDefeated: v => { finalBossDefeated = v; },
      setFinalBossPos: p => { finalBossPos = p; },
      setFinalBossEnt: e => { finalBossEnt = e; },
      getVictorySeq: () => victorySeq
    };
  `;

  const instrumentedSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(instrumentedSrc, sandbox, { filename: 'game.js' });

  sandbox.__dispatch = (type, e) => {
    const list = eventListeners.get(type) || [];
    for (const fn of list) fn(e);
  };

  return sandbox;
}

// ── 0. Sandbox Math 物件與 RNG 獨立隔離防護 ─────────────────────
test('M1-RUNTIME-0 Sandbox Math isolation: host Math.random is unpolluted and separate sandboxes have independent RNG', () => {
  const origHostRandom = Math.random;
  const env1 = loadGameSandbox();
  const env2 = loadGameSandbox();

  // 1. 各 sandbox 的 Math 均為獨立物件且原型繼承宿主 Math
  assert.notEqual(env1.Math, Math, 'sandbox 1 必須具備獨立的 Math 物件');
  assert.notEqual(env2.Math, Math, 'sandbox 2 必須具備獨立的 Math 物件');
  assert.notEqual(env1.Math, env2.Math, '不同 sandbox 間的 Math 物件必須相互隔離');

  // 2. 修改 sandbox 1 的 RNG
  env1.Math.random = () => 0.9999;
  assert.equal(env1.Math.random(), 0.9999, 'sandbox 1 採納其自有隨機生成器');

  // 3. 宿主 Math.random 與 sandbox 2 絕對不受污染
  assert.notEqual(env2.Math.random(), 0.9999, 'sandbox 2 的 RNG 絕對不可受到 sandbox 1 污染');
  assert.equal(Math.random, origHostRandom, '宿主全域之 Math.random 絕對不可被污染');
});

// ── 1. 選卡一次與陳舊 revision / 連按防重扣 ─────────────────────
test('M1-RUNTIME-1 Pick choice once, reject stale revision and rapid double-click without deducting XP', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 設置已持有 mut_crosscut 保證 3 選 1 包含被動卡，並觸發升級
  probe.setBuildMutations(['mut_crosscut']);
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const choices = probe.getChoices();

  // 0. 驗證 applyChoice 拒絕缺失 revision（不可 undefined 通行）
  const missingRevRes = probe.applyChoice(choices[0].choiceId, undefined);
  assert.equal(missingRevRes.ok, false, '缺失 revision 必須被拒絕');
  assert.equal(missingRevRes.reason, 'stale_revision', '缺失 revision 拒絕原因應為 stale_revision');

  // 1. 驗證當期被動 card.f() 第一次 true、第二次 false（一次性保護），且套效果但不扣 XP/不加等級，第二次呼叫數值不變
  const passiveChoice = choices.find(c => c.type === 'passive');
  assert.ok(passiveChoice, '候選中必須包含被動卡');
  const bBeforePassive = { ...probe.getB() };
  const xpBeforeP = probe.getXp();
  const lvlBeforeP = probe.getLevel();
  const pRes1 = passiveChoice.f();
  assert.equal(pRes1, true, '當期被動 card.f() 第一次執行應成功返回 true');
  assert.equal(probe.getXp(), xpBeforeP, 'card.f() 自身不可扣除 XP');
  assert.equal(probe.getLevel(), lvlBeforeP, 'card.f() 自身不可增加人物等級');
  const bAfterP1 = { ...probe.getB() };

  // 在同一個 revision 內再次呼叫同張被動卡
  const pRes2 = passiveChoice.f();
  assert.equal(pRes2, false, '當期被動 card.f() 第二次呼叫必須返回 false（一次性保護）');
  assert.deepEqual({ ...probe.getB() }, bAfterP1, '第二次被動呼叫後人物 b 屬性必須維持不變');
  assert.equal(probe.getXp(), xpBeforeP, '第二次被動呼叫後 XP 必須維持不變');
  assert.equal(probe.getLevel(), lvlBeforeP, '第二次被動呼叫後等級必須維持不變');

  // 重新觸發 offerUp 進行正式 applyChoice 測試
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const freshChoices = probe.getChoices();
  const initialRev = probe.getBuildRevision();
  const initialLevel = probe.getLevel();
  const initialXp = probe.getXp();
  const reqXp = probe.getXpNeed();
  const choiceToPick = freshChoices[0];

  // 第一次正常套用
  const res1 = probe.applyChoice(choiceToPick.choiceId, initialRev);
  assert.equal(res1.ok, true, '合法 revision 應套用成功');
  assert.equal(probe.getLevel(), initialLevel + 1, '等級應增加 1');
  assert.equal(probe.getXp(), initialXp - reqXp, 'XP 應扣除當前升級需求');
  assert.equal(probe.getState(), 'play', '套用後狀態應切回 play');

  const newRev = probe.getBuildRevision();
  assert.notEqual(newRev, initialRev, '成功套用後 buildRevision 必須遞增');

  // 驗證舊 card.f() 在成功套用/版本推進後立即失效
  const oldChoicePostApply = choiceToPick;
  const staleFRes = oldChoicePostApply.f();
  assert.equal(staleFRes, false, '成功套用後舊 card.f() 必須被閉包 revision 阻擋');

  // 模擬連按：再用已失效的 initialRev 嘗試套用第二次（陳舊回調/快速連按）
  probe.setState('levelup'); // 即使被外部置為 levelup
  probe.setLevelupCooldown(0);
  const xpBeforeDuplicate = probe.getXp();
  const levelBeforeDuplicate = probe.getLevel();

  const res2 = probe.applyChoice(choiceToPick.choiceId, initialRev);
  assert.equal(res2.ok, false, '陳舊 revision 必須被拒絕');
  assert.equal(res2.reason, 'stale_revision', '拒絕原因必須為 stale_revision');
  assert.equal(probe.getXp(), xpBeforeDuplicate, '陳舊調用絕對不可扣除 XP');
  assert.equal(probe.getLevel(), levelBeforeDuplicate, '陳舊調用絕對不可提升等級');
});

// ── 2. 滿 4 主動欄、滿級與覺醒印邊界保護 ───────────────────────
test('M1-RUNTIME-2 Maximum 4 active weapons, Lv5 awakened seal requirement, and max-level exclusion', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const wl = probe.getWL();
  // 初始只有妖刀
  assert.equal(wl.katana, 1);
  assert.equal(wl.barrier, 0);

  // 1. 學習到 4 主動欄位滿：katana(1), barrier(1), fire(1), boom(1)
  wl.barrier = 1;
  wl.fire = 1;
  wl.boom = 1;
  assert.equal(Object.keys(wl).filter(k => wl[k] > 0).length, 4, '主動技能已滿 4 欄');

  // 呼叫 getEligibleChoices，檢驗未持有的 thunder, needle 絕不出現
  probe.setLevelupCooldown(0);
  const eligible = probe.getEligibleChoices();
  const offeredWeaponIds = eligible.filter(c => c.type === 'weapon').map(c => c.id);
  assert.ok(!offeredWeaponIds.includes('thunder'), '滿 4 欄時未學習的 thunder 絕不可進池');
  assert.ok(!offeredWeaponIds.includes('needle'), '滿 4 欄時未學習的 needle 絕不可進池');

  // 2. 覺醒印邊界：將 katana 設為 Lv4，seals 設為 0
  wl.katana = 4;
  probe.setSeals(0);
  const choicesWithoutSeal = probe.getEligibleChoices();
  const katanaChoiceWithoutSeal = choicesWithoutSeal.find(c => c.id === 'katana');
  // 缺印時不提供 Lv5 覺醒卡
  if (katanaChoiceWithoutSeal) {
    assert.notEqual(katanaChoiceWithoutSeal.lv, 5, '缺覺醒印時不可提供 Lv5 覺醒卡');
  }

  // 3. 給予覺醒印：seals = 1，必定提供 Lv5 覺醒卡
  probe.setSeals(1);
  probe.setState('levelup');
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const choicesWithSeal = probe.getChoices();
  const katanaAwakenChoice = choicesWithSeal.find(c => c.id === 'katana' && c.lv === 5);
  assert.ok(katanaAwakenChoice, '當有覺醒印且武器達 Lv4 時，必須提供 Lv5 覺醒卡');

  // 套用覺醒
  const rev = probe.getBuildRevision();
  const resAwaken = probe.applyChoice(katanaAwakenChoice.choiceId, rev);
  assert.equal(resAwaken.ok, true, '合法覺醒應套用成功');
  assert.equal(wl.katana, 5, '妖刀等級應達到 Lv5');
  assert.equal(probe.getSeals(), 0, '覺醒應扣除 1 枚覺醒印');

  // 4. 滿級排除：達到 Lv5 的技能絕不再出現在候選中
  const choicesAfterMax = probe.getEligibleChoices();
  const katanaAfterMax = choicesAfterMax.find(c => c.id === 'katana');
  assert.equal(katanaAfterMax, undefined, '達 Lv5 滿級之技能必須從選卡池中完全排除');
});

// ── 3. 重抽 (reroll) 與重開 (start) revision 失效防線 ──────────
test('M1-RUNTIME-3 Reroll and start() invalidate previous revisions immediately', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();

  const revBeforeReroll = probe.getBuildRevision();
  const choiceBeforeReroll = probe.getChoices()[0];

  // 執行重抽
  probe.setLevelupCooldown(0);
  probe.reroll();
  const revAfterReroll = probe.getBuildRevision();
  assert.ok(revAfterReroll > revBeforeReroll, 'reroll 後 buildRevision 必須遞增推進');

  // 以重抽前的 revision 嘗試套用重抽前的卡片
  probe.setLevelupCooldown(0);
  const rejectReroll = probe.applyChoice(choiceBeforeReroll.choiceId, revBeforeReroll);
  assert.equal(rejectReroll.ok, false, 'reroll 前的舊 revision 必須被拒絕');
  assert.equal(rejectReroll.reason, 'stale_revision', '拒絕原因必須為 stale_revision');
  assert.equal(choiceBeforeReroll.f(), false, 'reroll 後直接呼叫舊 card.f() 必須無效');

  // 重新開局 start()
  const activeRev = probe.getBuildRevision();
  probe.start('night-town');
  const revAfterNewRun = probe.getBuildRevision();
  assert.ok(revAfterNewRun > activeRev, 'start() 開啟新局時 buildRevision 必須推進');

  // 舊局 revision 在新局使用必須被拒絕
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  const rejectCrossRun = probe.applyChoice(choiceBeforeReroll.choiceId, activeRev);
  assert.equal(rejectCrossRun.ok, false, '上一局的 revision 絕不可在新局生效');
  assert.equal(rejectCrossRun.reason, 'stale_revision');
  assert.equal(choiceBeforeReroll.f(), false, '新局直接呼叫舊局 card.f() 必須無效');
});

// ── 4. 空池安全續行與非法 choiceId 拒絕防護 ────────────────────
test('M1-RUNTIME-4 Empty choice pool continues safely and invalid choiceId is rejected', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 測試非法 choiceId
  probe.setState('levelup');
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const currentRev = probe.getBuildRevision();
  const xpBefore = probe.getXp();

  const invalidRes = probe.applyChoice('non_existent_skill_id', currentRev);
  assert.equal(invalidRes.ok, false, '不存在的 choiceId 必須被拒絕');
  assert.equal(invalidRes.reason, 'invalid_choice_id', '拒絕原因應為 invalid_choice_id');
  assert.equal(probe.getXp(), xpBefore, '非法 choiceId 不得扣除 XP');

  // 2. 測試空池安全續行
  // 透過修改 probe.getWL() 將所有 6 招全部設為 Lv5，且被動全部達上限，變異與御守滿槽，模擬真正所有候選耗盡之極限空池
  const wl = probe.getWL();
  for (const k of Object.keys(wl)) wl[k] = 5;
  const b = probe.getB();
  b.shield = 6;
  b.oilRegen = 0.12;
  b.heals = 3;
  b.dmgUp = 4;
  b.rate = 4;
  b.crit = 3;
  b.spd = 3;
  b.dash = 3;
  b.mag = 3;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_orbit', 'mut_splitblast']);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildDuos(['duo_thundercircle', 'duo_frostseal', 'duo_inkfire', 'duo_cinderseal']);

  // 在空池狀態下觸發 offerUp
  const levelBeforeEmpty = probe.getLevel();
  probe.setState('play');
  probe.setXp(50);
  probe.offerUp();
  probe.setLevelupCooldown(0);

  // 空池時應自動結算並安全回到 play
  assert.equal(probe.getState(), 'play', '空池時應安全切回 play，不卡在空白升級介面');
  assert.equal(probe.getLevel(), levelBeforeEmpty + 1, '空池應安全完成等級結算');
});

// ── 5. 攻擊快照 resolveAttackSpec 與飛行途中升級不回寫 ─────────
test('M1-RUNTIME-5 resolveAttackSpec snapshot isolation protects in-flight projectiles from mutation on upgrade', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const wl = probe.getWL();
  const b = probe.getB();
  const enemies = probe.getEnemies();

  // 設置妖刀 Lv5 覺醒
  wl.katana = 5;
  b.dmg = 1.0;
  b.rate = 0;

  // 驗證 resolveAttackSpec 返回之數值結構
  const spec = probe.resolveAttackSpec('katana', 5, probe.getBuildState());
  assert.equal(spec.skillId, 'katana');
  assert.equal(spec.level, 5);
  assert.equal(spec.isAwakened, true);
  assert.equal(spec.swingReach, 720);
  assert.equal(spec.maxTravel, 720);
  assert.equal(spec.pierceLimit, 6);
  assert.equal(spec.pierceScaleAfterThree, 0.75);
  assert.equal(spec.cooldown, 0.72);
  // 風刃基礎傷害公式：(b.dmg + 3.2) * 1.15 = (1.0 + 3.2) * 1.15 = 4.83
  assert.ok(Math.abs(spec.windDmg - 4.83) < 0.001);

  // 在玩家面前放置一隻怪物觸發斬擊與風刃
  enemies.push({
    x: p.x + 100,
    y: p.y,
    hp: 100,
    maxHp: 100,
    type: 'mob'
  });

  probe.setWT('katana', 0);
  probe.weapons(0.01); // 觸發一次攻擊更新

  const winds = probe.getWinds();
  assert.ok(winds.length > 0, 'Lv5 妖刀斬擊必須產生覺醒風刃');

  const inFlightWave = winds[0];
  const originalWaveDmg = inFlightWave.dmg;
  const originalMaxTravel = inFlightWave.maxTravel;
  assert.ok(Math.abs(originalWaveDmg - 4.83) < 0.001, '飛行中風刃必須讀取快照傷害');
  assert.equal(originalMaxTravel, 720, '飛行中風刃必須讀取快照射程');

  // 模擬飛行途中玩家獲得巨幅攻擊力提升（例如升級獲得 +10 攻擊）
  b.dmg += 10.0;

  // 重新獲取最新快照，最新快照數值已變
  const newSpec = probe.resolveAttackSpec('katana', 5, probe.getBuildState());
  assert.ok(newSpec.windDmg > 15.0, '新快照應反映當前最新人物數值');

  // 關鍵驗證：已在空中飛行的 inFlightWave 其 dmg 與 maxTravel 絕對不被回寫！
  assert.equal(inFlightWave.dmg, originalWaveDmg, '已生成風刃之傷害快照絕對不可被回溯改寫');
  assert.equal(inFlightWave.maxTravel, originalMaxTravel, '已生成風刃之射程快照絕對不可被回溯改寫');
});

// ── 6. 無變異基線與 BuildState 結構契約 ────────────────────────
test('M1-RUNTIME-6 BuildState shape contract and unmutated skill metadata specification', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. BuildState 初始結構契約
  const bs = probe.getBuildState();
  assert.equal(bs.schemaVersion, 1, 'schemaVersion 必須為 1');
  assert.deepEqual(Array.from(bs.activeSkills), ['katana'], '初始主動技能僅包含固定妖刀');
  assert.deepEqual(Array.from(bs.charms), [], '御守先為空集合');
  assert.deepEqual(Array.from(bs.mutations), [], '變異先為空集合');
  assert.deepEqual(Array.from(bs.duos), [], '共鳴先為空集合');

  // 2. 六招 Lv1–5 無變異基線 metadata 規格純淨度
  const SKILLS = ['katana', 'barrier', 'needle', 'boom', 'thunder', 'fire'];
  for (const sk of SKILLS) {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const s = probe.resolveAttackSpec(sk, lvl, bs);
      assert.equal(s.skillId, sk);
      assert.equal(s.level, lvl);
      assert.equal(s.isAwakened, lvl === 5);
      assert.equal(s.source, 'base');
    }
  }
});

// ── 7. choices 顯示契約安全檢驗（保留現役欄位安全呈現，無冗長 meta 破壞手機排版） ───
test('M1-RUNTIME-7 Choices display safety (clean card presentation, no v1 text branches for legacy cards, and revision tracking)', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setLevelupCooldown(0);
  const choices = probe.getEligibleChoices();
  assert.ok(choices.length > 0, '必須產出候選卡片');

  for (const c of choices) {
    // 既有基礎顯示欄位（保證現役 UI / 手機端乾淨呈現）
    assert.ok(typeof c.id === 'string', '必須有 id');
    assert.ok(typeof c.choiceId === 'string', '必須有 choiceId');
    assert.ok(c.type === 'weapon' || c.type === 'passive' || c.type === 'mutation' || c.type === 'charm', 'type 必須為合法卡片類型');
    assert.ok(typeof c.n === 'string', '必須有名稱 n');
    assert.ok(typeof c.s === 'string', '必須有副標 s');
    assert.ok(typeof c.cat === 'string', '必須有分類 cat');
    assert.ok(typeof c.levelText === 'string', '必須有 levelText');
    assert.ok(typeof c.d === 'string', '必須有說明 d');

    // 關鍵防線：現役舊卡絕不輸出 v1 增補文字欄位，防止 ui.js 進入「影響：xxx」或增補行而觸發手機端 P1 排版破版
    if (c.type === 'weapon' || c.type === 'passive') {
      assert.equal(c.skillIds, undefined, '現役舊卡不得輸出 skillIds 欄位以防止 UI 觸發手機 P1 破版');
      assert.equal(c.beforeText, undefined, '現役舊卡不得輸出 beforeText 欄位');
      assert.equal(c.afterText, undefined, '現役舊卡不得輸出 afterText 欄位');
      assert.equal(c.requirementText, undefined, '現役舊卡不得輸出 requirementText 欄位');
      assert.equal(c.limitText, undefined, '現役舊卡不得輸出 limitText 欄位');
    }

    assert.ok(typeof c.revision === 'number', '必須有 revision 數值');
    assert.ok(typeof c.ok === 'function', '必須有資格驗證函式 ok');
    assert.ok(typeof c.f === 'function', '必須有套用函式 f');
  }
});

// ── 8. UI.levelUpLayout 缺失時 fallback 現役座標與真事件命中 ──────────
test('M1-RUNTIME-8 LevelUp layout fallback to legacy bounds when UI.levelUpLayout is absent', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 確保 UI.levelUpLayout 不存在，測試 fallback 到現役標準佈局
  delete env.UI.levelUpLayout;

  const layout = probe.levelUpLayout();
  assert.deepEqual({ ...layout.card }, { x: 90, y: 176, w: 720, h: 108, gap: 14 }, '無 UI getter 時 card 佈局必須 fallback 至現役規格');
  assert.equal(layout.reroll, env.UI.REROLL_BTN, '無 UI getter 時 reroll 按鈕必須 fallback 至 UI.REROLL_BTN');

  // 觸發升級進入 levelup 狀態
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  assert.equal(probe.getState(), 'levelup', '狀態應處於 levelup');

  // 2. 真 Consumer 命中測試：卡片 0、1、2 與邊界負向點
  // 卡片 0：x: [90..810], y: [176..284]
  assert.equal(probe.hitLevelUpCard({ x: 100, y: 180 }), 0, '卡片 0 內部座標應命中 0');
  assert.equal(probe.hitLevelUpCard({ x: 90, y: 176 }), 0, '卡片 0 左上角邊界應命中 0');
  assert.equal(probe.hitLevelUpCard({ x: 810, y: 284 }), 0, '卡片 0 右下角邊界應命中 0');

  // 卡片 1：x: [90..810], y: [298..406] (176 + 122)
  assert.equal(probe.hitLevelUpCard({ x: 450, y: 350 }), 1, '卡片 1 內部座標應命中 1');

  // 卡片 2：x: [90..810], y: [420..528] (176 + 244)
  assert.equal(probe.hitLevelUpCard({ x: 450, y: 470 }), 2, '卡片 2 內部座標應命中 2');

  // 負向測試：卡片間隙 (gap)、左側、右側、上方、下方
  assert.equal(probe.hitLevelUpCard({ x: 450, y: 290 }), -1, '卡片 0 與 1 間隙處應判定為未命中 (-1)');
  assert.equal(probe.hitLevelUpCard({ x: 80, y: 200 }), -1, '卡片左側外部應判定為未命中 (-1)');
  assert.equal(probe.hitLevelUpCard({ x: 820, y: 200 }), -1, '卡片右側外部應判定為未命中 (-1)');
  assert.equal(probe.hitLevelUpCard({ x: 450, y: 170 }), -1, '卡片上方外部應判定為未命中 (-1)');
  assert.equal(probe.hitLevelUpCard({ x: 450, y: 540 }), -1, '卡片下方外部應判定為未命中 (-1)');

  // 3. 真 Consumer 重抽按鈕命中與負向測試
  // UI.REROLL_BTN 為 { x: 620, y: 538, w: 190, h: 44 }
  assert.equal(probe.hitLevelUpReroll({ x: 650, y: 550 }), true, '重抽按鈕內部應命中 true');
  assert.equal(probe.hitLevelUpReroll({ x: 500, y: 550 }), false, '重抽按鈕外部左側應為 false');
  assert.equal(probe.hitLevelUpReroll({ x: 650, y: 400 }), false, '重抽按鈕外部上方應為 false');

  // 4. 真 Pointer 事件 Consumer 驗證：點擊卡片 0 實際觸發 pickUp 並切回 play
  const initialLevel = probe.getLevel();
  env.__dispatch('pointerdown', {
    clientX: 200,
    clientY: 200,
    pointerType: 'mouse',
    button: 0,
    preventDefault() {},
    pointerId: 1
  });
  assert.equal(probe.getLevel(), initialLevel + 1, '點擊卡片 0 後等級應提升 1');
  assert.equal(probe.getState(), 'play', '成功選卡後狀態應切回 play');

  // 5. 真 Pointer 事件 Consumer 驗證：點擊重抽實際觸發 reroll
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  probe.setRerolls(1);
  const revBeforeReroll = probe.getBuildRevision();

  env.__dispatch('pointerdown', {
    clientX: 650,
    clientY: 550,
    pointerType: 'mouse',
    button: 0,
    preventDefault() {},
    pointerId: 1
  });
  assert.equal(probe.getRerolls(), 0, '點擊重抽熱區後 rerolls 應減 1');
  assert.notEqual(probe.getBuildRevision(), revBeforeReroll, '重抽後 buildRevision 必須遞增');
});

// ── 9. fake UI.levelUpLayout 給不同座標時采納新座標且舊座標不誤選 ───
test('M1-RUNTIME-9 LevelUp layout adopts UI.levelUpLayout coordinates and rejects obsolete legacy coordinates', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 注入新版客製化佈局（模擬 Muse 手機版或緊湊版卡片佈局）
  // 新卡片座標：x: 150, y: 220, w: 500, h: 90, gap: 20
  // 新重抽按鈕：x: 350, y: 600, w: 180, h: 40
  env.UI.levelUpLayout = () => {
    return {
      card: { x: 150, y: 220, w: 500, h: 90, gap: 20 },
      reroll: { x: 350, y: 600, w: 180, h: 40 }
    };
  };

  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  probe.setRerolls(1);
  assert.equal(probe.getState(), 'levelup');

  // 1. 舊現役座標負向驗證：舊卡片 0 (x: 100, y: 180) 在新佈局下絕對不可被誤選！
  assert.equal(probe.hitLevelUpCard({ x: 100, y: 180 }), -1, '舊卡片 0 座標 (100, 180) 在新佈局下必須未命中 (-1)');
  assert.equal(probe.hitLevelUpCard({ x: 750, y: 250 }), -1, '舊卡片寬度右界 (750) 超出新寬度 (650)，必須未命中 (-1)');

  // 舊重抽座標 (x: 650, y: 550) 在新佈局下絕對不可觸發重抽！
  assert.equal(probe.hitLevelUpReroll({ x: 650, y: 550 }), false, '舊重抽座標在全新佈局下必須為 false');

  // 2. 新佈局座標正向驗證：
  // 新卡 0：x: [150..650], y: [220..310]
  assert.equal(probe.hitLevelUpCard({ x: 200, y: 230 }), 0, '新卡片 0 內部應返回 0');
  // 新卡 1：x: [150..650], y: [330..420] (220 + 90 + 20)
  assert.equal(probe.hitLevelUpCard({ x: 200, y: 350 }), 1, '新卡片 1 內部應返回 1');
  // 新卡 2：x: [150..650], y: [440..530] (330 + 90 + 20)
  assert.equal(probe.hitLevelUpCard({ x: 200, y: 460 }), 2, '新卡片 2 內部應返回 2');
  // 新間隙：y: 315
  assert.equal(probe.hitLevelUpCard({ x: 200, y: 315 }), -1, '新卡片間隙處必須未命中 (-1)');
  // 新重抽按鈕：x: [350..530], y: [600..640]
  assert.equal(probe.hitLevelUpReroll({ x: 400, y: 610 }), true, '新重抽座標應返回 true');

  // 3. 真 Pointermove 事件 Consumer 驗證：
  // 移動到舊卡片座標，不應改變 focus
  probe.setLevelupFocus(0);
  env.__dispatch('pointermove', {
    clientX: 100,
    clientY: 180,
    pointerType: 'mouse',
    preventDefault() {},
    pointerId: 1
  });
  // 移動到新卡片 1 座標，focus 應切換為 1
  env.__dispatch('pointermove', {
    clientX: 200,
    clientY: 350,
    pointerType: 'mouse',
    preventDefault() {},
    pointerId: 1
  });
  assert.equal(probe.getLevelupFocus(), 1, '移動到新卡片 1 熱區後 levelupFocus 應更新為 1');

  // 4. 真 Pointerdown 事件 Consumer 負向與正向防護：
  // 點擊舊座標 (100, 180) 不會選卡，狀態保持 levelup
  const lvlBefore = probe.getLevel();
  env.__dispatch('pointerdown', {
    clientX: 100,
    clientY: 180,
    pointerType: 'mouse',
    button: 0,
    preventDefault() {},
    pointerId: 1
  });
  assert.equal(probe.getState(), 'levelup', '點擊已失效舊座標時遊戲狀態應保持 levelup');
  assert.equal(probe.getLevel(), lvlBefore, '點擊已失效舊座標時等級不可提升');

  // 點擊新卡片 1 座標 (200, 350)，成功選中卡片 1 並切換狀態
  env.__dispatch('pointerdown', {
    clientX: 200,
    clientY: 350,
    pointerType: 'mouse',
    button: 0,
    preventDefault() {},
    pointerId: 1
  });
  assert.equal(probe.getLevel(), lvlBefore + 1, '點擊新卡片 1 熱區後等級應提升 1');
  assert.equal(probe.getState(), 'play', '成功選中新熱區後狀態應切回 play');
});

// ── 10. 六招 Lv1–5 無變異真行為與邊界聚焦驗證 ───────────────────
test('M1-RUNTIME-10 Six baseline weapons behavior and critical boundary verification', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const enemies = probe.getEnemies();

  // [1] Katana: Lv5 風刃上限 8 體與世界射程 720
  probe.getWL().katana = 5;
  enemies.push({ x: p.x + 100, y: p.y, hp: 1000, maxHp: 1000, type: 'mob' });
  // 連續觸發斬擊產生風刃
  for (let i = 0; i < 15; i++) {
    probe.setWT('katana', 0);
    probe.weapons(0.01);
  }
  const winds = probe.getWinds();
  assert.equal(winds.length, 8, 'Katana Lv5 空中風刃上限嚴格鎖定 8 體');
  for (const w of winds) {
    assert.equal(w.maxTravel, 720, '每道風刃射程上限嚴格為 720');
  }

  // [2] Barrier: Lv5 220 範圍、1.8 秒緩速、不回油、不聚怪
  probe.start('night-town');
  probe.getWL().barrier = 5;
  probe.setOil(50);
  const p2 = probe.getP();
  const enemies2 = probe.getEnemies();
  // 敵人 A 在 200 距離（在 220 範圍內），敵人 B 在 250 距離（在 220 範圍外）
  const enemyIn = { x: p2.x + 200, y: p2.y, hp: 100, maxHp: 100, speed: 60, type: 'mob' };
  const enemyOut = { x: p2.x + 250, y: p2.y, hp: 100, maxHp: 100, speed: 60, type: 'mob' };
  enemies2.push(enemyIn, enemyOut);

  probe.setWT('barrier', 0);
  probe.weapons(0.01);

  assert.ok(enemyIn.hp < 100, '範圍 220 內敵人應受到傷害');
  assert.equal(enemyOut.hp, 100, '範圍 220 外敵人不可受到傷害');
  assert.equal(probe.getOil(), 50, 'Barrier Lv5 觸發絕對不可恢復油量');

  const sanctuary = probe.getSacredSanctuary();
  assert.ok(sanctuary, 'Barrier Lv5 必須生成退魔結界 sacredSanctuary');
  assert.equal(sanctuary.r, 220, '結界半徑必須為 220');
  assert.equal(sanctuary.maxLife, 1.8, '結界持續時間必須為 1.8 秒');
  assert.ok(enemyIn.x >= p2.x + 200, 'Barrier 絕對不產生聚怪/吸怪物理效果');

  // [3] Fire: Lv4 離體攻擊與 Lv5 墨焰黑龍 7.2 秒冷卻、3 球、焦土上限 3 處 5 秒
  probe.start('night-town');
  probe.getWL().fire = 4;
  const p3 = probe.getP();
  const enemies3 = probe.getEnemies();
  enemies3.push({ x: p3.x + 150, y: p3.y, hp: 100, maxHp: 100, type: 'mob' });
  probe.setWT('fire', 0);
  probe.weapons(0.01);
  const ghosts4 = probe.getGhosts();
  assert.ok(ghosts4.some(g => g.fireAttack), 'Fire Lv4 必須有其中一顆護火離體追敵');

  // Lv5 墨焰黑龍
  probe.start('night-town');
  probe.getWL().fire = 5;
  const p4 = probe.getP();
  const enemies4 = probe.getEnemies();
  enemies4.push({ x: p4.x + 200, y: p4.y, hp: 500, maxHp: 500, type: 'mob' });
  probe.setWT('fire', 0);
  probe.weapons(0.01);
  assert.equal(probe.getWMax().fire, 7.2, 'Fire Lv5 黑龍冷卻週期必須為 7.2 秒');
  const dragon = probe.getGhosts().find(g => g.dragon);
  assert.ok(dragon, 'Fire Lv5 必須召喚黑龍實體');

  // 推進至黑龍吐火 (age >= 0.60)，以短時步推進避免首發火球當幀直接落地結算
  probe.weapons(0.3);
  probe.weapons(0.31);
  const dragonShots = probe.getDragonShots();
  assert.equal(dragonShots.length, 3, '黑龍每次必定噴射 3 枚火球');

  // 推進火球落地形成焦土
  for (let t = 0; t < 10; t++) probe.weapons(0.2);
  const scorches = probe.getDragonScorches();
  assert.ok(scorches.length > 0 && scorches.length <= 3, '焦土上限最多 3 處');
  assert.equal(scorches[0].maxLife, 5, '焦土地面燃燒時間必須為 5 秒');

  // [4] Boom: 陰陽符黏附延爆單結算
  probe.start('night-town');
  probe.getWL().boom = 1;
  const p5 = probe.getP();
  const enemies5 = probe.getEnemies();
  const boomTarget = { x: p5.x + 100, y: p5.y, hp: 100, maxHp: 100, type: 'mob' };
  enemies5.push(boomTarget);
  probe.setWT('boom', 0);
  probe.weapons(0.01);

  const proj = probe.getProj();
  assert.equal(proj.length, 1, 'Boom Lv1 生成單枚咒符');
  // OFUDA 速度翻倍：飛行步長減半，避免測試單幀跨過原有 hitbox。
  probe.weapons(0.125);
  const talisman = proj[0];
  assert.equal(talisman.stuck, true, '咒符必須黏附於目標');
  assert.equal(talisman.target, boomTarget);

  // 引爆（推進超過 BOOM_FUSE 1.5 秒）
  const hpBeforeExplode = boomTarget.hp;
  probe.weapons(1.6);
  assert.equal(talisman.exploded, true, '咒符引爆後標記 exploded');
  assert.equal(talisman.done, true, '咒符引爆後標記 done');
  assert.ok(boomTarget.hp < hpBeforeExplode, '目標必須受到引爆傷害');

  // 驗證單次結算防護：再度推進時間，已 exploded 的咒符絕不可重複造成傷害
  const hpAfterExplode = boomTarget.hp;
  probe.weapons(0.5);
  assert.equal(boomTarget.hp, hpAfterExplode, '延爆咒符必須為單次結算，絕不重複結算');

  // [5] Thunder: 固定係數、目標數與三雷雲（不依生命比例秒殺）
  probe.start('night-town');
  probe.getWL().thunder = 3;
  const p6 = probe.getP();
  const enemies6 = probe.getEnemies();
  const tankEnemy = { x: p6.x + 150, y: p6.y, hp: 10000, maxHp: 10000, type: 'tank' };
  enemies6.push(tankEnemy);
  probe.setWT('thunder', 0);
  probe.weapons(0.01);
  // Lv3 固定係數為 4.5 倍率（b.dmg = 1.2 -> 5.4，若暴擊則為 5.4 * 1.8 = 9.72）
  const expectedDmgBase = 4.5 * 1.2;
  const actualHurt = 10000 - tankEnemy.hp;
  assert.ok(actualHurt > 0, '雷擊應造成傷害');
  assert.ok(
    Math.abs(actualHurt - 5.4) < 0.001 || Math.abs(actualHurt - 9.72) < 0.001,
    `天狐雷 Lv3 傷害 (${actualHurt}) 必須嚴格鎖定固定係數 4.5 * 1.2 (=5.4，暴擊為 9.72)，絕不依敵方 10000 HP 比例秒殺`
  );

  // Lv5 三朵雷雲
  probe.start('night-town');
  probe.getWL().thunder = 5;
  const p7 = probe.getP();
  const enemies7 = probe.getEnemies();
  const e1 = { x: p7.x + 100, y: p7.y, hp: 500, maxHp: 500, type: 'mob' };
  const e2 = { x: p7.x + 200, y: p7.y, hp: 500, maxHp: 500, type: 'mob' };
  const e3 = { x: p7.x + 300, y: p7.y, hp: 500, maxHp: 500, type: 'mob' };
  enemies7.push(e1, e2, e3);
  probe.setWT('thunder', 0);
  probe.weapons(0.01);
  assert.ok(e1.hp < 500 && e2.hp < 500 && e3.hp < 500, 'Lv5 建御雷神應同時鎖定並打擊 3 個目標');

  // [6] Needle: Lv5 追蹤冰針、八發與有限殉爆預算不連鎖
  probe.start('night-town');
  probe.getWL().needle = 5;
  const p8 = probe.getP();
  const enemies8 = probe.getEnemies();
  enemies8.push({ x: p8.x + 100, y: p8.y, hp: 100, maxHp: 100, type: 'mob' });
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const needlesLv5 = probe.getNeedles();
  assert.equal(needlesLv5.length, 8, 'Needle Lv5 極寒靈暴必定生成 8 發冰針');
  assert.equal(needlesLv5[0].ice, true, 'Needle Lv5 必須具有冰封屬性');
  assert.equal(needlesLv5[0].curve, true, 'Needle Lv5 必須具有弧線/追蹤屬性');
  assert.ok(needlesLv5[0].volley, 'Needle Lv5 必須自帶殉爆預算器');
  assert.equal(needlesLv5[0].volley.used, false, '初始殉爆預算未被觸發');
});

// ── 11. 靈針真快照 resolveAttackSpec 與投射消費隔離 ──────────────
test('M1-RUNTIME-11 Needle attack spec snapshot isolation, hit deduplication, and lifecycle cleanup', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. resolveAttackSpec('needle', level, buildState) 真參數結構與規格驗證
  const bs = probe.getBuildState();
  const specLv1 = probe.resolveAttackSpec('needle', 1, bs);
  assert.equal(specLv1.skillId, 'needle');
  assert.equal(specLv1.level, 1);
  assert.equal(specLv1.isAwakened, false);
  assert.equal(specLv1.source, 'base');
  assert.equal(specLv1.count, 3, 'Lv1 靈針數量必須為 3');
  assert.equal(specLv1.speed, 640, '靈針速度必須為 640');
  assert.equal(specLv1.spread, 0.45, 'Lv1 散射角為 0.45');
  assert.equal(specLv1.life, 0.65, 'Lv1 存活時間為 0.65');
  assert.equal(specLv1.range, 440, '靈針索敵射程為 440');
  assert.equal(specLv1.tracking, false, 'Lv1 不具追蹤特性');
  assert.equal(specLv1.frost, false, 'Lv1 不具冰封特性');
  assert.equal(specLv1.derivation, 'none', '派生屬性為 none');
  assert.ok(Math.abs(specLv1.baseDamage - 2.1) < 0.001, 'Lv1 baseDamage 應為 2.1');
  assert.ok(Math.abs(specLv1.damage - 2.1 * 1.2) < 0.001, 'Lv1 damage 應為 baseDamage * b.dmg (2.52)');

  const specLv5 = probe.resolveAttackSpec('needle', 5, bs);
  assert.equal(specLv5.level, 5);
  assert.equal(specLv5.isAwakened, true);
  assert.equal(specLv5.count, 8, 'Lv5 靈針數量必須為 8');
  assert.equal(specLv5.spread, 1.35, 'Lv5 散射角為 1.35');
  assert.equal(specLv5.life, 0.95, 'Lv5 存活時間為 0.95');
  assert.equal(specLv5.tracking, true, 'Lv5 具備追蹤特性');
  assert.equal(specLv5.frost, true, 'Lv5 具備冰封特性');
  assert.ok(Math.abs(specLv5.baseDamage - 4.9) < 0.001, 'Lv5 baseDamage 應為 4.9');

  // 2. 投射生成快照隔離：飛行途中升級或改人物屬性，飛行中靈針絕不被回寫
  probe.start('night-town');
  probe.getWL().needle = 1;
  const p = probe.getP();
  const enemies = probe.getEnemies();
  enemies.push({ x: p.x + 300, y: p.y, hp: 500, maxHp: 500, type: 'mob' });

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needlesWave1 = probe.getNeedles();
  assert.equal(needlesWave1.length, 3, '第一波發射 3 發靈針');
  const inFlightNeedle = needlesWave1[0];
  const origDmg = inFlightNeedle.dmg;
  const origBaseDmg = inFlightNeedle.baseDmg;
  const origLevel = inFlightNeedle.level;
  const origSpeed = inFlightNeedle.speed;
  assert.ok(Math.abs(origDmg - 2.52) < 0.001, '飛行中靈針傷害快照為 2.52');

  // 途中玩家升級：技能升至 Lv3，人物攻擊力暴增 +5.0
  probe.getWL().needle = 3;
  probe.getB().dmg += 5.0;

  // 關鍵驗證：已在空中飛行的靈針屬性絕對不可被改寫！
  assert.equal(inFlightNeedle.dmg, origDmg, '空中靈針 dmg 快照不可被回溯改寫');
  assert.equal(inFlightNeedle.baseDmg, origBaseDmg, '空中靈針 baseDmg 快照不可被回溯改寫');
  assert.equal(inFlightNeedle.level, origLevel, '空中靈針 level 快照不可被回溯改寫');
  assert.equal(inFlightNeedle.speed, origSpeed, '空中靈針 speed 快照不可被回溯改寫');

  // 3. 再發新針驗證：新發射的靈針採納最新 spec 數值
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const allNeedles = probe.getNeedles();
  const newWaveNeedle = allNeedles[allNeedles.length - 1];
  const expectedNewDmg = (1.4 + 3 * 0.7) * (1.2 + 5.0); // 3.5 * 6.2 = 21.7
  assert.equal(newWaveNeedle.level, 3, '新靈針應為 Lv3');
  assert.ok(Math.abs(newWaveNeedle.dmg - expectedNewDmg) < 0.001, '新靈針應讀取升級後之最新傷害');

  // 4. 命中同敵去重驗證
  probe.start('night-town');
  probe.getWL().needle = 1;
  const p2 = probe.getP();
  const testEnemy = { x: p2.x + 50, y: p2.y, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(testEnemy);

  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const activeNeedles = probe.getNeedles();
  const targetNeedle = activeNeedles[0];
  // 僅保留該發靈針進行單針命中去重驗證，排除同扇形其他發靈針干擾
  activeNeedles.length = 1;

  // 推進至擊中敵人
  probe.weapons(0.05);
  assert.ok(targetNeedle.hits.has(testEnemy), '靈針命中後必須將敵人加入 hits 去重集合');
  const hpAfterHit1 = testEnemy.hp;
  assert.ok(hpAfterHit1 < 100, '首次命中應造成傷害');

  // 再次推進一幀（靈針仍在敵人範圍內，且模擬 inb 冷卻已過）
  testEnemy.inb = 0;
  probe.weapons(0.01);
  assert.equal(testEnemy.hp, hpAfterHit1, '同發靈針命中同敵後不可重複造成傷害（去重保護）');

  // 5. 重開 (start) 清理生命週期驗證
  assert.ok(probe.getNeedles().length > 0, '重開前存在靈針');
  probe.start('night-town');
  assert.equal(probe.getNeedles().length, 0, '重開後靈針陣列必須清空');
});

// ── 12. 六招 Lv1–5 全 30 組真實行為觀測矩陣 ─────────────────────
test('M1-RUNTIME-12 Six baseline weapons Lv1–Lv5 complete 30-case matrix of real behavior, cooldown, count, range, and fixed damage multipliers', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;

  function setupIsolatedWeapon(skillId, lvl) {
    probe.start('night-town');
    const wl = probe.getWL();
    for (const k of Object.keys(wl)) wl[k] = 0;
    wl[skillId] = lvl;
    probe.setWT(skillId, 0);
    // 控制沙盒自有 RNG 消除暴擊擾動，保證傷害嚴格等於公式基線 (rollCrit chance <= 0.5, 0.99 絕不暴擊)
    env.Math.random = () => 0.99;
    assert.notEqual(Math.random(), 0.99, '宿主全域之 Math.random 保持純淨未受污染');
  }

  // [Katana Lv1–4]
  const katanaMatrix = [
    { lvl: 1, reach: 145, dmg: 1.2, cd: 0.72 },
    { lvl: 2, reach: 161, dmg: 2.0, cd: 0.72 },
    { lvl: 3, reach: 177, dmg: 2.8, cd: 0.72 },
    { lvl: 4, reach: 193, dmg: 3.6, cd: 0.72 }
  ];
  for (const { lvl, reach, dmg, cd } of katanaMatrix) {
    setupIsolatedWeapon('katana', lvl);
    const p = probe.getP();
    p.faceAng = 0;
    const enemyIn = { x: p.x + reach - 5, y: p.y, hp: 100, maxHp: 100, type: 'mob' };
    const enemyOut = { x: p.x + reach + 20, y: p.y, hp: 100, maxHp: 100, type: 'mob' };
    probe.getEnemies().push(enemyIn, enemyOut);

    probe.weapons(0.01);
    assert.equal(probe.getWMax().katana, cd, `Katana Lv${lvl} 冷卻應為 ${cd}`);
    assert.ok(Math.abs((100 - enemyIn.hp) - dmg) < 0.001, `Katana Lv${lvl} 命中應造成 ${dmg} 傷害 (實際: ${100 - enemyIn.hp})`);
    assert.equal(enemyOut.hp, 100, `Katana Lv${lvl} 超出 reach ${reach} 外的敵人不應受傷`);
  }

  // [Katana Lv5]
  {
    setupIsolatedWeapon('katana', 5);
    const p = probe.getP();
    p.faceAng = 0;
    const enemy = { x: p.x + 300, y: p.y, hp: 100, maxHp: 100, type: 'mob' };
    probe.getEnemies().push(enemy);
    probe.weapons(0.01);
    assert.equal(probe.getWMax().katana, 0.72, 'Katana Lv5 冷卻應為 0.72');
    const winds = probe.getWinds();
    assert.equal(winds.length, 1, 'Katana Lv5 應釋放風刃');
    assert.ok(Math.abs(winds[0].dmg - 5.06) < 0.001, 'Katana Lv5 風刃傷害應為 5.06');
    assert.equal(winds[0].maxTravel, 720, 'Katana Lv5 風刃射程應為 720');
    assert.equal(winds[0].pierceLimit, 6, 'Katana Lv5 穿透上限應為 6');
    // 推進風刃擊中 300 處的敵人
    probe.weapons(0.2);
    assert.ok(Math.abs((100 - enemy.hp) - 5.06) < 0.001, 'Katana Lv5 風刃實際命中造成 5.06 傷害');
  }

  // [Barrier Lv1–5]
  const barrierMatrix = [
    { lvl: 1, r: 168, cd: 2.78, dmg: 0.48, kb: 0 },
    { lvl: 2, r: 196, cd: 2.36, dmg: 0.80, kb: 0 },
    { lvl: 3, r: 224, cd: 1.94, dmg: 1.12, kb: 0 },
    { lvl: 4, r: 252, cd: 1.52, dmg: 1.44, kb: 90 },
    { lvl: 5, r: 220, cd: 3.20, dmg: 4.50, kb: 100 }
  ];
  for (const { lvl, r, cd, dmg, kb } of barrierMatrix) {
    setupIsolatedWeapon('barrier', lvl);
    const p = probe.getP();
    const enemyIn = { x: p.x + r - 8, y: p.y, hp: 100, maxHp: 100, speed: 60, type: 'mob' };
    const enemyOut = { x: p.x + r + 20, y: p.y, hp: 100, maxHp: 100, speed: 60, type: 'mob' };
    probe.getEnemies().push(enemyIn, enemyOut);

    probe.weapons(0.01);
    assert.ok(Math.abs(probe.getWMax().barrier - cd) < 0.001, `Barrier Lv${lvl} 冷卻應為 ${cd}`);
    assert.ok(Math.abs((100 - enemyIn.hp) - dmg) < 0.001, `Barrier Lv${lvl} 命中應造成 ${dmg} 傷害 (實際: ${100 - enemyIn.hp})`);
    assert.equal(enemyOut.hp, 100, `Barrier Lv${lvl} 超出半徑 ${r} 外的敵人不應受傷`);
    if (kb > 0) {
      assert.ok(enemyIn.knockQueue && enemyIn.knockQueue.length > 0, `Barrier Lv${lvl} 應在 enemyIn 壓入擊退佇列`);
      assert.equal(enemyIn.knockQueue[0].remaining, kb, `Barrier Lv${lvl} 擊退距離應為 ${kb}`);
    }
    if (lvl === 5) {
      const s = probe.getSacredSanctuary();
      assert.ok(s, 'Barrier Lv5 應生成退魔結界');
      assert.equal(s.r, 220, '退魔結界半徑應為 220');
      assert.equal(s.maxLife, 1.8, '退魔結界存活時間應為 1.8');
    }
  }

  // [Needle Lv1–5]
  const needleMatrix = [
    { lvl: 1, count: 3, cd: 1.09, dmg: 2.52, ice: false, curve: false },
    { lvl: 2, count: 5, cd: 0.93, dmg: 3.36, ice: false, curve: false },
    { lvl: 3, count: 7, cd: 0.77, dmg: 4.20, ice: false, curve: false },
    { lvl: 4, count: 8, cd: 0.61, dmg: 5.04, ice: false, curve: false },
    { lvl: 5, count: 8, cd: 0.65, dmg: 5.88, ice: true, curve: true }
  ];
  for (const { lvl, count, cd, dmg, ice, curve } of needleMatrix) {
    setupIsolatedWeapon('needle', lvl);
    const p = probe.getP();
    p.faceAng = 0;
    probe.weapons(0.01);
    assert.ok(Math.abs(probe.getWMax().needle - cd) < 0.001, `Needle Lv${lvl} 冷卻應為 ${cd}`);
    const needles = probe.getNeedles();
    assert.equal(needles.length, count, `Needle Lv${lvl} 發射數量應為 ${count}`);
    for (const nd of needles) {
      assert.ok(Math.abs(nd.dmg - dmg) < 0.001, `Needle Lv${lvl} 靈針傷害快照應為 ${dmg}`);
      assert.equal(nd.ice, ice, `Needle Lv${lvl} ice 屬性應為 ${ice}`);
      assert.equal(nd.curve, curve, `Needle Lv${lvl} curve 屬性應為 ${curve}`);
    }
  }

  // [Boom Lv1–5]
  const boomMatrix = [
    { lvl: 1, count: 1, cd: 1.76, r: 78, fuse: 1.5, dmg: 2.64 },
    { lvl: 2, count: 2, cd: 1.52, r: 92, fuse: 1.5, dmg: 3.48 },
    { lvl: 3, count: 3, cd: 1.28, r: 108, fuse: 1.5, dmg: 4.32 },
    { lvl: 4, count: 4, cd: 1.04, r: 122, fuse: 1.5, dmg: 5.16 },
    { lvl: 5, count: 2, cd: 1.60, r: 135, fuse: 1.5, dmg: 6.00 }
  ];
  for (const { lvl, count, cd, r, fuse, dmg } of boomMatrix) {
    setupIsolatedWeapon('boom', lvl);
    const p = probe.getP();
    const target = { x: p.x + 100, y: p.y, hp: 100, maxHp: 100, type: 'mob' };
    probe.getEnemies().push(target);

    probe.weapons(0.01);
    assert.ok(Math.abs(probe.getWMax().boom - cd) < 0.001, `Boom Lv${lvl} 冷卻應為 ${cd}`);
    const proj = probe.getProj();
    assert.equal(proj.length, count, `Boom Lv${lvl} 投擲符咒數應為 ${count}`);
    // OFUDA：只將飛行速度由 440 翻倍；下方冷卻／引信／傷害斷言維持原值。
    assert.equal(proj[0].speed, 880, `Boom Lv${lvl} 真投射物須使用雙倍飛行速度`);
    assert.ok(Math.abs(Math.hypot(proj[0].vx, proj[0].vy) - 880) < 1e-6, `Boom Lv${lvl} 真速度向量須為 880`);

    // 飛行命中並黏附（以精確步長推進確保扇形彈道碰撞判定）
    for (let step = 0; step < 5; step++) probe.weapons(0.05);
    const stuckList = proj.filter(q => q.stuck);
    assert.ok(stuckList.length >= 1, `Boom Lv${lvl} 至少有 1 枚符咒黏附目標`);
    const stuck = stuckList[0];
    assert.ok(stuck.fuse > 0 && stuck.fuse <= fuse, `Boom Lv${lvl} fuse 應以 ${fuse} 秒基準倒數 (當前: ${stuck.fuse})`);

    // 推進至爆炸 (超過 fuse 1.5 秒)，驗證黏附之符咒全額結算
    const hitCount = stuckList.length;
    probe.weapons(1.6);
    assert.equal(stuck.exploded, true, `Boom Lv${lvl} 符咒應標記 exploded`);
    assert.ok(Math.abs((100 - target.hp) - dmg * hitCount) < 0.001, `Boom Lv${lvl} 引爆傷害應為單符 ${dmg} * 命中 ${hitCount} 枚 = ${dmg * hitCount} (實際: ${100 - target.hp})`);
  }

  // [Thunder Lv1–5]
  const thunderMatrix = [
    { lvl: 1, targets: 1, mult: 2.0, dmg: 2.4, r: 190, cd: 2.25 },
    { lvl: 2, targets: 2, mult: 3.0, dmg: 3.6, r: 270, cd: 2.00 },
    { lvl: 3, targets: 3, mult: 4.5, dmg: 5.4, r: 350, cd: 2.00 },
    { lvl: 4, targets: 3, mult: 6.0, dmg: 7.2, r: 450, cd: 2.00 },
    { lvl: 5, targets: 3, mult: 8.0, dmg: 9.6, r: 450, cd: 2.40 }
  ];
  for (const { lvl, targets, mult, dmg, r, cd } of thunderMatrix) {
    setupIsolatedWeapon('thunder', lvl);
    const p = probe.getP();
    // 建立 4 個在半徑 r 內的敵人和 1 個在半徑 r 外的敵人
    const inRangeEnemies = [];
    if (lvl === 5) {
      // Lv5 三朵雷雲每朵半徑 90，間隔 110px 配置 4 隻 450 射程內之敵人
      for (let i = 0; i < 4; i++) {
        inRangeEnemies.push({ x: p.x + 100 + i * 110, y: p.y, hp: 1000, maxHp: 1000, type: 'mob' });
      }
    } else {
      // Lv1–4 配置多隻在 r 半徑內的敵人以驗證 targets 上限截斷
      const countInside = Math.min(4, Math.floor((r - 60) / 25));
      for (let i = 0; i < countInside; i++) {
        inRangeEnemies.push({ x: p.x + 60 + i * 25, y: p.y, hp: 1000, maxHp: 1000, type: 'mob' });
      }
    }
    const outEnemy = { x: p.x + r + 30, y: p.y, hp: 1000, maxHp: 1000, type: 'mob' };
    probe.getEnemies().push(...inRangeEnemies, outEnemy);

    probe.weapons(0.01);
    assert.ok(Math.abs(probe.getWMax().thunder - cd) < 0.001, `Thunder Lv${lvl} 冷卻應為 ${cd}`);
    assert.equal(outEnemy.hp, 1000, `Thunder Lv${lvl} 超出半徑 ${r} 外的敵人不應受雷擊`);

    const hitEnemies = inRangeEnemies.filter(e => e.hp < 1000);
    assert.equal(hitEnemies.length, targets, `Thunder Lv${lvl} 應嚴格鎖定命中 ${targets} 個目標`);
    for (const e of hitEnemies) {
      const hurtDmg = 1000 - e.hp;
      assert.ok(Math.abs(hurtDmg - dmg) < 0.001, `Thunder Lv${lvl} 傷害應嚴格鎖定固定係數 ${mult} * 1.2 = ${dmg} (實際: ${hurtDmg})`);
    }
  }

  // [Fire Lv1–5]
  const fireMatrix = [
    { lvl: 1, count: 1, contactDmg: 2.16 },
    { lvl: 2, count: 2, contactDmg: 2.88 },
    { lvl: 3, count: 3, contactDmg: 3.60 },
    { lvl: 4, count: 3, contactDmg: 4.32 + 6.84 }, // 環繞 4.32 + 首幀生成之離體式神 6.84 = 11.16
    { lvl: 5, count: 3, contactDmg: 5.04 }
  ];
  for (const { lvl, count, contactDmg } of fireMatrix) {
    setupIsolatedWeapon('fire', lvl);
    const p = probe.getP();
    // 環繞軌道接觸傷害 (FIRE_ORBIT = 98)
    const orbitEnemy = { x: p.x + 98, y: p.y, hp: 100, maxHp: 100, type: 'mob' };
    probe.getEnemies().push(orbitEnemy);

    probe.weapons(0.01);
    assert.ok(Math.abs((100 - orbitEnemy.hp) - contactDmg) < 0.001, `Fire Lv${lvl} 環繞接觸傷害應為 ${contactDmg} (實際: ${100 - orbitEnemy.hp})`);
  }

  // Fire Lv4 離體追擊限制驗證
  {
    setupIsolatedWeapon('fire', 4);
    const p = probe.getP();
    // 敵人置於環繞軌道外 (距離 200)，在索敵 520 範圍內
    const enemy = { x: p.x + 200, y: p.y, hp: 100, maxHp: 100, type: 'mob' };
    probe.getEnemies().push(enemy);
    probe.weapons(0.01);
    const ghosts = probe.getGhosts();
    const detached = ghosts.find(g => g.fireAttack);
    assert.ok(detached, 'Fire Lv4 必須有 1 顆離體追擊式神');
    assert.equal(detached.returning, false, '離體前 returning 為 false');

    // 推進時間讓式神擊中敵人並折返（以 0.05 秒幀步推進確保碰撞）
    for (let step = 0; step < 10; step++) probe.weapons(0.05);
    assert.ok(detached.returning, '命中敵人後式神標記 returning 折返');
    const expectedDmg = (2.1 + 4 * 0.9) * 1.2; // 6.84
    assert.ok(Math.abs((100 - enemy.hp) - expectedDmg) < 0.001, `Fire Lv4 離體攻擊傷害應為 ${expectedDmg} (實際: ${100 - enemy.hp})`);
  }

  // Fire Lv5 黑龍、3 球、焦土上限 3 處 5 秒限制驗證
  {
    setupIsolatedWeapon('fire', 5);
    const p = probe.getP();
    const enemy = { x: p.x + 250, y: p.y, hp: 500, maxHp: 500, type: 'mob' };
    probe.getEnemies().push(enemy);
    probe.weapons(0.01);
    assert.equal(probe.getWMax().fire, 7.2, 'Fire Lv5 黑龍冷卻週期必須為 7.2 秒');
    const dragon = probe.getGhosts().find(g => g.dragon);
    assert.ok(dragon, 'Fire Lv5 必須生成黑龍');

    // 推進至黑龍吐火 (age >= 0.60)
    probe.weapons(0.3);
    probe.weapons(0.31);
    const shots = probe.getDragonShots();
    assert.equal(shots.length, 3, '黑龍每次必定噴射 3 枚火球');

    // 推進火球落地形成焦土
    for (let t = 0; t < 10; t++) probe.weapons(0.2);
    const scorches = probe.getDragonScorches();
    assert.ok(scorches.length > 0 && scorches.length <= 3, '焦土上限最多 3 處');
    assert.equal(scorches[0].maxLife, 5, '焦土地面燃燒時間必須為 5 秒');
    assert.ok(Math.abs(scorches[0].tick - 0.6) < 0.001, '焦土每次跳動間隔必須為 0.6 秒');
  }
});

// ── 13. 真實 frame 與 update 狀態路徑驗證 ────────────────────────
test('M1-RUNTIME-13 Real frame and update state paths: pause and levelup freeze needle movement and damage; lost and won do not retain ghost damage on restart', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;

  // 1. 暫停狀態 (pause)：經真實 update(dt) 與 runFrame(now) 驗證靈針不位移、不造成傷害
  probe.start('night-town');
  probe.getWL().needle = 1;
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  assert.equal(needles.length, 3, '發射 3 發靈針');
  const nd = needles[0];
  const origX = nd.x;
  const origY = nd.y;

  // 在靈針正前方放置敵人
  const p = probe.getP();
  const pausedEnemy = { x: origX + 30, y: origY, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(pausedEnemy);

  // 切換為 pause 狀態
  probe.setState('pause');
  assert.equal(probe.getState(), 'pause');

  // 推進真實 update(dt) 與 runFrame(now) 多幀
  for (let f = 0; f < 10; f++) {
    probe.update(0.05);
    probe.runFrame(1000 + f * 50);
  }

  // 驗證：靈針位置完全未變動，且敵人血量分毫不減！
  assert.equal(nd.x, origX, '暫停狀態下靈針 x 座標絕對不可變動');
  assert.equal(nd.y, origY, '暫停狀態下靈針 y 座標絕對不可變動');
  assert.equal(pausedEnemy.hp, 100, '暫停狀態下靈針絕對不對敵人造成傷害');

  // 2. 選卡狀態 (levelup)：經真實 update(dt) 與 runFrame(now) 驗證靈針維持凍結
  probe.setState('levelup');
  assert.equal(probe.getState(), 'levelup');

  for (let f = 0; f < 10; f++) {
    probe.update(0.05);
    probe.runFrame(2000 + f * 50);
  }

  assert.equal(nd.x, origX, '選卡狀態下靈針 x 座標絕對不可變動');
  assert.equal(nd.y, origY, '選卡狀態下靈針 y 座標絕對不可變動');
  assert.equal(pausedEnemy.hp, 100, '選卡狀態下靈針絕對不對敵人造成傷害');

  // 3. 恢復為 play 狀態：靈針正常飛行並對敵人結算傷害
  probe.setState('play');
  assert.equal(probe.getState(), 'play');

  for (let i = 0; i < 4; i++) probe.update(0.025);
  assert.ok(nd.x > origX, '恢復 play 狀態後靈針正常向前飛行');
  assert.ok(pausedEnemy.hp < 100, '恢復 play 狀態後靈針正常命中敵人造成傷害');

  // 4. 死亡狀態 (lost) 與重開 (start)：無幽靈傷害殘留
  // 再次發射靈針
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  assert.ok(probe.getNeedles().length > 0, '死亡前場上存在飛行中的靈針');

  // 觸發死亡流程
  probe.loseRun();
  assert.equal(probe.getState(), 'lampout');

  // 推進燈滅序列至 lost
  for (let f = 0; f < 60; f++) {
    probe.updateLampSequence(0.05);
    probe.runFrame(3000 + f * 50);
  }
  assert.equal(probe.getState(), 'lost', '燈滅結束後狀態應轉為 lost');

  // 驗證 lost 狀態下 runFrame 與 update 均不運作武器，靈針保持凍結（注意：needles 在 lost 期間停止運算，待 start() 才能徹底清空）
  assert.ok(probe.getNeedles().length > 0, 'lost 狀態下先前發射的靈針保留在陣列中（不即時清空）');
  const ghostTestEnemy = { x: origX + 30, y: origY, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(ghostTestEnemy);
  for (let f = 0; f < 5; f++) {
    probe.update(0.05);
    probe.runFrame(4000 + f * 50);
  }
  assert.equal(ghostTestEnemy.hp, 100, 'lost 狀態下 update 與 runFrame 不運作武器，靈針凍結不傷敵');

  // 玩家重開新一局：由 start() 徹底清空靈針
  probe.start('night-town');
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getNeedles().length, 0, 'start() 重開後場上靈針必須徹底清空為 0');

  // 在前一局靈針曾經過的位置放置新怪，驗證絕無上一局的幽靈靈針殘留傷害
  const newEnemy = { x: origX + 30, y: origY, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(newEnemy);
  for (let i = 0; i < 4; i++) probe.update(0.025);
  assert.equal(newEnemy.hp, 100, '新局絕對不可受到前一局靈針之幽靈判定傷害');

  // 5. 勝利狀態 (won)：建立破曉與終王死亡前置，零配送仍能自然進入 won
  probe.start('night-town');
  probe.getWL().needle = 1;
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const victoryNeedles = probe.getNeedles();
  assert.ok(victoryNeedles.length > 0, '進入勝利流程前場上存在飛行中的靈針');
  const vicNd = victoryNeedles[0];

  // night-town 新勝利契約：破曉且終王死亡，配送不是門檻。
  const pVic = probe.getP();
  probe.setDelivered(0);
  probe.setFinalBossDefeated(true);
  probe.setElapsed(require('../js/config.js').RUN_SECONDS);
  probe.setFinalBossPos({ x: pVic.x + 100, y: pVic.y });
  probe.setFinalBossEnt({ type: 'boss', final: true, hp: 0, max: 500, x: pVic.x + 100, y: pVic.y });

  // 推進真實 update(dt)，觸發 line 2495 之自然勝利轉場
  probe.update(0.05);
  assert.equal(probe.getState(), 'victory', '達成勝利條件後自然轉入 victory 狀態');

  // 記錄進入 victory 狀態時靈針之確切座標，驗證演出至結算全流程保持凍結
  const vicOrigPos = { x: vicNd.x, y: vicNd.y };

  // 在靈針前方放置敵人，驗證 victory 演出期間武器不運算、靈針凍結不傷敵（注意：needles 在 victory/won 期間停止更新，待 start() 才能徹底清空）
  const vicEnemy = { x: vicOrigPos.x + 30, y: vicOrigPos.y, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(vicEnemy);

  // 推進真實 runFrame 循環，讓 updateVictorySequence(dt) 自然累積演出時間 (VICTORY.settle = 5.0 秒)
  let vicNow = 5000;
  for (let f = 0; f < 110; f++) {
    vicNow += 50; // 50ms 步長
    probe.runFrame(vicNow);
  }

  // 關鍵驗證：演出自然完成後轉入 won，絕無手動 probe.setState('won')！
  assert.equal(probe.getState(), 'won', '勝利演出推進達 5.0 秒後自然轉為 won 狀態');
  assert.ok(probe.getNeedles().length > 0, 'won 狀態下靈針保留在陣列中（不即時清空）');
  assert.equal(vicNd.x, vicOrigPos.x, 'won 狀態下靈針位置保持凍結，不產生位移');
  assert.equal(vicEnemy.hp, 100, 'won 狀態下靈針絕不對敵人造成傷害');

  // 再次 start() 驗證重開乾淨清空
  probe.start('night-town');
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getNeedles().length, 0, 'start() 重開後場上靈針必須徹底清空為 0');

  // 放置新怪並推進時間，確認無上一局幽靈殘留傷害
  const cleanEnemy = { x: vicOrigPos.x + 30, y: vicOrigPos.y, hp: 100, maxHp: 100, type: 'mob' };
  probe.getEnemies().push(cleanEnemy);
  for (let i = 0; i < 4; i++) probe.update(0.025);
  assert.equal(cleanEnemy.hp, 100, '新局絕對不殘留上一局勝利時靈針之幽靈判定傷害');
});
