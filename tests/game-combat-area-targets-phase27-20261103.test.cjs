'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const env={window:{}};
vm.runInNewContext(fs.readFileSync('tests/fixtures/unsorted-area-targets-original-phase27.js','utf8')+'\nthis.old={inkfire:originalInkfireTargets,duo:originalDuoShockTargets};',env);
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),env);
const current=()=>env.window.GAME_COMBAT_MATH.unsortedAreaTargets;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function equivalent(foes,area) {
 const a=env.old.inkfire(foes,area),b=env.old.duo(foes,area),c=current()(foes,area);
 assert.deepEqual(Array.from(c,e=>e.id),Array.from(a,e=>e.id));
 assert.deepEqual(Array.from(c,e=>e.id),Array.from(b,e=>e.id));
 for(let i=0;i<a.length;i++){assert.strictEqual(c[i],a[i]);assert.strictEqual(c[i],b[i]);}
}
test('Phase27 20k seeds compare exact filtering and unsorted first-three vs both Phase26 original algorithms',()=>{
 const r=rng(27027);
 for(let run=0;run<20000;run++){
  const area={x:64.25,y:-30.5,radius:[0,1,80,150,Infinity,NaN,-1][run%7]};
  const foes=Array.from({length:run%21},(_,i)=>{
   const ang=r()*Math.PI*2,d=run%4===0?80:Math.floor(r()*301);
   return {id:i,x:area.x+d*Math.cos(ang),y:area.y+d*Math.sin(ang),
     hp:run%19===0?0:1,shield:run%11===0&&i%2===0,
     vanish:run%13===0&&i%3===0,done:run%7===0&&i%5===0};
  });
  equivalent(foes,area);
 }
});
test('Phase27 radius inclusive, shield/dead/vanish/done exclusions, immutable inputs and strict original order',()=>{
 const area=Object.freeze({x:0,y:0,radius:100});
 const foes=Object.freeze([
  {id:'farther',x:100,y:0,hp:1},
  {id:'closer',x:1,y:0,hp:1},
  {id:'sealed',x:0,y:0,hp:1,shield:true},
  {id:'dead',x:0,y:0,hp:0},
  {id:'vanished',x:0,y:0,hp:1,vanish:true},
  {id:'done',x:0,y:0,hp:1,done:true},
  {id:'third',x:99,y:0,hp:1},
  {id:'fourth',x:5,y:0,hp:1},
  {id:'outside',x:100.001,y:0,hp:1}
 ].map(Object.freeze));
 equivalent(foes,area);
 assert.deepEqual(Array.from(current()(foes,area),e=>e.id),['farther','closer','third']);
 for(const radius of [0,99,100,100.001,Infinity,NaN,-1])equivalent(foes,{...area,radius});
 assert.strictEqual(foes[0].id,'farther');
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
});
test('Phase27 both delayed weapons() effects use identical helper; damage, order, queues remain in game.js',()=>{
 const game=fs.readFileSync('js/game.js','utf8');
 assert.equal((game.match(/GAME_COMBAT_MATH\.unsortedAreaTargets\(enemies, (?:im|sw)\)/g)||[]).length,2);
 assert.match(game,/im\.damageBudget \/ hitTargets\.length/);
 assert.match(game,/sw\.damageBudget \/ hitTargets\.length/);
 assert.doesNotMatch(fs.readFileSync('js/game-combat-math.js','utf8'),/Math\.random\s*\(/);
});
for(const kind of ['inkfire','duo']){
 test('Phase27 real VM '+kind+' queue hits first three eligible in enemy order and preserves shield',()=>{
  const g=loadGame({seed:271,stage:'night-town'});
  g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
  g.combatScene('katana',[
   {id:'far',dx:95,dy:0,hp:10000,max:10000,type:'ghost'},
   {id:'near',dx:10,dy:0,hp:10000,max:10000,type:'ghost'},
   {id:'sealed',dx:0,dy:0,hp:10000,max:10000,type:'boss',shield:true},
   {id:'third',dx:70,dy:0,hp:10000,max:10000,type:'ghost'},
   {id:'fourth',dx:5,dy:0,hp:10000,max:10000,type:'ghost'},
   {id:'outside',dx:500,dy:0,hp:10000,max:10000,type:'ghost'}
  ],[],0);
  const {x,y}=g.snapshot();
  g.queueDelayedCombatHit(kind,{x,y,radius:100,damageBudget:120,delay:0.01,triggered:false,life:1});
  g.weapons(.05);
  const foes=g.snapshot().enemies;
  for(const id of ['far','near','third'])assert.equal(foes.find(e=>e.id===id).hp,9960,id);
  for(const id of ['sealed','fourth','outside'])assert.equal(foes.find(e=>e.id===id).hp,10000,id);
 });
}
