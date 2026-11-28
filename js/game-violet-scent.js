// 第七招：紫藤毒香。連續走動留下粉紫煙霧，與封印釘的爆破陷阱不同。
// Only weapons(dt) advances poison and trail; raster-only visual effects.
window.GAME_VIOLET_SCENT = (() => {
  const TIERS = Object.freeze([
    {max:4, distance:62, interval:.30, radius:46, life:2.8, factor:2.0},
    {max:6, distance:56, interval:.27, radius:54, life:3.5, factor:2.7},
    {max:8, distance:52, interval:.24, radius:60, life:4.4, factor:3.5},
    {max:11,distance:48, interval:.22, radius:67, life:5.5, factor:4.3},
    {max:14,distance:45, interval:.20, radius:72, life:6.0, factor:5.2}
  ]);
  const TICK=.25, MAX_DOT_STEPS=2, MAX_VISUALS=12, BOSS_MULTIPLIER=.60;
  const CONFUSION_IMMUNITY=7;
  const eligible=e=>e&&e.hp>0&&!e.dying&&!e.shield&&!e.vanish&&!e.done&&!e.invulnerable&&!e.untargetable;
  function spec(level,damage=1,mutations=[]){
    const lvl=Math.max(1,Math.min(5,Number(level)||1));
    const base=TIERS[lvl-1],mods=new Set(mutations);
    // Long-night scent must actually persist under continuous movement:
    // the previous fixed cloud cap evicted a 7.8s Lv5 cloud after ~2.8s.
    // Space the linger clouds farther apart and bound the extra cloud count.
    const linger=mods.has("mut_ink_linger");
    const max=base.max+(linger?4:0);
    const life=base.life+(linger?1.8:0);
    const interval=linger?Math.max(base.interval,life/max):base.interval;
    return {...base,level:lvl,max,interval,damage:base.factor*damage,
      dps:base.factor*damage*(mods.has("mut_ink_razor")?1.25:1),
      radius:base.radius*(mods.has("mut_ink_bloom")?1.25:1)*(linger?1.10:1),
      life,
      poisonLife:2.0+(mods.has("mut_ink_echo")?1.6:0),
      confusionDuration:lvl===5?2.5+(mods.has("mut_ink_echo")?.5:0):0,
      confusionImmunity:CONFUSION_IMMUNITY,bossMultiplier:BOSS_MULTIPLIER,tickInterval:TICK,
      cadenceEligible:false,reachEligible:false,critEligible:false};
  }
  function loadCandidateArt(){
    if(typeof window.Image!=="function")return {};
    const art={painted:true};
    const path=role=>"assets/img/vfx/skills/violet-scent/violet-scent__"+role+".webp";
    const legacy={mist:"cloud",smoke:"poison",confuse:"confuse"};
    const roles={mist:"incense__f01",mistAlt:"incense__f02",smoke:"wisp",confuse:"spirals",
      awake:"butterfly-trail__f01",awakeAlt:"butterfly-trail__f02",butterflies:"bewildered"};
    for(const [key,role] of Object.entries(roles)){
      const img=new window.Image();img.decoding="async";
      if(legacy[key]){
        img.onerror=()=>{img.onerror=null;img.src=path(legacy[key])+"?v=violet-scent-public-2";};
      }
      img.src=path(role);art[key]=img;
    }
    return art;
  }
  function create(){
    let clouds=[],infections=new Map(),visuals=new Map(),travel=0,since=99,interval=TIERS[0].interval,revision=0;
    const reset=()=>{clouds=[];infections.clear();visuals.clear();travel=0;since=99;revision++;};
    const suspend=reset;
    function tick({dt,level,start,end,enemies=[],effectiveDamage=1,mutations=[],hit,onEvent}){
      if(!(level>0)||!(dt>0))return;
      const cfg=spec(level,effectiveDamage,mutations);
      interval=cfg.interval;
      since=Math.min(99,since+dt);
      let keepClouds=0;
      for(let i=0;i<clouds.length;i++){
        const c=clouds[i];
        c.life-=dt;
        if(c.life>0)clouds[keepClouds++]=c;
      }
      clouds.length=keepClouds;
      for(const [enemy,life] of visuals){
        const next=life-dt;
        if(next<=0)visuals.delete(enemy);
        else visuals.set(enemy,next);
      }

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
            clouds.push({x,y,life:cfg.life,maxLife:cfg.life,radius:cfg.radius,
              angle:Math.atan2(dy,dx),alternate:!clouds.at(-1)?.alternate,awakened:cfg.level===5});
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
        const current=revision;
        while(inf.tick+1e-9>=TICK&&steps<MAX_DOT_STEPS){
          inf.tick=Math.max(0,inf.tick-TICK);steps++;
          hit?.(enemy,inf.dps*TICK*(enemy.type==="boss"?BOSS_MULTIPLIER:1),"poison");
          if(current!==revision)return;
          if(enemy.hp<=0)break;
        }
        if(inf.remaining<=0||enemy.hp<=0)infections.delete(enemy);
      }
      // Bound visual update work independent of enemy count at 20 FPS.
      let visible=0;
      for(const enemy of infections.keys()){
        if(visible++>=MAX_VISUALS)break;
        visuals.delete(enemy);
        visuals.set(enemy,.18);
      }
      if(visible<MAX_VISUALS)for(const enemy of enemies){
        if(visible>=MAX_VISUALS)break;
        if(enemy.confusedT>0&&!infections.has(enemy)&&eligible(enemy)){
          visuals.delete(enemy);
          visuals.set(enemy,.18);
          visible++;
        }
      }
      while(visuals.size>MAX_VISUALS){
        const oldest=visuals.keys().next().value;
        visuals.delete(oldest);
      }
    }
    function paint(ctx,art={},fade=1){
      const main=art.mist?.naturalWidth>0?art.mist:null;
      const alternate=art.mistAlt?.naturalWidth>0?art.mistAlt:null;
      const awake=art.awake?.naturalWidth>0?art.awake:null;
      const awakeAlt=art.awakeAlt?.naturalWidth>0?art.awakeAlt:null;
      if(!main&&!alternate&&!awake&&!awakeAlt)return;
      for(const c of clouds){
        const awakened=c.awakened&&(c.alternate?awakeAlt||awake:awake||awakeAlt);
        const img=awakened||(c.alternate?alternate:main)||main||alternate;
        if(!img)continue;
        const age=c.maxLife-c.life;
        const spread = art.painted ? .9 + .16 * Math.min(1, age / 1.3) : 1;
        const w = c.radius * (art.painted ? 2.66 : 2.35) * spread;
        const h = c.radius * (art.painted ? 1.74 : 1.42) * spread;
        ctx.save();
        const opacity = awakened ? .87 : art.painted ? .72 : .86;
        ctx.globalAlpha *= fade * Math.min(opacity, c.life / .75)
          * Math.min(1, age / (art.painted ? .15 : .25));
        if(art.painted){
          ctx.translate(c.x,c.y);
          ctx.rotate(c.angle+Math.sin(age*2)*.07);
        }else{
          ctx.translate(c.x+Math.sin(age*2.8)*4,c.y-Math.sin(age*2.2)*6);
          ctx.rotate(c.angle*.15+Math.sin(age*1.5)*.08);
        }
        ctx.drawImage(img,-w/2,-h/2,w,h);
        ctx.restore();
      }
    }
    function paintEnemyImpacts(ctx,art={},upright=(_x,_y,draw)=>draw()){
      const poison=art.smoke?.naturalWidth>0?art.smoke:null;
      const butterflies=art.butterflies?.naturalWidth>0?art.butterflies:null;
      const confused=butterflies||(art.confuse?.naturalWidth>0?art.confuse:null);
      if(!poison&&!confused||!visuals.size)return;
      for(const e of visuals.keys()){
        if(!eligible(e))continue;
        upright(e.x,e.y,()=>{
          ctx.save();
          if(poison&&(!art.painted||infections.has(e))){
            ctx.globalAlpha *= art.painted ? .56 : .35;
            if(art.painted)ctx.drawImage(poison,e.x+6,e.y-55,25,59);
            else ctx.drawImage(poison,e.x-42,e.y-80,84,92);
          }
          if(e.confusedT>0&&confused&&e.type!=="boss"){
            ctx.globalAlpha=.78*Math.min(1,e.confusedT/.4);
            const t=e.confusedT*4.5,dx=Math.sin(t)*7;
            if(butterflies){
              const age=Math.max(0,CONFUSION_IMMUNITY-(e.confuseImmuneT||0));
              const size=58+Math.max(0,1-age/.25)*19;
              ctx.drawImage(butterflies,e.x-size/2+dx,e.y-112+Math.cos(t)*4,size,size);
            }else if(art.painted)ctx.drawImage(confused,e.x-20+dx,e.y-102,40,47);
            else ctx.drawImage(confused,e.x-47+dx,e.y-108,84,83);
          }
          ctx.restore();
        });
      }
    }
    return {reset,suspend,tick,paint,paintEnemyImpacts,
      cooldownRemaining:()=>Math.max(0,interval-since),cooldownMax:()=>interval,
      snapshot:()=>({marks:clouds.length,clouds:clouds.length,
        infected:infections.size,positions:clouds.map(c=>[c.x,c.y]),
        depositCooldown:Math.max(0,interval-since)})};
  }
  return Object.freeze({spec,create,loadCandidateArt});
})();
