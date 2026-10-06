const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRenderer(width = 900, height = 600, dpr = 1) {
  const canvases = [], texts = [], images = [], paths = [], scales = [], rotates = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const transforms = [], fills = [];
    const ctx = new Proxy({
      setTransform: (...args) => transforms.push(args),
      fillRect: (...args) => fills.push(args),
      fillText: text => texts.push(text),
      drawImage: (...args) => images.push(args),
      beginPath: () => paths.push('begin'),
      ellipse: (...args) => paths.push(['ellipse', ...args]),
      arc: (...args) => paths.push(['arc', ...args]),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      measureText: () => ({ width: 40 }),
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: ang => rotates.push(ang),
      scale: (sx, sy) => scales.push([sx, sy]),
      transform: (...args) => transforms.push(args)
    }, { get: (o, k) => o[k] ?? (() => {}) });
    const c = { width: 0, height: 0, getContext: () => ctx, transforms, fills, ctx };
    canvases.push(c);
    return c;
  }
  const main = canvas();
  const env = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr,
    matchMedia: () => ({ matches: false, addEventListener: (type, fn) => { env.motionChange = fn; } }),
    document: { createElement: canvas },
    ART: {},
    UI: { readableFont: () => '20px sans-serif' }
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ['viewport', 'renderer']) {
    vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), context);
  }
  context.RENDERER.init(main);
  return { env: context, main, canvases, texts, images, paths, scales, rotates };
}

test('parallax functions are exported and active under motion', () => {
  const r = loadRenderer(900, 600);
  assert.equal(typeof r.env.RENDERER.drawGroundParallax, 'function');
  assert.equal(typeof r.env.RENDERER.drawMistParallax, 'function');

  // Verify paths are drawn when motion is active
  r.paths.length = 0;
  r.env.RENDERER.drawGroundParallax(1.5, 600, { x: 100, y: 100 });
  assert.ok(r.paths.filter(p => Array.isArray(p) && p[0] === 'ellipse').length >= 3);

  // Soft feathered mist puffs
  r.paths.length = 0;
  r.env.RENDERER.drawMistParallax(1.5, 600, { x: 100, y: 100 });
  assert.ok(r.paths.filter(p => Array.isArray(p) && p[0] === 'ellipse').length >= 4);
});

test('parallax functions respect prefers-reduced-motion', () => {
  const r = loadRenderer(900, 600);
  r.env.motionChange({ matches: true }); // Enable reduced motion
  r.paths.length = 0;

  r.env.RENDERER.drawGroundParallax(1.5, 600, { x: 100, y: 100 });
  r.env.RENDERER.drawMistParallax(1.5, 600, { x: 100, y: 100 });
  assert.equal(r.paths.length, 0);
});

test('shop signs remain uncorrupted without dead 2.5D shift code', () => {
  const r = loadRenderer(900, 600);
  r.texts.length = 0;
  r.env.RENDERER.drawHouse({ x: 900, y: 600, bType: 'house_tavern' });
  assert.deepEqual(r.texts, ['宵待酒屋']);
});

test('player dynamic secondary motion applies squash, stretch and lean on movement', () => {
  const r = loadRenderer(900, 600);
  r.scales.length = 0;
  r.rotates.length = 0;

  // Running
  r.env.RENDERER.drawPlayer({ x: 450, y: 300, faceX: 1 }, false, 0, 1.0, { x: 1, y: 0 });
  assert.ok(r.scales.length > 0);
  assert.ok(r.rotates.length > 0); // Leans forward into running stride

  // Dashing stretches forward
  r.scales.length = 0;
  r.env.RENDERER.drawPlayer({ x: 450, y: 300, faceX: 1 }, true, 0, 1.0, { x: 1, y: 0 });
  const dashScale = r.scales.at(-1);
  assert.ok(Math.abs(dashScale[0]) > 1.1); // Lengthwise stretch

  // Reduced motion keeps player static
  r.env.motionChange({ matches: true });
  r.scales.length = 0;
  r.rotates.length = 0;
  r.env.RENDERER.drawPlayer({ x: 450, y: 300, faceX: 1 }, false, 0, 1.0, { x: 1, y: 0 });
  assert.deepEqual(r.scales.at(-1), [1, 1]);
  assert.equal(r.rotates.length, 0);
});

test('monsters exhibit soft-body breathing and impact squash on hit', () => {
  const r = loadRenderer(900, 600);
  const ghost = { type: 'ghost', x: 450, y: 300, flash: 0 };
  r.scales.length = 0;

  // Normal ghost breathing
  r.env.RENDERER.drawMonster(ghost, { x: 600, y: 300 }, 1.0);
  const normalScale = r.scales.at(-1);
  assert.ok(normalScale[1] !== 1.0); // Has soft body breathing squish

  // Hit flash triggers jelly impact squash
  ghost.flash = 0.15;
  r.scales.length = 0;
  r.env.RENDERER.drawMonster(ghost, { x: 600, y: 300 }, 1.0);
  const hitScale = r.scales.at(-1);
  assert.ok(Math.abs(hitScale[0]) > Math.abs(normalScale[0])); // Squashed wider on impact
});
