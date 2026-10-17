"use strict";

// 套卡收藏的真 Chrome。印記是注入的，不是自然集齊。
// js/audio.js 改回傳靜音 stub；音檔路徑回 204，不讀現役音檔。

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/validation/c4-cursor-20261014");
const PORT = 8830;
const CDP_PORT = 8831;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml"
};
const INIT = `
localStorage.setItem('yokai-tutorial-v1','"skip"');
localStorage.setItem('yokai-delivery-cards-v1', JSON.stringify({ v: 1, marks: { "ねこ": 1 }, events: { "injected-official": true }, awards: {} }));
localStorage.setItem('yokai-delivery-dev-cards-v1', JSON.stringify({ v: 1, marks: { "ねこ": 4, "いぬ": 4, "うさぎ": 4 }, events: { "injected-dev": true }, awards: { "animals": true } }));
window.requestAnimationFrame = () => 0;
window.Audio = class { constructor(src){ this.src = src; } addEventListener(){} load(){} pause(){} play(){ return Promise.resolve(); } };
`;
const AUDIO_STUB = `window.__audioCalls=[]; window.AUDIO=new Proxy({}, {get:(_,k)=> (...args)=>{ window.__audioCalls.push(String(k)); if(k==='isMuted') return ()=>true; }});`;
const HOOK = `
const seen = [];
const fill = ctx.fillText.bind(ctx);
ctx.fillText = function(text) { seen.push(String(text)); return fill.apply(ctx, arguments); };
window.__c4QA = {
  note: "印記由本工具注入，不是自然集齊",
  take() { const copy = seen.slice(); seen.length = 0; return copy; },
  draw() { frame(performance.now() || 0); return this.take(); },
  open() { activateMenu("codex"); return { state, tab: codexTab, key: CARD_DELIVERY.openCards(localStorage, location).key }; }
};
`;

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url, "http://127.0.0.1").pathname;
      if (pathname.startsWith("/assets/audio/") || pathname.endsWith(".mp3")) {
        res.writeHead(204).end();
        return;
      }
      if (pathname === "/js/audio.js") {
        res.writeHead(200, { "Content-Type": MIME[".js"] }).end(AUDIO_STUB);
        return;
      }
      const file = path.resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(ROOT + path.sep) || !MIME[path.extname(file)]) {
        res.writeHead(404).end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end(); return; }
        if (pathname === "/index.html") data = data.toString("utf8").replace("<head>", `<head><script>${INIT}</script>`);
        if (pathname === "/js/game.js") {
          const source = data.toString("utf8");
          const end = source.lastIndexOf("})();");
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
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = event => { const message = JSON.parse(event.data); const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); clearTimeout(pending.timer); if (message.error) pending.reject(Error(JSON.stringify(message.error))); else pending.resolve(message.result); }; }
  static async connect(url) { const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }); return new CDP(ws); }
  send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++this.id; const timer = setTimeout(() => { this.pending.delete(id); reject(Error(method + " timeout")); }, 20000); this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
  async shot(name) { const image = await this.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, name), Buffer.from(image.data, "base64")); }
}
async function until(fn, label) { for (let i = 0; i < 100; i++) { if (await fn()) return; await sleep(100); } throw Error(label + " timeout"); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  let chrome, cdp;
  try {
    chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--disable-extensions", `--user-data-dir=${path.join(OUT, "chrome-profile")}`, `--remote-debugging-port=${CDP_PORT}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    await until(async () => { try { return (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok; } catch { return false; } }, "CDP");
    const pages = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    cdp = await CDP.connect(pages.find(page => page.type === "page").webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const shots = [];
    for (const [width, height, query, expect] of [[1280, 800, "", "動物街 0/3"], [1194, 834, "?dev=1", "動物街 3/3"], [844, 390, "?dev=1", "動物街 3/3"]]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html${query}` });
      await until(() => cdp.eval("!!window.__c4QA"), "c4 " + width);
      const opened = await cdp.eval("__c4QA.open()");
      const text = await cdp.eval("__c4QA.draw()");
      await sleep(150);
      const name = `award-${width}x${height}${query ? "-dev" : "-official"}.png`;
      await cdp.shot(name);
      assert.ok(text.some(line => line.includes("收藏")), width + " summary");
      assert.ok(text.some(line => line.includes(expect)), width + " " + expect);
      assert.equal(opened.key, query ? "yokai-delivery-dev-cards-v1" : "yokai-delivery-cards-v1");
      shots.push({ name, key: opened.key, expect });
    }
    fs.writeFileSync(path.join(OUT, "chrome.json"), JSON.stringify({
      status: "PASS",
      note: "印記由 HTTP 注入，不是自然集齊。音訊腳本是 stub，音檔回 204。",
      shots
    }, null, 2));
    console.log("PASS c4 rewards chrome");
  } finally {
    cdp?.ws.close();
    chrome?.kill();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
