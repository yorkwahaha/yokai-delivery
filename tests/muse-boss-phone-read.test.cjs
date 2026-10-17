"use strict";
// 副1：Boss 題板手機橫向（844 CSS 寬）5 假名長字可讀，單一短測試。
// 復用證據：圖鑑手機橫向已由 award-844x390-dev.png＋muse-c4-progress-ux 第 3 項覆蓋，
// 本檔只補 Boss 題板窄版（w=354/optW=102/可用 90px）真路徑。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function trueWidth(text, size) {
  let w = 0;
  for (const ch of String(text)) {
    if (ch === " ") w += size * 0.3;
    else w += ch.codePointAt(0) < 256 ? size * 0.55 : size * 1.08;
  }
  return w;
}
function px(font) {
  const m = String(font).match(/([\d.]+)px/);
  return m ? Number(m[1]) : 16;
}

test("手機橫向 Boss 題板 5 假名单行等比、>=13px、無壓扁", () => {
  const traces = [];
  const ctx = new Proxy({
    font: "900 18px sans-serif",
    fillStyle: "#000", strokeStyle: "#000",
    textAlign: "center", textBaseline: "alphabetic", lineWidth: 1,
    save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    measureText(t) { return { width: trueWidth(t, px(this.font)) }; },
    fillText(t, x, y, mw) { traces.push({ text: String(t), x, y, size: px(this.font), maxWidth: mw }); },
    strokeText() {}
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const env = {
    window: {
      VIEWPORT: {
        hudBounds: () => ({ left: 0, right: 844, top: 0, bottom: 390 }),
        get: () => ({ scale: 1, width: 844, height: 390 })
      }
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 844, height: 390 }) }),
      fonts: { check: () => true, load: async () => {} }
    },
    Date: { now: () => 1000 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  const UI = env.window.UI;
  const layout = UI.bossQuizLayout(3);
  assert.ok(layout.options[0].w <= 102, `手機橫向選項寬應 <= 102，實得 ${layout.options[0].w}`);
  UI.drawBossQuiz(ctx, {
    word: { zh: "女孩", jp: "おんなのこ", cue: "text" },
    ans: [{ jp: "おんなのこ" }, { jp: "じてんしゃ" }, { jp: "あたらしい" }],
    wrong: []
  }, "keyboard");
  for (const want of ["おんなのこ", "じてんしゃ", "あたらしい"]) {
    const fills = traces.filter(t => t.text.includes(want));
    assert.equal(fills.length, 1, `${want} 手機橫向應單行，實得 ${fills.length}`);
    assert.ok(fills[0].size >= 13, `${want} 字級 ${fills[0].size} 應 >= 13px`);
    assert.ok(!fills[0].maxWidth, `${want} 不得用 maxWidth 壓扁`);
  }
});
