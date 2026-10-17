// R6／R5 獨立驗收：陰陽符（boom）黏貼延遲爆破契約
// ---------------------------------------------------------------------------
// 產出者：OpenCode（獨占 tests/ 與 R6 驗收腳本）。production 唯讀，本檔不改 js/。
// 執行：node --test tests/r5-talisman-blast.acceptance.cjs
//       （刻意不叫 *.test.cjs，故不進入 npm test 的既有回歸 glob；R5 未實作時
//         這份驗收會如實 RED，由 tools/r6-acceptance.cjs 明確記為 R 階段未通過。）
// 校準：tools/r6-calibration.cjs 以「模擬 R5 的 temp 副本」跑同一組探針，
//       證明這些斷言量得到 R5 行為，而不是永遠失敗或永遠假綠。
//
// 設計原則（避免假綠／假紅）：
// 1. 一律量「可觀察行為」（HP 損失、位置位移、音效事件、投射物存在），
//    不要求 production 為測試新增旗標，也不綁死實作會用的變數名。
// 2. 「黏貼」＝連續多幀貼身且每幀位移≈0；單純飛過不算（否則迴力鏢會假通過）。
// 3. 單符情境用 Lv1（boomCount(1) === 1，唯一一發），避免多發扇形散射造成
//    「另一發沒黏到」的幾何假紅；量測前先凍結冷卻，避免第二波混入單次爆破契約。
// 4. 比例斷言優先於絕對數值（Lv1–Lv5/MAX 數值尚未定案）。
//
// 待裁決假設（需 Codex 契約審定；本檔依 R5 條文「符咒改版」全階採同一機制）：
//   - Lv1–Lv4 是否都改為黏貼延遲爆破（條文寫的是技能改版，未逐階豁免）。
//   - 目標死亡／暫停／結算時是「原地引爆後清除」或「直接清除不引爆」，
//     本檔只驗收不變量（不拋錯、不重複爆破、不留殘留），不強迫特定政策。
//   - 濺射半徑與震退距離屬未定案數值，本檔以「近處 20%／遠處 0%」與位移方向驗收。
//
// R5 條文對照（roadmap.md R5）：
//   (a) 單向射出→命中黏貼、隨目標移動      (b) 延遲 1.5s 或 2s 爆炸（可調）
//   (c) 被貼目標全額傷害                  (d) 周邊 20% 濺射 + 震退
//   (e) 單符只爆一次、不重複濺射全傷目標  (f) 目標死亡／離場
//   (g) Boss 護盾與震退抗性               (h) 多符黏貼疊爆
//   (i) 暫停／結算清理                   (j) 發射與爆炸分離音效
//   (k) 跨技能回歸
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = process.env.R6_SRC_ROOT || null;           // 校準用：指向 temp 副本
const { loadGame } = require('./helpers/game-runtime.cjs');

const HP = 100000;          // 夠大，避免擊殺／斬殺規則干擾量測
const DT = 1 / 60;
const SPLASH_RATIO = 0.2;   // R5 (d) 周邊小怪 20%
const FUSE_OPTIONS = [1.5, 2]; // R5 (b) 1.5 秒或 2 秒（待試玩定案）
const ATTACH_PX = 80;       // 判定「貼身」的距離
const GLUE_PX = 70;         // 逐幀黏貼判定距離（涵蓋 Boss 54px 貼合半徑）
const STICK_FRAMES = 12;    // 連續貼身幀數（0.2 秒）才算黏住
const STICK_MOTION_PX = 2;  // 黏住時投射物每幀位移上限（飛行中約 9.7px/幀）
const FUSE_MIN = 1.4;       // 黏貼後至少要等這麼久才准爆破（契約 1.5／2 的下限）
const RATIO_TOL = 0.02;     // 比例容許誤差
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// --------------------------------------------------------------------------
// 場景與量測工具
// --------------------------------------------------------------------------
const foe = (id, dx, dy = 0) => ({ id, dx, dy, hp: HP, max: HP, speed: 0, wob: 0, flash: 0 });

function scene(rank, spec = {}) {
  const g = loadGame({ seed: 7, srcRoot: SRC_ROOT });
  g.start();
  g.stopSpawns();            // 停止自然生成，量測期間怪數固定
  g.clearSolids();           // 清掉町屋碰撞，避免黏貼路徑被牆擋
  g.setDamageCoefficient(1);// 傷害係數固定為 1，量測值乾淨
  g.combatScene('boom', spec.foes || defaultFoes(), spec.walls || [], rank);
  g.armWeapons();
  const foes = g.snapshot().enemies;   // 活體參考：即使後來離場，索引仍穩定
  return { g, foes, rank };
}
function defaultFoes() {
  return [foe('main', 200), foe('near', 262), foe('far', 900)];
}
function soloFoes(extra = []) {
  return [foe('main', 200), ...extra];
}

// 逐幀時間線。用活體參考 foes 取 HP／位置，避免死亡過濾造成索引位移。
function timeline(s, seconds, dt = DT) {
  const frames = [];
  let t = 0;
  while (t < seconds - 1e-9) {
    const before = s.foes.map(f => f.hp);
    const audioMark = s.g.audioCalls.length;
    const fxMark = s.g.skillFxLog.length;
    s.g.update(dt);
    t += dt;
    const snap = s.g.snapshot();
    frames.push({
      t,
      delta: s.foes.map((f, i) => before[i] - f.hp),
      pos: s.foes.map(f => ({ x: f.x, y: f.y })),
      proj: snap.proj.map(q => ({ x: q.x, y: q.y })),
      audio: s.g.audioCalls.slice(audioMark),
      // 爆發類特效事件（hit/burst/blast/explode…）——事件名尚未定案。
      boom: s.g.skillFxLog.slice(fxMark)
        .filter(c => c.id === 'boom' && /hit|burst|blast|explode|fuse|boom/i.test(c.event))
        .map(c => ({ event: c.event, params: c.params })),
    });
  }
  return frames;
}

const dist2proj = (f, target) => Math.min(...f.proj.map(q => Math.hypot(q.x - target.x, q.y - target.y)), Infinity);
// 投射物這一步的最小位移。黏在目標上時≈0（跟著目標），飛行中≈9.7px/幀（580px/s）。
function projMotion(frames, i) {
  const prev = frames[i - 1], cur = frames[i];
  if (i === 0 || !prev || !prev.proj.length || !cur.proj.length) return Infinity;
  let best = Infinity;
  for (const q of cur.proj) for (const p of prev.proj) {
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best) best = d;
  }
  return best;
}
// 黏貼起點：連續 STICK_FRAMES 幀「貼身且幾乎不動」。迴力鏢飛過目標不算黏貼。
function stickyIndex(frames, targetOf) {
  for (let i = 1; i + STICK_FRAMES < frames.length; i++) {
    let ok = true;
    for (let j = i; j < i + STICK_FRAMES; j++) {
      if (dist2proj(frames[j], targetOf(frames[j])) >= ATTACH_PX || projMotion(frames, j) > STICK_MOTION_PX) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}
const damageFrames = (frames, index) => frames.filter(f => f.delta[index] > 0);
const boomFrameIndex = frames => frames.findIndex(f => f.boom.length > 0);
const stuck = detail => `符咒沒有黏住目標（${detail}）`;

// 互動式等到「真的黏上」：貼身且該幀位移≈0（不是飛過）。回傳命中幀號或 -1。
function waitForPaste(s, index = 0, maxFrames = 300) {
  let prev = s.g.snapshot().proj.map(q => ({ x: q.x, y: q.y }));
  for (let i = 0; i < maxFrames; i++) {
    s.g.update(DT);
    const cur = s.g.snapshot().proj;
    const target = s.foes[index];
    const glued = cur.some(q => Math.hypot(q.x - target.x, q.y - target.y) < GLUE_PX
      && prev.some(p => Math.hypot(p.x - q.x, p.y - q.y) <= STICK_MOTION_PX));
    prev = cur.map(q => ({ x: q.x, y: q.y }));
    if (glued) return i;
  }
  return -1;
}
// 凍結冷卻（wT=Infinity）：量測單次爆破契約時，不讓第二波混進來。
function freezeVolley(s) { s.g.setWeaponRank('boom', s.rank); }

// 單符單獨命中時的「全額傷害」D，做為 20% 比例基準（Lv 數值未定案，故用比例）。
function soloFullDamage(rank = 1) {
  const s = scene(rank, { foes: soloFoes() });
  const at = waitForPaste(s);
  if (at < 0) return null;
  freezeVolley(s);
  const frames = timeline(s, 3);
  const hit = damageFrames(frames, 0)[0];
  if (!hit) return null;
  return { damage: hit.delta[0], volley: s.g.snapshot().proj.length, stickT: hit.t - 0, hit };
}

// 傷害帳不變量（多符疊爆情境）：任一敵人的累積傷害，必須是 20% 單位的整數倍。
// 全傷＝5 單位、濺射＝1 單位，所以任何合法組合都是整數；非整數代表
// 比例不是 20%（例如 30%）、或同一次結算被摻進半套數值。
// 「單符只爆一次／全傷不被重複計算」由 (c)(e) 的單符情境單獨驗收，這裡不重複。
function assertDamageUnits(damage, full, label) {
  const unit = full * SPLASH_RATIO;
  const units = damage / unit;
  assert.ok(Math.abs(units - Math.round(units)) <= 0.12,
    `${label}：累積傷害 ${damage.toFixed(2)} 不是 20%（${unit.toFixed(2)}）的整數倍（units=${units.toFixed(3)}）` +
    '，疑似濺射比例不是 20% 或單次結算被摻進非 20% 的數值');
}

// --------------------------------------------------------------------------
// R5 (a)(b)：命中黏貼、隨目標移動、延遲 1.5／2 秒
// --------------------------------------------------------------------------
test('R5 (a)(b) 符咒命中後黏在目標身上，貼身當下不得立即造成傷害', () => {
  for (const rank of [1, 3, 5]) {
    const s = scene(rank);
    const frames = timeline(s, 3);
    const stick = stickyIndex(frames, f => f.pos[0]);
    assert.ok(stick >= 0, `Lv${rank} ${stuck(`連續 ${STICK_FRAMES} 幀未貼身（本波 ${frames[0].proj.length} 發）`)}`);
    assert.equal(frames[stick].delta[0], 0,
      `Lv${rank} 貼上瞬間就扣了 ${frames[stick].delta[0]} 傷害：R5 要求黏貼後才延遲爆破，不是飛行路徑即傷`);
  }
});

test('R5 (a) 符咒貼上後會跟著目標移動', () => {
  const s = scene(1);
  const at = waitForPaste(s);
  assert.ok(at >= 0, stuck('連續掃描 300 幀都沒真正黏上，可能是迴力鏢飛過'));
  s.foes[0].x += 140;                     // 目標移動
  s.g.update(DT); s.g.update(DT);
  const proj = s.g.snapshot().proj;
  assert.ok(proj.some(q => Math.hypot(q.x - s.foes[0].x, q.y - s.foes[0].y) < ATTACH_PX),
    `符咒沒有跟著目標移動（目標 x=${s.foes[0].x.toFixed(0)}，符咒=${JSON.stringify(proj.map(q => [Math.round(q.x), Math.round(q.y)]))}）`);
});

test('R5 (b) 黏貼到爆破的延遲必須是 1.5 秒或 2 秒（誤差 ≤0.08s）', () => {
  for (const rank of [1, 5]) {
    const s = scene(rank);
    const at = waitForPaste(s);
    assert.ok(at >= 0, `Lv${rank} ${stuck('未能完成黏貼')}`);
    freezeVolley(s);
    const frames = timeline(s, 3);
    const boom = boomFrameIndex(frames);
    assert.ok(boom >= 0, `Lv${rank} 黏貼後沒有任何爆破事件`);
    const delay = +(frames[boom].t).toFixed(3);
    assert.ok(FUSE_OPTIONS.some(o => near(delay, o, 0.08)),
      `Lv${rank} 實測黏貼後 ${delay}s 爆破，契約只允許 1.5s 或 2s（誤差 0.08s）`);
  }
});

test('R5 (b) 引爆延遲必須是可調的具名參數，不得散落硬編碼', () => {
  const s = scene(1);
  const at = waitForPaste(s);
  assert.ok(at >= 0, stuck('未能完成黏貼'));
  freezeVolley(s);
  const frames = timeline(s, 3);
  const boom = boomFrameIndex(frames);
  assert.ok(boom >= 0, '黏貼後沒有爆破事件');
  const tokens = [];
  const jsDir = SRC_ROOT || path.join(ROOT, 'js');
  for (const file of ['game.js', 'evolutions.js', 'config.js']) {
    const src = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const re = /([A-Za-z_$][\w$]*(?:FUSE|BLAST|OFUDA|BOOM|TALISMAN|DETONAT)[\w$]*)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/gi;
    let m;
    while ((m = re.exec(src))) tokens.push({ file, token: m[1], value: Number(m[2]) });
  }
  assert.ok(tokens.some(t => FUSE_OPTIONS.some(o => near(t.value, o, 0.001))),
    `找不到 1.5／2 的具名引爆延遲參數（實測 ${frames[boom].t.toFixed(3)}s）；` +
    `已掃到的相關 token：${JSON.stringify(tokens.slice(0, 8))}`);
});

// --------------------------------------------------------------------------
// R5 (c)(d)(e)：主目標全傷、周邊 20% + 震退、單符只爆一次、無雙算
// --------------------------------------------------------------------------
test('R5 (c)(e) 被貼目標吃全額傷害、同一發只結算一次，且旁邊有怪也不得改變它的傷害', () => {
  const solo = soloFullDamage(1);
  assert.ok(solo, '單獨命中時沒有「黏貼後的全額傷害」，無法建立基準');
  const s = scene(1);
  assert.ok(waitForPaste(s) >= 0, stuck('未能完成黏貼'));
  freezeVolley(s);
  const frames = timeline(s, 3);
  const hits = damageFrames(frames, 0);
  assert.equal(hits.length, 1, `同一發符咒對主目標結算 ${hits.length} 次（單符只爆一次）`);
  // 關鍵：基準與本場都跑「主目標 + 旁邊一隻怪」，所以雙算（全傷＋自己再吃 20%）
  // 在兩邊都會等比放大而互相抵銷。必須另外驗「旁邊有怪不改變主目標傷害」。
  const withNeighbour = hits[0].delta[0];
  const s2 = scene(1, { foes: [foe('main', 200)] });     // 同一場景但旁邊沒有怪
  assert.ok(waitForPaste(s2) >= 0, stuck('單目標場景未能完成黏貼'));
  freezeVolley(s2);
  const alone = damageFrames(timeline(s2, 3), 0)[0];
  assert.ok(alone, '單目標場景沒有結算傷害');
  assert.ok(near(withNeighbour, alone.delta[0], 0.001),
    `旁邊有怪時主目標傷害變成 ${withNeighbour.toFixed(2)}，無怪時是 ${alone.delta[0].toFixed(2)}：` +
    '主目標被混算了自己的 20% 濺射（無雙算條款）');
  assert.ok(near(withNeighbour, solo.damage, 0.001),
    `主目標傷害 ${withNeighbour} 與單獨基準 ${solo.damage} 不符`);
});

test('R5 (d) 周邊小怪承受 20% 濺射傷害，範圍外完全不動', () => {
  const solo = soloFullDamage(1);
  assert.ok(solo, '缺少單獨基準');
  const s = scene(1);
  assert.ok(waitForPaste(s) >= 0, stuck('未能完成黏貼'));
  freezeVolley(s);
  const frames = timeline(s, 3);
  const hits = damageFrames(frames, 1);
  assert.equal(hits.length, 1, `周邊目標被結算 ${hits.length} 次（單次爆破只應結算一次）`);
  const ratio = hits[0].delta[1] / solo.damage;
  assert.ok(near(ratio, SPLASH_RATIO, RATIO_TOL),
    `周邊濺射比例 ${(ratio * 100).toFixed(1)}%，契約為 20%`);
  assert.equal(frames.some(f => f.delta[2] > 0), false, '爆破範圍外的敵人不得受傷');
});

test('R5 (d) 周邊小怪被震退，方向為遠離爆點', () => {
  const s = scene(1);
  assert.ok(waitForPaste(s) >= 0, stuck('未能完成黏貼'));
  freezeVolley(s);
  let seen = s.g.skillFxLog.length, boomAt = -1;
  for (let i = 0; i < 300 && boomAt < 0; i++) {
    s.g.update(DT);
    const hits = s.g.skillFxLog.slice(seen).filter(c => c.id === 'boom' && /hit|burst|blast|explode|fuse|boom/i.test(c.event));
    seen = s.g.skillFxLog.length;
    if (hits.length) boomAt = i;
  }
  assert.ok(boomAt >= 0, '黏貼後沒有偵測到爆破事件');
  const center = { x: s.foes[0].x, y: s.foes[0].y };
  const before = { x: s.foes[1].x, y: s.foes[1].y };
  for (let i = 0; i < 30; i++) s.g.update(DT);   // 震退是逐幀位移，需要讓它走完
  const dx = s.foes[1].x - before.x, dy = s.foes[1].y - before.y;
  const push = Math.hypot(dx, dy);
  assert.ok(push > 1, `周邊小怪完全沒有被震退（爆破後 30 幀位移 ${push.toFixed(2)}px）`);
  assert.ok(((before.x - center.x) * dx + (before.y - center.y) * dy) / (push || 1) > 0, '震退方向不是遠離爆點');
});

// --------------------------------------------------------------------------
// R5 (f)：目標死亡／離場
// --------------------------------------------------------------------------
test('R5 (f) 被貼目標在爆破前死亡不得拋錯、不得留下殘留符咒或 NaN', () => {
  const solo = soloFullDamage(1);
  assert.ok(solo, '缺少單獨基準');
  const s = scene(1);
  assert.ok(waitForPaste(s) >= 0, stuck('未能完成黏貼'));
  freezeVolley(s);
  s.g.hurt(s.foes[0], HP * 2);           // 目標先死
  assert.ok(s.foes[0].hp <= 0, '測試前提失敗：目標沒死');
  const frames = timeline(s, 3);
  for (const f of s.foes) assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), '目標死亡後出現 NaN 座標');
  const hits = frames.filter(f => f.delta[1] > 0 || f.delta[2] > 0);
  assert.ok(hits.length <= 1, `目標死亡後仍結算 ${hits.length} 次濺射（單符只爆一次）`);
  const splash = frames.reduce((a, f) => a + f.delta[1] + f.delta[2], 0);
  assert.ok(splash <= solo.damage * (SPLASH_RATIO + RATIO_TOL) + 0.001,
    `目標死亡後的殘餘符咒造成 ${splash.toFixed(2)} 傷害，超過一次 20% 濺射上限`);
  assert.equal(frames.at(-1).proj.length, 0, '目標死亡後殘留未清除的符咒');
});

// --------------------------------------------------------------------------
// R5 (g)：Boss 護盾與震退抗性（同時是跨技能既有規則的回歸守門）
// --------------------------------------------------------------------------
function bossScene(shield, rank = 1) {
  const g = loadGame({ seed: 7, srcRoot: SRC_ROOT });
  g.start(); g.stopSpawns(); g.clearSolids(); g.setDamageCoefficient(1);
  g.combatScene('boom', [], [], rank);
  g.placeBoss(HP, { dx: 200 });
  const boss = g.snapshot().enemies[0];
  Object.assign(boss, { shield, quizClosed: true, speed: 0, wob: 0, hp: HP, max: HP });
  g.armWeapons();
  return { g, foes: [boss], rank };
}

test('R5 (g) 破盾 Boss 於爆破時才吃全額傷害，護盾 Boss 不吃技能傷害', () => {
  const open = bossScene(false);
  assert.ok(waitForPaste(open) >= 0, `破盾 Boss ${stuck('符咒沒有黏上 Boss')}`);
  freezeVolley(open);
  const openFrames = timeline(open, 3);
  const openHit = damageFrames(openFrames, 0);
  assert.ok(openHit.length, '破盾 Boss 完全沒受到符咒傷害');
  assert.ok(openHit[0].t >= FUSE_MIN,
    `破盾 Boss 在黏貼後 ${openHit[0].t.toFixed(3)}s 就受傷，未走黏貼延遲爆破`);
  const shielded = bossScene(true);
  const shieldedFrames = timeline(shielded, 4);
  const shieldedHit = damageFrames(shieldedFrames, 0);
  assert.equal(shieldedHit.length, 0,
    `護盾 Boss 仍被符咒打了 ${JSON.stringify(shieldedHit.map(h => h.delta[0]))}（Boss 結界必須擋下）`);
  assert.ok(Number.isFinite(shielded.foes[0].x) && Number.isFinite(shielded.foes[0].y), '護盾 Boss 路徑出現 NaN');
});

test('R5 (g) Boss 不因符咒爆破被震退（既有全技能規則的回歸守門）', () => {
  const s = bossScene(false);
  assert.ok(waitForPaste(s) >= 0, stuck('符咒沒有黏上 Boss'));
  freezeVolley(s);
  const before = { x: s.foes[0].x, y: s.foes[0].y };
  timeline(s, 3);
  const push = Math.hypot(s.foes[0].x - before.x, s.foes[0].y - before.y);
  assert.ok(push <= 1, `Boss 被推了 ${push.toFixed(2)}px（Boss 不受技能震退）`);
});

// --------------------------------------------------------------------------
// R5 (h)：多符黏貼疊爆（以傷害帳不變量驗收，不綁死扇形幾何）
// --------------------------------------------------------------------------
test('R5 (h) 多符黏貼疊爆：每符至多爆一次，每敵傷害帳可分解成 全傷×n ＋ 濺射×k', () => {
  const solo = soloFullDamage(4);         // 同一階（Lv4）的單次全傷，避免混階比例
  assert.ok(solo, '缺少 Lv4 單次全傷基準');
  const targets = [foe('t0', 180), foe('t1', 265, 30), foe('t2', 250, -40), foe('by', 300, 90)];
  const s = scene(4, { foes: targets });       // Lv4 每波 4 符（既有 EVOLUTIONS 合約）
  const volley = (s.g.update(DT), s.g.snapshot().proj.length);
  assert.equal(volley, 4, `Lv4 每波應為 4 符，實際 ${volley}`);
  assert.ok(waitForPaste(s) >= 0, stuck(`Lv4 未能完成黏貼（本波 ${volley} 發）`));
  freezeVolley(s);
  const frames = timeline(s, 3);
  const first = boomFrameIndex(frames);
  assert.ok(first >= 0, 'Lv4 黏貼後沒有任何爆破');
  const window = frames.slice(first, first + 30);      // 首爆後 0.5 秒內即為本波結果
  const booms = window.filter(f => f.boom.length > 0);
  assert.ok(booms.every(f => f.t >= FUSE_MIN),
    `Lv4 在黏貼後 ${Math.min(...booms.map(f => f.t)).toFixed(3)}s 就爆破，未走 1.5／2 秒延遲`);
  assert.ok(booms.reduce((a, f) => a + f.boom.length, 0) <= volley,
    `本波 ${volley} 符卻發生 ${booms.reduce((a, f) => a + f.boom.length, 0)} 次爆發（單符只爆一次）`);
  let fullHits = 0;
  for (let i = 0; i < targets.length; i++) {
    const damage = window.reduce((a, f) => a + f.delta[i], 0);
    assertDamageUnits(damage, solo.damage, `Lv4 目標 ${targets[i].id}`);
    fullHits += Math.round(damage / solo.damage);   // 全傷次數（全傷＝1 次完整份額）
  }
  const boomsInWindow = booms.reduce((a, f) => a + f.boom.length, 0);
  // 每次爆發最多給一份全傷：全傷次數不得超過爆發次數（擋掉主目標被重複計算）。
  assert.ok(fullHits <= boomsInWindow,
    `全傷結算 ${fullHits} 次 > 爆發 ${boomsInWindow} 次（主目標被重複計算）`);
  // 未黏到任何目標的符咒（Lv4 扇形散射會有）到期消失，不得憑空造成傷害。
  const total = targets.reduce((a, _, i) => a + window.reduce((x, f) => x + f.delta[i], 0), 0);
  assert.ok(total <= volley * solo.damage * (1 + SPLASH_RATIO) + 0.001,
    `本波 ${volley} 符的總傷害 ${total.toFixed(2)} 超過理論上限`);
});

// --------------------------------------------------------------------------
// R5 (i)：暫停／結算清理
// --------------------------------------------------------------------------
test('R5 (i) 暫停期間黏貼中的符咒不得爆破，恢復後仍只爆一次', () => {
  const solo = soloFullDamage(1);
  assert.ok(solo, '缺少單獨基準');
  const s = scene(1, { foes: soloFoes() });
  assert.ok(waitForPaste(s) >= 0, stuck('暫停測試未能完成黏貼'));
  freezeVolley(s);
  const hpBefore = s.foes.map(f => f.hp);
  s.g.setState('pause');
  for (let i = 0; i < 180; i++) s.g.stepFrame(16.7);
  assert.deepEqual(s.foes.map(f => f.hp), hpBefore, '暫停期間符咒仍然爆破並造成傷害');
  s.g.setState('play');
  const frames = timeline(s, 3);
  const hits = damageFrames(frames, 0);
  assert.equal(hits.length, 1, `恢復後符咒結算 ${hits.length} 次（暫停不得造成重複爆破）`);
  assert.ok(near(hits[0].delta[0], solo.damage, 0.001), `恢復後傷害 ${hits[0].delta[0]} ≠ 單次全傷 ${solo.damage}`);
});

test('R5 (i) 結算（勝利／敗北）後不得再有符咒爆破，重開新局殘留為零', () => {
  for (const endState of ['won', 'lost']) {
    const s = scene(1, { foes: soloFoes() });
    assert.ok(waitForPaste(s) >= 0, `${endState}：${stuck('結算測試未能完成黏貼')}`);
    freezeVolley(s);
    const hpBefore = s.foes.map(f => f.hp);
    s.g.setState(endState);
    // 非 play 狀態下 update() 直接返回，這裡驗收的是「結算中符咒不再作用」。
    for (let i = 0; i < 180; i++) s.g.update(DT);
    assert.deepEqual(s.foes.map(f => f.hp), hpBefore, `${endState} 結算後符咒仍造成傷害`);
    s.g.start();
    assert.equal(s.g.snapshot().proj.length, 0, `${endState} 後重開新局仍有殘留符咒`);
  }
});

// --------------------------------------------------------------------------
// R5 (j)：發射與爆破分離音效
// --------------------------------------------------------------------------
test('R5 (j) 發射與爆破必須是兩個不同的音效事件（不得沿用同一個聲音）', () => {
  const s = scene(1);
  let seen = 0;
  const launchAudio = new Set();
  let pasted = false;
  for (let i = 0; i < 300 && !pasted; i++) {
    const mark = s.g.audioCalls.length;
    s.g.update(DT);
    s.g.audioCalls.slice(mark).forEach(a => launchAudio.add(a));
    const cur = s.g.snapshot().proj;
    const t = s.foes[0];
    pasted = cur.some(q => Math.hypot(q.x - t.x, q.y - t.y) < GLUE_PX);
    seen = s.g.skillFxLog.length;
  }
  assert.ok(pasted, stuck('未能完成黏貼，無法比對發射／爆破音效'));
  freezeVolley(s);
  let boomAudio = [];
  for (let i = 0; i < 300; i++) {
    const mark = s.g.audioCalls.length;
    const fx = seen;
    s.g.update(DT);
    const hits = s.g.skillFxLog.slice(fx).filter(c => c.id === 'boom' && /hit|burst|blast|explode|fuse|boom/i.test(c.event));
    if (hits.length) { boomAudio = s.g.audioCalls.slice(mark); break; }
  }
  assert.ok(boomAudio.length > 0, '爆破當下完全沒有音效（需求：獨立爆炸音效）');
  assert.ok(launchAudio.size > 0, '發射當下完全沒有音效（需求：獨立發射音效）');
  const shared = boomAudio.filter(a => launchAudio.has(a));
  assert.equal(shared.length, 0, `發射與爆破共用同一音效事件 ${JSON.stringify(shared)}（需求：分離音效）`);
});

// --------------------------------------------------------------------------
// R5 (k)：跨技能回歸
// --------------------------------------------------------------------------
test('R5 (k) 符咒改版不得影響其他技能的既有傷害', () => {
  const g = loadGame({ seed: 7, srcRoot: SRC_ROOT });
  g.start(); g.stopSpawns(); g.clearSolids(); g.setDamageCoefficient(1);
  g.combatScene('katana', [foe('k', 100)], [], 1);
  g.armWeapons();
  const target = g.snapshot().enemies[0];
  for (let i = 0; i < 120; i++) g.update(DT);
  assert.ok(target.hp < HP, '妖刀斬在 R5 改版後不再造成傷害（跨技能回歸）');
});