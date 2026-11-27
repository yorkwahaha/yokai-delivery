'use strict';
// 交貨結界與 Boss 封印反噬：從實際 game.js 抽出函式進行狀態驗證。
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {loadGame}=require('./helpers/game-runtime.cjs');
const game=fs.readFileSync(path.join(__dirname,'../js/game.js'),'utf8');
function extract(name){
  const start=game.indexOf('function '+name+'(');assert.ok(start>=0,name);
  const open=game.indexOf('{',start);let depth=0,end=open;
  for(;end<game.length;end++){if(game[end]==='{')depth++;else if(game[end]==='}'&&--depth===0){end++;break;}}
  assert.equal(depth,0);return game.slice(start,end);
}
test('交貨答題結界有多道羽化噴霧和向上光絲，戰鬥靈陣無此效果',()=>{
  const spy={radial:0,linear:0,fill:0};
  const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},arc(){},fill(){spy.fill++},
    moveTo(){},quadraticCurveTo(){},stroke(){},
    createRadialGradient(){spy.radial++;return {addColorStop(){}};},
    createLinearGradient(){spy.linear++;return {addColorStop(){}};}};
  const scope=vm.createContext({ctx,animElapsed:4,tiltK:()=>.6,liveMotion:()=>true,upright:(_x,_y,draw)=>draw(),Math});
  vm.runInContext(extract('drawDeliverySanctuaryMist'),scope);
  scope.drawDeliverySanctuaryMist({to:{x:300,y:200}},1);
  assert.ok(spy.radial>=24);assert.ok(spy.linear>=8);assert.ok(spy.fill>=24);
  const fx=fs.readFileSync(path.join(__dirname,'../js/skillfx.js'),'utf8');
  assert.doesNotMatch(fx,/barrierBreath/);
  assert.match(game,/drawDeliverySanctuaryMist\(job, timerFraction\)/,
    'real delivery-only sanctuary invokes its mist, separate from the battle barrier');
});

test('real Boss quiz can be retried after each curse in combat and only the correct answer opens the seal',()=>{
  const g=loadGame();
  g.start();
  g.stopSpawns();
  g.prepareBoss();
  g.update(.05);
  const boss=g.snapshot().enemies.find(e=>e.type==='boss');
  const quiz=g.snapshot().bossQ;
  assert.equal(quiz.reading,true);
  const wrong=Array.from(quiz.ans.keys()).filter(i=>quiz.ans[i]!==boss.word);
  const correct=quiz.ans.indexOf(boss.word);
  assert.equal(wrong.length,2);
  for(const [i,seconds] of [[wrong[0],10],[wrong[1],30]]){
    g.unlockBoss();
    const oil=g.snapshot().oil;
    g.answerBoss(i);
    assert.equal(g.combatPhase().curse,seconds);
    assert.equal(g.snapshot().oil,oil);
    g.update(.05);
    assert.equal(g.snapshot().bossQ.reading,false);
    const mistakes=quiz.wrong.length;
    g.answerBoss(correct);
    assert.equal(boss.shield,true);
    assert.equal(quiz.wrong.length,mistakes);
    // Advance only the remaining boundary; the actual update expires it.
    g.setCurseSeconds(.025);
    g.update(.05);
    assert.equal(g.combatPhase().curse,0);
    assert.equal(g.snapshot().bossQ,quiz);
  }
  g.unlockBoss();
  g.answerBoss(correct);
  assert.equal(boss.shield,false);
  assert.equal(g.snapshot().bossQ,null);
});
test('Boss兩次錯答各 10／30 秒，完全不扣燈油，所有進行中的玩家攻擊清除',()=>{
  const word={jp:'まち',zh:'街'};
  const boss={type:'boss',shield:true,word,x:150,y:0,hp:100,max:100};
  const bossQ={word,ans:[{jp:'パン'},{jp:'アイス'},word],wrong:[],lock:0};
  let resets=0;
  const scope=vm.createContext({
    state:'play',bossQ,enemies:[boss],oil:74,maxOil:100,bossCurseRemaining:0,BOSS_READING_RADIUS:380,
    job:null,elapsed:25,misses:[],P:{x:0,y:0},playerAttackPoseT:.6,fireAttackT:2,
    proj:[1],needles:[1],winds:[1],ghosts:[1],crosscuts:[1],dragonShots:[1],dragonScorches:[1],
    barrierPulses:[1],sacredSanctuary:{},splitblasts:[1],duoShockwaves:[1],inkfireMarks:[1],fusionEffects:[1],
    STORE:{rec(){}},study:{mistake(){}},SKILLFX:{reset(){resets++}},
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    AUDIO:{deliverWrong(){}},HAPTICS:{deliverWrong(){}},say(){},Math
  });
  vm.runInContext(extract('answerBoss'),scope);
  scope.answerBoss(0);
  assert.equal(scope.bossCurseRemaining,10);assert.equal(scope.oil,74);
  assert.equal(scope.proj.length,0);assert.equal(scope.fusionEffects.length,0);assert.equal(resets,1);
  // The first curse must actually expire before the second answer becomes
  // legal. The old fixture attempted to answer again during a 10s lockout.
  bossQ.lock=0;scope.bossCurseRemaining=0;boss.quizClosed=false;
  scope.answerBoss(1);
  assert.equal(scope.bossCurseRemaining,30);assert.equal(scope.oil,74);assert.equal(bossQ.wrong.length,2);
  assert.match(game,/if \(!safeRead && bossCurseRemaining > 0\)/);
  assert.match(game,/if \(bossCurseRemaining <= 0\)\s*weapons\(dt,/);
  assert.match(game,/e\.hp <= 0 \|\| bossCurseRemaining > 0/);
  const ui=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
  assert.match(ui,/首次答錯禁攻 10 秒/);assert.doesNotMatch(ui,/答錯扣 15% 燈油/);
});
