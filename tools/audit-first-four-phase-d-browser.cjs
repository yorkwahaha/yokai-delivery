'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { stages } = require('./measure-first-four-phase-b.cjs');

const root = path.resolve(__dirname, '..');
const port = process.env.YOKAI_PHASE_D_PORT || '18790';
const origin = 'http://127.0.0.1:' + port;
const label = process.argv[2] || 'after';
const output = path.join(root, 'scratch/phase-d-20261125', label);
const marker = '    window.YOKAI_PERF = api;';
const baselineFiles = {
  '/index.html':'index.html','/':'index.html','/js/game.js':'game.js',
  '/js/audio.js':'audio.js','/js/renderer.js':'renderer.js','/js/ui-upgrade-trial.js':'ui-upgrade-trial.js'
};

// Only the intercepted audit response includes these fixtures. State setup
// uses the actual game functions and the normal world and panel renderers.
const hooks = `
    const auditAdvance = seconds => {
      for (let i = 0; i < Math.round(seconds / .05); i++) update(.05);
    };
    api.auditState = () => ({
      state, x:P.x, y:P.y, elapsed, level, oil, rerolls, focus:levelupFocus, dashT, levelupCooldown,
      inputMode, pausePage, quitConfirm, joy:!!joy, job:!!job, bossQ:!!bossQ,
      choices:choices.map(c=>[c.id,c.lv]), keys:[...keys],
      bosses:enemies.filter(e=>e.type==="boss").map(e=>[e.title,e.hazard?.kind,e.hazard?.phase]),
      mobs:enemies.filter(e=>e.type!=="boss").length,
      gems:gems.length, xpInGems:gems.reduce((sum,g)=>sum+g.v,0),
      charmDrops:charmDrops.length, props:solids.length, surgeWarningT, xy:[P.x,P.y],
      art:RENDERER.performanceStats?.()
    });
    api.auditReset = id => {
      window.auditSeed();
      window.VIEWPORT.setTiltScale(.60);
      for (const prior of ['night-town','rain-port','sakura-pass','bamboo-maze']) {
        if (prior===id) break;
        STORE.finish(prior,100,6,true);
      }
      start(id);
      titleCardT=0;
      spawnT=bossT=surgeT=Infinity;
      fadeT=0;
      RENDERER.clearShake();
    };
    api.auditReady = () => !artPending();
    api.auditView = tilt => {
      const view=window.VIEWPORT;
      const before=view.tiltScale(),zoom=view.worldZoom();
      view.setTiltScale(tilt);
      const camera=view.reanchor(P,RENDERER.getCam(),before,zoom,tilt,view.worldZoom());
      if(camera)RENDERER.setCam(camera.x,camera.y);
    };
    let auditFinishScene = null;
    api.auditFinish = () => {
      window.auditSeed();
      auditFinishScene?.();
      auditFinishScene=null;
    };
    api.auditScene = scene => {
      window.auditSeed();
      auditFinishScene=null;
      if (scene==='opening') return;
      if (scene==='upgrade'||scene==='upgrade-full') {
        if(scene==='upgrade-full'){
          Object.assign(WL,{katana:3,fire:3,needle:3,barrier:3});
          rerolls=0;inputMode='keyboard';
        }
        xp=xpNeed();offerUp();return;
      }
      if (scene==='result') {
        elapsed=442;delivered=4;failed=1;score=480;oil=0;
        loseRun();updateLampSequence(5);return;
      }
      if (scene==='charm') {
        for(const id of CHARM_IDS.slice(0,3)) addCharm(id);
        openCharmSwap(CHARM_IDS[3]); return;
      }
      if (scene==='win') {
        delivered=GOAL_DELIVERIES;
        finalBossDefeated=true;
        startVictorySequence();
        for(let i=0;i<300&&state==='victory';i++) updateVictorySequence(.05);
        return;
      }
      const carrying=['delivery','quiz','dense'].includes(scene);
      if (carrying) {
        orders=[]; makeOrder();
        if(!orders[0]) throw Error('No audit order: '+STAGE.id);
        inter=orders[0]; interact();
        if(scene==='quiz') {
          const a=ansPos(job.to)[0];
          P.x=a.x;P.y=a.y; P.inv=8;
          auditAdvance(.15);
          return;
        }
        if(scene==='delivery') return;
        job.readClosed=true;
        nameT=0;
      }
      elapsed=scene==='mid' ? 190 : scene==='boss'||scene==='seal' ? 215 : 480;
      level=scene==='mid'?11:24;
      const isDense=scene==='dense';
      const home={x:P.x,y:P.y};
      if(['boss','seal','dense'].includes(scene)){
        const bosses=[];
        for (const wave of isDense ? [0,1] : [0]) {
          enemies=[];bossStage=wave;bossT=0;
          // Scripted time is inside the fixture only. Let the normal scheduler construct the Boss.
          const oldTime=elapsed;
          elapsed=Math.max(elapsed,BOSS_TIMES[wave]+1);
          for(let i=0;i<110&&!enemies.some(e=>e.type==='boss');i++) auditAdvance(.05);
          const boss=enemies.find(e=>e.type==='boss');
          if(!boss) throw Error('Boss did not spawn: '+STAGE.id+' '+scene+' wave '+wave);
          elapsed=oldTime;
          const side=wave===0?1:-1;
          const offsets=[[170*side,32],[112*side,75],[0,-140],[0,140]];
          const [dx,dy]=offsets.find(([x,y])=>!blocked(home.x+x,home.y+y,52))||offsets.at(-1);
          Object.assign(boss,{x:home.x+dx,y:home.y+dy,shield:scene==='seal',attackCd:0});
          bosses.push(boss);
        }
        enemies=bosses;bossT=Infinity;
        if(scene==='seal'){auditAdvance(.7);return;}
      }
      if(scene==='mid'||scene==='dense'||scene.startsWith('surge')){
        const target=scene==='mid'?18:MOB_DIFFICULTY.cap+enemies.length;
        for(let i=0;i<900&&enemies.length<target;i++)
          spawnEnemy(4,(scene==='mid'?190:135)+(i%31)*11,i*2.39996323,false,true);
        // Same ordinary monsters survive the burst in both comparison images.
        if(isDense)for(const e of enemies)if(e.type!=='boss')e.hp=e.max=9999;
      }
      P.inv=7;
      const build=scene==='mid'?{katana:3,fire:2}:{katana:5,barrier:5,fire:5,[STAGE.id==='night-town'?'thunder':'ink_trail']:5};
      for(const [id,lv] of Object.entries(build)){WL[id]=lv;wT[id]=0;window.useSkillArt?.(id,lv);}
      auditFinishScene=()=>{
        if(scene.startsWith('surge')){
          surgeT=0;auditAdvance(scene==='surge' ? 2.65 : .1);
        } else {
          auditAdvance(.3);
        }
        if(isDense){
          gems=[];
          for(let i=0;i<512;i++){
            const a=i*2.39996323,r=100+Math.sqrt(i)*10;
            dropGem(home.x+Math.cos(a)*r,home.y+Math.sin(a)*r*.65,1);
          }
          for(let i=0;i<512;i++)dropGem(home.x+240+(i%25)*2,home.y-85+Math.floor(i/25)*4,2);
          spawnCharmDrop(home.x+90,home.y+44,'charm_guard');
          P.inv=0;hurtPlayer(4);RENDERER.clearShake();
        }
      };
    };
    api.auditPanel = name => {
      if(name==='home')returnHome();
      else if(name==='map'||name==='locked'||name==='unlocked'){
        enterOverworld();
        if(name!=='map'){
          const node=window.OVERWORLD.STAGE_NODES.find(n=>n.stageId==='bamboo-maze');
          window.OVERWORLD.inspect(overworld,node.id);
        }
      }
      else if(name==='controls')activateMenu('controls');
      else {
        if(state==='play')togglePause();
        if(name==='settings')activateMenu('settings');
        if(name==='quit')activateMenu('menu');
      }
    };
    api.auditInput = (action) => {
      if(action==='step')auditAdvance(.2);
      if(action==='tap')auditAdvance(.05);
      if(action==='choose')return UI.levelUpLayout(choices.length);
      if(action==='bossAnswer')return bossQ?.ans.indexOf(bossQ.word);
      if(action==='deliveryAnswer'){
        const at=job.ans.indexOf(job.word),a=ansPos(job.to)[at];
        P.x=a.x;P.y=a.y;job.lock=0;auditAdvance(.8);
      }
      if(action==='hold')api.configure({hold:true});
    };
`;

const waitReady = page => page.waitForFunction(() => window.YOKAI_PERF?.auditReady());
const state = page => page.evaluate(() => window.YOKAI_PERF.auditState());
const command = (page, action) => page.evaluate(action=>window.YOKAI_PERF.auditInput(action),action);
const canvasPoint=(page,x,y)=>page.evaluate(([x,y])=>{
  const v=window.VIEWPORT.get(),r=document.querySelector('#game').getBoundingClientRect();
  return [r.left+(v.offsetX||0)+x*v.scale,r.top+(v.offsetY||0)+y*v.scale];
},[x,y]);
const setPad = (page, button, x=0, y=0) => page.evaluate(([button,x,y]) => {
  window.auditPad = {connected:true, axes:[x,y,0,0], buttons:Array.from({length:16},(_,i)=>({pressed:i===button}))};
},[button,x,y]);

async function open(browser, size, touch, baseline) {
  const context = await browser.newContext({viewport:size,deviceScaleFactor:touch?2:1,hasTouch:touch,serviceWorkers:'block'});
  const page = await context.newPage();
  const faults=[], missing=new Map();
  page.on('pageerror', error=>faults.push(error.message));
  page.on('console', message=>{
    if(message.type()==='error'&&message.text().includes('遊戲迴圈發生錯誤')) faults.push(message.text());
  });
  page.on('response', r=>{
    const key=new URL(r.url()).pathname;
    if(r.status()>=400)missing.set(key,(missing.get(key)||0)+1);
  });
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    const prior=baseline[baselineFiles[url.pathname]];
    if(url.pathname!=='/js/game.js'){
      if(prior)return route.fulfill({body:prior,contentType:url.pathname.startsWith('/js/')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});
      return route.continue();
    }
    const response=await route.fetch(),js=await response.text();
    const source=prior||js;
    assert.ok(source.includes(marker));
    return route.fulfill({response,body:source.replace(marker,marker+hooks)
      .replace('if (PERF_DEBUG && screen === "run") {','if (false) {')});
  });
  await page.addInitScript(()=>{
    localStorage.setItem('yokai-tutorial-v1','"skip"');
    window.auditSeed=()=>{
      let seed=117;
      Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    };
    window.auditSeed();
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.auditPad||null]});
  });
  await page.goto(origin+'/?dev=1&stageLab=1&perf=1',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:'#dev-stage-picker,details:has([aria-label="效能實驗條件"]){display:none!important}'});
  await waitReady(page);
  // Keep Web Audio's synthesis RNG out of the visual A/B. The stress
  // harness measures live audio requests separately.
  await page.evaluate(()=>{if(!window.AUDIO.isMuted())window.AUDIO.toggleMute();});
  await command(page,'hold');
  return {context,page,faults,missing};
}

async function shot(page, name) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('#game').screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:88});
}
async function fixture(page,id,scene) {
  await page.evaluate(id=>window.YOKAI_PERF.auditReset(id),id);
  await waitReady(page);
  await page.evaluate(scene=>window.YOKAI_PERF.auditScene(scene),scene);
  await waitReady(page);
  await page.evaluate(()=>window.YOKAI_PERF.auditFinish());
}
async function inputChecks(page) {
  await fixture(page,'night-town','opening');
  const evidence={};
  const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{evidence[name]=true;},error=>{evidence[name]=error.message;});
  await check('WASD + Space',async()=>{
    for(const [key,axis,sign] of [['d','x',1],['a','x',-1],['w','y',-1],['s','y',1]]){
      const before=await state(page);await page.keyboard.down(key);await command(page,'step');await page.keyboard.up(key);
      assert.ok(((await state(page))[axis]-before[axis])*sign>1,key);
    }
    await page.keyboard.down('Space');await command(page,'tap');
    await page.keyboard.up('Space');
    assert.ok((await state(page)).dashT>0);
  });
  await check('pause / blur / focus',async()=>{
    await page.keyboard.down('d');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal((await state(page)).state,'pause');assert.deepEqual((await state(page)).keys,[]);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.keyboard.up('d');await page.keyboard.press('Escape');
    assert.equal((await state(page)).state,'play');
    await page.keyboard.press('Escape');assert.equal((await state(page)).state,'pause');
    await page.keyboard.press('Escape');assert.equal((await state(page)).state,'play');
  });
  await check('gamepad view + card + reroll + keyboard restores movement',async()=>{
    await page.evaluate(()=>window.YOKAI_PERF.auditView(.60));
    await setPad(page,11);await page.waitForFunction(()=>window.VIEWPORT.tiltTargetScale()===1,undefined,{timeout:2500})
      .catch(()=>assert.fail('R3 did not switch view'));
    await setPad(page,-1);await fixture(page,'night-town','upgrade');
    await page.keyboard.press('Space');assert.equal((await state(page)).state,'levelup');
    await page.waitForFunction(()=>window.YOKAI_PERF.auditState().levelupCooldown<=0);
    await setPad(page,3);await page.waitForFunction(()=>window.YOKAI_PERF.auditState().rerolls===1,undefined,{timeout:2500})
      .catch(()=>assert.fail('Y did not reroll'));
    const oldFocus=(await state(page)).focus;
    await setPad(page,-1,oldFocus>0?-1:1,0);
    await page.waitForFunction(old=>window.YOKAI_PERF.auditState().focus!==old,oldFocus,{timeout:2500})
      .catch(()=>assert.fail('stick did not move card focus'));
    await setPad(page,-1);await page.waitForFunction(()=>window.YOKAI_PERF.auditState().levelupCooldown<=0);
    await setPad(page,0);await page.waitForFunction(()=>window.YOKAI_PERF.auditState().state==='play',undefined,{timeout:2500})
      .catch(()=>assert.fail('A did not select card'));
    await setPad(page,-1);
    const before=await state(page);
    await page.keyboard.down('d');await command(page,'step');await page.keyboard.up('d');
    assert.ok((await state(page)).x>before.x);
  });
  await check('touch card and joystick cancel',async()=>{
    await fixture(page,'night-town','upgrade');
    const L=await command(page,'choose');
    const coords=await canvasPoint(page,L.cards[0].x+L.card.w/2,L.cards[0].y+L.card.h/2);
    await page.waitForFunction(()=>window.YOKAI_PERF.auditState().levelupCooldown<=0);
    await page.touchscreen.tap(...coords);
    assert.equal((await state(page)).state,'levelup');
    await page.keyboard.press('d');
    assert.equal((await state(page)).focus,1);
    await page.touchscreen.tap(...coords);
    if(label!=='before')assert.equal((await state(page)).state,'levelup');
    if((await state(page)).state==='levelup')await page.touchscreen.tap(...coords);
    assert.equal((await state(page)).state,'play');
    const before=await state(page);
    await page.locator('#game').dispatchEvent('pointerdown',{pointerId:4,pointerType:'touch',clientX:190,clientY:420});
    await page.locator('#game').dispatchEvent('pointermove',{pointerId:4,pointerType:'touch',clientX:250,clientY:420});
    await command(page,'step');assert.ok((await state(page)).x>before.x);
    await page.locator('#game').dispatchEvent('pointercancel',{pointerId:4,pointerType:'touch'});
    assert.equal((await state(page)).joy,false);
  });
  await check('delivery and charm resume',async()=>{
    await fixture(page,'night-town','quiz');assert.equal((await state(page)).job,true);
    await command(page,'deliveryAnswer');assert.equal((await state(page)).job,false);
    await fixture(page,'night-town','charm');assert.equal((await state(page)).state,'charmswap');
    await page.keyboard.press('Enter');assert.equal((await state(page)).state,'play');
    const before=await state(page);
    await page.keyboard.down('d');await command(page,'step');await page.keyboard.up('d');
    assert.ok((await state(page)).x>before.x);
  });
  await check('gamepad Boss seal and keyboard movement',async()=>{
    await fixture(page,'night-town','seal');
    const ix=await command(page,'bossAnswer');assert.ok(ix>=0);
    await setPad(page,[4,5,3][ix]);await page.waitForFunction(()=>!window.YOKAI_PERF.auditState().bossQ,undefined,{timeout:2500});
    await setPad(page,-1);
    const before=await state(page);
    await page.keyboard.down('a');await command(page,'step');await page.keyboard.up('a');
    assert.ok((await state(page)).x<before.x);
  });
  await check('simultaneous gamepad and keyboard input',async()=>{
    await fixture(page,'night-town','opening');
    const start=await state(page);
    await page.keyboard.down('d');await setPad(page,-1,-1,0);
    await page.waitForFunction(()=>window.YOKAI_PERF.auditState().inputMode==='gamepad');
    await command(page,'step');
    const left=await state(page);assert.ok(left.x<start.x);
    await setPad(page,-1);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await command(page,'step');await page.keyboard.up('d');
    assert.ok((await state(page)).x>left.x);
  });
  return evidence;
}

async function main() {
  await mkdir(output,{recursive:true});
  const baseline={};
  if(label==='before'&&process.env.YOKAI_D_BASELINE){
    for(const file of new Set(Object.values(baselineFiles)))
      baseline[file]=await readFile(path.join(process.env.YOKAI_D_BASELINE,file),'utf8');
  }
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
    const report={chrome:browser.version(),stages:{},panels:{},inputs:{}};
    const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
    for(const id of process.env.YOKAI_D_INPUT_ONLY?[]:stages){
      const {context,page,faults,missing}=await open(browser,{width:1194,height:834},true,baseline);
      const rows=report.stages[id]={scenes:{},faults};
      for(const scene of ['opening','delivery','mid','surge-warning','surge','boss','dense','upgrade','result']){
        if(label!=='before' && process.env.YOKAI_D_QUICK && !['dense','upgrade'].includes(scene))continue;
        await fixture(page,id,scene);
        rows.scenes[scene]=await state(page);
        if(scene==='dense'){
          assert.equal(rows.scenes[scene].bosses.length,2);
          assert.equal(rows.scenes[scene].gems,512);
          assert.equal(rows.scenes[scene].xpInGems,1536);
        }
        if(scene==='surge-warning')assert.ok(rows.scenes[scene].surgeWarningT>0, id+' Hyakki warning did not fire');
        for(const [view,tilt] of [['tilt',.60],['flat',1]]){
          await page.evaluate(tilt=>window.YOKAI_PERF.auditView(tilt),tilt);
          await shot(page,id+'-'+scene+'-'+view);
        }
      }
      rows.missing=Object.fromEntries(missing);
      await save();await context.close();
      console.log(id,Object.keys(rows.scenes).join(','),'faults',faults.length);
      assert.equal(faults.length,0,JSON.stringify(faults));
    }
    for(const [name,size,touch] of [['tablet',{width:1194,height:834},true],['desktop',{width:1366,height:768},false],['phone',{width:740,height:360},true]]){
      if(process.env.YOKAI_D_INPUT_ONLY&&name!=='tablet')continue;
      const {context,page,faults,missing}=await open(browser,size,touch,baseline);
      for(const panel of ['home','map','locked','pause','settings','quit','controls']){
        if(['pause','settings','quit','controls'].includes(panel))await fixture(page,'bamboo-maze','opening');
        await page.evaluate(panel=>window.YOKAI_PERF.auditPanel(panel),panel);await waitReady(page);
        if(panel==='controls'){
          await page.screenshot({path:path.join(output,name+'-'+panel+'.jpg'),type:'jpeg',quality:88});
          await page.locator('#controls-dialog form button').click();
        }
        else await shot(page,name+'-'+panel);
      }
      if(name==='tablet')report.inputs=await inputChecks(page);
      for(const scene of ['upgrade','upgrade-full','charm','quiz','seal','win']){
        await fixture(page,scene==='win'?'sakura-pass':'bamboo-maze',scene);
        await shot(page,name+'-'+scene);
        if(name==='desktop'&&scene==='upgrade'){
          const {reroll}=await command(page,'choose');
          await page.mouse.move(...await canvasPoint(page,reroll.x+reroll.w/2,reroll.y+reroll.h/2));
          await shot(page,'desktop-reroll-hover');
        }
      }
      await page.evaluate(()=>window.YOKAI_PERF.auditPanel('unlocked'));
      await shot(page,name+'-unlocked');
      report.panels[name]={faults,missing:Object.fromEntries(missing)};
      await save();await context.close();
      assert.equal(faults.length,0,JSON.stringify(faults));
    }
  }finally{
    await browser?.close();
    server.kill();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
