'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

test('P1-4：百鬼京都全 9 區塊 18 棟屋、18 取貨點與 54 答題墊在 2D/2.5D 皆不越界且不撞建築（r=18）', () => {
  const { env } = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=hyakki-kyoto' }, stage: 'hyakki-kyoto' });
  const stage = env.CONTENT.getStage('hyakki-kyoto');
  for (const spacing of [1, 1.2]) {
    const world = env.WORLD.createStageWorld(stage, env.CONTENT, { spacingScaleY: spacing });
    const snap = world.update(1350, 900 * spacing);
    assert.equal(snap.houses.length, 18);
    const { minX, maxX, minY, maxY } = snap.bounds;
    const hitSolid = (x, y, r) => snap.solids.some(s => Math.hypot(
      x - Math.max(s.x0, Math.min(s.x1, x)), y - Math.max(s.y0, Math.min(s.y1, y))) < r);
    let padCount = 0;
    for (const h of snap.houses) {
      for (const pt of [{ x: h.dx, y: h.dy }, ...env.WORLD.answerPositions(h)]) {
        padCount++;
        assert.ok(pt.x - 18 >= minX && pt.x + 18 <= maxX, `X out of bounds: ${h.id} (${pt.x}, ${pt.y}) bounds [${minX},${maxX}]`);
        assert.ok(pt.y - 18 >= minY && pt.y + 18 <= maxY, `Y out of bounds: ${h.id} (${pt.x}, ${pt.y}) bounds [${minY},${maxY}]`);
        assert.equal(hitSolid(pt.x, pt.y, 18), false, `Blocked by solid: ${h.id} (${pt.x}, ${pt.y})`);
      }
    }
    assert.equal(padCount, 72); // 18 pickups + 54 answer pads
  }
});

test('P1-1：黃泉終王偏心赤月環站樁必中、向內入核與向外撤離皆可安全逃生，且預警期間不追蹤玩家', () => {
  const { env } = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=yomi' }, stage: 'yomi' });
  const ai = env.BOSS_AI;
  const player = { x: 1350, y: 900 };
  const boss = {
    type: 'boss', stageId: 'yomi', final: true, hp: 1400, max: 1400,
    x: 1150, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('yomi').bossWave(3)
  };
  assert.equal(ai.step(boss, player, 0.02, { stageId: 'yomi' }).started, true);
  const z0 = boss.hazard.lanes[0];
  const initDist = Math.hypot(z0.x - player.x, z0.y - player.y);
  assert.ok(initDist > z0.inner && initDist < z0.rx, `Player must start inside ring [${z0.inner}, ${z0.rx}], got ${initDist}`);

  // Verify center stays locked during telegraph even if player moves
  const lockedX = z0.x, lockedY = z0.y;
  ai.step(boss, { x: player.x + 100, y: player.y }, 0.5, { stageId: 'yomi' });
  assert.equal(boss.hazard.x, lockedX);
  assert.equal(boss.hazard.y, lockedY);

  // Advance to active -> stand-still at original player pos MUST be hit for 18!
  ai.step(boss, player, 0.9, { stageId: 'yomi' });
  assert.equal(boss.hazard.phase, 'active');
  const hit = ai.step(boss, player, 0.02, { stageId: 'yomi' }).hit;
  assert.equal(hit?.damage, 18);
  // Hit dedup
  assert.equal(ai.step(boss, player, 0.02, { stageId: 'yomi' }).hit, null);

  // Inward escape (to center) & outward escape (past rx) must both be safe
  boss.hazard.hit = false;
  assert.equal(ai.step(boss, { x: z0.x, y: z0.y }, 0.02, { stageId: 'yomi' }).hit, null);
  assert.equal(ai.step(boss, { x: z0.x + z0.rx + 12, y: z0.y }, 0.02, { stageId: 'yomi' }).hit, null);

  // Obstacle-aware center selection avoids blocked core
  const avoided = env.LATE_STAGE_COMBAT.pickEccentricCenter(boss, player, 112, (cx, cy) => cx > player.x + 50);
  assert.ok(avoided.x <= player.x + 50);

  // Half-HP chains 3 lanes: eclipse -> shrinking ring -> fault-line
  delete boss.hazard;
  boss.hp = 600;
  boss.attackCd = 0;
  ai.step(boss, player, 0.02, { stageId: 'yomi' });
  assert.equal(boss.hazard.lanes.length, 3);
  assert.ok(boss.hazard.lanes[1].rx < boss.hazard.lanes[0].rx);
  assert.equal(boss.hazard.lanes[2].art, 'fault-line');
});

test('Boss 差異化 V2：S5～S8 各波次（W1/W2/W3/W4）具備明確招式差異', () => {
  // S5 Kyoto
  const ky = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=hyakki-kyoto' }, stage: 'hyakki-kyoto' }).env;
  const kW1 = { type: 'boss', stageId: 'hyakki-kyoto', hp: 300, max: 300, x: 1000, y: 900, trialBoss: ky.KYOTO_SCENE_ART.bossWave(0) };
  const kW2 = { type: 'boss', stageId: 'hyakki-kyoto', hp: 650, max: 650, x: 1000, y: 900, trialBoss: ky.KYOTO_SCENE_ART.bossWave(1) };
  const kW3 = { type: 'boss', stageId: 'hyakki-kyoto', gatekeeper: true, hp: 1100, max: 1100, x: 1000, y: 900, trialBoss: ky.KYOTO_SCENE_ART.bossWave(2) };
  ky.BOSS_AI.start(kW1, { x: 1200, y: 900 });
  ky.BOSS_AI.start(kW2, { x: 1200, y: 900 });
  ky.BOSS_AI.start(kW3, { x: 1200, y: 900 });
  assert.equal(kW1.hazard.lanes.length, 2);
  assert.equal(kW2.hazard.lanes[0].sync, true);
  assert.equal(kW2.hazard.lanes[0].zones.length, 2); // twin parallel sync lanes
  assert.equal(kW3.hazard.lanes[0].sync, true);
  assert.ok(kW3.hazard.lanes[0].zones[0].rx > kW3.hazard.lanes[0].zones[0].ry && kW3.hazard.lanes[0].zones[1].ry > kW3.hazard.lanes[0].zones[1].rx); // sync cross

  // S6 Snow Temple
  const sn = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=snow-temple' }, stage: 'snow-temple' }).env;
  const sW1 = { type: 'boss', stageId: 'snow-temple', hp: 300, max: 300, x: 1000, y: 900, trialBoss: sn.SNOW_TEMPLE_ART.bossWave(0) };
  const sW3 = { type: 'boss', stageId: 'snow-temple', gatekeeper: true, hp: 1100, max: 1100, x: 1000, y: 900, trialBoss: sn.SNOW_TEMPLE_ART.bossWave(2) };
  sn.BOSS_AI.start(sW1, { x: 1200, y: 900 });
  sn.BOSS_AI.start(sW3, { x: 1200, y: 900 });
  assert.ok(sW1.hazard.lanes[1].inner > 0); // inner burst -> outer ring
  assert.equal(sW3.hazard.lanes.length, 3); // 3 ice pillars

  // S7 Ferry & S8 Yomi
  const late = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=yomi' }, stage: 'yomi' }).env;
  const fW1 = { type: 'boss', stageId: 'spirit-ferry', hp: 300, max: 300, x: 1000, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(0) };
  const fW3 = { type: 'boss', stageId: 'spirit-ferry', gatekeeper: true, hp: 1100, max: 1100, x: 1000, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(2) };
  late.BOSS_AI.start(fW1, { x: 1200, y: 900 });
  late.BOSS_AI.start(fW3, { x: 1200, y: 900 });
  assert.equal(fW1.hazard.lanes.length, 3); // 3 water pillars
  assert.ok(fW3.hazard.lanes[0].rx >= 130 && fW3.hazard.lanes[1].inner > 0); // big bell + outer ring

  const yW1 = { type: 'boss', stageId: 'yomi', hp: 300, max: 300, x: 1000, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('yomi').bossWave(0) };
  const yW3 = { type: 'boss', stageId: 'yomi', gatekeeper: true, hp: 1100, max: 1100, x: 1000, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('yomi').bossWave(2) };
  late.BOSS_AI.start(yW1, { x: 1200, y: 900 });
  late.BOSS_AI.start(yW3, { x: 1200, y: 900 });
  assert.equal(yW1.hazard.lanes[0].round, false); // heavy slash lane, not circle
  assert.equal(yW3.hazard.lanes.length, 4); // 4-point serpent burrow
});

test('多王攻擊錯峰：三王同場不再同幀齊發預警，且任一 Boss 不會被永久餓死', () => {
  const { env } = loadGame({ location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=yomi' }, stage: 'yomi' });
  const player = { x: 1350, y: 900 };
  const art = env.LATE_STAGE_ART.forStage('yomi');
  const trio = [0, 1, 2].map(i => ({
    type: 'boss', stageId: 'yomi', gatekeeper: i === 2, hp: 500, max: 500,
    x: 1200 + i * 50, y: 900, attackCd: 0, trialBoss: art.bossWave(i)
  }));
  let sameFrameMultiStart = 0;
  const castCounts = [0, 0, 0];
  const stagger = { lastTelegraphAt: -99, lastActiveAt: -99 };
  let now = 0;
  for (let f = 0; f < 300; f++) {
    now += 0.02;
    let starts = 0;
    trio.forEach((b, i) => {
      const r = env.BOSS_AI.step(b, player, 0.02, { stageId: 'yomi', now, stagger });
      if (r?.started) { starts++; castCounts[i]++; }
    });
    if (starts >= 2) sameFrameMultiStart++;
  }
  assert.equal(sameFrameMultiStart, 0, 'No two bosses should start telegraphs on the exact same frame');
  assert.ok(castCounts.every(c => c >= 1), `All three bosses must get to cast (got ${castCounts})`);
});
