'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

const read = p => fs.readFileSync(p, 'utf8');

test('public start never leaks window.devSpawnCharm onto global scope', () => {
  const pub = loadGame({ location: { hostname: 'yorkwahaha.github.io', pathname: '/yokai-delivery/', search: '' } });
  pub.start();
  assert.equal(typeof pub.env.devSpawnCharm, 'undefined');

  const dev = loadGame({ location: { hostname: '127.0.0.1', pathname: '/', search: '?dev=1' } });
  dev.start();
  assert.equal(typeof dev.env.devSpawnCharm, 'function');
});

test('VIEWPORT exports is2D() and guards zero/invalid calculate() dimensions', () => {
  const env = { window: { location: { hostname: 'yorkwahaha.github.io', search: '' } } };
  vm.runInNewContext(read('js/viewport.js'), env);
  const vp = env.window.VIEWPORT;
  assert.equal(typeof vp.is2D, 'function');
  assert.equal(vp.is2D(), false);
  vp.setTiltScale(1);
  assert.equal(vp.is2D(), true);
  vp.setTiltScale(0.6);
  assert.equal(vp.is2D(), false);
  const safe = vp.calculate(0, 0);
  assert.ok(Number.isFinite(safe.width) && Number.isFinite(safe.height) && safe.scale > 0);
});

test('UI.drawLevelUp balances ctx.save() and ctx.restore() without underflow', () => {
  const game = loadGame({ location: { hostname: 'yorkwahaha.github.io', search: '' } });
  const ui = game.env.UI;
  let depth = 0, minDepth = 0;
  const ctx = {
    font: '16px sans-serif', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    globalAlpha: 1, textAlign: 'left', textBaseline: 'alphabetic',
    save() { depth++; },
    restore() { depth--; if (depth < minDepth) minDepth = depth; },
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, roundRect() {}, clip() {},
    fill() {}, stroke() {}, fillText() {}, strokeText() {}, translate() {}, scale() {}, rotate() {},
    drawImage() {}, setLineDash() {},
    measureText(s) { return { width: String(s || '').length * 10, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; }
  };
  const choices = [{ id: 'katana', type: 'weapon', n: '妖刀', s: 'ようとう', d: '測試', lv: 2 }];
  ui.drawLevelUp(ctx, 2, choices, { katana: 1 }, { katana: { n: '妖刀' } }, 1, 0, 0, 'keyboard');
  assert.equal(depth, 0, 'save/restore stack must return to 0');
  assert.ok(minDepth >= 0, 'save/restore stack must never underflow');
});

test('SKILLFX artFx preserves full life while waiting for delay to elapse', () => {
  const FX = { count: n => n, rnd: a => a, allowsMotion: () => true, emit() {}, bolt() {}, flash() {} };
  const env = {
    window: {
      ART: { test_art: { naturalWidth: 64, naturalHeight: 64 } },
      thunderRasterArt: () => ({ naturalWidth: 128, naturalHeight: 128 }),
      VIEWPORT: { tiltScale: () => 0.6 },
      FX
    },
    FX,
    Math
  };
  vm.runInNewContext(read('js/skillfx.js'), env);
  const sfx = env.window.SKILLFX;
  sfx.play('thunder', 'strike', 5, { x: 100, y: 100, delay: 0.25 });
  const initialCount = sfx.stats().artFx;
  assert.ok(initialCount > 0);
  sfx.update(0.24);
  assert.equal(sfx.stats().artFx, initialCount, 'delayed artFx must not expire before delay completes');
});

test('GAME_ATTACK_SPECS fixes ink_trail/needle mutation source, fusion critLvl, and default deps', () => {
  const env = {
    window: { location: { hostname: 'yorkwahaha.github.io', search: '' } },
    Math, Number, Object, Array, Set
  };
  env.window.window = env.window;
  for (const f of ['js/game-combat-math.js', 'js/game-violet-scent.js', 'js/game-attack-specs.js']) {
    vm.runInNewContext(read(f), env);
  }
  const deps = {
    WL: {}, W: 900, b: { dmg: 1.2, rate: 0, crit: 0 },
    getEffectiveRate: () => 0, getEffectiveDmg: () => 1.2, getEffectiveReachMultiplier: () => 1
  };
  const inkBase = env.window.GAME_ATTACK_SPECS.resolveAttackSpec('ink_trail', 3, { mutations: [] }, {}, deps);
  const inkMut = env.window.GAME_ATTACK_SPECS.resolveAttackSpec('ink_trail', 3, { mutations: ['mut_ink_bloom'] }, {}, deps);
  assert.equal(inkBase.source, 'base');
  assert.equal(inkMut.source, 'mutation');

  const needleOtherMut = env.window.GAME_ATTACK_SPECS.resolveAttackSpec('needle', 3, { mutations: ['mut_crosscut'] }, {}, deps);
  assert.equal(needleOtherMut.source, 'base', 'katana mutation must not flip needle source to mutation');
  assert.equal(needleOtherMut.mutations, undefined);

  const thunderNoDuos = env.window.GAME_ATTACK_SPECS.resolveAttackSpec('thunder', 3, null, {}, deps);
  assert.equal(thunderNoDuos.hasDuoThundercircle, false);

  const inkbladeCrit = env.window.GAME_ATTACK_SPECS.resolveAttackSpec('fusion_inkblade', 1, { passives: { crit: 0 } }, { critLvl: 2 }, deps);
  const circleCrit = env.window.GAME_ATTACK_SPECS.resolveAttackSpec('fusion_thundercircle', 1, { passives: { crit: 0 } }, { critLvl: 2 }, deps);
  assert.equal(inkbladeCrit.critChance, 0.5);
  assert.equal(circleCrit.critChance, 0.5);
});

test('AUDIO finalBossHtmlVoice sets sfxVolume so word ducking never throws NaN volume TypeError', () => {
  const created = [];
  class FakeAudio {
    constructor(src) { this.src = src; this._vol = 1; this.paused = true; created.push(this); }
    set volume(v) {
      if (!Number.isFinite(v) || v < 0 || v > 1) throw new TypeError('Invalid volume: ' + v);
      this._vol = v;
    }
    get volume() { return this._vol; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener() {}
  }
  const win = { location: { hostname: 'yorkwahaha.github.io', search: '' } };
  vm.runInNewContext(read('js/audio.js'), { window: win, Audio: FakeAudio, setTimeout, clearTimeout });
  win.AUDIO.finalBossDeath(0.8);
  assert.ok(created.length >= 1);
  assert.doesNotThrow(() => win.AUDIO.speak('あめ'));
  assert.doesNotThrow(() => win.AUDIO.stopSpeech());
});

test('FX foot particles apply upright() once and life<=0 guards against NaN', () => {
  let uprightCalls = 0;
  const fakeCtx = () => ({
    globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, transform() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, fillRect() {}, clearRect() {}, drawImage() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; }
  });
  const document = { createElement: () => ({ width: 64, height: 64, getContext: fakeCtx }) };
  const env = {
    window: {
      VIEWPORT: {
        tiltScale: () => 0.6,
        upright: (_c, _x, _y, fn) => { uprightCalls++; fn(); }
      },
      document
    },
    document,
    Math
  };
  vm.runInNewContext(read('js/fx.js'), env);
  env.window.FX.emit('rock', '#998877', { x: 100, y: 100, life: 0, s0: 20, s1: 20, foot: true });
  env.window.FX.update(0.05);
  const ctx = fakeCtx();
  assert.doesNotThrow(() => {
    env.window.FX.draw(ctx, { x: 0, y: 0 }, { left: 0, right: 900, top: 0, bottom: 600 });
  });
  assert.equal(uprightCalls, 1, 'foot particle must invoke upright() once, not twice');
});
