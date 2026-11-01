'use strict';
// BOSS-IMAGE-QA-R2：四標準 Boss hazard（slam/charge/ring/tide）＋雨港
// tidalFan/rainVortex 的 Node 契約／幾何 QA。
//
//   node --require ./tools/director-audio-freeze.cjs \
//        --require ./scratch/boss-image-qa-r1/read-audit.cjs \
//        --test tests/boss-image-qa-r1.test.cjs
//
// 本檔只讀 js/assets.js、js/renderer.js、js/game.js、js/viewport.js、
// js/boss-ai.js；不讀 audio.js／音檔／KEY／env。
//
// Node 圖像 fixture 使用 assets.js 的真 BOSS_HAZARD_ART defs（真來源路徑、
// 真 WebP 標頭尺寸、真 alpha bbox），不是全部 mock 成 ripple；但 Node 沒有
// 真 Canvas 解碼，drawImage 覆蓋率只是幾何足跡，不是像素 PASS。
// 真像素／真 drawImage／真 AI 由 scratch/boss-image-qa-r1/verify.cjs 的
// 真 Chrome 收件；兩者不可互相代替。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'boss-image-qa-r1');
const KINDS = ['slam', 'charge', 'ring', 'tide', 'tidalFan', 'rainVortex'];
const STANDARD_KINDS = ['slam', 'charge', 'ring', 'tide'];
const PHASES = ['telegraph', 'active', 'recovery'];

// ---------- real assets.js defs + real WebP headers ----------
function extractFrozenObject(src, name) {
  const anchor = `const ${name} = Object.freeze(`;
  const start = src.indexOf(anchor);
  assert.ok(start >= 0, `${name} 必須存在`);
  let i = start + anchor.length - 1; // at '(' of Object.freeze(
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  assert.ok(depth === 0, `${name} 括號必須閉合`);
  const expr = src.slice(start + anchor.length - 1, i + 1);
  return new Function(`return ${expr.replace(/Object\.freeze\(/g, '(')}`)();
}

function webpSize(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', file + ' RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP', file + ' WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + b.readUIntLE(24, 3),
      height: 1 + b.readUIntLE(27, 3)
    };
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  throw new Error('unknown WebP chunk ' + chunk + ' in ' + file);
}

const assetsSrc = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');
const DEFS = extractFrozenObject(assetsSrc, 'BOSS_HAZARD_ART_DEFS');
const IMG = {};
for (const kind of KINDS) {
  const def = DEFS[kind];
  assert.ok(def, 'defs.' + kind);
  const file = path.join(ROOT, def.source);
  assert.ok(fs.existsSync(file), kind + ' source exists: ' + def.source);
  const size = webpSize(file);
  IMG[kind] = {
    naturalWidth: size.width,
    naturalHeight: size.height,
    currentSrc: def.source,
    src: def.source,
    role: 'boss-hazard-' + kind
  };
}

// ---------- display-list ctx（只做幾何足跡，不解碼 alpha） ----------
function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
function matApply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function matInv(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return null;
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det
  ];
}
function sampleArc(x, y, r, a0, a1, ccw) {
  let span = a1 - a0;
  if (ccw) { while (span > 0) span -= Math.PI * 2; }
  else { while (span < 0) span += Math.PI * 2; }
  const steps = Math.max(8, Math.ceil(Math.abs(span) / (Math.PI / 72)));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + span * (i / steps);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}
function makeCtx(width = 1600, height = 900) {
  let m = [1, 0, 0, 1, 0, 0];
  const state = { m, alpha: 1, lineWidth: 1, lineCap: 'butt', strokeStyle: '', fillStyle: '' };
  const stack = [];
  let subpaths = [];
  let current = null;
  const clips = [];
  const images = [];
  let fills = 0;
  let strokes = 0;
  let fillRects = 0;
  const ctx = {
    canvas: { width, height },
    get globalAlpha() { return state.alpha; },
    set globalAlpha(v) { state.alpha = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v) { state.lineWidth = v; },
    get lineCap() { return state.lineCap; },
    set lineCap(v) { state.lineCap = v; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v) { state.strokeStyle = v; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v) { state.fillStyle = v; },
    save() {
      stack.push({
        m: state.m.slice(), alpha: state.alpha, lineWidth: state.lineWidth,
        lineCap: state.lineCap, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle,
        clips: clips.map((c) => c)
      });
    },
    restore() {
      const p = stack.pop();
      if (!p) return;
      state.m = p.m; state.alpha = p.alpha; state.lineWidth = p.lineWidth;
      state.lineCap = p.lineCap; state.strokeStyle = p.strokeStyle; state.fillStyle = p.fillStyle;
      clips.length = 0; clips.push(...p.clips);
    },
    translate(x, y) { state.m = matMul(state.m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { state.m = matMul(state.m, [x, 0, 0, y, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); state.m = matMul(state.m, [c, s, -s, c, 0, 0]); },
    beginPath() { subpaths = []; current = null; },
    moveTo(x, y) { current = { pts: [[x, y]], closed: false }; subpaths.push(current); },
    lineTo(x, y) { if (!current) ctx.moveTo(x, y); else current.pts.push([x, y]); },
    arc(x, y, r, a0 = 0, a1 = Math.PI * 2, ccw = false) {
      const pts = sampleArc(x, y, r, a0, a1, ccw);
      if (!current) { current = { pts: [], closed: false }; subpaths.push(current); }
      current.pts.push(...pts);
    },
    ellipse() {},
    quadraticCurveTo() {},
    closePath() { if (current) current.closed = true; },
    clip() {
      clips.push({
        m: state.m.slice(),
        subpaths: subpaths.map((s) => ({ pts: s.pts.map((p) => p.slice()), closed: s.closed }))
      });
      subpaths = []; current = null;
    },
    setLineDash() {},
    fill() { fills += 1; },
    fillRect() { fillRects += 1; },
    stroke() { strokes += 1; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      // bossImageBox 只走 9 參數裁切；其他路徑記 5 參數。
      const box = arguments.length >= 9
        ? { dx, dy, dw, dh }
        : { dx: sx, dy: sy, dw: sw, dh: sh };
      images.push({
        img, ...box,
        s: arguments.length >= 9 ? { sx, sy, sw, sh } : null,
        m: state.m.slice(), alpha: state.alpha, clips: clips.slice()
      });
    }
  };
  return {
    ctx, images, clips,
    fills: () => fills,
    fillRects: () => fillRects,
    strokes: () => strokes,
    pathSubpaths: () => subpaths,
    matrix: () => state.m.slice()
  };
}

function winding(pts, x, y) {
  let w = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a[1] <= y) {
      if (b[1] > y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) > 0) w += 1;
    } else if (b[1] <= y && (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1]) < 0) w -= 1;
  }
  return w;
}
function inClip(clip, x, y) {
  const inv = matInv(clip.m);
  if (!inv) return false;
  const [lx, ly] = matApply(inv, x, y);
  let w = 0;
  for (const sp of clip.subpaths) {
    if (sp.pts.length < 3) continue;
    w += winding(sp.pts, lx, ly);
  }
  return w !== 0;
}
// 幾何足跡：drawImage 的 bbox dest rect（未計 alpha）。負向「不得覆蓋」因此
// 是 sound；正向只證明圖片幾何到點，真像素由 Chrome 收件。
function inImage(im, x, y) {
  const inv = matInv(im.m);
  if (!inv) return false;
  const [lx, ly] = matApply(inv, x, y);
  return lx >= im.dx && lx <= im.dx + im.dw && ly >= im.dy && ly <= im.dy + im.dh;
}
function coveredAt(box, x, y) {
  return box.images.some((im) => im.clips.every((c) => inClip(c, x, y)) && inImage(im, x, y));
}
function imageExtents(box) {
  const xs = [];
  const ys = [];
  for (const im of box.images) {
    const corners = [
      [im.dx, im.dy], [im.dx + im.dw, im.dy],
      [im.dx, im.dy + im.dh], [im.dx + im.dw, im.dy + im.dh]
    ].map(([x, y]) => matApply(im.m, x, y));
    for (const [x, y] of corners) { xs.push(x); ys.push(y); }
  }
  return {
    minX: xs.length ? Math.min(...xs) : 0,
    maxX: xs.length ? Math.max(...xs) : 0,
    minY: ys.length ? Math.min(...ys) : 0,
    maxY: ys.length ? Math.max(...ys) : 0
  };
}

// ---------- vm loader：真 renderer + 真 assets defs ----------
function loadRenderer() {
  const motion = {
    matches: false, listeners: [],
    addEventListener(_t, fn) { this.listeners.push(fn); },
    addListener(fn) { this.listeners.push(fn); }
  };
  const env = {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    matchMedia: () => motion,
    document: { createElement: () => ({ getContext: () => ({}) }) },
    console,
    PORT_ART: { ripple: null },
    STAGE: { id: 'rain-port' },
    BOSS_HAZARD_ART: DEFS,
    BOSS_HAZARD_ART_IMG: { ...IMG },
    BOSS_HAZARD_ART_STATUS: Object.fromEntries(KINDS.map((k) => [k, 'ready'])),
    isBossHazardArtEnabled: () => true,
    isFusionArtBindEnabled: () => false
  };
  env.window = env;
  const context = vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/viewport.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/boss-ai.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/renderer.js'), 'utf8'), context);
  return { env, motion };
}

// ---------- game.js C3 delegate (4-arg) ----------
function loadGameDraw() {
  const src = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
  const start = src.indexOf('  function drawBossHazard(h, owner) {');
  const end = src.indexOf('  let frameShakeOffset');
  assert.ok(start > 0 && end > start, 'game.js drawBossHazard(h, owner) 必須存在且位於 frameShakeOffset 前');
  const body = src.slice(start, end);
  assert.ok(body.includes('portDraw(ctx, h, elapsed, owner)'), 'game 必須把 owner 作第 4 參數轉交');
  assert.ok(body.includes('=== true'), '只有 strict true 才略過 C3 fallback');
  return new Function('RENDERER', 'ctx', 'elapsed', `${body}\nreturn drawBossHazard;`);
}
function gameCtx() {
  const ops = [];
  const c = {
    ops, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '',
    save() { ops.push(['save']); },
    restore() { ops.push(['restore']); },
    beginPath() { ops.push(['begin']); },
    arc(x, y, r, a0, a1) { ops.push(['arc', x, y, r, a0, a1]); },
    stroke() { ops.push(['stroke', c.strokeStyle, c.lineWidth, c.globalAlpha]); },
    fill() { ops.push(['fill', c.fillStyle, c.globalAlpha]); },
    moveTo(x, y) { ops.push(['move', x, y]); },
    lineTo(x, y) { ops.push(['line', x, y]); }
  };
  return c;
}

const loaded = loadRenderer();
const env = loaded.env;
function bossGate(on) { env.isBossHazardArtEnabled = () => on === true; }
function fusionGate(on) { env.isFusionArtBindEnabled = () => on === true; }
function call(h, elapsed = 1, owner = null, tilt = 1) {
  const box = makeCtx();
  if (tilt !== 1) box.ctx.scale(1, tilt);
  const handled = env.RENDERER.drawBossHazard(box.ctx, h, elapsed, owner);
  return { handled, box, pass: env.RENDERER.bossHazardPass() };
}
function hazard(kind, phase, extra) {
  const base = {
    kind, phase, x: 400, y: 500, angle: 0,
    r: kind === 'slam' ? 150 : kind === 'charge' ? 52 : kind === 'ring' ? 80 : 0,
    t: 0, duration: 0.5, hit: false
  };
  return Object.assign(base, extra || {});
}
function restoreGates() {
  bossGate(true);
  fusionGate(false);
  env.PORT_ART.ripple = null;
}

// =====================================================================
// A. assets 契約：真來源、真 WebP 尺寸、真 bbox、獨立 gate
// =====================================================================
test('A. BOSS_HAZARD_ART 所有 kind 使用真 WebP 來源，尺寸／bbox／狀態一致', () => {
  assert.deepEqual(Object.keys(DEFS).sort(), KINDS.slice().sort());
  for (const kind of KINDS) {
    const def = DEFS[kind];
    const file = path.join(ROOT, def.source);
    assert.ok(def.source.startsWith('assets/img/'), kind + ' source in assets/img');
    assert.equal(def.status, 'ART_CANDIDATE', kind + ' 不得冒稱 ART_PASS');
    assert.ok(/\.webp$/.test(def.source), kind + ' 必須是真 raster WebP');
    const size = webpSize(file);
    assert.equal(def.width, size.width, kind + ' def.width 必須等於真檔');
    assert.equal(def.height, size.height, kind + ' def.height 必須等於真檔');
    assert.equal(def.bbox.length, 4, kind + ' bbox');
    const [l, t, r, b] = def.bbox;
    assert.ok(l >= 0 && t >= 0 && r > l && b > t, kind + ' bbox 有效');
    assert.ok(r <= def.width && b <= def.height, kind + ' bbox 不得超出真檔');
    assert.equal(IMG[kind].naturalWidth, def.width, kind + ' IMG 尺寸');
    assert.equal(IMG[kind].currentSrc, def.source, kind + ' IMG 來源');
  }
  // 不是全部 ripple；至少 slam/charge 各有獨立來源。
  assert.notEqual(DEFS.slam.source, DEFS.charge.source);
  assert.equal(DEFS.slam.source, 'assets/img/vfx/boss-water-r8/tide_v03.webp');
  assert.equal(DEFS.charge.source, 'assets/img/vfx/boss-water-r8/tidalFan_v01.webp');
  // tide 現用專用 tide_v03.webp；ring 仍用 katana_l5
  assert.equal(DEFS.tide.source, 'assets/img/vfx/boss-water-r8/tide_v03.webp');
  assert.equal(DEFS.ring.source, 'assets/img/vfx/raster/katana_l5.webp');
  assert.ok(assetsSrc.includes('BOSS_HAZARD_ART_MISSING'), '缺件清單必須存在');
  assert.ok(assetsSrc.includes('tide, tidalFan, rainVortex now have DEV candidates'), 'tide/tidalFan/rainVortex 現有 DEV 候選');
});

test('A. gate 只認 dev=1 && bossart=1，且不借用 fusion gate', () => {
  const gateSrc = assetsSrc.slice(
    assetsSrc.indexOf('const isBossHazardArtEnabled'),
    assetsSrc.indexOf('window.isBossHazardArtEnabled')
  );
  assert.ok(/dev=1/.test(gateSrc), 'gate dev=1');
  assert.ok(/bossart=1/.test(gateSrc), 'gate bossart=1');
  assert.ok(!/isFusionArtBindEnabled/.test(gateSrc), '不得借用 fusion gate');
  const loadSrc = assetsSrc.slice(
    assetsSrc.indexOf('function loadBossHazardArt'),
    assetsSrc.indexOf('window.refreshBossHazardArt')
  );
  assert.ok(loadSrc.includes('window.BOSS_HAZARD_ART_IMG[kind] = img'), '圖片存 BOSS_HAZARD_ART_IMG');
  assert.ok(loadSrc.includes('window.BOSS_HAZARD_ART_STATUS[kind] = "ready"'), '狀態存 STATUS');
});

// =====================================================================
// B. 真 renderer：四標準 kind × 三相 → IMAGE，來源逐 kind 正確
// =====================================================================
test('B. 四標準 kind × 三相皆 IMAGE，drawImage 用該 kind 真圖，無固體幾何冒充', () => {
  bossGate(true);
  const owner = { x: 400, y: 500 };
  const rows = [];
  for (const kind of STANDARD_KINDS) {
    for (const phase of PHASES) {
      const h = hazard(kind, phase, {
        angle: kind === 'tide' ? Math.PI / 2 : 0,
        t: phase === 'active' ? 0.3 : phase === 'recovery' ? 0.1 : 0,
        duration: 0.6,
        safeOffset: 100, safeWidth: 130,
        gapAngle: Math.PI / 2, gapWidth: Math.PI / 2,
        prevR: 80, progress: 0
      });
      const out = call(h, 1.2, owner);
      assert.equal(out.handled, true, kind + '/' + phase + ' handled');
      assert.equal(out.pass, 'IMAGE', kind + '/' + phase + ' pass=' + out.pass);
      assert.ok(out.box.images.length >= 1, kind + '/' + phase + ' drawImage');
      for (const im of out.box.images) {
        assert.equal(im.img, IMG[kind], kind + '/' + phase + ' 必須用 ' + kind + ' 真圖');
        assert.equal(im.img.currentSrc, DEFS[kind].source, kind + '/' + phase + ' 來源');
        // tide 使用雙岸自定裁切，不強制全 bbox；其它 kind 必須符合 DEFS bbox
        if (kind !== 'tide') {
          const [l, t, r, b] = DEFS[kind].bbox;
          assert.deepEqual(im.s, { sx: l, sy: t, sw: r - l, sh: b - t }, kind + '/' + phase + ' 必須裁真 bbox');
        } else {
          // tide: 驗證來源在 bbox 範圍內
          const [l, t, r, b] = DEFS[kind].bbox;
          assert.ok(im.s.sx >= l && im.s.sx + im.s.sw <= r, kind + '/' + phase + ' sx 在 bbox 內');
          assert.ok(im.s.sy >= t && im.s.sy + im.s.sh <= b, kind + '/' + phase + ' sy 在 bbox 內');
        }
      }
      assert.equal(out.box.fills() + out.box.strokes() + out.box.fillRects(), 0, kind + '/' + phase + ' 不得用幾何');
      rows.push({
        kind, phase, draws: out.box.images.length,
        alpha: out.box.images[0].alpha, pass: out.pass
      });
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'node-matrix.json'), JSON.stringify(rows, null, 2));
});

test('B. 三相視覺真的不同：alpha 與 drawImage 幾何不得三相同值', () => {
  bossGate(true);
  for (const kind of STANDARD_KINDS) {
    const seen = new Set();
    for (const phase of PHASES) {
      const h = hazard(kind, phase, {
        angle: kind === 'tide' ? Math.PI / 2 : 0,
        t: phase === 'active' ? 0.3 : phase === 'recovery' ? 0.1 : 0,
        duration: 0.6, safeOffset: 100, safeWidth: 130,
        gapAngle: Math.PI / 2, gapWidth: Math.PI / 2, prevR: 80, progress: 0
      });
      const out = call(h, 1.2, { x: 400, y: 500 });
      const ext = imageExtents(out.box);
      seen.add(JSON.stringify({
        n: out.box.images.length,
        a: out.box.images.map((im) => Math.round(im.alpha * 1000) / 1000),
        e: [Math.round(ext.minX), Math.round(ext.maxX), Math.round(ext.minY), Math.round(ext.maxY)]
      }));
    }
    assert.equal(seen.size, 3, kind + ' 三相不得共用同一視覺快照');
  }
});

test('B. slam：圖片只在真危險圓 h.r 內，不得 r+30 外擴', () => {
  bossGate(true);
  const h = hazard('slam', 'active', { r: 150 });
  const out = call(h, 1, { x: 400, y: 500 });
  assert.equal(out.pass, 'IMAGE');
  assert.equal(coveredAt(out.box, 400, 500), true, '圓心幾何足跡');
  assert.equal(coveredAt(out.box, 540, 500), true, 'r-10');
  assert.equal(coveredAt(out.box, 565, 500), false, 'r+15 不得被圖覆蓋');
  assert.equal(coveredAt(out.box, 400, 665), false, 'r+15 下方不得外擴');
  const ext = imageExtents(out.box);
  assert.ok(ext.maxX - 400 <= 152, 'maxX 外擴過大: ' + (ext.maxX - 400));
  assert.ok(400 - ext.minX <= 152, 'minX 外擴過大: ' + (400 - ext.minX));
});

test('B. charge：telegraph 用 hazard 起點；active/recovery 用真 owner，缺 owner 不得 IMAGE', () => {
  bossGate(true);
  const h = hazard('charge', 'telegraph', { x: 100, y: 100, angle: 0, r: 52 });
  const out = call(h, 1, { x: 900, y: 500 });
  assert.equal(out.pass, 'IMAGE');
  const ext = imageExtents(out.box);
  assert.ok(ext.minX < 110 && ext.maxX > 480, 'telegraph 必須由 hazard 起點往 +angle: ' + JSON.stringify(ext));
  // 世界長度 = 起點 + 403 路徑 + 2r 端點 + 旋轉方塊外接；不可無限延伸。
  assert.ok(ext.maxX < 700, 'telegraph 長度不得超過 403+2r+旋轉外接: ' + JSON.stringify(ext));
  assert.equal(coveredAt(out.box, 300, 100), true, 'telegraph 中段');
  assert.equal(coveredAt(out.box, 300, 190), false, 'telegraph 橫向 > r 不覆蓋');

  for (const phase of ['active', 'recovery']) {
    const active = call(hazard('charge', phase, { x: 100, y: 100, angle: 0, r: 52, t: 0.1, duration: 0.65 }), 1, { x: 900, y: 500 });
    assert.equal(active.pass, 'IMAGE', phase);
    const ae = imageExtents(active.box);
    assert.ok(Math.abs((ae.minX + ae.maxX) / 2 - 900) < 1, phase + ' 圖中心必須跟 owner: ' + JSON.stringify(ae));
    assert.ok(ae.minX > 800 && ae.maxX < 1000, phase + ' 必須在 owner 圓內，不得留在 hazard 起點: ' + JSON.stringify(ae));
    assert.equal(coveredAt(active.box, 900, 500), true, phase + ' owner 圓心');
    assert.equal(coveredAt(active.box, 300, 100), false, phase + ' 起點不得再畫');
    const missing = call(hazard('charge', phase, { x: 100, y: 100, angle: 0, r: 52, t: 0.1, duration: 0.65 }), 1, null);
    assert.equal(missing.handled, false, phase + ' 缺 owner 必須 false');
    assert.equal(missing.pass, 'UNHANDLED', phase + ' 缺 owner pass');
    assert.equal(missing.box.images.length, 0, phase + ' 缺 owner 不得畫圖');
  }
});

test('B. ring：帶 prevR-28..r+28，內洞與 gap 留空，不得整圓', () => {
  bossGate(true);
  const h = hazard('ring', 'active', {
    r: 240, prevR: 80, t: 0.35, duration: 0.7,
    gapAngle: Math.PI / 2, gapWidth: Math.PI / 2
  });
  const out = call(h, 1, { x: 400, y: 500 });
  assert.equal(out.pass, 'IMAGE');
  assert.equal(coveredAt(out.box, 600, 500), true, 'r=200 帶內');
  assert.equal(coveredAt(out.box, 430, 500), false, 'r=30 內洞');
  assert.equal(coveredAt(out.box, 700, 500), false, 'r=300 超出 r+28');
  assert.equal(coveredAt(out.box, 400, 660), false, 'gap 中心必須留空');
  assert.equal(coveredAt(out.box, 400, 340), true, 'gap 負向對照必須覆蓋');
  assert.equal(coveredAt(out.box, 500, 400), true, '斜向帶內（避開 +PI/2 gap）');
  // 真 prevR 被 AI 覆寫成 curR 時仍必須是薄帶，不得退化成整圓。
  const thin = call(hazard('ring', 'active', { r: 240, prevR: 240, t: 0.35, duration: 0.7, gapAngle: 0, gapWidth: Math.PI / 2 }), 1, { x: 400, y: 500 });
  assert.equal(coveredAt(thin.box, 400, 500), false, '中心永遠不得覆蓋');
  assert.equal(coveredAt(thin.box, 160, 500), true, 'r=240 在 curR±28（避開 gapAngle=0）');
  assert.equal(coveredAt(thin.box, 120, 500), false, 'r=280 超出 curR+28');
});

test('B. tide：波前 ±60、安全帶留空、可見 ±460 外仍不得截止', () => {
  bossGate(true);
  const h = hazard('tide', 'active', {
    angle: Math.PI / 2, t: 0.5, duration: 1,
    safeOffset: 100, safeWidth: 130, progress: 0
  });
  const out = call(h, 1, { x: 400, y: 500 });
  assert.equal(out.pass, 'IMAGE');
  assert.equal(coveredAt(out.box, 400, 500), true, 'lateral 0 危險');
  assert.equal(coveredAt(out.box, 200, 500), true, 'lateral 200 危險');
  assert.equal(coveredAt(out.box, 300, 500), false, '安全帶中心留空');
  assert.equal(coveredAt(out.box, 270, 500), false, '安全帶內 lateral=130 留空');
  assert.equal(coveredAt(out.box, 230, 500), true, '安全帶外 lateral=170 危險');
  assert.equal(coveredAt(out.box, 200, 620), false, 'forward 120 > 60 不在波前');
  const ext = imageExtents(out.box);
  assert.ok(ext.maxX >= 1000 || ext.minX <= -200, '可見波帶必須超過 ±460: ' + JSON.stringify(ext));
  // 斜向 angle=PI/4 也要有真 lateral 投影，不可只做水平。
  const diag = call(hazard('tide', 'active', {
    angle: Math.PI / 4, t: 0.5, duration: 1,
    safeOffset: 100, safeWidth: 130, progress: 0
  }), 1, { x: 400, y: 500 });
  assert.equal(diag.pass, 'IMAGE');
  // x = h.x + cos*fwd - sin*lat, y = h.y + sin*fwd + cos*lat
  assert.equal(coveredAt(diag.box, 400 - Math.SQRT1_2 * 200, 500 + Math.SQRT1_2 * 200), true, '斜向危險');
  assert.equal(coveredAt(diag.box, 400 - Math.SQRT1_2 * 100, 500 + Math.SQRT1_2 * 100), false, '斜向安全帶');
});

test('B. recovery 淡出尾端：alpha<=0 → IMAGE_NOT_DRAWN、handled true、無幾何', () => {
  bossGate(true);
  const h = hazard('slam', 'recovery', { r: 150, t: 0.5, duration: 0.5 });
  const out = call(h, 1, { x: 400, y: 500 });
  assert.equal(out.handled, true, '尾端必須 handled true，避免 game 閃回舊幾何');
  assert.equal(out.pass, 'IMAGE_NOT_DRAWN');
  assert.equal(out.box.images.length, 0, '尾端不得再 drawImage');
  assert.equal(out.box.fills() + out.box.strokes() + out.box.fillRects(), 0, '尾端不得畫幾何');
});

// =====================================================================
// C. 負向：非 DEV／缺 bossart／缺圖／未知 kind／缺 owner／壞相位
// =====================================================================
test('C. gate 關／缺圖／未知 kind／壞相位：四標準 kind 一律 false→game C3，不畫圖', () => {
  const owner = { x: 400, y: 500 };
  const cases = [];
  bossGate(false);
  cases.push(['gate-off', call(hazard('slam', 'telegraph'), 1, owner)]);
  bossGate(true);
  const saved = env.BOSS_HAZARD_ART_IMG.slam;
  delete env.BOSS_HAZARD_ART_IMG.slam;
  cases.push(['missing-image', call(hazard('slam', 'telegraph'), 1, owner)]);
  env.BOSS_HAZARD_ART_IMG.slam = saved;
  cases.push(['unknown-kind', call(hazard('bogus', 'telegraph'), 1, owner)]);
  cases.push(['bad-phase', call(hazard('slam', 'windup'), 1, owner)]);
  for (const [name, out] of cases) {
    assert.equal(out.handled, false, name + ' handled');
    assert.equal(out.pass, 'UNHANDLED', name + ' pass=' + out.pass);
    assert.equal(out.box.images.length, 0, name + ' 不得畫圖');
    assert.equal(out.box.fills() + out.box.strokes() + out.box.fillRects(), 0, name + ' 不得畫幾何');
  }
  bossGate(true);
});

test('C. D3 回歸：非 DEV／缺 ripple 時 tidalFan/rainVortex 仍 handled true + TECH_SAFETY_ONLY 幾何', () => {
  const owner = { x: 400, y: 500 };
  for (const mode of ['nondev', 'missing']) {
    // 非 DEV 模式：bossart gate 關、fusion gate 關
    bossGate(false);
    fusionGate(false);
    env.PORT_ART.ripple = mode === 'missing' ? { naturalWidth: 0, naturalHeight: 0 } : IMG.tide;
    for (const kind of ['tidalFan', 'rainVortex']) {
      const h = hazard(kind, 'telegraph', {
        r: 200, angle: 0, startAngle: -Math.PI / 3, endAngle: Math.PI / 3,
        vortexes: [{ x: 500, y: 500, r: 28 }]
      });
      const out = call(h, 1, owner);
      assert.equal(out.handled, true, mode + '/' + kind + ' 必須 handled true');
      assert.equal(out.pass, 'TECH_SAFETY_ONLY', mode + '/' + kind + ' pass=' + out.pass);
      assert.equal(out.box.images.length, 0, mode + '/' + kind + ' 缺圖不得 IMAGE');
      assert.ok(out.box.fills() + out.box.strokes() + out.box.fillRects() > 0, mode + '/' + kind + ' 必須有安全幾何');
    }
  }
  bossGate(true);
  fusionGate(false);
  env.PORT_ART.ripple = null;
});

// =====================================================================
// D. game C3 delegate：strict true 才略過；false／throw 契約不變
// =====================================================================
test('D. game drawBossHazard(h,owner) → renderer(ctx,h,elapsed,owner)；strict true 才略過 C3', () => {
  const draw = loadGameDraw();
  for (const kind of [...KINDS, 'tidalFan', 'rainVortex']) {
    const h = hazard(kind, 'recovery', { angle: 0.4 });
    const owner = { x: 11, y: 22 };
    const ctx = gameCtx();
    const calls = [];
    const RENDERER = { drawBossHazard(...args) { calls.push(args); return true; } };
    const fn = draw(RENDERER, ctx, 9.25);
    fn(h, owner);
    assert.equal(calls.length, 1, kind);
    assert.equal(calls[0][0], ctx, kind);
    assert.equal(calls[0][1], h, kind);
    assert.equal(calls[0][2], 9.25, kind);
    assert.equal(calls[0][3], owner, kind + ' owner identity');
    assert.equal(ctx.ops.length, 0, kind + ' strict true 不得再畫 C3');
  }
});

test('D. false／非 boolean／缺 handler 都保留 C3 幾何；throw 原樣冒出', () => {
  const draw = loadGameDraw();
  for (const ret of [false, undefined, 1, 'true', {}, null]) {
    const h = hazard('slam', 'telegraph');
    const owner = { x: 3, y: 4 };
    const ctx = gameCtx();
    const calls = [];
    const fn = draw({ drawBossHazard(...a) { calls.push(a); return ret; } }, ctx, 3);
    fn(h, owner);
    assert.equal(calls.length, 1, String(ret));
    assert.equal(calls[0][3], owner, String(ret));
    assert.ok(ctx.ops.some((op) => op[0] === 'save'), String(ret));
    assert.ok(ctx.ops.some((op) => op[0] === 'arc' && op[1] === 400 && op[2] === 500 && op[3] === 150), String(ret));
    assert.equal(ctx.globalAlpha, 0.72, String(ret));
  }
  const missing = gameCtx();
  draw({}, missing, 2)(hazard('ring', 'telegraph', { gapAngle: 0, gapWidth: Math.PI / 2 }), null);
  assert.ok(missing.ops.some((op) => op[0] === 'arc' && op[3] === 80), '缺 handler 仍畫 C3 ring');

  const boom = gameCtx();
  let err = null;
  try { draw({ drawBossHazard() { throw new Error('renderer-hazard'); } }, boom, 8)(hazard('slam', 'telegraph'), null); }
  catch (e) { err = e; }
  assert.equal(err && err.message, 'renderer-hazard');
  assert.equal(boom.ops.length, 0);

  const calls = [];
  const RENDERER = { drawBossHazard(...a) { calls.push(a); return true; } };
  for (const bad of [{ kind: 'slam', x: NaN, y: 1 }, { kind: 'slam', x: 1, y: Infinity }, null, undefined]) {
    const ctx = gameCtx();
    draw(RENDERER, ctx, 8)(bad, null);
    assert.equal(ctx.ops.length, 0, String(bad));
  }
  assert.equal(calls.length, 0, 'invalid coord 不得進 renderer');
});

// =====================================================================
// E. D1／D2／B／C 受影響回歸（只讀源碼契約，不重跑舊 suite）
// =====================================================================
test('E. D1 line/hitSet、D2 0.25/0.12 上限、B/C 檔案未動', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/renderer.js'), 'utf8');
  const fox = src.slice(src.indexOf('kind === "fusion_foxiai"'), src.indexOf('kind === "fusion_exorcistblade"'));
  assert.ok(fox.includes('line:') && fox.includes('hitSet'), 'D1 契約');
  const thunder = src.slice(src.indexOf('kind === "fusion_thundercircle"'), src.indexOf('kind === "fusion_exorcistseal"'));
  assert.ok(thunder.includes('0.25') && thunder.includes('0.12'), 'D2 上限');
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  assert.equal(sha('js/ui.js'), '31a1914e838806046182f937eb83afe81ffbb54e2630049cfa3b066d589a1f6d', 'B UI 未動');
  assert.equal(sha('js/dev-mode.js'), 'a1cae5ad1c2e331504fa498957bf4e4673d2d312dd40cadfa19ccd5692fb7451', 'C4 dev-mode 未動');
});

test('F. 收件摘要落 scratch/boss-image-qa-r1/node-report.json', () => {
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  const report = {
    ticket: 'BOSS-IMAGE-QA-R2',
    agent: 'w1:p4',
    head: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    sha: {
      assets: sha('js/assets.js'),
      renderer: sha('js/renderer.js'),
      game: sha('js/game.js'),
      ui: sha('js/ui.js'),
      'dev-mode': sha('js/dev-mode.js'),
      'boss-ai': sha('js/boss-ai.js')
    },
    defs: Object.fromEntries(KINDS.map((k) => [k, {
      source: DEFS[k].source, bbox: DEFS[k].bbox, width: DEFS[k].width, height: DEFS[k].height,
      status: DEFS[k].status
    }])),
    scope: 'Node contract/geometry only; not real Canvas pixels, not ART_PASS, not natural play, not real device',
    note: 'renderer/assets SHA 必須與 p3 正式停筆 SHA 一致才可作最終驗收'
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'node-report.json'), JSON.stringify(report, null, 2));
  assert.equal(report.sha.renderer.length, 64);
});

// 讓 gate 在整份檔案結束時回到安全狀態。
test.after(() => restoreGates());
