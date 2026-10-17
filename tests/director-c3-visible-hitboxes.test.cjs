'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

// Independent geometry gate: actual runtime button list, precise CSS scale,
// and the production input contract (44 CSS minimum), including legacy tabs.
for (const [width, height] of [[1280, 800], [1194, 834], [844, 390]]) {
  test(`C3 effective targets fit and do not overlap at ${width}x${height}`, () => {
    const game = loadGame();
    game.env.innerWidth = width;
    game.env.innerHeight = height;
    const v = game.env.VIEWPORT.get();
    const bounds = { left: -v.offsetX, top: -v.offsetY,
      right: v.width - v.offsetX, bottom: v.height - v.offsetY };
    const buttons = game.env.UI.codexButtons('words', 0, 164,
      { filter: { by: 'all', id: null }, page: 0 });
    assert.ok(buttons.some(b => b.id === 'filter-stage'));
    const minimum = 44 / v.scale;
    const targets = buttons.map(b => {
      const px = Math.max(0, (minimum - b.w) / 2);
      const py = Math.max(0, (minimum - b.h) / 2);
      return { id: b.id, x: b.x - px, y: b.y - py,
        w: b.w + px * 2, h: b.h + py * 2 };
    });
    for (const b of targets) {
      assert.ok(b.w * v.scale >= 44 - 1e-8 && b.h * v.scale >= 44 - 1e-8, b.id);
      assert.ok(b.x >= bounds.left - 1e-8 && b.y >= bounds.top - 1e-8
        && b.x + b.w <= bounds.right + 1e-8 && b.y + b.h <= bounds.bottom + 1e-8,
      `${b.id} clipped: ${JSON.stringify({ b, bounds })}`);
    }
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j];
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(dx <= 1e-8 || dy <= 1e-8, `${a.id}/${b.id} overlap ${dx}x${dy}`);
    }
  });
}
