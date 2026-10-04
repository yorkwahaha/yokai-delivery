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


class PlaybackTestContext {
 static starts=0;
 constructor(){this.currentTime=0;this.state='running';}
 createOscillator(){return this.createGain();}
 createGain(){const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};return {frequency:param,gain:param,connect(){},start(){PlaybackTestContext.starts++;},stop(){}};}
}

test('interrupted iPad audio contexts are resumed instead of left silent',()=>{
  let resumes=0;
  class Context extends PlaybackTestContext {constructor(){super();this.state='interrupted';}resume(){resumes++;this.state='running';return Promise.resolve();}}
  const env={window:{AudioContext:Context},Audio:class {addEventListener(){}},console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  env.window.AUDIO.init();assert.equal(resumes,1);
});

test('blocked MP3 effects use the unlocked synthesizer and still retry the MP3',async()=>{
  const before=PlaybackTestContext.starts;let calls=0;
  class Audio {constructor(){}addEventListener(){}pause(){}play(){calls++;return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));}}
  const env={window:{AudioContext:PlaybackTestContext},Audio,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  env.window.AUDIO.dash();await Promise.resolve();env.window.AUDIO.dash();await Promise.resolve();
  assert.equal(calls,2);assert.equal(PlaybackTestContext.starts-before,2);
});

function bufferedAudioFixture() {
  const requested=[],sources=[];let mediaPlays=0,decodes=0,finishLoad;
  class Audio {constructor(src){this.src=src;}addEventListener(){}pause(){}play(){mediaPlays++;return Promise.reject(Object.assign(new Error('policy'),{name:'NotAllowedError'}));}}
  class Context extends PlaybackTestContext {
    suspend(){this.state='suspended';return Promise.resolve();}
    resume(){this.state='running';return Promise.resolve();}
    createBufferSource(){const s={connect(){},start(){sources.push(this);},stop(){this.stopped=true;this.onended?.();}};return s;}
    decodeAudioData(){decodes++;return Promise.resolve({duration:0.4});}
  }
  const env={window:{AudioContext:Context,audioAsset:p=>p+'?v=test'},Audio,console,setTimeout,clearTimeout,
    fetch:src=>{requested.push(src);return new Promise(resolve=>{finishLoad=()=>resolve({ok:true,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8))});});}};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  return {a:env.window.AUDIO,requested,sources,load:()=>finishLoad(),counts:()=>({mediaPlays,decodes})};
}
const drainAudio=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};

test('cold word audio fetches once, decodes once and reuses unlocked buffer playback',async()=>{
  const f=bufferedAudioFixture();f.a.speak('あめ');f.load();await drainAudio();
  assert.equal(f.sources.length,1);assert.equal(f.counts().mediaPlays,0);
  f.a.speak('あめ');await drainAudio();
  assert.equal(f.sources.length,2);assert.equal(f.sources[0].stopped,true);
  assert.equal(f.requested.length,1);assert.equal(f.counts().decodes,1);
  assert.equal(f.requested[0],'assets/audio/words/ame.mp3?v=test');
});

test('late decoded audio never starts after suspension or a replaced word',async()=>{
  for(const action of ['suspend','mute','replace']) {
    const f=bufferedAudioFixture();f.a.speak('あめ');
    if(action==='suspend')f.a.setSuspended(true);
    else if(action==='mute')f.a.toggleMute();
    else f.a.speak('あめ');
    f.load();await drainAudio();assert.equal(f.sources.length,action==='replace'?1:0,action);
  }
});

test('buffered audio stops immediately on mute or suspension and does not replay on wake',async()=>{
  for(const action of ['suspend','mute']) {
    const f=bufferedAudioFixture();f.a.speak('あめ');f.load();await drainAudio();
    assert.equal(f.sources.length,1);
    if(action==='suspend'){f.a.setSuspended(true);f.a.setSuspended(false);}else{f.a.toggleMute();f.a.toggleMute();}
    assert.equal(f.sources[0].stopped,true);assert.equal(f.sources.length,1);
  }
});
test('temporary playback cancellation and policy rejection never permanently disable an MP3', async () => {
 for (const name of ['AbortError','NotAllowedError','NetworkError']) {
 const clips=[]; let calls=0;
 class Audio {constructor(src){this.src=src;this.error=null;clips.push(this);}addEventListener(){}pause(){}play(){calls++;return calls===1?Promise.reject(Object.assign(new Error(name),{name})):Promise.resolve();}}
 const env={window:{AudioContext:PlaybackTestContext},Audio,console,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
 clips.length=0;env.window.AUDIO.dash();await Promise.resolve();env.window.AUDIO.dash();await Promise.resolve();
 assert.equal(clips.length,2,name);assert.equal(calls,2,name);
 }
 });
 test('a genuine unsupported MP3 uses synthesis and suppresses repeat requests',async()=>{
 const starts=PlaybackTestContext.starts;
 let calls=0;class Audio{constructor(src){this.src=src;}addEventListener(){}pause(){}play(){calls++;return Promise.reject(Object.assign(new Error('unsupported'),{name:'NotSupportedError'}));}}
 const env={window:{AudioContext:PlaybackTestContext},Audio,console,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
 env.window.AUDIO.dash();await Promise.resolve();env.window.AUDIO.dash();assert.equal(calls,1);assert.equal(PlaybackTestContext.starts-starts,2);
 });
