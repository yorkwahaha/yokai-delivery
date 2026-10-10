const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/evolutions.js');

test('large dragon enters from offscreen, holds, and exits after three seconds',()=>{
  const origin={x:40,y:120,faceAng:0},entry={startX:-220,endX:135,y:100,size:340},p=E.dragon(origin,0,0,entry);
  for(let i=0;i<20;i++)E.dragonStep(p,0.01,origin,(x,y,r)=>true);
  assert.ok(p.x>entry.startX&&p.x<entry.endX);assert.ok(Math.abs(p.y-entry.y)<4);assert.equal(p.faceX,1);assert.equal(p.size,340);
  assert.ok(p.life>2.7,'barriers must not despawn the brief summon');
  const left=E.dragon(origin,Math.PI,0);E.dragonStep(left,0.01,origin,null);assert.equal(left.faceX,-1);
  for(let i=0;i<330&&p.life>0;i++)E.dragonStep(p,0.01,origin,null);
  assert.equal(p.life<=0,true);
});

test('ice volley chooses eight distinct living targets around the courier and curves into them',()=>{
  const origin={x:0,y:0},foes=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4)*260,y:Math.sin(i*Math.PI/4)*260,hp:10}));
  const volley=E.iceVolley(origin,foes,0,()=>0.5);
  assert.equal(volley.length,8);assert.equal(new Set(volley.map(p=>p.target)).size,8);
  for(const p of volley){let closest=Infinity;for(let i=0;i<65;i++){E.curve(p,0.01);E.move(p,0.01,null);closest=Math.min(closest,Math.hypot(p.x-p.target.x,p.y-p.target.y));}assert.ok(closest<12);}
  assert.equal(E.iceVolley(origin,[],0).length,8);
});

test('ice freeze duration is bounded and cannot be refreshed into a permanent stun',()=>{
  for(const type of ['ghost','boss']){
    const foe={type,hp:10};assert.equal(E.freeze(foe,10),true);
    assert.equal(foe.freezeT,type==='boss'?0.15:0.5);
    assert.equal(E.freeze(foe,10.2),false);assert.equal(E.freeze(foe,12),true);
  }
});

test('foxfire orbit and detached attack counts follow the 1/2/3/3/3 specialist progression',()=>{
  assert.deepEqual([1,2,3,4,5].map(E.needleCount),[3,5,7,8,8]);
  assert.deepEqual([1,2,3,4,5].map(E.boomCount),[1,2,3,4,2]);
  assert.deepEqual([1,2,3,4,5].map(E.fireCount),[1,2,3,3,3]);
  assert.deepEqual([1,2,3,4,5].map(E.fireAttackCount),[0,0,0,1,0]);
});

test('a detached foxfire seeks a foe, then returns to the courier instead of disappearing on hit',()=>{
  const origin={x:0,y:0,faceX:-1},foe={x:240,y:0,hp:10},p=E.fireSpirit(origin,0,4,2);
  for(let i=0;i<20;i++)E.fireSpiritStep(p,0.01,origin,[foe],null);
  assert.ok(p.x>98);assert.equal(p.fireAttack,true);assert.equal(p.slot,2);assert.equal(p.faceX,-1);
  origin.faceX=1;E.fireSpiritStep(p,0.01,origin,[foe],null);assert.equal(p.faceX,1,'detached foxfire follows the courier facing live');
  p.returning=true;p.target=null;
  for(let i=0;i<200&&p.life>0;i++)E.fireSpiritStep(p,0.01,origin,[foe],null);
  assert.equal(p.life,0);
});

test('swept movement stops a fast projectile at a thin wall between frame endpoints',()=>{
  const p={x:0,y:0,vx:640,vy:0,life:1};
  assert.equal(E.move(p,0.05,(x,y,r)=>Math.abs(x-15)<r,6),false);
  assert.equal(p.life,0);assert.ok(p.x<15);
});

test('the final frame cannot push an expiring projectile beyond its intended range',()=>{
  const p={x:0,y:0,vx:640,vy:0,life:0.01};assert.equal(E.move(p,0.05,null),false);
  assert.ok(Math.abs(p.x-6.4)<1e-8);
});

test('a needle curves only during its first 0.28 seconds and then locks its final heading',()=>{
  const p={x:0,y:0,vx:0,vy:0,life:1,curve:true,launchAng:-0.65,age:0,aimX:440,aimY:0};
  for(let i=0;i<30;i++){E.curve(p,0.01);E.move(p,0.01,null);}
  assert.equal(p.curved,true);const heading=p.ang;
  for(let i=0;i<30;i++){E.curve(p,0.01);E.move(p,0.01,null);}
  assert.equal(p.ang,heading);assert.ok(Number.isFinite(p.x+p.y));
});

test('a spirit reacquires a living foe after its target dies and has bounded steering',()=>{
  const dead={x:100,y:0,hp:0},live={x:0,y:200,hp:10};
  const p={x:0,y:0,target:dead,ang:0,age:0};E.seek(p,0.05,[dead,live]);
  assert.equal(p.target,live);assert.ok(p.ang>0&&p.ang<=0.2);
  p.target={x:100,y:0,hp:10};E.seek(p,0.01,[live]);assert.equal(p.target,live,'removed but alive targets are reacquired too');
  live.hp=0;E.seek(p,0.05,[dead,live]);assert.equal(p.target,null);assert.ok(Number.isFinite(p.vx+p.vy));
});

test('MAX dragon launches one swept fireball that hits a target',()=>{
  const d=E.dragon({x:0,y:0},0,0);
  const foe={x:245,y:0,hp:100};
  const shot=E.dragonFireball(d,foe);
  assert.equal(shot.dragonFireball,true);
  let impact={impact:false};
  for(let i=0;i<100&&!impact.impact;i++)impact=E.dragonFireballStep(shot,0.016,[foe],null);
  assert.equal(impact.impact,true);
  assert.equal(impact.target,foe);
  assert.equal(shot.life,0);
});

test('dragon missile respects barriers and creates an impact at flight expiry',()=>{
  const d=E.dragon({x:0,y:0},0,0),target={x:600,y:-85};
  const stopped=E.dragonFireball(d,target);
  const impact=E.dragonFireballStep(stopped,0.3,[],(x)=>x>118);
  assert.equal(impact.impact,true);
  assert.equal(impact.target,null);
  assert.ok(stopped.x<118);
  const free=E.dragonFireball(d,target);
  const expired=E.dragonFireballStep(free,2,[],()=>false);
  assert.equal(expired.impact,true);
  assert.ok(Math.hypot(free.x-d.x,free.y-d.y)<1100);
});
