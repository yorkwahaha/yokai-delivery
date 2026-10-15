"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cards = require("../js/card-collection.js");

const near = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`);

function pool(n) {
  return Array.from({ length: n }, (_, i) => ({ jp: `w${i}`, zh: `字${i}` }));
}

function fullMarks(c) {
  const marks = {};
  for (let i = 0; i < c; i++) marks[`w${i}`] = 4;
  return marks;
}

function deliver(jp, id, extra) {
  return { id, jp, kind: "delivery", ok: true, stageId: "rain-port", ...extra };
}

test("N=25 matches the roadmap table and each N stays inside the formula", () => {
  const words = pool(25);
  const expectRow = (c, pu, pc) => {
    const table = cards.deliveryWeights(words, fullMarks(c));
    assert.equal(table.n, 25);
    assert.equal(table.c, c);
    assert.equal(table.u, 25 - c);
    near(table.sum, 100);
    for (const entry of table.entries) {
      if (c === 0 || c === 25) near(entry.weight, 4);
      else if (entry.full) near(entry.weight, pc);
      else near(entry.weight, pu);
    }
  };
  expectRow(0, 4, null);
  expectRow(3, 97 / 22, 1);
  expectRow(20, 16, 1);
  expectRow(21, 19.75, 1);
  expectRow(22, 20, 40 / 22);
  expectRow(23, 20, 60 / 23);
  expectRow(24, 20, 80 / 24);
  expectRow(25, null, 4);

  for (let n = 1; n <= 25; n++) {
    for (let c = 0; c <= n; c++) {
      const table = cards.deliveryWeights(pool(n), fullMarks(c));
      near(table.sum, 100);
      const u = n - c;
      for (const entry of table.entries) {
        assert.ok(entry.weight > 0);
        if (c === 0 || u === 0) near(entry.weight, 100 / n);
        else if (!entry.full) assert.ok(entry.weight <= 20 + 1e-6);
        else assert.ok(entry.weight + 1e-9 >= 1 || (100 - c) / u > 20);
      }
      if (c > 0 && u > 0 && (100 - c) / u > 20) {
        assert.ok(table.entries.filter(e => !e.full).every(e => Math.abs(e.weight - 20) < 1e-6));
      }
    }
  }
});

test("N=0, N<5, duplicate words, and an infeasible 1% floor stay sum-safe", () => {
  const empty = cards.deliveryWeights([], {});
  assert.deepEqual(empty, { n: 0, c: 0, u: 0, pu: null, pc: null, entries: [], sum: 0 });
  assert.equal(cards.pickDeliveryWord([], {}, () => 0), null);

  const small = cards.deliveryWeights(pool(4), {});
  assert.equal(small.n, 4);
  near(small.sum, 100);
  assert.ok(small.entries.every(e => Math.abs(e.weight - 25) < 1e-6));

  const capped = cards.deliveryWeights(pool(4), fullMarks(3));
  assert.equal(capped.c, 3);
  assert.equal(capped.u, 1);
  near(capped.entries.find(e => !e.full).weight, 20);
  near(capped.entries.find(e => e.full).weight, 80 / 3);
  near(capped.sum, 100);

  const dup = cards.deliveryWeights(["あ", { jp: "あ" }, "い", "あ"], {});
  assert.equal(dup.n, 2);
  near(dup.sum, 100);

  const huge = [];
  const marks = {};
  for (let i = 0; i < 101; i++) {
    huge.push(`k${i}`);
    if (i < 101) marks[`k${i}`] = i < 101 ? 4 : 0;
  }
  marks.k100 = 0;
  for (let i = 0; i < 100; i++) marks[`k${i}`] = 4;
  const overflow = cards.deliveryWeights(huge, marks);
  assert.equal(overflow.c, 100);
  assert.equal(overflow.u, 1);
  near(overflow.sum, 100);
  assert.ok(overflow.entries.every(e => e.weight > 0));
});

test("marks cap at 4, stages share one key, and assisted delivery counts", () => {
  const bag = cards.createCollection();
  for (let i = 0; i < 5; i++) {
    const result = bag.record(deliver("が", `s${i}`, { stageId: i % 2 ? "night-town" : "rain-port" }));
    assert.equal(result.applied, true);
  }
  assert.equal(bag.marks("が"), 4);
  assert.equal(bag.marks("か\u3099"), 4);
  const assisted = bag.record({ id: "assist", jp: "いぬ", kind: "delivery", ok: true, assisted: true, stageId: "sakura-pass" });
  assert.equal(assisted.reason, "success");
  assert.equal(bag.marks("いぬ"), 1);
});

test("duplicate ids, failures, and non-deliveries do not move marks", () => {
  const writes = [];
  const bag = cards.createCollection({ write: state => writes.push(state) });
  assert.equal(bag.record(deliver("ねこ", "e1")).reason, "success");
  assert.equal(bag.record(deliver("ねこ", "e1")).reason, "duplicate");
  assert.equal(bag.marks("ねこ"), 1);
  assert.equal(writes.length, 1);

  assert.equal(bag.record({ id: "fail", jp: "ねこ", kind: "delivery", ok: false }).reason, "fail");
  assert.equal(bag.marks("ねこ"), 1);
  assert.equal(bag.record({ id: "fail", jp: "ねこ", kind: "delivery", ok: true }).reason, "duplicate");
  assert.equal(bag.marks("ねこ"), 1);

  for (const kind of ["boss", "recall", "study", "replay"]) {
    assert.equal(bag.record({ id: kind, jp: "ねこ", kind, ok: true }).reason, "invalid");
  }
  assert.equal(bag.record({ jp: "ねこ", kind: "delivery", ok: true }).reason, "invalid");
  assert.equal(bag.record({ id: "blank", jp: "  ", kind: "delivery", ok: true }).reason, "invalid");
  assert.equal(bag.marks("ねこ"), 1);
  assert.equal(bag.snapshot().events.boss, undefined);
  assert.equal(bag.snapshot().events.fail, true);
});

test("legacy mastery save cannot seed or overwrite card marks", () => {
  const legacy = {
    m: { "ねこ": { ok: 12, ng: 3, box: 4 }, "いぬ": { ok: 4, box: 4 } },
    best: 80,
    progress: { unlocked: { "night-town": true } }
  };
  assert.equal(cards.loadState(legacy).marks["ねこ"], undefined);
  assert.equal(cards.migrate(undefined, legacy).marks["ねこ"], undefined);

  const saved = { v: 1, marks: { "ねこ": 2 }, events: { kept: true } };
  const kept = cards.migrate(saved, legacy);
  assert.equal(kept.marks["ねこ"], 2);
  assert.equal(kept.marks["いぬ"], undefined);
  assert.equal(kept.events.kept, true);

  const bag = cards.createCollection({
    read: () => saved,
    legacy: () => legacy
  });
  assert.equal(bag.marks("ねこ"), 2);
  assert.equal(bag.marks("いぬ"), 0);
});

test("a successful delivery refreshes the next order only", () => {
  const words = pool(25);
  const orders = [{ word: words[3], life: 110 }];
  const marks = fullMarks(3);
  marks.w3 = 3;
  const frozen = cards.migrate({ v: 1, marks, events: {} }, null);
  const before = cards.deliveryWeights(words, frozen.marks);
  assert.equal(before.c, 3);
  near(before.pu, 97 / 22);

  const result = cards.applyEvent(frozen, deliver("w3", "fill-w3"));
  assert.equal(frozen.marks.w3, 3);
  assert.equal(result.state.marks.w3, 4);
  assert.equal(orders[0].life, 110);
  assert.equal(orders[0].word, words[3]);
  const after = cards.deliveryWeights(words, result.state.marks);
  assert.equal(after.c, 4);
  assert.notEqual(Math.round(before.pu * 1000), Math.round(after.pu * 1000));
  near(after.sum, 100);

  const still = cards.applyEvent(result.state, deliver("w4", "chip"));
  assert.equal(still.state.marks.w4, 1);
  const sameBand = cards.deliveryWeights(words, still.state.marks);
  assert.equal(sameBand.c, 4);
  near(sameBand.pu, after.pu);
});
