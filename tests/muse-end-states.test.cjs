"use strict";
// 勝敗/再戰結算狀態×文案×按鈕一致性 focused 驗收（本階段唯一）。
// game 側只傳 'won'/'lost'（game.js:4001），觸控判定走 UI.END_BTNS/reviewButtons 同源；
// 手機映射為均勻 0.65（game.js:3942 setTransform），邏輯高 600 內即全可見。
// 真機證據：Preview_settle_muse.png（lost 手機三鈕在框可點）；won 同幾何。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function loadUI() {
  const traces = [];
  const ctx = new Proxy({
    font: "700 15px sans-serif",
    fillStyle: "#000", strokeStyle: "#000",
    textAlign: "center", textBaseline: "alphabetic", lineWidth: 1,
    shadowBlur: 0, globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {},
    fillRect() {}, translate() {}, scale() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {},
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage() {},
    measureText(t) {
      const m = String(this.font).match(/([\d.]+)px/);
      const s = m ? Number(m[1]) : 15;
      let w = 0;
      for (const ch of String(t)) w += ch.codePointAt(0) < 256 ? s * 0.55 : s * 1.0;
      return { width: w, actualBoundingBoxAscent: s * 0.76, actualBoundingBoxDescent: s * 0.12 };
    },
    fillText(t, x, y) { traces.push({ text: String(t), x, y }); },
    strokeText() {}
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const env = {
    window: {
      VIEWPORT: {
        bounds: () => ({ left: -199, top: 0, right: 1099, bottom: 600, width: 1298, height: 600 }),
        hudBounds: () => ({ left: -168, top: 30, right: 1068, bottom: 569, width: 1236, height: 538 }),
        get: () => ({ scale: 0.65, width: 1298, height: 600, offsetX: 199, offsetY: 0 })
      },
      matchMedia: () => ({ matches: false }),
      FX: null, ART: null, RENDERER: null
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 844, height: 390 }) }),
      fonts: { check: () => true, load: async () => {} }
    },
    location: { search: "" },
    URLSearchParams,
    Date: { now: () => 99000 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  return { UI: env.window.UI, ctx, traces };
}

test("勝敗結算：標題/三鈕/回顧列與狀態一致，且全在手機映射可視內", () => {
  const misses = [{ jp: "おんなのこ", zh: "女孩" }, { jp: "ねこ", zh: "貓" }];
  for (const [state, title, expectedButtons] of [
    ["lost", "燈油已盡", ["再踏夜行", "回旅路地圖", "回到首頁"]],
    ["won", "夜已破曉", ["回旅路地圖"]],
  ]) {
    const { UI, ctx, traces } = loadUI();
    traces.length = 0;
    UI.drawEndScreen(ctx, state, 1234, state === "won" ? 6 : 2, 1, misses, 0, { time: 99 });
    const texts = traces.map(t => t.text);
    assert.ok(texts.includes(title), `${state} 應顯示「${title}」`);
    for (const label of expectedButtons) {
      assert.ok(texts.includes(label), `${state} 應有「${label}」鈕`);
    }
    // lost 有誤配才列回顧；won 無誤配不列回顧
    if (state === "lost") {
      assert.ok(texts.some(t => t.includes("今夜記錯的字")), `${state} 有誤配應列回顧頭`);
      assert.ok(texts.includes("おんなのこ（女孩）"), `${state} 回顧詞條應完整（fit 縮字不斷字）`);
    } else {
      assert.ok(!texts.some(t => t.includes("今夜記錯的字")), `${state} 勝利無誤配不應出現回顧頭`);
    }
    // 幾何：按鈕底緣在邏輯 600 內（手機均勻 0.65 即全可見）
    const buttons = state === "won" ? UI.endScreenButtons("won") : UI.END_BTNS;
    assert.ok(Math.max(...buttons.map(b => b.y + b.h)) <= 600, `${state} 結算鈕底應在 600 內`);
    if (state === "lost") {
      const rev = UI.reviewButtons(misses);
      assert.equal(rev.length, 2);
      assert.ok(Math.max(...rev.map(b => b.y + b.h)) <= 600, `${state} 回顧列應在 600 內`);
    }
  }
  // 無誤配＋勝利：顯示 clearText 而非回顧列（不並存、不打架）
  const { UI, ctx, traces } = loadUI();
  traces.length = 0;
  UI.drawEndScreen(ctx, "won", 2000, 6, 0, [], 0, { time: 99, clearText: "全配送達成・天晴" });
  const texts = traces.map(t => t.text);
  assert.ok(texts.includes("全配送達成・天晴"), "勝利無誤配應顯示 clearText");
  assert.ok(!texts.some(t => t.includes("今夜記錯的字")), "無誤配不應出現回顧頭");
});
