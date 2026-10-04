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
    assert.ok(r.labels.some(t=>t.value==='低油！'));
    const bar=r.rects.find(b=>b.fill==='#1c1814');assert.ok(bar.h*r.scale>=12);assert.ok(bar.w>=180);
    const label=r.labels.find(t=>t.value==='低油！');assert.ok(label.right+4<=number.left);
    const normal=drawHudFixture(width,height,41,160);assert.ok(!normal.labels.some(t=>t.value==='低油！'));
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
  assert.ok(texts.some(t=>t.value==='誤配  1 件'));
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
    assert.ok(!texts.some(t=>/[📦💡👁🎴📜]/u.test(t.value)));
  }
});
test('Boss option badges follow active keyboard, gamepad or touch input',()=>{
 for(const [mode,label] of [['keyboard','1 題詞'],['gamepad','LB 題詞'],['touch','題詞']]) {
  const {UI,context,texts}=loadUI();
  UI.drawBossQuiz(context,{word:{zh:'語意',cue:'text'},ans:[{jp:'題詞'}],lock:0},mode);
  assert.ok(texts.some(t=>t.value===label),mode);
 }
});
