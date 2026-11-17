'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const DEV=require('../js/dev-mode.js'),AI=require('../js/boss-sakura.js');
const manifest=JSON.parse(fs.readFileSync('assets/audio/sfx/enemies/sakura-tengu/manifest.json','utf8'));

test('boss hunt arrows clear long titles at every rotation, with a second row for narrow HUDs',()=>{
 const s=fs.readFileSync('js/ui.js','utf8'),begin=s.indexOf('  function bossHuntTitleLayout('),end=s.indexOf('  function drawCompass(',begin);
 const env={};vm.runInNewContext(s.slice(begin,end)+';this.layout=bossHuntTitleLayout;',env);
 const ctx={font:'',measureText(text){return {width:Array.from(text).length*(parseFloat(this.font.split(' ')[1]) || 22)};}};
 for(const width of [120,220,279,280,370])for(const title of ['擊敗櫻鬼・花天狐','擊敗櫻嶺天狗・夜櫻守護者']){
  const a=env.layout(ctx,title,width);
  assert.ok(a.textWidth<=a.maxWidth && a.fontSize>=14);
  for(const x of a.arrowOffsets){
   assert.ok(Math.abs(x)+24<=width/2,'all-angle arrow envelope stays inside task area');
   if(a.arrowY===26)assert.ok(Math.abs(x)-24>a.textWidth/2+2,'arrow cannot touch outlined text');
   else assert.ok(a.arrowY-24>32+5,'arrow row clears title descenders');
  }
 }
});
test('feather speeds become 495/555 with unchanged 540 reach and warning time',()=>{
 for(const half of [false,true]){
  const e={x:1300,y:900,hp:half?40:100,max:100,final:half,bossIndex:half?3:0,_sakuraAttackStep:half?2:1};
  AI.start(e,{x:1500,y:900});const h=e.hazard;
  assert.equal(h.kind,'sakuraFan');assert.equal(h.speed,half?555:495);assert.equal(h.reach,540);
  assert.equal(h.duration,half?.9:1.02);assert.equal(h.activeDuration,540/h.speed);
 }
});
test('reserved boss clips are silent after one missing-file attempt and respect mute/suspend',async()=>{
 const attempted=[];
 class Audio{constructor(path){this.src=path;attempted.push(path);}addEventListener(){}pause(){}play(){return Promise.reject(Object.assign(new Error('missing'),{name:'NotSupportedError'}));}}
 const env={window:{},Audio,console,setTimeout:()=>0,clearTimeout};
 vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);const a=env.window.AUDIO;
 const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 assert.equal(manifest.files.length,6);
 for(const cue of manifest.files){assert.equal(typeof a[cue.key],'function');a[cue.key]();}
 await flush();assert.deepEqual(attempted,manifest.files.map(c=>c.path));
 for(const cue of manifest.files)a[cue.key]();await flush();assert.equal(attempted.length,6);
 a.toggleMute();for(const cue of manifest.files)a[cue.key]();await flush();assert.equal(attempted.length,6);
 a.toggleMute();a.setSuspended(true);for(const cue of manifest.files)a[cue.key]();await flush();assert.equal(attempted.length,6);
});
function scene(turn){
 const g=loadGame();g.env.location={hostname:'localhost',search:'?dev=1&s3play=1'};g.env.DEV_MODE=DEV;g.startRun('sakura-pass');
 g.combatScene('katana',[{type:'boss',stageId:'sakura-pass',bossTheme:'sakura',bossIndex:0,_sakuraAttackStep:turn,dx:170,hp:9999,max:9999,shield:false,speed:0,attackCd:0}],[],0);
 return g;
}
test('real enemy update triggers each warning/cast once and each root impact once',()=>{
 for(const [turn,warn,cast]of [[0,'sakuraRushWarn','sakuraRushCast'],[1,'sakuraFanWarn','sakuraFanCast'],[2,'sakuraBloomWarn','sakuraBloomImpact']]){
  const g=scene(turn),count=key=>g.audioCalls.filter(x=>x===key).length;
  g.update(.01);g.update(.01);assert.equal(count(warn),1);
  const h=g.snapshot().enemies.find(e=>e.type==='boss').hazard;h.t=h.duration-.001;
  g.update(.01);g.update(.01);g.update(.01);assert.equal(count(cast),1);
  if(turn===2 && h.marks.length>1){h.t=h.marks[1].delay+.001;g.update(.01);g.update(.01);assert.equal(count(cast),2);}
 }
});
test('Sakura hazard is painted once after lighting and player skill art, before the fixed HUD',()=>{
 const g=scene(0),order=[];
 g.env.RENDERER.renderLighting=()=>order.push('lighting');
 g.env.SKILLFX.drawArtFx=()=>order.push('skill');
 g.env.RENDERER.drawBossHazard=()=>{order.push('boss');return true;};
 g.env.UI.drawHud=()=>order.push('hud');
 g.stepFrame(16.7);
 assert.equal(order.filter(x=>x==='boss').length,1);
 assert.ok(order.indexOf('boss')>order.indexOf('lighting'));
 assert.ok(order.indexOf('boss')>order.lastIndexOf('skill'));
 assert.ok(order.indexOf('boss')<order.indexOf('hud'));
});
