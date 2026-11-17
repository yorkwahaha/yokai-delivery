// 第七招：墨跡・紫藤毒香。連續走動殘留毒香，而非觸碰即炸的一次性陷阱。
// Only weapons(dt) advances poison and trail; raster-only visual effects.
window.GAME_VIOLET_SCENT = (() => {
  const TIERS = Object.freeze([
    {max:4, distance:62, interval:.30, radius:46, life:2.8, factor:1.4},
    {max:6, distance:56, interval:.27, radius:54, life:3.5, factor:1.8},
    {max:8, distance:52, interval:.24, radius:60, life:4.4, factor:2.3},
    {max:11,distance:48, interval:.22, radius:67, life:5.5, factor:2.8},
    {max:14,distance:45, interval:.20, radius:72, life:6.0, factor:3.2}
  ]);
  const TICK=.5, MAX_DOT_STEPS=2, MAX_VISUALS=12, BOSS_MULTIPLIER=.35;
  const LOCAL_HOST=/^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/;
  const eligible=e=>e&&e.hp>0&&!e.dying&&!e.shield&&!e.vanish&&!e.done&&!e.invulnerable&&!e.untargetable;
  function spec(level,damage=1,mutations=[]){
    const lvl=Math.max(1,Math.min(5,Number(level)||1));
    const base=TIERS[lvl-1],mods=new Set(mutations);
    return {...base,level:lvl,interval:base.interval,damage:base.factor*damage,
      dps:base.factor*damage*(mods.has("mut_ink_razor")?1.25:1),
      radius:base.radius*(mods.has("mut_ink_bloom")?1.25:1),
      life:base.life+(mods.has("mut_ink_linger")?1.8:0),
      poisonLife:2.0+(mods.has("mut_ink_echo")?1.6:0),
      confusionDuration:lvl===5?2.5+(mods.has("mut_ink_echo")?.5:0):0,
      confusionImmunity:7.0,bossMultiplier:BOSS_MULTIPLIER,
      cadenceEligible:false,reachEligible:false,critEligible:false};
  }
  function loadCandidateArt(){
    if(!LOCAL_HOST.test(String(window.location?.hostname||""))||typeof window.Image!=="function")return {};
    const art={},base="art/skills/ink-trail/";
    // Old, user-unapproved painted wisps are temporary. Never use footprint
    // sprites, attack slash art, circles, or Canvas geometry for poison clouds.
    for(const [key,file] of Object.entries({
      mist:"ink-trail__fade-candidate-20261111-v2.webp",
      smoke:"ink-trail__burn-candidate-20261111-v3.webp"
    })){
      const img=new window.Image();img.decoding="async";
      img.src=base+file+"?v=violet-scent-preview-1";art[key]=img;
    }
    return art;
  }
  function create(){
    let clouds=[],infections=new Map(),visuals=[],travel=0,since=99;
    const reset=()=>{clouds=[];infections.clear();visuals=[];travel=0;since=99;};
    const suspend=reset;
    function tick({dt,level,start,end,enemies=[],effectiveDamage=1,mutations=[],hit,onEvent}){
      if(!(level>0)||!(dt>0))return;
      const cfg=spec(level,effectiveDamage,mutations);
      since=Math.min(99,since+dt);
      clouds=clouds.filter(c=>(c.life-=dt)>0);
      visuals=visuals.filter(v=>(v.life-=dt)>0);

      // Actual movement creates at most one cloud per frame: no stall burst
      // or timer-spawned damage while standing still. Dash is real movement.
      if(start&&end){
        const dx=end.x-start.x,dy=end.y-start.y;
        const moved=Math.hypot(dx,dy);
        if(moved>.1){
          travel=Math.min(cfg.distance,travel+moved);
          if(travel>=cfg.distance&&since>=cfg.interval){
            const back=Math.min(.75,25/Math.max(.01,moved));
            const x=end.x-dx*back,y=end.y-dy*back;
            clouds.push({x,y,life:cfg.life,maxLife:cfg.life,radius:cfg.radius,angle:Math.atan2(dy,dx)});
            if(clouds.length>cfg.max)clouds.shift();
            travel=0;since=0;onEvent?.("drop");
          }
        } else travel=0;
      }

      // Only one infection per enemy even if up to 14 cloud sprites overlap.
      // Poison continues briefly once the victim has left the trail.
      for(const enemy of enemies){
        if(!eligible(enemy))continue;
        let within=false;
        for(const cloud of clouds){
          const dx=enemy.x-cloud.x,dy=enemy.y-cloud.y;
          if(dx*dx+dy*dy<=(cloud.radius+(enemy.r||0))**2){within=true;break;}
        }
        if(!within)continue;
        let inf=infections.get(enemy);
        if(!inf){inf={remaining:0,tick:0,dps:0};infections.set(enemy,inf);}
        inf.remaining=cfg.poisonLife;
        inf.dps=cfg.dps;
        if(cfg.confusionDuration>0 && enemy.type!=="boss" &&
            !(enemy.confuseImmuneT>0) && !(enemy.confusedT>0)){
          enemy.confusedT=cfg.confusionDuration;
          enemy.confuseImmuneT=cfg.confusionImmunity;
          enemy.confuseSwapT=0;
          enemy.confuseTarget=null;
          onEvent?.("confuse");
        }
      }

      for(const [enemy,inf] of infections){
        if(!eligible(enemy)||inf.remaining<=0){infections.delete(enemy);continue;}
        const activeDt=Math.min(dt,inf.remaining);
        inf.remaining=Math.max(0,inf.remaining-dt);
        inf.tick+=activeDt;
        let steps=0;
        while(inf.tick>=TICK&&steps<MAX_DOT_STEPS){
          inf.tick-=TICK;steps++;
          hit?.(enemy,inf.dps*TICK*(enemy.type==="boss"?BOSS_MULTIPLIER:1),"poison");
          if(enemy.hp<=0)break;
        }
        if(inf.remaining<=0||enemy.hp<=0)infections.delete(enemy);
      }
      // Bound visual update work independent of enemy count at 20 FPS.
      let visible=0;
      for(const enemy of infections.keys()){
        if(visible++>=MAX_VISUALS)break;
        visuals.push({target:enemy,life:.18,max:.18});
      }
      if(visuals.length>MAX_VISUALS)visuals=visuals.slice(-MAX_VISUALS);
    }
    function paint(ctx,art={},fade=1){
      const img=art.mist?.naturalWidth>0?art.mist:null;
      if(!img)return;
      for(const c of clouds){
        const age=c.maxLife-c.life,w=c.radius*2.35,h=c.radius*1.42;
        ctx.save();
        ctx.globalAlpha*=fade*Math.min(.68,c.life/.75)*Math.min(1,age/.25);
        ctx.translate(c.x+Math.sin(age*2.8)*4,c.y-Math.sin(age*2.2)*6);
        ctx.rotate(c.angle*.15+Math.sin(age*1.5)*.08);
        ctx.drawImage(img,-w/2,-h/2,w,h);
        ctx.restore();
      }
    }
    function paintEnemyImpacts(ctx,art={},upright=(_x,_y,draw)=>draw()){
      const img=art.smoke?.naturalWidth>0?art.smoke:null;
      if(!img)return;
      const drawn=new Set();
      for(const v of visuals){
        const e=v.target;
        if(!eligible(e)||drawn.has(e))continue;
        drawn.add(e);
        upright(e.x,e.y,()=>{
          ctx.save();ctx.globalAlpha*=e.confusedT>0?.58:.27;
          ctx.drawImage(img,e.x-39,e.y-79,78,88);ctx.restore();
        });
      }
    }
    return {reset,suspend,tick,paint,paintEnemyImpacts,
      snapshot:(level=1)=>({marks:clouds.length,clouds:clouds.length,
        infected:infections.size,positions:clouds.map(c=>[c.x,c.y]),
        depositCooldown:Math.max(0,spec(level).interval-since)})};
  }
  return Object.freeze({spec,create,loadCandidateArt});
})();
