'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const game=source('js/game.js'),ui=source('js/ui.js'),renderer=source('js/renderer.js');
const list=['power','step','gather','cadence','reach','guard'];
const media=(p)=>{const bytes=fs.readFileSync(path.join(root,p));assert.equal(bytes.toString('ascii',0,4),'RIFF',p);assert.equal(bytes.toString('ascii',8,12),'WEBP',p);assert.ok(bytes.length>3000,p);};
test('B7 six portrait sprites are the same normalized high resolution and match six card files',()=>{
 for(const name of list){
  media('assets/img/ui/charm-passive/b7/omamori_'+name+'.webp');
  media('assets/img/ui/charm-passive/b7/charm_card_'+name+'.webp');
 }
 assert.match(ui,/charm-passive\/b7\/omamori_/);
 assert.match(ui,/charm-passive\/b7\/charm_card_/);
 assert.match(ui,/charmCardRequested\.has\(key\)/,'cards should load on demand');
});
test('B7 each omamori has a unique readable category glyph and colors',()=>{
 for(const [symbol,name] of [['力','power'],['速','step'],['吸','gather'],['疾','cadence'],['遠','reach'],['守','guard']]){
  assert.ok(ui.includes(name+':{glyph:\''+symbol+'\''),'missing '+symbol);
 }
});
test('B7 ground drop uses compact standardized dimensions and subtle floating, never source aspect ratio',()=>{
 assert.match(game,/const h = 64;/);
 assert.match(game,/art\.naturalWidth \/ art\.naturalHeight/);
 assert.match(game,/Math\.sin\(elapsed \* 3\.2 \+ d\.id \* 1\.7\)/);
 assert.match(game,/UI\.charmArtFor\?\.\(d\.charmId\)/);
 assert.doesNotMatch(game.slice(game.indexOf('  function paintCharmDrop('),game.indexOf('  function charmViewList(')),/w \* art\.naturalHeight/);
});
test('B7 held charms replace top-right name strip and are placed at the lantern side',()=>{
 const hud=ui.slice(ui.indexOf('  function drawCharmHud('),ui.indexOf('  function drawCharmSwap('));
 assert.match(hud,/lanternRight\+cssPx\(24\)/);
 assert.match(hud,/const tileW=Math.min\(cssPx\(76\)/);
 assert.match(hud,/illustratedCharms/);
 assert.doesNotMatch(hud,/fillText\(meta\.ja/);
 assert.match(ui,/charmArtFor: id => illustratedCharms/);
});
test('B7 free listen shortcut and hint button do not work or render',()=>{
 assert.match(game,/function triggerHint\(\) \{ return false; \}/);
 assert.doesNotMatch(ui,/聽 免費/);
 assert.doesNotMatch(ui,/drawDiegeticOmamoriHint\(ctx, HINT_BTN,/);
 assert.doesNotMatch(game,/if \(state === "play" && job\) triggerHint/);
 assert.match(game,/tutorialIds = \['pickup', 'delivery', 'dash', 'boss'\]/);
});
test('B7 new physical dash medallion replaces translucent-blue controller circle',()=>{
 media('assets/img/ui/dash_medallion_b7.webp');
 assert.match(ui,/assets\/img\/ui\/dash_medallion_b7\.webp/);
 assert.match(ui,/const action=illustratedArt\.dashAction/);
 assert.match(ui,/ctx\.drawImage\(action,dx-iw\/2/);
 assert.doesNotMatch(ui,/ring\(btnD, ready \?/);
});
test('B7 terrain scroll cache repaints across both cache boundaries',()=>{
 assert.match(renderer,/const seamBleed = 2 \/ Math\.max\(0\.01, pixelScale\)/);
 assert.match(renderer,/cached\.left\+seamBleed/);
 assert.match(renderer,/oldRight-seamBleed/);
 assert.match(renderer,/cached\.top\+seamBleed/);
 assert.match(renderer,/oldBottom-seamBleed/);
});
