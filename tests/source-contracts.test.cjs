const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const game = fs.readFileSync("js/game.js", "utf8");
const ui = fs.readFileSync("js/ui.js", "utf8");

test("fire orbit render count matches combat count", () => {
  const needle = "Math.min(5, WL.fire + 1)";
  const escaped = needle.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  assert.equal((game.match(new RegExp(escaped, "g")) || []).length, 2);
});

test("horizontal level-up hitboxes and rendered rows share the same dimensions", () => {
  assert.match(game, /cardW = 720, cardH = 108/);
  assert.match(ui, /cardW = 720, cardH = 108/);
});

test("mobile hint has a visible exported hit target", () => {
  assert.match(ui, /const HINT_BTN = \{ x: 532, y: 20, w: 78, h: 40 \}/);
  assert.match(ui, /HINT_BTN,/);
  assert.match(game, /UI\.HINT_BTN/);
});

test("reverse deliveries actually change answer text", () => {
  assert.match(game, /job\.rev \? job\.ans\[i\]\.zh : job\.ans\[i\]\.jp/);
  assert.match(game, /const gain = 10/);
});
