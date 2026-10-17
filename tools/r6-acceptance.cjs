#!/usr/bin/env node
/**
 * tools/r6-acceptance.cjs — R6 獨立驗收總runner（OpenCode 獨占）
 *
 * 一次跑完並彙整：
 *   1. known-good baseline（tests/*.test.cjs 既有全回歸）
 *   2. R5 符咒黏貼延遲爆破驗收（tests/r5-talisman-blast.acceptance.cjs）
 *   3. R1 逐詞音檔／單字圖／TTS fallback 驗收（tests/r1-word-assets.acceptance.cjs）
 *   4. R2 平板首次手勢解鎖音訊驗收（tests/r2-audio-unlock.acceptance.cjs）
 *   5. R3 手把 actuator 驗收（tests/r3-gamepad-haptics.acceptance.cjs）
 *   6. 校準狀態（讀 r6-calibration.json 與 r6-calibration-r2-r3.json）
 *
 * 使用方式：
 *   node tools/r6-acceptance.cjs              # 全部
 *   node tools/r6-acceptance.cjs --skip-base  # 跳過耗時的全回歸
 *
 * 邊界：
 * - production 唯讀；本工具與驗收檔都不改 js/、index.html、資產、roadmap.md。
 * - R2／R3 為真機項目，本工具一律標記 NOT_TESTED_ON_DEVICE，絕不計入通過。
 * - 不 commit／push／deploy。
 *
 * 退出碼：0 = 本 runner 執行完成（各項結果看報告）；驗收項目本身失敗仍會在報告
 *         標為 FAIL，但退出碼保留給「runner 本身壞掉」的情況（=2）。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6');
const SKIP_BASE = process.argv.includes('--skip-base');

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---------------------------------------------------------------------------
// 執行並解析 node --test
// ---------------------------------------------------------------------------
function runNodeTest(label, { files } = {}) {
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const pass = Number((out.match(/^# pass (\d+)$/m) || [])[1] || 0);
  const fail = Number((out.match(/^# fail (\d+)$/m) || [])[1] || 0);
  const skip = Number((out.match(/^# skipped (\d+)$/m) || [])[1] || 0);
  const failing = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1].trim());
  return { label, pass, fail, skip, exitCode: res.status, failing, output: out };
}

// ---------------------------------------------------------------------------
// 驗收矩陣（對應 roadmap.md 的 R1–R6）
// ---------------------------------------------------------------------------
function matrix(results) {
  const base = results.baseline;
  const r5 = results.r5;
  const r1 = results.r1;
  const r2 = results.r2;
  const r3 = results.r3;
  const r4 = results.r4;
  return [
    { id: 'baseline', item: '既有全回歸（tests/*.test.cjs）', status: base ? statusOf(base) : 'SKIPPED',
      evidence: base ? `${base.pass} pass / ${base.fail} fail` : '本輪以 --skip-base 略過',
      note: '這是改版前既有契約的回歸基線，不是 R 階段驗收。' },
    { id: 'R5-a', item: '符咒命中黏貼、隨目標移動', status: statusOfPick(r5, /R5 \(a\)/),
      evidence: 'tests/r5-talisman-blast.acceptance.cjs' },
    { id: 'R5-b', item: '延遲 1.5s／2s 可調、具名參數', status: statusOfPick(r5, /R5 \(b\)/),
      evidence: '同上；故障注入 fault-instant-boom 證明探針可分辨' },
    { id: 'R5-c', item: '主目標全額傷害（無雙算）', status: statusOfPick(r5, /R5 \(c\)/),
      evidence: '故障注入 fault-double-count 已驗證可抓到' },
    { id: 'R5-d', item: '周邊 20% 濺射 + 震退', status: statusOfPick(r5, /R5 \(d\)/),
      evidence: '故障注入 fault-splash-100pct / fault-no-knockback 已驗證可抓到' },
    { id: 'R5-e', item: '單符只爆一次', status: statusOfPick(r5, /R5 \(c\)\(e\)|R5 \(h\)/),
      evidence: '同上' },
    { id: 'R5-f', item: '目標死亡／離場不殘留', status: statusOfPick(r5, /R5 \(f\)/),
      evidence: '故障注入 fault-stuck-leak 已驗證可抓到' },
    { id: 'R5-g', item: 'Boss 護盾與震退抗性', status: statusOfPick(r5, /R5 \(g\)/),
      evidence: '沿用全技能既有護盾／震退規則' },
    { id: 'R5-h', item: '多符黏貼疊爆', status: statusOfPick(r5, /R5 \(h\)/),
      evidence: '傷害帳以「全傷×n ＋ 濺射×k」整數倍驗收' },
    { id: 'R5-i', item: '暫停／結算清理', status: statusOfPick(r5, /R5 \(i\)/),
      evidence: '暫停用真幀推進；結算驗收「不作用」而非特定政策' },
    { id: 'R5-j', item: '發射／爆破分離音效', status: statusOfPick(r5, /R5 \(j\)/),
      evidence: '故障注入 fault-same-audio 已驗證可抓到' },
    { id: 'R5-k', item: '跨技能回歸（妖刀斬等）', status: statusOfPick(r5, /R5 \(k\)/),
      evidence: '全套回歸同時覆蓋其他技能' },
    { id: 'R1-a', item: '逐詞真檔發聲、與 TTS 互斥', status: statusOfPick(r1, /R1 \(a\)/),
      evidence: 'tests/r1-word-assets.acceptance.cjs' },
    { id: 'R1-b', item: '缺檔明確退 TTS、無 404', status: statusOfPick(r1, /R1 \(b\)/),
      evidence: '同上' },
    { id: 'R1-c', item: '逐詞單字圖齊備', status: statusOfPick(r1, /R1 \(c\)/),
      evidence: '同上；缺口逐詞點名，不接受靜默',
      note: '圖片為進行中產出，此缺口是當下 snapshot，非最終結論；產出完成後需重跑。' },
    { id: 'R1-a2', item: 'R1 完成目標：164 詞全部有正式音檔', status: statusOfPick(r1, /R1 \(a2\)/),
      evidence: '同上' },
    { id: 'R1-d', item: '音圖鍵無張冠李戴', status: statusOfPick(r1, /R1 \(d\)/),
      evidence: '同上' },
    { id: 'R2-a', item: '首次手勢解鎖 AudioContext 並啟動音軌', status: statusOfPick(r2, /R2 \(a\)/),
      evidence: 'tests/r2-audio-unlock.acceptance.cjs' },
    { id: 'R2-b', item: 'autoplay 被拒必須退避，恢復後可播', status: statusOfPick(r2, /R2 \(b\)/),
      evidence: '故障注入 fault-retry-storm / fault-no-unlock-resume' },
    { id: 'R2-c', item: '場景切換音軌選擇正確、不重疊', status: statusOfPick(r2, /R2 \(c\)/),
      evidence: '故障注入 fault-bgm-overlap' },
    { id: 'R2-d', item: '載入失敗穩定降級', status: statusOfPick(r2, /R2 \(d\)/),
      evidence: '同上' },
    { id: 'R2-e', item: '靜音／切背景／回前景狀態一致', status: statusOfPick(r2, /R2 \(e\)/),
      evidence: '故障注入 fault-stuck-after-background' },
    { id: 'R2-f', item: '解鎖點存在性（觸控／手把／旋轉）', status: statusOfPick(r2, /R2 \(f\)/),
      evidence: '故障注入 fault-remove-pointerdown-init / fault-remove-resize-wake' },
    { id: 'R2-g', item: '守門：pointerdown 先解鎖音訊再擋載入中點擊', status: statusOfPick(r2, /R2 \(g\)/),
      evidence: '第二輪實測缺口已由 Cursor 修正，本項由缺口量測升級為守門斷言' },
    { id: 'R2-device', item: '真機 iPadOS／Android autoplay 實測', status: 'NOT_TESTED_ON_DEVICE',
      evidence: '無', note: 'Node 沙箱只能驗程式面對 NotAllowedError 的處理，不能證明瀏覽器政策。' },
    { id: 'R3-a', item: 'dual-rumble 主路徑與參數合法', status: statusOfPick(r3, /R3 \(a\)/),
      evidence: 'tests/r3-gamepad-haptics.acceptance.cjs' },
    { id: 'R3-b', item: 'pulse fallback 與拒絕降級', status: statusOfPick(r3, /R3 \(b\)/),
      evidence: '故障注入 fault-drop-pulse-fallback' },
    { id: 'R3-c', item: '★ 嚴守門：navigator.vibrate 絕不算手把成功', status: statusOfPick(r3, /R3 \(c\)/),
      evidence: '故障注入 fault-vibrate-only-as-gamepad 已證明會被擋下' },
    { id: 'R3-d', item: '震動開關與持久化', status: statusOfPick(r3, /R3 \(d\)/),
      evidence: '故障注入 fault-ignore-toggle' },
    { id: 'R3-e', item: '斷線／重連', status: statusOfPick(r3, /R3 \(e\)/),
      evidence: '故障注入 fault-ignore-disconnect' },
    { id: 'R3-f', item: 'actuator 拋錯／拒絕安靜降級', status: statusOfPick(r3, /R3 \(f\)/),
      evidence: '故障注入 fault-let-throw-escape' },
    { id: 'R3-g', item: '隱藏頁面／blur／pagehide 清理', status: statusOfPick(r3, /R3 \(g\)/),
      evidence: '故障注入 fault-ignore-hidden' },
    { id: 'R3-h', item: '十個事件雙端管線與參數夾制', status: statusOfPick(r3, /R3 \(h\)/),
      evidence: '同上' },
    { id: 'R3-device', item: '真機 Xbox 藍牙手把 dual-rumble 實測', status: 'NOT_TESTED_ON_DEVICE',
      evidence: '無', note: 'mock 測試證明程式會正確呼叫 actuator，不代表實體馬達真的震。' },
    { id: 'R4-A1', item: '第二關詞庫：6 pack／27 詞／不混第一關', status: statusOfPick(r4, /R4 \(A1\)/),
      evidence: 'tests/r4-rain-port.acceptance.cjs；故障注入 fault-wordpack-missing' },
    { id: 'R4-A2', item: '節奏契約：600 秒／6 配送／90 秒後百鬼／時間波次', status: statusOfPick(r4, /R4 \(A2\)/),
      evidence: '故障注入 fault-runseconds / fault-goal-deliveries' },
    { id: 'R4-A3', item: '港町 Port 風格 Boss 與射手配置', status: statusOfPick(r4, /R4 \(A3\)/),
      evidence: '故障注入 fault-boss-theme' },
    { id: 'R4-A4', item: '第二關為雨關，且第一關不得被雨化', status: statusOfPick(r4, /R4 \(A4\)/),
      evidence: '故障注入 fault-weather-leaks-to-stage1' },
    { id: 'R4-A5', item: '地圖節點可進入、位置存在、解鎖鏈在第一關之後', status: statusOfPick(r4, /R4 \(A5\)/),
      evidence: '故障注入 fault-node-locked' },
    { id: 'R4-A6', item: '續關：進度寫入 localStorage 且重載一致', status: statusOfPick(r4, /R4 \(A6\)/),
      evidence: '故障注入 fault-no-persist' },
    { id: 'R4-B1', item: '★ 行為驗收：第二關真的畫港口地表，第一關不被污染', status: statusOfPick(r4, /R4 \(B1\)/),
      evidence: '真 renderer 探針（記錄實際繪製的地表影像）；故障注入 fault-shared-ground' },
    { id: 'R4-B2', item: '港町九個資產有明確對應且檔案存在', status: statusOfPick(r4, /R4 \(B2\)/),
      evidence: 'RAIN_PORT_ASSETS 靜態對應 + 磁碟存在 + 被程式請求；故障注入 fault-no-port-assets' },
    { id: 'R4-B3', item: '第一關資產不得被港町資產取代（跨關保護）', status: statusOfPick(r4, /R4 \(B3\)/),
      evidence: '同上' },
    { id: 'R4-C1', item: '第二關畫得出雨線，第一關不畫雨', status: statusOfPick(r4, /R4 \(C1\)/),
      evidence: '故障注入 fault-rain-on-stage1；真瀏覽器截圖可見雨線' },
    { id: 'R4-C2', item: '★ 雨滴隨機，不得整齊週期重複', status: statusOfPick(r4, /R4 \(C2\)/),
      evidence: '故障注入 fault-perfectly-periodic-rain' },
    { id: 'R4-C3', item: '★ 雨有三個景深層，速度與透明度不同', status: statusOfPick(r4, /R4 \(C3\)/),
      evidence: '以線段長度／透明度分佈量測' },
    { id: 'R4-C4', item: '雨畫出漣漪／水花且非固定週期', status: statusOfPick(r4, /R4 \(C4\)/),
      evidence: '記錄弧線位置分佈與 ripple 資產 drawImage；故障注入 fault-no-ripple' },
    { id: 'R4-C5', item: '雨／漣漪在 2.5D 投影下正確貼地', status: statusOfPick(r4, /R4 \(C5\)/),
      evidence: '與 VIEWPORT 座標系比對；故障注入 fault-weather-settransform' },
    { id: 'R4-C6', item: '雨／漣漪不得畫到 HUD 之上（不重疊）', status: statusOfPick(r4, /R4 \(C6\)/),
      evidence: '故障注入 fault-weather-outside-viewbounds' },
    { id: 'R4-E1', item: 'R4 資產真的存在、格式正確、尺寸非零', status: statusOfPick(r4, /R4 \(E1\)/),
      evidence: '檔頭與位元組檢查' },
    { id: 'R4-E2', item: 'R4 資產已被程式引用（存在≠玩家看得到）', status: statusOfPick(r4, /R4 \(E2\)/),
      evidence: '靜態引用掃描' },
    { id: 'R4-E3', item: '冷啟動不得一口氣載入其他關巨大圖', status: statusOfPick(r4, /R4 \(E3\)/),
      evidence: '冷啟動請求計數' },
    { id: 'R4-F1', item: '手機橫向／直向／平板／桌機 HUD 不溢出', status: statusOfPick(r4, /R4 \(F1\)/),
      evidence: '四種視窗尺寸幾何驗收' },
    { id: 'R4-calibration', item: 'R4 探針校準（故障注入可分辨）', status: calibrationR4Status(results),
      evidence: 'artifacts/validation/r6/r6-r4-calibration.json（13 項故障注入）' },
    { id: 'R4-browser', item: '真實瀏覽器佐證（Chrome headless 進入第二關）', status: results.screenshots ? 'PASS' : 'NOT_RUN',
      evidence: results.screenshots || 'artifacts/validation/r6/screenshots/（未執行 tools/r6-r4-screenshots.cjs）',
      note: '本機 Chrome ≠ iPad／手機真機。' },
    { id: 'R4-device', item: 'iPad／手機真機：雨效、效能、觸控', status: 'NOT_TESTED_ON_DEVICE',
      evidence: '無', note: '無真機；本機 Chrome headless 截圖不能替代。' },
    { id: 'R4-visual', item: '港町美術語意與美感（青石／碼頭是否到位）', status: '未人工驗',
      evidence: 'artifacts/validation/r6/screenshots/r4-rain-port-900x600.png',
      note: '程式面（資產存在、確實被繪製）已驗收；語意與美感需人工審。' },
    { id: 'R6', item: 'R6 守門（校準與矩陣）', status: calibrationStatus(results),
      evidence: 'r6-calibration.json + r6-calibration-r2-r3.json + r6-r4-calibration.json' },
  ];
}
const statusOf = r => (r.fail > 0 ? 'FAIL' : r.pass > 0 ? 'PASS' : 'NO_TESTS');
function statusOfPick(result, pattern) {
  if (!result) return 'NOT_RUN';
  const hit = result.failing.find(t => pattern.test(t));
  if (hit) return 'FAIL';
  // 找到通過的同組測試才算 PASS；整組都沒跑到就是 NOT_RUN。
  const passed = (result.output.match(new RegExp(`^ok \\d+ - .*${pattern.source}`, 'm')) || null);
  return passed ? 'PASS' : 'NOT_RUN';
}
// 已知缺口測試「通過」代表缺口仍在，不算 R 通過。必須在報告顯示為 OPEN。
function calibrationStatus(results) {
  const a = results.calibration, b = results.calibrationR2R3, c = results.calibrationR4;
  if (!a && !b && !c) return 'NOT_RUN';
  const ok = [a, b, c].filter(Boolean).every(x => x.verdict === 'CALIBRATED');
  return ok ? 'CALIBRATED' : 'CALIBRATION_FAILED';
}
function calibrationR4Status(results) {
  const c = results.calibrationR4;
  if (!c) return 'NOT_RUN';
  return c.verdict === 'CALIBRATED' ? 'CALIBRATED' : 'CALIBRATION_FAILED';
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
fs.mkdirSync(ART, { recursive: true });

const results = {};
results.r5 = runNodeTest('R5', { files: ['tests/r5-talisman-blast.acceptance.cjs'] });
results.r1 = runNodeTest('R1', { files: ['tests/r1-word-assets.acceptance.cjs'] });
results.r2 = runNodeTest('R2', { files: ['tests/r2-audio-unlock.acceptance.cjs'] });
results.r3 = runNodeTest('R3', { files: ['tests/r3-gamepad-haptics.acceptance.cjs'] });
results.r4 = runNodeTest('R4', { files: ['tests/r4-rain-port.acceptance.cjs'] });
// node --test 不接受目錄或萬用字串作為測試路徑，必須自己列出檔案，
// 否則會把目錄當成單一測試檔執行，得到 0 pass / 1 fail 的假失敗。
results.baseline = SKIP_BASE ? null : runNodeTest('baseline', {
  files: fs.readdirSync(path.join(ROOT, 'tests'))
    .filter(f => f.endsWith('.test.cjs'))
    .sort()
    .map(f => `tests/${f}`),
});

// 校準是獨立工具的產物；若尚未跑過就明示尚未校準，不得假設通過。
const readCalib = name => {
  const p = path.join(ART, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};
results.calibration = readCalib('r6-calibration.json');
results.calibrationR2R3 = readCalib('r6-calibration-r2-r3.json');
results.calibrationR4 = readCalib('r6-r4-calibration.json');
// 真實瀏覽器佐證是獨立工具的產物（可選，未跑不得假設通過）
const shotsPath = path.join(ART, 'screenshots', 'screenshots.json');
results.screenshots = fs.existsSync(shotsPath)
  ? (() => { const j = JSON.parse(fs.readFileSync(shotsPath, 'utf8')); return j.results && !j.results.some(x => x.error) ? `${j.results.filter(x => x.size).length} 張截圖` : '截圖流程有錯誤'; })()
  : null;

// 原始輸出落檔，供日後逐條比對（不改既有驗收證據目錄的歷史檔案）。
for (const [key, r] of Object.entries(results)) {
  if (r && r.output) fs.writeFileSync(path.join(ART, `r6-${key}-output.txt`), r.output);
}

const report = {
  tool: 'tools/r6-acceptance.cjs',
  at: new Date().toISOString(),
  node: process.version,
  skipBaseline: SKIP_BASE,
  productionSha256: {
    'js/game.js': sha(path.join(ROOT, 'js', 'game.js')),
    'js/audio.js': sha(path.join(ROOT, 'js', 'audio.js')),
    'js/words.js': sha(path.join(ROOT, 'js', 'words.js')),
  },
  results: {
    baseline: results.baseline && { pass: results.baseline.pass, fail: results.baseline.fail, skip: results.baseline.skip, failing: results.baseline.failing },
    r5: { pass: results.r5.pass, fail: results.r5.fail, failing: results.r5.failing },
    r1: { pass: results.r1.pass, fail: results.r1.fail, failing: results.r1.failing },
    r2: { pass: results.r2.pass, fail: results.r2.fail, failing: results.r2.failing },
    r3: { pass: results.r3.pass, fail: results.r3.fail, failing: results.r3.failing },
    r4: { pass: results.r4.pass, fail: results.r4.fail, failing: results.r4.failing },
  },
  deviceTested: {
    R2: false,
    R3: false,
    R4: false,
    note: 'R2／R3／R4 的真機項目本輪全部未測；mock 測試只證明程式面對該 API 的處理正確。本機 Chrome headless ≠ iPad／手機真機。',
  },
  matrix: matrix(results),
  // 詞庫盤點 snapshot：缺圖／缺音檔是進行中的產出，數字會隨其他 Agent 產出而變動。
  r1Inventory: (() => {
    const line = (results.r1.output.match(/^#?\s*(\{"total".*)$/m) || [])[1];
    if (!line) return null;
    try { return JSON.parse(line.replace(/^#\s*/, '')); } catch { return null; }
  })(),
};
fs.writeFileSync(path.join(ART, 'r6-acceptance.json'), JSON.stringify(report, null, 2) + '\n');

const width = [10, 46, 22, 46];
const line = cells => cells.map((c, i) => String(c ?? '').padEnd(width[i])).join(' | ');
const text = [
  `R6 獨立驗收總表（${report.at}）`,
  `baseline ${SKIP_BASE ? 'SKIPPED' : `${results.baseline.pass} pass / ${results.baseline.fail} fail`} | ` +
  `R5 ${results.r5.pass}/${results.r5.pass + results.r5.fail} | R1 ${results.r1.pass}/${results.r1.pass + results.r1.fail} | ` +
  `R2 ${results.r2.pass}/${results.r2.pass + results.r2.fail} | R3 ${results.r3.pass}/${results.r3.pass + results.r3.fail} | ` +
  `R4 ${results.r4.pass}/${results.r4.pass + results.r4.fail} | ` +
  `校準 ${report.matrix.find(m => m.id === 'R6').status}`,
  '',
  line(['項目', '驗收內容', '狀態', '證據／備註']),
  '-'.repeat(width.join('-+-')),
  ...report.matrix.map(m => line([m.id, m.item, m.status, `${m.evidence}${m.note ? '｜' + m.note : ''}`])),
  '',
  'R2-device／R3-device／R4-device 為真機項目，本輪 NOT_TESTED_ON_DEVICE，不得計入通過。',
  'R4-visual 港町美術語意與美感為「未人工驗」：程式面已驗收，審美需人工。',
  'R1-c 單字圖缺口為進行中產出 snapshot，非最終結論；完成後需重跑。',
  '未 Commit／未 Push／未 Deploy。',
  '',
].join('\n');
fs.writeFileSync(path.join(ART, 'r6-acceptance.txt'), text);
console.log(text);

// 僅在 runner 本身異常（找不到測試檔、node 爆掉）時回 2。
const broken = [results.r5, results.r1, results.r2, results.r3, results.r4].some(r => r.pass + r.fail === 0);
process.exit(broken ? 2 : 0);