'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('rain-port deliveries now average less than 1.7x night-town, without missing starts',()=>{
 const means={};
 for(const stage of ['night-town','rain-port']){
  const distances=[];
  for(let seed=10;seed<40;seed++){
   const g=loadGame({stage,seed});
   g.start();g.stopSpawns();
   const first=g.snapshot().orders[0];
   assert.ok(first,stage+' must offer a delivery');
   distances.push(Math.hypot(first.from.x-first.to.x,first.from.y-first.to.y));
  }
  means[stage]=distances.reduce((a,b)=>a+b,0)/distances.length;
 }
 assert.ok(means['rain-port']<means['night-town']*1.7,JSON.stringify(means));
});

test('Boss health UI draws all live bosses with readable ordered labels',()=>{
 const labels=[],w=960,h=540;
 class MockImage {set src(v){this._src=v;this.naturalWidth=500;this.naturalHeight=500;this.onload?.();}get src(){return this._src;}}
 const window={location:{search:''},Image:MockImage,innerWidth:w,innerHeight:h,VIEWPORT:{
  bounds:()=>({left:0,top:0,right:w,bottom:h,width:w,height:h}),
  hudBounds:()=>({left:0,top:0,right:w,bottom:h,width:w,height:h}),
  get:()=>({scale:1})
 },ART:{}};
 const grad=()=>({addColorStop(){}});
 const ctx=new Proxy({canvas:{width:w,height:h},measureText:t=>({width:String(t).length*10}),
  fillText:(t)=>labels.push(String(t)),createLinearGradient:grad,createRadialGradient:grad},{get:(o,k)=>k in o?o[k]:()=>{}});
 vm.runInNewContext(fs.readFileSync('js/ui.js','utf8'),{window,document:{fonts:{check:()=>true}},location:{search:''},URLSearchParams,console,Date,Math});
 window.UI.drawBossQuiz(ctx,null,'keyboard',[
 {hp:100,max:200,bossIndex:0,title:'大妖甲'},
 {hp:300,max:400,bossIndex:1,title:'大妖乙'},
 {hp:500,max:600,final:true,bossIndex:3,title:'終焉王'}
 ],0);
 assert.deepEqual(labels.filter(t=>t.includes('大妖甲')||t.includes('大妖乙')||t.includes('終焉王')),[
 '第1王  大妖甲','第2王  大妖乙','終王  終焉王'
 ]);
 assert.ok(labels.filter(t=>t.endsWith('%')).length===3);
});

test('candidate water Boss effects load for stage2 playtest only; stage1 gate remains closed',async()=>{
 const images=[];
 class MockImage {constructor(){images.push(this);}set src(v){this._src=v;}get src(){return this._src;}}
 class Audio {addEventListener(){}}
 const env={console,Image:MockImage,Audio,Date,location:{search:''},fetch:async()=>({ok:false,json:async()=>({})})};
 env.window=env;
 vm.runInNewContext(fs.readFileSync('js/assets.js','utf8'),env);
 assert.equal(env.isBossHazardArtEnabled(),false);
 env.__ACTIVE_STAGE='rain-port';
 assert.equal(env.isBossHazardArtEnabled(),true);
 env.refreshBossHazardArt();
 const src=images.map(i=>i.src).filter(s=>s?.includes('boss-water-r8/'));
 assert.equal(src.length,3);
 for(const file of ['tide_v03.webp','tidalFan_v01.webp','rainVortex_v01.webp'])
  assert.ok(src.some(s=>s.includes(file)),file+' not requested');
 env.__ACTIVE_STAGE='night-town';
 assert.equal(env.isBossHazardArtEnabled(),false);
});

test('stage2 art is revealed only when complete, not as the first few WebP arrive',async()=>{
 const images=[];
 class MockImage {constructor(){this.naturalWidth=0;this.naturalHeight=0;images.push(this);}
  set src(v){this._src=v;}get src(){return this._src;}}
 class Audio {addEventListener(){}}
 const mk=(id)=>({id,path_webp:'assets/img/test/'+id+'.webp'});
 const manifest={stages:{'rain-port':{
   tiles:{usable_runtime_tiles:{stoneVariants:[mk('g_stone_01')],woodVariants:[mk('g_wood_01')],
      transitions:{h:[],v:[]}}},
   buildings:[mk('building_port_warehouse'),mk('building_fish_workshop')],
   props:[mk('prop_anchor_gear'),mk('prop_cargo_crates')],
   environment:[mk('surface_sea_canonical')]
 }}};
 const env={console,Image:MockImage,Audio,Date,location:{search:''},
  fetch:async()=>({ok:true,json:async()=>structuredClone(manifest)})};
 env.window=env;
 vm.runInNewContext(fs.readFileSync('js/assets.js','utf8'),env);
 env.STAGE_ART_RESOLVER.setActiveStage('rain-port');
 env.__ACTIVE_STAGE='rain-port';
 const task=env.loadS2ArtProdAssets();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(env.S2_ART_PROD_CACHE.loaded,false);
 assert.equal(env.S2_ART_PROD_CACHE.finished,false);
 const handled=new Set();
 for(let cycle=0;cycle<150;cycle++){
  await Promise.resolve();await Promise.resolve();
  const pending=images.filter(i=>i.src?.includes('assets/img/test/')&&!handled.has(i));
  for(const img of pending){
   handled.add(img);img.naturalWidth=1024;img.naturalHeight=1024;img.onload?.();
  }
  if(env.S2_ART_PROD_CACHE.finished)break;
 }
 await task;
 assert.equal(env.S2_ART_PROD_CACHE.finished,true);
 assert.equal(env.S2_ART_PROD_CACHE.loaded,true);
 assert.ok(env.getS2Buildings()?.length===2);
 assert.ok(env.getS2Props()?.length===2);
});
