'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'docs/first-four-stages-audit-20261125');
const port = process.env.YOKAI_AUDIT_PORT || '18788';
const origin = 'http://127.0.0.1:' + port;
const stages = ['night-town', 'rain-port', 'sakura-pass', 'bamboo-maze'];
const marker = '    window.YOKAI_PERF = api;';

// Inject controlled scenes only into the audit browser's copy of game.js.
// The standalone preview server and working-tree source remain unmodified.
const hooks = `
    api.auditScene = index => {
      titleCardT=0;
      elapsed=540;
      spawnT=surgeT=Infinity;
      enemies.length=0;
      let bosses=[];
      for(const wave of [0,3]) {
        enemies.length=0; bossStage=wave; bossT=0;
        let boss;
        for(let attempt=0;attempt<120&&!boss;attempt++){
          update(1/60);
          boss=enemies.find(e=>e.type==='boss');
        }
        if(!boss) throw Error('Scheduled Boss could not spawn '+STAGE.id+' '+wave);
        const offsets=[[190,0],[-185,-45],[145,115],[185,-105]];
        const [dx,dy]=offsets.find(([x,y])=>!blocked(P.x+x,P.y+y,52))||[0,165];
        Object.assign(boss,{x:P.x+(wave===3?dx:-dx),y:P.y+(wave===3?dy:dy+65),shield:false,attackCd:0,hp:boss.max*.48});
        bosses.push(boss);
      }
      enemies=bosses;
      for(let i=0;i<30;i++) spawnEnemy(4,165+i*4,i*2.39996323,false,true);
      P.inv=8;
      WL.katana=WL.barrier=5;
      if(index===0){ WL.fire=WL.thunder=5; }
      if(index===1){ WL.ink_trail=WL.thunder=5; }
      if(index===2){ WL.seal_nail=WL.ink_trail=5; }
      if(index===3){ WL.ink_trail=WL.shikigami=5; }
      for(const id of Object.keys(WL)) if(WL[id]>0) window.useSkillArt?.(id,WL[id]);
    };
    api.auditReady=()=>!artPending();
    api.auditAdvance=()=>{
      for(const id of Object.keys(WL)) if(WL[id]>0) wT[id]=0;
      const before=elapsed;
      keys.add('r');
      for(let i=0;i<8;i++) update(.05);
      keys.clear();
      for(let i=0;i<4;i++) update(.05);
      gems.length=0;
      for(let i=0;i<512;i++){
        const a=i*2.39996323,r=13.5*Math.sqrt(i);
        dropGem(P.x+Math.cos(a)*r,P.y+Math.sin(a)*r*.6,i%11===0?3:1);
      }
      return {boss:enemies.filter(e=>e.type==='boss').map(e=>[e.title,e.hazard?.kind,e.hazard?.phase]),
        violet:inkTrail.snapshot(WL.ink_trail),nail:sealNail.snapshot(WL.seal_nail),
        companion:shikigami?.snapshot(), advance:elapsed-before, state, xp, artPending:artPending(),
        mapFallback:!!window.ART?.map_bamboo_maze_v1 && window.ART.map_bamboo_maze_v1===window.ART.map_night_town_v1 };
    };
    api.auditOffer=()=>{ if(state==='play'){ xp=xpNeed(); offerUp(); } };
    api.auditToggleView=()=>toggleViewMode();
    api.auditForceLoss=()=>{
      const ground=document.querySelector('#game');
      ground.dispatchEvent(new Event('contextlost'));
      ground.dispatchEvent(new Event('contextrestored'));
    };
`;

async function main() {
  await mkdir(evidence, { recursive: true });
  const server = spawn(process.execPath, ['tools/serve-tilt.cjs'], {
    cwd: root, env: { ...process.env, YOKAI_PREVIEW_PORT: port, YOKAI_PREVIEW_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true,
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('exit', code => reject(Error('Preview exited ' + code)));
      server.stdout.once('data', resolve);
    });
    browser = await chromium.launch({
      executablePath: process.env.YOKAI_BENCH_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });
    const results = [];
    for (const [index, stage] of stages.entries()) {
      const context = await browser.newContext({
        viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block',
      });
      const page = await context.newPage();
      const faults = [];
      const responses = new Set();
      page.on('pageerror', error => faults.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('遊戲迴圈發生錯誤')) faults.push(message.text());
      });
      page.on('response', response => {
        if (response.status() >= 400) responses.add(new URL(response.url()).pathname + ' ' + response.status());
      });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname !== '/js/game.js') return route.continue();
        const response = await route.fetch();
        const js = await response.text();
        assert.ok(js.includes(marker));
        return route.fulfill({ response, body: js.replace(marker, marker + hooks) });
      });
      await page.addInitScript(() => {
        localStorage.setItem('yokai-tutorial-v1', '"skip"');
        let seed = 20261125;
        Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      });
      await page.goto(origin + '/?perf=1&dev=1&stage=' + stage, { waitUntil: 'domcontentloaded' });
      await page.locator('#dev-stage-picker div button').evaluate(button => button.click());
      await page.waitForFunction(id => window.YOKAI_PERF?.report().state.stage === id &&
        window.YOKAI_PERF.report().state.gameState === 'play' &&
        window.YOKAI_PERF.report().state.canvases.stores.terrain.pixels > 1, stage);
      await page.waitForTimeout(1100);
      await page.evaluate(index => {
        const api = window.YOKAI_PERF;
        api.configure({ hold: true });
        api.auditScene(index);
      }, index);
      await page.waitForFunction(() => window.YOKAI_PERF.auditReady());
      const fixture = await page.evaluate(() => {
        const api = window.YOKAI_PERF;
        const fixture = api.auditAdvance();
        api.configure({ hold: true });
        return fixture;
      });
      assert.ok(fixture.advance > .4, JSON.stringify(fixture));
      await page.waitForTimeout(2300);
      const before = await page.evaluate(() => window.YOKAI_PERF.report());
      await page.locator('#game').screenshot({ path: path.join(evidence, stage + '.jpg'), type: 'jpeg', quality: 87 });
      await page.evaluate(() => window.YOKAI_PERF.auditForceLoss());
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => window.YOKAI_PERF.report().state);
      if (index === 3) {
        await page.evaluate(() => window.YOKAI_PERF.auditToggleView());
        await page.waitForFunction(() => window.VIEWPORT.tiltScale() === 1);
        await page.locator('#game').screenshot({ path: path.join(evidence, 'bamboo-maze-2d.jpg'), type: 'jpeg', quality: 87 });
        await page.evaluate(() => window.YOKAI_PERF.auditOffer());
        await page.waitForTimeout(450);
        await page.locator('#game').screenshot({ path: path.join(evidence, 'bamboo-maze-upgrade.jpg'), type: 'jpeg', quality: 88 });
      }
      results.push({ stage, fixture, frame: before.frame, state: before.state, after, faults, responses: [...responses] });
      await writeFile(path.join(evidence, 'browser.json'), JSON.stringify({ browser: browser.version(), results }, null, 2));
      await context.close();
      console.log(stage, JSON.stringify({ bosses: fixture.boss, fps: before.frame.fps, faults, misses: responses.size }));
    }
    assert.ok(results.every(result => !result.faults.length));
  } finally {
    await browser?.close();
    server.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
