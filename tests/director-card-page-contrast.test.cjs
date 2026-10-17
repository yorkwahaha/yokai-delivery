'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ui = require('../js/card-gallery-ui.js');
const viewport = require('../js/viewport.js');

const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(h => parseInt(h, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
function contrast(a, b) {
  const l = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (l[1] + 0.05) / (l[0] + 0.05);
}

for (const [width, height] of [[1280, 800], [844, 390]]) {
  test(`page collection and illustration status are readable at ${width}x${height}`, () => {
    const v = viewport.calculate(width, height);
    const page = { ...v, height: v.height - 110, offsetY: v.offsetY - 110 };
    const calls = [];
    const ctx = { save() {}, restore() {}, fillText(text, x, y) {
      calls.push({ text, x, y, color: this.fillStyle });
    } };
    ui.draw(ctx, [{ key: 'ねこ', reveal: 'open', jp: 'ねこ', zh: '貓', kana: 'ねこ',
      progress: '4/4', illustration: { text: '待解鎖插畫' } }],
    { page: 0, filter: { by: 'all' }, packLine: '收藏 1/32・動物街 3/3' },
    { readableFont: () => '900 16px sans-serif' }, page, {});
    const summary = calls.find(c => c.text.startsWith('收藏 '));
    const status = calls.find(c => c.text === '待解鎖插畫');
    assert.ok(summary && status, 'both page-level labels are rendered');
    // Engineering gate for these small labels on the existing codex dark backdrop;
    // it is not a claim of a full accessibility certification or art approval.
    for (const c of [summary, status]) {
      assert.ok(contrast(c.color, '#0a0e1a') >= 4.5, `${c.text}: contrast ${contrast(c.color, '#0a0e1a')}`);
    }
    assert.ok((status.y - summary.y) * v.scale >= 22 - 1e-6, 'two status baselines need 22 CSS px');
    assert.equal(calls.find(c => c.text === '4/4').color, '#24180f', 'paper card keeps its deep ink');
  });
}
