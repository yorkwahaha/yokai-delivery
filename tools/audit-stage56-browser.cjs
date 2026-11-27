'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const output = path.resolve(__dirname, '../scratch/stage56-dev-20261126');
const pc = process.env.YOKAI_STAGE56_PC || 'http://127.0.0.1:8006';
const lan = process.env.YOKAI_STAGE56_LAN || 'http://192.168.50.107:8006';
const marker = '    window.YOKAI_PERF = api;';
const candidatePath = /\/art\/stage[56]-/;

// Only the intercepted JS in the isolated Playwright page receives the probes.
const hooks = `
    api.stage56Ready = () => !artPending();
    api.stage56Frame = () => ({
      stage: STAGE.id, state, elapsed, x: P.x, y: P.y,
      chunks: activeChunks.length, chunkCache: WORLD_STATE.getCacheSize(), bounds: runBounds,
      tilt: tiltK(), mobs: enemies.filter(e => e.hp > 0 && e.type !== 'boss').length,
      bosses: enemies.filter(e => e.hp > 0 && e.type === 'boss').map(e => ({
        title: e.title, id: e.trialBoss?.id, hazard: e.hazard?.kind, phase: e.hazard?.phase
      }))
    });
    api.stage56View = tilt => {
      VIEWPORT.setTiltScale(tilt);
      RENDERER.setCam(P.x - W / 2, P.y - H / (2 * tilt));
      RENDERER.invalidateGroundCache?.();
    };
    api.stage56Opening = () => {
      api.configure({hold: true});
      tutorialSkipped = true;
      tutorial = null;
      bossQ = null;
      P.inv = 0;
      titleCardT = fadeT = 0;
      surgeT = orderT = spawnT = Infinity;
    };
    api.stage56Setup = () => {
      spawnT = 0;
      update(.05);
      const mob = enemies.find(e => e.type !== 'boss' && e.hp > 0);
      if (!mob) throw Error('Standard spawn yielded no mob');
      const mobSpawn = {x: mob.x, y: mob.y};
      mob.x = P.x - 116; mob.y = P.y + 43;
      spawnT = Infinity;
      elapsed = BOSS_TIMES[0];
      update(.05);
      const boss = enemies.find(e => e.type === 'boss' && e.hp > 0);
      if (!boss) throw Error('Official first Boss did not spawn');
      const bossSpawn = {x: boss.x, y: boss.y};
      boss.x = P.x + 207; boss.y = P.y + 59;
      boss.shield = false;
      boss.revealT = 0;
      boss.attackCd = 0;
      update(.05);
      RENDERER.clearShake();
      return {mobSpawn, bossSpawn, blockedNearPlayer: blocked(P.x, P.y, 18), ...api.stage56Frame()};
    };
    api.stage56Impact = () => {
      const boss = enemies.find(e => e.type === 'boss' && e.hp > 0);
      if (!boss?.hazard) throw Error('Boss had no live hazard');
      boss.hazard.remaining = .035;
      update(.05);
      return api.stage56Frame();
    };
    api.stage56Damage = () => {
      const boss = enemies.find(e => e.type === 'boss' && e.hp > 0);
      const before = { boss: boss.hp, oil };
      P.inv = 0;
      update(.05);
      hurt(boss, 7, false, false, 'blade');
      return { before, after: { boss: boss.hp, oil } };
    };
    api.stage56Projectile = () => {
      const mob = enemies.find(e => e.type !== 'boss' && e.hp > 0);
      Object.assign(mob, { type: 'shooter', shootCd: .02 });
      update(.05);
      return enemyBullets.length;
    };
    api.stage56Leave = () => {
      const art = STAGE.id === "hyakki-kyoto" ? KYOTO_SCENE_ART : SNOW_TEMPLE_ART;
      const hadTerrain = !!art.terrain(0);
      enterOverworld();
      return { hadTerrain, released: !art.terrain(0) };
    };
    api.stage56Traverse = (x,y) => {
      enemies.length = 0;
      P.x = x; P.y = y;
      syncWorld(true);
      api.stage56View(tiltK());
      return api.stage56Frame();
    };
`;

async function twoFrames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function inspect(browser, origin, stage, view) {
  const touch = view === 'lan-touch';
  const context = await browser.newContext({
    viewport: touch ? { width: 1180, height: 820 } : { width: 1280, height: 800 },
    hasTouch: touch, deviceScaleFactor: touch ? 2 : 1, serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const faults = [];
  const missing = [];
  const media = new Set();
  page.on('pageerror', error => faults.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('遊戲迴圈發生錯誤')) faults.push(message.text());
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== origin) return;
    if (response.status() >= 400) missing.push([url.pathname, response.status()]);
    else if (candidatePath.test(url.pathname)) media.add(url.pathname);
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname !== '/js/game.js') return route.continue();
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes(marker));
    return route.fulfill({ response, body: source.replace(marker, marker + hooks)
      .replace('if (PERF_DEBUG && screen === "run") {', 'if (false) {') });
  });
  await page.addInitScript(() => {
    localStorage.setItem('yokai-tutorial-v1', '"skip"');
    localStorage.setItem('yokai-delivery-dev-v1:tutorial-v1', '"skip"');
    const paths = new Set();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (source instanceof HTMLImageElement && /\/art\/stage[56]-/.test(source.src)) paths.add(new URL(source.src).pathname);
      return draw.call(this, source, ...args);
    };
    window.stage56Paints = paths;
  });
  try {
    await page.goto(origin + '/?dev=1&s3play=1&stageLab=1&perf=1&stage=' + stage, { waitUntil: 'domcontentloaded' });
    const enter = page.getByRole('button', { name: '直接進關' });
    if (!await enter.isVisible()) await page.getByRole('button', { name: '開發選關' }).click();
    await enter.click();
    await page.waitForFunction(id => document.documentElement.dataset.devStage === id && window.YOKAI_PERF?.stage56Ready(), stage);
    const short = stage === 'hyakki-kyoto' ? 'stage5-hyakki-kyoto' : 'stage6-snow-temple';
    await page.waitForFunction(name => [...window.stage56Paints].some(p => p.includes(name) && /__ground-\d\.webp$/.test(p)), short);
    const screenshot = async name => {
      await twoFrames(page);
      await page.locator('#game').screenshot({ path: path.join(output, `${stage}-${view}-${name}.jpg`), quality: 87 });
    };
    const tilt = touch ? .60 : 1;
    const result = { view, origin };
    await page.evaluate(value => window.YOKAI_PERF.stage56View(value), tilt);
    await page.evaluate(() => window.YOKAI_PERF.stage56Opening());
    await screenshot('opening');
    result.spawns = await page.evaluate(() => window.YOKAI_PERF.stage56Setup());
    assert.equal(result.spawns.stage, stage);
    assert.equal(result.spawns.state, 'play');
    assert.equal(result.spawns.blockedNearPlayer, false);
    assert.ok(result.spawns.mobs >= 1);
    assert.equal(result.spawns.bosses[0].phase, 'telegraph');
    await screenshot('warning');
    result.impact = await page.evaluate(() => window.YOKAI_PERF.stage56Impact());
    assert.equal(result.impact.bosses[0].phase, 'active');
    await screenshot('impact');
    result.damage = await page.evaluate(() => window.YOKAI_PERF.stage56Damage());
    assert.ok(result.damage.after.boss < result.damage.before.boss);
    assert.ok(result.damage.after.oil < result.damage.before.oil);
    result.projectiles = await page.evaluate(() => window.YOKAI_PERF.stage56Projectile());
    assert.ok(result.projectiles >= 1);
    await screenshot('projectile');
    if (stage === 'snow-temple') {
      result.far = await page.evaluate(() => window.YOKAI_PERF.stage56Traverse(-6750, -4900));
      assert.equal(result.far.bounds, null);
      assert.ok(result.far.chunkCache <= 27);
      await screenshot('stream-west');
    } else if (!touch) {
      result.edge = await page.evaluate(() => window.YOKAI_PERF.stage56Traverse(450, 120));
      assert.equal(result.edge.chunks, 9);
      await screenshot('perimeter');
    }
    result.paint = await page.evaluate(() => [...window.stage56Paints].sort());
    assert.deepEqual(await page.evaluate(() => window.YOKAI_PERF.stage56Leave()),
      { hadTerrain: true, released: true });
    result.network = [...media].sort();
    result.faults = faults;
    result.missing = missing;
    result.officialSave = await page.evaluate(() => localStorage.getItem('yokai-delivery-v1'));
    const actors = new Set(result.paint.filter(name => name.includes('__sprite__')).map(name => name.split('__sprite__')[0]));
    assert.ok(actors.size >= 2, result.paint.join('\n'));
    assert.ok([...actors].some(name => name.endsWith(result.spawns.bosses[0].id)));
    for (const suffix of ['__warning.webp', '__impact.webp', '__projectile.webp', '__arrival.webp'])
      assert.ok(result.paint.some(name => name.endsWith(suffix)), result.paint.join('\n'));
    assert.equal(result.officialSave, null);
    assert.deepEqual(faults, []);
    assert.deepEqual(missing, []);
    return result;
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.YOKAI_BENCH_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const report = { chromium: browser.version(), stages: {} };
  try {
    for (const stage of ['hyakki-kyoto', 'snow-temple']) {
      const store = report.stages[stage] = [];
      store.push(await inspect(browser, pc, stage, 'pc-flat'));
      store.push(await inspect(browser, lan, stage, 'lan-touch'));
      await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
      process.stdout.write(stage + ' PC 2D + LAN touch 2.5D PASS\n');
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
