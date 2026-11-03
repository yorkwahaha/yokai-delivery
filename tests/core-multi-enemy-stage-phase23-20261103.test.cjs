'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');
const AI=require('../js/boss-ai.js');
function battle(seed=220,stage='night-town') {
 const g=loadGame({seed,stage});
 g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
 g.setInvulnerability(0);return g;
}
function near(a,b,eps=.00001){assert.ok(Math.abs(a-b)<eps,'expected '+a+' near '+b);}
function bullet(g,{dx=0,dy=0,vx=0,vy=0,life=2}={}){
 const p=g.snapshot(),b={x:p.x+dx,y:p.y+dy,vx,vy,life};
 g.snapshot().enemyBullets.push(b);return b;
}
test('P23 multi-foe forward sword swing damages three, not rear or sealed boss HP',()=>{
 const g=battle(220);
 g.combatScene('katana',[
  {id:'a',dx:85,dy:0,hp:150,max:150},
  {id:'b',dx:105,dy:-26,hp:150,max:150},
  {id:'c',dx:115,dy:22,hp:150,max:150},
  {id:'rear',dx:-85,dy:0,hp:150,max:150},
  {id:'sealed',dx:90,dy:10,hp:150,max:150,type:'boss',shield:true}
 ],[],1);
 g.armWeapons();g.weapons(.05);
 const hp=Object.fromEntries(g.snapshot().enemies.map(e=>[e.id,e.hp]));
 for(const id of ['a','b','c'])assert.ok(hp[id]<150,id);
 for(const id of ['rear','sealed'])assert.equal(hp[id],150,id);
 assert.equal(g.slashLog.length,1);
});
test('P23 two distinct lethal hits reward exactly two kills, not duplicates',()=>{
 const g=battle(221);
 g.combatScene('katana',[
  {id:'a',dx:80,dy:0,hp:3,max:3},{id:'b',dx:100,dy:12,hp:3,max:3}
 ],[],0);
 const foes=g.snapshot().enemies,score=g.snapshot().score;
 g.hurt(foes[0],12);g.hurt(foes[1],12);
 assert.equal(g.snapshot().score-score,30);
 g.hurt(foes[0],12);g.hurt(foes[1],12);
 assert.equal(g.snapshot().score-score,30);
});
test('P23 frozen death shatter strikes at most 3 nearby and ignores sealed foe',()=>{
 const g=battle(222);
 const extra=Array.from({length:5},(_,i)=>({
  id:'near-'+i,dx:110+i*3,dy:(i+1)*9,hp:100,max:100
 }));
 g.combatScene('katana',[
  {id:'frozen',dx:110,dy:0,hp:2,max:2},...extra,
  {id:'shielded',dx:113,dy:-12,hp:100,max:100,shield:true}
 ],[],0);
 const foes=g.snapshot().enemies,primary=foes[0];
 const volley={used:false,hits:new Set()};
 Object.assign(primary,{freezeT:1,freezeEnds:9999,shatterVolley:volley});
 g.hurt(primary,3);
 assert.equal(volley.used,true);
 assert.equal(foes.slice(1,6).filter(e=>e.hp<100).length,3);
 assert.equal(foes[6].hp,100);assert.equal(volley.hits.size,3);
 const before=foes.slice(1,6).map(e=>e.hp);
 g.hurt(primary,3);
 assert.deepEqual(foes.slice(1,6).map(e=>e.hp),before);
});
test('P23 expired enemy bullet cannot hit the player during same frame',()=>{
 const g=battle(223);g.combatScene('katana',[],[],0);
 const oil=g.snapshot().oil;
 bullet(g,{life:.025});g.update(.05);
 assert.equal(g.snapshot().enemyBullets.length,0);
 assert.ok(g.snapshot().oil>oil-.1);
});
test('P23 two bullets colliding simultaneously apply only one invulnerability hit',()=>{
 const g=battle(224);g.combatScene('katana',[],[],0);
 const oil=g.snapshot().oil;
 bullet(g,{life:2});bullet(g,{life:2});g.update(.05);
 const used=oil-g.snapshot().oil;
 assert.ok(used>=8&&used<9,'oil used '+used);
 assert.ok(g.snapshot().inv>0);
 assert.equal(g.snapshot().enemyBullets.length,0);
});
test('P23 safe Boss reading freezes hostile bullet position, lifetime and oil',()=>{
 const g=battle(225);g.prepareBoss();
 const b=bullet(g,{dx:100,vx:-150,life:2}),p=g.snapshot();
 g.update(.05);
 near(g.snapshot().elapsed,p.elapsed);near(g.snapshot().oil,p.oil);
 near(b.x,p.x+100);near(b.life,2);
});
test('P23 Boss curse prevents sword attacks but does not grant bullet immunity',()=>{
 const g=battle(226);
 g.combatScene('katana',[{dx:98,dy:0,hp:150,max:150}],[],1);
 g.armWeapons();g.setCurseSeconds(10);
 const oil=g.snapshot().oil;
 bullet(g,{life:1});g.update(.05);
 assert.equal(g.slashLog.length,0);
 assert.equal(g.snapshot().enemies[0].hp,150);
 assert.ok(g.snapshot().oil<oil-7);
 assert.ok(g.combatPhase().curse<10&&g.combatPhase().curse>9);
});

test('P23 tick partition preserves hit sequence; cooldown counts after first cast',()=>{
 const a=battle(227),b=battle(227);
 const foes=[{dx:100,dy:-15,hp:200,max:200},{dx:105,dy:20,hp:200,max:200}];
 for(const g of [a,b]){g.combatScene('katana',foes,[],1);g.armWeapons();}
 a.weapons(.1);b.weapons(.05);b.weapons(.05);
 const hp=g=>g.snapshot().enemies.map(e=>e.hp);
 assert.deepEqual(hp(a),hp(b));
 assert.equal(a.slashLog.length,1);
 assert.equal(b.slashLog.length,1);
 // First cast starts on the first tick. A single .1s call sets the full
 // cooldown once, while two .05s calls then tick that cooldown by .05s.
 near(a.weaponTimers().katana-b.weaponTimers().katana,.05);
});
test('P23 final Boss waits if earlier non-gate Boss remains alive',()=>{
 const g=battle(228);
 g.placeBoss(250,{dx:650,bossIndex:1});
 const older=g.snapshot().enemies.find(e=>e.type==='boss');
 g.forceBossSchedule(3,0);g.update(.05);
 assert.equal(g.snapshot().bossStage,3);
 assert.equal(g.snapshot().enemies.filter(e=>e.type==='boss'&&e.hp>0).length,1);
 assert.ok(older.hp>0);
});
test('P23 defeating earlier Boss allows final spawn only once',()=>{
 const g=battle(229);
 g.placeBoss(20,{dx:650,bossIndex:1});
 const old=g.snapshot().enemies.find(e=>e.type==='boss');
 g.forceBossSchedule(3,0);g.update(.05);
 assert.equal(g.snapshot().bossStage,3);
 g.hurt(old,30);
 g.forceBossSchedule(3,0);g.update(.05);
 const alive=g.snapshot().enemies.filter(e=>e.type==='boss'&&e.hp>0);
 assert.equal(alive.length,1);
 assert.equal(alive[0].final,true);
 assert.equal(g.snapshot().bossStage,4);
 g.update(.05);
 assert.equal(g.snapshot().enemies.filter(e=>e.type==='boss'&&e.hp>0).length,1);
});
test('P23 night-town final Boss regeneration transitions after 120s and 240s',()=>{
 const g=battle(230,'night-town');
 g.placeBoss(1000,{dx:750,bossIndex:3});
 const boss=g.snapshot().enemies.find(e=>e.type==='boss');
 Object.assign(boss,{final:true,appearedAt:0,hp:500,regenRestored:0});
 g.setElapsed(119);g.update(.05);near(boss.hp,500);
 g.setElapsed(120);g.update(.05);
 assert.ok(boss.hp>500&&boss.hp<500.4,'phase1 +.25 HP');
 const first=boss.hp;
 g.setElapsed(240);g.update(.05);
 assert.ok(boss.hp-first>.49&&boss.hp-first<.51,'phase2 +.5 HP');
});
test('P23 rain-port final Boss never inherits night-town self-healing phases',()=>{
 const g=battle(231,'rain-port');
 g.placeBoss(1000,{dx:750,bossIndex:3});
 const boss=g.snapshot().enemies.find(e=>e.type==='boss');
 Object.assign(boss,{final:true,appearedAt:0,hp:500,regenRestored:0});
 g.setElapsed(300);g.update(.05);
 near(boss.hp,500);assert.equal(boss.regenRestored,0);
});
test('P23 two Boss AI state machines never share hazard phase or locked target',()=>{
 const a={x:0,y:0,hp:500,max:500,bossIndex:0,shield:false,stageId:'night-town'};
 const b={x:1000,y:0,hp:500,max:500,bossIndex:0,shield:false,stageId:'night-town'};
 const p={x:180,y:0};
 assert.equal(AI.start(a,p,{stageId:'night-town'}),true);
 assert.equal(AI.start(b,{x:1100,y:30},{stageId:'night-town'}),true);
 const keep=JSON.stringify(b.hazard);
 for(let i=0;i<10;i++)AI.step(a,p,.05,{stageId:'night-town'});
 assert.equal(JSON.stringify(b.hazard),keep);
 a.hp=0;AI.step(a,p,1,{stageId:'night-town'});
 assert.equal(JSON.stringify(b.hazard),keep);
 assert.ok(AI.step(b,{x:1100,y:30},.05,{stageId:'night-town'}));
 assert.notEqual(JSON.stringify(b.hazard),keep);
});

test('P23 nearest sealed Boss owns visible quiz, then answering unlocks correct shield only',()=>{
 const g=battle(232);
 const words=g.env.CONTENT.getStageWords('night-town');
 g.prepareBoss(words[0]);g.prepareBoss(words[1]);
 const bosses=g.snapshot().enemies.filter(e=>e.type==='boss');
 const player=g.snapshot();
 Object.assign(bosses[0],{x:player.x+110,y:player.y,speed:0,attackCd:Infinity});
 Object.assign(bosses[1],{x:player.x+210,y:player.y,speed:0,attackCd:Infinity});
 g.update(.05);
 const current=g.snapshot().bossQ;
 assert.equal(current.word.jp,words[0].jp);
 const correct=current.ans.findIndex(w=>w===bosses[0].word);
 assert.ok(correct>=0);
 assert.ok(current.lock>0,'freshly opened quiz must retain its input lock');
 g.answerBoss(correct);
 assert.equal(bosses[0].shield,true,'answer during initial lock must be rejected');
 g.unlockBoss();
 g.answerBoss(correct);
 assert.equal(bosses[0].shield,false);
 assert.equal(bosses[1].shield,true);
 g.update(.05);
 const next=g.snapshot().bossQ;
 assert.ok(next);
 assert.equal(next.word.jp,words[1].jp);
});
test('P23 wrong answer flags owning boss, not the untouched second boss',()=>{
 const g=battle(233);
 const words=g.env.CONTENT.getStageWords('night-town');
 g.prepareBoss(words[0]);g.prepareBoss(words[1]);
 const bosses=g.snapshot().enemies.filter(e=>e.type==='boss');
 const player=g.snapshot();
 Object.assign(bosses[0],{x:player.x+110,y:player.y,speed:0,attackCd:Infinity});
 Object.assign(bosses[1],{x:player.x+210,y:player.y,speed:0,attackCd:Infinity});
 g.update(.05);
 const quiz=g.snapshot().bossQ;
 const wrong=quiz.ans.findIndex(w=>w!==bosses[0].word);
 assert.ok(wrong>=0);
 g.unlockBoss();g.answerBoss(wrong);
 assert.equal(bosses[0].wrongPaid,true);
 assert.notEqual(bosses[1].wrongPaid,true);
 g.setCurseSeconds(0);
 bosses[0].x=player.x+520;
 g.update(.05);
 assert.equal(g.snapshot().bossQ.word.jp,words[1].jp);
 assert.equal(g.snapshot().bossQ.wrong.length,0);
});
test('P23 final boss healing never exceeds lifetime restored cap of twice max HP',()=>{
 const g=battle(234);
 g.placeBoss(1000,{dx:700,bossIndex:3});
 const boss=g.snapshot().enemies.find(e=>e.type==='boss');
 Object.assign(boss,{final:true,appearedAt:0,hp:550,regenRestored:1999.9});
 g.setElapsed(300);g.update(.05);
 near(boss.regenRestored,2000);
 near(boss.hp,550.1);
 g.update(.05);
 near(boss.regenRestored,2000);
 near(boss.hp,550.1);
});
test('P23 laggy Boss AI crosses warning into active and impacts exactly once',()=>{
 const boss={x:0,y:0,hp:300,max:300,bossIndex:0,shield:false,stageId:'rain-port'};
 const p={x:160,y:0};
 const warn=AI.step(boss,p,1.2,{stageId:'rain-port'});
 assert.equal(warn.started,true);
 assert.equal(warn.hit,null);
 assert.equal(boss.hazard.kind,'slam');
 assert.equal(boss.hazard.phase,'active');
 const one=AI.step(boss,p,.05,{stageId:'rain-port'});
 assert.equal(one.hit.kind,'slam');
 const two=AI.step(boss,p,.05,{stageId:'rain-port'});
 assert.equal(two.hit,null);
});
