'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
const extracted=context.window.GAME_COMBAT_MATH.crosscutContains;
// Original pre-Phase32 geometry, frozen for comparison.
function before(enemy,cc) {
  const ed=Math.hypot(enemy.x-cc.x,enemy.y-cc.y);
  if(ed<=cc.reach) {
    let diff=Math.abs(Math.atan2(enemy.y-cc.y,enemy.x-cc.x)-cc.crossAng);
    while(diff>Math.PI)diff=Math.abs(diff-2*Math.PI);
    if(diff<=cc.arc)return true;
  }
  return false;
}
function rand(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,22695477)+1)>>>0;return x/4294967296;};}
test('Phase32 18,000 crosscut cones preserve radius and angular inclusion',()=>{
  const r=rand(32032);
  for(let i=0;i<18000;i++){
    const cc=Object.freeze({x:(r()-.5)*200,y:(r()-.5)*250,reach:[0,120,200,560,900,NaN,undefined][i%7],
      crossAng:(r()-.5)*4*Math.PI,arc:[0,.5,1.15,2,Math.PI,NaN][i%6]});
    const enemy=Object.freeze({x:cc.x+(r()-.5)*1000,y:cc.y+(r()-.5)*1200});
    assert.equal(extracted(enemy,cc),before(enemy,cc),'seed '+i);
  }
});
test('Phase32 exact radius/angle boundary and NaN behavior',()=>{
  const cc=Object.freeze({x:0,y:0,reach:100,arc:Math.PI/3,crossAng:0});
  const examples=[
    {x:100,y:0},{x:100.0001,y:0},{x:0,y:0},
    {x:50,y:Math.sqrt(3)*50},{x:50.01,y:Math.sqrt(3)*50},
    {x:-50,y:0},{x:NaN,y:0},{x:Infinity,y:0}
  ];
  for(const enemy of examples)assert.equal(extracted(enemy,cc),before(enemy,cc));
  assert.equal(extracted({x:100,y:0},cc),true);
  assert.equal(extracted({x:100.0001,y:0},cc),false);
  assert.equal(extracted({x:-50,y:0},cc),false);
});
test('Phase32 helper remains pure; hit set, critical and damage stay in game',()=>{
  const e=Object.freeze({x:40,y:20,hp:10,type:'boss'});
  const cc=Object.freeze({x:0,y:0,crossAng:0,arc:1.1,reach:90});
  assert.equal(extracted(e,cc),before(e,cc));
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/GAME_COMBAT_MATH\.crosscutContains\(e, cc\)/);
  assert.match(game,/const isMainHit = cc\.mainHits && cc\.mainHits\.has\(e\)/);
  assert.match(game,/cc\.hits\.add\(e\)/);
  assert.ok(fs.readFileSync('index.html','utf8').indexOf(scriptUrl('game-combat-math'))<
    fs.readFileSync('index.html','utf8').indexOf(scriptUrl('game')));
});
