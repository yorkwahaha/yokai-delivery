"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
function boot(hostname="localhost",search=""){
  const window={location:{hostname,search}};
  const ctx=vm.createContext({window,console,DEV_MODE:require("../js/dev-mode.js")});
  for(const path of ["js/game-violet-scent.js","js/game-confusion.js","js/game-catalog.js","js/game-seal-nail.js"])
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
test("公開與本機都繪出交錯香霧、釘陣三階段與覺醒圖",()=>{
  function load(host,search){
    const window=boot(host,search);
    window.Image=class {naturalWidth=256;naturalHeight=256;};
    const violet=window.GAME_VIOLET_SCENT,seal=window.GAME_SEAL_NAIL;
    return {violet,seal,mist:violet.loadCandidateArt(),nail:seal.loadCandidateArt()};
  }
  const local=load("127.0.0.1"),lan=load("192.168.1.20","?dev=1&s3play=1");
  const publicHost=load("example.com","?dev=1&s3play=1");
  assert.equal(lan.mist.mist.src,local.mist.mist.src);
  assert.equal(publicHost.mist.mist.src,local.mist.mist.src);
  assert.equal(publicHost.nail.pin.src,local.nail.pin.src);
  for(const img of [...Object.values(local.mist),...Object.values(local.nail)].filter(x=>x?.src)){
    assert.equal(fs.readFileSync(img.src).subarray(8,12).toString(),"WEBP");
  }
  const draws=[],angles=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},
    rotate(angle){angles.push(angle);},drawImage(img){draws.push(img.src.split("/").at(-1));}};
  const mist=local.violet.create();
  tick(mist,{dt:.31,end:loc(80)});
  tick(mist,{dt:.31,start:loc(80),end:loc(80,80)});
  tick(mist,{dt:.17,start:loc(80,80),end:loc(80,80)});
  mist.paint(ctx,local.mist);
  assert.deepEqual(draws,["violet-scent__incense__f02.webp","violet-scent__incense__f01.webp"]);
  assert.ok(Math.abs(angles[1]-angles[0]-Math.PI/2)<.1);
  draws.length=0;
  const nail=local.seal.create();
  tick(nail,{end:loc(5)});
  nail.paint(ctx,local.nail);
  tick(nail,{start:loc(5),end:loc(220),enemies:[monster(20)]});
  nail.paint(ctx,local.nail);
  assert.deepEqual(draws,["seal-nail__ofuda.webp","seal-nail__shockwave.webp","seal-nail__shards.webp"]);
  draws.length=0;
  const boss=monster(60,0,"boss"),mob=monster(64);
  mist.reset();
  tick(mist,{level:5,dt:.31,end:loc(80),enemies:[mob,boss]});
  tick(mist,{level:5,dt:.19,start:loc(80),end:loc(80),enemies:[mob,boss]});
  mist.paint(ctx,local.mist);
  mist.paintEnemyImpacts(ctx,local.mist);
  assert.ok(draws.includes("violet-scent__butterfly-trail__f02.webp"));
  assert.equal(draws.filter(name=>name==="violet-scent__bewildered.webp").length,1);
  const awakenedNail=local.seal.create({staged:true});
  tick(awakenedNail,{level:5,end:loc(5)});
  draws.length=0;
  awakenedNail.paint(ctx,local.nail);
  assert.deepEqual(draws,["seal-nail__ward-ring.webp","seal-nail__ofuda.webp"]);
  tick(awakenedNail,{level:5,start:loc(5),end:loc(220),enemies:[monster(20)]});
  draws.length=0;
  awakenedNail.paint(ctx,local.nail);
  assert.deepEqual(draws,["seal-nail__shockwave.webp","seal-nail__shards.webp","seal-nail__ward-ring.webp"]);
  tick(awakenedNail,{level:5,dt:.43,start:loc(220),end:loc(220)});
  draws.length=0;
  awakenedNail.paint(ctx,local.nail);
  const pillars=[];
  awakenedNail.paintPillar(ctx,local.nail,(x,y,paint)=>{pillars.push([x,y]);paint();});
  assert.deepEqual(pillars,[[94,0]]);
  assert.ok(draws.includes("seal-nail__rupture.webp"));
  assert.ok(draws.includes("seal-nail__fallout.webp"));
  assert.ok(draws.includes("seal-nail__pillar.webp"));
});
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
  assert.equal(hits.length,2);
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
  assert.equal(b.d,a.d*.60);
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
  assert.equal(spec(5,2,["mut_ink_linger"]).max,18);
  assert.ok(spec(5,2,["mut_ink_linger"]).max*spec(5,2,["mut_ink_linger"]).interval>=7.8,
    "留香的雲團容量與頻率不能只在站立時生效");
  assert.equal(spec(5,2,["mut_ink_echo"]).poisonLife,base.poisonLife+1.6);
  assert.equal(spec(5,2,["mut_ink_echo"]).confusionDuration,base.confusionDuration+.5);
});
test("長夜留香持續移動 6 秒後，首團毒霧仍存在且雲團數受限",()=>{
  const c=boot().GAME_VIOLET_SCENT.create();
  for(let i=0;i<120;i++)tick(c,{level:5,dt:.05,
    start:loc(i*10),end:loc((i+1)*10),mutations:["mut_ink_linger"]});
  const state=c.snapshot();
  assert.ok(state.clouds<=18,"iPad 迴圈不得無上限增長");
  assert.ok(state.positions.some(([x])=>x<65),
    "持續跑動不應在 2.8 秒就丟掉最早的留香");
});
test("Lv5 混亂以 85% 選近處同伴，無目標時迷走，不選 Boss",()=>{
  const w=boot(),step=w.GAME_CONFUSION.step;
  const player=loc(0),a=monster(0),b=monster(65),boss=monster(20,0,"boss");
  a.confusedT=2.5;a.confuseImmuneT=7;
  assert.equal(step(a,.1,[a,b,boss],player,()=>.84),b);
  a.confuseSwapT=0;
  assert.equal(step(a,.1,[a,b,boss],player,()=>.85),player);
  a.confuseSwapT=0;
  b.shield=true;
  const wander=step(a,.1,[a,b,boss],player,()=>.99);
  assert.equal(wander,a.confuseWander);
  assert.notEqual(wander,player);
  assert.equal(step(a,.1,[a,b,boss],player,()=>.99),wander);
  assert.equal(step(a,2.5,[a,b,boss],player,()=>0),player);
  assert.equal(a.confusedT,0);
  assert.equal(a.confuseTarget,null);
  assert.equal(a.confuseWander,null);
  assert.ok(a.confuseImmuneT>0);
});
test("封印釘保留自動設定，改踩踏爆炸，無手動引爆鍵",()=>{
  const game=fs.readFileSync("js/game.js","utf8"),html=fs.readFileSync("index.html","utf8");
  assert.ok(game.includes('window.GAME_VIOLET_SCENT.create()'));
  assert.ok(game.includes('window.GAME_CONFUSION.step(e,dt,enemies,P)'));
  assert.ok(game.includes('sealNail.tick({dt,level:WL.seal_nail'));
  assert.ok(html.includes('js/game-violet-scent.js'));
  assert.ok(html.includes('js/game-confusion.js'));
  assert.ok(fs.readFileSync("js/game-seal-nail.js","utf8").includes('Math.hypot(e.x-pin.x,e.y-pin.y)<=cfg.triggerRadius'));
});
