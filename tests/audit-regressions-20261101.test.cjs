'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./helpers/game-runtime.cjs');

test('exhausted normal upgrade pool still offers eligible mutations', () => {
  const g = loadGame({ seed: 12 });
  g.start();
  g.maxOutUpgrades();
  const choices = g.eligibleChoices();
  assert.ok(choices.length > 0, 'upgrade pool must not report empty');
  assert.ok(choices.some(choice => choice.type === 'mutation'));
  assert.ok(choices.every(choice => choice.type !== 'fusion'), 'fusion remains disabled');
});

test('low FPS stepping preserves elapsed gameplay time with bounded substeps', () => {
  for (const frameMs of [1000 / 60, 50, 100]) {
    const g = loadGame({ seed: 12 });
    g.start();
    g.stopSpawns();
    g.stepFrame(frameMs);
    const before = g.snapshot().elapsed;
    g.stepFrames(Math.round(1000 / frameMs), frameMs);
    const advance = g.snapshot().elapsed - before;
    assert.ok(Math.abs(advance - 1) < 0.03, `${frameMs}ms advanced ${advance}s`);
  }
});

test('no removed rain-port ground file stays in production load slots', () => {
  const source = fs.readFileSync('js/assets.js', 'utf8');
  const section = source.split('"rain-port": Object.freeze({')[1].split('"sakura-pass": Object.freeze({')[0];
  assert.ok(!section.includes('"ground_stone_var1"'));
  assert.ok(!section.includes('"ground_stone_var2"'));
  assert.ok(/ground:\s*null/.test(section));
});
