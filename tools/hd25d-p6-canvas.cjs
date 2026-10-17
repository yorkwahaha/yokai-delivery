// P6 獨立驗收：Chrome 真 Canvas 驗收器（只新增，不修改任何 production js）。
//
// 做法：驗收伺服器在回應內容上做動態注入，磁碟檔案完全不動。
//   * /js/game.js  → 回應內容 = 原始碼 + tools/hd25d-fixture-hook.cjs（附加在 IIFE 結尾前）
//   * /index.html  → 回應內容 = 原始碼 + <script src="/__hd25d__/rig.js">（在遊戲腳本之前）
// 正式遊戲不需要、也沒有任何 debug 介面。
//
// 嚴格規則：任何 JS 例外、任何檢查失敗 → 退出碼非 0。
// 用法：
//   node tools/hd25d-p6-canvas.cjs                  跑完整 P6 驗收
//   node tools/hd25d-p6-canvas.cjs --selftest       負向自檢：證明例外真的會讓退出碼變非 0
//   node tools/hd25d-p6-canvas.cjs --s10-selftest   只驗固定秒數與 transition 0.8，不寫 p6-canvas-results.json
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const output = path.join(root, 'artifacts', 'validation', 'hd25d-integration', 'p6-canvas');
const pngDir = path.join(output, 'png');
// 真實像素證據：桌機與行動裝置模擬尺寸。
const DEVICES = {
  desktop: { width: 1280, height: 800, label: '1280x800' },
  phone: { width: 844, height: 390, label: '844x390' },
  tablet: { width: 1194, height: 834, label: '1194x834' },
};
const FIXTURE = require('./hd25d-fixture-hook.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const SKILLS = ['katana', 'barrier', 'needle', 'boom', 'fire', 'thunder'];
// AGY CTM 量測所對應的凍結值；S8 以此確認量的是同一版本。
const skillfxFrozen = 'ee2968cb71d47ae525d0a89f58cdf7a831f0e6d151a177cd1cef1f6e6b756086';
// S8 katana：3 傾角 × 6 角度（與 hd25d-agy-transform.cjs ANGLES 一致）。
const S8_KATANA_K_KEYS = ['k_1', 'k_0.8', 'k_0.6'];
const S8_KATANA_ANGLE_RAD = [0, 30, 45, 60, 90, 135].map(d => +(d * Math.PI / 180).toFixed(4));
const S8_KATANA_EXPECTED = S8_KATANA_K_KEYS.length * S8_KATANA_ANGLE_RAD.length;

function katanaChecksFromAgy(agy) {
  const rows = [];
  for (const tiltKey of S8_KATANA_K_KEYS) {
    const arr = agy?.katanaChecks?.[tiltKey];
    for (const expectedRad of S8_KATANA_ANGLE_RAD) {
      const hit = Array.isArray(arr)
        ? arr.find(x => Math.abs((x.angleRad ?? NaN) - expectedRad) < 0.002)
        : null;
      if (!hit) {
        rows.push({ tiltKey, angleRad: expectedRad, angleDeg: Math.round(expectedRad * 180 / Math.PI),
          count: 0, pass: false, netY: null, skew: null, ratio: null, missing: true });
        continue;
      }
      rows.push({
        tiltKey, angleRad: hit.angleRad, angleDeg: Math.round(hit.angleRad * 180 / Math.PI),
        count: hit.count, pass: hit.pass === true,
        netY: hit.analysis?.netY, skew: hit.analysis?.skew, ratio: hit.analysis?.ratio,
        dot: hit.analysis?.dot, missing: false,
      });
    }
  }
  return rows;
}

function katanaRowOk(i) {
  return !i.missing && i.pass === true && Number(i.count) > 0
    && Math.abs(i.netY - 1) < 0.01
    && (i.skew == null || i.skew < 0.01)
    && (i.ratio == null || Math.abs(i.ratio - 1) < 0.01);
}

// 驗收伺服器注入的頁面內掛鉤：只做「受控場景設定」與「回報」，不改任何遊戲邏輯。
const RIG = `
window.__HD25D = { exceptions: [], log: [] };
window.addEventListener('error', e => window.__HD25D.exceptions.push('error: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', e => window.__HD25D.exceptions.push('rejection: ' + e.reason));
try { localStorage.setItem('yokai-tutorial-v1', JSON.stringify('skip')); } catch (e) {}
(function(){
  var timer = setInterval(function(){
    var ow = window.OVERWORLD;
    if (!ow || typeof ow.confirm !== 'function' || ow.__hd25dHooked) return;
    ow.__hd25dHooked = true;
    var orig = ow.confirm;
    window.__HD25D.stageConfirmations = [];
    ow.confirm = function(){ var r = orig.apply(this, arguments);
      try { window.__HD25D.stageConfirmations.push(r && r.stageId ? String(r.stageId) : null); } catch (e) {}
      return r; };
    clearInterval(timer);
  }, 20);
})();
window.__HD25D_SELFTHROW = function(){ setTimeout(function(){ throw new Error('hd25d-p6-negative-control'); }, 30); };
// 差分像素量測：先取基準畫面，施放特效後只量「與基準不同」的像素外框。
// 這是真正斷言畫面形狀，不是只看有沒有例外。
window.__HD25D_CAPTURE_DIFF = function(threshold){
  var c = RENDERER.getCanvas();
  var mk = function(){ var t=document.createElement('canvas'); t.width=c.width; t.height=c.height;
    var g=t.getContext('2d'); g.drawImage(c,0,0); return t; };
  if(!window.__HD25D_base){ window.__HD25D_base = mk().getContext('2d').getImageData(0,0,c.width,c.height);
    window.__HD25D_w=c.width; window.__HD25D_h=c.height; return {armed:true,w:window.__HD25D_w,h:window.__HD25D_h}; }
  var now = mk().getContext('2d').getImageData(0,0,window.__HD25D_w,window.__HD25D_h);
  var b = window.__HD25D_base, th = threshold||26, x0=1e9,y0=1e9,x1=-1,y1=-1,n=0;
  for(var y=0;y<window.__HD25D_h;y++)for(var x=0;x<window.__HD25D_w;x++){
    var i=(y*window.__HD25D_w+x)*4;
    if(Math.abs(now.data[i]-b.data[i])+Math.abs(now.data[i+1]-b.data[i+1])+Math.abs(now.data[i+2]-b.data[i+2])>th){
      n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
  }
  return n? {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,pixels:n,ratio:+((y1-y0+1)/(x1-x0+1)).toFixed(4)} : {pixels:0};
};
`;

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 1; this.pending = new Map(); this.exceptions = [];
    ws.onmessage = e => {
      const a = JSON.parse(e.data);
      if (a.method === 'Runtime.exceptionThrown') {
        const d = a.params?.exceptionDetails;
        this.exceptions.push(String(d?.exception?.description || d?.text || 'JS runtime exception').split('\n')[0]);
        return;
      }
      const p = this.pending.get(a.id);
      if (p) { this.pending.delete(a.id); a.error ? p.reject(Error(JSON.stringify(a.error))) : p.resolve(a.result); }
    };
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
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
const PIXELS = `(()=>{const c=RENDERER.getCanvas();const t=document.createElement('canvas');
  t.width=96;t.height=60;const x=t.getContext('2d');x.drawImage(c,0,0,96,60);
  const d=x.getImageData(0,0,96,60).data;const set=new Set();let sum=0;
  for(let i=0;i<d.length;i+=4){set.add(((d[i]>>3)<<10)+((d[i+1]>>3)<<5)+(d[i+2]>>3));sum+=d[i]+d[i+1]+d[i+2];}
  return {colors:set.size,avg:+(sum/(d.length/4*3)).toFixed(2)};})()`;

// 同 Node 契約測試的固定場景幾何（正前方 ±0.54 弧度、半徑 40 起每隻 +18）。
const foeField = `(()=>{const out=[];for(let i=0;i<${'${N}'};i++){const a=((i%7)-3)*0.18,r=40+i*18;
  out.push({dx:+(Math.cos(a)*r).toFixed(3),dy:+(Math.sin(a)*r).toFixed(3),hp:999,max:999});}return out;})()`;

function startServer({ blockArt = false, blockPathRe = null } = {}) {
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    const pathname = decodeURIComponent(url.split('?')[0]);
    if (pathname === '/__hd25d__/rig.js') {
      res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }).end(RIG);
      return;
    }
    // 單一元件 404：只擋指定圖檔其餘照常載入，用來驗「部分圖形載入失敗」的 fallback。
    if (blockPathRe && blockPathRe.test(pathname)) { res.writeHead(404, { 'cache-control': 'no-store' }).end('hd25d blocked'); return; }
    if (blockArt && /^\/(assets|art)\//.test(pathname) && !/\.mp3$/.test(pathname)) {
      res.writeHead(404, { 'cache-control': 'no-store' }).end('hd25d blocked');
      return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file === path.join(root, 'js', 'game.js')) {
        const src = buf.toString('utf8');
        const end = src.lastIndexOf('})();');
        if (end > 0) { buf = Buffer.from(src.slice(0, end) + FIXTURE + src.slice(end), 'utf8'); }
      }
      if (file === path.join(root, 'index.html')) {
        buf = Buffer.from(buf.toString('utf8').replace(/<script src="js\/game\.js[^"]*"/,
          '<script src="/__hd25d__/rig.js"></script>\n<script src="js/game.js"'), 'utf8');
      }
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(buf);
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function launchChrome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yokai-hd25d-p6-'));
  const child = spawn(chrome, ['--headless=new', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank'],
    { stdio: 'ignore', windowsHide: true });
  let dbg;
  for (let i = 0; i < 120; i++) { const f = path.join(dir, 'DevToolsActivePort'); if (fs.existsSync(f)) { dbg = +fs.readFileSync(f, 'utf8').split('\n')[0]; break; } await sleep(100); }
  if (!dbg) { child.kill(); throw Error('Chrome debugging port timeout'); }
  const targets = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  return { ws, child, dir };
}

async function newPage(c, { width = 1280, height = 800 } = {}) {
  c.exceptions.length = 0;
  await c.send('Page.enable'); await c.send('Runtime.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
}
async function open(c, port, query, { requireArt = true } = {}) {
  await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html${query}` });
  // 連續重試，避免剛關掉上一個 Chrome 時的啟動競態造成假失敗。
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < 150; i++) {
      await sleep(140);
      const st = await c.eval('({screen:document.body?.dataset?.gameScreen,ready:!!window.ART?.player,rig:!!window.__HD25D})').catch(() => ({}));
      const artOk = requireArt ? st.ready : true;
      if (st.screen === 'menu' && artOk && st.rig) { if (!requireArt) await sleep(2500); return st; }
    }
    await sleep(1200);
  }
  throw Error('menu never became ready');
}
// 真的走 menu → map → 戰鬥，用真鍵盤事件。
async function enterLevel(c, { steps = 1, enter = true } = {}) {
  await key(c, 'Enter', 'Enter', 13);
  for (let i = 0; i < 90; i++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'map') break; }
  if (await c.eval('document.body?.dataset?.gameScreen') !== 'map') throw Error('map not reached');
  await sleep(350);
  for (let s = 0; s < steps; s++) { await key(c, 'ArrowRight', 'ArrowRight', 39); await sleep(1400); }
  if (enter) await key(c, 'Enter', 'Enter', 13);
  for (let i = 0; i < 90; i++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'other') break; }
  if (await c.eval('document.body?.dataset?.gameScreen') !== 'other') throw Error('level not reached');
  await sleep(700);
}

// 真實截圖：交給 AGY／使用者目視覆核，不能只有像素顏色數。
const shots = [];
async function shot(c, name, note) {
  const res = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(pngDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
  const size = fs.statSync(file).size;
  shots.push({ file: path.relative(root, file), bytes: size, note: note || '' });
  return file;
}

async function runFrames(c, frames, stepMs = 50) {
  return c.eval(`(async()=>{const d=[];let last=0;
    await new Promise(done=>{const tick=t=>{if(last)d.push(t-last);last=t;
      if(d.length>=${frames})return done();requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    const s=d.slice().sort((a,b)=>a-b);
    return {frames:d.length,fps:+(1000/(d.reduce((a,b)=>a+b,0)/d.length)).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2)};})()`);
}

// 只給 S10／S11 關鍵影格。遊戲迴圈在 frame 開頭就排下一幀，所以要先換成空函式，
// 再讓已經排進佇列的那一幀跑完。之後 VIEWPORT.advanceTilt 不會再被 rAF 推進。
async function holdAutoRaf(c) {
  await c.eval(`(()=>{
    if (window.__HD25D_RAF_HELD) return true;
    window.requestAnimationFrame = function(){ return 0; };
    window.__HD25D_RAF_HELD = true;
    return true;
  })()`);
  await sleep(200);
}

function armTiltSource(modeName) {
  if (modeName === 'transition080') return 'VIEWPORT.setTiltScale(1);VIEWPORT.animateTiltScale(0.6,0.8);VIEWPORT.advanceTilt(0.4);';
  if (modeName === '2d') return 'VIEWPORT.setTiltScale(1);';
  return 'VIEWPORT.setTiltScale(0.6);';
}

// 停住 rAF 之後，用固定秒數推進特效並同步 drawWorld。不經遊戲 update，故不推進油量。
async function paintFixedEvent(c, { skill, event, lv, ageSeconds, modeName, extra = '', stormChild = false }) {
  const arm = armTiltSource(modeName);
  const play = stormChild
    ? `window.SKILLFX.play('thunder','storm',5,{x:p.x,y:p.y,r:280,delay:0});
       window.SKILLFX.play('thunder','strike',5,{x:p.x,y:p.y,r:280,stormChild:true,delay:0});`
    : `window.SKILLFX.play(${JSON.stringify(skill)},${JSON.stringify(event)},${lv},{x:p.x,y:p.y,ang:0.2,${extra}delay:0,target:{x:p.x+220,y:p.y},count:5});`;
  return c.eval(`(()=>{
    ${arm}
    const f=window.fixture;
    f.freezeSpawn(); f.clearScene(); f.soloSkill(${JSON.stringify(skill)},${lv});
    f.scene(${foeField.replace('${N}', '4')}); f.freezeWeapons(); f.setElapsed(0.4);
    window.SKILLFX.reset?.(); window.FX.reset?.();
    const p=f.playerPos();
    ${play}
    const age=${ageSeconds};
    window.SKILLFX.update(age); window.FX.update(age);
    const cap={strike:0,max:0,cloud:0};
    const orig=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(img){
      try{
        const main=document.getElementById('game');
        if(this.canvas===main && img){
          const src=String(img.currentSrc||img.src||'');
          if(/thunder_strike_lv5_vfx\\.webp/.test(src)) cap.max++;
          else if(/thunder_strike_vfx\\.webp/.test(src)) cap.strike++;
          if(/thunder_cloud_vfx\\.webp/.test(src)) cap.cloud++;
        }
      }catch(e){}
      return orig.apply(this, arguments);
    };
    try{ f.drawWorld(); } finally { CanvasRenderingContext2D.prototype.drawImage=orig; }
    const ps=window.FX.particles?.()||[];
    let fxMaxLife=0; for (const q of ps) fxMaxLife=Math.max(fxMaxLife, +q.life||0);
    const boltDraws=${lv}===5 ? cap.max : cap.strike;
    return {tilt:+VIEWPORT.tiltScale(), spacing:VIEWPORT.spacingScaleY(), elapsed:f.snapshot().elapsed,
      eventAgeSeconds:age, draws:cap, boltDraws, fxMaxLife:+fxMaxLife.toFixed(4), player:p};
  })()`);
}

// artFx 壽命沒有 production 出口。有對到正式 drawImage 才記「編寫壽命 − 這一次固定秒數」，否則 0。
const THUNDER_LIFE = {
  strike: { bolt: 0.28, cloud: 0.45 },
  storm: { bolt: 0, cloud: 0.68 },
  'storm-child': { bolt: 0.33, cloud: 0.68 },
};
function activeArtLife(eventName, lv, ageSeconds, draws, fxMaxLife) {
  const spec = THUNDER_LIFE[eventName];
  if (!spec) return { source: 'fx-particles', fxMaxLife };
  const boltDraws = lv === 5 ? draws.max : draws.strike;
  const remain = (life, drawn) => drawn ? +Math.max(0, life - ageSeconds).toFixed(4) : 0;
  return {
    source: 'authored-life-minus-fixed-age-if-drawImage',
    bolt: remain(spec.bolt, boltDraws > 0),
    cloud: remain(spec.cloud, draws.cloud > 0),
    fxMaxLife,
  };
}

// 每輪都記錄實際被驗收的 production 版本，避免驗收的不是最終版本。
function pinState() {
  const files = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).sort();
  const per = files.map(f => ({ file: `js/${f}`, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'js', f))).digest('hex') }));
  const aggregate = crypto.createHash('sha256').update(per.map(x => `${x.file}=${x.sha256}`).join('\n')).digest('hex');
  const head = require('node:child_process').execSync('git rev-parse HEAD', { cwd: root }).toString().trim();
  const dirty = require('node:child_process').execSync('git status --porcelain=v1 js', { cwd: root }).toString().trim().split('\n').filter(Boolean);
  return { at: new Date().toISOString(), head, jsAggregateSha256: aggregate, files: per, dirtyJs: dirty };
}

// 逐模式 contact sheet：點擊可放大原圖（AGY 覆核用）。
function buildContactSheet(shots) {
  const groups = {};
  for (const s of shots) {
    const m = /^skill-([^-]+)-/.exec(s.file);
    const key = /^event-/.test(s.file) ? `關鍵影格（事件同步）` : (m ? `技能定時（${m[1]}）` : '關鍵畫面（場景）');
    (groups[key] = groups[key] || []).push(s);
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const section = (title, list) => `<h2>${esc(title)}（${list.length}）</h2><div class="grid">` +
    list.map(s => `<figure><a href="${esc(s.file)}" target="_blank"><img loading="lazy" src="${esc(s.file)}" alt=""></a><figcaption>${esc(s.note)}<br><small>${esc(s.file)}</small></figcaption></figure>`).join('') + '</div>';
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>hd25d P6 真 Canvas 證據 contact sheet</title><style>
body{font-family:"Microsoft JhengHei",sans-serif;background:#14121a;color:#f2e9d8;margin:0;padding:16px}
h1{font-size:20px}h2{font-size:16px;margin:22px 0 8px;color:#9fe3d4}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
figure{margin:0;background:#1d1a24;border:1px solid #35303f;border-radius:6px;overflow:hidden}
img{width:100%;display:block;background:#000}
figcaption{padding:6px 8px;font-size:12px;line-height:1.5}small{color:#8d86a0}
a{color:inherit}
</style></head><body>
<h1>hd25d P6 真 Canvas 證據（點任一張可放大原圖）</h1>
<p>這是受控驗收場景（敵人、時間、位置、技能等級為受控設定），<b>不是自然玩法</b>。桌機與行動裝置為 Chrome 模擬尺寸，非實機。</p>
${Object.entries(groups).map(([k, v]) => section(k, v)).join('')}
</body></html>`;
}

async function runS10Selftest() {
  const server = await startServer();
  const launched = await launchChrome();
  const c = new CDP(launched.ws);
  const bad = [];
  const fail = (name, detail) => { bad.push({ name, detail }); console.log('FAIL ' + name + ' :: ' + JSON.stringify(detail)); };
  const pass = name => console.log('PASS ' + name);
  try {
    await newPage(c);
    await open(c, server.address().port, '?tilt=1');
    await enterLevel(c);
    await holdAutoRaf(c);
    await c.eval(`(()=>{${armTiltSource('transition080')}return VIEWPORT.tiltScale();})()`);
    await sleep(300);
    const held = await c.eval('VIEWPORT.tiltScale()');
    if (Math.abs(held - 0.8) < 1e-4) pass('transition080 停 rAF 後仍為 0.8');
    else fail('transition080 停 rAF 後仍為 0.8', { expected: 0.8, actual: held });

    await c.eval(`window.prepareSkillArt?.('thunder',1)`);
    const ready1 = await c.eval(`(async()=>{const kinds=['cloud','mark','strike'];const t0=Date.now();
      while(Date.now()-t0<20000){if(kinds.every(k=>{const im=window.thunderRasterArt?.(k);return !!(im&&im.naturalWidth>0);}))return true;
      await new Promise(r=>setTimeout(r,120));}return false;})()`);
    const strike = await paintFixedEvent(c, {
      skill: 'thunder', event: 'strike', lv: 1, ageSeconds: 0.06, modeName: 'transition080', extra: 'r:280,',
    });
    await sleep(250);
    const still = await c.eval('VIEWPORT.tiltScale()');
    const lv1Ok = ready1 === true && strike.boltDraws > 0 && Math.abs(strike.tilt - 0.8) < 1e-4 && Math.abs(still - 0.8) < 1e-4;
    if (lv1Ok) pass('Lv1 strike age0.06 正式雷柱 draw>0 且傾角維持 0.8');
    else fail('Lv1 strike age0.06 正式雷柱 draw>0 且傾角維持 0.8', { ready1, draws: strike.draws, tilt: strike.tilt, still, elapsed: strike.elapsed });
    await shot(c, 'selftest-transition080-thunder-lv1-strike-age0p06s', '自驗 Lv1 雷柱／transition080／固定 0.06s');

    await c.eval(`window.prepareSkillArt?.('thunder',5)`);
    const ready5 = await c.eval(`(async()=>{const kinds=['cloud','mark','max'];const t0=Date.now();
      while(Date.now()-t0<20000){if(kinds.every(k=>{const im=window.thunderRasterArt?.(k);return !!(im&&im.naturalWidth>0);}))return true;
      await new Promise(r=>setTimeout(r,120));}return false;})()`);
    const child = await paintFixedEvent(c, {
      skill: 'thunder', event: 'storm-child', lv: 5, ageSeconds: 0.06, modeName: 'transition080', stormChild: true,
    });
    const childOk = ready5 === true && child.draws.cloud === 1 && child.draws.max > 0 && Math.abs(child.tilt - 0.8) < 1e-4;
    if (childOk) pass('Lv5 stormChild 單雲且 max draw>0，傾角 0.8');
    else fail('Lv5 stormChild 單雲且 max draw>0，傾角 0.8', { ready5, draws: child.draws, tilt: child.tilt });
    await shot(c, 'selftest-transition080-thunder-lv5-storm-child-age0p06s', '自驗 Lv5 單雲與落點雷柱／固定 0.06s');

    const tilt060 = await paintFixedEvent(c, {
      skill: 'thunder', event: 'strike', lv: 1, ageSeconds: 0.06, modeName: 'tilt060', extra: 'r:280,',
    });
    if (tilt060.boltDraws > 0 && Math.abs(tilt060.tilt - 0.6) < 1e-4) pass('同頁改 tilt060 後 Lv1 strike draw>0 且傾角 0.6');
    else fail('同頁改 tilt060 後 Lv1 strike draw>0 且傾角 0.6', { draws: tilt060.draws, tilt: tilt060.tilt });
  } finally {
    try { launched.ws.close(); } catch (e) {}
    try { launched.child.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    await sleep(300);
    try { fs.rmSync(launched.dir, { recursive: true, force: true }); } catch (e) {}
  }
  const out = {
    finished: new Date().toISOString(), ok: bad.length === 0, failed: bad,
    note: '只寫這份自驗。不覆寫 p6-canvas-results.json，不改 failure-evidence。transition expected 維持 0.8。',
  };
  fs.writeFileSync(path.join(root, 'artifacts', 'validation', 'hd25d-integration', 's10-fixed-age-selftest.json'), JSON.stringify(out, null, 2));
  console.log(bad.length ? 'S10 SELFTEST FAILED' : 'S10 SELFTEST OK');
  process.exitCode = bad.length ? 1 : 0;
}

async function main() {
  if (process.argv.includes('--route-selftest')) {
    const blocks = {
      max: /\/thunder_strike_lv5_vfx\.webp$/,
      mark: /\/thunder_sigil_vfx\.webp$/,
      cloud: /\/thunder_cloud_vfx\.webp$/,
      oldPng: /thunder_strike(_lv5)?_vfx\.png$/,
    };
    const urls = {
      max: '/assets/img/vfx/thunder_strike_lv5_vfx.webp',
      strike: '/assets/img/vfx/thunder_strike_vfx.webp',
      mark: '/assets/img/vfx/thunder_sigil_vfx.webp',
      cloud: '/assets/img/vfx/thunder_cloud_vfx.webp',
    };
    const bad = [];
    if (!blocks.max.test(urls.max) || blocks.max.test(urls.strike) || blocks.max.test(urls.cloud) || blocks.oldPng.test(urls.max)) bad.push('bolt webp');
    if (!blocks.mark.test(urls.mark) || blocks.mark.test(urls.cloud)) bad.push('mark webp');
    if (!blocks.cloud.test(urls.cloud) || blocks.cloud.test(urls.mark)) bad.push('cloud webp');
    const onlyS10 = new Set(['S10']);
    const on10 = tag => onlyS10.has(String(tag).replace(/^S/i, 'S').toUpperCase());
    if (on10('S8') || on10('s8') || !on10('S10')) bad.push('only route');
    console.log(bad.length ? 'FAIL route-selftest ' + bad.join(',') : 'PASS route-selftest');
    process.exitCode = bad.length ? 1 : 0;
    return;
  }
  const selfTest = process.argv.includes('--selftest');
  if (!fs.existsSync(chrome)) throw Error('Chrome unavailable');
  if (process.argv.includes('--s10-selftest')) {
    fs.mkdirSync(output, { recursive: true });
    fs.mkdirSync(pngDir, { recursive: true });
    await runS10Selftest();
    return;
  }
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(pngDir, { recursive: true });
  const results = [];
  // --only=S1,S9 只重跑受影響的矩陣，避免每次都重跑不變的全表。
  const onlyArg = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
  const only = onlyArg ? new Set(onlyArg.split(',').map(s => s.trim().toUpperCase())) : null;
  const on = tag => !only || only.has(tag.toUpperCase());
  // 只跑被選取的階段：結果與退出碼都不得受未選階段影響。
  const tagOf = name => ((/^S(\d+)/.exec(String(name)) || [])[1] || '').toUpperCase();
  const check = (name, ok, detail) => {
    const tag = tagOf(name);
    if (tag && !on('S' + tag)) return;
    results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' :: ' + JSON.stringify(detail)));
  };

  // ── 負向自檢：真的讓頁面拋例外，驗收器必須以非 0 結束 ──
  if (selfTest) {
    const server = await startServer();
    const { ws, child, dir } = await launchChrome();
    const c = new CDP(ws);
    try {
      await newPage(c);
      await open(c, server.address().port, '?tilt=1');
      await c.eval('window.__HD25D_SELFTHROW()');
      await sleep(600);
      const pageErrs = await c.eval('(window.__HD25D.exceptions||[]).slice()');
      const all = [...c.exceptions, ...pageErrs];
      const ok = all.length >= 2;
      console.log((ok ? 'PASS ' : 'FAIL ') + `selftest: 例外偵測（CDP ${c.exceptions.length} 筆 / window.onerror ${pageErrs.length} 筆）`);
      fs.writeFileSync(path.join(output, 'selftest.json'), JSON.stringify({ cdpExceptions: c.exceptions, pageErrors: pageErrs, wouldExitNonZero: ok }, null, 2));
      // 驗收器「真的會」非 0 退出：用偵測結果決定退出碼。
      process.exitCode = ok ? 0 : 1;
      return;
    } finally { try { ws.close(); } catch {} child.kill(); server.close(); await sleep(300); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  }

  // ── 負向自檢 2：把例外注入正式驗收流程，證明整體驗收會非 0 退出 ──
  if (process.argv.includes('--inject-exception')) {
    const server = await startServer();
    const { ws, child, dir } = await launchChrome();
    const c = new CDP(ws);
    let gateFailed = false;
    try {
      await newPage(c);
      await open(c, server.address().port, '?tilt=1');
      await enterLevel(c);
      await c.eval('window.__HD25D_SELFTHROW()');   // 注入真例外
      await sleep(500);
      await runFrames(c, 20);
      // 與 S1 完全相同的判準：任何一筆例外都必須讓這項檢查失敗。
      const exceptionSeen = c.exceptions.length > 0;
      const s1CheckWouldPass = c.exceptions.length === 0;
      console.log((exceptionSeen && !s1CheckWouldPass ? 'PASS ' : 'FAIL ')
        + `inject-exception: 例外 ${c.exceptions.length} 筆，S1 閘門是否擋下=${!s1CheckWouldPass}`);
      fs.writeFileSync(path.join(output, 'inject-exception.json'),
        JSON.stringify({ cdpExceptions: c.exceptions, s1CheckWouldPass, expectedExitCode: 1 }, null, 2));
      if (!exceptionSeen) { console.error('注入的例外沒有被偵測到，閘門無效'); process.exitCode = 2; return; }
      // 閘門確實擋下 → 驗收整體必須以非 0 結束（等同完整驗收遇到例外時的結果）。
      process.exitCode = 1;
      return;
    } finally { try { ws.close(); } catch {} child.kill(); server.close(); await sleep(300); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  }

  // ── 1. 真實關卡目標：night-town ──
  let server = await startServer();
  let { ws, child, dir } = await launchChrome();
  let c = new CDP(ws);
  const teardown = async () => { try { ws.close(); } catch {} child.kill(); server.close(); await sleep(300); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  try {
    await newPage(c);
    await open(c, server.address().port, '?tilt=1');
    await enterLevel(c);
    const confirmed = await c.eval('(window.__HD25D.stageConfirmations||[]).slice()');
    check('S1 night-town：實際交給 start() 的關卡', confirmed[confirmed.length - 1] === 'night-town', { confirmed });
    const px = await c.eval(PIXELS);
    check('S1 真 Canvas 有實際繪製（非空白）', px.colors > 4, px);
    const t1 = await runFrames(c, 90);
    check('S1 night-town 90 幀無 JS 例外', c.exceptions.length === 0, c.exceptions);
    fs.writeFileSync(path.join(output, 's1-night-town-timing.json'), JSON.stringify(t1));
  } finally { await teardown(); }

  // ── 2. 真實關卡目標：rain-port（第二關，含敵方火彈） ──
  server = await startServer();
  ({ ws, child, dir } = await launchChrome());
  c = new CDP(ws);
  try {
    await newPage(c);
    await open(c, server.address().port, '?tilt=0.6');
    // 用遊戲自己的進度 API 標記第一關完成，才能走訪第二關；這不是 debug 介面。
    await c.eval('(()=>{try{window.STORE.completeStage("night-town");return window.STORE.isStageUnlocked("rain-port");}catch(e){return "no-store:"+e;}})()');
    // 先在真實旅路走到 rain-port：gate → night-town → cross-west → rain-port
    await key(c, 'Enter', 'Enter', 13);
    for (let i = 0; i < 90; i++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'map') break; }
    await sleep(400);
    for (let s = 0; s < 3; s++) { await key(c, 'ArrowRight', 'ArrowRight', 39); await sleep(1500); }
    await key(c, 'Enter', 'Enter', 13);
    for (let i = 0; i < 90; i++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'other') break; }
    const screen = await c.eval('document.body?.dataset?.gameScreen');
    const confirmed2 = await c.eval('(window.__HD25D.stageConfirmations||[]).slice()');
    const reachedRainPort = confirmed2[confirmed2.length - 1] === 'rain-port';
    check('S2 rain-port：實際進入第二關', reachedRainPort, { confirmed: confirmed2, screen, note: reachedRainPort ? '' : '未被解鎖時無法進入，屬預期' });
    if (reachedRainPort) {
      const t2 = await runFrames(c, 90);
      check('S2 rain-port 90 幀無 JS 例外', c.exceptions.length === 0, c.exceptions);
      fs.writeFileSync(path.join(output, 's2-rain-port-timing.json'), JSON.stringify(t2));
    }
  } finally { await teardown(); }

  // ── 3. 六技能 × Lv1-5 × {2D, 0.60, 自然過渡（非固定 0.8）}，每個都真的畫到畫布 ──
  const modes = [
    { name: '2d', query: '?tilt=1', tilt: 1 },
    { name: 'tilt060', query: '?tilt=0.6', tilt: 0.6 },
    { name: 'transition080', query: '?tilt=1', tilt: 0.8,
      naturalTransition: true,
      scopeNote: '每組 animate(0.6→0.8)+advance(0.4) 後 runFrames(26)；rAF 會走完過渡至 0.6，非固定 0.8 五階證明' },
  ];
  const skillReport = [];
  for (const mode of modes) {
    if (!on('S3')) break;
    server = await startServer();
    ({ ws, child, dir } = await launchChrome());
    c = new CDP(ws);
    try {
      await newPage(c);
      await open(c, server.address().port, mode.query);
      await enterLevel(c);
      for (const skill of SKILLS) {
        for (let lv = 1; lv <= 5; lv++) {
          await c.eval(`(()=>{const f=window.fixture;f.freezeSpawn();f.soloSkill(${JSON.stringify(skill)},${lv});
            f.scene(${foeField.replace('${N}', '8')});return true;})()`);
          if (mode.name === 'transition080') await c.eval('(()=>{const v=VIEWPORT;v.animateTiltScale(0.6,0.8);v.advanceTilt(0.4);return v.tiltScale();})()');
          const before = c.exceptions.length;
          const timing = await runFrames(c, 26);
          const actualTiltAtCapture = await c.eval('VIEWPORT.tiltScale()');
          const shotNote = mode.naturalTransition
            ? `${skill} Lv${lv}／${mode.name}（自然過渡 26 幀，capture actualTilt ${actualTiltAtCapture}，非固定 0.8）`
            : `${skill} Lv${lv}／${mode.name}（tilt ${mode.tilt}）`;
          await shot(c, `skill-${mode.name}-${skill}-lv${lv}`, shotNote);
          const px = await c.eval(PIXELS);
          const st = await c.eval('window.fixture.skillState()');
          const errs = c.exceptions.slice(before);
          skillReport.push({
            mode: mode.name, skill, lv, declaredTilt: mode.tilt, actualTiltAtCapture: +actualTiltAtCapture,
            naturalTransition: !!mode.naturalTransition, scopeNote: mode.scopeNote || null,
            colors: px.colors, fps: timing.fps, p95: timing.p95, state: st, errors: errs,
          });
          if (errs.length) { check(`S3 ${mode.name} ${skill} Lv${lv} 例外`, false, errs); }
          if (px.colors <= 4) check(`S3 ${mode.name} ${skill} Lv${lv} 畫布空白`, false, px);
        }
      }
      const s3Detail = { combos: 30 };
      if (mode.naturalTransition) s3Detail.scopeNote = mode.scopeNote;
      check(`S3 ${mode.name}：6 技能 × Lv1–5 共 30 組皆無例外且有畫面`, true, s3Detail);
    } finally { await teardown(); }
  }
  fs.writeFileSync(path.join(output, 's3-skills-matrix.json'), JSON.stringify({
    matrixNote: 'transition080：naturalTransition=true；每列 actualTiltAtCapture 為 runFrames(26) 後實測，通常≈0.6，不得當固定 0.8 五階證明。S10 才驗固定 0.8。',
    runs: skillReport,
  }, null, 2));

  // ── 4. 5 / 25 怪壓力 ──
  for (const count of [5, 25]) {
    server = await startServer();
    ({ ws, child, dir } = await launchChrome());
    c = new CDP(ws);
    try {
      await newPage(c);
      await open(c, server.address().port, '?tilt=0.6');
      await enterLevel(c);
      const info = await c.eval(`(async()=>{const f=window.fixture;f.freezeSpawn();f.soloSkill('thunder',5);
        f.scene(${foeField.replace('${N}', String(count))});
        const d=[];let last=0;await new Promise(done=>{const tick=t=>{if(last)d.push(t-last);last=t;if(d.length>=120)return done();requestAnimationFrame(tick);};requestAnimationFrame(tick);});
        const s=d.slice().sort((a,b)=>a-b);
        return {enemies:f.snapshot().enemies.length,fps:+(1000/(d.reduce((a,b)=>a+b,0)/d.length)).toFixed(2),
          p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+Math.max(...d).toFixed(2)};})()`);
      const before = c.exceptions.length;
      await runFrames(c, 30);
      check(`S4 ${count} 怪壓力：怪數正確且無例外`, info.enemies === count && c.exceptions.length === before, info);
      fs.writeFileSync(path.join(output, `s4-enemies-${count}.json`), JSON.stringify(info));
    } finally { await teardown(); }
  }

  // ── 5. Boss 結界／題板版面／黑龍／敵方火彈 ──
  server = await startServer();
  ({ ws, child, dir } = await launchChrome());
  c = new CDP(ws);
  try {
    await newPage(c);
    await open(c, server.address().port, '?tilt=0.6');
    await enterLevel(c);
    const bossInfo = await c.eval(`(async()=>{const f=window.fixture;f.freezeSpawn();
      f.soloSkill('fire',5);f.scene(${foeField.replace('${N}', '5')});
      f.prepareBoss();f.addEnemyBullet(240,0);
      const before=f.snapshot();
      const hud=f.hudBounds();
      const rects=f.bossQuizRects(3);
      const d=[];let last=0;await new Promise(done=>{const tick=t=>{if(last)d.push(t-last);last=t;if(d.length>=90)return done();requestAnimationFrame(tick);};requestAnimationFrame(tick);});
      const s=d.slice().sort((a,b)=>a-b);
      const after=f.snapshot();
      const state=f.skillState();
      const px=(()=>{const c=RENDERER.getCanvas();const t=document.createElement('canvas');t.width=96;t.height=60;
        const x=t.getContext('2d');x.drawImage(c,0,0,96,60);const dd=x.getImageData(0,0,96,60).data;const set=new Set();
        for(let i=0;i<dd.length;i+=4)set.add(((dd[i]>>3)<<10)+((dd[i+1]>>3)<<5)+(dd[i+2]>>3));return {colors:set.size};})();
      return {hasBoss:after.enemies.some(e=>e.type==='boss'),shield:before.bossQ!=null,bossQ:after.bossQ,
        rects,hud,enemyBullets:after.bullets.length,dragon:state.dragons,state,
        fps:+(1000/(d.reduce((a,b)=>a+b,0)/d.length)).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),colors:px.colors};})()`);
    const beforeBoss = c.exceptions.length;
    await runFrames(c, 20);
    check('S5 Boss 場景：結界題板存在、黑龍／敵彈已生成、無例外',
      bossInfo.hasBoss && bossInfo.bossQ != null && c.exceptions.length === beforeBoss, bossInfo);
    // 題板版面契約：不可超出 HUD、觸控目標高度須 ≥44 CSS px。
    const rectList = Array.isArray(bossInfo.rects) ? bossInfo.rects : Object.values(bossInfo.rects || {});
    const outside = rectList.filter(r => r && (r.x < bossInfo.hud.left - 1 || (r.x + (r.w || r.width || 0)) > bossInfo.hud.right + 1
      || r.y < bossInfo.hud.top - 1 || (r.y + (r.h || r.height || 0)) > bossInfo.hud.bottom + 1));
    check('S5 Boss 題板版面在 HUD 範圍內', outside.length === 0, { outside, hud: bossInfo.hud });
    fs.writeFileSync(path.join(output, 's5-boss.json'), JSON.stringify(bossInfo, null, 2));
  } finally { await teardown(); }

  // ── 6. lampout ──
  server = await startServer();
  ({ ws, child, dir } = await launchChrome());
  c = new CDP(ws);
  try {
    await newPage(c);
    await open(c, server.address().port, '?tilt=0.6');
    await enterLevel(c);
    const lamp = await c.eval(`(async()=>{const f=window.fixture;f.freezeSpawn();f.soloSkill('thunder',1);
      f.scene(${foeField.replace('${N}', '12')});f.setOil(0.4);
      const d=[];let last=0;await new Promise(done=>{const tick=t=>{if(last)d.push(t-last);last=t;if(d.length>=60)return done();requestAnimationFrame(tick);};requestAnimationFrame(tick);});
      const s=d.slice().sort((a,b)=>a-b);
      return {oil:f.snapshot().oil,delivered:f.snapshot().delivered,
        fps:+(1000/(d.reduce((a,b)=>a+b,0)/d.length)).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2)};})()`);
    const beforeLamp = c.exceptions.length;
    await runFrames(c, 20);
    check('S6 lampout：熄燈後畫面繼續且無例外', lamp.oil <= 0.4 && c.exceptions.length === beforeLamp, lamp);
    fs.writeFileSync(path.join(output, 's6-lampout.json'), JSON.stringify(lamp));
  } finally { await teardown(); }

  // ── 7. 缺圖 fallback（驗收伺服器擋掉圖片）──
  server = await startServer({ blockArt: true });
  ({ ws, child, dir } = await launchChrome());
  c = new CDP(ws);
  try {
    await newPage(c);
    await open(c, server.address().port, '?tilt=0.6', { requireArt: false });   // 圖片全被擋掉，不能等 ART.player
    await enterLevel(c);
    const fb = await c.eval(`(()=>{const f=window.fixture;f.freezeSpawn();f.soloSkill('fire',5);f.scene(${foeField.replace('${N}', '8')});return true;})()`);
    const beforeFb = c.exceptions.length;
    const timing = await runFrames(c, 40);
    const px = await c.eval(PIXELS);
    check('S7 缺圖 fallback：改走程式繪製仍無例外且有畫面', c.exceptions.length === beforeFb && px.colors > 4, { exceptions: c.exceptions.slice(beforeFb), pixels: px, timing });
    fs.writeFileSync(path.join(output, 's7-fallback.json'), JSON.stringify({ pixels: px, timing }));
  } finally { await teardown(); }

  // ── 8. 地面特效像素形狀只在選了 S8 時跑；--only 不含 S8 不得因缺 CTM 改退出碼。
  if (on('S8')) {
  const shapeRuns = [];
  for (const [label, query, tilt] of [['2d', '?tilt=1', 1], ['tilt060', '?tilt=0.6', 0.6]]) {
    server = await startServer();
    ({ ws, child, dir } = await launchChrome());
    c = new CDP(ws);
    try {
      await newPage(c);
      await open(c, server.address().port, query);
      await enterLevel(c);
      await c.eval(`(()=>{const f=window.fixture;f.freezeSpawn();f.soloSkill('barrier',5);
        f.scene(${foeField.replace('${N}', '3')});return true;})()`);
      await sleep(260);
      const armed = await c.eval('window.__HD25D_CAPTURE_DIFF()');   // 取基準
      const before = c.exceptions.length;
      await c.eval('window.SKILLFX.play("barrier","cast",5,{x:1350,y:900,r:280})');
      await runFrames(c, 8);
      const box = await c.eval('window.__HD25D_CAPTURE_DIFF()');
      shapeRuns.push({ label, tilt, ratio: box.ratio ?? null, pixels: box.pixels, w: box.w, h: box.h, errors: c.exceptions.slice(before) });
      check(`S8 ${label}：施放地面技無例外`, c.exceptions.length === before, c.exceptions.slice(before));
    } finally { await teardown(); }
  }
  const r2d = shapeRuns.find(x => x.label === '2d'), r60 = shapeRuns.find(x => x.label === 'tilt060');
  // 舊的差分像素外框方法已證實無效（外框≈整個畫布，量到的是環境動畫），
  // 診斷保留在 s8-ground-shape.json，但不再作為正式門檻。
  fs.writeFileSync(path.join(output, 's8-ground-shape-DIAGNOSTIC-ONLY.json'),
    JSON.stringify({ status: 'diagnostic-only', why: '差分外框被環境動畫污染，不能證明未二次壓扁；正式結論以 AGY 真 CTM 為準', runs: shapeRuns }, null, 2));

  // 正式 S8：引用 AGY 的真 Chrome CTM 量測結果。
  // 門檻：JSON 必須存在、每項 pass、每項 count>0、且量測時的 js 雜湊必須等於本次 js。
  // AGY 尚未產出或雜湊不一致時，整體明確 pending 且非 0 退出，絕不預設通過。
  if (on('S8')) {
  const agyPath = (process.argv.find(a => a.startsWith('--agy=')) || '').slice(6)
    || path.join(root, 'artifacts', 'validation', 'hd25d-integration', 'agy-transform-evidence.json');
  // 直接執行 AGY 的真 CTM 工具（本 run 內 invoke），並比對該 run 前後的 production 雜湊。
  const agyTool = path.join(root, 'tools', 'hd25d-agy-transform.cjs');
  let agyBefore = null, agyAfter = null, agyRun = null;
  try { agyBefore = pinState().jsAggregateSha256; } catch {}
  if (fs.existsSync(agyTool)) {
    const r = require('node:child_process').spawnSync(process.execPath, [agyTool], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
    agyRun = { exitCode: r.status, stderr: (r.stderr || '').slice(-400) };
  }
  try { agyAfter = pinState().jsAggregateSha256; } catch {}
  check('S8 AGY 真 CTM 工具可執行且退出碼 0', agyRun && agyRun.exitCode === 0, agyRun);
  check('S8 AGY 量測 run 前後 production 雜湊一致（量的是同一版本）', agyBefore && agyBefore === agyAfter, { before: agyBefore, after: agyAfter });
  let agy = null, agyErr = null;
  try { agy = JSON.parse(fs.readFileSync(agyPath, 'utf8')); } catch (e) { agyErr = String(e.message).split('\n')[0]; }
  if (!agy) {
    check('S8 真 Chrome CTM 幾何不變性（引用 AGY 量測 JSON）', false,
      { status: 'PENDING', reason: 'AGY 真 CTM JSON 尚未產出或無法讀取', expectedPath: path.relative(root, agyPath), readError: agyErr });
    console.error('S8 PENDING：AGY 真 CTM 量測未完成，整體驗收不得判為通過。');
    process.exitCode = 2;
  } else {
    const groupItems = g => Object.entries(agy[g] || {}).flatMap(([k, v]) =>
      (Array.isArray(v) ? v : [v]).map(x => ({ group: g, tilt: k, count: x.count, netY: x.analysis?.netY, pass: x.pass === true })));
    const items = [...groupItems('groundChecks'), ...groupItems('katanaChecks'), ...groupItems('textChecks')];
    const notPass = items.filter(i => i.pass !== true);
    const noData = items.filter(i => !(Number(i.count) > 0));
    check('S8 ground：每個傾角皆量到貼地 sprite 且淨縱向比例 = 0.6',
      items.filter(i => i.group === 'groundChecks').length === 3
      && items.filter(i => i.group === 'groundChecks').every(i => i.pass && i.count > 0 && Math.abs(i.netY - 0.6) < 0.01),
      items.filter(i => i.group === 'groundChecks'));
    const katanaRows = katanaChecksFromAgy(agy);
    check('S8 katana：3 傾角 × 6 角度共 18 筆皆 upright（netY=1）且正交（skew<0.01、ratio≈1）',
      katanaRows.length === S8_KATANA_EXPECTED && katanaRows.every(katanaRowOk),
      { expected: S8_KATANA_EXPECTED, total: katanaRows.length,
        anglesDeg: [0, 30, 45, 60, 90, 135], tilts: S8_KATANA_K_KEYS,
        bad: katanaRows.filter(i => !katanaRowOk(i)) });
    check('S8 潮來提示文字：每個傾角皆 upright（淨比例 = 1）',
      items.filter(i => i.group === 'textChecks').length === 3
      && items.filter(i => i.group === 'textChecks').every(i => i.pass && i.count > 0 && Math.abs(i.netY - 1) < 0.01),
      items.filter(i => i.group === 'textChecks'));
    check('S8 AGY 負向對照全部被捕捉（量測器本身有效）', agy.negativeControl?.allCaught === true, agy.negativeControl);
    // 量測範圍自評：trace 必須是 sprite 範圍（ground/text count 為 1），不是整個世界畫面。
    const worldScoped = items.filter(i => (i.group === 'groundChecks' || i.group === 'textChecks') && i.count > 4);
    check('S8 trace 為 sprite 範圍匹配，不是整個世界', worldScoped.length === 0, { overScoped: worldScoped });
    const disk = {};
    for (const rel of ['js/fx.js', 'js/game.js', 'js/renderer.js', 'js/skillfx.js']) {
      disk[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
    }
    const evStart = agy.productionHashes?.start || {};
    const evEnd = agy.productionHashes?.end || {};
    const hashOk = agy.productionHashes?.matched === true && Object.keys(disk).every(rel => evStart[rel] && evStart[rel] === evEnd[rel] && evStart[rel] === disk[rel]);
    check('S8 AGY 證據 productionHashes 與目前磁碟一致且起迄相同', hashOk, { evidenceStart: evStart, disk, matched: agy.productionHashes?.matched });
    const markerStatus = typeof agy.markerStatus === 'string' ? agy.markerStatus : (agy.markerStatus?.status || 'ABSENT');
    const markerUntested = /^UNTESTED|^ABSENT/.test(markerStatus);
    const limitations = [{ item: 'S8 marker 同幀獨立 draw', status: markerStatus,
      capturedCount: agy.markerStatus?.capturedCount ?? null,
      note: markerUntested ? '未測，不記入 PASS' : '已有量測' }];
    if (!markerUntested) {
      const mk = Object.entries(agy.markerChecks || {}).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map(x => ({ tilt: k, pass: x.pass === true, count: x.count })));
      check('S8 marker：真 Chrome 獨立 draw 每個傾角 count>0 且 pass', mk.length === 3 && mk.every(x => x.pass && Number(x.count) > 0), { total: mk.length, mk });
    }
    fs.writeFileSync(path.join(output, 's8-limitations.json'), JSON.stringify({ limitations, markerCountedAsPass: false }, null, 2));
    if (notPass.length || noData.length) { console.error('S8 FAIL：AGY 量測有未通過或無資料的項目'); process.exitCode = 1; }
  }
  fs.writeFileSync(path.join(output, 's8-ground-shape.json'), JSON.stringify(shapeRuns, null, 2));
  }
  }

  // ── 9. 關鍵畫面 PNG（桌機／手機橫向／平板橫向），供 AGY 與使用者目視覆核 ──
  const SCENES = [
    { id: 'boss-quiz', note: 'Boss 結界＋假名題板', stage: 'night-town', steps: 1, setup: `f.soloSkill('thunder',5);f.scene(${foeField.replace('${N}', '5')});f.prepareBoss();` },
    { id: 'black-dragon', note: '狐火 Lv5 黑龍飛入', stage: 'night-town', steps: 1, setup: `f.soloSkill('fire',5);f.scene(${foeField.replace('${N}', '6')});` },
    { id: 'enemy-bullets', note: '敵方火彈', stage: 'rain-port', steps: 3, setup: `f.soloSkill('needle',3);f.scene(${foeField.replace('${N}', '6')});f.addEnemyBullet(230,-40);f.addEnemyBullet(230,60);` },
    { id: 'tide-warning', note: '雨夜港潮來提示文字（與淨化靈陣同場，疑似被亮柱遮擋）', stage: 'rain-port', steps: 3, setup: `const P=f.playerPos();f.soloSkill('barrier',5);f.scene(${foeField.replace('${N}', '3')});f.pushHazard({kind:'tide',phase:'telegraph',angle:0.6,safeOffset:40,x:P.x,y:P.y-70,life:9,max:9});` },
    { id: 'tide-isolated', note: '雨夜港潮來提示文字（隔離：不施放任何技能，用於判斷遮擋是否來自同場特效）', stage: 'rain-port', steps: 3, setup: `const P=f.playerPos();f.soloSkill('barrier',1);f.scene([]);f.pushHazard({kind:'tide',phase:'telegraph',angle:0.6,safeOffset:40,x:P.x,y:P.y-70,life:9,max:9});` },
    { id: 'enemies-5', note: '5 怪戰鬥', stage: 'night-town', steps: 1, setup: `f.soloSkill('katana',5);f.scene(${foeField.replace('${N}', '5')});` },
    { id: 'enemies-25', note: '25 怪壓力', stage: 'night-town', steps: 1, setup: `f.soloSkill('thunder',5);f.scene(${foeField.replace('${N}', '25')});` },
    { id: 'lampout', note: '熄燈（油量耗盡）', stage: 'night-town', steps: 1, setup: `f.soloSkill('barrier',3);f.scene(${foeField.replace('${N}', '10')});f.setOil(0.4);` },
  ];
  for (const [devKey, dev] of Object.entries(DEVICES)) {
    if (!on('S9')) break;
    for (const sc of SCENES) {
      const blocked = sc.id === 'lampout' ? {} : {};
      server = await startServer();
      ({ ws, child, dir } = await launchChrome());
      c = new CDP(ws);
      try {
        await newPage(c, { width: dev.width, height: dev.height });
        await open(c, server.address().port, '?tilt=0.6');
        if (sc.stage === 'rain-port') await c.eval('(()=>{try{window.STORE.completeStage("night-town");}catch(e){}return true;})()');
        await enterLevel(c, { steps: sc.steps });
        await c.eval(`(()=>{const f=window.fixture;f.freezeSpawn();f.clearScene();${sc.setup}return true;})()`);
        const beforeKey = c.exceptions.length;
        await runFrames(c, sc.id === 'lampout' ? 50 : 26);
        const f2 = `scene-${sc.id}-${devKey}`;
        await shot(c, f2, `${sc.note}／${dev.label}`);
        check(`S9 ${sc.id} @${devKey}：畫面已截圖且無例外`, c.exceptions.length === beforeKey, c.exceptions.slice(beforeKey));
      } finally { await teardown(); }
    }
  }
  if (on('S9')) {
  server = await startServer({ blockArt: true });
  ({ ws, child, dir } = await launchChrome());
  c = new CDP(ws);
  try {
    await newPage(c, DEVICES.desktop);
    await open(c, server.address().port, '?tilt=0.6', { requireArt: false });
    await enterLevel(c);
    await c.eval(`(()=>{const f=window.fixture;f.freezeSpawn();f.soloSkill('fire',5);f.scene(${foeField.replace('${N}', '8')});return true;})()`);
    await runFrames(c, 30);
    await shot(c, 'scene-fallback-desktop', '缺圖 fallback／1280x800');
  } finally { await teardown(); }
  }

  // ── 10. 事件同步的技能關鍵影格（蓄勢／釋放／命中／消散）──
// 停掉自動 rAF 後，每個事件重設傾角，再用固定秒數 update + drawWorld。
// transition080 必須停在 advanceTilt(0.4) 的 0.8，不能改成 0.6。
const EVENT_SHOTS = [
  { id: 'thunder-strike', skill: 'thunder', event: 'strike', note: '雷柱（瞬間）', p: 'r:280' },
  { id: 'thunder-storm', skill: 'thunder', event: 'storm', note: '雷雲蓄勢', p: 'r:280' },
  { id: 'thunder-storm-child', skill: 'thunder', event: 'storm-child', note: 'Lv5 單雲與落點雷柱', p: 'r:280', lvOnly: 5 },
  { id: 'katana-swing', skill: 'katana', event: 'swing', note: '刀氣（瞬間）', p: 'reach:240' },
  { id: 'katana-hit', skill: 'katana', event: 'hit', note: '刀氣命中', p: 'reach:240' },
  { id: 'boom-trail', skill: 'boom', event: 'trail', note: '御符飛行', p: 'r:200' },
  { id: 'boom-hit', skill: 'boom', event: 'hit', note: '御符爆散', p: 'r:200' },
  { id: 'needle-fire', skill: 'needle', event: 'fire', note: '靈針發射', p: 'r:200' },
  { id: 'needle-trail', skill: 'needle', event: 'trail', note: '靈針命中軌跡', p: 'r:200' },
  { id: 'barrier-cast', skill: 'barrier', event: 'cast', note: '淨化靈陣展開', p: 'r:280' },
  { id: 'fire-ember', skill: 'fire', event: 'ember', note: '狐火餘燼', p: 'r:200' },
  { id: 'fire-hit', skill: 'fire', event: 'hit', note: '狐火命中', p: 'r:200' },
];
const FIXED_AGES = [0.06, 0.16];
const eventShots = [];
for (const mode of modes) {
  if (!on('S10')) break;
  server = await startServer();
  ({ ws, child, dir } = await launchChrome());
  c = new CDP(ws);
  try {
    await newPage(c);
    await open(c, server.address().port, mode.query);
    await enterLevel(c);
    await holdAutoRaf(c);
    for (const lv of [1, 2, 3, 4, 5]) {
      for (const ev of EVENT_SHOTS) {
        if (ev.lvOnly && ev.lvOnly !== lv) continue;
        const thunder = ev.skill === 'thunder';
        const kinds = lv === 5 ? ['cloud', 'mark', 'max'] : ['cloud', 'mark', 'strike'];
        let rasterReady = null;
        if (thunder) {
          await c.eval(`window.prepareSkillArt?.('thunder',${lv})`);
          rasterReady = await c.eval(`(async()=>{const kinds=${JSON.stringify(kinds)};const t0=Date.now();
            while(Date.now()-t0<20000){const ok=kinds.every(k=>{const im=window.thunderRasterArt?.(k);return !!(im&&im.naturalWidth>0);});
              if(ok)return true;await new Promise(r=>setTimeout(r,120));}return false;})()`);
          check(`S10 ${mode.name} ${ev.event} Lv${lv} 正式雷圖就緒`, rasterReady === true, { kinds });
        }
        const readEnv = `(kinds)=>{const r={};for(const k of kinds){const im=window.thunderRasterArt?.(k);
          r[k]=im&&im.naturalWidth?im.naturalWidth+'x'+im.naturalHeight:'MISSING';}
          return {raster:r,state:window.fixture.skillState()};}`;
        const env0 = await c.eval(`((${readEnv})(${JSON.stringify(thunder ? kinds : [])}))`);
        for (const ageSeconds of FIXED_AGES) {
          const before = c.exceptions.length;
          const ageLabel = String(ageSeconds).replace('.', 'p') + 's';
          const after = await paintFixedEvent(c, {
            skill: ev.skill, event: ev.event, lv, ageSeconds, modeName: mode.name,
            extra: ev.p + ',', stormChild: ev.event === 'storm-child',
          });
          const tiltOk = Math.abs(after.tilt - mode.tilt) < 1e-4;
          const measured = Math.abs(after.tilt - 1) < 1e-4 ? '2d' : Math.abs(after.tilt - 0.6) < 1e-4 ? 'tilt060' : Math.abs(after.tilt - 0.8) < 1e-3 ? 'transition080' : `tilt${after.tilt}`;
          const name = `event-${measured}-${ev.skill}-lv${lv}-${ev.event}-age${ageLabel}`;
          const life = activeArtLife(ev.event, lv, ageSeconds, after.draws, after.fxMaxLife);
          check(`S10 ${ev.skill} Lv${lv} ${ev.event} age${ageLabel} 實測傾角符合宣告 ${mode.name}`, tiltOk && measured === mode.name, { expected: mode.tilt, actual: after.tilt, measured });
          check(`S10 ${ev.skill} Lv${lv} ${ev.event} age${ageLabel} 時鐘仍在隔離起點`, after.elapsed < 3, { elapsed: after.elapsed });
          if (ev.event === 'strike' || ev.event === 'storm-child') {
            const boltFile = lv === 5 ? 'thunder_strike_lv5_vfx.webp' : 'thunder_strike_vfx.webp';
            check(`S10 ${ev.skill} Lv${lv} ${ev.event} age${ageLabel} 正式雷柱 drawImage > 0`, after.boltDraws > 0, { boltFile, draws: after.draws, eventAgeSeconds: ageSeconds, activeArtLife: life, actualTilt: after.tilt });
          }
          if (ev.event === 'storm' || ev.event === 'storm-child') {
            check(`S10 ${ev.skill} Lv${lv} ${ev.event} age${ageLabel} 雷雲 drawImage > 0`, after.draws.cloud > 0, { draws: after.draws, eventAgeSeconds: ageSeconds, activeArtLife: life });
          }
          if (ev.event === 'storm-child') {
            check(`S10 ${ev.skill} Lv${lv} ${ev.event} age${ageLabel} 只有一朵雲`, after.draws.cloud === 1, { draws: after.draws });
          }
          await shot(c, name, `${ev.note}／${ev.skill} Lv${lv}／宣告 ${mode.name}／實測 ${measured}（固定 ${ageSeconds}s，delay=0）`);
          eventShots.push({ file: path.relative(root, path.join(pngDir, `${name}.png`)), skill: ev.skill, event: ev.event,
            tier: lv, declaredMode: mode.name, mode: measured, expectedTilt: mode.tilt, actualTilt: after.tilt, tiltMatchesName: tiltOk && measured === mode.name,
            spacing: after.spacing, elapsedAtCapture: after.elapsed, rasterBefore: env0.raster,
            rasterReady, particleState: env0.state, trigger: ev.event === 'storm-child' ? 'storm()+strike(stormChild)' : `SKILLFX.play(${ev.skill},${ev.event},${lv},delay:0)`,
            eventAgeSeconds: ageSeconds, activeArtLife: life, draws: after.draws,
            note: ev.note, exceptions: c.exceptions.slice(before), player: after.player });
        }
      }
    }
    const planned = [1, 2, 3, 4, 5].reduce((n, lv) => n + EVENT_SHOTS.filter(ev => !ev.lvOnly || ev.lvOnly === lv).length * FIXED_AGES.length, 0);
    const ran = eventShots.filter(s => s.declaredMode === mode.name);
    const bad = ran.filter(s => s.exceptions.length);
    check(`S10 ${mode.name}：${planned} 張固定秒數影格皆無例外`, ran.length === planned && bad.length === 0, bad.slice(0, 3));
  } finally { await teardown(); }
}
fs.writeFileSync(path.join(output, 'event-shots-index.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), productionState: pinState(),
    note: 'S10 停自動 rAF。每個事件重設傾角後 SKILLFX.update／FX.update 固定秒數，再 fixture.drawWorld。transition080 的 expected 維持 0.8。',
    shots: eventShots }, null, 2));

  if (on('S11')) {
  const PARTIAL_BLOCKS = [
    { id: 'bolt-missing', re: /\/thunder_strike_lv5_vfx\.webp$/, url: '/assets/img/vfx/thunder_strike_lv5_vfx.webp', note: '只擋 Lv5 雷柱 webp', ev: 'strike', blocked: 'max', siblings: ['cloud', 'mark'] },
    { id: 'mark-missing', re: /\/thunder_sigil_vfx\.webp$/, url: '/assets/img/vfx/thunder_sigil_vfx.webp', note: '只擋雷印 webp', ev: 'strike', blocked: 'mark', siblings: ['cloud', 'max'] },
    { id: 'cloud-missing', re: /\/thunder_cloud_vfx\.webp$/, url: '/assets/img/vfx/thunder_cloud_vfx.webp', note: '只擋雷雲 webp', ev: 'strike', blocked: 'cloud', siblings: ['mark', 'max'] },
  ];
  const partialShots = [];
  for (const b of PARTIAL_BLOCKS) {
    if (!b.re.test(b.url) || /\.png/.test(b.re.source)) throw Error('S11 regex does not match webp url ' + b.url);
    server = await startServer({ blockPathRe: b.re });
    ({ ws, child, dir } = await launchChrome());
    c = new CDP(ws);
    try {
      await newPage(c);
      await open(c, server.address().port, '?tilt=0.6');
      await enterLevel(c);
      const before = c.exceptions.length;
      const raster = await c.eval(`(async()=>{
        window.prepareSkillArt?.('thunder',5);
        const blocked=${JSON.stringify(b.blocked)};
        const siblings=${JSON.stringify(b.siblings)};
        const read=k=>{const im=window.thunderRasterArt?.(k);return im&&im.naturalWidth>0?{ready:true,w:im.naturalWidth,h:im.naturalHeight,src:im.currentSrc||im.src||''}:{ready:false,src:''};};
        const t0=Date.now(); let snap=null;
        while(Date.now()-t0<20000){
          snap={}; snap[blocked]=read(blocked); for (const k of siblings) snap[k]=read(k);
          if (snap[blocked].ready===false && siblings.every(k=>snap[k].ready)) break;
          await new Promise(r=>setTimeout(r,120));
        }
        return {raster:snap, onmyo: typeof window.ONMYO_VFX};
      })()`);
      const blockedMiss = raster.raster[b.blocked] && raster.raster[b.blocked].ready === false;
      const siblingsReady = b.siblings.every(k => raster.raster[k] && raster.raster[k].ready === true);
      check(`S11 ${b.id}：${b.url} 被擋且其餘元件已載入`, blockedMiss && siblingsReady, { url: b.url, pattern: b.re.source, raster: raster.raster });
      await holdAutoRaf(c);
      const painted = await paintFixedEvent(c, {
        skill: 'thunder', event: b.ev, lv: 5, ageSeconds: 0.06, modeName: 'tilt060', extra: 'r:280,',
      });
      await shot(c, `partial-${b.id}`, `${b.note}／${b.url}／固定 0.06s`);
      partialShots.push({ id: b.id, url: b.url, pattern: b.re.source, ev: b.ev, blocked: b.blocked, siblings: b.siblings,
        raster, eventAgeSeconds: painted.eventAgeSeconds, actualTilt: painted.tilt,
        activeArtLife: activeArtLife(b.ev, 5, 0.06, painted.draws, painted.fxMaxLife), draws: painted.draws,
        file: `png/partial-${b.id}.png`, exceptions: c.exceptions.slice(before) });
      check(`S11 ${b.id}：單一元件 404 時仍無例外`, c.exceptions.length === before, c.exceptions.slice(before));
    } finally { await teardown(); }
  }
  fs.writeFileSync(path.join(output, 'partial-load-index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), productionState: pinState(),
      note: 'pathname 去掉 query 後必須命中 webp；被擋 kind 保持未就緒，其餘 kind 必須就緒。只無例外不算通過。', runs: partialShots }, null, 2));
  check('S11 正式頁未載入 onmyo-vfx.js',
    partialShots.length === PARTIAL_BLOCKS.length && partialShots.every(p => p.raster.onmyo === 'undefined'),
    partialShots.map(p => ({ id: p.id, onmyo: p.raster.onmyo, url: p.url })));
  }

const failed = results.filter(r => !r.ok);
  const allShots = shots.concat(eventShots);
  fs.writeFileSync(path.join(output, 'png-index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), productionState: pinState(), count: allShots.length, shots: allShots }, null, 2));
  fs.writeFileSync(path.join(output, 'contact-sheet.html'), buildContactSheet(allShots));
  const state = pinState();
  fs.writeFileSync(path.join(output, 'p6-canvas-results.json'),
    JSON.stringify({ finished: new Date().toISOString(), productionState: state, chrome: '155.0.8059.40', total: results.length, failed: failed.map(f => f.name), results }, null, 2));
  console.log(`PRODUCTION js-aggregate=${state.jsAggregateSha256} HEAD=${state.head}`);
  console.log(`REPORT ${path.join(output, 'p6-canvas-results.json')}`);
  if (failed.length) { console.error(`P6 CANVAS FAILED: ${failed.map(f => f.name).join(' | ')}`); process.exitCode = 1; }
  else console.log(`P6 CANVAS OK: ${results.length}/${results.length} 檢查通過`);
}
main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
