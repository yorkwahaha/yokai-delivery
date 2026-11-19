const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
require('../js/delivery-lexicon.js');
const lex=globalThis.DELIVERY_LEXICON;
test('DELIVERY-MEDIA 前四關各 20 張重繪正式字圖，索引、SHA256 與快取修訂一致',()=>{
  const worker=fs.readFileSync(path.join(ROOT,'service-worker.js'),'utf8');
  const revisions=JSON.parse(worker.slice(worker.indexOf('{'),worker.indexOf('\n};')+2));
  const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
  for(const stage of lex.stages.slice(0,4)){
    for(const [kind,ext] of [['img','webp'],['audio','mp3']]){
      const folder=`assets/${kind}/delivery/${stage.id}/`;
      const media=JSON.parse(fs.readFileSync(path.join(ROOT,folder,'manifest.json'),'utf8'));
      assert.equal(media.count,20);
      assert.equal(media.items.length,20);
      if(kind==='img'){
        assert.equal(media.status,'APPROVED_BY_USER');
        assert.equal(media.generation_model,'OpenAI built-in ImageGen');
        assert.deepEqual(media.size,[256,256]);
      }else if(stage.id==='bamboo-maze'){
        assert.equal(media.status,'PUBLIC_PLAYTEST_PENDING_FEEDBACK');
      }
      for(const [i,item] of media.items.entries()){
        assert.equal(item.index,i+1);
        assert.equal(item.jp,stage.words[i].jp);
        assert.equal(item.file,`${String(i+1).padStart(2,'0')}.${ext}`);
        assert.equal(sha(folder+item.file),item.sha256);
        assert.equal(revisions[folder+item.file],item.sha256.slice(0,24));
      }
    }
  }
});

test('DELIVERY-MEDIA 公開版竹影迷宮由正式載入器播放成對圖音',()=>{
  const requests=[];
  class Image { constructor(){ requests.push(this); } }
  const sandbox={DELIVERY_LEXICON:lex,Image,URLSearchParams,
    location:{hostname:'127.0.0.1',search:'?dev=1&stageLab=1&stage=bamboo-maze'}};
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  for(const script of ['delivery-media','words','dev-mode','delivery-icon-art','delivery-fish-audio']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,'js',script+'.js'),'utf8'),sandbox);
  }
  const media=sandbox.DELIVERY_MEDIA;
  const content=sandbox.CONTENT;
  const art=sandbox.DELIVERY_ICON_ART;
  const fish=sandbox.DELIVERY_FISH_AUDIO;
  const stage='bamboo-maze';
  assert.equal(content.getStage(stage).mapReleased,true);
  assert.equal(media.isApproved('image',stage),true);
  assert.equal(media.isTrial('audio',stage),true);
  for(const [i,word] of content.getStageWords(stage).entries()){
    const num=String(i+1).padStart(2,'0');
    const img=`assets/img/delivery/${stage}/${num}.webp`;
    assert.equal(art.pathFor(word),img);
    assert.equal(art.imageFor(word),null);
    const request=requests.at(-1);
    assert.equal(request.src,img);
    request.naturalWidth=256;
    request.onload();
    assert.equal(art.imageFor(word),request);
    assert.equal(fish.pathFor(word.jp),`assets/audio/delivery/${stage}/${num}.mp3`);
  }
  for(const location of [
    {hostname:'127.0.0.1',search:''},
    {hostname:'127.0.0.1',search:'?dev=1&stageLab=1&fusionlab=1'},
    {hostname:'game.example.com',search:'?dev=1&stageLab=1'}
  ]){
    sandbox.location=location;
    const garlic=content.getStageWords(stage)[3];
    assert.equal(art.pathFor(garlic),`assets/img/delivery/${stage}/04.webp`);
    assert.equal(fish.pathFor(garlic.jp),`assets/audio/delivery/${stage}/04.mp3`);
  }
  sandbox.location={hostname:'127.0.0.1',search:'?dev=1&stageLab=1&fishVoice=google'};
  assert.equal(fish.pathFor('にんにく'),null);
  assert.equal(fish.forceJapaneseTTS('にんにく'),true);
});
