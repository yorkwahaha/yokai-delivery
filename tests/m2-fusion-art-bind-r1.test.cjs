'use strict';

// tests/m2-fusion-art-bind-r1.test.cjs
// M2-FUSION-ART-BIND-R1：融合候選圖「真圖 phase 綁定」focused 測試（唯一新增測試檔）。
//
// 邊界：
//  - 只讀 production 檔（js/assets.js、js/renderer.js、js/fusion.js）與 art/fusion/candidates/**。
//  - 唯一寫入：scratch/m2-fusion-art-bind-r1/**（報告、截圖、暫存）。
//  - 不改 js/**、不改原圖、不搬移素材、不覆蓋正式資產。
//  - 一律以 --require ./tools/director-audio-freeze.cjs 執行（音訊凍結）。
//
// 驗證矩陣：
//   A. 靜態：js/assets.js 的 FUSION_ART_BIND_SOURCES 真實對應磁碟檔（存在／SHA／尺寸）；
//      嚴格門檻（dev=1 & stage=rain-port & fusioncandidate=1 & fusionart=banana）；
//      融合 mechanics（js/fusion.js 配方傷害／冷卻）未被本票改動。
//   B. 真 decode + alpha：逐檔 Pillow（若可用）＋瀏覽器 Canvas 解碼統計 alpha。
//   C. HTTP 200：四招完整 phase（main/hit/ground/icon）經本機伺服器皆 200 且非空。
//   D. 負向入口四種：無 dev／錯 stage／無 fusioncandidate／非 banana → 零候選請求。
//   E. 正向：十招逐一 cast → 真實 canvas drawImage 消費候選圖。
//   F. 截圖：tilt=.60（2.5D）與 tilt=1.0（flat 2D）各一張短鏡頭。

require('../tools/director-audio-freeze.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'm2-fusion-art-bind-r1');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BIND_URL = '?dev=1&stage=rain-port&fusioncandidate=1&fusionart=banana';

const KINDS = [
  'fusion_inkblade',
  'fusion_slashwheel',
  'fusion_foxiai',
  'fusion_exorcistblade',
  'fusion_foxfirebarrier',
  'fusion_foxthunderlantern',
  'fusion_flamefestival',
  'fusion_thundercircle',
  'fusion_exorcistseal',
  'fusion_thundertalisman'
];
// 四招完整 phase（main/hit/ground/icon 皆有檔）
const FULL_PHASE_KINDS = ['fusion_foxiai', 'fusion_exorcistblade', 'fusion_foxfirebarrier', 'fusion_exorcistseal'];
const PHASES = ['main', 'hit', 'ground', 'icon'];

const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN = path.join(OUT, 'run-' + stamp);

// ---------------------------------------------------------------------------
// A. 靜態：從 production js/assets.js 取出真實綁定表
// ---------------------------------------------------------------------------
function readBindSources() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'assets.js'), 'utf8');
  const start = src.indexOf('const FUSION_ART_BIND_SOURCES = Object.freeze({');
  assert.ok(start >= 0, 'js/assets.js 找不到 FUSION_ART_BIND_SOURCES');
  // 抓整個 const 區塊（以第一個 "\n});" 結尾）
  const end = src.indexOf('\n});', start);
  assert.ok(end > start, 'js/assets.js 的 FUSION_ART_BIND_SOURCES 區塊未閉合');
  const block = src.slice(start, end + 4).replace('const FUSION_ART_BIND_SOURCES =', 'globalThis.__T =');
  const ctx = { globalThis: {} };
  vm.runInNewContext(block, ctx, { filename: 'assets-bind-sources.js' });
  return { table: ctx.globalThis.__T, raw: src };
}

test('A1 靜態：十招真圖綁定表與磁碟檔一一對應（存在／SHA／尺寸）', () => {
  const { table } = readBindSources();
  assert.deepEqual(Object.keys(table).sort(), KINDS.slice().sort(), '綁定表必須剛好涵蓋十招');
  for (const kind of KINDS) {
    const phases = table[kind];
    assert.ok(phases.main, kind + ' 缺 main phase 綁定');
    for (const phase of PHASES) {
      const def = phases[phase];
      if (!def) {
        assert.ok(!FULL_PHASE_KINDS.includes(kind), kind + ' 為完整 phase 招，' + phase + ' 不可缺');
        continue;
      }
      const abs = path.join(ROOT, def.file.replace(/\//g, path.sep));
      assert.ok(fs.existsSync(abs), kind + '/' + phase + ' 檔案不存在：' + def.file);
      const size = fs.statSync(abs).size;
      assert.ok(size > 0, kind + '/' + phase + ' 檔案為空');
      assert.equal(sha256(abs), def.sha256, kind + '/' + phase + ' SHA 不符（來源圖不可被竄改）');
      // 尺寸以 Pillow 實測為準（見 B1）；此處先確保宣告尺寸為正
      assert.ok(def.size[0] > 0 && def.size[1] > 0, kind + '/' + phase + ' 宣告尺寸無效');
      assert.ok(Array.isArray(def.bbox) && def.bbox.length === 4, kind + '/' + phase + ' 缺 alpha 內容框');
    }
  }
  // 墨焰斬：無獨立 icon → 以 main 作 DEV_ICON_FALLBACK（必標 WAITING_ART，不得冒稱已有 icon）
  assert.equal(table.fusion_inkblade.icon, null, '墨焰斬沒有獨立 icon 檔，映射必須是 null');
});

test('A2 靜態：嚴格 dev-only 門檻存在，且不得被單一 window 旗標繞過', () => {
  const { raw } = readBindSources();
  const gate = raw.slice(raw.indexOf('const isFusionArtBindEnabled'), raw.indexOf('const isFusionArtBindEnabled') + 1400);
  assert.ok(gate.includes('dev=1'), '門檻必須要求 dev=1');
  assert.ok(gate.includes('stage=rain-port'), '門檻必須要求 stage=rain-port');
  assert.ok(gate.includes('fusioncandidate'), '門檻必須要求 fusioncandidate=1');
  assert.ok(gate.includes('fusionart=banana'), '門檻必須要求 fusionart=banana');
  assert.ok(!/FUSION_CANDIDATE_ENABLED/.test(gate), '新門檻不得依賴 window.FUSION_CANDIDATE_ENABLED');
  // 候選圖必須留在 art/fusion/candidates/，不得搬進正式 assets/img
  const { table } = readBindSources();
  for (const kind of KINDS) {
    for (const phase of PHASES) {
      const def = table[kind][phase];
      if (!def) continue;
      assert.ok(def.file.startsWith('art/fusion/candidates/' + kind + '/'), kind + '/' + phase + ' 必須原地留在 art/fusion/candidates/');
      assert.ok(!def.file.includes('assets/img'), kind + '/' + phase + ' 不得指向正式資產目錄');
    }
  }
});

test('A3 靜態：renderer 有真圖 phase 綁定層，且既有融合 mechanics 未被本票改動', () => {
  const renderer = fs.readFileSync(path.join(ROOT, 'js', 'renderer.js'), 'utf8');
  assert.ok(renderer.includes('drawFusionBindLayers'), 'renderer 缺少真圖 phase 綁定層');
  assert.ok(renderer.includes('fusionBindEnabled()'), 'renderer 缺少綁定門檻檢查');
  assert.ok(renderer.includes('drawFusionBindImage'), 'renderer 缺少真圖貼圖函式');

  // mechanics 快照：js/fusion.js 十招配方的傷害／冷卻不得被改動
  const fusion = fs.readFileSync(path.join(ROOT, 'js', 'fusion.js'), 'utf8');
  const EXPECT = {
    fusion_inkblade: [2.5, 1.8],
    fusion_slashwheel: [2.0, 2.0],
    fusion_foxiai: [2.5, 1.6],
    fusion_exorcistblade: [2.2, 1.7],
    fusion_foxfirebarrier: [1.8, 2.5],
    fusion_foxthunderlantern: [2.0, 2.4],
    fusion_flamefestival: [2.0, 2.2],
    fusion_thundercircle: [2.0, 2.2],
    fusion_exorcistseal: [2.2, 2.0],
    fusion_thundertalisman: [2.2, 2.4]
  };
  for (const [id, [dmg, cd]] of Object.entries(EXPECT)) {
    const block = fusion.slice(fusion.indexOf(id + ': {'), fusion.indexOf(id + ': {') + 900);
    const d = Number((block.match(/baseDamage:\s*([\d.]+)/) || [])[1]);
    const c = Number((block.match(/cooldown:\s*([\d.]+)/) || [])[1]);
    assert.equal(d, dmg, id + ' baseDamage 被改動');
    assert.equal(c, cd, id + ' cooldown 被改動');
  }
});

// ---------------------------------------------------------------------------
// B. 真 decode + alpha（Pillow 離線解碼；無 python 時明確跳過並標記）
// ---------------------------------------------------------------------------
function pillowProbe(files) {
  const script = path.join(OUT, '_pillow_probe.py');
  const py = `
import json, sys
from PIL import Image
out = {}
for line in sys.stdin.read().splitlines():
    if not line.strip():
        continue
    p = line.strip()
    try:
        with Image.open(p) as im:
            im.load()
            rgba = im.convert("RGBA")
            a = rgba.getchannel("A")
            h = a.histogram()
            total = a.size[0] * a.size[1]
            out[p] = {
                "size": list(im.size),
                "transparent": h[0],
                "opaque": h[255],
                "partial": total - h[0] - h[255],
                "bbox": list(a.getbbox()) if a.getbbox() else None
            }
    except Exception as exc:
        out[p] = {"error": repr(exc)}
print(json.dumps(out))
`;
  fs.writeFileSync(script, py, 'utf8');
  const res = spawnSync('python', [script], { input: files.join('\n'), encoding: 'utf8', cwd: ROOT });
  if (res.status !== 0) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

test('B1 真 decode + alpha：逐檔 Pillow 解碼，確認有真透明像素與內容框', (t) => {
  const { table } = readBindSources();
  const files = [];
  for (const kind of KINDS) {
    for (const phase of PHASES) {
      const def = table[kind][phase];
      if (def) files.push(path.join(ROOT, def.file.replace(/\//g, path.sep)));
    }
  }
  const probe = pillowProbe(files);
  if (!probe) {
    t.skip('TECH_PARTIAL：本機無可用 python/Pillow，離線解碼檢查跳過（瀏覽器 Canvas 解碼仍在 C1 執行）');
    return;
  }
  for (const kind of KINDS) {
    for (const phase of PHASES) {
      const def = table[kind][phase];
      if (!def) continue;
      const abs = path.join(ROOT, def.file.replace(/\//g, path.sep));
      const info = probe[abs];
      assert.ok(info && !info.error, kind + '/' + phase + ' Pillow 解碼失敗：' + JSON.stringify(info));
      assert.equal(info.size[0], def.size[0], kind + '/' + phase + ' 實際寬度與綁定表不符');
      assert.equal(info.size[1], def.size[1], kind + '/' + phase + ' 實際高度與綁定表不符');
      assert.ok(info.transparent > 0, kind + '/' + phase + ' 沒有透明像素（不是真 alpha 圖）');
      assert.ok(info.opaque > 0, kind + '/' + phase + ' 沒有不透明像素（空白圖）');
      assert.ok(info.bbox, kind + '/' + phase + ' 沒有內容框');
    }
  }
});

// ---------------------------------------------------------------------------
// C/D/E/F. 真瀏覽器驗證（Chrome + CDP）
// ---------------------------------------------------------------------------
const PRELOAD = `
(function () {
  try { localStorage.setItem('yokai-tutorial-v1', JSON.stringify('skip')); } catch (e) {}
  window.__di = [];
  var p = CanvasRenderingContext2D.prototype;
  var di = p.drawImage;
  p.drawImage = function (img) {
    try {
      if (window.__di.length < 6000) {
        var s = img && (img.currentSrc || img.src || '');
        if (s && s.indexOf('art/fusion/candidates/') >= 0) {
          window.__di.push({ src: String(s), w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
        }
      }
    } catch (e) {}
    return di.apply(this, arguments);
  };
})();
`;

// 注入 game.js 的受控 probe（報告中明確標註為「受控裝備／非自然流程」）
const GAME_PROBE = `
window.__fab = {
  start: (id) => start(id || 'rain-port'),
  snap: () => ({
    state: typeof state !== 'undefined' ? state : null,
    stage: typeof STAGE !== 'undefined' && STAGE ? STAGE.id : null,
    tilt: window.VIEWPORT ? window.VIEWPORT.tiltScale() : null,
    fx: typeof fusionEffects !== 'undefined' ? fusionEffects.length : -1,
    kinds: typeof fusionEffects !== 'undefined' ? fusionEffects.map(f => f.kind) : []
  }),
  setTilt: (v) => window.VIEWPORT.animateTiltScale(v, 0),
  clear: () => {
    if (typeof fusionEffects !== 'undefined') fusionEffects = [];
    if (typeof enemies !== 'undefined') enemies.length = 0;
    return true;
  },
  cast: (id) => {
    if (typeof fusionEffects !== 'undefined') fusionEffects = [];
    if (typeof enemies !== 'undefined') enemies.length = 0;
    for (const k of Object.keys(WL)) if (k.indexOf('fusion_') === 0) WL[k] = 0;
    WL[id] = 1;
    P.faceAng = 0;
    // 受控替身：正前方一隻高血量敵人，讓需要目標的招式也能 cast
    enemies.push({ type: 'normal', hp: 99999, maxhp: 99999, x: P.x + 120, y: P.y, r: 26, flash: 0 });
    wT[id] = 0;
    return { id: id, wl: Object.assign({}, WL) };
  }
};
`;

function startServer(port) {
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg'
  };
  const silent = 'window.AUDIO=new Proxy({}, {get:(_,k)=>k==="isMuted"?()=>true:()=>Promise.resolve()}); if(window.speechSynthesis) window.speechSynthesis.speak=()=>{};';
  const server = http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    if (url === '/js/audio.js') { res.writeHead(200, { 'Content-Type': types['.js'] }).end(silent); return; }
    if (/^\/assets\/audio(?:\/|$)/i.test(url) || /\.(mp3|wav|ogg|m4a)$/i.test(url)) { res.writeHead(204).end(); return; }
    if (url === '/service-worker.js') { res.writeHead(200, { 'Content-Type': types['.js'] }).end('self.addEventListener("install",()=>self.skipWaiting());'); return; }
    if (url === '/') url = '/index.html';
    const allowed = ['/index.html', '/style.css', '/styles.css', '/manifest.json'].includes(url)
      || /^\/(?:js\/[^/]+\.js|assets\/(?:img|fonts)\/)/.test(url)
      || /^\/art\/fusion\/candidates\/fusion_[a-z0-9_]+\/[^/]+\.(?:png|webp)$/.test(url)
      || /^\/scratch\/s2-kit-webp-opt-r1\/candidates\/[^/]+\.webp$/.test(url)
      || /^\/art\/stage2-rain-port\/(?:production-s2|production-s2-nano-20261020|scene)\//.test(url);
    const file = path.resolve(ROOT, '.' + url), ext = path.extname(file).toLowerCase();
    if (!allowed || !types[ext] || !file.startsWith(ROOT + path.sep)) { res.writeHead(404).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(); return; }
      res.writeHead(200, { 'Content-Type': types[ext] }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function deadline(promise, ms, what) {
  let t;
  return Promise.race([
    promise.then((v) => { clearTimeout(t); return v; }, (e) => { clearTimeout(t); throw e; }),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error('DEADLINE ' + ms + 'ms: ' + what)), ms); })
  ]);
}

async function withChrome(port, fn) {
  fs.mkdirSync(RUN, { recursive: true });
  const cdpPort = port + 300;
  const profileDir = path.join(RUN, 'profile');
  fs.mkdirSync(profileDir, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--window-size=960,640',
    '--user-data-dir=' + profileDir, '--remote-debugging-port=' + cdpPort, 'about:blank'
  ], { stdio: 'ignore' });

  const state = { ws: null, timer: null, pageErrors: [], consoleLines: [], audioLeak: [], net: new Map(), closed: false };
  try {
    const target = await deadline((async () => {
      for (let i = 0; i < 40; i++) {
        try {
          const list = await deadline(new Promise((res, rej) => {
            http.get('http://127.0.0.1:' + cdpPort + '/json/list', (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => res(s)); }).on('error', rej);
          }), 1500, 'GET /json/list');
          const hit = JSON.parse(list).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
          if (hit) return hit;
        } catch (_) { /* retry */ }
        await sleep(150);
      }
      throw new Error('no cdp page target found');
    })(), 12000, 'cdp target discovery');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    state.ws = ws;
    await deadline(new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws open failed')); }), 5000, 'ws open');

    let seq = 0;
    const pending = new Map();
    const events = [];
    ws.onclose = () => { state.closed = true; for (const p of pending.values()) p.rej(new Error('ws closed')); pending.clear(); };
    ws.onerror = () => { state.closed = true; };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error('CDP ' + p.method + ': ' + JSON.stringify(msg.error))) : p.res(msg.result);
      } else {
        events.push(msg);
      }
    };

    const send = (method, params = {}, ms = 15000) => {
      if (state.closed || !ws || ws.readyState > 1) return Promise.reject(new Error('WS_CLOSED: ' + method));
      return deadline(new Promise((res, rej) => {
        const id = ++seq;
        pending.set(id, { res, rej, method });
        try { ws.send(JSON.stringify({ id, method, params })); } catch (e) { pending.delete(id); rej(e); }
      }), ms, 'CDP ' + method);
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PRELOAD });

    // 只覆寫 js/game.js（尾端注入 probe）；其餘原樣提供
    const rawGame = fs.readFileSync(path.join(ROOT, 'js', 'game.js'), 'utf8');
    const cut = rawGame.lastIndexOf('})();');
    const patched = rawGame.slice(0, cut) + GAME_PROBE + '\n' + rawGame.slice(cut);
    await send('Fetch.enable', { patterns: [{ urlPattern: '*js/game.js*' }] });

    state.timer = setInterval(() => {
      const evs = events.splice(0);
      for (const m of evs) {
        if (m.method === 'Fetch.requestPaused') {
          const url = m.params.request.url;
          if (/js\/game\.js/.test(url)) {
            send('Fetch.fulfillRequest', {
              requestId: m.params.requestId, responseCode: 200,
              responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }],
              body: Buffer.from(patched, 'utf8').toString('base64')
            }, 8000).catch(() => send('Fetch.continueRequest', { requestId: m.params.requestId }, 5000).catch(() => {}));
          } else {
            send('Fetch.continueRequest', { requestId: m.params.requestId }, 8000).catch(() => {});
          }
        } else if (m.method === 'Runtime.exceptionThrown') {
          state.pageErrors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
        } else if (m.method === 'Network.requestWillBeSent') {
          state.net.set(m.params.requestId, { url: m.params.request.url, status: null, bytes: 0 });
        } else if (m.method === 'Network.responseReceived') {
          const r = m.params.response;
          const rec = state.net.get(m.params.requestId);
          if (rec) rec.status = r.status;
          if (r.status === 200 && (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(r.url) || /\/assets\/audio\//i.test(r.url))) state.audioLeak.push(r.url);
        } else if (m.method === 'Network.loadingFinished') {
          const rec = state.net.get(m.params.requestId);
          if (rec) rec.bytes = m.params.encodedDataLength || 0;
        }
      }
    }, 25);

    const evalJs = async (expr, ms = 10000) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, ms);
      if (r.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 240));
      return r.result && r.result.value;
    };
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 20000);
      const f = path.join(RUN, name);
      fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
      return { file: path.relative(ROOT, f).replace(/\\/g, '/'), bytes: fs.statSync(f).size };
    };
    const load = async (url, vw = 960, vh = 640) => {
      state.net.clear();
      state.pageErrors.length = 0;
      state.audioLeak.length = 0;
      await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url }, 15000);
      for (let i = 0; i < 60; i++) {
        const ready = await evalJs('document.readyState === "complete" && typeof window.__fab === "object"', 5000).catch(() => false);
        if (ready) break;
        await sleep(150);
      }
    };
    const candidateReqs = () => [...state.net.values()].filter((r) => /art\/fusion\/candidates\//.test(r.url));

    return await fn({ send, evalJs, shot, load, state, candidateReqs, cdpPort });
  } finally {
    if (state.timer) clearInterval(state.timer);
    try { if (state.ws && !state.closed) state.ws.close(); } catch (_) { /* ignore */ }
    try { chrome.kill(); } catch (_) { /* ignore */ }
    await sleep(200);
  }
}

test('C/D/E/F 真瀏覽器：負向四種零候選請求、正向十招真 drawImage、HTTP200、2D/2.5D 截圖', { timeout: 240000 }, async (t) => {
  fs.mkdirSync(RUN, { recursive: true });
  assert.ok(fs.existsSync(CHROME), 'Chrome 必須存在：' + CHROME);
  const { table } = readBindSources();
  const port = 9800 + Math.floor(Math.random() * 150);
  const server = await startServer(port);
  const host = 'http://127.0.0.1:' + port;
  const report = { startedUtc: new Date().toISOString(), runDir: path.relative(ROOT, RUN).replace(/\\/g, '/'), negative: [], positive: {}, shots: [], http: [] };

  try {
    await withChrome(port, async (ctx) => {
      const { evalJs, shot, load, state, candidateReqs } = ctx;

      // ---------------- D. 負向入口四種 ----------------
      const negatives = [
        { id: 'no-dev', url: host + '/index.html?stage=rain-port&fusioncandidate=1&fusionart=banana' },
        { id: 'wrong-stage', url: host + '/index.html?dev=1&stage=night-town&fusioncandidate=1&fusionart=banana' },
        { id: 'no-fusioncandidate', url: host + '/index.html?dev=1&stage=rain-port&fusionart=banana' },
        { id: 'not-banana', url: host + '/index.html?dev=1&stage=rain-port&fusioncandidate=1&fusionart=legacy' }
      ];
      for (const n of negatives) {
        await load(n.url);
        await sleep(400);
        const reqs = candidateReqs().map((r) => ({ url: r.url.replace(host, ''), status: r.status, bytes: r.bytes }));
        const gate = await evalJs('window.isFusionArtBindEnabled ? window.isFusionArtBindEnabled() : "missing"');
        const reportJs = await evalJs('window.getFusionArtBindReport ? JSON.stringify(window.getFusionArtBindReport()) : "missing"');
        report.negative.push({ id: n.id, url: n.url.replace(host, ''), gate, candidateRequests: reqs, bindReport: JSON.parse(reportJs) });
        assert.equal(gate, false, n.id + '：嚴格門檻必須為 false');
        assert.equal(reqs.length, 0, n.id + '：不得請求任何候選圖（實得 ' + JSON.stringify(reqs) + '）');
        assert.equal(state.pageErrors.length, 0, n.id + '：頁面異常 ' + JSON.stringify(state.pageErrors));
        assert.equal(state.audioLeak.length, 0, n.id + '：出現音訊請求');
      }

      // ---------------- C. HTTP 200（先驗 HTTP，再做頁面解碼） ----------------
      const httpRows = [];
      for (const kind of KINDS) {
        for (const phase of PHASES) {
          const def = table[kind][phase];
          if (!def) continue;
          const res = await fetch(host + '/' + def.file);
          const buf = Buffer.from(await res.arrayBuffer());
          httpRows.push({ kind, phase, file: def.file, status: res.status, bytes: buf.length });
        }
      }
      report.http = httpRows;
      for (const row of httpRows) {
        assert.equal(row.status, 200, row.kind + '/' + row.phase + ' HTTP 非 200：' + row.status);
        assert.ok(row.bytes > 0, row.kind + '/' + row.phase + ' 回應為空');
      }
      for (const kind of FULL_PHASE_KINDS) {
        for (const phase of PHASES) {
          const row = httpRows.find((r) => r.kind === kind && r.phase === phase);
          assert.ok(row, kind + '/' + phase + ' 必須存在且 HTTP 200');
        }
      }

      // ---------------- E. 正向：嚴格 URL ----------------
      await load(host + '/index.html' + BIND_URL);
      const gate = await evalJs('window.isFusionArtBindEnabled ? window.isFusionArtBindEnabled() : "missing"');
      assert.equal(gate, true, '嚴格 URL 下綁定門檻必須為 true');
      await evalJs('window.__fab.start("rain-port")');
      let snap = null;
      for (let i = 0; i < 50; i++) {
        snap = await evalJs('window.__fab.snap()');
        if (snap && snap.state === 'play' && snap.stage === 'rain-port') break;
        await sleep(150);
      }
      assert.equal(snap && snap.state, 'play', '未進入 rain-port play 狀態');

      // 等待候選圖真實載入（status ready）
      let bindReport = null;
      for (let i = 0; i < 60; i++) {
        bindReport = JSON.parse(await evalJs('JSON.stringify(window.getFusionArtBindReport())'));
        const mainReady = KINDS.every((k) => bindReport.kinds[k].main.status === 'ready');
        if (mainReady) break;
        await sleep(150);
      }
      report.positive.bindReport = bindReport;
      for (const kind of KINDS) {
        assert.equal(bindReport.kinds[kind].main.status, 'ready', kind + ' main 候選圖未載入');
        assert.ok(bindReport.kinds[kind].main.naturalWidth > 0, kind + ' main 沒有 naturalWidth');
      }
      for (const kind of FULL_PHASE_KINDS) {
        for (const phase of PHASES) {
          assert.equal(bindReport.kinds[kind][phase].status, 'ready', kind + '/' + phase + ' 未載入');
        }
      }
      // 墨焰斬 icon：無獨立檔 → DEV_ICON_FALLBACK 且必須標記
      assert.equal(bindReport.kinds.fusion_inkblade.icon.fallback, true, '墨焰斬 icon 必須標 DEV_ICON_FALLBACK');
      assert.equal(bindReport.kinds.fusion_inkblade.icon.status, 'ready_fallback', '墨焰斬 icon fallback 狀態錯誤');
      // 缺檔招式：沒有對應 phase 檔者不可偽裝成 ready（假 PASS）
      for (const kind of KINDS) {
        for (const phase of PHASES) {
          if (table[kind][phase]) continue;          // 有檔 → 應該 ready
          if (kind === 'fusion_inkblade' && phase === 'icon') continue; // 已知 DEV_ICON_FALLBACK
          const st = bindReport.kinds[kind][phase];
          assert.notEqual(st.status, 'ready', kind + '/' + phase + ' 沒有檔案卻標 ready（假 PASS）');
        }
      }

      // 候選請求紀錄（正向）
      const posReqs = candidateReqs().map((r) => ({ url: r.url.replace(host, ''), status: r.status, bytes: r.bytes }));
      report.positive.candidateRequests = posReqs;
      assert.ok(posReqs.length >= 10, '正向 URL 必須下載十招候選主圖，實得 ' + posReqs.length);
      for (const r of posReqs) {
        assert.equal(r.status, 200, '候選請求非 200：' + JSON.stringify(r));
        assert.ok(r.bytes > 0, '候選請求 0 bytes：' + JSON.stringify(r));
      }

      // C1 瀏覽器內真 decode + alpha（Canvas getImageData）
      const decode = await evalJs(`(async () => {
        const files = ${JSON.stringify(httpRows.map((r) => r.file))};
        const out = [];
        for (const f of files) {
          const res = await fetch('/' + f);
          if (!res.ok) { out.push({ file: f, ok: false, status: res.status }); continue; }
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          const cv = new OffscreenCanvas(bmp.width, bmp.height);
          const cx = cv.getContext('2d');
          cx.drawImage(bmp, 0, 0);
          const d = cx.getImageData(0, 0, bmp.width, bmp.height).data;
          let transparent = 0, opaque = 0;
          for (let i = 3; i < d.length; i += 4) { const a = d[i]; if (a === 0) transparent++; else if (a === 255) opaque++; }
          out.push({ file: f, ok: true, status: res.status, w: bmp.width, h: bmp.height, transparent, opaque, bytes: blob.size });
        }
        return JSON.stringify(out);
      })()`, 60000);
      const decoded = JSON.parse(decode);
      report.positive.decode = decoded;
      for (const d of decoded) {
        assert.ok(d.ok, '候選圖無法在瀏覽器解碼：' + d.file);
        assert.ok(d.w > 0 && d.h > 0, d.file + ' 解碼尺寸為 0');
        assert.ok(d.transparent > 0, d.file + ' 沒有透明像素（不是真 alpha 圖）');
        assert.ok(d.opaque > 0, d.file + ' 沒有不透明像素（空白圖）');
      }

      // ---------------- E. 十招逐一 cast → 真 drawImage ----------------
      const castRows = [];
      for (const kind of KINDS) {
        await evalJs('window.__fab.clear(); window.__di.length = 0; true');
        const cast = await evalJs('window.__fab.cast("' + kind + '")');
        await sleep(320);
        const s = await evalJs('window.__fab.snap()');
        const drawn = JSON.parse(await evalJs('JSON.stringify(window.__di.slice(0, 60))'));
        const mine = drawn.filter((d) => d.src.indexOf('/' + kind + '/') >= 0);
        const phases = new Set(mine.map((d) => {
          const m = d.src.match(/\/([a-z]+)_alpha_candidate_v\d+\.webp/);
          return m ? m[1] : 'unknown';
        }));
        castRows.push({ kind, cast, fx: s.fx, kinds: s.kinds, draws: mine.length, phases: [...phases], sample: mine.slice(0, 3).map((d) => d.src.split('/').pop()) });
        assert.ok(s.kinds.includes(kind), kind + '：cast 後沒有產生該招特效（fx=' + JSON.stringify(s.kinds) + '）');
        assert.ok(mine.length > 0, kind + '：cast 時沒有真 drawImage 消費 ' + kind + ' 候選圖');
      }
      report.positive.casts = castRows;

      // 四招完整 phase：hit/ground 必須真的被畫到（不只是 main）
      for (const kind of FULL_PHASE_KINDS) {
        const row = castRows.find((r) => r.kind === kind);
        assert.ok(row.phases.includes('main'), kind + '：main phase 未被畫');
        assert.ok(row.phases.includes('ground'), kind + '：ground phase 未被畫（實得 ' + JSON.stringify(row.phases) + '）');
      }
      const inkRow = castRows.find((r) => r.kind === 'fusion_inkblade');
      assert.ok(inkRow.phases.includes('ground'), '墨焰斬 ground phase 未被畫');

      // ---------------- F. 截圖：tilt=.60 與 flat 2D ----------------
      const shoot = async (id, tiltValue, kind, delayMs) => {
        await evalJs('window.__fab.clear(); window.__di.length = 0; true');
        await evalJs('window.__fab.setTilt(' + tiltValue + ')');
        await sleep(120);
        const t = await evalJs('window.VIEWPORT.tiltScale()');
        await evalJs('window.__fab.cast("' + kind + '")');
        await sleep(delayMs || 300);
        const f = await shot(id + '.png');
        const drawn = JSON.parse(await evalJs('JSON.stringify(window.__di.slice(0, 20))'));
        report.shots.push({ id, tilt: t, kind, file: f.file, bytes: f.bytes, draws: drawn.length });
        assert.ok(drawn.length > 0, id + '：截圖時沒有 drawImage 候選圖');
        return f;
      };
      await shoot('shot-25d-t060', 0.6, 'fusion_foxiai', 300);
      await shoot('shot-2d-t100', 1.0, 'fusion_foxiai', 300);
      await shoot('shot-25d-seal', 0.6, 'fusion_exorcistseal', 700);
      await shoot('shot-25d-inkblade', 0.6, 'fusion_inkblade', 260);

      // ---------------- 附帶：第二關 WebP 地板仍可載入（s2ground=kit&s2webp=1） ----------------
      await load(host + '/index.html' + BIND_URL + '&s2ground=kit&s2webp=1');
      await sleep(1200);
      const s2 = [...state.net.values()].filter((r) => /scratch\/s2-kit-webp-opt-r1\/candidates\//.test(r.url));
      report.s2 = { requests: s2.map((r) => ({ url: r.url.replace(host, ''), status: r.status, bytes: r.bytes })) };
      assert.ok(s2.length > 0, '第二關 WebP 地板（s2ground=kit&s2webp=1）沒有被請求');
      assert.ok(s2.every((r) => r.status === 200), '第二關 WebP 地板請求非 200');

      assert.equal(state.pageErrors.length, 0, '頁面異常：' + JSON.stringify(state.pageErrors));
      assert.equal(state.audioLeak.length, 0, '出現音訊請求（凍結資產不可讀）');
    });
  } finally {
    server.close();
    fs.writeFileSync(path.join(RUN, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT, 'latest-report.json'), JSON.stringify(report, null, 2), 'utf8');
  }
});
