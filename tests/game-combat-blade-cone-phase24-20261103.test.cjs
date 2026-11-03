'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const original=fs.readFileSync('tests/fixtures/katana-arc-original-phase24.js','utf8');
const newer=fs.readFileSync('js/game-combat-math.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const env={window:{}};
vm.runInNewContext(original+'\nthis.golden=originalBladeArcContains;',env);
vm.runInNewContext(newer,env);
const old=env.golden,now=env.window.GAME_COMBAT_MATH.bladeArcContains;
function rng(seed){
 let x=seed>>>0;
 return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
}
test('Phase24 25k seeded cone boundary cases exactly match prior game computation',()=>{
 const rand=rng(24001),P={x:99.5,y:-53.25},enemies=[];
 for(let i=0;i<25000;i++){
  const angle=(rand()-.5)*Math.PI*8;
  const d=rand()*420;
  const e={x:P.x+Math.cos(angle)*d,y:P.y+Math.sin(angle)*d};
  const reach=[0,90,145,200,280,Infinity,NaN,-1][i%8];
  const facing=(rand()-.5)*Math.PI*8;
  const arc=[0,.3,.55,1.25,Math.PI,Math.PI*2,NaN][i%7];
  const previous=old(P,e,reach,facing,arc);
  const current=now(P,e,reach,facing,arc);
  assert.equal(current,previous,'cone differs at iteration '+i);
  if(i%73===0)enemies.push([e,reach,facing,arc,previous]);
 }
 assert.equal(enemies.length,343);
});
test('Phase24 exact reach/arc boundaries and direction symmetry remain stable',()=>{
 const p={x:0,y:0};
 for(const reach of [0,1,100,140]){
  for(const theta of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
   for(const arc of [0,.00001,.8,Math.PI]){
    for(const distance of [0,reach,reach+.0001]){
     const enemy={x:Math.cos(theta)*distance,y:Math.sin(theta)*distance};
     assert.equal(now(p,enemy,reach,theta,arc),old(p,enemy,reach,theta,arc));
     assert.equal(now(p,enemy,reach,theta+Math.PI,arc),old(p,enemy,reach,theta+Math.PI,arc));
    }
   }
  }
 }
});
test('Phase24 pure geometry does not mutate input, use Math.random, or access game globals',()=>{
 const p=Object.freeze({x:2,y:4}),e=Object.freeze({x:102,y:4});
 assert.equal(now(p,e,100,0,1),true);
 assert.equal(now(p,e,100,Math.PI,1),false);
 assert.deepEqual(p,{x:2,y:4});
 assert.deepEqual(e,{x:102,y:4});
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
 assert.doesNotMatch(newer,/Math\.random\s*\(|localStorage|STORE\.|enemy\.hp\s*=/);
});
test('Phase24 both sword cast and damage phases route through the identical helper',()=>{
 const matches=game.match(/GAME_COMBAT_MATH\.bladeArcContains\(/g)||[];
 assert.equal(matches.length,2);
 assert.ok(game.includes('spec.isAwakened ? (spec.hasLongblade ? 680 : 560) : reach'));
 assert.ok(game.includes('P, e, reach, faceAng, spec.arc'));
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('game-combat-math.js')>=0);
 assert.ok(html.indexOf('game-combat-math.js')<html.indexOf('js/game.js'));
});
