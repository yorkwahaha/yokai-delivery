'use strict';
// Exercise the exact canvas overlay block without starting a player session.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/game.js', 'utf8');
const scope = source.indexOf('if (PERF_DEBUG && screen === "run")');
assert.ok(scope > 0, 'FPS debug paint block must still exist');
const begin = source.indexOf('const area = window.VIEWPORT?.hudBounds?.() || viewBounds();', scope);
const end = source.indexOf('ctx.restore();', begin);
assert.ok(begin > scope && end > begin);
const paint = source.slice(begin, end + 'ctx.restore();'.length);

function render(bounds, scale) {
  const rects = [], texts = [];
  const ctx = {
    save() {}, restore() {}, setTransform() {},
    fillRect(...rect) { rects.push(rect); },
    fillText(...args) { texts.push(args); }
  };
  vm.runInNewContext(paint, {
    ctx, window: { VIEWPORT: { hudBounds: () => bounds } },
    viewBounds: () => bounds,
    v: { scale, offsetX:0, offsetY:0 },
    pixelScale: 1, perfText: 'FPS 60 | sim 3.4ms | draw 7.2ms',
    enemies: [1,2], gems: [1], elapsed: 65
  });
  assert.equal(rects.length, 1);
  assert.equal(texts.length, 2);
  return { panel: rects[0], texts };
}

test('FPS diagnostics are top-center, inside HUD bounds, and clear the player oil bar', () => {
  for(const {width, scale} of [{width:860,scale:1},{width:1026,scale:1},{width:920,scale:.8},{width:1100,scale:.5}]) {
    const bounds = {left:20, top:20, right:20+width, bottom:590};
    const {panel,texts} = render(bounds,scale);
    const [x,y,w,h] = panel;
    const oilRight = bounds.left + 18 + Math.max(250, Math.ceil(170/scale));
    assert.equal((x+w/2), (bounds.left+bounds.right)/2, 'horizontal center');
    assert.equal(y, bounds.top+6, 'panel begins at the top safe inset');
    assert.equal(h,48);
    assert.ok(x >= oilRight+10, 'must not cover player health/oil bar');
    assert.ok(x >= bounds.left && x+w <= bounds.right);
    assert.ok(w>12 && w<=324);
    for(const [,tx,ty,limit] of texts) {
      assert.equal(tx,(bounds.left+bounds.right)/2,'centered diagnostic text');
      assert.ok(ty>=y && ty<=y+h);
      assert.equal(limit,w-12,'text clipped to responsive panel width');
    }
  }
});
