#!/usr/bin/env node
/**
 * tools/r6-approved-art-calibration.cjs
 * 證明 tests/r6-approved-candidates.acceptance.cjs 會在接線被改壞時轉紅。
 * 只改 %TEMP% 副本。結束時核對工作樹 SHA-256。
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'artifacts', 'validation', 'r6');
const TMP = path.join(os.tmpdir(), 'r6-approved-calib');
const SUITE = path.join(ROOT, 'tests', 'r6-approved-candidates.acceptance.cjs');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const PRODUCTION = ['js/renderer.js', 'js/assets.js', 'js/world.js', 'js/game.js'];

function runSuite(srcRoot) {
  const env = { ...process.env };
  if (srcRoot) env.R6_SRC_ROOT = srcRoot; else delete env.R6_SRC_ROOT;
  const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SUITE], {
    cwd: ROOT, encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024,
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return {
    pass: Number((out.match(/^# pass (\d+)$/m) || [])[1] || 0),
    fail: Number((out.match(/^# fail (\d+)$/m) || [])[1] || 0),
    failing: [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1].trim()),
    exit: res.status,
  };
}

function makeVariant(name, edits) {
  const dir = path.join(TMP, name, 'js');
  fs.rmSync(path.join(TMP, name), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    fs.copyFileSync(path.join(ROOT, 'js', f), path.join(dir, f));
  }
  for (const [file, pattern, replacement] of edits) {
    const target = path.join(dir, file);
    const src = fs.readFileSync(target, 'utf8');
    if (!pattern.test(src)) throw new Error(`錨點失效：${name} / ${pattern}`);
    pattern.lastIndex = 0;
    const next = src.replace(pattern, replacement);
    fs.writeFileSync(target, next);
    const check = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(`注入後語法錯誤：${name}\n${check.stderr}`);
  }
  return dir;
}

const FAULTS = [
  {
    name: 'fault-fishmonger-wrong-bytes',
    expect: /W1/,
    edits: [[
      'assets.js',
      /fishmonger: "assets\/img\/rain-port\/port_fishmonger\.webp"/,
      'fishmonger: "art/stage2-rain-port/scene/O_prop_awaken_seal.webp"',
    ]],
  },
  {
    name: 'fault-one-building',
    expect: /W2/,
    edits: [[
      'world.js',
      /"port_fishmonger"/g,
      '"port_warehouse"',
    ]],
  },
];

fs.mkdirSync(ART, { recursive: true });
const shaBefore = Object.fromEntries(PRODUCTION.map(f => [f, sha(path.join(ROOT, f))]));
const lines = [];
const log = s => { lines.push(s); console.log(s); };
log(`R6 核准圖接線校準 — ${new Date().toISOString()}`);

const positive = runSuite(null);
log(`[正控制] pass=${positive.pass} fail=${positive.fail} exit=${positive.exit}`);
positive.failing.forEach(f => log(`   RED：${f}`));

const injections = [];
for (const fault of FAULTS) {
  let dir, result;
  try {
    dir = makeVariant(fault.name, fault.edits);
    result = runSuite(dir);
  } catch (e) {
    injections.push({ name: fault.name, ok: false, why: e.message });
    log(`[NG] ${fault.name} — ${e.message}`);
    continue;
  }
  const caught = result.failing.some(t => fault.expect.test(t));
  const added = caught && !positive.failing.some(t => fault.expect.test(t));
  injections.push({ name: fault.name, ok: caught && added, fail: result.fail, failing: result.failing, added });
  log(`[${caught && added ? 'OK' : 'NG'}] ${fault.name} pass=${result.pass} fail=${result.fail}` +
    (added ? '（新紅燈）' : '（沒有比正控制多抓到預期項）'));
  fs.rmSync(path.join(TMP, fault.name), { recursive: true, force: true });
}

const negative = runSuite(null);
const consistent = negative.pass === positive.pass && negative.fail === positive.fail
  && negative.failing.join('|') === positive.failing.join('|');
log(`[${consistent ? 'OK' : 'NG'}] 負控制 pass=${negative.pass} fail=${negative.fail}`);

const shaAfter = Object.fromEntries(PRODUCTION.map(f => [f, sha(path.join(ROOT, f))]));
const untouched = PRODUCTION.every(f => shaBefore[f] === shaAfter[f]);
log(`[${untouched ? 'OK' : 'NG'}] production SHA-256 ${untouched ? '一致' : '不一致'}`);

const verdict = injections.every(i => i.ok) && consistent && untouched ? 'CALIBRATED' : 'CALIBRATION_FAILED';
const report = {
  tool: 'tools/r6-approved-art-calibration.cjs', at: new Date().toISOString(), verdict,
  positive, injections, negative: { pass: negative.pass, fail: negative.fail, failing: negative.failing, consistent },
  productionUntouched: untouched, productionSha256Before: shaBefore, productionSha256After: shaAfter,
};
fs.writeFileSync(path.join(ART, 'r6-approved-art-calibration.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(ART, 'r6-approved-art-calibration.txt'), lines.join('\n') + '\n');
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`verdict: ${verdict}`);
process.exit(verdict === 'CALIBRATED' ? 0 : 1);
