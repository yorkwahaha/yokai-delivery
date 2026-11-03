'use strict';
// Recover still-valid gameplay assertions from mixed historical test files.
const test=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('Phase38: all nine passives obey approved 2/3/4 stack caps',()=>{
  const g=loadGame({seed:481});g.start();
  const caps={shield:3,oil_max:2,oil_heal:3,dmg:4,rate:4,crit:3,spd:3,dash:3,mag:3};
  for(const [id,cap] of Object.entries(caps)){
    const u=g.tune(id);assert.ok(u,id);
    for(let i=0;i<cap;i++){assert.equal(u.ok(),true,id+' below cap');u.f();}
    assert.equal(u.ok(),false,id+' above cap');
  }
});

test('Phase38: stale MAX card fails eligibility and cannot be offered',()=>{
  const g=loadGame({seed:482});g.start();const u=g.tune('dmg');
  for(let i=0;i<3;i++)u.f();
  let card;
  for(let i=0;i<200&&!card;i++)card=g.eligibleChoices().find(c=>c.type==='passive'&&c.id==='dmg');
  assert.ok(card,'partial stack remains eligible');
  assert.equal(card.currentStacks,3);assert.equal(card.maxStacks,4);
  assert.match(card.d,/目前 3 \/ 4 層/);
  u.f();
  assert.equal(card.ok(),false,'previously offered card must expire');
  assert.equal(g.eligibleChoices().some(c=>c.type==='passive'&&c.id==='dmg'),false);
});

for(const expected of [
  {profile:'normal',spent:146,level:5,xp:10,need:53,thresholds:[27,33,40,46]},
  {profile:'hard',spent:111,level:4,xp:45,need:51,thresholds:[30,37,44]}
]){
  test('Phase38: '+expected.profile+' six real deliveries conserve 156 XP across actual upgrades',()=>{
    const g=loadGame({seed:11});
    if(expected.profile==='hard'){
      const getStage=g.env.CONTENT.getStage;
      g.env.CONTENT={...g.env.CONTENT,getStage(id){
        const stage=getStage(id);
        return stage.id==='night-town'?{...stage,pacing:{...stage.pacing,mobDifficulty:'hard'}}:stage;
      }};
    }
    g.start();g.stopSpawns();g.clearEnemies();
    assert.equal(g.snapshot().xpNeed,expected.thresholds[0]);
    for(let i=0;i<6;i++){
      assert.equal(g.prepareOrder(),true);
      const job=g.snapshot().job;
      g.resolve(job.ans.indexOf(job.word));g.update(.02);
      while(g.snapshot().state==='levelup')assert.equal(g.takeLevelUpChoice(0).ok,true);
      assert.equal(g.enemyXp().totalEarned,26*(i+1));
    }
    assert.equal(g.snapshot().level,expected.level);
    assert.equal(g.snapshot().xp,expected.xp);
    assert.equal(g.snapshot().xpNeed,expected.need);
    assert.equal(g.xpSpentActual(),expected.spent);
    assert.equal(g.xpSpentTotal(),expected.spent);
    assert.deepEqual(Array.from(g.xpSpentLedger.entries,e=>e.needed),expected.thresholds);
    const ledger=g.enemyXp();
    assert.equal(ledger.fromDelivery,156);
    assert.equal(ledger.fromEnemies,0);
    assert.equal(ledger.totalEarned,156);
  });
}

test('Phase38: collected ordinary kill credits exactly two combat XP',()=>{
  const g=loadGame({seed:11});g.start();g.stopSpawns();g.clearEnemies();
  for(let i=0;i<3;i++)g.update(.01);
  g.combatScene('thunder',[{dx:20,hp:1,max:1,type:'ghost',speed:0}],[],1);
  g.weapons(.01);
  for(let i=0;i<50;i++)g.update(.02);
  const ledger=g.enemyXp();
  assert.equal(ledger.fromDelivery,0);
  assert.equal(ledger.totalEarned,2);
  assert.equal(ledger.fromEnemies,2);
});
