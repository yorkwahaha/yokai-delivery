const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function createMockCtx() {
  const calls = [];
  const textCalls = [];
  return {
    calls,
    textCalls,
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    closePath: () => {},
    arc: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: (x, y, w, h) => { calls.push({ type: "fillRect", x, y, w, h }); },
    strokeRect: (x, y, w, h) => { calls.push({ type: "strokeRect", x, y, w, h }); },
    roundRect: () => {},
    drawImage: () => {},
    clip: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: (str) => ({ width: (str || "").length * 8 }),
    fillText: (str, x, y) => { textCalls.push(str); },
    strokeText: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1
  };
}

// Mock browser globals for Canvas and DOM
global.window = global;
global.document = {
  getElementById: () => ({ getBoundingClientRect: () => ({ width: 900 }) }),
  createElement: () => ({
    getContext: () => createMockCtx(),
    width: 0,
    height: 0
  })
};
global.Image = class {
  constructor() {
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.complete = false;
  }
};
global.ART = {};
global.STORE = {
  isStageCompleted: (id) => false,
  isStageUnlocked: (id) => id === "night-town",
  getStageStats: () => ({ bestScore: 0 })
};
global.CONTENT = {
  getStage: (id) => ({ id, implemented: id === "night-town", unlockedByDefault: id === "night-town" })
};
global.VIEWPORT = {
  bounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
  hudBounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
  get: () => ({ scale: 1 })
};

const OVERWORLD = require("../js/overworld.js");
const UI = require("../js/ui.js");

test("M1.1-UI-1: Overworld night-town orange fallback box removed, drawFrame approved path used", () => {
  const overworldSrc = fs.readFileSync(path.join(__dirname, "../js/overworld.js"), "utf8");
  assert.ok(!overworldSrc.includes("#d98d4e"), "Orange box #d98d4e must not exist in overworld.js");

  const assetsSrc = fs.readFileSync(path.join(__dirname, "../js/assets.js"), "utf8");
  assert.ok(assetsSrc.includes('"map_night_town_v1"'), "map_night_town_v1 must be in OVERWORLD_MAP_ASSET_NAMES");
  assert.ok(assetsSrc.includes('"map_rain_port_v1"'), "map_rain_port_v1 must be in OVERWORLD_MAP_ASSET_NAMES");

  // Verify drawFrame is called when landmarkArt is present
  const calls = [];
  global.ART.map_night_town_v1 = { naturalWidth: 1440, naturalHeight: 960, complete: true };
  global.RENDERER = {
    drawFrame: (ctx, img, key, index) => { calls.push({ key, index }); }
  };

  const fakeCtx = createMockCtx();
  const state = OVERWORLD.createState("gate");
  OVERWORLD.draw(fakeCtx, state, 1.0, 0);

  assert.ok(calls.some(c => c.key === "map_night_town_v1"), "drawFrame must be called for map_night_town_v1");
  delete global.ART.map_night_town_v1;
  delete global.RENDERER;
});

test("M1.1-UI-2: Overworld pan bounds, drag-pan API and player facing", () => {
  const state = OVERWORLD.createState("gate");
  assert.equal(state.userPanned, false, "Initial userPanned should be false");

  const initialCamX = state.camX;
  const initialCamY = state.camY;

  // Pan by 50, 30
  OVERWORLD.pan(state, 50, 30);
  assert.equal(state.userPanned, true, "pan() should set userPanned to true");
  assert.equal(state.camX, initialCamX + 50);
  assert.equal(state.camY, initialCamY + 30);

  // Pan past limits should clamp
  OVERWORLD.pan(state, 99999, 99999);
  assert.ok(state.camX <= OVERWORLD.MAP_W, "camX should clamp to MAP_W bound");
  assert.ok(state.camY <= OVERWORLD.MAP_H, "camY should clamp to MAP_H bound");

  // MoveTo should reset userPanned
  const node = OVERWORLD.NODES.find(n => n.id === "way_town_bridge");
  if (node) {
    OVERWORLD.moveTo(state, "way_town_bridge");
    assert.equal(state.userPanned, false, "moveTo should reset userPanned so camera follows courier");
  }
});

test("M1.1-UI-3: Browse arrow buttons removed from overworld draw output", () => {
  const overworldSrc = fs.readFileSync(path.join(__dirname, "../js/overworld.js"), "utf8");
  // browseButtons function is preserved for legacy tests
  assert.equal(typeof OVERWORLD.browseButtons, "function");

  // But the arrow loop inside draw() has been removed
  assert.ok(!overworldSrc.includes('button.id === "previous" ? "◀" : "▶"'), "Draw should not render ◀ / ▶ browse buttons");
});

test("M1.1-UI-4: Boss HP Bar is shortened and lifted above passives without hiding passive icons", () => {
  const viewports = [
    { w: 1000, h: 700 },
    { w: 844, h: 390 },
    { w: 1024, h: 640 }
  ];

  for (const vp of viewports) {
    global.VIEWPORT.hudBounds = () => ({ left: 0, top: 0, right: vp.w, bottom: vp.h, width: vp.w, height: vp.h });
    global.VIEWPORT.bounds = () => ({ left: 0, top: 0, right: vp.w, bottom: vp.h, width: vp.w, height: vp.h });

    const layout = UI.bossQuizLayout(3);
    // Shortened width
    assert.ok(layout.bar.w <= 360, `Boss bar width (${layout.bar.w}) should be shortened to <= 360 on ${vp.w}x${vp.h}`);
    assert.ok(layout.bar.w >= 280, `Boss bar width (${layout.bar.w}) must remain readable on ${vp.w}x${vp.h}`);

    // Vertical clearance: Boss bar bottom must sit above the footer row (bottom - 80px)
    const barBottom = layout.bar.y + layout.bar.h;
    const footerTop = vp.h - (vp.h <= 480 ? 70 : 82);
    assert.ok(barBottom <= footerTop, `Boss bar bottom (${barBottom}) must be above footer top (${footerTop}) on ${vp.w}x${vp.h}`);
  }

  // Verify that passives in drawHudBase are NOT artificially hidden when Boss is active
  const uiSrc = fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8");
  assert.ok(!uiSrc.includes("bossLeftLimit"), "bossLeftLimit must not artificially cap passive display capacity");
});

test("M1.1-UI-5: HUD displays delivery count with '件' and removes in-game score diamond", () => {
  const fakeCtx = createMockCtx();
  global.VIEWPORT.hudBounds = () => ({ left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 });
  global.VIEWPORT.bounds = () => ({ left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 });

  UI.drawHudClassic(
    fakeCtx,
    { hp: 100, max: 100, oil: 100, x: 100, y: 100 }, // P
    100, // oil
    100, // maxOil
    10, // elapsed
    120, // dawnTime
    18, // delivered
    0, // failed
    1380, // score
    1, // level
    0, // xp
    100, // xpNeed
    null, // job
    0, // hintT
    [], // orders
    null, // inter
    null, // bossQ
    false, // touch
    null, // joy
    { x: 0, y: 0, w: 40, h: 40 }, // btnE
    { x: 0, y: 0, w: 40, h: 40 }, // btnD
    { x: 0, y: 0, w: 40, h: 40 }, // btnPause
    {}, // WL
    {}, // WI
    {}, // b
    0, // nameT
    6 // goalDeliveries
  );

  assert.ok(fakeCtx.textCalls.some(t => String(t).includes("18件")), "Classic HUD must display '18件'");
  assert.ok(!fakeCtx.textCalls.some(t => String(t) === "18/6"), "Classic HUD must not display '18/6'");
  assert.ok(!fakeCtx.textCalls.some(t => String(t) === "1380"), "In-game score 1380 must be hidden from classic HUD");
});
