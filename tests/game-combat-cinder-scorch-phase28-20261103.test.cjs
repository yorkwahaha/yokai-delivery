'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const env={window:{}};
vm.runInNewContext(fs.readFileSync('tests/fixtures/cinder-scorch-targets-original-phase28.js','utf8')+'\nthis.original=originalCinderScorchTargets;',env);
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),env);
const current=()=>env.window.GAME_COMBAT_MATH.cinderScorchTargets;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function equivalent(enemies,scorch,zones,elapsed){
 const before=env.original(enemies,scorch,zones,elapsed),after=current()(enemies,scorch,zones,elapsed);
 assert.deepEqual(Array.from(after,e=>e.id),Array.from(before,e=>e.id));
 for(let i=0;i<before.length;i++)assert.strictEqual(after[i],before[i]);
}
test('Phase28 20,000 seeded cases match original cinder filter, cooldown and dragon priority',()=>{
 const r=rng(28028);
 for(let run=0;run<20000;run++){
  const elapsed=[0,1,10,NaN,Infinity][run%5];
  const scorch={x:13.5,y:-24.25,r:[0,1,64,150,-1,NaN,Infinity][run%7]};
  const zones=Array.from({length:run%5},(_,i)=>({
   x:scorch.x+(r()-.5)*200,y:scorch.y+(r()-.5)*200,
   r:[-1,0,35,80,Infinity,NaN][(run+i)%6],
   life:[-1,0,1,3,Infinity,NaN][(run+i)%6],
   isCinder:run%3===0&&i%2===0
  }));
  const enemies=Array.from({length:run%23},(_,i)=>{
   const d=r()*240,angle=r()*Math.PI*2;
   return {id:i,x:scorch.x+Math.cos(angle)*d,y:scorch.y+Math.sin(angle)*d,
    hp:[-1,0,1,100,NaN][(run+i)%5],shield:run%11===0&&i%2===0,
    vanish:run%13===0&&i%3===0,done:run%17===0&&i%4===0,
    scorchReady:[undefined,-1,0,2,10,Infinity,NaN][(run+i)%7]};
  });
  equivalent(enemies,scorch,zones,elapsed);
 }
});
test('Phase28 keeps enemy order, inclusive radius, cooldown strictness, input identity',()=>{
 const scorch=Object.freeze({x:0,y:0,r:100});
 const zones=Object.freeze([Object.freeze({x:50,y:0,r:10,life:2,isCinder:false}),
  Object.freeze({x:10,y:0,r:15,life:5,isCinder:true}),
  Object.freeze({x:99,y:0,r:10,life:0,isCinder:false})]);
 const enemies=Object.freeze([
  {id:'far',x:-100,y:0,hp:1},
  {id:'cooldown',x:0,y:0,hp:1,scorchReady:11},
  {id:'near',x:10,y:0,hp:1,scorchReady:10},
  {id:'dragon-covered',x:50,y:0,hp:1},
  {id:'shielded',x:0,y:0,hp:1,shield:true},
  {id:'dead',x:0,y:0,hp:0},
  {id:'vanished',x:0,y:0,hp:1,vanish:true},
  {id:'done',x:0,y:0,hp:1,done:true},
  {id:'third',x:-99,y:0,hp:1},
  {id:'fourth',x:0,y:0,hp:1}
 ].map(Object.freeze));
 equivalent(enemies,scorch,zones,10);
 assert.deepEqual(Array.from(current()(enemies,scorch,zones,10),e=>e.id),['far','near','third']);
 for(const radius of [0,99,100,100.001,Infinity,NaN,-1])equivalent(enemies,{...scorch,r:radius},zones,10);
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
});
test('Phase28 live dragon wins while expired dragon and cinder areas do not block',()=>{
 const enemies=[{id:0,x:0,y:0,hp:1,scorchReady:5},{id:1,x:5,y:0,hp:1}];
 const scorch={x:0,y:0,r:10};
 for(const zones of [[{x:0,y:0,r:5,life:1}],
  [{x:0,y:0,r:5,life:0}],
  [{x:0,y:0,r:5,life:2,isCinder:true}],
  [{x:0,y:0,r:5,life:-2}]])equivalent(enemies,scorch,zones,5);
 assert.deepEqual(Array.from(current()(enemies,scorch,[{x:0,y:0,r:5,life:1}],5),e=>e.id),[]);
 assert.deepEqual(Array.from(current()(enemies,scorch,[{x:0,y:0,r:5,life:0}],5),e=>e.id),[0,1]);
 assert.deepEqual(Array.from(current()(enemies,scorch,[],4.999),e=>e.id),[1]);
 assert.deepEqual(Array.from(current()(enemies,scorch,[],5),e=>e.id),[0,1]);
});
test('Phase28 delegates only target selection; hit budget, cooldown and effects remain',()=>{
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/GAME_COMBAT_MATH\.cinderScorchTargets\(enemies, scorch, dragonScorches, elapsed\)/);
 assert.match(game,/scorch\.damageBudget \/ hitTargets\.length/);
 assert.match(game,/e\.scorchReady = Math\.max\(e\.scorchReady \|\| 0, elapsed \+ 0\.3\)/);
 assert.doesNotMatch(fs.readFileSync('js/game-combat-math.js','utf8'),/Math\.random\s*\(/);
});
test('Phase28 real VM cinder hits first three and excludes live dragon, cooldown, shield',()=>{
 const g=loadGame({seed:281,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('katana',[
  {id:'far',dx:-95,hp:10000,max:10000,type:'ghost'},
  {id:'near',dx:10,hp:10000,max:10000,type:'ghost'},
  {id:'shielded',dx:0,hp:10000,max:10000,type:'boss',shield:true},
  {id:'covered',dx:130,hp:10000,max:10000,type:'ghost'},
  {id:'cooldown',dx:30,hp:10000,max:10000,type:'ghost',scorchReady:11},
  {id:'third',dx:70,hp:10000,max:10000,type:'ghost'},
  {id:'fourth',dx:5,hp:10000,max:10000,type:'ghost'},
  {id:'outside',dx:500,hp:10000,max:10000,type:'ghost'}
 ],[],0);
 const {x,y}=g.snapshot();
 g.setElapsed(10);
 g.queueDragonScorch({x:x+130,y,r:20,life:3,maxLife:5,tick:99,scorchDamage:5});
 g.queueDragonScorch({x,y,r:160,life:1,maxLife:1,delay:.01,ticked:false,isCinder:true,damageBudget:120});
 g.weapons(.05);
 const foes=g.snapshot().enemies;
 for(const id of ['far','near','third'])assert.equal(foes.find(e=>e.id===id).hp,9960,id);
 for(const id of ['shielded','covered','cooldown','fourth','outside'])assert.equal(foes.find(e=>e.id===id).hp,10000,id);
});
