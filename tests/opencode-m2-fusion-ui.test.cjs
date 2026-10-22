// tests/opencode-m2-fusion-ui.test.cjs
// M2-FUSION-UI：多配方選卡／短句／雙來源／44 CSS 窄屏／單配方回歸。
// 只載入 js/ui.js（VM），不碰 game／fusion／renderer／assets／音訊；role：OpenCode 唯一 ui.js writer。
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// 真 VIEWPORT.calculate(844, 390)：scale=0.65、邏輯 1298.46×600。
const PHONE = {
  width: 844 / 0.65,
  height: 600,
  scale: 0.65,
  offsetX: (844 / 0.65 - 900) / 2,
  offsetY: 0
};
// 既有測試沿用的短視口（邏輯 844×390、scale .65）：僅作矮螢幕壓力案例。
const SHORT = { width: 844, height: 390, scale: 0.65, offsetX: 0, offsetY: 0 };
const DESKTOP = { width: 1000, height: 700, scale: 1, offsetX: 0, offsetY: 0 };

const RECIPES = [
  { id: 'fusion_inkblade', name: '奧義・墨焰斬', parents: ['katana', 'fire'] },
  { id: 'fusion_foxiai', name: '奧義・雷狐居合', parents: ['katana', 'thunder'], sourceMutationIds: ['mut_crosscut', 'mut_branch'] },
  { id: 'fusion_exorcistblade', name: '奧義・退魔符刃', parents: ['katana', 'boom'] },
  { id: 'fusion_foxfirebarrier', name: '奧義・妖火結界', parents: ['fire', 'barrier'], sourceMutationIds: [] },
  { id: 'fusion_thundercircle', name: '奧義・雷陣封界', parents: ['barrier', 'thunder'] },
  { id: 'fusion_exorcistseal', name: '奧義・退魔封陣', parents: ['barrier', 'boom'] }
];

function multiModel(overrides = {}) {
  return {
    eligibleRecipes: RECIPES.map(r => ({ ...r })),
    selectedRecipeId: 'fusion_exorcistseal',
    slotBefore: 4,
    slotAfter: 3,
    ...overrides
  };
}

function createMockContext() {
  const calls = [];
  const textCalls = [];
  const recorded = (name, args) => calls.push({ name, args: Array.from(args) });
  const gradient = { addColorStop: (...args) => recorded('addColorStop', args) };
  const ctx = {
    calls,
    textCalls,
    getCallCount: name => calls.filter(c => c.name === name).length,
    save: (...a) => recorded('save', a),
    restore: (...a) => recorded('restore', a),
    translate: (...a) => recorded('translate', a),
    rotate: (...a) => recorded('rotate', a),
    scale: (...a) => recorded('scale', a),
    beginPath: (...a) => recorded('beginPath', a),
    closePath: (...a) => recorded('closePath', a),
    moveTo: (...a) => recorded('moveTo', a),
    lineTo: (...a) => recorded('lineTo', a),
    arc: (...a) => recorded('arc', a),
    arcTo: (...a) => recorded('arcTo', a),
    ellipse: (...a) => recorded('ellipse', a),
    roundRect: (...a) => recorded('roundRect', a),
    rect: (...a) => recorded('rect', a),
    fill: (...a) => recorded('fill', a),
    stroke: (...a) => recorded('stroke', a),
    fillRect: (...a) => recorded('fillRect', a),
    strokeRect: (...a) => recorded('strokeRect', a),
    clearRect: (...a) => recorded('clearRect', a),
    quadraticCurveTo: (...a) => recorded('quadraticCurveTo', a),
    bezierCurveTo: (...a) => recorded('bezierCurveTo', a),
    setLineDash: (...a) => recorded('setLineDash', a),
    setTransform: (...a) => recorded('setTransform', a),
    drawImage: (...a) => recorded('drawImage', a),
    clip: (...a) => recorded('clip', a),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillText: (text, x, y) => {
      textCalls.push({ text: String(text), x, y });
      recorded('fillText', [text, x, y]);
    },
    measureText: text => ({
      width: String(text).length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3
    }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    canvas: { width: 900, height: 600 }
  };
  return ctx;
}

function loadUiSandbox(vp = DESKTOP) {
  const viewport = { ...vp };
  const mockWindow = {
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    VIEWPORT: {
      get: () => viewport,
      bounds: () => ({
        left: -(viewport.offsetX || 0),
        top: -(viewport.offsetY || 0),
        right: -(viewport.offsetX || 0) + viewport.width,
        bottom: -(viewport.offsetY || 0) + viewport.height,
        width: viewport.width,
        height: viewport.height
      }),
      hudBounds: () => ({
        left: -(viewport.offsetX || 0),
        top: -(viewport.offsetY || 0),
        right: -(viewport.offsetX || 0) + viewport.width,
        bottom: -(viewport.offsetY || 0) + viewport.height,
        width: viewport.width,
        height: viewport.height
      })
    },
    FX: { glow: () => {} },
    ART: {},
    Image: function () { this.naturalWidth = 100; this.naturalHeight = 100; }
  };
  const mockDocument = {
    getElementById: () => null,
    fonts: { check: () => true, load: () => Promise.resolve() }
  };
  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    location: { search: '' },
    URLSearchParams,
    console,
    Math,
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    WeakMap,
    Map,
    Set,
    module: { exports: {} },
    exports: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8'), sandbox);
  return sandbox.window.UI;
}

function assertTouchTarget(btn, label) {
  assert.ok(btn.w > 0 && btn.h > 0, `${label} must have positive hitbox`);
  assert.ok(btn.cssH >= 44, `${label} cssH=${btn.cssH} must be >= 44 CSS px`);
  assert.ok(btn.cssW >= 44, `${label} cssW=${btn.cssW} must be >= 44 CSS px`);
}

function overlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

test('M2-FUSION-UI-1: multi eligibleRecipes yields same-source selectable cards + retained confirm/later', () => {
  const UI = loadUiSandbox(PHONE);
  const model = multiModel();
  const L = UI.fusionLayout(PHONE, model);

  assert.equal(L.multi, true, 'multi layout must be flagged');
  assert.equal(L.cards.length, RECIPES.length, 'one card per eligible recipe');
  assert.equal(L.buttons.length, RECIPES.length + 2, 'buttons = confirm + later + recipe cards');
  assert.equal(L.buttons[0], L.confirm, 'confirm stays index 0 for old keyboard compatibility');
  assert.equal(L.buttons[1], L.later, 'later stays index 1');
  assert.equal(L.selectedRecipeId, 'fusion_exorcistseal', 'selectedRecipeId must follow view model (not always first)');

  const recipeButtons = L.buttons.filter(b => b && b.recipeId);
  assert.equal(recipeButtons.length, RECIPES.length, 'all recipes reachable by buttons order');
  recipeButtons.forEach((btn, i) => {
    assert.equal(btn.recipeId, RECIPES[i].id, 'all recipes reachable by buttons order');
    assert.equal(btn.id, `recipe:${btn.recipeId}`, 'recipe button id contract');
    assert.equal(btn.recipeId, RECIPES[i].id);
    assertTouchTarget(btn, `recipe card ${btn.recipeId}`);
    assert.ok(btn.x >= L.inner.left - 0.5 && btn.x + btn.w <= L.inner.right + 0.5, 'card inside inner horizontally');
    assert.ok(btn.y >= L.inner.top && btn.y + btn.h <= L.confirm.y, 'card must not cover actions');
  });

  for (let i = 0; i < recipeButtons.length; i++) {
    for (let j = i + 1; j < recipeButtons.length; j++) {
      assert.equal(overlap(recipeButtons[i], recipeButtons[j]), false, `cards ${i}/${j} must not overlap`);
    }
  }

  // 任何卡片都可被點到：最後一張的中央屬於最後一張，不是第一張。
  const last = recipeButtons[recipeButtons.length - 1];
  const cx = last.x + last.w / 2, cy = last.y + last.h / 2;
  const hit = L.buttons.find(b => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
  assert.equal(hit.recipeId, 'fusion_exorcistseal', 'last card must own its hitbox');
});

test('M2-FUSION-UI-2: 44 CSS hit targets hold on real phone viewport and short landscape fallback', () => {
  const UI = loadUiSandbox(PHONE);

  for (const vp of [PHONE, SHORT, DESKTOP]) {
    const L = UI.fusionLayout(vp, multiModel());
    assert.equal(L.cards.length, RECIPES.length);
    assertTouchTarget(L.confirm, `confirm @${vp.width}x${vp.height}`);
    assertTouchTarget(L.later, `later @${vp.width}x${vp.height}`);
    L.cards.forEach(card => {
      assertTouchTarget(card, `${card.recipeId} @${vp.width}x${vp.height}`);
      assert.ok(card.y + card.h <= L.confirm.y, `${card.recipeId} must stay above actions`);
      assert.ok(card.x >= L.inner.left - 0.5 && card.x + card.w <= L.inner.right + 0.5, `${card.recipeId} inside panel`);
    });
  }

  // 只有兩個合法配方（早期局）也走多卡模式，但卡片高度受控、不變成整頁巨型卡。
  const two = UI.fusionLayout(PHONE, { eligibleRecipes: RECIPES.slice(0, 2), selectedRecipeId: RECIPES[1].id, slotBefore: 4, slotAfter: 3 });
  assert.equal(two.multi, true);
  assert.equal(two.cards.length, 2);
  two.cards.forEach(card => {
    assertTouchTarget(card, `two-recipe ${card.recipeId}`);
    assert.ok(card.h <= 130, 'few candidates must not stretch into giant cards');
  });
});

test('M2-FUSION-UI-3: drawFusion multi shows title, each fusion name, parent icons and short sentence', () => {
  const UI = loadUiSandbox(PHONE);
  const ctx = createMockContext();
  const model = multiModel();
  const L = UI.drawFusion(ctx, model, 0, 'keyboard');

  assert.equal(L.multi, true);
  const direct = UI.fusionLayout(PHONE, model);
  assert.equal(L.confirm.x, direct.confirm.x, 'drawFusion layout must be the same source as fusionLayout');
  assert.equal(L.cards.length, direct.cards.length);
  L.cards.forEach((card, i) => {
    assert.equal(card.x, direct.cards[i].x);
    assert.equal(card.y, direct.cards[i].y);
    assert.equal(card.w, direct.cards[i].w);
    assert.equal(card.h, direct.cards[i].h);
  });
  const texts = ctx.textCalls.map(t => t.text);
  assert.ok(texts.some(t => t.includes('奧 義 融 合')), 'title must render');
  const joined = texts.join('');
  RECIPES.forEach(r => {
    const short = UI.CARD_SHORT[r.id];
    assert.ok(texts.some(t => t.includes(r.name)), `fusion name ${r.name} must render`);
    assert.ok(joined.includes(short.s.slice(0, 6)), `short sentence ${r.id} must render`);
  });

  // 三個家紋（兩母技＋合武）由 drawEmblem 的 arc/stroke 實際畫出；多卡不得退化成純文字。
  assert.ok(ctx.getCallCount('arc') >= RECIPES.length * 3, 'each card needs parent + fusion emblems');
  assert.ok(texts.some(t => t.includes('來源變異') && t.includes('免費非變異')), 'shared mutation compensation rule must render');
  assert.ok(texts.some(t => t.includes('變異×2')), 'per-recipe mutation count must render');
  assert.ok(texts.some(t => t.includes('來源無變異')), 'per-recipe no-mutation state must render');
  assert.ok(texts.some(t => t.includes('選定')), 'selectedRecipeId must be visible on the selected card');
  assert.equal(ctx.getCallCount('save'), ctx.getCallCount('restore'), 'save/restore must balance');

  // 每個 focus 索引（含最後一張卡）皆可安全繪製；不會永遠只選第一張。
  for (let i = 0; i < L.buttons.length; i++) {
    const c = createMockContext();
    assert.doesNotThrow(() => UI.drawFusion(c, model, i, i % 2 ? 'gamepad' : 'touch'));
  }
  const lastFocus = createMockContext();
  UI.drawFusion(lastFocus, model, L.buttons.length - 1, 'keyboard');
  assert.ok(lastFocus.textCalls.length > 0, 'last recipe focus must still render');
});

test('M2-FUSION-UI-4: single-recipe path keeps old two-button layout, 44 CSS and compensation box', () => {
  const UI = loadUiSandbox(PHONE);
  const single = {
    recipe: { id: 'fusion_thundercircle', name: '奧義・雷陣封界', parents: ['barrier', 'thunder'] },
    slotBefore: 3,
    slotAfter: 2,
    sourceMutationIds: ['mut_pulse'],
    compensationText: '來源變異化為靈息：融合後補償 1 次免費非變異強化選擇'
  };

  for (const vp of [PHONE, SHORT, DESKTOP]) {
    const L = UI.fusionLayout(vp, single);
    assert.equal(L.multi, undefined, 'single recipe must keep legacy shape');
    assert.equal(L.buttons.length, 2, 'single recipe keeps exactly confirm/later');
    assert.equal(L.buttons[0], L.confirm);
    assert.equal(L.buttons[1], L.later);
    assertTouchTarget(L.confirm, `single confirm @${vp.width}x${vp.height}`);
    assertTouchTarget(L.later, `single later @${vp.width}x${vp.height}`);
  }

  const ctx = createMockContext();
  UI.drawFusion(ctx, single, 0, 'keyboard');
  const texts = ctx.textCalls.map(t => t.text);
  assert.ok(texts.some(t => t.includes('淨化靈陣')), 'barrier parent name');
  assert.ok(texts.some(t => t.includes('天狐雷')), 'thunder parent name');
  assert.ok(texts.some(t => t.includes('奧義・雷陣封界')), 'renamed thundercircle display');
  assert.ok(texts.some(t => t.includes('3 ➔ 2') && t.includes('釋出 1')), 'slot transition');
  assert.ok(texts.some(t => t.includes('補償 1 次免費非變異')), 'compensation notice');

  const empty = createMockContext();
  assert.doesNotThrow(() => UI.drawFusion(empty, null, 0, 'keyboard'));
  assert.ok(empty.textCalls.some(t => t.text.includes('墨焰斬')), 'null model keeps inkblade fallback');

  // 單一 eligibleRecipe 未帶 recipe 時仍走舊 2 鈕路徑，母技名稱由同一 meta 補齊。
  const onlyNew = { eligibleRecipes: [{ id: 'fusion_exorcistblade' }], slotBefore: 4, slotAfter: 3 };
  const LNew = UI.fusionLayout(PHONE, onlyNew);
  assert.equal(LNew.buttons.length, 2, 'single eligible recipe must stay legacy two-button');
  const ctxNew = createMockContext();
  UI.drawFusion(ctxNew, onlyNew, 0, 'keyboard');
  const newTexts = ctxNew.textCalls.map(t => t.text);
  assert.ok(newTexts.some(t => t.includes('妖刀斬')), 'single new recipe parent 1 name');
  assert.ok(newTexts.some(t => t.includes('陰陽符')), 'single new recipe parent 2 name');
  assert.ok(newTexts.some(t => t.includes('奧義・退魔符刃')), 'single new recipe display name');
});

test('M2-FUSION-UI-5: registry recognises new IDs/status and #8 display rename without touching #1', () => {
  const UI = loadUiSandbox(DESKTOP);
  const expected = {
    fusion_foxiai: '奧義・雷狐居合',
    fusion_exorcistblade: '奧義・退魔符刃',
    fusion_foxfirebarrier: '奧義・妖火結界',
    fusion_exorcistseal: '奧義・退魔封陣'
  };
  for (const [id, name] of Object.entries(expected)) {
    assert.ok(UI.CARD_SHORT[id], `${id} must register in CARD_SHORT`);
    assert.equal(UI.CARD_SHORT[id].ja, name);
    assert.equal(UI.CARD_SHORT[id].st, 'pending_tech', 'four priority fusions are tech-pending, not playable claims');
    assert.ok(UI.CARD_LIST.find(c => c.emblem === id), `${id} must be recognisable in codex`);
  }
  assert.equal(UI.CARD_SHORT.fusion_inkblade.ja, '奧義・墨焰斬', '#1 must not be redone/renamed');
  assert.ok(UI.CARD_SHORT.fusion_thundercircle.ja.includes('雷陣封界'), '#8 display becomes 雷陣封界');
  assert.equal(UI.CARD_LIST.find(c => c.emblem === 'fusion_thundercircle').type, '合武');

  for (const id of ['fusion_slashwheel', 'fusion_foxthunderlantern', 'fusion_flamefestival', 'fusion_thundertalisman']) {
    const row = UI.CARD_LIST.find(c => c.emblem === id);
    assert.ok(row, `${id} must still be identifiable in codex`);
    assert.equal(UI.CARD_SHORT[id].st, 'pending_tech', `${id} is implemented but still awaits QA`);
    assert.ok(row.type.includes('技術待驗'), `${id} must disclose pending technical QA`);
    assert.ok(row.type.includes('候選特效未核准'), `${id} must not claim approved art`);
    assert.ok(!row.type.includes('待實裝'), `${id} must not incorrectly claim battle logic absent`);
  }

  const ctx = createMockContext();
  for (const id of Object.keys(expected)) {
    assert.doesNotThrow(() => UI.drawEmblem(ctx, id, 100, 100, 24), `${id} emblem must not throw`);
  }
});
