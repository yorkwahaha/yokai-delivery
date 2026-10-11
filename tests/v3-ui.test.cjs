const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadUI(width = 844, height = 390) {
  const labels = [], arcs = [], roundRects = [], fills = [], gradient = { addColorStop() {} };
  const ctx = new Proxy({
    fillText: (value, x, y) => labels.push({value: String(value), x, y}),
    arc: (x,y,r) => arcs.push({x,y,r}),
    roundRect: (x,y,w,h,r) => roundRects.push({x,y,w,h,r}),
    fill: () => fills.push(ctx.fillStyle),
    measureText: text => ({width: [...String(text)].length * 13}),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient
  }, {get: (o, k) => o[k] || (() => {})});
  const env = {window: {innerWidth: width, innerHeight: height},
    performance: {now: () => 1000},
    document: {getElementById: () => ({getBoundingClientRect: () => ({width})})}};
  vm.runInNewContext(fs.readFileSync('js/ui.js', 'utf8'), env, {filename: require('node:path').resolve('js/ui.js')});
  const UI = env.window.UI;
  const hud = (job, extra = {}, classic = false) => UI[classic ? 'drawHudClassic' : 'drawHudDiegetic'](
    ctx, {x: 0, y: 0}, 80, 100, 120, 600, 3, 0, 150, 4, 20, 45,
    job, 0, [], null, null, false, null,
    {x:810,y:420,r:38}, {x:810,y:530,r:46}, {x:848,y:14,w:38,h:52},
    {katana:4}, {katana:{zh:'妖刀'}}, {}, 0, 6, 0, 1.8, false, extra);
  return {UI, ctx, labels, arcs, roundRects, fills, env, hud};
}
const word = {jp:'ねこ',zh:'貓',icon:'🐱',cue:'emoji'};
const job = () => ({word, to:{x:500,y:500},hintStage:0,hold:0,showMeaningT:0});

test('V3 UI harness calibration: current HUD draws real oil and level labels', () => {
  const r = loadUI(); r.hud(null);
  assert.ok(r.labels.some(t => t.value === 'Lv.4'));
  assert.ok(r.labels.some(t => t.value === '80/100'));
});

test('V3 UI: both HUD themes show a seal count and three lamps without wording', () => {
  for (const classic of [false, true]) {
    const r = loadUI(); r.hud(job(), {awakening:{seals:1,earned:1,nextIn:3,awakened:0}}, classic);
    assert.ok(r.labels.some(t => t.value === '×1'), '印章旁顯示持印數');
    assert.equal(r.arcs.filter(a=>a.r===3.5).length,3);
    assert.ok(!r.labels.some(t => /覺醒|再送/.test(t.value)), '覺醒 HUD 不應再有中文');
    assert.ok(!r.labels.some(t => t.value.includes(word.jp)));
  }
});

test('V3 UI: completed deliveries show four awakening lamps and count only', () => {
  const r = loadUI(); r.hud(null, {awakening:{seals:2,earned:4,nextIn:0,awakened:2}});
  assert.ok(r.labels.some(t=>t.value==='×2'));
  assert.equal(r.arcs.filter(a=>a.r===3.5).length,4);
  assert.ok(!r.labels.some(t=>/再送|覺醒/.test(t.value)));
});

test('awakening seal moves below the lantern at the left HUD edge on landscape devices', () => {
  for (const [width,height] of [[1280,720],[1024,768],[844,390]]) {
    const r=loadUI(width,height);
    const scale=Math.min(width/900,height/600),vw=width/scale,vh=height/scale;
    const offsetX=(vw-900)/2,offsetY=(vh-600)/2;
    const hudBounds={left:-offsetX+20/scale,top:-offsetY+20/scale,
      right:900+offsetX-20/scale,bottom:600+offsetY-20/scale};
    r.env.window.VIEWPORT={get:()=>({scale,offsetX,offsetY}),
      bounds:()=>({left:-offsetX,top:-offsetY,right:900+offsetX,bottom:600+offsetY,width:vw,height:vh}),
      hudBounds:()=>hudBounds};
    r.hud(job(), {awakening:{seals:2,earned:2,nextIn:2,awakened:0}});
    const badge=r.labels.find(t=>t.value==='×2');
    assert.ok(badge, 'seal count must remain visible');
    const screenX=(badge.x+offsetX)*scale,screenY=(badge.y+offsetY)*scale;
    assert.ok(screenX>=26&&screenX<=95, `${width}x${height}: badge must stay near left screen edge, not central mission area`);
    assert.ok(Math.abs(screenY-(20+(height<=500?220:198)*scale))<0.001,
      'badge clears the taller landscape lantern art');
  }
});

test('pause control uses centered navy and white solid bars rather than thin yellow strokes',()=>{
  const r=loadUI();r.hud(null);
  const bars=r.roundRects.filter(b=>b.w===4 && b.h===20);
  assert.equal(bars.length,2);
  assert.deepEqual(bars.map(b=>b.x),[-7,3]);
  assert.ok(r.fills.includes('#21364c'),'pause bars are ink navy, not gold');
});

test('V3 UI: one persistent central Boss HP bar survives quiz and seal break', () => {
  const r=loadUI(),boss={hp:70,max:100,shield:true,final:false};
  r.UI.drawBossQuiz(r.ctx,{word,ans:[word,word,word],lock:0},'touch',boss);
  assert.ok(r.labels.some(t=>t.value.includes(word.zh)));
  assert.equal(r.labels.filter(t=>t.value==='妖將').length,1);
  assert.ok(r.labels.some(t=>t.value.includes('結界展開')));
  const before=r.labels.length;
  boss.shield=false;
  r.UI.drawBossQuiz(r.ctx,null,'touch',boss,0.65);
  const exposed=r.labels.slice(before).map(t=>t.value);
  assert.equal(exposed.filter(t=>t==='妖將').length,1);
  assert.ok(exposed.some(t=>t.includes('全力進攻')));
  assert.ok(!exposed.some(t=>t.includes(word.jp)));
  const geometry=r.UI.bossQuizLayout(3);
  assert.ok(geometry.bar.y>geometry.y+geometry.h);
  assert.ok(geometry.bar.w<=520);
});

test('V3 UI: safe reading and free first hint are visible on a small screen', () => {
  const r = loadUI(); r.hud({...job(),reading:true}, {awakening:{seals:0,earned:0,nextIn:2,awakened:0}});
  assert.ok(r.labels.some(t => /安心讀題/.test(t.value)));
  assert.ok(r.labels.some(t => /免費/.test(t.value)));
  assert.ok(!r.labels.some(t => /聽.*-3/.test(t.value)));
});

test('V3 UI: level-up shows saved seals and the cost of choosing a MAX card', () => {
  const r = loadUI();
  r.UI.drawLevelUp(r.ctx, 12, [{type:'weapon',id:'katana',lv:5,n:'妖刀',d:'前方月牙最多穿六敵'}],
    {katana:4},{katana:{zh:'妖刀'}},2,1,0,'keyboard',{seals:1,earned:1,nextIn:3,awakened:0});
  assert.ok(r.labels.some(t => /覺醒印.*1/.test(t.value)));
  assert.ok(r.labels.some(t => /耗.*1.*印/.test(t.value)));
});

test('V3 UI: settlement distinguishes independent recall from assisted completion', () => {
  const r = loadUI();
  r.UI.drawEndScreen(r.ctx,'won',150,6,1,[word],0,
    {learning:{practiced:4,gained:2,lost:1,review:1,independent:5,assisted:2}});
  assert.ok(r.labels.some(t => /獨立回想.*5/.test(t.value)));
  assert.ok(r.labels.some(t => /提示完成.*2/.test(t.value)));
  assert.ok(r.labels.some(t => /下次複習/.test(t.value)));
  assert.ok(!r.labels.some(t => /已學會|已掌握/.test(t.value)));
});

test('V3 UI: optional listening has at most three unique words and keeps its buttons usable', () => {
  const r = loadUI();
  const words = [word,word,{jp:'いぬ',zh:'狗'}, {jp:'さかな',zh:'魚'}, {jp:'とり',zh:'鳥'}];
  assert.equal(typeof r.UI.reviewButtons, 'function');
  const buttons = r.UI.reviewButtons(words);
  assert.equal(buttons.length, 3);
  assert.equal(new Set(buttons.map(b => b.word.jp)).size, 3);
  assert.ok(buttons.every((b,i) => b.id === `review-${i}` && b.w > 60 && b.h >= 44));
  assert.equal(r.UI.reviewButtons([]).length, 0);
});

test('V3 UI: delivery tutorial states the real dwell time and safe reading', () => {
  const r = loadUI();
  r.UI.drawTutorial(r.ctx,{id:'delivery',focus:0},'keyboard');
  assert.ok(r.labels.some(t => /0\.65/.test(t.value)));
  assert.ok(r.labels.some(t => /安心|暫停/.test(t.value)));
});

test('V3 UI: boss protection status follows the actual reading flag', () => {
  for (const reading of [true, false]) {
    const r = loadUI();
    r.UI.drawBossQuiz(r.ctx,{word,ans:[word],wrong:[],lock:0,reading});
    assert.ok(r.labels.some(t => t.value.includes(reading ? '安心讀題' : '戰鬥已恢復')));
  }
});

test('V3 UI: introduced or assisted boss words keep the full meaning association visible', () => {
  for (const flag of ['introduced', 'wasAssisted']) {
    const r = loadUI();
    r.UI.drawBossQuiz(r.ctx,{word,ans:[word],wrong:[],lock:0,reading:true,[flag]:true});
    assert.ok(r.labels.some(t => t.value.includes(word.zh) && t.value.includes(word.jp)));
  }
});
