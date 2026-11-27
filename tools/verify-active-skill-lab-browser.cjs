"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const {chromium} = require("playwright");

const pc = process.env.YOKAI_SKILL_LAB_PC || "http://127.0.0.1:8015";
const lan = process.env.YOKAI_SKILL_LAB_LAN || "http://192.168.50.107:8015";
const dir = "scratch/active-skill-expansion-browser";
const params = "/?dev=1&s3play=1&skillLab=expansion";
const key = "yokai-delivery-v1";
const sentinel = JSON.stringify({progress:{completed:{"bamboo-maze":true}}});
const label = {
  hamaya:"破魔・神弓", spider_silk:"絡新婦・妖絲", ice_ball:"冰魄・妖毬", wind_hole:"冥風・風穴"
};

async function fixture(browser, origin, width, height, touch) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,serviceWorkers:"block"});
  page.setDefaultTimeout(8500);
  const errors=[], badRequests=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("response",response=>{
    if (response.status()>=400 && response.url().startsWith(origin))
      badRequests.push([response.status(),new URL(response.url()).pathname]);
  });
  await page.addInitScript(([key,value])=>localStorage.setItem(key,value),[key,sentinel]);
  await page.goto(origin+params,{waitUntil:"domcontentloaded"});
  const lab=page.locator("#active-skill-lab");
  const book=page.locator(".yc-book[open]");
  const action=(name)=>lab.getByRole("button",{name});
  const press=loc=>touch ? loc.tap() : loc.click();
  const snapshot=()=>page.evaluate(()=>window.ACTIVE_SKILL_LAB.snapshot());
  async function show() {
    if (!await lab.evaluate(node=>node.open)) await press(lab.locator("summary"));
  }
  async function setup(levels, scene, stationary) {
    await show();
    for (const id of Object.keys(label)) await lab.getByLabel(label[id]+"等級",{exact:true}).selectOption("0");
    for (const [id,level] of Object.entries(levels)) {
      await lab.getByLabel(label[id]+"等級",{exact:true}).selectOption(String(level));
    }
    await lab.locator('select[name="scene"]').selectOption(scene);
    await lab.getByLabel("固定敵人位置").setChecked(stationary);
  }
  return {page,lab,book,press,action,show,setup,snapshot,errors,badRequests};
}

async function gameplay(browser) {
  const f=await fixture(browser,pc,1280,800,false);
  const {page,lab,book,action,press,show,setup,snapshot}=f;
  await setup({hamaya:5,ice_ball:5},"boss",true);
  await lab.getByText("百步穿楊",{exact:true}).click();
  await lab.getByText("雙弦追射",{exact:true}).click();
  assert.ok(await lab.locator('input[value="mut_hamaya_quick"]').isDisabled());
  await lab.getByText("冰華散碎",{exact:true}).click();
  await press(action("開始／重置"));
  await page.waitForFunction(()=>window.ACTIVE_SKILL_LAB.snapshot().elapsed>.9);
  const fight=await snapshot();
  assert.deepEqual(fight.build.activeSkills,["katana","hamaya","ice_ball"]);
  assert.ok(fight.enemies[0].hp<620);
  await show();
  await press(action("暫停／繼續"));
  const paused=await snapshot();
  assert.equal(paused.state,"pause");
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal((await snapshot()).elapsed,paused.elapsed);
  await show();
  await press(action("本局構築"));
  await book.getByText(/冰華散碎/).first().waitFor();
  assert.ok(await book.getByText(/百步穿楊/).count());
  await page.screenshot({path:dir+"/build.png"});
  const mutation=book.locator('button[data-key$="mut_hamaya_distance"]').first();
  await mutation.click();
  assert.ok(await book.locator(".yc-mutation-plaque.title").getByText("百步穿楊",{exact:true}).count());
  assert.ok(await book.locator(".yc-mutation-plaque.subtitle").getByText("破魔・神弓",{exact:true}).count());
  await page.screenshot({path:dir+"/mutation.png"});
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await show();
  await press(action("開始／重置"));
  await show();
  await press(action("測試抽卡"));
  const first=(await snapshot()).choices;
  assert.ok(first.length>0 && !first.includes("weapon:hamaya:6"));
  await show();
  await press(action("開始／重置"));
  await show();
  await press(action("測試抽卡"));
  assert.deepEqual((await snapshot()).choices,first);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),sentinel);
  assert.deepEqual(f.errors,[]);
  assert.deepEqual(f.badRequests,[]);
  await page.close();
  return {skills:fight.build.activeSkills,bossHp:fight.enemies[0].hp,choices:first,paused:true,saveIsolated:true};
}

async function frames(page, count) {
  return page.evaluate(count=>new Promise(resolve=>{
    const times=[];
    let last=0;
    const frame=now=>{
      if (last) times.push(now-last);
      last=now;
      if (times.length<count) return requestAnimationFrame(frame);
      times.sort((a,b)=>a-b);
      resolve({frames:count,p50:times[Math.floor(count*.50)],p95:times[Math.floor(count*.95)],
        max:times.at(-1),over25:times.filter(ms=>ms>25).length});
    };
    requestAnimationFrame(frame);
  }),count);
}

async function touchLab(browser) {
  const f=await fixture(browser,lan,1180,820,true);
  const {page,lab,action,press,show,setup,snapshot}=f;
  await setup({spider_silk:5,wind_hole:5},"bosses",true);
  await lab.getByText("二重風穴",{exact:true}).tap();
  await page.screenshot({path:dir+"/lab-touch.png"});
  await press(action("開始／重置"));
  await page.waitForFunction(()=>window.ACTIVE_SKILL_LAB.snapshot().elapsed>1.12);
  const bosses=await snapshot();
  assert.equal(bosses.enemies.length,3);
  assert.equal(bosses.orderCount,0);
  assert.ok(bosses.effects.some(e=>e.event==="thread") && bosses.effects.some(e=>e.event==="field"));
  await page.screenshot({path:dir+"/three-bosses.png"});
  await setup({spider_silk:5,ice_ball:5,wind_hole:5},"crowd",false);
  await press(action("開始／重置"));
  await page.waitForFunction(()=>window.ACTIVE_SKILL_LAB.snapshot().elapsed>.35);
  const crowd=await snapshot();
  assert.equal(crowd.build.activeSkills.length,4);
  assert.ok(crowd.enemies.length>=70);
  const tilt=await frames(page,180);
  await show();
  await lab.locator('select[name="tilt"]').selectOption("1");
  await press(action("開始／重置"));
  assert.equal(await page.evaluate(()=>window.VIEWPORT.tiltScale()),1);
  const flat=await frames(page,180);
  assert.deepEqual(f.errors,[]);
  assert.deepEqual(f.badRequests,[]);
  await page.close();
  return {bosses:bosses.enemies.length,crowd:crowd.enemies.length,tilt,flat};
}

async function publicGate(browser) {
  const page=await browser.newPage({serviceWorkers:"block"});
  await page.goto(pc+"/?skillLab=expansion",{waitUntil:"domcontentloaded"});
  assert.deepEqual(await page.evaluate(()=>{
    const api=window.GAME_SKILL_EXPANSION;
    return [typeof window.ACTIVE_SKILL_LAB,api.catalogIds(window).length,
      window.UI.secretCards().filter(row=>api.cards[row.emblem] || api.mutations[row.emblem]).length];
  }),["undefined",0,0]);
  await page.close();
}

(async()=>{
  await fs.mkdir(dir,{recursive:true});
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try {
    const desktop=await gameplay(browser);
    const touch=await touchLab(browser);
    await publicGate(browser);
    const result={desktop,touch,publicGate:true};
    await fs.writeFile(dir+"/report.json",JSON.stringify(result,null,2)+"\n");
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch(error=>{ console.error(error); process.exitCode=1; });
