"use strict";

// 第三關房屋密度與 2.5D 景深。HTTP 注入 hook，不改磁碟上的 game.js。
// 音訊 stub，mp3 回 204 且不讀檔。headless 不是真 iPad，也不是自然十分鐘通關。

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/validation/stage3-density-depth-20261014");
const PORT = 8804;
const CDP_PORT = 8805;
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
window.__nativeRaf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = () => 0;
window.Audio = class { constructor(src){ this.src = src; } addEventListener(){} load(){} pause(){} play(){ return Promise.resolve(); } };
`;
const AUDIO_STUB = `window.__audioCalls=[]; window.AUDIO=new Proxy({}, {get:(_,k)=> (...args)=>{ window.__audioCalls.push(String(k)); if(k==='isMuted') return ()=>true; }});`;
const HOOK = `
window.__densityQA = {
  boot() {
    start("sakura-pass");
    titleCardT = 0;
    spawnT = Infinity;
    surgeT = Infinity;
    bossT = Infinity;
    return this.snap();
  },
  frame() { frame(performance.now() || 16); },
  pump(now) { frame(now); },
  tilt(value) {
    VIEWPORT.setTiltScale(value);
    RENDERER.setCam(P.x - 450, P.y - 300 / value);
    return this.snap();
  },
  north() {
    P.y -= 420;
    RENDERER.setCam(P.x - 450, P.y - 300 / (VIEWPORT.tiltScale() || 1));
    return this.snap();
  },
  approach() {
    tutorialSkipped = true;
    tutorial = null;
    if (!orders.length) makeOrder();
    const target = orders[0] && orders[0].to;
    if (!target) return { arrived: false, left: null };
    const origin = { x: P.x, y: P.y };
    let left = 999;
    for (let i = 0; i < 420; i++) {
      const dx = target.x - P.x;
      const dy = target.y - P.y;
      left = Math.hypot(dx, dy);
      if (left < 150) return { arrived: true, steps: i, left: Math.round(left) };
      keys.clear();
      if (dx > 12) keys.add("r");
      if (dx < -12) keys.add("l");
      if (dy > 12) keys.add("d");
      if (dy < -12) keys.add("u");
      update(1 / 30);
      keys.clear();
    }
    return {
      arrived: false, left: Math.round(left), state,
      moved: Math.round(Math.hypot(P.x - origin.x, P.y - origin.y)),
      art: window.ART_READY === true
    };
  },
  snap() {
    const view = VIEWPORT.get();
    const tilt = VIEWPORT.tiltScale();
    const camX = P.x - 450;
    const camY = P.y - 300 / tilt;
    const area = {
      left: -(view.width - 900) / 2,
      right: 900 + (view.width - 900) / 2,
      top: -(view.height - 600) / 2,
      bottom: 600 + (view.height - 600) / 2
    };
    const visible = houses.filter(house => {
      const sx = house.x - camX;
      const sy = (house.y - camY) * tilt;
      return sx >= area.left - 20 && sx <= area.right + 20 && sy >= area.top - 40 && sy <= area.bottom + 40;
    });
    const order = orders[0];
    return {
      ids: houses.map(house => house.id).sort(),
      loaded: houses.length,
      visible: visible.length,
      visibleIds: visible.map(house => house.id).sort(),
      tilt,
      depth: RENDERER.sceneryDepth(P.y - 480, P.y),
      near: RENDERER.sceneryDepth(P.y, P.y),
      stage: STAGE.id,
      cards: typeof CARD_DELIVERY !== "undefined" && typeof CARD_DELIVERY.choose === "function",
      order: order ? {
        jp: order.word.jp,
        dist: Math.round(Math.hypot(order.to.x - order.from.x, order.to.y - order.from.y))
      } : null
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
        message.error ? pending.reject(Error(JSON.stringify(message.error))) : pending.resolve(message.result);
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
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error(method + " timeout")); }, 20000);
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
    const result = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(result.data, "base64"));
    return name;
  }
}
async function until(fn, label) {
  for (let i = 0; i < 120; i++) {
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
    const shots = [];
    const views = [
      { label: "desktop", width: 1280, height: 800 },
      { label: "tablet", width: 1194, height: 834 }
    ];
    let approach = null;
    let fps = null;
    let baseIds = null;
    for (const view of views) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: view.width, height: view.height, deviceScaleFactor: 1, mobile: false
      });
      await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?dev=1&tilt=1` });
      await until(() => cdp.eval("!!window.__densityQA && !!window.CARD_DELIVERY"), "runtime");
      await cdp.eval("__densityQA.boot()");
      await until(() => cdp.eval("!!(window.SAKURA_ART && window.SAKURA_ART.pavilion && window.SAKURA_ART.pavilion.naturalWidth)"), "pavilion");
      for (const tilt of [1, 0.6]) {
        const snap = await cdp.eval(`__densityQA.tilt(${tilt})`);
        await cdp.eval("__densityQA.frame()");
        const file = await cdp.shot(`${view.label}-${tilt === 1 ? "2d" : "25d"}.png`);
        if (!baseIds) baseIds = snap.ids;
        else assert.deepEqual(snap.ids, baseIds);
        assert.equal(snap.stage, "sakura-pass");
        assert.equal(snap.cards, true);
        assert.ok(snap.visible >= 1 && snap.visible <= 4, snap.visible);
        assert.ok(snap.order && snap.order.dist > 420 && snap.order.dist < 2000);
        assert.equal(snap.near.blur, 0);
        if (tilt === 0.6) assert.ok(snap.depth.scale <= 0.9 && snap.depth.scale >= 0.85);
        if (tilt === 1) assert.equal(snap.depth.scale, 1);
        shots.push({ file, view, tilt, visible: snap.visible, loaded: snap.loaded, order: snap.order, depth: snap.depth });
      }
      if (view.label === "desktop") {
        await until(() => cdp.eval("window.ART_READY !== false"), "art");
        approach = await cdp.eval("__densityQA.approach()");
        assert.equal(approach.arrived, true, JSON.stringify(approach));
        await cdp.eval("__densityQA.boot()");
        await cdp.eval("__densityQA.tilt(0.6)");
        const moved = await cdp.eval("__densityQA.north(); __densityQA.frame(); __densityQA.snap()");
        shots.push({ file: await cdp.shot("desktop-25d-north.png"), view, tilt: 0.6, moved: true, visible: moved.visible, depth: moved.depth });
        assert.ok(moved.depth.scale <= 0.9 && moved.depth.scale >= 0.85);
      }
    }
    fps = await cdp.eval(`new Promise(resolve => {
      let n = 0; const t0 = performance.now();
      function tick(now) { __densityQA.pump(now); n++; if (now - t0 < 1000) __nativeRaf(tick); else resolve(n); }
      __nativeRaf(tick);
    })`);
    assert.equal(cdp.errors.length, 0);
    const evidence = {
      status: "PASS",
      hook: "HTTP 注入 __densityQA。同一局切 2D/2.5D，房屋 id 不變。不是真 iPad，不是自然十分鐘通關。",
      shots,
      approach,
      headlessFramesInOneSecond: fps,
      audio: { mp3FileReads: traffic.audioFileReads, http204: traffic.audio204 },
      uncaught: cdp.errors
    };
    fs.writeFileSync(path.join(OUT, "chrome.json"), JSON.stringify(evidence, null, 2));
    console.log(`PASS visible desktop shots; approach left=${approach.left}; headless frames/s=${fps}; mp3 reads=${traffic.audioFileReads}`);
  } catch (error) {
    fs.writeFileSync(path.join(OUT, "chrome-failure.json"), JSON.stringify({
      message: error.message, stack: error.stack, audio: traffic, uncaught: cdp ? cdp.errors : []
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
