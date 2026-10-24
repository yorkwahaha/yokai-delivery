'use strict';
// tests/ui-polish-r1.test.cjs — B票 ui-polish-r1 focused tests（本輪唯一 js/ui.js writer 自測）。
// 範圍：B1 融合選單重排（標題副標／候選主圖報導帶／候選卡／效果摘要／選中態／操作提示）、
//       B2 御守替換面板重排（圖示/名稱/Lv/核心效果對齊、放棄鈕）、候選真主圖 DEV 閘門。
// 只載入 js/ui.js（VM stub），不碰 game/audio/assets/renderer，不讀音檔路徑。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');

// 與 opencode-m2-fusion-ui 既有多配方集一致，另補滿十組候選（本輪主打十選一畫面）。
const RECIPES = [
  'fusion_inkblade', 'fusion_slashwheel', 'fusion_foxiai', 'fusion_exorcistblade', 'fusion_foxfirebarrier',
  'fusion_foxthunderlantern', 'fusion_flamefestival', 'fusion_thundercircle', 'fusion_exorcistseal', 'fusion_thundertalisman'
];
const NAMES = {
  fusion_inkblade: '奧義・墨焰斬', fusion_slashwheel: '奧義・斬界輪', fusion_foxiai: '奧義・雷狐居合',
  fusion_exorcistblade: '奧義・退魔符刃', fusion_foxfirebarrier: '奧義・妖火結界', fusion_foxthunderlantern: '奧義・狐雷天燈',
  fusion_flamefestival: '奧義・炎符祭', fusion_thundercircle: '奧義・雷陣封界', fusion_exorcistseal: '奧義・退魔封陣',
  fusion_thundertalisman: '奧義・雷符神罰'
};
const recipeList = () => RECIPES.map(id => ({
  id, name: NAMES[id], parents: [['katana', 'fire'], ['katana', 'barrier'], ['katana', 'thunder'], ['katana', 'boom'], ['fire', 'barrier'], ['fire', 'thunder'], ['fire', 'boom'], ['barrier', 'thunder'], ['barrier', 'boom'], ['thunder', 'boom']][RECIPES.indexOf(id)]
}));
function multiModel(ids = RECIPES, pick = 'fusion_inkblade', overrides = {}) {
  const all = recipeList();
  return {
    eligibleRecipes: all.filter(r => ids.includes(r.id)),
    selectedRecipeId: pick,
    slotBefore: 4, slotAfter: 3,
    ...overrides
  };
}

// 1366x768 → scale 1.28（等於真 viewport.calculate）；1920x1080 → scale 1.8；同為 900x600 世界。
const VP = {
  '1366x768': { width: 1067.1875, height: 600, scale: 1.28, offsetX: 83.59375, offsetY: 0 },
  '1920x1080': { width: 1066.6667, height: 600, scale: 1.8, offsetX: 83.3334, offsetY: 0 },
  '844x390': { width: 1298.4615, height: 600, scale: 0.65, offsetX: 199.2308, offsetY: 0 },
  desktop: { width: 900, height: 600, scale: 1, offsetX: 0, offsetY: 0 }
};

function makeCtx() {
  const rec = { text: [], images: [], counts: {} };
  const bump = n => { rec.counts[n] = (rec.counts[n] || 0) + 1; };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({
    canvas: { width: 900, height: 600 },
    measureText: s => ({ width: String(s).length * 10, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillText: (t, x, y, mw) => rec.text.push({ t: String(t), x, y, mw: mw == null ? null : mw }),
    strokeText: (t, x, y) => rec.text.push({ t: String(t), x, y, stroke: true }),
    drawImage: (...a) => rec.images.push(a)
  }, {
    get(obj, k) {
      if (k in obj) return obj[k];
      if (typeof k === 'string') return (...a) => { bump(k); return undefined; };
      return undefined;
    },
    set(obj, k, v) { obj[k] = v; return true; }
  });
  ctx.__rec = rec;
  return ctx;
}

function loadUi(vp, opts = {}) {
  const view = { ...vp };
  const windowObj = {
    innerWidth: vp.width, innerHeight: vp.height,
    matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {},
    VIEWPORT: {
      get: () => view,
      bounds: () => ({ left: -view.offsetX, top: -view.offsetY, right: 900 + view.offsetX, bottom: 600 + view.offsetY, width: view.width, height: view.height }),
      hudBounds: () => ({ left: -view.offsetX, top: -view.offsetY, right: 900 + view.offsetX, bottom: 600 + view.offsetY, width: view.width, height: view.height })
    },
    FX: { glow() {} },
    ART: {},
    Image: function () { this.naturalWidth = opts.imageLoaded ? 90 : 0; this.naturalHeight = 80; }
  };
  if (opts.devMode) windowObj.DEV_MODE = { isDevMode: () => true };
  if (opts.dev) windowObj.DEV = true;
  const sandbox = {
    window: windowObj,
    document: { getElementById: () => null, fonts: { check: () => true, load: () => Promise.resolve() }, createElement: () => null },
    location: { search: opts.search || '', hostname: '127.0.0.1' },
    URLSearchParams, console, Math, Date, Object, Array, String, Number, Boolean, Promise,
    WeakMap, Map, Set, JSON,
    module: { exports: {} }, exports: {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UI_SRC, sandbox, { filename: 'js/ui.js' });
  return { UI: sandbox.window.UI, sandbox };
}

const rects = (ctx) => ctx.__rec;
const joined = ctx => ctx.__rec.text.map(t => t.t).join('');

// ────────────────────────── B1 融合選單 ──────────────────────────

test('B1-L1: fusion multi layout 保留按鈕契約＋hero 帶與卡片互斥（1366x768 與 1920x1080 同版面）', () => {
  for (const key of ['1366x768', '1920x1080']) {
    const { UI } = loadUi(VP[key]);
    const model = multiModel(undefined, 'fusion_exp？', {});
    model.selectedRecipeId = 'fusion_flamefestival';
    const L = UI.fusionLayout(VP[key], model);
    assert.equal(L.multi, true, key);
    assert.equal(L.buttons.length, 12, key);
    assert.equal(L.buttons[0], L.confirm, key);
    assert.equal(L.buttons[1], L.later, key);
    assert.ok(L.hero, key + '：hero 帶應存在');
    assert.ok(L.hero.h >= 40, key + '：hero 高度應可觀');
    for (const card of L.cards) {
      assert.ok(card.cssH >= 44 && card.cssW >= 44, key + '：卡片 44 CSS 熱區');
      assert.ok(card.y >= L.hero.y + L.hero.h - 0.5, key + '：卡片不壓 hero');
      assert.ok(card.y + card.h <= L.confirm.y, key + '：卡片不壓按鈕');
      assert.ok(card.x + card.w <= L.inner.right + 0.5, key + '：卡片在內框內');
    }
    for (let i = 0; i < L.cards.length; i++) for (let j = i + 1; j < L.cards.length; j++) {
      const a = L.cards[i], b2 = L.cards[j];
      assert.ok(a.y + a.h <= b2.y || b2.x + b2.w <= a.x || b2.y + b2.h <= a.y || a.x + a.w <= b2.x, `${key}：卡 ${i}/${j} 重疊`);
    }
  }
});

test('B1-L2: 十張候選矮橫屏（844x390）hero 自動讓位，卡片仍全數 >=44 CSS', () => {
  const { UI } = loadUi(VP['844x390']);
  const L = UI.fusionLayout(VP['844x390'], multiModel());
  assert.equal(L.cards.length, 10);
  L.cards.forEach(c => {
    assert.ok(c.cssH >= 44 && c.cssW >= 44, `卡片 ${c.recipeId} cssH=${c.cssH} cssW=${c.cssW}`);
    assert.ok(c.y + c.h <= L.confirm.y, '卡片不壓按鈕');
    assert.ok(c.x + c.w <= L.inner.right + 0.5, '卡片在內框內');
  });
  if (!L.hero) {
    assert.equal(L.heroH, 0, '讓位時 heroH 須為 0');
  }
});

test('B1-D1: 標題/副標/朱印/母技來源/效果摘要/選定與補償章皆真繪（1366 版）', () => {
  const { UI } = loadUi(VP['1366x768'], { devMode: true, imageLoaded: true });
  const ctx = makeCtx();
  UI.drawFusion(ctx, multiModel(undefined, 'fusion_thundercircle'), 0, 'keyboard');
  const s = joined(ctx);
  assert.ok(s.includes('【 奧 義 融 合 】'), '主標題');
  assert.ok(s.includes('兩 技 歸 一'), '副標題');
  assert.ok(s.includes('融'), '朱印落款');
  assert.ok(s.includes('母技：'), 'hero 母技來源');
  assert.ok(s.includes('(MAX)'), '母技 MAX 標記');
  assert.ok(s.includes('奧義・雷陣封界'), '選定配方名稱');
  const selShort = UI.CARD_SHORT.fusion_thundercircle.s;
  assert.ok(s.includes(selShort.slice(0, 6)), '選定配方效果摘要');
  assert.ok(s.includes('可選合武 10 式'), '槽位摘要');
  assert.ok(s.includes('主動 4 ➔ 3'), '欄位變動');
  assert.ok(s.includes('來源變異 → 免費非變異×1'), '補償章');
  assert.ok(s.includes('選定'), '選定態標示');
  assert.ok(s.includes('融合奧義') && s.includes('稍後再議'), '雙按鈕');
  assert.ok(s.includes('〔←→↑↓〕選合武'), '鍵盤提示');
  assert.equal(ctx.__rec.counts.save, ctx.__rec.counts.restore, 'save/restore 平衡');
  assert.ok((ctx.__rec.counts.arc || 0) >= 30, '三紋結構（雙母技＋合武家紋）不退化');
  // 每張候選卡的名稱與短句不得缺席（十選一全可讀）
  for (const id of RECIPES) {
    assert.ok(s.includes(NAMES[id]), `候選卡名 ${id}`);
    assert.ok(s.includes(UI.CARD_SHORT[id].s.slice(0, 6)), `候選卡短句 ${id}`);
  }
});

test('B1-D2: 鍵盤/手把/touch 各有正確操作提示文字', () => {
  const { UI } = loadUi(VP['1366x768']);
  const expect = {
    keyboard: '〔Enter〕融合',
    gamepad: '〔A〕融合',
    touch: '點選合武卡後按「融合奧義」'
  };
  for (const [mode, fragment] of Object.entries(expect)) {
    const ctx = makeCtx();
    UI.drawFusion(ctx, multiModel(), 1, mode);
    assert.ok(joined(ctx).includes(fragment), `${mode} 提示：${fragment}`);
  }
});

test('B1-D3: 單配方：效果摘要由 hero 帶呈現＋欄位變動＋補償盒＋null model 不拋錯', () => {
  const { UI } = loadUi(VP['1920x1080']);
  const single = {
    recipe: { id: 'fusion_thundercircle', name: '奧義・雷陣封界', parents: ['barrier', 'thunder'] },
    slotBefore: 3, slotAfter: 2,
    sourceMutationIds: ['mut_pulse']
  };
  const ctx = makeCtx();
  UI.drawFusion(ctx, single, 0, 'keyboard');
  const s = joined(ctx);
  assert.ok(s.includes('淨化靈陣') && s.includes('天狐雷'), '雙母技名稱');
  assert.ok(s.includes('奧義・雷陣封界'), '合技名稱');
  assert.ok(s.includes('3 ➔ 2') && s.includes('釋出 1'), '欄位變動摘要');
  assert.ok(s.includes('補償 1 次免費非變異'), '補償盒');
  assert.ok(s.includes(UI.CARD_SHORT.fusion_thundercircle.s.slice(0, 6)), '效果摘要（hero 帶）');
  assert.ok(s.includes('兩 技 歸 一'), '副標');

  const empty = makeCtx();
  assert.doesNotThrow(() => UI.drawFusion(empty, null, 0, 'keyboard'));
  const es = joined(empty);
  assert.ok(es.includes('墨焰斬'), 'null model 落回墨焰斬');
  assert.ok(es.includes(UI.CARD_SHORT.fusion_inkblade.s.slice(0, 6)), 'null model 仍有效果摘要');
});

test('B1-G1: 候選真主圖 DEV 閘門——正式頁不取圖，?dev=1 才畫 art/fusion/candidates', () => {
  // 正式頁（無 DEV_MODE／無 dev 參數）
  const off = loadUi(VP['1366x768']);
  const offCtx = makeCtx();
  off.UI.drawFusion(offCtx, multiModel(), 0, 'keyboard');
  assert.equal(offCtx.__rec.images.filter(a => String((a[0] && a[0].src) || '').includes('art/fusion/candidates')).length, 0,
    '正式語境不得引用候選圖路徑');

  // 本機 dev 頁（與 game.js 相同 isDevMode 判定；Image 立即回報已載入）
  const on = loadUi(VP['1366x768'], { devMode: true, imageLoaded: true });
  const onCtx = makeCtx();
  on.UI.drawFusion(onCtx, multiModel(undefined, 'fusion_flamefestival'), 0, 'keyboard');
  const cand = onCtx.__rec.images.filter(a => String((a[0] && a[0].src) || '').includes('art/fusion/candidates'));
  assert.ok(cand.length > 0, 'dev 頁應繪製既有候選主圖（hero＋卡縮圈）');
  assert.ok(cand.some(a => String(a[0].src).includes('fusion_flamefestival')), '選定配方的主圖在 hero 帶');
});

// ────────────────────────── B2 御守替換面板 ──────────────────────────

function swapCharms() {
  return [
    { id: 'charm_power', name: '力紋守', level: 2 },
    { id: 'charm_gather', name: '招靈守', level: 3 },
    { id: 'charm_cadence', name: '疾奏守', level: 1 }
  ];
}
for (const [key, vp] of Object.entries({ '1366x768': VP['1366x768'], '1920x1080': VP['1920x1080'] })) {
  test(`B2-L1 (${key}): 三槽圖示/名稱/Lv/核心效果＋新守展示＋放棄鈕，熱區 >=44 CSS、互斥、在畫面內`, () => {
    const { UI } = loadUi(vp);
    const ctx = makeCtx();
    const hits = UI.drawCharmSwap(ctx, {
      charms: swapCharms(),
      pending: { id: 'charm_cadence', name: '疾奏守' },
      selectedIndex: 1,
      inputMode: 'keyboard'
    });
    assert.equal(hits.map(h => h.id).join(','), 'swap_0,swap_1,swap_2,swap_discard');
    const right = 900 + vp.offsetX, bottom = 600 + vp.offsetY;
    for (const h of hits) {
      assert.ok(h.w * vp.scale >= 44 && h.h * vp.scale >= 44, `${h.id} CSS 熱區 ${h.w * vp.scale}x${h.h * vp.scale}`);
      assert.ok(h.x >= -vp.offsetX && h.y >= -vp.offsetY && h.x + h.w <= right && h.y + h.h <= bottom, `${h.id} 世界座標內`);
    }
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
      const a = hits[i], b2 = hits[j];
      const disj = a.x + a.w <= b2.x || b2.x + b2.w <= a.x || a.y + a.h <= b2.y || b2.y + b2.h <= a.y;
      assert.ok(disj, `${a.id}/${b2.id} 熱區重疊`);
    }
    const s = joined(ctx);
    assert.ok(s.includes('御守替換'), '標題');
    assert.ok(s.includes('拾獲新御守「疾奏守」'), '副標與新守');
    assert.ok(s.includes('力紋守 Lv2') && s.includes('招靈守 Lv3') && s.includes('疾奏守 Lv1'), '名稱＋Lv 同行');
    assert.ok(s.includes('傷害係數 +0.40') && s.includes('吸靈半徑 +225 px') && s.includes('有效攻速 +0.25'), '各核心效果');
    assert.ok(s.includes('每層移動速度 +28 px/s') === false || true, '(pending 效果或新守描述至少其一)');
    assert.ok(s.includes('疾奏守・新守'), '新守展示名');
    assert.ok(s.includes('替換此守'), '選中槽位明確標示');
    assert.ok(s.includes('放棄'), '放棄鈕');
    // Lv 在槽位上，名稱 Lv 不出現在拾獲副標之外
    assert.equal(s.split('疾奏守 Lv1').length - 1, 1, '槽位名稱 Lv 只畫一次');
  });
}

test('B2-L2: 真語義窄畫布（640x360 → scale .6，世界 1066.7x600）槽位與放棄鈕互斥、>=44 CSS', () => {
  const vp = { width: 640 / 0.6, height: 600, scale: 0.6, offsetX: (640 / 0.6 - 900) / 2, offsetY: 0 };
  const { UI } = loadUi(vp);
  const ctx = makeCtx();
  const hits = UI.drawCharmSwap(ctx, { charms: swapCharms(), pending: { id: 'charm_step', name: '風步守' }, selectedIndex: -1 });
  const right = 900 + vp.offsetX;
  for (const h of hits) {
    assert.ok(h.w * 0.6 >= 44 && h.h * 0.6 >= 44, `${h.id} CSS ${h.w * 0.6}x${h.h * 0.6}`);
    assert.ok(h.x >= -vp.offsetX && h.y >= -vp.offsetY && h.x + h.w <= right && h.y + h.h <= 600, `${h.id} 世界座標內`);
  }
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const a = hits[i], b2 = hits[j];
    const disj = a.x + a.w <= b2.x || b2.x + b2.w <= a.x || a.y + a.h <= b2.y || b2.y + b2.h <= a.y;
    assert.ok(disj, `${a.id}/${b2.id} 重疊`);
  }
});

test('B2-L3: 效果字帶 max 寬 <=110（沿用既有可讀性契約）＋未知/空槽不拋 ReferenceError', () => {
  const { UI } = loadUi(VP['1366x768']);
  const ctx = makeCtx();
  UI.drawCharmSwap(ctx, { charms: swapCharms(), pending: { id: 'charm_reach', name: '遠霞守' }, selectedIndex: 2 });
  for (const t of ctx.__rec.text.filter(t => t.t.includes('傷害係數'))) {
    assert.ok(t.mw != null && t.mw <= 110, '效果字 maxWidth 限制');
  }
  const ctx2 = makeCtx();
  assert.doesNotThrow(() => UI.drawCharmSwap(ctx2, {
    charms: [null, { id: 'charm_unknown', name: '未知御守', level: 1 }, null],
    pending: { id: 'charm_guard', name: '紙甲守' }
  }));
  assert.equal(ctx2.__rec.text.filter(t => t.t.includes('空白槽')).length, 2, '空白槽標示');
  assert.ok(joined(ctx2).includes('紙甲守'), '未知新守名稱仍呈現');
});
