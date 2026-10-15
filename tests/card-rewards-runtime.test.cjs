"use strict";

// C4 PREP。Production 仍凍結，這些斷言現在應該是 RED。
// 不讀音訊、不改 js。正式實作要等解凍後的 GO。

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CONTENT = require("../js/words.js");
const collection = require("../js/card-collection.js");
const bridge = require("../js/card-delivery-bridge.js");
const { loadGame } = require("./helpers/game-runtime.cjs");

const OFFICIAL = bridge.OFFICIAL_KEY;
const DEV = bridge.DEV_KEY;
const officialLoc = { hostname: "127.0.0.1", search: "" };
const devLoc = { hostname: "127.0.0.1", search: "?dev=1" };

function mem(seed) {
  const box = new Map(seed || []);
  return {
    getItem: key => box.has(key) ? box.get(key) : null,
    setItem: (key, value) => box.set(key, String(value))
  };
}

function project(packs, marks) {
  assert.equal(typeof collection.completeSets, "function");
  return collection.completeSets(packs, marks || {});
}

function realPacks() {
  return Object.values(CONTENT.WORD_PACKS).map(pack => ({ id: pack.id, name: pack.name, words: pack.words }));
}

test("the live corpus is 32 packs and 164 words", () => {
  assert.equal(Object.keys(CONTENT.WORD_PACKS).length, 32);
  assert.equal(CONTENT.PACK_ORDER.length, 32);
  assert.equal(CONTENT.getAllWords().length, 164);
  assert.equal(Array.isArray(CONTENT.STAGES), false);
  for (const stage of Object.values(CONTENT.STAGES)) assert.ok(Array.isArray(stage.wordPacks));
});

test("completeSets projects every real pack and stays locked at zero marks", () => {
  const sets = project(realPacks(), {});
  assert.equal(sets.length, 32);
  assert.equal(sets.reduce((sum, set) => sum + set.total, 0), 164);
  assert.ok(sets.every(set => set.full === 0 && set.complete === false && typeof set.name === "string"));
  assert.equal(sets.find(set => set.id === "animals").name, "動物街");
});

test("a pack completes only when every real word has four marks", () => {
  const packs = [
    { id: "mini", name: "小包", words: [{ jp: "ねこ" }, { jp: "いぬ" }, { jp: "か\u3099", decoy: false }] },
    { id: "empty", name: "空包", words: [] },
    { id: "noise", name: "干擾", words: [{ jp: "バス", decoy: true }, { jp: "が" }] }
  ];
  const partial = project(packs, { "ねこ": 4, "いぬ": 3, "が": 4 });
  assert.equal(partial.find(set => set.id === "mini").complete, false);
  assert.equal(partial.find(set => set.id === "empty").total, 0);
  assert.equal(partial.find(set => set.id === "empty").complete, false);
  assert.equal(partial.find(set => set.id === "noise").total, 1);
  const done = project(packs, { "ねこ": 4, "いぬ": 4, "が": 4 });
  assert.equal(done.find(set => set.id === "mini").complete, true);
  assert.equal(done.find(set => set.id === "noise").complete, true);
  assert.equal(done.find(set => set.id === "noise").full, 1);
});

test("the third pack argument grants once and two arguments stay on the live packs", () => {
  const packs = [{ id: "mini", name: "小包", words: [{ jp: "ねこ" }, { jp: "いぬ" }] }];
  const storage = mem([[OFFICIAL, JSON.stringify({ v: 1, marks: { "ねこ": 4, "いぬ": 3 }, events: {} })]]);
  const bag = bridge.openCards(storage, officialLoc, packs);
  const granted = bag.record({ id: "final", jp: "いぬ", kind: "delivery", ok: true });
  assert.deepEqual(granted.newAwards, ["mini"]);
  assert.equal(granted.persisted, true);
  assert.equal(bag.snapshot().awards.mini, true);
  assert.equal(JSON.parse(storage.getItem(OFFICIAL)).awards.mini, true);
  const again = bag.record({ id: "later", jp: "ねこ", kind: "delivery", ok: true });
  assert.deepEqual(again.newAwards, []);
  const live = bridge.openCards(mem([[OFFICIAL, JSON.stringify({ v: 1, marks: { "いぬ": 3 }, events: {} })]]), officialLoc);
  const small = live.record({ id: "one", jp: "いぬ", kind: "delivery", ok: true });
  assert.deepEqual(small.newAwards, []);
});

test("failure duplicate and boss grant nothing, assisted success can", () => {
  const packs = [{ id: "mini", name: "小包", words: [{ jp: "ねこ" }] }];
  const storage = mem([[OFFICIAL, JSON.stringify({ v: 1, marks: { "ねこ": 3 }, events: {} })]]);
  const bag = bridge.openCards(storage, officialLoc, packs);
  const failed = bag.record({ id: "miss", jp: "ねこ", kind: "delivery", ok: false });
  assert.equal(failed.applied, true);
  assert.equal(failed.reason, "fail");
  assert.deepEqual(failed.newAwards, []);
  const boss = bag.record({ id: "boss", jp: "ねこ", kind: "boss", ok: true });
  assert.deepEqual(boss.newAwards, []);
  const assisted = bag.record({ id: "help", jp: "ねこ", kind: "delivery", ok: true, assisted: true });
  assert.deepEqual(assisted.newAwards, ["mini"]);
  const duplicate = bag.record({ id: "help", jp: "ねこ", kind: "delivery", ok: true, assisted: true });
  assert.equal(duplicate.applied, false);
  assert.deepEqual(duplicate.newAwards, []);
});

test("a full unmarked save is claimed on the next success and survives reload", () => {
  const packs = [{ id: "mini", name: "小包", words: [{ jp: "ねこ" }] }];
  const storage = mem([[OFFICIAL, JSON.stringify({ v: 1, marks: { "ねこ": 4 }, events: {} })]]);
  const bag = bridge.openCards(storage, officialLoc, packs);
  const claimed = bag.record({ id: "backfill", jp: "ねこ", kind: "delivery", ok: true });
  assert.deepEqual(claimed.newAwards, ["mini"]);
  const reloaded = bridge.openCards(storage, officialLoc, packs);
  assert.equal(reloaded.snapshot().awards.mini, true);
  const next = reloaded.record({ id: "again", jp: "ねこ", kind: "delivery", ok: true });
  assert.deepEqual(next.newAwards, []);
});

test("official and dev awards stay on their own keys", () => {
  const packs = [{ id: "mini", name: "小包", words: [{ jp: "ねこ" }] }];
  const storage = mem([
    [OFFICIAL, JSON.stringify({ v: 1, marks: { "ねこ": 4 }, events: {} })],
    [DEV, JSON.stringify({ v: 1, marks: { "ねこ": 4 }, events: {} })]
  ]);
  const official = bridge.openCards(storage, officialLoc, packs).record({ id: "off", jp: "ねこ", kind: "delivery", ok: true });
  const dev = bridge.openCards(storage, devLoc, packs).record({ id: "dev", jp: "ねこ", kind: "delivery", ok: true });
  assert.deepEqual(official.newAwards, ["mini"]);
  assert.deepEqual(dev.newAwards, ["mini"]);
  assert.equal(JSON.parse(storage.getItem(OFFICIAL)).awards.mini, true);
  assert.equal(JSON.parse(storage.getItem(DEV)).awards.mini, true);
  assert.equal(storage.getItem(bridge.LEARNING_KEY), null);
});

test("a refused save keeps the award in that storage only and does not claim it was written", () => {
  const packs = [{ id: "mini", name: "小包", words: [{ jp: "ねこ" }] }];
  const first = mem([[OFFICIAL, JSON.stringify({ v: 1, marks: { "ねこ": 3 }, events: {}, awards: { old: true } })]]);
  const second = mem();
  const write = first.setItem;
  first.setItem = (key, value) => {
    if (key === OFFICIAL) {
      const error = new Error("quota");
      error.name = "QuotaExceededError";
      throw error;
    }
    write(key, value);
  };
  const bag = bridge.openCards(first, officialLoc, packs);
  const missed = bag.record({ id: "e1", jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(missed.applied, true);
  assert.equal(missed.persisted, false);
  assert.equal(missed.storageError.name, "QuotaExceededError");
  assert.deepEqual(missed.newAwards, ["mini"]);
  assert.equal(bag.snapshot().awards.mini, true);
  assert.equal(bag.snapshot().awards.old, true);
  assert.equal(JSON.parse(first.getItem(OFFICIAL)).awards.mini, undefined);
  assert.equal(bridge.openCards(second, officialLoc, packs).marks("ねこ"), 0);
  assert.equal(bridge.openCards(first, officialLoc, packs).snapshot().awards.mini, true);
});

test("the live stamp hook names the pack and does not touch combat or audio", () => {
  const game = loadGame();
  game.start();
  const before = game.snapshot();
  const source = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
  const stamp = source.slice(source.indexOf("function stampDeliveryCard"), source.indexOf("function makeOrder"));
  assert.match(stamp, /newAwards/);
  assert.match(stamp, /套卡已集齊/);
  assert.equal(stamp.includes("fanfare"), false);
  assert.equal(game.snapshot().oil, before.oil);
  assert.equal(game.snapshot().x, before.x);
});
