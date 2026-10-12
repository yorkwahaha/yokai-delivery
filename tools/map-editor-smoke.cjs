// Browser-driven local editor smoke; restores js/overworld-layout.js after test.
const fs=require("fs"),path=require("path"),os=require("os"),cp=require("child_process");
const base=path.resolve(__dirname,".."),config=path.join(base,"js/overworld-layout.js"),port=8767,sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP {
 constructor(ws){this.ws=ws;this.id=1;this.pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data),p=this.pending.get(v.id);if(p){this.pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}};}
 send(method,params={}){const id=this.id++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
}
async function wait(fn){for(let i=0;i<100;i++){const value=await fn();if(value)return value;await sleep(110);}throw Error("timeout");}
async function run(){
 const original=fs.readFileSync(config),server=cp.spawn(process.execPath,["tools/map-editor-server.cjs"],{cwd:base,env:{...process.env,MAP_EDITOR_PORT:String(port)},stdio:"ignore",windowsHide:true});
 let chrome,ws,dir;
 try{
  await wait(async()=>{try{return (await fetch("http://127.0.0.1:"+port+"/api/layout")).ok;}catch{return false;}});
  const cfg=await(await fetch("http://127.0.0.1:"+port+"/api/layout")).json();
  const bad=await fetch("http://127.0.0.1:"+port+"/api/layout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...cfg,nodes:{}})});
  if(bad.status!==400)throw Error("invalid layout accepted");
  dir=fs.mkdtempSync(path.join(os.tmpdir(),"map-cdp-"));
  chrome=cp.spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",["--headless=new","--disable-gpu","--disable-extensions","--no-first-run","--remote-allow-origins=*","--remote-debugging-port=0","--user-data-dir="+dir,"about:blank"],{stdio:"ignore",windowsHide:true});
  const f=path.join(dir,"DevToolsActivePort"),cport=await wait(()=>fs.existsSync(f)?+fs.readFileSync(f,"utf8").split("\n")[0]:null);
  const tabs=await(await fetch("http://127.0.0.1:"+cport+"/json/list")).json();
  ws=new WebSocket(tabs.find(t=>t.type==="page").webSocketDebuggerUrl);
  await new Promise((yes,no)=>{ws.onopen=yes;ws.onerror=no;});
  const c=new CDP(ws);await c.send("Page.enable");await c.send("Runtime.enable");
  await c.send("Emulation.setDeviceMetricsOverride",{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await c.send("Page.navigate",{url:"http://127.0.0.1:"+port+"/editor/overworld.html"});
  await c.send("Page.bringToFront");
  await c.send("Emulation.setFocusEmulationEnabled",{enabled:true});
  await wait(async()=>{try{return (await c.eval("document.querySelectorAll('#stages button').length===17 && document.getElementById('status').textContent.includes('已載入')"))?true:null;}catch{return null;}});
  const point=await c.eval("(()=>{const b=document.getElementById('canvasWrap').getBoundingClientRect();const z=Math.min((b.width-45)/3000,(b.height-45)/2200);return {x:b.left+(b.width-3000*z)/2+390*z,y:b.top+(b.height-2200*z)/2+1180*z,z};})()");
  console.log("POINTER",JSON.stringify(point),"element",await c.eval("document.elementFromPoint("+point.x+","+point.y+").id"));
  await c.eval("(()=>{const m=document.getElementById('map');m.addEventListener('pointerdown',e=>document.body.dataset.pd=e.clientX+','+e.clientY);m.addEventListener('pointermove',e=>document.body.dataset.pm=e.clientX+','+e.clientY);m.addEventListener('pointerup',e=>document.body.dataset.pu=e.clientX+','+e.clientY);})()");
  const drag=async(dx,dy)=>{
    const x=point.x,y=point.y;
    const code="(()=>{const m=document.getElementById(\'map\');m.setPointerCapture=()=>{};for(const v of [[\'pointerdown\',"+x+","+y+"],[\'pointermove\',"+(x+dx)+","+(y+dy)+"],[\'pointerup\',"+(x+dx)+","+(y+dy)+"]])m.dispatchEvent(new PointerEvent(v[0],{bubbles:true,pointerId:1,pointerType:\'mouse\',isPrimary:true,button:0,buttons:v[0]===\'pointerup\'?0:1,clientX:v[1],clientY:v[2]}));})()";
    await c.eval(code);
  };
  console.log("FOCUS",await c.eval("document.hasFocus()"));
  await drag(25,0);
  console.log("POST-DRAG",await c.eval("({status:document.getElementById('status').textContent,point:document.getElementById('pointX').value,events:document.body.dataset})"));
  const route=Number(await c.eval("document.getElementById('pointX').value"));
  if(route<440)throw Error("route did not move: "+route);
  await c.eval("document.querySelector('[data-tool=art]').click()");
  await drag(-25,14);
  const art=Number(await c.eval("document.getElementById('pointX').value"));
  if(art>350)throw Error("art did not move: "+art);
  await c.eval("(()=>{const el=document.getElementById('bgScale');el.value='82';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await c.eval("document.getElementById('apply').click()");
  await wait(async()=>{const x=await c.eval("document.getElementById('status').textContent");return x.includes("已寫入")?x:null;});
  delete require.cache[require.resolve(config)];const layout=require(config);
  console.log("DRAG AND SAVE "+JSON.stringify({route:layout.nodes["night-town"].route,art:layout.nodes["night-town"].art,bg:layout.background}));
  if(layout.background.width!==2460||layout.nodes["night-town"].route.x<440||layout.nodes["night-town"].art.x>350)throw Error("save did not reach game config");
  const shot=await c.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  const target=path.join(base,"artifacts/validation/map-editor-visual-smoke.png");fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(shot.data,"base64"));
  console.log("PASS actual Chrome drag/save/game config; screenshot="+fs.statSync(target).size+" bytes");
 } finally {
  fs.writeFileSync(config,original);
  try{ws?.close();}catch{}chrome?.kill();server.kill();
  await sleep(350);try{if(dir)fs.rmSync(dir,{recursive:true,force:true});}catch{}
 }
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
