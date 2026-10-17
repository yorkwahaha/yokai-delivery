#!/usr/bin/env node
/**
 * tools/r6-r4-screenshots.cjs — R4 真實瀏覽器截圖佐證（OpenCode 獨占）
 *
 * 目的：以本機 Chrome（DevTools Protocol）實際跑 index.html，播種存檔解鎖 rain-port、
 * 用真實點擊進入第二關並截圖，作為「Node 沙箱數學驗收」之外的真實渲染佐證。
 *
 * ⚠ 邊界（不可誇大）：
 *   本機 Chrome ≠ iPad／手機真機。截圖只能證明「在桌面 Chrome 上畫得出來」，
 *   不能證明平板 autoplay、手把震動、觸控與效能。R2／R3/P7 真機項目維持未測。
 *   圖像語意／美感仍需人工審（未人工驗）。
 *
 * 用法：node tools/r6-r4-screenshots.cjs
 * 退出碼：0 = 截圖成功；1 = 失敗（不影響其他驗收結果）。
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6', 'screenshots');
const PORT = Number((process.argv.find(a => a.startsWith('--port=')) || '--port=8899').split('=')[1]);
const CDP_PORT = PORT + 1;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(process.env.TEMP || process.env.TMP || 'I:\\WinTemp\\opencode', 'r6-chrome-profile');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
};

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- 最小 CDP 客戶端（Node 內建 WebSocket，不引入外部相依）----
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      const p = c.pending.get(msg.id);
      if (p) { c.pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) rej(new Error(`${method} timeout`)); }, 30000);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate failed');
    return r.result && r.result.value;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return fs.statSync(file).size;
  }
  close() { try { this.ws.close(); } catch {} }
}

async function launchChrome(w, h) {
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update', '--disable-features=Translate',
    `--user-data-dir=${PROFILE}`, `--window-size=${w},${h}`,
    `--remote-debugging-port=${CDP_PORT}`,
    'about:blank',
  ];
  const child = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (r.ok) return child;
    } catch {}
  }
  try { child.kill(); } catch {}
  throw new Error('Chrome DevTools endpoint 未就緒');
}

// 播種存檔：解鎖 rain-port，讓自動化能進入第二關
const SEED_SCRIPT = `(() => {
  const K = 'yokai-delivery-v1';
  let d = {};
  try { d = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) {}
  d.best = d.best || 0; d.bestDel = d.bestDel || 0;
  d.progress = d.progress || { stages: {}, completed: {}, unlocked: {} };
  d.progress.unlocked = Object.assign({}, d.progress.unlocked,
    { 'night-town': true, 'rain-port': true });
  d.progress.completed = Object.assign({}, d.progress.completed, { 'night-town': true });
  d.progress.stages['rain-port'] = { bestScore: 1200, bestDeliveries: 4, clears: 1, attempts: 2 };
  d.m = d.m || {};
  localStorage.setItem('yokai-tutorial-v1', '"skip"');
  localStorage.setItem(K, JSON.stringify(d));
  return 'seeded';
})()`;

// 真實滑鼠事件點擊（CDP Input.dispatchMouseEvent，由瀏覽器產生 isTrusted 事件）
async function clickAt(cdp, x, y) {
  const base = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 1 };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
  await sleep(250);
}

// 把 canvas 邏輯座標（OVERWORLD.enterButton() 回傳的）換算成 CDP 的 client 座標。
// 遊戲的 pp() 是 p = (client - rect.left) * v.width / rect.width - v.offsetX，
// 反向即 client = (p + offset) / (v.width / rect.width) + rect.left。
// 直接把邏輯座標當 client 座標點會點歪（實測出發鍵就點不到）。
async function clickLogical(cdp, px, py) {
  const m = await cdp.evaluate(`(() => {
    const cv = document.getElementById('game');
    const r = cv.getBoundingClientRect();
    const v = window.VIEWPORT.get();
    return { left: r.left, top: r.top, w: r.width, h: r.height, vw: v.width, vh: v.height, ox: v.offsetX, oy: v.offsetY };
  })()`);
  const cx = (px + m.ox) / (m.vw / m.w) + m.left;
  const cy = (py + m.oy) / (m.vh / m.h) + m.top;
  await clickAt(cdp, cx, cy);
  return { cx: Math.round(cx), cy: Math.round(cy) };
}

// 合成 PointerEvent：在 headless 下 CDP Input 事件不可靠（實測 keydown 收不到），
// 但 page 內 dispatchEvent 的 PointerEvent 能確實觸發 #game-container 的 handler。
async function clickSynthetic(cdp, px, py) {
  const m = await cdp.evaluate(`(() => {
    const cv = document.getElementById('game');
    const r = cv.getBoundingClientRect();
    const v = window.VIEWPORT.get();
    return { left: r.left, top: r.top, w: r.width, h: r.height, vw: v.width, vh: v.height, ox: v.offsetX, oy: v.offsetY };
  })()`);
  const cx = Math.round((px + m.ox) / (m.vw / m.w) + m.left);
  const cy = Math.round((py + m.oy) / (m.vh / m.h) + m.top);
  await cdp.evaluate(`(() => {
    const cv = document.getElementById('game');
    const opt = { bubbles: true, cancelable: true, clientX: ${cx}, clientY: ${cy},
                  pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    cv.dispatchEvent(new PointerEvent('pointerdown', opt));
    cv.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt, { buttons: 0 })));
    return 'ok';
  })()`);
  await sleep(300);
  return { cx, cy };
}

const STATE = `(() => ({
  state: (window.GAME && window.GAME.state) || (window.__state || 'unknown'),
  canvas: !!document.getElementById('game'),
  // 真實瀏覽器佐證：港町九個資產是否真的載入成功（自然寬度非 0）
  portArt: Object.keys(window.PORT_ART || {}).filter(k => (window.PORT_ART[k] && window.PORT_ART[k].naturalWidth) > 0),
  portArtTotal: Object.keys(window.PORT_ART || {}).length,
  stageId: (window.STAGE && window.STAGE.id) || null,
}))()`;

async function shoot(cdp, name, w, h) {
  const file = path.join(ART, name);
  const size = await cdp.shot(file);
  console.log(`OK  ${name} ${size} bytes`);
  return { name, file: path.relative(ROOT, file).replace(/\\/g, '/'), size };
}

(async () => {
  if (!fs.existsSync(CHROME)) { console.error(`找不到 Chrome：${CHROME}`); process.exit(1); }
  fs.mkdirSync(ART, { recursive: true });
  const server = await serve();
  const results = [];
  let chrome;
  try {
    chrome = await launchChrome(900, 600);
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page');
    if (!page) throw new Error('找不到可用的 page target');
    const cdp = await CDP.attach(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });

    // 1) 先開一次 origin 以便寫入 localStorage
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?tilt=1` });
    await sleep(4000);
    await cdp.evaluate(SEED_SCRIPT);
    // ★ 必須重載：js/store.js 在頁面載入時就把存檔讀進記憶體，
    //   事後寫 localStorage 不會讓 STORE 知道 rain-port 已解鎖（出發鍵會保持停用）。
    await cdp.send('Page.reload', {});
    await sleep(5000);

    // 2) 主選單 → 旅路地圖（UI.MENU_START_BTN = {x: W/2-132, y:478, w:264, h:54}）
    await clickSynthetic(cdp, 450, 505);
    await sleep(2500);
    results.push(await shoot(cdp, 'r4-overworld-900x600.png'));

    // 3) 旅路地圖 → 用「▶ 看八關」移到第二關 rain-port。
    //    browseButtons(): next = {x: area.right-72, y: area.bottom-196, w:54, h:52}
    const next = await cdp.evaluate(`(() => { const b = window.OVERWORLD.browseButtons(); return b.find(x => x.id === 'next'); })()`);
    for (let i = 0; i < 2; i++) { await clickSynthetic(cdp, next.x + next.w / 2, next.y + next.h / 2); await sleep(700); }
    results.push(await shoot(cdp, 'r4-overworld-selected.png'));
    // 出發。
    // ⚠ confirmOverworld() 要求 selected.id === currentId；browse() 只設 inspectId，
    //   所以第一次點只會觸發 moveTo（隊伍動畫移動），必須等動畫走完再點第二下才會 start()。
    const enter = await cdp.evaluate(`(() => window.OVERWORLD.enterButton())()`);
    const at = [];
    for (let i = 0; i < 3; i++) {
      at.push(await clickSynthetic(cdp, enter.x + enter.w / 2, enter.y + enter.h / 2));
      await sleep(i === 2 ? 2000 : 4500);
    }
    results.push(await shoot(cdp, 'r4-after-launch-click.png'));
    await sleep(6000);
    const st = await cdp.evaluate(STATE);
    results.push(await shoot(cdp, 'r4-rain-port-900x600.png'));
    results.push({ name: 'runtime-state', file: null, size: 0, state: st, enterClick: at });

    // 4) 手機橫向
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await sleep(1500);
    results.push(await shoot(cdp, 'r4-rain-port-844x390.png'));
    // 5) 手機直向（遮罩畫面）
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(1200);
    results.push(await shoot(cdp, 'r4-rain-port-390x844.png'));

    cdp.close();
  } catch (e) {
    console.error('截圖流程失敗：', e.message);
    results.push({ error: e.message });
  } finally {
    try { if (chrome) chrome.kill(); } catch {}
    server.close();
  }
  fs.writeFileSync(path.join(ART, 'screenshots.json'), JSON.stringify({
    tool: 'tools/r6-r4-screenshots.cjs', at: new Date().toISOString(),
    chrome: CHROME, port: PORT, results,
    caveat: '本機 Chrome ≠ iPad／手機真機；R2／R3／P7 真機項目維持 NOT_TESTED_ON_DEVICE。圖像語意未人工驗。',
  }, null, 2) + '\n');
  process.exit(results.some(r => r.error) ? 1 : 0);
})();