const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../js/delivery-lexicon.js');
require('../js/delivery-media.js');
const CONTENT = require('../js/words.js');
const STAGE_IDS = ['night-town','rain-port','sakura-pass','bamboo-maze','hyakki-kyoto','snow-temple','spirit-ferry'];
const ROOT = path.resolve(__dirname,'..');
test('DELIVERY-V3 七關各20件具體名詞、無重複，黃泉全140詞加優先20件', () => {
  const all = [];
  for(const id of STAGE_IDS){
    const stage = CONTENT.getStage(id), words = CONTENT.getStageWords(stage);
    assert.equal(words.length,20,id);
    assert.equal(stage.wordPacks.length, ({'night-town':6,'rain-port':6,'sakura-pass':5,'bamboo-maze':4,'hyakki-kyoto':5,'snow-temple':3,'spirit-ferry':3})[id],id);
    assert.ok(words.every(w=>w.pos==='名詞' && w.cue==='art' && w.icon && w.jp && w.zh),id);
    all.push(...words);
  }
  assert.equal(all.length,140);
  assert.equal(new Set(all.map(w=>w.jp)).size,140);
  const yomi = CONTENT.getStageWords('yomi');
  assert.equal(yomi.length,140);
  assert.equal(CONTENT.getAllWords().length,140);
  assert.deepEqual(yomi.slice(0,20).map(w=>w.jp),globalThis.DELIVERY_LEXICON.reviewPriority);
  for(const word of all) {
    assert.ok(word.stageIds.includes('yomi'));
    assert.equal(word.stageIds.filter(id=>id!=='yomi').length,1);
  }
});
test('DELIVERY-V3 減少抽象字與重複答案，保留老錄音和詞包',()=>{
  const active=CONTENT.getAllWords(),answers=CONTENT.getAnswerCandidates();
  for(const jp of ['みぎ','ひだり','ありがとう','かみなり','はしる']) {
    assert.equal(active.some(w=>w.jp===jp),false,jp);
  }
  assert.equal(answers.filter(w=>w.jp==='カメラ').length,1);
  assert.ok(CONTENT.getPack('animals'));
  assert.ok(CONTENT.getPack('rain-weather'));
  assert.ok(CONTENT.getAllWords('recorded').length>0);
});
test('DELIVERY-V3 140件 local AI 風格候選均存在，為透明 WebP、不使用未批准正式圖',()=>{
  const all=globalThis.DELIVERY_LEXICON.stages;
  for(const stage of all){
    const dir=path.join(ROOT,'art','delivery-icons',stage.id);
    assert.ok(fs.existsSync(path.join(dir,'contact_sheet_candidate.png')));
    assert.ok(fs.existsSync(path.join(dir,'review_contact.webp')));
    for(const [i,w] of stage.words.entries()){
      const candidate=path.join(dir,String(i+1).padStart(2,'0')+'_'+w.jp+'_candidate.webp');
      assert.ok(fs.existsSync(candidate),w.jp);
      const b=fs.readFileSync(candidate);
      assert.equal(b.subarray(0,4).toString('ascii'),'RIFF',w.jp);
      assert.equal(b.subarray(8,12).toString('ascii'),'WEBP',w.jp);
    }
  }
});
test('DELIVERY-V3 正式第一關與試玩第二關優先用 canonical，其他候選僅 dev 可用',()=>{
  globalThis.location = {hostname:'127.0.0.1',search:'?dev=1&deliveryArt=1'};
  globalThis.DEV_MODE={isDevMode: loc=>loc.hostname==='127.0.0.1' && loc.search.includes('dev=1')};
  require('../js/delivery-icon-art.js');
  const word=CONTENT.getStageWords('rain-port')[6];
  const art=globalThis.DELIVERY_ICON_ART;
  assert.equal(art.devEnabled(),true);
  assert.equal(art.pathFor(word),'assets/img/delivery/rain-port/07.webp');
  const redrawS1=CONTENT.getStageWords('night-town').find(w=>w.jp==='しんぶん');
  const keptS1=CONTENT.getStageWords('night-town').find(w=>w.jp==='とけい');
  assert.equal(art.pathFor(redrawS1),'assets/img/delivery/night-town/02.webp');
  const redrawS2=CONTENT.getStageWords('rain-port').find(w=>w.jp==='さけ');
  assert.equal(art.pathFor(redrawS2),'assets/img/delivery/rain-port/02.webp');
  assert.equal(art.pathFor(keptS1),'assets/img/delivery/night-town/03.webp');
  assert.equal(art.pathFor(redrawS1),'assets/img/delivery/night-town/02.webp', '第一關正式圖不再依賴開發模式');
  globalThis.location.search='?deliveryArt=1';
  assert.equal(art.devEnabled(),false);
  assert.equal(art.pathFor(word),'assets/img/delivery/rain-port/07.webp', '第二關本機試玩以 canonical 圖為先');
  assert.equal(art.pathFor(CONTENT.getStageWords('rain-port')[2]),'assets/img/delivery/rain-port/03.webp', '第二關明確授權試玩');
  assert.equal(art.pathFor(CONTENT.getStageWords('sakura-pass').find(w=>w.jp==='はなたば')),null, '第三關未授權的候選不載入');
});

test('DELIVERY-V3-R2 19 張原本 Qwen 重繪、雨港 8 張去字，原始候選仍完好',()=>{
  const expected={
    'night-town':['しんぶん','えんぴつ','けしゴム','じょうぎ','かみ','はブラシ','せっけん'],
    'rain-port':['さかな','さけ','まぐろ','さば','たい','いか','かい','すし','さしみ','やきざかな','おにぎり','てんぷら']
  };
  let total=0;
  for(const [stage,selected] of Object.entries(expected)){
    const dir=path.join(ROOT,'art','delivery-icons',stage);
    const target=path.join(dir,'rerender-qwen-v2');
    const manifest=JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8'));
    assert.equal(manifest.model,'local ComfyUI Qwen Image 2.1');
    assert.deepEqual(manifest.redrawn_words,selected);
    assert.ok(fs.existsSync(path.join(target,'new_sheet_original.png')));
    assert.ok(fs.existsSync(path.join(target,'review_contact.webp')));
    for(const w of CONTENT.getStageWords(stage)){
      const index=globalThis.DELIVERY_LEXICON.stages.find(x=>x.id===stage).words.findIndex(x=>x.jp===w.jp)+1;
      const filename=String(index).padStart(2,'0')+'_'+w.jp+'_candidate.webp';
      assert.ok(fs.existsSync(path.join(dir,filename)),'原始圖未覆蓋：'+filename);
      if(stage==='rain-port'||selected.includes(w.jp)) {
        assert.ok(fs.existsSync(path.join(target,filename)),'新版待審圖存在：'+filename);
      }
    }
    total+=selected.length;
  }
  assert.equal(total,19);
});
test('DELIVERY-V3-R3 原始提示詞水墨風格鎖定，19 張新候選與未修改的原圖完整保留',()=>{
  const expected={
    'night-town':['しんぶん','えんぴつ','けしゴム','じょうぎ','かみ','はブラシ','せっけん'],
    'rain-port':['さかな','さけ','まぐろ','さば','たい','いか','かい','すし','さしみ','やきざかな','おにぎり','てんぷら']
  };
  for(const [id,selected] of Object.entries(expected)){
    const dir=path.join(ROOT,'art','delivery-icons',id);
    const v3=path.join(dir,'rerender-original-style-v3');
    const manifest=JSON.parse(fs.readFileSync(path.join(v3,'manifest.json'),'utf8'));
    assert.equal(manifest.grid,'5x4 original first batch');
    assert.equal(manifest.source_script,'tools/generate_delivery_icons_local.py:build_original_prompt');
    assert.match(manifest.art_style,/verbatim original first batch/);
    assert.equal(manifest.steps,18);
    assert.deepEqual(manifest.selected,selected);
    assert.ok(fs.existsSync(path.join(v3,'contact_sheet_source.png')));
    assert.ok(fs.existsSync(path.join(v3,'review_contact.webp')));
    for(const [i,w] of globalThis.DELIVERY_LEXICON.stages.find(s=>s.id===id).words.entries()){
      const name=String(i+1).padStart(2,'0')+'_'+w.jp+'_candidate.webp';
      assert.ok(fs.existsSync(path.join(dir,name)),'初稿未覆蓋 '+id+'/'+name);
      assert.ok(fs.existsSync(path.join(dir,'rerender-qwen-v2',name))||id==='night-town',
        '舊重繪版本仍存在 '+id+'/'+name);
      if(selected.includes(w.jp)){
        const candidate=path.join(v3,name);
        assert.ok(fs.existsSync(candidate),'新圖 '+name);
        const data=fs.readFileSync(candidate);
        assert.equal(data.subarray(8,12).toString('ascii'),'WEBP');
      }
    }
  }
});

test('DELIVERY-V4 六張 ComfyUI seed 抽選、透明 WebP 與非目標詞原樣保留',()=>{
  const original=path.join(ROOT,'art','delivery-icons','night-town');
  const v4=path.join(original,'rerender-original-style-v4');
  const manifest=JSON.parse(fs.readFileSync(path.join(v4,'selected_manifest.json'),'utf8'));
  assert.equal(manifest.model,'local ComfyUI/Qwen Image 2.1');
  assert.deepEqual(manifest.seeds_drawn,[20286119,20286120,20286121]);
  assert.deepEqual(Object.keys(manifest.selected_words),
    ['しんぶん','けしゴム','じょうぎ','かみ','はブラシ','せっけん']);
  for(const seed of manifest.seeds_drawn) {
    const dir=path.join(v4,'seed-'+seed);
    const batch=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
    assert.equal(batch.steps,18);
    assert.equal(batch.grid,'5x4 original first batch');
    assert.equal(batch.base_style_tail_sha256,
      JSON.parse(fs.readFileSync(path.join(v4,'seed-20286119','manifest.json'),'utf8')).base_style_tail_sha256);
    assert.ok(fs.existsSync(path.join(dir,'contact_sheet_source.png')));
  }
  for(const [jp,seed] of Object.entries(manifest.selected_words)){
    const idx=globalThis.DELIVERY_LEXICON.stages[0].words.findIndex(w=>w.jp===jp)+1;
    const fname=String(idx).padStart(2,'0')+'_'+jp+'_candidate.webp';
    const chosen=path.join(v4,'selected',fname);
    const originalSeed=path.join(v4,'seed-'+seed,fname);
    assert.ok(fs.existsSync(chosen));
    assert.equal(fs.readFileSync(chosen).compare(fs.readFileSync(originalSeed)),0);
    assert.ok(fs.existsSync(path.join(original,fname)),'original preserved');
  }
  assert.ok(fs.existsSync(path.join(v4,'review_contact.webp')));
  const pencil=CONTENT.getStageWords('night-town').find(w=>w.jp==='えんぴつ');
  globalThis.location.search='?dev=1&deliveryArt=1';
  assert.equal(globalThis.DELIVERY_ICON_ART.pathFor(pencil),'assets/img/delivery/night-town/12.webp');
});
