'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/assets.js'), 'utf8');
const unifiedManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/img/runtime-art-manifest.json'), 'utf8'));

test('F1 Verification: Unified manifest fetch drives runtime asset selection (sentinel mutation test)', async () => {
  const requests = [];
  const mutatedManifest = structuredClone(unifiedManifest);
  const SENTINEL_PATH = 'assets/img/SENTINEL_STONE_VAR1_MUTATED.webp';
  mutatedManifest.stages['rain-port'].tiles.stoneVariants[0].path = SENTINEL_PATH;

  function MockImage() {
    this.src = '';
    this.naturalWidth = 100;
    this.naturalHeight = 100;
  }

  const mockWindow = {
    location: { search: '', hostname: 'localhost' },
    STAGE_ART_STATUS: {},
    PORT_ART: {},
    PORT_ART_STATUS: {},
    Image: MockImage
  };

  const context = vm.createContext({
    window: mockWindow,
    globalThis: mockWindow,
    Image: MockImage,
    console,
    URLSearchParams,
    fetch: async (url) => {
      requests.push(url);
      if (url.includes('runtime-art-manifest.json')) {
        return {
          ok: true,
          json: async () => structuredClone(mutatedManifest)
        };
      }
      return { ok: false, status: 404 };
    }
  });

  vm.runInContext(source, context);

  const resolver = mockWindow.STAGE_ART_RESOLVER;
  assert.ok(resolver, 'STAGE_ART_RESOLVER must exist on window');

  // Load rain-port assets
  mockWindow.loadStageAssets('rain-port');
  assert.equal(resolver.getCurrentStage(), 'rain-port');

  // Trigger manifest load
  const s2Manifest = await mockWindow.loadS2ArtProdManifest();
  assert.ok(s2Manifest, 'loadS2ArtProdManifest must resolve');
  assert.ok(requests.some(u => u.includes('runtime-art-manifest.json')), 'Must fetch runtime-art-manifest.json');

  // Known key with mutated sentinel path MUST reflect the mutated path
  const known = resolver.resolveStageArt('rain-port', 'ground', 'g_stone_01');
  assert.equal(known.path, SENTINEL_PATH, 'API must return sentinel path from mutated manifest');
  assert.equal(known.status, 'APPROVED');

  // Unknown key must still be rejected
  const unknown = resolver.resolveStageArt('rain-port', 'ground', 'UNKNOWN_TEST_KEY_404');
  assert.equal(unknown.status, 'MISSING');
  assert.equal(unknown.path, null);

  // Building metadata preserves source status vs runtime selection
  const bld = resolver.resolveStageArt('rain-port', 'buildings', 'building_port_warehouse');
  assert.equal(bld.status, 'APPROVED');
  assert.equal(bld.sourceStatus, 'ART_CANDIDATE');
  assert.equal(bld.runtimeStatus, 'USER_SELECTED_RUNTIME');
});
