'use strict';
// BOOM-LV5-MOTION — live drawOfudaImpact timeline (current Nov-2026 art)
// Numerical verification at t=0, .1, .2, .25, .3, .32
// Regression: other Lv, audio, other FX
// SHA tracking: skillfx.js + ofuda_max_burst.webp

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SKILLFX_PATH = path.join(ROOT, 'js/skillfx.js');
const IMAGE_PATH = path.join(ROOT, 'assets', 'img', 'vfx', 'ofuda_max_burst.webp');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const SKILLFX_SHA = sha256(SKILLFX_PATH);
const IMAGE_SHA = sha256(IMAGE_PATH);

console.log('[BOOM-LV5-R2] skillfx.js SHA256:', SKILLFX_SHA);
console.log('[BOOM-LV5-R2] ofuda_max_burst.webp SHA256:', IMAGE_SHA);

// -------- Test harness (same pattern as ofuda-raster.test.cjs) --------
function harness() {
  const requested = [], uprights = [];
  let probeImage = null;
  class ImageMock {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; this.cornerAlpha = 0; }
    set src(url) { this.url = url; requested.push(this); }
  }
  const gradient = { addColorStop() {} }, noop = () => {};
  const canvasCtx = new Proxy({
    drawImage(image) { probeImage = image; },
    getImageData() {
      const data = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) data[i + 3] = probeImage?.cornerAlpha ?? 0;
      return { data };
    },
    createRadialGradient() { return gradient; },
    createLinearGradient() { return gradient; }
  }, { get(target, key) { return key in target ? target[key] : noop; } });
  const deterministicMath=Object.create(Math); deterministicMath.random=()=>.9;
  const env = { Math:deterministicMath, Date, Image: ImageMock, matchMedia: () => ({ matches: false }),
    document: { createElement: () => ({ getContext: () => canvasCtx }) },
    console: { warn() {}, log() {}, error() {} }, setTimeout() {},
    // assets.js now requests its shared manifest on module load. It is not
    // relevant to this already-mocked local raster motion test.
    fetch: async () => ({ok:true, json:async()=>({})}) };
  env.window = env;
  env.VIEWPORT = { upright(ctx, x, y, paint) { uprights.push([x, y]); paint(); } };
  const cx = vm.createContext(env);
  for (const file of ['js/assets.js', 'js/fx.js', 'js/skillfx.js'])
    vm.runInContext(fs.readFileSync(file, 'utf8'), cx, { filename: file });
  function named(name) { return requested.find(img => img.url?.includes('/' + name + '.webp')); }
  function ready(image) { assert.ok(image, 'asset request missing'); image.naturalWidth = image.naturalHeight = 1024; image.onload(); }
  return { env, requested, uprights, named, ready };
}

function drawHarness() {
  const draws = [], stack = [];
  const ctx = {
    globalAlpha: 1,
    save() { stack.push(this.globalAlpha); },
    restore() { this.globalAlpha = stack.pop(); },
    translate() {}, rotate() {}, scale() {},
    drawImage(img, x, y, w, h) { draws.push({ img, x, y, w, h, alpha: this.globalAlpha }); }
  };
  return { ctx, draws };
}

// -------- Sampling function --------
function sampleAtAge(age) {
  const h = harness();
  h.env.ofudaRasterArt('max');
  const image = h.named('ofuda_max_burst');
  h.ready(image);
  h.env.SKILLFX.play('boom', 'hit', 5, { x: 100, y: 120, r: 135 });
  if (age) h.env.SKILLFX.update(age);
  const d = drawHarness();
  const translations = [], rotations = [];
  d.ctx.translate = (x, y) => translations.push([x, y]);
  d.ctx.rotate = angle => rotations.push(angle);
  h.env.SKILLFX.drawArtFx(d.ctx, false);
  const drawn = d.draws.filter(x => x.img === image);
  return {
    age,
    drawImageCallsInSpy: drawn.length,
    source: image.url,
    width: drawn[0]?.w ?? null,
    scaleRelativeTo240: drawn[0] ? drawn[0].w / 240 : null,
    alpha: drawn[0]?.alpha ?? 0,
    translations,
    rotations
  };
}

// -------- Test: SHA verification --------
test('BOOM-LV5-R2: SHA256 recorded for traceability', () => {
  assert.equal(typeof SKILLFX_SHA, 'string');
  assert.equal(SKILLFX_SHA.length, 64);
  assert.equal(typeof IMAGE_SHA, 'string');
  assert.equal(IMAGE_SHA.length, 64);
});

// -------- Test: current max animation rises 0.1 -> 1.2 at .12s,
// then eases to 1.0 by .30s; no gameplay curve is changed here. --------
test('BOOM-LV5-R2: scale curve at t=0 (age 0)', () => {
  const f = sampleAtAge(0);
  console.log('[t=0]', f);
  assert.ok(f.scaleRelativeTo240 !== null, 'must draw at age 0');
  assert.ok(f.scaleRelativeTo240 >= 0.10 && f.scaleRelativeTo240 <= 0.20,
    `scale at t=0 must be ~0.15, got ${f.scaleRelativeTo240}`);
});

test('BOOM-LV5: scale at t=0.1 — near current 1.2x peak', () => {
  const f = sampleAtAge(0.1);
  console.log('[t=0.1]', f);
  assert.ok(f.scaleRelativeTo240 !== null, 'must draw at age 0.1');
  assert.ok(f.scaleRelativeTo240 >= 1.18 && f.scaleRelativeTo240 <= 1.21,
    `scale at t=0.1 must be ~1.195, got ${f.scaleRelativeTo240}`);
});

test('BOOM-LV5: scale at t=0.2 — easing down from 1.2x', () => {
  const f = sampleAtAge(0.2);
  console.log('[t=0.2]', f);
  assert.ok(f.scaleRelativeTo240 !== null, 'must draw at age 0.2');
  assert.ok(f.scaleRelativeTo240 >= 1.10 && f.scaleRelativeTo240 <= 1.13,
    `scale at t=0.2 must be ~1.117, got ${f.scaleRelativeTo240}`);
});

test('BOOM-LV5: scale at t=0.25 — final settling', () => {
  const f = sampleAtAge(0.25);
  console.log('[t=0.25]', f);
  assert.ok(f.scaleRelativeTo240 !== null, 'must draw at age 0.25');
  assert.ok(f.scaleRelativeTo240 >= 1.02 && f.scaleRelativeTo240 <= 1.05,
    `scale at t=0.25 must be ~1.038, got ${f.scaleRelativeTo240}`);
});

test('BOOM-LV5-R2: scale curve at t=0.3 (age 0.3) — hold 1.0', () => {
  const f = sampleAtAge(0.3);
  console.log('[t=0.3]', f);
  assert.ok(f.scaleRelativeTo240 !== null, 'must draw at age 0.3');
  assert.ok(f.scaleRelativeTo240 >= 0.98 && f.scaleRelativeTo240 <= 1.02,
    `scale at t=0.3 must be ~1.0, got ${f.scaleRelativeTo240}`);
});

// -------- Test: jitter begins strictly after .30s and fades by .40s --------
test('BOOM-LV5-R2: position jitter at t=0.1 — NO jitter before 0.2s', () => {
  const f = sampleAtAge(0.1);
  const tx = f.translations[0]?.[0] ?? 100;
  const ty = f.translations[0]?.[1] ?? 80;
  const dx = Math.abs(tx - 100);
  const dy = Math.abs(ty - 80);
  console.log('[t=0.1 jitter]', { dx, dy, translations: f.translations });
  assert.ok(dx < 0.5 && dy < 0.5, `no position jitter before 0.2s: dx=${dx}, dy=${dy}`);
});

test('BOOM-LV5-R2: position jitter at t=0.2 — NO jitter at 0.2s boundary', () => {
  const f = sampleAtAge(0.2);
  const tx = f.translations[0]?.[0] ?? 100;
  const ty = f.translations[0]?.[1] ?? 80;
  const dx = Math.abs(tx - 100);
  const dy = Math.abs(ty - 80);
  console.log('[t=0.2 jitter]', { dx, dy, translations: f.translations });
  assert.ok(dx < 0.5 && dy < 0.5, `no position jitter at 0.2s: dx=${dx}, dy=${dy}`);
});

test('BOOM-LV5: no position jitter before current .30s threshold', () => {
  const f = sampleAtAge(0.25);
  const tx = f.translations[0]?.[0] ?? 100;
  const ty = f.translations[0]?.[1] ?? 80;
  const dx = Math.abs(tx - 100);
  const dy = Math.abs(ty - 80);
  console.log('[t=0.25 jitter]', { dx, dy, translations: f.translations });
  assert.ok(dx < 0.1 && dy < 0.1, `position jitter must wait until .30s, got dx=${dx}, dy=${dy}`);
});

test('BOOM-LV5: exactly .30s remains stable without position jitter', () => {
  const f = sampleAtAge(0.3);
  const tx = f.translations[0]?.[0] ?? 100;
  const ty = f.translations[0]?.[1] ?? 80;
  const dx = Math.abs(tx - 100);
  const dy = Math.abs(ty - 80);
  console.log('[t=0.3 jitter]', { dx, dy, translations: f.translations });
  assert.ok(dx < 0.1 && dy < 0.1, `position jitter begins after .30s, got dx=${dx}, dy=${dy}`);
});

test('BOOM-LV5: deterministic position jitter appears after .30s', () => {
  const f=sampleAtAge(.32);
  const x=f.translations[0]?.[0] ?? 100;
  const y=f.translations[0]?.[1] ?? 80;
  assert.ok(Math.abs(x-100)>.1 || Math.abs(y-80)>.1,
    `jitter starts after .30s: ${x},${y}`);
});

// -------- Test: current max starts at 70% opacity (not zero) --------
test('BOOM-LV5: alpha at t=0 is 0.7 before full opacity', () => {
  const f = sampleAtAge(0);
  console.log('[t=0 alpha]', f.alpha);
  assert.equal(f.alpha, 0.7, 'current max burst starts visibly at 70% opacity');
});

test('BOOM-LV5-R2: alpha at t=0.1 is 1 (emerge~1, fade~1)', () => {
  const f = sampleAtAge(0.1);
  console.log('[t=0.1 alpha]', f.alpha);
  assert.ok(f.alpha >= 0.95 && f.alpha <= 1.05, `alpha at t=0.1 must be ~1, got ${f.alpha}`);
});

// -------- Test: angle jitter preserved (separate from position) --------
test('BOOM-LV5-R2: angle jitter at t=0.1', () => {
  const f = sampleAtAge(0.1);
  console.log('[t=0.1 angle]', f.rotations);
  assert.ok(f.rotations.length > 0, 'angle jitter rotation applied');
  assert.ok(Math.abs(f.rotations[0]) <= 0.04, `angle jitter ~±0.035 rad, got ${f.rotations[0]}`);
});

// -------- Regression: Lv1-4 unchanged --------
test('BOOM-LV5: Lv1–4 existing cubic scale peaks slightly above 1.0', () => {
  for (let rank = 1; rank <= 4; rank++) {
    const h = harness();
    h.env.ofudaRasterArt('hit');
    const image = h.named('ofuda_hit_burst');
    h.ready(image);
    h.env.SKILLFX.play('boom', 'hit', rank, { x: 100, y: 120, target: { hp: 99 } });
    h.env.SKILLFX.update(0.1);
    const d = drawHarness();
    h.env.SKILLFX.drawArtFx(d.ctx, false);
    const drawn = d.draws.find(x => x.img === image);
    assert.ok(drawn, `Lv${rank} must draw`);
    // Current normal rank animation also expands: at .1s
    // 0.14 + 0.98 * (1 - (1 - .1/.15)^3) = 1.0837037.
    const expectedBase = [126, 136, 148, 160][rank - 1];
    const scale = drawn.w / expectedBase;
    assert.ok(scale >= 1.07 && scale <= 1.10, `Lv${rank} scale at 0.1s must be ~1.084, got ${scale}`);
  }
});

// -------- Regression: Lv1-4 alpha curve (linear min(1, age/0.065)) --------
test('BOOM-LV5-R2: Lv1-4 alpha at t=0 is 0', () => {
  for (let rank = 1; rank <= 4; rank++) {
    const h = harness();
    h.env.ofudaRasterArt('hit');
    const image = h.named('ofuda_hit_burst');
    h.ready(image);
    h.env.SKILLFX.play('boom', 'hit', rank, { x: 100, y: 120, target: { hp: 99 } });
    const d = drawHarness();
    h.env.SKILLFX.drawArtFx(d.ctx, false);
    const drawn = d.draws.find(x => x.img === image);
    assert.equal(drawn.alpha, 0, `Lv${rank} alpha at age 0 must be 0`);
  }
});

test('BOOM-LV5-R2: Lv1-4 alpha at t=0.03 ~0.46', () => {
  for (let rank = 1; rank <= 4; rank++) {
    const h = harness();
    h.env.ofudaRasterArt('hit');
    const image = h.named('ofuda_hit_burst');
    h.ready(image);
    h.env.SKILLFX.play('boom', 'hit', rank, { x: 100, y: 120, target: { hp: 99 } });
    h.env.SKILLFX.update(0.03);
    const d = drawHarness();
    h.env.SKILLFX.drawArtFx(d.ctx, false);
    const drawn = d.draws.find(x => x.img === image);
    assert.ok(drawn.alpha >= 0.40 && drawn.alpha <= 0.55, `Lv${rank} alpha at 0.03s must be ~0.46, got ${drawn.alpha}`);
  }
});

test('BOOM-LV5-R2: Lv1-4 alpha at t=0.065 is 1', () => {
  for (let rank = 1; rank <= 4; rank++) {
    const h = harness();
    h.env.ofudaRasterArt('hit');
    const image = h.named('ofuda_hit_burst');
    h.ready(image);
    h.env.SKILLFX.play('boom', 'hit', rank, { x: 100, y: 120, target: { hp: 99 } });
    h.env.SKILLFX.update(0.065);
    const d = drawHarness();
    h.env.SKILLFX.drawArtFx(d.ctx, false);
    const drawn = d.draws.find(x => x.img === image);
    assert.ok(drawn.alpha >= 0.95 && drawn.alpha <= 1.05, `Lv${rank} alpha at 0.065s must be ~1.0, got ${drawn.alpha}`);
  }
});

// -------- Regression: particles emitted (chips only for raster path) --------
test('BOOM-LV5-R2: Lv5 emits chips particles for raster path (regression)', () => {
  const h = harness();
  h.env.ofudaRasterArt('max');
  const image = h.named('ofuda_max_burst');
  h.ready(image);
  h.env.SKILLFX.play('boom', 'hit', 5, { x: 100, y: 120, r: 135 });
  h.env.SKILLFX.update(0.01);
  const particles = h.env.FX.particles();
  const hasChips = particles.some(p => p.kind === 'shard' || p.kind === 'spark');
  console.log('[particles]', { count: particles.length, kinds: [...new Set(particles.map(p => p.kind))] });
  assert.ok(hasChips, 'must emit chips/shard/spark for raster path');
  // Seal particles are only in fallback explosion(), not raster path
});

// -------- Test: life 0.52s is correct --------
test('BOOM-LV5-R2: Lv5 life is 0.52s', () => {
  const SKILLFX_SRC = fs.readFileSync(SKILLFX_PATH, 'utf8');
  assert.match(SKILLFX_SRC, /life:rank===5\?.52/, 'max life must be 0.52s');
});

// -------- Test: image not ready fallback safe, but animates when ready --------
test('BOOM-LV5-R2: returns false when image not ready (fallback safe)', () => {
  const h = harness();
  // Don't call ready() - image has naturalWidth=0
  h.env.ofudaRasterArt('max');
  const image = h.named('ofuda_max_burst');
  // image.naturalWidth = 0, naturalHeight = 0 (not ready)
  h.env.SKILLFX.play('boom', 'hit', 5, { x: 100, y: 120, r: 135 });
  const d = drawHarness();
  h.env.SKILLFX.drawArtFx(d.ctx, false);
  const drawn = d.draws.filter(x => x.img === image);
  assert.equal(drawn.length, 0, 'must not draw when image not ready');
});

test('BOOM-LV5-R2: animates when image ready', () => {
  const h = harness();
  h.env.ofudaRasterArt('max');
  const image = h.named('ofuda_max_burst');
  h.ready(image);
  h.env.SKILLFX.play('boom', 'hit', 5, { x: 100, y: 120, r: 135 });
  h.env.SKILLFX.update(0.1);
  const d = drawHarness();
  h.env.SKILLFX.drawArtFx(d.ctx, false);
  const drawn = d.draws.filter(x => x.img === image);
  assert.equal(drawn.length, 1, 'must draw when image ready');
  assert.ok(drawn[0].alpha > 0.9, 'must be visible when ready');
});

// -------- Test: VIEWPORT.upright used for 2D/.60 --------
test('BOOM-LV5-R2: VIEWPORT.upright called with ground anchor (p.x, p.y)', () => {
  const h = harness();
  h.env.ofudaRasterArt('max');
  const image = h.named('ofuda_max_burst');
  h.ready(image);
  h.env.SKILLFX.play('boom', 'hit', 5, { x: 100, y: 120, r: 135 });
  h.env.SKILLFX.update(0.1);
  const d = drawHarness();
  h.env.SKILLFX.drawArtFx(d.ctx, false);
  assert.equal(h.uprights.length, 1, 'VIEWPORT.upright called once');
  // Anchor should be ground position (p.x, p.y), not draw offset
  assert.deepEqual(h.uprights[0], [100, 120]);
});
