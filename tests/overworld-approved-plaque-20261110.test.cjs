'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const OW=require('../js/overworld.js');

function scene(ready=true){
  const plates=[],headers=[],infoPanels=[],letters=[],wood=[],oldButtons=[];
  let was=0;
  const grad={addColorStop(){}};
  const ctx=new Proxy({
    fillText(text,x,y){letters.push({text:String(text),x,y,color:ctx.fillStyle,font:ctx.font})},
    createLinearGradient:()=>grad,createRadialGradient:()=>grad,
  },{get:(object,key)=>key in object?object[key]:(()=>{})});
  global.UI={
    mapPlaqueReady:()=>ready,
    drawMapPlaque:(ctx,b,label,props)=>plates.push({b,label,props}),
    drawMapHeader:(ctx,b,title,subtitle)=>headers.push({b,title,subtitle}),
    drawMapInfoPanel:(ctx,b)=>infoPanels.push(b),
    mapInkFont:(px)=>`400 ${px}px 'Yokai UI HanWang YanKai',serif`,
    drawWoodTag:(_ctx,rect)=>wood.push(rect),
    drawWashiBoard:()=>was++,
    drawButton:(_ctx,b,label)=>oldButtons.push({b,label}),
    readableFont:(px,weight)=>`${weight} ${px}px sans-serif`
  };
  global.CONTENT={getStage:id=>({id,implemented:true,unlockedByDefault:true})};
  global.STORE={
    isStageCompleted:()=>true,isStageUnlocked:()=>true,
    getStageStats:()=>({bestScore:25260})
  };
  return {ctx,plates,headers,infoPanels,letters,wasCount:()=>was,wood,oldButtons};
}
function clean(){for(const name of ['UI','CONTENT','STORE','ART'])delete global[name]}

test('map uses separate two-line header, three-row parchment ledger and single-line action plaques',()=>{
  const s=scene(true);
  try{
    OW.draw(s.ctx,OW.createState('rain-port'),0);
    assert.equal(s.headers.length,1,'header uses a dedicated two-line layout');
    assert.equal(s.infoPanels.length,1,'multi-line stage details use their own parchment art');
    assert.equal(s.plates.length,2,'only home and embark use red lacquer buttons');
    assert.deepEqual(s.plates.map(p=>p.label),['← 首頁','出發']);
    assert.equal(s.wasCount(),0,'old beige info parchment excluded when approved art exists');
    assert.ok(!s.wood.some(p=>p.x===259&&p.w===382),'old wooden header is not layered over the red-gold art');
    assert.equal(s.oldButtons.length,0,'do not render extra beige buttons over the gilt plaques');
    const title=s.headers[0].b,info=s.infoPanels[0],home=s.plates[0].b,enter=s.plates[1].b;
    assert.equal(s.headers[0].title,'妖怪快遞社・旅路圖');
    assert.equal(s.headers[0].subtitle,'道をたどって、次の配達先へ');
    assert.equal(title.x+title.w/2,450);
    assert.equal(info.x+info.w/2,450);
    assert.equal(info.h,128,'dedicated information panel holds three safe text rows');
    assert.equal(home.w,OW.backButton().w);
    assert.equal(enter.w,OW.enterButton().w);
    assert.equal(enter.x,OW.enterButton().x);
    assert.equal(enter.y,OW.enterButton().y);
    assert.ok(info.x+info.w<enter.x,'stage info never overlaps embark hitbox');
    assert.ok(info.y+info.h<=600,'information board remains inside viewport');
    for(const text of ['最高 25,260 點','配達開始　Enter / A']){
      const ink=s.letters.find(v=>v.text===text);
      assert.equal(ink?.color,'#53382a','parchment uses dark readable ink: '+text);
      assert.match(ink.font,/HanWang/);
      assert.ok(ink.y>=info.y+26 && ink.y<=info.y+info.h-24,
        'line fits the separate stage-info panel safe area: '+text);
    }
    const stage=s.letters.find(v=>v.text.includes('雨夜港町・配達済'));
    assert.ok(stage?.y>=info.y+26 && stage?.y<=info.y+info.h-24);
  }finally{clean()}
});

test('until approved plaque bitmap loads, map still renders old dark text and interactive controls',()=>{
  const s=scene(false);
  try{
    OW.draw(s.ctx,OW.createState('rain-port'),0);
    assert.equal(s.plates.length,0);
    assert.equal(s.headers.length,0);
    assert.equal(s.infoPanels.length,0);
    assert.ok(s.wasCount()>=1);
    assert.ok(s.wood.some(p=>p.x===259&&p.w===382),'historical header still works until art loads');
    assert.deepEqual(s.oldButtons.map(x=>x.label),['← 首頁','出發']);
    assert.equal(s.letters.find(v=>v.text==='最高 25,260 點')?.color,'#53382a');
  }finally{clean()}
});
