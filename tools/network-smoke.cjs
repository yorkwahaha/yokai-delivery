'use strict';
// Network request capture smoke test for mobile/2.5D first load
// Measures actual requests/bytes for index.html, assets, and 2.5D transition
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json'
};

const AUDIO_STUB = `window.AUDIO=new Proxy({}, {get:(_,k)=>k==="isMuted"?()=>true:()=>Promise.resolve()}); if(window.speechSynthesis) window.speechSynthesis.speak=()=>{};`;

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    this.requests = [];
    ws.onmessage = e => {
      const v = JSON.parse(e.data);
      const p = this.pending.get(v.id);
      if (p) {
        this.pending.delete(v.id);
        v.error ? p.reject(new Error(JSON.stringify(v.error))) : p.resolve(v.result);
      }
      if (v.method === 'Network.requestWillBeSent') {
        this.requests.push({ url: v.params.request.url, type: v.params.type, initiator: v.params.initiator });
      }
      if (v.method === 'Network.loadingFinished') {
        const req = this.requests.find(r => r.url === v.params.requestId);
        if (req) req.bytes = v.params.encodedDataLength;
      }
    };
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    return new CDP(ws);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const data = Buffer.from(r.data, 'base64');
    fs.writeFileSync(path.join(__dirname, '..', file), data);
    return data.length;
  }
}

async function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const safe = decodeURIComponent((req.url || '/').split('?')[0]);
      const name = path.resolve(root, '.' + (safe === '/' ? '/index.html' : safe));
      if (!name.startsWith(root + path.sep) && name !== path.join(root, 'index.html')) {
        res.writeHead(403).end();
        return;
      }
      // Audio freeze: stub audio.js, 204 for audio files
      if (safe === '/js/audio.js') {
        res.writeHead(200, { 'content-type': mime['.js'], 'cache-control': 'no-store' }).end(AUDIO_STUB);
        return;
      }
      if (safe.startsWith('/assets/audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(safe)) {
        res.writeHead(204).end();
        return;
      }
      // Minimal service worker for preview
      if (safe === '/service-worker.js') {
        res.writeHead(200, { 'content-type': mime['.js'] }).end('self.addEventListener("install",()=>self.skipWaiting());');
        return;
      }
      fs.readFile(name, (err, bytes) => {
        if (err) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': mime[path.extname(name)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(bytes);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function runTest(width, height, label, selectStage) {
  const { server, port } = await serve();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yokai-net-' + label + '-'));
  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run',
    '--no-default-browser-check', '--remote-allow-origins=*', '--remote-debugging-port=0',
    '--user-data-dir=' + dir, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  let ws;
  try {
    let chromePort;
    for (let n = 0; n < 100; n++) {
      const file = path.join(dir, 'DevToolsActivePort');
      if (fs.existsSync(file)) {
        chromePort = +fs.readFileSync(file, 'utf8').split('\n')[0];
        break;
      }
      await sleep(100);
    }
    if (!chromePort) throw Error('Chrome DevTools not started');

    const pages = await (await fetch('http://127.0.0.1:' + chromePort + '/json/list')).json();
    const page = pages.find(p => p.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
    const c = new CDP(ws);

    await c.send('Network.enable');
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < height });

    const url = 'http://127.0.0.1:' + port + '/index.html' + (selectStage ? '?dev=1&stage=' + selectStage : '');
    await c.send('Page.navigate', { url });

    // Wait for initial load
    for (let n = 0; n < 180; n++) {
      await sleep(100);
      try {
        const state = await c.eval('({screen:document.body?.dataset?.gameScreen||"", loaded:!!window.MAP_ART_READY, artCount:Object.keys(window.ART||{}).length, portArt:Object.keys(window.PORT_ART||{}).length, sakuraArt:Object.keys(window.SAKURA_ART||{}).length})');
        if (state.screen && (state.screen === 'menu' || state.screen === 'map' || state.screen === 'play') && state.loaded) {
          console.log(label + ' INITIAL state:', JSON.stringify(state));
          break;
        }
      } catch {}
    }

    // If selecting a stage, navigate to it
    if (selectStage) {
      try {
        await c.eval('configureStage("' + selectStage + '"); start("' + selectStage + '");');
        for (let n = 0; n < 120; n++) {
          await sleep(100);
          try {
            const state = await c.eval('({stage:STAGE?.id, loaded:!!window.MAP_ART_READY, artCount:Object.keys(window.ART||{}).length, portArt:Object.keys(window.PORT_ART||{}).length})');
            if (state.stage === selectStage && state.loaded) {
              console.log(label + ' STAGE LOADED:', JSON.stringify(state));
              break;
            }
          } catch {}
        }
      } catch (e) {
        console.log(label + ' STAGE NAV ERROR:', e.message);
      }
    }

    // Switch to 2.5D (tilt=1) if not already
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < height });
    await c.send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + 'tilt=1' });
    await sleep(2000);

    let finalState = {};
    try {
      finalState = await c.eval('({stage:STAGE?.id, screen:document.body?.dataset?.gameScreen||"", tilt:VIEWPORT?.get?.()?.tilt||0, artCount:Object.keys(window.ART||{}).length, portArt:Object.keys(window.PORT_ART||{}).length, sakuraArt:Object.keys(window.SAKURA_ART||{}).length})');
    } catch (e) {
      console.log(label + ' FINAL STATE ERROR:', e.message);
    }
    console.log(label + ' FINAL (tilt=1):', JSON.stringify(finalState));

    // Report network stats
    const imageReqs = c.requests.filter(r => r.type === 'Image' || (r.url && r.url.match(/\.(webp|png|jpg)$/i)));
    const scriptReqs = c.requests.filter(r => r.type === 'Script' || (r.url && r.url.match(/\.js$/i)));
    const otherReqs = c.requests.filter(r => r.type && !['Image', 'Script'].includes(r.type));
    const totalBytes = c.requests.reduce((sum, r) => sum + (r.bytes || 0), 0);
    const imageBytes = imageReqs.reduce((sum, r) => sum + (r.bytes || 0), 0);

    console.log(label + ' NETWORK:');
    console.log('  Total requests:', c.requests.length);
    console.log('  Total bytes:', totalBytes);
    console.log('  Image requests:', imageReqs.length, 'bytes:', imageBytes);
    console.log('  Script requests:', scriptReqs.length);
    console.log('  Other requests:', otherReqs.length);
    console.log('  Image URLs:', imageReqs.map(r => r.url).join(', '));

    return { requests: c.requests, totalBytes, imageBytes, imageCount: imageReqs.length, finalState };
  } finally {
    try { ws?.close(); } catch {}
    child.kill();
    server.close();
    await sleep(450);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  console.log('=== Mobile portrait (390x844) cold start ===');
  await runTest(390, 844, 'mobile-cold', null);

  console.log('\n=== Desktop 2.5D (1280x720) tilt=1 cold start ===');
  await runTest(1280, 720, 'desktop-25d', null);

  console.log('\n=== Mobile Stage2 rain-port (390x844) ===');
  await runTest(390, 844, 'mobile-stage2', 'rain-port');

  console.log('\n=== Desktop Stage3 sakura-pass (1280x720) tilt=1 ===');
  await runTest(1280, 720, 'desktop-stage3', 'sakura-pass');
}

main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });