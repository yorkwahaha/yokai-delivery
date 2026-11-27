// 距爆・封印釘：independent single-use mines activated by a monster stepping on the center.
// All effects advance inside weapons(dt); no timers, geometry art, or extra input.
window.GAME_SEAL_NAIL = (() => {
  const TIERS = Object.freeze([
    {factor:5, cooldown:3.6, radius:125, life:4.0, maxPins:1},
    {factor:7, cooldown:3.0, radius:145, life:4.5, maxPins:2},
    {factor:9, cooldown:2.5, radius:165, life:5.0, maxPins:2},
    {factor:11,cooldown:2.0, radius:185, life:5.5, maxPins:3},
    {factor:14,cooldown:1.6, radius:210, life:6.0, maxPins:3}
  ]);
  // Boss-only reduction preserves the identity of an AoE departure mine.
  const BOSS_MULTIPLIER=.80, MAX_TARGETS=15;
  const TRIGGER_RADIUS=36, AWAKEN_DELAY=.42;
  const EFFECT_LIFETIMES={burst:.64,break:.82,awaken:.84,fallout:1.02};
  const ready=img=>img?.naturalWidth>0&&img?.naturalHeight>0;
  const eligible=e=>!!e&&e.hp>0&&!e.dying&&!e.shield&&!e.vanish&&!e.done&&!e.invulnerable&&!e.untargetable;
  function spec(level,damage=1,mutations=[]){
    const cfg=TIERS[Math.max(0,Math.min(4,(level|0)-1))];
    const factor=cfg.factor*(mutations.includes("mut_seal_nail_deep")?1.25:1);
    return {...cfg,level,factor,damage:factor*damage,secondDamage:level===5?factor*damage*.60:0,
      radius:cfg.radius*(mutations.includes("mut_seal_nail_wide")?1.25:1),
      triggerRadius:TRIGGER_RADIUS+(mutations.includes("mut_seal_nail_near")?20:0),
      cooldown:cfg.cooldown*(mutations.includes("mut_seal_nail_swift")?.82:1),
      secondDelay:.24,secondOffset:94,bossMultiplier:BOSS_MULTIPLIER,maxTargets:MAX_TARGETS,
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
    let pins=[], cooldown=0, delayed=[], effects=[], swift=false, revision=0;
    const suspend=()=>{pins=[];delayed=[];effects=[];revision++;};
    const reset=()=>{suspend();cooldown=0;swift=false;};
    function effect(type,x,y,radius,angle=0){
      const life=staged?EFFECT_LIFETIMES[type]:.38;
      effects.push({type,x,y,radius,angle,life,max:life});
      if(effects.length>12)effects.shift();
    }
    function blast(x,y,radius,damage,enemies,hit,current){
      const alreadyHit=new Set();
      for(const e of enemies){
        if(alreadyHit.size>=MAX_TARGETS)break;
        if(!eligible(e)||alreadyHit.has(e)||Math.hypot(e.x-x,e.y-y)>radius+(e.r||0))continue;
        alreadyHit.add(e);
        hit?.(e,damage*(e.type==="boss"?BOSS_MULTIPLIER:1),"seal_nail");
        if(current!==revision)return false;
      }
      return true;
    }
    function tick({dt,level,start,end,dashing=false,enemies=[],hit,effectiveDamage=1,mutations=[],onEvent}){
      if(level<=0||!(dt>0))return;
      const cfg=spec(level,effectiveDamage,mutations);
      const nextSwift=mutations.includes("mut_seal_nail_swift");
      if(nextSwift&&!swift)cooldown*=.82;
      swift=nextSwift;
      cooldown=Math.max(0,cooldown-dt);
      effects=effects.filter(f=>(f.life-=dt)>0);
      const current=revision;
      for(let i=0;i<delayed.length;){
        const wave=delayed[i];
        if((wave.time-=dt)>0){i++;continue;}
        delayed.splice(i,1);
        if(!blast(wave.x,wave.y,wave.radius,wave.damage,enemies,hit,current))return;
        effect(staged?"awaken":"burst",wave.x,wave.y,wave.radius);
        if(staged)effect("fallout",wave.x,wave.y,wave.radius,wave.angle);
        onEvent?.("second");
      }
      for(let i=0;i<pins.length;){
        const pin=pins[i];
        pin.life-=dt;
        pin.radius=cfg.radius;
        pin.triggerRadius=cfg.triggerRadius;
        if(pin.life<=0){pins.splice(i,1);continue;}
        // Only an eligible enemy center crossing the small trigger zone can detonate the mine.
        const trigger=enemies.find(e=>eligible(e)&&Math.hypot(e.x-pin.x,e.y-pin.y)<=cfg.triggerRadius);
        if(!trigger){i++;continue;}
        const {x,y}=pin;
        const angle=Math.hypot(trigger.x-x,trigger.y-y)>1e-6?Math.atan2(trigger.y-y,trigger.x-x):pin.angle;
        pins.splice(i,1);
        if(!blast(x,y,cfg.radius,cfg.damage,enemies,hit,current))return;
        effect("burst",x,y,cfg.radius);
        onEvent?.("burst");
        if(level===5){
          const time=staged?AWAKEN_DELAY:cfg.secondDelay;
          delayed.push({x:x+Math.cos(angle)*cfg.secondOffset,y:y+Math.sin(angle)*cfg.secondOffset,
            radius:cfg.radius*.78,damage:cfg.secondDamage,time,angle});
        }
        effect("break",x,y,cfg.radius,angle);
      }
      // Deploy only on valid normal movement frames, never during dash.
      // A stationary player cannot deploy new mines; existing mines remain armed.
      // Idle and collision-stalled frames must not spend a cast.
      if(pins.length<cfg.maxPins&&cooldown<=1e-9&&!dashing&&start&&end&&
          Math.hypot(end.x-start.x,end.y-start.y)>0.05){
        pins.push({x:start.x,y:start.y,life:cfg.life,maxLife:cfg.life,radius:cfg.radius,
          triggerRadius:cfg.triggerRadius,angle:Math.atan2(end.y-start.y,end.x-start.x)});
        cooldown=cfg.cooldown;onEvent?.("drop");
      }
    }
    function paintMarker(ctx,img,x,y,size,alpha){
      if(!ready(img))return;
      ctx.save();ctx.globalAlpha*=alpha;
      ctx.drawImage(img,img.naturalWidth*12/384,img.naturalHeight*16/384,
        img.naturalWidth*359/384,img.naturalHeight*350/384,x-size/2,y-size/2,size,size);
      ctx.restore();
    }
    function paint(ctx,art={},fade=1){
      for(const pin of pins){
        if(staged){
          const age=pin.maxLife-pin.life;
          const size=pin.triggerRadius*2;
          const alpha=.78+Math.sin(age*4.5)*.13;
          paintMarker(ctx,art.marker,pin.x,pin.y,size,fade*alpha);
        }
        if(ready(art.pin)){
          const alpha=fade*Math.min(1,pin.life/.45);
          ctx.save();ctx.globalAlpha*=alpha;
          if(art.painted)ctx.drawImage(art.pin,pin.x-60,pin.y-70,120,101);
          else ctx.drawImage(art.pin,pin.x-66,pin.y-66,132,132);
          ctx.restore();
        }
      }
      for(const f of effects){
        const img=f.type==="awaken"&&!ready(art.awaken)?art.burst:art[f.type];
        if(!ready(img))continue;
        const age = 1 - f.life / f.max;
        const shards = art.painted && (f.type === "break" || f.type === "fallout");
        // The blast is already live at full radius on its first rendered frame.
        const scale = shards ? .45 + .65 * age : 1;
        const size = f.radius * (shards ? 1.5 : 2) * scale;
        const height = shards ? size * (276 / 320) : size;
        const alpha = fade * Math.min(1, f.life / (staged ? f.max*.72 : art.painted ? .22 : .12));
        ctx.save();ctx.globalAlpha*=alpha;
        ctx.translate(f.x,f.y);ctx.rotate(f.angle||0);
        if(art.painted&&!shards){
          const inset=f.type==="awaken"&&img===art.awaken?[13,32,422,383]:[13,17,423,414];
          ctx.drawImage(img,inset[0]*img.naturalWidth/448,inset[1]*img.naturalHeight/448,
            inset[2]*img.naturalWidth/448,inset[3]*img.naturalHeight/448,-size/2,-height/2,size,height);
        }else ctx.drawImage(img,-size/2,-height/2,size,height);
        ctx.restore();
      }
      if(staged)for(const wave of delayed){
        const progress=1-wave.time/AWAKEN_DELAY;
        paintMarker(ctx,art.marker,wave.x,wave.y,wave.radius*2,fade*(.56+.44*progress));
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
    return {tick,reset,suspend,paint,paintPillar,activeCount:()=>pins.length,
      snapshot:(level=1,mutations=[])=>({
      active:pins.length>0,activeCount:pins.length,pendingSecond:delayed.length>0,secondCount:delayed.length,effects:effects.length,
      cooldown:Math.max(0,cooldown),cooldownMax:spec(level,1,mutations).cooldown
    })};
  }
  return Object.freeze({spec,create,loadCandidateArt});
})();
