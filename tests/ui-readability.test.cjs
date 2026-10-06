const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function loadUI(width = 585) {
  const texts = [], gradient = { addColorStop() {} };
  const context = new Proxy({ fillText: (value, x, y) => texts.push({ value, x, y }), measureText: value => ({ width: [...value].length * 20 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => o[k] || (() => {}) });
  const env = { window: {}, document: { getElementById: () => ({ getBoundingClientRect: () => ({ width }) }) } };
  vm.runInNewContext(fs.readFileSync('js/ui.js', 'utf8'), env);
  return { UI: env.window.UI, context, texts, env };
}

test('both settlement portraits occupy two thirds of viewport height',()=>{
  const r=loadUI(900),frames=[];
  r.env.window.ART={player_win_v1:{naturalWidth:100},player_kneel_v1:{naturalWidth:100}};
  r.env.window.RENDERER={drawFrame:(...args)=>frames.push(args)};
  for(const state of ['won','lost'])r.UI.drawEndScreen(r.context,state,0,0,0,[]);
  for(const args of frames)assert.equal(args[6],400);
  assert.ok(frames[0][4]>=120,'victory portrait keeps its visible alpha bounds on-screen');
  assert.ok(frames[1][4]>=168,'kneeling portrait shifts right enough to avoid left-edge clipping');
});

test('settlement paints the character last and separates best record from delivery totals',()=>{
  const r=loadUI(900),paint=[];
  r.context.fillText=(value,x,y)=>{r.texts.push({value,x,y});paint.push(value);};
  r.env.window.ART={player_kneel_v1:{naturalWidth:100}};
  r.env.window.RENDERER={drawFrame:()=>paint.push('portrait')};
  r.UI.drawEndScreen(r.context,'lost',6570,4,0,[],0,{prevBest:52745,learning:{practiced:5,review:0,gained:4,lost:0}});
  assert.equal(paint.at(-1),'portrait');
  const best=r.texts.find(t=>t.value==='最高 52,745'),stat=r.texts.find(t=>t.value.includes('送達'));
  assert.ok(stat.y-best.y>=40);
});

test('surge warning has just one short label',()=>{
  const r=loadUI(900);r.UI.drawSurgeWarning(r.context,1.2);
  assert.deepEqual([...new Set(r.texts.map(t=>t.value))],['百鬼夜行']);
});

test('settlement retains all five review words on a small screen',()=>{
  const r=loadUI(568);r.env.window.innerWidth=568;r.env.window.innerHeight=320;
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
  const words=Array.from({length:5},(_,i)=>({jp:'かな'+i,zh:'中文'+i}));
  r.UI.drawEndScreen(r.context,'lost',0,0,5,words,0,{learning:{practiced:5,gained:0,lost:5,review:5}});
  for(const w of words)assert.ok(r.texts.some(t=>t.value.includes(w.jp)),w.jp);
});

test('mobile skill codex exposes every skill through pages and marks unavailable arrows',()=>{
  const r=loadUI(568);r.env.window.innerWidth=568;r.env.window.innerHeight=320;
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
  const count=Math.ceil(r.UI.CARD_LIST.length/r.UI.codexRows());
  for(let page=0;page<count;page++)r.UI.drawCodex(r.context,{get:()=>({ok:1,ng:0,box:2})},[],'cards',page);
  for(const c of r.UI.CARD_LIST)assert.ok(r.texts.some(t=>t.value===c.name),c.name);
  assert.equal(r.UI.codexButtons('cards',0,39).find(b=>b.id==='prev').disabled,true);
  assert.equal(r.UI.codexButtons('cards',count-1,39).find(b=>b.id==='next').disabled,true);
});

test('codex readings and translations use font-sized vertical separation',()=>{
  const r=loadUI(1920),labels=[];r.env.window.innerWidth=1920;r.env.window.innerHeight=1080;
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
  r.context.fillText=(value,x,y)=>labels.push({value,x,y,size:parseFloat(r.context.font.match(/([\d.]+)px/)[1])});
  r.UI.drawCodex(r.context,{get:()=>({ok:1,ng:0,box:1})},[{jp:'かさ',zh:'雨傘',cue:'text'}],'words');
  const jp=labels.find(t=>t.value==='かさ'),zh=labels.find(t=>t.value==='雨傘'&&t.y>jp.y);assert.ok(zh.y-jp.y>=zh.size);
});

test('settlement uses distinct victory and kneeling drawings, with original art fallback',()=>{
  const r=loadUI(900),images=[];r.context.drawImage=(...args)=>images.push(args);
  const base={naturalWidth:216,naturalHeight:352},won={naturalWidth:1024,naturalHeight:1536},lost={naturalWidth:1024,naturalHeight:1024};
  r.env.window.ART={player:base,player_win_v1:won,player_kneel_v1:lost};
  r.UI.drawEndScreen(r.context,'won',100,6,0,[]);assert.equal(images[0][0],won);
  images.length=0;r.UI.drawEndScreen(r.context,'lost',0,0,0,[]);assert.equal(images[0][0],lost);
  delete r.env.window.ART.player_kneel_v1;images.length=0;r.UI.drawEndScreen(r.context,'lost',0,0,0,[]);assert.equal(images[0][0],base);
  r.env.window.RENDERER={drawFrame:(ctx,img,key)=>images.push([img,key])};images.length=0;
  r.UI.drawEndScreen(r.context,'lost',0,0,0,[]);assert.equal(images[0][1],'player','fallback must use original crop coordinates');
});

test('menu loading progress and settlement star totals remain readable on compact screens',()=>{
  for(const width of [900,568]) {
    const r=loadUI(width);r.env.window.innerWidth=width;r.env.window.innerHeight=width===568?320:600;
    vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
    r.env.window.ART_PROGRESS={settled:4,total:18,failed:0};
    r.UI.drawMainMenu(r.context,{data:{}},0);
    assert.ok(r.texts.some(t=>t.value.includes('4 / 18')));
    r.texts.length=0;
    r.UI.drawEndScreen(r.context,'lost',100,2,2,[],0,{learning:{practiced:3,gained:1,lost:1,review:1}});
    assert.ok(r.texts.some(t=>t.value.includes('練習 3 字')&&t.value.includes('待複習 1 字')));
    assert.ok(r.texts.some(t=>t.value.includes('升星 +1')&&t.value.includes('降星 −1')));
  }
});

test('HUD bars reuse gradients and rebuild for changed transform, geometry, tone or canvas context',()=>{
  const r=loadUI(900);let made=0,m={a:1,b:0,c:0,d:1,e:0,f:0};
  const colors=[];
  r.context.getTransform=()=>m;
  r.context.createLinearGradient=()=>{made++;return {addColorStop:(p,c)=>colors.push(c)};};
  const draw=(ctx=r.context,oil=80)=>r.UI.drawHud(ctx,{x:0,y:0},oil,100,120,600,2,0,100,3,12,45,null,0,[],null,null,false,null,
    {x:810,y:420,r:38},{x:810,y:530,r:46},{x:848,y:14,w:38,h:52},{},{},{},0);
  draw();const first=made;draw();assert.equal(made,first,'unchanged bars must reuse gradients');
  draw(r.context,10);assert.equal(made,first+1);assert.ok(colors.includes('#d4141f'));
  m={...m,a:2,d:2};const beforeScale=made;draw();assert.ok(made>=beforeScale+3);
  const beforeResize=made;r.env.window.innerWidth=844;r.env.window.innerHeight=390;
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);draw();assert.ok(made>beforeResize);
  const other=loadUI(900).context;other.getTransform=()=>m;other.createLinearGradient=r.context.createLinearGradient;
  const beforeContext=made;draw(other);assert.ok(made>beforeContext);
});

test('small-screen level-up descriptions and settlement review lines keep readable spacing',()=>{
  const r=loadUI(568);r.env.window.innerWidth=568;r.env.window.innerHeight=320;
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
  const labels=[];r.context.measureText=value=>({width:[...String(value)].length*parseFloat(r.context.font.match(/([\d.]+)px/)[1])});
  r.context.fillText=(value,x,y)=>labels.push({value,x,y,size:parseFloat(r.context.font.match(/([\d.]+)px/)[1])});
  r.UI.drawLevelUp(r.context,3,[{type:'passive',id:'shield',n:'金剛結界',s:'けっかい',d:'恢復燈油並震退周圍妖怪'.repeat(3)}],{katana:1},{katana:{zh:'妖刀斬'}},2);
  const description=labels.filter(l=>l.x===170 && l.y>=240),name=labels.find(l=>l.value==='妖刀斬');
  assert.equal(description.length,2);assert.ok(description[1].y-description[0].y>=description[0].size*1.1);
  assert.ok(name.size*r.env.window.VIEWPORT.get().scale>=14);
  assert.ok(labels.find(l=>l.value==='金剛結界').size*r.env.window.VIEWPORT.get().scale>=14);
  labels.length=0;
  r.UI.drawEndScreen(r.context,'lost',100,2,2,Array.from({length:5},(_,i)=>({jp:'あいうえお'+i,zh:'複習字詞'})));
  const reviews=labels.filter(l=>l.x<500 && l.value.includes('（複習字詞）'));
  for(let i=1;i<reviews.length;i++)assert.ok(reviews[i].y-reviews[i-1].y>=reviews[i].size*1.2);
});

function drawHudFixture(width, height, oil = 100, maxOil = 100, passives = {}, elapsed = 120) {
  const r = loadUI(width);r.env.window.innerWidth = width;r.env.window.innerHeight = height;
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
  const v=r.env.window.VIEWPORT,scale=v.get().scale,ctx=r.context,labels=[],rects=[],arcs=[],stack=[];
  r.env.document.getElementById=()=>({getContext:()=>ctx,getBoundingClientRect:()=>({width})});
  let state={x:0,y:0,s:1,font:'12px sans-serif',align:'left'};
  Object.defineProperty(ctx,'font',{get:()=>state.font,set:value=>state.font=value});
  Object.defineProperty(ctx,'textAlign',{get:()=>state.align,set:value=>state.align=value});
  ctx.save=()=>stack.push({...state});ctx.restore=()=>{state=stack.pop();};
  ctx.translate=(x,y)=>{state.x+=x*state.s;state.y+=y*state.s;};ctx.scale=s=>{state.s*=s;};
  const measure=value=>[...String(value)].reduce((sum,ch)=>sum+Number(state.font.match(/([\d.]+)px/)[1])*(ch.charCodeAt(0)>255?0.95:0.6),0);
  ctx.measureText=value=>({width:measure(value)});
  ctx.fillText=(value,x,y)=>{
    const w=measure(value)*state.s,left=state.x+x*state.s-(state.align==='center'?w/2:state.align==='right'?w:0);
    labels.push({value:String(value),left,right:left+w,y:state.y+y*state.s,cssSize:Number(state.font.match(/([\d.]+)px/)[1])*state.s*scale});
  };
  ctx.roundRect=(x,y,w,h)=>rects.push({x:state.x+x*state.s,y:state.y+y*state.s,w:w*state.s,h:h*state.s,fill:ctx.fillStyle});
  ctx.arc=(x,y,r)=>arcs.push({x:state.x+x*state.s,y:state.y+y*state.s,r:r*state.s});
  const bounds=v.hudBounds();
  r.UI.drawHud(ctx,{x:0,y:0},oil,maxOil,elapsed,600,1,0,50,3,12,45,null,0,[],null,null,true,null,
    {x:bounds.right-138,y:bounds.bottom-180,r:38},{x:bounds.right-138,y:bounds.bottom-70,r:46},
    {x:bounds.right-52,y:bounds.top+14,w:38,h:52},
    {katana:1,fire:4,boom:5,needle:2},{katana:{},fire:{},boom:{},needle:{}},passives,0);
  return {labels,rects,arcs,bounds,scale,quiz:r.UI.bossQuizLayout(3)};
}

test('oil numbers and bar remain prominent and low-oil warning uses capacity ratio',()=>{
  for(const [width,height] of [[900,600],[844,390],[667,375],[568,320],[800,600],[1920,1080]]) {
    const r=drawHudFixture(width,height,39,160),number=r.labels.find(t=>t.value==='39/160');
    assert.ok(number.cssSize>=18,`${width}: oil number size`);
    const bar=r.rects.find(b=>b.fill==='#1c1814');assert.ok(bar.h*r.scale>=12);assert.ok(bar.w>=180);
    assert.ok(!r.labels.some(t=>t.value==='低油！'||t.value==='燈油'),'oil is shown by icon and bar, not explanatory text');
  }
});

test('diegetic lantern grows on phone landscape, keeps tablet scale, and swings as one assembly',()=>{
  for(const [width,height,expectedH] of [[844,390,190],[1024,768,168]]) {
    const r=loadUI(width);r.env.window.innerWidth=width;r.env.window.innerHeight=height;
    vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),r.env);
    r.env.window.UI_THEME='diegetic';
    const art={complete:true,naturalWidth:1086,naturalHeight:1448};
    r.env.window.ART={hud_lantern_oil:art};
    const images=[],turns=[],labels=[];
    r.context.drawImage=(...args)=>images.push(args);
    r.context.rotate=a=>turns.push(a);
    r.context.fillText=(value,x,y,maxWidth)=>labels.push({value:String(value),font:r.context.font,maxWidth});
    const bounds=r.env.window.VIEWPORT.hudBounds();
    r.UI.drawHud(r.context,{x:0,y:0},100,100,120,600,0,0,0,1,0,30,null,0,[],null,null,true,null,
      {x:bounds.right-138,y:bounds.bottom-180,r:38},{x:bounds.right-138,y:bounds.bottom-70,r:46},
      {x:bounds.right-52,y:bounds.top+14,w:38,h:52},{},{},{},0,6,0,1.8,false,{time:1.234,lanternHit:.7});
    const lantern=images.find(args=>args[0]===art);
    assert.ok(lantern,`${width}: lantern art is rendered`);
    assert.equal(Math.round(lantern[4]),expectedH,`${width}: responsive lantern height`);
    assert.ok(turns.some(a=>Math.abs(a)>.001),`${width}: whole lantern has secondary swing`);
    const value=labels.find(t=>t.value==='100/100'),fontSize=Number(value.font.match(/([\d.]+)px/)[1]);
    assert.ok(fontSize*r.env.window.VIEWPORT.get().scale<=15,`${width}: oil digits stay visually compact`);
  }
});

test('HUD skill badges are readable and their labels fit their backing rectangles',()=>{
  for(const [width,height] of [[900,600],[844,390],[667,375],[568,320],[800,600],[1920,1080]]) {
    const r=drawHudFixture(width,height,160,160,{shield:6,dmg:1.9,rate:2,crit:2,spd:2,dash:2,mag:2});
    const badges=r.labels.filter(t=>/^L\d+$|^MAX$|^×\d+$/.test(t.value));assert.ok(badges.length>=4);
    for(const text of badges) {
      assert.ok(text.cssSize>=14,`${width}: ${text.value} size`);
      assert.ok(r.rects.some(b=>text.left>=b.x && text.right<=b.x+b.w+1e-8 && text.y>=b.y && text.y<=b.y+b.h),`${width}: ${text.value} backing`);
      assert.ok(text.right<=r.bounds.right-180,`${width}: control clearance`);
    }
  }
});

test('passive overflow discloses the exact hidden count and vanishes when everything fits',()=>{
  const all={shield:6,dmg:1.9,rate:2,crit:2,spd:2,dash:2,mag:2};
  for(const [width,height] of [[900,600],[844,390],[667,375],[568,320],[800,600],[1920,1080]]) {
    const r=drawHudFixture(width,height,160,160,all),shown=r.labels.filter(t=>/^×\d+$/.test(t.value)).length;
    const overflow=r.labels.find(t=>/^＋\d+$/.test(t.value));
    assert.equal(shown+(overflow?Number(overflow.value.slice(1)):0),8);
    if(width===1920)assert.equal(overflow,undefined);
    const empty=drawHudFixture(width,height);assert.ok(!empty.labels.some(t=>/^＋\d+$/.test(t.value)));
    const single=drawHudFixture(width,height,100,100,{shield:2});assert.equal(single.labels.filter(t=>/^×\d+$/.test(t.value)).length,1);
    assert.ok(!single.labels.some(t=>/^＋\d+$/.test(t.value)));
  }
});

test('opening touch joystick guidance stays above the taller skill footer',()=>{
  for(const [width,height] of [[844,390],[667,375],[568,320]]) {
    const r=drawHudFixture(width,height,100,100,{},0),hint=r.arcs.find(a=>a.r===52);
    const max=r.labels.find(t=>t.value==='MAX');
    const backing=r.rects.find(b=>max.left>=b.x && max.right<=b.x+b.w && max.y>=b.y && max.y<=b.y+b.h);
    assert.ok(hint.y+hint.r+8<=backing.y-backing.w,`${width}: hint/footer clearance`);
  }
});

test('Boss quiz clears the actual skill footer after its labels grow',()=>{
  for(const [width,height] of [[900,600],[844,390],[667,375],[568,320],[800,600],[1920,1080]]) {
    const r=drawHudFixture(width,height),max=r.labels.find(t=>t.value==='MAX');
    const backing=r.rects.find(b=>max.left>=b.x && max.right<=b.x+b.w && max.y>=b.y && max.y<=b.y+b.h);
    assert.ok(r.quiz.y+r.quiz.h+10<=backing.y-backing.w,`${width}: Boss/footer clearance`);
    assert.ok(r.quiz.y>=r.bounds.top);
  }
});

test('Boss quiz geometry fits the viewport above the bottom HUD with shared hit targets',()=>{
  for(const [width,height] of [[1920,1080],[844,390],[900,600],[800,600]]) for(const n of [2,3]) {
    const {UI,env}=loadUI(width);env.window.innerWidth=width;env.window.innerHeight=height;
    vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),env);
    const bounds=env.window.VIEWPORT.hudBounds(),scale=env.window.VIEWPORT.get().scale;
    const layout=UI.bossQuizLayout(n);
    assert.ok(layout.x>=bounds.left && layout.x+layout.w<=bounds.right);
    assert.ok(layout.x+layout.w<=bounds.right-208); // Keep clear of pickup/dash circles and their pointer margin.
    assert.ok(layout.y>=bounds.top && layout.y+layout.h<bounds.bottom-62);
    assert.equal(layout.options.length,n);
    for(const b of layout.options) {
      assert.ok(b.x>=layout.x && b.x+b.w<=layout.x+layout.w);
      assert.ok(b.y>=layout.y && b.y+b.h<=layout.y+layout.h);
      assert.ok(b.h*scale>=44);
    }
  }
});

test('readableFont uses viewport scale without DOM geometry reads',()=>{
  const {UI,env}=loadUI();env.window.VIEWPORT={get:()=>({scale:0.65})};
  env.document.getElementById=()=>{throw new Error('unnecessary DOM read');};
  assert.match(UI.readableFont(12),/22px/);
});

test('hint sentences wrap without truncation and retain readable font size',()=>{
  const {UI,context,texts}=loadUI();const sentence='さかな　さかなをたべます。';
  UI.drawHintText(context,sentence,0,0,140);
  assert.equal(texts.map(t=>t.value).join(''),sentence);assert.ok(texts.length>1);
});

test('settlement counts distinct mistaken words and discloses only truncated reviews',()=>{
  const words=Array.from({length:7},(_,i)=>({jp:`錯詞${i}`,zh:`意思${i}`}));
  for(const width of [844,1920]) for(const state of ['lost','won']) for(const count of [0,1,5,7]) {
    const {UI,context,texts}=loadUI(width);
    const misses=words.slice(0,count);
    if(count) misses.push(words[0]); // Repeated mistakes must not inflate the distinct-word total.
    UI.drawEndScreen(context,state,400,2,0,misses);
    const labels=texts.map(t=>t.value);
    if(count) {
      const expected=`今夜記錯的字：共 ${count} 字${count>5?'，僅顯示前 5 字':''}`;
      assert.ok(labels.includes(expected),`${width}/${state}/${count}: ${expected}`);
      for(let i=0;i<Math.min(count,5);i++) assert.ok(labels.some(v=>v.includes(words[i].jp)));
      for(let i=5;i<count;i++) assert.ok(!labels.some(v=>v.includes(words[i].jp)));
    } else assert.ok(!labels.some(v=>v.includes('今夜記錯')));
    assert.ok(!labels.some(v=>count<=5 && v.includes('僅顯示')));
  }
});

test('every second-stage Boss question has Chinese meaning even without Emoji support', () => {
  const content = require('../js/words.js');
  for (const word of content.getStageWords('rain-port')) {
    const { UI, context, texts } = loadUI();
    UI.drawBossQuiz(context, { word, ans: [word, word, word], lock: 0 });
    assert.ok(texts.some(t => t.value === `${word.zh}　→　？`), word.jp);
    if (word.cue !== 'emoji') assert.ok(!texts.some(t => t.value === word.icon), word.jp);
  }
});

test('settlement shows unique delivery and Boss corrections without changing misdelivery count',()=>{
  const {UI,context,texts}=loadUI(844);
  const words=[{jp:'ねこ',zh:'貓'},{jp:'あめ',zh:'雨'}];
  UI.drawEndScreen(context,'lost',0,0,1,[words[0],words[1],words[1]]);
  assert.ok(texts.some(t=>t.value==='今夜記錯的字：共 2 字'));
  const rendered=texts.map(t=>t.value).join('|');
  for(const w of words) assert.equal(rendered.split(`${w.jp}（${w.zh}）`).length-1,1);
  assert.ok(!texts.some(t=>/連擊|連答|連續答對/.test(t.value)));
  assert.ok(texts.some(t=>t.value==='送達  0 件'));assert.ok(texts.some(t=>t.value==='誤配  1 件'));
});

test('direction arrows rotate in place inside the task area instead of travelling along the screen edge',()=>{
  const {UI,context}=loadUI(844);const turns=[];context.rotate=a=>turns.push(a);
  const word=require('../js/words.js').getAllWords()[0];
  const job={word,to:{x:100,y:100},hintStage:0,showMeaningT:0};
  const draw=(job,extra,hunt)=>UI.drawHud(context,{x:0,y:0},100,100,0,600,0,0,0,1,0,30,job,0,[],null,null,false,null,{x:810,y:420,r:38},{x:810,y:530,r:46},{x:848,y:14,w:38,h:52},{},{},{},0,6,1.2,1.8,hunt,extra);
  draw(job,{guideAngle:1.234},false);assert.ok(turns.includes(1.234));
  turns.length=0;draw(null,{bossAngle:-2.5},true);assert.equal(turns.filter(a=>a===-2.5).length,2);
  turns.length=0;draw(null,{},false);assert.ok(!turns.includes(undefined)&&!turns.some(Number.isNaN)); // 沒有目標時不畫箭頭
});

test('parcel icon is the system emoji and no hand-drawn house-like cargo glyph remains',()=>{
  const {UI,context,texts}=loadUI(844);UI.drawActionIcon(context,'pickup',10,10,10);
  assert.ok(texts.some(t=>t.value==='📦'));
});

test('HUD shows level as a bottom edge strip and drops combo, shield and caption boxes',()=>{
  for(const [width,height] of [[900,600],[844,390],[1920,1080]]) {
    const r=drawHudFixture(width,height);
    assert.ok(r.labels.some(t=>t.value==='Lv.3'));
    assert.ok(!r.labels.some(t=>/連擊|連續答對|結界護盾/.test(t.value)||t.value==='12/45'));
    assert.ok(!r.labels.some(t=>/pt$|取貨|配達/.test(t.value)),'icons replace caption text');
  }
});

test('every live vocabulary HUD uses meaning before hints and written correction only after explicit assistance',()=>{
  for(const word of require('../js/words.js').getAllWords()) {
    const {UI,context,texts}=loadUI(844);
    const job={word,to:{x:100,y:100},hintStage:0,showMeaningT:0};
    const draw=()=>UI.drawHud(context,{x:0,y:0},100,100,0,600,0,0,0,1,0,30,job,0,[],null,null,false,null,{x:810,y:420,r:38},{x:810,y:530,r:46},{x:848,y:14,w:38,h:52},{},{},{},0);
    draw();assert.ok(texts.some(t=>t.value===word.zh));
    assert.ok(!texts.some(t=>String(t.value).includes(word.jp)),word.jp);
    texts.length=0;job.hintStage=2;job.showMeaningT=3;job.assisted=true;draw();
    assert.ok(texts.some(t=>String(t.value).includes(word.jp)),word.jp);
  }
});

test('north and south have distinct text cues and unknown images retain meaning', () => {
  const content = require('../js/words.js');
  const { UI, context, texts } = loadUI();
  for (const jp of ['きた', 'みなみ']) UI.drawWordCue(context, content.getStageWords('rain-port').find(w => w.jp === jp), 0, 0);
  UI.drawWordCue(context, {zh:'新詞'}, 0, 0);
  assert.deepEqual(texts.map(t => t.value), ['北方', '南方', '新詞']);
});
test('mobile body text renders at approximately 14 CSS pixels', () => {
  for (const width of [480, 585, 667, 844]) {
    const { UI } = loadUI(width);
    const size = Number(UI.readableFont(12).match(/(\d+)px/)[1]);
    assert.ok(size * width / 900 >= 14);
  }
});
test('all 39 words remain reachable across three readable codex pages', () => {
  const words = Array.from({ length: 39 }, (_, i) => ({ jp: `word${i}`, zh: '詞', icon: '📦', example: 'れいぶん' }));
  const store = { get: () => ({ ok: 1, ng: 0, box: 1 }) };
  const seen = [];
  for (let page = 0; page < 3; page++) {
    const { UI, context, texts } = loadUI();
    UI.drawCodex(context, store, words, 'words', page);
    const labels = texts.filter(t => /^word\d+$/.test(t.value));
    assert.equal(labels.length, page === 2 ? 9 : 15);
    assert.ok(labels.every(t => t.y < 520));
    seen.push(...labels.map(t => t.value));
  }
  assert.equal(new Set(seen).size, 39);
  const { UI, context, texts } = loadUI();
  UI.drawCodex(context, store, words, 'words', 0);
  assert.ok(!texts.some(t => t.value === 'れいぶん'));
});
test('in-run codex mask hides readings and icons until four stars', () => {
  const word = { jp: 'ねこ', zh: '貓', icon: '🐱', cue: 'emoji' };
  const hidden = { get: () => ({ ok: 1, ng: 1, box: 1 }) };
  const { UI, context, texts } = loadUI();
  UI.drawCodex(context, hidden, [word], 'words', 0, true);
  const masked = texts.map(t => t.value);
  assert.ok(masked.includes('？？'));
  assert.ok(!masked.includes('ねこ'));
  assert.ok(!masked.includes('貓'));
  assert.ok(!masked.includes('🐱'));
  const mastered = { get: () => ({ ok: 4, ng: 0, box: 4 }) };
  const shown = loadUI();
  shown.UI.drawCodex(shown.context, mastered, [word], 'words', 0, true);
  const open = shown.texts.map(t => t.value);
  assert.ok(open.includes('ねこ'));
  assert.ok(open.includes('貓'));
  assert.ok(open.includes('🐱'));
});
test('emoji cues use the system emoji glyph', () => {
  const ui = fs.readFileSync('js/ui.js', 'utf8');
  assert.ok(ui.includes("'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"));
  for (const word of require('../js/words.js').getAllWords().filter(w => w.cue === 'emoji')) {
    const { UI, context, texts } = loadUI();
    UI.drawWordCue(context, word, 12, 12, 28);
    assert.ok(texts.some(t => t.value === word.icon), word.jp);
  }
});
test('desktop HUD exposes the same dash cooldown seconds as mobile', () => {
  const { UI, context, texts } = loadUI(1200);
  UI.drawHud(context, { x: 0, y: 0 }, 100, 100, 2, 600, 0, 0, 0, 1, 0, 30, null, 0, [], null, null, false, null, { x:810,y:420,r:38 }, { x:810,y:530,r:46 }, { x:848,y:14,w:38,h:52 }, {}, {}, {}, 0, 6, 1.2, 1.8);
  assert.ok(texts.some(t => t.value === '1.2s'));
});

test('tutorial copy follows live bindings and never embeds any current answer',()=>{
  const {UI,env}=loadUI();
  env.localStorage={getItem:()=>null,setItem(){}};
  vm.runInNewContext(fs.readFileSync('js/controls.js','utf8'),env);
  env.window.CONTROLS.preset('left');
  assert.ok(UI.tutorialCopy('pickup','keyboard')[2].includes('U取貨'));
  env.window.CONTROLS.bind('interact','KeyT');
  assert.ok(UI.tutorialCopy('pickup','keyboard')[2].includes('T取貨'));
  assert.ok(UI.tutorialCopy('listen','keyboard')[2].includes('O是答題輔助'));
  const words=require('../js/words.js').getAllWords();
  for(const mode of ['keyboard','gamepad','touch']) for(const id of ['pickup','listen','delivery','dash','boss']) {
    const text=UI.tutorialCopy(id,mode).join(' ');
    assert.ok(words.every(w=>!text.includes(w.jp)), `${id}/${mode}`);
  }
  assert.ok(UI.tutorialCopy('delivery','touch')[2].includes('0.45'));
  assert.ok(UI.tutorialCopy('listen','gamepad')[2].includes('不升星'));
  assert.ok(UI.tutorialCopy('boss','gamepad')[2].includes('LB／RB／Y'));
  assert.ok(UI.tutorialCopy('pickup','touch')[2].includes('右側取貨鈕'));
});
test('all tutorial text and buttons stay within mobile card without Emoji rendering',()=>{
  for(const id of ['pickup','listen','delivery','dash','boss']) {
    const {UI,context,texts}=loadUI(844);
    UI.drawTutorial(context,{id,replay:false,focus:0},'touch');
    assert.ok(texts.every(t=>t.y>=115 && t.y<=490));
    assert.ok(texts.filter(t=>t.y>=211&&t.y<360).every(t=>t.y<345));
    assert.ok(UI.TUTORIAL_BTNS.every(b=>b.h*390/600>=44));
    assert.ok(!texts.some(t=>/[💡👁🎴📜]/u.test(t.value)));
  }
});
test('Boss option badges follow active keyboard, gamepad or touch input',()=>{
 for(const [mode,label] of [['keyboard','1 題詞'],['gamepad','LB 題詞'],['touch','題詞']]) {
  const {UI,context,texts}=loadUI();
  UI.drawBossQuiz(context,{word:{zh:'語意',cue:'text'},ans:[{jp:'題詞'}],lock:0},mode);
  assert.ok(texts.some(t=>t.value===label),mode);
 }
});
