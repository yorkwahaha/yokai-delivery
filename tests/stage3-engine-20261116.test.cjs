'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CONTENT = require('../js/words.js');
const WORLD = require('../js/world.js');
const DEV = require('../js/dev-mode.js');
const {loadGame} = require('./helpers/game-runtime.cjs');
const loc = (hostname = 'localhost', search = '?dev=1&s3play=1&s3art=1') => ({hostname, search});
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function runtime() {
  const g = loadGame();
  g.env.location = loc();
  g.env.DEV_MODE = DEV;
  g.startRun('sakura-pass');
  return g;
}
const rulesEnv = {window:{}};
vm.runInNewContext(fs.readFileSync('js/game-delivery-rules.js','utf8'),rulesEnv);
const rules = rulesEnv.window.GAME_DELIVERY_RULES;

test('S3 local and LAN gates keep public hosts blocked and DEV progress isolated', () => {
  for (const host of ['localhost','127.0.0.1','::1','192.168.1.22','10.0.0.2','172.16.0.1']) {
    assert.equal(DEV.isSakuraPlaytest(loc(host)),true,host);
    assert.equal(DEV.sessionKey(loc(host)),DEV.DEV_KEY);
  }
  for (const host of ['example.com','192.168.1.22.example.com','192.168.999.2','172.32.0.1']) {
    assert.equal(DEV.isSakuraPlaytest(loc(host)),false,host);
    assert.equal(DEV.sessionKey(loc(host)),DEV.OFFICIAL_KEY);
  }
  assert.equal(DEV.isDevMode(loc('192.168.1.22','?dev=1')),false);
  assert.equal(DEV.isSakuraPlaytest(loc('localhost','?dev=1')),false);
});

test('S3 one-column world has bounded collision, reachable pads, nearby orders and deterministic return', () => {
  for (const spacing of [1,1.2]) {
    const w = WORLD.createStageWorld(CONTENT.getStage('sakura-pass'), CONTENT, {spacingScaleY:spacing});
    const original = JSON.stringify(w.getChunk(1,-3));
    for (let row = -24; row <= 24; row++) {
      const player = {x:1350,y:(row*600+300)*spacing};
      const s = w.update(player.x,player.y);
      assert.equal(s.chunks.length,5);
      assert.equal(s.houses.length,5);
      assert.ok(s.chunks.every(c=>c.cx===1 && c.houses.length===1));
      const pickups = rules.sakuraPickupPool(s.houses,player,distance);
      assert.ok(pickups.length>0);
      for (const h of pickups) {
        assert.ok(distance(h,player)<=900);
        assert.ok(rules.townDestinationPools(s.houses,h,distance).pool.length>0);
      }
      for (const h of s.houses) {
        assert.ok(s.solids.some(solid=>solid.houseId===h.id && solid.y1===h.footY-3));
        for (const p of WORLD.answerPositions(h)) {
          assert.ok(p.x-38>=s.bounds.minX && p.x+38<=s.bounds.maxX);
          assert.ok(!s.solids.some(b=>p.x>b.x0-18 && p.x<b.x1+18 && p.y>b.y0-18 && p.y<b.y1+18));
        }
      }
      assert.ok(w.getCacheSize()<=5);
    }
    assert.equal(JSON.stringify(w.getChunk(1,-3)),original);
    assert.equal(w.getChunk(0,0).houses.length,0);
    const y=731.5;
    assert.equal(WORLD.sakuraPathCenter(y),WORLD.sakuraPathCenter(y*spacing,spacing));
  }
});

test('S3 actual start issues a nearby order, resets on replay, and does not poison S1/S2 bounds', () => {
  const g=runtime();
  let s=g.snapshot();
  assert.equal(s.state,'play');
  assert.equal(s.orders.length,1);
  assert.ok(distance(s.orders[0].from,{x:s.x,y:s.y})<=900);
  assert.notEqual(s.orders[0].from.id,s.orders[0].to.id);
  assert.ok(distance(s.orders[0].from,s.orders[0].to)<=1600);
  g.setWeaponRank('fire',4);
  g.startRun('sakura-pass');
  s=g.snapshot();
  assert.equal(s.elapsed,0);
  assert.equal(s.delivered,0);
  assert.equal(s.enemies.length,0);
  assert.equal(g.combatPhase().selectedWeaponLevels.fire,0);
  g.startRun('rain-port');
  s=g.snapshot();
  assert.ok(s.y>=198 && s.y<=762);
  assert.equal(s.orders.length,1);
  g.startRun('night-town');
  assert.equal(g.snapshot().orders.length,1);
});

test('S3 public start is allowed after release, with normal map unlock enforced separately', () => {
  const g=runtime();
  g.startRun('night-town');
  g.env.location=loc('example.com');
  g.startRun('sakura-pass');
  assert.ok(g.snapshot().orders[0].from.id.startsWith('sakura-pass:'));
});

test('S3 four boss schedule entries retain quiz roles and no boss flags leak on stage switches', () => {
  for (let index=0;index<4;index++) {
    const g=runtime();
    g.setElapsed(CONTENT.getStage('sakura-pass').pacing.bossTimes[index]);
    g.forceBossSchedule(index,0);
    g.update(1/60);
    const boss=g.snapshot().enemies.find(e=>e.type==='boss');
    assert.ok(boss,`boss ${index}`);
    assert.equal(boss.bossIndex,index);
    assert.equal(boss.stageId,'sakura-pass');
    assert.equal(boss.speed,[130,140,150,165][index]);
    assert.equal(boss.bossTheme,'sakura');
    assert.equal(boss.artStatus,'TEMP_FALLBACK');
    assert.equal(boss.final,index===3);
    assert.equal(boss.shield,true);
    assert.equal(boss.gatekeeper,index===2);
    assert.ok(boss.x>=952 && boss.x<=1748);
  }
});

test('S3 normal ordinary population is capped even for direct ambush calls', () => {
  const g=runtime();
  for(let i=0;i<95;i++) g.spawnEnemy(1,200,Math.PI/2,false,true);
  assert.equal(g.snapshot().enemies.length,80);
  assert.ok(g.snapshot().enemies.every(e=>e.artStatus==='TEMP_FALLBACK'));
  const cfg=require('../js/config.js');
  assert.equal(cfg.resolveMobDifficultyProfile(CONTENT.getStage('sakura-pass')),cfg.MOB_DIFFICULTY_PROFILES.sakuraNormal);
  assert.equal(cfg.resolveMobDifficultyProfile(CONTENT.getStage('rain-port')),cfg.MOB_DIFFICULTY_PROFILES.rainPortNormal);
  assert.equal(cfg.resolveMobDifficultyProfile(CONTENT.getStage('night-town')),cfg.MOB_DIFFICULTY_PROFILES.normal);
});

test('S3 rush clips to the mountain wall; root marks keep escape space and pause/death cleanup', () => {
  const AI=require('../js/boss-ai.js');
  const boss={x:1650,y:900,hp:100,max:100,bossIndex:0,stageId:'sakura-pass',bossTheme:'sakura'};
  const blocked=(x,y)=>x+32>1800;
  AI.start(boss,{x:1750,y:900},{stageId:'sakura-pass',blocked});
  assert.equal(boss.hazard.kind,'sakuraRush');
  assert.ok(boss.hazard.length<=118 && boss.hazard.length>0);
  AI.step(boss,{x:1750,y:900},1.01,{stageId:'sakura-pass',blocked});
  AI.step(boss,{x:1750,y:900},.4,{stageId:'sakura-pass',blocked});
  assert.ok(boss.x<=1768);
  const bloom={x:1730,y:900,hp:40,max:100,bossIndex:3,final:true,_sakuraAttackStep:1,stageId:'sakura-pass',bossTheme:'sakura'};
  AI.start(bloom,{x:1600,y:1000},{stageId:'sakura-pass'});
  assert.equal(bloom.hazard.kind,'sakuraBloom');
  assert.ok(bloom.hazard.marks.every(m=>m.x>=994 && m.x<=1706));
  const warning=JSON.stringify(bloom.hazard);
  AI.step(bloom,{x:1600,y:1000},1,{stageId:'sakura-pass',paused:true});
  assert.equal(JSON.stringify(bloom.hazard),warning);
  bloom.hp=0;
  AI.step(bloom,{x:1600,y:1000},.01,{stageId:'sakura-pass'});
  assert.equal(bloom.hazard,undefined);
});

test('S3 map entry still requires the Stage2 clear, even when local review is enabled', () => {
  const env={console,URLSearchParams,location:loc(),DEV_MODE:DEV}; env.window=env;
  vm.createContext(env);
  for(const file of ['delivery-lexicon','words','overworld']) vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),env);
  let cleared=false;
  env.STORE={isStageCompleted:()=>cleared,isStageUnlocked:()=>true};
  const node=env.OVERWORLD.STAGE_NODES.find(n=>n.id==='sakura-pass');
  assert.equal(env.OVERWORLD.isEnterable(node),false);
  cleared=true;
  assert.equal(env.OVERWORLD.isEnterable(node),true);
  env.location=loc('example.com');
  assert.equal(env.OVERWORLD.isEnterable(node),true);
});

test('S3 candidate loader requests all 39 existing Stage3 rasters and keeps missing roles blocked', () => {
  const requests=[], images=[];
  const env={console,URLSearchParams,location:loc(),DEV_MODE:DEV,
    Image:class {constructor(){images.push(this);}set src(v){this.url=v;requests.push(v);} get src(){return this.url;}},
    Audio:class {addEventListener(){}},fetch:async()=>({ok:true,status:200,
      json:async()=>JSON.parse(fs.readFileSync('assets/img/runtime-art-manifest.json','utf8'))})};
  env.window=env; vm.createContext(env);
  vm.runInContext(fs.readFileSync('js/sakura-art-data.js','utf8'),env);
  vm.runInContext(fs.readFileSync('js/assets.js','utf8'),env);
  env.refreshSakuraArt(); env.refreshSakuraScene();
  const stageRequests=requests.filter(p=>p.includes('/sakura-pass/'));
  assert.equal(stageRequests.length,20);
  const characters=requests.filter(p=>p.startsWith('assets/img/enemies/') && /sakura|hanakage|moss-tanuki|stone-lantern-kid|paper-umbrella/.test(p));
  assert.equal(characters.length,16);
  const vfx=requests.filter(p=>p.startsWith('assets/img/vfx/enemies/sakura-tengu/'));
  assert.equal(vfx.length,3);for(const p of vfx)assert.ok(fs.existsSync(p.split('?')[0]),p);
  for(const p of characters) assert.ok(fs.existsSync(p.split('?')[0]),p);
  for(const p of stageRequests) assert.ok(fs.existsSync(p.split('?')[0]),p);
  assert.equal(env.SAKURA_ART_STATUS.stoneStraight,'loading');
  assert.equal(env.SAKURA_ART_STATUS.stoneSparse,'ASSET_PENDING');
  assert.equal(env.SAKURA_ART_STATUS.teaHouse,'loading');
  for(const img of images.filter(i=>stageRequests.includes(i.url) || characters.includes(i.url) || vfx.includes(i.url))){img.naturalWidth=512;img.naturalHeight=512;img.onload();}
  for(const [role,def]of Object.entries({...env.SAKURA_ART_DATA.scene,...env.SAKURA_ART_DATA.forest,...env.SAKURA_ART_DATA.bossVfx}))assert.deepEqual(env.SAKURA_ART[role].sakuraSourceRect,def.rect);
  for(const poses of Object.values(env.SAKURA_ART_DATA.characters))for(const def of Object.values(poses)){
    assert.deepEqual(env.ART[def.key].sakuraFrame,def.frame);assert.equal(env.ART[def.key].sakuraBaseHeight,def.baseHeight);
  }
  const count=requests.length;
  env.refreshSakuraArt(); env.refreshSakuraScene();
  assert.equal(requests.length,count);
  env.location=loc('example.com');
  assert.equal(env.isSakuraCandidateEnabled(),true);
  env.refreshSakuraArt();env.refreshSakuraScene();assert.equal(requests.length,count);
  assert.equal(env.STAGE_ART_RESOLVER.getStageStatus('sakura-pass').status,'PLAYTEST');
});

test('S3 explicit local entry loads both terrain and houses without an extra art flag', () => {
  const requests=[];
  const env={console,URLSearchParams,location:loc('localhost','?dev=1&s3play=1'),DEV_MODE:DEV,
    Image:class{set src(v){requests.push(v);}},Audio:class{addEventListener(){}},
    fetch:async()=>({ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync('assets/img/runtime-art-manifest.json','utf8'))})};
  env.window=env;vm.createContext(env);vm.runInContext(fs.readFileSync('js/sakura-art-data.js','utf8'),env);
  vm.runInContext(fs.readFileSync('js/assets.js','utf8'),env);
  env.refreshSakuraArt();env.refreshSakuraScene();
  assert.ok(requests.some(p=>p.includes('sakura-pass__shrine-pavilion.webp')));
  assert.ok(requests.some(p=>p.includes('sakura-pass__ground-dirt.webp')));
  assert.equal(requests.filter(p=>p.includes('sakura-pass__stone-path-')).length,4);
  env.location=loc('localhost','?dev=1&s3play=1&s3art=0');
  assert.equal(env.isSakuraCandidateEnabled(),false);
});

test('S3 twenty trial word images and Fish A clips route to matching canonical filenames', () => {
  const env={console,URLSearchParams,location:loc('localhost','?dev=1&s3play=1&deliveryArt=1'),DEV_MODE:DEV};
  env.window=env; vm.createContext(env);
  for(const f of ['delivery-lexicon','delivery-media','words','delivery-icon-art']) vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),env);
  const words=env.CONTENT.getStageWords('sakura-pass');
  assert.equal(words.length,20);
  for(let i=0;i<words.length;i++) {
    const w=words[i], num=String(i+1).padStart(2,'0');
    assert.equal(env.DELIVERY_ICON_ART.pathFor(w),'assets/img/delivery/sakura-pass/'+num+'.webp',w.jp);
    assert.equal(env.DELIVERY_MEDIA.pathForWord('audio',w.jp),'assets/audio/delivery/sakura-pass/'+num+'.mp3',w.jp);
  }
  assert.equal(env.DELIVERY_MEDIA.isApproved('image','sakura-pass'),false);
  assert.equal(env.DELIVERY_MEDIA.isTrial('image','sakura-pass'),true);
  assert.notEqual(env.DELIVERY_ICON_ART.pathFor(words[0]),env.DELIVERY_ICON_ART.pathFor(words[1]));
  assert.ok(env.DELIVERY_ICON_ART.pathFor(env.CONTENT.getStageWords('night-town')[0]).startsWith('assets/img/delivery/night-town/'));
});

test('S3 single delivery event records its word, and settlement/replay use the shared hooks', () => {
  // Controlled event test only: no walking, long run or automated completion.
  const g=runtime();
  assert.equal(g.prepareOrder(),true);
  const job=g.snapshot().job;
  g.resolve(job.ans.indexOf(job.word));
  assert.equal(g.snapshot().delivered,1);
  assert.ok(g.store().get(job.word.jp).ok>=1);
  g.setState('won');
  g.stepFrame(16.7);
  assert.equal(g.snapshot().state,'won');
  assert.equal(g.snapshot().runSummary.stageName,'妖櫻山道');
  assert.equal(g.store().isStageCompleted('sakura-pass'),true);
  assert.equal(g.store().isStageUnlocked('bamboo-maze'),true);
  const clears=g.store().getStageStats('sakura-pass').clears;
  g.stepFrame(16.7);
  assert.equal(g.store().getStageStats('sakura-pass').clears,clears,'result is recorded once');
  g.startRun('sakura-pass');
  assert.equal(g.snapshot().runSummary,null);
  assert.equal(g.snapshot().delivered,0);
});

test('S3 live projection round-trips at phone, iPad and desktop sizes without moving world geometry', () => {
  for(const [width,height] of [[844,390],[1024,768],[1366,1024],[1920,1080]]) {
    const env={innerWidth:width,innerHeight:height,location:loc(),URLSearchParams}; env.window=env;
    vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),env);
    const v=env.VIEWPORT;
    const w=WORLD.createStageWorld(CONTENT.getStage('sakura-pass'),CONTENT,{spacingScaleY:v.spacingScaleY()});
    const house=w.getChunk(1,1).houses[0], y=house.y;
    for(const tilt of [1,.6]) {
      v.setTiltScale(tilt);
      const p=v.worldToScreen(house.x,y,{x:900,y:600});
      const q=v.screenToWorld(p.x,p.y,{x:900,y:600});
      assert.ok(Math.abs(q.x-house.x)<1e-6 && Math.abs(q.y-y)<1e-6);
      assert.equal(w.getChunk(1,1).houses[0].y,y);
    }
  }
});

test('S3 renderer paints only candidate ground/buildings, with safe absence and no old town floor', () => {
  const draws=[];
  const gradient={addColorStop(){}};
  const ctx=new Proxy({drawImage:(...args)=>draws.push(args),
    createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:40})},
    {get:(o,k)=>o[k]??(()=>{})});
  const canvas=()=>({width:900,height:600,getContext:()=>ctx});
  const old={naturalWidth:512,naturalHeight:512,src:'old-town'};
  const dirt={naturalWidth:512,naturalHeight:512,src:'s3-dirt'};
  const pavilion={naturalWidth:470,naturalHeight:440,src:'s3-pavilion'};
  const env={innerWidth:1024,innerHeight:768,devicePixelRatio:1,location:loc(),URLSearchParams,
    document:{createElement:canvas},matchMedia:()=>({matches:false,addEventListener(){}}),
    ART:{ground_dirt:old,house_shrine:old},SAKURA_ART:{},WORLD,UI:{readableFont:()=> '20px sans-serif'}};
  env.window=env;vm.createContext(env);
  for(const f of ['viewport','renderer'])vm.runInContext(fs.readFileSync(`js/${f}.js`,'utf8'),env);
  env.RENDERER.init(canvas());env.RENDERER.setDepthStage('sakura-pass');env.RENDERER.setCam(900,600);
  env.RENDERER.drawGround(0,600,[],'ground_dirt','sakura-pass');
  env.SAKURA_ART.dirt=dirt;env.SAKURA_ART.pavilion=pavilion;
  env.RENDERER.drawGround(.1,600,[],'ground_dirt','sakura-pass');
  env.RENDERER.drawHouse({x:1200,y:1000,bType:'shrine_pavilion'},1080);
  assert.ok(draws.some(a=>a[0]===dirt));
  assert.ok(draws.some(a=>a[0]===pavilion));
  assert.ok(!draws.some(a=>a[0]===old));
  const paths=['stoneStraight','stoneLeft','stoneRight','stoneBroken'].map(src=>({naturalWidth:1024,naturalHeight:1536,src}));
  ['stoneStraight','stoneLeft','stoneRight','stoneBroken'].forEach((role,i)=>{env.SAKURA_ART[role]=paths[i];});
  env.RENDERER.invalidateGroundCache();
  env.RENDERER.setCam(900,0);
  env.RENDERER.drawGround(.2,600,[],'ground_dirt','sakura-pass');
  env.RENDERER.setCam(900,2000);
  env.RENDERER.drawGround(.3,600,[],'ground_dirt','sakura-pass');
  const decals=draws.filter(a=>paths.includes(a[0]));
  assert.equal(new Set(decals.map(a=>a[0].src)).size,4);
  for(const a of decals) {
    assert.equal(a[3],440);
    assert.equal(a[4],792);
    assert.ok(Math.abs(a[2]/744-Math.round(a[2]/744))<1e-6,'long strips use one world row per 620 logical Y');
    assert.ok(Math.abs(a[1]+220-WORLD.sakuraPathCenter(a[2]+372,1.2))<1e-6,'only one path column');
  }
  assert.equal(env.RENDERER.drawBossHazard(ctx,{kind:'slam',x:1300,y:900,phase:'telegraph'},0,{}),false);
});
