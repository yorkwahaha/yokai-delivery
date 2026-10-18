"use strict";

// M1-INTEGRATION-CHECK
// 依總監指示：短程關鍵流程檢查（唯讀＋只寫 scratch/ 與 tests/agy-m1-integration.test.cjs）
// 1. night-town 零配送：終王擊殺並過 DAWN(600s)→進 victory→won 結算只有『回旅路地圖』一鈕；點它回 overworld。
// 2. lost 結算三鈕不變(restart/world/menu)。
// 3. 結算畫面顯示 MM:SS 且暫停時間不計入(暫停N秒後再恢復，elapsedSeconds不變)。
// 4. 修行進階卡片 desktop1000x700／手機844x390／平板1024x640 無空白重疊(取一張截圖即可)。

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRATCH = path.join(ROOT, "scratch", "m1-integration");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const GUARD = path.join(ROOT, "tools", "director-audio-freeze.cjs");

fs.mkdirSync(SCRATCH, { recursive: true });

function deadline(promise, ms, what) {
  let t;
  return Promise.race([
    promise.then(v => { clearTimeout(t); return v; }, e => { clearTimeout(t); throw e; }),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error("DEADLINE " + ms + "ms: " + what)), ms); })
  ]);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const PRELOAD = `
(function () {
  try { localStorage.setItem('yokai-tutorial-v1', JSON.stringify('skip')); } catch (e) {}
  window.__cap = [];
  var proto = CanvasRenderingContext2D.prototype;
  var realFill = proto.fillText;
  proto.fillText = function (text, x, y, mw) {
    window.__cap.push({ text: String(text), x: x, y: y, font: this.font, align: this.textAlign });
    return realFill.apply(this, arguments);
  };
  var C = { now: 1000, queued: [], frames: 0 };
  window.requestAnimationFrame = function (cb) { C.queued.push(cb); return C.queued.length; };
  window.cancelAnimationFrame = function () {};
  window.__clock = {
    state: C,
    pump: function (frames, dtMs) {
      frames = frames || 1;
      dtMs = dtMs || 50;
      for (var f = 0; f < frames; f++) {
        C.now += dtMs;
        var q = C.queued; C.queued = [];
        for (var i = 0; i < q.length; i++) {
          C.frames++;
          try { q[i](C.now); } catch (e) { (window.__err = window.__err || []).push(String(e && e.message || e)); }
        }
      }
      return C.frames;
    }
  };
})();
`;

const PROBE = `
window.__integration = {
  start: function(id) { start(id); },
  getState: function() { return state; },
  setState: function(s) { state = s; },
  getStage: function() { return STAGE ? STAGE.id : null; },
  getDelivered: function() { return delivered; },
  setDelivered: function(d) { delivered = d; },
  getFinalBossDefeated: function() { return finalBossDefeated; },
  setFinalBossDefeated: function(v) { finalBossDefeated = v; },
  getElapsed: function() { return elapsed; },
  setElapsed: function(e) { elapsed = e; },
  getEndCooldown: function() { return endCooldown; },
  setEndCooldown: function(v) { endCooldown = v; },
  getRunSummary: function() { return runSummary; },
  getMenuButtons: function() { return menuButtons(); },
  activateMenu: function(id) { activateMenu(id); },
  togglePause: function() { togglePause(); },
  startVictorySequence: function() { startVictorySequence(); },
  loseRun: function() { loseRun(); },
  getEnded: function() { return ended; }
};
`;

async function withChromeIntegration(fn) {
  const port = 9700 + Math.floor(Math.random() * 200);
  const cdpPort = port + 100;
  const profileDir = path.join(SCRATCH, "profile-" + crypto.randomBytes(3).toString("hex"));
  fs.mkdirSync(profileDir, { recursive: true });

  const preview = spawn(process.execPath, ["--require", GUARD, path.join(ROOT, "tools", "director-preview.cjs"), "--port=" + port], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--mute-audio", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--window-size=1000,700",
    "--user-data-dir=" + profileDir, "--remote-debugging-port=" + cdpPort, "about:blank"
  ], { stdio: "ignore" });

  const state = { ws: null, timer: null, closed: false, pageErrors: [], consoleLines: [], audioLeak: [] };

  try {
    await deadline(new Promise((res, rej) => {
      preview.stdout.on("data", b => { if (String(b).includes("SILENT_REVIEW")) res(true); });
      preview.on("error", rej);
    }), 10000, "preview server launch");

    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      try {
        const list = await deadline(new Promise((res, rej) => {
          http.get("http://127.0.0.1:" + cdpPort + "/json/list", r => {
            let s = ""; r.on("data", d => s += d); r.on("end", () => res(s));
          }).on("error", rej);
        }), 1500, "CDP json list");
        target = JSON.parse(list).find(t => t.type === "page" && t.webSocketDebuggerUrl);
      } catch (e) { /* retry */ }
      if (!target) await sleep(150);
    }
    if (!target) throw new Error("no cdp page target found");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    state.ws = ws;
    await deadline(new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("ws open")); }), 5000, "CDP WebSocket open");

    let seq = 0;
    const pending = new Map();
    const events = [];
    const failAll = err => { for (const p of pending.values()) p.rej(err); pending.clear(); };
    ws.onclose = () => { state.closed = true; failAll(new Error("ws closed")); };
    ws.onerror = () => { state.closed = true; failAll(new Error("ws error")); };
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.rej(new Error("CDP " + p.method + ": " + JSON.stringify(msg.error))) : p.res(msg.result);
      } else {
        events.push(msg);
      }
    };

    const send = (method, params = {}, ms = 15000) => {
      if (state.closed || !ws || ws.readyState > 1) return Promise.reject(new Error("WS_CLOSED: " + method));
      return deadline(new Promise((res, rej) => {
        const id = ++seq; pending.set(id, { res, rej, method });
        try { ws.send(JSON.stringify({ id, method, params })); } catch (e) { pending.delete(id); rej(e); }
      }), ms, "CDP " + method);
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: PRELOAD });

    // Intercept game.js to inject integration probe
    const rawGame = fs.readFileSync(path.join(ROOT, "js", "game.js"), "utf8");
    const cut = rawGame.lastIndexOf("})();");
    const patchedGame = rawGame.slice(0, cut) + PROBE + "\n" + rawGame.slice(cut);

    await send("Fetch.enable", { patterns: [{ urlPattern: "*js/game.js*" }] });
    state.timer = setInterval(() => {
      const evs = events.splice(0);
      for (const m of evs) {
        if (m.method === "Fetch.requestPaused") {
          const url = m.params.request.url;
          if (/js\/game\.js/.test(url)) {
            send("Fetch.fulfillRequest", {
              requestId: m.params.requestId,
              responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "text/javascript; charset=utf-8" }],
              body: Buffer.from(patchedGame, "utf8").toString("base64")
            }, 8000).catch(() => send("Fetch.continueRequest", { requestId: m.params.requestId }, 5000).catch(() => {}));
          } else {
            send("Fetch.continueRequest", { requestId: m.params.requestId }, 8000).catch(() => {});
          }
        } else if (m.method === "Runtime.exceptionThrown") {
          state.pageErrors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
        } else if (m.method === "Log.entryAdded") {
          state.consoleLines.push((m.params.entry || {}).level + ":" + String((m.params.entry || {}).text).slice(0, 160));
        }
      }
    }, 20);

    await send("Page.navigate", { url: "http://127.0.0.1:" + port + "/index.html" }, 15000);

    const evalJs = async (expr, ms = 10000) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }, ms);
      if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails).slice(0, 240));
      return r.result && r.result.value;
    };

    const shot = async filename => {
      const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, 20000);
      if (r && r.data) {
        const outPath = path.join(SCRATCH, filename);
        fs.writeFileSync(outPath, Buffer.from(r.data, "base64"));
        return outPath;
      }
      return null;
    };

    const pump = async (frames = 1, dtMs = 50) => {
      return await evalJs(`window.__clock ? window.__clock.pump(${frames}, ${dtMs}) : 0`);
    };

    const pumpUntil = async (pred, maxFrames = 200, batch = 4, ms = 20000) => {
      const end = Date.now() + ms;
      let f = 0;
      while (Date.now() < end && f < maxFrames) {
        const ok = await pred();
        if (ok) return ok;
        await evalJs(`window.__clock ? window.__clock.pump(${batch}, 50) : 0`);
        f += batch;
      }
      throw new Error("pumpUntil timeout after " + f + " frames");
    };

    // Wait until window.__integration is available
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        ready = await evalJs("!!(window.__integration && window.UI && window.VIEWPORT)");
        if (ready) break;
      } catch (e) { /* wait */ }
      await sleep(150);
    }
    if (!ready) throw new Error("window.__integration failed to become ready");

    return await fn({ send, evalJs, shot, pump, pumpUntil, state, port });
  } finally {
    if (state.timer) clearInterval(state.timer);
    try { if (state.ws && !state.closed) state.ws.close(); } catch (e) {}
    try { preview.kill(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    await sleep(200);
  }
}

const integrationResults = {
    item1: { status: "FAIL", details: null, shot: null },
    item2: { status: "FAIL", details: null, shot: null },
    item3: { status: "FAIL", details: null, shot: null },
    item4: { status: "FAIL", details: null, shot: null }
  };

// 原四項在同一案例約需 65s；拆成兩個獨立真頁短案例，不提高 60s 上限或移除斷言。
async function runIntegrationChecks(items) {
  assert.ok(fs.existsSync(CHROME), "Chrome binary must exist at: " + CHROME);
  const results = integrationResults;

  await withChromeIntegration(async ({ send, evalJs, shot, pump, pumpUntil }) => {
    // -------------------------------------------------------------
    // 1. night-town 零配送：終王擊殺並過 DAWN(600s)→進victory→won結算只有『回旅路地圖』一鈕；點它回overworld。
    // -------------------------------------------------------------
    if (items.includes(1)) {
    console.log("Checking Item 1: night-town zero-delivery victory -> won settlement single 'world' button -> click returns to overworld...");
    await evalJs("window.__integration.start('night-town')");
    await pump(10); // step into play
    assert.equal(await evalJs("window.__integration.getState()"), "play");
    assert.equal(await evalJs("window.__integration.getStage()"), "night-town");
    assert.equal(await evalJs("window.__integration.getDelivered()"), 0);

    // Defeat final boss and pass dawn (elapsed >= 600)
    await evalJs("window.__integration.setFinalBossDefeated(true)");
    await evalJs("window.__integration.setElapsed(600.5)");

    // Pump frames so update() detects checkVictoryCondition() and triggers victory sequence
    await pumpUntil(async () => (await evalJs("window.__integration.getState()")) === "victory", 40, 2);
    assert.equal(await evalJs("window.__integration.getState()"), "victory");

    // Pump through victory sequence (5.5s settle)
    // 同樣逐幀推進與狀態斷言，減少 CDP 往返，維持單案 60s 牆鐘上限。
    await pumpUntil(async () => (await evalJs("window.__integration.getState()")) === "won", 160, 20);
    assert.equal(await evalJs("window.__integration.getState()"), "won");

    // Pump 2 more frames so runSummary is populated and UI rendered
    await pump(2);

    // Verify buttons in won state:
    const wonMenuButtons = await evalJs("window.__integration.getMenuButtons()");
    const wonEndButtons = await evalJs("window.UI.endScreenButtons('won')");

    assert.equal(wonMenuButtons.length, 1, "menuButtons in won must have exactly 1 button");
    assert.equal(wonMenuButtons[0].id, "world", "menuButtons in won must only have 'world' button");
    assert.equal(wonEndButtons.length, 1, "UI.endScreenButtons in won must have exactly 1 button");
    assert.equal(wonEndButtons[0].id, "world", "UI.endScreenButtons in won must only have 'world' button");

    // Verify forbidden buttons cannot be activated:
    await evalJs("window.__integration.activateMenu('restart')");
    assert.equal(await evalJs("window.__integration.getState()"), "won", "restart must be ignored in won state");
    await evalJs("window.__integration.activateMenu('menu')");
    assert.equal(await evalJs("window.__integration.getState()"), "won", "menu must be ignored in won state");

    // Take won screen screenshot
    const shot1 = await shot("item1-zero-delivery-won.png");

    // Click 'world' button to return to overworld
    await evalJs("window.__integration.setEndCooldown(0)");
    await evalJs("window.__integration.activateMenu('world')");
    await pump(2);
    const stateAfterWorld = await evalJs("window.__integration.getState()");
    assert.equal(stateAfterWorld, "overworld", "activateMenu('world') must transition to 'overworld'");

    results.item1 = {
      status: "PASS",
      details: {
        stage: "night-town",
        delivered: 0,
        elapsed: 600.5,
        wonButtons: wonMenuButtons.map(b => b.id),
        stateAfterClickWorld: stateAfterWorld
      },
      shot: shot1
    };
    console.log("Item 1 PASS:", results.item1.details);
    }

    // -------------------------------------------------------------
    // 2. lost 結算三鈕不變(restart/menu/world或現有三個id)。
    // -------------------------------------------------------------
    if (items.includes(2)) {
    console.log("Checking Item 2: lost settlement 3 buttons (restart/world/menu)...");
    await evalJs("window.__integration.start('night-town')");
    await pump(10);
    assert.equal(await evalJs("window.__integration.getState()"), "play");

    await evalJs("window.__integration.loseRun()");
    await pumpUntil(async () => (await evalJs("window.__integration.getState()")) === "lost", 100, 20);
    assert.equal(await evalJs("window.__integration.getState()"), "lost");
    await pump(2);

    const lostEndButtons = await evalJs("window.UI.endScreenButtons('lost')");
    const lostMenuButtons = await evalJs("window.__integration.getMenuButtons()");

    const lostEndIds = lostEndButtons.map(b => b.id);
    assert.equal(lostEndIds.length, 3, "UI.endScreenButtons('lost') must have 3 buttons");
    assert.ok(lostEndIds.includes("restart"), "lost must include restart");
    assert.ok(lostEndIds.includes("world"), "lost must include world");
    assert.ok(lostEndIds.includes("menu"), "lost must include menu");

    const lostMenuIds = lostMenuButtons.map(b => b.id);
    assert.ok(lostMenuIds.includes("restart"), "menuButtons must include restart");
    assert.ok(lostMenuIds.includes("world"), "menuButtons must include world");
    assert.ok(lostMenuIds.includes("menu"), "menuButtons must include menu");

    const shot2 = await shot("item2-lost-settlement.png");
    results.item2 = {
      status: "PASS",
      details: {
        lostEndButtons: lostEndIds,
        lostMenuButtons: lostMenuIds
      },
      shot: shot2
    };
    console.log("Item 2 PASS:", results.item2.details);
    }

    // -------------------------------------------------------------
    // 3. 結算畫面顯示 MM:SS 且暫停時間不計入(暫停N秒後再恢復，elapsedSeconds不變)。
    // -------------------------------------------------------------
    if (items.includes(3)) {
    console.log("Checking Item 3: MM:SS display & pause time excluded from elapsedSeconds...");
    await evalJs("window.__integration.start('night-town')");
    await pumpUntil(async () => await evalJs("window.ART_READY === true"), 80, 4, 10000);
    await pump(20); // 1s
    const elapsedBeforePause = await evalJs("window.__integration.getElapsed()");
    assert.ok(elapsedBeforePause > 0.5, "elapsed should advance in play state");

    // Pause the game
    await evalJs("window.__integration.togglePause()");
    assert.equal(await evalJs("window.__integration.getState()"), "pause");

    // Advance 60 frames (3.0s simulated time) during pause in batches
    for (let i = 0; i < 6; i++) await pump(10);
    const elapsedDuringPause = await evalJs("window.__integration.getElapsed()");
    assert.equal(elapsedDuringPause, elapsedBeforePause, "elapsed MUST NOT advance while game is paused");

    // Unpause the game
    await evalJs("window.__integration.togglePause()");
    assert.equal(await evalJs("window.__integration.getState()"), "play");

    // Advance 20 frames (1.0s)
    await pump(20);
    const elapsedAfterResume = await evalJs("window.__integration.getElapsed()");
    assert.ok(elapsedAfterResume > elapsedBeforePause, "elapsed should resume advancing after unpause");

    // Set elapsed = 602.4s (10 min 02.4s -> "10:02", >= DAWN so victory triggers in night-town)
    await evalJs("window.__integration.setElapsed(602.4)");
    await evalJs("window.__integration.setFinalBossDefeated(true)");
    await pumpUntil(async () => (await evalJs("window.__integration.getState()")) === "victory", 40, 2);
    await pumpUntil(async () => (await evalJs("window.__integration.getState()")) === "won", 160, 20);
    await pump(2);

    const summary = await evalJs("window.__integration.getRunSummary()");
    assert.ok(Math.abs(summary.elapsedSeconds - 602.45) < 0.05, "runSummary.elapsedSeconds must match exact elapsed snapshot");
    assert.equal(Math.floor(summary.elapsedSeconds), 602, "elapsedSeconds floored must be 602 seconds");

    // Inspect rendered texts from canvas context fillText
    const capturedTexts = await evalJs("window.__cap.map(c => c.text)");
    const timeTextMatch = capturedTexts.some(t => t.includes("本局  10:02"));
    assert.ok(timeTextMatch, "Settlement screen must render formatted MM:SS: '本局  10:02'");

    // Also verify <10min format (e.g. 582s -> "09:42")
    await evalJs(`
      var cv = document.getElementById('game');
      var ctx = cv.getContext('2d');
      window.UI.drawEndScreen(ctx, 'won', 1000, 0, 0, [], 0, { elapsedSeconds: 582.0 });
    `);
    const capturedTextsUnder10Min = await evalJs("window.__cap.map(c => c.text)");
    assert.ok(capturedTextsUnder10Min.some(t => t.includes("本局  09:42")), "Must format <10min as MM:SS (e.g. '本局  09:42')");

    const shot3 = await shot("item3-settlement-mmss.png");
    results.item3 = {
      status: "PASS",
      details: {
        elapsedBeforePause,
        elapsedDuringPause,
        pauseExcluded: elapsedDuringPause === elapsedBeforePause,
        elapsedSeconds: summary.elapsedSeconds,
        formattedMMSS_1002: timeTextMatch,
        formattedMMSS_0942: true
      },
      shot: shot3
    };
    console.log("Item 3 PASS:", results.item3.details);
    }

    // -------------------------------------------------------------
    // 4. 修行進階卡片 desktop1000x700／手機844x390／平板1024x640 無空白重疊(取一張截圖即可)。
    // -------------------------------------------------------------
    if (items.includes(4)) {
    console.log("Checking Item 4: levelup cards across 3 viewports without blank overlapping...");
    const viewports = [
      { name: "desktop-1000x700", w: 1000, h: 700 },
      { name: "phone-844x390", w: 844, h: 390 },
      { name: "tablet-1024x640", w: 1024, h: 640 }
    ];

    const vpResults = [];
    let tabletShotPath = null;

    for (const vp of viewports) {
      await send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.h < 500 });
      const layoutInfo = await evalJs(`
        (function() {
          window.VIEWPORT.calculate(${vp.w}, ${vp.h});
          var cv = document.getElementById('game');
          cv.width = ${vp.w};
          cv.height = ${vp.h};
          cv.style.width = '${vp.w}px';
          cv.style.height = '${vp.h}px';
          var ctx = cv.getContext('2d');

          var choices = [
            { id:'charm_cadence', type:'charm', n:'疾奏守', s:'しっそう', levelText:'◆ 御守加持',
              d:'妖刀、靈陣、靈針攻擊冷卻小幅縮短（有效頻率 +0.25）；保留每招冷卻下限與 Lv5 固有節奏，不加速雷雲、火龍或時鐘',
              requirementText:'御守槽位未滿（最多 3 種）', limitText:'每局最多佩戴 3 款不同御守（不可重複取得）' },
            { id:'charm_reach', type:'charm', n:'遠霞守', s:'とおがすみ', levelText:'◆ 御守加持',
              d:'妖刀、靈陣、靈針射程與符咒爆炸半徑 +10%；飛行物同步射程快照，保留 Lv5 上限與安全區判定',
              requirementText:'御守槽位未滿（最多 3 種）', limitText:'每局最多佩戴 3 款不同御守（不可重複取得）' },
            { id:'duo_inkfire', type:'duo', n:'墨焰斬', s:'ぼくえんざん', levelText:'◆ 共鳴奧義',
              d:'妖刀命中灼燒目標時留下墨焰痕（延遲 0.12 秒、半徑 56）；至多命中 3 敵各一次，總傷害為該次非暴擊刀傷 20% 分攤（無再派生）',
              requirementText:'持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+',
              limitText:'每局限選一次（不占主動、御守、變異槽位；每次攻擊有觸發上限、無再派生）',
              skillIds:['katana','fire'] }
          ];
          var WL = { katana: 3, fire: 3, needle: 3, boom: 3, barrier: 3, thunder: 3 };
          var WI = { katana:{zh:'退魔妖刀'}, fire:{zh:'狐火炎'}, barrier:{zh:'淨化靈陣'}, thunder:{zh:'天狐雷'}, needle:{zh:'天狐靈針'}, boom:{zh:'陰陽符'} };

          var v = window.VIEWPORT.get();
          ctx.setTransform(v.scale, 0, 0, v.scale, v.offsetX * v.scale, v.offsetY * v.scale);
          ctx.clearRect(0, 0, v.width, v.height);
          window.UI.drawLevelUp(ctx, 3, choices, WL, WI, 2, 1.0, 0, 'keyboard', null);

          var L = window.UI.levelUpLayout(3);
          var card0_bottom = L.card.y + L.card.h;
          var card1_top = L.card.y + L.card.h + L.card.gap;
          var card1_bottom = card1_top + L.card.h;
          var card2_top = card1_top + L.card.h + L.card.gap;
          var card2_bottom = card2_top + L.card.h;

          return {
            scale: L.scale,
            gap: L.card.gap,
            cardH: L.card.h,
            cardW: L.card.w,
            cssCardH: Math.round(L.card.h * L.scale),
            card0_bottom: card0_bottom,
            card1_top: card1_top,
            card1_bottom: card1_bottom,
            card2_top: card2_top,
            card2_bottom: card2_bottom,
            rerollY: L.reroll.y,
            noCardOverlap: (card0_bottom <= card1_top) && (card1_bottom <= card2_top),
            noRerollOverlap: card2_bottom <= L.reroll.y
          };
        })()
      `);

      assert.ok(layoutInfo.gap >= 0, vp.name + " card gap must be non-negative");
      assert.ok(layoutInfo.noCardOverlap, vp.name + " cards must not overlap each other");
      assert.ok(layoutInfo.noRerollOverlap, vp.name + " cards must not overlap reroll button");
      assert.ok(layoutInfo.cssCardH >= 44, vp.name + " card height in CSS must be >= 44px");

      const shotPath = await shot("levelup-" + vp.name + ".png");
      if (vp.name === "tablet-1024x640") {
        tabletShotPath = shotPath;
      }
      vpResults.push({ vp: vp.name, layout: layoutInfo, shot: shotPath });
    }

    results.item4 = {
      status: "PASS",
      details: vpResults,
      shot: tabletShotPath
    };
    console.log("Item 4 PASS:", vpResults.map(r => ({ vp: r.vp, cssH: r.layout.cssCardH, gap: r.layout.gap })));
    }
  });

  // Save final summary JSON
  const summaryFile = path.join(SCRATCH, "integration-report.json");
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2), "utf8");
  console.log("Integration check finished. Report written to:", summaryFile);

  for (const item of items) assert.equal(results['item' + item].status, "PASS");
}

test("M1-INTEGRATION-CHECK: victory/loss true-page consumers", { timeout: 60000 }, () => runIntegrationChecks([1, 2]));
test("M1-INTEGRATION-CHECK: elapsed/pause and three-viewport cards", { timeout: 60000 }, () => runIntegrationChecks([3, 4]));
