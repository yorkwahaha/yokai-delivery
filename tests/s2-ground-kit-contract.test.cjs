'use strict';
// Revised for 2026-10-24 S2 source-unification: exactly 8 user-selected ground tiles,
// canonical source art/stage2-rain-port/scene, and twelve Nano scene cutouts.
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,p))).digest('hex');
const stage='art/stage2-rain-port/';
const ground=['g_stone_01','g_stone_02','g_stone_03','g_stone_04','g_wood_01','g_wood_02','g_wood_03','t_stone_wood_v01'];
const j=JSON.parse(read(stage+'manifest-dev-runtime.json'));
const src=read('js/assets.js');
test('one Stage2 source folder, art/s2 legacy directory is retired',()=>{
  assert.ok(!fs.existsSync(path.join(ROOT,'art/s2')));
  assert.ok(fs.existsSync(path.join(ROOT,stage+'scene')));
  assert.ok(fs.existsSync(path.join(ROOT,stage+'characters')));
  assert.match(src,/const S2_GROUND_KIT_BASE = 'art\/stage2-rain-port\/scene\//);
  assert.match(src,/art\/stage2-rain-port\/manifest-dev-runtime\.json/);
});
test('all 8 selected 1254px PNG ground originals exist and match retained source manifest',()=>{
  const entries=j.tiles.usable_runtime_tiles;
  const pool=[...entries.stoneVariants,...entries.woodVariants,...entries.transitions.h,...entries.transitions.v];
  assert.equal(pool.length,8);
  assert.deepEqual(pool.map(x=>x.id),ground);
  for(const obj of pool){
    assert.equal(obj.path,obj.path_webp);
    assert.ok(fs.existsSync(path.join(ROOT,obj.path)),obj.path);
    assert.equal(fs.readFileSync(path.join(ROOT,obj.path)).subarray(1,4).toString(),'PNG');
  }
  assert.equal((src.match(/id: 'g_stone_/g)||[]).length,4);
  assert.equal((src.match(/id: 'g_wood_/g)||[]).length,3);
  assert.ok(!src.includes("file: 't_stone_wood_h01.png'"));
  assert.ok(!src.includes("file: 't_stone_wood_c01.png'"));
});
test('12 selected Nano scenery sprites have source PNG and WebP under scene/',()=>{
  const a=[...j.buildings,...j.props,...j.environment];
  assert.equal(j.buildings.length,5);assert.equal(j.props.length,5);assert.equal(j.environment.length,2);
  for(const item of a){
    for(const key of ['path','path_webp']){
      assert.match(item[key],/^art\/stage2-rain-port\/scene\//);
      assert.ok(fs.existsSync(path.join(ROOT,item[key])),item[key]);
    }
  }
});
test('approved old Stage2 enemy images stay in characters/',()=>{
  const a=JSON.parse(read(stage+'manifest.json'));
  assert.equal(a.approved_enemy_files.length,8);
  for(const f of a.approved_enemy_files)assert.ok(fs.existsSync(path.join(ROOT,f)),f);
});
test('public release is a separate isolated worktree, never infer local art is live page',()=>{
  const d=JSON.parse(read('docs/STAGE_PATHS.json'));
  assert.equal(d.public_stages['rain-port'],'assets/img/rain-port/s2-production/');
  assert.equal(d.stages[1].selected_source,stage+'scene/');
});
test('dev gate stays strict and does not fetch stage two on normal homepage',()=>{
  assert.match(src,/s2ground=kit/);
  assert.match(src,/isS2GroundKitEnabled/);
  assert.match(src,/if \(S2_GROUND_KIT_CACHE\.enabled\) \{/);
});
