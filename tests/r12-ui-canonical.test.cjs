'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const uiCode = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');

function createMockCtx() {
  const calls = [];
  return {
    calls,
    save: () => calls.push({ method: 'save' }),
    restore: () => calls.push({ method: 'restore' }),
    translate: (...args) => calls.push({ method: 'translate', args }),
    rotate: (...args) => calls.push({ method: 'rotate', args }),
    scale: (...args) => calls.push({ method: 'scale', args }),
    beginPath: () => calls.push({ method: 'beginPath' }),
    closePath: () => calls.push({ method: 'closePath' }),
    moveTo: (...args) => calls.push({ method: 'moveTo', args }),
    lineTo: (...args) => calls.push({ method: 'lineTo', args }),
    quadraticCurveTo: (...args) => calls.push({ method: 'quadraticCurveTo', args }),
    bezierCurveTo: (...args) => calls.push({ method: 'bezierCurveTo', args }),
    arc: (...args) => calls.push({ method: 'arc', args }),
    ellipse: (...args) => calls.push({ method: 'ellipse', args }),
    fill: () => calls.push({ method: 'fill' }),
    stroke: () => calls.push({ method: 'stroke' }),
    fillRect: (...args) => calls.push({ method: 'fillRect', args }),
    strokeRect: (...args) => calls.push({ method: 'strokeRect', args }),
    clearRect: (...args) => calls.push({ method: 'clearRect', args }),
    drawImage: (...args) => calls.push({ method: 'drawImage', args }),
    fillText: (...args) => calls.push({ method: 'fillText', args }),
    strokeText: (...args) => calls.push({ method: 'strokeText', args }),
    measureText: (txt) => ({ width: String(txt).length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }),
    roundRect: (...args) => calls.push({ method: 'roundRect', args }),
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
}

function createUiEnv(options = {}) {
  const { isBindEnabled = false, bindImages = {} } = options;
  const spyCalls = {
    getFusionPhaseArt: [],
    getFusionArtBindDef: [],
    isFusionArtBindEnabled: []
  };

  const mockWindow = {
    innerWidth: 1366,
    innerHeight: 768,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    VIEWPORT: {
      get: () => ({ width: 900, height: 600, scale: 1, offsetX: 0, offsetY: 0 }),
      bounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
      hudBounds: () => ({ left: 20, top: 20, right: 880, bottom: 580, width: 860, height: 560 })
    },
    isFusionArtBindEnabled: () => {
      spyCalls.isFusionArtBindEnabled.push(true);
      return isBindEnabled;
    },
    getFusionPhaseArt: (kind, phase) => {
      spyCalls.getFusionPhaseArt.push({ kind, phase });
      return bindImages[`${kind}_${phase}`] || null;
    },
    getFusionArtBindDef: (kind, phase) => {
      spyCalls.getFusionArtBindDef.push({ kind, phase });
      if (kind === 'fusion_exorcistblade') {
        return {
          file: 'art/fusion/candidates/fusion_exorcistblade/main_alpha_candidate_v02.webp',
          sha256: 'abc',
          size: [1264, 848],
          bbox: [0, 0, 1264, 848],
          fallback: false
        };
      }
      return null;
    }
  };

  const mockDocument = {
    getElementById: () => null,
    fonts: { check: () => true, load: () => Promise.resolve() }
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
    document: mockDocument,
    console,
    Math,
    Date,
    Object,
    Array,
    String,
    URLSearchParams,
    location: { search: isBindEnabled ? '?dev=1&stage=rain-port&fusioncandidate=1&fusionart=banana' : '' }
  });

  vm.runInContext(uiCode, context);
  return { UI: mockWindow.UI, spyCalls, mockWindow };
}

test('R12-B3: In public mode (non-dev), UI strictly uses vector geometry fallback and performs zero image calls', () => {
  const { UI, spyCalls } = createUiEnv({ isBindEnabled: false });

  const ctx = createMockCtx();
  UI.drawFusionIcon(ctx, 'fusion_inkblade', 100, 100, 20);

  // Must NOT draw any image in public mode
  const drawImageCalls = ctx.calls.filter(c => c.method === 'drawImage');
  assert.equal(drawImageCalls.length, 0, 'Public mode must make ZERO drawImage calls');

  // Must call vector emblem geometry
  const arcCalls = ctx.calls.filter(c => c.method === 'arc');
  assert.ok(arcCalls.length >= 1, 'Must use vector emblem fallback');

  // getFusionAsset in public mode must return null
  assert.equal(UI.getFusionAsset ? UI.getFusionAsset('fusion_inkblade', 'main') : null, null);
});

test('R12-B3: In authorized DEV mode, UI delegates exclusively to shared window.getFusionPhaseArt', () => {
  const fakeImg = { naturalWidth: 256, naturalHeight: 256, src: 'mock_icon.webp' };
  const { UI, spyCalls } = createUiEnv({
    isBindEnabled: true,
    bindImages: {
      fusion_exorcistblade_icon: fakeImg
    }
  });

  const ctx = createMockCtx();
  UI.drawFusionIcon(ctx, 'fusion_exorcistblade', 100, 100, 20);

  // Must have called shared getFusionPhaseArt
  assert.ok(spyCalls.getFusionPhaseArt.some(c => c.kind === 'fusion_exorcistblade' && c.phase === 'icon'),
    'Must query shared getFusionPhaseArt accessor for icon');

  // Must have drawn the image provided by shared accessor
  const drawImageCalls = ctx.calls.filter(c => c.method === 'drawImage');
  assert.equal(drawImageCalls.length, 1, 'Must call drawImage with shared image');
  assert.equal(drawImageCalls[0].args[0], fakeImg);
});

test('R12-B3: Unknown recipes in DEV mode safely fall back to vector emblem with zero image draws', () => {
  const { UI, spyCalls } = createUiEnv({ isBindEnabled: true, bindImages: {} });

  const ctx = createMockCtx();
  UI.drawFusionIcon(ctx, 'fusion_unknown_fake', 100, 100, 20);

  const drawImageCalls = ctx.calls.filter(c => c.method === 'drawImage');
  assert.equal(drawImageCalls.length, 0, 'Unknown recipe must not drawImage');

  const arcCalls = ctx.calls.filter(c => c.method === 'arc');
  assert.ok(arcCalls.length >= 1, 'Unknown recipe must safely fall back to vector geometry');
});

test('R12-B3: UI source code has ZERO private FUSION_CANDIDATE_IMAGES allocations or FUSION_CANDIDATES tables', () => {
  assert.ok(!uiCode.includes('FUSION_CANDIDATE_IMAGES = Object.create(null)'), 'Must not create private Image cache');
  assert.ok(!uiCode.includes('const FUSION_CANDIDATES = {'), 'Must not have hardcoded FUSION_CANDIDATES table');
  assert.ok(!uiCode.includes('img.src = `art/fusion/candidates/'), 'Must not load candidate Image directly in UI');
  assert.ok(uiCode.includes('window.getFusionPhaseArt'), 'Must reference shared getFusionPhaseArt');
  assert.ok(uiCode.includes('window.isFusionArtBindEnabled'), 'Must reference shared isFusionArtBindEnabled');
});
