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
  assert.ok(texts.some(t=>t.value==='今夜記錯的字'));
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
