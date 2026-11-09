'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('saturated Lv55+ build offers a real permanent coin card, never an extra passive',()=>{
  const game=loadGame({seed:31});
  game.start();
  game.stopSpawns();
  game.forcePostCapForTest();
  const before=game.store().coinBalance();
  const level=game.currentLevel();
  game.offerUp();
  const cards=game.currentChoices();
  assert.equal(cards.length,1);
  assert.equal(cards[0].type,'coins');
  assert.equal(cards[0].n,'夜行賞金 +100');
  game.rerollUpgradeForTest();
  assert.equal(game.currentChoices()[0].choiceId,'coins:postcap');
  const awarded=game.takeLevelUpChoice(0);
  assert.equal(awarded.ok,true);
  assert.equal(game.currentLevel(),level+1);
  assert.equal(game.store().coinBalance(),before+100);
  assert.equal(game.takeLevelUpChoice(0).ok,false,'a stale tap must not award again');
  assert.equal(game.store().coinBalance(),before+100);
});
