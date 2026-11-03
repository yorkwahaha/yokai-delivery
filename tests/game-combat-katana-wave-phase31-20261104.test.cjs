'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),sandbox);
const current=sandbox.window.GAME_COMBAT_MATH.katanaWaveContains;
// Frozen copy of the pre-Phase31 branch; independent of current production.
function original(e,wave){
  const along=Math.abs((e.x-wave.x)*Math.cos(wave.ang)+(e.y-wave.y)*Math.sin(wave.ang));
  const side=Math.abs(-(e.x-wave.x)*Math.sin(wave.ang)+(e.y-wave.y)*Math.cos(wave.ang));
  if(along>=(e.type==='boss'?95:75)||side>=180+(e.type==='boss'?40:22))return false;
  const ox=e.x-wave.originX,oy=e.y-wave.originY;
  if(Math.hypot(ox,oy)>(wave.maxTravel||720))return false;
  let ad=Math.abs(Math.atan2(oy,ox)-wave.ang);
  while(ad>Math.PI)ad=Math.abs(ad-2*Math.PI);
  return !(ad>1.22);
}
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
test('Phase31 18,000 seeded Katana-wave geometries are exactly equivalent',()=>{
  const r=random(31031);
  for(let i=0;i<18000;i++){
    const wave=Object.freeze({x:(r()-.5)*400,y:(r()-.5)*400,
      originX:(r()-.5)*400,originY:(r()-.5)*400,
      ang:(r()-.5)*Math.PI*4,maxTravel:[0,400,560,720,900,NaN,Infinity,undefined][i%8]});
    const e=Object.freeze({x:wave.x+(r()-.5)*440,y:wave.y+(r()-.5)*440,
      type:['boss','tank','ghost','shiome',undefined][i%5],hp:i%4});
    assert.equal(current(e,wave),original(e,wave),'seed index '+i);
  }
});
test('Phase31 strict along/side edges and origin range remain unchanged',()=>{
  const w=Object.freeze({x:0,y:0,originX:0,originY:0,ang:0,maxTravel:720});
  for(const e of [
    {x:75,y:0}, {x:74.999,y:0}, {x:10,y:202}, {x:10,y:201.999},
    {x:95,y:0,type:'boss'}, {x:94.999,y:0,type:'boss'},
    {x:20,y:220,type:'boss'},{x:20,y:219.999,type:'boss'},
    {x:0,y:0},{x:NaN,y:12},{x:Infinity,y:0}
  ])assert.equal(current(e,w),original(e,w),JSON.stringify(e));
  assert.equal(current({x:75,y:0},w),false);
  assert.equal(current({x:74.999,y:0},w),true);
  assert.equal(current({x:95,y:0,type:'boss'},w),false);
});
test('Phase31 helper is pure, no damage/crit/effects or enemy-state changes',()=>{
  const w=Object.freeze({x:1,y:2,originX:1,originY:2,ang:1,maxTravel:720});
  const e=Object.freeze({x:15,y:20,type:'tank',hp:10});
  assert.equal(current(e,w),original(e,w));
  assert.match(fs.readFileSync('js/game.js','utf8'),/GAME_COMBAT_MATH\.katanaWaveContains\(e, wave\)/);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf(scriptUrl('game-combat-math'))<html.indexOf(scriptUrl('game')));
});
