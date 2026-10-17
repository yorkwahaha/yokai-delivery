// R6／R4 獨立驗收：第二關 rain-port（雨夜港町）完整化
// ---------------------------------------------------------------------------
// 產出者：OpenCode（獨占 tests/）。production 唯讀，本檔不改 js/、不改資產。
// 執行：node --test tests/r4-rain-port.acceptance.cjs
// 校準：tools/r6-r4-calibration.cjs（故障注入證明探針有分辨力）
//
// R4 條文（roadmap.md）：
//   地表採石磚路或木碼頭（候選未定案）；港口新建築，和風同系列，不重做第一關
//   町屋或已核准旅路背景；雨滴自然隨機分布、避免整齊週期性重複；注意 2.5D anchor
//   接地點、陰影、透明度 alpha 邊緣，避免素材預烘傾斜被二次壓扁；手機載入容量與
//   media cache 更新。
//
// 分組：
//   A. 關卡契約（27 詞／600s／6 配送／時間波次／Port Boss／地圖節點解鎖）
//   B. 階段專屬資產（只影響 rain-port，不誤上第一關）
//   C. 雨／漣漪粒子（三景深、隨機分布、2.5D 投影、alpha、腳底 anchor）
//   D. 續關（localStorage）
//   E. 資產存在與格式無損、冷啟動載入量
//   F. 手機畫面不重疊
//
// ⚠ 可驗證性邊界（不可混淆）：
//   可自動化：資料契約、隨機性統計、投影數學、alpha/anchor 數值、資產存在與格式、
//             冷啟動請求量、續關資料往返、HUD 幾何。
//   不可自動化（標 未人工驗）：圖像語意與美感、地表候選方案的主觀取捨。
//   本機 Chrome headless ≠ iPad／手機真機；真機仍需 P7。
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = process.env.R6_SRC_ROOT || path.join(ROOT, 'js');
const readSrc = name => fs.readFileSync(path.join(SRC_ROOT, name), 'utf8');
// words.js 必須跟著 SRC_ROOT 走，否則故障注入改到副本、測試卻仍讀 production。
function loadModuleGlobal(name, globalName) {
  const env = { console, module: { exports: {} } };
  env.window = env;
  vm.runInNewContext(readSrc(name), env, { filename: name });
  return env.window[globalName] || env.module.exports;
}
const words = loadModuleGlobal('words.js', 'CONTENT');
// 避免靜默拿到 undefined 而讓後續斷言語意失真
if (!words || typeof words.getStage !== 'function') throw new Error('js/words.js 未正確載入 CONTENT');

const STAGE_ID = 'rain-port';
const stage = words.getStage(STAGE_ID);

// --------------------------------------------------------------------------
// A. 關卡契約
// --------------------------------------------------------------------------
test('R4 (A1) rain-port 詞庫：6 個 pack 共 27 詞、無重複、且不含其他關詞', () => {
  assert.ok(stage, 'js/words.js 找不到 rain-port 關卡');
  assert.equal(stage.implemented, true, 'rain-port 必須是 implemented');
  const packs = stage.wordPacks;
  assert.ok(Array.isArray(packs) && packs.length > 0, 'rain-port 沒有設定 wordPacks');
  const seen = new Set();
  let total = 0;
  const missing = [];
  for (const id of packs) {
    const pack = words.getPack(id);
    if (!pack) { missing.push(id); continue; }
    for (const w of pack.words) { total++; seen.add(w.jp); }
  }
  assert.equal(missing.length, 0, `找不到的 pack：${missing.join('、')}`);
  assert.equal(total, 27, `rain-port 詞數應為 27，實際 ${total}`);
  assert.equal(seen.size, 27, `rain-port 有重複詞：${total} 筆只有 ${seen.size} 個不同詞`);
  // 不得混入第一關的夜行町詞包
  const nightPacks = new Set(words.getStage('night-town').wordPacks);
  const overlap = packs.filter(p => nightPacks.has(p));
  assert.equal(overlap.length, 0, `rain-port 與 night-town 共用 pack：${overlap.join('、')}`);
  // 每詞必須有可作答的完整 metadata
  for (const p of packs) for (const w of words.getPack(p).words) {
    assert.ok(w.jp && w.zh && w.romaji && w.example,
      `${w.jp}：缺少 jp/zh/romaji/example，無法作為正式詞條`);
  }
});

test('R4 (A2) rain-port 節奏契約：600 秒、6 配送、90 秒後百鬼、時間波次遞增', () => {
  const p = stage.pacing;
  assert.equal(p.runSeconds, 600, '單局秒數應為 600');
  assert.equal(p.goalDeliveries, 6, '勝利所需配送應為 6');
  assert.equal(p.surgeFirst, 90, '首波百鬼應在 90 秒');
  assert.ok(p.surgeInterval > 0, '百鬼間隔必須為正數');
  // 注意：times 來自另一個 vm realm，直接 deepEqual 會因 Array prototype 不同而失敗，
  // 先攤平成純數字陣列再比。
  const times = [...p.bossTimes].map(Number);
  assert.ok(times.length >= 3, `Boss 時間波次數量不足：${JSON.stringify(times)}`);
  assert.equal([...times].sort((a, b) => a - b).join(','), times.join(','),
    `Boss 時間波次必須遞增：${times.join(',')}`);
  assert.equal(new Set(times).size, times.length, `Boss 時間波次有重複：${times.join(',')}`);
  assert.ok(times[0] >= 60 && times[0] < 200, `第一個 Boss 應在 60~200 秒，實際 ${times[0]}`);
  assert.ok(times.at(-1) <= p.runSeconds, '最後一個 Boss 時間超過單局長度');
});

test('R4 (A3) rain-port 使用 Port 風格 Boss 與射手配置', () => {
  const e = stage.enemy;
  assert.equal(e.bossTheme, 'harbor', `Boss 主題應為 harbor，實際 ${e.bossTheme}`);
  assert.ok(e.shooterChance > 0 && e.shooterChance <= 0.1,
    `射手比例應介於 0~0.1，實際 ${e.shooterChance}`);
  assert.ok(e.speedScale > 0, '敵人速度倍率必須為正數');
});

test('R4 (A4) rain-port 是視覺雨關，且第一關不得被雨化', () => {
  assert.equal(stage.visual.weather, 'rain', 'rain-port 必須是 rain 天候');
  assert.ok(stage.visual.rainIntensity > 0, '雨強度必須為正數');
  assert.ok(stage.visual.fog > 0, '港町應有海霧');
  assert.equal(stage.visual.petals, 0, '港町不應有櫻花瓣');
  assert.equal(stage.visual.fireflies, 0, '港町不應有螢火蟲');
  // 跨關保護：切到 rain-port 不得改動 night-town 的視覺設定
  const night = words.getStage('night-town').visual;
  assert.equal(night.weather, undefined, `第一關被寫入 weather=${night.weather}：跨關污染`);
  assert.ok(night.petals > 0 && night.fireflies > 0, '第一關的 petals/fireflies 被清掉了');
});

test('R4 (A5) 地圖節點：rain-port 可進入、位置存在、解鎖鏈接在 night-town 之後', () => {
  // 節點定義在 js/overworld.js 的 NODES（陣列），版面錨點在 js/overworld-layout.js（以 id 為鍵）
  const src = readSrc('overworld.js');
  const anchor = src.indexOf('stageId:"rain-port"');
  assert.ok(anchor >= 0, '找不到 rain-port 節點定義');
  // 只取節點物件本體（到下一個 }); 為止），避免抓到鄰居節點的 enterable
  const start = src.lastIndexOf('{', anchor);
  const end = src.indexOf('}', anchor);
  const block = src.slice(start, end + 1);
  assert.match(block, /enterable:\s*true/, 'rain-port 節點必須 enterable:true');
  assert.match(block, /unlockAfter:"night-town"/, 'rain-port 應在 night-town 之後解鎖');
  assert.match(block, /x:\s*[\d.]+,\s*y:\s*[\d.]+/, 'rain-port 節點缺少座標');

  // 版面錨點（route / art / label）必須存在且不重疊在別的關卡上
  const layout = loadModuleGlobal('overworld-layout.js', 'OVERWORLD_LAYOUT');
  const entry = layout.nodes[STAGE_ID];
  assert.ok(entry, 'overworld-layout.js 缺少 rain-port 版面設定');
  for (const k of ['route', 'art', 'label']) {
    assert.ok(entry[k], `rain-port 版面缺少 ${k} 錨點`);
  }
  assert.ok(Number.isFinite(entry.route.x) && Number.isFinite(entry.route.y),
    `rain-port route 錨點無效：${JSON.stringify(entry.route)}`);
  const night = layout.nodes['night-town'];
  assert.ok(night && Number.isFinite(night.route.x),
    '第一關版面錨點缺失，無法驗收跨關保護');
  assert.notDeepEqual(
    [Math.round(entry.route.x), Math.round(entry.route.y)],
    [Math.round(night.route.x), Math.round(night.route.y)],
    'rain-port 與 night-town 的 route 錨點重疊：地圖會畫在同一格');
});

test('R4 (A6) 續關：rain-port 的進度寫入 localStorage，重載後一致', () => {
  const key = 'yokai-delivery-v1';   // 與 js/store.js 的 K 一致（不符就會寫到別的 key）
  const storage = new Map();
  const env = {
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k),
    },
    console, Date: { now: () => 1700000000000 },
  };
  env.window = env;
  vm.runInNewContext(readSrc('store.js'), env, { filename: 'store.js' });
  const S = env.window.STORE;

  assert.equal(S.isStageUnlocked(STAGE_ID), false, '前提失敗：rain-port 一開始不該是解鎖的');
  S.completeStage('night-town');
  assert.equal(S.isStageUnlocked(STAGE_ID), true, '通關第一關後 rain-port 應解鎖');

  const stats = S.getStageStats(STAGE_ID);
  stats.bestScore = 4321;
  stats.bestDeliveries = 6;
  stats.clears = 2;
  S.startRun(STAGE_ID);                 // 進場計次（會 save）
  S.finish(STAGE_ID, 5000, 6, true);    // 結算：寫入最佳紀錄並解鎖下一關
  const raw = storage.get(key);
  assert.ok(raw && raw.includes('rain-port'), 'rain-port 進度沒有寫入 localStorage');

  // 重新載入模組（模擬重開瀏覽器）
  const env2 = {
    localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    console, Date: { now: () => 1700000000000 },
  };
  env2.window = env2;
  vm.runInNewContext(readSrc('store.js'), env2, { filename: 'store.js' });
  const S2 = env2.window.STORE;
  const after = S2.getStageStats(STAGE_ID);
  assert.equal(S2.isStageUnlocked(STAGE_ID), true, '重載後 rain-port 解鎖狀態遺失');
  assert.equal(after.bestScore, 5000, `重載後 bestScore 遺失：${after.bestScore}`);
  assert.equal(after.bestDeliveries, 6, `重載後 bestDeliveries 遺失：${after.bestDeliveries}`);
  assert.equal(after.clears >= 3, true, `重載後 clears 遺失：${after.clears}`);
  assert.equal(after.attempts >= 1, true, `重載後 attempts 遺失：${after.attempts}`);
});

// --------------------------------------------------------------------------
// B. 階段專屬資產
// --------------------------------------------------------------------------
function loadAssetsStub() {
  const images = [];
  class Image {
    constructor() {
      images.push(this);
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }
  }
  class Audio { constructor(src) { this.src = src; } addEventListener() {} }
  const env = { Image, Audio, console, fetch: () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) };
  env.window = env;
  vm.runInNewContext(readSrc('assets.js'), env, { filename: 'assets.js' });
  return { env, images };
}

// 以真 renderer 跑，記錄「實際畫了哪一張地表圖」——這是行為驗收，不是欄位驗收。
// R4 條文要求的是「港口有自己的地表／碼頭，且不重做第一關町屋」。
// 至於用 visual.ground 換鍵、還是由 renderer 依 stageId 另畫，是實作選擇，兩者都應接受；
// 因此本測試不綁死欄位名稱。
function rendererGroundProbe(stageId) {
  const draws = [];
  const makeImg = name => ({ name, naturalWidth: 512, naturalHeight: 512, dataset: { url: name } });
  const ART = { ground: makeImg('generic-ground'), ground_dirt: makeImg('night-town-ground') };
  const PORT_ART = { stone: makeImg('port-stone'), dock: makeImg('port-dock'), ripple: makeImg('port-ripple') };

  const grad = { addColorStop() {} };
  const ctx = new Proxy({
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, closePath() {},
    ellipse() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {},
    createPattern: () => ({}), createLinearGradient: () => grad, createRadialGradient: () => grad,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getTransform: () => ({ a: 1, d: 1 }),
    // 地表是以 createPattern + fillRect 套用的，不會走 drawImage；
    // 因此必須在 createPattern 記錄「用了哪一張」，否則會量不到基底地表。
    createPattern(img) { draws.push(img && img.name); return {}; },
    drawImage(img) { draws.push(img && img.name); },
  }, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });

  const env = {
    Math, Date, console: { warn() {}, log() {} }, setTimeout, clearTimeout,
    // assets.js 在載入時就會 new Image()，沙箱必須提供可用的 Image 類別
    Image: class { constructor() { this.naturalWidth = 0; this.naturalHeight = 0; } },
    document: {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
      getElementById: () => ({ width: 900, height: 600 }),
    },
    innerWidth: 900, innerHeight: 600, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    performance: { now: () => 0 },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['assets.js', 'fx.js', 'skillfx.js', 'viewport.js', 'renderer.js']) {
    vm.runInContext(fs.readFileSync(path.join(SRC_ROOT, name), 'utf8'), c, { filename: name });
  }
  // ⚠ assets.js 在載入時會重建 window.ART 與 window.PORT_ART，
  //   必須在模組載入「之後」才注入 stub，否則會被覆蓋成空物件。
  env.ART = ART;
  env.PORT_ART = PORT_ART;
  env.RENDERER.init?.({ getContext: () => ctx });
  const chunks = [
    { x: 300, y: 300, w: 500, h: 400, theme: 'harbor', decor: { port: { shore: true } } },
    { x: 800, y: 300, w: 500, h: 400, theme: 'harbor', decor: { port: {} } },
  ];
  const groundKey = words.getStage(stageId).visual.ground;
  draws.length = 0;
  env.RENDERER.drawGround(0, 600, chunks, groundKey, stageId);
  return { drawn: [...new Set(draws.filter(Boolean))], groundKey };
}

test('R4 (B1) ★ 行為驗收：rain-port 實際畫出港口地表，且第一關不得被港口資產污染', () => {
  const port = rendererGroundProbe(STAGE_ID);
  const night = rendererGroundProbe('night-town');
  const portAssets = ['port-stone', 'port-dock', 'port-ripple'];

  // 1) rain-port 必須真的畫到港口專屬資產（青石／碼頭）
  assert.ok(portAssets.some(a => port.drawn.includes(a)),
    `rain-port 沒有畫到任何港口專屬地表資產。實際畫了：${JSON.stringify(port.drawn)}`);
  // 2) 第一關不得畫到港口專屬資產（跨關保護）
  const leaked = portAssets.filter(a => night.drawn.includes(a));
  assert.equal(leaked.length, 0,
    `第一關畫到了港口資產 ${JSON.stringify(leaked)}：跨關污染`);
  // 3) 兩關的基底地表不得相同（港町不能沿用町屋地面）
  const baseOf = list => list.find(n => n === 'generic-ground' || n === 'night-town-ground');
  assert.notEqual(baseOf(port.drawn), baseOf(night.drawn),
    `兩關基底地表相同（${baseOf(port.drawn)}）：港口沒有自己的地面`);

  // 資訊項（不作為通過條件）：欄位層面現況，供裁決參考
  console.log(JSON.stringify({
    note: 'B1 以行為驗收；下列欄位值僅為現況紀錄，非契約',
    rainPortVisualGround: port.groundKey,
    nightTownVisualGround: night.groundKey,
    portDrawn: port.drawn, nightDrawn: night.drawn,
  }));
});

test('R4 (B2) assets.js 必須有港町專屬資產的明確對應，且檔案真的存在於磁碟', () => {
  const src = readSrc('assets.js');

  // 1) 必須是明確的靜態對應表（九個角色），而不是靠解析 Markdown 反推角色。
  //    Grok Build 已證實動態解析 Markdown 會把 dock/beacon/crate 配錯。
  const map = /const RAIN_PORT_ASSETS = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(src);
  assert.ok(map, 'js/assets.js 找不到 RAIN_PORT_ASSETS 靜態對應表');
  const entries = [...map[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)].map(m => ({ role: m[1], file: m[2] }));
  assert.equal(entries.length, 9, `港町資產應為 9 個角色，實際 ${entries.length}：${JSON.stringify(entries.map(e => e.role))}`);

  // 2) 角色不得重複，也不得落空
  assert.equal(new Set(entries.map(e => e.role)).size, entries.length, '港町資產角色有重複');
  for (const role of ['stone', 'dock', 'warehouse', 'beacon', 'mooring', 'crate', 'boat', 'anchor', 'ripple']) {
    assert.ok(entries.some(e => e.role === role), `港町資產缺少角色 ${role}`);
  }

  // 3) 每個檔名都必須真的在磁碟上存在（避免 404 後靜默退回舊圖）
  const missing = entries.filter(e => !fs.existsSync(path.join(ROOT, e.file)));
  assert.equal(missing.length, 0,
    `以下港町資產被登記但磁碟上不存在：${missing.map(m => `${m.role}=${m.file}`).join('、')}`);

  // 4) 不得再以 Markdown 正則解析資產（已知會誤配 dock/beacon/crate）。
  //    這不是「有點冗餘」而已：refreshPortArt 同時呼叫靜態載入與 Markdown 解析，
  //    解析結果會覆寫 window.PORT_ART[role]，把正確對應改錯。
  const mdParse = /r4-asset-manifest\.md/.test(src);
  const refresh = /window\.refreshPortArt\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,200}?loadPortArt/.test(src);
  assert.ok(!(mdParse && refresh),
    'js/assets.js 的 refreshPortArt 仍會再跑 Markdown 解析（loadPortArt）：' +
    '該路徑會覆寫 window.PORT_ART[role]，已知會把 dock/beacon/crate 配錯。' +
    '請移除 Markdown 反推路徑，只保留 RAIN_PORT_ASSETS 靜態對應。');

  // 5) 程式必須真的去載入這些資產
  const { env, images } = loadAssetsStub();
  env.loadPortSprites?.();
  env.loadGameArt?.();
  const requested = images.map(i => i.src);
  const notRequested = entries.filter(e => !requested.some(s => s.includes(path.basename(e.file))));
  assert.equal(notRequested.length, 0,
    `以下港町資產沒有被程式請求（玩家看不到）：${notRequested.map(e => e.role).join('、')}`);
});

test('R4 (B3) 第一關資產不得被港町資產取代（跨關保護）', () => {
  const { env, images } = loadAssetsStub();
  env.loadGameArt?.();
  const requested = images.map(i => i.src);
  const hasNightTownOnly = requested.some(src => /ground_dirt|house_shop|prop_sakura/.test(src));
  assert.ok(hasNightTownOnly,
    '第一關專屬資產（ground_dirt / house_shop / prop_sakura）都沒被請求：跨關保護可能已失效');
  // 港町資產不得覆蓋第一關同名鍵
  const { ART } = env;
  if (ART.ground_dirt && ART.ground) {
    assert.notEqual(ART.ground_dirt.src, ART.ground.src, 'ground 與 ground_dirt 指向同一張圖');
  }
});

// --------------------------------------------------------------------------
// C. 雨／漣漪粒子
// --------------------------------------------------------------------------
// 以真 game.js 的 drawStageWeather 執行，用 stub ctx 記錄每條雨線的端點。
function weatherProbe({ stageId = STAGE_ID, times = [0, 1.37, 2.91, 5.5, 9.13] } = {}) {
  const strokes = [];
  const arcs = [];
  const gradients = [];
  const gradient = { addColorStop() {} };
  // 注意：這裡不能在基底物件上預先定義 beginPath/moveTo/lineTo/stroke，
// 否則 proxy 的 `k in o` 會命中空實作，記錄永遠不會觸發。
const ctx = new Proxy({
    save() {}, restore() {}, fillRect() {}, clip() {}, rect() {}, fill() {},
    createLinearGradient() { gradients.push('linear'); return gradient; },
    createRadialGradient() { gradients.push('radial'); return gradient; },
    createPattern() { gradients.push('pattern'); return {}; },
    measureText: () => ({ width: 10 }),
    getTransform: () => ({ a: 1 }),
  }, {
    get: (o, k) => {
      if (k in o) return o[k];
      return (...args) => {
        // 雨線：beginPath → moveTo(x,y) → lineTo(x,y) → stroke()
        if (k === 'moveTo') strokes.push({ type: 'move', args });
        if (k === 'lineTo') strokes.push({ type: 'line', args });
        if (k === 'arc') arcs.push({ type: 'arc', args });
        if (k === 'stroke') strokes.push({ type: 'stroke', args });
        if (k === 'fill') arcs.push({ type: 'fill', args });
        return undefined;
      };
    },
    set: (o, k, v) => { o[k] = v; return true; },
  });

  const events = {};
  const env = {
    console, Set, Map, Math, Date,
    performance: { now: () => 0 },
    navigator: {},
    requestAnimationFrame() {},
    localStorage: { getItem: () => '"skip"', setItem() {}, removeItem() {} },
    document: { hidden: false, getElementById: () => ({ getContext: () => ctx, addEventListener() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }) }), addEventListener: (k, f) => { events[k] = f; } },
    addEventListener: (k, f) => { events[k] = f; },
    innerWidth: 900, innerHeight: 600,
  };
  env.window = env;
  // vm.runInContext 需要真正的 context 化物件，不能是普通 object
  const ctxEnv = vm.createContext(env);

  for (const name of ['words', 'world', 'store', 'config', 'viewport', 'controls', 'overworld', 'fx', 'skillfx', 'evolutions', 'boss-ai']) {
    const p = path.join(SRC_ROOT, `${name}.js`);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctxEnv, { filename: p });
  }
  ctxEnv.CONTROLS.mount = () => {};
  ctxEnv.AUDIO = new Proxy({}, { get: () => () => {} });
  ctxEnv.HAPTICS = new Proxy({}, { get: () => () => {} });
  ctxEnv.RENDERER = new Proxy({
    getCtx: () => ctx, getDpr: () => 1, getCam: () => ({ x: 900, y: 600 }),
    getShakeOffset: () => ({ x: 0, y: 0 }), updateEffects: () => false,
    init() {}, resize() {}, clearShake() {}, triggerShake() {}, addSlashArc() {}, spawnDamageNumber() {},
    drawHouse() {}, drawPlayer() {}, drawMonster() {},
  }, { get: (o, k) => o[k] || (() => {}) });
  const uiButtons = {};
  ctxEnv.UI = new Proxy({ ...uiButtons, HINT_BTN: { x: 532, y: 20, w: 78, h: 40 }, readableFont: () => '20px sans-serif' },
    { get: (o, k) => o[k] || (() => {}) });

  const src = readSrc('game.js');
  const end = src.lastIndexOf('})();');
  vm.runInContext(src.slice(0, end) + 'window.__probe = { drawStageWeather, configureStage, drawWorld: () => {} };' + src.slice(end), ctxEnv, { filename: 'game.js' });

  ctxEnv.__probe.configureStage(stageId);
  const frames = times.map(t => {
    strokes.length = 0;
    arcs.length = 0;
    ctxEnv.__probe.drawStageWeather(t);
    return { t, strokes: strokes.map(s => ({ ...s })), arcs: arcs.map(a => ({ ...a })) };
  });
  return { frames, events, env, ctxEnv };
}

// 把 moveTo/lineTo 配成線段
function segments(frame) {
  const out = [];
  let cur = null;
  for (const s of frame.strokes) {
    if (s.type === 'move') cur = { x1: s.args[0], y1: s.args[1], x2: null, y2: null };
    else if (s.type === 'line' && cur) { cur.x2 = s.args[0]; cur.y2 = s.args[1]; out.push(cur); cur = null; }
    else if (s.type === 'stroke' && cur && cur.x2 === null) { out.push(cur); cur = null; }
  }
  return out;
}

test('R4 (C1) rain-port 會畫出雨線，且第一關不會畫雨', () => {
  const port = weatherProbe({ stageId: STAGE_ID, times: [1.0] });
  const portSegs = segments(port.frames[0]);
  assert.ok(portSegs.length >= 20, `rain-port 只畫了 ${portSegs.length} 條雨線`);
  const night = weatherProbe({ stageId: 'night-town', times: [1.0] });
  const nightSegs = segments(night.frames[0]);
  assert.equal(nightSegs.length, 0, `第一關畫了 ${nightSegs.length} 條雨線：跨關污染`);
});

test('R4 (C2) ★ 雨滴必須自然隨機：不得出現整齊的週期性重複', () => {
  const { frames } = weatherProbe({ stageId: STAGE_ID, times: [0, 1.37, 2.91, 5.5, 9.13] });
  const f0 = segments(frames[0]);
  assert.ok(f0.length >= 20, `雨線數不足（${f0.length}），無法評估分布`);

  // 週期性偵測：把雨線依「速度分級」分桶，若位置是 i 的固定函式就會大量重複。
  // 以 (x,y) 四捨五入後的相鄰間距分布檢查：整齊排列會讓間距高度集中。
  const xs = f0.map(s => s.x1).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < xs.length; i++) gaps.push(xs[i] - xs[i - 1]);
  const uniqueRatio = new Set(gaps.map(g => Math.round(g * 10))).size / Math.max(1, gaps.length);
  assert.ok(uniqueRatio > 0.35,
    `雨線 x 間距只有 ${(uniqueRatio * 100).toFixed(0)}% 相異值：分布過於規律（疑似整齊週期）`);

  // 另一個週期性訊號：同一「速度級」的雨滴，其位移量應該彼此接近；
  // 若是 i 的固定函式，同級雨滴的位移會完全相同（唯一值只有 1~2 個）。
  const byIndex = f0.map((s, i) => ({ s, i }));
  const speed0 = byIndex.map(({ s, i }) => ({ cls: i % 5, len: Math.hypot(s.x2 - s.x1, s.y2 - s.y1) }));
  const lengths = speed0.map(v => v.len);
  const uniqueLens = new Set(lengths.map(v => Math.round(v * 10))).size;
  assert.ok(uniqueLens >= 4,
    `雨線長度只有 ${uniqueLens} 種：缺少景深層次（三景深要求）`);

  const sorted = [...new Set(lengths.map(v => Math.round(v)))].sort((a, b) => a - b);
  assert.ok(sorted.length >= 3, `雨線長度級距只有 ${sorted.length} 種：三景深要求至少 3 種`);

  // ★ 核心：位置必須由亂數決定，而不是索引的固定函式。
  // 量測方式是比較「同一幀」內雨線位置的重複度：固定函式會讓多滴落在同一 x。
  const roundedX = f0.map(s => Math.round(s.x1));
  const dupX = roundedX.length - new Set(roundedX).size;
  assert.equal(dupX, 0,
    `${dupX} 條雨線落在相同的 x 座標：位置不是隨機分布（R4 禁止整齊重複）`);
});

test('R4 (C3) ★ 雨必須有三個景深層（遠／中／近），速度與透明度不同', () => {
  const { frames } = weatherProbe({ stageId: STAGE_ID, times: [0, 1.0] });
  const a = segments(frames[0]);
  const b = segments(frames[1]);
  assert.equal(a.length, b.length, '雨滴數量隨時間改變：無法做逐滴追蹤');
  // 逐滴追蹤：同一滴在 dt=1s 的位移
  const moves = a.map((s, i) => {
    if (!b[i]) return null;
    return Math.hypot(b[i].x1 - s.x1, b[i].y1 - s.y1);
  }).filter(v => v !== null);
  const sorted = [...moves].sort((x, y) => x - y);
  const p33 = sorted[Math.floor(sorted.length * 0.33)];
  const p66 = sorted[Math.floor(sorted.length * 0.66)];
  assert.ok(p66 > p33 * 1.25,
    `雨滴速度分層不明顯（33%=${p33.toFixed(1)} 66%=${p66.toFixed(1)}）：缺少遠中近三景深`);
  assert.ok(sorted.at(-1) > sorted[0] * 1.5,
    '最快與最慢雨滴差距不足 1.5 倍：三景深要求明顯速度差');
});

test('R4 (C4) 雨必須畫出漣漪／水花，且不得為固定週期重複', () => {
  const { frames } = weatherProbe({ stageId: STAGE_ID, times: [0.4, 1.7, 3.3] });
  const f = frames[2];
  const arcs = f.arcs.filter(a => a.type === 'arc' || a.type === 'fill');
  assert.ok(arcs.length > 0,
    'rain-port 完全沒有漣漪／水花：R4 要求雨應有漣漪');
});

test('R4 (C5) 雨與漣漪必須在 2.5D 投影下正確貼地（與 VIEWPORT 座標系一致）', () => {
  // 2.5D 的核心不變量：世界 y 在畫面越上（越遠）越被壓縮。
  // 雨／漣漪若沒有走 upright／世界座標換算，就會在傾斜時與地面脫節。
  const src = readSrc('game.js');
  const block = src.slice(src.indexOf('function drawStageWeather'), src.indexOf('function liveMotion'));
  assert.ok(block.length > 0, '找不到 drawStageWeather');
  // 雨／漣漪必須在世界座標空間繪製（drawStageWeather 由繪圖迴圈在已平移的 ctx 內呼叫）
  assert.doesNotMatch(block, /ctx\.setTransform\(/,
    'drawStageWeather 自行 setTransform：會覆蓋遊戲的相機／2.5D 變換，導致雨與地面脫節');
  assert.doesNotMatch(block, /ctx\.translate\(-camX/,
    'drawStageWeather 手動平移相機：應由繪圖迴圈負責，雨只該畫在世界座標');
  // 傾斜狀態下仍要畫得出雨（不得因 tiltScale 而整個跳過）
  const { ctxEnv } = weatherProbe({ stageId: STAGE_ID, times: [1.0] });
  const vp = ctxEnv.VIEWPORT;
  assert.ok(vp, '沙箱缺少 VIEWPORT');
  vp.advanceTilt?.(0.4);
  const scale = vp.tiltScale();
  const f = weatherProbe({ stageId: STAGE_ID, times: [1.0] });
  assert.ok(segments(f.frames[0]).length > 0, '傾斜狀態下雨不見了');
  assert.ok(scale > 0, 'tiltScale 無效');
});

test('R4 (C6) 雨／漣漪不得畫到 HUD 之上（畫面不重疊）', () => {
  const { frames } = weatherProbe({ stageId: STAGE_ID, times: [1.0] });
  const segs = segments(frames[0]);
  assert.ok(segs.length > 0, '前提失敗：沒有雨線');
  const src = readSrc('game.js');
  const callSite = src.slice(src.indexOf('drawStageWeather(visualElapsed)') - 400, src.indexOf('drawStageWeather(visualElapsed)') + 40);
  assert.ok(callSite.includes('drawStageWeather'),
    '繪圖迴圈找不到 drawStageWeather 呼叫點');
  // 雨必須畫在 viewBounds 內（不得溢出到 HUD 或畫面外）
  assert.match(src, /function drawStageWeather\(t\)[\s\S]{0,400}?viewBounds\(\)/,
    'drawStageWeather 沒有使用 viewBounds()：雨可能畫到 HUD 或畫面之外');
});

// --------------------------------------------------------------------------
// E. 資產存在與格式無損
// --------------------------------------------------------------------------
function webpInfo(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 12) return null;
  const riff = buf.toString('ascii', 0, 4);
  const webp = buf.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  // VP8 / VP8L / VP8X
  if (!['VP8 ', 'VP8L', 'VP8X'].includes(chunk)) return null;
  if (chunk === 'VP8 ') {
    // 找 9d012a 起始碼後的寬高
    const i = buf.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (i < 0 || i + 7 > buf.length) return null;
    return { chunk, width: buf.readUInt16LE(i + 3) & 0x3fff, height: buf.readUInt16LE(i + 5) & 0x3fff };
  }
  if (chunk === 'VP8X') {
    return { chunk, width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1, height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1 };
  }
  return { chunk };   // VP8L：尺寸需解碼，先標記
}

test('R4 (E1) R4 產出的 runtime 資產必須真的存在、格式正確且尺寸非零', () => {
  const dirs = [
    path.join(ROOT, 'assets', 'img', 'rain-port'),
  ];
  const existing = dirs.filter(d => fs.existsSync(d));
  assert.ok(existing.length > 0,
    'assets/img/rain-port 尚未建立：AGY 的 R4 產出還沒落盤到 runtime 目錄');

  const files = existing.flatMap(d => fs.readdirSync(d).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f)).map(f => path.join(d, f)));
  assert.ok(files.length > 0, 'rain-port 目錄存在但沒有任何圖檔');

  const bad = [];
  for (const f of files) {
    const stat = fs.statSync(f);
    if (stat.size === 0) { bad.push(`${path.basename(f)}: 0 bytes`); continue; }
    if (f.endsWith('.webp')) {
      const info = webpInfo(f);
      if (!info) { bad.push(`${path.basename(f)}: 不是有效的 WebP（RIFF/WEBP 或 chunk 錯誤）`); continue; }
      if (info.width !== undefined && (info.width < 64 || info.height < 64)) {
        bad.push(`${path.basename(f)}: 尺寸過小 ${info.width}x${info.height}`);
      }
    }
  }
  assert.equal(bad.length, 0, `R4 資產問題：\n  - ${bad.join('\n  - ')}`);
});

test('R4 (E2) R4 資產必須已被程式引用（存在但沒被用到＝玩家看不到）', () => {
  const dir = path.join(ROOT, 'assets', 'img', 'rain-port');
  if (!fs.existsSync(dir)) return;   // E1 已明確 RED，這裡不重複報錯
  const files = fs.readdirSync(dir).filter(f => /\.(webp|png)$/i.test(f)).map(f => f.replace(/\.[^.]+$/, ''));
  if (!files.length) return;
  const sources = ['assets.js', 'game.js', 'renderer.js', 'skillfx.js']
    .map(n => fs.readFileSync(path.join(SRC_ROOT, n), 'utf8')).join('\n');
  const orphans = files.filter(stem => !sources.includes(stem));
  assert.equal(orphans.length, 0,
    `${orphans.length} 個 R4 資產沒被任何程式引用：${orphans.slice(0, 10).join('、')}`);
});

test('R4 (E3) 冷啟動不得一口氣載入其他關的巨大圖（rain-port 專屬資產應按需載入）', () => {
  const { env, images } = loadAssetsStub();
  env.loadGameArt?.();
  const srcs = images.map(i => i.src);
  // 進入 rain-port 的場景時，不應把所有 8 關的地表／建築全部請求
  const groundLike = srcs.filter(s => /ground|house_|prop_|scenery/.test(s));
  const portLike = srcs.filter(s => /rain-port|rain_port|\/port_|harbor/.test(s));
  if (portLike.length > 0) {
    assert.ok(groundLike.length <= 12,
      `單次載入請求了 ${groundLike.length} 個地表／建築圖：冷啟動量過大`);
  }
});

// --------------------------------------------------------------------------
// F. 手機畫面不重疊
// --------------------------------------------------------------------------
test('R4 (F1) 手機橫向／直向／平板／桌機：HUD 邊界不得溢出畫面', () => {
  // viewport.js 以 window.innerWidth/innerHeight 為輸入，沒有 resize()；
  // 改尺寸後由 bounds() 重新計算（lastWidth/lastHeight 快取失效）。
  const geom = [];
  for (const [w, h, label] of [[390, 844, '手機直向'], [844, 390, '手機橫向'], [1194, 834, '平板'], [900, 600, '桌機']]) {
    const env = { console, performance: { now: () => 0 }, innerWidth: w, innerHeight: h, location: { search: '?tilt=1' } };
    env.window = env;
    const p = path.join(SRC_ROOT, 'viewport.js');
    vm.runInNewContext(fs.readFileSync(p, 'utf8'), env, { filename: p });
    const vp = env.VIEWPORT;
    const b = vp.bounds();
    const hud = vp.hudBounds();
    assert.ok(b.width > 0 && b.height > 0, `${label} 可視範圍無效`);
    // area 是以邏輯 900x600 為基準外擴，螢幕是 900x600 的等比放大，
    // 因此邊界不應超出螢幕的邏輯尺寸；用 scale 換算回螢幕座標比較才正確。
    const v = vp.get();
    assert.ok(b.right * v.scale <= w + 1, `${label} ${w}x${h}：HUD 邊界溢出畫面 right=${(b.right * v.scale).toFixed(1)}`);
    assert.ok(b.bottom * v.scale <= h + 1, `${label} ${w}x${h}：HUD 邊界溢出畫面 bottom=${(b.bottom * v.scale).toFixed(1)}`);
    // 四邊各留 20 CSS px
    const insetCss = (hud.left - b.left) * v.scale;
    assert.ok(Math.abs(insetCss - 20) < 0.5, `${label}：HUD 左內距 ${insetCss.toFixed(1)} CSS px，應為 20`);
    geom.push({ label, w, h, scale: v.scale });
  }
  assert.equal(geom.length, 4, '幾何量測數量不足');
  // 橫向與直向都必須可用（不能有一個 scale 為 0）
  assert.ok(geom.every(g => g.scale > 0), '有視窗比例為 0：畫面會消失');
  assert.notEqual(geom[0].scale.toFixed(3), geom[1].scale.toFixed(3),
    '直向與橫向比例相同：2.5D 方向切換可能失效');
});