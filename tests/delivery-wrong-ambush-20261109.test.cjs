'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

for(const stage of ['night-town','rain-port']) {
  test(stage+' wrong answer cancels the job with no rewards and summons nearby enemies',()=>{
    const game=loadGame({seed:21,stage});
    game.start(stage);
    game.stopSpawns();
    assert.equal(game.prepareOrder(),true);
    const before=game.snapshot();
    const word=before.job.word;
    const wrong=before.job.ans.findIndex(w=>w!==word);
    assert.ok(wrong>=0);
    const beforeEnemies=before.enemies.length;
    const beforeOil=before.oil;
    game.resolve(wrong);
    const after=game.snapshot();
    assert.equal(after.job,null,'cargo is lost on first wrong answer');
    assert.equal(after.failed,before.failed+1);
    assert.equal(after.delivered,before.delivered,'no successful delivery credit');
    assert.equal(after.score,before.score,'no score for a failed parcel');
    assert.equal(after.xp,before.xp,'no delivery XP');
    assert.equal(after.oil,beforeOil,'no oil refill or additional oil tax');
    assert.equal(after.enemies.length,beforeEnemies+3,'three real ambush enemies spawn');
    for(const enemy of after.enemies.slice(-3)) {
      assert.ok(Math.hypot(enemy.x-after.x,enemy.y-after.y)<280,'ambush occurs nearby');
      assert.ok(enemy.hp>0,'enemy is attackable');
      assert.notEqual(enemy.type,'boss');
    }
    game.resolve(wrong);
    assert.equal(game.snapshot().failed,after.failed,'cannot retry the completed failure');
  });
}
