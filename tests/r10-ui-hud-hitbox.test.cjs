'use strict';
// tests/r10-ui-hud-hitbox.test.cjs — R10 真實 HUD 佈局與奧義重開觸控熱區驗收測試
// 範圍：
//   1. 實體雷達 (diegetic radar) 啟動時，奧義重開木牌錨定在雷達左側，與雷達金屬外框/時鐘保留 >= 14px 呼吸間距，零重疊。
//   2. 非實體雷達 (plain HUD / 單元測試) 時保持相容，錨定於右界安全區。
//   3. 觸控/點擊熱區合法性：處於 held 狀態時，在 FUSION_REOPEN_BTN 熱區範圍內 pointerdown 能真正觸發 KeyF 打開融合確認面板。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');

function makeSpyCanvas(w = 1366, h = 768) {
  const text = [];
  const rects = [];
  const roundRects = [];
  const images = [];

  const target = {
    canvas: { width: w, height: h, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) },
    measureText: value => ({
      width: Math.max(8, String(value).length * 7),
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2
    }),
    fillText: (val, x, y, mw) => text.push({ value: String(val), x, y, mw }),
    strokeText: () => {},
    fillRect: (x, y, width, height) => rects.push({ x, y, width, height }),
    strokeRect: () => {},
    rect: (x, y, width, height) => rects.push({ x, y, width, height }),
    roundRect: (x, y, width, height, r) => roundRects.push({ x, y, width, height, r }),
    drawImage: (...args) => images.push(args),
    beginPath: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    arc: () => {},
    ellipse: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    clip: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    setLineDash: () => {}
  };

  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'string') return () => {};
      return undefined;
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    }
  });

  return { ctx: proxy, text, rects, roundRects, images };
}

function loadUiSandbox(width = 1366, height = 768, opts = {}) {
  const scale = width === 844 ? 0.65 : width === 1920 ? 1.8 : 1.28;
  const view = { width, height, scale, offsetX: 0, offsetY: 0 };
  const eventListeners = new Map();

  const windowObj = {
    innerWidth: width,
    innerHeight: height,
    matchMedia: () => ({ matches: false }),
    addEventListener(evt, fn) {
      if (!eventListeners.has(evt)) eventListeners.set(evt, []);
      eventListeners.get(evt).push(fn);
    },
    removeEventListener() {},
    dispatchEvent(evt) {
      const fns = eventListeners.get(evt.type) || [];
      for (const fn of fns) fn(evt);
    },
    VIEWPORT: {
      get: () => view,
      bounds: () => ({ left: 0, top: 0, right: width, bottom: height, width, height }),
      hudBounds: () => ({ left: 0, top: 0, right: width, bottom: height, width, height })
    },
    FX: { glow() {} },
    ART: {
      hud_radar_frame: opts.withRadarArt ? { naturalWidth: 256, naturalHeight: 256, complete: true } : undefined
    },
    Image: function () {
      this.naturalWidth = opts.imagesLoaded ? 90 : 0;
      this.naturalHeight = opts.imagesLoaded ? 80 : 0;
    }
  };

  const sandbox = {
    window: windowObj,
    document: {
      getElementById: () => null,
      querySelector: (sel) => (sel === 'canvas' ? { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) } : null),
      fonts: { check: () => true, load: () => Promise.resolve() },
      createElement: () => null
    },
    location: { search: '', hostname: '127.0.0.1' },
    performance: { now: () => 1000 },
    URLSearchParams, console, Math, Date, Object, Array, String, Number, Boolean, Promise,
    WeakMap, Map, Set, JSON,
    module: { exports: {} }, exports: {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UI_SRC, sandbox, { filename: 'js/ui.js' });
  return { UI: sandbox.window.UI, sandbox, eventListeners };
}

// ─────────────────────────────────────────────────────────────
// Test 1: 實體雷達 (Diegetic Radar) 下零重疊且間距 >= 14px
// ─────────────────────────────────────────────────────────────
test('R10 Item 1: Diegetic Radar Mode - Reopen button is safely anchored to left of radar with zero overlap', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadUiSandbox(w, h, { withRadarArt: true });
    const { ctx } = makeSpyCanvas(w, h);

    const btnPause = { x: w - 50, y: 10, w: 44, h: 44 };
    const btnD = { x: w - 100, y: h - 100, r: 30 };
    const btnE = { x: w - 100, y: h - 180, r: 30 };

    UI.drawHud(
      ctx, {}, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, null, 0, [], null, null,
      false, false, btnE, btnD, btnPause, { katana: 1 }, ['katana'], {}, 0
    );

    const reopen = UI.FUSION_REOPEN_BTN;
    assert.ok(reopen, 'FUSION_REOPEN_BTN 必須存在');
    assert.ok(reopen.w >= 92 && reopen.h >= 28, `尺寸合規: ${reopen.w}x${reopen.h}`);

    // 計算當前雷達左界
    const scale = w === 844 ? 0.65 : 1.28;
    const compactLandscape = w <= 920 && h <= 500 && w > h * 1.55;
    const sBoxW = 215;
    const sBoxX = w - sBoxW - Math.max(62, 44 / scale + 18);
    const mapW = compactLandscape ? 190 : 174;
    const mapX = sBoxX + sBoxW - mapW;

    // 驗證木牌在雷達左側，且間距 >= 14px
    const distanceToRadar = mapX - (reopen.x + reopen.w);
    assert.ok(distanceToRadar >= 14, `${w}x${h}: 木牌必須在雷達左側且保留 >= 14px 間距 (當前 ${distanceToRadar}px)`);

    // 驗證木牌與雷達邊界無重疊
    const overlapRadar = !(reopen.x >= mapX + mapW || reopen.x + reopen.w <= mapX);
    assert.equal(overlapRadar, false, `${w}x${h}: 木牌不得與雷達產生任何水平重疊`);
  }
});

// ─────────────────────────────────────────────────────────────
// Test 2: 無貼圖模式保持核准的現行安全區錨定；不強迫退回舊 R10 像素。
// ─────────────────────────────────────────────────────────────
test('R10 Item 2: Non-Diegetic Mode - Approved right-aligned safe hitbox remains in bounds', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadUiSandbox(w, h, { withRadarArt: false });
    const { ctx } = makeSpyCanvas(w, h);

    const btnPause = { x: w - 50, y: 10, w: 44, h: 44 };
    const btnD = { x: w - 100, y: h - 100, r: 30 };
    const btnE = { x: w - 100, y: h - 180, r: 30 };

    UI.drawHud(
      ctx, {}, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, null, 0, [], null, null,
      false, false, btnE, btnD, btnPause, { katana: 1 }, ['katana'], {}, 0
    );

    const reopen = UI.FUSION_REOPEN_BTN;
    const compact = w === 844 && h === 390;
    assert.equal(reopen.y, compact ? 70 : 68,
      'layout preserves the current compact/desktop safe top inset');
    assert.equal(reopen.x, w - reopen.w - 14, '相容右側錨定規範');
    assert.ok(reopen.y >= 60 && reopen.y + reopen.h < h,
      'reopen touch target remains inside the visible screen');
  }
});

// ─────────────────────────────────────────────────────────────
// Test 3: 觸控/點擊熱區能真正觸發 KeyF 開啟確認視窗
// ─────────────────────────────────────────────────────────────
test('R10 Item 3: Touch & Click Hitbox - Pointerdown on reopen button triggers KeyF', () => {
  const { UI, sandbox, eventListeners } = loadUiSandbox(844, 390, { withRadarArt: true });
  const { ctx } = makeSpyCanvas(844, 390);

  const btnPause = { x: 844 - 50, y: 10, w: 44, h: 44 };
  const btnD = { x: 844 - 100, y: 390 - 100, r: 30 };
  const btnE = { x: 844 - 100, y: 390 - 180, r: 30 };

  UI.drawHud(
    ctx, {}, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, null, 0, [], null, null,
    false, false, btnE, btnD, btnPause, { katana: 1 }, ['katana'], {}, 0
  );

  const reopen = UI.FUSION_REOPEN_BTN;

  // 模擬 FUSION 處於 held 狀態
  sandbox.window.FUSION = {
    getState: () => ({ state: 'held' })
  };

  let keyFDispatched = false;
  sandbox.window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') keyFDispatched = true;
  });

  const pointerListeners = eventListeners.get('pointerdown') || [];
  assert.ok(pointerListeners.length > 0, 'UI 必須註冊 pointerdown 監聽器');

  // 1. 點擊按鈕中心
  const clickInside = {
    clientX: reopen.x + reopen.w / 2,
    clientY: reopen.y + reopen.h / 2,
    stopPropagation() {},
    preventDefault() {},
    cancelable: true
  };
  keyFDispatched = false;
  for (const fn of pointerListeners) fn(clickInside);
  assert.equal(keyFDispatched, true, '點擊重開鈕內部必須觸發 KeyF');

  // 2. 點擊外部 (例如左上角 x=50, y=50) 不得觸發
  const clickOutside = {
    clientX: 50,
    clientY: 50,
    stopPropagation() {},
    preventDefault() {},
    cancelable: true
  };
  keyFDispatched = false;
  for (const fn of pointerListeners) fn(clickOutside);
  assert.equal(keyFDispatched, false, '點擊重開鈕外部不得觸發 KeyF');

  // 3. 非 held 狀態 (例如 idle) 點擊不得觸發
  sandbox.window.FUSION.getState = () => ({ state: 'idle' });
  keyFDispatched = false;
  for (const fn of pointerListeners) fn(clickInside);
  assert.equal(keyFDispatched, false, '非 held 狀態點擊不得觸發 KeyF');
});
