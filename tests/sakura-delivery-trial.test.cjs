const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const cp=require('node:child_process');

const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const bytes=p=>fs.readFileSync(path.join(ROOT,p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
require('../js/delivery-lexicon.js');
const words=globalThis.DELIVERY_LEXICON.stages.find(s=>s.id==='sakura-pass').words;
const STAGE='sakura-pass', STATUS='IN_GAME_TRIAL_PENDING_USER_REVIEW';
const archivedImageManifest='art/delivery-icons/sakura-pass/words-20261119/previous-manifest.json';

test('SAKURA trial: the archived original images and current Fish A MP3 match the lexicon and checksums',()=>{
  const images=read(archivedImageManifest);
  const audio=read('assets/audio/delivery/sakura-pass/manifest.json');
  const source=read('art/audio/fish-sakura-pass/new-six-20261116/manifest.json');
  const previousImages=read('art/delivery-icons/sakura-pass/archive/pre-final-20261116/manifest.json');
  const previousAudio=read('art/audio/fish-sakura-pass/archive/pre-final-20261116/manifest.json');
  const newWords=new Set(['き','かえる','あり','ほうき','ふえ','くすり']);
  const newIcons=new Set([...newWords,'うちわ']);
  const previousImageByWord=new Map(previousImages.items.map(x=>[x.jp,x]));
  const previousAudioByWord=new Map(previousAudio.items.map(x=>[x.jp,x]));
  assert.equal(words.length,20);
  assert.equal(images.status,'APPROVED_BY_USER');assert.equal(audio.status,STATUS);
  assert.equal(images.count,20);assert.equal(audio.count,20);
  assert.equal(images.items.length,20);assert.equal(audio.items.length,20);
  assert.equal(audio.voice_id,'97eda32449cf443bbc4b8782853ca554');
  assert.equal(audio.model_used,'s2.1-pro-free');
  assert.equal(source.stage,STAGE);
  assert.equal(images.version,'20261116-final-word-set');
  assert.equal(audio.version,'20261116-final-word-set');
  assert.equal(source.results.filter(r=>r.status==='generated'||r.status==='cached').length,6);
  assert.deepEqual(words.map(w=>w.jp),[
    'さくら','はな','は','えだ','くさ','たね','き','いし','かえる','すず',
    'おまもり','くつ','かさ','だんご','おちゃ','うちわ','あり','ほうき','ふえ','くすり'
  ]);
  assert.equal(words.some(w=>['はなたば','うえきばち','はちうえ','ちゃば','ゆのみ','せんす'].includes(w.jp)),false);
  for(let i=0;i<20;i++){
    const number=String(i+1).padStart(2,'0'), w=words[i], pic=images.items[i], voice=audio.items[i];
    assert.equal(pic.index,i+1);assert.equal(voice.index,i+1);
    assert.equal(pic.jp,w.jp);assert.equal(voice.jp,w.jp);
    assert.equal(pic.file,number+'.webp');assert.equal(voice.file,number+'.mp3');
    assert.equal(pic.art_status,'APPROVED_BY_USER');assert.equal(voice.review_status,STATUS);
    assert.equal(pic.sha256,sha(bytes(pic.source)));
    assert.equal(voice.sha256,sha(bytes('assets/audio/delivery/sakura-pass/'+voice.file)));
    assert.equal(pic.source_sha256,sha(bytes(pic.source)));
    assert.equal(voice.source_sha256,sha(bytes(voice.source)));
    assert.equal(pic.source_sha256,sha(bytes(pic.source)));
    assert.equal(voice.source_sha256,sha(bytes(voice.source)));
    if(newIcons.has(w.jp)) {
      if(w.jp==='き'||w.jp==='あり') {
        assert.equal(pic.handling,'alpha-cleanup');
        assert.ok(pic.source.includes('alpha-cleanup-20261116/'));
      } else {
        assert.equal(pic.handling,'redrawn');
      }
      if(w.jp==='ふえ') assert.ok(pic.source.includes('refined-20261116/'));
      else if(w.jp==='くすり') assert.ok(pic.source.includes('refined-medicine-v3-20261116/'));
      else if(w.jp!=='き' && w.jp!=='あり') assert.ok(pic.source.includes('rewritten-20261116/'));
    } else {
      assert.equal(pic.handling,'reindexed-original');
      assert.equal(pic.sha256,previousImageByWord.get(w.jp).sha256);
    }
    if(newWords.has(w.jp)) {
      assert.equal(voice.handling,'new-voice');
      assert.equal(voice.tts_text,source.words.find(x=>x.jp===w.jp).tts_text);
      assert.ok(voice.source.includes('new-six-20261116/'));
    } else {
      assert.equal(voice.handling,'reindexed-original');
      assert.equal(voice.sha256,previousAudioByWord.get(w.jp).sha256);
    }
    const clip=bytes('assets/audio/delivery/sakura-pass/'+number+'.mp3');
    assert.ok(clip.length>1200);
    assert.ok(clip.subarray(0,3).toString()==='ID3'||(clip[0]===255&&(clip[1]&224)===224));
  }
});
test('SAKURA trial archive: tree and ant alpha repairs remain verifiable',()=>{
  const py=[
    'from PIL import Image',
    'from pathlib import Path',
    'import json',
    'import numpy as np',
    `files=json.loads(Path(${JSON.stringify(archivedImageManifest)}).read_text(encoding="utf-8"))["items"]`,
    'for number in (7,17):',
    ' f=Path(files[number-1]["source"])',
    ' img=Image.open(f).convert("RGBA")',
    ' a=np.array(img.getchannel("A"))',
    ' assert img.size==(256,256) and a[0,0]==0 and a[255,255]==0',
    ' assert np.count_nonzero(a==0)>48000,(number,np.count_nonzero(a==0))',
    ' if number==7:',
    '  assert a[100,50]<15,"tree parchment rectangle still opaque"',
    '  assert a[100,128]>40,"tree trunk must be preserved"',
    ' else:',
    '  assert a[30,60]==0 and a[30,200]==0,"ant background residue remains"'
  ].join('\n');
  const check=cp.spawnSync('python',['-c',py],{cwd:ROOT,encoding:'utf8',timeout:30000});
  assert.equal(check.status,0,(check.stdout||'')+'\n'+(check.stderr||''));
});
test('SAKURA trial: all icons are centered 256px alpha WebP, and preview has 20 local players',()=>{
  const proof=cp.spawnSync('python',['-c',
    'from pathlib import Path;from PIL import Image\nfiles=sorted(Path("assets/img/delivery/sakura-pass").glob("[0-9][0-9].webp"))\nassert len(files)==20\nfor f in files:\n im=Image.open(f);assert im.mode=="RGBA" and im.size==(256,256),f\n b=im.getchannel("A").getbbox();assert b and b[0]>=4 and b[1]>=4 and b[2]<=252 and b[3]<=252,(f,b)'
  ],{cwd:ROOT,encoding:'utf8',timeout:30000});
  assert.equal(proof.status,0,(proof.stdout||'')+'\n'+(proof.stderr||''));
  const page=fs.readFileSync(path.join(ROOT,'art/delivery-icons/sakura-pass/preview.html'),'utf8');
  assert.equal((page.match(/data-src=/g)||[]).length,20);
  assert.ok(!page.includes('Bearer '));
  // Review HTML must not use numbered assets/ URLs. The previously installed
  // Service Worker may keep an old mapping by pathname across lexicon revisions.
  const pictures=[...page.matchAll(/<img src="([^"]+)" /g)].map(x=>x[1]);
  const sounds=[...page.matchAll(/data-src="([^"]+)"/g)].map(x=>x[1]);
  const imgManifest=read(archivedImageManifest);
  const audioManifest=read('assets/audio/delivery/sakura-pass/manifest.json');
  assert.equal(pictures.length,20);
  assert.equal(sounds.length,20);
  for(let i=0;i<20;i++){
    const number=String(i+1).padStart(2,'0');
    const pic=`final-selected-20261116/${number}.webp?v=${imgManifest.items[i].sha256.slice(0,16)}`;
    const clip=`review-audio/${number}.mp3?v=${audioManifest.items[i].sha256.slice(0,16)}`;
    assert.equal(pictures[i],pic);
    assert.equal(sounds[i],clip);
    assert.equal(sha(bytes('art/delivery-icons/sakura-pass/'+pic.split('?')[0])),imgManifest.items[i].sha256);
    assert.equal(sha(bytes('art/delivery-icons/sakura-pass/'+clip.split('?')[0])),audioManifest.items[i].sha256);
  }
  const worker=fs.readFileSync(path.join(ROOT,'service-worker.js'),'utf8');
  assert.ok(!worker.includes('"art/delivery-icons/sakura-pass/final-selected-20261116/'));
  assert.ok(!worker.includes('"art/delivery-icons/sakura-pass/review-audio/'));
  const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
});
test('SAKURA trial: router selects stage 3 A recording without disturbing earlier stages',()=>{
  const app={DELIVERY_LEXICON:globalThis.DELIVERY_LEXICON};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-media.js'),'utf8'),{window:app});
  const r=app.DELIVERY_MEDIA;
  for(const stage of ['night-town','rain-port','sakura-pass']){
    const lex=globalThis.DELIVERY_LEXICON.stages.find(s=>s.id===stage);
    for(let i=0;i<20;i++){
      const num=String(i+1).padStart(2,'0');
      assert.equal(r.pathForWord('image',lex.words[i].jp),`assets/img/delivery/${stage}/${num}.webp`);
      assert.equal(r.pathForWord('audio',lex.words[i].jp),`assets/audio/delivery/${stage}/${num}.mp3`);
    }
  }
  assert.equal(r.isApproved('image',STAGE),true);
  assert.equal(r.isTrial('image',STAGE),false);
  assert.equal(r.isTrial('audio',STAGE),true);
  assert.equal(r.pathForWord('image','はな'),'assets/img/delivery/sakura-pass/02.webp');
});
