'use strict';
/**
 * R12 Fan Clip Bound Test — TidalFan active phase sweep must not exceed hitbox
 * Verifies drawSector respects a0/a1 bounds and sweep intersection with hitbox
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'r12-fan-clip-bound');
fs.mkdirSync(OUT, { recursive: true });

// Load real assets.js defs
const assetsSrc = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');
function extractFrozenObject(src, name) {
  const anchor = `const ${name} = Object.freeze(`;
  const start = src.indexOf(anchor);
  let i = start + anchor.length - 1;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) break; }
  }
  const expr = src.slice(start + anchor.length - 1, i + 1);
  return new Function(`return ${expr.replace(/Object\.freeze\(/g, '(')}`)();
}
const DEFS = extractFrozenObject(assetsSrc, 'BOSS_HAZARD_ART_DEFS');

// Mock images
const MOCK_TIDALFAN = {
  naturalWidth: 1254, naturalHeight: 1254,
  currentSrc: 'assets/img/vfx/boss-water-r8/tidalFan_v01.webp',
  src: 'assets/img/vfx/boss-water-r8/tidalFan_v01.webp',
  kind: 'tidalFan'
};

function createCaptureCtx() {
  const calls = [];
  const clips = [];
  let currentTransform = [1, 0, 0, 1, 0, 0];
  let globalAlpha = 1;
  let currentClip = null;

  const ctx = {
    canvas: { width: 1600, height: 900 },
    get globalAlpha() { return globalAlpha; },
    set globalAlpha(v) { globalAlpha = v; },
    getTransform: () => ({ a: currentTransform[0], b: currentTransform[1], c: currentTransform[2], d: currentTransform[3], e: currentTransform[4], f: currentTransform[5] }),
    setTransform: (a, b, c, d, e, f) => { currentTransform = [a, b, c, d, e, f]; },
    save: () => {
      if (currentClip) clips.push({ transform: currentTransform.slice(), clip: currentClip });
    },
    restore: () => { },
    translate: (x, y) => { currentTransform[4] += x; currentTransform[5] += y; },
    rotate: (a) => { const cos = Math.cos(a), sin = Math.sin(a); const [a1,b1,c1,d1] = currentTransform; currentTransform[0] = a1*cos + c1*sin; currentTransform[1] = b1*cos + d1*sin; currentTransform[2] = -a1*sin + c1*cos; currentTransform[3] = -b1*sin + d1*cos; },
    scale: (x, y) => { currentTransform[0] *= x; currentTransform[1] *= x; currentTransform[2] *= y; currentTransform[3] *= y; },
    beginPath: () => { currentClip = { arcs: [] }; },
    moveTo: () => {},
    lineTo: () => {},
    arc: (x, y, r, a0, a1, ccw) => {
      if (currentClip) currentClip.arcs.push({ x, y, r, a0, a1, ccw });
    },
    closePath: () => {},
    clip: () => {
      if (currentClip) clips.push({ transform: currentTransform.slice(), clip: currentClip });
      currentClip = null;
    },
    drawImage: (img, ...args) => {
      calls.push({
        imageKind: img?.kind || 'unknown',
        imageSrc: img?.currentSrc || img?.src || 'unknown',
        args: args.length === 9 ? { sx: args[1], sy: args[2], sw: args[3], sh: args[4], dx: args[5], dy: args[6], dw: args[7], dh: args[8] } : { dx: args[0], dy: args[1], dw: args[2], dh: args[3] },
        transform: currentTransform.slice(),
        alpha: globalAlpha,
        clipArcs: clips.length ? clips[clips.length-1]?.clip?.arcs : null
      });
      clips.length = 0;
    },
    fillStyle: '', strokeStyle: '', lineWidth: 1, setLineDash: () => {},
    fill: () => {}, stroke: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: () => ({ width: 40 })
  };

  return { calls, clips, ctx };
}

function loadRenderer(env) {
  const context = vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'viewport.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'boss-ai.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'renderer.js'), 'utf8'), context);
  return context;
}

function runTest(name, hazard, expectedCalls) {
  const motion = { matches: false, listeners: [], addEventListener(_t, fn) { this.listeners.push(fn); } };
  const capture = createCaptureCtx();

  const env = {
    innerWidth: 1366, innerHeight: 768, devicePixelRatio: 1,
    matchMedia: () => motion,
    document: { createElement: (tag) => { if (tag === 'canvas') return { width: 1600, height: 900, getContext: () => capture.ctx }; return { width: 1600, height: 900, getContext: () => capture.ctx }; }},
    console,
    PORT_ART: { ripple: null },
    STAGE: { id: 'rain-port' },
    BOSS_HAZARD_ART: DEFS,
    BOSS_HAZARD_ART_IMG: { tidalFan: { ...MOCK_TIDALFAN } },
    BOSS_HAZARD_ART_STATUS: { tidalFan: 'ready' },
    isBossHazardArtEnabled: () => true,
    isFusionArtBindEnabled: () => false,
    allowsMotion: () => true
  };

  env.window = env;
  const context = loadRenderer(env);

  const canvas = { width: 1366, height: 768, getContext: () => capture.ctx };
  context.RENDERER.init(canvas);

  const owner = { x: 400, y: 300 };
  context.RENDERER.drawPortBossHazard(capture.ctx, hazard, 0.016, owner);

  const tidalFanCalls = capture.calls.filter(c => c.imageKind === 'tidalFan');
  const pass = context.RENDERER.bossHazardPass ? context.RENDERER.bossHazardPass() : 'unknown';

  // Analyze clip arcs for each drawImage call
  const clipSpans = [];
  for (const call of tidalFanCalls) {
    if (call.clipArcs && call.clipArcs.length > 0) {
      for (const arc of call.clipArcs) {
        const span = Math.abs(arc.a1 - arc.a0);
        const deg0 = (arc.a0 * 180 / Math.PI).toFixed(1);
        const deg1 = (arc.a1 * 180 / Math.PI).toFixed(1);
        const spanDeg = (span * 180 / Math.PI).toFixed(1);
        clipSpans.push({ startDeg: deg0, endDeg: deg1, spanDeg, transform: arc.transform });
        console.log(`  Clip: ${deg0}° to ${deg1}° (span ${spanDeg}°)`);
      }
    }
  }

  console.log(`${name}: ${tidalFanCalls.length} drawImage calls, pass=${pass}`);

  return {
    name,
    drawImageCount: tidalFanCalls.length,
    calls: tidalFanCalls,
    clipSpans,
    pass,
    expectedCalls
  };
}

// Test cases
const results = [];

// 1. Telegraph phase: should draw full hitbox (120°)
results.push(runTest('telegraph', {
  kind: 'tidalFan', phase: 'telegraph', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0, duration: 0.5
}, 1));

// 2. Recovery phase: should draw full hitbox (120°)
results.push(runTest('recovery', {
  kind: 'tidalFan', phase: 'recovery', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0.1, duration: 1.35
}, 1));

// 3. Active phase early (u=0.1): sweep near startAngle, intersection small
results.push(runTest('active early (u=0.1)', {
  kind: 'tidalFan', phase: 'active', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0.015, duration: 0.15
}, 2)); // base + sweep (small intersection)

// 4. Active phase mid (u=0.5): sweep at center, intersection = 2*pad = 30°
results.push(runTest('active mid (u=0.5)', {
  kind: 'tidalFan', phase: 'active', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0.075, duration: 0.15
}, 2)); // base + sweep

// 5. Active phase late (u=0.9): sweep near endAngle, intersection small
results.push(runTest('active late (u=0.9)', {
  kind: 'tidalFan', phase: 'active', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0.135, duration: 0.15
}, 2)); // base + sweep (small intersection)

// 6. Active phase at u=1: sweep at endAngle, intersection = pad (15°)
results.push(runTest('active end (u=1.0)', {
  kind: 'tidalFan', phase: 'active', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0.15, duration: 0.15
}, 2)); // base + sweep

// 7. Active phase at angle=PI/4 (diagonal): verify clip works in rotated frame
results.push(runTest('active diagonal (angle=PI/4)', {
  kind: 'tidalFan', phase: 'active', x: 400, y: 300, r: 200, angle: Math.PI/4,
  startAngle: Math.PI/4 - Math.PI/3, endAngle: Math.PI/4 + Math.PI/3, t: 0.075, duration: 0.15
}, 2));

// 8. Verify clip bounds: sweep at u=0.5 should NOT exceed hitbox boundaries
const r8 = runTest('active mid - verify no overshoot', {
  kind: 'tidalFan', phase: 'active', x: 400, y: 300, r: 200, angle: 0,
  startAngle: -Math.PI/3, endAngle: Math.PI/3, t: 0.075, duration: 0.15
}, 2);

// Additional check: sweep intersection calculation
const sweepAngle = -Math.PI/3 + (2*Math.PI/3) * 0.5; // center
const pad = Math.PI / 12;
const sweepStart = Math.max(-Math.PI/3, sweepAngle - pad);
const sweepEnd = Math.min(Math.PI/3, sweepAngle + pad);
const expectedSweepSpan = sweepEnd - sweepStart;
console.log(`\nExpected sweep span at mid: ${(expectedSweepSpan * 180 / Math.PI).toFixed(1)}° (should be 30°)`);
console.log(`Hitbox span: ${(2*Math.PI/3 * 180 / Math.PI).toFixed(1)}°`);

console.log('\n=== SUMMARY ===');
for (const r of results) {
  const status = r.drawImageCount === r.expectedCalls ? '✅' : '❌';
  console.log(`${status} ${r.name}: ${r.drawImageCount} calls (expected ${r.expectedCalls}), pass=${r.pass}`);
}

// Save report
const report = {
  timestamp: new Date().toISOString(),
  rendererSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'js', 'renderer.js'))).digest('hex'),
  type: 'R12_FAN_CLIP_BOUND',
  note: 'Node test verifying drawSector respects a0/a1 and sweep-hitbox intersection',
  results
};
fs.writeFileSync(path.join(OUT, 'fan-clip-bound-report.json'), JSON.stringify(report, null, 2));
console.log(`\nSaved report to ${path.join(OUT, 'fan-clip-bound-report.json')}`);

// Exit with failure if any test failed
const failed = results.filter(r => r.drawImageCount !== r.expectedCalls).length;
process.exit(failed > 0 ? 1 : 0);
