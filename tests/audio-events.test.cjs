const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('muting during a speech ramp cannot leave stale music volume after unmute',()=>{
  const ramps=new Map();let next=0;
  class Audio {constructor(){this.paused=true;this.volume=0.27;}addEventListener(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const track=new Audio(),env={window:{BGM:track},Audio,console,setTimeout,clearTimeout,performance:{now:()=>0},requestAnimationFrame:cb=>{ramps.set(++next,cb);return next;},cancelAnimationFrame:id=>ramps.delete(id)};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  const a=env.window.AUDIO;a.updateBgm(0.01,'play',0,600);a.speak('ねこ');a.toggleMute();a.toggleMute();
  assert.equal(ramps.size,0);assert.equal(track.volume,0.27);assert.equal(track.paused,false);
});

test('repeated buffered shield effects replace the previous voice',async()=>{
  const f=bufferedAudioFixture();f.a.breakShield();f.load();await drainAudio();
  f.a.breakShield();await drainAudio();
  assert.equal(f.sources.length,2);assert.equal(f.sources[0].stopped,true);
});

test('Web Audio output shares compression and ducks effects while speech plays',()=>{
  const gains=[],compressors=[];
  class Context extends PlaybackTestContext {
    createGain(){const n=super.createGain();n.gain.value=1;gains.push(n);return n;}
    createDynamicsCompressor(){const n={connect(){}};for(const k of ['threshold','knee','ratio','attack','release'])n[k]={value:0};compressors.push(n);return n;}
  }
  class Audio {constructor(){}addEventListener(){}pause(){}play(){return Promise.resolve();}}
  const env={window:{AudioContext:Context},Audio,console,setTimeout:()=>0,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  const a=env.window.AUDIO;a.pickup();assert.equal(compressors.length,1);assert.equal(compressors[0].ratio.value,12);
  a.speak('ねこ');const ducked=gains.filter(n=>n.gain.value===0.3);assert.equal(ducked.length,1);a.stopSpeech();assert.equal(ducked[0].gain.value,1);
});
test('blocked BGM attempts once until a user gesture retries it', async()=>{
  let attempts=0;const track={paused:true,volume:0,pause(){},play(){attempts++;return Promise.reject(new Error('NotAllowedError'));}};
  class Audio {addEventListener(){} pause(){} play(){return Promise.resolve();}}
  const env={window:{BGM:track,AudioContext:class {}},Audio,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  const a=env.window.AUDIO;for(let i=0;i<60;i++)a.updateBgm(0.016,'play',0,600);
  await Promise.resolve();assert.equal(attempts,1);a.init();assert.equal(attempts,2);
});

test('restartMusic rewinds both tracks so replay and map start from the beginning',()=>{
  const mk=()=>({paused:false,volume:0,currentTime:42,pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}});
  const bgm=mk(),map=mk();class Audio {addEventListener(){} pause(){} play(){return Promise.resolve();}}
  const env={window:{BGM:bgm,MAP_BGM:map,AudioContext:class {}},Audio,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  env.window.AUDIO.restartMusic();
  assert.equal(bgm.currentTime,0);assert.equal(map.currentTime,0);assert.equal(bgm.paused,true);
  env.window.AUDIO.updateBgm(0.016,'play',0,600);assert.equal(bgm.paused,false);
});

test('mute setting persists across audio reloads',()=>{
  const storage=new Map();class Audio {addEventListener(){} pause(){} play(){return Promise.resolve();}}
  const env={window:{},Audio,console,setTimeout,clearTimeout,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  const source=fs.readFileSync('js/audio.js','utf8');vm.runInNewContext(source,env);
  env.window.AUDIO.toggleMute();vm.runInNewContext(source,env);assert.equal(env.window.AUDIO.isMuted(),true);
});
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
    createBufferSource(){const s={playbackRate:{value:1},connect(){},start(){sources.push(this);},stop(){this.stopped=true;this.onended?.();}};return s;}
    decodeAudioData(){decodes++;return Promise.resolve({duration:0.4});}
  }
  const env={window:{AudioContext:Context,audioAsset:p=>p+'?v=test'},Audio,console,setTimeout,clearTimeout,
    fetch:src=>{requested.push(src);return new Promise(resolve=>{finishLoad=()=>resolve({ok:true,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8))});});}};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  return {a:env.window.AUDIO,requested,sources,load:()=>finishLoad(),counts:()=>({mediaPlays,decodes})};
}
const drainAudio=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};

test('all six skills route levels 1-4 and 5 to distinct filenames and fall back to legacy audio',()=>{
  const tracks=[];
  class Audio {constructor(src){this.src=src;this.handlers={};tracks.push(this);}addEventListener(k,fn){this.handlers[k]=fn;}pause(){}play(){return Promise.resolve();}}
  const env={window:{},Audio,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  for(const [method,id] of [['slash','katana'],['barrier','barrier'],['needle','needle'],['boomerang','boom'],['fireball','fire'],['thunder','thunder']]) {
    for(const level of [1,4,5]) {
      env.window.AUDIO[method](level);
      assert.equal(tracks.at(-1).src,`assets/audio/sfx/${id}-${level===5?'lv5':'lv1-4'}.mp3`);
    }
  }
  env.window.AUDIO.slash(5);const failed=tracks.at(-1);failed.error={code:4};failed.handlers.error();
  assert.equal(tracks.at(-1).src,'assets/audio/sfx/slash.mp3');
  env.window.AUDIO.slash(5);assert.equal(tracks.at(-1).src,'assets/audio/sfx/slash.mp3');
});

test('warning sound uses original playback rate in buffer and media fallback',async()=>{
  const f=bufferedAudioFixture();f.a.warningPulse(3);f.load();await drainAudio();
  assert.equal(f.sources[0].playbackRate.value,1);
  const tracks=[];
  class Audio {constructor(src){this.src=src;this.playbackRate=1;tracks.push(this);}addEventListener(){}pause(){}play(){return Promise.resolve();}}
  const env={window:{},Audio,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('js/audio.js','utf8'),env);
  env.window.AUDIO.warningPulse(3);assert.equal(tracks.at(-1).playbackRate,1);
});

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
