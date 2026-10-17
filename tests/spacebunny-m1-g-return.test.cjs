"use strict";

// M1-G-Q6（Space Bunny 唯讀 QA 新增檔）：S1 結算 → 回旅路地圖 → 真 confirm 重進 night-town 的 consumer 負向。
// 只新增本檔；不修改 js/game.js、js/store.js、js/ui.js、js/overworld.js、AGY／Grok 任何測試或四權威文件。
// 沙箱為記憶體 VM：真 game.js / store.js / dev-mode.js / overworld.js，UI／RENDERER／AUDIO 僅取必要 stub。
// 終局（達標配送數、終王低血、時鐘推進）為「受控 fixture」，不是正常十分鐘長局；重進走真 confirmOverworld，
// 不用 probe 直接 start 取代 world consumer。
// 執行：node --require ./tools/director-audio-freeze.cjs --test tests/spacebunny-m1-g-return.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const OFFICIAL = "yokai-delivery-v1";
const DEV_KEY = "yokai-delivery-dev-v1";
const read = name => fs.readFileSync(path.join(ROOT, "js", name), "utf8");

const PROBE = `
window.__sq = {
  start: id => start(id),
  frame, update, offerUp, applyChoice, hurt, loseRun,
  activateMenu, confirmOverworld, enterOverworld, moveOverworld,
  snap: () => ({ state, level, score, delivered, stageId: STAGE.id, xp, endCooldown }),
  overworld: () => overworld,
  build: () => getBuildState(),
  charms: () => [...buildCharms],
  mutations: () => [...buildMutations],
  duos: () => [...buildDuos],
  revision: () => buildRevision,
  stores: () => ({ canSave: STORE.canSave(), stages: JSON.parse(JSON.stringify(STORE.data.progress.stages)),
    unlocked: { ...STORE.data.progress.unlocked }, completed: { ...STORE.data.progress.completed } }),
  stageStats: id => JSON.parse(JSON.stringify(STORE.getStageStats(id))),
  isUnlocked: id => STORE.isStageUnlocked(id),
  isCompleted: id => STORE.isStageCompleted(id),
  pendingDepart: () => pendingDepart,
  // 受控終局 fixture（明確非自然長局）
  presetEndgame: () => { delivered = GOAL_DELIVERIES; oil = 100; P.inv = 999; },
  spawnFinalBoss: () => { const e = { x: P.x + 60, y: P.y, hp: 1, max: 9999, type: "boss", final: true, shield: false, slowT: 0 }; enemies.push(e); return e; },
  enterButton: () => window.OVERWORLD.enterButton(),
  moveTo: id => window.OVERWORLD.moveTo(overworld, id),
  inspect: id => window.OVERWORLD.inspect(overworld, id),
  clearInspect: () => window.OVERWORLD.clearInspect(overworld),
  confirm: () => window.OVERWORLD.confirm(overworld),
  isMoving: () => window.OVERWORLD.isMoving(overworld),
  currentId: () => overworld.currentId,
  selected: () => { const n = window.OVERWORLD.selectedNode(overworld); return n && (n.stageId || n.id); },
  enterable: id => { const n = (window.OVERWORLD.NODES || []).find(x => x.stageId === id || x.id === id); return n ? window.OVERWORLD.isEnterable(n) : null; },
  configs: () => ({
    charms: Object.entries(CHARM_CONFIG).map(e => ({ id: e[0], inPool: e[1].inPool !== false })),
    mutations: Object.entries(MUTATION_CONFIG).map(e => ({ id: e[0], inPool: e[1].inPool !== false,
      skills: Array.isArray(e[1].skillIds) ? e[1].skillIds.slice() : (e[1].skillId ? [e[1].skillId] : []) })),
    duos: Object.entries(DUO_CONFIG).map(e => ({ id: e[0], inPool: e[1].inPool !== false, skills: (e[1].skillIds || []).slice() }))
  }),
  setWeapon: (id, lvl) => { WL[id] = lvl; wT[id] = 0; },
  setBuild: (charms, mutations, duos) => { buildCharms = charms.slice(); buildMutations = mutations.slice(); buildDuos = duos.slice(); buildRevision++; return getBuildState(); },
  artPendingNow: () => artPending()
};
`;

function boot(seed, opts = {}) {
  const storage = new Map(Object.entries(seed || {}));
  const texts = [];
  const containerH = {}, canvasH = {}, winH = {};
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillText: t => texts.push(String(t))
  }, { get: (o, k) => o[k] || (() => {}) });
  const container = { addEventListener: (k, fn) => { containerH[k] = fn; } };
  const canvas = { addEventListener: (k, fn) => { canvasH[k] = fn; }, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }) };
  const Event = class Event { constructor(type) { this.type = type; } };
  const env = { console, Set, Map, Math, Date, Event, URLSearchParams,
    performance: { now: () => env.__now || 0 }, navigator: {}, requestAnimationFrame() {},
    innerWidth: 900, innerHeight: 600,
    location: { hostname: "127.0.0.1", search: opts.search || "" },
    localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)) },
    document: { hidden: false,
      getElementById: id => (id === "game-container" ? container : (id === "controls-open" ? { click() {} } : canvas)),
      addEventListener() {}, body: {} },
    addEventListener: (k, fn) => { winH[k] = fn; } };
  env.window = env; env.window.dispatchEvent = () => {};
  env.ART_READY = true; env.MAP_ART_READY = true;
  const c = vm.createContext(env);
  // 順序對齊 index.html：dev-mode 先於 store（js/store.js 以 window.DEV_MODE 決定正式／dev key）
  for (const n of ["dev-mode", "words", "world", "store", "config", "viewport", "controls", "overworld",
    "fx", "skillfx", "evolutions", "boss-ai", "story-dialogue"]) {
    vm.runInContext(read(n + ".js"), c, { filename: path.join(ROOT, "js", n + ".js") });
  }
  c.CONTROLS.mount = () => {};
  c.AUDIO = new Proxy({}, { get: () => () => {} });
  c.RENDERER = new Proxy({ getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 450, y: 300 }),
    getShakeOffset: () => ({ x: 0, y: 0 }), updateEffects: () => false, setCam() {}, clearShake() {},
    triggerShake() {}, setDepthStage() {}, drawHouse() {}, drawPlayer() {}, drawMonster() {} },
    { get: (o, k) => o[k] || (() => {}) });
  const rawUI = read("ui.js");
  vm.runInContext(rawUI, c, { filename: path.join(ROOT, "js", "ui.js") });
  const realUI = c.UI;
  c.UI = new Proxy(Object.assign({}, realUI, { readableFont: () => "20px sans-serif" }),
    { get: (o, k) => (o[k] !== undefined ? o[k] : (() => null)) });
  let rawGame = read("game.js");
  // 負向對照開關（僅記憶體改動，絕不寫檔）：SQU_OMIT_CLEANUP=mutations,charms,duos
  // 只移除 js/game.js 的 start() 清理區塊該行（宣告處保留），用來證明該行是承重守衛。
  const omit = new Set((process.env.SQU_OMIT_CLEANUP || "").split(",").map(s => s.trim()).filter(Boolean));
  if (omit.size) {
    const lines = rawGame.split(/\r?\n/);
    const at = lines.findIndex((l, i) => i > 400 && /^\s*buildMutations = \[\];\s*$/.test(l));
    if (at < 0) throw new Error("SQU_OMIT_CLEANUP: 找不到 start() 的清理區塊");
    const slot = { mutations: at, charms: at + 1, duos: at + 2 };
    for (const key of omit) {
      const idx = slot[key];
      if (idx === undefined) throw new Error("SQU_OMIT_CLEANUP: 未知鍵 " + key);
      if (!/^(\s*)build\w+ = \[\];\s*$/.test(lines[idx])) throw new Error("SQU_OMIT_CLEANUP: 位置不符 " + key);
      lines[idx] = "";
    }
    rawGame = lines.join("\n");
  }
  const cut = rawGame.lastIndexOf("})();");
  vm.runInContext(rawGame.slice(0, cut) + PROBE + "\n" + rawGame.slice(cut), c, { filename: path.join(ROOT, "js", "game.js") });
  let t = 1000;
  const q = c.__sq;
  const frames = n => { for (let i = 0; i < n; i++) { env.__now = (t += 16); q.frame(env.__now); } };
  const until = (pred, max) => { let n = 0; while (!pred() && n++ < (max || 2000)) frames(1); return pred(); };
  const pointerAt = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0,
    target: null, preventDefault() {}, stopPropagation() {} });
  return { c, q, env, storage, texts, frames, until, pointerAt, containerH, winH, OFFICIAL };
}

const SEED = () => ({
  best: 40, bestDel: 3, m: {},
  progress: { unlocked: { "night-town": true }, completed: {}, stages: {} }
});
const seedStorage = () => ({ [OFFICIAL]: JSON.stringify(SEED()), "yokai-tutorial-v1": '"skip"' });
// VM 內建立的陣列是跨 realm，strict deepEqual 會因 prototype 不同而失敗；一律轉成 host 陣列再比
const arr = v => Array.from(v);

// 從主選單真進入旅路，走到 night-town 並以真 confirmOverworld 進關（非 probe 直接 start）
function enterFirstRunFromWorld(b) {
  b.q.activateMenu("start");
  assert.equal(b.q.snap().state, "overworld", "主選單應先進旅路地圖");
  assert.equal(b.q.moveTo("night-town"), true, "地圖應可接受移動到 night-town");
  // moveTo 是動畫移動（overworld.js 設 targetId/moveT），currentId 要等 OVERWORLD.update 走完
  assert.equal(b.until(() => !b.q.isMoving() && b.q.currentId() === "night-town", 200), true, "應走完到 night-town");
  assert.equal(b.q.selected(), "night-town");
  b.q.confirmOverworld();
  assert.equal(b.q.snap().state, "play", "真 confirmOverworld 應進關");
  assert.equal(b.q.snap().stageId, "night-town");
}

// 受控終局：達標配送數 → 真傷害擊殺終王 → 真勝利演出 → 真 runFrame 觸發 STORE.finish → won
function settleAsWin(b) {
  b.q.presetEndgame();
  b.q.hurt(b.q.spawnFinalBoss(), 999);
  assert.equal(b.q.snap().state, "victory", "真傷害應觸發勝利演出");
  assert.equal(b.until(() => b.q.snap().state === "won"), true, "演出應自然走到 won");
  b.until(() => b.q.snap().endCooldown <= 0, 200);
}

// 受控 fixture 前置：從真 CHARM/MUTATION/DUO config 挑合法 ID，Duo 所需技能一律設 Lv3
// （對齊 Duo 資格門檻「兩技能皆 Lv3+」，見 js/game.js 的 DUO 資格判定；不刻意拉高成覺醒）。
// 此為前置注入，非自然取得。
function establishLegalBuild(b) {
  const cfg = b.q.configs();
  const duo = cfg.duos.find(d => d.inPool && d.skills.length === 2);
  assert.ok(duo, "真 config 應至少有一組 inPool Duo");
  b.q.setWeapon("katana", 3);
  for (const s of duo.skills) b.q.setWeapon(s, 3);
  const mutation = cfg.mutations.find(m => m.inPool && m.skills.some(s => duo.skills.includes(s)));
  assert.ok(mutation, "真 config 應有適用於該組合的變異");
  const charm = cfg.charms.find(c => c.inPool);
  assert.ok(charm, "真 config 應有可用御守");
  return { duo, mutation, charm, build: b.q.setBuild([charm.id], [mutation.id], [duo.id]) };
}

// 斷言前置確實非空，且由真 getBuildState() 讀出（不是空 build 假綠）
function assertNonEmptyPreset(b, preset) {
  const build = b.q.build();
  const actives = arr(build.activeSkills);
  assert.ok(actives.includes("katana"), "前置必須含固定妖刀");
  assert.ok(actives.length >= 2, "前置必須另有至少一個主動技能，實際 " + JSON.stringify(actives));
  for (const s of preset.duo.skills) {
    assert.ok(actives.includes(s), "Duo 所需技能必須真的持有：" + s + " 實際 " + JSON.stringify(actives));
  }
  assert.deepEqual(arr(build.charms), [preset.charm.id], "前置應有 1 御守");
  assert.deepEqual(arr(build.mutations), [preset.mutation.id], "前置應有 1 變異");
  assert.deepEqual(arr(build.duos), [preset.duo.id], "前置應有 1 Duo");
  assert.deepEqual(arr(preset.build.duos), [preset.duo.id], "setBuild 應立刻反映在真 BuildState");
  return build;
}

function assertBaselineBuild(b) {
  const build = b.q.build();
  assert.deepEqual(arr(build.activeSkills), ["katana"], "重進後只剩固定妖刀");
  assert.deepEqual(arr(build.charms), [], "重進後御守必須清空");
  assert.deepEqual(arr(build.mutations), [], "重進後變異必須清空");
  assert.deepEqual(arr(build.duos), [], "重進後 Duo 必須清空");
}

test("won → 回旅路地圖 → 真 confirm 重進 night-town：非空 build 全清、clears 不二次計數", () => {
  const b = boot(seedStorage());
  enterFirstRunFromWorld(b);
  b.frames(3);
  assert.equal(b.q.stores().stages["night-town"].attempts, 1, "首局 startRun 計 1 次");

  // 明示非空前置（受控 fixture）
  const preset = establishLegalBuild(b);
  assertNonEmptyPreset(b, preset);

  settleAsWin(b);
  assert.equal(b.q.stores().stages["night-town"].clears, 1, "勝利應只記 1 次清關");
  assert.equal(b.q.isCompleted("night-town"), true);
  assert.equal(b.q.isUnlocked("rain-port"), true, "首通應解鎖 rain-port");

  // 結算 → 回旅路地圖（activateMenu('world') → enterOverworld(false)，保留地圖狀態）
  b.q.activateMenu("world");
  assert.equal(b.q.snap().state, "overworld");
  assert.equal(b.q.selected(), "night-town", "返回後地圖應仍停在 night-town");

  // 真事件：對旅路「進入」鈕送 pointerdown（js/game.js 的 overworld 分支 → confirmOverworld）
  const btn = b.q.enterButton();
  b.containerH.pointerdown(b.pointerAt(btn.x + btn.w / 2, btn.y + btn.h / 2));
  assert.equal(b.q.snap().state, "play", "旅路進入鈕的真 pointerdown 應重進關卡");
  assert.equal(b.q.snap().stageId, "night-town");

  // 重進後局內 build 必須回到基線（前置非空，故此處是真清理驗證）
  assertBaselineBuild(b);

  // 保存不得二次計數
  assert.equal(b.q.stores().stages["night-town"].clears, 1, "重進不得再記清關");
  assert.equal(b.q.stores().stages["night-town"].attempts, 2, "重進應只 +1 次開局計次");
  assert.equal(b.q.isUnlocked("rain-port"), true, "解鎖不得因重進而回退");
  assert.equal(b.q.stores().canSave, true);
});

test("lost → 回旅路地圖 → 真 confirm 重進：不解鎖、不清關、非空 build 仍回基線", () => {
  const b = boot(seedStorage());
  enterFirstRunFromWorld(b);
  b.frames(2);
  const preset = establishLegalBuild(b);
  assertNonEmptyPreset(b, preset);

  b.q.loseRun();
  assert.equal(b.q.snap().state, "lampout", "真 loseRun 應進 lampout 演出");
  assert.equal(b.until(() => b.q.snap().state === "lost"), true);
  b.until(() => b.q.snap().endCooldown <= 0, 200);

  assert.equal(b.q.isCompleted("night-town"), false, "敗局不得標記完成");
  assert.equal(b.q.isUnlocked("rain-port"), false, "敗局不得解鎖下一關");
  assert.equal(b.q.stores().stages["night-town"].clears, 0, "敗局不得記清關（getStageStats 讀取即建列，故為 0 而非缺欄）");

  b.q.activateMenu("world");
  assert.equal(b.q.snap().state, "overworld");
  b.q.confirmOverworld();
  assert.equal(b.q.snap().state, "play", "敗局後仍可由旅路重進 night-town");
  assert.equal(b.q.snap().stageId, "night-town");
  assertBaselineBuild(b);
  assert.equal(b.q.stores().stages["night-town"].clears, 0, "重進後仍不得憑空記清關");
  assert.equal(b.q.stores().stages["night-town"].attempts, 2);
  assert.equal(b.q.isUnlocked("rain-port"), false, "重進不得憑空解鎖");
});

// DEV 隔離：真 dev-mode 先於 STORE 載入 → dev 勝利只寫 dev key → 回旅路真重進仍隔離。
// 終局為受控 fixture（達標配送＋真傷害終王），非自然局／非十分鐘長局／非 Chrome／非實機。
test("DEV：dev-mode 優先載入 → 勝利只寫 dev key → 回旅路真重進後 build 清空且正式 key 原封不動", () => {
  const officialSeed = JSON.stringify(SEED());
  const officialStorage = { [OFFICIAL]: officialSeed };
  const b = boot(officialStorage, { search: "?dev=1" });

  // 真 dev-mode 必須在 STORE 之前載入並啟用（js/store.js 以 window.DEV_MODE 決定寫入 key）
  assert.equal(b.c.DEV_MODE.isDevMode(b.env.location), true, "?dev=1 應啟用 dev 模式");
  assert.equal(b.c.DEV_MODE.sessionKey(b.env.location), DEV_KEY, "dev 模式 STORE 應綁 dev key");

  enterFirstRunFromWorld(b);
  b.frames(3);
  const preset = establishLegalBuild(b);
  assertNonEmptyPreset(b, preset);
  assert.equal(b.q.stores().stages["night-town"].attempts, 1, "dev 開局應計 1 次");

  settleAsWin(b);
  assert.equal(b.q.stores().stages["night-town"].clears, 1, "dev 通關應記 1 次清關");
  assert.equal(b.q.isCompleted("night-town"), true);
  assert.equal(b.q.isUnlocked("rain-port"), true, "dev 應只解鎖 dev 沙箱進度");
  assert.equal(b.storage.has(DEV_KEY), true, "dev 進度必須寫在 dev key");
  assert.equal(b.storage.get(OFFICIAL), officialSeed, "正式 key 必須 byte-identical：dev 勝利不得寫正式檔");

  // 回旅路 → 真 confirm 重進 night-town
  b.q.activateMenu("world");
  assert.equal(b.q.snap().state, "overworld");
  assert.equal(b.q.selected(), "night-town", "dev 返回後地圖應仍停在 night-town");
  b.q.confirmOverworld();
  assert.equal(b.q.snap().state, "play", "dev 局也應能由旅路真重進");
  assert.equal(b.q.snap().stageId, "night-town");
  assertBaselineBuild(b);
  assert.equal(b.q.stores().stages["night-town"].clears, 1, "dev 重進不得再記清關");
  assert.equal(b.q.stores().stages["night-town"].attempts, 2, "dev 重進應只 +1 次開局計次");
  assert.equal(b.storage.get(OFFICIAL), officialSeed, "重進後正式 key 仍須 byte-identical");

  // 正式存檔 reload：必須用「本次跑完後的實際 storage」，證明兩個 key 同時存在且正式仍未通關／解鎖
  const ob = boot(Object.fromEntries(b.storage), { search: "" });
  assert.equal(ob.c.DEV_MODE.sessionKey(ob.env.location), OFFICIAL, "正式模式應綁正式 key");
  assert.equal(ob.storage.has(DEV_KEY), true, "實際 storage 應同時含 dev key");
  assert.equal(ob.storage.get(OFFICIAL), officialSeed, "實際 storage 的正式 key 仍須是原字串");
  assert.equal(ob.q.isCompleted("night-town"), false, "正式存檔不得冒認 dev 通關");
  assert.equal(ob.q.isUnlocked("rain-port"), false, "正式存檔不得冒認 dev 解鎖");
  assert.deepEqual(arr(Object.keys(ob.q.stores().completed)), [], "正式 completed 應仍為空");
  assert.deepEqual(arr(Object.keys(ob.q.stores().unlocked)), ["night-town"], "正式 unlocked 應仍只有 night-town");
});

test("旅路選鎖住的關卡不得進關、不得記開局", () => {
  const b = boot(seedStorage());
  enterFirstRunFromWorld(b);
  b.q.activateMenu("world");
  const before = b.q.stores().stages["night-town"].attempts;

  // 真負向：鎖住的終章不得可進入，且真 moveTo 必須拒絕
  assert.equal(b.q.isUnlocked("yomi"), false, "yomi 未解鎖");
  assert.equal(b.q.enterable("yomi"), false, "OVERWORLD.isEnterable 對鎖關必須為 false");
  assert.equal(b.q.moveTo("yomi"), false, "真 moveTo 對鎖關必須拒絕（overworld.js moveTo 的存取守衛）");

  // 鎖關仍可「檢視」（設計如此），但確認不得離開地圖、不得觸發 startRun
  assert.equal(b.q.inspect("yomi"), true, "鎖關應可檢視但不可進入");
  assert.equal(b.q.selected(), "yomi");
  b.q.confirmOverworld();
  b.frames(3);
  assert.equal(b.q.snap().state, "overworld", "鎖關不得離開地圖");
  assert.equal(b.q.stores().stages["night-town"].attempts, before, "鎖關不得觸發 startRun");

  // 回到可進關節點後仍能正常重進（地圖未被鎖死）
  b.q.clearInspect();
  b.q.confirmOverworld();
  assert.equal(b.q.snap().state, "play", "清除檢視後應能正常進關");
  assert.equal(b.q.snap().stageId, "night-town");
  assert.equal(b.q.stores().stages["night-town"].attempts, before + 1);
});

test("旅路確認時地圖圖未就緒 → 記住請求，圖就緒後自動續行且只進一次", () => {
  const b = boot(seedStorage());
  enterFirstRunFromWorld(b);
  b.frames(2);
  b.q.activateMenu("world");
  const before = b.q.stores().stages["night-town"].attempts;

  b.env.MAP_ART_READY = false;
  assert.equal(b.q.artPendingNow(), true, "地圖圖未就緒時 artPending 應為 true");
  b.q.confirmOverworld();
  assert.equal(b.q.snap().state, "overworld", "圖未就緒不得進關");
  assert.equal(b.q.pendingDepart(), true, "應記住待出發請求");
  b.frames(30);
  assert.equal(b.q.snap().state, "overworld", "圖未就緒時持續等待，不得進關");

  b.env.MAP_ART_READY = true;
  assert.equal(b.q.artPendingNow(), false);
  assert.equal(b.until(() => b.q.snap().state === "play", 120), true, "圖就緒後應自動續行進關");
  assert.equal(b.q.snap().stageId, "night-town");
  b.frames(5);
  assert.equal(b.q.pendingDepart(), false, "出發後請求應清除");
  assert.equal(b.q.stores().stages["night-town"].attempts, before + 1, "續行只應進一次關（+1 開局）");
});
