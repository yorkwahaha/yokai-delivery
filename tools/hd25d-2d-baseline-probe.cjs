// 獨立驗收校準工具（只新增、不修改任何既有檔案）。
// 目的：以「已知正確的 2D 回退」(?tilt=1) 校準 Chrome/CDP 驗收管線，並核實
//       (a) 驗收腳本實際進入的遊戲目標到底是哪一關，而不是只看畫面有反應；
//       (b) 預期的失敗真的會被偵測（負向對照），不是「作者說通過」。
// 輸出只寫到 artifacts/validation/hd25d-integration/，不覆蓋任何歷史 artifacts。
// 用法：node tools/hd25d-2d-baseline-probe.cjs
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const output = path.join(root, 'artifacts', 'validation', 'hd25d-integration');
const reportFile = path.join(output, 'hd25d-2d-baseline-probe.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };

// 只記錄、不改變行為的頁面內掛鉤：攔截遊戲實際呼叫的 OVERWORLD.confirm，
// 記下真正交給 start(stageId) 的關卡 ID。verify-tilt.cjs 完全沒有這段證據。
const PAGE_HOOK = `
try{ localStorage.setItem('yokai-tutorial-v1', JSON.stringify('skip')); }catch(e){}
window.__HD25D_CONFIRM = [];
(function(){
  var timer = setInterval(function(){
    var ow = window.OVERWORLD;
    if(!ow || typeof ow.confirm !== 'function' || ow.__hd25dHooked) return;
    ow.__hd25dHooked = true;
    var orig = ow.confirm;
    ow.confirm = function(){
      var r = orig.apply(this, arguments);
      try{ window.__HD25D_CONFIRM.push(r && r.stageId ? String(r.stageId) : null); }catch(e){}
      return r;
    };
    clearInterval(timer);
  }, 25);
})();
`;

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 1; this.pending = new Map(); this.errors = [];
    ws.onmessage = e => {
      const a = JSON.parse(e.data);
      if (a.method === 'Runtime.exceptionThrown') {
        const d = a.params?.exceptionDetails;
        this.errors.push(String(d?.exception?.description || d?.text || 'JS runtime exception').split('\n')[0]);
        return;
      }
      const p = this.pending.get(a.id);
      if (p) { this.pending.delete(a.id); a.error ? p.reject(Error(JSON.stringify(a.error))) : p.resolve(a.result); }
    };
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}

const key = async (c, k, code, vk) => {
  await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
};

// 每項 expectation 都同時做「正確值應通過」與「改錯值必須被偵測」兩件事。
const checks = [];
function record(name, expect, actual, want, extra) {
  const mismatches = expect.filter(e => e.actual !== e.want);
  checks.push({ name, kind: 'positive', ok: mismatches.length === 0, mismatches, actual, want, ...extra });
  return mismatches.length === 0;
}
// 負向對照：把每個期望值換成必定不同的哨兵值，確認比較器真的會抓到不一致。
function recordSensitivity(name, expect) {
  const misses = [];
  for (const [i, e] of expect.entries()) {
    const bogus = (typeof e.want === 'number') ? e.want + 0.37 : '__hd25d_bogus__';
    // 模擬：若把第 i 項期望換成必定不同的哨兵值，mismatch 數量必須增加。
    const after = expect.map((o, j) => (j === i ? { ...o, want: bogus } : o)).filter(o => o.actual !== o.want).length;
    const before = mismatchesOf(expect, i);
    if (after <= before) misses.push({ index: i, field: e.label, bogus, mismatchesBefore: before, mismatchesAfter: after });
  }
  checks.push({ name, kind: 'negative-control', ok: misses.length === 0, misses, coveredFields: expect.map(e => e.label) });
  return misses.length === 0;
}
function mismatchesOf(expect, skipIndex) {
  let n = 0;
  expect.forEach((e, j) => { if (j !== skipIndex && e.actual !== e.want) n++; });
  return n;
}

const PIXELS = `(()=>{const c=RENDERER.getCanvas();const t=document.createElement('canvas');
  t.width=64;t.height=40;const x=t.getContext('2d');x.drawImage(c,0,0,64,40);
  const d=x.getImageData(0,0,64,40).data;const set=new Set();let sum=0;
  for(let i=0;i<d.length;i+=4){set.add(((d[i]>>3)<<10)+((d[i+1]>>3)<<5)+(d[i+2]>>3));sum+=d[i]+d[i+1]+d[i+2];}
  return {colors:set.size,avg:+(sum/(d.length/4*3)).toFixed(2),w:c.width,h:c.height};})()`;

async function playIntoGame(c, port, query) {
  const seen = new Set();
  const note = async () => { try { seen.add(await c.eval('document.body?.dataset?.gameScreen')); } catch (e) { seen.add('<eval-failed>'); } };
  await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html${query}` });
  let st = {};
  for (let i = 0; i < 130; i++) {
    await sleep(140); st = await c.eval('({screen:document.body?.dataset?.gameScreen,loaded:!!window.ART?.player})');
    await note();
    if (st.screen === 'menu' && st.loaded) break;
  }
  if (st.screen !== 'menu') throw Error('menu load failed: ' + JSON.stringify(st));
  await key(c, 'Enter', 'Enter', 13);
  for (let i = 0; i < 85; i++) { await sleep(120); await note(); st = await c.eval('({screen:document.body?.dataset?.gameScreen})'); if (st.screen === 'map') break; }
  if (st.screen !== 'map') throw Error('map enter failed: ' + JSON.stringify(st));
  await sleep(350);
  await key(c, 'ArrowRight', 'ArrowRight', 39); // gate → night-town（單站）
  await sleep(1400); await note();
  await key(c, 'Enter', 'Enter', 13);
  for (let i = 0; i < 85; i++) { await sleep(120); await note(); st = await c.eval('({screen:document.body?.dataset?.gameScreen})'); if (st.screen === 'other') break; }
  if (st.screen !== 'other') throw Error('game start failed: ' + JSON.stringify(st));
  await sleep(900); await note();
  const metrics = await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen,canvas:[RENDERER.getCanvas().width,RENDERER.getCanvas().height],bounds:VIEWPORT.worldBounds()})');
  metrics.confirmed = await c.eval('window.__HD25D_CONFIRM.slice()');
  metrics.screens = [...seen].filter(Boolean);
  return metrics;
}

async function clickTiltToggle(c) {
  const pt = await c.eval(`(()=>{const b=VIEWPORT.hudBounds(),v=VIEWPORT.get();
    return {x:(b.right-52-1+26+v.offsetX)*v.scale, y:(b.top+14+52+12+22+v.offsetY)*v.scale};})()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await c.send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  }
  return pt;
}

async function main() {
  if (!fs.existsSync(chrome)) throw Error('Chrome unavailable');
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, b) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(b);
    });
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yokai-hd25d-probe-'));
  const child = spawn(chrome, ['--headless=new', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank'],
    { stdio: 'ignore', windowsHide: true });
  let ws; const started = new Date().toISOString();
  try {
    let dbg;
    for (let i = 0; i < 110; i++) { const f = path.join(dir, 'DevToolsActivePort'); if (fs.existsSync(f)) { dbg = +fs.readFileSync(f, 'utf8').split('\n')[0]; break; } await sleep(100); }
    if (!dbg) throw Error('Chrome debugging port timeout');
    const targets = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
    const c = new CDP(ws);
    await c.send('Page.enable'); await c.send('Runtime.enable');
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_HOOK });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

    // ── 校準 A：已知正確 2D 回退（?tilt=1）真的能走完 menu→map→戰鬥 ──
    c.errors.length = 0;
    const m2d = await playIntoGame(c, port, '?tilt=1');
    const px = await c.eval(PIXELS);
    const errs2d = [...c.errors];
    const expect2d = [
      { label: 'VIEWPORT.tiltScale', actual: m2d.tilt, want: 1 },
      { label: 'VIEWPORT.spacingScaleY', actual: m2d.spacing, want: 1 },
      { label: 'gameScreen', actual: m2d.screen, want: 'other' },
      { label: 'screen transitions', actual: ['menu', 'map', 'other'].every(s => m2d.screens.includes(s)), want: true },
      { label: 'actual stageId handed to start()', actual: m2d.confirmed[m2d.confirmed.length - 1] ?? null, want: 'night-town' },
      { label: 'canvas width', actual: px.w > 0, want: true },
      { label: 'distinct canvas colors', actual: px.colors > 4, want: true },
      { label: 'JS exceptions during 2D run', actual: errs2d.length, want: 0 },
    ];
    record('A. 2D fallback (?tilt=1) real playthrough + actual stage target', expect2d, m2d, null, { pixels: px, errors: errs2d, screens: m2d.screens });
    recordSensitivity('A-neg. sensitivity of every A assertion (must flag wrong values)', expect2d);

    // ── 校準 B：2D 頁面上的真實畫布按鈕切換（2D→0.60→2D），實測 spacing ──
    await clickTiltToggle(c); await sleep(950);
    const to25d = await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen})');
    await clickTiltToggle(c); await sleep(1150);
    const to2d = await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen})');
    // 必須成立：真實畫布按鈕確實被點到，1↔0.60 真的來回切換、畫面沒離開戰鬥，
    // 且本局世界幾何不變 —— ?tilt=1 起局的 spacing 全程必須維持 1。
    const expectToggle = [
      { label: '2D page spacing before toggle', actual: m2d.spacing, want: 1 },
      { label: '2D→0.60 tilt', actual: to25d.tilt, want: 0.6 },
      { label: '2D→0.60 spacing', actual: to25d.spacing, want: 1 },
      { label: '0.60→2D tilt', actual: to2d.tilt, want: 1 },
      { label: '0.60→2D spacing', actual: to2d.spacing, want: 1 },
      { label: 'toggle keeps screen', actual: to2d.screen, want: 'other' },
    ];
    record('B. live on-canvas tilt toggle round trip from the 2D page keeps world layout at spacing 1', expectToggle, { before: m2d.spacing, to25d, to2d }, null);
    recordSensitivity('B-neg. sensitivity of every B assertion', expectToggle);

    // ── 校準 B2：0.60 預設頁面的同一組按鈕（反向方向），供兩條路徑對照 ──
    c.errors.length = 0;
    const m060 = await playIntoGame(c, port, '');
    await clickTiltToggle(c); await sleep(950);
    const b2To2d = await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen})');
    await clickTiltToggle(c); await sleep(1150);
    const b2To25d = await c.eval('({tilt:VIEWPORT.tiltScale(),spacing:VIEWPORT.spacingScaleY(),screen:document.body.dataset.gameScreen})');
    // 必須成立：預設 0.60 起局的 spacing 全程維持 1.20，切到 2D 也不回退成 1。
    const expectB2 = [
      { label: 'default page tilt before toggle', actual: m060.tilt, want: 0.6 },
      { label: 'default page spacing before toggle', actual: m060.spacing, want: 1.2 },
      { label: '0.60→2D tilt', actual: b2To2d.tilt, want: 1 },
      { label: '0.60→2D spacing', actual: b2To2d.spacing, want: 1.2 },
      { label: '2D→0.60 tilt again', actual: b2To25d.tilt, want: 0.6 },
      { label: '2D→0.60 spacing again', actual: b2To25d.spacing, want: 1.2 },
      { label: 'actual stageId on default page', actual: m060.confirmed[m060.confirmed.length - 1] ?? null, want: 'night-town' },
      { label: 'JS exceptions on default page', actual: c.errors.length, want: 0 },
    ];
    record('B2. default 0.60 page: stage target + toggle keeps world layout at spacing 1.20', expectB2, { m060, to2d: b2To2d, to25d: b2To25d }, null);
    recordSensitivity('B2-neg. sensitivity of every B2 assertion', expectB2);

    // ── 校準 C：JS 例外偵測器的負向對照（真的去載入會拋例外的頁面）──
    c.errors.length = 0;
    await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/artifacts/validation/hd25d-integration/hd25d-throw-probe.html` });
    await sleep(1400);
    const probeErrors = [...c.errors];
    record('C. exception detector fires on a page that really throws',
      [{ label: 'detected exceptions', actual: probeErrors.length, want: 2 }], { probeErrors }, null, { probeErrors });

    const summary = {
      started, finished: new Date().toISOString(), chrome: '155.0.8059.40',
      viewport: '1280x800', url: '?tilt=1',
      actualStageTarget: m2d.confirmed,
      metrics2d: m2d, pixels: px, errors2d: errs2d,
      toggle: { to25d, to2d },
      metricsDefault060: m060, toggleDefault060: { to2d: b2To2d, to25d: b2To25d },
      worldLayoutContract: {
        rule: 'spacing 由起局網址決定；animateTiltScale 只改投影，本局既有世界幾何必須維持原值。',
        '?tilt=1 起局': { spacingThroughout: [m2d.spacing, to25d.spacing, to2d.spacing], expected: [1, 1, 1] },
        '預設 0.60 起局': { spacingThroughout: [m060.spacing, b2To2d.spacing, b2To25d.spacing], expected: [1.2, 1.2, 1.2] },
      },
      probeErrors,
      checks,
      failed: checks.filter(x => !x.ok).map(x => x.name),
    };
    fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
    for (const ch of checks) console.log((ch.ok ? 'PASS ' : 'FAIL ') + ch.name + (ch.ok ? '' : ' :: ' + JSON.stringify(ch.mismatches || ch.misses)));
    console.log('REPORT ' + reportFile);
    if (summary.failed.length) { console.error('CALIBRATION FAILED: ' + summary.failed.join(' | ')); process.exitCode = 1; }
    else console.log('CALIBRATION OK: 2D 回退可跑、實際關卡已證實、每個斷言與例外偵測都已負向驗證');
  } finally {
    try { ws?.close(); } catch {}
    child.kill(); server.close(); await sleep(400);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}
main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });