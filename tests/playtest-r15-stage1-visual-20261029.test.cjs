'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const game=read('js/game.js'),ui=read('js/ui.js'),ren=read('js/renderer.js');
test('boss collapse runs ~5.2s, and full fade-out is followed by 6s roaming',()=>{
 const m=game.match(/const VICTORY = \{ explode: ([\d.]+), ignite: ([\d.]+), burn: ([\d.]+), dawn: ([\d.]+), dawnFade: ([\d.]+), settle: ([\d.]+) \}/);
 assert.ok(m,'victory timeline available');
 const [explode,ignite,burn,dawn,dawnFade,settle]=m.slice(1).map(Number);
 assert.ok(explode>=4.6&&explode<=6.6);
 assert.equal(Number((settle-ignite-burn).toFixed(2)),6);
 assert.ok(settle>dawn+dawnFade);
 assert.match(game,/v\.boss\.vanish =/);
});
test('delivery success excludes story fluff; ten-second ring has thick, visible diminishing segment',()=>{
 assert.match(game,/sayDelivery\(\[\x60\$\{w\.jp\}＝\$\{w\.zh\} 配達完遂！\x60\]/);
 assert.doesNotMatch(game,/sayDelivery\(\[.*storyLine\]/);
 assert.match(game,/ctx\.lineWidth = 22;/);
 assert.match(game,/const startA = -Math\.PI \/ 2 \+ Math\.PI \* 2 \* \(1 - timerFraction\)/);
});
test('fixed-height torii has no viewer-depth stretch, passive buttons share background and asset dimensions',()=>{
 const torii=ren.slice(ren.indexOf('if (chunk) {',ren.indexOf('function drawDecorActor')),ren.indexOf('} else if (tree)',ren.indexOf('function drawDecorActor')));
 assert.doesNotMatch(torii,/depthFactor/);
 assert.match(torii,/const th=Math\.round\(tw\*\(img\.naturalHeight\/img\.naturalWidth\)\)/);
 assert.match(ui,/passive\/normalized\/hud_passive_/);
 for(const id of ['shield','dmg','rate','crit','spd','dash','oil_max','mag']){
   assert.ok(fs.existsSync(path.join(root,'assets/img/ui/passive/normalized/hud_passive_'+id+'.webp')));
 }
});
test('variation cards have nine unique illustrations and night-town boss spells have three independent image paths',()=>{
 const ids=['mut_crosscut','mut_return','mut_pulse','mut_fan','mut_frost','mut_pierce','mut_branch','mut_orbit','mut_splitblast'];
 for(const id of ids){
  assert.ok(fs.existsSync(path.join(root,'assets/img/ui/upgrade/illustrations/'+id+'.webp')));
  assert.ok(ui.includes('"'+id+'"'),'formal illustration id: '+id);
 }
 for(const kind of ['slam','charge','ring']) assert.ok(fs.existsSync(path.join(root,'assets/img/vfx/boss-night-town/'+kind+'.webp')));
 assert.match(ren,/function drawNightBossImage/);
 assert.match(ren,/return drawNightBossImage\(c,h,elapsed\)/);
});
