'use strict';
// Run only the project Node regression suite; browser acceptance scripts are separate gates.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const excluded = new Set(['audio-events.test.cjs', 'boss-music.test.cjs']);
const files = fs.readdirSync(path.resolve('tests')).filter(n => n.endsWith('.test.cjs')).sort();
const selected = files.filter(n => !excluded.has(n));
const evidenceDir = path.resolve(process.argv[2] || 'artifacts/validation/director-20261014');
fs.mkdirSync(evidenceDir, { recursive: true });
// NODE_OPTIONS treats backslashes as escapes, even on Windows.
const guard = path.resolve('tools/director-audio-freeze.cjs').replace(/\\/g, '/');
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require "${guard}"`.trim() };
const skippedTest = '^published worker content revisions match every local media file$';
const args = ['--test', '--test-skip-pattern=' + skippedTest, ...selected.map(n => path.join('tests', n))];
const result = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const log = `${result.stdout || ''}\n${result.stderr || ''}${result.error ? '\n' + result.error.stack : ''}`;
fs.writeFileSync(path.join(evidenceDir, 'safe-regression.log'), log);
const report = { command: [process.execPath, ...args], guard, selected, excluded: files.filter(n => excluded.has(n)), skippedTest,
  exitCode: result.status, signal: result.signal, note: 'Audio frozen suites excluded; NOT a full suite or release permission.' };
fs.writeFileSync(path.join(evidenceDir, 'safe-regression-scope.json'), JSON.stringify(report, null, 2));
const summary = log.split('\n').filter(line => /^ℹ (tests|pass|fail|skipped|duration_ms)|^✖|^Error:|^TypeError:|^SyntaxError:/.test(line));
process.stdout.write(summary.join('\n') + '\nFull output: ' + path.join(evidenceDir, 'safe-regression.log') + '\n');
process.exitCode = result.status ?? 1;
