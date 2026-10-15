// Codex 獨立驗收：使用者於 2026-10-14 核准 rework 四圖的正式雨港接線。
// VM 場景只控制位置/時間；spawn、AI、renderer 與 loader 均執行真正的 production。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadGame } = require('./helpers/game-runtime.cjs');
const ROOT = path.resolve(__dirname, '..');
const runtimeDir = 'assets/img/rain-port/enemies';
// runtime 檔名與 canonical 檔名不同。來源指 art/stage2-rain-port/characters/，載入仍用 runtimeDir。
const roles = {
  shiomeIdle: { file: 'minion_shiome_idle.webp', source: 'art/stage2-rain-port/characters/E_shiome_idle.webp' },
  shiomeAttack: { file: 'minion_shiome_attack.webp', source: 'art/stage2-rain-port/characters/E_shiome_attack.webp' },
  bossIdle: { file: 'boss_ikari_umibozu_idle.webp', source: 'art/stage2-rain-port/characters/B_ikari_idle.webp' },
  bossAttack: { file: 'boss_ikari_umibozu_attack.webp', source: 'art/stage2-rain-port/characters/B_ikari_attack.webp' }
};
const hash = b => createHash('sha256').update(b).digest('hex');

function assets() {
  const images = [];
  class Image { constructor() { this.dataset = {}; images.push(this); } }
  class Audio { addEventListener() {} }
  const env = { Image, Audio, console }; env.window = env;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/assets.js'), 'utf8'), env, { filename: path.join(ROOT, 'js/assets.js') });
  return { env, images };
}

function renderer() {
  const images = [], shapes = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ drawImage: (...a) => images.push(a),
    fillRect: (...a) => shapes.push(['fillRect', ...a]),
    arc: (...a) => shapes.push(['arc', ...a]),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    measureText: () => ({ width: 40 }) }, { get: (o, k) => o[k] ?? (() => {}) });
  const canvas = () => ({ width: 900, height: 600, getContext: () => ctx });
  const commonBoss = { naturalWidth: 256, naturalHeight: 340 };
  const env = { innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    document: { createElement: canvas }, ART: { boss: commonBoss }, PORT_ENEMIES: {},
    UI: { readableFont: () => '20px sans-serif' } }; env.window = env;
  for (const [key, role] of Object.entries(roles)) env.PORT_ENEMIES[key] = {
    src: runtimeDir + '/' + role.file, naturalWidth: key.startsWith('shiome') ? 250 : 350,
    naturalHeight: key.startsWith('shiome') ? 220 : 330, complete: true
  };
  const context = vm.createContext(env);
  for (const name of ['viewport', 'renderer']) {
    const filename = path.join(ROOT, 'js', name + '.js');
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  }
  context.RENDERER.init(canvas());
  return { env: context, images, shapes, commonBoss };
}

function game(stage) {
  const g = loadGame({ stage, seed: 317 }); g.startRun();
  g.stopSpawns(); g.clearOrders(); g.clearSolids();
  for (const k of ['katana', 'needle', 'ofuda', 'barrier', 'fire', 'thunder']) g.setWeaponRank(k, 0);
  return g;
}

function finalBoss(stage) {
  const g = game(stage);
  for (let i = 0; i < 4; i++) {
    g.snapshot().enemies.splice(0); g.advanceBossClock(0); g.update(.01);
  }
  const e = g.snapshot().enemies.find(e => e.final);
  assert.ok(e, 'real boss scheduler must create the final boss');
  return { g, e };
}

function shiomeScene() {
  const g = game('rain-port'); g.setElapsed(240);
  for (let i = 0; i < 120; i++) g.spawnEnemy(1, 150, i * .2, false);
  const e = g.snapshot().enemies.find(e => e.type === 'shiome'); assert.ok(e);
  g.snapshot().enemies.splice(0, g.snapshot().enemies.length, e);
  const p = g.snapshot(); Object.assign(e, { x: p.x + 150, y: p.y, hp: 100, max: 100, speed: 0 });
  return { g, e, p };
}

test('approved runtime sprites are exact copies and all four are content-revisioned', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  const revisions = vm.runInNewContext(sw.slice(0, sw.indexOf('const CACHE_NAME')) + '\nMEDIA_REVISIONS');
  for (const role of Object.values(roles)) {
    const runtime = runtimeDir + '/' + role.file;
    assert.ok(fs.existsSync(path.join(ROOT, runtime)), runtime + ' is not installed');
    const b = fs.readFileSync(path.join(ROOT, runtime));
    assert.equal(hash(b), hash(fs.readFileSync(path.join(ROOT, role.source))), 'approved image may not be altered');
    assert.equal(revisions[runtime], hash(b).slice(0, 24), 'runtime sprite must be in media revision manifest');
  }
});

test('port loader really requests four runtime poses; core loading does not request port enemies', () => {
  const a = assets(); a.env.loadGameArt();
  assert.equal(a.images.some(i => (i.src || '').includes('/rain-port/enemies/')), false);
  a.env.refreshPortArt();
  for (const [key, role] of Object.entries(roles)) {
    const image = a.images.find(i => (i.src || '').split('?')[0] === runtimeDir + '/' + role.file);
    assert.ok(image, 'loader missing ' + role.file);
    image.naturalWidth = key.startsWith('shiome') ? 250 : 350;
    image.naturalHeight = key.startsWith('shiome') ? 220 : 330; image.onload();
    assert.equal(a.env.PORT_ENEMIES[key], image);
  }
});

test('failed port poses report error without duplicate downloads; unavailable Image is safe', () => {
  const a = assets(); a.env.refreshPortArt();
  const enemyImages = a.images.filter(i => (i.src || '').includes('/rain-port/enemies/'));
  assert.equal(enemyImages.length, 4);
  enemyImages.forEach(image => image.onerror());
  for (const key of Object.keys(roles)) assert.equal(a.env.PORT_ENEMY_STATUS[key], 'error');
  const before = a.images.length; a.env.refreshPortArt();
  assert.equal(a.images.length, before, 'refresh must not flood duplicate enemy downloads');
  a.env.Image = undefined; assert.doesNotThrow(() => a.env.refreshPortArt());
});

test('ordinary rain-port spawn includes Shiome, while night-town keeps its common enemies', () => {
  for (const stage of ['rain-port', 'night-town']) {
    const g = game(stage); g.setElapsed(240);
    for (let i = 0; i < 120; i++) g.spawnEnemy(1, 250, i * .2, false);
    const found = g.snapshot().enemies.some(e => e.type === 'shiome');
    assert.equal(found, stage === 'rain-port', stage + ' stage-exclusive spawn');
    assert.ok(g.snapshot().enemies.some(e => e.type !== 'shiome'), 'common enemies may coexist');
  }
});

test('real port final boss draws its two approved poses in sync with shield and tide', () => {
  const { e } = finalBoss('rain-port'); const r = renderer(); const p = { x: e.x + 180, y: e.y };
  e.shield = true; e.pose = 'attack'; e.hazard = { kind: 'tide', phase: 'active' };
  r.env.RENDERER.drawMonster(e, p, 0);
  assert.equal(r.images.at(-1)?.[0], r.env.PORT_ENEMIES.bossIdle, 'shield keeps idle even with stale attack state');
  assert.ok(r.shapes.some(s => s[0] === 'arc' && s[3] === 68), 'approved Boss keeps the existing visible seal ring');
  e.shield = false; r.env.RENDERER.drawMonster(e, p, .1);
  assert.equal(r.images.at(-1)?.[0], r.env.PORT_ENEMIES.bossAttack);
  const attackBox = r.images.at(-1);
  e.hazard = null; e.attackT = 0; e.pose = 'idle'; r.env.RENDERER.drawMonster(e, p, .2);
  assert.equal(r.images.at(-1)?.[0], r.env.PORT_ENEMIES.bossIdle);
  const idleBox = r.images.at(-1);
  assert.deepEqual(attackBox.slice(1), idleBox.slice(1), 'poses must share scale and anchor');
});

test('night-town final boss still draws the common Boss image', () => {
  const { e } = finalBoss('night-town'); const r = renderer(); e.shield = false;
  e.hazard = { kind: 'slam', phase: 'active' };
  r.env.RENDERER.drawMonster(e, { x: e.x + 100, y: e.y }, 0);
  assert.equal(r.images.at(-1)?.[0], r.commonBoss);
});

test('Shiome AI reaches a held attack pose and returns to idle with a cooldown', () => {
  const g = game('rain-port'); g.setElapsed(240);
  for (let i = 0; i < 120; i++) g.spawnEnemy(1, 150, i * .2, false);
  const e = g.snapshot().enemies.find(e => e.type === 'shiome'); assert.ok(e, 'ordinary spawn must provide a real Shiome');
  g.snapshot().enemies.splice(0, g.snapshot().enemies.length, e);
  const p = g.snapshot(); e.x = p.x + 150; e.y = p.y; e.hp = e.max = 100; e.speed = 0;
  const r = renderer(); const poses = [];
  for (let i = 0; i < 400; i++) {
    g.update(.02); r.env.RENDERER.drawMonster(e, { x: p.x, y: p.y }, i * .02);
    poses.push(r.images.at(-1)?.[0] === r.env.PORT_ENEMIES.shiomeAttack ? 'attack' : 'idle');
  }
  assert.ok(poses.includes('attack'), 'Shiome must actually attack');
  let longest = 0, run = 0;
  for (const pose of poses) { run = pose === 'attack' ? run + 1 : 0; longest = Math.max(longest, run); }
  assert.ok(longest >= 8, 'attack held at least 160ms rather than flickering');
  assert.ok(poses.slice(poses.indexOf('attack') + 1).includes('idle'), 'attack must finish');
});

test('missing approved Shiome art never falls back to a procedural character', () => {
  const g = game('rain-port'); g.setElapsed(240);
  for (let i = 0; i < 120; i++) g.spawnEnemy(1, 250, i * .2, false);
  const e = g.snapshot().enemies.find(e => e.type === 'shiome'); assert.ok(e);
  const r = renderer(); r.env.PORT_ENEMIES = {}; r.env.ART = {};
  r.env.RENDERER.drawMonster(e, { x: e.x + 100, y: e.y }, 0);
  assert.equal(r.shapes.length, 0, 'no colored circle/rectangle body for missing port sprite');
});

test('Shiome wave locks its warning direction, hits once, and can be dodged', () => {
  const standing = shiomeScene(), dodging = shiomeScene();
  for (const s of [standing, dodging]) for (let i = 0; i < 45; i++) s.g.update(.02);
  assert.equal(standing.e.hazard?.phase, 'telegraph');
  const locked = dodging.e.hazard.angle;
  dodging.g.placeAt(dodging.p.x, dodging.p.y + 130);
  for (let i = 0; i < 20; i++) dodging.g.update(.02);
  assert.equal(dodging.e.hazard.angle, locked, 'warning must not retarget a dodging player');
  for (let i = 0; i < 130; i++) standing.g.update(.02);
  for (let i = 0; i < 110; i++) dodging.g.update(.02);
  const extraDamage = dodging.g.snapshot().oil - standing.g.snapshot().oil;
  assert.ok(extraDamage >= 7.9 && extraDamage <= 8.1, 'standing player takes one 8-oil hit; dodging player avoids it: ' + extraDamage);
  assert.equal(standing.e.hazard, null, 'one wave must finish');
  assert.ok(standing.e.shiomeCd > 0, 'wave has a real cooldown');
});

test('pausing freezes a Shiome warning and timers', () => {
  const { g, e } = shiomeScene();
  for (let i = 0; i < 45; i++) g.update(.02);
  assert.equal(e.hazard?.phase, 'telegraph');
  const before = JSON.stringify(e); g.setState('pause'); g.update(1);
  assert.equal(JSON.stringify(e), before);
});

test('Shiome cannot begin a short-range wave outside its reach', () => {
  const { g, e, p } = shiomeScene();
  Object.assign(e, { x: p.x + 500, shiomeCd: .01 });
  for (let i = 0; i < 50; i++) g.update(.02);
  assert.ok(!e.hazard, 'distant enemy stays idle instead of firing a remote wave');
  assert.equal(e.pose, 'idle');
});
