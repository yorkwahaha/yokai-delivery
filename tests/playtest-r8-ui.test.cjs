'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeCanvas(w = 900, h = 600) {
  const text = [];
  const rects = [];
  const roundRects = [];
  const arcs = [];
  const drawnImages = [];
  const gradient = () => ({ addColorStop() {} });

  let curFill = '#000000';
  let curStroke = '#000000';
  let curLineWidth = 1;

  const target = {
    canvas: { width: w, height: h },
    measureText: value => ({
      width: String(value).length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2
    }),
    fillText: (value, x, y, maxWidth) => text.push({ value: String(value), x, y, maxWidth, fill: curFill }),
    strokeText: (value, x, y, maxWidth) => {},
    fillRect: (x, y, width, height) => rects.push({ x, y, width, height, fill: curFill }),
    strokeRect: (x, y, width, height) => {},
    beginPath: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    arc: (x, y, r, sa, ea) => arcs.push({ x, y, r, sa, ea, fill: curFill, stroke: curStroke, lineWidth: curLineWidth }),
    ellipse: () => {},
    moveTo: () => {},
    lineTo: () => {},
    roundRect: (x, y, width, height, r) => roundRects.push({ x, y, width, height, r, fill: curFill }),
    drawImage: (img, ...args) => drawnImages.push({ img, args }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    clip: () => {}
  };

  const ctx = new Proxy(target, {
    get(obj, k) {
      if (k === 'fillStyle') return curFill;
      if (k === 'strokeStyle') return curStroke;
      if (k === 'lineWidth') return curLineWidth;
      return k in obj ? obj[k] : () => {};
    },
    set(obj, k, v) {
      if (k === 'fillStyle') { curFill = v; return true; }
      if (k === 'strokeStyle') { curStroke = v; return true; }
      if (k === 'lineWidth') { curLineWidth = v; return true; }
      obj[k] = v;
      return true;
    }
  });

  return { ctx, text, rects, roundRects, arcs, drawnImages };
}

function loadRealUi(w = 1366, h = 768) {
  const window = {
    VIEWPORT: {
      bounds: () => ({ left: 0, top: 0, right: w, bottom: h, width: w, height: h }),
      hudBounds: () => ({ left: 0, top: 0, right: w, bottom: h, width: w, height: h }),
      get: () => ({ scale: 1 })
    },
    FX: { glow() {} },
    location: { search: '' },
    matchMedia: () => ({ matches: false }),
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: w, height: h }) })
    }
  };

  const source = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
  vm.runInNewContext(
    source,
    { window, location: { search: '' }, URLSearchParams, console, Date, Math },
    { filename: 'js/ui.js', timeout: 5000 }
  );
  assert.equal(typeof window.UI.drawAwakeningTag, 'function');
  assert.equal(typeof window.UI.drawHud, 'function');
  return { UI: window.UI, window };
}

test('R8 Item 1: Long Run Delivery Progress (0/1/2/3/12/15/16/18) 3-Light Cycle & Seals', () => {
  const { UI } = loadRealUi(1366, 768);

  const testCases = [
    // delivered: 0 -> nextIn: 3, seals: 0, earned: 0
    { delivered: 0, seals: 0, earned: 0, spent: 0, nextIn: 3, awakened: 0, expSeals: '×0', expLit: 0 },
    // delivered: 1 -> nextIn: 2, seals: 0, earned: 0
    { delivered: 1, seals: 0, earned: 0, spent: 0, nextIn: 2, awakened: 0, expSeals: '×0', expLit: 1 },
    // delivered: 2 -> nextIn: 1, seals: 0, earned: 0
    { delivered: 2, seals: 0, earned: 0, spent: 0, nextIn: 1, awakened: 0, expSeals: '×0', expLit: 2 },
    // delivered: 3 -> seal earned! nextIn: 3, seals: 1, earned: 1
    { delivered: 3, seals: 1, earned: 1, spent: 0, nextIn: 3, awakened: 0, expSeals: '×1', expLit: 0 },
    // delivered: 12 -> earned: 4, nextIn: 3, awakened: 2 (previously bugged: stuck at 2 lit out of 4)
    { delivered: 12, seals: 4, earned: 4, spent: 0, nextIn: 3, awakened: 2, expSeals: '×4', expLit: 0 },
    // delivered: 15 -> earned: 5, nextIn: 3, awakened: 2
    { delivered: 15, seals: 5, earned: 5, spent: 0, nextIn: 3, awakened: 2, expSeals: '×5', expLit: 0 },
    // delivered: 16 -> earned: 5, nextIn: 2, awakened: 2
    { delivered: 16, seals: 5, earned: 5, spent: 0, nextIn: 2, awakened: 2, expSeals: '×5', expLit: 1 },
    // delivered: 18 -> earned: 6, nextIn: 3, awakened: 3
    { delivered: 18, seals: 6, earned: 6, spent: 0, nextIn: 3, awakened: 3, expSeals: '×6', expLit: 0 },
    // Spend 2 seals at delivered 16 -> seals: 3, spent: 2, nextIn: 2
    { delivered: 16, seals: 3, earned: 5, spent: 2, nextIn: 2, awakened: 2, expSeals: '×3', expLit: 1 },
    // Spend all 4 seals at delivered 12 -> seals: 0, spent: 4, nextIn: 3
    { delivered: 12, seals: 0, earned: 4, spent: 4, nextIn: 3, awakened: 2, expSeals: '×0', expLit: 0 }
  ];

  for (const tc of testCases) {
    const { ctx, text, arcs } = makeCanvas(900, 600);
    const awakening = {
      seals: tc.seals,
      earned: tc.earned,
      spent: tc.spent,
      nextIn: tc.nextIn,
      maxEarned: 4,
      awakened: tc.awakened
    };

    const h = UI.drawAwakeningTag(ctx, 100, 100, 150, awakening);
    assert.equal(h, 30, 'Height of tag must be 30');

    // Verify seals count label
    const sealLabel = text.find(t => t.value === tc.expSeals);
    assert.ok(sealLabel, `Must display seal count "${tc.expSeals}" for delivered=${tc.delivered}`);

    // Verify exactly 3 progress light dots (radius 3.5)
    const dotArcs = arcs.filter(a => a.r === 3.5);
    assert.equal(dotArcs.length, 3, `Must render exactly 3 progress light dots for delivered=${tc.delivered} (got ${dotArcs.length})`);

    // Verify lit vs unlit counts
    const litDots = dotArcs.filter(a => a.fill === '#f5d483');
    const unlitDots = dotArcs.filter(a => a.fill === '#36251e');
    assert.equal(litDots.length, tc.expLit, `For delivered=${tc.delivered} (nextIn=${tc.nextIn}), expected ${tc.expLit} lit dots, got ${litDots.length}`);
    assert.equal(unlitDots.length, 3 - tc.expLit, `For delivered=${tc.delivered}, expected ${3 - tc.expLit} unlit dots, got ${unlitDots.length}`);
  }
});

test('R8 Item 2: Dot Boundaries & Tag Geometry (No Overflow Outside Board)', () => {
  const { UI } = loadRealUi(1366, 768);

  for (const availableW of [150, 120, 104]) {
    const x = 50, y = 80;
    const { ctx, text, arcs, roundRects } = makeCanvas(900, 600);
    const awakening = { seals: 12, earned: 12, spent: 0, nextIn: 2, maxEarned: 4, awakened: 2 };

    UI.drawAwakeningTag(ctx, x, y, availableW, awakening);

    const w = Math.min(150, Math.max(104, availableW));
    const px = x + Math.max(0, availableW - w);
    const h = 30;

    const dotArcs = arcs.filter(a => a.r === 3.5);
    assert.equal(dotArcs.length, 3, 'Must render 3 dots');

    // Verify each dot is strictly inside [px, y, w, h]
    for (let i = 0; i < dotArcs.length; i++) {
      const dot = dotArcs[i];
      assert.ok(dot.x - dot.r >= px, `Dot ${i} left edge (${dot.x - dot.r}) must be >= board left (${px})`);
      assert.ok(dot.x + dot.r <= px + w, `Dot ${i} right edge (${dot.x + dot.r}) must be <= board right (${px + w})`);
      assert.ok(dot.y - dot.r >= y, `Dot ${i} top edge (${dot.y - dot.r}) must be >= board top (${y})`);
      assert.ok(dot.y + dot.r <= y + h, `Dot ${i} bottom edge (${dot.y + dot.r}) must be <= board bottom (${y + h})`);
    }

    // Verify no collision between text and leftmost dot
    const sealText = text.find(t => t.value === '×12');
    assert.ok(sealText, 'Must render ×12 text');
    const textRight = sealText.x + 28; // approx width for ×12
    const leftmostDotLeft = dotArcs[0].x - dotArcs[0].r;
    assert.ok(leftmostDotLeft > textRight + 2, `Leftmost dot (${leftmostDotLeft}) must be to the right of text (${textRight}) with clearance`);
  }
});

test('R8 Item 3: Integrated HUD with Awakening Tag (1366x768 & 844x390)', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadRealUi(w, h);
    const { ctx, text, arcs } = makeCanvas(w, h);

    const bonuses = { shield: 3, dmg: 1.9, rate: 2, crit: 1, spd: 0, dash: 0, mag: 0 };
    const WL = { katana: 2, fire: 1 };
    const WI = ['katana', 'fire'];
    const awakening = { seals: 5, earned: 5, spent: 0, nextIn: 2, maxEarned: 4, awakened: 2 };

    const btnPause = { x: w - 52, y: 14, w: 38, h: 52 };
    const btnD = { x: 700, y: 500, r: 30 };
    const btnE = { x: 600, y: 500, r: 30 };

    UI.drawHud(
      ctx, { x: 0, y: 0 }, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, null, 0, [], null, null,
      false, false, btnE, btnD, btnPause, WL, WI, bonuses, 0, 6, 0, 1.8, false,
      { awakening }
    );

    // Verify seal label '×5' is painted
    assert.ok(text.some(t => t.value === '×5'), `Must paint seal count ×5 in HUD on ${w}x${h}`);

    // Verify 3 progress light dots
    const hudDotArcs = arcs.filter(a => a.r === 3.5);
    assert.ok(hudDotArcs.length >= 3, `Must paint at least 3 light dots in HUD on ${w}x${h} (found ${hudDotArcs.length})`);

    const litDots = hudDotArcs.filter(a => a.fill === '#f5d483');
    assert.equal(litDots.length, 1, `Must have exactly 1 lit dot for nextIn=2 in HUD on ${w}x${h}`);
  }
});
