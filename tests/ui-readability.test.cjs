const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function loadUI(width = 585) {
  const texts = [], gradient = { addColorStop() {} };
  const context = new Proxy({ fillText: (value, x, y) => texts.push({ value, x, y }), measureText: value => ({ width: [...value].length * 20 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => o[k] || (() => {}) });
  const env = { window: {}, document: { getElementById: () => ({ getBoundingClientRect: () => ({ width }) }) } };
  vm.runInNewContext(fs.readFileSync('js/ui.js', 'utf8'), env);
  return { UI: env.window.UI, context, texts };
}
test('mobile body text renders at approximately 14 CSS pixels', () => {
  for (const width of [480, 585, 667, 844]) {
    const { UI } = loadUI(width);
    const size = Number(UI.readableFont(12).match(/(\d+)px/)[1]);
    assert.ok(size * width / 900 >= 14);
  }
});
test('all 39 words remain reachable across three readable codex pages', () => {
  const words = Array.from({ length: 39 }, (_, i) => ({ jp: `word${i}`, zh: '詞', icon: '📦', example: 'れいぶん' }));
  const store = { get: () => ({ ok: 1, ng: 0, box: 1 }) };
  const seen = [];
  for (let page = 0; page < 3; page++) {
    const { UI, context, texts } = loadUI();
    UI.drawCodex(context, store, words, 'words', page);
    const labels = texts.filter(t => /^word\d+$/.test(t.value));
    assert.equal(labels.length, page === 2 ? 9 : 15);
    assert.ok(labels.every(t => t.y < 520));
    seen.push(...labels.map(t => t.value));
  }
  assert.equal(new Set(seen).size, 39);
});
test('desktop HUD exposes the same dash cooldown seconds as mobile', () => {
  const { UI, context, texts } = loadUI(1200);
  UI.drawHud(context, { x: 0, y: 0 }, 100, 100, 2, 600, 0, 0, 0, 1, 0, 30, null, 0, [], null, null, false, null, { x:810,y:420,r:38 }, { x:810,y:530,r:46 }, { x:848,y:14,w:38,h:52 }, {}, {}, {}, 0, 6, 1.2, 1.8);
  assert.ok(texts.some(t => t.value === '1.2s'));
});
