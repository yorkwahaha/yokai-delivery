"use strict";

// C2：只煙測 game.js 飄字迴圈。不載入音檔、不跑局。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function floatingTextLoop() {
  const src = fs.readFileSync("js/game.js", "utf8");
  const start = src.indexOf("// 14. 飄字");
  const end = src.indexOf("// 15. 浮動傷害數字");
  assert.ok(start > 0 && end > start, "飄字迴圈必須留在 drawWorld");
  const body = src.slice(start, end);
  return new Function("ctx", "texts", "UI", "clamp", "uprightHere", body);
}

function mockCtx() {
  const stops = [];
  const ops = [];
  const gradient = {
    addColorStop(offset, color) {
      stops.push({ offset, color });
      ops.push("stop");
    }
  };
  const ctx = {
    stops,
    ops,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
    save() { ops.push("save"); },
    restore() { ops.push("restore"); },
    measureText(text) { return { width: text.length * 16 }; },
    createLinearGradient() { ops.push("gradient"); return gradient; },
    fillRect(x, y, w, h) { ops.push("plate"); ctx.plate = { x, y, w, h, fillStyle: ctx.fillStyle }; },
    strokeText(text, x, y) {
      ops.push("stroke");
      ctx.stroke = { text, x, y, strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth };
    },
    fillText(text, x, y) {
      ops.push("fill");
      ctx.filled = { text, x, y, fillStyle: ctx.fillStyle, shadowColor: ctx.shadowColor, shadowOffsetY: ctx.shadowOffsetY };
    }
  };
  return ctx;
}

function paint(text, color) {
  const ctx = mockCtx();
  floatingTextLoop()(ctx, [{ v: text, x: 120, y: 80, c: color, life: 1 }], {
    readableFont: () => "bold 17px sans"
  }, (n, a, b) => Math.max(a, Math.min(b, n)), () => {});
  return ctx;
}

test("雨港 Boss 出場淡粉字有黑墨描邊、陰影與局部暗底", () => {
  for (const line of ["港霧大妖！浪潮將吞噬一切！", "港霧大妖出現！"]) {
    const ctx = paint(line, "#ff8f8f");
    assert.equal(ctx.stroke.text, line);
    assert.equal(ctx.stroke.strokeStyle, "#140c0e");
    assert.ok(ctx.stroke.lineWidth >= 3);
    assert.equal(ctx.filled.text, line);
    assert.equal(ctx.filled.fillStyle, "#ff8f8f");
    assert.equal(ctx.filled.shadowColor, "rgba(0, 0, 0, 0.9)");
    assert.equal(ctx.filled.shadowOffsetY, 1);
    assert.ok(ctx.plate.w > 24 && ctx.plate.h > 8);
    assert.ok(ctx.stops.some(stop => stop.color === "rgba(12, 8, 10, 0.46)"));
    assert.ok(ctx.stops.some(stop => stop.color === "rgba(12, 8, 10, 0)"));
    const plateAt = ctx.ops.indexOf("plate");
    const strokeAt = ctx.ops.indexOf("stroke");
    const fillAt = ctx.ops.indexOf("fill");
    assert.ok(plateAt > -1 && plateAt < strokeAt && strokeAt < fillAt);
  }
});

test("一般飄字與受傷提示不被 Boss 暗底改掉", () => {
  const plain = paint("配達完遂！", "#fff0a6");
  assert.equal(plain.ops.includes("stroke"), false);
  assert.equal(plain.ops.includes("plate"), false);
  assert.equal(plain.filled.fillStyle, "#fff0a6");

  const injury = paint("受創・燈油 −8", "#cb6e60");
  assert.equal(injury.ops.includes("plate"), false);
  assert.equal(injury.stroke.strokeStyle, "#211719");
  assert.equal(injury.stroke.lineWidth, 2.6);
  assert.equal(injury.filled.fillStyle, "#fff4d3");
  assert.notEqual(injury.filled.shadowColor, "rgba(0, 0, 0, 0.9)");
});
