'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const output = path.resolve('scratch/stage78-dev-20261126');
const pc = process.env.YOKAI_STAGE78_PC || 'http://127.0.0.1:8007';
const lan = process.env.YOKAI_STAGE78_LAN || 'http://192.168.50.107:8007';
const ids = ['night-town','rain-port','sakura-pass','bamboo-maze','hyakki-kyoto','snow-temple','spirit-ferry','yomi'];
const marker = '    window.YOKAI_PERF = api;';
const hooks = `
  api.lateReview = {
    ready: () => state === 'play' && !artPending(),
    input() { pollGamepad(); return { ...move(), state, mode: inputMode }; },
    pausePoint() {
      const view = VIEWPORT.get(), rect = cv.getBoundingClientRect();
      return { x: rect.left + (btnPause.x + btnPause.w / 2 + view.offsetX) * rect.width / view.width,
        y: rect.top + (btnPause.y + btnPause.h / 2 + view.offsetY) * rect.height / view.height };
    },
    legacyWarnings() {
      if (STAGE.id === 'rain-port') {
        if (!HARBOR_WARNING_ART?.rail?.naturalWidth || !HARBOR_WARNING_ART?.ring?.naturalWidth) return false;
        const at = {x:P.x,y:P.y,r:120};
        return RENDERER.drawPortBossHazard(ctx, {...at,kind:'tidalFan',phase:'telegraph',angle:0}) &&
          RENDERER.drawPortBossHazard(ctx, {...at,kind:'rainVortex',phase:'telegraph',vortexes:[at]});
      }
      if (!BAMBOO_ART.image('bambooCut:ink') || !BAMBOO_ART.image('bambooShoots:ink')) return false;
      const init = {phase:'telegraph', duration:1.05, remaining:.6};
      return BAMBOO_ART.paintHazard(ctx,{...init,kind:'bambooCut',zones:[{x:P.x,y:P.y,rx:145,ry:46}]}) &&
        BAMBOO_ART.paintHazard(ctx,{...init,kind:'bambooShoots',zones:[{x:P.x,y:P.y,rx:48,ry:48}]});
    },
    opening(tilt) {
      api.configure({ hold: true });
      tutorial = bossQ = null;
      tutorialSkipped = true;
      titleCardT = fadeT = 0;
      VIEWPORT.setTiltScale(tilt);
      RENDERER.setCam(P.x - W / 2, P.y - H / (2 * tilt));
      RENDERER.invalidateGroundCache?.();
      return { stage: STAGE.id, tilt: tiltK(), chunks: activeChunks.length, cached: WORLD_STATE.getCacheSize(),
        words: CONTENT.getStageWords(STAGE.id).length };
    },
    delivery() {
      orders = []; job = null; makeOrder();
      inter = orders[0];
      interact();
      if (!job) throw Error('No delivery from real order generator');
      const before = { delivered, score };
      const word = job.word;
      const image = DELIVERY_ICON_ART.pathFor(word);
      const audio = DELIVERY_FISH_AUDIO.pathFor(word.jp);
      const choices = job.ans.length;
      resolve(job.ans.indexOf(word));
      return { before, after: { delivered, score }, jp: word.jp, image, audio, choices };
    },
    waves() {
      enemies.length = 0;
      spawnEnemy(1, 116);
      const mob = enemies[0];
      if (!mob) throw Error('No real spawn');
      Object.assign(mob, {x: P.x - 110, y: P.y + 38, type:'shooter', shootCd:.02});
      surgeT = orderT = spawnT = Infinity;
      elapsed = BOSS_TIMES[2];
      update(.05);
      let bosses = bossSchedule.liveOfficialBosses(enemies);
      if (bosses.length !== 3) throw Error('Expected three simultaneous Bosses');
      const battle = bosses.map(e => [e.title, e.trialBoss.id, e.shield]);
      const oldest = bosses[0];
      oldest.shield = false; oldest.revealT = 0;
      hurt(oldest, oldest.hp * 2, false, false, 'blade');
      elapsed = BOSS_TIMES[3];
      update(.05);
      bosses = bossSchedule.liveOfficialBosses(enemies);
      const final = bosses.find(e => e.final);
      if (bosses.length !== 3 || !final) throw Error('Tail wave failed to fill slot');
      return { first: battle, tail: [final.title, final.trialBoss.id, final.shield], live: bosses.length };
    },
    hazard(wave, phase) {
      const boss = enemies.find(e => e.bossIndex === wave);
      if (!boss) throw Error('Missing wave '+wave);
      boss.hp = boss.max;
      boss.dying = false;
      boss.shield = false;
      boss.revealT = 0;
      boss.x = P.x + 150;
      boss.y = P.y + 62;
      boss.appearedAt = elapsed - .22;
      if (phase === 'telegraph') {
        delete boss.hazard;
        BOSS_AI.start(boss, P, {stageId: STAGE.id});
      } else if (phase === 'active') {
        boss.hazard.remaining = .02;
        BOSS_AI.step(boss, P, .03);
      } else {
        boss.hazard.remaining = .01;
        BOSS_AI.step(boss, P, .02);
      }
      RENDERER.clearShake();
      return { phase: boss.hazard.phase, attack: boss.hazard.attack };
    },
    sealAndFinish() {
      const final = enemies.find(e => e.final && e.hp > 0);
      final.shield = true;
      const choices = answerChoices(final.word);
      const correct = choices.indexOf(final.word);
      const wrong = choices.findIndex(word => word !== final.word);
      bossQ = final.quiz = { word:final.word, ans:choices, wrong:[], lock:0 };
      answerBoss(wrong);
      const curse = bossCurseRemaining;
      bossCurseRemaining = bossQ.lock = 0;
      answerBoss(correct);
      const sealed = final.shield;
      // Controlled encounter completion uses the same hurt, schedule and cinematic as normal play.
      for (const boss of bossSchedule.liveOfficialBosses(enemies)) {
        boss.shield = false; boss.revealT = 0;
        hurt(boss, boss.hp * 2, false, false, 'blade');
      }
      const entered = state;
      for (let n = 0; n < 30 && state === 'victory'; n++) updateVictorySequence(.5);
      api.configure({ hold: false });
      return { entered, curse, sealed, result: state };
    },
    leave() {
      const art = stageLabArtFor(STAGE.id);
      enterOverworld();
      return { screen: state, released: !art?.terrain?.(0) };
    }
  };`;

async function inspect(browser, origin, stage, touch, detailed) {
  const context = await browser.newContext({ hasTouch: touch, deviceScaleFactor: touch ? 2 : 1,
    viewport: touch ? {width:1180,height:820} : {width:1280,height:800}, serviceWorkers:'block' });
  const page = await context.newPage();
  const faults = [], requests = new Set(), missing = [];
  page.on('pageerror', error => faults.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('遊戲迴圈發生錯誤')) faults.push(message.text());
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== origin) return;
    if (response.status() >= 400) missing.push([url.pathname, response.status()]);
    else if (/\/art\/stage[5-8]-|\/assets\/(img|audio)\/delivery\//.test(url.pathname)) requests.add(url.pathname);
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname !== '/js/game.js') return route.continue();
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes(marker));
    return route.fulfill({response, body:source.replace(marker, marker+hooks)
      .replace('if (PERF_DEBUG && screen === "run") {', 'if (false) {')});
  });
  await page.addInitScript(() => {
    localStorage.setItem('yokai-delivery-dev-v1:tutorial-v1', '"skip"');
    const original = CanvasRenderingContext2D.prototype.drawImage;
    window.reviewPaints = new Set();
    CanvasRenderingContext2D.prototype.drawImage = function (source, ...args) {
      if (source instanceof HTMLImageElement && /\/art\/stage[5-8]-|__warning-(ink|ring|rail)\.webp/.test(source.src))
        window.reviewPaints.add(new URL(source.src).pathname);
      return original.call(this, source, ...args);
    };
  });
  const call = (method, ...args) => page.evaluate(([method,args]) => YOKAI_PERF.lateReview[method](...args), [method,args]);
  const screenshot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.locator('#game').screenshot({path:path.join(output, `${stage}-${touch?'touch':'pc'}-${name}.jpg`),quality:86});
  };
  try {
    await page.goto(`${origin}/?dev=1&s3play=1&stageLab=1&perf=1&stage=${stage}${touch?'':'&tilt=1'}`, {waitUntil:'domcontentloaded'});
    const enter = page.getByRole('button', {name:'直接進關'});
    if (!await enter.isVisible()) await page.getByRole('button',{name:'開發選關'}).click();
    assert.equal([...requests].some(name => name.includes('/art/stage')), false);
    await (touch ? enter.tap() : enter.click());
    await page.waitForFunction(stage => document.documentElement.dataset.devStage === stage && window.YOKAI_PERF?.lateReview.ready(), stage);
    const opening = await call('opening', touch ? .6 : 1);
    assert.equal(opening.stage, stage);
    const result = { stage, origin, touch, opening };
    if (stage === 'rain-port' || stage === 'bamboo-maze') {
      await page.waitForFunction(() => YOKAI_PERF.lateReview.legacyWarnings());
      const count = await page.evaluate(() => [...window.reviewPaints].filter(name => /__warning-(ink|ring|rail)\.webp/.test(name)).length);
      assert.equal(count,2);
      result.localWarningRasters = count;
    }
    if (detailed) {
      if (touch) {
        const {x,y} = await call('pausePoint');
        await page.touchscreen.tap(x,y);
        assert.equal((await call('input')).state,'pause');
        await page.touchscreen.tap(x,y);
        assert.equal((await call('input')).state,'play');
        result.input = { touchPause:true };
      } else {
        await page.locator('#game').focus();
        await page.keyboard.down('ArrowRight');
        assert.equal((await call('input')).x,1);
        await page.keyboard.up('ArrowRight');
        await page.keyboard.press('Escape');
        assert.equal((await call('input')).state,'pause');
        await page.keyboard.press('Escape');
        assert.equal((await call('input')).state,'play');
        await page.evaluate(() => {
          window.reviewGamepad = true;
          Object.defineProperty(navigator,'getGamepads',{configurable:true,value:() => window.reviewGamepad ? [{
            connected:true, axes:[.9,0], buttons:Array.from({length:16}, () => ({pressed:false,value:0}))
          }] : []});
        });
        const gamepad = await call('input');
        assert.ok(gamepad.x > .7 && gamepad.mode === 'gamepad');
        await page.evaluate(() => { window.reviewGamepad = false; });
        result.input = { keyboard:true, simulatedGamepad:true };
      }
      await screenshot('opening');
      result.delivery = await call('delivery');
      assert.equal(result.delivery.after.delivered, result.delivery.before.delivered + 1);
      assert.ok(result.delivery.after.score > result.delivery.before.score);
      const { image, audio } = result.delivery;
      assert.ok(image && audio);
      await page.evaluate(async ({image,audio}) => {
        const bitmap = new Image(); bitmap.src = image; await bitmap.decode();
        const clip = new Audio(); clip.src = audio;
        await new Promise((resolve,reject) => { clip.oncanplay = resolve; clip.onerror = reject; });
      }, {image,audio});
      result.waves = await call('waves');
      result.attacks = [];
      for (const wave of [1, 2, 3]) for (const phase of ['telegraph','active','recovery']) {
        const snapshot = await call('hazard', wave, phase);
        assert.equal(snapshot.phase, phase);
        result.attacks.push(snapshot);
        if (phase !== 'recovery') await screenshot(`${wave+1}-${phase}`);
      }
      result.paint = await page.evaluate(() => [...window.reviewPaints].sort());
      assert.ok(result.paint.some(p => p.endsWith('__arrival.webp')));
      assert.ok(result.paint.some(p => p.endsWith('__ground-0.webp') || /__ground-\d\.webp$/.test(p)));
      for (const attack of new Set(result.attacks.map(record => record.attack)))
        for (const frame of ['warning','impact']) assert.ok(result.paint.some(p => p.endsWith(`${attack}__${frame}.webp`)), attack);
      result.end = await call('sealAndFinish');
      assert.deepEqual(result.end, {entered:'victory',curse:10,sealed:false,result:'won'});
      await page.waitForFunction(stage => window.STORE.isStageCompleted(stage), stage);
      await screenshot('result');
    }
    assert.deepEqual(await call('leave'), {screen:'overworld',released:true});
    assert.equal(await page.evaluate(() => localStorage.getItem('yokai-delivery-v1')), null);
    result.requests = [...requests]; result.missing = missing; result.faults = faults;
    assert.deepEqual(faults, []);
    assert.deepEqual(missing, []);
    return result;
  } finally { await context.close(); }
}

async function main() {
  await fs.mkdir(output, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.YOKAI_BENCH_CHROME ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
  const report = { engine:browser.version(), inspected:[] };
  try {
    for (const stage of ids) {
      const detailed = ids.indexOf(stage) >= 6;
      report.inspected.push(await inspect(browser,pc,stage,false,detailed));
      if (detailed) report.inspected.push(await inspect(browser,lan,stage,true,true));
      await fs.writeFile(path.join(output,'browser.json'), JSON.stringify(report,null,2));
      console.log(stage, 'PASS');
    }
    const page = await browser.newPage({viewport:{width:1260,height:800}});
    const missing = [];
    page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
    await page.goto(`${pc}/stage-art-review/`);
    for (const [stage,count] of [['百鬼京都',66],['雪燈山寺',51],['幽世渡口',63],['黃泉境',56]]) {
      await page.getByRole('link',{name:stage,exact:true}).click();
      await page.getByRole('heading',{name:stage,exact:true}).waitFor();
      assert.equal(await page.locator('figure img').count(),count);
      assert.equal(await page.locator('figure img[fetchpriority="high"]').count(),1);
      await page.locator('figure img').first().evaluate(image => image.decode());
    }
    assert.deepEqual(missing,[]);
    report.gallery = { previews:236, faults:missing };
    await page.screenshot({path:path.join(output,'gallery.jpg'),quality:86});
    await page.close();
    const wolves = await browser.newPage({viewport:{width:1280,height:800}});
    const frames = new Set();
    await wolves.addInitScript(() => performance.setResourceTimingBufferSize(1200));
    wolves.on('response', response => {
      if (response.ok() && /shikigami__/.test(response.url())) frames.add(new URL(response.url()).pathname);
    });
    await wolves.goto(`${pc}/?dev=1&s3play=1&stageLab=1&stage=bamboo-maze&skillLab=5`);
    const enter = wolves.getByRole('button',{name:'直接進關'});
    if (!await enter.isVisible()) await wolves.getByRole('button',{name:'開發選關'}).click();
    await enter.click();
    await wolves.waitForFunction(() => performance.getEntriesByType('resource').some(row => row.name.includes('black-idle__f01')));
    for (const stem of ['black-idle','black-run','black-bite','white-bite','__summon.webp','__departure.webp'])
      assert.ok([...frames].some(url => url.includes(stem)), stem);
    await wolves.locator('#game').screenshot({path:path.join(output,'wolves.jpg'),quality:86});
    await wolves.close();
    report.wolfFrames = [...frames];
    await fs.writeFile(path.join(output,'browser.json'), JSON.stringify(report,null,2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
