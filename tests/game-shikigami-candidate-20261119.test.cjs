"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const filename=require("node:path").resolve("js/game-shikigami.js");
const source=fs.readFileSync(filename,"utf8");
function boot(extra={}){
  const window={...extra};
  vm.runInNewContext(source,{window,console},{filename});
  return window.GAME_SHIKIGAMI;
}
const loc=(x,y=0)=>({x,y});
const mob=(x,y=0,type="grunt")=>({x,y,r:12,hp:200,type});
const run=(ally,options={})=>ally.tick({
  level:options.level??5,dt:options.dt??.1,player:options.player??loc(0),
  enemies:options.enemies??[],effectiveDamage:options.effectiveDamage??1,
  blocked:options.blocked,hit:options.hit,onEvent:options.onEvent
});
test("Lv1→5 提升生命、留存時間、攻擊頻率與威力；同場仍僅一隻",()=>{
  const specs=[1,2,3,4,5].map(level=>boot().spec(level));
  for(let i=1;i<5;i++){
    assert.ok(specs[i].maxHp>specs[i-1].maxHp);
    assert.ok(specs[i].life>specs[i-1].life);
    assert.ok(specs[i].attackInterval<specs[i-1].attackInterval);
    assert.ok(specs[i].damage>specs[i-1].damage);
  }
  assert.ok(specs.every(x=>x.maxAllies===1 && x.aggroCap<=3));
  assert.ok(specs.every(x=>!x.critEligible&&!x.cadenceEligible&&!x.reachEligible));
});

test("升階延長當前召喚並增加最大 HP，已受傷害保留",()=>{
  const companion=boot().create({random:()=>0}),enemy=mob(12,25);
  run(companion,{level:1,enemies:[enemy]});
  assert.equal(companion.receiveEnemyAttack(enemy,10),true);
  const before=companion.snapshot();
  run(companion,{level:2,enemies:[enemy],dt:.05});
  const after=companion.snapshot();
  assert.equal(after.maxHp,60);
  assert.equal(after.hp,50);
  assert.ok(after.remaining>before.remaining+1.9);
  assert.ok(after.cooldown<before.cooldown-1);
});
test("不需移動即可召喚，夥伴跟隨玩家但不會變成地面砲台",()=>{
  const ally=boot().create(),player=loc(0);
  run(ally,{player});
  const start=ally.snapshot();
  assert.equal(start.active,true);
  assert.equal(start.species,"fox");
  run(ally,{player:loc(180),dt:.3});
  const moved=ally.snapshot();
  assert.ok(moved.position[0]>start.position[0]);
  for(let i=0;i<30;i++)run(ally,{player:loc(200),dt:.1});
  assert.ok(Math.abs(ally.snapshot().position[0]-200)<90);
});
test("會離開玩家附近主動攻擊，但不追敵到無限遠",()=>{
  const ally=boot().create(),enemy=mob(95),far=mob(900),hits=[];
  run(ally,{enemies:[enemy,far]});
  for(let i=0;i<34;i++)run(ally,{enemies:[enemy,far],hit:(target,damage)=>hits.push({target,damage})});
  assert.ok(hits.length>=1);
  assert.ok(hits.every(({target})=>target===enemy));
  assert.ok(hits.length<=4,"single attack per cooldown, no frame-rate burst");
  const oldX=ally.snapshot().position[0];
  for(let i=0;i<15;i++)run(ally,{enemies:[far],dt:.1});
  assert.ok(ally.snapshot().position[0]<=oldX+35,"leashes back toward courier");
});
test("普通怪最多三隻轉移仇恨，Boss 絕不轉移，也不能覆蓋既有混亂",()=>{
  const ally=boot().create({species:"hound",random:()=>0}),player=loc(0);
  const enemies=Array.from({length:7},(_,i)=>mob(45+i*7,0));
  const boss=mob(65,0,"boss");
  const confused=mob(42,20);
  confused.confusedT=1;
  run(ally,{player,enemies:[boss,confused,...enemies]});
  assert.equal(ally.snapshot().aggroCount,3);
  assert.equal(ally.targetForEnemy(boss,player),player);
  assert.equal(ally.targetForEnemy(confused,player),player);
  const diverted=enemies.filter(e=>ally.targetForEnemy(e,player)!==player);
  assert.equal(diverted.length,3);
  const foreignAim=loc(12,15);
  assert.equal(ally.targetForEnemy(diverted[0],player,foreignAim),foreignAim);
  for(let i=0;i<12;i++)run(ally,{player:loc(900),enemies});
  assert.equal(ally.snapshot().aggroCount,0,"out of leash does not keep enemy aggro");
});
test("分身被普通怪擊中會扣生命，無敵短窗不重扣，血盡死亡並清除仇恨",()=>{
  const ally=boot().create({random:()=>0}),enemy=mob(20),events=[];
  const callback=event=>events.push(event);
  run(ally,{level:1,enemies:[enemy],onEvent:callback});
  assert.equal(ally.snapshot().aggroCount,1);
  assert.equal(ally.receiveEnemyAttack(enemy,25,callback),true);
  assert.equal(ally.snapshot().hp,17);
  assert.equal(ally.receiveEnemyAttack(enemy,25,callback),true);
  assert.equal(ally.snapshot().hp,17);
  run(ally,{level:1,dt:.41,enemies:[enemy]});
  assert.equal(ally.receiveEnemyAttack(enemy,25,callback),true);
  assert.equal(ally.snapshot().active,false);
  assert.equal(ally.snapshot().aggroCount,0);
  assert.ok(events.includes("death"));
});
test("遠距妖怪彈可傷害分身，但來源必須是被吸引的普通怪",()=>{
  const ally=boot().create({random:()=>0}),enemy=mob(145),boss=mob(20,0,"boss");
  run(ally,{enemies:[enemy,boss]});
  assert.equal(ally.snapshot().aggroCount,1);
  assert.equal(ally.receiveEnemyAttack(enemy,16),false,"far contact is not a melee hit");
  assert.equal(ally.receiveEnemyAttack(enemy,16,null,{projectile:true}),true);
  assert.equal(ally.snapshot().hp,119);
  assert.equal(ally.receiveEnemyAttack(boss,20,null,{projectile:true}),false);
});
test("可攻擊 Boss 但不會嘲諷 Boss，也不穿透護盾或無敵",()=>{
  const ally=boot().create({random:()=>0}),boss=mob(70,0,"boss"),hits=[];
  run(ally,{enemies:[boss]});
  for(let i=0;i<30;i++)run(ally,{enemies:[boss],hit:(e,amount)=>hits.push({e,amount})});
  assert.ok(hits.length>=1);
  assert.ok(hits.every(({e,amount})=>e===boss&&amount===boot().spec(5).damage*.42));
  boss.shield=true;
  const count=hits.length;
  for(let i=0;i<30;i++)run(ally,{enemies:[boss],hit:(e,amount)=>hits.push({e,amount})});
  assert.equal(hits.length,count);
  assert.equal(ally.snapshot().aggroCount,0);
});
test("部署尊重障礙，停火狀態不消耗生命或追加攻擊",()=>{
  const ally=boot().create({species:"crow",random:()=>0}),enemy=mob(40),hits=[];
  run(ally,{blocked:()=>true});
  assert.equal(ally.snapshot().active,false);
  run(ally,{enemies:[enemy]});
  assert.equal(ally.snapshot().active,true);
  ally.suspend();
  const remaining=ally.snapshot().remaining;
  for(let i=0;i<12;i++)run(ally,{dt:1,enemies:[enemy],hit:e=>hits.push(e)});
  assert.equal(ally.snapshot().remaining,remaining);
  assert.equal(hits.length,0);
  ally.resume();
  run(ally,{enemies:[enemy]});
  ally.reset();
  assert.equal(ally.snapshot().active,false);
  assert.equal(ally.snapshot().cooldown,0);
});
test("壽命到期會消失且留下冷卻，並提供狐狸、犬、烏鴉三種圖片/音效槽",()=>{
  const skill=boot(),comp=skill.create({species:"crow"}),events=[];
  run(comp,{level:1,onEvent:x=>events.push(x)});
  for(let i=0;i<12;i++)run(comp,{level:1,dt:1,onEvent:x=>events.push(x)});
  assert.equal(comp.snapshot().active,false);
  assert.ok(comp.snapshot().cooldown>0);
  assert.ok(events.includes("expire"));
  assert.deepEqual(Array.from(skill.SPECIES),["fox","hound","crow"]);
  assert.match(skill.ART_PATHS.fox,/shikigami__fox\.webp$/);
  assert.match(skill.SFX_PATHS.summon,/shikigami__summon\.mp3$/);
  assert.equal(typeof comp.deliver,"undefined");
  assert.equal(typeof comp.pickup,"undefined");
  assert.equal(typeof comp.answerBossQuiz,"undefined");
});
test("公開 HTML 載入式神與竹林，京都與融合維持本機門禁",()=>{
  const html=fs.readFileSync("index.html","utf8");
  const block=html.match(/<script>\s*\/\/ Fusion and Kyoto[\s\S]*?<\/script>/)?.[0];
  assert.ok(block);
  const writes=[];
  const env=vm.createContext({location:{hostname:"public.example",search:"?dev=1&stageLab=1&fusionlab=1"},
    document:{write:html=>writes.push(html)},URLSearchParams});
  env.window=env;
  for(const name of ['delivery-lexicon','words','dev-mode'])
    vm.runInContext(fs.readFileSync("js/"+name+".js","utf8"),env);
  vm.runInContext(block.slice(8,-9),env);
  assert.match(writes.join(" "),/game-shikigami\.js/);
  assert.match(writes.join(" "),/bamboo-art\.js/);
  assert.doesNotMatch(writes.join(" "),/fusion\.js|kyoto-procession\.js/);
  assert.ok(!fs.readFileSync("js/game-catalog.js","utf8").includes("shikigami:"));
});

test("掉幀時式神不穿薄牆、不隔牆打怪，也不補打多次",()=>{
  const ally=boot().create(),enemy=mob(40,28),hits=[];
  const blocked=(x,y,r)=>Math.abs(x-5)<r+2;
  run(ally);
  run(ally,{dt:2,enemies:[enemy],blocked,hit:e=>hits.push(e)});
  assert.ok(ally.snapshot().position[0]<5);
  assert.equal(hits.length,0);
  run(ally,{dt:3,enemies:[enemy],hit:e=>hits.push(e)});
  assert.equal(hits.length,1);
});

test("缺少式神 raster 不繪畫，提供真圖時才使用世界腳點",()=>{
  const ally=boot().create(),painted=[];
  run(ally);
  const ctx={globalAlpha:1,save(){},restore(){},scale(){},
    translate:(...args)=>painted.push(args),drawImage:()=>painted.push("image")};
  ally.paint(ctx,{fox:{naturalWidth:0}});
  assert.equal(painted.length,0);
  ally.paint(ctx,{fox:{naturalWidth:94,naturalHeight:82}});
  assert.deepEqual(painted,[[-30,28],"image"]);
});

test("白狼讀齊九格畫面並用相同腳點繪製，狐狸仍沿用原選配圖片",()=>{
  const missing=boot();
  assert.equal(Object.keys(missing.loadArt("fox")).length,0);
  const paths=[];
  class Image {
    set src(value){this.path=value; this.naturalWidth=512; this.naturalHeight=352; paths.push(value);}
  }
  const skill=boot({Image});
  const wolf=skill.loadArt("hound");
  assert.equal(paths.length,9);
  assert.equal(wolf.hound.path,skill.CARD_ART_PATH);
  assert.equal(wolf.run.length,4);
  assert.equal(wolf.bite.length,4);
  for(const path of paths) assert.ok(fs.existsSync(path),path);
  const hound=skill.create({species:"hound"});
  run(hound);
  const drawn=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},scale(){},
    drawImage:(...args)=>drawn.push(args)};
  hound.paint(ctx,wolf);
  assert.equal(drawn.at(-1)[0],wolf.hound);
  assert.equal(drawn.at(-1)[2],-70);
  run(hound,{player:loc(120)});
  hound.paint(ctx,wolf);
  assert.ok(wolf.run.includes(drawn.at(-1)[0]));
  paths.length=0;
  skill.loadArt("fox");
  assert.deepEqual(paths,[skill.ART_PATHS.fox,skill.ART_PATHS.attack,skill.ART_PATHS.vanish]);
});

test("式神火彈不穿牆，過期召喚的火彈不會改打下一隻",()=>{
  const skill=boot(),ally=skill.create({random:()=>0}),shooter=mob(-125,28);
  run(ally,{enemies:[shooter]});
  const target=ally.body();
  const bullet={x:0,y:28,target,shooter};
  assert.equal(ally.stepProjectile(bullet,{x:-125,y:28},x=>Math.abs(x+82)<8),true);
  assert.equal(ally.snapshot().hp,135);
  assert.equal(ally.stepProjectile({x:-98,y:28,target,shooter},{x:-125,y:28}),false);
  ally.reset();
  run(ally);
  assert.equal(ally.stepProjectile(bullet,{x:-125,y:28}),true);
  assert.equal(ally.snapshot().hp,135);
});
