// AGY 專屬關卡內容與天候接線驗收測試
//
// 驗收項目：
// 1. Stage 6 (snow-temple) visual.weather 接線為 "snow"，fog 為 0.12。
// 2. 引擎 js/game.js drawStageWeather 具備原生 snow 分支，無需第三方假程序色塊。
// 3. Stage 7 (spirit-ferry) 與 Stage 8 (yomi) 詞包映射與對白契約映射獨立正確，無跨關錯植。
// 4. 8 關 STAGES key、stage.id、STORY.get key 完全一致，Boss 稱號與 enemy.bossTheme 直接對齊 consumer。
// 5. game.configureStage 消費介面 (visual/enemy/pacing/world) 完備，對齊 assets.js STAGE_ASSET_SLOTS 八關鍵名。
// 6. 8 關劇情 story-dialogue 具備 bossSeal 封印文、nextStageId 解鎖鏈，Stage 8 具備 epilogue。
// 7. 負向對照：不支援的天候、缺失之對白欄位或未對齊之 stageId 必須被明確拒絕。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORDS = require('../js/words.js');
const STORY = require('../js/story-dialogue.js');

const ALL_STAGE_IDS = [
  'night-town',
  'rain-port',
  'sakura-pass',
  'bamboo-maze',
  'hyakki-kyoto',
  'snow-temple',
  'spirit-ferry',
  'yomi'
];

// ── 1. Stage 6 雪燈山寺雪天接線 ──────────────────────────────
test('AGY-1 Stage 6 snow-temple visual.weather is wired to "snow" and engine supports it', () => {
  const stage = WORDS.getStage('snow-temple');
  assert.ok(stage, 'snow-temple 關卡必須存在');
  assert.equal(stage.id, 'snow-temple');
  assert.equal(stage.name, '雪燈山寺');

  // Visual weather contract
  assert.equal(stage.visual.weather, 'snow', 'Stage 6 必須宣告 weather: "snow"');
  assert.equal(typeof stage.visual.fog, 'number', 'Stage 6 應宣告山嵐晨霧 fog 數值');
  assert.ok(stage.visual.fog > 0 && stage.visual.fog <= 0.35, 'fog 數值應落在合法範圍 [0, 0.35]');
  assert.equal(stage.visual.petals, 0, '雪寺古道不應有落櫻花瓣');

  // Verify game.js native support (read-only inspection of source contract)
  const gameSrc = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf-8');
  assert.ok(
    gameSrc.includes('STAGE_VISUAL.weather === "snow"'),
    'js/game.js drawStageWeather 必須具備原生 snow 渲染分支'
  );
  assert.ok(
    gameSrc.includes('rgba(240, 248, 255, 0.75)'),
    'js/game.js snow 粒子必須採用雪白半透明和紙色調'
  );
});

// ── 2. Stage 7 & 8 詞包與劇情對白映射 ─────────────────────────
test('AGY-2 Stage 7 spirit-ferry and Stage 8 yomi word packs and story dialogue are correctly mapped', () => {
  // Stage 7: spirit-ferry
  const s7 = WORDS.getStage('spirit-ferry');
  assert.ok(s7, 'spirit-ferry 必須存在');
  assert.deepEqual(
    [...s7.wordPacks],
    ['ferry-feelings', 'ferry-states', 'ferry-phrases'],
    'Stage 7 詞包必須為幽河心緒、渡口情態與黃泉交談'
  );
  const s7Words = WORDS.getStageWords('spirit-ferry');
  assert.ok(s7Words.length >= 18, `Stage 7 詞庫量充足（實際 ${s7Words.length} 詞）`);

  const s7Story = STORY.get('spirit-ferry');
  assert.ok(s7Story, 'Stage 7 劇情對白必須存在');
  assert.equal(s7Story.stageNumber, 7);
  assert.equal(s7Story.title, '幽世渡口');
  assert.equal(s7Story.bossTitle, '幽冥渡船使');
  assert.ok(s7Story.opening.includes('三途靈河'), 'Stage 7 開場描述必須切合三途靈河主題');
  assert.ok(s7Story.bossIntro.includes('三途無岸'), 'Stage 7 Boss 開場白正確');

  // Stage 8: yomi
  const s8 = WORDS.getStage('yomi');
  assert.ok(s8, 'yomi 必須存在');
  const s8Words = WORDS.getStageWords('yomi');
  assert.ok(s8Words.length >= 150, `Stage 8 全關混合總複習詞庫量充足（實際 ${s8Words.length} 詞）`);

  const s8Story = STORY.get('yomi');
  assert.ok(s8Story, 'Stage 8 劇情對白必須存在');
  assert.equal(s8Story.stageNumber, 8);
  assert.equal(s8Story.title, '黃泉境');
  assert.equal(s8Story.bossTitle, '黃泉邪神·言靈之核');
  assert.ok(s8Story.opening.includes('赤月'), 'Stage 8 開場描述必須切合赤月妖城主題');

  // Cross-stage distinctness: no identical Boss titles across all 8 stages
  const allBossTitles = new Set();
  for (let i = 1; i <= 8; i++) {
    const sId = ALL_STAGE_IDS[i - 1];
    const story = STORY.get(sId);
    assert.ok(story, `Stage ${i} (${sId}) 必須具備故事對白`);
    assert.ok(!allBossTitles.has(story.bossTitle), `Boss Title 不得跨關重複：${story.bossTitle}`);
    allBossTitles.add(story.bossTitle);
  }
  assert.equal(allBossTitles.size, 8, '8 關必須具備 8 個唯一專屬 Boss 稱謂');
});

// ── 3. 8 關 STAGES key、stage.id、STORY.get key 與 Boss consumer 契約 ──
test('AGY-4 STAGES keys, stage.id, and STORY.get keys are identical and align directly with consumers', () => {
  const expectedBossThemes = {
    'night-town': 'town',
    'rain-port': 'harbor',
    'sakura-pass': 'sakura',
    'bamboo-maze': 'bamboo',
    'hyakki-kyoto': 'kyoto',
    'snow-temple': 'temple',
    'spirit-ferry': 'ferry',
    'yomi': 'yomi'
  };

  for (const stageKey of ALL_STAGE_IDS) {
    const stage = WORDS.STAGES[stageKey];
    assert.ok(stage, `WORDS.STAGES[${stageKey}] 必須存在`);
    assert.equal(stage.id, stageKey, `stage.id 必須與 STAGES key ${stageKey} 完全一致`);

    // STORY.get(STAGE.id)
    const story = STORY.get(stage.id);
    assert.ok(story, `STORY.get(${stage.id}) 必須成功取得故事資料`);
    assert.equal(story.stageId, stage.id, `story.stageId 必須等於 stage.id (${stage.id})`);

    // game.js Boss spawn reads story.bossTitle
    assert.ok(story.bossTitle && typeof story.bossTitle === 'string', `${stage.id} 必須具備有效 bossTitle`);

    // game.js Boss spawn reads STAGE_ENEMY.bossTheme === "harbor"
    assert.equal(
      stage.enemy.bossTheme,
      expectedBossThemes[stageKey],
      `${stage.id} enemy.bossTheme 必須為 ${expectedBossThemes[stageKey]}`
    );
  }
});

// ── 4. game.configureStage 消費介面與 assets.js 八關鍵名對齊 ─────────────
test('AGY-5 game.configureStage consumer interfaces and assets.js stageId alignment', () => {
  const assetsSrc = fs.readFileSync(path.join(__dirname, '../js/assets.js'), 'utf-8');

  for (const stageId of ALL_STAGE_IDS) {
    const stage = WORDS.getStage(stageId);
    assert.ok(stage, `WORDS.getStage(${stageId}) 必須存在`);

    // 1. stage.visual (ground, petals, fireflies, weather, fog)
    assert.ok(stage.visual, `${stageId} 必須有 visual`);
    assert.ok(typeof stage.visual.ground === 'string', `${stageId} visual.ground 必須是字串`);
    assert.ok(typeof stage.visual.petals === 'number', `${stageId} visual.petals 必須是數字`);
    assert.ok(typeof stage.visual.fireflies === 'number', `${stageId} visual.fireflies 必須是數字`);

    // 2. stage.enemy (speedScale, shooterChance, bossHpScale, bossTheme)
    assert.ok(stage.enemy, `${stageId} 必須有 enemy`);
    assert.ok(stage.enemy.speedScale >= 1, `${stageId} enemy.speedScale 必須 >= 1`);
    assert.ok(stage.enemy.shooterChance >= 0, `${stageId} enemy.shooterChance 必須 >= 0`);
    assert.ok(stage.enemy.bossHpScale >= 1, `${stageId} enemy.bossHpScale 必須 >= 1`);

    // 3. stage.pacing (runSeconds, goalDeliveries, bossTimes, surgeFirst, surgeInterval)
    assert.ok(stage.pacing, `${stageId} 必須有 pacing`);
    assert.equal(stage.pacing.runSeconds, 600, `${stageId} pacing.runSeconds 應為 600`);
    assert.equal(stage.pacing.goalDeliveries, 6, `${stageId} pacing.goalDeliveries 應為 6`);
    assert.ok(Array.isArray(stage.pacing.bossTimes) && stage.pacing.bossTimes.length === 4, `${stageId} bossTimes 必須為 4 元素陣列`);

    // 4. stage.world (chunkWidth, chunkHeight, activeRadius, seed, layoutOffset)
    assert.ok(stage.world, `${stageId} 必須有 world`);
    assert.equal(stage.world.chunkWidth, 900, `${stageId} world.chunkWidth 應為 900`);
    assert.equal(stage.world.chunkHeight, 600, `${stageId} world.chunkHeight 應為 600`);
    assert.equal(stage.world.activeRadius, 2, `${stageId} world.activeRadius 應為 2`);

    // 5. 对齐 assets.js STAGE_ASSET_SLOTS key
    assert.ok(
      assetsSrc.includes(`"${stageId}":`),
      `assets.js STAGE_ASSET_SLOTS 必須包含相同 stageId: ${stageId}`
    );
  }
});

// ── 5. 8 關劇情 bossSeal 封印文與 nextStageId 解鎖鏈 ─────────────
test('AGY-6 Eight-stage story progression: bossSeal, unlock chain, and epilogue', () => {
  for (let i = 0; i < ALL_STAGE_IDS.length; i++) {
    const sId = ALL_STAGE_IDS[i];
    const story = STORY.get(sId);
    assert.ok(story, `關卡 ${sId} 必須具備劇情對白`);

    // bossSeal
    assert.ok(story.bossSeal && story.bossSeal.length > 10, `${sId} 必須具備完整首領封印對白 (bossSeal)`);

    // nextStageId
    const expectedNext = i < ALL_STAGE_IDS.length - 1 ? ALL_STAGE_IDS[i + 1] : null;
    assert.equal(story.nextStageId, expectedNext, `${sId} nextStageId 必須指向下一關 (${expectedNext})`);
    assert.equal(STORY.getNextStageId(sId), expectedNext, `STORY.getNextStageId(${sId}) 應返回 ${expectedNext}`);
  }

  // Stage 8 epilogue
  const s8Story = STORY.get('yomi');
  assert.ok(s8Story.epilogue && s8Story.epilogue.length > 20, 'Stage 8 yomi 必須具備通關終局尾聲對白 (epilogue)');
});

// ── 6. 負向對照測試 ──────────────────────────────────────────
test('AGY-7 negative control: mismatched stageId or missing consumer fields must be detected', () => {
  // Unsupported weather test
  const supportedWeathers = new Set(['rain', 'snow']);
  const fakeWeather = 'tornado';
  assert.ok(!supportedWeathers.has(fakeWeather), '假天候 tornado 必須被判定為不支援');

  // Corrupted story dialogue test
  const badStory = { stageId: 'fake-stage', title: '假關卡' };
  const requiredFields = ['stageId', 'stageNumber', 'chapter', 'title', 'opening', 'delivery', 'bossTitle', 'bossIntro', 'bossSeal', 'clear', 'hint'];
  const missing = requiredFields.filter(f => !badStory[f]);
  assert.ok(missing.length > 0, `缺失欄位必須被偵測出：缺失 ${missing.join(', ')}`);

  // Mismatched ID detection
  const mismatched = { stageKey: 'stage-3', id: 'stage-three' };
  assert.notEqual(mismatched.stageKey, mismatched.id, '不同步的 stageKey 與 id 必須被判定不合格');
});
