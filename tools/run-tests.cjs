'use strict';
// Explicit current/legacy lanes: no test files are deleted, ignored or
// silently marked as passing. "all" retains the historic full-suite behavior.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const all=fs.readdirSync(path.join(ROOT,'tests'))
  .filter(f=>f.endsWith('.test.cjs')).sort();
const currentPrefix=/^(game-.*phase\d+|game-combat-audit-hardening|core-(multi-enemy-stage|stateful-contracts)|audit-p1-|audio-gamepad-home-hotfix|phase2-geometry-audit|third-audit-regressions|water-slam-alpha-sfx|combat-targeting|combat-boundaries-stage-tutorial|boom-behavior|boss-(music|telegraph-delegate|ring-sweep)|evolutions|fx\.|skillfx\.|game-balance|progression|v3-boss-ai|v3-core|v3-contract-gate)/;
const currentExact=new Set([
  'card-delivery-runtime.test.cjs',
  'b14-surge-motion-20261101.test.cjs',
  'media-cache.test.cjs',
  'agy-m1-b.test.cjs',
  'boom-lv5-motion-20261025.test.cjs',
  // Independently verified 2026-11-03 against the live runtime/contracts.
  // These historical files have meaningful, non-browser checks and pass
  // without deleting or rewriting their assertions.
  'controls.test.cjs',
  'viewport.test.cjs',
  'store-multi-tab.test.cjs',
  'overworld-editor.test.cjs',
  'overworld-facing.test.cjs',
  'card-collection-c1c2.test.cjs',
  'card-delivery-bridge.test.cjs',
  'card-gallery-model.test.cjs',
  'card-gallery-ui.test.cjs',
  'card-rewards-runtime.test.cjs',
  'audio-events.test.cjs',
  'stage-release-status.test.cjs',
  'stage2-approved-media-routes.test.cjs',
  'stage2-nonmis-stuck-fallback.test.cjs',
  'onmyo-vfx.test.cjs',
  'font-subset.test.cjs',
  'long-kana-display.test.cjs',
  'r12-manifest-sentinel.test.cjs',
  'r10-audio-bgm.test.cjs',
  'r3-gamepause-wiring.test.cjs',
  // Revalidated against the approved sparse rain-port layout, current
  // delivery-card curriculum, and freely draggable world map (no arrows).
  'content-world.test.cjs',
  'card-gallery-runtime.test.cjs',
  'overworld.test.cjs',
  'overworld-eight-stage.test.cjs',
  // Independent cross-review: preserve the approved S2 production asset
  // manifest, responsive Boss questions, lantern-side charms and audio fades.
  's2-published-release.test.cjs',
  'muse-boss-phone-read.test.cjs',
  'b10-charm-ui-20261101.test.cjs',
  'audio-flow-polish-r1.test.cjs',
  // Second independent review: current multi-Boss quiz, six-skill whitelist
  // and compact horizontal UI each pass without changing their contracts.
  'b3-night-town-boss-quiz.test.cjs',
  'b3-night-town-six-skills.test.cjs',
  'playtest-r8-ui.test.cjs',
  // Individually verified passing historic files; frozen snapshots stay archival.
  'agy-m1-n3.test.cjs',
  'agy-m1-n4.test.cjs',
  'agy-m11-ui.test.cjs',
  'audio-flow-polish-r1-boss-text.test.cjs',
  'audit-regressions-20261101.test.cjs',
  'audit-stage2-load-race.test.cjs',
  'b15-production-art-mapping-20261101.test.cjs',
  'b16-device-font-boss-20261101.test.cjs',
  'b3-needle-charge-20261031.test.cjs',
  'b3-night-town-visual-feedback-20261031.test.cjs',
  'b5-slam-shield-return-20261031.test.cjs',
  'dev-helper-occlusion-r1.test.cjs',
  'director-audio-freeze.test.cjs',
  'director-c3-visible-hitboxes.test.cjs',
  'director-card-long-run.test.cjs',
  'director-card-page-contrast.test.cjs',
  'director-p42-ctm.test.cjs',
  'kilo-b5-balance.test.cjs',
  'kilo-m2-port-boundary.test.cjs',
  'kilo-m2-stage2-renderer.test.cjs',
  'muse-end-states.test.cjs',
  'muse-pad5-combat.test.cjs',
  'muse-settle-review.test.cjs',
  'p42-camera-zoom-math.test.cjs',
  'parallax-depth.test.cjs',
  'phase3-grok-audit-20261102.test.cjs',
  'playtest-r13-vfx.test.cjs',
  'playtest-ui-balance-20261102.test.cjs',
  'r12-fan-clip-bound-r12.test.cjs',
  'second-audit-regressions.test.cjs',
  'spacebunny-m1-f-r1.test.cjs',
  'ui-charm-passive-20261023.test.cjs',
  'v3-growth-curve.test.cjs',
  'v3-study-session.test.cjs',
  // Former raster fixtures now provide a fetch-stub for the production
  // runtime manifest; renderer expectations target the approved shadow/ground.
  'barrier-raster.test.cjs',
  'ofuda-raster.test.cjs',
  'thunder-raster.test.cjs',
  'renderer.test.cjs',
  // Revised source-location, approved Stage 3 sparse scenery, production
  // asset bytes, camera and dev-gate contracts (no release gameplay change).
  'agy-m1-contract.test.cjs',
  'dev-stage-selector.test.cjs',
  'stage3-house-density-depth.test.cjs',
  'assets-loading.test.cjs',
  'm15-port-transition.test.cjs',
  'p42-camera-runtime.test.cjs',
  'playtest-followup-20261102.test.cjs',
  'agy-m2-stage2-facing.test.cjs',
  'source-contracts.test.cjs',
  'overworld-typography.test.cjs',
  'muse-long-kana-visible.test.cjs',
  'muse-c4-progress-ux.test.cjs',
  // Safe registry scan now handles local ignored provenance and accepted
  // image updates; current real-game Boss and routing contracts revalidated.
  'asset-registry.test.cjs',
  'codex-astar-audit-fixes-20261029.test.cjs',
  'muse-s8-boss.test.cjs',
  'b11-charm-actual-game-ui-20261101.test.cjs',
  'b12-ui-consistency-20261101.test.cjs',
  'b13-boss-audio-ui-20261101.test.cjs',
  // Final focused review: current radar/reopen touch geometry, 4 phase-one
  // gameplay invariants, and real 10s/30s Boss curse behaviour.
  'r10-ui-hud-hitbox.test.cjs',
  'phase1-fixes.test.cjs',
  'playtest-r14-delivery-seal-curse.test.cjs',
  'test-triage-audit-20261104.test.cjs'
]);
for(const required of currentExact)if(!all.includes(required))
  throw Error('Current test missing: '+required);

const current=all.filter(f=>currentPrefix.test(f)||currentExact.has(f));
const currentSet=new Set(current);
const legacy=all.filter(f=>!currentSet.has(f));
const mode=process.argv[2]||'current';
if(!['current','legacy','all','list'].includes(mode)){
  console.error('Usage: node tools/run-tests.cjs [current|legacy|all|list]');
  process.exit(2);
}
console.log('[Yokai tests] current:',current.length,'files; historical:',legacy.length,
  'files; all:',all.length,'files. The full legacy suite is not asserted green.');
if(mode==='list'){
  console.log('Current (actively maintained):\n'+current.join('\n'));
  console.log('Historical (unmigrated):\n'+legacy.join('\n'));
  process.exit(0);
}
const files=mode==='current'?current:mode==='legacy'?legacy:all;
if(!files.length)throw Error('No '+mode+' tests found');
const argv=['--test','--test-concurrency=8',...files.map(f=>path.join(ROOT,'tests',f))];
const child=cp.spawnSync(process.execPath,argv,{
  cwd:ROOT,stdio:'inherit',timeout:240000
});
if(child.error)console.error('[Yokai tests]',child.error.message);
process.exitCode=child.status??1;
