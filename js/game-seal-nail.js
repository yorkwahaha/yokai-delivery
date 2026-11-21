// 距爆・封印釘：world-anchored single-use mine activated by player departure.
// All effects advance inside weapons(dt); no timers, geometry art, or extra input.
window.GAME_SEAL_NAIL = (() => {
  const TIERS = Object.freeze([
    {factor:4.0, cooldown:5.3, radius:110, distance:185, life:4.0},
    {factor:5.4, cooldown:4.9, radius:122, distance:175, life:4.5},
    {factor:6.8, cooldown:4.6, radius:136, distance:165, life:5.0},
    {factor:8.4, cooldown:4.2, radius:148, distance:155, life:5.5},
    {factor:10.0,cooldown:3.9, radius:160, distance:145, life:6.0}
  ]);
  // Boss-only reduction preserves the identity of an AoE departure mine.
  const BOSS_MULTIPLIER=.45;
  const MIN_VISIBLE_TIME=.70, CHARGE_TIME=.32, AWAKEN_DELAY=.42;
  const EFFECT_LIFETIMES={burst:.64,break:.82,awaken:.84,fallout:1.02};
  const ready=img=>img?.naturalWidth>0&&img?.naturalHeight>0;
  const eligible=e=>!!e&&e.hp>0&&!e.dying&&!e.shield&&!e.vanish&&!e.done&&!e.invulnerable&&!e.untargetable;
  function spec(level,damage=1,mutations=[]){
    const cfg=TIERS[Math.max(0,Math.min(4,(level|0)-1))];
    const factor=cfg.factor*(mutations.includes("mut_seal_nail_deep")?1.25:1);
    return {...cfg,level,factor,damage:factor*damage,secondDamage:level===5?factor*damage*.45:0,
      radius:cfg.radius*(mutations.includes("mut_seal_nail_wide")?1.25:1),
      distance:cfg.distance-(mutations.includes("mut_seal_nail_near")?25:0),
      cooldown:cfg.cooldown*(mutations.includes("mut_seal_nail_swift")?.82:1),
      secondDelay:.24,secondOffset:94,bossMultiplier:BOSS_MULTIPLIER,maxTargets:7,
      cadenceEligible:false,reachEligible:false,critEligible:false};
  }
  function loadCandidateArt(){
    if(typeof window.Image!=="function")return {};
    const art={painted:true};
    const path=role=>"assets/img/vfx/skills/seal-nail/seal-nail__"+role+".webp";
    const roles={pin:"ofuda",burst:"shockwave",break:"shards",marker:"ward-ring",
      awaken:"rupture",pillar:"pillar",fallout:"fallout"};
    for(const [role,drawing] of Object.entries(roles)){
      const img=new window.Image();img.decoding="async";
      if(role==="pin"||role==="burst"||role==="break")
        img.onerror=()=>{img.onerror=null;img.src=path(role)+"?v=seal-nail-public-2";};
      img.src=path(drawing);
      art[role]=img;
    }
    return art;
  }
  function create({staged=false}={}){
    let pin=null, cooldown=0, delayed=null, effects=[], swift=false;
    const reset=()=>{pin=null;cooldown=0;delayed=null;effects=[];swift=false;};
    const suspend=()=>{pin=null;delayed=null;effects=[];};
    function effect(type,x,y,radius,angle=0){
      const life=staged?EFFECT_LIFETIMES[type]:.38;
      effects.push({type,x,y,radius,angle,life,max:life});
      if(effects.length>9)effects.shift();
    }
    function blast(x,y,radius,damage,enemies,hit){
      let hitCount=0;
      const alreadyHit=new Set();
      for(const e of enemies){
        if(hitCount>=7)break;
        if(!eligible(e)||alreadyHit.has(e)||Math.hypot(e.x-x,e.y-y)>radius+(e.r||0))continue;
        hit(e,damage*(e.type==="boss"?BOSS_MULTIPLIER:1),"seal_nail");
        alreadyHit.add(e);hitCount++;
      }
    }
    function tick({dt,level,start,end,dashing=false,enemies=[],hit,effectiveDamage=1,mutations=[],onEvent}){
      if(level<=0||!(dt>0))return;
      const cfg=spec(level,effectiveDamage,mutations);
      const nextSwift=mutations.includes("mut_seal_nail_swift");
      if(nextSwift&&!swift)cooldown*=.82;
      swift=nextSwift;
      cooldown=Math.max(0,cooldown-dt);
      effects=effects.filter(f=>(f.life-=dt)>0);
      if(delayed){
        delayed.time-=dt;
        if(delayed.time<=0){
          // At most one second wave, once per enemy and never a chain.
          blast(delayed.x,delayed.y,delayed.radius,delayed.damage,enemies,hit);
          effect(staged?"awaken":"burst",delayed.x,delayed.y,delayed.radius);
          if(staged)effect("fallout",delayed.x,delayed.y,delayed.radius,delayed.angle);
          onEvent?.("second");
          delayed=null;
        }
      }
      if(pin){
        pin.life-=dt;
        pin.radius=cfg.radius;
        if(pin.charge){
          pin.charge.time-=dt;
          if(pin.charge.time>0)return;
        }else{
          if(pin.life<=0){pin=null;return;}
          if(!end||!(Math.hypot(end.x-pin.x,end.y-pin.y)>=cfg.distance))return;
          const age=pin.maxLife-pin.life;
          const time=staged?Math.max(CHARGE_TIME,MIN_VISIBLE_TIME-age):0;
          pin.charge={angle:Math.atan2(end.y-pin.y,end.x-pin.x),time,max:time};
          if(staged)return;
        }
        const {x,y,charge:{angle}}=pin;
        blast(x,y,cfg.radius,cfg.damage,enemies,hit);
        effect("burst",x,y,cfg.radius);
        onEvent?.("burst");
        if(level===5){
          const time=staged?AWAKEN_DELAY:cfg.secondDelay;
          delayed={x:x+Math.cos(angle)*cfg.secondOffset,y:y+Math.sin(angle)*cfg.secondOffset,
            radius:cfg.radius*.78,damage:cfg.secondDamage,time,angle};
        }
        effect("break",x,y,cfg.radius,angle);
        pin=null;
        return;
      }
      // Deploy only on valid normal movement frames, never during dash.
      // A stationary player can wait but cannot auto-farm deployed damage.
      // Idle and collision-stalled frames must not spend a cast.
      if(!pin&&!delayed&&cooldown===0&&!dashing&&start&&end&&
          Math.hypot(end.x-start.x,end.y-start.y)>0.05){
        pin={x:start.x,y:start.y,life:cfg.life,maxLife:cfg.life,radius:cfg.radius};
        cooldown=cfg.cooldown;onEvent?.("drop");
      }
    }
    function paintMarker(ctx,img,x,y,size,alpha){
      if(!ready(img))return;
      ctx.save();ctx.globalAlpha*=alpha;
      ctx.drawImage(img,x-size/2,y-size/2,size,size);
      ctx.restore();
    }
    function paint(ctx,art={},fade=1){
      if(pin&&staged){
        const age=pin.maxLife-pin.life;
        const progress=pin.charge?1-pin.charge.time/pin.charge.max:0;
        const size=pin.charge?pin.radius*2:136;
        const alpha = pin.charge ? .66 + .34 * progress : .78 + Math.sin(age * 4.5) * .13;
        paintMarker(ctx,art.marker,pin.x,pin.y,size,fade*alpha);
      }
      if(pin&&ready(art.pin)){
        const alpha=fade*(pin.charge?1:Math.min(1,pin.life/.45));
        ctx.save();ctx.globalAlpha*=alpha;
        if(art.painted)ctx.drawImage(art.pin,pin.x-60,pin.y-70,120,101);
        else ctx.drawImage(art.pin,pin.x-66,pin.y-66,132,132);
        ctx.restore();
      }
      for(const f of effects){
        const img=f.type==="awaken"&&!ready(art.awaken)?art.burst:art[f.type];
        if(!ready(img))continue;
        const age = 1 - f.life / f.max;
        const shards = art.painted && (f.type === "break" || f.type === "fallout");
        const scale = art.painted
          ? (shards ? .45 + .65 * age : 1 - .45 * (1 - age) ** 5)
          : 1;
        const size = f.radius * (shards ? 1.5 : 2.2) * scale;
        const height = shards ? size * (276 / 320) : size;
        const alpha = fade * Math.min(1, f.life / (staged ? f.max*.72 : art.painted ? .22 : .12));
        ctx.save();ctx.globalAlpha*=alpha;
        ctx.translate(f.x,f.y);ctx.rotate(f.angle||0);
        ctx.drawImage(img,-size/2,-height/2,size,height);ctx.restore();
      }
      if(delayed&&staged){
        const progress=1-delayed.time/AWAKEN_DELAY;
        paintMarker(ctx,art.marker,delayed.x,delayed.y,delayed.radius*2,fade*(.56+.44*progress));
      }
    }
    function paintPillar(ctx,art={},upright=(_x,_y,draw)=>draw(),fade=1){
      if(!ready(art.pillar))return;
      for(const f of effects){
        if(f.type!=="awaken")continue;
        const age=f.max-f.life;
        const growth=1-Math.pow(1-Math.min(1,age/.18),3);
        const height=f.radius*(.72+.96*growth),width=height*art.pillar.naturalWidth/art.pillar.naturalHeight;
        upright(f.x,f.y,()=>{
          ctx.save();ctx.globalAlpha*=fade*Math.min(1,f.life/.49);
          ctx.drawImage(art.pillar,f.x-width/2,f.y-height+8,width,height);
          ctx.restore();
        });
      }
    }
    return {tick,reset,suspend,paint,paintPillar,snapshot:(level=1,mutations=[])=>({
      active:!!pin,pendingSecond:!!delayed,effects:effects.length,
      cooldown:Math.max(0,cooldown),cooldownMax:spec(level,1,mutations).cooldown
    })};
  }
  return Object.freeze({spec,create,loadCandidateArt});
})();
