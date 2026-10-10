// Codex checks the measurement itself; these are controlled deliveries, not a route.
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('V3 accounting: six deliveries keep exactly 156 earned XP after real level choices',()=>{
  const g=loadGame({seed:11});g.start();g.stopSpawns();g.clearEnemies();
  for(let i=0;i<6;i++){
    assert.equal(g.prepareOrder(),true);
    const j=g.snapshot().job;g.resolve(j.ans.indexOf(j.word));g.update(.02);
    while(g.snapshot().state==='levelup') assert.equal(g.takeLevelUpChoice(0).ok,true);
  }
  assert.equal(g.snapshot().level,4);
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
