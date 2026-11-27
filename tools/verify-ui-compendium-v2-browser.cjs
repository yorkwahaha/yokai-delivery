"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const {chromium} = require("playwright");

const origin = process.env.YOKAI_COMPENDIUM_ORIGIN || "http://127.0.0.1:8012";
const lan = process.env.YOKAI_COMPENDIUM_LAN || origin;
const output = "scratch/ui-compendium-v2";
const modes = [
  ["1080p",1920,1080,1,false], ["1440p",2560,1440,1,false], ["2160p",3840,2160,1,false],
  ["ipad-air-11",1180,820,2,true], ["short",844,390,1,true]
];
const lab = "/?dev=1&s3play=1&stageLab=1";
const book = page => page.locator(".yc-book[open]:not(.cs-book)");
const settings = page => page.locator("#controls-dialog[open]");
const key = (page,id) => book(page).locator('button[data-key="' + id + '"]');

async function newPage(context, diagnostics) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", error=>diagnostics.push(error.message));
  page.on("console", msg=>{ if (msg.type() === "error") diagnostics.push(msg.text()); });
  page.on("response", response=>{ if (response.status() >= 400) diagnostics.push(response.status()+" "+new URL(response.url()).pathname); });
  return page;
}
async function activate(page, box, touch) {
  assert.ok(box);
  const [x,y] = await page.evaluate(({x,y,w,h})=>{
    const v=VIEWPORT.get();
    return [(x+w/2+v.offsetX)*v.scale,(y+h/2+v.offsetY)*v.scale];
  },box);
  if (touch) await page.touchscreen.tap(x,y);
  else await page.mouse.click(x,y);
}
async function menu(page, id, touch = false) {
  await activate(page, await page.evaluate(id=>UI.MENU_BTNS.find(row=>row.id===id),id),touch);
}
async function snap(page, root, name) {
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await Promise.all([...document.querySelectorAll("dialog[open] img[src]")].filter(img=>img.getClientRects().length)
      .map(img=>img.decode().catch(()=>{})));
  });
  if (root) {
    const layout = await root.evaluate(el=>{
      const panel = el.querySelector(".yc-panel"), foot = el.querySelector(".yc-foot");
      return {overflow:panel.scrollWidth-panel.clientWidth, floor:foot.getBoundingClientRect().bottom, height:innerHeight};
    });
    assert.equal(layout.overflow,0,name);
    assert.ok(layout.floor <= layout.height+1,name);
  }
  await page.screenshot({path:output+"/"+name+".jpg",type:"jpeg",quality:88});
}

async function verifyCompendium(browser, mode, result) {
  const [name,width,height,dpr,touch] = mode;
  const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:touch,isMobile:touch,serviceWorkers:"block"});
  try {
    const page = await newPage(context,result.faults);
    const base = name === "ipad-air-11" ? lan : origin;
    await page.goto(base+lab+"&compendiumReview=1&fixture=D&compendiumTab=cards");
    const click = locator=>touch ? locator.tap() : locator.click();
    await click(key(page,"secret:seal_nail"));
    const art = book(page).locator(".yc-related-card .mutation-portrait");
    assert.equal(await art.count(),4);
    const sizes = await art.evaluateAll(cards=>cards.map(card=>({
      w:card.getBoundingClientRect().width,h:card.getBoundingClientRect().height,
      plaques:card.querySelectorAll(".yc-mutation-plaque").length
    })));
    assert.ok(sizes.every(s=>s.plaques===2 && s.h>s.w && s.w>=55));
    const columns = await book(page).locator(".yc-related").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
    assert.equal(columns,name==="short"?2:4);
    if (name !== "short") {
      assert.ok(await art.evaluateAll(images=>images.every(img=>img.getBoundingClientRect().bottom <=
        img.closest(".yc-secret").getBoundingClientRect().bottom)));
    }
    if (name === "short") await book(page).locator(".yc-secret").evaluate(el=>el.scrollTop=el.scrollHeight);
    await snap(page,book(page),name+"-variants");
    if (name === "1080p") {
      const related = book(page).locator(".yc-related-card").first();
      await click(related);
      await page.locator(".yc-detail[open]").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await related.evaluate(el=>document.activeElement===el),true);
    }
    await click(key(page,"fixture:A"));
    await click(key(page,"secret:seal_nail"));
    const hiddenNames = /紫藤毒香|距爆・封印釘|式神・召喚|きょばく|踩踏陷阱/;
    const lockedSources = [];
    for (const id of ["ink_trail","seal_nail","shikigami"]) {
      const item = key(page,"secret:"+id);
      await click(item);
      assert.match(await item.innerText(),/？？？\s*尚未解鎖/);
      assert.equal(await item.getAttribute("title"),null);
      const hero = book(page).locator(".yc-hero");
      assert.match(await hero.innerText(),/？？？\s*尚未解鎖/);
      assert.doesNotMatch(await book(page).innerText(),hiddenNames);
      assert.equal(await book(page).locator(".yc-related-card,.yc-levels").count(),0);
      const image = await hero.locator("img").getAttribute("src");
      assert.match(image,/omamori_guard/);
      lockedSources.push(image);
    }
    assert.equal(new Set(lockedSources).size,1);
    await snap(page,book(page),name+"-sealed");
    await click(key(page,"group:變異"));
    assert.equal(await book(page).locator('button[data-key^="secret:mut_seal_nail"],button[data-key^="secret:mut_ink_"],button[data-key^="secret:mut_shikigami"]').count(),0);
    await click(key(page,"tab:words"));
    await click(key(page,"filter:stage"));
    await click(key(page,"option:night-town"));
    const metrics = await book(page).locator(".yc-word-note").evaluateAll(nodes=>nodes.map(note=>({
      h:note.getBoundingClientRect().height,
      lines:[...note.children].filter(el=>!el.classList.contains("yc-mark")).length,
      centered:getComputedStyle(note).textAlign,
      text:note.textContent
    })));
    assert.equal(new Set(metrics.map(row=>row.h)).size,1);
    assert.ok(metrics.every(row=>row.centered==="center"));
    await snap(page,book(page),name+"-words");
    if (name === "1080p") {
      const voice = page.waitForResponse(response=>/\/audio\/delivery\/night-town\/\d+\.mp3/.test(response.url()));
      await click(book(page).locator("button.yc-word").first());
      assert.ok((await voice).ok());
      await page.keyboard.press("PageDown");
      assert.match(await book(page).locator(".yc-pager").innerText(), /2 \/ 3/);
      await click(key(page,"tab:build"));
      for (const fixture of ["A","B","C","D","E"]) {
        await click(key(page,"fixture:"+fixture));
        assert.equal(await book(page).locator(".yc-build-slot").count(),4);
        const aimed = fixture === "A" ? 1 : 4;
        assert.match(await book(page).locator(".yc-summary").innerText(),new RegExp("主動技能\\s*" + aimed + " / 4"));
      }
      result.retained = {wordAudio:true, nextPage:true, buildFixtures:["A","B","C","D","E"]};
    }
    result.cards = {sizes,columns,annotation:metrics};
    assert.deepEqual(result.faults,[]);
  } finally { await context.close(); }
}

async function verifySettings(browser, mode, result) {
  const [name,width,height,dpr,touch] = mode;
  const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:touch,isMobile:touch,serviceWorkers:"block"});
  try {
    const page = await newPage(context,result.faults);
    const base = name === "ipad-air-11" ? lan : origin;
    await page.goto(base+(touch?lab:"/"));
    await page.waitForFunction(()=>window.ART?.cover);
    await menu(page,"controls",touch);
    await settings(page).waitFor();
    const press = locator=>touch ? locator.tap() : locator.click();
    const tabs = settings(page).getByRole("tab");
    assert.equal(await tabs.count(),3);
    for (const group of ["keys","pointer","pad"]) {
      await press(settings(page).locator('[data-controls-tab="'+group+'"]'));
      assert.equal(await settings(page).locator('[data-controls-panel]:visible').count(),1);
      await snap(page,settings(page),name+"-settings-"+group);
    }
    if (name === "1080p") {
      const movement = settings(page).locator('[data-action="u"]');
      const label = () => movement.locator("kbd").innerText();
      const status = settings(page).locator("#controls-status");
      await press(tabs.nth(0));
      await page.keyboard.press("ArrowRight");
      assert.equal(await tabs.nth(1).getAttribute("aria-selected"),"true");
      await page.keyboard.press("ArrowLeft");
      assert.equal(await tabs.nth(0).getAttribute("aria-selected"),"true");
      await page.keyboard.press("ArrowDown");
      assert.notEqual(await page.evaluate(()=>document.activeElement.id),"cs-tab-keys");
      await press(movement);
      assert.match(await status.innerText(),/請按下新的按鍵/);
      await snap(page,settings(page),"settings-binding");
      await page.keyboard.press("d");
      assert.match(await status.innerText(),/已使用或保留/);
      await page.keyboard.press("ArrowRight");
      assert.equal(await tabs.nth(0).getAttribute("aria-selected"),"true");
      await page.keyboard.press("Escape");
      assert.equal(await label(),"W");
      await press(movement);
      await page.keyboard.press("t");
      assert.equal(await label(),"T");
      await press(settings(page).locator('[data-preset="left"]'));
      assert.equal(await label(),"I");
      assert.equal(await settings(page).locator('[data-action="interact"] kbd').innerText(),"U");
      await press(settings(page).locator('[data-preset="right"]'));
      assert.equal(await label(),"W");
      await press(movement);
      await page.keyboard.press("t");
      await press(tabs.nth(1));
      await press(settings(page).locator("#haptics-enabled"));
      const haptics = await settings(page).locator("#haptics-enabled").isChecked();
      await press(tabs.nth(2));
      assert.equal(await settings(page).locator("#cs-pad [data-haptics]").isChecked(),haptics);
      await press(settings(page).locator("[data-controls-back]"));
      await page.waitForFunction(()=>document.getElementById("game")===document.activeElement);
      await page.reload();
      await page.waitForFunction(()=>window.ART?.cover);
      await menu(page,"controls");
      await settings(page).waitFor();
      assert.equal(await label(),"T");
      await press(tabs.nth(1));
      assert.equal(await settings(page).locator("#haptics-enabled").isChecked(),haptics);
      await press(settings(page).locator("[data-controls-reset]"));
      await press(tabs.nth(0));
      assert.equal(await label(),"W");

      await page.evaluate(()=>{
        window.v2Input = {buttons:Array(16).fill(false),axes:[0,0]};
        Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[{
          connected:true,axes:window.v2Input.axes,buttons:window.v2Input.buttons.map(pressed=>({pressed}))
        }]});
      });
      const pad = async i => {
        await page.evaluate(i=>{window.v2Input.buttons[i]=true;},i);
        await page.waitForTimeout(70);
        await page.evaluate(i=>{window.v2Input.buttons[i]=false;},i);
        await page.waitForTimeout(55);
      };
      await pad(5);
      assert.equal(await tabs.nth(1).getAttribute("aria-selected"),"true");
      await pad(13);
      assert.notEqual(await page.evaluate(()=>document.activeElement.id),"cs-tab-pointer");
      await snap(page,settings(page),"settings-gamepad-focus");
      await pad(4);
      await press(movement);
      await pad(5);
      assert.equal(await tabs.nth(0).getAttribute("aria-selected"),"true");
      await pad(1);
      assert.match(await status.innerText(),/已取消/);
      assert.equal(await label(),"W");
      await pad(1);
      await settings(page).waitFor({state:"hidden"});
    } else {
      await press(settings(page).locator("[data-controls-back]"));
      await settings(page).waitFor({state:"hidden"});
    }
    assert.deepEqual(result.faults,[]);
  } finally { await context.close(); }
}

async function verifyHome(browser, result) {
  const context = await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:"block"});
  try {
    const page = await newPage(context,result.faults);
    const requests = [];
    page.on("request", req=>{if (/\/cover\.(webp|jpg)(\?|$)/.test(req.url())) requests.push(req.url());});
    await page.addInitScript(()=>{
      window.coverDrawCount = 0;
      window.homeLabels = new Set();
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(img,...args) {
        if (this.canvas.id==="game" && /\/cover\.(webp|jpg)/.test(img.src||"")) window.coverDrawCount++;
        return draw.call(this,img,...args);
      };
      const text = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(value,...args) {
        if (this.canvas.id==="game" && document.body?.dataset.gameScreen==="menu") window.homeLabels.add(value);
        return text.call(this,value,...args);
      };
    });
    await page.route("**/js/game.js?*",async route=>{
      const response = await route.fetch();
      const source = await response.text();
      const marker = "    window.YOKAI_PERF = api;";
      assert.ok(source.includes(marker));
      const fixture = `
        api.v2 = {
          start() { start("night-town"); titleCardT = fadeT = 0; tutorial = null; tutorialSkipped = true; },
          end() { elapsed = 437; delivered = 4; score = 480; loseRun(); updateLampSequence(5); },
          state: () => state, ready: () => !artPending(), canLeave: () => state === "lost" && endCooldown <= 0,
          pause: () => UI.pauseButtons(pausePage),
          music: () => ({t:window.BGM.currentTime,paused:window.BGM.paused,src:window.BGM.currentSrc})
        };
      `;
      await route.fulfill({response,body:source.replace(marker,fixture+marker)});
    });
    await page.goto(origin+"/?dev=1&perf=1");
    await page.waitForFunction(()=>window.YOKAI_PERF?.v2 && window.ART?.cover?.naturalWidth && coverDrawCount>2);
    await page.evaluate(()=>{
      window.homeCover = ART.cover;
      window.homeSparks = 0;
      const glow = FX.glow;
      FX.glow = function(ctx,x,y,size,color,alpha) {
        if (document.body.dataset.gameScreen==="menu" && (color==="#ffd27a" || color==="#ff8a4a")) window.homeSparks++;
        return glow.call(this,ctx,x,y,size,color,alpha);
      };
    });
    const probe = name => page.evaluate(n=>YOKAI_PERF.v2[n](),name);
    async function roundTrip(id, cross) {
      const count = await page.evaluate(()=>coverDrawCount);
      const sparks = await page.evaluate(()=>homeSparks);
      await menu(page,id);
      await book(page).waitFor();
      if (cross) await key(page,"tab:words").click();
      await key(page,"back").click();
      await page.waitForFunction(c=>document.body.dataset.gameScreen==="menu" && coverDrawCount>c+2,count);
      assert.ok(await page.evaluate(()=>ART.cover===homeCover));
      assert.ok(await page.evaluate(prior=>homeSparks>prior,sparks));
    }
    const originalRequests = requests.length;
    await roundTrip("cards",false);
    await roundTrip("codex",false);
    await roundTrip("cards",true);
    for (let i=0;i<10;i++) await roundTrip(i%2 ? "codex" : "cards",false);
    assert.equal(requests.length,originalRequests);
    assert.ok(await page.evaluate(()=>Array.from(homeLabels).some(text=>String(text).includes("百鬼橫行之夜"))));
    await snap(page,null,"home-fixed");
    result.homeRoundTrips = 13;
    result.extraCoverRequests = requests.length-originalRequests;
    result.paint = await page.evaluate(()=>({cover:coverDrawCount, sparks:homeSparks}));

    // These two unlocks use the actual completion API in a disposable DEV context.
    await menu(page,"cards");
    await key(page,"secret:seal_nail").click();
    assert.match(await book(page).locator(".yc-secret").innerText(),/通過.*後解鎖/);
    assert.equal(await page.evaluate(()=>STORE.isActiveSkillUnlocked("seal_nail")),false);
    await page.evaluate(()=>{
      STORE.finish("night-town",100,6,true);
      STORE.finish("rain-port",100,6,true);
    });
    assert.equal(await page.evaluate(()=>STORE.isActiveSkillUnlocked("seal_nail")),true);
    await key(page,"secret:seal_nail").click();
    assert.match(await book(page).locator(".yc-hero").innerText(),/距爆・封印釘/);
    assert.equal(await book(page).locator(".yc-levels li,.yc-related-card").count(),9);
    await key(page,"group:變異").click();
    assert.equal(await book(page).locator('button[data-key^="secret:mut_seal_nail"]').count(),4);
    await key(page,"back").click();

    const longest = await page.evaluate(()=>{
      const getLength = w=>Array.from(w || "").length;
      const words = CONTENT.getAllWords().filter(word=>!word.decoy && DELIVERY_MEDIA.pathForWord("image",word.jp));
      const unique = [];
      for (const sort of [
        w=>getLength(w.kanji || w.jp),w=>getLength(w.zh),w=>getLength(w.kana || w.jp),
        w=>(w.kanji||w.jp) !== (w.kana||w.jp) ? getLength(w.kanji||w.jp) : 0,
        w=>(w.kanji||w.jp) === (w.kana||w.jp) ? getLength(w.kanji||w.jp) : 0
      ]) {
        words.sort((a,b)=>sort(b)-sort(a));
        if (!unique.includes(words[0])) unique.push(words[0]);
      }
      const bag = CARD_DELIVERY.openCards(localStorage,location);
      for (const word of unique) for(let i=0;i<4;i++) bag.record({id:"v2:"+word.jp+":"+i,jp:word.jp,kind:"delivery",ok:true});
      return unique.map(word=>({jp:word.kanji||word.jp,zh:word.zh,kana:word.kana}));
    });
    await menu(page,"codex");
    await book(page).locator("button.yc-word").first().waitFor();
    const wordMetrics = await book(page).locator("button.yc-word .yc-word-note").evaluateAll(notes=>notes.map(note=>{
      const title=note.querySelector("strong"), kana=note.querySelector(".yc-reading"), zh=note.querySelector(".yc-zh");
      const box=note.getBoundingClientRect();
      const content=[title,kana,zh].filter(Boolean).map(node=>node.getBoundingClientRect());
      return {jp:title.textContent,kana:kana?.textContent||"",zh:zh.textContent,rows:content.length,
        safe:content.every(r=>r.left>=box.left && r.right<=box.right && r.top>=box.top && r.bottom<=box.bottom)};
    }));
    assert.ok(wordMetrics.every(row=>row.safe && row.jp!==row.kana));
    result.longWords = wordMetrics;
    assert.ok(wordMetrics.some(row=>row.rows===2) && wordMetrics.some(row=>row.rows===3));
    for (const word of longest) assert.ok(wordMetrics.some(row=>row.jp===word.jp && row.zh===word.zh));
    await snap(page,book(page),"long-words");
    await key(page,"back").click();

    await probe("start");
    await page.waitForFunction(()=>YOKAI_PERF.v2.ready());
    await page.keyboard.press("p");
    assert.equal(await probe("state"),"pause");
    await page.waitForFunction(()=>window.BGM.currentTime>0 && !window.BGM.paused);
    const before = await probe("music");
    const pressPause = async id => activate(page,(await probe("pause")).find(btn=>btn.id===id),false);
    await pressPause("build");
    await book(page).waitFor();
    await key(page,"tab:cards").click();
    await key(page,"tab:words").click();
    await page.waitForTimeout(240);
    await key(page,"back").click();
    assert.equal(await probe("state"),"pause");
    await pressPause("settings");
    await page.waitForFunction(()=>YOKAI_PERF.v2.pause().some(btn=>btn.id==="controls"));
    await pressPause("controls");
    await settings(page).waitFor();
    await settings(page).locator("#cs-tab-pointer").click();
    await settings(page).locator("#cs-tab-pad").click();
    await page.waitForTimeout(240);
    const after = await probe("music");
    assert.equal(after.src,before.src);
    assert.equal(after.paused,false);
    assert.ok(after.t-before.t>.45);
    await settings(page).locator("[data-controls-back]").click();
    await page.waitForFunction(()=>document.activeElement?.id==="game");
    await page.keyboard.press("p");
    await page.keyboard.press("p");
    assert.equal(await probe("state"),"play");
    result.music = {before,after};

    await probe("end");
    await page.waitForFunction(()=>YOKAI_PERF.v2.canLeave());
    await activate(page,await page.evaluate(()=>UI.endScreenButtons("lost").find(btn=>btn.id==="menu")),false);
    await page.waitForFunction(()=>YOKAI_PERF.v2.state()==="menu" && ART.cover?.naturalWidth);
    await page.evaluate(()=>{window.homeCover = ART.cover;});
    await roundTrip("cards",true);
    result.resultToHomeRoundTrip = true;
    assert.deepEqual(result.faults,[]);
  } finally { await context.close(); }
}

async function verifyFallback(browser) {
  const context = await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:"block"});
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    let requests = 0;
    await page.route("**/assets/img/delivery/night-town/01.webp",route=>{
      requests++;
      return route.fulfill({status:404,body:"injected missing illustration"});
    });
    await page.goto(origin+lab+"&compendiumReview=1&compendiumTab=words");
    await key(page,"filter:stage").click();
    await key(page,"option:night-town").click();
    const card = book(page).locator("button.yc-word:has(.art-missing)");
    assert.match(await card.innerText(),/4\/4/);
    await page.keyboard.press("PageDown");
    assert.match(await book(page).locator(".yc-pager").innerText(),/2 \/ 3/);
    return {injected404s:requests};
  } finally { await context.close(); }
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const report = {browser:browser.version(),modes:{}};
  const save = () => fs.writeFile(output+"/browser-v2.json",JSON.stringify(report,null,2));
  try {
    for (const mode of modes.filter(m=>!process.env.YOKAI_V2_MODE || m[0]===process.env.YOKAI_V2_MODE)) {
      const row = report.modes[mode[0]] = {faults:[]};
      await verifyCompendium(browser,mode,row);
      await verifySettings(browser,mode,row);
      await save();
    }
    if (!process.env.YOKAI_V2_MODE || process.env.YOKAI_V2_MODE === "home") {
      report.home = {faults:[]};
      await verifyHome(browser,report.home);
      await save();
    }
    if (!process.env.YOKAI_V2_MODE || process.env.YOKAI_V2_MODE === "fallback") {
      report.fallback = await verifyFallback(browser);
      await save();
    }
  } catch (e) { report.error = String(e.stack || e); await save(); throw e; }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
