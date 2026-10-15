"use strict";
// Stage3-8 Boss 封印題板＋血條 focused 驗收（本階段唯一）。
// 真機實證（844x390 手機尺度真頁渲染，真實 Stage8 詞＋Boss title）：
//   選項三 5 假名单行等比、血條在題板下方 12px 無重疊；
//   但 Boss 名（黃泉邪神·言靈之核）在血條左側不可見——drawBossBar 畫名前未設
//   fillStyle（沿用題板深色 #352822），在深底上隱形（前人改 title 支持時掉色）。
// 修復：js/ui.js 補 `ctx.fillStyle = "#f4deb1"` 一行，其餘零動。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function loadUI(right) {
  const traces = [];
  const ctx = new Proxy({
    font: "900 18px sans-serif",
    fillStyle: "#000", strokeStyle: "#000",
    textAlign: "center", textBaseline: "alphabetic", lineWidth: 1,
    shadowBlur: 0, globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    fillRect() {}, translate() {}, scale() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {},
    createLinearGradient() { return { addColorStop() {} }; },
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
  const bounds = { left: 0, top: 0, right, bottom: 600, width: right, height: 600 };
  const env = {
    window: {
      VIEWPORT: {
        bounds: () => bounds,
        hudBounds: () => bounds,
        get: () => ({ scale: 0.65, width: right, height: 600, offsetX: 0, offsetY: 0 })
      },
      matchMedia: () => ({ matches: false })
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: right, height: 390 }) }),
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
  ans: [{ jp: "おんなのこ", zh: "女孩" }, { jp: "ありがとう", zh: "謝謝" }, { jp: "あたたかい", zh: "溫暖的" }],
  wrong: []
};
const BOSS = { hp: 200, max: 300, shield: true, title: "黃泉邪神·言靈之核", final: true };

test("Stage8 Boss 題板：5 假名單行、血條分離、Boss 名淺色可見且不出條", () => {
  for (const right of [844, 1194]) {
    const { UI, ctx, traces } = loadUI(right);
    traces.length = 0;
    const layout = UI.bossQuizLayout(3);
    UI.drawBossQuiz(ctx, BOSQ, "keyboard", BOSS, 0);
    // 選項：三 5 假名单行等比無壓扁
    for (const want of ["おんなのこ", "ありがとう", "あたたかい"]) {
      const fills = traces.filter(t => t.text.includes(want));
      assert.equal(fills.length, 1, `${right}: ${want} 應單行`);
      assert.ok(fills[0].size >= 13 && !fills[0].maxWidth, `${right}: ${want} 等比不壓扁`);
    }
    // 血條在題板下方，不重疊
    assert.ok(layout.bar.y >= layout.y + layout.h + 10, `${right}: 血條應在題板下方分離`);
    // Boss 名：淺色、落在條內
    const names = traces.filter(t => t.text === "黃泉邪神·言靈之核");
    assert.equal(names.length, 1, `${right}: 應繪出 Boss 名`);
    assert.equal(names[0].fill, "#f4deb1", `${right}: Boss 名應為淺色（非沿用深色）`);
    assert.ok(names[0].x >= layout.bar.x && names[0].x + 9 * names[0].size <= layout.bar.x + layout.bar.w,
      `${right}: 9 字 Boss 名應在條寬內`);
    // 選項觸控高：手機 68（44 CSS），寬版不縮水
    for (const o of layout.options) assert.ok(o.h >= 44, `${right}: 選項高應 >= 44`);
  }
});
