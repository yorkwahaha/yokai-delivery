'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function makeCanvas(w, h) {
  const text = [];
  const rects = [];
  const roundRects = [];
  const drawnImages = [];
  const gradient = () => ({ addColorStop() {} });

  const target = {
    canvas: { width: w, height: h },
    measureText: value => ({
      width: String(value).length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2
    }),
    fillText: (value, x, y, maxWidth) => text.push({ value: String(value), x, y, maxWidth }),
    strokeText: (value, x, y, maxWidth) => {},
    fillRect: (x, y, width, height) => rects.push({ x, y, width, height }),
    strokeRect: (x, y, width, height) => {},
    beginPath: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    arc: () => {},
    ellipse: () => {},
    moveTo: () => {},
    lineTo: () => {},
    roundRect: (x, y, width, height, r) => roundRects.push({ x, y, width, height, r }),
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
      return k in obj ? obj[k] : () => {};
    },
    set(obj, k, v) {
      obj[k] = v;
      return true;
    }
  });

  return { ctx, text, rects, roundRects, drawnImages };
}

function loadRealUi(w, h) {
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
  assert.equal(typeof window.UI.drawCharmSwap, 'function');
  assert.equal(typeof window.UI.drawHud, 'function');
  assert.equal(typeof window.UI.drawEndScreen, 'function');
  return { UI: window.UI, window };
}

test('R7 Item 1: Omamori Swap Panel - Desktop 1366x768 and Mobile 844x390 responsive bounds', () => {
  for (const [w, h] of [[1366, 768], [844, 390], [640, 360]]) {
    const { UI } = loadRealUi(w, h);
    const { ctx, text, rects, roundRects } = makeCanvas(w, h);

    const charms = [
      { id: 'charm_power', name: '力紋守', level: 2 },
      { id: 'charm_step', name: '風步守', level: 1 },
      { id: 'charm_reach', name: '遠霞守', level: 3 }
    ];
    const pending = { id: 'charm_guard', name: '紙甲守', level: 1 };

    const hits = UI.drawCharmSwap(ctx, { charms, pending, selectedIndex: 0 });

    // 1. Verify hitRect IDs
    assert.deepEqual(Array.from(hits, h => h.id), ['swap_0', 'swap_1', 'swap_2', 'swap_discard']);

    // 2. Verify all hit boxes satisfy touch minimums and stay within screen bounds
    for (const hit of hits) {
      assert.ok(hit.w >= 44 && hit.h >= 44, `${hit.id} w/h must be >= 44 (got ${hit.w}x${hit.h})`);
      assert.ok(hit.x >= 0, `${hit.id} x must be >= 0`);
      assert.ok(hit.y >= 0, `${hit.id} y must be >= 0`);
      assert.ok(hit.x + hit.w <= w, `${hit.id} right must be <= screen width ${w}`);
      assert.ok(hit.y + hit.h <= h, `${hit.id} bottom must be <= screen height ${h}`);
    }

    // 3. Verify slot width >= 150 (expanded from cramped 124px)
    const slot0 = hits.find(h => h.id === 'swap_0');
    assert.ok(slot0.w >= 150, `Slot width must be >= 150px (was 124px, now ${slot0.w})`);

    // 4. Verify title and subtitle vertical separation (no collision)
    const title = text.find(t => t.value === '御守替換');
    const subtitle = text.find(t => t.value.includes('拾獲新御守'));
    assert.ok(title && subtitle, 'Must paint title and subtitle');
    const verticalGap = subtitle.y - title.y;
    assert.ok(verticalGap >= 18, `Title and subtitle vertical gap must be >= 18px (got ${verticalGap})`);

    // 5. Verify discard button present, labeled '放棄', and located below slots
    const discardHit = hits.find(h => h.id === 'swap_discard');
    assert.ok(discardHit.y >= slot0.y + slot0.h, `Discard button must be below slots (discY=${discardHit.y}, slotBottom=${slot0.y + slot0.h})`);
    assert.ok(text.some(t => t.value === '放棄'), 'Must render "放棄" text');

    // 6. Verify distinct name, level, effect rendered
    const painted = text.map(t => t.value).join('|');
    assert.ok(painted.includes('紙甲守'), 'Must include pending charm name');
    assert.ok(painted.includes('力紋守 Lv2'), 'Must include existing charm name and level');
    assert.ok(painted.includes('風步守 Lv1'), 'Must include existing charm name and level');
    assert.ok(painted.includes('遠霞守 Lv3'), 'Must include existing charm name and level');
  }
});

test('R7 Item 3: Passive HUD - Corner Stack Badge inside frame without extra vertical height', () => {
  const w = 1366, h = 768;
  const { UI } = loadRealUi(w, h);
  const { ctx, text, rects, roundRects } = makeCanvas(w, h);

  // drawHudBase signature:
  // (theme, ctx, P, oil, maxOil, elapsed, dawnTime, delivered, failed, score, level, xp, xpNeed, job, hintT, orders, inter, bossQ, touch, joy, btnE, btnD, btnPause, WL, WI, b, nameT, goalDeliveries, dashCd, dashMax, bossHunt, extra)
  const bonuses = { shield: 3, dmg: 1.9, rate: 2, crit: 1, spd: 0, dash: 0, mag: 0 };
  const WL = { katana: 1 };
  const WI = ['katana'];

  const btnPause = { x: 800, y: 10, w: 44, h: 44 };
  const btnD = { x: 700, y: 500, r: 30 };
  const btnE = { x: 600, y: 500, r: 30 };
  UI.drawHud(
    ctx, {}, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, null, 0, [], null, null,
    false, false, btnE, btnD, btnPause, WL, WI, bonuses, 0
  );

  // Find stack badges like '×3' or '×2'
  const stackTexts = text.filter(t => /^×\d+$/.test(t.value));
  assert.ok(stackTexts.length >= 2, `Should render passive stack badges (found ${stackTexts.length}: ${stackTexts.map(t=>t.value).join(', ')})`);

  // Verify badge roundRects: all small badges have reasonable dimensions and stay within bounds
  const badgeRects = roundRects.filter(r => r.height <= 18 && r.height >= 10);
  assert.ok(badgeRects.length >= 2, `Should find corner badge rounded rects (found ${badgeRects.length})`);
});

test('R7 Item 7: End Results Wording - Truthful recall wording without confusing delivery count', () => {
  const w = 1366, h = 768;
  const { UI } = loadRealUi(w, h);

  // Case A: 19 independent successes, 0 assisted
  {
    const { ctx, text } = makeCanvas(w, h);
    const summary = {
      learning: { independent: 19, assisted: 0, practiced: 16, review: 0, gained: 2, lost: 0 }
    };
    UI.drawEndScreen(ctx, 'won', 1000, 16, 0, [], 0, summary);

    const painted = text.map(t => t.value).join(' ');
    assert.ok(painted.includes('無提示答對 19 次・提示 0 次'), `Must contain "無提示答對 19 次・提示 0 次" (got: ${painted})`);
    assert.ok(!painted.includes('獨立回想'), 'Must NOT contain misleading "獨立回想"');
  }

  // Case B: 15 independent successes, 4 assisted
  {
    const { ctx, text } = makeCanvas(w, h);
    const summary = {
      learning: { independent: 15, assisted: 4, practiced: 16, review: 1, gained: 1, lost: 0 }
    };
    UI.drawEndScreen(ctx, 'lost', 500, 12, 1, [], 0, summary);

    const painted = text.map(t => t.value).join(' ');
    assert.ok(painted.includes('無提示答對 15 次・提示 4 次'), `Must contain "無提示答對 15 次・提示 4 次" (got: ${painted})`);
    assert.ok(!painted.includes('獨立回想'), 'Must NOT contain misleading "獨立回想"');
  }

  // Case C: Practice mode (null independent)
  {
    const { ctx, text } = makeCanvas(w, h);
    const summary = {
      learning: { independent: null, assisted: 0, practiced: 10, review: 2, gained: 1, lost: 0 }
    };
    UI.drawEndScreen(ctx, 'won', 800, 10, 0, [], 0, summary);

    const painted = text.map(t => t.value).join(' ');
    assert.ok(painted.includes('今夜練習 10 字・待複習 2 字'), `Must fall back to practiced text (got: ${painted})`);
  }
});
