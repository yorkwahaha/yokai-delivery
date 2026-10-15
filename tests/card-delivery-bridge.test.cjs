"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../js/card-delivery-bridge.js");
const cards = require("../js/card-collection.js");

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !~ ${expected}`);

function words(n) {
  return Array.from({ length: n }, (_, i) => ({ jp: `w${i}`, zh: `字${i}` }));
}

function mem() {
  const box = new Map();
  return {
    getItem: key => box.has(key) ? box.get(key) : null,
    setItem: (key, value) => box.set(key, String(value)),
    raw: box
  };
}

test("delivery draw returns the same word object and ignores study priority", () => {
  const pool = words(4);
  const orders = [{ word: pool[0], life: 110 }];
  const before = JSON.stringify(orders);
  const picked = bridge.chooseDeliveryWord(pool, {}, [pool[0].jp], () => 0);
  assert.equal(picked.word, pool[1]);
  assert.notEqual(typeof picked.word, "string");
  assert.equal(JSON.stringify(orders), before);
  assert.equal(orders[0].word, pool[0]);
});

test("an empty available pool does not throw or invent a word", () => {
  const pool = words(2);
  const picked = bridge.chooseDeliveryWord(pool, {}, ["w0", "w1"], () => 0.9);
  assert.equal(picked.word, null);
  assert.equal(picked.reason, "empty");
  assert.equal(picked.pool.length, 0);
});

test("excluded words renormalize the remaining pool", () => {
  const pool = words(25);
  const marks = {};
  for (let i = 0; i < 22; i++) marks[`w${i}`] = 4;
  const full = bridge.chooseDeliveryWord(pool, marks, [], () => 0);
  near(full.weights.pu, 20);
  near(full.weights.pc, 40 / 22);
  near(full.weights.sum, 100);
  const narrowed = bridge.chooseDeliveryWord(pool, marks, ["w24"], () => 0);
  assert.equal(narrowed.weights.n, 24);
  assert.equal(narrowed.weights.u, 2);
  near(narrowed.weights.pu, 20);
  near(narrowed.weights.pc, 60 / 22);
  near(narrowed.weights.sum, 100);
  assert.ok(Math.abs(narrowed.weights.pc - full.weights.pc) > 0.1);
});

test("fewer than five words may exceed the 20 percent cap", () => {
  const table = cards.deliveryWeights(words(4), {});
  assert.equal(table.n, 4);
  near(table.sum, 100);
  assert.ok(table.entries.every(entry => Math.abs(entry.weight - 25) < 1e-6));
});

test("four successes cap the mark and a fifth event does not raise it", () => {
  const bag = bridge.openCards(mem(), {});
  for (let i = 0; i < 5; i++) bag.record({ id: `d${i}`, jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(bag.marks("ねこ"), 4);
});

test("repeat ids, failures, boss and recall do not add marks", () => {
  const bag = bridge.openCards(mem(), {});
  assert.equal(bag.record({ id: "once", jp: "いぬ", kind: "delivery", ok: true, assisted: true }).reason, "success");
  assert.equal(bag.record({ id: "once", jp: "いぬ", kind: "delivery", ok: true }).reason, "duplicate");
  assert.equal(bag.record({ id: "miss", jp: "いぬ", kind: "delivery", ok: false }).reason, "fail");
  assert.equal(bag.record({ id: "boss", jp: "いぬ", kind: "boss", ok: true }).reason, "invalid");
  assert.equal(bag.record({ id: "recall", jp: "いぬ", kind: "recall", ok: true }).reason, "invalid");
  assert.equal(bag.marks("いぬ"), 1);
  assert.equal(bag.record({ id: "other", jp: "か\u3099", kind: "delivery", ok: true, stageId: "rain-port" }).reason, "success");
  assert.equal(bag.marks("が"), 1);
});

test("learning saves and dev saves stay on different keys", () => {
  const storage = mem();
  const learning = { m: { "ねこ": { ok: 9, box: 4 } }, best: 3 };
  storage.setItem(bridge.LEARNING_KEY, JSON.stringify(learning));
  const live = bridge.openCards(storage, { hostname: "127.0.0.1", search: "" });
  assert.equal(live.key, bridge.OFFICIAL_KEY);
  assert.equal(live.marks("ねこ"), 0);
  live.record({ id: "live", jp: "ねこ", kind: "delivery", ok: true });
  const dev = bridge.openCards(storage, { hostname: "127.0.0.1", search: "?dev=1" });
  assert.equal(dev.key, bridge.DEV_KEY);
  assert.equal(dev.marks("ねこ"), 0);
  dev.record({ id: "dev", jp: "ねこ", kind: "delivery", ok: true });
  dev.record({ id: "dev2", jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(JSON.parse(storage.getItem(bridge.LEARNING_KEY)).m["ねこ"].ok, 9);
  assert.equal(JSON.parse(storage.getItem(bridge.OFFICIAL_KEY)).marks["ねこ"], 1);
  assert.equal(JSON.parse(storage.getItem(bridge.DEV_KEY)).marks["ねこ"], 2);
  assert.equal(bridge.openCards(storage, { hostname: "example.com", search: "?dev=1" }).key, bridge.OFFICIAL_KEY);
});

test("a later draw does not rewrite an order already on the list", () => {
  const pool = words(6);
  const marks = { w0: 4, w1: 4, w2: 4 };
  const open = [{ word: pool[5], life: 90 }];
  const first = bridge.chooseDeliveryWord(pool, marks, [open[0].word.jp], () => 0);
  const again = bridge.chooseDeliveryWord(pool, { ...marks, w3: 4 }, [open[0].word.jp], () => 0);
  assert.equal(open[0].word, pool[5]);
  assert.equal(open[0].life, 90);
  assert.notEqual(first.word, open[0].word);
  assert.notEqual(again.word, open[0].word);
});

test("duplicate nfc forms collapse to one pool object", () => {
  const first = { jp: "が", zh: "合成" };
  const second = { jp: "か\u3099", zh: "分解" };
  const pool = bridge.availablePool([first, second, first], []);
  assert.equal(pool.length, 1);
  assert.equal(pool[0], first);
});

test("public dev query does not open the dev card key", () => {
  assert.equal(bridge.cardKey({ hostname: "yokai.github.io", search: "?dev=1" }), bridge.OFFICIAL_KEY);
  assert.equal(bridge.cardKey({ dev: true }), bridge.DEV_KEY);
});

test("a quota failure keeps the mark in memory and a later save writes the whole bag", () => {
  const storage = mem();
  const write = storage.setItem;
  const loc = { hostname: "127.0.0.1", search: "" };
  let fail = true;
  storage.setItem = (key, value) => {
    if (fail && key === bridge.OFFICIAL_KEY) {
      const error = new Error("quota");
      error.name = "QuotaExceededError";
      throw error;
    }
    write(key, value);
  };
  const bag = bridge.openCards(storage, loc);
  const missed = bag.record({ id: "e1", jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(missed.applied, true);
  assert.equal(missed.persisted, false);
  assert.equal(missed.storageError.name, "QuotaExceededError");
  assert.equal(missed.storageError.message, "quota");
  assert.equal(bag.marks("ねこ"), 1);
  assert.equal(storage.getItem(bridge.OFFICIAL_KEY), null);
  const again = bag.record({ id: "e1", jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(again.applied, false);
  assert.equal(again.persisted, null);
  const invalid = bag.record({ id: "", jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(invalid.applied, false);
  assert.equal(invalid.persisted, null);
  fail = false;
  const saved = bag.record({ id: "e2", jp: "いぬ", kind: "delivery", ok: true });
  assert.equal(saved.applied, true);
  assert.equal(saved.persisted, true);
  assert.equal(saved.storageError, null);
  const disk = JSON.parse(storage.getItem(bridge.OFFICIAL_KEY));
  assert.equal(disk.marks["ねこ"], 1);
  assert.equal(disk.marks["いぬ"], 1);
  assert.deepEqual(Object.keys(disk.events).sort(), ["e1", "e2"]);
});

test("a failed mark stays on that storage object and does not appear in another", () => {
  const first = mem();
  const second = mem();
  const loc = { hostname: "127.0.0.1", search: "" };
  first.setItem(bridge.OFFICIAL_KEY, JSON.stringify({ v: 1, marks: {}, events: {}, awards: { animals: true } }));
  first.setItem = () => {
    const error = new Error("quota");
    error.name = "QuotaExceededError";
    throw error;
  };
  const bag = bridge.openCards(first, loc);
  assert.equal(bag.snapshot().awards.animals, true);
  const missed = bag.record({ id: "e1", jp: "ねこ", kind: "delivery", ok: true });
  assert.equal(missed.persisted, false);
  assert.equal(bag.marks("ねこ"), 1);
  assert.equal(bag.snapshot().awards.animals, true);
  const other = bridge.openCards(second, loc);
  assert.equal(other.marks("ねこ"), 0);
  assert.equal(other.snapshot().awards.mini, undefined);
  assert.equal(other.snapshot().awards.animals, undefined);
  const again = bridge.openCards(first, loc);
  assert.equal(again.marks("ねこ"), 1);
  assert.equal(again.snapshot().awards.animals, true);
  again.snapshot().awards.extra = true;
  assert.equal(bridge.openCards(first, loc).snapshot().awards.extra, undefined);
});
