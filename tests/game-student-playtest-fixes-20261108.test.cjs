'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('both stages require a reading seal on the third Boss before HP damage',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
  for(const stage of ['night-town','rain-port']){
    const plan=context.window.GAME_COMBAT_MATH.bossBlueprint(
      2,[300,650,1100,1400],[35,35,20,35],{id:stage});
    assert.equal(plan.role,'gate');
    assert.equal(plan.quiz,true,stage+' third Boss must have a reading quiz');
    const g=loadGame({stage,seed:36});
    g.start();g.stopSpawns();
    g.combatScene('katana',[{dx:120,dy:0,hp:900,max:900,type:'boss',
      word:{jp:'ねこ',zh:'貓'},shield:true,speed:0,attackCd:Infinity}],[],5);
    const boss=g.snapshot().enemies[0];
    const before=boss.hp;
    g.hurt(boss,250);
    assert.equal(boss.hp,before,stage+' locked Boss cannot lose HP');
  }
});

test('Lv5 crosscut launches two forward moving waves, second upside-down',()=>{
  const g=loadGame({seed:41});
  g.start();g.stopSpawns();
  g.combatScene('katana',[{dx:150,dy:0,hp:999,type:'ghost',speed:0}],[],5);
  g.setBuildMutations(['mut_crosscut']);
  g.setFacingAngle(0);
  for(let i=0;i<4;i++)g.update(.04);
  let waves=g.snapshot().winds;
  assert.equal(waves.length,2,'both Lv5 strikes need distinct flight objects');
  const [first,second]=waves;
  assert.equal(first.flipY,undefined);
  assert.equal(second.flipY,true);
  assert.equal(second.crosscutSecondary,true);
  assert.ok(first.vx>0&&second.vx>0,'both strikes fly forward');
  assert.ok(Math.abs(first.ang)<.001&&Math.abs(second.ang)<.001);
  assert.ok(first.x>second.x,'delayed projectile starts behind first strike');
  const x=second.x;
  g.update(.04);
  waves=g.snapshot().winds;
  assert.ok(waves.find(w=>w.crosscutSecondary).x>x,'second wave must not stay still');
});

test('every final Boss detonation can overlap real MP3 voices, without synthesis',async()=>{
  const voices=[];
  class Voice{
    constructor(src){this.src=src;this.paused=false;this.pauseCount=0;voices.push(this);}
    addEventListener(){}
    pause(){this.paused=true;this.pauseCount++;}
    play(){return Promise.resolve();}
  }
  const env={window:{},Audio:Voice,setTimeout,clearTimeout,console};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  for(let i=0;i<4;i++)env.window.AUDIO.finalBossDeath(.38);
  await Promise.resolve();
  assert.equal(voices.length,4);
  assert.ok(voices.every(v=>v.src==='assets/audio/sfx/final-boss-death.mp3'));
  assert.ok(voices.every(v=>v.pauseCount===0),'subsequent bursts cannot cut off previous voices');
  const game=fs.readFileSync('js/game.js','utf8');
  const start=game.indexOf('  function startVictorySequence()');
  const end=game.indexOf('  function updateVictorySequence(dt)',start);
  assert.ok(start>0&&end>start);
  assert.doesNotMatch(game.slice(start,end),/AUDIO\.(?:thunder|breakShield)\(\)/);
  assert.match(game,/AUDIO\.finalBossDeath\?\.\(0\.38\)/);
});
