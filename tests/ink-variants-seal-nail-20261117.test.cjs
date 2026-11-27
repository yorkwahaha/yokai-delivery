"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
function runtime(...scripts){
  const window={location:{hostname:"localhost"}};
  const context=vm.createContext({window,console});
  for(const name of scripts){
    vm.runInContext(fs.readFileSync(path.join(root,"js",name),"utf8"),context,{filename:name});
  }
  return window;
}
const point=(x=0,y=0)=>({x,y});
const enemy=(x,y,type="normal")=>({x,y,r:8,type,hp:10000});

test("舊存檔同時解鎖7、8招時，拒選介紹卡輪替且重新啟動保留順序",()=>{
  const kv=new Map();
  const localStorage={
    get length(){return kv.size;},
    key(i){return [...kv.keys()][i]??null;},
    getItem(k){return kv.get(k)??null;},
    setItem(k,v){kv.set(k,String(v))}
  };
  const boot=()=>{
    const window={location:{search:"",hostname:"localhost"}};
    const ctx=vm.createContext({window,localStorage,Date,Math});
    vm.runInContext(fs.readFileSync(path.join(root,"js/store.js"),"utf8"),ctx);
    return window.STORE;
  };
  let store=boot();
  store.finish("night-town",100,6,true);
  store.finish("rain-port",200,8,true);
  assert.equal(store.isActiveSkillUnlocked("seal_nail"),true);
  assert.equal(store.pendingSkillIntroduction(),"ink_trail");
  store.rotateSkillIntroduction("ink_trail");
  assert.equal(store.pendingSkillIntroduction(),"seal_nail");
  store=boot();
  assert.equal(store.pendingSkillIntroduction(),"seal_nail");
  store.markSkillExperienced("seal_nail");
  store=boot();
  assert.equal(store.pendingSkillIntroduction(),"ink_trail");
  store.markSkillExperienced("ink_trail");
  assert.equal(store.pendingSkillIntroduction(),null);
});

test("第三關 sealTrial 僅在明確 DEV 試招參數啟用，不寫入完成紀錄",()=>{
  const kv=new Map(),localStorage={get length(){return kv.size;},
    key(i){return [...kv.keys()][i]??null;},
    getItem(k){return kv.get(k)??null;},
    setItem(k,v){kv.set(k,String(v));}};
  const window={location:{search:"?dev=1&s3play=1&stage=sakura-pass&sealTrial=1"},
    DEV_MODE:{isDevMode:()=>true,isSakuraPlaytest:()=>true,sessionKey:()=>"yokai-delivery-dev-v1"}};
  const ctx=vm.createContext({window,localStorage,Date,Math});
  vm.runInContext(fs.readFileSync(path.join(root,"js/store.js"),"utf8"),ctx);
  assert.equal(window.STORE.isActiveSkillUnlocked("seal_nail"),true);
  assert.equal(window.STORE.isStageCompleted("rain-port"),false);
  window.location.search="?dev=1&s3play=1&stage=sakura-pass";
  assert.equal(window.STORE.isActiveSkillUnlocked("seal_nail"),false);
  assert.equal(kv.has("yokai-delivery-v1"),false);
});

test("S1 墨跡與 S2 封印釘的解鎖門檻、四槽與 Lv5 規則",()=>{
  const w=runtime("game-catalog.js","game-build-rules.js");
  const levels={katana:1,ink_trail:0,seal_nail:0};
  const host={STORE:{isActiveSkillUnlocked:id=>id==="ink_trail"}};
  const names=w.GAME_BUILD_RULES.weaponOfferKeys(w.GAME_CATALOG.WI,levels,4,0,host).eligibleWeaponKeys;
  assert.ok(names.includes("ink_trail"));
  assert.ok(!names.includes("seal_nail"));
  host.STORE.isActiveSkillUnlocked=()=>true;
  assert.ok(w.GAME_BUILD_RULES.weaponOfferKeys(w.GAME_CATALOG.WI,levels,4,0,host).eligibleWeaponKeys.includes("seal_nail"));
  assert.ok(!w.GAME_BUILD_RULES.weaponOfferKeys(w.GAME_CATALOG.WI,
    {...levels,katana:1,barrier:1,fire:1,boom:1},4,0,host).eligibleWeaponKeys.includes("seal_nail"));
  assert.ok(w.GAME_BUILD_RULES.weaponOfferKeys(w.GAME_CATALOG.WI,
    {...levels,seal_nail:4},4,0,host).eligibleWeaponKeys.includes("seal_nail"));
});

test("墨跡四種變異進入卡池、每招最多兩種",()=>{
  const w=runtime("game-catalog.js","game-build-rules.js");
  const config=w.GAME_CATALOG.MUTATION_CONFIG;
  const ids=["mut_ink_bloom","mut_ink_razor","mut_ink_linger","mut_ink_echo"];
  for(const id of ids){
    assert.equal(config[id].skillId,"ink_trail");
    assert.ok(config[id].inPool);
    assert.ok(w.GAME_BUILD_RULES.canAddMutation(id,[],config,{ink_trail:1},2));
    assert.ok(!w.GAME_BUILD_RULES.canAddMutation(id,[],config,{ink_trail:0},2));
  }
  assert.ok(w.GAME_BUILD_RULES.canAddMutation(ids[1],[ids[0]],config,{ink_trail:2},2));
  assert.ok(!w.GAME_BUILD_RULES.canAddMutation(ids[2],ids.slice(0,2),config,{ink_trail:2},2));
});

test("墨跡變異四種數值各自生效、原版不回歸",()=>{
  const w=runtime("game-ink-trail.js");
  const base=w.GAME_INK_TRAIL.spec(5,2);
  const bloom=w.GAME_INK_TRAIL.spec(5,2,["mut_ink_bloom"]);
  const razor=w.GAME_INK_TRAIL.spec(5,2,["mut_ink_razor"]);
  const linger=w.GAME_INK_TRAIL.spec(5,2,["mut_ink_linger"]);
  assert.equal(base.max,3);
  assert.equal(base.burstTargetCap,7);
  assert.equal(bloom.burstTargetCap,9);
  assert.ok(bloom.burstRadius>base.burstRadius);
  assert.equal(razor.damage,base.damage*1.22);
  assert.equal(razor.slashDamage,base.slashDamage*1.30);
  assert.equal(linger.life,base.life+2.5);
  assert.equal(linger.distance,base.distance*.85);
  assert.equal(base.life,10);
});

test("墨跡餘墨只追擊新進入者，不重擊原目標，不留待到暫停",()=>{
  const w=runtime("game-ink-trail.js");
  const skill=w.GAME_INK_TRAIL.create(),hits=[];
  const a=enemy(55,0),b=enemy(600,0);
  const tick=(dt,start,end,enemies)=>skill.tick({dt,level:1,start,end,enemies,
    mutations:["mut_ink_echo"],effectiveDamage:1,hit:(e,d)=>hits.push({e,d})});
  tick(.7,point(0,0),point(100,0),[]);
  assert.equal(skill.snapshot().marks,1);
  tick(.05,point(100,0),point(100,0),[a]);
  assert.equal(hits.length,1);
  assert.equal(skill.snapshot().echoes,1);
  b.x=55;
  tick(.30,point(100,0),point(100,0),[a,b]);
  assert.equal(hits.length,2);
  assert.equal(hits[1].e,b);
  skill.suspend();
  assert.equal(skill.snapshot().echoes,0);
  assert.equal(skill.snapshot().marks,0);
});

test("封印釘單枚部署、敵人踩中心觸發、玩家離位無效與冷卻",()=>{
  const w=runtime("game-seal-nail.js");
  const nail=w.GAME_SEAL_NAIL.create(),hits=[];
  const e=enemy(100,0);
  const tick=(dt,start,end)=>nail.tick({dt,level:1,start,end,enemies:[e],
    effectiveDamage:1,hit:(_e,d)=>hits.push(d)});
  tick(.1,point(),point());
  assert.equal(nail.snapshot().active,false,'stationary frames cannot spend cooldown');
  assert.equal(nail.snapshot().cooldown,0);
  tick(.1,point(),point(1,0));
  assert.equal(nail.snapshot().active,true);
  tick(.1,point(1,0),point(1,0));
  assert.equal(hits.length,0);
  tick(.1,point(1,0),point(186,0));
  assert.equal(hits.length,0,'player departure does not detonate');
  e.x=37;tick(.1,point(186,0),point(186,0));
  assert.equal(hits.length,0,'outside center');
  e.x=36; e.shield=true;tick(.1,point(186,0),point(186,0));
  assert.equal(hits.length,0,'shielded enemy cannot trigger');
  e.shield=false;tick(.1,point(186,0),point(186,0));
  assert.equal(hits.length,1);
  assert.equal(hits[0],5);
  assert.equal(nail.snapshot().active,false);
  nail.reset();
  assert.equal(nail.snapshot().effects,0);
});

test("封印釘Lv5兩段方向性破封，同目標最多兩次",()=>{
  const w=runtime("game-seal-nail.js");
  const nail=w.GAME_SEAL_NAIL.create(),hits=[];
  const e=enemy(30,0);
  const tick=(dt,start,end)=>nail.tick({dt,level:5,start,end,enemies:[e],
    effectiveDamage:1,hit:(_e,d)=>hits.push(d)});
  tick(.05,point(),point(1,0));
  tick(.05,point(1,0),point(160,0));
  assert.equal(hits.length,1);
  assert.equal(hits[0],14);
  assert.equal(nail.snapshot().pendingSecond,true);
  tick(.25,point(160,0),point(160,0));
  assert.equal(hits.length,2);
  assert.equal(hits[1],8.4);
  tick(.5,point(160,0),point(160,0));
  assert.equal(hits.length,2);
});

test("封印釘兩段都對 Boss 使用 80% 傷害倍率",()=>{
  const w=runtime("game-seal-nail.js");
  const spec=w.GAME_SEAL_NAIL.spec(5);
  assert.equal(spec.bossMultiplier,.80);
  const simulate=type=>{
    const nail=w.GAME_SEAL_NAIL.create(),foe=enemy(30,0,type);
    const hits=[];
    const tick=(dt,start,end)=>nail.tick({dt,level:5,start,end,enemies:[foe],
      effectiveDamage:1,hit:(_e,d)=>hits.push(d)});
    tick(.05,point(),point(1,0));
    tick(.05,point(1,0),point(160,0));
    tick(.25,point(160,0),point(160,0));
    return hits.reduce((a,b)=>a+b,0);
  };
  assert.equal(simulate("normal"),22.4);
  assert.ok(Math.abs(simulate("boss")-22.4*.80)<1e-9);
});
test("試玩封印釘不隨玩家離位引爆、踩踏鎖定方向後依序爆發",()=>{
  const {GAME_SEAL_NAIL}=runtime("game-seal-nail.js");
  const nail=GAME_SEAL_NAIL.create({staged:true});
  const aroundPin=enemy(40,0),towardEast=enemy(250,0),towardWest=enemy(-100,0);
  const hits=[];
  const tick=(dt,start,end)=>nail.tick({dt,level:5,start,end,
    enemies:[aroundPin,towardEast,towardWest],hit:(e,d)=>hits.push([e,d])});
  tick(.05,point(),point(1));
  tick(.05,point(1),point(160));
  assert.equal(nail.snapshot().active,true);
  assert.deepEqual(hits,[]);
  tick(.61,point(160),point(-160));
  assert.deepEqual(hits,[]);
  aroundPin.x=30;
  tick(.06,point(-160),point(-160));
  assert.deepEqual(hits,[[aroundPin,14],[towardWest,14]]);
  assert.equal(nail.snapshot().pendingSecond,true);
  tick(.25,point(-160),point(-160));
  assert.equal(hits.length,2);
  tick(.18,point(-160),point(-160));
  assert.deepEqual(hits.slice(2),[[aroundPin,8.4],[towardEast,8.4]]);
  nail.reset();
  tick(.05,point(),point(1));
  aroundPin.x=40;
  tick(.05,point(1),point(160));
  nail.suspend();
  tick(.8,point(160),point(160));
  assert.equal(hits.length,4);
  assert.equal(nail.snapshot().active,false);
});
test("封印釘讀題中止和重開會清除待爆第二段",()=>{
  const w=runtime("game-seal-nail.js");
  const nail=w.GAME_SEAL_NAIL.create(),hits=[];
  const e=enemy(30,0);
  const opts={level:5,enemies:[e],hit:(e,d)=>hits.push(d)};
  nail.tick({...opts,dt:.1,start:point(),end:point(1,0)});
  nail.tick({...opts,dt:.1,start:point(1,0),end:point(180,0)});
  assert.equal(nail.snapshot().pendingSecond,true);
  nail.suspend();
  nail.tick({...opts,dt:.5,start:point(180,0),end:point(180,0)});
  assert.equal(hits.length,1);
  nail.reset();
  assert.equal(nail.snapshot().pendingSecond,false);
});

test("公開試玩卡與封印釘特效由可讀取的遊戲 WebP 提供",()=>{
  const ui=fs.readFileSync(path.join(root,"js/ui-upgrade-trial.js"),"utf8");
  for(const id of ["mut_ink_bloom","mut_ink_razor","mut_ink_linger","mut_ink_echo"]){
    assert.ok(ui.includes(id));
    const slug=id.replace(/_/g,"-");
    assert.equal(fs.readFileSync(path.join(root,"assets/img/skills",slug,"cards",slug+"__art.webp"))
      .subarray(8,12).toString(),"WEBP");
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"assets/img/skills/skill-art-trial-manifest.json")));
  const seal=manifest.assets.filter(asset=>asset.path.includes("/seal-nail/"));
  assert.equal(seal.length,8);
  for(const {path:file} of seal){
    assert.equal(fs.readFileSync(path.join(root,file)).subarray(8,12).toString(),"WEBP");
  }
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.ok(html.includes("js/game-seal-nail.js"));
});
