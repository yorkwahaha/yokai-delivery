const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const game = fs.readFileSync("js/game.js", "utf8");
const ui = fs.readFileSync("js/ui.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

test("fire orbit render count matches combat count", () => {
  // Both the combat and rendering paths now resolve the same fire spec.
  const needle = "const count = fireSpec.count;";
  const escaped = needle.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  assert.equal((game.match(new RegExp(escaped, "g")) || []).length, 2);
});

test("MAX katana wave crosses buildings and has a fixed world-distance limit", () => {
  assert.match(game, /EVOLUTIONS\.move\(wave,\s*dt,\s*null,\s*12\)/);
  assert.ok(!game.includes("blockBlade"), "Lv5 katana should not collide with houses or walls");
  assert.match(game, /const cap = wave\.maxTravel \|\| 720/);
});

test("independent boss controller loads before the real game runtime", () => {
  assert.ok(html.indexOf('js/boss-ai.js')>=0);
  assert.ok(html.indexOf('js/boss-ai.js')<html.indexOf('js/game.js'));
  assert.match(game,/BOSS_AI\?\.step/);
});

test("horizontal level-up hitboxes and rendered rows share the same dimensions", () => {
  assert.match(game,/UI\.levelUpLayout\(choices\.length\)\?\.cards/,
    "pointer hitboxes must consume the same card rectangles as UI");
  assert.match(ui,/const L = levelUpLayout\(choices\.length\)/,
    "rendering must consume the shared level-up layout");
});

test("retired paid listening hints cannot be triggered via the mobile UI", () => {
  assert.match(game,/function triggerHint\(\) \{ return false; \}/,
    "all paid hint paths are disabled, including mobile pointer input");
  assert.match(ui,/const HINT_BTN = \{ x: 532, y: 20, w: 78, h: 40 \}/,
    "kept as an internal layout anchor only, not a paid hint action");
});

test("interface fonts keep one full Noto answer face plus subset decorative faces", () => {
  const links = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g) || [];
  assert.equal(links.length, 3);
  const fullAnswerFace = links.find(link => link.includes("family=Noto+Sans+JP") && !link.includes("&text="));
  const subsetLinks = links.filter(link => link.includes("&text="));
  assert.ok(fullAnswerFace, "answers need a complete Noto Sans JP face to prevent per-glyph fallback");
  assert.equal(subsetLinks.length, 2);
  assert.ok(subsetLinks.every(link => link.includes("family=Noto+Sans+JP")));
  const subset = subsetLinks.map(link=>new URL(link).searchParams.get('text')).join('');
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
