const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/evolutions.js');

test('Lv2/Lv3 inherit the old mid/MAX projectile density and Lv5 keeps bounded volleys',()=>{
  assert.deepEqual([1,2,3,4,5].map(E.needleCount),[3,5,7,7,7]);
  assert.deepEqual([1,2,3,4,5].map(E.boomCount),[1,2,3,3,3]);
  assert.deepEqual([1,2,3,4,5].map(E.fireCount),[2,4,5,5,5]);
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
