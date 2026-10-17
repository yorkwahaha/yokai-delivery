"use strict";
// 主1：第一關真戰鬥答題墊 5 假名 focused 驗收（唯一一組，不建 Chrome harness）。
// 真機實證（WinTemp 臨時注入腳本，已刪）：
//   平板 tilt0.6 padjob-1194x834（パン/ひと/みぎ 三墊清晰無重疊無 HUD 遮擋）
//   桌機 tilt1.0 padjob-1280x800-r0-has5（プレゼント/こんにちは/おんなのこ）
//   → art/stage1-night-town/Preview_pad5_muse.png
// 目視結論：三墊皆單行等比、字形端正；墊圈小於字寬屬既有置頂設計（game.js 註記），
// 相鄰墊字距充足、無 HUD 重疊 → 無真缺陷，js/ui.js 零修改。

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const WORLD = require("../js/world.js");
const WORDS = require("../js/words.js");

const NIGHT_TOWN_PACKS = ["animals", "station", "pond", "town-people", "town-house", "town-places"];

// 保守真字寬：全形 1.08em（真 Chrome 實測 1.00~1.083 上界），ASCII 0.55em。
function trueWidth(text, size) {
  let w = 0;
  for (const ch of String(text)) w += ch.codePointAt(0) < 256 ? size * 0.55 : size * 1.08;
  return w;
}
function px(font) {
  const m = String(font).match(/([\d.]+)px/);
  return m ? Number(m[1]) : 16;
}

function loadUI() {
  const traces = [];
  const ctx = new Proxy({
    font: "400 33px sans-serif",
    fillStyle: "#000", strokeStyle: "#000",
    textAlign: "center", textBaseline: "alphabetic",
    lineWidth: 1,
    save() {}, restore() {}, beginPath() {}, stroke() {}, fill() {},
    measureText(t) { return { width: trueWidth(t, px(this.font)) }; },
    fillText(t, x, y, mw) { traces.push({ type: "fill", text: String(t), x, y, size: px(this.font), maxWidth: mw }); },
    strokeText(t, x, y, mw) { traces.push({ type: "stroke", text: String(t), x, y, size: px(this.font), maxWidth: mw }); }
  }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const env = {
    window: { VIEWPORT: { hudBounds: () => ({ left: 0, right: 900, top: 0, bottom: 600 }), get: () => ({ scale: 1 }) } },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 900, height: 600 }) }),
      fonts: { check: () => true, load: async () => {} }
    },
    Date: { now: () => 1000 }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  return { UI: env.window.UI, ctx, traces };
}

test("1. 第一關實詞最長即 5 假名（おんなのこ），杜絕未來長詞撐破答題墊", () => {
  const packs = (WORDS.CONTENT || WORDS).WORD_PACKS;
  let longest = "";
  for (const id of NIGHT_TOWN_PACKS) {
    for (const w of packs[id].words || []) {
      if (w && w.decoy !== true) {
        const jp = typeof w === "string" ? w : w.jp;
        if (jp && jp.length > longest.length) longest = jp;
      }
    }
  }
  assert.equal(longest, "おんなのこ");
  assert.ok(longest.length <= 5, `第一關實詞最長應 <= 5 假名，實得 ${longest}`);
});

test("2. 答題墊 5 假名@33px 單行等比不壓字（maxPadW 190 真路徑）", () => {
  const { UI, ctx, traces } = loadUI();
  ctx.font = "400 33px 'Noto Sans JP', sans-serif";
  traces.length = 0;
  for (const word of ["おんなのこ", "プレゼント", "こんにちは"]) {
    traces.length = 0;
    UI.fitText(ctx, word, 400, 300, 190, { minSize: 18, wrap: true, stroke: true, y1: 299, y2: 315 });
    const fills = traces.filter(t => t.type === "fill");
    assert.equal(fills.length, 1, `${word} 應單行（真截圖一致），實得 ${fills.length} 行`);
    assert.equal(fills[0].size, 33, `${word} 不應被縮小，實得 ${fills[0].size}px`);
    assert.ok(!fills[0].maxWidth, `${word} 不得用 maxWidth 非等比壓扁`);
  }
});

test("3. 相鄰墊字距充足＋淘汰墊 5 假名单行可讀（墊位來自 world.answerPositions）", () => {
  const pads = WORLD.answerPositions({ x: 1000, y: 1000 });
  const gap = pads[1].x - pads[0].x;
  assert.equal(gap, 220);
  // fitText 把單行字寬封頂在 maxPadW＝190（ui.js 真路徑），相鄰字邊距 >= 30px
  assert.ok(gap - 190 >= 30, `相鄰墊字邊距應 >= 30px，實得 ${gap - 190}`);
  // 淘汰墊（maxElimW 64, minSize 11）：5 假名等比 12.8px 單行，不觸發折行重疊
  const { UI, ctx, traces } = loadUI();
  ctx.font = "400 19px 'Noto Sans JP', sans-serif";
  traces.length = 0;
  UI.fitText(ctx, "おんなのこ", 400, 306, 64, { minSize: 11, wrap: true, y1: 301, y2: 312 });
  const fills = traces.filter(t => t.type === "fill");
  assert.equal(fills.length, 1, "淘汰墊 5 假名應單行");
  assert.ok(fills[0].size >= 11 && fills[0].size <= 19, `淘汰墊字級應在 [11,19]，實得 ${fills[0].size}`);
});
