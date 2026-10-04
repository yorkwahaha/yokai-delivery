const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadGame(firstRun = false, tutorialSaved = firstRun ? null : '"skip"') {
  const events = {}, canvasEvents = {}, documentEvents = {};
  const gradient = { addColorStop() {} };
  const drawnText = [], actorCalls = [], transforms = [];
  const ctx = new Proxy({ setTransform: (...args) => transforms.push(args), fillText: text => drawnText.push(text), measureText: () => ({ width: 40 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => o[k] || (() => {}) });
  const canvas = { addEventListener: (k, f) => { canvasEvents[k] = f; }, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: env.innerWidth || 900, height: env.innerHeight || 600 }) };
  const controlsButton = { click() { this.clicked = true; } };
  const storage = new Map(tutorialSaved === null ? [] : [['yokai-tutorial-v1', tutorialSaved]]);
  const env = { console, Set, Map, Math, Date, performance: { now: () => 0 }, navigator: {}, requestAnimationFrame() {}, localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v) }, document: { hidden: false, getElementById: id => id === 'controls-open' ? controlsButton : canvas, addEventListener: (k, f) => { documentEvents[k] = f; } }, addEventListener: (k, f) => { events[k] = f; } };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['words', 'world', 'store', 'config', 'viewport', 'controls', 'overworld']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  c.CONTROLS.mount = () => {};
  const audioCalls = [];
  c.AUDIO = new Proxy({}, { get: (o, name) => () => audioCalls.push(name) });
  c.RENDERER = new Proxy({ drawHouse: h => actorCalls.push(`house:${h.id}`), drawPlayer: () => actorCalls.push('player'), drawMonster: e => actorCalls.push(`enemy:${e.id}`), getCtx: () => ctx, getDpr: () => c.devicePixelRatio || 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({x:0,y:0}), updateEffects: () => false }, { get: (o, k) => o[k] || (() => {}) });
  vm.runInContext(fs.readFileSync('js/ui.js','utf8'),c);
  const uiButtons=Object.fromEntries(Object.entries(c.UI).filter(([,v])=>typeof v!=='function'));
  c.UI = new Proxy({ ...uiButtons, pauseButtons:c.UI.pauseButtons, HINT_BTN: { x: 532, y: 20, w: 78, h: 40 }, readableFont: () => '20px sans-serif' }, { get: (o, k) => o[k] || (() => {}) });
  const source = fs.readFileSync('js/game.js', 'utf8');
  const end = source.lastIndexOf('})();');
  const hook = `window.fixture = { start, update, frame, drawWorld, makeOrder, hurt, pollGamepad, offerUp, triggerHint, resolve, spawnEnemy, weapons,
    tutorialState: () => tutorial,
    reviewWords: () => misses,
    answerBoss,
    setOil: value => { oil=value; },
    unlockBoss: () => { bossQ.lock=0; },
    matchBossToJob: () => { const bs=enemies.find(e=>e.type==='boss'); bs.word=job.word;bossQ=mkQ(bs);bossQ.lock=0; },
    moveBoss: distance => { const bs=enemies.find(e=>e.type==='boss'); Object.assign(bs,{x:P.x+distance,y:P.y,speed:0,wob:0,flash:0}); },
    clearOrders: () => { orders=[];job=null; },
    replayTutorial: () => activateMenu('tutorial'),
    atDestination: () => { P.x=job.to.x; P.y=job.to.y+110; },
    atAnswer: () => { const p=ansPos(job.to)[job.ans.indexOf(job.word)];P.x=p.x;P.y=p.y; },
    dashLesson: () => { elapsed=12; },
    face: angle => { P.faceAng=angle; },
    combatScene: (weapon, foes, walls=[]) => { Object.keys(WL).forEach(k=>WL[k]=0); WL[weapon]=1; wT[weapon]=0; enemies=foes.map(e=>({x:P.x+e.dx,y:P.y+(e.dy||0),hp:999,max:999,type:'ghost',...e})); solids.splice(0,solids.length,...walls.map(s=>({x0:P.x+s.x0,x1:P.x+s.x1,y0:P.y+s.y0,y1:P.y+s.y1}))); },
    heal: () => UP.find(u=>u.id==='oil_heal').f(),
    blockBossRing: all => { syncWorld(); const radius=spawnRadius(520); solids.splice(0,solids.length,all?{x0:P.x-10000,x1:P.x+10000,y0:P.y-10000,y1:P.y+10000}:{x0:P.x+radius-60,x1:P.x+radius+60,y0:P.y-60,y1:P.y+60}); },
    clearSolids: () => solids.splice(0),
    enemyBlocked: e => blocked(e.x,e.y,16),
    occlusionScene: (playerY) => { houses.splice(0,houses.length,{id:1,x:1350,y:900}); orders=[]; job=null; enemies=[{id:1,x:1350,y:820,type:'ghost'},{id:2,x:1350,y:1000,type:'ghost',vanish:0.5}]; P.y=playerY; state='pause'; },
    preparePickup: () => { makeOrder(); inter=orders[0]; },
    prepareOrder: () => { makeOrder(); inter=orders[0]; interact(); job.lock=0; },
    pickupWord: word => { const route=orders[0] || {from:houses[0],to:houses[1],rev:false}; orders=[{...route,word,life:110}];job=null;inter=orders[0];interact();job.lock=0; },
    scheduleBoss: () => { bossT=0; },
    advanceBossClock: offset => { elapsed=BOSS_TIMES[bossStage]+offset;bossT=-offset; },
    isolateNeedleBoss: () => { enemies=enemies.filter(e=>e.type==='boss');Object.keys(WL).forEach(k=>WL[k]=0);WL.needle=1;wT.needle=0;needles=[];spawnT=surgeT=Infinity; },
    meetDeliveryGoal: () => { delivered=GOAL_DELIVERIES; },
    prepareBoss: (word) => { const bs={x:P.x+200,y:P.y,type:'boss',word:word || ALL[0],hp:999,max:999,shield:true}; enemies.push(bs); bossQ=mkQ(bs); bossQ.lock=0; },
    setState: next => { state=next; ended=false; },
    snapshot: () => ({ state, needles, menuFocus, x:P.x, y:P.y, joy, dashCd, oil, score, level, elapsed, delivered, bossStage, bossT, finalBossDefeated, gems, cargo, job, orders, bossQ, codexTab, codexPage, floats:texts, enemies, enemyBullets, keys: [...keys] }),
    addMis: () => enemies.push({x:P.x+100,y:P.y,type:"mis",w:ALL[0],hp:999,max:999,speed:210,flash:0,wob:0}), emptyHouses: () => houses.splice(0) };`;
  vm.runInContext(source.slice(0, end) + hook + source.slice(end), c);
  return { ...c.fixture, events, canvasEvents, documentEvents, env: c, audioCalls, drawnText, actorCalls, transforms };
}
const pointer = (x, y, type = 'mouse') => ({ clientX: x, clientY: y, pointerId: 1, pointerType: type, button: 0, preventDefault() {} });
const key = (code, value = '') => ({ code, key: value, preventDefault() {} });
test('Boss mistakes reach settlement, count once per submission and reset only run review', () => {
  const g=loadGame(); g.start(); g.prepareBoss();
  const q=g.snapshot().bossQ, jp=q.word.jp;
  g.answerBoss(q.ans.findIndex(w=>w!==q.word));
  assert.equal(g.env.STORE.get(jp).ng,1);
  assert.equal(g.reviewWords().length,1);
  assert.equal(g.reviewWords()[0].jp,jp);
  g.answerBoss(0); // Retry lock prevents repeated submissions.
  assert.equal(g.env.STORE.get(jp).ng,1);
  g.unlockBoss();
  const retry=g.snapshot().bossQ;
  g.answerBoss(retry.ans.indexOf(retry.word));
  assert.equal(g.env.STORE.get(jp).box,0); // Eliminated option makes retry assisted.
  assert.equal(g.env.STORE.get(jp).ok,1);
  assert.equal(g.reviewWords().length,1);
  g.start();
  assert.equal(g.reviewWords().length,0);
  assert.equal(g.env.STORE.get(jp).ng,1);
});

test('lethal Boss mistake still reaches settlement review before run ends', () => {
  const g=loadGame();g.start();g.prepareBoss();g.setOil(8);
  const q=g.snapshot().bossQ;
  g.answerBoss(q.ans.findIndex(w=>w!==q.word));
  assert.equal(g.snapshot().state,'lost');
  assert.equal(g.reviewWords().length,1);
  assert.equal(g.env.STORE.get(q.word.jp).ng,1);
});

test('delivery hint cannot promote mastery through a simultaneous same-word Boss quiz',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();g.matchBossToJob();
  const jp=g.snapshot().job.word.jp;
  g.triggerHint();
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(jp).ok,1);
  assert.equal(g.env.STORE.get(jp).box,0);
});

test('Boss eliminated answer assistance also applies to an active same-word delivery',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();g.matchBossToJob();
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.findIndex(w=>w!==q.word));
  const j=g.snapshot().job;
  assert.equal(j.assisted,true);
  g.resolve(j.ans.indexOf(j.word));
  assert.equal(g.env.STORE.get(j.word.jp).box,0);
  assert.equal(g.snapshot().score,25);
});

test('unrelated delivery assistance does not penalize independent Boss mastery',()=>{
  const g=loadGame();g.start();g.prepareOrder();
  g.prepareBoss(g.env.CONTENT.getStageWords('night-town').find(w=>w.jp!==g.snapshot().job.word.jp));
  const q=g.snapshot().bossQ;
  assert.notEqual(g.snapshot().job.word.jp,q.word.jp);
  g.triggerHint();g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(q.word.jp).box,1);
  assert.equal(g.reviewWords().length,0);
});

test('same-word Boss retains delivery assistance after the parcel is submitted first',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();g.matchBossToJob();
  const j=g.snapshot().job;
  g.triggerHint();g.resolve(j.ans.indexOf(j.word));
  assert.equal(g.snapshot().job,null);
  assert.ok(g.snapshot().bossQ);
  assert.equal(g.snapshot().enemies.find(e=>e.type==='boss').shield,true);
  assert.equal(g.env.STORE.get(j.word.jp).ok,1);
  assert.equal(g.env.STORE.get(j.word.jp).box,0);
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(j.word.jp).ok,2);
  assert.equal(g.env.STORE.get(j.word.jp).box,0);
  assert.equal(g.snapshot().score,25);
});

test('hinted same-word delivery auto-submits after 0.45 seconds while Boss remains unanswered',t=>{
  const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();g.matchBossToJob();
  const j=g.snapshot().job,jp=j.word.jp;
  g.clearSolids();g.atAnswer();g.moveBoss(200);g.setOil(60);g.triggerHint();
  g.update(0.01); // Entering the correct pad starts the hold; it is not a direct resolve call.
  for(let i=0;i<44;i++) g.update(0.01);
  assert.ok(g.snapshot().job);
  const oilBefore=g.snapshot().oil;
  g.update(0.01);
  const submitted=g.snapshot();
  assert.equal(submitted.job,null);
  assert.equal(submitted.score,25);
  assert.ok(Math.abs(submitted.oil-oilBefore-10)<0.01);
  assert.ok(submitted.bossQ);
  assert.equal(submitted.enemies.find(e=>e.type==='boss').shield,true);
  assert.equal(g.env.STORE.get(jp).ok,1);
  assert.equal(g.env.STORE.get(jp).box,0);
  t.diagnostic(JSON.stringify({scenario:'hint-auto-delivery-first',elapsed:submitted.elapsed,score:submitted.score,oilGain:submitted.oil-oilBefore,bossPending:true,afterDelivery:{...g.env.STORE.get(jp)}}));
  g.answerBoss(submitted.bossQ.ans.indexOf(submitted.bossQ.word));
  assert.equal(g.snapshot().bossQ,null);
  assert.equal(g.env.STORE.get(jp).ok,2);
  assert.equal(g.env.STORE.get(jp).box,0);
  t.diagnostic(JSON.stringify({scenario:'hint-auto-delivery-then-boss',afterBoss:{...g.env.STORE.get(jp)}}));
});

for(const seconds of [1.79,1.81]) {
  test(`same-word Boss answer at ${seconds}s follows current feedback rule without extending its lifetime`,t=>{
    const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();g.matchBossToJob();
    const j=g.snapshot().job,jp=j.word.jp;
    g.clearSolids();g.atAnswer();g.moveBoss(200);g.setOil(50);
    g.resolve(j.ans.indexOf(j.word));
    assert.equal(g.snapshot().oil,78);
    assert.equal(g.snapshot().score,50);
    assert.equal(g.snapshot().job,null);
    assert.equal(g.env.STORE.get(jp).box,1);
    for(let i=0;i<Math.round(seconds*100);i++) g.update(0.01);
    const s=g.snapshot(),feedback=s.floats.find(f=>f.v.includes(jp+'＝'));
    assert.equal(!!feedback,seconds<1.8);
    assert.ok(s.bossQ);
    assert.equal(s.bossQ.word.jp,jp);
    g.answerBoss(s.bossQ.ans.indexOf(s.bossQ.word));
    assert.equal(g.snapshot().bossQ,null);
    assert.equal(g.env.STORE.get(jp).ok,2);
    assert.equal(g.env.STORE.get(jp).box,2); // Current policy allows both sides of the feedback boundary.
    t.diagnostic(JSON.stringify({scenario:'ordinary-delivery-feedback-boundary',elapsed:s.elapsed,feedbackAlive:!!feedback,feedbackLife:feedback?.life||0,score:s.score,afterBoss:{...g.env.STORE.get(jp)}}));
  });
}

test('Boss assistance survives leaving and reentering quiz range',()=>{
  const g=loadGame();g.start();g.prepareBoss();
  let q=g.snapshot().bossQ;
  g.answerBoss(q.ans.findIndex(w=>w!==q.word));
  g.moveBoss(1000);g.update(0.01);assert.equal(g.snapshot().bossQ,null);
  g.moveBoss(200);g.update(0.01);g.unlockBoss();
  q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(q.word.jp).box,0);
});

test('Boss assistance clears for a changed word and for a replay',t=>{
  const g=loadGame();g.start();g.prepareBoss();
  const old=g.snapshot().bossQ.word.jp;
  g.answerBoss(g.snapshot().bossQ.ans.findIndex(w=>w.jp!==old));g.unlockBoss();
  g.answerBoss(g.snapshot().bossQ.ans.findIndex(w=>w.jp!==old));g.unlockBoss();
  const next=g.snapshot().bossQ;assert.notEqual(next.word.jp,old);
  assert.equal(next.wasAssisted,false);
  g.answerBoss(next.ans.indexOf(next.word));assert.equal(g.env.STORE.get(next.word.jp).box,1);
  t.diagnostic(JSON.stringify({scenario:'changed-word-clears-assistance',assisted:next.wasAssisted,afterAnswer:{...g.env.STORE.get(next.word.jp)}}));
  g.start();g.prepareBoss(g.env.CONTENT.getStageWords('night-town').find(w=>w.jp===old));
  const replay=g.snapshot().bossQ;g.answerBoss(replay.ans.indexOf(replay.word));
  assert.equal(replay.wasAssisted,false);
  assert.equal(g.env.STORE.get(old).box,1);
  t.diagnostic(JSON.stringify({scenario:'new-run-clears-assistance',assisted:replay.wasAssisted,afterAnswer:{...g.env.STORE.get(old)}}));
});

test('second hint transfers assistance to a Boss that appeared after the first hint',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.triggerHint();
  g.prepareBoss();g.matchBossToJob();g.triggerHint();
  const j=g.snapshot().job;g.resolve(j.ans.indexOf(j.word));
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(j.word.jp).box,0);
});

test('assisted submission marks a same-word Boss created after the last hint',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.triggerHint();
  g.prepareBoss();g.matchBossToJob();
  const j=g.snapshot().job;g.resolve(j.ans.indexOf(j.word));
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(j.word.jp).box,0);
});

test('ordinary delivery correction remains visible during an independent same-word Boss answer',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();g.matchBossToJob();
  const j=g.snapshot().job;g.resolve(j.ans.indexOf(j.word));
  assert.ok(g.snapshot().floats.some(t=>t.life===1.8 && t.v.includes(j.word.jp+'＝')));
  const q=g.snapshot().bossQ;assert.equal(q.word.jp,j.word.jp);
  g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(g.env.STORE.get(j.word.jp).box,2); // Observation of current rule; policy decision deferred.
});

test('new pickup inherits only the current same-word Boss assistance',()=>{
  const g=loadGame();g.start();g.prepareBoss();
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.findIndex(w=>w!==q.word));
  g.pickupWord(q.word);assert.equal(g.snapshot().job.assisted,true);
  const other=g.env.CONTENT.getStageWords('night-town').find(w=>w.jp!==q.word.jp);
  g.pickupWord(other);assert.equal(g.snapshot().job.assisted,false);
});

test('purification feedback overlaps the next real priority order without granting mastery',()=>{
  const g=loadGame();g.start();g.prepareOrder();
  const j=g.snapshot().job;g.resolve(j.ans.findIndex(w=>w!==j.word));
  const mis=g.snapshot().enemies.find(e=>e.type==='mis');g.hurt(mis,999);
  g.clearOrders();g.makeOrder();
  assert.equal(g.snapshot().orders[0].word.jp,j.word.jp);
  assert.ok(g.snapshot().floats.some(t=>t.life===1.8 && t.v.includes(j.word.jp+'＝')));
  assert.equal(g.env.STORE.get(j.word.jp).box,0);
});

test('automatic order refill can repeat a purified word while its correction is still alive',()=>{
  const g=loadGame();g.start();g.prepareOrder();
  const word=g.snapshot().job.word;
  g.resolve(g.snapshot().job.ans.findIndex(w=>w!==word));
  g.update(0.01); // A living badge excludes the word from this order.
  assert.notEqual(g.snapshot().orders[0].word.jp,word.jp);
  g.prepareOrder(); // Picking that other parcel frees the one order slot.
  const mis=g.snapshot().enemies.find(e=>e.type==='mis');g.hurt(mis,999);
  g.update(0.01); // Real update refills the slot, not a direct makeOrder call.
  assert.equal(g.snapshot().orders[0].word.jp,word.jp);
  assert.notEqual(g.snapshot().job.word.jp,word.jp);
  assert.ok(g.snapshot().floats.some(t=>t.life>1.7 && t.v.includes(word.jp+'＝')));
  assert.equal(g.env.STORE.get(word.jp).box,0);
});

test('scheduled Boss can draw a purified word and open its quiz before correction expires',()=>{
  const g=loadGame();g.start();g.prepareOrder();
  const word=g.snapshot().job.word;
  g.resolve(g.snapshot().job.ans.findIndex(w=>w!==word));
  g.hurt(g.snapshot().enemies.find(e=>e.type==='mis'),999);
  const pickWord=g.env.STORE.pick;
  let bossPoolIncludesWord=false;
  g.env.STORE.pick=pool=>{bossPoolIncludesWord=pool.some(w=>w.jp===word.jp);return pool.find(w=>w.jp===word.jp)||pickWord(pool);};
  g.scheduleBoss();g.update(0.01); // Real spawn path; controlled selection, not a natural probability measurement.
  assert.equal(bossPoolIncludesWord,true);
  assert.equal(g.snapshot().enemies.find(e=>e.type==='boss').word.jp,word.jp);
  g.moveBoss(200);g.update(0.01);
  assert.equal(g.snapshot().bossQ.word.jp,word.jp);
  assert.ok(g.snapshot().floats.some(t=>t.life>1.7 && t.v.includes(word.jp+'＝')));
});

test('delivery mistake persists, avoids its living answer badge and returns after purification', () => {
  const g=loadGame();g.start();g.prepareOrder();
  const j=g.snapshot().job,jp=j.word.jp;
  g.resolve(j.ans.findIndex(w=>w!==j.word));
  const saved=JSON.parse(g.env.localStorage.getItem('yokai-delivery-v1'));
  assert.equal(saved.m[jp].ng,1);assert.equal(saved.m[jp].missBoost,2.5);
  assert.equal(g.reviewWords()[0].jp,jp);
  g.clearOrders();g.makeOrder();
  assert.ok(g.snapshot().orders.every(o=>o.word.jp!==jp));
  const mis=g.snapshot().enemies.find(e=>e.type==='mis'&&e.w.jp===jp);
  g.hurt(mis,999);
  assert.equal(g.env.STORE.get(jp).ok,0);assert.equal(g.env.STORE.get(jp).box,0);
  g.clearOrders();g.makeOrder();assert.equal(g.snapshot().orders[0].word.jp,jp);
  g.start();assert.equal(g.snapshot().orders[0].word.jp,jp);
  assert.equal(g.reviewWords().length,0);
});

test('first-run tutorial freezes time, oil and gameplay input, and skip persists', () => {
  const g=loadGame(true); g.start(); g.update(0.05);
  assert.equal(g.tutorialState().id,'pickup');
  const before=g.snapshot();
  g.events.keydown(key('Space',' ')); g.canvasEvents.pointerdown(pointer(810,530)); g.update(0.05);
  assert.equal(g.snapshot().oil,before.oil); assert.equal(g.snapshot().elapsed,before.elapsed);
  assert.equal(g.snapshot().dashCd,0); assert.equal(g.snapshot().joy,null);
  g.events.keydown(key('Escape','Escape')); assert.equal(g.tutorialState(),null);
  g.start(); g.update(0.05); assert.equal(g.tutorialState(),null);
  const restored=loadGame(true,g.env.localStorage.getItem('yokai-tutorial-v1'));restored.start();
  assert.equal(restored.tutorialState(),null);
});
test('malformed tutorial progress recovers and touch confirmation does not start dragging',()=>{
  const g=loadGame(true,'{}');g.start();assert.equal(g.tutorialState().id,'pickup');
  g.canvasEvents.pointerdown(pointer(250,425,'touch'));
  assert.equal(g.tutorialState(),null);assert.equal(g.snapshot().joy,null);
  g.events.blur();g.replayTutorial();g.events.keydown(key('Escape','Escape'));
  assert.equal(g.snapshot().state,'pause');
});
test('context lessons cover listening, delivery, dash and Boss without changing assistance', () => {
  const g=loadGame(true); g.start(); g.update(0.05);
  const next=()=>g.events.keydown(key('Enter','Enter'));
  next(); g.prepareOrder(); g.update(0.05); assert.equal(g.tutorialState().id,'listen');
  assert.equal(g.snapshot().job.assisted,false); const oil=g.snapshot().oil;
  next(); g.atDestination(); g.update(0.05); assert.equal(g.tutorialState().id,'delivery');
  assert.equal(g.snapshot().oil,oil);
  next(); g.dashLesson(); g.update(0.05); assert.equal(g.tutorialState().id,'dash');
  next(); g.prepareBoss(); g.update(0.05); assert.equal(g.tutorialState().id,'boss');
});
test('replay is available from pause, gamepad consumes confirmation and returns to pause', () => {
  const g=loadGame(); g.start(); g.setState('pause'); g.replayTutorial();
  assert.equal(g.tutorialState().id,'pickup');
  const buttons=Array.from({length:16},()=>({pressed:false}));
  g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}];
  for(let i=0;i<5;i++){buttons[0].pressed=true;g.pollGamepad();buttons[0].pressed=false;g.pollGamepad();}
  assert.equal(g.tutorialState(),null); assert.equal(g.snapshot().state,'pause');
  assert.equal(g.snapshot().job,null);
});
test('mobile pause replay uses the same enlarged geometry for drawing and pointer input',()=>{
 const g=loadGame();g.env.innerWidth=844;g.env.innerHeight=390;g.start();g.frame(20);g.setState('pause');
 const v=g.env.VIEWPORT.get(),btn=g.env.UI.pauseButtons().find(b=>b.id==='tutorial');
 assert.ok(btn.h*v.scale>=44);
 g.canvasEvents.pointerdown(pointer((btn.x+btn.w/2+v.offsetX)*v.scale,(btn.y+btn.h/2+v.offsetY)*v.scale,'touch'));
 assert.equal(g.tutorialState().id,'pickup');assert.equal(g.snapshot().state,'pause');
});
test('mouse drag begins on the right half and moves the courier; touch stays on left', () => {
  const g = loadGame(); g.start(); const before = g.snapshot();
  g.canvasEvents.pointerdown(pointer(680, 350));
  assert.ok(g.snapshot().joy);
  g.canvasEvents.pointermove(pointer(740, 350)); g.update(0.05);
  assert.ok(g.snapshot().x > before.x);
  g.canvasEvents.pointerup(pointer(740, 350));
  g.canvasEvents.pointerdown(pointer(680, 350, 'touch'));
  assert.equal(g.snapshot().joy, null);
});
test('custom movement, dash and blur route through real event listeners', () => {
  const g = loadGame(); g.start(); g.env.CONTROLS.preset('left');
  g.events.keydown(key('KeyL', 'l')); assert.ok(g.snapshot().keys.includes('r'));
  g.events.keyup(key('KeyL', 'l')); assert.equal(g.snapshot().keys.length, 0);
  g.canvasEvents.pointerdown(pointer(810, 530)); assert.ok(g.snapshot().dashCd > 0);
  g.events.blur(); assert.equal(g.snapshot().state, 'pause');
  const elapsed = g.snapshot().elapsed; g.update(0.05); assert.equal(g.snapshot().elapsed, elapsed);
});
test('misdelivery enemy settles away from player and retains a ranged penalty', () => {
  const g = loadGame(); g.start(); g.addMis();
  for (let i = 0; i < 65; i++) g.update(0.05);
  const s = g.snapshot(), enemy = s.enemies.find(e => e.type === 'mis');
  assert.ok(enemy);
  assert.ok(Math.hypot(enemy.x - s.x, enemy.y - s.y) >= 80);
  assert.ok(s.enemyBullets.length > 0 || s.oil < 95);
});
test('empty pickup pool cannot crash order creation', () => {
  const g = loadGame(); g.start(); g.emptyHouses(); assert.doesNotThrow(() => g.makeOrder());
});

test('releasing one equivalent movement key keeps the other held key active', () => {
  const g = loadGame(); g.start();
  g.events.keydown(key('KeyW', 'w')); g.events.keydown(key('ArrowUp', 'ArrowUp'));
  g.events.keyup(key('KeyW', 'w')); assert.ok(g.snapshot().keys.includes('u'));
  g.events.keyup(key('ArrowUp', 'ArrowUp')); assert.equal(g.snapshot().keys.length, 0);
});

test('cargo stays visible beside an idle courier with no movement history', () => {
  const g = loadGame(); g.start();
  for (let i = 0; i < 30; i++) g.update(0.05);
  const s = g.snapshot();
  assert.ok(Math.hypot(s.cargo.x - s.x, s.cargo.y - s.y) >= 63.9);
});

test('Boss death and settlement audio fire once per event, not once per frame', () => {
  const g = loadGame(); g.start();
  const boss = {x:1400,y:900,type:'boss',hp:1,max:1,shield:false};
  g.hurt(boss, 2); g.hurt(boss, 2);
  assert.equal(g.audioCalls.filter(n => n === 'bossDeath').length, 1);
  g.setState('won'); g.frame(20); g.frame(40);
  assert.equal(g.audioCalls.filter(n => n === 'fanfare').length, 1);
  g.setState('lost'); g.frame(60); g.frame(80);
  assert.equal(g.audioCalls.filter(n => n === 'lose').length, 1);
});

test('expanded fullscreen edges and corner HUD buttons share the same pointer mapping', () => {
  const g = loadGame(); g.env.innerWidth = 1800; g.env.innerHeight = 600; g.start();
  const before = g.snapshot().x;
  g.canvasEvents.pointerdown(pointer(100, 350)); g.canvasEvents.pointermove(pointer(160, 350)); g.update(0.05);
  assert.ok(g.snapshot().x > before);
  g.canvasEvents.pointerup(pointer(160, 350));
  g.frame(20);
  g.canvasEvents.pointerdown(pointer(1642, 510));
  assert.ok(g.snapshot().dashCd > 0);
  g.canvasEvents.pointerdown(pointer(1740, 50));
  assert.equal(g.snapshot().state, 'pause');
});

test('scheduled Boss shield, kill reward and overdue successor follow one lifecycle',t=>{
  const g=loadGame();g.start();g.clearSolids();g.advanceBossClock(-0.02);
  g.update(0.01);
  assert.equal(g.snapshot().enemies.some(e=>e.type==='boss'),false);
  g.update(0.02);
  const boss=g.snapshot().enemies.find(e=>e.type==='boss');
  assert.ok(boss);assert.equal(g.snapshot().bossStage,1);
  assert.equal(boss.final,false);
  const hp=boss.hp;
  g.hurt(boss,999);
  assert.equal(boss.hp,hp);assert.equal(g.snapshot().score,0);
  g.moveBoss(200);g.update(0.01);g.unlockBoss();
  const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
  assert.equal(boss.shield,false);
  const learned={...g.env.STORE.get(q.word.jp)};
  g.advanceBossClock(0.01);g.update(0.01); // Second schedule is overdue but the first Boss still lives.
  assert.equal(g.snapshot().bossStage,1);
  assert.equal(g.snapshot().enemies.filter(e=>e.type==='boss').length,1);
  g.setOil(50);
  const before=g.snapshot(),gemCount=before.gems.length;
  g.hurt(boss,999);
  assert.equal(g.snapshot().score-before.score,400);
  assert.equal(g.snapshot().oil,85);
  assert.equal(g.snapshot().gems.length-gemCount,9);
  assert.deepEqual({...g.env.STORE.get(q.word.jp)},learned);
  g.hurt(boss,999);
  assert.equal(g.snapshot().score-before.score,400);
  assert.equal(g.snapshot().oil,85);
  assert.equal(g.snapshot().gems.length-gemCount,9);
  assert.equal(g.audioCalls.filter(n=>n==='bossDeath').length,1);
  g.update(0.01);
  const successor=g.snapshot().enemies.find(e=>e.type==='boss');
  assert.ok(successor);assert.notEqual(successor,boss);
  assert.equal(g.snapshot().bossStage,2);assert.equal(successor.shield,true);
  assert.ok(Math.abs(g.snapshot().bossT-(540-g.snapshot().elapsed))<1e-9);
  t.diagnostic(JSON.stringify({scenario:'boss-kill-and-successor',killScore:400,killOil:35,gemDrops:9,masteryBefore:learned.box,masteryAfter:g.env.STORE.get(q.word.jp).box,bossStage:g.snapshot().bossStage,nextSchedule:540}));
});

for(const assisted of [false,true]) {
  test(`real needle updates defeat a scheduled Boss after ${assisted?'assisted':'ordinary'} answering without kill mastery`,t=>{
    const g=loadGame();g.start();g.clearSolids();g.advanceBossClock(0.01);g.update(0.01);
    g.isolateNeedleBoss();g.moveBoss(200);g.setOil(40);
    const boss=g.snapshot().enemies.find(e=>e.type==='boss'),initialHp=boss.hp;
    for(let i=0;i<30;i++) g.update(0.02);
    assert.ok(g.audioCalls.includes('needle'));
    assert.equal(boss.hp,initialHp);assert.equal(g.snapshot().score,0);
    g.unlockBoss();
    if(assisted) {
      const q=g.snapshot().bossQ;g.answerBoss(q.ans.findIndex(w=>w!==q.word));g.unlockBoss();
    }
    const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
    assert.equal(boss.shield,false);
    const learned={...g.env.STORE.get(q.word.jp)},startElapsed=g.snapshot().elapsed;
    assert.equal(learned.box,assisted?0:1);
    let previousOil,hitObserved=false;
    for(let i=0;i<2000 && boss.hp>0;i++) {
      previousOil=g.snapshot().oil;g.update(0.02);
      if(boss.hp<initialHp) hitObserved=true;
    }
    assert.equal(hitObserved,true);assert.ok(boss.hp<=0);
    assert.equal(g.snapshot().score,400);
    assert.ok(Math.abs(g.snapshot().oil-previousOil-(35-0.02*0.43))<1e-8);
    assert.deepEqual({...g.env.STORE.get(q.word.jp)},learned);
    assert.equal(g.audioCalls.filter(n=>n==='bossDeath').length,1);
    const score=g.snapshot().score,combatSeconds=g.snapshot().elapsed-startElapsed;
    for(let i=0;i<5;i++) g.update(0.02);
    assert.equal(g.snapshot().score,score);
    assert.equal(g.audioCalls.filter(n=>n==='bossDeath').length,1);
    t.diagnostic(JSON.stringify({scenario:'needle-boss-integration',assisted,initialHp,combatSeconds,score,masteryAfterAnswer:learned.box,masteryAfterKill:g.env.STORE.get(q.word.jp).box,killEvents:1}));
  });
}

test('final Boss requires the delivery goal and victory settles progression only once',t=>{
  const g=loadGame();g.start();g.clearSolids();
  for(let stage=0;stage<4;stage++) {
    g.advanceBossClock(0.01);g.setOil(100);g.update(0.01);
    const boss=g.snapshot().enemies.find(e=>e.type==='boss');
    assert.ok(boss);assert.equal(boss.final,stage===3);
    g.moveBoss(200);g.update(0.01);g.unlockBoss();
    const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
    g.hurt(boss,999);g.update(0.01);
    assert.equal(g.snapshot().state,'play');
  }
  assert.equal(g.snapshot().finalBossDefeated,true);
  assert.equal(g.snapshot().delivered,0);
  assert.equal(g.env.STORE.isStageCompleted('night-town'),false);
  assert.equal(g.env.STORE.isStageUnlocked('rain-port'),false);
  let finishes=0;
  const finish=g.env.STORE.finish;
  g.env.STORE.finish=(...args)=>{finishes++;return finish(...args);};
  g.meetDeliveryGoal();g.update(0.01);
  assert.equal(g.snapshot().state,'victory');assert.equal(finishes,0);
  for(let i=1;i<=95;i++) g.frame(i*50);
  assert.equal(g.snapshot().state,'victory');assert.equal(finishes,0);
  for(let i=96;i<=102;i++) g.frame(i*50);
  assert.equal(g.snapshot().state,'won');assert.equal(finishes,1);
  assert.equal(g.env.STORE.isStageCompleted('night-town'),true);
  assert.equal(g.env.STORE.isStageUnlocked('rain-port'),true);
  assert.equal(g.env.STORE.getStageStats('night-town').clears,1);
  assert.equal(g.audioCalls.filter(n=>n==='fanfare').length,1);
  const stats=g.env.STORE.getStageStats('night-town');
  assert.equal(stats.bestScore,g.snapshot().score);
  assert.equal(stats.bestDeliveries,g.snapshot().delivered);
  t.diagnostic(JSON.stringify({scenario:'final-boss-victory-settlement',state:g.snapshot().state,finishes,score:g.snapshot().score,delivered:g.snapshot().delivered,stats:{...stats},rainPortUnlocked:true}));
});

test('first hint hides written answer and assisted delivery cannot promote mastery', () => {
  const g = loadGame(); g.start(); g.prepareOrder();
  const jp = g.snapshot().job.word.jp, before = g.env.STORE.get(jp).box;
  g.triggerHint();
  const s = g.snapshot();
  assert.equal(s.job.assisted, true);
  assert.ok(!JSON.stringify(s.floats).includes(jp));
  assert.ok(g.audioCalls.includes('speak'));
  g.resolve(s.job.ans.indexOf(s.job.word));
  assert.equal(g.env.STORE.get(jp).box, before);
  assert.equal(g.snapshot().score, 25);
});

test('pickup bubble shows meaning instead of written answer', () => {
  const g = loadGame(); g.start(); g.makeOrder();
  const word = g.snapshot().orders[0].word;
  g.frame(20);
  assert.ok(g.drawnText.some(t => t.includes(word.zh)));
  assert.ok(!g.drawnText.some(t => t.includes(word.jp)));
});

test('Boss question preserves gamepad pickup, dash and hint; shoulders and Y answer', () => {
  const g = loadGame(); g.start(); g.makeOrder(); g.prepareBoss();
  const buttons = Array.from({length:16}, () => ({pressed:false}));
  g.env.navigator.getGamepads = () => [{connected:true, axes:[0,0], buttons}];
  const press = i => { buttons[i].pressed=true; g.pollGamepad(); buttons[i].pressed=false; g.pollGamepad(); };
  // Use a real pickup target through the fixture, then test combat controls with the question open.
  g.preparePickup(); const q = g.snapshot().bossQ;
  press(0); assert.ok(g.snapshot().job); assert.equal(g.snapshot().bossQ, q);
  press(1); assert.ok(g.snapshot().dashCd > 0); assert.equal(g.snapshot().bossQ, q);
  press(2); assert.equal(g.snapshot().job.hintStage, 1); assert.equal(g.snapshot().bossQ, q);
  press(0); assert.equal(g.snapshot().bossQ, q);
  q.lock=0;
  const oilBefore = g.snapshot().oil;
  press(4);
  assert.ok(g.snapshot().bossQ !== q || g.snapshot().oil === oilBefore - 8);
});

test('codex words pages are reachable by keyboard and gamepad without changing tabs', () => {
  const g = loadGame(); g.start(); g.setState('codex');
  g.events.keydown(key('Tab', 'Tab'));
  assert.equal(g.snapshot().codexTab, 'words');
  for (let i=0; i<4; i++) g.events.keydown(key('ArrowRight', 'ArrowRight'));
  assert.equal(g.snapshot().codexPage, 2);
  g.events.keydown(key('ArrowLeft', 'ArrowLeft')); assert.equal(g.snapshot().codexPage, 1);
  const buttons = Array.from({length:16}, () => ({pressed:false}));
  g.env.navigator.getGamepads = () => [{connected:true, axes:[0,0], buttons}];
  buttons[15].pressed=true; g.pollGamepad(); assert.equal(g.snapshot().codexPage, 2);
  buttons[15].pressed=false; buttons[14].pressed=true; g.pollGamepad(); assert.equal(g.snapshot().codexPage, 1);
  assert.equal(g.snapshot().codexTab, 'words');
});

test('all upgrade input paths reject accidental selection for the first 0.4 seconds', () => {
  for (const input of ['keyboard', 'pointer', 'gamepad']) {
    const g = loadGame(); g.start(); g.offerUp();
    const buttons = Array.from({length:16}, () => ({pressed:false}));
    g.env.navigator.getGamepads = () => [{connected:true, axes:[0,0], buttons}];
    const select = () => {
      if (input === 'keyboard') g.events.keydown(key('Digit1', '1'));
      if (input === 'pointer') g.canvasEvents.pointerdown(pointer(200, 210));
      if (input === 'gamepad') { buttons[0].pressed=true; g.pollGamepad(); buttons[0].pressed=false; g.pollGamepad(); }
    };
    select(); assert.equal(g.snapshot().state, 'levelup', input);
    for (let i=1; i<=9; i++) g.frame(i*50);
    select(); assert.equal(g.snapshot().state, 'play', input);
  }
});

test('regular and ring enemies spawn beyond wide view and camera lag', () => {
  for (const [width,height] of [[844,390],[2560,1080],[1800,600]]) {
    const g = loadGame(); g.env.innerWidth=width; g.env.innerHeight=height; g.start();
    const v = g.env.VIEWPORT.get();
    for (let i=0; i<8; i++) g.spawnEnemy(1, 450, i*Math.PI/4, true);
    assert.ok(g.snapshot().enemies.length > 0);
    const cam = g.env.RENDERER.getCam();
    for (const e of g.snapshot().enemies) {
      assert.ok(Math.abs(e.x-(cam.x+450)) > v.width/2+26 || Math.abs(e.y-(cam.y+300)) > v.height/2+26);
    }
  }
});

test('scheduled Boss spawns outside the widescreen view through real update logic', () => {
  const g = loadGame(); g.env.innerWidth=1800; g.env.innerHeight=600; g.start(); g.scheduleBoss();
  g.update(0.01);
  const boss = g.snapshot().enemies.find(e => e.type === 'boss');
  assert.ok(boss);
  const cam = g.env.RENDERER.getCam(), v = g.env.VIEWPORT.get();
  assert.ok(Math.abs(boss.x-(cam.x+450)) > v.width/2+26 || Math.abs(boss.y-(cam.y+300)) > v.height/2+26);
  g.update(0.01); assert.ok(g.snapshot().enemies.includes(boss));
});

test('each dedicated gamepad Boss answer button selects its documented option', () => {
  for (const [index,button] of [[0,4],[1,5],[2,3]]) {
    const g = loadGame(); g.start(); g.prepareBoss();
    const q = g.snapshot().bossQ;
    const wrong = g.env.CONTENT.getAllWords().filter(w => w !== q.word).slice(0,2);
    q.ans = [...wrong]; q.ans.splice(index,0,q.word);
    const buttons = Array.from({length:16}, () => ({pressed:false}));
    g.env.navigator.getGamepads = () => [{connected:true, axes:[0,0], buttons}];
    buttons[button].pressed=true; g.pollGamepad();
    assert.equal(g.snapshot().bossQ, null, button);
    assert.equal(g.snapshot().enemies.find(e => e.type === 'boss').shield, false);
  }
});

test('actors are painted by ground contact so roofs cover the north side and yield at the doorway', () => {
  const g=loadGame(); g.start();
  g.occlusionScene(850); g.drawWorld();
  assert.deepEqual(g.actorCalls,['enemy:1','player','house:1','enemy:2']);
  g.actorCalls.length=0;
  g.occlusionScene(975); g.drawWorld();
  assert.deepEqual(g.actorCalls,['enemy:1','house:1','player','enemy:2']);
});

test('frame maps logical coordinates to CSS scale and refreshes renderer DPR', () => {
  const g=loadGame(); g.env.innerWidth=1920; g.env.innerHeight=1080;
  g.frame(20);
  assert.equal(g.transforms.at(-1)[0],1.8);
  g.env.devicePixelRatio=2; g.env.innerWidth=844; g.env.innerHeight=390;
  g.events.resize(); g.frame(40);
  const v=g.env.VIEWPORT.get(), transform=g.transforms.at(-1);
  assert.equal(transform[0],1.3);
  assert.equal(transform[4],v.offsetX*1.3);
});

test('lightning ignores shield immunity and spends its target on a damageable enemy', () => {
  const g=loadGame(); g.start();
  g.combatScene('thunder',[{dx:200,type:'boss',shield:true,hp:9999},{dx:-200,hp:999}]);
  g.weapons(0.01);
  assert.equal(g.snapshot().enemies[0].hp,9999);
  assert.ok(g.snapshot().enemies[1].hp<999);
});

test('barrier and healing knockback cannot tunnel through a thin building', () => {
  for (const mode of ['barrier','heal']) {
    const g=loadGame(); g.start();
    g.combatScene(mode==='barrier'?'barrier':'katana',[{dx:70}], [{x0:90,x1:130,y0:-40,y1:40}]);
    const e=g.snapshot().enemies[0];
    if (mode==='barrier') g.weapons(0.01); else g.heal();
    assert.ok(e.x<=g.snapshot().x+74);
    assert.equal(g.enemyBlocked(e),false);
    assert.ok(e.hp<999);
  }
});

test('Boss chooses an unblocked offscreen spawn and retries without advancing when ring is obstructed', () => {
  const g=loadGame(); g.start(); g.env.Math=Object.create(Math); g.env.Math.random=()=>0;
  g.blockBossRing(true); g.scheduleBoss(); g.update(0.01);
  assert.ok(!g.snapshot().enemies.some(e=>e.type==='boss'));
  g.blockBossRing(false); g.update(0.01);
  const boss=g.snapshot().enemies.find(e=>e.type==='boss');
  assert.ok(boss); assert.equal(g.enemyBlocked(boss),false);
});

test('foxfire impact plays one sound for a simultaneous group of hits', () => {
  const g=loadGame(); g.start(); g.combatScene('fire',[{dx:96},{dx:96,dy:10}]);
  g.weapons(0.01);
  assert.equal(g.audioCalls.filter(n=>n==='fireball').length,1);
  g.weapons(0.01);
  assert.equal(g.audioCalls.filter(n=>n==='fireball').length,1);
});

test('portrait stops time, blocks all resume input paths, and landscape requires manual resume', () => {
  const g=loadGame(); g.start(); const before=g.snapshot();
  g.env.innerWidth=390; g.env.innerHeight=844; g.events.resize();
  assert.equal(g.snapshot().state,'pause');
  g.update(0.05); assert.equal(g.snapshot().oil,before.oil); assert.equal(g.snapshot().elapsed,before.elapsed);
  g.events.keydown(key('Escape','Escape'));
  g.canvasEvents.pointerdown(pointer(195,305,'touch'));
  const buttons=Array.from({length:16},()=>({pressed:false})); buttons[9].pressed=true;
  g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}]; g.pollGamepad();
  assert.equal(g.snapshot().state,'pause');
  g.env.innerWidth=844; g.env.innerHeight=390; g.events.resize();
  assert.equal(g.snapshot().state,'pause');
  g.events.keydown(key('Escape','Escape')); assert.equal(g.snapshot().state,'play');
});

test('visibility change suspends audio immediately without requiring a frame', () => {
  const g=loadGame(); g.start();
  g.env.document.hidden=true; g.documentEvents.visibilitychange();
  assert.equal(g.snapshot().state,'pause');
  assert.ok(g.audioCalls.includes('setSuspended'));
});

test('idle needles retain last facing and still aim at a nearby enemy',()=>{
 const g=loadGame();g.start();g.face(Math.PI);g.combatScene('needle',[]);g.weapons(.01);
 assert.ok(g.snapshot().needles.every(n=>n.vx<0));
 g.combatScene('needle',[{dx:200}]);g.weapons(.01);assert.ok(g.snapshot().needles.slice(-3).every(n=>n.vx>0));
});
test('keyboard menus reach settings, both codex tabs, mute and home; restart resets session',()=>{
 const g=loadGame();g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));assert.equal(g.env.document.getElementById('controls-open').clicked,true);
 g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));assert.equal(g.snapshot().state,'codex');assert.equal(g.snapshot().codexTab,'cards');
 g.events.keydown(key('Escape','Escape'));g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));assert.equal(g.snapshot().codexTab,'words');
 g.start();g.prepareOrder();g.events.keydown(key('Escape','Escape'));
 for(let i=0;i<3;i++)g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));assert.ok(g.audioCalls.includes('toggleMute'));
 for(let i=0;i<3;i++)g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));assert.equal(g.snapshot().state,'menu');
 g.start();assert.equal(g.snapshot().job,null);assert.equal(g.snapshot().elapsed,0);assert.equal(g.snapshot().oil,100);assert.equal(g.snapshot().enemies.length,0);
});
test('gamepad directional menus confirm once without leaking actions into the new screen',()=>{
 const g=loadGame();g.start();g.events.keydown(key('Escape','Escape'));
 const buttons=Array.from({length:16},()=>({pressed:false}));g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}];
 const press=i=>{buttons[i].pressed=true;g.pollGamepad();buttons[i].pressed=false;g.pollGamepad();};
 press(13);press(0);assert.equal(g.snapshot().state,'codex');assert.equal(g.snapshot().codexTab,'cards');press(1);assert.equal(g.snapshot().state,'pause');
 g.setState('won');press(15);press(0);assert.equal(g.snapshot().state,'overworld');
});

test('controls dialog gamepad events do not activate the covered menu',()=>{
 const g=loadGame();g.env.CONTROLS.isOpen=()=>true;let routed=0;g.env.CONTROLS.gamepad=()=>routed++;
 const buttons=Array.from({length:16},()=>({pressed:false}));buttons[0].pressed=true;
 g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}];g.pollGamepad();assert.equal(routed,1);assert.equal(g.snapshot().state,'menu');
});
test('widescreen map back button accepts pointer at the screen edge and home clears held movement',()=>{
 const g=loadGame();g.env.innerWidth=1800;g.env.innerHeight=600;
 g.events.keydown(key('Enter','Enter'));assert.equal(g.snapshot().state,'overworld');
 g.canvasEvents.pointerdown(pointer(30,30));assert.equal(g.snapshot().state,'menu');
 g.start();g.events.keydown(key('KeyD','d'));g.events.keydown(key('Escape','Escape'));
 for(let i=0;i<g.env.UI.PAUSE_BTNS.findIndex(b=>b.id==='menu');i++)g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));
 assert.equal(g.snapshot().state,'menu');assert.equal(g.snapshot().keys.length,0);
 g.start();assert.equal(g.snapshot().joy,null);
});
