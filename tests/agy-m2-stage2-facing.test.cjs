// tests/agy-m2-stage2-facing.test.cjs
// M2-HF-K-FIX: Stage 2 潮目小僧原生朝向 nativeFacing = -1 與真移動面向測試
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadStage2RendererEnv(reducedMotion = false) {
  const scales = [];
  const translates = [];
  const rotates = [];
  const transforms = [];
  const drawnImages = [];

  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    rect() {},
    clip() {},
    fill() {},
    stroke() {},
    clearRect() {},
    fillRect() {},
    fillText() {},
    strokeText() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    roundRect() {},
    translate(x, y) { translates.push([x, y]); },
    rotate(ang) { rotates.push(ang); },
    scale(sx, sy) { scales.push([sx, sy]); },
    transform(...args) { transforms.push(args); },
    setTransform() {},
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
    ellipse() {},
    drawImage(...args) { drawnImages.push(args); },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 40 })
  };

  const canvas = {
    width: 900,
    height: 600,
    getContext: () => ctx,
    style: {}
  };

  const env = {
    console,
    Math,
    UI: { readableFont: () => '20px sans-serif' },
    document: {
      createElement: tag => {
        if (tag === 'canvas') return { width: 100, height: 100, getContext: () => ctx, style: {} };
        return {};
      },
      getElementById: () => canvas
    },
    window: {
      innerWidth: 900,
      innerHeight: 600,
      devicePixelRatio: 1,
      location: { search: '?tilt=0.6' },
      matchMedia: query => ({
        matches: reducedMotion && query.includes('prefers-reduced-motion'),
        addEventListener() {}
      }),
      ART: {},
      PORT_ENEMIES: {
        shiomeIdle: { naturalWidth: 250, naturalHeight: 220, complete: true },
        shiomeAttack: { naturalWidth: 250, naturalHeight: 220, complete: true },
        bossIdle: { naturalWidth: 350, naturalHeight: 330, complete: true },
        bossAttack: { naturalWidth: 350, naturalHeight: 330, complete: true }
      },
      STAGE_ASSET_SLOTS: {},
      UI: { readableFont: () => '20px sans-serif' }
    }
  };
  env.window.window = env.window;

  const vpCode = fs.readFileSync(path.join(ROOT, 'js', 'viewport.js'), 'utf8');
  vm.runInNewContext(vpCode, env);

  const rndCode = fs.readFileSync(path.join(ROOT, 'js', 'renderer.js'), 'utf8');
  vm.runInNewContext(rndCode, env);

  env.window.RENDERER.init(canvas);

  return { env, ctx, scales, translates, rotates, transforms, drawnImages };
}

// ── 1. faceAng = 0 (朝右) -> scaleX = -1 (原圖朝左翻轉)；faceAng = PI (朝左) -> scaleX = +1 (原圖不翻轉) ──
test('M2-HF-K-1: Shiome nativeFacing=-1: faceAng 0 -> scaleX -1, faceAng PI -> scaleX +1', () => {
  const { env, scales } = loadStage2RendererEnv(true); // reducedMotion to isolate primary facing scale
  const renderer = env.window.RENDERER;

  // 1.1 faceAng = 0 (向右移動，角度 0 弧度)
  scales.length = 0;
  renderer.drawMonster({
    type: 'shiome',
    x: 300,
    y: 200,
    faceAng: 0,
    walking: false
  }, { x: 400, y: 200 }, 0);

  assert.equal(scales.length, 1, 'reduced-motion 下僅有一次基礎面向縮放');
  assert.equal(scales[0][0], -1, 'faceAng=0 向右移動時，scaleX 必須為 -1 (翻轉朝左的原圖以正確面向右方)');
  assert.equal(scales[0][1], 1, 'scaleY 必須為 1');

  // 1.2 faceAng = Math.PI (向左移動，角度 PI 弧度)
  scales.length = 0;
  renderer.drawMonster({
    type: 'shiome',
    x: 300,
    y: 200,
    faceAng: Math.PI,
    walking: false
  }, { x: 200, y: 200 }, 0);

  assert.equal(scales.length, 1);
  assert.equal(scales[0][0], 1, 'faceAng=PI 向左移動時，scaleX 必須為 +1 (保留朝左的原圖以正確面向左方)');
  assert.equal(scales[0][1], 1, 'scaleY 必須為 1');
});

// ── 2. 同 faceAng 下切換玩家在怪物的左右側，面向絕不因玩家位置而翻轉 ──
test('M2-HF-K-2: Shiome facing is locked to faceAng and independent of player position', () => {
  const { env, scales } = loadStage2RendererEnv(true);
  const renderer = env.window.RENDERER;

  const monster = { type: 'shiome', x: 500, y: 300, faceAng: 0, walking: false };

  // 玩家在怪物左方 (P.x = 200 < e.x = 500)
  scales.length = 0;
  renderer.drawMonster(monster, { x: 200, y: 300 }, 0);
  const scaleWithPlayerOnLeft = scales[0][0];

  // 玩家在怪物右方 (P.x = 800 > e.x = 500)
  scales.length = 0;
  renderer.drawMonster(monster, { x: 800, y: 300 }, 0);
  const scaleWithPlayerOnRight = scales[0][0];

  assert.equal(scaleWithPlayerOnLeft, -1, '怪物向右(faceAng=0)，玩家在左側時仍堅定面向右方 (scaleX=-1)');
  assert.equal(scaleWithPlayerOnRight, -1, '怪物向右(faceAng=0)，玩家在右側時仍堅定面向右方 (scaleX=-1)');
  assert.equal(scaleWithPlayerOnLeft, scaleWithPlayerOnRight, '切換玩家相對位置時，面向絕不發生非預期翻轉');
});

// ── 3. walking = false 時保留無搖擺，walking = true 時依步態剪切擺動且腳底固定 ──
test('M2-HF-K-3: walking=false has zero shear sway, walking=true applies procedural shear sway with grounded feet', () => {
  const { env, transforms } = loadStage2RendererEnv(false); // motion enabled
  const renderer = env.window.RENDERER;

  // 3.1 walking = false
  transforms.length = 0;
  renderer.drawMonster({
    type: 'shiome',
    x: 400,
    y: 300,
    faceAng: 0,
    walking: false
  }, { x: 400, y: 300 }, 1.5);

  assert.equal(transforms.length, 0, 'walking=false 靜止站立時嚴格無剪切搖擺');

  // 3.2 walking = true
  transforms.length = 0;
  renderer.drawMonster({
    type: 'shiome',
    x: 400,
    y: 300,
    faceAng: 0,
    walking: true
  }, { x: 400, y: 300 }, 1.5);

  assert.equal(transforms.length, 1, 'walking=true 行走時應有一次步態提燈剪切搖擺');
  const [a, b, shearX, d, e, f] = transforms[0];
  assert.equal(a, 1);
  assert.equal(b, 0);
  assert.ok(Math.abs(shearX) > 0.001, '步態搖擺剪切量必須為非零微調值');
  assert.ok(Math.abs(shearX) < 0.10, '步態搖擺幅度應溫和受控 (< 0.10)');
  assert.equal(d, 1);
  assert.equal(e, 0);
  assert.equal(f, 0, '腳底 y=0 水平不產生位移，保持腳底接地');
});

// ── 4. reduced-motion 啟用時無呼吸或骨骼形變，僅保留面向 scale ──
test('M2-HF-K-4: reduced-motion disables soft-body deformation, keeping only base facing scale', () => {
  const { env, scales, rotates } = loadStage2RendererEnv(true); // reducedMotion = true
  const renderer = env.window.RENDERER;

  scales.length = 0;
  rotates.length = 0;
  renderer.drawMonster({
    type: 'shiome',
    x: 400,
    y: 300,
    faceAng: 0,
    walking: true,
    flash: 1
  }, { x: 400, y: 300 }, 2.5);

  assert.equal(rotates.length, 0, 'reduced-motion 下禁止旋轉搖擺');
  assert.equal(scales.length, 1, 'reduced-motion 下僅允許一次基礎面向 scale');
  assert.deepEqual(scales[0], [-1, 1], '縮放倍率嚴格為 [-1, 1]，無受擊閃爍形變或呼吸拉伸');
});

// ── 5. 腳底錨點與 drawImage 偏移固定（時間演進下接地點永遠鎖定 e.y） ──
test('M2-HF-K-5: Shiome foot anchor and drawImage offsets remain locked to e.y across time', () => {
  const { env, translates, drawnImages } = loadStage2RendererEnv(false);
  const renderer = env.window.RENDERER;

  const monster = { type: 'shiome', x: 350, y: 280, faceAng: 0, walking: true };

  for (let elapsed = 0; elapsed <= 3.0; elapsed += 0.5) {
    translates.length = 0;
    drawnImages.length = 0;

    renderer.drawMonster(monster, { x: 350, y: 280 }, elapsed);

    // 平移錨點必須恆為 (e.x, e.y)
    assert.deepEqual(translates[0], [350, 280], `時間 ${elapsed}s 時平移錨點必須固定於怪物世界座標 (350, 280)`);

    // drawImage 的腳底偏移 (y 偏移 + 高度)
    const draw = drawnImages[0];
    const dy = draw[2];
    const dh = draw[4];
    // spec.ay = 205, h = 220, scale = 0.48: dy = -205 * 0.48 = -98.4, dh = 220 * 0.48 = 105.6
    // 腳底接觸點相對於 translate(e.x, e.y) 的距離: dy + 205 * 0.48 = 0
    assert.ok(Math.abs(dy + 205 * 0.48) < 0.01, 'drawImage 腳底錨點偏移嚴格維持在 205 * 0.48');
  }
});

// ── 6. Boss (海坊主 / 近正面) 保留原處理 (nativeFacing = 1) ──
test('M2-HF-K-6: Boss (Umibozu / frontal) preserves original handling with nativeFacing = 1', () => {
  const { env, scales } = loadStage2RendererEnv(true);
  const renderer = env.window.RENDERER;

  // Boss faceAng = 0
  scales.length = 0;
  renderer.drawMonster({
    type: 'umibozu',
    umibozu: true,
    x: 450,
    y: 300,
    faceAng: 0
  }, { x: 450, y: 300 }, 0);

  assert.equal(scales.length, 1);
  assert.equal(scales[0][0], 1, 'Boss 近正面朝向保持 nativeFacing=1 (faceAng=0 時 scaleX=+1)');

  // Boss faceAng = PI
  scales.length = 0;
  renderer.drawMonster({
    type: 'umibozu',
    umibozu: true,
    x: 450,
    y: 300,
    faceAng: Math.PI
  }, { x: 450, y: 300 }, 0);

  assert.equal(scales.length, 1);
  assert.equal(scales[0][0], -1, 'Boss faceAng=PI 時 scaleX=-1');
});
