// Public Stage2 release contract; does not depend on ignored raw art/scratch sources.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const j=JSON.parse(read('assets/img/rain-port/s2-production/asset-manifest.json'));
const inventory=JSON.parse(read('assets/img/rain-port/s2-production/source-inventory.json'));
const assets=read('js/assets.js'),html=read('index.html'),renderer=read('js/renderer.js');
test('stage2 manifest publishes 5 buildings, 5 props and two environment illustrations',()=>{
  assert.equal(j.stage_id,'rain-port');
  assert.equal(j.buildings.length,5);
  assert.equal(j.props.length,5);
  assert.deepEqual(j.environment.map(x=>x.id).sort(),['cliff_north_rock','surface_sea_canonical']);
});
test('public WebP bundle is served by assets tree and every file hashes to provenance inventory',()=>{
  assert.equal(inventory.files.length,20);
  let total=0;
  for(const x of inventory.files){
    assert.match(x.file,/^assets\/img\/rain-port\/s2-production\/.*\.webp$/);
    const b=fs.readFileSync(path.join(root,x.file));
    assert.equal(b.subarray(0,4).toString(),'RIFF',x.file);
    assert.equal(b.subarray(8,12).toString(),'WEBP',x.file);
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'),x.sha256,x.file);
    total+=b.length;
  }
  assert.ok(total<5.1e6,'production budget, including buildings/sea/rock, <5.1MB');
});
test('every manifest source WebP points at real shipped asset',()=>{
  const t=j.tiles.usable_runtime_tiles;
  const entries=[...t.stoneVariants,...t.woodVariants,...t.transitions.h,...t.transitions.v,...j.buildings,...j.props,...j.environment];
  for(const item of entries){
    assert.equal(item.path_webp,item.path);
    assert.ok(fs.existsSync(path.join(root,item.path_webp)),item.path_webp);
  }
});
test('all 8 real S2 ground/shore tiles are served; never request unavailable unused transition types',()=>{
  const specs=assets.slice(assets.indexOf('const S2_GROUND_KIT_SPECS'),assets.indexOf('const S2_GROUND_KIT_PLACEMENT'));
  assert.equal((specs.match(/Object.freeze\(\{ id: '/g)||[]).length,8);
  assert.ok(!specs.includes("id: 't_stone_wood_h01'"));
  assert.ok(!specs.includes("id: 't_stone_wood_c01'"));
  assert.ok(assets.includes("const S2_GROUND_KIT_WEBP_BASE = 'assets/img/rain-port/s2-production/';"));
});
test('normal play uses new S2 scene; s2legacy=1 is a deliberate opt-out',()=>{
  const src=assets.slice(assets.indexOf('const isS2ArtProdEnabled'),assets.indexOf('// S2 Production Art asset cache'));
  assert.ok(src.includes('s2legacy=1')); assert.ok(!src.includes('hasDev && hasStage'));
  const kit=assets.slice(assets.indexOf('const isS2GroundKitEnabled'),assets.indexOf('// Observed orientation'));
  assert.ok(kit.includes('s2legacy=1')); assert.ok(kit.includes('=> true'));
});
test('Stage2 kit starts only on stage entry, never at the home/overworld screen',()=>{
  assert.match(assets,/if \(window\.isS2GroundKitEnabled\?\.\(\)\) void window\.loadS2GroundKit\?\.\(\)/);
  const init=assets.slice(assets.indexOf('window.__S2_GROUND_KIT_EVIDENCE'),assets.indexOf('if (typeof window !== "undefined") {\n  window.isS2ArtProdEnabled'));
  assert.doesNotMatch(init,/loadS2GroundKit\(\)/);
});
test('new ocean and north rock use published WebP URLs',()=>{
  assert.match(assets,/assets\/img\/rain-port\/s2-production\/environment\/surface_sea_canonical\.webp/);
  assert.match(assets,/assets\/img\/rain-port\/s2-production\/environment\/cliff_north_rock\.webp/);
  assert.match(renderer,/paintCoastSeaBand/);
});
test('unnecessary source candidate requests cannot occur on normal stage2 entrance',()=>{
  assert.match(assets,/\.\.\.\(isPortArtCandidateEnabled\(\) \? RAIN_PORT_CANDIDATE_ASSETS : \{\}\)/);
});
test('JS cache key changed for new release; media cache contains new WebP references',()=>{
  for(const name of ['assets','renderer','overworld','game'])assert.ok(html.includes('js/'+name+'.js?v=20261024-s2-release1'));
  const sw=read('service-worker.js');
  assert.ok(sw.includes('s2-production/g_stone_01.webp'));
  assert.ok(sw.includes('s2-production/environment/surface_sea_canonical.webp'));
});
test('approved large overworld map retained in unchanged published asset location',()=>{
  const img=fs.readFileSync(path.join(root,'assets/img/overworld_approved_v2.webp'));
  assert.ok(img.length>900000);
  assert.match(read('js/overworld.js'),/root\.ART\?\.overworld_approved_v2/);
});
