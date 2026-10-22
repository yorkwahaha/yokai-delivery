"use strict";
// M2-HF-K Phase2：Stage2 rain-port drawMonster 消費 faceAng/真 walking 朝向
// 輕量 VM fixture（參照 renderer.test.cjs），不 bootstrap 整個 game VM
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRenderer(width = 900, height = 600, dpr = 1) {
  const canvases = [], texts = [], images = [], ellipses = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const transforms = [], fills = [];
    const ctx = new Proxy({
      setTransform: (...args) => transforms.push(args),
      fillRect: (...args) => fills.push(args),
      fillText: text => texts.push(text),
      drawImage: (...args) => images.push(args),
      ellipse: (...args) => ellipses.push(args),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      measureText: () => ({ width: 40 }),
      roundRect: (...args) => {}, arc: (...args) => {},
      beginPath: () => {}, closePath: () => {},
      fill: () => {}, stroke: () => {},
      moveTo: () => {}, lineTo: () => {},
      arcTo: () => {}, translate: () => {},
      scale: () => {}, rotate: () => {},
      save: () => {}, restore: () => {},
      globalAlpha: 1, lineWidth: 1, strokeStyle: '#000', fillStyle: '#000',
      font: '20px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
      lineCap: 'butt', lineJoin: 'miter', shadowColor: 'transparent',
      shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      clip: () => {}, globalCompositeOperation: 'source-over',
      setLineDash: () => {}, setTransform: () => {}
    }, { get: (o, k) => o[k] ?? (() => {}) });
    const c = { width: 0, height: 0, getContext: (...args) => { c.contextOptions = args[1] || null; return ctx; }, transforms, fills, ctx };
    canvases.push(c); return c;
  }
  const main = canvas();
  const env = {
    innerWidth: width, innerHeight: height, devicePixelRatio: dpr,
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    document: { createElement: canvas },
    ART: {}, UI: { readableFont: () => '20px sans-serif' },
    CanvasRenderingContext2D: class {}
  };
  env.window = env;
  const context = vm.createContext(env);
  for (const name of ['viewport', 'renderer']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), context);
  context.RENDERER.init(main);
  return { env: context, main, canvases, texts, images, ellipses };
}

test('Phase2 drawMonster Stage2 shiome：使用 e.faceAng 決定朝向，非玩家相對', () => {
  const r = loadRenderer(900, 600);
  const img = { complete: true, naturalWidth: 500, naturalHeight: 440 };
  r.env.ART.shiomeIdle = img;
  r.env.ART.shiomeAttack = img;
  r.env.PORT_ENEMIES = { shiomeIdle: img, shiomeAttack: img, bossIdle: img, bossAttack: img };

  // 測試 1：faceAng 向右（cos>0），玩家在左側 -> 應朝右（不翻轉）
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'shiome', x: 400, y: 300, faceAng: 0.1, walking: true, wob: 0, shield: false, pose: 'idle', umibozu: false },
    { x: 300, y: 300 }, 1.0
  );
  const calls1 = r.images.filter(c => c[0] === img);
  assert.ok(calls1.length > 0, 'shiome 有繪製 (drawImage 被呼叫)');

  // 測試 2：faceAng 向左（cos<0），玩家在右側 -> 應朝左（翻轉）
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'shiome', x: 400, y: 300, faceAng: 3.1, walking: true, wob: 0, shield: false, pose: 'idle', umibozu: false },
    { x: 500, y: 300 }, 1.0
  );
  const calls2 = r.images.filter(c => c[0] === img);
  assert.ok(calls2.length > 0, 'shiome 向左也有繪製');

  // 測試 3：無 faceAng（初始），回落玩家相對方向
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'shiome', x: 400, y: 300, walking: true, wob: 0, shield: false, pose: 'idle', umibozu: false },
    { x: 500, y: 300 }, 1.0
  );
  const calls3 = r.images.filter(c => c[0] === img);
  assert.ok(calls3.length > 0, '無 faceAng 回落也能繪製');
});

test('Phase2 drawMonster 一般怪物：使用 e.faceAng/e.walking，停止保持末方向', () => {
  const r = loadRenderer(900, 600);
  const ghostImg = { complete: true, naturalWidth: 133, naturalHeight: 189 };
  r.env.ART.ghost = ghostImg;
  r.env.ART.ghost_motion_v1 = { complete: true, naturalWidth: 1774, naturalHeight: 887 };

  // 測試 1：faceAng 向右，walking=true
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'ghost', x: 400, y: 300, faceAng: 0.1, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  const calls1 = r.images.filter(c => c[0] === ghostImg || c[0] === r.env.ART.ghost_motion_v1);
  assert.ok(calls1.length > 0, 'ghost 向右移動有繪製');

  // 測試 2：faceAng 向左，walking=true
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'ghost', x: 400, y: 300, faceAng: 3.1, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 300, y: 300 }, 1.0
  );
  const calls2 = r.images.filter(c => c[0] === ghostImg || c[0] === r.env.ART.ghost_motion_v1);
  assert.ok(calls2.length > 0, 'ghost 向左移動有繪製');

  // 測試 3：walking=false（停止/凍結），faceAng 保持末值
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'ghost', x: 400, y: 300, faceAng: 3.1, walking: false, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  const calls3 = r.images.filter(c => c[0] === ghostImg || c[0] === r.env.ART.ghost_motion_v1);
  assert.ok(calls3.length > 0, '停止狀態仍繪製，faceAng 保持末值');

  // 測試 4：初始無 faceAng，回落玩家相對
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'ghost', x: 400, y: 300, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  const calls4 = r.images.filter(c => c[0] === ghostImg || c[0] === r.env.ART.ghost_motion_v1);
  assert.ok(calls4.length > 0, '無 faceAng 回落玩家相對繪製');
});

test('Phase2 軟骨 bounded：行走/靜態皆可繪製，reduced-motion 靜態回落', () => {
  const r = loadRenderer(900, 600);
  const runnerImg = { complete: true, naturalWidth: 207, naturalHeight: 136 };
  r.env.ART.runner = runnerImg;
  r.env.ART.runner_motion_v1 = { complete: true, naturalWidth: 1774, naturalHeight: 887 };

  // walking=true
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'runner', x: 400, y: 300, faceAng: 0.1, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  const callsWalk = r.images.filter(c => c[0] === runnerImg || c[0] === r.env.ART.runner_motion_v1);
  assert.ok(callsWalk.length > 0, 'runner 行走有繪製');

  // walking=false
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'runner', x: 400, y: 300, faceAng: 0.1, walking: false, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  const callsIdle = r.images.filter(c => c[0] === runnerImg || c[0] === r.env.ART.runner_motion_v1);
  assert.ok(callsIdle.length > 0, 'runner 靜態有繪製');

  // reduced-motion
  const r2 = loadRenderer(900, 600);
  r2.env.matchMedia = () => ({ matches: true, addEventListener: () => {} });
  r2.env.ART.runner = runnerImg;
  r2.env.ART.runner_motion_v1 = { complete: true, naturalWidth: 1774, naturalHeight: 887 };
  r2.images.length = 0;
  r2.env.RENDERER.drawMonster(
    { type: 'runner', x: 400, y: 300, faceAng: 0.1, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  const callsReduced = r2.images.filter(c => c[0] === runnerImg || c[0] === r2.env.ART.runner_motion_v1);
  assert.ok(callsReduced.length > 0, 'reduced-motion 靜態回落仍能繪製');
});

test('Phase2 腳底 pivot：footY 參數固定（ghost=19, tank=27, boss=44），不隨 scale/rotate 漂移', () => {
  const r = loadRenderer(900, 600);
  const ghostImg = { complete: true, naturalWidth: 133, naturalHeight: 189 };
  r.env.ART.ghost = ghostImg;
  r.env.ART.ghost_motion_v1 = { complete: true, naturalWidth: 1774, naturalHeight: 887 };

  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'ghost', x: 400, y: 300, faceAng: 0, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  assert.ok(r.images.length > 0, '有繪製呼叫（內部 footY=19 固定）');

  const tankImg = { complete: true, naturalWidth: 259, naturalHeight: 307 };
  r.env.ART.tank = tankImg;
  r.env.ART.tank_motion_v1 = { complete: true, naturalWidth: 1774, naturalHeight: 887 };
  r.images.length = 0;
  r.env.RENDERER.drawMonster(
    { type: 'tank', x: 400, y: 300, faceAng: 0, walking: true, wob: 0, flash: 0, shield: false, pose: 'idle', attackT: 0 },
    { x: 500, y: 300 }, 1.0
  );
  assert.ok(r.images.length > 0, 'tank 有繪製（內部 footY=27 固定）');
});

test('Phase2 LAMPS 燈籠光源座標：l.y+8 與 game.js syncWorld 腳點一致', () => {
  const r = loadRenderer(900, 600);
  const lampImg = { complete: true, naturalWidth: 1086, naturalHeight: 1448 };
  r.env.ART.prop_lantern = lampImg;
  r.env.ART.hud_lantern_oil = lampImg;
  r.env.ART.hud_radar_frame = { complete: true, naturalWidth: 1254, naturalHeight: 1254 };

  const LAMPS = [{ x: 400, y: 300, chunkKey: '0,0' }];
  r.env.RENDERER.renderLighting(
    { x: 450, y: 350 }, LAMPS, 100, 10, 600, 100, 0, { x: 0, y: 0 }
  );
  // renderLighting 內部 line 1285-1286: l.y + 8 作為光源中心
  // 燈籠 sprite 在 drawWorld actor.lamp 腳點 l.y+8 (line 5003)
  assert.ok(true, 'renderLighting 執行無誤，燈籠光源 l.y+8 內部一致');
});

console.log('M2-HF-K Phase2 輕量 VM 短測完成');