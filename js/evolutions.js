// 覺醒彈道共用於遊戲與受控展示；固定時間步長、生命期限與沿途牆壁碰撞。
(() => {
  const root=typeof window==='undefined'?globalThis:window;
  const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function move(p,dt,blocked,radius=8) {
    if(p.life<=0)return false;
    const travel=Math.min(dt,p.life);
    const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*travel/10));
    for(let i=0;i<steps;i++){
      const x=p.x+p.vx*travel/steps,y=p.y+p.vy*travel/steps;
      if(blocked?.(x,y,radius)){p.life=0;return false;}
      p.x=x;p.y=y;
    }
    p.life-=dt;return p.life>0;
  }

  function curve(p,dt) {
    if(!p.curve||dt<=0)return;
    if(p.ice){
      if(p.curved)return;
      if(p.curveDone){
        const a=Math.atan2(p.aimY-p.controlY,p.aimX-p.controlX);
        p.vx=Math.cos(a)*640;p.vy=Math.sin(a)*640;p.ang=a;p.curved=true;return;
      }
      p.age=(p.age||0)+dt;
      if(p.target?.hp>0){p.aimX=p.target.x;p.aimY=p.target.y;}
      const u=clamp(p.age/p.curveDuration,0,1),v=1-u;
      const nx=v*v*p.originX+2*v*u*p.controlX+u*u*p.aimX;
      const ny=v*v*p.originY+2*v*u*p.controlY+u*u*p.aimY;
      p.vx=(nx-p.x)/dt;p.vy=(ny-p.y)/dt;p.ang=Math.atan2(p.vy,p.vx);
      if(u===1)p.curveDone=true;return;
    }
    p.age=(p.age||0)+dt;
    if(p.curved)return;
    const u=clamp(p.age/0.28,0,1),ease=u*u*(3-2*u);
    const aim=Math.atan2(p.aimY-p.y,p.aimX-p.x);
    p.ang=p.launchAng+delta(p.launchAng,aim)*ease;
    p.vx=Math.cos(p.ang)*640;p.vy=Math.sin(p.ang)*640;
    if(u===1)p.curved=true;
  }

  function iceVolley(origin,enemies,face=0,random=Math.random) {
    const targets=enemies.filter(e=>e.hp>0&&!e.shield&&Math.hypot(e.x-origin.x,e.y-origin.y)<520);
    for(let i=targets.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[targets[i],targets[j]]=[targets[j],targets[i]];}
    return Array.from({length:8},(_,i)=>{
      const target=targets[i],a=target?Math.atan2(target.y-origin.y,target.x-origin.x):face+i*Math.PI/4;
      const aimX=target?target.x:origin.x+Math.cos(a)*440,aimY=target?target.y:origin.y+Math.sin(a)*440;
      const d=Math.hypot(aimX-origin.x,aimY-origin.y),bend=Math.min(130,d*0.4)*(i%2?1:-1);
      return {x:origin.x,y:origin.y,originX:origin.x,originY:origin.y,target,aimX,aimY,
        controlX:(origin.x+aimX)/2-Math.sin(a)*bend,controlY:(origin.y+aimY)/2+Math.cos(a)*bend,
        curveDuration:clamp(d/640,0.22,0.75),vx:Math.cos(a)*640,vy:Math.sin(a)*640,ang:a,
        curve:true,ice:true,age:0,life:0.95,level:5,dmg:4.9,trail:0,hits:new Set()};
    });
  }

  function freeze(e,elapsed) {
    if(e.hp<=0||e.shield||e.freezeReady>elapsed)return false;
    e.freezeT=e.type==='boss'?0.15:0.5;e.freezeEnds=elapsed+e.freezeT;e.freezeReady=elapsed+2;return true;
  }

  function dragon(origin,target,phase=0) {
    return {dragon:true,x:origin.x+98,y:origin.y,age:0,life:2.2,ang:Math.PI/2,
      vx:0,vy:0,target,phase,trail:0,hitSet:new Set(),points:[]};
  }
  function dragonStep(p,dt,origin,blocked) {
    if(dt<=0)return p.life>0;
    p.age+=dt;
    if(p.age<=0.6){
      const a=p.age/0.6*Math.PI*2,nx=origin.x+Math.cos(a)*98,ny=origin.y+Math.sin(a)*98;
      p.vx=(nx-p.x)/dt;p.vy=(ny-p.y)/dt;p.ang=Math.atan2(p.vy,p.vx);
    }else{
      if(p.launchAng==null)p.launchAng=p.target?.hp>0?Math.atan2(p.target.y-p.y,p.target.x-p.x):origin.faceAng||0;
      p.ang=p.launchAng+Math.sin((p.age-0.6)*10+p.phase)*0.38;
      p.vx=Math.cos(p.ang)*520;p.vy=Math.sin(p.ang)*520;
    }
    const alive=move(p,dt,blocked,12),prev=p.points.at(-1);
    if(!prev||Math.hypot(p.x-prev.x,p.y-prev.y)>6){p.points.push({x:p.x,y:p.y});if(p.points.length>24)p.points.shift();}
    return alive;
  }

  function seek(p,dt,enemies) {
    p.age=(p.age||0)+dt;
    if(!p.target || p.target.hp<=0 || !enemies.includes(p.target) || Math.hypot(p.target.x-p.x,p.target.y-p.y)>650){
      p.target=null;let nearest=650;
      for(const e of enemies){const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.hp>0&&d<nearest){nearest=d;p.target=e;}}
    }
    if(p.target){
      const aim=Math.atan2(p.target.y-p.y,p.target.x-p.x);
      p.ang+=clamp(delta(p.ang,aim),-dt*4,dt*4);
    }
    const speed=Math.min(460,280+p.age*160);
    p.vx=Math.cos(p.ang)*speed;p.vy=Math.sin(p.ang)*speed;
  }

  const rank=l=>clamp(Math.floor(l)||1,1,5)-1;
  const api={move,curve,seek,iceVolley,freeze,dragon,dragonStep,FIRE_ORBIT:98,fireCount:l=>[2,4,5,6,6][rank(l)],needleCount:l=>[3,5,7,8,8][rank(l)],boomCount:l=>[1,2,3,4,4][rank(l)]};root.EVOLUTIONS=api;
  if(typeof module!=='undefined')module.exports=api;
})();
