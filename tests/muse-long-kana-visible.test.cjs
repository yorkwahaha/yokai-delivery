"use strict";
// Muse Spark 首次 coding 票：第一關 5 假名/長字可讀性 focused 驗收。
// 校準來源：真 Chrome headless Canvas.measureText（2026-10-15 實測）：
//   "1 おんなのこ"@18px=105.08, "おんなのこ"@14px=70,
//   "とうもろこし"@14px=84, 12假名短句@18px=234。
// 結論：5 假名桌機窄版可單行等比呈現（>=13px），超長才折兩行；無需改 js/ui.js。
// 圖鑑手機版熱區/溢出同檔覆蓋；無真缺陷則 DONE_NO_CHANGE（不改 card-gallery-ui.js）。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const cardGallery = require("../js/card-gallery-ui.js");

// 保守真字寬比：全形假名 1.08em（實測 1.00~1.083 取上界），ASCII 0.55em，半形空 0.30em。
// 驗算 "1 おんなのこ"@18px = 9.9+5.4+97.2 = 112.5（真值 105.08，保守高估，安全側）。
function trueWidth(text, size) {
  let w = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (ch === " ") w += size * 0.3;
    else if (code < 256) w += size * 0.55;
    else w += size * 1.08;
  }
  return w;
}

function loadUIEnv(hud) {
  const traces = [];
  const ctx = new Proxy({
    font: "700 18px 'Noto Sans JP', sans-serif",
    fillStyle: "#000",
    strokeStyle: "#000",
    textAlign: "center",
    textBaseline: "alphabetic",
    save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    clip() {}, translate() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {}, rect() {},
    fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(text) { return { width: trueWidth(text, currentSize(this.font)) }; },
    fillText(text, x, y, maxWidth) {
      traces.push({ type: "fill", text: String(text), x, y, fontSize: currentSize(this.font), maxWidth });
    },
    strokeText(text, x, y, maxWidth) {
      traces.push({ type: "stroke", text: String(text), x, y, fontSize: currentSize(this.font), maxWidth });
    }
  }, {
    get: (o, k) => (k in o ? o[k] : () => {})
  });
  function currentSize(font) {
    const m = String(font).match(/([\d.]+)px/);
    return m ? Number(m[1]) : 16;
  }
  const bounds = hud || { left: 0, right: 900, top: 0, bottom: 600 };
  const env = {
    window: {
      VIEWPORT: { hudBounds: () => bounds, get: () => ({ scale: 1, width: 900, height: 600 }) }
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 900, height: 600 }) }),
      fonts: { check: () => true, load: async () => {} }
    },
    Date: { now: () => 1000 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  return { UI: env.window.UI, ctx, traces };
}

test("1. 桌機窄版 Boss 選項 5 假名單行等比、字級>=13px、無 maxWidth 壓扁", () => {
  const { UI, ctx, traces } = loadUIEnv(); // w=410, optW=120.66, 可用 108.66
  const bossQ = {
    word: { zh: "女孩", jp: "おんなのこ", cue: "text" },
    ans: [
      { jp: "おんなのこ", zh: "女孩" },
      { jp: "じてんしゃ", zh: "自行車" },
      { jp: "あたらしい", zh: "嶄新的" }
    ],
    wrong: []
  };
  UI.drawBossQuiz(ctx, bossQ, "keyboard");
  for (const want of ["おんなのこ", "じてんしゃ", "あたらしい"]) {
    const fills = traces.filter(t => t.type === "fill" && t.text.includes(want));
    assert.equal(fills.length, 1, `${want} 應單行繪製（真字寬下不折行），實得 ${fills.length}`);
    assert.ok(fills[0].fontSize >= 13, `${want} 字級 ${fills[0].fontSize} 應 >= 13px`);
    assert.ok(!fills[0].maxWidth, `${want} 不得用 maxWidth 非等比壓扁`);
  }
});

test("2. 超長 12 假名手機窄欄自動折兩行、行距不重疊", () => {
  const { UI, ctx, traces } = loadUIEnv();
  ctx.font = "900 18px 'Noto Sans JP', sans-serif";
  traces.length = 0;
  UI.fitText(ctx, "あさごはんをまいにちたべる", 200, 300, 72, { minSize: 13, wrap: true });
  const fills = traces.filter(t => t.type === "fill");
  assert.equal(fills.length, 2, "超長詞在 72px 窄欄應折為兩行");
  assert.ok(fills[0].y < fills[1].y, "第一行應在第二行上方");
  assert.ok(fills[1].y - fills[0].y >= 10, "兩行行距應 >= 10px 不重疊");
  for (const f of fills) assert.ok(f.fontSize >= 10, `折行字級 ${f.fontSize} 應 >= 10px`);
});

test("3. 圖鑑手機版：篩選按鈕熱區可點、5 假名卡單行不溢出、極窄才折行不重疊", () => {
  const traces = [];
  const ctx = {
    font: "900 12px 'Noto Sans JP', sans-serif",
    fillStyle: "#24180f",
    textAlign: "center",
    save() {}, restore() {},
    measureText(text) {
      const m = String(this.font).match(/([\d.]+)px/);
      return { width: trueWidth(text, m ? Number(m[1]) : 12) };
    },
    fillText(text, x, y, maxWidth) {
      const m = String(this.font).match(/([\d.]+)px/);
      traces.push({ text: String(text), x, y, fontSize: m ? Number(m[1]) : 12, maxWidth });
    }
  };
  const hooks = {
    readableFont: (size, weight) => `${weight || "900"} ${size}px 'Noto Sans JP', sans-serif`,
    drawWoodTag() {}, drawButton() {}
  };
  const cards = [
    { key: "onna", jp: "おんなのこ", zh: "女孩", kana: "おんなのこ", reveal: "open", progress: "4/4" }
  ];
  const viewport = { width: 844, height: 390, scale: 0.5, offsetX: 0, offsetY: 0 };
  const out = cardGallery.draw(ctx, cards, { filter: { by: "all", id: null }, page: 0 }, hooks, viewport, { stages: [], packs: [] });
  const stageBtn = out.buttons.find(b => b.id === "filter-stage");
  assert.ok(stageBtn, "應有 filter-stage 按鈕");
  const hit = cardGallery.hit({ x: stageBtn.x + stageBtn.w / 2, y: stageBtn.y + stageBtn.h / 2 }, out.buttons);
  assert.equal(hit && hit.id, "filter-stage");
  assert.equal(hit.ok, true, "篩選按鈕中心點應可點中（無誤觸偏移）");
  const jpFills = traces.filter(t => t.text === "おんなのこ");
  // jp 行與 kana 行同字，各單行一次；若被折行會出現「おんな」/「のこ」碎片
  assert.equal(jpFills.length, 2, "jp 行與 kana 行應各單行一次");
  assert.ok(!traces.some(t => t.text === "おんな" || t.text === "のこ"), "手機卡 5 假名不應被折行打碎");
  assert.ok(jpFills.every(t => t.fontSize >= 10), "圖鑑字級應 >= 10px");

  // 極窄欄（35px）才折行，且兩行不重疊
  traces.length = 0;
  cardGallery.ink(ctx, hooks, 14, "とうもろこし", 100, 200, 35);
  assert.equal(traces.length, 2, "極窄欄應折為兩行");
  assert.ok(traces[0].y < traces[1].y && traces[1].y - traces[0].y >= 8, "折行行距不重疊");
});
