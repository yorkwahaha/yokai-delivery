"use strict";

// 言靈圖鑑 C1/C2 正式路徑。載入現行 js/game.js 的 makeOrder / resolve。
// 沙箱鉤子（不是玩家十分鐘通關）：
// - 不載入 js/audio.js，AUDIO 只記錄呼叫名稱，不讀 MP3。
// - location.search 附 tilt=1，讓 VM 維持 2D 世界間距；dev=1 仍只決定存檔鍵。
// - usePool 只替換這局詞池；installJob 用同一張委託重放，檢查 event id 冪等。

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(ROOT, name), "utf8");

function element(tag) {
  return {
    tag,
    style: {},
    hidden: false,
    children: [],
    dataset: {},
    value: "",
    textContent: "",
    setAttribute() {},
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    querySelectorAll() { return []; }
  };
}

function createStorage() {
  const box = new Map([["yokai-tutorial-v1", '"skip"']]);
  const gate = { throwOnSet: false };
  return {
    gate,
    getItem(key) { return box.has(key) ? box.get(key) : null; },
    setItem(key, value) {
      if (gate.throwOnSet) throw new Error("quota");
      box.set(key, String(value));
    },
    raw: box
  };
}

function loadGame(options = {}) {
  const storage = options.storage || createStorage();
  const location = options.location || { hostname: "127.0.0.1", search: "?tilt=1" };
  const events = {};
  const canvas = {
    addEventListener() {},
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    focus() {}
  };
  const ctx = new Proxy({
    setTransform() {},
    fillText() {},
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} })
  }, { get: (target, key) => target[key] || (() => {}) });
  const env = {
    console,
    Set,
    Map,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Error,
    URLSearchParams,
    performance: { now: () => 0 },
    navigator: {},
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    requestAnimationFrame() {},
    localStorage: storage,
    location,
    document: {
      hidden: false,
      body: element("body"),
      documentElement: element("html"),
      getElementById: id => id === "controls-open" ? { click() {} } : canvas,
      createElement: element,
      addEventListener() {}
    },
    addEventListener(name, fn) { events[name] = fn; }
  };
  env.window = env;
  const context = vm.createContext(env);
  const loaded = [];
  const run = file => {
    loaded.push(file);
    // 瀏覽器每個 script 有自己的詞法範圍；vm 共用一個 global，外層函式把 const api 隔開。
    vm.runInContext(`(() => {\n${read(file)}\n})()`, context, { filename: path.join(ROOT, file) });
  };
  for (const file of [
    "js/words.js",
    "js/world.js",
    "js/dev-mode.js",
    "js/store.js",
    "js/config.js",
    "js/viewport.js",
    "js/controls.js",
    "js/overworld-layout.js",
    "js/overworld.js",
    "js/card-collection.js",
    "js/card-delivery-bridge.js"
  ]) run(file);
  context.CONTROLS.mount = () => {};
  const audioCalls = [];
  context.AUDIO = new Proxy({}, { get: (target, name) => () => { audioCalls.push(String(name)); return target; } });
  context.RENDERER = new Proxy({
    getCtx: () => ctx,
    getDpr: () => 1,
    getCam: () => ({ x: 0, y: 0 }),
    getShakeOffset: () => ({ x: 0, y: 0 })
  }, { get: (target, key) => target[key] || (() => {}) });
  context.FX = new Proxy({}, { get: () => () => {} });
  context.SKILLFX = { reset() {} };
  context.UI = new Proxy({ readableFont: () => "20px sans-serif" }, { get: (target, key) => target[key] || (() => {}) });
  let chooseCalls = 0;
  const originalChoose = context.CARD_DELIVERY.choose;
  context.CARD_DELIVERY.choose = function chooseCounter(...args) {
    chooseCalls += 1;
    return originalChoose.apply(this, args);
  };
  const source = read("js/game.js");
  const end = source.lastIndexOf("})();");
  const hook = `window.fixture = {
    start, update, makeOrder, resolve, triggerHint, answerBoss,
    prepareBoss: word => { const bs = { x: P.x + 200, y: P.y, type: "boss", word: word || ALL[0], hp: 999, max: 999, shield: true }; enemies.push(bs); bossQ = mkQ(bs); bossQ.lock = 0; return bossQ; },
    bossQuestion: () => bossQ,
    prepareOrder: () => { if (!orders.length) makeOrder(); inter = orders[0] || null; if (!inter) return null; interact(); if (job) job.lock = 0; return job; },
    clearOrders: () => { orders = []; job = null; inter = null; },
    orders: () => orders.slice(),
    job: () => job,
    pool: () => ALL.slice(),
    houses: () => houses.slice(),
    state: () => state,
    delivered: () => delivered,
    usePool: words => replaceList(ALL, words),
    fillMis: () => { enemies = ALL.map((w, i) => ({ hp: 5, max: 5, type: "mis", w, x: P.x + 40 + i, y: P.y })); },
    setDelivered: value => { delivered = value; },
    setElapsed: value => { elapsed = value; },
    bindStudy: fn => { window.__studyPickCalls = 0; if (!study) return false; study.pick = (...args) => { window.__studyPickCalls += 1; return fn(...args); }; return true; },
    studyPickCalls: () => window.__studyPickCalls || 0,
    installJob: saved => { job = saved; state = "play"; },
    floats: () => texts.map(t => t.v),
    clearFloats: () => { texts.splice(0); },
    writeMarks: marks => {
      const key = CARD_DELIVERY.cardKey(location);
      let prev = { v: 1, marks: {}, events: {} };
      try { const raw = JSON.parse(localStorage.getItem(key) || "null"); if (raw && raw.v === 1) prev = raw; } catch {}
      prev.marks = marks;
      prev.events = prev.events || {};
      localStorage.setItem(key, JSON.stringify(prev));
    },
    markOf: jp => CARD_DELIVERY.openCards(localStorage, location).marks(jp),
    cardDoc: () => { try { return JSON.parse(localStorage.getItem(CARD_DELIVERY.cardKey(location)) || "null"); } catch { return null; } },
    learningDoc: key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
  };`;
  runHook(source, end, hook, context);
  loaded.push("js/game.js");
  return {
    ...context.fixture,
    env: context,
    storage,
    location,
    audioCalls,
    loaded,
    events,
    resetChooseCount: () => { chooseCalls = 0; },
    chooseCalls: () => chooseCalls,
    armQuota: () => { storage.gate.throwOnSet = true; }
  };
}

function runHook(source, end, hook, context) {
  vm.runInContext(source.slice(0, end) + hook + source.slice(end), context, {
    filename: path.join(ROOT, "js/game.js")
  });
}

function words(n) {
  return ["あ", "い", "う", "え", "お", "か"].slice(0, n).map(jp => ({ jp, zh: "字" + jp }));
}

function boot(options) {
  const game = loadGame(options);
  game.useRandom = roll => { game.env.Math.random = () => roll; };
  return game;
}

function deliver(game) {
  const job = game.prepareOrder();
  assert.ok(job && job.word, "makeOrder 沒有產生委託");
  const index = job.ans.indexOf(job.word);
  assert.ok(index >= 0);
  game.resolve(index);
  return job;
}

function chooseAt(game, pool, exclude, roll) {
  return game.env.CARD_DELIVERY.openCards(game.storage, game.location).choose(pool, exclude, () => roll);
}

test("makeOrder asks CARD_DELIVERY.choose for the delivery word", () => {
  const src = read("js/game.js");
  const body = src.slice(src.indexOf("function makeOrder"), src.indexOf("function togglePause"));
  const chooseAt = body.indexOf("CARD_DELIVERY.choose");
  const legacyAt = body.indexOf("study?.pick");
  assert.match(body, /CARD_DELIVERY\.choose\(/);
  assert.match(body, /if \(!picked \|\| !picked\.word\) return/);
  assert.ok(chooseAt >= 0 && legacyAt > chooseAt);
});

test("sandbox boots the real makeOrder path without loading audio files", () => {
  const game = boot();
  assert.ok(!game.loaded.includes("js/audio.js"));
  game.useRandom(0);
  game.start("night-town");
  assert.ok(game.houses().length > 0);
  assert.ok(game.orders().length >= 1);
  assert.equal(typeof game.orders()[0].word, "object");
  assert.equal(game.audioCalls.filter(name => name === "speak").length, 0);
});

test("delivery ignores study.pick and missBoost", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.clearOrders();
  const pool = game.pool();
  const boosted = pool[pool.length - 1];
  game.env.STORE.rec(boosted.jp, false);
  assert.ok(game.env.STORE.get(boosted.jp).missBoost > 1);
  assert.equal(game.bindStudy(() => boosted), true);
  game.makeOrder();
  assert.equal(game.studyPickCalls(), 0);
  assert.equal(game.orders()[0].word, pool[0]);
  game.clearOrders();
  game.bindStudy(() => null);
  game.makeOrder();
  assert.equal(game.orders().length, 1);
  assert.equal(game.studyPickCalls(), 0);
  assert.equal(game.orders()[0].word, pool[0]);
});

test("an excluded or empty pool does not invent an order", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.usePool(words(1));
  game.clearOrders();
  game.makeOrder();
  assert.equal(game.orders().length, 1);
  game.setDelivered(1);
  assert.doesNotThrow(() => game.makeOrder());
  assert.equal(game.orders().length, 1);
  game.clearOrders();
  game.usePool(game.env.CONTENT.getStageWords("night-town"));
  game.fillMis();
  assert.doesNotThrow(() => game.makeOrder());
  assert.equal(game.orders().length, 0);
});

test("active orders stay put while the next order uses the remaining weights", () => {
  const game = boot();
  const pool = words(4);
  game.useRandom(0);
  game.start("night-town");
  game.usePool(pool);
  game.clearOrders();
  game.makeOrder();
  const open = game.orders()[0];
  game.setDelivered(1);
  game.writeMarks({ い: 4, う: 4, え: 4 });
  game.useRandom(0.99);
  game.makeOrder();
  assert.equal(game.orders()[0], open);
  assert.equal(open.word, pool[0]);
  assert.equal(open.life, 110);
  const oracle = chooseAt(game, pool, [pool[0].jp], 0.99);
  assert.equal(game.orders()[1].word, oracle.word);
  assert.notEqual(game.orders()[1].word, open.word);
  assert.ok(Math.abs(oracle.weights.sum - 100) < 1e-6);
});

test("a successful delivery refreshes only the next new order", () => {
  const game = boot();
  const pool = words(4);
  game.start("night-town");
  game.usePool(pool);
  game.clearOrders();
  game.writeMarks({ あ: 3 });
  const before = chooseAt(game, pool, [], 0.3);
  game.useRandom(0);
  game.makeOrder();
  assert.equal(game.orders()[0].word.jp, "あ");
  deliver(game);
  assert.equal(game.markOf("あ"), 4);
  assert.equal(game.orders().length, 0);
  game.useRandom(0.3);
  game.makeOrder();
  const after = chooseAt(game, pool, [], 0.3);
  assert.equal(game.orders()[0].word, after.word);
  assert.notEqual(after.word.jp, before.word.jp);
});

test("independent success stamps once and does not copy learning box into the card", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.clearOrders();
  game.makeOrder();
  const jp = game.orders()[0].word.jp;
  const learning = game.env.STORE.get(jp);
  learning.ok = 9;
  learning.box = 2;
  const job = deliver(game);
  assert.equal(game.markOf(jp), 1);
  assert.equal(learning.ok, 10);
  assert.equal(learning.box, 3);
  assert.equal(game.cardDoc().marks[jp], 1);
  assert.equal(Object.keys(game.cardDoc().events).length, 1);
  assert.equal(game.cardDoc().events[job.cardEventId], true);
  assert.equal(game.learningDoc("yokai-delivery-v1").marks, undefined);
});

test("failure adds no mark and the later assisted success of that delivery adds one", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.clearOrders();
  const job = game.prepareOrder();
  const wrong = job.ans.findIndex(word => word !== job.word);
  game.resolve(wrong);
  assert.equal(game.markOf(job.word.jp), 0);
  assert.equal(game.cardDoc(), null);
  assert.equal(game.env.STORE.get(job.word.jp).missBoost, 2.5);
  assert.equal(game.env.STORE.get(job.word.jp).ng, 1);
  game.resolve(job.ans.indexOf(job.word));
  assert.equal(game.markOf(job.word.jp), 1);
  assert.equal(Object.keys(game.cardDoc().events).length, 1);
  assert.equal(game.env.STORE.get(job.word.jp).missBoost, 2.5);
});

test("hint listening and boss answers do not stamp a delivery mark", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.clearOrders();
  const job = game.prepareOrder();
  const before = game.env.STORE.get(job.word.jp).box;
  game.triggerHint();
  assert.equal(game.markOf(job.word.jp), 0);
  assert.equal(game.state(), "play");
  game.resolve(job.ans.indexOf(job.word));
  assert.equal(game.markOf(job.word.jp), 1);
  assert.equal(game.env.STORE.get(job.word.jp).box, before);
  game.resetChooseCount();
  const boss = game.prepareBoss(game.pool()[1]);
  game.answerBoss(boss.ans.indexOf(boss.word));
  assert.equal(game.markOf(boss.word.jp), 0);
  assert.equal(game.chooseCalls(), 0);
  assert.ok(game.env.STORE.get(boss.word.jp).ok >= 1);
});

test("the same delivery event does not stamp twice", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.clearOrders();
  const job = game.prepareOrder();
  const index = job.ans.indexOf(job.word);
  game.resolve(index);
  game.installJob(job);
  game.resolve(index);
  assert.equal(game.markOf(job.word.jp), 1);
  assert.deepEqual(Object.keys(game.cardDoc().events), [job.cardEventId]);
});

test("four marks cap the card and the crossing toast does not pause play", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  game.clearOrders();
  game.writeMarks({ ねこ: 3 });
  deliver(game);
  assert.equal(game.markOf("ねこ"), 4);
  assert.equal(game.state(), "play");
  assert.ok(game.floats().some(text => String(text).includes("言靈齊印 4/4")));
  game.clearFloats();
  game.useRandom(0);
  deliver(game);
  assert.equal(game.markOf("ねこ"), 4);
  assert.equal(game.floats().some(text => String(text).includes("言靈齊印 4/4")), false);
});

test("the same nfc word keeps one card across stages", () => {
  const game = boot();
  game.useRandom(0);
  game.start("night-town");
  const first = deliver(game);
  assert.equal(first.word.jp, "ねこ");
  assert.equal(game.markOf("ねこ"), 1);
  game.start("yomi");
  const second = deliver(game);
  assert.equal(second.word.jp, "ねこ");
  assert.notEqual(second.cardEventId, first.cardEventId);
  assert.equal(game.markOf("ねこ"), 2);
  assert.equal(game.cardDoc().marks["ねこ"], 2);
});

test("a decomposed kana key is stored once as nfc", () => {
  const game = boot();
  const decomposed = "か\u3099";
  game.useRandom(0);
  game.start("night-town");
  game.usePool([{ jp: decomposed, zh: "が" }, { jp: "あ", zh: "あ" }, { jp: "い", zh: "い" }]);
  game.clearOrders();
  const job = deliver(game);
  assert.equal(job.word.jp, decomposed);
  assert.equal(game.markOf(decomposed), 1);
  assert.equal(game.markOf("が"), 1);
  assert.equal(game.cardDoc().marks["が"], 1);
  assert.equal(game.cardDoc().marks[decomposed], undefined);
});

test("corrupt card json and a failed save still leave the run playable", () => {
  const storage = createStorage();
  storage.setItem("yokai-delivery-cards-v1", "{");
  storage.setItem("yokai-delivery-v1", JSON.stringify({
    m: { "ねこ": { ok: 9, ng: 0, box: 4, missBoost: 1 } },
    best: 1,
    progress: { unlocked: { "night-town": true }, completed: {}, stages: {} }
  }));
  const game = boot({ storage });
  game.useRandom(0);
  assert.doesNotThrow(() => game.start("night-town"));
  game.clearOrders();
  const job = game.prepareOrder();
  game.armQuota();
  assert.doesNotThrow(() => game.resolve(job.ans.indexOf(job.word)));
  assert.equal(game.delivered(), 1);
  assert.equal(game.state(), "play");
  assert.equal(game.job(), null);
  assert.equal(game.env.STORE.canSave(), false);
  const learning = JSON.parse(storage.raw.get("yokai-delivery-v1"));
  assert.equal(learning.marks, undefined);
  assert.equal(learning.m["ねこ"].box, 4);
});

test("loopback dev cards stay off the official card key and the learning save", () => {
  const storage = createStorage();
  const official = boot({ storage, location: { hostname: "127.0.0.1", search: "?tilt=1" } });
  official.useRandom(0);
  official.start("night-town");
  official.clearOrders();
  deliver(official);
  assert.equal(official.markOf("ねこ"), 1);
  assert.equal(JSON.parse(storage.raw.get("yokai-delivery-cards-v1")).marks["ねこ"], 1);
  assert.equal(storage.raw.has("yokai-delivery-dev-cards-v1"), false);

  const dev = boot({ storage, location: { hostname: "127.0.0.1", search: "?dev=1&tilt=1" } });
  dev.useRandom(0);
  dev.start("night-town");
  dev.clearOrders();
  assert.equal(dev.markOf("ねこ"), 0);
  deliver(dev);
  assert.equal(dev.markOf("ねこ"), 1);
  assert.equal(JSON.parse(storage.raw.get("yokai-delivery-cards-v1")).marks["ねこ"], 1);
  assert.equal(JSON.parse(storage.raw.get("yokai-delivery-dev-cards-v1")).marks["ねこ"], 1);
  assert.equal(storage.raw.has("yokai-delivery-dev-v1"), true);
  const officialLearning = JSON.parse(storage.raw.get("yokai-delivery-v1"));
  assert.equal(officialLearning.m["ねこ"].ok, 1);
  assert.equal(officialLearning.marks, undefined);

  const publicDev = boot({ storage, location: { hostname: "play.example", search: "?dev=1&tilt=1" } });
  publicDev.useRandom(0);
  publicDev.start("night-town");
  publicDev.clearOrders();
  assert.equal(publicDev.markOf("ねこ"), 1);
  assert.equal(publicDev.env.CARD_DELIVERY.cardKey(publicDev.location), "yokai-delivery-cards-v1");
});
