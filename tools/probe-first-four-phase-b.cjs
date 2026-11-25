'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {loadGame,stages,skills,round,configure,rng,dt} = require('./measure-first-four-phase-b.cjs');

const benchLocation = {hostname:'127.0.0.1',search:'?dev=1&stageLab=1&shikigami=1'};
const baselineLocation = {hostname:'example.com',search:''};
const archetypes = {
  melee:{early:['katana','barrier','katana'],late:['katana','barrier','katana','barrier','katana','barrier','fire','dmg'],distance:105},
  ranged:{early:['needle','thunder','needle'],late:['needle','thunder','needle','thunder','thunder','needle','thunder','dmg'],distance:235},
  area:{early:['boom','fire','boom'],late:['boom','fire','boom','fire','boom','thunder','boom','dmg'],distance:150},
  defense:{early:['oil_max','shield','katana'],late:['oil_max','shield','katana','barrier','oil_max','katana','dash'],distance:135},
  low:{early:['fire','mag'],late:['fire','mag','katana','barrier','spd','dash'],distance:135}
};

function spawnBoss(game,stage,wave){
  game.startRun(stage);
  game.stopSpawns();
  game.phaseBStopOrders();
  game.setWeaponRank('katana',0);
  const time=game.env.CONTENT.getStage(stage).pacing.bossTimes[wave];
  game.setElapsed(time);
  game.forceBossSchedule(wave);
  for(let i=0;i<120;i++){
    game.update(dt);
    const boss=game.snapshot().enemies.find(e=>e.type==='boss');
    if(boss) return {boss,time};
  }
  throw Error('No scheduled Boss for '+stage+' wave '+wave);
}

function availableLevel(game,stage,time,harvest){
  const xpPerMob=['rain-port','sakura-pass'].includes(stage)?3:2;
  let total=0;
  for(let second=8;second<time;second++){
    const pacing=game.phaseBPacing(second,1+second/30);
    total+=pacing.count/pacing.interval*xpPerMob*harvest;
  }
  total+=26*Math.floor(time/75)+(time>=360?35:0);
  let level=1;
  while(game.xpSpentTotal(level+1)<=total) level++;
  return level;
}

function stageBosses(game,stage){
  return Array.from({length:4},(_,wave)=>{
    const {boss,time}=spawnBoss(game,stage,wave);
    return {time,title:boss.title,hp:boss.max,speed:boss.speed,reward:boss.oilReward||35,
      order:boss.trialBoss?.attacks||null,
      levels:[.11,.24,.37].map(harvest=>availableLevel(game,stage,time,harvest))};
  });
}

function dodgeDirection(h,s,base){
  const dx=s.x-h.x, dy=s.y-h.y;
  const a=h.angle||0, c=Math.cos(a), n=Math.sin(a);
  const side=-dx*n+dy*c, front=dx*c+dy*n;
  if(h.kind==='charge' || h.kind==='sakuraRush') {
    if(Math.abs(side)>(h.r||60)+28) return null;
    return [-n*Math.sign(side||1),c*Math.sign(side||1)];
  }
  if(h.kind==='tide') {
    const error=h.safeOffset-side;
    if(Math.abs(error)<35) return null;
    return [-n*Math.sign(error),c*Math.sign(error)];
  }
  if(h.kind==='tidalFan') {
    if(front<0 || Math.hypot(dx,dy)>(h.r||480)+55 || Math.abs(Math.atan2(side,front))>1.23) return null;
    return [-n*Math.sign(side||1),c*Math.sign(side||1)];
  }
  if(h.kind==='ring') {
    const angle=Math.atan2(dy,dx);
    const error=Math.atan2(Math.sin(h.gapAngle-angle),Math.cos(h.gapAngle-angle));
    if(Math.abs(error)<.45) return null;
    return [-Math.sin(angle)*Math.sign(error),Math.cos(angle)*Math.sign(error)];
  }
  if(h.kind==='rainVortex'){
    const closest=h.vortexes.reduce((a,b)=>Math.hypot(s.x-b.x,s.y-b.y)<Math.hypot(s.x-a.x,s.y-a.y)?b:a);
    const x=s.x-closest.x, y=s.y-closest.y, distance=Math.hypot(x,y);
    if(distance>closest.r+43) return null;
    return distance>1?[x/distance,y/distance]:[-n,c];
  }
  if(h.kind==='sakuraFan'){
    if(front<0 || Math.abs(Math.atan2(side,front))>1.05) return null;
    return [-n*Math.sign(side||1),c*Math.sign(side||1)];
  }
  if(h.kind==='sakuraBloom'){
    const mark=h.marks.find(m=>Math.hypot(s.x-m.x,s.y-m.y)<(h.r||74)+25);
    if(!mark) return null;
    const x=s.x-mark.x, y=s.y-mark.y, distance=Math.hypot(x,y);
    return distance>1?[x/distance,y/distance]:[-n,c];
  }
  if(h.kind==='bambooCut'){
    const z=h.zones.find(m=>Math.abs(s.x-m.x)<=m.rx+16 && Math.abs(s.y-m.y)<=m.ry+16);
    if(!z)return null;
    return z.rx<z.ry?[Math.sign(s.x-z.x||1),0]:[0,Math.sign(s.y-z.y||1)];
  }
  const distance=Math.hypot(dx,dy);
  if(distance>(h.r||145)+25) return null;
  return distance>1?[dx/distance,dy/distance]:base;
}

function playBoss(game,stage,wave,id,seed,policy,earlyOil){
  game.env.Math.random=rng(seed);
  const {boss,time}=spawnBoss(game,stage,wave);
  const {x,y}=game.snapshot();
  const preset=archetypes[id];
  const placements=[0,Math.PI/2,Math.PI,Math.PI*1.5].map(a=>({
    x:x+Math.cos(a)*preset.distance,y:y+Math.sin(a)*preset.distance
  }));
  const placement=placements.find(p=>!game.blocked(p.x,p.y,52));
  assert.ok(placement,stage+' local arena');
  Object.assign(boss,placement);
  const level=availableLevel(game,stage,time,id==='low'?.11:id==='defense'?.17:.24);
  game.phaseBSetLevel(level);
  game.setWeaponRank('katana',1);
  const selected=(wave===0?preset.early:preset.late).slice(0,level-1);
  for(const id of selected){
    if(skills.includes(id))game.setWeaponRank(id,(game.weaponLevels()[id]||0)+1);
    else game.tune(id).f();
  }
  game.armWeapons();
  game.setOil(earlyOil??game.snapshot().maxOil);
  let readSteps=0;
  while(boss.shield && readSteps<60){
    game.update(dt);
    const q=game.snapshot().bossQ;
    if(q?.lock<=0) game.answerBoss(q.ans.indexOf(q.word));
    readSteps++;
  }
  assert.ok(!boss.shield,stage+' real seal break');
  let frames=0, dodgeFrames=0, attacks={}, telegraphSeconds=0, harms=0, oilLost=0, workTime=0;
  let previousHazard=null, previousStrike=null;
  const initial=game.snapshot();
  const oilReward=boss.oilReward||35;
  while(frames<2500 && boss.hp>0 && game.snapshot().state==='play') {
    const s=game.snapshot(), h=boss.hazard;
    const dx=boss.x-s.x,dy=boss.y-s.y,d=Math.hypot(dx,dy)||1;
    const radial=d>preset.distance+32?1:d<preset.distance-32?-1:0;
    let move=[dx/d*radial,dy/d*radial];
    if(h && (h!==previousHazard || h.strike!==previousStrike)) attacks[h.kind]=(attacks[h.kind]||0)+1;
    previousHazard=h;
    previousStrike=h?.strike;
    if(h?.phase==='telegraph') telegraphSeconds+=dt;
    if(policy==='dodge' && h && h.phase!=='recovery'){
      const evasive=dodgeDirection(h,s,[-dy/d,dx/d]);
      if(evasive){ move=evasive; dodgeFrames++; }
    }
    for(const k of game.keyState()) game.tapKey(k,false);
    if(move[0]||move[1])game.pushKeys(move);
    game.setFacingAngle(Math.atan2(dy,dx));
    game.update(dt);
    frames++;
    const after=game.snapshot();
    const battleStep=after.elapsed-s.elapsed;
    workTime+=battleStep;
    const expected=Math.min(s.maxOil,s.oil-(.43-game.bar().oilRegen)*battleStep);
    const harm=expected-after.oil;
    if(harm>.055 && boss.hp>0){ harms++; oilLost+=harm; }
  }
  const end=game.snapshot();
  const killed=boss.hp<=0;
  return {stage,wave,id,seed,policy,level,seconds:round(workTime),killed,
    finalState:end.state,hp:boss.max,left:round(Math.max(0,boss.hp)),speed:boss.speed,reward:oilReward,
    dps:round((boss.max-Math.max(0,boss.hp))/Math.max(workTime,dt)),oilStart:round(initial.oil),
    oilEnd:round(end.oil),oilLost:round(oilLost),ambient:round(workTime*(.43-game.bar().oilRegen)),
    rewardsRealized:killed ? round(end.oil-(initial.oil-workTime*(.43-game.bar().oilRegen)-oilLost)) : 0,
    selected,attacks,attacksPerMin:round(Object.values(attacks).reduce((a,b)=>a+b,0)*60/Math.max(workTime,dt)),
    dodgeSeconds:round(dodgeFrames*dt),telegraphSeconds:round(telegraphSeconds),harms,
    shieldsLeft:game.bar().shield||0,sealSeconds:round(readSteps*dt)};
}

function bossProbes(){
  const game=loadGame({location:benchLocation});
  vm.runInContext(readFileSync(require.resolve('../js/sakura-art-data.js'),'utf8'),game.env);
  const setup=stages.map(stage=>({stage,bosses:stageBosses(game,stage)}));
  const rows=[];
  for(const stage of stages) for(const wave of [0,1]) {
    for(const id of (stages.indexOf(stage)<2?Object.keys(archetypes):['melee','ranged','low'])) {
      for(const seed of (stages.indexOf(stage)<2?[117,482,931]:[117])) {
        rows.push(playBoss(game,stage,wave,id,seed,'dodge'));
      }
    }
  }
  for(const stage of stages.slice(0,2)) for(const wave of [0,1]) {
    rows.push(playBoss(game,stage,wave,'ranged',117,'hold'));
    rows.push(playBoss(game,stage,wave,'low',117,'dodge',25));
  }
  return {setup,rows};
}

const oilCases = {
  first:{t:38,losses:1,oil:83.66},
  repeat:{t:38,losses:3,oil:83.66},
  mid:{t:235,losses:1,oil:32,timeout:true},
  preboss:{t:165,losses:1,oil:22},
  lowbuild:{t:140,losses:1,oil:37,build:{katana:1,fire:1}},
  defensive:{t:140,losses:1,oil:37,picks:{oil_max:2,shield:2},build:{katana:2,barrier:1}},
  slow:{t:140,losses:2,oil:37,build:{katana:2}}
};

function oilTrial(id,caseData,delay,seed,pressure,assisted){
  const game=loadGame({location:baselineLocation,seed});
  game.startRun('night-town');
  game.stopSpawns();
  game.setElapsed(caseData.t);
  game.setOil(caseData.oil);
  configure(game,caseData);
  for(const [id,rank] of Object.entries(caseData.build||{}))game.setWeaponRank(id,rank);
  game.armWeapons();
  const initial=game.snapshot();
  let recovery=0, terminal=false, generated=0, nextOil=null, postLoss=null;
  const tick=(length,stepAway)=>{
    for(let i=0;i<Math.round(length/dt);i++) {
      const s=game.snapshot(), nearest=s.enemies.filter(e=>e.hp>0)
        .reduce((near,e)=>!near||Math.hypot(e.x-s.x,e.y-s.y)<Math.hypot(near.x-s.x,near.y-s.y)?e:near,null);
      for(const key of game.keyState())game.tapKey(key,false);
      if(stepAway && nearest){
        const dx=s.x-nearest.x,dy=s.y-nearest.y,d=Math.hypot(dx,dy)||1;
        if(d<135)game.pushKeys([dx/d,dy/d]);
      }
      if(pressure && i>0 && i%300===0)game.phaseBHit(pressure);
      if(game.snapshot().state!=='play') return false;
      game.update(dt);
      if(game.snapshot().state!=='play') return false;
      recovery+=dt;
    }
    return true;
  };
  for(let attempt=0;attempt<caseData.losses;attempt++){
    if(attempt && !tick(25,true)){terminal=true;break;}
    assert.ok(game.prepareOrder());
    const job=game.snapshot().job, count=game.snapshot().enemies.length;
    if(caseData.timeout){
      game.atAnswer();
      Object.assign(job,{reading:true,barrierTimer:.01});
      game.update(dt);
    } else game.resolve(job.ans.findIndex(w=>w!==job.word));
    generated+=game.snapshot().enemies.length-count;
    postLoss=game.snapshot().oil;
    if(game.snapshot().state!=='play'){terminal=true;break;}
  }
  recovery=0;
  if(!terminal && tick(delay,true)){
    nextOil=game.snapshot().oil;
    if(game.prepareOrder()){
      const job=game.snapshot().job;
      job.assisted=assisted;
      game.atAnswer();
      tick(.80,false);
    }
  }
  const end=game.snapshot();
  return {id,seed,delay,pressure,assisted,initialOil:round(initial.oil),postLoss:postLoss===null?null:round(postLoss),
    beforeNext:nextOil===null?null:round(nextOil),endOil:round(end.oil),seconds:round(recovery),generated,
    lost:end.failed,delivered:end.delivered,state:end.state,
    elapsed:round(end.elapsed-initial.elapsed),recovered:end.delivered>0 && end.oil>=initial.oil};
}

function oilProbes(){
  const rows=[];
  for(const [id,data] of Object.entries(oilCases)) {
    for(const delay of [20,40,65]) for(const pressure of [0,5,10]) for(const assisted of [false,true]) {
      rows.push(oilTrial(id,data,delay,117,pressure,assisted));
    }
  }
  return rows;
}

function passives(){
  const picks={shield:3,oil_max:2,oil_heal:3,dmg:4,rate:4,crit:3,spd:3,dash:3,mag:3};
  const game=loadGame({location:benchLocation});
  const slice=()=>{
    const s=game.snapshot();
    return {oil:round(s.oil),maxOil:s.maxOil,...game.phaseBStats(),
      stats:Object.fromEntries(skills.map(id=>[id,[1,4,5].map(rank=>{
        const spec=game.phaseBSpec(id,rank);
        return {cooldown:spec.cooldown??null,crit:spec.critChance??null};
      })]))};
  };
  return Object.entries(picks).flatMap(([id,limit])=>[false,true].map(charms=>{
    game.startRun('bamboo-maze');
    game.setOil(15);
    if(charms) for(const charm of ['charm_cadence','charm_power','charm_reach'])game.phaseBCharm(charm,3);
    const steps=[slice()];
    for(let i=0;i<limit;i++){game.tune(id).f();steps.push(slice());}
    return {id,charms,steps};
  }));
}

function finalFallback(){
  const game=loadGame({location:benchLocation});
  return stages.map(stage=>{
    const {boss:prior}=spawnBoss(game,stage,0);
    game.setElapsed(584.75);
    let final;
    for(let i=0;i<19&&!final;i++){
      game.update(dt);
      final=game.snapshot().enemies.find(e=>e.final);
    }
    assert.ok(final&&prior.hp>0&&prior.shield,stage+' concurrent unsolved boss');
    const appeared=final.appearedAt;
    const present=Array.from(game.snapshot().enemies,e=>e.bossIndex+1);
    assert.ok(appeared>=585&&appeared<585.5,stage+' final deadline');
    // Isolate the victory gate from time needed to answer and damage the final.
    final.shield=false;
    game.hurt(final,final.hp);
    const withoutDeliveries=game.snapshot().state;
    assert.equal(withoutDeliveries,'play');
    game.meetDeliveryGoal();
    game.update(dt);
    const withDeliveries=game.snapshot().state;
    assert.equal(withDeliveries,'victory');
    return {stage,appeared:round(appeared),present,previousStillSealed:prior.shield,withoutDeliveries,withDeliveries};
  });
}

const mode=process.argv[2];
const runners={boss:bossProbes,oil:oilProbes,passives,final:finalFallback};
assert.ok(runners[mode], 'Usage: node tools/probe-first-four-phase-b.cjs boss | oil | passives | final');
process.stdout.write(JSON.stringify(runners[mode]()));
