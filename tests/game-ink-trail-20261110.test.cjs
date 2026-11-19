'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const load = (name, ctx) => vm.runInNewContext(fs.readFileSync(name, 'utf8'), ctx, {filename:name});
const core = {window:{}};
load('js/game-ink-trail.js', core);
const trail = core.window.GAME_INK_TRAIL;

function step(instance, level, x1, x2, dt=.8, enemies=[], hit=()=>{}) {
  instance.tick({dt,level,start:{x:x1,y:0},end:{x:x2,y:0},
    dashing:false,enemies,hit,effectiveDamage:1.2});
}

test('five tiers use capped marks and explicit damage without cadence/range/crit scaling', () => {
  const cfg = [1,2,3,4,5].map(n=>trail.spec(n,1.2));
  assert.deepEqual(cfg.map(x=>x.max),[3,3,3,3,3]);
  assert.deepEqual(cfg.map(x=>x.interval),[.65,.6,.56,.52,.5]);
  assert.deepEqual(cfg.map(x=>x.life),[8,8.5,9,9.5,10]);
  assert.deepEqual(cfg.map(x=>x.radius),[70,75,80,84,88]);
  assert.deepEqual(cfg.map(x=>x.distance),[95,90,85,80,78]);
  assert.ok(cfg.every(x=>x.max<=3 && x.life>=8));
  assert.deepEqual(cfg.map(x=>x.factor),[3.0,4.2,5.5,6.9,8.4]);
  assert.deepEqual(cfg.map(x=>x.burstRadius),[105,112,119,126,133]);
  assert.ok(Math.abs(cfg[4].slashDamage-9)<1e-9);
  assert.equal(cfg[4].bossMultiplier,.5);
  assert.equal(cfg[4].slashCooldown,2);
});

test('only real movement leaves at most three marks; dash, standing, reset, suspend clear safely', () => {
  const c=trail.create();
  for(let i=0;i<8;i++)step(c,5,i*120,(i+1)*120);
  assert.equal(c.snapshot().marks,3);
  c.tick({dt:1,level:5,start:{x:960,y:0},end:{x:2000,y:0},
    dashing:true,hit:()=>{throw Error('dash hit');}});
  assert.equal(c.snapshot().marks,3);
  for(let i=0;i<13;i++)step(c,5,2000,2000);
  assert.equal(c.snapshot().marks,0);
  c.reset();
  assert.equal(c.snapshot().effects,0);
  step(c,5,0,120);assert.equal(c.snapshot().marks,1);
  c.suspend();assert.equal(c.snapshot().marks,0);
  step(c,0,120,240);assert.equal(c.snapshot().marks,0);
});

test('ordinary enemy consumes a mark after one contact',()=>{
  const c=trail.create(), e={x:120,y:0,r:6,hp:40,type:'mob'};
  let hits=0;
  step(c,1,0,120);
  step(c,1,120,120,.1,[e],()=>hits++);
  step(c,1,120,120,.1,[e],()=>hits++);
  assert.equal(hits,1);
  assert.equal(c.snapshot().marks,0);
});

test('Lv1 mark now splashes to a nearby three-ghost group',()=>{
  const c=trail.create();
  const mobs=[{x:110,y:0,r:7,hp:2,type:'ghost'},
    {x:140,y:20,r:7,hp:2,type:'ghost'},
    {x:160,y:-20,r:7,hp:2,type:'ghost'},
    {x:400,y:0,r:7,hp:2,type:'ghost'}];
  step(c,1,0,120,.8);
  let hits=0;
  step(c,1,120,120,.05,mobs,(e,d)=>{e.hp-=d;hits++;});
  assert.equal(hits,3);
  assert.ok(mobs.slice(0,3).every(e=>e.hp<=0));
  assert.equal(mobs[3].hp,2);
  assert.equal(c.snapshot().marks,0);
});

test('Boss can receive each point only once and shield is never bypassed',()=>{
  const c=trail.create(), e={x:120,y:0,r:12,hp:200,type:'boss',shield:true};
  let hits=0;
  step(c,1,0,120);
  step(c,1,120,120,.1,[e],()=>hits++);
  assert.equal(hits,0);
  e.shield=false;
  for(let i=0;i<5;i++)step(c,1,120,120,.1,[e],()=>hits++);
  assert.equal(hits,1);
  assert.equal(c.snapshot().marks,1);
});

test('ink burst stays limited to seven nearby enemies',()=>{
  const c=trail.create();
  const mobs=Array.from({length:10},(_,i)=>({x:118+i,y:0,r:7,hp:99,type:'ghost'}));
  step(c,5,0,120,.55);
  let hits=0;
  step(c,5,120,120,.05,mobs,()=>hits++);
  assert.equal(hits,7);
  assert.equal(c.snapshot().marks,0);
});

test('continued running refreshes distant mature marks before natural expiry',()=>{
  const c=trail.create();
  let x=0;
  for(let i=0;i<3;i++){step(c,1,x,x+120,.68);x+=120;}
  const first=JSON.stringify(c.snapshot().positions);
  step(c,1,x,x+120,.68);x+=120;
  assert.equal(c.snapshot().marks,3);
  assert.notEqual(JSON.stringify(c.snapshot().positions),first);
  step(c,1,x,x+120,.68);
  assert.equal(c.snapshot().marks,3);
});

test('Lv5 overlapping linked strokes hit the same target exactly once per activation',()=>{
  const c=trail.create(), e={x:140,y:45,r:8,hp:500,type:'boss'};
  let point=0,slash=0;
  const hit=(_,__,kind)=>{if(kind==='point')point++;else if(kind==='slash')slash++;};
  for(let i=0;i<3;i++)step(c,5,i*120,(i+1)*120,.85,[e],hit);
  assert.ok(point<=3,'one point hit per boss and mark');
  assert.equal(slash,1);
  for(let i=3;i<5;i++)step(c,5,i*120,(i+1)*120,.85,[e],hit);
  assert.equal(slash,1);
  assert.ok(c.snapshot().slashCooldown>0);
});

test('young marks stay in place at the 3-mark cap rather than being replaced instantly',()=>{
  const c=trail.create();
  for(let i=0;i<3;i++)step(c,5,i*120,(i+1)*120,.51);
  const first=c.snapshot().positions;
  assert.equal(first.length,3);
  step(c,5,360,480,.51);
  assert.equal(c.snapshot().marks,3);
  assert.equal(JSON.stringify(c.snapshot().positions),JSON.stringify(first));
  // A capped mark remains available for a pursuer more than 1.5s after deposit.
  const mob={x:first[0][0],y:first[0][1],r:7,hp:20,type:'mob'};
  let hitCount=0;
  step(c,5,480,480,.01,[mob],()=>hitCount++);
  assert.equal(hitCount,1);
});

test('walking leaves a real-route point behind the player and catches pursuers',()=>{
  const c=trail.create(),enemy={x:-120,y:0,r:10,hp:999,type:'mob'};
  let hits=0, px=0;
  for(let i=0;i<140;i++){
    const t=(i+1)*.05, next=t*230;
    enemy.x=-120+t*145;
    c.tick({dt:.05,level:1,start:{x:px,y:0},end:{x:next,y:0},
      enemies:[enemy],hit:()=>hits++});
    px=next;
  }
  assert.ok(hits>=1,'pursuer should trigger a mark during a normal 7s run');
  assert.ok(c.snapshot().marks<=3);
});

test('ink trail backtrack covers the same first stride at 20/30/60 FPS',()=>{
  for (const fps of [20,30,60]) {
    const c=trail.create(),dt=1/fps;
    let x=0;
    for (let i=0;i<fps;i++) {
      const next=x+230*dt;
      c.tick({dt,level:5,start:{x,y:0},end:{x:next,y:0},
        enemies:[],hit:()=>{}});
      x=next;
      if (c.snapshot().marks) break;
    }
    assert.equal(c.snapshot().marks,1,`first mark at ${fps} FPS`);
    const enemy={x:0,y:87,r:0,hp:100,type:'mob'};
    let hits=0;
    c.tick({dt,level:5,start:{x,y:0},end:{x,y:0},
      enemies:[enemy],hit:()=>hits++});
    assert.equal(hits,1,`backtracked capsule reaches initial trail at ${fps} FPS`);
  }
});

test('rapid enemy crossing between frame positions triggers only one eligible point',()=>{
  const c=trail.create(),mob={x:-50,y:0,r:4,hp:40,type:'mob'};
  step(c,1,0,110,.7,[mob]);
  let hits=0;
  step(c,1,110,110,.1,[mob],()=>hits++);
  mob.x=120; // crosses the mark, stops just outside its collision radius
  step(c,1,110,110,.15,[mob],()=>hits++);
  step(c,1,110,110,.15,[mob],()=>hits++);
  assert.equal(hits,1);
});

test('unapproved raster absence never falls back to Canvas primitive graphics',()=>{
  const c=trail.create();
  step(c,5,0,120);
  c.paint({save(){throw Error('primitive fallback');}}, {}, 1);
});

test('local VFX preview loader requests separate painted WebPs, never in public builds',()=>{
  const urls=[];
  class Img{
    naturalWidth=384; naturalHeight=384;
    set src(url){this.url=url;urls.push(url);}
  }
  const env={window:{Image:Img,location:{hostname:'192.168.50.107'}}};
  load('js/game-ink-trail.js',env);
  const art=env.window.GAME_INK_TRAIL.loadCandidateArt();
  assert.deepEqual(urls.map(x=>x.match(/__(dot|impact|fade|slash|burn|footprint)-/)[1]),
    ['dot','impact','fade','slash','burn','footprint']);
  assert.ok(urls.every(x=>x.startsWith('art/skills/ink-trail/')));
  const publicEnv={window:{Image:Img,location:{hostname:'example.com'}}};
  load('js/game-ink-trail.js',publicEnv);
  assert.equal(Object.keys(publicEnv.window.GAME_INK_TRAIL.loadCandidateArt()).length,0);
});

test('moving paints distinct raster mark; expired mark fades using raster image, no geometry',()=>{
  const c=trail.create();
  const images={};
  for(const key of ['dot','impact','fade','slash'])
    images[key]={key,naturalWidth:128,naturalHeight:128};
  const calls=[];
  const ctx={globalAlpha:1, save(){},restore(){},
    drawImage(img){calls.push(img.key);},
    translate(){},rotate(){}};
  step(c,1,0,120,1);
  c.paint(ctx,images);
  assert.ok(calls.includes('dot'));
  step(c,1,120,120,8.1);
  c.paint(ctx,images);
  assert.ok(calls.includes('fade'));
  assert.ok(!calls.includes('slash'));
});

test('three 8-second marks never evict early when player doubles back nearby',()=>{
  const c=trail.create();
  for(let i=0;i<3;i++)step(c,1,i*110,(i+1)*110,.7);
  const initial=JSON.stringify(c.snapshot().positions);
  for(let i=0;i<8;i++)step(c,1,330-(i%2)*100,330-((i+1)%2)*100,.25);
  assert.equal(c.snapshot().marks,3);
  assert.equal(JSON.stringify(c.snapshot().positions),initial);
  const e={x:100,y:30,r:8,hp:100,type:'mob'};
  let count=0;
  step(c,1,230,230,.1,[e],()=>count++);
  assert.equal(count,1,'still useful to approaching mobs after repeated direction changes');
});

test('on-hit purple burn persists on the target sprite above ground layers',()=>{
  const c=trail.create(),e={x:106,y:0,r:8,hp:100,type:'mob'};
  step(c,1,0,120,1);
  step(c,1,120,120,.05,[e]);
  const art={burn:{naturalWidth:128,naturalHeight:128,id:'burn'}};
  const called=[];
  const ctx={globalAlpha:1,save(){},restore(){},drawImage(img){called.push(img.id);}};
  c.paintEnemyImpacts(ctx,art,(_x,_y,paint)=>paint());
  assert.ok(called.includes('burn'),'enemy burn not silently replaced by number only');
  step(c,1,120,120,.60);
  called.length=0;
  c.paintEnemyImpacts(ctx,art,(_x,_y,paint)=>paint());
  assert.equal(called.length,0,'burn fades without becoming a permanent status effect');
});

test('Lv5 three-footprint resonance repeats while the player is moving, not while idle',()=>{
  const c=trail.create(),e={x:170,y:42,r:10,hp:999,type:'boss'};
  let slashes=0;
  const hit=(_e,_d,kind)=>{if(kind==='slash')slashes++;};
  for(let i=0;i<3;i++)step(c,5,i*110,(i+1)*110,.6,[e],hit);
  assert.equal(slashes,1);
  for(let i=0;i<6;i++)step(c,5,330-(i%2)*90,330-((i+1)%2)*90,.5,[e],hit);
  assert.ok(slashes>=2,'Lv5 must activate more often than just once per 10 seconds');
  const before=slashes;
  for(let i=0;i<8;i++)step(c,5,240,240,.25,[e],hit);
  assert.equal(slashes,before,'standing still cannot spam awakenings');
});

test('Lv5 resonance has its own player-visible raster impact even with no enemy hit',()=>{
  const c=trail.create();
  for(let i=0;i<3;i++)step(c,5,i*110,(i+1)*110,.6);
  const drawings=[];
  const img={naturalWidth:850,naturalHeight:283,id:'slash'};
  const ctx={globalAlpha:1,save(){},restore(){},
    drawImage(art,...dims){drawings.push({id:art.id,dims});}};
  c.paintEnemyImpacts(ctx,{slash:img},(_x,_y,draw)=>draw());
  assert.ok(drawings.some(d=>d.id==='slash'&&d.dims[2]>=280),
    'awaken flash must be seen at player even if old traps are behind camera');
});

test('stage-completion entitlement and introduction choice persist without duplicate unlock record',()=>{
  const kv=new Map();
  const storage={get length(){return kv.size;},key(i){return [...kv.keys()][i]??null;},
    getItem(k){return kv.get(k)??null;},setItem(k,v){kv.set(k,String(v));}};
  const boot=()=>{const ctx={window:{location:{search:''}},localStorage:storage,Date,Math};
    load('js/store.js',ctx);return ctx.window.STORE;};
  let store=boot();
  assert.equal(store.pendingSkillIntroduction(),null);
  store.finish('night-town',250,10,true);
  assert.equal(store.isStageCompleted('night-town'),true);
  assert.equal(store.pendingSkillIntroduction(),'ink_trail');
  store.markSkillExperienced('ink_trail');
  store=boot();
  assert.equal(store.pendingSkillIntroduction(),null);
});

test('historical saves with only stage clears still unlock; DEV storage remains isolated',()=>{
  const raw={progress:{unlocked:{'night-town':true},completed:{},stages:{
    'night-town':{bestScore:100,bestDeliveries:7,clears:1,attempts:2}}}};
  const storage=new Map([['yokai-delivery-v1',JSON.stringify(raw)]]);
  const fakeLocal={get length(){return storage.size;},key(i){return [...storage.keys()][i]||null;},
    getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}};
  const loadStore=(dev=false)=>{
    const w={location:{hostname:'localhost',search:dev?'?dev=1':''}};
    if(dev)w.DEV_MODE={sessionKey:()=>'yokai-delivery-dev-v1'};
    const ctx={window:w,localStorage:fakeLocal,Date,Math};
    load('js/store.js',ctx);return ctx.window.STORE;
  };
  assert.equal(loadStore().isStageCompleted('night-town'),false);
  assert.equal(loadStore().isActiveSkillUnlocked('ink_trail'),true);
  assert.equal(loadStore().pendingSkillIntroduction(),'ink_trail');
  assert.equal(loadStore(true).isActiveSkillUnlocked('ink_trail'),false);
});

test('locked skill cannot be offered before official stage-clear; four slots still cap learning',()=>{
  const env={window:{}};
  load('js/game-build-rules.js',env);
  const offers=env.window.GAME_BUILD_RULES.weaponOfferKeys;
  const cat={katana:{},barrier:{},fire:{},boom:{},thunder:{},needle:{},ink_trail:{}};
  const levels={katana:1,barrier:0,fire:0,boom:0,thunder:0,needle:0,ink_trail:0};
  let host={STORE:{isStageCompleted:()=>false}};
  assert.ok(!offers(cat,levels,4,0,host).eligibleWeaponKeys.includes('ink_trail'));
  host={STORE:{isStageCompleted:()=>true}};
  assert.ok(offers(cat,levels,4,0,host).eligibleWeaponKeys.includes('ink_trail'));
  Object.assign(levels,{barrier:1,boom:1,fire:1});
  assert.ok(!offers(cat,levels,4,0,host).eligibleWeaponKeys.includes('ink_trail'));
  assert.ok(offers(cat,levels,4,0,host).eligibleWeaponKeys.includes('katana'));
});

test('two guarantees leave one mixed slot, never split mutation pair',()=>{
  const env={window:{}};load('js/game-upgrade-choices.js',env);
  const fn=env.window.GAME_UPGRADE_CHOICES.withGuarantees;
  const mk=(id,type)=>({id,choiceId:id,type});
  const [intro,upgrade,other,m1,m2]=[
    mk('ink','weapon'),mk('katana','weapon'),mk('passive','passive'),
    mk('mut-needle','mutation'),mk('mut-boom','mutation')];
  const out=fn([m1,m2,other],[intro,upgrade],[other,m1,m2],true);
  assert.equal(JSON.stringify(out.map(x=>x.id)),JSON.stringify(['ink','katana','passive']));
  assert.equal(fn([m1,m2,other],[intro],[m1,m2,other],true).length,3);
});
