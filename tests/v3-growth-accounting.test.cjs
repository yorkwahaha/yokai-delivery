// Codex checks the measurement itself; these are controlled deliveries, not a route.
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

// normal 使用 night-town 預設，逐級 round(原需求 ×0.75)；每單仍給26 XP。
// hard 明確保留歷史曲線與原 Lv4 契約，不降低原帳務斷言。
for(const expected of [
  {profile:'normal',level:5,spent:122,xp:34,need:44,thresholds:[23,28,33,38]},
  {profile:'hard',level:4,spent:111,xp:45,need:51,thresholds:[30,37,44]}
])test(`V3 accounting: ${expected.profile} six deliveries keep exactly 156 earned XP after real level choices`,()=>{
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
    const j=g.snapshot().job;g.resolve(j.ans.indexOf(j.word));g.update(.02);
    while(g.snapshot().state==='levelup') assert.equal(g.takeLevelUpChoice(0).ok,true);
    assert.equal(g.enemyXp().totalEarned,26*(i+1),'每次真選卡前後都不可遺失或增加配送 XP');
  }
  assert.equal(g.snapshot().level,expected.level);
  assert.equal(g.snapshot().xp,expected.xp);
  assert.equal(g.snapshot().xpNeed,expected.need);
  assert.equal(g.xpSpentActual(),expected.spent);
  assert.equal(g.xpSpentTotal(),expected.spent);
  assert.deepEqual(Array.from(g.xpSpentLedger.entries,e=>e.needed),expected.thresholds);
  const ledger=g.enemyXp();
  assert.equal(ledger.fromDelivery,156);
  assert.equal(ledger.totalEarned,156,'sum the actual requirements at each past level');
  assert.equal(ledger.fromEnemies,0,'delivery-only progression cannot invent combat XP');
});

test('V3 accounting: one collected ordinary kill contributes exactly two XP',()=>{
  const g=loadGame({seed:11});g.start();g.stopSpawns();g.clearEnemies();
  for(let i=0;i<3;i++)g.update(.01);
  g.combatScene('thunder',[{dx:20,hp:1,max:1,type:'ghost',speed:0}],[],1);
  g.weapons(.01);
  for(let i=0;i<50;i++)g.update(.02);
  const ledger=g.enemyXp();
  assert.equal(ledger.fromDelivery,0);assert.equal(ledger.totalEarned,2);assert.equal(ledger.fromEnemies,2);
});
