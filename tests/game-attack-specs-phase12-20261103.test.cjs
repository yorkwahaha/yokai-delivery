'use strict';
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
test('Phase12 all 612 attack specifications are byte-for-byte equivalent to old game.js output',()=>{
 const api=load();assert.ok(Object.isFrozen(api));
 assert.equal(fixture.cases.length,612);
 for(const c of fixture.cases) {
  const deps=buildDeps(c);
  const {spec,options,...values}=deps;
  const actual=api.resolveAttackSpec(c.skillId,c.level==='default'?undefined:c.level,spec,options,values);
  assert.equal(hash(actual),c.hash,
    'attack spec differs: '+JSON.stringify({skill:c.skillId,level:c.level,variant:c.variant,evolution:c.evo}));
 }
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
 const script='js/game-attack-specs.js?v=20261103-attack-phase12',main='js/game.js?v=20261103-input-phase15';
 assert.ok(html.includes(script)&&html.includes(main));
 assert.ok(html.indexOf(script)<html.indexOf(main));
 assert.ok(html.includes('js/game-build-rules.js?v=20261103-build-phase11'));
});
