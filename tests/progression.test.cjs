const test = require("node:test");
const assert = require("node:assert/strict");

function loadStore(seed = null) {
  const mem = new Map();
  if (seed) mem.set("yokai-delivery-v1", JSON.stringify(seed));
  global.window = global;
  global.localStorage = {
    getItem: key => mem.has(key) ? mem.get(key) : null,
    setItem: (key, value) => mem.set(key, value)
  };
  delete require.cache[require.resolve("../js/store.js")];
  require("../js/store.js");
  return { STORE: global.STORE, mem };
}

test("legacy save data is upgraded without losing vocabulary progress", () => {
  const legacy = {
    m: { "ねこ": { ok: 3, ng: 1, box: 2, lastSeen: 123, missBoost: 1 } },
    best: 999,
    bestDel: 4
  };
  const { STORE } = loadStore(legacy);
  assert.equal(STORE.get("ねこ").ok, 3);
  assert.equal(STORE.data.best, 999);
  assert.equal(STORE.isStageUnlocked("night-town"), true);
  assert.equal(STORE.isStageUnlocked("rain-port"), false);
});

test("clearing night-town unlocks rain-port and stores per-stage records", () => {
  const { STORE } = loadStore();
  STORE.startRun("night-town");
  STORE.finish("night-town", 4321, 8, true);

  assert.equal(STORE.isStageCompleted("night-town"), true);
  assert.equal(STORE.isStageUnlocked("rain-port"), true);
  const stats = STORE.getStageStats("night-town");
  assert.equal(stats.bestScore, 4321);
  assert.equal(stats.bestDeliveries, 8);
  assert.equal(stats.clears, 1);
  assert.equal(stats.attempts, 1);
});

test("a failed run records stage bests but does not unlock the next stage", () => {
  const { STORE } = loadStore();
  STORE.startRun("night-town");
  STORE.finish("night-town", 1200, 3, false);

  assert.equal(STORE.isStageCompleted("night-town"), false);
  assert.equal(STORE.isStageUnlocked("rain-port"), false);
  assert.equal(STORE.getStageStats("night-town").bestScore, 1200);
});
