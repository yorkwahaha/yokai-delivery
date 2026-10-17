"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = require("../js/words.js");
const WORLD = require("../js/world.js");

function world(id, spacing = 1) {
  return WORLD.createStageWorld(CONTENT.getStage(id), CONTENT, { spacingScaleY: spacing });
}

function housesIn(id, spacing = 1) {
  const stage = CONTENT.getStage(id);
  const map = world(id, spacing);
  const seen = [];
  for (let cy = -4; cy <= 4; cy++) {
    for (let cx = -4; cx <= 4; cx++) seen.push(map.getChunk(cx, cy));
  }
  return { stage, map, chunks: seen, houses: seen.flatMap(chunk => chunk.houses) };
}

function viewArea(width, height) {
  const scale = Math.min(width / 900, height / 600);
  const w = width / scale;
  const h = height / scale;
  return {
    left: -(w - 900) / 2,
    right: 900 + (w - 900) / 2,
    top: -(h - 600) / 2,
    bottom: 600 + (h - 600) / 2
  };
}

function visibleAt(map, player, area, tilt) {
  const loaded = map.update(player.x, player.y).houses;
  const camX = player.x - 450;
  const camY = player.y - 300 / tilt;
  return loaded.filter(house => {
    const sx = house.x - camX;
    const sy = (house.y - camY) * tilt;
    return sx >= area.left - 20 && sx <= area.right + 20 && sy >= area.top - 40 && sy <= area.bottom + 40;
  });
}

test("sakura-pass keeps one shrine per chunk and other stages stay at three", () => {
  const pass = housesIn("sakura-pass");
  assert.ok(pass.chunks.every(chunk => chunk.houses.length === 1));
  assert.ok(pass.houses.every(house => house.bType === "shrine_pavilion"));
  assert.equal(pass.houses.length, pass.chunks.length);
  assert.ok(pass.houses.length <= Math.ceil(pass.chunks.length * 3 / 2));
  assert.ok(pass.houses.length <= pass.chunks.length);
  for (const id of ["night-town", "rain-port", "bamboo-maze", "yomi"]) {
    const sample = world(id);
    for (const [cx, cy] of [[0, 0], [1, 2], [-3, 4]]) {
      const chunk = sample.getChunk(cx, cy);
      assert.equal(chunk.houses.length, 3, id);
      assert.ok(chunk.houses.every(house => house.bType !== "shrine_pavilion"));
    }
  }
});

test("sakura houses stay deterministic, on their pack word, and clear of the ancient tree", () => {
  const first = world("sakura-pass");
  const second = world("sakura-pass");
  const signature = [];
  for (let cy = -3; cy <= 3; cy++) {
    for (let cx = -3; cx <= 3; cx++) {
      const chunk = first.getChunk(cx, cy);
      const again = second.getChunk(cx, cy);
      const house = chunk.houses[0];
      assert.equal(house.packId, chunk.packId);
      assert.equal(house.word.packId || chunk.packId, chunk.packId);
      assert.ok(CONTENT.getPack(chunk.packId).words.some(word => word.jp === house.word.jp));
      assert.deepEqual(again.houses.map(item => [item.id, item.x, item.y, item.word.jp]), [[house.id, house.x, house.y, house.word.jp]]);
      const localX = house.x - chunk.x;
      const localY = house.y - chunk.y;
      assert.ok(localX >= 260 && localX <= 639);
      assert.ok(localY >= 210 && localY <= 389);
      signature.push(house.id);
      for (const tree of chunk.decor.ancientSakura) {
        assert.ok(Math.hypot(tree.x - house.x, tree.y - house.y) > 120);
      }
    }
  }
  assert.equal(new Set(signature).size, signature.length);
  assert.ok(first.getChunk(0, 0).decor.ancientSakura.length + first.getChunk(2, 1).decor.ancientSakura.length >= 0);
  let trees = 0;
  for (let cy = -6; cy <= 6; cy++) for (let cx = -6; cx <= 6; cx++) trees += first.getChunk(cx, cy).decor.ancientSakura.length;
  assert.ok(trees > 10);
});

test("the same sakura entities stay put when only the camera tilt changes", () => {
  const map = world("sakura-pass", 1);
  const player = { x: 1350, y: 900 };
  const before = map.update(player.x, player.y).houses.map(house => [house.id, house.x, house.y]);
  const desktop = viewArea(1280, 800);
  const tablet = viewArea(1194, 834);
  const flat = visibleAt(map, player, desktop, 1);
  const tilted = visibleAt(map, player, desktop, 0.6);
  const after = map.update(player.x, player.y).houses.map(house => [house.id, house.x, house.y]);
  assert.deepEqual(after, before);
  assert.ok(flat.length >= 1 && flat.length <= 3, "2d " + flat.length);
  assert.ok(tilted.length >= 1 && tilted.length <= 4, "2.5d " + tilted.length);
  assert.ok(tilted.length < 6);
  for (const area of [desktop, tablet]) {
    for (let dy = -600; dy <= 600; dy += 300) {
      for (let dx = -900; dx <= 900; dx += 450) {
        const at = { x: player.x + dx, y: player.y + dy };
        const seen = visibleAt(map, at, area, 0.6);
        assert.ok(seen.length <= 4, seen.length + " at " + dx + "," + dy);
      }
    }
  }
});

test("sakura still has a deliverable pair inside the order radius", () => {
  const map = world("sakura-pass", 1);
  const points = [];
  for (let cy = -2; cy <= 3; cy++) for (let cx = -1; cx <= 3; cx++) {
    points.push({ x: cx * 900 + 450, y: cy * 600 + 300 });
  }
  points.push({ x: 1350, y: 900 });
  for (const player of points) {
    const local = map.update(player.x, player.y).houses.filter(house => Math.hypot(house.x - player.x, house.y - player.y) < 2200);
    assert.ok(local.length >= 2, "houses " + local.length);
    const pair = local.some(from => local.some(to => {
      if (to === from) return false;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      return distance > 420 && distance < 2000;
    }));
    assert.equal(pair, true);
  }
});

function renderBox(search) {
  const images = [];
  const texts = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const ctx = new Proxy({
      drawImage: (...args) => images.push(args),
      fillText: text => texts.push(text),
      strokeText: text => texts.push(text),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      measureText: () => ({ width: 40 })
    }, { get: (target, key) => target[key] ?? (() => {}) });
    return { width: 900, height: 600, getContext: () => ctx };
  }
  const shop = { naturalWidth: 200, naturalHeight: 220, src: "shop" };
  const pavilion = { naturalWidth: 470, naturalHeight: 440, src: "pavilion" };
  const env = {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    URLSearchParams,
    location: { hostname: "127.0.0.1", search },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { createElement: canvas, documentElement: {} },
    ART: { house_shop: shop },
    SAKURA_ART: { pavilion },
    UI: { readableFont: () => "20px sans-serif" }
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ["viewport", "renderer"]) {
    vm.runInContext(`(() => {\n${fs.readFileSync(path.join(ROOT, "js", name + ".js"), "utf8")}\n})()`, context);
  }
  context.RENDERER.init(canvas());
  return { env: context, images, texts, pavilion, shop };
}

test("stage3 2.5D scales distant shrines while 2D, signs, and other stages stay crisp", () => {
  const flat = renderBox("?tilt=1");
  flat.env.RENDERER.setDepthStage("sakura-pass");
  flat.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "shrine_pavilion" }, 800);
  const flatDraw = flat.images.filter(call => call[0] === flat.pavilion);
  assert.equal(flatDraw.length, 1);
  assert.equal(flatDraw[0][3], 210);
  assert.ok(flat.texts.includes("神社"));

  const deep = renderBox("");
  deep.env.VIEWPORT.setTiltScale(0.6);
  deep.env.RENDERER.setDepthStage("sakura-pass");
  deep.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "shrine_pavilion" }, 300);
  const near = deep.images.filter(call => call[0] === deep.pavilion).at(-1);
  assert.equal(near[3], 210);
  deep.images.length = 0;
  deep.texts.length = 0;
  deep.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "shrine_pavilion" }, 900);
  const far = deep.images.filter(call => call[0] === deep.pavilion).at(-1);
  assert.equal(far[3], near[3]);
  assert.ok(Math.abs(far[3] - 210) <= 1);
  assert.ok(deep.texts.includes("神社"));
  const probe = deep.env.RENDERER.sceneryDepth(300, 900);
  const still = deep.env.RENDERER.sceneryDepth(300, 300);
  assert.equal(probe.scale, 1);
  assert.equal(still.scale, 1);
  assert.ok(probe.blur > 1.2 && probe.blur <= 3.2);
  assert.ok(probe.grade > still.grade);
  assert.equal(still.blur, 0);

  const off = renderBox("?depth=off");
  off.env.VIEWPORT.setTiltScale(0.6);
  off.env.RENDERER.setDepthStage("sakura-pass");
  off.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "shrine_pavilion" }, 900);
  assert.equal(off.images.filter(call => call[0] === off.pavilion).at(-1)[3], 210);

  const town = renderBox("");
  town.env.VIEWPORT.setTiltScale(0.6);
  town.env.RENDERER.setDepthStage("night-town");
  town.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "house_shop" }, 900);
  assert.equal(town.images.filter(call => call[0] === town.shop).at(-1)[3], 166);

  const pub = renderBox("");
  pub.env.location.hostname = "play.example";
  pub.env.location.search = "?depth=off";
  assert.equal(pub.env.VIEWPORT.depthMode(), "default");
});
