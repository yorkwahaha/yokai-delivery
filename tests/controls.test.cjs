const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function controls(saved = null) {
  const context = { window: {}, localStorage: { getItem: () => saved, setItem() {} } };
  vm.runInNewContext(fs.readFileSync('js/controls.js', 'utf8'), context);
  return context.window.CONTROLS;
}
test('default controls, arrows and left-handed preset map to actions', () => {
  const c = controls();
  assert.equal(c.action('KeyW'), 'u');
  assert.equal(c.action('ArrowLeft'), 'l');
  assert.equal(c.action('ShiftRight'), 'dash');
  c.preset('left');
  assert.equal(c.action('KeyI'), 'u');
  assert.equal(c.action('KeyW'), undefined);
  assert.equal(c.action('KeyU'), 'interact');
});
test('rebinding rejects duplicate and reserved keys, and replaces the old key', () => {
  const c = controls();
  assert.equal(c.bind('u', 'KeyD'), false);
  assert.equal(c.bind('u', 'Digit1'), false);
  assert.equal(c.bind('u', 'Numpad1'), false);
  assert.equal(c.bind('u', 'Escape'), false);
  assert.equal(c.bind('u', 'KeyT'), true);
  assert.equal(c.action('KeyT'), 'u');
  assert.equal(c.action('KeyW'), undefined);
});
test('malformed or duplicate saved bindings fall back safely', () => {
  assert.equal(controls('{').action('KeyW'), 'u');
  assert.equal(controls('{"u":"KeyD"}').action('KeyW'), 'u');
});
test('misdelivery enemies approach a readable distance without overshoot and retreat if crowded', () => {
  const cfg = require('../js/config.js');
  assert.equal(cfg.chaseStep(90, 210, 0.05, 'mis'), 4);
  assert.equal(cfg.chaseStep(86, 210, 0.05, 'mis'), 0);
  assert.equal(cfg.chaseStep(20, 210, 0.05, 'mis'), -10.5);
  assert.equal(cfg.chaseStep(90, 210, 0.05, 'ghost'), 10.5);
});
