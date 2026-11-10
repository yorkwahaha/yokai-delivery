'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('rain-port pickup works at the side of the SAME fishmonger solid that blocks the courier',()=>{
  const g=loadGame({stage:'rain-port',seed:11});
  g.start();g.stopSpawns();g.preparePickup();
  const h=g.ordersNow()[0]?.from;
  assert.equal(h?.bType,'port_fishmonger');
  const position=[h.x-100.5-19,h.y];
  assert.equal(g.blocked(...position,18),false,'courier stands just OUTSIDE the house');
  g.placeAt(...position);g.clearInteract();g.update(.016);
  assert.equal(g.realPickup(),true,'side contact must offer a pickup action');
});

test('other stages retain their original interaction footprint',()=>{
  const g=loadGame({stage:'night-town',seed:11});
  g.start();g.stopSpawns();g.preparePickup();
  const h=g.ordersNow()[0]?.from;
  assert.ok(h);
  const pos=[h.x-48-19,h.y];
  assert.equal(g.blocked(...pos,18),false);
  g.placeAt(...pos);g.clearInteract();g.update(.016);
  assert.equal(g.realPickup(),true);
});

test('pickup bubble retains cargo picture next to the Chinese word, with no yellow orb icon below',()=>{
  const src=fs.readFileSync('js/game.js','utf8');
  const start=src.indexOf('// 15.5 委託氣泡');
  const end=src.indexOf('// 靠近町屋時顯示最短操作標籤',start);
  assert.ok(start>0&&end>start);
  const bubble=src.slice(start,end);
  assert.match(bubble,/UI\.drawWordCue\(ctx, o\.word/);
  assert.match(bubble,/ctx\.fillText\(label, startX \+ cargoSize \+ gap/);
  const marker=src.slice(src.indexOf('// 配送導引標記'),src.indexOf('// 若為送貨目的地'));
  assert.doesNotMatch(marker,/drawActionIcon/);
  assert.doesNotMatch(marker,/ctx\.arc\(/);
  assert.doesNotMatch(marker,/createLinearGradient|ctx\.fillRect\(/,
    'remove the old yellow beam under the pickup bubble too');
});

test('tall pause and results pre-bake fixed labels into a SINGLE cached image layer',()=>{
  const image=class {
    set src(src){
      this._src=src;this.naturalWidth=1024;this.naturalHeight=200;
      if(src.includes('pause__approved'))this.naturalHeight=1536;
      if(src.includes('result__board'))this.naturalHeight=850;
      this.onload?.();
    }
    get src(){return this._src}
  };
  const offscreenText=[],offscreenInk=[],surfaceDraws=[],onscreenDraws=[],onscreenText=[];
  const fakeCtx=(surface=false)=>new Proxy({
    font:'400 18px serif',globalAlpha:1,textAlign:'start',
    measureText(){return {width:100,actualBoundingBoxAscent:17,actualBoundingBoxDescent:3}},
    fillText(value,x,y){
      (surface?offscreenText:onscreenText).push(String(value));
      if(surface)offscreenInk.push({label:String(value),x,y,align:this.textAlign});
    },
    drawImage(img){(surface?surfaceDraws:onscreenDraws).push(img)},
    save(){},restore(){},scale(){},translate(){},strokeText(){},fillRect(){},beginPath(){},arc(){},fill(){},
  },{get:(obj,key)=>key in obj?obj[key]:()=>{}});
  const window={
    Image:image,location:{hostname:'127.0.0.1',search:''},ART:{},FX:{glow(){}},
    VIEWPORT:{get:()=>({scale:1,width:900,height:600,offsetX:0,offsetY:0}),bounds:()=>({left:0,top:0,right:900,bottom:600,width:900,height:600})},
    matchMedia:()=>({matches:false})
  };
  const document={
    fonts:{check:()=>true,load:()=>Promise.resolve()},
    createElement:()=>({width:0,height:0,getContext:()=>fakeCtx(true)})
  };
  const env={window,document,location:window.location,URLSearchParams,Date,Math};
  vm.runInNewContext(fs.readFileSync('js/ui.js','utf8'),env);
  const ctx=fakeCtx(false);
  window.UI.drawPauseMenu(ctx,false,0,'main');
  assert.equal(onscreenDraws.length,2,'one painted five-slot board and one separate footer button');
  assert.ok(onscreenDraws.every(img=>typeof img.getContext==='function'),
    'both pause surfaces including red footer are fixed-text raster composites');
  assert.ok(offscreenText.includes('夜櫻暫歇'));
  for(const label of ['繼續夜行','秘術卡片','單字圖鑑','夜行設定','回旅路地圖','返回主選單'])
    assert.ok(offscreenText.includes(label),'baked fixed label: '+label);
  assert.equal(onscreenText.filter(x=>x==='繼續夜行').length,0,'no second live text layer');
  assert.equal(onscreenText.filter(x=>x==='返回主選單').length,0,'no live footer text layer');
  const before=surfaceDraws.length;
  window.UI.drawPauseMenu(ctx,false,0,'main');
  assert.equal(surfaceDraws.length,before,'same focus reuses the cached painted board');

  offscreenText.length=0;offscreenInk.length=0;onscreenDraws.length=0;onscreenText.length=0;
  window.UI.drawEndScreen(ctx,'won',25260,22,0,[],0,{elapsedSeconds:621,newBest:true,clearText:'港灣燈塔重新點亮。'});
  assert.ok(offscreenText.includes('夜已破曉'),'fixed result title baked in board image');
  assert.ok(offscreenText.includes('回旅路地圖'),'fixed result footer baked in button image');
  const winAction=window.UI.endScreenButtons('won')[0];
  const winInk=offscreenInk.find(v=>v.label==='回旅路地圖');
  assert.equal(winInk?.align,'center','win cached button must not inherit offscreen canvas default start alignment');
  assert.equal(winInk?.x,winAction.w/2,'win button text anchor is its image center');
  assert.equal(winInk?.y,winAction.h/2-1+(17-3)/2,
    'win fixed label is seven logical pixels above the old offset');
  const winTitle=offscreenInk.find(v=>v.label==='夜已破曉');
  assert.equal(winTitle?.y,89-16+(17-3)/2,'painted result header moves five logical pixels up');
  assert.ok(['送達','誤配','本局'].every(s=>offscreenText.includes(s)),'fixed three-column result headings baked in board image');
  assert.ok(onscreenText.includes('25,260'),'score remains runtime data');
  assert.ok(onscreenText.includes('22 件'),'delivery count remains runtime data');
  assert.ok(!onscreenText.includes('夜已破曉'),'result title not drawn twice');

  offscreenText.length=0;offscreenInk.length=0;
  window.UI.drawEndScreen(ctx,'lost',630,0,0,[],0,{elapsedSeconds:137,prevBest:25260});
  const loserLabels={restart:'再踏夜行',world:'回旅路地圖',menu:'回到首頁'};
  for(const b of window.UI.endScreenButtons('lost')){
    const ink=offscreenInk.find(v=>v.label===loserLabels[b.id]);
    assert.equal(ink?.align,'center','lost '+b.id+' text centered, not rendered from left of button center');
    assert.equal(ink?.x,b.w/2,'lost '+b.id+' text anchor matches painted button midpoint');
    assert.equal(ink?.y,b.h/2-1+(17-3)/2,'lost '+b.id+' label has the same corrected vertical offset');
  }
  const lostTitle=offscreenInk.find(v=>v.label==='燈油已盡');
  assert.equal(lostTitle?.y,89-16+(17-3)/2,'defeat header uses corrected upper ink position');
});
