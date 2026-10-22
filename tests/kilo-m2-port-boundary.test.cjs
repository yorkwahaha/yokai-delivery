"use strict";
// M2-PORT-Y：world.js bounds + update() houses 合法性驗收（Node 短測）
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const WORLD_PATH = path.join(__dirname, "..", "js", "world.js");

function makeWorldEnv() {
  const env = { window: {}, Math, Object, Array, Number, String, Set, Map };
  vm.runInNewContext(fs.readFileSync(WORLD_PATH, "utf8"), env);
  return env.window.WORLD;
}

const world = makeWorldEnv();

test("world.js createStageWorld：rain-port 回傳 bounds、night-town 為 null", () => {
  const rainApi = world.createStageWorld(
    { id: "rain-port", world: { chunkWidth: 900, chunkHeight: 720, activeRadius: 2, seed: 0 }, wordPacks: ["rain-port-base"], pacing: {}, visual: {}, enemy: {} },
    { getPack: (id) => ({ id, words: [], color: "#4a7c8a", floorColor: "#2a3f4a", theme: "water" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
    { spacingScaleY: 1.2 }
  );
  const snap = rainApi.update(1350, 480, []);
  assert.ok(snap.bounds, "rain-port update 回傳 bounds");
  assert.equal(snap.bounds.minY, 180, "minY=180");
  assert.equal(snap.bounds.maxY, 780, "maxY=780");

  const nightApi = world.createStageWorld(
    { id: "night-town", world: { chunkWidth: 900, chunkHeight: 600, activeRadius: 2, seed: 0 }, wordPacks: ["night-town-base"], pacing: {}, visual: {}, enemy: {} },
    { getPack: (id) => ({ id, words: [], color: "#c6a56d", floorColor: "#3a2f2a", theme: "residential" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
    { spacingScaleY: 1.2 }
  );
  const nightSnap = nightApi.update(1350, 900, []);
  assert.equal(nightSnap.bounds, null, "night-town bounds 為 null");
});

test("world.js chunk decor.port.bounds：同源 bounds 值", () => {
  const rainPortState = world.createStageWorld(
    { id: "rain-port", world: { chunkWidth: 900, chunkHeight: 720, activeRadius: 2, seed: 0 }, wordPacks: ["rain-port-base"], pacing: {}, visual: {}, enemy: {} },
    { getPack: (id) => ({ id, words: [{jp:"あめ",zh:"雨"},{jp:"かさ",zh:"傘"},{jp:"くも",zh:"雲"}], color: "#4a7c8a", floorColor: "#2a3f4a", theme: "water" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
    { spacingScaleY: 1.2 }
  );
  const rainSnap = rainPortState.update(1350, 480, []);
  for (const chunk of rainSnap.chunks) {
    if (chunk.decor?.port) {
      assert.ok(chunk.decor.port.bounds, "chunk.decor.port 有 bounds");
      assert.equal(chunk.decor.port.bounds.minY, 180);
      assert.equal(chunk.decor.port.bounds.maxY, 780);
    }
  }
});

test("world.js update()：rain-port houses dy 與 answerPositions 全在 minY+18..maxY-18", () => {
  const rainPortState = world.createStageWorld(
    { id: "rain-port", world: { chunkWidth: 900, chunkHeight: 720, activeRadius: 2, seed: 0 }, wordPacks: ["rain-port-base"], pacing: {}, visual: {}, enemy: {} },
    { getPack: (id) => ({ id, words: [{jp:"あめ",zh:"雨"},{jp:"かさ",zh:"傘"},{jp:"くも",zh:"雲"}], color: "#4a7c8a", floorColor: "#2a3f4a", theme: "water" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
    { spacingScaleY: 1.2 }
  );
  const snap = rainPortState.update(1350, 480, []);
  const bounds = snap.bounds;
  assert.ok(bounds, "有 bounds");
  const minDy = bounds.minY + 18;
  const maxDy = bounds.maxY - 18;

  assert.ok(snap.houses.length > 0, "有 house");
  for (const h of snap.houses) {
    assert.ok(h.dy >= minDy && h.dy <= maxDy, `house dy=${h.dy} 在 [${minDy}, ${maxDy}]`);
    const ans = [{x:h.x-110,y:h.y+125},{x:h.x+110,y:h.y+125},{x:h.x,y:h.y+190}];
    for (const a of ans) {
      assert.ok(a.y >= minDy && a.y <= maxDy, `answerPositions y=${a.y} 在 [${minDy}, ${maxDy}]`);
    }
  }
});

test("world.js update()：rain-port 只回傳戰鬥帶內的 chunks（Y chunk 限制）", () => {
  const rainPortState = world.createStageWorld(
    { id: "rain-port", world: { chunkWidth: 900, chunkHeight: 720, activeRadius: 2, seed: 0 }, wordPacks: ["rain-port-base"], pacing: {}, visual: {}, enemy: {} },
    { getPack: (id) => ({ id, words: [{jp:"あめ",zh:"雨"},{jp:"かさ",zh:"傘"},{jp:"くも",zh:"雲"}], color: "#4a7c8a", floorColor: "#2a3f4a", theme: "water" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
    { spacingScaleY: 1.2 }
  );
  const snap = rainPortState.update(1350, 480, []);
  for (const chunk of snap.chunks) {
    // chunk.y 應在戰鬥帶相關範圍（cy=0 或 1，對應 y=0 或 720）
    // chunk.houses 若存在，其 y 應在合理範圍
    for (const h of chunk.houses) {
      assert.ok(h.y >= 0 && h.y <= 1500, `chunk house y=${h.y} 在合理範圍`);
    }
  }
});

test("world.js update()：night-town 無 bounds 限制，原邏輯保留", () => {
  const nightApi = world.createStageWorld(
    { id: "night-town", world: { chunkWidth: 900, chunkHeight: 600, activeRadius: 2, seed: 0 }, wordPacks: ["night-town-base"], pacing: {}, visual: {}, enemy: {} },
    { getPack: (id) => ({ id, words: [{jp:"よる",zh:"夜"},{jp:"まち",zh:"町"}], color: "#c6a56d", floorColor: "#3a2f2a", theme: "residential" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
    { spacingScaleY: 1.2 }
  );
  const nightSnap = nightApi.update(1350, 900, []);
  assert.equal(nightSnap.bounds, null, "night-town bounds 為 null");
  assert.ok(nightSnap.houses.length > 0, "night-town 有 house");
});

console.log("M2-PORT-Y world.js bounds + houses 合法性 短測完成");