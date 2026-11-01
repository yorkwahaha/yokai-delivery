const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const game = read('js/game.js');
const ui = read('js/ui.js');
const audio = read('js/audio.js');
const assets = read('js/assets.js');
const evolutions = read('js/evolutions.js');

test('B16 upgrade card directions always match the latest input mode', () => {
  assert.match(ui, /inputMode === "gamepad" \? "【 按 A 選取 】"/);
  assert.match(ui, /inputMode === "touch" \? "【 點擊選取 】"/);
  assert.match(ui, /"【 按 Enter 選取 】"/);
  assert.match(ui, /inputMode === "touch" \? "點擊選取"/);
  assert.match(ui, /Y 重抽/);
  assert.match(game, /inputMode = 'keyboard'/);
  assert.match(game, /inputMode = touch \? 'touch' : 'keyboard'/);
  assert.match(game, /inputMode = 'gamepad'/);
  assert.match(game, /if \(justPressed\(0\)\) \{ AUDIO\.init\(\); pickUp\(levelupFocus\); \}/);
  assert.match(game, /else if \(justPressed\(3\)\) reroll\(\)/);
});

test('B16 R3 switches camera only during play with a visual gamepad hint', () => {
  assert.match(game, /state === "play" && justPressed\(11\)\) toggleViewMode\(\)/);
  assert.match(game, /tiltK\(\)\) !== 1, inputMode\);/);
  assert.match(ui, /function drawViewMedallion\(ctx,b,flat=false,inputMode="keyboard"\)/);
  assert.match(ui, /if \(inputMode === "gamepad"\) \{[\s\S]*?strokeText\("R3"/);
});

test('B16 frost copy reflects real 1-hit minion / 3-hit boss and 0.5 / 0.15 second durations', () => {
  assert.match(game, /e\.type === "boss" \? 3 : 1/);
  assert.match(evolutions, /e\.type==='boss'\?0\.15:0\.5/);
  assert.match(evolutions, /e\.freezeReady=elapsed\+2/);
  assert.match(ui, /靈針命中：小怪冰凍 0\.5 秒；Boss 累積 3 次命中後冰凍 0\.15 秒/);
  assert.doesNotMatch(ui, /只有靈針命中能累積寒冷/);
});

test('B16 bundle one variable Japanese font with OFL license and preload', () => {
  const html = read('index.html');
  const font = fs.readFileSync(path.join(root, 'assets/fonts/YokaiNotoSansJP.woff2'));
  assert.equal(font.toString('ascii', 0, 4), 'wOF2');
  assert.ok(font.length < 1000000);
  assert.ok(fs.existsSync(path.join(root, 'assets/fonts/OFL-NotoSansJP.txt')));
  assert.match(html, /rel="preload" href="assets\/fonts\/YokaiNotoSansJP\.woff2/);
  assert.match(html, /@font-face[\s\S]*?'Yokai Noto JP'/);
  assert.match(ui, /function floorAnswerFont[\s\S]*?'Yokai Noto JP'/);
  assert.match(ui, /function answerFont[\s\S]*?'Yokai Noto JP'/);
});

test('B16 Boss music is prepared on spawn and only fades normal BGM after playback', () => {
  assert.ok(fs.statSync(path.join(root, 'assets/audio/BOSS.mp3')).size > 10000);
  assert.match(game, /if \(plan\.role === "final"\) \{[\s\S]*?AUDIO\.prepareBossMusic\?\.\(\)/);
  assert.match(audio, /prepareBossMusic\(\) \{[\s\S]*?boss\.preload = "auto"/);
  assert.match(audio, /const bossAudible = !boss\.paused && boss\.readyState >= 2/);
  assert.match(audio, /if \(bossAudible\) bossMix = Math\.min\(1,/);
  assert.match(audio, /bgmAttempts\.delete\(audio\)/);
});

test('B16 rain-port water boss VFX candidates are correctly staged, not silently shipped', () => {
  for (const name of ['tide_v03', 'tidalFan_v01', 'rainVortex_v01']) {
    assert.ok(fs.existsSync(path.join(root, 'assets/img/vfx/boss-water-r8', name + '.webp')));
  }
  assert.match(assets, /window\.DEV_MODE\?\.isDevMode\?\.\(window\.location\) === true[\s\S]{0,80}bossart=1/);
  assert.match(assets, /USER_ART_REVIEW_PENDING/);
});
test('B17 second stage uses four approved distinct stone slab sprites and correct canonical URLs', () => {
  const crypto = require('node:crypto');
  const manifest = JSON.parse(read('assets/img/runtime-art-manifest.json'));
  const s2 = manifest.stages['rain-port'].tiles.stoneVariants;
  assert.equal(s2.length, 4);
  const stage1 = fs.readFileSync(path.join(root, 'assets/img/scenery/ground.webp'));
  const stage1SHA = crypto.createHash('sha256').update(stage1).digest('hex');
  const seen = new Set();
  for (const item of s2) {
    assert.match(item.path, /^assets\/img\/stages\/rain-port\/tiles\/rain-port__g-stone-0[1-4]\.webp$/);
    const canonical = fs.readFileSync(path.join(root, item.path));
    const source = fs.readFileSync(path.join(root, item.legacy_source_path));
    const sha = crypto.createHash('sha256').update(canonical).digest('hex');
    assert.equal(sha, item.sha256);
    assert.equal(Buffer.compare(canonical, source), 0);
    assert.notEqual(sha, stage1SHA);
    seen.add(sha);
  }
  assert.equal(seen.size,4);
});
test.todo('B16 Stage2 Boss water VFX needs visual approval and safe crop/projection fixes before enabling normal mode');
