'use strict';
// Controlled integration smoke across the four publicly enterable stages.
// Uses the real order/quiz/victory/save code, but injects delivery positions
// and a Boss quiz and triggers victory explicitly. This is NOT an autonomous
// player walk, real Boss kill, browser rendering, or iPad performance test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

const STAGES = ['night-town','rain-port','sakura-pass','bamboo-maze'];
for (const [stageIndex, stage] of STAGES.entries()) {
  test(stage + ': six controlled orders, sealed Boss quiz, victory settlement, persistent replay', () => {
    const g = loadGame({ stage, seed: 3301 + stageIndex,
      location: { hostname: 'example.com', search: '' } });
    const store = g.store();
    // Establish the same prerequisite clear flags required for the public map.
    for (const prev of STAGES.slice(0, stageIndex))
      store.finish(prev, 100, 6, true);
    const node = g.env.OVERWORLD.STAGE_NODES.find(n => n.stageId === stage);
    assert.ok(g.env.OVERWORLD.isEnterable(node), stage + ' should be enterable after prior clears');
    g.start(stage);
    g.stopSpawns();
    g.clearEnemies();

    for (let n = 0; n < 6; n++) {
      assert.equal(g.prepareOrder(), true, 'order ' + n + ' should be creatable');
      g.atDestination();
      g.update(.05);
      const order = g.snapshot().job;
      assert.equal(order?.reading, true, 'order ' + n + ' has a reading barrier');
      assert.ok(order.ans.includes(order.word));
      g.resolve(order.ans.indexOf(order.word));
      assert.equal(g.snapshot().delivered, n + 1, 'count each successful delivery once');
    }
    assert.equal(g.snapshot().failed, 0);

    // This harness Boss is a dedicated sealed quiz (not a four-wave fight).
    g.prepareBoss();
    const quiz = g.snapshot().bossQ;
    const boss = g.snapshot().enemies.find(e => e.type === 'boss');
    assert.ok(quiz && boss?.shield, 'Boss begins shielded with an answer');
    g.answerBoss(quiz.ans.indexOf(quiz.word));
    assert.equal(boss.shield, false, 'correct quiz removes only the seal');

    // Controlled ending: run the actual 13.1s victory sequence and its
    // settlement through runFrame rather than writing STORE flags directly.
    g.winStage();
    let frames = 0;
    while (g.snapshot().state === 'victory' && frames < 300) {
      g.stepFrame(50);
      frames++;
    }
    assert.equal(g.snapshot().state, 'won', 'victory animation completes');
    assert.equal(store.isStageCompleted(stage), true, 'end screen commits the clear');
    if (stage === 'sakura-pass') {
      const bamboo = g.env.OVERWORLD.STAGE_NODES.find(n => n.stageId === 'bamboo-maze');
      assert.equal(g.env.OVERWORLD.isEnterable(bamboo), true);
    }
    if (stage === 'bamboo-maze') {
      const kyoto = g.env.OVERWORLD.STAGE_NODES.find(n => n.stageId === 'hyakki-kyoto');
      assert.equal(g.env.OVERWORLD.isEnterable(kyoto), true, 'fifth stage opens after fourth clear');
    }
    g.start(stage);
    assert.equal(g.snapshot().state, 'play', 'stage can be replayed');
    assert.equal(g.snapshot().delivered, 0, 'new run starts with no deliveries');
    assert.equal(store.isStageCompleted(stage), true, 'replaying does not erase progression');
  });
}
