'use strict';
// Visual validation for Stage6 snow effect and Stage2 transition seams
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

const AUDIO_STUB = `window.AUDIO=new Proxy({}, {get:(_,k)=>k==="isMuted"?()=>true:()=>Promise.resolve()}); if(window.speechSynthesis) window.speechSynthesis.speak=()=>{};`;

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    this.requests = [];
    this.console = [];
    ws.onmessage = e => {
      const v = JSON.parse(e.data);
      const p = this.pending.get(v.id);
      if (p) {
        this.pending.delete(v.id);
        v.error ? p.reject(new Error(JSON.stringify(v.error))) : p.resolve(v.result);
      }
      if (v.method === 'Runtime.consoleAPICalled') {
        this.console.push(v.params.args.map(a => a.value).join(' '));
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
      if (safe === '/js/audio.js') {
        res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }).end(AUDIO_STUB);
        return;
      }
      if (safe.startsWith('/assets/audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(safe)) {
        res.writeHead(204).end();
        return;
      }
      if (safe === '/service-worker.js') {
        res.writeHead(200, { 'content-type': 'application/javascript' }).end('self.addEventListener("install",()=>self.skipWaiting());');
        return;
      }
      fs.readFile(name, (err, bytes) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }).end(bytes);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function testStage(stageId, width, height, label) {
  const { server, port } = await serve();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yokai-visual-' + label + '-'));
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

    const url = 'http://127.0.0.1:' + port + '/index.html?dev=1&stage=' + stageId;
    await c.send('Page.navigate', { url });

    // Wait for stage to load and enter play
    let enteredPlay = false;
    for (let n = 0; n < 200; n++) {
      await sleep(200);
      try {
        const state = await c.eval('({screen:document.body?.dataset?.gameScreen||"", stage:STAGE?.id, snowActive:!!window.SNOW, snowCount:window.SNOW?.particles?.length, tilt:VIEWPORT?.get?.()?.tilt||0, groundType:MAP?.groundKey, player:P?.hp})');
        if (state.screen === 'play' && state.stage === stageId) {
          enteredPlay = true;
          console.log(label + ' ENTERED PLAY:', JSON.stringify(state));
          break;
        }
      } catch (e) {
        console.log(label + ' wait error:', e.message);
      }
    }

    if (!enteredPlay) {
      console.log(label + ' FAILED to enter play state');
      return { success: false };
    }

    // Wait a bit for snow to spawn / transition to render
    await sleep(3000);

    // Capture 2D screenshot
    const shot2d = await c.shot('art/stage' + (stageId === 'snow-temple' ? '6' : '2') + '-' + label + '-2d.png');
    console.log(label + ' 2D screenshot:', shot2d, 'bytes');

    // Switch to 2.5D (tilt=1)
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < height });
    await c.send('Page.navigate', { url: url + '&tilt=1' });
    await sleep(3000);

    // Capture 2.5D screenshot
    const shot25d = await c.shot('art/stage' + (stageId === 'snow-temple' ? '6' : '2') + '-' + label + '-25d.png');
    console.log(label + ' 2.5D screenshot:', shot25d, 'bytes');

    // Get final state
    const finalState = await c.eval('({screen:document.body?.dataset?.gameScreen||"", stage:STAGE?.id, snowActive:!!window.SNOW, snowCount:window.SNOW?.particles?.length, tilt:VIEWPORT?.get?.()?.tilt||0, groundType:MAP?.groundKey, transitionX:MAP?.transitionX, player:P?.hp})');
    console.log(label + ' FINAL:', JSON.stringify(finalState));

    return { success: true, finalState, shot2d, shot25d };
  } finally {
    try { ws?.close(); } catch {}
    child.kill();
    server.close();
    await sleep(500);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  console.log('=== Stage6 snow-temple (snow effect) ===');
  await testStage('snow-temple', 1280, 720, 'stage6-snow');

  console.log('\n=== Stage2 rain-port (stone-wood transition) ===');
  await testStage('rain-port', 1280, 720, 'stage2-transition');

  console.log('\n=== Done ===');
}

main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });