"use strict";

// R13 C3 純模型獨立 QA（Space Bunny Free，2026-10-14）
//
// 定位：這不是把 tests/card-gallery-model.test.cjs 抄一遍。原測試是「給定輸入→斷言某欄位」；
// 本檔用**不變量／置換性／對抗性輸入**去撞 public API，找出原測試沒覆蓋的路徑：
//   跨關去重的聯集、損毀存檔、原型鏈 key、分頁覆蓋性、輸入不可變、排序全序、C1/C2 一致性。
//
// 邊界：只讀驗收。不改 js/card-gallery-model.js、js/card-collection.js、js/words.js 或任何他人檔案。
// 不 require 任何音訊模組、不呼叫 TTS／API、不讀音訊資產目錄、不讀音訊模組檔、不碰 TTS 工具與金鑰。
// 不用 Chrome（純模型無 DOM）。
//
// 執行：node --test tests/spacebunny-c3-model-independent.acceptance.cjs

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const gallery = require("../js/card-gallery-model.js");
const collection = require("../js/card-collection.js");
const CONTENT = require("../js/words.js");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/validation/spacebunny-r13-c3-model-20261014");
const LIVE = CONTENT.getAllWords();

function word(fields) {
  return Object.assign({
    id: "animals:0",
    packId: "animals",
    jp: "ねこ",
    zh: "貓",
    kana: "ねこ",
    kanji: "猫",
    pos: "名詞",
    romaji: "neko",
    icon: "🐱",
    stageIds: ["night-town"],
    shared: false
  }, fields);
}

// 不變量：每張卡在任何狀態下都不能洩漏讀音給未開卡
function assertNoReadingLeak(card) {
  if (card.reveal === "open") return;
  assert.equal(card.jp, null, "未開卡 jp 必須是 null");
  assert.equal(card.zh, null, "未開卡 zh 必須是 null");
  assert.equal(card.kana, null, "未開卡 kana 必須是 null");
  assert.equal(card.illustration, null, "未開卡不得帶插畫欄位");
  assert.equal(Object.hasOwn(card, "romaji"), false, "模型不得帶出 romaji");
  assert.equal(Object.hasOwn(card, "icon"), false, "模型不得帶出 emoji icon");
}

// ── A. 跨關同字：唯一卡 + 每一關都篩得到（契約來源：brief 第 22 行）

test("A1 同一 NFC 日文出現在兩關不同詞條時，卡必須同時掛在兩關下", () => {
  const catalog = {
    stages: [{ id: "night-town", name: "夜行町" }, { id: "yomi", name: "黃泉境" }]
  };
  // 刻意用「同一個 NFC 字、兩筆不同 stageIds」，這是 brief 明文要求要能分關篩到的情況。
  const view = gallery.project([
    word({ id: "animals:7", jp: "が", zh: "合", stageIds: ["night-town"], shared: false }),
    word({ id: "animals:9", jp: "が", zh: "合", stageIds: ["yomi"], shared: false })
  ], { marks: { "が": 4 } }, catalog);
  const card = view.cards[0];
  assert.equal(view.total, 1, "去重後必須只有一張卡");
  const grouped = gallery.groupCards(view.cards, "stage", catalog);
  const ids = grouped.groups.map(g => g.id).sort();
  assert.deepEqual(ids, ["night-town", "yomi"],
    "卡在兩個關卡下都要出現（目前實作只留第一筆的 stageIds → 這是預期中的失敗點）");
  // 同一張卡物件，不複製
  assert.equal(grouped.groups.find(g => g.id === "night-town").cards[0],
    grouped.groups.find(g => g.id === "yomi").cards[0], "兩關底下必須是同一個物件");
  assert.equal(card.shared, true, "跨兩關的卡 shared 應為 true");
});

test("A2 真實詞庫目前沒有重複 jp，去重路徑是潛在而非現行資料", () => {
  const keys = LIVE.map(w => gallery.wordKey(w.jp));
  const uniq = new Set(keys);
  assert.equal(keys.length, uniq.size,
    `真實詞庫出現重複 NFC 日文：${keys.length - uniq.size} 筆（A1 的失敗因此不影響現行資料）`);
  assert.ok(LIVE.length > 0, "詞庫不可為空");
});

// ── B. 印記邊界：0–3 未滿 / 4 滿，以及負值、超出、損毀

test("B1 reveal 與 marks 的關係是恆等的：reveal=open 當且僅當 marks>=MARK_CAP", () => {
  const probe = [-99, -1, -0.5, 0, 1, 2, 3, 3.9, 4, 5, 99, 1e9];
  for (const m of probe) {
    const card = gallery.project([word()], { marks: { "ねこ": m } }).cards[0];
    assert.equal(card.reveal === "open", card.marks >= gallery.MARK_CAP,
      `marks=${m} → marks=${card.marks} reveal=${card.reveal}`);
    assert.equal(card.marks, Math.max(0, Math.min(gallery.MARK_CAP, Math.floor(m))),
      `marks=${m} 必須被夾到 0..${gallery.MARK_CAP}`);
    assert.equal(card.progress, card.marks + "/" + gallery.MARK_CAP);
    assertNoReadingLeak(card);
  }
});

test("B2 損毀／型別錯誤的存檔一律當 0 印且不中斷", () => {
  const sources = [
    undefined, null, 0, 42, "corrupt", [], ["ねこ"],
    { marks: "corrupt" }, { marks: [] }, { marks: null },
    { marks() { throw new Error("boom"); } },
    { marks() { return "4"; } }, { marks() { return NaN; } }
  ];
  for (const source of sources) {
    let view;
    assert.doesNotThrow(() => { view = gallery.project([word()], source); }, "損毀存檔不得拋錯");
    const card = view.cards[0];
    assert.equal(card.marks, 0, `source=${JSON.stringify(source)} 應視為 0 印，實得 ${card.marks}`);
    assert.equal(card.reveal, "locked");
    assertNoReadingLeak(card);
  }
  // 對照：型別正確的 marks 表就是合法存檔，必須讀得到值（避免把好資料誤當損毀）
  const valid = gallery.project([word()], { marks: { "ねこ": 4 } }).cards[0];
  assert.equal(valid.marks, 4, "合法 marks 表必須讀得到值");
  assert.equal(valid.reveal, "open");
});

test("B3 MARK_CAP 與 C1/C2 的 card-collection 完全一致", () => {
  assert.equal(gallery.MARK_CAP, collection.MARK_CAP, "圖鑑與配送印記的滿卡上限必須同源");
  // 兩層對同一個字（含分解／合成）必須收斂到同一把鑰匙
  for (const jp of ["が", "か\u3099", "ねこ", " ねこ "]) {
    assert.equal(gallery.wordKey(jp), collection.wordKey(jp), `wordKey 不一致：${JSON.stringify(jp)}`);
  }
});

test("B4 用 C1/C2 的 loadState 產生的存檔，圖鑑讀到的印記與 C1/C2 完全一致", () => {
  // 走真實 C1/C2 讀檔路徑（isCardDoc + clampMark），不是手刻 marks 物件。
  // 驗收重點是「C3 不得偏離 C1/C2」：圖鑑讀到的每一個數字都必須等於 loadState 的結果。
  const raw = { v: 1, marks: { "ねこ": 4, "いぬ": 1, "さる": 2 }, events: {} };
  const state = collection.loadState(raw);
  const words = [
    word({ id: "a:0", jp: "ねこ" }), word({ id: "a:1", jp: "いぬ" }),
    word({ id: "a:2", jp: "さる" }), word({ id: "a:3", jp: "うさぎ" })
  ];
  const view = gallery.project(words, { key: "yokai-delivery-cards-v1", marks: state.marks });
  const byKey = Object.fromEntries(view.cards.map(c => [c.key, c]));
  for (const w of words) {
    const k = gallery.wordKey(w.jp);
    const expected = state.marks[k] ?? 0;   // 存檔沒有的詞：C1/C2 是 undefined，圖鑑是 0，語意相同
    assert.equal(byKey[k].marks, expected,
      `${k}：圖鑑讀到 ${byKey[k].marks}，C1/C2 是 ${expected}（兩層必須一致）`);
  }
  assert.equal(byKey["ねこ"].reveal, "open");
  assert.equal(byKey["いぬ"].reveal, "locked");
  assert.equal(byKey["うさぎ"].marks, 0, "存檔沒有的詞當 0 印");
  assertNoReadingLeak(byKey["いぬ"]);
  assert.equal(byKey["ねこ"].progress, "4/4");
  assert.equal(view.saveKey, "yokai-delivery-cards-v1", "存檔鍵原樣帶出，模型不自己換鍵");
});

test("B5 C1/C2 讀檔：同 NFC 字兩種寫法必須取最大值，不得被後寫降級", () => {
  // 這是 C1/C2（js/card-collection.js）的讀檔契約，不是 C3。保留為 FAIL 以確保缺陷可重現、可追蹤。
  // 期望：同一個 NFC 字的多筆寫入必須保護較高的印記；分解形的 0 印不得把已滿的卡降級。
  const raw = { v: 1, marks: { "が": 4, "か\u3099": 0 }, events: {} };
  const state = collection.loadState(raw);
  assert.equal(gallery.wordKey("が"), gallery.wordKey("か\u3099"), "兩形必須收斂到同一把鑰匙");
  assert.equal(state.marks[gallery.wordKey("が")], 4,
    "同字兩形必須保護較高印記：分解形的 0 印不得降級已滿的卡（目前實作為後寫覆蓋 → 0）");
  // 反向順序同樣必須保住 4
  const flipped = collection.loadState({ v: 1, marks: { "か\u3099": 0, "が": 4 }, events: {} });
  assert.equal(flipped.marks[gallery.wordKey("が")], 4, "順序顛倒也必須是 4，不可為 0");
});

// ── C. 分頁與篩選的置換性（覆蓋性＝原集合的置換，不多不少）

test("C1 任何 pageSize（含損毀值）分頁後所有頁拼回必為原集合的置換", () => {
  for (const size of [8, 7.5, 1, 0, -3, NaN, Infinity, 1e9, 49, 48, undefined]) {
    const list = Array.from({ length: 23 }, (_, i) => ({ key: "k" + String(i).padStart(2, "0") }));
    const first = gallery.paginate(list, 0, size);
    assert.ok(first.pageCount >= 1, `pageCount 至少 1（size=${size}）`);
    const pages = [first];
    for (let p = 1; p < first.pageCount; p++) pages.push(gallery.paginate(list, p, size));
    const joined = pages.flatMap(p => p.cards.map(c => c.key));
    assert.equal(joined.length, list.length, `size=${size} 拼回筆數不等於原集合`);
    assert.equal(new Set(joined).size, list.length, `size=${size} 拼回有重複`);
    for (const c of list) assert.ok(joined.includes(c.key), `size=${size} 遺失 ${c.key}`);
  }
});

test("C2 頁碼越界被夾住，不會回傳空頁或錯誤頁", () => {
  const list = Array.from({ length: 23 }, (_, i) => ({ key: "k" + i }));
  assert.equal(gallery.paginate(list, -5, 8).page, 0);
  assert.equal(gallery.paginate(list, 999, 8).page, gallery.paginate(list, 0, 8).pageCount - 1);
  assert.equal(gallery.paginate([], 7, 8).cards.length, 0, "空池不得回報錯誤內容");
  assert.equal(gallery.paginate([], 7, 8).total, 0);
  assert.equal(gallery.paginate([], 7, 8).page, 0);
});

test("C3 搜尋不因未開卡而洩漏讀音，也找不到 romaji／emoji", () => {
  const view = gallery.project([
    word({ id: "a:0", jp: "ねこ", zh: "貓", kana: "ねこ", kanji: "猫", romaji: "neko", icon: "🐱" }),
    word({ id: "a:1", jp: "いぬ", zh: "狗", kana: "いぬ", kanji: "犬", romaji: "inu", icon: "🐶" })
  ], { marks: { "ねこ": 4 } });
  const lockedIneko = view.cards.find(c => c.key === "いぬ");
  assertNoReadingLeak(lockedIneko, "未開的「いぬ」");
  // 以羅馬字／emoji 搜尋必須找不到（brief：搜尋不含羅馬字）
  assert.equal(gallery.filterCards(view.cards, "neko").length, 0, "不能搜到羅馬字");
  assert.equal(gallery.filterCards(view.cards, "🐱").length, 0, "不能搜到 emoji");
  assert.equal(gallery.filterCards(view.cards, "inu").length, 0);
  // 未開卡可用 key 找到，但回傳的卡仍不可讀
  const hit = gallery.filterCards(view.cards, "いぬ");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].jp, null, "未開卡被搜到時 jp 仍是 null，UI 不可印 key 冒充讀音");
  // 已開卡可用中文／漢字／假名搜尋
  assert.equal(gallery.filterCards(view.cards, "猫").length, 1, "漢字可搜已開卡");
  assert.equal(gallery.filterCards(view.cards, "貓").length, 1, "中文可搜已開卡");
  assert.equal(gallery.filterCards(view.cards, "   ").length, view.cards.length, "全空白查詢＝不過濾");
});

// ── D. 篩選維度：只准 stage / pack，不得自創第三套主題

test("D1 任何非 stage 的維度都退回 pack，不會長出第三套主題", () => {
  const view = gallery.project([word()], {}, { packs: [{ id: "animals", name: "動物街" }] });
  const catalog = { packs: [{ id: "animals", name: "動物街" }], stages: [{ id: "night-town", name: "夜行町" }] };
  for (const by of ["pack", "category", "theme", "level", "pos", "illust", undefined, "", 0, {}]) {
    const r = gallery.groupCards(view.cards, by, catalog);
    assert.equal(r.by, by === "stage" ? "stage" : "pack", `by=${String(by)} 應退回 pack`);
    assert.ok(r.groups.length >= 1);
  }
  assert.equal(gallery.groupCards(view.cards, "stage", catalog).by, "stage");
});

test("D2 依關卡分組的不變量：每個 group 的卡必定真的屬於那一關，且單一 group 內不重複", () => {
  const stages = Object.values(CONTENT.STAGES).map(s => ({ id: s.id, name: s.name }));
  const view = gallery.project(LIVE, { marks: {} }, { stages });
  const grouped = gallery.groupCards(view.cards, "stage", { stages });
  assert.ok(grouped.groups.length >= 1);
  for (const group of grouped.groups) {
    const keys = group.cards.map(c => c.key);
    assert.equal(new Set(keys).size, keys.length, `group ${group.id} 內出現重複卡`);
    if (group.id === "unassigned") continue;
    for (const card of group.cards) {
      assert.ok(card.stages.includes(group.id), `卡 ${card.key} 被放進不屬於它的關 ${group.id}`);
    }
  }
  // 每張卡至少要出現在一個 group（不能整批消失）
  const groupedKeys = new Set(grouped.groups.flatMap(g => g.cards.map(c => c.key)));
  assert.equal(groupedKeys.size, view.cards.length, "有卡沒被任何關卡收錄");
});

// ── E. 輸入不可變與排序全序（模型是純資料投影）

test("E1 深度凍結的詞條與存檔傳進去也不會被改寫", () => {
  const deepFreeze = o => { Object.getOwnPropertyNames(o).forEach(k => { const v = o[k]; if (v && typeof v === "object") deepFreeze(v); }); return Object.freeze(o); };
  const frozenWord = deepFreeze(word({ stageIds: ["night-town", "yomi"], shared: true }));
  const marksTable = deepFreeze({ "ねこ": 4, "いぬ": 2 });
  const before = JSON.stringify({ word: frozenWord, marks: marksTable });
  const view = gallery.project([frozenWord], { key: "k", marks: marksTable });
  gallery.filterCards(view.cards, "ね");
  gallery.paginate(view.cards, 0, 8);
  gallery.groupCards(view.cards, "stage", { stages: [{ id: "night-town", name: "夜行町" }] });
  gallery.replayRequest(view.cards[0]);
  assert.equal(JSON.stringify({ word: frozenWord, marks: marksTable }), before, "模型不得改寫詞庫或存檔");
  assert.ok(Object.isFrozen(frozenWord.stageIds), "stageIds 必須仍是凍結的陣列");
});

test("E2 排序是全序：打亂輸入順序不改變結果，重複執行結果一致", () => {
  const build = () => Array.from({ length: 12 }, (_, i) => word({ id: "x:" + i, jp: "語" + i, kana: "語" + i, zh: "詞" + i }));
  const marks = { "語3": 4, "語5": 4, "語1": 2, "語9": 1 };
  const fwd = gallery.project(build(), { marks });
  const rev = gallery.project(build().reverse(), { marks });
  const again = gallery.project(build(), { marks });
  const seq = v => v.cards.map(c => c.key + "@" + c.marks).join(",");
  assert.equal(seq(fwd), seq(rev), "輸入順序不得影響輸出順序");
  assert.equal(seq(fwd), seq(again), "重複執行必須一致");
  // 已開的在前，其次印記多的在前，最後以 key 排序
  const opened = fwd.cards.filter(c => c.reveal === "open").length;
  for (let i = 1; i < opened; i++) assert.equal(fwd.cards[i - 1].reveal, "open");
  for (let i = opened + 1; i < fwd.cards.length; i++) assert.notEqual(fwd.cards[i - 1].reveal, "open");
  for (let i = opened + 1; i < fwd.cards.length; i++) {
    assert.ok(fwd.cards[i - 1].marks >= fwd.cards[i].marks, "未開卡之間應依印記由多到少");
  }
});

test("E3 openCount + lockedCount 恆等於 total，且與實際卡片一致", () => {
  for (const marks of [{}, { "語0": 4 }, { "語0": 4, "語3": 4, "語7": 2 }]) {
    const view = gallery.project(Array.from({ length: 12 }, (_, i) => word({ id: "x:" + i, jp: "語" + i, kana: "語" + i })), { marks });
    const actual = view.cards.filter(c => c.reveal === "open").length;
    assert.equal(view.openCount, actual);
    assert.equal(view.lockedCount, view.total - view.openCount);
    assert.equal(view.openCount + view.lockedCount, view.total);
    assert.equal(view.status, "C3_MODEL_READY_UI_ART_PENDING", "狀態字串必須維持『UI 美術未接』");
  }
});

// ── F. 原型鏈與結構性防護

test("F1 原型鏈名稱當作日文不會壞掉投影，也不會把函式當成卡", () => {
  for (const jp of ["__proto__", "constructor", "toString", "hasOwnProperty", "prototype"]) {
    // 用 JSON.parse 造存檔表，貼近真實來源（localStorage 讀出來的 JSON 就是 own property）。
    // 注意：用一般物件賦值 marks["__proto__"] = 4 會改到原型而不是own property，那是 JS 語意、不是模型缺陷。
    const marks = JSON.parse(JSON.stringify({ [jp]: 4 }));
    assert.ok(Object.hasOwn(marks, jp), "JSON 解析後必須是 own property");
    const view = gallery.project([word({ jp })], { marks });
    assert.equal(view.total, 1, `${jp} 應產生一張卡`);
    const card = view.cards[0];
    assert.equal(card.key, jp);
    assert.equal(card.marks, 4);
    assert.equal(card.reveal, "open");
    assert.equal(typeof card.jp, "string");
  }
  // 反向：存檔裡沒有這個 key 時，不可從原型鏈撈到值
  const bare = gallery.project([word({ jp: "toString" })], { marks: {} }).cards[0];
  assert.equal(bare.marks, 0, "不可從 Object.prototype 撈到 marks");
  const bareProto = gallery.project([word({ jp: "__proto__" })], { marks: {} }).cards[0];
  assert.equal(bareProto.marks, 0, "不可從 Object.prototype 撈到 marks");
});

test("F2 缺字／壞字／空字不產生卡，decoy 也不進圖鑑", () => {
  const view = gallery.project([
    word({ id: "ok:0", jp: "ねこ" }),
    word({ id: "bad:1", jp: "" }),
    word({ id: "bad:2", jp: null }),
    word({ id: "bad:3", jp: undefined }),
    word({ id: "bad:4", jp: "   " }),
    { id: "decoy:5", packId: "answer-decoy", jp: "バス", zh: "公車", decoy: true, stageIds: [] }
  ], { marks: { "ねこ": 4 } });
  assert.equal(view.total, 1, "只有合法詞條進圖鑑");
  assert.equal(view.cards[0].key, "ねこ");
});

test("F3 空池不會拋錯，四個 API 都有合理的空回應", () => {
  const view = gallery.project([], {});
  assert.equal(view.total, 0);
  assert.equal(view.openCount, 0);
  assert.equal(view.lockedCount, 0);
  assert.deepEqual(view.cards, []);
  assert.deepEqual(gallery.filterCards(view.cards, "ねこ"), []);
  assert.deepEqual(gallery.filterCards(null, "ねこ"), []);
  assert.deepEqual(gallery.filterCards(undefined, null), []);
  assert.equal(gallery.paginate(view.cards, 0, 8).cards.length, 0);
  assert.equal(gallery.groupCards(view.cards, "stage", {}).groups.length, 0);
  assert.equal(gallery.groupCards(null, "pack", {}).groups.length, 0);
  assert.deepEqual(gallery.replayRequest(null), { ok: false, reason: "locked" });
});

// ── G. 重聽只是一筆請求，且本檔與模型都不碰音訊

test("G1 replayRequest 對未開卡拒絕、對已開卡只給請求不自行播放", () => {
  const locked = gallery.project([word()], { marks: { "ねこ": 3 } }).cards[0];
  const open = gallery.project([word()], { marks: { "ねこ": 4 } }).cards[0];
  assert.deepEqual(gallery.replayRequest(locked), { ok: false, reason: "locked" });
  assert.deepEqual(gallery.replayRequest(open), { ok: true, event: "card-replay", jp: "ねこ", kana: "ねこ" });
  assert.deepEqual(Object.keys(gallery.replayRequest(open)).sort(), ["event", "jp", "kana", "ok"]);
  // 未開卡即使帶 key 也不得產生可播放事件
  assert.equal(gallery.replayRequest({ reveal: "locked", key: "ねこ" }).ok, false);
});

test("G2 模型與本檔都不引用音訊／存檔寫入面", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/card-gallery-model.js"), "utf8");
  for (const banned of ["audio.js", "speechSynthesis", "localStorage", "sessionStorage", "fetch(", "XMLHttpRequest", "Audio(", "tts"]) {
    assert.equal(src.includes(banned), false, `模型不得引用 ${banned}`);
  }
  // 驗收檔自身也不得碰音訊面。禁詞用片段拼，避免這段檢查自己命中自己。
  const self = fs.readFileSync(__filename, "utf8");
  const forbiddenInSelf = [["assets", "audio"].join("/"), ["js", "audio.js"].join("/"), ["tools", "tts"].join("/"), ["API", "_KEY"].join("")];
  for (const banned of forbiddenInSelf) {
    assert.equal(self.includes(banned), false, `驗收檔不得碰 ${banned}`);
  }
  // 實際確認：這次執行沒有載入任何音訊模組
  // 2026-10-14 修 QA bug：原本用 /audio|tts/i 寬 regex 掃 require.cache，
  // 會把 QA 保護 guard（tools/director-audio-freeze.cjs）誤判成播放模組而假 FAIL。
  // 改為精確比對「正規化後路徑」，只禁契約指定的音訊來源，不整片豁免含 audio 字樣的檔。
  // 注意：下列片段必須拼接產生，否則本檢查會命中自己（自我命中＝上一版的 bug）。
  const seg = (...parts) => parts.join("");
  const normalized = f => String(f).replace(/\\/g, "/").toLowerCase();
  const SRC_MODULE = seg("js", "/", "audio", ".js");          // js 下的音訊模組
  const SRC_ASSETS = seg("assets", "/", "audio", "/");         // 音訊資產目錄
  const SRC_TTS = seg("tools", "/", "tts");                    // TTS 工具
  const FORBIDDEN_MODULE_SOURCES = [
    { id: SRC_MODULE, re: new RegExp("(^|/)" + SRC_MODULE + "$") },
    { id: SRC_ASSETS + "**", re: new RegExp("(^|/)" + SRC_ASSETS) },
    { id: SRC_TTS + "*", re: new RegExp("(^|/)" + SRC_TTS + "[^/]*(/|$)") },
  ];
  const loaded = Object.keys(require.cache).map(normalized);
  const offenders = [];
  for (const f of loaded) for (const rule of FORBIDDEN_MODULE_SOURCES) if (rule.re.test(f)) offenders.push(rule.id + " → " + f);
  assert.deepEqual(offenders, [], "不應載入任何音訊／TTS 模組");
  // QA 保護 guard 不是播放模組：必須被視為合法
  const guardLoaded = loaded.some(f => /(^|\/)tools\/director-audio-freeze\.cjs$/.test(f));
  // 回歸防護：若日後有人把規則放寬成寬 regex，guard 就會被誤判，這裡先擋住
  const offendersFromGuard = FORBIDDEN_MODULE_SOURCES.some(rule => rule.re.test("tools/director-audio-freeze.cjs"));
  assert.equal(offendersFromGuard, false, "保護 guard 不得被誤判為禁止來源");
  console.log(`[INFO] G2 require.cache 掃 ${loaded.length} 個模組；guard 已載入=${guardLoaded}（guard 不算播放模組）；禁止規則 ${FORBIDDEN_MODULE_SOURCES.length} 條皆未命中`);
});

// ── H. 真實詞庫整體健康（回歸護欄，不是逐欄位斷言）

test("H1 真實詞庫投影：每張卡可安全顯示，跨關卡存在且不重複", () => {
  const packs = Object.values(CONTENT.WORD_PACKS).map(p => ({ id: p.id, name: p.name, sub: p.sub }));
  const stages = Object.values(CONTENT.STAGES).map(s => ({ id: s.id, name: s.name }));
  const view = gallery.project(LIVE, { key: "yokai-delivery-cards-v1", marks: {} }, { packs, stages });
  assert.equal(view.total, LIVE.length, "真實詞庫每個詞都應成一張卡");
  for (const card of view.cards) {
    assert.equal(typeof card.key, "string");
    assert.ok(card.key.length > 0);
    assert.equal(card.progress, "0/4");
    assertNoReadingLeak(card);
    assert.ok(card.category && typeof card.category.label === "string", "每張卡都要有可顯示的分類標籤");
    assert.equal(card.illustration, null);
  }
  const shared = view.cards.filter(c => c.stages.length > 1);
  assert.ok(shared.length > 0, "真實詞庫應存在跨關詞，可驗證分關篩選");
  const multi = shared.find(c => c.stages.length > 2);
  if (multi) assert.equal(multi.shared, true, `${multi.key} 跨 ${multi.stages.length} 關，shared 應為 true`);
  // 跨關詞必須真的同時出現在多個關卡 group 底下
  const grouped = gallery.groupCards(view.cards, "stage", { stages });
  const sample = shared[0];
  const inGroups = grouped.groups.filter(g => g.cards.includes(sample)).map(g => g.id).sort();
  assert.deepEqual(inGroups, [...sample.stages].sort(), `${sample.key} 在 group 的出現關卡必須等於它宣告的 stageIds`);
});

test("H2 未開卡的數量與詞庫規模相符，滿卡時才開", () => {
  const view = gallery.project(LIVE, { marks: {} });
  assert.equal(view.openCount, 0, "沒有印記時不得有任何卡開啟");
  assert.equal(view.lockedCount, LIVE.length);
  const allOpen = gallery.project(LIVE, { marks: Object.fromEntries(LIVE.map(w => [gallery.wordKey(w.jp), 9])) });
  assert.equal(allOpen.openCount, allOpen.total, "每個詞都滿印時應全開");
  assert.equal(allOpen.lockedCount, 0);
  for (const card of allOpen.cards) {
    assert.equal(card.progress, "4/4");
    assert.equal(card.face, "card");
    assert.equal(card.illustration.text, "待解鎖插畫", "插畫未核准前只能是文字，不得塞圖路徑");
    assert.equal(typeof card.jp, "string");
  }
});