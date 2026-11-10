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
test('B12 held omamori rail preserves natural aspect ratio; no flattening',()=>{
 const fn=area(ui,'  function drawCharmHud(','  // B10 approved layout:');
 assert.match(fn,/art\?\.naturalWidth && art\.naturalHeight/);
 assert.match(fn,/const ratio=Math\.min\(slot\/art\.naturalWidth,\(slot\+4\)\/art\.naturalHeight\)/);
 assert.match(fn,/const ww=art\.naturalWidth\*ratio,hh=art\.naturalHeight\*ratio/);
});
test('B12 Boss HP draws one named lacquer bar with a single actual health fill',()=>{
 const fn=area(ui,'  function drawBossBar(','  // 小繪馬覺醒印');
 assert.match(fn,/const fillY=y\+17, fillH=Math\.max\(6,rowH-23\)/);
 assert.match(fn,/ctx\.fillRect\(x\+inset,fillY,\(w-inset\*2\)\*hp,fillH\)/);
 assert.match(fn,/ctx\.fillText\(tag\+"  "\+\(boss\.title\|\|"大妖"\)/);
 assert.doesNotMatch(fn,/drawWashiSlices\(/,'Boss HP bar has no second paper panel');
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
 assert.match(fn,/const level=Math\.max\(1,Math\.min\(3,item\.level\|\|1\)\)/);
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
test('B12 pause and abandon flows use consistent illustrated washi boards and unchanged buttons',()=>{
 assert.match(ui,/function drawPausePaper\(/);
 assert.match(ui,/EXIT_BTNS\.forEach/);
 assert.match(ui,/ctx\.drawImage\(art,x,y,w,h\)/);
 assert.match(ui,/drawB13MenuButton\(ctx,b,label/);
});
test('B12 longblade remains meaningful after Lv5, 720 becomes 900 at runtime and projectile reads it',()=>{
 assert.match(read('js/game-attack-specs.js'),/const maxTravel = Math.round\(\(hasLongblade \? 900 : 720\) \* reachMult\)/);
 assert.match(game,/const cap = wave\.maxTravel \|\| 720/);
 assert.match(game,/traveled: 0, maxTravel: spec\.maxTravel/);
 assert.match(ui,/mut_longblade: \{ ja: "妖刀・長風刃"/);
});
