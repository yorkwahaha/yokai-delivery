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
  const LOCAL_HOST=/^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/;
  const eligible=e=>!!e&&e.hp>0&&!e.dying&&!e.shield&&!e.vanish&&!e.done&&!e.invulnerable&&!e.untargetable;
  function spec(level,damage=1){
    const cfg=TIERS[Math.max(0,Math.min(4,(level|0)-1))];
    return {...cfg,level,damage:cfg.factor*damage,secondDamage:level===5?cfg.factor*damage*.45:0,
      secondDelay:.24,secondOffset:94,bossMultiplier:.50,maxTargets:7,
      cadenceEligible:false,reachEligible:false,critEligible:false};
  }
  function loadCandidateArt(){
    if(!LOCAL_HOST.test(String(window.location?.hostname||""))||typeof window.Image!=="function")return {};
    const art={};
    for(const role of ["pin","burst","break"]){
      const img=new window.Image();img.decoding="async";
      img.src="art/skills/seal-nail/seal-nail__"+role+"-candidate-20261117.webp";
      art[role]=img;
    }
    return art;
  }
  function create(){
    let pin=null, cooldown=0, delayed=null, effects=[];
    const reset=()=>{pin=null;cooldown=0;delayed=null;effects=[];};
    const suspend=()=>{pin=null;delayed=null;effects=[];};
    function effect(type,x,y,radius,angle=0){
      effects.push({type,x,y,radius,angle,life:.38,max:.38});
      if(effects.length>9)effects.shift();
    }
    function blast(x,y,radius,damage,enemies,hit,alreadyHit=new Set()){
      let hitCount=0;
      for(const e of enemies){
        if(hitCount>=7)break;
        if(!eligible(e)||alreadyHit.has(e)||Math.hypot(e.x-x,e.y-y)>radius+(e.r||0))continue;
        hit(e,damage*(e.type==="boss"?0.50:1),"seal_nail");
        alreadyHit.add(e);hitCount++;
      }
      effect("burst",x,y,radius);
      return alreadyHit;
    }
    function tick({dt,level,start,end,dashing=false,enemies=[],hit,effectiveDamage=1,onEvent}){
      if(level<=0||!(dt>0))return;
      const cfg=spec(level,effectiveDamage);
      cooldown=Math.max(0,cooldown-dt);
      effects=effects.filter(f=>(f.life-=dt)>0);
      if(delayed){
        delayed.time-=dt;
        if(delayed.time<=0){
          // At most one second wave, once per enemy and never a chain.
          blast(delayed.x,delayed.y,delayed.radius,delayed.damage,enemies,hit,delayed.hit);
          onEvent?.("second");
          delayed=null;
        }
      }
      if(pin){
        pin.life-=dt;
        if(pin.life<=0){pin=null;return;}
        if(end&&Math.hypot(end.x-pin.x,end.y-pin.y)>=cfg.distance){
          const dx=end.x-pin.x,dy=end.y-pin.y,length=Math.hypot(dx,dy)||1;
          const ux=dx/length,uy=dy/length;
          const centerX=pin.x,centerY=pin.y;
          blast(centerX,centerY,cfg.radius,cfg.damage,enemies,hit);
          onEvent?.("burst");
          if(level===5){
            delayed={x:centerX+ux*cfg.secondOffset,y:centerY+uy*cfg.secondOffset,
              radius:cfg.radius*.78,damage:cfg.secondDamage,time:cfg.secondDelay,
              hit:new Set()};
          }
          effect("break",centerX,centerY,cfg.radius,Math.atan2(uy,ux));
          pin=null;
          return;
        }
      }
      // Deploy only on valid normal movement frames, never during dash.
      // A stationary player can wait but cannot auto-farm deployed damage.
      if(!pin&&!delayed&&cooldown===0&&!dashing&&start&&end){
        pin={x:start.x,y:start.y,life:cfg.life,maxLife:cfg.life};
        cooldown=cfg.cooldown;onEvent?.("drop");
      }
    }
    function paint(ctx,art={},fade=1){
      const ready=img=>img?.naturalWidth>0&&img?.naturalHeight>0;
      if(pin&&ready(art.pin)){
        const alpha=fade*Math.min(1,pin.life/.45);
        ctx.save();ctx.globalAlpha*=alpha;
        ctx.drawImage(art.pin,pin.x-66,pin.y-66,132,132);ctx.restore();
      }
      for(const f of effects){
        const img=f.type==="break"?art.break:art.burst;
        if(!ready(img))continue;
        const size=f.radius*2.2,alpha=fade*Math.min(1,f.life/.12);
        ctx.save();ctx.globalAlpha*=alpha;
        ctx.translate(f.x,f.y);ctx.rotate(f.angle||0);
        ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();
      }
    }
    return {tick,reset,suspend,paint,snapshot:(level=1)=>({
      active:!!pin,pendingSecond:!!delayed,effects:effects.length,
      cooldown:Math.max(0,cooldown),cooldownMax:spec(level).cooldown
    })};
  }
  return Object.freeze({spec,create,loadCandidateArt});
})();
