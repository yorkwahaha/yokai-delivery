'use strict';
// 2026-10-24 approved cleanup: first two stages retain accepted source art,
// stages 3-8 retain style references only; runtime Stage3 temporarily uses Stage1 art.
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(ROOT,x),'utf8');
const abs=x=>path.join(ROOT,x);
const imgs=new Set(['.png','.webp','.jpg','.jpeg','.gif','.bmp']);
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):imgs.has(path.extname(x.name).toLowerCase())?[path.join(d,x.name)]:[]):[];
test('Stages 3-8 only retain manifest-listed style references',()=>{
 for(const [st,num] of [['stage3-sakura-pass',3],['stage4-bamboo-maze',3],['stage5-hyakki-kyoto',1],['stage6-snow-temple',1],['stage7-spirit-ferry',0],['stage8-yomi',3]]){
   const root=abs('art/'+st);const j=JSON.parse(read('art/'+st+'/manifest.json'));
   assert.equal(j.status,'REFERENCE_ONLY_AWAITING_NEW_ART',st);
   assert.equal(j.references.length,num,st);
   const actual=walk(root).map(x=>path.relative(ROOT,x).replaceAll('\\','/')).sort();
   const listed=j.references.map(x=>x.path).sort();
   assert.deepEqual(actual,listed,st);
   for(const f of listed)assert.ok(fs.existsSync(abs(f)),f);
 }
});
test('Stage2 source is unified, legacy art/s2 root is absent',()=>{
 assert.equal(fs.existsSync(abs('art/s2')),false);
 const a=JSON.parse(read('art/stage2-rain-port/manifest-dev-runtime.json'));
 assert.equal(a.tiles.usable_runtime_tiles.stoneVariants.length,4);
 assert.equal(a.tiles.usable_runtime_tiles.woodVariants.length,3);
 assert.equal(a.tiles.usable_runtime_tiles.transitions.h.length,1);
 assert.equal(a.buildings.length,5);
 assert.equal(a.props.length,5);
 assert.equal(a.environment.length,2);
});
test('third-stage old runtime WebP is removed with explicit Stage1 fallbacks',()=>{
 const s=read('js/assets.js');
 assert.equal(fs.existsSync(abs('assets/img/sakura-pass')),false);
 assert.ok(!s.includes('assets/img/sakura-pass/'));
 assert.match(s,/assets\/img\/scenery\/ground_dirt\.webp/);
 assert.match(s,/assets\/img\/scenery\/house_shrine\.webp/);
 assert.match(s,/assets\/img\/scenery\/prop_sakura\.webp/);
});
test('deleted Stage8 and S2 rejected DEV preview toggles are disabled',()=>{
 const s=read('js/assets.js');
 assert.match(s,/const STAGE8_PREVIEW_ENABLED = false;/);
 assert.match(s,/const isPortSurfaceCandidateEnabled = \(\) => false;/);
 assert.match(s,/const isPortArtCandidateEnabled = \(\) => false;/);
});
test('authoritative compact route map and document archive are present',()=>{
 const j=JSON.parse(read('docs/STAGE_PATHS.json'));
 assert.equal(j.stages.length,8);
 assert.ok(fs.existsSync(abs('docs/archive/2026-10/ARCHIVE-INDEX.json')));
 assert.ok(fs.existsSync(abs('art/archive/2026-10-24/ART_PURGE_RESULT.json')));
});
