'use strict';
const {scriptUrl} = require('./helpers/script-url.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
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

test('rank-aware weapon offers taper at each new skill level, without hard-locking Lv5',()=>{
 const api=env.window.GAME_UPGRADE_CHOICES;
 const skills=['katana','fire','boom','barrier','thunder','needle'];
 const levels=Object.fromEntries(skills.map(k=>[k,0]));
 assert.ok(api.weaponOfferWeight('fire',levels,4)>api.weaponOfferWeight('katana',{...levels,katana:1},4));
 const weights=[];
 for(const rank of [1,2,3,4]){
   weights.push(api.weaponOfferWeight('katana',{...levels,katana:rank},4));
 }
 assert.deepEqual(weights,[1,.48,.21,.09],
   'Lv2→3 and Lv3→4 must become less common, not stay equally likely');
 const allMax={...levels,katana:5};
 assert.equal(api.weaponOfferWeight('katana',allMax,4),0);
 assert.ok(weights[3]>0,'the highest tier must remain obtainable by player choice');
 assert.equal(api.weaponOfferWeight('needle',{katana:1,fire:1,boom:1,barrier:1,needle:0},4),0,
   'fifth active skill remains locked at four slots');
});

test('when four skills are equipped, high-rank penalties vanish as other skills catch up',()=>{
 const api=env.window.GAME_UPGRADE_CHOICES;
 const scattered={katana:4,fire:1,boom:1,barrier:1};
 const close={katana:4,fire:3,boom:3,barrier:3};
 const equal={katana:4,fire:4,boom:4,barrier:4};
 const relative=s=>api.weaponOfferWeight('katana',s,4)/api.weaponOfferWeight('fire',s,4);
 assert.ok(relative(scattered)<relative(close));
 assert.equal(relative(equal),1);
 assert.ok(api.weaponOfferWeight('katana',scattered,4)>0);
 const only={katana:4,fire:5,boom:5,barrier:5};
 assert.deepEqual(Array.from(api.orderWeapons(['katana'],only,4,()=>.9)),['katana'],
   'last available upgrade must still be offered');
});

test('weighted offers are seeded, unique, rerollable, and favor other skills early',()=>{
 const api=env.window.GAME_UPGRADE_CHOICES;
 const keys=['katana','fire','boom','barrier','thunder','needle'];
 const rank1={katana:1,fire:0,boom:0,barrier:0,thunder:0,needle:0};
 const rank4={...rank1,katana:4};
 let r=0;
 const random=()=>{r=(Math.imul(1664525,r)+1013904223)>>>0;return r/4294967296;};
 const first=api.orderWeapons(keys,rank1,4,random);
 r=0;
 const replay=api.orderWeapons(keys,rank1,4,random);
 assert.deepEqual(Array.from(first),Array.from(replay),'same seed, same order');
 assert.equal(new Set(first).size,keys.length);
 assert.deepEqual([...first].sort(),[...keys].sort());
 // The assembler still takes only wc.slice(0,2), so measure that exact
 // two-card entry probability, not an irrelevant individual draw chance.
 const trials=16000;
 const share=levels=>{
   let hits=0;
   for(let i=0;i<trials;i++){
     const order=api.orderWeapons(keys,levels,4,random);
     if(order.slice(0,2).includes('katana'))hits++;
   }
   return hits/trials;
 };
 const early=share(rank1),late=share(rank4);
 assert.ok(early>late*4,{early,late});
 assert.ok(late>0 && early<.35,{early,late});
});
test('stage 2 real upgrade pool introduces Ink Trail without always forcing Katana',()=>{
 const candidates=[];
 for(let seed=1;seed<=14;seed++){
   const g=loadGame({stage:'rain-port',seed});
   g.store().finish('night-town',250,10,true);
   g.start('rain-port');
   const cards=g.eligibleChoices();
   assert.ok(cards.some(c=>c.id==='ink_trail'&&c.type==='weapon'),
     'the official first-clear skill introduction must remain guaranteed');
   assert.equal(new Set(cards.map(c=>c.choiceId)).size,cards.length);
   assert.ok(cards.length<=3);
   candidates.push(cards.map(c=>c.id));
 }
 assert.ok(candidates.some(cs=>!cs.includes('katana')),
   'after official unlock, a single Lv1 Katana cannot be an unconditional offer');
 assert.ok(candidates.some(cs=>cs.some(x=>['fire','boom','barrier','needle','thunder'].includes(x))),
   'other early active skills must actually reach the three-card UI');
});
test('Phase17 script loaded before game after other pure helpers',()=>{
 const html=fs.readFileSync('index.html','utf8');
   const helper=scriptUrl('game-upgrade-choices');
 const main=scriptUrl('game');
 assert.ok(html.includes(helper)&&html.includes(main));
 assert.ok(html.indexOf(helper)<html.indexOf(main));
 assert.ok(html.indexOf('js/game-weather.js')<html.indexOf(helper));
});

test('full builds reject a fully saturated next effect, while future ranks and open slots keep it available',()=>{
 const g=loadGame({seed:482});g.start();
 const rules=g.env.GAME_UPGRADE_CHOICES;
 let passivePool;
 g.env.GAME_UPGRADE_CHOICES={...rules,assemble(...groups){
  passivePool=groups[5];
  return rules.assemble(...groups);
 }};
 const draw=id=>{
  g.eligibleChoices();
  return passivePool.find(card=>card.id===id);
 };
 for(const id of ['katana','fire','boom','thunder']) g.setWeaponRank(id,4);
 const rate=draw('rate'),crit=draw('crit');
 assert.ok(rate&&crit);
 assert.equal(rate.f(),true);
 assert.equal(crit.f(),true);
 assert.equal(draw('crit').f(),true);
 assert.equal(draw('rate'),undefined,'katana is already at the cooldown floor');
 assert.equal(draw('crit'),undefined,'katana and thunder are already at 50%');
 g.setWeaponRank('boom',0);
 assert.ok(draw('rate')&&draw('crit'),'a future weapon can still benefit');
 g.setWeaponRank('barrier',4);
 assert.ok(draw('rate')&&draw('crit'),'barrier still benefits in a full build');
 g.setWeaponRank('barrier',0);
 g.setWeaponRank('needle',4);
 for(let i=0;i<2;i++) g.tune('rate').f();
 assert.ok(draw('rate'),'rank 4 is at its floor but rank 5 still benefits');
});
