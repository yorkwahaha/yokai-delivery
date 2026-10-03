const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadGame() {
  const events = {}, canvasEvents = {}, documentEvents = {};
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ measureText: () => ({ width: 40 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => o[k] || (() => {}) });
  const canvas = { addEventListener: (k, f) => { canvasEvents[k] = f; }, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: env.innerWidth || 900, height: env.innerHeight || 600 }) };
  const controlsButton = { click() { this.clicked = true; } };
  const env = { console, Set, Map, Math, Date, performance: { now: () => 0 }, navigator: {}, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, document: { hidden: false, getElementById: id => id === 'controls-open' ? controlsButton : canvas, addEventListener: (k, f) => { documentEvents[k] = f; } }, addEventListener: (k, f) => { events[k] = f; } };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['words', 'world', 'store', 'config', 'viewport', 'controls', 'overworld']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  c.CONTROLS.mount = () => {};
  const audioCalls = [];
  c.AUDIO = new Proxy({}, { get: (o, name) => () => audioCalls.push(name) });
  c.RENDERER = new Proxy({ getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({x:0,y:0}), updateEffects: () => false }, { get: (o, k) => o[k] || (() => {}) });
  c.UI = new Proxy({ HINT_BTN: { x: 532, y: 20, w: 78, h: 40 }, readableFont: () => '20px sans-serif' }, { get: (o, k) => o[k] || (() => {}) });
  const source = fs.readFileSync('js/game.js', 'utf8');
  const end = source.lastIndexOf('})();');
  const hook = 'window.fixture = { start, update, frame, makeOrder, hurt, setState: next => { state=next; ended=false; }, snapshot: () => ({ state, x:P.x, y:P.y, joy, dashCd, oil, elapsed, cargo, enemies, enemyBullets, keys: [...keys] }), addMis: () => enemies.push({x:P.x+100,y:P.y,type:"mis",w:ALL[0],hp:999,max:999,speed:210,flash:0,wob:0}), emptyHouses: () => houses.splice(0) };';
  vm.runInContext(source.slice(0, end) + hook + source.slice(end), c);
  return { ...c.fixture, events, canvasEvents, documentEvents, env: c, audioCalls };
}
const pointer = (x, y, type = 'mouse') => ({ clientX: x, clientY: y, pointerId: 1, pointerType: type, button: 0, preventDefault() {} });
const key = (code, value = '') => ({ code, key: value, preventDefault() {} });
test('mouse drag begins on the right half and moves the courier; touch stays on left', () => {
  const g = loadGame(); g.start(); const before = g.snapshot();
  g.canvasEvents.pointerdown(pointer(680, 350));
  assert.ok(g.snapshot().joy);
  g.canvasEvents.pointermove(pointer(740, 350)); g.update(0.05);
  assert.ok(g.snapshot().x > before.x);
  g.canvasEvents.pointerup(pointer(740, 350));
  g.canvasEvents.pointerdown(pointer(680, 350, 'touch'));
  assert.equal(g.snapshot().joy, null);
});
test('custom movement, dash and blur route through real event listeners', () => {
  const g = loadGame(); g.start(); g.env.CONTROLS.preset('left');
  g.events.keydown(key('KeyL', 'l')); assert.ok(g.snapshot().keys.includes('r'));
  g.events.keyup(key('KeyL', 'l')); assert.equal(g.snapshot().keys.length, 0);
  g.canvasEvents.pointerdown(pointer(810, 530)); assert.ok(g.snapshot().dashCd > 0);
  g.events.blur(); assert.equal(g.snapshot().state, 'pause');
  const elapsed = g.snapshot().elapsed; g.update(0.05); assert.equal(g.snapshot().elapsed, elapsed);
});
test('misdelivery enemy settles away from player and retains a ranged penalty', () => {
  const g = loadGame(); g.start(); g.addMis();
  for (let i = 0; i < 65; i++) g.update(0.05);
  const s = g.snapshot(), enemy = s.enemies.find(e => e.type === 'mis');
  assert.ok(enemy);
  assert.ok(Math.hypot(enemy.x - s.x, enemy.y - s.y) >= 80);
  assert.ok(s.enemyBullets.length > 0 || s.oil < 95);
});
test('empty pickup pool cannot crash order creation', () => {
  const g = loadGame(); g.start(); g.emptyHouses(); assert.doesNotThrow(() => g.makeOrder());
});

test('releasing one equivalent movement key keeps the other held key active', () => {
  const g = loadGame(); g.start();
  g.events.keydown(key('KeyW', 'w')); g.events.keydown(key('ArrowUp', 'ArrowUp'));
  g.events.keyup(key('KeyW', 'w')); assert.ok(g.snapshot().keys.includes('u'));
  g.events.keyup(key('ArrowUp', 'ArrowUp')); assert.equal(g.snapshot().keys.length, 0);
});

test('cargo stays visible beside an idle courier with no movement history', () => {
  const g = loadGame(); g.start();
  for (let i = 0; i < 30; i++) g.update(0.05);
  const s = g.snapshot();
  assert.ok(Math.hypot(s.cargo.x - s.x, s.cargo.y - s.y) >= 63.9);
});

test('Boss death and settlement audio fire once per event, not once per frame', () => {
  const g = loadGame(); g.start();
  const boss = {x:1400,y:900,type:'boss',hp:1,max:1,shield:false};
  g.hurt(boss, 2); g.hurt(boss, 2);
  assert.equal(g.audioCalls.filter(n => n === 'bossDeath').length, 1);
  g.setState('won'); g.frame(20); g.frame(40);
  assert.equal(g.audioCalls.filter(n => n === 'fanfare').length, 1);
  g.setState('lost'); g.frame(60); g.frame(80);
  assert.equal(g.audioCalls.filter(n => n === 'lose').length, 1);
});

test('expanded fullscreen edges and corner HUD buttons share the same pointer mapping', () => {
  const g = loadGame(); g.env.innerWidth = 1800; g.env.innerHeight = 600; g.start();
  const before = g.snapshot().x;
  g.canvasEvents.pointerdown(pointer(100, 350)); g.canvasEvents.pointermove(pointer(160, 350)); g.update(0.05);
  assert.ok(g.snapshot().x > before);
  g.canvasEvents.pointerup(pointer(160, 350));
  g.frame(20);
  g.canvasEvents.pointerdown(pointer(1642, 510));
  assert.ok(g.snapshot().dashCd > 0);
  g.canvasEvents.pointerdown(pointer(1740, 50));
  assert.equal(g.snapshot().state, 'pause');
});
