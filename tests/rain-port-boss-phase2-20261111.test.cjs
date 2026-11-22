'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const AI=require('../js/boss-ai.js');
const {loadGame}=require('./helpers/game-runtime.cjs');

const port=(index=3,half=false)=>({
  x:0,y:0,type:'boss',hp:half?600:1400,max:1400,
  stageId:'rain-port',bossTheme:'harbor',bossIndex:index,
  final:index===3,gatekeeper:index===2,shield:false,attackCd:0
});
const player=(x=220,y=0)=>({x,y});
const run=(e,p,seconds,dt=.01)=>{
  const out=[];
  for(let left=seconds;left>0;){
    const frame=Math.min(dt,left);
    out.push(AI.step(e,p,frame,{stageId:'rain-port',blocked:()=>false}));
    left-=frame;
  }
  return out;
};

test('second-stage leaders use water-control attacks instead of Stage 1 slam/charge/ring',()=>{
  const all=new Set();
  for(let index=0;index<4;index++){
    const e=port(index,index===3);
    for(let turn=0;turn<8;turn++){
      assert.ok(AI.start(e,player(),{stageId:'rain-port'}));
      all.add(e.hazard.kind);
      assert.ok(['rainVortex','tidalFan','tide'].includes(e.hazard.kind));
      delete e.hazard;
    }
  }
  assert.ok(all.has('rainVortex')&&all.has('tidalFan')&&all.has('tide'));
  const town={...port(1),stageId:'night-town',bossTheme:'town'};
  AI.start(town,player(),{stageId:'night-town'});
  assert.equal(town.hazard.kind,'slam');
});

test('vortices lock the player snapshot and flank lanes, with five targets for the final boss',()=>{
  const e=port(0), p=player(260,80);
  AI.start(e,p,{stageId:'rain-port'});
  assert.equal(e.hazard.kind,'rainVortex');
  assert.equal(e.hazard.vortexes.length,3);
  assert.deepEqual([e.hazard.vortexes[0].x,e.hazard.vortexes[0].y],[260,80]);
  assert.ok(Math.hypot(e.hazard.vortexes[1].x-260,e.hazard.vortexes[1].y-80)>100);
  p.x+=300;p.y-=80;
  assert.deepEqual([e.hazard.vortexes[0].x,e.hazard.vortexes[0].y],[260,80],
    'warnings never track or teleport onto a moving player');
  const final=port(3), bossPlayer=player(210,0);
  AI.start(final,bossPlayer,{stageId:'rain-port'});
  assert.equal(final.hazard.kind,'rainVortex');
  assert.equal(final.hazard.vortexes.length,5);
});

test('tidal fan visibly reverses after a second warning and can hit once per sweep',()=>{
  const e=port(2),p=player(180,0);
  AI.start(e,p,{stageId:'rain-port'});
  assert.equal(e.hazard.kind,'tidalFan');
  const seen=new Set();
  const hits=[];
  for(let i=0;i<240;i++){
    const outcome=AI.step(e,p,.01,{stageId:'rain-port',blocked:()=>false});
    if(outcome.hit)hits.push(outcome.hit.kind);
    seen.add(e.hazard?.sweepPass+':'+e.hazard?.phase);
  }
  assert.ok(seen.has('2:telegraph'));
  assert.ok(seen.has('2:active'));
  assert.equal(hits.length,2);
  assert.deepEqual(hits,['tidalFan','tidalFan']);
  assert.equal(e.hazard.phase,'recovery');
});

test('double fan hits at 20 FPS without extra damage at low frame rates',()=>{
  for(const dt of [.05,.10]){
    const e=port(2),p=player(185,0);
    AI.start(e,p,{stageId:'rain-port'});
    const hits=run(e,p,2.3,dt).filter(x=>x.hit?.kind==='tidalFan');
    assert.equal(hits.length,2,'fan sweep mismatch at dt '+dt);
  }
});

test('rain-port tidal fan doubles actual reach, keeps the rear safe, and hits correctly at 20 FPS',()=>{
  const gate=port(2),p=player(490,0);
  AI.start(gate,p,{stageId:'rain-port'});
  assert.equal(gate.hazard.kind,'tidalFan');
  assert.equal(gate.hazard.r+30,510,'normal reach 255 -> 510');
  assert.ok(gate.hazard.duration>=1,'expanded fan needs readable warning');
  assert.ok(Math.abs(gate.hazard.endAngle-gate.hazard.startAngle-2*Math.PI/3)<1e-9);
  assert.equal(run(gate,p,2.5,.05).filter(x=>x.hit?.kind==='tidalFan').length,2,
    'expanded outer edge must actually hit twice at 20 FPS');

  const final=port(3,true),finalEdge=player(530,0);
  AI.start(final,finalEdge,{stageId:'rain-port'});
  assert.equal(final.hazard.kind,'tidalFan');
  assert.equal(final.hazard.r+30,550,'final reach 275 -> 550');
  assert.equal(run(final,finalEdge,2.5,.05).filter(x=>x.hit?.kind==='tidalFan').length,2);

  const outside=port(2),far=player(550,0);
  AI.start(outside,far,{stageId:'rain-port'});
  assert.equal(run(outside,far,2.5,.05).filter(x=>x.hit).length,0,
    'no invisible damage beyond the new 510px edge');

  const rear=port(2),escaping=player(490,0);
  AI.start(rear,escaping,{stageId:'rain-port'});
  escaping.x=-490;
  assert.equal(run(rear,escaping,2.5,.05).filter(x=>x.hit).length,0,
    'the space behind the Boss remains safe');
});

test('raster renderer paints the larger fan and tall water columns, not only small ripples',()=>{
  const source=fs.readFileSync('js/renderer.js','utf8');
  const start=source.indexOf('  function paintTidalFan(');
  const end=source.indexOf('\n  function paintPortHazardSafety(',start);
  assert.ok(start>0 && end>start);
  const sandbox={window:{VIEWPORT:{tiltScale:()=>0.6}}};
  vm.runInNewContext(source.slice(start,end)
    +'\nthis.paintFan=paintTidalFan;this.paintVortex=paintRainVortex;',sandbox);
  const makeCanvas=()=>{
    const images=[];
    const canvas=new Proxy({drawImage(...args){images.push(args);}},
      {get:(o,k)=>k in o?o[k]:()=>{}});
    return {canvas,images};
  };
  const image={naturalWidth:1254,naturalHeight:1254};
  const fan=makeCanvas();
  sandbox.paintFan(fan.canvas,{image,bbox:[12,164,1247,1118]},{
    kind:'tidalFan',x:0,y:0,angle:0,r:480,startAngle:-Math.PI/3,
    endAngle:Math.PI/3,t:0.25,duration:0.55
  },'active',1,true);
  assert.equal(fan.images.length,2,'painted wave plus bright sweep pass');
  assert.ok(fan.images[0][7]>640,'the raster must scale with 510px reach');
  const vortex=makeCanvas();
  sandbox.paintVortex(vortex.canvas,{image,bbox:[37,39,1226,1227]},{
    kind:'rainVortex',x:0,y:0,phase:'active',t:0.4,duration:1.02,
    vortexes:[{x:0,y:0,r:35,fallProgress:0.5}]
  },'active',1,true);
  assert.ok(vortex.images.length>=3,'ground, column and impact must all be real raster');
  assert.equal(vortex.images[0][6] + vortex.images[0][8] / 2, 0,
    'the floor raster is centered on the collision point');
  assert.ok(vortex.images.some(args=>args[8]>=340),
    'water jet must tower more than 3x above the old ~50px fountain');
  assert.match(source.slice(start,end),/c\.globalAlpha = 1;/,
    'active column should not be drawn as half-transparent');
});

test('missing water art keeps the exact warning and eruption footprints without painting a substitute column',()=>{
  const source=fs.readFileSync('js/renderer.js','utf8');
  const arcs=[],images=[];
  const ctx=new Proxy({arc(...args){arcs.push(args);},drawImage(...args){images.push(args);}},
    {get:(obj,key)=>key in obj?obj[key]:()=>{}});
  let refreshes=0;
  const env={isBossHazardArtEnabled:()=>true,isFusionArtBindEnabled:()=>true,
    BOSS_HAZARD_ART_STATUS:{tidalFan:'loading'},refreshBossHazardArt:()=>{refreshes++;},
    PORT_ART:{ripple:{naturalWidth:128,naturalHeight:128}},matchMedia:()=>({matches:true})};
  env.window=env;
  vm.runInNewContext(source,env);
  env.RENDERER.setDepthStage('rain-port');
  const fan={kind:'tidalFan',phase:'telegraph',x:4,y:5,r:480,startAngle:-Math.PI/3,endAngle:Math.PI/3};
  assert.equal(env.RENDERER.drawBossHazard(ctx,fan),true);
  assert.equal(env.RENDERER.bossHazardPass(),'TECH_SAFETY_ONLY');
  assert.ok(arcs.some(a=>a[0]===4 && a[1]===5 && a[2]===510));
  assert.equal(images.length,0,'small ripple cannot use the dedicated fan source rectangle');
  assert.equal(refreshes,0,'an in-flight request never re-enters the loader per draw');
  env.BOSS_HAZARD_ART_STATUS.tidalFan='error';
  arcs.length=0;
  env.RENDERER.drawBossHazard(ctx,{...fan,phase:'active',sweepReverse:true,t:.25,duration:.5});
  assert.ok(arcs.some(a=>a[2]===510 && a[3]===-Math.PI/12 && a[4]===Math.PI/12),
    'active fallback marks the actual angular sweep, not a growing radius');
  assert.equal(refreshes,1,'a failed request can still use the loader retry cooldown');
  arcs.length=0;
  const vortex={kind:'rainVortex',phase:'active',x:0,y:0,vortexes:[
    {x:77,y:88,r:35,fallProgress:.5},{x:150,y:140,r:32,fallProgress:0},
    {x:200,y:170,r:32,fallProgress:1}
  ]};
  env.RENDERER.drawBossHazard(ctx,vortex);
  assert.ok(arcs.some(a=>a[0]===77 && a[1]===88 && a[2]===55));
  assert.ok(arcs.some(a=>a[0]===150 && a[1]===140 && a[2]===52),'next pillar still has a warning');
  assert.ok(!arcs.some(a=>a[0]===200),'spent pillar stops marking danger');
  assert.equal(images.length,0);
});

test('all five pillars have a readable eruption interval even at 20 FPS',()=>{
  const e=port(3,false),p=player(900,900);
  AI.start(e,p,{stageId:'rain-port'});
  assert.equal(e.hazard.kind,'rainVortex');
  e.hazard.phase='active';
  e.hazard.t=0;
  e.hazard.duration=1.02;
  const visible=Array(e.hazard.vortexes.length).fill(0);
  for(let i=0;i<22;i++){
    AI.step(e,p,.05,{stageId:'rain-port',blocked:()=>false});
    e.hazard?.vortexes?.forEach((v,j)=>{
      if(v.fallProgress>0&&v.fallProgress<1)visible[j]++;
    });
  }
  assert.equal(visible.length,5);
  assert.ok(visible.every(frames=>frames>=4),JSON.stringify(visible));
});

test('whirlpool telegraphs lock their positions, and changing lanes avoids damage',()=>{
  const e=port(0),p=player(250,0);
  AI.start(e,p,{stageId:'rain-port'});
  run(e,p,.25);
  p.x+=340;p.y-=270;
  assert.equal(run(e,p,2.25,.05).filter(x=>x.hit).length,0);
});

test('phase-2 final backwash creates a real staggered water-vortex followup',()=>{
  const e=port(3,true),p=player(180,0);
  AI.start(e,p,{stageId:'rain-port'});
  assert.equal(e.hazard.kind,'tidalFan');
  assert.equal(e.hazard.ultimate,true);
  // The larger fan intentionally grants 0.24s more telegraph time.
  run(e,p,3.15);
  assert.equal(e._harborFollowup,true);
  assert.equal(e.hazard,undefined);
  e.attackCd=0;
  AI.start(e,p,{stageId:'rain-port'});
  assert.equal(e.hazard.kind,'rainVortex');
  assert.equal(e.hazard.vortexes.length,5);
  assert.equal(e._harborFollowup,false);
});

test('port footwork flank-glides only while unshielded and idle; never crosses collision',()=>{
  const e=port(3),p=player(250,0);
  e.attackCd=1.5;
  const moved=AI.footwork(e,p,.12,{blocked:()=>false});
  assert.equal(moved,true);
  assert.ok(e.x>0 && Math.abs(e.y)>0,'boss shifts both toward and sideways');
  const before=[e.x,e.y];
  assert.equal(AI.footwork(e,p,.12,{blocked:()=>true}),false);
  assert.deepEqual([e.x,e.y],before);
  e.shield=true;
  assert.equal(AI.footwork(e,p,.1,{blocked:()=>false}),false);
  e.shield=false;e.hazard={kind:'rainVortex'};
  assert.equal(AI.footwork(e,p,.1,{blocked:()=>false}),false);
  const first={...e,stageId:'night-town',hazard:null};
  assert.equal(AI.footwork(first,p,.1,{blocked:()=>false}),false);
  const slow=port(3),fast=port(3);
  AI.footwork(slow,p,.1,{blocked:()=>false,speed:25});
  AI.footwork(fast,p,.1,{blocked:()=>false,speed:120});
  assert.ok(Math.hypot(slow.x,slow.y)<Math.hypot(fast.x,fast.y),
    'footwork must honor slow/frost movement modifiers');
});

test('sealed/paused, dead, and attack-in-progress rain-port bosses cannot stack new hazards',()=>{
  const e=port(2),p=player();
  e.shield=true;
  assert.equal(AI.start(e,p,{stageId:'rain-port'}),false);
  e.shield=false;AI.start(e,p,{stageId:'rain-port'});
  const h=e.hazard;const before=JSON.stringify(h);
  run(e,p,1,.05); // h changes under ordinary motion; re-evaluate pause
  const saved=JSON.stringify(e.hazard);
  AI.step(e,p,.7,{paused:true,stageId:'rain-port'});
  assert.equal(JSON.stringify(e.hazard),saved);
  assert.equal(AI.start(e,p,{stageId:'rain-port'}),false);
  e.hp=0;
  AI.step(e,p,.1,{stageId:'rain-port'});
  assert.equal(e.hazard,undefined);
  assert.notEqual(before,saved);
});

test('renderer sweep direction and stage2-only size are explicitly wired',()=>{
  const src=fs.readFileSync('js/renderer.js','utf8');
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(src,/h\.sweepReverse \? 1-u : u/);
  assert.match(src,/scale: e\.final \? 0\.67 : 0\.60/);
  assert.match(game,/harborSidestep = window\.BOSS_AI\?\.footwork/);
});

test('rain-port danger alert is drawn above the sanctuary, below HUD, only during warning',()=>{
  const game=fs.readFileSync('js/game.js','utf8');
  const renderer=fs.readFileSync('js/renderer.js','utf8');
  const canopy=game.indexOf('if (!sakuraStage) drawSanctuaryCanopy()');
  const warning=game.indexOf('RENDERER.drawPortBossTelegraphOverlay?.(ctx,h,visualElapsed)');
  const layerEnd=game.indexOf('FX.drawFlash(ctx, viewBounds())');
  assert.ok(canopy>0 && warning>canopy && layerEnd>warning,'warning must outpaint the floral barrier');
  assert.match(renderer,/function drawPortBossTelegraphOverlay\(c, h, elapsed/);
  assert.match(renderer,/c\.shadowColor="#fff0a2"/);
  assert.match(renderer,/outline\(\(\)=>\{c\.beginPath\(\);c\.arc\(v\.x,v\.y,r/);
  assert.match(renderer,/h\?\.phase !== "telegraph"/);
});

test('a tide that can hit beyond the Boss viewport still paints its warning and wave',()=>{
  const g=loadGame({stage:'rain-port'});
  g.start('rain-port');
  const {x,y}=g.snapshot();
  g.env.RENDERER.getCam=()=>({x:x-450,y:y-300});
  const h={kind:'tide',phase:'telegraph',x:x+1500,y,angle:Math.PI/2,
    t:0,duration:1.1,progress:-280,safeOffset:0,safeWidth:130};
  const boss=g.addMob({type:'boss',x:h.x,y:h.y,hazard:h,stageId:'rain-port',bossTheme:'harbor'});
  const draws=[];
  g.env.RENDERER.drawBossHazard=(_ctx,hazard)=>{draws.push(['floor',hazard.phase]);return true;};
  g.env.RENDERER.drawPortBossTelegraphOverlay=()=>draws.push(['edge','telegraph']);
  g.env.RENDERER.drawPortTsunamiCrest=()=>draws.push(['crest','active']);
  g.stepFrame(16.7);
  assert.deepEqual(draws,[['floor','telegraph'],['edge','telegraph']]);
  draws.length=0;
  Object.assign(h,{phase:'active',t:.45,duration:.9,progress:0});
  g.update(.01);
  assert.equal(h.hit,true,'the wave still deals damage across the lateral axis');
  g.stepFrame(16.7);
  assert.equal(boss.hazard,h);
  assert.deepEqual(draws,[['floor','active'],['crest','active']]);
});

test('tsunami crests feather toward the exact safe lane in 2D and tilt',()=>{
  const vm=require('node:vm');
  const src=fs.readFileSync('js/renderer.js','utf8');
  const from=src.indexOf('  function drawPortTsunamiCrest(c,h,upright) {');
  const to=src.indexOf('  function paintTidalFan(',from);
  assert.ok(from>0&&to>from);
  let tilt=1;
  const bank={width:560,height:944};
  const masks=[],images=[],flips=[];
  const maskContext={clearRect(){},resetTransform(){},translate(){},scale(...v){flips.push(v);},
    drawImage(){},fillRect(){assert.equal(this.globalCompositeOperation,'destination-in');},
    createLinearGradient(...coords){
      const stops=[];
      masks.push({coords,stops});
      return {addColorStop(...stop){stops.push(stop);}};
    }};
  const mask={width:520,height:540,getContext:()=>maskContext};
  maskContext.canvas=mask;
  const context={window:{BOSS_HAZARD_ART_IMG:{tide:{naturalWidth:1254,naturalHeight:1254}}},
    currentStageId:()=> 'rain-port',getTideBank:()=>bank,
    document:{createElement:()=>mask}};
  context.window.VIEWPORT={tiltScale:()=>tilt};
  vm.runInNewContext(src.slice(from,to)+';this.drawCrest=drawPortTsunamiCrest;',context);
  const ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},rect(){},scale(...v){flips.push(v);},
    clip(){assert.fail('a hard screen-space clip cuts through the upright foam');},
    drawImage(...args){images.push(args);},globalAlpha:1};
  const hazard={kind:'tide',phase:'active',x:0,y:0,angle:.2,progress:120,
    safeOffset:44,safeWidth:130,t:.5,duration:1};
  for (tilt of [1,.6]) {
    masks.length=images.length=flips.length=0;
    assert.equal(context.drawCrest(ctx,hazard,(_x,_y,draw)=>draw()),true);
    assert.equal(images.length,4,'two banks, two raster crests each');
    assert.equal(flips.filter(([sx,sy])=>sx===-1&&sy===1).length,2);
    assert.ok(images.every(([image,...rect])=>(image===bank||image===mask)&&rect[2]===520&&rect[3]===540));
    assert.ok(masks.length>0);
    const nearRightMask=masks.find(({coords:[,y,,endY]})=>endY>y);
    assert.ok(nearRightMask,'the upright right bank crosses the horizontal lane');
    const {coords:[x,y,endX,endY],stops}=nearRightMask;
    const dx=endX-x,dy=endY-y;
    const edgeY=y-(260-x)*dx/dy;
    const nearRight=hazard.safeOffset+hazard.safeWidth/2+12+260;
    const edgeLateral=nearRight+Math.cos(hazard.angle)*(edgeY-510)/tilt;
    assert.ok(Math.abs(edgeLateral-(hazard.safeOffset+hazard.safeWidth/2))<1e-6);
    assert.equal(stops[0][0],0);
    assert.equal(stops.at(-1)[0],1);
  }
  const ai=fs.readFileSync('js/boss-ai.js','utf8');
  assert.match(ai,/Math\.abs\(forward - curProgress\) <= 60/,
    'tsunami size must never silently enlarge actual ±60 damage footprint');
  hazard.phase='telegraph';
  assert.equal(context.drawCrest(ctx,hazard,(_x,_y,draw)=>draw()),false);
});

test('the tsunami floor wave feathers both cut source edges before drawing matching banks',()=>{
  const vm=require('node:vm');
  const src=fs.readFileSync('js/renderer.js','utf8');
  const start=src.indexOf('  let tideBankSource');
  const end=src.indexOf('  // Rain-port alert safety overlay.',start);
  assert.ok(start>0&&end>start);
  const edges=[],prepared=[];
  const bankCtx={drawImage(...args){prepared.push(args);},fillRect(){
    assert.equal(this.globalCompositeOperation,'destination-in');
  },createLinearGradient:()=>({addColorStop(...args){edges.push(args);}})};
  const bank={getContext:()=>bankCtx};
  const sandbox={document:{createElement:()=>bank}};
  vm.runInNewContext(src.slice(start,end)+';this.paintTide=paintTide;',sandbox);
  const calls=[],flips=[];
  const ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},
    lineTo(){},closePath(){},clip(){},scale(...args){flips.push(args);},
    drawImage(...args){calls.push(args);}};
  sandbox.bossVisibleLateral=()=>[-680,680];
  const image={naturalWidth:1254,naturalHeight:1254};
  const n=sandbox.paintTide(ctx,{image},{x:0,y:0,angle:0,progress:80,safeOffset:0,safeWidth:130});
  assert.equal(n,2,'the two danger banks should take one texture draw each');
  assert.equal(calls.length,2);
  assert.equal(prepared.length,1);
  assert.ok(calls.every(([image])=>image===bank));
  assert.deepEqual(prepared[0].slice(1,5),[0,117,560,944]);
  assert.match(edges[0][1],/transparent/);
  assert.match(edges.at(-1)[1],/transparent/);
  assert.equal(flips.filter(([x,y])=>x===1&&y===-1).length,1);
  assert.equal(calls[0][1],20);
  assert.equal(calls[1][1],20);
});
