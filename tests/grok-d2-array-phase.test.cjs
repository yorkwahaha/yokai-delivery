'use strict';
// D2-GROK-ARRAY-R1：融合靈陣 intro→active→hit→fade，對照普通淨化靈陣。
// 不讀音訊／SW／KEY。
//   node --require ./tools/director-audio-freeze.cjs --test tests/grok-d2-array-phase.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ASSETS_SHA = '342d89f9134fcc027c8bfadab72bbc971cb82287f466141ae961f05f04a8dd48';
const GAME_SHA = 'bc0e70af9dfd84b4a6a1addfb9ced3870fb16f77182a30291d0a119160c1e18c';
const OX = 1000;
const OY = 2000;
const WARN_ELAPSED = Math.PI / 20;

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
    save() { stack.push({ m: m.slice(), a: ctx.globalAlpha }); },
    restore() {
      const prev = stack.pop();
      m = prev ? prev.m : [1, 0, 0, 1, 0, 0];
      ctx.globalAlpha = prev ? prev.a : 1;
    },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) {
      const c = Math.cos(a), s = Math.sin(a);
      m = mul(m, [c, s, -s, c, 0, 0]);
    },
    beginPath() {},
    stroke() { strokes += 1; },
    fill() { fills += 1; },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (arguments.length === 5) images.push({ img, alpha: ctx.globalAlpha, dx: sx, dy: sy, dw: sw, dh: sh, m: m.slice(), sx: 0, sy: 0, sw: img.naturalWidth || 1, sh: img.naturalHeight || 1 });
      else images.push({ img, alpha: ctx.globalAlpha, sx, sy, sw, sh, dx, dy, dw, dh, m: m.slice() });
    }
  };
  return {
    ctx: new Proxy(ctx, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } }),
    images,
    fills: () => fills,
    strokes: () => strokes
  };
}
function dummyCtx() {
  const grad = { addColorStop() {} };
  const ctx = {
    globalAlpha: 1,
    canvas: { width: 8, height: 8 },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad
  };
  return new Proxy(ctx, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
}

const thunder = { role: 'thunder-field', centerOpaque: true, warm: false, naturalWidth: 1264, naturalHeight: 848 };
const fireGround = { role: 'fire-ground', centerOpaque: false, warm: true, naturalWidth: 1264, naturalHeight: 848 };
const fireSeal = { role: 'fire-seal', centerOpaque: false, warm: true, naturalWidth: 1264, naturalHeight: 848 };
const fireHit = { role: 'fire-hit', centerOpaque: true, warm: true, naturalWidth: 1264, naturalHeight: 848 };
const purification = { role: 'purification', centerOpaque: false, warm: false, naturalWidth: 1024, naturalHeight: 1024 };
const BBOX = [68, 82, 1197, 797];
const FIRE_BBOX = {
  main: [186, 109, 1066, 699],
  hit: [302, 137, 980, 706],
  ground: [131, 188, 1129, 670]
};

function load() {
  const env = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    document: { createElement: () => ({ width: 8, height: 8, getContext: () => dummyCtx() }) },
    console,
    ART: {},
    Math,
    barrierCoreArt: () => purification,
    barrierArtTier: () => ({ scale: 1, alpha: 0.9, artKey: 'barrier_core_main' })
  };
  env.window = env;
  const context = vm.createContext(env);
  vm.runInContext(fs.readFileSync('js/viewport.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/fx.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/skillfx.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/renderer.js', 'utf8'), context);
  context.isFusionArtBindEnabled = () => true;
  context.getFusionPhaseArt = (kind, phase) => {
    if (kind === 'fusion_thundercircle' && (phase === 'main' || phase === 'hit' || phase === 'ground')) return thunder;
    if (kind === 'fusion_foxfirebarrier' && phase === 'ground') return fireGround;
    if (kind === 'fusion_foxfirebarrier' && phase === 'main') return fireSeal;
    if (kind === 'fusion_foxfirebarrier' && phase === 'hit') return fireHit;
    return null;
  };
  context.getFusionArtBindDef = (kind, phase) => {
    if (kind === 'fusion_thundercircle' && (phase === 'main' || phase === 'hit' || phase === 'ground')) {
      return { bbox: BBOX.slice(), size: [1264, 848] };
    }
    if (kind === 'fusion_foxfirebarrier' && FIRE_BBOX[phase]) {
      return { bbox: FIRE_BBOX[phase].slice(), size: [1264, 848] };
    }
    return null;
  };
  return context;
}
const env = load();

function project(x, y, k) { return [x, k * y]; }
function centerOf(draw) {
  return apply(draw.m, draw.dx + draw.dw / 2, draw.dy + draw.dh / 2);
}
function screenH(draw) {
  const top = apply(draw.m, draw.dx + draw.dw / 2, draw.dy);
  const bot = apply(draw.m, draw.dx + draw.dw / 2, draw.dy + draw.dh);
  return Math.hypot(bot[0] - top[0], bot[1] - top[1]);
}
function tiltWorld(box, k) { if (k !== 1) box.ctx.scale(1, k); }
function visible(draws) { return draws.filter(d => d.img && d.alpha > 0.02); }
function cover(draws) {
  const onCaster = visible(draws).filter(d => d.img.centerOpaque && Math.hypot(centerOf(d)[0] - OX, centerOf(d)[1] - OY) < 30);
  return onCaster.reduce((acc, d) => 1 - (1 - acc) * (1 - d.alpha), 0);
}

function renderFusion(tilt, effect, elapsed) {
  env.VIEWPORT.setTiltScale(tilt);
  const box = makeCtx();
  tiltWorld(box, tilt);
  env.RENDERER.drawFusionFx(box.ctx, effect, elapsed);
  return { draws: box.images.filter(d => d.img && d.img.role), fills: box.fills(), strokes: box.strokes() };
}
function renderOrdinary(tilt) {
  env.VIEWPORT.setTiltScale(tilt);
  env.SKILLFX.reset();
  env.SKILLFX.play('barrier', 'cast', 1, { x: OX, y: OY, r: 150 });
  env.SKILLFX.update(0.2);
  const box = makeCtx();
  tiltWorld(box, tilt);
  env.SKILLFX.drawArtFx(box.ctx, true);
  return { draws: box.images.filter(d => d.img && d.img.role) };
}
function fx(kind, phase, extra) {
  return Object.assign({
    kind,
    phase,
    x: OX,
    y: OY,
    angle: 0,
    radius: kind === 'fusion_thundercircle' ? 240 : 150,
    progress: phase === 'fade' ? 0.9 : 0.5,
    seed: 1,
    burnAge: phase === 'warn' ? 0.05 : 0.4,
    life: 2,
    pulseInterval: 0.35,
    pulseIndex: 0,
    nextPulse: 0.47,
    strikes: []
  }, extra || {});
}

test('assets/game 凍結，普通靈陣與融合靈陣是不同真圖 consumer', () => {
  assert.equal(sha256('js/assets.js'), ASSETS_SHA);
  assert.equal(sha256('js/game.js'), GAME_SHA);
  const ordinary = renderOrdinary(1);
  const fusion = renderFusion(1, fx('fusion_thundercircle', 'active'), 0);
  assert.ok(ordinary.draws.some(d => d.img === purification && d.alpha > 0.4));
  assert.ok(!ordinary.draws.some(d => d.img === thunder || d.img === fireSeal));
  assert.ok(fusion.draws.some(d => d.img === thunder));
  assert.ok(!fusion.draws.some(d => d.img === purification));
});

test('雷陣／妖火結界 phase 層級、R4 上限、2D/.60，且不持續遮住玩家中心', () => {
  const bad = [];
  const rows = [];
  const check = (cond, msg) => { if (!cond) bad.push(msg); };
  const note = (label, drawn) => {
    const parts = visible(drawn.draws).map(d => `${d.img.role}@${d.alpha.toFixed(3)} w=${Math.round(d.dw)}`);
    rows.push(`${label} cover=${cover(drawn.draws).toFixed(3)} fill=${drawn.fills} ${parts.join(' ')}`);
  };
  const one = (drawn, role) => visible(drawn.draws).filter(d => d.img.role === role);

  const thunderWarn = renderFusion(1, fx('fusion_thundercircle', 'warn'), WARN_ELAPSED);
  const thunderActive = renderFusion(1, fx('fusion_thundercircle', 'active'), 0);
  const strike = { x: OX + 180, y: OY + 30, delay: -0.05, triggered: true, radius: 90 };
  const thunderHit = renderFusion(1, fx('fusion_thundercircle', 'active', { strikes: [strike, { x: OX - 160, y: OY, delay: 0.4, triggered: false, radius: 90 }] }), 0);
  const thunderFade = renderFusion(1, fx('fusion_thundercircle', 'fade', { strikes: [{ x: OX + 180, y: OY, delay: -0.4, triggered: true, radius: 90 }] }), 0);
  const fireWarn = renderFusion(1, fx('fusion_foxfirebarrier', 'warn'), WARN_ELAPSED);
  const fireActive = renderFusion(1, fx('fusion_foxfirebarrier', 'active'), 0);
  const firePulse = renderFusion(1, fx('fusion_foxfirebarrier', 'active', { pulseIndex: 1, burnAge: 0.12, nextPulse: 0.47 }), 0);
  const fireFade = renderFusion(1, fx('fusion_foxfirebarrier', 'fade'), 0);
  for (const [label, drawn] of [['t-warn', thunderWarn], ['t-active', thunderActive], ['t-hit', thunderHit], ['t-fade', thunderFade], ['f-warn', fireWarn], ['f-active', fireActive], ['f-pulse', firePulse], ['f-fade', fireFade]]) note(label, drawn);

  const tWarnMain = one(thunderWarn, 'thunder-field').filter(d => d.dw < 400);
  const tActiveMain = one(thunderActive, 'thunder-field');
  check(tActiveMain.length >= 1, 'thunder active draws the R4 field');
  const activeMain = tActiveMain.reduce((m, d) => Math.max(m, d.alpha), 0);
  const warnMain = one(thunderWarn, 'thunder-field').reduce((m, d) => Math.max(m, d.alpha), 0);
  check(activeMain <= 0.25 + 1e-6, 'thunder active layer alpha ' + activeMain);
  check(one(thunderActive, 'thunder-field').every(d => d.alpha <= 0.25 + 1e-6), 'thunder active every layer <=0.25 except ground cap');
  const activeGround = Math.min(...one(thunderActive, 'thunder-field').map(d => d.alpha));
  check(activeGround <= 0.12 + 1e-6, 'thunder active ground <=0.12 got ' + activeGround);
  check(warnMain < activeMain, 'thunder intro main is quieter than active');
  check(cover(thunderWarn.draws) < cover(thunderActive.draws), 'thunder intro covers less than active');
  check(cover(thunderActive.draws) <= 0.36, 'thunder active center cover ' + cover(thunderActive.draws));
  check(thunderActive.fills === 0 && thunderActive.strokes === 0, 'thunder bind path draws no center geometry');
  check(thunderHit.fills === 0 && thunderHit.strokes === 0, 'strike frame still has no geometry');
  check(one(thunderActive, 'thunder-field').filter(d => d.alpha > 0.12).length >= 1, 'thunder active seal is visible');
  const hits = one(thunderHit, 'thunder-field').filter(d => d.alpha > 0.12 && d.dw < one(thunderHit, 'thunder-field').reduce((m, d) => Math.max(m, d.dw), 0) - 20);
  check(hits.length === 1, 'one short thunder hit, got ' + hits.length);
  if (hits[0]) {
    check(hits[0].alpha <= 0.35 + 1e-6, 'thunder hit flash <=0.35');
    const at = centerOf(hits[0]);
    const want = project(strike.x, strike.y, 1);
    check(Math.hypot(at[0] - want[0], at[1] - want[1]) < 2, 'thunder hit sits on the strike');
    check(Math.hypot(at[0] - OX, at[1] - OY) > 40, 'thunder hit is not stuck on the caster');
  }
  check(thunderFade.draws.filter(d => d.img.role === 'thunder-field').length === 2, 'thunder fade keeps ground and seal only');
  check(!thunderFade.draws.some(d => d.img.role === 'thunder-field' && d.dw < 200 && d.alpha > 0.02), 'thunder fade has no strike flash');
  check(one(thunderFade, 'thunder-field').every(d => d.alpha < activeMain), 'thunder fade is below active');
  check(!one(thunderFade, 'thunder-field').some(d => Math.hypot(centerOf(d)[0] - (OX + 180), centerOf(d)[1] - OY) < 20 && d.alpha > 0.02), 'expired strike draws no hit');
  const warnWide = Math.max(...one(thunderWarn, 'thunder-field').map(d => d.dw));
  const activeWide = Math.max(...one(thunderActive, 'thunder-field').map(d => d.dw));
  check(warnWide < activeWide, 'thunder intro is smaller than the active field');

  check(one(fireWarn, 'fire-ground').length === 1, 'foxfire intro is the fire ground only');
  check(one(fireWarn, 'fire-seal').length === 0 && one(fireWarn, 'fire-hit').length === 0, 'foxfire intro has no seal or hit');
  check(one(fireActive, 'fire-ground').length === 1 && one(fireActive, 'fire-seal').length === 1, 'foxfire active has ground and seal');
  check(one(fireActive, 'fire-hit').length === 0, 'foxfire active does not keep the opaque hit on the player');
  check(cover(fireActive.draws) < 0.05, 'foxfire steady center stays open');
  check(one(fireActive, 'fire-seal')[0] && one(fireActive, 'fire-ground')[0].alpha < one(fireActive, 'fire-seal')[0].alpha, 'warm seal reads above the fire ground');
  check(one(fireWarn, 'fire-ground')[0] && one(fireActive, 'fire-ground')[0].dw > one(fireWarn, 'fire-ground')[0].dw, 'foxfire field opens from intro to active');
  const pulse = one(firePulse, 'fire-hit');
  check(pulse.length === 1 && pulse[0].alpha > 0.2 && pulse[0].alpha <= 0.35 + 1e-6, 'foxfire hit is a short capped flash');
  check(one(fireFade, 'fire-hit').length === 0, 'foxfire fade has no hit');
  check(one(fireFade, 'fire-seal').length === 1 && one(fireFade, 'fire-seal')[0].alpha < one(fireActive, 'fire-seal')[0].alpha, 'foxfire fade seal dims');
  check(fireActive.draws.every(d => d.img.warm) && thunderActive.draws.every(d => !d.img.warm), 'warm foxfire vs cool thunder');
  check(!fireActive.draws.some(d => d.img === purification) && !thunderActive.draws.some(d => d.img === purification), 'fusion does not reuse the ordinary mandala');

  for (const tilt of [1, 0.6]) {
    const fusion = renderFusion(tilt, fx('fusion_thundercircle', 'active'), 0);
    const ordinary = renderOrdinary(tilt);
    const field = one(fusion, 'thunder-field').sort((a, b) => b.dw - a.dw)[0];
    const plain = ordinary.draws.find(d => d.img === purification);
    check(!!field && !!plain, 'both consumers draw at tilt ' + tilt);
    if (field && plain) {
      const fr = screenH(field) / field.dh;
      const pr = screenH(plain) / plain.dh;
      rows.push(`tilt ${tilt} fusionSpan=${fr.toFixed(3)} ordinarySpan=${pr.toFixed(3)} anchorY=${centerOf(field)[1].toFixed(1)}`);
      check(Math.abs(centerOf(field)[1] - project(OX, OY, tilt)[1]) < 1.5, 'fusion anchor follows tilt ' + tilt);
      if (tilt === 1) {
        check(fr > 0.92 && pr > 0.92, '2D both seals keep their pixel height');
      } else {
        check(fr > 0.92, 'fusion seal stays upright at .60');
        check(pr > 0.5 && pr < 0.72, 'ordinary mandala stays on the tilted ground');
      }
    }
  }

  const src = fs.readFileSync('js/renderer.js', 'utf8');
  const fox = src.slice(src.indexOf('kind === "fusion_foxiai"'), src.indexOf('kind === "fusion_exorcistblade"'));
  check(fox.includes('line:') && fox.includes('hitSet'), 'D1 foxiai line/hitSet stays');
  check(!fox.includes('fusion_thundercircle'), 'D2 does not rewrite the foxiai block');

  const outDir = path.join('scratch', 'fusion-vfx-polish-grok-d2');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'phase-alpha.json'), JSON.stringify({ rows, bad }, null, 2));
  console.log(rows.join('\n'));
  assert.equal(bad.length, 0, bad.join('\n'));
});
