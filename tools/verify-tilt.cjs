// Canvas-only tilt A/B screenshots in a real local Chromium page. Never deploys.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const output=path.join(root,'artifacts','validation','hd25d-prototype');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
class CDP {
  constructor(ws){this.ws=ws;this.id=1;this.pending=new Map();this.errors=[];ws.onmessage=e=>{const a=JSON.parse(e.data);
    if(a.method==='Runtime.exceptionThrown'){this.errors.push(a.params?.exceptionDetails?.text||'JS runtime exception');return;}
    const p=this.pending.get(a.id);if(p){this.pending.delete(a.id);a.error?p.reject(Error(JSON.stringify(a.error))):p.resolve(a.result);}};}
  send(method,params={}){const id=this.id++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
}
async function key(c){
  await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
}
async function main(){
  if(!fs.existsSync(chrome))throw Error('Chrome unavailable');
  fs.mkdirSync(output,{recursive:true});
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent((req.url||'/').split('?')[0]),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403).end();return;}
    fs.readFile(file,(err,b)=>{if(err){res.writeHead(404).end();return;}
      res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(b);});
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yokai-tilt-cdp-'));
  const child=spawn(chrome,['--headless=new','--disable-extensions','--no-first-run','--no-default-browser-check',
    '--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],
    {stdio:'ignore',windowsHide:true});
  let ws;const results=[];
  try{
    let port;for(let i=0;i<110;i++){const f=path.join(dir,'DevToolsActivePort');if(fs.existsSync(f)){port=+fs.readFileSync(f,'utf8').split('\n')[0];break;}await sleep(100);}
    if(!port)throw Error('Chrome debugging port timeout');
    const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((ok,bad)=>{ws.onopen=ok;ws.onerror=bad;});
    const c=new CDP(ws);await c.send('Page.enable');await c.send('Runtime.enable');
    // Explicitly skip gameplay tutorial in automated screenshots, not in production.
    await c.send('Page.addScriptToEvaluateOnNewDocument',
      {source:"try{localStorage.setItem('yokai-tutorial-v1',JSON.stringify('skip'))}catch(e){}"});
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
    for(const [label,query,expectedTilt,expectedSpacing] of [['2d','?tilt=1',1,1],['k060','?tilt=0.60',0.6,1.2],['dense060','?tilt=0.60&spacing=1',0.6,1],['default060','',0.6,1.2]]){
      c.errors.length=0;
      await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html'+query});
      let state={};for(let i=0;i<130;i++){await sleep(140);
        state=await c.eval('({screen:document.body?.dataset?.gameScreen,loaded:!!window.ART?.player,tilt:window.VIEWPORT?.tiltScale?.()})');
        if(state.screen==='menu'&&state.loaded)break;
      }
      if(state.screen!=='menu')throw Error(label+' menu load failed: '+JSON.stringify(state));
      await key(c);
      for(let i=0;i<85;i++){await sleep(120);state=await c.eval('({screen:document.body?.dataset?.gameScreen})');if(state.screen==='map')break;}
      if(state.screen!=='map')throw Error(label+' map enter failed: '+JSON.stringify(state));
      await sleep(350);
      // Gate is a waypoint, not a playable stage. Walk one stop to night-town.
      await c.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
      await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
      await sleep(1250);await key(c);
      // Run screen uses uiScreen='other'; check render actually changes after map.
      for(let i=0;i<85;i++){await sleep(120);state=await c.eval('({screen:document.body?.dataset?.gameScreen})');if(state.screen==='other')break;}
      if(state.screen!=='other')throw Error(label+' game start failed: '+JSON.stringify(state));
      await sleep(900);
      const timing=await c.eval(`(async()=>{const deltas=[];let last=0;
        await new Promise(done=>{const tick=t=>{if(last)deltas.push(t-last);last=t;
          if(deltas.length>=96)done();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
        const sorted=deltas.slice().sort((a,b)=>a-b);
        return {frames:deltas.length,fps:+(1000/(deltas.reduce((a,b)=>a+b,0)/deltas.length)).toFixed(2),
          p95ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2)};})()`);
      const metrics=await c.eval('({tilt:VIEWPORT.tiltScale(),cam:RENDERER.getCam(),bounds:VIEWPORT.worldBounds(),canvas:[RENDERER.getCanvas().width,RENDERER.getCanvas().height],screen:document.body.dataset.gameScreen})');
      metrics.timing=timing;
      metrics.spacingY=await c.eval('VIEWPORT.spacingScaleY()');
      if(metrics.tilt!==expectedTilt||metrics.spacingY!==expectedSpacing)throw Error('Wrong playable mode: '+label+' '+JSON.stringify(metrics));
      const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const filename=label+'-1280x800.png';fs.writeFileSync(path.join(output,filename),Buffer.from(shot.data,'base64'));
      // Check the real on-canvas toggle using Chrome pointer events, not just the viewport API.
      if(label==='default060'){
        const pt=await c.eval(`(()=>{
          const b=VIEWPORT.hudBounds(),v=VIEWPORT.get();
          return {x:(b.right-52-1+26+v.offsetX)*v.scale,
            y:(b.top+14+52+12+22+v.offsetY)*v.scale};})()`);
        const clickToggle=async()=>{
          await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:pt.x,y:pt.y,button:'left',clickCount:1});
          await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pt.x,y:pt.y,button:'left',clickCount:1});
        };
        await clickToggle();
        await sleep(260);
        const middle=await c.eval('VIEWPORT.tiltScale()');
        if(!(middle<1&&middle>.6))
          throw Error('No progressive tilt while switching to 2D: '+middle);
        await sleep(900);
        const back=await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen})');
        if(back.tilt!==1||back.spacing!==1.2||back.screen!=='other')
          throw Error('In-game toggle to 2D failed: '+JSON.stringify(back));
        await clickToggle();
        await sleep(1050);
        const again=await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen})');
        if(again.tilt!==.6||again.spacing!==1.2||again.screen!=='other')
          throw Error('In-game toggle to 2.5D failed: '+JSON.stringify(again));
        metrics.liveToggle={intermediateTilt:middle,to2d:back,to25d:again};
      }
      results.push({label,file:filename,metrics,errors:[...c.errors]});
      if(c.errors.length)console.warn('JS EXCEPTIONS '+label+': '+c.errors.join(' | '));
      console.log('CAPTURE '+JSON.stringify({label,metrics,bytes:fs.statSync(path.join(output,filename)).size}));
    }
    fs.writeFileSync(path.join(output,'capture-results.json'),JSON.stringify(results,null,2));
    console.log('PASS '+results.length+' local A/B captures');
  }finally{
    try{ws?.close();}catch{}child.kill();server.close();await sleep(400);
    try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
  }
}
main().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
