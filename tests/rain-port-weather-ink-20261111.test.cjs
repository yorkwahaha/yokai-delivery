'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const read=name=>fs.readFileSync(name,'utf8');
const weatherEnv={window:{}};
vm.runInNewContext(read('js/game-weather.js'),weatherEnv);
const WEATHER=weatherEnv.window.GAME_WEATHER;
const AI=require('../js/boss-ai.js');

test('rain-port cycles medium, light, medium, heavy with smooth bounded transitions',()=>{
  const cycle=WEATHER.createRainCycle();
  assert.equal(cycle.snapshot().level,'medium');
  assert.equal(cycle.snapshot().strength,1);
  const levels=['medium'],times=[];
  let prev='medium';
  for(let t=0;t<155;t+=.1){
    const v=cycle.tick(.1);
    assert.ok(v.strength>=.57-1e-8 && v.strength<=1.8+1e-8);
    if(v.level!==prev){levels.push(v.level);times.push(t);prev=v.level;}
    if(levels.includes('heavy') && v.level==='heavy' && v.phaseAge>3){
      assert.ok(v.strength>1.75);
    }
  }
  assert.deepEqual(levels.slice(0,4),['medium','light','medium','heavy']);
  assert.ok(times[0]>=18.7 && times[0]<19.3);
  const frozen=JSON.stringify(cycle.snapshot());
  cycle.tick(0);cycle.tick(-4);cycle.tick(NaN);
  assert.equal(JSON.stringify(cycle.snapshot()),frozen,'no hidden advancement');
  cycle.reset();
  assert.equal(cycle.snapshot().level,'medium');
  assert.equal(cycle.snapshot().strength,1);
});

test('staggered vortex hitboxes orbit in a small capped circle with visible warnings',()=>{
  const e={x:0,y:0,hp:1400,max:1400,stageId:'rain-port',bossIndex:0,
    bossTheme:'harbor',type:'boss',attackCd:0,shield:false};
  const p={x:260,y:80};
  assert.equal(AI.start(e,p,{stageId:'rain-port'}),true);
  const h=e.hazard;
  assert.equal(h.kind,'rainVortex');
  const anchors=h.vortexes.map(v=>[v.anchorX,v.anchorY]);
  p.x=900;p.y=900;
  AI.step(e,p,.12,{stageId:'rain-port'});
  assert.notDeepEqual([h.vortexes[0].x,h.vortexes[0].y],anchors[0]);
  assert.ok(h.vortexes.every(v=>Math.hypot(v.x-v.anchorX,v.y-v.anchorY)<=16.01));
  const before=JSON.stringify(h.vortexes);
  AI.step(e,p,.8,{paused:true,stageId:'rain-port'});
  assert.equal(JSON.stringify(h.vortexes),before);
  for(let i=0;i<22;i++)AI.step(e,p,.05,{stageId:'rain-port'});
  assert.ok(h.vortexes.every(v=>Math.hypot(v.x-v.anchorX,v.y-v.anchorY)<=16.01));
  assert.ok(['active','recovery'].includes(h.phase));
});

test('Lv5 ink awakening is one gameplay event but layered painted image burst',()=>{
  const ctx={window:{}};
  vm.runInNewContext(read('js/game-ink-trail.js'),ctx);
  const trail=ctx.window.GAME_INK_TRAIL.create();
  const events=[];
  for(let i=0;i<3;i++){
    trail.tick({dt:.6,level:5,start:{x:i*120,y:0},end:{x:(i+1)*120,y:0},
      enemies:[],hit:()=>{},onEvent:e=>events.push(e)});
  }
  assert.equal(events.filter(x=>x==='awaken').length,1);
  assert.equal(events.filter(x=>x==='drop').length,3);
  const painted=[];
  const mock={save(){},restore(){},drawImage(img){painted.push(img.id);},globalAlpha:1};
  trail.paintEnemyImpacts(mock,{slash:{id:'slash',naturalWidth:512},
    burn:{id:'burn',naturalWidth:512}},(_x,_y,paint)=>paint());
  assert.ok(painted.filter(x=>x==='slash').length>=2);
  assert.ok(painted.includes('burn'));
});

test('weather clock continues in victory while frozen dawn stays separate',()=>{
  const game=read('js/game.js');
  assert.match(game,/state === "play" \|\| state === "victory"/);
  assert.match(game,/weatherClock\+=wallDt/);
  assert.match(game,/rainVisualTime=STAGE\.id==="rain-port"\?weatherClock:visualElapsed/);
  assert.match(game,/drawStageWeather\(rainVisualTime,portDrawBounds\)/);
  assert.match(game,/rain \? rainVisualTime : null/);
  assert.match(game,/hazardHit\.damage\*\(heavyWater\?1\.10:1\)/);
  assert.match(game,/e\.type==="boss"\s*\n\s*&& hazardHit/);
});

test('all future rain-port and ink cues are explicit optional silent files',()=>{
  const audio=read('js/audio.js'),game=read('js/game.js');
  for(const event of ['inkTrailDrop','inkTrailHit','inkTrailAwaken',
    'rainPortTideWarn','rainPortTideImpact','rainPortFanWarn','rainPortFanSweep',
    'rainPortVortexWarn','rainPortVortexPillar','rainPortHeavyRain']){
    assert.ok(audio.includes(event+':') || audio.includes(event+'='),event+' missing path');
    assert.ok(game.includes('AUDIO.'+event+'?.()'),event+' missing playback call');
    assert.ok(audio.includes("'"+event+"'"),event+' missing optional-silent entry');
  }
  assert.match(audio,/for \(const key of SILENT_OPTIONAL_SFX\) api\[key\]=\(\)=>\{\}/);
});

test('missing optional recordings fail silently and are fetched at most once',()=>{
  const src=read('js/audio.js');
  const start=src.indexOf('  function playExternalSfx(');
  const end=src.indexOf('\n  // 接單、提示、送達與誤配',start);
  assert.ok(start>=0 && end>start);
  let requests=0,fallbacks=0;
  const ctx={
    muted:false,suspended:false,wordDucking:false,
    SILENT_OPTIONAL_SFX:new Set(['inkTrailAwaken','rainPortVortexPillar']),
    SFX_FILES:{inkTrailAwaken:'missing.mp3',rainPortVortexPillar:'missing2.mp3'},
    SFX_VOLUME:{inkTrailAwaken:.8,rainPortVortexPillar:.7},
    sfxRequests:new Map(),unavailableSfx:new Set(),
    sfxVoices:new Map(),activeSfx:new Set(),
    playBuffer:()=>false,replaceSfx:()=>{},
    window:{audioAsset:path=>path},
    Audio:class {
      constructor(){this.handlers={};this.error={code:2};requests++;}
      addEventListener(name,fn){this.handlers[name]=fn;}
      play(){this.handlers.error?.(new Error('file not found'));return Promise.resolve();}
      pause(){}
    }
  };
  vm.runInNewContext(src.slice(start,end)+'\nthis.play=playExternalSfx;',ctx);
  for(let i=0;i<3;i++){
    ctx.play('inkTrailAwaken',()=>fallbacks++,[]);
    ctx.play('rainPortVortexPillar',()=>fallbacks++,[]);
  }
  assert.equal(requests,2,'missing optional files are not repeatedly fetched');
  assert.equal(fallbacks,0,'no synthesized or substitute sound for absent clips');
  assert.ok(ctx.unavailableSfx.has('inkTrailAwaken'));
  assert.ok(ctx.unavailableSfx.has('rainPortVortexPillar'));
});
