"use strict";

// 真 Chrome 看言靈圖鑑單字頁。
// HTTP 才注入 __c3QA，不改磁碟上的 game.js。
// js/audio.js 改回傳靜音 stub；/assets/audio 與 .mp3 回 204，不讀現役音檔。
// 畫面上的印記是測試注入，不是自然集齊，也不是實體裝置。

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/validation/c3-cursor-20261014");
const PORT = 8816;
const CDP_PORT = 8817;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml"
};
const INIT = `
localStorage.setItem('yokai-tutorial-v1','"skip"');
localStorage.setItem('yokai-delivery-cards-v1', JSON.stringify({ v: 1, marks: { "ねこ": 1 }, events: { "injected-official": true } }));
localStorage.setItem('yokai-delivery-dev-cards-v1', JSON.stringify({ v: 1, marks: { "ねこ": 4, "いぬ": 2 }, events: { "injected-dev": true } }));
window.requestAnimationFrame = () => 0;
window.Audio = class { constructor(src){ this.src = src; } addEventListener(){} load(){} pause(){} play(){ return Promise.resolve(); } };
`;
const AUDIO_STUB = `window.__audioCalls=[]; window.AUDIO=new Proxy({}, {get:(_,k)=> (...args)=>{ window.__audioCalls.push(String(k)); if(k==='isMuted') return ()=>true; if(k==='init'||k==='toggleMute'||k==='dropPrepared') return undefined; }});`;
const HOOK = `
const __c3Seen = [];
const __c3Fill = ctx.fillText.bind(ctx);
ctx.fillText = function(text) { __c3Seen.push(String(text)); return __c3Fill.apply(ctx, arguments); };
window.__c3QA = {
  note: "印記由本工具注入 localStorage，不是自然集齊",
  take() { const copy = __c3Seen.slice(); __c3Seen.length = 0; return copy; },
  draw() { frame(performance.now() || 0); return this.take(); },
  open() { activateMenu("codex"); return { state, back: codexBack, tab: codexTab, page: codexPage, filter: codexFilter }; },
  pause() { if (state === "play") togglePause(); return state; },
  act(id) { selectCodex(id); return { state, back: codexBack, tab: codexTab, page: codexPage, filter: codexFilter }; },
  elapsed: () => elapsed,
  place: () => ({ x: P.x, y: P.y, orders: orders.length }),
  audio: () => (window.__audioCalls || []).slice(),
  key: () => CARD_DELIVERY.openCards(localStorage, location).key,
  start: id => start(id)
};
`;
const traffic = { audio204: 0, audioFileReads: 0 };

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url, "http://127.0.0.1").pathname;
      if (pathname.startsWith("/assets/audio/") || pathname.endsWith(".mp3")) {
        traffic.audio204 += 1;
        res.writeHead(204).end();
        return;
      }
      if (pathname === "/js/audio.js") {
        res.writeHead(200, { "Content-Type": MIME[".js"], "Cache-Control": "no-store" }).end(AUDIO_STUB);
        return;
      }
      const file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(ROOT + path.sep) || !MIME[path.extname(file)]) {
        res.writeHead(404).end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404).end();
          return;
        }
        if (pathname === "/index.html") data = data.toString("utf8").replace("<head>", `<head><script>${INIT}</script>`);
        if (pathname === "/js/game.js") {
          const source = data.toString("utf8");
          const end = source.lastIndexOf("})();");
          if (end < 0) {
            res.writeHead(500).end("game closure hook missing");
            return;
          }
          data = source.slice(0, end) + HOOK + source.slice(end);
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)], "Cache-Control": "no-store" }).end(data);
      });
    });
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params.exceptionDetails);
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    return new CDP(ws);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error(method + " timeout"));
      }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async shot(name) {
    const image = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(image.data, "base64"));
  }
}

async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await sleep(100);
  }
  throw Error(label + " timeout");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  assert.ok(fs.existsSync(CHROME), "Chrome unavailable");
  const server = await serve();
  let chrome;
  let cdp;
  try {
    chrome = spawn(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
      "--no-first-run", "--disable-extensions", "--disable-background-networking",
      `--user-data-dir=${path.join(OUT, "chrome-profile")}`,
      `--remote-debugging-port=${CDP_PORT}`, "about:blank"
    ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    chrome.stderr.on("data", data => fs.appendFileSync(path.join(OUT, "chrome-stderr.log"), data));
    await until(async () => {
      try { return (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok; }
      catch { return false; }
    }, "CDP");
    const pages = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    cdp = await CDP.connect(pages.find(page => page.type === "page").webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
    await until(() => cdp.eval("!!window.__c3QA && !!window.CARD_GALLERY_UI && !!window.CARD_DELIVERY"), "gallery runtime");
    const officialOpen = await cdp.eval("__c3QA.open()");
    const officialText = await cdp.eval("__c3QA.draw()");
    await cdp.shot("official-locked.png");
    assert.equal(officialOpen.back, "menu");
    assert.equal(officialOpen.tab, "words");
    assert.equal(await cdp.eval("__c3QA.key()"), "yokai-delivery-cards-v1");
    assert.ok(officialText.includes("鎖"));
    assert.ok(officialText.includes("1/4"));
    assert.equal(officialText.includes("ねこ"), false);
    const filtered = await cdp.eval("__c3QA.act('filter-stage')");
    const filterText = await cdp.eval("__c3QA.draw()");
    await cdp.shot("official-filter.png");
    assert.equal(filtered.page, 0);
    assert.equal(filtered.filter.by, "stage");
    assert.ok(filterText.includes("關卡：夜行町"));
    assert.equal(filterText.includes("night-town"), false);
    const paged = await cdp.eval("__c3QA.act('next')");
    await cdp.eval("__c3QA.draw()");
    await cdp.shot("official-page.png");
    assert.equal(paged.page, 1);
    const backMenu = await cdp.eval("__c3QA.act('back')");
    assert.equal(backMenu.state, "menu");
    await cdp.eval("__c3QA.start('night-town')");
    await cdp.eval("__c3QA.pause()");
    const before = await cdp.eval("({ elapsed: __c3QA.elapsed(), place: __c3QA.place(), audio: __c3QA.audio().length })");
    const fromPause = await cdp.eval("__c3QA.open()");
    await cdp.eval("__c3QA.act('replay')");
    const during = await cdp.eval("({ elapsed: __c3QA.elapsed(), place: __c3QA.place(), audio: __c3QA.audio().length, state: __c3QA.act('back').state })");
    assert.equal(fromPause.back, "pause");
    assert.equal(during.elapsed, before.elapsed);
    assert.equal(during.place.x, before.place.x);
    assert.equal(during.place.orders, before.place.orders);
    assert.equal(during.audio, before.audio);
    assert.equal(during.state, "pause");

    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?dev=1` });
    await until(() => cdp.eval("!!window.__c3QA && !!window.CARD_GALLERY_UI"), "dev gallery");
    const devOpen = await cdp.eval("__c3QA.open()");
    const devText = await cdp.eval("__c3QA.draw()");
    await cdp.shot("dev-open.png");
    assert.equal(devOpen.tab, "words");
    assert.equal(await cdp.eval("__c3QA.key()"), "yokai-delivery-dev-cards-v1");
    assert.ok(devText.includes("ねこ"));
    assert.ok(devText.includes("貓"));
    assert.ok(devText.includes("4/4"));
    assert.ok(devText.includes("待解鎖插畫"));
    assert.ok(devText.includes("鎖"));
    assert.ok(devText.includes("2/4"));
    assert.equal(devText.includes("いぬ"), false);
    assert.equal(devText.includes("🐱"), false);
    const views = [[1280, 800], [1194, 834], [844, 390]];
    for (const [width, height] of views) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?dev=1` });
      await until(() => cdp.eval("!!window.__c3QA && !!window.CARD_GALLERY_UI"), "gallery " + width);
      await cdp.eval("__c3QA.open()");
      const text = await cdp.eval("__c3QA.draw()");
      await sleep(150);
      await cdp.shot(`read-${width}x${height}.png`);
      assert.ok(text.includes("4/4"), width + " open mark");
      assert.ok(text.includes("ねこ") && text.includes("貓"), width + " reading");
      assert.ok(text.includes("鎖") && text.includes("2/4"), width + " locked");
      assert.equal(text.includes("いぬ"), false, width + " sealed");
    }
    assert.equal(cdp.errors.length, 0);
    const evidence = {
      status: "PASS",
      hook: "HTTP 注入 __c3QA。localStorage 印記是測試注入，不是自然集齊。凍結 requestAnimationFrame。不是實體裝置。",
      viewport: { width: 1280, height: 800 },
      official: { open: officialOpen, filtered, paged, back: backMenu.state },
      pause: { before, during },
      dev: { key: "yokai-delivery-dev-cards-v1", showsOpenCat: true },
      shots: ["official-locked.png", "official-filter.png", "official-page.png", "dev-open.png", "read-1280x800.png", "read-1194x834.png", "read-844x390.png"],
      audio: { stubbedScript: true, mp3FileReads: traffic.audioFileReads, http204: traffic.audio204 },
      uncaught: cdp.errors
    };
    fs.writeFileSync(path.join(OUT, "chrome.json"), JSON.stringify(evidence, null, 2));
    console.log("PASS c3 gallery chrome; injected marks, not a natural collection");
  } catch (error) {
    fs.writeFileSync(path.join(OUT, "chrome-failure.json"), JSON.stringify({
      message: error.message,
      stack: error.stack,
      audio: traffic,
      uncaught: cdp ? cdp.errors : []
    }, null, 2));
    throw error;
  } finally {
    cdp?.ws.close();
    chrome?.kill();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
