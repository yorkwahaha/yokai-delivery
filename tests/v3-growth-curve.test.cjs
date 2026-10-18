// Codex growth contract: controlled selection accounting, not natural-play proof.
const test=require('node:test');
const assert=require('node:assert/strict');
const cfg=require('../js/config.js');
const {loadGame}=require('./helpers/game-runtime.cjs');
const spent=(n,scale=1)=>Array.from({length:n},(_,i)=>Math.round(cfg.xpNeed(i+1)*scale)).reduce((a,b)=>a+b,0);

test('V3 growth preserves the first eight upgrade thresholds',()=>{
  assert.deepEqual(Array.from({length:8},(_,i)=>cfg.xpNeed(i+1)),[30,37,44,51,59,67,75,83]);
});
test('V3 growth holds opening requirements through Lv20 and grows by 12 XP per late level',()=>{
  const needs=Array.from({length:100},(_,i)=>cfg.xpNeed(i+1));
  assert.equal(needs[8],90);assert.equal(needs[19],90);
  assert.equal(needs[20],102);assert.equal(needs[99],1050);
  for(let i=1;i<needs.length;i++){
    assert.ok(needs[i]>=needs[i-1]);
    if(i>=20)assert.equal(needs[i]-needs[i-1],12);
  }
});
test('V3 growth budgets four MAX plus six or eight passive choices',()=>{
  // Starter katana1 makes four MAX require nineteen weapon choices.
  assert.equal(spent(19),1436);assert.equal(spent(25),2156);assert.equal(spent(27),2492);
  // normal 每級分別四捨五入，不是把 hard 總和乘0.75後再四捨五入。
  assert.equal(spent(19,.75),1082);assert.equal(spent(25,.75),1625);assert.equal(spent(27,.75),1878);
});
for(const expected of [
  {profile:'normal',scale:.75,total:1625,next:122},
  {profile:'hard',scale:1,total:2156,next:162}
])test(`V3 growth ${expected.profile} actual twenty-five choices spend ${expected.total} XP and reach level26`,()=>{
  const g=loadGame({seed:11});
  // 比照 N3/N4：歷史契約案明確選 hard；normal 不覆寫 night-town 預設。
  if(expected.profile==='hard'){
    const getStage=g.env.CONTENT.getStage;
    g.env.CONTENT={...g.env.CONTENT,getStage(id){
      const stage=getStage(id);
      return stage.id==='night-town'?{...stage,pacing:{...stage.pacing,mobDifficulty:'hard'}}:stage;
    }};
  }
  g.start();g.stopSpawns();g.clearEnemies();
  for(let i=0;i<25;i++){
    assert.equal(g.snapshot().xpNeed,Math.round(cfg.xpNeed(i+1)*expected.scale),'真 runtime 使用本 profile 逐級需求');
    assert.equal(g.forceLevelUp(),'levelup');
    assert.equal(g.takeLevelUpChoice(0).ok,true);
    assert.equal(g.snapshot().level,i+2);
    assert.equal(g.snapshot().xp,0,'正好支付門檻後不可留下或遺失 XP');
    assert.equal(g.xpSpentActual(),spent(i+1,expected.scale),'逐次比對真 pickUp 花費帳');
  }
  assert.equal(g.snapshot().level,26);assert.equal(g.xpSpentActual(),expected.total);
  assert.equal(g.xpSpentTotal(),expected.total);assert.equal(g.snapshot().xpNeed,expected.next);
  assert.deepEqual(Array.from(g.xpSpentLedger.entries,e=>e.needed),Array.from({length:25},(_,i)=>Math.round(cfg.xpNeed(i+1)*expected.scale)));
});
