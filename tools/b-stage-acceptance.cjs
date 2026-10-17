// B 階段端到端驗收（Chrome 真 Canvas）。只新增，不修改任何 production。
//
// 做法與 P6 相同：驗收伺服器在回應內容上動態注入，磁碟檔案不動
//   * /js/game.js  → 原始碼 + fixture 掛鉤（附加在 IIFE 結尾前）
//   * /index.html  → 插入 <script src="/__b__/rig.js">（在遊戲腳本之前）
// 正式遊戲不需要、也沒有任何 debug 介面。
//
// 規則：任何 JS 例外或任何檢查失敗 → 退出碼非 0。
// 用法：node tools/b-stage-acceptance.cjs            （baseline：目前可玩的關卡）
//       node tools/b-stage-acceptance.cjs --selftest （負向校準：注入真例外必須非 0）
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const FIXTURE = require('./hd25d-fixture-hook.cjs');

// B 階段專屬 fixture：附加在 IIFE 內，可直接用到正式函式與狀態變數。
// 與 P 共用的 hd25d-fixture-hook.cjs 完全分離，不影響 P 成果。
const BF_HOOK = `
window.__BF = { ready: false, error: null };
try {
const B = window.__BF;
function snapshotLite(){ return { delivered, score, oil, xp, state, elapsed,
  job: job ? { word: job.word && job.word.jp } : null,
  bossQ: bossQ ? { lock: bossQ.lock, tries: bossQ.tries } : null,
  boss: (()=>{const bs=enemies.find(e=>e.type==='boss');return bs?{shield:bs.shield===true,hp:bs.hp}:null;})() }; }
B.snapshotLite = () => snapshotLite();
B.stage = id => start(id);
B.freeze = () => { spawnT = Infinity; surgeT = Infinity; };
B.openOrder = () => { makeOrder(); inter = orders[0]; if (!inter) return { err: 'no order' }; interact(); job.lock = 0; return job ? { ok: true } : { err: 'no job' }; };
B.goToAnswer = () => { if (!job) return false; const p = ansPos(job.to)[job.ans.indexOf(job.word)]; P.x = p.x; P.y = p.y; return true; };
B.pick = i => { B.goToAnswer(); resolve(i); return snapshotLite(); };
B.choicesFor = w => answerChoices(w).map(x => ({ jp: x.jp, zh: x.zh }));
B.jobInfo = () => job ? { word: job.word && job.word.jp, zh: job.word && job.word.zh, ans: job.ans.map(w => w.jp), to: job.to && job.to.id } : null;
B.bossState = () => { const bs = enemies.find(e => e.type === 'boss'); if (!bs) return null;
  return { shield: bs.shield === true, word: bs.word && bs.word.jp, hp: bs.hp, lock: bossQ ? bossQ.lock : null, tries: bossQ ? bossQ.tries : null, ans: bossQ ? bossQ.ans.map(w => w.jp) : null }; };
B.spawnBoss = (word) => { const bs = { id: 900, x: P.x + 170, y: P.y, type: 'boss', word: word || ALL[0], hp: 9999, max: 9999, shield: true, speed: 0, wob: 0, flash: 0 }; enemies.push(bs); bossQ = mkQ(bs); bossQ.lock = 0; return true; };
B.answerBoss = i => { if (!bossQ) return snapshotLite(); B.goToAnswer(); answerBoss(i); return snapshotLite(); };
B.waitBossLock = (maxSteps) => { let n = 0; while (bossQ && bossQ.lock > 0 && n < (maxSteps||120)) { update(0.05); n++; } return { lock: bossQ ? bossQ.lock : null, steps: n }; };
B.setGoal = () => { delivered = GOAL_DELIVERIES; };
// 真實配送一輪：走正式 makeOrder → interact → 到答案位 → resolve(正解 indexOf)
B.realDeliver = () => {
  makeOrder(); inter = orders[0]; if (!inter) return { err: 'no order' };
  interact(); if (!job) return { err: 'no job' };
  const ci = job.ans.indexOf(job.word);
  const p = ansPos(job.to)[ci]; P.x = p.x; P.y = p.y;
  resolve(ci);
  return { delivered, score, ci };
};
B.deliveredCount = () => delivered;
// 真實升級流程：配送會觸發 levelup（暫停時鐘），走正式 offerUp + 選擇套用
B.resolveLevelups = (max) => {
  let g = 0, picked = 0;
  while (state === 'levelup' && g++ < (max || 60)) {
    offerUp();
    // pickUp() 受 levelupCooldown 保護，必須先用正式 update 燒掉冷卻
    // levelupCooldown 只在 frame() 裡衰減（game.js levelup 分支），必須以真 frame 迭代。
    if (levelupCooldown > 0) {
      let k = 0;
      while (levelupCooldown > 0 && k++ < 40) { B.frames(1, 50); }
      if (levelupCooldown > 0) return { blocked:'cooldown', cooldown:levelupCooldown, steps:k };
    }
    const i = (choices || []).findIndex(c => c && typeof c.f === 'function');
    if (i < 0) break;
    pickUp(i);            // 正式確認函式：xp/level/state 都由它處理
    picked++;
  }
  return { state, picked, iterations: g };
};
// 真實擊殺終王：對真的 boss 物件呼叫 hurt
B.spawnFinalBossAt = (idx) => { const bs = { id: 950 + idx, x: P.x + 160, y: P.y, type: 'boss', final: true, word: ALL[idx % ALL.length], hp: 99999, max: 99999, shield: false, speed: 0, wob: 0, flash: 0 }; enemies.push(bs); return bs.hp; };
B.defeatFinalBoss = (idx) => {
  let bs = enemies.find(e => e.type === 'boss' && e.final);
  if (!bs) { B.spawnFinalBossAt(idx || 0); bs = enemies.find(e => e.type === 'boss' && e.final); }
  if (!bs) return { err: 'no boss' };
  hurt(bs, bs.hp + 10);
  return { hp: bs.hp, defeated: finalBossDefeated };
};
// 以真實 update 推進遊戲時鐘；不做任何邏輯鏡像
// 以真實 RAF 入口 frame(now) 推進（update() 直接呼叫不會走 levelup 分支）
B.stepChunk = (count, dt) => { const s = dt || 0.05; for (let k = 0; k < count; k++) B.manualFrame(s * 1000); return { elapsed, state, delivered, finalBossDefeated }; };
// 連續時間軸：只讀取 IIFE 的 last，不寫回；之後每次以 last + dt*1000 前進。
// 重新用 Date.now() 會讓 now < 已推進的 last，dt 被 clamp 成 0（先前 elapsed 不動的真因）。
B.timeline = (() => { return (dt) => B.manualFrame((dt || 0.05) * 1000); })();
B.timelineRun = (seconds, dt) => { const s = dt || 0.05; const n = Math.ceil(seconds / s); for (let k = 0; k < n; k++) B.manualFrame(s * 1000); return { elapsed, state, delivered, finalBossDefeated }; };
// 連續真 frame：每次讀取 live 的 last（frame 會自己把 last 推前），不斷鏈、不走舊 timeline 閉包。
B.frames = (n, dtms) => { const s = dtms || 50; for (let k = 0; k < n; k++) B.manualFrame(s); return { elapsed, state, delivered, finalBossDefeated }; };
// 分層受控推進：play 期間用真 update 批次（不重繪）；遇 levelup 切真 frame 清冷卻後 pickUp。
// 接近 DAWN 與最終過關轉換才用真 frame，讓正式 state / STORE.finish 發生。
// 註：這是受控時鐘推進，不是自然 10 分鐘遊玩。
B.advance = (seconds, dt) => {
  const s = dt || 0.05; let n = 0, lv = 0, guard = 0;
  const max = Math.ceil(seconds / s) + 10;
  while (n < seconds && guard++ < max) {
    update(s); n += s;
    if (state === 'levelup') { const r = B.resolveLevelups(); if (r && r.blocked) return { blocked: r.blocked, levelups: lv, elapsed }; lv++; }
  }
  return { elapsed, state, delivered, finalBossDefeated, levelups: lv, guard };
};
B.mapState = () => overworld;
// RAF 鏈隔離：game.js frame(now) 第一行會 requestAnimationFrame(frame)，
// 每手動呼叫一次就追加一條永久 RAF 鏈（實測逐關倍增）。manualFrame 在呼叫期間
// 把 window.requestAnimationFrame 暫替成空函式，finally 必還原；原生 autoRAF
// 單鏈照常運作供 UI 真導航，waitFrames 等真 RAF 不動。
// 只讀計數為直接證據：schedules 只隨真實時間成長，suppressions 等於手動幀數。
B.__rafSchedules = 0; B.__rafSuppressions = 0;
try {
  const _raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { B.__rafSchedules++; return _raf(cb); };
} catch (e) { B.__rafWrapError = String((e && e.message) || e); }
B.manualFrame = (dtms) => {
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => { B.__rafSuppressions++; return 0; };
  try { frame(last + (dtms || 50)); }
  finally { window.requestAnimationFrame = raf; }
  return { elapsed, state };
};
B.rafEvidence = () => ({ schedules: B.__rafSchedules, suppressions: B.__rafSuppressions, wrapError: B.__rafWrapError || null });
// OVERWORLD.selectedNode(state) 必須帶私有 state，直接在頁面呼叫 selectedNode() 會 throw。
B.selected = () => { const n = OVERWORLD.selectedNode(overworld); return n ? { id: n.id, stageId: n.stageId, type: n.type } : null; };
B.currentId = () => overworld.currentId;
B.isMoving = () => OVERWORLD.isMoving(overworld);
B.selectedStage = () => { const n = OVERWORLD.selectedNode(overworld); return n ? (n.stageId || null) : null; };
B.browseNext = () => OVERWORLD.browse(overworld, 1);   // 正式 UI 的選關 browse handler，不動 current/from/path
B.browsePrev = () => OVERWORLD.browse(overworld, -1);
B.winStateFull = () => ({ state, elapsed, delivered, goal: GOAL_DELIVERIES, finalBossDefeated, victorySeq: !!victorySeq, levelupCooldown, level, xp, choicesLen: (choices||[]).length });
// 竊聽真 STORE.finish：委派原函式，只記錄呼叫
B.spyFinish = () => {
  if (!B.__origFinish) {
    B.__origFinish = window.STORE.finish;
    B.__finishes = [];
    window.STORE.finish = function (...a) { B.__finishes.push(a.slice()); return B.__origFinish.apply(this, a); };
  }
  return (B.__finishes || []).length;
};
B.finishCalls = () => (B.__finishes || []).map(a => ({ stageId: a[0], score: a[1], delivered: a[2], won: a[3] }));
B.winState = () => ({ finalBossDefeated, delivered, goal: GOAL_DELIVERIES });B.ready = true;
} catch (e) { window.__BF.error = String((e && e.message) || e); }
`;

const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const output = path.join(root, 'artifacts', 'validation', 'b-stage');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };

// 記錄真正交給 start(stageId) 的關卡：不能用畫面推測。
const RIG = `
window.__B = { exceptions: [] };
window.addEventListener('error', e => window.__B.exceptions.push('error: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', e => window.__B.exceptions.push('rejection: ' + e.reason));
try { localStorage.setItem('yokai-tutorial-v1', JSON.stringify('skip')); } catch (e) {}
(function () {
  var t = setInterval(function () {
    var ow = window.OVERWORLD;
    if (!ow || typeof ow.confirm !== 'function' || ow.__bHooked) return;
    ow.__bHooked = true;
    var orig = ow.confirm;
    window.__B.confirmed = [];
    ow.confirm = function () { var r = orig.apply(this, arguments);
      try { window.__B.confirmed.push(r && r.stageId ? String(r.stageId) : null); } catch (e) {}
      return r; };
    clearInterval(t);
  }, 20);
})();
window.__B_THROW = function () { setTimeout(function () { throw new Error('b-negative-control'); }, 30); };
`;

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 1; this.pending = new Map(); this.exceptions = [];
    ws.onmessage = e => {
      const a = JSON.parse(e.data);
      if (a.method === 'Runtime.exceptionThrown') {
        const d = a.params?.exceptionDetails;
        this.exceptions.push(String(d?.exception?.description || d?.text || 'exception').split('\n')[0]);
        return;
      }
      const p = this.pending.get(a.id);
      if (p) { this.pending.delete(a.id); a.error ? p.reject(Error(JSON.stringify(a.error))) : p.resolve(a.result); }
    };
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((res, rej) => {
      // 逾時保護：eval 若因頁面無界迴圈永不返回，30 秒後明確失敗而不是整個 run 卡住。
      const timer = setTimeout(() => { if (this.pending.delete(id)) rej(Error('CDP timeout: ' + method)); }, 30000);
      this.pending.set(id, { resolve: v => { clearTimeout(timer); res(v); }, reject: e => { clearTimeout(timer); rej(e); } });
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

const CALIB = process.argv.includes('--calib') ? path.join(os.tmpdir(), 'yokai-b-20261013', 'calib-known-good') : null;
function startServer() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname === '/__b__/rig.js') { res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' }).end(RIG); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403).end(); return; }
    // 校準模式：只把 js/game.js 與 js/words.js 指向 TEMP 的已知正確版本（記憶體層，磁碟不動）
    let serveFile = file;
    if (CALIB && path.basename(file) === 'game.js' && fs.existsSync(path.join(CALIB, 'game.js'))) serveFile = path.join(CALIB, 'game.js');
    if (CALIB && path.basename(file) === 'words.js' && fs.existsSync(path.join(CALIB, 'words.js'))) serveFile = path.join(CALIB, 'words.js');
    fs.readFile(serveFile, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      if (file === path.join(root, 'js', 'game.js')) {
        const s = buf.toString('utf8'); const end = s.lastIndexOf('})();');
        // 只附加驗收用掛鉤，不改任何一行正式程式碼；共用 P fixture 不動。
        if (end > 0) buf = Buffer.from(s.slice(0, end) + FIXTURE + BF_HOOK + s.slice(end), 'utf8');
      }
      if (file === path.join(root, 'index.html')) {
        buf = Buffer.from(buf.toString('utf8').replace(/<script src="js\/game\.js[^"]*"/,
          '<script src="/__b__/rig.js"></script>\n<script src="js/game.js"'), 'utf8');
      }
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(buf);
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function launchChrome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yokai-b-'));
  const child = spawn(chrome, ['--headless=new', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let dbg;
  for (let i = 0; i < 120; i++) { const f = path.join(dir, 'DevToolsActivePort'); if (fs.existsSync(f)) { dbg = +fs.readFileSync(f, 'utf8').split('\n')[0]; break; } await sleep(100); }
  if (!dbg) { child.kill(); throw Error('Chrome debugging port timeout'); }
  const targets = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  return { ws, child, dir };
}

async function newPage(c) {
  c.exceptions.length = 0;
  await c.send('Page.enable'); await c.send('Runtime.enable');
  // 語音替身必須在任何頁面腳本之前就位，audio.js 才不會抓到原生 speechSynthesis。
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__VOICE = { utterances: [], speaks: 0, hasSynth: typeof window.speechSynthesis !== 'undefined' };
    try {
      // 不替身 SpeechSynthesisUtterance：Chrome 原生 speechSynthesis.speak() 會拒絕假物件並拋錯，
      // 該例外會沿 interact() 進入遊戲流程，反而污染驗收。此處只記錄環境事實。
      // 注意：Chrome 的 window.speechSynthesis 是唯讀 getter，無法替身。
      // 因此只記錄 utterance 建立，不假造 speak() 呼叫次數。
      window.__VOICE.speechSynthesisAssignable = (() => { const d = Object.getOwnPropertyDescriptor(window,'speechSynthesis'); return !!(d && d.writable); })();
    } catch (e) { window.__VOICE.error = String(e); }
  ` });
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
}
async function open(c, port) {
  for (let a = 0; a < 3; a++) {
    await c.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    for (let i = 0; i < 150; i++) {
      await sleep(140);
      const st = await c.eval('({s:document.body?.dataset?.gameScreen,r:!!window.ART?.player,g:!!window.__B})').catch(() => ({}));
      if (st.s === 'menu' && st.r && st.g) { const bf = await c.eval('window.__BF ? ({ready:window.__BF.ready,error:window.__BF.error}) : null').catch(()=>null); if (bf && bf.ready === false) throw Error('B fixture 注入失敗：' + bf.error); return st; }
    }
    await sleep(1200);
  }
  throw Error('menu never ready');
}
// 真鍵盤走完 menu → map → 走 steps 個相鄰節點 → Enter 進入。
async function enterStage(c, { steps = 0 } = {}) {
  await key(c, 'Enter', 'Enter', 13);
  for (let i = 0; i < 90; i++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'map') break; }
  if (await c.eval('document.body?.dataset?.gameScreen') !== 'map') throw Error('map not reached');
  await sleep(400);
  for (let s = 0; s < steps; s++) { await key(c, 'ArrowRight', 'ArrowRight', 39); await sleep(1500); }
  await key(c, 'Enter', 'Enter', 13);
  for (let i = 0; i < 90; i++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'other') break; }
  return await c.eval('document.body?.dataset?.gameScreen');
}
const PIXELS = `(()=>{const c=RENDERER.getCanvas();const t=document.createElement('canvas');
  t.width=64;t.height=40;const x=t.getContext('2d');x.drawImage(c,0,0,64,40);
  const d=x.getImageData(0,0,64,40).data;const s=new Set();for(let i=0;i<d.length;i+=4)s.add(((d[i]>>3)<<10)+((d[i+1]>>3)<<5)+(d[i+2]>>3));
  return {colors:s.size};})()`;

function pinState() {
  const files = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).sort();
  const per = files.map(f => ({ file: `js/${f}`, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'js', f))).digest('hex') }));
  const aggregate = crypto.createHash('sha256').update(per.map(x => `${x.file}=${x.sha256}`).join('\n')).digest('hex');
  const head = require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { at: new Date().toISOString(), head, jsAggregateSha256: aggregate, files: per };
}

// 語音分支的真正證據：在 Node VM 裡載入**真實 js/audio.js**，
// 用可追蹤的 SpeechSynthesisUtterance / speechSynthesis 觀察分支。
// 注意 audio.js 的 speak() 開頭有 `if (muted || suspended) return;`，
// 必須確保 fresh、未靜音、未暫停，否則整段不會執行（空跑）。
function runVoiceVm() {
  const vm = require('node:vm');
  const fs2 = require('node:fs');
  const utterances = [], speaks = []; const playCalls = [];
  let suspended = false;
  class TraceUtterance {
    constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.onend = null; this.onerror = null; utterances.push({ text, lang: '' }); }
  }
  const mkSynth = () => ({ speak(u) { speaks.push({ text: u.text, lang: u.lang }); }, cancel() {}, getVoices: () => [{ lang: 'ja-JP', name: 'trace', default: true }], speaking: false, paused: false, addEventListener() {}, removeEventListener() {} });
  const env = {
    console, Set, Map, Date, JSON, URL, URLSearchParams, Math,
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => 0 }, navigator: { userAgent: 'node' },
    Audio: function () { return { play() { playCalls.push(this.src || ''); return Promise.resolve(); }, pause() {}, cloneNode() { return this; }, addEventListener() {}, removeEventListener() {}, canPlayType: () => 'maybe' }; },
    SpeechSynthesisUtterance: TraceUtterance,
    speechSynthesis: mkSynth(),
    fetch: () => Promise.reject(new Error('no network in vm')),
    __playCalls: playCalls,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: { createElement: () => ({ getContext: () => ({ decodeAudioData: () => Promise.resolve({}) }) }), addEventListener() {} },
    addEventListener() {}, removeEventListener() {},
  };
  env.window = env; env.self = env; env.globalThis = env;
  const c = vm.createContext(env);
  vm.runInContext(fs2.readFileSync(path.join(root, 'js', 'audio.js'), 'utf8'), c, { filename: 'js/audio.js' });
  const out = { tts: null, noSpeech: null };
  // 注意 audio.js 的 speak() 開頭是 `if (muted || suspended) return;`。
  // toggleMute() 不接受參數、只做 muted=!muted，所以**絕不可**呼叫 toggleMute(false)，
  // 那會把 fresh 的 false 翻成 true，導致 speak 提前 return（先前 VM 失敗的真因）。
  // localStorage.getItem 回傳 null → muted 初始即為 false。
  try { c.AUDIO.setSuspended && c.AUDIO.setSuspended(false); } catch (e) { out.setupError = String(e); }
  // TTS 分支：用一個真實新詞（無 mp3 映射）
  try {
    c.AUDIO.speak('こども');
    const last = speaks[speaks.length - 1];
    out.tts = { speakCount: speaks.length, text: last && last.text, lang: last && last.lang,
      utterances: utterances.length, utteranceText: utterances[utterances.length - 1] || null };
  } catch (e) { out.tts = { error: String(e.message || e), speakCount: speaks.length }; }
  // MP3 分支（與 TTS 分開驗）：Audio stub 記錄 play 呼叫
  try {
    const beforePlays = env.__playCalls.length;
    c.AUDIO.speak('ねこ');
    out.mp3 = { word: 'ねこ', playCalls: env.__playCalls.length - beforePlays,
      lastSrc: env.__playCalls[env.__playCalls.length - 1] };
  } catch (e) { out.mp3 = { error: String(e.message || e) }; }
  // speechSynthesis 缺席：換全新 env，同樣不得切靜音
  try {
    const env2 = { ...env, __playCalls: [] };
    env2.speechSynthesis = undefined;
    env2.window = env2; env2.self = env2; env2.globalThis = env2;
    const c2 = vm.createContext(env2);
    vm.runInContext(fs2.readFileSync(path.join(root, 'js', 'audio.js'), 'utf8'), c2, { filename: 'js/audio.js' });
    try { c2.AUDIO.setSuspended && c2.AUDIO.setSuspended(false); } catch (e) {}
    c2.AUDIO.speak('こども');
    out.noSpeech = { noThrow: true };
  } catch (e) { out.noSpeech = { noThrow: false, error: String(e.message || e) }; }
  return out;
}

async function waitFrames(c, n) {
  return c.eval(`(async()=>{const NFRAMES=${n};const d=[];let last=0;
    await new Promise(done=>{const t=x=>{if(last)d.push(x-last);last=x;if(d.length>=NFRAMES)return done();requestAnimationFrame(t);};requestAnimationFrame(t);});
    const s=d.slice().sort((a,b)=>a-b);
    return {frames:d.length,fps:+(1000/(d.reduce((a,b)=>a+b,0)/d.length)).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2)};})()`);
}

async function main() {
  const onlyVoice = process.argv.includes('--voice-vm');
  const onlyEight = process.argv.includes('--eight');
  const selfTest = process.argv.includes('--selftest');
  const stageArg = (process.argv.find(a => a.startsWith('--stage=')) || '').slice(8) || null;
  // --ui-only：只重測八關 UI 進入 + 3 手機場景，不重跑已通過的 core。
  // 新鮮 Chrome profile 的 localStorage 是空的，導航測試需先準備解鎖（標示為 fixture 準備，
  // 僅供導航測試；chain 證據來自 full-run 的真實勝利，不在此重複證明）。
  const uiOnly = process.argv.includes('--ui-only');
  if (!fs.existsSync(chrome)) throw Error('Chrome unavailable');
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' :: ' + JSON.stringify(detail))); };
  // 與正式判定器共用的無錯誤收集：CDP 例外 + 頁面 window.onerror，呼叫即清空。
  // 正式流程與 selftest 用同一組 helper：selftest 的真 throw 必須讓同一判定器 FAIL，
  // 自然導致 exit 1，而不是由特殊分支硬設退出碼。
  const collectErrors = async () => {
    const page = await c.eval('(window.__B.exceptions||[]).slice()').catch(() => ['eval-failed']);
    const all = [...c.exceptions, ...page];
    c.exceptions.length = 0;
    await c.eval('window.__B.exceptions.length=0').catch(() => {});
    return all;
  };
  // 累計 gate：各段 drain 進來，只在八關 entry 前一次判定（detail 用副本）。
  // 每一筆例外恰好被判定一次：baseline 段即時判定；其餘段累計到 gate。
  let coreErrLog = [];
  const drainCore = async () => { const e = await collectErrors(); coreErrLog.push(...e); return e; };

  const server = await startServer();
  const { ws, child, dir } = await launchChrome();
  const c = new CDP(ws);
  try {
    await newPage(c);
    await open(c, server.address().port);

    if (selfTest) {
      await enterStage(c, { steps: 0 });
      await c.eval('window.__B_THROW()');
      await sleep(600);
      // 與正式流程共用同一判定器：注入的真 throw 必須讓「無 JS 例外」FAIL，
      // 由共用的 failed 收集自然導致 exit 1，而不是特殊分支硬設退出碼。
      const errs = await collectErrors();
      check('B0 無 JS 例外（selftest 注入真例外，正式判定器須 FAIL）', errs.length === 0, { errors: errs });
      const failed = results.filter(r => !r.ok);
      fs.writeFileSync(path.join(output, 'selftest.json'), JSON.stringify({ errors: errs, failed: failed.map(r => r.name) }, null, 2));
      if (failed.length) { console.error(`SELFTEST FAILED AS EXPECTED: ${failed.map(f => f.name).join(' | ')}`); process.exitCode = 1; }
      else { console.error('SELFTEST INVALID: 注入例外未被正式判定器捕獲'); process.exitCode = 2; }
      return;
    }

    if (uiOnly) {
      const prep = await c.eval(`(()=>{const S=window.STORE;
        Object.keys(window.CONTENT.STAGES).forEach(id=>S.completeStage(id));
        return Object.keys(window.CONTENT.STAGES).filter(id=>S.isStageUnlocked(id));})()`);
      check('entry準備：八關已解鎖（fixture 準備，僅供導航測試；chain 證據見 full-run 真實勝利）',
        Array.isArray(prep) && prep.length === 8, { unlocked: prep });
    }

    if (!uiOnly) {
    // baseline E2E：gate 是 waypoint 不是關卡，必須先走到 night-town 再 Enter。
    const screen1 = await enterStage(c, { steps: 1 });
    const confirmed1 = await c.eval('(window.__B.confirmed||[]).slice()');
    check('baseline night-town：真正交給 start() 的關卡', confirmed1[confirmed1.length - 1] === 'night-town', { screen: screen1, confirmed: confirmed1 });
    const px = await c.eval(PIXELS);
    check('baseline night-town：畫面有實際繪製', px.colors > 4, px);
    const eNt = await collectErrors();
    check('baseline night-town：無 JS 例外', eNt.length === 0, { errors: eNt });

    // 過關解鎖：走遊戲自己的進度 API 解鎖第二關後，必須能真的進入。
    await c.eval('(()=>{try{window.STORE.completeStage("night-town");return window.STORE.isStageUnlocked("rain-port");}catch(e){return String(e);}})()');
    await c.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html` });
    await open(c, server.address().port);
    const screen2 = await enterStage(c, { steps: 3 });
    const confirmed2 = await c.eval('(window.__B.confirmed||[]).slice()');
    check('baseline rain-port：解鎖後真的進入第二關', confirmed2[confirmed2.length - 1] === 'rain-port', { screen: screen2, confirmed: confirmed2 });
    const eRp = await collectErrors();
    check('baseline rain-port：無 JS 例外', eRp.length === 0, { errors: eRp });

    // B4／B5／B2 內容套件：只對「已實作」的關卡執行，未實作不判失敗（不是 P 退步）。
    const stages = await c.eval('Object.keys(window.CONTENT.STAGES).filter(id=>window.CONTENT.getStage(id).implemented===true)');
    check('內容套件：偵測到已實作關卡', Array.isArray(stages) && stages.length > 0, { stages });

    for (const sid of stages) {
      // ── 配送：正確答案必須真的完成配送並計分（用真實 makeOrder/interact/resolve）──
      const del = await c.eval(`(()=>{const B=window.__BF;B.stage('${sid}');B.freeze();
        const o=B.openOrder(); if(!o.ok) return {err:o.err};
        const j=B.jobInfo();                       // job.ans 就是正式選項順序
        const idx=j.ans.indexOf(j.word);          // 真實 indexOf，不經洗牌
        const before=B.snapshotLite();
        B.pick(idx); const after=B.snapshotLite();
        return {job:j, idx, idxFound:idx>=0, deliveredBefore:before.delivered, deliveredAfter:after.delivered,
          scoreDelta:after.score-before.score, oilDelta:+(after.oil-before.oil).toFixed(3),
          deliveredOK:after.delivered>before.delivered, scoreUp:after.score>before.score};})()`);
      check(`B4 ${sid}：正確答案完成配送並計分`, del && !del.err && del.idxFound && del.deliveredOK && del.scoreUp, del);

      // 答錯不得算送達、不得加分
      const mis = await c.eval(`(()=>{const B=window.__BF;B.stage('${sid}');B.freeze();
        const o=B.openOrder(); if(!o.ok) return {err:o.err};
        const j=B.jobInfo();
        const ci=j.ans.indexOf(j.word); const idx=(ci+1)%j.ans.length;
        const before=B.snapshotLite(); B.pick(idx); const after=B.snapshotLite();
        return {correctIdx:ci, wrongIdx:idx, deliveredSame:after.delivered===before.delivered, scoreDelta:after.score-before.score,
          oilDelta:+(after.oil-before.oil).toFixed(3)};})()`);
      check(`B4 ${sid}：答錯不算送達且不加分`, mis && !mis.err && mis.deliveredSame && mis.scoreDelta <= 0, mis);

      // ── 選項去重：只看實際選項，不得因全庫有近義詞就判錯 ──
      const chq = await c.eval(`(()=>{const B=window.__BF;const words=window.CONTENT.getStageWords('${sid}');
        const bad=[];for(const w of words){const ch=B.choicesFor(w);
          if(ch.length<2) { bad.push({jp:w.jp,why:'choices<2'}); continue; }
          const zh=new Set(ch.map(x=>x.zh));
          if(ch.some(x=>x.jp!==w.jp&&x.zh===w.zh)) bad.push({jp:w.jp,why:'同義正解同時出現'});
          if(new Set(ch.map(x=>x.jp)).size!==ch.length) bad.push({jp:w.jp,why:'選項重複'});}
        return {words:words.length, bad:bad.slice(0,6)};})()`);
      check(`B1 ${sid}：實際選項不得含同義正解或重複項`, chq && chq.bad.length === 0, chq);

      // ── Boss：真實 shield／選項／lock／破盾 ──
      const boss = await c.eval(`(()=>{const B=window.__BF;B.stage('${sid}');B.freeze();
        const word=window.CONTENT.getStageWords('${sid}')[0];
        B.spawnBoss(word); const s0=B.bossState();
        const ans=s0.ans;                                   // bossQ.ans 正式順序
        const ci=ans.indexOf(s0.word); const wi=(ci+1)%ans.length;
        B.answerBoss(wi); const afterWrong=B.bossState();   // 錯答：應上鎖、盾不破
        const waited=B.waitBossLock(120);                   // 等鎖解除
        const s2=B.bossState(); const ci2=s2.ans.indexOf(s2.word); // 錯題後會換題，必須重讀
        B.answerBoss(ci2); const afterRight=B.bossState();  // 正答：應破盾
        return {choiceCount:ans.length, correctIdx:ci, wrongIdx:wi,
          shieldBefore:s0.shield, shieldAfterWrong:afterWrong.shield, shieldAfterRight:afterRight.shield,
          lockBefore:s0.lock, lockAfterWrong:afterWrong.lock, waited,
          hpBefore:s0.hp, hpAfterRight:afterRight.hp, newQuestion:s2.word!==s0.word, correctIdx2:ci2};})()`);
      check(`B3 ${sid}：Boss 結界初始開啟、錯答鎖住、等鎖解除後正答破盾`,
        boss && boss.shieldBefore === true && boss.shieldAfterWrong === true && boss.shieldAfterRight === false
        && boss.correctIdx >= 0 && boss.correctIdx2 >= 0, boss);
    }

    const eContent = await drainCore();
    check('內容套件段：無 JS 例外', eContent.length === 0, { errors: [...eContent] });

    // ── 真實勝利流程：每關獨立 drive，用該關實際 GOAL（不硬編 6）──
    // 不 fake win、不以 STORE.completeStage 代替過關。
    // 先把進度重設為受控 false（只為 setup，不經 completeStage），再逐關真勝利。
    const resetR = await c.eval(`(()=>{const S=window.STORE;
      if(!S||!S.data||!S.data.progress) return {err:'no store data'};
      const D=S.data.progress;
      const beforeC=JSON.parse(JSON.stringify(D.completed||{}));
      const beforeU=JSON.parse(JSON.stringify(D.unlocked||{}));
      D.completed={}; D.unlocked={};
      const still=Object.keys(window.CONTENT.STAGES).filter(id=>S.isStageCompleted(id));
      return {beforeC, beforeU, stillCompleted:still};})()`);
    check('勝利前：進度已重設為受控 false（setup，未呼叫 completeStage）',
      resetR && !resetR.err && resetR.stillCompleted.length === 0, resetR);

    const winResults = [];
    for (const sid of stages) {
      if (stageArg && sid !== stageArg) continue;   // --stage= 只跑指定關的勝利驅動，不盲跑全表
      const sids = await c.eval('Object.keys(window.CONTENT.STAGES)');
      const next = sids[sids.indexOf(sid) + 1] || null;
      // FULL（分小 batch eval：F1 建局→殺王；F2 以 ≤80 幀推進演出；F3 讀 finish。單次 eval 不超載）
      const t0 = Date.now();
      const mid = await c.eval(`(async()=>{
        const B=window.__BF,S=window.STORE;
        B.stage('${sid}'); B.freeze(); B.spyFinish();
        const fb0=B.finishCalls().length;
        const clears0=(S.getStageStats('${sid}').clears||0);
        const comp0=S.isStageCompleted('${sid}');
        const NX=${next ? `'${next}'` : 'null'};
        const un0=NX?S.isStageUnlocked(NX):null;
        const g=B.winStateFull().goal;
        if(!(g>0)) return {err:'bad-goal',goal:g,sid:'${sid}'};
        for(let i=0;i<g;i++){const r=B.realDeliver(); if(r.err) return {err:'deliver:'+r.err,sid:'${sid}'};}
        B.resolveLevelups();
        const d=B.defeatFinalBoss(0); if(d.err) return {err:'boss:'+d.err,sid:'${sid}'};
        B.resolveLevelups();
        B.advance(120,0.1);
        const w0=B.winStateFull();
        return {goal:g, delivered:w0.delivered, final:w0.finalBossDefeated, state:w0.state,
          fb0, clears0, comp0, un0, next:NX};})()`);
      console.log(`[timing] ${sid} full F1: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      let fstate = mid && !mid.err ? mid.state : null, frounds = 0;
      const t1 = Date.now();
      while (fstate === 'victory' && frounds++ < 5) {
        fstate = await c.eval(`(()=>{const B=window.__BF;B.frames(80,50);return B.winStateFull().state;})()`);
      }
      console.log(`[timing] ${sid} full settle: ${((Date.now() - t1) / 1000).toFixed(1)}s rounds=${frounds}`);
      const full = mid && !mid.err ? await c.eval(`(async()=>{
        const B=window.__BF,S=window.STORE;
        const w=B.winStateFull();
        const calls=B.finishCalls().slice(${mid.fb0});
        return {goal:${mid.goal}, state:w.state, delivered:w.delivered, final:w.finalBossDefeated,
          settleRounds:${frounds},
          finishDelta:calls.length, calls:calls,
          clears0:${mid.clears0}, clears1:(S.getStageStats('${sid}').clears||0),
          comp0:${mid.comp0}, comp1:S.isStageCompleted('${sid}'),
          un0:${mid.un0}, un1:${next ? `S.isStageUnlocked('${next}')` : 'null'}, next:${next ? `'${next}'` : 'null'}};})()`) : mid;
      check(`B4 ${sid} 真實勝利：真擊殺終王+達本關目標→victory→won，STORE.finish 恰真呼叫一次`,
        full && !full.err && full.state === 'won' && full.delivered >= full.goal && full.final === true
        && full.finishDelta === 1 && full.calls[0].stageId === sid && full.calls[0].won === true && full.calls[0].delivered >= full.goal
        && full.clears1 === full.clears0 + 1 && full.comp0 === false && full.comp1 === true
        && (full.next ? (full.un0 === false && full.un1 === true) : true), full);
      winResults.push({ sid, full });
      // NEG noGoal：少一次配送，其餘相同 → 不得勝且無 finish
      const noGoal = await c.eval(`(async()=>{
        const B=window.__BF;
        B.stage('${sid}'); B.freeze(); B.spyFinish();
        const fb0=B.finishCalls().length;
        const g=B.winStateFull().goal;
        if(!(g>0)) return {err:'bad-goal',goal:g};
        for(let i=0;i<g-1;i++){const r=B.realDeliver(); if(r.err) return {err:'deliver:'+r.err};}
        B.resolveLevelups();
        const d=B.defeatFinalBoss(0); if(d.err) return {err:'boss:'+d.err};
        B.resolveLevelups();
        B.advance(60,0.1);
        B.frames(10,50);
        const w=B.winStateFull();
        return {goal:g, state:w.state, delivered:w.delivered, final:w.finalBossDefeated,
          finishDelta:B.finishCalls().length-fb0};})()`);
      check(`B4 ${sid} 反向：未達本關目標不得勝（且無 finish 呼叫）`,
        noGoal && !noGoal.err && noGoal.state !== 'won' && noGoal.state !== 'victory' && noGoal.finishDelta === 0, noGoal);
      winResults.push({ sid, noGoal });
      // NEG noBoss：達標但不殺終王 → 不得勝且無 finish
      const noBoss = await c.eval(`(async()=>{
        const B=window.__BF;
        B.stage('${sid}'); B.freeze(); B.spyFinish();
        const fb0=B.finishCalls().length;
        const g=B.winStateFull().goal;
        if(!(g>0)) return {err:'bad-goal',goal:g};
        for(let i=0;i<g;i++){const r=B.realDeliver(); if(r.err) return {err:'deliver:'+r.err};}
        B.resolveLevelups();
        B.advance(60,0.1);
        B.frames(10,50);
        const w=B.winStateFull();
        return {goal:g, state:w.state, delivered:w.delivered, final:w.finalBossDefeated,
          finishDelta:B.finishCalls().length-fb0};})()`);
      check(`B4 ${sid} 反向：終王未敗不得勝（且無 finish 呼叫）`,
        noBoss && !noBoss.err && noBoss.state !== 'won' && noBoss.state !== 'victory' && noBoss.finishDelta === 0, noBoss);
      winResults.push({ sid, noBoss });
    }
    const eWin = await drainCore();
    check('勝利驅動段：無 JS 例外', eWin.length === 0, { errors: [...eWin] });

    // 第八關混合 + 錯題優先（僅在 yomi 實作後驗證）。
    if (stages.includes('yomi')) {
      const yomi = await c.eval(`(()=>{const all=window.CONTENT.getAllWords();const pool=window.CONTENT.getStageWords('yomi');
        const jp=new Set(pool.map(w=>w.jp));
        return {size:pool.length, unique:jp.size===pool.length, isMix:pool.length>2, hasGlobal:pool.some(w=>w.jp)};})()`);
      check('B5 yomi：有效混合詞池且 jp 唯一', yomi && yomi.isMix && yomi.unique, yomi);
    }

    // ── 語音：真實 API 是 AUDIO.speak(text)。必須確認真的被呼叫，不是 optional-chain 空跑。──
    // ── B2 語音：分支來源由 Node VM 分支證明（載入真實 js/audio.js，可追蹤 speech）──
    // Chrome 端只驗「AUDIO.speak 存在且不拋例外」；原生日語 voice 屬外部條件，記為限制。
    const voice = await c.eval(`(()=>{const res={ api: typeof window.AUDIO.speak };
      if(res.api!=='function') return res;
      let threw=false, err=null;
      try{ window.AUDIO.speak('ねこ'); }catch(e){ threw=true; err=String(e.message||e); }
      let ttsThrew=false, ttsErr=null;
      try{ window.AUDIO.speak('__hd25d_no_mp3_word__'); }catch(e){ ttsThrew=true; ttsErr=String(e.message||e); }
      return {api:res.api, mp3Threw:threw, mp3Err:err, ttsThrew, ttsErr,
        nativeVoice: typeof window.speechSynthesis !== 'undefined',
        limitation: 'Chrome 原生 speechSynthesis 為唯讀 getter，無法掛 utterance trace；分支證明見 --voice-vm'};})()`);
    check('B2 語音（Chrome）：AUDIO.speak 存在且呼叫不拋例外',
      voice && voice.api === 'function' && voice.mp3Threw === false, voice);
    check('B2 語音（Chrome）：未知詞走 TTS 分支時不拋例外（不宣稱已發聲）',
      voice && voice.api === 'function' && voice.ttsThrew === false, voice);

    // 語音分支的真正證據：Node VM 載入真實 js/audio.js
    if (process.argv.includes('--voice-vm') || onlyVoice) {
      const vmRes = await runVoiceVm();
      check('B2 語音（VM）：真實 audio.js 在未靜音未暫停下，TTS 分支產生 ja-JP utterance 且 speak 次數 > 0',
        vmRes.tts && vmRes.tts.speakCount > 0 && /ja-JP/i.test(vmRes.tts.lang || '') && vmRes.tts.utterances > 0 && vmRes.tts.text === 'こども', vmRes.tts);
      check('B2 語音（VM）：既有 ねこ 走 MP3 分支並實際 play（與 TTS 分開驗證）',
        vmRes.mp3 && vmRes.mp3.playCalls > 0, vmRes.mp3);
      check('B2 語音（VM）：speechSynthesis 缺席時不崩潰（真 fallback）', vmRes.noSpeech && vmRes.noSpeech.noThrow === true, vmRes.noSpeech);
    }


    const eVoice = await drainCore();
    check('語音段：無 JS 例外', eVoice.length === 0, { errors: [...eVoice] });


    // ── STORY 接入存在性：八關開場/配送/Boss 名稱（畫面證據由 PNG 提供，root 目視覆核）──
    const story = await c.eval(`(()=>{const ids=Object.keys(window.CONTENT.STAGES);
      return ids.map(id=>{const s=(window.STORY&&window.STORY.get)?window.STORY.get(id):null;
        return {id, ok:!!(s&&s.title&&s.opening&&s.bossTitle), title:s&&s.title,
          hasOpening:!!(s&&s.opening), hasBossTitle:!!(s&&s.bossTitle)};});})()`);
    const storyBad = (story||[]).filter(s=>!s.ok);
    check('B3 STORY：八關開場/配送/Boss 名稱皆已接入', storyBad.length===0 && story.length===8, { bad: storyBad });

    // ── 重載後讀 STORE：完成/clears/解鎖與 localStorage 逐欄一致（真持久化）──
    // storedClears 必須與 API clears 以及該關 full.clears1 精確相等，不只 >=1。
    const expectClears = {};
    for (const w of winResults) { if (w.full && !w.full.err) expectClears[w.sid] = w.full.clears1; }
    await c.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html` });
    await open(c, server.address().port);
    const reloaded = await c.eval(`(()=>{const S=window.STORE;const ids=${JSON.stringify(stages)};
      const EXP=${JSON.stringify(expectClears)};
      let raw=null,parseErr=null;
      try{raw=localStorage.getItem('yokai-delivery-v1');}catch(e){parseErr=String(e&&e.message||e);}
      let stored=null;
      try{stored=raw?JSON.parse(raw):null;}catch(e){parseErr=String(e&&e.message||e);}
      const getStoredClears=id=>{try{const st=stored&&stored.progress&&stored.progress.stages&&stored.progress.stages[id];return st?st.clears:null;}catch(e){return 'err';}};
      return ids.map(id=>({id,
        completed:S.isStageCompleted(id), unlocked:S.isStageUnlocked(id), clears:(S.getStageStats(id).clears||0),
        storedCompleted:stored&&stored.progress&&stored.progress.completed?stored.progress.completed[id]===true:null,
        storedUnlocked:stored&&stored.progress&&stored.progress.unlocked?stored.progress.unlocked[id]===true:null,
        storedClears:getStoredClears(id), expectClears:(id in EXP)?EXP[id]:null}));})()`);
    const reloadBad = reloaded.filter(r=>!(r.completed===true&&r.unlocked===true&&r.storedCompleted===true&&r.storedUnlocked===true
      &&r.storedClears===r.clears&&r.expectClears!==null&&r.clears===r.expectClears));
    check('B4 重載後：已驗關卡的完成/clears/解鎖與 localStorage 逐欄一致（storedClears==API==full.clears1）', reloadBad.length===0, { bad: reloadBad });
    fs.writeFileSync(path.join(output, 'b-stage-reloaded.json'), JSON.stringify({ finished: new Date().toISOString(), reloaded }, null, 2));
    const eReload = await drainCore();
    check('重載段：無 JS 例外', eReload.length === 0, { errors: [...eReload] });

    // 累計 gate：core（內容/勝利/yomi/語音/STORY/重載）全部段落的例外在此一次判定。
    // 之後 entry 迴圈每次 reset 前，本段已經判過，不會被清空掩蓋。
    await drainCore();   // 收尾 yomi + STORY 段
    check('core 全段無 JS 例外（entry 前累計判定）', coreErrLog.length === 0, { errors: [...coreErrLog] });

    } // end if (!uiOnly)：core 段落只在非 ui-only 跑；八關 entry 兩種模式都跑

    // ── 八關經真實地圖 UI 進入：同 UI browse API 選關 + 真 Enter 確認，攔截 confirm 交給 start 的 stageId + 截圖 ──
    // 桌機 1280x800 全八關；手機橫向 844x390 取 night-town / snow-temple / yomi 三個關鍵場景。
    if (onlyEight || process.argv.includes('--eight')) {
      const pngDir = path.join(output, 'stages');
      fs.mkdirSync(pngDir, { recursive: true });
      const allIds = await c.eval('Object.keys(window.CONTENT.STAGES)');
      // --calib 正式目標只能是已實作關（已知正確快照僅 2 關）；正式 eight 強制原 8 關。
      const targets = CALIB
        ? await c.eval('Object.keys(window.CONTENT.STAGES).filter(id=>window.CONTENT.getStage(id).implemented===true)')
        : allIds;
      if (!CALIB) check('正式 eight：八關齊備', targets.length === 8, { targets });
      const tasks = targets.map((id, i) => ({ expect: id, tag: `stage-${String(i + 1).padStart(2, '0')}-${id}`, metrics: null }));
      const phoneKeys = CALIB ? ['night-town'] : ['night-town', 'snow-temple', 'yomi'];
      for (const key of phoneKeys) {
        tasks.push({ expect: key, tag: `phone-844x390-${key}`, metrics: { width: 844, height: 390, deviceScaleFactor: 2, mobile: true } });
      }
      const entries = [];
      for (const t of tasks) {
        const expect = t.expect;
        if (t.metrics) await c.send('Emulation.setDeviceMetricsOverride', t.metrics);
        else await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
        c.exceptions.length = 0;
        await c.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html` });
        await open(c, server.address().port);
        let screen = null, confirmed = [], shot = null, nav = null;
        try {
          await key(c, 'Enter', 'Enter', 13);
          for (let w = 0; w < 90; w++) { await sleep(120); if (await c.eval('document.body?.dataset?.gameScreen') === 'map') break; }
          await sleep(400);
          // 依 game.js confirmOverworld 的真實契約：
//   selected.id != currentId 時，第一次 Enter 只做 moveTo；必須等真 RAF 讓
//   isMoving(overworld) 為 false 且 currentId === target，第二次 Enter 才會 confirm→start。
          nav = { target: expect, steps: 0, enters: 0, seen: [], diag: [] };
          const navDeadline = Date.now() + 15000;
          const settled = async () => {
            // 不睡 wall-time：每次先推 20 個真 frame（50ms each → 1 秒遊戲時間），
            // OVERWORLD.update 沿 path 移動；40 次上限 = 最多 40 秒遊戲時間，
            // 遠超 gate→yomi 全圖最長路徑所需。manualFrame 不新增 RAF 鏈。
            for (let k = 0; k < 40; k++) {
              await c.eval('window.__BF.frames(20,50)');
              const mv = await c.eval('window.__BF.isMoving()');
              const cur = await c.eval('window.__BF.currentId()');
              if (!mv && cur === nav.target) return true;
            }
            return false;
          };
          let reached = false;
          while (Date.now() < navDeadline && nav.steps < 12) {
            const selStage = await c.eval('window.__BF.selectedStage()');
            nav.seen.push(selStage);
            if (selStage === expect) {
              if (await c.eval('window.__BF.currentId()') === expect) { reached = true; break; }
              await key(c, 'Enter', 'Enter', 13); nav.enters++;      // 第一次 Enter：moveTo
              if (!(await settled())) { nav.diag.push('moveTo 未在期限內完成'); break; }
              const cur2 = await c.eval('window.__BF.currentId()');
              if (cur2 === expect) reached = true;
              else nav.diag.push('moveTo 後 currentId 未達目標: ' + cur2);
              break;
            }
            // 同正式 UI 選關按鈕的 browse API（OVERWORLD.browse），不碰 current/from/path
            await c.eval('window.__BF.browseNext()');
            nav.steps++;
            await sleep(250);
          }
          if (reached) { await key(c, 'Enter', 'Enter', 13); nav.enters++; }  // 第二次：confirm→start
          for (let w = 0; w < 90; w++) { await sleep(120); screen = await c.eval('document.body?.dataset?.gameScreen'); if (screen === 'other') break; }
          confirmed = await c.eval('(window.__B.confirmed||[]).slice()');
          await waitFrames(c, 20);
          const file = path.join(pngDir, `${t.tag}.png`);
          const res = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
          shot = { file: path.relative(root, file), bytes: fs.statSync(file).size };
        } catch (e) { screen = 'error: ' + String(e.message).split('\n')[0]; }
        const got = confirmed[confirmed.length - 1] ?? null;
        entries.push({ tag: t.tag, expect, got, screen, shot, nav, exceptions: [...c.exceptions] });
        check(`B4 八關 UI 進入 ${t.tag} ${expect}：confirm 交給 start 的關卡相符且已截圖（同 UI browse API + 真 Enter 確認）`,
          got === expect && screen === 'other' && c.exceptions.length === 0 && !!shot, entries[entries.length - 1]);
      }
      fs.writeFileSync(path.join(output, 'b-stage-eight-ui-entries.json'),
        JSON.stringify({ finished: new Date().toISOString(), entries }, null, 2));
    }

    const state = pinState();
    const failed = results.filter(r => !r.ok);
    const reportName = process.argv.includes('--calib') ? 'b-stage-calibration.json' : (process.argv.includes('--baseline') ? 'b-stage-baseline.json' : 'b-stage-diagnostic.json');
    fs.writeFileSync(path.join(output, reportName),
      JSON.stringify({ finished: new Date().toISOString(), productionState: state, total: results.length, failed: failed.map(f => f.name), results }, null, 2));
    console.log(`REPORT ${path.join(output, 'b-stage-baseline.json')}`);
    if (failed.length) { console.error(`B BASELINE FAILED: ${failed.map(f => f.name).join(' | ')}`); process.exitCode = 1; }
    else console.log(`B BASELINE OK: ${results.length}/${results.length}`);
  } finally {
    try { ws.close(); } catch {}
    child.kill(); server.close(); await sleep(300);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}
main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
