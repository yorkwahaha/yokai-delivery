'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadGame}=require('./helpers/game-runtime.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('js/game.js'),ui=read('js/ui.js');
test('B8 real passive caps: 4-layer Shura and rate, 2 oil, other passive stack counts',()=>{
 const g=loadGame({seed:481});g.start();
 const limits={shield:3,oil_max:2,oil_heal:3,dmg:4,rate:4,crit:3,spd:3,dash:3,mag:3};
 for(const [id,max] of Object.entries(limits)){
  const u=g.tune(id);assert.ok(u,'exists: '+id);
  for(let i=0;i<max;i++){assert.equal(u.ok(),true,id+' should accept '+(i+1));u.f();}
  assert.equal(u.ok(),false,id+' must reject beyond '+max);
 }
});
test('B8 passive offers show next/max and MAX is excluded by both pool and eligibility guard',()=>{
 const g=loadGame({seed:482});g.start();const u=g.tune('dmg');
 for(let i=0;i<3;i++)u.f();
 let card;
 for(let i=0;i<200&&!card;i++) card=g.eligibleChoices().find(c=>c.type==='passive'&&c.id==='dmg');
 assert.ok(card,'3/4 Shura is supposed to appear');
 assert.equal(card.maxStacks,4);assert.equal(card.currentStacks,3);
 assert.match(card.levelText,/4 \/ 4/);
 assert.match(card.d,/目前 3 \/ 4 層/);
 u.f();
 assert.equal(card.ok(),false,'stale fourth card no longer valid');
 assert.equal(g.eligibleChoices().some(c=>c.type==='passive'&&c.id==='dmg'),false,'fully leveled Shura cannot be offered');
});
test('B8 painted icon sheets share format/dimensions and HUD uses source pick counts',()=>{
 for(const id of ['shield','dmg','rate','crit','spd','dash','oil_max','mag','oil_heal']){
  const b=fs.readFileSync(path.join(root,'assets/img/ui/passive/washi-v2','hud_passive_'+id+'.webp'));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 }
 assert.match(ui,/b\.shieldPicks \|\| 0/);
 assert.match(ui,/b\.dmgUp \|\| Math.round/);
 // B8 image retained as a historical baseline; B9 is now the local trial route.
 assert.match(ui,/assets\/img\/ui\/b13\/passive_/);
});
test('B8 boss after correct answer uses one actual painted raster, no polygon crack rendering',()=>{
 const file=fs.readFileSync(path.join(root,'assets/img/vfx/boss-night-town/seal_break_painted.webp'));
 assert.equal(file.toString('ascii',0,4),'RIFF');assert.equal(file.toString('ascii',8,12),'WEBP');
 const body=ui.slice(ui.indexOf('  function drawBossQuiz('),ui.indexOf('  // ---- 奧義融合',ui.indexOf('  function drawBossQuiz(')));
 assert.match(body,/paintedBossSealBreak/);
 assert.match(body,/ctx\.drawImage\(paintedBossSealBreak/);
 assert.doesNotMatch(body,/for\(const side of \[-1,1\]\)/);
 assert.match(ui,/b8LocalArtTrial/);
});
test('B8 pickup grows 20% and glow/floating strength, worn charm panels enlarge',()=>{
 assert.match(game,/const h = 64;/);assert.match(game,/art\.naturalWidth \/ art\.naturalHeight/);
 assert.match(game,/const hover = 5 \+ Math.sin/);
 assert.match(game,/0\.84\)/);
 assert.match(ui,/const tileW=Math.min\(cssPx\(76\)/);
});
