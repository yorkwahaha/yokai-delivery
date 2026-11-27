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
  const jp = cards.pickFromDeliveryWeights(weights, rnd);
  const word = pool.find(item => cards.wordKey(item.jp) === jp) || null;
  return { word, pool, weights, reason: word ? "chosen" : "empty" };
}

// 正式 makeOrder 用這個入口。印記從目前存檔讀，不接收 study.pick 或 missBoost。
function choose(words, exclude, rnd) {
  let storage;
  try { storage = localStorage; } catch {}
  const loc = typeof location !== "undefined" ? location : {};
  if (!storage || typeof storage.getItem !== "function") {
    return chooseDeliveryWord(words, {}, exclude, rnd);
  }
  try { return openCards(storage, loc).choose(words, exclude, rnd); }
  catch { return chooseDeliveryWord(words, {}, exclude, rnd); }
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

// The gallery can render every animation frame. Rebuild only for local
// delivery writes or storage changes from another browser tab.
let progressRevision = 0;
// A direct same-tab import/write does not emit the browser "storage" event.
// Observe only the projection string and key count (not journal replay).
const revisionObservations = new WeakMap();
function revision(storage, loc) {
  if (!storage) {
    try { storage = globalThis.localStorage; } catch {}
  }
  if (storage && typeof storage.getItem === "function") {
    const key = cardKey(loc || globalThis.location);
    try {
      const raw = storage.getItem(key);
      const count = typeof storage.length === "number" ? storage.length : null;
      const seen = revisionObservations.get(storage);
      if (seen && (seen.key !== key || seen.raw !== raw || seen.count !== count)) {
        progressRevision++;
      }
      revisionObservations.set(storage, { key, raw, count });
    } catch { /* A blocked storage read must not block opening the gallery. */ }
  }
  return progressRevision;
}
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("storage", event => {
    const key = event && event.key;
    if (key === null || typeof key === "string" &&
        (key.startsWith(OFFICIAL_KEY) || key.startsWith(DEV_KEY))) {
      progressRevision++;
    }
  });
}

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

// Cross-tab card progress journal. The old single JSON card document remains
// a readable projection; individual event keys are immutable so one tab's
// stale projection cannot erase a delivery recorded by another tab.
const pendingByStorage = new WeakMap();
const viewsByStorage = new WeakMap();
const journalAvailable = storage => typeof storage.key === "function" && typeof storage.length === "number";
const journalBaseKey = key => key + ":journal-base";
const journalEventPrefix = key => key + ":journal-event:";
const COMPACT_BATCH = 200;
const COMPACT_TRIGGER = 320;
function pendingFor(storage, key) {
  let entries = pendingByStorage.get(storage);
  if (!entries) { entries = new Map(); pendingByStorage.set(storage, entries); }
  if (!entries.has(key)) entries.set(key, new Map());
  return entries.get(key);
}
function applyJournalDelivery(state, event, catalog) {
  const applied = cards.applyEvent(state, event);
  if (!applied.applied) return state;
  const owned = state.awards;
  let next = applied.state;
  // An already-full but unawarded pack earns the award on a NEW delivery.
  if (applied.reason === "success") {
    const newAwards = freshAwards(catalog, owned, next.marks);
    if (newAwards.length) {
      const awards = Object.assign(Object.create(null), next.awards);
      for (const packId of newAwards) awards[packId] = true;
      next = Object.assign({}, next, { awards });
    }
  }
  return next;
}
function journalState(storage, key, catalog, cacheReplay) {
  if (!journalAvailable(storage)) return cachedState(storage, key);
  const baseKey = journalBaseKey(key), prefix = journalEventPrefix(key);
  let views = viewsByStorage.get(storage);
  if (cacheReplay && !views) { views = new Map(); viewsByStorage.set(storage, views); }
  for (let attempt = 0; attempt < 2; attempt++) {
    const baseText = storage.getItem(baseKey);
    if (baseText === null) return cachedState(storage, key);
    const ids = [];
    for (let i = 0; i < storage.length; i++) {
      const name = storage.key(i);
      if (typeof name === "string" && name.startsWith(prefix)) ids.push(name);
    }
    // Compaction can remove events while a different tab is reading. Replay
    // only when the checkpoint stayed fixed across all of the event reads.
    const rows = new Map(ids.sort().map(id => [id, storage.getItem(id)]));
    if (storage.getItem(baseKey) !== baseText) continue;

    const previous = cacheReplay ? views.get(key) : null;
    if (previous?.baseText === baseText && previous.rows.size === rows.size &&
        previous.catalog.length === catalog.length && catalog.every((pack, i) => pack === previous.catalog[i]) &&
        [...rows].every(([id, value]) => previous.rows.get(id) === value)) return previous.state;

    let baseline = null;
    try { baseline = JSON.parse(baseText); } catch {}
    let state = cards.migrate(baseline);
    const folded = new Set(Array.isArray(baseline?._compactingKeys) ? baseline._compactingKeys : []);
    for (const [id, value] of rows) {
      if (!value || folded.has(id)) continue;
      let event;
      try { event = JSON.parse(value); } catch { continue; }
      state = applyJournalDelivery(state, event, catalog);
    }
    if (cacheReplay) views.set(key, { baseText, rows, catalog: [...catalog], state });
    return state;
  }
  throw new Error("Card journal checkpoint changed during read");
}
// Compaction is opt-in when the platform can serialize compactors via Web
// Locks. Ordinary deliveries remain synchronous and never depend on it.
// Crucially: checkpoint first, remove keys second, so an interruption can
// never erase previously earned marks, awards or duplicate guards.
async function compactCards(storage, loc, packs, lockRequest) {
  const key = cardKey(loc);
  const lock = lockRequest || globalThis.navigator?.locks?.request?.bind(globalThis.navigator.locks);
  if (!journalAvailable(storage) || typeof storage.removeItem !== "function" || !lock)
    return { ok: false, reason: "unsupported" };
  const catalog = Array.isArray(packs) ? packs : defaultPacks();
  return lock("yokai-card-journal:" + key, { mode: "exclusive", ifAvailable: true }, async held => {
    if (!held) return { ok: false, reason: "busy" };
    const baseKey = journalBaseKey(key), prefix = journalEventPrefix(key);
    let raw;
    try { raw = JSON.parse(storage.getItem(baseKey) || "null"); }
    catch { return { ok: false, reason: "corrupt_base" }; }
    if (!raw || !raw.marks) return { ok: false, reason: "missing_base" };
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const name = storage.key(i);
      if (typeof name === "string" && name.startsWith(prefix)) keys.push(name);
    }
    keys.sort();
    const oldCheckpoint = Array.isArray(raw._compactingKeys) ? raw._compactingKeys : [];
    if (oldCheckpoint.length) {
      // Finish an interrupted delete before taking a new snapshot.
      try {
        for (const id of oldCheckpoint) {
          if (storage.getItem(id) !== null) storage.removeItem(id);
        }
        if (oldCheckpoint.some(id => storage.getItem(id) !== null))
          return { ok: false, reason: "checkpoint_pending" };
        delete raw._compactingKeys;
        storage.setItem(baseKey, JSON.stringify(raw));
      } catch { return { ok: false, reason: "checkpoint_pending" }; }
    }
    const candidates = keys.filter(id => !oldCheckpoint.includes(id) && storage.getItem(id) !== null)
      .slice(0, COMPACT_BATCH);
    if (!candidates.length) return { ok: true, removed: oldCheckpoint.length, remaining: 0 };
    let state = cards.migrate(raw);
    const originals = new Map();
    for (const id of candidates) {
      const value = storage.getItem(id);
      if (value === null) continue;
      originals.set(id, value);
      try { state = applyJournalDelivery(state, JSON.parse(value), catalog); } catch {}
    }
    const foldedIds = [...originals.keys()];
    if (!foldedIds.length) return { ok: true, removed: 0, remaining: 0 };
    const checkpoint = Object.assign({}, state, { _compactingKeys: foldedIds });
    try {
      storage.setItem(baseKey, JSON.stringify(checkpoint));
    } catch { return { ok: false, reason: "checkpoint_write_failed" }; }
    // From this point, the written checkpoint is authoritative and all readers
    // skip folded events until deletion is confirmed.
    let removed = 0;
    try {
      for (const [id, value] of originals) {
        if (storage.getItem(id) === value) {
          storage.removeItem(id);
          removed++;
        }
      }
      const remaining = foldedIds.filter(id => storage.getItem(id) !== null);
      if (remaining.length) checkpoint._compactingKeys = remaining;
      else delete checkpoint._compactingKeys;
      storage.setItem(baseKey, JSON.stringify(checkpoint));
      progressRevision++;
      return { ok: remaining.length === 0, removed, remaining: remaining.length };
    } catch {
      // Keep the full durable skip list if deletion or cleanup fails.
      progressRevision++;
      return { ok: false, reason: "interrupted", removed };
    }
  });
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
  const pending = pendingFor(storage, key);
  const customCatalog = Array.isArray(packs);
  const catalog = customCatalog ? packs : defaultPacks();
  const refresh = () => {
    let current = journalState(storage, key, catalog, !customCatalog);
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
  // Avoid an unnecessary replay when a caller immediately requests snapshot().
  let state = null;
  return {
    key,
    snapshot: () => { state = refresh(); return state; },
    marks: jp => { state = refresh(); return state.marks[cards.wordKey(jp)] || 0; },
    record(event) {
      state = refresh();
      const result = cards.applyEvent(state, event);
      if (!result.applied) return Object.assign({}, result, { persisted: null, storageError: null, newAwards: [] });
      progressRevision++; // Even pending writes must invalidate the gallery.
      const owned = state.awards;
      state = copyState(result.state);
      const newAwards = result.reason === "success" ? freshAwards(catalog, owned, state.marks) : [];
      if (newAwards.length) {
        const awards = Object.assign(Object.create(null), state.awards);
        for (const id of newAwards) awards[id] = true;
        state = copyState(Object.assign({}, state, { awards }));
      }
      pending.set(event.id, { id: event.id, jp: event.jp, kind: event.kind, ok: event.ok });
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
        rememberSaved(storage, key, text, state);
        // Opportunistic bounded cleanup, only with native cross-tab locking.
        // Never block a successful delivery if a browser lacks Web Locks.
        if (globalThis.navigator?.locks?.request && journalAvailable(storage) &&
            typeof storage.removeItem === "function") {
          let count = 0;
          const prefix = journalEventPrefix(key);
          for (let i = 0; i < storage.length; i++)
            if (storage.key(i)?.startsWith(prefix)) count++;
          if (count >= COMPACT_TRIGGER)
            void compactCards(storage, loc, catalog).catch(() => {});
        }
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
  revision,
  cardKey,
  availablePool,
  choose,
  chooseDeliveryWord,
  compactCards,
  openCards
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.CARD_DELIVERY = api;
})();
