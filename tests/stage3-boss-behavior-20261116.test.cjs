'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const AI=require('../js/boss-ai.js');
const SAKURA=require('../js/boss-sakura.js');
const options={stageId:'sakura-pass',blocked:()=>false,bounds:{minX:900,maxX:1800}};
const boss=(index=0,half=false)=>({type:'boss',x:1300,y:900,hp:half?40:100,max:100,
 stageId:'sakura-pass',bossTheme:'sakura',bossIndex:index,final:index===3,
 speed:SAKURA.walkSpeed(index),shield:false,attackCd:0});
function cast(kind,index=0,half=false,p={x:1470,y:900}){
 const e=boss(index,half),pool=index===0?['sakuraRush','sakuraFan','sakuraBloom']
  :index===1?['sakuraFan','sakuraBloom','sakuraRush']:['sakuraRush','sakuraBloom','sakuraFan'];
 e._sakuraAttackStep=pool.indexOf(kind);assert.equal(AI.start(e,p,options),true);
 assert.equal(e.hazard.kind,kind);return e;
}
function activate(e,p){AI.step(e,p,e.hazard.duration+.001,options);assert.equal(e.hazard.phase,'active');}

test('all four Stage3 bosses have three dedicated moves; previous stage attack pools remain unchanged',()=>{
 for(let i=0;i<4;i++){
  const e=boss(i),seen=new Set();
  for(let j=0;j<3;j++){AI.start(e,{x:1480,y:900},options);seen.add(e.hazard.kind);delete e.hazard;}
  assert.deepEqual(seen,new Set(['sakuraRush','sakuraFan','sakuraBloom']));
 }
 const town={...boss(1),stageId:'night-town',bossTheme:'town'};
 AI.start(town,{x:1480,y:900},{stageId:'night-town'});assert.equal(town.hazard.kind,'slam');
 const port={...boss(0),stageId:'rain-port',bossTheme:'harbor'};
 AI.start(port,{x:1480,y:900},{stageId:'rain-port'});assert.equal(port.hazard.kind,'rainVortex');
 assert.deepEqual([0,1,2,3].map(SAKURA.walkSpeed),[130,140,150,165]);
});
test('rush locks the visible foot origin and direction, clips to walls and sweeps hits at low FPS once',()=>{
 const p={x:1700,y:900},e=boss();const opts={...options,blocked:(x)=>x>1600};
 AI.start(e,p,{...opts,bossVisualFootOffsetY:40});const h=e.hazard;
 assert.equal(h.y,940);assert.equal(h.footOffsetY,40);assert.ok(h.length<310);
 const angle=h.angle;p.y+=300;
 AI.step(e,p,h.duration+.01,opts);assert.equal(h.angle,angle);
 AI.step(e,p,1,opts);assert.ok(e.x<=1600);
 const crossing={x:1450,y:900},sweep=cast('sakuraRush',0,false,crossing);
 activate(sweep,crossing);
 assert.equal(AI.step(sweep,crossing,.3,options).hit?.kind,'sakuraRush');
 assert.equal(AI.step(sweep,crossing,.3,options).hit,null);
});
test('fan uses locked radial lanes, blocks feathers at buildings and leaves the back safe',()=>{
 const p={x:1465,y:900},e=cast('sakuraFan',0,false,p);
 assert.equal(e.hazard.shots.length,5);activate(e,p);
 assert.equal(AI.step(e,p,.5,options).hit?.kind,'sakuraFan');
 assert.equal(AI.step(e,p,.2,options).hit,null);
 const safe=cast('sakuraFan'),behind={x:1200,y:900};activate(safe,behind);
 assert.equal(AI.step(safe,behind,1,options).hit,null);
 const wall=cast('sakuraFan');activate(wall,p);
 assert.equal(AI.step(wall,p,1,{...options,blocked:x=>x>1370}).hit,null);
 assert.ok(wall.hazard.shots.every(s=>s.dead));
 const final=cast('sakuraFan',3,true);assert.equal(final.hazard.shots.length,7);
});
test('root marks snapshot the player, avoid walls and buildings, and cannot hurt during warning',()=>{
 const p={x:1730,y:900},e=cast('sakuraBloom',0,false,p),h=e.hazard;
 assert.equal(h.marks.length,3);
 assert.ok(h.marks.every(m=>m.x>=994 && m.x<=1706));
 const locked=JSON.stringify(h.marks);
 assert.equal(AI.step(e,p,.2,options).hit,null);
 p.x=1100;p.y=1200;AI.step(e,p,.2,options);assert.equal(JSON.stringify(h.marks),locked);
 const blocked=(x,y)=>x>1440 && x<1570 && y>840 && y<1000;
 const building=boss();building._sakuraAttackStep=2;
 AI.start(building,{x:1400,y:900},{...options,blocked});
 assert.ok(building.hazard.marks.every(m=>[[0,0],[74,0],[-74,0],[0,74],[0,-74]].every(([x,y])=>!blocked(m.x+x,m.y+y))));
});
test('staggered root windows remain detectable with coarse steps and deal at most one hit per cast',()=>{
 const p={x:1470,y:900},e=cast('sakuraBloom',0,false,p);activate(e,p);
 assert.equal(AI.step(e,p,.5,options).hit?.kind,'sakuraBloom');
 assert.equal(AI.step(e,p,.5,options).hit,null);
 const final=cast('sakuraBloom',3,true);assert.equal(final.hazard.marks.length,5);
 assert.ok(final.hazard.marks.every((m,i)=>m.delay===i*.24));
});
test('half-HP final rush gets only one newly telegraphed followup and then returns to its pattern',()=>{
 const p={x:1470,y:900},e=cast('sakuraRush',3,true,p);
 activate(e,p);AI.step(e,p,1,options);AI.step(e,p,e.hazard.duration+.01,options);
 assert.equal(e._sakuraFollowup,true);
 AI.step(e,p,.36,options);assert.equal(e.hazard.kind,'sakuraRush');assert.equal(e.hazard.chain,true);
 assert.ok(e.hazard.duration>=.7);activate(e,p);AI.step(e,p,1,options);AI.step(e,p,e.hazard.duration+.01,options);
 assert.equal(e._sakuraFollowup,false);AI.step(e,p,.66,options);assert.equal(e.hazard.kind,'sakuraBloom');
});
test('pause/shield stop attack clocks, death clears hazards and slow/freeze speed caps affect movement',()=>{
 const p={x:1470,y:900},e=cast('sakuraRush');const saved=JSON.stringify(e.hazard);
 AI.step(e,p,.5,{...options,paused:true});assert.equal(JSON.stringify(e.hazard),saved);
 e.shield=true;AI.step(e,p,.5,options);assert.equal(JSON.stringify(e.hazard),saved);e.shield=false;
 activate(e,p);const oldX=e.x;
 AI.step(e,p,.2,{...options,speed:0});assert.equal(e.x,oldX);
 e.hp=0;AI.step(e,p,.1,options);assert.equal(e.hazard,undefined);assert.equal(e._sakuraFollowup,false);
 const moving=boss(),old={x:moving.x,y:moving.y};
 assert.equal(AI.footwork(moving,p,.2,{...options,speed:25}),true);
 assert.ok(Math.hypot(moving.x-old.x,moving.y-old.y)<=5.000001);
 assert.equal(AI.footwork(moving,p,.2,{...options,speed:0}),false);
});
