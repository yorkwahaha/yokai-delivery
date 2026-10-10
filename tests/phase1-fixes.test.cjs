const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadGameEnv() {
  const events = {}, canvasEvents = {}, documentEvents = {};
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ setTransform: () => {}, fillText: () => {}, measureText: () => ({ width: 40 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => o[k] || (() => {}) });
  const canvas = { addEventListener: (k, f) => { canvasEvents[k] = f; }, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }) };
  const controlsButton = { click() {} };
  const storage = new Map([['yokai-tutorial-v1', '"skip"']]);
  const env = {
    console, Set, Map, Math, Date, performance: { now: () => 0 }, navigator: {},
    requestAnimationFrame() {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: { hidden: false, getElementById: id => id === 'controls-open' ? controlsButton : canvas, addEventListener: (k, f) => { documentEvents[k] = f; } },
    addEventListener: (k, f) => { events[k] = f; }
  };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['words', 'world', 'store', 'config', 'viewport', 'controls', 'overworld', 'fx', 'skillfx', 'evolutions', 'ui']) {
    vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  }
  c.CONTROLS.mount = () => {};
  c.AUDIO = new Proxy({}, { get: () => () => {} });
  c.RENDERER = new Proxy({ drawHouse: () => {}, drawPlayer: () => {}, drawMonster: () => {}, getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({ x: 0, y: 0 }), updateEffects: () => false }, { get: (o, k) => o[k] || (() => {}) });

  const source = fs.readFileSync('js/game.js', 'utf8');
  const end = source.lastIndexOf('})();');
  const hook = `window.fixture = {
    start, update, getState: () => state, getOil: () => oil, setOil: v => { oil = v; },
    getBossQ: () => bossQ, getEnemies: () => enemies,
    addBoss: (final = false) => {
      const bs = {
        x: P.x + 150, y: P.y, type: 'boss', shield: true, final,
        hp: 50, max: 50, speed: 40, flash: 0, wob: 0,
        word: ALL[0]
      };
      enemies.push(bs);
      return bs;
    },
    moveBoss: distance => {
      const bs = enemies.find(e => e.type === 'boss');
      if (bs) Object.assign(bs, { x: P.x + distance, y: P.y, speed: 0, wob: 0, flash: 0 });
    },
    setElapsed: v => { elapsed = v; }, getElapsed: () => elapsed,
    getActiveBoss: () => enemies.find(e => e.type === 'boss'),
    triggerLevelUp: () => { state = 'levelup'; choices = UP.slice(0, 3); },
    answerBoss
  };`;
  vm.runInContext(source.slice(0, end) + hook + source.slice(end), c);
  return c;
}

test('Boss quiz state is preserved when exiting and re-entering detection radius', () => {
  const c = loadGameEnv();
  c.fixture.start('night-town');
  c.fixture.addBoss(false);
  c.fixture.update(0.1);

  const initialQ = c.fixture.getBossQ();
  assert.ok(initialQ, 'Boss quiz should be active');
  const originalWord = initialQ.word;
  // Mark one wrong answer
  initialQ.wrong[0] = true;

  // Move boss far away (> 380px)
  c.fixture.moveBoss(500);
  c.fixture.update(0.1);
  assert.equal(c.fixture.getBossQ(), null, 'Boss quiz should be hidden when player is far');

  // Move boss back within 300px
  c.fixture.moveBoss(150);
  c.fixture.update(0.1);
  const restoredQ = c.fixture.getBossQ();
  assert.ok(restoredQ, 'Boss quiz should be restored');
  assert.equal(restoredQ.word, originalWord, 'Boss quiz word should be identical');
  assert.equal(restoredQ.wrong[0], true, 'Previously eliminated answer should remain marked');
});

test('Oil does not drain while reading level-up upgrade cards', () => {
  const c = loadGameEnv();
  c.fixture.start('night-town');
  c.fixture.setOil(80);
  c.fixture.triggerLevelUp();
  assert.equal(c.fixture.getState(), 'levelup');

  // Simulate spending 10 seconds reading cards
  for (let i = 0; i < 100; i++) {
    c.fixture.update(0.1);
  }
  assert.equal(c.fixture.getOil(), 80, 'Oil must remain frozen during levelup state');
});

test('Overworld pathfinding allows navigating to multi-hop unlocked nodes', () => {
  const c = loadGameEnv();
  // Mark night-town as completed so cross-west and rain-port unlock
  c.STORE.completeStage('night-town');
  const path = c.OVERWORLD.findPath('gate', 'rain-port');
  assert.deepEqual([...path], ['night-town', 'cross-west', 'rain-port'], 'findPath should find multi-hop route through night-town and cross-west');
});

test('Early boss remains an intermediate boss at DAWN so later waves cannot be skipped', () => {
  const c = loadGameEnv();
  c.fixture.start('night-town');
  const boss = c.fixture.addBoss(false);
  assert.equal(boss.final, false, 'Initial boss is not final');

  // Advance time to DAWN (600s)
  c.fixture.setElapsed(600);
  c.fixture.update(0.1);

  assert.equal(boss.final, false, 'Dawn must not promote an unfinished intermediate Boss');
});
