'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const game=fs.readFileSync('js/game.js','utf8');
const ui=fs.readFileSync('js/ui.js','utf8');
const world=fs.readFileSync('js/world.js','utf8');
const renderer=fs.readFileSync('js/renderer.js','utf8');
const html=fs.readFileSync('index.html','utf8');

test('final Boss regenerates 0 before 2m, 0.5% 2m, 1% 4m and only 200% total',()=>{
 const start=game.indexOf('    // Night-town final Boss: two phases');
 const end=game.indexOf('\n    // 百鬼夜行：',start);
 assert.ok(start>0 && end>start);
 const code=game.slice(start,end);
 const run=(bossAge,restored=0,hp=400,dt=1)=>{
  const boss={hp,max:1000,type:'boss',final:true,appearedAt:600,
    regenRestored:restored,healPulseT:0};
  const env={STAGE:{id:'night-town'},finalBossDefeated:false,
    enemies:[boss],elapsed:600+bossAge,dt,say:()=>{}};
  vm.runInNewContext('(function(){'+code+'})()',env,{timeout:1500});
  return boss;
 };
 assert.equal(run(119).hp,400);
 assert.equal(run(120).hp,405);
 assert.equal(run(239).hp,405);
 assert.equal(run(240).hp,410);
 const cap=run(300,1998,400,1);
 assert.equal(cap.hp,402);
 assert.equal(cap.regenRestored,2000);
 assert.equal(run(400,2000,400).hp,400);
});

test('multi-Boss click hitboxes receive same live bossCount as UI renderer',()=>{
 assert.match(game,/UI\.bossQuizLayout\(bossQ\.ans\.length, visibleBosses\)/);
 assert.match(game,/const visibleBosses = enemies\.filter\(e =>/);
 assert.match(game,/UI\.drawBossQuiz\(\s*ctx,\s*job\?\.reading \? null : bossQ, inputMode, liveBosses, sealFade, bossCurseRemaining/);
 assert.match(ui,/bossQuizLayout\(bossQ\?\.ans\.length \|\| 3,bosses\.length\)/);
 const starts=ui.indexOf('function bossQuizLayout(');
 const ends=ui.indexOf('function drawBossQuiz(',starts);
 const code=ui.slice(starts,ends);
 assert.ok(code.includes('Math.max(1,bossCount) * rowH'));
});

test('first-stage includes the already-shipped shrine as a third building variant',()=>{
 require('../js/delivery-lexicon.js');
 const C=require('../js/words.js'),W=require('../js/world.js');
 const w=W.createStageWorld(C.getStage('night-town'),C);
 const tally={};
 for(let cx=-8;cx<=8;cx++)for(let cy=-3;cy<=3;cy++)
  for(const h of w.getChunk(cx,cy).houses)tally[h.bType]=(tally[h.bType]||0)+1;
 for(const kind of ['house_shop','house_tavern','house_shrine'])
  assert.ok(tally[kind]>10,kind+': '+JSON.stringify(tally));
});

test('rain-port foundations and collisions share visible floor footprint',()=>{
 assert.match(world,/h\.bType === "port_fishmonger" \? 100\.5/);
 assert.match(renderer,/ctx\.ellipse\(h\.x, h\.y \+ 48, rx, ry/);
 assert.match(renderer,/rgba\(12, 15, 21, 0\.38\)/);
});

test('HoloCure-like equipped charms avoid a top-center boxed plaque',()=>{
 const functionText=ui.slice(ui.indexOf('  function drawCharmHud('),ui.indexOf('  // B10 approved layout:',ui.indexOf('  function drawCharmHud(')));
 assert.match(functionText,/const x=b\.left\+18\+lanternH\*lanternAspect\+8/,
   'worn charms hang to the right of the oil lantern, not on its glass');
 assert.doesNotMatch(functionText,/roundRect|裝備御守|panelW/);
 assert.match(ui,/const iconSize=slotSize\*\.87/);
 assert.match(ui,/bounds\.bottom - footerHeight \+ 1/);
});

test('water Boss circular slam uses water artwork in warning and impact',()=>{
 assert.match(renderer,/function paintHarborWaterSlam\(c, h, elapsed\)/);
 assert.match(renderer,/window\.BOSS_HAZARD_ART_IMG\?\.rainVortex/);
 assert.match(renderer,/if\(phase==="telegraph"\)/);
 assert.match(renderer,/if \(currentStageId\(\) === "rain-port" && kind === "slam"\)/);
 assert.match(renderer,/return paintHarborWaterSlam\(c,h,elapsed\)/);
 assert.match(html,/js\/renderer\.js\?v=20261108-crosscut-visual-r1/);
});
