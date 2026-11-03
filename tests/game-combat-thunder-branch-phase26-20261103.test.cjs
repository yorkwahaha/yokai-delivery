'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const env={window:{}};
vm.runInNewContext(fs.readFileSync('tests/fixtures/thunder-branch-original-phase26.js','utf8')+'\nthis.old=originalThunderBranchTarget;',env);
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),env);
const old=env.old,now=()=>env.window.GAME_COMBAT_MATH.thunderBranchTarget;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function compare(enemies,primaries,struck,radius){
 const a=old(enemies,primaries,struck,radius),b=now()(enemies,primaries,struck,radius);
 assert.strictEqual(b,a);
}
test('Phase26 20k multi-target branch selections exactly match Phase25 original',()=>{
 const r=rng(26026);
 for(let n=0;n<20000;n++){
  const enemies=Array.from({length:n%25},(_,i)=>{
   const a=r()*Math.PI*2,d=n%9===0?100:Math.floor(r()*500);
   return {id:i,x:Math.cos(a)*d,y:Math.sin(a)*d,hp:n%17===0?0:1,
    shield:n%11===0&&i%2===0,done:n%13===0&&i%3===0,vanish:n%7===0&&i%5===0};
  });
  const primaries=enemies.filter((e,i)=>i%3===n%3).slice(0,n%6);
  const struck=new Set(enemies.filter((e,i)=>i%4===n%4));
  const radius=[0,75,100,180,300,Infinity,NaN,-1][n%8];
  compare(enemies,primaries,struck,radius);
 }
});
test('Phase26 first primary with eligible candidate wins, ties retain source order',()=>{
 const pts=Object.freeze([{id:'p0',x:0,y:0},{id:'p1',x:100,y:0}].map(Object.freeze));
 const enemies=Object.freeze([
  {id:'a',x:120,y:0,hp:10},
  {id:'b',x:80,y:0,hp:10},
  {id:'c',x:0,y:0,hp:10,shield:true},
  {id:'d',x:0,y:0,hp:0},
  {id:'e',x:0,y:0,hp:10,done:true},
  {id:'f',x:0,y:0,hp:10,vanish:true}
 ].map(Object.freeze));
 compare(enemies,pts,new Set(),30);
 assert.strictEqual(now()(enemies,pts,new Set(),30),enemies[0]);
 compare(enemies,pts,new Set([enemies[0]]),30);
 assert.strictEqual(now()(enemies,pts,new Set([enemies[0]]),30),enemies[1]);
 for(const radius of [0,19.99,20,100,NaN,-1])compare(enemies,pts,new Set(),radius);
 assert.strictEqual(now()(enemies,pts,new Set(),19.99),null);
 assert.strictEqual(now()(enemies,pts,new Set(),20),enemies[0]);
});
test('Phase26 selected branch is pure and production damages through existing pathway',()=>{
 const enemies=Object.freeze([{x:0,y:1,hp:20}].map(Object.freeze)),pt=Object.freeze([{x:0,y:0}]),struck=Object.freeze(new Set());
 assert.strictEqual(now()(enemies,pt,struck,1),enemies[0]);
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
 assert.doesNotMatch(fs.readFileSync('js/game-combat-math.js','utf8'),/Math\.random\s*\(/);
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/GAME_COMBAT_MATH\.thunderBranchTarget\(enemies, primaryTargets, struck, spec\.branchRadius\)/);
 assert.match(game,/if \(branchTarget\) \{\s*struck\.add\(branchTarget\)/);
});
test('Phase26 VM thunder branch mutation hits nearest unstruck foe once',()=>{
 const g=loadGame({seed:266,stage:'night-town'});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.combatScene('thunder',[
  {id:'primary',dx:90,dy:0,hp:10000,max:10000},
  {id:'nearest',dx:140,dy:0,hp:10000,max:10000},
  {id:'other',dx:170,dy:0,hp:10000,max:10000},
  {id:'shield',dx:95,dy:0,hp:10000,max:10000,shield:true}
 ],[],1);
 g.setBuildMutations(['mut_branch']);
 g.armWeapons();g.weapons(.05);
 const enemies=g.snapshot().enemies;
 for(const id of ['primary','nearest'])assert.ok(enemies.find(e=>e.id===id).hp<10000,id);
 for(const id of ['other','shield'])assert.equal(enemies.find(e=>e.id===id).hp,10000,id);
});
