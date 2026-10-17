'use strict';

// E15-05：用真 R16 harness 做正負控制。本檔同時可當 child preload。
// 不改 production、不改 R16 harness、不覆蓋 E15-01 證據。印記都是 harness 內的人工 fixture。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const HARNESS = path.join(ROOT, 'tests/spacebunny-c4-rewards-independent.acceptance.cjs');
const CAL_ROOT = path.join(ROOT, 'artifacts/validation/e15-r16-calibration-20261015');
const E15_01_OUT = path.join(ROOT, 'artifacts/validation/e15-grok-r16-20261015');
const DELIVERED_DIRS = ['known-good', 'strip-new-awards', 'drop-second-pack'].map(name => path.join(CAL_ROOT, name));
const BRIDGE_SUFFIX = '/js/card-delivery-bridge.js';
const VALID_STATUS = new Set(['PASS', 'RED', 'FAIL', 'BLOCKED', 'HUMAN_REVIEW']);
const R16_06 = 'R16-06-single-record-multi-pack-backfill';
let runDir = null;
const PROTECTED = [
  'js/card-collection.js',
  'js/card-delivery-bridge.js',
  'js/card-gallery-model.js',
  'js/words.js',
  'tests/spacebunny-c4-rewards-independent.acceptance.cjs',
  'tests/e15-r16-harness-calibration.test.cjs',
  'docs/e15-r16-calibration-20261015.md',
  'artifacts/validation/e15-grok-r16-20261015/evidence.json',
  'artifacts/validation/e15-grok-r16-20261015/qa-log.txt',
  ...['known-good', 'strip-new-awards', 'drop-second-pack'].flatMap(name =>
    ['evidence.json', 'qa-log.txt', 'scenario.json', 'exit-code.txt', 'stderr.txt'].map(file =>
      `artifacts/validation/e15-r16-calibration-20261015/${name}/${file}`)),
];

function shaFile(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}

function snapshotProtected() {
  return Object.fromEntries(PROTECTED.map(rel => [rel, shaFile(rel)]));
}

if (process.env.E15_R16_CAL_PRELOAD === '1') {
  installPreload();
} else {
  const test = require('node:test');
  const protectedBefore = snapshotProtected();
  runDir = fs.mkdtempSync(path.join(CAL_ROOT, 'run-'));

  test('known-good 真 harness：strict=0，全部 status 為 PASS', () => {
    const run = runScenario('known-good', 'known-good');
    assertUntouched(protectedBefore);
    assert.equal(run.exitCode, 0);
    assert.equal(run.evidence.marksAreFixtureNotNaturalPlay, true);
    assert.equal(run.evidence.strict.enabled, true);
    assert.equal(run.evidence.strict.red, 0);
    assert.equal(run.evidence.strict.fail, 0);
    assert.equal(run.evidence.strict.blocked, 0);
    assert.equal(run.evidence.strict.notClean, 0);
    assert.equal(run.evidence.hashesStable, true);
    assert.equal(run.evidence.results.length, 23);
    for (const row of run.evidence.results) assert.equal(row.status, 'PASS');
    const row = resultById(run.evidence, R16_06);
    assert.deepEqual(row.evidence.got, ['animals', 'beach']);
  });

  test('移除 record.newAwards：harness 為 RED，strict=1', () => {
    const run = runScenario('strip-new-awards', 'strip-new-awards');
    assertUntouched(protectedBefore);
    assert.equal(run.exitCode, 1);
    assert.equal(run.evidence.marksAreFixtureNotNaturalPlay, true);
    assert.equal(run.evidence.strict.enabled, true);
    assert.equal(run.evidence.strict.fail, 0);
    assert.equal(run.evidence.strict.blocked, 0);
    assert.ok(run.evidence.strict.red >= 1);
    assert.equal(run.evidence.strict.notClean, run.evidence.strict.red);
    assert.equal(run.evidence.publicApiDiscovery.recordHasNewAwardsField, false);
    assert.equal(resultById(run.evidence, 'R16-00-api-field-probe').status, 'RED');
    assert.equal(resultById(run.evidence, R16_06).status, 'RED');
    assertStatuses(run.evidence);
  });

  test('newAwards 多於一包時漏第二包：R16-06 為 RED，strict=1', () => {
    const run = runScenario('drop-second-pack', 'drop-second-pack');
    assertUntouched(protectedBefore);
    assert.equal(run.exitCode, 1);
    assert.equal(run.evidence.marksAreFixtureNotNaturalPlay, true);
    assert.equal(run.evidence.strict.enabled, true);
    assert.equal(run.evidence.strict.red, 1);
    assert.equal(run.evidence.strict.fail, 0);
    assert.equal(run.evidence.strict.blocked, 0);
    assert.equal(run.evidence.strict.notClean, 1);
    const row = resultById(run.evidence, R16_06);
    assert.ok(row.status === 'RED' || row.status === 'FAIL');
    assert.deepEqual(row.evidence.got, ['animals']);
    const others = run.evidence.results.filter(item => item.id !== R16_06);
    assert.equal(others.length, 22);
    for (const item of others) assert.equal(item.status, 'PASS');
  });

  function assertUntouched(before) {
    assert.deepEqual(snapshotProtected(), before);
  }
}

function resultById(evidence, id) {
  const row = evidence.results.find(item => item.id === id);
  assert.ok(row, `缺少 ${id}`);
  assert.equal(typeof row.status, 'string');
  assert.ok(VALID_STATUS.has(row.status), `${id} status=${row.status}`);
  return row;
}

function assertStatuses(evidence) {
  for (const row of evidence.results) {
    assert.equal(typeof row.status, 'string');
    assert.ok(VALID_STATUS.has(row.status), `${row.id} status=${String(row.status)}`);
  }
}

function runScenario(dirName, mode) {
  assert.ok(runDir, 'run 目錄尚未建立');
  const outDir = path.join(runDir, dirName);
  refuseDelivered(outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const child = spawnSync(process.execPath, [
    '--require', path.join(ROOT, 'tools/director-audio-freeze.cjs'),
    '--require', __filename,
    HARNESS,
    '--strict',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      E15_R16_CAL_PRELOAD: '1',
      E15_R16_CAL_MODE: mode,
      E15_R16_CAL_OUT: outDir,
    },
  });
  fs.writeFileSync(path.join(outDir, 'exit-code.txt'), String(child.status));
  fs.writeFileSync(path.join(outDir, 'stderr.txt'), child.stderr || '');
  const evidencePath = path.join(outDir, 'evidence.json');
  assert.equal(child.error, undefined, child.error && child.error.message);
  assert.ok(fs.existsSync(evidencePath), `harness 未寫出 evidence.json\n${child.stderr || ''}`);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const scenario = {
    mode,
    exitCode: child.status,
    marksAreFixtureNotNaturalPlay: evidence.marksAreFixtureNotNaturalPlay,
    strict: evidence.strict,
    summary: evidence.summary,
    output: path.relative(ROOT, outDir).replace(/\\/g, '/'),
  };
  fs.writeFileSync(path.join(outDir, 'scenario.json'), JSON.stringify(scenario, null, 2));
  assert.equal(fs.existsSync(path.join(E15_01_OUT, 'evidence.json')), true);
  return { exitCode: child.status, evidence, stderr: child.stderr || '' };
}

function installPreload() {
  const mode = process.env.E15_R16_CAL_MODE;
  const dest = path.resolve(process.env.E15_R16_CAL_OUT || '');
  if (!dest || dest === path.parse(dest).root) throw new Error('E15_R16_CAL_OUT 無效');
  refuseDelivered(dest);
  if (mode !== 'known-good' && mode !== 'strip-new-awards' && mode !== 'drop-second-pack') {
    throw new Error(`未知校準模式 ${mode}`);
  }
  redirectHarnessOutput(dest);
  if (mode !== 'known-good') wrapBridgeRequire(mode);
}

function redirectHarnessOutput(dest) {
  const origMkdir = fs.mkdirSync;
  const origWrite = fs.writeFileSync;
  origMkdir.call(fs, dest, { recursive: true });
  const reroute = target => {
    const resolved = path.resolve(String(target));
    if (resolved === E15_01_OUT || resolved.startsWith(E15_01_OUT + path.sep)) {
      return path.join(dest, path.relative(E15_01_OUT, resolved));
    }
    return null;
  };
  fs.mkdirSync = function (target, options) {
    const next = reroute(target);
    refuseDelivered(next || target);
    return origMkdir.call(fs, next || target, options);
  };
  fs.writeFileSync = function (target, data, options) {
    const next = reroute(target);
    refuseDelivered(next || target);
    if (next) origMkdir.call(fs, path.dirname(next), { recursive: true });
    return origWrite.call(fs, next || target, data, options);
  };
}

function refuseDelivered(target) {
  const resolved = path.resolve(String(target));
  for (const dir of DELIVERED_DIRS) {
    if (resolved === dir || resolved.startsWith(dir + path.sep)) {
      throw new Error(`拒絕覆蓋已交目錄 ${dir}`);
    }
  }
}

function wrapBridgeRequire(mode) {
  const original = Module.prototype.require;
  Module.prototype.require = function (id) {
    const exported = original.apply(this, arguments);
    let resolved = id;
    try { resolved = Module._resolveFilename(id, this); } catch (_) { return exported; }
    if (String(resolved).replace(/\\/g, '/').endsWith(BRIDGE_SUFFIX)) return proxyBridge(exported, mode);
    return exported;
  };
}

function proxyBridge(real, mode) {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop !== 'openCards') {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      function openCards(storage, loc, packs) {
        const opened = target.openCards(storage, loc, packs);
        return Object.assign({}, opened, {
          record(event) {
            return mutateRecord(opened.record(event), mode);
          },
        });
      }
      return openCards;
    },
  });
}

function mutateRecord(result, mode) {
  if (!result || typeof result !== 'object') return result;
  if (mode === 'strip-new-awards') {
    const copy = Object.assign({}, result);
    delete copy.newAwards;
    return copy;
  }
  if (mode === 'drop-second-pack' && Array.isArray(result.newAwards) && result.newAwards.length > 1) {
    const copy = Object.assign({}, result);
    copy.newAwards = result.newAwards.filter((_, index) => index !== 1);
    return copy;
  }
  return result;
}
