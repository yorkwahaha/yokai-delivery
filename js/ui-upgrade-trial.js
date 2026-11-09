// Approved Phase42 raster upgrade cards, now wired directly into the game.
// All 39 center illustrations and the single shared frame live in /assets.
(() => {
  if (!window.UI) return;
  const params=new URLSearchParams(typeof location!=="undefined"?location.search||"":"");
  const host=String(typeof location!=="undefined"?location.hostname||"":"");
  const local=/^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/.test(host);
  const UI=window.UI, cache=Object.create(null);
  const palette={gold:"#d8b173",light:"#ffe4ad",paper:"#f2dfbb",dim:"#baa58c"};
  // The Japanese Yuji Syuku face lacks several Taiwan Traditional Chinese glyphs.
  // DFKai-SB is present on Windows; keep a Japanese brush face for kana fallback.
  const fontFamilies={
    kai:"'DFKai-SB','標楷體','BiauKai','Yokai Trial MoonStars Kai T','Noto Serif TC',serif",
    yuji:"'Yokai Brush JP','DFKai-SB','BiauKai','Noto Serif TC',serif",
    readable:"'Yokai Noto JP','Noto Sans JP','Microsoft JhengHei',sans-serif",
    bakudai:"'Yokai Trial Bakudai TC','DFKai-SB',serif",
    masa:"'Yokai Trial Masa TC','DFKai-SB',serif",
    wenkai:"'Yokai Trial WenKai TC','DFKai-SB',serif",
    moonstars:"'Yokai Trial MoonStars Kai T','DFKai-SB','標楷體','BiauKai',serif",
    moonstarsbold:"'Yokai Trial MoonStars Kai T Bold','DFKai-SB',serif",
    xuandong:"'Yokai Trial Xuandong','DFKai-SB',serif",
    arphicsun:"'Yokai Local Arphic Sun','DFKai-SB',serif",
    arphicmao:"'Yokai Local Arphic Mao','DFKai-SB',serif",
    hanyan:"'Yokai Trial HanWang YanKai','DFKai-SB','標楷體','BiauKai',serif",
    cwtexkai:"'Yokai Trial cwTeX QKaiZH','DFKai-SB',serif",
    chillkai:"'Yokai Trial ChillKai Big5','DFKai-SB',serif"
  };
  const trialWebFonts={
    bakudai:"Yokai Trial Bakudai TC",
    masa:"Yokai Trial Masa TC",
    wenkai:"Yokai Trial WenKai TC",
    moonstars:"Yokai Trial MoonStars Kai T",
    moonstarsbold:"Yokai Trial MoonStars Kai T Bold",
    xuandong:"Yokai Trial Xuandong",
    hanyan:"Yokai Trial HanWang YanKai",
    cwtexkai:"Yokai Trial cwTeX QKaiZH",
    chillkai:"Yokai Trial ChillKai Big5"
  };
  // Commercial families are intentionally NOT embedded or distributed.
  const licensedLocalFonts={
    arphicsun:"Yokai Local Arphic Sun",
    arphicmao:"Yokai Local Arphic Mao"
  };
  // The approved HanWang trial is available on the user's local development
  // machine. Do not make its GPL subset part of a public release without
  // reviewing source-distribution obligations. Public clients use DFKai-SB.
  const requested=params.get("upgradeFont");
  const fontMode=local&&Object.hasOwn(fontFamilies,requested)&&
    !Object.hasOwn(licensedLocalFonts,requested)?requested:(local?"hanyan":"kai");
  const textFont=(size,role="label")=>fontMode==="readable"
    ?UI.readableFont(size,role==="body"?"700":"900")
    :`400 ${size}px ${fontFamilies[fontMode]}`;
  const approvedActive=new Set(["katana","fire","needle","barrier","boom","thunder"]);
  const passiveCards=new Set(["shield","oil_max","oil_heal","dmg","rate","crit","spd","dash","mag"]);
  const mutationCards=new Set([
    "mut_boom_fan","mut_seek","mut_boom_seek","mut_frost","mut_boom_frost",
    "mut_pierce","mut_return","mut_crosscut","mut_pulse","mut_branch",
    "mut_orbit","mut_splitblast","mut_iaicharge","mut_armorbreak","mut_longblade",
    "mut_bindseal","mut_widecircle","mut_repulse","mut_rapidfire","mut_flamebind",
    "mut_furyfire","mut_thunderfocus","mut_thunderstun","mut_thunderoverload"
  ]);
  const sharedCards=new Set([...approvedActive,...passiveCards,...mutationCards]);
  const framePath="assets/img/ui/menu/ui__upgrade-card-frame.png";
  const centerPath=id=>{
    const slug=String(id).replace(/_/g,"-");
    return "assets/img/skills/"+slug+"/cards/"+slug+"__art.webp";
  };
  const artworkBox={x:102,y:65,w:820,h:1230,clipX:112,clipY:216,clipW:802,clipH:868};
  const titlePoint={x:512,y:1158},classPoint={x:512,y:1341};
  const skillClasses={katana:"斬擊",fire:"火焰",needle:"穿刺",barrier:"陣法",boom:"符咒",thunder:"雷擊"};
  window.__YOKAI_UPGRADE_PHASE42={framePath,centerPath,artworkBox,titlePoint,classPoint,
    sharedCardIds:[...sharedCards]};
  UI.upgradeTrialEnabled=()=>true;
  const image=(src)=>{
    if(!src || typeof window.Image!=="function")return null;
    if(!(src in cache)){
      cache[src]=null;const im=new window.Image();im.decoding="async";
      im.onload=()=>{cache[src]=im;};im.onerror=()=>{cache[src]=null;};im.src=src;
    }
    return cache[src]?.naturalWidth ? cache[src] : null;
  };
  const round=(ctx,x,y,w,h,r=10)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
  const paint=(ctx,x,y,w,h,color,r=10)=>{ctx.fillStyle=color;round(ctx,x,y,w,h,r);ctx.fill();};
  const tracking=(ctx,amount)=>{if("letterSpacing" in ctx)ctx.letterSpacing=amount+"px";};
  // Reduce actual font size before falling back to Canvas maxWidth squashing.
  // Horizontal glyph compression makes calligraphic strokes hard to recognize.
  const write=(ctx,str,x,y,w,size=18,align="center",color=palette.paper)=>{
    const value=String(str??"");
    ctx.font=textFont(size);tracking(ctx,size>=16?.35:.2);
    const measured=ctx.measureText(value).width;
    if(w>0&&measured>w){
      const min=Math.min(size,Math.max(12,size*.70));
      const fitted=Math.max(min,Math.floor(size*w/measured*2)/2);
      ctx.font=textFont(fitted);tracking(ctx,fitted>=16?.35:.2);
    }
    ctx.textAlign=align;ctx.textBaseline="middle";
    ctx.fillStyle=color;ctx.fillText(value,x,y,w);
  };
  // Long skill names get two balanced rows inside the SAME approved raster
  // plaque. Keep short names anchored at its exact fixed center.
  const writeCardTitle=(ctx,title,x,y,width,mutation=false,color="#34251c")=>{
    const chars=Array.from(String(title||""));
    if(chars.length<6){
      write(ctx,title,x,y,width,mutation?18:20,"center",color);
      return;
    }
    const mark=chars.indexOf("・");
    const split=mark>=1&&mark+1<=5&&chars.length-mark-1>=2
      ?mark+1:Math.ceil(chars.length/2);
    const top=chars.slice(0,split).join("");
    const bottom=chars.slice(split).join("");
    const lineSize=mutation?16:17;
    write(ctx,top,x,y-8,width,lineSize,"center",color);
    write(ctx,bottom,x,y+8,width,lineSize,"center",color);
  };
  const paragraph=(ctx,text,x,y,width,maxLines=3,font=17,color=palette.paper,lineHeight=20)=>{
    ctx.font=textFont(font,"body");tracking(ctx,.3);ctx.fillStyle=color;
    ctx.textAlign="left";ctx.textBaseline="alphabetic";
    const parts=String(text||"").match(/[A-Za-z0-9.+%×/→−]+|\s+|./gu)||[];
    const lines=[];let cur="";
    for(const part of parts){
      if(cur&&ctx.measureText(cur+part).width>width){lines.push(cur.trim());cur="";}
      cur+=part;
    }
    if(cur)lines.push(cur.trim());
    for(let i=0;i<Math.min(lines.length,maxLines);i++){
      let value=lines[i];
      if(i===maxLines-1&&lines.length>maxLines){
        while(value.length&&ctx.measureText(value+"…").width>width)value=value.slice(0,-1);
        value+="…";
      }
      ctx.fillText(value,x,y+i*lineHeight,width);
    }
  };
  UI.levelUpLayout=(count=3)=>{
    const n=Math.max(0,Math.min(3,Math.round(Number.isFinite(count)?count:3)));
    const scale=window.VIEWPORT?.get?.().scale||1;
    const w=160,h=238,gap=39,y=142;
    const x=Math.round((900-(w*n+gap*Math.max(0,n-1)))/2);
    const cards=Array.from({length:n},(_,i)=>({x:x+i*(w+gap),y,w,h,index:i}));
    const bh=Math.min(82,Math.max(50,Math.ceil(44/scale)));
    return {
      trial:true,scale,count:n,pad:8,cards,card:{x,y,w,h,gap,count:n},
      panel:{x:26,y:20,w:848,h:557},
      titleBar:{x:280,y:22,w:340,h:76},
      summaryBar:{x:240,y:102,w:420,h:27},
      details:{x:130,y:390,w:640,h:103},
      reroll:{x:345,y:Math.min(514,587-bh),w:210,h:bh},
      footer:{y:510,h:66}
    };
  };
  function backdrop(ctx,L,awakening){
    const bounds=window.VIEWPORT?.bounds?.()||{left:0,top:0,width:900,height:600};
    ctx.fillStyle="rgba(6,9,18,.86)";ctx.fillRect(bounds.left,bounds.top,bounds.width,bounds.height);
    const p=L.panel,boardSrc=window.__YOKAI_UPGRADE_BOARD_SRC;
    const board=image(typeof boardSrc==="string"?boardSrc:"");
    if(board)ctx.drawImage(board,p.x,p.y,p.w,p.h);
    else{
      const bg=ctx.createLinearGradient(0,p.y,0,p.y+p.h);
      bg.addColorStop(0,"#171a2a");bg.addColorStop(.55,"#282538");bg.addColorStop(1,"#171826");
      ctx.shadowColor="rgba(0,0,0,.58)";ctx.shadowBlur=18;
      paint(ctx,p.x,p.y,p.w,p.h,bg,24);ctx.shadowBlur=0;
      ctx.strokeStyle=palette.gold;ctx.lineWidth=2;
      round(ctx,p.x,p.y,p.w,p.h,24);ctx.stroke();
      ctx.strokeStyle="rgba(234,190,120,.32)";ctx.lineWidth=1;
      round(ctx,p.x+9,p.y+9,p.w-18,p.h-18,17);ctx.stroke();
    }
    const t=L.titleBar;
    // High-resolution approved plate may be swapped without altering the
    // geometry/text layer. Existing plaque remains a safe raster fallback.
    const approvedTitle=image("assets/img/ui/upgrade/approved_title.webp");
    const titleArt=approvedTitle||
      image("assets/img/ui/phase42/title_plaque.webp");
    if(titleArt)ctx.drawImage(titleArt,t.x-5,t.y-3,t.w+10,t.h+7);
    else{
      const plume=ctx.createLinearGradient(0,t.y,0,t.y+t.h);
      plume.addColorStop(0,"#363147");plume.addColorStop(1,"#121523");
      paint(ctx,t.x,t.y,t.w,t.h,plume,15);
      ctx.strokeStyle=palette.light;ctx.lineWidth=2;round(ctx,t.x,t.y,t.w,t.h,15);ctx.stroke();
    }
    // Figure-2 approved title crop already contains the gold calligraphy.
    // The older blank plaque still needs its dynamic text fallback.
    if(!approvedTitle)write(ctx,"能力提升",450,t.y+t.h/2+2,240,38,"center",palette.light);
    const summary="選擇一項技能";
    write(ctx,summary,450,115,430,20);
  }
  const formalArt=new Set(["katana","fire","needle","barrier","boom","thunder",
    "shield","dmg","rate","crit","spd","dash","oil_max","oil_heal","mag",
    "mut_return","mut_pulse","mut_seek","mut_frost","mut_pierce",
    "mut_crosscut","mut_branch","mut_orbit","mut_splitblast"]);
  function drawChoice(ctx,c,r,focused,num,time=0){
    ctx.save();ctx.shadowColor=focused?"#f6bd58":"rgba(0,0,0,.65)";
    ctx.shadowBlur=focused?22:7;
    const shared=sharedCards.has(c.id);
    const frame=shared?image(framePath):null;
    const center=shared?image(centerPath(c.id)):null;
    const fullSrc=null;
    const full=shared?null:image(fullSrc);
    const cardClass=skillClasses[c.id] ||
      (passiveCards.has(c.id)?"被動":mutationCards.has(c.id)?"變異":"修行");
    if(c.type==="coins"){
      // Post-cap reward is currency, not an uncapped passive. Reuse the
      // approved card base and lettering, without fake pictorial artwork.
      const board=image("assets/img/ui/upgrade/card_dark.webp");
      if(board)ctx.drawImage(board,r.x,r.y,r.w,r.h);
      else paint(ctx,r.x,r.y,r.w,r.h,"#1c2436",10);
      if(frame)ctx.drawImage(frame,r.x,r.y,r.w,r.h);
      ctx.shadowBlur=0;
      write(ctx,"夜行賞金",r.x+r.w/2,r.y+r.h*.28,r.w-24,20,"center",palette.light);
      write(ctx,"金幣",r.x+r.w/2,r.y+r.h*.49,r.w-20,36,"center",palette.paper);
      write(ctx,"+100",r.x+r.w/2,r.y+r.h*.65,r.w-20,30,"center",palette.light);
      write(ctx,"永久留存",r.x+r.w/2,r.y+r.h*.86,r.w-24,16,"center",palette.dim);
    }
    else if(shared && frame && center){
      // Exact same approved raster frame for all 39; image sits beneath it.
      // Crop only the illustration opening specified by the approved manifest.
      const sx=r.w/1024,sy=r.h/1536,a=artworkBox;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x+a.clipX*sx,r.y+a.clipY*sy,a.clipW*sx,a.clipH*sy);
      ctx.clip();
      ctx.drawImage(center,r.x+a.x*sx,r.y+a.y*sy,a.w*sx,a.h*sy);
      ctx.restore();
      ctx.drawImage(frame,r.x,r.y,r.w,r.h);
      ctx.shadowBlur=0;
      writeCardTitle(ctx,c.n||"",r.x+titlePoint.x*sx,r.y+titlePoint.y*sy,r.w*.66,
        mutationCards.has(c.id));
      write(ctx,cardClass,r.x+classPoint.x*sx,r.y+classPoint.y*sy,r.w*.42,16,
        "center",palette.light);
    }
    else if(full) {
      ctx.drawImage(full,r.x,r.y,r.w,r.h);
      // Full preview card images contain blank name and class plaques.
      // Draw dynamic text on top; the approved thunder v2 art has taller scenery.
      const thunderV2=c.id==="thunder" && window.__YOKAI_UPGRADE_THUNDER_V2===true;
      ctx.shadowBlur=0;
      writeCardTitle(ctx,c.n||"",r.x+r.w/2,r.y+r.h*(thunderV2?.757:.806),
        r.w*.77,mutationCards.has(c.id));
      const skillClass=({katana:"斬擊",fire:"火焰",needle:"穿刺",barrier:"陣法",boom:"符咒",thunder:"雷擊"})[c.id]
        || ({weapon:"主動",passive:"被動",mutation:"變異",charm:"御守"})[c.type] || "修行";
      write(ctx,skillClass,r.x+r.w/2,r.y+r.h*(thunderV2?.882:.933),r.w*.56,16,"center",palette.light);
    }
    else if(shared){
      // A missing shipped asset is a build error, not a ZIP import prompt.
      paint(ctx,r.x,r.y,r.w,r.h,"#192236",10);
      if(frame)ctx.drawImage(frame,r.x,r.y,r.w,r.h);
      ctx.shadowBlur=0;
      write(ctx,"卡片素材載入中",r.x+r.w/2,r.y+r.h*.4,r.w-12,14);
      writeCardTitle(ctx,c.n||"",r.x+r.w/2,r.y+r.h*(1158/1536),r.w*.66,
        mutationCards.has(c.id));
      write(ctx,cardClass,r.x+r.w/2,r.y+r.h*(1341/1536),r.w*.42,16);
    }
    else{
      const card=image("assets/img/ui/upgrade/card_dark.webp");
      if(card)ctx.drawImage(card,r.x,r.y,r.w,r.h);
      else{
        paint(ctx,r.x,r.y,r.w,r.h,"#192236",10);
        ctx.strokeStyle=palette.gold;ctx.lineWidth=2;round(ctx,r.x,r.y,r.w,r.h,10);ctx.stroke();
      }
      const src=formalArt.has(c.id)
        ?"assets/img/ui/upgrade/illustrations/"+c.id+".webp"
        :(c.id||"").startsWith("charm_")
          ?"assets/img/ui/charm-passive/b11/omamori_"+c.id.slice(6)+".webp":"";
      const art=image(src);
      if(art){
        const a={x:r.x+13,y:r.y+26,w:r.w-26,h:136};
        ctx.save();round(ctx,a.x,a.y,a.w,a.h,5);ctx.clip();
        const z=Math.max(a.w/art.naturalWidth,a.h/art.naturalHeight);
        ctx.drawImage(art,a.x+(a.w-art.naturalWidth*z)/2,
          a.y+(a.h-art.naturalHeight*z)/2,art.naturalWidth*z,art.naturalHeight*z);
        ctx.restore();
      } else if(UI.drawEmblem) {
        // Only a fallback marker, never presented as final painted art.
        UI.drawEmblem(ctx,c.id,r.x+r.w/2,r.y+95,36);
      }
      ctx.shadowBlur=0;
      paint(ctx,r.x+12,r.y+172,r.w-24,36,"rgba(247,232,204,.95)",6);
      writeCardTitle(ctx,c.n||"",r.x+r.w/2,r.y+190,r.w-31,
        mutationCards.has(c.id));
      const type=({weapon:"主動",passive:"被動",mutation:"變異",
        charm:"御守",duo:"共鳴",fusion:"合武"})[c.type]||"修行";
      write(ctx,type,r.x+r.w/2,r.y+219,r.w-24,16,"center",palette.light);
    }
    ctx.restore();
    if(c.type==="weapon" && c.lv===5 && typeof ctx.createLinearGradient==="function"){
      // Short mirror sweep over the Lv5 artwork, preserving the approved card.
      // It repeats every 4.8s, never as a permanent opaque overlay.
      const phase=((Number(time)||0)%4.8+4.8)%4.8;
      if(phase<.82){
        const a={x:r.x+r.w*.11,y:r.y+r.h*.15,w:r.w*.78,h:r.h*.61};
        const sweep=a.x-75+(a.w+150)*(phase/.82);
        ctx.save();
        ctx.beginPath();ctx.rect(a.x,a.y,a.w,a.h);ctx.clip();
        ctx.globalCompositeOperation="screen";
        const mirror=ctx.createLinearGradient(sweep-57,a.y,sweep+57,a.y+a.h);
        mirror.addColorStop(0,"rgba(255,247,211,0)");
        mirror.addColorStop(.39,"rgba(255,247,211,0)");
        mirror.addColorStop(.49,"rgba(255,248,221,.64)");
        mirror.addColorStop(.55,"rgba(255,255,255,.84)");
        mirror.addColorStop(.65,"rgba(255,235,156,0)");
        mirror.addColorStop(1,"rgba(255,235,156,0)");
        ctx.fillStyle=mirror;
        ctx.fillRect(a.x,a.y,a.w,a.h);
        ctx.restore();
      }
    }
    if(focused){
      ctx.save();ctx.shadowColor="#f3af39";ctx.shadowBlur=15;
      ctx.strokeStyle=palette.light;ctx.lineWidth=3;
      round(ctx,r.x-4,r.y-4,r.w+8,r.h+8,10);ctx.stroke();ctx.restore();
    }
    write(ctx,String(num),r.x+r.w/2,r.y+r.h+13,r.w,16,
      "center",focused?palette.light:palette.dim);
  }
  function drawDetails(ctx,L,c){
    const d=L.details;
    // Use the actual shipped wide formal parchment; the previously preferred
    // approved_details.webp path does not exist in this project.
    const approved=image("assets/img/ui/phase42/detail_board.webp?v=20261109-details-wrap-r2");
    const paper=approved||image("assets/img/ui/illustrated/result_panel.webp");
    if(approved){
      ctx.save();
      ctx.shadowColor="rgba(0,0,0,.50)";ctx.shadowBlur=12;
      ctx.drawImage(approved,d.x,d.y,d.w,d.h);
      ctx.restore();
    }else if(paper){
      const iw=paper.naturalWidth,ih=paper.naturalHeight;
      const sx=Math.round(iw*.15),sy=Math.round(ih*.23);
      const dx=Math.min(27,d.w*.12),dy=Math.min(16,d.h*.22);
      ctx.save();
      ctx.shadowColor="rgba(0,0,0,.58)";ctx.shadowBlur=15;
      const srcX=[0,sx,iw-sx],srcY=[0,sy,ih-sy];
      const srcW=[sx,iw-2*sx,sx],srcH=[sy,ih-2*sy,sy];
      const dstX=[d.x,d.x+dx,d.x+d.w-dx],dstY=[d.y,d.y+dy,d.y+d.h-dy];
      const dstW=[dx,d.w-2*dx,dx],dstH=[dy,d.h-2*dy,dy];
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)
        ctx.drawImage(paper,srcX[col],srcY[row],srcW[col],srcH[row],
          dstX[col],dstY[row],dstW[col],dstH[row]);
      ctx.restore();
    }else paint(ctx,d.x,d.y,d.w,d.h,"rgba(243,228,200,.98)",9);
    const ink="#362016",muted="#45271d";
    if(!c){write(ctx,"目前沒有可選技能",450,d.y+d.h/2,300,22,"center",ink);return;}
    const tag=image("assets/img/ui/phase42/title_plaque.webp");
    if(tag){
      ctx.drawImage(tag,d.x+23,d.y+7,132,27);
      ctx.drawImage(tag,d.x+276,d.y+7,136,27);
      write(ctx,"選定技能",d.x+89,d.y+21,110,15,"center",palette.light);
      write(ctx,"術式效果",d.x+344,d.y+21,114,15,"center",palette.light);
    } else {
      write(ctx,"選定技能",d.x+26,d.y+24,205,14,"left",muted);
      write(ctx,"術式效果",d.x+259,d.y+24,d.w-285,14,"left",muted);
    }
    write(ctx,c.n||"",d.x+27,d.y+60,221,25,"left",ink);
    // Dark ink rather than background-colored pale brown; never let the
    // dynamic level transition vanish into the lower parchment floral art.
    write(ctx,c.levelText||(c.lv?"Lv."+c.lv:""),d.x+27,d.y+88,220,18,"left",muted);
    ctx.strokeStyle="rgba(119,75,46,.40)";ctx.lineWidth=1.1;
    ctx.beginPath();ctx.moveTo(d.x+260,d.y+14);ctx.lineTo(d.x+260,d.y+d.h-14);ctx.stroke();
    const brief=UI.cardShort?.(c.id,c.n);
    const desc=brief?.s||c.d||"技能效果";
    const x=d.x+280,w=d.w-310;
    const bodySize=Math.min(19,Math.max(17,Math.ceil(12/Math.max(.55,L.scale))));
    paragraph(ctx,desc,x,d.y+55,w,c.requirementText||c.limitText?1:2,bodySize,
      ink,19);
    const note=[c.requirementText,c.limitText].filter(Boolean).join(" · ");
    if(note)paragraph(ctx,note,x,d.y+89,w,1,13,muted,17);
  }
  function drawReroll(ctx,L,amount,mode){
    const r=L.reroll;
    const bg=image(amount>0?"assets/img/ui/upgrade/approved_reroll.webp":"")||
      image("assets/img/ui/upgrade/reroll_"+(amount>0?"normal":"disabled")+".webp");
    if(bg){
      const side=Math.round(bg.naturalWidth*.18);
      const dest=Math.min(r.w*.25,side*r.h/bg.naturalHeight);
      ctx.drawImage(bg,0,0,side,bg.naturalHeight,r.x,r.y,dest,r.h);
      ctx.drawImage(bg,side,0,bg.naturalWidth-2*side,bg.naturalHeight,
        r.x+dest,r.y,r.w-2*dest,r.h);
      ctx.drawImage(bg,bg.naturalWidth-side,0,side,bg.naturalHeight,
        r.x+r.w-dest,r.y,dest,r.h);
    }else{
      paint(ctx,r.x,r.y,r.w,r.h,amount>0?"#863a34":"#47434c",12);
      ctx.strokeStyle=palette.gold;ctx.lineWidth=2;round(ctx,r.x,r.y,r.w,r.h,12);ctx.stroke();
    }
    write(ctx,"重抽（"+amount+"）",r.x+r.w/2,r.y+r.h/2,r.w-20,22,
      "center",amount?palette.light:"#aaa0a0");
    const hint=mode==="gamepad"?"← → 選卡 · A 確認 · Y 重抽":
      mode==="touch"?"輕觸預覽・再點選取":"← → 選卡 · Enter 確認 · R 重抽";
    write(ctx,hint,851,566,283,L.scale<.8?17:15,"right",palette.dim);
  }

  // Browser/game now loads approved raster paths directly. No ZIP picker,
  // font dropdown or calibration badge is needed in normal play.
  if(typeof document!=="undefined" && document.fonts?.load) {
    const selectedFont=trialWebFonts[fontMode];
    if(selectedFont)void document.fonts.load(`400 24px "${selectedFont}"`,'能力提升 選卡 靈針 長明燈油').catch(()=>{});
  }
  image(framePath);

  UI.drawLevelUp=(ctx,level,choices,WL,WI,rerolls=0,time=0,focus=0,mode="keyboard",awakening=null)=>{
    const L=UI.levelUpLayout(choices.length),i=Math.max(0,Math.min(choices.length-1,focus));
    ctx.save();
    backdrop(ctx,L,awakening);
    L.cards.forEach((r,k)=>drawChoice(ctx,choices[k],r,k===i,k+1,time));
    drawDetails(ctx,L,choices[i]||null);
    if(choices.length===1 && choices[0]?.type==="coins"){
      write(ctx,"金幣可留存至下次夜行",450,541,420,19,"center",palette.light);
    } else drawReroll(ctx,L,rerolls,mode);
    ctx.restore();
  };
})();
