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
test('feathers travel 1.75 times faster without changing reach or warning time',()=>{
 for(const half of [false,true]){
  const e={x:1300,y:900,hp:half?40:100,max:100,final:half,bossIndex:half?3:0,_sakuraAttackStep:half?2:1};
  AI.start(e,{x:1500,y:900});const h=e.hazard;
  assert.equal(h.kind,'sakuraFan');assert.equal(h.speed,(half?555:495)*1.75);assert.equal(h.reach,540);
  assert.equal(h.duration,half?.9:1.02);assert.equal(h.activeDuration,540/h.speed);
  const target={x:1500,y:900},center=h.shots[Math.floor(h.shots.length/2)];
  AI.step(e,target,h.duration);
  AI.step(e,target,.1);
  assert.ok(Math.abs(center.travelled-h.speed*.1)<1e-8);
 }
});
test('Sakura warnings fill the actual lanes and root circles without drawing outlines',()=>{
 const wind={naturalWidth:720,naturalHeight:299},roots={naturalWidth:720,naturalHeight:645};
 const env={SAKURA_ART:{windBlade:wind,rootBloom:roots},
  VIEWPORT:{upright(ctx,x,y,paint){paint();}}};
 env.window=env;
 vm.runInNewContext(fs.readFileSync('js/renderer.js','utf8'),env);
 env.RENDERER.setDepthStage('sakura-pass');
 for (const turn of [0,1,2]){
  const e={x:1300,y:900,hp:100,max:100,bossIndex:0,_sakuraAttackStep:turn};
  AI.start(e,{x:1450,y:900});
  const h=e.hazard, fills=[], strokes=[], shapes=[], drawn=[];
  const ctx=new Proxy({
   globalAlpha:1, fill(){fills.push(this.fillStyle);}, stroke(){strokes.push('stroke');},
   strokeRect(){strokes.push('strokeRect');},
   rect(...args){shapes.push(args);}, arc(...args){shapes.push(args);},
   drawImage(img){drawn.push(img);}
  },{get:(target,key)=>target[key] ?? (()=>{})});
  assert.equal(env.RENDERER.drawBossHazard(ctx,h,0,e),true);
  assert.ok(fills.length>0 && fills.every(color=>Number(color.split(',').at(-1).slice(0,-1))>=.6));
  assert.deepEqual(strokes,[]);
  if (turn !== 2) assert.ok(drawn.includes(wind));
  if(turn===0) assert.deepEqual(shapes,[[0,-h.r,h.length,h.r*2]]);
  if(turn===1) assert.deepEqual(shapes,h.shots.map(s=>[0,-h.r,s.limit,h.r*2]));
  if(turn===2) assert.deepEqual(shapes,h.marks.map(m=>[m.x,m.y,h.r,0,Math.PI*2]));
  if (turn === 2) {
   const stamp={naturalWidth:512,naturalHeight:512,sakuraSourceRect:{sx:8,sy:8,sw:496,sh:496}};
   env.SAKURA_ART.rootWarning=stamp;
   fills.length=drawn.length=0;
   env.RENDERER.drawBossHazard(ctx,h,0,e,'warning');
   assert.equal(fills.length,0);
   assert.deepEqual(drawn,h.marks.map(()=>stamp));
   h.phase='active';h.t=h.activeTime=h.pulseDuration / 2;
   drawn.length=0;
   env.RENDERER.drawBossHazard(ctx,h,0,e,'warning');
   assert.deepEqual(drawn,h.marks.filter(m=>m.delay>h.activeTime).map(()=>stamp));
   drawn.length=0;
   env.RENDERER.drawBossHazard(ctx,h,0,e,'impact');
   assert.deepEqual(drawn,[roots]);
  }
 }
});
test('provided Sakura Boss clips request their MP3s once on error and respect mute/suspend',async()=>{
 const attempted=[];
 class Audio{constructor(path){this.src=path;attempted.push(path);}addEventListener(){}pause(){}play(){return Promise.reject(Object.assign(new Error('missing'),{name:'NotSupportedError'}));}}
 const env={window:{},Audio,console,setTimeout:()=>0,clearTimeout};
 vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);const a=env.window.AUDIO;
 const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 assert.equal(manifest.files.length,6);
 for(const cue of manifest.files){assert.ok(fs.existsSync(cue.path) && fs.statSync(cue.path).size>0,cue.path);assert.equal(typeof a[cue.key],'function');a[cue.key]();}
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
test('Sakura warning is painted once above the sanctuary, below monsters and HUD',()=>{
 const g=scene(0),order=[];
 g.setWeaponRank('barrier',5);
 g.armWeapons();
 g.weapons(.01);
 g.addMob({type:'ghost',x:g.snapshot().x+40,y:g.snapshot().y+20});
 g.env.RENDERER.renderLighting=()=>order.push('lighting');
 g.env.YOKAI_SANCTUARY_ARC={draw:()=>order.push('sanctuary')};
 g.env.RENDERER.drawMonster=()=>order.push('monster');
 g.env.RENDERER.drawBossHazard=(ctx,h,t,e,pass)=>{order.push(pass ?? 'unsplit');return true;};
 g.env.UI.drawHud=()=>order.push('hud');
 g.stepFrame(16.7);
 assert.equal(order.filter(x=>x==='sanctuary').length,1);
 assert.equal(order.filter(x=>x==='warning').length,1);
 assert.equal(order.includes('impact'),false);
 assert.ok(order.indexOf('sanctuary')<order.indexOf('warning'));
 assert.ok(order.indexOf('warning')<order.indexOf('monster'));
 assert.ok(order.indexOf('warning')<order.indexOf('hud'));
});

test('Sakura first level-up presents both new weapons in campaign and direct local preview',()=>{
 for(const search of ['', '?dev=1&s3play=1&stage=sakura-pass']){
  const g=loadGame({location:{hostname:'127.0.0.1',search}});
  if(!search) for(const id of ['night-town','rain-port'])g.store().finish(id,100,6,true);
  for(const [index,id]of ['ink_trail','seal_nail'].entries()){
   g.startRun('sakura-pass');
   g.stopSpawns();
   assert.equal(g.forceLevelUp(),'levelup');
   assert.deepEqual(Array.from(g.snapshot().choiceIds).slice(0,2),['ink_trail','seal_nail']);
   assert.ok(g.takeLevelUpChoice(index).ok);
   assert.equal(g.weaponLevels()[id],1);
   if(search)assert.equal(g.store().isActiveSkillUnlocked(id),false);
  }
 }
});
