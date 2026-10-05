const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/evolutions.js');

test('fire dragon circles once, flies in a serpentine path, and expires at walls',()=>{
  const origin={x:0,y:0,faceAng:0},target={x:330,y:40,hp:10},p=E.dragon(origin,target,0);
  for(let i=0;i<59;i++)E.dragonStep(p,0.01,origin,null);
  assert.ok(Math.hypot(p.x-98,p.y)<12);const headings=[];
  for(let i=0;i<70;i++){E.dragonStep(p,0.01,origin,null);headings.push(p.ang);}
  assert.ok(p.x>250);assert.ok(Math.max(...headings)-Math.min(...headings)>0.4);assert.ok(p.points.length<=24);
  const blocked=E.dragon(origin,target,0);for(let i=0;i<160&&blocked.life>0;i++)E.dragonStep(blocked,0.01,origin,(x,y,r)=>Math.abs(x-145)<r);
  assert.equal(blocked.life,0);assert.ok(blocked.x<145);
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

test('Lv2/Lv3 inherit the old mid/MAX projectile density and Lv5 keeps bounded volleys',()=>{
  assert.deepEqual([1,2,3,4,5].map(E.needleCount),[3,5,7,8,8]);
  assert.deepEqual([1,2,3,4,5].map(E.boomCount),[1,2,3,4,4]);
  assert.deepEqual([1,2,3,4,5].map(E.fireCount),[2,4,5,6,6]);
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
