// tests/fusion-visual-qa-r2.test.cjs
// FUSION-VISUAL-INDEPENDENT-QA-R2: 獨立瀏覽器與素材解碼 QA 驗證
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const QA_DIR = path.join(ROOT, 'scratch/fusion-visual-qa-r2');

// -----------------------------------------------------------------------------
// Test 1: 10 大奧義候選圖片實體存在性與容量完整度
// -----------------------------------------------------------------------------
test('QA-1: 10 大奧義候選素材實體檔案存在且無空檔', () => {
  const candidates = {
    fusion_exorcistblade:    { main: "fusion_exorcistblade/main_alpha_candidate_v02.webp", icon: "fusion_exorcistblade/icon_alpha_candidate_v01.webp" },
    fusion_exorcistseal:     { main: "fusion_exorcistseal/main_alpha_candidate_v02.webp", icon: "fusion_exorcistseal/icon_alpha_candidate_v01.webp" },
    fusion_flamefestival:    { main: "fusion_flamefestival/main_alpha_candidate_v02.webp", icon: null },
    fusion_foxfirebarrier:   { main: "fusion_foxfirebarrier/main_alpha_candidate_v02.webp", icon: "fusion_foxfirebarrier/icon_alpha_candidate_v01.webp" },
    fusion_foxiai:           { main: "fusion_foxiai/main_alpha_candidate_v02.webp", icon: "fusion_foxiai/icon_alpha_candidate_v01.webp" },
    fusion_foxthunderlantern:{ main: "fusion_foxthunderlantern/main_alpha_candidate_v02.webp", icon: null },
    fusion_inkblade:         { main: "fusion_inkblade/main_alpha_candidate_v01.webp", icon: null },
    fusion_slashwheel:       { main: "fusion_slashwheel/main_alpha_candidate_v02.webp", icon: null },
    fusion_thundercircle:    { main: "fusion_thundercircle/main_alpha_candidate_v02.webp", icon: null },
    fusion_thundertalisman:  { main: "fusion_thundertalisman/main_alpha_candidate_v02.webp", icon: null },
  };

  for (const [id, c] of Object.entries(candidates)) {
    if (c.main) {
      const p = path.join(ROOT, 'art/fusion/candidates', c.main);
      assert.ok(fs.existsSync(p), `${id} main candidate must exist: ${c.main}`);
      const sz = fs.statSync(p).size;
      assert.ok(sz > 50000, `${id} main candidate must be substantial (>50KB): ${sz} bytes`);
    }
    if (c.icon) {
      const p = path.join(ROOT, 'art/fusion/candidates', c.icon);
      assert.ok(fs.existsSync(p), `${id} icon candidate must exist: ${c.icon}`);
      const sz = fs.statSync(p).size;
      assert.ok(sz > 50000, `${id} icon candidate must be substantial (>50KB): ${sz} bytes`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 2: 真實瀏覽器（Chrome CDP）解碼與 drawImage 查核結果
// -----------------------------------------------------------------------------
test('QA-2: 真實瀏覽器中 10 大候選素材 100% 成功解碼、繪製且 WebP 404 數為 0', () => {
  const auditPath = path.join(QA_DIR, 'DECODE_AUDIT.json');
  assert.ok(fs.existsSync(auditPath), 'DECODE_AUDIT.json must exist');

  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  assert.equal(audit.webp404Count, 0, 'Must have zero WebP 404s');
  assert.equal(audit.decodeData.length, 10, 'Must cover all 10 fusion recipes');

  for (const item of audit.decodeData) {
    if (item.main) {
      assert.ok(item.main.decodeOk, `${item.id} main must decode successfully`);
      assert.ok(item.main.drawOk, `${item.id} main must draw to canvas successfully`);
      assert.equal(item.main.naturalWidth, 1264, `${item.id} main naturalWidth must be 1264`);
      assert.equal(item.main.naturalHeight, 848, `${item.id} main naturalHeight must be 848`);
      assert.ok(item.main.nonZeroAlpha > 1000, `${item.id} main must have substantial non-zero alpha pixels`);
    }
    if (item.icon) {
      assert.ok(item.icon.decodeOk, `${item.id} icon must decode successfully`);
      assert.ok(item.icon.drawOk, `${item.id} icon must draw to canvas successfully`);
      assert.equal(item.icon.naturalWidth, 1264, `${item.id} icon naturalWidth must be 1264`);
      assert.equal(item.icon.naturalHeight, 848, `${item.id} icon naturalHeight must be 848`);
      assert.ok(item.icon.nonZeroAlpha > 1000, `${item.id} icon must have substantial non-zero alpha pixels`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 3: 真實遊戲（index.html）HUD 多幀合約查核
// -----------------------------------------------------------------------------
test('QA-3: 真實遊戲運行中扇子 HUD 融合折疊兩球變一球＋釋出一槽，升級可填新武器', () => {
  const metricsPath = path.join(QA_DIR, 'HUD_IN_GAME_METRICS.json');
  assert.ok(fs.existsSync(metricsPath), 'HUD_IN_GAME_METRICS.json must exist');

  const m = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
  // Frame 0: 4 active weapons
  assert.equal(m.activeCountS0, 4, 'Frame 0 activeCount must be 4');
  assert.deepEqual(m.s0, ['katana', 'fire', 'barrier', 'boom']);

  // Frame 1: Fused
  assert.equal(m.activeCountS1, 3, 'Frame 1 activeCount must decrease to 3');
  assert.equal(m.parentKatanaInS1, false, 'Katana must NOT be in active slots after fusion');
  assert.equal(m.parentFireInS1, false, 'Fire must NOT be in active slots after fusion');
  assert.equal(m.fusionInkbladeInS1, true, 'Fusion inkblade must occupy slot 0');
  assert.equal(m.freedSlotIsNullInS1, true, 'Slot 1 must be freed as null (renders ＋)');

  // Frame 3: Level-up adds thunder
  assert.equal(m.activeCountS3, 4, 'Frame 3 activeCount restored to 4');
  assert.equal(m.thunderInS3, true, 'Thunder must fill the freed slot 1');
  assert.deepEqual(m.s3, ['fusion_inkblade', 'thunder', 'barrier', 'boom']);
});

// -----------------------------------------------------------------------------
// Test 4: 真實截圖檔案佐證完整性
// -----------------------------------------------------------------------------
test('QA-4: 桌面 1366x768 與手機橫向 844x390 截圖實體檔案完整且非空', () => {
  const expectedShots = [
    'game_desktop_1366x768_frame0_prefused.png',
    'hud_desktop_fan_frame0_prefused.png',
    'game_desktop_1366x768_frame1_fused.png',
    'hud_desktop_fan_frame1_fused.png',
    'game_desktop_1366x768_frame2_cooldown.png',
    'hud_desktop_fan_frame2_cooldown.png',
    'game_desktop_1366x768_frame3_levelup.png',
    'hud_desktop_fan_frame3_levelup.png',
    'game_mobile_844x390_frame1_fused.png',
    'hud_mobile_fan_frame1_fused.png',
    'game_mobile_844x390_frame3_levelup.png',
    'hud_mobile_fan_frame3_levelup.png'
  ];

  for (const shot of expectedShots) {
    const p = path.join(QA_DIR, shot);
    assert.ok(fs.existsSync(p), `Screenshot must exist: ${shot}`);
    const sz = fs.statSync(p).size;
    assert.ok(sz > 10000, `Screenshot must be valid PNG (>10KB): ${shot} (${sz} bytes)`);
  }
});
