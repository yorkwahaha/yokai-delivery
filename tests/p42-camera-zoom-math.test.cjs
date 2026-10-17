'use strict';
// P4.2: executable pure-math specification only; no runtime patch or browser hooks.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.resolve(__dirname, '../js/p42-camera-model.js');
// RED means the requested math API is not implemented; the test runner still loads.
const M = fs.existsSync(filename) ? require(filename) : {};
const close = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`);
const point = (a, b) => { close(a.x, b.x, 'x'); close(a.y, b.y, 'y'); };
function viewport(width = 1280, height = 800) {
  const env = { innerWidth: width, innerHeight: height, location: { hostname: 'localhost', search: '?tilt=0.60' } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../js/viewport.js'), 'utf8'), env);
  return env.VIEWPORT;
}
function matrixPoint(m, p) { return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] }; }
const overlaps = (a, b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

test('P42-01: pure camera API exists without adding a browser global', () => {
  for (const key of ['makeCamera', 'effectiveZoom', 'stableSceneryDepth', 'worldMatrix', 'backingMatrix', 'uprightMatrix',
    'worldToScreen', 'screenToWorld', 'reanchor', 'viewOffsets', 'worldBounds', 'drawBounds', 'uprightRect', 'clientToLogical', 'logicalToClient']) {
    assert.equal(typeof M[key], 'function', key);
  }
  assert.equal(global.P42_CAMERA_MODEL, undefined);
});

test('P42-02: 2D and Z=1 preserve the actual legacy projection, shake and bounds', () => {
  const v = viewport();
  for (const k of [1, .85, .70, .60]) {
    // Existing setTiltScale permits only endpoints; legacy intermediates are initial URL values.
    const env = { innerWidth: 1280, innerHeight: 800, location: { search: `?tilt=${k}` } };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../js/viewport.js'), 'utf8'), env);
    const legacy = env.VIEWPORT, cam = { x: 500, y: -290 }, shake = { x: 4, y: -2 };
    const c = M.makeCamera({ tilt: k, zoom: 1, cam, shake });
    for (const p of [{ x: 703, y: 444 }, { x: -1200, y: -444 }, { x: 500, y: -290 }]) {
      point(M.worldToScreen(p, c), legacy.worldToScreen(p.x, p.y, cam, shake));
      point(M.screenToWorld(M.worldToScreen(p, c), c), p);
    }
    const a = M.viewOffsets(c, legacy.bounds()), b = legacy.worldBounds();
    for (const key of ['left', 'top', 'right', 'bottom', 'width', 'height']) close(a[key], b[key], key);
  }
  assert.ok(v.calculate(1280, 800).scale > 1);
});

for (const z of [1.10, 1.15]) test(`P42-03/${z}: 0.60×Z projection and inverse agree with the CTM`, () => {
  const c = M.makeCamera({ tilt: .6, zoom: z, cam: { x: -377.2, y: 511.7 }, shake: { x: 3.4, y: -1.9 } });
  for (let i = 0; i < 100; i++) {
    const p = { x: i * 53.1 - 1850, y: i * 31.7 - 2700 };
    const s = M.worldToScreen(p, c);
    point(M.screenToWorld(s, c), p); point(matrixPoint(M.worldMatrix(c), p), s);
  }
  close(M.worldMatrix(c)[0], z); close(M.worldMatrix(c)[3], .6 * z);
});

test('P42-04: P is centered for every zoom, and both axes stay continuous during a switch', () => {
  const p = { x: 1350, y: 900 }, anchor = { x: 450, y: 300 };
  for (const k of [1, .8, .6]) for (const z of [1, 1.075, 1.15]) {
    const c = M.makeCamera({ tilt: k, zoom: z, cam: { x: p.x - 450, y: p.y - 300 / k } });
    point(M.worldToScreen(p, c), anchor);
  }
  const old = M.makeCamera({ tilt: .6, zoom: 1, cam: { x: 877, y: 425 } });
  const before = M.worldToScreen(p, old);
  for (const k of [.6, .7, .9, 1]) {
    const config = { tilt: k, zoom: 1 + .15 * (1 - k) / .4 };
    const cam = M.reanchor(p, before, M.makeCamera(config));
    point(M.worldToScreen(p, M.makeCamera({ ...config, cam })), before);
  }
});

test('P42-05: fixed scenery never changes size while viewer/camera moves; blur/grade remain bounded', () => {
  const foot = { x: 400, y: 346 }, extents = { left: 105, right: 105, top: 190, bottom: 6 };
  for (const mode of ['default', 'enhanced', 'off']) for (const viewerY of [-600, 300, 440, 600, 820, 900, 1800]) {
    const depth = M.stableSceneryDepth(300, viewerY, { stageId: 'sakura-pass', tilt: .6, mode });
    assert.equal(depth.scale, 1);
    assert.ok(depth.blur >= 0 && depth.blur <= (mode === 'enhanced' ? 3.2 : 2.6));
    assert.ok(depth.grade >= 0 && depth.grade <= 1);
    const c = M.makeCamera({ tilt: .6, zoom: 1.15, cam: { x: 130, y: viewerY - 500 } });
    const r = M.uprightRect(foot, extents, c);
    close(r.right - r.left, 210 * 1.15); close(r.bottom - r.top, 196 * 1.15);
  }
  const near = M.stableSceneryDepth(300, 300, { stageId: 'sakura-pass', tilt: .6 });
  const far = M.stableSceneryDepth(300, 820, { stageId: 'sakura-pass', tilt: .6 });
  assert.equal(near.blur, 0); close(far.blur, 2.6);
  for (const opts of [{ stageId: 'night-town', tilt: .6 }, { stageId: 'sakura-pass', tilt: 1 }]) {
    const d = M.stableSceneryDepth(300, 900, opts); assert.equal(d.scale, 1);
  }
  assert.deepEqual(M.stableSceneryDepth(300, null), { scale: 1, blur: 0, grade: 0 });
});

test('P42-06: zoom/tilt/shake leave world IDs, collisions and delivery positions immutable', () => {
  const house = Object.freeze({ id: 'sakura-pass:-1,2:0', x: -400, y: 920, dy: 980, collider: Object.freeze({ left: -464, top: 889, right: -336, bottom: 949 }) });
  const before = JSON.stringify(house), p = { x: -405, y: 940 };
  const blocked = w => w.x >= house.collider.left && w.x <= house.collider.right && w.y >= house.collider.top && w.y <= house.collider.bottom;
  for (const z of [1, 1.10, 1.15, 1]) for (const k of [1, .8, .6]) {
    const c = M.makeCamera({ tilt: k, zoom: z, cam: { x: -500, y: 600 }, shake: { x: -4, y: 3 } });
    const screen = M.worldToScreen(p, c), recovered = M.screenToWorld(screen, c);
    assert.equal(blocked(recovered), blocked(p)); assert.equal(blocked(p), true);
    point(M.screenToWorld(M.worldToScreen({ x: house.x, y: house.dy }, c), c), { x: house.x, y: house.dy });
    assert.equal(JSON.stringify(house), before);
  }
});

test('P42-07: tablet/desktop CSS and DPR do not change world or HUD logical coordinates', () => {
  for (const [width, height, dpr] of [[1280, 800, 1], [1194, 834, 2], [1920, 1080, 1.5], [844, 390, 3]]) {
    const v = viewport(width, height).get(), rect = { left: 11, top: 23, width, height };
    const c = M.makeCamera({ tilt: .6, zoom: 1.15, cam: { x: 700, y: 290 } }), p = { x: 1040, y: 650 };
    const logical = M.worldToScreen(p, c), client = M.logicalToClient(logical, rect, v);
    point(M.screenToWorld(M.clientToLogical(client, rect, v), c), p);
    const backing = matrixPoint(M.backingMatrix(c, v, dpr), p);
    close(backing.x, (client.x - rect.left) * dpr); close(backing.y, (client.y - rect.top) * dpr);
    const hud = { x: 824, y: 41 }, hudClient = M.logicalToClient(hud, rect, v);
    point(M.clientToLogical(hudClient, rect, v), hud);
    const flat = M.makeCamera({ zoom: 1 });
    assert.notDeepEqual(M.worldMatrix(c), M.worldMatrix(flat));
    point(M.logicalToClient(hud, rect, v), hudClient); // HUD has no camera parameter.
  }
});

test('P42-08: camera inverse is for world picking; HUD drag threshold and joystick normalize stay unchanged', () => {
  const v = viewport(1194, 834).get(), rect = { left: 20, top: 5, width: 1194, height: 834 };
  const origin = { x: 90, y: 480 }, moved = { x: 126, y: 528 };
  for (const z of [1, 1.1, 1.15]) {
    const a = M.clientToLogical(M.logicalToClient(origin, rect, v), rect, v);
    const b = M.clientToLogical(M.logicalToClient(moved, rect, v), rect, v);
    close(Math.hypot(b.x - a.x, b.y - a.y), 60);
    close((b.x - a.x) / 60, .6); close((b.y - a.y) / 60, .8);
    const c = M.makeCamera({ tilt: .6, zoom: z });
    const wa = M.screenToWorld(a, c), wb = M.screenToWorld(b, c);
    close(wb.x - wa.x, 36 / z); close(wb.y - wa.y, 48 / (.6 * z));
  }
});

test('P42-09: only local Stage3 candidates enable zoom; 2D and stages 1/2/4–8 stay Z=1', () => {
  for (const stageId of ['night-town', 'rain-port', 'bamboo-maze', 'hyakki-kyoto', 'snow-temple', 'spirit-ferry', 'yomi']) {
    assert.equal(M.effectiveZoom({ stageId, tilt: .6, hostname: 'localhost', search: '?zoom=1.15', defaultZoom: 1.15 }), 1);
  }
  for (const host of ['localhost', '127.0.0.1', '::1', '[::1]']) for (const [query, wanted] of [['?zoom=1', 1], ['?zoom=1.10', 1.1], ['?zoom=1.15', 1.15]]) {
    close(M.effectiveZoom({ stageId: 'sakura-pass', tilt: .6, hostname: host, search: query }), wanted);
    assert.equal(M.effectiveZoom({ stageId: 'sakura-pass', tilt: 1, hostname: host, search: query }), 1);
  }
  assert.equal(M.effectiveZoom({ stageId: 'sakura-pass', tilt: .6, hostname: 'yorkwahaha.github.io', search: '?zoom=1.15' }), 1);
  for (const query of ['?zoom=1.5', '?zoom=NaN', '?zoom=0', '?zoom=', '?zoom=1.15oops', '?zoom=-1']) {
    assert.equal(M.effectiveZoom({ stageId: 'sakura-pass', tilt: .6, hostname: 'localhost', search: query }), 1);
  }
  close(M.effectiveZoom({ stageId: 'sakura-pass', tilt: .8, hostname: 'localhost', search: '?zoom=1.15' }), 1.075);
  assert.equal(M.effectiveZoom({ stageId: 'sakura-pass', tilt: .6 }), 1, 'designer default remains undecided/conservative');
});

test('P42-10: upright cancels tilt once, retains zoom and keeps a fixed foot contact', () => {
  const foot = { x: 400, y: 348 };
  for (const k of [1, .8, .6]) for (const z of [1, 1.15]) {
    const c = M.makeCamera({ tilt: k, zoom: z, cam: { x: 180, y: 350 } });
    const matrix = M.uprightMatrix(c, foot);
    point(matrixPoint(matrix, foot), M.worldToScreen(foot, c));
    const roof = matrixPoint(matrix, { x: foot.x - 105, y: foot.y - 192 });
    const feet = matrixPoint(matrix, foot);
    close(feet.y - roof.y, 192 * z); close(feet.x - roof.x, 105 * z);
  }
});

test('P42-11: inverse viewport bounds cover corners, including negative coordinates and shake', () => {
  for (const z of [1, 1.10, 1.15]) {
    const v = viewport(1920, 1080), b = v.bounds();
    const c = M.makeCamera({ tilt: .6, zoom: z, cam: { x: -600, y: -400 }, shake: { x: 5, y: -3 } });
    const w = M.worldBounds(c, b);
    for (const p of [{ x: b.left, y: b.top }, { x: b.right, y: b.bottom }]) {
      const a = M.screenToWorld(p, c); assert.ok(a.x >= w.left - 1e-8 && a.x <= w.right + 1e-8 && a.y >= w.top - 1e-8 && a.y <= w.bottom + 1e-8);
    }
    close(w.width, b.width / z); close(w.height, b.height / (.6 * z));
  }
});

test('P42-12: below-screen feet with a visible roof are kept by drawBounds (not a fixed 220 margin)', () => {
  const v = viewport(1280, 800), b = v.bounds(), ext = { left: 105, right: 105, top: 240, bottom: 12, halo: 8 };
  for (const z of [1, 1.1, 1.15]) {
    const c = M.makeCamera({ tilt: .6, zoom: z, cam: { x: -800, y: -500 } });
    const visible = M.worldBounds(c, b), draw = M.drawBounds(c, b, ext);
    const foot = { x: (visible.left + visible.right) / 2, y: visible.bottom + 300 };
    assert.ok(foot.y > visible.bottom + 220, 'legacy fixed margin would drop it');
    assert.ok(overlaps(M.uprightRect(foot, ext, c), b), 'roof really intersects screen');
    assert.ok(foot.y <= draw.bottom && foot.y >= draw.top);
    const far = { x: foot.x, y: draw.bottom + 10 };
    assert.equal(overlaps(M.uprightRect(far, ext, c), b), false);
    for (const side of ['left', 'right']) {
      const edge = { x: visible[side] + (side === 'left' ? -80 : 80), y: (visible.top + visible.bottom) / 2 };
      assert.ok(overlaps(M.uprightRect(edge, ext, c), b)); assert.ok(edge.x >= draw.left && edge.x <= draw.right);
    }
  }
});

test('P42-13: local zoom transition is continuous and does not rebuild a world', () => {
  const houseIds = Object.freeze(['sakura-pass:0,0:0', 'sakura-pass:-1,0:0']);
  let previous = 1;
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, k = 1 - .4 * (t * t * (3 - 2 * t));
    const z = M.effectiveZoom({ stageId: 'sakura-pass', tilt: k, hostname: 'localhost', search: '?zoom=1.15' });
    assert.ok(z >= previous - 1e-10 && z - previous < .004);
    previous = z;
  }
  close(previous, 1.15); assert.deepEqual(houseIds, ['sakura-pass:0,0:0', 'sakura-pass:-1,0:0']);
});

test('P42-14: singular/nonfinite cameras are rejected rather than returning broken inverse coordinates', () => {
  for (const opts of [{ tilt: 0 }, { tilt: NaN }, { tilt: 2 }, { zoom: 0 }, { zoom: Infinity }, { cam: { x: NaN, y: 0 } }]) {
    assert.throws(() => M.makeCamera(opts), RangeError);
  }
});

test('P42-15: world movement speed, collision radii and delivery distance do not depend on zoom', () => {
  const p = Object.freeze({ x: 1350, y: 900 }), velocity = { x: 0, y: 230 }, dt = 1 / 60;
  const next = { x: p.x + velocity.x * dt, y: p.y + velocity.y * dt };
  const delivery = { x: 1350, y: 1000 }, distance = Math.hypot(delivery.x - next.x, delivery.y - next.y);
  for (const z of [1, 1.10, 1.15]) {
    const c = M.makeCamera({ tilt: .6, zoom: z });
    const a = M.worldToScreen(p, c), b = M.worldToScreen(next, c);
    close(b.y - a.y, .6 * z * 230 / 60);
    const recovered = M.screenToWorld(b, c);
    close(Math.hypot(recovered.x - p.x, recovered.y - p.y) / dt, 230);
    close(Math.hypot(delivery.x - recovered.x, delivery.y - recovered.y), distance);
    close(M.worldToScreen({ x: p.x + 26, y: p.y }, c).x - a.x, 26 * z);
  }
});
