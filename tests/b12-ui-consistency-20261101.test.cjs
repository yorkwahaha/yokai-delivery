'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const ui=read('js/ui.js'),game=read('js/game.js');
const area=(src,a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
test('B12 nine authentic ComfyUI ink-painted accessory icons in local runtime',()=>{
 const ids=['shield','dmg','rate','crit','spd','dash','oil_max','mag','oil_heal'];
 for(const id of ids){
  const f=fs.readFileSync(path.join(root,'assets/img/ui/b12/passive_'+id+'.webp'));
  assert.equal(f.toString('ascii',0,4),'RIFF',id);
  assert.equal(f.toString('ascii',8,12),'WEBP',id);
 }
 assert.match(ui,/assets\/img\/ui\/b13\/passive_/);
});
test('B12 permanent yōkai surge warning uses illustrated baked-text raster not software outlined box',()=>{
 const f=fs.readFileSync(path.join(root,'assets/img/ui/b12/surge_warning.webp'));
 assert.equal(f.toString('ascii',8,12),'WEBP');
 const fn=area(ui,'  function drawSurgeWarning(','  // 9. 關卡標題卡');
 assert.match(fn,/const art=b14SurgeBrush/);
 assert.match(fn,/ctx\.drawImage\(art,cx-ww\/2,yy,ww,hh\)/);
 assert.doesNotMatch(fn,/glassBox\(/);
 assert.match(fn,/if\(!art\?\.naturalWidth\)return/);
});
test('B12 held omamori proportions follow source naturalWidth/naturalHeight; no flattening',()=>{
 const fn=area(game,'  function paintCharmDrop(','  function charmViewList(');
 assert.match(fn,/h \* art\.naturalWidth \/ art\.naturalHeight/);
 assert.match(fn,/upright\(d\.x, d\.y/);
 assert.match(fn,/ctx\.drawImage\(art, d\.x - w \/ 2/);
});
test('B12 Boss HP is only a clean red strip without wrapper or second background',()=>{
 const fn=area(ui,'  function drawBossBar(','  // 小繪馬覺醒印');
 assert.match(fn,/ctx\.fillRect\(x,y\+4,w\*hp,h\)/);
 assert.doesNotMatch(fn,/drawWashiSlices|roundRect|stroke|bossLabel|fillText|fillRect\(x\+3/);
});
test('B12 true max passive stacks 2/3/4 are segment lights not multiplication badges',()=>{
 const fn=area(ui,'    const passives = [','    const hiddenPassives');
 assert.match(fn,/maxStacks=\{shield:3,dmg:4,rate:4,crit:3,spd:3/);
 assert.match(fn,/oil_max:2,mag:3,oil_heal:3/);
 assert.match(fn,/for\(let seg=0;seg<cap;seg\+\+\)/);
 assert.doesNotMatch(fn,/badgeTxt|strokeText\(/);
});
test('B12 carried charms represent levels as beads and halo, no xN text',()=>{
 const fn=area(ui,'  function drawCharmHud(','  // B10 approved layout:');
 assert.match(fn,/const rank=Math\.max\(1,Math\.min\(3,item\.level\|\|1\)\)/);
 assert.doesNotMatch(fn,/strokeText\('×'|fillText\('×'/);
});
test('B12 camera/pause UI has real fixed raster icons and same interactive controls',()=>{
 for(const id of ['pause_medallion','camera_medallion','view_flat_medallion']){
  const f=fs.readFileSync(path.join(root,'assets/img/ui/b12',id+'.webp'));
  assert.equal(f.toString('ascii',8,12),'WEBP');
 }
 assert.match(game,/UI\.drawViewMedallion\(ctx, btnView/);
 assert.match(game,/hitButton\(p, btnView\)/);
 assert.match(game,/hitButton\(p, btnPause\)/);
 assert.match(ui,/drawViewMedallion,/);
 assert.match(ui,/ctx\.drawImage\(pauseIcon/);
});
test('B12 pause and abandon flows use consistent painted image boards and unchanged buttons',()=>{
 assert.match(ui,/b13Art\.menu_board/);
 assert.match(ui,/EXIT_BTNS\.forEach/);
 assert.match(ui,/drawWashiSlices\(ctx,b13Art\.menu_board/);
 assert.match(ui,/drawB13MenuButton\(ctx,b,label/);
});
test('B12 longblade remains meaningful after Lv5, 720 becomes 900 at runtime and projectile reads it',()=>{
 assert.match(game,/maxTravel: hasLongblade \? 900 : 720/);
 assert.match(game,/const cap = wave\.maxTravel \|\| 720/);
 assert.match(game,/traveled: 0, maxTravel: spec\.maxTravel/);
 assert.match(ui,/mut_longblade: \{ ja: "妖刀・長風刃"/);
});
