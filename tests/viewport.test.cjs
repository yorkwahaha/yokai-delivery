const test = require('node:test');
const assert = require('node:assert/strict');
const viewport = require('../js/viewport.js');
test('fullscreen preserves uniform scale and keeps the complete interface visible', () => {
  for (const [w, h] of [[844,390], [1280,800], [1920,1080], [1024,768], [390,844]]) {
    const v = viewport.calculate(w,h);
    assert.ok(Math.abs(v.width * v.scale - w) < 0.001);
    assert.ok(Math.abs(v.height * v.scale - h) < 0.001);
    assert.ok(v.width >= 900 && v.height >= 600);
    assert.ok(Math.abs((450 + v.offsetX) * v.scale - w/2) < 0.001);
    assert.ok(Math.abs((300 + v.offsetY) * v.scale - h/2) < 0.001);
  }
});

test('each HUD edge adds exactly 20 CSS pixels across screen scales', () => {
  const oldW = global.innerWidth, oldH = global.innerHeight;
  try {
    for (const [w, h] of [[844,390], [1024,768], [1920,1080]]) {
      global.innerWidth = w; global.innerHeight = h;
      const b = viewport.bounds(), hud = viewport.hudBounds(), { scale } = viewport.get();
      for (const distance of [hud.left-b.left, hud.top-b.top, b.right-hud.right, b.bottom-hud.bottom]) {
        assert.ok(Math.abs(distance * scale - 20) < 0.001);
      }
    }
  } finally { global.innerWidth = oldW; global.innerHeight = oldH; }
});
