'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

const stage = 'snow-temple';
const location = { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=snow-temple' };

test('雪燈山寺可向正負座標串流並維持通路、供貨腳點及有界快取', () => {
  const { env } = loadGame({ location, stage });
  assert.equal(env.CONTENT.getStage(stage).mapReleased, true);
  for (const spacing of [1, 1.2]) {
    const world = env.WORLD.createStageWorld(env.CONTENT.getStage(stage), env.CONTENT, { spacingScaleY: spacing });
    const first = world.update(1350, 900 * spacing);
    const startingKey = world.keyAt(1350, 900 * spacing);
    assert.equal(first.bounds, null);
    assert.equal(first.chunks.length, 25);
    assert.ok(first.chunks.every(chunk => chunk.routeProps.some(p => p.kind.startsWith('snow-'))));
    const free = (solids, x, y, r) => solids.every(s => Math.hypot(
      x - Math.max(s.x0, Math.min(s.x1, x)), y - Math.max(s.y0, Math.min(s.y1, y))) >= r);
    for (const chunk of first.chunks) {
      assert.ok(chunk.houses.length >= 1);
      assert.ok(free(first.solids, chunk.x + 450, chunk.y + 300 * spacing, 52));
      for (const house of chunk.houses) {
        assert.ok(free(first.solids, house.dx, house.dy, 18));
        assert.ok(env.WORLD.answerPositions(house).every(p => free(first.solids, p.x, p.y, 18)));
      }
    }
    for (const [x, y] of [[-31000, -43000], [67000, 81000], [1350, 900 * spacing]]) {
      const snapshot = world.update(x, y, [startingKey]);
      assert.ok(snapshot.chunks.some(chunk => chunk.key === world.keyAt(x, y)));
      assert.ok(world.getCacheSize() <= 26);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(world.getChunk(1, 1))),
      JSON.parse(JSON.stringify(first.chunks.find(chunk => chunk.key === startingKey))));
  }
});

test('雪山與京都 DEV 在明確的家用 LAN 旗標下可走隔離存檔', () => {
  const { env } = loadGame({ location, stage });
  const lan = { hostname: '192.168.50.107', search: location.search + '&s3play=1' };
  assert.equal(env.DEV_MODE.isStageLab(lan), true);
  assert.equal(env.DEV_MODE.sessionKey(lan), env.DEV_MODE.sessionKey(location));
  assert.equal(env.DEV_MODE.isStageLab({ ...lan, hostname: 'yokai.example' }), false);
  assert.equal(env.DEV_MODE.isStageLab({ ...lan, search: location.search }), false);
});

test('雪山四名正式波次 Boss 使用獨立角色，第三王保留三連冰柱', () => {
  const { env } = loadGame({ location, stage });
  const player = { x: 1250, y: 900 };
  const options = { stageId: stage };
  const art = env.SNOW_TEMPLE_ART;
  const roster = [0, 1, 2, 3].map(i => art.bossWave(i));
  assert.deepEqual(roster.map(boss => boss.attack), ['frost-bell', 'ice-gale', 'frost-bell', 'blizzard-claws']);
  assert.equal(new Set(roster.map(boss => boss.id)).size, 4);
  assert.equal(roster[2].id, 'snow-ice-pillar-boss');
  const gate = { type: 'boss', stageId: stage, trialBoss: roster[2], gatekeeper: true,
    x: 1100, y: 900, hp: 200, max: 200, attackCd: 0 };
  assert.equal(env.BOSS_AI.step(gate, player, .01, options).started, true);
  assert.deepEqual(Array.from(gate.hazard.lanes, lane => [lane.rx,lane.warning,lane.damage]),
    [[78,.98,15],[76,.74,15],[74,.74,16]]);
  for (const trialBoss of [roster[0], roster[1], roster[3]]) {
    const e = { type: 'boss', stageId: stage, trialBoss, x: 1120, y: 900, hp: 200, max: 200, attackCd: 0 };
    assert.equal(env.BOSS_AI.step(e, player, .01, options).started, true);
    assert.equal(e.hazard.kind, 'snowTemple');
    assert.equal(e.hazard.attack, trialBoss.attack);
    const { x, y } = e.hazard;
    assert.equal(env.BOSS_AI.step(e, { x: x + 500, y }, 2, { ...options, paused: true }).hit, null);
    assert.equal(e.hazard.phase, 'telegraph');
    assert.equal(env.BOSS_AI.step(e, { x: x + 500, y }, 1.4, options).hit, null);
    assert.equal(e.hazard.phase, 'active');
    assert.equal(e.hazard.x, x);
    const hit = env.BOSS_AI.step(e, { x, y }, .01, options).hit;
    assert.equal(hit.kind, 'snowTemple');
    assert.equal(env.BOSS_AI.step(e, { x, y }, .01, options).hit, null);
    e.shield = true;
    env.BOSS_AI.step(e, { x, y }, .01, options);
    assert.equal(e.hazard, undefined);
  }
});

test('雪山尾王半血第二圈有獨立預警，封印與凍結維持原定停表', () => {
  const { env } = loadGame({ location, stage });
  const player = { x: 1350, y: 900 };
  const e = { type: 'boss', stageId: stage, trialBoss: env.SNOW_TEMPLE_ART.bossWave(3),
    x: 1200, y: 900, hp: 90, max: 200 };
  const boss = env.BOSS_AI;
  boss.step(e, player, .05);
  assert.equal(e.hazard.lanes.length, 2);
  e.freezeT = .5;
  boss.step(e, player, 2);
  assert.equal(e.hazard.phase, 'telegraph');
  e.freezeT = 0;
  boss.step(e, player, 2);
  assert.ok(boss.step(e, player, .4).hit);
  boss.step(e, player, .55);
  assert.equal(e.hazard.index, 1);
  assert.equal(e.hazard.phase, 'telegraph');
  assert.equal(boss.step(e, player, .2).hit, null);
  boss.step(e, player, .8);
  assert.equal(boss.step(e, player, .03).hit, null);
  assert.ok(boss.step(e, e.hazard.lanes[1], .03).hit);
});

test('雪山四個原生出場波次給四名對應魔王，守門與終王仍走共用旗標', () => {
  const ids = ['frost-bell-guardian', 'white-kimono', 'ice-pillar-boss', 'mountain-lion'];
  for (const [index, role] of ids.entries()) {
    const game = loadGame({ location, stage });
    game.start(stage);
    game.stopSpawns();
    game.clearOrders();
    game.forceBossSchedule(index);
    for (let n = 0; n < 16 && !game.snapshot().enemies.some(e => e.type === 'boss'); n++) game.update(.05);
    const active = game.snapshot().enemies.find(e => e.type === 'boss');
    assert.ok(active, `snow wave ${index}`);
    assert.equal(active.trialBoss?.id, `snow-${role}`);
    assert.equal(active.gatekeeper, index === 2);
    assert.equal(active.final, index === 3);
  }
});

test('雪山 DEV 素材全部由本關 loader 讀取，清冊雜湊與圖檔一致', () => {
  const requested = [];
  const env = { Image: class { set src(value) { requested.push(value); this.naturalWidth = 384; } } };
  env.window = env;
  vm.runInNewContext(fs.readFileSync('js/snow-temple-art.js', 'utf8'), env);
  env.SNOW_TEMPLE_ART.load();
  env.SNOW_TEMPLE_ART.load();
  const trial = JSON.parse(fs.readFileSync('assets/img/stages/snow-temple/manifest.json', 'utf8'));
  assert.equal(requested.length, trial.asset_count);
  assert.deepEqual(new Set(requested), new Set(trial.assets.map(item => item.path)));
  for (const item of trial.assets) {
    assert.equal(createHash('sha256').update(fs.readFileSync(item.path)).digest('hex'), item.sha256);
  }
  const boss = { type:'boss', trialBoss:env.SNOW_TEMPLE_ART.bossWave(2) };
  const idle = env.SNOW_TEMPLE_ART.monster(boss);
  assert.equal(idle.naturalWidth,384);
  assert.deepEqual(Array.from(idle.stageFrame),[0,0,384,360,192]);
  const windup = env.SNOW_TEMPLE_ART.monster({...boss,hazard:{phase:'telegraph'}});
  const action = env.SNOW_TEMPLE_ART.monster({...boss,hazard:{phase:'active'}});
  assert.equal(windup,env.SNOW_TEMPLE_ART.image('snow-ice-pillar-boss:windup'));
  assert.equal(action,env.SNOW_TEMPLE_ART.image('snow-ice-pillar-boss:action'));
  assert.deepEqual(Array.from(action.stageFrame),[0,0,384,384,192,350]);
  assert.equal(action.stageBaseHeight,360);
  assert.equal(action.stageSpriteHeight,idle.stageSpriteHeight);
  assert.notEqual(env.SNOW_TEMPLE_ART.monster({...boss,trialBoss:env.SNOW_TEMPLE_ART.bossWave(0)}),idle);
});
