'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const sharp = require('sharp');
const { loadGame } = require('./helpers/game-runtime.cjs');

const stages = ['spirit-ferry', 'yomi'];
const location = { hostname: '127.0.0.1', search: '?dev=1&stageLab=1' };

for (const stage of stages) {
  test(`${stage} has a reachable delivery layout in both projections and bounded streaming`, () => {
    const { env } = loadGame({ location, stage });
    const data = env.CONTENT.getStage(stage);
    assert.equal(data.mapReleased, true);
    assert.ok(env.STAGE_ROUTE_LAYOUTS[stage]);
    for (const scale of [1, 1.2]) {
      const world = env.WORLD.createStageWorld(data, env.CONTENT, { spacingScaleY: scale });
      const first = world.update(1350, 900 * scale);
      assert.equal(first.bounds, null);
      assert.equal(first.chunks.length, 25);
      assert.ok(first.chunks.every(c => c.routeTerrain >= 0 && c.routeProps.length));
      const isFree = (x, y, radius) => first.solids.every(s => Math.hypot(
        x - Math.max(s.x0, Math.min(s.x1, x)), y - Math.max(s.y0, Math.min(s.y1, y))) >= radius);
      for (const c of first.chunks) {
        const corridor = c.y + 300 * scale;
        for (const x of [0, 100, 450, 800, 900]) assert.ok(isFree(c.x + x, corridor, 52));
        for (const h of c.houses) {
          assert.ok(isFree(h.dx, h.dy, 18));
          assert.ok(env.WORLD.answerPositions(h).every(p => isFree(p.x, p.y, 18)));
        }
        if (stage === 'spirit-ferry') assert.equal(isFree(c.x + 35, c.y + 140 * scale, 18), false);
      }
      if (stage === 'yomi') {
        const cathedral = first.chunks.find(c => c.cx === 1 && c.cy === 1);
        const y = cathedral.y + 101 * scale;
        assert.equal(isFree(cathedral.x + 450, y, 52), true);
        assert.equal(isFree(cathedral.x + 360, y, 18), false);
        assert.equal(isFree(cathedral.x + 540, y, 18), false);
      }
      world.update(-18999, -19400, [world.keyAt(1350, 900 * scale)]);
      assert.ok(world.getCacheSize() <= 26);
    }
  });

  test(`${stage} attaches four DEV wave identities and keeps hit/escape, pause and seal consistent`, () => {
    for (let index = 0; index < 4; index++) {
      const game = loadGame({ location, stage });
      game.start(stage);
      game.stopSpawns();
      game.clearOrders();
      game.forceBossSchedule(index);
      for (let n = 0; n < 16 && !game.snapshot().enemies.some(e => e.type === 'boss'); n++) game.update(.05);
      const spawned = game.snapshot().enemies.find(e => e.type === 'boss');
      assert.equal(spawned.trialBoss?.id, game.env.LATE_STAGE_ART.forStage(stage).bossWave(index).id);
      assert.equal(spawned.gatekeeper, index === 2);
      assert.equal(spawned.final, index === 3);
      const player = { x: 1200, y: 900 };
      const enemy = { ...spawned, x: 1100, y: 900, shield: false, revealT: 0, attackCd: 0 };
      const ai = game.env.BOSS_AI;
      assert.ok(ai.step(enemy, player, .02).started);
      const hazard = enemy.hazard;
      const zone = hazard.lanes[0];
      const safe = zone.inner ? zone : { x: zone.x, y: zone.y + zone.ry + 10 };
      ai.step(enemy, safe, 2, { paused: true });
      assert.equal(hazard.phase, 'telegraph');
      ai.step(enemy, safe, 2);
      assert.equal(hazard.phase, 'active');
      assert.equal(ai.step(enemy, safe, .01).hit, null);
      const target = { x: zone.x + (zone.inner ? (zone.inner + zone.rx) / 2 : 0), y: zone.y };
      assert.equal(ai.step(enemy, target, .01).hit?.kind, 'lateStage');
      assert.equal(ai.step(enemy, target, .01).hit, null);
      enemy.shield = true;
      ai.step(enemy, target, .01);
      assert.equal(enemy.hazard, undefined);
    }
  });
}

test('八關清關從 DEV 存檔解鎖下一關，公開站和 LAN 提供的 DEV 旗標分開驗證', () => {
  const ids = ['night-town','rain-port','sakura-pass','bamboo-maze','hyakki-kyoto','snow-temple',...stages];
  for (const [host, search, devMode] of [
    ['localhost',location.search,true], ['192.168.50.107',location.search+'&s3play=1',true],
    ['localhost','',false], ['public.example',location.search,false]
  ]) {
    const { env } = loadGame({ location: {hostname:host, search} });
    const node = id => env.OVERWORLD.STAGE_NODES.find(entry => entry.stageId === id);
    for (const [i,id] of ids.entries()) {
      assert.equal(env.OVERWORLD.isEnterable(node(id)), true);
      if(ids[i+1])assert.equal(env.OVERWORLD.isEnterable(node(ids[i+1])),false);
      env.STORE.finish(id, 50, 1, true);
      if (ids[i+1]) assert.equal(env.STORE.isStageUnlocked(ids[i+1]), true);
    }
    assert.equal(env.DEV_MODE.isDevMode(env.location), devMode);
    if (devMode) assert.equal(env.localStorage.getItem('yokai-delivery-v1'), null);
  }
});

test('終章沿用七關 140 筆配送素材，公開版可解析三組晚期素材', () => {
  const { env } = loadGame({ location });
  const { CONTENT, DEV_MODE } = env;
  const root = { CONTENT, DEV_MODE, DELIVERY_LEXICON: env.DELIVERY_LEXICON, location };
  vm.runInNewContext(fs.readFileSync('js/delivery-media.js','utf8'), {window:root});
  const registry = root.DELIVERY_MEDIA;
  const review = CONTENT.getStageWords('yomi');
  assert.equal(review.length,140);
  for (const word of review) {
    for (const kind of ['image','audio']) assert.ok(fs.existsSync(registry.pathForWord(kind, word.jp)));
  }
  root.location = {hostname:'public.example',search:location.search};
  for (const id of ['hyakki-kyoto','snow-temple','spirit-ferry']) {
    for (const kind of ['image','audio']) {
      assert.ok(fs.existsSync(registry.pathFor(kind,id,1)));
      assert.equal(registry.isTrial(kind,id),true);
      assert.equal(registry.isApproved(kind,id),false);
    }
  }
});

test('後兩關 DEV 清冊、實際載入、貼圖六款四向共邊與解碼預算一致', async () => {
  const requests = new Set();
  const ctx = { Image: class { set src(path) { requests.add(path); this.naturalWidth = 384; } } };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync('js/late-stage-art.js', 'utf8'), ctx);
  for (const [i, stage] of stages.entries()) {
    const trial = JSON.parse(fs.readFileSync(`assets/img/stages/${stage}/manifest.json`, 'utf8'));
    const items = trial.assets;
    requests.clear();
    const art = ctx.LATE_STAGE_ART.forStage(stage);
    art.load(); art.load();
    assert.equal(requests.size, trial.asset_count);
    assert.deepEqual(requests, new Set(items.map(row => row.path)));
    assert.ok(items.reduce((bytes,row) => bytes + row.width_px*row.height_px*4,0) < 42*1024*1024);
    const edge = [];
    for (const row of items) {
      const bytes = fs.readFileSync(row.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
      if (!/__ground-\d+\.webp$/.test(row.path)) continue;
      const { data, info:{ width,height,channels } } = await sharp(bytes).raw().toBuffer({resolveWithObject:true});
      const run = width*channels;
      const side = start => Buffer.concat(Array.from({length:height}, (_,y) =>
        data.subarray(y*run+start,y*run+start+channels)));
      edge.push([data.subarray(0,run),data.subarray(run*(height-1)),side(0),side(run-channels)]);
    }
    assert.equal(edge.length, 6);
    for (const [top,bottom,left,right] of edge) {
      assert.deepEqual(top, edge[0][1]); assert.deepEqual(bottom, edge[0][0]);
      assert.deepEqual(left, edge[0][3]); assert.deepEqual(right, edge[0][2]);
    }
    art.unload();
    assert.equal(art.terrain(0), null);
  }
});
