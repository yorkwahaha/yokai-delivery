#!/usr/bin/env node
/**
 * tools/r6-calibration.cjs — R6 驗收腳本校準（OpenCode 獨占）
 *
 * 目的：證明 tests/r5-talisman-blast.acceptance.cjs 這組探針「量得到 R5」，
 *       而不是永遠失敗或永遠假綠。三段控制組：
 *   1. 正控制（positive control）：現行 working tree 已是 R5 實作，同一組探針必須 GREEN，
 *      證明探針量得到 R5 行為而不是檔案形狀。若這裡 RED，代表驗收抓到真缺陷。
 *   2. 故障注入（fault injection）：在 R5 實作的 temp 副本上各改一個片段，注入 7 種真錯
 *      （即傷／雙算／濺射 100%／無震退／音效不分離／不跟隨目標／死亡後殘符滯留），
 *      每一種都必須被對應契約抓到。
 *   3. 負控制（negative control）：校準結束時重跑 working tree，確認校準過程沒有
 *      改動 production（比對 SHA-256），並保留首輪結果作為對照。
 *
 * 邊界：
 * - production 唯讀。temp 副本在 %TEMP%／R6_CALIB_TMP 指定處產生，不進 repo。
 * - 不 commit／push／deploy。
 * - 證據寫入 artifacts/validation/r6/r6-calibration.json（＋ .txt 摘要）。
 *
 * 退出碼：0 = 校準通過（負控制紅、正控制綠、每種故障都被抓到）；1 = 校準失敗，
 *         代表探針本身不可信，此時不得拿它去判 R5 通過或不通過。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6');
const ACCEPTANCE = path.join(ROOT, 'tests', 'r5-talisman-blast.acceptance.cjs');
const TMP = process.env.R6_CALIB_TMP || path.join(process.env.TEMP || os.tmpdir(), 'yokai-r6-calibration');

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---------------------------------------------------------------------------
// 探針執行：跑 acceptance 檔並解析 TAP 結果
// ---------------------------------------------------------------------------
function runAcceptance(srcRoot, namePattern) {
  const args = ['--test', '--test-reporter=tap', ACCEPTANCE];
  if (namePattern) args.push(`--test-name-pattern=${namePattern}`);
  const res = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(srcRoot ? { R6_SRC_ROOT: srcRoot } : { R6_SRC_ROOT: '' }) },
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const pass = Number((out.match(/^# pass (\d+)$/m) || [])[1] || 0);
  const fail = Number((out.match(/^# fail (\d+)$/m) || [])[1] || 0);
  const failing = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1].trim());
  return { name: namePattern || '(all)', pass, fail, failing, exitCode: res.status, output: out };
}

// ---------------------------------------------------------------------------
// 故障注入：在「現行 R5 實作」的 temp 副本上改一個最小片段，製造已知真錯。
// ---------------------------------------------------------------------------
// 錨點用可辨識的程式片段而非行號，且要求唯一命中。錨點消失或出現多次時直接
// 報錯——這代表 production 的 R5 寫法變了，校準必須更新，不能放寬。
// 不另造一份「模擬 R5」：現行 working tree 已經是 R5 實作，用它當正控制，
// 故障注入才是在同一份真實程式上量探針的分辨力。
// 用正規表達式錨定「契約語意」而非整行字面。寬鬆只限空白、引數與縮排差異；
// 一旦語意消失（找不到或找到多處）就報錯，不會靜默套錯位置。
function replaceOnce(source, pattern, to, label) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const hits = [...source.matchAll(re)];
  if (hits.length === 0) {
    throw new Error(`校準錨點失效（${label}）：找不到 ${pattern}；` +
      'js/game.js 的 R5 寫法已變，請更新 tools/r6-calibration.cjs 的錨點，不得放寬。');
  }
  if (hits.length > 1) throw new Error(`校準錨點失效（${label}）：片段出現 ${hits.length} 次，無法確定替換範圍`);
  const at = hits[0].index;
  return source.slice(0, at) + to + source.slice(at + hits[0][0].length);
}

// 每個變體 = 一串 [RegExp 錨點, 替換字串]；套用後必須通過語法檢查。
const FAULTS = {
  // 延遲被拿掉：命中即爆（等同改版前的飛行路徑即傷）
  'fault-instant-boom': [
    [/q\.fuse\s*=\s*BOOM_FUSE\s*;/, 'q.fuse = 0;'],
  ],
  // 全傷目標同時再吃一次 20% 濺射（雙算）
  'fault-double-count': [
    [/if \(e === primary \|\| e\.hp <= 0 \|\| dist\(e, q\) > radius\) continue;/, 'if (e.hp <= 0 || dist(e, q) > radius) continue;'],
  ],
  // 濺射比例不是 20%
  'fault-splash-100pct': [
    [/const BOOM_SPLASH = [\d.]+;/, 'const BOOM_SPLASH = 1;'],
  ],
  // 有傷害但沒有震退
  'fault-no-knockback': [
    [/knockback\(e, BOOM_KNOCK[^)]*\);/, '/* fault: no knockback */'],
  ],
  // 發射與爆破共用同一音效事件
  'fault-same-audio': [
    [/AUDIO\.ofudaLaunch\(WL\.boom\);/, 'AUDIO.ofudaBurst(WL.boom);'],
  ],
  // 符咒黏著後不再跟著目標（黏貼只停在命中瞬間）
  'fault-no-follow': [
    [/q\.x = q\.target\.x;\s*\n\s*q\.y = q\.target\.y;/, '/* fault: no follow */'],
  ],
  // 目標死亡／離場後殘符永久滯留（不清場、不引爆）——R5 (f) 明列的邊界
  'fault-stuck-leak': [
    [/if \(!boomTargetLive\(q\)\) \{ explodeTalisman\(q\); continue; \}/, 'if (!boomTargetLive(q)) { continue; }'],
  ],
};

function patchedGame(source, edits, label) {
  let out = source;
  for (const [pattern, to] of edits) out = replaceOnce(out, pattern, to, label);
  new (require('node:vm').Script)(out, { filename: `${label}.js` });
  return out;
}

function makeVariant(name, edits) {
  const dir = path.join(TMP, name);
  const jsDir = path.join(dir, 'js');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(jsDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'js', f), path.join(jsDir, f));
  }
  fs.writeFileSync(path.join(jsDir, 'game.js'), patchedGame(fs.readFileSync(path.join(jsDir, 'game.js'), 'utf8'), edits, name));
  return jsDir;
}

// ---------------------------------------------------------------------------
// 控制組
// ---------------------------------------------------------------------------
const productionBefore = {
  'js/game.js': sha(path.join(ROOT, 'js', 'game.js')),
  'js/evolutions.js': sha(path.join(ROOT, 'js', 'evolutions.js')),
};

const controls = [];
const positive = runAcceptance(null);
controls.push({
  role: 'positive-control',
  expectation: '現行 working tree（R5 實作）必須 GREEN：探針量得到 R5 行為，不是量檔案形狀',
  result: positive,
  ok: positive.fail === 0 && positive.pass > 0,
  note: positive.fail > 0
    ? 'RED 代表驗收抓到 R5 真缺陷，詳見 failing 清單。'
    : '全綠只代表本組可觀察契約成立，不代表手感／數值定案。',
});

let faultControls = [];
try {
  // 故障注入：在真實 R5 實作的副本上各改一個片段，每種真錯都必須被對應契約抓到。
  const expectations = {
    'fault-instant-boom': /R5 \(a\)\(b\)|R5 \(b\) 黏貼到爆破/,
    'fault-double-count': /R5 \(c\)\(e\)|R5 \(h\)/,
    'fault-splash-100pct': /R5 \(d\) 周邊小怪承受|R5 \(h\)/,
    'fault-no-knockback': /R5 \(d\) 周邊小怪被震退/,
    'fault-same-audio': /R5 \(j\)/,
    'fault-no-follow': /R5 \(a\) 符咒貼上後會跟著目標移動/,
    'fault-stuck-leak': /R5 \(f\)/,
  };
  faultControls = Object.entries(FAULTS).map(([name, edits]) => {
    const jsDir = makeVariant(name, edits);
    const res = runAcceptance(jsDir);
    const expect = expectations[name];
    const caught = res.failing.filter(t => expect.test(t));
    return {
      role: 'fault-injection',
      name,
      expectation: `注入「${name}」必須被對應契約抓到 ${expect}`,
      result: res,
      ok: caught.length > 0,
      caughtBy: caught,
    };
  });
  controls.push(...faultControls);
} catch (error) {
  controls.push({
    role: 'harness-error',
    expectation: '故障注入必須能在 R5 實作的 temp 副本上套用並通過語法檢查',
    ok: false,
    error: String(error && error.stack || error),
  });
}

const productionAfter = {
  'js/game.js': sha(path.join(ROOT, 'js', 'game.js')),
  'js/evolutions.js': sha(path.join(ROOT, 'js', 'evolutions.js')),
};
const productionUntouched = JSON.stringify(productionBefore) === JSON.stringify(productionAfter);

// 負控制：校準跑完後重跑 working tree，必須與首輪結果一致。
// 兩輪不一致代表校準過程污染了 production 或測試狀態有殘留，結果不可信。
const negative = runAcceptance(null);
controls.push({
  role: 'negative-control',
  expectation: '校準結束後重跑 working tree，結果必須與首輪完全一致（校準未污染現場）',
  result: negative,
  ok: negative.pass === positive.pass && negative.fail === positive.fail,
  note: `首輪 pass=${positive.pass} fail=${positive.fail}；末輪 pass=${negative.pass} fail=${negative.fail}`,
});

const report = {
  tool: 'tools/r6-calibration.cjs',
  at: new Date().toISOString(),
  node: process.version,
  acceptanceFile: path.relative(ROOT, ACCEPTANCE).replace(/\\/g, '/'),
  productionUnchangedDuringCalibration: productionUntouched,
  productionSha256: productionAfter,
  tempRoot: TMP,
  controls,
  summary: {
    total: controls.length,
    ok: controls.filter(c => c.ok).length,
    failed: controls.filter(c => !c.ok).map(c => c.role + (c.name ? `:${c.name}` : '')),
  },
};
report.verdict = report.summary.failed.length === 0 && productionUntouched ? 'CALIBRATED' : 'CALIBRATION_FAILED';

fs.mkdirSync(ART, { recursive: true });
fs.writeFileSync(path.join(ART, 'r6-calibration.json'), JSON.stringify(report, null, 2) + '\n');
const lines = [
  `R6 校準報告（${report.at}）`,
  `verdict: ${report.verdict}`,
  `production 未被改動: ${report.productionUnchangedDuringCalibration}`,
  '',
  ...controls.map(c => [
    `[${c.ok ? 'OK' : 'NG'}] ${c.role}${c.name ? ' ' + c.name : ''} — ${c.expectation}`,
    ...(c.error ? [`      ${c.error.split('\n')[0]}`] : []),
    ...(c.result ? [`      pass=${c.result.pass} fail=${c.result.fail} exit=${c.result.exitCode}`] : []),
    ...(c.note ? [`      註：${c.note}`] : []),
    ...(c.caughtBy && c.caughtBy.length ? c.caughtBy.map(n => `      抓到: ${n}`) : []),
    ...(c.result && c.result.failing.length && !c.caughtBy ? c.result.failing.map(n => `      未通過: ${n}`) : []),
  ].join('\n')),
  '',
];
fs.writeFileSync(path.join(ART, 'r6-calibration.txt'), lines.join('\n'));
console.log(lines.join('\n'));
process.exit(report.verdict === 'CALIBRATED' ? 0 : 1);