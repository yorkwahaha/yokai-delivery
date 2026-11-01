'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('stage release status describes art readiness without disabling historic routes', () => {
  const window = {};
  const context = { window, console };
  for (const file of ['js/delivery-lexicon.js', 'js/words.js']) {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  const stages = ['night-town','rain-port','sakura-pass','bamboo-maze',
    'hyakki-kyoto','snow-temple','spirit-ferry','yomi'];
  for (const [index,id] of stages.entries()) {
    const stage = window.CONTENT.getStage(id);
    assert.equal(stage.id, id);
    assert.equal(stage.implemented, true, 'existing playable route remains available after normal unlock');
    assert.equal(stage.releaseStatus, index === 0 ? 'public' : index === 1 ? 'playtest' : 'development');
  }
});
