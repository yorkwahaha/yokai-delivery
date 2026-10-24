'use strict';
// tests/ui-polish-r3.test.cjs — B-TEXT-BOUNDS-R3。真 consumer：UI.drawFusion／UI.drawCharmSwap。
// 字形盒、textAlign、行距。不替代 tests/ui-polish-r1.test.cjs 的原 10 測。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const UI_SRC = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');

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
const PAIRS = [['katana', 'fire'], ['katana', 'barrier'], ['katana', 'thunder'], ['katana', 'boom'], ['fire', 'barrier'], ['fire', 'thunder'], ['fire', 'boom'], ['barrier', 'thunder'], ['barrier', 'boom'], ['thunder', 'boom']];
const recipeList = () => RECIPES.map((id, i) => ({ id, name: NAMES[id], parents: PAIRS[i] }));

const VP = {
  '1366x768': { width: 1067.1875, height: 600, scale: 1.28, offsetX: 83.59375, offsetY: 0 },
  '1920x1080': { width: 1066.6667, height: 600, scale: 1.8, offsetX: 83.3334, offsetY: 0 },
  '844x390': { width: 1298.4615, height: 600, scale: 0.65, offsetX: 199.2308, offsetY: 0 }
};

const FLAME = '炎符層層引爆，化為席捲戰場的炎之祭典。';
const INK = '妖刀與狐火融合，巨幅赤墨斬擊並留下焦痕灼燒。';
const RULE = '每局限融合 1 次';
const HINTS = {
  keyboard: '〔Enter〕融合',
  gamepad: '〔A〕融合',
  touch: '點選合武卡後按「融合奧義」'
};

function fontSizeOf(font) {
  const m = String(font || '').match(/([\d.]+)px/);
  return m ? Number(m[1]) : 16;
}
function measureOf(text, font) {
  const size = fontSizeOf(font);
  return { width: [...String(text)].length * size, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2 };
}
function makeCtx() {
  const rec = { text: [] };
  const state = { align: 'start', font: '10px sans-serif', baseline: 'alphabetic', fillStyle: '#000' };
  const stack = [];
  const ctx = {
    canvas: { width: 900, height: 600 },
    measureText: s => measureOf(s, state.font),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    save() { stack.push({ ...state }); },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    fillText(t, x, y, mw) {
      rec.text.push({
        t: String(t), x, y, mw: mw == null ? null : mw,
        align: state.align, font: state.font, baseline: state.baseline
      });
    },
    strokeText(t, x, y) { this.fillText(t, x, y); },
    drawImage() {}
  };
  const proxy = new Proxy(ctx, {
    get(obj, k) {
      if (k === 'textAlign') return state.align;
      if (k === 'font') return state.font;
      if (k === 'textBaseline') return state.baseline;
      if (k === 'fillStyle') return state.fillStyle;
      if (k in obj) return obj[k];
      if (typeof k === 'string') return () => undefined;
      return undefined;
    },
    set(obj, k, v) {
      if (k === 'textAlign') state.align = v;
      else if (k === 'font') state.font = v;
      else if (k === 'textBaseline') state.baseline = v;
      else if (k === 'fillStyle') state.fillStyle = v;
      obj[k] = v;
      return true;
    }
  });
  proxy.__rec = rec;
  return proxy;
}
function loadUi(vp) {
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
    Image: function Image() { this.naturalWidth = 0; this.naturalHeight = 0; }
  };
  const sandbox = {
    window: windowObj,
    document: { getElementById: () => null, fonts: { check: () => true, load: () => Promise.resolve() }, createElement: () => null },
    location: { search: '', hostname: '127.0.0.1' },
    URLSearchParams, console, Math, Date, Object, Array, String, Number, Boolean, Promise,
    WeakMap, Map, Set, JSON,
    module: { exports: {} }, exports: {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UI_SRC, sandbox, { filename: 'js/ui.js' });
  return sandbox.window.UI;
}
function glyph(rec) {
  const size = fontSizeOf(rec.font);
  const measured = measureOf(rec.t, rec.font).width;
  const width = rec.mw != null ? Math.min(measured, rec.mw) : measured;
  const align = rec.align === 'end' || rec.align === 'right' ? 'right'
    : rec.align === 'center' ? 'center' : 'left';
  const left = align === 'right' ? rec.x - width : align === 'center' ? rec.x - width / 2 : rec.x;
  return {
    left, right: left + width, top: rec.y - size * 0.8, bottom: rec.y + size * 0.2,
    align, t: rec.t, y: rec.y
  };
}
function overlaps(a, b) {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}
function assertInside(box, rect, label) {
  assert.ok(box.left >= rect.x - 1, `${label} 左緣 ${box.left.toFixed(1)} 出卡 ${rect.x} align=${box.align} 「${box.t.slice(0, 18)}」`);
  assert.ok(box.right <= rect.x + rect.w + 1, `${label} 右緣 ${box.right.toFixed(1)} 出卡 ${(rect.x + rect.w).toFixed(1)}`);
  assert.ok(box.top >= rect.y - 1, `${label} 上緣 ${box.top.toFixed(1)} 出卡 ${rect.y}`);
  assert.ok(box.bottom <= rect.y + rect.h + 1, `${label} 下緣 ${box.bottom.toFixed(1)} 出卡 ${(rect.y + rect.h).toFixed(1)}`);
}
function inRect(rec, rect) {
  return rec.y >= rect.y - 1 && rec.y <= rect.y + rect.h + 1;
}
function fusionModel() {
  return {
    eligibleRecipes: recipeList(),
    selectedRecipeId: 'fusion_flamefestival',
    slotBefore: 4,
    slotAfter: 3,
    sourceMutationIds: ['mut_pulse']
  };
}
function cardFills(ctx, card, needle) {
  return ctx.__rec.text.filter(rec => rec.t.includes(needle) && inRect(rec, card)).map(glyph);
}
function gap(above, below, label) {
  assert.ok(above.bottom <= below.top + 0.5, `${label} 行距不足 above.bottom=${above.bottom.toFixed(1)} below.top=${below.top.toFixed(1)}`);
}

for (const [key, mode] of [['1366x768', 'keyboard'], ['1920x1080', 'keyboard'], ['844x390', 'touch']]) {
  test(`R3-FUSION ${key} ${mode}: 選定描述/補償左對齊且留在卡內，行距分開，規則句不壓卡`, () => {
    const vp = VP[key];
    const UI = loadUi(vp);
    const ctx = makeCtx();
    const L = UI.drawFusion(ctx, fusionModel(), 0, mode);
    const card = L.cards.find(c => c.recipeId === 'fusion_flamefestival');
    const ink = L.cards.find(c => c.recipeId === 'fusion_inkblade');
    const desc = cardFills(ctx, card, '炎符層層引爆');
    const comp = cardFills(ctx, card, '變異×1 → 免費非變異×1');
    const inkDesc = cardFills(ctx, ink, '妖刀與狐火融合');
    assert.ok(desc.length >= 1, `${key} 選定卡應畫出炎符祭短句`);
    assert.ok(comp.length >= 1, `${key} 選定卡應畫出補償`);
    assert.ok(inkDesc.length >= 1, `${key} 未選定卡應畫出短句`);
    for (const box of desc) {
      assert.equal(box.align, 'left', `${key} 描述 textAlign`);
      assertInside(box, card, key + ' 描述');
    }
    for (const box of comp) {
      assert.equal(box.align, 'left', `${key} 補償 textAlign`);
      assertInside(box, card, key + ' 補償');
    }
    for (const box of inkDesc) assertInside(box, ink, key + ' 未選定描述');
    const descBottom = Math.max(...desc.map(b => b.bottom));
    const compTop = Math.min(...comp.map(b => b.top));
    assert.ok(descBottom <= compTop + 0.5, `${key} 描述/補償行距 ${descBottom.toFixed(1)} / ${compTop.toFixed(1)}`);
    const name = cardFills(ctx, card, '奧義・炎符祭');
    assert.ok(name.length >= 1, `${key} 卡名`);
    const nameBottom = Math.max(...name.map(b => b.bottom));
    const descTop = Math.min(...desc.map(b => b.top));
    assert.ok(nameBottom <= descTop + 0.5, `${key} 卡名/描述行距`);
    const cards = L.cards.map(c => ({ left: c.x, right: c.x + c.w, top: c.y, bottom: c.y + c.h }));
    const rules = ctx.__rec.text.filter(r => r.t.includes(RULE)).map(glyph);
    for (const box of rules) {
      assert.ok(!cards.some(c => overlaps(box, c)), `${key} 規則句壓卡 top=${box.top.toFixed(1)}`);
    }
    const dup = ctx.__rec.text.filter(r => r.t.includes('選定：')).map(glyph);
    for (const box of dup) {
      assert.ok(!cards.some(c => overlaps(box, c)), `${key} 讓位重複句壓卡 「${box.t.slice(0, 12)}」`);
    }
    const hints = ctx.__rec.text.filter(r => r.t.includes(HINTS[mode])).map(glyph);
    for (const box of hints) {
      assert.ok(!cards.some(c => overlaps(box, c)), `${key} ${mode} 提示壓卡`);
    }
    if (key === '1366x768' || key === '1920x1080') {
      assert.ok(rules.length >= 1, `${key} 有空間時規則句仍要畫`);
      assert.equal(dup.length, 0, `${key} 有 hero 時不畫讓位重複句`);
      assert.ok(ctx.__rec.text.some(r => r.t.includes(HINTS[mode])), `${key} ${mode} 提示來源`);
    }
    for (const c of L.cards) assert.ok(c.cssH >= 44 && c.cssW >= 44, `${key} 44 CSS`);
  });
}

test('R3-FUSION 1366 三來源: keyboard/gamepad/touch 提示不退化且不壓卡', () => {
  const vp = VP['1366x768'];
  for (const mode of ['keyboard', 'gamepad', 'touch']) {
    const UI = loadUi(vp);
    const ctx = makeCtx();
    const L = UI.drawFusion(ctx, fusionModel(), 0, mode);
    const cards = L.cards.map(c => ({ left: c.x, right: c.x + c.w, top: c.y, bottom: c.y + c.h }));
    const hits = ctx.__rec.text.filter(r => r.t.includes(HINTS[mode])).map(glyph);
    assert.ok(hits.length >= 1, mode);
    for (const box of hits) assert.ok(!cards.some(c => overlaps(box, c)), mode + ' 提示壓卡');
  }
});

function swapModel(inputMode) {
  return {
    charms: [
      { id: 'charm_power', name: '力紋守', level: 2 },
      { id: 'charm_gather', name: '招靈守', level: 3 },
      { id: 'charm_cadence', name: '疾奏守', level: 1 }
    ],
    pending: { id: 'charm_cadence', name: '疾奏守' },
    selectedIndex: 1,
    inputMode
  };
}
function innerOf(vp) {
  const cssPx = css => Math.max(1, Math.ceil(css / vp.scale));
  const midX = 450;
  const panelW = cssPx(468);
  const x = Math.max(-vp.offsetX + cssPx(8), midX - panelW / 2);
  const innerX = x + cssPx(26);
  const innerW = panelW - cssPx(52);
  return { x: innerX, w: innerW };
}

for (const [key, mode] of [['1920x1080', 'keyboard'], ['844x390', 'touch'], ['1366x768', 'keyboard']]) {
  test(`R3-SWAP ${key} ${mode}: 替換此守離開名稱，name/Lv/stat 仍可讀，副標進 innerW`, () => {
    const vp = VP[key];
    const UI = loadUi(vp);
    const ctx = makeCtx();
    const hits = UI.drawCharmSwap(ctx, swapModel(mode));
    const slot = hits.find(h => h.id === 'swap_1');
    assert.ok(slot.w * vp.scale >= 44 && slot.h * vp.scale >= 44, '中槽 44 CSS');
    const badge = ctx.__rec.text.filter(r => r.t.includes('替換此守')).map(glyph);
    const name = ctx.__rec.text.filter(r => r.t === '招靈守 Lv3').map(glyph);
    const stat = ctx.__rec.text.filter(r => r.t.includes('吸靈半徑 +225')).map(glyph);
    assert.equal(badge.length, 1, '替換此守');
    assert.equal(name.length, 1, '名稱 Lv');
    assert.equal(stat.length, 1, '核心效果');
    assertInside(badge[0], slot, '徽章');
    assertInside(name[0], slot, '名稱');
    assertInside(stat[0], slot, '效果');
    assert.ok(!overlaps(badge[0], name[0]), `${key} 徽章壓名稱`);
    assert.ok(!overlaps(badge[0], stat[0]), `${key} 徽章壓效果`);
    gap(badge[0], name[0], key + ' 徽章/名稱');
    const sub = ctx.__rec.text.filter(r => r.t.includes('拾獲新御守「疾奏守」')).map(glyph);
    assert.equal(sub.length, 1, '副標');
    const inner = innerOf(vp);
    assert.ok(sub[0].left >= inner.x - 1, `${key} 副標左 ${sub[0].left.toFixed(1)} inner ${inner.x.toFixed(1)}`);
    assert.ok(sub[0].right <= inner.x + inner.w + 1, `${key} 副標右 ${sub[0].right.toFixed(1)} innerR ${(inner.x + inner.w).toFixed(1)} w=${inner.w}`);
    assert.ok(ctx.__rec.text.some(r => r.t.includes('力紋守 Lv2') && r.t.includes('Lv2')));
    assert.ok(ctx.__rec.text.some(r => r.t === '疾奏守 Lv1'));
    assert.ok(ctx.__rec.text.some(r => r.t.includes('放棄')));
  });
}
