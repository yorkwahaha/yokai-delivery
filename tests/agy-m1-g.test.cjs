// tests/agy-m1-g.test.cjs
// M1-G-R1: 單張 runtime / 存檔 consumer 整合測試
// 涵蓋三個合法不同 build 的完整真實流程：
// Build 1: needle (mut_fan + mut_seek + mut_frost)
// Build 2: barrier + thunder (duo_thundercircle)
// Build 3: fire + boom (duo_cinderseal)
// 均固定妖刀、<= 4 主動、<= 3 御守。
// 流程：start -> offerUp/applyChoice -> 6次真實配送(取件+答題+式神結界+讀題dwell+封印獎勵)
//       -> 終王出陣(bossQ答題破盾+真武器打擊擊破) -> 自然victory演出(5.0s settle)至won
//       -> 真 runFrame 結算 STORE.finish -> 重開/返回 BuildState 清空與暫態清理
// 另含 lost 路徑：燈油耗盡 -> lampout sequence -> lost -> STORE.finish(won=false) 不解鎖關卡 -> 重開清理。

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function loadGameSandbox(options = {}) {
  const WINDOW = { width: 900, height: 600 };
  const storage = new Map([
    ['yokai-tutorial-v1', '"skip"'],
    ['yokai-delivery-v1', JSON.stringify({
      best: 0,
      bestDel: 0,
      m: {},
      progress: {
        unlocked: { 'night-town': true },
        completed: {},
        stages: { 'night-town': { bestScore: 0, bestDeliveries: 0, clears: 0, attempts: 0 } }
      }
    })]
  ]);
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

  function createDeterministicRng(seed = 123456789) {
    let s = seed >>> 0;
    return function lcg() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const sandboxMath = Object.create(Math);
  sandboxMath.random = typeof options.random === 'function' ? options.random : createDeterministicRng(options.seed || 42);

  let virtualClock = 1000;
  const env = {
    console,
    Set,
    Map,
    Math: sandboxMath,
    Date,
    JSON,
    URL,
    URLSearchParams,
    performance: { now: () => virtualClock },
    setPerfClock: t => { virtualClock = t; },
    navigator: { userAgent: 'node' },
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v))
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
    },
    Event: class Event { constructor(type) { this.type = type; } },
    CustomEvent: class CustomEvent { constructor(type, opt) { this.type = type; Object.assign(this, opt); } }
  };
  env.window = env;
  env.self = env;
  env.Math = sandboxMath;

  const sandbox = vm.createContext(env);
  const readJs = file => fs.readFileSync(path.join(ROOT, 'js', file), 'utf8');

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
    'story-dialogue.js',
    'card-collection.js',
    'card-delivery-bridge.js'
  ];

  for (const dep of deps) {
    const code = readJs(dep);
    vm.runInContext(code, sandbox, { filename: dep });
  }

  if (sandbox.CONTROLS) sandbox.CONTROLS.mount = () => {};

  // UI stub: 依指令不讀 Grok 動態 ui.js 檔案與動態 SHA，Node 測試只用必要 UI stub 介面
  const RESTART_BTN = { id: 'restart', x: 150, y: 492, w: 180, h: 48 };
  const WORLD_BTN = { id: 'world', x: 360, y: 492, w: 180, h: 48 };
  const HOME_BTN = { id: 'menu', x: 570, y: 492, w: 180, h: 48 };
  const MENU_START_BTN = { id: 'start', x: 318, y: 478, w: 264, h: 54 };
  const MENU_CONTROLS_BTN = { id: 'controls', x: 20, y: 22, w: 180, h: 38 };
  const HINT_BTN = { x: 532, y: 20, w: 78, h: 40 };
  const REROLL_BTN = { x: 620, y: 538, w: 190, h: 44 };
  const TUTORIAL_BTNS = [{ x: 100, y: 390, w: 330, h: 70 }, { x: 470, y: 390, w: 330, h: 70 }];
  const EXIT_BTNS = [{ id: 'exit-cancel', x: 195, y: 330, w: 240, h: 70 }, { id: 'exit-confirm', x: 465, y: 330, w: 240, h: 70 }];
  const MENU_BTNS = [MENU_START_BTN, MENU_CONTROLS_BTN, { id: 'cards', x: 615, y: 22, w: 125, h: 38 }, { id: 'codex', x: 755, y: 22, w: 125, h: 38 }];
  const END_BTNS = [RESTART_BTN, WORLD_BTN, HOME_BTN];
  const PAUSE_BTNS = [
    { id: 'resume', x: 310, y: 250, w: 280, h: 44 },
    { id: 'restart', x: 310, y: 310, w: 280, h: 44 },
    { id: 'world', x: 310, y: 370, w: 280, h: 44 },
    { id: 'menu', x: 310, y: 430, w: 280, h: 44 }
  ];

  sandbox.UI = new Proxy({
    RESTART_BTN, WORLD_BTN, HOME_BTN, MENU_START_BTN, MENU_CONTROLS_BTN, HINT_BTN, REROLL_BTN,
    TUTORIAL_BTNS, EXIT_BTNS, MENU_BTNS, END_BTNS, PAUSE_BTNS,
    PAUSE_BTN_W: 280, PAUSE_BTN_H: 44,
    pauseButtons: () => PAUSE_BTNS,
    levelUpLayout: () => ({ card: { x: 90, y: 176, w: 720, h: 108, gap: 14 }, reroll: REROLL_BTN }),
    bossQuizLayout: () => null,
    codexButtons: () => [],
    codexRows: () => [],
    wordGallery: () => {},
    wordGalleryViewport: () => ({ top: 0, height: 600 }),
    fitText: () => {},
    readableFont: () => 'sans-serif',
    answerFontReady: () => true,
    pressButton: () => {},
    setButtonHover: () => {},
    reviewButtons: () => [],
    drawAssetProgress: () => {},
    drawMainMenu: () => {},
    drawHud: () => {},
    drawButton: () => {},
    drawSurgeWarning: () => {},
    drawTitleCard: () => {},
    drawBossQuiz: () => {},
    drawLevelUp: () => {},
    drawPauseMenu: () => {},
    drawExitConfirm: () => {},
    drawEndScreen: () => {},
    drawCodex: () => {},
    drawTutorial: () => {},
    drawFade: () => {},
    drawWordCue: () => {},
    drawActionIcon: () => {},
    reduce: () => false,
    CARD_LIST: []
  }, {
    get: (target, prop) => (prop in target ? target[prop] : () => {})
  });

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
    clearShake: () => {}
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
      getEligibleChoices: () => getEligibleChoices(),
      resolveAttackSpec: (id, lvl, bs, opt) => resolveAttackSpec(id, lvl, bs, opt),
      getOil: () => oil,
      setOil: v => { oil = v; },
      getMaxOil: () => maxOil,
      getScore: () => score,
      getDelivered: () => delivered,
      getFailed: () => failed,
      getOrders: () => orders,
      getJob: () => job,
      getInter: () => inter,
      interact: () => interact(),
      resolve: i => resolve(i),
      getBossQ: () => bossQ,
      answerBoss: i => answerBoss(i),
      runFrame: now => {
        window.setPerfClock?.(now);
        runFrame(now);
      },
      update: (dt, hitStopped) => update(dt, hitStopped),
      loseRun: () => loseRun(),
      startVictorySequence: () => startVictorySequence(),
      updateLampSequence: dt => updateLampSequence(dt),
      updateVictorySequence: dt => updateVictorySequence(dt),
      activateMenu: id => activateMenu(id),
      returnHome: () => returnHome(),
      getEnded: () => ended,
      getRunSummary: () => runSummary,
      getVictorySeq: () => victorySeq,
      getLampSeq: () => lampSeq,
      getFinalBossDefeated: () => finalBossDefeated,
      getBossStage: () => bossStage,
      setBossStage: v => { bossStage = v; },
      getBossT: () => bossT,
      setBossT: v => { bossT = v; },
      getElapsed: () => elapsed,
      setElapsed: v => { elapsed = v; },
      getGoalDeliveries: () => GOAL_DELIVERIES,
      ansPos: h => ansPos(h),
      makeOrder: () => makeOrder(),
      getStore: () => window.STORE,
      getProj: () => proj,
      getNeedles: () => needles,
      getDragonShots: () => dragonShots,
      getDragonScorches: () => dragonScorches,
      getSplitblasts: () => splitblasts,
      getDuoShockwaves: () => duoShockwaves,
      getInkfireMarks: () => inkfireMarks
    };
  `;

  const instrumentedSrc = rawGameSrc.slice(0, endIdx) + probeCode + rawGameSrc.slice(endIdx);
  vm.runInContext(instrumentedSrc, sandbox, { filename: 'game.js' });

  return sandbox;
}

// 輔助：若因戰鬥拾取靈玉自然觸發升級，由玩家安全選卡恢復 play 狀態
function handleNaturalLevelUp(probe) {
  while (probe.getState() === 'levelup') {
    const choices = probe.getChoices();
    if (!choices || choices.length === 0) break;
    probe.setLevelupCooldown(0);
    const c = choices[0];
    probe.applyChoice(c.choiceId, probe.getBuildRevision());
  }
}

// 輔助：真實配送一次（受控移動到發件處取件，移動到正確答案位置並安心閱讀 dwell，由引擎自然 resolve）
function executeOneDelivery(probe, currentNow) {
  let now = currentNow;
  if (probe.getOrders().length === 0) {
    probe.makeOrder();
  }
  const orders = probe.getOrders();
  assert.ok(orders.length > 0, '必須有待配送任務');
  const o = orders[0];

  // 1. 移動至取件點
  const P = probe.getP();
  P.x = o.from.x;
  P.y = o.from.y;
  now += 50;
  probe.runFrame(now);
  handleNaturalLevelUp(probe);

  assert.equal(probe.getInter(), o, '靠近發件町屋後 inter 正確鎖定目標訂單');

  // 2. 玩家取件
  probe.interact();
  const job = probe.getJob();
  assert.ok(job, 'interact 成功建立 active delivery job');
  assert.equal(job.word.jp, o.word.jp, '任務單字相符');

  // 3. 移動至目標送達點之正確答案位置
  const correctIdx = job.ans.findIndex(w => w.jp === job.word.jp);
  assert.ok(correctIdx >= 0, '答案選項中必須包含正確答案');
  const positions = probe.ansPos(job.to);
  const targetPos = positions[correctIdx];
  assert.ok(targetPos, '必須有對應選項座標');

  P.x = targetPos.x;
  P.y = targetPos.y;

  // 4. 在答案位置持續停留超過 job.lock (0.6s) + READ_DWELL (0.65s) = 1.25s，推進 runFrame 讓引擎自然結算
  const delBefore = probe.getDelivered();
  for (let step = 0; step < 35; step++) {
    now += 50; // 35 * 50ms = 1.75s > 1.25s
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
    if (!probe.getJob()) break; // 結算完成
  }

  assert.equal(probe.getJob(), null, '完成停留後 job 自然結算清空');
  assert.equal(probe.getDelivered(), delBefore + 1, 'delivered 計數自然加 1');
  return now;
}

// 輔助：受控選卡（反覆合法 offerUp 抽取目標卡片，經真實 applyChoice 升級）
function executeControlledUpgrade(probe, choiceId) {
  let card = null;
  for (let i = 0; i < 200 && !card; i++) {
    probe.setXp(probe.getXpNeed());
    probe.offerUp();
    probe.setLevelupCooldown(0);
    card = probe.getChoices().find(c => c.choiceId === choiceId);
  }
  assert.ok(card, `合法抽得目標卡片: ${choiceId}`);
  const rev = probe.getBuildRevision();
  const res = probe.applyChoice(choiceId, rev);
  assert.equal(res.ok, true, `applyChoice 成功套用: ${choiceId}`);
  assert.equal(probe.getState(), 'play', '選卡後狀態恢復為 play');
}

// 輔助：終王決戰（排程出陣、bossQ 破盾、真武器打擊擊破）
function executeBossDefeat(probe, currentNow) {
  let now = currentNow;

  // 1. 排程出陣（受控設置時程至 540s 終王節點）
  probe.setBossStage(3);
  probe.setBossT(0);
  probe.setElapsed(540);
  now += 50;
  probe.runFrame(now);
  handleNaturalLevelUp(probe);

  const enemies = probe.getEnemies();
  const boss = enemies.find(e => e.type === 'boss' && e.final && e.hp > 0);
  assert.ok(boss, '終王成功出陣，具備 final 標記');
  assert.equal(boss.shield, true, '終王起始具備言語護盾');

  // 2. 移動至 Boss 附近引發 Boss 考驗，並停留 0.75s 渡過 bossQ.lock
  const P = probe.getP();
  P.x = boss.x;
  P.y = boss.y + 100;
  for (let f = 0; f < 15; f++) {
    now += 50;
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }

  const bossQ = probe.getBossQ();
  assert.ok(bossQ, '靠近終王後觸發 bossQ 考題');
  assert.ok(bossQ.lock <= 0, 'bossQ.lock 倒數歸零');
  const correctIdx = bossQ.ans.findIndex(w => w.jp === boss.word.jp);
  assert.ok(correctIdx >= 0, 'bossQ 選項中包含正確詞');

  // 3. 正確回答 Boss 考驗破除結界
  probe.answerBoss(correctIdx);
  assert.equal(boss.shield, false, '正確答題破除終王護盾');

  // 4. 真武器打擊消滅 Boss（面朝 Boss，推進 runFrame 讓武器打擊 Boss 直至死亡）
  P.faceAng = 0; // 朝向右方
  probe.getB().dmg = 35; // 受控戰鬥輸出加速，使 1400 HP 終王能由真實武器在合理幀數內擊破
  let maxCombatFrames = 350;
  const initialHp = boss.hp;
  while (boss.hp > 0 && maxCombatFrames-- > 0) {
    P.x = boss.x - 30; // 位於 Boss 左側 30px
    P.y = boss.y;
    P.faceAng = 0;
    // 補給燈油以防超長戰鬥耗盡
    if (probe.getOil() < 40) probe.setOil(80);
    now += 50;
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }

  assert.ok(boss.hp <= 0, '終王受到真武器打擊後生命歸零');
  assert.equal(probe.getFinalBossDefeated(), true, 'finalBossDefeated 正確寫入');
  return now;
}

// 輔助：推進勝利演出至 won 並由 runFrame 觸發 STORE.finish 結算
function executeVictoryToSettlement(probe, currentNow) {
  let now = currentNow;
  assert.equal(probe.getState(), 'victory', 'Boss 擊破後自然進入 victory 狀態');
  assert.ok(probe.getVictorySeq(), 'victorySeq 自然建立');

  // 推進演出時間（VICTORY.settle = 5.0 秒，以 50ms 推進 110 幀 = 5.5s）
  for (let f = 0; f < 110; f++) {
    now += 50;
    probe.runFrame(now);
    if (probe.getState() === 'won') break;
  }

  assert.equal(probe.getState(), 'won', '演出結束自然轉為 won 狀態');

  // 下一個 runFrame 幀應自然觸發 STORE.finish
  assert.equal(probe.getEnded(), true, 'runFrame 結算完成，ended 為 true');
  const summary = probe.getRunSummary();
  assert.ok(summary, 'runSummary 結算摘要自然建立');
  assert.equal(summary.stageName, '夜行町');

  // 等待 endCooldown (0.8s) 倒數結束，使後續 activateMenu('restart') 能合法觸發
  for (let f = 0; f < 25; f++) {
    now += 50;
    probe.runFrame(now);
  }

  return now;
}

// ── 1. Build 1: 天狐靈針組合 (mut_fan + mut_seek + mut_frost) 受控結算路徑 ──
test('M1-G-1 Build 1 (Needle: fan+seek+frost) controlled settlement path: start -> offerUp/applyChoice -> 6 deliveries -> boss -> victory -> won -> STORE.finish -> restart clean', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  const store = probe.getStore();
  let now = 1000;

  // 1. 真實 start
  probe.start('night-town');
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getDelivered(), 0);
  assert.equal(probe.getWL().katana, 1);
  assert.equal(probe.getWL().needle, 0);

  // 2. 真實選卡建立 Build 1: needle Lv1, mut_fan, mut_seek, mut_frost, charm_step
  executeControlledUpgrade(probe, 'weapon:needle:1');
  assert.equal(probe.getWL().needle, 1, '成功習得天狐靈針 Lv1');

  executeControlledUpgrade(probe, 'mutation:needle:mut_fan');
  assert.ok(probe.getBuildMutations().includes('mut_fan'), '變異 mut_fan 成功寫入');

  executeControlledUpgrade(probe, 'mutation:needle:mut_seek');
  assert.ok(probe.getBuildMutations().includes('mut_seek'), '變異 mut_seek 成功寫入');

  executeControlledUpgrade(probe, 'mutation:needle:mut_frost');
  assert.ok(probe.getBuildMutations().includes('mut_frost'), '變異 mut_frost 成功寫入');

  executeControlledUpgrade(probe, 'charm:charm_step');
  assert.ok(probe.getBuildCharms().includes('charm_step'), '御守 charm_step 成功寫入');

  assert.equal(probe.getBuildMutations().length, 3, '靈針 3 變異槽滿');
  assert.equal(probe.getBuildCharms().length, 1, '御守 1 槽');
  assert.equal(probe.getBuildDuos().length, 0, '未啟用 Duo');

  // 3. 讀取真 pacing / GOAL_DELIVERIES 驗證 night-town 目標為 6 筆配送
  const stagePacing = env.CONTENT.getStage('night-town').pacing;
  assert.equal(stagePacing.goalDeliveries, 6, 'GDD §3 與 words.js night-town pacing 定義 goalDeliveries 為 6');
  assert.equal(probe.getGoalDeliveries(), 6, 'game.js 消費之 GOAL_DELIVERIES 契約相符為 6');

  // 4. 真實 6 次配送與取件答題
  for (let i = 1; i <= 6; i++) {
    now = executeOneDelivery(probe, now);
    assert.equal(probe.getDelivered(), i, `成功完成第 ${i} 次配送`);
    if (i === 3) assert.equal(probe.getSeals(), 1, '第 3 次配送獲得 1 覺醒印');
    if (i === 6) assert.equal(probe.getSeals(), 2, '第 6 次配送獲得 2 覺醒印');
  }
  assert.equal(probe.getDelivered(), 6, '完成全部 6 次配送目標');

  // 5. 負向反例：6 筆配送達標但未擊敗終王時，即使經過 600 秒 (DAWN) 也絕不能獲勝！
  probe.setElapsed(620); // 超過 600s DAWN 黎明線
  for (let f = 0; f < 20; f++) {
    now += 50;
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }
  assert.equal(probe.getState(), 'play', '未擊敗終王時狀態保持 play，絕非 won 或 victory');
  assert.equal(probe.getVictorySeq(), null, '未擊敗終王不得建立 victorySeq');
  assert.equal(probe.getEnded(), false, '未擊敗終王不得結算 ended');
  assert.equal(store.isStageCompleted('night-town'), false, '未擊敗終王不得標記 completed');

  // 6. 終王對決（考題破盾 + 真武器打擊）
  now = executeBossDefeat(probe, now);

  // 7. 勝利演出自然流暢至 won 並結算 STORE.finish
  now = executeVictoryToSettlement(probe, now);

  // 8. 存檔驗證（STORE 狀態）
  const stats = store.getStageStats('night-town');
  assert.equal(stats.clears, 1, 'STORE 通關次數正確遞增為 1');
  assert.equal(store.isStageCompleted('night-town'), true, 'night-town 標記為 completed');
  assert.equal(store.isStageUnlocked('rain-port'), true, '下一關 rain-port 正確解鎖');

  // 9. 重新開始（restart），驗證 BuildState 清空與暫態清理
  probe.activateMenu('restart');
  assert.equal(probe.getState(), 'play', '重開後回到 play 狀態');
  assert.equal(probe.getDelivered(), 0, '配送計數歸零');
  assert.equal(probe.getWL().katana, 1, '妖刀恢復 Lv1');
  assert.equal(probe.getWL().needle, 0, '靈針已清空');
  assert.equal(probe.getBuildMutations().length, 0, 'buildMutations 完全清空');
  assert.equal(probe.getBuildCharms().length, 0, 'buildCharms 完全清空');
  assert.equal(probe.getBuildDuos().length, 0, 'buildDuos 完全清空');
  assert.equal(probe.getNeedles().length, 0, '針投射物佇列清空');
  assert.equal(probe.getEnemies().length, 0, '敵人佇列清空');
});

// ── 2. Build 2: 雷紋陣組合 (barrier + thunder + duo_thundercircle) 受控結算路徑 ──
test('M1-G-2 Build 2 (Barrier+Thunder: duo_thundercircle) controlled settlement path: start -> offerUp/applyChoice -> 6 deliveries -> boss -> victory -> won -> STORE.finish -> restart clean', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  const store = probe.getStore();
  let now = 1000;

  probe.start('night-town');

  // 1. 真實選卡建立 Build 2: barrier Lv3, thunder Lv3, duo_thundercircle, charm_power
  executeControlledUpgrade(probe, 'weapon:barrier:1');
  executeControlledUpgrade(probe, 'weapon:barrier:2');
  executeControlledUpgrade(probe, 'weapon:barrier:3');
  executeControlledUpgrade(probe, 'weapon:thunder:1');
  executeControlledUpgrade(probe, 'weapon:thunder:2');
  executeControlledUpgrade(probe, 'weapon:thunder:3');

  executeControlledUpgrade(probe, 'duo:duo_thundercircle');
  assert.ok(probe.getBuildDuos().includes('duo_thundercircle'), '共鳴奧義 duo_thundercircle 成功寫入');

  executeControlledUpgrade(probe, 'charm:charm_power');
  assert.ok(probe.getBuildCharms().includes('charm_power'), '御守 charm_power 成功寫入');

  assert.equal(probe.getWL().barrier, 3);
  assert.equal(probe.getWL().thunder, 3);
  assert.equal(probe.getBuildDuos().length, 1);
  assert.equal(probe.getBuildCharms().length, 1);

  // 2. 真實 6 次配送
  for (let i = 1; i <= 6; i++) {
    now = executeOneDelivery(probe, now);
  }
  assert.equal(probe.getDelivered(), 6);

  // 3. 終王對決（落雷、結界與雷紋衝擊共同打擊）
  now = executeBossDefeat(probe, now);

  // 4. 自然勝利演出至結算
  now = executeVictoryToSettlement(probe, now);

  // 5. 存檔驗證
  const stats = store.getStageStats('night-town');
  assert.equal(stats.clears, 1);
  assert.equal(store.isStageCompleted('night-town'), true);

  // 6. 重開清理驗證
  probe.activateMenu('restart');
  assert.equal(probe.getBuildDuos().length, 0, 'buildDuos 重開後清空');
  assert.equal(probe.getBuildCharms().length, 0, 'buildCharms 重開後清空');
  assert.equal(probe.getDuoShockwaves().length, 0, 'duoShockwaves 暫態佇列清空');
});

// ── 3. Build 3: 餘燼符組合 (fire + boom + duo_cinderseal) 受控結算路徑 ──
test('M1-G-3 Build 3 (Fire+Boom: duo_cinderseal) controlled settlement path: start -> offerUp/applyChoice -> 6 deliveries -> boss -> victory -> won -> STORE.finish -> restart clean', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  const store = probe.getStore();
  let now = 1000;

  probe.start('night-town');

  // 1. 真實選卡建立 Build 3: fire Lv3, boom Lv3, duo_cinderseal, charm_gather
  executeControlledUpgrade(probe, 'weapon:fire:1');
  executeControlledUpgrade(probe, 'weapon:fire:2');
  executeControlledUpgrade(probe, 'weapon:fire:3');
  executeControlledUpgrade(probe, 'weapon:boom:1');
  executeControlledUpgrade(probe, 'weapon:boom:2');
  executeControlledUpgrade(probe, 'weapon:boom:3');

  executeControlledUpgrade(probe, 'duo:duo_cinderseal');
  assert.ok(probe.getBuildDuos().includes('duo_cinderseal'), '共鳴奧義 duo_cinderseal 成功寫入');

  executeControlledUpgrade(probe, 'charm:charm_gather');
  assert.ok(probe.getBuildCharms().includes('charm_gather'), '御守 charm_gather 成功寫入');

  assert.equal(probe.getWL().fire, 3);
  assert.equal(probe.getWL().boom, 3);
  assert.equal(probe.getBuildDuos().length, 1);

  // 2. 真實 6 次配送
  for (let i = 1; i <= 6; i++) {
    now = executeOneDelivery(probe, now);
  }
  assert.equal(probe.getDelivered(), 6);

  // 3. 終王對決（狐火燃燒、符咒引爆與餘燼灼燒打擊）
  now = executeBossDefeat(probe, now);

  // 4. 自然勝利演出至結算
  now = executeVictoryToSettlement(probe, now);

  // 5. 存檔驗證
  const stats = store.getStageStats('night-town');
  assert.equal(stats.clears, 1);
  assert.equal(store.isStageCompleted('night-town'), true);

  // 6. 重開清理驗證
  probe.activateMenu('restart');
  assert.equal(probe.getBuildDuos().length, 0, 'buildDuos 重開後清空');
  assert.equal(probe.getBuildCharms().length, 0, 'buildCharms 重開後清空');
  assert.equal(probe.getDragonScorches().length, 0, 'dragonScorches 焦土與餘燼佇列清空');
});

// ── 4. 失敗 (lost) 存檔路徑與重開清理防線 ──
test('M1-G-4 Defeat (lost) controlled settlement path: oil depletion -> lampout sequence -> lost -> STORE.finish(won=false) no clear -> restart clean', () => {
  const env = loadGameSandbox();
  const probe = env.__agyProbe;
  const store = probe.getStore();
  let now = 1000;

  probe.start('night-town');

  // 進行 1 次有效配送取得分數與記錄
  now = executeOneDelivery(probe, now);
  assert.equal(probe.getDelivered(), 1);
  const scoreBefore = probe.getScore();
  assert.ok(scoreBefore > 0, '獲得配送分數');

  // 消耗燈油至 0 觸發失敗演出
  probe.setOil(0);
  now += 50;
  probe.runFrame(now);

  assert.equal(probe.getState(), 'lampout', '油量耗盡轉為 lampout 狀態');
  assert.ok(probe.getLampSeq(), 'lampSeq 序列已建立');

  // 推進熄燈演出時間（LAMPOUT.snuff + LAMPOUT.dark = 0.8 + 2.0 = 2.8s，以 50ms 推進 65 幀 = 3.25s）
  for (let f = 0; f < 65; f++) {
    now += 50;
    probe.runFrame(now);
    if (probe.getState() === 'lost') break;
  }

  assert.equal(probe.getState(), 'lost', '熄燈演出後自然轉為 lost');

  // 下一幀結算 STORE.finish(..., won=false)
  assert.equal(probe.getEnded(), true, 'ended 標記為 true');

  // 驗證存檔未解鎖關卡且未增加通關數
  const stats = store.getStageStats('night-town');
  assert.equal(stats.clears, 0, '失敗不增加通關數');
  assert.equal(store.isStageCompleted('night-town'), false, '失敗不解鎖本關完成');
  assert.equal(store.isStageUnlocked('rain-port'), false, '失敗絕不解鎖下一關');
  assert.equal(stats.bestDeliveries, 1, '記錄本次最高配送數 1');
  assert.equal(stats.bestScore, scoreBefore, '記錄本次最高分數');

  // 等待 endCooldown (1.0s) 倒數結束，使後續 activateMenu('restart') 能合法觸發
  for (let f = 0; f < 25; f++) {
    now += 50;
    probe.runFrame(now);
  }

  // 重開驗證
  probe.activateMenu('restart');
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getOil(), 100, '燈油恢復 100');
  assert.equal(probe.getDelivered(), 0, '配送數重置為 0');
});

// ── 5. 回歸防線：真武器擊殺終王且帶待升 XP 時，自然進入 victory 絕不碰撞 levelup ──
test('M1-G-5 Regression: real weapons kill final boss with pending levelup XP (xp >= xpNeed) enters victory sequence without levelup collision', () => {
  const env = loadGameSandbox({ seed: 777 });
  const probe = env.__agyProbe;
  const store = probe.getStore();
  let now = 1000;

  probe.start('night-town');

  // 1. 完成 6 筆配送達成通關目標
  for (let i = 1; i <= 6; i++) {
    now = executeOneDelivery(probe, now);
  }
  assert.equal(probe.getDelivered(), 6, '6 筆配送達標');

  // 2. 終王出陣
  probe.setBossStage(3);
  probe.setBossT(0);
  probe.setElapsed(540);
  now += 50;
  probe.runFrame(now);
  handleNaturalLevelUp(probe);

  const boss = probe.getEnemies().find(e => e.type === 'boss' && e.final && e.hp > 0);
  assert.ok(boss, '終王成功出陣');

  // 破盾停留
  const P = probe.getP();
  P.x = boss.x;
  P.y = boss.y + 100;
  for (let f = 0; f < 15; f++) {
    now += 50;
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }
  const bossQ = probe.getBossQ();
  assert.ok(bossQ && bossQ.lock <= 0);
  const correctIdx = bossQ.ans.findIndex(w => w.jp === boss.word.jp);
  probe.answerBoss(correctIdx);
  assert.equal(boss.shield, false, '終王言語護盾破除');

  // 3. 明確標記低 HP fixture (2 HP <= 妖刀單發傷 2.64) 與待升滿額 XP 條件
  boss.hp = 2;
  probe.setXp(probe.getXpNeed());
  assert.ok(probe.getXp() >= probe.getXpNeed(), '驗證擊殺前已有待升級滿額 XP');

  // 4. 真武器打擊消滅 Boss：面朝 Boss，由妖刀真傷結算擊殺
  P.x = boss.x - 20;
  P.y = boss.y;
  P.faceAng = 0;
  probe.setWT('katana', 0); // 讓妖刀立即揮出真斬

  let combatFrames = 0;
  while (boss.hp > 0 && combatFrames++ < 20) {
    now += 50;
    probe.runFrame(now);
  }

  assert.ok(boss.hp <= 0, '真武器打擊致終王生命歸零');
  assert.equal(probe.getFinalBossDefeated(), true, 'finalBossDefeated 正確寫入');

  // 關鍵回歸斷言：儘管 xp >= xpNeed() 且擊殺掉落 48 XP 靈玉，狀態必須為 victory，絕不可被 offerUp() 覆寫為 levelup！
  assert.equal(probe.getState(), 'victory', '終王死亡且具備待升 XP 時狀態必為 victory，絕不被 offerUp 碰撞');
  assert.ok(probe.getVictorySeq(), 'victorySeq 正常啟動並維持');

  // 5. 推進演出至結算
  now = executeVictoryToSettlement(probe, now);
  assert.equal(probe.getState(), 'won', '順利進入 won 狀態');
  assert.equal(store.isStageCompleted('night-town'), true, 'STORE 正確完成夜行町通關記錄');
});
