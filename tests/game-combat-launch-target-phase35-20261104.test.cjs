'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
const target=context.window.GAME_COMBAT_MATH.nearestLaunchTarget;
function original(enemies,P,maxRange){
  let near=null,nd=maxRange;
  for(const e of enemies){
    const d=Math.hypot(P.x-e.x,P.y-e.y);
    if(e.hp>0&&d<nd){near=e;nd=d;}
  }
  return near;
}
function rng(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
test('Phase35 30,000 seeded idle needle/boom launch selections preserve identity',()=>{
  const r=rng(35035);
  for(let i=0;i<30000;i++){
    const P=Object.freeze({x:(r()-.5)*500,y:(r()-.5)*500});
    const enemies=Object.freeze(Array.from({length:i%26},(_,j)=>Object.freeze({
      id:j,x:P.x+(r()-.5)*1300,y:P.y+(r()-.5)*1300,
      hp:[-1,0,1,10,NaN][(i+j)%5],
      shield:j%4===0,done:j%6===0,vanish:j%9===0
    })));
    const threshold=[450,540,0,Infinity,NaN,-1,undefined][i%7];
    assert.strictEqual(target(enemies,P,threshold),original(enemies,P,threshold),'seed '+i);
  }
});
test('Phase35 first equal-distance wins, strict 450/540 boundaries, HP-only eligibility',()=>{
  const P={x:0,y:0};
  const a={id:'at450',x:450,y:0,hp:5};
  const b={id:'first',x:100,y:0,hp:5,shield:true,vanish:true,done:true};
  const c={id:'same-distance',x:-100,y:0,hp:5};
  assert.strictEqual(target([a,b,c],P,450),b);
  assert.strictEqual(target([a],P,450),null);
  assert.strictEqual(target([{id:'near540',x:539.99,y:0,hp:1}],P,540)?.id,'near540');
  assert.strictEqual(target([{id:'at540',x:540,y:0,hp:1}],P,540),null);
  assert.strictEqual(target([{id:'dead',x:0,y:0,hp:0}],P,540),null);
});
test('Phase35 both live callers use the helper; cooldown and shoot-angle logic remain in game',()=>{
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/GAME_COMBAT_MATH\.nearestLaunchTarget\(enemies, P, 450\)/);
  assert.match(game,/GAME_COMBAT_MATH\.nearestLaunchTarget\(enemies, P, 540\)/);
  assert.match(game,/shootAng = near \? Math\.atan2\(near\.y - P\.y, near\.x - P\.x\) : P\.faceAng/);
  assert.match(game,/wT\.boom = 0\.15/);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf(scriptUrl('game-combat-math'))<html.indexOf(scriptUrl('game')));
});
