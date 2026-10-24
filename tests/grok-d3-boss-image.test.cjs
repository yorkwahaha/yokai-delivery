'use strict';
// D3-GROK-BOSS-IMAGE-R1：tidalFan / rainVortex 真圖對準傷害扇面與圈。
//   node --require ./tools/director-audio-freeze.cjs --test tests/grok-d3-boss-image.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ASSETS_SHA = '342d89f9134fcc027c8bfadab72bbc971cb82287f466141ae961f05f04a8dd48';
const GAME_SHA = 'bc0e70af9dfd84b4a6a1addfb9ced3870fb16f77182a30291d0a119160c1e18c';
const RIPPLE = { naturalWidth: 128, naturalHeight: 128, role: 'ripple' };

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function makeCtx() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];
  let fills = 0;
  let strokes = 0;
  const ctx = {
    globalAlpha: 1,
    _path: [],
    _arcs: [],
    _clips: [],
    save() { stack.push({ m: m.slice(), a: this.globalAlpha }); },
    restore() {
      const prev = stack.pop();
      m = prev ? prev.m : [1, 0, 0, 1, 0, 0];
      this.globalAlpha = prev ? prev.a : 1;
    },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) {
      const c = Math.cos(a), s = Math.sin(a);
      m = mul(m, [c, s, -s, c, 0, 0]);
    },
    beginPath() { ctx._path = []; },
    moveTo() {},
    lineTo() {},
    arc(x, y, r, a0, a1) { ctx._path.push({ x, y, r, a0, a1 }); ctx._arcs.push({ x, y, r, a0, a1 }); },
    ellipse() {},
    quadraticCurveTo() {},
    closePath() {},
    clip() { ctx._clips.push((ctx._path || []).slice()); },
    setLineDash() {},
    fillRect() { fills += 1; },
    createLinearGradient: () => ({ addColorStop() {} }),
    stroke() { strokes += 1; },
    fill() { fills += 1; },
    drawImage(img, dx, dy, dw, dh) {
      images.push({ img, alpha: ctx.globalAlpha, dx, dy, dw, dh, m: m.slice() });
    }
  };
  return { ctx, images, fills: () => fills, strokes: () => strokes, matrix: () => m.slice() };
}
const motion = {
  matches: false,
  listeners: [],
  addEventListener(_t, fn) { this.listeners.push(fn); },
  addListener(fn) { this.listeners.push(fn); },
  set(matches) {
    this.matches = matches;
    for (const fn of this.listeners) fn({ matches });
  }
};
function load() {
  const env = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    matchMedia: () => motion,
    document: { createElement: () => ({ getContext: () => ({}) }) },
    console,
    PORT_ART: { ripple: RIPPLE },
    STAGE: { id: 'rain-port' },
    isFusionArtBindEnabled: () => false
  };
  env.window = env;
  const context = vm.createContext(env);
  vm.runInContext(fs.readFileSync('js/viewport.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/boss-ai.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/renderer.js', 'utf8'), context);
  return context;
}
const env = load();

function userCenter(draw) {
  return [draw.dx + draw.dw / 2, draw.dy + draw.dh / 2];
}
function call(h, elapsed, tilt) {
  const box = makeCtx();
  box.ctx.globalAlpha = 0.37;
  if (tilt && tilt !== 1) box.ctx.scale(1, tilt);
  const handled = env.RENDERER.drawBossHazard(box.ctx, h, elapsed);
  return { handled, box, alpha: box.ctx.globalAlpha, pass: env.RENDERER.bossHazardPass() };
}
function fan(phase, extra) {
  const angle = 0.4;
  return Object.assign({
    kind: 'tidalFan', phase, x: 400, y: 500, angle,
    startAngle: angle - Math.PI / 3,
    endAngle: angle + Math.PI / 3,
    r: 200, t: 0, duration: phase === 'active' ? 0.15 : phase === 'recovery' ? 1.35 : 0.9
  }, extra || {});
}
function inSector(px, py, h, pad = 0.03) {
  const dx = px - h.x, dy = py - h.y;
  let a = Math.atan2(dy, dx);
  while (a < h.startAngle - pad) a += Math.PI * 2;
  while (a > h.endAngle + pad) a -= Math.PI * 2;
  return a >= h.startAngle - pad && a <= h.endAngle + pad && Math.hypot(dx, dy) <= h.r + 30;
}

test('assets 與 game 凍結；缺圖與非 DEV 是 LEGACY，標準 hazard 才 false', () => {
  assert.equal(sha256('js/assets.js'), ASSETS_SHA);
  assert.equal(sha256('js/game.js'), GAME_SHA);
  env.isFusionArtBindEnabled = () => true;
  env.PORT_ART.ripple = { naturalWidth: 0, naturalHeight: 0, role: 'ripple' };
  const missing = call(fan('telegraph'), 0.2);
  assert.equal(missing.handled, true);
  assert.equal(missing.pass, 'LEGACY_SAFETY_FALLBACK');
  assert.equal(missing.box.images.length, 0);
  assert.ok(missing.box.fills() + missing.box.strokes() > 0);
  assert.equal(missing.alpha, 0.37);
  env.isFusionArtBindEnabled = () => false;
  env.PORT_ART.ripple = RIPPLE;
  const normal = call(fan('telegraph'), 0.2);
  assert.equal(normal.handled, true);
  assert.equal(normal.pass, 'LEGACY_SAFETY_FALLBACK');
  assert.equal(normal.box.images.length, 0);
  assert.notEqual(normal.pass, 'IMAGE');
  assert.ok(normal.box.strokes() > 0);
  for (const kind of ['slam', 'charge', 'ring', 'tide']) {
    const out = call({ kind, x: 30, y: 40, r: 150, angle: 0.2, phase: 'telegraph', safeOffset: 100, safeWidth: 130 }, 1);
    assert.equal(out.handled, false, kind);
    assert.equal(out.box.images.length, 0, kind);
    assert.equal(out.box.fills() + out.box.strokes(), 0, kind);
    assert.equal(out.alpha, 0.37, kind);
  }
  const bad = call({ kind: 'tidalFan', x: NaN, y: 1 }, 1);
  assert.equal(bad.handled, false);
  assert.equal(bad.box.images.length, 0);
  const game = fs.readFileSync('js/game.js', 'utf8');
  assert.equal(game.includes('tidalFan'), false);
  assert.equal(game.includes('rainVortex'), false);
  const ai = fs.readFileSync('js/boss-ai.js', 'utf8').split(/\r?\n/);
  const at = (n) => ai[n - 1];
  assert.match(at(327), /h\.startAngle \+ \(h\.endAngle - h\.startAngle\) \* u/);
  assert.match(at(335), /distToCenter <= fanR \+ 30/);
  assert.match(at(335), /Math\.PI \/ 12/);
  assert.match(at(349), /u < 0\.5/);
  assert.match(at(356), /vDist <= v\.r \+ 20/);
  assert.match(at(151), /r: 28/);
  assert.match(at(231), /h\.duration = 0\.15/);
});

test('潮扇與渦流覆蓋 BOSS_AI 真傷害區，不是手寫剛好符合的扇面', () => {
  env.isFusionArtBindEnabled = () => true;
  env.PORT_ART.ripple = RIPPLE;
  const bad = [];
  const rows = [];
  const check = (cond, msg) => { if (!cond) bad.push(msg); };

  function spawn(kind, bossIndex = 1) {
    const e = { x: 0, y: 0, hp: bossIndex === 3 ? 100 : 900, max: 1400, bossIndex, stageId: 'rain-port' };
    const aim = { x: 180, y: 0 };
    for (let i = 0; i < 8; i++) {
      delete e.hazard;
      if (!env.BOSS_AI.start(e, aim)) throw new Error('start failed');
      if (e.hazard && e.hazard.kind === kind) return e;
    }
    throw new Error('pool missed ' + kind);
  }
  function fanHarmed(point, mutateR) {
    const e = spawn('tidalFan');
    if (mutateR) e.hazard.r = mutateR;
    env.BOSS_AI.step(e, point, e.hazard.duration);
    if (!e.hazard || e.hazard.phase !== 'active') return false;
    const dur = e.hazard.duration;
    for (let i = 0; i < 16; i++) {
      const res = env.BOSS_AI.step(e, point, dur / 16);
      if (res && res.hit) return res.hit.damage === 18;
      if (!e.hazard || e.hazard.phase !== 'active') break;
    }
    return false;
  }
  function vortexHarmed(v, dist, fraction) {
    const e = spawn('rainVortex');
    e.hazard.vortexes = [{ x: v.x, y: v.y, r: v.r, hit: false }];
    const point = { x: v.x + dist, y: v.y };
    env.BOSS_AI.step(e, point, e.hazard.duration);
    const res = env.BOSS_AI.step(e, point, e.hazard.duration * fraction);
    return !!(res && res.hit && res.hit.damage === 16);
  }
  function coverOf(draws) {
    const dw = draws[0] ? draws[0].dw : 1;
    return {
      minor: dw * (55 / 128) / 2,
      major: dw * (97 / 128) / 2
    };
  }
  function nearest(draws, x, y) {
    let best = Infinity;
    for (const d of draws) {
      const c = userCenter(d);
      best = Math.min(best, Math.hypot(c[0] - x, c[1] - y));
    }
    return best;
  }

  const spawned = spawn('tidalFan');
  check(spawned.hazard.r === 200, 'module fan radius');
  check(Math.abs((spawned.hazard.endAngle - spawned.hazard.startAngle) - (Math.PI * 2 / 3)) < 1e-9, 'module fan span');
  const BOX = { l: 16, t: 37, r: 113, b: 92 };
  function circleOf(draw) {
    const bw = BOX.r - BOX.l;
    const bh = BOX.b - BOX.t;
    const diameter = draw.dw * bw / 128;
    const cx = draw.dx + ((BOX.l + BOX.r) / 2) / 128 * draw.dw;
    const cy = draw.dy + ((BOX.t + BOX.b) / 2) / 128 * draw.dh;
    return { cx, cy, diameter, radius: diameter / 2 };
  }
  const telegraph = call(spawned.hazard, 0);
  check(telegraph.handled === true && telegraph.pass === 'IMAGE', 'true alone is not IMAGE; pass=' + telegraph.pass);
  check(telegraph.box.images.length === 1, 'telegraph is one ripple, got ' + telegraph.box.images.length);
  check(telegraph.box.images.length <= 3, 'telegraph frame cap');
  check(telegraph.box.images.every(d => d.img === RIPPLE), 'source is ripple');
  check(telegraph.box.fills() === 0, 'image path does not solid-fill');
  const fanCircle = circleOf(telegraph.box.images[0]);
  check(Math.abs(fanCircle.radius - (spawned.hazard.r + 30)) < 0.6, 'fan bbox scales to r+30');
  check(Math.abs(fanCircle.cx) < 0.6 && Math.abs(fanCircle.cy) < 0.6, 'fan circle sits on the boss');
  const clip = telegraph.box.ctx._clips[0];
  const clipArc = clip && clip.find(a => a.r > 100);
  const pad = Math.PI / 12;
  check(!!clipArc, 'telegraph clips the ripple');
  if (clipArc) {
    check(Math.abs(clipArc.r - (spawned.hazard.r + 30)) < 0.6, 'clip radius is the damage reach');
    check(Math.abs(clipArc.a0 - (spawned.hazard.startAngle - pad)) < 1e-6, 'clip starts at start-pad');
    check(Math.abs(clipArc.a1 - (spawned.hazard.endAngle + pad)) < 1e-6, 'clip ends at end+pad');
  }
  const inside = [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 120, y: 70 }, { x: 120, y: -70 }];
  for (const p of inside) {
    check(fanHarmed(p) === true, 'oracle should hit ' + p.x + ',' + p.y);
    const ang = Math.atan2(p.y, p.x);
    check(ang >= spawned.hazard.startAngle - pad && ang <= spawned.hazard.endAngle + pad, 'inside point is in the union');
    check(Math.hypot(p.x, p.y) <= spawned.hazard.r + 30, 'inside point is inside r+30');
  }
  const outside = { x: 320, y: 0 };
  check(fanHarmed(outside) === false, 'oracle should miss beyond r+30');
  check(Math.hypot(outside.x, outside.y) > fanCircle.radius + 1, 'opaque circle does not pass r+30');

  const narrow = spawn('tidalFan');
  narrow.hazard.r = 160;
  const rim = { x: 190, y: 0 };
  const past = { x: 250, y: 0 };
  check(fanHarmed(rim, 160) === true && fanHarmed(past, 160) === false, 'oracle follows mutated r');
  const narrowDraw = call(narrow.hazard, 0);
  const narrowCircle = circleOf(narrowDraw.box.images[0]);
  check(Math.abs(narrowCircle.radius - 190) < 0.6, 'art follows hazard.r 160 plus 30');
  check(past.x > narrowCircle.radius + 1, 'r 160 does not keep the old 230 edge');

  const live = spawn('tidalFan');
  env.BOSS_AI.step(live, { x: 9999, y: 9999 }, live.hazard.duration);
  check(live.hazard.phase === 'active' && live.hazard.duration === 0.15, 'module sets active duration 0.15');
  env.BOSS_AI.step(live, { x: 9999, y: 9999 }, live.hazard.duration * 0.5);
  const active = call(live.hazard, 0);
  check(active.handled === true && active.box.images.length === 2, 'active is union plus sweep, got ' + active.box.images.length);
  check(active.box.images.length <= 3, 'active frame cap');
  check(active.box.images[1].alpha > active.box.images[0].alpha, 'sweep wedge is brighter than the union');
  const wedge = active.box.ctx._clips[1];
  const wedgeArc = wedge && wedge.find(a => a.r > 100);
  check(!!wedgeArc && Math.abs((wedgeArc.a1 - wedgeArc.a0) - pad * 2) < 1e-6, 'active highlight is sweep±PI/12');
  rows.push('fanImages=' + telegraph.box.images.length + ' activeImages=' + active.box.images.length);

  motion.set(true);
  const stillA = call(spawn('tidalFan').hazard, 0);
  const stillB = call(spawn('tidalFan').hazard, 0.4);
  check(stillA.box.images[0].alpha === stillB.box.images[0].alpha, 'reduced motion holds alpha');
  motion.set(false);
  const pulse = call(spawn('tidalFan').hazard, 0.4);
  check(Math.abs(pulse.box.images[0].alpha - stillA.box.images[0].alpha) > 0.05, 'motion pulses telegraph');

  const vortexEnemy = spawn('rainVortex');
  check(vortexEnemy.hazard.vortexes.length === 3, 'module vortex count');
  const vortex = call(vortexEnemy.hazard, 0);
  check(vortex.handled === true && vortex.pass === 'IMAGE', 'vortex image pass');
  check(vortex.box.images.length === vortexEnemy.hazard.vortexes.length, 'one ripple per vortex');
  check(vortex.box.images.length <= vortexEnemy.hazard.vortexes.length * 2, 'vortex frame cap');
  check(vortex.box.fills() === 0, 'vortex image path does not solid-fill');
  for (const v of vortexEnemy.hazard.vortexes) {
    const hitR = v.r + 20;
    check(vortexHarmed(v, hitR - 1, 0.2) === false, 'vortex u<0.5 does not hit');
    check(vortexHarmed(v, hitR - 1, 1) === true, 'oracle hits inside v.r+20 once u>=0.5');
    check(vortexHarmed(v, hitR + 1, 1) === false, 'oracle misses outside v.r+20');
    const mark = vortex.box.images.map(circleOf).find(c => Math.hypot(c.cx - v.x, c.cy - v.y) < 1);
    check(!!mark && Math.abs(mark.radius - hitR) < 0.6, 'alpha bbox becomes the v.r+20 circle');
  }
  rows.push('vortexImages=' + vortex.box.images.length);
  const finalBoss = spawn('rainVortex', 3);
  check(finalBoss.hazard.vortexes.length === 5, 'final boss adds two vortexes');

  for (const tilt of [1, 0.6]) {
    const drawn = call(spawn('rainVortex').hazard, 0, tilt);
    const mark = drawn.box.images.map(circleOf).reduce((a, b) => Math.abs(a.cy) >= Math.abs(b.cy) ? a : b);
    const screen = apply(drawn.box.images[0].m, mark.cx, mark.cy);
    rows.push('tilt ' + tilt + ' userY=' + mark.cy.toFixed(1) + ' screenY=' + screen[1].toFixed(1));
    check(Math.abs(mark.cy) > 2, 'vortex is off the x axis');
    check(Math.abs(screen[1] - mark.cy * tilt) < 1.5, 'tilt ' + tilt);
  }

  const src = fs.readFileSync('js/renderer.js', 'utf8');
  const fox = src.slice(src.indexOf('kind === "fusion_foxiai"'), src.indexOf('kind === "fusion_exorcistblade"'));
  check(fox.includes('line:') && fox.includes('hitSet'), 'D1 stays');
  const thunder = src.slice(src.indexOf('kind === "fusion_thundercircle"'), src.indexOf('kind === "fusion_exorcistseal"'));
  check(thunder.includes('0.25') && thunder.includes('0.12'), 'D2 caps stay');

  const outDir = path.join('scratch', 'fusion-vfx-polish-grok-d3');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'oracle-check.json'), JSON.stringify({ rows, bad, fan: telegraph.box.images.length, vortex: vortex.box.images.length }, null, 2));
  console.log(rows.join('\n'));
  assert.equal(bad.length, 0, bad.join('\n'));
});
