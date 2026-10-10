// V3 自然路線量測（Hermes 責任範圍）。
//
// 這裡的每個斷言都對應 V3 的一條可驗收規則，但**時間門檻只標為目標**，
// 未實測達標前不得宣稱平衡。區分三種狀態：
//   已實測 —— 本檔斷言且通過
//   待實測 —— 本檔量到數字，但門檻是 V3 目標而非規則
//   未量測 —— 明確標為 null，不以 0 冒充
//
// 禁止事項（違反即為假證據）：
//   不 teleport、不 giveXP、不 setSkills／maxOut、不設無敵、不強改 state 抹掉選卡流程。
//   走動一律用 walkToInteract／walkNear（真步進），選卡一律用 takeLevelUpChoice。
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, BASELINE_REVISION } = require('./helpers/game-runtime.cjs');

const SEEDS = [11, 12, 23];
const SHORT = { name: 'short-run', timeoutMs: 20000 };

/** 單次配送的真實流程：走到取貨屋 → interact() → 走到收件屋可答題範圍 → 站正解墊等提交。 */
function deliverOnce(g, log) {
  for (let i = 0; i < 300 && g.ordersNow().length === 0; i++) g.update(0.05);
  const open = g.ordersNow();
  if (!open.length) return { ok: false, reason: 'no-order-generated' };
  // 依真實距離選最近的一張單：orders[0] 不一定最近，會讓路徑控制器假失敗。
  const here = g.snapshot();
  const order = open.slice().sort((a, b) =>
    Math.hypot(a.from.x - here.x, a.from.y - here.y) - Math.hypot(b.from.x - here.x, b.from.y - here.y))[0];

  g.clearInteract();
  const toPickup = g.walkToInteract(order.from, 60);
  if (!toPickup.reached) return { ok: false, reason: 'pickup-unreachable', walk: toPickup, order: order.word.jp };
  if (!g.realPickup()) return { ok: false, reason: 'interact-failed', order: order.word.jp };
  const job = g.snapshot().job;

  g.clearInteract();
  // 進答題區與站上答案墊都用真步進；不使用 atDestination／atAnswer 瞬移。
  const zone = g.walkIntoAnswerZone({ tolerance: 190, maxSeconds: 90 });
  if (!zone.reached) return { ok: false, reason: 'answer-zone-unreachable', walk: zone };
  const pad = g.walkToAnswerPad({ tolerance: 26, maxSeconds: 90 });
  if (!pad.ok) return { ok: false, reason: 'answer-pad-' + pad.reason, walk: pad.walk };
  const s = g.snapshot();
  const walked = (toPickup.seconds || 0) + (zone.seconds || 0) + (pad.walk ? pad.walk.seconds : 0);
  if (log) log.push({ word: job.word.jp, walkSeconds: +walked.toFixed(2), dwell: pad.dwell, preHold: pad.preHold, postWait: pad.postWait, delivered: s.delivered, xp: s.xp, level: s.level });
  return { ok: true, dwell: pad.dwell, preHold: pad.preHold, postWait: pad.postWait, walkSeconds: +walked.toFixed(2), delivered: s.delivered, xp: s.xp, level: s.level, seals: g.v3().sealCount };
}

/**
 * 在開局就安裝選卡記錄器：走動途中若觸發升級（walkToInteract 內會呼叫 onLevelUp），
 * 也要記入真實 pick 結果。否則 logs 只看得到配送後的選卡。
 */
function installPickRecorder(g, picks, strategy) {
  g.onLevelUp = () => {
    const s = g.snapshot();
    const idx = typeof strategy === 'function' ? strategy(s, picks) : 0;
    const res = g.takeLevelUpChoice(idx);
    if (!res.ok) { picks.rejected.push(res.reason); g.waitLevelUpCooldown(240); g.stepFrame(16.7); return; }
    if (res.type === 'passive') picks.passive++;
    else { picks.weapon++; if (res.lv === 5) picks.awaken++; }
  };
  return g;
}

/** 累加選卡統計（不要用 Object.assign 覆蓋既有統計）。 */
function addPicks(into, from) {
  into.passive += from.passive;
  into.weapon += from.weapon;
  into.awaken += from.awaken;
  into.rejected.push(...from.rejected);
  return into;
}

/** 用真選卡流程處理升級（含 0.4 秒冷卻、四槽／印規則）。 */
function handleLevelUps(g, strategy) {
  const picked = { passive: 0, weapon: 0, awaken: 0, rejected: [] };
  let guard = 0;
  while (g.snapshot().state === 'levelup' && guard++ < 40) {
    const s = g.snapshot();
    const idx = typeof strategy === 'function' ? strategy(s, picked) : 0;
    const res = g.takeLevelUpChoice(idx);
    if (!res.ok) { picked.rejected.push(res.reason); g.waitLevelUpCooldown(120); g.stepFrame(16.7); continue; }
    if (res.type === 'passive') picked.passive++;
    else { picked.weapon++; if (res.lv === 5) picked.awaken++; }
  }
  return picked;
}

// ---------------------------------------------------------------- 已實測規則

test('V3 route: 幀推進會讓升級冷卻遞減（先前用 update() 永不減）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.forceLevelUp();
  assert.equal(g.snapshot().state, 'levelup', 'forceLevelUp 應進入 levelup');
  assert.ok(g.levelUpCooldown() > 0, '進入升級應有冷卻');
  const waited = g.waitLevelUpCooldown(240);
  assert.equal(waited.levelupCooldown, 0,
    `冷卻應在有限幀內歸零，實際用了 ${waited.frames} 幀後仍為 ${waited.levelupCooldown}`);
});

test('V3 route: 選卡必須真的提升等級並回到 play（不可假 ok）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.forceLevelUp();
  const before = g.snapshot().level;
  const res = g.takeLevelUpChoice(0);
  assert.equal(res.ok, true, `選卡應生效，實際 reason=${res.reason}`);
  assert.equal(g.snapshot().level, before + 1, '等級應 +1');
  assert.notEqual(g.snapshot().state, 'levelup', '應離開 levelup 回到 play');
});

test('V3 route: 走動途中觸發升級不會卡死（walkToInteract 內處理）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  for (let i = 0; i < 300 && g.ordersNow().length === 0; i++) g.update(0.05);
  const order = g.ordersNow()[0];
  assert.ok(order, '應有委託可取');
  // 給足 XP 讓步行途中觸發升級（用 forceLevelUp 模擬，不改 production）。
  g.forceLevelUp();
  assert.equal(g.snapshot().state, 'levelup');
  g.clearInteract();
  const r = g.walkToInteract(order.from, 40);
  assert.equal(typeof r.reached, 'boolean', '應回傳結果而非卡死');
  assert.notEqual(g.snapshot().state, 'levelup', 'walkToInteract 應處理升級卡而非留下 levelup 狀態');
});

test('V3 route: 真步進可完成一次完整配送（walk + interact + dwell 提交）', () => {
  for (const seed of SEEDS) {
    const g = loadGame({ seed });
    g.start();
    g.stopSpawns();
    g.clearEnemies();
    const r = deliverOnce(g);
    assert.equal(r.ok, true, `seed ${seed} 應完成配送：${r.reason || ''} ${JSON.stringify(r.walk || {})}`);
    console.log(JSON.stringify({
      scenario: 'single-delivery-dwell', seed,
      dwell: r.dwell, preHold: r.preHold, postWait: r.postWait
    }));
    // 玩家實際讀題時間 = 進答案半徾前的累積 hold + 到達後的等待，必須達到 V3 的 0.65 秒。
    assert.ok(r.dwell >= 0.65,
      `讀題停留總時間應 ≥0.65 秒（hold ${r.preHold} + 等待 ${r.postWait} = ${r.dwell}，seed ${seed}）`);
    assert.equal(g.snapshot().delivered, 1);
  }
});

test('V3 route: 配送 XP 為 26，停生成時敵掉落 XP 必須為 0（XP 帳以升級花費回推）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  const r = deliverOnce(g);
  assert.equal(r.ok, true, r.reason);
  const ledger = g.enemyXp();
  assert.equal(ledger.fromDelivery, 26 * 1, `單筆配送應為 26 XP，實際 ${ledger.fromDelivery}`);
  assert.equal(ledger.fromEnemies, 0, `停生成時不應有敵掉落 XP，實際 ${ledger.fromEnemies}`);
  assert.equal(ledger.totalEarned, ledger.fromDelivery, '總獲得應等於配送獲得（未升級時）');
});

test('V3 route: 有擊殺時敵掉落 XP 為 2／隻（真走過去吸靈玉，不直接改 XP）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.combatScene('thunder', [{ dx: 150, hp: 1, type: 'ghost' }], [], 1);
  g.armWeapons();
  for (let i = 0; i < 20; i++) g.update(0.1);
  const gems = g.snapshot().gems;
  assert.ok(gems.length >= 1, '擊殺後應掉落靈玉');
  assert.equal(gems[0].v, 2, '單隻普通怪應掉 2 XP');
  // 真走到靈玉上吸取（靈玉需在 24px 內才被吸收）。
  g.walkNear(gems[0].x, gems[0].y, 30, 30, 1 / 60, 20);
  for (let i = 0; i < 20; i++) g.update(0.05);
  const ledger = g.enemyXp();
  assert.equal(ledger.fromEnemies, 2, `敵掉落 XP 應為 2，實際 ${ledger.fromEnemies}`);
  assert.equal(ledger.fromDelivery, 0);
});

test('V3 route: 連續六單真步進可完成（印與等級為量測輸出）', () => {
  for (const seed of SEEDS) {
    const g = loadGame({ seed });
    g.start();
    g.stopSpawns();
    g.clearEnemies();
    const picks = { passive: 0, weapon: 0, awaken: 0, rejected: [] };
    installPickRecorder(g, picks);
    let failure = null;
    for (let i = 0; i < 6; i++) {
      const r = deliverOnce(g);
      if (!r.ok) { failure = { index: i, ...r }; break; }
      addPicks(picks, handleLevelUps(g));
    }
    const s = g.snapshot();
    console.log(JSON.stringify({
      scenario: 'six-deliveries', seed,
      delivered: s.delivered, level: s.level, seals: g.v3().sealCount,
      xp: s.xp, xpLedger: g.enemyXp(), picks, failure: failure && failure.reason || null
    }));
    assert.equal(failure, null, `seed ${seed} 應完成六單，實際卡在第 ${failure && failure.index + 1} 單：${failure && failure.reason}`);
    assert.equal(s.delivered, 6, `seed ${seed} 應完成六單`);
  }
});

test('V3 route: 選卡可真的取到被動卡（用遊戲自己的升級流程觸發）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  // setXp 是 fixture 探針（直接給經驗以觸發升級），不是 production 介面；
  // 這裡用它避免「要累積數百 XP 才看得到被動卡」的測試成本。
  const picks = { passive: 0, weapon: 0, awaken: 0, rejected: [] };
  for (let i = 0; i < 4; i++) {
    g.setXp(g.currentXp() + g.snapshot().xpNeed);
    g.update(1 / 60);
    assert.equal(g.snapshot().state, 'levelup', '給足經驗後應進入升級');
    addPicks(picks, handleLevelUps(g, s => {
      // 策略：優先被動卡，沒有才 fallback 第一張。
      const passiveIndex = s.choiceIds.findIndex(id =>
        ['shield', 'oil_max', 'oil_heal', 'dmg', 'rate', 'crit', 'spd', 'dash', 'mag'].includes(id));
      return passiveIndex >= 0 ? passiveIndex : 0;
    }));
  }
  console.log(JSON.stringify({ scenario: 'passive-choices', level: g.snapshot().level, ...picks }));
  assert.ok(picks.passive >= 1,
    `應至少真的取得一次被動卡（被動 ${picks.passive}、主動 ${picks.weapon}、拒卡 ${JSON.stringify(picks.rejected)}）`);
  assert.equal(g.snapshot().level, 5, '四次升級後等級應為 5');
});

test('V3 route: 站立 vs 配送的燈油曲線差異（站樁無淨回油為 V3 規則）', () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();
  g.stopSpawns();
  g.clearEnemies();
  g.setOil(80);
  const before = g.snapshot().oil;
  for (let i = 0; i < 600; i++) g.update(0.05);   // 30 秒不動
  const delta = g.snapshot().oil - before;
  assert.ok(delta <= 0, `站樁 30 秒不得淨回油，實際 ${delta.toFixed(2)}`);
});

test('V3 route: 有生成的真實運行（結果僅為量測，非門檻）', SHORT, () => {
  const g = loadGame({ seed: SEEDS[0] });
  g.start();   // 保留真實生成
  const log = [];
  const picks = { passive: 0, weapon: 0, awaken: 0, rejected: [] };
  installPickRecorder(g, picks);
  let deliveries = 0;
  const t0 = Date.now();           // 真實經過時間（沙箱模擬通常比局內快很多）
  let gameSeconds = 0;
  while (Date.now() - t0 < SHORT.timeoutMs) {
    const r = deliverOnce(g, log);
    if (r.ok) { deliveries++; addPicks(picks, handleLevelUps(g)); }
    else if (r.reason === 'no-order-generated') break;
    const s = g.snapshot();
    gameSeconds = s.elapsed;
    if (s.elapsed >= 600 || s.state !== 'play') break;
  }
  const s = g.snapshot();
  const walked = log.reduce((sum, d) => sum + d.walkSeconds, 0);
  const dwell = log.reduce((sum, d) => sum + d.dwell, 0);
  console.log(JSON.stringify({
    scenario: 'natural-partial', seed: SEEDS[0],
    gameElapsed: +gameSeconds.toFixed(1),          // 局內秒（snapshot.elapsed）
    wallMs: Date.now() - t0,                        // 真實經過毫秒
    deliveries, orders: log.length,
    walkSecondsTotal: +walked.toFixed(1),           // 模擬器花在走路上的局內秒
    dwellSecondsTotal: +dwell.toFixed(1),
    level: s.level, seals: g.v3().sealCount, state: s.state, enemies: s.enemies.length, picks
  }));
  assert.ok(deliveries >= 1, '真實生成下仍應能完成至少一單');
  assert.ok(gameSeconds > 0, '局內時間應前進');
});
