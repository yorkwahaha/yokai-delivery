"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const hash = b => createHash("sha256").update(b).digest("hex");
const roles = {
  dirt: ["assets/img/sakura-pass/ground_mountain_dirt.webp", "art/stage3-sakura-pass/scene/G_mountain_dirt.webp"],
  steps: ["assets/img/sakura-pass/ground_sakura_steps.webp", "art/stage3-sakura-pass/scene/G_sakura_steps.webp"],
  transH: ["assets/img/sakura-pass/ground_trans_dirt_to_steps_h.webp", "art/stage3-sakura-pass/scene/G_trans_dirt_to_steps_h.webp"]
};

function assets() {
  const images = [];
  class Image { constructor() { images.push(this); } }
  const env = { Image, Audio: class { addEventListener() {} }, console };
  env.window = env;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/assets.js"), "utf8"), env);
  return { env, images };
}

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
    return { width: 0, height: 0, getContext: () => ctx };
  }
  const env = {
    innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { createElement: canvas },
    ART: { ground_dirt: { naturalWidth: 512, naturalHeight: 512, src: "assets/img/scenery/ground_dirt.webp" } },
    SAKURA_ART: {},
    UI: { readableFont: () => "20px sans-serif" }
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ["viewport", "renderer"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js", name + ".js"), "utf8"), context);
  }
  context.RENDERER.init(canvas());
  return { env: context, images };
}

test("the three runtime grounds are exact copies and the vertical preview is not installed", () => {
  for (const [runtime, source] of Object.values(roles)) {
    const a = fs.readFileSync(path.join(ROOT, runtime));
    const b = fs.readFileSync(path.join(ROOT, source));
    assert.equal(hash(a), hash(b), runtime);
    assert.equal(a.length, b.length);
  }
  assert.equal(fs.existsSync(path.join(ROOT, "assets/img/sakura-pass/ground_trans_dirt_to_steps_v.webp")), false);
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  for (const [runtime] of Object.values(roles)) {
    const digest = hash(fs.readFileSync(path.join(ROOT, runtime))).slice(0, 24);
    assert.ok(sw.includes(`"${runtime}": "${digest}"`), runtime);
  }
  assert.equal(sw.includes("ground_trans_dirt_to_steps_v"), false);
});

test("sakura grounds load only when that stage starts, and core loading ignores them", () => {
  const a = assets();
  a.env.loadGameArt();
  assert.equal(a.images.some(img => String(img.src || "").includes("sakura-pass")), false);
  a.env.refreshSakuraArt();
  const urls = a.images.map(img => String(img.src || "").split("?")[0]);
  for (const [runtime] of Object.values(roles)) assert.ok(urls.includes(runtime), runtime);
  assert.equal(urls.filter(url => url.includes("sakura-pass")).length, 3);
  assert.equal(urls.some(url => url.includes("trans_dirt_to_steps_v")), false);
});

test("dirt, one horizontal transition and steps follow world X, not chunk edges", () => {
  const r = renderer();
  const roleAt = x => r.env.sakuraTileRole(Math.floor(x / 512));
  assert.equal(roleAt(899), roleAt(901));
  assert.equal(roleAt(1799), "transH");
  assert.equal(roleAt(1801), "transH");
  assert.equal(roleAt(1535), "dirt");
  assert.equal(roleAt(1536), "transH");
  assert.equal(roleAt(2047), "transH");
  assert.equal(roleAt(2048), "steps");
  const words = fs.readFileSync(path.join(ROOT, "js/words.js"), "utf8");
  assert.match(words, /"sakura-pass": Object\.freeze\(\{[\s\S]*?ground: "ground_dirt"/);
  assert.match(words, /"rain-port": Object\.freeze\(\{[\s\S]*?ground: "ground"/);
});

test("sakura-pass waits for all three images, then paints them; other stages do not", () => {
  const r = renderer();
  const dirt = { naturalWidth: 512, naturalHeight: 512, src: roles.dirt[0] };
  const transH = { naturalWidth: 512, naturalHeight: 512, src: roles.transH[0] };
  const steps = { naturalWidth: 512, naturalHeight: 512, src: roles.steps[0] };
  r.env.SAKURA_ART.dirt = dirt;
  r.env.RENDERER.setCam(1520, 900);
  r.env.RENDERER.drawGround(0, 600, [], "ground_dirt", "sakura-pass");
  assert.equal(r.images.some(call => call[0] === dirt), false, "a partial load must keep the safe ground");
  r.env.SAKURA_ART.transH = transH;
  r.env.SAKURA_ART.steps = steps;
  const before = r.images.length;
  r.env.RENDERER.drawGround(0.1, 600, [], "ground_dirt", "sakura-pass");
  const painted = r.images.slice(before).filter(call => call[0] === dirt || call[0] === transH || call[0] === steps);
  const at = dx => painted.filter(call => call[5] === dx).map(call => call[0]);
  assert.ok(at(1024).length && at(1024).every(img => img === dirt));
  assert.ok(at(1536).length && at(1536).every(img => img === transH));
  assert.ok(at(2048).length && at(2048).every(img => img === steps));
  const other = r.images.length;
  r.env.RENDERER.drawGround(0.2, 600, [], "ground_dirt", "night-town");
  assert.equal(r.images.slice(other).some(call => call[0] === dirt || call[0] === transH || call[0] === steps), false);
  const port = r.images.length;
  r.env.RENDERER.drawGround(0.3, 600, [], "ground_dirt", "rain-port");
  assert.equal(r.images.slice(port).some(call => call[0] === dirt || call[0] === transH || call[0] === steps), false);
});
