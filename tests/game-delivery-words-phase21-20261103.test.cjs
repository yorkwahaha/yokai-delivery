'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const original=fs.readFileSync('tests/fixtures/game-delivery-words-original-phase21.js','utf8');
const moduleText=fs.readFileSync('js/game-delivery-rules.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const env={window:{}};
vm.runInNewContext(original+
 '\nthis.old={oldExcludedWordSets,oldPriorityMissedWords,oldFallbackWordPool};',env);
vm.runInNewContext(moduleText,env);
const old=env.old,api=env.window.GAME_DELIVERY_RULES;
function prng(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function ids(set){return Array.from(set);}
const words=Array.from({length:12},(_,i)=>({jp:'word-'+i,id:i}));
test('Phase21 exclusion sets match original for live/dead misdelivery mobs and orders',()=>{
 for(let seed=0;seed<400;seed++){
  const rand=prng(seed),enemies=words.map((w,i)=>({
   hp:rand()<.25?0:2,type:rand()<.5?'mis':'ghost',w:rand()<.05?null:w}));
  const orders=words.filter(()=>rand()<.3).map(w=>({word:w}));
  const job=rand()<.5?{word:words[Math.floor(rand()*words.length)]}:null;
  const frozen=JSON.stringify([enemies,orders,job]);
  const prev=old.oldExcludedWordSets(enemies,orders,job);
  const actual=api.excludedWordSets(enemies,orders,job);
  assert.equal(JSON.stringify(ids(actual.livingMisWords)),JSON.stringify(ids(prev.livingMisWords)));
  assert.equal(JSON.stringify(ids(actual.activeOrderWords)),JSON.stringify(ids(prev.activeOrderWords)));
  assert.equal(JSON.stringify([enemies,orders,job]),frozen);
 }
});
test('Phase21 fallback selection keeps exact ordering and returns original ALL identity when exhausted',()=>{
 for(let seed=0;seed<1200;seed++){
  const rand=prng(seed+81);
  const living=new Set(words.filter(()=>rand()<.35).map(w=>w.jp));
  const active=new Set(words.filter(()=>rand()<.35).map(w=>w.jp));
  const pool=words.filter(()=>rand()<.8);
  const prev=old.oldFallbackWordPool(pool,living,active);
  const actual=api.fallbackWordPool(pool,living,active);
  assert.equal(JSON.stringify(actual.map(w=>w.id)),JSON.stringify(prev.map(w=>w.id)),
   JSON.stringify({seed}));
  if(prev===pool)assert.equal(actual,pool,'original ALL identity must survive total exclusion');
  for(const word of actual)assert.ok(pool.includes(word),'word objects must remain unchanged');
 }
 const living=new Set(words.map(w=>w.jp));
 assert.equal(api.fallbackWordPool(words,living,living),words);
});
test('Phase21 priority missed pool preserves STORE.get callback count and word ordering',()=>{
 for(let seed=0;seed<300;seed++){
  const rand=prng(seed+1150);
  const living=new Set(words.filter(()=>rand()<.32).map(w=>w.jp));
  const active=new Set(words.filter(()=>rand()<.32).map(w=>w.jp));
  const boosts=Object.fromEntries(words.map(w=>[w.jp,rand()<.5?1:1+Math.floor(rand()*3)]));
  const before=[],after=[];
  const STORE={get(jp){before.push(jp);return {missBoost:boosts[jp]};}};
  const prev=old.oldPriorityMissedWords(words,STORE,living,active);
  const actual=api.priorityMissedWords(words,jp=>{
   after.push(jp);return {missBoost:boosts[jp]};
  },living,active);
  assert.equal(JSON.stringify(actual.map(w=>w.id)),JSON.stringify(prev.map(w=>w.id)));
  assert.equal(JSON.stringify(after),JSON.stringify(before),'Store lookup callback order must not change');
 }
});
test('Phase21 delivery rules stay side-effect free and are loaded before game',()=>{
 assert.ok(Object.isFrozen(api));
 assert.doesNotMatch(moduleText,/Math\.random\s*\(|localStorage|STORE\.get\s*\(|orders\.push\s*\(/);
 assert.match(game,/GAME_DELIVERY_RULES\.excludedWordSets\(enemies, orders, job\)/);
 assert.match(game,/GAME_DELIVERY_RULES\.priorityMissedWords\(\s*ALL, jp => STORE\.get\(jp\)/);
 assert.match(game,/GAME_DELIVERY_RULES\.fallbackWordPool\(\s*ALL, livingMisWords, activeOrderWords/);
 const html=fs.readFileSync('index.html','utf8');
 const helper='js/game-delivery-rules.js?v=20261103-delivery-phase21';
 const main='js/game.js?v=20261103-p1-hotfix-c';
 assert.ok(html.includes(helper)&&html.includes(main));
 assert.ok(html.indexOf(helper)<html.indexOf(main));
});
