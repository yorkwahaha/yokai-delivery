(() => {
"use strict";

// 獨立核心。未接入 index.html、STORE 或對局。Phase 2 才接到配送。
const MARK_CAP = 4;

function wordKey(jp) {
  if (typeof jp !== "string") return "";
  return jp.normalize("NFC").trim();
}

function blank() {
  return { v: 1, marks: Object.create(null), events: Object.create(null), awards: Object.create(null) };
}

function clampMark(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MARK_CAP, Math.floor(n)));
}

function isCardDoc(raw) {
  return !!raw && typeof raw === "object" && !Array.isArray(raw)
    && raw.v === 1 && raw.marks && typeof raw.marks === "object" && !Array.isArray(raw.marks);
}

function loadState(raw) {
  const state = blank();
  if (!isCardDoc(raw)) return state;
  for (const [jp, n] of Object.entries(raw.marks)) {
    const key = wordKey(jp);
    if (!key) continue;
    const next = clampMark(n);
    const prev = state.marks[key];
    state.marks[key] = prev == null ? next : Math.max(prev, next);
  }
  if (raw.events && typeof raw.events === "object" && !Array.isArray(raw.events)) {
    for (const [id, flag] of Object.entries(raw.events)) {
      if (flag === true && id) state.events[id] = true;
    }
  }
  if (raw.awards && typeof raw.awards === "object" && !Array.isArray(raw.awards)) {
    for (const [id, flag] of Object.entries(raw.awards)) {
      if (flag === true && id) state.awards[id] = true;
    }
  }
  return state;
}

// legacy 是 yokai-delivery-v1。m.ok / m.box 是熟練度，不是配送印記。
function migrate(saved, legacy) {
  void legacy;
  return loadState(saved);
}

function parseEvent(event) {
  if (!event || typeof event !== "object") return null;
  if (typeof event.id !== "string" || !event.id) return null;
  if (event.kind !== "delivery" || typeof event.ok !== "boolean") return null;
  const key = wordKey(event.jp);
  if (!key) return null;
  return { id: event.id, key, ok: event.ok };
}

function applyEvent(state, event) {
  const base = isCardDoc(state) ? state : blank();
  const parsed = parseEvent(event);
  if (!parsed) return { state: base, applied: false, reason: "invalid" };
  if (base.events[parsed.id]) return { state: base, applied: false, reason: "duplicate" };
  const events = Object.assign(Object.create(null), base.events);
  events[parsed.id] = true;
  const marks = Object.assign(Object.create(null), base.marks);
  if (parsed.ok) marks[parsed.key] = Math.min(MARK_CAP, clampMark(marks[parsed.key] || 0) + 1);
  const awards = Object.assign(Object.create(null), base.awards);
  return { state: { v: 1, marks, events, awards }, applied: true, reason: parsed.ok ? "success" : "fail" };
}

function packWords(pack) {
  const keys = [];
  const seen = new Set();
  for (const word of (pack && pack.words) || []) {
    if (!word || word.decoy === true) continue;
    const key = wordKey(typeof word === "string" ? word : word.jp);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function completeSets(packs, marks) {
  const book = marks && typeof marks === "object" ? marks : {};
  return (packs || []).map(pack => {
    const keys = packWords(pack);
    let full = 0;
    for (const key of keys) if (clampMark(book[key] || 0) >= MARK_CAP) full += 1;
    return {
      id: pack && pack.id,
      name: pack && typeof pack.name === "string" && pack.name ? pack.name : (pack && pack.id) || "",
      total: keys.length,
      full,
      complete: keys.length > 0 && full === keys.length
    };
  });
}

function uniqueKeys(words) {
  const keys = [];
  const seen = new Set();
  for (const word of words || []) {
    const key = wordKey(typeof word === "string" ? word : word && word.jp);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function deliveryWeights(words, marks) {
  const keys = uniqueKeys(words);
  const n = keys.length;
  if (n === 0) return { n: 0, c: 0, u: 0, pu: null, pc: null, entries: [], sum: 0 };
  const book = marks && typeof marks === "object" ? marks : {};
  const full = keys.map(key => clampMark(book[key] || 0) >= MARK_CAP);
  const c = full.reduce((n, yes) => n + (yes ? 1 : 0), 0);
  const u = n - c;
  let pu = null;
  let pc = null;
  if (c === 0 || u === 0 || c >= 100) {
    const eq = 100 / n;
    if (u) pu = eq;
    if (c) pc = eq;
  } else {
    const raw = (100 - c) / u;
    pu = Math.min(20, raw);
    pc = (100 - u * pu) / c;
  }
  const entries = keys.map((jp, i) => ({ jp, full: full[i], weight: full[i] ? pc : pu }));
  let sum = entries.reduce((total, entry) => total + entry.weight, 0);
  const drift = 100 - sum;
  if (entries.length && Math.abs(drift) > 0 && Math.abs(drift) < 1e-6) {
    entries[entries.length - 1] = { ...entries[entries.length - 1], weight: entries[entries.length - 1].weight + drift };
    sum = 100;
  }
  return { n, c, u, pu, pc, entries, sum };
}

function pickDeliveryWord(words, marks, rnd) {
  const table = deliveryWeights(words, marks);
  if (!table.entries.length) return null;
  const roll = typeof rnd === "function" ? rnd() : 0;
  let cursor = (Number.isFinite(roll) ? roll : 0) * table.sum;
  for (const entry of table.entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.jp;
  }
  return table.entries[table.entries.length - 1].jp;
}

function createCollection(storage = {}) {
  const legacy = typeof storage.legacy === "function" ? storage.legacy() : undefined;
  let state = migrate(typeof storage.read === "function" ? storage.read() : undefined, legacy);
  return {
    snapshot: () => state,
    marks: jp => state.marks[wordKey(jp)] || 0,
    record(event) {
      const result = applyEvent(state, event);
      if (result.applied) {
        state = result.state;
        if (typeof storage.write === "function") storage.write(state);
      }
      return result;
    },
    weights: words => deliveryWeights(words, state.marks)
  };
}

const api = {
  MARK_CAP,
  wordKey,
  loadState,
  migrate,
  applyEvent,
  deliveryWeights,
  pickDeliveryWord,
  completeSets,
  createCollection
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.CARD_COLLECTION = api;
})();
