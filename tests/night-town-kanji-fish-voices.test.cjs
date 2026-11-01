const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const AUD=path.join(ROOT,'art/audio/fish-night-town/kanji-voices');
require('../js/delivery-lexicon.js');
const words=globalThis.DELIVERY_LEXICON.stages[0].words;
test('KANJI-FISH 新舊兩組各20音檔完整，漢字及慣用日文正字法與索引相符',()=>{
 const man=JSON.parse(fs.readFileSync(path.join(AUD,'manifest.json'),'utf8'));
 assert.equal(man.status,'UNAPPROVED_VOICE_AUDITION');
 assert.equal(man.model,'s2.1-pro');
 assert.equal(man.voice_ids.a,'97eda32449cf443bbc4b8782853ca554');
 assert.equal(man.voice_ids.c,'1ec6c6ee0833469e9f172dfc018dda1a');
 assert.equal(man.existing_original_recordings_unchanged,true);
 assert.equal(man.api_key_included,false);
 assert.equal(man.words.length,20);
 assert.equal(man.results.length,40);
 words.forEach((word,i)=>{
   const generated=man.words[i];
   assert.equal(generated.jp,word.jp);
   const fallback=(word.jp==='はさみ'?'鋏':word.jp);
   assert.equal(generated.tts_text,word.kanji||fallback);
   assert.ok(generated.tts_text.length>0);
 });
 for(const voice of ['a','c']){
   for(let i=1;i<=20;i++){
     const file=path.join(AUD,voice,String(i).padStart(2,'0')+'.mp3');
     const bytes=fs.readFileSync(file);
     assert.ok(bytes.length>1000,file);
     assert.ok(bytes.subarray(0,3).toString('ascii')==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224),file);
   }
 }
});
test('KANJI-FISH 比較頁可本機離線試聽，不向前端洩漏 API Key',()=>{
 const page=fs.readFileSync(path.join(AUD,'preview.html'),'utf8');
 assert.ok(page.includes('新 C'));
 assert.ok(page.includes('漢字'));
 assert.ok(page.includes('鋏'));
 assert.ok(page.includes('../../../../assets/img/delivery/night-town/'));
 assert.ok(!page.includes('FISH_AUDIO_API_KEY'));
 assert.ok(!page.includes('__WORDS__'));
 const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 new vm.Script(scripts[0][1]);
});
test('KANJI-FISH 舊版B和現有遊戲音檔未被取代，正式播放仍保留TTS回退',()=>{
 const original=JSON.parse(fs.readFileSync(path.join(ROOT,'art/audio/fish-night-town/archive/legacy/manifest.json'),'utf8'));
 assert.equal(original.voices.b,'44b6e5eeab214296bcfd73e767225229');
 for(const voice of ['a','b'])for(let i=1;i<=20;i++){
   assert.ok(fs.existsSync(path.join(ROOT,'art/audio/fish-night-town/archive/legacy',voice,String(i).padStart(2,'0')+'.mp3')));
 }
 const js=fs.readFileSync(path.join(ROOT,'js/audio.js'),'utf8');
 assert.ok(js.includes('sayFallback(nonce)'));
 assert.ok(js.includes('speechSynthesis'));
});
test('KANJI-FISH 實驗聲線只存在 art 歷史候選，正式路由只許A與Google',()=>{
 const oldPreference=new Map([['yokai-delivery-fish-voice-v1','b']]);
 const storage={getItem:k=>oldPreference.get(k)||null,setItem:(k,v)=>oldPreference.set(k,v)};
 const browser={DELIVERY_LEXICON:globalThis.DELIVERY_LEXICON,location:{search:'?fishVoice=kanji-c'},localStorage:storage};
 const env={window:browser,URLSearchParams};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-media.js'),'utf8'),env);
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-fish-audio.js'),'utf8'),env);
 assert.equal(browser.DELIVERY_FISH_AUDIO.selectedVoice(),'a');
 assert.equal(browser.DELIVERY_FISH_AUDIO.pathFor('はし'),'assets/audio/delivery/night-town/09.mp3');
 assert.equal(oldPreference.get('yokai-delivery-fish-voice-v1'),'b');
 assert.ok(fs.existsSync(path.join(ROOT,'art/audio/fish-night-town/kanji-voices/c/09.mp3')));
 browser.location.search='?fishVoice=b';
 assert.equal(browser.DELIVERY_FISH_AUDIO.pathFor('はし'),'assets/audio/delivery/night-town/09.mp3');
 browser.location.search='?fishVoice=google';
 assert.equal(browser.DELIVERY_FISH_AUDIO.pathFor('はし'),null);
 assert.equal(browser.DELIVERY_FISH_AUDIO.forceJapaneseTTS('はし'),true);
});
