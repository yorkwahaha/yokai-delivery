(() => {
"use strict";

// C3 圖鑑純資料。不寫存檔、不碰 DOM、不播音。
const cards = typeof module === "object" && module.exports
  ? require("./card-collection.js")
  : globalThis.CARD_COLLECTION;

const STATUS = "C3_MODEL_READY_UI_ART_PENDING";
const MARK_CAP = cards && cards.MARK_CAP || 4;
const PAGE_SIZE = 8;

function wordKey(jp) {
  if (cards && typeof cards.wordKey === "function") return cards.wordKey(jp);
  if (typeof jp !== "string") return "";
  return jp.normalize("NFC").trim();
}

function clampMark(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MARK_CAP, Math.floor(n)));
}

function readMark(source, jp) {
  try {
    if (source && typeof source.marks === "function") return clampMark(source.marks(jp));
    const table = source && source.marks && typeof source.marks === "object" ? source.marks : null;
    if (!table) return 0;
    return clampMark(table[wordKey(jp)]);
  } catch {
    return 0;
  }
}

function packIndex(catalogs) {
  const out = Object.create(null);
  for (const pack of (catalogs && catalogs.packs) || []) {
    if (pack && pack.id) out[pack.id] = pack;
  }
  return out;
}

function stageIndex(catalogs) {
  const out = Object.create(null);
  for (const stage of (catalogs && catalogs.stages) || []) {
    if (stage && stage.id) out[stage.id] = stage;
  }
  return out;
}

function categoryOf(packId, packs) {
  if (!packId) return { source: "fallback", id: "unassigned", label: "未分組" };
  const pack = packs[packId];
  if (pack && typeof pack.name === "string" && pack.name) {
    return { source: "pack", id: packId, label: pack.name, sub: pack.sub || "" };
  }
  return { source: "packId", id: packId, label: packId };
}

function presentCard(word, marks, packs) {
  const key = wordKey(word && word.jp);
  const mark = readMark(marks, key);
  const open = mark >= MARK_CAP;
  const stages = Array.isArray(word.stageIds) ? word.stageIds.filter(id => typeof id === "string" && id) : [];
  const card = {
    key,
    wordId: typeof word.id === "string" ? word.id : "",
    packId: typeof word.packId === "string" ? word.packId : "",
    stages,
    shared: word.shared === true || stages.length > 1,
    marks: mark,
    progress: mark + "/" + MARK_CAP,
    reveal: open ? "open" : "locked",
    face: open ? "card" : "silhouette",
    showLock: !open,
    category: categoryOf(word.packId, packs),
    jp: null,
    zh: null,
    kana: null,
    kanji: null,
    pos: null,
    illustration: null
  };
  if (open) {
    card.jp = key;
    card.zh = typeof word.zh === "string" ? word.zh : "";
    card.kana = typeof word.kana === "string" && word.kana ? word.kana : key;
    card.kanji = typeof word.kanji === "string" ? word.kanji : "";
    card.pos = typeof word.pos === "string" ? word.pos : "";
    card.illustration = { status: "pending", text: "待解鎖插畫" };
  }
  return card;
}

function stageIdsOf(word) {
  const raw = word && Array.isArray(word.stageIds) ? word.stageIds : [];
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const id = raw[i];
    if (typeof id === "string" && id && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

function project(words, source, catalogs) {
  const packs = packIndex(catalogs);
  const byKey = new Map();
  for (const word of words || []) {
    if (!word || word.decoy === true) continue;
    const key = wordKey(word.jp);
    if (!key) continue;
    let row = byKey.get(key);
    if (!row) {
      row = { word, stages: [], shared: false };
      byKey.set(key, row);
    }
    if (word.shared === true) row.shared = true;
    const extra = stageIdsOf(word);
    for (let i = 0; i < extra.length; i++) {
      if (row.stages.indexOf(extra[i]) < 0) row.stages.push(extra[i]);
    }
  }
  const list = [];
  for (const row of byKey.values()) {
    const stageIds = row.stages.slice();
    list.push(presentCard({
      id: row.word.id,
      packId: row.word.packId,
      jp: row.word.jp,
      zh: row.word.zh,
      kana: row.word.kana,
      kanji: row.word.kanji,
      pos: row.word.pos,
      stageIds,
      shared: row.shared || stageIds.length > 1
    }, source, packs));
  }
  list.sort((a, b) => {
    if (a.reveal !== b.reveal) return a.reveal === "open" ? -1 : 1;
    if (a.marks !== b.marks) return b.marks - a.marks;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  let openCount = 0;
  for (const card of list) if (card.reveal === "open") openCount += 1;
  return {
    status: STATUS,
    saveKey: source && typeof source.key === "string" ? source.key : null,
    total: list.length,
    openCount,
    lockedCount: list.length - openCount,
    cards: list
  };
}

function matches(card, query) {
  if (!query) return true;
  const needle = String(query).trim();
  if (!needle) return true;
  const fields = [card.key, card.kana, card.kanji, card.zh];
  return fields.some(value => typeof value === "string" && value.includes(needle));
}

function filterCards(cards, query) {
  const needle = String(query || "").trim();
  if (!needle) return cards || [];
  const out = [];
  for (const card of cards || []) if (matches(card, needle)) out.push(card);
  return out;
}

function paginate(cards, page, pageSize) {
  const list = cards || [];
  const size = Math.max(1, Math.min(48, pageSize || PAGE_SIZE));
  const pageCount = Math.max(1, Math.ceil(list.length / size));
  const index = Math.max(0, Math.min(pageCount - 1, page || 0));
  const start = index * size;
  return {
    page: index,
    pageSize: size,
    pageCount,
    total: list.length,
    cards: list.slice(start, start + size)
  };
}

function groupCards(cards, by, catalogs) {
  const list = cards || [];
  const mode = by === "stage" ? "stage" : "pack";
  const stages = stageIndex(catalogs);
  const packs = packIndex(catalogs);
  const groups = new Map();
  function take(id, label, source) {
    let group = groups.get(id);
    if (!group) {
      group = { id, label, source, cards: [] };
      groups.set(id, group);
    }
    return group;
  }
  for (const card of list) {
    if (mode === "stage") {
      const ids = card.stages.length ? card.stages : ["unassigned"];
      for (const id of ids) {
        if (id === "unassigned") {
          take(id, "未分關", "fallback").cards.push(card);
        } else {
          const stage = stages[id];
          const named = stage && stage.name;
          take(id, named || id, named ? "stage" : "stageId").cards.push(card);
        }
      }
    } else {
      const cat = card.category || categoryOf(card.packId, packs);
      take(cat.id, cat.label, cat.source).cards.push(card);
    }
  }
  return { by: mode, groups: [...groups.values()] };
}

function replayRequest(card) {
  if (!card || card.reveal !== "open" || !card.key) return { ok: false, reason: "locked" };
  return { ok: true, event: "card-replay", jp: card.key, kana: card.kana || card.key };
}

const api = {
  STATUS,
  MARK_CAP,
  PAGE_SIZE,
  wordKey,
  project,
  filterCards,
  paginate,
  groupCards,
  replayRequest
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.CARD_GALLERY = api;
})();
