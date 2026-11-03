'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const moduleText=fs.readFileSync('js/game-build-rules.js','utf8');
const gameText=fs.readFileSync('js/game.js','utf8');

function previous(weapons,levels,charms,mutations,duos,charmLevel){
 const activeSkills=Object.keys(weapons).filter(k=>(levels[k]||0)>0);
 return {schemaVersion:1,activeSkills,WL:{...levels},ownedActiveCount:activeSkills.length,
  charms:[...charms],charmLevels:Object.fromEntries(charms.map(id=>[id,charmLevel(id)])),
  mutations:[...mutations],duos:[...duos]};
}
function prepare(weapons,levels,charms,mutations,duos,charmLevel) {
 const env={window:{},WI:weapons,WL:levels,buildCharms:charms,buildMutations:mutations,buildDuos:duos,charmLevelOf:charmLevel};
 vm.runInNewContext(moduleText,env);
 const start=gameText.indexOf('  function getBuildState() {');
 const end=gameText.indexOf('\n  function resolveAttackSpec(',start);
 assert.ok(start>=0&&end>start);
 vm.runInNewContext(gameText.slice(start,end)+'\nthis.getBuildState=getBuildState;',env);
 return env;
}
test('Phase11 fresh snapshot exactly matches original schema and callback order',()=>{
 const weapons={katana:{},fire:{},needle:{},boom:{},thunder:{},barrier:{}};
 for(const n of [0,1,3]){
  const levels={katana:1,fire:n,needle:0,boom:-1,thunder:undefined,barrier:n?3:0};
  for(const charms of [[],['charm_power'],['charm_step','charm_power'],['charm_power','charm_power']]){
   const mutations=['mut_a','mut_b'],duos=['duo_a'];
   const before=[],after=[];
   const old=previous(weapons,levels,charms,mutations,duos,id=>{before.push(id);return id.length%3+1});
   const state=prepare(weapons,levels,charms,mutations,duos,id=>{after.push(id);return id.length%3+1}).getBuildState();
   assert.equal(JSON.stringify(state),JSON.stringify(old));
   assert.equal(JSON.stringify(after),JSON.stringify(before),'charm level call sequence changed');
   assert.equal(state.schemaVersion,1);
   assert.equal(state.ownedActiveCount,state.activeSkills.length);
  }
 }
});
test('Phase11 return arrays and level maps are fresh, no reference leak into live arrays',()=>{
 const weapons={katana:{},fire:{}},levels={katana:3,fire:1},charms=['power'],mutations=['a'],duos=['x'];
 const env=prepare(weapons,levels,charms,mutations,duos,()=>1);
 const state=env.getBuildState();
 state.activeSkills.push('new');state.WL.katana=9;state.charms.push('other');
 state.charmLevels.power=5;state.mutations.push('b');state.duos.push('y');
 assert.deepEqual(charms,['power']);assert.deepEqual(mutations,['a']);assert.deepEqual(duos,['x']);
 assert.deepEqual(levels,{katana:3,fire:1});
 const fresh=env.getBuildState();
 assert.equal(fresh.WL.katana,3);
 assert.equal(JSON.stringify(fresh.charms),JSON.stringify(['power']));
 assert.equal(JSON.stringify(fresh.mutations),JSON.stringify(['a']));
 assert.equal(JSON.stringify(fresh.duos),JSON.stringify(['x']));
});
test('Phase11 pure build module has no storage/weapon mutation code',()=>{
 const env=prepare({},{},[],[],[],()=>0);
 assert.ok(Object.isFrozen(env.window.GAME_BUILD_RULES));
 assert.equal(typeof env.window.GAME_BUILD_RULES.createBuildState,'function');
 assert.doesNotMatch(moduleText,/Math\.random\s*\(|localStorage|document\.|buildRevision\+\+|buildCharms\.push/);
 assert.match(gameText,/GAME_BUILD_RULES\.createBuildState\(\s*WI, WL, buildCharms, buildMutations, buildDuos, charmLevelOf/);
});
test('Phase11 script revisions load build module before game, preserve other module versions',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const build='js/game-build-rules.js?v=20261103-build-phase19',game='js/game.js?v=20261103-cinder-phase28';
 assert.ok(html.includes(build)&&html.includes(game));
 assert.ok(html.indexOf(build)<html.indexOf(game));
 assert.ok(html.includes('js/game-delivery-rules.js?v=20261103-delivery-phase21'));
});
