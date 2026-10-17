"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const viewport = require("../js/viewport.js");
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !~ ${expected}`);

function withPlace(search, hostname, run) {
  const previous = global.location;
  const width = global.innerWidth, height = global.innerHeight;
  try {
    global.location = { hostname, search };
    global.innerWidth = 900;
    global.innerHeight = 600;
    viewport.get();
    run();
  } finally {
    global.location = previous;
    global.innerWidth = width;
    global.innerHeight = height;
    viewport.setTiltScale(null);
    viewport.setZoomStage("");
  }
}

test("stage3 loopback zoom is whitelisted and other stages stay at 1", () => {
  withPlace("?zoom=1.15", "127.0.0.1", () => {
    viewport.setZoomStage("sakura-pass");
    viewport.setTiltScale(1);
    assert.equal(viewport.worldZoom(), 1);
    viewport.setTiltScale(0.6);
    near(viewport.worldZoom(), 1.15);
    near(viewport.worldBounds().width, 900 / 1.15);
    near(viewport.worldBounds().height, 1000 / 1.15);
    viewport.setZoomStage("night-town");
    assert.equal(viewport.worldZoom(), 1);
    assert.equal(viewport.worldBoundsAtZoom(1).width, 900);
  });
  withPlace("?zoom=1.10", "localhost", () => {
    viewport.setZoomStage("sakura-pass");
    viewport.setTiltScale(0.6);
    near(viewport.worldZoom(), 1.1);
  });
  withPlace("?zoom=2", "127.0.0.1", () => {
    viewport.setZoomStage("sakura-pass");
    viewport.setTiltScale(0.6);
    assert.equal(viewport.selectedWorldZoom(), 1);
  });
  withPlace("?zoom=1.15", "play.example", () => {
    viewport.setZoomStage("sakura-pass");
    viewport.setTiltScale(0.6);
    assert.equal(viewport.worldZoom(), 1);
  });
});

test("projection round-trips and reanchor keeps both axes", () => {
  withPlace("?zoom=1.10", "127.0.0.1", () => {
    viewport.setZoomStage("sakura-pass");
    viewport.setTiltScale(0.6);
    const cam = { x: 640, y: 220 }, shake = { x: 3, y: -2 };
    const world = { x: 880, y: 510 };
    const screen = viewport.worldToScreen(world.x, world.y, cam, shake);
    const back = viewport.screenToWorld(screen.x, screen.y, cam, shake);
    near(back.x, world.x);
    near(back.y, world.y);
    const before = viewport.worldToScreen(world.x, world.y, cam, { x: 0, y: 0 });
    const next = viewport.reanchor(world, cam, 0.6, 1.1, 1, 1);
    viewport.setTiltScale(1);
    const after = viewport.worldToScreen(world.x, world.y, next, { x: 0, y: 0 });
    near(after.x, before.x);
    near(after.y, before.y);
  });
});

test("a roof below the view still expands the draw bounds", () => {
  withPlace("", "127.0.0.1", () => {
    viewport.setZoomStage("sakura-pass");
    viewport.setTiltScale(0.6);
    const cam = { x: 1000, y: 400 };
    const visible = viewport.worldBounds();
    const draw = viewport.drawBounds(cam, { x: 0, y: 0 }, { left: 100, right: 80, top: 240, bottom: 30 }, 0);
    assert.ok(draw.top < cam.y + visible.top);
    assert.ok(draw.bottom > cam.y + visible.bottom);
    assert.ok(draw.left < cam.x + visible.left);
  });
});

test("runtime scenery depth keeps scale 1 while blur still responds", () => {
  const images = [];
  function canvas() {
    const ctx = new Proxy({
      drawImage: (...args) => images.push(args),
      measureText: () => ({ width: 40 }),
      getTransform: () => ({ a: 9 })
    }, { get: (target, key) => target[key] ?? (() => {}) });
    return { width: 900, height: 600, getContext: () => ctx };
  }
  const env = {
    innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    location: { hostname: "127.0.0.1", search: "?zoom=1.15" },
    URLSearchParams,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { createElement: canvas, documentElement: {} },
    ART: {},
    SAKURA_ART: { pavilion: { naturalWidth: 470, naturalHeight: 440, src: "pavilion" } },
    UI: { readableFont: () => "20px sans-serif" }
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ["viewport", "renderer"]) {
    vm.runInContext(`(() => {\n${fs.readFileSync(path.join(ROOT, "js", name + ".js"), "utf8")}\n})()`, context);
  }
  context.RENDERER.init(canvas());
  context.VIEWPORT.setZoomStage("sakura-pass");
  context.VIEWPORT.setTiltScale(0.6);
  context.RENDERER.setDepthStage("sakura-pass");
  const far = context.RENDERER.sceneryDepth(200, 800);
  const nearPoint = context.RENDERER.sceneryDepth(800, 800);
  assert.equal(far.scale, 1);
  assert.equal(nearPoint.scale, 1);
  assert.ok(far.blur > nearPoint.blur);
  assert.ok(far.grade > 0);
  context.RENDERER.drawHouse({ x: 100, y: 200, bType: "shrine_pavilion" }, 800);
  context.RENDERER.drawHouse({ x: 100, y: 800, bType: "shrine_pavilion" }, 800);
  const widths = images.map(call => call[3]);
  assert.equal(widths[0], widths[1]);
  assert.equal(widths[0], 210);
  const game = fs.readFileSync(path.join(ROOT, "js/game.js"), "utf8");
  assert.match(game, /worldBoundsAtZoom\?\.\(1\)/);
  assert.match(game, /scale\(z,z\)/);
  assert.match(game, /reanchor\?\./);
  assert.match(game, /drawFlash\(ctx, viewBounds\(\)\)/);
});
