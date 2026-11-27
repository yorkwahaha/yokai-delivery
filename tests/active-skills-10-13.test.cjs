"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("F5 expansion artwork bounds touch card retention and retries a transient manifest fault", async () => {
  const assets = Object.fromEntries(Array.from({length: 20}, (_, i) => ["card"+i,
    {path:"art/skill-expansion-10-13/cards/c"+i+".webp",labUse:true}]));
  assets.fx = {path:"art/skill-expansion-10-13/vfx/fx.webp",labUse:true};
  let manifestRequests=0, imageRequests=0;
  const env = {window:{},navigator:{maxTouchPoints:2},Image:class {
    complete=true; naturalWidth=100;
    set src(path) {imageRequests++;}
  },fetch: async()=> (++manifestRequests===1 ? {ok:false} : {ok:true,json:async()=>({assets})})};
  vm.runInNewContext(fs.readFileSync("js/game-skill-expansion.js","utf8"),env);
  const art=env.window.GAME_SKILL_EXPANSION;
  assert.equal(await art.loadArt(),false);
  assert.equal(art.artReady(),false);
  const request=art.loadArt();
  assert.equal(art.loadArt(),request);
  assert.equal(await request,true);
  const fx=art.artImage("fx");
  for (let i=0;i<20;i++) assert.ok(art.artImage("card"+i));
  assert.equal(art.artImage("fx"),fx);
  assert.equal(art.cardCacheStats().pinned,1);
  assert.equal(art.cardCacheStats().retained,10);
  art.artImage("card19");
  assert.equal(imageRequests,21);
  art.artImage("card0");
  assert.equal(imageRequests,22);
});

function makeFight(api, levels, mutations = [], enemies = [], options = {}) {
  const skills = api.create();
  const player = {x:0, y:0};
  const timing = {};
  const hits = [], events = [];
  const env = {
    player, enemies, levels,
    resolve: id => api.spec(id, levels[id], {mutations, ...options}),
    hit(enemy, damage, critical) { hits.push({enemy, damage, critical}); enemy.hp -= damage; },
    cue(id, event) { events.push([id,event]); },
    running: () => true, blocked: () => false,
    cooldown: (id, remaining, maximum) => { timing[id] = {remaining, maximum}; }
  };
  return {skills, env, hits, events, timing, step(seconds) {
    for (let i = 0; i < Math.round(seconds * 100); i++) skills.tick(.01,env);
  }};
}
const target = (x, y, type = "ghost", hp = 500) => ({x,y,type,hp});

test("projectile specs cover every level and every distinct mutation pair", () => {
  const api = require("../js/game-skill-expansion.js");
  for (const id of ["hamaya", "ice_ball"]) {
    const cards = Object.keys(api.mutations).filter(key => api.mutations[key].skillId === id);
    assert.equal(cards.length,4);
    for (let level = 1; level <= 5; level++) {
      const base = api.spec(id,level);
      for (let i = 0; i < 4; i++) {
        assert.notDeepEqual(api.spec(id,level,{mutations:[cards[i]]}),base);
        for (let j = i + 1; j < 4; j++) {
          const spec = api.spec(id,level,{mutations:[cards[i],cards[j]], damage:2.4, rate:2.25, reach:1.2});
          assert.ok(spec.damage >= base.damage * 2.4);
          assert.ok(spec.cooldown > 0 && spec.cooldown < base.cooldown);
          assert.ok(spec.range >= base.range * 1.2 - 1);
        }
      }
    }
  }
});

test("bow relocks once, bosses take one heavy hit and the follow-up never branches", () => {
  const api = require("../js/game-skill-expansion.js");
  const doomed = target(200,0,"boss");
  const boss = target(365,0,"boss");
  const fight = makeFight(api,{hamaya:5},["mut_hamaya_twin"],[doomed,boss]);
  fight.step(.1);
  doomed.hp = 0;
  fight.step(1.05);
  assert.deepEqual(fight.hits.map(hit => hit.enemy),[boss,boss]);
  assert.ok(Math.abs(fight.hits[0].damage - 12.8 * 1.30 * 1.1) < 1e-8);
  assert.ok(Math.abs(fight.hits[1].damage - 12.8 * .45 * 1.1) < 1e-8);
  assert.equal(fight.events.filter(([,event]) => event === "release").length,2);
});

test("ice bounce hits distinct targets and a lone boss receives bounded impact and shatter", () => {
  const api = require("../js/game-skill-expansion.js");
  const crowd = [target(100,0),target(160,60),target(220,0)];
  const ricochet = makeFight(api,{ice_ball:1},[],crowd);
  ricochet.step(1.3);
  assert.equal(ricochet.hits.length,2);
  assert.equal(new Set(ricochet.hits.map(hit => hit.enemy)).size,2);
  for (const [level, mutations] of [[1,["mut_ice_ball_shards"]],[5,[]]]) {
    const boss = target(115,0,"boss");
    const fight = makeFight(api,{ice_ball:level},mutations,[boss]);
    fight.step(.01);
    assert.equal(fight.skills.visuals().filter(effect=>effect.event==="ball").length,level===5 ? 2 : 1);
    fight.step(1.59);
    assert.equal(fight.hits.length,2);
    assert.ok(fight.hits.every(hit => hit.enemy === boss));
    assert.equal(fight.events.filter(([,event]) => event === "shatter").length,1);
  }
});

test("lost targets, curse cleanup and reset leave no delayed projectile damage", () => {
  const api = require("../js/game-skill-expansion.js");
  const e = target(350,0,"boss");
  const fight = makeFight(api,{hamaya:5, ice_ball:5},[],[e]);
  fight.step(.07);
  fight.skills.suspend();
  fight.env.enemies = [];
  fight.step(2);
  assert.equal(fight.hits.length,0);
  assert.equal(fight.skills.visuals().length,0);
  fight.skills.reset();
  fight.env.enemies = [e];
  fight.step(.02);
  assert.ok(fight.events.some(([,event]) => event === "draw"));
});

test("control skill levels and all mutation pairs have bounded, meaningful effects", () => {
  const api = require("../js/game-skill-expansion.js");
  for (const id of ["spider_silk","wind_hole"]) {
    const cards=Object.keys(api.mutations).filter(key=>api.mutations[key].skillId===id);
    assert.equal(cards.length,4);
    for (let level=1;level<=5;level++) {
      const base=api.spec(id,level);
      for (let i=0;i<4;i++) {
        assert.notDeepEqual(api.spec(id,level,{mutations:[cards[i]]}),base);
        for (let j=i+1;j<4;j++) {
          const spec=api.spec(id,level,{mutations:[cards[i],cards[j]],damage:2.4,rate:99});
          assert.ok(spec.damage>=base.damage*2.4);
          assert.equal(spec.cooldown,id==="spider_silk" ? 3.8 : 4.4);
        }
      }
    }
  }
});

test("silk catches a moving crossing, shares a per-target limit across edges, detaches dead endpoints", () => {
  const api=require("../js/game-skill-expansion.js");
  const a=target(100,-70),b=target(100,70),e=target(156,0);
  const fight=makeFight(api,{spider_silk:1},["mut_spider_silk_bind"],[a,b,e]);
  fight.step(.12);
  assert.ok(Math.abs(fight.skills.slow(a)-.66)<1e-8);
  e.x=56;
  fight.step(.12);
  assert.equal(fight.hits.length,1);
  e.x=100;
  fight.step(1.35);
  assert.equal(fight.hits.filter(hit=>hit.enemy===e).length,2);
  b.hp=0;
  fight.step(.03);
  assert.equal(fight.skills.slow(a),1);
  assert.ok(!fight.skills.visuals().some(fx=>fx.event==="thread"));
});

test("solo silk resolves against a boss once and never slows it", () => {
  const api=require("../js/game-skill-expansion.js");
  const boss=target(125,0,"boss");
  const fight=makeFight(api,{spider_silk:5},["mut_spider_silk_return"],[boss]);
  fight.step(.3);
  assert.equal(fight.skills.slow(boss),1);
  fight.step(1.2);
  assert.equal(fight.hits.length,1);
  assert.ok(Math.abs(fight.hits[0].damage-4.8*.85*(1.75+.55))<1e-8);
});

test("F4 visual poses preserve combat anchors and give solo silk a visible boss overlay", () => {
  const api=require("../js/game-skill-expansion.js");
  const boss=Object.assign(target(140,140,"boss"),{r:50});
  const bow=makeFight(api,{hamaya:5},[],[boss]);
  bow.step(.01);
  const draw=bow.skills.visuals(bow.env.player).find(fx=>fx.event==="draw");
  assert.ok(draw.x>20 && draw.y>15 && draw.depth<bow.env.player.y);
  const silk=makeFight(api,{spider_silk:5},[],[boss]);
  silk.step(.03);
  const bind=silk.skills.visuals().find(fx=>fx.event==="bind");
  assert.equal(bind.x,boss.x);
  assert.equal(bind.y,boss.y);
  assert.ok(!bind.ground && bind.visualWidth>=120 && bind.depth>boss.y+44);
  const ice=makeFight(api,{ice_ball:1},[],[boss]);
  ice.step(.01);
  const ball=ice.skills.visuals().find(fx=>fx.event==="ball");
  assert.equal(ball.spin,ball.angle);
});

test("F4 raster paint normalizes the pre-flattened ground burst and projects air sprites once", async () => {
  const source=fs.readFileSync(path.join(__dirname,"../js/game-skill-expansion.js"),"utf8");
  const root="art/skill-expansion-10-13/vfx/";
  const module={exports:{}};
  const assets={
    "wind_hole:burst":{path:root+"wind-hole__burst__chatgpt.webp",labUse:true},
    "hamaya:arrow":{path:root+"hamaya__arrow__chatgpt.webp",labUse:true}
  };
  class ImageStub {
    complete=true;
    naturalWidth=384;
    naturalHeight=384;
  }
  vm.runInNewContext(source,{module,Image:ImageStub,fetch:async()=>({
    ok:true,json:async()=>({assets})
  })});
  const api=module.exports;
  await api.loadArt();
  const calls=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(...a){calls.push(["translate",...a]);},
    scale(...a){calls.push(["scale",...a]);},rotate(...a){calls.push(["rotate",...a]);},
    drawImage(_art,...a){calls.push(["image",...a]);}};
  api.paint(ctx,{id:"wind_hole",event:"burst",x:0,y:0,radius:100,ground:true},false,null,.6);
  assert.equal(calls.some(c=>c[0]==="scale"),false);
  const burst=calls.find(c=>c[0]==="image");
  assert.equal(burst[3],200);
  assert.ok(Math.abs(burst[4]*194/384-200)<1e-6);
  calls.length=0;
  api.paint(ctx,{id:"hamaya",event:"arrow",x:0,y:0,angle:Math.PI/4},false,null,.6);
  assert.ok(Math.abs(calls.find(c=>c[0]==="scale")[2]-1/.6)<1e-6);
  assert.ok(Math.abs(calls.find(c=>c[0]==="rotate")[1]-Math.atan(.6))<1e-6);
  calls.length=0;
  api.paint(ctx,{id:"hamaya",event:"arrow",x:4000,y:0,angle:0},false,
    {left:-100,right:100,top:-100,bottom:100},.6);
  assert.equal(calls.length,0);
});

test("wind displacement respects boss, freeze, walls, player safety and one secondary field", () => {
  const api=require("../js/game-skill-expansion.js");
  const boss=target(155,0,"boss"), normal=target(78,0), free=target(215,0);
  const frozen=Object.assign(target(240,0),{freezeT:1});
  const immune=Object.assign(target(245,10),{displacementImmune:true});
  const fight=makeFight(api,{wind_hole:5},["mut_wind_hole_twin"],[boss,normal,free,frozen,immune]);
  fight.step(.12);
  const field=fight.skills.visuals().find(fx=>fx.event==="field");
  const barrier=(x,y)=>Math.abs(x-free.x)>2 || Math.abs(y-free.y)>2;
  assert.equal(fight.skills.pull(free,.1,fight.env.player,barrier),false);
  assert.equal(fight.skills.pull(boss,.1,fight.env.player,()=>false),false);
  assert.equal(fight.skills.pull(frozen,.1,fight.env.player,()=>false),false);
  assert.equal(fight.skills.pull(immune,.1,fight.env.player,()=>false),false);
  const previous=Math.hypot(free.x-field.x,free.y-field.y);
  assert.equal(fight.skills.pull(free,.10,fight.env.player,()=>false),true);
  assert.ok(Math.hypot(free.x-field.x,free.y-field.y)<previous);
  fight.step(4.1);
  assert.equal(fight.events.filter(([,event])=>event==="open").length,2);
  assert.equal(fight.events.filter(([,event])=>event==="burst").length,2);
  assert.ok(fight.hits.filter(hit=>hit.enemy===boss).length<=2);
  assert.ok(Math.hypot(normal.x,normal.y)>=78);
});

test("published and private trial eligibility are independent of legacy clear data", () => {
  const official="yokai-delivery-v1", dev="yokai-delivery-dev-v1";
  function load(hostname, search, initial) {
    const data=new Map(Object.entries(initial));
    const env={location:{hostname,search},URLSearchParams,
      localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)}};
    env.window=env;
    vm.createContext(env);
    for (const name of ["dev-mode","game-skill-expansion","store","game-catalog","game-build-rules"])
      vm.runInContext(fs.readFileSync(path.join(__dirname,"../js",name+".js"),"utf8"),env,{filename:name});
    return {env,data};
  }
  const legacy=JSON.stringify({progress:{completed:{"bamboo-maze":true},stages:{"hyakki-kyoto":{clears:1}}}});
  const publicSession=load("example.test","?dev=1&s3play=1&skillLab=expansion",{[official]:legacy});
  const {STORE,GAME_CATALOG,GAME_SKILL_EXPANSION}=publicSession.env;
  assert.equal(STORE.isExpansionSkillQualified("hamaya"),true);
  assert.equal(STORE.isExpansionSkillQualified("spider_silk"),true);
  for (const id of GAME_SKILL_EXPANSION.ids) {
    assert.equal(STORE.isActiveSkillUnlocked(id),["hamaya","spider_silk"].includes(id));
    assert.equal(Object.hasOwn(GAME_CATALOG.WI,id),true);
  }
  assert.equal(publicSession.env.DEV_MODE.isDevMode(publicSession.env.location),false);
  assert.equal(GAME_SKILL_EXPANSION.lab(publicSession.env),false);
  assert.equal(GAME_SKILL_EXPANSION.guidedDraft(publicSession.env),false);
  const trial=load("192.168.50.107","?dev=1&s3play=1&skillLab=expansion",{[official]:legacy,[dev]:legacy});
  assert.equal(trial.env.STORE.isExpansionSkillQualified("hamaya"),false);
  assert.equal(trial.data.get(official),legacy);
  const api=trial.env.GAME_SKILL_EXPANSION, rules=trial.env.GAME_BUILD_RULES, catalog=trial.env.GAME_CATALOG;
  const levels=Object.fromEntries(Object.keys(catalog.WI).map(id=>[id,0]));
  Object.assign(levels,{katana:1,hamaya:5,spider_silk:3,ice_ball:2});
  const {eligibleWeaponKeys}=rules.weaponOfferKeys(catalog.WI,levels,4,0,trial.env,id=>api.ids.includes(id));
  assert.equal(eligibleWeaponKeys.includes("hamaya"),false);
  assert.equal(eligibleWeaponKeys.includes("wind_hole"),false);
  assert.equal(eligibleWeaponKeys.includes("spider_silk"),true);
  assert.equal(rules.canAddMutation("mut_hamaya_quick",["mut_hamaya_twin","mut_hamaya_armor"],catalog.MUTATION_CONFIG,levels,2),false);
  assert.equal(rules.canAddMutation("mut_hamaya_twin",["mut_hamaya_twin"],catalog.MUTATION_CONFIG,levels,2),false);
  assert.equal(rules.canAddMutation("mut_wind_hole_twin",[],catalog.MUTATION_CONFIG,levels,2),false);
  assert.equal(catalog.mutationCardNames("mut_hamaya_twin").subtitle,"破魔・神弓");
  const names=Object.keys(catalog.MUTATION_CONFIG).filter(id=>api.mutations[id]);
  assert.deepEqual(names.map(id=>catalog.MUTATION_CONFIG[id].skillId),[...api.ids].flatMap(id=>Array(4).fill(id)));
});

test("shared build resolver applies charm, passive and critical eligibility per skill", () => {
  const api=require("../js/game-skill-expansion.js");
  const env={};
  env.window=env;
  env.GAME_SKILL_EXPANSION=api;
  vm.createContext(env);
  for (const name of ["game-charm-math","game-combat-math","game-attack-specs"])
    vm.runInContext(fs.readFileSync(path.join(__dirname,"../js",name+".js"),"utf8"),env);
  const math=env.GAME_CHARM_MATH;
  const deps={WL:{}, b:{rate:2,crit:1}, buildMutations:[],
    getEffectiveDmg:()=>math.effectiveDamage(2,2),getEffectiveRate:()=>math.effectiveRate(2,2),
    getEffectiveReachMultiplier:()=>math.effectiveReachMultiplier(2)};
  const resolve=id=>env.GAME_ATTACK_SPECS.resolveAttackSpec(id,5,null,{},deps);
  const bow=resolve("hamaya"), wind=resolve("wind_hole");
  assert.ok(Math.abs(bow.damage-12.8*2.4)<1e-8);
  assert.equal(bow.range,672);
  assert.equal(bow.cooldown,2.2);
  assert.equal(bow.critChance,.20);
  assert.equal(wind.critChance,0);
  assert.equal(wind.radius,182);
  assert.equal(wind.cooldown,5.64);
});

test("cue fallback covers every new event without loading an unprovided recording", () => {
  const api=require("../js/game-skill-expansion.js");
  const sounds=[];
  const audio={impact:tier=>sounds.push(tier),boomerang:()=>sounds.push("sweep"),
    playOptionalCue:()=>assert.fail("no audited recording has been provided")};
  for (const [id,events] of Object.entries({
    hamaya:["draw","release","impact","heavy"],
    spider_silk:["cast","cut","collapse"],
    ice_ball:["cast","impact","shatter"],
    wind_hole:["open","suction","compress","burst"]
  })) for (const event of events) api.playCue(audio,id,event);
  assert.equal(sounds.length,14);
  assert.equal(sounds.filter(s=>s==="heavy").length,4);
  assert.equal(sounds.filter(s=>s==="sweep").length,2);
  assert.doesNotThrow(()=>api.playCue({},"hamaya","release"));
});

test("a crowded cast respects actor, target and secondary-effect caps", () => {
  const api=require("../js/game-skill-expansion.js");
  const crowd=Array.from({length:120},(_,i)=>target(120+(i%12)*16,-75+Math.floor(i/12)*16));
  const levels={hamaya:5,spider_silk:5,ice_ball:5,wind_hole:5};
  const fight=makeFight(api,levels,["mut_hamaya_twin","mut_ice_ball_chain","mut_ice_ball_shards",
    "mut_wind_hole_linger","mut_wind_hole_twin"],crowd,{rate:12});
  for (let frame=0;frame<640;frame++) {
    fight.skills.tick(1/60,fight.env);
    const fx=fight.skills.visuals(fight.env.player);
    const count=(...events)=>fx.filter(effect=>events.includes(effect.event)).length;
    assert.ok(count("arrow","awaken")<=2);
    assert.ok(count("ball")<=2 && count("shard")<=14);
    assert.ok(count("thread")<=3 && count("field")<=1);
    assert.ok(fx.filter(effect=>effect.time).length<=16);
  }
  assert.ok(fight.hits.length>30);
});

test("real game update suspends candidate combat for pause, both reading owners and curse", () => {
  const {loadGame}=require("./helpers/game-runtime.cjs");
  const game=loadGame({location:{hostname:"127.0.0.1",search:"?dev=1&skillLab=expansion"}});
  const begin=()=>{
    game.start();
    game.combatScene("hamaya",[{dx:220,dy:0,speed:0}],[],5);
    game.update(.016);
    assert.ok(game.expansionEffects().some(effect=>effect.event==="draw"));
  };
  begin();
  game.setState("pause");
  game.update(.25);
  assert.ok(game.expansionEffects().some(effect=>effect.event==="draw"));
  game.setState("play");
  game.setCurseSeconds(.016);
  game.update(.016);
  assert.equal(game.expansionEffects().length,0,"curse expiry frame must not restart combat");
  game.update(.016);
  assert.ok(game.expansionEffects().some(effect=>effect.event==="draw"));
  game.prepareBoss();
  game.moveBoss(140);
  game.update(.016);
  assert.equal(game.expansionEffects().length,0,"boss reading stops all queued candidate casts");
  begin();
  assert.ok(game.prepareOrder());
  game.atAnswer();
  game.update(.016);
  assert.equal(game.expansionEffects().length,0,"delivery reading stops all queued candidate casts");
  game.leaveStage();
  assert.equal(game.expansionEffects().length,0);
  game.start();
  assert.equal(game.weaponLevels().hamaya,0);
});
