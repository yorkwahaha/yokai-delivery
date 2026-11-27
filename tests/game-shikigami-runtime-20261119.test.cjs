'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/game-runtime.cjs');

const trial = { hostname: '127.0.0.1', search: '?dev=1&shikigami=1' };
function arena(location = trial, stage = 'night-town') {
  const game = loadGame({ location });
  game.start(stage);
  game.clearSolids();
  game.clearOrders();
  game.stopSpawns();
  game.setWeaponRank('katana', 0);
  return game;
}

test('本機與公開版都依第三關通關紀錄解鎖式神，遵守四槽與介紹保底', () => {
  const game = arena();
  const store = game.store();
  assert.equal(store.isActiveSkillUnlocked('shikigami'), false);
  game.configureStage('sakura-pass');
  assert.equal(store.isActiveSkillUnlocked('shikigami'), false);
  for (const stage of ['night-town', 'rain-port', 'sakura-pass']) {
    store.finish(stage, 100, 20, true);
  }
  store.markSkillExperienced('ink_trail');
  store.markSkillExperienced('seal_nail');
  assert.equal(store.isActiveSkillUnlocked('shikigami'), true);
  assert.equal(store.pendingSkillIntroduction(), 'shikigami');
  game.start('night-town');
  game.offerUp();
  assert.ok(game.weaponChoices().some(card => card.id === 'shikigami'));
  game.start('night-town');
  for (const id of ['fire', 'barrier', 'needle']) game.setWeaponRank(id, 1);
  game.offerUp();
  assert.ok(!game.weaponChoices().some(card => card.id === 'shikigami'));
  const publicGame = arena({ hostname:'game.example.com', search:'?species=crow' });
  assert.equal(publicGame.store().isActiveSkillUnlocked('shikigami'), false);
  publicGame.store().finish('sakura-pass', 100, 20, true);
  assert.equal(publicGame.store().isActiveSkillUnlocked('shikigami'), true);
  publicGame.setWeaponRank('shikigami',1);
  publicGame.update(.05);
  assert.equal(publicGame.companion().species, 'hound');
});

test('配送讀題以玩家所在位置判定；入圈凍結式神，答案與委託保持原樣', () => {
  const game = arena();
  game.setWeaponRank('shikigami', 5);
  game.update(.05);
  assert.equal(game.snapshot().job, null);
  assert.ok(game.prepareOrder());
  game.atDestination();
  const before = game.companion();
  const answers = game.snapshot().job.ans.map(word => word.jp);
  for (let i = 0; i < 10; i++) game.update(.05);
  assert.deepEqual(game.companion(), before);
  assert.deepEqual(game.snapshot().job.ans.map(word => word.jp), answers);
  assert.equal(game.snapshot().delivered, 0);
});

test('普通怪接觸轉移至式神，紫藤混亂優先，燈油不受轉移攻擊影響', () => {
  const game = arena();
  const p = game.snapshot();
  const mob = game.addMob({ x: p.x - 80, y: p.y + 28 });
  game.setWeaponRank('shikigami', 5);
  // Keep the contact case deterministic across multiple aggro scans.
  game.env.Math.random = () => 0;
  game.setInvulnerability(0);
  game.update(.05);
  assert.equal(game.companion().hp, 290);
  assert.ok(p.oil - game.oilNow() < 1);
  mob.confusedT = 2;
  mob.confuseTarget = game.addMob({ x: mob.x + 10, y: mob.y });
  game.update(.05);
  assert.equal(game.companion().aggroCount, 0);
  assert.equal(game.companion().hp, 290);
});

test('式神目標妖火跨過碰撞點仍命中，發射後仇恨轉移也不改打燈油', () => {
  const game = arena(trial, 'sakura-pass');
  const p = game.snapshot();
  const shooter = game.addMob({ type: 'shooter', x: p.x - 180, y: p.y + 28, shootCd: .001 });
  game.setWeaponRank('shikigami', 5);
  game.env.Math.random = () => 0;
  game.setInvulnerability(0);
  game.update(.01);
  assert.equal(game.snapshot().enemyBullets[0]?.target?.hp, 300);
  shooter.hp = 0;
  game.update(.6);
  assert.equal(game.companion().hp, 292);
  assert.equal(game.snapshot().enemyBullets.length, 0);
  assert.ok(p.oil - game.oilNow() < 1);
});

test('戰鬥更新召喚式神；暫停、Boss 讀題及重新開始的生命週期', () => {
  const game = arena();
  game.setWeaponRank('shikigami', 5);
  game.update(.05);
  const before = game.companion();
  assert.equal(before?.hp, 300);
  assert.equal(before.wolves.length, 2);
  game.setState('pause');
  game.update(1);
  assert.deepEqual(game.companion(), before);
  game.setState('play');
  game.prepareBoss();
  game.moveBoss(40);
  game.update(.05);
  assert.deepEqual(game.companion(), before);
  assert.equal(game.snapshot().enemies[0].hp, 999);
  assert.equal(game.snapshot().delivered, 0);
  game.start('rain-port');
  assert.equal(game.companion().active, false);
  assert.equal(game.weaponLevels().shikigami, 0);
});

test('混亂且無同伴的射手只慢走，接觸不扣油也不射玩家', () => {
  const game=arena(),p=game.snapshot();
  const shooter=game.addMob({x:p.x+10,y:p.y,type:'shooter',speed:100,shootCd:.001,confusedT:2});
  game.setInvulnerability(0);
  game.env.Math.random=()=>0;
  game.update(.05);
  assert.ok(shooter.confuseWander);
  assert.ok(shooter.x>p.x+10 && shooter.x<p.x+14);
  assert.equal(game.snapshot().enemyBullets.length,0);
  assert.ok(p.oil-game.oilNow()<1);
});

test('雙狼在放棄、勝利、失敗後清除，重新開始可以再召喚', () => {
  const game=arena();
  for(const end of [()=>game.leaveStage(),()=>game.winStage(),()=>{game.setOil(0);game.update(.05); }]){
    game.start('bamboo-maze');
    game.stopSpawns();
    game.setWeaponRank('shikigami',5);
    game.update(.05);
    assert.equal(game.companion().wolves.length,2);
    end();
    assert.equal(game.companion().wolves.length,0);
    assert.equal(game.companion().cooldown,0);
  }
});

test('雙狼擊殺小怪只核算一次分數，從不計入正式 Boss 或配送', () => {
  const game=arena(), p=game.snapshot();
  game.setWeaponRank('shikigami',5);
  const prey=game.addMob({x:p.x,y:p.y+80,hp:999,max:999});
  for(let i=0;i<24;i++)game.update(.05);
  assert.equal(prey.hp,0);
  const after=game.snapshot();
  assert.equal(after.score-p.score,15);
  assert.equal(after.bossStage,p.bossStage);
  assert.equal(after.delivered,p.delivered);
});
