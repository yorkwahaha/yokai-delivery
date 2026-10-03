const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('all vocabulary maps to an existing prerecorded clip, including every rain-port word', () => {
  const played = [];
  class Audio {
    constructor(src) { this.src = src; }
    addEventListener() {}
    pause() {}
    play() { played.push(this.src); return Promise.resolve(); }
  }
  const env = { window: {}, Audio, console, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync('js/audio.js', 'utf8'), env);
  const words = require('../js/words.js').getAllWords();
  for (const word of words) {
    const count = played.length;
    env.window.AUDIO.speak(word.jp);
    assert.equal(played.length, count + 1, word.jp);
    assert.ok(fs.existsSync(played.at(-1)), `${word.jp}: ${played.at(-1)}`);
  }
});
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
  assert.ok(clips.every(clip => clip.src.endsWith('?v=test')));
  clips.length = 0; // Vocabulary clips download only when spoken.
  for (const name of ['bossDeath', 'fanfare', 'lose', 'needle', 'dash', 'boomerang', 'sanctuary']) audio[name]();
  assert.deepEqual(clips.map(c => c.src), ['boss-death', 'fanfare', 'lose', 'needle', 'dash', 'boomerang', 'sanctuary'].map(n => `assets/audio/sfx/${n}.mp3?v=test`));
  audio.toggleMute(); audio.fanfare(); audio.lose();
  assert.equal(clips.length, 7);
});

test('suspension stops music, speech and queued ramps without a frame and stale speech cannot restart them', () => {
  const clips=[], ramps=new Map(); let next=1;
  class Audio {
    constructor(src) {this.src=src;this.paused=true;this.volume=0.27;clips.push(this);}
    addEventListener() {}
    play() {this.paused=false;return Promise.resolve();}
    pause() {this.paused=true;}
  }
  const track=new Audio('bgm');
  const env={window:{BGM:track},Audio,console,setTimeout,clearTimeout,performance:{now:()=>0},
    requestAnimationFrame: cb=>{const id=next++;ramps.set(id,cb);return id;},cancelAnimationFrame:id=>ramps.delete(id)};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  const a=env.window.AUDIO;
  a.updateBgm(0.016,'play',0,600); a.speak('ねこ');
  const word=clips.find(c=>typeof c.onended==='function');
  const staleEnd=word.onended;
  assert.ok(ramps.size>0);
  a.setSuspended(true);
  assert.equal(track.paused,true); assert.equal(word.paused,true); assert.equal(ramps.size,0);
  staleEnd(); a.updateBgm(0.016,'play',0,600); a.speak('いぬ');
  a.toggleMute();a.toggleMute();
  assert.ok(clips.every(c=>c.paused));
  a.setSuspended(false); a.updateBgm(0.016,'pause',0,600);
  assert.equal(track.paused,false); assert.equal(word.paused,true);
});

test('six absent SFX synthesize immediately and never create missing-file Audio requests', () => {
  const clips=[]; let starts=0;
  class Audio {constructor(src){this.src=src;clips.push(this);}addEventListener(){}play(){return Promise.resolve();}pause(){}}
  const param={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
  const node=()=>({frequency:param,gain:param,connect(){},start(){starts++;},stop(){}});
  class AudioContext {
    constructor(){this.currentTime=0;this.sampleRate=48000;this.state='running';}
    createOscillator(){return node();} createGain(){return node();} createBiquadFilter(){return node();}
    createBufferSource(){return node();} createBuffer(){return {getChannelData:()=>new Float32Array(20)};}
  }
  const env={window:{AudioContext},Audio,console,setTimeout:()=>0,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  const audio=env.window.AUDIO;clips.length=0;
  for (const name of ['fireball','thunder','barrier','hurt','gem','pickup']) {
    const before=starts;audio[name](); assert.ok(starts>before,name);
  }
  assert.equal(clips.length,0);
  audio.toggleMute(); const before=starts;audio.fireball(); assert.equal(starts,before);
});
