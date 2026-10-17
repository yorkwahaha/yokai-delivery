// Codex 獨立 Chrome QA。僅 HTTP 回應注入觀測 hook，不改 production；不讀音檔、不呼叫 TTS。
// node tools/qa-stage2-enemies.cjs [--serve]：--serve 提供原頁面靜音預覽，不注入控制 hook。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/validation/codex-stage2-enemies-20261014');
const PORT = Number((process.argv.find(a => a.startsWith('--port=')) || '--port=9144').split('=')[1]), CDP_PORT = PORT + 1;
const preview = process.argv.includes('--serve');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const silent = `window.__audioCalls=[]; window.AUDIO=new Proxy({}, {get:(_,k)=> (...args)=>{window.__audioCalls.push(String(k));}});`;
const INIT = `
localStorage.setItem('yokai-tutorial-v1','"skip"');
window.__drawnEnemies=[];
const originalDraw=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
 if(img?.src?.includes('/rain-port/enemies/')) {
   const m=this.getTransform(),d=args.length===4?args:args.slice(4),[x,y,w,h]=d;
   const pts=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([a,b])=>({x:m.a*a+m.c*b+m.e,y:m.b*a+m.d*b+m.f}));
   window.__drawnEnemies.push({src:img.src,args,bbox:{left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),top:Math.min(...pts.map(p=>p.y)),bottom:Math.max(...pts.map(p=>p.y))},canvas:{width:this.canvas.width,height:this.canvas.height}});
 }
 return originalDraw.call(this,img,...args);
};
window.requestAnimationFrame=()=>0;
window.Audio=class { constructor(src){this.src=src;this.paused=true;} addEventListener(){} removeEventListener(){} load(){} pause(){this.paused=true;} play(){this.paused=false;return Promise.resolve();} };
${silent}
`;
const HOOK = `
window.__stage2QA={
 start:id=>{start(id);spawnT=Infinity;surgeT=Infinity;bossT=Infinity;orders=[];job=null;titleCardT=0;for(const k in WL)WL[k]=0;},
 snap:()=>({state,stageId:STAGE.id,oil,x:P.x,y:P.y,bossQuiz:!!bossQ,bossSealed:!!enemies.find(e=>e.type==='boss'&&e.shield),enemies:enemies.map(e=>({type:e.type,x:e.x,y:e.y,pose:e.pose,umibozu:e.umibozu,shield:e.shield,final:e.final,hazard:e.hazard?{...e.hazard}:null})),assets:Object.fromEntries(Object.entries(window.PORT_ENEMIES||{}).map(([k,v])=>[k,{src:v.src,width:v.naturalWidth,height:v.naturalHeight}]))}),
 draw:()=>{window.__drawnEnemies=[];RENDERER.setCam(P.x-W/2,P.y-H/(2*tiltK()));last=performance.now();runFrame(last);return {snap:window.__stage2QA.snap(),draws:window.__drawnEnemies};},
 tick:seconds=>{for(let t=0;t<seconds-1e-9;t+=.02)update(Math.min(.02,seconds-t));return window.__stage2QA.snap();},
 minion:()=>{elapsed=240;solids.splice(0);let e;for(let i=0;i<80&&!e;i++){spawnT=0;update(.01);e=enemies.find(e=>e.type==='shiome');}if(!e)throw Error('ordinary wave spawn did not produce Shiome');enemies=[e];spawnT=Infinity;orders=[];job=null;Object.assign(e,{x:P.x+160,y:P.y,hp:100,max:100,speed:0,shiomeCd:.8});return window.__stage2QA.snap();},
 boss:()=>{enemies=[];orders=[];job=null;bossStage=3;elapsed=BOSS_TIMES[3];bossT=0;solids.splice(0);update(.01);const e=enemies.find(e=>e.final);if(!e)throw Error('real scheduler did not spawn final boss');Object.assign(e,{x:P.x-180,y:P.y,speed:0});P.inv=100;update(.02);return window.__stage2QA.snap();},
 answerSeal:()=>{const e=enemies.find(e=>e.final);if(!bossQ)throw Error('no real Boss quiz');bossQ.lock=0;answerBoss(bossQ.ans.indexOf(e.word));return {snap:window.__stage2QA.snap(),audioCalls:window.__audioCalls};}
};
`;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.css':'text/css'};
function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      if (pathname.startsWith('/assets/audio/')) {res.writeHead(204).end();return;}
      if (pathname === '/js/audio.js') {res.writeHead(200,{'Content-Type':MIME['.js']}).end(silent);return;}
      const file = path.resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(ROOT + path.sep) || !MIME[path.extname(file)]) {res.writeHead(404).end();return;}
      fs.readFile(file,(err,data)=>{
        if(err){res.writeHead(404).end();return;}
        if(pathname === '/js/game.js' && !preview) {
          const source = data.toString('utf8'), end=source.lastIndexOf('})();');
          if(end<0){res.writeHead(500).end('game closure hook missing');return;}
          data=source.slice(0,end)+HOOK+source.slice(end);
        }
        if(pathname === '/index.html' && preview) data=data.toString('utf8').replace('<head>',`<head><script>window.Audio=class {constructor(src){this.src=src;}addEventListener(){}load(){}pause(){}play(){return Promise.resolve();}};</script>`);
        res.writeHead(200,{'Content-Type':MIME[path.extname(file)],'Cache-Control':'no-store'}).end(data);
      });
    });
    server.once('error',reject);server.listen(PORT,'127.0.0.1',()=>resolve(server));
  });
}
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
class CDP {
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];ws.onmessage=event=>{
    const m=JSON.parse(event.data),p=this.pending.get(m.id);
    if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown')this.errors.push(m.params.exceptionDetails);
  };}
  static async connect(url){const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});return new CDP(ws);}
  send(method,params={}){return new Promise((resolve,reject)=>{
    const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(Error(method+' timeout'));},15000);
    this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));
  });}
  async eval(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
  async shot(name){name='final-visible-'+name;const r=await this.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name),Buffer.from(r.data,'base64'));return name;}
}
function visibleDraw(d){const b=d.bbox,c=d.canvas;return b&&b.right>0&&b.left<c.width&&b.bottom>0&&b.top<c.height&&b.left>=0&&b.right<=c.width&&b.top>=0&&b.bottom<=c.height;}
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await sleep(100);}throw Error(label+' timeout');}
async function main(){
  fs.mkdirSync(OUT,{recursive:true});const server=await serve();
  if(preview){console.log(`静音本機預覽 http://127.0.0.1:${PORT}/index.html (不讀音檔／無測試hook)`);return;}
  let chrome,cdp;const evidence=[];
  try{
    assert.ok(fs.existsSync(CHROME),'Chrome unavailable');
    chrome=spawn(CHROME,['--headless=new','--disable-gpu','--hide-scrollbars','--mute-audio','--no-first-run','--disable-extensions','--disable-background-networking',`--user-data-dir=${path.join(OUT,'chrome-profile')}`,`--remote-debugging-port=${CDP_PORT}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    chrome.stderr.on('data',data=>fs.appendFileSync(path.join(OUT,'chrome-stderr.log'),data));
    await until(async()=>{try{return(await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok;}catch{return false;}},'CDP');
    const pages=await(await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    cdp=await CDP.connect(pages.find(t=>t.type==='page').webSocketDebuggerUrl);
    await cdp.send('Page.enable');await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:INIT});
    for(const device of [{label:'desktop',width:1280,height:800},{label:'ipad-width',width:1024,height:768}])for(const tilt of [1,.6]){
      const label=`${device.label}-${tilt===1?'2d':'25d'}`;
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:device.width,height:device.height,deviceScaleFactor:1,mobile:false});
      await cdp.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html?tilt=${tilt}&qa=${label}`});
      await until(()=>cdp.eval('!!window.__stage2QA'),'QA hook');
      await cdp.eval("__stage2QA.start('rain-port')");
      await until(()=>cdp.eval("window.ART_READY!==false && Object.values(PORT_ENEMIES).filter(v=>v.naturalWidth).length===4"),'approved runtime art');
      await cdp.eval(`VIEWPORT.setTiltScale(${tilt});__stage2QA.minion()`);
      let initial=await cdp.eval('__stage2QA.draw()');
      assert.ok(initial.draws.some(d=>d.src.includes('minion_shiome_idle.webp')&&visibleDraw(d)),'actual visible idle draw');
      const idleFile=await cdp.shot(label+'-shiome-idle.png');
      const timeline=[];let attack;
      for(let i=0;i<500;i++){
        const s=await cdp.eval('__stage2QA.tick(.02)');const e=s.enemies.find(e=>e.type==='shiome');
        timeline.push({time:(i+1)*.02,pose:e.pose,phase:e.hazard?.phase,kind:e.hazard?.kind});
        if(e.pose==='attack'&&['active','strike'].includes(e.hazard?.phase)){attack=await cdp.eval('__stage2QA.draw()');break;}
      }
      assert.ok(attack?.draws.some(d=>d.src.includes('minion_shiome_attack.webp')&&visibleDraw(d)),'actual visible attack draw');
      const attackFile=await cdp.shot(label+'-shiome-attack.png');
      await cdp.eval('__stage2QA.tick(.16)');const hold=await cdp.eval('__stage2QA.draw()');
      assert.ok(hold.draws.some(d=>d.src.includes('minion_shiome_attack.webp')),'held pose');
      await cdp.shot(label+'-shiome-attack-hold.png');
      await cdp.eval("__stage2QA.start('rain-port')");
      await until(()=>cdp.eval('window.ART_READY!==false'),'core art');
      await cdp.eval(`VIEWPORT.setTiltScale(${tilt});__stage2QA.boss()`);
      const sealed=await cdp.eval('__stage2QA.draw()');
      assert.equal(sealed.snap.bossSealed,true);assert.ok(sealed.draws.some(d=>d.src.includes('boss_ikari_umibozu_idle.webp')));
      const sealedFile=await cdp.shot(label+'-boss-sealed.png');
      const answered=await cdp.eval('__stage2QA.answerSeal()');assert.equal(answered.snap.bossSealed,false);
      assert.ok(answered.audioCalls.includes('startBossMusic'),'existing Boss BGM event preserved in silent stub');
      await cdp.eval('__stage2QA.draw()');await cdp.shot(label+'-boss-unsealed-idle.png');
      const bossTimeline=[];let tide;
      for(let i=0;i<1800;i++){
        const s=await cdp.eval('__stage2QA.tick(.02)');const e=s.enemies.find(e=>e.final);
        bossTimeline.push({time:(i+1)*.02,pose:e.pose,phase:e.hazard?.phase,kind:e.hazard?.kind});
        if(e.hazard?.kind==='tide'&&e.hazard.phase==='active'){tide=await cdp.eval('__stage2QA.draw()');break;}
      }
      assert.ok(tide?.draws.some(d=>d.src.includes('boss_ikari_umibozu_attack.webp')&&visibleDraw(d)),'actual visible tide attack draw');
      const tideFile=await cdp.shot(label+'-boss-tide-active.png');
      await cdp.eval('__stage2QA.tick(1.1)');const recovery=await cdp.eval('__stage2QA.draw()');
      assert.ok(recovery.draws.some(d=>d.src.includes('boss_ikari_umibozu_idle.webp')),'recovery idle draw');
      await cdp.shot(label+'-boss-recovery-idle.png');
      evidence.push({label,viewport:device,tilt,idleFile,attackFile,sealedFile,tideFile,minionTimeline:timeline,bossTimeline,initial,attack,sealed,tide,recovery,status:'PASS'});
    }
    assert.equal(cdp.errors.length,0,'Chrome uncaught exceptions');
    fs.writeFileSync(path.join(OUT,'chrome-evidence-final.json'),JSON.stringify({status:'PASS',scope:'Real Chrome, controlled HTTP-only hook: wave timer/time/position, final scheduler index and quiz correct answer; real production spawn/AI/render, transformed sprite bounds inside canvas verified. Audio script stubbed and sound files never read. iPad width is desktop emulation, not physical iPad. No natural ten-minute run.',evidence,errors:cdp.errors},null,2));
    console.log(`PASS: ${evidence.length} viewport/mode cases; real Shiome idle/held attack and sealed/unsealed Ikari/tide/recovery; no uncaught exceptions.`);
  }catch(error){fs.writeFileSync(path.join(OUT,'chrome-failure.json'),JSON.stringify({message:error.message,stack:error.stack,evidence,errors:cdp?.errors},null,2));throw error;}
  finally{cdp?.ws.close();chrome?.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
