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
  'boom-lv5-motion-20261025.test.cjs'
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
