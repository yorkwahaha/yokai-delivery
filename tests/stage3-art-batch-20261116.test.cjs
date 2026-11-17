'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('assets/img/stages/sakura-pass/manifest.json','utf8'));
const dataEnv={window:{}};vm.runInNewContext(fs.readFileSync('js/sakura-art-data.js','utf8'),dataEnv);
const data=dataEnv.window.SAKURA_ART_DATA;
test('19 original designs produce 27 registered candidate rasters; accepted floor bytes match',()=>{
 const batch=JSON.parse(fs.readFileSync('docs/STAGE3_ART_BATCH_20261116.json','utf8'));
 const inventory=JSON.parse(fs.readFileSync('docs/ASSET_INVENTORY.json','utf8'));
 assert.equal(batch.assets.length,19);assert.equal(batch.runtime_count,27);
 assert.equal(Object.keys(data.scene).length,11);assert.equal(Object.keys(data.characters).length,8);
 assert.equal(manifest.assets.length,39);
 assert.equal(Object.keys(data.bossVfx).length,3);
 assert.equal(Object.keys(data.forest).length,4);
 for(const a of manifest.assets){
  const hash=crypto.createHash('sha256').update(fs.readFileSync(a.path)).digest('hex');
  assert.equal(hash,a.sha256,a.path);
  assert.equal(inventory.files.find(x=>x.path===a.path).sha256,hash);
  if(a.category) assert.equal(a.status,'ART_CANDIDATE_USER_REVIEW_PENDING');
 }
 for(const a of batch.assets)assert.ok(fs.existsSync(a.source));
});
test('all character pairs carry bounded crops, shared scale and fixed foot pivot',()=>{
 for(const poses of Object.values(data.characters)){
  assert.equal(poses.idle.baseHeight,poses.attack.baseHeight);
  for(const a of Object.values(poses)){
   const [x,y,w,h,pivot]=a.frame;
   assert.ok(x>=23 && y>=23 && x+w<=489 && y+h<=489);
   assert.equal(pivot,256);assert.ok(a.baseHeight>=h);
  }
 }
});
function renderer(){
 const draws=[];const ctx=new Proxy({drawImage:(...a)=>draws.push(a),measureText:()=>({width:40})},{get:(o,k)=>o[k]??(()=>{})});
 const canvas=()=>({getContext:()=>ctx});
 const env={console,innerWidth:900,innerHeight:600,devicePixelRatio:1,
  document:{createElement:canvas},matchMedia:()=>({matches:true,addEventListener(){}}),
  location:{hostname:'localhost',search:'?dev=1&s3play=1'},URLSearchParams,
  isSakuraCandidateEnabled:()=>true,ART:{},SAKURA_ART:{},UI:{readableFont:()=> '20px sans-serif'}};
 env.window=env;vm.createContext(env);
 for(const f of ['sakura-art-data','viewport','renderer'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),env);
 for(const poses of Object.values(env.SAKURA_ART_DATA.characters))for(const a of Object.values(poses))env.ART[a.key]={naturalWidth:512,naturalHeight:512,sakuraFrame:a.frame,sakuraBaseHeight:a.baseHeight};
 env.RENDERER.init(canvas());env.RENDERER.setDepthStage('sakura-pass');return {env,draws,ctx};
}
test('real renderer selects all five new enemies, attacks and three boss candidates without replacing S1',()=>{
 const {env,draws}=renderer();
 const mapping={runner:'hanakage-fox',tank:'moss-tanuki',shooter:'stone-lantern-kid',mis:'paper-umbrella-spirit',boss:'sakura-tengu',ghost:'sakura-kodama'};
 for(const [type,id]of Object.entries(mapping)){
  const e={type,x:100,y:100,wob:0};
  env.RENDERER.drawMonster(e,{x:200},0);
  assert.equal(e.sakuraArtId,id);assert.equal(draws.at(-1)[0],env.ART[data.characters[id].idle.key]);
  e.attackT=.2;env.RENDERER.drawMonster(e,{x:200},0);
  assert.equal(draws.at(-1)[0],env.ART[data.characters[id].attack.key]);
 }
 const ghost={type:'ghost',x:0,y:0,wob:4};env.RENDERER.drawMonster(ghost,{x:20},0);
 assert.equal(ghost.sakuraArtId,'paper-umbrella-spirit');ghost.wob=0;env.RENDERER.drawMonster(ghost,{x:20},0);assert.equal(ghost.sakuraArtId,'paper-umbrella-spirit');
 for(const id of ['ancient-sakura-guardian','night-sakura-princess']){
  env.RENDERER.drawMonster({type:'boss',sakuraArtId:id,pose:'attack',x:100,y:100},{x:200},0);
  assert.equal(draws.at(-1)[0],env.ART[data.characters[id].attack.key]);
 }
 env.ART.ghost={naturalWidth:100,naturalHeight:100};env.RENDERER.setDepthStage('night-town');
 env.RENDERER.drawMonster({type:'ghost',x:0,y:0},{x:20},0);assert.equal(draws.at(-1)[0],env.ART.ghost);
});
test('source padding is cropped for building and prop contact with ground',()=>{
 const {env,draws}=renderer();const r=data.scene.pavilion.rect;
 const img={naturalWidth:r.sw+48,naturalHeight:r.sh+48,sakuraSourceRect:r};
 env.SAKURA_ART.pavilion=img;env.RENDERER.drawHouse({x:200,y:300,bType:'shrine_pavilion'},400);
 const draw=draws.find(a=>a[0]===img);assert.deepEqual(Array.from(draw.slice(1,5)),[r.sx,r.sy,r.sw,r.sh]);
 assert.ok(Math.abs(draw[6]+draw[8]-348)<1e-6);
 env.SAKURA_ART.torii=img;env.RENDERER.drawSakuraProp({x:200,y:300,kind:'torii'},400);
 const prop=draws.at(-1);assert.equal(prop[1],24);assert.ok(Math.abs(prop[6]+prop[8]-300)<1e-6);
});

test('monster shadows meet upright sprite feet in 2D and tilt; rain-port specialized shadows retain their offsets',()=>{
 const {env,draws,ctx}=renderer(), shadows=[];
 ctx.ellipse=(...args)=>shadows.push(args);
 for(const tilt of [1,.6]){
  env.VIEWPORT.setTiltScale(tilt);
  for(const type of ['ghost','runner','tank','shooter','mis','boss']){
   const e={type,x:200,y:300,wob:0};
   env.RENDERER.drawMonsterShadow(e);
   env.RENDERER.drawMonster(e,{x:300},0);
   const draw=draws.at(-1), shadow=shadows.at(-1);
   const footScreenY=e.y*tilt+draw[6]+draw[8];
   assert.ok(Math.abs(shadow[1]*tilt-footScreenY)<1e-6,type+' foot/shadow tilt '+tilt);
   assert.equal(shadow[3],shadow[2]*.4,'shadow retains floor-space flattening');
  }
 }
 env.RENDERER.setDepthStage('rain-port');
 for(const e of [{type:'shiome',x:200,y:300},{type:'boss',umibozu:true,x:200,y:300}]){
  env.RENDERER.drawMonsterShadow(e);const shadow=shadows.at(-1);
  assert.equal(shadow[1],e.y+shadow[2]*.85);
 }
});

test('Stage3 building envelopes match ordinary night-town houses in 2D and tilt',()=>{
 const {env,draws}=renderer();
 const roles={shrine_pavilion:'pavilion',s3_tea_house:'teaHouse',s3_mountain_house:'mountainHouse',s3_storehouse:'storehouse',s3_worship_hall:'worshipHall'};
 for(const [role,a]of Object.entries(data.scene))env.SAKURA_ART[role]={naturalWidth:768,naturalHeight:768,sakuraSourceRect:a.rect};
 env.ART.house_shop={naturalWidth:384,naturalHeight:355};
 env.ART.house_shrine={naturalWidth:384,naturalHeight:401};
 env.ART.house_tavern={naturalWidth:384,naturalHeight:385};
 for(const tilt of [1,.6]){
  env.VIEWPORT.setTiltScale(tilt);
  env.RENDERER.setDepthStage('night-town');draws.length=0;
  env.RENDERER.drawHouse({x:200,y:300,bType:'house_shop'},400);
  const firstShop=draws.find(a=>a[0]===env.ART.house_shop);
  env.RENDERER.setDepthStage('sakura-pass');
  for(const [type,role]of Object.entries(roles)){
   draws.length=0;env.RENDERER.drawHouse({x:200,y:300,bType:type},400);
   const draw=draws.find(a=>a[0]===env.SAKURA_ART[role]);
   assert.ok(draw[7]>=firstShop[3]*.88 && draw[7]<=firstShop[3],type+' comparable width');
   assert.ok(draw[8]<=175*(tilt===1?1:1.06)+1e-6,type+' ordinary-house height cap');
   assert.ok(Math.abs(draw[6]+draw[8]-348)<1e-6,type+' fixed contact anchor');
  }
 }
});

test('Stage3 ordinary enemies match S1 visible idle area and keep shared attack scale',()=>{
 const {env,draws}=renderer();
 const dimensions={ghost:[149,208],runner:[227,157],tank:[280,328],shooter:[199,199],mis:[191,331],boss:[253,331]};
 for(const [key,[w,h]]of Object.entries(dimensions))env.ART[key]={naturalWidth:w,naturalHeight:h};
 const pairs=[['ghost','sakura-kodama'],['ghost','paper-umbrella-spirit'],['runner','hanakage-fox'],['tank','moss-tanuki'],['shooter','stone-lantern-kid'],['mis','paper-umbrella-spirit']];
 for(const tilt of [1,.6]){
  env.VIEWPORT.setTiltScale(tilt);
  for(const [type,id]of pairs){
   env.RENDERER.setDepthStage('night-town');draws.length=0;
   env.RENDERER.drawMonster({type,x:100,y:100,wob:0},{x:200},0);
   const first=draws.at(-1),referenceArea=first[7]*first[8];
   env.RENDERER.setDepthStage('sakura-pass');draws.length=0;
   const e={type,sakuraArtId:id,x:100,y:100,wob:0};
   env.RENDERER.drawMonster(e,{x:200},0);const idle=draws.at(-1);
   assert.ok(Math.abs(idle[7]*idle[8]/referenceArea-1)<1e-9,type+' '+id+' visible area');
   e.attackT=.2;env.RENDERER.drawMonster(e,{x:200},0);const attack=draws.at(-1);
   assert.ok(Math.abs(attack[7]/attack[3]-idle[7]/idle[3])<1e-9,id+' same pose scale');
   env.RENDERER.setDepthStage('night-town');env.RENDERER.drawMonster({type,x:100,y:100,wob:0},{x:200},0);
   assert.deepEqual(draws.at(-1),first,'S1 unchanged after Stage3 rendering');
  }
  env.RENDERER.setDepthStage('sakura-pass');
  env.RENDERER.drawMonster({type:'boss',x:100,y:100,wob:0},{x:200},0);
  assert.equal(draws.at(-1)[8],125,'Stage3 Boss size remains separate');
 }
});

test('enlarged Stage3 misdelivery umbrella keeps its word badge above the hat',()=>{
 const {env,draws,ctx}=renderer(),badges=[];
 ctx.roundRect=(...a)=>badges.push(a);
 for(const attackT of [0,.2]){
  const e={type:'mis',x:100,y:200,wob:0,attackT,w:{jp:'はな',zh:'花'}};
  env.RENDERER.drawMonster(e,{x:200},0);
  const sprite=draws.at(-1),badge=badges.at(-1);
  assert.ok(badge[1]+badge[3]<=e.y+sprite[6]-8,'badge clears enlarged hat');
 }
 env.RENDERER.setDepthStage('night-town');env.ART.mis={naturalWidth:191,naturalHeight:331};
 env.RENDERER.drawMonster({type:'mis',x:100,y:200,wob:0,w:{jp:'はな',zh:'花'}},{x:200},0);
 assert.equal(badges.at(-1)[1],92,'S1 keeps its existing badge anchor');
});

test('Stage3 boss hazards draw their dedicated raster art, retain missing-art warnings and show coarse-step impacts',()=>{
 const {env,draws,ctx}=renderer();
 for(const [role,def]of Object.entries(data.bossVfx))env.SAKURA_ART[role]={naturalWidth:768,naturalHeight:768,sakuraSourceRect:def.rect};
 const AI=require('../js/boss-sakura.js');
 for(const turn of [0,1,2]){
  const e={x:1300,y:900,hp:100,max:100,bossIndex:0,_sakuraAttackStep:turn};
  AI.start(e,{x:1470,y:900});
  const before=draws.length;
  assert.equal(env.RENDERER.drawBossHazard(ctx,e.hazard,0,e),true);
  assert.ok(draws.length>before,'new art appears in warning');
  AI.step(e,{x:1470,y:900},e.hazard.duration+.01);
  AI.step(e,{x:1470,y:900},turn===2 ? 1 : .25);
  const active=draws.length;
  assert.equal(env.RENDERER.drawBossHazard(ctx,e.hazard,0,e),true);
  assert.ok(draws.length>active,'active/last crossed impact frame has raster');
 }
 delete env.SAKURA_ART.windBlade;
 assert.equal(env.RENDERER.drawBossHazard(ctx,{kind:'sakuraFan',phase:'telegraph',x:0,y:0,r:17,reach:400,shots:[{angle:0}]},0,{}),true);
 assert.equal(env.RENDERER.bossHazardPass(),'TECH_SAFETY_ONLY');
});

test('boss warning has solid dark/ivory contrast; roots grow 1.5x with a separate earth burst',()=>{
 const {env,draws,ctx}=renderer(),strokes=[],dashes=[];
 ctx.stroke=()=>strokes.push({color:ctx.strokeStyle,width:ctx.lineWidth,blend:ctx.globalCompositeOperation});
 ctx.setLineDash=a=>dashes.push(Array.from(a));
 for(const [role,def]of Object.entries(data.bossVfx))env.SAKURA_ART[role]={naturalWidth:768,naturalHeight:768,sakuraSourceRect:def.rect};
 const AI=require('../js/boss-sakura.js'),e={x:1300,y:900,hp:100,max:100,bossIndex:0,_sakuraAttackStep:2};
 const p={x:1470,y:900};AI.start(e,p);
 env.RENDERER.drawBossHazard(ctx,e.hazard,0,e);
 assert.ok(strokes.some(x=>x.color==='#211018' && x.width===12 && x.blend==='source-over'));
 assert.ok(strokes.some(x=>x.color==='#fff0c7' && x.width===5));
 assert.deepEqual(dashes.at(-1),[],'final warning edges are solid');
 AI.step(e,p,e.hazard.duration+.01);AI.step(e,p,.2);
 draws.length=0;env.RENDERER.drawBossHazard(ctx,e.hazard,0,e);
 assert.equal(e.hazard.r,74,'visual enlargement does not expand damage radius');
 assert.ok(draws.some(a=>a[0]===env.SAKURA_ART.rootBloom && Math.abs(a[7]-249.75)<1e-6));
 assert.ok(draws.some(a=>a[0]===env.SAKURA_ART.earthBreak),'separate real soil/dust image is drawn');
});

test('forest fills both banks deterministically, keeps roots outside the walls and stays isolated from S1/S2',()=>{
 const {env,draws}=renderer(), view={left:-200,right:1100,top:0,bottom:1000};
 const cam={x:900,y:600};
 assert.equal(env.RENDERER.sakuraForestActors(view,cam).length,0,'missing art keeps safe boundary');
 for(const [role,def]of Object.entries(data.forest))env.SAKURA_ART[role]={naturalWidth:768,naturalHeight:768,sakuraSourceRect:def.rect};
 const trees=env.RENDERER.sakuraForestActors(view,cam);
 assert.ok(trees.length>0 && trees.length<100);
 assert.deepEqual(new Set(trees.map(a=>a.forest.role)),new Set(Object.keys(data.forest)));
 assert.ok(new Set(trees.map(a=>Math.round(a.forest.x))).size>15,'vary horizontal positions');
 assert.ok(new Set(trees.map(a=>Math.round(a.forest.width))).size>15,'vary canopy sizes');
 assert.equal(new Set(trees.map(a=>a.forest.flip)).size,2,'vary orientation');
 const left=trees.filter(a=>a.forest.x>700 && a.forest.x<900).sort((a,b)=>a.y-b.y);
 const right=trees.filter(a=>a.forest.x>1800 && a.forest.x<2000).sort((a,b)=>a.y-b.y);
 assert.notDeepEqual(left.map(a=>a.y),right.map(a=>a.y),'banks do not share aligned rows');
 assert.ok(new Set(left.slice(1).map((a,i)=>Math.round(a.y-left[i].y))).size>5,'vary vertical gaps');
 assert.ok(trees.every(a=>a.forest.x<900 || a.forest.x>1800));
 env.RENDERER.sakuraForestActors(view,{x:900,y:2600});
 assert.equal(JSON.stringify(env.RENDERER.sakuraForestActors(view,cam)),JSON.stringify(trees),'returning keeps the same world rows');
 env.RENDERER.drawDecorActor(trees[0],900);
 assert.equal(draws.at(-1)[0],env.SAKURA_ART[trees[0].forest.role]);
 for(const stage of ['night-town','rain-port']){
  env.RENDERER.setDepthStage(stage);assert.equal(env.RENDERER.sakuraForestActors(view,cam).length,0);
 }
});

test('arriving forest images invalidate the cached engineering boundary',()=>{
 const {env}=renderer();
 env.SAKURA_ART.dirt={naturalWidth:512,naturalHeight:512,src:'dirt'};
 env.RENDERER.drawGround(0,600,[],'ground_dirt','sakura-pass');
 const before=env.RENDERER.groundCacheStats().builds;
 for(const role of ['forestLeft','forestRight'])env.SAKURA_ART[role]={naturalWidth:768,naturalHeight:768,src:role};
 env.RENDERER.drawGround(0,600,[],'ground_dirt','sakura-pass');
 assert.equal(env.RENDERER.groundCacheStats().builds,before+1);
 env.RENDERER.drawGround(0,600,[],'ground_dirt','sakura-pass');
 assert.equal(env.RENDERER.groundCacheStats().builds,before+1,'stationary frame reuses cache');
});
