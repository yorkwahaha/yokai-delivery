// Deterministic input controller. No position/XP/skill/oil/state overrides.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {loadGame}=require('../tests/helpers/game-runtime.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function runNaturalRun(seed, options={}) {
  const horizon=options.seconds??600, mode=options.mode||'delivery', dt=.05;
  const g=loadGame({seed,stage:options.stage||'night-town',revision:options.revision});g.start();
  const started=Date.now(), picks={passive:0,weapon:0,awaken:0}, pickLog=[], bossAnswers=[], bossKills=[], deliveries=[];
  let plan=null, targetKey='', waypoint=0, frames=0, fourSealAt=null, maxedAtElapsed=null, stalled=0;
  let movementSeconds=0, maximumStep=0, stopReason=null;
  const choose=()=>{
    const s=g.snapshot(), cards=g.currentChoices(), wl=g.weaponLevels(), b=g.bNow();
    let i=s.oil<50?cards.findIndex(c=>['oil_heal','oil_max'].includes(c.id)):-1;
    if(i<0)i=cards.findIndex(c=>c.lv===5);
    if(i<0 && s.oil<45) i=cards.findIndex(c=>['oil_heal','oil_max'].includes(c.id));
    if(i<0 && (b.oilRegen||0)<.12) i=cards.findIndex(c=>c.id==='oil_max');
    if(i<0 && b.mag<2) i=cards.findIndex(c=>c.id==='mag');
    if(i<0 && b.dmg<2.4 && Object.values(wl).some(v=>v>=3)) i=cards.findIndex(c=>c.id==='dmg');
    if(i<0) {
      const weapons=cards.map((c,i)=>({c,i})).filter(x=>x.c.type==='weapon');
      const priority={needle:12,fire:10,katana:9,thunder:8,boom:3,barrier:1};
      weapons.sort((a,b)=>(priority[b.c.id]+(wl[b.c.id]||0))-(priority[a.c.id]+(wl[a.c.id]||0)));
      if(weapons.length)i=weapons[0].i;
    }
    if(i<0) for(const id of ['mag','dmg','oil_max','shield','oil_heal','rate','spd','dash','crit']) {
      i=cards.findIndex(c=>c.id===id);if(i>=0)break;
    }
    if(i<0)i=0;
    const before=g.snapshot().level, res=g.takeLevelUpChoice(i);
    if(!res.ok)throw new Error(`Real choice failed: ${res.reason}`);
    picks[res.type==='passive'?'passive':'weapon']++;
    if(res.lv===5)picks.awaken++;
    pickLog.push({at:s.elapsed,level:before,id:res.id,type:res.type,rank:res.lv??null,needed:g.xpSpentActual()});
    if(maxedAtElapsed===null && Object.values(g.weaponLevels()).filter(v=>v===5).length===4)maxedAtElapsed=s.elapsed;
  };
  g.onLevelUp=choose;

  const steer=(s,target,key,tolerance)=>{
    if(key!==targetKey || !plan || stalled>30) {
      targetKey=key;plan=g._planPath(target.x,target.y,24,10,tolerance);waypoint=0;stalled=0;
    }
    if(plan?.length) {
      while(waypoint<plan.length-1 && distance(s,plan[waypoint])<18)waypoint++;
    }
    const aim=plan?.length && distance(s,plan[waypoint])>12?plan[waypoint]:target;
    const dx=aim.x-s.x,dy=aim.y-s.y,n=Math.hypot(dx,dy)||1;
    g.pushKeys([dx/n,dy/n]);
  };
  while(frames<100000 && Date.now()-started<(options.wallBudgetMs??180000)) {
    const s=g.snapshot();
    if(s.state==='victory'||s.state==='won'){stopReason='victory';break;}
    if(s.state==='lampout'||s.state==='lost'){stopReason='death';break;}
    if(s.elapsed>=horizon){stopReason='horizon';break;}
    if(s.state==='levelup'){g.keyState().forEach(k=>g.tapKey(k,false));choose();continue;}
    if(s.state!=='play'){stopReason=`unexpected-state:${s.state}`;break;}
    if(s.delivered>=12 && fourSealAt===null)fourSealAt=s.elapsed;
    const q=s.bossQ;
    if(q && !s.job?.reading && q.lock<=0) {
      const boss=s.enemies.find(e=>e.type==='boss'&&e.shield);
      if(boss){g.answerBoss(q.ans.indexOf(q.word));bossAnswers.push({at:s.elapsed,word:q.word.jp,correct:!boss.shield,introduced:!!q.introduced});}
    }
    g.keyState().forEach(k=>g.tapKey(k,false));
    if(mode==='delivery') {
      let target=null,key='',tolerance=32;
      if(s.job) {target=g.answerPad();key=`pad:${s.job.to.x}:${s.job.to.y}:${s.job.word.jp}`;tolerance=26;}
      else if(options.farmAfterTwelve!==true || s.delivered<12 || s.oil<85) {
        if(g.pendingPickup()){g.realPickup();targetKey='';}
        else {
          const order=g.ordersNow().slice().sort((a,b)=>distance(s,a.from)-distance(s,b.from))[0];
          if(order){target=order.from;key=`pickup:${order.from.x}:${order.from.y}`;tolerance=90;}
        }
      } else {
        const gem=s.gems.filter(v=>!v.done && distance(s,v)<650).sort((a,b)=>distance(s,a)-distance(s,b))[0];
        if(gem){target=gem;key=`gem:${Math.round(gem.x/48)}:${Math.round(gem.y/48)}`;tolerance=24;}
        else {target={x:s.x+Math.cos(s.elapsed*.18)*150,y:s.y+Math.sin(s.elapsed*.18)*150};key=`orbit:${Math.floor(s.elapsed/3)}`;}
      }
      const boss=s.enemies.find(e=>e.type==='boss' && e.hp>0);
      if(boss && options.fightBosses!==false && Object.values(g.weaponLevels()).some(v=>v===5) && !s.job?.reading && s.oil>65){
        const a=Math.atan2(s.y-boss.y,s.x-boss.x)+(distance(s,boss)<260?.65:0);
        target={x:boss.x+Math.cos(a)*150,y:boss.y+Math.sin(a)*150};
        key=`boss:${Math.floor(s.elapsed/2)}`;tolerance=24;
      }
      // Telegraph response and close-range avoidance are input decisions, not invulnerability.
      const hazard=s.enemies.find(e=>e.hazard && e.hazard.phase!=='recovery')?.hazard;
      if(hazard && !s.job?.reading) {
        const h=hazard, angle=Math.atan2(s.y-h.y,s.x-h.x);
        if(h.kind==='slam' && distance(s,h)<h.r+45)target={x:h.x+Math.cos(angle)*230,y:h.y+Math.sin(angle)*230};
        if(h.kind==='charge')target={x:s.x-Math.sin(h.angle)*180,y:s.y+Math.cos(h.angle)*180};
        if(h.kind==='ring')target={x:h.x+Math.cos(h.gapAngle)*260,y:h.y+Math.sin(h.gapAngle)*260};
        if(h.kind==='tide')target={x:h.x-Math.sin(h.angle)*h.safeOffset,y:h.y+Math.cos(h.angle)*h.safeOffset};
        key=`dodge:${h.kind}:${h.x}:${h.y}`;tolerance=24;
      } else if(!s.job && !target) {
        const near=s.enemies.filter(e=>e.hp>0 && distance(s,e)<78);
        if(near.length){const e=near[0],d=distance(s,e)||1;target={x:s.x+(s.x-e.x)/d*150,y:s.y+(s.y-e.y)/d*150};key=`avoid:${Math.floor(s.elapsed)}`;tolerance=24;}
      }
      if(target && distance(s,target)>20)steer(s,target,key,tolerance);
      if(s.job && distance(s,g.answerPad())<30)g.keyState().forEach(k=>g.tapKey(k,false));
      if(g.keyState().length && !s.job?.reading)g.tapKey('dash',true);
    }
    const livingBosses=s.enemies.filter(e=>e.type==='boss' && e.hp>0);
    g.update(dt);frames++;
    const after=g.snapshot(), step=distance(s,after);
    for(const boss of livingBosses)if(boss.hp<=0)bossKills.push({at:after.elapsed,index:boss.bossIndex,final:!!boss.final});
    maximumStep=Math.max(maximumStep,step);if(step>.001)movementSeconds+=dt;
    stalled=step<.1?stalled+1:0;
    if(after.delivered>s.delivered){deliveries.push({at:after.elapsed,word:s.job?.word.jp,delivered:after.delivered,level:after.level,oil:after.oil});targetKey='';}
  }
  const s=g.snapshot(), wl=g.weaponLevels();
  if(!stopReason)stopReason=frames>=100000?'frame-budget':'wall-budget';
  const ledger=g.enemyXp();
  if(ledger.fromEnemies<0 || ledger.totalEarned!==s.xp+g.xpSpentTotal())throw new Error('Growth ledger differs from actual requirements');
  return {kind:'input-controller',seed,mode,horizon,stopReason,
    sources:Object.fromEntries(['game','config','evolutions','boss-ai','store'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../js',n+'.js'))).digest('hex')])),
    controllerHash:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    policy:{farmAfterTwelve:options.farmAfterTwelve===true,fightBosses:options.fightBosses!==false},gameElapsed:+s.elapsed.toFixed(2),wallMs:Date.now()-started,frames,
    movementSeconds:+movementSeconds.toFixed(2),maximumStep:+maximumStep.toFixed(2),delivered:s.delivered,level:s.level,xp:s.xp,
    oil:+s.oil.toFixed(2),state:s.state,seals:g.v3().sealCount,fourSealAt,maxedAtElapsed,weapons:wl,
    maxed:Object.keys(wl).filter(k=>wl[k]===5),xpLedger:ledger,picks,pickLog,bossAnswers,bossKills,deliveries,
    limits:['Perfect answer/word-memory assumption; not human learning or device performance.','Movement includes time inside safe reading; gameElapsed excludes that time.','No forced positions, XP, skills, shields, oil or play state.']};
}
module.exports={runNaturalRun};
