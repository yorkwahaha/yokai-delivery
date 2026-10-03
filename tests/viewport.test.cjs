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
