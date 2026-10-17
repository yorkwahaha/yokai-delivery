"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = require("../js/words.js");
const WORLD = require("../js/world.js");
const hash = buf => createHash("sha256").update(buf).digest("hex");

const files = {
  pavilion: ["assets/img/sakura-pass/shrine_pavilion.webp", "art/stage3-sakura-pass/scene/H_shrine_pavilion.webp"],
  ancient: ["assets/img/sakura-pass/landmark_corrupted_sakura.webp", "art/stage3-sakura-pass/scene/O_corrupted_sakura.webp"]
};

function renderer() {
  const images = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const ctx = new Proxy({
      drawImage: (...args) => images.push(args),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      measureText: () => ({ width: 40 })
    }, { get: (o, k) => o[k] ?? (() => {}) });
    return { width: 900, height: 600, getContext: () => ctx };
  }
  const shop = { naturalWidth: 200, naturalHeight: 220, src: "assets/img/house_shop.png" };
  const env = {
    innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { createElement: canvas },
    ART: { house_shop: shop, house_shrine: shop },
    SAKURA_ART: {},
    SAKURA_ART_STATUS: {},
    UI: { readableFont: () => "20px sans-serif" }
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ["viewport", "renderer"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js", name + ".js"), "utf8"), context);
  }
  context.RENDERER.init(canvas());
  return { env: context, images, shop };
}

test("scene webps are exact copies and listed in the media revisions", () => {
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  for (const [runtime, source] of Object.values(files)) {
    const a = fs.readFileSync(path.join(ROOT, runtime));
    const b = fs.readFileSync(path.join(ROOT, source));
    const digest = hash(a);
    assert.equal(digest, hash(b));
    assert.ok(sw.includes(`"${runtime}": "${digest.slice(0, 24)}"`));
  }
});

test("only sakura-pass uses the pavilion, and ancient trees stay sparse and off the pads", () => {
  const pass = WORLD.createStageWorld(CONTENT.getStage("sakura-pass"), CONTENT);
  const town = WORLD.createStageWorld(CONTENT.getStage("night-town"), CONTENT);
  const port = WORLD.createStageWorld(CONTENT.getStage("rain-port"), CONTENT);
  let trees = 0;
  let chunks = 0;
  for (let cy = -6; cy <= 6; cy++) {
    for (let cx = -6; cx <= 6; cx++) {
      const chunk = pass.getChunk(cx, cy);
      chunks += 1;
      assert.equal(chunk.houses.length, 1);
      assert.ok(chunk.houses.every(house => house.bType === "shrine_pavilion"));
      assert.equal(chunk.decor.torii, false);
      assert.ok(chunk.decor.ancientSakura.length <= 1);
      trees += chunk.decor.ancientSakura.length;
      for (const tree of chunk.decor.ancientSakura) {
        for (const house of chunk.houses) {
          const solid = tree.x > house.x - 48 && tree.x < house.x + 48 && tree.y > house.y - 25 && tree.y < house.y + 45;
          assert.equal(solid, false);
          for (const pad of WORLD.answerPositions(house)) {
            assert.ok(Math.hypot(tree.x - pad.x, tree.y - pad.y) > 80);
          }
        }
      }
    }
  }
  assert.ok(trees > 10 && trees < chunks / 3, "trees " + trees + " chunks " + chunks);
  assert.ok(town.getChunk(0, 0).houses.every(house => house.bType !== "shrine_pavilion"));
  assert.ok(port.getChunk(0, 1).houses.every(house => house.bType === "port_warehouse" || house.bType === "port_fishmonger"));
  assert.equal(town.getChunk(1, 0).decor.ancientSakura.length, 0);
});

test("the pavilion and ancient sakura draw their own images and never a town house", () => {
  const r = renderer();
  const pavilion = { naturalWidth: 470, naturalHeight: 440, src: files.pavilion[0] };
  const ancient = { naturalWidth: 460, naturalHeight: 460, src: files.ancient[0] };
  r.env.SAKURA_ART.pavilion = pavilion;
  r.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "shrine_pavilion" }, 300);
  const drawn = r.images.filter(call => call[0] === pavilion);
  assert.equal(drawn.length, 1);
  assert.equal(r.images.some(call => call[0] === r.shop), false);
  const bw = 210;
  const bh = bw * (440 / 470);
  assert.equal(drawn[0][1], 400 - bw / 2);
  assert.ok(Math.abs(drawn[0][2] - ((300 + 48) - bh * (430 / 440))) < 1e-6);
  r.images.length = 0;
  delete r.env.SAKURA_ART.pavilion;
  r.env.RENDERER.drawHouse({ x: 400, y: 300, bType: "shrine_pavilion" }, 300);
  assert.equal(r.images.some(call => call[0] === r.shop), false);
  r.env.SAKURA_ART.ancientSakura = ancient;
  r.env.RENDERER.drawDecorActor({ ancient: { x: 450, y: 200 } }, 200);
  const tree = r.images.filter(call => call[0] === ancient);
  assert.equal(tree.length, 1);
  const th = 156;
  assert.ok(Math.abs(tree[0][2] - (200 - th * (445 / 460))) < 1e-6);
  r.images.length = 0;
  r.env.RENDERER.drawHouse({ x: 20, y: 20, bType: "house_shop" }, 20);
  assert.equal(r.images.at(-1)[0], r.shop);
});
