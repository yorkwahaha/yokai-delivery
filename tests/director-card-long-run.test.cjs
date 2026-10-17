'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/card-collection.js');
const bridge = require('../js/card-delivery-bridge.js');
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
test('C5 seeded long draws match capped redistribution after every completion count', () => {
  const words = Array.from({ length: 25 }, (_, i) => ({ jp: `word${i}` }));
  for (const completed of [0, 3, 20, 22, 23, 24, 25]) {
    const marks = Object.fromEntries(words.map((w, i) => [w.jp, i < completed ? 4 : 0]));
    const table = core.deliveryWeights(words, marks), sample = 10000, counts = Object.create(null), random = rng(7341 + completed);
    for (let i = 0; i < sample; i++) {
      const chosen = core.pickDeliveryWord(words, marks, random);
      assert.ok(words.some(w => w.jp === chosen));
      counts[chosen] = (counts[chosen] || 0) + 1;
    }
    assert.ok(Math.abs(table.sum - 100) < 1e-8);
    for (const row of table.entries) {
      const p = row.weight / 100, mean = sample * p, limit = 6 * Math.sqrt(sample * p * (1 - p)) + 5;
      assert.ok(Math.abs((counts[row.jp] || 0) - mean) <= limit, `${completed} completed: ${row.jp} count outside deterministic 6-sigma bound`);
    }
  }
});
test('C5 1000 mixed delivery events persist without mark loss or dev/normal crossover', () => {
  const docs = new Map(), storage = { getItem: k => docs.get(k) || null, setItem: (k, v) => docs.set(k, v) };
  const normalLoc = { hostname: 'localhost', search: '' }, devLoc = { hostname: 'localhost', search: '?dev=1' };
  const publicLoc = { hostname: 'example.test', search: '?dev=1' };
  let normal = bridge.openCards(storage, normalLoc), dev = bridge.openCards(storage, devLoc);
  const expected = Object.create(null), random = rng(771);
  const words = Array.from({ length: 25 }, (_, i) => ({ jp: `word${i}` }));
  for (let i = 0; i < 1000; i++) {
    const chosen = normal.choose(words, [], random).word;
    const event = { id: `normal:${i}`, jp: chosen.jp, kind: 'delivery', ok: i % 5 !== 0, assisted: i % 3 === 0 };
    const old = expected[event.jp] || 0;
    normal.record(event);
    expected[event.jp] = event.ok ? Math.min(4, old + 1) : old;
    assert.equal(normal.record(event).reason, 'duplicate');
    assert.equal(normal.marks(event.jp), expected[event.jp]);
    assert.ok(Math.abs(normal.choose(words, [], random).weights.sum - 100) < 1e-8);
    dev.record({ ...event, id: `dev:${i}`, jp: '開発専用', ok: true });
    if (i % 100 === 99) {
      normal = bridge.openCards(storage, normalLoc); dev = bridge.openCards(storage, devLoc);
      for (const [jp, n] of Object.entries(expected)) assert.equal(normal.marks(jp), n);
      assert.equal(normal.marks('開発専用'), 0);
      assert.equal(dev.marks('開発専用'), 4);
    }
  }
  assert.equal(bridge.openCards(storage, publicLoc).key, bridge.OFFICIAL_KEY);
  assert.equal(docs.has(bridge.LEARNING_KEY), false, 'long delivery run must never rewrite learning mastery');
  assert.equal(docs.size, 2);
});
