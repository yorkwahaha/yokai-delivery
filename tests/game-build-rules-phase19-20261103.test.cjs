'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const before=fs.readFileSync('tests/fixtures/game-offer-rules-original-phase19.js','utf8');
const moduleText=fs.readFileSync('js/game-build-rules.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');
const env={window:{}};
vm.runInNewContext(before+'\nthis.originalWeapon=oldWeaponOfferKeys;this.originalDuo=oldDuoOfferKeys;',env);
vm.runInNewContext(moduleText,env);
const rules=env.window.GAME_BUILD_RULES;
function setup(seed) {
 let n=seed>>>0;
 return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
}
function weapons() {
 return Object.fromEntries(['katana','barrier','fire','boom','thunder','needle',
 'fusion_inkblade','fusion_foxiai','fusion_exorcistblade','fusion_foxfirebarrier',
 'fusion_exorcistseal','fusion_thundercircle','fusion_slashwheel',
 'fusion_foxthunderlantern','fusion_flamefestival','fusion_thundertalisman']
 .map(id=>[id,{id}]));
}
test('Phase19 weapon eligibility keeps exact order and fusion callbacks across 1500+ configurations',()=>{
 const inventory=weapons(),keys=Object.keys(inventory);
 let compared=0;
 for(const cap of [0,1,4,6])for(const seals of [-1,0,1,3])for(const noFusion of [false,true]){
  for(let seed=0;seed<75;seed++) {
   const rand=setup(seed+cap*101+seals*9);
   const levels=Object.fromEntries(keys.map(k=>[k,Math.floor(rand()*6)]));
   const consumed=new Set(keys.filter(()=>rand()<.28));
   const logs=[[],[]];
   const hosts=logs.map(log=>noFusion?{}:{FUSION:{isSkillConsumed(id){log.push(id);return consumed.has(id);}}});
   const prev=env.originalWeapon(inventory,levels,cap,seals,hosts[0]);
   const next=rules.weaponOfferKeys(inventory,levels,cap,seals,hosts[1]);
   assert.equal(JSON.stringify(next),JSON.stringify(prev),
    JSON.stringify({cap,seals,noFusion,seed}));
   assert.equal(JSON.stringify(logs[1]),JSON.stringify(logs[0]),'fusion callback order changed');
   compared++;
  }
 }
 assert.ok(compared>=1500);
});
test('Phase19 legacy Duo pool remains gated by inPool and parent Lv3 with no state mutation',()=>{
 const duo={
  off:{id:'off',inPool:false,skillIds:['katana','fire']},
  on:{id:'on',inPool:true,skillIds:['katana','fire']},
  half:{id:'half',inPool:true,skillIds:['barrier','thunder']},
  empty:{id:'empty',inPool:true,skillIds:[]}
 };
 let compared=0;
 for(let i=0;i<1024;i++) {
  const owned=['on','half','off'].filter((_,j)=>(i&(1<<j))!==0);
  const levels={katana:i%5,fire:Math.floor(i/5)%5,barrier:Math.floor(i/25)%5,
   thunder:Math.floor(i/125)%5};
  const old=env.originalDuo(duo,owned,levels);
  const next=rules.duoOfferKeys(duo,owned,levels);
  assert.equal(JSON.stringify(next),JSON.stringify(old));
  compared++;
 }
 assert.ok(compared>=1000);
});
test('Phase19 excludes fusion weapons from ordinary level up and preserves original data ownership',()=>{
 const list=rules.weaponOfferKeys(weapons(),{katana:4,fire:0,barrier:0,boom:0,thunder:0,needle:0},4,2,{});
 assert.ok(!list.eligibleWeaponKeys.some(id=>id.startsWith('fusion_')));
 assert.ok(!list.awakenKeys.some(id=>id.startsWith('fusion_')));
 assert.ok(list.awakenKeys.includes('katana'));
 assert.ok(Object.isFrozen(rules));
 assert.doesNotMatch(moduleText,/Math\.random\s*\(|buildRevision\+\+|localStorage/);
 assert.match(game,/GAME_BUILD_RULES\.weaponOfferKeys\(\s*WI, WL, MAX_ACTIVE_WEAPONS, seals, window/);
 assert.match(game,/GAME_BUILD_RULES\.duoOfferKeys\(DUO_CONFIG, buildDuos, WL\)/);
});
test('Phase19 HTML keeps shared build rules before game with matching revisions',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const helper='js/game-build-rules.js?v=20261103-build-phase19';
 const main='js/game.js?v=20261103-blade-phase24';
 assert.ok(html.includes(helper)&&html.includes(main));
 assert.ok(html.indexOf(helper)<html.indexOf(main));
 assert.ok(html.includes('js/game-run-summary.js?v=20261103-summary-phase18'));
});
