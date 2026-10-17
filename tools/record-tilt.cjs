'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/validation/hd25d-motion');
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',ffmpeg='C:/ffmpeg/bin/ffmpeg.exe',ffprobe='C:/ffmpeg/bin/ffprobe.exe';
const sleep=x=>new Promise(ok=>setTimeout(ok,x));const ok=(x,m)=>{if(!x)throw Error(m)};
const smoke=process.argv.includes('--smoke');
const scenes=(smoke?[['movement',2]]:[['movement',12],['combat',15],['stress',12]]).filter(x=>!process.argv.includes('--skip-movement')||x[0]!=='movement');
const tilts=smoke?[['070','?tilt=0.70']]:[['2d','?tilt=1'],['070','?tilt=0.70'],['060','?tilt=0.60&spacing=1']];
const prelude="(()=>{let seed=1;window.__RESET=s=>seed=s>>>0||1;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};window.__RESET(76543);try{localStorage.setItem('yokai-tutorial-v1',JSON.stringify('skip'))}catch{}})()";
const fixture=[
'  let __scene="movement";',
'  window.__REC={',
'    init(id){__scene=id;tutorialSkipped=true;tutorialSeen=new Set(tutorialIds);',
'      start("night-town");titleCardT=0;fadeT=0;tutorial=null;orderT=spawnT=bossT=surgeT=1e6;',
'      orders.length=0;job=null;inter=null;enemies.length=0;gems.length=0;texts.length=0;P.inv=1e6;',
'      if(id!=="movement"){const n=id==="stress"?21:5;',
'        for(let j=0;j<n;j++){const a=2*Math.PI*j/n+0.1,d=id==="stress"?175+(j%3)*43:185+(j%2)*52;',
'          const type=j%5===1?"runner":j%5===3?"tank":"ghost",hp=j===0?3:(id==="stress"?26:18);',
'          enemies.push({x:P.x+Math.cos(a)*d,y:P.y+Math.sin(a)*d,type,hp,max:hp,',
'            speed:type==="runner"?88:50,flash:0,slowT:0,wob:j*.27});}',
'        WL.katana=id==="stress"?4:3;WL.barrier=id==="stress"?3:2;',
'        if(id==="stress")WL.thunder=2;wT.katana=0;wT.barrier=0;wT.thunder=0;atkT=0;}',
'      RENDERER.setCam(P.x-W/2,P.y-H/(2*tiltK()));last=1000;return this.snap();},',
'    step(i){const t=i/30;keys.clear();let move;',
'      if(__scene==="movement")move=t<2.4?["r"]:t<4.8?["u"]:t<7.2?["u","r"]:t<9.6?["l","d"]:["d"];',
'      else if(__scene==="combat")move=t<3?["r"]:t<6?["u"]:t<9?["l"]:t<12?["d"]:["r","u"];',
'      else move=t<3?["r","d"]:t<6?["l"]:t<9?["u"]:["r","d"];',
'      for(const key of move)keys.add(key);window.__RESET(0x53c18f+i*8191);',
'      if(i===0)last=1000-1000/30;runFrame(1000+i*1000/30);return this.snap();},',
'    snap(){return{state,elapsed:+elapsed.toFixed(3),p:[+P.x.toFixed(3),+P.y.toFixed(3)],',
'      firstEnemy:enemies[0]?[+enemies[0].x.toFixed(2),+enemies[0].y.toFixed(2)]:null,',
'      enemies:enemies.length,gems:gems.length,oil:+oil.toFixed(2)};}',
'  };'
].join('\n');
const src=fs.readFileSync(path.join(root,'js/game.js'),'utf8'),end='  requestAnimationFrame(frame);\n})();';
ok(src.includes(end),'game entry changed');
const modified=src.replace(end,fixture+'\n})();');
class Client{
 constructor(ws){this.ws=ws;this.id=1;this.pending=new Map();this.errors=[];ws.onmessage=e=>{const d=JSON.parse(e.data);
   if(d.method==='Runtime.exceptionThrown'){this.errors.push(d.params?.exceptionDetails?.exception?.description||d.params?.exceptionDetails?.text);return;}
   const p=this.pending.get(d.id);if(p){this.pending.delete(d.id);d.error?p.bad(Error(JSON.stringify(d.error))):p.ok(d.result);}};}
 send(method,params={}){const id=this.id++;return new Promise((ok,bad)=>{this.pending.set(id,{ok,bad});this.ws.send(JSON.stringify({id,method,params}));});}
 async eval(js){const r=await this.send('Runtime.evaluate',{expression:js,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
}
async function exec(exe,args){const p=spawn(exe,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 return new Promise((ok,bad)=>{p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);
   p.on('error',bad);p.on('close',code=>code===0?ok(stdout):bad(Error(exe+' '+code+' '+stderr.slice(-2300))));});}
async function main(){
 ok(fs.existsSync(chrome),'Chrome missing');ok(fs.existsSync(ffmpeg),'FFmpeg missing');fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
   const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
   if(file!==path.join(root,'index.html')&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   if(name==='/js/game.js'){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'}).end(modified);return;}
   fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('not found');return;}
     const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};
     res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yokai-record-'));
 const browser=spawn(chrome,['--headless=new','--disable-extensions','--no-first-run','--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required','--remote-allow-origins=*','--remote-debugging-port=0',
  '--user-data-dir='+tmp,'about:blank'],{stdio:'ignore',windowsHide:true});
 let socket;
 const results=process.argv.includes('--skip-movement')&&fs.existsSync(path.join(out,'results.json'))
   ? JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8'))
   : {generatedAt:new Date().toISOString(),instrumentation:'in-memory game.js injection; original source unchanged',
   fixedGameStepHz:30,videoFps:30,scenes:{},limitations:['Wall clock based MediaRecorder, frame pacing may drift under CPU load.']};
 try{
   let port;for(let i=0;i<100;i++){const f=path.join(tmp,'DevToolsActivePort');if(fs.existsSync(f)){port=+fs.readFileSync(f,'utf8').split('\n')[0];break;}await sleep(100);}
   ok(port,'Chrome CDP unavailable');const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
   socket=new WebSocket(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);
   await new Promise((yes,no)=>{socket.onopen=yes;socket.onerror=no;});
   const c=new Client(socket);await c.send('Page.enable');await c.send('Runtime.enable');
   await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
   await c.send('Page.addScriptToEvaluateOnNewDocument',{source:prelude});
   for(const [scene,seconds] of scenes){
     let baseline=null;const entry=results.scenes[scene]={seconds,variants:{}};
     for(const [tilt,q] of tilts){
       c.errors=[];await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html'+q});
       let ready=false;for(let i=0;i<150;i++){await sleep(100);
         if(await c.eval('!!window.__REC&&!!window.RENDERER')){ready=true;break;}}
       ok(ready,'recorder not loaded '+scene+tilt);
       await c.eval('window.__REC.init("'+scene+'")');
       let art=false;for(let i=0;i<160;i++){await sleep(100);
         art=await c.eval('window.ART_READY!==false&&!!window.ART?.player?.naturalWidth');if(art)break;}
       ok(art,'game art missing '+scene+tilt);
       const codec=await c.eval('["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(x=>MediaRecorder.isTypeSupported(x))');
       ok(codec,'WebM capture unavailable');
       await c.eval('(()=>{const stream=RENDERER.getCanvas().captureStream(0),track=stream.getVideoTracks()[0],rec=new MediaRecorder(stream,{mimeType:'+JSON.stringify(codec)+',videoBitsPerSecond:2100000}),parts=[];rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};const done=new Promise(ok=>rec.onstop=ok);window.__MOVIE={stream,track,rec,parts,done};rec.start(1000)})()');
       const steps=seconds*30,trace=[],samples=[];let late=0,diverged=0;
       if(tilt==='2d')baseline=[];
       const begin=Date.now();
       for(let i=0;i<steps;i++){
         const t=Date.now(),s=await c.eval('window.__REC.step('+i+')');
         if(s.state!=='play')throw Error('left play '+scene+' '+tilt+' frame '+i+' '+JSON.stringify(s));
         if(tilt==='2d')baseline[i]=s.p;
         else if(baseline&&baseline[i]&&(Math.abs(s.p[0]-baseline[i][0])>.01||Math.abs(s.p[1]-baseline[i][1])>.01))diverged++;
         if(i===0||i===Math.floor(steps/2)||i===steps-1)samples.push({frame:i,...s});
         await c.eval('window.__MOVIE.track.requestFrame()');trace.push(Date.now()-t);
         const wait=begin+(i+1)*1000/30-Date.now();
         if(wait>0)await sleep(wait);else late++;
       }
       await c.eval('(async()=>{const r=window.__MOVIE;await new Promise(ok=>setTimeout(ok,200));r.rec.stop();await r.done;const b=new Uint8Array(await new Blob(r.parts).arrayBuffer());let s="";for(let i=0;i<b.length;i+=24576)s+=String.fromCharCode(...b.subarray(i,i+24576));r.data=btoa(s);r.stream.getTracks().forEach(x=>x.stop());return b.length})()');
       const len=await c.eval('window.__MOVIE.data.length');let str='';
       for(let i=0;i<len;i+=350000)str+=await c.eval('window.__MOVIE.data.slice('+i+','+(i+350000)+')');
       const webm=path.join(out,scene+'-'+tilt+'.webm');fs.writeFileSync(webm,Buffer.from(str,'base64'));
       const mp4=path.join(out,scene+'-'+tilt+'.mp4');
       await exec(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',webm,
         '-vf','fps=30,scale=1280:800,tpad=stop_mode=clone:stop_duration=0.40','-t',String(seconds),
         '-an','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-crf','25','-movflags','+faststart',mp4]);
       const probe=JSON.parse(await exec(ffprobe,['-v','error','-show_entries','format=duration,size:stream=codec_name,nb_frames,width,height','-of','json',mp4]));
       const p95=trace.sort((a,b)=>a-b)[Math.floor(trace.length*.95)];
       const info={path:path.basename(mp4),duration:Number(probe.format.duration),bytes:fs.statSync(mp4).size,
         frames:Number(probe.streams[0].nb_frames),codec:probe.streams[0].codec_name,
         simulationSteps:steps,divergentPlayerFrames:diverged,p95CaptureStepMs:p95,lateCaptureSteps:late,
         exceptions:[...c.errors],snapshots:samples};
       entry.variants[tilt]=info;
       fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
       console.log('VIDEO '+scene+' '+tilt+' '+JSON.stringify({duration:info.duration,bytes:info.bytes,frames:info.frames,late,diverged,errors:info.exceptions.length}));
       ok(info.bytes>30000&&info.duration>=seconds*.6,'video invalid');
     }
     if(smoke)break;
     const args=tilts.flatMap(([id])=>['-i',path.join(out,scene+'-'+id+'.mp4')]);
     const names=['2D','2.5D 0.70','2.5D 0.60'];
     const filters=names.map((label,i)=>'['+i+':v]scale=640:400,pad=640:440:0:40:color=0x181a1e,drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='+JSON.stringify(label)+':x=(w-text_w)/2:y=8:fontcolor=white:fontsize=24[v'+i+']').join(';');
     const compare=path.join(out,scene+'-compare.mp4');
     await exec(ffmpeg,['-hide_banner','-loglevel','error','-y',...args,'-filter_complex',filters+';[v0][v1][v2]hstack=inputs=3[v]','-map','[v]',
       '-an','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-crf','26','-movflags','+faststart',compare]);
     entry.compare=path.basename(compare);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
     console.log('COMPARE '+scene+' '+fs.statSync(compare).size);
   }
   console.log('PASS dynamic video recording',Object.keys(results.scenes).length,'scenarios');
 }finally{
   try{socket?.close()}catch{}browser.kill();server.close();await sleep(450);
   try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}
 }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});