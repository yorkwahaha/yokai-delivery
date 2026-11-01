const test = require('node:test');
const assert = require('node:assert/strict');
const { nearest, squaredDistance } = require('../js/combat-targeting.js');

test('nearest targeting matches stable distance ordering without sorting the source', () => {
  const enemies = [{ x: 11, y: 0, hp: 10 }, { x: 3, y: 4, hp: 0 },
    { x: -5, y: 0, hp: 10 }, { x: 5, y: 0, hp: 10 }];
  const before = [...enemies];
  assert.equal(squaredDistance({x:0,y:0},enemies[1]),25);
  assert.strictEqual(nearest(enemies,{x:0,y:0},e=>e.hp>0),enemies[2]);
  assert.deepEqual(enemies,before);
  assert.equal(nearest(enemies,{x:0,y:0},()=>false),null);
});
