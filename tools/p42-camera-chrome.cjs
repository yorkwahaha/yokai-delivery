"use strict";

// P4.2 真 Chrome。HTTP hook，不改磁碟上的 game.js。音訊 stub，不讀 mp3。
// headless 視窗不是真 iPad，也不是美術合格。

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/validation/p42-cursor-20261014");
const PORT = 8816;
const CDP_PORT = 8817;
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml"
};
const INIT = `
localStorage.setItem('yokai-tutorial-v1','"skip"');
window.__nativeRaf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = () => 0;
window.__shrineWidths = [];
const __draw = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) {
  const src = img && (img.currentSrc || img.src || "");
  if (String(src).includes("shrine_pavilion") && args.length >= 4) window.__shrineWidths.push(args[args.length - 2]);
  return __draw.call(this, img, ...args);
};
window.Audio = class { constructor(src){ this.src = src; } addEventListener(){} load(){} pause(){} play(){ return Promise.resolve(); } };
`;
const AUDIO_STUB = `window.AUDIO=new Proxy({}, {get:(_,k)=> (...a)=>{ if(k==='isMuted') return ()=>true; }});`;
const HOOK = `
window.__p42 = {
  boot(id) {
    start(id || "sakura-pass");
    titleCardT = 0; spawnT = surgeT = bossT = Infinity;
    tutorialSkipped = true; tutorial = null;
    return this.snap();
  },
  frame() { frame(performance.now() || 16); },
  tilt(value) { VIEWPORT.setTiltScale(value); this.frame(); return this.snap(); },
  move(dy) {
    const widths = [];
    for (let i = 0; i < 4; i++) {
      P.y += dy;
      RENDERER.setCam(P.x - 450, P.y - 300 / (VIEWPORT.tiltScale() || 1));
      window.__shrineWidths = [];
      this.frame();
      widths.push(window.__shrineWidths.slice());
    }
    return widths;
  },
  snap() {
    return {
      stage: STAGE.id,
      tilt: VIEWPORT.tiltScale(),
      zoom: VIEWPORT.worldZoom(),
      selected: VIEWPORT.selectedWorldZoom(),
      ids: houses.map(house => house.id).sort(),
      cache: RENDERER.groundCacheStats(),
      depth: RENDERER.sceneryDepth(P.y - 480, P.y),
      widths: window.__shrineWidths.slice()
    };
  }
};
`;
const traffic = { audio204: 0 };

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
      if (!file.startsWith(ROOT + path.sep) || !MIME[path.extname(file)]) { res.writeHead(404).end(); return; }
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
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id); clearTimeout(pending.timer);
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
  for (let i = 0; i < 120; i++) { if (await fn()) return; await sleep(100); }
  throw Error(label + " timeout");
}
const hashFile = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  assert.ok(fs.existsSync(CHROME), "Chrome unavailable");
  const server = await serve();
  let chrome, cdp;
  const shots = [];
  try {
    chrome = spawn(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
      "--no-first-run", "--disable-extensions", "--disable-background-networking",
      `--user-data-dir=${path.join(OUT, "chrome-profile")}`,
      `--remote-debugging-port=${CDP_PORT}`, "about:blank"
    ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    await until(async () => { try { return (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok; } catch { return false; } }, "CDP");
    const pages = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    cdp = await CDP.connect(pages.find(page => page.type === "page").webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const views = [{ label: "desktop", width: 1280, height: 800 }, { label: "tablet", width: 1194, height: 834 }];
    const zooms = ["1", "1.10", "1.15"];
    for (const view of views) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: view.width, height: view.height, deviceScaleFactor: 1, mobile: false });
      for (const zoom of zooms) {
        const query = `dev=1&tilt=1&zoom=${zoom}`;
        await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?${query}` });
        await until(() => cdp.eval("!!window.__p42"), "hook");
        await cdp.eval("__p42.boot('sakura-pass')");
        await until(() => cdp.eval("!!(window.SAKURA_ART && window.SAKURA_ART.pavilion && window.SAKURA_ART.pavilion.naturalWidth)"), "art");
        for (const tilt of [1, 0.6]) {
          const snap = await cdp.eval(`window.__shrineWidths=[]; __p42.tilt(${tilt})`);
          const file = await cdp.shot(`${view.label}-z${zoom}-${tilt === 1 ? "2d" : "25d"}.png`);
          const expected = tilt === 1 ? 1 : Number(zoom);
          assert.ok(Math.abs(snap.zoom - expected) < 1e-6, `${view.label} ${zoom} ${tilt} -> ${snap.zoom}`);
          assert.equal(snap.depth.scale, 1);
          if (tilt === 0.6) assert.ok(snap.depth.blur > 0);
          if (snap.widths.length) assert.ok(snap.widths.every(width => Math.abs(width - snap.widths[0]) <= 1));
          shots.push({ file, view, zoom, tilt, worldZoom: snap.zoom, widths: snap.widths, depth: snap.depth, cache: snap.cache });
        }
      }
    }
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html?dev=1&tilt=1&zoom=1.15` });
    await until(() => cdp.eval("!!window.__p42"), "hook2");
    await cdp.eval("__p42.boot('sakura-pass')");
    await cdp.eval("__p42.tilt(0.6)");
    const before = await cdp.eval("__p42.snap().cache.builds");
    const moved = await cdp.eval("__p42.move(-40)");
    const after = await cdp.eval("__p42.snap().cache.builds");
    const flat = moved.flat();
    assert.ok(flat.length > 0, "no shrine draws");
    assert.ok(flat.every(width => Math.abs(width - flat[0]) <= 1), JSON.stringify(flat));
    await cdp.eval("__p42.boot('night-town')");
    const town = await cdp.eval("__p42.tilt(0.6)");
    assert.equal(town.zoom, 1);
    assert.equal(cdp.errors.length, 0);
    const evidence = {
      status: "PASS",
      url: `http://127.0.0.1:${PORT}/index.html?dev=1&tilt=1&zoom=1.15`,
      hook: "HTTP __p42。同一 Z 下移動時 shrine drawImage 寬度恆定。不是真 iPad，不是美術 PASS。",
      shots,
      motionWidths: moved,
      cacheBuildsBeforeMove: before,
      cacheBuildsAfterMove: after,
      nightTownZoom: town.zoom,
      audio204: traffic.audio204,
      hashes: {
        viewport: hashFile("js/viewport.js"),
        renderer: hashFile("js/renderer.js"),
        game: hashFile("js/game.js")
      },
      uncaught: cdp.errors
    };
    fs.writeFileSync(path.join(OUT, "chrome.json"), JSON.stringify(evidence, null, 2));
    console.log(`PASS shots=${shots.length} shrineWidth=${flat[0]} cache ${before}->${after} nightZoom=${town.zoom}`);
  } catch (error) {
    fs.writeFileSync(path.join(OUT, "chrome-failure.json"), JSON.stringify({ message: error.message, stack: error.stack, audio204: traffic.audio204, uncaught: cdp ? cdp.errors : [] }, null, 2));
    throw error;
  } finally {
    cdp?.ws.close();
    chrome?.kill();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
