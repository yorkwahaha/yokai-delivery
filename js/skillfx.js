// 六技能五階：原中／強階移到 Lv2／Lv3；Lv4 蓄勢，Lv5 以覺醒攻擊質變。
// 局部柔光與硬邊輪廓並存。命中判定在 game.js，彎曲／追蹤彈道在 evolutions.js。
window.SKILLFX = (() => {
  const SQ = 0.6;
  const tierOf = level => Math.max(1,Math.min(5,Math.floor(level)||1));
  const T = (tier, weak, mid, strong) => tier === 1 ? weak : tier === 2 ? mid : strong;
  const skills = {}, burning = [];
  const count = n => FX.count(n), rnd = (a,b) => FX.rnd(a,b);
  const motion = () => FX.allowsMotion();
  const emit = (kind,color,o) => FX.emit(kind,color,{blend:'source-over',...o,
    ...(!motion() ? {vx:0,vy:0,vr:0,delay:0,s0:o.ground||kind==='rock'?o.s1:o.s0,s1:o.ground||kind==='rock'?o.s1:o.s0,life:Math.min(o.life,0.3)} : {})});

  function define(id,events) { skills[id] = events; }
  function play(id,event,level,params={}) {
    const rank=tierOf(level),fn=skills[id]?.[event];if(!fn)return;
    if(id==='barrier'&&event==='cast'&&rank===5){earthCast(params);return;}
    if(id==='boom'&&event==='hit'){
      if(rank===5){explosion(params);accent(id,event,rank,params);return;}
      ignite(params.target,rank===1?1.2:2,Math.min(rank,2));
    }
    const core=['katana','barrier','needle','boom','fire','thunder'].includes(id);
    fn(core?Math.min(rank,3):rank,params,rank);
    if(['katana','barrier','needle','boom','fire','thunder'].includes(id))accent(id,event,rank,params);
  }
  function paint(ctx,id,level,params={}) {
    const rank=tierOf(level);
    if(id==='needle'&&rank===5){iceNeedle(ctx,params);return;}
    if(id==='fire'&&rank===5){dragonBody(ctx,params);return;}
    if(id==='boom'&&rank===5){yinBody(ctx,params);return;}
    if(!skills[id]?.body)return;
    if(!['needle','boom','fire'].includes(id)){skills[id].body(ctx,rank,params);return;}
    const {x,y}=params,color=id==='needle'?'#7ed9ed':id==='boom'?'#ed8d4d':'#ffb464';
    FX.glow(ctx,x,y,(id==='needle'?[22,26,30,34,38]:[30,40,50,64,82])[rank-1],color,[0.15,0.18,0.2,0.23,0.28][rank-1]);
    skills[id].body(ctx,['needle','boom','fire'].includes(id)?Math.min(rank,3):rank,params);
    if(rank>=4){
      ctx.save();ctx.translate(x,y);ctx.rotate(params.ang??params.spin??0);
      ctx.strokeStyle=id==='needle'?'#c2f4ff':'#ffd996';ctx.lineWidth=rank===5?2.6:1.6;
      ctx.beginPath();ctx.moveTo(-25,-7);ctx.lineTo(-12,-4);ctx.moveTo(-25,7);ctx.lineTo(-12,4);ctx.stroke();
      if(rank===5){ctx.fillStyle='#f4edc8';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(4,-5);ctx.lineTo(-2,0);ctx.lineTo(4,5);ctx.closePath();ctx.fill();}
      ctx.restore();
    }
  }

  const tones={katana:'#eecb8e',barrier:'#ecda91',needle:'#8dddff',boom:'#f29c62',fire:'#ffb865',thunder:'#d8d0ff'};
  function iceNeedle(ctx,{x,y,ang=0}){
    ctx.save();ctx.translate(x,y);ctx.rotate(ang);
    FX.glow(ctx,0,0,38,'#9cddff',0.23);
    ctx.fillStyle='#a0e5fa';ctx.strokeStyle='#f0ffff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(23,0);ctx.lineTo(-9,-6);ctx.lineTo(-18,0);ctx.lineTo(-9,6);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#ecffff';ctx.beginPath();ctx.moveTo(23,0);ctx.lineTo(-9,-6);ctx.lineTo(-2,0);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  function yinBody(ctx,{x,y,spin=0}){
    ctx.save();ctx.translate(x,y);ctx.rotate(spin);const r=16;
    ctx.fillStyle='#272331';ctx.beginPath();ctx.arc(0,0,r,0,6.283);ctx.fill();ctx.fillStyle='#eee8cf';
    ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);ctx.arc(0,r/2,r/2,Math.PI/2,-Math.PI/2,true);ctx.arc(0,-r/2,r/2,Math.PI/2,-Math.PI/2);ctx.fill();
    for(const [dy,color] of [[-r/2,'#272331'],[r/2,'#eee8cf']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,dy,2.5,0,6.283);ctx.fill();}
    ctx.strokeStyle='#e7bd73';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r,0,6.283);ctx.stroke();ctx.restore();
  }
  function accent(id,event,rank,p){
    const trailing=['trail','ember','ghostTrail'].includes(event);
    if(trailing&&rank<4)return;
    const {x,y}=p,size=trailing?[0,0,0,20,30][rank-1]:[40,54,70,90,124][rank-1];
    emit('glow',tones[id],{x,y,life:trailing?0.14:0.2,s0:size,s1:size*1.1,a:trailing?0.12:[0.16,0.18,0.2,0.24,0.28][rank-1],blend:'lighter',ground:id==='barrier',sy:id==='barrier'?SQ:1});
    if(trailing){
      emit('stroke',event==='ghostTrail'?'#b1ecdf':tones[id],{x,y,rot:p.ang||0,life:0.12,s0:rank===4?16:28,s1:6,a:rank===4?0.4:0.6});
      return;
    }
    if(rank>=4){
      chips(x,y,tones[id],trailing?rank-2:rank===4?5:14,{size:rank===4?10:15,speed:rank===4?170:280,life:0.3});
      if(!trailing)emit('edge',tones[id],{x,y,life:0.3,s0:rank===4?30:45,s1:rank===4?92:148,a:0.48,ground:true,sy:SQ});
    }
    if(id==='barrier'&&event==='cast'&&rank===5){
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,px=x+Math.cos(a)*p.r*0.76,py=y+Math.sin(a)*p.r*0.76*SQ;
        emit('glow',i%2?'#a3ecd7':'#ffe19a',{x:px,y:py-38,life:0.55,s0:22,s1:28,sy:4.2,a:0.2,blend:'lighter',vy:-24});
        cut(px,py-30,Math.PI/2,78,i*0.016,'#f7e5b6');
      }
    }
  }

  function explosion({x,y,r=135}){
    emit('yin','#eee8cf',{x,y,life:0.22,s0:112,s1:42,a:0.95});
    emit('edge','#ffb566',{x,y,life:0.42,delay:motion()?0.1:0,s0:50,s1:r*2,a:0.85,ground:true,sy:SQ,ease:true});
    emit('edge','#fbe7a3',{x,y,life:0.3,delay:0.07,s0:30,s1:r*1.6,a:0.7,ground:true,sy:SQ,ease:true});
    emit('glow','#ffc070',{x,y,life:0.22,s0:84,s1:164,a:0.3,blend:'lighter'});
    for(let i=0;i<5;i++)cut(x,y,i*Math.PI/5,110,i*0.016,'#ffe3ab');
    for(let i=count(14);i>0;i--){const a=i*6.2832/14;emit('shard',i%2?'#272331':'#eee8cf',{x,y,life:0.4,delay:motion()?0.1:0,vx:Math.cos(a)*260,vy:Math.sin(a)*260*SQ,drag:3,rot:a,vr:4,s0:32,s1:7,a:0.9});}
    for(let i=0;i<8;i++){const a=i*6.283/8;flame(x,y,38,'#e88539',0.4,{delay:motion()?0.1:0,vx:Math.cos(a)*210,vy:Math.sin(a)*150-30,drag:3,a:0.8});}
    chips(x,y,'#ffc172',24,{speed:360,size:18,life:0.4,delay:0.05});
  }

  function earthCast({x,y,r}){
    emit('edge','#c9a976',{x,y,life:0.5,s0:r*.5,s1:r*2,a:0.8,ground:true,sy:SQ,rot:0.1,ease:true});
    emit('edge','#a78962',{x,y,life:0.55,s0:r*.4,s1:r*1.8,a:0.65,ground:true,sy:SQ,rot:-0.2,ease:true});
    emit('glow','#d9c097',{x,y,life:0.25,s0:124,s1:160,a:0.2,ground:true,sy:SQ,blend:'lighter'});
    for(let i=0;i<8;i++){
      const a=i*6.283/8,px=x+Math.cos(a)*r*.22,py=y+Math.sin(a)*r*.22*SQ;
      emit('rock',i%2?'#b5a37b':'#c4b38f',{x:px,y:py,foot:true,priority:true,life:0.65,delay:motion()?i*0.012:0,s0:26,s1:r*.58,a:0.95,
        vx:Math.cos(a)*r*2.1,vy:Math.sin(a)*r*2.1*SQ,drag:2.5});
      chips(px,py,'#9f8b68',3,{ang:a,speed:170,size:14,life:0.32});
    }
  }

  function dragonBody(ctx,{x,y,ang=0,points=[]}){
    const path=points.length>1?points:[{x:x-Math.cos(ang)*70,y:y-Math.sin(ang)*70},{x,y}];
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(let i=1;i<path.length;i++){
      const w=3+i/path.length*23;
      for(const [color,width] of [['#8d3624',w+3],['#ed833c',w],['#ffe0a0',w*.35]]){
        ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(path[i-1].x,path[i-1].y);ctx.lineTo(path[i].x,path[i].y);ctx.stroke();
      }
    }
    for(let i=4;i<path.length;i+=4){
      const p=path[i],q=path[i-1],a=Math.atan2(p.y-q.y,p.x-q.x),s=i/path.length*17;
      ctx.fillStyle='#ffc15f';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-Math.sin(a)*s-Math.cos(a)*9,p.y+Math.cos(a)*s-Math.sin(a)*9);ctx.lineTo(p.x-Math.cos(a)*18,p.y-Math.sin(a)*18);ctx.closePath();ctx.fill();
    }
    ctx.translate(x,y);ctx.rotate(ang);ctx.fillStyle='#dc6a32';ctx.strokeStyle='#762b21';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(26,0);ctx.lineTo(15,-11);ctx.lineTo(-4,-14);ctx.lineTo(-15,-5);ctx.lineTo(-12,9);ctx.lineTo(12,12);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#f8d78a';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-5,side*9);ctx.lineTo(-20,side*24);ctx.lineTo(4,side*12);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#fff4c2';ctx.fillRect(9,-7,7,3);ctx.fillStyle='#362235';ctx.fillRect(13,-7,2,3);
    ctx.strokeStyle='#fff0ad';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,5);ctx.lineTo(9,6);ctx.stroke();ctx.restore();
  }

  function ghostBody(ctx,{x,y,ang=0,scale=1}){
    ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.scale(scale,scale);
    FX.glow(ctx,0,0,70,'#94e4d0',0.26);
    ctx.fillStyle='#63bdb6';ctx.beginPath();ctx.moveTo(24,0);ctx.bezierCurveTo(18,-21,-8,-25,-22,-6);ctx.lineTo(-37,-16);ctx.lineTo(-26,-2);ctx.lineTo(-42,8);ctx.lineTo(-24,5);ctx.bezierCurveTo(-8,23,17,18,24,0);ctx.fill();
    ctx.fillStyle='#c2f4dc';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-3,-11);ctx.lineTo(-21,0);ctx.lineTo(-4,12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#393254';ctx.fillRect(4,-6,4,3);ctx.fillRect(4,3,4,3);
    ctx.strokeStyle='#ffe1a0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-16,-12);ctx.lineTo(-29,-20);ctx.moveTo(-16,12);ctx.lineTo(-29,20);ctx.stroke();ctx.restore();
  }

  // 方向性的硬邊碎屑；粒子預算降低時仍保留主要刃線／咒印。
  function chips(x,y,color,n,{ang=0,spread=6.2832,speed=180,size=10,life=0.3,delay=0}={}) {
    for(let i=count(n);i>0;i--){
      const a=ang+rnd(-spread/2,spread/2),v=speed*rnd(0.55,1);
      emit('shard',i%3?color:'#fff0d0',{x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,drag:4,
        life:life*rnd(0.8,1.1),delay,s0:size*rnd(0.8,1.2),s1:2,rot:a,vr:0,a:0.85});
    }
  }
  function cut(x,y,ang,len,delay=0,color='#fff0cc') {
    emit('stroke',color,{x,y,rot:ang,life:0.22,delay,s0:len,s1:len*0.55,sx:1.5,a:0.9});
  }
  const flame = (x,y,size,color,life,o={}) => emit('flame',color,{x,y,life,s0:size,s1:size*0.3,a:0.8,...o});

  // 妖刀：單刃 → 交叉刀痕 → 三道收束刀痕；金色碎屑沿斬擊方向散開。
  define("katana",{
    swing(t,{x,y,ang,reach}) {
      for(let i=0;i<T(t,1,2,3);i++){
        const turn=ang+(i-1)*0.2,r=reach*(0.8+i*0.06);
        cut(x+Math.cos(turn)*r,y+Math.sin(turn)*r,turn+Math.PI/2,T(t,24,38,56),i*0.025);
      }
      for(let i=count(T(t,3,6,10));i>0;i--){
        const a=ang+rnd(-0.95,0.95),r=reach*rnd(0.86,1.02);
        chips(x+Math.cos(a)*r,y+Math.sin(a)*r,'#e8b966',1,{ang:a,spread:0.6,speed:T(t,90,140,200),size:T(t,7,9,12),life:0.22});
      }
    },
    hit(t,{x,y,ang,crit}) {
      const len=T(t,28,46,68)*(crit?1.25:1);
      for(let i=0;i<t;i++)cut(x,y,ang+(i===0?0.8:i===1?-0.8:Math.PI/2),len,i*0.035,crit?'#ffd16f':'#fff0cc');
      chips(x,y,crit?'#f2b751':'#e8b966',T(t,3,5,9)+(crit?2:0),{ang,spread:1.6,speed:T(t,150,210,280),size:T(t,7,10,12)});
    }
  });

  // 靈陣：單咒盤 → 雙刻線 → 反轉雙盤＋十二方刻印；中心始終留空。
  define("barrier",{
    cast(t,{x,y,r}) {
      const edge=(scale,delay,a)=>emit('edge','#d8b86e',{x,y,life:0.42,delay,s0:r*scale,s1:r*2.05,a,ease:true,ground:true,sy:SQ});
      edge(1.45,0,0.55);
      if(t>=2)edge(1.1,0.07,0.48);
      if(t===3)edge(0.8,0.14,0.4);
      emit(`rune${t}`,'#d9ba78',{x,y,life:T(t,0.55,0.7,0.85),s0:r*1.7,s1:r*1.9,
        rot:0.18,vr:T(t,0.3,0.45,0.55),a:T(t,0.4,0.55,0.65),ground:true,sy:SQ});
      if(t===3)emit('rune2','#8ec7be',{x,y,life:0.75,s0:r*1.1,s1:r*1.18,rot:0.4,vr:-0.7,a:0.48,ground:true,sy:SQ});
      const n=T(t,4,8,12);
      for(let i=0;i<n;i++){
        const a=i*6.2832/n;
        emit('seal',i%2?'#d9ba78':'#eadcc0',{x:x+Math.cos(a)*r*0.78,y:y+Math.sin(a)*r*0.78*SQ,
          life:0.42,delay:t===3?0.12:0.04,s0:T(t,12,16,20),s1:T(t,16,22,28),rot:a+Math.PI/2,
          vx:Math.cos(a)*T(t,14,28,48),vy:Math.sin(a)*T(t,14,28,48)*SQ,a:0.8,ground:true,sy:SQ});
      }
    }
  });

  // 靈針：冷色單線 → 雙羽 → 三叉針；尾跡是短線，避免多發彈幕堆成藍色霧團。
  define("needle",{
    fire(t,{x,y}) { chips(x,y,'#7ec9d8',T(t,2,4,6),{speed:90,size:T(t,5,7,9),life:0.16}); },
    trail(t,{x,y,ang}) {
      for(let i=0;i<t;i++){
        const offset=(i-(t-1)/2)*T(t,0,3,4);
        emit('stroke',i===1?'#d7e8df':'#77bac9',{x:x-Math.sin(ang)*offset,y:y+Math.cos(ang)*offset,
          rot:ang,life:T(t,0.1,0.14,0.18),s0:T(t,16,23,30),s1:5,sx:1.5,a:T(t,0.42,0.5,0.6)});
      }
    },
    hit(t,{x,y}) {
      cut(x,y,Math.PI/4,T(t,14,22,34),0,'#cbe7ea');
      if(t>1)cut(x,y,-Math.PI/4,T(t,0,18,30),0.03,'#7ec9d8');
      if(t===3)cut(x,y,0,40,0.06,'#cbe7ea');
      chips(x,y,'#77c2d5',T(t,2,4,7),{speed:T(t,90,130,180),size:T(t,5,7,9),life:0.22});
    },
    body(ctx,t,{x,y,ang}) {
      ctx.save();ctx.translate(x,y);ctx.rotate(ang);
      const len=T(t,16,22,30);
      ctx.fillStyle='#b9e2e4';ctx.beginPath();ctx.moveTo(len/2,0);ctx.lineTo(-len/2,-2);ctx.lineTo(-len/3,0);ctx.lineTo(-len/2,2);ctx.closePath();ctx.fill();
      if(t>=2){ctx.strokeStyle='#70bdcf';ctx.lineWidth=1.4;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-len/2,side*4);ctx.lineTo(len/3,side*2);ctx.stroke();}}
      if(t===3){ctx.fillStyle='#efe8cc';ctx.fillRect(-8,-1,17,2);ctx.fillRect(-12,-5,4,2);ctx.fillRect(-12,3,4,2);}
      ctx.restore();
    }
  });

  function ignite(target,seconds,t) {
    if(!target || target.hp<=0)return;
    const old=burning.find(b=>b.e===target);
    if(old){old.t=Math.max(old.t,seconds);old.tier=Math.max(old.tier,t);return;}
    if(burning.length<24)burning.push({e:target,t:seconds,tick:0,tier:t});
  }

  // 陰陽符：硃砂紙符 → 雙符火尾 → 撕符爆裂；MAX 的強度來自碎符與二拍衝擊。
  define("boom",{
    trail(t,{x,y}) {
      for(let i=count(T(t,1,2,3));i>0;i--)flame(x+rnd(-3,3),y+rnd(-3,3),T(t,10,15,20),'#ce623d',0.22,{vy:-rnd(18,36),vx:rnd(-12,12),drag:3});
      if(t>=2)emit('seal','#cfbb93',{x,y,life:0.18,s0:T(t,0,12,18),s1:5,rot:0.25,a:T(t,0,0.38,0.55)});
    },
    hit(t,{x,y,target}) {
      if(t<3){
        ignite(target,T(t,1.2,2),t);
        for(let i=0;i<T(t,2,4,0);i++)flame(x+rnd(-5,5),y+rnd(-5,5),T(t,16,22,0),'#d96538',0.3,{vy:-rnd(30,60),vx:rnd(-20,20),drag:3});
        cut(x,y,-0.45,T(t,22,38,0),0,'#e8bc76');
        chips(x,y,'#d78b54',T(t,3,6,0),{speed:160,size:T(t,8,11,0)});
        return;
      }
      emit('edge','#da8a52',{x,y,life:0.42,s0:50,s1:220,a:0.65,ease:true,ground:true,sy:SQ});
      for(let i=0;i<3;i++)cut(x,y,i*Math.PI/3,78,0.04*i,'#eed9a0');
      for(let i=count(12);i>0;i--){
        const a=i*6.2832/12,v=rnd(130,240);
        emit('seal',i%2?'#d9c39a':'#ca9f72',{x,y,life:0.42,delay:0.05,vx:Math.cos(a)*v,vy:Math.sin(a)*v,drag:3,
          rot:a,vr:3,s0:18,s1:5,a:0.85});
      }
      for(let i=0;i<6;i++)flame(x,y,26,'#c65b35',0.3,{delay:0.08,vx:rnd(-120,120),vy:rnd(-140,40),drag:4});
      chips(x,y,'#dfac65',14,{speed:300,size:12,life:0.42,delay:0.1});
    },
    body(ctx,t,{x,y,spin}) {
      ctx.save();ctx.translate(x,y);ctx.rotate(spin);
      const w=T(t,11,13,16),h=T(t,24,28,32);
      if(t>=2){ctx.fillStyle='#ac7650';ctx.fillRect(-w/2-4,-h/2+4,w,h);}
      ctx.fillStyle='#e4d0a4';ctx.fillRect(-w/2,-h/2,w,h);
      ctx.strokeStyle='#913a38';ctx.lineWidth=1.6;ctx.strokeRect(-w/2+2,-h/2+2,w-4,h-4);
      ctx.beginPath();ctx.moveTo(-3,-h/4);ctx.lineTo(3,-2);ctx.lineTo(-3,3);ctx.lineTo(2,h/4);ctx.stroke();
      if(t===3){ctx.strokeStyle='#f6e8c1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,-18);ctx.lineTo(-5,-18);ctx.moveTo(5,18);ctx.lineTo(11,18);ctx.stroke();}
      ctx.restore();
    }
  });

  // 狐火：小焰 → 分叉火舌 → 三叉白芯＋雙軌尾；不再用兩層大圓光暈疊出強度。
  define("fire",{
    ember(t,{x,y,ang}) {
      for(let i=count(T(t,1,2,3));i>0;i--)flame(x,y,T(t,8,12,16),'#d76a37',T(t,0.16,0.2,0.24),
        {vx:Math.sin(ang)*24,vy:-Math.cos(ang)*24,drag:4,rot:ang,a:0.6});
      if(t>1)emit('stroke','#daaf62',{x,y,rot:ang+Math.PI/2,life:0.16,s0:T(t,0,18,28),s1:5,a:T(t,0,0.45,0.55)});
    },
    hit(t,{x,y}) {
      cut(x,y,-0.4,T(t,16,27,42),0,'#f3ca7d');
      if(t===3)cut(x,y,0.7,34,0.04,'#ecd9a8');
      chips(x,y,'#dc763c',T(t,3,5,8),{speed:T(t,130,180,240),size:T(t,6,8,11),life:0.22});
    },
    body(ctx,t,{x,y,ang,origin,orbitR=98,time=0}) {
      ctx.save();ctx.lineCap='butt';
      if(origin){
        ctx.strokeStyle='#b65b36';ctx.lineWidth=T(t,1.5,2.5,4);ctx.globalAlpha=0.65;
        ctx.beginPath();ctx.arc(origin.x,origin.y,orbitR,ang-T(t,0.2,0.42,0.72),ang);ctx.stroke();
        if(t===3){ctx.strokeStyle='#e8bd6e';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(origin.x,origin.y,orbitR-5,ang-0.58,ang-0.08);ctx.stroke();}
        ctx.globalAlpha=1;
      }
      ctx.translate(x,y);ctx.rotate(ang+Math.PI/2);
      const size=T(t,18,20,27),flick=motion()?Math.sin(time*16)*1.5:0;
      ctx.fillStyle='#c55231';ctx.beginPath();ctx.moveTo(0,size*0.5);
      ctx.bezierCurveTo(size*0.65,size*0.1,size*0.55,-size*0.5,size*0.2,-size);
      ctx.lineTo(0,-size*0.55-flick);ctx.lineTo(-size*0.35,-size*0.9);
      ctx.bezierCurveTo(-size*0.65,-size*0.1,-size*0.4,size*0.4,0,size*0.5);ctx.closePath();ctx.fill();
      ctx.fillStyle='#e9a749';ctx.beginPath();ctx.moveTo(0,size*0.35);ctx.lineTo(size*0.25,-size*0.6);ctx.lineTo(0,-size*0.3);ctx.lineTo(-size*0.2,-size*0.65);ctx.closePath();ctx.fill();
      if(t>=2){ctx.strokeStyle='#e8bd6e';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-size*0.45,0);ctx.lineTo(-size*0.55,-size*0.7);ctx.stroke();}
      if(t===3){ctx.fillStyle='#f2e4b5';ctx.beginPath();ctx.moveTo(0,size*0.25);ctx.lineTo(3,-size*0.4);ctx.lineTo(-3,-size*0.22);ctx.closePath();ctx.fill();ctx.strokeStyle='#ecd4a0';ctx.beginPath();ctx.moveTo(size*0.4,0);ctx.lineTo(size*0.55,-size*0.75);ctx.stroke();}
      ctx.restore();
    }
  });

  // 落雷：單線 → 寬芯＋碎屑 → 分叉後拍；不鋪地面圈、不做全畫面閃白。
  define("thunder",{
    strike(t,{x,y,stormChild,delay=0.08},rank) {
      if(stormChild){
        FX.bolt(x,y,{w:3.3,a:0.9,h:520,jag:28,life:0.32,delay:motion()?delay:0,halo:0.07});
        emit('current','#b7e5ff',{x,y,priority:true,life:0.6,delay:motion()?delay:0,s0:24,s1:130,a:0.85,ground:true,sy:SQ,ease:true});
        chips(x,y,'#ddcfff',6,{speed:190,size:13});return;
      }
      FX.bolt(x,y,{w:rank===5?3.3:T(t,0.35,0.62,0.95),a:0.9,h:T(t,420,500,580),jag:T(t,12,22,30),life:0.22,halo:0.035});
      if(t===3){
        FX.bolt(x-8,y,{w:0.45,jag:32,h:180,life:0.18,delay:motion()?0.07:0,halo:0.025});
        FX.bolt(x+8,y,{w:0.4,jag:38,h:240,life:0.18,delay:motion()?0.13:0,halo:0.025});
      }
      cut(x,y,-0.2,T(t,20,34,52),0,'#e6d49e');
      chips(x,y,'#d2bd77',T(t,6,10,16),{speed:T(t,140,210,280),size:T(t,6,9,12),life:0.3,delay:t===3?0.09:0});
    }
  });

  skills.thunder.storm=(t,{x,y,r})=>{
    // 空中雷鼓印先亮起，落雷仍保留原本的範圍判定。
    emit('drum','#f5d58e',{x,y:y-180,life:0.6,s0:80,s1:88,a:0.85,sy:0.8});
    emit('ring','#e2efff',{x,y:y-180,life:0.35,s0:98,s1:116,a:0.65,sy:0.8});
    emit('glow','#e4ce93',{x,y:y-180,life:0.24,s0:90,s1:100,a:0.16,blend:'lighter'});
  };
  skills.fire.ghostTrail=(t,{x,y,ang,dragon})=>{
    if(dragon){flame(x,y,24,'#ed8a39',0.18,{vy:-30,drag:3,a:0.5});return;}
    emit('stroke','#93e5cf',{x,y,rot:ang,life:0.24,s0:45,s1:10,sx:1.5,a:0.7});
    emit('glow','#86dccb',{x,y,life:0.2,s0:24,s1:8,a:0.18,blend:'lighter'});
  };
  define('ghost',{body:(ctx,t,p)=>p.dragon?dragonBody(ctx,p):ghostBody(ctx,p)});
  define('wind',{
    trail(){},
    body(ctx,t,{x,y,ang,size=360}){
      ctx.save();ctx.translate(x,y);ctx.rotate(ang);
      const h=size/2,r=size/Math.sqrt(2),cx=-r/Math.sqrt(2);
      ctx.fillStyle='#b9ecff';ctx.strokeStyle='#368ca7';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,0,r,-Math.PI/4,Math.PI/4);ctx.quadraticCurveTo(40,0,0,-h);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#efffff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,0,r-4,-Math.PI/4+0.015,Math.PI/4-0.015);ctx.stroke();ctx.restore();
    }
  });

  define('ice',{body(ctx,t,{x,y,boss}){
    ctx.save();ctx.translate(x,y);const s=boss?1.4:1;ctx.scale(s,s);
    ctx.fillStyle='rgba(100,205,250,0.24)';ctx.strokeStyle='#b5f2ff';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-23,8);ctx.lineTo(-30,-28);ctx.lineTo(-12,-60);ctx.lineTo(13,-55);ctx.lineTo(28,-24);ctx.lineTo(22,8);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(220,255,255,0.65)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(-12,-60);ctx.lineTo(0,-20);ctx.lineTo(22,8);ctx.moveTo(-30,-28);ctx.lineTo(0,-20);ctx.lineTo(13,-55);ctx.stroke();ctx.restore();
  }});

  function update(dt) {
    for(let i=burning.length-1;i>=0;i--){
      const b=burning[i],e=b.e;b.t-=dt;
      if(b.t<=0 || e.hp<=0){burning.splice(i,1);continue;}
      if((b.tick-=dt)>0)continue;b.tick=0.12;
      const big=e.type==='boss'?1.5:1;
      for(let k=count(b.tier>=2?2:1);k>0;k--)flame(e.x+rnd(-7,7)*big,e.y+rnd(-5,5),T(b.tier,12,17,0)*big,'#c96136',0.3,{vy:-rnd(20,45),drag:3,a:0.65});
    }
  }
  function reset() { burning.length=0; }
  return {SQ,tier:tierOf,pick:(level,...values)=>values[Math.min(tierOf(level)-1,values.length-1)],define,play,paint,update,reset,has:id=>!!skills[id]};
})();
