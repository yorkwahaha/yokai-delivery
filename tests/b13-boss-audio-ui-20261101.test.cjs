'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('js/game.js'),ui=read('js/ui.js'),renderer=read('js/renderer.js');
const segment=(src,start,end)=>{const a=src.indexOf(start);assert.ok(a>=0,start);const b=src.indexOf(end,a+start.length);assert.ok(b>a,end);return src.slice(a,b);};
test('B13 pause to overworld requires confirmed navigation before preplaying MAP BGM',()=>{
 const fn=segment(game,'  function activateWithFeedback(id) {','  function menuButtons() {');
 const run=(state,id)=>{
   const sandbox={ calls:[],state,id };
   const code=[
     'var state='+JSON.stringify(state)+';',
     'var pendingMenuActivation=null, endCooldown=0, quitConfirm=false;',
     'const AUDIO={prepareMusic:(x)=>calls.push(x)};',
     'const UI={pressButton:(x)=>calls.push("pressed:"+x)};',
     fn,
     'activateWithFeedback('+JSON.stringify(id)+');',
     'var outcome={calls,pendingMenuActivation};'
   ].join('\n');
   vm.runInNewContext(code,sandbox);
   return sandbox.outcome;
 };
 assert.equal(run('pause','world').calls.includes('overworld'),false);
 assert.equal(run('pause','world').pendingMenuActivation.id,'world');
 assert.equal(run('won','world').calls.includes('overworld'),true);
 assert.equal(run('menu','start').calls.includes('overworld'),true);
 assert.equal(run('lost','restart').calls.includes('play'),true);
 assert.match(game,/id === "exit-cancel"[\s\S]{0,180}AUDIO\.dropPrepared\?\.\(\)/);
});
test('B13 one raster boss charge lane has no extra arrows, line strokes or boxed corridor',()=>{
 const section=segment(renderer,'    } else if (kind==="charge") {','    bossHazardPass = "BOSS_NIGHT_IMAGE";');
 assert.match(section,/c\.drawImage\(art,0,-width\/2,len,width\)/);
 assert.match(section,/h\.length/);
 assert.match(section,/h\.angle/);
 assert.match(section,/h\.r/);
 assert.doesNotMatch(section,/c\.stroke\(|c\.rect\(|c\.lineTo\(|for\s*\(/);
 assert.match(renderer,/charge_single_b13/);
 const file=fs.readFileSync(path.join(root,'assets/img/vfx/boss-night-town/charge_single_b13.webp'));
 assert.equal(file.toString('ascii',8,12),'WEBP');
});
test('B13 actual fully painted title and fresh menu board + two matching button variants exist',()=>{
 for(const file of ['menu_board','menu_button','menu_button_danger','surge_warning']){
   const f=fs.readFileSync(path.join(root,'assets/img/ui/b13',file+'.webp'));
   assert.equal(f.toString('ascii',8,12),'WEBP',file);
   assert.ok(f.length>10000,file);
 }
 assert.match(ui,/const art=b14SurgeBrush/);
 assert.match(ui,/drawB13MenuButton\(ctx,b,label/);
 assert.match(ui,/drawRibbonSlices\(ctx,img,b\.x,b\.y,b\.w,b\.h/);
 assert.match(ui,/function drawPausePaper\(/);
 assert.match(ui,/ctx\.drawImage\(art,x,y,w,h\)/);
});
test('B13 no previous mismatched gray-overlaid panel or old button renderer in two modals',()=>{
 const pause=segment(ui,'  function drawPauseMenu(','  // 8. 百鬼夜行');
 const exit=segment(ui,'  function drawExitConfirm(','  const controlLabel = ');
 assert.match(pause,/drawPausePaper\(ctx,panelX,panelY,boardW,boardH,compact\?"exit":"pause"\)/);
 assert.match(pause,/drawB13MenuButton/);
 assert.match(exit,/drawPausePaper\(ctx,146,132,608,310,"exit"\)/);
 assert.match(exit,/drawB13MenuButton/);
 assert.doesNotMatch(pause,/b12Art\.modal_board|drawButton\(ctx, b, label/);
 assert.doesNotMatch(exit,/b12Art\.modal_board|drawButton\(ctx,b,i===/);
});
test('B13 right-side order labels stay with high contrast ink outline and shadow',()=>{
 const order=segment(ui,'  function drawOrderList(','  // Each live Boss gets');
 assert.match(order,/inkText\(ctx, o\.word\.zh/);
 assert.match(order,/ctx\.shadowBlur\s*=\s*6/);
 assert.match(order,/rgba\(15,9,23,\.92\)/);
});
test('B13 real 2/3/4 passive capacity light bar is narrow and softly glowing',()=>{
 const passive=segment(ui,'    const passives = [','    const hiddenPassives');
 assert.match(passive,/maxStacks=\{shield:3,dmg:4,rate:4,crit:3,spd:3/);
 assert.match(passive,/Math\.min\(5\.5,iconSize\*\.065\)/,
   'narrow passive stack segments scale with the approved icon, not the outer paper slot');
 assert.match(passive,/255,232,68/);
 assert.match(passive,/Date\.now\(\)\/1000\*2\.4/);
 const n=['shield','dmg','rate','crit','spd','dash','oil_max','mag','oil_heal'];
 for(const id of n){
  const f=fs.readFileSync(path.join(root,'assets/img/ui/b13/passive_'+id+'.webp'));
  assert.equal(f.toString('ascii',8,12),'WEBP');
 }
});
