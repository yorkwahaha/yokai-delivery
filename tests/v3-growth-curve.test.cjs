// Codex growth contract: controlled selection accounting, not natural-play proof.
const test=require('node:test');
const assert=require('node:assert/strict');
const cfg=require('../js/config.js');
const {loadGame}=require('./helpers/game-runtime.cjs');
const spent=n=>Array.from({length:n},(_,i)=>cfg.xpNeed(i+1)).reduce((a,b)=>a+b,0);

test('V3 growth preserves the first eight upgrade thresholds',()=>{
  assert.deepEqual(Array.from({length:8},(_,i)=>cfg.xpNeed(i+1)),[30,37,44,51,59,67,75,83]);
});
test('V3 growth caps later upgrades at 90 without reducing early requirements',()=>{
  const needs=Array.from({length:100},(_,i)=>cfg.xpNeed(i+1));
  assert.equal(needs[8],90);assert.equal(needs[99],90);
  for(let i=1;i<needs.length;i++)assert.ok(needs[i]>=needs[i-1] && needs[i]<=90);
});
test('V3 growth budgets four MAX plus six or eight passive choices',()=>{
  // Starter katana1 makes four MAX require nineteen weapon choices.
  assert.equal(spent(19),1436);assert.equal(spent(25),1976);assert.equal(spent(27),2156);
});
test('V3 growth actual twenty-five choices spend 1976 XP and reach level26',()=>{
  const g=loadGame({seed:11});g.start();g.stopSpawns();g.clearEnemies();
  for(let i=0;i<25;i++){
    assert.equal(g.forceLevelUp(),'levelup');
    assert.equal(g.takeLevelUpChoice(0).ok,true);
  }
  assert.equal(g.snapshot().level,26);assert.equal(g.xpSpentActual(),1976);
  assert.equal(g.xpSpentTotal(),1976);assert.equal(g.snapshot().xpNeed,90);
});
