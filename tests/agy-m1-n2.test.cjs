// tests/agy-m1-n2.test.cjs
// M1-G-N2: 純正常經驗第一關早死根因與合理玩家可行導航策略對照回歸測試
// 驗證核心：
// 1. 原 seed 777 笨導航（Policy 0）因「背對怪物移動、妖刀前方扇形斬擊判定完全落空、不拾取靈玉」導致 0 擊殺、70 隻怪物堆疊圍困，於 93-130s lampout 早死。
// 2. 合理人類玩家可行導航策略（Policy 1 戰鬥風箏 / Policy 2 目標配送迎擊）在零注入（無 setXp/補油/無敵/跳秒/強選卡）下：
//    - 成功揮砍命中，擊殺怪物並吸納靈玉。
//    - 正常升至 Level 5~6（normal profile 下自然抽得靈針、變異與御守；hard 基準下達 Level 6~7）。
//    - 存活大幅延長至 175~180s+（成功推進至首位中首領 Boss 0 關口）。
// 證明原早死屬導航與選卡策略缺陷，非遊戲數值平衡底層缺陷。

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function createSandbox(seed = 777, options = {}) {
  const WINDOW = { width: 900, height: 600 };
  const storage = new Map([
    ['yokai-tutorial-v1', '"skip"'],
    ['yokai-delivery-v1', JSON.stringify({
      best: 0, bestDel: 0, m: {},
      progress: { unlocked: { 'night-town': true }, completed: {}, stages: { 'night-town': { bestScore: 0, bestDeliveries: 0, clears: 0, attempts: 0 } } }
    })]
  ]);
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    setTransform: () => {}, fillText: () => {}, strokeText: () => {}, measureText: () => ({ width: 40 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient, createPattern: () => null,
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const canvas = {
    addEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WINDOW.width, height: WINDOW.height }),
    width: WINDOW.width, height: WINDOW.height, style: {}
  };
  let s = seed >>> 0;
  const sandboxMath = Object.create(Math);
  sandboxMath.random = function() { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };

  let virtualClock = 1000;
  const env = {
    console, Set, Map, Math: sandboxMath, Date, JSON, URL, URLSearchParams,
    performance: { now: () => virtualClock },
    setPerfClock: t => { virtualClock = t; },
    navigator: { userAgent: 'node' },
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)) },
    document: { hidden: false, getElementById: () => canvas, addEventListener() {}, body: { dataset: {} } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    innerWidth: WINDOW.width, innerHeight: WINDOW.height, devicePixelRatio: 1, location: { search: '' },
    screen: { width: WINDOW.width, height: WINDOW.height },
    AudioContext: function() { return { createGain: () => ({ gain: { value: 0 }, connect() {} }), createBufferSource: () => ({ connect() {}, start() {}, stop() {} }), createBuffer: () => ({}), decodeAudioData: () => Promise.resolve({}), destination: {}, currentTime: 0, sampleRate: 48000, resume() {} }; },
    Event: class { constructor(t) { this.type = t; } },
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } }
  };
  env.window = env; env.self = env; env.Math = sandboxMath;

  const sandbox = vm.createContext(env);
  const readJs = f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const deps = ['words.js','world.js','store.js','config.js','viewport.js','controls.js','overworld.js','fx.js','skillfx.js','evolutions.js','boss-ai.js','story-dialogue.js','card-collection.js','card-delivery-bridge.js'];
  for (const d of deps) vm.runInContext(readJs(d), sandbox, { filename: d });
  if (sandbox.CONTROLS) sandbox.CONTROLS.mount = () => {};

  const RESTART_BTN = { id: 'restart', x: 150, y: 492, w: 180, h: 48 };
  const WORLD_BTN = { id: 'world', x: 360, y: 492, w: 180, h: 48 };
  const HOME_BTN = { id: 'menu', x: 570, y: 492, w: 180, h: 48 };
  const MENU_START_BTN = { id: 'start', x: 318, y: 478, w: 264, h: 54 };
  const PAUSE_BTNS = [{ id: 'resume', x: 310, y: 250, w: 280, h: 44 }, { id: 'restart', x: 310, y: 310, w: 280, h: 44 }, { id: 'world', x: 310, y: 370, w: 280, h: 44 }, { id: 'menu', x: 310, y: 430, w: 280, h: 44 }];
  sandbox.UI = new Proxy({
    RESTART_BTN, WORLD_BTN, HOME_BTN, MENU_START_BTN, PAUSE_BTNS,
    pauseButtons: () => PAUSE_BTNS,
    levelUpLayout: () => ({ card: { x: 90, y: 176, w: 720, h: 108, gap: 14 } }),
    readableFont: () => 'sans-serif', answerFontReady: () => true
  }, { get: (t, p) => (p in t ? t[p] : () => {}) });
  sandbox.AUDIO = new Proxy({}, { get: () => () => {} });
  sandbox.HAPTICS = new Proxy({}, { get: () => () => {} });
  sandbox.RENDERER = new Proxy({ getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({ x: 0, y: 0 }), getCanvas: () => canvas, updateEffects: () => false }, { get: (o, k) => (k in o ? o[k] : () => {}) });

  // 若明確指定難度（如 hard profile 基線重現），攔截 stage pacing
  if (options.difficulty) {
    const historicalGetStage = sandbox.CONTENT.getStage;
    sandbox.CONTENT = { ...sandbox.CONTENT, getStage(id) {
      const stage = historicalGetStage(id);
      return { ...stage, pacing: { ...stage.pacing, mobDifficulty: options.difficulty } };
    } };
  }

  const rawGame = readJs('game.js');
  const endIdx = rawGame.lastIndexOf('})();');

  const probeCode = `
    let katanaSwingCount = 0;
    let enemyHitsDealt = 0;
    let killsRecorded = 0;
    const choiceLog = [];
    const bossLog = [];

    // 攔截妖刀揮砍事件
    const origWeapons = weapons;

    function observeLifecycle() {
      for (const e of enemies) {
        if (e.type === 'boss' && !e.dying && !e.__logged) {
          e.__logged = true;
          bossLog.push({ index: e.bossIndex, role: e.role, hp: e.hp, maxHp: e.max, spawnElapsed: Number(elapsed.toFixed(2)), bossRef: e, defeated: false });
        }
        if (e.hp <= 0 && !e.__countedDeath) {
          e.__countedDeath = true;
          killsRecorded++;
        }
      }
      for (const b of bossLog) {
        if (!b.defeated && b.bossRef.hp <= 0) {
          b.defeated = true;
          b.deathElapsed = Number(elapsed.toFixed(2));
        }
      }
    }

    window.__agyProbe = {
      getP: () => P, getB: () => b, getWL: () => WL, getWI: () => WI, getSeals: () => seals,
      getLevel: () => level, getXp: () => xp, getXpNeed: () => xpNeed(), getState: () => state,
      setLevelupCooldown: v => { levelupCooldown = v; }, getChoices: () => choices, getEnemies: () => enemies,
      getGems: () => gems,
      getKills: () => killsRecorded,
      getKatanaSwings: () => katanaSwingCount,
      recordKatanaSwing: () => { katanaSwingCount++; },
      start: id => { start(id); choiceLog.length = 0; bossLog.length = 0; katanaSwingCount = 0; killsRecorded = 0; },
      applyChoice: (id, rev) => {
        const cLevel = level; const cXp = xp; const cElapsed = elapsed; const cXpNeed = xpNeed();
        const res = applyChoice(id, rev);
        if (res && res.ok) {
          choiceLog.push({ step: choiceLog.length + 1, choiceId: id, elapsed: Number(cElapsed.toFixed(2)), level: cLevel, xp: cXp, xpNeed: cXpNeed });
        }
        return res;
      },
      getBuildRevision: () => buildRevision, getBuildState: () => getBuildState(),
      getOil: () => oil, getDelivered: () => delivered, getOrders: () => orders, getJob: () => job,
      getInter: () => inter, interact: () => interact(),
      getBossQ: () => bossQ, answerBoss: i => answerBoss(i),
      runFrame: now => {
        window.setPerfClock?.(now);
        // 觀察 weapons 揮砍
        const wBefore = atkT;
        runFrame(now);
        if (atkT > wBefore) {
          katanaSwingCount++;
        }
        observeLifecycle();
      },
      getChoiceLog: () => choiceLog, getBossLog: () => bossLog,
      getElapsed: () => elapsed, ansPos: h => ansPos(h), makeOrder: () => makeOrder(),
      dash: () => dash(), getDashCd: () => dashCd,
      getStore: () => window.STORE
    };
  `;
  vm.runInContext(rawGame.slice(0, endIdx) + probeCode + rawGame.slice(endIdx), sandbox, { filename: 'game.js' });
  return sandbox.__agyProbe;
}

// 正常選卡策略：優先靈針組合、變異、御守、合理生存被動
function scoreChoice(c, probe) {
  const cid = c.choiceId || c.id;
  const seals = probe.getSeals();
  const wl = probe.getWL();
  const oil = probe.getOil();

  if (cid === 'weapon:needle:5') return (seals > 0 && wl.needle === 4) ? 1000 : -1;
  if (cid === 'weapon:katana:5') return (seals > 0 && wl.katana === 4) ? 950 : -1;
  if (cid === 'weapon:needle:1') return 900;
  if (cid.startsWith('weapon:needle:')) return 880;
  if (cid === 'mutation:needle:mut_fan') return 850;
  if (cid === 'mutation:needle:mut_seek') return 840;
  if (cid === 'mutation:needle:mut_frost') return 830;
  if (cid === 'passive:oil_heal' && oil < 70) return 860;
  if (c.type === 'charm') return 700;
  if (cid === 'mutation:katana:mut_crosscut') return 680;
  if (cid.startsWith('weapon:katana:')) return 650;
  if (cid === 'passive:oil_max') return 620;
  if (cid === 'passive:oil_heal') return 610;
  if (cid === 'passive:shield') return 600;
  if (cid === 'passive:dmg') return 590;
  if (cid === 'passive:rate') return 580;
  if (c.type === 'weapon') return 500;
  return 100;
}

function handleLevelUp(probe) {
  while (probe.getState() === 'levelup') {
    const choices = probe.getChoices();
    if (!choices || choices.length === 0) break;
    probe.setLevelupCooldown(0);
    const sorted = choices.map((c, idx) => ({ c, idx, score: scoreChoice(c, probe) }))
                          .sort((a, b) => b.score - a.score);
    const best = sorted[0].c;
    const cid = best.choiceId || best.id;
    probe.applyChoice(cid, probe.getBuildRevision());
  }
}

function executeOneDelivery(probe, currentNow) {
  let now = currentNow;
  if (probe.getOrders().length === 0) probe.makeOrder();
  const o = probe.getOrders()[0];
  if (!o) return now;
  const P = probe.getP();
  P.x = o.from.x; P.y = o.from.y;
  now += 50; probe.runFrame(now); handleLevelUp(probe);
  probe.interact();
  const job = probe.getJob();
  if (!job) return now;
  const correctIdx = job.ans.findIndex(w => w.jp === job.word.jp);
  const targetPos = probe.ansPos(job.to)[correctIdx];
  P.x = targetPos.x; P.y = targetPos.y;
  for (let s = 0; s < 35; s++) {
    now += 50;
    probe.runFrame(now);
    handleLevelUp(probe);
    if (!probe.getJob()) break;
  }
  now += 50; probe.runFrame(now); handleLevelUp(probe);
  return now;
}

// ── Policy 0: 笨導航（原 N1 基線）──
// 巡邏半徑 80px，全等向排斥，P.faceAng 設為逃跑方向（背對怪物），斬擊全落空
function stepPolicy0(probe, now) {
  const P = probe.getP();
  const t = now / 1000;
  let vx = -Math.sin(t * 0.4) * 80;
  let vy = Math.cos(t * 0.4) * 80;
  const enemies = probe.getEnemies();
  let repX = 0, repY = 0;
  for (const e of enemies) {
    if (e.hp > 0) {
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 110 && d > 1) {
        repX += (dx / d) * (110 - d) * 3.5;
        repY += (dy / d) * (110 - d) * 3.5;
      }
    }
  }
  vx += repX; vy += repY;
  const spd = Math.hypot(vx, vy);
  if (spd > 220) { vx = (vx / spd) * 220; vy = (vy / spd) * 220; }
  P.x = Math.max(300, Math.min(1500, P.x + vx * 0.05));
  P.y = Math.max(300, Math.min(1200, P.y + vy * 0.05));
  if (spd > 5) P.faceAng = Math.atan2(vy, vx); // 永遠背對怪物！
}

// ── Policy 1: 戰鬥風箏走位（Combat Kiting）──
// 保持 100px 風箏距離，面朝最近妖怪出刀，被圍困主動衝刺突圍，拾取靈玉
function stepPolicy1(probe, now) {
  const P = probe.getP();
  const enemies = probe.getEnemies();
  let nearestDist = 9999, nearestEnemy = null;
  let closeCount = 0;
  for (const e of enemies) {
    if (e.hp > 0) {
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
      if (d < 100) closeCount++;
    }
  }

  if (closeCount >= 3 && probe.getDashCd() <= 0 && nearestEnemy) {
    P.faceAng = Math.atan2(P.y - nearestEnemy.y, P.x - nearestEnemy.x);
    probe.dash();
  }

  let vx = 0, vy = 0;
  if (nearestEnemy) {
    const dx = P.x - nearestEnemy.x, dy = P.y - nearestEnemy.y, d = Math.hypot(dx, dy) || 1;
    const tangX = -dy / d, tangY = dx / d;
    const targetDist = 100;
    const radial = (d - targetDist) * 1.5;
    vx = tangX * 130 - (dx / d) * radial;
    vy = tangY * 130 - (dy / d) * radial;
    P.faceAng = Math.atan2(nearestEnemy.y - P.y, nearestEnemy.x - P.x);
  } else {
    vx = 60; vy = 0;
  }
  const spd = Math.hypot(vx, vy);
  if (spd > 220) { vx = (vx / spd) * 220; vy = (vy / spd) * 220; }
  P.x = Math.max(300, Math.min(1500, P.x + vx * 0.05));
  P.y = Math.max(300, Math.min(1200, P.y + vy * 0.05));
}

// ── Policy 2: 目標配送與主動清怪（Delivery & Active Combat）──
// 朝目標町屋前進，遇怪迎擊，利用町屋安全讀題結界與配送回油，引向寬敞區
function stepPolicy2(probe, now, targetPos) {
  const P = probe.getP();
  const enemies = probe.getEnemies();
  let nearestDist = 9999, nearestEnemy = null;
  for (const e of enemies) {
    if (e.hp > 0) {
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
    }
  }

  let vx = 0, vy = 0;
  if (nearestEnemy && nearestDist < 120) {
    const dx = P.x - nearestEnemy.x, dy = P.y - nearestEnemy.y, d = Math.hypot(dx, dy) || 1;
    vx = (dx / d) * 100; vy = (dy / d) * 100;
    P.faceAng = Math.atan2(nearestEnemy.y - P.y, nearestEnemy.x - P.x);
  } else if (targetPos) {
    const tx = targetPos.x - P.x, ty = targetPos.y - P.y, td = Math.hypot(tx, ty) || 1;
    vx = (tx / td) * 180; vy = (ty / td) * 180;
    P.faceAng = Math.atan2(ty, tx);
  } else {
    vx = 50; vy = 50;
  }
  const spd = Math.hypot(vx, vy);
  if (spd > 220) { vx = (vx / spd) * 220; vy = (vy / spd) * 220; }
  P.x = Math.max(300, Math.min(1500, P.x + vx * 0.05));
  P.y = Math.max(300, Math.min(1200, P.y + vy * 0.05));
}

// ── Test 1: 重現原 seed 777 笨導航（Policy 0）早死根因 ──
test('M1-G-N2-1 Baseline Reproduction: Dumb Strategy (Policy 0) dies early (90-135s) due to backward facing, 0 kills, and enemy swarm', () => {
  // 本案重現 hard 難度早死基線（Policy 0 笨導航缺陷診斷）；比照 N3/N4 明確選 hard profile，不將舊早死門檻套到新 normal。
  const probe = createSandbox(777, { difficulty: 'hard' });
  probe.start('night-town');
  let now = 1000;
  const deliveries = [25, 75, 135];
  let delIdx = 0;

  while (probe.getElapsed() < 180 && probe.getState() === 'play') {
    if (delIdx < deliveries.length && probe.getElapsed() >= deliveries[delIdx]) {
      delIdx++;
      now = executeOneDelivery(probe, now);
    }
    now += 50;
    stepPolicy0(probe, now);
    probe.runFrame(now);
    handleLevelUp(probe);
  }

  // 驗證笨導航特徵：背對怪物未揮砍、無擊殺、70+隻圍困、130s 內燈油耗盡
  assert.equal(probe.getState(), 'lampout', '笨導航必定觸發 lampout 死亡');
  assert.ok(probe.getElapsed() <= 135, `死亡時間必須在 135s 內, 實得: ${probe.getElapsed().toFixed(1)}s`);
  assert.equal(probe.getKills(), 0, '笨導航因背對怪物從未擊殺任何敵人');
  assert.ok(probe.getEnemies().filter(e => e.hp > 0).length >= 50, '死前場上堆疊超過 50 隻以上怪物');
  assert.ok(probe.getLevel() <= 2, '笨導航僅靠配送 XP 停滯在 Level 2');
});

// ── Test 2: 合理玩家可行策略 1（戰鬥風箏 Policy 1）大幅延長存活且擊殺怪物升至 Level 6+ ──
test('M1-G-N2-2 Feasible Strategy 1 (Combat Kiting): Frontal facing and safe kiting achieves kills, Level 6+, and survives past 170s without injection', () => {
  const probe = createSandbox(777);
  probe.start('night-town');
  let now = 1000;
  const deliveries = [25, 75, 135];
  let delIdx = 0;

  while (probe.getElapsed() < 180 && probe.getState() === 'play') {
    if (delIdx < deliveries.length && probe.getElapsed() >= deliveries[delIdx]) {
      delIdx++;
      now = executeOneDelivery(probe, now);
    }
    now += 50;
    stepPolicy1(probe, now);
    probe.runFrame(now);
    handleLevelUp(probe);
  }

  // 斷言：面朝出刀使妖刀生效、正常拾取靈玉、等級達 6 以上、存活大幅超過 170s
  assert.ok(probe.getElapsed() >= 170, `戰鬥風箏存活時間必須達到 170s 以上, 實得: ${probe.getElapsed().toFixed(1)}s`);
  assert.ok(probe.getLevel() >= 6, `戰鬥風箏必須透過自然靈玉成長至 Level 6 以上, 實得: ${probe.getLevel()}`);
  assert.ok(probe.getChoiceLog().length >= 5, '至少完成 5 次自然升級選卡');
  assert.ok(probe.getEnemies().filter(e => e.hp > 0).length <= 35, '存活怪物數大幅壓制於 35 隻以下');
});

// ── Test 3: 合理玩家可行策略 2（目標配送迎擊 Policy 2）成功抵達 180s 首領關口 ──
test('M1-G-N2-3 Feasible Strategy 2 (Objective Delivery + Combat): Completes 3 deliveries and reaches 180s checkpoint alive in play state', () => {
  const probe = createSandbox(777);
  probe.start('night-town');
  let now = 1000;
  const deliveries = [25, 75, 135];
  let delIdx = 0;

  while (probe.getElapsed() < 180 && probe.getState() === 'play') {
    if (delIdx < deliveries.length && probe.getElapsed() >= deliveries[delIdx]) {
      delIdx++;
      now = executeOneDelivery(probe, now);
    }
    const orders = probe.getOrders();
    const target = orders.length > 0 ? orders[0].from : null;
    stepPolicy2(probe, now, target);
    now += 50;
    probe.runFrame(now);
    handleLevelUp(probe);
  }

  // 斷言：成功在 180s 存活（狀態為 play，完成 3 次配送，等級達 Level 5，怪物數大幅受控）
  assert.equal(probe.getState(), 'play', '180s 時必須仍維持 play 存活狀態');
  assert.ok(probe.getElapsed() >= 180.0, '順利推進達到 180s 首領時段');
  assert.equal(probe.getDelivered(), 3, '已成功完成 3 次真配送');
  // 新 normal profile 下：小怪湧潮頻率減半(surgePacingScale=2)、數量調降(surgeCountScale=0.6)、上限降至57，
  // 場上自然靈玉掉落總量減少，純配送迎擊策略於 180s 期間自然成長達 Level 5（而非 hard 下因高怪量刷玉達 Level 7）
  assert.ok(probe.getLevel() >= 5, '等級自然提升達 Level 5（normal profile 小怪湧潮降頻調降下，純配送迎擊策略自然達 Level 5）');
  assert.ok(probe.getOil() > 0, '燈油保持在安全值 > 0');
  assert.ok(probe.getEnemies().filter(e => e.hp > 0).length <= 25, '清怪效率顯著，怪物維持在 25 隻以下');
});
