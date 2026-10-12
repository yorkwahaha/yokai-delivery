const test = require("node:test");
const assert = require("node:assert/strict");
const OW = require("../js/overworld.js");

test("journey board uses dark engraved ink on pale paper and shared Japanese headings",()=>{
  const texts=[], strokes=[], gradients=[],buttons=[];
  const grad={addColorStop:(at,color)=>gradients.push([at,color])};
  const ctx = new Proxy({
    fillText:(text,x,y,maxWidth)=>texts.push({text:String(text),x,y,color:ctx.fillStyle,font:ctx.font,maxWidth}),
    strokeText:(text,x,y)=>strokes.push({text:String(text),outline:ctx.strokeStyle,width:ctx.lineWidth}),
    createLinearGradient:()=>grad,createRadialGradient:()=>grad
  },{get:(target,key)=>key in target?target[key]:(()=>{})});
  global.STORE={isStageCompleted:()=>true,isStageUnlocked:()=>true,getStageStats:()=>({bestScore:52745})};
  global.CONTENT={getStage:id=>({id,implemented:true})};
  global.UI={
    drawWashiBoard:()=>{},drawWoodTag:()=>{},
    drawButton:(ctx,b,label,options)=>buttons.push({label,options}),
    readableFont:(size,weight)=>weight+" "+size+"px 'Noto Sans JP', sans-serif"
  };
  try {
    OW.draw(ctx,OW.createState("night-town"),0);
    const title=texts.find(x=>x.text.includes("1/8")&&x.text.includes("夜行町"));
    const best=texts.find(x=>x.text==="最高 52,745 點");
    const action=texts.find(x=>x.text==="配達開始　Enter / A");
    const label=texts.find(x=>x.text==="夜行町");
    assert.ok(title&&best&&action&&label,"all dynamic text remains editable Canvas text");
    assert.equal(title.color,"#39261d");
    assert.equal(best.color,"#53382a");
    assert.equal(action.color,"#53382a");
    assert.equal(label.color,"#39261d");
    assert.match(title.font,/Kaisei Decol/);
    assert.match(best.font,/Noto Sans JP/);
    assert.ok(strokes.some(x=>x.text==="最高 52,745 點"&&x.outline.includes("255,248,228")));
    assert.ok(gradients.some(x=>String(x[1]).includes("255,249,229,.72")),"paper center is lightly brightened");
    assert.deepEqual(buttons.map(x=>x.label),["← 首頁","◀","▶","出發"]);
    assert.equal(buttons[0].options.mapTypography,"title","home uses Kaisei Decol like the placards");
    assert.deepEqual(buttons.slice(1,3).map(x=>x.options.mapTypography),["body","body"]);
    assert.ok(buttons.slice(1,3).every(x=>x.options.visualOffsetY===-4),"arrows rise within unchanged hitboxes");
    assert.equal(buttons[3].options.mapTypography,true,"launch button retains map lettering");
    const wood=OW.NODES.find(n=>n.id==="night-town").labelPlacement;
    const kana=texts.find(x=>x.text==="よるのはいそう");
    assert.equal(label.y,wood.y+17,"place name rises two pixels");
    assert.equal(kana.y,wood.y+32,"kana sits tighter without touching the lower edge");
    assert.match(label.font,/15px/,"place name is reduced by one pixel");
    assert.equal(texts.find(x=>x.text==="妖怪快遞社・旅路圖").y,28);
    assert.equal(texts.find(x=>x.text==="道をたどって、次の配達先へ").y,50);
  }finally {
    for(const x of ["STORE","CONTENT","UI"])delete global[x];
  }
});
test("map bottom instruction rises four pixels without moving its wood board",()=>{
  const coords=[],boards=[],g={addColorStop(){}};
  const ctx=new Proxy({
    fillText:(text,x,y)=>coords.push({text,y}),
    createLinearGradient:()=>g,createRadialGradient:()=>g
  },{get:(obj,key)=>key in obj?obj[key]:(()=>{})});
  global.UI={drawWoodTag:(_ctx,plate)=>boards.push(plate),drawButton:()=>{}};
  try{
    OW.draw(ctx,OW.createState("gate"),0);
    assert.equal(coords.find(x=>x.text.startsWith("方向鍵移動")).y,564);
    assert.ok(boards.some(p=>p.y===546&&p.h===34));
  }finally{delete global.UI;}
});
test("locked chapter still uses legible dark text and never becomes playable",()=>{
  const fills=[];
  const grad={addColorStop(){}};
  const ctx=new Proxy({
    fillText:(label)=>fills.push({label,color:ctx.fillStyle}),
    createLinearGradient:()=>grad,createRadialGradient:()=>grad
  },{get:(o,k)=>k in o?o[k]:(()=>{})});
  global.STORE={isStageUnlocked:()=>true,isStageCompleted:()=>false};
  global.CONTENT={getStage:id=>({id,implemented:false})};
  global.UI={drawWashiBoard:()=>{},drawWoodTag:()=>{},drawButton:()=>{}};
  try{
    OW.draw(ctx,OW.createState("sakura-pass"),0);
    assert.equal(OW.isEnterable(OW.STAGE_NODES[2]),false);
    assert.ok(fills.some(x=>x.label==="封印中・後續開放"&&x.color==="#53382a"));
  }finally{for(const x of ["STORE","CONTENT","UI"])delete global[x];}
});
