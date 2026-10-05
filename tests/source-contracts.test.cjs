const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const game = fs.readFileSync("js/game.js", "utf8");
const ui = fs.readFileSync("js/ui.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

test("fire orbit render count matches combat count", () => {
  const needle = "EVOLUTIONS.fireCount(WL.fire)";
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

test("interface fonts download a character subset", () => {
  const links = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g) || [];
  assert.equal(links.length, 2);
  assert.ok(links.every(link => link.includes("family=Noto+Sans+JP") && link.includes("&text=")));
  assert.ok(!html.includes("display=swap\" rel=\"stylesheet\""));
  const subset = links.map(link=>new URL(link).searchParams.get('text')).join('');
  for(const char of '王直接抽玩↻橫向遊設定完成返回↑↓') assert.ok(subset.includes(char),`missing font character: ${char}`);
});

test("answer pads paint on the ground before the player and monsters", () => {
  const pad = game.indexOf("ctx.arc(p.x, p.y, 36, 0, 6.28)");
  const actors = game.indexOf("actors.sort");
  assert.ok(pad > 0 && actors > pad);
});

test("dormant reverse-delivery rendering retains its text branch; live orders stay forward", () => {
  assert.match(game, /job\.rev \? job\.ans\[i\]\.zh : job\.ans\[i\]\.jp/);
  assert.match(game, /const gain = 10/);
});
