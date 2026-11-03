'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const original=function original(tier,r,o) {
 const {elapsed,dawn,difficulty,stageEnemy,stageId,ring,rainPortNormal}=o;
 const cappedElapsed=Math.min(elapsed,dawn);
 const speedRamp=(cappedElapsed/dawn)*75*difficulty.timeScale;
 const stageSpeed=(stageEnemy.speedScale||1)*difficulty.speedScale;
 const shooterChance=stageEnemy.shooterChance??0.14;
 const canShoot=stageEnemy.shots!==false;
 let t={type:'ghost',hp:2.0*tier,speed:(52+speedRamp*0.9)*stageSpeed};
 if(rainPortNormal){
  if(cappedElapsed>90&&r<0.25){
   t={type:'runner',hp:1.5*tier,speed:(110+speedRamp*1.1)*stageSpeed};
  }else if(cappedElapsed>200&&r<0.40){
   t={type:'tank',hp:7.0*tier,speed:(32+speedRamp*0.4)*stageSpeed};
  }else if(cappedElapsed>160&&r<(cappedElapsed>200?0.40:0.25)+shooterChance&&!ring&&canShoot){
   t={type:'shiome',hp:0.7*tier,speed:(46+speedRamp*0.7)*stageSpeed,pose:'idle'};
  }
 }else{
  if(stageId==='rain-port'&&!ring&&r>=0.55&&r<0.72){
   t={type:'shiome',hp:2.2*tier,speed:(46+speedRamp*0.7)*stageSpeed,pose:'idle',shiomeCd:0.8};
  }else if(cappedElapsed>90&&r<0.22){
   t={type:'runner',hp:1.5*tier,speed:(110+speedRamp*1.1)*stageSpeed};
  }else if(cappedElapsed>200&&r<0.36){
   t={type:'tank',hp:7.0*tier,speed:(32+speedRamp*0.4)*stageSpeed};
  }else if(cappedElapsed>160&&r<(cappedElapsed>200?0.36:0.22)+shooterChance&&!ring&&canShoot){
   t={type:'shooter',hp:tier,speed:(48+speedRamp*0.8)*stageSpeed};
  }
 }
 return t;
};
function api() {
 const env={window:{}};vm.runInNewContext(fs.readFileSync('js/game-spawn-math.js','utf8'),env);
 return env.window.GAME_SPAWN_MATH;
}
test('Phase9 enemy type, HP, speed and attributes exactly match previous formula across both stages',()=>{
 const select=api().enemySpec;
 const times=[0,90,90.00001,160,160.00001,200,200.00001,360,540,600,640];
 const random=[0,0.219999,0.22,0.249999,0.25,0.35999,0.36,0.38999,0.4,0.55,0.719999,0.72,0.99];
 let cases=0;
 for(const stageId of ['night-town','rain-port'])for(const rainPortNormal of [false,true]){
  for(const shooterChance of [undefined,0,.06,.14]){
   for(const shots of [false,true])for(const ring of [false,true]){
    for(const t of times)for(const r of random){
     const o={elapsed:t,dawn:600,difficulty:{timeScale:stageId==='night-town'?.9:1,speedScale:.92,hpScale:.86},
      stageEnemy:{speedScale:1.2,shooterChance,shots},stageId,ring,rainPortNormal};
     const wanted=original(2.75,r,o);
     const got=select(2.75,r,o);
     assert.equal(JSON.stringify(got),JSON.stringify(wanted),
      JSON.stringify({stageId,rainPortNormal,shooterChance,shots,ring,t,r}));
     cases++;
    }
   }
  }
 }
 assert.ok(cases>=9000);
});
test('Phase9 pure helper never mutates input or draws RNG',()=>{
 const func=api().enemySpec;
 const options={elapsed:300,dawn:600,difficulty:{timeScale:1,speedScale:1},
  stageEnemy:{speedScale:1,shots:true},stageId:'rain-port',ring:false,rainPortNormal:true};
 const before=JSON.stringify(options);
 for(const r of [0.2,0.42,0.7])func(3,r,options);
 assert.equal(JSON.stringify(options),before);
 assert.doesNotMatch(fs.readFileSync('js/game-spawn-math.js','utf8'),/Math\.random\s*\(|enemies\.push\s*\(|localStorage\b/);
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/const r = Math\.random\(\);[\s\S]*?GAME_SPAWN_MATH\.enemySpec\(tier, r/);
 assert.match(game,/enemies\.push\(\{ \.\.\.position, flash: 0, wob: Math\.random\(\) \* 6/);
});
test('Phase9 HTML loads changed module before game, preserves enemy config source',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const spawn='js/game-spawn-math.js?v=20261103-spawn-phase9';
 const game='js/game.js?v=20261103-input-phase15';
 assert.ok(html.includes(spawn)&&html.includes(game));
 assert.ok(html.indexOf(spawn)<html.indexOf(game));
 assert.ok(html.includes('js/game-build-rules.js?v=20261103-build-phase11'));
});
