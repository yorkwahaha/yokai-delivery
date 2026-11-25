'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {execFileSync} = require('node:child_process');
const Module = require('node:module');

const fixturePath = require.resolve('../tests/helpers/game-runtime.cjs');
const helper = new Module(fixturePath, module);
helper.filename = fixturePath;
helper.paths = module.paths;

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, before);
  return source.replace(before, () => after);
}

const needleDirection = 'const spec = queued.spec, a = queued.angle;';
const needleFocus = `const spec = queued.spec;
      const target = queued.focus && window.GAME_COMBAT_MATH.nearestLaunchTarget(enemies, P, 145);
      const a = target ? Math.atan2(target.y - P.y, target.x - (P.x - Math.cos(P.faceAng || 0) * 16)) : queued.angle;`;
const primaryHit = 'hurt(primary, full);';
const focusShot = 'spec, volley\n            });';
const cooldownNeedle = 'Math.max(0.45, 1.0 - baseRate * 0.1)';
const cooldownBoom = 'isAwakened ? 1.6 : Number((2.0 - level * 0.24).toFixed(2))';

function candidate(mode) {
  if (mode === 'current') return undefined;
  const baseline = Object.fromEntries(['game.js','game-attack-specs.js'].map(file => [
    file, execFileSync('git',['show',`1e59bdd:js/${file}`],{encoding:'utf8'}).replace(/\r\n/g,'\n')
  ]));
  if (mode === 'A') {
    baseline['game-attack-specs.js'] = replaceOnce(baseline['game-attack-specs.js'],cooldownNeedle,
      'Math.max(0.45, 0.85 - baseRate * 0.1)');
    baseline['game-attack-specs.js'] = replaceOnce(baseline['game-attack-specs.js'],cooldownBoom,
      'isAwakened ? 1.45 : Number((2.0 - level * 0.24).toFixed(2))');
  }
  if (['B','Bplus','focused','aligned'].includes(mode)) {
    const bossOnly = mode === 'focused' || mode === 'aligned';
    const queuedFocus = mode === 'aligned' ? 'i === 5 && !spec.hasReturn' : 'i === 5';
    let game = replaceOnce(baseline['game.js'],focusShot,`spec, volley, focus:${queuedFocus}\n            });`);
    const aim = bossOnly ? needleFocus.replace('145);','240);').replace('= target ?', '= target?.type === "boss" ?') : needleFocus;
    if (mode === 'aligned') game = replaceOnce(game,'shootAng = P.faceAng || 0;',`const near = !spec.hasReturn && window.GAME_COMBAT_MATH.nearestLaunchTarget(enemies, P, 240);
          shootAng = near?.type === "boss" ? Math.atan2(near.y - P.y, near.x - P.x) : P.faceAng || 0;`);
    baseline['game.js'] = replaceOnce(game,needleDirection,aim);
    baseline['game.js'] = replaceOnce(baseline['game.js'],primaryHit, mode === 'B'
      ? 'hurt(primary, rank === 5 ? full * 1.25 : full);'
      : mode === 'Bplus' ? 'hurt(primary, rank === 5 && q.focused ? full * 1.55 : full);'
        : 'hurt(primary, rank === 5 && q.focused && primary.type === "boss" ? full * 1.55 : full);');
    if (mode !== 'B') baseline['game.js'] = replaceOnce(baseline['game.js'],'q.stuck = true;',
      'q.stuck = true;\n          q.focused = q.t * q.speed <= 145;');
  }
  return (name, live) => baseline[name] ?? live;
}

let source = readFileSync(fixturePath, 'utf8');
source = replaceOnce(source, ': localRead;', ': (name => options.transform?.(name,localRead(name)) ?? localRead(name));');
const hook = '  currentChoices: () => choices,';
source = replaceOnce(source,hook,hook+`
  phaseBSpec: (id, rank) => resolveAttackSpec(id, rank, getBuildState()),
  phaseBHit: hurtPlayer,
  phaseBSetLevel: value => { level = value; },
  phaseBStopOrders: () => { orderT=Infinity; orders=[]; },
  phaseBPacing: (t, power) => mobPacing(t,power),
  phaseBSkillState: () => ({
    mist:inkTrail.snapshot(WL.ink_trail).clouds,
    nails:sealNail.snapshot(WL.seal_nail).active,
    ally:shikigami?.snapshot()
  }),
  phaseBCharm: (id, value) => { buildCharms.push(id); charmLevels[id] = value; buildRevision++; },
  phaseBStats: () => ({
    speed:getEffectiveMoveSpeed(), mag:getEffectiveMagnetRadius(), dmg:getEffectiveDmg(),
    rate:getEffectiveRate(), reach:getEffectiveReachMultiplier(),
    dash:Math.max(0.6,1.8-b.dash*.38), regen:b.oilRegen, shield:b.shield
  }),
`);
helper._compile(source,fixturePath);
const {loadGame} = helper.exports;
const stages = ['night-town','rain-port','sakura-pass','bamboo-maze'];
const skills = ['katana','barrier','fire','boom','thunder','needle','ink_trail','seal_nail','shikigami'];
const dt = .05;
const round = (n,digits=3) => +n.toFixed(digits);
const hp = 1e5;
const seeds = [117,482,931];
const layouts = [
  {id:'boss-100', distances:[100], type:'boss'},
  {id:'boss-220', distances:[220], type:'boss'},
  {id:'boss-390', distances:[390], type:'boss'},
  {id:'boss-100-side', distances:[100], type:'boss', angle:Math.PI/4},
  {id:'boss-100-rear', distances:[100], type:'boss', angle:Math.PI*5/4},
  {id:'boss-100-moving', distances:[100], type:'boss', targetMoving:true},
  {id:'boss-220-moving', distances:[220], type:'boss', targetMoving:true},
  {id:'boss-390-moving', distances:[390], type:'boss', targetMoving:true},
  {id:'mob-100', distances:[100]},
  {id:'line-3', distances:[100,160,220]},
  {id:'moving-12', distances:Array.from({length:12},(_,i)=>50+i*16), courierMoving:true},
  {id:'pursuit-12', distances:Array.from({length:12},(_,i)=>85+i*12), pursuit:true},
  {id:'wall-moving', distances:[115,205,295], targetMoving:true, courierMoving:true,
    walls:[{x0:65,x1:105,y0:-105,y1:105}]},
  {id:'crowd-80', distances:Array.from({length:80},(_,i)=>70+Math.floor(i/10)*28), ring:true},
  {id:'boss-crowd-80', distances:[100,...Array.from({length:80},(_,i)=>115+Math.floor(i/10)*28)], ring:true}
];
const sharedLayouts = layouts.filter(l => ['boss-100','boss-220','boss-390','line-3','moving-12','pursuit-12','crowd-80'].includes(l.id));
const presets = {
  base: {},
  offense: {picks:{dmg:2,rate:2,crit:2}},
  maxOffense: {picks:{dmg:4,rate:4,crit:3}},
  defense: {picks:{oil_max:2,shield:2,spd:1,mag:1}}
};
const location = {hostname:'127.0.0.1',search:'?dev=1&stageLab=1&shikigami=1'};

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let n = Math.imul(seed ^ (seed >>> 15),seed | 1);
    n ^= n + Math.imul(n ^ (n >>> 7),n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function configure(game, {picks={}, mutations=[]} = {}) {
  for (const [id,count] of Object.entries(picks)) {
    for(let i=0;i<count;i++) game.tune(id).f();
  }
  game.setBuildMutations(mutations);
}

function trial(game, skill, rank, layout, seed, build, seconds=12) {
  game.env.Math.random = rng(seed);
  game.startRun('bamboo-maze');
  const p = game.snapshot();
  let x=p.x, y=p.y;
  game.env.RENDERER.getCam=()=>({x:x-450,y:y-300});
  game.combatScene(skill,layout.distances.map((d,i)=>{
    const a=layout.ring ? i*2.39996323 : layout.angle ?? 0;
    return {dx:d*Math.cos(a)*(layout.pursuit?-1:1),dy:layout.id==='moving-12'||layout.pursuit ? (i%4-1)*37 : d*Math.sin(a),
      hp,max:hp,type:layout.type||(layout.id==='boss-crowd-80' && i===0?'boss':'ghost'),speed:0};
  }),layout.walls||[],rank);
  configure(game,build);
  game.face(0);
  game.armWeapons();
  game.env.Math.random = rng(seed);
  const actors=game.snapshot().enemies;
  const origins=actors.map(e=>({x:e.x,y:e.y}));
  const hitTicks=Array(actors.length).fill(0);
  const last=Array(actors.length).fill(hp);
  let frozen=0,slowed=0,burned=0,confused=0,projectiles=0,deniedSteps=0,fx=0,damageCalls=0,activeGround=0,allySeconds=0;
  const knocked=new Set(), connectedProjectiles=new Set();
  game.env.RENDERER.spawnDamageNumber = () => damageCalls++;
  const startTime=performance.now();
  for(let frame=1;frame<=seconds/dt;frame++) {
    const t=frame*dt, start={x,y};
    if(layout.courierMoving){
      const nx=p.x+frame*225*dt;
      if(!layout.walls || !game.blocked(nx,y)) x=nx;
      else { y+=225*dt; deniedSteps++; }
    }
    if(layout.pursuit){
      x=p.x+220*Math.sin(t*.72);
      y=p.y+150*(1-Math.cos(t*.72));
      if(Math.hypot(x-start.x,y-start.y)>.01) game.face(Math.atan2(y-start.y,x-start.x));
    }
    for(const [i,e] of actors.entries()){
      if(layout.pursuit && !(e.freezeEnds>t)){
        const dx=start.x-e.x,dy=start.y-e.y,d=Math.hypot(dx,dy)||1;
        const stride=Math.min(d, (e.slowT>0?25:130)*dt);
        e.x+=stride*dx/d; e.y+=stride*dy/d;
      }
      if(!layout.targetMoving || (e.freezeEnds||0)>t) continue;
      const ny=origins[i].y+68*Math.sin(t*1.65+i*.4);
      if(!layout.walls || !game.blocked(e.x,ny,e.type==='boss'?52:16)) e.y=ny;
    }
    game.placeAt(x,y);
    game.setElapsed(t);
    game.weapons(dt,{start,end:{x,y}});
    const now=game.snapshot();
    projectiles=Math.max(projectiles,now.needles.length+now.proj.length+now.winds.length+
      now.ghosts.length+now.dragonShots.length);
    for(const needle of now.needles) if(needle.hits?.size)connectedProjectiles.add(needle);
    for(const tag of now.proj) if(tag.stuck)connectedProjectiles.add(tag);
    if(['ink_trail','seal_nail','shikigami'].includes(skill)){
      const details=game.phaseBSkillState();
      activeGround=Math.max(activeGround,details.mist+Number(details.nails));
      allySeconds+=details.ally?.active ? dt : 0;
    }
    fx=Math.max(fx,game.env.FX.stats().particles);
    game.env.FX.update(dt);
    for(const [i,e] of actors.entries()){
      hitTicks[i]+=e.hp<last[i];
      last[i]=e.hp;
      frozen+=(e.freezeEnds||0)>t;
      slowed+=(e.slowT||0)>0 || (e.frostsealSlowEnds||0)>t;
      burned+=e.fireBurnEnds>t;
      confused+=e.confusedT>0;
      if(e.knockQueue?.length)knocked.add(i);
      e.slowT=Math.max(0,(e.slowT||0)-dt);
      e.confusedT=Math.max(0,(e.confusedT||0)-dt);
      e.confuseImmuneT=Math.max(0,(e.confuseImmuneT||0)-dt);
    }
  }
  const ms=performance.now()-startTime;
  const damage=actors.map(e=>hp-e.hp);
  const events={};
  for(const event of game.skillFxLog) {
    if(event.id===skill) events[event.event]=(events[event.event]||0)+1;
  }
  const casts = skill==='needle' ? events.fire || 0
    : skill==='boom' ? game.audioCalls.filter(x=>x==='ofudaLaunch').length : null;
  const launched = skill==='needle' ? (rank===5 ? casts : casts*game.phaseBSpec(skill,rank).count)
    : skill==='boom' ? casts*game.phaseBSpec(skill,rank).count : null;
  const attachments = skill==='boom' ? game.audioCalls.filter(x=>x==='ofudaBurst').length : null;
  return {seed, dps:round(damage.reduce((a,b)=>a+b,0)/seconds),
    firstTargetDps:round(damage[0]/seconds),
    maxTargetDps:round(Math.max(...damage)/seconds), touched:damage.filter(d=>d>0).length,
    targetCount:actors.length, hitTicks:hitTicks.reduce((a,b)=>a+b,0), damageCalls,
    frozenTargetSeconds:round(frozen*dt), slowedTargetSeconds:round(slowed*dt),
    burnedTargetSeconds:round(burned*dt), confusedTargetSeconds:round(confused*dt),
    knockbackTargets:knocked.size, projectiles, activeGround, allySeconds:round(allySeconds),
    fx, launched, connected:connectedProjectiles.size, attachments, deniedSteps, events, vmMs:round(ms)};
}

function runTrial(game,...args){
  game.clearSkillFxLog();
  game.audioCalls.length=0;
  return trial(game,...args);
}

function matrix(mode) {
  const game=loadGame({location,transform:candidate(mode)});
  game.startRun('bamboo-maze');
  // Keep the two A/B skills at the same point in the VM's warm-up sequence.
  const compared=['needle','boom'];
  const ids=mode==='current' ? [...compared,...skills.filter(id=>!compared.includes(id))] : compared;
  const rows=[];
  for(const id of ids) for(let rank=1;rank<=5;rank++) {
    for(const layout of ['needle','boom'].includes(id) ? layouts : sharedLayouts) {
      for(const seed of rank>=4 || mode==='current' ? seeds : seeds.slice(0,1)) {
        rows.push({id,rank,layout:layout.id,build:'base',...runTrial(game,id,rank,layout,seed,presets.base)});
      }
    }
  }
  for(const id of ids) {
    const mutations=Object.entries(game.env.GAME_CATALOG.MUTATION_CONFIG)
      .filter(([,m])=>m.skill===id || m.skillId===id || m.weapon===id)
      .map(([key])=>key);
    const builds={...presets,...Object.fromEntries(mutations.map(m=>[m,{mutations:[m]}]))};
    if(id==='needle') builds.combo={picks:{rate:2,dmg:2},mutations:['mut_seek','mut_pierce']};
    if(id==='boom') builds.combo={picks:{rate:2,dmg:2},mutations:['mut_boom_fan','mut_splitblast']};
    for(const [key,build] of Object.entries(builds)) {
      if(key==='base') continue;
      for(const rank of [4,5]) for(const layout of layouts.filter(l=>['boss-100','boss-220-moving','line-3','pursuit-12','crowd-80'].includes(l.id))) {
        rows.push({id,rank,layout:layout.id,build:key,...runTrial(game,id,rank,layout,117,build)});
      }
    }
  }
  return rows;
}

module.exports = {loadGame,runTrial,candidate,layouts,presets,stages,skills,configure,rng,round,dt,matrix};
if(require.main===module){
  const mode=process.argv[2]||'current';
  assert.ok(['current','original','A','B','Bplus','focused','aligned'].includes(mode));
  process.stdout.write(JSON.stringify({mode,rows:matrix(mode)}));
}
