'use strict';

const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const Module = require('node:module');
const sourcePath = require.resolve('./audit-first-four-browser-20261125.cjs');
const mode = process.argv[2] || 'current';
assert.ok(['original','current','skills'].includes(mode));
const audit = new Module(sourcePath,module);
audit.filename = sourcePath;
audit.paths = module.paths;
let source = readFileSync(sourcePath,'utf8');

function replace(before,after){
  assert.equal(source.split(before).length,2,before);
  source=source.replace(before,()=>after);
}

replace("'docs/first-four-stages-audit-20261125'","'scratch/phase-b-20261125/chrome-"+mode+"'");
replace('for(let i=0;i<30;i++)','for(let i=0;i<113;i++)');
replace(source.slice(source.indexOf('      WL.katana=WL.barrier=5;'),source.indexOf('      for(const id of Object.keys(WL))')), `
      WL.needle=WL.boom=5;
      if(index===0){ WL.katana=WL.barrier=5; }
      if(index===1){ WL.fire=WL.thunder=5; }
      if(index===2){ WL.seal_nail=WL.ink_trail=5; }
      if(index===3){ WL.barrier=WL.shikigami=5; }
`);
replace('    api.auditOffer=()=>',`
    api.phaseBStress=()=>{
      const total=()=>gems.reduce((sum,g)=>sum+(g.done?0:g.v),0);
      const count=()=>gems.filter(g=>!g.done).length;
      const before={count:count(),xp:total()};
      for(let i=0;i<512;i++){
        const a=i*2.39996323,r=180+Math.sqrt(i)*9;
        dropGem(P.x+Math.cos(a)*r,P.y+Math.sin(a)*r,2);
      }
      // Leave normal pickup and XP credit enabled during the stress window.
      // A high test-only level keeps an upgrade overlay from pausing combat.
      level=200;
      xp=0;
      return {before,after:{count:count(),xp:total()},enemies:enemies.length,startElapsed:elapsed};
    };
    api.auditOffer=()=>`);

if(mode==='skills'){
  replace("const stages = ['night-town', 'rain-port', 'sakura-pass', 'bamboo-maze'];",
          "const stages = ['bamboo-maze'];");
  replace('    api.auditOffer=()=>',`
    let phaseBStart;
    api.phaseBSkillPrepare=(id,rank)=>{
      phaseBStart ??= {x:P.x,y:P.y};
      Object.assign(P,phaseBStart);
      proj=[]; needles=[]; needleQueued=[]; winds=[]; ghosts=[];
      dragonShots=[]; dragonScorches=[]; barrierPulses=[]; sacredSanctuary=null;
      splitblasts=[]; boomLv5BurstFx=[]; rings=[]; texts=[]; gems=[];
      fAng=0; atkT=0; fireEmitT=0; fireAttackT=0;
      inkTrail.reset(); sealNail.reset(); shikigami?.reset();
      FX.reset?.(); SKILLFX.reset();
      titleCardT=0; elapsed=0;
      for(const name of Object.keys(WL)){ WL[name]=0; wT[name]=0; }
      if(id){ WL[id]=rank; window.useSkillArt?.(id,rank); }
      enemies=Array.from({length:12},(_,i)=>({
        x:P.x+44+i*16, y:P.y+(i%4-1)*32, type:'ghost', hp:99999,max:99999,flash:0,wob:0
      }));
    };
    api.phaseBSkillStep=(id)=>{
      const start={x:P.x,y:P.y};
      P.x+=5; P.faceAng=0; elapsed+=.05;
      const t=performance.now();
      if(id)weapons(.05,{start,end:{x:P.x,y:P.y}});
      FX.update(.05); SKILLFX.update(.05);
      return performance.now()-t;
    };
    api.auditOffer=()=>`);
}

if(mode==='original'){
  replace('const js = await response.text();',`
        let js = await response.text();
        for(const [changed,original] of [
          ['const a = near?.type === "boss" ? Math.atan2(near.y - originY, near.x - originX) : queued.angle;', 'const a = queued.angle;'],
          ['const near = queued.focus && window.GAME_COMBAT_MATH.nearestLaunchTarget(enemies, P, 240);',''],
          ['const near = !spec.hasReturn && window.GAME_COMBAT_MATH.nearestLaunchTarget(enemies, P, 240);',''],
          ['shootAng = near?.type === "boss" ? Math.atan2(near.y - P.y, near.x - P.x) : P.faceAng || 0;', 'shootAng = P.faceAng || 0;'],
          ['spec, volley, focus: i === 5 && !spec.hasReturn', 'spec, volley'],
          ['hurt(primary, q.closeBossAttach ? full * 1.55 : full);','hurt(primary, full);'],
          ['if (rank === 5 && e.type === "boss" && q.t * q.speed <= 145) q.closeBossAttach = true;', '']
        ]){
          assert.ok(js.includes(changed),changed);
          js=js.replace(changed,original);
        }`);
}

replace('      await page.waitForTimeout(2300);',`
      const stress = await page.evaluate(() => window.YOKAI_PERF.phaseBStress());
      assert.equal(stress.before.count,512);
      assert.equal(stress.after.count,512);
      assert.equal(stress.after.xp-stress.before.xp,1024);
      await page.evaluate(() => {
        window.phaseBStart=performance.now();
        window.YOKAI_PERF.configure({hold:false});
      });
      await page.waitForTimeout(6800);
      const live = await page.evaluate(() => {
        const frames=performance.getEntriesByType('long-animation-frame')
          .filter(frame=>frame.startTime>=window.phaseBStart);
        return {
          ...window.YOKAI_PERF.report(),
          longFrames: frames.map(frame => ({
            duration:Math.round(frame.duration),
            scriptMs:Math.round(frame.scripts.reduce((sum,script)=>sum+script.duration,0)),
          })),
        };
      });
      assert.equal(live.state.gameState,'play');
      assert.ok(live.state.elapsed-stress.startElapsed>=4,JSON.stringify(live.state));
      await page.evaluate(() => window.YOKAI_PERF.configure({hold:true}));
      await page.waitForTimeout(2300);`);
replace('results.push({ stage, fixture, frame:', 'results.push({ stage, fixture, stress, live, frame:');
if(mode==='skills'){
  replace('const js = await response.text();',
    "const js = (await response.text()).replace('createDiagnostics({snapshot:perfSnapshot})','createDiagnostics({sampleEvery:6,snapshot:perfSnapshot})');");
  const start=source.indexOf('      await page.waitForTimeout(1100);');
  const end=source.indexOf('      await context.close();',start);
  assert.ok(start>=0&&end>start);
  replace(source.slice(start,end),`
      const skills=['katana','barrier','fire','boom','thunder','needle','ink_trail','seal_nail','shikigami'];
      for(const [id,rank] of [[null,0], ...skills.flatMap(id=>[1,2,3,4,5].map(rank=>[id,rank]))]){
        await page.evaluate(([id,rank])=>{
          const api=window.YOKAI_PERF;
          api.configure({hold:true,detail:true});
          api.phaseBSkillPrepare(id,rank);
        },[id,rank]);
        await page.waitForFunction(()=>window.YOKAI_PERF.auditReady());
        const profile=await page.evaluate(async id=>{
          const api=window.YOKAI_PERF;
          api.configure({hold:true,detail:true});
          const samples=[];
          let peakParticles=0;
          for(let i=0;i<42;i++){
            await new Promise(requestAnimationFrame);
            samples.push(api.phaseBSkillStep(id));
            peakParticles=Math.max(peakParticles,window.FX.stats().particles);
          }
          const result=api.report();
          return {frame:result.frame,draw:result.draw,level:result.state.levels[id],
            peakParticles,weaponCpuMs:samples.reduce((a,b)=>a+b,0),elapsed:result.state.elapsed};
        },id);
        assert.ok(!id || profile.level===rank,JSON.stringify(profile));
        assert.ok(profile.draw.sampledFrames>=5,JSON.stringify(profile.frame));
        results.push({id,rank,...profile});
      }
      await writeFile(path.join(evidence,'browser.json'),JSON.stringify({browser:browser.version(),results,faults},null,2));
      assert.ok(!faults.length,JSON.stringify(faults));
`);
  replace("    assert.ok(results.every(result => !result.faults.length));","    assert.equal(results.length,46);");
  replace("      console.log(stage, JSON.stringify({ bosses: fixture.boss, fps: before.frame.fps, faults, misses: responses.size }));",
    "      console.log(stage, results.length + ' Canvas profiles');");
}
audit._compile(source,sourcePath);
