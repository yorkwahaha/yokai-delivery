'use strict';
const {scriptUrl} = require('./helpers/script-url.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const baseline=fs.readFileSync('tests/fixtures/upgrade-choice-original-phase17.js','utf8');
const extracted=fs.readFileSync('js/game-upgrade-choices.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const env={window:{}};
vm.runInNewContext(baseline+'\nthis.originalAssemble=assemble;',env);
vm.runInNewContext(extracted,env);
const old=env.originalAssemble;
const choose=env.window.GAME_UPGRADE_CHOICES.assemble;

function rngShuffle(seed) {
 let v=seed>>>0;
 const calls=[];
 return {
  calls,
  shuffle(arr) {
   calls.push(arr.map(x=>x.id).join('|'));
   const result=[...arr];
   for(let i=result.length-1;i>0;i--) {
    v=(Math.imul(v,1664525)+1013904223)>>>0;
    const j=v%(i+1);
    [result[i],result[j]]=[result[j],result[i]];
   }
   return result;
  }
 };
}
const pool=(name,typ,n)=>Array.from({length:n},(_,i)=>({id:name+i,type:typ,lv:typ==='weapon'?i+1:undefined}));
const idlist=a=>a.map(x=>x.id);
test('Phase17 upgrade assembler is immutable and has no direct RNG or side effects',()=>{
 assert.ok(Object.isFrozen(env.window.GAME_UPGRADE_CHOICES));
 assert.equal(typeof choose,'function');
 assert.doesNotMatch(extracted,/Math\.random\s*\(|localStorage|document\.|buildRevision\+\+|choices\s*=/);
 assert.match(game,/GAME_UPGRADE_CHOICES\.assemble\(awakenCard, fc, wc, cc, dc, pc, mc, shuffle\)/);
});
test('Phase17 4374+ combinations preserve exact 3-card outputs, object identity, RNG callback order',()=>{
 let cases=0;
 for(const wake of [false,true])for(const f of [0,1,2])for(const w of [0,1,3])for(const c of [0,1,3])
 for(const d of [0,1,2])for(const p of [0,1,3])for(const m of [0,1,2]){
  const args=[wake?{id:'awake',type:'weapon',lv:5}:null,pool('fusion','fusion',f),
    pool('weapon','weapon',w),pool('charm','charm',c),pool('duo','duo',d),
    pool('passive','passive',p),pool('mutation','mutation',m)];
  const before=JSON.stringify(args);
  for(const seed of [1,42,117]){
   const r1=rngShuffle(seed),r2=rngShuffle(seed);
   const expected=old(...args,r1.shuffle);
   const actual=choose(...args,r2.shuffle);
   assert.equal(JSON.stringify(idlist(actual)),JSON.stringify(idlist(expected)),
    'choice card mismatch '+JSON.stringify({wake,f,w,c,d,p,m,seed}));
   assert.equal(JSON.stringify(r2.calls),JSON.stringify(r1.calls),'shuffle call order changed');
   for(const x of actual)assert.ok(args.slice(1).flat().includes(x)||args[0]===x,
    'choice was copied instead of preserving callback-bearing card object');
   cases++;
  }
  assert.equal(JSON.stringify(args),before,'candidate card pools changed');
 }
 assert.ok(cases>=4374,'insufficient parity coverage: '+cases);
});
test('Phase17 original priority leaves awakened and mutation cards eligible as before',()=>{
 for(const hasAwaken of [false,true]){
  const a=hasAwaken?{id:'awaken',type:'weapon',lv:5}:null;
  const pools=[a,pool('f','fusion',1),pool('w','weapon',4),pool('c','charm',2),
    pool('d','duo',2),pool('p','passive',3),pool('m','mutation',2)];
  const sf=rngShuffle(19);
  const output=choose(...pools,sf.shuffle);
  if(hasAwaken)assert.ok(output.includes(a));
  assert.ok(output.length<=3);
  assert.ok(output.filter(x=>x.type==='mutation').length<=2);
 }
});
test('Phase17 script loaded before game after other pure helpers',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const helper='js/game-upgrade-choices.js?v=20261103-upgrade-phase17';
 const main=scriptUrl('game');
 assert.ok(html.includes(helper)&&html.includes(main));
 assert.ok(html.indexOf(helper)<html.indexOf(main));
 assert.ok(html.indexOf('js/game-weather.js')<html.indexOf(helper));
});
