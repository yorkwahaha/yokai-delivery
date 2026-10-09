// 六技能五階：原中／強階移到 Lv2／Lv3；Lv4 蓄勢，Lv5 以覺醒攻擊質變。
// 局部柔光與硬邊輪廓並存。命中判定在 game.js，彎曲／追蹤彈道在 evolutions.js。
window.SKILLFX = (() => {
  const SQ = 0.6;
  const tierOf = level => Math.max(1,Math.min(5,Math.floor(level)||1));
  const T = (tier, weak, mid, strong) => tier === 1 ? weak : tier === 2 ? mid : strong;
  const skills = {}, burning = [], artFx = [];
  const count = n => FX.count(n), rnd = (a,b) => FX.rnd(a,b);
  const motion = () => FX.allowsMotion();
  const emit = (kind,color,o) => FX.emit(kind,color,{blend:'source-over',...o,
    ...(!motion() ? {vx:0,vy:0,vr:0,delay:0,s0:o.ground||kind==='rock'?o.s1:o.s0,s1:o.ground||kind==='rock'?o.s1:o.s0,life:Math.min(o.life,0.3)} : {})});
  const art = key => {
    const img = window.ART?.[key];
    return img && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null;
  };
  const rankedArt = (id,rank) => window.skillVfxArt?.(id,rank) || null;
  const rankedVariantArt = (id,variant,rank) => window.skillVfxVariantArt?.(id,variant,rank) || null;
  function drawImageArt(ctx,img,{x=0,y=0,w=64,h=null,ang=0,a=1,sx=1,sy=1}={}) {
    if(!img)return false;
    const hh=h??(w*img.naturalHeight/img.naturalWidth);
    ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.scale(sx,sy);ctx.globalAlpha*=a;
    ctx.drawImage(img,-w/2,-hh/2,w,hh);ctx.restore();return true;
  }
  function drawArt(ctx,key,o={}) { return drawImageArt(ctx,art(key),o); }
  function drawRankedArt(ctx,id,rank,o={},legacyKey=null) {
    const img=rankedArt(id,rank);
    if(img)return drawImageArt(ctx,img,o);
    return legacyKey ? drawArt(ctx,legacyKey,o) : false;
  }
  function rankedKey(id,rank,legacyKey) {
    const img=rankedArt(id,rank),key=window.skillVfxKey?.(id,rank);
    return img && key ? key : legacyKey;
  }
  function pushArt(key,o={}) {
    const life=o.life??0.28;
    artFx.push({key,max:life,life,...o});
  }
  function pushRankedArt(id,rank,legacyKey,o={}) { pushArt(rankedKey(id,rank,legacyKey),o); }
  function drawArtFx(ctx,ground=false){
    for(const p of artFx){
      if(!!p.ground!==ground || p.delay>0)continue;
      const fade=Math.min(1,p.life/Math.max(.001,p.max)*1.45);
      drawArt(ctx,p.key,{...p,a:(p.a??1)*fade});
    }
  }

  function define(id,events) { skills[id] = events; }
  function play(id,event,level,params={}) {
    const rank=tierOf(level),fn=skills[id]?.[event];if(!fn)return;
    if(id==='barrier'&&event==='cast'&&rank===5){earthCast(params);accent(id,event,rank,params);return;}
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
    if(id==='needle'&&rank===5){iceNeedle(ctx,params,rank);return;}
    if(id==='fire'&&rank===5&&!params.orbit){dragonBody(ctx,params,rank);return;}
    if(id==='boom'&&rank===5){yinBody(ctx,params,rank);return;}
    if(!skills[id]?.body)return;
    if(!['needle','boom','fire'].includes(id)){skills[id].body(ctx,rank,params,rank);return;}
    const {x,y}=params,color=id==='needle'?'#7ed9ed':id==='boom'?'#ed8d4d':'#ffb464';
    FX.glow(ctx,x,y,(id==='needle'?[22,26,30,34,38]:[30,40,50,64,82])[rank-1],color,[0.15,0.18,0.2,0.23,0.28][rank-1]);
    // 程序化備援仍維持三段；body 額外拿完整 rank，五階點陣圖不再被壓成 Lv3。
    skills[id].body(ctx,Math.min(rank,3),params,rank);
    if(id==='fire'&&params.orbit)return;
    if(rank>=4){
      ctx.save();ctx.translate(x,y);ctx.rotate(params.ang??params.spin??0);
      ctx.strokeStyle=id==='needle'?'#c2f4ff':'#ffd996';ctx.lineWidth=rank===5?2.6:1.6;
      ctx.beginPath();ctx.moveTo(-25,-7);ctx.lineTo(-12,-4);ctx.moveTo(-25,7);ctx.lineTo(-12,4);ctx.stroke();
      if(rank===5){ctx.fillStyle='#f4edc8';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(4,-5);ctx.lineTo(-2,0);ctx.lineTo(4,5);ctx.closePath();ctx.fill();}
      ctx.restore();
    }
  }

  const tones={katana:'#eecb8e',barrier:'#ecda91',needle:'#8dddff',boom:'#f29c62',fire:'#ffb865',thunder:'#d8d0ff'};
  function iceNeedle(ctx,{x,y,ang=0},rank=5){
    if(drawRankedArt(ctx,'needle',rank,{x,y,w:116,ang},'needle_ice_ukiyoe'))return;
    ctx.save();ctx.translate(x,y);ctx.rotate(ang);
    FX.glow(ctx,0,0,56,'#7ed9ed',0.26);
    // 1. 冰魄神槍主晶體 (Prismatic Glacial Lance Core)
    ctx.fillStyle='#1e7ca6';ctx.strokeStyle='#ffffff';ctx.lineWidth=2.2;
    ctx.beginPath();ctx.moveTo(38,0);ctx.lineTo(-8,-12);ctx.lineTo(-26,0);ctx.lineTo(-8,12);ctx.closePath();ctx.fill();ctx.stroke();
    // 2. 鑽石折射冰刃 (Faceted Crystalline Blades)
    ctx.fillStyle='#5cd9f8';ctx.beginPath();ctx.moveTo(38,0);ctx.lineTo(-8,-12);ctx.lineTo(-2,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#b8f4ff';ctx.beginPath();ctx.moveTo(38,0);ctx.lineTo(-2,0);ctx.lineTo(-8,12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(38,0);ctx.lineTo(8,-4);ctx.lineTo(8,4);ctx.closePath();ctx.fill();
    // 3. 雙側展翼冰稜 (Lateral Frost Wings)
    ctx.strokeStyle='#a6f2ff';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-6,-10);ctx.lineTo(-20,-20);ctx.lineTo(-12,-6);
    ctx.moveTo(-6,10);ctx.lineTo(-20,20);ctx.lineTo(-12,6);ctx.stroke();
    // 4. 核心雪晶符印 (Snowflake Core Inscription)
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-2,-6);ctx.lineTo(-2,6);ctx.moveTo(-7,-3);ctx.lineTo(3,3);ctx.moveTo(-7,3);ctx.lineTo(3,-3);ctx.stroke();
    ctx.restore();
  }
  function yinBody(ctx,{x,y,spin=0},rank=5){
    if(drawRankedArt(ctx,'boom',rank,{x,y,w:116,ang:spin},'taiji_ofuda_ukiyoe'))return;
    ctx.save();ctx.translate(x,y);ctx.rotate(spin);const r=25;
    FX.glow(ctx,0,0,62,'#ff9d5c',0.25);
    // 1. 四方硃砂符紙 (4 Cinnabar Talismans fluttering at cardinal points)
    ctx.fillStyle='#bf2c1f';ctx.strokeStyle='#f8e4b7';ctx.lineWidth=1.5;
    for(let i=0;i<4;i++){
      ctx.save();ctx.rotate(i*Math.PI/2);
      ctx.fillRect(r-2,-7,18,14);ctx.strokeRect(r-2,-7,18,14);
      // 金色符頭與黑墨符咒
      ctx.fillStyle='#f0cf74';ctx.fillRect(r+1,-4,8,8);
      ctx.fillStyle='#1c1824';ctx.fillRect(r+10,-5,3,10);
      ctx.restore();
    }
    // 2. 八方金色八卦刻印 (8 Bagua Trigrams on Golden Perimeter)
    ctx.strokeStyle='#ffcf78';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,0,r,0,6.283);ctx.stroke();
    ctx.strokeStyle='#ffd894';ctx.lineWidth=1.5;
    for(let i=0;i<8;i++){
      ctx.save();ctx.rotate(i*Math.PI/4+Math.PI/8);
      ctx.beginPath();ctx.moveTo(r-5,0);ctx.lineTo(r-1,0);ctx.stroke();
      ctx.restore();
    }
    // 3. 太極雙魚圓形基底 (Taiji Yin-Yang Core)
    ctx.fillStyle='#1c1824';ctx.beginPath();ctx.arc(0,0,r,0,6.283);ctx.fill();
    ctx.fillStyle='#f7f2dc';
    ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);ctx.arc(0,r/2,r/2,Math.PI/2,-Math.PI/2,true);ctx.arc(0,-r/2,r/2,Math.PI/2,-Math.PI/2);ctx.fill();
    for(const [dy,color] of [[-r/2,'#1c1824'],[r/2,'#f7f2dc']]){
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,dy,4,0,6.283);ctx.fill();
      ctx.strokeStyle=color==='#1c1824'?'#ffcf78':'#9c2014';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.restore();
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
    emit('yin','#eee8cf',{x,y,life:0.25,s0:128,s1:48,a:0.95});
    emit('edge','#ffb566',{x,y,life:0.45,delay:motion()?0.08:0,s0:60,s1:r*2.1,a:0.9,ground:true,sy:SQ,ease:true});
    emit('edge','#fbe7a3',{x,y,life:0.35,delay:0.05,s0:40,s1:r*1.7,a:0.75,ground:true,sy:SQ,ease:true});
    emit('glow','#ffc070',{x,y,life:0.25,s0:95,s1:175,a:0.3,blend:'lighter'});
    for(let i=0;i<8;i++)cut(x,y,i*Math.PI/4,125,i*0.015,'#ffe3ab');
    for(let i=count(16);i>0;i--){const a=i*6.2832/16;emit('shard',i%2?'#272331':'#eee8cf',{x,y,life:0.42,delay:motion()?0.08:0,vx:Math.cos(a)*280,vy:Math.sin(a)*280*SQ,drag:3,rot:a,vr:4,s0:36,s1:8,a:0.9});}
    for(let i=0;i<8;i++){const a=i*6.283/8;emit('seal',i%2?'#df3826':'#e89b42',{x,y,life:0.45,delay:0.04,vx:Math.cos(a)*240,vy:Math.sin(a)*240*SQ,drag:2.8,rot:a,vr:3,s0:24,s1:8,a:0.92});}
    for(let i=0;i<10;i++){const a=i*6.283/10;flame(x,y,45,'#e85a20',0.42,{delay:motion()?0.08:0,vx:Math.cos(a)*230,vy:Math.sin(a)*170-35,drag:3,a:0.85});}
    chips(x,y,'#ffc172',28,{speed:380,size:19,life:0.45,delay:0.05});
  }

  function earthCast({x,y,r}){
    pushRankedArt('barrier',5,'barrier_mandala_ukiyoe',{x,y,w:r*2.32,ground:true,life:.68,a:.92});
    emit('edge','#ffd54f',{x,y,life:0.55,s0:r*.5,s1:r*2.2,a:0.85,ground:true,sy:SQ,rot:0.1,ease:true});
    emit('edge','#d48800',{x,y,life:0.58,s0:r*.4,s1:r*1.9,a:0.7,ground:true,sy:SQ,rot:-0.2,ease:true});
    emit('glow','#ffe082',{x,y,life:0.28,s0:130,s1:170,a:0.25,ground:true,sy:SQ,blend:'lighter'});
    for(let i=0;i<8;i++){
      const a=i*6.283/8,px=x+Math.cos(a)*r*.22,py=y+Math.sin(a)*r*.22*SQ;
      emit('rock',i%2?'#b5a37b':'#c4b38f',{x:px,y:py,foot:true,priority:true,life:0.7,delay:motion()?i*0.012:0,s0:28,s1:r*.65,a:0.95,
        vx:Math.cos(a)*r*2.2,vy:Math.sin(a)*r*2.2*SQ,drag:2.4});
      chips(px,py,'#ffd54f',5,{ang:a,speed:190,size:16,life:0.35});
      emit('seal',i%2?'#ffe082':'#ffb300',{x:px,y:py,life:0.48,s0:20,s1:28,rot:a+Math.PI/2,ground:true,sy:SQ,a:0.85});
    }
  }

  // The short summon stays behind the player. The separate missile and ground
  // image are drawn by game.js; never paint the former oversized fire beam here.
  function dragonBody(ctx,{x,y,ang=0,age=0,size=340},rank=5) {
    const image=rankedVariantArt('fire','dragon',rank) || art('foxfire_dragon_ukiyoe');
    if(!image)return;
    const face=Math.cos(ang)<0?-1:1;
    const alpha=Math.min(1,age/0.28,Math.max(0,(3-age)/0.35));
    drawImageArt(ctx,image,{x,y:y+(motion()?Math.sin(age*8)*2:0),w:size,sx:face,a:alpha});
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

  // 妖刀主體改由 renderer 的手繪貼圖負責；這裡只留少量墨金碎屑與命中點綴。
  define("katana",{
    swing(t,{x,y,ang,reach}) {
      const n=T(t,1,2,4);
      for(let i=count(n);i>0;i--){
        const a=ang+rnd(-0.7,0.7),r=reach*rnd(0.82,1.02);
        chips(x+Math.cos(a)*r,y+Math.sin(a)*r,i%2?'#e4b84f':'#10202b',1,{
          ang:a,spread:0.42,speed:T(t,80,120,165),size:T(t,5,7,9),life:0.2
        });
      }
    },
    hit(t,{x,y,ang,crit}) {
      if(crit) cut(x,y,ang+Math.PI/2,T(t,22,30,42),0,'#effcff');
      chips(x,y,crit?'#e4b84f':'#10202b',T(t,2,3,5)+(crit?2:0),{
        ang,spread:1.35,speed:T(t,120,165,220),size:T(t,5,7,9),life:0.24
      });
    }
  });

  // 靈陣：單咒盤 → 雙刻線 → 反轉雙盤＋十二方刻印；中心始終留空。
  define("barrier",{
    cast(t,{x,y,r},rank=t) {
      pushRankedArt('barrier',rank,'barrier_mandala_ukiyoe',{x,y,w:r*2.22,ground:true,life:T(t,.34,.42,.52),a:T(t,.44,.62,.8)});
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
    body(ctx,t,{x,y,ang},rank=t) {
      if(drawRankedArt(ctx,'needle',rank,{x,y,w:[48,60,76,92,108][rank-1],ang},'needle_hama_ukiyoe'))return;
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
    body(ctx,t,{x,y,spin},rank=t) {
      if(drawRankedArt(ctx,'boom',rank,{x,y,w:[27,33,40,52,68][rank-1],ang:spin},'ofuda_ukiyoe'))return;
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
    ember(t,{x,y,ang=0,vx=0,vy=0}) {
      for(let i=count(T(t,2,3,4));i>0;i--)flame(x+rnd(-4,4),y+rnd(-3,4),T(t,9,13,17),'#d76a37',T(t,0.2,0.25,0.3),
        {vx:vx*0.16+rnd(-18,18),vy:vy*0.10-rnd(34,72),drag:2.6,rot:rnd(-0.28,0.28),a:0.66});
      if(t>1)emit('stroke','#f0bd61',{x:x+rnd(-3,3),y:y-rnd(2,7),rot:-Math.PI/2+rnd(-0.18,0.18),life:0.18,s0:T(t,0,15,23),s1:4,a:T(t,0,0.42,0.52),vy:-28});
    },
    hit(t,{x,y}) {
      cut(x,y,-0.4,T(t,16,27,42),0,'#f3ca7d');
      if(t===3)cut(x,y,0.7,34,0.04,'#ecd9a8');
      chips(x,y,'#dc763c',T(t,3,5,8),{speed:T(t,130,180,240),size:T(t,6,8,11),life:0.22});
    },
    body(ctx,t,{x,y,ang,origin,orbitR=98,time=0},rank=t) {
      const visualRank=rank;
      const ranked=rankedVariantArt('fire','orbit',visualRank) || rankedArt('fire',visualRank);
      if(ranked){
        const phase=time*8.5;
        const face=(origin?.faceX??1)<0?-1:1;
        const bob=motion()?Math.sin(phase*.72)*3.2:0;
        const sway=motion()?Math.sin(phase)*.08:0;
        const breathe=motion()?Math.sin(phase*1.18):0;
        const stretchX=.98-breathe*.035,stretchY=1.03+breathe*.075;
        // 升級不得讓單顆狐火縮水；每階保持或略增大。
        const w=[68,70,72,74,76][visualRank-1];
        if(motion()){
          const tangentX=-Math.sin(ang),tangentY=Math.cos(ang);
          drawImageArt(ctx,ranked,{x:x-tangentX*4,y:y+bob-tangentY*3,w:w*.94,ang:sway*.55,a:.18,sx:face*.97,sy:1.04});
        }
        drawImageArt(ctx,ranked,{x,y:y+bob,w,ang:sway,sx:face*stretchX,sy:stretchY});
        return;
      }
      if(art('foxfire_ukiyoe')){
        const phase=time*8.5;
        const sway=motion()?Math.sin(phase)*0.11:0;
        const bob=motion()?Math.sin(phase*0.72)*4:0;
        const bend=motion()?Math.sin(phase*0.91+0.8)*3.2:0;
        const breathe=motion()?Math.sin(phase*1.18):0;
        const sx=1-breathe*0.045,sy=1+breathe*0.10;
        if(origin && t>=2) drawArt(ctx,'foxfire_ukiyoe',{x:(x+origin.x)/2+bend*0.35,y:(y+origin.y)/2+bob*0.45,w:T(t,14,18,23),ang:sway*0.7,a:.21,sx:1-breathe*0.02,sy:1+breathe*0.045});
        drawArt(ctx,'foxfire_ukiyoe',{x:x+bend,y:y+bob,w:T(t,34,42,54),ang:sway,sx,sy});
        return;
      }
      ctx.save();ctx.lineCap='butt';
      if(origin){
        ctx.strokeStyle='#b65b36';ctx.lineWidth=T(t,1.5,2.5,4);ctx.globalAlpha=0.65;
        ctx.beginPath();ctx.arc(origin.x,origin.y,orbitR,ang-T(t,0.2,0.42,0.72),ang);ctx.stroke();
        if(t===3){ctx.strokeStyle='#e8bd6e';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(origin.x,origin.y,orbitR-5,ang-0.58,ang-0.08);ctx.stroke();}
        ctx.globalAlpha=1;
      }
      ctx.translate(x,y);
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
    strike(t,{x,y,stormChild,delay=0.08},rank=t) {
      pushRankedArt('thunder',stormChild?Math.min(rank,4):rank,'thunder_ukiyoe',{x,y:y-126,w:stormChild?88:[58,72,88,104,122][rank-1],life:stormChild ? .34 : .26,delay:motion()?delay:0,a:stormChild ? .9 : .84});
      const paintedThunder=!!art('thunder_ukiyoe');
      if(stormChild){
        FX.bolt(x,y,{w:paintedThunder?0.5:3.3,a:0.9,h:paintedThunder?205:520,jag:28,life:0.32,delay:motion()?delay:0,halo:paintedThunder?0.025:0.07});
        emit('current','#b7e5ff',{x,y,priority:true,life:0.6,delay:motion()?delay:0,s0:24,s1:130,a:0.85,ground:true,sy:SQ,ease:true});
        chips(x,y,'#ddcfff',6,{speed:190,size:13});return;
      }
      FX.bolt(x,y,{w:paintedThunder?0.32:(rank===5?3.3:T(t,0.35,0.62,0.95)),a:0.9,h:paintedThunder?175:T(t,420,500,580),jag:T(t,12,22,30),life:0.22,halo:paintedThunder?0.02:0.035});
      if(t===3){
        FX.bolt(x-8,y,{w:0.45,jag:32,h:180,life:0.18,delay:motion()?0.07:0,halo:0.025});
        FX.bolt(x+8,y,{w:0.4,jag:38,h:240,life:0.18,delay:motion()?0.13:0,halo:0.025});
      }
      cut(x,y,-0.2,T(t,20,34,52),0,'#e6d49e');
      chips(x,y,'#d2bd77',T(t,6,10,16),{speed:T(t,140,210,280),size:T(t,6,9,12),life:0.3,delay:t===3?0.09:0});
    }
  });

  skills.thunder.storm=(t,{x,y,r,delay=0},rank=t)=>{
    pushRankedArt('thunder',rank,'thunder_drum_ukiyoe',{x,y:y-104,w:rank===5?176:150,life:.66,delay:motion()?delay:0,a:.86});
    // 主視覺縮小並降低密度，仍與同座標落雷成對。
    const cy = y - 82;
    emit('glow','#b9ddff',{x,y:cy,life:0.24,delay:motion()?delay:0,s0:70,s1:92,a:0.14,blend:'lighter'});
    for(let i=0;i<3;i++){
      const da=i*Math.PI*2/3+Math.PI/6,dx=x+Math.cos(da)*66,dy=cy+Math.sin(da)*26;
      cut(dx,dy,da+Math.PI/2,18,(motion()?delay:0)+0.025*i,'#bce8ff');
    }
  };
  skills.fire.ghostTrail=(t,{x,y,ang,dragon})=>{
    if(dragon){
      const face=Math.cos(ang)<0?-1:1,mx=x+face*98,my=y+8;
      flame(mx,my,34,'#ff7028',0.26,{vx:Math.cos(ang)*120,vy:Math.sin(ang)*120-18,drag:3,a:0.8});
      chips(mx,my,'#ffd97a',3,{ang,speed:150,size:9,life:0.22});
      return;
    }
    emit('stroke','#93e5cf',{x,y,rot:ang,life:0.24,s0:45,s1:10,sx:1.5,a:0.7});
    emit('glow','#86dccb',{x,y,life:0.2,s0:24,s1:8,a:0.18,blend:'lighter'});
  };
  function fireAttackBody(ctx,p){
    const rank=tierOf(p.level||1),img=rankedVariantArt('fire','attack',rank) || rankedVariantArt('fire','orbit',rank) || rankedArt('fire',rank);
    if(img){
      const phase=(p.age||0)*18,face=(p.faceX??1)<0?-1:1;
      const speed=Math.hypot(p.vx||0,p.vy||0),pulse=motion()?Math.sin(phase)*.05:0;
      const stretchX=Math.max(1.06,Math.min(1.22,1.08+Math.min(1,speed/500)*.09+pulse));
      const stretchY=Math.max(.88,Math.min(.98,.96-pulse*.35-Math.min(1,speed/500)*.04));
      const wobble=motion()?Math.sin(phase*.7)*.055:0;
      const flightTilt=motion()?Math.sin(p.ang||0)*.10:0;
      const w=[76,44,50,58,66][rank-1];
      if(motion()&&speed>1){
        const nx=(p.vx||0)/speed,ny=(p.vy||0)/speed;
        drawImageArt(ctx,img,{x:p.x-nx*8,y:p.y-ny*8,w:w*.96,ang:flightTilt+wobble*.45,a:.2,sx:face*(stretchX+.03),sy:stretchY*.96});
      }
      drawImageArt(ctx,img,{x:p.x,y:p.y,w,ang:flightTilt+wobble,sx:face*stretchX,sy:stretchY});
      return;
    }
    ghostBody(ctx,p);
  }
  define('ghost',{body:(ctx,t,p)=>p.dragon?dragonBody(ctx,p):p.fireAttack?fireAttackBody(ctx,p):ghostBody(ctx,p)});
  define('wind',{
    trail(){},
    body(ctx,t,{x,y,ang,size=360}){
      const ranked=rankedArt('katana',5);
      const art=ranked || window.ART?.katana_wave_ukiyoe;
      if(art && art.naturalWidth>0 && art.naturalHeight>0){
        const h=size,w=h*art.naturalWidth/art.naturalHeight;
        // 新五階圖資產本身已按正確飛行方向繪製；舊單圖備援才需要鏡射。
        ctx.save();ctx.translate(x,y);ctx.rotate(ang);
        if(!ranked)ctx.scale(-1,1);
        if(motion()){
          ctx.globalAlpha=0.08;
          ctx.drawImage(art,-w*0.5+14,-h*0.505,w*1.01,h*1.01);
        }
        ctx.globalAlpha=0.8;
        ctx.drawImage(art,-w*0.5,-h*0.5,w,h);
        ctx.restore();
        return;
      }
      ctx.save();ctx.globalAlpha=0.8;ctx.translate(x,y);ctx.rotate(ang);ctx.scale(-1,1);
      const h=size/2,r=size/Math.sqrt(2),cx=-r/Math.sqrt(2);
      // 1. 深墨影底襯 (Deep Ink Shadow Backing)
      ctx.strokeStyle='rgba(12,18,28,0.95)';ctx.lineWidth=20;
      ctx.beginPath();ctx.arc(cx,0,r,-Math.PI/4,Math.PI/4);ctx.stroke();
      // 2. 金光流刃 (Golden Blade Edge)
      ctx.strokeStyle='#ffdf7a';ctx.lineWidth=10;
      ctx.beginPath();ctx.arc(cx,0,r-1,-Math.PI/4,Math.PI/4);ctx.stroke();
      // 3. 青海波風刃本體 (Ukiyo-e Azure Wave Crescent Body)
      ctx.fillStyle='#30c8f0';ctx.strokeStyle='#0f6e91';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(cx,0,r,-Math.PI/4,Math.PI/4);ctx.quadraticCurveTo(45,0,0,-h);ctx.closePath();ctx.fill();ctx.stroke();
      // 內層白熱極刃 (White-Hot Celestial Razor Core)
      ctx.fillStyle='#c8f8ff';
      ctx.beginPath();ctx.arc(cx,0,r-3,-Math.PI/4+0.04,Math.PI/4-0.04);ctx.quadraticCurveTo(25,0,0,-h+15);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#ffffff';ctx.lineWidth=6;
      ctx.beginPath();ctx.arc(cx,0,r-4,-Math.PI/4+0.015,Math.PI/4-0.015);ctx.stroke();
      // 4. 青海波浪尖牙紋 (Wave-Tooth Crest Spikes)
      ctx.strokeStyle='#fff8d0';ctx.lineWidth=2.5;
      for(let f of [-0.4,-0.12,0.18,0.48]){
        const fa=f*(Math.PI/4),fx=cx+Math.cos(fa)*r,fy=Math.sin(fa)*r;
        ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx+Math.cos(fa-0.85)*35,fy+Math.sin(fa-0.85)*35);ctx.stroke();
      }
      // 5. 兩端斬裂空間水墨拖尾 (Ink Streamer Tips)
      ctx.strokeStyle='rgba(15,22,34,0.85)';ctx.lineWidth=4;
      ctx.beginPath();
      ctx.moveTo(0,-h);ctx.lineTo(-40,-h-15);
      ctx.moveTo(0,h);ctx.lineTo(-40,h+15);
      ctx.stroke();
      ctx.restore();
    }
  });

  define('ice',{body(ctx,t,{x,y,boss}){
    ctx.save();ctx.translate(x,y);const s=boss?1.5:1.1;ctx.scale(s,s);
    // 1. 地面玄冰晶簇 (Ground Ice Crystal Clusters)
    ctx.fillStyle='#32a8d8';ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-32,10);ctx.lineTo(-24,-14);ctx.lineTo(-15,10);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(15,10);ctx.lineTo(26,-12);ctx.lineTo(34,10);ctx.closePath();ctx.fill();ctx.stroke();
    // 2. 封魔玄冰神柱本體 (Glacial Prism Monolith)
    ctx.fillStyle='rgba(80, 200, 245, 0.42)';ctx.strokeStyle='#d4f6ff';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(-24,10);ctx.lineTo(-32,-30);ctx.lineTo(-14,-68);ctx.lineTo(15,-62);ctx.lineTo(30,-26);ctx.lineTo(24,10);ctx.closePath();ctx.fill();ctx.stroke();
    // 3. 冰稜內部幾何折射稜線 (Prismatic Refraction Facets)
    ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(-14,-68);ctx.lineTo(0,-25);ctx.lineTo(24,10);
    ctx.moveTo(-32,-30);ctx.lineTo(0,-25);ctx.lineTo(15,-62);
    ctx.moveTo(-24,10);ctx.lineTo(0,-25);
    ctx.stroke();
    // 4. 核心極光雪晶符文 (Snowflake Rune)
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.8;
    ctx.beginPath();
    ctx.moveTo(0,-42);ctx.lineTo(0,-22);
    ctx.moveTo(-10,-32);ctx.lineTo(10,-32);
    ctx.moveTo(-7,-39);ctx.lineTo(7,-25);
    ctx.moveTo(-7,-25);ctx.lineTo(7,-39);
    ctx.stroke();
    ctx.restore();
  }});

  function update(dt) {
    for(let i=artFx.length-1;i>=0;i--){
      const p=artFx[i];p.delay=Math.max(0,(p.delay||0)-dt);p.life-=dt;
      if(p.life<=0)artFx.splice(i,1);
    }
    for(let i=burning.length-1;i>=0;i--){
      const b=burning[i],e=b.e;b.t-=dt;
      if(b.t<=0 || e.hp<=0){burning.splice(i,1);continue;}
      if((b.tick-=dt)>0)continue;b.tick=0.12;
      const big=e.type==='boss'?1.5:1;
      for(let k=count(b.tier>=2?2:1);k>0;k--)flame(e.x+rnd(-7,7)*big,e.y+rnd(-5,5),T(b.tier,12,17,0)*big,'#c96136',0.3,{vy:-rnd(20,45),drag:3,a:0.65});
    }
  }
  function reset() { burning.length=0;artFx.length=0; }
  return {SQ,tier:tierOf,pick:(level,...values)=>values[Math.min(tierOf(level)-1,values.length-1)],define,play,paint,drawArtFx,update,reset,has:id=>!!skills[id]};
})();
