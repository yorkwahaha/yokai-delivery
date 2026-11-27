const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

test('黃泉第一王四向重斬鎖定貼圖角度，命中矩形不變，第三王仍走圓爆', () => {
  const stage = 'yomi';
  const { env } = loadGame({ stage, location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=yomi' } });
  const art = env.LATE_STAGE_ART.forStage(stage);
  function cast(index, dx, dy) {
    const e = { type:'boss', stageId:stage, trialBoss:art.bossWave(index), gatekeeper:index===2,
      hp:620,max:620,x:1000,y:900 };
    return env.LATE_STAGE_COMBAT.start(e,{x:e.x+dx,y:e.y+dy});
  }
  for (const [dx,dy,angle] of [[150,0,0],[-150,0,Math.PI],[0,150,Math.PI/2],[0,-150,-Math.PI/2]]) {
    const attack = cast(0,dx,dy);
    const {x,y,rx,ry,round,warning,damage,angle:rotation} = attack.lanes[0];
    assert.deepEqual([x,y,rx,ry,round,warning,damage,rotation],
      [1000+dx,900+dy,dy?48:184,dy?184:48,false,1.04,16,angle]);
  }
  const serpent = cast(2,150,0);
  assert.deepEqual(Array.from(serpent.lanes,lane=>[lane.art,lane.round,lane.rx,lane.ry,lane.angle]),[
    ['cinder-burst',true,82,82,undefined],['cinder-burst',true,80,80,undefined],
    ['cinder-burst',true,78,78,undefined],['cinder-burst',true,76,76,undefined]
  ]);
});

test('P1 + B.1 真正的起手與爆發錯峰：四關三王同場、多段追加、冰凍與答題恢復皆確保實際 active 間隔 >= 0.35s 且不縮短預警', () => {
  const configs = [
    {
      stage: 'hyakki-kyoto',
      makeBosses: env => [
        { type: 'boss', stageId: 'hyakki-kyoto', hp: 600, max: 600, x: 900, y: 900, attackCd: 0, trialBoss: env.KYOTO_SCENE_ART.bossWave(0) }, // W1 2-stage
        { type: 'boss', stageId: 'hyakki-kyoto', hp: 600, max: 600, x: 960, y: 900, attackCd: 0, trialBoss: env.KYOTO_SCENE_ART.bossWave(1) }, // W2 sync
        { type: 'boss', stageId: 'hyakki-kyoto', final: true, hp: 300, max: 700, x: 1020, y: 900, attackCd: 0, trialBoss: env.KYOTO_SCENE_ART.bossWave(3) } // W4 half-HP 3-stage
      ]
    },
    {
      stage: 'snow-temple',
      makeBosses: env => [
        { type: 'boss', stageId: 'snow-temple', hp: 600, max: 600, x: 900, y: 900, attackCd: 0, trialBoss: env.SNOW_TEMPLE_ART.bossWave(0) }, // W1 2-stage
        { type: 'boss', stageId: 'snow-temple', gatekeeper: true, hp: 600, max: 600, x: 960, y: 900, attackCd: 0, trialBoss: env.SNOW_TEMPLE_ART.bossWave(2) }, // W3 3-stage
        { type: 'boss', stageId: 'snow-temple', final: true, hp: 300, max: 700, x: 1020, y: 900, attackCd: 0, trialBoss: env.SNOW_TEMPLE_ART.bossWave(3) } // W4 half-HP 3-stage
      ]
    },
    {
      stage: 'spirit-ferry',
      makeBosses: env => [
        { type: 'boss', stageId: 'spirit-ferry', hp: 600, max: 600, x: 900, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(0) }, // W1 3-stage
        { type: 'boss', stageId: 'spirit-ferry', gatekeeper: true, hp: 600, max: 600, x: 960, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(2) }, // W3 2-stage
        { type: 'boss', stageId: 'spirit-ferry', final: true, hp: 300, max: 700, x: 1020, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(3) } // W4 half-HP 3-stage
      ]
    },
    {
      stage: 'yomi',
      makeBosses: env => [
        { type: 'boss', stageId: 'yomi', hp: 600, max: 600, x: 900, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('yomi').bossWave(0) }, // W1 heavy slash
        { type: 'boss', stageId: 'yomi', gatekeeper: true, hp: 600, max: 600, x: 960, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('yomi').bossWave(2) }, // W3 4-stage
        { type: 'boss', stageId: 'yomi', final: true, hp: 300, max: 700, x: 1020, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('yomi').bossWave(3) } // W4 half-HP 3-stage
      ]
    }
  ];

  for (const cfg of configs) {
    const { env } = loadGame({
      location: { hostname: '127.0.0.1', search: `?dev=1&stageLab=1&stage=${cfg.stage}` },
      stage: cfg.stage
    });
    const player = { x: 1100, y: 900 };
    const bosses = cfg.makeBosses(env);
    const stagger = { lastTelegraphAt: -99, lastActiveAt: -99 };
    const startTimes = [];
    const activeTimes = [];
    const castCounts = [0, 0, 0];
    const laneTelStart = new Map();
    const laneMinWarn = new Map();
    let multiStageActives = 0;
    let now = 0;

    for (let f = 0; f < 1200; f++) {
      // Simulate quiz/pause freeze at f=220..280 (1.2s)
      const paused = f >= 220 && f < 280;
      if (!paused) now += 0.02;
      // Simulate boss 0 frozen for 0.6s at f=450..480 so its telegraph aligns with another boss on unfreeze
      bosses[0].freezeT = (!paused && f >= 450 && f < 480) ? 0.5 : 0;

      bosses.forEach((b, i) => {
        const prevPhase = b.hazard?.phase || null;
        const prevIndex = b.hazard?.index ?? -1;
        const res = env.BOSS_AI.step(b, player, 0.02, { stageId: cfg.stage, now, stagger, paused });
        const curPhase = b.hazard?.phase || null;
        const curIndex = b.hazard?.index ?? -1;

        if (res?.started) {
          assert.equal(paused, false, `${cfg.stage}: must not start telegraph while paused`);
          startTimes.push({ t: now, boss: i });
          castCounts[i]++;
        }
        // Track every lane's telegraph start (lane 0 or follow-up lanes 1..3)
        if (curPhase === 'telegraph' && (prevPhase !== 'telegraph' || prevIndex !== curIndex)) {
          laneTelStart.set(i, now);
          const expectedWarn = b.hazard.lanes[curIndex]?.warning ?? 0.68;
          laneMinWarn.set(i, expectedWarn);
        }
        // Track every ACTUAL telegraph -> active transition (all lanes!)
        if (prevPhase === 'telegraph' && curPhase === 'active') {
          assert.equal(paused, false, `${cfg.stage}: must not detonate while paused`);
          const telDur = now - (laneTelStart.get(i) ?? now);
          const minWarn = laneMinWarn.get(i) ?? 0.65;
          assert.ok(telDur >= minWarn - 0.03,
            `${cfg.stage} B${i} lane ${curIndex}: telegraph shortened to ${telDur.toFixed(3)}s (< ${minWarn}s)`);
          activeTimes.push({ t: now, boss: i, lane: curIndex });
          if (curIndex >= 1) multiStageActives++;
        }
      });
    }

    assert.ok(startTimes.length >= 6, `${cfg.stage}: expected >= 6 casts, got ${startTimes.length}`);
    assert.ok(activeTimes.length >= 10, `${cfg.stage}: expected >= 10 actual active bursts, got ${activeTimes.length}`);
    assert.ok(multiStageActives >= 4, `${cfg.stage}: must exercise multi-stage follow-up bursts, got ${multiStageActives}`);

    // Verify initial cast stagger >= 0.75s
    for (let k = 1; k < startTimes.length; k++) {
      const gap = startTimes[k].t - startTimes[k - 1].t;
      assert.ok(gap >= 0.74, `${cfg.stage}: initial telegraph gap ${gap.toFixed(3)}s < 0.75s`);
    }
    // Verify EVERY actual active transition across all bosses & follow-up lanes is >= 0.35s apart!
    for (let k = 1; k < activeTimes.length; k++) {
      const gap = activeTimes[k].t - activeTimes[k - 1].t;
      assert.ok(gap >= 0.34,
        `${cfg.stage}: actual active gap between B${activeTimes[k - 1].boss}(L${activeTimes[k - 1].lane}) and B${activeTimes[k].boss}(L${activeTimes[k].lane}) was ${gap.toFixed(3)}s (< 0.35s)`);
    }
    assert.ok(castCounts.every(c => c >= 2), `${cfg.stage}: every boss must cast >= 2 times, got ${castCounts}`);
    assert.equal('owner' in stagger, false, `${cfg.stage}: stagger must not hold boss object reference`);
  }
});

test('同步多區攻擊：S5 W2/W3、S7 W2、S8 W2 同時預警爆發、重疊交點僅扣血一次且保留明確安全逃生區', () => {
  const ky = loadGame({
    location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=hyakki-kyoto' },
    stage: 'hyakki-kyoto'
  }).env;
  const p = { x: 1000, y: 900 };
  const kW2 = { type: 'boss', stageId: 'hyakki-kyoto', hp: 650, max: 650, x: 850, y: 900, trialBoss: ky.KYOTO_SCENE_ART.bossWave(1) };
  ky.BOSS_AI.start(kW2, p);
  const kW2Lane = kW2.hazard.lanes[0];
  assert.equal(kW2Lane.sync, true);
  assert.equal(kW2Lane.zones.length, 2);
  ky.BOSS_AI.step(kW2, p, 1.15, { stageId: 'hyakki-kyoto', now: 1.15, stagger: { lastTelegraphAt: 0, lastActiveAt: -99 } });
  assert.equal(kW2.hazard.phase, 'active');
  assert.ok(ky.BOSS_AI.step(kW2, p, 0.02, { stageId: 'hyakki-kyoto', now: 1.17 }).hit);
  kW2.hazard.hit = false;
  assert.equal(ky.BOSS_AI.step(kW2, { x: p.x, y: p.y + 58 }, 0.02, { stageId: 'hyakki-kyoto', now: 1.19 }).hit, null);
  assert.ok(ky.BOSS_AI.step(kW2, { x: p.x, y: p.y + 116 }, 0.02, { stageId: 'hyakki-kyoto', now: 1.21 }).hit);

  const kW3 = { type: 'boss', stageId: 'hyakki-kyoto', gatekeeper: true, hp: 1100, max: 1100, x: 850, y: 900, trialBoss: ky.KYOTO_SCENE_ART.bossWave(2) };
  ky.BOSS_AI.start(kW3, p);
  assert.equal(kW3.hazard.lanes[0].sync, true);
  assert.equal(kW3.hazard.lanes[0].zones.length, 2);
  ky.BOSS_AI.step(kW3, p, 1.2, { stageId: 'hyakki-kyoto', now: 1.2 });
  assert.ok(ky.BOSS_AI.step(kW3, p, 0.02, { stageId: 'hyakki-kyoto', now: 1.22 }).hit);
  assert.equal(ky.BOSS_AI.step(kW3, p, 0.02, { stageId: 'hyakki-kyoto', now: 1.24 }).hit, null);
  kW3.hazard.hit = false;
  assert.equal(ky.BOSS_AI.step(kW3, { x: p.x + 80, y: p.y + 80 }, 0.02, { stageId: 'hyakki-kyoto', now: 1.26 }).hit, null);

  const late = loadGame({
    location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=yomi' },
    stage: 'yomi'
  }).env;
  const fW2 = { type: 'boss', stageId: 'spirit-ferry', hp: 650, max: 650, x: 850, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(1) };
  late.BOSS_AI.start(fW2, p);
  assert.equal(fW2.hazard.lanes[0].sync, true);
  assert.equal(fW2.hazard.lanes[0].zones.length, 2);
  late.BOSS_AI.step(fW2, p, 1.2, { stageId: 'spirit-ferry', now: 1.2 });
  assert.ok(late.BOSS_AI.step(fW2, p, 0.02, { stageId: 'spirit-ferry', now: 1.22 }).hit);
  fW2.hazard.hit = false;
  assert.equal(late.BOSS_AI.step(fW2, { x: p.x, y: p.y + 61 }, 0.02, { stageId: 'spirit-ferry', now: 1.24 }).hit, null);
  assert.ok(late.BOSS_AI.step(fW2, { x: p.x, y: p.y + 122 }, 0.02, { stageId: 'spirit-ferry', now: 1.26 }).hit);

  const yW2 = { type: 'boss', stageId: 'yomi', hp: 650, max: 650, x: 850, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('yomi').bossWave(1) };
  late.BOSS_AI.start(yW2, p);
  assert.equal(yW2.hazard.lanes[0].sync, true);
  assert.equal(yW2.hazard.lanes[0].zones.length, 2);
  late.BOSS_AI.step(yW2, p, 1.2, { stageId: 'yomi', now: 1.2 });
  assert.ok(late.BOSS_AI.step(yW2, p, 0.02, { stageId: 'yomi', now: 1.22 }).hit);
  assert.equal(late.BOSS_AI.step(yW2, p, 0.02, { stageId: 'yomi', now: 1.24 }).hit, null);
  yW2.hazard.hit = false;
  assert.equal(late.BOSS_AI.step(yW2, { x: p.x + 88, y: p.y + 88 }, 0.02, { stageId: 'yomi', now: 1.26 }).hit, null);

  // Verify real RENDERER.drawStageLabHazard draws all sync sub-zones + high-contrast S7 borders
  let drawImageCalls = 0;
  let strokeRectCalls = 0;
  const fakeCtx = {
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, rect() {}, arc() {}, clip() {},
    drawImage() { drawImageCalls++; }, stroke() {}, strokeRect() { strokeRectCalls++; },
    setTransform() {}, clearRect() {}, fillRect() {}, scale() {},
    set globalAlpha(v) {}, get globalAlpha() { return 1; },
    set strokeStyle(v) {}, set lineWidth(v) {}, set lineJoin(v) {}, set fillStyle(v) {}, set imageSmoothingEnabled(v) {}, set imageSmoothingQuality(v) {}
  };
  const fakeCanvas = { getContext: () => fakeCtx, width: 900, height: 600, style: {} };
  const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'renderer.js'), 'utf8');
  const rWin = {
    devicePixelRatio: 1, innerWidth: 900, innerHeight: 600,
    document: { createElement: () => fakeCanvas },
    matchMedia: () => ({ matches: false })
  };
  rWin.window = rWin;
  vm.runInNewContext(rendererSrc, rWin);
  rWin.RENDERER.init(fakeCanvas);
  const fW2Render = { type: 'boss', stageId: 'spirit-ferry', hp: 650, max: 650, x: 850, y: 900, trialBoss: late.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(1) };
  late.BOSS_AI.start(fW2Render, p);
  rWin.RENDERER.drawStageLabHazard(fW2Render.hazard, { complete: true, naturalWidth: 128, naturalHeight: 128, width: 128, height: 128 });
  assert.equal(drawImageCalls, 2, 'drawStageLabHazard must draw both sync sub-zones');
  assert.equal(strokeRectCalls, 4, 'S7 spirit-tide telegraph must draw high-contrast outer strokes on both zones');
});

test('B.1 赤月環安全替代招式：狹巷改出經驗證可逃生之裂線、真全封死時取消／延後施法、半血追加段亦檢查當下地形', () => {
  const { env } = loadGame({
    location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=yomi' },
    stage: 'yomi'
  });
  const player = { x: 1350, y: 900 };
  const mkBoss = (hp = 1400) => ({
    type: 'boss', stageId: 'yomi', final: true, hp, max: 1400,
    x: 1150, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('yomi').bossWave(3)
  });

  // Case A: Tight 20px pocket (ALL escape routes blocked) -> MUST cancel/defer cast, NEVER drop inescapable circle!
  const pocketBlocked = (cx, cy) => Math.hypot(cx - player.x, cy - player.y) > 20;
  const bPocket = mkBoss(1400);
  const stepPocket = env.BOSS_AI.step(bPocket, player, 0.02, { stageId: 'yomi', now: 0.02, blocked: pocketBlocked });
  assert.equal(stepPocket.started, false, 'Must NOT start attack when player has zero escape routes');
  assert.equal(stepPocket.deferred, true, 'Must explicitly defer cast when completely boxed in');
  assert.equal(bPocket.hazard, undefined, 'No hazard should be created when boxed in');
  assert.ok(bPocket.attackCd > 0, 'Deferred boss should wait briefly before retrying');

  // Case B: Tight vertical pocket (horizontal blocked > 30px, vertical open up to 64px -> eccentric ring outStep=66px fails,
  //         horizontal fault-line ry=36 only needs 60px vertical escape -> VERIFIED ESCAPABLE!)
  const alleyBlocked = (cx, cy) => Math.abs(cx - player.x) > 30 || Math.abs(cy - player.y) > 64;
  assert.equal(env.LATE_STAGE_COMBAT.pickEccentricCenter(mkBoss(), player, 112, alleyBlocked).fallback, true);
  const bAlley = mkBoss(1400);
  const stepAlley = env.BOSS_AI.step(bAlley, player, 0.02, { stageId: 'yomi', now: 0.02, blocked: alleyBlocked });
  assert.equal(stepAlley.started, true, 'Verified safe alternative fault-line should cast in narrow alley');
  assert.equal(bAlley.hazard.lanes[0].art, 'fault-line');
  assert.equal(bAlley.hazard.lanes[0].ry, 36);
  // Prove player walking at 190 px/s vertically actually escapes the alternative attack!
  const pw = { x: player.x, y: player.y };
  let gotHit = false;
  for (let f = 0; f < 90; f++) {
    const r = env.BOSS_AI.step(bAlley, pw, 0.02, { stageId: 'yomi', now: 0.04 + f * 0.02, blocked: alleyBlocked });
    if (bAlley.hazard?.phase === 'telegraph') {
      const ny = pw.y - 190 * 0.02;
      if (!alleyBlocked(pw.x, ny)) pw.y = ny;
    }
    if (r?.hit) gotHit = true;
  }
  assert.equal(gotHit, false, 'Player walking at 190 px/s must cleanly escape the verified alternative attack');

  // Case C: Half-HP follow-up lanes check live terrain when advancing -> if player is trapped in pocket on lane 1/2, skip unsafe follow-up
  const bHalf = mkBoss(500);
  env.BOSS_AI.start(bHalf, player, { stageId: 'yomi' }); // open terrain at start -> 3 lanes
  assert.equal(bHalf.hazard.lanes.length, 3);
  // Advance lane 0 through telegraph -> active -> recovery, then clamp terrain to pocket before lane 1
  env.BOSS_AI.step(bHalf, player, 1.40, { stageId: 'yomi', now: 1.40 });
  env.BOSS_AI.step(bHalf, player, 0.36, { stageId: 'yomi', now: 1.76 });
  // Now player is boxed into pocket on recovery end -> unsafe shrinking ring & fault-line must be skipped!
  const fin = env.BOSS_AI.step(bHalf, player, 0.60, { stageId: 'yomi', now: 2.36, blocked: pocketBlocked });
  assert.equal(fin.finished, true, 'Unsafe half-HP follow-ups must be skipped when live terrain boxes player in');
  assert.equal(bHalf.hazard, undefined);
});

test('S7 W3 沉鐘鬼將泥濘減速：爆發時產生 2.5 秒泥濘區，與本體減速／衝刺／暫停規則一致', () => {
  const { env } = loadGame({
    location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=spirit-ferry' },
    stage: 'spirit-ferry'
  });
  const player = { x: 1000, y: 900 };
  const boss = {
    type: 'boss', stageId: 'spirit-ferry', gatekeeper: true, hp: 1100, max: 1100,
    x: 860, y: 900, attackCd: 0, trialBoss: env.LATE_STAGE_ART.forStage('spirit-ferry').bossWave(2)
  };
  env.BOSS_AI.step(boss, player, 0.02, { stageId: 'spirit-ferry', now: 0.02 });
  assert.equal(boss.hazard.phase, 'telegraph');
  const stepped = env.BOSS_AI.step(boss, player, 1.2, { stageId: 'spirit-ferry', now: 1.22 });
  assert.equal(boss.hazard.phase, 'active');
  assert.ok(stepped.mudZone, 'S7 W3 active burst must emit mudZone');
  assert.equal(stepped.mudZone.r, 122);
  assert.equal(stepped.mudZone.maxLife, 2.5);
  assert.equal(stepped.mudZone.life, 2.5);
  const next = env.BOSS_AI.step(boss, player, 0.02, { stageId: 'spirit-ferry', now: 1.24 });
  assert.equal(next.mudZone, null);
});

test('B.1 真實遊戲 update() 主迴圈整合：驗證多王實戰錯峰、暫停／離關清理與重玩重置', () => {
  const g = loadGame({
    location: { hostname: '127.0.0.1', search: '?dev=1&stageLab=1&stage=spirit-ferry' },
    stage: 'spirit-ferry'
  });
  g.start('spirit-ferry');
  g.stopSpawns();
  g.clearOrders();
  g.clearSolids();
  g.setInvulnerability(60);

  // Spawn 2 real bosses through the actual bossSchedule & update() pipeline
  g.forceBossSchedule(0);
  for (let n = 0; n < 16 && g.snapshot().enemies.filter(e => e.type === 'boss').length < 1; n++) g.update(0.05);
  g.forceBossSchedule(2);
  for (let n = 0; n < 16 && g.snapshot().enemies.filter(e => e.type === 'boss').length < 2; n++) g.update(0.05);

  const bosses = g.snapshot().enemies.filter(e => e.type === 'boss');
  assert.equal(bosses.length, 2, 'Two real bosses must spawn via bossSchedule');
  const p = g.snapshot();
  bosses.forEach((b, idx) => {
    b.x = p.x + (idx === 0 ? -140 : 140);
    b.y = p.y;
    b.shield = false;
    b.revealT = 0;
    b.attackCd = 0;
  });

  const activeTimes = [];
  const startTimes = [];
  const prev = [null, null];

  for (let f = 0; f < 360; f++) {
    // Pause for 0.6s in the middle via real state machine to verify pause freeze
    if (f === 120) g.setState('pause');
    if (f === 150) g.setState('play');
    g.update(0.02);
    const snap = g.snapshot();
    const t = snap.elapsed;
    bosses.forEach((b, idx) => {
      const cur = b.hazard?.phase || null;
      if (prev[idx] === null && cur === 'telegraph') startTimes.push({ t, boss: idx });
      if (prev[idx] === 'telegraph' && cur === 'active') activeTimes.push({ t, boss: idx });
      prev[idx] = cur;
    });
  }

  assert.ok(startTimes.length >= 2, `Real game update() must start >= 2 boss telegraphs, got ${startTimes.length}`);
  assert.ok(activeTimes.length >= 2, `Real game update() must execute >= 2 actual active bursts, got ${activeTimes.length}`);
  for (let k = 1; k < startTimes.length; k++) {
    const gap = startTimes[k].t - startTimes[k - 1].t;
    assert.ok(gap >= 0.74, `Real game update() telegraph gap ${gap.toFixed(3)}s < 0.75s`);
  }
  for (let k = 1; k < activeTimes.length; k++) {
    const gap = activeTimes[k].t - activeTimes[k - 1].t;
    assert.ok(gap >= 0.34, `Real game update() actual active gap ${gap.toFixed(3)}s < 0.35s`);
  }

  // Verify replay start() resets stagger cleanly so a new boss casts immediately
  g.start('spirit-ferry');
  g.stopSpawns();
  g.clearOrders();
  g.clearSolids();
  g.forceBossSchedule(0);
  for (let n = 0; n < 16 && g.snapshot().enemies.filter(e => e.type === 'boss').length < 1; n++) g.update(0.05);
  const fresh = g.snapshot().enemies.find(e => e.type === 'boss');
  const p2 = g.snapshot();
  fresh.x = p2.x - 140;
  fresh.y = p2.y;
  fresh.shield = false;
  fresh.revealT = 0;
  fresh.attackCd = 0;
  g.update(0.02);
  assert.equal(fresh.hazard?.phase, 'telegraph', 'Fresh boss after replay start() must cast immediately with reset stagger');
});
