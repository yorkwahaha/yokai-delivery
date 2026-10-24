"use strict";

// C3：drawBossHazard 委派契約。只讀 js/game.js，不載入音檔、不跑局。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function loadDraw() {
  const src = fs.readFileSync("js/game.js", "utf8");
  const start = src.indexOf("  function drawBossHazard(h) {");
  const end = src.indexOf("  let frameShakeOffset");
  assert.ok(start > 0 && end > start, "drawBossHazard 必須留在 drawWorld 之前");
  const body = src.slice(start, end);
  assert.equal(body.includes("try {"), false, "委派失敗不得被吞掉");
  assert.equal(body.includes("portDraw(ctx, h, elapsed) === true"), true);
  return new Function("RENDERER", "ctx", "elapsed", `${body}\nreturn drawBossHazard;`);
}

function mockCtx() {
  const ops = [];
  const ctx = {
    ops,
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    save() { ops.push("save"); },
    restore() { ops.push("restore"); },
    beginPath() { ops.push("begin"); },
    arc(x, y, r) { ops.push(["arc", x, y, r, ctx.strokeStyle, ctx.fillStyle, ctx.lineWidth, ctx.globalAlpha]); },
    stroke() { ops.push(["stroke", ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha]); },
    fill() { ops.push(["fill", ctx.fillStyle, ctx.globalAlpha]); },
    moveTo(x, y) { ops.push(["move", x, y]); },
    lineTo(x, y) { ops.push(["line", x, y]); }
  };
  return ctx;
}

function run(handler, hazard, elapsed = 4.5) {
  const ctx = mockCtx();
  const calls = [];
  const RENDERER = handler === "missing"
    ? {}
    : {
        drawBossHazard(drawCtx, h, time) {
          calls.push({ drawCtx, h, time });
          if (handler === "throw") throw new Error("renderer-hazard");
          return handler;
        }
      };
  const draw = loadDraw()(RENDERER, ctx, elapsed);
  let error = null;
  try { draw(hazard); } catch (err) { error = err; }
  return { ctx, calls, error };
}

const slam = { kind: "slam", x: 30, y: 40, r: 150, phase: "telegraph" };

test("strict true 略過本地幾何，並原樣轉交 ctx、hazard、elapsed、phase", () => {
  for (const kind of ["slam", "charge", "ring", "tide", "tidalFan", "rainVortex"]) {
    const hazard = { kind, x: 12, y: 24, phase: "recovery", r: 80, angle: 0.4 };
    const { ctx, calls, error } = run(true, hazard, 9.25);
    assert.equal(error, null, kind);
    assert.equal(calls.length, 1, kind);
    assert.equal(calls[0].h, hazard, kind);
    assert.equal(calls[0].h.phase, "recovery", kind);
    assert.equal(calls[0].time, 9.25, kind);
    assert.equal(ctx.ops.includes("save"), false, kind);
    assert.equal(ctx.ops.length, 0, kind);
  }
});

test("false、非 strict true、handler 缺失都保留本地幾何", () => {
  for (const handler of [false, undefined, 1, "true", "missing"]) {
    const { ctx, calls, error } = run(handler, slam, 3);
    assert.equal(error, null, String(handler));
    assert.equal(calls.length, handler === "missing" ? 0 : 1, String(handler));
    if (calls.length) {
      assert.equal(calls[0].h, slam);
      assert.equal(calls[0].h.phase, "telegraph");
      assert.equal(calls[0].time, 3);
    }
    assert.ok(ctx.ops.includes("save"), String(handler));
    assert.ok(ctx.ops.includes("restore"), String(handler));
    assert.deepEqual(ctx.ops.find(op => Array.isArray(op) && op[0] === "arc").slice(0, 4), ["arc", 30, 40, 150]);
    assert.equal(ctx.globalAlpha, 0.72);
    const fill = ctx.ops.find(op => Array.isArray(op) && op[0] === "fill");
    assert.equal(fill[1], "rgba(255,65,35,0.18)");
    const stroke = ctx.ops.find(op => Array.isArray(op) && op[0] === "stroke");
    assert.equal(stroke[1], "#ffbd72");
    assert.equal(stroke[2], 3);
  }
});

test("recovery 相位與 charge、ring、tide 的本地 fallback 仍在", () => {
  const recovery = run(false, { ...slam, phase: "recovery" }, 1);
  assert.equal(recovery.ctx.globalAlpha, 0.28);
  assert.equal(recovery.calls[0].h.phase, "recovery");
  assert.equal(recovery.calls[0].time, 1);

  const charge = run("missing", { kind: "charge", x: 5, y: 6, angle: 0, phase: "active" });
  assert.equal(charge.ctx.ops.find(op => Array.isArray(op) && op[0] === "stroke")[1], "rgba(255,120,50,0.45)");
  assert.equal(charge.ctx.lineWidth, 104);

  const ring = run(false, { kind: "ring", x: 8, y: 9, r: 80, phase: "telegraph", gapAngle: 0, gapWidth: Math.PI / 2 }, 6.5);
  assert.equal(ring.calls[0].time, 6.5);
  assert.equal(ring.ctx.ops.find(op => Array.isArray(op) && op[0] === "stroke")[1], "rgba(255,80,40,0.85)");
  assert.equal(ring.ctx.lineWidth, 28);

  const tide = run("missing", { kind: "tide", x: 1, y: 2, angle: 0, phase: "telegraph", progress: 10 });
  const strokes = tide.ctx.ops.filter(op => Array.isArray(op) && op[0] === "stroke").map(op => op[1]);
  assert.deepEqual(strokes, ["rgba(150,230,255,0.55)", "rgba(80,150,200,0.4)"]);
});

test("雨港 tidalFan 與 rainVortex 走同一 ctx/h/elapsed 契約，false 不畫標準圓", () => {
  for (const kind of ["tidalFan", "rainVortex"]) {
    const hazard = { kind, x: 70, y: 80, phase: "active", r: 210 };
    const handled = run(true, hazard, 2.5);
    assert.equal(handled.calls[0].h, hazard);
    assert.equal(handled.calls[0].h.phase, "active");
    assert.equal(handled.calls[0].time, 2.5);
    assert.equal(handled.ctx.ops.length, 0);

    const fallback = run(false, hazard, 2.5);
    assert.equal(fallback.calls[0].time, 2.5);
    assert.equal(fallback.ctx.ops.find(op => Array.isArray(op) && op[0] === "arc"), undefined);
    assert.ok(fallback.ctx.ops.includes("save"));
  }
});

test("handler 丟出的錯誤原樣冒出，壞座標不呼叫 renderer", () => {
  const blown = run("throw", slam, 8);
  assert.equal(blown.error && blown.error.message, "renderer-hazard");
  assert.equal(blown.ctx.ops.length, 0);

  const bad = run(true, { kind: "slam", x: NaN, y: 1 }, 8);
  assert.equal(bad.error, null);
  assert.equal(bad.calls.length, 0);
  assert.equal(bad.ctx.ops.length, 0);
});
