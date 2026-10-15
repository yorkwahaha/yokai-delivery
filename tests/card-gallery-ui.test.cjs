"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ui = require("../js/card-gallery-ui.js");
const viewport = require("../js/viewport.js");

function card(fields) {
  return Object.assign({
    key: "ねこ",
    packId: "animals",
    stages: ["night-town"],
    shared: false,
    marks: 0,
    progress: "0/4",
    reveal: "locked",
    face: "silhouette",
    showLock: true,
    category: { source: "pack", id: "animals", label: "動物街" },
    jp: null,
    zh: null,
    kana: null,
    kanji: null,
    pos: null,
    illustration: null
  }, fields);
}

function hooks(paper) {
  const calls = { ribbon: [], wood: [], button: [], text: [] };
  return {
    calls,
    paper: paper || null,
    drawRibbonSlices(ctx, image, x, y, w, h) { calls.ribbon.push({ image, x, y, w, h }); },
    drawWoodTag(ctx, button) { calls.wood.push(button.id); },
    drawButton(ctx, button, label, opts) { calls.button.push({ id: button.id, label, disabled: !!(opts && opts.disabled) }); },
    readableFont() { return "16px sans-serif"; }
  };
}

function ctx() {
  const texts = [];
  const styles = [];
  return {
    texts,
    styles,
    save() {},
    restore() {},
    fillText(text, x, y, maxWidth) {
      texts.push(String(text));
      styles.push({ text: String(text), fill: this.fillStyle, font: this.font, maxWidth });
    },
    textAlign: "left",
    font: "",
    fillStyle: "#ffffff"
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const paper = { naturalWidth: 640, naturalHeight: 160, src: "assets/img/ui/illustrated/button_secondary.webp" };

test("eight cards use the approved paper image and locked text stays sealed", () => {
  const cards = Array.from({ length: 10 }, (_, i) => card({
    key: "語" + i,
    marks: i === 0 ? 4 : 2,
    progress: i === 0 ? "4/4" : "2/4",
    reveal: i === 0 ? "open" : "locked",
    face: i === 0 ? "card" : "silhouette",
    showLock: i !== 0,
    jp: i === 0 ? "語0" : null,
    zh: i === 0 ? "字" : null,
    kana: i === 0 ? "ご0" : null,
    pos: i === 0 ? "名詞" : null
  }));
  const view = hooks(paper);
  const drawn = ui.draw(ctx(), cards, { filter: { by: "all" }, page: 0 }, view, { width: 900, height: 600 });
  assert.equal(ui.STATUS, "C3_LOADED");
  assert.equal(drawn.cards.length, 8);
  assert.equal(view.calls.ribbon.length, 8);
  assert.ok(view.calls.ribbon.every(call => call.image === paper));
  const surface = ctx();
  ui.draw(surface, [card({ marks: 2, progress: "2/4" })], { filter: { by: "all" }, page: 0 }, hooks(paper), { width: 900, height: 600 });
  assert.ok(surface.texts.includes("鎖"));
  assert.ok(surface.texts.includes("2/4"));
  assert.equal(surface.texts.includes("ねこ"), false);
  assert.equal(surface.texts.includes("貓"), false);
});

test("an open card shows jp zh kana and hides pos romaji and emoji", () => {
  const open = card({
    marks: 4, progress: "4/4", reveal: "open", face: "card", showLock: false,
    jp: "ねこ", zh: "貓", kana: "ねこ", kanji: "猫", pos: "名詞"
  });
  const surface = ctx();
  const view = hooks(paper);
  ui.draw(surface, [open], { filter: { by: "all" }, page: 0 }, view, { width: 900, height: 600 });
  assert.ok(surface.texts.includes("ねこ"));
  assert.ok(surface.texts.includes("貓"));
  assert.ok(surface.texts.includes("4/4"));
  assert.equal(surface.texts.includes("名詞"), false);
  assert.equal(surface.texts.includes("neko"), false);
  assert.equal(surface.texts.includes("🐱"), false);
  assert.ok(surface.styles.filter(item => ["ねこ", "貓", "4/4"].includes(item.text)).every(item => item.fill === "#24180f" && item.maxWidth > 0));
  const replay = view.calls.button.find(button => button.id === "replay");
  assert.equal(replay.disabled, true);
});

test("missing paper draws text only and does not paint a card body", () => {
  const surface = ctx();
  const view = hooks(null);
  ui.draw(surface, [card({ marks: 1, progress: "1/4" })], { filter: { by: "all" }, page: 0 }, view, { width: 900, height: 600 });
  assert.equal(view.calls.ribbon.length, 0);
  assert.equal(view.calls.wood.includes("card:ねこ"), false);
  assert.ok(surface.texts.includes("鎖"));
  assert.ok(surface.texts.includes("1/4"));
});

test("hitboxes stay inside a small viewport and the replay hit does nothing audible", () => {
  const cards = [card(), card({ key: "いぬ", progress: "3/4", marks: 3 })];
  const drawn = ui.draw(ctx(), cards, { page: 0 }, hooks(paper), { width: 480, height: 320 });
  assert.ok(drawn.buttons.length >= 4);
  for (const box of drawn.buttons) {
    assert.ok(box.x >= 0 && box.y >= 0);
    assert.ok(box.x + box.w <= 480);
    assert.ok(box.y + box.h <= 320);
    assert.ok(box.w > 0 && box.h > 0);
  }
  const replay = drawn.buttons.find(button => button.id === "replay");
  assert.deepEqual(ui.hit({ x: replay.x + 2, y: replay.y + 2 }, drawn.buttons), { id: "replay", ok: false, reason: "audio-frozen" });
  const back = drawn.buttons.find(button => button.id === "back");
  assert.equal(ui.reduce(cards, { page: 0 }, { type: "back" }).close, "pause");
  assert.equal(ui.hit({ x: back.x + 2, y: back.y + 2 }, drawn.buttons).ok, true);
});

test("an empty pool still offers back and does not throw", () => {
  const drawn = ui.draw(ctx(), [], { page: 3 }, hooks(paper), { width: 900, height: 600 });
  assert.equal(drawn.cards.length, 0);
  assert.equal(drawn.view.page, 0);
  assert.ok(drawn.buttons.some(button => button.id === "back"));
  assert.equal(drawn.buttons.some(button => String(button.id).startsWith("card:")), false);
});

test("a shared card appears in each real stage filter and a filter resets the page", () => {
  const shared = card({ key: "が", stages: ["night-town", "yomi"], shared: true, progress: "1/4", marks: 1 });
  const others = Array.from({ length: 12 }, (_, i) => card({
    key: "他" + i, stages: ["night-town"], category: { id: "station", source: "pack" }
  }));
  const cards = [shared, ...others];
  assert.equal(ui.visible(cards, { by: "stage", id: "yomi" })[0], shared);
  assert.equal(ui.visible(cards, { by: "stage", id: "night-town" }).includes(shared), true);
  assert.equal(ui.visible(cards, { by: "all" }).filter(item => item.key === "が").length, 1);
  const next = ui.reduce(cards, { filter: { by: "all" }, page: 2 }, { type: "filter", by: "stage", id: "yomi" });
  assert.equal(next.page, 0);
  assert.equal(next.close, null);
  const clamped = ui.reduce(cards, { filter: { by: "stage", id: "yomi" }, page: 9 }, { type: "page", delta: 0 });
  assert.equal(clamped.page, 0);
});

test("drawing and paging do not mutate the projected cards", () => {
  const frozen = Object.freeze(card({ stages: Object.freeze(["night-town", "yomi"]) }));
  const list = Object.freeze([frozen]);
  const before = JSON.stringify(list);
  ui.draw(ctx(), list, { page: 4, filter: { by: "pack", id: "animals" } }, hooks(paper), { width: 900, height: 600 });
  ui.reduce(list, { page: 4, filter: { by: "all" } }, { type: "filter", by: "pack", id: "animals" });
  assert.equal(JSON.stringify(list), before);
  assert.equal(Object.isFrozen(frozen.stages), true);
});

test("real viewports keep interactive hitboxes at 44 CSS pixels without overlap", () => {
  const cards = Array.from({ length: 8 }, (_, i) => card({ key: "卡" + i, marks: 4, progress: "4/4", reveal: "open", face: "card", showLock: false, jp: "日" + i, zh: "中", kana: "か" }));
  for (const [name, width, height] of [["desktop", 1280, 800], ["tablet", 1194, 834], ["mobile", 844, 390]]) {
    const view = viewport.calculate(width, height);
    const drawn = ui.draw(ctx(), cards, { filter: { by: "all" }, page: 0 }, hooks(paper), view);
    const left = -view.offsetX, top = -view.offsetY, right = 900 + view.offsetX, bottom = 600 + view.offsetY;
    const controls = drawn.buttons.filter(button => !String(button.id).startsWith("card:"));
    assert.equal(controls.length >= 6, true, name);
    controls.forEach(button => {
      assert.ok(button.w * view.scale >= 44 - 1e-6, name + " " + button.id + " w");
      assert.ok(button.h * view.scale >= 44 - 1e-6, name + " " + button.id + " h");
      assert.ok(button.x >= left - 1e-6 && button.y >= top - 1e-6, name);
      assert.ok(button.x + button.w <= right + 1e-6 && button.y + button.h <= bottom + 1e-6, name);
    });
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) assert.equal(overlaps(controls[i], controls[j]), false, name);
    }
    const stage = drawn.buttons.find(button => button.id === "filter-stage");
    const pack = drawn.buttons.find(button => button.id === "filter-pack");
    assert.equal(stage.label, "關卡：全部");
    assert.equal(pack.label, "詞包：全部");
  }
  const catalogs = { stages: [{ id: "night-town", name: "夜行町" }], packs: [{ id: "animals", name: "動物街" }] };
  const specified = ui.draw(ctx(), [card({ key: "が", stages: ["night-town"] })], { filter: { by: "stage", id: "night-town" }, page: 0 }, hooks(paper), viewport.calculate(1280, 800), catalogs);
  const ink = specified.buttons.map(button => button.label).join(" ");
  assert.equal(specified.buttons.find(button => button.id === "filter-stage").label, "關卡：夜行町");
  assert.equal(specified.buttons.find(button => button.id === "filter-pack").label, "詞包：全部");
  assert.equal(ink.includes("night-town"), false);
  assert.equal(ink.includes("が"), false);
  const cycled = ui.reduce([card()], { filter: { by: "all" }, page: 3 }, { type: "cycle", by: "pack" }, null, catalogs);
  assert.equal(cycled.page, 0);
  assert.deepEqual(cycled.filter, { by: "pack", id: "animals" });
  const named = ui.draw(ctx(), [card()], cycled, hooks(paper), { width: 900, height: 600, scale: 1 }, catalogs);
  assert.equal(named.buttons.find(button => button.id === "filter-pack").label, "詞包：動物街");
});

test("card text stays inside the bright paper and a short page uses one row", () => {
  const open = card({
    marks: 4, progress: "4/4", reveal: "open", face: "card", showLock: false,
    jp: "ねこ", zh: "貓", kana: "ねこ", illustration: { status: "pending", text: "待解鎖插畫" }
  });
  const surface = ctx();
  surface.fillText = function (text, x, y, maxWidth) {
    this.texts.push(String(text));
    this.styles.push({ text: String(text), fill: this.fillStyle, font: this.font, maxWidth, y });
  };
  const drawn = ui.draw(surface, [open], { filter: { by: "all" }, page: 0 }, hooks(paper), { width: 900, height: 600, scale: 1 });
  const plate = drawn.buttons.find(button => button.id === "card:ねこ");
  const mark = surface.styles.find(item => item.text === "4/4");
  const brightTop = plate.y + plate.h * (12 / 85);
  const brightBottom = plate.y + plate.h * (61 / 85);
  assert.ok(mark.y > brightTop && mark.y < brightBottom);
  assert.equal(surface.texts.filter(text => text === "待解鎖插畫").length, 1);
  const mobile = viewport.calculate(844, 390);
  const chrome = Math.max(96, 88 + Math.max(0, (44 / mobile.scale - 32) / 2) + (mobile.offsetY || 0) - 4);
  const inset = {
    scale: mobile.scale,
    width: mobile.width,
    height: Math.max(160, mobile.height - chrome),
    offsetX: mobile.offsetX,
    offsetY: (mobile.offsetY || 0) - chrome
  };
  const paged = ui.draw(ctx(), Array.from({ length: 8 }, (_, i) => card({ key: "卡" + i })), { page: 0 }, hooks(paper), inset);
  assert.equal(paged.cards.length, 4);
  const stepped = ui.reduce(paged.cards.concat(Array.from({ length: 4 }, (_, i) => card({ key: "後" + i }))), { page: 0, filter: { by: "all", id: null } }, { type: "page", delta: 1 }, inset);
  assert.equal(ui.draw(ctx(), Array.from({ length: 8 }, (_, i) => card({ key: "卡" + i })), stepped, hooks(paper), inset).view.page, stepped.page);
});

test("reduce uses the same dynamic page size as the viewport", () => {
  const cards = Array.from({ length: 10 }, (_, i) => card({ key: "頁" + i }));
  const view = { width: 900, height: 220, scale: 1, offsetX: 0, offsetY: 0 };
  let state = { page: 0, filter: { by: "all", id: null } };
  state = ui.reduce(cards, state, { type: "page", delta: 1 }, view);
  state = ui.reduce(cards, state, { type: "page", delta: 1 }, view);
  const drawn = ui.draw(ctx(), cards, state, hooks(paper), view);
  assert.equal(drawn.view.page, 2);
  assert.equal(drawn.cards[0].key, "頁8");
});

test("the module is loaded after the card model and does not mention audio", () => {
  const source = fs.readFileSync(path.join(__dirname, "../js/card-gallery-ui.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const modelAt = html.indexOf("js/card-gallery-model.js");
  const uiAt = html.indexOf("js/card-gallery-ui.js");
  const gameAt = html.indexOf("js/game.js");
  assert.ok(modelAt > 0 && uiAt > modelAt && gameAt > uiAt);
  assert.equal(source.includes("AUDIO"), false);
  assert.equal(source.includes("speechSynthesis"), false);
  assert.equal(source.includes("localStorage"), false);
});
