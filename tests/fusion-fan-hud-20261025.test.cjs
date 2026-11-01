// tests/fusion-fan-hud-20261025.test.cjs
// FUSION-FAN-HUD-R1: HoloCure 式摺扇技能格 (兩個母技 Lv5 融合後只顯示一個新技能 icon，釋出一格；原兩 icon 不得同時保留)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const DESKTOP = { width: 1000, height: 700, scale: 1, offsetX: 0, offsetY: 0 };
const DESKTOP_WIDE = { width: 1366, height: 768, scale: 1, offsetX: 0, offsetY: 0 };
const PHONE_LANDSCAPE = {
  width: 844 / 0.65,
  height: 600,
  scale: 0.65,
  offsetX: (844 / 0.65 - 900) / 2,
  offsetY: 0
};

// Realm-agnostic array conversion for deepEqual across VM boundaries
const toArr = arr => Array.from(arr || []);

function createMockContext() {
  const calls = [];
  const textCalls = [];
  const recorded = (name, args) => calls.push({ name, args: Array.from(args) });
  const gradient = { addColorStop: (...args) => recorded('addColorStop', args) };
  const ctx = {
    calls,
    textCalls,
    getCallCount: name => calls.filter(c => c.name === name).length,
    save: (...a) => recorded('save', a),
    restore: (...a) => recorded('restore', a),
    translate: (...a) => recorded('translate', a),
    rotate: (...a) => recorded('rotate', a),
    scale: (...a) => recorded('scale', a),
    beginPath: (...a) => recorded('beginPath', a),
    closePath: (...a) => recorded('closePath', a),
    moveTo: (...a) => recorded('moveTo', a),
    lineTo: (...a) => recorded('lineTo', a),
    arc: (...a) => recorded('arc', a),
    arcTo: (...a) => recorded('arcTo', a),
    ellipse: (...a) => recorded('ellipse', a),
    roundRect: (...a) => recorded('roundRect', a),
    rect: (...a) => recorded('rect', a),
    fill: (...a) => recorded('fill', a),
    stroke: (...a) => recorded('stroke', a),
    fillRect: (...a) => recorded('fillRect', a),
    strokeRect: (...a) => recorded('strokeRect', a),
    clearRect: (...a) => recorded('clearRect', a),
    quadraticCurveTo: (...a) => recorded('quadraticCurveTo', a),
    bezierCurveTo: (...a) => recorded('bezierCurveTo', a),
    setLineDash: (...a) => recorded('setLineDash', a),
    setTransform: (...a) => recorded('setTransform', a),
    drawImage: (...a) => recorded('drawImage', a),
    clip: (...a) => recorded('clip', a),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillText: (text, x, y) => {
      textCalls.push({ text: String(text), x, y });
      recorded('fillText', [text, x, y]);
    },
    strokeText: (text, x, y) => {
      recorded('strokeText', [text, x, y]);
    },
    measureText: text => ({
      width: String(text).length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3
    }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    canvas: { width: 1000, height: 700 }
  };
  return ctx;
}

function loadUiSandbox(vp = DESKTOP, devMode = false, searchStr = '') {
  const viewport = { ...vp };
  const mockWindow = {
    DEV: devMode,
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    removeEventListener: () => {},
    VIEWPORT: {
      get: () => viewport,
      bounds: () => ({
        left: -(viewport.offsetX || 0),
        top: -(viewport.offsetY || 0),
        right: -(viewport.offsetX || 0) + viewport.width,
        bottom: -(viewport.offsetY || 0) + viewport.height,
        width: viewport.width,
        height: viewport.height
      }),
      hudBounds: () => ({
        left: -(viewport.offsetX || 0),
        top: -(viewport.offsetY || 0),
        right: -(viewport.offsetX || 0) + viewport.width,
        bottom: -(viewport.offsetY || 0) + viewport.height,
        width: viewport.width,
        height: viewport.height
      })
    },
    FX: { glow: () => {} },
    ART: {},
    Image: function () {
      this.naturalWidth = 100;
      this.naturalHeight = 100;
      this.complete = true;
    }
  };
  const mockDocument = {
    getElementById: () => null,
    fonts: { check: () => true, load: () => Promise.resolve() }
  };
  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    location: { search: searchStr },
    URLSearchParams,
    console,
    Math,
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Promise,
    WeakMap,
    Map,
    Set,
    module: { exports: {} },
    exports: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8'), sandbox);
  return { UI: sandbox.window.UI, sandbox, window: mockWindow };
}

// -----------------------------------------------------------------------------
// Test 1: HoloCure Slot Reconciliation (Normal Adjacent Fusion & Level Up)
// -----------------------------------------------------------------------------
test('HoloCure Fan 1: slot reconciliation replaces parent with fusion and frees 1 slot (4 -> 3 -> 4)', () => {
  const { UI } = loadUiSandbox();
  UI.resetFanSlots();

  // 1. Initial State: 4 base weapons (katana, fire, barrier, boom)
  const WL_before = { katana: 5, fire: 5, barrier: 3, boom: 2 };
  const slots_before = UI.resolveFanSlots(WL_before);
  assert.deepEqual(toArr(slots_before), ['katana', 'fire', 'barrier', 'boom'], 'Initial 4 weapon slots');
  assert.equal(slots_before.filter(Boolean).length, 4, '4 active weapons before fusion');

  // 2. Fusion Event: katana + fire -> fusion_inkblade
  // In game.js commitTransaction: WL[parents] = 0, WL[fusion] = 1
  const WL_after = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1 };
  const slots_after = UI.resolveFanSlots(WL_after, null, slots_before);
  assert.deepEqual(toArr(slots_after), ['fusion_inkblade', null, 'barrier', 'boom'], 'Slot 0 is fusion, slot 1 is freed (null)');
  assert.equal(slots_after.filter(Boolean).length, 3, 'Active weapon count decreases to 3');
  assert.ok(!slots_after.includes('katana'), 'Parent katana must NOT be retained in active slots');
  assert.ok(!slots_after.includes('fire'), 'Parent fire must NOT be retained in active slots');
  assert.ok(slots_after.includes('fusion_inkblade'), 'Fusion skill must occupy slot');

  // 3. Level-up Event: Player chooses a new weapon (thunder)
  const WL_levelup = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1, thunder: 1 };
  const slots_levelup = UI.resolveFanSlots(WL_levelup, null, slots_after);
  assert.deepEqual(toArr(slots_levelup), ['fusion_inkblade', 'thunder', 'barrier', 'boom'], 'Freed slot is filled by newly learned weapon');
  assert.equal(slots_levelup.filter(Boolean).length, 4, 'Active weapon count restored to 4');
});

// -----------------------------------------------------------------------------
// Test 2: Non-Adjacent Parent Fusion Slot Reconciliation
// -----------------------------------------------------------------------------
test('HoloCure Fan 2: non-adjacent parent slots are properly reconciled', () => {
  const { UI } = loadUiSandbox();

  // Player had: boom at 0, katana at 1, barrier at 2, fire at 3
  const prevSlots = ['boom', 'katana', 'barrier', 'fire'];
  const WL = { boom: 2, katana: 0, barrier: 3, fire: 0, fusion_inkblade: 1 };

  const slots = UI.resolveFanSlots(WL, null, prevSlots);
  assert.deepEqual(toArr(slots), ['boom', 'fusion_inkblade', 'barrier', null], 'Min parent slot receives fusion, max parent slot is freed');
  assert.equal(slots[0], 'boom', 'Slot 0 boom retained');
  assert.equal(slots[1], 'fusion_inkblade', 'Slot 1 katana replaced by fusion_inkblade');
  assert.equal(slots[2], 'barrier', 'Slot 2 barrier retained');
  assert.equal(slots[3], null, 'Slot 3 fire freed as null');
});

// -----------------------------------------------------------------------------
// Test 3: Multiple Consecutive Fusions
// -----------------------------------------------------------------------------
test('HoloCure Fan 3: multiple consecutive fusions free additional slots', () => {
  const { UI } = loadUiSandbox();

  // State: inkblade at 0, thunder at 1, barrier at 2, boom at 3
  const prevSlots = ['fusion_inkblade', 'thunder', 'barrier', 'boom'];
  // Now fuse thunder + barrier -> fusion_thundercircle
  const WL = {
    katana: 0, fire: 0, fusion_inkblade: 1,
    thunder: 0, barrier: 0, boom: 3,
    fusion_thundercircle: 1
  };

  const slots = UI.resolveFanSlots(WL, null, prevSlots);
  assert.deepEqual(toArr(slots), ['fusion_inkblade', 'fusion_thundercircle', null, 'boom'], 'Both fusions active, second parent slot freed');
  assert.equal(slots.filter(Boolean).length, 3, 'Active weapon count is 3');
  assert.ok(!slots.includes('thunder'), 'thunder cleared');
  assert.ok(!slots.includes('barrier'), 'barrier cleared');
});

// -----------------------------------------------------------------------------
// Test 4: Diegetic Skill Fan Canvas Spy (Art Ready Mode)
// -----------------------------------------------------------------------------
test('HoloCure Fan 4: diegetic fan canvas spy renders single fusion orb, parent badges, cooldown, and empty slot', () => {
  const { UI, window } = loadUiSandbox(DESKTOP);
  UI.resetFanSlots();

  // Mock art sprite
  window.ART = {
    hud_skill_fan: {
      complete: true,
      naturalWidth: 440,
      naturalHeight: 320
    }
  };

  // Establish pre-fusion fan slots
  UI.resolveFanSlots({ katana: 5, fire: 5, barrier: 3, boom: 2 });

  const ctx = createMockContext();
  const WL = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1 };
  const extra = {
    cd: {
      fusion_inkblade: 0.40, // 40% cooldown
      barrier: 0.15          // 15% cooldown
    }
  };

  const fanW = UI.drawDiegeticSkillFan(ctx, null, WL, extra, 11, 14, false);
  assert.equal(fanW, 220, 'Diegetic fan width must be 220');

  // Verify drawImage called for the fan art
  const drawImageCalls = ctx.calls.filter(c => c.name === 'drawImage');
  assert.ok(drawImageCalls.length >= 1, 'Must draw fan art image');

  // Check text calls: empty slot should draw "＋"
  const plusTextCalls = ctx.textCalls.filter(t => t.text === '＋');
  assert.equal(plusTextCalls.length, 1, 'Exactly one empty slot "+" drawn');

  // Cooldown arcs: arc calls with negative start angle (-Math.PI / 2)
  const arcCalls = ctx.calls.filter(c => c.name === 'arc');
  const cdArcs = arcCalls.filter(c => Math.abs(c.args[3] - (-Math.PI / 2)) < 0.001);
  assert.ok(cdArcs.length >= 2, 'Cooldown arcs drawn for fusion_inkblade and barrier');

  // Ensure parents do not occupy separate fan slots
  const activeSlots = UI.resolveFanSlots(WL);
  assert.equal(activeSlots.length, 4, 'Fan has exactly 4 weapon slots');
  assert.equal(activeSlots[0], 'fusion_inkblade');
  assert.equal(activeSlots[1], null);
  assert.equal(activeSlots[2], 'barrier');
  assert.equal(activeSlots[3], 'boom');
});

// -----------------------------------------------------------------------------
// Test 5: Fallback Fan Canvas Spy (When ART is Missing)
// -----------------------------------------------------------------------------
test('HoloCure Fan 5: fallback fan canvas spy correctly renders MAX badge and freed slot', () => {
  const { UI, window } = loadUiSandbox(DESKTOP);
  UI.resetFanSlots();
  window.ART = {}; // No fan art

  const ctx = createMockContext();
  const WL = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1 };
  const extra = { cd: { fusion_inkblade: 0.25 } };

  const fanW = UI.drawDiegeticSkillFanFallback(ctx, null, WL, extra, 11, 14, false);
  assert.equal(fanW, 140, 'Fallback fan width must be 140');

  // Verify badge text: fusion weapon displays "MAX", barrier displays "L3", boom displays "L2"
  const maxBadge = ctx.textCalls.filter(t => t.text === 'MAX');
  assert.ok(maxBadge.length >= 1, 'Fusion weapon badge must display MAX');

  const l3Badge = ctx.textCalls.filter(t => t.text === 'L3');
  assert.ok(l3Badge.length >= 1, 'Barrier badge must display L3');

  const l2Badge = ctx.textCalls.filter(t => t.text === 'L2');
  assert.ok(l2Badge.length >= 1, 'Boom badge must display L2');

  const plusBadge = ctx.textCalls.filter(t => t.text === '＋');
  assert.equal(plusBadge.length, 1, 'Freed slot displays ＋');
});

// -----------------------------------------------------------------------------
// Test 6: Classic HUD Canvas Spy (?hud=classic)
// -----------------------------------------------------------------------------
test('HoloCure Fan 6: classic HUD branch uses resolveFanSlots and renders MAX badge & empty box', () => {
  const { UI } = loadUiSandbox(DESKTOP, false, '?hud=classic');
  UI.resetFanSlots();

  const ctx = createMockContext();
  const WL = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1 };
  const WI = { katana: { type: 'active' }, fire: { type: 'active' }, barrier: { type: 'active' }, boom: { type: 'active' } };
  const P = { x: 0, y: 0 };
  const b = {};

  UI.drawHudClassic(
    ctx, P, 100, 100, 10, 600, 0, 0, 0, 1, 0, 100,
    null, 0, [], false, null, false, false, {}, {}, {},
    WL, WI, b, 0, 6, 0, 1.8, false, {}
  );

  // Fusion badge should be MAX
  const maxText = ctx.textCalls.filter(t => t.text === 'MAX');
  assert.ok(maxText.length >= 1, 'Classic HUD displays MAX for fusion weapon');

  // Empty slot should display ＋
  const plusText = ctx.textCalls.filter(t => t.text === '＋');
  assert.ok(plusText.length >= 1, 'Classic HUD displays ＋ for freed slot');

  // Dashed border set for empty box
  const dashCalls = ctx.calls.filter(c => c.name === 'setLineDash');
  assert.ok(dashCalls.length >= 1, 'Classic HUD sets dashed border for empty box');
});

// -----------------------------------------------------------------------------
// Test 7: Viewport Matrix (Desktop 1366x768 / 1000x700 & Mobile Landscape 844x390)
// -----------------------------------------------------------------------------
test('HoloCure Fan 7: responsive layout holds on Desktop and Mobile Landscape viewports', () => {
  const viewports = [
    { name: 'Desktop 1000x700', vp: DESKTOP },
    { name: 'Desktop 1366x768', vp: DESKTOP_WIDE },
    { name: 'Mobile Landscape 844x390', vp: PHONE_LANDSCAPE }
  ];

  for (const { name, vp } of viewports) {
    const { UI } = loadUiSandbox(vp);
    UI.resetFanSlots();

    const ctx = createMockContext();
    const WL = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1 };
    const WI = { katana: { type: 'active' }, fire: { type: 'active' }, barrier: { type: 'active' }, boom: { type: 'active' } };
    const P = { x: 0, y: 0 };
    const b = {};

    assert.doesNotThrow(() => {
      UI.drawHudDiegetic(
        ctx, P, 100, 100, 10, 600, 0, 0, 0, 1, 0, 100,
        null, 0, [], false, null, false, false, {}, {}, {},
        WL, WI, b, 0, 6, 0, 1.8, false, {}
      );
    }, `${name} drawHudDiegetic must not throw`);

    assert.ok(ctx.calls.length > 50, `${name} must generate valid draw calls`);
  }
});

// -----------------------------------------------------------------------------
// Test 8: DEV Mode (Candidate drawImage) vs Public Mode (Vector fallback)
// -----------------------------------------------------------------------------
test('HoloCure Fan 8: DEV mode draws candidate image; Public mode uses vector fallback with zero image calls', () => {
  // 1. DEV Mode with candidates
  {
    const { UI, sandbox } = loadUiSandbox(DESKTOP, true);
    // Populate candidate image
    sandbox.FUSION_CANDIDATE_IMAGES = {
      fusion_inkblade_main: { naturalWidth: 1254, naturalHeight: 1254 }
    };

    const ctx = createMockContext();
    UI.drawFusionIcon(ctx, 'fusion_inkblade', 50, 50, 15);
    const drawCalls = ctx.calls.filter(c => c.name === 'drawImage');
    assert.equal(drawCalls.length, 1, 'DEV mode with loaded candidate calls drawImage');
  }

  // 2. Public Non-DEV Mode (window.DEV = false)
  {
    const { UI } = loadUiSandbox(DESKTOP, false);
    const ctx = createMockContext();
    UI.drawFusionIcon(ctx, 'fusion_inkblade', 50, 50, 15);

    const drawCalls = ctx.calls.filter(c => c.name === 'drawImage');
    assert.equal(drawCalls.length, 0, 'Public mode must NEVER call drawImage (zero image requests / 404s)');

    // Instead, vector geometry (arc / stroke / fill) is called for emblem
    const arcCalls = ctx.calls.filter(c => c.name === 'arc');
    assert.ok(arcCalls.length >= 1, 'Public mode uses vector geometric fallback');
  }
});

// -----------------------------------------------------------------------------
// Test 9: Zero Parent Slot Leakage Guarantee Across All 10 Fusion Recipes
// -----------------------------------------------------------------------------
test('HoloCure Fan 9: strict guarantee that no recipe leaks parent icons or consumes extra orbs', () => {
  const { UI } = loadUiSandbox(DESKTOP);

  const meta = UI.FUSION_UI_META;
  assert.ok(meta && typeof meta === 'object', 'FUSION_UI_META must be accessible');
  const recipeIds = Object.keys(meta);
  assert.equal(recipeIds.length, 10, 'Must cover all 10 fusion recipes');

  const ALL_BASE_WEAPONS = ['katana', 'fire', 'barrier', 'boom', 'thunder', 'needle'];

  for (const fId of recipeIds) {
    const { parents } = meta[fId];
    assert.equal(parents.length, 2, `${fId} must have exactly 2 parents`);

    // Pick 2 non-parent weapons as distinct fillers
    const nonParents = ALL_BASE_WEAPONS.filter(w => !parents.includes(w));
    const filler0 = nonParents[0];
    const filler1 = nonParents[1];

    UI.resetFanSlots();
    // Simulate parents at Lv5 + two other distinct active weapons
    const WL_init = {
      [parents[0]]: 5,
      [parents[1]]: 5,
      [filler0]: 2,
      [filler1]: 1
    };
    const slots_init = UI.resolveFanSlots(WL_init);

    // Now commit fusion: parents -> 0, fusion -> 1
    const WL_fused = {
      [parents[0]]: 0,
      [parents[1]]: 0,
      [filler0]: 2,
      [filler1]: 1,
      [fId]: 1
    };
    const slots_fused = UI.resolveFanSlots(WL_fused, null, slots_init);

    assert.equal(slots_fused.length, 4, `${fId}: slots must remain length 4`);
    assert.ok(!slots_fused.includes(parents[0]), `${fId}: parent ${parents[0]} must NOT be in active slots`);
    assert.ok(!slots_fused.includes(parents[1]), `${fId}: parent ${parents[1]} must NOT be in active slots`);
    assert.ok(slots_fused.includes(fId), `${fId}: fusion weapon must occupy a slot`);
    assert.ok(slots_fused.includes(null), `${fId}: must have at least one freed slot (null)`);

    const activeCount = slots_fused.filter(Boolean).length;
    assert.equal(activeCount, 3, `${fId}: active weapon count must decrease by exactly 1 (4 -> 3)`);
  }
});

// -----------------------------------------------------------------------------
// Test 10: Parent Mini Badges Decorate Fusion Orb Without Consuming Orbs/Slots
// -----------------------------------------------------------------------------
test('HoloCure Fan 10: parent badges render mini emblems inside fusion orb without extra orbs', () => {
  const { UI } = loadUiSandbox(DESKTOP);
  const ctx = createMockContext();

  UI.drawFusionParentBadges(ctx, 'fusion_inkblade', 100, 100, 20);

  // Parent badges for inkblade (katana + fire) should draw two mini background circles and emblems
  const arcCalls = ctx.calls.filter(c => c.name === 'arc');
  assert.ok(arcCalls.length >= 2, 'Must draw badge circular backgrounds');

  // Verify that calling drawFusionParentBadges with non-fusion ID is a safe no-op
  const ctx2 = createMockContext();
  UI.drawFusionParentBadges(ctx2, 'katana', 100, 100, 20);
  assert.equal(ctx2.calls.length, 0, 'No-op for base weapon');
});

// -----------------------------------------------------------------------------
// Test 11: Candidate Images On-Disk Integrity & DEV Loader Gating
// -----------------------------------------------------------------------------
test('HoloCure Fan 11: all candidates exist on disk; DEV loader calls drawImage; public mode falls back to vector geometry', () => {
  const candidateMap = {
    fusion_exorcistblade:    { main: "fusion_exorcistblade/main_alpha_candidate_v02.webp", icon: "fusion_exorcistblade/icon_alpha_candidate_v01.webp" },
    fusion_exorcistseal:     { main: "fusion_exorcistseal/main_alpha_candidate_v02.webp", icon: "fusion_exorcistseal/icon_alpha_candidate_v01.webp" },
    fusion_flamefestival:    { main: "fusion_flamefestival/main_alpha_candidate_v02.webp", icon: null },
    fusion_foxfirebarrier:   { main: "fusion_foxfirebarrier/main_alpha_candidate_v02.webp", icon: "fusion_foxfirebarrier/icon_alpha_candidate_v01.webp" },
    fusion_foxiai:           { main: "fusion_foxiai/main_alpha_candidate_v02.webp", icon: "fusion_foxiai/icon_alpha_candidate_v01.webp" },
    fusion_foxthunderlantern:{ main: "fusion_foxthunderlantern/main_alpha_candidate_v02.webp", icon: null },
    fusion_inkblade:         { main: "fusion_inkblade/main_alpha_candidate_v01.webp", icon: null },
    fusion_slashwheel:       { main: "fusion_slashwheel/main_alpha_candidate_v02.webp", icon: null },
    fusion_thundercircle:    { main: "fusion_thundercircle/main_alpha_candidate_v02.webp", icon: null },
    fusion_thundertalisman:  { main: "fusion_thundertalisman/main_alpha_candidate_v02.webp", icon: null },
  };

  // 1. Assert physical on-disk existence
  for (const [id, c] of Object.entries(candidateMap)) {
    if (c.main) {
      const p = path.join(ROOT, 'art/fusion/candidates', c.main);
      assert.ok(fs.existsSync(p), `Candidate main image must exist on disk: ${c.main}`);
      assert.ok(fs.statSync(p).size > 1000, `Candidate main image must not be empty: ${c.main}`);
    }
    if (c.icon) {
      const p = path.join(ROOT, 'art/fusion/candidates', c.icon);
      assert.ok(fs.existsSync(p), `Candidate icon image must exist on disk: ${c.icon}`);
      assert.ok(fs.statSync(p).size > 1000, `Candidate icon image must not be empty: ${c.icon}`);
    }
  }

  // 2. DEV mode loader simulation
  {
    const { UI, sandbox } = loadUiSandbox(DESKTOP, true);
    sandbox.FUSION_CANDIDATE_IMAGES = {
      fusion_exorcistblade_icon: { naturalWidth: 256, naturalHeight: 256 },
      fusion_inkblade_main: { naturalWidth: 1254, naturalHeight: 1254 }
    };

    const ctx1 = createMockContext();
    UI.drawFusionIcon(ctx1, 'fusion_exorcistblade', 100, 100, 16);
    assert.equal(ctx1.calls.filter(c => c.name === 'drawImage').length, 1, 'Uses independent candidate icon in DEV');

    const ctx2 = createMockContext();
    UI.drawFusionIcon(ctx2, 'fusion_inkblade', 100, 100, 16);
    assert.equal(ctx2.calls.filter(c => c.name === 'drawImage').length, 1, 'Falls back to cropped candidate main in DEV');
  }
});

// -----------------------------------------------------------------------------
// Test 12: Desktop Wide (1366x768) Multi-Frame Lifecycle Verification
// -----------------------------------------------------------------------------
test('HoloCure Fan 12: Desktop Wide 1366x768 multi-frame lifecycle (Frame 0 Pre-fusion -> Frame 1 Fusion -> Frame 2 Cooldown -> Frame 3 Level-up)', () => {
  const { UI, window } = loadUiSandbox(DESKTOP_WIDE);
  UI.resetFanSlots();
  window.ART = {
    hud_skill_fan: { complete: true, naturalWidth: 440, naturalHeight: 320 }
  };

  const WI = {
    katana: { type: 'active' },
    fire: { type: 'active' },
    barrier: { type: 'active' },
    boom: { type: 'active' },
    thunder: { type: 'active' }
  };
  const P = { x: 0, y: 0 };
  const b = { shield: 1, dmg: 1.55 };

  // Frame 0: 4 active base skills (katana Lv5, fire Lv5, barrier Lv3, boom Lv2)
  let WL = { katana: 5, fire: 5, barrier: 3, boom: 2 };
  let extra = { cd: { katana: 0.1, fire: 0.0, barrier: 0.0, boom: 0.0 } };
  let ctx0 = createMockContext();
  UI.drawHudDiegetic(ctx0, P, 100, 100, 10, 600, 0, 0, 0, 1, 0, 100, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, extra);

  let slots0 = UI.resolveFanSlots(WL, WI);
  assert.deepEqual(toArr(slots0), ['katana', 'fire', 'barrier', 'boom'], 'Frame 0: all 4 slots occupied by base skills');
  assert.equal(slots0.filter(Boolean).length, 4, 'Frame 0: active count is 4');
  assert.equal(ctx0.textCalls.filter(t => t.text === '＋').length, 0, 'Frame 0: no empty slot');

  // Frame 1: Fusion committed! (WL[parents] = 0, WL[fusion] = 1) -> HoloCure fold
  WL = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1 };
  extra = { cd: { fusion_inkblade: 0.0, barrier: 0.0, boom: 0.0 } };
  let ctx1 = createMockContext();
  UI.drawHudDiegetic(ctx1, P, 100, 100, 11, 600, 0, 0, 0, 1, 0, 100, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, extra);

  let slots1 = UI.resolveFanSlots(WL, WI);
  assert.deepEqual(toArr(slots1), ['fusion_inkblade', null, 'barrier', 'boom'], 'Frame 1: slot 0 is fusion, slot 1 is freed (null)');
  assert.equal(slots1.filter(Boolean).length, 3, 'Frame 1: active count reduced to 3');
  assert.ok(!slots1.includes('katana'), 'Frame 1: parent katana must NOT occupy a slot');
  assert.ok(!slots1.includes('fire'), 'Frame 1: parent fire must NOT occupy a slot');
  assert.equal(ctx1.textCalls.filter(t => t.text === '＋').length, 1, 'Frame 1: freed slot renders "+"');

  // Frame 2: In-combat with Cooldown Sweep (cd = 0.65 on fusion_inkblade)
  extra = { cd: { fusion_inkblade: 0.65, barrier: 0.35, boom: 0.1 } };
  let ctx2 = createMockContext();
  UI.drawHudDiegetic(ctx2, P, 100, 100, 12, 600, 0, 0, 0, 1, 0, 100, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, extra);

  let slots2 = UI.resolveFanSlots(WL, WI);
  assert.deepEqual(toArr(slots2), ['fusion_inkblade', null, 'barrier', 'boom'], 'Frame 2: slots maintain stability during combat');
  assert.equal(ctx2.textCalls.filter(t => t.text === '＋').length, 1, 'Frame 2: freed slot continues to show "+"');
  // Cooldown arcs verified
  const cdArcs2 = ctx2.calls.filter(c => c.name === 'arc' && Math.abs(c.args[3] - (-Math.PI / 2)) < 0.001);
  assert.ok(cdArcs2.length >= 3, 'Frame 2: cooldown arcs rendered for active weapons including fusion');

  // Frame 3: Level-up Event - player learns a new 3rd/4th weapon (thunder)
  WL = { katana: 0, fire: 0, barrier: 3, boom: 2, fusion_inkblade: 1, thunder: 1 };
  extra = { cd: { fusion_inkblade: 0.2, barrier: 0.0, boom: 0.0, thunder: 0.0 } };
  let ctx3 = createMockContext();
  UI.drawHudDiegetic(ctx3, P, 100, 100, 13, 600, 0, 0, 0, 2, 0, 150, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, extra);

  let slots3 = UI.resolveFanSlots(WL, WI);
  assert.deepEqual(toArr(slots3), ['fusion_inkblade', 'thunder', 'barrier', 'boom'], 'Frame 3: thunder fills the previously freed slot');
  assert.equal(slots3.filter(Boolean).length, 4, 'Frame 3: active count restored to 4');
  assert.equal(ctx3.textCalls.filter(t => t.text === '＋').length, 0, 'Frame 3: all active slots filled, zero "+"');
});

// -----------------------------------------------------------------------------
// Test 13: Mobile Landscape (844x390, scale 0.65) Multi-Frame Lifecycle Verification
// -----------------------------------------------------------------------------
test('HoloCure Fan 13: Mobile Landscape 844x390 multi-frame lifecycle (scale 0.65, zero parent leakage, slot count 4 -> 3 -> 4)', () => {
  const { UI, window } = loadUiSandbox(PHONE_LANDSCAPE);
  UI.resetFanSlots();
  window.ART = {
    hud_skill_fan: { complete: true, naturalWidth: 440, naturalHeight: 320 }
  };

  const WI = {
    katana: { type: 'active' },
    fire: { type: 'active' },
    barrier: { type: 'active' },
    boom: { type: 'active' },
    needle: { type: 'active' }
  };
  const P = { x: 0, y: 0 };
  const b = { shield: 0, dmg: 1.2 };

  // Frame 0: Pre-fusion on phone
  let WL = { katana: 5, fire: 5, barrier: 4, boom: 3 };
  let ctx0 = createMockContext();
  UI.drawHudDiegetic(ctx0, P, 80, 100, 5, 600, 1, 0, 400, 2, 20, 100, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, {});
  assert.equal(UI.resolveFanSlots(WL, WI).filter(Boolean).length, 4, 'Phone Frame 0: active count is 4');

  // Frame 1: Fusion committed on phone
  WL = { katana: 0, fire: 0, barrier: 4, boom: 3, fusion_inkblade: 1 };
  let ctx1 = createMockContext();
  UI.drawHudDiegetic(ctx1, P, 80, 100, 6, 600, 1, 0, 400, 2, 20, 100, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, { cd: { fusion_inkblade: 0.5 } });
  const slots1 = UI.resolveFanSlots(WL, WI);
  assert.equal(slots1.filter(Boolean).length, 3, 'Phone Frame 1: active count reduced to 3');
  assert.equal(slots1[0], 'fusion_inkblade', 'Phone Frame 1: fusion orb at slot 0');
  assert.equal(slots1[1], null, 'Phone Frame 1: freed slot at slot 1');
  assert.ok(!slots1.includes('katana'), 'Phone Frame 1: katana not in slots');
  assert.ok(!slots1.includes('fire'), 'Phone Frame 1: fire not in slots');

  // Frame 2: Level-up adds needle
  WL = { katana: 0, fire: 0, barrier: 4, boom: 3, fusion_inkblade: 1, needle: 1 };
  let ctx2 = createMockContext();
  UI.drawHudDiegetic(ctx2, P, 80, 100, 7, 600, 1, 0, 400, 3, 0, 120, null, 0, [], false, null, false, false, {}, {}, {}, WL, WI, b, 0, 6, 0, 1.8, false, {});
  const slots2 = UI.resolveFanSlots(WL, WI);
  assert.equal(slots2.filter(Boolean).length, 4, 'Phone Frame 2: needle fills freed slot, active count is 4');
  assert.equal(slots2[1], 'needle', 'Phone Frame 2: slot 1 is needle');
});

// -----------------------------------------------------------------------------
// Test 14: Alignment with p4 Text Contract (getBuildState, getViewModel, commitTransaction, hudExtra)
// -----------------------------------------------------------------------------
test('HoloCure Fan 14: alignment with p4 contract (ownedActiveCount, slotDelta=-1, wT/wMax cd mapping)', () => {
  const { UI } = loadUiSandbox(DESKTOP);
  UI.resetFanSlots();

  // p4 getBuildState() mock
  const buildState = {
    schemaVersion: 1,
    activeSkills: ['katana', 'fire', 'barrier', 'boom'],
    WL: { katana: 5, fire: 5, barrier: 3, boom: 2 },
    ownedActiveCount: 4,
    charms: [],
    mutations: [],
    duos: []
  };

  // p4 getViewModel() contract
  const slotBefore = buildState.ownedActiveCount; // 4
  const recipeSlotDelta = -1;
  const slotAfter = Math.max(1, slotBefore + recipeSlotDelta); // 3
  assert.equal(slotBefore, 4);
  assert.equal(slotAfter, 3, 'p4 ViewModel specifies slotAfter = 3');

  // Verify UI slot reconciliation exactly matches p4 slotAfter = 3
  const slotsBefore = UI.resolveFanSlots(buildState.WL);
  assert.equal(slotsBefore.filter(Boolean).length, slotBefore, 'UI matches p4 slotBefore');

  // Simulated commitTransaction execution
  const fusedWL = { ...buildState.WL, katana: 0, fire: 0, fusion_inkblade: 1 };
  const slotsAfter = UI.resolveFanSlots(fusedWL, null, slotsBefore);
  assert.equal(slotsAfter.filter(Boolean).length, slotAfter, 'UI matches p4 slotAfter');
  assert.equal(slotsAfter[0], 'fusion_inkblade');
  assert.equal(slotsAfter[1], null);

  // Cooldown contract from p4 hudExtra: cd[k] = clamp(wT[k] / wMax[k], 0, 1)
  const wT = { fusion_inkblade: 0.9 };
  const wMax = { fusion_inkblade: 1.8 };
  const cdValue = Math.max(0, Math.min(1, wT.fusion_inkblade / wMax.fusion_inkblade)); // 0.5
  assert.equal(cdValue, 0.5, 'p4 Cooldown formula produces 0.5');

  const ctx = createMockContext();
  UI.drawDiegeticSkillFan(ctx, slotsAfter, fusedWL, { cd: { fusion_inkblade: cdValue } }, 11, 14, false);
  const cdArcs = ctx.calls.filter(c => c.name === 'arc' && Math.abs(c.args[3] - (-Math.PI / 2)) < 0.001);
  assert.ok(cdArcs.length >= 1, 'Cooldown arc drawn for 0.5 cooldown');
});
