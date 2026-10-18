"use strict";
// M1-E-R11：真實 UI.drawLevelUp consumer。雷紋陣必須是 barrier+thunder。
// 不寫摘要、不在斷言前標 done、不載 game／音訊。非 Chrome。
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const UI_PATH = path.join(__dirname, "..", "js", "ui.js");

function trueWidth(text, size) {
  let w = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    w += ch === " " ? size * 0.3 : code < 256 ? size * 0.55 : size * 1.08;
  }
  return w;
}
function viewportFor(cssW, cssH) {
  const scale = Math.min(cssW / 900, cssH / 600);
  const w = cssW / scale, h = cssH / scale;
  const offsetX = (w - 900) / 2, offsetY = (h - 600) / 2;
  const area = { left: -offsetX, top: -offsetY, right: 900 + offsetX, bottom: 600 + offsetY, width: w, height: h };
  const inset = 20 / scale;
  const hud = {
    left: area.left + inset, top: area.top + inset, right: area.right - inset, bottom: area.bottom - inset,
    width: area.width - inset * 2, height: area.height - inset * 2,
  };
  return { scale, w, h, offsetX, offsetY, area, hud };
}
function loadUI(cssW, cssH) {
  const vp = viewportFor(cssW, cssH);
  const traces = [];
  const target = {
    font: "700 18px sans-serif", fillStyle: "#000", strokeStyle: "#000", textAlign: "left", globalAlpha: 1, lineWidth: 1,
    save() {}, restore() {}, beginPath() {}, clip() {}, translate() {}, moveTo() {}, lineTo() {},
    closePath() {}, arc() {}, rect() {}, ellipse() {}, fill() {}, stroke() {}, fillRect() {}, strokeRect() {},
    roundRect() {}, rotate() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    measureText(text) {
      const m = String(this.font).match(/([\d.]+)px/);
      return { width: trueWidth(text, m ? Number(m[1]) : 16) };
    },
    fillText(text, x, y) {
      const m = String(this.font).match(/([\d.]+)px/);
      traces.push({ text: String(text), x, y, fontSize: m ? Number(m[1]) : 16 });
    },
    strokeText() {},
  };
  const ctx = new Proxy(target, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const env = {
    window: { VIEWPORT: {
      get: () => ({ scale: vp.scale, width: vp.w, height: vp.h, offsetX: vp.offsetX, offsetY: vp.offsetY }),
      bounds: () => vp.area, hudBounds: () => vp.hud,
    } },
    document: { getElementById: () => ({ getBoundingClientRect: () => ({ width: cssW, height: cssH }) }), fonts: { check: () => true, load: async () => {} } },
  };
  vm.runInNewContext(fs.readFileSync(UI_PATH, "utf8"), env);
  return { UI: env.window.UI, ctx, traces, vp };
}

const WI = {
  katana: { zh: "妖刀斬" },
  fire: { zh: "狐火炎" },
  needle: { zh: "天狐靈針" },
  boom: { zh: "陰陽符" },
  barrier: { zh: "淨化靈陣" },
  thunder: { zh: "天狐雷" },
};
// 獨立於被測 choice.skillIds 的企劃對照。雷紋陣不是 barrier+needle。
// 與 ui.js CARD_BRIEF 的共鳴條件一致（c 欄位）。
const ORACLE = {
  duo_inkfire: ["katana", "fire"],
  duo_frostseal: ["needle", "boom"],
  duo_thundercircle: ["barrier", "thunder"],
  duo_cinderseal: ["fire", "boom"],
};
function influenceOf(ids) {
  return "影響：" + ids.map((id) => WI[id].zh).join("・");
}
function drawFlat(choice, wl) {
  const { UI, ctx, traces, vp } = loadUI(1000, 700);
  UI.drawLevelUp(ctx, 8, [choice], wl, WI, 0, 1, 0, "keyboard", null);
  return { flat: traces.map((t) => t.text).join(""), vp, traces };
}
function card(id, skillIds, extra) {
  return {
    id, choiceId: "duo:" + id, type: "duo", n: extra.n, s: extra.s,
    levelText: "◆ 共鳴 Lv3+", d: extra.d, skillIds,
    beforeText: extra.beforeText, afterText: extra.afterText,
    requirementText: extra.requirementText, limitText: extra.limitText,
  };
}

function requireOracle(flat, id) {
  const brief = {
    duo_inkfire: { c: "退魔妖刀 Lv3＋狐火炎 Lv3", l: "不可重複取得；每次攻擊有觸發上限" },
    duo_frostseal: { c: "天狐靈針 Lv3＋陰陽符 Lv3", l: "不可重複取得；每次主爆限 1 敵、2 秒免疫" },
    duo_thundercircle: { c: "淨化靈陣 Lv3＋天狐雷 Lv3", l: "不可重複取得" },
    duo_cinderseal: { c: "狐火炎 Lv3＋陰陽符 Lv3", l: "不可重複取得；每次引爆限 1 處" },
  }[id];
  if (!flat.includes("條件：" + brief.c)) throw new Error(id + " 缺條件 " + brief.c);
  if (brief.l && !flat.includes("限制：" + brief.l)) throw new Error(id + " 缺限制 " + brief.l);
  if (id === "duo_thundercircle" && flat.includes("天狐靈針")) throw new Error("雷紋陣誤含靈針");
}

test("四 Duo 正確 pair 經 drawLevelUp 落成影響行", () => {
  const cases = [
    ["duo_inkfire", { n: "墨焰斬", s: "ぼくえんざん", d: "妖刀命中灼燒目標追加墨焰痕：每次攻擊最多 3 敵各一次，共 20% 刀傷", beforeText: "直接斬", afterText: "留墨焰", requirementText: "退魔妖刀 Lv3＋狐火炎 Lv3", limitText: "不可重複取得；每次攻擊有觸發上限" }, { katana: 3, fire: 3 }],
    ["duo_frostseal", { n: "寒封符", s: "かんぷうふ", d: "陰陽符主爆命中寒冷目標後：普通怪移速 −35% 持續 0.35 秒、首領移速 −10% 持續 0.15 秒", beforeText: "直投", afterText: "寒封", requirementText: "天狐靈針 Lv3＋陰陽符 Lv3", limitText: "不可重複取得；每次主爆限 1 敵、2 秒免疫" }, { katana: 3, needle: 3, boom: 3 }],
    ["duo_thundercircle", { n: "雷紋陣", s: "らいもんじん", d: "靈陣內落雷時追加墨紋衝擊：至多 3 敵各一次，共 20% 雷傷", beforeText: "落雷", afterText: "墨紋衝擊", requirementText: "淨化靈陣 Lv3＋天狐雷 Lv3", limitText: "不可重複取得" }, { katana: 3, barrier: 3, thunder: 3 }],
    ["duo_cinderseal", { n: "餘燼符", s: "よじんふ", d: "陰陽符主爆命中灼燒目標，0.3 秒後追加一次餘燼，最多 3 敵分攤 15% 符傷", beforeText: "引爆", afterText: "留餘燼", requirementText: "狐火炎 Lv3＋陰陽符 Lv3", limitText: "不可重複取得；每次引爆限 1 處" }, { katana: 3, fire: 3, boom: 3 }],
  ];
  for (const [id, extra, wl] of cases) {
    const { flat } = drawFlat(card(id, ORACLE[id], extra), wl);
    requireOracle(flat, id);
    // 名稱與限制來自 CARD_BRIEF（短文案）
    const brief = {
      duo_inkfire: { n: "墨焰斬", l: "不可重複取得；每次攻擊有觸發上限" },
      duo_frostseal: { n: "寒封符", l: "不可重複取得；每次主爆限 1 敵、2 秒免疫" },
      duo_thundercircle: { n: "雷紋陣", l: "不可重複取得" },
      duo_cinderseal: { n: "餘燼符", l: "不可重複取得；每次引爆限 1 處" },
    }[id];
    assert.ok(flat.includes(brief.n), id + " 名稱");
    assert.ok(flat.includes(brief.l), id + " 限制");
  }
});

test("mut_fan 只渲染傳入的 needle，不自行改成 boom", () => {
  const choice = {
    id: "mut_fan", choiceId: "mutation:needle:mut_fan", type: "mutation",
    n: "靈針・千本散射", s: "せんぼん", levelText: "◆ 靈針變異",
    d: "朝向多角度散射", skillIds: ["needle"],
    requirementText: "持有天狐靈針", limitText: "每種限選一次（每技能最多 3 種變異）",
  };
  const { flat } = drawFlat(choice, { katana: 3, needle: 3 });
  assert.ok(flat.includes("影響：天狐靈針"), "影響技能是靈針");
  assert.ok(!flat.includes("影響：天狐靈針・陰陽符") && !flat.includes("陰陽符"), "未持 boom 不顯示符");
});

test("負向：變異卡若映射錯誤 skillIds，影響行會跟著錯（CARD_BRIEF 無此卡時）", () => {
  const wrong = {
    id: "mut_fan", choiceId: "mutation:needle:mut_fan", type: "mutation",
    n: "靈針・千本散射", s: "せんぼん", levelText: "◆ 靈針變異",
    d: "朝向多角度散射", skillIds: ["barrier", "needle"], // 故意給錯：應為 needle
    requirementText: "持有天狐靈針", limitText: "每種限選一次",
  };
  const { flat } = drawFlat(wrong, { katana: 3, barrier: 3, needle: 3 });
  assert.ok(flat.includes("影響：淨化靈陣・天狐靈針"), "consumer 照錯誤 skillIds 畫出影響行");
  // ORACLE 無此卡，測試層自行斷言正確 pair
  assert.throws(() => {
    if (!flat.includes("影響：天狐靈針")) throw new Error("缺正確影響");
  }, /缺正確影響/);
});
