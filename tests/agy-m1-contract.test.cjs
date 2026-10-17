// AGY M1-A-DATA 關卡內容與劇情資料契約守護測試
//
// 驗證範圍：
// 1. 八關 stageId 不變量與映射一致性（night-town -> yomi，真實 WORDS 與 STORY 對齊）。
// 2. 164 unique words 分佈契約：前七關 [27, 27, 22, 22, 21, 24, 21]，S8 yomi 為 164 詞總複習。
// 3. 單字資料靜態欄位規範：檢驗 content 單字物件未宣告任何戰鬥屬性鍵值（非 runtime 戰力斷言）。
// 4. 八關短劇情三章進展、bossSeal 封印文與 nextStageId 解鎖鏈（S8 具備 epilogue）。
// 5. 靜態原始碼字串檢查：檢驗 game.js 保留六招 skillId 與 Lv5 覺醒名稱（非 runtime 行為斷言）。
// 6. 真實 WORDS / STORY consumer 邊界與負向回落防禦驗證。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORDS = require('../js/words.js');
const STORY = require('../js/story-dialogue.js');

const EXPECTED_STAGE_IDS = Object.freeze([
  'night-town',
  'rain-port',
  'sakura-pass',
  'bamboo-maze',
  'hyakki-kyoto',
  'snow-temple',
  'spirit-ferry',
  'yomi'
]);

const EXPECTED_STAGE_WORD_COUNTS = Object.freeze([27, 27, 22, 22, 21, 24, 21, 164]);

// ── 1. 八關 stageId 不變量與映射 ──────────────────────────────
test('M1-DATA-1 Eight stage IDs match exactly across WORDS and STORY without drift', () => {
  const contentStageKeys = Object.keys(WORDS.STAGES);
  const storyStageKeys = Object.keys(STORY.STAGES);

  assert.deepEqual(contentStageKeys, EXPECTED_STAGE_IDS, 'WORDS.STAGES keys 必須完全吻合官方八關 ID');
  assert.deepEqual(storyStageKeys, EXPECTED_STAGE_IDS, 'STORY.STAGES keys 必須完全吻合官方八關 ID');

  for (const stageId of EXPECTED_STAGE_IDS) {
    const cStage = WORDS.getStage(stageId);
    const sStage = STORY.get(stageId);
    assert.ok(cStage, `WORDS 必須能檢索 stageId: ${stageId}`);
    assert.ok(sStage, `STORY 必須能檢索 stageId: ${stageId}`);
    assert.equal(cStage.id, stageId, `WORDS stage.id 必須與 key 一致: ${stageId}`);
    assert.equal(sStage.stageId, stageId, `STORY stage.stageId 必須與 key 一致: ${stageId}`);
  }
});

// ── 2. 164 unique words 分佈與 S8 總複習契約 ───────────────────
test('M1-DATA-2 164 unique words distribution contract and S8 comprehensive review', () => {
  const allWords = WORDS.getAllWords();
  assert.equal(allWords.length, 164, '全庫單字總數必須正好為 164 unique words');

  const uniqueJp = new Set(allWords.map(w => w.jp));
  assert.equal(uniqueJp.size, 164, '所有單字之日文 (jp) 必須唯一，無重複字條');

  const actualCounts = EXPECTED_STAGE_IDS.map(id => WORDS.getStageWords(id).length);
  assert.deepEqual(
    actualCounts,
    EXPECTED_STAGE_WORD_COUNTS,
    '八關單字分佈必須嚴格維持前七關 27/27/22/22/21/24/21，第八關 164 詞總複習'
  );

  const s8Words = WORDS.getStageWords('yomi');
  const s8JpSet = new Set(s8Words.map(w => w.jp));
  assert.equal(s8JpSet.size, 164, 'S8 yomi 必須涵蓋完整 164 詞，無任何遺漏');
});

// ── 3. 單字資料靜態欄位規範（無戰鬥數值鍵值） ─────────────────
test('M1-DATA-3 Word content items static schema check (absence of combat keys)', () => {
  const allWords = WORDS.getAllWords();
  const FORBIDDEN_COMBAT_KEYS = [
    'atk', 'attack', 'dmg', 'damage', 'def', 'defense',
    'hp', 'power', 'crit', 'speed', 'shield', 'buff'
  ];

  for (const word of allWords) {
    assert.ok(word.id, `Word 必須有 id: ${word.jp}`);
    assert.ok(word.jp, 'Word 必須有 jp 假名/日文');
    assert.ok(word.zh, `Word 必須有 zh 繁中文義: ${word.jp}`);
    assert.ok(word.romaji, `Word 必須有 romaji 羅馬音: ${word.jp}`);
    assert.ok(Array.isArray(word.stageIds), `Word 必須有 stageIds 陣列: ${word.jp}`);
    assert.ok(word.stageIds.length >= 1, `Word 至少出現於一關: ${word.jp}`);

    // 靜態資料安全檢查：確保 content 單字未被配置戰鬥數值鍵值（非 runtime 戰力判定）
    for (const key of Object.keys(word)) {
      assert.ok(
        !FORBIDDEN_COMBAT_KEYS.includes(key.toLowerCase()),
        `Word [${word.jp}] 靜態資料包含戰鬥屬性鍵值 [${key}]`
      );
    }
  }
});

// ── 4. 八關短劇情三章進展、bossSeal 封印文與解鎖鏈 ─────────────
test('M1-DATA-4 Three chapters progression, bossSeal, and nextStageId link chain in STORY', () => {
  const chapters = EXPECTED_STAGE_IDS.map(id => STORY.get(id).chapter);
  assert.deepEqual(chapters, [1, 1, 1, 2, 2, 2, 3, 3], '八關必須嚴格遵循第一章(1-3)、第二章(4-6)、第三章(7-8)劃分');

  for (let i = 0; i < EXPECTED_STAGE_IDS.length; i++) {
    const currentId = EXPECTED_STAGE_IDS[i];
    const story = STORY.get(currentId);

    assert.ok(story.title, `${currentId} 必須有標題`);
    assert.ok(story.opening, `${currentId} 必須有開場對白`);
    assert.ok(story.delivery, `${currentId} 必須有送達短語`);
    assert.ok(story.bossTitle, `${currentId} 必須有首領稱號`);
    assert.ok(story.bossIntro, `${currentId} 必須有首領登場語`);
    assert.ok(story.bossSeal, `${currentId} 必須有封印成功解除文案`);
    assert.ok(story.clear, `${currentId} 必須有通關過場`);

    if (i < EXPECTED_STAGE_IDS.length - 1) {
      assert.equal(
        story.nextStageId,
        EXPECTED_STAGE_IDS[i + 1],
        `${currentId} 的 nextStageId 必須指向下一關 ${EXPECTED_STAGE_IDS[i + 1]}`
      );
    } else {
      assert.equal(story.nextStageId, null, 'S8 yomi 為終章，nextStageId 必須為 null');
      assert.ok(story.epilogue && story.epilogue.length > 20, 'S8 yomi 必須包含完整的終章結尾對白 epilogue');
    }
  }
});

// ── 5. 靜態原始碼字串檢查：game.js 六招與 Lv5 覺醒名稱 ────────
test('M1-DATA-5 Static source presence check for baseline six skills and awakened titles in game.js', () => {
  const BASELINE_SKILLS = Object.freeze({
    katana: { zh: '妖刀斬', awakenedName: '覺醒・斷空殘月斬' },
    barrier: { zh: '淨化靈陣', awakenedName: '覺醒・金剛退魔曼荼羅' },
    fire: { zh: '狐火炎', awakenedName: '覺醒・墨焰黑龍' },
    boom: { zh: '陰陽符', awakenedName: '覺醒・兩儀延爆' },
    thunder: { zh: '天狐雷', awakenedName: '覺醒・建御雷神破界天罰' },
    needle: { zh: '天狐靈針', awakenedName: '覺醒・九尾極寒靈暴' }
  });

  const gameSrc = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf-8');
  for (const [id, meta] of Object.entries(BASELINE_SKILLS)) {
    assert.ok(
      gameSrc.includes(`id: "${id}"`),
      `js/game.js 原始碼必須包含基礎技能 id: ${id}`
    );
    assert.ok(
      gameSrc.includes(meta.zh),
      `js/game.js 原始碼必須包含技能繁中名稱: ${meta.zh}`
    );
    assert.ok(
      gameSrc.includes(meta.awakenedName),
      `js/game.js 原始碼必須包含 Lv5 覺醒名稱: ${meta.awakenedName}`
    );
  }
});

// ── 6. 真實 WORDS / STORY consumer 邊界與負向回落驗證 ─────────
test('M1-DATA-6 Real CONTENT and STORY consumer defensive negative fallback checks', () => {
  // 1. WORDS.getStage 對未註冊關卡安全回落到 night-town
  const fallbackStage = WORDS.getStage('unknown-stage-id');
  assert.ok(fallbackStage, '未註冊關卡應返回安全回落關卡物件');
  assert.equal(fallbackStage.id, 'night-town', '未註冊關卡必須回落至 night-town');

  // 2. WORDS.getPack 對不存在的 packId 安全返回 null
  const nullPack = WORDS.getPack('unknown-pack-id');
  assert.equal(nullPack, null, '未註冊 packId 應返回 null');

  // 3. WORDS.getStageWords 對未註冊關卡 ID 安全返回 night-town 的 27 詞
  const fallbackWords = WORDS.getStageWords('unknown-stage-id');
  assert.equal(fallbackWords.length, 27, '未知關卡查詞應安全回落至 night-town 詞池');

  // 4. WORDS.getStageWords 對含有無效 packId 的 stage 物件不崩潰，安全略過
  const stageWithBadPack = { wordPacks: ['non-existent-pack'] };
  const badPackResult = WORDS.getStageWords(stageWithBadPack);
  assert.deepEqual(badPackResult, [], '無效 packId 應安全略過並返回空陣列');

  // 5. WORDS.getSiblingWords 傳入無效或空物件返回空陣列
  assert.deepEqual(WORDS.getSiblingWords(null), [], '傳入 null 應返回空陣列');
  assert.deepEqual(WORDS.getSiblingWords({}), [], '傳入無 packId 物件應返回空陣列');
  assert.deepEqual(WORDS.getSiblingWords({ packId: 'unknown-pack' }), [], '傳入未註冊 packId 應返回空陣列');

  // 6. STORY.get 對未知或非字串關卡安全返回 null
  assert.equal(STORY.get('unknown-stage-id'), null, 'STORY.get 未知關卡應返回 null');
  assert.equal(STORY.get(null), null, 'STORY.get 傳入 null 應返回 null');
  assert.equal(STORY.get(123), null, 'STORY.get 傳入非字串應返回 null');

  // 7. STORY.getNextStageId 對未知或空參數安全返回 null
  assert.equal(STORY.getNextStageId('unknown-stage-id'), null, 'STORY.getNextStageId 未知關卡應返回 null');
  assert.equal(STORY.getNextStageId(null), null, 'STORY.getNextStageId 傳入 null 應返回 null');
});
