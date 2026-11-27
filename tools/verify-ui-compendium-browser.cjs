"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const {chromium} = require("playwright");

const origin = process.env.YOKAI_COMPENDIUM_ORIGIN || "http://127.0.0.1:8012";
const lan = process.env.YOKAI_COMPENDIUM_LAN || origin;
const output = "scratch/ui-compendium-20261126";
const review = "/?dev=1&stageLab=1&compendiumReview=1&s3play=1";
const marker = "    window.YOKAI_PERF = api;";
const hooks = `
    api.compendiumBrowser = {
      start() { start("night-town"); titleCardT = fadeT = 0; tutorial = null; tutorialSkipped = true; },
      state: () => state, ready: () => !artPending(), buttons: () => UI.pauseButtons(pausePage),
      music: () => ({time:window.BGM?.currentTime, paused:window.BGM?.paused, source:window.BGM?.currentSrc}),
      legal: () => Object.keys(MUTATION_CONFIG).every(id => UI.secretCards().some(row => row.emblem === id))
    };
`;
const modes = [
  ["1080p", 1920, 1080, 1, false],
  ["1440p", 2560, 1440, 1, false],
  ["2160p", 3840, 2160, 1, false],
  ["ipad-air-11", 1180, 820, 2, true],
  ["short", 844, 390, 1, true]
];
const input = page => page.evaluate(() => document.activeElement?.dataset.key);
const tab = (page, id) => page.locator("#yc-tab-" + id);
const key = (page, id) => page.locator('.yc-book button[data-key="' + id + '"]');
const snapshot = page => page.evaluate(() => {
  const shape = name => {
    const item = document.querySelector(name);
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return {x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom, scroll:item.scrollHeight, client:item.clientHeight};
  };
  return {
    shell: shape(".yc-shell"), panel: shape(".yc-panel"), foot: shape(".yc-foot"),
    hero: shape(".yc-hero"), heroText:shape(".yc-card-name"), secret:shape(".yc-secret"),
    wordGrid:shape(".yc-word-grid"), buildGrid:shape(".yc-build-grid"), lastSlot:shape(".yc-build-slot:last-child"),
    font:getComputedStyle(document.querySelector(".yc-book")).fontFamily,
    icons:[...document.querySelectorAll(".yc-panel img[src]")].map(img => [img.naturalWidth,img.naturalHeight,img.hidden]),
    panelHorizontalScroll:document.querySelector(".yc-panel").scrollWidth - document.querySelector(".yc-panel").clientWidth
  };
});

async function settled(page) {
  await page.evaluate(async() => {
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await Promise.all([...document.querySelectorAll(".yc-book img[src]")].map(img=>img.decode().catch(()=>{})));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}
async function shot(page, name, row) {
  await settled(page);
  const data = await snapshot(page);
  assert.equal(data.panelHorizontalScroll, 0, name);
  assert.ok(data.panel.bottom <= data.foot.y + 1, name);
  assert.ok(data.foot.bottom <= (await page.evaluate(()=>innerHeight)) + 1, name);
  assert.ok(data.icons.every(([w,h,hidden]) => (w > 0 && h > 0) || hidden), name);
  await page.screenshot({path:path.join(output, name + ".jpg"),type:"jpeg",quality:88});
  row[name] = data;
  if (name === "short-build" || name === "short-build-E") assert.ok(data.lastSlot.bottom <= data.panel.bottom + 1,
    "four active slots fit 844×390: " + JSON.stringify({last:data.lastSlot, panel:data.panel}));
}
function monitor(page, report) {
  page.on("pageerror", error=>report.exceptions.push(error.message));
  page.on("console", message=>{ if (message.type() === "error") report.console.push(message.text()); });
  page.on("response", response=>{
    if (response.status() >= 400) report.http.push([response.status(),new URL(response.url()).pathname]);
  });
}
function assertNoFaults(row) {
  assert.deepEqual(row.exceptions, []);
  assert.deepEqual(row.http, []);
  assert.deepEqual(row.console, []);
}
const rowOf = () => ({exceptions:[],console:[],http:[],captures:{}});

async function studio(browser, mode) {
  const [name,width,height,deviceScaleFactor,touch] = mode;
  const context = await browser.newContext({viewport:{width,height},deviceScaleFactor,
    hasTouch:touch,isMobile:touch,serviceWorkers:"block"});
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const row = rowOf();
    monitor(page,row);
    await page.addInitScript(() => {
      localStorage.setItem("yokai-delivery-v1", JSON.stringify({sentinel:"official-untouched"}));
      localStorage.setItem("yokai-delivery-cards-v1", JSON.stringify({sentinel:"collection-untouched"}));
      window.playedDelivery = [];
      const bytePaths = new WeakMap(), bufferPaths = new WeakMap();
      const read = Response.prototype.arrayBuffer;
      Response.prototype.arrayBuffer = async function() {
        const bytes = await read.call(this);
        if (this.url.includes("/audio/delivery/")) bytePaths.set(bytes,this.url);
        return bytes;
      };
      const decode = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = function(bytes,...args) {
        const decoded = decode.call(this,bytes,...args);
        const url = bytePaths.get(bytes);
        if (url) decoded.then(buffer=>bufferPaths.set(buffer,url),()=>{});
        return decoded;
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        start.apply(this,args);
        const url = bufferPaths.get(this.buffer);
        if (url) window.playedDelivery.push(url);
      };
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() {
        const played = original.call(this);
        if (this.src.includes("/audio/delivery/")) {
          played.then(() => window.playedDelivery.push(this.currentSrc), () => {});
        }
        return played;
      };
    });
    const base = name === "ipad-air-11" ? lan : origin;
    await page.goto(base + review + "&fixture=D");
    await page.locator(".yc-build").waitFor();
    assert.match(await page.locator(".yc-summary").innerText(), /5 \/ 8/);
    for (const name of ["紫藤毒香","距爆・封印釘","式神・召喚"]) assert.ok((await page.locator(".yc-build-skill").allInnerTexts()).some(x=>x.includes(name)));
    const act = item => touch ? item.tap() : item.click();
    for (const id of ["cards","words","build"]) {
      await act(tab(page,id));
      if (id === "cards") await act(key(page,"secret:seal_nail"));
      if (id === "words") {
        await act(key(page,"filter:stage"));
        await act(key(page,"option:night-town"));
        if (!touch) assert.equal(await page.locator(".yc-word").count(), 8);
      }
      await shot(page,name+"-"+id,row.captures);
    }
    if (name === "short") {
      await act(key(page,"fixture:E"));
      await shot(page,"short-build-E",row.captures);
    }
    if (name === "1080p") {
      const media = await page.evaluate(() => DELIVERY_LEXICON.stages.slice(0,7)
        .flatMap(stage=>stage.words.flatMap(word=>["image","audio"].map(kind=>DELIVERY_MEDIA.pathForWord(kind,word.jp)))));
      assert.equal(new Set(media).size,280);
      await Promise.all(media.map(name=>fs.access(name)));
      row.registeredWordMedia = media.length;
      for (const fixture of ["A","B","C","D","E"]) {
        await key(page,"fixture:"+fixture).click();
        const owned = ({A:1,B:4,C:4,D:4,E:4})[fixture];
        assert.equal(await page.locator(".yc-build-slot").count(),4);
        assert.equal(await page.locator(".yc-build-slot.empty").count(),4-owned);
        if (fixture === "C") assert.match(await page.locator(".yc-summary").innerText(), /滿級技能\s*4 \/ 4/);
        if (fixture === "E") assert.equal(await page.locator(".yc-item").count(),12);
        await shot(page,"build-"+fixture,row.captures);
      }
      const suffix = ".yc-detail[open]";
      const owned = page.locator('button[data-key$=":mut_orbit"]');
      await owned.click();
      assert.match(await page.locator(suffix).innerText(), /偏心輪道/);
      await page.keyboard.press("Escape");
      assert.match(await input(page), /^owned:\d+:mut_orbit$/);
      await key(page,"candidates:katana").click();
      assert.ok(await page.locator(".yc-candidate-list .yc-mutation").count() >= 2);
      await page.keyboard.press("Escape");
      assert.equal(await input(page), "candidates:katana");
      await key(page,"item:charm_cadence").click();
      await shot(page,"build-long-detail",row.captures);
      await page.keyboard.press("Escape");
      await tab(page,"words").click();
      await key(page,"filter:stage").click();
      await key(page,"option:night-town").click();
      assert.match(await page.locator(".yc-completion").innerText(), /7 \/ 20/);
      await key(page,"filter:pack").click();
      const pack = await page.evaluate(()=>DELIVERY_LEXICON.stages[0].words[0].packId || CONTENT.getAllWords().find(w=> w.jp===DELIVERY_LEXICON.stages[0].words[0].jp).packId);
      await key(page,"option:"+pack).click();
      assert.match(await page.locator(".yc-completion").innerText(), /3 \/ 3/);
      await key(page,"filter:pack").click();
      await key(page,"option:null").click();
      assert.ok(await page.locator(".yc-word.sealed").count());
      assert.equal(await page.locator(".yc-word.sealed img").count(),0);
      assert.ok(await page.locator(".yc-word").evaluateAll(cards=>cards.every(c=>c.querySelector("strong")?.textContent!==c.querySelector(".yc-reading")?.textContent)));
      await page.keyboard.press("PageDown");
      assert.match(await page.locator(".yc-pager").innerText(),/2 \/ 3/);
      await page.keyboard.press("PageUp");
      await page.locator(".yc-word button, button.yc-word").first().click();
      await page.waitForFunction(()=>window.playedDelivery.length > 0);
      row.wordPlayback = await page.evaluate(()=>window.playedDelivery[0]);
      await page.keyboard.press("Tab");
      assert.equal(await input(page),"tab:build");
      await page.keyboard.press("ArrowDown");
      assert.notEqual(await input(page),"tab:build");
      await shot(page,"keyboard-focus",row.captures);

      await page.evaluate(() => {
        window.compTestButtons = Array(16).fill(false);
        Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[
          {connected:true,axes:[0,0],buttons:window.compTestButtons.map(pressed=>({pressed}))}
        ]});
      });
      const pad = async index => {
        await page.evaluate(i=>{window.compTestButtons[i]=true},index);
        await page.waitForTimeout(105);
        await page.evaluate(i=>{window.compTestButtons[i]=false},index);
        await page.waitForTimeout(50);
      };
      await pad(4);
      assert.equal(await input(page),"tab:words");
      await pad(13);
      assert.notEqual(await input(page),"tab:words");
      await shot(page,"gamepad-focus",row.captures);
      await pad(1);
      await page.locator(".yc-book[open]").waitFor({state:"hidden"});
      assert.equal(await page.evaluate(()=>localStorage.getItem("yokai-delivery-v1")),JSON.stringify({sentinel:"official-untouched"}));
      assert.equal(await page.evaluate(()=>localStorage.getItem("yokai-delivery-cards-v1")),JSON.stringify({sentinel:"collection-untouched"}));
    }
    assertNoFaults(row);
    return row;
  } finally { await context.close(); }
}

async function normal(browser) {
  const context = await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:"block"});
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const row = rowOf();
    monitor(page,row);
    const requests = [];
    page.on("request", req=>requests.push(new URL(req.url()).pathname));
    await page.route("**/js/game.js?*",async route=>{
      const response = await route.fetch();
      const source = await response.text();
      assert.ok(source.includes(marker));
      await route.fulfill({response,body:source.replace(marker,hooks+marker)});
    });
    await page.goto(origin + "/?dev=1&perf=1");
    await page.waitForFunction(()=>window.YOKAI_PERF?.compendiumBrowser);
    const probe = async name => page.evaluate(n=>window.YOKAI_PERF.compendiumBrowser[n](),name);
    assert.ok(await probe("legal"));
    await page.keyboard.press("c");
    await shot(page,"normal-starter-cards",row.captures);
    await tab(page,"build").click();
    await page.locator(".yc-no-run").waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await probe("state"),"menu");
    assert.equal(await page.locator("#game").evaluate(el=>el===document.activeElement),true);
    assert.ok(!requests.includes("/js/ui-compendium-review.js"));
    await page.evaluate(()=>window.YOKAI_PERF.compendiumBrowser.start());
    await page.waitForFunction(()=>window.YOKAI_PERF.compendiumBrowser.ready());
    await page.keyboard.press("p");
    assert.equal(await probe("state"),"pause");
    await page.screenshot({path:path.join(output,"after-pause.jpg"),type:"jpeg",quality:88});
    await page.waitForFunction(()=>!window.BGM?.paused && window.BGM?.currentTime > 0);
    const button = (await probe("buttons")).find(b=>b.id==="build");
    const point = await page.evaluate(({x,y,w,h})=>{
      const v=VIEWPORT.get();
      return [(x+w/2+v.offsetX)*v.scale,(y+h/2+v.offsetY)*v.scale];
    },button);
    await page.mouse.click(...point);
    await page.locator(".yc-build").waitFor();
    assert.match(await page.locator(".yc-summary").innerText(),/1 \/ 4/);
    assert.match(await page.locator(".yc-build-name").innerText(),/妖刀斬\s*Lv1/);
    await shot(page,"normal-pause-build",row.captures);
    const before = await probe("music");
    await tab(page,"cards").click();
    await tab(page,"words").click();
    const deliveryBefore = requests.filter(p=>p.startsWith("/assets/img/delivery/")).length;
    assert.equal(await page.locator(".yc-word button, button.yc-word").count(),0);
    assert.equal(await page.locator(".yc-word-art img").count(),0);
    await shot(page,"normal-locked-words",row.captures);
    await page.waitForTimeout(350);
    const after = await probe("music");
    assert.equal(after.source,before.source);
    assert.equal(after.paused,false);
    assert.ok(after.time > before.time+.25);
    assert.equal(requests.filter(p=>p.startsWith("/assets/img/delivery/")).length,deliveryBefore);
    await key(page,"back").click();
    assert.equal(await probe("state"),"pause");
    await page.keyboard.press("p");
    assert.equal(await probe("state"),"play");
    row.music = {before,after};
    assertNoFaults(row);
    return row;
  } finally { await context.close(); }
}

async function missingImage(browser) {
  const context = await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:"block"});
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const missing = "/assets/img/delivery/night-town/01.webp";
    let intercepted = 0;
    await page.route("**"+missing,route=>{intercepted++; return route.fulfill({status:404,body:"forced missing art"});});
    await page.goto(origin + review + "&compendiumTab=words");
    await key(page,"filter:stage").click();
    await key(page,"option:night-town").click();
    await page.locator(".yc-word-art.art-missing").waitFor();
    const card = page.locator("button.yc-word:has(.art-missing)");
    assert.ok((await card.innerText()).includes("4/4"));
    await card.click();
    await page.keyboard.press("PageDown");
    assert.ok(intercepted > 0);
    return {intercepted};
  } finally { await context.close(); }
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const report = {browser:browser.version(),modes:{},origin,lan};
  const save = () => fs.writeFile(path.join(output,"browser.json"),JSON.stringify(report,null,2));
  try {
    const only = process.env.YOKAI_COMPENDIUM_MODE;
    for (const mode of modes.filter(mode=>!only || mode[0] === only)) {
      report.modes[mode[0]] = await studio(browser,mode);
      await save();
    }
    if (!only || only === "normal") report.normal = await normal(browser);
    if (!only || only === "fallback") report.missingImage = await missingImage(browser);
    await save();
  } catch (error) { report.error = String(error.stack || error); await save(); throw error; }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
