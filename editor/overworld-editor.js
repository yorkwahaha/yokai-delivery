"use strict";
(() => {
  const $=id=>document.getElementById(id), canvas=$("map"),wrap=$("canvasWrap"),ctx=canvas.getContext("2d");
  const OW=window.OVERWORLD, MAP_W=OW.MAP_W,MAP_H=OW.MAP_H;
  const source=window.OVERWORLD_LAYOUT, original=structuredClone(source);
  let draft=structuredClone(source),history=[],future=[],tool="route",selected="night-town",space=false;
  let zoom=.4,panX=0,panY=0,drag=null,resizeObserver;
  let dirty=true,dpr=1;
  const storageKey="yokai-delivery-overworld-editor-draft-v1";
  const nodes=OW.NODES,edges=OW.EDGES, byId=new Map(nodes.map(n=>[n.id,n]));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const rounded=n=>Math.round(n*10)/10;
  const stage=id=>byId.get(id)?.type==="stage";
  const name=id=>byId.get(id)?.label||id;
  function record(){history.push(structuredClone(draft));if(history.length>80)history.shift();future=[];}
  function notify(message,error=false){$("status").textContent=message;$("status").classList.toggle("error",error);}
  function updated(msg="已調整，尚未套用至遊戲"){
    localStorage.setItem(storageKey,JSON.stringify(draft));notify(msg);dirty=true;sync();
  }
  function point(id,kind){
    const n=draft.nodes[id];return n?.[kind==="route"?"route":kind]||null;
  }
  function sync(){
    const n=point(selected,tool),a=draft.nodes[selected]?.art,l=draft.nodes[selected]?.label;
    $("selectedName").textContent=name(selected);
    $("which").textContent=name(selected)+"・"+({route:"道路位置",art:"地標位置",label:"木牌位置",background:"背景",pan:"畫面平移"}[tool]);
    $("bgSize").textContent=Math.round(draft.background.width/MAP_W*100)+"%（"+Math.round(draft.background.width)+"px）";
    $("bgScale").value=Math.round(draft.background.width/MAP_W*100);
    $("bgX").value=Math.round(draft.background.x);$("bgY").value=Math.round(draft.background.y);
    $("pointX").value=n?Math.round(n.x):"";$("pointY").value=n?Math.round(n.y):"";
    const value=tool==="art"?Math.round((a?.scale||1)*100):tool==="label"?l?.width||208:null;
    $("size").disabled=value===null;
    $("size").min=tool==="label"?100:25;
    $("size").max=tool==="label"?330:250;
    $("size").value=value??100;
    $("sizeValue").textContent=tool==="art"?value+"%":tool==="label"?value+" px":"—";
    for(const inp of ["pointX","pointY"])$(inp).disabled=!n;
    for(const b of document.querySelectorAll(".tool"))b.classList.toggle("active",b.dataset.tool===tool);
    for(const b of $("stages").querySelectorAll("button"))b.classList.toggle("active",b.dataset.id===selected);
    wrap.className="canvas-wrap "+tool+(drag?" dragging":"");
    $("zoom").textContent=Math.round(zoom*100)+"%";
    $("undo").disabled=history.length===0;$("redo").disabled=future.length===0;
  }
  function select(id){
    if(!draft.nodes[id])return;
    selected=id;
    if(!stage(id)&&(tool==="art"||tool==="label"))tool="route";
    sync();dirty=true;
  }
  function chooseTool(mode){
    if(!stage(selected)&&(mode==="art"||mode==="label"))selected="night-town";
    tool=mode;sync();dirty=true;
  }
  function fit(){
    const r=wrap.getBoundingClientRect();
    zoom=clamp(Math.min((r.width-45)/MAP_W,(r.height-45)/MAP_H),.09,2.3);
    panX=(r.width-MAP_W*zoom)/2;panY=(r.height-MAP_H*zoom)/2;sync();dirty=true;
  }
  function toWorld(e){
    const b=wrap.getBoundingClientRect();
    return {x:(e.clientX-b.left-panX)/zoom,y:(e.clientY-b.top-panY)/zoom};
  }
  function screenXY(x,y){return {x:x*zoom+panX,y:y*zoom+panY};}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function hit(p){
    const distLimit=24/zoom;
    if(tool==="label"){
      const list=[...nodes].reverse().filter(n=>n.type==="stage");
      return list.find(n=>{
        const l=draft.nodes[n.id].label;
        return Math.abs(p.x-l.x)<=l.width/2 && p.y>=l.y && p.y<=l.y+46;
      })?.id||null;
    }
    const list=nodes.filter(n=>tool==="route"||n.type==="stage");
    let closest=null,best=distLimit;
    for(const n of list){
      const q=point(n.id,tool);
      if(!q)continue;
      const distance=dist(p,q);
      if(distance<best){closest=n.id;best=distance;}
    }
    return closest;
  }
  const bgImg=new Image();
  bgImg.onload=()=>{dirty=true;notify("背景與 17 個座標已載入。請選擇元件拖曳。");};
  bgImg.onerror=()=>notify("背景圖載入失敗，請從本機啟動器開啟編輯器",true);
  bgImg.src="../assets/img/overworld_approved_v2.webp";
  const images={};
  for(const id of ["map_night_town_v1","map_rain_port_v1","prop_sakura","prop_torii"]){
    const im=new Image();
    im.src="../assets/img/"+id+".webp";
    im.onload=()=>{images[id]=im;dirty=true;};
  }
  function box(x,y,w,h,r,fill,stroke="#a78058"){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
  }
  function bgDraw(){
    const bg=draft.background,aspect=(bgImg.naturalHeight||941)/(bgImg.naturalWidth||1672);
    const height=bg.width*aspect,edge=bg.y+height;
    ctx.fillStyle="#c5bbb2";ctx.fillRect(0,0,MAP_W,MAP_H);
    if(bgImg.complete&&bgImg.naturalWidth){
      ctx.drawImage(bgImg,bg.x,bg.y,bg.width,height);
      if(edge<MAP_H){
        ctx.save();ctx.translate(bg.x,edge);ctx.scale(1,-1);
        ctx.drawImage(bgImg,0,bgImg.naturalHeight-240,bgImg.naturalWidth,240,0,-(MAP_H-edge),bg.width,MAP_H-edge);
        ctx.restore();
        const grad=ctx.createLinearGradient(0,edge,0,MAP_H);
        grad.addColorStop(0,"rgba(218,218,206,0.03)");grad.addColorStop(1,"rgba(212,218,218,.72)");
        ctx.fillStyle=grad;ctx.fillRect(bg.x,edge,bg.width,MAP_H-edge);
      }
    }
    ctx.strokeStyle="#e1bb7e";ctx.lineWidth=5;ctx.strokeRect(0,0,MAP_W,MAP_H);
  }
  function icon(n){
    const a=draft.nodes[n.id].art,sel=selected===n.id&&tool==="art";
    const key=n.landmark==="town"?"map_night_town_v1":n.landmark==="port"?"map_rain_port_v1":n.landmark==="sakura"?"prop_sakura":n.landmark==="kyoto"?"prop_torii":null;
    ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.scale,a.scale);
    ctx.fillStyle="rgba(30,23,29,.36)";ctx.beginPath();ctx.ellipse(0,18,52,15,0,0,Math.PI*2);ctx.fill();
    if(images[key]?.naturalWidth){
      const im=images[key];
      if(key?.startsWith("map_"))ctx.drawImage(im,0,0,im.naturalWidth/2,im.naturalHeight,-50,-55,100,96);
      else ctx.drawImage(im,-40,-65,80,84);
    }else{
      ctx.fillStyle=n.landmark==="snow"?"#e7e8df":n.landmark==="yomi"?"#b4395e":"#6f5445";
      box(-31,-29,62,55,8,ctx.fillStyle,"#f2d1a1");
      ctx.fillStyle="#f5d9aa";ctx.font="bold 24px serif";ctx.textAlign="center";
      ctx.fillText(({bamboo:"竹",snow:"雪",ferry:"渡",yomi:"黄"})[n.landmark]||"社",0,8);
    }
    if(sel){
      ctx.setLineDash([8,6]);ctx.strokeStyle="#7ce6fc";ctx.lineWidth=4;
      ctx.strokeRect(-58,-70,116,122);ctx.setLineDash([]);
    }
    ctx.restore();
    if(sel)handle(a.x,a.y,"#6dd9ef",17,"◆");
  }
  function handle(x,y,color,r,text=""){
    ctx.save();ctx.shadowColor="#16111c";ctx.shadowBlur=4;
    ctx.beginPath();ctx.arc(x,y,r/zoom,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();ctx.strokeStyle="#30251d";ctx.lineWidth=2/zoom;ctx.stroke();
    if(text){ctx.font="bold "+Math.max(8/zoom,12)+"px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#182129";ctx.fillText(text,x,y);}
    ctx.restore();
  }
  function draw(){
    dirty=false;
    const b=wrap.getBoundingClientRect();
    const width=Math.max(2,Math.round(b.width*dpr)),height=Math.max(2,Math.round(b.height*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="#161616";ctx.fillRect(0,0,b.width,b.height);
    ctx.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*panX,dpr*panY);
    bgDraw();
    if($("showRoad").checked){
      for(const [from,to] of edges){
        const a=point(from,"route"),b=point(to,"route");
        ctx.strokeStyle="rgba(30,25,28,.75)";ctx.lineWidth=9;
        ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        ctx.strokeStyle="#fce2ae";ctx.lineWidth=4;ctx.setLineDash([11,10]);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
      }
    }
    for(const n of nodes){
      if(n.type!=="stage" && !$("showRoad").checked)continue;
      const r=point(n.id,"route");
      ctx.beginPath();ctx.arc(r.x,r.y,n.type==="stage"?20:11,0,Math.PI*2);
      ctx.fillStyle=n.type==="stage"?"rgba(241,214,162,.94)":"rgba(247,229,170,.8)";
      ctx.strokeStyle="#584436";ctx.lineWidth=4;ctx.fill();ctx.stroke();
      if(n.id===selected&&tool==="route")handle(r.x,r.y,"#f5d079",15);
    }
    if($("showArt").checked)for(const n of nodes.filter(x=>x.type==="stage"))icon(n);
    if($("showLabels").checked){
      for(const n of nodes.filter(x=>x.type==="stage")){
        const l=point(n.id,"label"),active=selected===n.id&&tool==="label";
        box(l.x-l.width/2,l.y,l.width,46,4,active?"#82572c":"rgba(68,49,36,.94)",active?"#f7bc5f":"#c39864");
        ctx.fillStyle="#f8e7c8";ctx.font="bold 16px sans-serif";ctx.textAlign="center";
        ctx.fillText(n.label,l.x,l.y+20);ctx.font="12px sans-serif";
        ctx.fillText(n.sub||"",l.x,l.y+38);
        if(active)handle(l.x,l.y,"#f1b873",12);
      }
    }
    const dev=$("device").value;
    if(dev!=="none"){
      const [dw,dh]=dev.split(",").map(Number),pos=point(selected,"route")||{x:MAP_W/2,y:MAP_H/2};
      const x=clamp(pos.x-dw/2,0,Math.max(0,MAP_W-dw)),y=clamp(pos.y-dh/2,0,Math.max(0,MAP_H-dh));
      ctx.save();ctx.strokeStyle="#85e7d3";ctx.lineWidth=4;ctx.setLineDash([19,8]);ctx.strokeRect(x,y,dw,dh);ctx.setLineDash([]);
      box(x,y,Math.min(305,dw),34,3,"rgba(11,48,43,.85)","#85e7d3");
      ctx.fillStyle="#f1fff5";ctx.font="bold 17px sans-serif";ctx.textAlign="left";ctx.fillText("裝置可視範圍 "+dw+"×"+dh,x+9,y+23);
      ctx.restore();
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="#fff1cb";ctx.font="12px sans-serif";ctx.textAlign="right";
    ctx.fillText("100% 背景＝3000 世界單位；滾輪只縮放編輯畫面",b.width-15,22);
  }
  function frame(){if(dirty)draw();requestAnimationFrame(frame);}
  new ResizeObserver(()=>{const newDpr=Math.min(2,devicePixelRatio||1);dpr=newDpr;dirty=true;}).observe(wrap);
  function dragStart(e){
    if(e.button!==0&&e.button!==1)return;
    const pan=e.button===1||space||tool==="pan";
    const wp=toWorld(e);
    if(!pan && tool!=="background"){
      const id=hit(wp);
      if(id)select(id);
      else if(!draft.nodes[selected])return;
      // Clicking empty space changes only the selection if no drag started.
    }
    if(!pan)record();
    drag={id:selected,kind:pan?"pan":tool,start:wp,offsetX:e.clientX,offsetY:e.clientY,
      panX,panY,original:structuredClone(draft),moved:false};
    wrap.setPointerCapture(e.pointerId);sync();e.preventDefault();
  }
  function dragMove(e){
    if(!drag)return;
    const deltaX=e.clientX-drag.offsetX,deltaY=e.clientY-drag.offsetY;
    if(Math.hypot(deltaX,deltaY)>2)drag.moved=true;
    if(drag.kind==="pan"){panX=drag.panX+deltaX;panY=drag.panY+deltaY;}
    else {
      const dx=deltaX/zoom,dy=deltaY/zoom;
      if(drag.kind==="background"){
        const b=draft.background,start=drag.original.background;
        b.x=rounded(start.x+dx);b.y=rounded(start.y+dy);
      }else {
        const target=point(drag.id,drag.kind),base=drag.original.nodes[drag.id][drag.kind];
        if(!target||!base)return;
        target.x=rounded(base.x+dx);target.y=rounded(base.y+dy);
      }
    }
    dirty=true;sync();
  }
  function dragEnd(){
    if(!drag)return;
    if(drag.moved&&drag.kind!=="pan")updated();
    else if(!drag.moved&&drag.kind!=="pan")history.pop();
    drag=null;sync();
  }
  canvas.addEventListener("pointerdown",dragStart);
  canvas.addEventListener("pointermove",dragMove);
  canvas.addEventListener("pointerup",dragEnd);canvas.addEventListener("pointercancel",dragEnd);
  canvas.addEventListener("lostpointercapture",dragEnd);
  canvas.addEventListener("wheel",e=>{
    e.preventDefault();
    const old=zoom,next=clamp(old*Math.exp(-e.deltaY*.0012),.07,3.5),rect=wrap.getBoundingClientRect();
    const x=e.clientX-rect.left,y=e.clientY-rect.top;
    panX=x-(x-panX)*next/old;panY=y-(y-panY)*next/old;
    zoom=next;dirty=true;sync();
  },{passive:false});
  window.addEventListener("keydown",e=>{
    if(e.code==="Space"&&!["INPUT","TEXTAREA"].includes(e.target.tagName)){space=true;e.preventDefault();}
    if((e.ctrlKey||e.metaKey)&&e.code==="KeyZ"){e.preventDefault();undo();}
    if((e.ctrlKey||e.metaKey)&&e.code==="KeyY"){e.preventDefault();redo();}
  });
  window.addEventListener("keyup",e=>{if(e.code==="Space")space=false;});
  window.addEventListener("blur",()=>space=false);
  function undo(){if(!history.length)return;future.push(structuredClone(draft));draft=history.pop();updated("已復原（尚未套用）");}
  function redo(){if(!future.length)return;history.push(structuredClone(draft));draft=future.pop();updated("已重做（尚未套用）");}
  $("undo").onclick=undo;$("redo").onclick=redo;
  document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>chooseTool(b.dataset.tool));
  $("fit").onclick=fit;
  $("bgScale").addEventListener("pointerdown",record);
  $("bgScale").addEventListener("input",e=>{draft.background.width=Math.round(MAP_W*Number(e.target.value)/100);updated();});
  for(const f of ["bgX","bgY"]){
    $(f).addEventListener("focus",record);
    $(f).addEventListener("change",e=>{const v=Number(e.target.value);if(Number.isFinite(v)){draft.background[f==="bgX"?"x":"y"]=v;updated();}});
  }
  for(const field of ["pointX","pointY"]){
    $(field).addEventListener("focus",record);
    $(field).addEventListener("change",e=>{
      const n=point(selected,tool),v=Number(e.target.value);
      if(n&&e.target.value!==""&&Number.isFinite(v)){n[field==="pointX"?"x":"y"]=v;updated();}
    });
  }
  $("size").addEventListener("pointerdown",record);
  $("size").addEventListener("input",e=>{
    const value=Number(e.target.value),n=draft.nodes[selected];
    if(tool==="art"&&n.art)n.art.scale=value/100;
    if(tool==="label"&&n.label)n.label.width=value;
    updated();
  });
  for(const id of ["device","showRoad","showArt","showLabels"])$(id).addEventListener("change",()=>{dirty=true;});
  $("export").onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="yokai-overworld-layout-backup.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);notify("JSON 備份已下載。");
  };
  $("import").onclick=()=>$("importFile").click();
  $("importFile").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const next=JSON.parse(await file.text());
      if(next.version!==1||!next.background||Object.keys(next.nodes||{}).length!==17)throw Error("版本或節點數不相符");
      record();draft=next;updated("已匯入 JSON。按「套用至本機遊戲」才會存回正式設定。");
    }catch(err){notify("匯入失敗："+err.message,true);}
    e.target.value="";
  };
  $("apply").onclick=async()=>{
    const button=$("apply");button.disabled=true;button.textContent="正在儲存…";
    try{
      const r=await fetch("/api/layout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(draft)});
      const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||"伺服器未能儲存");
      localStorage.removeItem(storageKey);
      notify("✔ 已寫入 "+result.path+"。重新整理遊戲頁即可生效；尚未 Commit 或部署。");
    }catch(err){notify("儲存失敗："+err.message,true);}
    finally{button.disabled=false;button.textContent="套用至本機遊戲";}
  };
  $("draft").onclick=()=>{
    try{
      const json=localStorage.getItem(storageKey);if(!json){notify("尚無瀏覽器暫存");return;}
      const d=JSON.parse(json);
      if(d.version!==1||Object.keys(d.nodes||{}).length!==17)throw Error("暫存版本不同");
      record();draft=d;updated("已恢復暫存，仍需點套用才會寫入正式遊戲。");
    }catch(err){notify("無法恢復暫存："+err.message,true);}
  };
  for(const n of nodes){
    const b=document.createElement("button");
    b.dataset.id=n.id;
    b.innerHTML="<b>"+n.label+"</b><span>"+(n.type==="stage"?"關卡":"路口")+"</span>";
    b.onclick=()=>select(n.id);
    $("stages").append(b);
  }
  (async()=>{
    try{
      const res=await fetch("/api/layout");
      if(res.ok){const cfg=await res.json();if(cfg.version===1)draft=cfg;}
    }catch{ /* static-file preview uses its matching script defaults */ }
    fit();sync();notify(localStorage.getItem(storageKey)?"設定已載入；另有瀏覽器暫存，可點左側『恢復上次瀏覽器暫存』":"地圖已載入，拖曳後按『套用至本機遊戲』。");
  })();
  requestAnimationFrame(frame);
})();