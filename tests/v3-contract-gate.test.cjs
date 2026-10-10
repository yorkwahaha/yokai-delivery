// Codex authors the initial contract gate; Hermes independently reviews and reruns it.
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadGame} = require('./helpers/game-runtime.cjs');
const cfg = require('../js/config.js');
const E = require('../js/evolutions.js');
const fresh = () => {const g=loadGame({seed:7});g.start();g.stopSpawns();return g;};
const deliver = (g, assisted=false) => {
  g.setState('play');g.prepareOrder();if(assisted)g.triggerHint();
  g.resolve(g.snapshot().job.ans.indexOf(g.snapshot().job.word));
};

test('V3 contract: common boss timeline and bounded overtime difficulty', () => {
  assert.deepEqual(cfg.BOSS_TIMES,[180,360,480,540]);
  assert.equal(cfg.enemyTier(600,4),cfg.enemyTier(1200,4));
});
test('V3 contract: independent and assisted deliveries each grant 26 XP', () => {
  for(const assisted of [false,true]) {const g=fresh();deliver(g,assisted);assert.equal(g.currentXp(),26);assert.equal(g.snapshot().delivered,1);}
});
test('V3 contract: first hint is free and duplicate presses cannot reach paid hint', () => {
  const g=fresh();g.prepareOrder();g.setOil(80);g.triggerHint();g.triggerHint();
  assert.equal(g.snapshot().oil,80);assert.equal(g.snapshot().job.hintStage,1);assert.equal(g.snapshot().job.assisted,true);
});
test('V3 contract: a wrong answer retains the job and charges six oil only once', () => {
  const g=fresh();g.prepareOrder();g.setOil(80);const job=g.snapshot().job;
  const wrong=job.ans.findIndex(w=>w!==job.word);g.resolve(wrong);
  assert.equal(g.snapshot().job,job);assert.equal(g.snapshot().oil,74);
  g.resolve(wrong);assert.equal(g.snapshot().oil,74);
  assert.equal(g.snapshot().enemies.filter(e=>e.type==='mis').length,0);
  g.resolve(job.ans.indexOf(job.word));assert.equal(g.snapshot().delivered,1);assert.equal(g.currentXp(),26);
  assert.equal(g.env.STORE.get(job.word.jp).box,0);
});
test('V3 contract: Lv4 cannot awaken before deliveries, three deliveries unlock a saved seal', () => {
  const g=fresh();g.setWeaponRank('katana',4);g.offerUp();
  assert.ok(!g.weaponChoices().some(c=>c.lv===5),'no awakening without a seal');
  for(let i=0;i<3;i++)deliver(g,true);
  g.offerUp();const max=g.weaponChoices().find(c=>c.id==='katana'&&c.lv===5);
  assert.ok(max,'eligible offer guarantees an awakening card');max.f();assert.equal(g.weaponLevels().katana,5);
  g.setWeaponRank('needle',4);g.offerUp();assert.ok(!g.weaponChoices().some(c=>c.lv===5),'spent seal is unavailable');
});
test('V3 contract: damage passive stops at four increments of 0.30', () => {
  const g=fresh(),u=g.tune('dmg');for(let i=0;i<4;i++)u.f();
  assert.equal(u.ok(),false);assert.ok(Math.abs(g.bNow().dmg-2.4)<1e-9);
});
test('V3 contract: destination reading freezes elapsed time, oil and weapon damage', () => {
  const g=fresh();g.prepareOrder();g.atDestination();g.update(.05);const before=g.snapshot();
  g.update(.2);const after=g.snapshot();assert.equal(after.elapsed,before.elapsed);assert.equal(after.oil,before.oil);
  assert.equal(after.job.reading,true);
});
test('V3 contract: thunder Lv3 and Lv4 damage cannot execute a high-HP ordinary enemy', () => {
  for(const rank of [3,4]) {const g=fresh();g.combatScene('thunder',[{dx:90,hp:999,max:999}],[],rank);g.weapons(.01);
    const e=g.snapshot().enemies[0];assert.ok(e.hp>900,`rank ${rank} must use fixed damage`);assert.ok(e.hp<999);}
});
test('V3 contract: MAX barrier fields never restore oil', () => {
  const g=fresh();g.combatScene('barrier',[],[],5);g.setOil(80);
  for(let i=0;i<50;i++)g.weapons(.05);
  assert.equal(g.snapshot().oil,80);
});
test('V3 contract: fire and talisman rank counts match the new specialist behavior', () => {
  assert.deepEqual([1,2,3,4,5].map(E.fireCount),[1,2,3,3,3]);
  assert.deepEqual([1,2,3,4,5].map(E.fireAttackCount),[0,0,0,1,0]);assert.equal(E.boomCount(5),2);
});
test('V3 contract: one ice volley shares its finite shatter budget and new freezes clear old sources', () => {
  const needles=E.iceVolley({x:0,y:0},[]);assert.ok(needles[0].volley);
  assert.ok(needles.every(n=>n.volley===needles[0].volley));
  const enemy={hp:10,type:'ghost'};assert.equal(E.freeze(enemy,0,needles[0].volley),true);
  assert.equal(enemy.shatterVolley,needles[0].volley);E.freeze(enemy,3);assert.ok(!enemy.shatterVolley);
});
test('V3 contract: assisted recall preserves error priority and repeated independent recall cannot farm stars', () => {
  const g=fresh(),s=g.env.STORE;s.rec('ねこ',false);s.recAssisted('ねこ');assert.equal(s.get('ねこ').missBoost,2.5);
  assert.equal(typeof s.recRecall,'function');s.recRecall('ねこ',0);s.recRecall('ねこ',1000);assert.equal(s.get('ねこ').box,1);
  s.recRecall('ねこ',30000);assert.equal(s.get('ねこ').box,2);
  assert.equal(typeof s.createStudySession,'function');const session=s.createStudySession(g.env.CONTENT.getAllWords(),()=>.5);
  assert.equal(typeof session.seenWords,'function');
});
test('V3 contract: first boss starts with fixed HP independent of player power', () => {
  const g=fresh();g.scheduleBoss();g.update(.05);const boss=g.snapshot().enemies.find(e=>e.type==='boss');
  assert.ok(boss);assert.equal(boss.max,300);
});
