'use strict';

const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdir,writeFile}=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {stages}=require('./measure-first-four-phase-b.cjs');

const root=path.resolve(__dirname,'..');
const port=process.env.YOKAI_PHASE_C_PORT||'18789';
const origin='http://127.0.0.1:'+port;
const activeOnly=process.argv[2]==='active';
const evidence=process.env.YOKAI_BENCH_OUTPUT || path.join(root,'scratch/phase-c-20261125',activeOnly?'chrome-active':'chrome');
const roles=activeOnly?['defense']:['area','single','defense'];
const enduranceStages=['rain-port','bamboo-maze'];
const marker='    window.YOKAI_PERF = api;';
const hooks=`
    api.phaseCPrepare=(role)=>{
      start(STAGE.id);
      titleCardT=0;
      elapsed=480;
      level=200;
      xp=0;
      spawnT=Infinity;
      bossT=Infinity;
      P.inv=0;
      enemies=[];
      for(const id of Object.keys(WL))WL[id]=0;
      let attempts=0;
      while(enemies.length<MOB_DIFFICULTY.cap&&attempts<900){
        spawnEnemy(4,495+(attempts%36)*11,attempts*2.39996323,false);
        attempts++;
      }
      const pre=enemies.length;
      const directions=Array.from({length:16},(_,i)=>i*Math.PI/8).filter(a=>
        [30,65,100,135].every(r=>!blocked(P.x+Math.cos(a)*r,P.y+Math.sin(a)*r,18)));
      const route=directions[0]||0;
      surgeT=0;
      for(let i=0;i<53;i++)update(.05);
      const surge=enemies.length;
      gems=[];
      for(let i=0;i<512;i++){
        const a=i*2.39996323,r=130+Math.sqrt(i)*10;
        dropGem(P.x+Math.cos(a)*r,P.y+Math.sin(a)*r*.65,1);
      }
      for(let i=0;i<512;i++)dropGem(P.x+240+(i%25)*2,P.y-85+Math.floor(i/25)*4,2);
      const ranks=role==='area'?{boom:5,barrier:5,fire:5,ink_trail:5}
        : role==='single'?{needle:5,katana:3,thunder:2,shikigami:1}
          : {katana:3,barrier:2,seal_nail:2,shikigami:1};
      if(role==='defense'){for(const id of ['shield','shield','oil_max','oil_max','dash','dash'])UP.find(u=>u.id===id).f();}
      for(const [id,rank] of Object.entries(ranks)){
        WL[id]=rank; wT[id]=0; window.useSkillArt?.(id,rank);
      }
      const startX=P.x,startY=P.y;
      const g={count:gems.length,xp:gems.reduce((t,x)=>t+x.v,0)};
      return {pre,surge,cap:MOB_DIFFICULTY.cap,g,escapeRays:directions.length,route,startX,startY,currentOil:oil};
    };
    api.phaseCReady=()=>!artPending();
    api.phaseCState=()=>({
      state, elapsed,oil,shield:b.shield||0,x:P.x,y:P.y,
      enemies:enemies.length,shots:needles.length+proj.length+winds.length+dragonShots.length,
      enemyShot:enemyBullets.length,particles:FX.stats().particles,gems:gems.length,
      contacts:enemies.filter(e=>e.type!=="boss"&&dist(P,e)<60).length,
      heap:performance.memory?.usedJSHeapSize||null,terrain:RENDERER.performanceStats?.()
    });
    api.phaseCEscape=({route,startX,startY})=>{
      keys.clear();
      if(Math.hypot(P.x-startX,P.y-startY)>240)route+=Math.PI*.65;
      const dx=Math.cos(route),dy=Math.sin(route);
      if(!blocked(P.x+dx*24,P.y) && Math.abs(dx)>.25)keys.add(dx>0?'r':'l');
      if(!blocked(P.x,P.y+dy*24) && Math.abs(dy)>.25)keys.add(dy>0?'d':'u');
      if(enemies.some(e=>e.hp>0&&dist(P,e)<90))keys.add('dash');
    };
`;

async function main(){
  await mkdir(evidence,{recursive:true});
  const server=spawn(process.execPath,['tools/serve-tilt.cjs'],{
    cwd:root,env:{...process.env,YOKAI_PREVIEW_PORT:port,YOKAI_PREVIEW_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  let browser;
  try{
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.once('exit',code=>reject(Error('Preview exited '+code)));
      server.stdout.once('data',resolve);
    });
    browser=await chromium.launch({executablePath:process.env.YOKAI_BENCH_CHROME||
      'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const results=[];
    for(const stage of activeOnly?enduranceStages:stages){
      const context=await browser.newContext({viewport:{width:1194,height:834},deviceScaleFactor:2,hasTouch:true,serviceWorkers:'block'});
      const page=await context.newPage(),faults=[],misses=new Set();
      page.on('pageerror',e=>faults.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&m.text().includes('遊戲迴圈發生錯誤'))faults.push(m.text());});
      page.on('response',r=>{if(r.status()>=400)misses.add(new URL(r.url()).pathname+' '+r.status());});
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        if(url.pathname!=='/js/game.js')return route.continue();
        const response=await route.fetch();
        const source=await response.text();
        assert.ok(source.includes(marker));
        await route.fulfill({response,body:source.replace(marker,marker+hooks)});
      });
      await page.addInitScript(()=>{
        window.yokaiLongFrames=[];
        if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){
          new PerformanceObserver(list=>window.yokaiLongFrames.push(...list.getEntries()))
            .observe({type:'long-animation-frame',buffered:true});
        }
        localStorage.setItem('yokai-tutorial-v1','"skip"');
        const reset=()=>{
          let seed=117;
          Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
        };
        window.phaseCSeed=reset;
        reset();
      });
      await page.goto(origin+'/?dev=1&stageLab=1&perf=1&stage='+stage,{waitUntil:'domcontentloaded'});
      await page.locator('#dev-stage-picker div button').evaluate(button=>button.click());
      await page.waitForFunction(id=>window.YOKAI_PERF?.report().state.stage===id&&window.YOKAI_PERF.phaseCReady()&&
        window.YOKAI_PERF.report().state.gameState==='play',stage);
      const windows=[];
      for(const role of roles){
        const setup=await page.evaluate(role=>{
          const api=window.YOKAI_PERF;
          api.configure({hold:true});
          window.phaseCSeed();
          return api.phaseCPrepare(role);
        },role);
        assert.equal(setup.pre,setup.cap,stage+' initial cap');
        assert.deepEqual(setup.g,{count:512,xp:1536},stage+' gem merge');
        assert.ok(setup.surge>=setup.pre,stage+' wave reached');
        await page.waitForFunction(()=>window.YOKAI_PERF.phaseCReady());
        const live=await page.evaluate(async ({setup,duration})=>{
          const api=window.YOKAI_PERF, samples=[], timing=[];
          const start=performance.now();
          api.configure({hold:false});
          while(performance.now()-start<duration){
            api.phaseCEscape(setup);
            const p=api.phaseCState();
            samples.push({wall:performance.now()-start,...p});
            if(!timing.length||samples.at(-1).wall-timing.at(-1).wall>=5000){
              timing.push({wall:samples.at(-1).wall,frame:api.report().frame});
            }
            if(p.state!=='play')break;
            await new Promise(resolve=>setTimeout(resolve,180));
          }
          const report=api.report();
          const long=window.yokaiLongFrames.filter(f=>f.startTime>=start)
            .map(f=>({wall:Math.round(f.startTime-start),ms:Math.round(f.duration),
              script:Math.round(f.scripts.reduce((sum,s)=>sum+s.duration,0)),
              sources:f.scripts.map(s=>[s.sourceURL,s.duration])}));
          api.configure({hold:true});
          return {samples,timing,frame:report.frame,long};
        },{setup,duration:activeOnly?90000:6800});
        windows.push({role,setup,live});
      }
      let endurance=null;
      if(!activeOnly&&enduranceStages.includes(stage)){
        const setup=await page.evaluate(()=>{
          window.phaseCSeed();
          const api=window.YOKAI_PERF;
          api.configure({hold:true});
          return api.phaseCPrepare('defense');
        });
        await page.waitForFunction(()=>window.YOKAI_PERF.phaseCReady());
        const held=await page.evaluate(async seconds=>{
          const api=window.YOKAI_PERF, started=performance.now(), samples=[];
          api.configure({hold:true});
          for(let i=0;i<=seconds/5;i++){
            if(i>0)await new Promise(resolve=>setTimeout(resolve,5000));
            const report=api.report();
            samples.push({wall:Math.round((performance.now()-started)/1000),...api.phaseCState(),frame:report.frame});
          }
          return {samples,long:window.yokaiLongFrames.filter(x=>x.startTime>=started)
            .map(x=>Math.round(x.duration))};
        },Number(process.env.YOKAI_PHASE_C_DWELL||90));
        endurance={setup,...held};
      }
      let recovery=null;
      if(!activeOnly){
        const before=await page.evaluate(()=>window.YOKAI_PERF.phaseCState().terrain);
        await page.evaluate(()=>{
          const target=document.querySelector('#game');
          target.dispatchEvent(new Event('contextlost'));
          target.dispatchEvent(new Event('contextrestored'));
        });
        await page.waitForFunction(prev=>window.YOKAI_PERF.phaseCState().terrain.terrainPaints>prev,before.terrainPaints);
        const after=await page.evaluate(()=>window.YOKAI_PERF.phaseCState().terrain);
        assert.equal(after.mainRestores-before.mainRestores,1);
        recovery={before,after};
      }
      await page.locator('#game').screenshot({path:path.join(evidence,stage+'.jpg'),type:'jpeg',quality:87});
      results.push({stage,windows,endurance,recovery,faults,misses:[...misses]});
      await writeFile(path.join(evidence,'report.json'),JSON.stringify({chrome:browser.version(),results}));
      console.log(stage,windows.map(w=>w.setup.surge).join('/'),'faults',faults.length,'404',misses.size);
      assert.equal(faults.length,0,JSON.stringify(faults));
      await context.close();
    }
  }finally{
    await browser?.close();
    server.kill();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
