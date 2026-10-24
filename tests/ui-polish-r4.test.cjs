'use strict';
// 844 真 game 六配方、hero 仍在。不覆蓋十配方讓位 fixture。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const UI_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');
const SIX = [
  ['fusion_inkblade', '奧義・墨焰斬', 'katana', 'fire'],
  ['fusion_slashwheel', '奧義・斬界輪', 'katana', 'barrier'],
  ['fusion_exorcistblade', '奧義・退魔符刃', 'katana', 'boom'],
  ['fusion_foxfirebarrier', '奧義・妖火結界', 'fire', 'barrier'],
  ['fusion_flamefestival', '奧義・炎符祭', 'fire', 'boom'],
  ['fusion_exorcistseal', '奧義・退魔封陣', 'barrier', 'boom']
];
const VP = {
  '1366x768': { width: 1067.1875, height: 600, scale: 1.28, offsetX: 83.59375, offsetY: 0 },
  '844x390': { width: 1298.4615, height: 600, scale: 0.65, offsetX: 199.2308, offsetY: 0 }
};

function fontSizeOf(font) {
  const m = String(font || '').match(/([\d.]+)px/);
  return m ? Number(m[1]) : 16;
}
function makeCtx() {
  const rec = { text: [] };
  const state = { align: 'start', font: '10px sans-serif', baseline: 'alphabetic' };
  const stack = [];
  const ctx = {
    canvas: { width: 900, height: 600 },
    measureText(s) { return { width: [...String(s)].length * fontSizeOf(state.font) }; },
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    save() { stack.push({ ...state }); },
    restore() { const s = stack.pop(); if (s) Object.assign(state, s); },
    fillText(t, x, y, mw) {
      rec.text.push({ t: String(t), x, y, mw: mw == null ? null : mw, align: state.align, font: state.font });
    },
    strokeText(t, x, y) { this.fillText(t, x, y); },
    drawImage() {}
  };
  return new Proxy(ctx, {
    get(obj, k) {
      if (k === 'textAlign') return state.align;
      if (k === 'font') return state.font;
      if (k === 'textBaseline') return state.baseline;
      if (k === '__rec') return rec;
      if (k in obj) return obj[k];
      if (typeof k === 'string') return () => undefined;
      return undefined;
    },
    set(obj, k, v) {
      if (k === 'textAlign') state.align = v;
      else if (k === 'font') state.font = v;
      else if (k === 'textBaseline') state.baseline = v;
      obj[k] = v;
      return true;
    }
  });
}
function loadUi(vp) {
  const view = { ...vp };
  const windowObj = {
    innerWidth: vp.width, innerHeight: vp.height,
    matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {},
    VIEWPORT: {
      get: () => view,
      bounds: () => ({ left: -view.offsetX, top: -view.offsetY, right: 900 + view.offsetX, bottom: 600 + view.offsetY, width: view.width, height: view.height })
    },
    FX: { glow() {} }, ART: {},
    Image: function Image() { this.naturalWidth = 0; this.naturalHeight = 0; }
  };
  const sandbox = {
    window: windowObj,
    document: { getElementById: () => null, fonts: { check: () => true, load: () => Promise.resolve() }, createElement: () => null },
    location: { search: '', hostname: '127.0.0.1' },
    URLSearchParams, console, Math, Date, Object, Array, String, Number, Boolean, Promise,
    WeakMap, Map, Set, JSON, module: { exports: {} }, exports: {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UI_SRC, sandbox, { filename: 'js/ui.js' });
  return sandbox.window.UI;
}
function box(rec) {
  const size = fontSizeOf(rec.font);
  return { t: rec.t, top: rec.y - size * 0.8, bottom: rec.y + size * 0.2, y: rec.y, size };
}
function gap(above, below) { return below.top - above.bottom; }
function model() {
  return {
    eligibleRecipes: SIX.map(([id, name, a, b]) => ({ id, name, parents: [a, b] })),
    selectedRecipeId: 'fusion_flamefestival',
    slotBefore: 4,
    slotAfter: 3,
    sourceMutationIds: []
  };
}
function draw(vp) {
  const UI = loadUi(vp);
  const ctx = makeCtx();
  const L = UI.drawFusion(ctx, model(), 0, 'keyboard');
  return { L, texts: ctx.__rec.text.map(box) };
}
function one(texts, needle) {
  const hit = texts.filter(t => t.t.includes(needle));
  return hit;
}

test('R4 844 六配方 hero 仍在：header 與 hero 字形不相疊', () => {
  const { L, texts } = draw(VP['844x390']);
  assert.equal(L.cards.length, 6);
  assert.equal(L.multi, true);
  assert.ok(L.hero && L.hero.h >= 34, '六配方不是十配方讓位');
  const title = one(texts, '【 奧 義 融 合 】');
  const sub = one(texts, '兩 技 歸 一');
  const name = one(texts, '奧義・炎符祭');
  const parent = one(texts, '母技：');
  const desc = one(texts, '炎符層層引爆');
  assert.equal(title.length, 1, '主標');
  assert.ok(name.length >= 1, '選定名稱');
  assert.ok(parent.length >= 1, '母技');
  assert.ok(texts.some(t => t.t.includes('融合奧義') || t.t.includes('稍後再議')), '操作鈕');
  if (sub.length) assert.ok(gap(title[0], sub[0]) >= 1, `header 重疊 ${(-gap(title[0], sub[0]) * 0.65).toFixed(2)} CSS`);
  const heroName = name.find(t => t.y < (L.hero.y + L.hero.h));
  const heroParent = parent.find(t => t.y < (L.hero.y + L.hero.h + 2));
  assert.ok(heroName && heroParent, 'hero 內名稱與母技');
  assert.ok(gap(heroName, heroParent) >= 1, `hero 名稱/母技重疊 ${(-gap(heroName, heroParent) * 0.65).toFixed(2)} CSS`);
  const heroDesc = desc.find(t => t.y >= heroName.y && t.y < L.hero.y + L.hero.h + 4);
  if (heroDesc) assert.ok(gap(heroParent, heroDesc) >= 1, 'hero 母技/描述重疊');
});

test('R4 1366 六配方：主標副標與 hero 三行都在且分開', () => {
  const { L, texts } = draw(VP['1366x768']);
  assert.equal(L.cards.length, 6);
  assert.ok(L.hero);
  const title = one(texts, '【 奧 義 融 合 】')[0];
  const sub = one(texts, '兩 技 歸 一')[0];
  const name = one(texts, '奧義・炎符祭').find(t => t.y >= L.hero.y && t.y <= L.hero.y + L.hero.h);
  const parent = one(texts, '母技：').find(t => t.y >= L.hero.y && t.y <= L.hero.y + L.hero.h);
  const desc = one(texts, '炎符層層引爆').find(t => t.y >= L.hero.y && t.y <= L.hero.y + L.hero.h);
  assert.ok(title && sub && name && parent && desc);
  assert.ok(gap(title, sub) >= 1, '1366 header');
  assert.ok(gap(name, parent) >= 1, '1366 名稱/母技');
  assert.ok(gap(parent, desc) >= 1, '1366 母技/描述');
  for (const c of L.cards) assert.ok(c.cssH >= 44 && c.cssW >= 44);
});
