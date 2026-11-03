'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const original=fs.readFileSync('tests/fixtures/game-run-summary-original-phase18.js','utf8');
const moduleText=fs.readFileSync('js/game-run-summary.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
function setup(scenario) {
 const env={
  STORE:{data:{m:scenario.mastery}},
  learningStart:scenario.learningStart,
  recallIndependent:scenario.independent,
  recallAssisted:scenario.assisted,
  recallSources:scenario.sources,
  CFG:scenario.cfg,
  seals:scenario.seals,sealsEarned:scenario.sealsEarned,sealsSpent:scenario.sealsSpent,
  delivered:scenario.delivered,WL:scenario.wl,window:{}
 };
 vm.runInNewContext(original+'\nthis.oldLearning=learningSummary;this.oldAwakening=awakeningState;',env);
 vm.runInNewContext(moduleText,env);
 const lStart=game.indexOf('  function learningSummary() {');
 const lEnd=game.indexOf('\n  function noteSuccess(',lStart);
 const aStart=game.indexOf('  function awakeningState() {');
 const aEnd=game.indexOf('\n  function rememberWord(',aStart);
 assert.ok(lStart>0&&lEnd>lStart&&aStart>0&&aEnd>aStart);
 vm.runInNewContext(game.slice(lStart,lEnd)+game.slice(aStart,aEnd)+
  '\nthis.newLearning=learningSummary;this.newAwakening=awakeningState;',env);
 return env;
}
const cases=[];
for(const practiced of [0,1,2,5,20])for(const shift of [0,1,5]){
 const mastery={},learningStart={};
 for(let i=0;i<practiced;i++){
  const jp='word'+i;
  const m={ok:i%4+shift,ng:i%3,box:(i+shift)%6,missBoost:i%2?1:3};
  mastery[jp]=m;
  if((i+shift)%3!==0)learningStart[jp]={ok:m.ok-(i%2),ng:m.ng-(shift%2),box:i%5};
 }
 cases.push({mastery,learningStart,independent:practiced*2+shift,assisted:shift,
  sources:{delivery:{independent:practiced,assisted:shift},boss:{independent:shift,assisted:practiced}},
  cfg:{AWAKEN_EVERY:3,AWAKEN_MAX:4},seals:shift,sealsEarned:shift+practiced,
  sealsSpent:practiced,delivered:practiced,wl:{katana:1,fire:shift>=1?5:0,needle:shift>=5?5:2}});
}
test('Phase18 learning reports exactly match old formulas across mastery deltas and recall stats',()=>{
 for(const scenario of cases){
  const env=setup(scenario);
  assert.equal(JSON.stringify(env.newLearning()),JSON.stringify(env.oldLearning()),
    'learning summary mismatch: '+JSON.stringify({words:Object.keys(scenario.mastery).length,assisted:scenario.assisted}));
 }
});
test('Phase18 awakening snapshot exactly matches old values over skill counts and seal states',()=>{
 let count=0;
 for(const delivered of [0,1,2,3,4,5,6,10,20]){
  for(const per of [1,3,4,8]){
   for(const earned of [0,1,3,6]){
    const scenario={...cases[2],cfg:{AWAKEN_EVERY:per,AWAKEN_MAX:earned},
     delivered,seals:earned,sealsEarned:earned,sealsSpent:earned-1,
     wl:{katana:1,barrier:4,fire:5,boom:5,needle:0,thunder:earned%2?5:3}};
    const env=setup(scenario);
    assert.equal(JSON.stringify(env.newAwakening()),JSON.stringify(env.oldAwakening()));
    count++;
   }
  }
 }
 assert.ok(count>=140);
});
test('Phase18 reports do not mutate live save state and return independent nested result objects',()=>{
 const c=cases[6],before=JSON.stringify(c),env=setup(c);
 const a=env.newLearning();
 a.sources.delivery.independent=9999;
 const b=env.newLearning();
 assert.notEqual(b.sources.delivery.independent,9999);
 env.newAwakening();
 assert.equal(JSON.stringify(c),before);
 assert.ok(Object.isFrozen(env.window.GAME_RUN_SUMMARY));
 assert.doesNotMatch(moduleText,/localStorage|Math\.random\s*\(|STORE\.|buildRevision\+\+|document\./);
});
test('Phase18 scripts order and main wrappers preserve read-only live data ownership',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const mod='js/game-run-summary.js?v=20261103-summary-phase18';
 const main='js/game.js?v=20261103-thunder-phase25';
 assert.ok(html.includes(mod)&&html.includes(main));
 assert.ok(html.indexOf(mod)<html.indexOf(main));
 assert.match(game,/GAME_RUN_SUMMARY\.learningSummary\(\s*STORE\.data\.m, learningStart/);
 assert.match(game,/GAME_RUN_SUMMARY\.awakeningState\(\s*CFG, seals, sealsEarned/);
});
