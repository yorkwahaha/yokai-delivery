'use strict';

// Controlled Chromium Canvas scene. No player input, gameplay run, or network.
const { chromium } = require('playwright');
const { readFile } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname,'..');
const origin = 'http://127.0.0.1:8799';
const args = process.argv.slice(2);
const requested = args.filter(arg => !arg.startsWith('--'));
const stage = args.find(arg => arg.startsWith('--stage='))?.slice(8) || 'rain-port';
if (!['night-town','rain-port','sakura-pass'].includes(stage)) throw new RangeError('Unsupported benchmark stage');
const phasePixels = args.includes('--verify-phase-pixels');
const baseline = process.argv.includes('--baseline');
const verifyPixels = process.argv.includes('--verify-pixels');
const verifyParticles = process.argv.includes('--verify-particle-pixels');
const originalFx = process.argv.includes('--original-fx');
const heavyAir = process.argv.includes('--heavy-air') || requested.includes('P');
const brief = process.argv.includes('--brief');
const types = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const scenarios = [
  ['A',{}],['B',{array:false}],['C',{rain:false}],['D',{accents:false}],
  ...[50,53,200,512].map(gems => [`E${gems}`,{gems}]),
  ...[1,5].map(rank => [`F${rank}`,{rank}]),
  ...[.75,.5].map(resolution => [`G${resolution}`,{resolution}]),['A2',{}],
  ['P',{airParticles:false}],
  ['OLD',{gems:512,gemBatch:'original',uiShadows:'original'}],
  ['HUD',{gems:512,gemBatch:'original'}],
  ['GEMS',{gems:512,uiShadows:'original'}],
  ['TERRAIN',{gems:512,terrainCache:'projected'}],
  ['REPAINT',{gems:512,terrainCache:'repaint'}],
  ['RAIN',{gems:512,rainBatch:true}],
  ['LIGHT',{gems:512,lighting:'direct'}],
  ['DAMAGE',{gems:512,damageText:'atlas'}],
  ...['canvas','image','bitmap'].map(fxBatch => [`FX-${fxBatch}`,{gems:512,fxBatch}])
];

async function verifyParticlePixels(page, original) {
  const revised = await readFile(path.join(root,'js/fx.js'),'utf8');
  const rows = await page.evaluate(async ({original,revised}) => {
    const bounds = {left:0,right:900,top:0,bottom:850};
    const cam = {x:0,y:0};
    const results = [];
    for (const tilt of [.6,1]) {
      const viewport = {
        tiltScale:()=>tilt,
        upright(ctx,x,y,draw) {
          if (tilt===1) return draw();
          ctx.save();ctx.translate(x,y);ctx.scale(1,1/tilt);ctx.translate(-x,-y);
          try { return draw(); } finally { ctx.restore(); }
        }
      };
      async function render(source, bitmaps) {
        const env = {VIEWPORT:viewport,__ACTIVE_STAGE:'rain-port'};
        if (bitmaps) env.createImageBitmap = window.createImageBitmap.bind(window);
        const fx = new Function('window','document',source+'\nreturn window.FX;')(env,document);
        for (let i=0;i<380;i++) {
          const a=i*2.39996323, r=13*Math.sqrt(i);
          fx.emit(['glow','shard','ring','seal','rock','spark'][i%6],i%3?'#7ce6df':'#ffe082',{
            x:450+Math.cos(a)*r,y:400+Math.sin(a)*r*.7,s0:26+i%4*10,s1:9,life:1,a:.7,
            rot:i%5===0 ? 0 : a,sx:i%7===0 ? 2.3 : 1,sy:i%9===0 ? .6 : 1,
            blend:i%3?'source-over':'lighter',foot:i%53===0,ground:i%17===0
          });
        }
        fx.update(.25);
        while (fx.stats().bitmapPending) await new Promise(resolve=>setTimeout(resolve,5));
        const canvas = document.createElement('canvas');
        canvas.width=1510;canvas.height=1160;
        const ctx = canvas.getContext('2d',{alpha:false});
        ctx.fillStyle='#283348';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.setTransform(1.66,0,0,1.66*tilt,.37,.78);
        const ops={};
        for (const method of ['save','restore','translate','rotate','scale','transform','drawImage']) {
          const native=ctx[method].bind(ctx);
          ctx[method]=(...args)=>{
            ops[method]=(ops[method]||0)+1;
            if (method==='drawImage' && args[0] instanceof ImageBitmap) ops.bitmaps=(ops.bitmaps||0)+1;
            native(...args);
          };
        }
        fx.drawGround(ctx,cam,bounds);
        fx.draw(ctx,cam,bounds);
        return {ops,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data};
      }
      const before = await render(original,false);
      const transforms = await render(revised,false);
      const bitmaps = await render(revised,true);
      for (const [test,after] of [['transforms',transforms],['bitmaps',bitmaps]]) {
        let changed=0, max=0, sum=0;
        for (let i=0;i<before.pixels.length;i+=4) {
          const a=before.pixels,b=after.pixels;
          const diff=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
          if (diff) changed++;
          max=Math.max(max,diff);sum+=diff;
        }
        const pixels=before.pixels.length/4;
        results.push({tilt,test,pixels,changed,max,mean:sum/pixels,before:before.ops,after:after.ops});
      }
    }
    return results;
  },{original,revised});
  for (const row of rows) console.log(JSON.stringify(row));
  if (rows.some(row => row.before.drawImage!==row.after.drawImage ||
      row.mean>.03 || row.changed/row.pixels>.015 ||
      row.test==='bitmaps' && !row.after.bitmaps)) throw new Error('Particle output exceeded the comparison threshold');
}

async function main() {
  const browser = await chromium.launch({headless:true, executablePath:process.env.YOKAI_BENCH_CHROME});
  try {
    const page = await browser.newPage({viewport:{width:1194,height:834},deviceScaleFactor:2,hasTouch:true,
      reducedMotion:'no-preference',serviceWorkers:'block'});
    const errors = [];
    const original = originalFx || verifyParticles
      ? execFileSync('git',['show','704cf72:js/fx.js'],{cwd:root,encoding:'utf8'})
      : null;
    if (verifyParticles) {
      await verifyParticlePixels(page,original);
      return;
    }
    page.on('pageerror',err => errors.push(err.message));
    page.on('console',msg => {
      if (msg.type() === 'error' && msg.text().includes('遊戲迴圈發生錯誤')) errors.push(msg.text());
    });
    await page.addInitScript(() => {
      let seed = 20261122;
      Math.random = () => {
        seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
        return seed/4294967296;
      };
    });
    await page.route('**/*',async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      const file = path.resolve(root,'.'+(url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (!file.startsWith(root+path.sep)) return route.abort();
      let body;
      try { body = await readFile(file); }
      catch { return route.fulfill({status:404,body:''}); }
      if (url.pathname === '/js/fx.js' && originalFx) body = original;
      if (url.pathname === '/js/game.js') {
        body = body.toString().replace('window.YOKAI_PERF = api;', `window.YOKAI_PERF = api;
          api.prepareBenchmark = (airParticles, phase) => {
            elapsed = 819; weatherClock = 819;
            enemies.length = 0;
            for (let i=0;i<20;i++) spawnEnemy(1,180+i*5,i*2.39996323,0);
            WL.barrier = 5;
            if (phase) {
              b.shieldPicks=3; b.dmgUp=4; b.rate=4; b.crit=3; b.spd=3; b.dash=3;
              for (let i=0;i<45;i++) {
                const angle=i*2.39996323, r=38*Math.sqrt(i);
                RENDERER.spawnDamageNumber(12+i%8+.5,P.x+Math.cos(angle)*r,P.y+Math.sin(angle)*r,i%7===0);
              }
            }
            if (airParticles) {
              for (let i=0;i<380;i++) {
                const a=i*2.39996323, r=14*Math.sqrt(i);
                FX.emit(['glow','shard','ring','seal','rock','spark'][i%6],i%3?'#7ce6df':'#ffe082',
                  {x:P.x+Math.cos(a)*r,y:P.y+Math.sin(a)*r*.7,s0:30+i%4*10,s1:12,life:1,
                   rot:i%5===0?0:a,sx:i%7===0?2.3:1,sy:i%9===0?.6:1,blend:i%3?'source-over':'lighter'});
              }
              FX.update(.25);
            }
          };
          api.verifyPhasePixels = (comparison, criteria) => {
            const now=performance.now(), clock=Date.now;
            const take = options => {
              api.configure({rank:5,gems:512,...options});
              weatherClock=815; last=now; runFrame(now);
              return ctx.getImageData(0,0,cv.width,cv.height).data;
            };
            tutorial=null; titleCardT=0; fadeT=0; perfText="";
            Date.now=()=>1700000000000;
            try {
              const before=take(criteria), after=take({...criteria,...comparison});
              let changed=0, significant=0, sum=0, max=0;
              for (let i=0;i<before.length;i+=4) {
                const diff=Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]));
                changed+=diff>0; significant+=diff>8; max=Math.max(max,diff); sum+=diff;
              }
              const pixels=before.length/4;
              return {pixels,changed,significant,max,mean:sum/pixels};
            } finally { Date.now=clock; }
          };
          api.verifyBossPixels = kind => {
            const k=window.VIEWPORT.tiltScale();
            const hazard = {kind,x:500,y:460,r:240,angle:.7,progress:28,safeOffset:30,
              safeWidth:130,t:.62,duration:1,phase:kind==="tidalFan" ? "telegraph" : "active",
              vortexes:[{x:380,y:460,r:36,fallProgress:.31},{x:610,y:565,r:34,fallProgress:.48}]};
            const take = bossRaster => {
              const canvas=document.createElement("canvas");
              canvas.width=1000; canvas.height=800;
              const c=canvas.getContext("2d",{alpha:false});
              api.configure({hold:true,bossRaster});
              c.setTransform(1,0,0,1,0,0);
              c.fillStyle="#182336";
              c.fillRect(0,0,canvas.width,canvas.height);
              c.setTransform(1,0,0,k,0,100);
              if (kind==="tide") {
                RENDERER.drawPortTsunamiCrest(c,hazard,(x,y,draw)=>window.VIEWPORT.upright(c,x,y,draw));
              } else if (kind==="tidalFan") RENDERER.drawPortBossTelegraphOverlay(c,hazard,819);
              else RENDERER.drawPortBossHazard(c,hazard,819);
              return c.getImageData(0,0,canvas.width,canvas.height).data;
            };
            const original=take(false), candidate=take(true), warmed=take(true);
            let changed=0, max=0, warmChanged=0, covered=0;
            for (let i=0;i<original.length;i+=4) {
              const diff=Math.max(Math.abs(original[i]-candidate[i]),Math.abs(original[i+1]-candidate[i+1]),Math.abs(original[i+2]-candidate[i+2]));
              max=Math.max(max,diff); changed+=diff>0;
              warmChanged+=warmed[i]!==candidate[i] || warmed[i+1]!==candidate[i+1] || warmed[i+2]!==candidate[i+2];
              covered+=original[i]!==24 || original[i+1]!==35 || original[i+2]!==54;
            }
            return {changed,max,warmChanged,covered};
          };
          api.verifyPixels = () => {
            const now = performance.now();
            tutorial = null; titleCardT = 0; fadeT = 0; perfText = "";
            return [true,false].map(legacy => {
              window.__PERF_COMPARE_BASELINE = legacy;
              weatherClock = 819; last = now; runFrame(now);
              return ctx.getImageData(0,0,cv.width,cv.height).data;
            }).reduce((before,after) => {
              let sum=0, max=0, changed=0;
              for (let i=0;i<before.length;i+=4) {
                const diff = Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]));
                if (diff) changed++;
                max = Math.max(max,diff); sum += diff;
              }
              return {pixels:cv.width*cv.height,changed,max,mean:sum/(cv.width*cv.height)};
            });
          };`);
      } else if (url.pathname === '/js/game-weather.js') {
        body = body.toString()
          .replace('function isPortWeatherVisible(area, world) {',
            'function isPortWeatherVisible(area, world) { if (window.__PERF_COMPARE_BASELINE) return true;')
          .replace('const seen = (x,y,w,h) => !world', 'const seen = (x,y,w,h) => window.__PERF_COMPARE_BASELINE || !world');
      } else if (url.pathname === '/js/renderer.js') {
        body = body.toString()
          .replace('function drawGemTile(tile,x,y,left,top,width,height) {',
            'function drawGemTile(tile,x,y,left,top,width,height) { if (window.__PERF_COMPARE_BASELINE) return ctx.drawImage(tile,x-24,y-24,48,48);')
          .replace('if (world && (px+pw/2', 'if (!window.__PERF_COMPARE_BASELINE && world && (px+pw/2');
      }
      return route.fulfill({body,contentType:types[path.extname(file)] || 'application/octet-stream'});
    });
    await page.goto(`${origin}/?perf=1&dev=1&s3play=1&stage=${stage}`,{waitUntil:'domcontentloaded'});
    await page.evaluate(() => document.querySelector('#dev-stage-picker div button').click());
    await page.waitForFunction(stage => window.YOKAI_PERF?.report().state.stage === stage &&
      window.YOKAI_PERF.report().state.canvases.stores.terrain.pixels > 0,stage);
    await page.evaluate(({particles,phase}) => {
      window.YOKAI_PERF.prepareBenchmark(particles,phase);
      window.YOKAI_PERF.configure({rank:5,gems:53,detail:false});
      window.barrierCoreArt(1);
    },{particles:heavyAir || phasePixels,phase:phasePixels || requested.some(name => ['OLD','HUD','GEMS','DAMAGE'].includes(name))});
    await page.waitForFunction(() => ART.barrier_core_main?.naturalWidth && ART.barrier_core_lv5?.naturalWidth);
    await page.waitForTimeout(1000);
    if (phasePixels) {
      const criteria = {uiShadows:'original',gemBatch:'original'};
      for (const tilt of [.6,1]) {
        await page.evaluate(tilt => window.VIEWPORT.setTiltScale(tilt), tilt);
        for (const comparison of [{uiShadows:'cached'},{gemBatch:'ordered'},{terrainCache:'projected'},
          {rainBatch:true},{lighting:'direct'},{damageText:'atlas'},{fxBatch:'canvas'},
          {fxBatch:'image'},{fxBatch:'bitmap'},{sanctuaryPulse:'single'}]) {
          await page.evaluate(options => window.YOKAI_PERF.configure({gems:512,...options}),comparison);
          if (comparison.fxBatch && comparison.fxBatch !== 'canvas') {
            await page.waitForFunction(mode => window.FX.stats().atlasBackings.some(page => page[mode]), comparison.fxBatch);
          }
          const parity = await page.evaluate(({comparison,criteria}) => window.YOKAI_PERF.verifyPhasePixels(comparison,criteria),
            {comparison,criteria});
          console.log(JSON.stringify({stage,tilt,comparison,parity}));
        }
        if (stage === 'rain-port') {
          await page.waitForFunction(() => ['tide','tidalFan','rainVortex'].every(key => window.BOSS_HAZARD_ART_IMG?.[key]?.naturalWidth));
          for (const kind of ['tidalFan','rainVortex','tide']) {
            const parity = await page.evaluate(kind => window.YOKAI_PERF.verifyBossPixels(kind),kind);
            console.log(JSON.stringify({stage,tilt,boss:kind,parity}));
            if (!parity.covered || parity.warmChanged) throw new Error('Invalid Boss comparison fixture');
          }
        }
      }
      if (errors.length) throw new Error(errors.join('\n'));
      return;
    }
    if (verifyPixels) {
      console.log(JSON.stringify({decode:await page.evaluate(() => window.YOKAI_PERF.probeDecode())}));
      for (const [tilt,gems] of [[.6,53],[.6,512],[1,53],[1,512]]) {
        const parity = await page.evaluate(({tilt,gems}) => {
          window.VIEWPORT.setTiltScale(tilt);
          window.YOKAI_PERF.configure({rank:5,gems,gemBatch:'original'});
          return window.YOKAI_PERF.verifyPixels();
        },{tilt,gems});
        console.log(JSON.stringify({tilt,gems,parity}));
        if (parity.max > 4 || parity.changed/parity.pixels > .01) throw new Error('Unexpected Canvas pixel change');
      }
      if (errors.length) throw new Error(errors.join('\n'));
      return;
    }
    await page.evaluate(legacy => { window.__PERF_COMPARE_BASELINE = legacy; },baseline);
    console.log(JSON.stringify({browser:browser.version(),baseline,fixture:await page.evaluate(() => window.YOKAI_PERF.report().state)}));
    for (const [name, options] of scenarios) {
      if (requested.length && !requested.includes(name)) continue;
      const config = {rank:5,gems:53,...(baseline ? {gemBatch:'original'} : {}),...options};
      await page.evaluate(config => window.YOKAI_PERF.configure(config),config);
      await page.waitForTimeout(4200);
      const {frame,state} = await page.evaluate(() => window.YOKAI_PERF.report());
      await page.evaluate(config => window.YOKAI_PERF.configure({...config,detail:true}),config);
      await page.waitForTimeout(2150);
      const {draw} = await page.evaluate(() => window.YOKAI_PERF.report());
      const summary = {name,frame,canvas:state.canvases,errors};
      if (brief) {
        summary.samples = draw.sampledFrames;
        for (const pass of ['map','weather','gems','sanctuaryFloor','skillGround','sanctuaryCanopy','rain','atmosphere','particlesAir','ui','damage','lighting']) {
          const row = draw.passes['main/'+pass] || {};
          const perFrame = key => draw.sampledFrames ? (row[key] || 0) / draw.sampledFrames : null;
          summary[pass] = {images:perFrame('drawImage'),pixels:Math.round(perFrame('imageBoundsPixels')),
            offscreen:perFrame('offscreenImages'),strokes:perFrame('stroke'),
            outlinedText:perFrame('strokeText'),shadows:perFrame('shadowedOps'),saves:perFrame('save'),restores:perFrame('restore')};
        }
      } else summary.draw = draw;
      console.log(JSON.stringify(summary));
      if (errors.length) throw new Error(errors.join('\n'));
    }
    if (requested.includes('H')) {
      await page.evaluate(() => window.YOKAI_PERF.configure({rank:5,gems:512}));
      for (let minutes=5;minutes<=20;minutes+=5) {
        await page.waitForTimeout(300_000);
        const {frame,state} = await page.evaluate(() => window.YOKAI_PERF.report());
        console.log(JSON.stringify({name:'H',minutes,frame,state,errors}));
        if (errors.length) throw new Error(errors.join('\n'));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
