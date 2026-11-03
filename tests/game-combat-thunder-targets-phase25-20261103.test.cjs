'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const env={window:{}};
vm.runInNewContext(fs.readFileSync('tests/fixtures/thunder-targets-original-phase25.js','utf8')+'\nthis.old=originalThunderTargetSelection;',env);
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),env);
const old=env.old;
const current=()=>env.window.GAME_COMBAT_MATH.thunderTargetSelection;
const ids=a=>Array.from(a,x=>x.id);
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function same(enemies,p,spec) {
 const a=old(enemies,p,spec), b=current()(enemies,p,spec);
 assert.deepEqual(ids(b.candidates),ids(a.candidates));
 assert.deepEqual(ids(b.primaryTargets),ids(a.primaryTargets));
 for(let i=0;i<a.candidates.length;i++)assert.strictEqual(b.candidates[i],a.candidates[i]);
 for(let i=0;i<a.primaryTargets.length;i++)assert.strictEqual(b.primaryTargets[i],a.primaryTargets[i]);
}
test('Phase25 20k deterministic multi-enemy selections exactly equal original filter/order/limit',()=>{
 const r=rng(25025),p={x:41.5,y:-28.25};
 for(let run=0;run<20000;run++) {
  const enemies=Array.from({length:run%23},(_,i)=>{
   const angle=r()*Math.PI*2,d=run%7===0?100:Math.floor(r()*401);
   return {id:i,x:p.x+Math.cos(angle)*d,y:p.y+Math.sin(angle)*d,
    hp:run%17===0?0:1,shield:run%13===0&&i%2===0,vanish:run%11===0&&i%3===0,done:run%7===0&&i%5===0,
    type:['ghost','shooter','shiome','tank','boss'][i%5]};
  });
  const spec={radius:[0,100,250,400,Infinity,NaN,-1][run%7],level:run%5+1,hasFocus:run%4===0,
    targetCount:[0,1,2,3,5,10,Infinity,-1,NaN][run%9]};
  same(enemies,p,spec);
 }
});
test('Phase25 stable tie ordering and exact radius boundaries and shield/exclusion flags',()=>{
 const p=Object.freeze({x:0,y:0});
 const enemies=Object.freeze([
  {id:'ghost-a',x:100,y:0,hp:100,type:'ghost'},
  {id:'shooter-a',x:0,y:100,hp:100,type:'shooter'},
  {id:'tank',x:-100,y:0,hp:100,type:'tank'},
  {id:'boss',x:0,y:-100,hp:100,type:'boss'},
  {id:'shooter-b',x:60,y:80,hp:100,type:'shooter'},
  {id:'sealed',x:0,y:1,hp:100,shield:true,type:'boss'},
  {id:'dead',x:0,y:1,hp:0,type:'boss'},
  {id:'vanish',x:0,y:1,hp:100,vanish:true,type:'boss'},
  {id:'done',x:0,y:1,hp:100,done:true,type:'boss'},
  {id:'outside',x:100.0001,y:0,hp:100,type:'boss'}
 ].map(Object.freeze));
 for(const level of [1,3,4,5])for(const hasFocus of [true,false])
  for(const radius of [0,99.999,100,100.0001,Infinity])
   for(const targetCount of [0,1,2,3,5,50,-1])same(enemies,p,{level,hasFocus,radius,targetCount});
 assert.deepEqual(ids(current()(enemies,p,{level:4,hasFocus:false,radius:100,targetCount:5}).primaryTargets),
  ['boss','shooter-a','shooter-b','tank','ghost-a']);
 assert.deepEqual(ids(current()(enemies,p,{level:2,hasFocus:false,radius:100,targetCount:5}).primaryTargets),
  ['ghost-a','shooter-a','tank','boss','shooter-b']);
});
test('Phase25 pure module neither mutates targets nor consumes random',()=>{
 const e=Object.freeze({x:4,y:0,hp:2,type:'boss'}),p=Object.freeze({x:0,y:0}),foes=Object.freeze([e]);
 const result=current()(foes,p,{radius:4,level:5,hasFocus:true,targetCount:3});
 assert.strictEqual(result.primaryTargets[0],e);
 assert.strictEqual(foes[0],e);
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
 assert.doesNotMatch(fs.readFileSync('js/game-combat-math.js','utf8'),/Math\.random\s*\(/);
});
test('Phase25 production thunder shares selection across normal and level5 strike paths',()=>{
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/GAME_COMBAT_MATH\.thunderTargetSelection\(enemies, P, spec\)/);
 assert.match(game,/const anchors = selectedTargets;/);
 assert.match(game,/for \(const e of selectedTargets\)/);
});
test('Phase25 real weapon VM: equal-distance thunder strikes, sealed and far foes safe',()=>{
 const g=loadGame({seed:255,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('thunder',[
  {id:'first',dx:90,dy:0,hp:10000,max:10000,type:'ghost'},
  {id:'second',dx:0,dy:90,hp:10000,max:10000,type:'ghost'},
  {id:'sealed',dx:1,dy:0,hp:10000,max:10000,type:'boss',shield:true},
  {id:'outside',dx:2000,dy:0,hp:10000,max:10000,type:'boss'}
 ],[],1);
 g.armWeapons();g.weapons(.05);
 const foes=g.snapshot().enemies;
 assert.ok(foes.find(e=>e.id==='first').hp<10000);
 assert.equal(foes.find(e=>e.id==='sealed').hp,10000);
 assert.equal(foes.find(e=>e.id==='outside').hp,10000);
});
test('Phase25 real level4 thunder ranks boss, shooters, then tank ahead of nearer ghost',()=>{
 const g=loadGame({seed:256,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('thunder',[
  {id:'ghost',dx:70,dy:0,hp:10000,max:10000,type:'ghost'},
  {id:'tank',dx:220,dy:0,hp:10000,max:10000,type:'tank'},
  {id:'shooter',dx:300,dy:0,hp:10000,max:10000,type:'shooter'},
  {id:'boss',dx:400,dy:0,hp:10000,max:10000,type:'boss'}
 ],[],4);
 g.armWeapons();g.weapons(.05);
 const foes=g.snapshot().enemies;
 for(const id of ['boss','shooter','tank'])assert.ok(foes.find(e=>e.id===id).hp<10000,id);
 assert.equal(foes.find(e=>e.id==='ghost').hp,10000);
});
test('Phase25 level5 thunder storms use three priority anchors; no sealed boss targeting',()=>{
 const g=loadGame({seed:257,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('thunder',[
  {id:'a',dx:100,dy:0,hp:10000,max:10000,type:'ghost'},
  {id:'b',dx:260,dy:0,hp:10000,max:10000,type:'shooter'},
  {id:'c',dx:420,dy:0,hp:10000,max:10000,type:'boss'},
  {id:'sealed',dx:1,dy:0,hp:10000,max:10000,type:'boss',shield:true}
 ],[],5);
 g.armWeapons();g.weapons(.05);
 const foes=g.snapshot().enemies;
 for(const id of ['a','b','c'])assert.ok(foes.find(e=>e.id===id).hp<10000,id);
 assert.equal(foes.find(e=>e.id==='sealed').hp,10000);
});
