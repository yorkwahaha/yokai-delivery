#!/usr/bin/env node
// Yokai Delivery local-only visual map editor. No npm packages, no remote binding, no deployment.
"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,".."),LAYOUT=path.join(ROOT,"js","overworld-layout.js");
const PORT=Number(process.env.MAP_EDITOR_PORT||8766);
const IDS=["gate","night-town","cross-west","rain-port","port-rise","sakura-pass","cross-east","bamboo-maze","bamboo-exit","hyakki-kyoto","lookout","snow-temple","snow-pass","spirit-ferry","yomi-ford","yomi-ascent","yomi"];
const STAGES=new Set(["night-town","rain-port","sakura-pass","bamboo-maze","hyakki-kyoto","snow-temple","spirit-ferry","yomi"]);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg",".css":"text/css",".json":"application/json"};
function current(){
  delete require.cache[require.resolve(LAYOUT)];
  return require(LAYOUT);
}
function goodNum(x,lo,hi){return typeof x==="number"&&Number.isFinite(x)&&x>=lo&&x<=hi}
function validate(data){
  if(!data||data.version!==1||!data.background||!data.nodes||Array.isArray(data.nodes))throw Error("設定版本錯誤");
  const b=data.background;
  if(!goodNum(b.x,-2500,2500)||!goodNum(b.y,-2500,2500)||!goodNum(b.width,850,4500))throw Error("背景縮放或位置不合法");
  if(Object.keys(data.nodes).length!==IDS.length||Object.keys(data.nodes).some(id=>!IDS.includes(id)))throw Error("必須包含原本的17個節點，不能新增或刪除");
  const result={version:1,background:{x:b.x,y:b.y,width:b.width},nodes:{}};
  for(const id of IDS){
    const n=data.nodes[id],r=n?.route;
    if(!goodNum(r?.x,-450,3450)||!goodNum(r?.y,-400,2600))throw Error(id+"：道路節點範圍不合法");
    const out={route:{x:r.x,y:r.y}};
    if(STAGES.has(id)){
      const a=n.art,l=n.label;
      if(!goodNum(a?.x,-450,3450)||!goodNum(a?.y,-400,2600)||!goodNum(a?.scale,.25,2.5))throw Error(id+"：關卡地標位置或比例不合法");
      if(!goodNum(l?.x,-450,3450)||!goodNum(l?.y,-400,2600)||!goodNum(l?.width,100,330))throw Error(id+"：名稱木牌位置或寬度不合法");
      out.art={x:a.x,y:a.y,scale:a.scale};
      out.label={x:l.x,y:l.y,width:l.width};
    }
    result.nodes[id]=out;
  }
  return result;
}
function serialize(data){
  return "// Yokai Delivery 旅路地圖座標；請從本機可視化編輯器調整。\n"+
    "(function(root){\n  'use strict';\n  const layout = "+
    JSON.stringify(data,null,2).replace(/\n/g,"\n  ")+";\n"+
    "  root.OVERWORLD_LAYOUT = layout;\n"+
    "  if (typeof module !== 'undefined' && module.exports) module.exports = layout;\n"+
    "})(typeof window !== 'undefined' ? window : globalThis);\n";
}
function reply(res,code,value){res.writeHead(code,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}).end(JSON.stringify(value));}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://127.0.0.1:"+PORT);
  if(url.pathname==="/api/layout"){
    if(req.method==="GET"){try{return reply(res,200,current());}catch(e){return reply(res,500,{error:e.message});}}
    if(req.method!=="POST")return reply(res,405,{error:"method not allowed"});
    const origin=req.headers.origin;
    if(origin && origin!=="http://127.0.0.1:"+PORT)return reply(res,403,{error:"只允許本機編輯器儲存"});
    if(req.headers["content-type"]?.split(";")[0]!=="application/json")return reply(res,415,{error:"必須傳送 JSON"});
    let buf="",tooLarge=false;
    req.on("data",chunk=>{buf+=chunk;if(buf.length>75000){tooLarge=true;req.destroy();}});
    req.on("end",()=>{
      if(tooLarge)return;
      try {
        const data=validate(JSON.parse(buf));const output=serialize(data),temp=LAYOUT+".tmp";
        fs.writeFileSync(temp,output,{encoding:"utf8"});fs.renameSync(temp,LAYOUT);
        reply(res,200,{ok:true,path:"js/overworld-layout.js",message:"已套用。重新整理遊戲頁即可看到調整結果。"});
      }catch(e){reply(res,400,{error:e.message});}
    });return;
  }
  if(req.method!=="GET"&&req.method!=="HEAD")return reply(res,405,{error:"method not allowed"});
  let name;
  try {name=decodeURIComponent(url.pathname); }catch{return reply(res,400,{error:"invalid path"});}
  if(name==="/")name="/editor/overworld.html";
  const file=path.resolve(ROOT,"."+name);
  if(!file.startsWith(ROOT+path.sep))return reply(res,403,{error:"forbidden"});
  fs.readFile(file,(err,bytes)=>{
    if(err)return reply(res,404,{error:"not found"});
    res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"});
    if(req.method==="HEAD")res.end();else res.end(bytes);
  });
});
server.listen(PORT,"127.0.0.1",()=>{
  const url="http://127.0.0.1:"+PORT+"/editor/overworld.html";
  console.log("\n妖怪快遞社・旅路編輯器\n"+url+"\n拖曳後點『套用至本機遊戲』，會更新 js/overworld-layout.js（不會提交或部署）。\n按 Ctrl+C 結束。\n");
  if(process.argv.includes("--open")&&process.platform==="win32"){
    const proc=cp.spawn("cmd.exe",["/c","start","",url],{stdio:"ignore",detached:true,windowsHide:true});proc.unref();
  }
});
