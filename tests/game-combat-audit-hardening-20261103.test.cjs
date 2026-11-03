'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {loadGame} = require('./helpers/game-runtime.cjs');
const ctx = {window:{}};
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),ctx);
const math = ctx.window.GAME_COMBAT_MATH;

test('audit: blade cone cannot loop forever for infinite facing or geometry angles',()=>{
  const p = {x:0,y:0}, e={x:100,y:0};
  for (const faceAng of [Infinity,-Infinity,1e30,-1e30])
    assert.equal(math.bladeArcContains(p,e,140,faceAng,1.15),false);
  assert.equal(math.bladeArcContains(p,e,140,NaN,1.15),false);
  assert.equal(math.bladeArcContains(p,e,140,0,1.15),true);
});

test('audit: dragon forward cone does not loop for infinite facing',()=>{
  const enemy = {id:'enemy',x:100,y:0,hp:30};
  for (const faceAng of [Infinity,-Infinity,1e30,-1e30]) {
    const result = math.dragonFireTarget([enemy], {x:0,y:0,faceAng});
    assert.strictEqual(result,enemy,'existing fallback remains available without hanging');
  }
});

test('audit: dragon ignores vanished/done enemies in the forward cone and cluster vote',()=>{
  const p={x:0,y:0,faceAng:0};
  const dying={id:'vanished',x:140,y:0,hp:20,vanish:1};
  const finished={id:'done',x:145,y:10,hp:20,done:true};
  const live={id:'live',x:240,y:0,hp:20};
  assert.strictEqual(math.dragonFireTarget([dying,finished,live],p),live);
  assert.strictEqual(math.dragonFireTarget([dying,finished],p),null);
});

test('audit: dragon excludes vanished/done enemies in rear fallback too',()=>{
  const p={x:0,y:0,faceAng:0};
  const dying={id:'vanished',x:-170,y:0,hp:20,vanish:true};
  const finished={id:'done',x:-190,y:10,hp:20,done:true};
  const live={id:'live',x:-260,y:0,hp:20};
  assert.strictEqual(math.dragonFireTarget([dying,finished,live],p),live);
});

test('audit: real game Lv5 dragon avoids vanished forward targets',()=>{
  const g=loadGame({seed:293,stage:'night-town'});
  g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
  g.combatScene('fire',[
    {id:'vanished',dx:145,dy:0,hp:10000,max:10000,vanish:1},
    {id:'finished',dx:160,dy:5,hp:10000,max:10000,done:true},
    {id:'live',dx:250,dy:0,hp:10000,max:10000}
  ],[],5);
  g.face(0);
  g.weapons(.02);
  assert.deepEqual(Array.from(g.dragonTargetIds()),['live']);
});

test('audit: existing valid-facing dragon target remains unchanged',()=>{
  const p={x:0,y:0,faceAng:0};
  const enemies=[{id:'first',x:100,y:0,hp:30},{id:'next',x:140,y:0,hp:30}];
  assert.strictEqual(math.dragonFireTarget(enemies,p),enemies[0]);
  assert.ok(Object.isFrozen(math));
});
