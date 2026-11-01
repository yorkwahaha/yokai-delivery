const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
require('../js/delivery-lexicon.js');
const lex=globalThis.DELIVERY_LEXICON;
const app={DELIVERY_LEXICON:lex};
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/delivery-media.js'),'utf8'),{window:app});
const router=app.DELIVERY_MEDIA;
const id=['night-town','rain-port','sakura-pass','bamboo-maze','hyakki-kyoto','snow-temple','spirit-ferry'];

test('DELIVERY-MEDIA 全七關同一命名規則，第一關正式核准、第二關待審試玩、其他未開放',()=>{
  assert.deepEqual([...router.stageIds],id);
  for(const [i,stage] of id.entries()){
    assert.equal(lex.stages[i].id,stage);
    assert.equal(lex.stages[i].words.length,20);
    for(let j=1;j<=20;j++){
      const word=lex.stages[i].words[j-1];
      const entry=router.entryFor(word.jp);
      assert.equal(entry.stage,stage);
      assert.equal(entry.index,j);
      for(const kind of ['image','audio']){
        if(stage==='night-town'||stage==='rain-port'){
          const expected='assets/'+(kind==='image'?'img':'audio')+'/delivery/'+stage+'/'+String(j).padStart(2,'0')+(kind==='image'?'.webp':'.mp3');
          assert.equal(router.pathFor(kind,stage,j),expected);
          assert.equal(router.pathForWord(kind,word.jp),expected);
          assert.ok(fs.existsSync(path.join(ROOT,expected)));
          assert.equal(router.isApproved(kind,stage),stage==='night-town');
          assert.equal(router.isTrial(kind,stage),stage==='rain-port');
        }else{
          assert.equal(router.pathFor(kind,stage,j),null,'未核准的 '+stage+' 不可取得正式媒體');
        }
      }
    }
  }
  assert.equal(router.pathFor('audio','night-town',21),null);
  assert.equal(router.pathFor('img','night-town',1),null);
  assert.equal(router.pathFor('audio','unknown',1),null);
});

test('DELIVERY-MEDIA 第一關兩份正式 manifest 的20個編號與日語完全一致，歷史試音未誤放進 assets/audio',()=>{
  const img=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/img/delivery/night-town/manifest.json'),'utf8'));
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/audio/delivery/night-town/manifest.json'),'utf8'));
  assert.equal(img.status,'APPROVED_BY_USER');
  assert.equal(audio.status,'APPROVED_BY_USER');
  assert.equal(img.count,20);
  assert.equal(audio.count,20);
  assert.equal(audio.model_used,'s2.1-pro-free');
  assert.equal(audio.voice_id,'97eda32449cf443bbc4b8782853ca554');
  for(let i=0;i<20;i++){
    const w=lex.stages[0].words[i];
    const image=img.items[i],recording=audio.items[i];
    assert.equal(image.jp,w.jp);
    assert.equal(recording.jp,w.jp);
    assert.equal(image.file,String(i+1).padStart(2,'0')+'.webp');
    assert.equal(recording.file,String(i+1).padStart(2,'0')+'.mp3');
    const bytes=fs.readFileSync(path.join(ROOT,'assets/audio/delivery/night-town',recording.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),recording.sha256);
    const archive=fs.readFileSync(path.join(ROOT,'art/audio/fish-night-town/archive/legacy/a-kanji',recording.file));
    assert.ok(bytes.equals(archive),'搬移音檔不可以重新壓縮或更換');
  }
  assert.equal(fs.existsSync(path.join(ROOT,'assets/audio/fish/night-town')),false,
    '試音舊資料不應繼續堆在 production 資料夾');
  for(const voice of ['a','b','a-kanji'])
    assert.ok(fs.existsSync(path.join(ROOT,'art/audio/fish-night-town/archive/legacy',voice)),
      '舊聲線及實驗版本保留在 art/');
});
