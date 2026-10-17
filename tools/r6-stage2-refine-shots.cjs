#!/usr/bin/env node
/**
 * tools/r6-stage2-refine-shots.cjs
 * 雨港精修的真 Chrome 截圖：2D／2.5D、桌機／平板、首幀、移動、resize。
 * 不覆寫 art-shots/ 或 art-shots-grok/。截圖不是美術核准。
 *
 * 用法：node tools/r6-stage2-refine-shots.cjs [--port=8913]
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const png = require('./r6-png.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'validation', 'r6', 'stage2-refine-shots');
const PORT = Number((process.argv.find(arg => arg.startsWith('--port=')) || '--port=8913').split('=')[1]);
const CDP_PORT = PORT + 1;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(process.env.TEMP || 'I:\\WinTemp', 'r6-refine-profile');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('ws error')); });
    const client = new CDP(ws);
    ws.onmessage = ev => {
      const message = JSON.parse(ev.data);
      const pending = client.pending.get(message.id);
      if (pending) {
        client.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
    };
    return client;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`${method} timeout`)); }, 40000);
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed');
    return result.result && result.result.value;
  }
  async shot(name) {
    const file = path.join(OUT, name);
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    return { file: path.relative(ROOT, file).replace(/\\/g, '/'), bytes: fs.statSync(file).size };
  }
  close() { try { this.ws.close(); } catch {} }
}

async function launchChrome() {
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update',
    `--user-data-dir=${PROFILE}`, '--window-size=900,600',
    `--remote-debugging-port=${CDP_PORT}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok) return child; } catch {}
  }
  try { child.kill(); } catch {}
  throw new Error('Chrome DevTools endpoint 未就緒');
}

const OBSERVER = `(() => {
  const P = (window.__art = { srcs: {}, texts: {}, frames: 0,
    reset() { this.srcs = {}; this.texts = {}; this.frames = 0; },
    bump(map, key) { map[key] = (map[key] || 0) + 1; } });
  const proto = CanvasRenderingContext2D.prototype;
  const origDraw = proto.drawImage;
  proto.drawImage = function (img) {
    try {
      const src = (img && img.dataset && img.dataset.url) || (img && img.src) || '';
      P.bump(P.srcs, String(src).split('?')[0].split('/').slice(-2).join('/'));
    } catch (e) {}
    return origDraw.apply(this, arguments);
  };
  for (const fn of ['fillText', 'strokeText']) {
    const orig = proto[fn];
    proto[fn] = function (txt) { try { P.bump(P.texts, String(txt)); } catch (e) {} return orig.apply(this, arguments); };
  }
  const raf = window.requestAnimationFrame;
  if (typeof raf === 'function') window.requestAnimationFrame = function (cb) {
    return raf.call(window, function (t) { P.frames++; return cb(t); });
  };
})()`;

const readProbe = `(() => {
  const P = window.__art || { srcs: {}, texts: {}, frames: 0 };
  const srcs = Object.keys(P.srcs).sort();
  const texts = Object.keys(P.texts);
  const hud = window.VIEWPORT ? window.VIEWPORT.hudBounds() : null;
  const view = window.VIEWPORT ? window.VIEWPORT.get() : null;
  return {
    frames: P.frames,
    drawSources: srcs,
    texts: texts.slice(0, 80),
    viewLabel: texts.filter(text => text === '2D' || text === '2.5D'),
    tilt: window.VIEWPORT ? window.VIEWPORT.tiltScale() : null,
    inner: { w: window.innerWidth, h: window.innerHeight },
    view, hud,
    portDrawn: srcs.filter(src => /rain-port|prop_torii|prop_lantern|prop_sakura/.test(src)),
  };
})()`;

async function clickLogical(cdp, px, py) {
  const box = await cdp.evaluate(`(() => {
    const cv = document.getElementById('game');
    const r = cv.getBoundingClientRect();
    const v = window.VIEWPORT.get();
    return { left: r.left, top: r.top, w: r.width, h: r.height, vw: v.width, vh: v.height, ox: v.offsetX, oy: v.offsetY };
  })()`);
  const cx = Math.round((px + box.ox) / (box.vw / box.w) + box.left);
  const cy = Math.round((py + box.oy) / (box.vh / box.h) + box.top);
  await cdp.evaluate(`(() => {
    const cv = document.getElementById('game');
    const opt = { bubbles: true, cancelable: true, clientX: ${cx}, clientY: ${cy},
      pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    cv.dispatchEvent(new PointerEvent('pointerdown', opt));
    cv.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt, { buttons: 0 })));
    return 'ok';
  })()`);
  await sleep(300);
}

async function screenOf(cdp) {
  return cdp.evaluate(`(() => document.body?.dataset?.gameScreen || '')()`);
}

async function enterStage(cdp, targetIndex) {
  for (let i = 0; i < 20; i++) {
    const ready = await cdp.evaluate(`(() => ({ map: !!window.MAP_ART_READY, p: window.ART_PROGRESS || null }))()`);
    if (ready.map && ready.p && ready.p.settled >= ready.p.total) break;
    await sleep(1000);
  }
  let onMap = false;
  for (let i = 0; i < 6; i++) {
    if (await screenOf(cdp) === 'map') { onMap = true; break; }
    await clickLogical(cdp, 450, 505);
    await sleep(2200);
    if (await screenOf(cdp) === 'map') { onMap = true; break; }
  }
  const next = await cdp.evaluate(`(() => { const b = window.OVERWORLD.browseButtons(); return b.find(x => x.id === 'next'); })()`);
  let panel = null;
  for (let i = 0; i < 9; i++) {
    panel = await cdp.evaluate(`(() => {
      const hit = Object.keys((window.__art && window.__art.texts) || {}).filter(x => /^\\d\\/8\\s/.test(x));
      return hit.length ? hit[hit.length - 1] : null;
    })()`);
    if (panel && panel.trim().startsWith(`${targetIndex}/8`)) break;
    await clickLogical(cdp, next.x + next.w / 2, next.y + next.h / 2);
    await sleep(700);
  }
  const enter = await cdp.evaluate(`(() => window.OVERWORLD.enterButton())()`);
  for (let i = 0; i < 6; i++) {
    await clickLogical(cdp, enter.x + enter.w / 2, enter.y + enter.h / 2);
    await sleep(4000);
    if (await screenOf(cdp) === 'other') return { panel, onMap, attempts: i + 1, entered: true };
  }
  return { panel, onMap, attempts: 6, entered: false, screen: await screenOf(cdp) };
}

async function settleBattle(cdp) {
  let last = null;
  for (let i = 0; i < 16; i++) {
    last = await cdp.evaluate(`(() => ({
      screen: document.body?.dataset?.gameScreen || '',
      stone: window.PORT_ART?.stoneVar1?.naturalWidth || 0,
      wood: window.PORT_ART?.woodVar1?.naturalWidth || 0,
      house: (window.ART?.house_shop?.naturalWidth || 0) + (window.PORT_ART?.warehouse?.naturalWidth || 0),
      lantern: window.ART?.prop_lantern?.naturalWidth || 0,
    }))()`);
    if (last.screen === 'other' && (last.stone || last.house || last.lantern)) return last;
    await sleep(500);
  }
  return last;
}

async function repaint(cdp) {
  // 900 與 901 仍落在地面快取裡，不會重畫貼圖。先縮到另一個 pixelScale，清掉觀測，再回到 900。
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 400, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  await cdp.evaluate(`(() => { if (window.__art) window.__art.reset(); return 'reset'; })()`);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });
  await sleep(1000);
}

async function toggleView(cdp) {
  const before = await cdp.evaluate(`(() => window.VIEWPORT.tiltScale())()`);
  const button = await cdp.evaluate(`(() => {
    const b = window.VIEWPORT.hudBounds();
    return { x: b.right - 52 - 1 + 26, y: b.top + 14 + 52 + 12 + 22 };
  })()`);
  await clickLogical(cdp, button.x, button.y);
  await sleep(1200);
  let after = await cdp.evaluate(`(() => window.VIEWPORT.tiltTargetScale())()`);
  if (after === before) {
    await clickLogical(cdp, 900 - 66 + 26, 80 + 22);
    await sleep(1200);
    after = await cdp.evaluate(`(() => window.VIEWPORT.tiltTargetScale())()`);
  }
  return { before, after };
}

async function drag(cdp) {
  await cdp.evaluate(`(() => {
    const cv = document.getElementById('game');
    const r = cv.getBoundingClientRect();
    const opt = (x, y) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y,
      pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true });
    cv.dispatchEvent(new PointerEvent('pointerdown', opt(400, 300)));
    for (let i = 1; i <= 12; i++) cv.dispatchEvent(new PointerEvent('pointermove', opt(400 - i * 22, 300 + i * 10)));
    cv.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt(136, 420), { buttons: 0 })));
    return 'drag';
  })()`);
  await sleep(900);
}

function has(sources, pattern) {
  return (sources || []).some(src => pattern.test(src));
}

(async () => {
  if (!fs.existsSync(CHROME)) { console.error(`找不到 Chrome：${CHROME}`); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const out = {
    tool: 'tools/r6-stage2-refine-shots.cjs',
    at: new Date().toISOString(),
    artApproved: false,
    device: 'Chrome headless。不是 iPad、手機或 Xbox。',
    shots: {},
    reds: [],
    notes: [],
  };
  const server = await serve();
  let chrome;
  let cdp;
  try {
    chrome = await launchChrome();
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find(item => item.type === 'page');
    cdp = await CDP.attach(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?tilt=1` });
    await sleep(2500);
    await cdp.evaluate(`(() => {
      localStorage.setItem('yokai-tutorial-v1', '"skip"');
      const K = 'yokai-delivery-v1';
      let d = {}; try { d = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) {}
      d.progress = d.progress || { stages: {}, completed: {}, unlocked: {} };
      d.progress.unlocked = Object.assign({}, d.progress.unlocked, { 'night-town': true, 'rain-port': true });
      d.progress.completed = Object.assign({}, d.progress.completed, { 'night-town': true });
      localStorage.setItem(K, JSON.stringify(d));
      return 'seeded';
    })()`);
    await cdp.send('Page.reload', {});
    await sleep(4000);

    const stage1 = await enterStage(cdp, 1);
    out.stage1Entry = stage1;
    out.stage1Ready = stage1.entered ? await settleBattle(cdp) : null;
    if (!stage1.entered) out.reds.push({ id: 'S1-ENTER', item: '沒有進入夜行町，無法核對第一關物件仍在' });
    else await repaint(cdp);
    out.shots.stage1First = await cdp.shot('stage1-desktop-2d-first.png');
    out.stage1 = await cdp.evaluate(readProbe);
    if (stage1.entered && !has(out.stage1.drawSources, /prop_lantern/)) {
      out.notes.push('夜行町首幀沒有畫到 prop_lantern。世界契約另由 node 測試檢查石燈配置。');
    }
    if (stage1.entered && has(out.stage1.drawSources, /rain-port\//)) {
      out.reds.push({ id: 'S1-PORT', item: '夜行町首幀畫到了雨港圖' });
    }

    await cdp.send('Page.reload', {});
    await sleep(4000);
    const stage2 = await enterStage(cdp, 2);
    out.stage2Entry = stage2;
    out.stage2Ready = stage2.entered ? await settleBattle(cdp) : null;
    if (!stage2.entered) {
      out.reds.push({ id: 'S2-ENTER', item: '沒有進入雨夜港町', detail: stage2 });
      out.shots.stuck = await cdp.shot('stage2-stuck.png');
      throw new Error('停留在進關前，後續戰鬥截圖跳過');
    }
    out.shots.desktop2dFirst = await cdp.shot('stage2-desktop-2d-first.png');
    await repaint(cdp);
    const firstProbe = await cdp.evaluate(readProbe);
    out.groundAfterRepaint = {
      drawSources: firstProbe.drawSources,
      portDrawn: firstProbe.portDrawn,
    };
    out.desktop2dFirst = firstProbe;
    const t0 = Date.now();
    const frames0 = firstProbe.frames;
    await sleep(1000);
    const fpsProbe = await cdp.evaluate(readProbe);
    out.fps = {
      headlessFramesInAbout1s: fpsProbe.frames - frames0,
      wallMs: Date.now() - t0,
      note: '這是 headless Chrome 的取樣，不是 iPad 或桌機玩家的 FPS，不能當成裝置通過。',
    };
    if (out.fps.headlessFramesInAbout1s < 5) out.reds.push({ id: 'FPS', item: '進關後約 1 秒幾乎沒有新畫面', detail: out.fps });

    await drag(cdp);
    out.shots.desktop2dMoved = await cdp.shot('stage2-desktop-2d-moved.png');
    const firstImg = png.decodePNG(fs.readFileSync(path.join(ROOT, out.shots.desktop2dFirst.file)));
    const movedImg = png.decodePNG(fs.readFileSync(path.join(ROOT, out.shots.desktop2dMoved.file)));
    const band = { x0: 120, x1: 780, y0: 180, y1: 520 };
    out.movement = png.regionDiff(firstImg, movedImg, band);
    out.notes.push('首幀和移動截圖的像素差含雨的動畫，不能單靠這個數字證明鏡頭移動。兩張圖都要人工看。');
    if (out.movement.mean < 1) out.notes.push(`拖曳後畫面差只有 ${out.movement.mean}。`);

    out.toggles = {};
    out.toggles.desktop = await toggleView(cdp);
    out.shots.desktop25d = await cdp.shot('stage2-desktop-25d.png');
    if (!(out.toggles.desktop.before === 1 && out.toggles.desktop.after === 0.6)) {
      out.reds.push({ id: 'TILT-DESKTOP', item: '桌機 2D 沒有切到 2.5D', detail: out.toggles.desktop });
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
    await sleep(1200);
    out.shots.tablet25d = await cdp.shot('stage2-tablet-25d.png');
    out.tablet25d = await cdp.evaluate(readProbe);
    if (!out.tablet25d.inner || out.tablet25d.inner.w < 1000) {
      out.reds.push({ id: 'RESIZE', item: '平板 resize 後 innerWidth 沒有變成 1024', detail: out.tablet25d.inner });
    }
    out.toggles.tablet = await toggleView(cdp);
    out.shots.tablet2d = await cdp.shot('stage2-tablet-2d.png');
    out.tablet2d = await cdp.evaluate(readProbe);
    if (!(out.toggles.tablet.before === 0.6 && out.toggles.tablet.after === 1)) {
      out.reds.push({ id: 'TILT-TABLET', item: '平板 2.5D 沒有切回 2D', detail: out.toggles.tablet });
    }
    const labels = new Set([...(out.tablet25d.viewLabel || []), ...(out.tablet2d.viewLabel || []), ...(firstProbe.viewLabel || [])]);
    if (![...labels].some(label => label === '2D' || label === '2.5D')) {
      out.reds.push({ id: 'UI', item: '截圖流程裡沒有畫出 2D／2.5D 視角鈕' });
    }

    const drawn = firstProbe.drawSources || [];
    out.stage2Drawn = drawn.filter(src => /rain-port|prop_torii|prop_lantern|prop_sakura|ground/.test(src));
    if (!has(drawn, /ground_stone_var1/)) out.reds.push({ id: 'VAR1-STONE', item: '雨港首幀沒有畫青石 var1' });
    if (!has(drawn, /ground_wood_dock_var1/)) out.reds.push({ id: 'VAR1-WOOD', item: '雨港首幀沒有畫木板 var1' });
    for (const [id, pattern] of [
      ['TORII', /prop_torii/],
      ['LANTERN', /prop_lantern/],
      ['SAKURA', /prop_sakura/],
      ['VAR2', /ground_stone_var2|ground_wood_dock_var2/],
    ]) {
      if (has(drawn, pattern)) out.reds.push({ id, item: `雨港首幀畫到了不該相鄰或已禁止的圖`, detail: drawn.filter(src => pattern.test(src)) });
    }
    if (!has(drawn, /port_warehouse|port_fishmonger/)) out.notes.push('首幀沒有同時畫到倉庫或魚舖，請看後續移動與平板截圖。');
  } catch (error) {
    if (!String(error && error.message).includes('停留在進關前')) {
      out.reds.push({ id: 'FLOW', item: '截圖流程失敗', detail: error && error.stack ? error.stack : String(error) });
    }
  } finally {
    if (cdp) cdp.close();
    if (chrome) { try { chrome.kill(); } catch {} }
    server.close();
  }
  out.verdict = out.reds.length ? 'RED' : 'SHOTS_CAPTURED_HUMAN_REVIEW';
  out.humanReview = '這些截圖只證明畫面有畫出來。單張 var1 的重複、岸線接縫、房子大小、雨勢都還沒有人工核准。';
  fs.writeFileSync(path.join(OUT, 'stage2-refine-shots.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ verdict: out.verdict, reds: out.reds.map(red => red.id), shots: Object.keys(out.shots), fps: out.fps }, null, 2));
  process.exit(out.reds.some(red => red.id === 'FLOW') && out.shots && !out.shots.desktop2dFirst ? 2 : out.reds.length ? 1 : 0);
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(2);
});
