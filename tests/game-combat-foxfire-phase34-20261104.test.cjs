'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
const math=context.window.GAME_COMBAT_MATH;
function beforeContact(e,x,y,elapsed){
  return e.hp>0&&!(e.ifr>elapsed)&&Math.hypot(e.x-x,e.y-y)<(e.type==='boss'?54:30);
}
function beforeLaunch(enemies,P){
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  return enemies.filter(e=>e.hp>0&&!e.shield&&!e.vanish&&!e.done&&dist(P,e)<520);
}
function rand(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
test('Phase34 18,000 foxfire contact cases preserve invulnerability and hit distances',()=>{
  const r=rand(34034);
  for(let i=0;i<18000;i++){
    const x=(r()-.5)*800,y=(r()-.5)*600,elapsed=[0,1,10,NaN][i%4];
    const e=Object.freeze({x:x+(r()-.5)*120,y:y+(r()-.5)*120,
      hp:[0,1,10,NaN][i%4],ifr:[-1,0,1,11,NaN,undefined][i%6],
      type:['boss','ghost','tank','shiome'][i%4],shield:i%7===0});
    assert.equal(math.foxfireOrbitContact(e,x,y,elapsed),beforeContact(e,x,y,elapsed),'seed '+i);
  }
});
test('Phase34 18,000 foxfire launch target pools preserve exact array order and identity',()=>{
  const r=rand(34434);
  for(let i=0;i<18000;i++){
    const P=Object.freeze({x:(r()-.5)*500,y:(r()-.5)*500});
    const enemies=Object.freeze(Array.from({length:i%24},(_,j)=>Object.freeze({
      id:j,x:P.x+(r()-.5)*1600,y:P.y+(r()-.5)*1600,
      hp:[-1,0,1,NaN,10][(j+i)%5],shield:j%5===0,done:j%7===0,vanish:j%11===0
    })));
    const current=math.foxfireLaunchTargets(enemies,P),old=beforeLaunch(enemies,P);
    assert.equal(current.length,old.length,'seed '+i);
    for(let k=0;k<old.length;k++)assert.strictEqual(current[k],old[k],'identity '+i+'/'+k);
  }
});
test('Phase34 strict 30/54 contact, 520 launch boundaries and caller-owned behavior',()=>{
  const e={x:30,y:0,hp:1,type:'ghost',ifr:0};
  assert.equal(math.foxfireOrbitContact(e,0,0,0),false);
  assert.equal(math.foxfireOrbitContact({...e,x:29.999},0,0,0),true);
  assert.equal(math.foxfireOrbitContact({...e,x:53.999,type:'boss'},0,0,0),true);
  assert.equal(math.foxfireOrbitContact({...e,x:54,type:'boss'},0,0,0),false);
  assert.equal(math.foxfireOrbitContact({...e,x:1,ifr:1},0,0,0),false);
  assert.equal(math.foxfireLaunchTargets([{...e,x:520},{...e,x:519.999}],{x:0,y:0}).length,1);
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/GAME_COMBAT_MATH\.foxfireOrbitContact\(e, fx, fy, elapsed\)/);
  assert.match(game,/GAME_COMBAT_MATH\.foxfireLaunchTargets\(enemies, P\)/);
  assert.match(game,/e\.ifr = elapsed \+ fireSpec\.hitInterval/);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf(scriptUrl('game-combat-math'))<html.indexOf(scriptUrl('game')));
});
