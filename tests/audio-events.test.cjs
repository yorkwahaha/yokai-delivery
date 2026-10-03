const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('pause lowers music and speech completion cannot restore full volume until resume', () => {
  const clips = [];
  class Audio {
    constructor() { this.volume = 0.27; this.paused = true; clips.push(this); }
    addEventListener() {}
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const track = new Audio();
  const env = { window: { BGM: track }, Audio, console, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync('js/audio.js', 'utf8'), env);
  const audio = env.window.AUDIO;
  audio.updateBgm(0.016, 'play', 0, 600);
  assert.equal(track.volume, 0.27);
  audio.updateBgm(0.016, 'pause', 0, 600);
  assert.equal(track.volume, 0.055);
  audio.speak('かさ');
  const spoken = clips.find(clip => typeof clip.onended === 'function');
  assert.ok(spoken);
  spoken.onended();
  assert.equal(track.volume, 0.055);
  audio.updateBgm(0.016, 'play', 0, 600);
  assert.equal(track.volume, 0.27);
  audio.toggleMute(); audio.updateBgm(0.016, 'pause', 0, 600);
  assert.equal(track.paused, true);
});
test('new event clips and replaced SFX use versioned paths and respect mute', () => {
  const clips = [];
  class Audio {
    constructor(src) { this.src = src; clips.push(this); }
    addEventListener() {}
    play() { return Promise.resolve(); }
    pause() {}
  }
  const env = { window: { audioAsset: path => path + '?v=test' }, Audio, console, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync('js/audio.js', 'utf8'), env);
  const audio = env.window.AUDIO;
  assert.ok(clips.every(clip => clip.preload === 'none'));
  clips.length = 0; // Vocabulary clips download only when spoken.
  for (const name of ['bossDeath', 'fanfare', 'lose', 'needle', 'dash', 'boomerang', 'sanctuary']) audio[name]();
  assert.deepEqual(clips.map(c => c.src), ['boss-death', 'fanfare', 'lose', 'needle', 'dash', 'boomerang', 'sanctuary'].map(n => `assets/audio/sfx/${n}.mp3?v=test`));
  audio.toggleMute(); audio.fanfare(); audio.lose();
  assert.equal(clips.length, 7);
});
