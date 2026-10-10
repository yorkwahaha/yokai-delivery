const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadUI(width = 844, height = 390) {
  const labels = [], gradient = { addColorStop() {} };
  const ctx = new Proxy({
    fillText: (value, x, y) => labels.push({value: String(value), x, y}),
    measureText: text => ({width: [...String(text)].length * 13}),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient
  }, {get: (o, k) => o[k] || (() => {})});
  const env = {window: {innerWidth: width, innerHeight: height},
    performance: {now: () => 1000},
    document: {getElementById: () => ({getBoundingClientRect: () => ({width})})}};
  vm.runInNewContext(fs.readFileSync('js/ui.js', 'utf8'), env);
  const UI = env.window.UI;
  const hud = (job, extra = {}, classic = false) => UI[classic ? 'drawHudClassic' : 'drawHudDiegetic'](
    ctx, {x: 0, y: 0}, 80, 100, 120, 600, 3, 0, 150, 4, 20, 45,
    job, 0, [], null, null, false, null,
    {x:810,y:420,r:38}, {x:810,y:530,r:46}, {x:848,y:14,w:38,h:52},
    {katana:4}, {katana:{zh:'妖刀'}}, {}, 0, 6, 0, 1.8, false, extra);
  return {UI, ctx, labels, env, hud};
}
const word = {jp:'ねこ',zh:'貓',icon:'🐱',cue:'emoji'};
const job = () => ({word, to:{x:500,y:500},hintStage:0,hold:0,showMeaningT:0});

test('V3 UI harness calibration: current HUD draws real oil and level labels', () => {
  const r = loadUI(); r.hud(null);
  assert.ok(r.labels.some(t => t.value === 'Lv.4'));
  assert.ok(r.labels.some(t => t.value === '80/100'));
});

test('V3 UI: both HUD themes explain the next delivery seal without revealing the answer', () => {
  for (const classic of [false, true]) {
    const r = loadUI(); r.hud(job(), {awakening:{seals:1,earned:1,nextIn:3,awakened:0}}, classic);
    assert.ok(r.labels.some(t => /覺醒印.*1/.test(t.value)));
    assert.ok(r.labels.some(t => /再送.*3.*件/.test(t.value)));
    assert.ok(!r.labels.some(t => t.value.includes(word.jp)));
  }
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
