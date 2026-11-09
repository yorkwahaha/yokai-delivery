'use strict';
const {scriptUrl} = require('./helpers/script-url.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const fixture=require('./fixtures/attack-spec-golden-phase12-20261103.json');
const source=fs.readFileSync('js/game-attack-specs.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');

const EVOLUTIONS={
 needleCount:l=>[3,5,7,8,8][Math.max(0,Math.min(4,l-1))],
 fireCount:l=>[1,2,3,3,3][Math.max(0,Math.min(4,l-1))],
 fireAttackCount:l=>[0,0,0,1,0][Math.max(0,Math.min(4,l-1))],
 fireAttackCooldown:l=>[2.5,2.2,1.9,1.55,1.05][Math.max(0,Math.min(4,l-1))],
 boomCount:l=>[1,2,3,4,2][Math.max(0,Math.min(4,l-1))]
};
const variants=[
 {name:'default',mutations:[],duos:[],spec:null,crit:2},
 {name:'all',mutations:fixture.mutations,duos:fixture.duos,
  spec:{mutations:fixture.mutations,duos:fixture.duos,passives:{crit:3},rate:.55,dmg:4.5,reach:1.3},crit:3},
 {name:'partial',mutations:fixture.mutations.filter((_,i)=>i%3===0),
  duos:fixture.duos.filter((_,i)=>i%2===0),
  spec:{mutations:fixture.mutations.filter((_,i)=>i%4===0),
   duos:fixture.duos.filter((_,i)=>i%3===0),passives:{crit:0},rate:0,dmg:1.0,reach:1},crit:1}
];
function buildDeps(row) {
 const variant=variants.find(x=>x.name===row.variant);
 assert.ok(variant,'missing test variant');
 return {
  WL:Object.fromEntries(fixture.skills.map((k,i)=>[k,(i%4)+1])),
  W:900,b:{crit:variant.crit},buildMutations:variant.mutations,buildDuos:variant.duos,
  getEffectiveRate:st=>st?.rate??0.25,
  getEffectiveDmg:st=>st?.dmg??1.35,
  getEffectiveReachMultiplier:st=>st?.reach??1.0,
  EVOLUTIONS:row.evo?EVOLUTIONS:undefined,
  spec:variant.spec,
  options:variant.name==='all'?{critLvl:4}:variant.name==='partial'?{critLvl:0}:{}
 };
}
function load() {
 const context={window:{}};vm.runInNewContext(source,context,{filename:'js/game-attack-specs.js'});
 return context.window.GAME_ATTACK_SPECS;
}
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('Phase12 612 historic attack specs remain stable apart from approved awakening and spread balance',()=>{
 const api=load();assert.ok(Object.isFrozen(api));
 assert.equal(fixture.cases.length,612);
 for(const c of fixture.cases) {
  const deps=buildDeps(c);
  const {spec,options,...values}=deps;
  const actual=api.resolveAttackSpec(c.skillId,c.level==='default'?undefined:c.level,spec,options,values);
  // Keep the frozen 2026-11-03 historical fixture. Reconstruct ONLY
  // the previous Lv5 barrier geometry/cooldown before the hash check.
  let comparison=actual;
  if(c.skillId==='barrier' && actual.level===5) {
   const oldRadius=Math.round(220*(actual.hasWide?1.22:1));
   comparison={...actual,cooldown:3.2,baseRadius:220,radius:oldRadius,
    pulseRadius:oldRadius,sanctuary:{duration:1.8,radius:oldRadius}};
  }
  if(c.skillId==='needle' && actual.level>=3) {
   comparison={...actual,spread:actual.level===5?1.35:actual.level===4?.65:.45};
  }
  if(c.skillId==='boom' && actual.level===5) {
   const oldRadius=Math.round(135*deps.getEffectiveReachMultiplier(spec));
   const oldSplashBase=Number((actual.baseDamage*deps.getEffectiveDmg(spec)*.20).toFixed(4));
   const oldSplash=actual.hasFan?(oldSplashBase*actual.baseCount*1.20)/actual.count:oldSplashBase;
   const oldSplitSplash=actual.hasSplitblast
    ? (actual.hasFan?oldSplash*.25:Number((oldSplash*.25).toFixed(4))):0;
   comparison={...actual,baseRadius:135,radius:oldRadius,splashScale:.20,
    splashDamage:oldSplash,splitblastRadius:actual.hasSplitblast?Math.round(oldRadius*.55):0,
    splitblastSplashDamage:oldSplitSplash};
  }
  assert.equal(hash(comparison),c.hash,
    'attack spec differs: '+JSON.stringify({skill:c.skillId,level:c.level,variant:c.variant,evolution:c.evo}));
 }
});

test('barrier awakening improves area, cadence, damage and retains Lv5 sanctuary across buffs',()=>{
 const api=load();
 for(const reach of [1,1.1,1.3])for(const rate of [0,0.25,0.55,1,3]){
  for(const mutations of [[],['mut_widecircle'],['mut_widecircle','mut_pulse']]){
   const deps={WL:{barrier:4},W:900,b:{crit:0},buildMutations:mutations,buildDuos:[],
    getEffectiveRate:()=>rate,getEffectiveDmg:()=>1.35,getEffectiveReachMultiplier:()=>reach};
   const lv4=api.resolveAttackSpec('barrier',4,null,{},deps);
   const lv5=api.resolveAttackSpec('barrier',5,null,{},deps);
   const label=JSON.stringify({reach,rate,mutations});
   assert.ok(lv5.radius>lv4.radius,'awakened radius must grow: '+label);
   assert.ok(lv5.cooldown<=lv4.cooldown,'awakened cooldown must not regress: '+label);
   assert.ok(lv5.damage>=lv4.damage,'awakened per-hit damage must not regress: '+label);
   assert.equal(lv5.baseRadius,Math.round(290*reach));
   assert.equal(lv5.radius,Math.round(lv5.baseRadius*(mutations.includes('mut_widecircle')?1.22:1)));
   assert.ok(Math.abs(lv5.cooldown-Math.max(1.2,1.5-rate*0.2))<1e-9);
   assert.equal(lv5.sanctuary.radius,lv5.radius,'sanctuary must cover the true attack area');
   assert.equal(lv5.sanctuary.duration,1.8);
   assert.equal(lv5.pulseRadius,lv5.radius,'extra pulse must cover the same area');
   assert.equal(lv5.pulseCount,mutations.includes('mut_pulse')?2:1);
  }
 }
 // Both the cast and the persistent sanctuary render using the combat radius.
 const skillfx=fs.readFileSync('js/skillfx.js','utf8');
 assert.match(game,/SKILLFX\.play\("barrier", "cast", spec\.level, \{ x: P\.x, y: P\.y, r \}\)/);
 assert.match(game,/r: spec\.sanctuary\.radius/);
 assert.match(skillfx,/const size = p\.r\*2\.18\*tier\.scale/);
});
test('Phase12 main game wrapper passes live dependencies without changing original caller signature',()=>{
 const first=game.indexOf('  function resolveAttackSpec(');
 const last=game.indexOf('\n  const WI =',first);
 assert.ok(first>0&&last>first);
 const ctx={window:{GAME_ATTACK_SPECS:load()},WL:Object.fromEntries(fixture.skills.map((k,i)=>[k,(i%4)+1])),
  W:900,b:{crit:2},buildMutations:[],buildDuos:[],
  getEffectiveRate:st=>st?.rate??0.25,
  getEffectiveDmg:st=>st?.dmg??1.35,
  getEffectiveReachMultiplier:st=>st?.reach??1.0};
 vm.runInNewContext(game.slice(first,last)+'\nthis.spec=resolveAttackSpec;',ctx);
 const c=fixture.cases.find(v=>!v.evo&&v.variant==='default'&&v.skillId==='katana'&&v.level===3);
 assert.ok(c);
 assert.equal(hash(ctx.spec('katana',3,null,{})),c.hash);
 assert.equal(game.slice(first,last).split('\n').length<18,true,'only a thin main-game wrapper remains');
});
test('Phase12 resolver does not call RNG or mutate game world',()=>{
 assert.doesNotMatch(source,/Math\.random\s*\(|enemies\.push\s*\(|localStorage|document\.|buildRevision\+\+/);
 assert.equal(typeof load().resolveAttackSpec,'function');
});
test('Phase12 HTML loads attack module before game and preserves prior dependency cache keys',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const script='js/game-attack-specs.js?v=20261109-ofuda-range-r3',main=scriptUrl('game');
 assert.ok(html.includes(script)&&html.includes(main));
 assert.ok(html.indexOf(script)<html.indexOf(main));
 assert.ok(html.includes('js/game-build-rules.js?v=20261109-seal-free-lv5-r1'));
});
