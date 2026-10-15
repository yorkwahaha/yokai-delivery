"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const gallery = require("../js/card-gallery-model.js");
const CONTENT = require("../js/words.js");

function word(fields) {
  return Object.assign({
    id: "animals:0",
    packId: "animals",
    jp: "ねこ",
    zh: "貓",
    kana: "ねこ",
    kanji: "猫",
    pos: "名詞",
    romaji: "neko",
    icon: "🐱",
    stageIds: ["night-town"],
    shared: false
  }, fields);
}

test("nfc duplicates collapse to one card and keep the higher saved mark", () => {
  const view = gallery.project([
    word({ jp: "が", zh: "合成" }),
    word({ id: "animals:1", jp: "か\u3099", zh: "分解", stageIds: ["yomi"] })
  ], { marks: { "が": 2 } });
  assert.equal(view.total, 1);
  assert.equal(view.cards[0].key, "が");
  assert.equal(view.cards[0].marks, 2);
  assert.deepEqual(view.cards[0].stages, ["night-town", "yomi"]);
  assert.equal(view.cards[0].shared, true);
  assert.equal(view.cards[0].jp, null);
  assert.equal(Object.hasOwn(view.cards[0], "romaji"), false);
});

test("marks 0 through 3 stay silhouette-locked and hide the reading", () => {
  for (const mark of [0, 1, 2, 3]) {
    const card = gallery.project([word()], { marks: { "ねこ": mark } }).cards[0];
    assert.equal(card.reveal, "locked");
    assert.equal(card.face, "silhouette");
    assert.equal(card.showLock, true);
    assert.equal(card.progress, mark + "/4");
    assert.equal(card.jp, null);
    assert.equal(card.zh, null);
    assert.equal(card.illustration, null);
    assert.equal(Object.hasOwn(card, "romaji"), false);
  }
});

test("a finished card shows japanese and chinese, not romaji, and no fake art", () => {
  const card = gallery.project([word({ romaji: "neko", icon: "🐱" })], { marks: { "ねこ": 9 } }).cards[0];
  assert.equal(card.reveal, "open");
  assert.equal(card.face, "card");
  assert.equal(card.progress, "4/4");
  assert.equal(card.jp, "ねこ");
  assert.equal(card.zh, "貓");
  assert.equal(card.kana, "ねこ");
  assert.equal(card.kanji, "猫");
  assert.equal(card.pos, "名詞");
  assert.equal(card.illustration.text, "待解鎖插畫");
  assert.equal(Object.hasOwn(card, "romaji"), false);
  assert.equal(Object.hasOwn(card, "icon"), false);
});

test("the same word in two stages is one card and still listed under each real stage", () => {
  const neko = word({ stageIds: ["night-town", "yomi"], shared: true });
  const view = gallery.project([neko, neko], { marks: { "ねこ": 4 } });
  assert.equal(view.cards.length, 1);
  const groups = gallery.groupCards(view.cards, "stage", {
    stages: [{ id: "night-town", name: "夜行町" }, { id: "yomi", name: "黃泉境" }]
  });
  assert.equal(groups.groups.length, 2);
  assert.equal(groups.groups[0].cards[0], groups.groups[1].cards[0]);
  assert.equal(groups.groups[0].label, "夜行町");
  assert.equal(groups.groups[0].source, "stage");
});

test("a missing pack name falls back to packId and does not invent a category", () => {
  const card = gallery.project([word({ packId: "animals" })], {}).cards[0];
  assert.deepEqual(card.category, { source: "packId", id: "animals", label: "animals" });
  const named = gallery.project([word()], {}, { packs: [{ id: "animals", name: "動物街", sub: "どうぶつ" }] }).cards[0];
  assert.equal(named.category.source, "pack");
  assert.equal(named.category.label, "動物街");
  const loose = gallery.project([word({ packId: "", stageIds: [] })], {}).cards[0];
  assert.equal(loose.category.source, "fallback");
  assert.equal(loose.category.label, "未分組");
  const grouped = gallery.groupCards([loose], "stage");
  assert.equal(grouped.groups[0].id, "unassigned");
  assert.equal(grouped.groups[0].source, "fallback");
});

test("open cards sort ahead of partial marks and decoys stay out", () => {
  const view = gallery.project([
    word({ id: "animals:1", jp: "いぬ", zh: "狗", kana: "いぬ" }),
    word(),
    { id: "answer-decoy:0", packId: "answer-decoy", jp: "バス", zh: "公車", decoy: true, stageIds: [] }
  ], { marks: { "ねこ": 4, "いぬ": 2 } });
  assert.deepEqual(view.cards.map(card => card.key), ["ねこ", "いぬ"]);
  assert.equal(view.openCount, 1);
  assert.equal(view.lockedCount, 1);
});

test("search and paging stay on one pass of a large list", () => {
  const words = [];
  const marks = Object.create(null);
  for (let i = 0; i < 4000; i++) {
    words.push({ id: "bulk:" + i, packId: "bulk", jp: "語" + i, zh: i % 10 === 0 ? "目標" : "其他", kana: "語" + i, stageIds: ["yomi"] });
    if (i % 10 === 0) marks["語" + i] = 4;
  }
  const started = Date.now();
  const view = gallery.project(words, { marks });
  const found = gallery.filterCards(view.cards, "目標");
  const page = gallery.paginate(found, 2, 8);
  const elapsed = Date.now() - started;
  assert.equal(view.total, 4000);
  assert.equal(found.length, 400);
  assert.equal(page.cards.length, 8);
  assert.equal(page.total, 400);
  assert.equal(page.page, 2);
  assert.ok(page.cards.every(card => card.zh === "目標"));
  assert.ok(!page.cards.includes(found[0]));
  const hidden = gallery.project([word()], { marks: { "ねこ": 2 } });
  const hit = gallery.filterCards(hidden.cards, "ねこ");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].jp, null);
  assert.ok(elapsed < 250, elapsed + "ms");
});

test("official and dev reads stay apart and the model never writes", () => {
  const writes = [];
  const wordList = [word()];
  const official = gallery.project(wordList, {
    key: "yokai-delivery-cards-v1",
    marks: { "ねこ": 1 },
    record() { writes.push("official"); }
  });
  const dev = gallery.project(wordList, {
    key: "yokai-delivery-dev-cards-v1",
    marks(jp) { return jp === "ねこ" ? 4 : 0; },
    record() { writes.push("dev"); }
  });
  assert.equal(official.saveKey, "yokai-delivery-cards-v1");
  assert.equal(official.cards[0].progress, "1/4");
  assert.equal(dev.saveKey, "yokai-delivery-dev-cards-v1");
  assert.equal(dev.cards[0].reveal, "open");
  assert.deepEqual(writes, []);
  gallery.project(wordList, { marks() { throw new Error("broken"); } });
});

test("replay is only a request for an open card and this file does not touch audio", () => {
  const locked = gallery.project([word()], { marks: { "ねこ": 3 } }).cards[0];
  const open = gallery.project([word()], { marks: { "ねこ": 4 } }).cards[0];
  assert.deepEqual(gallery.replayRequest(locked), { ok: false, reason: "locked" });
  assert.deepEqual(gallery.replayRequest(open), { ok: true, event: "card-replay", jp: "ねこ", kana: "ねこ" });
  const source = fs.readFileSync(path.join(__dirname, "../js/card-gallery-model.js"), "utf8");
  assert.equal(source.includes("audio.js"), false);
  assert.equal(source.includes("speechSynthesis"), false);
  assert.equal(source.includes("localStorage"), false);
});

test("the live corpus uses pack and stage fields and keeps one neko card", () => {
  const packs = Object.values(CONTENT.WORD_PACKS).map(pack => ({ id: pack.id, name: pack.name, sub: pack.sub }));
  const stages = Object.values(CONTENT.STAGES).map(stage => ({ id: stage.id, name: stage.name }));
  const view = gallery.project(CONTENT.getAllWords(), { key: "yokai-delivery-cards-v1", marks: { "ねこ": 4 } }, { packs, stages });
  const neko = view.cards.find(card => card.key === "ねこ");
  assert.ok(neko);
  assert.equal(view.cards.filter(card => card.key === "ねこ").length, 1);
  assert.equal(neko.category.source, "pack");
  assert.equal(neko.category.label, "動物街");
  assert.ok(neko.stages.includes("night-town"));
  assert.equal(neko.shared, true);
  assert.equal(view.status, "C3_MODEL_READY_UI_ART_PENDING");
  const grouped = gallery.groupCards(view.cards, "pack", { packs });
  assert.ok(grouped.groups.some(group => group.id === "animals" && group.cards.includes(neko)));
});
