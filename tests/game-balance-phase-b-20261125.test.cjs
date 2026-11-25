'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {loadGame,runTrial,layouts} = require('../tools/measure-first-four-phase-b.cjs');

function measure(game,id,rank,layout,mutations=[]){
  return runTrial(game,id,rank,layouts.find(value=>value.id===layout),117,{mutations});
}

test('Lv5 needles recover close and middle boss damage with the same eight-shot volley',()=>{
  const game=loadGame();
  for(const layout of ['boss-100','boss-100-side','boss-100-rear','boss-100-moving','boss-220-moving']){
    const before=measure(game,'needle',4,layout);
    const after=measure(game,'needle',5,layout);
    assert.ok(after.dps>=before.dps,layout);
    assert.equal(after.projectiles,8,layout);
    assert.equal(after.events.fire,72,layout);
  }
  assert.equal(measure(game,'needle',5,'crowd-80').dps,185.76);
  assert.equal(measure(game,'needle',5,'boss-390').dps,4.32);
});

test('Lv5 return needles keep the original two-leg per-target damage budget',()=>{
  const game=loadGame();
  const result=measure(game,'needle',5,'boss-100',['mut_return']);
  assert.equal(result.dps,9.984);
});

test('Lv5 ofuda recovers short-range direct boss damage without multiplying splash or secondary blasts',()=>{
  const game=loadGame();
  const near=measure(game,'boom',5,'boss-100');
  assert.ok(near.dps>=measure(game,'boom',4,'boss-100').dps);
  assert.equal(near.attachments,14);
  assert.equal(near.projectiles,2);
  assert.equal(measure(game,'boom',5,'boss-220').dps,5.6);
  assert.equal(measure(game,'boom',5,'crowd-80').dps,228.7);
  const crowd=measure(game,'boom',5,'boss-crowd-80');
  assert.ok(Math.abs(crowd.dps-crowd.firstTargetDps-126)<1e-9);
  const split=measure(game,'boom',5,'boss-100',['mut_splitblast']);
  assert.ok(Math.abs((split.dps-near.dps)-2.8)<1e-9);
});
