const test = require("node:test");
const assert = require("node:assert/strict");

const CONTENT = require("../js/words.js");
const WORLD = require("../js/world.js");

test("night-town keeps the original 9 word packs and 27 unique words", () => {
  const stage = CONTENT.getStage("night-town");
  assert.equal(stage.wordPacks.length, 9);
  const words = CONTENT.getStageWords(stage);
  assert.equal(words.length, 27);
  assert.equal(new Set(words.map(w => w.jp)).size, 27);
  assert.deepEqual(stage.pacing.bossTimes, [180, 360, 540, 590]);
  assert.equal(stage.pacing.runSeconds, 600);
  assert.equal(stage.pacing.goalDeliveries, 6);
});

test("rain-port is a separate playable stage with its own packs and weather tuning", () => {
  const stage = CONTENT.getStage("rain-port");
  assert.equal(stage.implemented, true);
  assert.equal(stage.unlockedByDefault, false);
  assert.deepEqual(stage.wordPacks, ["rain-weather", "port-directions", "port"]);
  const words = CONTENT.getStageWords(stage);
  assert.equal(words.length, 15);
  assert.ok(words.some(w => w.jp === "あめ"));
  assert.ok(words.some(w => w.jp === "みぎ"));
  assert.ok(words.some(w => w.jp === "ふね"));
  assert.equal(stage.visual.weather, "rain");
  assert.deepEqual(stage.enemy.bosses, ["harbor-warden", "fog-ogre", "storm-lord"]);
  assert.equal(stage.pacing.goalDeliveries, 6);
  assert.deepEqual(stage.pacing.bossTimes, [210, 420, 590]);
  const world = WORLD.createStageWorld(stage, CONTENT);
  assert.equal(world.update(stage.start.x, stage.start.y).chunks.length, 25);
});

test("initial 3x3 chunks preserve the original district order", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);
  const expected = [
    ["animals", "beach", "nightsky"],
    ["sweets", "station", "port"],
    ["sakura", "tavern", "pond"]
  ];

  expected.forEach((row, cy) => {
    row.forEach((packId, cx) => {
      const chunk = world.getChunk(cx, cy);
      assert.equal(chunk.packId, packId);
      assert.equal(chunk.houses.length, 3);
    });
  });
});

test("world streams chunks at arbitrarily distant and negative coordinates", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);
  const snapshot = world.update(1_000_000, -800_000);

  assert.equal(snapshot.chunks.length, 25);
  assert.equal(snapshot.houses.length, 75);
  assert.equal(snapshot.solids.length, 75);

  const centerKey = world.keyAt(1_000_000, -800_000);
  assert.ok(snapshot.chunks.some(chunk => chunk.key === centerKey));
  assert.ok(snapshot.houses.some(house => Math.abs(house.x) > 100_000));
  assert.ok(snapshot.houses.some(house => house.y < 0));
});

test("chunk cache stays bounded and only pinned delivery chunks survive travel", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);

  world.update(stage.start.x, stage.start.y);
  const pinned = world.keyAt(stage.start.x, stage.start.y);
  assert.ok(world.getCachedKeys().includes(pinned));

  world.update(1_000_000, 1_000_000, [pinned]);
  assert.ok(world.getCachedKeys().includes(pinned));
  assert.ok(world.getCacheSize() <= 26);

  world.update(2_000_000, 2_000_000);
  assert.ok(!world.getCachedKeys().includes(pinned));
  assert.equal(world.getCacheSize(), 25);
});

test("regenerated chunks are deterministic", () => {
  const stage = CONTENT.getStage("night-town");
  const world = WORLD.createStageWorld(stage, CONTENT);

  const first = world.getChunk(-12, 37);
  const signature = first.houses.map(h => [h.id, h.x, h.y, h.word.jp]);
  world.reset();
  const second = world.getChunk(-12, 37);

  assert.deepEqual(second.houses.map(h => [h.id, h.x, h.y, h.word.jp]), signature);
});
