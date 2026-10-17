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
    const knownBosses = new Set();
    const bossSpawnLog = [];
    const choiceLog = [];
    let currentSource = 'controlled';

    function observeBossEvents() {
      for (const e of enemies) {
        if (e.type === 'boss' && !e.dying && !knownBosses.has(e)) {
          knownBosses.add(e);
          bossSpawnLog.push({
            index: e.bossIndex,
            role: e.role,
            hp: e.hp,
            maxHp: e.max,
            spawnElapsed: Number(elapsed.toFixed(2)),
            shield: e.shield,
            bossRef: e,
            deathElapsed: null,
            defeated: false
          });
        }
      }
      for (const b of bossSpawnLog) {
        if (!b.defeated && b.bossRef.hp <= 0) {
          b.deathElapsed = Number(elapsed.toFixed(2));
          b.defeated = true;
        }
      }
    }

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
      start: id => {
        start(id);
        knownBosses.clear();
        bossSpawnLog.length = 0;
        choiceLog.length = 0;
      },
      offerUp: () => offerUp(),
      applyChoice: (id, rev, meta = {}) => {
        const cLevel = level;
        const cXp = xp;
        const cElapsed = elapsed;
        const cXpNeed = xpNeed();
        const res = applyChoice(id, rev);
        if (res && res.ok) {
          choiceLog.push({
            step: choiceLog.length + 1,
            choiceId: id,
            source: meta.source || currentSource,
            elapsed: Number(cElapsed.toFixed(2)),
            level: cLevel,
            xp: cXp,
            xpNeed: cXpNeed,
            offerAttempts: meta.offerAttempts || 1
          });
        }
        return res;
      },
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
        observeBossEvents();
      },
      getBossSpawnLog: () => bossSpawnLog,
      getChoiceLog: () => choiceLog,
      setChoiceSource: s => { currentSource = s; },
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
      getInkfireMarks: () => inkfireMarks,
      confirmOverworld: () => confirmOverworld(),
      enterOverworld: r => enterOverworld(r),
      getOverworld: () => overworld,
      moveOverworld: (dx, dy) => moveOverworld(dx, dy)
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
    probe.applyChoice(c.choiceId, probe.getBuildRevision(), { source: 'natural', offerAttempts: 1 });
  }
}

// 輔助：真實配送一次（受控移動到發件處取件，移動到正確答案位置並安心閱讀 dwell，由引擎自然 resolve）
function executeOneDelivery(probe, currentNow, deliveryLog) {
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
  if (Array.isArray(deliveryLog)) {
    deliveryLog.push({
      index: probe.getDelivered(),
      elapsed: Number(probe.getElapsed().toFixed(2)),
      word: o.word.jp
    });
  }
  return now;
}

// 輔助：受控選卡（反覆合法 offerUp 抽取目標卡片，經真實 applyChoice 升級）
function executeControlledUpgrade(probe, choiceId) {
  let card = null;
  let attempts = 0;
  for (let i = 0; i < 200 && !card; i++) {
    attempts++;
    probe.setXp(probe.getXpNeed());
    probe.offerUp();
    probe.setLevelupCooldown(0);
    card = probe.getChoices().find(c => c.choiceId === choiceId);
  }
  assert.ok(card, `合法抽得目標卡片: ${choiceId}`);
  const rev = probe.getBuildRevision();
  const res = probe.applyChoice(choiceId, rev, { source: 'controlled', offerAttempts: attempts });
  assert.equal(res.ok, true, `applyChoice 成功套用: ${choiceId}`);
  assert.equal(probe.getState(), 'play', '選卡後狀態恢復為 play');
}

// 輔助：受控走位與自動巡邏避敵（計算排斥向量遠離妖怪，自然時鐘推進 runFrame）
function boundedStepTo(probe, currentNow, targetElapsed) {
  let now = currentNow;
  let maxFrames = 12000; // 600s max
  while (probe.getElapsed() < targetElapsed && probe.getState() === 'play' && maxFrames-- > 0) {
    now += 50;
    const P = probe.getP();
    const t = now / 1000;
    // 基礎巡邏路徑
    let vx = -Math.sin(t * 0.4) * 80;
    let vy = Math.cos(t * 0.4) * 80;

    // 主動避敵：遠離 110px 內的妖怪避免碰撞創傷
    const enemies = probe.getEnemies();
    let repX = 0, repY = 0;
    for (const e of enemies) {
      if (e.hp > 0) {
        const dx = P.x - e.x;
        const dy = P.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 110 && d > 1) {
          repX += (dx / d) * (110 - d) * 3.5;
          repY += (dy / d) * (110 - d) * 3.5;
        }
      }
    }
    vx += repX;
    vy += repY;

    // 速度上限限制（快遞員正常航速 180-220）
    const spd = Math.hypot(vx, vy);
    if (spd > 220) {
      vx = (vx / spd) * 220;
      vy = (vy / spd) * 220;
    }

    P.x = Math.max(300, Math.min(1500, P.x + vx * 0.05));
    P.y = Math.max(300, Math.min(1200, P.y + vy * 0.05));
    if (spd > 5) {
      P.faceAng = Math.atan2(vy, vx);
    }

    // 巡邏途中燈油偏低時，透過合法添燈香油 (oil_heal) 緊急急救（每場最多 3 次）
    if (probe.getOil() < 60 && (probe.getB().heals || 0) < 3 && probe.getState() === 'play') {
      executeControlledUpgrade(probe, 'passive:oil_heal');
    }

    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }
  return now;
}

// 輔助：真實首領對決（言語破盾、圓周環繞走位避彈、招式預告迴避、真武器打擊擊破）
function boundedFightBoss(probe, currentNow, expectedBossIndex, expectedHp, expectedRole, expectedTime) {
  let now = currentNow;

  // 1. 嚴格核驗真 Boss producer 事件紀錄（若記憶體跳過反例在此必 RED）
  const spawnLog = probe.getBossSpawnLog();
  const recordedSpawn = spawnLog.find(b => b.index === expectedBossIndex);
  assert.ok(recordedSpawn, `Boss ${expectedBossIndex} 必須由真正的 Boss producer 產生 (若記憶體跳過則必 RED)`);
  assert.equal(recordedSpawn.hp, expectedHp, `Boss ${expectedBossIndex} 初始 HP 必須為 ${expectedHp}`);
  assert.equal(recordedSpawn.role, expectedRole, `Boss ${expectedBossIndex} role 必須為 ${expectedRole}`);
  assert.ok(
    recordedSpawn.spawnElapsed >= expectedTime && recordedSpawn.spawnElapsed <= expectedTime + 5,
    `Boss ${expectedBossIndex} 出場時間界限合理 [${expectedTime}, ${expectedTime + 5}], 實得: ${recordedSpawn.spawnElapsed}`
  );

  const boss = recordedSpawn.bossRef;
  assert.ok(boss, `Boss ${expectedBossIndex} 實體物件必須存在`);
  assert.equal(boss.max, expectedHp, `Boss ${expectedBossIndex} 最大生命值必須為 ${expectedHp}`);

  const P = probe.getP();
  // 2. 若首領具備言語護盾，靠近答題破除護盾
  if (boss.shield && boss.hp > 0) {
    P.x = boss.x;
    P.y = boss.y + 100;
    let shieldFrames = 30;
    while (boss.shield && boss.hp > 0 && shieldFrames-- > 0) {
      now += 50;
      probe.runFrame(now);
      handleNaturalLevelUp(probe);
      const bq = probe.getBossQ();
      if (bq && bq.lock <= 0 && boss.word) {
        const correctIdx = bq.ans.findIndex(w => w.jp === boss.word.jp);
        if (correctIdx >= 0) {
          probe.answerBoss(correctIdx);
          break;
        }
      }
    }
    assert.equal(boss.shield, false, `Boss ${expectedBossIndex} 言語護盾順利破除`);
  }

  // 3. 真武器戰鬥：維持環形射程，面朝首領，避開預告與直射妖火彈
  let maxFrames = 2500; // 最多 125s 自然戰鬥幀
  while (boss.hp > 0 && maxFrames-- > 0 && probe.getState() === 'play') {
    const bdx = boss.x - P.x;
    const bdy = boss.y - P.y;
    const bdist = Math.hypot(bdx, bdy);
    P.faceAng = Math.atan2(bdy, bdx);

    let moveX = 0, moveY = 0;
    // 首領招式預告閃避
    if (boss.hazard && boss.hazard.phase === 'telegraph') {
      const h = boss.hazard;
      if (h.kind === 'slam') {
        const hdx = P.x - h.x;
        const hdy = P.y - h.y;
        const hd = Math.hypot(hdx, hdy);
        if (hd < 170 && hd > 1) {
          moveX = (hdx / hd) * 200;
          moveY = (hdy / hd) * 200;
        }
      } else if (h.kind === 'charge') {
        // 直線衝撞：向法線方向橫移閃避
        moveX = -Math.sin(h.angle) * 200;
        moveY = Math.cos(h.angle) * 200;
      } else if (h.kind === 'ring') {
        // 衝擊環：向安全缺口方向移動
        moveX = Math.cos(h.gapAngle) * 200;
        moveY = Math.sin(h.gapAngle) * 200;
      }
    }

    if (moveX === 0 && moveY === 0) {
      // 環繞圓周走位（閃避首領直射妖火彈；狐火流保持 75px 貼身燃燒，其餘保持 110px 安全射程）
      const targetDist = (probe.getWL().fire > 0) ? 75 : 110;
      const bAng = Math.atan2(bdy, bdx);
      const tangX = -Math.sin(bAng) * 130;
      const tangY = Math.cos(bAng) * 130;
      let radX = 0, radY = 0;
      if (bdist > targetDist + 15) {
        radX = (bdx / bdist) * 110;
        radY = (bdy / bdist) * 110;
      } else if (bdist < targetDist - 15 && bdist > 1) {
        radX = -(bdx / bdist) * 110;
        radY = -(bdy / bdist) * 110;
      }
      moveX = tangX + radX;
      moveY = tangY + radY;
    }

    P.x += moveX * 0.05;
    P.y += moveY * 0.05;

    // 戰鬥中燈油偏低時，透過合法添燈香油 (oil_heal) 緊急急救（每場最多 3 次）
    if (probe.getOil() < 60 && (probe.getB().heals || 0) < 3 && probe.getState() === 'play') {
      executeControlledUpgrade(probe, 'passive:oil_heal');
    }

    now += 50;
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }

  // 4. 斷言敵物件生命歸零與武器擊破標記
  assert.ok(boss.hp <= 0, `Boss ${expectedBossIndex} (role: ${boss.role}) 生命必須由真武器打擊歸零`);
  assert.equal(recordedSpawn.defeated, true, `Boss ${expectedBossIndex} 必須標記為 defeated`);
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

const validationReports = [];

// ── 1. Build 1: 天狐靈針組合 (mut_fan + mut_seek + mut_frost) 正常參數受控完整流程 ──
test('M1-G-1 Build 1 (Needle: fan+seek+frost) normal combat values with controlled XP, specified offers, and navigation: 6 deliveries, 2 seals, 4 natural bosses (180/360/480/540s), and overworld return', () => {
  const env = loadGameSandbox({ seed: 777 });
  const probe = env.__agyProbe;
  const store = probe.getStore();
  const deliveries = [];
  let now = 1000;

  // 1. 真實 start
  probe.start('night-town');
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getDelivered(), 0);
  assert.equal(probe.getWL().katana, 1);
  assert.equal(probe.getWL().needle, 0);

  // 2. 合法選卡建立 Build 1: needle Lv4, 3 變異, 2 御守, katana Lv4, 被動
  executeControlledUpgrade(probe, 'weapon:needle:1');
  executeControlledUpgrade(probe, 'weapon:needle:2');
  executeControlledUpgrade(probe, 'weapon:needle:3');
  executeControlledUpgrade(probe, 'weapon:needle:4');
  executeControlledUpgrade(probe, 'mutation:needle:mut_fan');
  executeControlledUpgrade(probe, 'mutation:needle:mut_seek');
  executeControlledUpgrade(probe, 'mutation:needle:mut_frost');
  executeControlledUpgrade(probe, 'charm:charm_step');
  executeControlledUpgrade(probe, 'charm:charm_power');
  executeControlledUpgrade(probe, 'weapon:katana:2');
  executeControlledUpgrade(probe, 'weapon:katana:3');
  executeControlledUpgrade(probe, 'weapon:katana:4');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:rate');
  executeControlledUpgrade(probe, 'passive:oil_max');
  executeControlledUpgrade(probe, 'passive:oil_max');
  executeControlledUpgrade(probe, 'passive:shield');
  executeControlledUpgrade(probe, 'passive:shield');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:rate');

  assert.equal(probe.getBuildMutations().length, 3, '靈針 3 變異槽滿');
  assert.equal(probe.getBuildCharms().length, 2, '御守 2 槽滿');
  assert.equal(probe.getBuildDuos().length, 0, '未啟用 Duo');

  // 3. 配送 1, 2, 3 在 Boss 0 (180s) 之前完成
  now = boundedStepTo(probe, now, 25);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 1);

  now = boundedStepTo(probe, now, 75);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 2);

  now = boundedStepTo(probe, now, 135);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 3);
  assert.equal(probe.getSeals(), 1, '第 3 次配送合法獲得第 1 枚覺醒印');

  // 4. 以合法第 1 印覺醒妖刀至 Lv5
  executeControlledUpgrade(probe, 'weapon:katana:5');
  assert.equal(probe.getWL().katana, 5, '妖刀覺醒 Lv5');
  assert.equal(probe.getSeals(), 0, '覺醒印消耗完畢');

  // 5. 自然推進至 180s 首個中首領 Boss 0 (300 HP)
  now = boundedStepTo(probe, now, 180.1);
  now = boundedFightBoss(probe, now, 0, 300, 'mid', 180);
  assert.ok(probe.getOil() > 50, 'Boss 0 戰鬥後燈油保持健全');

  // 6. 配送 4, 5, 6
  now = boundedStepTo(probe, now, 230);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 4);

  now = boundedStepTo(probe, now, 280);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 5);

  now = boundedStepTo(probe, now, 330);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 6, '完成全部 6 次配送目標');
  assert.equal(probe.getSeals(), 1, '第 6 次配送合法獲得第 2 枚覺醒印');

  // 7. 以合法第 2 印覺醒靈針至 Lv5
  executeControlledUpgrade(probe, 'weapon:needle:5');
  assert.equal(probe.getWL().needle, 5, '靈針覺醒 Lv5');
  assert.equal(probe.getSeals(), 0, '覺醒印消耗完畢');

  // 8. 自然推進至 360s 第二個中首領 Boss 1 (650 HP)
  now = boundedStepTo(probe, now, 360.1);
  now = boundedFightBoss(probe, now, 1, 650, 'mid', 360);
  assert.ok(probe.getOil() > 50, 'Boss 1 戰鬥後燈油保持健全');

  // 9. 自然推進至 480s 門衛 Boss 2 (120 HP)
  now = boundedStepTo(probe, now, 480.1);
  now = boundedFightBoss(probe, now, 2, 120, 'gate', 480);
  assert.ok(probe.getOil() > 50, 'Gatekeeper 戰鬥後燈油保持健全');

  // 10. 決戰前緊急添燈 (oil_heal)
  if ((probe.getB().heals || 0) < 3) {
    executeControlledUpgrade(probe, 'passive:oil_heal');
  }

  // 11. 自然推進至 540s 終章大首領 Boss 3 (1400 HP)
  now = boundedStepTo(probe, now, 540.1);
  now = boundedFightBoss(probe, now, 3, 1400, 'final', 540);

  // 12. 勝利結算
  assert.equal(probe.getState(), 'victory', '終王擊破後自然進入 victory 狀態');
  assert.equal(probe.getFinalBossDefeated(), true);

  now = executeVictoryToSettlement(probe, now);
  assert.equal(probe.getState(), 'won', '演出結束轉為 won');
  assert.equal(probe.getEnded(), true, 'STORE.finish 結算完成');
  assert.equal(store.getStageStats('night-town').clears, 1, '通關次數為 1');
  assert.equal(store.isStageCompleted('night-town'), true);
  assert.equal(store.isStageUnlocked('rain-port'), true);

  // 核驗 4 位首領由 producer 產生且死亡
  const allBosses = probe.getBossSpawnLog();
  assert.equal(allBosses.length, 4, '全關 4 位首領必須皆有由 producer 產生的事件紀錄');
  assert.ok(allBosses.every(b => b.defeated && b.bossRef.hp <= 0), '4 位首領生命皆已歸零並標記擊破');

  // 收集並記錄 Build 1 執行數據
  const b1Report = {
    buildId: 'Build 1 (Needle: fan+seek+frost)',
    seed: 777,
    won: probe.getState() === 'won',
    clears: store.getStageStats('night-town').clears,
    finalLevel: probe.getLevel(),
    finalOil: Number(probe.getOil().toFixed(2)),
    finalElapsed: Number(probe.getElapsed().toFixed(2)),
    choicesCount: probe.getChoiceLog().length,
    controlledChoicesCount: probe.getChoiceLog().filter(c => c.source === 'controlled').length,
    naturalChoicesCount: probe.getChoiceLog().filter(c => c.source === 'natural').length,
    choices: probe.getChoiceLog(),
    deliveries,
    bosses: allBosses.map(b => ({
      index: b.index,
      role: b.role,
      initialHp: b.hp,
      spawnElapsed: b.spawnElapsed,
      deathElapsed: b.deathElapsed,
      defeated: b.defeated
    }))
  };
  validationReports.push(b1Report);

  // 13. 返回旅路地圖並重開，驗證狀態清理
  probe.activateMenu('world');
  assert.equal(probe.getState(), 'overworld', '進入 overworld 狀態');
  const overworld = probe.getOverworld();
  env.OVERWORLD.moveTo(overworld, 'night-town');
  env.OVERWORLD.update(overworld, 1.0);
  probe.confirmOverworld();
  assert.equal(probe.getState(), 'play', 'confirmOverworld 順利重新開始遊戲');
  assert.equal(probe.getEnemies().length, 0, '敵人佇列徹底清空');
  assert.equal(probe.getOrders().length, 1, '新訂單為 1');
  assert.equal(probe.getBossQ(), null, 'bossQ 為 null');
  assert.equal(probe.getJob(), null, 'job 為 null');
  assert.equal(probe.getWL().katana, 1, '妖刀重置為 Lv1');
  assert.equal(probe.getWL().needle, 0, '靈針已重置為 0');
  assert.equal(probe.getBuildMutations().length, 0, '變異全部清空');
  assert.equal(probe.getBuildCharms().length, 0, '御守全部清空');
  assert.equal(probe.getBuildDuos().length, 0, '共鳴全部清空');
});

// ── 2. Build 2: 雷紋陣組合 (barrier + thunder + duo_thundercircle) 正常參數受控完整流程 ──
test('M1-G-2 Build 2 (Barrier+Thunder: duo_thundercircle) normal combat values with controlled XP, specified offers, and navigation: 6 deliveries, 2 seals, 4 natural bosses (180/360/480/540s), and overworld return', () => {
  const env = loadGameSandbox({ seed: 778 });
  const probe = env.__agyProbe;
  const store = probe.getStore();
  const deliveries = [];
  let now = 1000;

  probe.start('night-town');
  assert.equal(probe.getState(), 'play');

  // 1. 合法選卡建立 Build 2: barrier Lv4, thunder Lv3, duo_thundercircle, charm_step, charm_power, katana Lv4, 被動
  executeControlledUpgrade(probe, 'weapon:barrier:1');
  executeControlledUpgrade(probe, 'weapon:barrier:2');
  executeControlledUpgrade(probe, 'weapon:barrier:3');
  executeControlledUpgrade(probe, 'weapon:barrier:4');
  executeControlledUpgrade(probe, 'weapon:thunder:1');
  executeControlledUpgrade(probe, 'weapon:thunder:2');
  executeControlledUpgrade(probe, 'weapon:thunder:3');
  executeControlledUpgrade(probe, 'duo:duo_thundercircle');
  executeControlledUpgrade(probe, 'charm:charm_step');
  executeControlledUpgrade(probe, 'charm:charm_power');
  executeControlledUpgrade(probe, 'weapon:katana:2');
  executeControlledUpgrade(probe, 'weapon:katana:3');
  executeControlledUpgrade(probe, 'weapon:katana:4');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:rate');
  executeControlledUpgrade(probe, 'passive:oil_max');
  executeControlledUpgrade(probe, 'passive:oil_max');
  executeControlledUpgrade(probe, 'passive:shield');
  executeControlledUpgrade(probe, 'passive:shield');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:rate');

  assert.equal(probe.getWL().barrier, 4);
  assert.equal(probe.getWL().thunder, 3);
  assert.equal(probe.getBuildDuos().length, 1);
  assert.equal(probe.getBuildCharms().length, 2);

  // 2. 配送 1, 2, 3
  now = boundedStepTo(probe, now, 25);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 1);

  now = boundedStepTo(probe, now, 75);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 2);

  now = boundedStepTo(probe, now, 135);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 3);
  assert.equal(probe.getSeals(), 1, '獲得第 1 枚覺醒印');

  // 3. 妖刀覺醒 Lv5
  executeControlledUpgrade(probe, 'weapon:katana:5');
  assert.equal(probe.getWL().katana, 5);
  assert.equal(probe.getSeals(), 0);

  // 4. Boss 0 (180s)
  now = boundedStepTo(probe, now, 180.1);
  now = boundedFightBoss(probe, now, 0, 300, 'mid', 180);
  assert.ok(probe.getOil() > 50, 'Boss 0 戰鬥後燈油保持健全');

  // 5. 配送 4, 5, 6
  now = boundedStepTo(probe, now, 230);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 4);

  now = boundedStepTo(probe, now, 280);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 5);

  now = boundedStepTo(probe, now, 330);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 6);
  assert.equal(probe.getSeals(), 1, '獲得第 2 枚覺醒印');

  // 6. 結界覺醒 Lv5
  executeControlledUpgrade(probe, 'weapon:barrier:5');
  assert.equal(probe.getWL().barrier, 5);
  assert.equal(probe.getSeals(), 0);

  // 7. Boss 1 (360s)
  now = boundedStepTo(probe, now, 360.1);
  now = boundedFightBoss(probe, now, 1, 650, 'mid', 360);
  assert.ok(probe.getOil() > 50, 'Boss 1 戰鬥後燈油保持健全');

  // 8. Gatekeeper Boss 2 (480s)
  now = boundedStepTo(probe, now, 480.1);
  now = boundedFightBoss(probe, now, 2, 120, 'gate', 480);
  assert.ok(probe.getOil() > 50, 'Gatekeeper 戰鬥後燈油保持健全');

  // 9. 決戰前緊急添燈
  if ((probe.getB().heals || 0) < 3) {
    executeControlledUpgrade(probe, 'passive:oil_heal');
  }

  // 10. Final Boss (540s)
  now = boundedStepTo(probe, now, 540.1);
  now = boundedFightBoss(probe, now, 3, 1400, 'final', 540);

  assert.equal(probe.getState(), 'victory');
  assert.equal(probe.getFinalBossDefeated(), true);

  now = executeVictoryToSettlement(probe, now);
  assert.equal(probe.getState(), 'won');
  assert.equal(probe.getEnded(), true);
  assert.equal(store.getStageStats('night-town').clears, 1);

  // 核驗 4 位首領由 producer 產生且死亡
  const allBosses = probe.getBossSpawnLog();
  assert.equal(allBosses.length, 4, '全關 4 位首領必須皆有由 producer 產生的事件紀錄');
  assert.ok(allBosses.every(b => b.defeated && b.bossRef.hp <= 0), '4 位首領生命皆已歸零並標記擊破');

  // 收集並記錄 Build 2 執行數據
  const b2Report = {
    buildId: 'Build 2 (Barrier+Thunder: duo_thundercircle)',
    seed: 778,
    won: probe.getState() === 'won',
    clears: store.getStageStats('night-town').clears,
    finalLevel: probe.getLevel(),
    finalOil: Number(probe.getOil().toFixed(2)),
    finalElapsed: Number(probe.getElapsed().toFixed(2)),
    choicesCount: probe.getChoiceLog().length,
    controlledChoicesCount: probe.getChoiceLog().filter(c => c.source === 'controlled').length,
    naturalChoicesCount: probe.getChoiceLog().filter(c => c.source === 'natural').length,
    choices: probe.getChoiceLog(),
    deliveries,
    bosses: allBosses.map(b => ({
      index: b.index,
      role: b.role,
      initialHp: b.hp,
      spawnElapsed: b.spawnElapsed,
      deathElapsed: b.deathElapsed,
      defeated: b.defeated
    }))
  };
  validationReports.push(b2Report);

  // 11. 返回旅路地圖並重開
  probe.activateMenu('world');
  assert.equal(probe.getState(), 'overworld');
  const overworld = probe.getOverworld();
  env.OVERWORLD.moveTo(overworld, 'night-town');
  env.OVERWORLD.update(overworld, 1.0);
  probe.confirmOverworld();
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getBuildDuos().length, 0);
  assert.equal(probe.getWL().barrier, 0);
  assert.equal(probe.getWL().thunder, 0);
});

// ── 3. Build 3: 餘燼符組合 (fire + boom + duo_cinderseal) 正常參數受控完整流程 ──
test('M1-G-3 Build 3 (Fire+Boom: duo_cinderseal) normal combat values with controlled XP, specified offers, and navigation: 6 deliveries, 2 seals, 4 natural bosses (180/360/480/540s), and overworld return', () => {
  const env = loadGameSandbox({ seed: 779 });
  const probe = env.__agyProbe;
  const store = probe.getStore();
  const deliveries = [];
  let now = 1000;

  probe.start('night-town');
  assert.equal(probe.getState(), 'play');

  // 1. 合法選卡建立 Build 3: fire Lv4, boom Lv3, duo_cinderseal, charm_step, charm_power, katana Lv4, 被動
  executeControlledUpgrade(probe, 'weapon:fire:1');
  executeControlledUpgrade(probe, 'weapon:fire:2');
  executeControlledUpgrade(probe, 'weapon:fire:3');
  executeControlledUpgrade(probe, 'weapon:fire:4');
  executeControlledUpgrade(probe, 'weapon:boom:1');
  executeControlledUpgrade(probe, 'weapon:boom:2');
  executeControlledUpgrade(probe, 'weapon:boom:3');
  executeControlledUpgrade(probe, 'duo:duo_cinderseal');
  executeControlledUpgrade(probe, 'charm:charm_step');
  executeControlledUpgrade(probe, 'charm:charm_power');
  executeControlledUpgrade(probe, 'weapon:katana:2');
  executeControlledUpgrade(probe, 'weapon:katana:3');
  executeControlledUpgrade(probe, 'weapon:katana:4');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:rate');
  executeControlledUpgrade(probe, 'passive:oil_max');
  executeControlledUpgrade(probe, 'passive:oil_max');
  executeControlledUpgrade(probe, 'passive:shield');
  executeControlledUpgrade(probe, 'passive:shield');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:dmg');
  executeControlledUpgrade(probe, 'passive:rate');

  assert.equal(probe.getWL().fire, 4);
  assert.equal(probe.getWL().boom, 3);
  assert.equal(probe.getBuildDuos().length, 1);

  // 2. 配送 1, 2, 3
  now = boundedStepTo(probe, now, 25);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 1);

  now = boundedStepTo(probe, now, 75);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 2);

  now = boundedStepTo(probe, now, 135);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 3);
  assert.equal(probe.getSeals(), 1, '獲得第 1 枚覺醒印');

  // 3. 妖刀覺醒 Lv5
  executeControlledUpgrade(probe, 'weapon:katana:5');
  assert.equal(probe.getWL().katana, 5);
  assert.equal(probe.getSeals(), 0);

  // 4. Boss 0 (180s)
  now = boundedStepTo(probe, now, 180.1);
  now = boundedFightBoss(probe, now, 0, 300, 'mid', 180);
  assert.ok(probe.getOil() > 50, 'Boss 0 戰鬥後燈油保持健全');

  // 5. 配送 4, 5, 6
  now = boundedStepTo(probe, now, 230);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 4);

  now = boundedStepTo(probe, now, 280);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 5);

  now = boundedStepTo(probe, now, 330);
  now = executeOneDelivery(probe, now, deliveries);
  assert.equal(probe.getDelivered(), 6);
  assert.equal(probe.getSeals(), 1, '獲得第 2 枚覺醒印');

  // 6. 狐火覺醒 Lv5 (墨焰黑龍)
  executeControlledUpgrade(probe, 'weapon:fire:5');
  assert.equal(probe.getWL().fire, 5);
  assert.equal(probe.getSeals(), 0);

  // 7. Boss 1 (360s)
  now = boundedStepTo(probe, now, 360.1);
  now = boundedFightBoss(probe, now, 1, 650, 'mid', 360);
  assert.ok(probe.getOil() > 50, 'Boss 1 戰鬥後燈油保持健全');

  // 8. Gatekeeper Boss 2 (480s)
  now = boundedStepTo(probe, now, 480.1);
  now = boundedFightBoss(probe, now, 2, 120, 'gate', 480);
  assert.ok(probe.getOil() > 50, 'Gatekeeper 戰鬥後燈油保持健全');

  // 9. 決戰前緊急添燈
  if ((probe.getB().heals || 0) < 3) {
    executeControlledUpgrade(probe, 'passive:oil_heal');
  }

  // 10. Final Boss (540s)
  now = boundedStepTo(probe, now, 540.1);
  now = boundedFightBoss(probe, now, 3, 1400, 'final', 540);

  assert.equal(probe.getState(), 'victory');
  assert.equal(probe.getFinalBossDefeated(), true);

  now = executeVictoryToSettlement(probe, now);
  assert.equal(probe.getState(), 'won');
  assert.equal(probe.getEnded(), true);
  assert.equal(store.getStageStats('night-town').clears, 1);

  // 核驗 4 位首領由 producer 產生且死亡
  const allBosses = probe.getBossSpawnLog();
  assert.equal(allBosses.length, 4, '全關 4 位首領必須皆有由 producer 產生的事件紀錄');
  assert.ok(allBosses.every(b => b.defeated && b.bossRef.hp <= 0), '4 位首領生命皆已歸零並標記擊破');

  // 收集並記錄 Build 3 執行數據
  const b3Report = {
    buildId: 'Build 3 (Fire+Boom: duo_cinderseal)',
    seed: 779,
    won: probe.getState() === 'won',
    clears: store.getStageStats('night-town').clears,
    finalLevel: probe.getLevel(),
    finalOil: Number(probe.getOil().toFixed(2)),
    finalElapsed: Number(probe.getElapsed().toFixed(2)),
    choicesCount: probe.getChoiceLog().length,
    controlledChoicesCount: probe.getChoiceLog().filter(c => c.source === 'controlled').length,
    naturalChoicesCount: probe.getChoiceLog().filter(c => c.source === 'natural').length,
    choices: probe.getChoiceLog(),
    deliveries,
    bosses: allBosses.map(b => ({
      index: b.index,
      role: b.role,
      initialHp: b.hp,
      spawnElapsed: b.spawnElapsed,
      deathElapsed: b.deathElapsed,
      defeated: b.defeated
    }))
  };
  validationReports.push(b3Report);

  // 輸出真頁 QA 接續所需之完整結構化單一 JSON 並寫入指定工件路徑
  const payload = {
    environment: "VM Sandbox (Controlled / Non-Chrome / Non-Natural)",
    gameSha256: "c39d10b03ff8dc7ee5260c977ea787d7fb34f894b34feacae7c5b72d1bebdd15",
    generatedAt: new Date().toISOString(),
    stage: "night-town",
    builds: validationReports
  };
  console.log('[M1_G_BUILD_VALIDATION_JSON]');
  console.log(JSON.stringify(payload, null, 2));

  const runId = 'run-' + Date.now().toString(36) + '-' + process.pid;
  const outDir = path.join(ROOT, 'artifacts', 'validation', 'agy-m1-g-r3-20261017', runId);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'builds.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[VALIDATION_ARTIFACT_WRITTEN] ${outPath}`);

  // 11. 返回旅路地圖並重開
  probe.activateMenu('world');
  assert.equal(probe.getState(), 'overworld');
  const overworld = probe.getOverworld();
  env.OVERWORLD.moveTo(overworld, 'night-town');
  env.OVERWORLD.update(overworld, 1.0);
  probe.confirmOverworld();
  assert.equal(probe.getState(), 'play');
  assert.equal(probe.getBuildDuos().length, 0);
  assert.equal(probe.getWL().fire, 0);
  assert.equal(probe.getWL().boom, 0);
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

// ── 6. 焦點負向：>600 秒（拂曉 DAWN）未擊殺終王不得勝利結算 ──
test('M1-G-6 Focused negative: elapsed >= 600s with 6 deliveries but unkilled final boss cannot win', () => {
  const env = loadGameSandbox({ seed: 777 });
  const probe = env.__agyProbe;
  const store = probe.getStore();
  let now = 1000;

  probe.start('night-town');

  // 完成 6 筆配送達到通關目標
  for (let i = 1; i <= 6; i++) {
    now = executeOneDelivery(probe, now);
  }
  assert.equal(probe.getDelivered(), 6, '已完成 6 筆配送');

  // 明標時鐘 fixture：時鐘推進至超過 600s (DAWN = 600)，例如 610s
  probe.setElapsed(610);
  probe.setBossStage(3); // 終王時段
  probe.setBossT(0);
  now += 50;
  probe.runFrame(now);
  handleNaturalLevelUp(probe);

  const boss = probe.getEnemies().find(e => e.type === 'boss' && e.final);
  assert.ok(boss, '終王已登場');
  assert.ok(boss.hp > 0, '終王生命值 > 0 (未擊殺)');
  assert.equal(probe.getFinalBossDefeated(), false, '終王尚未被擊殺');

  // 推進數十幀，模擬超時運作
  for (let f = 0; f < 30; f++) {
    now += 50;
    probe.runFrame(now);
    handleNaturalLevelUp(probe);
  }

  // 核心負向斷言：即使 deliveries >= 6 且 elapsed >= 600s，未殺終王絕不能勝利或結算完成！
  assert.notEqual(probe.getState(), 'victory', '未殺終王不得進入 victory');
  assert.notEqual(probe.getState(), 'won', '未殺終王不得進入 won');
  assert.equal(probe.getEnded(), false, '未殺終王不得結束結算');
  assert.equal(store.isStageCompleted('night-town'), false, '存檔不得解鎖通關');
  assert.equal(store.getStageStats('night-town').clears, 0, '通關數必須維持 0');
});

// ── 7. Oracle 防線反例驗證：若記憶體跳過 Boss 0 producer，測試必拋出 RED 失敗 ──
test('M1-G-7 Oracle counterexample: memory skip of Boss 0 producer MUST fail assertion (RED counterexample prevention)', () => {
  const env = loadGameSandbox({ seed: 777 });
  const probe = env.__agyProbe;
  let now = 1000;

  probe.start('night-town');

  // 模擬 Space Bunny p5 Q8 記憶體跳過 Boss 0 產生器反例：
  // 人為篡改 bossStage 至 1，使得 180s 的 Boss 0 (300 HP) 從未由遊戲引擎 producer 產出
  probe.setBossStage(1);
  probe.setBossT(180);

  // 推進至 180.1s
  now = boundedStepTo(probe, now, 180.1);

  // 斷言：呼叫 boundedFightBoss 檢查 Boss 0 時，必須拋出 AssertionError 報錯 RED，絕不允許假綠！
  let threwRed = false;
  try {
    boundedFightBoss(probe, now, 0, 300, 'mid', 180);
  } catch (err) {
    threwRed = true;
    assert.match(err.message, /Boss 0 必須由真正的 Boss producer 產生/);
  }
  assert.equal(threwRed, true, '記憶體跳過 Boss 0 producer 必須在 oracle 處拋出 RED 失敗');
});
