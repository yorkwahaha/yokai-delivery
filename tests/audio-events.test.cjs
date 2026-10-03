const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
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
  clips.length = 0; // Vocabulary preloads are independent of event SFX.
  for (const name of ['bossDeath', 'fanfare', 'lose', 'needle', 'dash', 'boomerang', 'sanctuary']) audio[name]();
  assert.deepEqual(clips.map(c => c.src), ['boss-death', 'fanfare', 'lose', 'needle', 'dash', 'boomerang', 'sanctuary'].map(n => `assets/audio/sfx/${n}.mp3?v=test`));
  audio.toggleMute(); audio.fanfare(); audio.lose();
  assert.equal(clips.length, 7);
});
