'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {loadGame}=require('./helpers/game-runtime.cjs');
const AI=require('../js/boss-ai.js');
test('B3 Lv5 needle emits eight discrete directions over 0.4s, then 1s cooldown; basic shots do not freeze',()=>{
 const g=loadGame({seed:90});g.start();g.stopSpawns();g.combatScene('needle',[],[],5);
 const counts=[];
 for(let i=0;i<8;i++){g.update(.05);counts.push(g.snapshot().needles.length);}
 assert.deepEqual(counts,[1,2,3,4,5,6,7,8]);
 assert.equal(g.weaponTimers().needle,1,'cooldown begins only after eighth release');
 const shot=g.snapshot().needles[0],P=g.snapshot();
 assert.ok(shot.originY<P.y-30,'launch height must be behind the upper body, not feet');
 assert.ok(g.snapshot().needles.every(n=>n.frost===false&&!n.ice),'no freeze without frost mutation');
 g.update(.05);assert.ok(g.weaponTimers().needle<1&&g.weaponTimers().needle>0.9);
 const source=fs.readFileSync('js/game.js','utf8'),section=source.slice(source.indexOf('for (const queued of needleQueued)'),source.indexOf('needleQueued = needleQueued.filter'));
 assert.match(section,/AUDIO.needle\(spec.level\)/,'each queued shot triggers its own SFX');
});
test('B3 level-one basic needle carries no frost payload without mutation',()=>{
 const g=loadGame({seed:91});g.start();g.stopSpawns();g.combatScene('needle',[],[],1);g.update(.05);
 const darts=g.snapshot().needles;
 assert.ok(darts.length>0);assert.ok(darts.every(n=>!n.frost&&!n.ice));
});
test('needle Lv3 spreads 90 degrees, Lv4 spreads 120 degrees, Lv5 eight directions cover 360 degrees',()=>{
 const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`angle ${actual} expected ${expected}`);
 for(const [level,expectedSpread,count] of [[3,Math.PI/2,7],[4,Math.PI*2/3,8]]){
  const g=loadGame({seed:92});g.start();g.stopSpawns();
  g.combatScene('needle',[],[],level);g.setFacingAngle(0);g.update(.05);
  const headings=g.snapshot().needles.map(n=>n.launchAng).sort((a,b)=>a-b);
  assert.equal(headings.length,count);
  close(headings[headings.length-1]-headings[0],expectedSpread);
  close(headings[0],-expectedSpread/2);
  close(headings[headings.length-1],expectedSpread/2);
 }
 const g=loadGame({seed:93});g.start();g.stopSpawns();
 g.combatScene('needle',[],[],5);g.setFacingAngle(0);
 for(let i=0;i<8;i++)g.update(.05);
 const headings=g.snapshot().needles.map(n=>((n.launchAng%(Math.PI*2))+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b);
 assert.equal(headings.length,8);
 for(let i=0;i<8;i++)close(headings[i],i*Math.PI/4);
});
test('B3 charge warning endpoint is actual wall-clipped travel endpoint and hit trajectory',()=>{
 const e={x:0,y:0,hp:300,max:300,bossIndex:1,shield:false,_attackStep:1,attackCd:0};
 const p={x:200,y:44};
 const opts={stageId:'night-town',bossVisualFootOffsetY:44,blocked:(x)=>x>=70&&x<=90};
 AI.step(e,p,.01,opts);
 const h=e.hazard;
 assert.equal(h.kind,'charge');assert.equal(h.y,44);assert.ok(h.length<=64&&h.length>=56, 'wall must shorten preview');
 const expected=h.x+Math.cos(h.angle)*h.length;
 AI.step(e,p,1.0,opts);
 for(let i=0;i<20&&e.hazard?.phase!=='recovery';i++)AI.step(e,p,.05,opts);
 assert.ok(Math.abs(e.x-expected)<1.0,'actual boss movement stops at preview tip');
 assert.equal(e.hazard?.phase,'recovery');
});
