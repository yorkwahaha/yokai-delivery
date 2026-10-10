// Usage: node tools/verify-gemini-deploy.cjs <Pages run ID> [evidence label: gemini/loading]
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args);

(async () => {
  const commit = git('rev-parse', 'HEAD').toString().trim();
  const label = process.argv[3] || 'gemini';
  if (!/^[a-z][a-z0-9-]*$/.test(label)) throw new Error('Invalid evidence label');
  if (!/^\d+$/.test(process.argv[2] || '')) throw new Error('Provide the Pages run ID');
  const run = JSON.parse(execFileSync('gh', ['run', 'view', process.argv[2], '--json', 'headSha,status,conclusion,jobs,url']));
  if (run.headSha !== commit || run.status !== 'completed' || run.conclusion !== 'success' || run.jobs.some(j => j.conclusion !== 'success')) {
    throw new Error(`Pages has not successfully deployed HEAD: ${JSON.stringify(run)}`);
  }
  const html = git('show', `${commit}:index.html`).toString();
  const files = ['index.html', ...[...html.matchAll(/<script src="([^"?]+)\?/g)].map(m => m[1])];
  for (const path of ['service-worker.js', ...['hud_lantern_oil','hud_radar_frame','hud_omamori_hint_listen','hud_skill_fan'].map(key=>`assets/img/ui/${key}.webp`)]) {
    if (fs.existsSync(path)) files.push(path);
  }
  const imageProof = `artifacts/validation/${label}-image-sizes.json`;
  if (fs.existsSync(imageProof)) files.push(...JSON.parse(fs.readFileSync(imageProof,'utf8')).images.map(image=>image.path));
  const base = 'https://yorkwahaha.github.io/yokai-delivery/';
  const checks = await Promise.all([...new Set(files)].map(async path => {
    const response = await fetch(`${base}${path}?verify=${commit}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const remoteHash = hash(Buffer.from(await response.arrayBuffer()));
    const commitHash = hash(git('show', `${commit}:${path}`));
    return { path, status: response.status, commitHash, remoteHash, match: commitHash === remoteHash };
  }));
  const testOutput = fs.readFileSync(`artifacts/validation/${label}-green-tests.txt`, 'utf8');
  const tests = Object.fromEntries(['pass','fail','skipped'].map(name=>[name, Number(testOutput.match(new RegExp(`ℹ ${name} (\\d+)`))?.[1])]));
  if (!Number.isFinite(tests.pass) || tests.fail !== 0 || tests.skipped !== 0) throw new Error('Evidence does not show passing tests');
  const proof = { commit, runId: process.argv[2], run, site: base, tests, checks };
  fs.writeFileSync(`artifacts/validation/${label}-deploy-proof.json`, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ commit, conclusion: run.conclusion, matched: checks.filter(c => c.match).length, total: checks.length }));
  if (checks.some(c => !c.match)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
