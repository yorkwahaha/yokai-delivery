'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
const ids=['power','step','gather','cadence','reach','guard'];
test('B11 six real painted selectable card faces, feature and HUD adornments are WebP',()=>{
 for(const n of ['feature','hud_wisps',...ids.map(n=>'card_'+n)]){
   const f=fs.readFileSync(path.join(root,'assets/img/ui/charm-passive/b11',n+'.webp'));
   assert.equal(f.toString('ascii',0,4),'RIFF',n);
   assert.equal(f.toString('ascii',8,12),'WEBP',n);
   assert.ok(f.length>1000,n);
 }
});
test('B11 same six corrected seal glyph portraits are used on map, held HUD, and replacement UI',()=>{
 for(const n of ids){
   const f=fs.readFileSync(path.join(root,'assets/img/ui/charm-passive/b11','omamori_'+n+'.webp'));
   assert.equal(f.toString('ascii',8,12),'WEBP',n);
 }
 assert.match(ui,/assets\/img\/ui\/charm-passive\/b11\/omamori_/);
 assert.match(ui,/charmScreenArt\.cards\[key\.slice\(5\)\]/);
});
test('B11 replaces opaque black card overlay with real dynamic illustrated card layer',()=>{
 const fn=ui.slice(ui.indexOf('  function drawCharmSwap('),ui.indexOf('  function drawDiegeticRadarClock(',ui.indexOf('  function drawCharmSwap(')));
 assert.match(fn,/ctx\.drawImage\(texture,xx,yy,ww,hh\)/);
 assert.match(fn,/charmScreenArt\.feature/);
 assert.match(fn,/charmScreenArt\.cards/);
 assert.doesNotMatch(fn,/rgba\(9,19,35,\.45\)/);
 assert.doesNotMatch(fn,/rgba\(9,21,38,\.92\)/);
 assert.match(fn,/paintPortrait\(newId/);
 assert.match(fn,/const label=item/);
 assert.match(fn,/hitRects\.push\(\{id:'swap_discard'/);
});
test('B11 lantern charms have no full-height black panel or individual rectangular plaques',()=>{
 const fn=ui.slice(ui.indexOf('  function drawCharmHud('),ui.indexOf('  // B10 approved layout:',ui.indexOf('  function drawCharmHud(')));
 assert.match(fn,/charmScreenArt\.hud/);
 assert.match(fn,/ctx\.drawImage\(art,x\+\(tileW-iw\)\/2/);
 assert.doesNotMatch(fn,/rgba\(15,25,38,\.78\)/);
 assert.doesNotMatch(fn,/drawWashiSlices\(ctx,background/);
});
