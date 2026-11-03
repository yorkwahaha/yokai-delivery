'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');
function scene(seed=66,stage='night-town'){
 const g=loadGame({seed,stage});g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();return g;
}
function enemy(g,spec={}){g.combatScene('katana',[{dx:105,dy:0,hp:120,max:120,...spec}],[],0);return g.snapshot().enemies[0];}
function near(a,b,margin=1e-7){assert.ok(Math.abs(a-b)<margin,'expected '+a+' to approximately equal '+b);}

test('hurt: shield blocks HP, and unsealed foe can be hit',()=>{
 const g=scene(71),foe=enemy(g,{shield:true});const score=g.snapshot().score;
 g.hurt(foe,40);
 assert.equal(foe.hp,120);assert.equal(g.snapshot().score,score);assert.equal(foe.flash,.08);
 foe.shield=false;g.hurt(foe,40);assert.equal(foe.hp,80);assert.equal(g.snapshot().score,score);
});
test('hurt: pauses, modal states and endings reject damage, but levelup retains its exception',()=>{
 const g=scene(72),foe=enemy(g);
 for(const state of ['pause','fusion','charmswap','won','lost','overworld','menu']){
  g.setState(state);g.hurt(foe,13);assert.equal(foe.hp,120,'damage during '+state);
 }
 g.setState('levelup');g.hurt(foe,15);assert.equal(foe.hp,105);
 g.setState('play');g.hurt(foe,5);assert.equal(foe.hp,100);
});
test('hurt: lethal score and sound effects are credited exactly once',()=>{
 const g=scene(73),foe=enemy(g,{hp:8,max:8}),score=g.snapshot().score;
 g.hurt(foe,10);assert.ok(foe.hp<=0);
 assert.equal(g.snapshot().score-score,15);
 const audioCount=g.audioCalls.length;
 g.hurt(foe,10);assert.equal(g.snapshot().score-score,15);assert.equal(g.audioCalls.length,audioCount);
});
test('weapons: katana front arc hits matching forward target but never rear target',()=>{
 const g=scene(74);
 g.combatScene('katana',[{id:'ahead',dx:105,dy:0,hp:200,max:200},
  {id:'behind',dx:-105,dy:0,hp:200,max:200}],[],1);
 g.armWeapons();g.weapons(.05);
 const foes=g.snapshot().enemies,front=foes.find(e=>e.id==='ahead'),rear=foes.find(e=>e.id==='behind');
 assert.ok(front.hp<200,'front HP '+front.hp);assert.equal(rear.hp,200);
 assert.equal(g.slashLog.length,1);
});
test('weapons: katana cooldown prevents immediate second swing and damage',()=>{
 const g=scene(75);
 g.combatScene('katana',[{dx:105,dy:0,hp:500,max:500}],[],1);
 g.armWeapons();g.weapons(.05);assert.equal(g.slashLog.length,1);
 const hp=g.snapshot().enemies[0].hp;
 g.weapons(.05);assert.equal(g.slashLog.length,1);
 assert.equal(g.snapshot().enemies[0].hp,hp);
 assert.ok(g.weaponTimers().katana>0);
});
test('update: pause, levelup and fusion freeze oil/clock; play resumes',()=>{
 const g=scene(76),foe=enemy(g),initial=g.snapshot();
 for(const state of ['pause','levelup','fusion']){
  g.setState(state);g.update(.8);const now=g.snapshot();
  near(now.elapsed,initial.elapsed);near(now.oil,initial.oil);assert.equal(foe.hp,120);
 }
 g.setState('play');g.update(.05);const now=g.snapshot();
 assert.ok(now.elapsed>initial.elapsed);assert.ok(now.oil<initial.oil);
});
test('Boss: wrong answer disables direct and pending damage while combat time resumes',()=>{
 const g=scene(77),foe=enemy(g);
 g.prepareBoss();
 const snap=g.snapshot(),boss=snap.enemies.find(e=>e.type==='boss');
 const wrong=snap.bossQ.ans.findIndex(w=>w.jp!==boss.word.jp);
 assert.ok(wrong>=0);
 g.answerBoss(wrong);assert.ok(g.combatPhase().curse>=9.9);
 const hp=foe.hp,score=g.snapshot().score,elapsed=g.snapshot().elapsed;
 g.hurt(foe,25);assert.equal(foe.hp,hp);
 g.update(.05);
 assert.ok(g.snapshot().elapsed>elapsed);
 assert.equal(foe.hp,hp);assert.equal(g.snapshot().score,score);
 assert.ok(g.combatPhase().curse<10);
});
test('Boss: first ten-second read window freezes elapsed and oil while shield is readable',()=>{
 const g=scene(78);g.prepareBoss();
 const boss=g.snapshot().enemies.find(e=>e.type==='boss'),before=g.snapshot();
 g.update(.05);const after=g.snapshot();
 near(after.elapsed,before.elapsed);near(after.oil,before.oil);
 assert.equal(boss.quizEntered,true);
 assert.ok(boss.barrierTimer<10&&boss.barrierTimer>9.9);
});
test('runFrame: 200ms stall and four 50ms frames advance equally in quiet battle',()=>{
 const a=scene(79),b=scene(79);
 for(const g of [a,b])g.stepFrame(16.7);
 a.stepFrame(200);
 for(let i=0;i<4;i++)b.stepFrame(50);
 const aa=a.snapshot(),bb=b.snapshot();
 near(aa.elapsed,bb.elapsed,1e-4);
 near(aa.oil,bb.oil,1e-4);
 assert.ok(aa.elapsed>.15);
});
test('drawWorld: context save/restore balances menu, battle, and boss quiz render paths',()=>{
 const g=loadGame({seed:80});let depth=0,saves=0,restores=0;
 g.ctx.save=()=>{depth++;saves++;};
 g.ctx.restore=()=>{depth--;restores++;assert.ok(depth>=0);};
 g.stepFrame(16.7);assert.equal(depth,0);
 g.start();g.stopSpawns();g.clearOrders();g.stepFrame(16.7);assert.equal(depth,0);
 g.prepareBoss();g.stepFrame(16.7);assert.equal(depth,0);
 assert.ok(saves>0&&restores>0);
});
test('gamepad: Start held across frames is edge-triggered and unlocks audio once',()=>{
 const g=loadGame({seed:81});
 const pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))};
 g.env.navigator.getGamepads=()=>[pad];g.stepFrame(16.7);
 const before=g.audioCalls.filter(x=>x==='unlockFromInput').length;
 pad.buttons[9].pressed=true;g.stepFrame(16.7);
 const edge=g.audioCalls.filter(x=>x==='unlockFromInput').length;
 assert.ok(edge>before);
 g.stepFrame(16.7);g.stepFrame(16.7);
 assert.equal(g.audioCalls.filter(x=>x==='unlockFromInput').length,edge);
 assert.equal(g.combatPhase().gamepadButtons[9],true);
 pad.buttons[9].pressed=false;g.stepFrame(16.7);
 assert.equal(g.combatPhase().gamepadButtons[9],false);
});

test('Boss handoff: an unanswerable second shield keeps its full timer until curse ends',()=>{
 const g=scene(82);
 const words=g.env.CONTENT.getStageWords('night-town');
 g.prepareBoss(words[0]);g.prepareBoss(words[1]);
 const bosses=g.snapshot().enemies.filter(e=>e.type==='boss');
 const player=g.snapshot();
 Object.assign(bosses[0],{x:player.x+110,y:player.y,speed:0,attackCd:Infinity});
 Object.assign(bosses[1],{x:player.x+210,y:player.y,speed:0,attackCd:Infinity});
 g.update(.05);g.unlockBoss();
 const q=g.snapshot().bossQ;
 const wrong=q.ans.findIndex(w=>w!==bosses[0].word);
 assert.ok(wrong>=0);
 g.answerBoss(wrong);
 const secondBefore=bosses[1].barrierTimer;
 const time=g.snapshot().elapsed;
 for(let i=0;i<12;i++)g.update(.05);
 assert.equal(bosses[1].barrierTimer,secondBefore,'second Boss clock cannot run during first curse');
 assert.equal(bosses[1].quizClosed,undefined);
 assert.ok(g.snapshot().elapsed>time);
 g.setCurseSeconds(.025);g.update(.05);
 assert.equal(g.combatPhase().curse,0);
 g.update(.05);
 // The closest boss may still be first; whichever shield is selected receives
 // its own timer only AFTER the curse has ended.
 const anyEntered=bosses.some(b=>b.barrierTimer!=null&&b.barrierTimer<10);
 assert.ok(anyEntered,'reading clock resumes after curse');
});
test('hit-stop: running clock and oil proceed, while attack movement and katana timer freeze for that tick',()=>{
 const g=scene(83);
 g.combatScene('katana',[{dx:100,dy:0,hp:200,max:200}],[],1);
 g.armWeapons();
 const initial=g.snapshot(),prior=g.weaponTimers().katana;
 g.update(.05,true);
 const after=g.snapshot();
 assert.ok(after.elapsed>initial.elapsed);
 assert.ok(after.oil<initial.oil);
 assert.equal(g.slashLog.length,0,'hit-stop cannot create a new slash');
 assert.equal(g.weaponTimers().katana,prior);
 g.update(.05,false);
 assert.equal(g.slashLog.length,1);
});
test('katana: no eligible target uses short retry instead of full cooldown',()=>{
 const g=scene(84);
 g.combatScene('katana',[{dx:-105,dy:0,hp:150,max:150}],[],1);
 g.armWeapons();g.weapons(.05);
 assert.equal(g.slashLog.length,0);
 assert.ok(g.weaponTimers().katana>0&&g.weaponTimers().katana<=.11);
 const foe=g.snapshot().enemies[0],player=g.snapshot();
 foe.x=player.x+105;
 g.weapons(.11);
 assert.equal(g.slashLog.length,1);
 assert.ok(foe.hp<150);
});
test('katana: 8 facing angles all attack in front without striking symmetrical rear target',()=>{
 for(let sector=0;sector<8;sector++){
  const angle=sector*Math.PI/4,g=scene(90+sector);
  g.setFacingAngle(angle);
  const front={dx:Math.cos(angle)*90,dy:Math.sin(angle)*90,hp:300,max:300,id:'front'};
  const back={dx:-front.dx,dy:-front.dy,hp:300,max:300,id:'back'};
  g.combatScene('katana',[front,back],[],1);
  g.armWeapons();g.weapons(.05);
  const [forward,rear]=g.snapshot().enemies;
  assert.ok(forward.hp<300,'front miss at sector '+sector);
  assert.equal(rear.hp,300,'rear hit at sector '+sector);
 }
});
test('runFrame: even a ten-second stall processes at most four 50ms simulation steps',()=>{
 const g=scene(109);
 g.stepFrame(16.7);
 const before=g.snapshot();
 g.stepFrame(10000);
 const after=g.snapshot();
 const moved=after.elapsed-before.elapsed;
 assert.ok(moved>0&&moved<=.200001,'simulation step should be capped at .2s, got '+moved);
 assert.ok(after.oil<=before.oil);
 assert.ok(g.combatPhase().simulationCarry<=.000001);
});
test('drawWorld: rain-port frames and Boss bars preserve context save/restore at two tilt modes',()=>{
 for(const tilt of [.6,1]){
  const g=loadGame({seed:110,stage:'rain-port'});
  let depth=0,draws=0;
  g.ctx.save=()=>{depth++;draws++;};
  g.ctx.restore=()=>{depth--;assert.ok(depth>=0);};
  g.env.VIEWPORT.setTiltScale(tilt);
  g.start();g.stopSpawns();g.clearOrders();
  g.prepareBoss();
  for(let i=0;i<3;i++){g.stepFrame(16.7);assert.equal(depth,0);}
  assert.ok(draws>0);
 }
});

test('core rain module loads before the main game and has its seeded weather hash available',()=>{
 const fs=require('node:fs');
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/game.js?v=20261103-dragon-phase29'));
 assert.ok(html.indexOf('js/game-weather.js')>=0);
 assert.ok(html.indexOf('js/game-weather.js')<html.indexOf('js/game.js'));
 const weather=fs.readFileSync('js/game-weather.js','utf8');
 const game=fs.readFileSync('js/game.js','utf8');
 assert.ok(weather.includes('return Object.freeze({drawStageWeather, rainUnit})'));
 assert.ok(game.includes('const rainUnit = window.GAME_WEATHER.rainUnit;'));
});
