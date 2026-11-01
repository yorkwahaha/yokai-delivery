// tests/r12-shared-art-manifest.test.cjs
// R12-B5: 共享圖片權威清單驗證 (6技能 / 主角妖怪 / HUD / 10融合候選)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'assets/img/runtime-art-manifest.json');
const assetsJsPath = path.join(ROOT, 'js/assets.js');

test('R12-B5: runtime-art-manifest.json contains complete shared_skills, shared_actors, shared_hud, and fusion_candidates', () => {
  assert.ok(fs.existsSync(manifestPath), 'manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Verify shared_skills
  assert.ok(manifest.shared_skills, 'manifest must contain shared_skills');
  const skills = manifest.shared_skills;
  for (const sk of ['katana', 'fire', 'barrier', 'thunder', 'boom', 'needle']) {
    assert.ok(skills[sk], `shared_skills.${sk} must be defined`);
    assert.equal(skills[sk].status, 'APPROVED');
    assert.equal(skills[sk].runtime_status, 'APPROVED_RUNTIME');
  }

  // Katana 5 levels
  assert.equal(Object.keys(skills.katana.levels).length, 5);
  for (let l = 1; l <= 5; l++) {
    const kItem = skills.katana.levels[String(l)];
    assert.ok(fs.existsSync(path.join(ROOT, kItem.path)), `Katana Lv${l} file must exist`);
    assert.ok(kItem.sha256 && kItem.bytes > 0, `Katana Lv${l} must have sha256 and bytes`);
  }

  // Fire variants
  assert.equal(Object.keys(skills.fire.variants.orbit).length, 5);
  assert.equal(Object.keys(skills.fire.variants.attack).length, 5);
  assert.ok(skills.fire.variants.dragon.fire_dragon_l5, 'fire dragon L5 must exist');

  // Barrier tiers
  assert.ok(skills.barrier.tiers.core_main, 'barrier core_main must exist');
  assert.ok(skills.barrier.tiers.core_lv5, 'barrier core_lv5 must exist');

  // Thunder raster
  assert.ok(skills.thunder.raster.cloud, 'thunder cloud must exist');
  assert.ok(skills.thunder.raster.strike, 'thunder strike must exist');

  // Boom & Needle
  assert.ok(skills.boom.raster.main, 'ofuda projectile must exist');
  assert.ok(skills.needle.raster.main, 'needle must exist');

  // 2. Verify shared_actors
  assert.ok(manifest.shared_actors, 'manifest must contain shared_actors');
  const actors = manifest.shared_actors;
  assert.ok(actors.player && actors.player.actions, 'player actions must be defined');
  assert.equal(Object.keys(actors.player.actions).length, 10, 'must have 10 player action frames');
  for (const act of Object.values(actors.player.actions)) {
    assert.ok(fs.existsSync(path.join(ROOT, act.path)), `Player action ${act.id} must exist on disk`);
  }

  // Enemies
  assert.ok(actors.enemies['night-town'], 'S1 enemies must be defined');
  assert.equal(Object.keys(actors.enemies['night-town']).length, 6, 'S1 must have 6 enemy types');
  assert.ok(actors.enemies['rain-port'], 'S2 enemies must be defined');
  assert.ok(actors.enemies['rain-port'].shiome, 'S2 shiome must be defined');
  assert.ok(actors.enemies['rain-port'].boss_ikari_umibozu, 'S2 boss umibozu must be defined');

  // 3. Verify shared_hud
  assert.ok(manifest.shared_hud, 'manifest must contain shared_hud');
  const hud = manifest.shared_hud;
  assert.equal(Object.keys(hud.core).length, 4, 'core HUD must have 4 items');
  assert.equal(Object.keys(hud.illustrated).length, 7, 'illustrated UI must have 7 items');
  assert.equal(Object.keys(hud.omamori).length, 6, 'omamori must have 6 charms');
  assert.equal(Object.keys(hud.passives).length, 8, 'passives must have 8 icons');

  // 4. Verify fusion_candidates
  assert.ok(manifest.fusion_candidates, 'manifest must contain fusion_candidates');
  const fusions = manifest.fusion_candidates;
  assert.equal(Object.keys(fusions).length, 10, 'must have 10 fusion recipes');

  for (const [rId, fDef] of Object.entries(fusions)) {
    assert.equal(fDef.status, 'BLOCKED', `${rId} status must be BLOCKED`);
    assert.equal(fDef.review_status, 'APPROVAL_PENDING', `${rId} review_status must be APPROVAL_PENDING`);
    assert.equal(fDef.auto_pass, false, `${rId} auto_pass must be false`);
    assert.equal(fDef.requires_dev_flags, true, `${rId} requires_dev_flags must be true`);

    // Verify phases
    for (const phase of ['main', 'hit', 'ground', 'icon']) {
      const p = fDef.phases[phase];
      assert.ok(p, `${rId} phase ${phase} must exist`);
      assert.equal(p.runtime_url, null, `${rId}.${phase} runtime_url must be null (never use art/ as formal URL)`);
      assert.equal(p.blocked, true, `${rId}.${phase} must be blocked`);
    }
  }

  // Verify alias_of for identical candidate files
  assert.equal(fusions.fusion_slashwheel.phases.hit.alias_of, 'main', 'slashwheel hit must alias main');
  assert.equal(fusions.fusion_slashwheel.phases.ground.alias_of, 'main', 'slashwheel ground must alias main');
  assert.equal(fusions.fusion_slashwheel.phases.icon.alias_of, 'main', 'slashwheel icon must alias main');

  // Verify distinct candidate files have alias_of = null
  assert.equal(fusions.fusion_foxiai.phases.hit.alias_of, null, 'foxiai hit is a distinct file');
  assert.equal(fusions.fusion_foxiai.phases.ground.alias_of, null, 'foxiai ground is a distinct file');
  assert.equal(fusions.fusion_foxiai.phases.icon.alias_of, null, 'foxiai icon is a distinct file');
});

test('R12-B5: STAGE_ART_RESOLVER.getSharedArt resolves skills, player, enemies, and HUD assets', () => {
  const assetsSrc = fs.readFileSync(assetsJsPath, 'utf8');
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const sandbox = {
    window: {
      __RUNTIME_MANIFEST: manifestData,
      location: { search: '' }
    },
    console: { warn() {}, log() {}, error() {} },
    Image: function() { this.naturalWidth = 100; this.naturalHeight = 100; },
    document: { createElement: () => ({ getContext: () => null }) },
    Set, Map, Math, Object, Array, String, Number, Boolean, JSON, URLSearchParams
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(assetsSrc, sandbox, { filename: 'js/assets.js' });

  const resolver = sandbox.window.STAGE_ART_RESOLVER;
  assert.ok(resolver, 'STAGE_ART_RESOLVER must exist');
  assert.equal(typeof resolver.getSharedArt, 'function', 'getSharedArt must be a function');
  assert.equal(typeof resolver.resolveSharedArt, 'function', 'resolveSharedArt must be a function');

  // Test Skills resolution
  const k1 = resolver.getSharedArt('skills', 'katana', 1);
  assert.equal(k1.status, 'APPROVED');
  assert.equal(k1.runtimeStatus, 'APPROVED_RUNTIME');
  assert.equal(k1.path, 'assets/img/vfx/raster/katana_l1.webp');

  const fDragon = resolver.getSharedArt('skills', 'fire', 'fire_dragon_l5');
  assert.equal(fDragon.status, 'APPROVED');
  assert.equal(fDragon.path, 'assets/img/vfx/raster/fire_dragon_l5.webp');

  const bCore = resolver.getSharedArt('skills', 'barrier', 'core_main');
  assert.equal(bCore.status, 'APPROVED');
  assert.equal(bCore.path, 'assets/img/vfx/purification_array_vfx.webp');

  // Test Player resolution
  const pIdle = resolver.getSharedArt('player', 'idle_v2');
  assert.equal(pIdle.status, 'APPROVED');
  assert.equal(pIdle.path, 'assets/img/player_idle_v2.webp');

  // Test Enemy resolution
  const eGhost = resolver.getSharedArt('enemy', 'night-town', 'ghost');
  assert.equal(eGhost.status, 'APPROVED');
  assert.equal(eGhost.idle.path, 'assets/img/yokai/ghost.webp');

  const eShiome = resolver.getSharedArt('enemy', 'rain-port', 'shiome');
  assert.equal(eShiome.status, 'APPROVED');
  assert.equal(eShiome.idle.path, 'assets/img/rain-port/enemies/minion_shiome_idle.webp');

  // Test HUD resolution
  const hLantern = resolver.getSharedArt('hud', 'hud_lantern_oil');
  assert.equal(hLantern.status, 'APPROVED');
  assert.equal(hLantern.path, 'assets/img/ui/hud_lantern_oil.webp');

  const hBtn = resolver.getSharedArt('hud', 'button_primary');
  assert.equal(hBtn.status, 'APPROVED');
  assert.equal(hBtn.path, 'assets/img/ui/illustrated/button_primary.webp');

  const hOmamori = resolver.getSharedArt('hud', 'hud_omamori_power');
  assert.equal(hOmamori.status, 'APPROVED');
  assert.equal(hOmamori.path, 'assets/img/ui/charm-passive/hud_omamori_power.webp');

  // Test Unknown Key
  const unknown = resolver.getSharedArt('skills', 'fake_skill_nonexistent');
  assert.equal(unknown.status, 'MISSING');
  assert.equal(unknown.path, null);
});

test('R12-B5: Fusion candidates are strictly BLOCKED in public mode and DEV_CANDIDATE in authorized dev mode', () => {
  const assetsSrc = fs.readFileSync(assetsJsPath, 'utf8');
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Non-dev public context
  const publicSandbox = {
    window: {
      __RUNTIME_MANIFEST: manifestData,
      location: { search: '' }
    },
    console: { warn() {}, log() {}, error() {} },
    Image: function() {}, document: { createElement: () => ({ getContext: () => null }) },
    Set, Map, Math, Object, Array, String, Number, Boolean, JSON, URLSearchParams
  };
  publicSandbox.globalThis = publicSandbox.window;
  vm.createContext(publicSandbox);
  vm.runInContext(assetsSrc, publicSandbox, { filename: 'js/assets.js' });

  const pubResolver = publicSandbox.window.STAGE_ART_RESOLVER;
  const pubInk = pubResolver.getSharedArt('fusion', 'fusion_inkblade', 'main');
  assert.equal(pubInk.status, 'BLOCKED', 'Public fusion must be BLOCKED');
  assert.equal(pubInk.blocked, true, 'Public fusion blocked flag must be true');
  assert.equal(pubInk.path, null, 'Public fusion formal path must be null');
  assert.equal(pubInk.candidateSource, null, 'Public fusion candidateSource must not leak');
  assert.equal(pubInk.fallback, 'procedural_vector_emblem', 'Public fusion must provide fallback');

  // 2. Authorized dev context
  const devSandbox = {
    window: {
      __RUNTIME_MANIFEST: manifestData,
      location: { search: '?dev=1&stage=rain-port&fusioncandidate=1&fusionart=banana' }
    },
    console: { warn() {}, log() {}, error() {} },
    Image: function() {}, document: { createElement: () => ({ getContext: () => null }) },
    Set, Map, Math, Object, Array, String, Number, Boolean, JSON, URLSearchParams
  };
  devSandbox.globalThis = devSandbox.window;
  vm.createContext(devSandbox);
  vm.runInContext(assetsSrc, devSandbox, { filename: 'js/assets.js' });

  const devResolver = devSandbox.window.STAGE_ART_RESOLVER;
  const devInk = devResolver.getSharedArt('fusion', 'fusion_inkblade', 'main');
  assert.equal(devInk.status, 'DEV_CANDIDATE', 'Authorized dev mode allows DEV_CANDIDATE');
  assert.equal(devInk.blocked, false, 'Dev mode blocked is false');
  assert.equal(devInk.path, null, 'Formal path still null (art/ is not formal runtime URL)');
  assert.ok(devInk.candidateSource.includes('art/fusion/candidates/fusion_inkblade/main_alpha_candidate_v01.webp'), 'candidateSource is accessible');

  // Alias phase inspection
  const devSlashHit = devResolver.getSharedArt('fusion', 'fusion_slashwheel', 'hit');
  assert.equal(devSlashHit.aliasOf, 'main', 'Slashwheel hit must record aliasOf main');
});
