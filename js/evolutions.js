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
    if(!p.curve)return;
    p.age=(p.age||0)+dt;
    if(p.curved)return;
    const u=clamp(p.age/0.28,0,1),ease=u*u*(3-2*u);
    const aim=Math.atan2(p.aimY-p.y,p.aimX-p.x);
    p.ang=p.launchAng+delta(p.launchAng,aim)*ease;
    p.vx=Math.cos(p.ang)*640;p.vy=Math.sin(p.ang)*640;
    if(u===1)p.curved=true;
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
  const api={move,curve,seek,FIRE_ORBIT:98,fireCount:l=>[2,4,5,5,5][rank(l)],needleCount:l=>[3,5,7,7,7][rank(l)],boomCount:l=>[1,2,3,3,3][rank(l)]};root.EVOLUTIONS=api;
  if(typeof module!=='undefined')module.exports=api;
})();
