'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const game=read('js/game.js'),ui=read('js/ui.js'),audio=read('js/audio.js'),renderer=read('js/renderer.js');
const boss=require('../js/boss-ai.js');
test('B6 night-town charge doubles physical speed and expands length/width with the same blocked path',()=>{
 const e={x:0,y:0,hp:300,max:300,bossIndex:1,shield:false,_attackStep:1,attackCd:0};
 const p={x:240,y:44},opts={stageId:'night-town',bossVisualFootOffsetY:44,blocked:()=>false};
 boss.step(e,p,.01,opts);
 assert.equal(e.hazard.kind,'charge');
 assert.equal(e.hazard.speed,1240);
 assert.equal(e.hazard.r,76);
 assert.ok(e.hazard.length>800);
 assert.equal(e.hazard.y,44);
 boss.step(e,p,1.01,opts);
 let lastX=e.x;
 for(let i=0;i<10;i++){boss.step(e,p,.05,opts);lastX=e.x;}
 assert.ok(lastX>=600,'visible dash must move 2x the former speed');
 assert.match(renderer,/charge_aura/);
 assert.match(renderer,/releasedNightBossArt\(\)/);
 const img=fs.readFileSync(path.join(root,'assets/img/vfx/boss-night-town/charge_aura.webp'));
 assert.equal(img.toString('ascii',0,4),'RIFF');
});
test('B6 shield has 2s reveal, stronger alpha and left-right narrow reflection sweep',()=>{
 assert.match(renderer,/shieldClock\(\) % 2000/);
 assert.match(renderer,/blinkT < 340/);
 assert.match(renderer,/0\.98 \* Math.max/);
 assert.match(renderer,/const sweep = -100 \+ \(blinkT \/ 340\) \* 200/);
 assert.match(renderer,/createLinearGradient\(sweep-26/);
});
test('B6 Boss quiz uses painted card art, centered cargo image and question mark, never Chinese name',()=>{
 const q=ui.slice(ui.indexOf('  function drawBossQuiz('),ui.indexOf('  // ---- 奧義融合',ui.indexOf('  function drawBossQuiz(')));
 assert.match(q,/formalUpgradeArt\.card_dark/);
 assert.match(q,/window.DELIVERY_ICON_ART\?\.imageFor\?\.\(bossQ.word\)/);
 assert.match(q,/ctx.fillText\("？",mid\+29/);
 assert.doesNotMatch(q,/bossQ.word.zh/);
 assert.match(q,/ctx.textAlign="center"/);
});
test('B6 ground charm and swap use same six transparent, tightly cropped colored WebPs',()=>{
 assert.match(game,/UI.charmArtFor\?\.\(d.charmId\)/);
 assert.match(ui,/charmArtFor: id => illustratedCharms/);
 assert.match(ui,/charm-passive\/b7\/omamori_/);
 for(const id of ['power','step','gather','cadence','reach','guard']){
   const file=fs.readFileSync(path.join(root,'assets/img/ui/charm-passive/b7', 'omamori_'+id+'.webp'));
   assert.equal(file.toString('ascii',0,4),'RIFF');
   assert.equal(file.toString('ascii',8,12),'WEBP');
 }
 assert.match(ui,/const artH=cardH\*\.655/);
});
test('B6 Lv5 uses the provided SFX without replacing stage-complete fanfare; charm pickup route is reserved',()=>{
 assert.ok(fs.statSync(path.join(root,'assets/audio/sfx/skilllv5.mp3')).size>1000);
 assert.match(audio,/skillLv5: "assets\/audio\/sfx\/skilllv5.mp3"/);
 assert.match(game,/AUDIO.skillLv5\?\.\(\)/);
 assert.match(game,/if \(state === "won"\) AUDIO.fanfare\(\)/);
 assert.match(audio,/charmPickup: "assets\/audio\/sfx\/charm-pickup.mp3"/);
 assert.match(game,/AUDIO.charmPickup\?\.\(\)/);
});
test('B6 Lv5 talisman creates a bounded secondary spark-smoke burst in addition to its main painted hit',()=>{
 assert.match(game,/SKILLFX.play\("boom", "hit", rank/);
 assert.match(game,/if \(rank === 5\) \{/);
 assert.match(game,/boomLv5BurstFx.push\(/);
 assert.match(game,/boomLv5BurstFx.length >= 16/);
 assert.match(game,/for \(const fx of boomLv5BurstFx\)/);
 assert.match(game,/const jump=fx.radius/);
 assert.match(game,/const py=fx.y/);
});
