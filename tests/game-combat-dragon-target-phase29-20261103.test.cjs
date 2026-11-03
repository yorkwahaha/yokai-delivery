'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const env={window:{}};
vm.runInNewContext(fs.readFileSync('tests/fixtures/dragon-fire-target-original-phase29.js','utf8')+'\nthis.original=originalDragonFireTarget;',env);
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),env);
const current=()=>env.window.GAME_COMBAT_MATH.dragonFireTarget;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function equivalent(foes,player){
 const before=env.original(foes,player),after=current()(foes,player);
 assert.strictEqual(after,before,'returned target must be identical input object');
}
test('Phase29 20,000 seeded cases preserve old forward-cone, fallback and densest-cluster selection',()=>{
 const r=rng(29029);
 for(let run=0;run<20000;run++){
  const player=Object.freeze({x:63.25,y:-23.5,faceAng:[0,.4,-2.7,3.12,-3.12,NaN,Math.PI*4+0.2][run%7]});
  const foes=Array.from({length:run%21},(_,i)=>{
   const a=r()*Math.PI*2,d=[90,140,560,Math.floor(r()*800)][(run+i)%4];
   return {id:i,x:player.x+Math.cos(a)*d,y:player.y+Math.sin(a)*d,
    hp:[-1,0,1,NaN,100][(run+i)%5],shield:run%11===0&&i%3===0};
  });
  equivalent(foes,player);
 }
});
test('Phase29 prefers facing targets, exact boundaries and the first tied cluster in original order',()=>{
 const player=Object.freeze({x:0,y:0,faceAng:0});
 const foes=Object.freeze([
  {id:'ahead-first',x:100,y:0,hp:1},
  {id:'ahead-near',x:120,y:15,hp:1},
  {id:'behind-cluster',x:-100,y:0,hp:1},
  {id:'ahead-last',x:140,y:-15,hp:1},
  {id:'outside',x:561,y:0,hp:1},
  {id:'shield',x:110,y:0,hp:1,shield:true},
  {id:'dead',x:105,y:0,hp:0}
 ].map(Object.freeze));
 equivalent(foes,player);
 assert.strictEqual(current()(foes,player),foes[0]);
 for(const a of [0,Math.PI/2,Math.PI,-Math.PI,1.15,1.151])equivalent(foes,{...player,faceAng:a});
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
});
test('Phase29 fallback uses strict 90..560; ahead uses inclusive limits',()=>{
 const p={x:0,y:0,faceAng:0};
 const foes=[{id:'min',x:-90,y:0,hp:1},{id:'interior',x:-120,y:0,hp:1},{id:'max',x:-560,y:0,hp:1}];
 equivalent(foes,p);
 assert.strictEqual(current()(foes,p),foes[1],'fallback excludes 90 and 560');
 const atBounds=[{id:'min',x:90,y:0,hp:1},{id:'max',x:560,y:0,hp:1}];
 equivalent(atBounds,p);
 assert.strictEqual(current()(atBounds,p),atBounds[0],'forward cone includes 90 and 560');
 equivalent([{id:'nan-hp',x:120,y:0,hp:NaN}],p);
});
test('Phase29 real weapons() Lv5 dragon chooses first densest forward cluster',()=>{
 const g=loadGame({seed:291,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('fire',[
  {id:'first',dx:160,dy:0,hp:10000,max:10000},
  {id:'second',dx:200,dy:10,hp:10000,max:10000},
  {id:'behind',dx:-150,dy:0,hp:10000,max:10000},
  {id:'third',dx:210,dy:-10,hp:10000,max:10000},
  {id:'isolated',dx:490,dy:0,hp:10000,max:10000}
 ],[],5);
 g.face(0);
 g.weapons(.02);
 assert.deepEqual(Array.from(g.dragonTargetIds()),['first']);
});
test('Phase29 real weapons() Lv5 dragon fallback picks behind cluster when forward empty',()=>{
 const g=loadGame({seed:292,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('fire',[
  {id:'far-edge',dx:-560,dy:0,hp:10000,max:10000},
  {id:'behind-first',dx:-180,dy:0,hp:10000,max:10000},
  {id:'behind-second',dx:-195,dy:15,hp:10000,max:10000},
  {id:'near-edge',dx:-90,dy:0,hp:10000,max:10000}
 ],[],5);
 g.face(0);
 g.weapons(.02);
 assert.deepEqual(Array.from(g.dragonTargetIds()),['behind-first']);
});
test('Phase29 target helper does not own dragon spawn, random spread, damage or render',()=>{
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/GAME_COMBAT_MATH\.dragonFireTarget\(enemies, P\)/);
 assert.match(game,/EVOLUTIONS\.dragon\(P,face>0\?0:Math\.PI,Math\.random\(\)\*6\.283/);
 assert.match(game,/dragonDirectDmg = dragonSpec\.dragonDirectDmg/);
 assert.doesNotMatch(fs.readFileSync('js/game-combat-math.js','utf8'),/Math\.random\s*\(/);
});
