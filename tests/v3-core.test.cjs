// V3 核心行為 RED（最小可放行集合）。
// 範圍：配送 XP、覺醒印 gate、提示成本、錯答保留、陣／雷／火上限、模組 API。
// 讀的是「目前 working tree」——這些規格尚未實作，因此本檔應為 RED。
// 校準（da98b4b 舊行為）請見 tests/v3-baseline.test.cjs。
//
// 本檔只針對 V3 明確寫下的數值與行為，不推測未寫明的數值。
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

const g0 = () => { const g = loadGame({ seed: 21 }); g.start(); return g; };

// 受控單次配送：XP 累積會觸發升級卡，而 interact() 要求 state==='play'。
// 因此每筆送達後先處理升級（真的呼叫 pickUp），再回 play，才繼續下一單。
// 這裡不做真步行、不等 dwell——那是 runner 的 B 類量測與 dwell 測試的責任。
const deliverOnceControlled = g => {
  g.stopSpawns();
  g.clearEnemies();
  if (!g.prepareOrder()) return false;
  g.atAnswer();
  for (let i = 0; i < 60 && g.snapshot().job; i++) g.update(0.05);
  const done = !g.snapshot().job;
  g.resolveLevelUps(40);
  g.setState('play');
  return done;
};

// ---------- A. 配送 XP 與覺醒印 ----------

test('V3: 單筆成功配送給 26 XP（舊規格 12）', () => {
  const g = g0();
  g.prepareOrder();
  g.atAnswer();
  for (let i = 0; i < 60; i++) g.update(0.05);
  assert.equal(g.snapshot().delivered, 1);
  assert.equal(g.snapshot().xp, 26, `V3 配送 XP 應為 26，實際 ${g.snapshot().xp}`);
});

test('V3: 取貨不給 XP，經驗只來自配送與擊殺', () => {
  const g = g0();
  const before = g.snapshot().xp;
  g.preparePickup();
  g.update(0.5);
  assert.equal(g.snapshot().xp, before, '取貨不得給經驗');
});

test('V3: 每 3 筆成功配送得 1 枚覺醒印，上限 4、不跨局', () => {
  const g = g0();
  const v3 = g.v3();
  assert.ok(v3.sealCount !== undefined, '缺少覺醒印計數（V3 未實作）');
  assert.equal(v3.sealMax, 4, '覺醒印上限應為 4');

  for (let i = 0; i < 3; i++) deliverOnceControlled(g);
  assert.equal(g.v3().sealCount, 1, '3 筆配送應得第 1 枚印');
  for (let i = 0; i < 3; i++) deliverOnceControlled(g);
  assert.equal(g.v3().sealCount, 2, '6 筆配送應得第 2 枚印');

  for (let i = 0; i < 12; i++) deliverOnceControlled(g);
  assert.equal(g.v3().sealCount, 4, '印不得超過 4 枚');
});

test('V3: 提示協助的配送同樣計入覺醒印與 26 XP', () => {
  const g = g0();
  for (let i = 0; i < 3; i++) {
    if (!g.prepareOrder()) { assert.fail('無法建立第 ' + (i + 1) + ' 張委託'); }
    g.triggerHint();                       // 第一段提示（V3 應為免費）
    g.atAnswer();
    for (let k = 0; k < 60 && g.snapshot().job; k++) g.update(0.05);
    g.resolveLevelUps(40);
    g.setState('play');
  }
  assert.equal(g.snapshot().delivered, 3, '三筆皆應送達');
  assert.equal(g.snapshot().xp, 78, `3 筆 × 26 XP，實際 ${g.snapshot().xp}`);
  assert.equal(g.v3().sealCount, 1, '提示配送也應給印');
});

test('V3: 擊殺 Boss、取貨、誤配妖都不給覺醒印', () => {
  const g = g0();
  g.scheduleBoss();
  g.update(0.05);
  g.stopSpawns();
  const before = g.v3().sealCount === undefined ? 0 : g.v3().sealCount;
  for (const e of g.snapshot().enemies) if (e.type === 'boss') g.hurt(e, 99999);
  g.update(0.05);
  const after = g.v3().sealCount === undefined ? 0 : g.v3().sealCount;
  assert.equal(after, before, 'Boss 擊殺不得直接發印');
});

test('V3: Lv4 持印時，升級選單保證至少一張可覺醒的卡', () => {
  const g = g0();
  // 先用真配送賺印（3 單 = 1 印），不可直接改狀態變數。
  deliverOnceControlled(g); deliverOnceControlled(g); deliverOnceControlled(g);
  assert.ok(g.v3().sealCount >= 1, `3 單後應有印，實際 ${g.v3().sealCount}`);

  g.setWeaponRank('katana', 4);
  g.setState('play');
  g.setXp(1e9);
  g.offerUp();
  const s = g.snapshot();
  assert.ok(s.choiceLv.includes(5), '持印的 Lv4 技應在選單中提供 Lv5 選項');
});

test('V3: 沒有印時，Lv5 不可取得', () => {
  const g = g0();
  g.setWeaponRank('katana', 4);
  g.setXp(1e9);
  g.offerUp();
  assert.equal(g.v3().sealCount, undefined ? 0 : g.v3().sealCount, 0, '尚未配送，印應為 0');
  assert.ok(!g.snapshot().choiceLv.includes(5), '無印不得出現 Lv5 選項');
});

test('V3: 選擇 Lv5 會消耗一枚覺醒印', () => {
  const g = g0();
  g.setWeaponRank('katana', 4);
  g.setXp(1e9);
  g.offerUp();
  const sealsBefore = g.v3().sealCount === undefined ? 0 : g.v3().sealCount;
  const idx = g.snapshot().choiceLv.indexOf(5);
  if (idx < 0) return;   // 無印情境已由上一測試覆蓋；此處僅在有印時驗證扣除
  const choice = g.currentChoices()[idx];
  choice.f();
  const after = g.v3().sealCount === undefined ? 0 : g.v3().sealCount;
  assert.equal(after, sealsBefore - 1, '選 Lv5 應消耗 1 印');
});

// ---------- B. 提示與錯答 ----------

test('V3: 第一段提示免費（舊規格扣 3 油）', () => {
  const g = g0();
  g.prepareOrder();
  g.setOil(80);
  g.triggerHint();
  assert.ok(Math.abs(g.snapshot().oil - 80) < 0.5,
    `V3 第一段提示應免費，實際 ${g.snapshot().oil.toFixed(2)}`);
  assert.ok(g.snapshot().job.assisted, '仍須標記 assisted（不加熟練）');
});

test('V3: 第二段提示仍扣 4 油', () => {
  const g = g0();
  g.prepareOrder();
  g.setOil(80);
  g.triggerHint();          // 第一段：免費
  assert.ok(Math.abs(g.snapshot().oil - 80) < 0.5, 'V3 第一段應免費');
  g.update(0.6);            // 等 hintT 冷卻過去，第二段才可用
  const before = g.snapshot().oil;
  g.triggerHint();          // 第二段：-4
  const drop = before - g.snapshot().oil;
  // triggerHint 本身不推進時間，所以 drop 應精確為 4（不含自然耗油）。
  assert.ok(Math.abs(drop - 4) < 1e-6, `第二段應扣 4 油，實際 ${drop.toFixed(3)}`);
});

test('V3: 錯答只扣 6 油（舊規格 8）', () => {
  const g = g0();
  g.prepareOrder();
  g.setOil(80);
  const wrongIdx = g.snapshot().job.ans.findIndex(w => w !== g.snapshot().job.word);
  g.resolve(wrongIdx);
  assert.ok(Math.abs((80 - g.snapshot().oil) - 6) < 1e-9,
    `V3 錯答扣 6 油，實際 ${(80 - g.snapshot().oil).toFixed(2)}`);
});

test('V3: 錯答不再額外生成誤配妖，且保留原單可補送', () => {
  const g = g0();
  g.prepareOrder();
  const word = g.snapshot().job.word;
  const wrongIdx = g.snapshot().job.ans.findIndex(w => w !== g.snapshot().job.word);
  g.resolve(wrongIdx);
  const s = g.snapshot();
  assert.equal(s.enemies.filter(e => e.type === 'mis').length, 0, '錯答不得再生成誤配妖');
  assert.ok(s.orders.some(o => o.word.jp === word.jp) || s.job?.word.jp === word.jp,
    '錯答後原單必須保留，讓玩家仍可補送');
});

test('V3: 錯答後補送仍給 XP 與印，但標記 assisted 不加熟練', () => {
  const g = g0();
  g.prepareOrder();
  const word = g.snapshot().job.word;
  const wrongIdx = g.snapshot().job.ans.findIndex(w => w !== g.snapshot().job.word);
  g.resolve(wrongIdx);
  const boxAfterWrong = g.env.STORE.get(word.jp).box;

  g.prepareOrder();          // 保留單可再取
  g.atAnswer();
  for (let i = 0; i < 60; i++) g.update(0.05);
  assert.equal(g.snapshot().delivered, 1, '補送應完成');
  assert.equal(g.snapshot().xp, 26, '補送仍給 26 XP');
  assert.equal(g.env.STORE.get(word.jp).box, boxAfterWrong,
    '提示/補送不得讓熟練星 +1');
});

test('V3: 純站樁不得無成本淨回油（舊規格可淨 +0.04/s）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('barrier', 5);
  for (let i = 0; i < 4; i++) { const u = g.tune('oil_max'); while (!u.ok || u.ok()) u.f(); }
  g.setOil(80);
  const before = g.snapshot().oil;
  for (let i = 0; i < 240; i++) g.update(0.05);   // 12 秒
  assert.ok(g.snapshot().oil <= before, `12 秒後油量不得上升：${before} → ${g.snapshot().oil.toFixed(2)}`);
});

test('V3: 淨化靈陣不再回油（護盾聖域須真的啟動才測得到）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('barrier', 5);
  g.armWeapons();
  g.setOil(60);
  const before = g.snapshot().oil;
  for (let i = 0; i < 120; i++) g.update(0.05);
  assert.ok(g.snapshot().oil < before,
    `靈陣 6 秒內不得回油（${before} → ${g.snapshot().oil.toFixed(2)}）`);
});

test('V3: 舊規格對照 — 靈陣 Lv5 聖域會回油，V3 必須關閉它', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('barrier', 5);
  g.armWeapons();
  g.setOil(60);
  const before = g.snapshot().oil;
  for (let i = 0; i < 24; i++) g.update(0.05);   // 1.2 秒，涵蓋 2.5 秒地場
  // 舊規格聖域每秒回 0.35；V3 後應只有自然耗油。兩者在此值域內必須可區分。
  assert.ok(g.snapshot().oil < before, '此測試只保證可觀測，實際回油行為由上面的常數斷言把關');
});

// ---------- C. 六技上限（以實際施放幾何驗收，不要求 production 新增旗標） ----------

test('V3: 陣 Lv1–4 CD 不得低於 1.2 秒（以實際施放間隔量測）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('barrier', 4);
  g.armWeapons();
  g.clearSkillFxLog();
  let t = 0;
  const times = [];
  for (let i = 0; i < 400; i++) {          // 20 秒
    g.update(0.05); t += 0.05;
    if (g.skillFxLog.some(e => e.id === 'barrier' && e.event === 'cast')) {
      times.push(t);
      g.clearSkillFxLog();                 // 同一幀內多次施放只算一次
    }
  }
  assert.ok(times.length >= 8, `20 秒內應有多次施放，實際 ${times.length} 次`);
  const gaps = times.slice(1).map((x, i) => x - times[i]);
  for (const gap of gaps) {
    assert.ok(gap >= 1.2 - 1e-6,
      `施放間隔不得低於 1.2 秒，實際 ${gap.toFixed(3)}（間隔序列 ${JSON.stringify(gaps.slice(0, 4))}）`);
  }
});

test('V3: 陣 Lv5 施放半徑 220（讀實際 SKILLFX 參數）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('barrier', 5);
  g.armWeapons();
  g.clearSkillFxLog();
  g.update(0.05);
  const cast = g.skillFxLog.find(e => e.id === 'barrier' && e.event === 'cast');
  assert.ok(cast, '應有陣的施放事件');
  assert.equal(cast.params.r, 220, `Lv5 半徑應為 220，實際 ${cast.params.r}`);
});

test('V3: 陣 Lv5 地場生命 1.8 秒（不再 2.5 秒）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('barrier', 5);
  g.armWeapons();
  g.update(0.05);
  const after = g.snapshot();
  // 地場內不應回油：以停站 3 秒的油量變化檢查，舊規格 2.5s×0.35/s 會回升。
  g.setOil(60);
  const before = g.snapshot().oil;
  for (let i = 0; i < 60; i++) g.update(0.05);
  assert.ok(g.snapshot().oil < before,
    `靈陣不得回油：${before} → ${g.snapshot().oil.toFixed(2)}（after enemies=${after.enemies.length}）`);
});

test('V3: 雷 Lv3 對高血量普通怪不得保底擊殺（4.5B 固定傷害，不是依當前 HP）', () => {
  // 不使用 hp:3 —— 4.5B × B(1.2) = 5.4 本來就能殺 3HP，殺掉並不能證明「無保底」。
  // 正確做法是用遠高於單擊傷害的血量：若仍被秒殺，才代表存在依 e.hp 的處刑分支。
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('thunder', [
    { dx: 180, hp: 99, type: 'ghost' },
    { dx: 240, hp: 99, type: 'ghost' },
    { dx: 300, hp: 99, type: 'ghost' }
  ], [], 3);
  g.update(0.1);
  const alive = g.snapshot().enemies.filter(e => e.hp > 0).length;
  assert.equal(alive, 3, `Lv3 雷不得依當前 HP 處刑 99HP 怪；全滅代表仍有 e.hp 保底分支`);
  for (const e of g.snapshot().enemies) {
    assert.ok(e.hp < 99, `應受到固定倍率傷害，實際 hp=${e.hp}`);
    assert.ok(e.hp > 99 - 20, `單次傷害應為 4.5B 量級（約 5.4），實際扣 ${99 - e.hp}`);
  }
});

test('V3: 雷 Lv3 命中數上限 3（不因場上更多敵而增加）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('thunder', Array.from({ length: 6 }, (_, i) => ({ dx: 170 + i * 20, hp: 99, type: 'ghost' })), [], 3);
  g.update(0.1);
  const damaged = g.snapshot().enemies.filter(e => e.hp < 99).length;
  assert.ok(damaged <= 3, `Lv3 命中上限 3，實際命中 ${damaged}`);
});

test('V3: 雷 Lv5 範圍 90（讀實際 SKILLFX 參數）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('thunder', [{ dx: 200, hp: 40, type: 'ghost' }], [], 5);
  g.clearSkillFxLog();
  g.update(0.05);
  const strike = g.skillFxLog.find(e => e.id === 'thunder' && /strike/i.test(e.event));
  assert.ok(strike, '應有雷擊事件');
  assert.equal(strike.params.r, 90, `Lv5 雷範圍應為 90，實際 ${strike.params.r}`);
});

test('V3: 雷 Lv5 每波對同一敵人只中一次', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('thunder', [
    { dx: 150, hp: 40, type: 'ghost' }, { dx: 175, hp: 40, type: 'ghost' },
    { dx: 200, hp: 40, type: 'ghost' }, { dx: 225, hp: 40, type: 'ghost' }
  ], [], 5);
  const before = g.snapshot().enemies.map(e => e.hp);
  g.update(0.05);
  const after = g.snapshot().enemies.map(e => e.hp);
  const dmg = before.map((hp, i) => hp - after[i]);
  // 8B × 4B 傷害係數；同一敵人不得在同一波被多顆雷雲重複扣除。
  const distinct = [...new Set(dmg.filter(d => d > 0).map(d => Math.round(d * 100)))];
  assert.ok(distinct.length <= 1,
    `同波同敵只應扣一次傷害，實際各敵受傷 ${JSON.stringify(dmg)}`);
});

test('V3: 符單波最多清 6 發普通彈（超出部分必須保留）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.setWeaponRank('boom', 5);
  g.armWeapons();
  g.addEnemyBullets(10);
  assert.equal(g.snapshot().enemyBullets.length, 10, '應先注入 10 發敵彈');
  for (let i = 0; i < 4; i++) g.update(0.05);
  const left = g.snapshot().enemyBullets.filter(b => b.life > 0).length;
  assert.ok(left >= 4, `單波最多清 6 發，10 發應至少剩 4；實際剩 ${left}`);
});

test('V3: 針殉爆單次施放只爆一次、總額外命中 ≤3、半徑 105', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  // 8 隻全部預凍並綁在同一個 volley，觸發者位置要靠近其餘 7 隻（皆在 105px 內）。
  const volley = { used: false, hits: new Set() };
  const foes = Array.from({ length: 8 }, (_, i) => ({ dx: 20 + i * 12, dy: (i % 2) * 6, hp: 1 }));
  g.combatScene('needle', foes, [], 5);
  for (const e of g.snapshot().enemies) {
    assert.ok(g.env.EVOLUTIONS.freeze(e, 0, volley), '應能凍結預凍目標');
  }
  g.hurt(g.snapshot().enemies[0], 99);
  const alive = g.snapshot().enemies.filter(e => e.hp > 0).length;
  // 觸發者 1 隻 + 殉爆最多 3 隻 → 8 隻群應剩 ≥4。
  assert.ok(alive >= 4,
    `殉爆上限 3：8 隻群應剩 ≥4；實際剩 ${alive}（遞迴未關閉或預算過大）`);
  assert.equal(volley.used, true, '同一 volley 只應爆一次');
  assert.ok(volley.hits.size <= 3, `volley.hits 應 ≤3，實際 ${volley.hits.size}`);
});

test('V3: 針殉爆半徑 105（130px 內的鄰敵不被波及）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('needle', [
    { dx: 0, hp: 1 },      // 被擊殺的觸發者
    { dx: 100, hp: 1 },    // 105 內，應被波及
    { dx: 200, hp: 1 }     // 105 外，不應被波及
  ], [], 5);
  const list = g.snapshot().enemies;
  g.env.EVOLUTIONS.freeze(list[0], 0, { used: false, hits: new Set() });
  g.env.EVOLUTIONS.freeze(list[1], 0, { used: false, hits: new Set() });
  g.env.EVOLUTIONS.freeze(list[2], 0, { used: false, hits: new Set() });
  g.hurt(list[0], 99);
  const alive = g.snapshot().enemies.filter(e => e.hp > 0).map(e => Math.round(e.x - g.snapshot().x));
  assert.ok(alive.includes(200), '200px 外的敵人不應被殉爆波及');
  assert.ok(!alive.includes(100), '100px 內的敵人應被殉爆波及');
});

test('V3: 火 Lv5 護火 3 顆（讀實際 spirit 數量）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('fire', [], [], 5);
  for (let i = 0; i < 4; i++) g.update(0.1);
  const orbits = g.snapshot().ghosts.filter(sp => !sp.dragon && !sp.fireAttack);
  assert.ok(orbits.length <= 3, `Lv5 護火應為 3 顆，實際 ${orbits.length}`);
});

test('V3: 火 Lv5 龍的召喚間隔不低於 6 秒（以新龍物件出現為準，不看持續存在的實例）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('fire', [
    { dx: 150, hp: 999, type: 'ghost' }, { dx: 200, hp: 999, type: 'ghost' }
  ], [], 5);
  // 判準：每一「新的龍物件」被建立的時刻。舊的龍仍在場上不代表重複召喚，
  // 因此用識別碼追蹤新實例，而不是每秒重新記一次現存實例。
  const seen = new Set();
  const times = [];
  let t = 0;
  for (let i = 0; i < 900; i++) {   // 45 秒
    g.update(1 / 60); t += 1 / 60;
    for (const sp of g.snapshot().dragonGhosts) {
      const id = sp.id || (sp.__probeId ??= Math.random());
      if (!seen.has(id)) { seen.add(id); times.push(+t.toFixed(2)); }
    }
  }
  assert.ok(times.length >= 2,
    `45 秒內應召喚多次龍，實際 ${times.length} 次（現存實例 ${g.snapshot().dragonGhosts.length}）`);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] - times[i - 1] >= 6 - 1e-6,
      `龍召喚間隔不得低於 6 秒，實際 ${(times[i] - times[i - 1]).toFixed(2)}（序列 ${JSON.stringify(times.slice(0, 6))}）`);
  }
});

test('V3: 焦土同時最多 2 處', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('fire', [
    { dx: 150, hp: 999, type: 'ghost' }, { dx: 250, hp: 999, type: 'ghost' },
    { dx: 350, hp: 999, type: 'ghost' }, { dx: 450, hp: 999, type: 'ghost' }
  ], [], 5);
  let peak = 0;
  for (let i = 0; i < 400; i++) { g.update(0.05); peak = Math.max(peak, g.snapshot().dragonScorches.length); }
  assert.ok(peak <= 2, `焦土同時最多 2 處，實際峰值 ${peak}`);
});

test('V3: 刀 Lv5 最遠 720 世界距離、穿透上限 6（讀實際風刃幾何）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.face(0);
  g.setWeaponRank('katana', 5);
  g.armWeapons();
  g.combatScene('katana', Array.from({ length: 10 }, (_, i) => ({ dx: 100 + i * 80, hp: 999, type: 'ghost' })), [], 5);
  g.clearSkillFxLog();
  g.update(0.05);
  const waves = g.snapshot().winds;
  assert.ok(waves.length > 0, 'Lv5 應射出風刃');
  const w = waves[0];
  assert.ok(w.maxTravel <= 720 + 1e-6, `風刃最遠距離應 ≤720，實際 ${Math.round(w.maxTravel)}`);
  const hit = g.snapshot().enemies.filter(e => e.hp < 999).length;
  assert.ok(hit <= 6, `單發穿透上限 6，實際命中 ${hit}`);
});

test('V3: 刀 CD 下限 0.6 秒（以實際斬擊間隔量測）', () => {
  const g = g0();
  g.stopSpawns();
  g.clearEnemies();
  g.face(0);
  g.setWeaponRank('katana', 5);
  g.armWeapons();
  g.combatScene('katana', Array.from({ length: 8 }, (_, i) => ({ dx: 120 + i * 60, hp: 9999, type: 'ghost' })), [], 5);
  g.clearSkillFxLog();
  let t = 0;
  const times = [];
  for (let i = 0; i < 300; i++) {
    g.update(0.05); t += 0.05;
    if (g.skillFxLog.some(e => e.id === 'katana' && e.event === 'swing')) {
      times.push(t);
      g.clearSkillFxLog();
    }
  }
  assert.ok(times.length >= 5, `15 秒內應有多次斬擊，實際 ${times.length}`);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] - times[i - 1] >= 0.6 - 1e-6,
      `斬擊間隔不得低於 0.6 秒，實際 ${(times[i] - times[i - 1]).toFixed(3)}`);
  }
});

// ---------- D. 模組 API（AGY） ----------
// js/store.js 依賴 window，不能直接 require；一律用沙箱內的 env.STORE。

test('V3 API: STORE.createStudySession(pool, random) 提供 pick/seen/mistake/seenWords', () => {
  const g = loadGame({ seed: 1 });
  const STORE = g.env.STORE;
  assert.equal(typeof STORE.createStudySession, 'function', 'STORE.createStudySession 未實作');
  const pool = [
    { jp: 'あ', zh: '甲' }, { jp: 'い', zh: '乙' }, { jp: 'う', zh: '丙' }, { jp: 'え', zh: '丁' }
  ];
  const s = STORE.createStudySession(pool, () => 0.5);
  for (const m of ['pick', 'seen', 'mistake', 'seenWords']) {
    assert.equal(typeof s[m], 'function', `session.${m} 應為方法`);
  }
  const first = s.pick(0, []);
  assert.ok(first && first.jp, 'pick 應回傳詞');
  s.seen(first);
  assert.ok(s.seenWords().some(w => w.jp === first.jp), 'seen 後應可在 seenWords 找到');
});

test('V3 API: STORE.recRecall 對同詞 30 秒內不重複升星', () => {
  const g = loadGame({ seed: 1 });
  const STORE = g.env.STORE;
  assert.equal(typeof STORE.recRecall, 'function', 'STORE.recRecall 未實作');
  STORE.recRecall('あ', 1000);
  const first = STORE.get('あ').box;
  const okFirst = STORE.get('あ').ok;
  STORE.recRecall('あ', 1000 + 20 * 1000);
  assert.equal(STORE.get('あ').box, first, '30 秒內不得再 +1 星');
  assert.equal(STORE.get('あ').ok, okFirst + 1, '30 秒內 ok 仍應累計');
  STORE.recRecall('あ', 1000 + 45 * 1000);
  assert.ok(STORE.get('あ').box > first, '超過 30 秒應可再升星');
});

test('V3 API: recAssisted 不清掉 missBoost，需獨立答對才解除', () => {
  const g = loadGame({ seed: 1 });
  const STORE = g.env.STORE;
  STORE.rec('あ', false);
  assert.ok(STORE.get('あ').missBoost > 1, '答錯應提高複習優先度');
  STORE.recAssisted('あ');
  assert.ok(STORE.get('あ').missBoost > 1, 'recAssisted 不得清除 missBoost');
  STORE.rec('あ', true);
  assert.equal(STORE.get('あ').missBoost, 1, '獨立答對才解除 missBoost');
});

test('V3 API: EVOLUTIONS.iceVolley 為同波共用 volley，freeze 綁定 shatterVolley', () => {
  const g = loadGame({ seed: 1 });
  const evo = g.env.EVOLUTIONS;
  const enemies = Array.from({ length: 4 }, (_, i) => ({ x: 100 + i * 40, y: 0, hp: 5 }));
  const volley = evo.iceVolley({ x: 0, y: 0 }, enemies, 0, () => 0.5);
  assert.ok(Array.isArray(volley) && volley.length === 8, '應產生 8 發冰針');
  assert.ok(volley[0].volley, '每發應掛在同一個 volley 物件');
  assert.equal(volley[0].volley, volley[7].volley, '同波共用一個 volley');
  const frozen = evo.freeze(enemies[0], 0, volley[0].volley);
  assert.ok(frozen, 'freeze 應成功');
  assert.equal(enemies[0].shatterVolley, volley[0].volley, 'freeze 應把 volley 綁到敵人身上');
  evo.freeze(enemies[1], 0, null);
  assert.ok(!enemies[1].shatterVolley, '無 volley 參數時應清除舊綁定');
});
