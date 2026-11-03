'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const original=fs.readFileSync('tests/fixtures/game-tutorial-original-phase20.js','utf8');
const moduleText=fs.readFileSync('js/game-tutorial-rules.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const start=game.indexOf('  const tutorialIds = ');
const end=game.indexOf('  function showTutorial(',start);
assert.ok(start>=0&&end>start);
const mainSnippet=game.slice(start,end);
const scenarios=[
 null,'null','"skip"','[]','["pickup"]','["delivery","boss","dash"]',
 '["night-town:delivery","rain-port:boss"]','["unknown","pickup","boss"]',
 '[invalid JSON','true','{"a":1}','["boss","night-town:boss"]',
 '["delivery","night-town:delivery","rain-port:delivery","rain-port:delivery"]',
 '["night-town:pickup","night-town:boss","rain-port:boss","secret:boss"]',
 '"","skip",""'
];
function createContext(saved,stages,activeStage) {
 const reads=[],writes=[];
 const env={touch:false,STAGE:{id:activeStage},CONTENT:{STAGES:stages},reads,writes};
 env.window=env;
 env.localStorage={
  getItem(k){reads.push(k);return saved;},
  setItem(...args){writes.push(args);}
 };
 return env;
}
function oldState(saved,stages,activeStage) {
 const env=createContext(saved,stages,activeStage);
 vm.runInNewContext(original,env);
 return {data:env.tutorialSnapshot(),reads:env.reads,writes:env.writes};
}
function newState(saved,stages,activeStage) {
 const env=createContext(saved,stages,activeStage);
 vm.runInNewContext(moduleText,env);
 vm.runInNewContext(mainSnippet+'\nthis.tutorialSnapshot=()=>({ids:[...tutorialIds],keys:[...tutorialKeys],seen:[...tutorialSeen],skipped:tutorialSkipped});',env);
 return {data:env.tutorialSnapshot(),reads:env.reads,writes:env.writes};
}
test('Phase20 tutorial first-run/legacy save behavior matches original across stages and malformed storage',()=>{
 for(const stages of [
  {'night-town':{},'rain-port':{},'stage3':{}},
  {'night-town':{}},
  {'rain-port':{}},
  {}
 ]){
  for(const stage of ['night-town','rain-port','stage3']){
   for(const saved of scenarios){
    const prev=oldState(saved,stages,stage);
    const now=newState(saved,stages,stage);
    assert.equal(JSON.stringify(now),JSON.stringify(prev),
     JSON.stringify({saved,stage,stages:Object.keys(stages)}));
   }
  }
 }
});
test('Phase20 migration preserves valid keys, duplicate collapsing and night-town legacy mapping',()=>{
 const stages={'night-town':{},'rain-port':{}};
 const result=newState('["pickup","pickup","delivery","boss","rain-port:boss","garbage"]',stages,'rain-port');
 assert.equal(JSON.stringify(result.data.seen),JSON.stringify([
  'pickup','night-town:delivery','night-town:boss','rain-port:boss']));
 assert.equal(result.data.skipped,false);
 assert.equal(newState('"skip"',stages,'rain-port').data.skipped,true);
 assert.equal(newState('"skip"',stages,'rain-port').data.seen.length,0);
});
test('Phase20 pure module has no localStorage, write actions or external state mutations',()=>{
 const env={window:{}};vm.runInNewContext(moduleText,env);
 const api=env.window.GAME_TUTORIAL_RULES;
 assert.ok(Object.isFrozen(api));
 assert.equal(typeof api.tutorialKey,'function');
 assert.equal(typeof api.acceptedKeys,'function');
 assert.equal(typeof api.seenFromSaved,'function');
 assert.doesNotMatch(moduleText,/localStorage|Math\.random\s*\(|document\.|tutorialSeen\.add/);
 assert.match(mainSnippet,/localStorage\.getItem\('yokai-tutorial-v1'\)/);
});
test('Phase20 tutorial helper loads before game at new HTML revision',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const helper='js/game-tutorial-rules.js?v=20261103-tutorial-phase20';
 const gameScript='js/game.js?v=20261103-p1-hotfix-c';
 assert.ok(html.includes(helper)&&html.includes(gameScript));
 assert.ok(html.indexOf(helper)<html.indexOf(gameScript));
 assert.ok(html.includes('js/game-build-rules.js?v=20261103-build-phase19'));
});
