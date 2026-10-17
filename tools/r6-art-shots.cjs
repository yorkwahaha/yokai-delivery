#!/usr/bin/env node
/**
 * tools/r6-art-shots.cjs — 美術唯一性 A／D 組真實瀏覽器驗收（OpenCode 獨占）
 *
 * 依 docs/art-asset-only-standard.md：
 *   §6 P0 第一關地板拼接 —— 冷啟動進夜行町，0/3/10 秒連續截圖、切鏡、2D／2.5D 來回切換，
 *      並建立同世界取樣座標、DPR、旋轉、相機邊界接縫的量測。
 *   §7 P1 真圖化 —— 第二關必須經真地圖前往 → 出發，桌機與手機尺寸截圖，
 *      驗證玩家／怪／配送／圖載入。
 *
 * ⚠ 邊界（不可誇大）：
 *   本機 Chrome headless ≠ iPad／手機真機。所有外觀是否達標一律 REVIEW_BY_HUMAN，
 *   本工具只做「可量測的違規偵測」，不宣布美術合格。
 *
 * ⚠ 觀測方式（不修改任何 production 檔）：
 *   以 Page.addScriptToEvaluateOnNewDocument 包一層 drawImage／fillText，
 *   記錄遊戲實際畫了哪些圖與哪些字。這是測試觀測層，不是改程式。
 *
 * 用法：node tools/r6-art-shots.cjs [--port=8899]
 * 退出碼：0 = 無可量測違規；1 = 偵測到 RED；2 = 流程本身失敗。
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const png = require('./r6-png.cjs');

const ROOT = path.resolve(__dirname, '..');
const outArg = (process.argv.find(a => a.startsWith('--out=')) || '').slice('--out='.length);
const ART = outArg
  ? path.resolve(ROOT, outArg)
  : path.join(ROOT, 'artifacts', 'validation', 'r6', 'art-shots');
{
  const rel = path.relative(ROOT, ART);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    console.error('--out 必須在專案目錄內');
    process.exit(2);
  }
}
const PORT = Number((process.argv.find(a => a.startsWith('--port=')) || '--port=8899').split('=')[1]);
const CDP_PORT = PORT + 1;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(process.env.TEMP || process.env.TMP || 'I:\\WinTemp\\opencode', 'r6-art-profile');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
};

function serve(requests) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { requests.push({ url, status: 404 }); res.writeHead(404).end('not found'); return; }
      requests.push({ url, status: 200 });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(PORT, '127.0.0.1', () => r(server)));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 最小 CDP 客戶端（Node 內建 WebSocket，無外部相依）──────────────────────
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.method) c.events.push(m);
      const p = c.pending.get(m.id);
      if (p) { c.pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.delete(id)) rej(new Error(`${method} timeout`)); }, 40000);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate failed');
    return r.result && r.result.value;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return { file: path.relative(ROOT, file).replace(/\\/g, '/'), bytes: fs.statSync(file).size };
  }
  close() { try { this.ws.close(); } catch {} }
}

async function launchChrome(w, h) {
  // 每次都用乾淨的測試 profile：舊 profile 的 service-worker 快取會讓載入卡住，
  // 造成「圖像準備 N/M」停在半路，誤判成遊戲沒畫出來。這個目錄是本工具自己的暫存。
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-component-update',
    `--user-data-dir=${PROFILE}`, `--window-size=${w},${h}`,
    `--remote-debugging-port=${CDP_PORT}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try { if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok) return child; } catch {}
  }
  try { child.kill(); } catch {}
  throw new Error('Chrome DevTools endpoint 未就緒');
}

// ── 觀測層：記錄實際繪製的圖與文字（不改任何遊戲程式）─────────────────────
// ⚠ 用「來源計數表」而不是逐次陣列：主選單每幀都重畫，逐次記錄會在幾秒內把上限寫滿，
//   導致後��真正進入戰鬥的繪製完全看不到（第一版就是這樣誤判成「沒進戰鬥」）。
const OBSERVER = `(() => {
  const P = (window.__art = {
    srcs: {}, texts: {}, frames: 0,
    reset() { this.srcs = {}; this.texts = {}; this.frames = 0; },
    bump(map, k) { map[k] = (map[k] || 0) + 1; },
  });
  const proto = CanvasRenderingContext2D.prototype;
  const origDraw = proto.drawImage;
  proto.drawImage = function (img) {
    try {
      const src = (img && img.dataset && img.dataset.url) || (img && img.src) || String((img && img.name) || '');
      P.bump(P.srcs, String(src).split('/').slice(-2).join('/'));
    } catch (e) {}
    return origDraw.apply(this, arguments);
  };
  for (const fn of ['fillText', 'strokeText']) {
    const orig = proto[fn];
    proto[fn] = function (txt) {
      try { P.bump(P.texts, String(txt)); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }
  const raf = window.requestAnimationFrame;
  if (typeof raf === 'function') window.requestAnimationFrame = function (cb) {
    return raf.call(window, function (t) { P.frames++; return cb(t); });
  };
})()`;

const readProbe = `(() => {
  const P = window.__art || { srcs: {}, texts: {}, frames: 0 };
  const keys = m => Object.keys(m).sort();
  const srcs = keys(P.srcs);
  const has = re => srcs.some(s => re.test(s));
  return {
    frames: P.frames,
    drawSources: srcs,
    player: has(/player/),
    monsters: srcs.filter(s => /ghost|runner|tank|shooter|(^|\\/)mis\\.|boss/.test(s)),
    ground: srcs.filter(s => /ground|stone|dock/.test(s)),
    houses: srcs.filter(s => /house|warehouse|fishmonger/.test(s)),
    props: srcs.filter(s => /prop|anchor|mooring|crate|boat|lighthouse/.test(s)),
    texts: keys(P.texts).slice(0, 80),
    deliveryTexts: keys(P.texts).filter(t => /交通|港|町|配達/.test(t)).slice(0, 20),
    artLoaded: Object.keys(window.ART || {}).filter(k => window.ART[k] && window.ART[k].naturalWidth > 0).sort(),
    portArtLoaded: Object.keys(window.PORT_ART || {}).filter(k => window.PORT_ART[k] && window.PORT_ART[k].naturalWidth > 0).sort(),
    viewport: window.VIEWPORT ? window.VIEWPORT.get() : null,
  };
})()`;

// ── 點擊：合成 PointerEvent（headless 下 CDP Input 不可靠）─────────────────
async function clickLogical(cdp, px, py) {
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

const SEED_STAGE2 = `(() => {
  const K = 'yokai-delivery-v1';
  let d = {}; try { d = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) {}
  d.progress = d.progress || { stages: {}, completed: {}, unlocked: {} };
  d.progress.unlocked = Object.assign({}, d.progress.unlocked, { 'night-town': true, 'rain-port': true });
  d.progress.completed = Object.assign({}, d.progress.completed, { 'night-town': true });
  d.progress.stages['rain-port'] = { bestScore: 1200, bestDeliveries: 4, clears: 1, attempts: 2 };
  localStorage.setItem('yokai-tutorial-v1', '"skip"');
  localStorage.setItem(K, JSON.stringify(d));
  return 'seeded';
})()`;

// 第 1 關冷啟動也要跳過教學視窗：教學面板會蓋住整個畫面，
// 量到的會是面板而不是地板（第一版因此誤判「2D/2.5D 切換沒反應」）。
// ⚠ 這是為了量地板而跳教學；「首次進場」指冷啟動第一幀的地面狀態，不是教學流程。
const SEED_TUTORIAL_SKIP = `(() => { localStorage.setItem('yokai-tutorial-v1', '"skip"'); return 'skip'; })()`;

// ── 量測：挑三條候選地面帶，取跨秒最穩定的一條，避免被動畫誤判 ─────────────
function groundBands(w, h) {
  return [
    { name: 'lower-left', x0: Math.round(w * 0.30), x1: Math.round(w * 0.58), y0: Math.round(h * 0.56), y1: Math.round(h * 0.74) },
    { name: 'lower-mid', x0: Math.round(w * 0.24), x1: Math.round(w * 0.76), y0: Math.round(h * 0.64), y1: Math.round(h * 0.82) },
    { name: 'mid-left', x0: Math.round(w * 0.26), x1: Math.round(w * 0.52), y0: Math.round(h * 0.44), y1: Math.round(h * 0.58) },
  ];
}
function pickBand(frames) {
  // frames: [t0,t3,t10] decoded images；挑 d03 + d310 總和最小者
  let best = null;
  for (const band of groundBands(frames[0].width, frames[0].height)) {
    const d03 = png.regionDiff(frames[0], frames[1], band).mean;
    const d310 = png.regionDiff(frames[1], frames[2], band).mean;
    const score = d03 + d310;
    if (!best || score < best.score) best = { band, d03, d310, score };
  }
  return best;
}

// 旅路面板會用 fillText 畫「N/8 關名」，用觀測層讀它來確認目前選到哪一關。
const PANEL_PROBE = `(() => {
  const t = Object.keys((window.__art && window.__art.texts) || {});
  const hit = t.filter(x => /^\\d\\/8\\s/.test(x));
  return { panel: hit.length ? hit[hit.length - 1] : null };
})()`;

// 是否真的進入戰鬥。
// ⚠ 旅路地圖也會畫主角（overworld 立繪），所以「有畫到 player」不足以判定進戰鬥；
//   必須同時出現只在戰鬥世界才會畫的地表／房屋。
//   這裡不使用 GAME.state —— 它不對外公開，讀到的會是 undefined（第一版誤用過）。
const IN_GAME_PROBE = `(() => {
  const s = Object.keys((window.__art && window.__art.srcs) || {});
  const world = s.filter(x => /scenery\\/ground|house_|PORT|rain-port|prop_torii/.test(x));
  return { player: s.some(x => /player/.test(x)), world: world.length > 0, sources: s.length };
})()`;

const MENU_PROBE = `(() => Object.keys((window.__art && window.__art.texts) || {}).includes('操作與自定義'))()`;
const RESET_PROBE = `(() => { if (window.__art) window.__art.reset(); return 'reset'; })()`;

function resolveDrawn(src) {
  const clean = String(src || '').split('?')[0].replace(/\\/g, '/');
  if (!clean) return null;
  const tries = [
    path.join(ROOT, clean),
    path.join(ROOT, 'assets', clean),
    path.join(ROOT, 'assets', 'img', clean),
  ];
  return tries.find(p => fs.existsSync(p)) || null;
}

(async () => {
  if (!fs.existsSync(CHROME)) { console.error(`找不到 Chrome：${CHROME}`); process.exit(2); }
  fs.mkdirSync(ART, { recursive: true });
  const requests = [];
  const server = await serve(requests);
  const out = {
    tool: 'tools/r6-art-shots.cjs', at: new Date().toISOString(),
    standard: 'docs/art-asset-only-standard.md',
    caveats: [
      '本機 Chrome headless ≠ iPad／手機真機；真機項目維持 NOT_TESTED_ON_DEVICE。',
      '本工具只偵測可量測的違規；外觀是否達標一律 REVIEW_BY_HUMAN，本工具不宣布美術合格。',
      '觀測層以 CDP 包裝 drawImage／fillText 記錄實際繪製內容，未修改任何 js/ 檔案。',
    ],
    phases: {}, reds: [], warnings: [],
  };
  let chrome, cdp;
  try {
    chrome = await launchChrome(900, 600);
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page');
    cdp = await CDP.attach(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });

    const enterStage = async (targetIndex) => {
      // 等資產真的準備好再點，否則載入遮罩會把點擊整個吞掉
      const readiness = [];
      for (let i = 0; i < 20; i++) {
        const rdy = await cdp.evaluate(`(() => ({ map: !!window.MAP_ART_READY, art: !!window.ART_READY, p: window.ART_PROGRESS || null }))()`);
        readiness.push(rdy);
        if (rdy.map && rdy.p && rdy.p.settled >= rdy.p.total) break;
        await sleep(1000);
      }
      out.readiness = (out.readiness || []).concat([{ stage: targetIndex, samples: readiness }]);
      // 主選單 → 旅路地圖（重試直到離開主選單；選單鍵偶爾會被載入中的點擊吞掉）
      let onMap = false;
      for (let i = 0; i < 6; i++) {
        await cdp.evaluate(RESET_PROBE);
        await clickLogical(cdp, 450, 505);
        await sleep(2500);
        if (!(await cdp.evaluate(MENU_PROBE))) { onMap = true; break; }
      }
      if (!onMap) await cdp.shot(path.join(ART, `debug-stuck-menu-stage${targetIndex}.png`));
      out.readiness[out.readiness.length - 1].reachedMap = onMap;
      // 用「▶ 看八關」逐關瀏覽，直到面板顯示目標關（N/8）。
      // 註：起點可能是 waypoint（無面板、出發鍵停用），必須先選到 stage 節點。
      const next = await cdp.evaluate(`(() => { const b = window.OVERWORLD.browseButtons(); return b.find(x => x.id === 'next'); })()`);
      let panel = null;
      for (let i = 0; i < 9; i++) {
        panel = await cdp.evaluate(PANEL_PROBE);
        if (panel.panel && panel.panel.trim().startsWith(`${targetIndex}/8`)) break;
        await clickLogical(cdp, next.x + next.w / 2, next.y + next.h / 2);
        await sleep(700);
        panel = await cdp.evaluate(PANEL_PROBE);
        if (panel.panel && panel.panel.trim().startsWith(`${targetIndex}/8`)) break;
      }
      // 出發：confirmOverworld() 需 selected.id === currentId，第一下只 moveTo（動畫），第二下才 start()
      const enter = await cdp.evaluate(`(() => window.OVERWORLD.enterButton())()`);
      for (let i = 0; i < 5; i++) {
        await clickLogical(cdp, enter.x + enter.w / 2, enter.y + enter.h / 2);
        await sleep(4500);
        const g = await cdp.evaluate(IN_GAME_PROBE);
        if (g.player && g.world) return { panel: panel.panel, attempts: i + 1 };
      }
      return { panel: panel.panel, attempts: 5, entered: false };
    };

    // ═══ Phase A：第 1 關冷啟動 0/3/10 秒 + 2D/2.5D 來回切換 ═══
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?tilt=1` });
    await sleep(4500);
    await cdp.evaluate(SEED_TUTORIAL_SKIP);
    await cdp.send('Page.reload', {});   // store/tutorial 在載入時讀存檔，必須重載
    await sleep(5000);
    const ent1 = await enterStage(1);
    await sleep(1500);
    const shotsA = {};
    await cdp.evaluate(RESET_PROBE);   // 只記錄「進戰鬥之後」畫了什麼
    shotsA['s1_t0'] = await cdp.shot(path.join(ART, 'stage1-t0s.png'));
    await sleep(3000);
    shotsA['s1_t3'] = await cdp.shot(path.join(ART, 'stage1-t3s.png'));
    await sleep(7000);
    shotsA['s1_t10'] = await cdp.shot(path.join(ART, 'stage1-t10s.png'));
    const probeA1 = await cdp.evaluate(readProbe);

    // 視角切換鈕：btnView = { x: W - 66, y: 80, w: 52, h: 44 }（js/game.js:313）
    // ⚠ 這裡的 W 是 js/game.js 自己的 900 基礎寬度，不是 VIEWPORT.get().width（1048.8）。
    //    用 viewport 寬度換算會點到畫面外，量到「切換沒反應」的假紅燈（第一版誤判）。
    const viewBtn = { x: 900 - 66, y: 80, w: 52, h: 44 };
    await clickLogical(cdp, viewBtn.x + viewBtn.w / 2, viewBtn.y + viewBtn.h / 2);
    await sleep(2500);
    shotsA['s1_25d'] = await cdp.shot(path.join(ART, 'stage1-25d.png'));
    const probeA2 = await cdp.evaluate(readProbe);
    await clickLogical(cdp, viewBtn.x + viewBtn.w / 2, viewBtn.y + viewBtn.h / 2);   // 切回 2D
    await sleep(2500);
    shotsA['s1_back2d'] = await cdp.shot(path.join(ART, 'stage1-back-2d.png'));
    await clickLogical(cdp, viewBtn.x + viewBtn.w / 2, viewBtn.y + viewBtn.h / 2);   // 來回一次：再切 2.5D
    await sleep(2000);
    await clickLogical(cdp, viewBtn.x + viewBtn.w / 2, viewBtn.y + viewBtn.h / 2);   // 切回
    await sleep(2500);
    shotsA['s1_roundtrip'] = await cdp.shot(path.join(ART, 'stage1-roundtrip-2d.png'));

    // 相機大幅移動（模擬按住拖曳），檢查移動後是否出現錯拼
    await cdp.evaluate(`(() => {
      const cv = document.getElementById('game');
      const r = cv.getBoundingClientRect();
      const opt = (x, y) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y,
        pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true });
      cv.dispatchEvent(new PointerEvent('pointerdown', opt(400, 300)));
      for (let i = 1; i <= 12; i++) cv.dispatchEvent(new PointerEvent('pointermove', opt(400 - i * 22, 300 + i * 10)));
      cv.dispatchEvent(new PointerEvent('pointerup', opt(400 - 12 * 22, 300 + 12 * 10)));
      return 'drag';
    })()`);
    await sleep(1200);
    shotsA['s1_cam1'] = await cdp.shot(path.join(ART, 'stage1-camera-moved-1.png'));
    await sleep(4000);
    shotsA['s1_cam2'] = await cdp.shot(path.join(ART, 'stage1-camera-moved-4s.png'));

    // DPR 對照
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 2, mobile: false });
    await sleep(2000);
    shotsA['s1_dpr2'] = await cdp.shot(path.join(ART, 'stage1-dpr2.png'));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });
    await sleep(1500);

    // 旋轉／尺寸
    for (const [w, h, name] of [[844, 390, 'mobile-landscape'], [1024, 768, 'tablet'], [390, 844, 'mobile-portrait']]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 900 });
      await sleep(1800);
      shotsA[`s1_${name}`] = await cdp.shot(path.join(ART, `stage1-${name}.png`));
    }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 600, deviceScaleFactor: 1, mobile: false });
    await sleep(1500);

    const imgs = k => png.decodePNG(fs.readFileSync(path.join(ROOT, shotsA[k].file)), k);
    const f0 = imgs('s1_t0'), f3 = imgs('s1_t3'), f10 = imgs('s1_t10');
    const f25 = imgs('s1_25d'), fBack = imgs('s1_back2d'), fRound = imgs('s1_roundtrip');
    const fCam1 = imgs('s1_cam1'), fCam2 = imgs('s1_cam2'), fDpr2 = imgs('s1_dpr2');
    const pick = pickBand([f0, f3, f10]);
    const band = pick.band;
    out.phases.stage1 = {
      shots: shotsA,
      entry: ent1,
      probe: { t10: probeA1, afterToggle: probeA2 },
      band,
      // A1 跨秒穩定度（P0：不得「先錯數秒再變對」）
      stability: { t0_to_t3: pick.d03, t3_to_t10: pick.d310,
        verdict: pick.d03 > 3 && pick.d310 < pick.d03 / 2 ? 'TRANSIENT_WRONG' : 'STABLE' },
      // A2 拼接週期
      periodicity: png.horizontalPeriodicity(f10, band),
      // A3 垂直接縫
      seams: png.verticalSeams(f10, band),
      // A4 視角切換
      viewToggle: {
        diff_2d_to_25d: png.regionDiff(f10, f25, band).mean,
        diff_2d_before_afterToggle: png.regionDiff(f10, fBack, band).mean,
        diff_roundtrip: png.regionDiff(f10, fRound, band).mean,
      },
      // A5 DPR
      dpr: {
        energy_dpr1: png.highFrequencyEnergy(f10, band),
        energy_dpr2: png.highFrequencyEnergy(fDpr2, band),
      },
      // A6 相機移動後的穩定度
      camera: { t0_after_move: null, t4_after_move: png.regionDiff(fCam1, fCam2, band).mean },
    };

    // ═══ Phase D：第 2 關真地圖前往 → 出發 ═══
    await cdp.evaluate(SEED_STAGE2);
    await cdp.send('Page.reload', {});   // store.js 載入時就讀存檔，必須重載才解鎖
    await sleep(5000);
    await cdp.evaluate(RESET_PROBE);     // 第二關的觀測要從零開始
    const ent2 = await enterStage(2);                 // 1/8 → 2/8 雨夜港町
    const shotsD = {};
    shotsD['s2_desktop'] = await cdp.shot(path.join(ART, 'stage2-desktop-900x600.png'));
    await sleep(9000);   // 妖怪需要時間才生成；太早取樣會誤判「沒有怪」
    shotsD['s2_desktop_9s'] = await cdp.shot(path.join(ART, 'stage2-desktop-t9s.png'));
    const probeD = await cdp.evaluate(readProbe);
    for (const [w, h, name] of [[844, 390, 'mobile-landscape'], [390, 844, 'mobile-portrait'], [1024, 768, 'tablet']]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 900 });
      await sleep(1800);
      shotsD[`s2_${name}`] = await cdp.shot(path.join(ART, `stage2-${name}.png`));
    }
    out.phases.stage2 = { shots: shotsD, probe: probeD, entry: ent2 };

    const s2 = png.decodePNG(fs.readFileSync(path.join(ROOT, shotsD['s2_desktop_9s'].file)), 's2');
    const s2band = { x0: Math.round(s2.width * 0.30), x1: Math.round(s2.width * 0.78), y0: Math.round(s2.height * 0.06), y1: Math.round(s2.height * 0.30) };
    out.measured = out.measured || {};
    out.measured.stage2_tiling = {
      status: 'REVIEW_BY_HUMAN',
      autocorrelation: png.horizontalPeriodicity(s2, s2band),
      seams: png.verticalSeams(s2, s2band),
      evidence: shotsD['s2_desktop_9s'].file,
      note: '第二關截圖的地面在肉眼下呈現規則方格重複（同一貼圖圖集的四個變體依序排列）；' +
        '自動指標同樣無法量化「看起來像拼接」，故交人工審。',
    };

    // ── 判定 ──
    const st = out.phases.stage1.stability;
    if (st.verdict === 'TRANSIENT_WRONG') {
      out.reds.push({
        id: 'A1', item: '第 1 關冷啟動地板跨秒不穩（P0：先錯數秒才恢復）',
        detail: `同世界取樣帶 ${band.name}：t0→t3 平均亮度差 ${pick.d03}，t3→t10 為 ${pick.d310}。` +
          `前段明顯變動、後段穩定，符合「先錯拼再恢復」的使用者回報。`,
        evidence: [shotsA['s1_t0'].file, shotsA['s1_t3'].file, shotsA['s1_t10'].file],
      });
    }
    const per = out.phases.stage1.periodicity;
    // ⚠ 誠實處理：水平自相關在本專案的畫面「分不出」真貼圖與重複貼圖
    //   （實測 stage1 與 stage2 的數值區間重疊），所以這一項**不判 PASS也不判 FAIL**，
    //   只輸出數值並交人工看圖。標準 §6.3 明講：單張「看起來正常」的圖不算證據。
    out.measured = out.measured || {};
    out.measured.tiling_autocorrelation = {
      status: 'INCONCLUSIVE_REVIEW_BY_HUMAN',
      stage1: per,
      note: '自動指標無法可靠區分真貼圖與重複貼圖，因此不得用「數值正常」宣告無拼接。' +
        '拼接與畫風一律以連續截圖人工審為準（art-shots/ 下的 0/3/10 秒與相機移動截圖）。',
    };
    out.measured.seam_scan = {
      status: 'REVIEW_BY_HUMAN',
      stage1: out.phases.stage1.seams,
      note: '接縫尖峰同樣會被自然紋理邊緣觸發，因此只輸出數值供人工比對，不自動判紅。',
    };
    const vt = out.phases.stage1.viewToggle;
    if (vt.diff_2d_to_25d < 2) {
      out.reds.push({ id: 'A4', item: '2D／2.5D 切換沒有改變畫面', detail: `切換前後區塊差 ${vt.diff_2d_to_25d}`, evidence: [shotsA['s1_25d'].file] });
    }
    if (vt.diff_roundtrip > 6) {
      out.reds.push({
        id: 'A4b', item: '2D／2.5D 來回切換後畫面沒有回到原狀',
        detail: `來回切換後與原始 2D 差 ${vt.diff_roundtrip}（視角狀態可能未還原）`,
        evidence: [shotsA['s1_roundtrip'].file],
      });
    }
    const dpr = out.phases.stage1.dpr;
    if (dpr.energy_dpr2 < dpr.energy_dpr1 * 0.8) {
      out.warnings.push(`A5 DPR=2 的高頻能量 ${dpr.energy_dpr2} 低於 DPR=1 的 ${dpr.energy_dpr1}：高 DPI 下細節反而變少，需人工看圖確認。`);
    }
    const p2 = out.phases.stage2.probe;
    if (!p2 || !Array.isArray(p2.drawSources)) {
      out.measured.stage2Probe = { status: 'INCONCLUSIVE' };
      out.warnings.push('第二關觀測層沒有 drawSources。這筆不判通過，也不當成畫面違規。');
    } else {
      if (!p2.player) out.reds.push({ id: 'D1', item: '第 2 關沒有畫出玩家圖', detail: `drawImage 記錄中找不到 player：${JSON.stringify(p2.drawSources.slice(0, 20))}`, evidence: [shotsD['s2_desktop'].file] });
      if (!p2.monsters.length) out.reds.push({ id: 'D2', item: '第 2 關取樣窗沒有畫出任何妖怪圖', detail: 'drawImage 記錄中找不到 ghost/runner/tank/shooter/mis/boss。取樣窗沒畫到不等於程式刪了妖怪。', evidence: [shotsD['s2_desktop_9s'].file] });
      if (!p2.deliveryTexts.length) out.reds.push({ id: 'D3', item: '第 2 關沒有畫出配送目標標示', detail: 'fillText 記錄中找不到配送相關文字', evidence: [shotsD['s2_desktop'].file] });
      const need = ['stone', 'dock', 'warehouse', 'fishmonger', 'beacon', 'mooring', 'crate', 'boat', 'anchor', 'ripple'];
      const loaded = new Set(p2.portArtLoaded || []);
      const notLoaded = need.filter(role => !loaded.has(role));
      if (notLoaded.length) out.reds.push({
        id: 'D4', item: '第 2 關港町圖沒有全部載入',
        detail: `未載入：${notLoaded.join('、')}。已載入：${[...loaded].join('、') || '（無）'}`,
        evidence: [shotsD['s2_desktop'].file],
      });
      const propGuess = { beacon: 'prop_port_lighthouse', mooring: 'prop_mooring_post', crate: 'prop_cargo_crates', boat: 'prop_port_boat', anchor: 'prop_anchor_gear', ripple: 'vfx_rain_splash_ripple' };
      const drawn = p2.drawSources.join(' ');
      const neverDrawn = [...loaded].filter(role => propGuess[role] && !drawn.includes(propGuess[role]));
      if (neverDrawn.length) out.reds.push({
        id: 'D5', item: '港町道具已載入但取樣窗沒畫出',
        detail: `已載入卻沒有出現在任何 drawImage：${neverDrawn.join('、')}。實際港町相關：${p2.drawSources.filter(s => /rain-port|handpainted-candidates|candidate_/.test(s)).join('、')}`,
        evidence: [shotsD['s2_desktop'].file],
      });
      const svgDrawn = p2.drawSources.filter(s => /\.svg/.test(s));
      if (svgDrawn.length) out.reds.push({
        id: 'D6', item: '正式畫面畫出了 SVG 美術', bucket: '正式SVG殘留',
        detail: `第二關實戰中畫出：${svgDrawn.join('、')}`,
        evidence: [shotsD['s2_desktop'].file],
      });
      const approvedRel = {
        warehouse: 'art/stage2-rain-port/scene/H_port_warehouse.webp',
        fishmonger: 'art/stage2-rain-port/scene/H_fishmonger.webp',
        stone: 'art/stage2-rain-port/scene/G_ground_stone.webp',
        wood: 'art/stage2-rain-port/scene/G_ground_wood_dock.webp',
      };
      const seen = {};
      const unresolved = [];
      for (const src of p2.drawSources) {
        const file = resolveDrawn(src);
        if (!file) { if (src) unresolved.push(src); continue; }
        let hash = null;
        try { hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { unresolved.push(src); continue; }
        for (const [role, rel] of Object.entries(approvedRel)) {
          const abs = path.join(ROOT, rel);
          if (!fs.existsSync(abs)) continue;
          const want = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
          if (hash === want) seen[role] = src;
        }
      }
      const missingRoles = Object.keys(approvedRel).filter(role => !seen[role]);
      out.measured.approvedArt = {
        status: missingRoles.length ? 'NOT_ALL_DRAWN_IN_SAMPLE' : 'DRAWN_IN_SAMPLE',
        seen, missingRoles,
        note: '取樣窗沒畫到的角色不直接斷定程式沒接。靜態測試 W1 另核載入表位元組。',
      };
      if (missingRoles.length) out.reds.push({
        id: 'D7', bucket: '本輪阻塞',
        item: '取樣窗沒有把四張核准圖都畫出來',
        detail: `沒畫到：${missingRoles.join('、')}。已對上：${Object.keys(seen).join('、') || '（無）'}。不能把這張取樣當成四圖都上屏。`,
        evidence: [shotsD['s2_desktop_9s'].file],
      });
    }
    const s1srcs = out.phases.stage1 && out.phases.stage1.probe && out.phases.stage1.probe.t10 && out.phases.stage1.probe.t10.drawSources;
    if (!Array.isArray(s1srcs)) {
      out.measured.stage1Isolation = { status: 'INCONCLUSIVE' };
      out.warnings.push('A7 第一關 drawSources 讀不到。不判通過，也不判污染。');
    } else {
      const leak = s1srcs.filter(s => /rain-port\/|handpainted-candidates|candidate_/.test(s));
      out.measured.stage1Isolation = { status: leak.length ? 'LEAK' : 'NO_PORT_DRAW_IN_SAMPLE', leak };
      if (leak.length) out.reds.push({
        id: 'A7', bucket: '本輪阻塞', item: '第一關取樣畫到了第二關圖',
        detail: leak.join('、'), evidence: [shotsA['s1_t10'].file],
      });
    }
    if (shotsD['s2_mobile-portrait'] && shotsD['s2_mobile-portrait'].bytes < 20000) {
      out.measured.portraitCombat = { status: 'NOT_A_COMBAT_FRAME', bytes: shotsD['s2_mobile-portrait'].bytes };
      out.warnings.push(`直向截圖只有 ${shotsD['s2_mobile-portrait'].bytes} bytes，像轉向遮罩而不是戰鬥畫面。模擬尺寸，不是真機，不得計入戰鬥通過。`);
    }
    let gate = null;
    try { gate = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/validation/r6/human-visual-gate.json'), 'utf8')); } catch {}
    out.humanVisualGate = {
      status: gate && gate.compositeApproved === true && gate.approvedBy === 'user' ? 'CLOSED' : 'OPEN',
      compositeApproved: !!(gate && gate.compositeApproved === true && gate.approvedBy === 'user'),
    };
    if (out.humanVisualGate.status !== 'CLOSED') out.reds.push({
      id: 'H1', bucket: '本輪阻塞', item: '合成畫面人工閘門仍開啟',
      detail: '四張來源圖已核准。遊戲合成畫面尚未核准。REVIEW_BY_HUMAN。本工具不宣布通關或部署許可。',
    });

    cdp.close();
  } catch (e) {
    out.error = e.message;
    out.errorStack = (e.stack || '').split('\n').slice(0, 6).join('\n');
    console.error('流程失敗：', e.message);
  } finally {
    try { if (chrome) chrome.kill(); } catch {}
    server.close();
  }

  fs.writeFileSync(path.join(ART, 'art-shots.json'), JSON.stringify(out, null, 2) + '\n');
  const notFound = [...new Set(requests.filter(r => r.status === 404).map(r => r.url))];
  out.requests404 = notFound;
  if (notFound.length) console.log(`\n⚠ 404（${notFound.length}）：${notFound.slice(0, 12).join('、')}`);
  console.log(`\n=== 美術唯一性 A／D 組 ===`);
  console.log(`截圖：${fs.readdirSync(ART).filter(f => f.endsWith('.png')).length} 張 → ${path.relative(ROOT, ART).replace(/\\/g, '/')}/`);
  if (out.error) console.log(`流程錯誤：${out.error}`);
  console.log(`RED ${out.reds.length} 項：${out.reds.map(r => r.id).join('、') || '（無）'}`);
  out.reds.forEach(r => console.log(`  [${r.id}] ${r.item}\n        ${r.detail}`));
  if (out.measured) {
    console.log('\n量測（不自動判通過，交人工審）：');
    for (const [k, v] of Object.entries(out.measured)) console.log(`  [${k}] ${v.status}`);
  }
  if (out.warnings.length) out.warnings.forEach(w => console.log(`  [注意] ${w}`));
  console.log(`外觀是否達標：REVIEW_BY_HUMAN（本工具不宣布美術合格；真機未測）。`);
  process.exit(out.error ? 2 : (out.reds.length ? 1 : 0));
})();
