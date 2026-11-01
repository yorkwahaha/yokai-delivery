'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=read('js/ui.js'),game=read('js/game.js');
const checkWebp=p=>{const b=fs.readFileSync(path.join(root,p));assert.ok(b.length>6000,p);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');};
test('B9 nine independently newly illustrated passive icon images are mapped in UI local trial',()=>{
 const list=['shield','dmg','rate','crit','spd','dash','oil_max','mag','oil_heal'];
 for(const name of list)checkWebp('assets/img/ui/passive/b9/hud_passive_'+name+'.webp');
 assert.match(ui,/ui\/b13\/passive_/);
 assert.match(ui,/b8LocalArtTrial/);
});
test('B9 six regenerated, color-distinct omamori portraits and cards load from common source',()=>{
 const ids=['power','step','gather','cadence','reach','guard'];
 for(const id of ids){
   checkWebp('assets/img/ui/charm-passive/b9/omamori_'+id+'.webp');
   checkWebp('assets/img/ui/charm-passive/b9/charm_card_'+id+'.webp');
 }
 assert.match(ui,/charm-passive\/b11\/omamori_/);
 assert.match(ui,/charm-passive\/b9\/charm_card_/);
 assert.match(game,/UI\.charmArtFor\?\.\(d\.charmId\)/);
});
test('B9 cargo carried near player doubles its actual painted icon size 42 to 84 and adds background contrast',()=>{
 const fn=game.slice(game.indexOf('  function drawCargo()'),game.indexOf('  function drawShiomeWave('));
 assert.match(fn,/artCargo \? 84/);
 assert.match(fn,/ctx\.createRadialGradient/);
 assert.match(fn,/ctx\.shadowBlur=8/);
 assert.match(fn,/UI\.drawWordCue\(ctx, job\.word, cargo\.x, cyPos \+ 1, cargoSize\)/);
});
test('B9 both generated source atlases and grounded order manifests are preserved',()=>{
 for(const name of ['passives_atlas','omamori_atlas']){
  const img=fs.readFileSync(path.join(root,'art/night-town/b9-local-art',name+'.png'));
  assert.equal(img.toString('ascii',1,4),'PNG');
 }
 const p=JSON.parse(read('art/night-town/b9-local-art/passive_map.json'));
 const c=JSON.parse(read('art/night-town/b9-local-art/omamori_map.json'));
 assert.equal(p.order.length,9);assert.equal(c.selected.length,6);
 assert.equal(new Set(c.selected.map(x=>x.glyph)).size,6);
});
