'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {loadGame}=require('./helpers/game-runtime.cjs');

function audioEnv(savedMute='false'){
 let resumeCount=0, playCount=0;
 const bgm={
  paused:true,volume:.27,readyState:4,currentTime:0,loop:true,
  play(){playCount++;this.paused=false;return Promise.resolve();},
  pause(){this.paused=true;}
 };
 class AudioContext {
  constructor(){this.state='running';this.destination={};}
  resume(){resumeCount++;this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
 }
 const env={console,Promise,Date,Map,Set,WeakMap,WeakSet,setTimeout,clearTimeout,
   window:{AudioContext,BGM:bgm,MAP_BGM:null,BOSS_BGM:null},
   document:{hidden:false}, localStorage:{getItem:()=>savedMute,setItem(){}}
 };
 vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
 return {api:env.window.AUDIO,bgm,get resumes(){return resumeCount},get plays(){return playCount},env};
}

test('game audio recovers BGM and WebAudio after visible window loses focus',async()=>{
 const s=audioEnv();
 s.api.init();
 s.api.updateBgm(.016,'play',10,700);
 await Promise.resolve();
 assert.ok(s.plays>=1,'initial BGM audible playback attempted');
 s.api.setSuspended(true);
 assert.equal(s.api.isSuspended(),true);
 assert.equal(s.bgm.paused,true);
 const previous=s.plays;
 assert.equal(s.api.unlockFromInput(),true);
 await Promise.resolve();
 assert.equal(s.api.isSuspended(),false);
 assert.ok(s.resumes>=1,'WebAudio context resumed');
 assert.ok(s.plays>previous,'music attempts resume after interaction');
});

test('audio recovery respects persistent mute and hidden-tab policy',()=>{
 const s=audioEnv('true');
 assert.equal(s.api.isMuted(),true);
 assert.equal(s.api.unlockFromInput(),false);
 assert.equal(s.plays,0);
 const t=audioEnv();
 t.env.document.hidden=true;
 assert.equal(t.api.unlockFromInput(),false);
 assert.equal(t.plays,0);
});

function pad(){
 const buttons=Array.from({length:17},()=>({pressed:false}));
 return {buttons,connected:true,axes:[0,0],mapping:'standard'};
}

test('home controller Start enters overworld without mouse or keyboard',()=>{
 const g=loadGame();
 const gp=pad();
 g.env.navigator.getGamepads=()=>[gp];
 assert.equal(g.snapshot().state,'menu');
 gp.buttons[9].pressed=true;
 g.stepFrame(16.7);
 gp.buttons[9].pressed=false;
 g.stepFrame(16.7);
 g.stepFrames(12,16.7);
 assert.equal(g.snapshot().state,'overworld');
 assert.ok(g.audioCalls.includes('unlockFromInput'));
});

test('home controller A confirms focused start and Y toggles sound',()=>{
 const g=loadGame();
 const gp=pad();g.env.navigator.getGamepads=()=>[gp];
 gp.buttons[3].pressed=true;g.stepFrame(16.7);
 gp.buttons[3].pressed=false;g.stepFrame(16.7);
 assert.ok(g.audioCalls.includes('toggleMute'));
 gp.buttons[0].pressed=true;g.stepFrame(16.7);
 gp.buttons[0].pressed=false;g.stepFrame(16.7);
 g.stepFrames(12,16.7);
 assert.equal(g.snapshot().state,'overworld');
});

test('home menu shows gamepad controls plus mute or audio-block instructions',()=>{
 const ui=fs.readFileSync('js/ui.js','utf8');
 const game=fs.readFileSync('js/game.js','utf8');
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(ui.includes('Start 進入旅路'));
 assert.ok(ui.includes('瀏覽器封鎖音效'));
 assert.match(game,/state === "menu" && justPressed\(9\)/);
 assert.match(game,/AUDIO\.unlockFromInput\?\.\(\)/);
 for (const mod of ['audio','ui'])
  assert.ok(html.includes('js/'+mod+'.js?v=20261102-audio-pad-hotfix'));
 assert.ok(html.includes('js/game.js?v=20261103-delivery-phase21'));
});
