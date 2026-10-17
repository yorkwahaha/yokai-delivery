"use strict";
// 副工作：結算回顧詞條長詞壓字 focused 驗收。
// 真機實證（844x390 手機，readableFont 14→22px boost）：
//   「おんなのこ（女孩）」198px、「とうもろこし（玉米）」220px，
//   review 鈕 safe 寬僅 138px → fillText maxWidth 非等比壓扁 0.63~0.70。
// 修復：js/ui.js drawButton 新增 opt-in fit（等比縮字，默認關閉零影響），
// 結算回顧調用處傳 fit:true。桌機（14px 下 126px<=138）不觸發，原樣保留。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function loadUI(scale) {
  const traces = [];
  const ctx = new Proxy({
    font: "900 14px sans-serif",
    fillStyle: "#000", strokeStyle: "#000",
    textAlign: "center", textBaseline: "alphabetic", lineWidth: 1,
    shadowBlur: 0,
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {},
    translate() {},
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(t) {
      const m = String(this.font).match(/([\d.]+)px/);
      const s = m ? Number(m[1]) : 14;
      let w = 0;
      for (const ch of String(t)) w += ch.codePointAt(0) < 256 ? s * 0.55 : s * 1.0;
      return { width: w, actualBoundingBoxAscent: s * 0.76, actualBoundingBoxDescent: s * 0.12 };
    },
    fillText(t, x, y, mw) {
      const m = String(this.font).match(/([\d.]+)px/);
      traces.push({ text: String(t), size: m ? Number(m[1]) : 14, maxWidth: mw });
    },
    strokeText() {}
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const env = {
    window: {
      VIEWPORT: {
        bounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
        hudBounds: () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 }),
        get: () => ({ scale })
      },
      matchMedia: () => ({ matches: false })
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 844, height: 390 }) }),
      fonts: { check: () => true, load: async () => {} }
    },
    Date: { now: () => 1000 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  return { UI: env.window.UI, ctx, traces };
}

const BTN = { id: "review-0", x: 305, y: 428, w: 164, h: 44 };

test("1. 手機尺度回顧長詞：fit 等比縮字、字形不壓扁", () => {
  const { UI, ctx, traces } = loadUI(0.65); // readableFont 14→22px，與真 Chrome 一致
  traces.length = 0;
  UI.drawButton(ctx, BTN, "とうもろこし（玉米）", { size: 14, quiet: true, fit: true });
  const fills = traces.filter(t => t.text === "とうもろこし（玉米）");
  assert.ok(fills.length >= 1, "應繪出回顧詞條");
  assert.ok(fills[0].size < 22, `應等比縮小，實得 ${fills[0].size}px`);
  assert.ok(fills[0].size >= 10, `縮後應 >= 可讀下限 10px，實得 ${fills[0].size}px`);
  assert.equal(fills[0].text, "とうもろこし（玉米）", "文字不得被截斷");
});

test("2. 未傳 fit 的按鈕維持原渲染（零影響）", () => {
  const { UI, ctx, traces } = loadUI(0.65);
  traces.length = 0;
  UI.drawButton(ctx, BTN, "とうもろこし（玉米）", { size: 14, quiet: true });
  const fills = traces.filter(t => t.text === "とうもろこし（玉米）");
  assert.equal(fills[0].size, 22, "不傳 fit 應維持原字級（舊行為保留，僅此一處調用改傳 fit）");
});

test("3. 桌機尺度不受影響（14px 下 126px<=138 不觸發縮字）", () => {
  const { UI, ctx, traces } = loadUI(1);
  traces.length = 0;
  UI.drawButton(ctx, BTN, "おんなのこ（女孩）", { size: 14, quiet: true, fit: true });
  const fills = traces.filter(t => t.text === "おんなのこ（女孩）");
  assert.equal(fills[0].size, 14, "桌機不應縮字，原樣保留");
});
