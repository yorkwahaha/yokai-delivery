'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');
const stages=['night-town','rain-port','sakura-pass','bamboo-maze'];
for(const stageId of stages) test('F8 '+stageId+' different boss start/active spacing and baseline',()=>{
  const {env}=loadGame({location:{hostname:'127.0.0.1',search:'?dev=1&stageLab=1'},stage:stageId});
  const ai=env.BOSS_AI, player={x:1000,y:900};
  function bosses(){return Array.from({length:3},(_,i)=>({type:'boss',stageId,bossIndex:i,x:900-i*10,y:900,hp:1000,max:1000,attackCd:0,speed:100}));}
  const baseline=bosses(), baselineClock={lastTelegraphAt:-99,lastActiveAt:-99};
  for(const e of baseline) assert.ok(ai.step(e,player,.02,{stageId,now:0,stagger:baselineClock}).started);
  const enemies=bosses(), stagger={lastTelegraphAt:-99,lastActiveAt:-99};
  const events={telegraph:[],active:[]};
  for(let frame=0;frame<1500;frame++){
    const now=frame*.02;
    for(const [i,e] of enemies.entries()){
      const old=e.hazard?.phase;
      ai.step(e,player,.02,{stageId,now,stagger,earlyStagger:true,blocked:()=>true});
      const phase=e.hazard?.phase;
      if(phase!==old && events[phase]) events[phase].push({i,now});
    }
  }
  for(const [phase,gap] of [['telegraph',.75],['active',.35]]){
    const rows=events[phase];
    assert.equal(new Set(rows.map(r=>r.i)).size,3,phase+' all bosses participate');
    for(let j=1;j<rows.length;j++)if(rows[j].i!==rows[j-1].i)
      assert.ok(rows[j].now-rows[j-1].now>=gap-1e-7,JSON.stringify({phase,prev:rows[j-1],current:rows[j]}));
  }
});
test('F8 delivery bar stack avoids labels and fits HUD',()=>{
 const {env}=loadGame();
 for(const [width,height] of [[1280,800],[1180,820],[844,390]]){
   env.innerWidth=width;env.innerHeight=height;
   const UI=env.UI, bounds=env.VIEWPORT.hudBounds(), base=UI.bossQuizLayout(3,3).bar;
   const stack=UI.bossReadingBarLayout(base,3,[]);
   assert.ok(stack && stack.y+stack.h<=bounds.bottom-104);
   const avoid=[{x:stack.x,y:stack.y,w:stack.w,h:stack.h}];
   const moved=UI.bossReadingBarLayout(base,3,avoid);
   assert.ok(moved && moved.y+moved.h<=stack.y);
   assert.equal(UI.bossReadingBarLayout(base,3,[{x:bounds.left,y:bounds.top,w:bounds.width,h:bounds.height}]),null);
 }
});
