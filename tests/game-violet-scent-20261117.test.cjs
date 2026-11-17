"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
function boot(){
  const window={location:{hostname:"localhost"}};
  const ctx=vm.createContext({window,console});
  for(const path of ["js/game-violet-scent.js","js/game-confusion.js","js/game-catalog.js"])
    vm.runInContext(fs.readFileSync(path,"utf8"),ctx,{filename:path});
  return window;
}
const loc=(x,y=0)=>({x,y});
const monster=(x,y=0,type="normal")=>({x,y,hp:1000,r:12,type});
function tick(skill,settings={}){
  skill.tick({level:settings.level||1,dt:settings.dt??.1,
    start:settings.start??loc(0),end:settings.end??loc(0),
    enemies:settings.enemies||[],effectiveDamage:1,mutations:settings.mutations||[],
    hit:settings.hit||(()=>{}),onEvent:settings.onEvent||(()=>{})});
}
test("五等級越跑越長，毒香停留更久，Lv5 才有混亂",()=>{
  const w=boot(),spec=w.GAME_VIOLET_SCENT.spec;
  const all=[1,2,3,4,5].map(n=>spec(n));
  assert.deepEqual(all.map(x=>x.max),[4,6,8,11,14]);
  assert.deepEqual(all.map(x=>x.life),[2.8,3.5,4.4,5.5,6]);
  assert.deepEqual(all.map(x=>x.confusionDuration),[0,0,0,0,2.5]);
  assert.ok(all.every((x,i)=>i===0||x.radius>all[i-1].radius));
  assert.ok(all.every(x=>x.cadenceEligible===false&&x.critEligible===false));
});
test("近距 Lv1 隨移動產毒霧，玩家站著不會一直生新毒霧",()=>{
  const c=boot().GAME_VIOLET_SCENT.create();
  tick(c,{dt:.35,start:loc(0),end:loc(80)});
  assert.equal(c.snapshot().clouds,1);
  for(let i=0;i<10;i++)tick(c,{dt:.1,start:loc(80),end:loc(80)});
  assert.equal(c.snapshot().clouds,1);
  for(let i=0;i<25;i++)tick(c,{dt:.1,start:loc(80),end:loc(80)});
  assert.equal(c.snapshot().clouds,0);
});
test("在毒香範圍內持續中毒；離開雲霧後還會短暫扣血",()=>{
  const c=boot().GAME_VIOLET_SCENT.create(),e=monster(60),hits=[];
  tick(c,{dt:.35,start:loc(0),end:loc(80),enemies:[e],hit:(foe,d)=>hits.push(d)});
  tick(c,{dt:.30,start:loc(80),end:loc(80),enemies:[e],hit:(foe,d)=>hits.push(d)});
  assert.equal(hits.length,1);
  e.x=1000;
  for(let i=0;i<4;i++)tick(c,{dt:.5,start:loc(80),end:loc(80),enemies:[e],
    hit:(foe,d)=>hits.push(d)});
  assert.ok(hits.length>1,"poison remains after leaving the cloud");
  const before=hits.length;
  for(let i=0;i<4;i++)tick(c,{dt:.5,start:loc(80),end:loc(80),enemies:[e],
    hit:(foe,d)=>hits.push(d)});
  assert.equal(hits.length,before,"poison eventually expires");
});
test("大量移動每幀最多一段，14個香霧上限、低幀率無暴增",()=>{
  const c=boot().GAME_VIOLET_SCENT.create();
  for(let i=0;i<30;i++)
    tick(c,{level:5,dt:.25,start:loc(i*110),end:loc((i+1)*110)});
  assert.equal(c.snapshot().clouds,14);
  tick(c,{level:5,dt:1.0,start:loc(3300),end:loc(8000)});
  assert.ok(c.snapshot().clouds<=14);
});
test("Boss 吃減量毒傷，不會混亂；一般怪 Lv5 中毒並短暫混亂",()=>{
  const c=boot().GAME_VIOLET_SCENT.create(),boss=monster(60,0,"boss"),mob=monster(65);
  const hits=[],events=[];
  tick(c,{level:5,dt:.3,start:loc(0),end:loc(100),enemies:[mob,boss],
    hit:(e,d)=>hits.push({e,d}),onEvent:k=>events.push(k)});
  tick(c,{level:5,dt:.3,start:loc(100),end:loc(100),enemies:[mob,boss],
    hit:(e,d)=>hits.push({e,d})});
  assert.equal(mob.confusedT,2.5);
  assert.equal(boss.confusedT,undefined);
  assert.ok(hits.some(x=>x.e===mob&&x.d>0));
  const a=hits.find(x=>x.e===mob),b=hits.find(x=>x.e===boss);
  assert.equal(b.d,a.d*.35);
  assert.ok(events.includes("confuse"));
});
test("盾怪無法被毒氣繞盾攻擊，暫停與重新開始都會清除毒氣",()=>{
  const c=boot().GAME_VIOLET_SCENT.create(),e=monster(60),hits=[];
  e.shield=true;
  tick(c,{dt:.3,start:loc(0),end:loc(90),enemies:[e],hit:(e,d)=>hits.push(d)});
  tick(c,{dt:.7,start:loc(90),end:loc(90),enemies:[e],hit:(e,d)=>hits.push(d)});
  assert.equal(hits.length,0);
  e.shield=false;
  tick(c,{dt:.5,start:loc(90),end:loc(90),enemies:[e],hit:(e,d)=>hits.push(d)});
  assert.ok(hits.length>0);
  c.suspend();assert.equal(c.snapshot().clouds,0);assert.equal(c.snapshot().infected,0);
  c.reset();assert.equal(c.snapshot().clouds,0);
});
test("四變異改為擴散、毒傷、香氣滯留與離開後餘毒",()=>{
  const spec=boot().GAME_VIOLET_SCENT.spec,base=spec(5,2);
  assert.equal(spec(5,2,["mut_ink_bloom"]).radius,base.radius*1.25);
  assert.equal(spec(5,2,["mut_ink_razor"]).dps,base.dps*1.25);
  assert.equal(spec(5,2,["mut_ink_linger"]).life,base.life+1.8);
  assert.equal(spec(5,2,["mut_ink_echo"]).poisonLife,base.poisonLife+1.6);
  assert.equal(spec(5,2,["mut_ink_echo"]).confusionDuration,base.confusionDuration+.5);
});
test("Lv5 混亂 2.5 秒，隨機切換玩家/近處同伴，不選 Boss",()=>{
  const w=boot(),step=w.GAME_CONFUSION.step;
  const player=loc(0),a=monster(0),b=monster(65),boss=monster(20,0,"boss");
  a.confusedT=2.5;a.confuseImmuneT=7;
  assert.equal(step(a,.1,[a,b,boss],player,()=>0),b);
  a.confuseSwapT=0;
  assert.equal(step(a,.1,[a,b,boss],player,()=>.99),player);
  assert.equal(step(a,2.5,[a,b,boss],player,()=>0),player);
  assert.equal(a.confusedT,0);
  assert.equal(a.confuseTarget,null);
  assert.ok(a.confuseImmuneT>0);
});
test("既有封印釘完全保留自動設定與離位爆炸，無手動引爆鍵",()=>{
  const game=fs.readFileSync("js/game.js","utf8"),html=fs.readFileSync("index.html","utf8");
  assert.ok(game.includes('window.GAME_VIOLET_SCENT.create()'));
  assert.ok(game.includes('window.GAME_CONFUSION.step(e,dt,enemies,P)'));
  assert.ok(game.includes('sealNail.tick({dt,level:WL.seal_nail'));
  assert.ok(html.includes('js/game-violet-scent.js'));
  assert.ok(html.includes('js/game-confusion.js'));
  assert.ok(fs.readFileSync("js/game-seal-nail.js","utf8").includes('if(end&&Math.hypot(end.x-pin.x,end.y-pin.y)>=cfg.distance)'));
});
