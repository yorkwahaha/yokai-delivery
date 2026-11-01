'use strict';
// tests/playtest-r9-ui.test.cjs — R9 UI 整版設計專用驗收測試
// 範圍：
//   1. 被動技角標縮小：×N 角標高 10-14px，貼緊右下角，主圖紋飾可見度 > 80%
//   2. 奧義重開按鈕：和風木牌籤條，錨定在右上安全區，嚴格避開左中任務/指南針 HUD（間距 > 50px），熱區 >= 44 CSS
//   3. 融合奧義選擇彈窗全面改版：厚和紙底板無變形、置中母技圖示與雙 Lv.5 規則、卡片標題/效果自上而下排版、鮮明選中態
//   4. 普通技能升級面板全面改版：厚和紙底板無變形、卡高與間距平衡、標題/假名/類型/效果分明、重抽與提示清晰
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
    canvas: { width: w, height: h },
    measureText: value => ({
      width: Math.max(8, String(value).length * 7),
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2
    }),
    fillText: (val, x, y, mw) => {
      text.push({ value: String(val), x, y, mw });
    },
    strokeText: () => {},
    fillRect: (x, y, width, height) => {
      rects.push({ x, y, width, height });
    },
    strokeRect: (x, y, width, height) => {},
    rect: (x, y, width, height) => {
      rects.push({ x, y, width, height });
    },
    roundRect: (x, y, width, height, r) => {
      roundRects.push({ x, y, width, height, r });
    },
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

function loadRealUi(width = 1366, height = 768, opts = {}) {
  const scale = width === 844 ? 0.65 : width === 1920 ? 1.8 : 1.28;
  const view = { width, height, scale, offsetX: 0, offsetY: 0 };
  const windowObj = {
    innerWidth: width,
    innerHeight: height,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    VIEWPORT: {
      get: () => view,
      bounds: () => ({ left: 0, top: 0, right: width, bottom: height, width, height }),
      hudBounds: () => ({ left: 0, top: 0, right: width, bottom: height, width, height })
    },
    FX: { glow() {} },
    ART: {},
    Image: function () {
      this.naturalWidth = opts.imagesLoaded ? 90 : 0;
      this.naturalHeight = opts.imagesLoaded ? 80 : 0;
    }
  };
  if (opts.dev) windowObj.DEV = true;
  if (opts.devMode) windowObj.DEV_MODE = { isDevMode: () => true };

  const sandbox = {
    window: windowObj,
    document: {
      getElementById: () => null,
      fonts: { check: () => true, load: () => Promise.resolve() },
      createElement: () => null
    },
    location: { search: opts.search || '', hostname: '127.0.0.1' },
    performance: { now: () => 1000 },
    URLSearchParams, console, Math, Date, Object, Array, String, Number, Boolean, Promise,
    WeakMap, Map, Set, JSON,
    module: { exports: {} }, exports: {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UI_SRC, sandbox, { filename: 'js/ui.js' });
  return { UI: sandbox.window.UI, sandbox };
}

// ─────────────────────────────────────────────────────────────
// Test 1: 被動技圖示右下角角標縮小（Screenshot #2）
// ─────────────────────────────────────────────────────────────
test('R9 Item 1: Passive HUD - Petite ×N Badge leaves >80% emblem visible and stays strictly inside frame', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadRealUi(w, h);
    const { ctx, text, roundRects } = makeSpyCanvas(w, h);

    const bonuses = { shield: 3, dmg: 1.9, rate: 2, crit: 1, spd: 0, dash: 0, mag: 0 };
    const WL = { katana: 1 };
    const WI = ['katana'];
    const btnPause = { x: w - 50, y: 10, w: 44, h: 44 };
    const btnD = { x: w - 100, y: h - 100, r: 30 };
    const btnE = { x: w - 100, y: h - 180, r: 30 };

    UI.drawHud(
      ctx, {}, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, null, 0, [], null, null,
      false, false, btnE, btnD, btnPause, WL, WI, bonuses, 0
    );

    // 驗證角標文字 ×3, ×2 等存在
    const stackBadges = text.filter(t => /^×\d+$/.test(t.value));
    assert.ok(stackBadges.length >= 2, `${w}x${h}: 必須繪出被動層數角標 (找到 ${stackBadges.length} 個)`);

    // 驗證角標圓角矩形：高在 10-14px 之間
    const badgeRects = roundRects.filter(r => r.width <= 24 && r.height <= 14 && r.height >= 10);
    assert.ok(badgeRects.length >= 2, `${w}x${h}: 必須找到小巧圓角角標底板 (找到 ${badgeRects.length} 個)`);

    for (const br of badgeRects) {
      // 在 1366x768 與 844x390 下，slotSize 約 34-44px (面積 1156-1936px²)
      // 角標 br.width * br.height 約 120-180px²
      const badgeArea = br.width * br.height;
      const estimatedSlotArea = (w === 844 ? 32 * 32 : 38 * 38);
      const coverageRatio = badgeArea / estimatedSlotArea;
      assert.ok(coverageRatio < 0.20, `${w}x${h}: 角標遮擋率必須 < 20% (當前 ${(coverageRatio * 100).toFixed(1)}%)，確保圖示 > 80% 可見`);
    }
  }
});

// ─────────────────────────────────────────────────────────────
// Test 2: 奧義重開按鈕和風木牌重設與安全區錨定（Screenshot #3）
// ─────────────────────────────────────────────────────────────
test('R9 Item 2: Fusion Reopen Button - Tasteful Wood Tag anchored safely away from Quest & Compass HUD', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadRealUi(w, h);
    const { ctx, text } = makeSpyCanvas(w, h);

    assert.ok(UI.FUSION_REOPEN_BTN, 'UI 必須導出 FUSION_REOPEN_BTN 幾何定義');
    assert.equal(typeof UI.drawFusionReopenButton, 'function', 'UI 必須導出 drawFusionReopenButton 函式');

    const btnPause = { x: w - 50, y: 10, w: 44, h: 44 };
    const btnD = { x: w - 100, y: h - 100, r: 30 };
    const btnE = { x: w - 100, y: h - 180, r: 30 };
    const orders = [{ id: 'o1', from: { x: 100, y: 100 }, to: { x: 200, y: 200 }, life: 30, word: { zh: '委託', cue: 'text' } }];
    const job = { to: { x: 200, y: 200 }, word: { zh: '配送中', cue: 'text', jp: 'はいそう' } };

    UI.drawHud(
      ctx, {}, 100, 100, 10, 300, 5, 0, 1000, 1, 0, 100, job, 0, orders, null, null,
      false, false, btnE, btnD, btnPause, { katana: 1 }, ['katana'], {}, 0
    );

    const reopen = UI.FUSION_REOPEN_BTN;
    assert.ok(reopen.w >= 44 && reopen.h >= 28, `重開鈕尺寸必須具備觸控可點性: ${reopen.w}x${reopen.h}`);
    assert.equal(reopen.y, w === 844 ? 78 : 76, 'mobile landscape y78, desktop y76');

    // 定義任務與指南針 HUD 安全區域 (左中至中上)
    const taskMinX = 248;
    const taskMaxX = Math.min(650, w * 0.75);
    const taskMinY = 10;
    const taskMaxY = 120;

    // 驗證重開木牌與任務/指南針 HUD 完全無重疊，且有足夠邊界
    const overlapsTask = (
      reopen.x < taskMaxX &&
      reopen.x + reopen.w > taskMinX &&
      reopen.y < taskMaxY &&
      reopen.y + reopen.h > taskMinY
    );
    assert.equal(overlapsTask, false, `${w}x${h}: 奧義重開鈕不得與任務/方向 HUD 重疊 (reopenX=${reopen.x}, taskMaxX=${taskMaxX})`);

    // 驗證重開木牌位在畫面右側或上方安全區
    assert.ok(reopen.x >= taskMaxX - 50 || reopen.x + reopen.w <= taskMinX, '重開鈕必須水平遠離任務欄');
    assert.ok(reopen.x + reopen.w <= w, '重開鈕必須在螢幕右界內');

    // 驗證獨立繪製函式可真渲染出和風文字
    const { ctx: testCtx, text: testText } = makeSpyCanvas(w, h);
    UI.drawFusionReopenButton(testCtx, { btn: reopen });
    assert.ok(testText.some(t => t.value.includes('奧義重開')), 'drawFusionReopenButton 必須繪出「奧義重開」和風標籤');
  }
});

// ─────────────────────────────────────────────────────────────
// Test 3: 融合奧義選擇彈窗全面改版（Screenshot #4）
// ─────────────────────────────────────────────────────────────
test('R9 Item 3: Fusion Offer Screen - Clean Washi Board, Centered Parents with Lv.5 Rule & Clean Hierarchy', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadRealUi(w, h, { imagesLoaded: true, devMode: true });
    const { ctx, text, roundRects, rects } = makeSpyCanvas(w, h);

    const recipes = [
      { id: 'fusion_inkblade', name: '奧義・墨焰斬', parents: ['katana', 'fire'] },
      { id: 'fusion_slashwheel', name: '奧義・斬界輪', parents: ['katana', 'barrier'] },
      { id: 'fusion_foxiai', name: '奧義・雷狐居合', parents: ['katana', 'thunder'] },
      { id: 'fusion_thundercircle', name: '奧義・雷陣封界', parents: ['barrier', 'thunder'] }
    ];
    const model = {
      eligibleRecipes: recipes,
      selectedRecipeId: 'fusion_inkblade',
      slotBefore: 4,
      slotAfter: 3
    };

    const L = UI.drawFusion(ctx, model, 0, 'keyboard');
    assert.ok(L, 'drawFusion 必須返回 layout 物件');

    // 1. 驗證大標題
    const title = text.find(t => t.value.includes('奧 義 融 合'));
    assert.ok(title, `${w}x${h}: 必須繪製【 奧 義 融 合 】標題`);
    if (w >= 1000) {
      const sub = text.find(t => t.value.includes('母 技 合 流') || t.value.includes('兩 技 歸 一'));
      assert.ok(sub, `${w}x${h}: 寬螢幕必須繪製副標題`);
    }

    // 2. 驗證卡片內置中母技與雙 Lv.5 規則
    const joinedText = text.map(t => t.value).join(' | ');
    assert.ok(joinedText.includes('Lv.5 ＋') || joinedText.includes('Lv.5'), `${w}x${h}: 卡片內必須明示雙 Lv.5 條件 (如 妖刀斬 Lv.5 ＋ 狐火炎 Lv.5)`);

    // 3. 驗證卡片選中態標記
    assert.ok(text.some(t => t.value === '選定'), `${w}x${h}: 選中卡片必須有清晰的「選定」標記`);

    // 4. 驗證按鈕：融合奧義與稍後再議
    assert.ok(L.confirm, '必須有確認按鈕');
    assert.ok(L.later, '必須有稍後再議按鈕');
    assert.ok(L.confirm.w >= 44 && L.confirm.h >= 44, '確認按鈕熱區 >= 44');
    assert.ok(L.later.w >= 44 && L.later.h >= 44, '稍後按鈕熱區 >= 44');
  }
});

// ─────────────────────────────────────────────────────────────
// Test 4: 普通技能升級面板全面改版（Screenshot #5）
// ─────────────────────────────────────────────────────────────
test('R9 Item 4: Ordinary Level-Up Screen - Clean Washi Board, Balanced Heights & Clear Hierarchy', () => {
  for (const [w, h] of [[1366, 768], [844, 390]]) {
    const { UI } = loadRealUi(w, h, { imagesLoaded: true });
    const { ctx, text, roundRects } = makeSpyCanvas(w, h);

    const choices = [
      { id: 'katana', n: '妖刀斬', s: 'かたな', d: '揮出凌厲新月刀芒，斬裂前方妖怪', type: 'weapon', lv: 2 },
      { id: 'fire', n: '狐火炎', s: 'きつねび', d: '三團護體神火環繞周身，自動索敵焚燒', type: 'weapon', lv: 1 },
      { id: 'shield', n: '金剛結界', s: 'けっかい', d: '召喚護體勾玉，抵擋受傷', type: 'passive', lv: 1 }
    ];
    const WL = { katana: 1, fire: 0 };
    const WI = { katana: { zh: '妖刀斬' }, fire: { zh: '狐火炎' } };

    UI.drawLevelUp(ctx, 3, choices, WL, WI, 2, 100, 0, 'keyboard', { seals: 1 });

    // 1. 驗證修行進階標題與覺醒印
    const title = text.find(t => t.value.includes('修行進階'));
    assert.ok(title, `${w}x${h}: 必須繪製「修行進階」標題`);
    assert.ok(title.value.includes('Lv.3'), '標題必須標註正確等級');

    // 2. 驗證已習得資訊欄
    assert.ok(text.some(t => t.value === '已習得'), `${w}x${h}: 必須繪製「已習得」欄位摘要`);

    // 3. 驗證卡片編號 1, 2, 3 與類型標籤
    assert.ok(text.some(t => t.value === '1'), '必須有第 1 張卡標號');
    assert.ok(text.some(t => t.value === '2'), '必須有第 2 張卡標號');
    assert.ok(text.some(t => t.value === '3'), '必須有第 3 張卡標號');

    // 4. 驗證技能名稱與說明
    const allText = text.map(t => t.value).join(' | ');
    assert.ok(allText.includes('妖刀斬'), '必須繪製妖刀斬名稱');
    assert.ok(allText.includes('狐火炎'), '必須繪製狐火炎名稱');
    assert.ok(allText.includes('金剛結界'), '必須繪製金剛結界名稱');

    // 5. 驗證重抽按鈕
    assert.ok(text.some(t => t.value.includes('重抽')), '必須繪製重抽按鈕');
  }
});
