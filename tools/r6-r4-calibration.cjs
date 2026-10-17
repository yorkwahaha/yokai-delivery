#!/usr/bin/env node
/**
 * tools/r6-r4-calibration.cjs — R4 探針校準（OpenCode 獨占）
 *
 * 目的：證明 tests/r4-rain-port.acceptance.cjs 量得到 R4 條文，而不是永遠紅或永遠綠。
 * 三段控制組（與 tools/r6-calibration.cjs / r6-calibration-r2-r3.cjs 同一套方法）：
 *   1. 正控制：現行 working tree 跑同一組探針。R4 尚未完整實作時應為 RED，
 *      並且每一個 RED 都必須對應到一個已知缺口（下方 EXPECTED_GAPS）。
 *   2. 故障注入：在 temp 副本注入已知真錯，每種都必須被對應契約抓到。
 *   3. 負控制：校準結束後重跑，結果必須與首輪一致（未污染現場）。
 *
 * 邊界：production 唯讀；temp 副本在 %TEMP%／R6_CALIB_TMP；不 commit/push/deploy。
 * 退出碼：0 = CALIBRATED；1 = CALIBRATION_FAILED。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6');
const ACCEPTANCE = path.join(ROOT, 'tests', 'r4-rain-port.acceptance.cjs');
const TMP = process.env.R6_CALIB_TMP || path.join(process.env.TEMP || os.tmpdir(), 'yokai-r6-calibration');

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// 已知缺口（其他 Agent 尚未收尾）。正控制若紅在這幾項上，屬預期。
// 2026-10-13：Cursor 已移除 Markdown 反推路徑、改為九個靜態檔名，並由 renderer
// 依 stageId 畫港口地表 → 目前無已知缺口，正控制必須全綠。
const EXPECTED_GAPS = [
];

function runSuite(srcRoot) {
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ACCEPTANCE], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(srcRoot ? { R6_SRC_ROOT: srcRoot } : { R6_SRC_ROOT: '' }) },
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return {
    pass: Number((out.match(/^# pass (\d+)$/m) || [])[1] || 0),
    fail: Number((out.match(/^# fail (\d+)$/m) || [])[1] || 0),
    failing: [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1].trim()),
    output: out,
  };
}

function replaceOnce(source, pattern, to, label) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const hits = [...source.matchAll(re)];
  if (hits.length === 0) throw new Error(`校準錨點失效（${label}）：找不到 ${pattern}；請更新錨點，不得放寬。`);
  if (hits.length > 1) throw new Error(`校準錨點失效（${label}）：片段出現 ${hits.length} 次`);
  const at = hits[0].index;
  // 這裡是字串拼接而非 String.replace，因此 $1 / ${1} 必須自行展開。
  // 沒有展開會把 "${1}" 原樣寫進檔案，造成語法錯誤（校準會直接報錯，不會放寬）。
  const expanded = to.replace(/\$\{(\d+)\}|\$(\d+)/g, (m, a, b) => (hits[0][Number(a || b)] ?? m));
  return source.slice(0, at) + expanded + source.slice(at + hits[0][0].length);
}

const FAULTS = [
  // 詞庫：把 rain-port 的詞包抽掉一個 → A1 必須抓到
  { name: 'fault-wordpack-missing', file: 'words.js', expect: /R4 \(A1\)/,
    edits: [[/wordPacks: Object\.freeze\(\["rain-weather", "port-directions", "port", "beach", "port-spatial", "port-transit"\]\)/,
      'wordPacks: Object.freeze(["rain-weather", "port-directions", "port", "beach", "port-spatial"])']] },
  // 節奏：把 600 秒改成 540 → A2 必須抓到（錨在 rain-port 區塊內，避免 8 處重複）
  // 注意替換字串要用 ${1} 而非 $1，否則 "$1r" 會被當成群組名而吃掉開頭字元。
  { name: 'fault-runseconds', file: 'words.js', expect: /R4 \(A2\)/,
    edits: [[/("rain-port": Object\.freeze\(\{[\s\S]{0,1400}?)runSeconds: 600,/, '${1}runSeconds: 540,']] },
  // 節奏：把配送目標從 6 改成 4 → A2 必須抓到
  { name: 'fault-goal-deliveries', file: 'words.js', expect: /R4 \(A2\)/,
    edits: [[/("rain-port": Object\.freeze\(\{[\s\S]{0,1400}?)goalDeliveries: 6,/, '${1}goalDeliveries: 4,']] },
  // Boss 主題：把 harbor 改成 town → A3 必須抓到
  { name: 'fault-boss-theme', file: 'words.js', expect: /R4 \(A3\)/,
    edits: [[/bossTheme: "harbor"/, 'bossTheme: "town"']] },
  // 跨關污染：把雨天候寫進第一關 → A4 必須抓到
  { name: 'fault-weather-leaks-to-stage1', file: 'words.js', expect: /R4 \(A4\)/,
    edits: [[/ground: "ground_dirt",\s*petals: 17, fireflies: 30/, 'ground: "ground_dirt", petals: 0, fireflies: 0, weather: "rain"']] },
  // 地圖：把 rain-port 節點鎖住 → A5 必須抓到
  { name: 'fault-node-locked', file: 'overworld.js', expect: /R4 \(A5\)/,
    edits: [[/stageId:"rain-port",label:"雨夜港町",sub:"あめよのみなと",enterable:true/, 'stageId:"rain-port",label:"雨夜港町",sub:"あめよのみなと",enterable:false']] },
  // 續關：讓 STORE 不落地 → A6 必須抓到
  { name: 'fault-no-persist', file: 'store.js', expect: /R4 \(A6\)/,
    edits: [[/localStorage\.setItem\(K, JSON\.stringify\(d\)\); saveFailed = false;/,
      '/* fault: never persist */']] },
  // 地表：把 rain-port 地表指回第一關 → B1 必須抓到（錨在 rain-port 視覺區塊）
  { name: 'fault-shared-ground', file: 'words.js', expect: /R4 \(B1\)/,
    edits: [[/("rain-port": Object\.freeze\(\{[\s\S]{0,2000}?)ground: "ground",/, '${1}ground: "ground_dirt",']] },
  // 跨關污染：讓「雨」分支對所有關卡生效（第一關也被雨化）→ C1 必須抓到
  { name: 'fault-rain-on-stage1', file: 'game.js', expect: /R4 \(C1\)/,
    edits: [
      [/if \(STAGE_VISUAL\.weather !== "rain" && STAGE_VISUAL\.weather !== "snow"\) return;/, 'if (false) return;'],
      [/if \(STAGE_VISUAL\.weather === "rain"\) \{/, 'if (true) {'],
    ] },
  // 雨滴排列規律化：所有雨滴疊在同一 x → C2 必須抓到
  { name: 'fault-perfectly-periodic-rain', file: 'game.js', expect: /R4 \(C2\)/,
    edits: [[/const baseX = \(\(cursor \+ rainUnit\(cursor, 5\)\) \/ total\)[^;]*;/,
      'const baseX = 0.5 * Math.max(8, spanX - travelX - 8);']] },
  // 拿掉漣漪 → C4 必須抓到（前置：漣漪已實作才有意義）
  { name: 'fault-no-ripple', file: 'game.js', expect: /R4 \(C4\)/,
    enabledWhen: 'ripple-implemented',
    edits: [[/const ripple = window\.PORT_ART\?\.ripple;\s*\r?\n\s*for \(let i = 0; i < 7; i\+\+\) \{/,
      'const ripple = window.PORT_ART?.ripple;\n        for (let i = 0; i < 0; i++) {']] },
  // 2.5D：讓天氣自己 setTransform → C5 必須抓到
  { name: 'fault-weather-settransform', file: 'game.js', expect: /R4 \(C5\)/,
    edits: [[/    ctx\.save\(\);\r?\n    if \(STAGE_VISUAL\.weather === "rain"\)/,
      '    ctx.save();\n    ctx.setTransform(1, 0, 0, 1, 0, 0);\n    if (STAGE_VISUAL.weather === "rain")']] },
  // 越界：讓雨畫到 HUD 之外（改用固定 900x600 而非 viewBounds）→ C6 必須抓到
  { name: 'fault-weather-outside-viewbounds', file: 'game.js', expect: /R4 \(C6\)/,
    edits: [[/    const area = viewBounds\(\);\r?\n    const drops =/, '    const area = { left: -400, top: -400, right: 1400, bottom: 1000, width: 1800, height: 1400 };\n    const drops =']] },
  // 資產孤兒：從 RAIN_PORT_ASSETS 靜態對應表拿掉 stone 角色 →
  // B2（角色必須齊九個）與 E2（程式必須引用）都必須抓到
  { name: 'fault-no-port-assets', file: 'assets.js', expect: /R4 \(B2\)|R4 \(E2\)/,
    edits: [[/  stone: "assets\/img\/rain-port\/ground_stone\.webp",\r?\n/, '']] },
];

function makeVariant(name, file, edits) {
  const dir = path.join(TMP, `r4-${name}`);
  const jsDir = path.join(dir, 'js');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(jsDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'js', f), path.join(jsDir, f));
  }
  let src = fs.readFileSync(path.join(jsDir, file), 'utf8');
  for (const [pattern, to] of edits) src = replaceOnce(src, pattern, to, name);
  new (require('node:vm').Script)(src, { filename: `${jsDir}/${file}` });
  fs.writeFileSync(path.join(jsDir, file), src);
  return jsDir;
}

// ---------------------------------------------------------------------------
const productionBefore = {};
for (const f of ['words.js', 'game.js', 'assets.js', 'store.js', 'overworld.js', 'renderer.js', 'viewport.js']) {
  productionBefore[`js/${f}`] = sha(path.join(ROOT, 'js', f));
}

const controls = [];
const first = runSuite(null);
const firstIds = first.failing.map(name => (name.match(/R4 \(([A-F]\d)\)/) || [])[1]).filter(Boolean);
const unexpected = firstIds.filter(id => !EXPECTED_GAPS.some(g => g.id === id));
const knownHits = EXPECTED_GAPS.filter(g => firstIds.includes(g.id));

controls.push({
  role: 'positive-control',
  expectation: 'R4 尚未完整實作時，探針必須 RED，且每一個 RED 都對應到一個已知缺口',
  result: { pass: first.pass, fail: first.fail, failing: first.failing },
  // 已實作的缺口項目允許紅；出現未登錄的紅＝探針抓到未知問題，要人工看
  ok: unexpected.length === 0,
  note: `紅燈 ${first.fail} 項，其中已知缺口 ${knownHits.length} 項（${knownHits.map(g => g.id).join('、')}）；` +
        `未登錄紅燈 ${unexpected.length} 項${unexpected.length ? '：' + unexpected.join('、') : ''}`,
  knownGaps: EXPECTED_GAPS,
});

for (const fault of FAULTS) {
  if (fault.enabledWhen && fault.enabledWhen !== 'always') {
    // ripple-implemented：只有當 R4 真的接上漣漪後，「移除漣漪」這個注入才有意義。
    if (fault.enabledWhen === 'ripple-implemented') {
      const rippleImplemented = /R4 \(C4\)/.test(first.output) && !firstIds.includes('C4');
      if (!rippleImplemented) {
        controls.push({
          role: 'fault-injection', name: fault.name,
          expectation: '跳過：前置條件「漣漪尚未實作」未滿足，注入無意義',
          ok: true, skipped: true,
        });
        continue;
      }
    }
    if (fault.enabledWhen === 'assets-wired') {
      const wired = !firstIds.includes('B2');
      if (!wired) {
        controls.push({
          role: 'fault-injection', name: fault.name,
          expectation: '跳過：前置條件「港町資產尚未接入 assets.js」未滿足，注入無意義',
          ok: true, skipped: true,
        });
        continue;
      }
    }
  }
  try {
    const jsDir = makeVariant(fault.name, fault.file, fault.edits);
    const res = runSuite(jsDir);
    const caught = res.failing.filter(t => fault.expect.test(t));
    controls.push({
      role: 'fault-injection', name: fault.name,
      expectation: `注入「${fault.name}」必須被 ${fault.expect} 抓到`,
      result: { pass: res.pass, fail: res.fail, failing: res.failing },
      ok: caught.length > 0, caughtBy: caught,
    });
  } catch (error) {
    controls.push({
      role: 'harness-error', name: fault.name,
      expectation: '故障注入必須能在 temp 副本套用並通過語法檢查',
      ok: false, error: String(error && error.message || error),
    });
  }
}

const last = runSuite(null);
controls.push({
  role: 'negative-control',
  expectation: '校準結束後重跑 working tree，結果必須與首輪一致（校準未污染現場）',
  result: { pass: last.pass, fail: last.fail },
  ok: last.pass === first.pass && last.fail === first.fail,
  note: `首輪 pass=${first.pass} fail=${first.fail}；末輪 pass=${last.pass} fail=${last.fail}`,
});

const productionAfter = {};
for (const f of ['words.js', 'game.js', 'assets.js', 'store.js', 'overworld.js', 'renderer.js', 'viewport.js']) {
  productionAfter[`js/${f}`] = sha(path.join(ROOT, 'js', f));
}
const productionUntouched = JSON.stringify(productionBefore) === JSON.stringify(productionAfter);

const report = {
  tool: 'tools/r6-r4-calibration.cjs',
  at: new Date().toISOString(),
  node: process.version,
  acceptanceFile: path.relative(ROOT, ACCEPTANCE).replace(/\\/g, '/'),
  productionUnchangedDuringCalibration: productionUntouched,
  productionSha256: productionAfter,
  tempRoot: TMP,
  knownGaps: EXPECTED_GAPS,
  controls,
  summary: {
    total: controls.length,
    ok: controls.filter(c => c.ok).length,
    failed: controls.filter(c => !c.ok).map(c => `${c.role}${c.name ? ':' + c.name : ''}`),
    skippedFaults: controls.filter(c => c.skipped).map(c => c.name),
  },
};
report.verdict = report.summary.failed.length === 0 && productionUntouched ? 'CALIBRATED' : 'CALIBRATION_FAILED';

fs.mkdirSync(ART, { recursive: true });
fs.writeFileSync(path.join(ART, 'r6-r4-calibration.json'), JSON.stringify(report, null, 2) + '\n');
const lines = [
  `R4 探針校準報告（${report.at}）`,
  `verdict: ${report.verdict}`,
  `production 未被改動: ${report.productionUnchangedDuringCalibration}`,
  '',
  '已知 R4 缺口（正控制紅燈若落在這幾項，屬預期）：',
  ...EXPECTED_GAPS.map(g => `  - ${g.id}：${g.why}`),
  '',
  ...controls.map(c => [
    `[${c.ok ? 'OK' : 'NG'}] ${c.role}${c.name ? ' ' + c.name : ''} — ${c.expectation}`,
    ...(c.error ? [`      ${c.error}`] : []),
    ...(c.result ? [`      pass=${c.result.pass} fail=${c.result.fail}`] : []),
    ...(c.note ? [`      註：${c.note}`] : []),
    ...(c.caughtBy && c.caughtBy.length ? c.caughtBy.map(n => `      抓到: ${n}`) : []),
  ].join('\n')),
  '',
];
fs.writeFileSync(path.join(ART, 'r6-r4-calibration.txt'), lines.join('\n'));
console.log(lines.join('\n'));
process.exit(report.verdict === 'CALIBRATED' ? 0 : 1);