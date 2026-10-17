#!/usr/bin/env node
/**
 * tools/r6-journey-shots.cjs
 * 冷啟第一關、旅路進入雨港、持續移動、2D↔2.5D。
 * 不覆寫 art-shots/、art-shots-grok/、stage2-refine-shots/。
 * 截圖不是美術核准。headless 穩定也不關閉第一關地板 P0。
 *
 * 用法：node tools/r6-journey-shots.cjs [--port=8925]
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const png = require('./r6-png.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'validation', 'r6', 'journey-shots');
const PORT = Number((process.argv.find(arg => arg.startsWith('--port=')) || '--port=8925').split('=')[1]);
const CDP_PORT = PORT + 1;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(process.env.TEMP || 'I:\\WinTemp', 'r6-journey-profile');
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
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
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
  return {
    frames: P.frames,
    drawSources: srcs,
    screen: document.body?.dataset?.gameScreen || '',
    tilt: window.VIEWPORT ? window.VIEWPORT.tiltScale() : null,
    spacing: window.VIEWPORT ? window.VIEWPORT.spacingScaleY() : null,
    port: {
      stoneVar1: window.PORT_ART?.stoneVar1?.naturalWidth || 0,
      woodVar1: window.PORT_ART?.woodVar1?.naturalWidth || 0,
      stoneMaster: window.PORT_ART?.stoneMaster?.naturalWidth || 0,
      woodMaster: window.PORT_ART?.woodMaster?.naturalWidth || 0,
      transH: window.PORT_ART?.transHCompat?.naturalWidth || 0,
      warehouse: window.PORT_ART?.warehouse?.naturalWidth || 0,
      fish: window.PORT_ART?.fishmonger?.naturalWidth || 0,
    },
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
  await sleep(250);
}

async function screenOf(cdp) {
  return cdp.evaluate(`(() => document.body?.dataset?.gameScreen || '')()`);
}

async function seed(cdp) {
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
}

async function openMap(cdp) {
  for (let i = 0; i < 20; i++) {
    const ready = await cdp.evaluate(`(() => ({ map: !!window.MAP_ART_READY, p: window.ART_PROGRESS || null }))()`);
    if (ready.map && ready.p && ready.p.settled >= ready.p.total) break;
    await sleep(1000);
  }
  for (let i = 0; i < 6; i++) {
    if (await screenOf(cdp) === 'map') return true;
    await clickLogical(cdp, 450, 505);
    await sleep(1800);
  }
  return (await screenOf(cdp)) === 'map';
}

async function reachPanel(cdp, targetIndex) {
  const onMap = await openMap(cdp);
  const next = await cdp.evaluate(`(() => { const b = window.OVERWORLD.browseButtons(); return b.find(x => x.id === 'next'); })()`);
  let panel = null;
  for (let i = 0; i < 9; i++) {
    panel = await cdp.evaluate(`(() => {
      const hit = Object.keys((window.__art && window.__art.texts) || {}).filter(x => /^\\d\\/8\\s/.test(x));
      return hit.length ? hit[hit.length - 1] : null;
    })()`);
    if (panel && panel.trim().startsWith(`${targetIndex}/8`)) break;
    await clickLogical(cdp, next.x + next.w / 2, next.y + next.h / 2);
    await sleep(600);
  }
  return { onMap, panel, atTarget: !!(panel && panel.trim().startsWith(`${targetIndex}/8`)) };
}

async function confirmEnter(cdp) {
  const enter = await cdp.evaluate(`(() => window.OVERWORLD.enterButton())()`);
  for (let i = 0; i < 6; i++) {
    await clickLogical(cdp, enter.x + enter.w / 2, enter.y + enter.h / 2);
    await sleep(2500);
    if (await screenOf(cdp) === 'other') return { entered: true, attempts: i + 1 };
  }
  return { entered: false, attempts: 6, screen: await screenOf(cdp) };
}

async function toggleView(cdp) {
  const before = await cdp.evaluate(`(() => window.VIEWPORT.tiltScale())()`);
  const button = await cdp.evaluate(`(() => {
    const b = window.VIEWPORT.hudBounds();
    return { x: b.right - 52 - 1 + 26, y: b.top + 14 + 52 + 12 + 22 };
  })()`);
  await clickLogical(cdp, button.x, button.y);
  await sleep(900);
  let after = await cdp.evaluate(`(() => window.VIEWPORT.tiltTargetScale())()`);
  if (after === before) {
    await clickLogical(cdp, 900 - 66 + 26, 80 + 22);
    await sleep(900);
    after = await cdp.evaluate(`(() => window.VIEWPORT.tiltTargetScale())()`);
  }
  return { before, after };
}

async function walk(cdp, vx, vy, steps) {
  await cdp.evaluate(`(() => new Promise(resolve => {
    const cv = document.getElementById('game');
    const r = cv.getBoundingClientRect();
    const opt = (x, y, buttons) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y,
      pointerId: 1, pointerType: 'mouse', button: 0, buttons, isPrimary: true });
    let i = 0;
    cv.dispatchEvent(new PointerEvent('pointerdown', opt(450, 320, 1)));
    const timer = setInterval(() => {
      i += 1;
      cv.dispatchEvent(new PointerEvent('pointermove', opt(450 + ${vx} * i, 320 + ${vy} * i, 1)));
      if (i >= ${steps}) {
        clearInterval(timer);
        cv.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt(450 + ${vx} * i, 320 + ${vy} * i, 0), { buttons: 0 })));
        resolve('walk');
      }
    }, 40);
  }))()`);
}

function loadShot(rel) {
  return png.decodePNG(fs.readFileSync(path.join(ROOT, rel)));
}

function groundBands() {
  return {
    upper: { x0: 80, x1: 820, y0: 90, y1: 230 },
    lower: { x0: 80, x1: 820, y0: 360, y1: 520 },
    full: { x0: 40, x1: 860, y0: 70, y1: 540 },
  };
}

(async () => {
  if (!fs.existsSync(CHROME)) { console.error(`找不到 Chrome：${CHROME}`); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const out = {
    tool: 'tools/r6-journey-shots.cjs',
    at: new Date().toISOString(),
    artApproved: false,
    p0Closed: false,
    device: 'Chrome headless。不是 iPad、手機或 Xbox。穩定樣本不能關閉第一關地板 P0。',
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

    const origin = `http://127.0.0.1:${PORT}/index.html`;
    await cdp.send('Page.navigate', { url: `${origin}?tilt=1` });
    await sleep(2000);
    await seed(cdp);

    await cdp.send('Page.reload', {});
    await sleep(2500);
    const stage1Map = await reachPanel(cdp, 1);
    const stage1Enter = await confirmEnter(cdp);
    out.stage1Cold2d = { map: stage1Map, enter: stage1Enter };
    if (!stage1Enter.entered) out.reds.push({ id: 'S1-ENTER-2D', item: '2D 冷啟沒有進入夜行町' });
    out.shots.stage1_2d_t0 = await cdp.shot('stage1-2d-t0.png');
    out.stage1_2d_t0 = await cdp.evaluate(readProbe);
    await sleep(3000);
    out.shots.stage1_2d_t3 = await cdp.shot('stage1-2d-t3.png');
    await sleep(7000);
    out.shots.stage1_2d_t10 = await cdp.shot('stage1-2d-t10.png');
    out.stage1ToggleFrom2d = await toggleView(cdp);
    out.shots.stage1_2d_toggle_t0 = await cdp.shot('stage1-2d-toggle-t0.png');
    await sleep(3000);
    out.shots.stage1_2d_toggle_t3 = await cdp.shot('stage1-2d-toggle-t3.png');
    if (!(out.stage1ToggleFrom2d.before === 1 && out.stage1ToggleFrom2d.after === 0.6)) {
      out.reds.push({ id: 'S1-TILT-2D', item: '第一關 2D 冷啟沒有切到 2.5D', detail: out.stage1ToggleFrom2d });
    }

    await cdp.send('Page.navigate', { url: origin });
    await sleep(2500);
    const stage1bMap = await reachPanel(cdp, 1);
    const stage1bEnter = await confirmEnter(cdp);
    out.stage1Cold25d = { map: stage1bMap, enter: stage1bEnter };
    if (!stage1bEnter.entered) out.reds.push({ id: 'S1-ENTER-25D', item: '2.5D 冷啟沒有進入夜行町' });
    out.shots.stage1_25d_t0 = await cdp.shot('stage1-25d-t0.png');
    out.stage1_25d_t0 = await cdp.evaluate(readProbe);
    await sleep(3000);
    out.shots.stage1_25d_t3 = await cdp.shot('stage1-25d-t3.png');
    await sleep(7000);
    out.shots.stage1_25d_t10 = await cdp.shot('stage1-25d-t10.png');
    out.stage1ToggleFrom25d = await toggleView(cdp);
    out.shots.stage1_25d_toggle_t0 = await cdp.shot('stage1-25d-toggle-t0.png');
    await sleep(3000);
    out.shots.stage1_25d_toggle_t3 = await cdp.shot('stage1-25d-toggle-t3.png');
    if (!(out.stage1ToggleFrom25d.before === 0.6 && out.stage1ToggleFrom25d.after === 1)) {
      out.reds.push({ id: 'S1-TILT-25D', item: '第一關 2.5D 冷啟沒有切到 2D', detail: out.stage1ToggleFrom25d });
    }

    await cdp.send('Page.navigate', { url: `${origin}?tilt=1` });
    await sleep(2500);
    const stage2Map = await reachPanel(cdp, 2);
    out.stage2Map = stage2Map;
    if (!stage2Map.atTarget) out.reds.push({ id: 'S2-MAP', item: '旅路沒有停在 2/8 雨港', detail: stage2Map });
    out.shots.overworld = await cdp.shot('overworld-rain-port.png');
    const stage2Enter = await confirmEnter(cdp);
    out.stage2Enter = stage2Enter;
    if (stage2Enter.entered) {
      await cdp.evaluate(`(() => { if (window.__art) window.__art.reset(); return 'reset-after-map'; })()`);
      await sleep(400);
    }
    if (!stage2Enter.entered) {
      out.reds.push({ id: 'S2-ENTER', item: '旅路沒有進入雨夜港町', detail: stage2Enter });
      out.shots.stuck = await cdp.shot('stage2-stuck.png');
      throw new Error('停留在進關前');
    }
    out.shots.stage2_cold_t0 = await cdp.shot('stage2-cold-t0.png');
    out.stage2_cold_t0 = await cdp.evaluate(readProbe);
    await sleep(3000);
    out.shots.stage2_cold_t3 = await cdp.shot('stage2-cold-t3.png');
    await walk(cdp, -6, -3, 40);
    out.shots.stage2_walk = await cdp.shot('stage2-walk.png');
    await walk(cdp, 5, 4, 30);
    out.shots.stage2_walk2 = await cdp.shot('stage2-walk-2.png');
    out.stage2ToggleTo25 = await toggleView(cdp);
    out.shots.stage2_25d = await cdp.shot('stage2-25d.png');
    await sleep(1000);
    out.stage2ToggleTo2d = await toggleView(cdp);
    out.shots.stage2_back_2d = await cdp.shot('stage2-back-2d.png');
    if (!(out.stage2ToggleTo25.before === 1 && out.stage2ToggleTo25.after === 0.6)) {
      out.reds.push({ id: 'S2-TILT-25', item: '雨港 2D 沒有切到 2.5D', detail: out.stage2ToggleTo25 });
    }
    if (!(out.stage2ToggleTo2d.before === 0.6 && out.stage2ToggleTo2d.after === 1)) {
      out.reds.push({ id: 'S2-TILT-2D', item: '雨港 2.5D 沒有切回 2D', detail: out.stage2ToggleTo2d });
    }

    await cdp.evaluate(`(() => { if (window.__art) window.__art.reset(); return 'reset'; })()`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 901, height: 600, deviceScaleFactor: 1, mobile: false });
    await sleep(700);
    out.cacheAfter1px = await cdp.evaluate(readProbe);
    await cdp.evaluate(`(() => { if (window.__art) window.__art.reset(); return 'reset'; })()`);
    out.stage2ToggleCache = await toggleView(cdp);
    await sleep(700);
    out.cacheAfterTilt = await cdp.evaluate(readProbe);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });

    const bands = groundBands();
    const s1t0 = loadShot(out.shots.stage1_2d_t0.file);
    const s1t3 = loadShot(out.shots.stage1_2d_t3.file);
    const s1t10 = loadShot(out.shots.stage1_2d_t10.file);
    const s1b0 = loadShot(out.shots.stage1_25d_t0.file);
    const s1b10 = loadShot(out.shots.stage1_25d_t10.file);
    out.p0 = {
      closed: false,
      status: 'REVIEW_BY_HUMAN',
      measured: true,
      diff2d_t0_t3: png.regionDiff(s1t0, s1t3, bands.upper),
      diff2d_t0_t10: png.regionDiff(s1t0, s1t10, bands.upper),
      diff25d_t0_t10: png.regionDiff(s1b0, s1b10, bands.upper),
      note: '上緣地面差。角色、花瓣、雨會讓數字不為 0。headless 沒抓到錯誤拼接也不等於 P0 關閉。',
    };
    const cold = loadShot(out.shots.stage2_cold_t0.file);
    const walked = loadShot(out.shots.stage2_walk.file);
    const view25 = loadShot(out.shots.stage2_25d.file);
    out.stage2Pixels = {
      coldToWalkUpper: png.regionDiff(cold, walked, bands.upper),
      coldToWalkLower: png.regionDiff(cold, walked, bands.lower),
      coldTo25d: png.regionDiff(cold, view25, bands.full),
      upperPeriod: png.horizontalPeriodicity(cold, bands.upper, { minShift: 40, maxShift: 500, step: 2 }),
      lowerPeriod: png.horizontalPeriodicity(cold, bands.lower, { minShift: 40, maxShift: 500, step: 2 }),
      seams: png.verticalSeams(cold, { x0: 60, x1: 840, y0: 80, y1: 560 }, { topK: 6 }),
    };
    const drawn = out.stage2_cold_t0.drawSources || [];
    const has = pattern => drawn.some(src => pattern.test(src));
    if (!has(/ground_stone_var1|ground_stone_master/)) out.reds.push({ id: 'GROUND-STONE', item: '雨港冷啟沒畫到青石' });
    if (!has(/ground_wood_dock_var1|ground_wood_master/)) out.reds.push({ id: 'GROUND-WOOD', item: '雨港冷啟沒畫到木棧' });
    if (has(/prop_torii|prop_lantern|prop_sakura/)) {
      out.reds.push({ id: 'S2-FORBIDDEN', item: '雨港冷啟畫到鳥居、石燈或櫻花', detail: drawn.filter(src => /prop_torii|prop_lantern|prop_sakura/.test(src)) });
    }
    out.stage2Drawn = drawn.filter(src => /rain-port|prop_torii|prop_lantern|prop_sakura|ground/.test(src));
    const onePxGround = (out.cacheAfter1px.drawSources || []).filter(src => /ground_stone|ground_wood/.test(src));
    const tiltGround = (out.cacheAfterTilt.drawSources || []).filter(src => /ground_stone|ground_wood/.test(src));
    out.cache = {
      onePxResizeRedrawGround: onePxGround,
      tiltRedrawGround: tiltGround,
      note: '主畫布 transform 的 a 是 viewport scale × dpr，不含 tilt。1px 與 2D↔2.5D 這次都沒有重鋪地面貼圖。',
    };
    if (onePxGround.length) out.notes.push(`1px 縮放仍重畫了地面：${onePxGround.join(', ')}`);
    if (!tiltGround.length) out.notes.push('切換視角後沒有觀察到地面貼圖重畫。');
  } catch (error) {
    if (!String(error && error.message).includes('停留在進關前')) {
      out.reds.push({ id: 'FLOW', item: '截圖流程失敗', detail: error && error.stack ? error.stack : String(error) });
    }
  } finally {
    if (cdp) cdp.close();
    if (chrome) { try { chrome.kill(); } catch {} }
    await new Promise(resolve => server.close(resolve));
  }
  out.verdict = out.reds.length ? 'SHOTS_INCOMPLETE' : 'SHOTS_CAPTURED_HUMAN_REVIEW';
  fs.writeFileSync(path.join(OUT, 'journey-shots.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({
    verdict: out.verdict,
    reds: out.reds.map(item => item.id),
    p0: out.p0 && out.p0.status,
    stage2Drawn: out.stage2Drawn,
    seams: out.stage2Pixels && out.stage2Pixels.seams && out.stage2Pixels.seams.peaks,
    periods: out.stage2Pixels && {
      upper: out.stage2Pixels.upperPeriod && out.stage2Pixels.upperPeriod.period,
      lower: out.stage2Pixels.lowerPeriod && out.stage2Pixels.lowerPeriod.period,
    },
    cache: out.cache,
    shots: Object.keys(out.shots),
  }, null, 2));
  process.exit(out.reds.some(item => item.id === 'FLOW' || item.id === 'S2-ENTER') ? 1 : 0);
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(2);
});
