const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(withBoss=true) {
  const create = () => ({ paused: true, volume: .27, currentTime: 0, loop: true,
    attempts: 0, pause() {this.paused=true;}, play() {this.paused=false;this.attempts++;return Promise.resolve();} });
  const bgm=create(),map=create(),boss=withBoss?create():null;
  const env={window:{BGM:bgm,MAP_BGM:map,BOSS_BGM:boss},Audio:class {},console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  return {audio:env.window.AUDIO,bgm,map,boss};
}

test('final boss seal crossfades ordinary BGM into Boss BGM over 1.1s',()=>{
  const {audio,bgm,boss}=fixture();audio.updateBgm(.01,'play',0,600);
  assert.equal(bgm.paused,false);assert.equal(boss.attempts,0);
  audio.startBossMusic();assert.equal(boss.paused,false);assert.equal(boss.volume,0);
  audio.updateBgm(.55,'play',0,600);
  assert.ok(Math.abs(boss.volume-.135)<.0001);
  assert.ok(Math.abs(bgm.volume-.135)<.0001);
  audio.updateBgm(.55,'victory',600,600);
  assert.equal(bgm.paused,true);
  assert.equal(boss.paused,false);
  assert.equal(boss.volume,.27);
});

test('Boss BGM continues throughout victory sequence and ends at results',()=>{
  const {audio,bgm,boss,map}=fixture();audio.updateBgm(.01,'play',0,600);
  audio.startBossMusic();audio.updateBgm(1.2,'play',600,600);
  audio.updateBgm(.016,'victory',600,600);assert.equal(boss.paused,false);
  audio.stopBossMusic();
  assert.equal(boss.paused,true);assert.equal(bgm.paused,true);
  audio.updateBgm(.016,'won',600,600);
  assert.equal(boss.paused,true);
  audio.restartMusic();audio.updateBgm(.016,'overworld',0,600);
  assert.equal(map.paused,false);assert.equal(boss.paused,true);
});

test('Boss track missing gracefully retains original BGM and normal level behavior',()=>{
  const {audio,bgm}=fixture(false);audio.updateBgm(.016,'play',0,600);
  audio.startBossMusic();audio.updateBgm(.8,'play',600,600);
  assert.equal(bgm.paused,false);
  assert.equal(bgm.volume,.27);
});
