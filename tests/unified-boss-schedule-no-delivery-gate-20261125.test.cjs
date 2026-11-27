'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadGame } = require('./helpers/game-runtime.cjs');

const PUBLIC_STAGES = ['night-town', 'rain-port', 'sakura-pass', 'bamboo-maze'];
const DEV_STAGES = ['hyakki-kyoto', 'snow-temple', 'spirit-ferry', 'yomi'];
const ALL_STAGES = [...PUBLIC_STAGES, ...DEV_STAGES];
const WAVE_TIMES = [180, 360, 480, 540];

const liveOfficialBosses = game =>
  Array.from(game.snapshot().enemies.filter(
    e => e.type === 'boss' && e.hp > 0 && !e.dying && !e.isClone && !e.clone && !e.isSummon && !e.summon && e.officialWaveBoss !== false
  ));
const liveWaves = game => liveOfficialBosses(game).map(e => e.bossIndex).sort((a, b) => a - b);

function bootStage(stage, seed = 4201) {
  const isDevStage = DEV_STAGES.includes(stage);
  const game = loadGame({
    stage,
    seed,
    location: isDevStage
      ? { hostname: '127.0.0.1', search: `?dev=1&stageLab=1&stage=${stage}` }
      : { hostname: '127.0.0.1', search: `?dev=1&s3play=1&stage=${stage}` }
  });
  game.start(stage);
  game.stopSpawns();
  game.clearOrders();
  return game;
}

function reachWave(game, index, expectSpawn = true) {
  game.setElapsed(WAVE_TIMES[index] - 0.025);
  game.update(0.05);
  if (!expectSpawn) return;
  for (let tries = 0; tries < 24 && !game.bossScheduleSnapshot().spawned.includes(index); tries++) {
    // Only retry if the wave is eligible (e.g., rain-port narrow belt random angle retry).
    if (index === 3 && game.bossScheduleSnapshot().defeated.length === 0) break;
    game.update(0.05);
  }
}

function defeatWave(game, index) {
  const boss = liveOfficialBosses(game).find(e => e.bossIndex === index);
  assert.ok(boss, `wave ${index + 1} should be alive before defeat`);
  boss.shield = false;
  game.hurt(boss, boss.hp);
}

function completeDeliveries(game, count) {
  for (let i = 0; i < count; i++) {
    game.waitLevelUpCooldown();
    game.resolveLevelUps();
    assert.equal(game.prepareOrder(), true, `order ${i + 1} should be creatable`);
    game.atDestination();
    game.update(0.05);
    const order = game.snapshot().job;
    assert.ok(order && order.ans.includes(order.word), `order ${i + 1} has valid answer`);
    game.resolve(order.ans.indexOf(order.word));
    game.update(0.05);
    game.waitLevelUpCooldown();
    game.resolveLevelUps();
  }
  assert.equal(game.snapshot().delivered, count);
  assert.equal(game.snapshot().state, 'play');
}

test('前四關正常四王依序出場，零單即可正常通關並解鎖進度', () => {
  for (const [idx, stage] of PUBLIC_STAGES.entries()) {
    const game = bootStage(stage, 5100 + idx);
    for (let i = 0; i < 4; i++) {
      game.setElapsed(WAVE_TIMES[i] - 0.1);
      game.update(0.05);
      assert.deepEqual(liveWaves(game), [], `${stage} wave ${i + 1} must not spawn early`);
      reachWave(game, i);
      assert.deepEqual(liveWaves(game), [i], `${stage} wave ${i + 1} spawns on time`);
      defeatWave(game, i);
      if (i < 3) assert.equal(game.snapshot().state, 'play', `${stage} must not win after ${i + 1} bosses`);
    }
    assert.equal(game.snapshot().delivered, 0);
    assert.equal(game.snapshot().state, 'victory', `${stage} should enter victory with 0 deliveries after all 4 bosses`);
    for (let frame = 0; game.snapshot().state === 'victory' && frame < 300; frame++) game.stepFrame(50);
    assert.equal(game.snapshot().state, 'won', `${stage} settles to won`);
    assert.equal(game.store().isStageCompleted(stage), true, `${stage} records completion at 0 deliveries`);
  }
});

test('前四關前三王同場、尾王無逾時等待，依不同前王擊殺順序補位且僅生成一次', () => {
  for (const [idx, stage] of PUBLIC_STAGES.entries()) {
    const firstDefeat = idx % 3;
    const game = bootStage(stage, 5200 + idx);
    for (let i = 0; i < 3; i++) {
      reachWave(game, i);
      assert.deepEqual(liveWaves(game), [0, 1, 2].slice(0, i + 1), `${stage} waves 1..${i + 1} coexist`);
    }
    reachWave(game, 3);
    assert.deepEqual(liveWaves(game), [0, 1, 2], `${stage} caps live official bosses at 3 and holds final boss`);
    game.setElapsed(720);
    for (let t = 0; t < 4; t++) game.update(0.05);
    assert.deepEqual(liveWaves(game), [0, 1, 2], `${stage} never timeout-skips or forces final boss`);

    defeatWave(game, firstDefeat);
    for (let tries = 0; tries < 24 && !game.bossScheduleSnapshot().spawned.includes(3); tries++) {
      game.update(0.05);
    }
    const expectedAfterSlot = [0, 1, 2, 3].filter(w => w !== firstDefeat);
    assert.deepEqual(liveWaves(game), expectedAfterSlot, `${stage} spawns wave 4 after wave ${firstDefeat + 1} dies`);
    for (let t = 0; t < 5; t++) game.update(0.05);
    assert.deepEqual(liveWaves(game), expectedAfterSlot, `${stage} spawns wave 4 only once`);
  }
});

test('同幀多王死亡與尾王先死：僅補一王，四王未全倒不得提前勝利，全倒後通關', () => {
  for (const [idx, stage] of ['night-town', 'rain-port', 'sakura-pass'].entries()) {
    const game = bootStage(stage, 5300 + idx);
    reachWave(game, 2);
    assert.deepEqual(liveWaves(game), [0, 1, 2]);

    // Kill wave 0 and wave 2 on the exact same frame as 540s arrives
    game.setElapsed(WAVE_TIMES[3] - 0.025);
    const { x, y } = game.snapshot();
    const [first, , third] = liveOfficialBosses(game).sort((a, b) => a.bossIndex - b.bossIndex);
    Object.assign(first, { x: x + 60, y, shield: false, hp: 1 });
    Object.assign(third, { x: x + 75, y, shield: false, hp: 1 });
    game.setFacingAngle(0);
    game.armWeapons();
    game.update(0.05);
    for (let tries = 0; tries < 24 && !game.bossScheduleSnapshot().spawned.includes(3); tries++) {
      game.update(0.05);
    }
    assert.deepEqual(liveWaves(game), [1, 3], `${stage} same-frame double kill spawns wave 4 once`);
    game.snapshot().gems.length = 0;

    // Defeat final boss FIRST while wave 2 is still alive
    defeatWave(game, 3);
    game.update(0.05);
    assert.equal(game.snapshot().finalBossDefeated, true);
    assert.equal(game.snapshot().state, 'play', `${stage} must not win when wave 2 still lives`);
    assert.deepEqual(liveWaves(game), [1]);

    // Defeat last surviving boss -> victory immediately
    defeatWave(game, 1);
    game.update(0.05);
    assert.equal(game.snapshot().state, 'victory', `${stage} wins once all 4 bosses are defeated`);
  }
});

test('零單、一單、五單與六單以上皆可正常通關，配送獎勵與統計保留', () => {
  for (const [idx, deliveries] of [0, 1, 5, 6, 8].entries()) {
    const stage = PUBLIC_STAGES[idx % PUBLIC_STAGES.length];
    const game = bootStage(stage, 5400 + idx);
    if (deliveries > 0) completeDeliveries(game, deliveries);
    const oilBeforeBoss = game.snapshot().oil;
    assert.ok(oilBeforeBoss > 0);

    for (let i = 0; i < 4; i++) {
      reachWave(game, i);
      defeatWave(game, i);
    }
    assert.equal(game.snapshot().delivered, deliveries);
    assert.equal(game.snapshot().state, 'victory', `${stage} wins with ${deliveries} deliveries`);
    for (let frame = 0; game.snapshot().state === 'victory' && frame < 300; frame++) game.stepFrame(50);
    assert.equal(game.snapshot().state, 'won');
    assert.equal(game.store().getStageStats(stage).bestDeliveries, deliveries);
  }
});

test('四王未全倒時即使完成超過六單與破曉仍不得勝利；燈油耗盡仍然失敗', () => {
  const game = bootStage('rain-port', 5501);
  completeDeliveries(game, 7);
  reachWave(game, 0);
  defeatWave(game, 0);
  reachWave(game, 1);
  reachWave(game, 2);
  reachWave(game, 3);
  defeatWave(game, 3); // final dead, waves 1 and 2 still alive
  game.setElapsed(620);
  game.update(0.05);
  assert.equal(game.snapshot().state, 'play', 'must not win while earlier waves remain alive');

  game.setOil(0);
  game.update(0.05);
  assert.equal(game.snapshot().state, 'lampout', 'lamp-out must still fail when bosses remain');
});

test('封印答題與擊殺回油在多王同場時維持正常且不重複發放', () => {
  const game = bootStage('sakura-pass', 5601);
  reachWave(game, 2);
  const bosses = liveOfficialBosses(game).sort((a, b) => a.bossIndex - b.bossIndex);
  assert.equal(bosses.length, 3);
  assert.equal(new Set(bosses.map(b => b.word.jp)).size, 3, 'three live bosses get distinct seal words');

  const second = bosses[1];
  game.placeAt(second.x, second.y);
  game.update(0.05);
  const quiz = game.snapshot().bossQ;
  assert.equal(quiz, second.quiz);
  game.setOil(15);
  game.hurt(second, second.hp);
  assert.equal(game.snapshot().oil, 15, 'shielded boss blocks damage and oil reward');

  game.unlockBoss();
  game.answerBoss(quiz.ans.indexOf(quiz.word));
  assert.deepEqual(bosses.map(b => b.shield), [true, false, true], 'only answered boss unseals');

  game.hurt(second, second.hp);
  assert.equal(game.snapshot().oil, 50, 'unsealed wave 2 kill grants 35 oil');
  game.hurt(second, 100);
  assert.equal(game.snapshot().oil, 50, 'dead boss cannot grant oil twice');
});

test('Boss 分身與召喚物不計入正式波次上限、不解鎖尾王、也不觸發通關', () => {
  const game = bootStage('night-town', 5701);
  reachWave(game, 1); // waves 0 and 1 alive
  assert.deepEqual(liveWaves(game), [0, 1]);

  // Inject a boss clone and a boss summon
  const clone = {
    x: game.snapshot().x + 160, y: game.snapshot().y,
    type: 'boss', bossIndex: 0, isClone: true, officialWaveBoss: false,
    final: true, shield: false, hp: 10, max: 10, speed: 0, flash: 0, wob: 0
  };
  const summon = {
    x: game.snapshot().x + 200, y: game.snapshot().y,
    type: 'boss', bossIndex: 2, isSummon: true, officialWaveBoss: false,
    shield: false, hp: 10, max: 10, speed: 0, flash: 0, wob: 0
  };
  game.snapshot().enemies.push(clone, summon);

  // Wave 2 MUST still spawn despite clone + summon being on the field
  reachWave(game, 2);
  assert.deepEqual(liveWaves(game), [0, 1, 2], 'clones/summons do not consume official boss cap');

  // Killing the clone (even marked final: true) must NOT unlock wave 4 or set finalBossDefeated
  game.hurt(clone, 100);
  game.hurt(summon, 100);
  reachWave(game, 3);
  assert.equal(game.snapshot().finalBossDefeated, false, 'killing a clone cannot set finalBossDefeated');
  assert.deepEqual(liveWaves(game), [0, 1, 2], 'killing clones/summons cannot unlock wave 4');
});

test('找不到合法生成位置時保留該波次並重試，不跳號', () => {
  const game = bootStage('night-town', 5801);
  // Block entire map around player so spawnPosition returns null
  const { x, y } = game.snapshot();
  game.worldSolids().push({ x0: x - 3000, y0: y - 3000, x1: x + 3000, y1: y + 3000 });
  reachWave(game, 0, false);
  assert.deepEqual(liveWaves(game), [], 'blocked spawn cannot create wave 1');
  assert.equal(game.bossScheduleSnapshot().spawned.length, 0, 'wave 1 remains unspawned');
  assert.equal(game.snapshot().bossStage, 0, 'wave 1 is not skipped');

  // Remove obstruction -> wave 1 retries and spawns cleanly
  game.clearSolids();
  game.update(0.05);
  assert.deepEqual(liveWaves(game), [0], 'wave 1 retries and spawns once space opens');
});

test('重開遊戲後排程完全重置，上局擊殺不污染新局', () => {
  const game = bootStage('rain-port', 5901);
  for (let i = 0; i < 4; i++) {
    reachWave(game, i);
    defeatWave(game, i);
  }
  assert.equal(game.snapshot().state, 'victory');

  game.start('rain-port');
  game.stopSpawns();
  game.clearOrders();
  const snap = game.snapshot();
  const sched = game.bossScheduleSnapshot();
  assert.equal(snap.state, 'play');
  assert.equal(snap.elapsed, 0);
  assert.equal(snap.bossStage, 0);
  assert.equal(snap.bossT, 180);
  assert.equal(snap.finalBossDefeated, false);
  assert.deepEqual(Array.from(sched.spawned), []);
  assert.deepEqual(Array.from(sched.defeated), []);

  reachWave(game, 2);
  reachWave(game, 3, false);
  assert.deepEqual(liveWaves(game), [0, 1, 2], 'prior run kills must not unlock wave 4 after restart');
});

test('DEV 第五至八關共用四王排程與零單通關相容', () => {
  for (const [idx, stage] of DEV_STAGES.entries()) {
    const game = bootStage(stage, 6000 + idx);
    reachWave(game, 2);
    assert.deepEqual(liveWaves(game), [0, 1, 2], `${stage} spawns waves 1-3 concurrently`);
    reachWave(game, 3);
    assert.deepEqual(liveWaves(game), [0, 1, 2], `${stage} holds wave 4 while waves 1-3 all live`);
    defeatWave(game, 1);
    game.update(0.05);
    assert.deepEqual(liveWaves(game), [0, 2, 3], `${stage} spawns wave 4 after one prior defeat`);
    defeatWave(game, 3);
    assert.equal(game.snapshot().state, 'play', `${stage} waits for remaining earlier bosses`);
    defeatWave(game, 0);
    defeatWave(game, 2);
    game.update(0.05);
    assert.equal(game.snapshot().delivered, 0);
    assert.equal(game.snapshot().state, 'victory', `${stage} wins at 0 deliveries once all 4 bosses fall`);
  }
});

test('共用排程支援未來關卡擴充介面（custom policy）且教學文案無六單殘留', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/game-combat-math.js', 'utf8'), ctx);
  const custom = ctx.window.GAME_COMBAT_MATH.createBossSchedule({
    stageId: 'future-stage',
    times: [60, 120],
    policy: {
      canSpawnWave: ({ index, defeated }) => ({ eligible: index === 0 || defeated.has(0), reason: 'custom-seq' }),
      isComplete: ({ defeated }) => defeated.has(1)
    }
  });
  assert.equal(custom.nextSpawnCandidate(120, []).index, 0);
  custom.markSpawned(0);
  assert.equal(custom.nextSpawnCandidate(120, []).eligible, false);
  custom.recordDefeat({ type: 'boss', bossIndex: 0 });
  assert.equal(custom.nextSpawnCandidate(120, []).index, 1);
  custom.markSpawned(1);
  custom.recordDefeat({ type: 'boss', bossIndex: 1 });
  assert.equal(custom.isComplete(), true);

  const uiSrc = fs.readFileSync('js/ui.js', 'utf8');
  assert.doesNotMatch(uiSrc, /雨港通關還須至少六件配送/);
  assert.doesNotMatch(uiSrc, /各關皆須送達指定件數並擊敗終王/);
  assert.doesNotMatch(uiSrc, /擊敗終王後仍須完成當關配送目標/);
});

function spawnAllFourWithOrder(game, order) {
  reachWave(game, 2);
  const firstThree = liveOfficialBosses(game).sort((a, b) => a.bossIndex - b.bossIndex);
  assert.equal(firstThree.length, 3);
  // Place each wave at distinct coordinates outside reading radius (>420px)
  // so safeRead does not pause elapsed while advancing waves.
  const base = { x: game.snapshot().x, y: game.snapshot().y };
  const coords = {
    0: { x: base.x + 520, y: base.y - 140 },
    1: { x: base.x - 540, y: base.y + 160 },
    2: { x: base.x + 580, y: base.y + 190 },
    3: { x: base.x - 610, y: base.y - 210 }
  };
  for (const b of firstThree) Object.assign(b, coords[b.bossIndex]);

  const titles = {};
  for (const b of firstThree) titles[b.bossIndex] = b.title;

  let wave4Spawned = false;
  for (const waveIdx of order) {
    if (waveIdx === 3 && !wave4Spawned) {
      reachWave(game, 3);
      for (let tries = 0; tries < 24 && !game.bossScheduleSnapshot().spawned.includes(3); tries++) {
        game.update(0.05);
      }
      const w4 = liveOfficialBosses(game).find(e => e.bossIndex === 3);
      assert.ok(w4, 'wave 4 should spawn once a prior boss is defeated');
      Object.assign(w4, coords[3]);
      titles[3] = w4.title;
      wave4Spawned = true;
    }
    const target = liveOfficialBosses(game).find(e => e.bossIndex === waveIdx);
    assert.ok(target, `wave ${waveIdx + 1} should be alive`);
    Object.assign(target, coords[waveIdx]);
    target.shield = false;
    game.hurt(target, target.hp);
    if (!wave4Spawned && game.snapshot().elapsed < WAVE_TIMES[3]) {
      // Wait to spawn wave 4 until requested in order (or when 540s is reached)
    }
  }
  return { coords, titles };
}

test('勝利演出：尾王正常最後死亡（1→2→3→4）保留尾王外觀、座標與專屬死亡音效', () => {
  for (const [idx, stage] of PUBLIC_STAGES.entries()) {
    const game = bootStage(stage, 6100 + idx);
    game.audioCalls.length = 0;
    const { coords, titles } = spawnAllFourWithOrder(game, [0, 1, 2, 3]);
    const snap = game.snapshot();
    assert.equal(snap.state, 'victory', `${stage} enters victory`);
    assert.ok(snap.victorySeq && snap.victorySeq.boss, `${stage} creates victory clone`);
    assert.equal(snap.victorySeq.boss.bossIndex, 3, `${stage} victory clone is wave 4`);
    assert.equal(snap.victorySeq.boss.final, true);
    assert.equal(snap.victorySeq.boss.title, titles[3]);
    assert.equal(snap.victorySeq.bossX, coords[3].x);
    assert.equal(snap.victorySeq.bossY, coords[3].y);
    assert.equal(snap.victorySeq.boss.x, coords[3].x);
    assert.equal(snap.victorySeq.boss.y, coords[3].y);

    const beforeSeqFinalSfx = game.audioCalls.filter(c => c === 'finalBossDeath').length;
    assert.equal(beforeSeqFinalSfx, 1, `${stage} finalBossDeath fires once on wave 4 kill`);

    for (let f = 0; game.snapshot().state === 'victory' && f < 300; f++) game.stepFrame(50);
    assert.equal(game.snapshot().state, 'won');
    const totalFinalSfx = game.audioCalls.filter(c => c === 'finalBossDeath').length;
    assert.ok(totalFinalSfx > 1, `${stage} normal final-boss victory sequence still plays finalBossDeath bursts`);
  }
});

test('勝利演出：擊殺順序 1→4→2→3 使用第三王外觀與座標，且尾王專屬音效不重播', () => {
  for (const [idx, stage] of [...PUBLIC_STAGES, 'hyakki-kyoto', 'snow-temple'].entries()) {
    const game = bootStage(stage, 6200 + idx);
    game.audioCalls.length = 0;
    const { coords, titles } = spawnAllFourWithOrder(game, [0, 3, 1, 2]);
    const snap = game.snapshot();
    assert.equal(snap.state, 'victory', `${stage} enters victory on 4th defeat`);
    assert.equal(snap.finalBossDefeated, true);
    assert.ok(snap.victorySeq && snap.victorySeq.boss);
    assert.equal(snap.victorySeq.boss.bossIndex, 2, `${stage} victory clone must be wave 3, not wave 4`);
    assert.equal(snap.victorySeq.boss.final, false);
    assert.equal(snap.victorySeq.boss.title, titles[2]);
    assert.equal(snap.victorySeq.bossX, coords[2].x, `${stage} victory X must match wave 3 death X`);
    assert.equal(snap.victorySeq.bossY, coords[2].y, `${stage} victory Y must match wave 3 death Y`);
    assert.equal(snap.victorySeq.boss.x, coords[2].x);
    assert.equal(snap.victorySeq.boss.y, coords[2].y);

    // Victory clone must be untargetable, non-official, and grant zero extra rewards.
    const clone = snap.enemies.find(e => e.dying === true);
    assert.equal(clone, snap.victorySeq.boss);
    assert.equal(clone.officialWaveBoss, false);
    const beforeScore = snap.score, beforeOil = snap.oil, beforeGems = snap.gems.length;
    const beforeAudio = game.audioCalls.length;
    game.hurt(clone, 999);
    assert.equal(clone.hp, 1);
    assert.equal(game.snapshot().score, beforeScore);
    assert.equal(game.snapshot().oil, beforeOil);
    assert.equal(game.snapshot().gems.length, beforeGems);
    assert.equal(game.audioCalls.length, beforeAudio);

    for (let f = 0; game.snapshot().state === 'victory' && f < 300; f++) game.stepFrame(50);
    assert.equal(game.snapshot().state, 'won');
    const finalSfxCount = game.audioCalls.filter(c => c === 'finalBossDeath').length;
    assert.equal(finalSfxCount, 1, `${stage} finalBossDeath must play ONLY once when wave 4 died, never replayed for wave 3`);
  }
});

test('勝利演出：擊殺順序 1→4→3→2 使用第二王外觀與座標，且尾王專屬音效不重播', () => {
  for (const [idx, stage] of [...PUBLIC_STAGES, 'spirit-ferry', 'yomi'].entries()) {
    const game = bootStage(stage, 6300 + idx);
    game.audioCalls.length = 0;
    const { coords, titles } = spawnAllFourWithOrder(game, [0, 3, 2, 1]);
    const snap = game.snapshot();
    assert.equal(snap.state, 'victory');
    assert.equal(snap.finalBossDefeated, true);
    assert.ok(snap.victorySeq && snap.victorySeq.boss);
    assert.equal(snap.victorySeq.boss.bossIndex, 1, `${stage} victory clone must be wave 2, not wave 4`);
    assert.equal(snap.victorySeq.boss.final, false);
    assert.equal(snap.victorySeq.boss.title, titles[1]);
    assert.equal(snap.victorySeq.bossX, coords[1].x, `${stage} victory X must match wave 2 death X`);
    assert.equal(snap.victorySeq.bossY, coords[1].y, `${stage} victory Y must match wave 2 death Y`);

    for (let f = 0; game.snapshot().state === 'victory' && f < 300; f++) game.stepFrame(50);
    assert.equal(game.snapshot().state, 'won');
    const finalSfxCount = game.audioCalls.filter(c => c === 'finalBossDeath').length;
    assert.equal(finalSfxCount, 1, `${stage} finalBossDeath must play ONLY once when wave 4 died, never replayed for wave 2`);
  }
});

test('勝利演出：同幀擊殺最後兩隻正式 Boss，使用最後倒下者座標與身分並正確切換狀態', () => {
  for (const [idx, stage] of ['night-town', 'rain-port', 'sakura-pass', 'bamboo-maze'].entries()) {
    const game = bootStage(stage, 6400 + idx);
    reachWave(game, 2);
    defeatWave(game, 0);
    reachWave(game, 3);
    for (let tries = 0; tries < 24 && !game.bossScheduleSnapshot().spawned.includes(3); tries++) {
      game.update(0.05);
    }
    // Defeat wave 4 first so waves 2 (idx 1) and 3 (idx 2) are the last two official bosses.
    defeatWave(game, 3);
    game.update(0.05);
    assert.equal(game.snapshot().state, 'play');

    const { x, y } = game.snapshot();
    const wave2 = liveOfficialBosses(game).find(e => e.bossIndex === 1);
    const wave3 = liveOfficialBosses(game).find(e => e.bossIndex === 2);
    assert.ok(wave2 && wave3);
    Object.assign(wave2, { x: x + 55, y: y + 4, shield: false, hp: 1 });
    Object.assign(wave3, { x: x + 78, y: y - 6, shield: false, hp: 1 });
    game.setFacingAngle(0);
    game.armWeapons();
    game.update(0.05);

    const snap = game.snapshot();
    assert.equal(snap.state, 'victory', `${stage} enters victory on same-frame final double kill`);
    assert.ok(snap.victorySeq && snap.victorySeq.boss);
    // Both wave2 and wave3 died in the same frame; victory clone must be one of those two (the last one killed), NEVER wave 4!
    assert.ok([1, 2].includes(snap.victorySeq.boss.bossIndex), `${stage} victory clone must be wave 2 or 3, got ${snap.victorySeq.boss.bossIndex}`);
    const chosen = snap.victorySeq.boss.bossIndex === 2 ? wave3 : wave2;
    assert.equal(snap.victorySeq.bossX, chosen.x);
    assert.equal(snap.victorySeq.bossY, chosen.y);
    assert.equal(snap.victorySeq.boss.final, false);

    for (let f = 0; game.snapshot().state === 'victory' && f < 300; f++) game.stepFrame(50);
    assert.equal(game.snapshot().state, 'won');
    assert.equal(game.audioCalls.filter(c => c === 'finalBossDeath').length, 1,
      `${stage} same-frame non-final finish must not replay finalBossDeath`);
  }
});

test('四王未全倒（1→4→2 剩第三王）仍保留封印答題與熄燈失敗流程', () => {
  const game = bootStage('sakura-pass', 6501);
  reachWave(game, 2);
  defeatWave(game, 0);
  reachWave(game, 3);
  for (let tries = 0; tries < 24 && !game.bossScheduleSnapshot().spawned.includes(3); tries++) {
    game.update(0.05);
  }
  defeatWave(game, 3);
  defeatWave(game, 1);
  game.update(0.05);

  const remaining = liveOfficialBosses(game);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].bossIndex, 2);
  assert.equal(remaining[0].shield, true);
  assert.equal(game.snapshot().state, 'play');
  assert.equal(game.snapshot().victorySeq, null);

  // Seal quiz still works on the last surviving boss after final boss already died
  game.placeAt(remaining[0].x, remaining[0].y);
  game.update(0.05);
  const quiz = game.snapshot().bossQ;
  assert.ok(quiz && quiz === remaining[0].quiz);
  game.unlockBoss();
  game.answerBoss(quiz.ans.indexOf(quiz.word));
  assert.equal(remaining[0].shield, false);

  // Running out of oil before killing wave 3 still fails
  game.setOil(0);
  game.update(0.05);
  assert.equal(game.snapshot().state, 'lampout');
});
