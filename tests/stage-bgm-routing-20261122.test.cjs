'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const tracks = {
  'night-town': 'assets/audio/bgm/stages/night-town/night-town__parade.mp3',
  'rain-port': 'assets/audio/bgm/stages/rain-port/rain-port__battle.mp3',
  'sakura-pass': 'assets/audio/bgm/stages/sakura-pass/sakura-pass__battle.mp3',
  'bamboo-maze': 'assets/audio/bgm/stages/bamboo-maze/bamboo-maze__battle.mp3'
};

function makeAudio() {
  const created = [];
  class Clip {
    constructor(src) {
      this.src = src; this.loop = false; this.preload = 'none';
      this.paused = true; this.readyState = 4;
      this.volume = .27; this.currentTime = 0;
      this.playCount = 0; this.events = {};
      created.push(this);
    }
    addEventListener(event, fn) { this.events[event] = fn; }
    play() { this.paused = false; this.playCount++; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
  }
  const fallback = new Clip('old-night-town.mp3');
  const map = new Clip('map.mp3');
  const boss = new Clip('boss.mp3');
  const window = { BGM:fallback, MAP_BGM:map, BOSS_BGM:boss,
    audioAsset:path=>'resolved/'+path };
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),
    { window, Audio:Clip, console, setTimeout, clearTimeout });
  return { audio:window.AUDIO, window, created, fallback, map, boss };
}

test('only the selected one of four stage MP3s is constructed and played; map and boss music remain separate', () => {
  const {audio, window, created, fallback, map, boss} = makeAudio();
  assert.equal(created.length, 3, 'no level MP3 fetched or constructed on title screen');
  audio.prepareMusic('overworld');
  audio.restartMusic();
  audio.updateBgm(.016, 'overworld', 0, 600);
  assert.equal(map.paused, false);
  for (const [stage, path] of Object.entries(tracks)) {
    const previous = window.BGM;
    audio.prepareMusic('play', stage);
    const selected = window.BGM;
    assert.equal(selected.src, 'resolved/'+path);
    assert.equal(selected.preload, 'none', 'large MP3s must load lazily');
    assert.equal(selected.loop, true);
    assert.equal(created.filter(x=>x.src==='resolved/'+path).length, 1);
    audio.restartMusic();
    audio.updateBgm(.016, 'play', 5, 600);
    assert.equal(selected.paused, false);
    assert.equal(map.paused, true, 'leaving map pauses the map song');
    assert.equal(boss.paused, true, 'normal level does not start boss song');
    if (previous !== selected) assert.equal(previous.paused, true, 'old stage stops playing');
    audio.updateBgm(.016, 'levelup', 5, 600);
    assert.equal(selected.paused, false, 'upgrade cards keep the current level song');
    audio.updateBgm(.016, 'pause', 5, 600);
    assert.equal(selected.volume, .055, 'pause lowers rather than stops the music');
    audio.updateBgm(.016, 'play', 5, 600);
    assert.equal(selected.volume, .27);
  }
  assert.equal(created.length, 7, 'four levels and the three existing tracks only');
  assert.equal(fallback.paused, true);
});

test('level MP3 is kept for Boss crossfade and reused on replay, while map has its own song', () => {
  const {audio, window, created, map, boss} = makeAudio();
  audio.prepareMusic('play', 'rain-port');
  const rain = window.BGM;
  audio.restartMusic();
  audio.updateBgm(.01, 'play', 0, 600);
  audio.startBossMusic();
  audio.updateBgm(.55, 'play', 500, 600);
  assert.equal(boss.paused, false);
  assert.equal(rain.paused, false);
  assert.ok(Math.abs(rain.volume-.135)<.0001);
  audio.updateBgm(.55, 'victory', 600, 600);
  assert.equal(rain.paused, true);
  audio.stopBossMusic();
  audio.prepareMusic('overworld');
  audio.restartMusic();
  audio.updateBgm(.016, 'overworld', 0, 600);
  assert.equal(map.paused, false);
  audio.prepareMusic('play', 'rain-port');
  assert.equal(window.BGM, rain, 'replay reuses one decoded track object');
  assert.equal(created.filter(x=>x===rain).length, 1);
});

test('failed stage MP3 falls back to the former approved track without blocking mute or play', () => {
  const {audio,window,fallback,created} = makeAudio();
  audio.prepareMusic('play','sakura-pass');
  const failed = window.BGM;
  audio.restartMusic();
  audio.updateBgm(.016, 'play', 0, 600);
  assert.equal(failed.paused,false);
  failed.events.error();
  assert.equal(window.BGM, fallback);
  audio.updateBgm(.016,'play',0,600);
  assert.equal(fallback.paused,false);
  assert.equal(failed.paused,true, 'failed song must be stopped');
  audio.prepareMusic('play','sakura-pass');
  assert.equal(window.BGM, fallback, 'do not retry a broken MP3 every frame');
  assert.equal(created.length,4);
  audio.toggleMute();
  assert.equal(fallback.paused,true);
  audio.toggleMute();
  assert.equal(fallback.paused,false);
});

test('real game entry and map departure pass the stage id into the audio manager', () => {
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/AUDIO\.prepareMusic\?\.\('play', selected\.stageId\)/);
  assert.match(game,/function start\(stageId = STAGE\.id\)[\s\S]{0,180}AUDIO\.prepareMusic\?\.\('play', stageId\)/);
  for(const path of Object.values(tracks)) assert.ok(fs.statSync(path).size>1000000,path);
});
