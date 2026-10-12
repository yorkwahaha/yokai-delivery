// Real Chromium device-viewport verification for the approved eight-stage map.
// Built-in Node 24 WebSocket / CDP. No external packages or network requests.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const output=path.join(root,'artifacts/validation/eight-stage-a5');
const page='file:///I:/Projects/yokai-delivery/artifacts/validation/overworld-eight-stage-integration.html';
const combos=[
  ['night-town',900,600],['rain-port',900,600],['sakura-pass',900,600],
  ['bamboo-maze',900,600],['hyakki-kyoto',900,600],['snow-temple',900,600],
  ['spirit-ferry',900,600],['yomi',900,600],
  ['rain-port',844,390],['snow-temple',1194,834],
  ['spirit-ferry',390,844],['yomi',360,800]
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Client {
  constructor(ws){
    this.ws=ws;this.next=1;this.pending=new Map();
    ws.onmessage=e=>{
      const payload=JSON.parse(e.data);
      if(!payload.id)return;
      const promise=this.pending.get(payload.id);if(!promise)return;
      this.pending.delete(payload.id);
      payload.error?promise.reject(new Error(JSON.stringify(payload.error))):promise.resolve(payload.result);
    };
  }
  async send(method,params={}){
    const id=this.next++;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  eval(expression){return this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}).then(x=>x.result?.value);}
}
async function main(){
  if(!fs.existsSync(chrome))throw Error('Chrome not installed: '+chrome);
  fs.mkdirSync(output,{recursive:true});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yokai-cdp-'));
  const child=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
    '--no-default-browser-check','--allow-file-access-from-files','--remote-allow-origins=*',
    '--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore',windowsHide:true});
  let ws;
  try{
    const active=path.join(dir,'DevToolsActivePort');
    let port;
    for(let i=0;i<100;i++){if(fs.existsSync(active)){port=+fs.readFileSync(active,'utf8').split('\n')[0];break;}await sleep(100);}
    if(!port)throw Error('Chrome did not publish DevTools port');
    const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    const target=targets.find(t=>t.type==='page');
    if(!target)throw Error('No Chrome page target');
    ws=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    const c=new Client(ws);
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    for(const [id,width,height] of combos){
      await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<height});
      await c.send('Page.navigate',{url:page+'?stage='+encodeURIComponent(id)+'&r='+width+'x'+height});
      let state;
      for(let i=0;i<70;i++){
        await sleep(110);
        try{
          state=await c.eval('({ready:document.documentElement.dataset.ready||"", logical:document.documentElement.dataset.logical||"", stage:document.documentElement.dataset.selected||"", width:innerWidth,height:innerHeight,error:document.getElementById("proof")?.textContent||""})');
        }catch{}
        if(state?.ready==='true'||state?.ready==='error'||state?.ready==='false')break;
      }
      if(state?.ready!=='true'||state.width!==width||state.height!==height)throw Error(id+': invalid real device viewport '+JSON.stringify(state));
      const result=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
      const file=path.join(output,id+'-cdp-'+width+'x'+height+'.png');
      fs.writeFileSync(file,Buffer.from(result.data,'base64'));
      console.log(id+' '+width+'x'+height+' logical='+state.logical+' capture='+fs.statSync(file).size+' bytes');
    }
    console.log('PASS '+combos.length+' real Chrome emulated viewport screenshots');
  }finally{
    try{ws?.close();}catch{}
    child.kill();
    await sleep(400);
    try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
  }
}
main().catch(err=>{console.error(err.stack||err.message);process.exitCode=1});
