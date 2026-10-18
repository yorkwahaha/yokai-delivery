// AGY M1-D-R1: 妖刀・十字交斬 (mut_crosscut) 真 Consumer 與每技能變異容量契約測試
//
// 驗收標準：
// 1. 每技能容量獨立：每技能最多 3 種變異（needle 滿 3 變異不阻擋 katana 取得 mut_crosscut）。
// 2. 卡池接線與選卡資格：未持妖刀不進池，持有妖刀正常進池，choiceId 為 mutation:katana:mut_crosscut，applyChoice 正確寫入 BuildState.mutations。
// 3. resolveAttackSpec 快照一致性：無變異 100% 保持基線，有變異時正確輸出 crosscutDelay(0.16)、crosscutDmg(0.60*slashDmg)、crosscutReach、crosscutArc(1.15)、crosscutAngleOffset(0.42*pi)、derivationDepth(0)、source('mutation')。
// 4. weapons(dt) 實體延遲觸發與快照隔離：0.16s 延遲觸發，發動時快照座標與朝向，延遲途中玩家移動/轉向不污染交叉斬位置與方向。
// 5. 傷害預算最壞上界與側翼波及：主斬+側斬命中同一敵人時總傷為 1.40*slashDmg (<= 1.50x，非 2.0x 免費複製)；側翼未中主斬敵承受完整 0.60*slashDmg；命中 Set 去重。
// 6. Lv5 覺醒風刃不重複派生：主斬產生 1 道風刃，交叉斬（derivationDepth: 1）絕不再次產生第二道風刃或連鎖 Duo。
// 7. 狀態機與生命週期清理：pause/levelup 不計時傷，lost/won/start 時 crosscuts 佇列清空無幽靈傷害。
// 8. 負向保護：stale revision 拒絕、連按雙擊防重扣 XP、reroll 推進 revision 使舊卡失效、未知 choiceId 拒絕。

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

  let lcgState = typeof options.seed === 'number' ? (options.seed >>> 0) : 1;
  const lcgRand = () => {
    lcgState = (Math.imul(lcgState, 1664525) + 1013904223) >>> 0;
    return lcgState / 4294967296;
  };
  const sandboxMath = Object.create(Math);
  sandboxMath.random = typeof options.random === 'function'
    ? options.random
    : (typeof options.seed === 'number' ? lcgRand : () => Math.random());

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
    Event: typeof Event !== 'undefined' ? Event : class Event { constructor(type) { this.type = type; } },
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
  env.__setRngSeed = s => {
    lcgState = (s >>> 0);
    sandboxMath.random = lcgRand;
  };

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
    getCam: () => (sandbox.__agyProbe ? { x: sandbox.__agyProbe.getP().x, y: sandbox.__agyProbe.getP().y } : { x: 900, y: 600 }),
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
      setEnemies: arr => { enemies = arr; },
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
      getSkillMutations: (skillId, list) => getSkillMutations(skillId, list),
      addMutation: id => addMutation(id),
      removeMutation: id => removeMutation(id),
      getBuildCharms: () => buildCharms,
      setBuildCharms: list => { buildCharms = Array.isArray(list) ? [...list] : []; buildRevision++; },
      getBuildDuos: () => buildDuos,
      setBuildDuos: list => { buildDuos = Array.isArray(list) ? [...list] : []; buildRevision++; },
      addDuo: id => addDuo(id),
      removeDuo: id => removeDuo(id),
      getEligibleChoices: () => getEligibleChoices(),
      resolveAttackSpec: (id, lvl, bs, opt) => resolveAttackSpec(id, lvl, bs, opt),
      getCrosscuts: () => crosscuts,
      setCrosscuts: arr => { crosscuts = arr; },
      getBarrierPulses: () => barrierPulses,
      setBarrierPulses: arr => { barrierPulses = arr; },
      getSacredSanctuary: () => sacredSanctuary,
      setSacredSanctuary: s => { sacredSanctuary = s; },
      getWinds: () => winds,
      getNeedles: () => needles,
      getGhosts: () => ghosts,
      setGhosts: arr => { ghosts = arr; },
      getDragonShots: () => dragonShots,
      setDragonShots: arr => { dragonShots = arr; },
      getDragonScorches: () => dragonScorches,
      setDragonScorches: arr => { dragonScorches = arr; },
      getFAng: () => fAng,
      setFAng: v => { fAng = v; },
      getProj: () => proj,
      setProj: arr => { proj = arr; },
      getSplitblasts: () => splitblasts,
      setSplitblasts: arr => { splitblasts = arr; },
      getDuoShockwaves: () => duoShockwaves,
      setDuoShockwaves: arr => { duoShockwaves = arr; },
      getInkfireMarks: () => (typeof inkfireMarks !== 'undefined' ? inkfireMarks : []),
      setInkfireMarks: arr => { if (typeof inkfireMarks !== 'undefined') inkfireMarks = arr; },
      explodeTalisman: q => explodeTalisman(q),
      loseRun: () => loseRun(),
      startVictorySequence: () => startVictorySequence(),
      restartCleanup: () => restartCleanup(),
      update: dt => update(dt),
      runFrame: dt => runFrame(dt),
      setRngSeed: s => {
        if (typeof window.__setRngSeed === 'function') window.__setRngSeed(s);
      },
      MUTATION_CONFIG: MUTATION_CONFIG
    };
  `;

  const instrumentedSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(instrumentedSrc, sandbox, { filename: 'game.js' });

  return sandbox;
}

// ── 1. 每技能變異容量獨立與 mut_crosscut 選卡資格／schema 驗證 ────
test('M1-D-1 Per-skill mutation capacity (3 per skill) and mut_crosscut pool eligibility/schema/applyChoice', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. MUTATION_CONFIG 規格驗證
  const cfg = probe.MUTATION_CONFIG.mut_crosscut;
  assert.ok(cfg, 'MUTATION_CONFIG 必須包含 mut_crosscut');
  assert.equal(cfg.id, 'mut_crosscut');
  assert.equal(cfg.skillId, 'katana');
  assert.deepEqual(Array.from(cfg.skillIds), ['katana']);
  assert.equal(cfg.inPool, true);
  assert.equal(cfg.cat, '【 妖刀變異 】');
  assert.equal(cfg.levelText, '◆ 妖刀變異');
  assert.ok(typeof cfg.n === 'string' && cfg.n.length > 0);
  assert.ok(typeof cfg.s === 'string' && cfg.s.length > 0);
  assert.ok(typeof cfg.d === 'string' && cfg.d.length > 0);
  assert.ok(typeof cfg.requirementText === 'string');
  assert.ok(typeof cfg.limitText === 'string');

  // 2. 未持有妖刀時絕不可進池
  probe.getWL().katana = 0;
  const unownedChoices = probe.getEligibleChoices();
  assert.ok(unownedChoices.every(c => c.id !== 'mut_crosscut'), '未持有妖刀時絕不可出 mut_crosscut');

  // 3. 持有妖刀時合法進池，且 schema 完整
  probe.getWL().katana = 1;
  const eligibleChoices = probe.getEligibleChoices();
  const crosscutCard = eligibleChoices.find(c => c.id === 'mut_crosscut');
  assert.ok(crosscutCard, '持有妖刀時 mut_crosscut 必須能出現在候選池');
  assert.equal(crosscutCard.type, 'mutation');
  assert.equal(crosscutCard.choiceId, 'mutation:katana:mut_crosscut');
  assert.equal(crosscutCard.skillId, 'katana');
  assert.deepEqual(Array.from(crosscutCard.skillIds), ['katana']);
  assert.equal(crosscutCard.cat, '【 妖刀變異 】');
  assert.equal(crosscutCard.levelText, '◆ 妖刀變異');
  assert.equal(crosscutCard.rarity, 'mutation');
  assert.equal(crosscutCard.revision, probe.getBuildRevision());
  assert.equal(typeof crosscutCard.ok, 'function');
  assert.equal(typeof crosscutCard.f, 'function');

  // 4. 每技能容量獨立：needle 變異已滿 3 個，katana 仍能合法取得 mut_crosscut
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  assert.equal(probe.getSkillMutations('needle').length, 3, 'needle 變異已滿 3');
  assert.equal(probe.getSkillMutations('katana').length, 0, 'katana 變異目前為 0');
  const choicesWithNeedleFull = probe.getEligibleChoices();
  const crosscutAvailable = choicesWithNeedleFull.find(c => c.id === 'mut_crosscut');
  assert.ok(crosscutAvailable, 'needle 變異滿 3 個時，katana 變異 mut_crosscut 依然可正常進池');

  // 5. 真實 applyChoice 寫入 BuildState.mutations
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.setChoices([crosscutAvailable]);
  const rev = probe.getBuildRevision();
  const applyRes = probe.applyChoice(crosscutAvailable.choiceId, rev);
  assert.equal(applyRes.ok, true, 'applyChoice 必須成功選取 mut_crosscut');
  assert.ok(probe.getBuildState().mutations.includes('mut_crosscut'), 'BuildState.mutations 必須包含 mut_crosscut');
  assert.equal(probe.getBuildState().mutations.length, 4, '總變異為 4（needle 3 + katana 1）');

  // 6. 已持有後不可重複進池
  const choicesAfterAcquire = probe.getEligibleChoices();
  assert.ok(choicesAfterAcquire.every(c => c.id !== 'mut_crosscut'), '已持有 mut_crosscut 不得再次進池');
});

// ── 2. resolveAttackSpec 快照一致性與 baseline 保持 ────────────
test('M1-D-2 resolveAttackSpec katana snapshot consistency, mutation fields, and baseline preservation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const bsBase = { ...probe.getBuildState(), mutations: [] };
  const bsCrosscut = { ...probe.getBuildState(), mutations: ['mut_crosscut'] };

  // 1. 無變異 baseline 比較（Lv1 到 Lv5）
  for (let lvl = 1; lvl <= 5; lvl++) {
    const specBase = probe.resolveAttackSpec('katana', lvl, bsBase);
    assert.equal(specBase.skillId, 'katana');
    assert.equal(specBase.level, lvl);
    assert.equal(specBase.source, 'base');
    assert.equal(specBase.hasCrosscut, false);
    assert.equal(specBase.derivationDepth, 0);

    // 2. 有變異規格比較
    const specCrosscut = probe.resolveAttackSpec('katana', lvl, bsCrosscut);
    assert.equal(specCrosscut.skillId, 'katana');
    assert.equal(specCrosscut.level, lvl);
    assert.equal(specCrosscut.source, 'mutation');
    assert.equal(specCrosscut.hasCrosscut, true);
    assert.equal(specCrosscut.derivationDepth, 0);
    assert.equal(specCrosscut.crosscutDelay, 0.16);
    assert.equal(specCrosscut.crosscutArc, 1.15);
    assert.equal(specCrosscut.crosscutAngleOffset, Math.PI * 0.42);

    // 傷害與距離公式驗證
    const expectedDmg = Number((specBase.slashDmg * 0.60).toFixed(2));
    assert.equal(specCrosscut.crosscutDmg, expectedDmg, `Lv${lvl} crosscutDmg 應為 0.60 * slashDmg`);
    const expectedReach = lvl === 5 ? 220 : Math.round(specBase.reach * 0.90);
    assert.equal(specCrosscut.crosscutReach, expectedReach, `Lv${lvl} crosscutReach 應為 ${expectedReach}`);

    // 主斬各核心屬性完全不被變異破壞
    assert.equal(specCrosscut.slashDmg, specBase.slashDmg);
    assert.equal(specCrosscut.reach, specBase.reach);
    assert.equal(specCrosscut.arc, specBase.arc);
    assert.equal(specCrosscut.cooldown, specBase.cooldown);
    assert.equal(specCrosscut.windDmg, specBase.windDmg);
  }
});

// ── 3. weapons(dt) 實體延遲觸發（0.16s）與快照位置／角度隔離 ──────
test('M1-D-3 weapons(dt) 0.16s delay execution and snapshot isolation against player movement/turning', () => {
  // 固定 Math.random 為 0.99，排除爆擊干擾
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 1;
  probe.setBuildMutations(['mut_crosscut']);

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0; // 朝向正右 (+X)

  // 放置一個敵人 e1 在原快照側向交叉斬範圍內：
  // 交叉斬偏轉角為 0 + 0.42*pi (約 75.6 度)，距離 100 px
  const crossAng = Math.PI * 0.42;
  const targetX = 200 + Math.cos(crossAng) * 100;
  const targetY = 200 + Math.sin(crossAng) * 100;
  const e1 = { x: targetX, y: targetY, hp: 100, max: 100, type: 'mob' };

  // 放置一個敵人 eMain 在主斬扇形內（朝向 0，距離 100 px）以觸發主斬揮擊
  const eMain = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([eMain, e1]);

  probe.setWT('katana', 0);
  // 幀 1：觸發主斬，此時 crosscuts 隊列推入 1 個延遲攻擊
  probe.weapons(0.01);

  const crosscuts = probe.getCrosscuts();
  assert.equal(crosscuts.length, 1, '主斬揮出後必須排入 1 道 crosscut');
  const cc = crosscuts[0];
  assert.equal(cc.delay, 0.15, '0.16 - 0.01 = 0.15');
  assert.equal(cc.x, 200, '快照 X 座標必須為 200');
  assert.equal(cc.y, 200, '快照 Y 座標必須為 200');
  assert.equal(cc.crossAng, Math.PI * 0.42, '快照角度必須為 0.42*pi');

  // 在延遲途中（尚未到 0.16s）：玩家移動到極遠處 (800, 800) 並轉向反方向 (Math.PI)
  p.x = 800;
  p.y = 800;
  p.faceAng = Math.PI;

  // 前進 0.08 秒（累積 0.09 秒，尚未達 0.16 秒）
  probe.weapons(0.08);
  assert.equal(crosscuts.length, 1, '延遲時間未滿，crosscuts 仍在庫等待');
  assert.equal(e1.hp, 100, '延遲期間敵人不可提前受創');

  // 放置一個新敵人在玩家新位置 (800, 800) 的交叉角方向
  const eNew = { x: 800 + Math.cos(Math.PI + crossAng) * 100, y: 800 + Math.sin(Math.PI + crossAng) * 100, hp: 100, max: 100, type: 'mob' };
  probe.getEnemies().push(eNew);

  // 再前進 0.08 秒（累積 0.17 秒，超過 0.16 秒，觸發交叉斬）
  probe.weapons(0.08);

  assert.equal(probe.getCrosscuts().length, 0, '交叉斬觸發後自佇列移除');
  // 驗證快照隔離：e1 在原 (200, 200) 附近受到交叉斬傷害；玩家新位置的 eNew 完全不受影響
  assert.ok(e1.hp < 100, '原快照位置附近的敵人 e1 必須被交叉斬命中');
  assert.equal(eNew.hp, 100, '玩家新位置的 eNew 絕不得受到原位置斬擊傷害');
});

// ── 4. 傷害預算最壞上界（<= 1.40x）、側翼波及與去重 ────────────
test('M1-D-4 Damage budget cap (<= 1.40x for dual hit), flank full hit (0.60x), and single-slash deduplication', () => {
  // 固定 Math.random 為 0.99，排除爆擊
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 1;
  probe.setBuildMutations(['mut_crosscut']);

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0; // 朝右

  const spec = probe.resolveAttackSpec('katana', 1, probe.getBuildState());
  const slashDmg = spec.slashDmg; // 1.2
  const flankDmgExpected = spec.crosscutDmg; // 0.72 (0.60 * 1.2)
  const mainPlusCrossExpected = Number((slashDmg + slashDmg * 0.40).toFixed(2)); // 1.2 + 0.48 = 1.68 (1.40x)

  // 目標 A（雙中目標）：位於正前方偏側，角度 0.40 rad（主斬 arc 1.22 內，交叉斬 arc 1.15 / offset 1.32 邊緣以內）
  // 為了精確測試雙中：直接將 targetBoth 的參照放入 mainHits，或置於兩者重疊扇區
  // 主斬角度 0 (範圍 -1.22 ~ +1.22)；側斬角度 1.32 (範圍 1.32 - 1.15 = 0.17 ~ 2.47)
  // 重疊角度區間：0.17 rad ~ 1.22 rad！選擇 angle = 0.60 rad (約 34度)
  const angleBoth = 0.60;
  const targetBoth = { x: 200 + Math.cos(angleBoth) * 100, y: 200 + Math.sin(angleBoth) * 100, hp: 100, max: 100, type: 'mob' };

  // 目標 B（僅側翼）：角度 1.50 rad（主斬 arc 1.22 以外，但在側斬 0.17~2.47 內）
  const angleFlank = 1.50;
  const targetFlank = { x: 200 + Math.cos(angleFlank) * 100, y: 200 + Math.sin(angleFlank) * 100, hp: 100, max: 100, type: 'mob' };

  probe.setEnemies([targetBoth, targetFlank]);

  probe.setWT('katana', 0);
  // 幀 1：發動主斬
  probe.weapons(0.01);

  // 驗證主斬階段傷害
  const damageBothPhase1 = Number((100 - targetBoth.hp).toFixed(2));
  const damageFlankPhase1 = Number((100 - targetFlank.hp).toFixed(2));
  assert.equal(damageBothPhase1, slashDmg, '雙中目標在主斬階段受到完整 slashDmg');
  assert.equal(damageFlankPhase1, 0, '側翼目標超出主斬扇區，主斬階段不受傷害');

  // 推進 0.16 秒觸發交叉斬
  probe.weapons(0.16);

  // 驗證總結算傷害
  const totalDamageBoth = Number((100 - targetBoth.hp).toFixed(2));
  const totalDamageFlank = Number((100 - targetFlank.hp).toFixed(2));

  // 1. 雙中目標總傷害預算約束：嚴格受限於 1.40x slashDmg (<= 1.50x，絕非 2.0x 免費複製)
  assert.equal(totalDamageBoth, mainPlusCrossExpected, `雙中總傷應為 ${mainPlusCrossExpected} (1.40x)`);
  assert.ok(totalDamageBoth <= slashDmg * 1.50, '雙中總傷不得超過 1.50x');
  assert.ok(totalDamageBoth < slashDmg * 2.0, '雙中總傷絕非 2.0x');

  // 2. 側翼目標獲得完整 0.60x 側斬傷
  assert.equal(totalDamageFlank, flankDmgExpected, `側翼目標獲得完整側斬傷 ${flankDmgExpected}`);

  // 3. 去重防護：同一次交叉斬在後續幀中絕不重複造成傷害
  const hpBothAfter = targetBoth.hp;
  const hpFlankAfter = targetFlank.hp;
  probe.weapons(0.05);
  assert.equal(targetBoth.hp, hpBothAfter, '後續幀不重複造成傷害');
  assert.equal(targetFlank.hp, hpFlankAfter, '後續幀不重複造成傷害');
});

// ── 5. Lv5 覺醒風刃不重複派生（derivationDepth 保護） ────────────
test('M1-D-5 Lv5 awakened katana wind wave never duplicated by crosscut (derivationDepth protection)', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 5;
  probe.setBuildMutations(['mut_crosscut']);

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0;

  // 放置敵人在前方引導揮擊
  const e = { x: 300, y: 200, hp: 500, max: 500, type: 'mob' };
  probe.setEnemies([e]);

  probe.setWT('katana', 0);
  // 幀 1：發動 Lv5 主斬
  probe.weapons(0.01);

  const winds = probe.getWinds();
  assert.equal(winds.length, 1, 'Lv5 主斬必須且僅能產生 1 道風刃');
  assert.equal(winds[0].derivationDepth || 0, 0, '主風刃 derivationDepth 為 0');

  // 推進至 0.16s 觸發交叉斬
  probe.weapons(0.16);

  // 交叉斬衍生深度 derivationDepth: 1，絕不產生第二道風刃
  assert.equal(probe.getWinds().length, 1, '交叉斬觸發後，風刃總數依然恰為 1 道，絕不重複派生');
});

// ── 6. 狀態機生命週期清理（pause/levelup 凍結，lost/won/start 清空） ──
test('M1-D-6 State machine lifecycle protection: freeze during pause/levelup, cleared on lost/won/start', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 1;
  probe.setBuildMutations(['mut_crosscut']);

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0;

  const e = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([e]);

  probe.setWT('katana', 0);
  probe.weapons(0.01);
  assert.equal(probe.getCrosscuts().length, 1, '隊列中有 1 道等待中的交叉斬');

  // 1. 暫停狀態：update(dt) 凍結，delay 不減少
  probe.setState('pause');
  const delayBeforePause = probe.getCrosscuts()[0].delay;
  probe.update(0.10);
  assert.equal(probe.getCrosscuts()[0].delay, delayBeforePause, 'pause 狀態下 update() 不計時');

  // 2. 升級狀態：update(dt) 凍結
  probe.setState('levelup');
  probe.update(0.10);
  assert.equal(probe.getCrosscuts()[0].delay, delayBeforePause, 'levelup 狀態下 update() 不計時');

  // 3. 失敗結算 (loseRun)：隊列清空無幽靈傷害
  probe.setState('play');
  probe.loseRun();
  assert.equal(probe.getCrosscuts().length, 0, 'loseRun 必須清空 crosscuts 隊列');

  // 4. 再次觸發並測試勝利序列 (startVictorySequence)
  probe.setState('play');
  probe.setWT('katana', 0);
  probe.weapons(0.01);
  assert.equal(probe.getCrosscuts().length, 1);
  probe.startVictorySequence();
  assert.equal(probe.getCrosscuts().length, 0, 'startVictorySequence 必須清空 crosscuts 隊列');

  // 5. 重新開局 (start) 徹底清零
  probe.setCrosscuts([{ delay: 0.1 }]);
  probe.start('night-town');
  assert.equal(probe.getCrosscuts().length, 0, 'start() 必須清空 crosscuts 隊列');
});

// ── 7. 隊列上限保護（<= 4）與負向防護（stale revision/連按/reroll/未知ID）──
test('M1-D-7 Queue cap protection (<= 4) and negative protections against stale revision, rapid double-click, and unknown ID', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 隊列上限保護：直接推入 4 個，第 5 個無法推入
  probe.getWL().katana = 1;
  probe.setBuildMutations(['mut_crosscut']);
  probe.setCrosscuts([
    { delay: 0.1 }, { delay: 0.1 }, { delay: 0.1 }, { delay: 0.1 }
  ]);
  assert.equal(probe.getCrosscuts().length, 4);

  const e = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([e]);
  probe.setWT('katana', 0);
  probe.weapons(0.01);
  assert.equal(probe.getCrosscuts().length, 4, '隊列達到上限 4 時不得繼續推入');

  // 2. 負向保護：applyChoice
  probe.setCrosscuts([]);
  probe.setBuildMutations([]);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);

  const eligible = probe.getEligibleChoices();
  const crosscutCard = eligible.find(c => c.id === 'mut_crosscut');
  assert.ok(crosscutCard);
  probe.setChoices([crosscutCard]);

  // A. 拒絕陳舊 revision
  const staleRes = probe.applyChoice(crosscutCard.choiceId, 99999);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');

  // B. 拒絕未知 choiceId
  const unknownRes = probe.applyChoice('mutation:katana:unknown_fake_id', crosscutCard.revision);
  assert.equal(unknownRes.ok, false);
  assert.equal(unknownRes.reason, 'invalid_choice_id');

  // C. 第一次選取成功
  const successRes = probe.applyChoice(crosscutCard.choiceId, crosscutCard.revision);
  assert.equal(successRes.ok, true);

  // D. 連按雙擊防重扣：第二次呼叫已離開 levelup（state 已為 play）
  const doubleClickRes = probe.applyChoice(crosscutCard.choiceId, crosscutCard.revision);
  assert.equal(doubleClickRes.ok, false);
  assert.equal(doubleClickRes.reason, 'not_in_levelup');

  // E. reroll 推進 revision 使未選卡片失效
  probe.setBuildMutations([]);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.setChoices(probe.getEligibleChoices());
  const cardBeforeReroll = probe.getChoices().find(c => c.id === 'mut_crosscut');
  assert.ok(cardBeforeReroll);
  const revBeforeReroll = cardBeforeReroll.revision;

  probe.reroll();
  probe.setLevelupCooldown(0);
  assert.ok(probe.getBuildRevision() > revBeforeReroll, 'reroll 必須推進 revision');

  const staleAfterReroll = probe.applyChoice(cardBeforeReroll.choiceId, revBeforeReroll);
  assert.equal(staleAfterReroll.ok, false);
  assert.equal(staleAfterReroll.reason, 'stale_revision');
});

// ── 8. M1-D-8 真 crit applyChoice 前後舊 cc 暴擊率隔離＋新攻擊正向受益 ────
test('M1-D-8 Real crit applyChoice upgrade isolation for in-flight crosscut and positive crit benefit for new attack', () => {
  // 固定 Math.random 為 0.3
  // 當 critLvl = 0 時：chance = Math.min(0.5, 0.2 + 0 * 0.15) = 0.20。0.3 >= 0.20 => 不爆擊 (mult: 1.0)
  // 當 critLvl = 1 時：chance = Math.min(0.5, 0.2 + 1 * 0.15) = 0.35。0.3 < 0.35 => 爆擊 (mult: 1.8)
  const env = loadGameSandbox({ random: () => 0.3 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0;

  probe.getWL().katana = 1;
  probe.setBuildMutations(['mut_crosscut']);

  // 將其他被動設為上限，但保持 crit = 0，確保候選池必然包含 passive:crit
  const b = probe.getB();
  b.shield = 6;
  b.oilRegen = 0.12;
  b.heals = 3;
  b.dmgUp = 4;
  b.rate = 4;
  b.crit = 0;
  b.spd = 3;
  b.dash = 3;
  b.mag = 3;

  // 設置前置怪物以觸發主斬，並在側翼放置目標
  const front = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };
  const flankAngle = 1.5;
  const flank = {
    x: 200 + Math.cos(flankAngle) * 100,
    y: 200 + Math.sin(flankAngle) * 100,
    hp: 100,
    max: 100,
    type: 'mob'
  };
  probe.setEnemies([front, flank]);

  // 1. 幀 1：發動攻擊，生成在途舊 crosscut (此時 b.crit = 0)
  probe.setWT('katana', 0);
  probe.weapons(0.01);

  assert.equal(probe.getCrosscuts().length, 1, '必須排入 1 道延遲交叉斬');
  // 防止在延遲期間自動產生新攻擊
  probe.setWT('katana', 10);

  // 2. 模擬升級並選取真暴擊卡
  const choices = probe.getEligibleChoices();
  const critCard = choices.find(c => c.id === 'crit' || c.choiceId?.includes('crit'));
  assert.ok(critCard, '候選卡池中必須包含真 crit 暴擊卡');
  probe.setChoices([critCard]);
  probe.setXp(probe.getXpNeed());
  probe.setState('levelup');
  probe.setLevelupCooldown(0);

  const applyRes = probe.applyChoice(critCard.choiceId, critCard.revision);
  assert.equal(applyRes.ok, true, '選取暴擊卡必須成功');
  assert.equal(probe.getB().crit, 1, 'b.crit 必須升為 1');

  // 3. 推進時間觸發舊 crosscut
  probe.weapons(0.16);

  // 驗證快照隔離：舊 crosscut 發動時應採用當時快照的 critLvl=0，不因升級回寫而暴擊
  // 若回寫新 b.crit=1：則 0.3 < 0.35 觸發暴擊，側傷變為 0.72 * 1.8 = 1.296 (RED)
  // 正確快照隔離：不暴擊，側傷嚴格為 0.72 (GREEN)
  const flankDamageOld = Number((100 - flank.hp).toFixed(2));
  assert.equal(flankDamageOld, 0.72, '舊在途交叉斬必須受快照保護，不得回寫新取得的暴擊');

  // 4. 驗證新攻擊正向受益：升級後的下一輪揮擊應正常享受 b.crit=1 暴擊加成
  probe.setWT('katana', 0);
  const newFlank = {
    x: 200 + Math.cos(flankAngle) * 100,
    y: 200 + Math.sin(flankAngle) * 100,
    hp: 100,
    max: 100,
    type: 'mob'
  };
  probe.setEnemies([front, newFlank]);

  // 新攻擊揮擊並排入新 crosscut
  probe.weapons(0.01);
  probe.setWT('katana', 10);
  assert.equal(probe.getCrosscuts().length, 1);

  // 推進 0.16s 觸發新 crosscut
  probe.weapons(0.16);

  // 新攻擊在 b.crit=1 下，chance=0.35 > 0.3，必然觸發暴擊 (0.72 * 1.8 = 1.296)
  const flankDamageNew = Number((100 - newFlank.hp).toFixed(3));
  assert.equal(flankDamageNew, 1.296, '新發動的交叉斬必須正確享受升級後的暴擊效果');
});

// ── 9. 射程/角度邊界、敵人結界護盾與死亡不受傷負向驗證 ────────
test('M1-D-9 Range/angle boundary limits, enemy shield protection, and dead enemy damage immunity', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 1;
  probe.setBuildMutations(['mut_crosscut']);

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0;

  const spec = probe.resolveAttackSpec('katana', 1, probe.getBuildState());
  const reach = spec.crosscutReach; // Lv1 為 Math.round(145 * 0.90) = 131
  const arc = spec.crosscutArc;     // 1.15
  const crossAng = Math.PI * 0.42;

  // 1. 射程邊界測試：
  // 剛好超出射程 (reach + 15)
  const eOutOfRange = {
    x: 200 + Math.cos(crossAng) * (reach + 15),
    y: 200 + Math.sin(crossAng) * (reach + 15),
    hp: 100,
    max: 100,
    type: 'mob'
  };
  // 剛好在射程內 (reach - 10)
  const eInsideRange = {
    x: 200 + Math.cos(crossAng) * (reach - 10),
    y: 200 + Math.sin(crossAng) * (reach - 10),
    hp: 100,
    max: 100,
    type: 'mob'
  };

  // 2. 角度邊界測試：
  // 偏轉角超出 arc (crossAng + arc + 0.20)
  const angleOut = crossAng + arc + 0.20;
  const eOutOfArc = {
    x: 200 + Math.cos(angleOut) * 80,
    y: 200 + Math.sin(angleOut) * 80,
    hp: 100,
    max: 100,
    type: 'mob'
  };

  // 3. 護盾防護 (shield: true)：受到攻擊結界抵擋，hp 不扣除
  const eShielded = {
    x: 200 + Math.cos(crossAng) * 60,
    y: 200 + Math.sin(crossAng) * 60,
    hp: 100,
    max: 100,
    shield: true,
    type: 'boss'
  };

  // 4. 已死亡敵人 (hp <= 0)：不重複受到傷害或負數結算
  const eDead = {
    x: 200 + Math.cos(crossAng) * 70,
    y: 200 + Math.sin(crossAng) * 70,
    hp: 0,
    max: 100,
    type: 'mob'
  };

  // 用於引發主斬的主目標
  const eFront = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };

  probe.setEnemies([eFront, eOutOfRange, eInsideRange, eOutOfArc, eShielded, eDead]);

  probe.setWT('katana', 0);
  probe.weapons(0.01);
  probe.weapons(0.16);

  // 斷言
  assert.equal(eOutOfRange.hp, 100, '超出射程邊界的敵人不得受到交叉斬傷害');
  assert.ok(eInsideRange.hp < 100, '射程邊界內的敵人必須受到交叉斬傷害');
  assert.equal(eOutOfArc.hp, 100, '超出角度邊界的敵人不得受到交叉斬傷害');
  assert.equal(eShielded.hp, 100, '具備護盾結界的敵人受創時血量不得扣減');
  assert.equal(eDead.hp, 0, '已死亡的敵人不得受到二次傷害或產生非預期血量變動');
});

// ── 10. Lv5 覺醒風刃暴擊快照隔離 ────────────────────────────
test('M1-D-10 Lv5 awakened katana wind wave crit snapshot isolation during in-flight upgrades', () => {
  const env = loadGameSandbox({ random: () => 0.3 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 5;
  probe.setBuildMutations(['mut_crosscut']);

  const p = probe.getP();
  p.x = 200;
  p.y = 200;
  p.faceAng = 0;

  // 初始 crit = 0 (chance = 0.20, random 0.3 => 不暴擊)
  probe.getB().crit = 0;

  const target = { x: 280, y: 200, hp: 500, max: 500, type: 'mob' };
  probe.setEnemies([target]);

  probe.setWT('katana', 0);
  // 發射風刃 (winds.push)，此時風刃快照 critLvl=0, critChance=0.20
  probe.weapons(0.01);

  assert.equal(probe.getWinds().length, 1);
  const wave = probe.getWinds()[0];
  assert.equal(wave.critLvl, 0);
  assert.equal(wave.critChance, 0.20);

  // 飛行途中玩家取得 crit = 1
  probe.getB().crit = 1;

  // 推進風刃並擊中 target
  probe.weapons(0.05);

  const specBase = probe.resolveAttackSpec('katana', 5, probe.getBuildState());
  const expectedDamage = Number(specBase.windDmg.toFixed(2));
  const actualDamage = Number((500 - target.hp).toFixed(2));

  // 驗證風刃未因玩家升級而回寫暴擊（若回寫暴擊則傷害為 expectedDamage * 1.8）
  assert.equal(actualDamage, expectedDamage, '飛行途中的風刃必須受快照保護，不回寫新暴擊');
});

// ── 11. mut_pulse 靈陣變異卡池接線、持有資格與單技能容量契約 ──
test('M1-D-11 mut_pulse pool eligibility, unowned barrier exclusion, owned barrier inclusion, per-skill capacity limit, schema, applyChoice, and negative protections', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 未持有靈陣 (WL.barrier === 0)：mut_pulse 絕不可進池
  probe.getWL().barrier = 0;
  probe.getWL().katana = 1;
  const choicesWithoutBarrier = probe.getEligibleChoices();
  assert.ok(!choicesWithoutBarrier.some(c => c.id === 'mut_pulse'), '未持有淨化靈陣時 mut_pulse 絕不可進入選卡池');

  // 2. 持有靈陣 (WL.barrier === 1)：mut_pulse 正常進池且 Schema 符合規範
  probe.getWL().barrier = 1;
  probe.setBuildMutations(['mut_crosscut']);
  const choicesWithBarrier = probe.getEligibleChoices();
  const pulseCard = choicesWithBarrier.find(c => c.id === 'mut_pulse');
  assert.ok(pulseCard, '持有淨化靈陣時 mut_pulse 必須出現在選卡池');
  assert.equal(pulseCard.choiceId, 'mutation:barrier:mut_pulse');
  assert.equal(pulseCard.type, 'mutation');
  assert.equal(pulseCard.skillId, 'barrier');
  assert.deepEqual(Array.from(pulseCard.skillIds), ['barrier']);
  assert.equal(pulseCard.n, '靈陣・連環脈衝');
  assert.equal(pulseCard.s, 'れいじん・みゃくどう');
  assert.equal(pulseCard.cat, '【 靈陣變異 】');
  assert.equal(pulseCard.levelText, '◆ 靈陣變異');
  assert.ok(pulseCard.d.includes('兩次') && pulseCard.d.includes('較小') && pulseCard.d.includes('預算'), '文案明示兩次/較小/共享預算');

  // 3. 每技能變異上限獨立：needle 已滿 3 變異，katana 已有 1 變異，不阻擋 barrier 取得 mut_pulse
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut']);
  assert.equal(probe.getSkillMutations('needle').length, 3);
  assert.equal(probe.getSkillMutations('katana').length, 1);
  assert.equal(probe.getSkillMutations('barrier').length, 0);

  const choicesMultiSkill = probe.getEligibleChoices();
  assert.ok(choicesMultiSkill.some(c => c.id === 'mut_pulse'), 'needle 滿 3 變異時，barrier 仍可獨立獲得變異');

  // 4. 真 applyChoice：扣除經驗、提升等級、寫入 BuildState.mutations
  probe.setState('play');
  probe.setXp(50);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  let currentChoices = probe.getChoices();
  let pulseOffer = currentChoices.find(c => c.id === 'mut_pulse');
  if (!pulseOffer) {
    pulseOffer = pulseCard;
    probe.setChoices([pulseCard]);
  }
  assert.ok(pulseOffer, '選卡候選必須包含 mut_pulse');

  const rev = probe.getBuildRevision();
  const lvlBefore = probe.getLevel();
  const xpBefore = probe.getXp();
  const xpNeeded = probe.getXpNeed();

  // A. 拒絕陳舊 revision
  const staleRes = probe.applyChoice(pulseOffer.choiceId, 99999);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');

  // B. 拒絕未知 choiceId
  const unknownRes = probe.applyChoice('mutation:barrier:mut_unknown', rev);
  assert.equal(unknownRes.ok, false);
  assert.equal(unknownRes.reason, 'invalid_choice_id');

  // C. 合法選取成功
  const res = probe.applyChoice(pulseOffer.choiceId, rev);
  assert.equal(res.ok, true, '合法選取 mut_pulse 必須成功');
  assert.equal(probe.getLevel(), lvlBefore + 1, '成功選卡後等級提升 1');
  assert.equal(probe.getXp(), xpBefore - xpNeeded, '扣除對應等級所需 XP');
  assert.ok(probe.getBuildMutations().includes('mut_pulse'), 'BuildMutations 陣列必須包含 mut_pulse');
  assert.ok(probe.getBuildState().mutations.includes('mut_pulse'), 'BuildState.mutations 必須包含 mut_pulse');
  assert.equal(probe.getSkillMutations('barrier').length, 1, 'barrier 變異數增加為 1');

  // D. 連按雙擊防重扣
  const doubleClickRes = probe.applyChoice(pulseOffer.choiceId, rev);
  assert.equal(doubleClickRes.ok, false);

  // E. 去重保護：已選取的 mut_pulse 絕不再出現在候選池
  const choicesAfter = probe.getEligibleChoices();
  assert.ok(!choicesAfter.some(c => c.id === 'mut_pulse'), '已持有的 mut_pulse 不得重複出現在選卡池');
});

// ── 12. resolveAttackSpec barrier 數值快照與基線保持 ──────────
test('M1-D-12 resolveAttackSpec barrier snapshot numerical fidelity, baseline preservation Lv1-5, and mut_pulse budget halving', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 無變異時 Lv1–Lv5 現役基線 100% 保持
  probe.setBuildMutations([]);
  const b = probe.getB();
  b.dmg = 1.2;
  b.rate = 0;
  b.crit = 0;

  // Lv1 基線
  const s1 = probe.resolveAttackSpec('barrier', 1, probe.getBuildState());
  assert.equal(s1.skillId, 'barrier');
  assert.equal(s1.level, 1);
  assert.equal(s1.isAwakened, false);
  assert.equal(s1.hasPulse, false);
  assert.equal(Number(s1.cooldown.toFixed(2)), 2.78); // 3.2 - 1*0.42
  assert.equal(s1.baseRadius, 168); // 140 + 1*28
  assert.equal(s1.radius, 168);
  assert.equal(s1.baseDamage, 0.48); // (1.2 + 0)*0.4
  assert.equal(s1.damage, 0.48);
  assert.equal(s1.knockback, 0);
  assert.equal(s1.sanctuary, null);
  assert.equal(s1.critChance, 0.15);

  // Lv4 基線 (Lv4 起有擊退 50 + 4*10 = 90)
  const s4 = probe.resolveAttackSpec('barrier', 4, probe.getBuildState());
  assert.equal(s4.level, 4);
  assert.equal(Number(s4.cooldown.toFixed(2)), 1.52); // 3.2 - 4*0.42
  assert.equal(s4.baseRadius, 252); // 140 + 4*28
  assert.equal(s4.radius, 252);
  assert.equal(Number(s4.baseDamage.toFixed(2)), 1.44); // (1.2 + 3*0.8)*0.4
  assert.equal(Number(s4.damage.toFixed(2)), 1.44);
  assert.equal(s4.knockback, 90);
  assert.equal(s4.sanctuary, null);

  // Lv5 覺醒基線 (冷卻 3.2、半徑 220、擊退 100、緩速結界 1.8s)
  const s5 = probe.resolveAttackSpec('barrier', 5, probe.getBuildState());
  assert.equal(s5.level, 5);
  assert.equal(s5.isAwakened, true);
  assert.equal(s5.cooldown, 3.2);
  assert.equal(s5.baseRadius, 220);
  assert.equal(s5.radius, 220);
  assert.equal(s5.baseDamage, 4.5); // (2.0 + 5*1.1)*1.2*0.5
  assert.equal(s5.damage, 4.5);
  assert.equal(s5.knockback, 100);
  assert.equal(s5.sanctuary?.duration, 1.8);
  assert.equal(s5.sanctuary?.radius, 220);

  // 2. 具備 mut_pulse 變異時：拆兩次脈衝、預算與半徑折減
  probe.setBuildMutations(['mut_pulse']);
  const sp1 = probe.resolveAttackSpec('barrier', 1, probe.getBuildState());
  assert.equal(sp1.hasPulse, true);
  assert.equal(sp1.pulseCount, 2);
  assert.equal(sp1.pulseDelay, 0.18);
  assert.equal(sp1.pulseScale, 0.50);
  assert.equal(sp1.radius, Math.round(168 * 0.85)); // 143
  assert.equal(sp1.damage, Number((0.48 * 0.50).toFixed(4))); // 0.24
  assert.equal(sp1.knockback, 0);

  const sp4 = probe.resolveAttackSpec('barrier', 4, probe.getBuildState());
  assert.equal(sp4.radius, Math.round(252 * 0.85)); // 214
  assert.equal(sp4.damage, Number((1.44 * 0.50).toFixed(4))); // 0.72
  assert.equal(sp4.knockback, Math.round(90 * 0.50)); // 45 (折半)

  const sp5 = probe.resolveAttackSpec('barrier', 5, probe.getBuildState());
  assert.equal(sp5.radius, Math.round(220 * 0.85)); // 187
  assert.equal(sp5.damage, Number((4.5 * 0.50).toFixed(4))); // 2.25
  assert.equal(sp5.knockback, Math.round(100 * 0.50)); // 50 (折半)
  assert.equal(sp5.sanctuary?.duration, 1.8);
  assert.equal(sp5.sanctuary?.radius, 220);
});

// ── 13. weapons(dt) 實體兩次脈衝時序、總傷預算上界與邊界判定 ──
test('M1-D-13 weapons(dt) physical dual-pulse timing, damage budget cap <= 1.0x, radius boundary, and deduplication', () => {
  const env = loadGameSandbox({ random: () => 0.5 }); // 無暴擊
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().barrier = 1;
  probe.setBuildMutations(['mut_pulse']);
  probe.getB().dmg = 1.2;
  probe.getB().crit = 0;

  const p = probe.getP();
  p.x = 200; p.y = 200;

  // 目標 1：在縮減後脈衝半徑內 (dist = 50 <= 143)
  const targetInner = { x: 250, y: 200, hp: 100, max: 100, type: 'mob' };
  // 目標 2：在原基線半徑內但超出脈衝半徑 (dist = 155 > 143 且 <= 168)
  const targetOuter = { x: 355, y: 200, hp: 100, max: 100, type: 'mob' };

  probe.setEnemies([targetInner, targetOuter]);

  probe.setWT('barrier', 0);
  // 發動第一波脈衝 (t = 0)
  probe.weapons(0.01);

  // 驗證第一波命中
  const expectedPulse1Damage = 0.24;
  assert.equal(Number((100 - targetInner.hp).toFixed(2)), expectedPulse1Damage, '第一道脈衝造成 0.5x 傷害');
  assert.equal(targetOuter.hp, 100, '半徑縮減 0.85x 後超出範圍的敵人不受傷害');

  // 驗證第二波脈衝進入延遲佇列
  assert.equal(probe.getBarrierPulses().length, 1);
  const queuedPulse = probe.getBarrierPulses()[0];
  assert.equal(queuedPulse.level, 1);
  assert.equal(queuedPulse.radius, 143);
  assert.equal(queuedPulse.damage, 0.24);
  assert.equal(Number(queuedPulse.delay.toFixed(2)), 0.17); // 0.18 - 0.01

  // 推進時間 0.10s (尚未到達 0.18s)
  probe.weapons(0.10);
  assert.equal(Number((100 - targetInner.hp).toFixed(2)), expectedPulse1Damage, '延遲期間敵人不重複受傷');
  assert.equal(probe.getBarrierPulses().length, 1);

  // 推進時間 0.08s (總計超過 0.18s，觸發第二波脈衝)
  probe.weapons(0.08);
  assert.equal(probe.getBarrierPulses().length, 0, '第二道脈衝觸發後佇列清理完成');

  // 總傷害嚴格受控為 1.0x (0.24 + 0.24 = 0.48)
  const totalDamage = Number((100 - targetInner.hp).toFixed(2));
  assert.equal(totalDamage, 0.48, '兩次脈衝總傷害恰為 1.0x 原一次基準傷害，不突破傷害預算');
  assert.equal(targetOuter.hp, 100, '外側邊界敵人全程無受創');
});

// ── 14. Lv4 擊退折半、Boss 擊退抗性與 Lv5 sacredSanctuary 唯一性 ──
test('M1-D-14 Lv4 knockback halved, Boss knockback immunity, and Lv5 sacredSanctuary singular generation (no duplication or reset)', () => {
  const env = loadGameSandbox({ random: () => 0.5 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. Lv4 擊退折半與 Boss 免疫
  probe.getWL().barrier = 4;
  probe.setBuildMutations(['mut_pulse']);
  const p = probe.getP();
  p.x = 200; p.y = 200;

  const mob = { x: 240, y: 200, hp: 500, max: 500, type: 'mob' };
  const boss = { x: 240, y: 200, hp: 5000, max: 5000, type: 'boss' };
  probe.setEnemies([mob, boss]);

  probe.setWT('barrier', 0);
  // 第一波脈衝：Lv4 原擊退 90，折半為 45
  probe.weapons(0.01);
  assert.ok(mob.knockQueue && mob.knockQueue.length > 0, '第一道脈衝擊退折半 (45 px) 壓入佇列');
  assert.equal(mob.knockQueue[0].remaining, 45, '第一道脈衝擊退距離為 45 px');
  assert.ok(!boss.knockQueue || boss.knockQueue.length === 0, 'Boss 具備完全擊退抗性，不壓入擊退佇列');

  // 第二波脈衝觸發 (0.18s 延遲)
  probe.weapons(0.18);
  assert.equal(mob.knockQueue.length, 2, '第二道脈衝再次壓入擊退佇列');
  assert.equal(mob.knockQueue[1].remaining, 45, '第二道脈衝再擊退 45 px');
  assert.equal(mob.knockQueue.reduce((acc, k) => acc + k.remaining, 0), 90, '兩次脈衝累計總擊退為 90 px (不免費翻倍)');
  assert.ok(!boss.knockQueue || boss.knockQueue.length === 0, 'Boss 第二道脈衝依然不位移/不壓入擊退佇列');

  // 2. Lv5 覺醒 sacredSanctuary 唯一性 (1.8s 不複製、不重置壽命)
  probe.getWL().barrier = 5;
  probe.setWT('barrier', 0);
  probe.weapons(0.01);

  const sanctuary1 = probe.getSacredSanctuary();
  assert.ok(sanctuary1, 'Lv5 覺醒 barrier 發動時生成 sacredSanctuary');
  assert.equal(sanctuary1.radius || sanctuary1.r, 220);
  assert.equal(sanctuary1.maxLife, 1.8);
  assert.equal(Number(sanctuary1.life.toFixed(2)), 1.79);

  // 推進 0.10s
  probe.weapons(0.10);
  const remainingLife = sanctuary1.life;
  assert.ok(remainingLife < 1.80 && remainingLife > 1.60, '結界壽命正常隨時間衰減');

  // 第二波脈衝觸發 (0.08s)
  probe.weapons(0.08);
  const sanctuary2 = probe.getSacredSanctuary();
  assert.equal(sanctuary2, sanctuary1, '第二波脈衝絕不重新建立新結界物件');
  assert.ok(sanctuary2.life < remainingLife, '第二波脈衝絕不重置結界壽命');
});

// ── 15. 座標與暴擊快照隔離 ─────────────────────────────────
test('M1-D-15 Position and crit snapshot isolation: movement during delay does not drag pulse; crit upgrade does not rewrite delayed pulse but benefits next cast', () => {
  // random 設為 0.20：
  // critChance = 0.15 時 0.20 > 0.15 => 不暴擊
  // critChance = 0.35 時 0.20 < 0.35 => 暴擊 (1.8x)
  const env = loadGameSandbox({ random: () => 0.20 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().barrier = 1;
  probe.setBuildMutations(['mut_pulse']);
  probe.getB().dmg = 1.2;
  probe.getB().crit = 0; // 0.15 critChance

  const p = probe.getP();
  p.x = 200; p.y = 200;

  // mobOrigin 在原點 (200, 200) 附近 (250, 200)
  const mobOrigin = { x: 250, y: 200, hp: 100, max: 100, type: 'mob' };
  // mobDestination 在新玩家座標 (600, 200) 附近 (650, 200)
  const mobDestination = { x: 650, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([mobOrigin, mobDestination]);

  probe.setWT('barrier', 0);
  probe.weapons(0.01);

  // 第一波在 (200, 200) 命中 mobOrigin
  assert.equal(Number((100 - mobOrigin.hp).toFixed(2)), 0.24, '第一波無暴擊 0.24 傷害');
  assert.equal(mobDestination.hp, 100);

  // 延遲期間：玩家瞬移至 (600, 200) 且暴擊升級 b.crit = 2 (critChance = 0.35)
  p.x = 600; p.y = 200;
  probe.getB().crit = 2;

  // 推進至第二波脈衝觸發
  probe.weapons(0.18);

  // 斷言：
  // 1. 座標快照隔離：第二波脈衝應在原點 (200, 200) 爆發，因此 mobOrigin 再次受創，mobDestination 未受創
  assert.equal(Number((100 - mobOrigin.hp).toFixed(2)), 0.48, '第二波脈衝在快照原點爆發，mobOrigin 受到第二道脈衝傷害');
  assert.equal(mobDestination.hp, 100, '玩家位移不拖曳已生成的脈衝，mobDestination 未受創');

  // 2. 暴擊快照隔離：第二波脈衝快照 critChance 0.15，random 0.20 不暴擊，傷害依然是 0.24 (累計 0.48，而非 0.24 + 0.24*1.8 = 0.672)
  assert.equal(Number((100 - mobOrigin.hp).toFixed(2)), 0.48, '延遲期間暴擊升級不回寫舊脈衝');

  // 3. 新攻擊正常受益：下一發 barrier 必須享受新暴擊 (critChance 0.35, random 0.20 < 0.35 => CRIT)
  probe.setWT('barrier', 0);
  // 新目標放在玩家目前位置 (600, 200) 附近
  const mobNew = { x: 650, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([mobNew]);
  probe.weapons(0.01);

  const expectedCritDamage = Number((0.24 * 1.8).toFixed(4));
  assert.equal(Number((100 - mobNew.hp).toFixed(4)), expectedCritDamage, '新發動的 barrier 攻擊正常享受暴擊升級加成');
});

// ── 16. 狀態機與生命週期：pause/levelup 凍結、清理與佇列上限 ─
test('M1-D-16 State machine & lifecycle: pause/levelup freezing, lost/won/start queue clearance, queue cap <= 4, shield/dead enemy protection', () => {
  const env = loadGameSandbox({ random: () => 0.5 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().barrier = 1;
  probe.setBuildMutations(['mut_pulse']);
  probe.getP().x = 200; probe.getP().y = 200;

  // 1. 佇列上限 protection (barrierPulses.length <= 4)
  probe.setBarrierPulses([
    { delay: 0.10, triggered: false },
    { delay: 0.12, triggered: false },
    { delay: 0.14, triggered: false },
    { delay: 0.16, triggered: false }
  ]);
  assert.equal(probe.getBarrierPulses().length, 4);
  probe.setWT('barrier', 0);
  probe.weapons(0.01);
  assert.equal(probe.getBarrierPulses().length, 4, '已達 4 條上限時絕不溢出推入第 5 條');

  // 2. 清理契約：start(), loseRun(), startVictorySequence() 均清空 barrierPulses 與 sacredSanctuary
  probe.start('night-town');
  assert.equal(probe.getBarrierPulses().length, 0, 'start() 清空 barrierPulses');
  assert.equal(probe.getSacredSanctuary(), null, 'start() 重置 sacredSanctuary');

  probe.setBarrierPulses([{ delay: 0.15, triggered: false }]);
  probe.setSacredSanctuary({ life: 1.0, r: 220 });
  probe.loseRun();
  assert.equal(probe.getBarrierPulses().length, 0, 'loseRun() 清空 barrierPulses');
  assert.equal(probe.getSacredSanctuary(), null, 'loseRun() 重置 sacredSanctuary');

  probe.setState('play');
  probe.setBarrierPulses([{ delay: 0.15, triggered: false }]);
  probe.setSacredSanctuary({ life: 1.0, r: 220 });
  probe.startVictorySequence();
  assert.equal(probe.getBarrierPulses().length, 0, 'startVictorySequence() 清空 barrierPulses');
  assert.equal(probe.getSacredSanctuary(), null, 'startVictorySequence() 重置 sacredSanctuary');

  // 3. 護盾與死亡敵人受創保護
  probe.start('night-town');
  probe.getWL().barrier = 1;
  probe.setBuildMutations(['mut_pulse']);
  probe.getP().x = 200; probe.getP().y = 200;

  const shieldedEnemy = { x: 230, y: 200, hp: 100, max: 100, shield: true, type: 'mob' };
  const deadEnemy = { x: 230, y: 200, hp: 0, max: 100, type: 'mob' };
  probe.setEnemies([shieldedEnemy, deadEnemy]);

  probe.setWT('barrier', 0);
  probe.weapons(0.01);
  probe.weapons(0.18);

  assert.equal(shieldedEnemy.hp, 100, '護盾結界完全阻擋脈衝傷害');
  assert.equal(deadEnemy.hp, 0, '已死亡敵人不重複扣血');
});

// ── 17. mut_branch 天狐雷變異卡池資格、選卡與容量獨立契約 ─────
test('M1-D-17 mut_branch pool eligibility, unowned thunder exclusion, owned inclusion, per-skill capacity limit, schema, applyChoice, and negative protections', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 未持有天狐雷 (WL.thunder === 0)：mut_branch 絕不可進池
  probe.getWL().thunder = 0;
  probe.getWL().katana = 1;
  const choicesWithoutThunder = probe.getEligibleChoices();
  assert.ok(!choicesWithoutThunder.some(c => c.id === 'mut_branch'), '未持有天狐雷時 mut_branch 絕不可進入選卡池');

  // 2. 持有天狐雷 (WL.thunder === 1)：mut_branch 正常進池且 Schema 符合規範
  probe.getWL().thunder = 1;
  // 已持有其他技能變異，使 mut_branch 成為天狐雷之唯一變異候選
  probe.setBuildMutations(['mut_crosscut', 'mut_pulse']);
  const choicesWithThunder = probe.getEligibleChoices();
  const branchCard = choicesWithThunder.find(c => c.id === 'mut_branch');
  assert.ok(branchCard, '持有天狐雷時 mut_branch 必須出現在選卡池');
  assert.equal(branchCard.choiceId, 'mutation:thunder:mut_branch');
  assert.equal(branchCard.type, 'mutation');
  assert.equal(branchCard.skillId, 'thunder');
  assert.deepEqual(Array.from(branchCard.skillIds), ['thunder']);
  assert.equal(branchCard.n, '天狐雷・連鎖分歧');
  assert.equal(branchCard.s, 'てんこれい・ぶんき');
  assert.equal(branchCard.cat, '【 天狐雷變異 】');
  assert.equal(branchCard.levelText, '◆ 天狐雷變異');
  assert.ok(branchCard.d.includes('次級') && branchCard.d.includes('25%') && branchCard.d.includes('不以生命百分比'), '文案明示次級/25%/不以生命百分比');

  // 3. 每技能變異上限獨立：needle 滿 3、katana 1、barrier 1，不阻擋 thunder 取得 mut_branch
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse']);
  assert.equal(probe.getSkillMutations('needle').length, 3);
  assert.equal(probe.getSkillMutations('katana').length, 1);
  assert.equal(probe.getSkillMutations('barrier').length, 1);
  assert.equal(probe.getSkillMutations('thunder').length, 0);

  const choicesMultiSkill = probe.getEligibleChoices();
  assert.ok(choicesMultiSkill.some(c => c.id === 'mut_branch'), '其他技能變異不阻擋 thunder 獲得變異');

  // 4. 選卡接線與負向保護
  probe.setState('play');
  probe.setXp(50);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  let currentChoices = probe.getChoices();
  let branchOffer = currentChoices.find(c => c.id === 'mut_branch');
  if (!branchOffer) {
    branchOffer = branchCard;
    probe.setChoices([branchCard]);
  }
  assert.ok(branchOffer, '選卡候選必須包含 mut_branch');

  const rev = probe.getBuildRevision();
  const lvlBefore = probe.getLevel();
  const xpBefore = probe.getXp();
  const xpNeeded = probe.getXpNeed();

  // A. 拒絕陳舊 revision
  const staleRes = probe.applyChoice(branchOffer.choiceId, 99999);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');

  // B. 拒絕未知 choiceId
  const unknownRes = probe.applyChoice('mutation:thunder:mut_unknown', rev);
  assert.equal(unknownRes.ok, false);
  assert.equal(unknownRes.reason, 'invalid_choice_id');

  // C. 合法選取成功
  const res = probe.applyChoice(branchOffer.choiceId, rev);
  assert.equal(res.ok, true, '合法選取 mut_branch 必須成功');
  assert.equal(probe.getLevel(), lvlBefore + 1, '成功選卡後等級提升 1');
  assert.equal(probe.getXp(), xpBefore - xpNeeded, '扣除對應等級所需 XP');
  assert.ok(probe.getBuildMutations().includes('mut_branch'), 'BuildMutations 陣列必須包含 mut_branch');
  assert.ok(probe.getBuildState().mutations.includes('mut_branch'), 'BuildState.mutations 必須包含 mut_branch');
  assert.equal(probe.getSkillMutations('thunder').length, 1, 'thunder 變異數增加為 1');

  // D. 連按雙擊防重扣
  const doubleClickRes = probe.applyChoice(branchOffer.choiceId, rev);
  assert.equal(doubleClickRes.ok, false);

  // E. 去重保護：已選取的 mut_branch 絕不再出現在候選池
  const choicesAfter = probe.getEligibleChoices();
  assert.ok(!choicesAfter.some(c => c.id === 'mut_branch'), '已持有的 mut_branch 不得重複出現在選卡池');
});

// ── 18. resolveAttackSpec thunder 數值快照與基線保持 ──────────
test('M1-D-18 resolveAttackSpec thunder snapshot numerical fidelity, baseline preservation Lv1-5, and mut_branch parameters', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 無變異時 Lv1–Lv5 現役基線 100% 保持
  probe.setBuildMutations([]);
  const b = probe.getB();
  b.dmg = 1.2;
  b.rate = 0;
  b.crit = 0;

  // Lv1 基線 (cd 2.25, mult 2.0, dmg 2.4, r 190, targetCount 1)
  const s1 = probe.resolveAttackSpec('thunder', 1, probe.getBuildState());
  assert.equal(s1.skillId, 'thunder');
  assert.equal(s1.level, 1);
  assert.equal(s1.isAwakened, false);
  assert.equal(s1.hasBranch, false);
  assert.equal(s1.cooldown, 2.25);
  assert.equal(s1.mult, 2.0);
  assert.equal(s1.damage, 2.4);
  assert.equal(s1.baseDamage, 2.4);
  assert.equal(s1.radius, 190);
  assert.equal(s1.targetCount, 1);
  assert.equal(s1.critChance, 0.2);

  // Lv2 基線 (cd 2.0, mult 3.0, dmg 3.6, r 270, targetCount 2)
  const s2 = probe.resolveAttackSpec('thunder', 2, probe.getBuildState());
  assert.equal(s2.cooldown, 2.0);
  assert.equal(s2.mult, 3.0);
  assert.equal(s2.damage, 3.6);
  assert.equal(s2.radius, 270);
  assert.equal(s2.targetCount, 2);

  // Lv3 基線 (cd 2.0, mult 4.5, dmg 5.4, r 350, targetCount 3)
  const s3 = probe.resolveAttackSpec('thunder', 3, probe.getBuildState());
  assert.equal(s3.cooldown, 2.0);
  assert.equal(s3.mult, 4.5);
  assert.equal(s3.damage, 5.4);
  assert.equal(s3.radius, 350);
  assert.equal(s3.targetCount, 3);

  // Lv4 基線 (cd 2.0, mult 6.0, dmg 7.2, r 450, targetCount 3)
  const s4 = probe.resolveAttackSpec('thunder', 4, probe.getBuildState());
  assert.equal(s4.cooldown, 2.0);
  assert.equal(s4.mult, 6.0);
  assert.equal(s4.damage, 7.2);
  assert.equal(s4.radius, 450);
  assert.equal(s4.targetCount, 3);

  // Lv5 覺醒基線 (cd 2.4, mult 8.0, dmg 9.6, r 450, cloudRadius 90, isAwakened true)
  const s5 = probe.resolveAttackSpec('thunder', 5, probe.getBuildState());
  assert.equal(s5.isAwakened, true);
  assert.equal(s5.cooldown, 2.4);
  assert.equal(s5.mult, 8.0);
  assert.equal(s5.damage, 9.6);
  assert.equal(s5.radius, 450);
  assert.equal(s5.cloudRadius, 90);

  // 2. 具備 mut_branch 變異時之快照規格
  probe.setBuildMutations(['mut_branch']);
  const sb1 = probe.resolveAttackSpec('thunder', 1, probe.getBuildState());
  assert.equal(sb1.hasBranch, true);
  assert.equal(sb1.branchCount, 1);
  assert.equal(sb1.branchScale, 0.25);
  assert.equal(sb1.branchRadius, 180);
  assert.equal(sb1.branchDamage, 0.60); // 2.4 * 0.25
  assert.equal(sb1.derivationDepth, 0);

  const sb4 = probe.resolveAttackSpec('thunder', 4, probe.getBuildState());
  assert.equal(sb4.damage, 7.2);
  assert.equal(sb4.branchDamage, 1.80); // 7.2 * 0.25

  const sb5 = probe.resolveAttackSpec('thunder', 5, probe.getBuildState());
  assert.equal(sb5.damage, 9.6);
  assert.equal(sb5.branchDamage, 2.40); // 9.6 * 0.25
});

// ── 19. weapons(dt) mut_branch 實體消費、25% 傷害預算與搜尋半徑 ─
test('M1-D-19 weapons(dt) mut_branch real consumer execution, 25% damage budget, branch search radius, and strict deduplication', () => {
  const env = loadGameSandbox({ random: () => 0.5 }); // 無暴擊
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().thunder = 1;
  probe.setBuildMutations(['mut_branch']);
  probe.getB().dmg = 1.2;
  probe.getB().crit = 0;

  const p = probe.getP();
  p.x = 200; p.y = 200;

  // 主目標：距離玩家 80 (<= 190)
  const pTarget = { x: 280, y: 200, hp: 100, max: 100, type: 'mob' };
  // 次級目標：距離主目標 100 (<= 180 branchRadius)
  const sTarget = { x: 380, y: 200, hp: 100, max: 100, type: 'mob' };
  // 遠方目標：距離主目標 270 (> 180 branchRadius)
  const outTarget = { x: 550, y: 200, hp: 100, max: 100, type: 'mob' };

  probe.setEnemies([pTarget, sTarget, outTarget]);

  probe.setWT('thunder', 0);
  probe.weapons(0.01);

  // 1. 主目標承受完整主雷傷害 (2.4)
  const pDamage = Number((100 - pTarget.hp).toFixed(2));
  assert.equal(pDamage, 2.4, '主目標承受完整 2.4 傷害');

  // 2. 次級目標承受 25% 次級雷傷害 (0.60)
  const sDamage = Number((100 - sTarget.hp).toFixed(2));
  assert.equal(sDamage, 0.60, '次級目標承受 0.60 傷害 (25% 主雷傷害)');

  // 3. 超出次級半徑的敵人不受傷害
  assert.equal(outTarget.hp, 100, '超出 180 半徑之敵人完全不受雷擊');

  // 4. 去重：主目標絕不被次級雷二次擊中
  assert.equal(pTarget.hp, 100 - 2.4, '主目標不可再被次級雷重複結算');

  // 5. 總預算嚴格受限為 1.25x (2.4 + 0.6 = 3.0)
  const totalDamage = Number((pDamage + sDamage).toFixed(2));
  assert.equal(totalDamage, 3.0, '總傷害預算受限，不超過 1.25x 名義傷害');
});

// ── 20. mut_branch 護盾、死敵與 Boss 控制免疫保護 ────────────
test('M1-D-20 mut_branch protections: shield immunity, dead enemy immunity, Boss takes flat damage without extra control', () => {
  const env = loadGameSandbox({ random: () => 0.5 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().thunder = 1;
  probe.setBuildMutations(['mut_branch']);
  probe.getB().dmg = 1.2;
  probe.getB().crit = 0;

  const p = probe.getP();
  p.x = 200; p.y = 200;

  const pTarget = { x: 280, y: 200, hp: 100, max: 100, type: 'mob' };
  // 護盾怪：在次級範圍內 (dist 60 <= 180) 但 shield: true
  const shielded = { x: 340, y: 200, hp: 100, max: 100, shield: true, type: 'mob' };
  // 死亡怪：在次級範圍內但 hp <= 0
  const dead = { x: 320, y: 200, hp: 0, max: 100, type: 'mob' };
  // Boss：在次級範圍內
  const boss = { x: 360, y: 200, hp: 5000, max: 5000, type: 'boss' };

  probe.setEnemies([pTarget, shielded, dead, boss]);

  probe.setWT('thunder', 0);
  probe.weapons(0.01);

  // 護盾與死亡怪不受傷害
  assert.equal(shielded.hp, 100, '有護盾的敵人不受次級雷傷害');
  assert.equal(dead.hp, 0, '已死亡敵人不重複結算');

  // Boss 承受固定數值次級傷害 (0.60)，非百分比生命秒殺，且不附加額外控制
  const bossHurt = Number((5000 - boss.hp).toFixed(2));
  assert.equal(bossHurt, 0.60, 'Boss 承受固定次級傷 0.60，絕非百分比扣血');
  assert.ok(!boss.freezeT, 'Boss 不受額外冰凍控制');
  assert.ok(!boss.knockQueue || boss.knockQueue.length === 0, 'Boss 不受額外擊退控制');
});

// ── 21. Lv5 覺醒建御雷神 + mut_branch：三雷雲共享去重與至多 1 次級 ──
test('M1-D-21 Lv5 awakened thunder + mut_branch: 3 clouds shared struck, at most 1 secondary branch, zero cloud duplication', () => {
  const env = loadGameSandbox({ random: () => 0.5 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().thunder = 5;
  probe.setBuildMutations(['mut_branch']);
  probe.getB().dmg = 1.2;
  probe.getB().crit = 0;

  const p = probe.getP();
  p.x = 200; p.y = 200;

  // 3 個雷雲錨點敵人 (450 範圍內)
  const a1 = { x: 260, y: 200, hp: 500, max: 500, type: 'mob' };
  const a2 = { x: 340, y: 200, hp: 500, max: 500, type: 'mob' };
  const a3 = { x: 420, y: 200, hp: 500, max: 500, type: 'mob' };

  // 位於 a1 與 a2 重疊區域 (距離 a1 與 a2 各 40 px <= 90)
  const eOverlap = { x: 300, y: 200, hp: 500, max: 500, type: 'mob' };

  // 位於雷雲外但距 a3 在 180 範圍內的怪 (距離 a2: 180 > 90; 距離 a3: 100 <= 180)
  const eBranch = { x: 520, y: 200, hp: 500, max: 500, type: 'mob' };

  probe.setEnemies([a1, a2, a3, eOverlap, eBranch]);

  probe.setWT('thunder', 0);
  probe.weapons(0.01);

  // a1, a2, a3 受到主雷雲打擊 (9.6)
  assert.equal(Number((500 - a1.hp).toFixed(2)), 9.6);
  assert.equal(Number((500 - a2.hp).toFixed(2)), 9.6);
  assert.equal(Number((500 - a3.hp).toFixed(2)), 9.6);

  // eOverlap 雖然在多朵雲重疊區，但受 struck 去重保護，恰受傷一次 9.6
  assert.equal(Number((500 - eOverlap.hp).toFixed(2)), 9.6, '重疊雷雲內的敵人受 struck 保護只傷一次');

  // eBranch 受到次級分歧雷 (9.6 * 0.25 = 2.40)
  assert.equal(Number((500 - eBranch.hp).toFixed(2)), 2.40, '雷雲外目標受到恰為 25% 的次級雷傷害');
});

// ── 22. 暴擊快照、pause/levelup 凍結與狀態機生命週期 ─────────
test('M1-D-22 Crit roll snapshot, crit passive upgrade isolation, pause/levelup freezing, and lifecycle reset', () => {
  // 1. 同一 cast 暴擊同步：random = 0.10 (< 0.20 => CRIT)
  const envCrit = loadGameSandbox({ random: () => 0.10 });
  const probeCrit = envCrit.__agyProbe;
  probeCrit.start('night-town');
  probeCrit.getP().x = 200;
  probeCrit.getP().y = 200;
  probeCrit.getWL().thunder = 1;
  probeCrit.setBuildMutations(['mut_branch']);
  probeCrit.getB().dmg = 1.2;
  probeCrit.getB().crit = 0;

  const t1 = { x: 260, y: 200, hp: 100, max: 100, type: 'mob' };
  const t2 = { x: 340, y: 200, hp: 100, max: 100, type: 'mob' };
  probeCrit.setEnemies([t1, t2]);
  probeCrit.setWT('thunder', 0);
  probeCrit.weapons(0.01);

  // 主雷 2.4 * 1.8 = 4.32，次級雷 0.60 * 1.8 = 1.08
  assert.equal(Number((100 - t1.hp).toFixed(2)), 4.32, '主雷享受當次暴擊加成');
  assert.equal(Number((100 - t2.hp).toFixed(2)), 1.08, '次級雷同步享受當次暴擊加成');

  // 2. pause / levelup 狀態凍結：武器倒數不推進
  const envPause = loadGameSandbox();
  const probePause = envPause.__agyProbe;
  probePause.start('night-town');
  probePause.getWL().thunder = 1;
  probePause.setWT('thunder', 1.5);

  probePause.setState('pause');
  probePause.update(0.50);
  assert.equal(probePause.getWT().thunder, 1.5, 'pause 期間天狐雷計時凍結');

  probePause.setState('levelup');
  probePause.update(0.50);
  assert.equal(probePause.getWT().thunder, 1.5, 'levelup 期間天狐雷計時凍結');

  // 3. start / loseRun / victory 清理無殘留幽靈傷
  probePause.setState('play');
  probePause.setWT('thunder', 0);
  probePause.loseRun();
  assert.equal(probePause.getState(), 'lampout', 'loseRun 觸發熄燈狀態');

  probePause.start('night-town');
  assert.equal(probePause.getState(), 'play', 'start() 重置為 play 狀態');
  assert.equal(probePause.getWT().thunder, 1, 'start() 重置天狐雷初始計時');
});

// ── 23. mut_pierce 靈針變異卡池資格、選卡與每技能容量獨立契約 ────
test('M1-D-23 mut_pierce pool eligibility, unowned needle exclusion, owned inclusion, per-skill capacity limit, schema, applyChoice, and negative protections', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 未持有靈針 (WL.needle === 0)：mut_pierce 絕不可進池
  probe.getWL().needle = 0;
  probe.setLevelupCooldown(0);
  const choicesWithoutNeedle = probe.getEligibleChoices();
  assert.ok(!choicesWithoutNeedle.some(c => c.id === 'mut_pierce'), '未持有天狐靈針時 mut_pierce 絕不可進入選卡池');

  // 2. 持有靈針 (WL.needle === 1)：mut_pierce 正常進池且 Schema 符合規範
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_fan', 'mut_seek']);
  probe.setLevelupCooldown(0);
  let pierceCard = null;
  for (let i = 0; i < 20 && !pierceCard; i++) {
    const choices = probe.getEligibleChoices();
    pierceCard = choices.find(c => c.id === 'mut_pierce');
  }
  assert.ok(pierceCard, '持有天狐靈針時 mut_pierce 必須出現在選卡池');
  assert.equal(pierceCard.choiceId, 'mutation:needle:mut_pierce');
  assert.equal(pierceCard.type, 'mutation');
  assert.equal(pierceCard.skillId, 'needle');
  assert.deepEqual(Array.from(pierceCard.skillIds), ['needle']);
  assert.equal(pierceCard.n, '靈針・穿透增額');
  assert.equal(pierceCard.s, 'せんぼん・ぞうがく');
  assert.equal(pierceCard.cat, '【 靈針變異 】');
  assert.equal(pierceCard.levelText, '◆ 靈針變異');
  assert.equal(pierceCard.rarity, 'mutation');
  assert.ok(pierceCard.d.includes('15%') && pierceCard.d.includes('30%') && pierceCard.d.includes('不額外投射'), '說明文案必須明示 15%、30% 與不額外投射');
  assert.equal(pierceCard.requirementText, '持有天狐靈針');
  assert.equal(pierceCard.limitText, '每種限選一次（每技能最多 3 種變異）');

  // 3. 每技能變異上限獨立：
  // A. needle 已滿 3 變異（fan, seek, frost），即使持有靈針，mut_pierce 絕不可進池
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  const choicesFullNeedle = probe.getEligibleChoices();
  assert.ok(!choicesFullNeedle.some(c => c.id === 'mut_pierce'), '靈針已滿 3 變異時 mut_pierce 絕不可進池');

  // B. 其他技能變異（katana 1, barrier 1, thunder 1）不阻擋 needle 取得 mut_pierce
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_crosscut', 'mut_pulse', 'mut_branch']);
  let choicesOtherSkillsPierce = null;
  for (let i = 0; i < 20 && !choicesOtherSkillsPierce; i++) {
    const choices = probe.getEligibleChoices();
    choicesOtherSkillsPierce = choices.find(c => c.id === 'mut_pierce');
  }
  assert.ok(choicesOtherSkillsPierce, '其他技能變異不阻擋 needle 獨立獲得 mut_pierce');

  // 4. 真選卡 offerUp -> applyChoice 流程
  probe.setBuildMutations([]);
  probe.setLevel(2);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const currentChoices = probe.getChoices();
  let pierceOffer = currentChoices.find(c => c.id === 'mut_pierce');
  for (let attempt = 0; attempt < 100 && !pierceOffer; attempt++) {
    const freshChoices = probe.getEligibleChoices();
    const found = freshChoices.find(c => c.id === 'mut_pierce');
    if (found) {
      pierceOffer = found;
      probe.setChoices([found]);
      break;
    }
  }
  assert.ok(pierceOffer, '選卡候選必須包含 mut_pierce');
  const rev = probe.getBuildRevision();
  const xpBefore = probe.getXp();

  // A. 負向保護：過期 revision 拒絕
  const staleRes = probe.applyChoice(pierceOffer.choiceId, rev - 1);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');
  assert.equal(probe.getXp(), xpBefore);

  // B. 負向保護：未知 choiceId 拒絕
  const unknownRes = probe.applyChoice('mutation:needle:unknown', rev);
  assert.equal(unknownRes.ok, false);
  assert.equal(unknownRes.reason, 'invalid_choice_id');
  assert.equal(probe.getXp(), xpBefore);

  // C. 正式選取 mut_pierce
  const res = probe.applyChoice(pierceOffer.choiceId, rev);
  assert.equal(res.ok, true, '合法選取 mut_pierce 必須成功');
  assert.equal(probe.getState(), 'play', '選卡後切回 play 狀態');
  assert.ok(probe.getBuildMutations().includes('mut_pierce'), 'BuildMutations 陣列必須包含 mut_pierce');
  assert.ok(probe.getBuildState().mutations.includes('mut_pierce'), 'BuildState.mutations 必須包含 mut_pierce');

  // D. 負向保護：連按雙擊防重扣
  const doubleClick = probe.applyChoice(pierceOffer.choiceId, rev);
  assert.equal(doubleClick.ok, false);
  assert.equal(doubleClick.reason, 'not_in_levelup');

  // E. 去重保護：已選取的 mut_pierce 絕不再出現在候選池
  const choicesAfter = probe.getEligibleChoices();
  assert.ok(!choicesAfter.some(c => c.id === 'mut_pierce'), '已持有的 mut_pierce 不得重複出現在選卡池');
});

// ── 24. resolveAttackSpec needle 快照數值忠實度、Lv1–5 基線保持與 mut_pierce 參數 ──
test('M1-D-24 resolveAttackSpec needle snapshot numerical fidelity, baseline preservation Lv1-5, and mut_pierce parameters', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 無變異基線 Lv1–5 100% 保持
  const bsBase = { ...probe.getBuildState(), mutations: [] };
  const expectedCounts = [3, 5, 7, 8, 8];
  const expectedSpreads = [0.45, 0.45, 0.45, 0.65, 1.35];
  const expectedBaseDmgs = [2.1, 2.8, 3.5, 4.2, 4.9];

  for (let lvl = 1; lvl <= 5; lvl++) {
    const s = probe.resolveAttackSpec('needle', lvl, bsBase);
    assert.equal(s.skillId, 'needle');
    assert.equal(s.level, lvl);
    assert.equal(s.isAwakened, lvl === 5);
    assert.equal(s.source, 'base');
    assert.equal(s.count, expectedCounts[lvl - 1]);
    assert.equal(s.spread, expectedSpreads[lvl - 1]);
    assert.ok(Math.abs(s.baseDamage - expectedBaseDmgs[lvl - 1]) < 0.001);
    assert.equal(s.hasPierce, false, '無變異時 hasPierce 必須為 false');
    assert.equal(s.pierce, undefined, '無變異時 pierce 欄位未定義');
    assert.equal(s.pierceBonusScale, 0, '無變異時 pierceBonusScale 為 0');
    assert.equal(s.maxPierceBonusHits, 0, '無變異時 maxPierceBonusHits 為 0');
    assert.equal(s.pierceBonusMax, 0, '無變異時 pierceBonusMax 為 0');
  }

  // 2. 具備 mut_pierce 變異時之快照規格
  const bsPierce = { ...probe.getBuildState(), mutations: ['mut_pierce'] };
  for (let lvl = 1; lvl <= 5; lvl++) {
    const s = probe.resolveAttackSpec('needle', lvl, bsPierce);
    assert.equal(s.skillId, 'needle');
    assert.equal(s.level, lvl);
    assert.equal(s.source, 'mutation');
    assert.equal(s.hasPierce, true, '持有 mut_pierce 時 hasPierce 為 true');
    assert.equal(s.pierce, true, '持有 mut_pierce 時 pierce 標記為 true');
    assert.equal(s.pierceBonusScale, 0.15, 'pierceBonusScale 精確快照為 0.15 (+15%)');
    assert.equal(s.maxPierceBonusHits, 2, 'maxPierceBonusHits 精確快照為 2');
    assert.equal(s.pierceBonusMax, 0.30, 'pierceBonusMax 精確快照為 0.30 (+30%)');
    // 基礎參數不被 pierce 扭曲
    assert.equal(s.count, expectedCounts[lvl - 1]);
    assert.equal(s.spread, expectedSpreads[lvl - 1]);
    assert.ok(Math.abs(s.baseDamage - expectedBaseDmgs[lvl - 1]) < 0.001);
  }
});

// ── 25. weapons(dt) 實體靈針穿透 5 隻獨敵數值序列與同敵去重保護 ──
test('M1-D-25 weapons(dt) needle real penetration across 5 unique enemies sequence (1.0x -> 1.15x -> 1.15x -> 1.0x -> 1.0x) and same-enemy hit deduplication', () => {
  const env = loadGameSandbox({ random: () => 0.99 }); // 防暴擊擾動
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  p.x = 200; p.y = 200; p.faceAng = 0;
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_pierce']);
  probe.getB().dmg = 1.2;
  probe.setWT('katana', 999); // 凍結普攻妖刀冷卻，避免揮擊干擾靈針數值觀測

  // 基礎名義針傷：(1.4 + 1 * 0.7) * 1.2 = 2.1 * 1.2 = 2.52
  const baseDmg = 2.52;

  // 在靈針飛行正前方沿 x 軸放置 5 隻獨敵（間距 40 px）
  const e1 = { x: 250, y: 200, hp: 100, max: 100, type: 'mob' };
  const e2 = { x: 290, y: 200, hp: 100, max: 100, type: 'mob' };
  const e3 = { x: 330, y: 200, hp: 100, max: 100, type: 'mob' };
  const e4 = { x: 370, y: 200, hp: 100, max: 100, type: 'mob' };
  const e5 = { x: 410, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([e1, e2, e3, e4, e5]);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const activeNeedles = probe.getNeedles();
  assert.ok(activeNeedles.length > 0, '發射靈針');
  // 保留中央直行靈針 (vy === 0 或 launchAng 近似 0)，排除兩側擴散針干擾
  const centerNeedle = activeNeedles.find(nd => Math.abs(nd.vy) < 10) || activeNeedles[0];
  centerNeedle.y = 200; // 鎖定與五敵同一水平線
  centerNeedle.vy = 0;
  activeNeedles.length = 0;
  activeNeedles.push(centerNeedle);

  // 推進至擊中 e1 (第 1 隻有效獨敵：維持原傷 1.0x = 2.52)
  probe.weapons(0.10);
  assert.ok(centerNeedle.hits.has(e1), 'e1 必須已被擊中');
  assert.equal(Number((100 - e1.hp).toFixed(3)), 2.52, '第 1 隻獨敵承受 1.0x 原快照傷害 (2.52)');

  // 推進至擊中 e2 (第 2 隻有效獨敵：各加 15% = 1.15x = 2.898)
  probe.weapons(0.07);
  assert.ok(centerNeedle.hits.has(e2), 'e2 必須已被擊中');
  assert.equal(Number((100 - e2.hp).toFixed(3)), 2.898, '第 2 隻獨敵承受 1.15x 傷害 (2.898)');

  // 推進至擊中 e3 (第 3 隻有效獨敵：各加 15% = 1.15x = 2.898，總增額達 30%)
  probe.weapons(0.07);
  assert.ok(centerNeedle.hits.has(e3), 'e3 必須已被擊中');
  assert.equal(Number((100 - e3.hp).toFixed(3)), 2.898, '第 3 隻獨敵承受 1.15x 傷害 (2.898)');

  // 推進至擊中 e4 (第 4 隻有效獨敵：增額用罄，恢復原傷 1.0x = 2.52 繼續穿透)
  probe.weapons(0.07);
  assert.ok(centerNeedle.hits.has(e4), 'e4 必須已被擊中');
  assert.equal(Number((100 - e4.hp).toFixed(3)), 2.52, '第 4 隻獨敵恢復 1.0x 原快照傷害 (2.52)');

  // 推進至擊中 e5 (第 5 隻有效獨敵：持續穿透，維持 1.0x = 2.52)
  probe.weapons(0.07);
  assert.ok(centerNeedle.hits.has(e5), 'e5 必須已被擊中');
  assert.equal(Number((100 - e5.hp).toFixed(3)), 2.52, '第 5 隻獨敵持續承受 1.0x 原快照傷害 (2.52)');

  // 6. 同敵 Set 去重保護：模擬 inb 結束後靈針仍碰觸 e5，絕不二次扣血
  e5.inb = 0;
  probe.weapons(0.01);
  assert.equal(Number((100 - e5.hp).toFixed(3)), 2.52, '同發靈針命中同敵後受 hits Set 保護不重複扣血');

  // 7. 增額總和硬性封頂負向：額外傷害總和絕不可超過該針快照傷之 30% (<= 0.756)
  const totalDamageDealt = (100 - e1.hp) + (100 - e2.hp) + (100 - e3.hp) + (100 - e4.hp) + (100 - e5.hp);
  const extraDamage = totalDamageDealt - baseDmg * 5;
  const maxAllowedExtra = baseDmg * 0.30;
  assert.ok(extraDamage <= maxAllowedExtra + 1e-9, `增額總和 (${extraDamage}) 必須不超過單針生成傷之 30% (${maxAllowedExtra})`);
  assert.ok(Math.abs(extraDamage - 0.756) < 1e-4, '增額總和精確等於 0.756');
});

// ── 26. mut_pierce 護盾與死敵保護：不消耗增額預算 ──────────────
test('M1-D-26 mut_pierce protections: shielded and dead enemies do not consume pierce bonus hit budget', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  p.x = 200; p.y = 200; p.faceAng = 0;
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_pierce']);
  probe.getB().dmg = 1.2;
  probe.setWT('katana', 999); // 凍結普攻妖刀冷卻，避免揮擊干擾靈針數值觀測
  const baseDmg = 2.52;

  // 軌跡上的目標序列：
  // 1. 已死之敵 (hp: 0) -> 不消耗
  // 2. 結界護盾敵 (shield: true) -> 阻擋傷害且不消耗
  // 3. 有效獨敵 1 -> 消耗第 1 次 (1.0x 原傷 2.52)
  // 4. 有效獨敵 2 -> 消耗第 2 次 (1.15x 2.898)
  // 5. 有效獨敵 3 -> 消耗第 3 次 (1.15x 2.898)
  const eDead = { x: 225, y: 200, hp: 0, max: 100, type: 'mob' };
  const eShield = { x: 250, y: 200, hp: 100, max: 100, shield: true, type: 'mob' };
  const eReal1 = { x: 340, y: 200, hp: 100, max: 100, type: 'mob' };
  const eReal2 = { x: 400, y: 200, hp: 100, max: 100, type: 'mob' };
  const eReal3 = { x: 460, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([eDead, eShield, eReal1, eReal2, eReal3]);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const activeNeedles = probe.getNeedles();
  const centerNeedle = activeNeedles.find(nd => Math.abs(nd.vy) < 10) || activeNeedles[0];
  centerNeedle.y = 200;
  centerNeedle.vy = 0;
  activeNeedles.length = 0;
  activeNeedles.push(centerNeedle);

  // 推進穿過死敵與護盾敵 (dt = 0.08s -> 200 + 51.2 = 251.2, 距離 eShield: 1.2 <= 30; 距離 eReal1: 88.8 > 30)
  probe.weapons(0.08);
  assert.equal(eDead.hp, 0, '死敵不接受傷害');
  assert.equal(eShield.hp, 100, '護盾敵不受傷害');
  assert.equal(centerNeedle.pierceHits, 0, '護盾與死敵絕不消耗 pierceHits 增額次數');

  // 推進擊中 eReal1 (dt = 0.15s -> 251.2 + 96 = 347.2, 命中 eReal1)
  probe.weapons(0.15);
  assert.ok(centerNeedle.hits.has(eReal1));
  assert.equal(centerNeedle.pierceHits, 1, '首個未被護盾阻擋的實體敵怪計為第 1 擊');
  assert.equal(Number((100 - eReal1.hp).toFixed(3)), 2.52, 'eReal1 承受 1.0x 原傷 (2.52)');

  // 推進擊中 eReal2 (dt = 0.10s -> 347.2 + 64 = 411.2, 命中 eReal2)
  probe.weapons(0.10);
  assert.ok(centerNeedle.hits.has(eReal2));
  assert.equal(centerNeedle.pierceHits, 2, '計為第 2 擊');
  assert.equal(Number((100 - eReal2.hp).toFixed(3)), 2.898, 'eReal2 正確享受第 2 擊 1.15x 加成 (2.898)');

  // 推進擊中 eReal3 (dt = 0.10s -> 411.2 + 64 = 475.2, 命中 eReal3)
  probe.weapons(0.10);
  assert.ok(centerNeedle.hits.has(eReal3));
  assert.equal(centerNeedle.pierceHits, 3, '計為第 3 擊');
  assert.equal(Number((100 - eReal3.hp).toFixed(3)), 2.898, 'eReal3 正確享受第 3 擊 1.15x 加成 (2.898)');

  // 驗證護盾序列增額總和硬性封頂
  const realExtra = (100 - eReal1.hp) + (100 - eReal2.hp) + (100 - eReal3.hp) - baseDmg * 3;
  assert.ok(realExtra <= baseDmg * 0.30 + 1e-9, `護盾穿透序列增額總和 (${realExtra}) 必須 <= 30% (${baseDmg * 0.30})`);
  assert.ok(Math.abs(realExtra - 0.756) < 1e-4, '護盾穿透增額總和精確等於 0.756');
});

// ── 27. mut_fan 額外針獨立計算、3 變異合法疊加與 Lv5 冰針原事件保護 ──
test('M1-D-27 mut_fan extra needles independent calculation, valid 3-mutation stacking, and Lv5 awakened ice needles single event integrity', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');
  const p = probe.getP();
  const startX = p.x, startY = p.y;
  p.faceAng = 0;

  // 1. mut_fan + mut_pierce: 6 發靈針各自獨立計算
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_fan', 'mut_pierce']);
  probe.setWT('katana', 999);
  const specFanPierce = probe.resolveAttackSpec('needle', 1, probe.getBuildState());
  assert.equal(specFanPierce.count, 6, 'mut_fan 使得發數增加至 6');
  assert.equal(specFanPierce.hasPierce, true, 'mut_pierce 正常生效');
  assert.equal(specFanPierce.perShotScale, 0.72, 'mut_fan 單發比例 0.72');

  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const fanNeedles = probe.getNeedles();
  assert.equal(fanNeedles.length, 6, '真投射產生 6 枚靈針');

  // 驗證每枚靈針均擁有獨立的 hits Set 與 pierceHits 計數器
  for (let i = 0; i < fanNeedles.length; i++) {
    assert.equal(fanNeedles[i].hasPierce, true);
    assert.equal(fanNeedles[i].pierceHits, 0);
    assert.ok(fanNeedles[i].hits instanceof Set);
  }

  // 實測 fan 6 針穿透多敵：為每枚靈針在其航向放置 5 隻獨立敵怪 (6 * 5 = 30 命中)，真逐針實碰且逐針 hits 對帳
  const sumBaseFanDmg = fanNeedles.reduce((s, nd) => s + nd.dmg, 0);
  const fanEnemies = [];
  for (let i = 0; i < fanNeedles.length; i++) {
    const nd = fanNeedles[i];
    const ang = Math.atan2(nd.vy, nd.vx);
    for (let step = 1; step <= 5; step++) {
      const d = 160 + step * 40;
      fanEnemies.push({ x: startX + Math.cos(ang) * d, y: startY + Math.sin(ang) * d, hp: 500, max: 500, type: 'mob' });
    }
  }
  probe.setEnemies(fanEnemies);

  // 推進至 6 針完全穿透 30 敵
  for (let t = 0; t < 20; t++) {
    probe.weapons(0.04);
  }

  // 驗證無額外生成投射物
  assert.ok(probe.getNeedles().length <= 6, '穿透途中絕不額外生成新投射物');

  // 逐針實碰對帳：核算每針 hits.size 與 pierceBonusScaleTotal
  const totalFanHits = fanNeedles.reduce((s, nd) => s + nd.hits.size, 0);
  assert.equal(totalFanHits, 30, 'fan 6 針完成 30 次實質有效命中');
  for (const nd of fanNeedles) {
    assert.equal(nd.hits.size, 5, '每針命中恰好 5 隻獨敵');
    assert.equal(nd.pierceHits, 5, '每針 pierceHits 累計 5 次');
    assert.equal(Number(nd.pierceBonusScaleTotal.toFixed(4)), 0.30, '每針增額預算達到 30% 上限封頂');
  }

  // 增額對帳：總增額 > 0 且等於 cap 3.26592 (<= sumBaseFanDmg * 0.30)
  const totalFanExtra = fanNeedles.reduce((sum, nd) => sum + nd.dmg * (nd.pierceBonusScaleTotal || 0), 0);
  assert.ok(totalFanExtra > 0, 'fan 6 針實質產生穿透增額');
  assert.equal(Number(totalFanExtra.toFixed(5)), 3.26592, 'fan 6 針 30 次實碰總增額精確等於 3.26592 cap');
  assert.ok(totalFanExtra <= sumBaseFanDmg * 0.30 + 1e-9, 'fan 6 針總增額受 30% 硬性封頂保護');

  // 敵人物理扣血總額與逐針結算對帳
  const totalFanDamageOnEnemies = fanEnemies.reduce((sum, e) => sum + (500 - e.hp), 0);
  const expectedFanTotal = fanNeedles.reduce((sum, nd) => sum + nd.dmg * nd.hits.size + nd.dmg * (nd.pierceBonusScaleTotal || 0), 0);
  assert.ok(Math.abs(totalFanDamageOnEnemies - expectedFanTotal) < 1e-4, '敵人物理扣血總和與逐針 hits/bonus 對帳完全吻合');

  // 2. 合法 3 變異組合：mut_seek + mut_frost + mut_pierce
  probe.setBuildMutations(['mut_seek', 'mut_frost', 'mut_pierce']);
  const spec3 = probe.resolveAttackSpec('needle', 3, probe.getBuildState());
  assert.equal(spec3.tracking, true, 'mut_seek 追蹤生效');
  assert.equal(spec3.frost, true, 'mut_frost 冰魄生效');
  assert.equal(spec3.hasPierce, true, 'mut_pierce 穿透增額生效');
  assert.equal(spec3.source, 'mutation');

  // 3. Lv5 覺醒極寒靈暴 + mut_fan + mut_pierce：原生 8 針 + fan 3 針 = 11 針穿透多敵實測
  probe.getNeedles().length = 0;
  p.x = startX; p.y = startY; p.faceAng = 0;
  probe.getWL().needle = 5;
  probe.setBuildMutations(['mut_fan', 'mut_pierce']);
  probe.setWT('katana', 999);

  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const awakenedNeedles = probe.getNeedles();
  assert.equal(awakenedNeedles.length, 11, 'Lv5 + mut_fan 共同生成 11 枚靈針 (8 原生 + 3 fan)');
  assert.ok(awakenedNeedles[0].volley, '具備殉爆預算器');
  assert.equal(awakenedNeedles[0].volley.used, false);
  assert.equal(awakenedNeedles[0].hasPierce, true, 'Lv5 冰針正確繼承 mut_pierce');

  // 11 針共享同一 volley 物件（單次殉爆事件保護）
  for (let i = 0; i < 11; i++) {
    assert.equal(awakenedNeedles[i].volley, awakenedNeedles[0].volley, '所有 11 針必須共享同一個 volley 物件');
  }

  // 放置敵怪驗證穿透命中、增額預算限制與零額外投射物/碎裂
  const initialAwakenedDmgs = awakenedNeedles.map(nd => nd.dmg);
  const sumAwakenedBaseDmg = initialAwakenedDmgs.reduce((a, b) => a + b, 0);
  const iceEnemies = [
    { x: startX + 60, y: startY, hp: 500, max: 500, type: 'mob' },
    { x: startX + 100, y: startY, hp: 500, max: 500, type: 'mob' },
    { x: startX + 140, y: startY, hp: 500, max: 500, type: 'mob' }
  ];
  probe.setEnemies(iceEnemies);

  // 推進至多針穿透命中
  for (let step = 0; step < 5; step++) {
    probe.weapons(0.08);
  }

  // 驗證無額外生成投射物
  assert.ok(probe.getNeedles().length <= 11, '穿透途中絕不額外生成新投射物');

  // 逐針實碰對帳：核算每針 hits.size 與 pierceBonusScaleTotal
  const totalAwakenedHits = awakenedNeedles.reduce((s, nd) => s + nd.hits.size, 0);
  assert.ok(totalAwakenedHits > 0, 'Lv5 11 針實質發生穿透命中');

  const totalAwakenedExtra = awakenedNeedles.reduce((sum, nd) => sum + nd.dmg * (nd.pierceBonusScaleTotal || 0), 0);
  assert.ok(totalAwakenedExtra > 0, 'Lv5 11 針實質產生穿透增額');
  assert.ok(totalAwakenedExtra <= sumAwakenedBaseDmg * 0.30 + 1e-9, `Lv5 11 針總增額 (${totalAwakenedExtra}) 必須 <= sum(nd.dmg)*0.30 (${sumAwakenedBaseDmg * 0.30})`);

  // 敵人物理扣血總額與逐針結算對帳
  const totalAwakenedDamageOnEnemies = iceEnemies.reduce((sum, e) => sum + (500 - e.hp), 0);
  const expectedAwakenedTotal = awakenedNeedles.reduce((sum, nd) => sum + nd.dmg * nd.hits.size + nd.dmg * (nd.pierceBonusScaleTotal || 0), 0);
  assert.ok(Math.abs(totalAwakenedDamageOnEnemies - expectedAwakenedTotal) < 1e-4, 'Lv5 敵人物理扣血總和與逐針 hits/bonus 對帳完全吻合');
});

// ── 28. 飛行中快照隔離、pause/levelup 凍結與雷 Lv5 spec.targetCount 錨點驗證 ──
test('M1-D-28 In-flight needle snapshot isolation against mutation acquisition, pause/levelup freeze, and thunder Lv5 targetCount consumption', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 飛行中快照隔離：
  // 發射無 pierce 的靈針，隨後玩家取得 mut_pierce，已在空中的靈針絕不被追溯加成！
  probe.getP().x = 200; probe.getP().y = 200; probe.getP().faceAng = 0;
  probe.getWL().needle = 1;
  probe.setBuildMutations([]); // 無變異
  probe.getB().dmg = 1.2;
  probe.setWT('katana', 999);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needlesBefore = probe.getNeedles();
  const flyingNeedle = needlesBefore[0];
  flyingNeedle.y = 200; flyingNeedle.vy = 0;
  needlesBefore.length = 1;
  assert.equal(flyingNeedle.hasPierce, false, '飛行中靈針初始無 pierce 標記');

  // 玩家升級取得 mut_pierce 且人物攻擊力 +5.0
  probe.setBuildMutations(['mut_pierce']);
  probe.getB().dmg += 5.0;

  // 放置第 2、第 3 隻敵人
  const enemyA = { x: 260, y: 200, hp: 100, max: 100, type: 'mob' };
  const enemyB = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };
  const enemyC = { x: 340, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([enemyA, enemyB, enemyC]);

  probe.weapons(0.12);
  probe.weapons(0.07);
  probe.weapons(0.07);

  // 關鍵驗證：已在空中的靈針不受 mut_pierce 與屬性升級影響，所有目標均只受初始 2.52 傷害！
  assert.equal(Number((100 - enemyA.hp).toFixed(3)), 2.52, '舊針命中 enemyA 維持初始快照傷');
  assert.equal(Number((100 - enemyB.hp).toFixed(3)), 2.52, '舊針命中 enemyB 絕不被追溯增加 15%');
  assert.equal(Number((100 - enemyC.hp).toFixed(3)), 2.52, '舊針命中 enemyC 絕不被追溯增加 30%');

  // 1b. 帶 pierce 舊針飛行中，經真 offerUp -> applyChoice 取得 passive:dmg 升級，舊針命中依然依生成時快照傷
  // 設置極限飽和環境：4 主動全 Lv5（katana, needle, barrier, thunder）、滿 3 御守、needle 滿 3 變異、其他技能變異全取、其餘被動全滿（b.dmgUp < 4），使全庫候選池只剩 passive:dmg，經真 offerUp() -> applyChoice() 選卡升級，不手塞 setChoices
  probe.getNeedles().length = 0;
  probe.getP().x = 200; probe.getP().y = 200; probe.getP().faceAng = 0;
  probe.getWL().katana = 5;
  probe.getWL().needle = 5;
  probe.getWL().barrier = 5;
  probe.getWL().thunder = 5;
  probe.setBuildCharms(['charm_reach', 'charm_guard', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_pierce', 'mut_return', 'mut_crosscut', 'mut_pulse', 'mut_branch']);
  probe.setBuildDuos(['duo_thundercircle']);
  const bState = probe.getB();
  bState.dmg = 1.2;
  bState.shield = 6;
  bState.oilRegen = 0.12;
  bState.heals = 3;
  bState.rate = 4;
  bState.crit = 3;
  bState.spd = 3;
  bState.dash = 3;
  bState.mag = 3;
  bState.dmgUp = 0;

  probe.setWT('katana', 999);
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const activeNeedlesPierce = probe.getNeedles();
  // 鎖定中央直行針觀測（舊針生成時快照傷為 4.2336 = 4.9 * 0.72 * 1.2）
  const flyingPierceNeedle = activeNeedlesPierce.find(nd => Math.abs(nd.vy) < 10) || activeNeedlesPierce[0];
  flyingPierceNeedle.y = 200; flyingPierceNeedle.vy = 0;
  activeNeedlesPierce.length = 0;
  activeNeedlesPierce.push(flyingPierceNeedle);

  assert.equal(flyingPierceNeedle.hasPierce, true, '飛行中靈針初始帶有 mut_pierce');
  assert.equal(flyingPierceNeedle.dmg, 4.2336, '飛行中靈針生成時快照傷害為 4.2336');

  // 在舊針飛行中，玩家升級並透過真 offerUp -> applyChoice 選取唯一合格卡 passive:dmg
  probe.setLevel(2);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);

  // 驗證全庫候選池唯有 passive:dmg，絕不手塞 setChoices
  const offeredChoices = probe.getChoices();
  assert.equal(offeredChoices.length, 1, '候選池飽和後唯有 1 張合法卡');
  assert.equal(offeredChoices[0].choiceId, 'passive:dmg', '唯有傷害強化卡 passive:dmg');

  const revPower = probe.getBuildRevision();
  const applyPowerRes = probe.applyChoice(offeredChoices[0].choiceId, revPower);
  assert.equal(applyPowerRes.ok, true, '合法選取 passive:dmg 必須成功');
  assert.equal(bState.dmgUp, 1, 'dmgUp 層數增加為 1');
  assert.equal(bState.dmg, 1.5, 'b.dmg 由 1.2 提升至 1.5');

  // 設置 3 隻連續獨敵
  const enemyPierce1 = { x: 260, y: 200, hp: 100, max: 100, type: 'mob' };
  const enemyPierce2 = { x: 300, y: 200, hp: 100, max: 100, type: 'mob' };
  const enemyPierce3 = { x: 340, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([enemyPierce1, enemyPierce2, enemyPierce3]);
  probe.setWT('katana', 999);
  probe.setWT('needle', 999); // 凍結靈針冷卻，確保只有舊針命中

  // 推進時間命中 3 敵：舊針依生成時快照 4.2336 / 4.86864 / 4.86864 結算
  probe.weapons(0.12);
  assert.ok(flyingPierceNeedle.hits.has(enemyPierce1));
  assert.equal(Number((100 - enemyPierce1.hp).toFixed(4)), 4.2336, '第 1 擊維持生成時快照 1.0x (4.2336)');

  probe.weapons(0.07);
  assert.ok(flyingPierceNeedle.hits.has(enemyPierce2));
  assert.equal(Number((100 - enemyPierce2.hp).toFixed(5)), 4.86864, '第 2 擊依生成時快照 1.15x (4.86864)，不被新升級污染');

  probe.weapons(0.07);
  assert.ok(flyingPierceNeedle.hits.has(enemyPierce3));
  assert.equal(Number((100 - enemyPierce3.hp).toFixed(5)), 4.86864, '第 3 擊依生成時快照 1.15x (4.86864)，不被新升級污染');

  // 驗證升級後新發動的靈針正向享受新數值 (5.292 = 4.9 * 0.72 * 1.5)
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const newNeedles = probe.getNeedles().filter(nd => nd !== flyingPierceNeedle);
  assert.ok(newNeedles.length > 0, '冷卻結束後發射新靈針');
  assert.equal(newNeedles[0].dmg, 5.292, '新靈針精確享受升級後的 5.292 傷害');

  // 2. pause / levelup 狀態凍結驗證
  probe.setWT('needle', 1.0);
  probe.setState('pause');
  probe.update(0.3);
  assert.equal(probe.getWT().needle, 1.0, 'pause 期間靈針冷卻計時凍結');

  probe.setState('levelup');
  probe.update(0.3);
  assert.equal(probe.getWT().needle, 1.0, 'levelup 期間靈針冷卻計時凍結');

  // 3. 雷 Lv5 錨點 slice 真正消費 spec.targetCount 驗證
  probe.start('night-town');
  probe.getWL().thunder = 5;
  const thunderSpec = probe.resolveAttackSpec('thunder', 5, probe.getBuildState());
  assert.equal(thunderSpec.targetCount, 3, 'thunder Lv5 spec.targetCount 必須為 3');

  const pThunder = probe.getP();
  pThunder.x = 200; pThunder.y = 200;
  const thEnemies = [
    { x: 250, y: 200, hp: 500, max: 500, type: 'mob' },
    { x: 300, y: 200, hp: 500, max: 500, type: 'mob' },
    { x: 350, y: 200, hp: 500, max: 500, type: 'mob' },
    { x: 500, y: 200, hp: 500, max: 500, type: 'mob' }
  ];
  probe.setEnemies(thEnemies);
  probe.setWT('thunder', 0);
  probe.weapons(0.01);

  // 前 3 個目標受到雷擊 (spec.targetCount = 3)，第 4 個不受主雷擊
  assert.ok(thEnemies[0].hp < 500, '目標 1 受打擊');
  assert.ok(thEnemies[1].hp < 500, '目標 2 受打擊');
  assert.ok(thEnemies[2].hp < 500, '目標 3 受打擊');
  assert.equal(thEnemies[3].hp, 500, '超出 spec.targetCount 的目標不受打擊');
});

// ── 29. mut_return 靈針變異卡池資格、選卡與每技能容量獨立契約 ────
test('M1-D-29 mut_return pool eligibility, unowned needle exclusion, owned inclusion, per-skill capacity limit, schema, applyChoice, and negative protections', () => {
  const env = loadGameSandbox({ random: () => 0 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 未持有靈針 (WL.needle === 0)：mut_return 絕不可進池
  probe.getWL().needle = 0;
  probe.setLevelupCooldown(0);
  const choicesWithoutNeedle = probe.getEligibleChoices();
  assert.ok(!choicesWithoutNeedle.some(c => c.id === 'mut_return'), '未持有天狐靈針時 mut_return 絕不可進入選卡池');

  // 2. 持有靈針 (WL.needle === 1)：mut_return 正常進池且 Schema 符合規範
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_fan', 'mut_seek']);
  probe.setLevelupCooldown(0);
  let returnCard = null;
  for (let i = 0; i < 20 && !returnCard; i++) {
    const choices = probe.getEligibleChoices();
    returnCard = choices.find(c => c.id === 'mut_return');
  }
  assert.ok(returnCard, '持有天狐靈針時 mut_return 必須出現在選卡池');
  assert.equal(returnCard.choiceId, 'mutation:needle:mut_return');
  assert.equal(returnCard.type, 'mutation');
  assert.equal(returnCard.skillId, 'needle');
  assert.deepEqual(Array.from(returnCard.skillIds), ['needle']);
  assert.equal(returnCard.n, '靈針・回旋折返');
  assert.equal(returnCard.s, 'せんぼん・おりかえし');
  assert.equal(returnCard.cat, '【 靈針變異 】');
  assert.equal(returnCard.levelText, '◆ 靈針變異');
  assert.equal(returnCard.rarity, 'mutation');
  assert.ok(returnCard.d.includes('單次折返') && returnCard.d.includes('原點') && returnCard.d.includes('至多') && returnCard.d.includes('壽命不延長') && returnCard.d.includes('不額外生成新針'), '說明文案必須明示單次折返/原點/同敵至多一次/壽命不延長/不額外生成新針');
  assert.equal(returnCard.requirementText, '持有天狐靈針');
  assert.equal(returnCard.limitText, '每種限選一次（每技能最多 3 種變異）');

  // 3. 每技能變異上限獨立：
  // A. needle 已滿 3 變異（fan, seek, frost），即使持有靈針，mut_return 絕不可進池
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  const choicesFullNeedle = probe.getEligibleChoices();
  assert.ok(!choicesFullNeedle.some(c => c.id === 'mut_return'), '靈針已滿 3 變異時 mut_return 絕不可進池');

  // B. 其他技能變異（katana 1, barrier 1, thunder 1）不阻擋 needle 取得 mut_return
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_crosscut', 'mut_pulse', 'mut_branch']);
  let choicesOtherSkillsReturn = null;
  for (let i = 0; i < 20 && !choicesOtherSkillsReturn; i++) {
    const choices = probe.getEligibleChoices();
    choicesOtherSkillsReturn = choices.find(c => c.id === 'mut_return');
  }
  assert.ok(choicesOtherSkillsReturn, '其他技能變異不阻擋 needle 獨立獲得 mut_return');

  // 4. 真選卡 offerUp -> applyChoice 流程
  // 極限飽和環境：4 主動武器 Lv5（katana, needle, barrier, thunder）、滿 3 御守、被動全滿、needle 只持 fan+pierce 2 種變異、其他技能變異全取（katana: mut_crosscut, barrier: mut_pulse, thunder: mut_branch, fire 未持有）
  // 在 random: () => 0 下，真 offerUp() 精確抽出 mut_return，直接 applyChoice，絕不手塞 setChoices
  probe.getWL().katana = 5;
  probe.getWL().needle = 5;
  probe.getWL().barrier = 5;
  probe.getWL().thunder = 5;
  probe.getWL().fire = 0;
  probe.getWL().boom = 0;
  probe.setBuildCharms(['charm_reach', 'charm_guard', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_pierce', 'mut_crosscut', 'mut_pulse', 'mut_branch']);
  const bD29 = probe.getB();
  bD29.shield = 6;
  bD29.oilRegen = 0.12;
  bD29.heals = 3;
  bD29.dmgUp = 4;
  bD29.rate = 4;
  bD29.crit = 3;
  bD29.spd = 3;
  bD29.dash = 3;
  bD29.mag = 3;

  probe.setLevel(2);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const currentChoices = probe.getChoices();
  const returnOffer = currentChoices.find(c => c.id === 'mut_return');
  assert.ok(returnOffer, '選卡候選必須包含 mut_return');
  const rev = probe.getBuildRevision();
  const xpBefore = probe.getXp();

  // A. 負向保護：過期 revision 拒絕
  const staleRes = probe.applyChoice(returnOffer.choiceId, rev - 1);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');
  assert.equal(probe.getXp(), xpBefore);

  // B. 負向保護：未知 choiceId 拒絕
  const unknownRes = probe.applyChoice('mutation:needle:unknown', rev);
  assert.equal(unknownRes.ok, false);
  assert.equal(unknownRes.reason, 'invalid_choice_id');
  assert.equal(probe.getXp(), xpBefore);

  // C. 正式選取 mut_return
  const res = probe.applyChoice(returnOffer.choiceId, rev);
  assert.equal(res.ok, true, '合法選取 mut_return 必須成功');
  assert.equal(probe.getState(), 'play', '選卡後切回 play 狀態');
  assert.ok(probe.getBuildMutations().includes('mut_return'), 'BuildMutations 陣列必須包含 mut_return');
  assert.ok(probe.getBuildState().mutations.includes('mut_return'), 'BuildState.mutations 必須包含 mut_return');

  // D. 負向保護：連按雙擊防重扣
  const doubleClick = probe.applyChoice(returnOffer.choiceId, rev);
  assert.equal(doubleClick.ok, false);
  assert.equal(doubleClick.reason, 'not_in_levelup');

  // E. 去重保護：已選取的 mut_return 絕不再出現在候選池
  const choicesAfter = probe.getEligibleChoices();
  assert.ok(!choicesAfter.some(c => c.id === 'mut_return'), '已持有的 mut_return 不得重複出現在選卡池');
});

// ── 30. resolveAttackSpec needle 快照數值忠實度、Lv1–5 基線保持與 mut_return 參數 ──
test('M1-D-30 resolveAttackSpec needle snapshot numerical fidelity, baseline preservation Lv1-5, and mut_return parameters', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 無變異基線 Lv1–5 100% 保持
  const bsBase = { ...probe.getBuildState(), mutations: [] };
  for (let lvl = 1; lvl <= 5; lvl++) {
    const s = probe.resolveAttackSpec('needle', lvl, bsBase);
    assert.equal(s.skillId, 'needle');
    assert.equal(s.level, lvl);
    assert.equal(s.hasReturn, false, '無變異時 hasReturn 必須為 false');
    assert.equal(s.returnDistance, 0, '無變異時 returnDistance 為 0');
    assert.equal(s.return, undefined, '無變異時 return 欄位未定義');
  }

  // 2. 具備 mut_return 變異時之快照規格 (Lv1-4 speed 640, life 0.65 -> 640*0.65*0.40 = 166.4 <= 220; Lv5 life 0.95 -> 640*0.95*0.40 = 243.2 -> cap 220)
  const bsReturn = { ...probe.getBuildState(), mutations: ['mut_return'] };
  for (let lvl = 1; lvl <= 4; lvl++) {
    const s = probe.resolveAttackSpec('needle', lvl, bsReturn);
    assert.equal(s.skillId, 'needle');
    assert.equal(s.level, lvl);
    assert.equal(s.source, 'mutation');
    assert.equal(s.hasReturn, true, '持有 mut_return 時 hasReturn 為 true');
    assert.equal(s.return, true, '持有 mut_return 時 return 標記為 true');
    assert.equal(s.returnDistance, 166.4, 'Lv1-4 returnDistance 精確為 166.4');
  }

  const s5 = probe.resolveAttackSpec('needle', 5, bsReturn);
  assert.equal(s5.isAwakened, true);
  assert.equal(s5.hasReturn, true);
  assert.equal(s5.return, true);
  assert.equal(s5.returnDistance, 220, 'Lv5 returnDistance 封頂於 220');

  // 3. 御守 charm_reach 連動快照 (life 增長但封頂 220 保持有效)
  const bsReach = { ...probe.getBuildState(), charms: ['charm_reach'], mutations: ['mut_return'] };
  const sReach1 = probe.resolveAttackSpec('needle', 1, bsReach);
  assert.equal(sReach1.returnDistance, 183.04, 'charm_reach 加持下 Lv1 射程距離快照為 183.04');

  const sReach5 = probe.resolveAttackSpec('needle', 5, bsReach);
  assert.equal(sReach5.returnDistance, 220, 'charm_reach 加持下 Lv5 射程依然封頂於 220');
});

// ── 31. weapons(dt) 實體靈針單次折返、原點錨定、玩家移動不偏移與消散生命週期 ──
test('M1-D-31 weapons(dt) needle single return real execution, origin snapshotted, player movement independence, no secondary return, and dissipation', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const startX = p.x, startY = p.y;
  p.faceAng = 0; // 面向右方 (+x)
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_return']);
  probe.setWT('katana', 999);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  assert.ok(needles.length > 0, '發射靈針');
  const centerNeedle = needles.find(nd => Math.abs(nd.vy) < 10) || needles[0];
  centerNeedle.y = startY; centerNeedle.vy = 0;
  needles.length = 0; needles.push(centerNeedle);

  // 1. 生成時原點與折返參數快照
  assert.equal(centerNeedle.originX, startX, 'originX 快照為發射時玩家 X');
  assert.equal(centerNeedle.originY, startY, 'originY 快照為發射時玩家 Y');
  assert.equal(centerNeedle.returnDistance, 166.4, 'Lv1 折返距離為 166.4');
  assert.ok(centerNeedle.distanceTraveled < 10, '初始累積位移在第一步內 (< 10)');
  assert.equal(centerNeedle.returned, false);
  assert.equal(centerNeedle.returning, false);

  // 2. 出程飛行
  probe.weapons(0.15);
  assert.ok(centerNeedle.distanceTraveled > 0 && centerNeedle.distanceTraveled < 166.4);
  assert.equal(centerNeedle.returned, false, '未達折返距離時未折返');
  assert.ok(centerNeedle.vx > 0, '出程速度向右');

  // 玩家大幅移動甚至衝刺遠離 (位移至 +500px 處)
  p.x = startX + 500;
  p.y = startY + 300;

  // 推進至累積位移達 166.4 觸發折返
  probe.weapons(0.15);
  assert.equal(centerNeedle.returned, true, '累積位移達 166.4 時 returned 標記為 true');
  assert.equal(centerNeedle.returning, true, 'returning 標記為 true');
  assert.equal(centerNeedle.curve, false, '回程凍結曲線');
  assert.equal(centerNeedle.tracking, false, '回程凍結追蹤');

  // 關鍵驗證：速度方向朝向生成原點 (startX, startY)，絕非朝向當前玩家！速度不瞬移
  assert.ok(centerNeedle.vx < 0, '回程速度向左（朝向原點 startX）');
  const speed = Math.hypot(centerNeedle.vx, centerNeedle.vy);
  assert.ok(Math.abs(speed - 640) < 1, '回程速度維持 640，絕不瞬移');

  // 3. 無二次折返保護：回程繼續飛行累積更多距離，絕不再轉向出程
  const vxBefore = centerNeedle.vx;
  probe.weapons(0.10);
  assert.equal(centerNeedle.returned, true, '已折返過標記維持 true');
  assert.ok(centerNeedle.vx < 0 && Math.abs(centerNeedle.vx - vxBefore) < 1, '速度方向保持朝向原點直行，無二次折返');

  // 4. 飛抵生成原點附近消散生命週期
  for (let t = 0; t < 10 && centerNeedle.life > 0; t++) {
    probe.weapons(0.05);
  }
  assert.equal(centerNeedle.life, 0, '抵達原點附近時靈針正常消散 (life = 0)');
  assert.equal(probe.getNeedles().length, 0, '消散後佇列清空');
});

// ── 32. 往返同敵 hits Set 去重、穿透增額共享與零額外投射物 ────────
test('M1-D-32 Needle outbound and inbound hit deduplication, pierce bonus budget sharing, and zero extra projectiles', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const startX = p.x, startY = p.y;
  p.faceAng = 0;
  probe.getWL().needle = 1;
  probe.setBuildMutations(['mut_pierce', 'mut_return']);
  probe.setWT('katana', 999);

  const baseDmg = 2.52;

  // 出程怪 eOut 放置於前方 100px 處
  const eOut = { x: startX + 100, y: startY, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([eOut]);

  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needles = probe.getNeedles();
  const centerNeedle = needles.find(nd => Math.abs(nd.vy) < 10) || needles[0];
  centerNeedle.y = startY; centerNeedle.vy = 0;
  needles.length = 0; needles.push(centerNeedle);

  // 1. 出程推進命中 eOut (第 1 擊：1.0x 原傷 2.52)
  for (let t = 0; t < 4; t++) probe.weapons(0.05);
  assert.ok(centerNeedle.hits.has(eOut), '出程命中 eOut');
  assert.equal(Number((100 - eOut.hp).toFixed(3)), baseDmg, 'eOut 承受 1.0x 原傷 (2.52)');
  assert.equal(centerNeedle.pierceHits, 1);

  // 2. 推進至達 166.4 折返
  for (let t = 0; t < 3; t++) probe.weapons(0.05);
  assert.equal(centerNeedle.returning, true, '成功折返');
  assert.ok(probe.getNeedles().length <= 1, '折返絕不額外生成新投射物');

  // 3. 回程途中有新怪 eIn 出現在 startX + 50 處
  const eIn = { x: startX + 50, y: startY, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([eOut, eIn]);
  eOut.inb = 0; // 模擬受擊間隔結束

  // 回程推進穿過 eOut：受 hits Set 保護絕不重複扣血！
  for (let t = 0; t < 3; t++) probe.weapons(0.05);
  assert.equal(Number((100 - eOut.hp).toFixed(3)), baseDmg, '回程再次穿過 eOut 絕不重複結算扣血');

  // 4. 回程推進命中 eIn：共享 pierceHits 預算，累計第 2 擊享受 1.15x (2.898)
  for (let t = 0; t < 2; t++) probe.weapons(0.05);
  assert.ok(centerNeedle.hits.has(eIn), '回程命中新怪 eIn');
  assert.equal(centerNeedle.pierceHits, 2, '回程新怪累計為第 2 擊');
  assert.equal(Number((100 - eIn.hp).toFixed(3)), 2.898, 'eIn 共享穿透增額享受 1.15x (2.898)');
  assert.ok(centerNeedle.pierceBonusScaleTotal <= 0.30, '穿透增額共享且不超額');

  // 5. 靈針返回原點消散
  for (let t = 0; t < 3; t++) probe.weapons(0.05);
  assert.equal(centerNeedle.life, 0, '回到原點消散');
});

// ── 33. 合法 3 變異組合疊加與 Lv5 覺醒冰針折返殉爆保護 ────────
test('M1-D-33 Valid 3-mutation stacking and Lv5 awakened ice needles with return and single volley shatter integrity', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const startX = p.x, startY = p.y;
  p.faceAng = 0;

  // 1. 合法 3 變異組合 A: mut_fan + mut_seek + mut_return
  probe.getWL().needle = 3;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_return']);
  const specA = probe.resolveAttackSpec('needle', 3, probe.getBuildState());
  assert.equal(specA.fan, true, '千本散射生效');
  assert.equal(specA.tracking, true, '引魂追跡生效');
  assert.equal(specA.hasReturn, true, '回旋折返生效');
  assert.equal(specA.count, 10, 'Lv3 (7) + fan (3) = 10 針');

  // 2. 合法 3 變異組合 B: mut_pierce + mut_return + mut_frost
  probe.setBuildMutations(['mut_pierce', 'mut_return', 'mut_frost']);
  const specB = probe.resolveAttackSpec('needle', 3, probe.getBuildState());
  assert.equal(specB.hasPierce, true);
  assert.equal(specB.hasReturn, true);
  assert.equal(specB.frost, true);

  // 3. Lv5 覺醒極寒靈暴 + mut_return: 8 針皆具備 return 與共用 volley
  probe.getNeedles().length = 0;
  probe.getWL().needle = 5;
  probe.setBuildMutations(['mut_return']);
  probe.setWT('katana', 999);
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const iceNeedles = probe.getNeedles();
  assert.equal(iceNeedles.length, 8, 'Lv5 生成 8 枚極寒冰針');
  const sharedVolley = iceNeedles[0].volley;
  assert.ok(sharedVolley, '具備 volley 物件');
  assert.equal(sharedVolley.used, false);

  for (const nd of iceNeedles) {
    assert.equal(nd.hasReturn, true);
    assert.equal(nd.returnDistance, 220, 'Lv5 冰針折返距離 220');
    assert.equal(nd.volley, sharedVolley, '8 針共享同一個 volley 物件');
  }
});

// ── 34. 飛行中快照隔離、pause/levelup 凍結與狀態機生命週期清理 ──
test('M1-D-34 In-flight needle return snapshot isolation against mutation acquisition, pause/levelup freeze, and lifecycle reset', () => {
  const env = loadGameSandbox({ random: () => 0.99 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  const p = probe.getP();
  const startX = p.x, startY = p.y;
  p.faceAng = 0;
  probe.getWL().needle = 1;
  probe.setBuildMutations([]); // 初始無 mut_return
  probe.setWT('katana', 999);
  probe.setWT('needle', 0);
  probe.weapons(0.01);

  const needlesBefore = probe.getNeedles();
  const flyingNeedle = needlesBefore[0];
  flyingNeedle.y = startY; flyingNeedle.vy = 0;
  needlesBefore.length = 1;

  assert.equal(flyingNeedle.hasReturn, false, '飛行中靈針初始無 mut_return');

  // 1. 玩家中途取得 mut_return：已在空中飛行的舊針絕不被追溯加裝折返！
  probe.setBuildMutations(['mut_return']);

  // 推進至超過 200px
  probe.weapons(0.40);
  assert.equal(flyingNeedle.returned, false, '舊針絕不折返');
  assert.equal(flyingNeedle.returning, false);
  assert.ok(flyingNeedle.vx > 0, '舊針持續向右直行至壽命耗盡');

  // 2. pause / levelup 狀態凍結：distanceTraveled 與位置不推進
  probe.getNeedles().length = 0;
  probe.setWT('needle', 0);
  probe.weapons(0.01);
  const activeNeedles = probe.getNeedles();
  const ndPause = activeNeedles[0];
  ndPause.y = startY; ndPause.vy = 0;
  activeNeedles.length = 1;

  probe.weapons(0.10);
  const distTraveledSnap = ndPause.distanceTraveled;
  const xSnap = ndPause.x;

  probe.setState('pause');
  probe.update(0.30);
  assert.equal(ndPause.distanceTraveled, distTraveledSnap, 'pause 期間累積位移凍結');
  assert.equal(ndPause.x, xSnap, 'pause 期間座標凍結');

  probe.setState('levelup');
  probe.update(0.30);
  assert.equal(ndPause.distanceTraveled, distTraveledSnap, 'levelup 期間累積位移凍結');
  assert.equal(ndPause.x, xSnap, 'levelup 期間座標凍結');

  // 3. start / loseRun / victory 清理：清空 needles 佇列無幽靈折返
  probe.setState('play');
  probe.loseRun();
  assert.equal(probe.getState(), 'lampout');

  probe.start('night-town');
  assert.equal(probe.getNeedles().length, 0, 'start() 清空所有靈針');
});

// ── 35. mut_orbit 狐火變異卡池資格、選卡與每技能容量獨立契約 ────
test('M1-D-35 mut_orbit pool eligibility, unowned fire exclusion, owned inclusion, per-skill capacity limit, schema, applyChoice, and negative protections', () => {
  const env = loadGameSandbox({ random: () => 0 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 未持有狐火 (WL.fire === 0)：mut_orbit 絕不可進池
  probe.getWL().fire = 0;
  probe.setLevelupCooldown(0);
  const choicesWithoutFire = probe.getEligibleChoices();
  assert.ok(!choicesWithoutFire.some(c => c.id === 'mut_orbit'), '未持有狐火時 mut_orbit 絕不可進入選卡池');

  // 2. 持有狐火 (WL.fire === 1)：mut_orbit 正常進池且 Schema 符合規範
  probe.getWL().fire = 1;
  probe.setLevelupCooldown(0);
  let orbitCard = null;
  for (let i = 0; i < 20 && !orbitCard; i++) {
    const choices = probe.getEligibleChoices();
    orbitCard = choices.find(c => c.id === 'mut_orbit');
  }
  assert.ok(orbitCard, '持有狐火時 mut_orbit 必須出現在選卡池');
  assert.equal(orbitCard.choiceId, 'mutation:fire:mut_orbit');
  assert.equal(orbitCard.type, 'mutation');
  assert.equal(orbitCard.skillId, 'fire');
  assert.deepEqual(Array.from(orbitCard.skillIds), ['fire']);
  assert.equal(orbitCard.n, '狐火・偏心輪道');
  assert.equal(orbitCard.s, 'こか・へんしんりんどう');
  assert.equal(orbitCard.cat, '【 狐火變異 】');
  assert.equal(orbitCard.levelText, '◆ 狐火變異');
  assert.equal(orbitCard.rarity, 'mutation');
  assert.ok(orbitCard.d.includes('長短軸偏心橢圓') && orbitCard.d.includes('rx=126') && orbitCard.d.includes('ry=78') && orbitCard.d.includes('不增加火球數量') && orbitCard.d.includes('保持各級接觸') && orbitCard.d.includes('黑龍特性'), '說明文案必須明示長短軸偏心橢圓/rx126/ry78/不增加火球數量/保持各級接觸與黑龍特性');
  assert.equal(orbitCard.requirementText, '持有狐火');
  assert.equal(orbitCard.limitText, '每種限選一次（每技能最多 3 種變異）');

  // 3. 每技能變異上限獨立：其他技能變異滿不阻擋 fire 取得 mut_orbit
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_branch']);
  let choicesOtherSkillsOrbit = null;
  for (let i = 0; i < 20 && !choicesOtherSkillsOrbit; i++) {
    const choices = probe.getEligibleChoices();
    choicesOtherSkillsOrbit = choices.find(c => c.id === 'mut_orbit');
  }
  assert.ok(choicesOtherSkillsOrbit, '其他技能變異滿不阻擋 fire 獨立獲得 mut_orbit');

  // 已持有 mut_orbit 絕不重複出現
  probe.setBuildMutations(['mut_orbit']);
  const choicesWithOrbit = probe.getEligibleChoices();
  assert.ok(!choicesWithOrbit.some(c => c.id === 'mut_orbit'), '已持有的 mut_orbit 不得重複出現在選卡池');

  // 4. 真選卡 offerUp -> applyChoice 流程
  // 極限飽和環境：4 主動武器 Lv5（katana, needle, barrier, fire）、滿 3 御守、被動全滿、needle 3 變異滿、katana 1、barrier 1，fire 0 變異
  // 在 random: () => 0 下，真 offerUp() 精確抽出 mut_orbit，直接 applyChoice，絕不手塞 setChoices
  probe.getWL().katana = 5;
  probe.getWL().needle = 5;
  probe.getWL().barrier = 5;
  probe.getWL().fire = 5;
  probe.getWL().thunder = 0;
  probe.getWL().boom = 0;
  probe.setBuildCharms(['charm_reach', 'charm_guard', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse']);
  const bD35 = probe.getB();
  bD35.shield = 6;
  bD35.oilRegen = 0.12;
  bD35.heals = 3;
  bD35.dmgUp = 4;
  bD35.rate = 4;
  bD35.crit = 3;
  bD35.spd = 3;
  bD35.dash = 3;
  bD35.mag = 3;

  probe.setLevel(2);
  probe.setXp(100);
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const currentChoices = probe.getChoices();
  const orbitOffer = currentChoices.find(c => c.id === 'mut_orbit');
  assert.ok(orbitOffer, '選卡候選必須包含 mut_orbit');
  const rev = probe.getBuildRevision();
  const xpBefore = probe.getXp();

  // A. 負向保護：過期 revision 拒絕
  const staleRes = probe.applyChoice(orbitOffer.choiceId, rev - 1);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'stale_revision');
  assert.equal(probe.getXp(), xpBefore);

  // B. 負向保護：未知 choiceId 拒絕
  const unknownRes = probe.applyChoice('mutation:fire:unknown', rev);
  assert.equal(unknownRes.ok, false);
  assert.equal(unknownRes.reason, 'invalid_choice_id');
  assert.equal(probe.getXp(), xpBefore);

  // C. 正式選取 mut_orbit
  const res = probe.applyChoice(orbitOffer.choiceId, rev);
  assert.equal(res.ok, true, '合法選取 mut_orbit 必須成功');
  assert.equal(probe.getState(), 'play', '選卡後切回 play 狀態');
  assert.ok(probe.getBuildMutations().includes('mut_orbit'), 'BuildMutations 陣列必須包含 mut_orbit');
  assert.ok(probe.getBuildState().mutations.includes('mut_orbit'), 'BuildState.mutations 必須包含 mut_orbit');

  // D. 負向保護：連按雙擊防重扣
  const doubleClick = probe.applyChoice(orbitOffer.choiceId, rev);
  assert.equal(doubleClick.ok, false);
  assert.equal(doubleClick.reason, 'not_in_levelup');

  // E. 去重保護：已選取的 mut_orbit 絕不再出現在候選池
  const choicesAfter = probe.getEligibleChoices();
  assert.ok(!choicesAfter.some(c => c.id === 'mut_orbit'), '已持有的 mut_orbit 不得重複出現在選卡池');
});

// ── 36. resolveAttackSpec fire 快照數值忠實度、Lv1–5 基線保持與 mut_orbit 橢圓參數 ──
test('M1-D-36 resolveAttackSpec fire snapshot numerical fidelity, baseline preservation Lv1-5, and mut_orbit ellipse dimensions', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 無變異基線 Lv1–5 100% 保持
  const bsBase = { ...probe.getBuildState(), mutations: [] };
  const expectedCounts = [1, 2, 3, 3, 3];
  const expectedContactDmgs = [2.16, 2.88, 3.6, 4.32, 5.04]; // (1.2 + lvl * 0.6) * 1.2

  for (let lvl = 1; lvl <= 5; lvl++) {
    const spec = probe.resolveAttackSpec('fire', lvl, bsBase);
    assert.equal(spec.skillId, 'fire');
    assert.equal(spec.level, lvl);
    assert.equal(spec.isAwakened, lvl === 5);
    assert.equal(spec.source, 'base');
    assert.equal(spec.hasOrbit, false);
    assert.equal(spec.rx, 98, `Lv${lvl} 無變異 rx 必須為 98`);
    assert.equal(spec.ry, 98, `Lv${lvl} 無變異 ry 必須為 98`);
    assert.equal(spec.count, expectedCounts[lvl - 1], `Lv${lvl} 火數必須為 ${expectedCounts[lvl - 1]}`);
    assert.equal(spec.angularSpeed, 2.8);
    assert.equal(spec.hitInterval, 0.42);
    assert.equal(spec.contactDamage, expectedContactDmgs[lvl - 1], `Lv${lvl} 接觸傷必須為 ${expectedContactDmgs[lvl - 1]}`);
  }

  // Lv4 特有離體式神參數
  const spec4 = probe.resolveAttackSpec('fire', 4, bsBase);
  assert.equal(spec4.attackCount, 1, 'Lv4 離體火數必須為 1');
  assert.equal(spec4.spiritDamage, 6.84, 'Lv4 式神傷害必須為 6.84'); // (2.1 + 4 * 0.9) * 1.2 = 6.84
  assert.equal(spec4.spiritCooldown, 1.55, 'Lv4 離體冷卻必須為 1.55');

  // Lv5 特有黑龍與焦土參數
  const spec5 = probe.resolveAttackSpec('fire', 5, bsBase);
  assert.equal(spec5.count, 3, 'Lv5 環繞火數必須維持 3 顆');
  assert.equal(spec5.cooldown, 7.2, 'Lv5 黑龍冷卻必須為 7.2');
  assert.equal(spec5.dragonDirectDmg, 14.4, 'Lv5 黑龍直擊傷必須為 14.4'); // 12 * 1.2
  assert.equal(spec5.dragonSplashDmg, 4.8, 'Lv5 黑龍濺射傷必須為 4.8'); // 4 * 1.2
  assert.equal(spec5.dragonScorchDmg, 2.16, 'Lv5 黑龍焦土傷必須為 2.16'); // 1.8 * 1.2
  assert.equal(spec5.scorchDuration, 5, 'Lv5 焦土時長必須為 5s');
  assert.equal(spec5.scorchRadius, 140, 'Lv5 焦土半徑必須為 140');

  // 2. 有 mut_orbit 變異時：rx=126, ry=78，不加火數、不加角速、不加傷害倍率
  const bsOrbit = { ...probe.getBuildState(), mutations: ['mut_orbit'] };
  for (let lvl = 1; lvl <= 5; lvl++) {
    const spec = probe.resolveAttackSpec('fire', lvl, bsOrbit);
    assert.equal(spec.source, 'mutation');
    assert.equal(spec.hasOrbit, true);
    assert.equal(spec.rx, 126, `Lv${lvl} mut_orbit rx 必須為 126`);
    assert.equal(spec.ry, 78, `Lv${lvl} mut_orbit ry 必須為 78`);
    assert.equal(spec.count, expectedCounts[lvl - 1], `Lv${lvl} 變異後火數不可增加，仍為 ${expectedCounts[lvl - 1]}`);
    assert.equal(spec.angularSpeed, 2.8, `Lv${lvl} 變異後角速不可增加，仍為 2.8`);
    assert.equal(spec.contactDamage, expectedContactDmgs[lvl - 1], `Lv${lvl} 變異後接觸傷不可增加，仍為 ${expectedContactDmgs[lvl - 1]}`);
  }
});

// ── 37. 多相位物理碰撞與渲染座標同源對齊、橢圓長短軸邊界負向判定與切線速度 ────
test('M1-D-37 Physical multi-phase render and collision coordination, ellipse boundary negative tests, and ember tangent velocity', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const plays = [];
  const paints = [];
  env.SKILLFX.play = (...args) => plays.push(args);
  env.SKILLFX.paint = (...args) => paints.push(args);

  probe.getP().x = 300;
  probe.getP().y = 300;
  probe.getWL().fire = 1;
  probe.getWL().katana = 0;
  probe.setBuildMutations(['mut_orbit']);
  probe.setWT('katana', 999);

  // 1. 相位 a = 0：火球位於 (300 + 126, 300) = (426, 300)
  probe.setFAng(0);
  const specOrbit = probe.resolveAttackSpec('fire', 1, probe.getBuildState());
  assert.equal(specOrbit.rx, 126);
  assert.equal(specOrbit.ry, 78);

  // 敵人放在 (420, 300)：距離 426 為 6px <= 30px -> 命中受傷
  const enemyHitLong = { x: 420, y: 300, hp: 100, max: 100, type: 'mob' };
  // 敵人放在 (300, 420)：若以短軸半徑 78 算，火在 (300, 378)，距離為 420 - 378 = 42px > 30px -> 負向邊界不命中！
  const enemyMissShort = { x: 300, y: 420, hp: 100, max: 100, type: 'mob' };
  // 敵人放在長軸外側 (465, 300)：距離 426 為 39px > 30px -> 負向邊界不命中！
  const enemyMissLongFar = { x: 465, y: 300, hp: 100, max: 100, type: 'mob' };

  probe.setEnemies([enemyHitLong, enemyMissShort, enemyMissLongFar]);
  probe.weapons(0.001);

  assert.ok(enemyHitLong.hp < 100, '長軸頂點附近敵人 (420, 300) 必須受到命中');
  assert.equal(enemyMissShort.hp, 100, '短軸同距離敵人 (300, 420) 超出 ry=78 範圍，絕不受傷（負向判定）');
  assert.equal(enemyMissLongFar.hp, 100, '長軸外側敵人 (465, 300) 超出碰撞半徑，絕不受傷（負向判定）');

  // 1b. 驗證 SKILLFX.paint 渲染參數與物理碰撞同源
  probe.runFrame(1001);
  const firePaint = paints.find(p => p[1] === 'fire');
  assert.ok(firePaint, 'runFrame 必須呼叫 SKILLFX.paint(..., fire, ...)');
  assert.equal(firePaint[2], 1, 'paint 傳入等級為 1');
  const pData = firePaint[3];
  assert.equal(pData.rx, 126, 'paint 渲染 rx 必須為 126');
  assert.equal(pData.ry, 78, 'paint 渲染 ry 必須為 78');
  assert.equal(pData.orbitR, 126, 'paint 軌道半徑 orbitR 必須為 126');
  assert.equal(pData.orbitRy, 78, 'paint 軌道半徑 orbitRy 必須為 78');
  assert.ok(Math.abs(pData.x - (300 + Math.cos(pData.ang) * 126)) < 0.001, 'paint 渲染 X 座標與橢圓公式一致');
  assert.ok(Math.abs(pData.y - (300 + Math.sin(pData.ang) * 78)) < 0.001, 'paint 渲染 Y 座標與橢圓公式一致');

  // 2. 切換相位 a = Math.PI / 2：火球轉至 (300, 300 + 78) = (300, 378)
  probe.setFAng(Math.PI / 2);
  const enemyHitShort = { x: 300, y: 385, hp: 100, max: 100, type: 'mob' }; // 距離 378 為 7px <= 30px -> 命中
  const enemyMissLongAtShortPhase = { x: 426, y: 300, hp: 100, max: 100, type: 'mob' }; // 此時火不在長軸，距離 > 100 -> 不命中
  probe.setEnemies([enemyHitShort, enemyMissLongAtShortPhase]);
  probe.weapons(0.001);

  assert.ok(enemyHitShort.hp < 100, '短軸頂點附近敵人 (300, 385) 在 a=PI/2 相位必須受到命中');
  assert.equal(enemyMissLongAtShortPhase.hp, 100, '此時火已轉走，原長軸位置敵人不受傷');

  // 3. 無變異 98x98 圓形基線負向保護
  probe.setBuildMutations([]); // 移除 mut_orbit
  probe.setFAng(0); // 火球在 (300 + 98, 300) = (398, 300)
  const enemyAt432 = { x: 432, y: 300, hp: 100, max: 100, type: 'mob' }; // 距離 398 為 34px > 30px -> 不命中
  probe.setEnemies([enemyAt432]);
  probe.weapons(0.001);
  assert.equal(enemyAt432.hp, 100, '無變異 98 圓形下 (432, 300) 敵人不受傷（負向保護）');

  // 4. 切線速度與粒子發射由 SKILLFX.play 實體捕獲驗證（非公式自比）
  probe.setBuildMutations(['mut_orbit']);
  probe.setFAng(Math.PI * 0.25);
  plays.length = 0;
  probe.weapons(0.06);
  const emberPlay = plays.find(p => p[0] === 'fire' && p[1] === 'ember');
  assert.ok(emberPlay, 'weapons(dt) 必須呼叫 SKILLFX.play(fire, ember, ...) 發射粒子');
  const eData = emberPlay[3];
  const expectedAng = probe.getFAng();
  const expectedVx = -Math.sin(expectedAng) * 126 * 2.8;
  const expectedVy = Math.cos(expectedAng) * 78 * 2.8;
  assert.ok(Math.abs(eData.vx - expectedVx) < 0.01, 'SKILLFX.play 捕獲之 vx 必須為真切線速度');
  assert.ok(Math.abs(eData.vy - expectedVy) < 0.01, 'SKILLFX.play 捕獲之 vy 必須為真切線速度');
  assert.ok(Math.abs(eData.x - (300 + Math.cos(expectedAng) * 126)) < 0.01, 'ember X 與軌道槽位同源');
  assert.ok(Math.abs(eData.y - (300 + Math.sin(expectedAng) * 78)) < 0.01, 'ember Y 與軌道槽位同源');
});

// ── 38. Lv4 離體追擊起點對齊橢圓槽位、單隻式神、命中 Set 保護與生成時傷害快照隔離 ──
test('M1-D-38 Lv4 detached spirit slot alignment, single spirit generation, hitSet deduplication, and spiritDamage snapshot isolation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 200;
  probe.getP().y = 200;
  probe.getWL().fire = 4;
  probe.getWL().katana = 0;
  probe.setWT('katana', 999);
  probe.setBuildMutations(['mut_orbit']);
  probe.getB().dmg = 1.2;

  // 1. 離體式神生成與起點對齊橢圓槽位 (slot 0, a = 0)
  probe.setFAng(0);
  const target = { x: 420, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([target]);

  // 觸發 Lv4 離體式神生成
  probe.weapons(0.0001);
  const ghosts = probe.getGhosts();
  const spirits = ghosts.filter(g => g.fireAttack && g.life > 0);
  assert.equal(spirits.length, 1, 'Lv4 離體追擊精確生成 1 隻式神（fireAttackCount=1）');
  const spirit = spirits[0];
  assert.ok(Math.abs(spirit.x - (200 + 126)) < 0.1, '式神初始起點 X 精確對齊橢圓槽位 (P.x + rx = 326)');
  assert.ok(Math.abs(spirit.y - 200) < 0.1, '式神初始起點 Y 精確對齊橢圓槽位 (P.y = 200)');
  assert.equal(spirit.spiritDamage, 6.84, '式神生成時快照 spiritDamage 為 6.84');
  assert.equal(Number(spirit.life.toFixed(2)), 2.6, '式神原生生命為 2.6s');

  // 2. 飛行中升級 b.dmg 不回寫舊式神傷害快照
  probe.getB().dmg = 1.5; // 玩家提升傷害係數
  probe.getB().dmgUp = 1;

  // 推進時間使式神命中 target
  spirit.x = target.x - 5;
  spirit.y = target.y;
  probe.weapons(0.016);

  assert.ok(spirit.hitSet.has(target), '命中 target 記入 hitSet');
  assert.equal(spirit.returning, true, '式神命中後進入 returning 回航狀態');
  assert.equal(Number((100 - target.hp).toFixed(4)), 6.84, '舊式神命中傷害嚴格依生成時快照 6.84 結算，絕不回寫為 8.55');

  // 3. hitSet 重複碰觸去重：同敵回程不再扣血
  probe.weapons(0.05);
  assert.equal(Number((100 - target.hp).toFixed(4)), 6.84, '回航途中重複碰觸同敵絕不再次扣血');

  // 4. 冷卻結束後新生成的式神正向享受升級後的 8.55 傷害
  spirit.life = 0; // 舊式神消散
  probe.getGhosts().length = 0;
  const newTarget = { x: 420, y: 200, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([newTarget]);
  probe.weapons(1.6); // 推進超過 spiritCooldown (1.55s)

  const newSpirits = probe.getGhosts().filter(g => g.fireAttack && g.life > 0);
  assert.ok(newSpirits.length >= 1, '冷卻後生成新式神');
  const newSpirit = newSpirits[0];
  assert.equal(newSpirit.spiritDamage, 8.55, '新生成式神精確享受升級後的 8.55 傷害快照');
});

// ── 39. Lv5 墨焰黑龍 7.2s、3 球、3 焦土 5s 完整傷害快照傳遞鏈與升級不回寫對照 ──
test('M1-D-39 Lv5 Black Dragon 7.2s, 3 fireballs, 3 scorches, and full damage snapshot transmission chain', () => {
  const env = loadGameSandbox({ random: () => 0.5 });
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().fire = 5;
  probe.getWL().katana = 5;
  probe.getWL().thunder = 5;
  probe.getWL().barrier = 5;
  probe.setWT('katana', 999);
  probe.setWT('thunder', 999);
  probe.setWT('barrier', 999);
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_cadence']);
  probe.setBuildMutations(['mut_orbit', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_fan', 'mut_seek', 'mut_frost', 'mut_pierce', 'mut_return']);
  const b = probe.getB();
  b.dmg = 1.2;
  b.shield = 6;
  b.oilRegen = 0.12;
  b.heals = 3;
  b.rate = 4;
  b.crit = 3;
  b.spd = 3;
  b.dash = 3;
  b.mag = 3;

  // 1. Lv5 依然保留 3 顆環繞火
  const spec5 = probe.resolveAttackSpec('fire', 5, probe.getBuildState());
  assert.equal(spec5.count, 3, 'Lv5 依然保留 3 顆環繞火');

  // 放置索敵目標並就緒召喚黑龍
  probe.setWT('fire', 0);
  const bossFoe = { x: 500, y: 300, hp: 5000, max: 5000, type: 'mob' };
  probe.setEnemies([bossFoe]);

  // 2. 召喚黑龍並快照傷害
  probe.weapons(0.016);
  const dragon = probe.getGhosts().find(g => g.dragon && g.life > 0);
  assert.ok(dragon, '7.2s 冷卻就緒且有目標時召喚黑龍');
  assert.equal(probe.getWT().fire, 7.2, '黑龍冷卻計時重置為 7.2s');
  assert.equal(dragon.dragonDirectDmg, 14.4, '黑龍直擊傷害快照為 14.4');
  assert.equal(dragon.dragonSplashDmg, 4.8, '黑龍濺射傷害快照為 4.8');
  assert.equal(dragon.dragonScorchDmg, 2.16, '黑龍焦土傷害快照為 2.16');
  assert.equal(dragon.scorchDuration, 5, '焦土持續時間為 5s');
  assert.equal(dragon.scorchRadius, 140, '焦土半徑為 140');

  // 3. 推進至噴出 3 枚火球，火球傳遞同一傷害快照
  for (let step = 0; step < 45; step++) {
    probe.weapons(0.016);
    if (probe.getDragonShots().length >= 3) break;
  }
  const shots = probe.getDragonShots();
  assert.equal(shots.length, 3, '黑龍噴出 3 枚火球');
  for (const shot of shots) {
    assert.equal(shot.dragonDirectDmg, 14.4, '火球傳遞直擊傷快照 14.4');
    assert.equal(shot.dragonSplashDmg, 4.8, '火球傳遞濺射傷快照 4.8');
    assert.equal(shot.dragonScorchDmg, 2.16, '火球傳遞焦土傷快照 2.16');
  }

  // 4. 火球飛行中，透過真 offerUp/applyChoice 選取修羅破軍升級 b.dmg 至 1.50
  probe.setXp(200);
  probe.offerUp();
  const choices1 = probe.getChoices();
  assert.ok(choices1.some(c => c.id === 'dmg' || c.choiceId === 'passive:dmg'), '選卡候選包含修羅破軍');
  probe.setLevelupCooldown(0);
  const res1 = probe.applyChoice('passive:dmg', probe.getBuildRevision());
  assert.equal(res1.ok, true, '真選卡修羅破軍成功');
  assert.equal(Number(b.dmg.toFixed(2)), 1.50, '真選卡後 b.dmg 提升至 1.50');

  // 5. 正負對照組 1：groundTarget = true 落地 -> impact.target=null，僅濺射 [4.8, 4.8]
  const shot0 = shots[0];
  shot0.groundTarget = true;
  const gV1 = { x: 400, y: 300, hp: 500, max: 500, type: 'mob' };
  const gV2 = { x: 450, y: 300, hp: 500, max: 500, type: 'mob' };
  probe.setEnemies([gV1, gV2]);
  shot0.x = 400; shot0.y = 300; shot0.landX = 400; shot0.landY = 300; shot0.life = 0.001;
  probe.weapons(0.016);
  assert.equal(Number((500 - gV1.hp).toFixed(4)), 4.8, '落地目標 1 僅受濺射傷害 4.8，不被 1.5 升級回寫且無直擊');
  assert.equal(Number((500 - gV2.hp).toFixed(4)), 4.8, '落地目標 2 僅受濺射傷害 4.8，不被 1.5 升級回寫且無直擊');

  // 5b. 正負對照組 2：groundTarget = false 飛行接觸 -> 碰撞直擊 [14.4, 4.8]
  const shot1 = shots.find(s => s !== shot0 && s.life > 0);
  assert.ok(shot1, '存在第二枚火球供接觸碰撞驗證');
  shot1.groundTarget = false;
  const dV = { x: 605, y: 300, hp: 500, max: 500, type: 'mob' };
  const sV = { x: 650, y: 300, hp: 500, max: 500, type: 'mob' };
  probe.setEnemies([dV, sV]);
  shot1.x = 600; shot1.y = 300; shot1.vx = 510; shot1.vy = 0;
  probe.weapons(0.016);
  assert.equal(Number((500 - dV.hp).toFixed(4)), 14.4, '直擊目標承受直擊傷 14.4，維持生成快照，不被 1.5 升級回寫為 18.0');
  assert.equal(Number((500 - sV.hp).toFixed(4)), 4.8, '鄰近濺射目標承受濺射傷 4.8，維持生成快照，不被 1.5 升級回寫為 6.0');

  // 清除殘留火球避免干擾焦土判定
  probe.getDragonShots().length = 0;

  // 6. 驗證落地生成之焦土維持生成快照 2.16
  const scorches = probe.getDragonScorches();
  assert.ok(scorches.length >= 1, '火球落地生成焦土');
  const scorch = scorches[0];
  assert.equal(scorch.scorchDamage, 2.16, '焦土傷害維持生成快照 2.16');
  assert.equal(scorch.maxLife, 5, '焦土持續時間為 5s');
  assert.equal(scorch.r, 140, '焦土半徑為 140');

  // 7. 現役焦土在場燃燒期間，第二次真選卡升級 b.dmg 至 1.80
  probe.setXp(200);
  probe.offerUp();
  const choices2 = probe.getChoices();
  assert.ok(choices2.some(c => c.id === 'dmg' || c.choiceId === 'passive:dmg'), '選卡候選再次包含修羅破軍');
  probe.setLevelupCooldown(0);
  const res2 = probe.applyChoice('passive:dmg', probe.getBuildRevision());
  assert.equal(res2.ok, true, '第二層修羅破軍真選卡成功');
  assert.equal(Number(b.dmg.toFixed(2)), 1.80, '真選卡後 b.dmg 提升至 1.80');

  // 8. 現役焦土 tick 扣血：維持快照 2.16 結算，絕不被 1.80 回寫為 3.24
  const scorchVictim = { x: 400, y: 300, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([scorchVictim]);
  scorch.tick = 0;
  probe.weapons(0.016);
  assert.equal(Number((100 - scorchVictim.hp).toFixed(4)), 2.16, '現役焦土 tick 傷依快照 2.16 結算，絕不回寫為 3.24');

  // 9. 冷卻結束後新召喚的黑龍，完整享受新傷害快照 (b.dmg = 1.80)
  probe.getGhosts().length = 0;
  probe.getDragonShots().length = 0;
  probe.getDragonScorches().length = 0;
  probe.setWT('fire', 0);
  probe.setEnemies([{ x: 500, y: 300, hp: 5000, max: 5000, type: 'mob' }]);
  probe.weapons(0.016);
  const newDragon = probe.getGhosts().find(g => g.dragon && g.life > 0);
  assert.ok(newDragon, '7.2s 冷卻後召喚新黑龍');
  assert.equal(newDragon.dragonDirectDmg, 21.6, '新黑龍直擊傷快照為 21.6 (12 * 1.8)');
  assert.equal(newDragon.dragonSplashDmg, 7.2, '新黑龍濺射傷快照為 7.2 (4 * 1.8)');
  assert.equal(newDragon.dragonScorchDmg, 3.24, '新黑龍焦土傷快照為 3.24 (1.8 * 1.8)');

  for (let step = 0; step < 45; step++) {
    probe.weapons(0.016);
    if (probe.getDragonShots().length >= 3) break;
  }
  const newShots = probe.getDragonShots();
  assert.ok(newShots.length >= 3, '新黑龍噴出新火球');
  const newShot = newShots[0];
  newShot.groundTarget = false;
  const newD = { x: 605, y: 300, hp: 500, max: 500, type: 'mob' };
  const newS = { x: 650, y: 300, hp: 500, max: 500, type: 'mob' };
  probe.setEnemies([newD, newS]);
  newShot.x = 600; newShot.y = 300; newShot.vx = 510; newShot.vy = 0;
  probe.weapons(0.016);
  assert.equal(Number((500 - newD.hp).toFixed(4)), 21.6, '新火球直擊享受新快照 21.6');
  assert.equal(Number((500 - newS.hp).toFixed(4)), 7.2, '新火球濺射享受新快照 7.2');

  const newScorches = probe.getDragonScorches();
  assert.ok(newScorches.length >= 1, '新火球生成新焦土');
  const newScorch = newScorches[newScorches.length - 1];
  assert.equal(newScorch.scorchDamage, 3.24, '新焦土傷害快照為 3.24');
  const newScorchVictim = { x: newScorch.x, y: newScorch.y, hp: 100, max: 100, type: 'mob' };
  probe.setEnemies([newScorchVictim]);
  newScorch.tick = 0;
  probe.weapons(0.016);
  assert.equal(Number((100 - newScorchVictim.hp).toFixed(4)), 3.24, '新焦土 tick 傷依新快照 3.24 結算');
});

// ── 40. 狐火狀態機與生命週期清理：pause/levelup 凍結、死亡/重開清空無殘留 ────
test('M1-D-40 Fire state machine lifecycle: pause and levelup freeze, lost/won/start/restartCleanup clearance', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().fire = 5;
  probe.setBuildMutations(['mut_orbit']);
  probe.setWT('katana', 999);
  probe.setWT('fire', 4.5);
  probe.setFAng(1.2);

  // 手動塞入在場實體
  probe.setGhosts([{ dragon: true, life: 1.8, x: 200, y: 200, hitSet: new Set() }]);
  probe.setDragonShots([{ dragonFireball: true, life: 1.2, x: 250, y: 200, vx: 100, vy: 0 }]);
  probe.setDragonScorches([{ x: 300, y: 300, life: 4.0, maxLife: 5, r: 140, tick: 0.5, scorchDamage: 2.16 }]);

  // 1. pause 狀態凍結：fAng、wT.fire、ghosts、dragonShots、dragonScorches 均凍結
  probe.setState('pause');
  probe.update(0.30);
  assert.equal(probe.getFAng(), 1.2, 'pause 期間 fAng 凍結');
  assert.equal(probe.getWT().fire, 4.5, 'pause 期間 wT.fire 凍結');
  assert.equal(probe.getGhosts()[0].life, 1.8, 'pause 期間黑龍生命凍結');
  assert.equal(probe.getDragonShots()[0].life, 1.2, 'pause 期間火球生命凍結');
  assert.equal(probe.getDragonScorches()[0].life, 4.0, 'pause 期間焦土生命凍結');

  // 2. levelup 狀態凍結
  probe.setState('levelup');
  probe.update(0.30);
  assert.equal(probe.getFAng(), 1.2, 'levelup 期間 fAng 凍結');
  assert.equal(probe.getWT().fire, 4.5, 'levelup 期間 wT.fire 凍結');
  assert.equal(probe.getGhosts()[0].life, 1.8, 'levelup 期間黑龍生命凍結');
  assert.equal(probe.getDragonShots()[0].life, 1.2, 'levelup 期間火球生命凍結');
  assert.equal(probe.getDragonScorches()[0].life, 4.0, 'levelup 期間焦土生命凍結');

  // 3. loseRun 清理：清空 ghosts、dragonShots、dragonScorches
  probe.setState('play');
  probe.loseRun();
  assert.equal(probe.getState(), 'lampout');
  assert.equal(probe.getGhosts().length, 0, 'loseRun 清空 ghosts');
  assert.equal(probe.getDragonShots().length, 0, 'loseRun 清空 dragonShots');
  assert.equal(probe.getDragonScorches().length, 0, 'loseRun 清空 dragonScorches');

  // 4. startVictorySequence 清理
  probe.setState('play');
  probe.setGhosts([{ dragon: true, life: 1.8, x: 200, y: 200, hitSet: new Set() }]);
  probe.setDragonShots([{ dragonFireball: true, life: 1.2, x: 250, y: 200, vx: 100, vy: 0 }]);
  probe.setDragonScorches([{ x: 300, y: 300, life: 4.0, maxLife: 5, r: 140, tick: 0.5, scorchDamage: 2.16 }]);
  probe.startVictorySequence();
  assert.equal(probe.getState(), 'victory');
  assert.equal(probe.getGhosts().length, 0, 'startVictorySequence 清空 ghosts');
  assert.equal(probe.getDragonShots().length, 0, 'startVictorySequence 清空 dragonShots');
  assert.equal(probe.getDragonScorches().length, 0, 'startVictorySequence 清空 dragonScorches');

  // 5. start('night-town') 與 restartCleanup 清理
  probe.start('night-town');
  assert.equal(probe.getGhosts().length, 0, 'start 清空 ghosts');
  assert.equal(probe.getDragonShots().length, 0, 'start 清空 dragonShots');
  assert.equal(probe.getDragonScorches().length, 0, 'start 清空 dragonScorches');
  assert.equal(probe.getFAng(), 0, 'start 重置 fAng 為 0');
});

// ── 41. mut_splitblast 進池資格、未持 boom 排除、持有進池、每技能容量 3 獨立、Schema、真 offerUp/applyChoice 成功與 stale/invalid/double-click 拒絕 ────
test('M1-D-41 mut_splitblast pool eligibility, unowned boom exclusion, owned inclusion, per-skill capacity limit, schema, real offerUp/applyChoice, and negative protections', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. MUTATION_CONFIG 規格驗證
  const cfg = probe.MUTATION_CONFIG.mut_splitblast;
  assert.ok(cfg, 'MUTATION_CONFIG 必須包含 mut_splitblast');
  assert.equal(cfg.id, 'mut_splitblast');
  assert.equal(cfg.skillId, 'boom');
  assert.deepEqual(Array.from(cfg.skillIds), ['boom']);
  assert.equal(cfg.inPool, true);
  assert.equal(cfg.cat, '【 陰陽符變異 】');
  assert.equal(cfg.levelText, '◆ 陰陽符變異');
  assert.equal(cfg.n, '陰陽符・餘燼爆散');
  assert.equal(cfg.s, 'おふだ・ばくさん');
  assert.ok(typeof cfg.d === 'string' && cfg.d.length > 0);
  assert.equal(cfg.requirementText, '持有陰陽符');
  assert.equal(cfg.limitText, '每種限選一次（每技能最多 3 種變異）');

  // 2. 未持有 boom 時絕不可進池
  probe.getWL().boom = 0;
  const unownedChoices = probe.getEligibleChoices();
  assert.ok(unownedChoices.every(c => c.id !== 'mut_splitblast'), '未持有陰陽符時絕不可出 mut_splitblast');

  // 3. 持有 boom 時合法進池，且 schema 完整
  probe.getWL().boom = 1;
  let splitblastCard = null;
  for (let i = 0; i < 30 && !splitblastCard; i++) {
    const choices = probe.getEligibleChoices();
    splitblastCard = choices.find(c => c.id === 'mut_splitblast');
  }
  assert.ok(splitblastCard, '持有陰陽符時 mut_splitblast 必須能出現在候選池');
  assert.equal(splitblastCard.type, 'mutation');
  assert.equal(splitblastCard.choiceId, 'mutation:boom:mut_splitblast');
  assert.equal(splitblastCard.skillId, 'boom');
  assert.deepEqual(Array.from(splitblastCard.skillIds), ['boom']);
  assert.equal(splitblastCard.cat, '【 陰陽符變異 】');
  assert.equal(splitblastCard.levelText, '◆ 陰陽符變異');
  assert.equal(splitblastCard.rarity, 'mutation');
  assert.equal(splitblastCard.revision, probe.getBuildRevision());
  assert.equal(typeof splitblastCard.ok, 'function');
  assert.equal(typeof splitblastCard.f, 'function');

  // 4. 每技能容量獨立：needle 變異已滿 3 個，boom 仍能合法取得 mut_splitblast
  probe.setBuildMutations(['mut_seek', 'mut_frost', 'mut_pierce', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_orbit']);
  let foundWithFullNeedle = false;
  for (let i = 0; i < 30 && !foundWithFullNeedle; i++) {
    const choicesWithFullNeedle = probe.getEligibleChoices();
    if (choicesWithFullNeedle.some(c => c.id === 'mut_splitblast')) foundWithFullNeedle = true;
  }
  assert.ok(foundWithFullNeedle, 'needle 滿 3 變異不阻擋 boom 取得 mut_splitblast');

  // 5. 真 offerUp -> applyChoice 寫入 BuildState 與 mutations 清單，驗證 XP 扣除、revision 推進、連按防重扣
  probe.setBuildMutations(['mut_seek', 'mut_frost', 'mut_pierce', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_orbit']);
  probe.getWL().boom = 1;
  const xpBefore = 100;
  let splitCard = null;
  for (let attempt = 0; attempt < 20 && !splitCard; attempt++) {
    probe.setState('play');
    probe.setXp(100);
    probe.offerUp();
    probe.setLevelupCooldown(0);
    splitCard = probe.getChoices().find(c => c.id === 'mut_splitblast');
  }
  assert.equal(probe.getState(), 'levelup', '真 offerUp 應將 state 切至 levelup');
  assert.ok(splitCard, '真 offerUp 產生的選項池必須包含 mut_splitblast');
  const cardRev = probe.getBuildRevision();
  assert.equal(splitCard.revision, cardRev, '卡片 revision 必須匹配當前 buildRevision');

  const applyRes = probe.applyChoice(splitCard.choiceId, cardRev);
  assert.equal(applyRes.ok, true, '真 applyChoice 應成功套用 mut_splitblast');
  assert.ok(probe.getBuildMutations().includes('mut_splitblast'), 'buildMutations 應包含 mut_splitblast');
  assert.ok(probe.getBuildState().mutations.includes('mut_splitblast'), 'BuildState 應同步包含 mut_splitblast');
  assert.equal(probe.getState(), 'play', '套用後切回 play');
  assert.equal(probe.getBuildRevision(), cardRev + 1, 'buildRevision 必須推進');
  assert.ok(probe.getXp() < xpBefore, 'XP 必須依等級公式被扣除');

  // 連按防重扣 XP
  const doubleClickRes = probe.applyChoice(splitCard.choiceId, cardRev);
  assert.equal(doubleClickRes.ok, false, '連按舊 revision 應被拒絕');

  // 6. 重抽 reroll 推進 revision 使舊卡失效，未知 choiceId 拒絕
  probe.setState('play');
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const revPreReroll = probe.getBuildRevision();
  const oldCard = probe.getChoices()[0];
  probe.reroll();
  probe.setLevelupCooldown(0);
  const revPostReroll = probe.getBuildRevision();
  assert.ok(revPostReroll > revPreReroll, 'reroll 必須推進 revision');
  if (oldCard) {
    const staleRerollRes = probe.applyChoice(oldCard.choiceId, revPreReroll);
    assert.equal(staleRerollRes.ok, false, 'reroll 後點選舊卡應被拒絕');
  }
  const unknownRes = probe.applyChoice('mutation:boom:unknown_mutation', revPostReroll);
  assert.equal(unknownRes.ok, false, '未知 choiceId 應被拒絕');
});

// ── 42. resolveAttackSpec boom 數值快照與無變異基線保持 ────
test('M1-D-42 resolveAttackSpec boom snapshot numerical fidelity, baseline preservation Lv1-5, and mut_splitblast parameters', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const b = probe.getB();
  b.dmg = 1.0;
  b.reach = 1.0;

  const expectedCounts = [1, 2, 3, 4, 2];
  const expectedCds = [1.76, 1.52, 1.28, 1.04, 1.6];
  const expectedRadii = [78, 92, 108, 122, 135];
  const expectedDamages = [2.2, 2.9, 3.6, 4.3, 5.0];

  // 1. Lv1–5 無變異基線完整性驗證
  for (let lvl = 1; lvl <= 5; lvl++) {
    const spec = probe.resolveAttackSpec('boom', lvl, { mutations: [] });
    assert.equal(spec.skillId, 'boom');
    assert.equal(spec.level, lvl);
    assert.equal(spec.isAwakened, lvl === 5);
    assert.equal(spec.source, 'base');
    assert.equal(spec.derivationDepth, 0);
    assert.equal(spec.count, expectedCounts[lvl - 1]);
    assert.equal(spec.cooldown, expectedCds[lvl - 1]);
    assert.equal(spec.speed, 880);
    assert.equal(spec.life, 1.4);
    assert.equal(spec.fuse, 1.5);
    assert.equal(spec.spread, lvl >= 4 ? 0.28 : 0.32);
    assert.equal(spec.baseRadius, expectedRadii[lvl - 1]);
    assert.equal(spec.radius, expectedRadii[lvl - 1]);
    assert.equal(spec.damage, expectedDamages[lvl - 1]);
    assert.equal(spec.splashScale, 0.20);
    assert.equal(spec.splashDamage, Number((expectedDamages[lvl - 1] * 0.20).toFixed(4)));
    assert.equal(spec.knockback, 72);
    assert.equal(spec.hasSplitblast, false);
    assert.equal(spec.splitblastRadius, 0);
    assert.equal(spec.splitblastDirectDamage, 0);
    assert.equal(spec.splitblastSplashDamage, 0);
  }

  // 2. 有 mut_splitblast 時的快照輸出驗證
  for (let lvl = 1; lvl <= 5; lvl++) {
    const spec = probe.resolveAttackSpec('boom', lvl, { mutations: ['mut_splitblast'] });
    assert.equal(spec.skillId, 'boom');
    assert.equal(spec.level, lvl);
    assert.equal(spec.source, 'mutation');
    assert.equal(spec.hasSplitblast, true);
    assert.equal(spec.splitblastDelay, 0.18);
    assert.equal(spec.splitblastRadiusScale, 0.55);
    assert.equal(spec.splitblastRadius, Math.round(expectedRadii[lvl - 1] * 0.55));
    assert.equal(spec.splitblastDirectScale, 0.25);
    assert.equal(spec.splitblastSplashScale, 0.25);
    assert.equal(spec.splitblastDirectDamage, Number((expectedDamages[lvl - 1] * 0.25).toFixed(4)));
    const splashDmg = Number((expectedDamages[lvl - 1] * 0.20).toFixed(4));
    assert.equal(spec.splitblastSplashDamage, Number((splashDmg * 0.25).toFixed(4)));

    // 基線數值保持不變
    assert.equal(spec.count, expectedCounts[lvl - 1]);
    assert.equal(spec.cooldown, expectedCds[lvl - 1]);
    assert.equal(spec.radius, expectedRadii[lvl - 1]);
    assert.equal(spec.damage, expectedDamages[lvl - 1]);
    assert.equal(spec.knockback, 72);
  }

  // 3. 玩家 b.dmg 與 charm_reach (1.10x) 影響驗證
  b.dmg = 1.2;
  const modSpec = probe.resolveAttackSpec('boom', 1, { mutations: ['mut_splitblast'], charms: ['charm_reach'] });
  assert.equal(modSpec.radius, Math.round(78 * 1.10)); // 86
  assert.equal(modSpec.damage, Number((2.2 * 1.2).toFixed(4))); // 2.64
  assert.equal(modSpec.splashDamage, Number((2.64 * 0.20).toFixed(4))); // 0.528
  assert.equal(modSpec.splitblastRadius, Math.round(86 * 0.55)); // 47
  assert.equal(modSpec.splitblastDirectDamage, Number((2.64 * 0.25).toFixed(4))); // 0.66
  assert.equal(modSpec.splitblastSplashDamage, Number((0.528 * 0.25).toFixed(4))); // 0.132
});

// ── 43. 經真 weapons 發射→自然黏附→fuse 爆炸→次爆時序（.05 步長與 .02 步長上界驗不提前、僅一次、半徑邊界反例） ────
test('M1-D-43 Real weapons producer -> natural flight -> stick -> fuse explode -> secondary timing (0.18s), dt upper bound, single trigger, and radius boundary', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 設置玩家與三隻幽靈目標
  // Player at (100, 200)
  // targetA at (200, 200) -> 距離 100，直擊目標
  // targetB at (230, 200) -> 距離 130，主爆爆心在 (200, 200)，B 距離爆心 30 <= 次爆半徑 43
  // targetC at (260, 200) -> 距離 160，主爆爆心在 (200, 200)，C 距離爆心 60 > 次爆半徑 43 但 <= 主爆半徑 78
  probe.getP().x = 100;
  probe.getP().y = 200;
  const targetA = { x: 200, y: 200, hp: 50, max: 50, type: 'ghost' };
  const targetB = { x: 230, y: 200, hp: 50, max: 50, type: 'ghost' };
  const targetC = { x: 260, y: 200, hp: 50, max: 50, type: 'ghost' };
  probe.setEnemies([targetA, targetB, targetC]);

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.getB().dmg = 1.2; // damage = 2.64, splashDamage = 0.528, radius = 78, secondaryRadius = Math.round(78 * 0.55) = 43
  probe.setBuildMutations(['mut_splitblast']);

  // 1. 真 weapons(0.001) 發射
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  assert.equal(probe.getProj().length, 1, '真 weapons 必須自然發射 1 枚陰陽符');
  probe.setWT('boom', 999); // 鎖定後續冷卻，防止本時序測試期間發射第二枚

  // 2. 模擬 .05 步長自然飛行與黏附，直到主爆發生
  let mainExploded = false;
  let totalSteps = 0;
  while (!mainExploded && totalSteps < 100) {
    probe.weapons(0.05);
    totalSteps++;
    if (probe.getSplitblasts().length > 0) mainExploded = true;
  }
  assert.ok(mainExploded, '陰陽符必須經自然飛行與黏附倒數後自然觸發主爆');

  // 主爆當幀驗算：
  const hpMainA = targetA.hp;
  const hpMainB = targetB.hp;
  const hpMainC = targetC.hp;
  assert.equal(Number((50 - hpMainA).toFixed(4)), 2.64, '主爆對直擊目標造成 2.64 全傷');
  assert.equal(Number((50 - hpMainB).toFixed(4)), 0.528, '主爆對濺射目標 B 造成 0.528 濺射傷');
  assert.equal(Number((50 - hpMainC).toFixed(4)), 0.528, '主爆對濺射目標 C 造成 0.528 濺射傷');

  // 主爆當幀立即驗證：出生在當幀，延遲完整保留 0.18s，絕不可扣除出生前時間
  const sbs = probe.getSplitblasts();
  assert.equal(sbs.length, 1, '隊列長度為 1');
  assert.equal(Number(sbs[0].delay.toFixed(2)), 0.18, '主爆當幀出生不被扣時間，延遲完整保留 0.18s');

  // 3. 逐步 .05 驗證時序：
  // Step 1: sinceMain = 0.05s
  probe.weapons(0.05);
  assert.equal(probe.getSplitblasts().length, 1, '0.05s 隊列未觸發');
  assert.equal(Number(sbs[0].delay.toFixed(2)), 0.13, '0.05s 剩餘延遲 0.13s');
  assert.equal(targetA.hp, hpMainA, '0.05s 無額外傷');

  // Step 2: sinceMain = 0.10s
  probe.weapons(0.05);
  assert.equal(probe.getSplitblasts().length, 1, '0.10s 隊列未觸發');
  assert.equal(Number(sbs[0].delay.toFixed(2)), 0.08, '0.10s 剩餘延遲 0.08s');
  assert.equal(targetA.hp, hpMainA, '0.10s 無額外傷');

  // Step 3: sinceMain = 0.15s (< 0.18s) - 核心 counterexample 驗證
  probe.weapons(0.05);
  assert.equal(probe.getSplitblasts().length, 1, '0.15s (< 0.18s) 仍未觸發，隊列長度保持 1');
  assert.equal(Number(sbs[0].delay.toFixed(2)), 0.03, '0.15s 剩餘延遲 0.03s');
  assert.equal(targetA.hp, hpMainA, '0.15s 絕不可有額外傷害（防提前觸發 GREEN）');

  // Step 4: sinceMain = 0.20s (>= 0.18s) - 達 0.18 後下一步才觸發
  probe.weapons(0.05);
  assert.equal(probe.getSplitblasts().length, 0, '0.20s (>= 0.18s) 次爆觸發並清出隊列');

  // 傷害對帳與半徑邊界反例：
  assert.equal(Number((hpMainA - targetA.hp).toFixed(4)), 0.66, '次爆對原直擊目標造成 0.66 (25%全傷)');
  assert.equal(Number((hpMainB - targetB.hp).toFixed(4)), 0.132, '次爆對次爆半徑內濺射目標造成 0.132 (25%濺射傷)');
  assert.equal(Number((hpMainC - targetC.hp).toFixed(4)), 0, '次爆半徑外的目標 C 絕無額外傷害（反例防呆 GREEN）');

  // Step 5: sinceMain = 0.25s - 驗證僅觸發一次，無後續幽靈傷害
  probe.weapons(0.05);
  assert.equal(probe.getSplitblasts().length, 0);
  assert.equal(targetA.hp, hpMainA - 0.66, '後續步長無重複傷害（僅一次）');

  // 4. 不同步長（dt = 0.02s）上界驗證：嚴格 >= 0.18s 才觸發
  targetA.hp = 50;
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);

  let mainExplodedDt2 = false;
  let stepsDt2 = 0;
  while (!mainExplodedDt2 && stepsDt2 < 200) {
    probe.weapons(0.02);
    stepsDt2++;
    if (probe.getSplitblasts().length > 0) mainExplodedDt2 = true;
  }
  assert.ok(mainExplodedDt2, 'dt=0.02 下陰陽符自然主爆');

  const hpMainA2 = targetA.hp;
  // 逐步跑 8 步 (8 * 0.02 = 0.16s < 0.18s)
  for (let s = 1; s <= 8; s++) {
    probe.weapons(0.02);
    assert.equal(probe.getSplitblasts().length, 1, `dt=0.02 第 ${s} 步 (${(s * 0.02).toFixed(2)}s) 隊列未觸發`);
    assert.equal(targetA.hp, hpMainA2, `dt=0.02 第 ${s} 步 (${(s * 0.02).toFixed(2)}s) 絕無額外傷害`);
  }
  // 第 9 步 (9 * 0.02 = 0.18s >= 0.18s) 觸發
  probe.weapons(0.02);
  assert.equal(probe.getSplitblasts().length, 0, '0.18s 準時觸發並清出隊列');
  assert.equal(Number((hpMainA2 - targetA.hp).toFixed(4)), 0.66, '0.18s 觸發完整次爆傷害');
});

// ── 44. 護盾免疫、死敵免疫、Boss 免擊退只受純傷害、同次爆同敵去重 ────
test('M1-D-44 splitblast protections: shielded enemy immune, dead enemy immune, Boss takes flat damage without knockback, and hit deduplication', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setWT('boom', 999);
  const b = probe.getB();
  b.dmg = 1.0; // directDamage = 2.2 * 0.25 = 0.55, splashDamage = 0.44 * 0.25 = 0.11

  // 建立敵人：
  // shieldedEnemy: 結界護盾敵人（hp 10, shield: true）
  // deadEnemy: 已死亡敵人（hp 0）
  // bossEnemy: Boss（hp 50, type: 'boss', x: 210, y: 200）
  const shieldedEnemy = { x: 205, y: 200, hp: 10, max: 10, shield: true, type: 'ghost' };
  const deadEnemy = { x: 202, y: 200, hp: 0, max: 10, type: 'ghost' };
  const bossEnemy = { x: 210, y: 200, hp: 50, max: 50, type: 'boss' };
  probe.setEnemies([shieldedEnemy, deadEnemy, bossEnemy]);

  // 排入一個次爆
  const sb = {
    x: 200, y: 200, delay: 0.05, radius: 50,
    directDamage: 0.55, splashDamage: 0.11,
    primaryTarget: bossEnemy, level: 1,
    hits: new Set(), triggered: false
  };
  probe.setSplitblasts([sb]);

  // 記錄 Boss 初速與位置
  const bossOrigX = bossEnemy.x;
  const bossOrigY = bossEnemy.y;

  // 執行 weapons(0.06)，觸發次爆
  probe.weapons(0.06);

  // 1. 護盾敵人不受傷
  assert.equal(shieldedEnemy.hp, 10, '結界護盾敵人免疫次爆傷害');

  // 2. 已死亡敵人生命不被改寫
  assert.equal(deadEnemy.hp, 0, '已死亡敵人免疫次爆');

  // 3. Boss 作為 primaryTarget 承受純 directDamage 0.55，無擊退（座標不被 knockback 推動）
  assert.equal(Number(bossEnemy.hp.toFixed(4)), 49.45, 'Boss 承受純 directDamage 0.55');
  assert.equal(bossEnemy.x, bossOrigX, '次爆絕不對 Boss 造成擊退位移');
  assert.equal(bossEnemy.y, bossOrigY, '次爆絕不對 Boss 造成擊退位移');

  // 4. 同次爆同敵去重：sb.hits 必須記錄 bossEnemy
  assert.ok(sb.hits.has(bossEnemy), '次爆命中目標應被記錄至 hits Set');
});

// ── 45. 次爆隊列上限 32（滿額略過次爆、主爆正常結算）、Lv5 覺醒 2 枚巨符各自獨立次爆 ────
test('M1-D-45 Queue hard cap 32 skips new splitblasts while preserving main explosion, and Lv5 awakened 2 talismans generate independent splitblasts', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setWT('boom', 999);
  const b = probe.getB();
  b.dmg = 1.0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_splitblast']);

  // 1. 隊列上限 32 測試
  // 填滿 32 個 dummy splitblast
  const dummyQueue = [];
  for (let i = 0; i < 32; i++) {
    dummyQueue.push({ x: 0, y: 0, delay: 99, radius: 40, directDamage: 0.5, splashDamage: 0.1, primaryTarget: null, level: 1, hits: new Set(), triggered: false });
  }
  probe.setSplitblasts(dummyQueue);
  assert.equal(probe.getSplitblasts().length, 32);

  // 建立並引爆新符咒
  const target = { x: 100, y: 100, hp: 10, max: 10, type: 'ghost' };
  probe.setEnemies([target]);
  const talisman = {
    x: 100, y: 100, vx: 0, vy: 0, speed: 440, t: 0, life: 1.4, fuse: 0,
    initialFuse: 1.5, level: 1, stuck: true, target, exploded: false,
    radius: 78, damage: 2.2, splashDamage: 0.44, knockback: 72,
    hasSplitblast: true, splitblastDelay: 0.18, splitblastRadius: 43,
    splitblastDirectDamage: 0.55, splitblastSplashDamage: 0.11,
    mutations: ['mut_splitblast']
  };

  probe.explodeTalisman(talisman);

  // 主爆正常結算：target 承受 2.2 傷害
  assert.equal(Number(target.hp.toFixed(4)), 7.8, '滿額時主爆依然正常結算');
  // 隊列未被擴增超過 32
  assert.equal(probe.getSplitblasts().length, 32, '隊列達到 32 時略過新次爆，不溢出');

  // 2. Lv5 覺醒 2 枚巨符各自獨立次爆
  probe.setSplitblasts([]);
  probe.getWL().boom = 5;
  const specLv5 = probe.resolveAttackSpec('boom', 5, probe.getBuildState());
  assert.equal(specLv5.count, 2, 'Lv5 符咒數量為 2');

  const enemy1 = { x: 200, y: 200, hp: 20, max: 20, type: 'ghost' };
  const enemy2 = { x: 300, y: 200, hp: 20, max: 20, type: 'ghost' };
  probe.setEnemies([enemy1, enemy2]);

  const tal1 = {
    x: 200, y: 200, level: 5, target: enemy1, exploded: false,
    radius: specLv5.radius, damage: specLv5.damage, splashDamage: specLv5.splashDamage,
    hasSplitblast: true, splitblastDelay: 0.18, splitblastRadius: specLv5.splitblastRadius,
    splitblastDirectDamage: specLv5.splitblastDirectDamage,
    splitblastSplashDamage: specLv5.splitblastSplashDamage,
    mutations: ['mut_splitblast']
  };
  const tal2 = {
    x: 300, y: 200, level: 5, target: enemy2, exploded: false,
    radius: specLv5.radius, damage: specLv5.damage, splashDamage: specLv5.splashDamage,
    hasSplitblast: true, splitblastDelay: 0.18, splitblastRadius: specLv5.splitblastRadius,
    splitblastDirectDamage: specLv5.splitblastDirectDamage,
    splitblastSplashDamage: specLv5.splitblastSplashDamage,
    mutations: ['mut_splitblast']
  };

  probe.explodeTalisman(tal1);
  probe.explodeTalisman(tal2);

  const sbsLv5 = probe.getSplitblasts();
  assert.equal(sbsLv5.length, 2, '2 枚巨符各自產生獨立次爆');
  assert.equal(sbsLv5[0].x, 200, '巨符 1 次爆座標正確');
  assert.equal(sbsLv5[1].x, 300, '巨符 2 次爆座標正確');
  assert.equal(sbsLv5[0].radius, specLv5.splitblastRadius, '巨符次爆半徑正確 (135 * 0.55 = 74)');
});

// ── 46. 真 weapons 發射與真 offerUp/applyChoice 升級隔離（飛行中、黏附中、待發次爆中升級各驗不回寫、舊符不獲新變異、新符正確生效、pause/levelup 凍結與清理） ────
test('M1-D-46 Real weapons producer and real offerUp/applyChoice upgrade isolation during flight, sticking, and queued splitblast, pause/levelup freeze, and lifecycle clearance', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations([]); // 初始未持有 mut_splitblast
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']); // 飽和御守池，使真 offerUp 專注於變異與攻擊升級
  Object.assign(probe.getB(), {
    shield: 6,
    oilRegen: 0.12,
    heals: 3,
    rate: 4,
    crit: 3,
    spd: 3,
    dash: 3,
    mag: 3,
    dmgUp: 0
  });
  const enemy = { x: 200, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemy]);
  probe.getP().x = 100;
  probe.getP().y = 200;

  // ── 階段 1：飛行中升級隔離 ──
  // 真 weapons(0.001) 發射初始符咒（無 mut_splitblast，初始 b.dmg=1.2 傷為 2.64）
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  assert.equal(probe.getProj().length, 1, '真 weapons 自然產生第 1 枚符咒');
  const oldTalisman = probe.getProj()[0];
  assert.equal(oldTalisman.hasSplitblast, false, '發射時無 mut_splitblast');
  assert.equal(oldTalisman.damage, 2.64, '發射時初始傷害為 2.64 (2.2 * 1.2)');

  // 飛行途中推進 0.05s
  probe.weapons(0.05);
  assert.equal(oldTalisman.stuck, false, '符咒處於飛行途中');

  // 飛行途中：觸發真 offerUp -> applyChoice 取得 mut_splitblast
  probe.setBuildMutations(['mut_seek', 'mut_frost', 'mut_pierce', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_orbit']);
  let splitCardFlight = null;
  for (let attempt = 0; attempt < 20 && !splitCardFlight; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    splitCardFlight = probe.getChoices().find(c => c.id === 'mut_splitblast');
  }
  assert.ok(splitCardFlight, '真 offerUp 抽出 mut_splitblast');
  const applyResFlight = probe.applyChoice(splitCardFlight.choiceId, probe.getBuildRevision());
  assert.equal(applyResFlight.ok, true, '真 applyChoice 成功取得 mut_splitblast');

  // 驗證飛行中舊符不回寫：
  assert.equal(oldTalisman.hasSplitblast, false, '飛行途中取得變異，舊符絕不被回寫 hasSplitblast');
  assert.equal(oldTalisman.damage, 2.64, '飛行途中取得變異，舊符傷害不被改寫');

  // 讓舊符自然擊中、黏附並引爆
  let oldExploded = false;
  let stepsFlight = 0;
  while (!oldExploded && stepsFlight < 50) {
    probe.weapons(0.05);
    stepsFlight++;
    if (oldTalisman.exploded) oldExploded = true;
  }
  assert.ok(oldExploded, '舊符自然引爆');
  assert.equal(probe.getSplitblasts().length, 0, '未持有變異時發射的舊符引爆絕不長出次爆');
  assert.equal(Number((100 - enemy.hp).toFixed(4)), 2.64, '舊符造成 2.64 原始快照傷');

  // ── 階段 2：黏附中升級隔離 ──
  // 現在持有 mut_splitblast，發射第 2 枚符咒
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  assert.equal(probe.getProj().length, 1, '真 weapons 自然產生第 2 枚符咒');
  const stuckTalisman = probe.getProj()[0];
  assert.equal(stuckTalisman.hasSplitblast, true, '第 2 枚符咒具備 mut_splitblast');
  assert.equal(stuckTalisman.damage, 2.64, '第 2 枚符咒初始傷害 2.64');
  assert.equal(stuckTalisman.splitblastDirectDamage, 0.66, '次爆直擊傷害快照 0.66');

  // 步進至黏附狀態
  let isStuck = false;
  let stepsStuck = 0;
  while (!isStuck && stepsStuck < 20) {
    probe.weapons(0.05);
    stepsStuck++;
    if (stuckTalisman.stuck) isStuck = true;
  }
  assert.ok(isStuck, '第 2 枚符咒成功黏附在目標上');
  assert.ok(stuckTalisman.fuse > 0, '黏附保險絲倒數中');

  // 黏附中：觸發真 offerUp -> applyChoice 取得修羅破軍 (passive:dmg) 傷害提升
  let dmgCardStuck = null;
  for (let attempt = 0; attempt < 25 && !dmgCardStuck; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    dmgCardStuck = probe.getChoices().find(c => c.id === 'dmg');
  }
  assert.ok(dmgCardStuck, '真 offerUp 抽出修羅破軍');
  const bDmgBefore = probe.getB().dmg;
  const applyResDmg = probe.applyChoice(dmgCardStuck.choiceId, probe.getBuildRevision());
  assert.equal(applyResDmg.ok, true, '真 applyChoice 成功升級攻擊力');
  assert.equal(Number(probe.getB().dmg.toFixed(2)), Number((bDmgBefore + 0.30).toFixed(2)), 'b.dmg 成功提升');

  // 驗證黏附中舊符快照不回寫：
  assert.equal(stuckTalisman.damage, 2.64, '黏附中提升傷害，符咒傷害快照 2.64 不被回寫');
  assert.equal(stuckTalisman.splitblastDirectDamage, 0.66, '黏附中提升傷害，次爆直擊傷害 0.66 不被回寫');

  // 步進至第 2 枚符咒保險絲到期引爆
  let stuckExploded = false;
  let stepsFuse = 0;
  while (!stuckExploded && stepsFuse < 40) {
    probe.weapons(0.05);
    stepsFuse++;
    if (probe.getSplitblasts().length > 0) stuckExploded = true;
  }
  assert.ok(stuckExploded, '第 2 枚符咒引爆');
  assert.equal(Number((100 - 2.64 - enemy.hp).toFixed(4)), 2.64, '主爆造成原始快照 2.64 傷，不受升級干擾');

  // ── 階段 3：待發次爆佇列中升級隔離 ──
  const queuedSb = probe.getSplitblasts()[0];
  assert.ok(queuedSb, '次爆已在待發隊列中');
  assert.equal(queuedSb.directDamage, 0.66, '隊列中次爆傷害為 0.66');

  // 次爆倒數中再次升級攻擊力
  let dmgCardQueue = null;
  for (let attempt = 0; attempt < 25 && !dmgCardQueue; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    dmgCardQueue = probe.getChoices().find(c => c.id === 'dmg');
  }
  assert.ok(dmgCardQueue, '佇列倒數中真 offerUp 抽出修羅破軍');
  const applyResQueue = probe.applyChoice(dmgCardQueue.choiceId, probe.getBuildRevision());
  assert.equal(applyResQueue.ok, true, '真 applyChoice 成功在次爆佇列中升級攻擊力');

  assert.equal(queuedSb.directDamage, 0.66, '待發次爆在隊列中時升級，其傷害快照絕不被回寫');

  // 步進至次爆觸發
  let sbTriggered = false;
  let stepsQueue = 0;
  const hpBeforeSb = enemy.hp;
  while (!sbTriggered && stepsQueue < 10) {
    probe.weapons(0.05);
    stepsQueue++;
    if (probe.getSplitblasts().length === 0) sbTriggered = true;
  }
  assert.ok(sbTriggered, '待發次爆觸發');
  assert.equal(Number((hpBeforeSb - enemy.hp).toFixed(4)), 0.66, '次爆忠實造成原始快照 0.66 傷');

  // ── 階段 4：升級後發射全新第 3 枚符咒，驗證新符正常生效升級數值 ──
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const newTalisman = probe.getProj()[0];
  assert.ok(newTalisman, '真 weapons 發射第 3 枚新符咒');
  assert.equal(newTalisman.damage, 3.96, '全新符咒正確生效兩次升級後攻擊力 3.96 (2.2 * 1.8)');
  assert.equal(newTalisman.splitblastDirectDamage, 0.99, '全新符咒次爆直擊傷害正確生效兩次升級後攻擊力 0.99 (3.96 * 0.25)');

  // ── 階段 5：pause/levelup 凍結與狀態機生命週期清理 ──
  probe.setSplitblasts([{ x: 200, y: 200, delay: 0.18 }]);
  const sbFreeze = probe.getSplitblasts()[0];

  probe.setState('pause');
  probe.update(0.30);
  assert.equal(sbFreeze.delay, 0.18, 'pause 狀態下次爆倒數凍結');

  probe.setState('levelup');
  probe.update(0.30);
  assert.equal(sbFreeze.delay, 0.18, 'levelup 狀態下次爆倒數凍結');

  probe.setState('play');
  probe.loseRun();
  assert.equal(probe.getSplitblasts().length, 0, 'loseRun 清空 splitblasts');

  probe.setState('play');
  probe.setSplitblasts([{ x: 0, y: 0, delay: 0.18 }]);
  probe.startVictorySequence();
  assert.equal(probe.getSplitblasts().length, 0, 'startVictorySequence 清空 splitblasts');

  probe.setSplitblasts([{ x: 0, y: 0, delay: 0.18 }]);
  probe.start('night-town');
  assert.equal(probe.getSplitblasts().length, 0, 'start 清空 splitblasts');
});

// ── 47. mut_fan 共享池資格與動態卡片呈現（boom-only / needle-only / both / none）與容量阻擋 ────
test('M1-D-47 mut_fan shared pool eligibility, dynamic card presentation (boom-only / needle-only / both / none), deduplication, and capacity blocking', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. None owned: neither needle nor boom owned
  probe.getWL().katana = 1;
  probe.getWL().needle = 0;
  probe.getWL().boom = 0;
  probe.setBuildMutations([]);
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_fan'), '未持有 needle 亦未持有 boom 時絕不可出 mut_fan');
  }

  // 2. Needle-only: 持有靈針、未持有陰陽符
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  let fanNeedleCard = null;
  for (let i = 0; i < 30 && !fanNeedleCard; i++) {
    const choices = probe.getEligibleChoices();
    fanNeedleCard = choices.find(c => c.id === 'mut_fan');
  }
  assert.ok(fanNeedleCard, '僅持有靈針時 mut_fan 必須出現在候選池');
  assert.equal(fanNeedleCard.choiceId, 'mutation:needle:mut_fan', '保留 canonical opaque choiceId');
  assert.equal(fanNeedleCard.skillId, 'needle');
  assert.deepEqual(Array.from(fanNeedleCard.skillIds), ['needle'], 'skillIds 僅包含當前已持有的受影響技能');
  assert.equal(fanNeedleCard.n, '靈針・千本散射', '僅持有靈針時名稱為 靈針・千本散射');
  assert.equal(fanNeedleCard.cat, '【 靈針變異 】');
  assert.equal(fanNeedleCard.levelText, '◆ 靈針變異');
  assert.equal(fanNeedleCard.requirementText, '持有天狐靈針（取得陰陽符後亦適用）');
  assert.ok(fanNeedleCard.limitText.includes('取得其他適用技能後沿用'));
  assert.ok(fanNeedleCard.d.includes('每次施放'), '使用每次施放非 cast');

  // 3. Boom-only: 未持有靈針、持有陰陽符
  probe.getWL().needle = 0;
  probe.getWL().boom = 1;
  let fanBoomCard = null;
  for (let i = 0; i < 30 && !fanBoomCard; i++) {
    const choices = probe.getEligibleChoices();
    fanBoomCard = choices.find(c => c.id === 'mut_fan');
  }
  assert.ok(fanBoomCard, '僅持有陰陽符時 mut_fan 必須出現在候選池');
  assert.equal(fanBoomCard.choiceId, 'mutation:needle:mut_fan', 'boom-only 仍保留 canonical opaque choiceId');
  assert.equal(fanBoomCard.skillId, 'boom');
  assert.deepEqual(Array.from(fanBoomCard.skillIds), ['boom'], 'skillIds 僅包含 boom');
  assert.equal(fanBoomCard.n, '陰陽符・千本散射', '僅持有陰陽符時名稱為 陰陽符・千本散射，不可仍畫靈針');
  assert.equal(fanBoomCard.cat, '【 陰陽符變異 】');
  assert.equal(fanBoomCard.levelText, '◆ 陰陽符變異');
  assert.equal(fanBoomCard.requirementText, '持有陰陽符（取得天狐靈針後亦適用）');
  assert.ok(fanBoomCard.limitText.includes('取得其他適用技能後沿用'));
  assert.ok(fanBoomCard.d.includes('每次施放') && !fanBoomCard.d.includes('cast'), '使用每次施放非 cast');

  // 4. Both owned: 同時持有靈針與陰陽符
  probe.getWL().needle = 1;
  probe.getWL().boom = 1;
  let fanBothCard = null;
  for (let i = 0; i < 30 && !fanBothCard; i++) {
    const choices = probe.getEligibleChoices();
    fanBothCard = choices.find(c => c.id === 'mut_fan');
  }
  assert.ok(fanBothCard, '同時持有兩技能時 mut_fan 必須出現在候選池');
  assert.equal(fanBothCard.choiceId, 'mutation:needle:mut_fan');
  assert.deepEqual(Array.from(fanBothCard.skillIds), ['needle', 'boom'], 'skillIds 包含兩技能');
  assert.equal(fanBothCard.n, '千本散射', '同時持有時名稱為 千本散射');
  assert.equal(fanBothCard.cat, '【 共享變異 】');
  assert.equal(fanBothCard.levelText, '◆ 共享變異');
  assert.equal(fanBothCard.requirementText, '持有天狐靈針或陰陽符（同時生效，後續取得亦適用）');
  assert.ok(fanBothCard.limitText.includes('取得其他適用技能後沿用'));

  // 5. 已有 mut_fan 全局去重：不再重複出卡
  probe.setBuildMutations(['mut_fan']);
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_fan'), '已持有 mut_fan 時絕不重複出卡');
  }
  probe.setBuildMutations([]);

  // 6. 容量阻擋：若兩技能皆持有，其中一方滿 3 槽（例如 needle 滿 3 變異），則 mut_fan 必須被阻擋
  probe.getWL().needle = 1;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_seek', 'mut_frost', 'mut_pierce']); // needle 3/3 滿槽
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_fan'), 'needle 滿 3 變異時，共享卡 mut_fan 必須被阻擋進池，不得讓 needle 超額');
  }
  assert.equal(probe.addMutation('mut_fan'), false, 'addMutation 亦必須阻擋滿槽技能超額');
});

// ── 48. 真 offerUp -> applyChoice 取得 mut_fan（boom-only、both、XP 扣除、revision 推進、連按防重扣、reroll）與雙向繼承 ────
test('M1-D-48 Real offerUp -> applyChoice for mut_fan (boom-only and both), revision/XP, stale click guard, reroll invalidation, and bidirectional inheritance', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 設置被動飽和以保證抽卡確定性
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), {
    shield: 6,
    oilRegen: 0.12,
    heals: 3,
    rate: 4,
    crit: 3,
    spd: 3,
    dash: 3,
    mag: 3,
    dmgUp: 4
  });

  // 1. Boom-only 真 offerUp -> applyChoice 取得 mut_fan
  probe.getWL().katana = 1;
  probe.getWL().barrier = 0;
  probe.getWL().fire = 0;
  probe.getWL().needle = 0; // 未持有 needle
  probe.getWL().boom = 1;   // 僅持有 boom (owned = [katana, boom] = 2 < 4)
  probe.setBuildMutations([]);

  let fanCard = null;
  for (let attempt = 0; attempt < 25 && !fanCard; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    fanCard = probe.getChoices().find(c => c.id === 'mut_fan');
  }
  assert.ok(fanCard, 'boom-only 經真 offerUp 抽出 mut_fan');
  assert.equal(fanCard.choiceId, 'mutation:needle:mut_fan', 'opaque choiceId 正確');
  assert.deepEqual(Array.from(fanCard.skillIds), ['boom']);

  const cardRev = probe.getBuildRevision();
  const xpBefore = probe.getXp();
  const applyRes = probe.applyChoice(fanCard.choiceId, cardRev);
  assert.equal(applyRes.ok, true, 'boom-only 透過 canonical choiceId 成功套用 mut_fan');
  assert.deepEqual(Array.from(probe.getBuildMutations()), ['mut_fan'], 'BuildState 維持 flat 單一全局 ID，無逐技能副本');
  assert.equal(probe.getBuildRevision(), cardRev + 1, 'buildRevision 推進');
  assert.ok(probe.getXp() < xpBefore, 'XP 正確扣除');

  // 連按防重扣
  const staleRes = probe.applyChoice(fanCard.choiceId, cardRev);
  assert.equal(staleRes.ok, false, '連按舊 revision 遭拒絕');

  // 2. Reroll 推進 revision 使舊卡失效
  probe.setState('play');
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const revBeforeReroll = probe.getBuildRevision();
  const oldChoice = probe.getChoices()[0];
  probe.reroll();
  probe.setLevelupCooldown(0);
  assert.ok(probe.getBuildRevision() > revBeforeReroll, 'reroll 推進 revision');
  if (oldChoice) {
    assert.equal(probe.applyChoice(oldChoice.choiceId, revBeforeReroll).ok, false, 'reroll 後舊卡失效');
  }

  // 3. 跨技能雙向繼承驗證 (Bidirectional Inheritance)
  // Case A: 先持有 boom 取 mut_fan，後經真 offerUp -> applyChoice 取得靈針武器卡 -> 實際發射 6 針
  assert.ok(probe.getBuildMutations().includes('mut_fan'));
  assert.equal(probe.getWL().needle, 0);

  let needleCard = null;
  for (let attempt = 0; attempt < 25 && !needleCard; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    needleCard = probe.getChoices().find(c => c.choiceId === 'weapon:needle:1');
  }
  assert.ok(needleCard, '真 offerUp 抽出新武器天狐靈針');
  const applyNeedle = probe.applyChoice(needleCard.choiceId, probe.getBuildRevision());
  assert.equal(applyNeedle.ok, true, '真 applyChoice 習得天狐靈針');
  assert.equal(probe.getWL().needle, 1, '靈針等級變為 1');
  const activeSkillsA = Object.keys(probe.getWI()).filter(k => (probe.getWL()[k] || 0) > 0);
  assert.ok(activeSkillsA.length <= 4, '非五主動非法 fixture');
  assert.ok(activeSkillsA.includes('needle') && activeSkillsA.includes('boom'));

  // 實際發射 6 針驗證真繼承
  probe.getNeedles().length = 0;
  probe.setWT('needle', 0);
  probe.weapons(0.001);
  assert.equal(probe.getNeedles().length, 6, '真學靈針後真 weapons 實際發射 6 針 (3 base + 3 fan)');
  assert.equal(probe.getBuildMutations().filter(m => m === 'mut_fan').length, 1, 'flat buildMutations 絕不重複新增同一 ID');

  // Case B: 反向繼承驗證（重置環境：先持 needle 取 mut_fan，後經真 offerUp -> applyChoice 取得陰陽符武器卡 -> 實際發射 3 符）
  probe.start('night-town');
  probe.getWL().katana = 1;
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  probe.getWL().barrier = 0;
  probe.getWL().fire = 0;
  probe.getWL().thunder = 0;
  probe.setBuildMutations([]);
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });

  let fanCardB = null;
  for (let attempt = 0; attempt < 25 && !fanCardB; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    fanCardB = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_fan');
  }
  assert.ok(fanCardB, '真 offerUp 抽出 mut_fan');
  const applyFanB = probe.applyChoice(fanCardB.choiceId, probe.getBuildRevision());
  assert.equal(applyFanB.ok, true, '套用 mut_fan');

  let boomCardB = null;
  for (let attempt = 0; attempt < 25 && !boomCardB; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    boomCardB = probe.getChoices().find(c => c.choiceId === 'weapon:boom:1');
  }
  assert.ok(boomCardB, '真 offerUp 抽出新武器陰陽符');
  const applyBoomB = probe.applyChoice(boomCardB.choiceId, probe.getBuildRevision());
  assert.equal(applyBoomB.ok, true, '真 applyChoice 習得陰陽符');
  assert.equal(probe.getWL().boom, 1, '陰陽符等級變為 1');

  const activeSkillsB = Object.keys(probe.getWI()).filter(k => (probe.getWL()[k] || 0) > 0);
  assert.ok(activeSkillsB.length <= 4, '非五主動非法 fixture');
  assert.equal(probe.getBuildMutations().filter(m => m === 'mut_fan').length, 1, '絕不重複新增');

  // 實際發射 3 符驗證真繼承
  probe.getP().x = 100;
  probe.getP().y = 200;
  const ghostB = { x: 200, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([ghostB]);
  probe.getProj().length = 0;
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  assert.equal(probe.getProj().length, 3, '真學陰陽符後真 weapons 實際發射 3 符 (1 base + 2 fan)');
});

// ── 49. resolveAttackSpec boom Lv1–5 原型數值快照與每 cast 直擊/濺射傷害預算對帳 ────
test('M1-D-49 resolveAttackSpec boom Lv1-5 fan prototype numerical fidelity, baseline preservation, and per-cast direct/splash damage budget reconciliation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const expectedBaseCounts = [1, 2, 3, 4, 2];
  const expectedFanCounts  = [3, 4, 5, 6, 4]; // +2, cap 6
  const expectedCds        = [1.76, 1.52, 1.28, 1.04, 1.6];
  const expectedRadii      = [78, 92, 108, 122, 135];
  const expectedSpreads    = [0.32, 0.32, 0.32, 0.28, 0.28];

  for (let lvl = 1; lvl <= 5; lvl++) {
    const baseSpec = probe.resolveAttackSpec('boom', lvl, { mutations: [] });
    const fanSpec  = probe.resolveAttackSpec('boom', lvl, { mutations: ['mut_fan'] });

    // 1. 基線特性保持
    assert.equal(fanSpec.skillId, 'boom');
    assert.equal(fanSpec.level, lvl);
    assert.equal(fanSpec.isAwakened, lvl === 5);
    assert.equal(fanSpec.source, 'mutation');
    assert.equal(fanSpec.baseCount, expectedBaseCounts[lvl - 1]);
    assert.equal(fanSpec.count, expectedFanCounts[lvl - 1]);
    assert.equal(fanSpec.cooldown, expectedCds[lvl - 1]);
    assert.equal(fanSpec.speed, 880);
    assert.equal(fanSpec.life, 1.4);
    assert.equal(fanSpec.fuse, 1.5);
    assert.equal(fanSpec.spread, expectedSpreads[lvl - 1], '沿用原相鄰角距 .32，Lv4 0.28');
    assert.equal(fanSpec.radius, expectedRadii[lvl - 1]);
    assert.equal(fanSpec.knockback, 72);
    assert.equal(fanSpec.hasFan, true);

    // 2. 直擊總預算嚴格對帳：每 cast 總直擊傷害 <= baseCount * baseDamage（浮點誤差 <= 1e-9）
    const totalDirectDamage = fanSpec.count * fanSpec.damage;
    const allowedDirectDamage = baseSpec.count * baseSpec.damage;
    assert.ok(totalDirectDamage <= allowedDirectDamage + 1e-9, `Lv${lvl} 總直擊傷害預算超額: ${totalDirectDamage} > ${allowedDirectDamage}`);
    assert.ok(Math.abs(totalDirectDamage - allowedDirectDamage) <= 1e-9, `Lv${lvl} 總直擊傷害未精準分攤: diff=${Math.abs(totalDirectDamage - allowedDirectDamage)}`);

    // 3. 濺射總預算嚴格對帳：每 cast 總濺射傷害 <= baseCount * baseSplashDamage（浮點誤差 <= 1e-9）
    const totalSplashDamage = fanSpec.count * fanSpec.splashDamage;
    const allowedSplashDamage = baseSpec.count * baseSpec.splashDamage;
    assert.ok(totalSplashDamage <= allowedSplashDamage + 1e-9, `Lv${lvl} 總濺射傷害預算超額: ${totalSplashDamage} > ${allowedSplashDamage}`);
    assert.ok(Math.abs(totalSplashDamage - allowedSplashDamage) <= 1e-9, `Lv${lvl} 總濺射傷害未精準分攤: diff=${Math.abs(totalSplashDamage - allowedSplashDamage)}`);
  }

  // 4. 不同攻擊力乘數 (b.dmg = 1.0, 1.2, 1.5, 2.1) 下預算上限驗證
  for (const testDmg of [1.0, 1.2, 1.5, 2.1]) {
    probe.getB().dmg = testDmg;
    for (let lvl = 1; lvl <= 5; lvl++) {
      const bSpec = probe.resolveAttackSpec('boom', lvl, { mutations: [] });
      const fSpec = probe.resolveAttackSpec('boom', lvl, { mutations: ['mut_fan'] });
      const directSum = fSpec.count * fSpec.damage;
      const directCap = bSpec.count * bSpec.damage;
      assert.ok(directSum <= directCap + 1e-9, `b.dmg=${testDmg} Lv${lvl} 直擊超額`);
      assert.ok(Math.abs(directSum - directCap) <= 1e-9);

      const splashSum = fSpec.count * fSpec.splashDamage;
      const splashCap = bSpec.count * bSpec.splashDamage;
      assert.ok(splashSum <= splashCap + 1e-9, `b.dmg=${testDmg} Lv${lvl} 濺射超額`);
      assert.ok(Math.abs(splashSum - splashCap) <= 1e-9);
    }
  }
});

// ── 50. 真 weapons 發射每符消費 fan 快照、發射角矩陣、逐符去重與 Boss/盾防護 ────
test('M1-D-50 Real weapons producer consumes fan snapshot per talisman, launch angle matrix, deduplication, and Boss/shield protection', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_fan']);
  probe.getP().x = 100;
  probe.getP().y = 200;

  // 目標在玩家正右方 (300, 200) -> baseAng = 0
  const ghost = { x: 300, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([ghost]);

  // 真 weapons(0.001) 發射
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);

  const projectiles = probe.getProj();
  assert.equal(projectiles.length, 3, 'Lv1 + mut_fan 真 weapons 自然產生 3 枚符咒');

  // 驗證相鄰角距為 0.32，對稱發射
  // i=0: a = 0 + (0 - 1) * 0.32 = -0.32
  // i=1: a = 0 + (1 - 1) * 0.32 = 0
  // i=2: a = 0 + (2 - 1) * 0.32 = +0.32
  const p0 = projectiles[0], p1 = projectiles[1], p2 = projectiles[2];
  assert.ok(p0.vy < -50, '符咒 0 朝偏上方散射 (角 -0.32)');
  assert.equal(Math.round(p1.vy), 0, '符咒 1 朝正右方直射 (角 0)');
  assert.ok(p2.vy > 50, '符咒 2 朝偏下方散射 (角 +0.32)');

  // 每符傷害為 2.64 / 3 = 0.88
  for (const p of projectiles) {
    assert.equal(Number(p.damage.toFixed(4)), 0.88, '每符快照傷害為 0.88');
    assert.equal(Number(p.splashDamage.toFixed(4)), 0.176, '每符快照濺射傷為 0.176');
  }

  // 步進至符咒 1 擊中幽靈並黏附
  let isStuck = false;
  let steps = 0;
  while (!isStuck && steps < 30) {
    probe.weapons(0.05);
    steps++;
    if (p1.stuck) isStuck = true;
  }
  assert.ok(isStuck, '符咒 1 成功黏附');

  // 步進至保險絲到期爆炸
  let exploded = false;
  let fuseSteps = 0;
  while (!exploded && fuseSteps < 40) {
    probe.weapons(0.05);
    fuseSteps++;
    if (p1.exploded) exploded = true;
  }
  assert.ok(exploded, '符咒 1 引爆');
  assert.equal(Number((100 - ghost.hp).toFixed(4)), 0.88, '直擊造成分攤後快照傷 0.88');

  // Boss 抗性防護：Boss 受分攤平傷，絕無擊退
  const boss = { x: 300, y: 200, hp: 100, max: 100, type: 'boss' };
  probe.setEnemies([boss]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const bossProj = probe.getProj().find(p => Math.abs(p.vy) < 1);
  assert.ok(bossProj, '朝向 Boss 發射的符咒');
  let bossStuck = false;
  let bSteps = 0;
  while (!bossStuck && bSteps < 30) {
    probe.weapons(0.05);
    bSteps++;
    if (bossProj.stuck) bossStuck = true;
  }
  let bossExploded = false;
  let bFuse = 0;
  while (!bossExploded && bFuse < 40) {
    probe.weapons(0.05);
    bFuse++;
    if (bossProj.exploded) bossExploded = true;
  }
  assert.equal(Number((100 - boss.hp).toFixed(4)), 0.88, 'Boss 受分攤後傷 0.88');
  assert.equal((boss.knockQueue || []).length, 0, 'Boss 具備完全擊退免疫');

  // 護盾與死敵防護
  const shieldedEnemy = { x: 300, y: 200, hp: 100, max: 100, type: 'ghost', shield: true };
  probe.setEnemies([shieldedEnemy]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const shieldProj = probe.getProj().find(p => Math.abs(p.vy) < 1);
  let sSteps = 0;
  while (sSteps < 60) { probe.weapons(0.05); sSteps++; if (shieldProj.exploded) break; }
  assert.equal(shieldedEnemy.hp, 100, '帶護盾目標免疫符咒傷害');
});

// ── 51. mut_fan + mut_splitblast 多符最壞情境時序、次爆傷害預算與 32 隊列上限 ────
test('M1-D-51 mut_fan + mut_splitblast worst-case multi-talisman timing, secondary damage budget, and 32 queue hard cap', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_fan', 'mut_splitblast']);
  probe.getP().x = 100;
  probe.getP().y = 200;

  // 1. resolveAttackSpec 數值預算驗證
  const spec = probe.resolveAttackSpec('boom', 1);
  assert.equal(spec.count, 3);
  assert.equal(spec.hasFan, true);
  assert.equal(spec.hasSplitblast, true);
  assert.equal(Number(spec.damage.toFixed(4)), 0.88);
  assert.equal(Number(spec.splashDamage.toFixed(4)), 0.176);
  assert.equal(Number(spec.splitblastDirectDamage.toFixed(4)), 0.22, '次爆直擊為分攤後主爆全傷 25% (0.88 * 0.25 = 0.22)');
  assert.equal(Number(spec.splitblastSplashDamage.toFixed(4)), 0.044, '次爆濺射為分攤後主爆濺射傷 25% (0.176 * 0.25 = 0.044)');

  // 驗證整 cast 3 枚符咒的次爆總傷亦不超過無 fan 時的單符次爆傷 (0.66)
  const totalSecondaryDirect = spec.count * spec.splitblastDirectDamage;
  assert.ok(Math.abs(totalSecondaryDirect - 0.66) <= 1e-9, '3 符次爆直擊總和精準等於無 fan 次爆 0.66');

  // 2. 真 weapons 發射 3 符並黏附引爆
  const target = { x: 200, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([target]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  assert.equal(probe.getProj().length, 3);

  // 讓符咒自然飛行黏附
  let anyStuck = false;
  let stepsStuck = 0;
  while (!anyStuck && stepsStuck < 20) {
    probe.weapons(0.05);
    stepsStuck++;
    if (probe.getProj().some(p => p.stuck)) anyStuck = true;
  }
  assert.ok(anyStuck, '符咒黏附');

  // 步進至主爆產生次爆
  let mainExploded = false;
  let stepsFuse = 0;
  while (!mainExploded && stepsFuse < 40) {
    probe.weapons(0.05);
    stepsFuse++;
    if (probe.getSplitblasts().length > 0) mainExploded = true;
  }
  assert.ok(mainExploded, '主爆引爆並產生待發次爆');
  const queuedSbs = probe.getSplitblasts();
  assert.ok(queuedSbs.length >= 1, '次爆已入隊');
  assert.equal(queuedSbs[0].delay, 0.18, '新生成之次爆在出生當幀保留完整 0.18s');
  assert.equal(Number(queuedSbs[0].directDamage.toFixed(4)), 0.22, '隊列中次爆使用分攤後 0.22 傷');

  // 驗證 0.15s 內絕不觸發（R7.1 時序保護）
  const hpAfterMain = target.hp;
  probe.weapons(0.05);
  probe.weapons(0.05);
  probe.weapons(0.05); // 合計 0.15s
  assert.equal(target.hp, hpAfterMain, '主爆後 0.15s 內次爆絕不可提前造成傷害');

  // 再走 0.05s（累計 0.20s >= 0.18s），次爆觸發
  probe.weapons(0.05);
  assert.ok(target.hp < hpAfterMain, '次爆在達到 0.18s 後精準觸發傷害');

  // 3. 隊列 32 硬上限防護
  // 填充隊列至 31
  const dummyQueue = [];
  for (let i = 0; i < 31; i++) dummyQueue.push({ x: 0, y: 0, delay: 0.18 });
  probe.setSplitblasts(dummyQueue);
  assert.equal(probe.getSplitblasts().length, 31);

  // 兩枚帶 splitblast 的符咒同時引爆
  probe.setProj([
    { x: 100, y: 100, stuck: true, target: target, fuse: 0.001, hasSplitblast: true, splitblastDelay: 0.18, radius: 40, damage: 1, splashDamage: 0.2, splitblastDirectDamage: 0.25, splitblastSplashDamage: 0.05 },
    { x: 120, y: 100, stuck: true, target: target, fuse: 0.001, hasSplitblast: true, splitblastDelay: 0.18, radius: 40, damage: 1, splashDamage: 0.2, splitblastDirectDamage: 0.25, splitblastSplashDamage: 0.05 }
  ]);
  probe.weapons(0.01);
  assert.equal(probe.getSplitblasts().length, 32, '次爆隊列達到 32 硬上限後略過新次爆，不突破 32');
});

// ── 52. 真選卡升級前後老新符快照隔離與天狐靈針既有 fan 規格完全保護 ────
test('M1-D-52 In-flight talisman snapshot isolation against mut_fan acquisition and needle fan/seek/frost complete regression protection', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 飽和被動與御守
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), {
    shield: 6,
    oilRegen: 0.12,
    heals: 3,
    rate: 4,
    crit: 3,
    spd: 3,
    dash: 3,
    mag: 3,
    dmgUp: 4
  });

  probe.getWL().katana = 0;
  probe.getWL().barrier = 0;
  probe.getWL().fire = 0;
  probe.getWL().needle = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations([]); // 初始未持有 mut_fan

  const enemy = { x: 200, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemy]);
  probe.getP().x = 100;
  probe.getP().y = 200;

  // 1. 真 weapons(0.001) 發射初始符咒（無 mut_fan，單枚 2.64 傷）
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  assert.equal(probe.getProj().length, 1, '未選 fan 時真 weapons 僅產生 1 枚符咒');
  const oldTalisman = probe.getProj()[0];
  assert.equal(oldTalisman.damage, 2.64, '初始傷害為 2.64');

  // 飛行途中推進 0.05s
  probe.weapons(0.05);
  assert.equal(oldTalisman.stuck, false, '舊符飛行中');

  // 飛行途中：真 offerUp -> applyChoice 取得 mut_fan
  let fanCardFlight = null;
  for (let attempt = 0; attempt < 25 && !fanCardFlight; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    fanCardFlight = probe.getChoices().find(c => c.id === 'mut_fan');
  }
  assert.ok(fanCardFlight, '真 offerUp 抽出 mut_fan');
  const applyRes = probe.applyChoice(fanCardFlight.choiceId, probe.getBuildRevision());
  assert.equal(applyRes.ok, true, '真 applyChoice 成功取得 mut_fan');

  // 驗證飛行中舊符絕不回寫：
  assert.equal(probe.getProj().length, 1, '飛行中取得 mut_fan，舊符絕不可分裂為多枚');
  assert.equal(oldTalisman.damage, 2.64, '飛行中取得 mut_fan，舊符傷害絕不被回寫為分攤傷');

  // 舊符自然引爆
  let oldExploded = false;
  let steps = 0;
  while (!oldExploded && steps < 50) {
    probe.weapons(0.05);
    steps++;
    if (oldTalisman.exploded) oldExploded = true;
  }
  assert.ok(oldExploded, '舊符成功引爆');
  assert.equal(Number((100 - enemy.hp).toFixed(4)), 2.64, '舊符造成完整 2.64 原始傷');

  // 2. 升級後發射全新符咒：正確生效 3 枚散射與分攤傷
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const newProjectiles = probe.getProj();
  assert.equal(newProjectiles.length, 3, '升級後真 weapons 發射 3 枚散射符咒');
  for (const np of newProjectiles) {
    assert.equal(Number(np.damage.toFixed(4)), 0.88, '新符咒生效分攤傷害 0.88');
  }

  // 3. 天狐靈針既有 fan 規格完全保護（Lv5 冰魄靈針 + mut_fan）
  probe.getWL().needle = 5;
  const needleFanSpec = probe.resolveAttackSpec('needle', 5);
  assert.equal(needleFanSpec.fan, true, '靈針保有 fan');
  assert.equal(needleFanSpec.perShotScale, 0.72, '靈針單發比例保持 0.72');
  probe.getNeedles().length = 0;
  probe.setWT('needle', 0);
  probe.weapons(0.001);
  assert.equal(probe.getNeedles().length, 11, 'Lv5 覺醒冰靈暴 + mut_fan 生成 11 枚靈針 (8 原生 + 3 fan)');
});

// ── 53. mut_seek 共享候選池資格、動態卡片呈現（boom-only / needle-only / both / none）、去重與容量阻擋 ────
test('M1-D-53 mut_seek shared pool eligibility, dynamic card presentation (boom-only / needle-only / both / none), deduplication, and capacity blocking', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. None owned: 兩者皆未持有時絕不出卡
  probe.getWL().needle = 0;
  probe.getWL().boom = 0;
  for (let i = 0; i < 15; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_seek'), '未持有靈針亦未持有陰陽符時，mut_seek 絕不可入池');
  }

  // 2. Needle-only: 僅持有靈針
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  let seekNeedleCard = null;
  for (let i = 0; i < 30 && !seekNeedleCard; i++) {
    const choices = probe.getEligibleChoices();
    seekNeedleCard = choices.find(c => c.id === 'mut_seek');
  }
  assert.ok(seekNeedleCard, 'needle-only 時 mut_seek 必須出現在候選池');
  assert.equal(seekNeedleCard.choiceId, 'mutation:needle:mut_seek', '維持 canonical opaque choiceId');
  assert.equal(seekNeedleCard.skillId, 'needle');
  assert.deepEqual(Array.from(seekNeedleCard.skillIds), ['needle'], 'skillIds 僅包含 needle');
  assert.equal(seekNeedleCard.n, '靈針・引魂追跡', 'needle-only 名稱為 靈針・引魂追跡');
  assert.equal(seekNeedleCard.cat, '【 靈針變異 】');
  assert.equal(seekNeedleCard.levelText, '◆ 靈針變異');
  assert.equal(seekNeedleCard.requirementText, '持有天狐靈針（取得陰陽符後亦適用）');
  assert.ok(seekNeedleCard.limitText.includes('取得其他適用技能後沿用'));
  assert.ok(seekNeedleCard.d.includes('每次施放') || !seekNeedleCard.d.includes('cast'), '不含內部術語 cast');

  // 3. Boom-only: 僅持有陰陽符
  probe.getWL().needle = 0;
  probe.getWL().boom = 1;
  let seekBoomCard = null;
  for (let i = 0; i < 30 && !seekBoomCard; i++) {
    const choices = probe.getEligibleChoices();
    seekBoomCard = choices.find(c => c.id === 'mut_seek');
  }
  assert.ok(seekBoomCard, 'boom-only 時 mut_seek 必須出現在候選池');
  assert.equal(seekBoomCard.choiceId, 'mutation:needle:mut_seek', 'boom-only 仍維持 canonical opaque choiceId');
  assert.equal(seekBoomCard.skillId, 'boom');
  assert.deepEqual(Array.from(seekBoomCard.skillIds), ['boom'], 'skillIds 僅包含 boom');
  assert.equal(seekBoomCard.n, '陰陽符・引魂追跡', 'boom-only 名稱為 陰陽符・引魂追跡');
  assert.equal(seekBoomCard.cat, '【 陰陽符變異 】');
  assert.equal(seekBoomCard.levelText, '◆ 陰陽符變異');
  assert.equal(seekBoomCard.requirementText, '持有陰陽符（取得天狐靈針後亦適用）');
  assert.ok(seekBoomCard.limitText.includes('取得其他適用技能後沿用'));
  assert.ok(seekBoomCard.d.includes('每次施放') || !seekBoomCard.d.includes('cast'), '不含內部術語 cast');

  // 4. Both owned: 同時持有靈針與陰陽符
  probe.getWL().needle = 1;
  probe.getWL().boom = 1;
  let seekBothCard = null;
  for (let i = 0; i < 30 && !seekBothCard; i++) {
    const choices = probe.getEligibleChoices();
    seekBothCard = choices.find(c => c.id === 'mut_seek');
  }
  assert.ok(seekBothCard, '同時持有兩技能時 mut_seek 必須出現在候選池');
  assert.equal(seekBothCard.choiceId, 'mutation:needle:mut_seek');
  assert.deepEqual(Array.from(seekBothCard.skillIds), ['needle', 'boom'], 'skillIds 包含兩技能');
  assert.equal(seekBothCard.n, '引魂追跡', '同時持有時名稱為 引魂追跡');
  assert.equal(seekBothCard.cat, '【 共享變異 】');
  assert.equal(seekBothCard.levelText, '◆ 共享變異');
  assert.equal(seekBothCard.requirementText, '持有天狐靈針或陰陽符（同時生效，後續取得亦適用）');
  assert.ok(seekBothCard.limitText.includes('取得其他適用技能後沿用'));

  // 5. 已有 mut_seek 全局去重：不再重複出卡
  probe.setBuildMutations(['mut_seek']);
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_seek'), '已持有 mut_seek 時絕不重複出卡');
  }
  probe.setBuildMutations([]);

  // 6. 容量阻擋：若兩技能皆持有，其中一方滿 3 槽（例如 needle 滿 3 變異），則 mut_seek 必須被阻擋
  probe.getWL().needle = 1;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_fan', 'mut_frost', 'mut_pierce']); // needle 3/3 滿槽
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_seek'), 'needle 滿 3 變異時，共享卡 mut_seek 必須被阻擋進池，不得讓 needle 超額');
  }
  assert.equal(probe.addMutation('mut_seek'), false, 'addMutation 亦必須阻擋滿槽技能超額');
});

// ── 54. resolveAttackSpec boom Lv1–5 原型數值快照、基線保持、tracking 與 reachMult 縮放 ────
test('M1-D-54 resolveAttackSpec boom Lv1-5 seek prototype numerical fidelity, baseline preservation, tracking turnRate, and reachMult scaling', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const expectedBaseCounts = [1, 2, 3, 4, 2];
  const expectedCds        = [1.76, 1.52, 1.28, 1.04, 1.6];
  const expectedRadii      = [78, 92, 108, 122, 135];
  const expectedSpreads    = [0.32, 0.32, 0.32, 0.28, 0.28];

  for (let lvl = 1; lvl <= 5; lvl++) {
    const baseSpec = probe.resolveAttackSpec('boom', lvl, { mutations: [] });
    const seekSpec = probe.resolveAttackSpec('boom', lvl, { mutations: ['mut_seek'] });

    // 1. 基線特性保持：不改數量、冷卻、初速、壽命、保險絲、散佈角、傷害
    assert.equal(seekSpec.skillId, 'boom');
    assert.equal(seekSpec.level, lvl);
    assert.equal(seekSpec.isAwakened, lvl === 5);
    assert.equal(seekSpec.source, 'mutation');
    assert.equal(seekSpec.baseCount, expectedBaseCounts[lvl - 1]);
    assert.equal(seekSpec.count, expectedBaseCounts[lvl - 1]);
    assert.equal(seekSpec.cooldown, expectedCds[lvl - 1]);
    assert.equal(seekSpec.speed, 880);
    assert.equal(seekSpec.life, 1.4);
    assert.equal(seekSpec.fuse, 1.5);
    assert.equal(seekSpec.spread, expectedSpreads[lvl - 1]);
    assert.equal(seekSpec.radius, expectedRadii[lvl - 1]);
    assert.equal(seekSpec.knockback, 72);
    assert.equal(seekSpec.damage, baseSpec.damage);
    assert.equal(seekSpec.splashDamage, baseSpec.splashDamage);

    // 2. 追蹤參數快照
    assert.equal(seekSpec.hasSeek, true);
    assert.equal(seekSpec.seek, true);
    assert.equal(seekSpec.tracking, true);
    assert.equal(seekSpec.turnRate, 4.2, '最大轉向角速率為 4.2 rad/s');
    assert.equal(seekSpec.seekRange, 480, '基準 reachMult=1.0 時索敵半徑為 480');
  }

  // 3. reachMult 射程縮放驗證：reachMult=1.10 時 seekRange 為 round(480 * 1.10) = 528
  const reachSpec = probe.resolveAttackSpec('boom', 1, { mutations: ['mut_seek'], charms: ['charm_reach'] });
  assert.equal(reachSpec.seekRange, 528, 'charm_reach (reachMult=1.10) 下 seekRange 縮放為 528');
});

// ── 55. 真物理執行：角速度限制（<= 4.2 * dt）、定速 880、無瞬移、wrap-around 最短轉向與壽命消散 ────
test('M1-D-55 Boom projectile physical execution: angular turn limit (<= 4.2 * dt), constant speed 880, no teleport, wrap-around shortest turn, and life expiry dissipation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_seek']);

  // 1. 角速度限制與定速無瞬移驗證
  // 玩家在 (100, 200)，目標在 (100, 500)（正下方，角度約 1.5708 rad）
  probe.getP().x = 100;
  probe.getP().y = 200;
  const enemySouth = { x: 100, y: 500, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemySouth]);

  // 手動注入朝向正右方 (angle 0) 的符咒
  probe.setProj([{
    x: 100, y: 200,
    vx: 880, vy: 0,
    ang: 0,
    speed: 880,
    t: 0,
    life: 1.4,
    fuse: 0,
    initialFuse: 1.5,
    level: 1,
    stuck: false,
    target: null,
    seekTarget: null,
    retargetT: 0,
    searchCount: 0,
    tracking: true,
    turnRate: 4.2,
    seekRange: 480,
    hasSeek: true,
    exploded: false,
    radius: 78,
    damage: 2.64,
    splashDamage: 0.528,
    knockback: 72,
    hasSplitblast: false
  }]);

  // 推進 0.05s
  probe.weapons(0.05);
  const p = probe.getProj()[0];
  assert.ok(p, '符咒存在');

  // 角速度上限：0.05s 內最大轉向角為 4.2 * 0.05 = 0.21 rad
  // 目標差為 +1.5708 rad，轉向應精準等於 0.21 rad
  assert.ok(Math.abs(p.ang - 0.21) < 1e-4, `轉向角 ${p.ang} 未受限於 4.2 * dt (0.21)`);
  // 速度模長嚴格維持 880
  const spd = Math.hypot(p.vx, p.vy);
  assert.ok(Math.abs(spd - 880) < 1e-4, `速度模長 ${spd} 偏離 880`);
  // 單步位移嚴格等於 880 * 0.05 = 44（無瞬移）
  const stepDist = Math.hypot(p.x - 100, p.y - 200);
  assert.ok(Math.abs(stepDist - 44) < 1e-4, `單步位移 ${stepDist} 不等於 44 (無瞬移)`);

  // 2. Wrap-around 跨 branch cut 最短角度轉向驗證
  // 符咒當前角度 +3.10 rad（接近 +PI），目標角度 -3.10 rad（接近 -PI）
  // 兩者差為 -6.20 rad，但最短路徑為跨 PI 轉向 +0.083185 rad
  const wrapEnemy = {
    x: 200 + Math.cos(-3.10) * 150,
    y: 200 + Math.sin(-3.10) * 150,
    hp: 100, max: 100, type: 'ghost'
  };
  probe.setEnemies([wrapEnemy]);
  probe.setProj([{
    x: 200, y: 200,
    vx: Math.cos(3.10) * 880, vy: Math.sin(3.10) * 880,
    ang: 3.10,
    speed: 880,
    t: 0,
    life: 1.4,
    fuse: 0,
    initialFuse: 1.5,
    level: 1,
    stuck: false,
    target: null,
    seekTarget: null,
    retargetT: 0,
    searchCount: 0,
    tracking: true,
    turnRate: 4.2,
    seekRange: 480,
    hasSeek: true,
    exploded: false,
    radius: 78,
    damage: 2.64,
    splashDamage: 0.528,
    knockback: 72,
    hasSplitblast: false
  }]);

  // 單步 0.05s：最大轉向 0.21 > 0.083185，應直接轉向至目標角度 -3.10
  probe.weapons(0.05);
  const wrapP = probe.getProj()[0];
  const targetAng = Math.atan2(wrapEnemy.y - 200, wrapEnemy.x - 200);
  assert.ok(Math.abs(wrapP.ang - targetAng) < 1e-3, '最短路徑轉向成功，未旋轉 350 度');

  // 3. 壽命消散無續命
  probe.setEnemies([]); // 空場
  probe.setProj([{
    x: 0, y: 0, vx: 880, vy: 0, ang: 0, speed: 880,
    t: 0, life: 1.4, fuse: 0, initialFuse: 1.5, level: 1,
    stuck: false, target: null, seekTarget: null, retargetT: 0, searchCount: 0,
    tracking: true, turnRate: 4.2, seekRange: 480, hasSeek: true,
    exploded: false, radius: 78, damage: 2.64, splashDamage: 0.528, knockback: 72, hasSplitblast: false
  }]);

  // 前進 1.35s (27 步 * 0.05s)
  for (let s = 0; s < 27; s++) probe.weapons(0.05);
  assert.equal(probe.getProj().length, 1, '1.35s 符咒尚存 (life=0.05)');

  // 再前進 0.10s (累計 1.45s > 1.40s)
  probe.weapons(0.05);
  probe.weapons(0.05);
  assert.equal(probe.getProj().length, 0, '超過 1.4s 壽命自然消散，絕不續命');
});

// ── 56. 索敵時序與目標狀態：0.20s 間隔、鎖定不重搜、目標死亡/護盾/離場直行 ────
test('M1-D-56 Boom search timing rate-limit (0.20s), target state transitions (dead, shield, vanish, distance), and straight flying without target', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_seek']);

  // 1. 無目標時搜尋速率限制：每 0.20s 恰搜尋 1 次，1.0s 恰搜尋 5 次
  probe.setEnemies([]);
  probe.setProj([{
    x: 0, y: 0, vx: 440, vy: 0, ang: 0, speed: 440,
    t: 0, life: 1.4, fuse: 0, initialFuse: 1.5, level: 1,
    stuck: false, target: null, seekTarget: null, retargetT: 0, searchCount: 0,
    tracking: true, turnRate: 4.2, seekRange: 480, hasSeek: true,
    exploded: false, radius: 78, damage: 2.64, splashDamage: 0.528, knockback: 72, hasSplitblast: false
  }]);

  const testProj = probe.getProj()[0];
  // 步進 20 次 0.05s（累計 1.0s）
  for (let step = 0; step < 20; step++) {
    probe.weapons(0.05);
  }
  assert.equal(testProj.searchCount, 5, '1.0s 內無目標時恰搜尋 5 次 (每 0.20s 一次，非每幀重搜)');

  // 2. 鎖定目標時不每幀重搜
  const liveEnemy = { x: 300, y: 0, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([liveEnemy]);
  probe.setProj([{
    x: 0, y: 0, vx: 440, vy: 0, ang: 0, speed: 440,
    t: 0, life: 1.4, fuse: 0, initialFuse: 1.5, level: 1,
    stuck: false, target: null, seekTarget: null, retargetT: 0, searchCount: 0,
    tracking: true, turnRate: 4.2, seekRange: 480, hasSeek: true,
    exploded: false, radius: 78, damage: 2.64, splashDamage: 0.528, knockback: 72, hasSplitblast: false
  }]);
  const lockProj = probe.getProj()[0];
  probe.weapons(0.05); // 第 1 步完成鎖定
  assert.equal(lockProj.seekTarget, liveEnemy, '成功鎖定目標');
  const countAfterLock = lockProj.searchCount;

  // 接下來 4 步 (0.20s) 目標持續存活
  for (let s = 0; s < 4; s++) probe.weapons(0.05);
  assert.equal(lockProj.searchCount, countAfterLock, '目標鎖定期間絕不每幀重複全域搜尋');

  // 3. 目標狀態轉移：死亡、護盾、離場、超出距離
  // (a) 目標死亡 -> 失去鎖定，沿當前向量直行
  liveEnemy.hp = 0;
  const angBeforeDeath = lockProj.ang;
  probe.weapons(0.01);
  assert.equal(lockProj.seekTarget, null, '目標死亡時立即解除鎖定');
  assert.equal(lockProj.ang, angBeforeDeath, '失去目標後維持當前方向直行');

  // (b) 目標具備護盾 -> 不予鎖定
  const shieldEnemy = { x: 200, y: 10, hp: 100, max: 100, type: 'ghost', shield: true };
  probe.setEnemies([shieldEnemy]);
  lockProj.retargetT = 0; // 觸發搜尋
  probe.weapons(0.05);
  assert.equal(lockProj.seekTarget, null, '帶護盾目標絕不被索敵鎖定');

  // (c) 目標離場 (vanish: true 或 done: true) -> 解除鎖定
  const vanishEnemy = { x: 200, y: 10, hp: 100, max: 100, type: 'ghost', vanish: true };
  probe.setEnemies([vanishEnemy]);
  lockProj.retargetT = 0;
  probe.weapons(0.05);
  assert.equal(lockProj.seekTarget, null, '離場目標絕不被索敵鎖定');

  // (d) 超出 seekRange (480) -> 解除鎖定
  const farEnemy = { x: 1000, y: 0, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([farEnemy]);
  lockProj.retargetT = 0;
  probe.weapons(0.05);
  assert.equal(lockProj.seekTarget, null, '超出 seekRange 之目標不予鎖定');
});

// ── 57. 真選卡 offerUp -> applyChoice 取得 mut_seek、雙向武器繼承與合法三槽組合 ────
test('M1-D-57 Real offerUp -> applyChoice for mut_seek, bidirectional weapon learning inheritance, and legal 3-slot combination (fan + seek + splitblast)', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 設置飽和被動保證抽卡確定性
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });

  // 1. Case A: 先持有 boom，真選卡取得 mut_seek，後真選卡習得 needle
  probe.getWL().katana = 1;
  probe.getWL().boom = 1;
  probe.getWL().needle = 0;
  probe.getWL().barrier = 0;
  probe.getWL().fire = 0;
  probe.getWL().thunder = 0;
  probe.setBuildMutations([]);

  let seekCardA = null;
  for (let attempt = 0; attempt < 25 && !seekCardA; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    seekCardA = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_seek');
  }
  assert.ok(seekCardA, 'boom-only 經真 offerUp 抽出 mut_seek');
  const applyA = probe.applyChoice(seekCardA.choiceId, probe.getBuildRevision());
  assert.equal(applyA.ok, true, '套用 mut_seek');

  // 後學 needle
  let needleCardA = null;
  for (let attempt = 0; attempt < 25 && !needleCardA; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    needleCardA = probe.getChoices().find(c => c.choiceId === 'weapon:needle:1');
  }
  assert.ok(needleCardA, '真 offerUp 抽出新武器天狐靈針');
  const applyNeedleA = probe.applyChoice(needleCardA.choiceId, probe.getBuildRevision());
  assert.equal(applyNeedleA.ok, true, '習得天狐靈針');

  // 驗證兩者均受 mut_seek 影響
  const needleSpecA = probe.resolveAttackSpec('needle', 1);
  const boomSpecA = probe.resolveAttackSpec('boom', 1);
  assert.equal(needleSpecA.tracking, true, '後學靈針真繼承 tracking');
  assert.equal(boomSpecA.tracking, true, '陰陽符具備 tracking');

  // 2. Case B: 先持有 needle，真選卡取得 mut_seek，後真選卡習得 boom
  probe.start('night-town');
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });
  probe.getWL().katana = 1;
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  probe.setBuildMutations([]);

  let seekCardB = null;
  for (let attempt = 0; attempt < 25 && !seekCardB; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    seekCardB = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_seek');
  }
  assert.ok(seekCardB, 'needle-only 經真 offerUp 抽出 mut_seek');
  const applyB = probe.applyChoice(seekCardB.choiceId, probe.getBuildRevision());
  assert.equal(applyB.ok, true, '套用 mut_seek');

  let boomCardB = null;
  for (let attempt = 0; attempt < 25 && !boomCardB; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    boomCardB = probe.getChoices().find(c => c.choiceId === 'weapon:boom:1');
  }
  assert.ok(boomCardB, '真 offerUp 抽出新武器陰陽符');
  const applyBoomB = probe.applyChoice(boomCardB.choiceId, probe.getBuildRevision());
  assert.equal(applyBoomB.ok, true, '習得陰陽符');

  const boomSpecB = probe.resolveAttackSpec('boom', 1);
  assert.equal(boomSpecB.hasSeek, true, '後學陰陽符真繼承 mut_seek');
  assert.equal(boomSpecB.tracking, true);

  // 3. 合法三槽變異組合：mut_fan + mut_seek + mut_splitblast 同時生效
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_splitblast']);
  const triSpec = probe.resolveAttackSpec('boom', 1);
  assert.equal(triSpec.count, 3, 'fan 生效：3 發');
  assert.equal(triSpec.tracking, true, 'seek 生效：tracking 追蹤');
  assert.equal(triSpec.hasSplitblast, true, 'splitblast 生效：次爆延遲');
  assert.equal(Number(triSpec.damage.toFixed(4)), 0.88, 'fan 分攤主爆全傷 0.88');
  assert.equal(Number(triSpec.splitblastDirectDamage.toFixed(4)), 0.22, '次爆直擊 0.22');

  // 真 weapons 發射 3 符
  probe.getP().x = 100;
  probe.getP().y = 200;
  const triEnemy = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([triEnemy]);
  probe.getProj().length = 0;
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  assert.equal(probe.getProj().length, 3, '三槽組合真 weapons 產生 3 符');
  for (const q of probe.getProj()) {
    assert.equal(q.tracking, true, '每符皆具備追蹤');
    assert.equal(q.hasSplitblast, true, '每符皆具備次爆');
    assert.equal(Number(q.damage.toFixed(4)), 0.88);
  }
});

// ── 58. 飛行／黏附／次爆佇列中升級快照隔離、凍結與清理、靈針 Lv5 保護 ────
test('M1-D-58 In-flight talisman and queued splitblast snapshot isolation, pause/levelup freeze, lifecycle reset, and needle Lv5 regression protection', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations([]); // 初始未持有 mut_seek

  probe.getP().x = 100;
  probe.getP().y = 200;
  const enemy = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemy]);

  // 1. 發射初始未帶 seek 之符咒
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  assert.equal(probe.getProj().length, 1);
  const oldTalisman = probe.getProj()[0];
  assert.equal(oldTalisman.tracking, false, '初發符咒不具追蹤');

  // 飛行中推進 0.05s
  probe.weapons(0.05);

  // 飛行途中：真選卡取得 mut_seek
  let seekCard = null;
  for (let attempt = 0; attempt < 25 && !seekCard; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    seekCard = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_seek');
  }
  assert.ok(seekCard, '抽出 mut_seek');
  const applyRes = probe.applyChoice(seekCard.choiceId, probe.getBuildRevision());
  assert.equal(applyRes.ok, true, '套用 mut_seek');

  // 飛行中舊符快照隔離：絕不追溯獲得追蹤
  assert.equal(oldTalisman.tracking, false, '飛行中舊符絕不回寫 tracking');
  assert.equal(oldTalisman.seekRange, 480, '舊符 seekRange 維持原本快照 480');

  // 新符發射：正確獲得 tracking 快照
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const newTalisman = probe.getProj().find(p => p !== oldTalisman);
  assert.ok(newTalisman, '發射新符咒');
  assert.equal(newTalisman.tracking, true, '新符咒生效 tracking');
  assert.equal(newTalisman.seekRange, 480, '新符咒生效 seekRange 480');

  // 2. 御守 reachMult 變動快照隔離
  probe.setBuildCharms(['charm_reach']); // seekRange 應變為 528
  assert.equal(newTalisman.seekRange, 480, '新符已生成之 seekRange 快照不受後續御守改動影響');

  // 3. 次爆隊列時序與數值快照隔離
  probe.setSplitblasts([{ x: 100, y: 100, delay: 0.18, radius: 40, directDamage: 0.66, splashDamage: 0.132, hits: new Set(), triggered: false }]);
  probe.getB().dmg = 3.0; // 提升攻擊力
  assert.equal(probe.getSplitblasts()[0].directDamage, 0.66, '隊列中次爆傷害快照絕不被回寫');

  // 4. 生命週期與凍結驗證
  // pause 凍結
  probe.setState('pause');
  const fuseBeforePause = newTalisman.fuse;
  probe.update(0.1);
  assert.equal(newTalisman.fuse, fuseBeforePause, 'pause 狀態下 update 凍結物理與引信');
  probe.setState('play');

  // 重置清理
  probe.loseRun();
  assert.equal(probe.getProj().length, 0, 'loseRun 清空所有符咒');
  assert.equal(probe.getSplitblasts().length, 0, 'loseRun 清空次爆隊列');

  // 5. 天狐靈針 Lv5 覺醒冰靈暴與現役追蹤完整回歸防護
  probe.start('night-town');
  probe.getWL().needle = 5;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  const needleLv5Spec = probe.resolveAttackSpec('needle', 5);
  assert.equal(needleLv5Spec.isAwakened, true);
  assert.equal(needleLv5Spec.tracking, true);
  assert.equal(needleLv5Spec.frost, true);
  assert.equal(needleLv5Spec.count, 11, '8 原生 + 3 fan = 11');

  probe.getNeedles().length = 0;
  probe.setWT('needle', 0);
  probe.weapons(0.001);
  assert.equal(probe.getNeedles().length, 11, '生成 11 枚靈針');
  for (const nd of probe.getNeedles()) {
    assert.equal(nd.tracking, true, '每枚靈針均具備追蹤');
    assert.equal(nd.frost, true, '每枚靈針均具備冰魄');
  }
});

// ── 59. mut_frost 共享候選池資格、動態卡片呈現（boom-only / needle-only / both / none）、去重與容量阻擋 ────
test('M1-D-59 mut_frost shared pool eligibility, dynamic card presentation (boom-only / needle-only / both / none), deduplication, and capacity blocking', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. None owned: 兩者皆未持有時絕不出卡
  probe.getWL().needle = 0;
  probe.getWL().boom = 0;
  for (let i = 0; i < 15; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_frost'), '未持有靈針亦未持有陰陽符時，mut_frost 絕不可入池');
  }

  // 2. Needle-only: 僅持有靈針
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  let frostNeedleCard = null;
  for (let i = 0; i < 30 && !frostNeedleCard; i++) {
    const choices = probe.getEligibleChoices();
    frostNeedleCard = choices.find(c => c.id === 'mut_frost');
  }
  assert.ok(frostNeedleCard, 'needle-only 時 mut_frost 必須出現在候選池');
  assert.equal(frostNeedleCard.choiceId, 'mutation:needle:mut_frost', '維持 canonical opaque choiceId');
  assert.equal(frostNeedleCard.skillId, 'needle');
  assert.deepEqual(Array.from(frostNeedleCard.skillIds), ['needle'], 'skillIds 僅包含 needle');
  assert.equal(frostNeedleCard.n, '靈針・冰魄封靈', 'needle-only 名稱為 靈針・冰魄封靈');
  assert.equal(frostNeedleCard.cat, '【 靈針變異 】');
  assert.equal(frostNeedleCard.levelText, '◆ 靈針變異');
  assert.equal(frostNeedleCard.requirementText, '持有天狐靈針（取得陰陽符後亦適用）');
  assert.ok(frostNeedleCard.limitText.includes('取得其他適用技能後沿用'));
  assert.ok(frostNeedleCard.d.includes('每次施放') || !frostNeedleCard.d.includes('cast'), '不含內部術語 cast');

  // 3. Boom-only: 僅持有陰陽符
  probe.getWL().needle = 0;
  probe.getWL().boom = 1;
  let frostBoomCard = null;
  for (let i = 0; i < 30 && !frostBoomCard; i++) {
    const choices = probe.getEligibleChoices();
    frostBoomCard = choices.find(c => c.id === 'mut_frost');
  }
  assert.ok(frostBoomCard, 'boom-only 時 mut_frost 必須出現在候選池');
  assert.equal(frostBoomCard.choiceId, 'mutation:needle:mut_frost', 'boom-only 仍維持 canonical opaque choiceId');
  assert.equal(frostBoomCard.skillId, 'boom');
  assert.deepEqual(Array.from(frostBoomCard.skillIds), ['boom'], 'skillIds 僅包含 boom');
  assert.equal(frostBoomCard.n, '陰陽符・冰魄封靈', 'boom-only 名稱為 陰陽符・冰魄封靈');
  assert.equal(frostBoomCard.cat, '【 陰陽符變異 】');
  assert.equal(frostBoomCard.levelText, '◆ 陰陽符變異');
  assert.equal(frostBoomCard.requirementText, '持有陰陽符（取得天狐靈針後亦適用）');
  assert.ok(frostBoomCard.limitText.includes('取得其他適用技能後沿用'));
  assert.ok(frostBoomCard.d.includes('每次施放') || !frostBoomCard.d.includes('cast'), '不含內部術語 cast');

  // 4. Both owned: 同時持有靈針與陰陽符
  probe.getWL().needle = 1;
  probe.getWL().boom = 1;
  let frostBothCard = null;
  for (let i = 0; i < 30 && !frostBothCard; i++) {
    const choices = probe.getEligibleChoices();
    frostBothCard = choices.find(c => c.id === 'mut_frost');
  }
  assert.ok(frostBothCard, '同時持有兩技能時 mut_frost 必須出現在候選池');
  assert.equal(frostBothCard.choiceId, 'mutation:needle:mut_frost');
  assert.deepEqual(Array.from(frostBothCard.skillIds), ['needle', 'boom'], 'skillIds 包含兩技能');
  assert.equal(frostBothCard.n, '冰魄封靈', '同時持有時名稱為 冰魄封靈');
  assert.equal(frostBothCard.cat, '【 共享變異 】');
  assert.equal(frostBothCard.levelText, '◆ 共享變異');
  assert.equal(frostBothCard.requirementText, '持有天狐靈針或陰陽符（同時生效，後續取得亦適用）');
  assert.ok(frostBothCard.limitText.includes('取得其他適用技能後沿用'));

  // 5. 已有 mut_frost 全局去重：不再重複出卡
  probe.setBuildMutations(['mut_frost']);
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_frost'), '已持有 mut_frost 時絕不重複出卡');
  }
  probe.setBuildMutations([]);

  // 6. 容量阻擋：若兩技能皆持有，其中一方滿 3 槽（例如 needle 滿 3 變異），則 mut_frost 必須被阻擋
  probe.getWL().needle = 1;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_pierce']); // needle 3/3 滿槽
  for (let i = 0; i < 10; i++) {
    const choices = probe.getEligibleChoices();
    assert.ok(choices.every(c => c.id !== 'mut_frost'), 'needle 滿 3 變異時，共享卡 mut_frost 必須被阻擋進池，不得讓 needle 超額');
  }
  assert.equal(probe.addMutation('mut_frost'), false, 'addMutation 亦必須阻擋滿槽技能超額');
});

// ── 60. resolveAttackSpec boom Lv1–5 原型數值快照、基線保持、零額外增傷／範圍與門檻參數 ────
test('M1-D-60 resolveAttackSpec boom Lv1-5 frost prototype numerical fidelity, baseline preservation, zero extra damage/radius, and frost threshold parameters', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  const expectedBaseCounts = [1, 2, 3, 4, 2];
  const expectedCds        = [1.76, 1.52, 1.28, 1.04, 1.6];
  const expectedRadii      = [78, 92, 108, 122, 135];
  const expectedSpreads    = [0.32, 0.32, 0.32, 0.28, 0.28];

  for (let lvl = 1; lvl <= 5; lvl++) {
    const baseSpec  = probe.resolveAttackSpec('boom', lvl, { mutations: [] });
    const frostSpec = probe.resolveAttackSpec('boom', lvl, { mutations: ['mut_frost'] });

    // 1. 基線特性保持：不加傷、不擴半徑、不改數量、冷卻、初速、壽命、保險絲、散佈角、擊退
    assert.equal(frostSpec.skillId, 'boom');
    assert.equal(frostSpec.level, lvl);
    assert.equal(frostSpec.isAwakened, lvl === 5);
    assert.equal(frostSpec.source, 'mutation');
    assert.equal(frostSpec.baseCount, expectedBaseCounts[lvl - 1]);
    assert.equal(frostSpec.count, expectedBaseCounts[lvl - 1]);
    assert.equal(frostSpec.cooldown, expectedCds[lvl - 1]);
    assert.equal(frostSpec.speed, 880);
    assert.equal(frostSpec.life, 1.4);
    assert.equal(frostSpec.fuse, 1.5);
    assert.equal(frostSpec.spread, expectedSpreads[lvl - 1]);
    assert.equal(frostSpec.radius, expectedRadii[lvl - 1]);
    assert.equal(frostSpec.knockback, 72);
    assert.equal(frostSpec.damage, baseSpec.damage, `Lv${lvl} 嚴禁新增主爆傷害`);
    assert.equal(frostSpec.splashDamage, baseSpec.splashDamage, `Lv${lvl} 嚴禁新增濺射傷害`);

    // 2. 冰魄參數快照
    assert.equal(frostSpec.hasFrost, true);
    assert.equal(frostSpec.frost, true);
    assert.equal(frostSpec.frostThreshold, 1, '普通怪 1 次門檻');
    assert.equal(frostSpec.bossFrostThreshold, 3, 'Boss 3 次門檻');
  }

  // 3. 多重 b.dmg 下傷害零額外膨脹
  for (const testDmg of [1.0, 1.2, 1.8]) {
    probe.getB().dmg = testDmg;
    for (let lvl = 1; lvl <= 5; lvl++) {
      const bSpec = probe.resolveAttackSpec('boom', lvl, { mutations: [] });
      const fSpec = probe.resolveAttackSpec('boom', lvl, { mutations: ['mut_frost'] });
      assert.equal(fSpec.damage, bSpec.damage);
      assert.equal(fSpec.splashDamage, bSpec.splashDamage);
      assert.equal(fSpec.radius, bSpec.radius);
    }
  }
});

// ── 61. 真 boom consumer：普通敵 1 次凍 0.5s、盾／死敵免疫、濺射累寒與次爆零累寒 ────
test('M1-D-61 Real boom consumer: normal enemy 1-hit freeze (0.5s), dead/shielded enemy immunity, splash freezing, and secondary splitblast zero frost accumulation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_frost']);
  probe.getP().x = 100;
  probe.getP().y = 200;

  // 1. 普通敵 1 次直擊主爆凍結 0.5s
  const enemy = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemy]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);

  const proj = probe.getProj()[0];
  assert.ok(proj, '生成符咒');
  assert.equal(proj.frost, true, '快照 frost: true');

  // 步進至黏附引爆
  let exploded = false;
  let steps = 0;
  while (!exploded && steps < 50) {
    probe.weapons(0.05);
    steps++;
    if (proj.exploded) exploded = true;
  }
  assert.ok(exploded, '符咒引爆');
  assert.ok(enemy.hp < 100, '敵人承受主爆傷害');
  assert.equal(enemy.freezeT, 0.5, '普通怪受傷後立即冰凍 0.5 秒');
  assert.equal(enemy.freezeReady, enemy.freezeEnds + 1.5, 'freezeReady 為觸發後 2.0 秒 (0.5 + 1.5)');
  assert.equal(enemy.shatterVolley, undefined, '陰陽符絕不產生 needle 碎冰預算');

  // 2. 死敵防護：hp <= 0 之敵人絕不被凍結或累寒
  const deadEnemy = { x: 250, y: 200, hp: 0, max: 100, type: 'ghost' };
  probe.setEnemies([deadEnemy]);
  probe.explodeTalisman({ x: 250, y: 200, radius: 80, damage: 2, splashDamage: 0.4, frost: true, target: deadEnemy });
  assert.equal(deadEnemy.freezeT, undefined, '死敵不累積凍結');
  assert.equal(deadEnemy.frostHits, undefined);

  // 3. 護盾防護：shield: true 免疫傷害且不被凍結
  const shieldEnemy = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost', shield: true };
  probe.setEnemies([shieldEnemy]);
  probe.explodeTalisman({ x: 250, y: 200, radius: 80, damage: 2, splashDamage: 0.4, frost: true, target: shieldEnemy });
  assert.equal(shieldEnemy.hp, 100, '護盾怪免傷');
  assert.equal(shieldEnemy.freezeT, undefined, '護盾怪不累積凍結');
  assert.equal(shieldEnemy.frostHits, undefined);

  // 4. 濺射累寒：主目標與濺射目標同受冰封
  const primTarget = { x: 200, y: 200, hp: 100, max: 100, type: 'ghost' };
  const splashTarget = { x: 240, y: 200, hp: 100, max: 100, type: 'ghost' }; // 距離 40 <= radius 78
  probe.setEnemies([primTarget, splashTarget]);
  probe.explodeTalisman({ x: 200, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: primTarget });
  assert.equal(primTarget.freezeT, 0.5, '主目標受直擊冰凍');
  assert.equal(splashTarget.freezeT, 0.5, '濺射目標受濺射傷並冰凍');

  // 5. 次爆零累寒：次爆觸發時 Deal damage 但絕不調用 applyFrost
  const testSubEnemy = { x: 100, y: 100, hp: 100, max: 100, type: 'ghost', frostHits: 1 };
  probe.setEnemies([testSubEnemy]);
  probe.setSplitblasts([{
    x: 100, y: 100, delay: 0.01, radius: 40, directDamage: 0.66, splashDamage: 0.132,
    primaryTarget: testSubEnemy, level: 1, hits: new Set(), triggered: false
  }]);
  probe.weapons(0.02); // 觸發次爆
  assert.ok(testSubEnemy.hp < 100, '次爆造成傷害');
  assert.equal(testSubEnemy.frostHits, 1, '次爆絕不增加 frostHits 累寒計數');
  assert.equal(testSubEnemy.freezeT, undefined, '次爆絕不造成凍結');
});

// ── 62. Boss 3 次門檻、0.15s 凍結與真 update(dt) 2.0s 免疫推進（無永久封印、fan 多符上限）────
test('M1-D-62 Boss 3-hit threshold, 0.15s freeze, and real update(dt) 2.0s immunity progression (no permanent stun, fan multi-talisman control cap)', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations(['mut_frost']);
  probe.getP().x = 100;
  probe.getP().y = 200;

  const boss = { x: 250, y: 200, hp: 500, max: 500, type: 'boss' };
  probe.setEnemies([boss]);

  // 1. 第 1 次主爆：Boss 累積 1 次寒冷，不凍結
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 1, '第 1 次命中累積 frostHits = 1');
  assert.equal(boss.freezeT, undefined, '未達 3 次門檻，不凍結');

  // 2. 第 2 次主爆：Boss 累積 2 次寒冷，不凍結
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 2, '第 2 次命中累積 frostHits = 2');
  assert.equal(boss.freezeT, undefined, '未達 3 次門檻，不凍結');

  // 3. 第 3 次主爆：Boss 達到 3 次門檻，凍結 0.15 秒，frostHits 重置為 0
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 0, '觸發凍結後 frostHits 重置為 0');
  assert.equal(boss.freezeT, 0.15, 'Boss 僅凍結 0.15 秒');
  const freezeReadyTime = boss.freezeReady;
  assert.ok(freezeReadyTime > 0, '已設定 freezeReady');

  // 4. 凍結期間 (freezeT > 0) 再次受擊：不重置凍結時間，不累計次數
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 0, '凍結中受擊不累計寒冷');
  assert.equal(boss.freezeT, 0.15, '凍結中受擊不重置凍結時長');

  // 5. 使用真 update(dt) 時間步進解凍並進入 2.0s 免疫期
  // 步進 4 步 0.05s（累計 0.20s > 0.15s）
  probe.update(0.05);
  probe.update(0.05);
  probe.update(0.05);
  probe.update(0.05);
  assert.equal(boss.freezeT, 0, '0.20s 後 Boss 凍結狀態自然解除 (非手改 freezeT)');

  // 6. 免疫期內（freezeReady 尚未到達）：受擊造成傷害，但絕不累計寒冷，絕不觸發凍結
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 0, '2 秒免疫期內受擊不累計寒冷');
  assert.equal(boss.freezeT, 0, '2 秒免疫期內絕不觸發凍結');

  // 7. 使用真 update(dt) 推進時間跨越 2.0s 免疫期（40 步 0.05s = 2.0s）
  for (let s = 0; s < 40; s++) {
    probe.update(0.05);
  }

  // 8. 免疫期過後，可再次累積寒冷
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 1, '免疫期過後第 1 次受擊重新累積 frostHits = 1');
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 2, '第 2 次受擊 frostHits = 2');
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 2, splashDamage: 0.4, frost: true, target: boss });
  assert.equal(boss.frostHits, 0, '第 3 次受擊再度冰封');
  assert.equal(boss.freezeT, 0.15, '再度冰封 0.15 秒');

  // 9. Fan 多符同批命中上限：mut_fan 3 符同時爆炸，Boss 頂多被凍結一次 (0.15s)，絕無重疊延長
  probe.setBuildMutations(['mut_fan', 'mut_frost']);
  boss.frostHits = 0;
  boss.freezeT = 0;
  boss.freezeReady = 0; // 重置
  // 3 符同時爆炸
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 0.88, splashDamage: 0.176, frost: true, target: boss });
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 0.88, splashDamage: 0.176, frost: true, target: boss });
  probe.explodeTalisman({ x: 250, y: 200, radius: 78, damage: 0.88, splashDamage: 0.176, frost: true, target: boss });
  assert.equal(boss.freezeT, 0.15, '3 符同幀引爆，Boss 恰好觸發一次 0.15 秒凍結，絕不疊加');
});

// ── 63. 真選卡 offerUp -> applyChoice 取得 mut_frost、雙向武器繼承、3 共享滿槽與第 4 變異排除 ────
test('M1-D-63 Real offerUp -> applyChoice for mut_frost, bidirectional weapon learning inheritance, 3-shared mutation saturation (fan+seek+frost = 3/3), and 4th mutation exclusion', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 設置飽和被動保證抽卡確定性
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });

  // 1. Case A: 先持 boom 取 mut_frost，後真選卡習得 needle
  probe.getWL().katana = 1;
  probe.getWL().boom = 1;
  probe.getWL().needle = 0;
  probe.getWL().barrier = 0;
  probe.getWL().fire = 0;
  probe.getWL().thunder = 0;
  probe.setBuildMutations([]);

  let frostCardA = null;
  for (let attempt = 0; attempt < 25 && !frostCardA; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    frostCardA = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_frost');
  }
  assert.ok(frostCardA, 'boom-only 經真 offerUp 抽出 mut_frost');
  const applyA = probe.applyChoice(frostCardA.choiceId, probe.getBuildRevision());
  assert.equal(applyA.ok, true, '套用 mut_frost');

  // 後學 needle
  let needleCardA = null;
  for (let attempt = 0; attempt < 25 && !needleCardA; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    needleCardA = probe.getChoices().find(c => c.choiceId === 'weapon:needle:1');
  }
  assert.ok(needleCardA, '真 offerUp 抽出新武器天狐靈針');
  const applyNeedleA = probe.applyChoice(needleCardA.choiceId, probe.getBuildRevision());
  assert.equal(applyNeedleA.ok, true, '習得天狐靈針');
  assert.ok(Object.keys(probe.getWI()).filter(k => (probe.getWL()[k] || 0) > 0).length <= 4, '非五主動非法 fixture');

  // 驗證兩者均受 mut_frost 影響
  const needleSpecA = probe.resolveAttackSpec('needle', 1);
  const boomSpecA = probe.resolveAttackSpec('boom', 1);
  assert.equal(needleSpecA.frost, true, '後學靈針真繼承 frost');
  assert.equal(boomSpecA.frost, true, '陰陽符具備 frost');

  // 2. Case B: 先持 needle 取 mut_frost，後真選卡習得 boom
  probe.start('night-town');
  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });
  probe.getWL().katana = 1;
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  probe.setBuildMutations([]);

  let frostCardB = null;
  for (let attempt = 0; attempt < 25 && !frostCardB; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    frostCardB = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_frost');
  }
  assert.ok(frostCardB, 'needle-only 經真 offerUp 抽出 mut_frost');
  const applyB = probe.applyChoice(frostCardB.choiceId, probe.getBuildRevision());
  assert.equal(applyB.ok, true, '套用 mut_frost');

  let boomCardB = null;
  for (let attempt = 0; attempt < 25 && !boomCardB; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    boomCardB = probe.getChoices().find(c => c.choiceId === 'weapon:boom:1');
  }
  assert.ok(boomCardB, '真 offerUp 抽出新武器陰陽符');
  const applyBoomB = probe.applyChoice(boomCardB.choiceId, probe.getBuildRevision());
  assert.equal(applyBoomB.ok, true, '習得陰陽符');

  const boomSpecB = probe.resolveAttackSpec('boom', 1);
  assert.equal(boomSpecB.frost, true, '後學陰陽符真繼承 frost');

  // 3. 三共享滿槽 (fan + seek + frost = 3/3) 飽和與第 4 變異嚴格排除
  probe.getWL().katana = 0;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  assert.equal(probe.getSkillMutations('needle').length, 3, '靈針 3 槽全滿');
  assert.equal(probe.getSkillMutations('boom').length, 3, '陰陽符 3 槽全滿');

  // 驗證 needle 第 4 變異（mut_pierce, mut_return）完全被阻擋
  assert.equal(probe.addMutation('mut_pierce'), false, '滿 3 槽時 addMutation mut_pierce 拒絕');
  assert.equal(probe.addMutation('mut_return'), false, '滿 3 槽時 addMutation mut_return 拒絕');

  // 驗證 boom 第 4 變異（mut_splitblast）完全被阻擋
  assert.equal(probe.addMutation('mut_splitblast'), false, '滿 3 槽時 addMutation mut_splitblast 拒絕');

  // 候選池中絕對不出現任何第 4 變異卡
  for (let i = 0; i < 15; i++) {
    const choices = probe.getEligibleChoices();
    const mutationChoices = choices.filter(c => c.type === 'mutation');
    assert.equal(mutationChoices.length, 0, '兩技能 3 槽全滿時，候選池絕對不出現第 4 變異卡');
  }

  // 4. 後學技能直接繼承 3 槽滿額驗證
  probe.start('night-town');
  probe.getWL().katana = 1;
  probe.getWL().needle = 1;
  probe.getWL().boom = 0;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  // 直接習得 boom
  probe.getWL().boom = 1;
  assert.equal(probe.getSkillMutations('boom').length, 3, '後學陰陽符直接繼承 3 個共享變異 (3/3 滿槽)');
  assert.equal(probe.addMutation('mut_splitblast'), false, '直接繼承 3 槽後，boom 亦不得再添加第 4 變異');
});

// ── 64. 飛行／黏附途中升級快照隔離、凍結與清理、靈針 Lv5 保護 ────
test('M1-D-64 In-flight talisman snapshot isolation against mut_frost acquisition, sticking talisman protection, pause/levelup freeze, and needle Lv5 awakened regression protection', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.setBuildCharms(['charm_step', 'charm_gather', 'charm_guard']);
  Object.assign(probe.getB(), { shield: 6, oilRegen: 0.12, heals: 3, rate: 4, crit: 3, spd: 3, dash: 3, mag: 3, dmgUp: 4 });

  probe.getWL().katana = 0;
  probe.getWL().boom = 1;
  probe.setBuildMutations([]); // 初始未持有 mut_frost

  probe.getP().x = 100;
  probe.getP().y = 200;
  const enemy = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemy]);

  // 1. 發射初始未帶 frost 之符咒
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  assert.equal(probe.getProj().length, 1);
  const oldTalisman = probe.getProj()[0];
  assert.equal(oldTalisman.frost, false, '初發符咒不具 frost');

  // 飛行中推進 0.05s
  probe.weapons(0.05);

  // 飛行途中：真選卡取得 mut_frost
  let frostCard = null;
  for (let attempt = 0; attempt < 25 && !frostCard; attempt++) {
    probe.setXp(100);
    probe.setState('play');
    probe.offerUp();
    probe.setLevelupCooldown(0);
    frostCard = probe.getChoices().find(c => c.choiceId === 'mutation:needle:mut_frost');
  }
  assert.ok(frostCard, '抽出 mut_frost');
  const applyRes = probe.applyChoice(frostCard.choiceId, probe.getBuildRevision());
  assert.equal(applyRes.ok, true, '套用 mut_frost');

  // 飛行中舊符快照隔離：絕不追溯獲得 frost
  assert.equal(oldTalisman.frost, false, '飛行中舊符絕不回寫 frost');

  // 步進至舊符引爆：敵人受傷但絕不被凍結
  let oldExploded = false;
  let steps = 0;
  while (!oldExploded && steps < 50) {
    probe.weapons(0.05);
    steps++;
    if (oldTalisman.exploded) oldExploded = true;
  }
  assert.ok(oldExploded, '舊符成功引爆');
  assert.equal(enemy.freezeT, undefined, '舊符爆炸絕不造成凍結');

  // 2. 升級後發射全新符咒：正確獲得 frost 快照並造成冰凍
  const enemy2 = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemy2]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const newTalisman = probe.getProj().find(p => p !== oldTalisman);
  assert.ok(newTalisman, '發射新符咒');
  assert.equal(newTalisman.frost, true, '新符咒生效 frost 快照');

  // 步進至新符引爆：enemy2 必須被凍結
  let newExploded = false;
  let nSteps = 0;
  while (!newExploded && nSteps < 50) {
    probe.weapons(0.05);
    nSteps++;
    if (newTalisman.exploded) newExploded = true;
  }
  assert.ok(newExploded, '新符引爆');
  assert.equal(enemy2.freezeT, 0.5, '新符引爆正確冰凍普通怪 0.5 秒');

  // 3. 黏附途中升級快照隔離
  probe.setBuildMutations([]); // 移除 frost
  const enemyStuck = { x: 250, y: 200, hp: 100, max: 100, type: 'ghost' };
  probe.setEnemies([enemyStuck]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.setWT('boom', 999);
  const stuckProj = probe.getProj().find(p => !p.exploded);
  assert.equal(stuckProj.frost, false);
  // 自然黏附
  let isStuck = false;
  let sSteps = 0;
  while (!isStuck && sSteps < 30) {
    probe.weapons(0.05);
    sSteps++;
    if (stuckProj.stuck) isStuck = true;
  }
  assert.ok(isStuck, '符咒已黏附');
  // 黏附期間取得 mut_frost
  probe.setBuildMutations(['mut_frost']);
  assert.equal(stuckProj.frost, false, '黏附中符咒絕不回寫 frost');

  // 4. 生命週期與凍結驗證
  probe.setState('pause');
  const enemyFreezeBefore = enemy2.freezeT;
  probe.update(0.1);
  assert.equal(enemy2.freezeT, enemyFreezeBefore, 'pause 狀態下 update 凍結物理與引信');
  probe.setState('play');

  probe.loseRun();
  assert.equal(probe.getProj().length, 0, 'loseRun 清空所有符咒');

  // 5. 天狐靈針 Lv5 覺醒冰靈暴與現役追蹤完整回歸防護
  probe.start('night-town');
  probe.getWL().needle = 5;
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost']);
  const needleLv5Spec = probe.resolveAttackSpec('needle', 5);
  assert.equal(needleLv5Spec.isAwakened, true);
  assert.equal(needleLv5Spec.tracking, true);
  assert.equal(needleLv5Spec.frost, true);
  assert.equal(needleLv5Spec.count, 11, '8 原生 + 3 fan = 11');

  probe.getNeedles().length = 0;
  probe.setWT('needle', 0);
  probe.weapons(0.001);
  assert.equal(probe.getNeedles().length, 11, '生成 11 枚靈針');
  for (const nd of probe.getNeedles()) {
    assert.equal(nd.tracking, true, '每枚靈針均具備追蹤');
    assert.equal(nd.frost, true, '每枚靈針均具備冰魄');
  }
});

// ── 65. Duo 雷紋陣卡池資格、動態卡片契約、單局去重與槽位獨立 ────────
test('M1-D-65 Duo thundercircle pool eligibility, card presentation, deduplication, and slot independence', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 缺任一技能或等級未達 Lv3 均不得入池
  probe.getWL().barrier = 0;
  probe.getWL().thunder = 3;
  let duoChoices = probe.getEligibleChoices().filter(c => c.type === 'duo');
  assert.equal(duoChoices.length, 0, '未持有 barrier 時 duo 不得入池');

  probe.getWL().barrier = 3;
  probe.getWL().thunder = 0;
  duoChoices = probe.getEligibleChoices().filter(c => c.type === 'duo');
  assert.equal(duoChoices.length, 0, '未持有 thunder 時 duo 不得入池');

  probe.getWL().barrier = 2;
  probe.getWL().thunder = 3;
  duoChoices = probe.getEligibleChoices().filter(c => c.type === 'duo');
  assert.equal(duoChoices.length, 0, 'barrier Lv2 時 duo 不得入池');

  probe.getWL().barrier = 3;
  probe.getWL().thunder = 2;
  duoChoices = probe.getEligibleChoices().filter(c => c.type === 'duo');
  assert.equal(duoChoices.length, 0, 'thunder Lv2 時 duo 不得入池');

  // 2. 未達標 pair（boom Lv2）不得入池
  probe.getWL().fire = 3;
  probe.getWL().boom = 2;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_cinderseal');
  assert.equal(duoChoices.length, 0, '未達標的 duo_cinderseal 不得入池');
  probe.getWL().fire = 0;
  probe.getWL().boom = 0;

  // 3. barrier+thunder 均 Lv3+：合法入池
  probe.getWL().barrier = 3;
  probe.getWL().thunder = 3;
  let duoCard = null;
  for (let i = 0; i < 20 && !duoCard; i++) {
    const choices = probe.getEligibleChoices();
    duoCard = choices.find(c => c.id === 'duo_thundercircle');
  }
  assert.ok(duoCard, '兩技能均 Lv3+ 時雷紋陣合法入池');
  const card = duoCard;
  assert.equal(card.id, 'duo_thundercircle');
  assert.equal(card.choiceId, 'duo:duo_thundercircle');
  assert.equal(card.type, 'duo');
  assert.equal(card.n, '雷紋陣');
  assert.equal(card.s, 'らいもんじん');
  assert.equal(card.cat, '【 共鳴奧義 】');
  assert.equal(card.levelText, '◆ 共鳴奧義');
  assert.equal(card.rarity, 'duo');
  assert.deepStrictEqual(Array.from(card.skillIds), ['barrier', 'thunder']);
  assert.equal(card.requirementText, '持有淨化靈陣 Lv3+ 與 天狐雷 Lv3+');
  assert.ok(card.limitText.includes('每局限選一次') && card.limitText.includes('不占主動、御守、變異槽位'), '限制描述完整');
  assert.ok(typeof card.beforeText === 'string' && card.beforeText.length > 0, 'beforeText 必須為非空字串');
  assert.ok(typeof card.afterText === 'string' && card.afterText.length > 0, 'afterText 必須為非空字串');
  assert.equal(card.beforeText, '落雷', 'beforeText 為落雷');
  assert.equal(card.afterText, '墨紋衝擊', 'afterText 為墨紋衝擊');
  assert.ok(card.d.includes('延遲 0.12 秒') && card.d.includes('半徑 64') && card.d.includes('20%'), '描述包含精確數值');

  // 4. 單局去重：已持有 duo_thundercircle 後不再入池
  probe.getBuildDuos().push('duo_thundercircle');
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_thundercircle');
  assert.equal(duoChoices.length, 0, '已選過後不可再次入池');

  // 5. 槽位獨立：不占主動、御守、變異槽位
  assert.equal(probe.getBuildCharms().length, 0, 'Duo 不占用御守槽');
  assert.equal(probe.getSkillMutations('barrier').length, 0, 'Duo 不占用 barrier 變異槽');
  assert.equal(probe.getSkillMutations('thunder').length, 0, 'Duo 不占用 thunder 變異槽');
});

// ── 66. 真選卡 offerUp -> applyChoice 取得 Duo、XP/revision 與連按防護 ──
test('M1-D-66 Real offerUp -> applyChoice for duo_thundercircle, XP/revision, stale revision guard, and reroll invalidation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 設置 4 主動全 Lv4（無印記不能覺醒）、滿 3 御守、變異全滿，使全庫非被動候選唯有 duo:duo_thundercircle
  probe.getWL().katana = 4;
  probe.getWL().barrier = 4;
  probe.getWL().thunder = 4;
  probe.getWL().fire = 4;
  probe.setSeals(0);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_orbit']);
  probe.setBuildDuos(['duo_inkfire']);
  probe.setXp(100);

  probe.offerUp();
  probe.setLevelupCooldown(0);
  const choices = probe.getChoices();
  const duoCard = choices.find(c => c.choiceId === 'duo:duo_thundercircle');
  assert.ok(duoCard, '真 offerUp 抽出雷紋陣');
  assert.equal(duoCard.beforeText, '落雷', '真 offerUp 卡片具備非空 beforeText');
  assert.equal(duoCard.afterText, '墨紋衝擊', '真 offerUp 卡片具備非空 afterText');

  const oldRev = probe.getBuildRevision();
  const xpBefore = probe.getXp();
  const req = probe.getXpNeed();

  // 1. 真 applyChoice
  const res = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(res.ok, true, '合法選卡成功');
  assert.equal(probe.getBuildState().duos.includes('duo_thundercircle'), true, 'BuildState.duos 正確包含雷紋陣');
  assert.equal(probe.getXp(), Math.max(0, xpBefore - req), '正確扣除 XP');
  assert.ok(probe.getBuildRevision() > oldRev, 'buildRevision 遞增');

  // 2. 過期 revision 拒絕
  const staleRes = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'not_in_levelup');

  // 3. 連按／已消耗防護
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  const doubleClickRes = probe.applyChoice(duoCard.choiceId, probe.getBuildRevision());
  assert.equal(doubleClickRes.ok, false, '已消費卡片不可二次套用');
  assert.equal(doubleClickRes.reason, 'ineligible');

  // 4. 重抽使舊卡完全失效
  probe.start('night-town');
  probe.getWL().katana = 4;
  probe.getWL().barrier = 4;
  probe.getWL().thunder = 4;
  probe.getWL().fire = 4;
  probe.setSeals(0);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_branch', 'mut_orbit']);
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const revBeforeReroll = probe.getBuildRevision();
  const choicesBeforeReroll = probe.getChoices();
  const duoBeforeReroll = choicesBeforeReroll.find(c => c.choiceId === 'duo:duo_thundercircle');

  probe.reroll();
  probe.setLevelupCooldown(0);
  assert.ok(probe.getBuildRevision() > revBeforeReroll, 'reroll 推進 buildRevision');

  if (duoBeforeReroll) {
    const rerollReject = probe.applyChoice(duoBeforeReroll.choiceId, revBeforeReroll);
    assert.equal(rerollReject.ok, false);
    assert.equal(rerollReject.reason, 'stale_revision');
  }
});

// ── 67. 真雷 consumer 陣內外判定、實傷門檻、盾死敵與 mut_pulse 半徑聯動 ────
test('M1-D-67 Real thunder consumer inside/outside barrier, actual damage requirement, shielded/dead enemies, and pulse radius linkage', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().barrier = 3;
  probe.getWL().thunder = 3;
  probe.setBuildDuos(['duo_thundercircle']);

  // barrier Lv3 radius = Math.round(140 + 3*28) = 224
  const barrierSpec = probe.resolveAttackSpec('barrier', 3);
  assert.equal(barrierSpec.radius, 224, 'barrier Lv3 半徑為 224');

  // 1. 陣內命中造成實傷：合格並排入衝擊佇列
  const enemyInside = { x: 200, y: 100, hp: 50, maxHp: 50, type: 'normal' }; // dist = 100 <= 224
  probe.getEnemies().push(enemyInside);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.ok(enemyInside.hp < 50, '陣內敵人受主雷傷害');
  assert.equal(probe.getDuoShockwaves().length, 1, '陣內實傷合格，排入衝擊佇列');
  const sw = probe.getDuoShockwaves()[0];
  assert.equal(sw.x, 200);
  assert.equal(sw.y, 100);
  assert.equal(sw.radius, 64);
  assert.equal(sw.delay, 0.12);
  const thunderSpec = probe.resolveAttackSpec('thunder', 3);
  const expectedBudget = Number((thunderSpec.damage * 0.20).toFixed(4));
  assert.equal(sw.damageBudget, expectedBudget, '衝擊傷害預算為非暴擊雷基傷 20%');

  // 2. 陣外命中造成實傷：不觸發衝擊
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  const enemyOutside = { x: 400, y: 100, hp: 50, maxHp: 50, type: 'normal' }; // dist = 300 > 224
  probe.getEnemies().push(enemyOutside);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.ok(enemyOutside.hp < 50, '陣外敵人受主雷傷害');
  assert.equal(probe.getDuoShockwaves().length, 0, '陣外命中不得觸發雷紋陣衝擊');

  // 3. 陣內命中護盾敵人：無實傷，不觸發衝擊
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  const enemyShielded = { x: 180, y: 100, hp: 50, maxHp: 50, shield: true, type: 'tank' }; // dist = 80 <= 224
  probe.getEnemies().push(enemyShielded);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.equal(enemyShielded.hp, 50, '護盾怪血量不扣');
  assert.equal(probe.getDuoShockwaves().length, 0, '護盾敵無實傷，不觸發衝擊');

  // 4. mut_pulse 靈陣連環脈衝使陣半徑縮小為 85%（224 * 0.85 = 190）
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  probe.setBuildMutations(['mut_pulse']);
  const pulseBarrierSpec = probe.resolveAttackSpec('barrier', 3);
  assert.equal(pulseBarrierSpec.radius, 190, 'mut_pulse barrier 半徑縮為 190');

  // 位於 205 處（原 224 內，但脈衝 190 外）
  const enemyBetween = { x: 305, y: 100, hp: 50, maxHp: 50, type: 'normal' }; // dist = 205
  probe.getEnemies().push(enemyBetween);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.ok(enemyBetween.hp < 50, '敵人受主雷傷害');
  assert.equal(probe.getDuoShockwaves().length, 0, '脈衝縮圈後，205 位於陣外，不觸發衝擊');

  // 5. 反例 A：已離場敵（vanish: 1 或 done: true）不得作為主雷目標或雷紋陣合格觸發
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  probe.setBuildMutations([]);
  probe.setWT('thunder', 0);
  probe.setWT('barrier', 999);
  probe.setWT('katana', 999);
  probe.setWT('needle', 999);
  probe.setWT('fire', 999);
  probe.setWT('boom', 999);
  const vanishedFoe = { x: 180, y: 100, hp: 100, maxHp: 100, vanish: 1, type: 'normal' };
  const doneFoe = { x: 190, y: 100, hp: 100, maxHp: 100, done: true, type: 'normal' };
  probe.getEnemies().push(vanishedFoe, doneFoe);
  probe.weapons(0.001);

  assert.equal(vanishedFoe.hp, 100, 'vanished 敵人不得被主雷扣血');
  assert.equal(doneFoe.hp, 100, 'done 敵人不得被主雷扣血');
  assert.equal(probe.getDuoShockwaves().length, 0, '離場敵人不得觸發雷紋陣衝擊');
});

// ── 68. 單 cast 衝擊上限 1 次、Lv4/Lv5 多目標與 mut_branch 分支禁止觸發 ───
test('M1-D-68 Single shockwave per cast limit, Lv4/Lv5 multi-target handling, and branch prohibition', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().barrier = 3;
  probe.getWL().thunder = 4;
  probe.setBuildDuos(['duo_thundercircle']);

  // 1. Lv4 鎖定 3 威脅，陣內同時命中 3 敵：至多首次合格點產生 1 個衝擊
  const e1 = { x: 150, y: 100, hp: 60, maxHp: 60, type: 'shooter' };
  const e2 = { x: 170, y: 100, hp: 60, maxHp: 60, type: 'tank' };
  const e3 = { x: 190, y: 100, hp: 60, maxHp: 60, type: 'normal' };
  probe.getEnemies().push(e1, e2, e3);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.ok(e1.hp < 60 && e2.hp < 60 && e3.hp < 60, '3 敵均受主雷實傷');
  assert.equal(probe.getDuoShockwaves().length, 1, '多主目標命中，整 cast 至多首次合格點 1 個衝擊');
  assert.equal(probe.getDuoShockwaves()[0].x, e1.x, '衝擊錨定於首次合格命中點');

  // 2. Lv5 覺醒三雷雲多敵命中：合計仍僅產生 1 個衝擊
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  probe.getWL().thunder = 5;
  const f1 = { x: 140, y: 100, hp: 100, maxHp: 100, type: 'shooter' };
  const f2 = { x: 160, y: 100, hp: 100, maxHp: 100, type: 'tank' };
  const f3 = { x: 180, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.getEnemies().push(f1, f2, f3);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.equal(probe.getDuoShockwaves().length, 1, 'Lv5 覺醒三朵雷雲多敵命中，整 cast 依然僅產生 1 個衝擊');

  // 3. mut_branch 分支雷擊禁止觸發雷紋陣
  // 設置 3 隻陣外 shooter（threat=1 優先佔滿 3 個主目標，在陣外實傷不觸發），而陣內 normal 敵怪僅被連鎖分支命中
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  probe.getWL().thunder = 4;
  probe.setBuildMutations(['mut_branch']);

  // barrier Lv3 radius = 224; thunder Lv4 radius = 450, targetCount = 3, branchRadius = 180
  const s1 = { x: 360, y: 100, hp: 80, maxHp: 80, type: 'shooter' }; // dist = 260 > 224
  const s2 = { x: 370, y: 100, hp: 80, maxHp: 80, type: 'shooter' }; // dist = 270 > 224
  const s3 = { x: 380, y: 100, hp: 80, maxHp: 80, type: 'shooter' }; // dist = 280 > 224
  const branchIn = { x: 210, y: 100, hp: 80, maxHp: 80, type: 'normal' }; // dist = 110 <= 224 (在陣內), dist(s1, branchIn) = 150 <= 180
  probe.getEnemies().push(s1, s2, s3, branchIn);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.ok(s1.hp < 80 && s2.hp < 80 && s3.hp < 80, '陣外 3 隻主目標受主雷實傷');
  assert.ok(branchIn.hp < 80, '陣內分支目標受連鎖雷擊實傷');
  assert.equal(probe.getDuoShockwaves().length, 0, 'branch 命中在陣內亦絕對不得觸發雷紋陣衝擊');
});

// ── 69. 衝擊時序（0.12s）、出生前 dt 不扣、佇列上限 16 與分攤傷害預算 ───
test('M1-D-69 Shockwave timing (0.12s), birth dt not deducted, queue cap 16, and damage budget distribution', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().barrier = 3;
  probe.getWL().thunder = 3;
  probe.setBuildDuos(['duo_thundercircle']);

  const thunderSpec = probe.resolveAttackSpec('thunder', 3);
  const totalBudget = Number((thunderSpec.damage * 0.20).toFixed(4));

  // 1. 出生前 dt 不扣驗證
  const mainTarget = { x: 180, y: 100, hp: 200, maxHp: 200, type: 'normal' };
  probe.getEnemies().push(mainTarget);
  probe.setWT('thunder', 0);
  probe.weapons(0.05); // 0.05 步長發動雷擊

  assert.equal(probe.getDuoShockwaves().length, 1);
  const queuedSw = probe.getDuoShockwaves()[0];
  assert.equal(queuedSw.delay, 0.12, '新衝擊出生當幀 delay 必須保持 0.12，不得扣出生前 dt');

  // 2. 時序步進：.05 步進驗證
  // 放入 2 隻旁觀敵怪在衝擊半徑 64 內（center = 180, 100）
  const sub1 = { x: 190, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const sub2 = { x: 200, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  probe.getEnemies().push(sub1, sub2);

  // 第 1 步 (+0.05, 累計 0.05s, 剩餘 0.07s)
  probe.weapons(0.05);
  assert.equal(Number(queuedSw.delay.toFixed(2)), 0.07);
  assert.equal(sub1.hp, 50, '未達 0.12s 前不得扣血');

  // 第 2 步 (+0.05, 累計 0.10s, 剩餘 0.02s)
  probe.weapons(0.05);
  assert.equal(Number(queuedSw.delay.toFixed(2)), 0.02);
  assert.equal(sub1.hp, 50, '0.10s 仍未達 0.12s，不得扣血');

  // 第 3 步 (+0.05, 累計 0.15s >= 0.12s)
  probe.weapons(0.05);
  assert.equal(probe.getDuoShockwaves().length, 0, '達到延遲後觸發並自佇列移除');

  // 3. 傷害預算分攤驗證：3 敵有效命中（mainTarget, sub1, sub2）
  const expectedPerTarget = Number((totalBudget / 3).toFixed(4));
  assert.equal(Number((50 - sub1.hp).toFixed(4)), expectedPerTarget, 'sub1 承受正確分攤傷害');
  assert.equal(Number((50 - sub2.hp).toFixed(4)), expectedPerTarget, 'sub2 承受正確分攤傷害');

  // 4. 佇列硬上限 16
  probe.getDuoShockwaves().length = 0;
  for (let i = 0; i < 16; i++) {
    probe.getDuoShockwaves().push({
      x: 100, y: 100, radius: 64, delay: 5.0, damageBudget: 1.0, triggered: false, level: 3
    });
  }
  assert.equal(probe.getDuoShockwaves().length, 16);

  // 再次發動雷擊命中
  probe.setWT('thunder', 0);
  const hpBeforeFull = mainTarget.hp;
  probe.weapons(0.001);
  assert.ok(mainTarget.hp < hpBeforeFull, '主雷依然正常命中扣血');
  assert.equal(probe.getDuoShockwaves().length, 16, '滿額 16 時略過新衝擊，佇列不上溢');

  // 5. 反例 B：衝擊結算時排除離場敵（vanish/done），不占 3 目標名額並正確分攤預算
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  // 真主雷先對 180,100 活敵發射產 1 個衝擊（budget = 1.08, delay = 0.12）
  const liveInitial = { x: 180, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.getEnemies().push(liveInitial);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);
  assert.equal(probe.getDuoShockwaves().length, 1);
  const queuedB = probe.getDuoShockwaves()[0];
  assert.equal(queuedB.damageBudget, 1.08);

  // 保持其他 wT 冷卻，更換同圈內敵人陣列包含離場敵與 4 隻活敵
  const v1 = { x: 185, y: 100, hp: 50, maxHp: 50, vanish: 1, type: 'normal' };
  const d1 = { x: 190, y: 100, hp: 50, maxHp: 50, done: true, type: 'normal' };
  const lA = { x: 195, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const lB = { x: 200, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const lC = { x: 205, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const lD = { x: 210, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  probe.setEnemies([v1, d1, lA, lB, lC, lD]);

  // 保持其他武器冷卻，weapons(0.13) 觸發衝擊
  probe.setWT('thunder', 999);
  probe.setWT('barrier', 999);
  probe.setWT('katana', 999);
  probe.setWT('needle', 999);
  probe.setWT('fire', 999);
  probe.setWT('boom', 999);
  probe.weapons(0.13);

  const losses = [v1, d1, lA, lB, lC, lD].map(e => Number((50 - e.hp).toFixed(4)));
  assert.equal(losses[0], 0, 'vanish 敵怪不受傷害且不占名額');
  assert.equal(losses[1], 0, 'done 敵怪不受傷害且不占名額');
  assert.ok(Math.abs(losses[2] - 0.36) < 1e-4, '活敵 A 獲得 1/3 預算');
  assert.ok(Math.abs(losses[3] - 0.36) < 1e-4, '活敵 B 獲得 1/3 預算');
  assert.ok(Math.abs(losses[4] - 0.36) < 1e-4, '活敵 C 獲得 1/3 預算');
  assert.equal(losses[5], 0, '超過 3 隻名額的活敵 D 不受傷害');

  // 6. Lv5+power 共同預算反例：budget 2.24，3 敵實扣總額嚴格 <= budget + 1e-9（不得因 toFixed4 向上量化為 2.2401）
  probe.getDuoShockwaves().length = 0;
  probe.getEnemies().length = 0;
  probe.getWL().barrier = 5;
  probe.getWL().thunder = 5;
  probe.setBuildCharms(['charm_power']);
  probe.getB().dmg = 1.2; // (1.2 + 0.20 powerBonus) * 8.0 = 11.2, budget = 11.2 * 0.20 = 2.24
  const specLv5 = probe.resolveAttackSpec('thunder', 5);
  assert.equal(Number((specLv5.damage * 0.20).toFixed(4)), 2.24, 'Lv5+power 雷傷預算為 2.24');

  const mainP = { x: 180, y: 100, hp: 500, maxHp: 500, type: 'normal' };
  probe.getEnemies().push(mainP);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);
  assert.equal(probe.getDuoShockwaves().length, 1);
  const sw5 = probe.getDuoShockwaves()[0];
  assert.equal(sw5.damageBudget, 2.24);

  // 放入 3 隻有效敵怪在衝擊點（180, 100）
  const eA = { x: 185, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  const eB = { x: 190, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  const eC = { x: 195, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([eA, eB, eC]);

  probe.setWT('thunder', 999);
  probe.weapons(0.13);

  const dmgA = 100 - eA.hp;
  const dmgB = 100 - eB.hp;
  const dmgC = 100 - eC.hp;
  const totalDmg = dmgA + dmgB + dmgC;
  assert.ok(Math.abs(dmgA - 2.24 / 3) < 1e-9, 'eA 獲得精確 2.24/3');
  assert.ok(Math.abs(dmgB - 2.24 / 3) < 1e-9, 'eB 獲得精確 2.24/3');
  assert.ok(Math.abs(dmgC - 2.24 / 3) < 1e-9, 'eC 獲得精確 2.24/3');
  assert.ok(totalDmg <= 2.24 + 1e-9, `實扣總額 (${totalDmg}) 嚴格不得超過預算 2.24 + 1e-9`);

  // 1 敵與 2 敵分攤與有效篩選
  // 1 敵
  probe.getDuoShockwaves().length = 0;
  probe.getDuoShockwaves().push({ x: 180, y: 100, radius: 64, delay: 0.12, damageBudget: 2.24, triggered: false });
  const singleE = { x: 185, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([singleE]);
  probe.weapons(0.13);
  assert.ok(Math.abs((100 - singleE.hp) - 2.24) < 1e-9, '單敵承擔 100% 預算 2.24');

  // 2 敵
  probe.getDuoShockwaves().length = 0;
  probe.getDuoShockwaves().push({ x: 180, y: 100, radius: 64, delay: 0.12, damageBudget: 2.24, triggered: false });
  const twoA = { x: 185, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  const twoB = { x: 190, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([twoA, twoB]);
  probe.weapons(0.13);
  const sumTwo = (100 - twoA.hp) + (100 - twoB.hp);
  assert.ok(Math.abs(sumTwo - 2.24) < 1e-9, '雙敵平分預算且總和精確為 2.24');
  assert.ok(sumTwo <= 2.24 + 1e-9, '雙敵總額 <= 2.24 + 1e-9');
});

// ── 70. 玩家移動區域快照、延遲升級快照隔離、pause 凍結與結束清理 ────────
test('M1-D-70 Player movement area snapshot, in-flight upgrade isolation, pause/levelup freeze, and lifecycle clearance', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().barrier = 3;
  probe.getWL().thunder = 3;
  probe.setBuildDuos(['duo_thundercircle']);

  // 1. 移動區域快照：施放時判定以生成時 P 位置為準
  const target = { x: 250, y: 100, hp: 100, maxHp: 100, type: 'normal' }; // dist from (100, 100) = 150 <= 224
  probe.getEnemies().push(target);
  probe.setWT('thunder', 0);
  probe.weapons(0.001);

  assert.equal(probe.getDuoShockwaves().length, 1, '生成時在陣內，成功排入衝擊');
  const sw = probe.getDuoShockwaves()[0];
  assert.equal(sw.x, 250);
  assert.equal(sw.y, 100);

  // 施放後玩家瞬移到 (800, 800)
  probe.getP().x = 800;
  probe.getP().y = 800;

  // 在原衝擊點 (250, 100) 與玩家新位置 (800, 800) 各放一隻怪
  const bystanderNearShock = { x: 260, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const bystanderNearPlayer = { x: 810, y: 800, hp: 50, maxHp: 50, type: 'normal' };
  probe.getEnemies().push(bystanderNearShock, bystanderNearPlayer);

  // 2. 延遲期間升級傷害與技能不回寫
  const snapshottedBudget = sw.damageBudget;
  probe.getWL().thunder = 5; // 升至 Lv5 8倍係數
  probe.getB().dmg = 5.0;     // 大幅提升基礎傷害

  // 步進推進觸發衝擊
  probe.weapons(0.15);
  assert.ok(bystanderNearShock.hp < 50, '原落雷點附近的敵人承受衝擊');
  assert.equal(bystanderNearPlayer.hp, 50, '玩家新位置附近的敵人絕對不受衝擊');
  assert.equal(sw.damageBudget, snapshottedBudget, '延遲期間升級不回寫衝擊預算');

  // 3. pause 與 levelup 狀態凍結延遲時鐘
  probe.getDuoShockwaves().push({
    x: 100, y: 100, radius: 64, delay: 0.12, damageBudget: 2.0, triggered: false, level: 3
  });
  probe.setState('pause');
  probe.update(0.1);
  assert.equal(probe.getDuoShockwaves()[0].delay, 0.12, 'pause 狀態下 update 凍結衝擊延遲');
  probe.setState('levelup');
  probe.update(0.1);
  assert.equal(probe.getDuoShockwaves()[0].delay, 0.12, 'levelup 狀態下 update 凍結衝擊延遲');
  probe.setState('play');

  // 4. 生命週期清理：startVictorySequence 與 loseRun 清空佇列
  probe.startVictorySequence();
  assert.equal(probe.getDuoShockwaves().length, 0, 'startVictorySequence 清空 duoShockwaves');
  probe.getDuoShockwaves().push({ x: 100, y: 100, radius: 64, delay: 0.12, damageBudget: 1, triggered: false, level: 1 });
  probe.loseRun();
  assert.equal(probe.getDuoShockwaves().length, 0, 'loseRun 清空 duoShockwaves');

  // 5. start 重設 buildDuos 與佇列
  probe.getBuildDuos().push('duo_thundercircle');
  probe.getDuoShockwaves().push({ x: 0, y: 0, radius: 64, delay: 0.12, damageBudget: 1, triggered: false, level: 1 });
  probe.start('night-town');
  assert.equal(probe.getBuildDuos().length, 0, 'start 重設 buildDuos 為空陣列');
  assert.equal(probe.getDuoShockwaves().length, 0, 'start 清空 duoShockwaves');
});

// ── 71. Duo 寒封符卡池資格、動態卡片契約、單局去重與槽位獨立 ────────
test('M1-D-71 Duo frostseal pool eligibility, card presentation, deduplication, and slot independence', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 缺任一技能或等級未達 Lv3 均不得入池
  probe.getWL().needle = 0;
  probe.getWL().boom = 3;
  let duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_frostseal');
  assert.equal(duoChoices.length, 0, '未持有 needle 時 duo_frostseal 不得入池');

  probe.getWL().needle = 3;
  probe.getWL().boom = 0;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_frostseal');
  assert.equal(duoChoices.length, 0, '未持有 boom 時 duo_frostseal 不得入池');

  probe.getWL().needle = 2;
  probe.getWL().boom = 3;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_frostseal');
  assert.equal(duoChoices.length, 0, 'needle Lv2 時 duo_frostseal 不得入池');

  probe.getWL().needle = 3;
  probe.getWL().boom = 2;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_frostseal');
  assert.equal(duoChoices.length, 0, 'boom Lv2 時 duo_frostseal 不得入池');

  // 2. needle+boom 均 Lv3+：合法入池且卡片契約齊全
  probe.getWL().needle = 3;
  probe.getWL().boom = 3;
  let duoCard = null;
  for (let i = 0; i < 20 && !duoCard; i++) {
    const choices = probe.getEligibleChoices();
    duoCard = choices.find(c => c.id === 'duo_frostseal');
  }
  assert.ok(duoCard, '兩技能均 Lv3+ 時寒封符合法入池');
  const card = duoCard;
  assert.equal(card.id, 'duo_frostseal');
  assert.equal(card.choiceId, 'duo:duo_frostseal');
  assert.equal(card.type, 'duo');
  assert.equal(card.n, '寒封符');
  assert.equal(card.s, 'かんぷうふ');
  assert.equal(card.cat, '【 共鳴奧義 】');
  assert.equal(card.levelText, '◆ 共鳴奧義');
  assert.equal(card.rarity, 'duo');
  assert.deepStrictEqual(Array.from(card.skillIds), ['needle', 'boom']);
  assert.equal(card.beforeText, '直投');
  assert.equal(card.afterText, '寒封');
  assert.equal(card.requirementText, '持有天狐靈針 Lv3+ 與 陰陽符 Lv3+');
  assert.ok(card.limitText.includes('每局限選一次') && card.limitText.includes('不占主動、御守、變異槽位') && card.limitText.includes('Boss受限'), '限制描述完整');
  assert.ok(card.d.includes('寒冷') && card.d.includes('受限控場'), '描述具體');

  // 3. 單局去重：已持有 duo_frostseal 後不再入池
  probe.getBuildDuos().push('duo_frostseal');
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_frostseal');
  assert.equal(duoChoices.length, 0, '已選過後不可再次入池');

  // 4. 槽位獨立：不占主動、御守、變異槽位
  assert.equal(probe.getBuildCharms().length, 0, 'Duo 不占用御守槽');
  assert.equal(probe.getSkillMutations('needle').length, 0, 'Duo 不占用 needle 變異槽');
  assert.equal(probe.getSkillMutations('boom').length, 0, 'Duo 不占用 boom 變異槽');
});

// ── 72. 真選卡 offerUp -> applyChoice 取得 duo_frostseal、XP/revision 與連按防護 ──
test('M1-D-72 Real offerUp -> applyChoice for duo_frostseal, XP/revision, stale revision guard, and reroll invalidation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 4;
  probe.getWL().barrier = 4;
  probe.getWL().needle = 4;
  probe.getWL().boom = 4;
  probe.setSeals(0);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_pierce', 'mut_return', 'mut_splitblast']);
  probe.setBuildDuos(['duo_thundercircle']); // 已持雷紋陣，唯剩寒封符
  probe.setXp(100);

  probe.offerUp();
  probe.setLevelupCooldown(0);
  const choices = probe.getChoices();
  const duoCard = choices.find(c => c.choiceId === 'duo:duo_frostseal');
  assert.ok(duoCard, '真 offerUp 抽出寒封符');
  assert.equal(duoCard.beforeText, '直投');
  assert.equal(duoCard.afterText, '寒封');

  const oldRev = probe.getBuildRevision();
  const xpBefore = probe.getXp();
  const req = probe.getXpNeed();

  // 1. 真 applyChoice
  const res = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(res.ok, true, '合法選卡成功');
  assert.equal(probe.getBuildState().duos.includes('duo_frostseal'), true, 'BuildState.duos 正確包含寒封符');
  assert.equal(probe.getXp(), Math.max(0, xpBefore - req), '正確扣除 XP');
  assert.ok(probe.getBuildRevision() > oldRev, 'buildRevision 遞增');

  // 2. 過期 revision 拒絕
  const staleRes = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'not_in_levelup');

  // 3. 連按防重扣
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  const doubleClickRes = probe.applyChoice(duoCard.choiceId, probe.getBuildRevision());
  assert.equal(doubleClickRes.ok, false, '已消費卡片不可二次套用');
  assert.equal(doubleClickRes.reason, 'ineligible');
});

// ── 73. 真陰陽符 producer 主爆命中前 cold 正反判定、直擊優先與 2s 免疫期 ────
test('M1-D-73 Real boom producer hit-before cold requirement, primary priority, and 2s immunity guard', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().needle = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_frostseal']);

  const spec = probe.resolveAttackSpec('boom', 3, probe.getBuildState());
  assert.equal(spec.hasDuoFrostseal, true, 'resolveAttackSpec 正確快照 hasDuoFrostseal');

  // 1. 反面案例：符自帶 mut_frost，但目標命中前無寒冷（frostHits=0且未凍結）-> 絕對不得觸發寒封符
  probe.setBuildMutations(['mut_frost']); // 符自帶 frost
  const cleanTarget = { x: 180, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 0, speed: 60 };
  probe.getEnemies().push(cleanTarget);
  probe.setWT('boom', 0);
  probe.weapons(0.001); // 產生帶 frost 的符

  assert.equal(probe.getProj().length, 3, 'boom Lv3 產生 3 符');
  const talisman1 = probe.getProj()[0];
  talisman1.stuck = true;
  talisman1.target = cleanTarget;
  talisman1.fuse = 0;
  probe.explodeTalisman(talisman1);

  assert.ok(cleanTarget.hp < 100, '主爆造成傷害');
  assert.ok(cleanTarget.freezeEnds > 0, '本符主爆附帶寒冷凍結目標');
  assert.ok(!cleanTarget.frostsealSlowEnds, '命中前無寒冷，自帶 frost 不得自觸發寒封符');

  // 2. 正面案例：目標命中前已有寒冷（已處於凍結中）-> 主爆合格觸發寒封控場反應
  probe.getProj().length = 0;
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  const talisman2 = probe.getProj()[0];
  talisman2.stuck = true;
  talisman2.target = cleanTarget;
  talisman2.fuse = 0;
  probe.explodeTalisman(talisman2);

  assert.ok(cleanTarget.frostsealSlowEnds > 0, '命中前已有寒冷，成功觸發寒封反應');
  assert.ok(cleanTarget.frostsealImmuneEnds > 0, '觸發後進入免疫期');

  // 3. 2 秒免疫期內不可再次觸發 / 刷新
  const firstSlowEnds = cleanTarget.frostsealSlowEnds;
  const firstImmuneEnds = cleanTarget.frostsealImmuneEnds;
  probe.getProj().length = 0;
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  const talisman3 = probe.getProj()[0];
  talisman3.stuck = true;
  talisman3.target = cleanTarget;
  talisman3.fuse = 0;
  probe.explodeTalisman(talisman3);

  assert.equal(cleanTarget.frostsealSlowEnds, firstSlowEnds, '2 秒免疫期內不得刷新減速');
  assert.equal(cleanTarget.frostsealImmuneEnds, firstImmuneEnds, '2 秒免疫期內不得重置免疫期');
});

// ── 74. 整 cast 至多 1 敵額度共享（fan/Lv5）、次爆零觸發與快照隔離 ──────────
test('M1-D-74 Single target per cast limit across fan/Lv5 talismans, secondary splitblast zero trigger, and snapshot isolation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().needle = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_frostseal']);
  probe.setBuildMutations(['mut_fan', 'mut_splitblast']); // fan 散射 (3 符) + 次爆

  // 放置 3 隻已有寒冷的敵怪
  const e1 = { x: 180, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 1, speed: 60 };
  const e2 = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 1, speed: 60 };
  const e3 = { x: 220, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 1, speed: 60 };
  probe.setEnemies([e1, e2, e3]);

  probe.setWT('boom', 0);
  probe.weapons(0.001);
  assert.equal(probe.getProj().length, 5, 'mut_fan Lv3 產生 5 符');

  // 第一符直擊 e1 主爆
  const p1 = probe.getProj()[0];
  p1.stuck = true; p1.target = e1; p1.fuse = 0;
  probe.explodeTalisman(p1);
  assert.ok(e1.frostsealSlowEnds > 0, '第一符觸發 e1 寒封反應');

  // 第二符直擊 e2 主爆（同 cast 額度已耗盡）
  const p2 = probe.getProj()[1];
  p2.stuck = true; p2.target = e2; p2.fuse = 0;
  probe.explodeTalisman(p2);
  assert.ok(!e2.frostsealSlowEnds, '同 cast 額度已耗盡，e2 絕不觸發寒封');

  // 第三符直擊 e3 主爆（同 cast 額度已耗盡）
  const p3 = probe.getProj()[2];
  p3.stuck = true; p3.target = e3; p3.fuse = 0;
  probe.explodeTalisman(p3);
  assert.ok(!e3.frostsealSlowEnds, '同 cast 額度已耗盡，e3 絕不觸發寒封');

  // 驗證次爆 splitblast 零觸發
  assert.ok(probe.getSplitblasts().length > 0, '產生次爆佇列');
  const e4 = { x: 180, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 1, speed: 60 };
  probe.getEnemies().push(e4);
  probe.weapons(0.20); // 觸發次爆
  assert.ok(!e4.frostsealSlowEnds, '次爆命中絕對不得觸發寒封反應');
});

// ── 75. 普通怪控場反應（凍結結束後 0.35s 追擊×0.65，無 freeze 立即 0.35s）────
test('M1-D-75 Normal enemy control reaction (0.35s x0.65 after freezeEnds, or immediately if unfrozen), no baseline corruption', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().needle = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_frostseal']);

  // 1. 無 freeze 狀態（僅 frostHits: 1）：立即生效 0.35s，追擊速度 × 0.65
  const foe = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 1, speed: 100 };
  probe.setEnemies([foe]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  const p = probe.getProj()[0];
  p.stuck = true; p.target = foe; p.fuse = 0;
  probe.explodeTalisman(p);

  assert.ok(foe.frostsealSlowEnds > 0);
  assert.equal(foe.frostsealSlowMult, 0.65);
  assert.equal(foe.speed, 100, '不得污染基底 speed');
  assert.ok(!foe.slowT, '不得覆寫 slowT');

  // 2. 有凍結狀態（freezeEnds = elapsed + 0.5）：凍結結束後延續 0.35s 減速
  probe.getProj().length = 0;
  const frozenFoe = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', frostHits: 0, freezeT: 0.5, freezeEnds: 1.0, speed: 100 };
  probe.setEnemies([frozenFoe]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  const p2 = probe.getProj()[0];
  p2.stuck = true; p2.target = frozenFoe; p2.fuse = 0;
  probe.explodeTalisman(p2);

  assert.equal(frozenFoe.freezeEnds, 1.0, '不得竄改現有 freezeEnds');
  assert.equal(Number((frozenFoe.frostsealSlowEnds - frozenFoe.freezeEnds).toFixed(2)), 0.35, '減速期精確延續至 freezeEnds 後 0.35 秒');
});

// ── 76. Boss 控場反應（真 update 移動 90%，最多 0.15s 後恢復，招式不改）、清理 ──
test('M1-D-76 Boss control reaction (update chase speed 90%, 0.15s duration, no hazard tampering), lifecycle reset', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().needle = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_frostseal']);

  // 1. Boss 受到寒封反應：最多 0.15s，追擊速度 × 0.90，招式與 hazard 絕不改動
  const boss = { x: 300, y: 100, hp: 500, maxHp: 500, type: 'boss', frostHits: 2, speed: 80, hazard: null };
  probe.setEnemies([boss]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  const p = probe.getProj()[0];
  p.stuck = true; p.target = boss; p.fuse = 0;
  probe.explodeTalisman(p);

  assert.ok(boss.frostsealSlowEnds > 0);
  assert.equal(boss.frostsealSlowMult, 0.90, 'Boss 減速倍率嚴格為 0.90');
  assert.equal(boss.hazard, null, 'Boss hazard 保持不變');

  // 2. 生命週期清理：start 重設 buildDuos
  probe.start('night-town');
  assert.equal(probe.getBuildDuos().length, 0, 'start 重置 buildDuos 為空陣列');
});

// ── 77. Duo 墨焰斬卡池資格、動態卡片契約、單局去重與槽位獨立 ────────
test('M1-D-77 Duo inkfire pool eligibility, card presentation, deduplication, and slot independence', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 缺任一技能或等級未達 Lv3 均不得入池
  probe.getWL().katana = 0;
  probe.getWL().fire = 3;
  let duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_inkfire');
  assert.equal(duoChoices.length, 0, '未持有 katana 時 duo_inkfire 不得入池');

  probe.getWL().katana = 3;
  probe.getWL().fire = 0;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_inkfire');
  assert.equal(duoChoices.length, 0, '未持有 fire 時 duo_inkfire 不得入池');

  probe.getWL().katana = 2;
  probe.getWL().fire = 3;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_inkfire');
  assert.equal(duoChoices.length, 0, 'katana Lv2 時 duo_inkfire 不得入池');

  probe.getWL().katana = 3;
  probe.getWL().fire = 2;
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_inkfire');
  assert.equal(duoChoices.length, 0, 'fire Lv2 時 duo_inkfire 不得入池');

  // 2. katana+fire 均 Lv3+：合法入池且卡片契約齊全
  probe.getWL().katana = 3;
  probe.getWL().fire = 3;
  let duoCard = null;
  for (let i = 0; i < 20 && !duoCard; i++) {
    const choices = probe.getEligibleChoices();
    duoCard = choices.find(c => c.id === 'duo_inkfire');
  }
  assert.ok(duoCard, '兩技能均 Lv3+ 時墨焰斬合法入池');
  const card = duoCard;
  assert.equal(card.id, 'duo_inkfire');
  assert.equal(card.choiceId, 'duo:duo_inkfire');
  assert.equal(card.type, 'duo');
  assert.equal(card.n, '墨焰斬');
  assert.equal(card.s, 'ぼくえんざん');
  assert.equal(card.cat, '【 共鳴奧義 】');
  assert.equal(card.levelText, '◆ 共鳴奧義');
  assert.equal(card.rarity, 'duo');
  assert.deepStrictEqual(Array.from(card.skillIds), ['katana', 'fire']);
  assert.equal(card.beforeText, '直接斬');
  assert.equal(card.afterText, '留墨焰');
  assert.equal(card.requirementText, '持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+');
  assert.ok(card.limitText.includes('每局限選一次') && card.limitText.includes('不占主動、御守、變異槽位') && card.limitText.includes('每次攻擊有觸發上限'), '限制描述完整');
  assert.ok(card.d.includes('灼燒') && card.d.includes('墨焰痕') && card.d.includes('0.12') && card.d.includes('56'), '描述具體');

  // 3. 單局去重：已持有 duo_inkfire 後不再入池
  probe.getBuildDuos().push('duo_inkfire');
  duoChoices = probe.getEligibleChoices().filter(c => c.id === 'duo_inkfire');
  assert.equal(duoChoices.length, 0, '已選過後不可再次入池');

  // 4. 槽位獨立：不占主動、御守、變異槽位
  assert.equal(probe.getBuildCharms().length, 0, 'Duo 不占用御守槽');
  assert.equal(probe.getSkillMutations('katana').length, 0, 'Duo 不占用 katana 變異槽');
  assert.equal(probe.getSkillMutations('fire').length, 0, 'Duo 不占用 fire 變異槽');
});

// ── 78. 真選卡 offerUp -> applyChoice 取得 duo_inkfire、XP/revision 與連按防護 ──
test('M1-D-78 Real offerUp -> applyChoice for duo_inkfire, XP/revision, stale revision guard, and reroll invalidation', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getWL().katana = 4;
  probe.getWL().fire = 4;
  probe.getWL().needle = 4;
  probe.getWL().barrier = 4;
  probe.setSeals(0);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_pierce', 'mut_return', 'mut_orbit']);
  probe.setBuildDuos(['duo_thundercircle', 'duo_frostseal']); // 已持兩Duo，唯剩墨焰斬
  probe.setXp(100);

  probe.offerUp();
  probe.setLevelupCooldown(0);
  const choices = probe.getChoices();
  const duoCard = choices.find(c => c.choiceId === 'duo:duo_inkfire');
  assert.ok(duoCard, '真 offerUp 抽出墨焰斬');
  assert.equal(duoCard.beforeText, '直接斬');
  assert.equal(duoCard.afterText, '留墨焰');

  const oldRev = probe.getBuildRevision();
  const xpBefore = probe.getXp();
  const req = probe.getXpNeed();

  // 1. 真 applyChoice
  const res = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(res.ok, true, '合法選卡成功');
  assert.equal(probe.getBuildState().duos.includes('duo_inkfire'), true, 'BuildState.duos 正確包含墨焰斬');
  assert.equal(probe.getXp(), Math.max(0, xpBefore - req), '正確扣除 XP');
  assert.ok(probe.getBuildRevision() > oldRev, 'buildRevision 遞增');

  // 2. 過期 revision 拒絕
  const staleRes = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(staleRes.ok, false);
  assert.equal(staleRes.reason, 'not_in_levelup');

  // 3. 連按防重扣
  probe.setState('levelup');
  probe.setLevelupCooldown(0);
  const doubleClickRes = probe.applyChoice(duoCard.choiceId, probe.getBuildRevision());
  assert.equal(doubleClickRes.ok, false, '已消費卡片不可二次套用');
  assert.equal(doubleClickRes.reason, 'ineligible');
});

// ── 79. 火傷打標真 producer（接觸、Lv4 靈火、Lv5 龍球直濺、焦土）記 fireBurnEnds，過期與負向 ──
test('M1-D-79 Fire damage marking (contact, Lv4 spirit, Lv5 dragon direct/splash, scorch ground) sets fireBurnEnds, 1s expiry, shield/dead negative', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().katana = 3;
  probe.getWL().fire = 3;
  probe.setBuildDuos(['duo_inkfire']);

  // 1. 接觸火傷打標：活怪實傷後 fireBurnEnds = elapsed + 1.0
  const foe = { x: 198, y: 100, hp: 100, maxHp: 100, type: 'normal' }; // orbit rx=98
  probe.setEnemies([foe]);
  probe.setWT('katana', 999);
  probe.weapons(0.001); // 狐火接觸

  assert.ok(foe.hp < 100, '接觸造成火傷');
  assert.ok(foe.fireBurnEnds > 0, '實傷後正確打標 fireBurnEnds');

  // 2. Lv4 離體追擊靈火打標真 producer
  probe.getWL().fire = 4;
  probe.setWT('katana', 999);
  const spiritFoe = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([spiritFoe]);
  probe.weapons(0.01); // 生成離體靈火
  for (let i = 0; i < 20 && spiritFoe.hp === 100; i++) {
    probe.weapons(0.05); // 靈火飛行擊中目標
  }
  assert.ok(spiritFoe.hp < 100, 'Lv4 離體靈火造成實傷');
  assert.ok(spiritFoe.fireBurnEnds > 0, 'Lv4 靈火實傷後正確打標 fireBurnEnds');

  // 3. Lv5 黑龍火球直擊與濺射打標真 producer
  probe.getWL().fire = 5;
  probe.setWT('katana', 999);
  const directFoe = { x: 300, y: 300, hp: 100, maxHp: 100, type: 'normal' };
  const splashFoe = { x: 350, y: 300, hp: 100, maxHp: 100, type: 'normal' }; // dist 50 <= 140
  probe.setEnemies([directFoe, splashFoe]);
  probe.getDragonShots().push({
    x: 300, y: 300, target: directFoe,
    dragonDirectDmg: 12, dragonSplashDmg: 4, dragonScorchDmg: 1.8,
    scorchDuration: 5, scorchRadius: 140,
    hasDuoInkfire: true, life: 0.001
  });
  probe.weapons(0.01);
  assert.ok(directFoe.hp < 100, '黑龍直擊實傷');
  assert.ok(directFoe.fireBurnEnds > 0, '黑龍直擊實傷後正確打標 fireBurnEnds');
  assert.ok(splashFoe.hp < 100, '黑龍濺射實傷');
  assert.ok(splashFoe.fireBurnEnds > 0, '黑龍濺射實傷後正確打標 fireBurnEnds');

  // 4. Lv5 黑龍焦土地面 tick 實傷打標真 producer
  assert.ok(probe.getDragonScorches().length > 0, '黑龍火球著地產生焦土');
  const scorchFoe = { x: 310, y: 300, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([scorchFoe]);
  probe.weapons(0.65); // 等待焦土 0.6s tick
  assert.ok(scorchFoe.hp < 100, '黑龍焦土造成實傷');
  assert.ok(scorchFoe.fireBurnEnds > 0, '焦土實傷後正確打標 fireBurnEnds');

  // 5. 護盾敵、死亡敵、離場敵負向不打標
  const shieldFoe = { x: 198, y: 100, hp: 100, maxHp: 100, shield: true, type: 'tank' };
  const deadFoe = { x: 198, y: 100, hp: 0, maxHp: 100, type: 'normal' };
  const vanishFoe = { x: 198, y: 100, hp: 100, maxHp: 100, vanish: 1, type: 'normal' };
  const doneFoe = { x: 198, y: 100, hp: 100, maxHp: 100, done: true, type: 'normal' };
  probe.setEnemies([shieldFoe, deadFoe, vanishFoe, doneFoe]);
  probe.weapons(0.001);

  assert.ok(!shieldFoe.fireBurnEnds, '護盾怪不打標');
  assert.ok(!deadFoe.fireBurnEnds, '死亡怪不打標');
  assert.ok(!vanishFoe.fireBurnEnds, 'vanish 怪不打標');
  assert.ok(!doneFoe.fireBurnEnds, 'done 怪不打標');
});

// ── 80. 妖刀主斬（Lv1-4）與 Lv5 風刃觸發墨焰痕 / 命中前未灼燒負向 / 側斬零觸發 ──
test('M1-D-80 Katana main slash and Lv5 wind blade trigger inkfire mark, unburned negative, crosscut zero trigger', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getP().faceAng = 0; // 面向右方
  probe.getWL().katana = 3;
  probe.getWL().fire = 3;
  probe.setBuildDuos(['duo_inkfire']);
  probe.setBuildMutations(['mut_crosscut']); // 帶十字側斬

  // 1. 命中前未灼燒（無 fireBurnEnds）：妖刀主斬造成傷害，但絕不觸發墨焰痕
  const cleanFoe = { x: 150, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([cleanFoe]);
  probe.setWT('katana', 0);
  probe.weapons(0.001);

  assert.ok(cleanFoe.hp < 100, '妖刀主斬造成實傷');
  assert.equal(probe.getInkfireMarks().length, 0, '未灼燒目標不得觸發墨焰痕');

  // 2. 命中前已灼燒（fireBurnEnds > elapsed）：妖刀主斬造成實傷，產 1 個墨焰痕
  probe.getInkfireMarks().length = 0;
  const burnedFoe = { x: 150, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 2.0 };
  probe.setEnemies([burnedFoe]);
  probe.setWT('katana', 0);
  probe.weapons(0.001);

  assert.equal(probe.getInkfireMarks().length, 1, '命中灼燒敵怪成功排入 1 個墨焰痕');
  const mark = probe.getInkfireMarks()[0];
  assert.equal(mark.x, 150);
  assert.equal(mark.y, 100);
  assert.equal(mark.radius, 56);
  assert.equal(mark.delay, 0.12);

  // 3. 側斬 crosscut 命中灼燒怪：絕對零觸發墨焰痕
  probe.getInkfireMarks().length = 0;
  assert.ok(probe.getCrosscuts().length > 0, '產生 crosscut 佇列');
  const crosscutTarget = { x: 150, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 2.0 };
  probe.setEnemies([crosscutTarget]);
  probe.setWT('katana', 999);
  probe.weapons(0.20); // 觸發 crosscut 結算
  assert.equal(probe.getInkfireMarks().length, 0, 'crosscut 側斬命中絕對不得觸發墨焰痕');

  // 4. Lv5 妖刀風刃貫穿 6 隻灼燒怪：全路徑僅首個合格命中產 1 痕，預算符合 pierceScale 非暴擊基傷
  probe.getWL().katana = 5;
  probe.setWT('katana', 0);
  probe.getInkfireMarks().length = 0;
  const k5Spec = probe.resolveAttackSpec('katana', 5, probe.getBuildState());
  const expectedK5Budget = Number((k5Spec.windDmg * 0.20).toFixed(4));
  const waveFoes = [];
  for (let i = 0; i < 6; i++) {
    waveFoes.push({ x: 180 + i * 40, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 });
  }
  probe.setEnemies(waveFoes);
  probe.weapons(0.05); // 射出風刃並命中第一隻敵怪
  assert.equal(probe.getInkfireMarks().length, 1, 'Lv5 風刃在首個合格命中點排入 1 痕');
  const waveMark = probe.getInkfireMarks()[0];
  assert.equal(waveMark.x, waveFoes[0].x);
  assert.equal(waveMark.y, waveFoes[0].y);
  assert.equal(waveMark.damageBudget, expectedK5Budget, '風刃墨焰痕預算為非暴擊基傷 20%');

  // 風刃持續貫穿剩餘 5 隻敵怪（總計 6 隻全被命中），絕不再產第 2 個 mark
  for (let s = 0; s < 5; s++) {
    probe.weapons(0.02);
  }

  assert.ok(waveFoes.every(f => f.hp < 100), '6 隻敵怪均受到風刃傷害');
  for (let i = 0; i < 6; i++) {
    assert.ok(waveFoes[i].hp < 100, `第 ${i + 1} 隻敵怪均受到風刃傷害`);
  }
  assert.equal(probe.getInkfireMarks().length, 1, '穿透整條路徑上總計維持 1 個 mark');
});

// ── 81. 墨焰痕 0.12s 延遲時序 / 出生幀 dt 不扣 / queue 16 / 預算分攤（1/2/3敵，實扣總額 <= budget）與負向排除 ───
test('M1-D-81 Inkfire mark timing (0.12s), birth dt not deducted, queue 16 cap, budget split (1/2/3 targets, sum <= budget), and negative pre-filters', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getP().faceAng = 0;
  probe.getWL().katana = 3;
  probe.getWL().fire = 3;
  probe.setBuildDuos(['duo_inkfire']);

  const kSpec = probe.resolveAttackSpec('katana', 3, probe.getBuildState());
  const expectedBudget = Number((kSpec.slashDmg * 0.20).toFixed(4)); // 0.56

  // 1. 出生幀 dt 不扣驗證
  const mainFoe = { x: 150, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([mainFoe]);
  probe.setWT('katana', 0);
  probe.weapons(0.05); // 0.05 步長斬擊

  assert.equal(probe.getInkfireMarks().length, 1);
  const queuedMark = probe.getInkfireMarks()[0];
  assert.equal(queuedMark.delay, 0.12, '出生當幀 delay 必須維持 0.12，不得扣出生前 dt');

  // 2. 時序步進與 3 敵分攤實扣總額 <= budget 驗證（含 4 敵時第 4 敵零傷）
  const t1 = { x: 155, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const t2 = { x: 160, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const t3 = { x: 165, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const t4 = { x: 170, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  probe.setEnemies([t1, t2, t3, t4]);
  probe.setWT('katana', 999);

  // 第 1 步 (+0.05s, 剩 0.07s)
  probe.weapons(0.05);
  assert.equal(Number(queuedMark.delay.toFixed(2)), 0.07);
  assert.equal(t1.hp, 50, '未達 0.12s 不扣血');

  // 第 2 步 (+0.05s, 剩 0.02s)
  probe.weapons(0.05);
  assert.equal(Number(queuedMark.delay.toFixed(2)), 0.02);
  assert.equal(t1.hp, 50, '未達 0.12s 不扣血');

  // 第 3 步 (+0.05s, 觸發)
  probe.weapons(0.05);
  assert.equal(probe.getInkfireMarks().length, 0, '到達延遲觸發並清出佇列');

  const actualDmg1 = 50 - t1.hp;
  const actualDmg2 = 50 - t2.hp;
  const actualDmg3 = 50 - t3.hp;
  const totalActualDmg = actualDmg1 + actualDmg2 + actualDmg3;

  assert.ok(totalActualDmg <= expectedBudget + 1e-9, `3 敵實扣總額 (${totalActualDmg}) 不得超過快照預算 (${expectedBudget})`);
  assert.ok(Math.abs(totalActualDmg - expectedBudget) < 1e-9, '3 敵實扣總額與快照預算嚴格精準相符');
  assert.equal(t4.hp, 50, '超過 3 目標上限的 t4 不受傷害');

  // 3. 1 敵與 2 敵分攤實扣總額 <= budget 驗證
  // 1 敵
  probe.getInkfireMarks().push({ x: 200, y: 200, radius: 56, delay: 0.01, damageBudget: 0.56, triggered: false });
  const solo = { x: 200, y: 200, hp: 10, maxHp: 10, type: 'normal' };
  probe.setEnemies([solo]);
  probe.weapons(0.02);
  assert.ok(Math.abs((10 - solo.hp) - 0.56) < 1e-9, '1 敵承受全額預算');

  // 2 敵
  probe.getInkfireMarks().push({ x: 200, y: 200, radius: 56, delay: 0.01, damageBudget: 0.56, triggered: false });
  const duo1 = { x: 200, y: 200, hp: 10, maxHp: 10, type: 'normal' };
  const duo2 = { x: 205, y: 200, hp: 10, maxHp: 10, type: 'normal' };
  probe.setEnemies([duo1, duo2]);
  probe.weapons(0.02);
  const duoTotal = (10 - duo1.hp) + (10 - duo2.hp);
  assert.ok(duoTotal <= 0.56 + 1e-9 && Math.abs(duoTotal - 0.56) < 1e-9, '2 敵各承受 1/2 預算，總額不超標');

  // 4. 先排除護盾、死亡、vanish、done 再計算分攤目標
  probe.getInkfireMarks().push({ x: 200, y: 200, radius: 56, delay: 0.01, damageBudget: 0.56, triggered: false });
  const badShield = { x: 200, y: 200, hp: 10, maxHp: 10, shield: true, type: 'tank' };
  const badDead = { x: 200, y: 200, hp: 0, maxHp: 10, type: 'normal' };
  const badVanish = { x: 200, y: 200, hp: 10, maxHp: 10, vanish: 1, type: 'normal' };
  const badDone = { x: 200, y: 200, hp: 10, maxHp: 10, done: true, type: 'normal' };
  const validFoe = { x: 200, y: 200, hp: 10, maxHp: 10, type: 'normal' };
  probe.setEnemies([badShield, badDead, badVanish, badDone, validFoe]);
  probe.weapons(0.02);
  assert.ok(Math.abs((10 - validFoe.hp) - 0.56) < 1e-9, '排除無效敵後唯一存活有效目標獨得全額預算');
  assert.equal(badShield.hp, 10, '護盾敵不扣血');

  // 5. 佇列上限 16 驗證：塞滿 16 個 mark 後，第 17 個產痕請求略過但不影響主斬傷害
  probe.getInkfireMarks().length = 0;
  for (let i = 0; i < 16; i++) {
    probe.getInkfireMarks().push({ x: 100, y: 100, radius: 56, delay: 99, damageBudget: 1, triggered: false });
  }
  assert.equal(probe.getInkfireMarks().length, 16);
  const overflowTarget = { x: 150, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([overflowTarget]);
  probe.setWT('katana', 0);
  probe.weapons(0.001);
  assert.ok(overflowTarget.hp < 100, '主斬正常造成實傷');
  assert.equal(probe.getInkfireMarks().length, 16, '佇列達 16 上限時略過新增 mark');
});

// ── 82. 真選卡前後在途快照隔離、pause/levelup 凍結與 end/start 清理 ─────────────
test('M1-D-82 Real in-flight snapshot isolation before/after offerUp/applyChoice, pause/levelup freeze, and lifecycle reset', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().katana = 3;
  probe.getWL().fire = 3;
  // 此時尚未持有 duo_inkfire

  // 1. 真 offerUp 前在途火攻擊不具備 hasDuoInkfire，命中不打標
  const preFoe = { x: 198, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([preFoe]);
  probe.weapons(0.001);
  assert.ok(preFoe.hp < 100, '未選卡前火傷正常造成傷害');
  assert.ok(!preFoe.fireBurnEnds, '未選卡前火攻擊絕不打標 fireBurnEnds');

  // 2. 真 offerUp -> applyChoice 取得 duo_inkfire
  probe.getWL().needle = 4;
  probe.getWL().barrier = 4;
  probe.getWL().katana = 4;
  probe.getWL().fire = 4;
  probe.setSeals(0);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_pierce', 'mut_return', 'mut_orbit']);
  probe.setBuildDuos(['duo_thundercircle', 'duo_frostseal']);
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const choices = probe.getChoices();
  const duoCard = choices.find(c => c.choiceId === 'duo:duo_inkfire');
  assert.ok(duoCard, '抽到墨焰斬卡片');
  const res = probe.applyChoice(duoCard.choiceId, probe.getBuildRevision());
  assert.equal(res.ok, true, '成功選取墨焰斬');
  assert.ok(probe.getBuildState().duos.includes('duo_inkfire'));

  // 3. 在選卡前已射出的舊在途風刃（快照 hasDuoInkfire: false）即使在選卡後命中灼燒敵，亦不得產痕
  probe.getInkfireMarks().length = 0;
  const oldWave = {
    x: 100, y: 100, originX: 100, originY: 100, vx: 1000, vy: 0,
    ang: 0, size: 360, life: 1.0, hits: new Set(), dmg: 5.0, traveled: 0, maxTravel: 720,
    pierceLimit: 6, pierceScale: 0.75,
    attackSnapshot: { hasDuoInkfire: false },
    inkfireUsed: false
  };
  probe.getWinds().push(oldWave);
  const burnedTarget = { x: 120, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([burnedTarget]);
  probe.setWT('katana', 999);
  probe.weapons(0.05); // 舊風刃前進擊中
  assert.ok(burnedTarget.hp < 100, '舊風刃造成傷害');
  assert.equal(probe.getInkfireMarks().length, 0, '選卡前已在途之攻擊快照隔離，絕不觸發墨焰痕');

  // 4. pause 凍結
  probe.getInkfireMarks().push({
    x: 100, y: 100, radius: 56, delay: 0.12, damageBudget: 1.0, triggered: false
  });
  probe.setState('pause');
  probe.update(0.1);
  assert.equal(probe.getInkfireMarks()[0].delay, 0.12, 'pause 狀態下凍結墨焰痕時鐘');

  // 5. levelup 凍結
  probe.setState('levelup');
  probe.update(0.1);
  assert.equal(probe.getInkfireMarks()[0].delay, 0.12, 'levelup 狀態下凍結墨焰痕時鐘');
  probe.setState('play');

  // 6. startVictorySequence 與 loseRun 清理
  probe.startVictorySequence();
  assert.equal(probe.getInkfireMarks().length, 0, 'startVictorySequence 清空 inkfireMarks');
  probe.getInkfireMarks().push({ x: 0, y: 0, radius: 56, delay: 0.12, damageBudget: 1, triggered: false });
  probe.loseRun();
  assert.equal(probe.getInkfireMarks().length, 0, 'loseRun 清空 inkfireMarks');

  // 7. start 重設 buildDuos
  probe.getBuildDuos().push('duo_inkfire');
  probe.start('night-town');
  assert.equal(probe.getBuildDuos().length, 0, 'start 重置 buildDuos 為空陣列');
});

// ── 83. 餘燼符資格判定（fire+boom Lv3+）、choiceId、卡片展示與 applyChoice 去重 ──
test('M1-D-83 Cinder Seal duo eligibility (fire+boom Lv3+), choiceId, card presentation, applyChoice, and pool deduplication', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  // 1. 條件未滿足不入池：fire < 3 或 boom < 3
  probe.getWL().fire = 2;
  probe.getWL().boom = 3;
  assert.ok(!probe.getEligibleChoices().some(c => c.choiceId === 'duo:duo_cinderseal'), 'fire < 3 時不入池');

  probe.getWL().fire = 3;
  probe.getWL().boom = 2;
  assert.ok(!probe.getEligibleChoices().some(c => c.choiceId === 'duo:duo_cinderseal'), 'boom < 3 時不入池');

  // 2. 條件滿足入池：fire >= 3 且 boom >= 3
  probe.getWL().fire = 3;
  probe.getWL().boom = 3;
  let duoCardInPool = null;
  for (let i = 0; i < 20 && !duoCardInPool; i++) {
    const choices = probe.getEligibleChoices();
    duoCardInPool = choices.find(c => c.choiceId === 'duo:duo_cinderseal');
  }
  assert.ok(duoCardInPool, '兩技能均 Lv3+ 時餘燼符合法入池');

  // 設置飽和池：4 武器 Lv4（無印記不能升 Lv5）、滿御守與變異，使全庫非被動候選僅餘燼符
  probe.getWL().fire = 4;
  probe.getWL().boom = 4;
  probe.getWL().katana = 4;
  probe.getWL().needle = 4;
  probe.setSeals(0);
  probe.setBuildCharms(['charm_power', 'charm_step', 'charm_gather']);
  probe.setBuildMutations(['mut_fan', 'mut_seek', 'mut_frost', 'mut_crosscut', 'mut_pulse', 'mut_pierce', 'mut_return', 'mut_orbit']);
  probe.setBuildDuos(['duo_thundercircle', 'duo_frostseal', 'duo_inkfire']); // 已持其他三Duo，唯剩餘燼符
  probe.setXp(100);

  let duoCard = null;
  for (let i = 0; i < 20 && !duoCard; i++) {
    probe.offerUp();
    probe.setLevelupCooldown(0);
    duoCard = probe.getChoices().find(c => c.choiceId === 'duo:duo_cinderseal');
    if (!duoCard) probe.reroll();
  }
  assert.ok(duoCard, '真 offerUp 抽出餘燼符');
  assert.equal(duoCard.choiceId, 'duo:duo_cinderseal');
  assert.deepStrictEqual(Array.from(duoCard.skillIds), ['fire', 'boom']);
  assert.equal(duoCard.n, '餘燼符');
  assert.equal(duoCard.s, 'よじんふ');
  assert.equal(duoCard.beforeText, '引爆');
  assert.equal(duoCard.afterText, '留餘燼');
  assert.equal(duoCard.requirementText, '持有狐火炎 Lv3+ 與 陰陽符 Lv3+');
  assert.equal(duoCard.limitText, '每局限選一次（不占主動、御守、變異槽位；每次引爆限一處、無再派生）');

  const oldRev = probe.getBuildRevision();
  const xpBefore = probe.getXp();
  const req = probe.getXpNeed();

  // 3. 真 applyChoice 選卡
  const res = probe.applyChoice(duoCard.choiceId, oldRev);
  assert.equal(res.ok, true, '合法選卡成功');
  assert.equal(probe.getBuildRevision(), oldRev + 1, 'revision 遞增');
  assert.equal(probe.getXp(), xpBefore - req, '正確扣除升級所需經驗值');
  assert.ok(probe.getBuildState().duos.includes('duo_cinderseal'), 'duos 正確加入 duo_cinderseal');
  assert.equal(probe.getBuildCharms().length, 3, '不占御守槽位');
  assert.equal(probe.getBuildMutations().length, 8, '不占變異槽位');

  // 4. 去重：已選取後再次升級不再出現 duo_cinderseal
  probe.setXp(100);
  probe.offerUp();
  probe.setLevelupCooldown(0);
  const nextChoices = probe.getChoices();
  assert.ok(!nextChoices.some(c => c.choiceId === 'duo:duo_cinderseal'), '已選取之共鳴奧義不再重複提供');
});

// ── 84. 僅持餘燼符（無墨焰斬）真火傷打標（接觸、靈火、龍球直濺、焦土）及負向 ──
test('M1-D-84 Fire damage applies fireBurnEnds with cinder seal alone (without inkfire) across contact, spirit, and dragon attacks', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().fire = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_cinderseal']); // 僅持餘燼符，無 duo_inkfire

  // 1. 接觸火傷打標：活怪實傷後 fireBurnEnds = elapsed + 1.0
  const foe = { x: 198, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([foe]);
  probe.setWT('boom', 999);
  probe.weapons(0.001); // 狐火接觸

  assert.ok(foe.hp < 100, '接觸造成火傷');
  assert.ok(foe.fireBurnEnds > 0, '僅持餘燼符時接觸實傷後正確打標 fireBurnEnds');

  // 2. Lv4 離體追擊靈火打標真 producer
  probe.getWL().fire = 4;
  probe.setWT('boom', 999);
  const spiritFoe = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([spiritFoe]);
  probe.weapons(0.01);
  for (let i = 0; i < 20 && spiritFoe.hp === 100; i++) {
    probe.weapons(0.05);
  }
  assert.ok(spiritFoe.hp < 100, 'Lv4 離體靈火造成實傷');
  assert.ok(spiritFoe.fireBurnEnds > 0, '僅持餘燼符時 Lv4 靈火實傷後正確打標 fireBurnEnds');

  // 3. Lv5 黑龍火球直擊與濺射打標
  probe.getWL().fire = 5;
  probe.setWT('boom', 999);
  const directFoe = { x: 300, y: 300, hp: 100, maxHp: 100, type: 'normal' };
  const splashFoe = { x: 350, y: 300, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([directFoe, splashFoe]);
  probe.getDragonShots().push({
    x: 300, y: 300, target: directFoe,
    dragonDirectDmg: 12, dragonSplashDmg: 4, dragonScorchDmg: 1.8,
    scorchDuration: 5, scorchRadius: 140,
    hasDuoCinderseal: true, life: 0.001
  });
  probe.weapons(0.01);
  assert.ok(directFoe.hp < 100, '黑龍直擊實傷');
  assert.ok(directFoe.fireBurnEnds > 0, '黑龍直擊打標 fireBurnEnds');
  assert.ok(splashFoe.hp < 100, '黑龍濺射實傷');
  assert.ok(splashFoe.fireBurnEnds > 0, '黑龍濺射打標 fireBurnEnds');

  // 4. Lv5 黑龍焦土地面 tick 實傷打標
  assert.ok(probe.getDragonScorches().length > 0, '黑龍火球著地產生焦土');
  const scorchFoe = { x: 310, y: 300, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([scorchFoe]);
  probe.weapons(0.65);
  assert.ok(scorchFoe.hp < 100, '黑龍焦土造成實傷');
  assert.ok(scorchFoe.fireBurnEnds > 0, '焦土實傷後打標 fireBurnEnds');

  // 5. 負向：無 duo_inkfire 且無 duo_cinderseal 時火傷絕不打標
  probe.setBuildDuos([]);
  const noDuoFoe = { x: 198, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([noDuoFoe]);
  probe.weapons(0.001);
  assert.ok(noDuoFoe.hp < 100, '無共鳴時火傷正常扣血');
  assert.ok(!noDuoFoe.fireBurnEnds, '無共鳴時火傷絕不打標 fireBurnEnds');
});

// ── 85. 陰陽符投擲黏附引信主爆生餘燼、命中前未灼燒負向、次爆零觸發 ──
test('M1-D-85 Talisman launch, attachment, fuse explosion, and burn precondition: cinder spawns on pre-burned enemy and rejects unburned/sub-blasts', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().fire = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_cinderseal']);

  const spec = probe.resolveAttackSpec('boom', 3);
  const expectedBudget = Number((spec.damage * 0.15).toFixed(4));

  // 1. 真符發射 -> 飛行 -> 黏附 -> 引信倒數爆炸：命中前已灼燒目標產生 1 處餘燼
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  const burnedTarget = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([burnedTarget]);
  probe.setWT('boom', 0);
  probe.weapons(0.001); // 投擲陰陽符

  assert.equal(probe.getProj().length, 3, 'Lv3 投擲 3 枚陰陽符');
  assert.ok(probe.getProj().every(q => q.hasDuoCinderseal), '全符快照 hasDuoCinderseal');

  // OFUDA 速度翻倍：飛行步長減半，保留原碰撞／引信／傷害斷言。
  probe.weapons(0.125);
  assert.ok(probe.getProj().some(q => q.stuck), '符咒成功黏附目標');

  // 引信倒數爆炸
  probe.weapons(1.6);
  assert.ok(burnedTarget.hp < 100, '主爆造成實傷');
  assert.equal(probe.getDragonScorches().length, 1, '主爆命中前已灼燒目標產生 1 處餘燼');
  const cinder = probe.getDragonScorches()[0];
  assert.equal(cinder.isCinder, true, '標記為 isCinder');
  assert.equal(cinder.r, 64, '半徑為 64');
  assert.equal(cinder.life, 0.8, '壽命為 0.8s');
  assert.equal(cinder.delay, 0.3, '延遲為 0.3s');
  assert.equal(cinder.damageBudget, expectedBudget, '預算為符咒非暴擊傷 15%');

  // 2. 命中前未灼燒負向：主爆實傷但無 fireBurnEnds 不產餘燼
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  const unburnedTarget = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([unburnedTarget]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.weapons(1.85);
  assert.ok(unburnedTarget.hp < 100, '主爆造成實傷');
  assert.equal(probe.getDragonScorches().length, 0, '未灼燒目標被炸絕不產生餘燼');

  // 3. 護盾負向：無實傷不產餘燼
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  const shieldedTarget = { x: 200, y: 100, hp: 100, maxHp: 100, shield: true, type: 'tank', fireBurnEnds: 5.0 };
  probe.setEnemies([shieldedTarget]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.weapons(1.85);
  assert.equal(shieldedTarget.hp, 100, '護盾抵擋傷害');
  assert.equal(probe.getDragonScorches().length, 0, '護盾敵無實傷絕不產生餘燼');

  // 4. mut_splitblast 次爆零觸發
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  probe.setBuildMutations(['mut_splitblast']);
  const splitTarget = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([splitTarget]);
  probe.getSplitblasts().push({
    x: 200, y: 100, delay: 0.05, radius: 50,
    directDamage: 2.0, splashDamage: 1.0,
    primaryTarget: splitTarget, level: 3, hits: new Set(), triggered: false
  });
  probe.setWT('boom', 999);
  probe.weapons(0.06);
  assert.ok(splitTarget.hp < 100, '次爆造成傷害');
  assert.equal(probe.getDragonScorches().length, 0, '次爆命中灼燒目標亦絕對不得產生餘燼');
});

// ── 86. fan 與 Lv5 同 cast 多符共享 1 處額度、直擊優先再濺射 ─────────
test('M1-D-86 Fan and Lv5 cast-sharing: multi-talisman cast generates at most 1 cinder; direct hit takes priority over splash', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().fire = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_cinderseal']);
  probe.setBuildMutations(['mut_fan']); // mut_fan 使 count = 3 + 2 = 5 符齊射

  // 1. 同 cast 內直擊與濺射均灼燒：直擊優先產 1 處餘燼，濺射不額外產生
  probe.getDragonScorches().length = 0;
  const primaryFoe = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  const splashFoe = { x: 220, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([primaryFoe, splashFoe]);
  probe.setWT('boom', 0);
  probe.weapons(0.001); // 齊射 5 符

  assert.equal(probe.getProj().length, 5, 'fan 生成 5 枚符咒');
  probe.weapons(0.125); // OFUDA 飛行速度 ×2，飛行步長減半。
  probe.weapons(1.6);

  assert.ok(primaryFoe.hp < 100, '主目標受直擊');
  assert.ok(splashFoe.hp < 100, '副目標受濺射');
  assert.equal(probe.getDragonScorches().length, 1, '多符齊射且直擊濺射均合格，整 cast 嚴格僅產生 1 處餘燼');
  assert.equal(probe.getDragonScorches()[0].x, primaryFoe.x, '餘燼錨定於直擊合格點');

  // 2. 直擊未灼燒、濺射灼燒：直擊不觸發，由首個合格濺射命中點產生 1 處餘燼
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  const unburnedPrimary = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  const burnedSplash = { x: 220, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  const burnedSplash2 = { x: 230, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([unburnedPrimary, burnedSplash, burnedSplash2]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.weapons(0.125); // OFUDA 飛行速度 ×2，飛行步長減半。
  probe.weapons(1.6);

  assert.equal(probe.getDragonScorches().length, 1, '直擊未灼燒時由合格濺射產 1 處餘燼，同 cast 後續濺射不重複');
  assert.equal(probe.getDragonScorches()[0].x, burnedSplash.x, '餘燼錨定於首個合格濺射點');

  // 3. Lv5 覺醒兩儀延爆（2 枚符咒）：整 cast 依然僅 1 處餘燼
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  probe.setBuildMutations([]);
  probe.getWL().boom = 5;
  const foeA = { x: 200, y: 90, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  const foeB = { x: 200, y: 110, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([foeA, foeB]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  assert.equal(probe.getProj().length, 2, 'Lv5 兩儀延爆生成 2 枚符咒');
  probe.weapons(0.125); // OFUDA 飛行速度 ×2，飛行步長減半。
  probe.weapons(1.6);
  assert.equal(probe.getDragonScorches().length, 1, 'Lv5 雙符齊射整 cast 依然僅 1 處餘燼');
});

// ── 87. 餘燼時序（0.3s延遲）、出生幀不扣、單次tick、3敵預算分攤 <=15%、無再派生 ──
test('M1-D-87 Cinder timing (0.3s), birth dt not deducted, single tick, 3-target budget split <= 15%, no extra procs, and after-image retention', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().fire = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_cinderseal']);

  // 1. 出生幀 dt 不扣：當幀生成時 delay 保持 0.3
  const target = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([target]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.weapons(0.125); // OFUDA 飛行速度 ×2，飛行步長減半。
  probe.weapons(1.6); // 爆炸當幀生成餘燼
  assert.equal(probe.getDragonScorches().length, 1);
  const cinder = probe.getDragonScorches()[0];
  assert.equal(cinder.delay, 0.3, '出生當幀 delay 保持 0.3，不扣出生前 dt');

  // 2. 時序推進：未滿 0.3s 不扣血
  probe.setWT('boom', 999);
  probe.setWT('fire', 999);
  probe.setWT('katana', 999);
  probe.getP().x = 800;
  probe.getP().y = 800;
  const e1 = { x: 210, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const e2 = { x: 220, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const e3 = { x: 230, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  const e4 = { x: 240, y: 100, hp: 50, maxHp: 50, type: 'normal' };
  probe.setEnemies([e1, e2, e3, e4]);

  // 前進 0.15s (未達 0.3s)
  probe.weapons(0.15);
  assert.equal(e1.hp, 50, '未達 0.3s 前不得結算傷害');

  // 前進 0.16s (累計 0.31s >= 0.3s 觸發單次 tick)
  probe.weapons(0.16);
  assert.equal(cinder.ticked, true, '0.3s 到達後觸發 tick 並標記 ticked');

  // 3. 預算分攤驗證：最多 3 敵均分，總額 <= damageBudget + 1e-9
  const loss1 = 50 - e1.hp;
  const loss2 = 50 - e2.hp;
  const loss3 = 50 - e3.hp;
  const loss4 = 50 - e4.hp;
  const totalLoss = loss1 + loss2 + loss3;
  assert.ok(loss1 > 0 && loss2 > 0 && loss3 > 0, '前 3 隻有效目標獲得分攤傷害');
  assert.equal(loss4, 0, '超過 3 隻名額之第 4 敵不受傷害');
  assert.ok(Math.abs(loss1 - cinder.damageBudget / 3) < 1e-9, '3 敵平分預算');
  assert.ok(totalLoss <= cinder.damageBudget + 1e-9, `實扣總額 (${totalLoss}) 嚴格不得超標 (${cinder.damageBudget})`);

  // 4. 無再派生：不附 burn、不附 frost、不暴擊
  assert.ok(!e1.fireBurnEnds, '餘燼命中不附 burn');
  assert.ok(!e1.frostHits, '餘燼命中不附 frost');

  // 5. 單次 tick 後僅留餘像，後續時間步進不再扣血，保留至 0.8s 結束
  probe.weapons(0.2); // 累計 0.51s
  assert.equal(50 - e1.hp, loss1, 'tick 後不再重覆扣血');
  assert.equal(probe.getDragonScorches().length, 1, '餘燼視覺餘像留存至 0.8s');

  probe.weapons(0.35); // 累計 0.86s >= 0.8s
  assert.equal(probe.getDragonScorches().length, 0, '0.8s 壽命耗盡後自陣列移除');
});

// ── 88. 焦土容器上限3略過、黑龍優先互斥、scorchReady限頻、快照隔離與清理 ─────
test('M1-D-88 Dragon scorch container cap 3, dragon priority over cinder, scorchReady cooldown, in-flight isolation, and lifecycle cleanup', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  probe.start('night-town');

  probe.getP().x = 100;
  probe.getP().y = 100;
  probe.getWL().fire = 3;
  probe.getWL().boom = 3;
  probe.setBuildDuos(['duo_cinderseal']);

  // 1. 焦土容器共同上限 3：滿額時略過新餘燼，絕不剔除原黑龍焦土
  probe.getDragonScorches().length = 0;
  probe.getDragonScorches().push(
    { x: 10, y: 10, r: 140, life: 4.0, maxLife: 5.0, tick: 0.6, scorchDamage: 2.0, dragonOriginal: true },
    { x: 20, y: 20, r: 140, life: 4.0, maxLife: 5.0, tick: 0.6, scorchDamage: 2.0, dragonOriginal: true },
    { x: 30, y: 30, r: 140, life: 4.0, maxLife: 5.0, tick: 0.6, scorchDamage: 2.0, dragonOriginal: true }
  );
  assert.equal(probe.getDragonScorches().length, 3);

  // 主爆命中灼燒怪
  const target = { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 };
  probe.setEnemies([target]);
  probe.setWT('boom', 0);
  probe.weapons(0.001);
  probe.weapons(0.25);
  probe.weapons(1.6); // 爆炸

  assert.equal(probe.getDragonScorches().length, 3, '滿額 3 處時略過新餘燼，佇列不上溢');
  assert.ok(probe.getDragonScorches().every(s => s.dragonOriginal), '絕不剔除原黑龍焦土');

  // 2. 活龍焦土覆蓋敵由黑龍優先，餘燼不疊傷
  probe.getDragonScorches().length = 0;
  // 設置一處活龍焦土覆蓋 (200, 100)
  probe.getDragonScorches().push({
    x: 200, y: 100, r: 140, life: 3.0, maxLife: 5.0, tick: 0.6, scorchDamage: 2.0
  });
  // 設置一處已到時的餘燼在同位置
  probe.getDragonScorches().push({
    x: 200, y: 100, r: 64, life: 0.5, maxLife: 0.8, delay: 0, ticked: false, damageBudget: 1.0, isCinder: true
  });
  const dragonCoveredFoe = { x: 205, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([dragonCoveredFoe]);
  probe.setWT('boom', 999);
  probe.setWT('fire', 999);

  probe.weapons(0.01);
  assert.equal(probe.getDragonScorches()[1].ticked, true, '餘燼執行 tick');
  assert.equal(dragonCoveredFoe.hp, 100, '活龍焦土覆蓋之敵人由原龍優先，餘燼絕不搶傷或疊傷');

  // 3. scorchReady 限頻：雙餘燼重疊不疊傷
  probe.getDragonScorches().length = 0;
  probe.getDragonScorches().push(
    { x: 200, y: 100, r: 64, life: 0.5, maxLife: 0.8, delay: 0, ticked: false, damageBudget: 1.0, isCinder: true },
    { x: 200, y: 100, r: 64, life: 0.5, maxLife: 0.8, delay: 0, ticked: false, damageBudget: 1.0, isCinder: true }
  );
  const foe = { x: 205, y: 100, hp: 100, maxHp: 100, type: 'normal' };
  probe.setEnemies([foe]);
  probe.weapons(0.01);
  assert.equal(100 - foe.hp, 1.0, '重疊餘燼僅首處命中，第二處受限頻保護不造成重疊傷害');

  // 4. 選卡在途快照隔離：選卡前已投擲之符咒不帶 hasDuoCinderseal，選卡後爆炸不產餘燼
  probe.getDragonScorches().length = 0;
  probe.getProj().length = 0;
  const inFlightOfuda = {
    x: 200, y: 100, vx: 0, vy: 0, speed: 440, life: 1.0, fuse: 0.05, stuck: true,
    target: { x: 200, y: 100, hp: 100, maxHp: 100, type: 'normal', fireBurnEnds: 5.0 },
    damage: 3.0, splashDamage: 0.6, radius: 100, level: 3,
    hasDuoCinderseal: false // 舊在途快照
  };
  probe.getProj().push(inFlightOfuda);
  probe.setEnemies([inFlightOfuda.target]);
  probe.weapons(0.06); // 舊符爆炸
  assert.equal(probe.getDragonScorches().length, 0, '選卡前已在途之符咒快照隔離，絕不觸發餘燼');

  // 5. pause 與 levelup 凍結
  probe.getDragonScorches().push({
    x: 100, y: 100, r: 64, life: 0.8, maxLife: 0.8, delay: 0.3, isCinder: true, ticked: false, damageBudget: 1.0
  });
  probe.setState('pause');
  probe.update(0.1);
  assert.equal(probe.getDragonScorches()[0].delay, 0.3, 'pause 狀態下凍結餘燼延遲');

  probe.setState('levelup');
  probe.update(0.1);
  assert.equal(probe.getDragonScorches()[0].delay, 0.3, 'levelup 狀態下凍結餘燼延遲');
  probe.setState('play');

  // 6. startVictorySequence 與 loseRun 清理
  probe.startVictorySequence();
  assert.equal(probe.getDragonScorches().length, 0, 'startVictorySequence 清空 dragonScorches');

  probe.getDragonScorches().push({ x: 0, y: 0, r: 64, life: 0.8, maxLife: 0.8, delay: 0.3, isCinder: true });
  probe.loseRun();
  assert.equal(probe.getDragonScorches().length, 0, 'loseRun 清空 dragonScorches');

  // 7. start 重設 buildDuos
  probe.getBuildDuos().push('duo_cinderseal');
  probe.start('night-town');
  assert.equal(probe.getBuildDuos().length, 0, 'start 重置 buildDuos 為空陣列');
});

module.exports = { loadGameSandbox };
