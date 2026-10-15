"use strict";
// M1-UI：八關 stage metadata 動態渲染契約（本階段唯一 focused）。
// 真頁實證：snow-temple（24 詞）/yomi（164 詞混合池）dev 直進，標題/故事/詞包/
// 圖鑑目錄/packLine 皆隨 stageId 正確帶入；U38 Stage2 圖另存。
// ui.js/card-gallery-ui.js 無第一關硬碼（僅 大妖王/妖將/待解鎖插畫 通用 fallback）。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const WORDS = require("../js/words.js");
const STORY = require("../js/story-dialogue.js");
const galleryUI = require("../js/card-gallery-ui.js");

const C = (WORDS.CONTENT || WORDS);
const storyGet = (STORY.STORY || STORY).get
  ? (STORY.STORY || STORY).get.bind(STORY.STORY || STORY)
  : (id) => (STORY.STORY || STORY)[id];
const STAGE_IDS = ["night-town", "rain-port", "sakura-pass", "bamboo-maze", "hyakki-kyoto", "snow-temple", "spirit-ferry", "yomi"];

function loadUI() {
  const traces = [];
  const ctx = new Proxy({
    font: "900 18px sans-serif",
    fillStyle: "#000", strokeStyle: "#000",
    textAlign: "center", textBaseline: "alphabetic", lineWidth: 1,
    shadowBlur: 0, globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    fillRect() {}, translate() {}, scale() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {},
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage() {},
    measureText(t) {
      const m = String(this.font).match(/([\d.]+)px/);
      const s = m ? Number(m[1]) : 18;
      let w = 0;
      for (const ch of String(t)) w += ch === " " ? s * 0.3 : ch.codePointAt(0) < 256 ? s * 0.55 : s * 1.0;
      return { width: w, actualBoundingBoxAscent: s * 0.76, actualBoundingBoxDescent: s * 0.12 };
    },
    fillText(t, x, y, mw) {
      const m = String(this.font).match(/([\d.]+)px/);
      traces.push({ text: String(t), x, y, size: m ? Number(m[1]) : 18, fill: this.fillStyle, maxWidth: mw });
    },
    strokeText() {}
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const bounds = { left: -199, top: 0, right: 1099, bottom: 600, width: 1298, height: 600 };
  const env = {
    window: {
      VIEWPORT: {
        bounds: () => bounds, hudBounds: () => bounds,
        get: () => ({ scale: 0.65, width: 1298, height: 600, offsetX: 199, offsetY: 0 })
      },
      matchMedia: () => ({ matches: false })
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 844, height: 390 }) }),
      fonts: { check: () => true, load: async () => {} }
    },
    location: { search: "" },
    URLSearchParams,
    Date: { now: () => 1000 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  return { UI: env.window.UI, ctx, traces };
}

test("八關 metadata 完備＋UI 缺欄 fallback 不噴錯不錯標", () => {
  // 資料面（AGY 唯讀）：八關名/Boss 名存在，實詞最長 5 假名
  let longest = "";
  for (const id of STAGE_IDS) {
    const stage = C.getStage(id);
    assert.ok(stage && stage.name, `${id} 應有關名`);
    const words = C.getStageWords(stage);
    assert.ok(words.length > 0, `${id} 應有詞包詞`);
    for (const w of words) if ((w.jp || "").length > longest.length) longest = w.jp;
    const title = storyGet(id) && storyGet(id).bossTitle;
    assert.ok(title, `${id} 應有 Boss 稱號`);
  }
  assert.ok(longest.length <= 5, `全八關實詞最長應<=5，實得 ${longest}`);

  // UI 面：缺 title／缺 zh／缺 icon 時 fallback，不拋錯
  const { UI, ctx, traces } = loadUI();
  traces.length = 0;
  const layout = UI.bossQuizLayout(3);
  UI.drawBossQuiz(ctx, {
    word: { zh: "女孩", jp: "おんなのこ", cue: "text" },
    ans: [{ jp: "おんなのこ", zh: "女孩" }, { jp: "ねこ", zh: "貓" }, { jp: "いぬ", zh: "狗" }],
    wrong: []
  }, "keyboard", { hp: 1, max: 2, shield: false }, 0); // 無 title 非 final → 妖將
  assert.ok(traces.some(t => t.text === "妖將"), "缺 title 非 final Boss 應標妖將");
  traces.length = 0;
  UI.drawBossQuiz(ctx, {
    word: { zh: "", jp: "おんなのこ", cue: "text" },
    ans: [{ jp: "おんなのこ" }, { jp: "ねこ" }, { jp: "いぬ" }],
    wrong: []
  }, "touch", { hp: 1, max: 2, shield: true, final: true, title: "黃泉邪神·言靈之核" }, 0);
  assert.ok(traces.some(t => t.text === "黃泉邪神·言靈之核" && t.fill === "#f4deb1"), "長 Boss 名應淺色可見");
  assert.ok(!traces.some(t => t.maxWidth && ["おんなのこ", "ねこ", "いぬ"].includes(t.text)),
    "5 假名選項不得觸發 maxWidth 壓扁（血條右側狀態字自帶寬裕 cap 不計）");

  // 圖鑑面：八關名全進目錄，手機半鈕單行裝得下最長關名/包名
  const hooks = { readableFont: (s, w) => `${w || "900"} ${s}px sans-serif`, drawWoodTag() {}, drawButton() {} };
  const cards = [{ key: "ねこ", jp: "ねこ", zh: "貓", kana: "ねこ", reveal: "open", progress: "4/4", stages: ["yomi"], category: { id: "animals", label: "動物街" }, illustration: null }];
  const catalogs = {
    stages: STAGE_IDS.map(id => ({ id, name: C.getStage(id).name })),
    packs: Object.values(C.WORD_PACKS).map(p => ({ id: p.id, name: p.name }))
  };
  const gtx = {
    font: "900 15px sans-serif", fillStyle: "#000", textAlign: "center", save() {}, restore() {},
    measureText(t) { let w = 0; for (const ch of String(t)) w += ch.codePointAt(0) < 256 ? 15 * 0.55 : 15 * 1.0; return { width: w }; },
    fillText(t, x, y) { traces.push({ text: String(t), x, y }); }
  };
  const out = galleryUI.draw(gtx, cards, { filter: { by: "all", id: null }, page: 0 }, hooks,
    { width: 844, height: 390, scale: 0.65, offsetX: 0, offsetY: 0 }, catalogs);
  assert.ok(out.buttons.some(b => b.id === "filter-stage"), "手機應有容量按鈕");
});

test("Boss 稱號鏈：實例 stageId→關卡 metadata 優先，缺欄逐級 fallback 不噴錯", () => {
  function loadWithStory(story) {
    const traces = [];
    const ctx = new Proxy({
      font: "900 13px sans-serif",
      fillStyle: "#000", strokeStyle: "#000",
      textAlign: "center", textBaseline: "alphabetic", lineWidth: 1,
      save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
      createLinearGradient() { return { addColorStop() {} }; },
      measureText(t) {
        const m = String(this.font).match(/([\d.]+)px/);
        const s = m ? Number(m[1]) : 13;
        let w = 0;
        for (const ch of String(t)) w += ch === " " ? s * 0.3 : ch.codePointAt(0) < 256 ? s * 0.55 : s * 1.0;
        return { width: w };
      },
      fillText(t, x, y, mw) { traces.push({ text: String(t), fill: this.fillStyle, maxWidth: mw }); },
      strokeText() {}
    }, { get: (o, k) => (k in o ? o[k] : () => {}) });
    const bounds = { left: 0, top: 0, right: 844, bottom: 600, width: 844, height: 600 };
    const env = {
      window: {
        VIEWPORT: {
          bounds: () => bounds, hudBounds: () => bounds,
          get: () => ({ scale: 0.65, width: 844, height: 600, offsetX: 0, offsetY: 0 })
        },
        matchMedia: () => ({ matches: false }),
        STORY: story
      },
      document: {
        getElementById: () => ({ getBoundingClientRect: () => ({ width: 844, height: 390 }) }),
        fonts: { check: () => true, load: async () => {} }
      },
      location: { search: "" },
      URLSearchParams,
      Date: { now: () => 1000 }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
    return { UI: env.window.UI, ctx, traces };
  }
  const BOSQ = {
    word: { zh: "女孩", jp: "おんなのこ", cue: "text" },
    ans: [{ jp: "おんなのこ" }, { jp: "ねこ" }, { jp: "いぬ" }],
    wrong: []
  };
  // 1) stageId＋metadata 齊：用關卡稱號（糾正實例舊稱號跨關錯帶）
  {
    const { UI, ctx, traces } = loadWithStory({ get: (id) => id === "yomi" ? { bossTitle: "黃泉邪神·言靈之核" } : null });
    UI.drawBossQuiz(ctx, BOSQ, "keyboard", { hp: 1, max: 2, shield: true, title: "舊關殘留稱號", stageId: "yomi" }, 0);
    assert.ok(traces.some(t => t.text === "黃泉邪神·言靈之核" && t.fill === "#f4deb1"), "應取 stage metadata 稱號");
    assert.ok(!traces.some(t => t.text === "舊關殘留稱號"), "錯帶舊稱號不應出現");
  }
  // 2) 有 stageId 但該關無稱號：退回實例 title
  {
    const { UI, ctx, traces } = loadWithStory({ get: () => null });
    UI.drawBossQuiz(ctx, BOSQ, "keyboard", { hp: 1, max: 2, shield: true, title: "港霧大妖", stageId: "rain-port" }, 0);
    assert.ok(traces.some(t => t.text === "港霧大妖"), "缺關卡稱號應退回實例 title");
  }
  // 3) 無 stageId（Kilo 補欄前）：舊行為，實例 title／通用 fallback
  {
    const { UI, ctx, traces } = loadWithStory(null);
    UI.drawBossQuiz(ctx, BOSQ, "keyboard", { hp: 1, max: 2, shield: true, title: "港霧大妖" }, 0);
    assert.ok(traces.some(t => t.text === "港霧大妖"), "無 STORY 時實例 title 照用");
    traces.length = 0;
    UI.drawBossQuiz(ctx, BOSQ, "keyboard", { hp: 1, max: 2, shield: false }, 0);
    assert.ok(traces.some(t => t.text === "妖將"), "全缺時通用 fallback");
  }
  // 4) STORY.get 拋錯：不噴錯，退回實例 title
  {
    const { UI, ctx, traces } = loadWithStory({ get: () => { throw Error("store busy"); } });
    UI.drawBossQuiz(ctx, BOSQ, "keyboard", { hp: 1, max: 2, shield: true, title: "港霧大妖", stageId: "rain-port" }, 0);
    assert.ok(traces.some(t => t.text === "港霧大妖"), "STORY 異常不應炸板");
  }
});
