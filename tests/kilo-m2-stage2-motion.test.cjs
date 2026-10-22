"use strict";
// M2-HF-K Phase1：Stage2 rain-port 運動狀態 + LAMPS 腳底 solid 驗收（Node 短測，無 Chrome）
// 驗證：真移動方向記錄/保持、停止/凍結不抖轉、LAMPS 腳底 solid/no-spawn
// 使用真 production blocked/VM update，不手抄函式
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const GAME_PATH = path.join(__dirname, "..", "js", "game.js");
const WORLD_PATH = path.join(__dirname, "..", "js", "world.js");

// 先建立 world.js 環境
function makeWorldEnv() {
  const env = { window: {}, Math, Object, Array, Number, String, Set, Map };
  vm.runInNewContext(fs.readFileSync(WORLD_PATH, "utf8"), env);
  return env.window.WORLD;
}

// 最小完整 stubs（game.js 頂層需要的所有全域）
function makeStubs() {
  const RENDERER = {
    init: () => {},
    getCtx: () => ({
      save: () => {}, restore: () => {}, translate: () => {}, scale: () => {}, rotate: () => {},
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {}, fill: () => {},
      stroke: () => {}, fillRect: () => {}, strokeRect: () => {}, roundRect: () => {},
      drawImage: () => {}, measureText: () => ({ width: 0 }), fillText: () => {},
      strokeText: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }), clip: () => {},
      globalAlpha: 1, lineWidth: 1, strokeStyle: "#000", fillStyle: "#000",
      font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic",
      lineCap: "butt", lineJoin: "miter", shadowColor: "transparent",
      shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0
    }),
    resize: () => {}, getCam: () => ({ x: 0, y: 0 }), triggerShake: () => {}, renderLighting: () => {}
  };

  return {
    window: {},
    document: {
      getElementById: (id) => {
        if (id === "game") {
          return { getBoundingClientRect: () => ({ width: 900, height: 600 }), width: 900, height: 600 };
        }
        return { getBoundingClientRect: () => ({ width: 900, height: 600 }) };
      },
      addEventListener: () => {},
      fonts: { check: () => true, load: async () => {} }
    },
    location: { search: "" },
    URLSearchParams,
    Date: { now: () => Date.now() },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    localStorage: { getItem: () => null, setItem: () => {} },
    HTMLElement: class {},
    CanvasRenderingContext2D: class {},
    RENDERER: RENDERER,
    CONTROLS: { mount: () => {}, label: (a) => a },
    AUDIO: { prepareMusic: () => {}, isMuted: () => false, warningPulse: () => {} },
    HAPTICS: { dash: () => {}, damage: () => {}, shield: () => {}, hit: () => {}, pickup: () => {}, deliverSuccess: () => {}, deliverWrong: () => {}, bossDefeat: () => {}, levelUp: () => {}, warning: () => {} },
    UI: { MENU_BTNS: [], PAUSE_BTNS: [], EXIT_BTNS: [], END_BTNS: [], pressButton: () => {} },
    VIEWPORT: {
      bounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
      hudBounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
      get: () => ({ scale: 1, width: 900, height: 600, offsetX: 0, offsetY: 0 }),
      tiltScale: () => 1,
      worldBounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
      worldZoom: () => 1,
      spacingScaleY: () => 1.2,
      upright: (ctx, x, y, draw) => draw()
    },
    FX: { glow: () => {} },
    GAME_CONFIG: {
      RUN_SECONDS: 600, GOAL_DELIVERIES: 6, BOSS_TIMES: [180, 360, 480, 540],
      SURGE_FIRST: 30, SURGE_INTERVAL: 60,
      enemyTier: (t) => 1, spawnInterval: (t) => 2, spawnCount: (t) => 1,
      chaseStep: (d, spd, dt) => Math.min(spd * dt, d)
    },
    STORY: { get: () => ({ bossTitle: "大妖" }) },
    BOSS_AI: { step: () => ({}) },
    ART: {}, ART_READY: true, MAP_ART_READY: true,
    addEventListener: () => {},  // 全域 addEventListener
    WORLD: { createStageWorld: () => ({}) }  // 測試不需要真 WORLD，game.js 頂層只需存在
  };
}

// 建立 game.js 環境
function makeGameEnv(worldState) {
  const stubs = makeStubs();
  const env = { ...stubs, window: { ...stubs.window } };
  // 將 stubs 掛到 window
  for (const key of Object.keys(stubs)) {
    if (key !== "window") env.window[key] = stubs[key];
  }
  env.window.WORLD_STATE = worldState;
  env.window.CONTENT = {
    getStage: (id) => ({ id, pacing: { runSeconds: 600, goalDeliveries: 6, bossTimes: [180, 360, 480, 540], spawnIntervalScale: 1, spawnCountBonus: 0 }, visual: {}, enemy: { speedScale: 1, shooterChance: 0.14, shots: true }, world: { chunkWidth: 900, chunkHeight: 720, activeRadius: 2, seed: 0 }, wordPacks: ["rain-port-base"], start: { x: 1350, y: 900 } }),
    getStageWords: () => [],
    getPack: (id) => ({ id, words: [{jp:"あめ",zh:"雨"},{jp:"かさ",zh:"傘"},{jp:"くも",zh:"雲"}], color: "#4a7c8a", floorColor: "#2a3f4a", theme: "water" }),
    STAGES: {}, WORD_PACKS: {}
  };
  env.window.STORE = { data: {}, getStageStats: () => ({ attempts: 0 }) };

  vm.runInNewContext(fs.readFileSync(GAME_PATH, "utf8"), env);
  return env;
}

// 共享環境建構
const world = makeWorldEnv();

// night-town 有 lamps（驗證 LAMPS solid）
const nightTownState = world.createStageWorld(
  { id: "night-town", world: { chunkWidth: 900, chunkHeight: 600, activeRadius: 2, seed: 0 }, wordPacks: ["night-town-base"], pacing: {}, visual: {}, enemy: {} },
  { getPack: (id) => ({ id, words: [{jp:"よる",zh:"夜"}], color: "#c6a56d", floorColor: "#3a2f2a", theme: "residential" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
  { spacingScaleY: 1.2 }
);
const nightSnap = nightTownState.update(1350, 900, []);

// rain-port 原 lamps 空（驗證不新增燈籠）
const rainPortState = world.createStageWorld(
  { id: "rain-port", world: { chunkWidth: 900, chunkHeight: 720, activeRadius: 2, seed: 0 }, wordPacks: ["rain-port-base"], pacing: {}, visual: {}, enemy: {} },
  { getPack: (id) => ({ id, words: [{jp:"あめ",zh:"雨"},{jp:"かさ",zh:"傘"},{jp:"くも",zh:"雲"}], color: "#4a7c8a", floorColor: "#2a3f4a", theme: "water" }), getStageWords: () => [], STAGES: {}, WORD_PACKS: {} },
  { spacingScaleY: 1.2 }
);
const rainSnap = rainPortState.update(1350, 900, []);

const gameEnv = makeGameEnv(nightTownState);
const blocked = gameEnv.blocked;
const update = gameEnv.update;
const spawnEnemy = gameEnv.spawnEnemy;
const P = gameEnv.P;

test("world.js night-town：LAMPS 來源非空、rain-port lamps 為空", () => {
  assert.ok(nightSnap.lamps.length > 0, "night-town 有 lamps");
  assert.equal(rainSnap.lamps.length, 0, "rain-port 原 lamps 空，不新增");
});

test("game.js syncWorld：LAMPS 轉為 lampSolids 併入 solids（44px 腳底，中心 l.y+8）", () => {
  // 驗證 solids 包含燈籠 solid
  const lampSolids = gameEnv.solids.filter(s => s.isLamp);
  assert.ok(lampSolids.length > 0, "solids 應包含 lampSolids");
  for (const ls of lampSolids) {
    assert.ok(ls.isLamp, "標記 isLamp=true");
    assert.equal(ls.x1 - ls.x0, 44, "燈籠寬 44 (halfW 22)");
    assert.equal(ls.y1 - ls.y0, 44, "燈籠高 44 (halfH 22)");
    const srcLamp = nightSnap.lamps.find(l => Math.abs(l.x - (ls.x0 + 22)) < 1);
    assert.ok(srcLamp, "對應原始 lamp");
    assert.equal(ls.y0, srcLamp.y - 14, "y0 = l.y - 14 (腳點 l.y+8 向上 22)");
    assert.equal(ls.y1, srcLamp.y + 30, "y1 = l.y + 30 (腳點 l.y+8 向下 22)");
  }
});

test("真 production blocked：燈籠腳底阻擋、house 原界線保持 70 高度", () => {
  const houseSolid = gameEnv.solids.find(s => !s.isLamp && s.y1 - s.y0 === 70);
  assert.ok(houseSolid, "一般 house solid 高度 70 (y0:-25, y1:+45)");
  const lampSolid = gameEnv.solids.find(s => s.isLamp);
  assert.ok(lampSolid, "存在 lamp solid");
  const r = 18;
  assert.ok(blocked(lampSolid.x0 + 22, lampSolid.y0 + 22, r), "燈籠中心阻擋");
  assert.ok(blocked(houseSolid.x0, houseSolid.y0, r), "house 左上阻擋");
  assert.ok(blocked(houseSolid.x1, houseSolid.y1, r), "house 右下阻擋");
});

test("真 game VM：敵人移動更新 faceAng、freeze/knockback/revealing 不重置", () => {
  spawnEnemy(1, 300, 0);
  let e = gameEnv.enemies[0];
  assert.ok(e, "敵人已生成");
  P.x = e.x + 200; P.y = e.y;
  update(0.1, false);
  const movedFaceAng = e.faceAng;
  assert.ok(e.walking, "移動時 walking=true");
  assert.ok(Math.abs(movedFaceAng - 0) < 0.1, "向右移動 faceAng≈0");
  e.freezeT = 1; e.freezeEnds = gameEnv.elapsed + 1;
  update(0.1, false);
  assert.equal(e.faceAng, movedFaceAng, "freeze 保持 faceAng 不變");
  assert.ok(!e.walking, "freeze 時 walking=false");
  e.freezeT = 0; delete e.freezeEnds;
  gameEnv.knockback(e, 50, { x: e.x - 100, y: e.y });
  const preKnockFaceAng = e.faceAng;
  update(0.1, false);
  assert.equal(e.faceAng, preKnockFaceAng, "knockback 保持 faceAng 不變");
  e.revealT = 1;
  update(0.1, false);
  assert.equal(e.faceAng, preKnockFaceAng, "revealing 保持 faceAng 不變");
  gameEnv.state = "pause";
  update(0.1, false);
  assert.equal(e.faceAng, preKnockFaceAng, "pause 保持 faceAng 不變");
  gameEnv.state = "play";
});

test("spawnEnemy 入口：不生成在 lamp solid 內、不生成在 house solid 內", () => {
  gameEnv.enemies.length = 0;
  for (let i = 0; i < 30; i++) {
    spawnEnemy(1, 300, Math.random() * 6.283);
    const e = gameEnv.enemies[gameEnv.enemies.length - 1];
    assert.ok(e, "敵人生成成功");
    const ws2 = nightTownState.update(e.x, e.y, []);
    for (const s of ws2.solids) {
      const dx = Math.abs(e.x - (s.x0 + s.x1) / 2);
      const dy = Math.abs(e.y - (s.y0 + s.y1) / 2);
      const halfW = (s.x1 - s.x0) / 2;
      const halfH = (s.y1 - s.y0) / 2;
      assert.ok(dx > halfW + 16 || dy > halfH + 16,
        `敵人不生成在 solid 內 (type: ${s.isLamp ? "lamp" : "house"})`);
    }
    gameEnv.enemies.pop();
  }
});

test("rain-port：無 LAMPS，solids 僅 house、detour 完整保留", () => {
  const rainGameEnv = makeGameEnv(rainPortState);
  const rainSolids = rainGameEnv.solids;
  const lampSolids = rainSolids.filter(s => s.isLamp);
  assert.equal(lampSolids.length, 0, "rain-port 無 lampSolids（原 lamps 空）");
  const houseSolids = rainSolids.filter(s => !s.isLamp);
  assert.ok(houseSolids.length > 0, "rain-port 僅 house solids");
  const src = fs.readFileSync(GAME_PATH, "utf8");
  assert.match(src, /e\.stuckT\s*=/, "保留 stuckT");
  assert.match(src, /e\.detourT\s*=/, "保留 detourT");
  assert.match(src, /e\.detourX\s*=/, "保留 detourX");
  assert.match(src, /e\.detourY\s*=/, "保留 detourY");
});

console.log("M2-HF-K Phase1 LAMPS solid + 運動狀態 真 VM 短測完成");