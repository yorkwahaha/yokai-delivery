// Sakura Pass only: locked tells, committed wind attacks and staggered roots.
(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const enraged = e => !!e.final && e.hp <= e.max * .5;
  const walkSpeed = index => [130, 140, 150, 165][index] || 130;
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1), 0, 1);
    return Math.hypot(p.x-a.x-dx*t, p.y-a.y-dy*t);
  }
  function start(e, p, options = {}) {
    if (!e || e.hp <= 0 || e.shield || e.hazard || !p) return false;
    const rage = enraged(e), chain = !!e._sakuraFollowup;
    e._sakuraFollowup = false;
    const pool = e.bossIndex === 0 ? ['sakuraRush','sakuraFan','sakuraBloom']
      : e.bossIndex === 1 ? ['sakuraFan','sakuraBloom','sakuraRush']
      : ['sakuraRush','sakuraBloom','sakuraFan'];
    const turn = e._sakuraAttackStep || 0;
    const kind = chain ? 'sakuraRush' : pool[turn % pool.length];
    if (!chain) e._sakuraAttackStep = turn + 1;
    const footOffsetY = Math.max(0, Number(options.bossVisualFootOffsetY) || 0);
    const origin = {x:e.x,y:e.y+footOffsetY};
    const angle = Math.atan2(p.y-origin.y, p.x-origin.x);
    const blocked = options.blocked || (() => false);
    const h = {kind,sakura:true,phase:'telegraph',t:0,x:origin.x,y:origin.y,angle,
      footOffsetY,chain,rage,hit:false,duration:rage ? .9 : 1.02,
      recoveryDuration:rage ? .68 : .85};
    if (kind === 'sakuraRush') {
      h.duration = chain ? .7 : e.bossIndex === 0 ? 1 : .88;
      h.activeDuration = .62;
      h.speed = rage ? 940 : 860;
      h.r = 46;
      h.length = Math.min(h.speed*h.activeDuration, Math.max(180,distance(origin,p)+100));
      h.travelled = 0;
      h.recoveryDuration = chain ? .85 : .72;
      for (let d=8;d<=h.length+8;d+=8) {
        const trial = Math.min(d,h.length);
        if (blocked(e.x+Math.cos(angle)*trial,e.y+Math.sin(angle)*trial)) {
          h.length = Math.max(0,trial-8);break;
        }
      }
    } else if (kind === 'sakuraFan') {
      const count = rage ? 7 : 5, spread = rage ? 1 : .9;
      h.r = 17;h.reach = 540;h.speed = (rage ? 555 : 495) * 1.75;
      h.activeDuration = h.reach/h.speed;
      h.shots = Array.from({length:count},(_,i)=>({
        x:h.x,y:h.y,angle:angle-spread+i*spread*2/(count-1),travelled:0,dead:false
      }));
      for (const shot of h.shots) {
        shot.limit=h.reach;
        for(let d=8;d<=h.reach;d+=8) {
          if(blocked(h.x+Math.cos(shot.angle)*d,h.y+Math.sin(shot.angle)*d,8)) {shot.limit=Math.max(0,d-8);break;}
        }
      }
    } else {
      h.r = 74;h.pulseDuration = .34;
      const bounds = options.bounds || {minX:900,maxX:1800};
      const offsets = [[0,0],[35,165],[35,-165],[-160,100],[-160,-100]].slice(0,rage ? 5 : 3);
      h.marks = [];
      for (const [forward,side] of offsets) {
        const mark = {
          x:clamp(p.x+Math.cos(angle)*forward-Math.sin(angle)*side,bounds.minX+h.r+20,bounds.maxX-h.r-20),
          y:p.y+Math.sin(angle)*forward+Math.cos(angle)*side
        };
        if (h.marks.some(a=>distance(a,mark)<h.r*1.7)) continue;
        if ([[0,0],[h.r,0],[-h.r,0],[0,h.r],[0,-h.r]].some(([x,y])=>blocked(mark.x+x,mark.y+y))) continue;
        mark.delay = h.marks.length*.24;
        h.marks.push(mark);
      }
      h.activeDuration = Math.max(.34,(h.marks.length-1)*.24+.34);
      h.reach=Math.max(0,...h.marks.map(mark=>distance(origin,mark)+h.r));
    }
    e.hazard = h;e.slamT = h.duration;e.slamRecoverT = 0;
    return true;
  }
  function step(e, p, dt, options = {}) {
    const result = {hit:null,started:false,finished:false};
    if (!e || e.hp <= 0) {
      if (e) {delete e.hazard;e._sakuraFollowup=false;e.slamT=0;e.slamRecoverT=0;}
      return result;
    }
    if (!(dt>0) || options.paused || e.shield || !p) return result;
    e.attackCd = Math.max(0,(e.attackCd || 0)-dt);
    const gate=options.earlyGate;
    if (!e.hazard && e.attackCd===0 && distance(e,p)<500 && (!gate || gate.ready(options,e,'telegraph'))) {
      result.started=start(e,p,options);
      if (result.started) gate?.record(options,e,'telegraph');
    }
    const h = e.hazard;
    if (!h) return result;
    const before = h.t;
    h.endingFrame=false;
    h.t += dt;
    if (h.phase==='telegraph') {
      e.slamT=Math.max(0,h.duration-h.t);
      if (h.t>=h.duration) {
        if (gate && !gate.ready(options,e,'active')) {h.t=h.duration;return result;}
        gate?.record(options,e,'active');
        h.phase='active';h.t=0;h.duration=h.activeDuration;e.slamT=0;
      }
      return result;
    }
    if (h.phase==='active') {
      h.activeTime=Math.min(h.t,h.duration);
      const activeDt = Math.min(dt,Math.max(0,h.duration-before));
      const blocked = options.blocked || (() => false);
      if (h.kind==='sakuraRush') {
        const slow = Number.isFinite(options.speed) && e.speed>0 ? clamp(options.speed/e.speed,0,1) : 1;
        const travel = Math.min(h.speed*slow*activeDt,Math.max(0,h.length-h.travelled));
        const steps = Math.max(1,Math.ceil(travel/8)), stride = travel/steps;
        for (let i=0;i<steps;i++) {
          const old = {x:e.x,y:e.y+h.footOffsetY};
          const nx=e.x+Math.cos(h.angle)*stride, ny=e.y+Math.sin(h.angle)*stride;
          if (blocked(nx,ny)) {h.t=h.duration;break;}
          e.x=nx;e.y=ny;h.travelled+=stride;
          if (!h.hit && segmentDistance(p,old,{x:e.x,y:e.y+h.footOffsetY})<=h.r+18) {
            h.hit=true;result.hit={kind:h.kind,damage:20,x:e.x,y:e.y+h.footOffsetY};
          }
        }
        e.faceAng=h.angle;
        if (h.travelled>=h.length-.01) h.t=h.duration;
      } else if (h.kind==='sakuraFan') {
        for (const shot of h.shots) {
          if (shot.dead) continue;
          const travel=Math.min(h.speed*activeDt,shot.limit-shot.travelled);
          const steps=Math.max(1,Math.ceil(travel/10)),stride=travel/steps;
          for(let i=0;i<steps;i++) {
            const old={x:shot.x,y:shot.y};
            const nx=shot.x+Math.cos(shot.angle)*stride,ny=shot.y+Math.sin(shot.angle)*stride;
            if (blocked(nx,ny,8)) {shot.dead=true;break;}
            shot.x=nx;shot.y=ny;shot.travelled+=stride;
            if (!h.hit && segmentDistance(p,old,shot)<=h.r+18) {
              h.hit=true;result.hit={kind:h.kind,damage:16,x:shot.x,y:shot.y};
            }
          }
          if (shot.travelled>=shot.limit-.01) shot.dead=true;
        }
      } else if (h.kind==='sakuraBloom') {
        for (const mark of h.marks) {
          const overlaps=h.t>mark.delay && before<mark.delay+h.pulseDuration;
          mark.visibleActive=overlaps;
          if (overlaps && !h.hit && distance(p,mark)<=h.r+18) {
            h.hit=true;result.hit={kind:h.kind,damage:18,x:mark.x,y:mark.y};
          }
        }
      }
      if (h.t>=h.duration) {h.endingFrame=true;h.phase='recovery';h.t=0;h.duration=h.recoveryDuration;}
      return result;
    }
    e.slamRecoverT=Math.max(0,h.duration-h.t);
    if (h.t>=h.duration) {
      e._sakuraFollowup=h.kind==='sakuraRush' && h.rage && !h.chain;
      e.attackCd=e._sakuraFollowup ? .35 : e.final ? .65 : .95;
      delete e.hazard;e.slamT=0;e.slamRecoverT=0;result.finished=true;
    }
    return result;
  }
  function footwork(e, p, dt, options = {}) {
    if (!e || !p || e.hp<=0 || e.shield || e.hazard || !(dt>0) || options.paused) return false;
    const d=distance(e,p);
    if (d<60 || d>540) return false;
    const speed=Number.isFinite(options.speed) ? Math.max(0,options.speed) : e.speed || walkSpeed(e.bossIndex);
    if (!speed) return false;
    e._sakuraFootAge=(e._sakuraFootAge || 0)+dt;
    const sign=(Math.floor(e._sakuraFootAge/1.8)+(e.bossIndex || 0))%2 ? -1 : 1;
    const fx=(p.x-e.x)/d,fy=(p.y-e.y)/d,forward=d>310 ? .86 : d<160 ? -.55 : .28;
    const side=Math.sqrt(1-forward*forward)*sign;
    const vx=(fx*forward-fy*side)*speed*dt,vy=(fy*forward+fx*side)*speed*dt;
    const blocked=options.blocked || (()=>false),steps=Math.max(1,Math.ceil(Math.hypot(vx,vy)/8));
    const oldX=e.x,oldY=e.y;
    for(let i=0;i<steps;i++) {
      if(!blocked(e.x+vx/steps,e.y))e.x+=vx/steps;
      if(!blocked(e.x,e.y+vy/steps))e.y+=vy/steps;
    }
    if(e.x===oldX && e.y===oldY)return false;
    e.faceAng=Math.atan2(e.y-oldY,e.x-oldX);return true;
  }
  const api=Object.freeze({start,step,footwork,walkSpeed});
  root.SAKURA_BOSS_AI=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})();
