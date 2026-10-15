// Ukiyo-e / onmyodo procedural skill art. Self-contained; no new image downloads.
// Geometry: seal/impact marks = WORLD GROUND; cloud/lightning/ofuda = UPRIGHT.
// Pure Canvas drawing; combat stats and collision live in game.js.
window.ONMYO_VFX = (() => {
  const TAU = Math.PI * 2;
  const C = Object.freeze({
    ink:'#142b38', teal:'#168f9c', jade:'#38d7ca', pale:'#c9fff5',
    paper:'#fff1d9', vermilion:'#cf413c', deepRed:'#7f2336',
    gold:'#dfc38b', sky:'#aeb4e0', violet:'#6c68b3'
  });
  const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
  const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  function curve(ctx,r,begin,end,color,width){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(0,0,r,begin,end);ctx.stroke();
  }
  function yinYang(ctx,r){
    ctx.save();
    ctx.fillStyle=C.ink;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
    ctx.fillStyle=C.pale;ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);
    ctx.arc(0,r/2,r/2,Math.PI/2,-Math.PI/2,true);
    ctx.arc(0,-r/2,r/2,Math.PI/2,-Math.PI/2);ctx.fill();
    for(const [y,fill] of [[-r/2,C.ink],[r/2,C.pale]]){
      ctx.fillStyle=fill;ctx.beginPath();ctx.arc(0,y,r*.13,0,TAU);ctx.fill();
    }
    curve(ctx,r,0,TAU,C.gold,Math.max(1.2,r*.055));ctx.restore();
  }
  function trigram(ctx,dist,angle,index,size){
    // Eight trigrams, broken/solid lines. Intentionally hand-engraved, not European runes.
    const pattern=[0b111,0b110,0b101,0b100,0b011,0b010,0b001,0b000][index];
    ctx.save();ctx.rotate(angle);ctx.translate(0,-dist);
    ctx.strokeStyle=index%2?C.gold:C.pale;ctx.lineWidth=Math.max(1.4,size*.16);ctx.lineCap='round';
    for(let row=0;row<3;row++){
      const yy=(row-1)*size*.32,half=size*.5;
      ctx.beginPath();
      if(pattern&(1<<row)){ctx.moveTo(-half,yy);ctx.lineTo(half,yy);}
      else{ctx.moveTo(-half,yy);ctx.lineTo(-size*.13,yy);
        ctx.moveTo(size*.13,yy);ctx.lineTo(half,yy);}
      ctx.stroke();
    }ctx.restore();
  }
  function seal(ctx,x,y,r,time=0,rank=1,alpha=1){
    if(!Number.isFinite(r)||r<=0)return;
    const spin=reduced()?0:time;
    ctx.save();ctx.translate(x,y);ctx.globalAlpha*=limit(alpha,0,1);
    // Thin watercolor contact bloom; the floor owns its perspective.
    ctx.fillStyle='rgba(21,136,143,0.16)';
    ctx.beginPath();ctx.arc(0,0,r*.98,0,TAU);ctx.fill();
    ctx.strokeStyle=C.ink;ctx.lineWidth=Math.max(2,r*.037);
    ctx.beginPath();ctx.arc(0,0,r*.96,0,TAU);ctx.stroke();
    for(let ring=0;ring<2;ring++){
      ctx.save();ctx.rotate((ring?-.15:.22)*spin);
      for(let i=0;i<8;i++){
        const a=i*TAU/8;
        curve(ctx,r*(ring?.79:.94),a+.035,a+.64,
          ring?C.gold:C.jade,Math.max(2.5,r*(ring?.012:.024)));
        if(!ring && i<8)trigram(ctx,r*.76,a,i,Math.max(12,r*.18));
      }
      ctx.restore();
    }
    ctx.save();ctx.rotate(spin*.32);yinYang(ctx,r*.31);ctx.restore();
    if(rank>=3){
      // Ink petals / cold spirit flames: very few, dimensionally readable.
      for(let i=0;i<Math.min(8,2+rank);i++){
        const a=i*TAU/7+(reduced()?0:Math.sin(spin*1.4+i)*.04);
        const rr=r*.58;
        ctx.fillStyle=i%3===0?C.gold:C.pale;
        ctx.beginPath();ctx.ellipse(Math.cos(a)*rr,Math.sin(a)*rr,Math.max(2,r*.022),
          Math.max(3,r*.045),a,0,TAU);ctx.fill();
      }
    }
    ctx.restore();
  }
  function lightningMark(ctx,x,y,r,time=0,alpha=1){
    ctx.save();ctx.translate(x,y);ctx.globalAlpha*=limit(alpha,0,1);
    ctx.fillStyle='rgba(78,104,180,0.15)';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
    ctx.strokeStyle=C.sky;ctx.lineWidth=Math.max(2,r*.08);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2 + (reduced()?0:time*.3);
      curve(ctx,r*.84,a+.12,a+1.1,C.violet,Math.max(1.8,r*.07));
    }
    ctx.strokeStyle=C.pale;ctx.lineWidth=Math.max(2,r*.1);ctx.lineJoin='miter';
    ctx.beginPath();ctx.moveTo(-r*.1,-r*.58);ctx.lineTo(r*.23,-r*.12);
    ctx.lineTo(-r*.08,-r*.12);ctx.lineTo(r*.1,r*.61);ctx.stroke();
    for(let i=0;i<6;i++){
      const a=i*TAU/6;
      ctx.fillStyle=i%2?C.jade:C.paper;
      ctx.fillRect(Math.cos(a)*r*.72-2,Math.sin(a)*r*.72-2,4,4);
    }ctx.restore();
  }
  function cloud(ctx,x,y,time=0,rank=1,opacity=1){
    ctx.save();ctx.translate(x,y);ctx.globalAlpha*=limit(opacity,0,1);
    const sway=reduced()?0:Math.sin(time*2)*3;
    ctx.translate(sway,0);
    // Layered deep-blue ink cloud, outlined like a woodblock print rather than neon.
    ctx.fillStyle='#3d4568';ctx.strokeStyle=C.ink;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-57,-3);ctx.bezierCurveTo(-64,-27,-44,-39,-23,-29);
    ctx.bezierCurveTo(-12,-53,20,-52,29,-30);ctx.bezierCurveTo(57,-36,65,-7,51,5);
    ctx.bezierCurveTo(38,18,15,10,0,12);ctx.bezierCurveTo(-30,18,-51,15,-57,-3);
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=C.sky;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(-42,-12);ctx.quadraticCurveTo(-19,-36,1,-19);
    ctx.moveTo(1,-22);ctx.quadraticCurveTo(25,-39,41,-11);
    ctx.moveTo(-29,0);ctx.quadraticCurveTo(-9,10,18,1);ctx.stroke();
    ctx.strokeStyle=C.pale;ctx.lineWidth=1.6;
    for(const [px,py] of [[-21,-22],[21,-18],[5,2]]){
      ctx.beginPath();ctx.moveTo(px-8,py);ctx.quadraticCurveTo(px,py-6,px+8,py);ctx.stroke();
    }
    if(rank>=4){ctx.fillStyle=C.gold;ctx.fillRect(-3,-36,6,4);}
    ctx.restore();
  }
  function strike(ctx,x,y,time=0,rank=1,opacity=1){
    ctx.save();ctx.translate(x,y);ctx.globalAlpha*=limit(opacity,0,1);
    const zig=reduced()?0:Math.sin(time*41)*4;
    // The bolt ends exactly at (x,y) and rises into the separate upright cloud.
    function path(offset){
      ctx.beginPath();ctx.moveTo(offset-10,-168);
      ctx.lineTo(offset+14+zig,-133);ctx.lineTo(offset-12-zig,-95);
      ctx.lineTo(offset+10,-61);ctx.lineTo(offset-7,-36);
      ctx.lineTo(offset,0);
    }
    ctx.lineJoin='round';ctx.lineCap='round';
    path(0);ctx.strokeStyle='#393f90';ctx.lineWidth=15;ctx.stroke();
    path(0);ctx.strokeStyle=C.jade;ctx.lineWidth=9;ctx.stroke();
    path(0);ctx.strokeStyle='#f6fdff';ctx.lineWidth=4;ctx.stroke();
    if(rank>=3){
      ctx.strokeStyle=C.sky;ctx.lineWidth=2.8;
      ctx.beginPath();ctx.moveTo(8,-66);ctx.lineTo(25,-47);ctx.lineTo(13,-24);ctx.stroke();
    }
    for(let i=0;i<Math.min(7,3+rank);i++){
      const a=i*2.4+time*3,dist=13+(i%3)*7;
      ctx.fillStyle=i%2?C.pale:C.gold;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*dist,Math.sin(a)*dist);
      ctx.lineTo(Math.cos(a)*dist+2,Math.sin(a)*dist-8);
      ctx.lineTo(Math.cos(a)*dist+5,Math.sin(a)*dist);ctx.fill();
    }
    ctx.restore();
  }
  function ofuda(ctx,x,y,time=0,rank=1,opacity=1){
    ctx.save();ctx.translate(x,y);
    // Paper wobble instead of rapid, unreadable 16 rad/s rotation.
    if(!reduced())ctx.rotate(Math.sin(time*1.4)*.17);
    ctx.globalAlpha*=limit(opacity,0,1);
    const size=1+Math.min(rank,5)*.055;ctx.scale(size,size);
    ctx.fillStyle='rgba(22,29,39,.42)';ctx.fillRect(-15,-29,32,62);
    ctx.fillStyle=C.paper;ctx.strokeStyle=C.deepRed;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-15,-31);ctx.lineTo(13,-32);
    ctx.lineTo(16,26);ctx.lineTo(8,33);ctx.lineTo(-12,30);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.fillStyle=C.vermilion;ctx.fillRect(-12,-28,24,10);ctx.fillRect(-10,24,20,3);
    ctx.strokeStyle=C.ink;ctx.lineWidth=2.2;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(0,7);ctx.moveTo(-7,-4);ctx.lineTo(8,-4);
    ctx.moveTo(-6,3);ctx.lineTo(-2,11);ctx.lineTo(6,7);ctx.stroke();
    ctx.fillStyle=C.deepRed;ctx.beginPath();ctx.arc(0,17,6,0,TAU);ctx.fill();
    ctx.strokeStyle=C.paper;ctx.lineWidth=1.4;ctx.beginPath();
    ctx.moveTo(-3,17);ctx.lineTo(3,17);ctx.moveTo(0,14);ctx.lineTo(0,20);ctx.stroke();
    if(rank>=4){ctx.strokeStyle=C.jade;ctx.lineWidth=1.2;
      ctx.strokeRect(-17,-34,34,69);}
    ctx.restore();
  }
  return Object.freeze({colors:C,seal,lightningMark,cloud,strike,ofuda});
})();
