"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadGame } = require("./helpers/game-runtime.cjs");

const ROOT = path.resolve(__dirname, "..");

function scene() {
  const g = loadGame({ stage: "rain-port", seed: 11 });
  g.startRun();
  g.stopSpawns();
  g.clearOrders();
  g.clearEnemies();
  for (const id of ["katana", "needle", "ofuda", "barrier", "fire", "thunder", "boom"]) g.setWeaponRank(id, 0);
  return g;
}

function nearestHouse(g) {
  const p = g.snapshot();
  const houses = g.housesNow();
  assert.ok(houses.length, "rain-port must have a house to form the corner");
  return houses.reduce((best, h) => Math.hypot(h.x - p.x, h.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? h : best);
}

function runChase(g, enemy, seconds) {
  const dt = 1 / 30;
  let maxStep = 0;
  let blockedFrames = 0;
  const x0 = enemy.x, y0 = enemy.y;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const prevX = enemy.x, prevY = enemy.y;
    g.update(dt);
    const moved = Math.hypot(enemy.x - prevX, enemy.y - prevY);
    if (moved > maxStep) maxStep = moved;
    if (g.blocked(enemy.x, enemy.y, 16)) blockedFrames++;
  }
  return {
    maxStep,
    blockedFrames,
    dx: enemy.x - x0,
    dy: enemy.y - y0,
    dist: Math.hypot(g.snapshot().x - enemy.x, g.snapshot().y - enemy.y)
  };
}

test("a shiome stuck on a house face walks around without teleporting; a sealed boss does not", () => {
  const g = scene();
  const house = nearestHouse(g);
  const enemyY = house.y + 65;
  g.placeAt(house.x, enemyY - 233);
  g.update(1 / 30);
  const live = g.housesNow().find(h => h.id === house.id);
  assert.ok(live, "the blocking house must stay loaded");
  const startY = live.y + 65;
  const shiome = {
    x: live.x, y: startY, type: "shiome", hp: 40, max: 40, speed: 90,
    pose: "idle", shiomeCd: 30, flash: 0, wob: 0
  };
  const boss = {
    x: live.x, y: startY, type: "boss", hp: 400, max: 400, speed: 90,
    shield: true, quizClosed: true, introduced: true, word: live.word,
    attackCd: Infinity, flash: 0, wob: 0, final: true
  };
  g.snapshot().enemies.push(shiome, boss);
  assert.equal(g.blocked(shiome.x, shiome.y, 16), false, "spawn must start outside the wall");
  const before = Math.hypot(g.snapshot().x - shiome.x, g.snapshot().y - shiome.y);
  const moved = runChase(g, shiome, 4);
  assert.ok(Math.abs(moved.dx) > 40, "shiome should leave the dead face, dx=" + moved.dx.toFixed(1) + " dist " + before.toFixed(1) + "->" + moved.dist.toFixed(1));
  assert.ok(moved.maxStep <= 90 / 30 + 0.2, "no teleport, max step " + moved.maxStep.toFixed(2));
  assert.equal(moved.blockedFrames, 0, "slide must stay outside solids");
  assert.ok(Math.abs(boss.x - live.x) < 8, "sealed boss keeps the old chase and does not take the detour");
  assert.equal(boss.shield, true);
});

test("an open chase still walks straight at the player", () => {
  const g = scene();
  const house = nearestHouse(g);
  const shiome = {
    x: house.x, y: house.y + 140, type: "shiome", hp: 40, max: 40, speed: 80,
    pose: "idle", shiomeCd: 30, flash: 0, wob: 0
  };
  g.placeAt(house.x, house.y + 280);
  g.snapshot().enemies.push(shiome);
  const moved = runChase(g, shiome, 1.2);
  assert.ok(moved.dy > 40, "open ground should close on the player, dy=" + moved.dy.toFixed(1));
  assert.ok(Math.abs(moved.dx) < 4, "open ground should not start a detour, dx=" + moved.dx.toFixed(1));
});

function renderer() {
  const images = [], shapes = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    drawImage: (...a) => images.push(a),
    arc: (...a) => shapes.push(["arc", ...a]),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    measureText: () => ({ width: 40 })
  }, { get: (o, k) => o[k] ?? (() => {}) });
  const canvas = () => ({ width: 900, height: 600, getContext: () => ctx });
  const commonBoss = { naturalWidth: 256, naturalHeight: 340, src: "assets/img/boss.webp" };
  const env = {
    innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    document: { createElement: canvas },
    ART: { boss: commonBoss },
    PORT_ENEMIES: {},
    UI: { readableFont: () => "20px sans-serif" }
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ["viewport", "renderer"]) {
    const filename = path.join(ROOT, "js", name + ".js");
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  }
  context.RENDERER.init(canvas());
  return { env: context, images, shapes, commonBoss };
}

test("a rain-port boss with no approved image draws no body and no common boss", () => {
  const r = renderer();
  const e = { x: 100, y: 100, type: "boss", umibozu: true, shield: true, pose: "attack", dying: false };
  r.env.RENDERER.drawMonster(e, { x: 40, y: 100 }, 0);
  assert.equal(r.images.some(call => call[0] === r.commonBoss), false);
  assert.equal(r.images.length, 0, "missing approved art draws no body");
  assert.ok(r.shapes.some(s => s[0] === "arc" && s[3] === 68), "seal ring stays");
  r.images.length = 0;
  r.shapes.length = 0;
  e.shield = false;
  r.env.RENDERER.drawMonster(e, { x: 40, y: 100 }, 0.2);
  assert.equal(r.images.length, 0);
  assert.equal(r.shapes.some(s => s[0] === "arc"), false, "no geometric stand-in");
  const idle = { naturalWidth: 350, naturalHeight: 330, src: "assets/img/rain-port/enemies/boss_ikari_umibozu_idle.webp" };
  r.env.PORT_ENEMIES.bossIdle = idle;
  e.shield = true;
  r.env.RENDERER.drawMonster(e, { x: 40, y: 100 }, 0.4);
  assert.equal(r.images.at(-1)[0], idle);
  const night = { x: 20, y: 20, type: "boss", shield: false, pose: "idle" };
  r.env.RENDERER.drawMonster(night, { x: 80, y: 20 }, 0);
  assert.equal(r.images.at(-1)[0], r.commonBoss);
});
