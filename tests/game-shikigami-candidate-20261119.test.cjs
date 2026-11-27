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
test('V2 升 Lv5 保留白狼身分、雙狼分流、普通一咬坦克兩咬',()=>{
  const skill=boot(),pack=skill.create({species:'hound',random:()=>0}),player=loc(0);
  const near=mob(-90,28),far=mob(220,28,'shooter'),tank=mob(140,-40,'tank');
  tank.max=tank.hp;
  run(pack,{level:4,player});
  const white=pack.body(); white.hp-=7;
  const bites=[];
  const hit=(foe,damage)=>{bites.push([foe,damage]);foe.hp-=damage;};
  run(pack,{player,enemies:[near,far],hit});
  assert.equal(pack.body(),white);
  assert.equal(white.hp,293);
  assert.deepEqual(Array.from(pack.bodies(),wolf=>wolf.coat),['white','black']);
  const black=pack.bodies()[1];
  assert.equal(white.target,near);
  assert.equal(black.target,far);
  for(let i=0;i<65;i++)run(pack,{dt:.05,player,enemies:[near,far,tank],hit});
  assert.equal(bites.filter(([e])=>e===near).length,1);
  assert.equal(bites.filter(([e])=>e===far).length,1);
  assert.equal(bites.filter(([e])=>e===tank).length,2);
  assert.ok(Math.hypot(white.x-black.x,white.y-black.y)>=28);
});

test('V2 鎖黑狼的飛彈只能命中原個體，另一隻存活且不接手舊彈',()=>{
  const pack=boot().create({species:'hound',random:()=>0}),player=loc(0),shooter=mob(100,25,'shooter');
  run(pack,{player,enemies:[shooter]});
  const [white,black]=pack.bodies();
  const bullet={x:black.x+40,y:black.y,target:black,shooter};
  assert.equal(pack.stepProjectile(bullet,{x:black.x-40,y:black.y}),true);
  assert.equal(black.hp,292);
  assert.equal(white.hp,300);
  run(pack,{dt:.41,player,enemies:[shooter]});
  assert.equal(pack.receiveEnemyAttack(shooter,1000,null,{projectile:true,target:black}),true);
  assert.equal(pack.bodies().length,1);
  assert.equal(pack.body(),white);
  assert.equal(pack.stepProjectile(bullet,{x:white.x-40,y:white.y}),true);
  assert.equal(white.hp,300);
  for(let i=0;i<120;i++)run(pack,{dt:.1,player});
  assert.equal(pack.body(),white);
  const replacement=pack.bodies().find(wolf=>wolf.coat==='black');
  assert.ok(replacement && replacement!==black && replacement.life>white.life);
  assert.equal(pack.stepProjectile(bullet,{x:replacement.x-40,y:replacement.y}),true);
  assert.equal(replacement.hp,300);
});

test('V2 雙狼可共咬 Boss，基礎合計每秒 4.5 係數，守護狀態皆免疫',()=>{
  const skill=boot(),pack=skill.create({species:'hound'}),boss={...mob(0,28,'boss'),hp:1000};
  const hit=(foe,damage)=>{foe.hp-=damage;};
  for(let i=0;i<100;i++)run(pack,{dt:.05,enemies:[boss],hit});
  assert.equal(1000-boss.hp,22.5);
  for(const flag of ['shield','invulnerable','untargetable','dying','revealT']){
    const before=boss.hp;
    boss[flag]=true;
    for(let i=0;i<15;i++)run(pack,{dt:.05,enemies:[boss],hit});
    assert.equal(boss.hp,before,flag);
    boss[flag]=false;
  }
});

test('V2 滿場只掃 128 個候選，輪轉後可找到陣列後方的敵人',()=>{
  const pack=boot().create({species:'hound',random:()=>0});
  const late=mob(80,0);
  const crowd=Array.from({length:600},()=>mob(900,800));
  crowd[590]=late;
  let reads=0;
  const enemies=new Proxy(crowd,{get(target,key){if(typeof key==='string' && /^\d+$/.test(key))reads++;return target[key];}});
  for(let i=0;i<26;i++){
    reads=0;
    run(pack,{dt:.05,enemies});
    assert.ok(reads<=128,`frame ${i}: ${reads} enemy reads`);
    if(pack.bodies().some(wolf=>wolf.target===late)){
      const wolf=pack.bodies().find(wolf=>wolf.target===late);
      run(pack,{dt:.21,enemies});
      assert.equal(wolf.target,late,'輪到遠敵切片時保留有效追擊');
      return;
    }
  }
  assert.fail('rotation never examined the tail of a large crowd');
});

test('V2 白狼繞不過牆就放棄隔牆目標，改咬可達的小怪',()=>{
  const wolf=boot().create({species:'hound'});
  const unreachable=mob(75,28), open=mob(-135,-40), hits=[];
  const blocked=(x,y,r)=>Math.abs(x-42)<r+8 && y+r>-80 && y-r<128;
  for(let i=0;i<45;i++)run(wolf,{level:1,dt:.05,blocked,enemies:[unreachable,open],hit:e=>hits.push(e)});
  assert.ok(hits.includes(open));
  assert.ok(!hits.includes(unreachable));
  assert.ok(wolf.body().x<42);
});

test('雙狼無敵人時鬆散跟隨，定點不微抖、持續移動時連續跑步',()=>{
  const pack=boot().create({species:'hound'}),player=loc(0);
  run(pack,{player});
  const wolves=pack.bodies();
  const initial=wolves.map(w=>[w.x,w.y]);
  for(let i=0;i<60;i++)run(pack,{dt:.02,player});
  assert.deepEqual(wolves.map(w=>[w.x,w.y]),initial);
  assert.ok(wolves.every(w=>Math.hypot(w.x-player.x,w.y-player.y)>65));
  let running=0;
  for(let i=0;i<100;i++){
    player.x+=4;
    run(pack,{dt:.02,player});
    if(i>25 && wolves.every(w=>w.walkTime>0))running++;
  }
  assert.ok(running>=65,`continuous running ${running}/74`);
  for(let i=0;i<100;i++)run(pack,{dt:.02,player});
  const settled=wolves.map(w=>[w.x,w.y]);
  for(let i=0;i<50;i++)run(pack,{dt:.02,player});
  assert.deepEqual(wolves.map(w=>[w.x,w.y]),settled);
});

test('雙狼咬死敵人後原地演出 .75 秒，下一口至少間隔 1 秒，咬擊圖加大',()=>{
  const pack=boot().create({species:'hound'}),player=loc(0);
  run(pack,{player});
  const white=pack.body(), first=mob(white.x-10,white.y), second=mob(white.x-90,white.y);
  const hits=[];let t=0;
  const hit=(e,d)=>{hits.push([e,t]);e.hp-=d;};
  const tick=dt=>{t+=dt;run(pack,{dt,player,enemies:[first,second],hit});};
  for(let i=0;i<30&&!hits.length;i++)tick(.01);
  assert.equal(hits[0]?.[0],first);
  const at=[white.x,white.y],start=t;
  assert.equal(white.biteRemaining,.75);
  for(let i=0;i<74;i++){tick(.01);assert.deepEqual([white.x,white.y],at);}
  assert.equal(white.attackTimer>.24,true);
  const img={naturalWidth:512,naturalHeight:352},draws=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},scale(){},drawImage(...a){draws.push(a);}};
  pack.paint(ctx,{hound:img,run:[img,img,img,img],bite:[img,img,img,img]},1,{...white,biteRemaining:.375});
  assert.ok(draws[0][3]>168*1.25);
  for(let i=0;i<100&&!hits.some(([e])=>e===second);i++)tick(.01);
  assert.ok(hits.some(([e,when])=>e===second&&when-start>=1-1e-8));
});

test('V2 黑狼以同一份快取點陣連續繪製，雙狼尺寸皆為 168px',()=>{
  let builds=0, tint;
  const ctx={drawImage(){},fillRect(){tint=this.globalCompositeOperation;}};
  const skill=boot({document:{createElement(){builds++; return {getContext:()=>ctx};}}});
  const pack=skill.create({species:'hound'});
  run(pack);
  const [white,black]=pack.bodies();
  const image={naturalWidth:512,naturalHeight:352};
  const art={hound:image,run:[],bite:[]}, draws=[];
  const canvas={globalAlpha:1,save(){},restore(){},translate(){},scale(){},drawImage(...args){draws.push(args);}};
  pack.paint(canvas,art,1,white);
  for(let i=0;i<6;i++)pack.paint(canvas,art,1,black);
  assert.equal(builds,1);
  assert.equal(tint,'source-atop');
  assert.ok(draws.every(args=>args[3]===168));
  assert.equal(draws[0][0],image);
  assert.ok(draws.slice(1).every(args=>args[0]===draws[1][0]&&args[0]!==image));
});

test('V2 雙狼各自套用強軀、長契、迅牙與破邪',()=>{
  const skill=boot(),pack=skill.create({species:'hound'}),boss={...mob(0,28,'boss'),hp:1000};
  run(pack);
  const [white,black]=pack.bodies();
  white.hp-=7;black.hp-=29;
  const remaining=white.life;
  pack.tick({dt:.05,level:5,player:loc(0),mutations:['mut_shikigami_guard','mut_shikigami_life']});
  assert.deepEqual([white.hp,black.hp],[383,361]);
  assert.ok(Math.abs(white.life-remaining-2.95)<1e-8 && white.life===black.life);
  const opts={dt:.01,level:5,player:loc(0),enemies:[boss],mutations:['mut_shikigami_quick','mut_shikigami_fang'],
    hit:(foe,damage)=>{foe.hp-=damage;}};
  for(let i=0;i<40;i++)pack.tick(opts);
  assert.equal(1000-boss.hp,2*2.25*1.25);
  assert.ok([white,black].every(w=>w.attackTimer>0&&w.attackTimer<=.82));
});
test("Lv1→5 提升生命、留存、索敵與攻擊；Lv5 才有雙狼",()=>{
  const specs=[1,2,3,4,5].map(level=>boot().spec(level));
  for(let i=1;i<5;i++){
    assert.ok(specs[i].maxHp>specs[i-1].maxHp);
    assert.ok(specs[i].life>specs[i-1].life);
    assert.ok(specs[i].attackInterval<specs[i-1].attackInterval);
    assert.ok(specs[i].damage>specs[i-1].damage);
    assert.ok(specs[i].seekRange>specs[i-1].seekRange);
  }
  assert.deepEqual(specs.map(x=>x.maxAllies),[1,1,1,1,2]);
  assert.equal(specs[4].aggroCap,8);
  assert.ok(specs.every(x=>!x.critEligible&&!x.cadenceEligible&&!x.reachEligible));
});

test("升階延長當前召喚並增加最大 HP，已受傷害保留",()=>{
  const companion=boot().create({random:()=>0}),enemy=mob(12,25);
  run(companion,{level:1,enemies:[enemy]});
  assert.equal(companion.receiveEnemyAttack(enemy,10),true);
  const before=companion.snapshot();
  run(companion,{level:2,enemies:[enemy],dt:.05});
  const after=companion.snapshot();
  assert.equal(after.maxHp,90);
  assert.equal(after.hp,80);
  assert.ok(after.remaining>before.remaining+2.9);
  assert.ok(after.cooldown<before.cooldown-1);
});
test("不需移動即可召喚，夥伴跟隨玩家但不會變成地面砲台",()=>{
  const ally=boot().create(),player=loc(0);
  run(ally,{level:1,player});
  const start=ally.snapshot();
  assert.equal(start.active,true);
  assert.equal(start.species,"fox");
  run(ally,{level:1,player:loc(180),dt:.3});
  const moved=ally.snapshot();
  assert.ok(moved.position[0]>start.position[0]);
  for(let i=0;i<30;i++)run(ally,{level:1,player:loc(200),dt:.1});
  assert.ok(Math.abs(ally.snapshot().position[0]-200)<90);
});
test("會離開玩家附近主動攻擊，但不追敵到無限遠",()=>{
  const ally=boot().create(),enemy=mob(95),far=mob(900),hits=[];
  run(ally,{level:1,enemies:[enemy,far]});
  for(let i=0;i<34;i++)run(ally,{level:1,enemies:[enemy,far],hit:(target,damage)=>hits.push({target,damage})});
  assert.ok(hits.length>=1);
  assert.ok(hits.every(({target})=>target===enemy));
  assert.ok(hits.length<=4,"single attack per cooldown, no frame-rate burst");
  const oldX=ally.snapshot().position[0];
  for(let i=0;i<15;i++)run(ally,{level:1,enemies:[far],dt:.1});
  assert.ok(ally.snapshot().position[0]<=oldX+35,"leashes back toward courier");
});
test("雙狼各吸四隻小怪，Boss 絕不轉移，也不能覆蓋既有混亂",()=>{
  const ally=boot().create({species:"hound",random:()=>0}),player=loc(0);
  const enemies=Array.from({length:14},(_,i)=>mob(45+i*7,0));
  const boss=mob(65,0,"boss");
  const confused=mob(42,20);
  confused.confusedT=1;
  run(ally,{player,enemies:[boss,confused,...enemies]});
  assert.equal(ally.snapshot().aggroCount,8);
  assert.deepEqual(Array.from(ally.snapshot().wolves,w=>w.aggroCount),[4,4]);
  assert.equal(ally.targetForEnemy(boss,player),player);
  assert.equal(ally.targetForEnemy(confused,player),player);
  const diverted=enemies.filter(e=>ally.targetForEnemy(e,player)!==player);
  assert.equal(diverted.length,8);
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
  assert.equal(ally.snapshot().hp,35);
  assert.equal(ally.receiveEnemyAttack(enemy,25,callback),true);
  assert.equal(ally.snapshot().hp,35);
  run(ally,{level:1,dt:.41,enemies:[enemy]});
  assert.equal(ally.receiveEnemyAttack(enemy,35,callback),true);
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
  assert.deepEqual(Array.from(ally.snapshot().wolves,w=>w.hp),[300,284]);
  assert.equal(ally.receiveEnemyAttack(boss,20,null,{projectile:true}),false);
});
test("可攻擊 Boss 但不會嘲諷 Boss，也不穿透護盾或無敵",()=>{
  const ally=boot().create({random:()=>0}),boss=mob(70,0,"boss"),hits=[];
  run(ally,{enemies:[boss]});
  for(let i=0;i<30;i++)run(ally,{enemies:[boss],hit:(e,amount)=>hits.push({e,amount})});
  assert.ok(hits.length>=1);
  assert.ok(hits.every(({e,amount})=>e===boss&&amount===2.25));
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
  run(ally,{dt:.25,enemies:[enemy]});
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
  for(let i=0;i<14;i++)run(comp,{level:1,dt:1,onEvent:x=>events.push(x)});
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
test("公開 HTML 載入八關與式神，融合維持本機門禁",()=>{
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
  assert.doesNotMatch(writes.join(" "),/fusion\.js/);
  for(const name of ["kyoto-procession","kyoto-scene-art","snow-temple-combat","snow-temple-art","late-stage-art","late-stage-combat"]) assert.ok(writes.join(" ").includes(name+".js"),name);
  assert.ok(!fs.readFileSync("js/game-catalog.js","utf8").includes("shikigami:"));
});

test("掉幀時式神不穿薄牆、不隔牆打怪，也不補打多次",()=>{
  const ally=boot().create(),enemy=mob(40,28),hits=[];
  const blocked=(x,y,r)=>Math.abs(x-5)<r+2;
  run(ally,{level:1});
  run(ally,{level:1,dt:2,enemies:[enemy],blocked,hit:e=>hits.push(e)});
  assert.ok(ally.snapshot().position[0]<5);
  assert.equal(hits.length,0);
  run(ally,{level:1,dt:3,enemies:[enemy],hit:e=>hits.push(e)});
  assert.equal(hits.length,1);
});

test("缺少式神 raster 不繪畫，提供真圖時才使用世界腳點",()=>{
  const ally=boot().create(),painted=[];
  run(ally,{level:1});
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
  assert.equal(paths.filter(path=>path.includes("__hound-")).length,9);
  assert.equal(paths.length,15);
  assert.equal(wolf.hound.path,skill.ART_PATHS.hound);
  assert.equal(skill.CARD_ART_PATH,"assets/img/skills/shikigami/cards/shikigami__card.webp");
  assert.ok(fs.existsSync(skill.CARD_ART_PATH));
  assert.equal(wolf.whiteBite.length,4);
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
  assert.equal(drawn.at(-1)[2],-105);
  assert.equal(drawn.at(-1)[3],168);
  run(hound,{player:loc(120)});
  hound.paint(ctx,wolf);
  assert.ok(wolf.run.includes(drawn.at(-1)[0]));
  paths.length=0;
  skill.loadArt("fox");
  assert.deepEqual(paths,[skill.ART_PATHS.fox,skill.ART_PATHS.attack,skill.ART_PATHS.vanish]);
});

test("式神火彈不穿牆，過期召喚的火彈不會改打下一隻",()=>{
  const skill=boot(),ally=skill.create({random:()=>0}),shooter=mob(-125,28);
  const blocked=(x,_y,r)=>Math.abs(x+82)<r+2;
  run(ally,{enemies:[shooter],blocked});
  const target=ally.body();
  const bullet={x:0,y:28,target,shooter};
  assert.equal(ally.stepProjectile(bullet,{x:-125,y:28},blocked),true);
  assert.equal(ally.snapshot().hp,300);
  assert.equal(ally.stepProjectile({x:-98,y:28,target,shooter},{x:-125,y:28}),false);
  ally.reset();
  run(ally);
  assert.equal(ally.stepProjectile(bullet,{x:-125,y:28}),true);
  assert.equal(ally.snapshot().hp,300);
});
