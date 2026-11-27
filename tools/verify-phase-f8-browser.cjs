"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
const origin=process.env.YOKAI_F8_ORIGIN||"http://127.0.0.1:8049";
const out=path.resolve("scratch/phase-f8-20261127");
fs.mkdirSync(out,{recursive:true});
const hook=`
  window.F8={
    ready(){return state==="play" && bossLabRun && !artPending() && bossSchedule.liveOfficialBosses(enemies).length===3;},
    prepareReading(){
      tutorial=null; job=null; orders=[]; inter=null;
      spawnT=surgeT=orderT=Infinity; P.inv=Infinity;
      makeOrder(); inter=orders[0]; interact();
      if(!job) throw Error("no delivery fixture");
      P.x=job.to.x; P.y=job.to.y+75;
      job.hold=0; job.idx=-1;
      job.reading=true; job.barrierTimer=10;
      return {bosses:bossSchedule.liveOfficialBosses(enemies).length,answers:job.ans.length};
    },
    reading(){return !!job?.reading;},
  };
`;
(async()=>{
  const browser=await chromium.launch({headless:true});
  const results=[];
  try{
    for(const [mode,viewport] of Object.entries({pc:{width:1280,height:800},tablet:{width:1180,height:820},phone:{width:844,height:390}})){
      const page=await browser.newPage({viewport,hasTouch:mode!=="pc",serviceWorkers:"block"});
      const faults=[],missing=[];
      page.on("pageerror",e=>faults.push(e.message));
      page.on("response",res=>{if(res.url().startsWith(origin)&&res.status()>=400)missing.push([res.status(),new URL(res.url()).pathname]);});
      await page.route(/\/js\/game\.js\?/,async route=>{
        const source=fs.readFileSync("js/game.js","utf8").replaceAll("\r\n","\n"), marker="  requestAnimationFrame(frame);\n})();";
        assert.ok(source.includes(marker));
        await route.fulfill({body:source.replace(marker,hook+marker),contentType:"application/javascript"});
      });
      try{
        assert.equal((await page.goto(origin+"/?dev=1&s3play=1&stageLab=1&bossLab=1&bossStagger=1&stage=rain-port",{waitUntil:"domcontentloaded"})).status(),200);
        const enter=page.getByRole("button",{name:"直接進關"});
        if(!await enter.isVisible())await page.getByRole("button",{name:"開發選關"}).click();
        await enter.click();
        await page.waitForFunction(()=>window.F8?.ready(),undefined,{timeout:20000});
        const reading=await page.evaluate(()=>F8.prepareReading());
        assert.equal(reading.bosses,3);assert.ok(reading.answers>=3);
        for(const tilt of [1,.6]){
          await page.evaluate(t=>VIEWPORT.setTiltScale(t),tilt);
          await page.waitForTimeout(300);
          assert.equal(await page.evaluate(()=>F8.reading()),true);
          await page.locator("#game").screenshot({path:path.join(out,mode+"-"+tilt+".jpg"),quality:90});
        }
        assert.deepEqual(faults,[]);assert.deepEqual(missing,[]);
        results.push({mode,reading,tilts:[1,.6],faults,missing});
        console.log(mode,"PASS");
      }finally{await page.close();}
    }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
