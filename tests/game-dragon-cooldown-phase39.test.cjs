'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

function fixture(){
  const g=loadGame({seed:482});g.start();g.stopSpawns();
  g.combatScene('fire',[{id:'front',dx:140,hp:100,max:100,speed:0}],[],5);
  const math=g.env.GAME_COMBAT_MATH;
  let calls=0;
  g.env.GAME_COMBAT_MATH={...math,dragonFireTarget(...args){
    calls++;return math.dragonFireTarget(...args);
  }};
  return {g,searches:()=>calls};
}
test('Phase39: no dragon cluster search while spell is on cooldown',()=>{
  const {g,searches}=fixture();
  g.setWeaponRank('fire',5); // VM bridge: enforce active Lv5 with cooldown.
  for(let i=0;i<5;i++)g.weapons(.05);
  assert.equal(searches(),0);
  assert.equal(g.dragonTargetIds().length,0);
});
test('Phase39: eligible cast picks same target, then active dragon prevents repeated searches',()=>{
  const {g,searches}=fixture();
  g.weapons(.05);
  assert.equal(searches(),1);
  assert.deepEqual(Array.from(g.dragonTargetIds()),['front']);
  // Force cooldown to zero while the original dragon is still alive:
  // this isolates the existing-dragon guard from the cooldown guard.
  g.armWeapons();
  assert.equal(g.weaponTimers().fire,0);
  const before=g.snapshot().ghosts.filter(sp=>sp.dragon&&sp.life>0).length;
  assert.ok(before>0);
  for(let i=0;i<5;i++)g.weapons(.05);
  assert.equal(searches(),1,'live dragon alone must suppress target search');
  assert.equal(g.snapshot().ghosts.filter(sp=>sp.dragon&&sp.life>0).length,before);
  g.snapshot().ghosts.length=0;
  g.armWeapons();
  g.weapons(.05);
  assert.equal(searches(),2,'search resumes once the live dragon is cleared');
  assert.equal(g.snapshot().ghosts.filter(sp=>sp.dragon&&sp.life>0).length,1);
});
test('black dragon shows at most 22% of camera width from both screen edges',()=>{
 for(const dx of [140,-140]){
  const g=loadGame({seed:482});g.start();g.stopSpawns();
  g.combatScene('fire',[{dx,hp:999,max:999,speed:0}],[],5);
  g.weapons(.05);
  const dragon=g.snapshot().dragonGhosts[0];
  assert.ok(dragon?.entry,'Lv5 should summon its real raster dragon');
  for(let t=0;t<2;t++){
   const {startX,endX}=dragon.entry,size=dragon.size;
   const visible=dx>0
    ? endX+size/2-(startX+size*.8)
    : (startX-size*.8)-(endX-size/2);
   assert.ok(visible>0 && visible/900<.25,`visible fraction ${visible/900}`);
   assert.ok(Math.abs(visible/900-.22)<.002);
   g.weapons(.05);
  }
 }
});
test('Phase39: cooldown still suppresses search if an existing dragon has exited',()=>{
  const {g,searches}=fixture();
  g.weapons(.05);
  assert.equal(searches(),1);
  g.snapshot().ghosts.length=0;
  for(let i=0;i<5;i++)g.weapons(.05);
  assert.equal(searches(),1);
  assert.ok(g.weaponTimers().fire>0);
});
