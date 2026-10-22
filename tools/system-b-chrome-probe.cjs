'use strict';
// SYS-B real-Chrome contract probe. Serves only config/words/boss-ai; never audio.
require('./director-audio-freeze.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JS_FILES = {
  '/js/config.js': path.join(ROOT, 'js', 'config.js'),
  '/js/words.js': path.join(ROOT, 'js', 'words.js'),
  '/js/boss-ai.js': path.join(ROOT, 'js', 'boss-ai.js')
};

const PAGE = `<!doctype html><meta charset="utf-8"><body>BOOT<script>
window.__errors=[];
window.onerror=function(m,s,l,c,e){window.__errors.push(String(e&&e.stack||m));};
</script>
<script src="/js/config.js"></script>
<script src="/js/words.js"></script>
<script src="/js/boss-ai.js"></script>
<script>
try {
  const profileName = p => Object.entries(GAME_CONFIG.MOB_DIFFICULTY_PROFILES).find(([, value]) => value === p)[0];
  const stage = id => CONTENT.getStage(id);
  const rows = ['night-town', 'rain-port', 'yomi'].map(id => ({
    id, profile: profileName(GAME_CONFIG.resolveMobDifficultyProfile(stage(id)))
  }));
  const nightHard = { ...stage('night-town'), pacing: { ...stage('night-town').pacing, mobDifficulty: 'hard' } };
  const invalid = [NaN, Infinity, -1, 0].map(value => ({
    value: String(value),
    xp: GAME_CONFIG.xpNeed(value),
    interval: GAME_CONFIG.spawnInterval(value),
    count: GAME_CONFIG.spawnCount(value),
    tier: GAME_CONFIG.enemyTier(value, value),
    slots: GAME_CONFIG.orderSlots(60, value)
  }));
  const result = {
    ok: true,
    rows,
    nightHard: profileName(GAME_CONFIG.resolveMobDifficultyProfile(nightHard)),
    frozen: Object.isFrozen(GAME_CONFIG.MOB_DIFFICULTY_PROFILES) && Object.isFrozen(GAME_CONFIG.MOB_DIFFICULTY_PROFILES.normal),
    invalid,
    bossAi: typeof BOSS_AI.step,
    errors: window.__errors
  };
  document.body.textContent = '__SYSB_JSON__' + JSON.stringify(result) + '__END__';
} catch (error) {
  document.body.textContent = '__SYSB_JSON__' + JSON.stringify({ ok: false, error: String(error && error.stack || error), errors: window.__errors }) + '__END__';
}
</script></body>`;

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1').pathname;
      if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(PAGE);
        return;
      }
      const file = JS_FILES[url];
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
        .end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function dumpDom(url, userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--user-data-dir=' + userDataDir, '--virtual-time-budget=3000', '--dump-dom', url
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Chrome probe timeout'));
    }, 30000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error('Chrome exited ' + code + '\n' + stderr));
      else resolve(stdout);
    });
  });
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Chrome unavailable: ' + CHROME);
  const server = await serve();
  const base = fs.existsSync('I:\\WinTemp\\opencode') ? 'I:\\WinTemp\\opencode' : os.tmpdir();
  const userDataDir = fs.mkdtempSync(path.join(base, 'sysb-chrome-'));
  try {
    const port = server.address().port;
    const dom = await dumpDom('http://127.0.0.1:' + port + '/', userDataDir);
    const match = dom.match(/__SYSB_JSON__(.*?)__END__/s);
    if (!match) throw new Error('Chrome probe marker missing:\n' + dom.slice(0, 1000));
    const result = JSON.parse(match[1]);
    if (!result.ok) throw new Error('Chrome page error: ' + result.error);
    if (result.errors.length) throw new Error('Chrome page errors: ' + result.errors.join(' | '));
    if (result.bossAi !== 'function') throw new Error('BOSS_AI.step missing in Chrome');
    if (!result.frozen) throw new Error('profiles are not frozen in Chrome');
    const expected = { 'night-town': 'normal', 'rain-port': 'rainPortNormal', 'yomi': 'hard' };
    for (const row of result.rows) {
      if (row.profile !== expected[row.id]) throw new Error(row.id + ' mapped to ' + row.profile);
    }
    if (result.nightHard !== 'hard') throw new Error('night-town hard override failed');
    for (const row of result.invalid) {
      for (const key of ['xp', 'interval', 'count', 'tier', 'slots']) {
        if (!Number.isFinite(row[key])) throw new Error('non-finite ' + key + ' for ' + row.value);
      }
      if (row.slots < 1 || row.slots > 3) throw new Error('order slots out of range for ' + row.value);
    }
    console.log('CHROME_PROBE_OK ' + JSON.stringify(result));
  } finally {
    await new Promise(resolve => server.close(resolve));
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(error => {
  console.error('CHROME_PROBE_FAIL ' + (error && error.stack || error));
  process.exitCode = 1;
});
