#!/usr/bin/env node
/**
 * tools/r6-art-qa-calibration.cjs — 美術唯一性驗收的探針校準（OpenCode 獨占）
 *
 * 目的：證明 tests/art-only-qa.acceptance.cjs 的每一條「會紅」的檢查**真的會紅**。
 * 使用者明確要求「必須增加真正能紅燈的 QA」，不准刪測試湊全綠。
 *
 * 三段式（沿用 R6 既定校準方法）：
 *   1. 正控制：現行工作樹跑一次，記錄 pass/fail（真實紅燈要被看見，不准藏）。
 *   2. 故障注入：把 js/ 的 temp 副本改壞（只改副本，SHA-256 證明 production 未動），
 *      指定檢查必須轉紅。
 *   3. 負控制：校準結束後重跑工作樹，結果必須與正控制完全一致。
 *
 * 退出碼：0 = CALIBRATED；1 = 校準失敗（某項注入沒被抓到，或污染了現場）。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6');
const TMP = path.join(os.tmpdir(), 'r6-art-calib');
const SUITE = path.join(ROOT, 'tests', 'art-only-qa.acceptance.cjs');

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const PRODUCTION = ['js/renderer.js', 'js/game.js', 'js/assets.js', 'js/words.js'];

function runSuite(srcRoot) {
  const env = { ...process.env };
  if (srcRoot) env.R6_SRC_ROOT = srcRoot; else delete env.R6_SRC_ROOT;
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SUITE], {
    cwd: ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return {
    pass: Number((out.match(/^# pass (\d+)$/m) || [])[1] || 0),
    fail: Number((out.match(/^# fail (\d+)$/m) || [])[1] || 0),
    failing: [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1].trim()),
    exit: res.status,
  };
}

/** 只帶一份被改壞的 js 檔，其餘仍讀工作樹（用 R6_SRC_ROOT 指向混合目錄前先複製全部） */
function makeVariant(name, file, edits) {
  const dir = path.join(TMP, `art-${name}`);
  const jsDir = path.join(dir, 'js');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(jsDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    fs.copyFileSync(path.join(ROOT, 'js', f), path.join(jsDir, f));
  }
  const target = path.join(jsDir, file);
  let src = fs.readFileSync(target, 'utf8');
  for (const [pattern, replacement] of edits) {
    if (!pattern.test(src)) throw new Error(`錨點失效：${name} / ${pattern}`);
    src = src.replace(pattern, replacement);
  }
  fs.writeFileSync(target, src);
  // node --check：語法壞掉不算「抓到」，那只是 harness 壞掉
  const check = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  if (check.status !== 0) throw new Error(`注入後語法錯誤（harness-error）：${name}\n${check.stderr}`);
  return jsDir;
}

// 2026-10-13：Cursor 已從 renderer.js 拿掉舊的 createStonePattern／房屋色塊／招牌底板錨點。
// 校準改為把禁用畫法插回暫存副本，證明既有 B／C 偵測器仍會紅。不改工作樹。
const FAULTS = [
  { name: 'fault-stone-pattern', file: 'renderer.js', expect: /B1/,
    edits: [[/$/, '\nfunction createStonePattern(){ pctx.fillRect(0,0,8,8); ctx.createPattern(pc, "repeat"); }\n']] },
  { name: 'fault-ground-fillrect', file: 'renderer.js', expect: /B1/,
    edits: [[/function paintTerrainRegion\(c,region,chunks,groundKey,groundImg,toriiImg,toriiReady,sakuraImg,sakuraReady,stageId\)\{/,
      'function paintTerrainRegion(c,region,chunks,groundKey,groundImg,toriiImg,toriiReady,sakuraImg,sakuraReady,stageId){\n      c.fillRect(left, top, width, height);']] },
  { name: 'fault-wood-strip-fallback', file: 'renderer.js', expect: /B1/,
    edits: [[/function paintPortShore\(c, chunk, region\) \{/,
      'function paintPortShore(c, chunk, region) {\n    c.fillStyle = "#4e3b2e";']] },
  { name: 'fault-house-colorblock', file: 'renderer.js', expect: /B1|C8/,
    edits: [[/\/\/ 缺料不畫幾何房子。/,
      'ctx.fillStyle = "#3e3128";\n      ctx.fillRect(h.x - 48, h.y - 30, 96, 75);']] },
  { name: 'fault-sign-baseplate', file: 'renderer.js', expect: /B1/,
    edits: [[/const signY = h\.y \+ 36;/,
      'const signY = h.y + 36;\n    ctx.roundRect(h.x - signW / 2, signY, signW, signH, 2);']] },
  { name: 'fault-port-prop-fallback', file: 'renderer.js', expect: /B1/,
    edits: [[/function drawPortProp\(p, viewerY = null\) \{/,
      'function drawPortProp(p, viewerY = null) {\n    ctx.fillStyle = p.kind === "warehouse" ? "#d5d0c6" : "#888"; ctx.fillRect(p.x - 46, p.y - 78, 92, 78);']] },
  { name: 'fault-static-chunk-road', file: 'renderer.js', expect: /B1/,
    edits: [[/$/, '\nfunction drawStaticChunk(){ c.lineWidth = 72; c.ellipse(h.x,h.y+140,156,83,0,0,6.28); }\n']] },
  { name: 'fault-detectors-blind', file: 'renderer.js', expect: /B0/,
    edits: [[/$/, '\nfunction createStonePattern(){ return 0; }\nfunction drawStaticChunk(){ return 0; }\n']] },
];

(async () => {
  fs.mkdirSync(ART, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const shaBefore = Object.fromEntries(PRODUCTION.map(f => [f, sha(path.join(ROOT, f))]));
  const lines = [];
  const log = s => { lines.push(s); console.log(s); };

  log(`R6 美術唯一性探針校準 — ${new Date().toISOString()}`);
  log(`套件：tests/art-only-qa.acceptance.cjs`);

  // ── 1. 正控制 ──
  const positive = runSuite(null);
  log(`\n[正控制] pass=${positive.pass} fail=${positive.fail} exit=${positive.exit}`);
  positive.failing.forEach(f => log(`   RED（既有、不得隱藏）：${f}`));

  // ── 2. 故障注入 ──
  const injections = [];
  for (const f of FAULTS) {
    let dir, result;
    try {
      dir = makeVariant(f.name, f.file, f.edits);
      result = runSuite(dir);
    } catch (e) {
      injections.push({ name: f.name, ok: false, why: `harness-error: ${e.message}` });
      log(`\n[NG] ${f.name} — ${e.message}`);
      continue;
    }
    const caught = result.failing.some(t => f.expect.test(t));
    injections.push({ name: f.name, ok: caught, fail: result.fail, failing: result.failing });
    log(`\n[${caught ? 'OK' : 'NG'}] fault ${f.name} — 注入後 pass=${result.pass} fail=${result.fail}` +
      (caught ? `（被 ${f.expect} 抓到）` : `（**沒被抓到**；期望 ${f.expect}）`));
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── 3. 負控制 ──
  const negative = runSuite(null);
  const consistent = negative.pass === positive.pass && negative.fail === positive.fail;
  log(`\n[${consistent ? 'OK' : 'NG'}] 負控制 — 重跑工作樹 pass=${negative.pass} fail=${negative.fail}` +
    `（正控制 ${positive.pass}/${positive.fail}）`);

  // ── 4. production 未被污染 ──
  const shaAfter = Object.fromEntries(PRODUCTION.map(f => [f, sha(path.join(ROOT, f))]));
  const untouched = PRODUCTION.every(f => shaBefore[f] === shaAfter[f]);
  log(`[${untouched ? 'OK' : 'NG'}] production SHA-256 ${untouched ? '一致（未被校準污染）' : '不一致！'}`);

  const allCaught = injections.every(i => i.ok);
  const verdict = allCaught && consistent && untouched ? 'CALIBRATED' : 'CALIBRATION_FAILED';
  const report = {
    tool: 'tools/r6-art-qa-calibration.cjs', at: new Date().toISOString(), verdict,
    positive: { pass: positive.pass, fail: positive.fail, exit: positive.exit, failing: positive.failing },
    injections, negative: { pass: negative.pass, fail: negative.fail, consistent },
    productionSha256Before: shaBefore, productionSha256After: shaAfter, productionUntouched: untouched,
  };
  fs.writeFileSync(path.join(ART, 'r6-art-qa-calibration.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(ART, 'r6-art-qa-calibration.txt'), lines.join('\n') + '\n');
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nverdict: ${verdict}`);
  process.exit(verdict === 'CALIBRATED' ? 0 : 1);
})();