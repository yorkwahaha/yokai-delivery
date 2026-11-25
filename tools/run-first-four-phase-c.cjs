'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame,stages,round}=require('./measure-first-four-phase-b.cjs');

const profiles={
  general:{weapons:['needle','fire','thunder','katana','boom','barrier'],pace:1,engage:64,range:155},
  melee:{weapons:['katana','fire','barrier','boom'],pace:1,engage:66,range:95},
  ranged:{weapons:['needle','thunder','boom','katana'],pace:1,engage:62,range:205},
  area:{weapons:['boom','fire','barrier','thunder','katana'],pace:1,engage:64,range:140},
  defense:{weapons:['barrier','katana','shikigami','thunder'],pace:1,engage:56,range:140,defense:true},
  novice:{weapons:['fire','barrier','katana','seal_nail'],pace:.68,engage:70,range:145,errors:true},
  skilled:{weapons:['needle','fire','boom','thunder','katana'],pace:1,engage:44,range:130,skilled:true}
};
const location={hostname:'example.com',search:''};
const seedList=[117,482,931];
const variants={
  original:{}, A5:{hp:[285,618]}, A:{hp:[270,585]}, A15:{hp:[255,553]},
  B:{reward:45}, C:{recovery:8}, D:{hp:[270,585],reward:45}, production:{}
};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function replace(source,from,to){
  assert.equal(source.split(from).length,2,from);
  return source.replace(from,()=>to);
}

function runtimeTransform(mode='original',observe=false){
  const config=variants[mode];
  assert.ok(config,mode);
  return (name,live)=>{
    if(name!=='game.js')return live;
    let src=live.replace(/\r\n/g,'\n');
    if(mode!=='production'){
      const liveReward='oilReward: isRainPortNormal && bossStage < 2 ? plan.oil + 10 : plan.oil,';
      src=replace(src,liveReward,'oilReward: plan.oil,');
    }
    if(config.hp)src=replace(src,'[300, 650, 900, 1400]',`[${config.hp.join(', ')}, 900, 1400]`);
    if(config.reward)src=replace(src,'const reward = e.oilReward || 35;',`const reward = STAGE.id === "rain-port" && isRainPortNormalMode() && e.bossIndex < 2 ? ${config.reward} : e.oilReward || 35;`);
    if(config.recovery){
      src=replace(src,'  function hurtPlayer(amount, label) {',`  let phaseCAssistUsed = false;
  function phaseCAssist(){
    if(!phaseCAssistUsed && oil > 0 && oil <= 25){phaseCAssistUsed=true;oil=Math.min(maxOil,oil+${config.recovery});}
  }
  function hurtPlayer(amount, label) {`);
      src=replace(src,'elapsed = 0; animElapsed = 0; warnDawnT = 0; oil = 100;', 'phaseCAssistUsed = false; elapsed = 0; animElapsed = 0; warnDawnT = 0; oil = 100;');
      src=replace(src,'say("委託失敗・妖怪來襲！",','phaseCAssist(); say("委託失敗・妖怪來襲！",');
      src=replace(src,'const penalty = Math.max(3, Math.round(maxOil * 0.05));\n        oil = Math.max(0, oil - penalty);','const penalty = Math.max(3, Math.round(maxOil * 0.05));\n        oil = Math.max(0, oil - penalty);\n        phaseCAssist();');
    }
    if(!observe)return src;
    const marker='  initFusionBridge();\n  requestAnimationFrame(frame);';
    src=replace(src,marker,`  window.phaseCRead=()=>({
    damage:phaseCDamage, hits:phaseCHits, kills:phaseCKills, bossRewards:phaseCBossRewards, harm:phaseCHarm,
    regen:b.oilRegen||0, speed:getEffectiveMoveSpeed(), gems:gems.length,
    shots:proj.length+needles.length+winds.length+dragonShots.length,
    particles:FX.stats().particles, chunks:WORLD_STATE.getCacheSize?.()||0
  });
  window.phaseCAdvance=dt=>{
    update(dt);
    if(STAGE.id==="rain-port" && state==="play" && !tutorial && !job?.reading && !bossQ?.reading){
      rainCycle.tick(dt);
      weatherClock+=dt;
    }
  };
  window.phaseCCancelCharm=()=>resolveCharmSwap("cancel");
`+marker);
    src=replace(src,'    oil -= actualDamage;',`    phaseCDamage+=Math.min(oil,actualDamage); phaseCHits++;
    phaseCHarm.push({at:elapsed,oil,damage:Math.min(oil,actualDamage),cause});
    oil -= actualDamage;`);
    src=replace(src,'    // 怪物擊敗\n    const isMis', '    // 怪物擊敗\n    if(e.type!=="boss") phaseCKills++;\n    const isMis');
    src=replace(src,'      oil = Math.min(maxOil, oil + reward);','      phaseCBossRewards+=Math.min(maxOil-oil,reward);\n      oil = Math.min(maxOil, oil + reward);');
    const declarations='  let phaseCDamage=0, phaseCHits=0, phaseCKills=0, phaseCBossRewards=0; const phaseCHarm=[];';
    src=replace(src,'if (hurtPlayer(dmg)) return;',
      'if (hurtPlayer(dmg, undefined, hazardHit ? "hazard:"+hazardHit.kind : "contact:"+e.type)) return;');
    src=replace(src,'if (hurtPlayer(8, "妖火灼身・燈油 −8")) return;',
      'if (hurtPlayer(8, "妖火灼身・燈油 −8", "mob-projectile")) return;');
    return replace(src,'  function hurtPlayer(amount, label) {',declarations+'\n  function hurtPlayer(amount, label, cause = "unknown") {');
  };
}

function openGame(stage,seed,mode){
  const game=loadGame({location,seed,transform:runtimeTransform(mode,true)});
  vm.runInContext(fs.readFileSync(require.resolve('../js/sakura-art-data.js'),'utf8'),game.env);
  const store=game.store();
  for(const prior of stages.slice(0,stages.indexOf(stage)))store.finish(prior,100,6,true);
  assert.ok(store.isStageUnlocked(stage),stage+' prerequisite');
  let cam={x:0,y:0};
  game.env.RENDERER.getCam=()=>cam;
  game.env.RENDERER.setCam=(x,y)=>{cam={x,y};};
  game.startRun(stage);
  return game;
}

function pickCard(game,profile){
  const cards=game.currentChoices(), {oil,maxOil}=game.snapshot(), b=game.bNow();
  const chosen=ids=>ids.reduce((index,id)=>index>=0?index:cards.findIndex(c=>c.id===id),-1);
  let index=oil<maxOil*.48?chosen(['oil_heal','oil_max','shield']):-1;
  if(index<0 && profile.defense && b.oilRegen<.12)index=chosen(['oil_max','shield','dash']);
  if(index<0 && profile.skilled && (b.spd||0)<1)index=chosen(['spd','mag']);
  if(index<0)index=cards.findIndex(c=>c.lv===5&&profile.weapons.includes(c.id));
  if(index<0){
    const ranked=cards.map((card,index)=>({card,index,priority:profile.weapons.indexOf(card.id)}))
      .filter(x=>x.priority>=0)
      .sort((a,b)=>a.priority-b.priority||b.card.lv-a.card.lv);
    index=ranked[0]?.index??-1;
  }
  if(index<0)index=chosen(profile.defense?['oil_max','shield','dash','oil_heal','spd','mag','dmg']:
    ['dmg','oil_max','spd','mag','shield','rate','crit','dash','oil_heal']);
  return game.takeLevelUpChoice(Math.max(0,index));
}

function dodgePoint(s,h){
  const angle=h.angle||0, dx=s.x-h.x,dy=s.y-h.y;
  const c=Math.cos(angle), n=Math.sin(angle), side=-n*dx+c*dy, front=c*dx+n*dy;
  const along=(sign,length)=>({x:s.x-n*sign*length,y:s.y+c*sign*length});
  const away=(z,r)=>{
    const d=dist(s,z);
    return d>=r?null:d>4?{x:z.x+(s.x-z.x)*r/d,y:z.y+(s.y-z.y)*r/d}:along(1,r);
  };
  if(h.kind==='tide')return Math.abs(h.safeOffset-side)<38?null:along(Math.sign(h.safeOffset-side),Math.abs(h.safeOffset-side));
  if(['charge','sakuraRush'].includes(h.kind))return Math.abs(side)>(h.r||55)+23?null:along(Math.sign(side||1),110);
  if(h.kind==='tidalFan')return front<0 || dist(s,h)>(h.r||480)+42 || Math.abs(Math.atan2(side,front))>1.18?null:along(Math.sign(side||1),230);
  if(h.kind==='ring'){
    const a=Math.atan2(dy,dx), diff=Math.atan2(Math.sin(a-h.gapAngle),Math.cos(a-h.gapAngle));
    return Math.abs(diff)<.55?null:{x:h.x+Math.cos(h.gapAngle)*Math.max(132,dist(s,h)),y:h.y+Math.sin(h.gapAngle)*Math.max(132,dist(s,h))};
  }
  if(h.kind==='sakuraFan'){
    const bearing=Math.atan2(dy,dx);
    const danger=h.shots.filter(z=>!z.dead).map(z=>Math.atan2(Math.sin(z.angle-bearing),Math.cos(z.angle-bearing)));
    const nearest=danger.sort((a,b)=>Math.abs(a)-Math.abs(b))[0];
    return nearest===undefined || Math.abs(nearest)>.19 ? null : along(-Math.sign(nearest||1),70);
  }
  if(h.kind==='bambooCut'){
    const z=h.zones.find(z=>Math.abs(s.x-z.x)<=z.rx+14&&Math.abs(s.y-z.y)<=z.ry+14);
    if(!z)return null;
    return z.rx<z.ry?{x:z.x+Math.sign(s.x-z.x||1)*(z.rx+43),y:s.y}:
      {x:s.x,y:z.y+Math.sign(s.y-z.y||1)*(z.ry+43)};
  }
  for(const z of h.vortexes || h.marks || h.zones || [h]){
    const point=away(z,(z.r||z.rx||h.r||145)+24);
    if(point)return point;
  }
  return null;
}

function natural(stage,name,seed,{mode='original',skip=false,wallBudget=90000,horizon=760}={}){
  const profile=profiles[name], game=openGame(stage,seed,mode), stats=game.env.phaseCRead;
  const dt=.05, started=Date.now();
  const bosses=[], deliveries=[], choices=[], curve=[], losses=[];
  const peak={enemies:0,bullets:0,shots:0,particles:0,gems:0,chunks:0,nearMobs:0};
  let stop='wall-budget', route=null, waypoint=0, pathKey='', replanned=-20, frames=0, minute=0;
  let nextDelivery=0, picked=null, currentJob=null, distance=0, stalled=0, sealRead=0, pressing=0;
  let oilDrain=0, oilDamage=0, charmCancels=0;
  let routeFrames=0, wallFrames=0, fightingFrames=0, avoidanceFrames=0, cancelledRoutes=0;
  const seenBosses=new Map();
  const steer=(s,target,key,tolerance)=>{
    if(dist(s,target)<tolerance)return;
    const direct=[.25,.5,.75,1].every(f=>!game.blocked(s.x+(target.x-s.x)*f,s.y+(target.y-s.y)*f,20));
    const movingGoal=key.startsWith('boss');
    if(direct && (dist(s,target)<330 || !route))return input(s,target);
    if((key!==pathKey && frames-replanned>9)||frames-replanned>(movingGoal?27:72)||stalled>18&&frames-replanned>10){
      route=game._planPath(target.x,target.y,28,12,tolerance);
      waypoint=0;
      pathKey=key;
      replanned=frames;
    }
    while(route&&waypoint<route.length-1&&dist(s,route[waypoint])<34)waypoint++;
    input(s,route?.[waypoint]||target);
  };
  function input(s,t){
    const dx=t.x-s.x,dy=t.y-s.y,len=Math.hypot(dx,dy);
    if(len>0)game.pushKeys([dx/len,dy/len]);
  }
  let clearance=null;
  while(Date.now()-started<wallBudget && frames<44000){
    const s=game.snapshot(), before=stats();
    if(s.state==='won'||s.state==='lost'){stop=s.state;break;}
    if(s.state==='victory'||s.state==='lampout'){
      clearance??={state:s.state,at:s.elapsed,oil:s.oil};
      game.stepFrame(50); frames++; continue;
    }
    if(s.elapsed>=horizon){stop='horizon';break;}
    if(s.state==='levelup'){
      const choice=pickCard(game,profile);
      if(!choice.ok){stop='selection:'+choice.reason;break;}
      choices.push({time:round(s.elapsed,2),...choice});
      continue;
    }
    if(s.state==='charmswap'){
      game.env.phaseCCancelCharm();
      charmCancels++;
      continue;
    }
    if(s.state!=='play'){stop='unexpected:'+s.state;break;}
    if(s.elapsed>=minute*60){
      curve.push({minute,level:s.level,xp:s.xp,totalXp:game.xpEarnedTotal(),oil:round(s.oil,2),
        delivered:s.delivered,failed:s.failed,kills:before.kills});
      minute++;
    }
    const active=s.enemies.filter(e=>e.type==='boss'&&e.hp>0&&!e.dying);
    for(const e of active) if(!seenBosses.has(e)){
      const row={index:e.bossIndex+1,title:e.title,hp:e.max,at:e.appearedAt,level:s.level,oilAtSpawn:s.oil,dmgStart:null};
      seenBosses.set(e,row);bosses.push(row);
    }
    const quiz=s.bossQ;
    if(quiz?.lock<=0&&!s.job?.reading){
      const owner=active.find(e=>e.quiz===quiz)||active.find(e=>e.shield&&e.word===quiz.word);
      if(owner && (!skip||owner.final)){
        game.answerBoss(quiz.ans.indexOf(quiz.word));
        if(!owner.shield){
          const row=seenBosses.get(owner);
          Object.assign(row,{seal:round(s.elapsed,2),oilAtSeal:round(s.oil,2),dmgStart:before.damage});
        }
      }
    }
    for(const key of game.keyState())game.tapKey(key,false);
    let target, key, tolerance=24, dodging=false;
    if(s.job!==currentJob){
      currentJob=s.job;
      if(s.job){
        const wrong=!!profile.errors && ((s.delivered===0&&s.failed<2)||(s.delivered>3&&s.delivered%7===0&&s.failed<3));
        const ix=wrong?s.job.ans.findIndex(w=>w!==s.job.word):undefined;
        picked={at:s.elapsed,from:s.job.from,goal:game.answerPad(ix),wrong,word:s.job.word.jp,x:s.x,y:s.y,distance};
      }
    }
    if(s.job&&picked){target=picked.goal;key='job:'+picked.word+':'+target.x+':'+target.y;routeFrames++;}
    else if(s.elapsed>=nextDelivery){
      if(game.pendingPickup() && game.realPickup()) {route=null;pathKey='';}
      if(!game.snapshot().job){
        const nearby=game.ordersNow().sort((a,b)=>(dist(s,a.from)+(profile.skilled?.5:0)*dist(a.from,a.to))-
          (dist(s,b.from)+(profile.skilled?.5:0)*dist(b.from,b.to)));
        if(nearby.length){
          target=nearby[0].from;
          key='order:'+target.x+':'+target.y;
          tolerance=60;
          routeFrames++;
        }
      }
    }
    const boss=active.find(e=>e.final&&(!skip||e.final))||active.find(e=>!skip);
    const canFight=boss && !s.job?.reading && (s.delivered>=6 || !s.job) &&
      s.oil>profile.engage*(boss.final?.78:1) && (!profile.errors || s.level>=8) &&
      (s.level>=(profile.skilled?3:4) || boss.final);
    if(canFight && (dist(s,boss)<740 || !target)){
      const a=Math.atan2(s.y-boss.y,s.x-boss.x);
      const r=boss.shield?180:profile.range;
      const turn=boss.shield?0:(dist(s,boss)<r+60?.52:.20);
      target={x:boss.x+Math.cos(a+turn)*r,y:boss.y+Math.sin(a+turn)*r};
      key='boss:'+boss.bossIndex;
      tolerance=17;
      fightingFrames++;
    }
    if(!target){
      const gem=s.gems.filter(e=>!e.done&&dist(e,s)<570).sort((a,b)=>dist(a,s)-dist(b,s))[0];
      const a=s.elapsed*.19;
      target=gem||{x:s.x+Math.cos(a)*140,y:s.y+Math.sin(a)*140};
      key=gem?'gem:'+Math.round(gem.x/60)+':'+Math.round(gem.y/60):'orbit';
    }
    for(const e of active){
      if(!e.hazard||e.hazard.phase==='recovery'||s.job?.reading||profile.errors&&frames%12<5)continue;
      const point=dodgePoint(s,e.hazard);
      if(point){
        target=point;key='dodge:'+e.bossIndex;tolerance=15;dodging=true;avoidanceFrames++;
        break;
      }
    }
    if(!dodging&&!s.job?.reading && !s.job && !canFight){
      const closest=s.enemies.find(e=>e.type!=='boss'&&dist(s,e)<46);
      if(closest)target={x:s.x+(s.x-closest.x)*5,y:s.y+(s.y-closest.y)*5};
    }
    if(s.job?.reading)sealRead+=dt;
    if(frames%20<Math.round(20*profile.pace)||dodging)steer(s,target,key||'',tolerance);
    if(game.keyState().length && !s.job?.reading && (dodging || profile.skilled && dist(s,target)>220)){
      game.tapKey('dash');pressing++;
    }
    if(game.keyState().length && game.blocked(s.x+(target.x-s.x)*.15,s.y+(target.y-s.y)*.15,18))wallFrames++;
    game.env.phaseCAdvance(dt);frames++;
    const after=game.snapshot(), next=stats(), step=dist(s,after);
    distance+=step;
    stalled=step<.1&&game.keyState().length?stalled+1:0;
    const drain=(.43-before.regen)*(after.elapsed-s.elapsed);
    oilDrain+=drain;
    oilDamage+=next.damage-before.damage;
    for(const [e,row] of seenBosses){
      if(row.seal===undefined||row.kill!==undefined)continue;
      row.harm=round(next.damage-row.dmgStart,2);
      row.drain=round((row.drain||0)+drain,3);
      if(e.hp<=0){
        Object.assign(row,{kill:round(after.elapsed,2),ttk:round(after.elapsed-row.seal,2),
          oilAfter:round(after.oil,2),remainingHp:0,reward:round(next.bossRewards-before.bossRewards,2)});
      }else row.remainingHp=round(e.hp,2);
    }
    if(after.delivered>s.delivered&&picked){
      deliveries.push({at:round(after.elapsed,2),word:picked.word,seconds:round(after.elapsed-picked.at,2),
        travel:round(distance-picked.distance,1),oil:round(after.oil,2)});
      nextDelivery=after.elapsed+(profile.errors?10:0);
      route=null;pathKey='';
    }
    if(after.failed>s.failed){
      losses.push({at:round(after.elapsed,2),oil:round(after.oil,2),wrong:picked?.wrong??false});
      nextDelivery=after.elapsed+(profile.errors?10:0);
      cancelledRoutes++;
    }
    const counts={enemies:after.enemies.length,bullets:after.enemyBullets.length,shots:next.shots,
      particles:next.particles,gems:next.gems,chunks:next.chunks,
      nearMobs:after.enemies.filter(e=>e.type!=='boss'&&dist(e,after)<72).length};
    for(const k of Object.keys(peak))peak[k]=Math.max(peak[k],counts[k]);
  }
  const end=game.snapshot(), summary=stats(), store=game.store();
  const progress=JSON.parse(JSON.stringify(store.data.progress));
  const causes={};
  for(const h of summary.harm)causes[h.cause]=round((causes[h.cause]||0)+h.damage,2);
  if(stop==='wall-budget' && frames>=44000)stop='frame-budget';
  return {stage,name,mode,skip,seed,stop,state:end.state,time:round(end.elapsed,2),wallMs:Date.now()-started,
    level:end.level,xp:end.xp,totalXp:game.xpEarnedTotal(),oil:round(end.oil,2),delivered:end.delivered,failed:end.failed,
    kills:summary.kills,hitCount:summary.hits,oilDamage:round(oilDamage,2),oilDrain:round(oilDrain,2),bossOil:round(summary.bossRewards,2),
    deliveryMean:deliveries.length?round(deliveries.reduce((a,b)=>a+b.seconds,0)/deliveries.length,2):null,
    meanDeliveryPath:deliveries.length?round(deliveries.reduce((a,b)=>a+b.travel,0)/deliveries.length,1):null,
    frames,distance:round(distance,1),wallFrames,routeFrames,fightingFrames,avoidanceFrames,sealRead:round(sealRead),pressing,cancelledRoutes,charmCancels,curve,bosses,
    deliveries,losses,choices,peak,build:Object.fromEntries(Object.entries(game.weaponLevels()).filter(([,v])=>v>0)),passives:game.bar(),
    terminal:clearance,causes,harm:summary.harm.slice(-14),progress,
    result:game.runSummary()||null};
}

module.exports={natural,profiles,variants,runtimeTransform,seedList,openGame,dodgePoint,replace};

if(require.main===module){
  const [stage,mode='original',players='all',seeds='117,482',options='']=process.argv.slice(2);
  assert.ok(stages.includes(stage),stage);
  const policy=players==='all'?Object.keys(profiles):players.split(',');
  for(const seed of seeds.split(',').map(Number))for(const name of policy){
    assert.ok(profiles[name],name);
    console.log(JSON.stringify(natural(stage,name,seed,{mode,skip:options==='skip'})));
  }
}
