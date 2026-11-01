'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');

test('R12: runtime-art-manifest.json exists, valid JSON, authority matches docs/STAGE_PATHS.json', () => {
  const manifestPath = path.join(ROOT, 'assets/img/runtime-art-manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'runtime-art-manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.schema_version, '1.1-r12-unified');
  assert.equal(manifest.authority, 'docs/STAGE_PATHS.json');
  assert.ok(manifest.stages['night-town'], 'stage night-town must be defined');
  assert.ok(manifest.stages['rain-port'], 'stage rain-port must be defined');
  assert.ok(manifest.stages['sakura-pass'], 'stage sakura-pass must be defined');
  assert.ok(manifest.boss_water_hazards, 'boss_water_hazards must be defined');
});

test('R12: Stage 1 night-town has 8 approved canonical scenery WebPs matching disk sha256 and bytes', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/img/runtime-art-manifest.json'), 'utf8'));
  const s1 = manifest.stages['night-town'];
  assert.equal(s1.status, 'APPROVED');
  assert.equal(s1.requires_dev_flags, false);

  const keys = Object.keys(s1.assets);
  assert.equal(keys.length, 8, 'must have exactly 8 approved scenery assets');
  for (const [key, item] of Object.entries(s1.assets)) {
    assert.ok(fs.existsSync(path.join(ROOT, item.path)), `file ${item.path} must exist`);
    assert.equal(sha256(item.path), item.sha256, `sha256 mismatch on ${item.path}`);
    assert.equal(fs.statSync(path.join(ROOT, item.path)).size, item.bytes, `bytes mismatch on ${item.path}`);
    assert.equal(item.status, 'APPROVED');
    assert.equal(item.source_status, 'RUNTIME_ACTIVE');
    assert.equal(item.runtime_status, 'APPROVED_RUNTIME');
  }
});

test('R12: Stage 2 rain-port preserves source review status while defining approved runtime selection', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/img/runtime-art-manifest.json'), 'utf8'));
  const s2 = manifest.stages['rain-port'];
  assert.equal(s2.status, 'APPROVED');
  assert.equal(s2.requires_dev_flags, false);

  const tiles = [...s2.tiles.stoneVariants, ...s2.tiles.woodVariants, ...s2.tiles.transitions.h];
  assert.equal(tiles.length, 8, 'must have 8 ground tiles (4 stone + 3 wood + 1 transition)');
  tiles.forEach(t => {
    assert.ok(fs.existsSync(path.join(ROOT, t.path)), `tile ${t.path} must exist`);
    assert.equal(sha256(t.path), t.sha256, `tile sha mismatch: ${t.path}`);
    assert.equal(fs.statSync(path.join(ROOT, t.path)).size, t.bytes);
    assert.equal(t.source_status, 'USER_SELECTED_LIGHTWEIGHT');
    assert.equal(t.runtime_status, 'APPROVED_RUNTIME');
  });

  assert.equal(s2.buildings.length, 5, 'must have 5 Nano buildings');
  s2.buildings.forEach(b => {
    assert.ok(fs.existsSync(path.join(ROOT, b.path)), `building ${b.path} must exist`);
    assert.equal(sha256(b.path), b.sha256, `building sha mismatch: ${b.path}`);
    assert.equal(fs.statSync(path.join(ROOT, b.path)).size, b.bytes);
    assert.equal(b.source_status, 'ART_CANDIDATE', 'source status must remain ART_CANDIDATE');
    assert.equal(b.runtime_status, 'USER_SELECTED_RUNTIME', 'runtime status must be USER_SELECTED_RUNTIME');
  });

  assert.equal(s2.props.length, 5, 'must have 5 props');
  s2.props.forEach(p => {
    assert.ok(fs.existsSync(path.join(ROOT, p.path)), `prop ${p.path} must exist`);
    assert.equal(sha256(p.path), p.sha256, `prop sha mismatch: ${p.path}`);
    assert.equal(fs.statSync(path.join(ROOT, p.path)).size, p.bytes);
    assert.equal(p.source_status, 'ART_CANDIDATE');
    assert.equal(p.runtime_status, 'USER_SELECTED_RUNTIME');
  });

  assert.equal(s2.environment.length, 2, 'must have 2 environment assets');
  s2.environment.forEach(e => {
    assert.ok(fs.existsSync(path.join(ROOT, e.path)), `env ${e.path} must exist`);
    assert.equal(sha256(e.path), e.sha256, `env sha mismatch: ${e.path}`);
    assert.equal(fs.statSync(path.join(ROOT, e.path)).size, e.bytes);
    assert.equal(e.source_status, 'ART_CANDIDATE');
    assert.equal(e.runtime_status, 'USER_SELECTED_RUNTIME');
  });
});

test('R12: Stage 3 sakura-pass is explicitly BLOCKED and reference-only; no unapproved runtime deployment', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/img/runtime-art-manifest.json'), 'utf8'));
  const s3 = manifest.stages['sakura-pass'];
  assert.equal(s3.status, 'BLOCKED');
  assert.equal(s3.art_status, 'STYLE_REFERENCE_ONLY');
  assert.equal(s3.runtime_directory, null);
  assert.equal(s3.fallback_stage, 'night-town');
});

test('R12: Boss water hazard candidates are explicitly BLOCKED with auto_pass=false and dev gate', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/img/runtime-art-manifest.json'), 'utf8'));
  const hazards = manifest.boss_water_hazards;
  for (const [kind, h] of Object.entries(hazards)) {
    assert.equal(h.status, 'BLOCKED');
    assert.equal(h.review_status, 'ART_CANDIDATE');
    assert.equal(h.auto_pass, false);
    assert.equal(h.dev_gate, 'dev=1&bossart=1');
    assert.ok(fs.existsSync(path.join(ROOT, h.path)), `file ${h.path} must exist`);
    assert.equal(sha256(h.path), h.sha256, `sha256 mismatch on ${h.path}`);
  }
});

test('R12: STAGE_ART_RESOLVER runtime resolution, unknown key missing, activeStage tracking, and dev gate for s2legacy', () => {
  function MockImage() {
    this.naturalWidth = 100;
    this.naturalHeight = 100;
    this.src = '';
  }
  global.Image = MockImage;

  const mockWindow = {
    location: { search: '' }, // Normal URL with NO flags and NO stage
    STAGE_ART_STATUS: {},
    PORT_ART: {},
    PORT_ART_STATUS: {},
    Image: MockImage
  };
  global.window = mockWindow;

  // Execute assets.js in context
  const code = fs.readFileSync(path.join(ROOT, 'js/assets.js'), 'utf8');
  eval(code);

  const resolver = mockWindow.STAGE_ART_RESOLVER;
  assert.ok(resolver, 'STAGE_ART_RESOLVER must be attached to window');

  // Initially on night-town
  assert.equal(resolver.getCurrentStage(), 'night-town');
  assert.equal(mockWindow.isS2ArtProdEnabled(), false);

  // Unknown key in night-town returns MISSING
  const unknownS1 = resolver.resolveStageArt('night-town', 'scenery', 'NONEXISTENT_KEY');
  assert.equal(unknownS1.status, 'MISSING');
  assert.equal(unknownS1.artStatus, 'KEY_NOT_IN_MANIFEST');

  // Known key in night-town returns APPROVED
  const knownS1 = resolver.resolveStageArt('night-town', 'scenery', 'house_shop');
  assert.equal(knownS1.status, 'APPROVED');
  assert.ok(knownS1.path.includes('house_shop.webp'));

  // Switch to rain-port via loadStageAssets (as normal UI does)
  mockWindow.loadStageAssets?.('rain-port');
  assert.equal(resolver.getCurrentStage(), 'rain-port');
  assert.equal(mockWindow.isS2ArtProdEnabled(), true, 'rain-port must enable S2 art prod');
  assert.equal(mockWindow.isS2GroundKitEnabled(), true, 'rain-port must enable S2 ground kit');

  // Unknown key in rain-port returns MISSING (never fake APPROVED)
  const unknownS2 = resolver.resolveStageArt('rain-port', 'ground', 'NONEXISTENT_A1_REVIEW_KEY');
  assert.equal(unknownS2.status, 'MISSING');
  assert.equal(unknownS2.artStatus, 'KEY_NOT_IN_MANIFEST');

  // Known building in rain-port returns APPROVED
  const bldRes = resolver.resolveStageArt('rain-port', 'buildings', 'building_port_warehouse');
  assert.equal(bldRes.status, 'APPROVED');
  assert.equal(bldRes.sourceStatus, 'ART_CANDIDATE');
  assert.equal(bldRes.runtimeStatus, 'USER_SELECTED_RUNTIME');
  assert.equal(bldRes.path, 'assets/img/rain-port/s2-production/buildings/building_port_warehouse.webp');

  // Public s2legacy WITHOUT dev=1 must NOT disable S2 prod
  mockWindow.location.search = '?stage=rain-port&s2legacy=1';
  assert.equal(mockWindow.isS2ArtProdEnabled(), true, 's2legacy without dev=1 must NOT disable prod');
  assert.equal(mockWindow.isS2GroundKitEnabled(), true);

  // Diagnostic s2legacy WITH dev=1 DOES disable S2 prod
  mockWindow.location.search = '?dev=1&stage=rain-port&s2legacy=1';
  assert.equal(mockWindow.isS2ArtProdEnabled(), false, 'dev=1&s2legacy=1 must disable S2 prod');
  assert.equal(mockWindow.isS2GroundKitEnabled(), false);
  const legacyStatus = resolver.getStageStatus('rain-port');
  assert.equal(legacyStatus.artStatus, 'LEGACY_FALLBACK');

  // Boss water hazards without dev=1&bossart=1 must be BLOCKED
  const tideBlocked = resolver.resolveBossHazardArt('tide');
  assert.equal(tideBlocked.status, 'BLOCKED');
  assert.equal(tideBlocked.blocked, true);
  assert.equal(tideBlocked.autoPass, false);

  // Boss water hazards WITH dev=1&bossart=1
  mockWindow.location.search = '?dev=1&bossart=1';
  const tideDev = resolver.resolveBossHazardArt('tide');
  assert.equal(tideDev.status, 'DEV_CANDIDATE');
  assert.equal(tideDev.blocked, false);
  assert.equal(tideDev.autoPass, false);

  // Cleanup globals
  delete global.Image;
  delete global.window;
});
