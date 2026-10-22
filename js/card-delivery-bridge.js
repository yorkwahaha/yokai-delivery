(() => {
"use strict";

const cards = typeof module === "object" && module.exports
  ? require("./card-collection.js")
  : globalThis.CARD_COLLECTION;

const OFFICIAL_KEY = "yokai-delivery-cards-v1";
const DEV_KEY = "yokai-delivery-dev-cards-v1";
const LEARNING_KEY = "yokai-delivery-v1";

function isDev(loc) {
  if (loc && loc.dev === true) return true;
  const tools = typeof globalThis !== "undefined" ? globalThis.DEV_MODE : null;
  if (tools && typeof tools.isDevMode === "function" && loc && loc.hostname) return tools.isDevMode(loc);
  const host = String(loc && loc.hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  const raw = String(loc && loc.search || "");
  const dev = new URLSearchParams(raw.charAt(0) === "?" ? raw.slice(1) : raw).get("dev");
  return (host === "localhost" || host === "127.0.0.1" || host === "::1") && dev === "1";
}

function cardKey(loc) {
  return isDev(loc) ? DEV_KEY : OFFICIAL_KEY;
}

function excludeKeys(exclude) {
  const blocked = new Set();
  for (const item of exclude || []) {
    const key = cards.wordKey(typeof item === "string" ? item : item && item.jp);
    if (key) blocked.add(key);
  }
  return blocked;
}

function availablePool(words, exclude) {
  const blocked = excludeKeys(exclude);
  const seen = new Set();
  const pool = [];
  for (const word of words || []) {
    if (!word || typeof word !== "object") continue;
    const key = cards.wordKey(word.jp);
    if (!key || blocked.has(key) || seen.has(key)) continue;
    seen.add(key);
    pool.push(word);
  }
  return pool;
}

function chooseDeliveryWord(words, marks, exclude, rnd) {
  const pool = availablePool(words, exclude);
  if (!pool.length) return { word: null, pool, weights: null, reason: "empty" };
  const weights = cards.deliveryWeights(pool, marks);
  const jp = cards.pickDeliveryWord(pool, marks, rnd);
  const word = pool.find(item => cards.wordKey(item.jp) === cards.wordKey(jp)) || null;
  return { word, pool, weights, reason: word ? "chosen" : "empty" };
}

// 正式 makeOrder 用這個入口。印記從目前存檔讀，不接收 study.pick 或 missBoost。
function choose(words, exclude, rnd) {
  const storage = typeof localStorage !== "undefined" ? localStorage : null;
  const loc = typeof location !== "undefined" ? location : {};
  if (!storage || typeof storage.getItem !== "function") {
    return chooseDeliveryWord(words, {}, exclude, rnd);
  }
  return openCards(storage, loc).choose(words, exclude, rnd);
}

function readRaw(storage, key) {
  try { return JSON.parse(storage.getItem(key) || "null"); }
  catch { return null; }
}

// 每頁載入一次的唯一 id。game.js 組 cardEventId 時可附上，避免重整後序號從 0 重算被誤判重複。
// 不可用 Math.random：測試與遊戲以種子控制 Math.random，多抽一次會改變整局亂數序列。
const SESSION_ID = (() => {
  let tail = "";
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === "function") tail = c.getRandomValues(new Uint32Array(1))[0].toString(36);
  } catch { tail = ""; }
  return Date.now().toString(36) + tail;
})();

// 快取：同一份 storage／key 的原始字串沒變時，不重 parse／migrate。
const parsedCache = new WeakMap();

function cachedState(storage, key) {
  let text = null;
  try { text = storage.getItem(key); } catch { text = null; }
  let byKey = parsedCache.get(storage);
  if (!byKey) { byKey = new Map(); parsedCache.set(storage, byKey); }
  const hit = byKey.get(key);
  if (hit && hit.text === text) return copyState(hit.state);
  let raw = null;
  try { raw = JSON.parse(text || "null"); } catch { raw = null; }
  const state = cards.migrate(raw, raw ? undefined : readRaw(storage, LEARNING_KEY));
  byKey.set(key, { text, state: copyState(state) });
  return copyState(state);
}

function rememberSaved(storage, key, text, state) {
  let byKey = parsedCache.get(storage);
  if (!byKey) { byKey = new Map(); parsedCache.set(storage, byKey); }
  byKey.set(key, { text, state: copyState(state) });
}

const unsaved = new WeakMap();

function copyState(state) {
  const source = state && typeof state === "object" ? state : {};
  const next = Object.assign({}, source);
  next.v = source.v || 1;
  next.marks = Object.assign(Object.create(null), source.marks);
  next.events = Object.assign(Object.create(null), source.events);
  if (source.awards && typeof source.awards === "object" && !Array.isArray(source.awards)) {
    next.awards = Object.assign(Object.create(null), source.awards);
  }
  return next;
}

function heldFor(storage) {
  let held = unsaved.get(storage);
  if (!held) {
    held = new Map();
    unsaved.set(storage, held);
  }
  return held;
}

function storageErrorOf(error) {
  const name = error && typeof error.name === "string" && error.name ? error.name : "Error";
  const message = error && typeof error.message === "string" ? error.message.slice(0, 160) : "";
  return { name, message };
}

function defaultPacks() {
  if (typeof module === "object" && module.exports) {
    const content = require("./words.js");
    return Object.values(content.WORD_PACKS || {});
  }
  const content = globalThis.CONTENT;
  return content && content.WORD_PACKS ? Object.values(content.WORD_PACKS) : [];
}

function freshAwards(catalog, owned, marks) {
  const awards = [];
  for (const set of cards.completeSets(catalog, marks)) {
    if (set.complete && (!owned || owned[set.id] !== true)) awards.push(set.id);
  }
  return awards;
}

function openCards(storage, loc, packs) {
  const key = cardKey(loc);
  const held = heldFor(storage);
  const catalog = Array.isArray(packs) ? packs : defaultPacks();
  let state = held.has(key)
    ? copyState(held.get(key))
    : cachedState(storage, key);
  return {
    key,
    snapshot: () => state,
    marks: jp => state.marks[cards.wordKey(jp)] || 0,
    record(event) {
      const result = cards.applyEvent(state, event);
      if (!result.applied) return Object.assign({}, result, { persisted: null, storageError: null, newAwards: [] });
      const owned = state.awards;
      state = copyState(Object.assign({}, state, result.state));
      const newAwards = result.reason === "success" ? freshAwards(catalog, owned, state.marks) : [];
      if (newAwards.length) {
        const awards = Object.assign(Object.create(null), state.awards);
        for (const id of newAwards) awards[id] = true;
        state = copyState(Object.assign({}, state, { awards }));
      }
      held.set(key, copyState(state));
      try {
        const text = JSON.stringify(state);
        storage.setItem(key, text);
        held.delete(key);
        rememberSaved(storage, key, text, state);
        return Object.assign({}, result, { persisted: true, storageError: null, newAwards });
      } catch (error) {
        return Object.assign({}, result, { persisted: false, storageError: storageErrorOf(error), newAwards });
      }
    },
    choose(words, exclude, rnd) {
      return chooseDeliveryWord(words, state.marks, exclude, rnd);
    }
  };
}

const api = {
  OFFICIAL_KEY,
  DEV_KEY,
  LEARNING_KEY,
  SESSION_ID,
  cardKey,
  availablePool,
  choose,
  chooseDeliveryWord,
  openCards
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.CARD_DELIVERY = api;
})();
