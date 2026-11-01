const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const assets=read('js/assets.js'),ui=read('js/ui.js'),renderer=read('js/renderer.js');
const manifest=JSON.parse(read('assets/img/runtime-art-manifest.json'));
test('B15 the actual published S2 manifest IDs are used by production terrain picker',()=>{
 const tiles=manifest.stages['rain-port'].tiles;
 assert.ok(tiles.stoneVariants.some(v=>v.id==='g_stone_01'));
 assert.ok(tiles.woodVariants.some(v=>v.id==='g_wood_01'));
 assert.ok(tiles.transitions.h.some(v=>v.id==='t_stone_wood_v01'));
 for(const id of ['g_stone_01','g_wood_01','t_stone_wood_v01'])assert.ok(renderer.includes('"'+id+'"'),id);
 for(const id of ['g_stone_01','g_wood_01'])assert.ok(assets.includes("'"+id+"'"),id);
 assert.match(renderer,/if \(s2Enabled\) return null; \/\/ Approved S2 image still loading/);
 assert.match(renderer,/if \(window.isS2ArtProdEnabled\?\.\(\)\) return;/);
});
test('B15 approved S2 base images are primed in parallel before loading variants',()=>{
 const n=assets.indexOf('const baseLoaded = await Promise.all([primeBase(baseStone), primeBase(baseWood)])');
 assert.ok(n>0);
 assert.ok(assets.indexOf('let anyLoaded = baseLoaded.some(Boolean);')>n);
 for(const tile of [
  manifest.stages['rain-port'].tiles.stoneVariants.find(x=>x.id==='g_stone_01'),
  manifest.stages['rain-port'].tiles.woodVariants.find(x=>x.id==='g_wood_01')
 ]){
  assert.ok(tile);
  assert.ok(fs.existsSync(path.join(root,tile.path)),'missing actual stage2 ground '+tile.path);
 }
});
test('B15 official page chooses published hand-painted B13 icons and B11 UI, not local-only review paths',()=>{
 assert.match(ui,/const releasedUiArt = true/);
 assert.match(ui,/img\.src = releasedUiArt[\s\S]{0,90}b13\/passive_/);
 assert.match(ui,/img\.src = releasedUiArt[\s\S]{0,100}charm-passive\/b11\/omamori_/);
 assert.match(ui,/if\(typeof window\.Image==="function" && releasedUiArt\)/);
 for(const id of ['dmg','shield','rate','spd','crit']) assert.ok(fs.existsSync(path.join(root,'assets/img/ui/b13/passive_'+id+'.webp')));
});
test('B15 real Boss painted slam and straight charge are published, prefetched, and never flash superseded slam raster',()=>{
 assert.match(renderer,/const releasedNightBossArt = \(\) => true/);
 assert.match(renderer,/const trial = releasedNightBossArt\(\) \? nightBossSpellImage/);
 assert.match(renderer,/const raster = releasedNightBossArt\(\) \? trial : nightBossSpellImage\("slam"\)/);
 assert.match(renderer,/for \(const kind of \["slam_earth_warning", "slam_earth_impact", "charge", "ring"\]\)/);
 for(const name of ['slam_earth_warning','slam_earth_impact','charge_single_b13'])assert.ok(fs.existsSync(path.join(root,'assets/img/vfx/boss-night-town',name+'.webp')));
});
test('B15 skill offer does not paint old icon/card while a released illustration loads',()=>{
 assert.match(ui,/const waitingForFormal = formalSkillIds\.has\(c\.id\) && !formalSkillFailed\.has\(c\.id\)/);
 assert.match(ui,/if \(waitingForFormal\) \{/);
 assert.match(ui,/const cardBoardImg = formalCard \? formalCardImage : null/);
 assert.match(read('index.html'),/20261101-s2b17/);
});
