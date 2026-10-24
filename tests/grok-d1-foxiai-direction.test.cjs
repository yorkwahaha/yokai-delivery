'use strict';
// D1-GROK-FORWARD-R1：雷狐居合主軸對齊 fusionLineTargets 的投影。
// 不讀音訊／SW／KEY。跑法：
//   node --require ./tools/director-audio-freeze.cjs --test tests/grok-d1-foxiai-direction.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ASSETS_SHA = '342d89f9134fcc027c8bfadab72bbc971cb82287f466141ae961f05f04a8dd48';
const GAME_SHA = 'bc0e70af9dfd84b4a6a1addfb9ced3870fb16f77182a30291d0a119160c1e18c';

const BBOX = {
  main: [92, 141, 1208, 726],
  hit: [308, 160, 953, 694],
  ground: [60, 352, 1160, 494]
};
// Pillow alpha>16 的不透明端點（全圖像素）。尖端在圖的 +X。見 scratch/fusion-vfx-polish-grok-d1/chord-measure.json。
const ENDS = {
  main: { hilt: [92, 438], tip: [1207, 151] },
  hit: { hilt: [308, 692.5], tip: [952, 237] },
  ground: { hilt: [60, 432], tip: [1157, 424] }
};

const REACH = 360;
const OX = 1000;
const OY = 2000;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function makeCtx() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];
  let strokes = 0;
  const ctx = {
    save() { stack.push(m.slice()); },
    restore() { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) {
      const c = Math.cos(a), s = Math.sin(a);
      m = mul(m, [c, s, -s, c, 0, 0]);
    },
    beginPath() {},
    stroke() { strokes += 1; },
    fill() {},
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      images.push({ img, sx, sy, sw, sh, dx, dy, dw, dh, m: m.slice() });
    }
  };
  return { ctx: new Proxy(ctx, { get: (t, k) => (k in t ? t[k] : () => {}) }), images, strokeCount: () => strokes };
}

function loadRenderer() {
  const env = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    document: { createElement: () => ({ getContext: () => ({}) }) },
    ART: {},
    console
  };
  env.window = env;
  const context = vm.createContext(env);
  vm.runInContext(fs.readFileSync('js/viewport.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/renderer.js', 'utf8'), context);
  const images = {
    main: { naturalWidth: 1264, naturalHeight: 848, phase: 'main' },
    hit: { naturalWidth: 1264, naturalHeight: 848, phase: 'hit' },
    ground: { naturalWidth: 1264, naturalHeight: 848, phase: 'ground' }
  };
  context.isFusionArtBindEnabled = () => true;
  context.getFusionPhaseArt = (kind, phase) => (kind === 'fusion_foxiai' ? images[phase] || null : null);
  context.getFusionArtBindDef = (kind, phase) => {
    if (kind !== 'fusion_foxiai' || !BBOX[phase]) return null;
    return { bbox: BBOX[phase].slice(), size: [1264, 848] };
  };
  return context;
}

const env = loadRenderer();

function project(x, y, k) {
  return [x, k * y];
}
function imagePoint(draw, ix, iy) {
  const destX = draw.dx + ((ix - draw.sx) / draw.sw) * draw.dw;
  const destY = draw.dy + ((iy - draw.sy) / draw.sh) * draw.dh;
  return apply(draw.m, destX, destY);
}
function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function lineOf(draw, phase) {
  const ends = ENDS[phase];
  return { hilt: imagePoint(draw, ends.hilt[0], ends.hilt[1]), tip: imagePoint(draw, ends.tip[0], ends.tip[1]) };
}
function rayEnd(angle) {
  return [OX + Math.cos(angle) * REACH, OY + Math.sin(angle) * REACH];
}
function tiltWorld(box, k) {
  if (k !== 1) box.ctx.scale(1, k);
}

function render(tilt, effect) {
  env.VIEWPORT.setTiltScale(tilt);
  const box = makeCtx();
  tiltWorld(box, tilt);
  env.RENDERER.drawFusionFx(box.ctx, effect, 1.2);
  const draws = box.images.filter(d => d.img && d.img.phase);
  return { draws, strokes: box.strokeCount() };
}
function fx(angle, hitSet, extra) {
  return Object.assign({
    kind: 'fusion_foxiai',
    phase: 'active',
    x: OX,
    y: OY,
    angle,
    radius: REACH,
    width: 80,
    progress: 0.4,
    seed: 2,
    burnAge: 0.2,
    life: 0.54,
    hitSet: hitSet || new Set()
  }, extra || {});
}
function one(draws, phase) {
  const found = draws.filter(d => d.img.phase === phase);
  assert.equal(found.length, 1, phase + ' drawImage count ' + found.length);
  return found[0];
}

test('assets 與 game 凍結 SHA，foxiai 裁切框仍是 R4 bbox', () => {
  assert.equal(sha256('js/assets.js'), ASSETS_SHA);
  assert.equal(sha256('js/game.js'), GAME_SHA);
  const drawn = render(1, fx(0, new Set([{ x: OX + 200, y: OY }])));
  for (const phase of ['main', 'ground', 'hit']) {
    const d = one(drawn.draws, phase);
    assert.deepEqual([d.sx, d.sy, d.sx + d.sw, d.sy + d.sh], BBOX[phase], phase + ' crop');
  }
  assert.equal(drawn.strokes, 0);
});

test('面向左右 × 敵前後 × 2D/.60：主圖/地面/命中落在 lineTargets 投影上', () => {
  const bad = [];
  const rows = [];
  const check = (cond, msg) => { if (!cond) bad.push(msg); };
  const near = (actual, expected, label) => {
    const err = dist(actual, expected);
    rows.push(label + ' err=' + err.toFixed(3) + ' at=' + actual.map(n => n.toFixed(1)).join(',') + ' want=' + expected.map(n => n.toFixed(1)).join(','));
    check(err < 1.25, label + ' err=' + err.toFixed(2));
  };
  const slashOnRay = (tilt, angle, label) => {
    const front = { x: OX + Math.cos(angle) * 200, y: OY + Math.sin(angle) * 200 };
    const behind = { x: OX - Math.cos(angle) * 180, y: OY - Math.sin(angle) * 180 };
    const drawn = render(tilt, fx(angle, new Set([front])));
    const main = lineOf(one(drawn.draws, 'main'), 'main');
    const ground = lineOf(one(drawn.draws, 'ground'), 'ground');
    const hit = lineOf(one(drawn.draws, 'hit'), 'hit');
    const k = tilt;
    const origin = project(OX, OY, k);
    const tip = project(rayEnd(angle)[0], rayEnd(angle)[1], k);
    const enemy = project(front.x, front.y, k);
    const back = project(behind.x, behind.y, k);
    near(main.hilt, origin, label + ' main.hilt');
    near(main.tip, tip, label + ' main.tip');
    near(ground.hilt, origin, label + ' ground.hilt');
    near(ground.tip, tip, label + ' ground.tip');
    const mid = [(hit.hilt[0] + hit.tip[0]) / 2, (hit.hilt[1] + hit.tip[1]) / 2];
    near(mid, enemy, label + ' hit.mid');
    const axis = [hit.tip[0] - hit.hilt[0], hit.tip[1] - hit.hilt[1]];
    const ray = [tip[0] - origin[0], tip[1] - origin[1]];
    const dot = axis[0] * ray[0] + axis[1] * ray[1];
    const cross = axis[0] * ray[1] - axis[1] * ray[0];
    check(dot > 0, label + ' hit tip faces the ray');
    check(Math.abs(cross) <= Math.hypot(axis[0], axis[1]) * Math.hypot(ray[0], ray[1]) * 0.02, label + ' hit axis parallel');
    check(dist(mid, back) > 100, label + ' hit is not on the enemy behind');
    const tBehind = (behind.x - OX) * Math.cos(angle) + (behind.y - OY) * Math.sin(angle);
    check(tBehind < 0, label + ' behind sample is t<0');
    const tFront = (front.x - OX) * Math.cos(angle) + (front.y - OY) * Math.sin(angle);
    const perp = Math.abs((front.x - OX) * Math.sin(angle) - (front.y - OY) * Math.cos(angle));
    check(tFront > 0 && tFront < REACH && perp < 40, label + ' front sample is inside the corridor');
  };

  slashOnRay(1, 0, '2D face+X');
  slashOnRay(1, Math.PI, '2D face-X');
  slashOnRay(0.6, 0, '.60 face+X');
  slashOnRay(0.6, Math.PI, '.60 face-X');
  slashOnRay(1, -Math.PI / 2, '2D face-Y');
  slashOnRay(0.6, -Math.PI / 2, '.60 face-Y');
  slashOnRay(1, -Math.PI / 4, '2D diag');
  slashOnRay(0.6, -Math.PI / 4, '.60 diag');
  slashOnRay(0.6, Math.PI + 0.4, '.60 angle>PI');

  const offsetEnemy = { x: OX + 200, y: OY + 20 };
  const offsetDraw = render(0.6, fx(0, new Set([offsetEnemy])));
  const offsetHit = lineOf(one(offsetDraw.draws, 'hit'), 'hit');
  const offsetMid = [(offsetHit.hilt[0] + offsetHit.tip[0]) / 2, (offsetHit.hilt[1] + offsetHit.tip[1]) / 2];
  near(offsetMid, project(offsetEnemy.x, offsetEnemy.y, 0.6), '.60 hit stays on perp-offset enemy');
  const centerline = project(OX + 200, OY, 0.6);
  check(dist(offsetMid, centerline) > 10, '.60 hit is not snapped off the enemy onto the centerline');

  const empty = render(1, fx(0, new Set()));
  check(!empty.draws.some(d => d.img.phase === 'hit'), 'empty hitSet draws no hit');
  const warned = render(1, fx(0, new Set([{ x: OX + 200, y: OY }]), { phase: 'warn' }));
  check(!warned.draws.some(d => d.img.phase === 'hit'), 'warn draws no hit');

  const bait = render(1, fx(0, new Set([{ x: OX + 200, y: OY }]), { targetX: OX - 300, targetY: OY + 300, x2: OX, y2: OY - 400 }));
  near(lineOf(one(bait.draws, 'main'), 'main').tip, project(OX + REACH, OY, 1), 'targetX does not override fx.angle');

  const wide = render(1, fx(0, new Set(), { width: 64 }));
  const narrow = render(1, fx(0, new Set(), { width: 200 }));
  const wideTip = lineOf(one(wide.draws, 'main'), 'main').tip;
  const narrowTip = lineOf(one(narrow.draws, 'main'), 'main').tip;
  check(dist(wideTip, narrowTip) < 0.01, 'fx.width does not resize or re-aim the slash');

  const pair = render(0.6, fx(-Math.PI / 5, new Set([
    { x: OX + Math.cos(-Math.PI / 5) * 120, y: OY + Math.sin(-Math.PI / 5) * 120 },
    { x: OX + Math.cos(-Math.PI / 5) * 280, y: OY + Math.sin(-Math.PI / 5) * 280 }
  ])));
  const hits = pair.draws.filter(d => d.img.phase === 'hit');
  check(hits.length === 2, 'one hit image per hitSet enemy, got ' + hits.length);

  const src = fs.readFileSync('js/renderer.js', 'utf8');
  const fox = src.slice(src.indexOf('kind === "fusion_foxiai"'), src.indexOf('kind === "fusion_exorcistblade"'));
  check(!/angle\s*>\s*Math\.PI/.test(fox), 'foxiai must not flip on angle>PI');
  check(!/width:\s*64/.test(fox), 'foxiai must not hardcode hit width 64');
  const ink = src.slice(src.indexOf('kind === "fusion_inkblade"'), src.indexOf('kind === "fusion_slashwheel"'));
  check(ink.includes('rotate: angle') && !ink.includes('line:'), 'inkblade bind path stays unchanged');

  console.log(rows.join('\n'));
  assert.equal(bad.length, 0, bad.join('\n'));
});
