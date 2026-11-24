'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame} = require('./helpers/game-runtime.cjs');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const env = {window:{}};
vm.runInNewContext(readFileSync('js/game-upgrade-choices.js','utf8'),env);
const api = env.window.GAME_UPGRADE_CHOICES;
const official = {hostname:'example.com',search:'?dev=1&s3play=1&stageLab=1'};
const lan = {hostname:'192.168.50.107',search:'?dev=1&s3play=1&perf=1'};
function boot(location, clear, seed=1) {
  const g = loadGame({location,seed});
  if(clear) {
    g.store().finish('night-town',100,6,true);
    g.store().markSkillExperienced('ink_trail');
  }
  g.startRun('rain-port');
  g.stopSpawns();
  g.setWeaponRank('fire',1);
  g.setWeaponRank('needle',1);
  return g;
}
const hasInk = g => g.currentChoices().some(c=>c.id==='ink_trail');
function decline(g) {
  const i = g.currentChoices().findIndex(c=>c.type!=='weapon'||['katana','fire','needle'].includes(c.id));
  assert.ok(i>=0,'controlled three-slot build must have another choice');
  assert.equal(g.takeLevelUpChoice(i).ok,true);
}
test('public URL cannot unlock ink; DEV LAN temporarily offers ink without granting clears',()=>{
  const locked = boot(official,false);
  for(let i=0;i<24;i++){
    assert.equal(locked.forceLevelUp(),'levelup');
    assert.equal(hasInk(locked),false);
    decline(locked);
  }
  const dev = boot(lan,false);
  let seen = false;
  for(let i=0;i<5;i++){
    assert.equal(dev.forceLevelUp(),'levelup');
    if(hasInk(dev)){
      assert.equal(dev.takeLevelUpChoice(dev.currentChoices().findIndex(c=>c.id==='ink_trail')).ok,true);
      seen = true;
      break;
    }
    decline(dev);
  }
  assert.ok(seen);
  assert.equal(dev.weaponLevels().ink_trail,1);
  assert.equal(dev.store().isStageCompleted('night-town'),false);
  assert.equal(dev.store().isActiveSkillUnlocked('ink_trail'),false);
  assert.equal(dev.env.localStorage.getItem('yokai-delivery-v1'),null);
  assert.equal(dev.env.localStorage.getItem('yokai-delivery-v1:skill-introductions-v1'),null);
  dev.startRun('night-town');
  assert.equal(dev.forceLevelUp(),'levelup');
  assert.equal(hasInk(dev),false);
});
test('real normal offers reset after declining; filled slots never offer unowned reward',()=>{
  const g = boot(official,true);
  assert.equal(g.store().isActiveSkillUnlocked('ink_trail'),true);
  let misses=0, first=null, longest=0;
  for(let i=0;i<24;i++){
    assert.equal(g.forceLevelUp(),'levelup');
    if(hasInk(g)){if(first===null)first=i+2;misses=0;}
    else longest=Math.max(longest,++misses);
    assert.ok(misses<5);
    decline(g);
  }
  console.log('real seeded retained slot:',JSON.stringify({first,longest}));
  g.setWeaponRank('boom',1);
  for(let i=0;i<4;i++){
    assert.equal(g.forceLevelUp(),'levelup');
    assert.equal(hasInk(g),false);
    assert.equal(g.takeLevelUpChoice(0).ok,true);
  }
});
const card=(id,type='weapon')=>({id,type,choiceId:type+':'+id,lv:1});
test('real reroll is not a normal upgrade and does not advance misses',()=>{
  const g=boot(official,true);
  const rules=g.env.GAME_UPGRADE_CHOICES, observations=[];
  g.env.GAME_UPGRADE_CHOICES={...rules,recordNewSkillVisibility(misses,candidates,offered,normal){
    const before={...misses};
    rules.recordNewSkillVisibility(misses,candidates,offered,normal);
    observations.push({normal,before,after:{...misses}});
  }};
  assert.equal(g.forceLevelUp(),'levelup');
  g.waitLevelUpCooldown();
  g.rerollUpgradeForTest();
  assert.deepEqual(observations.map(x=>x.normal),[true,false]);
  const reroll=observations[1];
  for(const id of Object.keys(reroll.after))
    assert.ok(reroll.after[id]<=(reroll.before[id]||0));
  decline(g);
  assert.equal(g.forceLevelUp(),'levelup');
  assert.equal(observations.at(-1).normal,true);
});
test('oldest misses rotate; rerolls do not advance; protected pair, charm and introductions survive',()=>{
  const candidates=['ink_trail','seal_nail','shikigami'].map(id=>card(id));
  const m=[card('one','mutation'),card('two','mutation')], p=card('passive','passive');
  const base=[...m,p], misses={};
  const seen=[];
  for(let i=0;i<8;i++){
    const out=api.withNewSkillVisibility(base,candidates,misses,true);
    assert.equal(out.length,3);
    assert.ok(m.every(x=>out.includes(x)));
    if(out[2]!==p)seen.push(out[2].id);
    api.recordNewSkillVisibility(misses,candidates,out,true);
    const before={...misses};
    assert.equal(api.withNewSkillVisibility(base,candidates,misses,false),base);
    api.recordNewSkillVisibility(misses,candidates,base,false);
    assert.deepEqual(misses,before);
  }
  assert.deepEqual(seen.slice(0,3),['ink_trail','seal_nail','shikigami']);
  const charm=card('charm','charm'), protectedOffer=[...m,charm];
  assert.equal(api.withNewSkillVisibility(protectedOffer,candidates,{ink_trail:8},true)[2],charm);
  assert.equal(api.withNewSkillVisibility(base,candidates,{ink_trail:8},true,[p])[2],p);
  api.recordNewSkillVisibility(misses,candidates,[candidates[0]],false);
  assert.equal(misses.ink_trail,0);
  api.recordNewSkillVisibility(misses,[],[],true);
  assert.deepEqual(misses,{});
});
test('10,000 seeded retained-slot sequences: baseline vs visibility guarantee',()=>{
  const skills=['katana','fire','needle','boom','barrier','thunder','ink_trail'];
  const levels={katana:3,fire:2,needle:2,boom:0,barrier:0,thunder:0,ink_trail:0};
  const report={};
  for(const fixed of [false,true]){
    let firstSum=0,firstMax=0,longest=0,absent24=0;
    for(let seed=1;seed<=10000;seed++){
      let s=seed,first=0,miss=0;const misses={};
      const random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
      const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
      const pc=['a','b','c','d'].map(x=>card(x,'passive'));
      for(let n=1;n<=24;n++){
        const wc=api.orderWeapons(skills,levels,4,random).map(id=>card(id));
        const target=wc.filter(c=>c.id==='ink_trail');
        let out=api.assemble(null,[],wc,[],[],pc,[],shuffle);
        if(fixed)out=api.withNewSkillVisibility(out,target,misses,true);
        api.recordNewSkillVisibility(misses,target,out,true);
        if(out.some(c=>c.id==='ink_trail')){if(!first)first=n+1;miss=0;}else longest=Math.max(longest,++miss);
      }
      if(!first)absent24++;else{firstSum+=first;firstMax=Math.max(firstMax,first);}
    }
    report[fixed?'fixed':'baseline']={firstMean:firstSum/(10000-absent24),firstMax,longest,absent24};
  }
  console.log('seeded visibility:',JSON.stringify(report));
  assert.equal(report.fixed.absent24,0);
  assert.ok(report.fixed.longest<=4);
  assert.ok(report.fixed.firstMax<=6);
});
