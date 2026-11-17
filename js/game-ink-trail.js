// 墨跡・步痕。Only weapons(dt) advances combat; no timers or independent attack loop.
// Until raster candidates are user-approved, paint() deliberately has no geometric fallback.
window.GAME_INK_TRAIL = (() => {
  const TIERS = Object.freeze([
    {factor:3.0,max:3,distance:95,interval:.65,radius:70,burstRadius:105,life:8.0},
    {factor:4.2,max:3,distance:90,interval:.60,radius:75,burstRadius:112,life:8.5},
    {factor:5.5,max:3,distance:85,interval:.56,radius:80,burstRadius:119,life:9.0},
    {factor:6.9,max:3,distance:80,interval:.52,radius:84,burstRadius:126,life:9.5},
    {factor:8.4,max:3,distance:78,interval:.50,radius:88,burstRadius:133,life:10.0}
  ]);
  const BOSS_SCALE=.50, MAX_LINK=410, RELEASE_DISTANCE=260, MIN_MARK_HOLD=2.0, BURST_TARGET_CAP=7;
  const LOCAL_HOST=/^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/;
  // A gameplay-local preview only. No unapproved art is requested by production.
  function loadCandidateArt() {
    if (!LOCAL_HOST.test(String(window.location?.hostname || "")) ||
        typeof window.Image !== "function") return {};
    const base="art/skills/ink-trail/";
    const suffix="-candidate-20261111-v2.webp?v=ink-vfx-preview-r3";
    const art={};
    for(const key of ["dot","impact","fade","slash","burn","footprint"]){
      const image=new window.Image();
      image.decoding="async";
      image.src=base+"ink-trail__"+key+(key==="burn"||key==="footprint"
        ? "-candidate-20261111-v3.webp?v=ink-vfx-preview-r3" : suffix);
      art[key]=image;
    }
    return art;
  }
  const spec=(level,damage=1,mutations=[])=>{
    const cfg=TIERS[Math.max(0,Math.min(4,(level|0)-1))];
    const mods=new Set(mutations);
    const bloom=mods.has("mut_ink_bloom"),razor=mods.has("mut_ink_razor"),linger=mods.has("mut_ink_linger");
    return {...cfg,level,damage:cfg.factor*damage*(razor?1.22:1),
      distance:cfg.distance*(linger?0.85:1),life:cfg.life+(linger?2.5:0),
      burstRadius:cfg.burstRadius*(bloom?1.20:1),bossMultiplier:BOSS_SCALE,
      slashDamage:level===5?7.5*damage*(razor?1.30:1):0,
      slashCooldown:2.0,slashWidth:42,burstTargetCap:bloom?9:BURST_TARGET_CAP};
  };
  const eligible=e=>e&&e.hp>0&&!e.dying&&!e.shield&&!e.vanish&&!e.done&&!e.invulnerable&&!e.untargetable;
  function linkHit(e,a,b,r) {
    const dx=b.x-a.x,dy=b.y-a.y,sq=dx*dx+dy*dy;
    if(sq<1||sq>MAX_LINK*MAX_LINK)return false;
    const t=Math.max(0,Math.min(1,((e.x-a.x)*dx+(e.y-a.y)*dy)/sq));
    return Math.hypot(e.x-a.x-t*dx,e.y-a.y-t*dy)<=r+(e.r||0);
  }
  function create(){
    let marks=[],effects=[],echoes=[],distance=0,since=99,slashCd=0,history=[];
    const clear=()=>{marks=[];effects=[];echoes=[];distance=0;since=99;slashCd=0;history=[];};
    // Discard all active attack zones on reading/curse transitions; never queue hits.
    const suspend=()=>{marks=[];effects=[];echoes=[];distance=0;since=0;history=[];};
    function trailPosition(start,end,offset=40){
      // Backtrack 40px along the actual travelled polyline, preserving corners.
      let px=end.x,py=end.y,remain=offset;
      for(let i=history.length-2;i>=0;i--){
        const q=history[i],segment=Math.hypot(px-q.x,py-q.y);
        if(segment>=remain){
          const f=remain/segment;
          return {x:px+(q.x-px)*f,y:py+(q.y-py)*f};
        }
        remain-=segment;px=q.x;py=q.y;
      }
      return {x:px,y:py};
    }
    function effect(type,x,y,links=null,target=null){
      const duration=type==="burn"?.55:type==="slash"?.64:type==="awaken"?.66:type==="impact"?.34:.30;
      effects.push({type,x,y,links,target,life:duration,max:duration});
      if(effects.length>18)effects.shift();
    }
    function activateSlash(level,cfg,enemies,hit,end,onEvent){
      if(level!==5||marks.length<3||slashCd>0)return;
      const links=[];
      for(let i=1;i<marks.length;i++){
        const a=marks[i-1],b=marks[i];
        if(Math.hypot(b.x-a.x,b.y-a.y)<=MAX_LINK)links.push([a,b]);
      }
      if(!links.length)return;
      slashCd=cfg.slashCooldown;
      onEvent?.("awaken");
      // One unique hit per enemy PER activation, even for overlapping strokes.
      for(const e of enemies){
        if(eligible(e)&&links.some(([a,b])=>linkHit(e,a,b,cfg.slashWidth))){
          hit(e,cfg.slashDamage*(e.type==="boss"?BOSS_SCALE:1),"slash");
          effect("burn",e.x,e.y,null,e);
        }
      }
      effect("slash",end.x,end.y,links);
      effect("awaken",end.x,end.y);
      for(const m of marks)effect("impact",m.x,m.y);
    }
    function tick({dt,level,start,end,dashing=false,enemies=[],hit,effectiveDamage=1,mutations=[],onEvent}){
      if(!level||!(dt>0))return;
      const cfg=spec(level,effectiveDamage,mutations);
      since=Math.min(99,since+dt);slashCd=Math.max(0,slashCd-dt);
      // Delayed echoes are resolved only by the normal weapons(dt) attack tick.
      // They never hit anyone already struck by the parent explosion.
      for(const echo of echoes){
        echo.delay-=dt;
        if(echo.delay>0)continue;
        const fresh=enemies.filter(target=>eligible(target)&&!echo.previous.has(target)
          && Math.hypot(target.x-echo.x,target.y-echo.y)<=echo.radius+(target.r||0)).slice(0,4);
        for(const target of fresh){
          hit(target,echo.damage*(target.type==="boss"?BOSS_SCALE:1),"echo");
          effect("burn",target.x,target.y,null,target);
        }
        if(fresh.length){effect("impact",echo.x,echo.y);onEvent?.("echo");}
      }
      echoes=echoes.filter(e=>e.delay>0);
      // Age previous frame's sprites BEFORE producing new effects. Otherwise
      // a long frame erases a just-created expiration flash in the same tick.
      effects=effects.filter(f=>(f.life-=dt)>0);
      marks=marks.filter(m=>{
        m.life-=dt;
        if(m.life>0) return true;
        effect("fade",m.x,m.y);
        return false;
      });
      const pointHitThisTick=new Set();
      for(const mark of marks){
        for(const e of enemies){
          if(!eligible(e))continue;
          const previous=mark.lastPositions.get(e);
          mark.lastPositions.set(e,{x:e.x,y:e.y});
          if(pointHitThisTick.has(e))continue;
          // Contact the real walking trail capsule, not a tiny circular puddle.
          const segX=mark.bx-mark.ax,segY=mark.by-mark.ay,seg2=segX*segX+segY*segY;
          const t=seg2>0?Math.max(0,Math.min(1,((e.x-mark.ax)*segX+(e.y-mark.ay)*segY)/seg2)):0;
          let touched=Math.hypot(e.x-(mark.ax+t*segX),e.y-(mark.ay+t*segY))<=mark.radius+(e.r||0);
          if(!touched && previous && Math.hypot(e.x-previous.x,e.y-previous.y)<=180){
            const vx=e.x-previous.x,vy=e.y-previous.y,len2=vx*vx+vy*vy;
            if(len2>0){
              const t=Math.max(0,Math.min(1,((mark.x-previous.x)*vx+(mark.y-previous.y)*vy)/len2));
              touched=Math.hypot(previous.x+t*vx-mark.x,previous.y+t*vy-mark.y)<=mark.radius+(e.r||0);
            }
          }
          if(!touched)continue;
          if(e.type==="boss"&&mark.bossHits.has(e))continue;
          // Trigger a ONE-TIME ink explosion at the contact point, not a
          // single-target footstep scratch. The mark may hit at most seven
          // nearby enemies, once each, and can never multi-hit a Boss.
          const targets=enemies.filter(target=>eligible(target)
            && !pointHitThisTick.has(target)
            && !(target.type==="boss"&&mark.bossHits.has(target))
            && Math.hypot(target.x-e.x,target.y-e.y)<=cfg.burstRadius+(target.r||0))
            .slice(0,cfg.burstTargetCap);
          for(const target of targets){
            const primary=target===e;
            hit(target,cfg.damage*(primary?1:.78)*(target.type==="boss"?BOSS_SCALE:1),"point");
            if(target.type==="boss")mark.bossHits.add(target);
            pointHitThisTick.add(target);
            effect("burn",target.x,target.y,null,target);
          }
          if(targets.length) {
            onEvent?.("hit");
            effect("impact",e.x,e.y);
            if(mutations.includes("mut_ink_echo")){
              echoes.push({x:e.x,y:e.y,delay:.28,damage:cfg.damage*.30,
                radius:cfg.burstRadius*.70,previous:new Set(targets)});
              if(echoes.length>3)echoes.shift();
            }
          }
          // Ordinary enemy contact spends the trap; Boss-only contact can
          // never farm damage but leaves the mark for a later normal pursuer.
          if(targets.some(target=>target.type!=="boss"))mark.consumed=true;
          break;
        }
      }
      marks=marks.filter(m=>!m.consumed);
      // Only actual normal displacement. No dash distance backfill, idle farming,
      // timer-triggered spawns, or backlog of deposits on a slow frame.
      if(dashing||!start||!end){distance=0;history=[];return;}
      const moved=Math.hypot(end.x-start.x,end.y-start.y);
      if(moved<.1){distance=0;history=[];return;}
      if(!history.length)history.push({x:start.x,y:start.y});
      // Only one sample per movement tick, even if we backtrack twice.
      history.push({x:end.x,y:end.y});
      if(history.length>32)history.shift();
      const pos=trailPosition(start,end);
      const back=trailPosition(start,end,Math.min(120,cfg.distance+45));
      // Do not prematurely replace traps. Oldest may be retired only after
      // walking far out of its combat zone, or naturally at 8-10 seconds.
      if(marks.length>=cfg.max){
        const oldest=marks[0];
        if(oldest.maxLife-oldest.life<MIN_MARK_HOLD ||
          Math.hypot(end.x-oldest.x,end.y-oldest.y)<=RELEASE_DISTANCE){
          distance=0;
          activateSlash(level,cfg,enemies,hit,end,onEvent);
          return;
        }
        marks.shift();
      }
      distance=Math.min(cfg.distance,distance+moved);
      if(distance<cfg.distance||since<cfg.interval){
        activateSlash(level,cfg,enemies,hit,end,onEvent);
        return;
      }
      const mark={x:pos.x,y:pos.y,ax:back.x,ay:back.y,bx:end.x,by:end.y,
        angle:Math.atan2(end.y-back.y,end.x-back.x),life:cfg.life,maxLife:cfg.life,
        radius:cfg.radius,bossHits:new Set(),lastPositions:new WeakMap()};
      for(const e of enemies) if(e&&typeof e==="object")
        mark.lastPositions.set(e,{x:e.x,y:e.y});
      marks.push(mark);
      distance=0;since=0;
      onEvent?.("drop");
      activateSlash(level,cfg,enemies,hit,end,onEvent);
    }
    function paint(ctx,art={},fade=1){
      const ready=image=>image&&image.naturalWidth>0&&image.naturalHeight>0;
      if(ready(art.footprint)||ready(art.dot))for(const m of marks){
        // Player-owned directional footprints, never a rotating danger puddle.
        const img=ready(art.footprint)?art.footprint:art.dot;
        const age=m.maxLife-m.life;
        const w=m.radius*2.55*(1+Math.sin(age*3.8)*.025);
        const h=m.radius*1.35;
        ctx.save();ctx.globalAlpha*=fade*Math.min(.96,m.life/.6);
        ctx.translate(m.x,m.y);
        ctx.rotate(m.angle);
        ctx.drawImage(img,-w/2,-h/2,w,h);
        ctx.restore();
      }
      for(const f of effects){
        const opacity=fade*Math.min(1,f.life/.12);
        if(f.type==="impact"&&ready(art.impact)){
          ctx.save();ctx.globalAlpha*=opacity;
          ctx.drawImage(art.impact,f.x-69,f.y-52,138,104);ctx.restore();
        }else if(f.type==="fade"&&ready(art.fade)){
          ctx.save();ctx.globalAlpha*=opacity*.6;
          ctx.drawImage(art.fade,f.x-33,f.y-20,66,40);ctx.restore();
        }else if(f.type==="slash"&&ready(art.slash))for(const [a,b] of f.links){
          const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
          ctx.save();ctx.globalAlpha*=opacity;
          ctx.translate((a.x+b.x)/2,(a.y+b.y)/2);ctx.rotate(Math.atan2(dy,dx));
          ctx.globalCompositeOperation="screen";
          ctx.drawImage(art.slash,-length/2,-62,length,124);ctx.restore();
        }
      }
    }
    function paintEnemyImpacts(ctx,art={},upright=(x,y,draw)=>draw()){
      const img=art.burn?.naturalWidth>0?art.burn:art.impact;
      for(const f of effects){
        if(f.life<=0)continue;
        if(f.type==="awaken" && art.slash?.naturalWidth>0){
          upright(f.x,f.y,()=>{
            ctx.save();
            const u=1-f.life/f.max;
            const flash=Math.sin(Math.PI*Math.min(1,u));
            ctx.globalAlpha=flash*.95;
            ctx.globalCompositeOperation="screen";
            // Three interleaved painted brush strokes: bright impact core,
            // secondary crossing ink and a vertical purple-flame crown.
            // All image layers are raster previews, not Canvas geometry.
            ctx.drawImage(art.slash,f.x-205,f.y-146,410,226);
            ctx.globalAlpha=flash*.70;
            ctx.drawImage(art.slash,f.x-145,f.y-198,290,260);
            if(art.burn?.naturalWidth>0){
              ctx.globalAlpha=flash*.78;
              ctx.drawImage(art.burn,f.x-124,f.y-228,248,250);
            }
            ctx.restore();
          });
          continue;
        }
        if(f.type!=="burn"||!img?.naturalWidth)continue;
        const e=f.target;
        const x=Number.isFinite(e?.x)?e.x:f.x,y=Number.isFinite(e?.y)?e.y:f.y;
        const boss=e?.type==="boss";
        const size=boss?156:110,progress=1-f.life/f.max;
        upright(x,y,()=>{
          ctx.save();
          ctx.globalAlpha=Math.sin(Math.PI*Math.max(0,Math.min(1,progress)))*.93;
          ctx.globalCompositeOperation="screen";
          ctx.drawImage(img,x-size/2,y-size*1.04,size,size*1.12);
          ctx.restore();
        });
      }
    }
    return {reset:clear,suspend,tick,paint,paintEnemyImpacts,
      snapshot:(level=1)=>({marks:marks.length,effects:effects.length,echoes:echoes.length,
        depositCooldown:Math.max(0,spec(level).interval-since),
        slashCooldown:slashCd,positions:marks.map(m=>[m.x,m.y])})};
  }
  return Object.freeze({spec,create,loadCandidateArt});
})();
