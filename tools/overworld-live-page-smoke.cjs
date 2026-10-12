// Full-page integration smoke: actual index.html + real Chrome mobile viewport.
// No external dependencies; starts temporary localhost static server; does not deploy.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.json':'application/json'};
class CDP {
 constructor(ws){this.ws=ws;this.id=1;this.pending=new Map();ws.onmessage=e=>{const v=JSON.parse(e.data);const p=this.pending.get(v.id);if(p){this.pending.delete(v.id);v.error?p.reject(new Error(JSON.stringify(v.error))):p.resolve(v.result);}};}
 send(method,params={}){const id=this.id++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
}
async function main(){
 const server=http.createServer((req,res)=>{
  const safe=decodeURIComponent((req.url||'/').split('?')[0]),name=path.resolve(root,'.'+(safe==='/'?'/index.html':safe));
  if(!name.startsWith(root+path.sep) && name!==path.join(root,'index.html')){res.writeHead(403).end();return;}
  fs.readFile(name,(err,bytes)=>{if(err){res.writeHead(404).end('not found');return;}res.writeHead(200,{'content-type':mime[path.extname(name)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);});
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const port=server.address().port,dir=fs.mkdtempSync(path.join(os.tmpdir(),'yokai-live-cdp-'));
 const child=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
  let chromePort;for(let n=0;n<100;n++){const file=path.join(dir,'DevToolsActivePort');if(fs.existsSync(file)){chromePort=+fs.readFileSync(file,'utf8').split('\n')[0];break;}await sleep(100);}
  if(!chromePort)throw Error('Chrome DevTools not started');
  const pages=await(await fetch('http://127.0.0.1:'+chromePort+'/json/list')).json(),page=pages.find(p=>p.type==='page');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
  const c=new CDP(ws);
  await c.send('Page.enable');await c.send('Runtime.enable');
  const width=Number(process.env.MAP_SMOKE_WIDTH)||390,height=Number(process.env.MAP_SMOKE_HEIGHT)||844;
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<height});
  await c.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html'});
  let state={};for(let n=0;n<140;n++){await sleep(140);
   try{state=await c.eval('({screen:document.body?.dataset?.gameScreen||"",rotate:document.querySelector("#rotate-hint")?getComputedStyle(document.querySelector("#rotate-hint")).display:"missing",mapLoaded:!!window.ART?.overworld_approved_v2,mapPixels:[window.ART?.overworld_approved_v2?.naturalWidth||0,window.ART?.overworld_approved_v2?.naturalHeight||0],loaded:!!window.MAP_ART_READY})');}catch{}
   if(state.screen==='menu'&&state.rotate==='none')break;
  }
  console.log('PORTRAIT INITIAL '+JSON.stringify(state));
  if(state.screen!=='menu'||state.rotate!=='none')throw Error('main menu blocks portrait map access');
  // Start key presses travel from the real menu to the real overworld through the existing game.js.
  await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  for(let n=0;n<145;n++){await sleep(140);
   state=await c.eval('({screen:document.body?.dataset?.gameScreen||"",rotate:document.querySelector("#rotate-hint")?getComputedStyle(document.querySelector("#rotate-hint")).display:"missing",mapLoaded:!!window.ART?.overworld_approved_v2,mapPixels:[window.ART?.overworld_approved_v2?.naturalWidth||0,window.ART?.overworld_approved_v2?.naturalHeight||0],loaded:!!window.MAP_ART_READY})');
   if(state.screen==='map'&&state.loaded)break;
  }
  console.log('PORTRAIT OVERWORLD '+JSON.stringify(state));
  if(state.screen!=='map'||state.rotate!=='none'||!state.mapLoaded||!state.loaded||state.mapPixels[0]<3800||Math.abs(state.mapPixels[0]/state.mapPixels[1]-16/9)>.02)throw Error('actual index.html failed to load 4K overworld background');
  await sleep(1300); // Let the map transition fade end before the visual proof.
  if(process.env.MAP_SMOKE_SELECT_FIRST==='1'){
    // Exercise actual clickable ◀/▶ button so the dynamic info board is visible in the screenshot.
    const pt=await c.eval(`(()=>{const b=OVERWORLD.browseButtons().find(b=>b.id==="next"),v=VIEWPORT.get();return {x:(b.x+b.w/2+v.offsetX)*innerWidth/v.width,y:(b.y+b.h/2+v.offsetY)*innerHeight/v.height}})()`);
    await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pt.x,y:pt.y});
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:pt.x,y:pt.y,button:'left',clickCount:1});
    await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pt.x,y:pt.y,button:'left',clickCount:1});
    await sleep(1350);
  }
  const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const out=path.join(root,process.env.MAP_SMOKE_OUTPUT||'artifacts/validation/eight-stage-a5/real-app-phone-portrait.png');
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.from(shot.data,'base64'));
  console.log('PASS actual game index.html portrait menu→map; image loaded; orientation overlay hidden; screenshot '+fs.statSync(out).size+' bytes');
 } finally{
  try{ws?.close();}catch{}
  child.kill();server.close();await sleep(450);try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
 }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
