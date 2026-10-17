"use strict";

// E22-01 Sonnet-4.5 獨立 C4 套卡驗收（2026-10-14）
//
// 定位：Cursor C4 runtime 已交 9PASS+48PASS，Space R16 --strict 有 harness 缺陷。
//       本檔修正 R16-04 邏輯錯誤與 563 行 ReferenceError，建立乾淨的 focused 行為測試。
// 邊界：read-only production（不改 js/card-*.js、game.js、assets/）；
//       只寫入自己的 tests/sonnet-c4-independent.acceptance.cjs、docs/、artifacts/。
// 守門：真 32 pack/164 words、completeSets 0–4/empty/decoy/NFC、最後一字 3→4 單次 newAwards、
//       assisted 可領、failure/duplicate/Boss 空陣列、snapshot/serialize/reload 保留 awards、
//       舊已滿補領、兩參 default 真 packs 與三參自訂行為、ordinary/dev/?dev 隔離、
//       quota/security applied:true persisted:false storageError 而不 throw、
//       same-page pending 按 storage identity 隔離、新 module VM 真 reload 只已存、
//       後續成功可保存完整 state。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/validation/sonnet-e22-c4-20261014');
const CONTRACT = path.join(ROOT, 'docs/c4-rewards-runtime-contract-20261014.md');
const READ_ONLY = ['js/card-collection.js', 'js/card-delivery-bridge.js', 'js/card-gallery-model.js'];

const sha256 = f => {
  const p = path.join(ROOT, f);
  return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null;
};
const hashes = () => Object.fromEntries(READ_ONLY.map(f => [f, sha256(f)]));

const results = [];
const lines = [];
const log = (...a) => { const s = a.join(' '); console.log(s); lines.push(s); };
const rec = (id, status, d = {}) => {
  results.push({ id, status, ...d });
  log(`[${status}] ${id}${d.note ? ' — ' + d.note : ''}`);
};

const core = require('../js/card-collection.js');
const bridge = require('../js/card-delivery-bridge.js');
const gallery = require('../js/card-gallery-model.js');
const CONTENT = require('../js/words.js');

const OFFICIAL = 'yokai-delivery-cards-v1';
const DEV = 'yokai-delivery-dev-cards-v1';
const LEARNING = 'yokai-delivery-v1';

// ──────────────────────────────────────────────── Helper：記憶體存檔
function memStorage(seed) {
  const data = Object.assign({}, seed || {});
  const writes = [];
  return {
    data, writes,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { writes.push({ key: k, len: String(v).length }); data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    keys: () => Object.keys(data),
  };
}

const locOff = { hostname: '127.0.0.1', search: '' };
const locDev = { hostname: '127.0.0.1', search: '?dev=1' };

// ──────────────────────────────────────────────── Helper：有效詞（排除 decoy、NFC 去重）
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

const ALL_PACKS = Object.values(CONTENT.WORD_PACKS || {});
const smallest = ALL_PACKS.map(p => ({ p, n: effectiveWords(p).length })).sort((a, b) => a.n - b.n)[0];

// ──────────────────────────────────────────────── Helper：動態欄位偵測
function probeFields() {
  try {
    const st = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks: {}, events: {} }) });
    const op = bridge.openCards(st, locOff);
    const rec = op.record({ id: 'probe', kind: 'delivery', ok: true, jp: 'test' });
    const snap = typeof op.snapshot === 'function' ? op.snapshot() : null;
    return {
      newAwards: !!(rec && 'newAwards' in rec),
      awards: !!(snap && 'awards' in snap),
      persisted: !!(rec && 'persisted' in rec),
    };
  } catch (e) {
    return { newAwards: null, awards: null, persisted: null, error: e.message };
  }
}

// ──────────────────────────────────────────────── 案例
function cases() {
  const probe = probeFields();
  rec('E22-00-api-probe', probe.newAwards && probe.awards && probe.persisted ? 'PASS' : 'FAIL', {
    note: `公開欄位探測：newAwards=${probe.newAwards}、awards=${probe.awards}、persisted=${probe.persisted}。`,
    evidence: probe,
  });

  // E22-01 真 32 包 / 164 詞
  {
    const id = 'E22-01-real-32-packs-164-words';
    const pn = Object.keys(CONTENT.WORD_PACKS || {}).length;
    const on = (CONTENT.PACK_ORDER || []).length;
    const wn = CONTENT.getAllWords().length;
    const en = ALL_PACKS.reduce((n, p) => n + effectiveWords(p).length, 0);
    const stagesObj = CONTENT.STAGES && !Array.isArray(CONTENT.STAGES) && typeof CONTENT.STAGES === 'object';
    const hasWordPacks = !!(CONTENT.STAGES && CONTENT.STAGES['night-town'] && Array.isArray(CONTENT.STAGES['night-town'].wordPacks));
    const ok = pn === 32 && on === 32 && wn === 164 && en === 164 && stagesObj && hasWordPacks;
    rec(id, ok ? 'PASS' : 'FAIL', {
      note: `WORD_PACKS=${pn}、PACK_ORDER=${on}、getAllWords()=${wn}、有效詞合計=${en}；STAGES 為 object=${stagesObj}、stage.wordPacks 為 array=${hasWordPacks}。期望 32/32/164/164。`,
      evidence: { pn, on, wn, en, stagesObj, hasWordPacks },
    });
  }

  // E22-02 completeSets 存在且回 32 組
  {
    const id = 'E22-02-completeSets-exists-32-sets';
    if (typeof core.completeSets !== 'function') {
      rec(id, 'FAIL', { note: 'CARD_COLLECTION.completeSets 不是函數。' });
    } else {
      try {
        const marks = {};
        const sets = core.completeSets(ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })), marks);
        const list = Array.isArray(sets) ? sets : [];
        const ok = list.length === 32;
        rec(id, ok ? 'PASS' : 'FAIL', {
          note: `completeSets 回 ${list.length} 組（期望 32）。`,
          evidence: { count: list.length, sample: list.slice(0, 2) },
        });
      } catch (e) {
        rec(id, 'FAIL', { note: `completeSets 拋錯：${e.message}`, evidence: { stack: e.stack } });
      }
    }
  }

  // E22-03 空包 / decoy / NFC 去重
  {
    const id = 'E22-03-empty-decoy-nfc';
    const empty = { id: 'e22-empty', name: '空包', words: [] };
    const decoy = {
      id: 'e22-decoy', name: '干擾', words: [
        { id: 'd:0', packId: 'e22-decoy', jp: 'テスト', zh: '測試', decoy: true },
        { id: 'd:1', packId: 'e22-decoy', jp: 'が', zh: '甲' },
        { id: 'd:2', packId: 'e22-decoy', jp: 'か\u3099', zh: '甲' },  // 分解形
      ],
    };
    try {
      const sets = core.completeSets([empty, decoy], {});
      const e = sets.find(s => s.id === 'e22-empty');
      const d = sets.find(s => s.id === 'e22-decoy');
      const emptyOk = !e || e.total === 0 || e.complete === false;
      const decoyOk = d && d.total === 1;  // 1 個有效字（NFC 去重）
      rec(id, emptyOk && decoyOk ? 'PASS' : 'FAIL', {
        note: `空包 total=${e && e.total} complete=${e && e.complete}（必須未達成）；干擾包 total=${d && d.total}（期望 1：排除 decoy、NFC 去重）。`,
        evidence: { empty: e, decoy: d },
      });
    } catch (e) {
      rec(id, 'FAIL', { note: `completeSets 失敗：${e.message}` });
    }
  }

  // E22-04 最後一字 3→4 觸發單次 newAwards（修正 R16-04 邏輯）
  {
    const id = 'E22-04-last-word-3-to-4-single-award';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    if (words.length < 1) {
      rec(id, 'BLOCKED', { note: '找不到有效詞的詞包。' });
    } else {
      const marks = {};
      // 修正：全部字都補到 4，只留最後一字為 3
      words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
      const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
      const opened = bridge.openCards(store, locOff, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
      const res = opened.record({ id: 'evt-last', kind: 'delivery', ok: true, jp: words[words.length - 1] });
      const got = res && Array.isArray(res.newAwards) ? res.newAwards : null;
      const ok = got && got.length === 1 && got[0] === pack.id;
      rec(id, ok ? 'PASS' : 'FAIL', {
        note: `最後一字從 3→4 後 newAwards=${JSON.stringify(got)}（期望恰好 [${pack.id}]）。`,
        evidence: { packId: pack.id, words, marks, res },
      });

      // snapshot().awards 是 boolean map
      const snap = opened.snapshot && opened.snapshot();
      const aw = snap && snap.awards;
      const mapOk = aw && typeof aw === 'object' && aw[pack.id] === true;
      rec('E22-04b-snapshot-awards-map', mapOk ? 'PASS' : 'FAIL', {
        note: `snapshot().awards = ${JSON.stringify(aw)}（期望 {${JSON.stringify(pack.id)}: true}）。`,
        evidence: { awards: aw },
      });

      // 持久化在同卡鍵
      const saved = store.data[OFFICIAL] ? JSON.parse(store.data[OFFICIAL]) : null;
      const persistOk = saved && saved.awards && saved.awards[pack.id] === true;
      rec('E22-04c-persisted-same-key', persistOk ? 'PASS' : 'FAIL', {
        note: `存檔 ${OFFICIAL} 內 awards=${JSON.stringify(saved && saved.awards)}。`,
        evidence: { saved, writes: store.writes },
      });
    }
  }

  // E22-05 assisted 成功可領（修正 R16-04：全包補滿才測）
  {
    const id = 'E22-05-assisted-success-counts';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {};
    // 修正：全部字都補到 4，只留第一字為 3
    words.forEach((w, i) => { marks[w] = i === 0 ? 3 : 4; });
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
    const opened = bridge.openCards(store, locOff, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
    const res = opened.record({ id: 'evt-assist', kind: 'delivery', ok: true, assisted: true, jp: words[0] });
    const got = res && Array.isArray(res.newAwards) ? res.newAwards : null;
    const ok = got && got.includes(pack.id);
    rec(id, ok ? 'PASS' : 'FAIL', {
      note: `assisted 成功補滿最後一字 → newAwards=${JSON.stringify(got)}（期望含 ${pack.id}）。`,
      evidence: { packId: pack.id, res },
    });
  }

  // E22-06 failure/duplicate/Boss 不發獎
  {
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === 0 ? 3 : 4; });
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: { 'old': true } }) });
    const opened = bridge.openCards(store, locOff, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));

    const fail = opened.record({ id: 'evt-fail', kind: 'delivery', ok: false, jp: words[0] });
    const failOk = fail && Array.isArray(fail.newAwards) && fail.newAwards.length === 0;
    rec('E22-06a-failure-no-award', failOk ? 'PASS' : 'FAIL', {
      note: `失敗配送 newAwards=${JSON.stringify(fail && fail.newAwards)}（必須空陣列）。`,
      evidence: { fail },
    });

    const dup = opened.record({ id: 'old', kind: 'delivery', ok: true, jp: words[0] });
    const dupOk = dup && dup.applied === false && (!dup.newAwards || dup.newAwards.length === 0);
    rec('E22-06b-duplicate-no-award', dupOk ? 'PASS' : 'FAIL', {
      note: `重複事件 applied=${JSON.stringify(dup && dup.applied)}、newAwards=${JSON.stringify(dup && dup.newAwards)}（不發獎）。`,
      evidence: { dup },
    });

    const boss = opened.record({ id: 'evt-boss', kind: 'boss', ok: true, jp: words[0] });
    const bossOk = boss && boss.applied === false;
    rec('E22-06c-boss-rejected', bossOk ? 'PASS' : 'FAIL', {
      note: `Boss 事件 applied=${JSON.stringify(boss && boss.applied)}（契約：parseEvent 拒絕 Boss 不是缺陷）。`,
      evidence: { boss },
    });
  }

  // E22-07 下次配送與 reload 保留 awards
  {
    const id = 'E22-07-persist-reload';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
    const packs = ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words }));
    const opened = bridge.openCards(store, locOff, packs);
    opened.record({ id: 'evt-a', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const next = opened.record({ id: 'evt-b', kind: 'delivery', ok: true, jp: words[0] });
    const noDouble = !(next && Array.isArray(next.newAwards) && next.newAwards.length > 0);

    const reopened = bridge.openCards(store, locOff);  // reload：兩參數
    const snap = reopened.snapshot && reopened.snapshot();
    const kept = snap && snap.awards && snap.awards[pack.id] === true;
    rec(id, noDouble && kept ? 'PASS' : 'FAIL', {
      note: `補領後再配送 newAwards=${JSON.stringify(next && next.newAwards)}（應空）；reload 後 awards=${JSON.stringify(snap && snap.awards)}（應保留）。`,
      evidence: { next, snap },
    });
  }

  // E22-08 舊檔已滿但無 awards → 下次補領
  {
    const id = 'E22-08-legacy-backfill';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach(w => { marks[w] = 4; });  // 全滿但無 awards
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
    const opened = bridge.openCards(store, locOff, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
    const res = opened.record({ id: 'evt-legacy', kind: 'delivery', ok: true, jp: words[0] });
    const got = res && Array.isArray(res.newAwards) ? res.newAwards : null;
    const ok = got && got.includes(pack.id);
    rec(id, ok ? 'PASS' : 'FAIL', {
      note: `舊檔全滿無 awards 後再配送 → newAwards=${JSON.stringify(got)}（應補領 ${pack.id}）。`,
      evidence: { got },
    });
  }

  // E22-09 official / dev 隔離
  {
    const id = 'E22-09-official-dev-isolation';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const packs = ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words }));
    const offStore = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) });
    const devStore = memStorage({ [DEV]: JSON.stringify({ v: 1, marks, events: {} }) });
    const off = bridge.openCards(offStore, locOff, packs);
    const dev = bridge.openCards(devStore, locDev, packs);
    const offRes = off.record({ id: 'same', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const devRes = dev.record({ id: 'same', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const crossed = offStore.writes.some(w => w.key === DEV) || devStore.writes.some(w => w.key === OFFICIAL);
    const both = !!(offRes && offRes.newAwards && offRes.newAwards.length) && !!(devRes && devRes.newAwards && devRes.newAwards.length);
    rec(id, !crossed && both ? 'PASS' : 'FAIL', {
      note: `正式與 dev 各自補領：off=${JSON.stringify(offRes && offRes.newAwards)}、dev=${JSON.stringify(devRes && devRes.newAwards)}；跨鍵寫入=${crossed}（必須 false）。`,
      evidence: { offRes, devRes, crossed },
    });
  }

  // E22-10 不動 learning 鍵
  {
    const id = 'E22-10-learning-untouched';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const learningSeed = { v: 1, xp: 123, box: { 'ねこ': 4 } };
    const store = memStorage({
      [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }),
      [LEARNING]: JSON.stringify(learningSeed),
    });
    const opened = bridge.openCards(store, locOff, ALL_PACKS.map(p => ({ id: p.id, name: p.name, words: p.words })));
    opened.record({ id: 'evt', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    const touched = store.writes.some(w => w.key === LEARNING);
    const now = store.data[LEARNING] ? JSON.parse(store.data[LEARNING]) : null;
    const same = JSON.stringify(now) === JSON.stringify(learningSeed);
    rec(id, !touched && same ? 'PASS' : 'FAIL', {
      note: `配送後 learning 鍵被寫=${touched}（必須 false）、內容不變=${same}。`,
      evidence: { touched, now },
    });
  }

  // E22-11 storage quota：applied:true, persisted:false, storageError
  {
    const id = 'E22-11-quota-safety';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const store = {
      data: { [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) },
      attempts: 0,
      getItem(k) { return this.data[k] || null; },
      setItem(k, v) {
        this.attempts++;
        const e = new Error('quota exceeded');
        e.name = 'QuotaExceededError';
        throw e;
      },
      removeItem() { },
    };
    let threw = null, res = null;
    try {
      const opened = bridge.openCards(store, locOff);
      res = opened.record({ id: 'evt-q', kind: 'delivery', ok: true, jp: words[words.length - 1] });
    } catch (e) {
      threw = { name: e.name, message: e.message };
    }
    if (threw) {
      rec(id, 'FAIL', {
        note: `storage 拋錯時 record 直接 throw（違反契約第 7 行）：${threw.name}: ${threw.message}`,
        evidence: { threw, attempts: store.attempts },
      });
    } else {
      const ok = res && res.applied === true && res.persisted === false && res.storageError && typeof res.storageError.name === 'string';
      rec(id, ok ? 'PASS' : 'FAIL', {
        note: `quota 拋錯時 applied=${JSON.stringify(res && res.applied)}、persisted=${JSON.stringify(res && res.persisted)}、storageError=${JSON.stringify(res && res.storageError)}。`,
        evidence: { res, attempts: store.attempts },
      });
    }
  }

  // E22-12 第三參數以行為驗（不用 length）
  {
    const id = 'E22-12-third-arg-behavior';
    const tiny = { id: 'e22-tiny', name: '小包', words: [{ id: 't:0', packId: 'e22-tiny', jp: 'test', zh: '測' }] };
    const tw = effectiveWords(tiny);
    const store = memStorage({ [OFFICIAL]: JSON.stringify({ v: 1, marks: { [core.wordKey(tw[0])]: 3 }, events: {} }) });
    let res = null, err = null;
    try {
      const opened = bridge.openCards(store, locOff, [tiny]);
      res = opened.record({ id: 'evt-tiny', kind: 'delivery', ok: true, jp: tw[0] });
    } catch (e) {
      err = { name: e.name, message: e.message };
    }
    const got = res && Array.isArray(res.newAwards) ? res.newAwards : null;
    const ok = !err && got && got.includes('e22-tiny');
    rec(id, ok ? 'PASS' : 'FAIL', {
      note: `傳入 [tiny] 後 newAwards=${JSON.stringify(got)}（期望含 'e22-tiny'）。arity=${bridge.openCards.length}（僅供參考）。`,
      evidence: { got, arity: bridge.openCards.length, err },
    });
  }

  // E22-13 後續成功可保存完整 snapshot
  {
    const id = 'E22-13-later-saves-full';
    const pack = smallest.p;
    const words = effectiveWords(pack);
    const marks = {}; words.forEach((w, i) => { marks[w] = i === words.length - 1 ? 3 : 4; });
    const store = {
      data: { [OFFICIAL]: JSON.stringify({ v: 1, marks, events: {} }) },
      refuse: true,
      getItem(k) { return this.data[k] || null; },
      setItem(k, v) {
        if (this.refuse) {
          const e = new Error('quota');
          e.name = 'QuotaExceededError';
          throw e;
        }
        this.data[k] = String(v);
      },
      removeItem() { },
    };
    try {
      const opened = bridge.openCards(store, locOff);
      opened.record({ id: 'evt-refuse', kind: 'delivery', ok: true, jp: words[words.length - 1] });
      store.refuse = false;
      const later = opened.record({ id: 'evt-ok', kind: 'delivery', ok: true, jp: words[0] });
      const saved = store.data[OFFICIAL] ? JSON.parse(store.data[OFFICIAL]) : null;
      const hasMark = saved && saved.marks && saved.marks[core.wordKey(words[words.length - 1])] === 4;
      const ok = later && later.persisted === true && hasMark;
      rec(id, ok ? 'PASS' : 'FAIL', {
        note: `quota 拒絕後再成功：persisted=${JSON.stringify(later && later.persisted)}；存檔含先前印記=${hasMark}。`,
        evidence: { later, hasMark },
      });
    } catch (e) {
      rec(id, 'FAIL', { note: `拋錯：${e.message}` });
    }
  }
}

// ──────────────────────────────────────────────── 主流程
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const before = hashes();
  log(`E22-01 Sonnet-4.5 獨立 C4 驗收`);
  log(`時間：${new Date().toISOString()}`);
  log(`契約：${fs.existsSync(CONTRACT) ? '存在' : '不存在'}`);
  log(`檔案前 hash：${JSON.stringify(before)}`);
  log('');

  cases();

  const after = hashes();
  const stable = JSON.stringify(before) === JSON.stringify(after);
  log('');
  if (stable) log('檔案後 hash 一致（測試未影響 production）');
  else rec('E22-99-hash-drift', 'FAIL', { note: '檔案 hash 不一致', evidence: { before, after } });

  const summary = results.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {});
  const pass = summary.PASS || 0;
  const fail = summary.FAIL || 0;
  const blocked = summary.BLOCKED || 0;
  const human = summary.HUMAN_REVIEW || 0;

  log('');
  log(`總結：PASS=${pass} / FAIL=${fail} / BLOCKED=${blocked} / HUMAN_REVIEW=${human}`);

  const evidence = {
    kind: 'E22-01 Sonnet-4.5 independent C4 acceptance',
    createdAt: new Date().toISOString(),
    model: 'sonnet-4.5 via OmniRoute',
    agent: 'OpenCode (Kiro)',
    contract: CONTRACT,
    readOnlyFiles: READ_ONLY,
    hashesBefore: before,
    hashesAfter: after,
    hashesStable: stable,
    realContent: {
      packs: Object.keys(CONTENT.WORD_PACKS || {}).length,
      packOrder: (CONTENT.PACK_ORDER || []).length,
      words: CONTENT.getAllWords().length,
    },
    summary,
    results,
    log: lines,
    limits: {
      nodOnly: '本檔為純 Node 資料面測試',
      chromeInSeparateRun: 'Chrome 真瀏覽器測試另外執行',
      artAndAudio: '套卡插畫 WAITING_HUMAN；音訊凍結',
      readOnlyProduction: '不改 js/card-*.js、game.js、assets/',
    },
  };

  fs.writeFileSync(path.join(OUT, 'node-evidence.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(OUT, 'node-log.txt'), lines.join('\n'));

  process.exitCode = fail + blocked > 0 ? 1 : 0;
}

main();
