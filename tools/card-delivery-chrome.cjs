"use strict";

// 真 Chrome 檢查言靈圖鑑配送接線。
// HTTP 才注入 __cardQA，不改磁碟上的 game.js。
// js/audio.js 改回傳靜音 stub；/assets/audio 與 .mp3 回 204，不讀現役音檔。
// 這不是自然十分鐘通關，也不是實體平板。

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/validation/card-delivery-runtime-20261014");
const PORT = 8796;
const CDP_PORT = 8797;
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
window.requestAnimationFrame = () => 0;
window.Audio = class { constructor(src){ this.src = src; } addEventListener(){} load(){} pause(){} play(){ return Promise.resolve(); } };
`;
const AUDIO_STUB = `window.__audioCalls=[]; window.AUDIO=new Proxy({}, {get:(_,k)=> (...args)=>{ window.__audioCalls.push(String(k)); if(k==='isMuted') return ()=>true; }});`;
const HOOK = `
window.__cardQA = {
  start(id) {
    start(id);
    titleCardT = 0;
    spawnT = Infinity;
    surgeT = Infinity;
    bossT = Infinity;
    return this.order();
  },
  order() {
    const o = orders[0];
    if (!o || !o.word) return null;
    const listed = ALL.find(w => w.jp === o.word.jp);
    return { jp: o.word.jp, eventId: o.cardEventId, sameObject: o.word === listed };
  },
  miss() {
    const o = orders[0];
    inter = o;
    interact();
    job.lock = 0;
    const wrong = job.ans.findIndex(w => w !== job.word);
    const jp = job.word.jp;
    resolve(wrong);
    return { jp, delivered, state, jobLeft: !!job };
  },
  finish() {
    const jp = job.word.jp;
    const id = job.cardEventId;
    resolve(job.ans.indexOf(job.word));
    return { jp, id, delivered, state, jobLeft: !!job };
  },
  boss() {
    const word = ALL.find(w => !orders.some(o => o.word && o.word.jp === w.jp)) || ALL[0];
    const before = localStorage.getItem("yokai-delivery-dev-cards-v1");
    const bs = { x: P.x + 220, y: P.y, type: "boss", word, hp: 999, max: 999, shield: true };
    enemies.push(bs);
    bossQ = mkQ(bs);
    bossQ.lock = 0;
    answerBoss(bossQ.ans.indexOf(word));
    return { jp: word.jp, shield: bs.shield, before, after: localStorage.getItem("yokai-delivery-dev-cards-v1") };
  },
  storage() {
    return {
      devCards: localStorage.getItem("yokai-delivery-dev-cards-v1"),
      officialCards: localStorage.getItem("yokai-delivery-cards-v1"),
      officialLearning: localStorage.getItem("yokai-delivery-v1"),
      devLearning: localStorage.getItem("yokai-delivery-dev-v1")
    };
  }
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
        if (pathname === "/index.html") {
          data = data.toString("utf8").replace("<head>", `<head><script>${INIT}</script>`);
        }
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
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?dev=1&tilt=1` });
    await until(() => cdp.eval("!!window.__cardQA && !!window.CARD_DELIVERY && !!window.CARD_COLLECTION"), "card runtime");
    const opened = await cdp.eval("__cardQA.start('night-town')");
    assert.equal(opened.sameObject, true);
    assert.equal(typeof opened.eventId, "string");
    const missed = await cdp.eval("__cardQA.miss()");
    assert.equal(missed.jobLeft, true);
    assert.equal(missed.delivered, 0);
    const afterMiss = await cdp.eval("__cardQA.storage()");
    assert.equal(afterMiss.devCards, null);
    const done = await cdp.eval("__cardQA.finish()");
    assert.equal(done.jp, opened.jp);
    assert.equal(done.id, opened.eventId);
    assert.equal(done.delivered, 1);
    assert.equal(done.state, "play");
    assert.equal(done.jobLeft, false);
    const saved = await cdp.eval("__cardQA.storage()");
    const devCards = JSON.parse(saved.devCards);
    assert.equal(devCards.marks[opened.jp], 1);
    assert.deepEqual(Object.keys(devCards.events), [opened.eventId]);
    assert.equal(saved.officialCards, null);
    assert.equal(saved.officialLearning, null);
    assert.equal(JSON.parse(saved.devLearning).marks, undefined);
    const boss = await cdp.eval("__cardQA.boss()");
    assert.equal(boss.shield, false);
    assert.equal(boss.before, boss.after);
    assert.equal(cdp.errors.length, 0);
    const evidence = {
      status: "PASS",
      hook: "HTTP 注入 __cardQA。凍結 requestAnimationFrame。不是自然十分鐘通關，不是實體裝置。",
      url: `http://127.0.0.1:${PORT}/index.html?dev=1&tilt=1`,
      viewport: { width: 1280, height: 800 },
      order: opened,
      missed,
      done,
      devMarks: devCards.marks,
      boss,
      audio: { stubbedScript: true, mp3FileReads: traffic.audioFileReads, http204: traffic.audio204 },
      uncaught: cdp.errors
    };
    fs.writeFileSync(path.join(OUT, "chrome.json"), JSON.stringify(evidence, null, 2));
    console.log(`PASS chrome dev delivery ${opened.jp} mark=1; official card key untouched; mp3 reads=${traffic.audioFileReads}`);
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
