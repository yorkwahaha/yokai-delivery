const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
require('../js/delivery-lexicon.js');
const LEX=globalThis.DELIVERY_LEXICON;
const stage=LEX.stages.find(x=>x.id==='rain-port');
const readJSON=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('RAIN-DELIVERY 20 images + 20 Fish Audio A MP3 canonical paths are complete and perfectly aligned',()=>{
 const im=readJSON('assets/img/delivery/rain-port/manifest.json');
 const au=readJSON('assets/audio/delivery/rain-port/manifest.json');
 const voice=readJSON('art/audio/fish-rain-port/a-common-ja/manifest.json');
 assert.equal(stage.words.length,20);
 assert.equal(im.status,'IN_GAME_TRIAL_PENDING_USER_REVIEW');
 assert.equal(au.status,'IN_GAME_TRIAL_PENDING_USER_REVIEW');
 assert.equal(au.voice_id,'97eda32449cf443bbc4b8782853ca554');
 assert.equal(au.model_used,'s2.1-pro-free');
 assert.equal(au.no_pitch_tags,true);
 assert.equal(voice.model,'s2.1-pro-free');
 assert.equal(im.items.length,20);assert.equal(au.items.length,20);
 const v3=new Set([1,2,3,4,5,8,11,15,16,17,18,20]);
 for(let i=0;i<20;i++){
  const j=i+1,w=stage.words[i],num=String(j).padStart(2,'0');
  const pic=im.items[i],aud=au.items[i];
  assert.equal(pic.jp,w.jp);assert.equal(aud.jp,w.jp);
  assert.equal(pic.file,num+'.webp');assert.equal(aud.file,num+'.mp3');
  assert.equal(pic.art_status,'IN_GAME_TRIAL_PENDING_USER_REVIEW');
  assert.ok(pic.source.includes(v3.has(j)?'rerender-original-style-v3':'rerender-qwen-v2'));
  assert.equal(sha(fs.readFileSync(path.join(ROOT,'assets/img/delivery/rain-port',pic.file))),pic.sha256);
  const bytes=fs.readFileSync(path.join(ROOT,'assets/audio/delivery/rain-port',aud.file));
  assert.equal(sha(bytes),aud.sha256);
  assert.ok(bytes.length>1200);
  assert.ok(bytes.subarray(0,3).toString('ascii')==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224));
  assert.equal(aud.tts_text,voice.words[i].tts_text);
 }
 const preview=fs.readFileSync(path.join(ROOT,'art/delivery-icons/rain-port/preview.html'),'utf8');
 assert.equal((preview.match(/data-src=/g)||[]).length,20);
 assert.ok(!preview.includes('Bearer '));
});

test('RAIN-DELIVERY game image/audio route is canonical and supports Google Japanese TTS fallback',()=>{
 const voices=[];
 const sounds=[];
 class Audio{constructor(src){this.src=src;sounds.push(this);this.currentTime=0;this.volume=1;}pause(){}play(){return Promise.resolve();}}
 class Utterance{constructor(text){this.text=text;this.lang='';this.voice=null;}}
 const storage={getItem(){return null;},setItem(){}};
 const window={DELIVERY_LEXICON:LEX,location:{search:''},localStorage:storage,
  speechSynthesis:{cancel(){},getVoices(){return[{name:'Google 日本語',lang:'ja-JP'}]},speak(u){voices.push(u);}},
  SpeechSynthesisUtterance:Utterance};
 const ctx={window,URLSearchParams,Audio,SpeechSynthesisUtterance:Utterance,console,setTimeout,clearTimeout};
 for(const script of ['js/delivery-media.js','js/delivery-icon-art.js','js/delivery-fish-audio.js','js/audio.js']){
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,script),'utf8'),ctx,{filename:script});
 }
 assert.equal(window.DELIVERY_MEDIA.isApproved('image','rain-port'),false);
 assert.equal(window.DELIVERY_MEDIA.isTrial('image','rain-port'),true);
 assert.equal(window.DELIVERY_MEDIA.pathForWord('image','さけ'),'assets/img/delivery/rain-port/02.webp');
 assert.equal(window.DELIVERY_ICON_ART.pathFor({jp:'さけ',packId:'delivery-rain-port-2'}),'assets/img/delivery/rain-port/02.webp');
 assert.equal(window.DELIVERY_FISH_AUDIO.pathFor('さけ'),'assets/audio/delivery/rain-port/02.mp3');
 window.AUDIO.speak('さけ');
 assert.equal(sounds.at(-1).src,'assets/audio/delivery/rain-port/02.mp3');
 sounds.at(-1).onerror();
 assert.equal(voices.at(-1).text,'さけ');
 assert.equal(voices.at(-1).lang,'ja-JP');
 assert.equal(voices.at(-1).voice.name,'Google 日本語');
 assert.equal(window.DELIVERY_MEDIA.pathForWord('image','さくら'),null);
 assert.equal(window.DELIVERY_MEDIA.pathForWord('audio','さくら'),null);
});

test('RAIN-DELIVERY preview page JavaScript parses; image inputs are already-generated source candidates, not assumed approved',()=>{
 const html=fs.readFileSync(path.join(ROOT,'art/delivery-icons/rain-port/preview.html'),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 new vm.Script(scripts[0][1]);
 assert.ok(html.includes('待'));
 const p=cp.spawnSync('python',['-c', 'from PIL import Image; from pathlib import Path; images=list(Path("assets/img/delivery/rain-port").glob("[0-9][0-9].webp")); assert len(images)==20; assert all(Image.open(f).mode=="RGBA" and Image.open(f).size==(256,256) for f in images)'],{cwd:ROOT,encoding:'utf8',timeout:25000});
 assert.equal(p.status,0,(p.stdout||'')+'\n'+(p.stderr||''));
});
