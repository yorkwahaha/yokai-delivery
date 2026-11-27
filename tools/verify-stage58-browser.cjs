'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const catalog = require('../js/stage58-audio.js');

const origin = process.env.YOKAI_STAGE58_ORIGIN || 'http://127.0.0.1:8008';
const marker = '    window.YOKAI_PERF = api;';
// Use the game updater for a few specific transitions. No long playthrough or persistent save.
const hooks = `
  api.audioFixture = {
    ready: () => state === 'play' && !artPending(),
    hold() {
      api.configure({ hold: true });
      tutorial = bossQ = null; tutorialSkipped = true; titleCardT = fadeT = surgeWarningT = 0;
      surgeT = orderT = spawnT = Infinity;
    },
    spawn(wave) {
      elapsed = BOSS_TIMES[wave];
      update(.05);
      return bossSchedule.liveOfficialBosses(enemies).map(e => e.trialBoss.id);
    },
    cast(phase) {
      const boss = enemies.find(e => e.bossIndex === 0);
      Object.assign(boss, { shield:false, revealT:0, x:P.x+126, y:P.y+25, attackCd:.01 });
      if (phase === 'telegraph') delete boss.hazard;
      else boss.hazard.remaining = .01;
      update(.03);
      return boss.hazard?.phase;
    },
    shot() {
      spawnEnemy(1, 113, 0, false, true);
      const mob = enemies.findLast(e => e.type !== 'boss');
      if (!mob) throw Error('No ordinary enemy from spawnEnemy');
      Object.assign(mob, {type:'shooter', shootCd:.01, x:P.x-110, y:P.y+28});
      const before = enemyBullets.length;
      update(.03);
      return enemyBullets.length > before;
    },
    defeat(wave) {
      const boss = enemies.find(e => e.bossIndex === wave);
      boss.shield = false;
      hurt(boss, boss.hp * 2, false, false, 'blade');
      return bossSchedule.liveOfficialBosses(enemies).length;
    },
    sealFinal() {
      const boss = enemies.find(e => e.final && e.hp > 0);
      boss.x = P.x+56; boss.y = P.y; boss.revealT = 0; boss.shield = true;
      const choices = answerChoices(boss.word);
      bossQ = boss.quiz = { word:boss.word, ans:choices, wrong:[], lock:0 };
      answerBoss(choices.indexOf(boss.word));
      return !boss.shield;
    },
    ending() {
      if (state !== 'victory') throw Error('Victory fixture state');
      victorySeq.t = VICTORY.dawn - .01;
      updateVictorySequence(.03);
    },
    leave() { enterOverworld(); }
  };`;

function meterInit() {
  const signals = new Map(), decoded = new Set(), starts = new Map(), media = new Map();
  window.yokaiAudioMeter = { signals, decoded, starts, media, errors: [] };
  addEventListener('unhandledrejection', event => window.yokaiAudioMeter.errors.push(String(event.reason)));
  localStorage.setItem('yokai-delivery-dev-v1:tutorial-v1', '"skip"');
  const paths = new WeakMap(), buffers = new WeakMap();
  const monitor = (node, path) => {
    const analyser = node.context.createAnalyser();
    analyser.fftSize = 512;
    node.connect(analyser);
    signals.set(path, analyser);
  };
  const asset = url => {
    if (!url) return null;
    const path = new URL(url, location.href).pathname.slice(1);
    return path.startsWith('art/audio/stage58/') ? path : null;
  };
  const arrayBuffer = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function (...args) {
    const data = await arrayBuffer.apply(this, args);
    const path = asset(this.url);
    if (path) paths.set(data, path);
    return data;
  };
  const decode = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = async function (data, ...args) {
    const buffer = await decode.call(this, data, ...args);
    const path = paths.get(data);
    if (path) { buffers.set(buffer, path); decoded.add(path); }
    return buffer;
  };
  const mediaSource = AudioContext.prototype.createMediaElementSource;
  AudioContext.prototype.createMediaElementSource = function (element) {
    const node = mediaSource.call(this, element);
    element.addEventListener('playing', () => {
      const path = asset(element.currentSrc);
      if (!path) return;
      if (!media.has(path)) {
        media.set(path, element);
        monitor(node, path);
      }
      starts.set(path, (starts.get(path) || 0) + 1);
    });
    return node;
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const path = buffers.get(this.buffer);
    if (path) {
      monitor(this, path);
      starts.set(path, (starts.get(path) || 0) + 1);
    }
    return start.apply(this, args);
  };
}

async function readSignal(page, path) {
  return (await page.waitForFunction(file => {
    const analyser = window.yokaiAudioMeter.signals.get(file);
    if (!analyser) return false;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    const peak = data.reduce((n, value) => Math.max(n, Math.abs(value)), 0);
    return peak > .00015 && Number(peak.toFixed(5));
  }, path, { timeout: 8500 })).jsonValue();
}

async function game(browser, stage, listed) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [], badAudio = [], audioRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/art/audio/stage58/')) audioRequests.push(url.pathname.slice(1));
  });
  page.on('response', response => {
    if (/\/art\/audio\/stage58\//.test(response.url()) && response.status() >= 400)
      badAudio.push([response.url(), response.status()]);
  });
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname !== '/js/game.js') return route.continue();
    const response = await route.fetch();
    const script = await response.text();
    assert.ok(script.includes(marker));
    return route.fulfill({ response, body: script.replace(marker, marker + hooks) });
  });
  await page.addInitScript(meterInit);
  const call = (method, ...args) => page.evaluate(([method, args]) => YOKAI_PERF.audioFixture[method](...args), [method, args]);
  const table = catalog.byStage[stage];
  const signal = {};
  const hear = async event => {
    const file = table[event].path;
    assert.ok(listed.includes(file), file);
    signal[event] = await readSignal(page, file);
  };
  try {
    await page.goto(`${origin}/?dev=1&s3play=1&stageLab=1&perf=1&stage=${stage}`, { waitUntil: 'domcontentloaded' });
    const enter = page.getByRole('button', { name:'直接進關' });
    if (!await enter.isVisible()) await page.getByRole('button', { name:'開發選關' }).click();
    assert.equal(audioRequests.length, 0);
    await enter.click();
    await page.waitForFunction(() => window.YOKAI_PERF?.audioFixture.ready());
    await call('hold');
    await hear('battle');
    await hear('ambience');
    const files = Object.values(table).filter(row => row.kind === 'effect' && listed.includes(row.path)).map(row => row.path);
    await page.waitForFunction(paths => paths.every(path => window.yokaiAudioMeter.decoded.has(path)), files);
    const [actor] = await call('spawn', 0);
    await hear('arrival.' + actor);
    await hear('boss');
    const attack = { 'hyakki-kyoto': actor + '-crossing', 'snow-temple':'frost-bell', 'spirit-ferry':'soul-splash', yomi:'cinder-burst' }[stage];
    assert.equal(await call('cast', 'telegraph'), 'telegraph');
    await hear(attack + '.warning');
    assert.equal(await call('cast', 'active'), 'active');
    await hear(attack + '.impact');
    assert.equal(await call('shot'), true);
    await hear('shot');
    assert.equal((await call('spawn', 1)).length, 2);
    assert.equal(await call('defeat', 0), 1);
    assert.equal(await page.evaluate(path => yokaiAudioMeter.starts.get(path), table.boss.path), 1);
    if (stage === 'yomi') {
      assert.equal((await call('spawn', 2)).length, 2);
      assert.equal((await call('spawn', 3)).length, 3);
      assert.equal(await call('sealFinal'), true);
      await hear('final');
      assert.equal(await call('defeat', 1), 2);
      assert.equal(await call('defeat', 2), 1);
      assert.equal(await call('defeat', 3), 0);
      await hear('core-collapse');
      await call('ending');
      await hear('ending');
    }
    await call('leave');
    await page.waitForFunction(() => [...yokaiAudioMeter.media.values()].every(audio => audio.paused && !audio.getAttribute('src')));
    assert.ok(audioRequests.every(file => Object.values(table).some(row => row.path === file)));
    assert.deepEqual(errors.concat(await page.evaluate(() => yokaiAudioMeter.errors)), []);
    assert.deepEqual(badAudio, []);
    return { stage, signal, activeStageAudioRequests: new Set(audioRequests).size, errors, badAudio, cleanup: true };
  } finally {
    await ctx.close();
  }
}

async function review(browser, listed) {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [], audio = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('request', request => { if (/\/art\/audio\/stage58\//.test(request.url())) audio.push(request.url()); });
  try {
    await page.goto(origin + '/stage-audio-review/');
    await page.locator('#stage').waitFor();
    assert.equal(audio.length, 0);
    assert.equal(await page.locator('#stage option').count(), 4);
    for (const stage of Object.keys(catalog.stages)) {
      await page.locator('#stage').selectOption(stage);
      const rows = Object.values(catalog.byStage[stage]);
      assert.equal(await page.locator('article').count(), rows.length);
      const row = rows.find(row => listed.includes(row.path));
      await page.getByRole('button', { name: '播放 ' + row.name, exact: true }).click();
      await page.waitForFunction(() => {
        const audio = document.querySelector('audio');
        return !audio.paused && audio.currentTime > .03 && audio.readyState >= 2;
      });
      await page.locator('#volume').fill('30');
      assert.equal(await page.locator('audio').evaluate(node => node.volume), .3);
      await page.locator('#loop').uncheck();
      assert.equal(await page.locator('audio').evaluate(node => node.loop), false);
      await page.getByRole('button', { name:'停止', exact:true }).click();
      assert.equal(await page.locator('audio').getAttribute('src'), null);
    }
    await page.locator('#missing').check();
    assert.equal(await page.locator('article').count(), Object.values(catalog.byStage.yomi).filter(row => !listed.includes(row.path)).length);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
    const csv = await fs.readFile(await download.path(), 'utf8');
    assert.ok(csv.includes('Target duration: 120 seconds.'));
    assert.deepEqual(errors, []);
    return { stages: 4, paths: listed.length, audioRequests: audio.length, noAutoload: true, csv: download.suggestedFilename() };
  } finally {
    await page.close();
  }
}

(async () => {
  const listed = await fetch(origin + '/stage-audio-review/files.json').then(response => response.json()).then(json => json.files);
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const report = { review: await review(browser, listed), game: [] };
    for (const stage of Object.keys(catalog.stages)) {
      console.log('Measuring ' + stage);
      report.game.push(await game(browser, stage, listed));
    }
    await fs.mkdir('scratch/stage58-audio', { recursive:true });
    await fs.writeFile('scratch/stage58-audio/browser.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
