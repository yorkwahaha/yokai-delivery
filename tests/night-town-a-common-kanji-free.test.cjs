const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const dir = path.join(root,'assets/audio/delivery/night-town');
require('../js/delivery-lexicon.js');
const stage = globalThis.DELIVERY_LEXICON.stages.find(s=>s.id==='night-town');
test('NIGHT-A-FREE 正式圖音同層級編號一致，音檔來源為A聲線S2.1免費版',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  const historical=JSON.parse(fs.readFileSync(path.join(root,'art/audio/fish-night-town/archive/legacy/a-kanji/manifest.json'),'utf8'));
  const images=JSON.parse(fs.readFileSync(path.join(root,'assets/img/delivery/night-town/manifest.json'),'utf8'));
  assert.equal(manifest.schema,1);
  assert.equal(manifest.stage,'night-town');
  assert.equal(manifest.status,'APPROVED_BY_USER');
  assert.equal(manifest.count,20);
  assert.equal(manifest.model_used,'s2.1-pro-free');
  assert.equal(manifest.voice_id,'97eda32449cf443bbc4b8782853ca554');
  assert.equal(historical.no_pitch_tags,true);
  assert.equal(historical.key_included,false);
  assert.equal(manifest.items.length,20);
  assert.equal(images.items.length,20);
  for(const [i,w] of stage.words.entries()){
    const item=manifest.items[i],old=historical.input_words[i],image=images.items[i];
    assert.equal(item.index,i+1);
    assert.equal(item.jp,w.jp);
    assert.equal(image.jp,w.jp);
    const expected=w.jp==='はさみ'?'はさみ':w.jp==='せっけん'?'せっけん':(w.kanji||w.jp);
    assert.equal(item.tts_text,expected);
    assert.equal(old.text,expected);
    assert.equal(item.file,String(i+1).padStart(2,'0')+'.mp3');
    assert.equal(image.file,String(i+1).padStart(2,'0')+'.webp');
    assert.ok(!item.tts_text.includes('<|phoneme_start|>'));
    const file=path.join(dir,item.file);
    const bytes=fs.readFileSync(file);
    assert.ok(bytes.length>1000,file);
    assert.ok(bytes.subarray(0,3).toString('ascii')==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224),file);
    assert.equal(fs.readFileSync(path.join(root,'art/audio/fish-night-town/archive/legacy/a-kanji',item.file)).compare(bytes),0);
  }
  const html=fs.readFileSync(path.join(root,'art/audio/fish-night-town/archive/legacy/a-kanji/preview.html'),'utf8');
  assert.ok(html.includes('S2.1'));
  assert.ok(!html.includes('FISH_AUDIO_API_KEY'));
});
test('NIGHT-A-FREE 預設 A 漢字版、舊版 B 偏好不干擾、新 MP3 失敗時回退日語 Google TTS',()=>{
  const cache=new Map([['yokai-delivery-fish-voice-v1','b']]);
  const speech=[];
  const players=[];
  class Audio{
    constructor(src){this.src=src;this.currentTime=0;this.volume=1;players.push(this);}
    pause(){}
    play(){return Promise.resolve();}
  }
  class Utterance{constructor(text){this.text=text;this.voice=null;this.lang='';}}
  const storage={getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)};
  const browser={DELIVERY_LEXICON:globalThis.DELIVERY_LEXICON,localStorage:storage,location:{search:''},
    speechSynthesis:{cancel(){},getVoices(){return [{name:'Google 日本語',lang:'ja-JP'}]},speak:u=>speech.push(u)},
    SpeechSynthesisUtterance:Utterance};
  const context={window:browser,localStorage:storage,URLSearchParams,Audio,SpeechSynthesisUtterance:Utterance,console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/delivery-media.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/delivery-fish-audio.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/audio.js'),'utf8'),context);
  assert.equal(browser.DELIVERY_FISH_AUDIO.selectedVoice(),'a');
  assert.equal(browser.DELIVERY_FISH_AUDIO.pathFor('はさみ'),'assets/audio/delivery/night-town/14.mp3');
  browser.AUDIO.speak('はさみ');
  assert.equal(players.at(-1).src,'assets/audio/delivery/night-town/14.mp3');
  players.at(-1).onerror();
  assert.equal(speech.length,1);
  assert.equal(speech[0].text,'はさみ');
  assert.equal(speech[0].lang,'ja-JP');
  assert.equal(speech[0].voice.name,'Google 日本語');
  browser.location.search='?fishVoice=google';
  const count=players.length;
  browser.AUDIO.speak('せっけん');
  assert.equal(players.length,count);
  assert.equal(speech.at(-1).text,'せっけん');
});
