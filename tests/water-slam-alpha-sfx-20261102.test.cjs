'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const renderer = fs.readFileSync('js/renderer.js','utf8');
const game = fs.readFileSync('js/game.js','utf8');
const audio = fs.readFileSync('js/audio.js','utf8');
const html = fs.readFileSync('index.html','utf8');

function paint(phase, t = 0) {
  const start = renderer.indexOf('  function paintHarborWaterSlam(');
  const end = renderer.indexOf('\n  function drawPortBossHazard(',start);
  assert.ok(start >= 0 && end > start);
  const drawn = [];
  const stack = [];
  const ctx = {
    globalAlpha: .55, fillStyle:'', strokeStyle:'', shadowBlur:0,
    save(){stack.push({globalAlpha:this.globalAlpha,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle});},
    restore(){Object.assign(this,stack.pop());},
    beginPath(){}, arc(){}, clip(){}, stroke(){}, ellipse(){},
    fill(){drawn.push({type:'fill',style:this.fillStyle,alpha:this.globalAlpha});},
    drawImage(){drawn.push({type:'image',alpha:this.globalAlpha});}
  };
  const env = {
    window:{BOSS_HAZARD_ART_IMG:{rainVortex:{naturalWidth:1024,naturalHeight:1024}}},
    bossHazardPass:'',
    Math,
  };
  vm.runInNewContext(renderer.slice(start,end) + '\nthis.paintHarborWaterSlam=paintHarborWaterSlam;',env);
  const result = env.paintHarborWaterSlam(ctx,{x:100,y:200,r:150,phase,t,duration:1},1);
  assert.equal(result,true);
  assert.equal(ctx.globalAlpha,.55,'restores caller transparency');
  return drawn;
}

test('rain-port telegraph: translucent blue circle, full-opacity water picture',()=>{
  const d=paint('telegraph');
  const blue=d.find(x=>x.type==='fill'&&x.style.includes('rgba(4,55,86,.12)'));
  assert.ok(blue,'water-blue warning is translucent');
  assert.ok(d.some(x=>x.type==='image'&&x.alpha===1),'no inherited .74 or warning opacity on water texture');
  assert.match(renderer,/strokeStyle="rgba\(154,239,254,\.48\)"/);
});

test('impact: opaque water sprite, intentional fade only on recovery',()=>{
  const a=paint('active').filter(x=>x.type==='image');
  assert.equal(a.length,1);
  assert.equal(a[0].alpha,1);
  const fade=paint('recovery',.5).filter(x=>x.type==='image');
  assert.equal(fade.length,1);
  assert.equal(fade[0].alpha,.5);
});

test('two future water SFX paths are registered but excluded from preload',()=>{
  for(const [key,path] of [
   ['rainPortWaterSlamWarn','assets/audio/sfx/boss/rain_port_water_slam_warn.ogg'],
   ['rainPortWaterSlamImpact','assets/audio/sfx/boss/rain_port_water_slam_impact.ogg']
  ]) {
   assert.ok(audio.includes(key+': "'+path+'"'));
   assert.match(audio,new RegExp('api\\.'+key+'='));
  }
  assert.match(audio,/unavailableSfx\.add\(name\)/);
  assert.match(audio,/'rainPortWaterSlamWarn','rainPortWaterSlamImpact'\]\.includes\(key\)/);
});

test('water Boss phase-triggered sounds are one-shot; night-town keeps its own impact cue',()=>{
  assert.match(game,/const newSlam = stepped\?\.started && e\.hazard\?\.kind === "slam"/);
  assert.match(game,/AUDIO\.rainPortWaterSlamWarn\?\.\(\)/);
  assert.match(game,/slamWasWarning && e\.hazard === h && h\.phase === "active"/);
  assert.match(game,/AUDIO\.rainPortWaterSlamImpact\?\.\(\)/);
  assert.match(game,/STAGE\.id === "night-town" && slamWasWarning/);
  assert.match(game,/AUDIO\.bossSlamImpact\?\.\(\)/);
});

test('release cache keys changed for exactly the modified JavaScript files',()=>{
  assert.ok(html.includes('js/renderer.js?v=20261102-water-slam-sfx'));
  assert.ok(html.includes('js/audio.js?v=20261102-audio-pad-hotfix'));
  assert.ok(html.includes('js/game.js?v=20261103-core-render-phase22'));
  assert.ok(html.includes('js/game-quiz-logic.js?v=20261102-quiz-phase1'));
});
