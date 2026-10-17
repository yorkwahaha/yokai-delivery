#!/usr/bin/env node
/**
 * tools/r6-calibration-r2-r3.cjs — R2／R3 探針校準（OpenCode 獨占）
 *
 * tools/r6-calibration.cjs 校的是 R5；本檔校 R2（音訊解鎖）與 R3（手把 actuator）。
 * 同樣三段控制組：
 *   1. 正控制：現行 working tree 跑同一組探針，必須 GREEN。
 *   2. 故障注入：在 temp 副本注入已知真錯，每種都必須被對應契約抓到。
 *   3. 負控制：校準結束後重跑，結果必須與首輪一致（未污染現場）。
 *
 * R3 特別校一條「嚴守門」：把 vibrateMobile 的手把路徑與 actuator 混在一起，
 * 確認 R3 (c) 會抓到——即「拿 navigator.vibrate 當手把震動成功」必須被擋下。
 *
 * 邊界：production 唯讀；temp 副本在 %TEMP%／R6_CALIB_TMP；不 commit/push/deploy。
 * 退出碼：0 = CALIBRATED；1 = CALIBRATION_FAILED（探針不可信，不得拿它判通過）。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6');
const TMP = process.env.R6_CALIB_TMP || path.join(process.env.TEMP || os.tmpdir(), 'yokai-r6-calibration');
const SUITES = {
  R2: 'tests/r2-audio-unlock.acceptance.cjs',
  R3: 'tests/r3-gamepad-haptics.acceptance.cjs',
};

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function runSuite(suite, srcRoot) {
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(ROOT, SUITES[suite])], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(srcRoot ? { R6_SRC_ROOT: srcRoot } : { R6_SRC_ROOT: '' }) },
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return {
    suite,
    pass: Number((out.match(/^# pass (\d+)$/m) || [])[1] || 0),
    fail: Number((out.match(/^# fail (\d+)$/m) || [])[1] || 0),
    failing: [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1].trim()),
    output: out,
  };
}

// R2／R3 的驗收檔直接以 R6_SRC_ROOT 讀取 js/ 副本（兩檔都在檔頭宣告支援）。
const SRC_ROOT_SUPPORTED = fs.readFileSync(path.join(ROOT, SUITES.R2), 'utf8').includes('R6_SRC_ROOT')
  && fs.readFileSync(path.join(ROOT, SUITES.R3), 'utf8').includes('R6_SRC_ROOT');

function replaceOnce(source, pattern, to, label) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const hits = [...source.matchAll(re)];
  if (hits.length === 0) throw new Error(`校準錨點失效（${label}）：找不到 ${pattern}；請更新錨點，不得放寬。`);
  if (hits.length > 1) throw new Error(`校準錨點失效（${label}）：片段出現 ${hits.length} 次`);
  const at = hits[0].index;
  return source.slice(0, at) + to + source.slice(at + hits[0][0].length);
}

// 故障注入定義：[檔名, [RegExp 錨點, 替換字串]]
const FAULTS = [
  // getCtx() 是唯一的 resume() 呼叫點；拿掉它等於 user gesture 永遠解鎖不了 AudioContext。
  { suite: 'R2', name: 'fault-no-unlock-resume', file: 'audio.js', expect: /R2 \(a\)/,
    edits: [[/if \(ctx && \(ctx\.state === "suspended" \|\| ctx\.state === "interrupted"\)\) \{\s*\n\s*ctx\.resume\(\)\.catch\(\(\) => \{\}\);\s*\n\s*\}/,
      '/* fault: never resume */']] },
  // playMusic() 的 bgmAttempts WeakSet 就是退避機制；拿掉它會逐幀重試風暴。
  { suite: 'R2', name: 'fault-retry-storm', file: 'audio.js', expect: /R2 \(b\)/,
    edits: [[/if \(!audio \|\| !audio\.paused \|\| \(!retry && bgmAttempts\.has\(audio\)\)\) return;/,
      'if (!audio || !audio.paused) return;']] },
  // updateBgm 切換 desiredBgm 時必須把其他音軌暫停，否則兩軌重疊。
  // 注意：audio.js 是 CRLF、haptics.js 是 LF，錨點一律用 \s*\r?\n\s* 跨行尾安全。
  { suite: 'R2', name: 'fault-bgm-overlap', file: 'audio.js', expect: /R2 \(c\)/,
    edits: [[/musicTracks\(\)\.forEach\(audio => \{\s*\r?\n\s*if \(audio !== desiredBgm && !audio\.paused\) audio\.pause\(\);\s*\r?\n\s*\}\);/,
      '/* fault: never pause the other track */']] },
  // setSuspended(false) 必須清掉退避紀錄，否則回到前景後音軌卡住不再重試。
  { suite: 'R2', name: 'fault-stuck-after-background', file: 'audio.js', expect: /R2 \(e\)/,
    edits: [[/if \(!suspended\) \{ if \(activeBgm\) bgmAttempts\.delete\(activeBgm\); return; \}/,
      'if (!suspended) { return; }']] },
  { suite: 'R2', name: 'fault-remove-pointerdown-init', file: 'game.js', expect: /R2 \(f\)|R2 \(g\)/,
    edits: [[/if \(frameError\) \{ recoverFrameError\(\); return; \}\s*\r?\n\s*AUDIO\.init\(\);/,
      'if (frameError) { recoverFrameError(); return; }']] },
  { suite: 'R2', name: 'fault-remove-resize-wake', file: 'game.js', expect: /R2 \(f\)/,
    edits: [[/if \(isPortrait\(\) && state === "play"\) suspend\(\);\s*\r?\n\s*else wakeAudio\(\);/,
      'if (isPortrait() && state === "play") suspend();']] },

  { suite: 'R3', name: 'fault-no-dual-rumble', file: 'haptics.js', expect: /R3 \(a\)/,
    edits: [[/pending = actuator\.playEffect\('dual-rumble', \{/,
      "pending = actuator.playEffect('xbox', {"]] },
  { suite: 'R3', name: 'fault-drop-pulse-fallback', file: 'haptics.js', expect: /R3 \(b\)/,
    edits: [[/else pulse\(pulser, ms, weak, strong\);/, 'else { /* fault: no pulse fallback */ }']] },
  { suite: 'R3', name: 'fault-ignore-toggle', file: 'haptics.js', expect: /R3 \(d\)/,
    edits: [[/toggle\(\) \{ setEnabled\(!enabled\); return enabled; \}/,
      'toggle() { return enabled; }']] },
  { suite: 'R3', name: 'fault-ignore-disconnect', file: 'haptics.js', expect: /R3 \(e\)/,
    edits: [[/if \(!found && gp\.connected && actuatorsOf\(gp\)\.length\) found = gp;/,
      'if (!found && actuatorsOf(gp).length) found = gp;']] },
  // 讓 playEffect 拋出的錯誤逃出 playDual（try/catch 改 finally）
  { suite: 'R3', name: 'fault-let-throw-escape', file: 'haptics.js', expect: /R3 \(f\)/,
    edits: [[/\}\s*catch\s*\{\s*\r?\n\s*retry\(\);\s*\r?\n\s*return;\s*\r?\n\s*\}/,
      '} finally { /* fault: error escapes */ }']] },
  // 隱藏頁面時仍發回饋（拿掉 pageHidden 防護）
  { suite: 'R3', name: 'fault-ignore-hidden', file: 'haptics.js', expect: /R3 \(g\)/,
    edits: [[/function rumbleGamepad\(duration, weak, strong\) \{\s*\r?\n\s*if \(!enabled \|\| pageHidden\(\)\) return;/,
      'function rumbleGamepad(duration, weak, strong) {\n    if (!enabled) return;']] },
  // ★ 嚴守門校準：拿掉 actuator 的 playEffect 與 pulse 分支，只留 navigator.vibrate。
  //   R3 (c) 必須紅——證明「拿機身震動當手把成功」會被擋下。
  { suite: 'R3', name: 'fault-vibrate-only-as-gamepad', file: 'haptics.js', expect: /R3 \(c\)/,
    edits: [
      [/if \(typeof actuator\.playEffect === 'function'\) \{/, 'if (false) {'],
      [/if \(!pulser && typeof actuator\.pulse === 'function'\) pulser = actuator;/, '/* fault: no pulser */'],
    ] },
];

function makeVariant(name, file, edits) {
  const dir = path.join(TMP, `r2r3-${name}`);
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
const productionBefore = {
  'js/audio.js': sha(path.join(ROOT, 'js', 'audio.js')),
  'js/game.js': sha(path.join(ROOT, 'js', 'game.js')),
  'js/haptics.js': sha(path.join(ROOT, 'js', 'haptics.js')),
};

const controls = [];
const first = { R2: runSuite('R2', null), R3: runSuite('R3', null) };
for (const suite of ['R2', 'R3']) {
  controls.push({
    role: 'positive-control', suite,
    expectation: `現行 working tree 的 ${suite} 探針必須 GREEN`,
    result: first[suite],
    ok: first[suite].fail === 0 && first[suite].pass > 0,
    note: SRC_ROOT_SUPPORTED ? undefined : '（驗收檔尚未支援 R6_SRC_ROOT，故正控制以 working tree 為準）',
  });
}

if (SRC_ROOT_SUPPORTED) {
  for (const fault of FAULTS) {
    try {
      const jsDir = makeVariant(fault.name, fault.file, fault.edits);
      const res = runSuite(fault.suite, jsDir);
      const caught = res.failing.filter(t => fault.expect.test(t));
      controls.push({
        role: 'fault-injection', suite: fault.suite, name: fault.name,
        expectation: `注入「${fault.name}」必須被 ${fault.expect} 抓到`,
        result: res, ok: caught.length > 0, caughtBy: caught,
      });
    } catch (error) {
      controls.push({
        role: 'harness-error', suite: fault.suite, name: fault.name,
        expectation: '故障注入必須能在 temp 副本套用並通過語法檢查',
        ok: false, error: String(error && error.message || error),
      });
    }
  }
}

const last = { R2: runSuite('R2', null), R3: runSuite('R3', null) };
for (const suite of ['R2', 'R3']) {
  controls.push({
    role: 'negative-control', suite,
    expectation: `校準結束後重跑 ${suite}，結果必須與首輪一致`,
    result: last[suite],
    ok: last[suite].pass === first[suite].pass && last[suite].fail === first[suite].fail,
    note: `首輪 pass=${first[suite].pass} fail=${first[suite].fail}；末輪 pass=${last[suite].pass} fail=${last[suite].fail}`,
  });
}

const productionAfter = {
  'js/audio.js': sha(path.join(ROOT, 'js', 'audio.js')),
  'js/game.js': sha(path.join(ROOT, 'js', 'game.js')),
  'js/haptics.js': sha(path.join(ROOT, 'js', 'haptics.js')),
};
const productionUntouched = JSON.stringify(productionBefore) === JSON.stringify(productionAfter);

const report = {
  tool: 'tools/r6-calibration-r2-r3.cjs',
  at: new Date().toISOString(),
  node: process.version,
  suites: SUITES,
  srcRootSupported: SRC_ROOT_SUPPORTED,
  productionUnchangedDuringCalibration: productionUntouched,
  productionSha256: productionAfter,
  tempRoot: TMP,
  controls,
  summary: {
    total: controls.length,
    ok: controls.filter(c => c.ok).length,
    failed: controls.filter(c => !c.ok).map(c => `${c.suite}:${c.role}${c.name ? ':' + c.name : ''}`),
  },
};
report.verdict = report.summary.failed.length === 0 && productionUntouched ? 'CALIBRATED' : 'CALIBRATION_FAILED';

fs.mkdirSync(ART, { recursive: true });
fs.writeFileSync(path.join(ART, 'r6-calibration-r2-r3.json'), JSON.stringify(report, null, 2) + '\n');
const lines = [
  `R2／R3 校準報告（${report.at}）`,
  `verdict: ${report.verdict}`,
  `production 未被改動: ${report.productionUnchangedDuringCalibration}`,
  '',
  ...controls.map(c => [
    `[${c.ok ? 'OK' : 'NG'}] ${c.suite} ${c.role}${c.name ? ' ' + c.name : ''} — ${c.expectation}`,
    ...(c.error ? [`      ${c.error}`] : []),
    ...(c.result ? [`      pass=${c.result.pass} fail=${c.result.fail}`] : []),
    ...(c.note ? [`      註：${c.note}`] : []),
    ...(c.caughtBy && c.caughtBy.length ? c.caughtBy.map(n => `      抓到: ${n}`) : []),
    ...(c.result && c.result.failing.length && !c.caughtBy ? c.result.failing.map(n => `      未通過: ${n}`) : []),
  ].join('\n')),
  '',
];
fs.writeFileSync(path.join(ART, 'r6-calibration-r2-r3.txt'), lines.join('\n'));
console.log(lines.join('\n'));
process.exit(report.verdict === 'CALIBRATED' ? 0 : 1);