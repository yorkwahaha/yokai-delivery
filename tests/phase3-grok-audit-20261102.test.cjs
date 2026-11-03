'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const gameSrc=fs.readFileSync('js/game.js','utf8');
const audioSrc=fs.readFileSync('js/audio.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('phase 3: guard charm reducer is pure and numerically identical',()=>{
 const env={window:{}};vm.runInNewContext(fs.readFileSync('js/game-charm-math.js','utf8'),env);
 const reducer=env.window.GAME_CHARM_MATH.guardOilLoss;
 for(const amount of [0,1,4.5,20,100,0.00000000001,300.999]){
  for(const lv of [0,1,2,3]){
   const expected=lv<=0?amount:Math.min(amount,Math.max(Number.MIN_VALUE,parseFloat((amount*(1-.10*lv)).toPrecision(12))));
   assert.equal(reducer(amount,lv),expected,JSON.stringify({amount,lv}));
  }
 }
 assert.match(gameSrc,/window\.GAME_CHARM_MATH\.guardOilLoss\(amount, charmLevelOf\("charm_guard"\)\)/);
 assert.ok(html.indexOf('js/game-charm-math.js')>0&&html.indexOf('js/game-charm-math.js')<html.indexOf('js/game.js'));
});

test('rain-port collision half-width matches each rendered facade, without changing y bands',()=>{
 require('../js/delivery-lexicon.js');
 const C=require('../js/words.js'),W=require('../js/world.js');
 const world=W.createStageWorld(C.getStage('rain-port'),C);
 const observed=new Set();
 for(const x of [-3500,-1500,0,1800,3600]){
  const view=world.update(x,320);
  for(let i=0;i<view.houses.length;i++){
   const h=view.houses[i];
   const solid=view.solids[i];
   const width=h.bType==='port_fishmonger'?100.5:93.5;
   if(!['port_fishmonger','port_warehouse'].includes(h.bType))continue;
   observed.add(h.bType);
   assert.equal(solid.x0,h.x-width);
   assert.equal(solid.x1,h.x+width);
   assert.equal(solid.y0,h.y-48);
   assert.equal(solid.y1,h.y+45);
  }
 }
 assert.equal(observed.size,2,'both approved building types covered');
});

test('Boss answer cards are not rendered while a delivery reading blocks clicking',()=>{
 assert.match(gameSrc,/if \(bossQ && !job\?\.reading\)/);
 assert.match(gameSrc,/UI\.drawBossQuiz\(\s*ctx,\s*job\?\.reading \? null : bossQ, inputMode, liveBosses, sealFade, bossCurseRemaining/);
 assert.match(fs.readFileSync('js/ui.js','utf8'),/if \(!bossQ\) \{/);
});

test('grok dt=1.2: an opened rain-port slam signals warning and impact exactly once',()=>{
 const {loadGame}=require('./helpers/game-runtime.cjs');
 const g=loadGame({stage:'rain-port',seed:17});
 g.start();g.stopSpawns();g.clearOrders();
 g.prepareBoss();
 const bs=g.snapshot().enemies.find(e=>e.type==='boss');
 assert.ok(bs);
 Object.assign(bs,{shield:false,bossIndex:0,attackCd:0,speed:0,flash:0,slowT:0});
 g.update(1.2);
 assert.equal(bs.hazard?.kind,'slam');
 assert.equal(bs.hazard.phase,'active');
 let sound=g.audioCalls.filter(n=>n==='rainPortWaterSlamWarn'||n==='rainPortWaterSlamImpact');
 assert.deepEqual(sound,['rainPortWaterSlamWarn','rainPortWaterSlamImpact']);
 g.update(.05);
 sound=g.audioCalls.filter(n=>n==='rainPortWaterSlamWarn'||n==='rainPortWaterSlamImpact');
 assert.deepEqual(sound,['rainPortWaterSlamWarn','rainPortWaterSlamImpact']);
});

test('typical 50ms frames: warn on slam start, impact on activation, no duplicates',()=>{
 const {loadGame}=require('./helpers/game-runtime.cjs');
 const g=loadGame({stage:'rain-port',seed:18});
 g.start();g.stopSpawns();g.clearOrders();g.prepareBoss();
 const bs=g.snapshot().enemies.find(e=>e.type==='boss');
 Object.assign(bs,{shield:false,bossIndex:0,attackCd:0,speed:0,flash:0});
 for(let i=0;i<26;i++)g.update(.05);
 const sound=g.audioCalls.filter(n=>n==='rainPortWaterSlamWarn'||n==='rainPortWaterSlamImpact');
 assert.deepEqual(sound,['rainPortWaterSlamWarn','rainPortWaterSlamImpact']);
});

test('optional OGG on HTMLAudio network failure is marked missing (no repeated request)',()=>{
 const start=audioSrc.indexOf('  function playExternalSfx(name, fallback, args, buffered = true) {');
 const end=audioSrc.indexOf('\n  // 接單、提示、送達與誤配',start);
 assert.ok(start>0&&end>start);
 const played=[];const instances=[];
 const environment={
  muted:false,suspended:false,
  SFX_FILES:{rainPortWaterSlamWarn:'missing.ogg'},SFX_VOLUME:{rainPortWaterSlamWarn:.65},
  sfxRequests:new Map(),unavailableSfx:new Set(),sfxVoices:new Map(),activeSfx:new Set(),
  playBuffer:()=>false,wordDucking:false,
  replaceSfx:()=>{},
  window:{audioAsset:s=>s},
  Audio:class {
   constructor(src){this.src=src;this.error={code:2};this.handlers={};instances.push(this);}
   addEventListener(name,callback){this.handlers[name]=callback;}
   play(){played.push(this.src);this.handlers.error?.(new Error('HTTP 404'));return Promise.resolve();}
   pause(){}
  }
 };
 vm.runInNewContext(audioSrc.slice(start,end)+'\nthis.playExternalSfx=playExternalSfx;',environment);
 let fallback=0;
 environment.playExternalSfx('rainPortWaterSlamWarn',()=>fallback++,[]);
 environment.playExternalSfx('rainPortWaterSlamWarn',()=>fallback++,[]);
 assert.equal(instances.length,1,'no second missing OGG network request');
 assert.equal(fallback,2);
 assert.equal(environment.unavailableSfx.has('rainPortWaterSlamWarn'),true);
});
