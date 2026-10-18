// tests/spacebunny-m1-p0.test.cjs
// M1-P0-UI（Space Bunny，唯一 js/ui.js writer 的配套驗證）
//
// 範圍：只驗 js/ui.js 本輪五項 P0 的**呈現層契約**——
//   ① 修行進階三卡：名稱/假名/類型標籤不重疊、卡片緊湊、玩家文案（去內部術語）、文字≥14CSS、熱區≥44CSS、手機重抽不壓卡
//   ② UI.endScreenButtons(state)：won 只有 id=world；lost 三顆主按鈕；drawEndScreen 與命中同源（只畫可見集合）
//   ③ summary.elapsedSeconds → 本局 MM:SS（不截 600、不用 summary.time）
// 層級：真 headless Chrome＋真 canvas measureText＋真截圖；但用**受控短 fixture**（非完整遊戲局、非自然實玩）。
// 發布前置：本檔另記錄 working 與 HEAD 的 loaded hashes；js/assets.js、js/renderer.js、js/words.js、js/boss-ai.js
//   為歷史未核准 dirty，本檔以 git show HEAD:唯讀記憶體＋CDP Fetch fulfill 提供（不 checkout、不覆寫磁碟）。
// 音訊：不讀、不載入、不測；所有 Node 皆 --require ./tools/director-audio-freeze.cjs。
// 執行：node --require ./tools/director-audio-freeze.cjs --test tests/spacebunny-m1-p0.test.cjs

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_ROOT = path.join(ROOT, 'artifacts', 'validation', 'spacebunny-m1-p0-ui-20261018');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GUARD = path.join(ROOT, 'tools', 'director-audio-freeze.cjs');
const HEAD_OVERLAY = ['js/assets.js', 'js/renderer.js', 'js/words.js', 'js/boss-ai.js']; // 歷史 dirty：改用 HEAD 版本服務
const VIEWPORTS = [{ name: 'desktop-1000x700', w: 1000, h: 700 }, { name: 'phone-844x390', w: 844, h: 390 }, { name: 'tablet-1024x640', w: 1024, h: 640 }];
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function headBlob(rel) {
  const buf = execFileSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return buf.toString('utf8');
}
function loadedHashes() {
  const out = { ui_working: null, game_working: null, head_overlay: {} };
  out.ui_working = sha256(fs.readFileSync(path.join(ROOT, 'js', 'ui.js')));
  out.game_working = sha256(fs.readFileSync(path.join(ROOT, 'js', 'game.js')));
  for (const rel of HEAD_OVERLAY) {
    const working = sha256(fs.readFileSync(path.join(ROOT, rel)));
    const head = sha256(headBlob(rel));
    out.head_overlay[rel] = { served: 'HEAD', head_sha256: head, working_sha256: working, differs: head !== working };
  }
  return out;
}
function deadline(p, ms, what) {
  let t;
  return Promise.race([p.then(v => { clearTimeout(t); return v; }, e => { clearTimeout(t); throw e; }),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error('DEADLINE ' + ms + 'ms: ' + what)), ms); })]);
}

// ── fixture 頁：真 canvas + 真 ui.js + 受控卡片資料（不載入 game/store/音訊）──
function fixtureHtml(vp) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>P0 UI fixture</title>
<style>html,body{margin:0;background:#0b0d14;overflow:hidden}#c{display:block}</style></head>
<body><canvas id="c" width="1" height="1"></canvas>
<script>
window.__cap = [];
(function(){
  const proto = CanvasRenderingContext2D.prototype;
  const realFill = proto.fillText, realRect = proto.roundRect;
  proto.fillText = function(t,x,y,mw){
    const metrics = this.measureText(String(t));
    window.__cap.push({ text: String(t), x, y, font: this.font, width: metrics.width,
      ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent, align: this.textAlign });
    return realFill.apply(this, arguments);
  };
  proto.roundRect = function(){
    if(window.__halfCard && window.UI){
      const card=UI.levelUpLayout(3).card;
      if(Math.abs(arguments[2]-(card.w-6))<0.01 && Math.abs(arguments[3]-(card.h-6))<0.01) arguments[3]/=2;
    }
    window.__cap.push({ rect: true, x: arguments[0], y: arguments[1], w: arguments[2], h: arguments[3] });
    return realRect.apply(this, arguments);
  };
})();
window.__ready = false;
</script>
<script src="/js/viewport.js"></script>
<script src="/js/ui.js"></script>
<script>
(function(){
  var cv = document.getElementById('c');
  var ctx = cv.getContext('2d');
  var DPR = 1;
  // 直接使用真 js/viewport.js（get/bounds 原樣），不造假 VIEWPORT：
  // 844x390 → calculate → scale .65、logical 1298.46x600、offsetX 199.23。
  var v = window.VIEWPORT.get();
  // canvas backing = CSS viewport × DPR（logical 只供佈局與 transform）；否則畫面會被 backing 寬度裁掉。
  cv.width = Math.round(window.innerWidth * DPR);
  cv.height = Math.round(window.innerHeight * DPR);
  cv.style.width = window.innerWidth + 'px';
  cv.style.height = window.innerHeight + 'px';
  // 與 game 真 UI 同一個 transform，logical→CSS 對齊
  function applyTransform(){
    var s = window.VIEWPORT.get();
    ctx.setTransform(DPR*s.scale, 0, 0, DPR*s.scale, DPR*s.scale*s.offsetX, DPR*s.scale*s.offsetY);
  }
  window.CONTENT = { getStage: function(id){ return { id: id || 'night-town', name: '夜行町', goalDeliveries: 6, bossTimes: [180,360,480,540] }; } };
  window.ART = {};
  window.HAPTICS = { enabled: false };
  window.__fixture = {
    // 真實可選卡，文案逐字取自 js/game.js（CHARM_CONFIG 520-541 / DUO_CONFIG 684-711）
    choices: [
      { id:'charm_cadence', type:'charm', n:'疾奏守', s:'しっそう', levelText:'◆ 御守加持',
        d:'妖刀、靈陣、靈針攻擊冷卻小幅縮短（有效頻率 +0.25）；保留每招冷卻下限與 Lv5 固有節奏，不加速雷雲、火龍或時鐘',
        requirementText:'御守槽位未滿（最多 3 種）', limitText:'每局最多佩戴 3 款不同御守（不可重複取得）' },
      { id:'charm_reach', type:'charm', n:'遠霞守', s:'とおがすみ', levelText:'◆ 御守加持',
        d:'妖刀、靈陣、靈針射程與符咒爆炸半徑 +10%；飛行物同步射程快照，保留 Lv5 上限與安全區判定',
        requirementText:'御守槽位未滿（最多 3 種）', limitText:'每局最多佩戴 3 款不同御守（不可重複取得）' },
      { id:'duo_inkfire', type:'duo', n:'墨焰斬', s:'ぼくえんざん', levelText:'◆ 共鳴奧義',
        d:'妖刀命中灼燒目標時留下墨焰痕（延遲 0.12 秒、半徑 56）；至多命中 3 敵各一次，總傷害為該次非暴擊刀傷 20% 分攤（無再派生）',
        requirementText:'持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+',
        limitText:'每局限選一次（不占主動、御守、變異槽位；每次攻擊有觸發上限、無再派生）',
        skillIds:['katana','fire'] }
    ],
    WL: { katana: 3, fire: 1, barrier: 3, thunder: 3, needle: 3, boom: 3 },
    WI: { katana:{zh:'退魔妖刀'}, fire:{zh:'狐火炎'}, barrier:{zh:'淨化靈陣'}, thunder:{zh:'天狐雷'}, needle:{zh:'天狐靈針'}, boom:{zh:'陰陽符'} }
  };
  window.__drawLevelUp = function(){
    applyTransform();
    ctx.clearRect(0,0,window.VIEWPORT.get().width,window.VIEWPORT.get().height);
    UI.drawLevelUp(ctx, 3, window.__fixture.choices, window.__fixture.WL, window.__fixture.WI, 2, 1.0, 0, 'keyboard', null);
    return { layout: UI.levelUpLayout(3), scale: window.VIEWPORT.get().scale, viewport: window.VIEWPORT.get() };
  };
  window.__drawEnd = function(state, summary){
    applyTransform();
    ctx.clearRect(0,0,window.VIEWPORT.get().width,window.VIEWPORT.get().height);
    UI.drawEndScreen(ctx, state, 12345, 6, 2, [{jp:'ねこ',zh:'貓'},{jp:'いぬ',zh:'犬'}], 0, summary || {});
    return UI.endScreenButtons(state);
  };
  window.__drawSet = function(list){
    window.__cap.length = 0;
    applyTransform();
    ctx.clearRect(0,0,cv.width,cv.height);
    UI.drawLevelUp(ctx, 3, list, window.__fixture.WL, window.__fixture.WI, 2, 1.0, 0, 'keyboard', null);
    return { layout: UI.levelUpLayout(list.length), texts: window.__cap.filter(function(c){return c.text;}).map(function(c){return c.text;}) };
  };
  window.__canvasInfo = function(){
    var r = cv.getBoundingClientRect();
    var vv = window.VIEWPORT.get();
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, inner: { w: window.innerWidth, h: window.innerHeight },
             backing: { w: cv.width, h: cv.height }, viewport: vv };
  };
  window.__ready = !!window.UI;
})();
</script></body></html>`;
}

// ── 精簡 CDP harness：preview＋Chrome＋Fetch fulfill 覆寫指定 URL（記憶體來源）──
async function withPage(dir, viewports, fn) {
  const port = 9800 + Math.floor(Math.random() * 150);
  const cdpPort = port + 100;
  const overlay = new Map(); // url-substring -> content
  const preview = spawn(process.execPath, ['--require', GUARD, path.join(ROOT, 'tools', 'director-preview.cjs'), '--port=' + port], { stdio: ['ignore', 'pipe', 'pipe'] });
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--window-size=' + viewports[0].w + ',' + viewports[0].h,
    '--user-data-dir=' + path.join(dir, 'profile'), '--remote-debugging-port=' + cdpPort, 'about:blank'], { stdio: 'ignore' });
  const state = { ws: null, timer: null, closed: false, pageErrors: [], audioLeak: [], netFails: [], consoleLines: [], served: [] };
  try {
    await deadline(new Promise(res => preview.stdout.on('data', b => { if (String(b).includes('SILENT_REVIEW')) res(1); })), 8000, 'preview');
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      try {
        const list = await deadline(new Promise((res, rej) => http.get('http://127.0.0.1:' + cdpPort + '/json/list', r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(s)); }).on('error', rej)), 1500, '/json/list');
        target = JSON.parse(list).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch (e) { /* retry */ }
      if (!target) await sleep(150);
    }
    if (!target) throw new Error('no cdp page target');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    state.ws = ws;
    await deadline(new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws open')); }), 5000, 'ws open');
    let seq = 0; const pending = new Map(); const events = [];
    const failAll = err => { for (const p of pending.values()) p.rej(err); pending.clear(); };
    ws.onclose = () => { state.closed = true; failAll(new Error('ws closed')); };
    ws.onerror = () => { state.closed = true; failAll(new Error('ws error')); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error('CDP ' + p.m)) : p.res(m.result); }
      else events.push(m);
    };
    const send = (method, params = {}, ms = 15000) => {
      if (state.closed || !ws || ws.readyState > 1) return Promise.reject(new Error('WS_CLOSED: ' + method));
      return deadline(new Promise((res, rej) => {
        const id = ++seq; pending.set(id, { res, rej, m: method });
        try { ws.send(JSON.stringify({ id, method, params })); } catch (e) { pending.delete(id); rej(e); }
      }), ms, 'CDP ' + method);
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    state.timer = setInterval(() => {
      for (const m of events.splice(0)) {
        if (m.method === 'Fetch.requestPaused') {
          const url = m.params.request.url, rid = m.params.requestId;
          let hit = null;
          for (const [k, v] of overlay) if (url.includes(k)) { hit = [k, v]; break; }
          if (hit) {
            state.served.push({ match: hit[0], url, sha256: sha256(hit[1]) });
            send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: hit[0].endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }], body: Buffer.from(hit[1], 'utf8').toString('base64') }, 10000)
              .catch(() => send('Fetch.continueRequest', { requestId: rid }, 5000).catch(() => {}));
          } else {
            send('Fetch.continueRequest', { requestId: rid }, 10000).catch(() => {});
          }
        } else if (m.method === 'Runtime.exceptionThrown') state.pageErrors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
        else if (m.method === 'Log.entryAdded') { const e = m.params.entry || {}; state.consoleLines.push(e.level + ':' + String(e.text).slice(0, 140)); if (e.level === 'error') state.netFails.push('log-error:' + String(e.text).slice(0, 80)); }
        else if (m.method === 'Network.responseReceived') {
          const r = m.params.response;
          if (r.status === 200 && (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(r.url) || /\/assets\/audio\//i.test(r.url))) state.audioLeak.push(r.url);
          if (r.status >= 400) state.netFails.push(r.status + ' ' + r.url);
        }
      }
    }, 20);
    const evalJs = async (expr, ms = 10000) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, ms);
      if (r.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 240));
      return r.result && r.result.value;
    };
    const shot = async name => {
      const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 20000);
      if (r && r.data) fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(r.data, 'base64'));
    };
    return await fn({ send, evalJs, shot, state, dir, overlay, port });
  } finally {
    if (state.timer) clearInterval(state.timer);
    try { if (state.ws && !state.closed) state.ws.close(); } catch (e) {}
    try { preview.kill(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    await sleep(200);
  }
}
function newRunDir(tag) {
  const dir = path.join(RUN_ROOT, tag + '-' + crypto.randomBytes(3).toString('hex'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function saveSummary(dir, data) {
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(Object.assign({
    ticket: 'M1-P0-UI', layer: 'REAL_CHROME_CONTROLLED_FIXTURE', fullRun: false, naturalRun: false, device: 'WAITING_DEVICE',
    loadedHashes: loadedHashes(), writtenAt: new Date().toISOString()
  }, data), null, 2));
}

// ── ① 三視口：修行進階卡（重疊／緊湊／文案／字級／熱區／重抽不壓卡）──
test('P0-1 三視口修行進階：名/假名/類型不重疊、卡≥44CSS、文字≥14CSS、重抽不壓卡、玩家文案', { timeout: 120000 }, async () => {
  assert.ok(fs.existsSync(CHROME), 'chrome not found');
  const dir = newRunDir('levelup');
  const report = { viewports: [] };
  await withPage(dir, VIEWPORTS, async ({ send, evalJs, shot, state, overlay, port }) => {
    overlay.set('/js/viewport.js', fs.readFileSync(path.join(ROOT, 'js', 'viewport.js'), 'utf8'));
    overlay.set('/js/ui.js', fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8'));
    for (const vp of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
      overlay.set('/__fixture', fixtureHtml(vp));
      await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/__fixture' }, 15000);
      const ready = await (async () => {
        for (let i = 0; i < 40; i++) { if (await evalJs('window.__ready === true')) return true; await sleep(100); }
        return false;
      })();
      assert.equal(ready, true, vp.name + '：ui.js 應在真頁載入（__ready）');
      const drawn = JSON.parse(await evalJs('JSON.stringify((function(){ window.__cap.length = 0; var r = window.__drawLevelUp(); return { cap: window.__cap.slice(), layout: r.layout, scale: r.scale }; })())'));
      await shot('levelup-' + vp.name);
      const scale = drawn.scale;
      const texts = drawn.cap.filter(c => c.text);
      const L = drawn.layout;
      // 熱區：卡片與重抽鈕都不得小於 44 CSS px，且重抽不得壓到卡片
      const cardCssH = L.card.h * scale, rerollCssH = L.reroll.h * scale, rerollCssW = L.reroll.w * scale;
      const blockBottom = L.card.y + L.card.h * 3 + L.card.gap * 2;
      // 文字：所有繪製文字的 CSS 高度不得低於 14px
      // 字級必量「真 CSS 像素」：canvas 字級是 logical，CSS = logical × scale（不再只信 metadata）
      const pxOf = f => { const m = /(\d+(?:\.\d+)?)px/.exec(f || ''); return m ? Number(m[1]) : 0; };
      const smallestText = texts.length ? Math.min(...texts.map(t => pxOf(t.font))) * scale : 99;
      const smallestTextCss = Math.round(smallestText * 10) / 10;
      // 重疊：同一標題列中，名稱/假名的量測框不得交錯到類型標籤區
      const typeLabel = texts.find(t => /^(主動|被動|御守|變異|共鳴)/.test(t.text));
      const nameT = texts.find(t => ['疾奏守', '遠霞守', '墨焰斬'].includes(t.text));
      const kanaT = texts.find(t => ['しっそう', 'とおがすみ', 'ぼくえんざん'].includes(t.text));
      const overlap = (() => {
        if (!typeLabel || !nameT || !kanaT) return { checked: false };
        const typeLeft = typeLabel.x - typeLabel.width;
        const nameRight = nameT.x + nameT.width;
        const kanaRight = kanaT.x + kanaT.width;
        return { checked: true, nameOverlapsType: nameRight > typeLeft, kanaOverlapsType: kanaRight > typeLeft, kanaOverlapsName: kanaT.x < nameRight };
      })();
      const jargon = texts.filter(t => /派生|預算|有效頻率|射程快照|集中參數|\bcast\b/i.test(t.text)).map(t => t.text);
      // 真實數值必須仍在畫面上（精簡不等於虛構或遮字）
      const allText = texts.map(t => t.text).join('｜');
      const numsKept = { '20%': allText.includes('20%'), '3 敵': allText.includes('3 敵'), 'Lv3': allText.includes('Lv3'), '御守 3 款或未滿 3 款': /未滿 3 款|3 款/.test(allText) };
      // 卡身文字不得超出卡底（不得以縮字級或截字造綠）。只量「卡內」文字：
      // 排除標題列／已習得列（在第一張卡上方）與重抽鈕（在最後一張卡下方）。
      const inCardX = t => t.x >= L.card.x - 2 && t.x <= L.card.x + L.card.w + 2;
      const bands = [];
      for (let i = 0; i < 3; i++) { const y0 = L.card.y + i * (L.card.h + L.card.gap); bands.push([y0, y0 + L.card.h]); }
      const inAnyBand = y => bands.some(seg => y >= seg[0] - 4 && y <= seg[1] + 4);
      const cand = texts.filter(t => inCardX(t) && t.y > L.summaryBar.y + L.summaryBar.h && t.y < L.reroll.y);
      const spilled = cand.filter(t => !inAnyBand(t.y)).map(t => t.text);
      const lowestCardBottom = bands[2][1];
      report.viewports.push({ vp: vp.name, scale, cardCssH, rerollCssH, rerollCssW, blockBottom, rerollTop: L.reroll.y, smallestText, overlap, jargonCount: jargon.length, jargonSamples: jargon.slice(0, 2), numsKept, spilledCount: spilled.length, spilledSamples: spilled.slice(0, 3), lowestCardBottom: Math.round(lowestCardBottom), textsDrawn: texts.length });
      assert.ok(cardCssH >= 44, vp.name + '：卡片熱區高須 ≥44CSS，實得 ' + cardCssH.toFixed(1));
      assert.ok(rerollCssH >= 44 && rerollCssW >= 44, vp.name + '：重抽熱區須 ≥44CSS，實得 ' + rerollCssW.toFixed(1) + 'x' + rerollCssH.toFixed(1));
      assert.ok(blockBottom <= L.reroll.y, vp.name + '：重抽不得壓卡（cards bottom ' + blockBottom + ' vs reroll y ' + L.reroll.y + '）');
      assert.ok(smallestText >= 14, vp.name + '：必要文字真實 CSS 須 ≥14px，實得 ' + smallestTextCss + 'CSS（logical×scale）');
      assert.equal(overlap.checked ? overlap.nameOverlapsType : false, false, vp.name + '：名稱不得壓類型標籤');
      assert.equal(overlap.checked ? overlap.kanaOverlapsType : false, false, vp.name + '：假名不得壓類型標籤');
      assert.equal(overlap.checked ? overlap.kanaOverlapsName : false, false, vp.name + '：假名不得壓名稱');
      assert.equal(jargon.length, 0, vp.name + '：不得顯示內部術語' + JSON.stringify(jargon.slice(0, 2)));
      // 語義守門：卡的去重（「不可重複取得」）不得再被簡化成「每局限一次」而誤導成效果只觸發一次
      const misread = texts.filter(t => /每局\s*1\s*次|每局限選一次/.test(t.text)).map(t => t.text);
      assert.equal(misread.length, 0, vp.name + '：不得用「每局1次/每局限選一次」描述卡去重（會被讀成效果只觸發一次）' + JSON.stringify(misread.slice(0, 2)));
      const inkfireLimit = texts.filter(t => /限制：/.test(t.text)).map(t => t.text).join('｜');
      assert.ok(/不可重複取得/.test(inkfireLimit), vp.name + '：Duo 限制行應寫「不可重複取得」，實得 ' + inkfireLimit);
      assert.ok(numsKept['20%'] && numsKept['3 敵'] && numsKept['Lv3'], vp.name + '：精簡後真實數值仍須在畫面上 ' + JSON.stringify(numsKept));
      // 畫布覆蓋：backing 與 CSS 尺寸必須等於 CSS viewport，否則右側會被裁（測試假裁切）
      const ci = JSON.parse(await evalJs('JSON.stringify(window.__canvasInfo())'));
      assert.ok(Math.abs(ci.rect.w - ci.inner.w) <= 1 && Math.abs(ci.rect.h - ci.inner.h) <= 1, vp.name + '：canvas CSS 尺寸須覆蓋 viewport，實得 ' + JSON.stringify(ci));
      assert.ok(ci.backing.w === Math.round(ci.inner.w) && ci.backing.h === Math.round(ci.inner.h), vp.name + '：canvas backing 須為 CSS viewport×DPR，實得 ' + JSON.stringify(ci.backing));
      // 所有卡與重抽鈕的 CSS 邊界必須落在實際 canvas 內
      const s2 = ci.viewport.scale, offX = ci.viewport.offsetX, offY = ci.viewport.offsetY;
      const cssBox = r0 => ({ x: (r0.x + offX) * s2, y: (r0.y + offY) * s2, w: r0.w * s2, h: r0.h * s2 });
      const boxes = [cssBox(L.reroll)];
      for (let i = 0; i < 3; i++) boxes.push(cssBox({ x: L.card.x, y: L.card.y + i * (L.card.h + L.card.gap), w: L.card.w, h: L.card.h }));
      for (const b of boxes) {
        assert.ok(b.x >= -1 && b.y >= -1 && b.x + b.w <= ci.inner.w + 1 && b.y + b.h <= ci.inner.h + 1,
          vp.name + '：卡/重抽 CSS 邊界須在 canvas 內 ' + JSON.stringify({ box: b, canvas: ci.inner }));
      }
      assert.ok(spilled.length === 0, vp.name + '：卡內文字不得溢出卡底 ' + JSON.stringify(spilled.slice(0, 3)));
    }
    assert.deepEqual(state.audioLeak, [], '不得載入任何音訊');
    // 四 Duo ＋ 受影響卡：短文案語義與真數值（同一 fixture、同一 draw 路徑，不新 harness）
    // 文案與數值逐條對 game.js DUO_CONFIG（669-726）／CHARM_CONFIG（479-552）／UP（1310-1331）
    const BRIEF_FIX = [
      { c: { id:'duo_frostseal', type:'duo', n:'寒封符', s:'かんぷう', levelText:'◆ 共鳴奧義',
             d:'陰陽符主爆命中帶寒冷目標時給一次受限追擊（普通怪凍結結束後追擊×0.65持續0.35秒，Boss追擊×0.90持續0.15秒；每cast限1敵、2秒免疫）',
             requirementText:'持有天狐靈針 Lv3+ 與 陰陽符 Lv3+', limitText:'每局限選一次（不占主動、御守、變異槽位；每cast限1敵、2秒免疫）' },
        must:['陰陽符主爆命中','移速 −35%','0.35 秒','−10%','0.15 秒','天狐靈針 Lv3','不可重複取得'], ban:['0.65×','0.90×','追擊×','每cast','cast'] },
      { c: { id:'duo_cinderseal', type:'duo', n:'餘燼符', s:'じんぷう', levelText:'◆ 共鳴奧義',
             d:'陰陽符主爆命中灼燒目標時留下短效餘燼（延遲 0.3 秒、半徑 64、持續 0.8 秒）；至多命中 3 敵各一次，總傷害為該次非暴擊符傷 15% 分攤',
             requirementText:'持有狐火炎 Lv3+ 與 陰陽符 Lv3+', limitText:'每局限選一次（每次引爆限一處）' },
        must:['陰陽符主爆命中灼燒目標','追加一次餘燼','3 敵','15% 符傷','狐火炎 Lv3'], ban:['0.8 秒','持續 0.8'] },
      { c: { id:'duo_thundercircle', type:'duo', n:'雷紋陣', s:'らいもんじん', levelText:'◆ 共鳴奧義',
             d:'淨化靈陣內落雷引發墨紋衝擊（延遲 0.12 秒、半徑 64）；至多命中 3 敵各一次，總傷害為該次非暴擊雷基傷 20% 分攤',
             requirementText:'持有淨化靈陣 Lv3+ 與 天狐雷 Lv3+', limitText:'每局限選一次' },
        must:['追加墨紋衝擊','3 敵','20% 雷傷','淨化靈陣 Lv3','天狐雷 Lv3'], ban:['變墨紋衝擊','落雷變','金剛結界'] },
      { c: { id:'duo_inkfire', type:'duo', n:'墨焰斬', s:'ぼくえんざん', levelText:'◆ 共鳴奧義',
             d:'妖刀命中灼燒目標時留下墨焰痕（延遲 0.12 秒、半徑 56）；至多命中 3 敵各一次，總傷害為該次非暴擊刀傷 20% 分攤（無再派生）',
             requirementText:'持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+', limitText:'每局限選一次（每次攻擊有觸發上限）' },
        must:['退魔妖刀 Lv3','狐火炎 Lv3','每次攻擊','20% 刀傷','不可重複取得'], ban:['無再派生','派生'] },
      { c: { id:'charm_reach', type:'charm', n:'遠霞守', s:'とおがすみ', levelText:'◆ 御守加持',
             d:'妖刀、靈陣、靈針射程與符咒爆炸半徑 +10%；飛行物同步射程快照，保留 Lv5 上限與安全區判定',
             requirementText:'御守槽位未滿（最多 3 種）', limitText:'每局最多佩戴 3 款不同御守' },
        must:['妖刀','靈陣','靈針','符咒爆炸半徑','+10%'], ban:['射程快照','安全區判定'] },
      { c: { id:'charm_power', type:'charm', n:'力紋守', s:'ちから', levelText:'◆ 御守加持', d:'攻擊傷害加成 +0.20', requirementText:'御守槽位未滿（最多 3 種）', limitText:'每局最多佩戴 3 款不同御守' },
        must:['基礎傷害加成','+20%'], ban:['傷害 +20%'] },
      { c: { id:'dmg', type:'passive', n:'修羅破軍', s:'こうげき', levelText:'被動修行', d:'整體傷害係數 +0.30（最多 4 層）', limitText:'最多 4 層' },
        must:['基礎傷害加成','+30%'], ban:['傷害 +30%'] }
    ];
    const briefReport = [];
    const fillers = JSON.parse(await evalJs('JSON.stringify(window.__fixture.choices.slice(0,2))'));
    for (const fx of BRIEF_FIX) {
      const out = JSON.parse(await evalJs('JSON.stringify(window.__drawSet(' + JSON.stringify([fx.c].concat(fillers)) + '))'));
      const joined = out.texts.join('｜');
      briefReport.push({ id: fx.c.id, texts: out.texts });
      for (const m of fx.must) assert.ok(joined.indexOf(m) >= 0, fx.c.id + '：短文案必須包含「' + m + '」，實得 ' + joined);
      for (const b of fx.ban) assert.ok(joined.indexOf(b) < 0, fx.c.id + '：短文案不得出現「' + b + '」，實得 ' + joined);
    }
    report.briefFix = briefReport;
    report.served = state.served;
    report.pageErrors = state.pageErrors;
    report.console = state.consoleLines.slice(0, 10);
    saveSummary(dir, Object.assign({ case: 'P0-1-levelup' }, report));
  });
});

// ── ②③ 結算：won 唯一 world 鈕／lost 三鈕／MM:SS（真繪製＋文字擷取）──
test('P0-2 結算畫面：won 只畫 world 一鈕、lost 保留三鈕、本局 MM:SS 來自 elapsedSeconds', { timeout: 120000 }, async () => {
  const dir = newRunDir('endscreen');
  const report = {};
  await withPage(dir, [VIEWPORTS[0]], async ({ send, evalJs, shot, state, overlay, port }) => {
    overlay.set('/js/viewport.js', fs.readFileSync(path.join(ROOT, 'js', 'viewport.js'), 'utf8'));
    overlay.set('/js/ui.js', fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8'));
    overlay.set('/__fixture', fixtureHtml(VIEWPORTS[0]));
    await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/__fixture' }, 15000);
    for (let i = 0; i < 40; i++) { if (await evalJs('window.__ready === true')) break; await sleep(100); }
    assert.equal(await evalJs('window.__ready === true'), true, 'ui.js 應載入');
    // getter 契約
    const getter = JSON.parse(await evalJs("JSON.stringify({ won: UI.endScreenButtons('won'), lost: UI.endScreenButtons('lost'), wonPhase: UI.endScreenButtons('lampout') })"));
    report.getter = getter;
    assert.deepEqual(getter.won.map(b => b.id), ['world'], 'won 應只有 world 一顆');
    assert.deepEqual(getter.lost.map(b => b.id), ['restart', 'world', 'menu'], 'lost 應保留三顆主按鈕');
    assert.deepEqual(getter.wonPhase.map(b => b.id), ['restart', 'world', 'menu'], '非 won 應保留三顆');
    // 真繪製後擷取按鈕文字
    const won = JSON.parse(await evalJs("JSON.stringify((function(){ window.__cap.length=0; var btns = window.__drawEnd('won', { elapsedSeconds: 582, prevBest: 100, newBest: true, learning: { practiced: 5, review: 2, gained: 3, lost: 1 } }); return { btns: btns, cap: window.__cap.filter(function(c){return c.text;}).map(function(c){return c.text;}) }; })())"));
    await shot('end-won-1000x700');
    const lost = JSON.parse(await evalJs("JSON.stringify((function(){ window.__cap.length=0; window.__drawEnd('lost', { elapsedSeconds: 201 }); return window.__cap.filter(function(c){return c.text;}).map(function(c){return c.text;}); })())"));
    await shot('end-lost-1000x700');
    const has = (arr, s) => arr.some(t => t.indexOf(s) >= 0);
    report.wonTexts = won.cap; report.lostTexts = lost;
    assert.equal(has(won.cap, '回旅路地圖'), true, 'won 應畫出回旅路地圖');
    assert.equal(has(won.cap, '再踏夜行'), false, 'won 不得畫再踏夜行');
    assert.equal(has(won.cap, '回到首頁'), false, 'won 不得畫回到首頁');
    assert.equal(has(lost, '再踏夜行'), true, 'lost 應保留再踏夜行');
    assert.equal(has(lost, '回旅路地圖'), true, 'lost 應保留回旅路地圖');
    assert.equal(has(lost, '回到首頁'), true, 'lost 應保留回到首頁');
    assert.equal(has(won.cap, '09:42'), true, 'elapsedSeconds 582 應顯示 09:42，實得 ' + JSON.stringify(won.cap.filter(t => /\d\d:\d\d/.test(t))));
    assert.equal(has(won.cap, 'ねこ（貓）'), false, 'won 不得畫可點的 review 鈕');
    assert.equal(has(lost, 'ねこ（貓）'), true, 'lost 應保留 review 回聽鈕');
    // 結算按鈕 44CSS 與「畫的就是可命中集合」：桌機 + 手機兩種 scale 都要量
    const btnReport = [];
    for (const vp of [{ name: 'end-1000x700', w: 1000, h: 700 }, { name: 'end-844x390', w: 844, h: 390 }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
      overlay.set('/__fixture', fixtureHtml(vp));
      await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/__fixture' }, 15000);
      for (let i = 0; i < 40; i++) { if (await evalJs('window.__ready === true')) break; await sleep(100); }
      const r = JSON.parse(await evalJs("JSON.stringify((function(){ var s = window.VIEWPORT.get(); var out = {}; for (var st of ['won','lost']) { var bs = UI.endScreenButtons(st); out[st] = { rects: bs.map(function(b){ return { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, cssW: Math.round(b.w*s.scale), cssH: Math.round(b.h*s.scale) }; }), ids: bs.map(function(b){return b.id;}) }; } out.visible = { w: s.width, h: s.height, scale: s.scale }; return out; })())"));
      btnReport.push({ vp: vp.name, ...r });
      for (const st of ['won', 'lost']) {
        for (const b of r[st].rects) {
          assert.ok(b.cssH >= 44, vp.name + '/' + st + '/' + b.id + '：按鈕高須 ≥44CSS，實得 ' + b.cssH);
          assert.ok(b.cssW >= 44, vp.name + '/' + st + '/' + b.id + '：按鈕寬須 ≥44CSS，實得 ' + b.cssW);
          assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= r.visible.w && b.y + b.h <= r.visible.h, vp.name + '/' + st + '/' + b.id + '：按鈕必須在可見範圍內 rect=' + JSON.stringify(b) + ' visible=' + JSON.stringify(r.visible));
        }
      }
      assert.deepEqual(r.won.ids, ['world'], vp.name + '：won 仍只允許 world');
      assert.deepEqual(r.lost.ids, ['restart', 'world', 'menu'], vp.name + '：lost 仍三顆');
    }
    report.buttons = btnReport;
    assert.deepEqual(state.audioLeak, [], '不得載入任何音訊');
    report.served = state.served; report.pageErrors = state.pageErrors; report.console = state.consoleLines.slice(0, 8);
    saveSummary(dir, Object.assign({ case: 'P0-2-endscreen' }, report));
  });
});


// 真實回報畫面：Lv4、覺醒印1，三卡與真 Canvas 墨跡度量；不以 baseline 當字底。
test('P0-3 八視口三卡實例：墨底餘裕≥6CSS、真字框與半高卡負向', { timeout: 120000 }, async () => {
  const views = [[1920,1080],[1366,768],[1280,720],[1000,700],[1024,640],[844,390],[390,844],[1024,636]]
    .map(([w,h])=>({name:w+'x'+h,w,h}));
  const cards = [
    {id:'rate',type:'passive',n:'神樂疾奏',s:'れんぞく',levelText:'Lv1',d:'妖刀、結界、靈針冷卻縮短'},
    {id:'charm_step',type:'charm',n:'風步守',s:'かぜあし',levelText:'◆ 御守加持',d:'移動速度 +28'},
    {id:'mut_crosscut',type:'mutation',n:'妖刀・十字交斬',s:'ようとう・こうざん',levelText:'◆ 妖刀變異',d:'主斬後延遲施展一次有限側向交叉斬；共用攻擊預算與傷害上界，Lv5 風刃不重複派生',requirementText:'持有退魔妖刀',limitText:'每種限選一次（每技能最多 3 種變異）',skillIds:['katana']}
  ];
  const dir = newRunDir('eight-ink');
  const report={viewports:[]};
  function measure(d){
    const L=d.layout,s=d.scale,errors=[],rows=[];
    const texts=d.cap.filter(t=>t.text);
    const allFonts=texts.map(t=>Number(/([\d.]+)px/.exec(t.font)[1])*s);
    if(Math.min(...allFonts)<14-1e-6)errors.push('necessary-font:'+JSON.stringify(texts.filter((t,i)=>allFonts[i]<14-1e-6)));
    const painted=d.cap.filter(r=>r.rect && Math.abs(r.w-(L.card.w-6))<.01);
    for(let i=0;i<3;i++){
      const y=L.card.y+i*(L.card.h+L.card.gap);
      const rect=painted.find(r=>Math.abs(r.y-(y+3))<.01);
      if(!rect){errors.push('missing-card-'+i);continue;}
      if(Math.abs(rect.h-(L.card.h-6))>.01)errors.push('paint/hit-height-'+i);
      // 依真 draw 順序歸屬卡片，不按 y 過濾掉已經溢出的文字而假綠。
      const first=d.cap.indexOf(rect)+1;
      const last=i<2?d.cap.indexOf(painted.find(r=>Math.abs(r.y-(L.card.y+(i+1)*(L.card.h+L.card.gap)+3))<.01)):d.cap.length;
      const inCard=d.cap.slice(first,last).filter(t=>t.text && !/^(↑↓|十字鍵|點選技能|重抽)/.test(t.text));
      assert.ok(inCard.length>=5,'卡片須包含名稱、假名及完整效果／限制，不能以零文字造綠');
      const compact=inCard.map(t=>t.text).join('').replace(/\s/g,'');
      const required=[['妖刀、結界、靈針冷卻縮短','最多4層'],['移動速度+28','御守未滿3款'],['主斬後追加一次交叉斬（60%刀傷）；Lv5風刃不追加','持有退魔妖刀','每技能最多3種變異']][i];
      for(const text of required)if(!compact.includes(text))errors.push('missing-copy-'+i+':'+text);
      const inkBottom=Math.max(...inCard.map(t=>t.y+t.descent));
      const gap=(rect.y+rect.h-(i===0?1.4:.575)-inkBottom)*s;
      const minFont=Math.min(...inCard.map(t=>Number(/([\d.]+)px/.exec(t.font)[1])*s));
      if(gap<6-1e-6)errors.push('ink-bottom-'+i+':'+gap);
      if(minFont<14-1e-6)errors.push('font-'+i+':'+minFont);
      if(L.card.h*s<44)errors.push('card-hit-'+i);
      rows.push({id:cards[i].id,gapCss:gap,minFontCss:minFont,texts:inCard.map(t=>t.text)});
    }
    if(L.card.y+3*L.card.h+2*L.card.gap>L.reroll.y)errors.push('reroll-overlap');
    if(Math.min(L.reroll.w,L.reroll.h)*s<44)errors.push('reroll-hit');
    return {errors,rows,scale:s,cardHeightCss:L.card.h*s,minGapCss:Math.min(...rows.map(r=>r.gapCss))};
  }
  await withPage(dir,views,async({send,evalJs,shot,state,overlay,port})=>{
    overlay.set('/js/viewport.js',fs.readFileSync(path.join(ROOT,'js/viewport.js'),'utf8'));
    overlay.set('/js/ui.js',fs.readFileSync(path.join(ROOT,'js/ui.js'),'utf8'));
    for(const vp of views){
      await send('Emulation.setDeviceMetricsOverride',{width:vp.w,height:vp.h,deviceScaleFactor:1,mobile:false});
      // 與使用者同一等級／印記；其餘 harness、Canvas transform 與 production 相同。
      overlay.set('/__fixture',fixtureHtml(vp).replace('UI.drawLevelUp(ctx, 3,','UI.drawLevelUp(ctx, 4,').replace(", 2, 1.0, 0, 'keyboard', null)",", 2, 1.0, 0, 'keyboard', {seals:1})"));
      await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__fixture'});
      let ready=false;for(let n=0;n<40;n++){if(await evalJs('window.__ready===true')){ready=true;break;}await sleep(100);}
      assert.equal(ready,true,vp.name+' ready');
      const draw=async half=>JSON.parse(await evalJs(`JSON.stringify((()=>{window.__halfCard=${half};window.__fixture.choices=${JSON.stringify(cards)};window.__cap=[];const r=__drawLevelUp();return {...r,cap:__cap};})())`));
      const positive=measure(await draw(false));
      await shot('ink-'+vp.name);
      // 真繪製 outer card 高度砍半：同一量測 oracle 必須拒絕，不改 cap 數據或 oracle。
      const negative=measure(await draw(true));
      report.viewports.push({viewport:vp.name,...positive,negativeErrors:negative.errors});
      console.log('UI_INK_METRIC',JSON.stringify(report.viewports.at(-1)));
      assert.deepEqual(positive.errors,[],vp.name+' 正式版墨跡／熱區');
      assert.ok(negative.errors.length>0,vp.name+' 半高卡必須 RED');
    }
    assert.deepEqual(state.pageErrors,[],'Chrome 無例外');
    assert.deepEqual(state.audioLeak,[],'未載入音訊');
    report.console=state.consoleLines;
  });
  saveSummary(dir,report);
});
