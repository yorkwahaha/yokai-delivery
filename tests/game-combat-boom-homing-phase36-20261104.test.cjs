'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
const math=context.window.GAME_COMBAT_MATH;
function original(enemies,q){
  let nearest=q.seekRange,chosen=null;
  for(const e of enemies){
    if(e.hp>0&&!e.shield&&!e.vanish&&!e.done){
      const d=Math.hypot(q.x-e.x,q.y-e.y);
      if(d<=nearest){nearest=d;chosen=e;}
    }
  }
  return chosen;
}
function rng(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
test('Phase36 30,000 seeded homing reacquisitions preserve final target identity',()=>{
  const r=rng(36036);
  for(let i=0;i<30000;i++){
    const q=Object.freeze({x:(r()-.5)*400,y:(r()-.5)*400,
      seekRange:[0,40,450,560,700,NaN,Infinity,-1,undefined][i%9]});
    const enemies=Object.freeze(Array.from({length:i%30},(_,j)=>Object.freeze({
      id:j,x:q.x+(r()-.5)*1100,y:q.y+(r()-.5)*1100,
      hp:[0,1,10,NaN][(i+j)%4],
      shield:(j+i)%7===0,vanish:(j+i)%9===0,done:(j+i)%13===0
    })));
    assert.strictEqual(math.boomHomingTarget(enemies,q),original(enemies,q),'seed '+i);
  }
});
test('Phase36 <= permits exact range and last equal-distance wins',()=>{
  const q={x:0,y:0,seekRange:100};
  const a={id:'first',x:100,y:0,hp:1};
  const b={id:'last',x:-100,y:0,hp:1};
  const c={id:'shield',x:0,y:0,hp:5,shield:true};
  assert.strictEqual(math.boomHomingTarget([a,b,c],q),b);
  assert.strictEqual(math.boomHomingTarget([c],q),null);
  assert.strictEqual(math.boomHomingTarget([{...a,x:100.001}],q),null);
  assert.strictEqual(math.boomHomingTarget([{...a,x:NaN}],q),null);
  assert.strictEqual(math.boomHomingTarget([a],{...q,seekRange:undefined}),null);
});
test('Phase36 does not mutate projectile and leaves retarget/steering/damage in runtime',()=>{
  const q=Object.freeze({x:0,y:0,seekRange:100,retargetT:0.2,searchCount:4});
  const a=Object.freeze({x:5,y:0,hp:10});
  assert.strictEqual(math.boomHomingTarget(Object.freeze([a]),q),a);
  assert.equal(q.retargetT,0.2);
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/GAME_COMBAT_MATH\.boomHomingTarget\(enemies, q\)/);
  assert.match(game,/q\.retargetT = 0\.20/);
  assert.match(game,/q\.searchCount = \(q\.searchCount \|\| 0\) \+ 1/);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf(scriptUrl('game-combat-math'))<html.indexOf(scriptUrl('game')));
});
