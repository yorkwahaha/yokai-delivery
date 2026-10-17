"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const cardGallery = require("../js/card-gallery-ui.js");

function loadUIEnv() {
  const traces = [];
  const baseContext = {
    font: "700 18px 'Noto Sans JP', sans-serif",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    textAlign: "center",
    textBaseline: "alphabetic",
    save() {},
    restore() {},
    beginPath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    translate() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    arc() {},
    rect() {},
    measureText(text) {
      const match = String(this.font).match(/([\d.]+)px/);
      const size = match ? Number(match[1]) : 16;
      return { width: Array.from(String(text)).length * size * 0.96 };
    },
    fillText(text, x, y, maxWidth) {
      const match = String(this.font).match(/([\d.]+)px/);
      const size = match ? Number(match[1]) : 16;
      traces.push({
        type: "fill",
        text: String(text),
        x,
        y,
        font: this.font,
        fontSize: size,
        maxWidth,
        fill: this.fillStyle
      });
    },
    strokeText(text, x, y, maxWidth) {
      const match = String(this.font).match(/([\d.]+)px/);
      const size = match ? Number(match[1]) : 16;
      traces.push({
        type: "stroke",
        text: String(text),
        x,
        y,
        font: this.font,
        fontSize: size,
        maxWidth,
        stroke: this.strokeStyle
      });
    }
  };

  const context = new Proxy(baseContext, {
    get: (o, k) => (k in o ? o[k] : () => {})
  });

  const env = {
    window: {
      VIEWPORT: {
        hudBounds: () => ({ left: 0, right: 900, top: 0, bottom: 600 }),
        get: () => ({ scale: 1 })
      }
    },
    document: {
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 900, height: 600 }) }),
      fonts: {
        check: () => true,
        load: async () => {}
      }
    },
    Date: { now: () => 1000 }
  };

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8"), env);
  return { UI: env.window.UI, context, traces };
}

test("1. 日語斷句 splitText2 與禁則處理（小假名/長音/標點絕不落於第二行行首）", () => {
  const { UI } = loadUIEnv();

  // 5 假名標準詞：おんなのこ -> おんな / のこ
  const [s1, s2] = UI.splitText2("おんなのこ");
  assert.equal(s1, "おんな");
  assert.equal(s2, "のこ");

  // 6 假名標準詞：とうもろこし -> とうも / ろこし
  const [c1, c2] = UI.splitText2("とうもろこし");
  assert.equal(c1, "とうも");
  assert.equal(c2, "ろこし");

  // 促音禁則測試：ちょっと -> ちょっ / と（っ 禁落行首）
  const [k1, k2] = UI.splitText2("ちょっと");
  assert.equal(k1, "ちょっ");
  assert.equal(k2, "と");

  // 長音禁則測試：コーヒー -> コー / ヒー（ー 禁落行首）
  const [cf1, cf2] = UI.splitText2("コーヒー");
  assert.ok(!cf2.startsWith("ー"), "長音符號不應落於第二行行首");

  // 選項帶按鍵標籤：1 おんなのこ (7 chars) -> 1 おん / なのこ
  const [b1, b2] = UI.splitText2("1 おんなのこ");
  assert.equal(b1, "1 おん");
  assert.equal(b2, "なのこ");
});

test("2. Boss 選項 5 假名詞（おんなのこ、じてんしゃ）採等比縮小單行呈現，字形不被壓扁", () => {
  const { UI, context, traces } = loadUIEnv();
  const bossQ = {
    word: { zh: "女孩", jp: "おんなのこ", cue: "text" },
    ans: [
      { jp: "おんなのこ", zh: "女孩" },
      { jp: "じてんしゃ", zh: "自行車" },
      { jp: "あたらしい", zh: "嶄新的" }
    ],
    wrong: []
  };

  UI.drawBossQuiz(context, bossQ, "keyboard");

  // 尋找 3 個選項的繪製紀錄
  const optionFills = traces.filter(t => t.text.includes("おんなのこ") || t.text.includes("じてんしゃ") || t.text.includes("あたらしい"));
  assert.equal(optionFills.length, 3, "應成功繪製 3 個選項");

  for (const fill of optionFills) {
    // 5 假名字級自 18px 等比縮至可讀區間（>= 13px）
    assert.ok(fill.fontSize >= 13, `字級 ${fill.fontSize} 應高於可讀下限 13px`);
    assert.ok(fill.fontSize <= 18, `字級 ${fill.fontSize} 不應超過原設 18px`);
    // fillText 不得帶有會壓扁字體的 maxWidth
    assert.ok(!fill.maxWidth || fill.maxWidth >= fill.fontSize * 5, "不應發生非等比壓扁");
  }
});

test("3. Boss 選項長詞/短句（> 8 假名）低於 13px 下限時自動安全拆為二行，垂直置中且不生新 UI", () => {
  const { UI, context, traces } = loadUIEnv();
  // 12 假名長短句，在寬度 ~130px 的木牌選項中，單行等比字級會降至 ~10px < 13px
  const longSentence = "あさごはんをまいにちたべる";
  const bossQ = {
    word: { zh: "每天吃早餐", jp: longSentence, cue: "text" },
    ans: [
      { jp: longSentence, zh: "每天吃早餐" },
      { jp: "ねこ", zh: "貓" },
      { jp: "いぬ", zh: "狗" }
    ],
    wrong: []
  };

  UI.drawBossQuiz(context, bossQ, "keyboard");

  const longOptionFills = traces.filter(t => t.text.includes("あさごはん") || t.text.includes("まいにち"));
  assert.equal(longOptionFills.length, 2, "長詞應折成兩行繪製");
  assert.notEqual(longOptionFills[0].y, longOptionFills[1].y);
  assert.ok(longOptionFills[0].y < longOptionFills[1].y, "第一行應在第二行上方");
});

test("4. 答題墊 fitText：寬詞等比縮小，超長詞安全折為兩行，無破圖或越界", () => {
  const { UI, context, traces } = loadUIEnv();

  // 測試 6 假名詞「とうもろこし」在答題墊（maxPadW = 190, minSize = 18）
  context.font = "700 33px 'Yuji Syuku', serif";
  traces.length = 0;

  UI.fitText(context, "とうもろこし", 200, 300, 190, {
    minSize: 18,
    wrap: true,
    stroke: true
  });

  const fills = traces.filter(t => t.type === "fill");
  const strokes = traces.filter(t => t.type === "stroke");
  assert.ok(fills.length >= 1, "應繪製 fillText");
  assert.ok(strokes.length >= 1, "應繪製 strokeText 輪廓保證墨線質感");

  // 測量寬度：6 * 33 * 0.96 = 190.08，等比縮放自 33px 微調至 ~32.9px（>= 18px 單行）
  assert.equal(fills.length, 1, "とうもろこし 應等比微縮維持單行");
  assert.ok(fills[0].fontSize >= 18 && fills[0].fontSize <= 33);

  // 測試超長短句「あさごはんをまいにちたべる」（12 假名）：字級需降至 14px < 18px，應折為兩行
  traces.length = 0;
  UI.fitText(context, "あさごはんをまいにちたべる", 200, 300, 190, {
    minSize: 18,
    wrap: true,
    stroke: true,
    y1: 293,
    y2: 315
  });

  const longFills = traces.filter(t => t.type === "fill");
  assert.equal(longFills.length, 2, "超長詞在答題墊應折為兩行");
  assert.equal(longFills[0].y, 293);
  assert.equal(longFills[1].y, 315);
});

test("5. 單字圖鑑 card-gallery-ui.ink：5-6 假名詞等比微縮，窄欄位折為兩行不重疊", () => {
  const traces = [];
  const mockCtx = {
    font: "900 14px 'Noto Sans JP', sans-serif",
    fillStyle: "#24180f",
    measureText(text) {
      const match = String(this.font).match(/([\d.]+)px/);
      const size = match ? Number(match[1]) : 14;
      return { width: Array.from(String(text)).length * size * 0.96 };
    },
    fillText(text, x, y, maxWidth) {
      const match = String(this.font).match(/([\d.]+)px/);
      const size = match ? Number(match[1]) : 14;
      traces.push({ text: String(text), x, y, font: this.font, fontSize: size, maxWidth });
    }
  };

  const hooks = {
    readableFont: (size, weight) => `${weight || "900"} ${size}px 'Noto Sans JP', sans-serif`
  };

  // 在寬度 60px 的卡片欄位繪製 5 假名「おんなのこ」
  // 5 * 14 * 0.96 = 67.2px > 60px
  // 等比微縮：14 * (60 / 67.2) = 12.5px（高於下限 10px）-> 單行等比縮小
  cardGallery.ink(mockCtx, hooks, 14, "おんなのこ", 100, 200, 60);

  assert.equal(traces.length, 1, "おんなのこ 應單行呈現");
  assert.ok(traces[0].fontSize >= 10, "字級應在可讀下限 10px 以上");
  assert.equal(traces[0].text, "おんなのこ");

  // 在極窄欄位 35px 繪製「とうもろこし」（6 假名）
  // 6 * 14 * 0.96 = 80.64px -> 等比縮小後為 6px（低於 10px）-> 折為兩行
  traces.length = 0;
  cardGallery.ink(mockCtx, hooks, 14, "とうもろこし", 100, 200, 35);

  assert.equal(traces.length, 2, "とうもろこし 在極窄欄位應折為兩行");
  assert.equal(traces[0].text, "とうも");
  assert.equal(traces[1].text, "ろこし");
  assert.ok(traces[0].y < traces[1].y, "第一行 y 應小於第二行 y");
});
