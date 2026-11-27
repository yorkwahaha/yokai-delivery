'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

const location = { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=hyakki-kyoto' };
const boot = () => loadGame({ location, stage: 'hyakki-kyoto' });

test('京都固定九個街區，外緣不生成任何配送點，邊界隨投影間距縮放', () => {
  const { env } = boot();
  for (const spacing of [1, 1.2]) {
    const world = env.WORLD.createStageWorld(env.CONTENT.getStage('hyakki-kyoto'), env.CONTENT, { spacingScaleY: spacing });
    const snapshot = world.update(1350, 900 * spacing, ['-1,0', '3,1']);
    assert.equal(snapshot.chunks.length, 9);
    assert.equal(snapshot.houses.length, 18);
    assert.equal(world.getChunk(-1, 0), null);
    assert.equal(world.getChunk(3, 1), null);
    assert.equal(snapshot.bounds.maxY, 1736 * spacing);
    assert.ok(snapshot.chunks[0].routeProps.some(p => p.kind === 'kyoto-perimeter-gate'));
  }
});

test('京都街廓阻擋穿越，左右與上下街跨區連通，配送與答題留在街面', () => {
  const game = boot();
  const { env } = game;
  const layout = env.STAGE_ROUTE_LAYOUTS['hyakki-kyoto'];
  const { left, right, north, south } = layout.street;
  for (const [cx, cy] of [[0, 0], [1, 0], [2, 2]]) {
    const { props } = layout(cx, cy, 7);
    const stone = props.find(p => p[2] === 'kyoto-stone-lantern');
    assert.ok(stone);
    assert.ok(stone[0] + stone[3] / 2 <= left && stone[1] <= north);
    for (const spacing of [1, 1.2]) {
      const world = env.WORLD.createStageWorld(env.CONTENT.getStage('hyakki-kyoto'), env.CONTENT, { spacingScaleY: spacing });
      const chunk = world.getChunk(cx, cy);
      assert.equal(chunk.routeProps.filter(p => p.kind === 'kyoto-stall').length, 2);
      assert.equal(chunk.routeProps.filter(p => p.kind === 'kyoto-block-wall').length, 4);
      const { solids } = world.update(chunk.x + 450, chunk.y + 290 * spacing);
      const blocked = (x, y, r = 18) => solids.some(s => Math.hypot(
        x - Math.max(s.x0, Math.min(s.x1, x)), y - Math.max(s.y0, Math.min(s.y1, y))) < r);
      for (const x of [0, left - 35, right + 35, 900]) {
        assert.ok(blocked(chunk.x + x, chunk.y + 78 * spacing));
        assert.ok(blocked(chunk.x + x, chunk.y + 506 * spacing));
      }
      for (let offset = cx === 0 ? 96 : -60; offset <= (cx === 2 ? 804 : 960); offset += 12)
        assert.equal(blocked(chunk.x + offset, chunk.y + (north + south) * spacing / 2, 52), false);
      for (let offset = cy === 0 ? 96 : -60; offset <= (cy === 2 ? 504 : 660); offset += 12)
        assert.equal(blocked(chunk.x + (left + right) / 2, chunk.y + offset * spacing, 52), false);
      for (const h of chunk.houses) {
        for (const p of [{ x: h.dx, y: h.dy }, ...env.WORLD.answerPositions(h)]) assert.equal(blocked(p.x, p.y), false);
      }
    }
  }
  game.start('hyakki-kyoto');
  const { x, y } = game.snapshot();
  assert.equal(game.spotBlocked(x, y, 18), false);
});

test('京都怪物會沿街轉彎，繞過隔在面前的整個街廓', () => {
  for (const tilt of ['', '&tilt=1']) {
    const game = loadGame({ location: { ...location, search: location.search + tilt }, stage: 'hyakki-kyoto' });
    game.start('hyakki-kyoto');
    game.stopSpawns();
    game.clearOrders();
    const { x, y } = game.snapshot();
    const spacing = y / 900;
    const mob = game.addMob({ type: 'grunt', x: x - 246, y: y - 600 * spacing, speed: 170 });
    const destination = { x: x - 240, y };
    game.placeAt(destination.x, destination.y);
    for (let n = 0; n < 210; n++) game.update(.045);
    assert.ok(Math.hypot(mob.x - destination.x, mob.y - destination.y) < 110, JSON.stringify(mob));
  }
});

test('京都場景與半 Q 敵人在試玩載入，戰鬥姿勢對齊同一腳點', () => {
  const loaded = [], drawn = [];
  class Image {
    set src(path) {
      this.path = path;
      this.naturalWidth = 900;
      this.naturalHeight = 600;
      if (path.startsWith('assets/img/stages/hyakki-kyoto/') || path.startsWith('assets/img/enemies/kyoto-') || path.startsWith('assets/img/vfx/enemies/kyoto-'))
        loaded.push(path);
    }
  }
  const ctx = new Proxy({ globalAlpha: 1, drawImage: (...args) => drawn.push(args) },
    { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = () => ({ getContext: () => ctx });
  const env = { Image, innerWidth: 900, innerHeight: 600, document: { createElement: canvas },
    location, ART: {}, UI: {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  env.window = env;
  vm.createContext(env);
  for (const name of ['viewport', 'kyoto-scene-art', 'renderer'])
    vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), env);
  assert.equal(loaded.length, 0);
  env.KYOTO_SCENE_ART.load();
  env.KYOTO_SCENE_ART.load();
  const manifest = JSON.parse(fs.readFileSync('assets/img/stages/hyakki-kyoto/manifest.json', 'utf8'));
  assert.equal(loaded.length, 69);
  assert.equal(loaded.length, manifest.asset_count);
  assert.deepEqual(new Set(loaded),new Set(manifest.assets.map(item=>item.path)));
  for(const item of manifest.assets)assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(item.path)).digest('hex'),item.sha256);
  assert.ok(loaded.every(path => fs.existsSync(path)), loaded.join('\n'));
  const { RENDERER } = env;
  RENDERER.init(canvas());
  RENDERER.setDepthStage('hyakki-kyoto');
  RENDERER.drawGround(0, 600, [{ x: 0, y: 0, w: 900, h: 720, decor: {} }], 'ground', 'hyakki-kyoto');
  assert.ok(drawn.some(([img, x, y, w, h]) => img.path?.endsWith('__ground-grid.webp') && w === 900 && h === 720));
  for (const [type, role] of [['grocery', 'grocery'], ['sweets_house', 'sweets-house'], ['noodle_house', 'noodle-house']]) {
    RENDERER.drawHouse({ bType: `kyoto_${type}`, x: 200, y: 100, footY: 148 });
    assert.ok(drawn.at(-1)[0].path.endsWith(`__${role}.webp`));
  }
  for (const role of ['stall', 'crate-stack', 'stone-lantern', 'double-lantern', 'block-frontage', 'block-wall']) {
    RENDERER.drawRouteProp({ kind: `kyoto-${role}`, x: 326, y: 166, width: 36 });
    assert.ok(drawn.at(-1)[0].path.endsWith(`__${role}.webp`));
  }
  const cases = [
    [{ type: 'ghost' }, 'straw-sandal', 19, { walking: true }],
    [{ type: 'runner' }, 'crow-bell-courier', 19, { kyotoWarning: .2 }],
    [{ type: 'tank' }, 'rice-bale-oni', 19, { walking: true }],
    [{ type: 'shooter' }, 'box-bellows', 19, { kyotoShotWindup: true }],
    ...['taiko-warden', 'brocade-puppeteer', 'crossroads-boss', 'procession-marshal'].map(id => [
      { type: 'boss', trialBoss: { id: `kyoto-${id}` } }, id, 44, { hazard: { phase: 'telegraph' } }
    ])
  ];
  for (const [e, id, foot, windup] of cases) {
    const enemy = { ...e, x: 200, y: 200 };
    for (const [role, pose] of [['idle', {}], ['windup', windup], ['action', e.type === 'boss'
      ? { hazard: { phase: 'active' } } : { attackT: .2 }]]) {
      RENDERER.drawMonster({ ...enemy, ...pose }, { x: 241, y: 200 }, 0);
      const [img, , , , , , dy, , dh] = drawn.at(-1);
      assert.ok(img.path.endsWith(`${id}__sprite__${role}.webp`));
      assert.equal(dy + dh, foot);
    }
  }
  const { KYOTO_SCENE_ART } = env;
  const sealed = { type: 'boss', shield: true, trialBoss: KYOTO_SCENE_ART.bossWave(3), hazard: { phase: 'active' } };
  assert.match(KYOTO_SCENE_ART.monster(sealed).path, /procession-marshal__sprite__idle\.webp$/);
  assert.equal(KYOTO_SCENE_ART.monster({ type: 'mis' }), null);
  const walker = { type: 'runner', walking: true };
  assert.match(KYOTO_SCENE_ART.monster(walker, null, .2, true).path, /crow-bell-courier__sprite__walk\.webp$/);
  assert.match(KYOTO_SCENE_ART.monster(walker, null, .2, false).path, /crow-bell-courier__sprite__idle\.webp$/);
  for (const [index, effect] of [[0, 'taiko'], [1, 'pennant'], [2, 'taiko'], [3, 'procession']]) {
    const owner = { trialBoss: KYOTO_SCENE_ART.bossWave(index) };
    const warning = KYOTO_SCENE_ART.hazardImage(owner, 'telegraph');
    const impact = KYOTO_SCENE_ART.hazardImage(owner, 'active');
    assert.ok(warning.path.endsWith(`${effect}__warning.webp`));
    assert.ok(impact.path.endsWith(`${effect}__impact.webp`));
    RENDERER.drawStageLabHazard({ lanes: [{ x: 200, y: 220, rx: 34, ry: 150 }], index: 0, phase: 'telegraph' }, warning);
    assert.deepEqual(drawn.at(-1).slice(1), [-150, -34, 300, 68]);
  }
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /isStageLab\?\.\(window\.location\) \|\| window\.CONTENT\?\.getStage\?\.\("hyakki-kyoto"\)\?\.mapReleased === true\) \{[^}]+kyoto-scene-art\.js/);
});

test('四場京都王戰從實際生成入口帶出太鼓、錦幡、十字街鬼將、酒吞', () => {
  const titles = ['太鼓門將', '錦幡伶', '十字街鬼將', '百鬼夜行主宰・酒吞'];
  const ids = ['taiko-warden', 'brocade-puppeteer', 'crossroads-boss', 'procession-marshal'];
  for (const [index, title] of titles.entries()) {
    const game = boot();
    game.start('hyakki-kyoto');
    game.stopSpawns();
    game.clearOrders();
    game.forceBossSchedule(index);
    for (let attempt = 0; attempt < 16 && !game.snapshot().enemies.some(e => e.type === 'boss'); attempt++) game.update(.05);
    const boss = game.snapshot().enemies.find(e => e.type === 'boss');
    assert.ok(boss, `wave ${index}`);
    assert.equal(boss.title, title);
    assert.equal(boss.trialBoss?.id, `kyoto-${ids[index]}`);
    assert.equal(boss.gatekeeper, index === 2);
    assert.equal(boss.final, index === 3);
  }
});

test('風箱童只在射程和發射倒數內顯示起手，發射時切換出招', () => {
  const game = boot();
  game.start('hyakki-kyoto');
  game.stopSpawns();
  game.clearOrders();
  const { x, y } = game.snapshot();
  const shooter = game.addMob({ type: 'shooter', x: x + 200, y, shootCd: .3 });
  game.update(.05);
  assert.equal(shooter.kyotoShotWindup, true);
  assert.equal(game.snapshot().enemyBullets.length, 0);
  game.update(.26);
  assert.equal(shooter.kyotoShotWindup, false);
  assert.equal(shooter.attackT, .24);
  assert.ok(game.snapshot().enemyBullets.length > 0);
});
test('京都選同一商街時保留跨店距離、避開占用店家，附近無合法目的地時才跨街', () => {
  const { KYOTO_PROCESSION } = boot().env;
  const from = { id: 'a', x: 0, y: 0, chunkKey: '0,0' };
  const near = { id: 'b', x: 440, y: 0, chunkKey: '0,0' };
  const next = { id: 'c', x: 50, y: 650, chunkKey: '0,1' };
  const occupied = { id: 'd', x: 910, y: 0, chunkKey: '1,0' };
  const busy = new Set([occupied.id]);
  const result = KYOTO_PROCESSION.destinationPool([from, near, next, occupied], from, busy);
  assert.deepEqual(Array.from(result, stop => stop.id), ['b']);
  const fallback = KYOTO_PROCESSION.destinationPool([from, next, occupied], from, busy);
  assert.deepEqual(Array.from(fallback, stop => stop.id), ['c']);
});

test('巡行報信有前搖、每次至多帶動兩隻普通妖，對封印 Boss、混亂怪及式神追兵無效', () => {
  const { KYOTO_PROCESSION } = boot().env;
  const leader = { x: 0, y: 0, processionLeader: true, type: 'runner', hp: 20 };
  const player = { x: 180, y: 20 };
  const boss = { x: 10, y: 0, type: 'boss', hp: 30 };
  const confused = { x: 20, y: 0, type: 'grunt', hp: 30, confusedT: 3 };
  const guards = Array.from({ length: 5 }, (_, i) => ({ x: 25 + 10 * i, y: 0, type: 'grunt', hp: 30 }));
  const mobs = [leader, boss, confused, ...guards];
  const diverted = e => e === guards[0];
  assert.equal(KYOTO_PROCESSION.step(leader, player, mobs, .05, diverted), 'warning');
  assert.equal(guards.filter(e => e.kyotoRally).length, 0);
  assert.equal(KYOTO_PROCESSION.step(leader, player, mobs, .9, diverted), 'rally');
  assert.equal(leader.attackT, .24);
  assert.equal(guards.filter(e => e.kyotoRally).length, 2);
  assert.equal(guards[0].kyotoRally, undefined);
  assert.equal(boss.kyotoRally, undefined);
  assert.equal(confused.kyotoRally, undefined);
  assert.equal(KYOTO_PROCESSION.step(leader, player, mobs, .03, diverted), null);
});

test('S4 勝利置位後才有京都進度資格，公開地圖逐關解鎖；京都主循環能開獨立市場委託', () => {
  const game = boot();
  assert.equal(game.store().isStageUnlocked('hyakki-kyoto'), false);
  game.store().finish('bamboo-maze', 10, 2, false);
  assert.equal(game.store().isStageUnlocked('hyakki-kyoto'), false);
  game.store().finish('bamboo-maze', 900, 6, true);
  assert.equal(game.store().isStageUnlocked('hyakki-kyoto'), true);
  assert.equal(game.env.CONTENT.getStage('hyakki-kyoto').mapReleased, true);
  assert.equal(game.env.CONTENT.getStageWords('hyakki-kyoto').length, 20);
  game.start('hyakki-kyoto');
  const scene = game.snapshot();
  assert.ok(scene.orders.length > 0);
  assert.ok(game.worldSolids().some(s => s.kind === 'kyoto-block'));
  const stopIds = scene.orders.flatMap(order => [order.from.id, order.to.id]);
  assert.equal(new Set(stopIds).size, stopIds.length);
  for (const order of scene.orders) {
    assert.match(order.from.bType, /^kyoto_/);
    assert.match(order.to.bType, /^kyoto_/);
    for (const p of game.env.WORLD.answerPositions(order.to)) {
      assert.equal(game.spotBlocked(p.x, p.y, 18), false);
    }
  }
  game.winStage();
  game.start('hyakki-kyoto');
  assert.equal(game.snapshot().enemies.length, 0);
});

test('京都終王半血封街逐段重做預警，封印與暫停保留，實際傷害對齊已鎖定的路線', () => {
  const game = boot();
  const ai = game.env.BOSS_AI;
  const boss = { x: 0, y: 0, hp: 100, max: 250, final: true, shield: true, stageId: 'hyakki-kyoto' };
  const player = { x: 180, y: 80 };
  assert.equal(ai.step(boss, player, .1).started, false);
  boss.shield = false;
  assert.equal(ai.step(boss, player, .1).cue, 'crossingWarning');
  const hazard = boss.hazard;
  assert.equal(hazard.kind, 'kyotoCrossing');
  assert.equal(hazard.lanes.length, 2);
  const original = hazard.remaining;
  ai.step(boss, player, 5, { paused: true });
  assert.equal(hazard.remaining, original);
  assert.equal(ai.step(boss, { x: player.x, y: player.y + 100 }, 2).hit, null);
  const first = hazard.lanes[0];
  assert.equal(ai.step(boss, first, .02).hit.kind, 'kyotoCrossing');
  assert.equal(ai.step(boss, first, .02).hit, null);
  ai.step(boss, first, 1);
  assert.equal(ai.step(boss, first, 1).cue, 'crossingWarning');
  assert.equal(hazard.phase, 'telegraph');
  assert.equal(hazard.index, 1);
  assert.deepEqual([first.x, first.y], [player.x, player.y]);
  boss.shield = true;
  assert.equal(ai.step(boss, player, 1).hit, null);
  assert.equal(boss.hazard, undefined);
});

test('京都報信與封街由真實更新推進，離開危險帶不受傷，勝利清掉預警', () => {
  const game = boot();
  game.start('hyakki-kyoto');
  game.stopSpawns();
  game.clearOrders();
  const { x, y } = game.snapshot();
  const leader = game.addMob({ x: x + 145, y, type: 'runner', processionLeader: true });
  const mob = game.addMob({ x: x + 115, y });
  game.update(.05);
  assert.ok(leader.kyotoWarning > 0);
  assert.equal(mob.kyotoRally, undefined);
  game.update(.81);
  assert.ok(mob.kyotoRally > 0);
  const ai = game.env.BOSS_AI;
  const boss = game.addMob({ type: 'boss', x: x - 135, y, stageId: 'hyakki-kyoto' });
  const player = { x, y };
  assert.equal(ai.step(boss, player, .1).started, true);
  assert.equal(boss.hazard.lanes.length, 1);
  ai.step(boss, player, 2);
  const safe = { x, y: y + 90 };
  assert.equal(ai.step(boss, safe, .5).hit, null);
  assert.equal(ai.step(boss, safe, .6).finished, true);
  ai.start(boss, player);
  game.hurt(boss, boss.hp + 1);
  assert.equal(boss.hazard, undefined);
  const next = game.addMob({ type: 'boss', x: x - 135, y, stageId: 'hyakki-kyoto' });
  ai.start(next, player);
  game.winStage();
  assert.equal(next.hazard, undefined);
  assert.equal(mob.kyotoRally, undefined);
});
