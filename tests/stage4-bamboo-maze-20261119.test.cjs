'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

const location = { hostname: 'localhost', search: '?dev=1&stageLab=1&stage=bamboo-maze' };
const boot = () => loadGame({ location, stage: 'bamboo-maze' });
const pointBlocked = (solids, x, y, r) => solids.some(s =>
  Math.hypot(x - Math.max(s.x0, Math.min(x, s.x1)), y - Math.max(s.y0, Math.min(y, s.y1))) < r);

test('竹林有四邊竹牆與 5×5 個固定區塊，移到邊緣也不延伸', () => {
  const game = boot();
  const { CONTENT, WORLD } = game.env;
  const stage = CONTENT.getStage('bamboo-maze');
  for (const scale of [1, 1.2, 1.3]) {
    const world = WORLD.createStageWorld(stage, CONTENT, { spacingScaleY: scale });
    const center = world.update(stage.start.x, stage.start.y * scale);
    const { minX, maxX, minY, maxY } = center.bounds;
    assert.ok(maxX - minX <= 4500 && maxX - minX > 4000);
    assert.ok(maxY - minY <= 3000 * scale && maxY - minY > 2600 * scale);
    assert.equal(center.chunks.length, 25);
    for (const [x, y] of [[minX, minY], [minX, maxY], [maxX, minY], [maxX, maxY]]) {
      const edge = world.update(x, y, ['-2,-2', '5,5']);
      assert.deepEqual(edge.chunks.map(c => c.key), center.chunks.map(c => c.key));
    }
    assert.equal(world.getCacheSize(), 25);
    assert.equal(world.getChunk(-1, 1), null);
    const wall = center.chunks.flatMap(c => Array.from(c.routeProps ?? [])).filter(p => p.wall);
    for (const [axis, edge] of [['x', minX], ['x', maxX], ['y', minY], ['y', maxY]])
      assert.ok(wall.filter(p => Math.abs(p[axis] - edge) < 30).length >= 14);
    assert.ok(new Set(wall.map(p => p.kind)).size >= 3);
  }
  game.start('bamboo-maze');
  for (const [x, y] of [[0, 1500], [4500, 1500], [2250, 0], [2250, 3900]])
    assert.equal(game.spotBlocked(x, y, 18), true);
});

test('竹林公開地圖須先完成第三關，第五關繼續鎖定', () => {
  for (const hostname of ['localhost', 'example.com']) {
    const { OVERWORLD, STORE } = loadGame({ location: { ...location, hostname } }).env;
    const node = id => OVERWORLD.STAGE_NODES.find(n => n.stageId === id);
    assert.equal(OVERWORLD.isEnterable(node('bamboo-maze')), false);
    STORE.finish('sakura-pass', 100, 6, true);
    assert.equal(OVERWORLD.isEnterable(node('bamboo-maze')), true);
    STORE.finish('bamboo-maze', 100, 6, true);
    assert.equal(OVERWORLD.isEnterable(node('hyakki-kyoto')), false);
  }
});

test('開發直達竹林首輪必見第七至九招，選式神不寫入通關資格', () => {
  const game = boot();
  const expected = ['ink_trail', 'seal_nail', 'shikigami'];
  for (const [i, id] of expected.entries()) {
    game.start('bamboo-maze');
    game.stopSpawns();
    assert.equal(game.forceLevelUp(), 'levelup');
    assert.deepEqual(Array.from(game.snapshot().choiceIds), expected);
    assert.ok(game.takeLevelUpChoice(i).ok);
    assert.equal(game.weaponLevels()[id], 1);
  }
  game.update(.05);
  assert.equal(game.companion().species, 'hound');
  assert.equal(game.companion().active, true);
  for (const id of expected) assert.equal(game.store().isActiveSkillUnlocked(id), false);
  game.start('night-town');
  assert.ok(game.eligibleChoices().every(card => !expected.includes(card.id)));
});

test('竹林載入 33 張現役真圖，竹守與竹筍妖姿態由戰鬥狀態選取', () => {
  const loaded = [];
  const manifest = JSON.parse(fs.readFileSync('assets/img/stages/bamboo-maze/manifest.json'));
  const dimensions = new Map(manifest.assets.filter(item => item.active !== false).map(item => [item.path, item.size]));
  class Image {
    set src(path) {
      [this.naturalWidth, this.naturalHeight] = dimensions.get(path);
      this.path = path;
      loaded.push(path);
    }
  }
  const window = { Image };
  vm.runInNewContext(fs.readFileSync('js/bamboo-art.js', 'utf8'), { window, Image });
  const art = window.BAMBOO_ART;
  assert.deepEqual(loaded, []);
  art.load();
  art.load();
  assert.equal(manifest.status, 'PUBLIC_PLAYTEST_PENDING_FEEDBACK');
  assert.deepEqual(new Set(loaded), new Set(dimensions.keys()));
  assert.equal(new Set(loaded).size, 33);
  assert.equal(loaded.length, 33);
  for (const path of loaded) assert.ok(fs.existsSync(path), path);
  assert.match(art.monster({ type: 'boss', shield: true }).path, /__sealed\.webp$/);
  assert.match(art.monster({ type: 'boss', hazard: { kind: 'bambooCut', phase: 'telegraph' } }).path, /__cut\.webp$/);
  assert.match(art.monster({ type: 'runner', walking: true }, .26, true).path, /__walk__f03\.webp$/);
  for (const [phase, pose] of [['telegraph', 'windup'], ['active', 'rush'], ['recovery', 'recover']]) {
    assert.ok(art.monster({ type: 'runner', bambooRush: { phase } }).path.endsWith(`__${pose}.webp`));
  }
});

test('竹林實際繪製落葉地、彎路、房屋、竹叢和敵人，預警圖對齊命中區', () => {
  const drawn = [], rotations = [], patterns = [], trailSegments = [];
  const manifest = JSON.parse(fs.readFileSync('assets/img/stages/bamboo-maze/manifest.json'));
  const dimensions = new Map(manifest.assets.map(item => [item.path, item.size]));
  class Image {
    set src(path) {
      [this.naturalWidth, this.naturalHeight] = dimensions.get(path) || [0, 0];
      this.path = path;
    }
  }
  const ctx = new Proxy({
    globalAlpha: 1,
    drawImage: (...args) => drawn.push(args),
    rotate: angle => rotations.push(angle),
    createPattern: img => { patterns.push(img); return {}; },
    createLinearGradient: () => ({ addColorStop() {} }),
    lineTo: (x, y) => trailSegments.push([x, y])
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = () => ({ getContext: () => ctx });
  const env = { Image, innerWidth: 900, innerHeight: 600, document: { createElement: canvas },
    ART: {}, UI: {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  env.window = env;
  vm.createContext(env);
  for (const name of ['viewport', 'stage-route-layouts', 'bamboo-art', 'renderer'])
    vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), env);
  const { BAMBOO_ART, RENDERER } = env;
  RENDERER.init(canvas());
  RENDERER.setDepthStage('bamboo-maze');
  BAMBOO_ART.load();
  RENDERER.drawGround(0, 600, [{ x: 0, y: 0, w: 900, h: 600, decor: {} }], 'ground', 'bamboo-maze');
  assert.ok(drawn.some(([img]) => img.path?.endsWith('__forest-duff.webp')));
  assert.match(patterns[0].path, /__earth-track\.webp$/);
  assert.ok(trailSegments.slice(1).some(([x, y], i) =>
    Math.abs(x - trailSegments[i][0]) > 5 && Math.abs(y - trailSegments[i][1]) > 5));
  RENDERER.drawHouse({ bType: 'bamboo_tea_house', x: 100, y: 100, footY: 148 });
  assert.match(drawn.at(-1)[0].path, /__tea-house\.webp$/);
  RENDERER.drawBambooProp({ kind: 'bamboo-column', x: 150, y: 120, width: 120 });
  assert.match(drawn.at(-1)[0].path, /__bamboo-column\.webp$/);
  assert.ok(drawn.at(-1)[4] > 280, '直竹高度超過 280');
  RENDERER.drawMonster({ type: 'tank', x: 10, y: 10, attackT: .1 }, { x: 30 }, 0);
  const [sprite, , , , , , dy, , dh] = drawn.at(-1);
  assert.match(sprite.path, /crab__sprite__attack\.webp$/);
  assert.ok(Math.abs(dy + dh - 19) < 1e-8, 'sprite feet keep the same world anchor');

  BAMBOO_ART.paintHazard(ctx, { kind: 'bambooCut', phase: 'telegraph', zones: [{ x: 50, y: 60, rx: 36, ry: 145 }] });
  assert.match(drawn.at(-1)[0].path, /bamboo-cut__warning\.webp$/);
  assert.equal(rotations.at(-1), Math.PI / 2);
  assert.deepEqual(drawn.at(-1).slice(-4), [-145, -36, 290, 72]);
  BAMBOO_ART.paintHazard(ctx, { kind: 'bambooShoots', phase: 'active', zones: [{ x: 80, y: 100, rx: 43, ry: 43 }] });
  assert.deepEqual(drawn.at(-2).slice(-4), [-43, -43, 86, 86]);
  assert.match(drawn.at(-1)[0].path, /bamboo-shoots__impact\.webp$/);
});

test('竹林 2D／2.5D 交會路網、取貨與三個答題點皆有連通路線', () => {
  const game = boot();
  const { CONTENT, WORLD } = game.env;
  const stage = CONTENT.getStage('bamboo-maze');
  assert.equal(stage.mapReleased, true);
  assert.equal(CONTENT.getStageWords(stage).length, 20);
  for (const scale of [1, 1.2, 1.3]) {
    const world = WORLD.createStageWorld(stage, CONTENT, { spacingScaleY: scale });
    const snap = world.update(stage.start.x, stage.start.y * scale);
    assert.ok(snap.solids.some(rect => rect.kind === 'bamboo-stand'));
    const start = { x: stage.start.x, y: stage.start.y * scale };
    assert.equal(pointBlocked(snap.solids, start.x, start.y, 52), false);
    const step = 22;
    const goals = new Set();
    const key = (x, y) => x + ',' + y;
    assert.equal(snap.houses.length, 20);
    const { minX, maxX, minY, maxY } = snap.bounds;
    for (const house of snap.houses) {
      assert.ok(snap.houses.some(other => other.id !== house.id &&
        Math.hypot(house.x - other.x, house.y - other.y) >= 580 &&
        Math.hypot(house.x - other.x, house.y - other.y) <= 1250));
      for (const point of [{ x: house.dx, y: house.dy }, ...WORLD.answerPositions(house)]) {
        assert.ok(point.x >= minX + 25 && point.x <= maxX - 25 &&
          point.y >= minY + 25 && point.y <= maxY - 25);
        assert.equal(pointBlocked(snap.solids, point.x, point.y, 18), false);
        goals.add(key(Math.round((point.x - start.x) / step), Math.round((point.y - start.y) / step)));
      }
    }
    assert.ok(goals.size >= 76);
    const queue = [[0, 0]], seen = new Set(['0,0']);
    for (let i = 0; i < queue.length && goals.size; i++) {
      const [gx, gy] = queue[i];
      goals.delete(key(gx, gy));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, ny = gy + dy, k = key(nx, ny);
        const x = start.x + nx * step, y = start.y + ny * step;
        if (seen.has(k) || x < minX + 25 || x > maxX - 25 || y < minY + 25 || y > maxY - 25 ||
            pointBlocked(snap.solids, x, y, 25)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    assert.equal(goals.size, 0);
  }
});

test('竹筍妖警告後才突進，踩中減速時速率仍受控', () => {
  const { BAMBOO_COMBAT } = boot().env;
  const mob = { x: 0, y: 0, speed: 80 };
  const target = { x: 150, y: 0 };
  assert.equal(BAMBOO_COMBAT.mobMotion(mob, target, .05, 80).speed, 0);
  assert.equal(mob.bambooRush.phase, 'telegraph');
  assert.equal(BAMBOO_COMBAT.mobMotion(mob, target, 1.2, 80).speed, 0);
  assert.equal(mob.bambooRush.phase, 'active');
  assert.ok(BAMBOO_COMBAT.mobMotion(mob, target, .03, 25).speed <= 68);
  const other = { x: -150, y: 0 };
  assert.ok(BAMBOO_COMBAT.mobMotion(mob, other, .03, 25).speed <= 25);
  const blocked = { x: 0, y: 0 };
  assert.equal(BAMBOO_COMBAT.mobMotion(blocked, target, .05, 80, x => x > 32).speed, 80);
  assert.equal(blocked.bambooRush, undefined);
});

test('竹林 Boss 封印不施法；竹葉切線／筍陣有分離前搖及一次命中', () => {
  const game = boot();
  const ai = game.env.BOSS_AI;
  const e = { type: 'boss', stageId: 'bamboo-maze', x: 0, y: 0, hp: 120, max: 500, shield: true, final: true };
  const p = { x: 180, y: 40 };
  assert.equal(ai.step(e, p, 1).hit, null);
  assert.equal(e.hazard, undefined);
  e.shield = false;
  assert.equal(ai.step(e, p, .02).started, true);
  assert.equal(e.hazard.kind, 'bambooCut');
  assert.equal(ai.step(e, p, 2).hit, null);
  assert.equal(e.hazard.phase, 'active');
  assert.equal(ai.step(e, p, .03).hit.kind, 'bambooCut');
  assert.equal(ai.step(e, p, .03).hit, null);
  ai.step(e, p, 2);
  ai.step(e, p, 2);
  ai.step(e, p, 2);
  assert.equal(e.hazard.kind, 'bambooShoots');
  assert.equal(e.hazard.zones.length, 1);
});

test('筍陣五次獨立鎖腳、跑出圈可閃、停留會中且可暫停或取消', () => {
  const { BAMBOO_COMBAT } = boot().env;
  for (const walking of [true, false]) {
    const boss = { x: 50, y: 25, hp: 100, max: 400, final: true, bambooAttack: 1 };
    const p = { x: 180, y: 40 };
    const marked = [];
    let hits = 0;
    BAMBOO_COMBAT.start(boss,p);
    for (let strike = 1; strike <= 5; strike++) {
      const h = boss.hazard;
      assert.equal(h.strike, strike);
      assert.equal(h.phase, 'telegraph');
      assert.equal(h.zones.length, 1);
      assert.equal(h.zones[0].x, p.x, '重新鎖定玩家腳下');
      marked.push(h.zones[0].x);
      const before = h.remaining;
      BAMBOO_COMBAT.step(boss, p, 1, { paused: true });
      assert.equal(h.remaining, before);
      assert.equal(h.zones[0].x, marked.at(-1), '已畫出的圈不跟著玩家滑動');
      const frames = 17;
      for (let frame = 0; frame < frames; frame++) {
        const dt = before / frames + .000001;
        if (walking) p.x += 230 * dt;
        assert.equal(BAMBOO_COMBAT.step(boss,p,dt).hit, null);
      }
      assert.equal(h.phase, 'active');
      if (BAMBOO_COMBAT.step(boss,p,.02).hit) hits++;
      assert.equal(BAMBOO_COMBAT.step(boss,p,.02).hit, null);
      if (!walking) p.x += 20;
      const step = BAMBOO_COMBAT.step(boss,p,1);
      assert.equal(step.started, strike < 5);
    }
    assert.equal(new Set(marked).size, 5);
    assert.equal(hits, walking ? 0 : 5);
    assert.equal(boss.hazard.phase, 'recovery');
    boss.shield = true;
    assert.equal(BAMBOO_COMBAT.step(boss,p,.05).hit, null);
    assert.equal(boss.hazard, undefined);
  }
});

test('主循環配送、普通怪和 Boss 生成沿用竹林通道；暫停與重玩清除攻擊狀態', () => {
  const game = boot();
  game.start('bamboo-maze');
  game.stopSpawns();
  const before = game.snapshot();
  assert.ok(before.orders.length > 0);
  for (const order of before.orders) {
    assert.notEqual(order.from.id, order.to.id);
    assert.equal(game.spotBlocked(order.from.dx, order.from.dy, 18), false);
    for (const p of game.env.WORLD.answerPositions(order.to)) {
      assert.equal(game.spotBlocked(p.x, p.y, 18), false);
    }
  }
  for (let i = 0; i < 24; i++) game.spawnEnemy(3, 560, i * Math.PI / 12);
  const mobs = game.snapshot().enemies;
  assert.ok(mobs.length >= 12);
  for (const mob of mobs) assert.equal(game.spotBlocked(mob.x, mob.y, 26), false);
  game.clearEnemies();
  game.forceBossSchedule(0);
  game.update(.05);
  const boss = game.snapshot().enemies.find(e => e.type === 'boss');
  assert.ok(boss);
  assert.equal(game.spotBlocked(boss.x, boss.y, 52), false);
  assert.equal(boss.stageId, 'bamboo-maze');
  game.moveBoss(175);
  boss.shield = false; boss.attackCd = 0;
  game.update(.05);
  const warn = boss.hazard.remaining;
  game.setState('pause');
  game.update(.5);
  assert.equal(boss.hazard.remaining, warn);
  game.setState('play');
  game.setOil(0);
  game.update(.05);
  assert.equal(game.snapshot().state, 'lampout');
  assert.equal(boss.hazard, undefined);
  game.start('bamboo-maze');
  assert.equal(game.snapshot().enemies.length, 0);
  game.addMob({});
  game.leaveStage();
  assert.equal(game.snapshot().state, 'overworld');
  assert.equal(game.snapshot().enemies.length, 0);
});

test('公開一般模式載入有限竹林與 Boss，保留一般進度和京都門禁', () => {
  const browser = loadGame({ location: { hostname: 'game.example.com', search: '' } });
  const { WORLD, CONTENT, BAMBOO_COMBAT, DEV_MODE, KYOTO_PROCESSION } = browser.env;
  assert.ok(BAMBOO_COMBAT);
  assert.equal(KYOTO_PROCESSION, undefined);
  assert.equal(DEV_MODE.sessionKey(browser.env.location), DEV_MODE.OFFICIAL_KEY);
  assert.equal(CONTENT.getStage('bamboo-maze').mapReleased, true);
  const world = WORLD.createStageWorld(CONTENT.getStage('bamboo-maze'), CONTENT);
  assert.ok(world.update(1350, 900).solids.some(s => s.kind === 'bamboo-stand'));
  for (const stage of ['night-town','rain-port','sakura-pass']) browser.store().finish(stage,100,6,true);
  browser.start('bamboo-maze');
  assert.equal(browser.forceLevelUp(), 'levelup');
  assert.deepEqual(Array.from(browser.snapshot().choiceIds), ['ink_trail','seal_nail','shikigami']);
});

test('切換 2D／2.5D 保留竹林世界位置；八招與御守、紫藤變異走既有戰鬥入口', () => {
  const game = boot();
  game.start('bamboo-maze');
  game.stopSpawns();
  const before = game.snapshot();
  const geometry = game.worldSolids().slice();
  const tilt = game.env.VIEWPORT.tiltScale();
  game.toggleView();
  assert.notEqual(game.env.VIEWPORT.advanceTilt(.8), tilt);
  assert.deepEqual(game.worldSolids(), geometry);
  assert.deepEqual([game.snapshot().x, game.snapshot().y], [before.x, before.y]);
  const combat = game.env.OMAMORI_CORE;
  const base = combat.effects().dmg;
  const withCharm = combat.effectsOf({ ...combat.build(), charms: ['charm_power'], charmLevels: { charm_power: 1 } });
  assert.ok(withCharm.dmg > base);
  for (const id of ['katana', 'barrier', 'fire', 'boom', 'thunder', 'needle', 'ink_trail', 'seal_nail']) {
    game.start('bamboo-maze');
    const target = id === 'fire' ? 48 : 65;
    game.combatScene(id, [{ dx: target }]);
    game.setBuildMutations(id === 'ink_trail' ? ['mut_ink_linger'] : []);
    game.armWeapons();
    const x = game.snapshot().x, y = game.snapshot().y;
    game.skillFxLog.length = 0;
    game.audioCalls.length = 0;
    for (let i = 0; i < 14; i++) {
      game.weapons(.05, { start: { x: x + i * 5, y }, end: { x: x + (i + 1) * 5, y } });
    }
    if (id === 'ink_trail' || id === 'seal_nail') {
      assert.ok(game.audioCalls.includes(id === 'ink_trail' ? 'inkTrailDrop' : 'sealNailDrop'), id);
    } else {
      assert.ok(game.skillFxLog.some(event => event.id === id), id);
    }
  }
});
