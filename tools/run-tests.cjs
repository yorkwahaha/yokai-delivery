'use strict';
// Current lane is authoritative; retired tests remain byte-exact in local history.
// Legacy/all are explicit opt-in and preserve original test paths and outcomes.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const present=fs.readdirSync(path.join(ROOT,'tests'))
  .filter(f=>f.endsWith('.test.cjs')).sort();
const retiredManifest=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/HISTORICAL_TESTS.json'),'utf8'));
const retired=new Map(retiredManifest.files.map(r=>[r.file,r]));
if(retired.size!==retiredManifest.files.length)throw Error('Duplicate retired test records');
for(const name of retired.keys())if(!/^[a-zA-Z0-9_.-]+\.test\.cjs$/.test(name))throw Error('Invalid retired filename: '+name);
const all=[...new Set([...present,...retired.keys()])].sort();
const digest=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const frozenHistorical=new Set([
  'agy-m1-runtime.test.cjs',
  'agy-m1-n4.test.cjs',
  'game-attack-specs-phase12-20261103.test.cjs',
  'game-catalog-phase13-20261103.test.cjs'
]);
// Frozen source hashes and pre-2026-11 game-timeline assumptions belong in
// the legacy/all lane. Original assertions remain runnable for audit.

const currentPrefix=/^(game-.*phase\d+|game-combat-audit-hardening|core-(multi-enemy-stage|stateful-contracts)|audit-p1-|audio-gamepad-home-hotfix|phase2-geometry-audit|third-audit-regressions|water-slam-alpha-sfx|combat-targeting|combat-boundaries-stage-tutorial|boom-behavior|boss-(music|telegraph-delegate|ring-sweep)|evolutions|fx\.|skillfx\.|game-balance|progression|v3-boss-ai|v3-core|v3-contract-gate)/;
const currentExact=new Set([
  'active-skills-10-13.test.cjs',
  'integration-polish-phase-f1.test.cjs',
  'ui-compendium-20261126.test.cjs',
  'unified-boss-schedule-no-delivery-gate-20261125.test.cjs',
  'game-violet-scent-20261117.test.cjs',
  'game-upgrade-cooldown-20261121.test.cjs',
  'game-new-skill-visibility-20261124.test.cjs',
  'late-skill-mutations.test.cjs',
  'four-stage-controlled-flow-20261122.test.cjs',
  'stage-bgm-routing-20261122.test.cjs',
  'perf-overlay-position-20261122.test.cjs',
  'port-performance-diagnostics.test.cjs',
  'game-shikigami-candidate-20261119.test.cjs',
  'game-shikigami-runtime-20261119.test.cjs',
  'stage4-bamboo-maze-20261119.test.cjs',
  'stage5-hyakki-kyoto-20261119.test.cjs',
  'stage6-snow-temple.test.cjs',
  'stage78-dev.test.cjs',
  'stage58-audio.test.cjs',
  'stage58-combat-polish-phase-a-20261126.test.cjs',
  'stage58-combat-polish-phase-b-20261126.test.cjs',
  'fusion-lab-isolation-20261119.test.cjs',
  'phase42-upgrade-input-20261119.test.cjs',
  'game-ui-upgrade-phase42.test.cjs',
  'stage3-engine-20261116.test.cjs',
  'stage23-production-art.test.cjs',
  'delivery-media-runtime-20261119.test.cjs',
  'stage3-art-batch-20261116.test.cjs',
  'stage3-boss-behavior-20261116.test.cjs',
  'stage3-boss-polish-20261116.test.cjs',
  'card-delivery-runtime.test.cjs',
  // 2026-11-10 review: delivered/quota gates, offscreen sword travel,
  // mutation reroll, frost volley and current cadence specifications.
  'report-review-regressions-20261110.test.cjs',
  'review-followup-20261110.test.cjs',
  'ui-ofuda-needle-font-followup-20261110.test.cjs',
  'pickup-embedded-ui-review-20261110.test.cjs',
  'overworld-approved-plaque-20261110.test.cjs',
  'phase42-raster-redoil-boss-sfx.test.cjs',
  // Phase42 approved calligraphy and Lv5 sanctuary: visual-only contract tests.
  'game-sanctuary-arc.test.cjs',
  'game-ui-washi-redesign.test.cjs',
  'game-student-playtest-fixes-20261108.test.cjs',
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
  'phase-f3-audio-20261127.test.cjs',
  'ink-variants-seal-nail-20261117.test.cjs',
  'test-triage-audit-20261104.test.cjs'
]);
for(const required of currentExact)if(!frozenHistorical.has(required)&&!retired.has(required)&&!present.includes(required))
  throw Error('Current test missing: '+required);

const current=present.filter(f=>!retired.has(f)&&!frozenHistorical.has(f)&&(currentPrefix.test(f)||currentExact.has(f)));
const currentSet=new Set(current);
const legacy=all.filter(f=>!currentSet.has(f));
const mode=process.argv[2]||'current';
if(!['current','legacy','all','list','legacy-check'].includes(mode)){
  console.error('Usage: node tools/run-tests.cjs [current|legacy|all|list|legacy-check]');
  process.exit(2);
}
console.log('[Yokai tests] current:',current.length,'files; historical:',legacy.length,
  'files; all:',all.length,'files. The full legacy suite is not asserted green.');
if(mode==='list'){
  console.log('Current (actively maintained):\n'+current.join('\n'));
  console.log('Historical (unmigrated):\n'+legacy.join('\n'));
  process.exit(0);
}
function sourceFor(name){
  const row=retired.get(name);
  const archived=path.join(ROOT,retiredManifest.archive_root,name);
  if(fs.existsSync(archived)){
    const bytes=fs.readFileSync(archived);
    if(digest(bytes)!==row.sha256)throw Error('Archive hash mismatch: '+name);
    return bytes;
  }
  // Fresh checkouts can recover clean retired source from the pinned Git object.
  const result=cp.spawnSync('git',['show',retiredManifest.source_revision+':tests/'+name],{cwd:ROOT,maxBuffer:8*1024*1024});
  if(result.status===0){
    if(digest(result.stdout)===row.sha256)return result.stdout;
    const text=result.stdout.toString('utf8');
    const crlf=Buffer.from(text.replace(/\r?\n/g,'\r\n'),'utf8');
    if(digest(crlf)===row.sha256)return crlf;
  }
  throw Error('Retired source unavailable or hash mismatch: '+name+'; restore local archive or pinned Git revision. No test was silently skipped.');
}
if(mode==='legacy-check'){
  for(const name of retired.keys())sourceFor(name);
  console.log('Retired sources verified:',retired.size);
  process.exit(0);
}
const files=mode==='current'?current:mode==='legacy'?legacy:all;
if(!files.length)throw Error('No '+mode+' tests found');
const staged=[];
try{
  // Preserve __dirname, relative fixture paths and original assertions without modifying archived source.
  const needed=files.filter(f=>retired.has(f)).map(name=>[name,sourceFor(name)]);
  for(const [name,bytes] of needed){
    const dst=path.join(ROOT,'tests',name);
    if(fs.existsSync(dst)){
      if(digest(fs.readFileSync(dst))!==retired.get(name).sha256)throw Error('Refusing to overwrite existing test: '+name);
      continue;
    }
    fs.writeFileSync(dst,bytes,{flag:'wx'});staged.push([dst,retired.get(name).sha256]);
  }
  const argv=['--test','--test-concurrency=8',...files.map(f=>path.join(ROOT,'tests',f))];
  const child=cp.spawnSync(process.execPath,argv,{cwd:ROOT,stdio:'inherit',timeout:240000});
  if(child.error)console.error('[Yokai tests]',child.error.message);
  process.exitCode=child.status??1;
}finally{
  for(const [dst,sha] of staged){
    if(fs.existsSync(dst)&&digest(fs.readFileSync(dst))===sha)fs.unlinkSync(dst);
    else {console.error('Retired test changed during run; preserved:',dst);process.exitCode=1;}
  }
}
