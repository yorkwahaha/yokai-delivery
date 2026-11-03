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

// Cross-tab card progress journal. The old single JSON card document remains
// a readable projection; individual event keys are immutable so one tab's
// stale projection cannot erase a delivery recorded by another tab.
const pendingByStorage = new WeakMap();
const journalAvailable = storage => typeof storage.key === "function" && typeof storage.length === "number";
const journalBaseKey = key => key + ":journal-base";
const journalEventPrefix = key => key + ":journal-event:";
function pendingFor(storage, key) {
  let entries = pendingByStorage.get(storage);
  if (!entries) { entries = new Map(); pendingByStorage.set(storage, entries); }
  if (!entries.has(key)) entries.set(key, new Map());
  return entries.get(key);
}
function journalState(storage, key, catalog) {
  if (!journalAvailable(storage)) return cachedState(storage, key);
  const baseText = storage.getItem(journalBaseKey(key));
  if (baseText === null) return cachedState(storage, key);
  let baseline = null;
  try { baseline = JSON.parse(baseText); } catch {}
  let state = cards.migrate(baseline);
  const prefix = journalEventPrefix(key), ids = [];
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i);
    if (typeof name === "string" && name.startsWith(prefix)) ids.push(name);
  }
  // Stable replay order. Delivery success increments commute and are capped
  // at 4; the event ID still protects duplicate successes and failures.
  ids.sort();
  for (const id of ids) {
    let event = null;
    try { event = JSON.parse(storage.getItem(id) || "null"); } catch {}
    const applied = cards.applyEvent(state, event);
    if (!applied.applied) continue;
    const owned = state.awards;
    state = applied.state;
    // Match the legacy contract: an already-full unawarded pack is claimed
    // on the NEXT successful delivery, not simply when opening the gallery.
    if (applied.reason === "success") {
      const newAwards = freshAwards(catalog, owned, state.marks);
      if (newAwards.length) {
        const awards = Object.assign(Object.create(null), state.awards);
        for (const packId of newAwards) awards[packId] = true;
        state = Object.assign({}, state, { awards });
      }
    }
  }
  return state;
}
function ensureJournalBase(storage, key) {
  const baseKey = journalBaseKey(key);
  if (storage.getItem(baseKey) !== null) return;
  const current = storage.getItem(key);
  storage.setItem(baseKey, current === null
    ? JSON.stringify({ v: 1, marks: {}, events: {}, awards: {} })
    : current);
}
function storageErrorOf(error) {
  const name = error && typeof error.name === "string" && error.name ? error.name : "Error";
  const message = error && typeof error.message === "string" ? error.message.slice(0, 160) : "";
  return { name, message };
}

function defaultPacks() {
  if (typeof module === "object" && module.exports) {
    const content = require("./words.js");
    return content.DELIVERY_PACK_IDS?.length ? content.DELIVERY_PACK_IDS.map(id => content.WORD_PACKS[id]) : Object.values(content.WORD_PACKS || {});
  }
  const content = globalThis.CONTENT;
  if (!content || !content.WORD_PACKS) return [];
  return content.DELIVERY_PACK_IDS?.length ? content.DELIVERY_PACK_IDS.map(id => content.WORD_PACKS[id]) : Object.values(content.WORD_PACKS);
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
  const pending = pendingFor(storage, key);
  const catalog = Array.isArray(packs) ? packs : defaultPacks();
  const refresh = () => {
    let current = journalState(storage, key, catalog);
    for (const event of pending.values()) {
      const step = cards.applyEvent(current, event);
      if (!step.applied) continue;
      const owned = current.awards;
      current = step.state;
      if (step.reason === "success") {
        const newAwards = freshAwards(catalog, owned, current.marks);
        if (newAwards.length) {
          const awards = Object.assign(Object.create(null), current.awards);
          for (const id of newAwards) awards[id] = true;
          current = Object.assign({}, current, { awards });
        }
      }
    }
    return copyState(current);
  };
  let state = refresh();
  return {
    key,
    snapshot: () => { state = refresh(); return state; },
    marks: jp => { state = refresh(); return state.marks[cards.wordKey(jp)] || 0; },
    record(event) {
      state = refresh();
      const result = cards.applyEvent(state, event);
      if (!result.applied) return Object.assign({}, result, { persisted: null, storageError: null, newAwards: [] });
      const owned = state.awards;
      state = copyState(result.state);
      const newAwards = result.reason === "success" ? freshAwards(catalog, owned, state.marks) : [];
      if (newAwards.length) {
        const awards = Object.assign(Object.create(null), state.awards);
        for (const id of newAwards) awards[id] = true;
        state = copyState(Object.assign({}, state, { awards }));
      }
      pending.set(event.id, { id: event.id, jp: event.jp, kind: event.kind, ok: event.ok });
      held.set(key, copyState(state));
      try {
        if (journalAvailable(storage)) {
          ensureJournalBase(storage, key);
          for (const [id, item] of pending) {
            storage.setItem(journalEventPrefix(key) + encodeURIComponent(id), JSON.stringify(item));
          }
          // Re-read every other tab's immutable events before projecting the
          // visible document. A racing projection write is always recoverable.
          state = refresh();
        }
        const text = JSON.stringify(state);
        storage.setItem(key, text);
        pending.clear();
        held.delete(key);
        rememberSaved(storage, key, text, state);
        return Object.assign({}, result, { persisted: true, storageError: null, newAwards });
      } catch (error) {
        return Object.assign({}, result, { persisted: false, storageError: storageErrorOf(error), newAwards });
      }
    },
    choose(words, exclude, rnd) {
      state = refresh();
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
