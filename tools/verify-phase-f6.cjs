"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {spawnSync} = require("node:child_process");
const {chromium} = require("playwright");
const expansion = require("../js/game-skill-expansion.js");

const origin = process.env.YOKAI_F6_ORIGIN || "http://127.0.0.1:8046";
const out = path.resolve("scratch/phase-f456/f6");
const stages = ["night-town","rain-port","sakura-pass","bamboo-maze","hyakki-kyoto","snow-temple","spirit-ferry","yomi"];
const viewports = {pc:{width:1280,height:800}, tablet:{width:1180,height:820}, phone:{width:844,height:390}};
const officialKey = "yokai-delivery-v1";
const officialValue = JSON.stringify({progress:{completed:{"bamboo-maze":true}}});
const query = "/?dev=1&s3play=1&stageLab=1&bossLab=1&stage=";
const hook = `
  window.F6 = {
    ready() {
      return state==="play" && bossLabRun && !artPending() &&
        bossSchedule.liveOfficialBosses(enemies).length===3;
    },
    profile() {
      job=null; orders=[]; inter=null;
      spawnT=surgeT=orderT=Infinity;
      P.inv=Infinity;
      const gemOffset = getEffectiveMagnetRadius() + 45;
      for (const boss of bossSchedule.liveOfficialBosses(enemies)) boss.quizClosed = true;
      for(let i=0;i<512;i++) dropGem(P.x+gemOffset+(i%25)*3,P.y+74+(i/25|0)*3,2);
      for(let i=0;i<128;i++) {
        const a=2*Math.PI*i/128, r=240+i%5*13;
        enemies.push({type:"ghost",x:P.x+Math.cos(a)*r,y:P.y+Math.sin(a)*r,
          hp:500,max:500,speed:8,flash:0,slowT:0,wob:i,stageId:STAGE.id});
      }
      return this.stats();
    },
    stats() {
      return {elapsed,gems:gems.length,enemies:enemies.filter(e=>e.hp>0).length,
        bosses:bossSchedule.liveOfficialBosses(enemies).length,state};
    },
    ranks() {
      const skills=Object.keys(WI).filter(id=>!id.startsWith("fusion_"));
      const bySkill={}, rule=window.GAME_BUILD_RULES;
      let ranks=0, pairs=0, mutations=0;
      for (const id of skills) {
        const candidates=Object.keys(MUTATION_CONFIG).filter(key=>
          MUTATION_CONFIG[key].skillId===id && MUTATION_CONFIG[key].inPool);
        if (candidates.length!==4) throw Error(id+" has "+candidates.length+" variants");
        const allowed=[];
        for(const [i,a] of candidates.entries()) for(const b of candidates.slice(i+1))
          if(rule.canAddMutation(b,[a],MUTATION_CONFIG,{[id]:1},2)) allowed.push([a,b]);
        mutations+=candidates.length;
        for(let level=1;level<=5;level++){
          for(const variants of [[],...candidates.map(key=>[key]),...allowed]){
            const spec=resolveAttackSpec(id,level,{...combatBuildState(),mutations:variants});
            if(spec.skillId!==id || spec.level!==level ||
              Object.values(spec).some(v=>typeof v==="number" && !Number.isFinite(v))) throw Error(id+" invalid spec");
          }
          ranks++;
          pairs+=allowed.length;
        }
        bySkill[id]={mutations:candidates,pairs:allowed};
      }
      const all=Object.values(bySkill).flatMap(row=>row.mutations);
      let crossSkillPairs=0;
      const excludedCrossPairs=[];
      for (const [i,a] of all.entries()) for (const b of all.slice(i+1)) {
        const first=MUTATION_CONFIG[a].skillId, second=MUTATION_CONFIG[b].skillId;
        if (first===second) continue;
        const levels={[first]:5,[second]:5};
        const forward=rule.canAddMutation(b,[a],MUTATION_CONFIG,levels,2);
        const reverse=rule.canAddMutation(a,[b],MUTATION_CONFIG,levels,2);
        if (forward!==reverse) throw Error(a+" / "+b+" inconsistent mutation ordering");
        if (!forward) {
          const family=MUTATION_CONFIG[a].family;
          if (!family || family!==MUTATION_CONFIG[b].family) throw Error(a+" / "+b+" invalid exclusion");
          excludedCrossPairs.push({a,b,family});
          continue;
        }
        for (const id of [first,second]) {
          const spec=resolveAttackSpec(id,5,{...combatBuildState(),mutations:[a,b]});
          if (spec.skillId!==id || spec.level!==5) throw Error(a+" / "+b+" invalid joint spec");
        }
        crossSkillPairs++;
      }
      return {ranks,mutations,pairs,crossSkillPairs,excludedCrossPairs,bySkill};
    },
    flow() {
      tutorial = null; job = null; orders = []; inter = null;
      spawnT = surgeT = orderT = Infinity;
      const studyStart=delivered;
      makeOrder();
      inter=orders[0];
      interact();
      if (!job) throw Error("Cannot take delivery in "+STAGE.id);
      const correctDelivery=job.ans.indexOf(job.word);
      resolve(correctDelivery);
      const delivery=delivered-studyStart;
      const starting=bossSchedule.liveOfficialBosses(enemies);
      const waves=starting.map(b=>[b.bossIndex,blocked(b.x,b.y,20)]);
      // Open a slot at the dusk gate with the real defeat/respawn logic.
      const first=starting[0];
      first.shield=false;first.revealT=0;
      hurt(first,first.hp*2);
      elapsed=Math.max(elapsed,BOSS_TIMES[3]+.03);
      for(let i=0;i<12;i++) {
        if(bossSchedule.liveOfficialBosses(enemies).some(e=>e.final)) break;
        update(.05);
      }
      const final=bossSchedule.liveOfficialBosses(enemies).find(e=>e.final);
      if(!final) throw Error("Tail wave failed in "+STAGE.id);
      waves.push([final.bossIndex,blocked(final.x,final.y,20)]);
      final.shield=true;
      P.x=final.x;P.y=final.y;
      const words=answerChoices(final.word);
      bossQ=final.quiz={word:final.word,ans:words,wrong:[],lock:0};
      answerBoss(words.findIndex(w=>w!==final.word));
      const curse=bossCurseRemaining;
      bossCurseRemaining=bossQ.lock=0;
      answerBoss(words.indexOf(final.word));
      const broken=!final.shield;
      let endingCue=0;
      const ending=AUDIO.startStageEnding;
      if(ending) AUDIO.startStageEnding=function(...args){endingCue++; return ending.apply(this,args);};
      try {
        for(const boss of bossSchedule.liveOfficialBosses(enemies)){
          boss.shield=false;boss.revealT=0;
          hurt(boss,boss.hp*2);
        }
        const entered=state;
        for(let i=0;i<45 && state==="victory";i++) updateVictorySequence(.5);
        return {waves,delivery,curse,broken,entered,result:state,endingCue,clear:STORE.isStageCompleted(STAGE.id)};
      } finally { if(ending) AUDIO.startStageEnding=ending; }
    },
    lossAndRelease() {
      const id=STAGE.id, art=stageLabArtFor(id);
      const hadTerrain=!!art?.terrain?.(0);
      const s2=window.S2_ART_PROD_CACHE;
      const hadRain=!!s2?.loaded;
      enterOverworld();
      const released=art ? hadTerrain && !art.terrain(0) : null;
      const rainReleased=id==="rain-port" && hadRain
        ? !s2.loaded && !s2.buildings.length && !s2.tiles.stoneVariants.length : null;
      start(id);
      tutorial=null;
      P.inv=0;
      b.shield=0;
      hurtPlayer(oil + 100);
      for(let i=0;i<30 && state==="lampout";i++) updateLampSequence(.2);
      return {released,rainReleased,result:state};
    }
  };
`;

function save(report) {
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
}
async function pageFor(browser, mode, useHook) {
  const page = await browser.newPage({viewport:viewports[mode],hasTouch:mode!=="pc",serviceWorkers:"block"});
  const faults=[], missing=[];
  page.on("pageerror",e=>faults.push(e.message));
  page.on("console",msg=>{
    if(msg.type()==="error") faults.push(msg.text());
  });
  page.on("response",res=>{
    if (res.url().startsWith(origin) && res.status()>=400) missing.push([res.status(),new URL(res.url()).pathname]);
  });
  await page.addInitScript(([key,value])=>localStorage.setItem(key,value),[officialKey,officialValue]);
  if(useHook) await page.route(/\/js\/game\.js\?/,async route=>{
    const source=fs.readFileSync("js/game.js","utf8").replaceAll("\r\n","\n");
    const marker="  requestAnimationFrame(frame);\n})();";
    assert.ok(source.includes(marker));
    await route.fulfill({body:source.replace(marker,hook+marker),contentType:"application/javascript"});
  });
  return {page,faults,missing};
}
async function enterStage(page, stage) {
  assert.equal((await page.goto(origin+query+stage,{waitUntil:"domcontentloaded"})).status(),200);
  const enter=page.getByRole("button",{name:"直接進關"});
  if(!await enter.isVisible()) await page.getByRole("button",{name:"開發選關"}).click();
  await enter.click();
  await page.waitForFunction(()=>window.F6?.ready(),undefined,{timeout:12000});
}
const shot = (page,name)=>page.locator("#game").screenshot({path:path.join(out,name+".jpg"),quality:90});
async function verifyStage(browser, stage, mode, report) {
  const {page,faults,missing}=await pageFor(browser,mode,true);
  try {
    await enterStage(page,stage);
    const flat=await page.evaluate(()=>{VIEWPORT.setTiltScale(1);return VIEWPORT.tiltScale();});
    if(stage==="rain-port" && mode==="phone") await shot(page,"rain-port-phone-flat-live");
    const tilted=await page.evaluate(()=>{VIEWPORT.setTiltScale(.6);return VIEWPORT.tiltScale();});
    if(stage==="rain-port" && mode==="phone") await shot(page,"rain-port-phone-tilt-live");
    const tilt=[flat,tilted];
    assert.deepEqual(tilt,[1,.6]);
    const flow=await page.evaluate(()=>window.F6.flow());
    assert.deepEqual(flow.waves,[[0,false],[1,false],[2,false],[3,false]],stage);
    assert.equal(flow.delivery,1);
    assert.equal(flow.curse,10);
    assert.equal(flow.broken,true);
    assert.equal(flow.entered,"victory");
    assert.equal(flow.result,"won");
    // Results save on the next live frame, after the victory sequence returns.
    await page.waitForFunction(id=>STORE.isStageCompleted(id),stage);
    flow.clear=true;
    if(stage==="yomi") assert.equal(flow.endingCue,1);
    if(mode==="pc" || stage==="yomi") await shot(page,stage+"-"+mode);
    const loss=await page.evaluate(()=>window.F6.lossAndRelease());
    assert.equal(loss.result,"lost");
    if(stages.indexOf(stage)>=4) assert.equal(loss.released,true);
    if(stage==="rain-port") assert.equal(loss.rainReleased,true);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),officialKey),officialValue);
    assert.deepEqual(faults,[]);
    assert.deepEqual(missing,[]);
    report.stageRuns.push({stage,mode,tilt,flow,loss,faults,missing});
  } finally { await page.close(); }
}
async function verifySkillLab(browser) {
  const {page,faults,missing}=await pageFor(browser,"tablet",true);
  try {
    await page.goto(origin+"/?dev=1&s3play=1&skillLab=expansion&draft=guided",{waitUntil:"domcontentloaded"});
    const lab=page.locator("#active-skill-lab");
    await lab.getByRole("button",{name:"開始／重置"}).tap();
    await page.waitForFunction(()=>ACTIVE_SKILL_LAB.snapshot().state==="play");
    const matrix = await page.evaluate(()=>window.F6.ranks());
    assert.equal(matrix.ranks,65);
    assert.equal(matrix.mutations,52);
    assert.equal(matrix.crossSkillPairs,1246);
    assert.equal(matrix.excludedCrossPairs.length,2);
    const art = await page.evaluate(async ()=>{
      const api=window.GAME_SKILL_EXPANSION;
      if(!await api.loadArt()) throw Error("Missing Skill Lab manifest");
      const {assets}=await fetch("art/skill-expansion-10-13/manifest.json").then(r=>r.json());
      let pixels=0, decoded=0;
      for (const [key,entry] of Object.entries(assets)) {
        const file=api.artPath(key);
        if(!file) throw Error(key);
        const request=await fetch(file);
        const bytes=await request.arrayBuffer();
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
        if(hash!==entry.sha256) throw Error(file);
        const sprite=new Image();sprite.src=file;await sprite.decode();
        pixels+=sprite.naturalWidth*sprite.naturalHeight*4;
        api.artImage(key);
        decoded++;
      }
      return {decoded,estimatedBeforeBytes:pixels,cache:api.cardCacheStats()};
    });
    assert.equal(art.decoded,41);
    assert.deepEqual(art.cache,{retained:10,limit:10,pinned:21});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),officialKey),officialValue);
    assert.deepEqual(faults,[]);
    assert.deepEqual(missing,[]);
    return {matrix,art};
  } finally { await page.close(); }
}
async function stress(browser) {
  const {page,faults,missing}=await pageFor(browser,"tablet",true);
  try {
    await enterStage(page,"rain-port");
    const before=await page.evaluate(()=>window.F6.profile());
    assert.equal(before.gems,512);
    assert.ok(before.enemies>=128);
    const stats=await page.evaluate(seconds=>new Promise(resolve=>{
      const intervals=[];
      let first,last;
      const frame=now=>{
        first??=now;
        if(last!==undefined)intervals.push(now-last);
        last=now;
        if(now-first<seconds*1000)requestAnimationFrame(frame);
        else {
          intervals.sort((a,b)=>a-b);
          resolve({frames:intervals.length,p95:intervals[Math.ceil(intervals.length*.95)-1],
            over50ms:intervals.filter(t=>t>50).length,after:window.F6.stats()});
        }
      };
      requestAnimationFrame(frame);
    }),Number(process.env.YOKAI_F6_STRESS_SECONDS||30));
    assert.equal(stats.after.state,"play");
    assert.equal(stats.after.gems,512);
    assert.equal(stats.after.bosses,3);
    assert.deepEqual(faults,[]);
    assert.deepEqual(missing,[]);
    await shot(page,"rain-port-stress");
    return {before,...stats};
  } finally { await page.close(); }
}
async function verifyWorker(browser) {
  const page = await browser.newPage({viewport:viewports.pc});
  try {
    await page.goto(origin,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    const samples=[
      "assets/img/vfx/enemies/yomi-cinder-burst/yomi-cinder-burst__impact.webp",
      expansion.sfxCatalog["ice_ball:shatter"].path
    ].map(file=>({file,sha256:createHash("sha256").update(fs.readFileSync(file)).digest("hex")}));
    const result=await page.evaluate(async samples=>{
      const cache=await caches.open("yokai-media-v1");
      const audio=new AudioContext();
      const results=[];
      try {
        for (const {file,sha256} of samples) {
          const key=new URL(file+"?revision="+sha256.slice(0,24),location.href).href;
          const response=await fetch(file);
          const bytes=await response.arrayBuffer();
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
            b=>b.toString(16).padStart(2,"0")).join("");
          const range=await fetch(file,{headers:{Range:"bytes=0-31"}});
          const art=new Image();
          if(file.endsWith(".mp3")) await audio.decodeAudioData(bytes);
          else { art.src=file; await art.decode(); }
          results.push({file,ok:hash===sha256,cacheHit:!!await cache.match(key),
            range:range.status,rangeBytes:(await range.arrayBuffer()).byteLength});
        }
        return results;
      } finally { await audio.close(); }
    },samples);
    for(const row of result) assert.deepEqual(
      {ok:row.ok,cacheHit:row.cacheHit,range:row.range,rangeBytes:row.rangeBytes},
      {ok:true,cacheHit:true,range:206,rangeBytes:32},row.file);
    return result;
  } finally { await page.close(); }
}
function verifyAudio() {
  const source=fs.readFileSync("js/audio.js","utf8");
  const base=Array.from(source.matchAll(/["'](assets\/audio\/bgm\/[a-z0-9/_-]+\.mp3)["']/g),m=>m[1]);
  const all=new Set([...base.filter(file=>fs.existsSync(file)),
    ...require("../js/stage58-audio.js").entries.map(row=>row.path),
    ...Object.values(expansion.sfxCatalog).map(cue=>cue.path)]);
  const results=[];
  for(const file of all) {
    const decode=spawnSync("ffmpeg",["-nostdin","-v","error","-xerror","-i",file,"-f","null","-"],{encoding:"utf8"});
    assert.equal(decode.status,0,`${file} ${decode.error || decode.stderr}`);
    results.push({file,sha256:createHash("sha256").update(fs.readFileSync(file)).digest("hex")});
  }
  return results;
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const report={origin,stageRuns:[]};
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try {
    report.browser=browser.version();
    for(const stage of stages) for(const mode of Object.keys(viewports)) {
      try { await verifyStage(browser,stage,mode,report); }
      catch (error) {
        report.failure={stage,mode,error:error.message};
        save(report);
        throw error;
      }
      save(report);
    }
    report.skills=await verifySkillLab(browser);
    save(report);
    report.stress=await stress(browser);
    save(report);
    report.worker=await verifyWorker(browser);
    save(report);
  } finally { await browser.close(); }
  report.audio=verifyAudio();
  save(report);
  console.log(JSON.stringify({stages:report.stageRuns.length,ranks:report.skills.matrix.ranks,
    mutations:report.skills.matrix.mutations,legalPairsAtFiveRanks:report.skills.matrix.pairs,
    legalCrossSkillPairs:report.skills.matrix.crossSkillPairs,
    images:report.skills.art.decoded,audio:report.audio.length,stress:report.stress}));
})().catch(error=>{console.error(error);process.exitCode=1;});
