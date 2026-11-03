'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = fs.readFileSync('js/game.js','utf8');

const extract = (start,end) => {
 const a=game.indexOf(start), b=game.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a, 'cannot extract '+start);
 return game.slice(a,b);
};
function chance(loc, force=false) {
 const env={CHARM_NORMAL_CHANCE:.008,CHARM_ELITE_CHANCE:.016,
  window:{location:loc,DEV_FORCE_CHARM:force,DEV_MODE:{
   isDevMode(l){
    const u=new URL(l.href);
    return (u.hostname==='127.0.0.1'||u.hostname==='localhost')&&u.searchParams.get('dev')==='1';
   }
  }}};
 vm.runInNewContext(extract('  function charmDropChance(e) {','  function charmDropArt()'),env);
 return env.charmDropChance;
}
test('Audit P1-1 production query parameters and global force flag cannot alter charm drop chance',()=>{
 for(const url of [
  'https://yorkwahaha.github.io/yokai-delivery/?dev=1&force_charm=1',
  'https://yorkwahaha.github.io/yokai-delivery/?dev=1',
  'https://example.com/?dev=1&force_charm=1',
  'http://192.168.50.107:8080/?dev=1&force_charm=1'
 ]) for(const flag of [false,true]) {
  const fn=chance(new URL(url),flag);
  assert.equal(fn({type:'ghost'}),.008,url);
  assert.equal(fn({type:'tank',elite:true}),.016,url);
  assert.equal(fn({type:'boss'}),0,url);
  assert.equal(fn({type:'mis'}),0,url);
 }
});
test('Audit P1-1 loopback dev mode still permits deliberate validation drops',()=>{
 const dev=chance(new URL('http://localhost:3000/?dev=1&force_charm=1'));
 assert.equal(dev({type:'ghost'}),1);
 const normal=chance(new URL('http://127.0.0.1:3000/?force_charm=1'));
 assert.equal(normal({type:'ghost'}),.008);
 assert.equal(chance(new URL('http://localhost:3000/?dev=1'),true)({type:'ghost'}),1);
});
test('Audit P1-4 pointer on letterbox is ignored and canvas capture exceptions cannot stop controls',()=>{
 const handlerSource=extract(
  '  document.getElementById("game-container").addEventListener("pointerdown", e => {',
  '    if (tutorial) {'
 );
 const env={frameError:false,document:{hidden:false},touch:false,inputMode:'keyboard',state:'menu',window:{},
  cv:{setPointerCapture(){throw new DOMException('invalid pointer','InvalidStateError');}},
  AUDIO:{calls:0,unlockFromInput(){this.calls++;}},disabledWordReplay:()=>false,
  isPortrait:()=>false,artPending:()=>false,noteLoadingGesture:()=>{},
  recoverFrameError:()=>{}};
 vm.runInNewContext(handlerSource.replace(
  '  document.getElementById("game-container").addEventListener("pointerdown", e => {',
  '  this.run = (e) => {') + '\n  };',env);
 const outside={target:{},pointerId:12,pointerType:'touch',preventDefault(){}};
 env.run(outside);
 assert.equal(env.touch,false);
 assert.equal(env.inputMode,'keyboard');
 const inside={...outside,target:env.cv,pointerType:'touch'};
 assert.doesNotThrow(()=>env.run(inside));
 assert.equal(env.touch,true);
 assert.equal(env.inputMode,'touch');
 assert.equal(env.AUDIO.calls,2);
});
test('Audit P1-5 M key unmute calls gesture unlock while muting does not',()=>{
 const snippet=extract('    if (action === "mute") {','    if (state === "codex") {');
 const env={AUDIO:{muted:false,unlocks:0,toggleMute(){this.muted=!this.muted;return this.muted;},
  unlockFromInput(){this.unlocks++;}}};
 vm.runInNewContext('this.pressMute=function(action){'+snippet+'\n};',env);
 env.pressMute('mute');
 assert.equal(env.AUDIO.muted,true);
 assert.equal(env.AUDIO.unlocks,0);
 env.pressMute('mute');
 assert.equal(env.AUDIO.muted,false);
 assert.equal(env.AUDIO.unlocks,1);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/game.js?v=20261103-dragon-phase29'));
});
