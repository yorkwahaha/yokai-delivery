const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
require('../js/delivery-lexicon.js');
const CONTENT=require('../js/words.js');
const ROOT=path.resolve(__dirname,'..');
const LEXICON=globalThis.DELIVERY_LEXICON;

test('NIGHT-APPROVED 第一關 20 張正式水墨 WebP 適配同一詞表',()=>{
  const man=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/img/delivery/night-town/manifest.json'),'utf8'));
  assert.equal(man.status,'APPROVED_BY_USER');
  assert.equal(man.count,20);
  const words=CONTENT.getStageWords('night-town');
  assert.equal(words.length,20);
  words.forEach((w,i)=>{
    const entry=man.items[i];
    assert.equal(entry.jp,w.jp);
    const filepath=path.join(ROOT,'assets/img/delivery/night-town',entry.file);
    const bytes=fs.readFileSync(filepath);
    assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');
    assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
  });
});

test('FISH-NIGHT A與B歷史候選已封存、可從獨立離線頁試聽',()=>{
  const man=JSON.parse(fs.readFileSync(path.join(ROOT,'art/audio/fish-night-town/archive/legacy/manifest.json'),'utf8'));
  assert.equal(man.model,'s2.1-pro');
  assert.equal(man.api_key_included,false);
  assert.equal(man.words.length,20);
  assert.equal(man.audio.length,40);
  const words=CONTENT.getStageWords('night-town');
  for (let i=0;i<20;i++) assert.equal(man.words[i].jp,words[i].jp);
  for(const voice of ['a','b']){
    assert.match(man.voices[voice],/^[0-9a-f]{32}$/);
    for(let i=1;i<=20;i++){
      const filename=path.join(ROOT,'art/audio/fish-night-town/archive/legacy',voice,String(i).padStart(2,'0')+'.mp3');
      const mp3=fs.readFileSync(filename);
      assert.ok(mp3.byteLength>1000,filename);
      assert.ok(mp3.subarray(0,3).toString('ascii')==='ID3'||(mp3[0]===255&&(mp3[1]&224)===224),filename);
    }
  }
  const html=fs.readFileSync(path.join(ROOT,'art/audio/fish-night-town/preview.html'),'utf8');
  assert.ok(html.includes('Fish Audio'));
  assert.ok(html.includes('ja-JP'));
  assert.ok(html.includes('archive/legacy/'));
  assert.ok(!html.includes('FISH_API_KEY'));
});

test('FISH-AUDIO 正式A與Google TTS回退，B不再指向正式素材',()=>{
  const cache=new Map(), players=[],spoken=[];
  class FakeAudio {
    constructor(src){this.src=src;this.currentTime=0;this.volume=1;this.preload='none';this.paused=true;players.push(this);}
    pause(){this.paused=true;}
    play(){this.paused=false;return Promise.resolve();}
  }
  class Utterance {constructor(text){this.text=text;this.lang='';this.rate=1;this.voice=null;}}
  const google={name:'Google 日本語',lang:'ja-JP'},os={name:'Microsoft 日本語',lang:'ja-JP'};
  const localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
  const window={DELIVERY_LEXICON:LEXICON,location:{search:'?fishVoice=a'},localStorage,
    speechSynthesis:{cancel(){},getVoices(){return [os,google]},speak:u=>spoken.push(u)},
    SpeechSynthesisUtterance:Utterance};
  const env={window,localStorage,URLSearchParams,Audio:FakeAudio,SpeechSynthesisUtterance:Utterance,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-media.js'),'utf8'),env);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-fish-audio.js'),'utf8'),env);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/audio.js'),'utf8'),env);
  assert.equal(window.DELIVERY_FISH_AUDIO.selectedVoice(),'a');
  window.AUDIO.speak('ほん');
  assert.equal(players.at(-1).src,'assets/audio/delivery/night-town/01.mp3');
  assert.equal(spoken.length,0);
  window.location.search='?fishVoice=b'; // retired audition ID must not pick unofficial clips.
  window.AUDIO.speak('ほん');
  assert.equal(players.at(-1).src,'assets/audio/delivery/night-town/01.mp3');
  assert.equal(window.DELIVERY_FISH_AUDIO.selectedVoice(),'a');
  assert.equal(cache.get('yokai-delivery-fish-voice-v3'),'a');
  window.location.search='';
  assert.equal(window.DELIVERY_FISH_AUDIO.selectedVoice(),'a');
  const last=players.at(-1);
  last.onerror();
  assert.equal(spoken.length,1);
  assert.equal(spoken[0].text,'ほん');
  assert.equal(spoken[0].voice.name,'Google 日本語');
  window.location.search='?fishVoice=google';
  const count=players.length;
  window.AUDIO.speak('しんぶん');
  assert.equal(players.length,count,'Google mode skips MP3');
  assert.equal(spoken.length,2);
  window.location.search='?fishVoice=a';
  window.AUDIO.speak('さかな');
  assert.equal(players.at(-1).src,'assets/audio/delivery/rain-port/01.mp3','Stage2 Fish A trial should use canonical audio');
});

test('NIGHT-APPROVED 第一關保持核准，第二關試玩圖不需 dev；未授權關卡仍不可誤接',()=>{
  const w={DELIVERY_LEXICON:LEXICON,location:{hostname:'example.com',search:''},DEV_MODE:{isDevMode(){return false}}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-media.js'),'utf8'),{window:w,URLSearchParams});
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-icon-art.js'),'utf8'),{window:w,URLSearchParams});
  for(const [i,word] of CONTENT.getStageWords('night-town').entries()){
    assert.equal(w.DELIVERY_ICON_ART.pathFor(word),'assets/img/delivery/night-town/'+String(i+1).padStart(2,'0')+'.webp');
  }
  const stage2Trial=CONTENT.getStageWords('rain-port').find(w=>w.jp==='さけ');
  assert.equal(w.DELIVERY_ICON_ART.pathFor(stage2Trial),'assets/img/delivery/rain-port/02.webp');
  const stage3Unreviewed=CONTENT.getStageWords('sakura-pass').find(w=>w.jp==='はなたば');
  assert.equal(w.DELIVERY_ICON_ART.pathFor(stage3Unreviewed),null);
});
