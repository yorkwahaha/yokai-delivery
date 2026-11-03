'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
const target=context.window.GAME_COMBAT_MATH.boomStickTarget;
function original(enemies,q){
  for(const e of enemies){
    if(e.hp>0&&Math.hypot(e.x-q.x,e.y-q.y)<(e.type==='boss'?54:32))return e;
  }
  return null;
}
function rng(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1103515245)+12345)>>>0;return n/4294967296;};}
test('Phase33 25,000 seeded boom-collision scenarios preserve first target identity',()=>{
  const r=rng(33033);
  for(let i=0;i<25000;i++){
    const q=Object.freeze({x:(r()-.5)*400,y:(r()-.5)*400,vx:123,stuck:false});
    const enemies=Object.freeze(Array.from({length:i%22},(_,j)=>Object.freeze({
      id:j,x:q.x+(r()-.5)*150,y:q.y+(r()-.5)*150,
      hp:[-1,0,1,10,NaN][(i+j)%5],
      type:['boss','tank','shiome','ghost',undefined][(i+j)%5],
      shield:j%3===0,vanish:j%7===0,done:j%11===0
    })));
    assert.strictEqual(target(enemies,q),original(enemies,q),'seed '+i);
  }
});
test('Phase33 collision uses strict less-than, boss radius 54 and first collision',()=>{
  const q={x:0,y:0};
  const enemies=[
    {id:'at32',x:32,y:0,hp:10,type:'ghost'},
    {id:'at54boss',x:54,y:0,hp:10,type:'boss'},
    {id:'first',x:31,y:0,hp:10,type:'ghost'},
    {id:'second',x:5,y:0,hp:10,type:'boss'}
  ];
  assert.strictEqual(target(enemies,q),enemies[2]);
  assert.strictEqual(target(enemies.slice(0,2),q),null);
  assert.strictEqual(target([{id:'boss',x:53.999,y:0,hp:1,type:'boss'}],q)?.id,'boss');
  assert.strictEqual(target([{id:'dead',x:0,y:0,hp:0}],q),null);
});
test('Phase33 collision search has no side effects and game owns projectile state',()=>{
  const q=Object.freeze({x:0,y:0,vx:4,life:2});
  const e=Object.freeze({x:5,y:0,hp:10});
  assert.strictEqual(target(Object.freeze([e]),q),e);
  assert.equal(q.vx,4);
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/GAME_COMBAT_MATH\.boomStickTarget\(enemies, q\)/);
  assert.match(game,/q\.seekTarget = null/);
  assert.match(game,/q\.fuse = q\.initialFuse \?\? BOOM_FUSE/);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf(scriptUrl('game-combat-math'))<html.indexOf(scriptUrl('game')));
});
