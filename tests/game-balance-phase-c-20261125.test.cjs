'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

function stepWeapons(game,from,to){
  for(let frame=from;frame<=to;frame++){
    game.setElapsed(frame*.05);
    game.weapons(.05);
  }
}

test('Lv5 needle focus skips the sealed Boss and reselects after the active Boss dies',()=>{
  const game=loadGame({seed:117});
  game.start();
  game.combatScene('needle',[
    {type:'boss',dx:90,dy:0,shield:true},
    {type:'boss',dx:96,dy:40},
    {type:'boss',dx:10,dy:155}
  ],[],5);
  const [sealed,first,next]=game.snapshot().enemies;
  game.setFacingAngle(0);
  game.armWeapons();
  stepWeapons(game,1,5);
  assert.equal(sealed.hp,999);
  assert.ok(first.hp<999);
  game.hurt(first,first.hp);
  stepWeapons(game,6,6);
  const shot=game.snapshot().needles.at(-1);
  const player=game.snapshot();
  assert.ok(Math.abs(shot.launchAng-Math.atan2(next.y-player.y,next.x-(player.x-16)))<1e-9);
  stepWeapons(game,7,13);
  assert.ok(next.hp<999);
  assert.equal(sealed.hp,999);
});

test('Lv5 ofuda short-flight bonus stays on its attached living Boss',()=>{
  const game=loadGame({seed:117});
  game.start();
  game.combatScene('boom',[
    {type:'boss',dx:100,dy:0},
    {type:'boss',dx:100,dy:72},
    {type:'boss',dx:145,dy:-54,shield:true},
    {type:'mis',dx:135,dy:52}
  ],[],5);
  const [primary,other,sealed,duplicateWord]=game.snapshot().enemies;
  game.armWeapons();
  stepWeapons(game,1,2);
  assert.equal(game.snapshot().proj.length,2);
  assert.ok(game.snapshot().proj.every(q=>q.target===primary&&q.closeBossAttach));
  game.hurt(primary,primary.hp);
  stepWeapons(game,3,3);
  assert.equal(other.hp,987,'nearby Boss receives the two unmodified splashes');
  assert.equal(duplicateWord.hp,987,'ordinary mirrored word enemy receives normal splash');
  assert.equal(sealed.hp,999);
  assert.equal(game.snapshot().proj.length,0);
});

test('the victory Boss copy cannot be hit or grant a second reward',()=>{
  const game=loadGame({seed:117});
  game.start();
  for(let i=0;i<3;i++){
    game.placeBoss(1,{dx:100+i*15,bossIndex:i});
    const prior=game.snapshot().enemies.find(e=>e.type==='boss'&&e.bossIndex===i);
    prior.shield=false;
    game.hurt(prior,1);
  }
  game.placeBoss(1,{dx:100,bossIndex:3});
  const boss=game.snapshot().enemies.find(e=>e.type==='boss'&&e.hp>0);
  boss.final=true;
  game.setOil(35);
  game.hurt(boss,1);
  const after=game.snapshot();
  const copy=after.enemies.find(e=>e.type==='boss');
  assert.equal(after.state,'victory');
  assert.ok(copy.dying&&copy!==boss);
  game.hurt(copy,50);
  assert.equal(copy.hp,1);
  assert.equal(game.snapshot().oil,after.oil);
  assert.equal(game.snapshot().score,after.score);
});

test('only the first two rain-port Normal Boss kills grant 45 oil, once and below the cap',()=>{
  const game=loadGame({seed:117,location:{hostname:'example.com',search:''}});
  const expected={
    'night-town':[35,35,20,35],'rain-port':[45,45,20,35],
    'sakura-pass':[35,35,20,35],'bamboo-maze':[35,35,20,35]
  };
  for(const [stage,rewards] of Object.entries(expected))for(const [index,reward] of rewards.entries()){
    game.startRun(stage);
    game.stopSpawns();
    const times=game.env.CONTENT.getStage(stage).pacing.bossTimes;
    if(stage==='bamboo-maze' && index===3){
      game.setElapsed(times[0]);
      game.update(.05);
      const first=game.snapshot().enemies.find(e=>e.bossIndex===0);
      assert.ok(first);
      first.shield=false;
      game.hurt(first,first.hp);
    }
    game.setElapsed(times[index]);
    if(stage!=='bamboo-maze') game.forceBossSchedule(index);
    let boss;
    for(let i=0;i<100&&!boss;i++){
      game.update(.05);
      boss=game.snapshot().enemies.find(e=>e.type==='boss' && e.bossIndex===index);
    }
    assert.ok(boss,stage+' scheduled Boss '+index);
    assert.equal(boss.oilReward,reward,stage+' wave '+index);
    game.setOil(index%2===0?3:84);
    const before=game.snapshot().oil;
    game.hurt(boss,boss.hp);
    assert.equal(game.snapshot().oil,before,'warded Boss must still block hits and reward');
    boss.shield=false;
    game.hurt(boss,boss.hp);
    const paid=game.snapshot().oil;
    assert.equal(paid,Math.min(100,before+reward));
    game.hurt(boss,20);
    assert.equal(game.snapshot().oil,paid,'no second reward for the same kill');
  }
});
