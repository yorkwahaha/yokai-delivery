"use strict";
// M1-E-R12.3：和紙內框可見性用真 canvas measureText，選卡看 applyChoice 的 appliedId。
// offer() 是受控插樁。受控真頁 ≠ 自然局、≠ 實機。
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const UI_PATH = path.join(__dirname, "..", "js", "ui.js");
const passed = [];
const failed = [];

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
  const paints = [];
  const target = {
    font: "700 18px sans-serif", fillStyle: "#000", strokeStyle: "#000", textAlign: "left", globalAlpha: 1, lineWidth: 1,
    save() {}, restore() {}, beginPath() {}, clip() {}, translate() {}, moveTo() {}, lineTo() {},
    closePath() {}, arc() {}, rect() {}, ellipse() {}, fill() {}, fillRect() {}, strokeRect() {},
    roundRect() {}, rotate() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    measureText(text) {
      const m = String(this.font).match(/([\d.]+)px/);
      return { width: trueWidth(text, m ? Number(m[1]) : 16) };
    },
    fillText(text, x, y) {
      const m = String(this.font).match(/([\d.]+)px/);
      traces.push({ text: String(text), x, y, fontSize: m ? Number(m[1]) : 16, fill: this.fillStyle });
    },
    stroke() { paints.push({ stroke: this.strokeStyle, lineWidth: this.lineWidth }); },
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
  return { UI: env.window.UI, ctx, traces, paints, vp };
}

const WI = {
  katana: { zh: "妖刀斬" }, fire: { zh: "狐火炎" }, needle: { zh: "天狐靈針" },
  boom: { zh: "陰陽符" }, barrier: { zh: "淨化靈陣" }, thunder: { zh: "天狐雷" },
};
const FROST = {
  id: "duo_frostseal", choiceId: "duo:duo_frostseal", type: "duo", n: "寒封符", s: "かんぷうふ",
  skillIds: ["needle", "boom"], beforeText: "直投", afterText: "寒封",
  d: "陰陽符主爆命中帶寒冷目標時給一次受限控場反應（普通怪凍結結束後追擊×0.65持續0.35秒，Boss追擊×0.90持續0.15秒；每cast限1敵、2秒免疫）",
  requirementText: "持有天狐靈針 Lv3+ 與 陰陽符 Lv3+",
  limitText: "每局限選一次（不占主動、御守、變異槽位；不重置冰封、Boss受限）",
};
const INK = {
  id: "duo_inkfire", choiceId: "duo:duo_inkfire", type: "duo", n: "墨焰斬", s: "ぼくえんざん",
  skillIds: ["katana", "fire"], beforeText: "直接斬", afterText: "留墨焰",
  d: "妖刀命中灼燒目標時留下墨焰痕（延遲 0.12 秒、半徑 56）；至多命中 3 敵各一次，總傷害為該次非暴擊刀傷 20% 分攤（無再派生）",
  requirementText: "持有退魔妖刀 Lv3+ 與 狐火炎 Lv3+",
  limitText: "每局限選一次（不占主動、御守、變異槽位；每次攻擊有觸發上限、無再派生）",
};
const FAN = {
  id: "mut_fan", choiceId: "mutation:mut_fan", type: "mutation", n: "靈針・千本散射", s: "せんぼん",
  skillIds: ["needle", "boom"], beforeText: "單向", afterText: "多角散射",
  d: "朝向多角度散射，發數增加且單發傷害分配受限",
  requirementText: "持有適用技能", limitText: "每種限選一次（每技能最多 3 種變異）",
};
function influence(ids) { return "影響：" + ids.map((id) => WI[id].zh).join("・"); }
function cardText(traces, L, i) {
  const y0 = L.card.y + i * (L.card.h + L.card.gap);
  const y1 = y0 + L.card.h;
  return traces.filter((t) => t.y >= y0 && t.y < y1 + 2).sort((a, b) => a.y - b.y || a.x - b.x);
}
function assertCard(traces, L, i, card, vp) {
  const rows = cardText(traces, L, i);
  const flat = rows.map((t) => t.text).join("");
  for (const bit of [card.n, card.d, card.beforeText, card.afterText, card.requirementText, card.limitText, influence(card.skillIds)]) {
    if (!flat.includes(bit)) throw new Error("卡" + i + " 缺 " + bit);
  }
  if (flat.includes("…")) throw new Error("卡" + i + " 截字");
  const y0 = L.card.y + i * (L.card.h + L.card.gap);
  for (const r of rows) {
    if (r.y + r.fontSize > y0 + L.card.h + 1) throw new Error("卡" + i + " 越底");
    const css = r.fontSize * vp.scale;
    if ((r.text.includes(card.requirementText.slice(0, 4)) || r.text.includes("限制") || r.text.includes(card.d.slice(0, 4))) && css < 14 - 0.05) {
      throw new Error("卡" + i + " CSS " + css);
    }
  }
  return flat;
}

const VPS = [[1000, 700, "桌機"], [844, 390, "手機"], [1024, 640, "平板"]];

test("寒封符與墨焰斬逐卡全文、影響技能、不截字", () => {
  for (const [cw, ch, tag] of VPS) {
    const { UI, ctx, traces, vp } = loadUI(cw, ch);
    const cards = [FROST, INK];
    const wl = { katana: 3, fire: 3, needle: 3, boom: 3 };
    UI.drawLevelUp(ctx, 6, cards, wl, WI, 1, 1, 0, "keyboard", null);
    const L = UI.levelUpLayout(2);
    const a = assertCard(traces, L, 0, FROST, vp);
    const b = assertCard(traces, L, 1, INK, vp);
    assert.ok(!a.includes(INK.d), tag + " 寒封符不借墨焰文");
    assert.ok(!b.includes(FROST.d), tag + " 墨焰斬不借寒封文");
    assert.ok(a.includes("影響：天狐靈針・陰陽符"), tag);
    assert.ok(b.includes("影響：妖刀斬・狐火炎") && !b.includes("天狐靈針"), tag);
    const y0 = L.card.y, y1 = y0 + L.card.h, y2 = y1 + L.card.gap;
    assert.ok(y1 <= y2, tag + " 卡不重疊");
    assert.ok(L.reroll.h * vp.scale >= 44 - 0.01, tag + " 重抽熱區");
  }
  passed.push("duo-full");
});

test("共享 fan 顯示明示 skillIds，count 0/1/2/3 與空池無幽靈卡", () => {
  const { UI, ctx, traces, vp } = loadUI(1000, 700);
  UI.drawLevelUp(ctx, 4, [FAN], { katana: 3, needle: 3, boom: 3 }, WI, 1, 1, 0, "touch", null);
  const L1 = UI.levelUpLayout(1);
  const flat = assertCard(traces, L1, 0, FAN, vp);
  assert.ok(flat.includes("影響：天狐靈針・陰陽符"), "共享兩技能");
  assert.ok(traces.map((t) => t.text).join("").includes("點選技能"), "觸控說明");
  for (const n of [0, 1, 2, 3]) {
    const L = UI.levelUpLayout(n);
    assert.equal(L.count, n, "count " + n);
  }
  const empty = loadUI(1000, 700);
  empty.UI.drawLevelUp(empty.ctx, 4, [], { katana: 3 }, WI, 0, 1, 0, "keyboard", null);
  const ghost = empty.traces.map((t) => t.text).join("");
  assert.ok(!ghost.includes("寒封符") && !ghost.includes("墨焰斬") && !ghost.includes("千本散射"), "空池無幽靈卡");
  passed.push("fan-empty");
});

test("缺欄回落、未知字元保留、焦點樣式不同", () => {
  const partial = { id: "mut_seek", choiceId: "mutation:mut_seek", type: "mutation", n: "引魂追跡", d: "失去目標後直行𠮷", skillIds: ["needle"] };
  const { UI, ctx, traces, paints } = loadUI(1024, 640);
  UI.drawLevelUp(ctx, 3, [partial, FAN], { katana: 3, needle: 2 }, WI, 1, 1, 1, "keyboard", null);
  const L = UI.levelUpLayout(2);
  const row0 = cardText(traces, L, 0).map((t) => t.text).join("");
  assert.ok(row0.includes("𠮷") && row0.includes("影響：天狐靈針"), "未知字與影響");
  assert.ok(!row0.includes("undefined"), "缺欄不顯示 undefined");
  assert.ok(paints.some((p) => String(p.stroke).includes("a94e38")), "焦點描邊");
  passed.push("fallback-focus");
});

test("負向：錯 pair 與刪限制必須失敗", () => {
  const wrong = { ...FROST, skillIds: ["barrier", "needle"] };
  const { UI, ctx, traces, vp } = loadUI(1000, 700);
  UI.drawLevelUp(ctx, 6, [wrong], { katana: 3, barrier: 3, needle: 3 }, WI, 0, 1, 0, "keyboard", null);
  const L = UI.levelUpLayout(1);
  assert.throws(() => assertCard(traces, L, 0, FROST, vp), /缺 影響：天狐靈針・陰陽符/);
  const cut = { ...INK, limitText: "" };
  const ui2 = loadUI(1000, 700);
  ui2.UI.drawLevelUp(ui2.ctx, 6, [cut], { katana: 3, fire: 3 }, WI, 0, 1, 0, "keyboard", null);
  assert.throws(() => assertCard(ui2.traces, ui2.UI.levelUpLayout(1), 0, INK, ui2.vp), /無再派生/);
  passed.push("negative");
});

const BASE_GAME = "c39d10b03ff8dc7ee5260c977ea787d7fb34f894b34feacae7c5b72d1bebdd15";
const BASE_STORE = "5fe53548a3de874027f8abec06083fe061db3f9af9991e7061271d1a36333c46";
const FRAME_PAD_X = 54;
const FRAME_PAD_Y = 51;
const chromeResult = { status: "NOT_RUN", error: "", shots: [], layer: "CONTROLLED_REAL_PAGE", nonNatural: true, device: "WAITING_DEVICE" };

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}
function boxesOverlap(a, b) {
  const x = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 3 && y > 3;
}
function insideRect(box, rect) {
  return box.left >= rect.left - 1 && box.left + box.width <= rect.right + 1
    && box.top >= rect.top - 1 && box.bottom <= rect.bottom + 1;
}
function isBodyLine(text, card, x, cardX) {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (t === card.n || t === card.s) return false;
  if (/^[1-3]$/.test(t) && x < cardX + 72) return false;
  if (/影響：|條件：|限制：|➔|→/.test(t)) return true;
  const fields = [card.d, card.beforeText, card.afterText, card.requirementText, card.limitText].filter((f) => f && f.length >= 2);
  if (fields.some((f) => t.length >= 6 && f.includes(t))) return true;
  if (fields.some((f) => f.length >= 8 && t.includes(f))) return true;
  return false;
}
function auditViewport(name, payload) {
  if (!payload || !payload.vis || !payload.layout || !payload.layout.panel || !payload.layout.reroll || !payload.layout.card) {
    return { violations: [name + " 沒有畫布 clip/viewport"], inner: null, gapCss: null };
  }
  const violations = [];
  const layout = payload.layout;
  const vis = payload.vis;
  const inner = {
    left: layout.panel.x + FRAME_PAD_X,
    top: layout.panel.y + FRAME_PAD_Y,
    right: layout.panel.x + layout.panel.w - FRAME_PAD_X,
    bottom: layout.panel.y + layout.panel.h - FRAME_PAD_Y,
  };
  if (!(inner.right > inner.left && inner.bottom > inner.top)) violations.push(name + " 和紙內框退化");
  const reroll = layout.reroll;
  const rerollBox = { left: reroll.x, top: reroll.y, width: reroll.w, bottom: reroll.y + reroll.h };
  if (!insideRect(rerollBox, vis)) violations.push(name + " 重抽超出可見畫布 " + JSON.stringify({ reroll, vis }));
  if (!insideRect(rerollBox, inner)) violations.push(name + " 重抽落在和紙框上 " + JSON.stringify({ reroll, inner }));
  const gapCss = (vis.bottom - rerollBox.bottom) * payload.scale;
  if (gapCss < 8) violations.push(name + " 重抽貼底 gapCss=" + gapCss.toFixed(2));
  const lastBottom = layout.card.y + Math.max(0, payload.cards.length - 1) * (layout.card.h + layout.card.gap) + layout.card.h;
  if (payload.cards.length && reroll.y < lastBottom - 1) violations.push(name + " 重抽壓到卡");
  const legend = (payload.traces || []).filter((t) => t.text.includes("選卡") || t.text.includes("點選"));
  if (!legend.length) violations.push(name + " 沒有操作說明");
  for (const t of legend) {
    if (!insideRect(t, vis) || !insideRect(t, inner)) violations.push(name + " 操作說明被裁 " + t.text);
  }
  const legendFlat = legend.map((t) => t.text).join("");
  if (payload.inputMode === "touch") {
    if (!legendFlat.includes("點選")) violations.push(name + " 觸控說明不完整");
  } else if (!legendFlat.includes("↑↓") && !legendFlat.includes("十字鍵")) violations.push(name + " 鍵盤說明不完整 " + legendFlat);
  payload.cards.forEach((card, i) => {
    const y0 = layout.card.y + i * (layout.card.h + layout.card.gap);
    const y1 = y0 + layout.card.h;
    const inCard = (payload.traces || []).filter((t) => t.y >= y0 - 2 && t.y < y1 + 2 && t.left >= layout.card.x - 4 && t.left <= layout.card.x + layout.card.w + 4);
    const body = inCard.filter((t) => t.align !== "right" && isBodyLine(t.text, card, t.left, layout.card.x));
    const heads = inCard.filter((t) => t.align === "right" && /共鳴|主動|被動|變異|御守|覺醒|升級/.test(t.text));
    const blob = inCard.map((t) => t.text).join("");
    for (const bit of [card.d, card.beforeText, card.afterText, card.requirementText, card.limitText]) {
      if (bit && !blob.includes(bit)) violations.push(name + " 卡" + i + " 可見列缺 " + bit.slice(0, 18));
    }
    if (!body.length) violations.push(name + " 卡" + i + " 沒有可量測的說明列");
    for (const t of body) {
      if (t.squashed) violations.push(name + " 卡" + i + " 橫向壓扁 " + t.text.slice(0, 12));
      if (t.css < 14 - 0.05) violations.push(name + " 卡" + i + " CSS " + t.css.toFixed(2) + " " + t.text.slice(0, 12));
      if (!insideRect(t, vis)) violations.push(name + " 卡" + i + " 說明超出畫布 " + t.text.slice(0, 16));
      if (!insideRect(t, inner)) violations.push(name + " 卡" + i + " 說明超出和紙內框 " + t.text.slice(0, 16));
      const cardRect = { left: layout.card.x + 4, top: y0 + 2, right: layout.card.x + layout.card.w - 4, bottom: y1 - 2 };
      if (!insideRect(t, cardRect)) violations.push(name + " 卡" + i + " 說明超出卡片 " + t.text.slice(0, 12) + " dy=" + (t.bottom - cardRect.bottom).toFixed(1) + " dx=" + ((t.left + t.width) - cardRect.right).toFixed(1));
      if (boxesOverlap(t, rerollBox)) violations.push(name + " 卡" + i + " 說明壓到重抽 " + t.text.slice(0, 12));
      for (const h of heads) {
        if (boxesOverlap(t, h)) violations.push(name + " 卡" + i + " 說明與「" + h.text.slice(0, 8) + "」重疊");
      }
    }
  });
  return { violations: [...new Set(violations)], inner, gapCss };
}

async function runR123(opts) {
  const { http, spawn, port, cdpPort, runId, dir, root, gamePath, gameShaBefore, rawGame, endIdx } = opts;
  const problems = [];
  const problem = (m) => { const s = String(m).slice(0, 500); if (!problems.includes(s)) problems.push(s); };
  const views = [];
  chromeResult.dir = dir;
  chromeResult.runId = runId;
  chromeResult.offerInjected = true;
  if (gameShaBefore !== BASE_GAME) problem("game SHA 不是基線 " + gameShaBefore.slice(0, 16));
  const probe = [
    "const __r121Traces = [];",
    "const __r121Fill = ctx.fillText.bind(ctx);",
    "ctx.fillText = function(text, x, y, maxWidth) {",
    "  const raw = String(text);",
    "  let width = 0, asc = 0, descn = 0;",
    "  try {",
    "    const m = ctx.measureText(raw);",
    "    width = m.width || 0;",
    "    const px0 = Number((String(ctx.font || '').match(/([0-9.]+)px/) || [])[1] || 0);",
    "    asc = Number.isFinite(m.actualBoundingBoxAscent) && m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : px0 * 0.82;",
    "    descn = Number.isFinite(m.actualBoundingBoxDescent) && m.actualBoundingBoxDescent > 0 ? m.actualBoundingBoxDescent : px0 * 0.18;",
    "  } catch (err) { return __r121Fill(text, x, y, maxWidth); }",
    "  const font = String(ctx.font || '');",
    "  const px = Number((font.match(/([0-9.]+)px/) || [])[1] || 0);",
    "  const align = ctx.textAlign || 'left';",
    "  const base = ctx.textBaseline || 'alphabetic';",
    "  let left = x;",
    "  if (align === 'center') left = x - width / 2;",
    "  else if (align === 'right' || align === 'end') left = x - width;",
    "  let top = y - asc, bottom = y + descn;",
    "  if (base === 'middle') { top = y - (asc + descn) / 2; bottom = y + (asc + descn) / 2; }",
    "  else if (base === 'top') { top = y; bottom = y + asc + descn; }",
    "  else if (base === 'bottom') { bottom = y; top = y - asc - descn; }",
    "  let vis = null;",
    "  try {",
    "    const tr = ctx.getTransform();",
    "    if (tr.a && tr.d) vis = { left: (0 - tr.e) / tr.a, right: (cv.width - tr.e) / tr.a, top: (0 - tr.f) / tr.d, bottom: (cv.height - tr.f) / tr.d };",
    "  } catch (err) {}",
    "  const scale = window.VIEWPORT && window.VIEWPORT.get ? (window.VIEWPORT.get().scale || 1) : 1;",
    "  __r121Traces.push({ text: raw.slice(0, 180), x: x, y: y, left: left, width: width, top: top, bottom: bottom, align: align, fontSize: px, css: px * scale, squashed: maxWidth != null && width > maxWidth + 0.75, vis: vis });",
    "  if (__r121Traces.length > 2400) __r121Traces.splice(0, __r121Traces.length - 1600);",
    "  return __r121Fill(text, x, y, maxWidth);",
    "};",
    "window.__r121 = {",
    "  applies: [],",
    "  arm(ids) {",
    "    for (const k of Object.keys(WI)) WL[k] = 0;",
    "    WL.katana = 3;",
    "    for (const id of ids) WL[id] = 3;",
    "    const active = Object.keys(WI).filter((k) => (WL[k] || 0) > 0);",
    "    if (active.length > 4) throw new Error('active ' + active.join(','));",
    "    level = 8; xp = xpNeed(); rerolls = 2; buildDuos = [];",
    "    buildCharms = Object.keys(CHARM_CONFIG).slice(0, 3);",
    "    const muts = [];",
    "    for (const id of Object.keys(MUTATION_CONFIG)) {",
    "      const skillId = MUTATION_CONFIG[id].skillId;",
    "      if ((WL[skillId] || 0) > 0 && muts.filter((m) => MUTATION_CONFIG[m].skillId === skillId).length < 3) muts.push(id);",
    "    }",
    "    buildMutations = muts;",
    "    return active;",
    "  },",
    "  begin() { start('night-town'); },",
    "  offer() { offerUp(); return choices.length; },",
    "  cards() { return choices.map((c) => ({ choiceId: c.choiceId, type: c.type, skillIds: c.skillIds, n: c.n, s: c.s, d: c.d, beforeText: c.beforeText, afterText: c.afterText, requirementText: c.requirementText, limitText: c.limitText })); },",
    "  tracesClear() { __r121Traces.length = 0; },",
    "  frames(n) { return new Promise((resolve) => { const step = (k) => k <= 0 ? resolve(true) : requestAnimationFrame(() => step(k - 1)); step(n); }); },",
    "  setMode(m) { inputMode = m; },",
    "  focus() { return levelupFocus; },",
    "  art() { return window.ART_READY === true; },",
    "  layoutCount(n) { return window.UI.levelUpLayout(n).count; },",
    "  snap() { return { state: state, rev: buildRevision, level: level, cool: levelupCooldown, focus: levelupFocus, mode: inputMode, n: choices.length, ids: choices.map((c) => c.choiceId), tutorial: !!tutorial, art: window.ART_READY === true }; },",
    "  cardPoint(i) {",
    "    const v = window.VIEWPORT.get(); const r = cv.getBoundingClientRect(); const L = levelUpLayout();",
    "    const x = L.card.x + L.card.w / 2; const y = L.card.y + i * (L.card.h + L.card.gap) + L.card.h / 2;",
    "    return { x: r.left + (x + v.offsetX) * r.width / v.width, y: r.top + (y + v.offsetY) * r.height / v.height };",
    "  },",
    "  measure() {",
    "    const L = window.UI.levelUpLayout(choices.length); const v = window.VIEWPORT.get(); const r = cv.getBoundingClientRect();",
    "    const last = __r121Traces.length ? __r121Traces[__r121Traces.length - 1] : null;",
    "    const mid = { x: L.card.x + L.card.w / 2, y: L.card.y + Math.min(36, L.card.h / 2) };",
    "    const cssX = (mid.x + v.offsetX) * r.width / v.width; const cssY = (mid.y + v.offsetY) * r.height / v.height;",
    "    const backX = cssX * v.width / r.width - v.offsetX; const backY = cssY * v.height / r.height - v.offsetY;",
    "    return { layout: L, scale: v.scale, vis: last && last.vis, inputMode: inputMode,",
    "      traces: __r121Traces.filter((t) => t.text && t.text.length <= 180).slice(-500),",
    "      cards: window.__r121.cards(),",
    "      round: { backDx: backX - mid.x, backDy: backY - mid.y, rerollCssH: L.reroll.h * r.height / v.height, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight } };",
    "  }",
    "};",
    "const __r123Apply = applyChoice;",
    "applyChoice = function(choiceId, revision) {",
    "  let meta = null;",
    "  try {",
    "    if (typeof choiceId === 'number') meta = choices[choiceId] || null;",
    "    else meta = (choices || []).find((c) => c.choiceId === choiceId || c.id === choiceId) || null;",
    "  } catch (err) {}",
    "  const result = __r123Apply(choiceId, revision);",
    "  window.__r121.applies.push({ arg: choiceId, ok: !!(result && result.ok), appliedId: result && result.ok && meta ? meta.choiceId : null, appliedKey: result && result.id ? result.id : '', reason: result && result.reason ? result.reason : '', appliedState: state, level: level, rev: buildRevision });",
    "  return result;",
    "};"
  ].join("\n");
  const gameSrc = rawGame.slice(0, endIdx) + "\n" + probe + "\n" + rawGame.slice(endIdx);
  let preview = null, chrome = null;
  const kill = () => { try { if (preview) preview.kill(); } catch {} try { if (chrome) chrome.kill(); } catch {} };
  const pageErrors = [];
  const audioLeak = [];
  try {
    preview = spawn(process.execPath, ["--require", path.join(root, "tools", "director-audio-freeze.cjs"), path.join(root, "tools", "director-preview.cjs"), "--port=" + port], { stdio: ["ignore", "pipe", "pipe"] });
    chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
      "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
      "--user-data-dir=" + path.join(dir, "profile"), "--remote-debugging-port=" + cdpPort, "about:blank"
    ], { stdio: "ignore" });
    let previewErr = "";
    preview.stderr.on("data", (b) => { previewErr += String(b).slice(0, 400); });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("preview timeout " + previewErr)), 12000);
      preview.stdout.on("data", (b) => { if (String(b).includes("SILENT_REVIEW")) { clearTimeout(t); resolve(); } });
    });
    const page = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("cdp timeout")), 12000);
      const pull = () => http.get("http://127.0.0.1:" + cdpPort + "/json/list", (res) => {
        let s = ""; res.on("data", (d) => { s += d; });
        res.on("end", () => {
          try {
            const hit = JSON.parse(s).find((x) => x.type === "page" && x.webSocketDebuggerUrl);
            if (hit) { clearTimeout(t); resolve(hit); } else setTimeout(pull, 150);
          } catch { setTimeout(pull, 150); }
        });
      }).on("error", () => setTimeout(pull, 150));
      pull();
    });
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error("ws")); });
    let seq = 0; const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method === "Fetch.requestPaused") {
        const url = msg.params.request.url || "";
        if (/\/js\/game\.js(\?|$)/.test(url)) {
          ws.send(JSON.stringify({ id: 900000 + seq, method: "Fetch.fulfillRequest", params: {
            requestId: msg.params.requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "text/javascript; charset=utf-8" }],
            body: Buffer.from(gameSrc, "utf8").toString("base64")
          } }));
        } else ws.send(JSON.stringify({ id: 800000 + seq, method: "Fetch.continueRequest", params: { requestId: msg.params.requestId } }));
      } else if (msg.method === "Runtime.exceptionThrown") pageErrors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
      else if (msg.method === "Network.responseReceived") {
        const u = msg.params.response.url || "";
        if ((/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(u) || /\/assets\/audio\//i.test(u)) && msg.params.response.status === 200) audioLeak.push(u);
      }
    };
    const send = (method, params = {}, ms = 12000) => new Promise((resolve, reject) => {
      const id = ++seq; const timer = setTimeout(() => reject(new Error("cdp " + method)), ms);
      pending.set(id, (msg) => { clearTimeout(timer); if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result || {}); });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result && r.result.value;
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pressMouse = async (x, y) => {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    };
    const pressTouch = async (x, y) => {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 1, radiusY: 1, id: 1 }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const pressKey = async (key, code, vk) => {
      const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: key.length === 1 ? key : "" };
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...base });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.removeItem('yokai-tutorial-v1');}catch(e){} window.addEventListener('error',e=>{window.__bootErr=(e.message||'')+' @'+(e.lineno||0);});" });
    await send("Fetch.enable", { patterns: [{ urlPattern: "*game.js*" }] });
    await send("Network.setBlockedURLs", { urls: ["*.mp3", "*.wav", "*.ogg", "*.m4a", "*assets/audio/*"] });
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    const expectDuo = {
      "duo:duo_frostseal": { skillIds: ["needle", "boom"], s: "かんぷうふ", beforeText: "直投", afterText: "寒封" },
      "duo:duo_inkfire": { skillIds: ["katana", "fire"], s: "ぼくえんざん", beforeText: "直接斬", afterText: "留墨焰" },
      "duo:duo_cinderseal": { skillIds: ["fire", "boom"], beforeText: "引爆", afterText: "留餘燼" },
      "duo:duo_thundercircle": { skillIds: ["barrier", "thunder"], beforeText: "落雷", afterText: "墨紋衝擊" },
    };
    const duos = [
      ["duo:duo_frostseal", ["needle", "boom"]],
      ["duo:duo_inkfire", ["fire"]],
      ["duo:duo_cinderseal", ["fire", "boom"]],
      ["duo:duo_thundercircle", ["barrier", "thunder"]],
    ];
    const seen = {};
    const shots = [];
    const waitCool = async () => {
      for (let i = 0; i < 40; i++) {
        const snap = await evalJs("window.__r121.snap()");
        if (snap && snap.cool === 0) return 0;
        await sleep(50);
      }
      const snap = await evalJs("window.__r121.snap()");
      return snap ? snap.cool : -1;
    };
    const armOffer = async (name, choiceId, skills) => {
      const active = await evalJs("window.__r121.arm(" + JSON.stringify(skills) + ")");
      if (!active || !active.includes("katana") || active.length > 4) throw new Error(name + " 主動非法 " + JSON.stringify(active));
      let idx = -1, cards = [], guard = 0;
      while (idx < 0 && guard < 24) {
        await evalJs("window.__r121.offer()");
        cards = await evalJs("window.__r121.cards()");
        idx = (cards || []).findIndex((c) => c.choiceId === choiceId);
        guard++;
        for (const c of cards || []) if (expectDuo[c.choiceId]) seen[c.choiceId] = c;
      }
      if (idx < 0) throw new Error(name + " 池中沒有 " + choiceId + " " + (cards || []).map((c) => c.choiceId).join(","));
      return { idx, cards };
    };
    const choose = async (name, kind, choiceId, skills) => {
      const found = await armOffer(name, choiceId, skills);
      const cool = await waitCool();
      if (cool !== 0) throw new Error(name + " " + kind + " cooldown " + cool);
      await evalJs("window.__r121.applies.length = 0");
      const before = await evalJs("window.__r121.snap()");
      if (!before || before.state !== "levelup") throw new Error(name + " " + kind + " 不在選卡");
      if (kind === "mouse" || kind === "touch") {
        const pt = await evalJs("window.__r121.cardPoint(" + found.idx + ")");
        if (kind === "mouse") await pressMouse(pt.x, pt.y);
        else await pressTouch(pt.x, pt.y);
      } else if (kind === "key") {
        let focus = before.focus, arrows = 0;
        if (before.n > 1) {
          await pressKey("ArrowDown", "ArrowDown", 40);
          arrows++;
          focus = await evalJs("window.__r121.focus()");
          if (focus === before.focus) throw new Error(name + " 方向鍵沒有移動焦點");
        }
        let guard = 0;
        while (focus !== found.idx && guard < 4) {
          const down = found.idx > focus;
          await pressKey(down ? "ArrowDown" : "ArrowUp", down ? "ArrowDown" : "ArrowUp", down ? 40 : 38);
          arrows++;
          focus = await evalJs("window.__r121.focus()");
          guard++;
        }
        if (focus !== found.idx) throw new Error(name + " 鍵盤焦點未到 " + choiceId);
        if (before.n > 1 && arrows < 1) throw new Error(name + " 未按方向鍵");
        await pressKey("Enter", "Enter", 13);
      } else if (kind === "digit") {
        await pressKey(String(found.idx + 1), "Digit" + (found.idx + 1), 49 + found.idx);
      }
      await sleep(180);
      const applies = await evalJs("window.__r121.applies.slice()");
      const snap = await evalJs("window.__r121.snap()");
      const ok = (applies || []).filter((a) => a.ok);
      if (ok.length !== 1 || ok[0].appliedId !== choiceId || ok[0].appliedState !== "play") {
        throw new Error(name + " " + kind + " " + choiceId + " " + JSON.stringify(applies));
      }
      if (!snap || snap.state !== "play" || snap.level !== before.level + 1 || !(snap.rev > before.rev)) {
        throw new Error(name + " " + kind + " 選後未經過 play " + JSON.stringify(snap));
      }
      return { kind, choiceId, appliedId: ok[0].appliedId, state: snap.state, level: snap.level, rev: snap.rev };
    };
    const onlyViews = process.env.R123_VIEWS ? process.env.R123_VIEWS.split(",") : null;
    for (const [w, h, name] of [[1000, 700, "dt"], [844, 390, "mp"], [1024, 640, "tb"]]) {
      if (onlyViews && !onlyViews.includes(name)) continue;
      const view = { name, w, h, violations: [], selects: [] };
      try {
        console.log("r123 viewport " + name);
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
        await send("Page.navigate", { url: "http://127.0.0.1:" + port + "/index.html" });
        let ready = false;
        for (let i = 0; i < 60; i++) {
          await sleep(250);
          try { ready = await evalJs("!!window.__r121"); if (ready) break; } catch {}
        }
        if (!ready) throw new Error(name + " probe 未就緒");
        await evalJs("window.__r121.begin()");
        let art = false;
        for (let i = 0; i < 40; i++) {
          await sleep(200);
          try { art = await evalJs("window.ART_READY===true"); if (art) break; } catch {}
        }
        if (!art) throw new Error(name + " ART_READY 未完成");
        let opened = null;
        for (let i = 0; i < 25; i++) {
          opened = await evalJs("window.__r121.snap()");
          if (opened && opened.tutorial) break;
          await sleep(100);
        }
        if (!opened || !opened.tutorial) throw new Error(name + " 教學遮罩沒出現");
        const pt = await evalJs("window.__r121.cardPoint(0)");
        const beforeTut = await evalJs("window.__r121.snap()");
        await pressMouse(pt.x, pt.y);
        await pressTouch(pt.x, pt.y);
        const afterTut = await evalJs("window.__r121.snap()");
        if (!afterTut.tutorial || afterTut.rev !== beforeTut.rev) throw new Error(name + " 教學遮罩沒攔住點擊");
        await pressKey("Escape", "Escape", 27);
        await sleep(250);
        const closed = await evalJs("window.__r121.snap()");
        if (!closed || closed.tutorial || closed.art !== true) throw new Error(name + " 教學未關或 art 掉了");
        await armOffer(name, "duo:duo_frostseal", ["needle", "boom"]);
        await evalJs("window.__r121.setMode('keyboard')");
        await evalJs("window.__r121.tracesClear()");
        await evalJs("window.__r121.frames(2)");
        const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, 20000);
        if (!shot.data || shot.data.length < 5000) throw new Error(name + " png");
        const file = path.join(dir, name + ".png");
        fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
        shots.push(file);
        const measured = await evalJs("window.__r121.measure()");
        const audit = auditViewport(name, measured);
        view.violations = audit.violations;
        view.gapCss = audit.gapCss;
        view.inner = audit.inner;
        view.round = measured && measured.round;
        for (const v of audit.violations) problem(v);
        const rt = measured && measured.round;
        if (!rt || Math.abs(rt.backDx) > 1.5 || Math.abs(rt.backDy) > 1.5) problem(name + " 正逆 hit");
        if (!rt || rt.rerollCssH < 43.5) problem(name + " 重抽低於 44CSS");
        if (!rt || rt.scrollW > rt.iw + 1 || rt.scrollH > rt.ih + 1) problem(name + " scrollbar");
        if (name === "dt") {
          await armOffer(name, "duo:duo_frostseal", ["needle", "boom"]);
          await waitCool();
          await evalJs("window.__r121.applies.length = 0");
          const beforeR = await evalJs("window.__r121.snap()");
          await pressKey("r", "KeyR", 82);
          await sleep(220);
          const afterR = await evalJs("window.__r121.snap()");
          const appliesR = await evalJs("window.__r121.applies.slice()");
          if ((appliesR || []).some((a) => a.ok)) problem(name + " 重抽被當成選中");
          if (!afterR || afterR.level !== beforeR.level || afterR.state !== "levelup" || !(afterR.rev > beforeR.rev)) problem(name + " 重抽沒有維持選卡換牌");
          view.reroll = { beforeRev: beforeR && beforeR.rev, afterRev: afterR && afterR.rev, level: afterR && afterR.level, state: afterR && afterR.state };
        }
        for (const [id, skills] of duos) {
          for (const kind of ["mouse", "touch"]) {
            try { view.selects.push(await choose(name, kind, id, skills)); }
            catch (e) { problem(e.message || e); }
          }
        }
        try { view.selects.push(await choose(name, "key", "duo:duo_frostseal", ["needle", "boom"])); }
        catch (e) { problem(e.message || e); }
        if (name === "mp") {
          try { view.selects.push(await choose(name, "digit", "duo:duo_thundercircle", ["barrier", "thunder"])); }
          catch (e) { problem(e.message || e); }
        }
      } catch (e) {
        problem(name + " " + (e.message || e));
        view.error = String(e.message || e).slice(0, 400);
      }
      views.push(view);
      console.log("r123 " + name + " violations " + view.violations.length + " selects " + view.selects.length);
    }
    for (const id of Object.keys(expectDuo)) {
      const card = seen[id];
      if (!card) problem("真 offerUp 未出現 " + id);
      else {
        if (JSON.stringify(card.skillIds) !== JSON.stringify(expectDuo[id].skillIds)) problem(id + " skillIds");
        if (expectDuo[id].s && card.s !== expectDuo[id].s) problem(id + " kana " + card.s);
        if (card.beforeText !== expectDuo[id].beforeText || card.afterText !== expectDuo[id].afterText) problem(id + " before/after");
        if (!card.requirementText || !card.limitText || !card.d || card.d.length < 20) problem(id + " 全文欄");
      }
    }
    try {
      const counts = await evalJs("[0,1,2,3].map(n => window.__r121.layoutCount(n)).join(',')");
      if (counts !== "0,1,2,3") problem("layout count " + counts);
    } catch (e) { problem("layout count " + (e.message || e)); }
    if (pageErrors.length) problem("pageErrors " + pageErrors.join(";"));
    if (audioLeak.length) problem("audioLeak " + audioLeak.join(";"));
    chromeResult.shots = shots;
    chromeResult.pageErrors = pageErrors;
    chromeResult.audioLeak = audioLeak;
    fs.writeFileSync(path.join(dir, "visibility.json"), JSON.stringify({ problems, views, pageErrors, audioLeak }, null, 2));
    if (problems.length) {
      chromeResult.status = "RED";
      chromeResult.error = problems.slice(0, 12).join(" | ");
      throw new Error(chromeResult.error);
    }
    chromeResult.status = "PASS_CONTROLLED_PAGE";
    passed.push("chrome");
    try { ws.close(); } catch {}
  } catch (error) {
    if (chromeResult.status !== "RED") {
      chromeResult.status = "NOT_RUN";
      chromeResult.error = String(error && error.message || error);
    }
    if (!failed.some((x) => String(x).startsWith("chrome:"))) failed.push("chrome:" + chromeResult.error);
    try { fs.writeFileSync(path.join(dir, "chrome-error.txt"), chromeResult.error + "\n" + problems.join("\n")); } catch {}
    throw error;
  } finally {
    kill();
    try {
      const diskAfter = crypto.createHash("sha256").update(fs.readFileSync(gamePath)).digest("hex");
      const shaInfo = { diskBefore: gameShaBefore, diskAfter, changedDuringRun: diskAfter !== gameShaBefore, memoryProbeOnly: true };
      chromeResult.gameSha = shaInfo;
      fs.writeFileSync(path.join(dir, "game-sha.json"), JSON.stringify(shaInfo, null, 2));
    } catch {}
  }
}

test("真 game 頁：可見字框、applyChoice 與三視口", { timeout: 300000 }, async () => {
  const http = require("node:http");
  const { spawn } = require("node:child_process");
  const port = 9473;
  const cdpPort = 9361;
  const runId = "game-" + Date.now().toString(36);
  const dir = path.join(__dirname, "..", "artifacts", "validation", "grok-m1-e-r12-20261017", runId);
  fs.mkdirSync(dir, { recursive: true });
  const root = path.join(__dirname, "..");
  const gamePath = path.join(root, "js", "game.js");
  const rawBuf = fs.readFileSync(gamePath);
  const gameShaBefore = crypto.createHash("sha256").update(rawBuf).digest("hex");
  const rawGame = rawBuf.toString("utf8");
  const endIdx = rawGame.lastIndexOf("})();");
  assert.ok(endIdx > 0, "game.js IIFE");
  await runR123({ http, spawn, port, cdpPort, runId, dir, root, gamePath, gameShaBefore, rawGame, endIdx });
});

test("收束摘要", () => {
  const runId = Date.now().toString(36);
  const dir = path.join(__dirname, "..", "artifacts", "validation", "grok-m1-e-r12-20261017", runId);
  fs.mkdirSync(dir, { recursive: true });
  const uiSha = crypto.createHash("sha256").update(fs.readFileSync(UI_PATH)).digest("hex");
  const testSha = crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex");
  const contractOk = ["duo-full", "fan-empty", "fallback-focus", "negative", "chrome"].every((k) => passed.includes(k));
  const done = contractOk && failed.length === 0;
  fs.writeFileSync(path.join(dir, "r12-summary.json"), JSON.stringify({
    ticket: "M1-E-R12.3", runId, done, exitCode: done ? 0 : 1, passed, failed, chrome: chromeResult,
    uiSha256: uiSha, testSha256: testSha,
    gameSha256: sha256File(path.join(__dirname, "..", "js", "game.js")),
    storeSha256: sha256File(path.join(__dirname, "..", "js", "store.js")),
    layer: "CONTROLLED_REAL_PAGE", nonNatural: true, device: "WAITING_DEVICE",
    note: "受控真頁（真 Chrome／CDP／production canvas／插樁 offer）≠ 自然局／≠ 實機。失敗保留原 run，不覆寫。"
  }, null, 2));
  if (chromeResult.dir) fs.writeFileSync(path.join(chromeResult.dir, "r12-summary.json"), fs.readFileSync(path.join(dir, "r12-summary.json")));
  assert.equal(sha256File(path.join(__dirname, "..", "js", "game.js")), BASE_GAME, "game SHA");
  assert.equal(sha256File(path.join(__dirname, "..", "js", "store.js")), BASE_STORE, "store SHA");
  assert.equal(done, true);
});
