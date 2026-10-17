"use strict";

// R16 C4 純收藏套卡：公開 API 資料面驗收（E15-01，2026-10-15）
//
// 定位：C4 資料面 runtime 已接上。本檔核對契約行為。
//       --strict 時 RED／FAIL／BLOCKED 任一 > 0 即未過門。
//       這不是 C3 的產品結論，也不是美術或真機核准。
// 邊界：只讀 card-collection／card-delivery-bridge／card-gallery-model（不讀 js/game.js）。
//       不改任何 production、不讀音訊／金鑰、不呼叫 TTS/API、無 git 寫入、無 Chrome。
// 輸出：artifacts/validation/e15-grok-r16-20261015/evidence.json
//       不覆蓋 artifacts/validation/spacebunny-r16-c4-20261014/ 的歷史原件。
//
// 公開可觀測邊界（docs/c4-rewards-runtime-contract-20261014.md 第 15 行）：
//   CARD_DELIVERY.openCards(storage, loc, packs?)   第三參數可傳真 pack 陣列；省略時用 CONTENT.WORD_PACKS
//   record(event) 成功結果帶 newAwards: [packId,...]（失敗／duplicate／Boss／未達成為空）
//   snapshot().awards 是 boolean true map，持久化用同欄、同卡鍵
//   資料投影可用 CARD_COLLECTION.completeSets(packs, marks) 或 CARD_GALLERY.packSets（不硬編內部名）
//
// 所有卡檔印記皆為**人工 fixture**，非自然遊玩收集。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/validation/e15-grok-r16-20261015');
const CONTRACT = path.join(ROOT, 'docs/c4-rewards-runtime-contract-20261014.md');
const READ_ONLY_FILES = ['js/card-collection.js', 'js/card-delivery-bridge.js', 'js/card-gallery-model.js'];

const sha = f => { const p = path.join(ROOT, f); return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null; };
const hashes = () => Object.fromEntries(READ_ONLY_FILES.map(f => [f, sha(f)]));

const results = [];
const lines = [];
const log = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); };
const rec = (id, status, d = {}) => { results.push({ id, status, ...d }); log(`[${status}] ${id}${d.note ? ' — ' + d.note : ''}`); };
const red = (id, d) => rec(id, 'RED', d);
const pass = (id, d) => rec(id, 'PASS', d);
const fail = (id, d) => rec(id, 'FAIL', d);
const blocked = (id, d) => rec(id, 'BLOCKED', d);
const human = (id, d) => rec(id, 'HUMAN_REVIEW', d);

const core = require('../js/card-collection.js');
const bridge = require('../js/card-delivery-bridge.js');
const gallery = require('../js/card-gallery-model.js');
const CONTENT = require('../js/words.js');

const OFFICIAL = 'yokai-delivery-cards-v1';
const DEV = 'yokai-delivery-dev-cards-v1';
const LEARNING = 'yokai-delivery-v1';

// 正式驗收帶 --strict：RED／FAIL／BLOCKED 任一 > 0 就 exit 1。
// 未帶 --strict 時仍只在 FAIL>0 時 exit 1，不改歷史 runner 的退出碼規則。
const STRICT = process.argv.includes('--strict');

// ───────────────────────────────────────────── 人工 fixture 的記憶體存檔
function memStorage(seed) {
  const data = Object.assign({}, seed || {});
  const writes = [];
  return {
    data, writes,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { writes.push({ key: k, len: String(v).length }); data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    snapshotKeys: () => Object.keys(data),
  };
}
// 官方/dev/dev?dev 三種位置
const locOfficial = { hostname: '127.0.0.1', search: '' };
const locDev = { hostname: '127.0.0.1', search: '?dev=1' };

// 供 evidence 用的動態欄位偵測（不再硬寫 'absent'）。放在 loc 定義之後避免 TDZ。
const apiFieldProbe = (() => {
  try {
    const st = { data: {}, getItem: () => JSON.stringify({ v: 1, marks: {}, events: {} }), setItem() { }, removeItem() { } };
    const op = bridge.openCards(st, locOfficial);
    const rec = op.record({ id: 'probe-1', kind: 'delivery', ok: true, jp: 'ねこ' });
    const snap = typeof op.snapshot === 'function' ? op.snapshot() : null;
    return {
      newAwards: !!(rec && 'newAwards' in rec),
      awards: !!(snap && 'awards' in snap),
      persisted: rec && 'persisted' in rec ? rec.persisted : '(無此欄位)',
    };
  } catch (e) { return { newAwards: null, awards: null, persisted: `(probe throw: ${e.message})` }; }
})();

// ───────────────────────────────────────────── 真詞包（人工選取，不是自然收集）
const ALL_PACKS = Object.values(CONTENT.WORD_PACKS || {});
const packOf = id => ALL_PACKS.find(p => p.id === id);
// 有效 jp：排除 decoy、NFC 去重（與契約第 1 行一致）
function effectiveWords(pack) {
  const seen = new Set();
  const out = [];
  for (const w of (pack && pack.words) || []) {
    if (!w || w.decoy === true) continue;
    const key = core.wordKey(w.jp);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
const smallestPack = ALL_PACKS.map(p => ({ p, n: effectiveWords(p).length })).sort((a, b) => a.n - b.n)[0];

// ───────────────────────────────────────────── 公開 API 發現（不硬編內部名）
const projection = core && typeof core.completeSets === 'function'
  ? { where: 'CARD_COLLECTION.completeSets', fn: core.completeSets }
  : (gallery && typeof gallery.packSets === 'function'
    ? { where: 'CARD_GALLERY.packSets', fn: gallery.packSets }
    : null);

function openWith(storage, loc, packs) {
  // 第三參數可有可無；不論有無都要能在只支援兩參數時退化
  return packs === undefined
    ? bridge.openCards(storage, loc)
    : bridge.openCards(storage, loc, packs);
}
function awardOf(opened) {
  const snap = typeof opened.snapshot === 'function' ? opened.snapshot() : null;
  return { snapshotAwards: snap && snap.awards ? snap.awards : null, hasNewAwardsField: null };
}

// ───────────────────────────────────────────── 案例（8–12 列公開 API 資料面）
function cases() {
  // 動態欄位偵測結果。status 必須是字串：要呼叫 pass／red，不能把函式本身傳進 rec。
  const probed = apiFieldProbe;
  (probed.newAwards && probed.awards ? pass : red)('R16-00-api-field-probe', {
    note: `現行公開資料面探測：record() 有 newAwards 欄位=${probed.newAwards}、snapshot() 有 awards 欄位=${probed.awards}、record() 的 persisted=${JSON.stringify(probed.persisted)}。兩欄都在才是 PASS；缺欄為 RED。`,
    evidence: probed,
  });

  // R16-01 資料投影存在，且對應真 32 包／164 詞
  {
    const id = 'R16-01-pack-projection-exists';
    if (!projection) {
      red(id, { note: `找不到套卡資料投影 API（試過 CARD_COLLECTION.completeSets 與 CARD_GALLERY.packSets 都沒有）。`, evidence: { coreHasCompleteSets: typeof core.completeSets, galleryHasPackSets: typeof gallery.packSets } });
    } else {
      try {
        const marks = {};
        const sets = projection.fn(ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })), marks);
        const list = Array.isArray(sets) ? sets : [];
        const totalWords = ALL_PACKS.reduce((n, p) => n + effectiveWords(p).length, 0);
        const ok = list.length === ALL_PACKS.length && totalWords === CONTENT.getAllWords().length;
        (ok ? pass : fail)(id, { note: `${projection.where} 回 ${list.length} 組、有效詞合計 ${totalWords}（期望 ${ALL_PACKS.length} 包／${CONTENT.getAllWords().length} 詞）。`, evidence: { sets: list.slice(0, 3), packs: ALL_PACKS.length, totalWords } });
      } catch (e) { red(id, { note: `${projection.where} 呼叫失敗：${e.message}`, evidence: { stack: e.stack } }); }
    }
  }

  // R16-02 最後一字 3→4 由真 record 成功觸發單次 award
  {
    const id = 'R16-02-last-word-triggers-single-award';
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    if (words.length < 1) { blocked(id, { note: '找不到有效詞的詞包' }); }
    else {
      const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
      const doc = JSON.stringify({ v: 1, marks, events: {} });
      const store = memStorage({ [OFFICIAL]: doc });
      const opened = openWith(store, locOfficial, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
      const res = opened.record({ id: 'evt-final', kind: 'delivery', ok: true, jp: words[words.length - 1] });
      const newAwards = res && Array.isArray(res.newAwards) ? res.newAwards : null;
      (newAwards && newAwards.length === 1 && newAwards[0] === pack.id
        ? pass
        : red)(id, {
        note: `把最後一字從 3 補到 4 後 record 成功 → newAwards=${JSON.stringify(newAwards)}（期望恰好 [${pack.id}]）。${newAwards ? '' : 'record 結果沒有 newAwards 陣列，契約未滿足。'}`,
        evidence: { packId: pack.id, words, res, storeWrites: store.writes },
      });
      // snapshot().awards 也要是 boolean map
      const snap = typeof opened.snapshot === 'function' ? opened.snapshot() : null;
      const aw = snap && snap.awards;
      (aw && typeof aw === 'object' && aw[pack.id] === true
        ? pass
        : red)(`R16-02b-snapshot-awards-boolean-map`, {
        note: `snapshot().awards = ${JSON.stringify(aw)}（期望 {${JSON.stringify(pack.id)}: true} 的 boolean map）。`,
        evidence: { snapshot: snap, awards: aw },
      });
      // 持久化欄位名是 awards，且用同卡鍵
      const persisted = store.data[OFFICIAL] ? JSON.parse(store.data[OFFICIAL]) : null;
      (persisted && persisted.awards && persisted.awards[pack.id] === true
        ? pass
        : red)(`R16-02c-awards-persisted-under-same-key`, {
        note: `存檔 ${OFFICIAL} 內的 awards 欄位 = ${JSON.stringify(persisted && persisted.awards)}；寫入紀錄鍵 ${JSON.stringify(store.writes.map(w => w.key))}。`,
        evidence: { persisted, writes: store.writes },
      });
    }
  }

  // R16-03 失敗 / duplicate / Boss 不得發獎
  // 契約第 19 行：既有 delivery assisted 成功可計印、Boss kind 被 parseEvent 拒絕不是缺陷。
  // Boss / duplicate 兩腿以行為判定（applied:false 即未發獎）。
  // 失敗但已 applied 的那一腿，newAwards 必須是空陣列。
  {
    const id = 'R16-03-no-award-on-fail-duplicate-boss';
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach(w => { marks[w] = 3; });
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: { 'evt-old': true } }) });
    const opened = openWith(store, locOfficial, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
    const noAwardByBehaviour = r => !!(r && r.applied === false && (!Array.isArray(r.newAwards) || r.newAwards.length === 0));
    const noAwardByField = r => !!(r && Array.isArray(r.newAwards) && r.newAwards.length === 0);

    const dupRes = opened.record({ id: 'evt-old', kind: 'delivery', ok: true, jp: words[0] });   // 已存在 event id
    const bossRes = opened.record({ id: 'evt-boss', kind: 'boss', ok: true, jp: words[0] });    // kind 非 delivery
    (noAwardByBehaviour(dupRes) ? pass : red)(`${id}-duplicate`, {
      note: `重複 event：applied=${JSON.stringify(dupRes && dupRes.applied)}、reason=${JSON.stringify(dupRes && dupRes.reason)}、newAwards=${JSON.stringify(dupRes && dupRes.newAwards)} → 以行為判定「未發獎」。`,
      evidence: { dupRes },
    });
    (noAwardByBehaviour(bossRes) ? pass : red)(`${id}-boss-kind-rejected`, {
      note: `Boss 事件（kind='boss'）：applied=${JSON.stringify(bossRes && bossRes.applied)}、reason=${JSON.stringify(bossRes && bossRes.reason)}。契約第 19 行明示 parseEvent 拒絕 Boss **不是缺陷**，此處以行為判定通過。`,
      evidence: { bossRes },
    });
    const failRes = opened.record({ id: 'evt-fail', kind: 'delivery', ok: false, jp: words[0] });   // applied:true, reason:'fail'
    (noAwardByField(failRes) ? pass : red)(`${id}-failed-delivery`, {
      note: `失敗配送（applied=${JSON.stringify(failRes && failRes.applied)}、reason=${JSON.stringify(failRes && failRes.reason)}）：newAwards=${JSON.stringify(failRes && failRes.newAwards)}，必須是空陣列。`,
      evidence: { failRes },
    });
  }

  // R16-04 assisted 成功應計入。
  // 動物街三字若全是 3 印、只把第一字補成 4，套卡仍是 1/3，不得期待整包。
  // 其他字 4 印、只留最後一字 3 印，再送 assisted，才是整包達成。
  {
    const id = 'R16-04-assisted-success-counts';
    const pack = packOf('animals') || smallestPack.p;
    const words = effectiveWords(pack);
    if (words.length < 2) {
      blocked(id, { note: `有效詞不足，無法擺「其他字 4、最後一字 3」：${JSON.stringify(words)}` });
    } else {
      const last = words[words.length - 1];
      const marks = {};
      words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
      const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
      const opened = openWith(store, locOfficial, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
      const res = opened.record({ id: 'evt-assist', kind: 'delivery', ok: true, assisted: true, jp: last });
      const newAwards = res && Array.isArray(res.newAwards) ? res.newAwards : null;
      const awarded = !!(newAwards && newAwards.length === 1 && newAwards[0] === pack.id);
      const marksAfter = opened.snapshot && opened.snapshot().marks;
      (awarded ? pass : red)(id, {
        note: `「${pack.id}」其他字 4 印、最後一字「${last}」原 3 印，assisted 成功 → newAwards=${JSON.stringify(newAwards)}（期望恰好 [${pack.id}]）。契約第 2／3 行：全包每字 ≥4 才 complete，assisted 計入。事後印記 ${JSON.stringify(marksAfter)}。`,
        evidence: { packId: pack.id, words, marksBefore: marks, res, marksAfter },
      });
    }
  }

  // R16-05 空包 / decoy / NFC 去重
  {
    const id = 'R16-05-empty-decoy-nfc-dedup';
    const emptyPack = { id: 'r16-empty', name: '空包', words: [] };
    const decoyPack = {
      id: 'r16-decoy', name: '干擾包',
      words: [
        { id: 'd:0', packId: 'r16-decoy', jp: 'バス', zh: '公車', decoy: true },
        { id: 'd:1', packId: 'r16-decoy', jp: 'が', zh: '甲' },
        { id: 'd:2', packId: 'r16-decoy', jp: 'か\u3099', zh: '甲' },     // 分解形，應與上一筆合併
      ],
    };
    const passed = [];
    try {
      const sets = projection ? projection.fn([emptyPack, decoyPack], {}) : null;
      if (!sets) { red(id, { note: '無資料投影 API，無法驗證空包／decoy／NFC 去重。' }); }
      else {
        const list = Array.isArray(sets) ? sets : [];
        const empty = list.find(s => s.id === 'r16-empty');
        const decoy = list.find(s => s.id === 'r16-decoy');
        const emptyOk = !empty || empty.total === 0 || empty.complete === false;
        const decoyTotal = decoy ? decoy.total : null;
        const decoyOk = decoyTotal === 1;                    // 1 個有效字（が／か+゙ 合併）
        (emptyOk && decoyOk ? pass : red)(id, { note: `空包 total=${empty && empty.total} complete=${empty && empty.complete}（必須不達成）；干擾包 total=${decoyTotal}（期望 1：排除 decoy、が／が NFC 去重）。`, evidence: { empty, decoy } });
        passed.push(1);
      }
    } catch (e) { red(id, { note: `投影失敗：${e.message}`, evidence: { stack: e.stack } }); }
  }

  // R16-06 單次 record 多包補領。
  // 舊弱斷言（問題保留，不再當通過條件）：兩包有效詞全是 3 印，只送 ka[0]。
  // 兩包都未完成，newAwards=[]。空陣列是 truthy，`got && noDup` 仍 PASS，沒驗到多包。
  // 現在兩真小包的有效 NFC 詞都已 4 印、awards 空。下一次成功 record 須補領這兩個 packId 且不重複。
  // catalog 只含這兩包。這不是一個字讓不相干的包同時變滿；record 前兩包就已經全滿。
  {
    const id = 'R16-06-single-record-multi-pack-backfill';
    const pair = ALL_PACKS
      .map(p => ({ p, words: effectiveWords(p) }))
      .filter(x => x.words.length > 0)
      .sort((a, b) => a.words.length - b.words.length || String(a.p.id).localeCompare(String(b.p.id)))
      .slice(0, 2);
    if (pair.length < 2) blocked(id, { note: '找不到兩個有有效詞的真詞包' });
    else {
      const [a, b] = pair;
      const marks = {};
      for (const w of a.words) marks[w] = 4;
      for (const w of b.words) marks[w] = 4;
      const catalog = [a.p, b.p].map(p => ({ id: p.id, name: p.name, words: p.words }));
      const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
      const opened = openWith(store, locOfficial, catalog);
      const res = opened.record({ id: 'evt-backfill-two', kind: 'delivery', ok: true, jp: a.words[0] });
      const got = res && Array.isArray(res.newAwards) ? res.newAwards : null;
      const expected = [a.p.id, b.p.id];
      const noDup = !!(got && new Set(got).size === got.length);
      const hasBoth = !!(got && expected.every(packId => got.includes(packId)));
      const onlyThese = !!(got && got.length === expected.length && got.every(packId => expected.includes(packId)));
      (hasBoth && noDup && onlyThese ? pass : red)(id, {
        note: `舊檔「${expected.join('、')}」有效 NFC 詞皆已 4 印、awards 空。下一次成功 record（${a.words[0]}）補領 newAwards=${JSON.stringify(got)}（須正好這兩個 packId 且不重複）。不是單字把不相干的包同時補滿。`,
        evidence: {
          packs: expected,
          catalogIds: catalog.map(p => p.id),
          wordRecorded: a.words[0],
          got,
          noDup,
          priorWeakAssertion: 'ka/kb 全 3 印且只送 ka[0] 時 newAwards=[]，空陣列仍被 got && noDup 判 PASS',
        },
      });
    }
  }

  // R16-07 下一次配送後，再次 openCards（reopen）仍讀到已保存的 awards。
  // reopen 是同一個模組對同一 storage 再呼叫 openCards，不是真 module reload，也不是真頁重載。
  {
    const id = 'R16-07-awards-persist-across-delivery-and-reopen';
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
    const packsArg = ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words }));
    const opened = openWith(store, locOfficial, packsArg);
    opened.record({ id: 'evt-a', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const next = opened.record({ id: 'evt-b', kind: 'delivery', ok: true, jp: words[0] });
    const reopened = bridge.openCards(store, locOfficial);
    const snap = reopened.snapshot && reopened.snapshot();
    const kept = !!(snap && snap.awards && snap.awards[pack.id] === true);
    const noDouble = !(next && Array.isArray(next.newAwards) && next.newAwards.length > 0);
    (kept && noDouble ? pass : red)(id, {
      note: `補領後再做一次成功配送 newAwards=${JSON.stringify(next && next.newAwards)}（應空，不可重複發）；reopen（再次 openCards，同一 storage，兩參數，不是真頁重載、也不是重載模組）後 awards 仍保留 ${JSON.stringify(snap && snap.awards)}。`,
      evidence: { packId: pack.id, next, snapshotAwards: snap && snap.awards, reopen: true, moduleReloaded: false, pageReloaded: false },
    });
  }

  // R16-08 舊檔已滿但無 awards 紀錄 → 下次成功配送補領
  {
    const id = 'R16-08-legacy-full-card-backfill';
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach(w => { marks[w] = 4; });       // 舊檔全滿、但沒有 awards
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });   // 無 awards 欄位
    const opened = openWith(store, locOfficial, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
    const res = opened.record({ id: 'evt-legacy', kind: 'delivery', ok: true, jp: words[0] });
    const got = res && Array.isArray(res.newAwards) ? res.newAwards : null;
    (got && got.includes(pack.id) ? pass : red)(id, {
      note: `舊檔已全滿（無 awards）後做一次成功配送 → newAwards=${JSON.stringify(got)}（應補領 [${pack.id}]，使用者不重做已滿卡）。`,
      evidence: { packId: pack.id, got },
    });
  }

  // R16-09 official / dev / ?dev 隔離
  {
    const id = 'R16-09-official-dev-isolation';
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const packsArg = ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words }));
    const offStore = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
    const devStore = memStorage({ [DEV]: JSON.stringify({ v: 1, marks, events: {} }) });
    const off = openWith(offStore, locOfficial, packsArg);
    const dev = openWith(devStore, locDev, packsArg);
    const offRes = off.record({ id: 'same-id', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const devRes = dev.record({ id: 'same-id', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const keys = offStore.snapshotKeys().concat(devStore.snapshotKeys());
    const crossed = offStore.writes.some(w => w.key === DEV) || devStore.writes.some(w => w.key === OFFICIAL);
    const bothAwarded = !!(offRes && offRes.newAwards && offRes.newAwards.length) && !!(devRes && devRes.newAwards && devRes.newAwards.length);
    (!crossed && bothAwarded ? pass : red)(id, {
      note: `正式與 dev 各自補領：official newAwards=${JSON.stringify(offRes && offRes.newAwards)}、dev newAwards=${JSON.stringify(devRes && devRes.newAwards)}；是否跨鍵寫入=${crossed}（必須 false）。`,
      evidence: { offRes, devRes, crossed, keys, storageKeys: { off: offStore.snapshotKeys(), dev: devStore.snapshotKeys() } },
    });
  }

  // R16-10 不得動 learning 鍵、不得加戰力
  {
    const id = 'R16-10-learning-key-untouched';
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const learningSeed = { v: 1, xp: 123, box: { 'ねこ': 4 } };
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }), [LEARNING]: JSON.stringify(learningSeed) });
    const opened = openWith(store, locOfficial, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
    opened.record({ id: 'evt-learn', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const learningNow = store.data[LEARNING] ? JSON.parse(store.data[LEARNING]) : null;
    const touched = store.writes.some(w => w.key === LEARNING);
    const same = JSON.stringify(learningNow) === JSON.stringify(JSON.parse(JSON.stringify(learningSeed)));
    (!touched && same ? pass : red)(id, {
      note: `記錄一次成功配送後：learning 鍵被寫=${touched}（必須 false）、內容=${JSON.stringify(learningNow)}（應與原來相同；STORE 熟練 box 不得被當印記）。`,
      evidence: { touched, learningNow, writes: store.writes },
    });
  }

  // R16-11 真實內容計數對得上（32 包／164 詞，歷史 21 已過時）
  {
    const id = 'R16-11-real-pack-and-word-count';
    const packsCount = Object.keys(CONTENT.WORD_PACKS || {}).length;
    const orderCount = (CONTENT.PACK_ORDER || []).length;
    const wordCount = CONTENT.getAllWords().length;
    const sumWords = ALL_PACKS.reduce((n, p) => n + effectiveWords(p).length, 0);
    const stagesObj = CONTENT.STAGES && !Array.isArray(CONTENT.STAGES) && typeof CONTENT.STAGES === 'object';
    const hasWordPacks = !!(CONTENT.STAGES && CONTENT.STAGES['night-town'] && Array.isArray(CONTENT.STAGES['night-town'].wordPacks));
    const ok = packsCount === 32 && orderCount === 32 && wordCount === 164 && sumWords === 164 && stagesObj && hasWordPacks;
    (ok ? pass : red)(id, {
      note: `WORD_PACKS=${packsCount}、PACK_ORDER=${orderCount}、getAllWords()=${wordCount}、有效詞合計=${sumWords}；STAGES 為 object=${stagesObj}、stage.wordPacks 為 array=${hasWordPacks}。期望 32／32／164／164。`,
      evidence: { packsCount, orderCount, wordCount, sumWords, stagesObj, hasWordPacks },
    });
  }

  // R16-12 storage 語義：契約第 7 行逐項拆開驗（原本只有一籠統的「不中斷」，現依契約細化）
  // 契約第 7 行原文重點：
  //   (a) 已接受事件回 applied:true；(b) 寫入成功 persisted:true；
  //   (c) quota/security/serialization 失敗回 persisted:false 及精簡 storageError(name/message)；
  //   (d) 不得 throw 或冒稱已保存；(e) 當前 bag 保留記憶體 marks/events/awards 與去重；
  //   (f) 後續成功寫入可保存當前完整 snapshot，避免丟掉先前未保存印記；
  //   (g) 未 applied 的事件不寫 storage，回 persisted:null（此次無保存嘗試）。
  {
    const pack = smallestPack.p;
    const words = effectiveWords(pack);
    const lastWord = words[words.length - 1];
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const seed = JSON.stringify({ v: 1, marks, events: {} });

    // 可切換「拒絕／接受」的存檔：完整記錄每次寫入嘗試（含被拒的）
    function toggleStorage() {
      const s = {
        refuse: true, attempts: 0, writes: [], data: { [OFFICIAL]: seed },
        getItem(k) { return k === OFFICIAL ? seed : null; },
        setItem(k, v) {
          s.attempts++; s.writes.push({ key: k, len: String(v).length });
          if (s.refuse) { const e = new Error('quota exceeded'); e.name = 'QuotaExceededError'; throw e; }
          s.data[k] = String(v);
        },
        removeItem() { },
        persisted: () => { try { return JSON.parse(s.data[OFFICIAL]); } catch { return null; } },
      };
      return s;
    }
    const st = toggleStorage();

    // 先量「現行現作」：openCards 是否撐得住、record 是否被 storage 拋錯打斷
    let opened = null, first = null, threw = null;
    try {
      opened = bridge.openCards(st, locOfficial);
      first = opened.record({ id: 'evt-quota', kind: 'delivery', ok: true, jp: lastWord });
    } catch (e) {
      threw = { name: e.name, message: e.message };
    }

    const R = res => (res && typeof res === 'object') ? res : {};
    const obs = { threw, res: first, attempts: st.attempts, writes: st.writes.length, key: opened && opened.key };

    if (threw) {
      red('R16-12a-storage-rejection-does-not-throw', {
        note: `storage.setItem 拋 ${threw.name}: ${threw.message} 時 record 直接中斷 → 違反契約第 7 行「storage 拒絕仍不阻斷成功配送」。這是契約第 19 行點名的**現役真缺陷，優先修**。`,
        evidence: obs,
      });
      // 已經被 throw 打斷，後續 (c)(e)(f)(g) 無法在同一袋上驗，改標 RED 並說明
      for (const [sid, why] of [
        ['R16-12b-persisted-false-with-storageerror', 'record 在回傳前就 throw，觀察不到 persisted'],
        ['R16-12c-no-false-saved-claim', '同上'],
        ['R16-12d-bag-keeps-memory-and-dedup', 'bag 狀態未取得（record throw）'],
        ['R16-12e-later-success-saves-full-snapshot', '同上'],
        ['R16-12f-not-applied-returns-persisted-null', '同上'],
      ]) red(sid, { note: `${why}；根因見 R16-12a（record 未防護 storage 例外）。`, evidence: obs });
      return;
    }

    // (a)(c)(d)
    const r1 = R(first);
    (r1.applied === true
      ? pass
      : red)('R16-12a-storage-rejection-does-not-throw', {
      note: `setItem 拋錯時 record 未 throw，且 applied=${JSON.stringify(r1.applied)}（契約：已接受事件回 applied:true，不因存檔失敗而回滾）。`,
      evidence: obs,
    });
    (r1.persisted === false
      ? pass
      : red)('R16-12b-persisted-false-with-storageerror', {
      note: `persisted=${JSON.stringify(r1.persisted)}（契約第 7 行：quota 失敗必須回 persisted:false，不得冒稱已保存）。`,
      evidence: { persisted: r1.persisted, hasField: 'persisted' in r1 },
    });
    const se = R(r1.storageError);
    const seOk = typeof se.name === 'string' && se.name.length > 0 && typeof se.message === 'string'
      && se.name.length <= 64 && se.message.length <= 200;
    (seOk
      ? pass
      : red)('R16-12c-storageerror-name-message', {
      note: `storageError=${JSON.stringify(r1.storageError)}（契約要求精簡的 name/message；我採 name≤64、message≤200 字元當作「精簡」的判準，這是我的解讀而非契約明文）。`,
      evidence: { storageError: r1.storageError },
    });
    const attemptsBefore = st.attempts;

    // (e) bag 保留記憶體印記
    const memMark = opened.marks ? opened.marks(lastWord) : null;
    (memMark === 4
      ? pass
      : red)('R16-12d-bag-keeps-memory-mark-after-refusal', {
      note: `存檔被拒後 bag 記憶體仍記住「${lastWord}」=${memMark} 印（期望 4）→ 記憶體與持久化分離，不得因存檔失敗丟掉本次成功。`,
      evidence: { memMark, expected: 4 },
    });

    // (e)(g) 重複 event：記憶體去重仍在，且不得嘗試寫入、persisted 必須是 null
    let dup = null, dupThrew = null;
    try { dup = opened.record({ id: 'evt-quota', kind: 'delivery', ok: true, jp: lastWord }); }
    catch (e) { dupThrew = { name: e.name, message: e.message }; }
    const rd = R(dup);
    const noNewWrite = st.attempts === attemptsBefore;
    const dupOk = !dupThrew && rd.applied === false && rd.persisted === null && noNewWrite;
    (dupOk
      ? pass
      : red)('R16-12e-not-applied-returns-persisted-null', {
      note: `未 applied 的重複事件：applied=${JSON.stringify(rd.applied)}、reason=${JSON.stringify(rd.reason)}、persisted=${JSON.stringify(rd.persisted)}（契約：必須 null）、新增寫入嘗試=${st.attempts - attemptsBefore} 次（必須 0）${dupThrew ? '、throw=' + JSON.stringify(dupThrew) : ''}。`,
      evidence: { dup, dupThrew, attemptsDelta: st.attempts - attemptsBefore },
    });

    // (f) 恢復 setItem 後，下一次成功寫入要保存「當前完整 snapshot」（含先前未保存的印記）
    st.refuse = false;
    let later = null, laterThrew = null;
    try { later = opened.record({ id: 'evt-after-recovery', kind: 'delivery', ok: true, jp: words[0] }); }
    catch (e) { laterThrew = { name: e.name, message: e.message }; }
    const rl = R(later);
    const saved = st.persisted();
    const savedMark = saved && saved.marks ? saved.marks[core.wordKey(lastWord)] : null;
    const laterOk = !laterThrew && rl.applied === true && rl.persisted === true && savedMark === 4;
    (laterOk
      ? pass
      : red)('R16-12f-later-success-saves-full-snapshot', {
      note: `恢復 setItem 後再做一次成功配送：persisted=${JSON.stringify(rl.persisted)}；存檔內先前被拒的「${lastWord}」印記=${JSON.stringify(savedMark)}（契約第 7 行：後續成功寫入可保存當前完整 snapshot，避免丟掉先前未保存印記；期望 4）。`,
      evidence: { later, laterThrew, savedMark, savedMarksSample: saved && saved.marks ? Object.entries(saved.marks).slice(0, 5) : null },
    });
  }

  // R16-13 第三參數以「行為」驗，不用 openCards.length 冒判（契約第 19 行：
  // 預設參數不計入 length，arity 不能當作第三參數是否被支持的證據）
  {
    const id = 'R16-13-third-arg-behavior-not-arity';
    const tiny = { id: 'r17-tiny', name: '行為驗小包', words: [{ id: 't:0', packId: 'r17-tiny', jp: 'ねこ', zh: '貓' }] };
    const tinyWords = effectiveWords(tiny);
    const st = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks: { [core.wordKey(tinyWords[0])]: 3 }, events: {} }) });
    let threeArg = null, twoArg = null, err = null;
    try {
      threeArg = bridge.openCards(st, locOfficial, [tiny]).record({ id: 'evt-tiny', kind: 'delivery', ok: true, jp: tinyWords[0] });
      twoArg = bridge.openCards(memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks: {}, events: {} }) }), locOfficial).record({ id: 'evt-two', kind: 'delivery', ok: true, jp: tinyWords[0] });
    } catch (e) { err = { name: e.name, message: e.message }; }
    const threeAwards = threeArg && Array.isArray(threeArg.newAwards) ? threeArg.newAwards : null;
    // 行為判準：傳入自訂小包時，達成判定必須依「那個小包」而非全 32 包
    const usedArg = !!(threeAwards && threeAwards.includes('r17-tiny'));
    (err ? red : (usedArg ? pass : red))(id, {
      note: `arity(openCards.length)=${bridge.openCards.length}（**僅供參考，不作判準**）；傳入 [tiny] 後 record 的 newAwards=${JSON.stringify(threeAwards)}（期望含 'r17-tiny'，證明真的用了第三參數）；兩參數時 newAwards=${JSON.stringify(twoArg && twoArg.newAwards)}。${err ? '呼叫拋錯：' + err.message : ''}`,
      evidence: { arityInformationalOnly: bridge.openCards.length, threeAwards, twoArgAwards: twoArg && twoArg.newAwards, err },
    });
  }
}

// ───────────────────────────────────────────── 主流程
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const before = hashes();
  log(`C4 契約：${fs.existsSync(CONTRACT) ? 'docs/c4-rewards-runtime-contract-20261014.md 存在' : '不存在'}`);
  log(`讀檔前 hash：${JSON.stringify(before)}`);
  log('');
  cases();
  const after = hashes();
  const stable = JSON.stringify(before) === JSON.stringify(after);
  log('');
  if (stable) log('讀檔後 hash 與讀檔前一致（本次測試未影響 card-core／bridge／model）');
  else { fail('R16-99-hash-drift', { note: '讀檔前後 hash 不一致：測試期間這些檔案被修改，結果可能不可信。', evidence: { before, after } }); }

  const evidence = {
    createdAt: new Date().toISOString(),
    kind: 'C4 data-layer strict acceptance',
    isProductFailForC3: false,
    marksAreFixtureNotNaturalPlay: true,
    contract: 'docs/c4-rewards-runtime-contract-20261014.md',
    readOnlyFiles: READ_ONLY_FILES,
    hashesBefore: before, hashesAfter: after, hashesStable: stable,
    realContent: {
      packs: Object.keys(CONTENT.WORD_PACKS || {}).length,
      packOrder: (CONTENT.PACK_ORDER || []).length,
      words: CONTENT.getAllWords().length,
    },
    publicApiDiscovery: {
      bridgeExported: Object.keys(bridge).sort(),
      coreExported: Object.keys(core).sort(),
      galleryExported: Object.keys(gallery).sort(),
      // 契約第 19 行：openCards.length 不是「第三參數有支援」的契約（預設參數不計 length）。
      // 這裡只留作紀錄，判準一律看 R16-13 的行為結果。
      openCardsArityInformationalOnly: bridge.openCards.length,
      projectionWhere: projection ? projection.where : null,
      recordHasNewAwardsField: apiFieldProbe.newAwards,
      snapshotHasAwardsField: apiFieldProbe.awards,
    },
    summary: results.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {}),
    results, log: lines,
    limits: {
      acceptanceRule: 'C4 資料面已實作。--strict 要求 RED=0、FAIL=0、BLOCKED=0。缺欄或未達成才是 RED。',
      noBrowser: '本檔為純 Node 資料面，不含 UI／Chrome',
      artAndAudio: '套卡插畫 WAITING_HUMAN；音訊凍結，本檔不碰',
      noBattleStats: '契約第 2 行禁止攻擊／血量／速度／相機加成，本檔只驗資料面',
    },
  };
  const c = evidence.summary;
  const redN = c.RED || 0, failN = c.FAIL || 0, blockedN = c.BLOCKED || 0;
  const notClean = redN + failN + blockedN;
  log('');
  log(`總結：PASS=${c.PASS || 0} RED=${redN} FAIL=${failN} BLOCKED=${blockedN} HUMAN_REVIEW=${c.HUMAN_REVIEW || 0}`);
  log(`資料面契約驗收：RED／FAIL／BLOCKED 必須同時為 0。這不是 C3 產品結論，也不是美術或真機核准。`);
  log(`strict gate：--strict=${STRICT}；RED+FAIL+BLOCKED=${notClean}（正式驗收要求 =0）`);
  evidence.strict = {
    enabled: STRICT,
    red: redN, fail: failN, blocked: blockedN, notClean,
    rule: '契約第 19 行：正式驗收需同時 RED=0 且 FAIL=0 且 BLOCKED=0；不可以用退出碼單獨判完成',
    exitRule: STRICT ? 'notClean>0 → exit 1；notClean=0 → exit 0' : '只有 FAIL>0 才 exit 1（未帶 --strict 時 RED 不單獨使 exit 1）',
  };
  fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(OUT, 'qa-log.txt'), lines.join('\n'));
  if (STRICT) process.exitCode = notClean > 0 ? 1 : 0;
  else if (failN) process.exitCode = 1;
}
main();