// V3 驗收用遊戲執行期工具（Hermes 責任範圍）。
// 目的：在真正的 vm 沙箱內載入 js/game.js 及其相依模組，取得可觀測狀態，
// 供 tests/v3-*.test.cjs 做行為斷言。與 tests/input-runtime.test.cjs 的
// 私有 loadGame 同源，但獨立存在，不修改舊測試。
//
// 校準基準：HEAD da98b4b，392/392 通過（見 tests/v3-baseline.test.cjs）。
//
// 設計規則：所有探針都用 typeof 包起來讀取「可能尚未存在」的 production 變數，
// 讓 V3 尚未實作的行為表現為明確斷言失敗（RED），而不是 vm 載入期 ReferenceError。
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(ROOT, 'js', name), 'utf8');

// V3 校準基準提交。baseline 測試必須固定讀這個版本的 js/*，否則
// production 實作後「舊行為」會被改掉，校準測試就失去意義（會變成假綠）。
const BASELINE_REVISION = 'da98b4b';

/**
 * 從 git 物件庫讀出某個提交下的 js 檔案內容。
 * 用於把「舊規格基線」與「現行 working tree」在時間上切開。
 */
function readAtRevision(revision, name) {
  return execFileSync('git', ['-C', ROOT, 'show', `${revision}:js/${name}`],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const MODULE_ORDER = [
  'words', 'world', 'store', 'config', 'viewport', 'controls',
  'overworld', 'fx', 'skillfx', 'evolutions'
];

// 注入 game.js 的 fixture。snapshot 以 typeof 守衛讀取 V3 新狀態；
// 現行 da98b4b 下這些欄位為 undefined，測試會如實看到「未實作」。
const FIXTURE = `window.fixture = {
  start, update, frame, makeOrder, hurt, offerUp, triggerHint, resolve, spawnEnemy, weapons, answerChoices,
  answerBoss, mkQ,
  configureStage: id => configureStage(id),
  weaponChoices: () => choices.filter(c=>c.type==='weapon'),
  currentChoices: () => choices,
  pendingPickup: () => inter,
  reviewWords: () => misses,
  failCount: () => failed,
  setState: next => { state=next; ended=false; },
  setOil: value => { oil=value; },
  setElapsed: value => { elapsed=value; },
  setXp: value => { xp=value; },
  currentXp: () => xp,
  currentLevel: () => level,
  meetDeliveryGoal: () => { delivered=GOAL_DELIVERIES; },
  prepareOrder: () => { makeOrder(); inter=orders[0]; interact(); job.lock=0; },
  preparePickup: () => { makeOrder(); inter=orders[0]; },
  pickupWord: word => { const route=orders[0] || {from:houses[0],to:houses[1],rev:false};
    orders=[{...route,word,life:110}]; job=null; inter=orders[0]; interact(); job.lock=0; },
  atDestination: () => { P.x=job.to.x; P.y=job.to.y+110; },
  atAnswer: () => { const p=ansPos(job.to)[job.ans.indexOf(job.word)]; P.x=p.x; P.y=p.y; },
  housesNow: () => houses.map(h=>({id:h.id,x:h.x,y:h.y,word:h.word})),
  placeAt: (x,y) => { P.x=x; P.y=y; },
  face: angle => { P.faceAng=angle; },
  clearSolids: () => solids.splice(0),
  clearOrders: () => { orders=[]; job=null; },
  clearEnemies: () => { enemies=enemies.filter(e=>e.type==='boss'); },
  stopSpawns: () => { spawnT=Infinity; surgeT=Infinity; },
  scheduleBoss: () => { bossT=0; },
  advanceBossClock: offset => { elapsed=BOSS_TIMES[bossStage]+offset; bossT=-offset; },
  prepareBoss: word => { const bs={x:P.x+200,y:P.y,type:'boss',word:word||ALL[0],hp:999,max:999,shield:true,flash:0,wob:0,speed:0};
    enemies.push(bs); bossQ=mkQ(bs); bossQ.lock=0; },
  unlockBoss: () => { bossQ.lock=0; },
  moveBoss: distance => { const bs=enemies.find(e=>e.type==='boss'); Object.assign(bs,{x:P.x+distance,y:P.y,speed:0,wob:0,flash:0}); },
  matchBossToJob: () => { const bs=enemies.find(e=>e.type==='boss'); bs.word=job.word; bossQ=mkQ(bs); bossQ.lock=0; },
  setWeaponRank: (id,rank) => { WL[id]=rank; wT[id]=Infinity; },
    // 讓已持有的武器立刻可用（wT[id]=0），用於測試實際施放而非被 Infinity 冷卻擋住。
    armWeapons: () => { for(const k of Object.keys(WL)) if (WL[k]>0) wT[k]=0; },
  combatScene: (weapon, foes, walls=[], rank=1) => {
    Object.keys(WL).forEach(k=>WL[k]=0); WL[weapon]=rank; wT[weapon]=0;
    enemies=foes.map(e=>({x:P.x+(e.dx||0),y:P.y+(e.dy||0),hp:999,max:999,type:'ghost',flash:0,wob:0,...e}));
    solids.splice(0,solids.length,...walls.map(s=>({x0:P.x+s.x0,x1:P.x+s.x1,y0:P.y+s.y0,y1:P.y+s.y1})));
  },
  tune: id => UP.find(u=>u.id===id),
  maxOutUpgrades: () => { Object.keys(WL).forEach(k=>WL[k]=['katana','barrier','needle','fire'].includes(k)?5:0);
    for(const u of UP) while(!u.ok || u.ok()) u.f(); },
  runSummary: () => runSummary,
  oilNow: () => oil,
  maxOilNow: () => maxOil,
  bNow: () => ({ ...b }),
  weaponLevels: () => ({ ...WL }),
  // V3 探針：da98b4b 下全部 undefined（RED 訊號），實作後才會有值。
  v3: () => ({
    seals: typeof seals!=='undefined' ? seals : undefined,
    sealCount: typeof sealCount!=='undefined' ? sealCount : undefined,
    sealMax: typeof SEAL_MAX!=='undefined' ? SEAL_MAX : undefined,
    deliveryXp: typeof DELIVERY_XP!=='undefined' ? DELIVERY_XP : undefined,
    deliveryXpOverride: typeof DELIVER_XP!=='undefined' ? DELIVER_XP : undefined,
    bossReadFrozen: typeof readFrozen!=='undefined' ? readFrozen : undefined,
    answerHoldSeconds: typeof ANSWER_HOLD!=='undefined' ? ANSWER_HOLD : undefined,
    wrongPenalty: typeof WRONG_OIL!=='undefined' ? WRONG_OIL : undefined,
    hintCost1: typeof HINT_COST_FIRST!=='undefined' ? HINT_COST_FIRST : undefined,
    hintCost2: typeof HINT_COST_SECOND!=='undefined' ? HINT_COST_SECOND : undefined,
    katanaMaxTravel: typeof KATANA_MAX_TRAVEL!=='undefined' ? KATANA_MAX_TRAVEL : undefined,
    katanaMaxPierce: typeof KATANA_MAX_PIERCE!=='undefined' ? KATANA_MAX_PIERCE : undefined,
    needleExtraBudget: typeof NEEDLE_EXTRA_BUDGET!=='undefined' ? NEEDLE_EXTRA_BUDGET : undefined,
    needleExtraRadius: typeof NEEDLE_EXTRA_RADIUS!=='undefined' ? NEEDLE_EXTRA_RADIUS : undefined,
    boomBulletCap: typeof BOOM_BULLET_CAP!=='undefined' ? BOOM_BULLET_CAP : undefined,
    boomCooldownFloor: typeof BOOM_CD_FLOOR!=='undefined' ? BOOM_CD_FLOOR : undefined,
    needleCooldownFloor: typeof NEEDLE_CD_FLOOR!=='undefined' ? NEEDLE_CD_FLOOR : undefined,
    katanaCooldownFloor: typeof KATANA_CD_FLOOR!=='undefined' ? KATANA_CD_FLOOR : undefined,
    barrierCooldownFloor: typeof BARRIER_CD_FLOOR!=='undefined' ? BARRIER_CD_FLOOR : undefined,
    barrierLv5Radius: typeof BARRIER_LV5_R!=='undefined' ? BARRIER_LV5_R : undefined,
    barrierFieldSeconds: typeof BARRIER_FIELD_T!=='undefined' ? BARRIER_FIELD_T : undefined,
    barrierHeals: typeof BARRIER_HEALS!=='undefined' ? BARRIER_HEALS : undefined,
    thunderExecutesOnHp: typeof THUNDER_HP_EXECUTE!=='undefined' ? THUNDER_HP_EXECUTE : undefined,
    thunderLv5Radius: typeof THUNDER_LV5_R!=='undefined' ? THUNDER_LV5_R : undefined,
    thunderLv5Cooldown: typeof THUNDER_LV5_CD!=='undefined' ? THUNDER_LV5_CD : undefined,
    fireOrbitLv5: typeof FIRE_ORBIT_LV5!=='undefined' ? FIRE_ORBIT_LV5 : undefined,
    dragonCooldown: typeof DRAGON_CD!=='undefined' ? DRAGON_CD : undefined,
    scorchSeconds: typeof SCORCH_T!=='undefined' ? SCORCH_T : undefined,
    scorchMaxZones: typeof SCORCH_MAX_ZONES!=='undefined' ? SCORCH_MAX_ZONES : undefined,
    bossHpTable: typeof BOSS_HP!=='undefined' ? BOSS_HP : undefined,
    bossHpScalesWithPower: typeof BOSS_SCALES_WITH_POWER!=='undefined' ? BOSS_SCALES_WITH_POWER : undefined,
    gatekeeperHp: typeof GATEKEEPER_HP!=='undefined' ? GATEKEEPER_HP : undefined,
    bossQuizPerBoss: typeof BOSS_QUIZ_PER_BOSS!=='undefined' ? BOSS_QUIZ_PER_BOSS : undefined,
    passiveDamageStep: typeof PASSIVE_DMG_STEP!=='undefined' ? PASSIVE_DMG_STEP : undefined,
    passiveDamageMax: typeof PASSIVE_DMG_MAX!=='undefined' ? PASSIVE_DMG_MAX : undefined,
    critChanceCap: typeof CRIT_CHANCE_CAP!=='undefined' ? CRIT_CHANCE_CAP : undefined,
    oilRegenCap: typeof OIL_REGEN_CAP!=='undefined' ? OIL_REGEN_CAP : undefined,
    pickupSlow: typeof PICKUP_SLOW!=='undefined' ? PICKUP_SLOW : undefined,
    recallGuardSeconds: typeof RECALL_GUARD!=='undefined' ? RECALL_GUARD : undefined
  }),
  snapshot: () => ({
    state, level, xp, xpNeed: xpNeed(), oil, maxOil, score, delivered, failed,
    elapsed, bossStage, bossT, finalBossDefeated, x:P.x, y:P.y, inv:P.inv,
    job, orders, bossQ, bossQsDone: typeof bossQsDone!=='undefined' ? bossQsDone : undefined,
    enemies, enemyBullets, gems, winds: typeof winds==='undefined'?[]:winds,
    dragonShots: typeof dragonShots==='undefined'?[]:dragonShots,
    dragonScorches: typeof dragonScorches==='undefined'?[]:dragonScorches,
    proj: typeof proj==='undefined'?[]:proj,
    needles: typeof needles==='undefined'?[]:needles,
    choiceLv: choices.map(c=>c.lv), choiceIds: choices.map(c=>c.id),
    runSummary
  })
};`;

/**
 * 建立一個完整的遊戲執行期沙箱。
 * @param {{seed?:number, stage?:string, storage?:Object}} options
 *   seed 決定 Math.random 的固定序列，讓排程／抽詞可重現。
 */
function loadGame(options = {}) {
  const seed = options.seed === undefined ? 1 : options.seed;
  const stage = options.stage || 'night-town';
  // revision 指向 git 提交時，全部 js/* 一律讀該版本（baseline 用）。
  const revision = options.revision || null;
  const reader = revision
    ? name => readAtRevision(revision, name)
    : read;

  // 可重現亂數：mulberry32，取代 Math.random。
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const seededMath = Object.create(Math);
  seededMath.random = rand;

  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    setTransform() {}, fillText() {}, measureText: () => ({ width: 40 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient
  }, { get: (o, k) => o[k] || (() => {}) });

  const canvas = {
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 })
  };
  const events = {};
  const storage = new Map([['yokai-tutorial-v1', '"skip"']]);
  const env = {
    console, Set, Map, Math: seededMath, Date, performance: { now: () => 0 },
    navigator: {}, requestAnimationFrame() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: {
      hidden: false, getElementById: id => id === 'controls-open' ? { click() {} } : canvas,
      addEventListener() {}
    },
    addEventListener: (k, f) => { events[k] = f; }
  };
  env.window = env;
  env.innerWidth = 900;
  env.innerHeight = 600;

  const c = vm.createContext(env);
  for (const name of MODULE_ORDER) vm.runInContext(reader(`${name}.js`), c);
  c.CONTROLS.mount = () => {};
  const audioCalls = [];
  c.AUDIO = new Proxy({}, { get: (o, name) => () => audioCalls.push(name) });
  c.RENDERER = new Proxy({
    getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }),
    getShakeOffset: () => ({ x: 0, y: 0 }), updateEffects: () => false,
    addSlashArc() {}, spawnDamageNumber() {}, triggerShake() {}
  }, { get: (o, k) => o[k] || (() => {}) });
  vm.runInContext(reader('ui.js'), c);
  const uiStatics = Object.fromEntries(Object.entries(c.UI).filter(([, v]) => typeof v !== 'function'));
  c.UI = new Proxy({
    ...uiStatics,
    bossQuizLayout: c.UI.bossQuizLayout, codexButtons: c.UI.codexButtons,
    codexRows: c.UI.codexRows, pauseButtons: c.UI.pauseButtons,
    HINT_BTN: { x: 532, y: 20, w: 78, h: 40 },
    readableFont: () => '20px sans-serif'
  }, { get: (o, k) => o[k] || (() => {}) });

  const source = reader('game.js');
  const end = source.lastIndexOf('})();');
  vm.runInContext(source.slice(0, end) + FIXTURE + source.slice(end), c);

  const fixture = c.window.fixture;
  fixture.ctx = ctx;
  fixture.env = c;
  fixture.audioCalls = audioCalls;
  fixture.events = events;
  fixture.seed = seed;
  if (stage !== 'night-town') fixture.configureStage(stage);
  // start 需在沙箱內呼叫內部 resetRun，這裡以 startRun 的別名暴露。
  fixture.startRun = fixture.start;
  return fixture;
}

module.exports = { loadGame, ROOT, BASELINE_REVISION, readAtRevision };