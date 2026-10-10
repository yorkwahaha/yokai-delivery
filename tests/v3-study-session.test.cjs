// V3: STORE.createStudySession 的錯詞重現配額（AGY）。
// 定位問題：session 在兩次 priority pick 後 splice record，後續 mistake 對同一詞
// 又把 attemptsLeft 重設為 2，等於同一局內可無限次重現該詞，違反「本局 quota」上限。
//
// 規則來源 V3 F：錯詞 60–120 秒後最多兩次帶回，期間插入別詞；不強迫下單立即重考。
// 本檔只驗這些行為，不要求 production 為測試新增旗標。
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

const POOL = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く']
  .map((jp, i) => ({ jp, zh: `中文${i}` }));

const session = (seed = 3) => {
  const g = loadGame({ seed });
  const STORE = g.env.STORE;
  assert.equal(typeof STORE.createStudySession, 'function', 'STORE.createStudySession 未實作');
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return STORE.createStudySession(POOL, rand);
};

test('V3: 錯詞優先帶回恰好 2 次，之後回歸一般抽取（對照組統計法）', () => {
  // 為何用統計對照而非單次抽籤：一般池本來就可能抽到該詞（V3 明允許），
  // 所以「抽到該詞」不能單獨證明 priority。做法是同時量兩件事：
  //   used   —— 該詞已完成 2 次 priority 帶回，配額耗盡
  //   control —— 同一 rng、同一歷史節奏，但錯的是另一個詞（配額仍在）
  // 兩者的 pick 次數與 rng 消耗完全一致，唯一差別是「哪個詞還有 priority 記錄」。
  // 若配額失效，used 會在每次到期都回傳該詞（≈100%）；配額正確時只剩一般池的
  // 背景命中率（同一個測試裡先量出來當基線）。
  const g = loadGame({ seed: 1 });
  const STORE = g.env.STORE;
  const rnd = () => 0.999;
  const wrong = POOL[0], decoy = POOL[1];

  // 基線：完全沒有 mistake 時，一般池抽到 wrong 的頻率。
  const base = STORE.createStudySession(POOL, rnd);
  let baseHits = 0;
  for (let i = 0; i < 30; i++) { const p = base.pick(i * 30, []); if (p) { if (p.jp === wrong.jp) baseHits++; base.seen(p); } }
  const baseRate = baseHits / 30;

  // used：錯詞已完成 2 次配額，之後每次 mistake + 到期都不得再被 priority 帶回。
  const used = STORE.createStudySession(POOL, rnd);
  used.mistake(wrong, 0);
  const first = used.pick(121, []); if (first) used.seen(first);
  const fill1 = used.pick(122, []); if (fill1) used.seen(fill1);
  const second = used.pick(243, []); if (second) used.seen(second);
  const fill2 = used.pick(244, []); if (fill2) used.seen(fill2);
  let usedHits = 0;
  const CYCLES = 30;
  for (let i = 0; i < CYCLES; i++) {
    const t0 = 300 + i * 240;
    used.mistake(wrong, t0);
    const p = used.pick(t0 + 121, []);      // 錯詞到期點
    if (p) { if (p.jp === wrong.jp) usedHits++; used.seen(p); }
  }
  const usedRate = usedHits / CYCLES;

  // control：同一節奏但錯的是 decoy，配額只有 2 次，之後同樣到期——用來證明
  // 「到期點確實會觸發 priority」，避免 used 的低命中被誤讀成 pick 壞掉。
  const control = STORE.createStudySession(POOL, rnd);
  control.mistake(decoy, 0);
  const c1 = control.pick(121, []); if (c1) control.seen(c1);
  let controlPriorityHits = 0;
  for (let i = 0; i < CYCLES; i++) {
    const t0 = 300 + i * 240;
    control.mistake(decoy, t0);
    const p = control.pick(t0 + 121, []);
    if (p) { if (p.jp === decoy.jp) controlPriorityHits++; control.seen(p); }
  }

  assert.ok(first && first.jp === wrong.jp,
    `第一次到期（121s）應由 priority 帶回錯詞，實際 ${first && first.jp}`);
  assert.ok(second && second.jp === wrong.jp,
    `第二次到期（243s）應由 priority 帶回錯詞，實際 ${second && second.jp}`);

  // 配額失效時 control 會接近 100%；用它確認這個測試有能力偵測 priority。
  assert.ok(controlPriorityHits > 0,
    `對照組在配額內應會被 priority 帶回（>0），實際 ${controlPriorityHits} —— 此測試無鑑別力`);

  // 記錄實測數據，供 artifacts/validation/v3-acceptance-study.json 存證。
  console.log(JSON.stringify({
    scenario: 'study-quota',
    poolSize: POOL.length,
    backgroundRate: +baseRate.toFixed(3),
    usedRateAfterQuota: +usedRate.toFixed(3),
    controlPriorityHits,
    controlCycles: CYCLES
  }));

  // 配額失效時 used ≈ 100%（每個到期都覆蓋）；配額正確時 ≈ 一般池背景率。
  const ceiling = Math.min(0.9, baseRate + 0.35);
  assert.ok(usedRate <= ceiling,
    `配額耗盡後錯詞被 priority 帶回率 ${(usedRate * 100).toFixed(0)}%，` +
    `背景率 ${(baseRate * 100).toFixed(0)}%、上限 ${(ceiling * 100).toFixed(0)}% —— attemptsLeft 被重設`);
});

test('V3: 錯詞到期前不得被 priority 提前帶回', () => {
  const g = loadGame({ seed: 1 });
  const STORE = g.env.STORE;
  const s = STORE.createStudySession(POOL, () => 0.999);
  const wrong = POOL[0];
  s.mistake(wrong, 0);
  // 60 秒前：priority 尚未到期，normal 路徑應生效。
  const early = s.pick(30, []);
  assert.ok(early && early.jp !== wrong.jp,
    `錯詞應等待 60–120 秒，30 秒就抽到 ${early && early.jp}`);
});

test('V3: 錯詞重現之間必須插入別詞，不得連續同一詞', () => {
  const s = session(5);
  const w = POOL[0];
  s.mistake(w, 0);
  const seq = [];
  for (let i = 0; i < 10; i++) {
    const p = s.pick(i * 40, []);
    if (p) { seq.push(p.jp); s.seen(p); }
    if (i % 3 === 0) s.mistake(w, i * 40);
  }
  for (let i = 1; i < seq.length; i++) {
    assert.ok(seq[i] !== seq[i - 1],
      `連續兩次抽到同一詞（${seq[i - 1]} → ${seq[i]}），應插入別詞`);
  }
});

test('V3: 8 詞池用盡後 exclude 掉全部詞時 pick 必須回傳 null', () => {
  const s = session();
  const all = POOL.map(w => w.jp);
  const onlyWord = s.pick(0, all.slice(1));
  assert.ok(onlyWord && onlyWord.jp === 'あ', `全部排除後應只剩 ${onlyWord && onlyWord.jp}`);

  const s2 = session();
  const none = s2.pick(0, all);
  assert.equal(none, null, '排除全部候選時必須回傳 null，不得拋錯或回傳被排除的詞');
});

test('V3: pick 的 exclude 必須真的被排除', () => {
  const s = session();
  const banned = POOL.slice(0, 7).map(w => w.jp);
  for (let i = 0; i < 5; i++) {
    const p = s.pick(i * 10, banned);
    if (p) {
      assert.ok(!banned.includes(p.jp), `exclude 失效：抽到被排除的 ${p.jp}`);
      s.seen(p);
    }
  }
});

test('V3: seenWords 是方法且可列出本局已接觸詞', () => {
  const s = session();
  assert.equal(typeof s.seenWords, 'function', 'seenWords 應為方法');
  const a = s.pick(0, []);
  const b = s.pick(10, []);
  if (a) s.seen(a);
  if (b) s.seen(b);
  const seen = s.seenWords().map(w => w.jp);
  if (a) assert.ok(seen.includes(a.jp), 'seen 應可查詢');
  if (b) assert.ok(seen.includes(b.jp), 'seen 應可查詢');
});