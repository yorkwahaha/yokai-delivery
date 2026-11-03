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
  for(let i=0;i<5;i++)g.weapons(.05);
  assert.equal(searches(),1);
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
