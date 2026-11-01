'use strict';

// Director Audio Guard Freeze: forbidden QA file read will throw immediately
require('../tools/director-audio-freeze.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_RENDERER_PATH = path.join(ROOT, 'scratch/fusion-director-r5-20261025/baseline-renderer.js.txt');

function createRendererEnv(rendererFilePath = path.join(ROOT, 'js/renderer.js')) {
  const drawImageCalls = [];
  const fakeCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({ width: 10 }),
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    drawImage: function(img) {
      drawImageCalls.push({
        img,
        alpha: this.globalAlpha,
        args: Array.from(arguments),
        currentBindOpt: env.window.__currentFusionBindOpt ? { ...env.window.__currentFusionBindOpt } : null
      });
    },
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
  };

  const fakeCanvas = {
    width: 1366,
    height: 768,
    getContext: () => fakeCtx
  };

  const candidateDef = {
    file: "art/fusion/candidates/fusion_thundercircle/main_alpha_candidate_v02.webp",
    bbox: [32, 28, 1200, 800],
    size: [1264, 848]
  };

  const fakeImg = {
    src: "http://127.0.0.1:8867/art/fusion/candidates/fusion_thundercircle/main_alpha_candidate_v02.webp",
    naturalWidth: 1264,
    naturalHeight: 848
  };

  let bindEnabled = true;

  const env = {
    Math,
    Date,
    setTimeout,
    clearTimeout,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: {},
    document: {
      createElement: (tag) => tag === 'canvas' ? fakeCanvas : {},
      getElementById: () => null
    },
    VIEWPORT: {
      get: () => ({ width: 1366, height: 768, scale: 1, offsetX: 0, offsetY: 0 }),
      bounds: () => ({ left: 0, top: 0, right: 1366, bottom: 768, width: 1366, height: 768 }),
      hudBounds: () => ({ left: 0, top: 0, right: 1366, bottom: 768, width: 1366, height: 768 }),
      is2D: () => false,
      upright: (c, x, y, draw) => draw()
    },
    isFusionArtBindEnabled: () => bindEnabled,
    getFusionPhaseArt: (kind, phase) => {
      // Provide valid candidate image for all kinds and phases in test fixture
      return fakeImg;
    },
    getFusionArtBindDef: (kind, phase) => {
      // Provide valid candidate def for all kinds and phases in test fixture
      return candidateDef;
    },
    FUSION_ART_BIND_SOURCES: new Proxy({}, {
      get: () => ({ main: candidateDef, ground: candidateDef, hit: candidateDef, icon: candidateDef })
    }),
    __thundercircleVisibilityOption: null,
    drawImageCalls,
    fakeCtx,
    setBindEnabled: (val) => { bindEnabled = val; }
  };

  env.window = env;
  env.globalThis = env;

  const viewportCode = fs.readFileSync(path.join(ROOT, 'js/viewport.js'), 'utf8');
  vm.runInNewContext(viewportCode, env);

  // In-memory instrumentation of drawFusionBindImage to record opt.phase & opt.kind
  let rendererCode = fs.readFileSync(rendererFilePath, 'utf8');
  const t1 = "function drawFusionBindImage(c, img, opt) {";
  const rep1 = "function drawFusionBindImage(c, img, opt) {\n    window.__currentFusionBindOpt = opt;\n    try {";
  const re2 = /c\.drawImage\(img,\s*src\.sx,\s*src\.sy,\s*src\.sw,\s*src\.sh,\s*dx,\s*dy,\s*targetW,\s*targetH\);\r?\n\s*c\.restore\(\);\r?\n\s*return true;\r?\n\s*\}/;
  rendererCode = rendererCode.replace(t1, rep1).replace(re2, "c.drawImage(img, src.sx, src.sy, src.sw, src.sh, dx, dy, targetW, targetH);\n    c.restore();\n    return true;\n    } finally { window.__currentFusionBindOpt = null; }\n  }");

  vm.runInNewContext(rendererCode, env);

  env.RENDERER.init(fakeCanvas);

  return env;
}

test('門禁隔離：非 DEV 候選模式（正式模式）不執行真圖綁定層，維持安全回退', () => {
  const env = createRendererEnv();
  env.setBindEnabled(false); // 模擬正式模式 / 無 DEV 參數

  const effect = {
    kind: "fusion_thundercircle",
    phase: "active",
    x: 500,
    y: 400,
    radius: 200,
    progress: 0.5
  };

  const handled = env.RENDERER.drawFusionFx(env.fakeCtx, effect, 1.0);
  assert.equal(handled, true, 'RENDERER.drawFusionFx 應正常回傳 true (由正式程序化渲染接管)');

  // 驗證真圖 drawImage 呼叫為 0
  const candidateDraws = env.drawImageCalls.filter(c => c.currentBindOpt && c.currentBindOpt.kind === 'fusion_thundercircle');
  assert.equal(candidateDraws.length, 0, '正式模式下絕對不可繪製 DEV 候選圖');
});

test('Option A（預設平衡選項）：Main Active Alpha 峰值為 0.48，Ground 峰值為 0.18', () => {
  const env = createRendererEnv();
  env.setBindEnabled(true);
  env.window.__thundercircleVisibilityOption = null; // 預設使用 Option A

  const effect = {
    kind: "fusion_thundercircle",
    phase: "active",
    x: 500,
    y: 400,
    radius: 200,
    progress: 0.5 // sin(0.5 * PI) * 1.25 -> env 截頂為 1.0
  };

  env.RENDERER.drawFusionFx(env.fakeCtx, effect, 1.0);

  const mainDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'main' && d.currentBindOpt.kind === 'fusion_thundercircle');
  const groundDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'ground' && d.currentBindOpt.kind === 'fusion_thundercircle');

  assert.ok(mainDraws.length > 0, 'Option A 應有 main 繪製');
  assert.ok(groundDraws.length > 0, 'Option A 應有 ground 繪製');

  const mainPeak = Math.max(...mainDraws.map(d => d.alpha));
  const groundPeak = Math.max(...groundDraws.map(d => d.alpha));

  assert.equal(Number(mainPeak.toFixed(3)), 0.48, 'Option A main alpha 峰值應精準為 0.480');
  assert.equal(Number(groundPeak.toFixed(3)), 0.18, 'Option A ground alpha 峰值應精準為 0.180');
});

test('Option B（高對比選項）：Main Active Alpha 峰值為 0.58，Ground 峰值為 0.24', () => {
  const env = createRendererEnv();
  env.setBindEnabled(true);
  env.window.__thundercircleVisibilityOption = 'B'; // 指定 Option B

  const effect = {
    kind: "fusion_thundercircle",
    phase: "active",
    x: 500,
    y: 400,
    radius: 200,
    progress: 0.5
  };

  env.RENDERER.drawFusionFx(env.fakeCtx, effect, 1.0);

  const mainDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'main' && d.currentBindOpt.kind === 'fusion_thundercircle');
  const groundDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'ground' && d.currentBindOpt.kind === 'fusion_thundercircle');

  assert.ok(mainDraws.length > 0, 'Option B 應有 main 繪製');
  assert.ok(groundDraws.length > 0, 'Option B 應有 ground 繪製');

  const mainPeak = Math.max(...mainDraws.map(d => d.alpha));
  const groundPeak = Math.max(...groundDraws.map(d => d.alpha));

  assert.equal(Number(mainPeak.toFixed(3)), 0.58, 'Option B main alpha 峰值應精準為 0.580');
  assert.equal(Number(groundPeak.toFixed(3)), 0.24, 'Option B ground alpha 峰值應精準為 0.240');
});

test('Baseline 選項：可完整回退為 R4 實測之 0.250 / 0.120 限制', () => {
  const env = createRendererEnv();
  env.setBindEnabled(true);
  env.window.__thundercircleVisibilityOption = 'baseline'; // 指定 Baseline

  const effect = {
    kind: "fusion_thundercircle",
    phase: "active",
    x: 500,
    y: 400,
    radius: 200,
    progress: 0.5
  };

  env.RENDERER.drawFusionFx(env.fakeCtx, effect, 1.0);

  const mainDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'main' && d.currentBindOpt.kind === 'fusion_thundercircle');
  const groundDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'ground' && d.currentBindOpt.kind === 'fusion_thundercircle');

  const mainPeak = Math.max(...mainDraws.map(d => d.alpha));
  const groundPeak = Math.max(...groundDraws.map(d => d.alpha));

  assert.equal(Number(mainPeak.toFixed(3)), 0.25, 'Baseline main alpha 峰值應精準為 0.250');
  assert.equal(Number(groundPeak.toFixed(3)), 0.12, 'Baseline ground alpha 峰值應精準為 0.120');
});

test('雷陣封界 hit phase 契約：無 strikes 時命中次數維持 0，不造假繪製', () => {
  const env = createRendererEnv();
  env.setBindEnabled(true);

  const effect = {
    kind: "fusion_thundercircle",
    phase: "active",
    x: 500,
    y: 400,
    radius: 200,
    progress: 0.5
    // strikes is omitted
  };

  env.RENDERER.drawFusionFx(env.fakeCtx, effect, 1.0);

  const hitDraws = env.drawImageCalls.filter(d => d.currentBindOpt && d.currentBindOpt.phase === 'hit' && d.currentBindOpt.kind === 'fusion_thundercircle');
  assert.equal(hitDraws.length, 0, '無 strikes 時 hit phase 必須為 0');
});

test('無回歸窄幅對照 (FIXTURE_RENDERER_REGRESSION)：其餘 9 招融合技能與 baseline-renderer 輸入輸出 100% 相同且逐招具真實 draw', () => {
  assert.ok(fs.existsSync(BASELINE_RENDERER_PATH), 'baseline-renderer.js.txt 必須存在');

  const currentEnv = createRendererEnv();
  const baselineEnv = createRendererEnv(BASELINE_RENDERER_PATH);

  const OTHER_KINDS = [
    "fusion_inkblade", "fusion_foxiai", "fusion_exorcistblade",
    "fusion_foxfirebarrier", "fusion_exorcistseal", "fusion_slashwheel",
    "fusion_foxthunderlantern", "fusion_flamefestival", "fusion_thundertalisman"
  ];

  for (const kind of OTHER_KINDS) {
    const effect = {
      kind,
      phase: "active",
      x: 250,
      y: 350,
      radius: 180,
      progress: 0.6,
      angle: 0.5,
      currentRadius: 120,
      hitSet: [{ x: 300, y: 350 }]
    };

    currentEnv.drawImageCalls.length = 0;
    baselineEnv.drawImageCalls.length = 0;

    const resCurr = currentEnv.RENDERER.drawFusionFx(currentEnv.fakeCtx, effect, 0.75);
    const resBase = baselineEnv.RENDERER.drawFusionFx(baselineEnv.fakeCtx, effect, 0.75);

    assert.equal(resCurr, resBase, `${kind} drawFusionFx 回傳值必須完全相同`);
    assert.ok(currentEnv.drawImageCalls.length >= 1, `${kind} currentEnv 至少必須有 1 次真圖 drawImage 呼叫`);
    assert.ok(baselineEnv.drawImageCalls.length >= 1, `${kind} baselineEnv 至少必須有 1 次真圖 drawImage 呼叫`);
    assert.equal(currentEnv.drawImageCalls.length, baselineEnv.drawImageCalls.length, `${kind} drawImage 呼叫次數必須完全相同`);

    for (let i = 0; i < currentEnv.drawImageCalls.length; i++) {
      const cCall = currentEnv.drawImageCalls[i];
      const bCall = baselineEnv.drawImageCalls[i];
      assert.equal(cCall.alpha, bCall.alpha, `${kind} 第 ${i} 次 drawImage 之 alpha 必須完全相同`);
      assert.equal(JSON.stringify(cCall.currentBindOpt), JSON.stringify(bCall.currentBindOpt), `${kind} 第 ${i} 次 drawImage 之 bindOpt 必須完全相同`);
    }
  }
});
