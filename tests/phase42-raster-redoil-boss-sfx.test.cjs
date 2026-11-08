'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('new Phase42 pause, exit, and card info sprites are complete raster WebPs',()=>{
 const root=path.join(__dirname,'../assets/img/ui/phase42');
 for(const file of ['pause_board','exit_board','button_normal','button_danger','title_plaque','detail_board']){
   const p=path.join(root,file+'.webp'),bytes=fs.readFileSync(p);
   assert.equal(bytes.subarray(0,4).toString('latin1'),'RIFF');
   assert.equal(bytes.subarray(8,12).toString('latin1'),'WEBP');
   assert.ok(bytes.length>12000,file+' must be real painted raster art');
 }
 const ui=fs.readFileSync('js/ui.js','utf8');
 assert.match(ui,/const phase42MenuArt=/);
 assert.match(ui,/button_normal/);
 assert.match(ui,/pause_board/);
 assert.match(ui,/exit_board/);
 assert.match(ui,/title_plaque/);
 assert.match(ui,/phase42\/"\+key/);
 const cards=fs.readFileSync('js/ui-upgrade-trial.js','utf8');
 assert.match(cards,/phase42\/detail_board\.webp/);
});

test('low oil red alert now paints a gradient on every edge without masking center',()=>{
 const ui=fs.readFileSync('js/ui.js','utf8');
 const fn=ui.slice(ui.indexOf('function drawLowOil('),ui.indexOf('function drawMinimap('));
 assert.match(fn,/gradients\.top/);
 assert.match(fn,/gradients\.bottom/);
 assert.match(fn,/gradients\.left/);
 assert.match(fn,/gradients\.right/);
 assert.match(fn,/\.75\+\.25\*Math\.sin/);
 assert.match(ui,/oilRatio <= 0\.25/);
});

test('final Boss death requests only author-supplied MP3, never a synthetic explosion',async()=>{
 const requests=[];
 class Audio{
   constructor(path){requests.push(path);this.error={code:4};}
   addEventListener(){}
   play(){return Promise.reject(new Error('MP3 not yet installed'));}
   pause(){}
 }
 const source=fs.readFileSync('js/audio.js','utf8');
 const env={window:{},Audio,setTimeout,clearTimeout,console};
 vm.runInNewContext(source,env,{timeout:1000});
 env.window.AUDIO.finalBossDeath();
 await Promise.resolve();await Promise.resolve();
 assert.equal(requests.length,1);
 assert.equal(requests[0],'assets/audio/sfx/final-boss-death.mp3');
 const game=fs.readFileSync('js/game.js','utf8');
 assert.match(game,/if\(e\.final\)AUDIO\.finalBossDeath\?\.\(\);/);
 assert.match(game,/else AUDIO\.bossDeath\(\);/);
 const fallback=source.slice(source.indexOf('finalBossDeath() {'),source.indexOf('fanfare() {'));
 assert.doesNotMatch(fallback,/playTaiko|createOscillator|playSuzu/);
});
