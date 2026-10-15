'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const URL = 'assets/img/rain-port/ground_stone_wood_transition_v2.webp';
const SOURCE = 'art/stage2-rain-port/scene/G_stone_wood_transition_v2.webp';
const SHA = '8ba771c198b48fb601cfc3893d702c8e9540c11b3bf3b11e02def9ea91648215';
const SY = 253;
const SH = 72;
const CENTER = 271;
const NORTH = CENTER - SY;
const SOUTH = SH - NORTH;

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function loadRenderer(width = 1280, height = 800) {
  const images = [];
  const scales = [];
  const gradient = { addColorStop() {} };
  const canvases = [];
  function canvas() {
    const fills = [];
    const ctx = new Proxy({
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      fillRect: (...args) => fills.push(args),
      scale: (...args) => scales.push(args),
      drawImage: (...args) => images.push(args),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      measureText: () => ({ width: 40 })
    }, { get: (target, key) => target[key] ?? (() => {}) });
    const c = { width: 0, height: 0, getContext: () => ctx, fills };
    canvases.push(c);
    return c;
  }
  const env = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { createElement: canvas },
    ART: {},
    UI: { readableFont: () => '20px sans-serif' }
  };
  env.window = env;
  const context = vm.createContext(env);
  vm.runInContext(fs.readFileSync('js/viewport.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/renderer.js', 'utf8'), context);
  context.RENDERER.init(canvas());
  context.VIEWPORT.setTiltScale(0.6);
  return { env: context, canvases, images, scales };
}

function tile() {
  return { complete: true, naturalWidth: 512, naturalHeight: 512, currentSrc: 'fixture' };
}

function arm(r, ready = true) {
  const transition = {
    complete: ready,
    naturalWidth: ready ? 512 : 0,
    naturalHeight: ready ? 512 : 0,
    currentSrc: URL
  };
  r.env.ART.ground_dirt = tile();
  r.env.PORT_ART = { stone: tile(), dock: tile(), stoneVar1: tile(), woodVar1: tile(), stoneWoodV2: transition };
  return transition;
}

function shore(x, y = 0, h = 720) {
  return { x, y, w: 900, h, decor: { port: { shore: true } } };
}

function transitionDraws(r, transition) {
  return r.images.filter(args => args[0] === transition);
}

test('runtime bytes match the approved v2 and the service worker revision', () => {
  assert.equal(sha(URL), SHA);
  assert.equal(sha(SOURCE), SHA);
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(sw, new RegExp('"' + URL + '"\\s*:\\s*"' + SHA.slice(0, 24) + '"'));
});

test('both horizontal seams crop the blend band and keep the world x phase', () => {
  const r = loadRenderer();
  const transition = arm(r);
  const chunks = [shore(0), shore(900)];
  r.env.RENDERER.setCam(0, 250);
  r.env.RENDERER.drawGround(0, 600, chunks, 'ground_dirt', 'rain-port');
  const draws = transitionDraws(r, transition);
  assert.ok(draws.length > 0);
  for (const args of draws) {
    assert.deepEqual(args.slice(1, 5), [0, SY, 512, SH]);
    assert.equal(args[5] % 512, 0, 'tile origin restarts inside a 512 cell');
    assert.equal(args[7], 512);
    assert.equal(args[8], SH);
  }
  assert.ok(draws.some(args => args[5] === 512 && args[6] === 464 - NORTH));
  assert.ok(draws.some(args => args[6] === 720 - NORTH));
  assert.ok(!draws.some(args => args[5] === 900));
  assert.ok(r.scales.some(args => args[0] === 1 && args[1] === -1));
});

test('a scroll strip paints the seam it crosses and a miss strip does not', () => {
  const r = loadRenderer();
  const transition = arm(r);
  const chunks = [shore(0)];
  r.env.RENDERER.setCam(0, -700);
  r.env.RENDERER.drawGround(0, 600, chunks, 'ground_dirt', 'rain-port');
  assert.equal(transitionDraws(r, transition).length, 0);
  r.env.RENDERER.setCam(0, -500);
  r.env.RENDERER.drawGround(1, 600, chunks, 'ground_dirt', 'rain-port');
  const draws = transitionDraws(r, transition);
  assert.ok(draws.some(args => args[6] === 464 - NORTH));
  assert.equal(draws.some(args => args[6] === 720 - NORTH), false);
  const cache = r.canvases.at(-1);
  const fills = cache.fills.length;
  const count = draws.length;
  r.env.RENDERER.drawGround(2, 600, chunks, 'ground_dirt', 'rain-port');
  assert.equal(cache.fills.length, fills);
  assert.equal(transitionDraws(r, transition).length, count);
});

test('late image refreshes the terrain cache once', () => {
  const r = loadRenderer();
  const transition = arm(r, false);
  const chunks = [shore(0), { x: 0, y: 720, w: 900, h: 720, decor: { port: { shore: false } } }];
  r.env.RENDERER.setCam(0, 250);
  r.env.RENDERER.drawGround(0, 600, chunks, 'ground_dirt', 'rain-port');
  const cache = r.canvases.at(-1);
  const before = cache.fills.length;
  assert.equal(transitionDraws(r, transition).length, 0);
  transition.naturalWidth = 512;
  transition.naturalHeight = 512;
  transition.complete = true;
  r.env.RENDERER.drawGround(1, 600, chunks, 'ground_dirt', 'rain-port');
  assert.ok(cache.fills.length > before);
  assert.ok(transitionDraws(r, transition).length > 0);
  const once = cache.fills.length;
  r.env.RENDERER.drawGround(2, 600, chunks, 'ground_dirt', 'rain-port');
  assert.equal(cache.fills.length, once);
});

test('a missing transition leaves the stone and wood hard edge', () => {
  const r = loadRenderer();
  const transition = arm(r, false);
  const stone = r.env.PORT_ART.stoneVar1;
  const wood = r.env.PORT_ART.woodVar1;
  r.env.RENDERER.setCam(0, 250);
  r.env.RENDERER.drawGround(0, 600, [shore(0)], 'ground_dirt', 'rain-port');
  assert.equal(transitionDraws(r, transition).length, 0);
  assert.ok(r.images.some(args => args[0] === stone));
  assert.ok(r.images.some(args => args[0] === wood));
});

for (const stage of ['night-town', 'sakura-pass']) {
  test(stage + ' does not paint the port transition', () => {
    const r = loadRenderer();
    const transition = arm(r);
    r.env.RENDERER.setCam(0, 250);
    r.env.RENDERER.drawGround(0, 600, [shore(0)], 'ground_dirt', stage);
    assert.equal(transitionDraws(r, transition).length, 0);
  });
}
