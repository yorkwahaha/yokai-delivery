"use strict";
// Muse Spark C3/C4 套卡・四枚印記進度顯示 focused 驗收（唯一 focused，不跑 731）。
// 真 Chrome 實證：tools/c4-rewards-chrome.cjs PASS，award-1280x800-official /
// award-1194x834-dev / award-844x390-dev 三截圖目視：鎖卡「鎖＋x/4」、開卡「4/4」
// 、頂部「收藏 x/y・動物街 f/t」＋「待解鎖插畫」皆完整無截字。
// 結論 DONE_NO_CHANGE：只鎖定資料→顯示契約，不改 UI／算法／存檔。

const test = require("node:test");
const assert = require("node:assert/strict");

const gallery = require("../js/card-gallery-ui.js");
const model = require("../js/card-gallery-model.js");
const collection = require("../js/card-collection.js");

const words = [
  { id: "w-neko", packId: "animals", jp: "ねこ", zh: "貓", kana: "ねこ", stageIds: ["night-town"] },
  { id: "w-inu", packId: "animals", jp: "いぬ", zh: "狗", kana: "いぬ", stageIds: ["night-town"] },
  { id: "w-usagi", packId: "animals", jp: "うさぎ", zh: "兔子", kana: "うさぎ", stageIds: ["night-town"] }
];
const catalogs = {
  stages: [{ id: "night-town", name: "夜行町" }],
  packs: [{ id: "animals", name: "動物街", sub: "" }]
};

test("1. 四枚印記→卡片狀態契約：4 開卡 4/4，2 鎖卡 2/4，0 鎖卡 0/4", () => {
  const source = { key: "k", marks: { "ねこ": 4, "いぬ": 2 } };
  const view = model.project(words, source, catalogs);
  const byKey = Object.fromEntries(view.cards.map(c => [c.key, c]));
  assert.equal(byKey["ねこ"].reveal, "open");
  assert.equal(byKey["ねこ"].progress, "4/4");
  assert.equal(byKey["いぬ"].reveal, "locked");
  assert.equal(byKey["いぬ"].progress, "2/4");
  assert.equal(byKey["いぬ"].showLock, true);
  assert.equal(byKey["うさぎ"].progress, "0/4");
  assert.equal(view.openCount, 1);
  assert.equal(view.lockedCount, 2);
});

test("2. 套卡完成度契約：2/3 未套滿，3/3 套滿（packLine 資料源）", () => {
  const packs = [{ id: "animals", name: "動物街", words: [{ jp: "ねこ" }, { jp: "いぬ" }, { jp: "うさぎ" }] }];
  const part = collection.completeSets(packs, { "ねこ": 4, "いぬ": 4, "うさぎ": 2 });
  assert.equal(part[0].total, 3);
  assert.equal(part[0].full, 2);
  assert.equal(part[0].complete, false);
  const full = collection.completeSets(packs, { "ねこ": 4, "いぬ": 4, "うさぎ": 4 });
  assert.equal(full[0].complete, true);
  assert.equal(full[0].full, 3);
});

test("3. 手機橫向實繪：進度字串完整無截字、開卡可點、鎖卡正確禁用（無誤觸）", () => {
  const source = { key: "k", marks: { "ねこ": 4, "いぬ": 2 } };
  const cards = model.project(words, source, catalogs).cards;
  const traces = [];
  const ctx = {
    font: "900 12px sans-serif",
    fillStyle: "#000",
    textAlign: "center",
    save() {}, restore() {},
    measureText(text) {
      const m = String(this.font).match(/([\d.]+)px/);
      const s = m ? Number(m[1]) : 12;
      let w = 0;
      for (const ch of String(text)) w += ch.codePointAt(0) < 256 ? s * 0.55 : s * 1.08;
      return { width: w };
    },
    fillText(text, x, y) {
      const m = String(this.font).match(/([\d.]+)px/);
      traces.push({ text: String(text), x, y, size: m ? Number(m[1]) : 12 });
    }
  };
  const hooks = {
    readableFont: (s, w) => `${w || "900"} ${s}px sans-serif`,
    drawWoodTag() {}, drawButton() {}
  };
  const packLine = "收藏 0/1・動物街 2/3";
  const out = gallery.draw(
    ctx, cards,
    { filter: { by: "all", id: null }, page: 0, packLine },
    hooks,
    { width: 844, height: 390, scale: 0.5, offsetX: 0, offsetY: 0 },
    catalogs
  );
  const texts = traces.map(t => t.text);
  for (const want of ["關卡：全部", "詞包：全部", packLine, "鎖", "2/4", "4/4"]) {
    assert.ok(texts.includes(want), `手機橫向應完整繪出「${want}」無截字`);
  }
  const openPlate = out.buttons.find(b => b.id === "card:ねこ");
  const lockedPlate = out.buttons.find(b => b.id === "card:いぬ");
  assert.ok(openPlate && lockedPlate, "開卡與鎖卡皆應有卡槽熱區");
  const hitOpen = gallery.hit(
    { x: openPlate.x + openPlate.w / 2, y: openPlate.y + openPlate.h / 2 }, out.buttons);
  assert.equal(hitOpen.ok, true, "開卡中心應可點中");
  const hitLocked = gallery.hit(
    { x: lockedPlate.x + lockedPlate.w / 2, y: lockedPlate.y + lockedPlate.h / 2 }, out.buttons);
  assert.equal(hitLocked.ok, false, "鎖卡應正確禁用而非誤觸穿透");
});
