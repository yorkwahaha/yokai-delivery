'use strict';
const {scriptUrl} = require('./helpers/script-url.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const moduleText=fs.readFileSync('js/game-build-rules.js','utf8');
const gameText=fs.readFileSync('js/game.js','utf8');
const cfg={
 a:{skillId:'katana',family:'slash',inPool:true},
 b:{skillId:'katana',family:'slash',inPool:true},
 c:{skillId:'katana',family:'ward',inPool:true},
 d:{skillId:'fire',family:'ward',inPool:true},
 e:{skillId:'fire',inPool:true},
 f:{skillId:'fire',inPool:false},
 g:{skillId:'boom',family:'spark',inPool:true}
};
function oldGetSkill(skillId,list,c){
 if(!Array.isArray(list))return [];
 return list.filter(id=>{const item=c[id];return !!item&&item.skillId===skillId});
}
function oldFamily(id,list,c){
 const family=c[id]?.family;
 return !!family&&list.some(other=>c[other]?.family===family);
}
function oldCanAdd(id,list,c,skills,slots){
 const item=c[id];
 if(!item?.inPool||!Array.isArray(list)||list.includes(id))return false;
 if(oldFamily(id,list,c))return false;
 return (skills[item.skillId]||0)>0&&oldGetSkill(item.skillId,list,c).length<slots;
}
function load(){
 const env={window:{},MUTATION_CONFIG:cfg,WL:{katana:2,fire:1,boom:0},MUTATION_SLOTS_PER_SKILL:2,
   buildMutations:['a']};
 vm.runInNewContext(moduleText,env);
 const start=gameText.indexOf('  function getSkillMutations(');
 const end=gameText.indexOf('\n  function addMutation(',start);
 assert.ok(start>=0&&end>start);
 vm.runInNewContext(gameText.slice(start,end) +
   '\nthis.calls={getSkillMutations,isMutationFamilyTaken,canAddMutation};',env);
 return env;
}
test('Phase8 module exports only pure frozen rules; wrappers retain default live build',()=>{
 const env=load(),api=env.window.GAME_BUILD_RULES;
 assert.ok(Object.isFrozen(api));
 for(const k of ['getSkillMutations','isMutationFamilyTaken','canAddMutation'])assert.equal(typeof api[k],'function');
 assert.deepEqual(Array.from(env.calls.getSkillMutations('katana')),['a']);
 assert.equal(env.calls.isMutationFamilyTaken('b'),true);
 assert.equal(env.calls.canAddMutation('b'),false);
 assert.doesNotMatch(moduleText,/Math\.random|localStorage|document\.|buildMutations\.push|buildRevision\+\+/);
});
test('Phase8 pure rule outcomes match original implementation for all configs and combinations',()=>{
 const api=load().window.GAME_BUILD_RULES;
 const ids=['a','b','c','d','e','f','g','unknown'];
 const lists=[null,{},undefined,[],['a'],['a','c'],['c','d'],['d'],['a','b'],['unknown'],
  ['a','c','g'],['a','a'],['f'],['b','e']];
 const skills=[{katana:0,fire:0,boom:0},{katana:1,fire:0,boom:0},{katana:1,fire:1,boom:0},
  {katana:5,fire:2,boom:1}];
 for(const list of lists)for(const id of ids)for(const skillLevels of skills)for(const slots of [1,2,3]){
  const pre=JSON.stringify(list);
  const oldSkill=oldGetSkill(id,list,cfg);
  assert.equal(JSON.stringify(api.getSkillMutations(id,list,cfg)),JSON.stringify(oldSkill));
  if(Array.isArray(list)||!cfg[id]?.family){
   assert.equal(api.isMutationFamilyTaken(id,list,cfg),oldFamily(id,list,cfg));
  }
  assert.equal(api.canAddMutation(id,list,cfg,skillLevels,slots),
   oldCanAdd(id,list,cfg,skillLevels,slots),
   JSON.stringify({list,id,skillLevels,slots}));
  assert.equal(JSON.stringify(list),pre,'must not mutate list');
 }
});
test('Phase8 world-game wrapper accepts explicit list without changing input',()=>{
 const env=load(),c=env.calls;
 const offered=['c'];
 assert.equal(c.canAddMutation('a',offered),true);
 assert.equal(c.canAddMutation('d',offered),false);
 assert.equal(c.canAddMutation('g',offered),false);
 assert.equal(JSON.stringify(c.getSkillMutations('katana',offered)),JSON.stringify(['c']));
 assert.deepEqual(Array.from(offered),['c']);
});
test('Phase8 browser loads build predicates before game and keeps existing module versions',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const script='js/game-build-rules.js?v=20261103-build-phase19',main=scriptUrl('game');
 assert.ok(html.includes(script)&&html.includes(main));
 assert.ok(html.indexOf(script)<html.indexOf(main));
 assert.ok(html.includes('js/game-spawn-math.js?v=20261103-spawn-phase9'));
});
