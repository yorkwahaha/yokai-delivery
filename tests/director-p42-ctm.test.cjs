'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const math = require('../js/p42-camera-model.js');
const viewportSource = fs.readFileSync('js/viewport.js', 'utf8');
const gameSource = fs.readFileSync('js/game.js', 'utf8');
const begin = gameSource.indexOf('  const tiltWorld =');
const end = gameSource.indexOf('  const isPortrait', begin);
assert.ok(begin >= 0 && end > begin, 'actual game projection hook must exist');
const gameProjection = gameSource.slice(begin, end);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture(width, height, zoom, k, stage = 'sakura-pass') {
  const env = { innerWidth: width, innerHeight: height, location: { hostname: 'localhost', search: `?tilt=0.6&zoom=${zoom}` }, URLSearchParams };
  env.window = env;
  vm.runInNewContext(viewportSource, env);
  env.VIEWPORT.setZoomStage(stage); env.VIEWPORT.setTiltScale(k);
  const v = env.VIEWPORT.get(), density = 1.5, ld = v.scale * density;
  let matrix = [ld, 0, 0, ld, ld * v.offsetX, ld * v.offsetY];
  const stack = [];
  env.ctx = {
    translate(x, y) { matrix[4] += matrix[0] * x; matrix[5] += matrix[3] * y; },
    scale(x, y) { matrix[0] *= x; matrix[3] *= y; },
    save() { stack.push([...matrix]); }, restore() { matrix = stack.pop(); }
  };
  env.W = 900; env.H = 600; env.tiltK = () => env.VIEWPORT.tiltScale();
  vm.runInNewContext(gameProjection + '\nglobalThis.applyActualWorld = tiltWorld;', env);
  return { env, viewport: v, density, matrix: () => matrix };
}
for (const [width, height] of [[1280, 800], [1194, 834], [844, 390]]) {
  for (const zoom of [1.10, 1.15]) test(`actual game world CTM matches camera contract at ${width}x${height}, Z=${zoom}`, () => {
    for (const k of [1, .6]) {
      const f = fixture(width, height, zoom, k), cam = { x: -754.3, y: 2001.2 }, shake = { x: 3, y: -2 };
      f.env.applyActualWorld(cam, shake);
      const c = math.makeCamera({ tilt: k, zoom: k === 1 ? 1 : zoom, cam, shake });
      const expected = math.backingMatrix(c, f.viewport, f.density);
      f.matrix().forEach((n, i) => close(n, expected[i]));
      for (const p of [{ x: 0, y: 0 }, { x: -1230, y: 4502 }, { x: 800, y: -350 }]) {
        const logical = f.env.VIEWPORT.worldToScreen(p.x, p.y, cam, shake);
        const matrix = f.matrix(), ld = f.viewport.scale * f.density;
        close(matrix[0] * p.x + matrix[4], ld * (logical.x + f.viewport.offsetX));
        close(matrix[3] * p.y + matrix[5], ld * (logical.y + f.viewport.offsetY));
      }
      const foot = { x: 88, y: 1846 }, before = [...f.matrix()];
      f.env.VIEWPORT.upright(f.env.ctx, foot.x, foot.y, () => {
        const upright = f.matrix();
        close(upright[0], upright[3]);
        close(upright[0] * foot.x + upright[4], before[0] * foot.x + before[4]);
        close(upright[3] * foot.y + upright[5], before[3] * foot.y + before[5]);
      });
      assert.deepEqual(f.matrix(), before, 'upright restores the actual world matrix');
    }
  });
}
test('actual first two stages ignore Stage3 zoom in game CTM, including shake', () => {
  for (const stage of ['night-town', 'rain-port']) {
    const f = fixture(1280, 800, 1.15, .6, stage), cam = { x: 700, y: -20 }, shake = { x: 2, y: 6 };
    f.env.applyActualWorld(cam, shake);
    const expected = math.backingMatrix(math.makeCamera({ tilt: .6, zoom: 1, cam, shake }), f.viewport, f.density);
    f.matrix().forEach((n, i) => close(n, expected[i]));
  }
});
