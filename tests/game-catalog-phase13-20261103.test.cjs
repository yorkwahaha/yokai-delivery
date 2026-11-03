'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const golden = require('./fixtures/game-catalog-golden-phase13-20261103.json');
const source = fs.readFileSync('js/game-catalog.js','utf8');
const game = fs.readFileSync('js/game.js','utf8');
const names=['CHARM_CONFIG','MUTATION_CONFIG','DUO_CONFIG','WI','WEAPON_UPGRADES'];
function catalog() {
  const sandbox={window:{}};
  vm.runInNewContext(source,sandbox,{filename:'js/game-catalog.js'});
  return sandbox.window.GAME_CATALOG;
}
test('Phase13 all five original catalog definitions match pre-extraction SHA256 and key order',()=>{
  const tables=catalog();
  assert.deepEqual(Object.keys(tables).sort(),[...names].sort());
  for(const name of names) {
    const data=tables[name];
    const json=JSON.stringify(data);
    const hash=crypto.createHash('sha256').update(json).digest('hex');
    assert.equal(hash,golden[name].hash,name+' content or property order changed');
    assert.equal(Buffer.byteLength(json),golden[name].byteLength,name+' serialized byte count');
    assert.equal(JSON.stringify(Object.keys(data)),JSON.stringify(golden[name].keys),name+' key order');
    assert.ok(Object.keys(data).length>0);
  }
});
test('Phase13 registry holder is frozen but original member tables and entries remain mutable',()=>{
  const tables=catalog();
  assert.ok(Object.isFrozen(tables));
  for(const name of names){
    assert.equal(Object.isFrozen(tables[name]),false,name+' table mistakenly frozen');
    const first=Object.values(tables[name])[0];
    assert.equal(Object.isFrozen(first),false,name+' object mistakenly frozen');
  }
});
test('Phase13 original local registry identifiers still refer to catalog data without moving WL',()=>{
  for(const name of names) {
    assert.ok(game.includes('const '+name+' = window.GAME_CATALOG.'+name+';'),name);
  }
  assert.match(game,/const WL = \{ katana: 1,/);
  assert.doesNotMatch(source,/\bWL\s*=/);
  assert.doesNotMatch(source,/Math\.random\s*\(|localStorage|document\./);
});
test('Phase13 catalog loads before game with versioned HTML scripts',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const catalogScript='js/game-catalog.js?v=20261103-catalog-phase13';
  const gameScript='js/game.js?v=20261103-summary-phase18';
  assert.ok(html.includes(catalogScript));
  assert.ok(html.includes(gameScript));
  assert.ok(html.indexOf(catalogScript)<html.indexOf(gameScript));
  assert.ok(html.includes('js/game-attack-specs.js?v=20261103-attack-phase12'));
});
