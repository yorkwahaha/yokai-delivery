"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const collection = require("../js/card-collection.js");
const { loadGame } = require("./helpers/game-runtime.cjs");

function useDeliveryBag(game) {
  game.env.URLSearchParams = URLSearchParams;
  game.env.location = { hostname: "127.0.0.1", search: "" };
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/card-delivery-bridge.js"), "utf8"), game.env);
}

const audioPath = ["js", "audio.js"].join("/");
const self = fs.readFileSync(__filename, "utf8");
assert.equal(self.includes(audioPath), false);
assert.equal(self.toLowerCase().includes(["speech", "Synthesis"].join("")), false);

function keydown(code, key) {
  return { code, key, preventDefault() {}, repeat: false };
}

test("same NFC spellings keep the higher mark and do not add", () => {
  const forward = collection.loadState({ v: 1, marks: { "が": 4, "か\u3099": 0 }, events: {} });
  const backward = collection.loadState({ v: 1, marks: { "か\u3099": 0, "が": 4 }, events: {} });
  const key = collection.wordKey("が");
  assert.equal(key, collection.wordKey("か\u3099"));
  assert.equal(forward.marks[key], 4);
  assert.equal(backward.marks[key], 4);
  const both = collection.loadState({ v: 1, marks: { "ねこ": 1, "いぬ": 3 }, events: {} });
  assert.equal(both.marks["ねこ"], 1);
  assert.equal(both.marks["いぬ"], 3);
});

test("index loads the gallery after the card model and keeps a fresh p42 cache", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const at = file => html.indexOf(`js/${file}.js?v=`);
  assert.ok(at("card-collection") < at("card-gallery-model"));
  assert.ok(at("card-gallery-model") < at("card-gallery-ui"));
  assert.ok(at("card-gallery-ui") < at("game"));
  for (const file of ["renderer", "ui", "card-collection", "card-gallery-model", "card-gallery-ui", "game"]) {
    const match = html.match(new RegExp(`src="js/${file}\\.js\\?v=([^"\\s]+)"`));
    assert.ok(match && match[1].length > 0, file);
    assert.match(match[1], /^20261014-p42-c[34]/);
  }
  assert.equal(html.includes("p42-camera-model.js"), false);
  assert.equal(html.includes("hd25d-fixture"), false);
});

test("the words page reads the delivery bag, not learning stars", () => {
  const game = loadGame();
  useDeliveryBag(game);
  game.start();
  game.env.localStorage.setItem("yokai-delivery-cards-v1", JSON.stringify({
    v: 1, marks: { "ねこ": 4, "いぬ": 1 }, events: { "injected-c3": true }
  }));
  game.env.STORE.data.m["ねこ"] = { ok: 0, ng: 0, box: 4 };
  const official = game.env.UI.wordGallery();
  assert.equal(official.source.key, "yokai-delivery-cards-v1");
  const neko = official.cards.find(card => card.key === "ねこ");
  const inu = official.cards.find(card => card.key === "いぬ");
  assert.equal(neko.reveal, "open");
  assert.equal(neko.progress, "4/4");
  assert.equal(inu.reveal, "locked");
  assert.equal(inu.jp, null);
  assert.equal(inu.progress, "1/4");
  const shared = official.cards.find(card => card.stages.length > 1);
  assert.equal(game.env.CARD_GALLERY_UI.visible(official.cards, { by: "stage", id: shared.stages[0] }).includes(shared), true);
  assert.equal(game.env.CARD_GALLERY_UI.visible(official.cards, { by: "stage", id: shared.stages[1] }).includes(shared), true);

  const view = game.env.UI.wordGalleryViewport();
  const stepped = game.env.CARD_GALLERY_UI.reduce(
    official.cards,
    { filter: { by: "all", id: null }, page: 0 },
    { type: "page", delta: 1 },
    view,
    official.catalogs
  );
  const texts = [];
  const drawn = game.env.CARD_GALLERY_UI.draw({
    save() {}, restore() {}, texts, fillText(value) { texts.push(String(value)); }
  }, official.cards, { filter: { by: "all", id: null }, page: 0 }, {
    readableFont: () => "16px sans-serif",
    drawRibbonSlices() {}, drawWoodTag() {}, drawButton() {}
  }, view, official.catalogs);
  assert.equal(stepped.page, 1);
  assert.equal(drawn.view.page, 0);
  assert.equal(texts.includes("ねこ"), true);
  assert.equal(texts.includes("4/4"), true);
  assert.equal(texts.includes("いぬ"), false);
  assert.equal(texts.includes("🐱"), false);

  const named = game.env.CARD_GALLERY_UI.reduce(
    official.cards,
    { filter: { by: "all", id: null }, page: 3 },
    { type: "cycle", by: "stage" },
    view,
    official.catalogs
  );
  assert.equal(named.page, 0);
  const stage = official.catalogs.stages.find(item => item.id === named.filter.id);
  assert.equal(named.filter.by, "stage");
  assert.ok(stage && stage.name);
  const labeled = game.env.CARD_GALLERY_UI.draw({
    save() {}, restore() {}, fillText() {}
  }, official.cards, named, {
    readableFont: () => "16px sans-serif",
    drawRibbonSlices() {}, drawWoodTag() {}, drawButton() {}
  }, view, official.catalogs);
  assert.equal(labeled.buttons.find(button => button.id === "filter-stage").label, "關卡：" + stage.name);
  assert.equal(labeled.buttons.find(button => button.id === "filter-stage").label.includes(stage.id), false);

  game.env.localStorage.setItem("yokai-delivery-dev-cards-v1", JSON.stringify({
    v: 1, marks: { "ねこ": 0 }, events: {}
  }));
  game.env.location.search = "?dev=1";
  const dev = game.env.UI.wordGallery();
  assert.equal(dev.source.key, "yokai-delivery-dev-cards-v1");
  assert.equal(dev.cards.find(card => card.key === "ねこ").marks, 0);
  assert.equal(dev.cards.find(card => card.key === "ねこ").reveal, "locked");
});

test("codex back returns to the screen that opened it and does not spend the run", () => {
  const game = loadGame();
  game.start();
  game.setState("menu");
  game.events.keydown(keydown("KeyC", "c"));
  assert.equal(game.snapshot().state, "codex");
  assert.equal(game.snapshot().codexBack, "menu");
  game.events.keydown(keydown("Tab", "Tab"));
  assert.equal(game.snapshot().codexTab, "words");
  game.events.keydown(keydown("KeyP", "p"));
  assert.equal(game.snapshot().state, "menu");

  game.setState("play");
  game.setElapsed(20);
  const place = game.snapshot();
  game.setState("pause");
  game.events.keydown(keydown("KeyC", "c"));
  if (game.snapshot().codexTab !== "words") game.events.keydown(keydown("Tab", "Tab"));
  assert.equal(game.snapshot().codexBack, "pause");
  assert.equal(game.snapshot().codexTab, "words");
  game.update(4);
  assert.equal(game.snapshot().elapsed, 20);
  assert.equal(game.snapshot().x, place.x);
  assert.equal(game.snapshot().orders.length, place.orders.length);
  game.events.keydown(keydown("KeyP", "p"));
  assert.equal(game.snapshot().state, "pause");
  assert.equal(game.audioCalls.includes("speak"), false);
});

test("a live-run codex keeps the camera anchor and the same houses, oil and time", () => {
  const game = loadGame();
  game.start();
  game.env.URLSearchParams = URLSearchParams;
  game.env.VIEWPORT.setTiltScale(1);
  game.env.location = { hostname: "127.0.0.1", search: "?zoom=1.15&tilt=1" };
  game.env.VIEWPORT.setZoomStage("sakura-pass");
  const cam = { x: 900, y: 600 };
  game.env.RENDERER.getCam = () => ({ x: cam.x, y: cam.y });
  game.env.RENDERER.setCam = (x, y) => { cam.x = x; cam.y = y; };
  game.env.VIEWPORT.animateTiltScale(0.6, 0.8);
  game.frame(120);
  game.setState("pause");
  const houses = game.housesNow().map(house => [house.id, house.x, house.y]);
  assert.ok(houses.length > 0);
  const before = game.snapshot();
  const opened = { x: before.x, y: before.y, k: game.env.VIEWPORT.tiltScale(), z: game.env.VIEWPORT.worldZoom(), camX: cam.x, camY: cam.y };
  game.events.keydown(keydown("KeyC", "c"));
  assert.equal(game.snapshot().state, "codex");
  assert.equal(game.snapshot().codexBack, "pause");
  for (let now = 200; now <= 1100; now += 50) game.frame(now);
  game.events.keydown(keydown("KeyP", "p"));
  const back = game.snapshot();
  const expected = game.env.VIEWPORT.reanchor(
    { x: opened.x, y: opened.y },
    { x: opened.camX, y: opened.camY },
    opened.k, opened.z,
    game.env.VIEWPORT.tiltScale(),
    game.env.VIEWPORT.worldZoom()
  );
  assert.equal(back.state, "pause");
  assert.equal(back.codexBack, "pause");
  assert.ok(Math.abs(cam.x - expected.x) < 1e-6, cam.x + " !~ " + expected.x);
  assert.ok(Math.abs(cam.y - expected.y) < 1e-6, cam.y + " !~ " + expected.y);
  assert.ok(Math.abs(game.env.VIEWPORT.worldZoom() - 1) > 1e-6);
  assert.equal(back.oil, before.oil);
  assert.equal(back.elapsed, before.elapsed);
  assert.equal(back.x, before.x);
  assert.equal(back.y, before.y);
  assert.deepEqual(game.housesNow().map(house => [house.id, house.x, house.y]), houses);

  const menuCam = { x: cam.x, y: cam.y };
  game.setState("menu");
  game.env.VIEWPORT.animateTiltScale(1, 0.8);
  game.events.keydown(keydown("KeyC", "c"));
  assert.equal(game.snapshot().codexBack, "menu");
  for (let now = 1200; now <= 2100; now += 50) game.frame(now);
  game.events.keydown(keydown("KeyP", "p"));
  assert.equal(game.snapshot().state, "menu");
  assert.equal(cam.x, menuCam.x);
  assert.equal(cam.y, menuCam.y);
  assert.equal(game.snapshot().x, before.x);
  assert.equal(game.snapshot().y, before.y);
  assert.deepEqual(game.housesNow().map(house => [house.id, house.x, house.y]), houses);
});

test("this run did not load the real audio module, audio assets, or tts tools", () => {
  const loaded = Object.keys(require.cache).filter(file => {
    const name = file.replace(/\\/g, "/");
    return /(?:^|\/)js\/audio\.js$/i.test(name)
      || /(?:^|\/)assets\/audio(?:\/|$)/i.test(name)
      || /(?:^|\/)tools\/tts[^/]*(?:\/|$)/i.test(name);
  });
  assert.deepEqual(loaded, []);
});
