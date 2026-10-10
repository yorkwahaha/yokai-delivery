const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('injury floating words have bright fill and solid ink outline in the active game draw path',()=>{
  const src=fs.readFileSync('js/game.js','utf8');
  const from=src.indexOf('// 14. 飄字'),to=src.indexOf('// 15. 浮動傷害數字',from);
  const block=src.slice(from,to);
  assert.ok(from>=0&&to>from);
  assert.match(block,/受創\|妖火灼身/);
  assert.match(block,/strokeText\(t\.v, t\.x, t\.y\)/);
  assert.match(block,/#211719/);
  assert.match(block,/#fff4d3/);
  assert.match(block,/lineWidth = 2\.6/);
  assert.match(block,/clamp\(t.life \* 1\.15/);
  assert.match(block,/ctx.font = UI.readableFont\(17, "bold"\)/);
  assert.doesNotMatch(block,/lineWidth = 6/);
  const injury = src.slice(src.indexOf('const say ='), src.indexOf('const burst ='));
  assert.match(injury,/t.life = Math.min\(t.life, 0\.12\)/);
  assert.match(injury,/t.y -= 22/);
});

test('entering a stage does not bulk-download words and unused sound effects',()=>{
  const g=loadGame();g.start();assert.ok(!g.audioCalls.includes('preloadWords'));
});

test('upgrade options warm only offered ranks and selected art pauses the game clock until ready',()=>{
  const g=loadGame(),prepared=[],selected=[];g.start();
  g.env.prepareSkillArt=(id,rank)=>prepared.push([id,rank]);
  g.env.useSkillArt=(id,rank)=>{selected.push([id,rank]);g.env.ART_READY=false;};
  g.offerUp();const choices=g.weaponChoices();assert.ok(choices.length);
  assert.deepEqual(prepared,Array.from(choices,c=>[c.id,c.lv]));
  const choice=choices[0];choice.f();assert.deepEqual(selected,[[choice.id,choice.lv]]);
  g.setState('play');const before=g.snapshot();g.update(1);
  assert.equal(g.snapshot().elapsed,before.elapsed);assert.equal(g.snapshot().oil,before.oil);
});

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
  for (const name of ['words', 'world', 'store', 'config', 'viewport', 'controls', 'overworld', 'fx', 'skillfx', 'evolutions']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  c.CONTROLS.mount = () => {};
  const audioCalls = [];
  c.AUDIO = new Proxy({}, { get: (o, name) => () => audioCalls.push(name) });
  c.RENDERER = new Proxy({ drawHouse: h => actorCalls.push(`house:${h.id}`), drawPlayer: () => actorCalls.push('player'), drawMonster: e => actorCalls.push(`enemy:${e.id}`), getCtx: () => ctx, getDpr: () => c.devicePixelRatio || 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({x:0,y:0}), updateEffects: () => false }, { get: (o, k) => o[k] || (() => {}) });
  vm.runInContext(fs.readFileSync('js/ui.js','utf8'),c);
  const uiButtons=Object.fromEntries(Object.entries(c.UI).filter(([,v])=>typeof v!=='function'));
  c.UI = new Proxy({ ...uiButtons, codexButtons:c.UI.codexButtons, codexRows:c.UI.codexRows, pauseButtons:c.UI.pauseButtons, bossQuizLayout:c.UI.bossQuizLayout, HINT_BTN: { x: 532, y: 20, w: 78, h: 40 }, readableFont: () => '20px sans-serif' }, { get: (o, k) => o[k] || (() => {}) });
  const source = fs.readFileSync('js/game.js', 'utf8');
  const end = source.lastIndexOf('})();');
  const hook = `window.fixture = { start, update, frame, drawWorld, drawStageWeather, makeOrder, hurt, pollGamepad, offerUp, triggerHint, resolve, spawnEnemy, weapons, answerChoices,
    notice: (message,x=900,y=550) => say(message,x,y),
    upgradeOil: () => UP.find(u=>u.id==='oil_max').f(),
    weaponChoices: () => choices.filter(c=>c.type==='weapon'),
    addRing: () => rings.push({x:P.x,y:P.y,r:40,life:0.08,maxL:0.32,color:'#ffffff'}),
    addBullet: () => enemyBullets.push({x:P.x+180,y:P.y,vx:0,vy:0,life:2}),
    wallBullet: () => { syncWorld(); solids.push({x0:P.x+150,x1:P.x+210,y0:P.y-40,y1:P.y+40}); enemyBullets.push({x:P.x+180,y:P.y,vx:0,vy:0,life:2}); },
    trapMis: () => { syncWorld(); Object.keys(WL).forEach(k=>WL[k]=0); spawnT=Infinity; const e=enemies.find(e=>e.type==='mis'); solids.splice(0,solids.length,{x0:e.x-40,x1:e.x+40,y0:e.y-40,y1:e.y+40}); },
    buttonGeometry: () => ({pause:{...btnPause},hint:{...UI.HINT_BTN}}),
    blockWrongSpawn: () => { const p=ansPos(job.to)[(job.ans.indexOf(job.word)+1)%3]; solids.splice(0,solids.length,{x0:p.x-230,x1:p.x+230,y0:p.y-230,y1:p.y+230}); },
    tutorialState: () => tutorial,
    reviewWords: () => misses,
    answerBoss,
    maxOutUpgrades: () => {
      Object.keys(WL).forEach(k=>WL[k]=['katana','barrier','needle','fire'].includes(k)?5:0);
      for(const u of UP)while(!u.ok || u.ok())u.f();
    },
    setXp: value => { xp=value; },
    currentXp: () => xp,
    currentChoices: () => choices,
    restrictWords: words => { replaceList(ALL, words); },
    pendingPickup: () => inter,
    summary: () => runSummary,
    setOil: value => { oil=value; },
    setElapsed: value => {elapsed=value;},
    stepKnock: (e,dt) => moveKnockback(e,dt),
    scheduleSurge: () => {surgeT=0;},
    stageTuning: () => ({goal:GOAL_DELIVERIES,xp:xpNeed(),spawnInterval:CFG.spawnInterval(elapsed)*SPAWN_INTERVAL_SCALE}),
    unlockBoss: () => { bossQ.lock=0; },
    matchBossToJob: () => { const bs=enemies.find(e=>e.type==='boss'); bs.word=job.word;bossQ=mkQ(bs);bossQ.lock=0; },
    moveBoss: distance => { const bs=enemies.find(e=>e.type==='boss'); Object.assign(bs,{x:P.x+distance,y:P.y,speed:0,wob:0,flash:0}); },
    clearOrders: () => { orders=[];job=null; },
    replayTutorial: () => activateMenu('tutorial'),
    flushMenuPress: () => { if(pendingMenuActivation){pendingMenuActivation.remaining=0;runFrame(last+16);} },
    pendingMenuPress: () => pendingMenuActivation && {...pendingMenuActivation},
    atDestination: () => { P.x=job.to.x; P.y=job.to.y+110; },
    atAnswer: () => { const p=ansPos(job.to)[job.ans.indexOf(job.word)];P.x=p.x;P.y=p.y; },
    dashLesson: () => { elapsed=12; },
    face: angle => { P.faceAng=angle; },
    setWeaponRank: (id,rank) => { WL[id]=rank;wT[id]=Infinity; },
    combatScene: (weapon, foes, walls=[], level=1) => { Object.keys(WL).forEach(k=>WL[k]=0); WL[weapon]=level; wT[weapon]=0; enemies=foes.map(e=>({x:P.x+e.dx,y:P.y+(e.dy||0),hp:999,max:999,type:'ghost',...e})); solids.splice(0,solids.length,...walls.map(s=>({x0:P.x+s.x0,x1:P.x+s.x1,y0:P.y+s.y0,y1:P.y+s.y1}))); },
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
    snapshot: () => ({ state, quitConfirm, needles, proj, winds:typeof winds==='undefined'?[]:winds, ghosts:typeof ghosts==='undefined'?[]:ghosts, dragonShots, dragonScorches, menuFocus, levelupFocus, rerolls, levelupCooldown, x:P.x, y:P.y, joy, dashCd, oil, score, level, elapsed, delivered, bossStage, bossT, finalBossDefeated, gems, cargo, job, orders, bossQ, codexTab, codexPage, floats:texts, enemies, enemyBullets, keys: [...keys] }),
    addMis: () => enemies.push({x:P.x+100,y:P.y,type:"mis",w:ALL[0],hp:999,max:999,speed:210,flash:0,wob:0}), emptyHouses: () => houses.splice(0),
    tune: id => UP.find(u => u.id === id),
    thinDashWall: () => { syncWorld(); solids.splice(0,solids.length,{x0:P.x+19,x1:P.x+20,y0:P.y-100,y1:P.y+100}); dashDir={x:1,y:0};dashT=0.2; },
    housesNow: () => houses.map(h => ({ id: h.id, x: h.x, y: h.y, word: h.word })),
    placeAt: (x, y) => { P.x = x; P.y = y; },
    ageOrders: seconds => { for (const o of orders) o.life -= seconds; },
    failCount: () => failed,
    codexCount: () => codexWords().length };`;
  vm.runInContext(source.slice(0, end) + hook + source.slice(end), c);
  return { ...c.fixture, events, canvasEvents, documentEvents, env: c, ctx, audioCalls, drawnText, actorCalls, transforms };
}
const pointer = (x, y, type = 'mouse') => ({ clientX: x, clientY: y, pointerId: 1, pointerType: type, button: 0, preventDefault() {} });
const key = (code, value = '') => ({ code, key: value, preventDefault() {} });

test('pending essential art freezes the run and menu music is requested before its delayed action',()=>{
  const g=loadGame();g.start();g.env.ART_READY=false;const before=g.snapshot();g.update(0.05);
  assert.equal(g.snapshot().elapsed,before.elapsed);assert.equal(g.snapshot().oil,before.oil);
  const menu=loadGame();menu.events.keydown(key('Enter','Enter'));
  assert.ok(menu.audioCalls.includes('prepareMusic'));assert.equal(menu.snapshot().state,'menu');
});

test('unknown word length falls back to real distinct answers without crashing', () => {
  const g=loadGame();g.start();
  const word={jp:'とてもながいみちのことばです',zh:'測試詞'};
  const choices=g.answerChoices(word);
  assert.equal(choices.length,3);
  assert.equal(new Set(choices.map(w=>w.jp)).size,3);
  assert.ok(choices.includes(word));
});

test('first hint rejects a duplicate press then allows the second stage after cooldown', () => {
  const g=loadGame();g.start();g.prepareOrder();g.setOil(80);
  g.triggerHint();g.triggerHint();
  assert.equal(g.snapshot().oil,77);
  assert.equal(g.snapshot().job.hintStage,1);
  g.update(0.6);g.triggerHint();
  assert.equal(g.snapshot().job.hintStage,2);
});

test('delivery sanctuary triggers only once even when leaving and reentering its radius',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.atDestination();g.update(0.01);
  const job=g.snapshot().job,to=job.to;
  assert.equal(job.sanctuaryTriggered,true);
  g.placeAt(to.x+500,to.y);g.update(0.1);g.atDestination();g.update(0.01);
  assert.equal(g.audioCalls.filter(n=>n==='sanctuary').length,1);
  assert.ok(job.sanctuaryT<2.7);
});

test('dash cannot cross a thin wall in a 50ms frame', () => {
  const g=loadGame();g.start();g.thinDashWall();const x=g.snapshot().x;
  g.update(0.05);
  assert.ok(g.snapshot().x-x<2);
});

test('dawn retains all overdue Boss waves and only the fourth kill completes the final goal', () => {
  const g=loadGame();g.start();g.clearSolids();g.scheduleBoss();g.update(0.01);
  g.setElapsed(601);g.meetDeliveryGoal();g.setOil(100);g.update(0.01);
  for(let stage=0;stage<4;stage++) {
    const boss=g.snapshot().enemies.find(e=>e.type==='boss'&&e.hp>0);
    assert.ok(boss);assert.equal(boss.final,stage===3);
    boss.shield=false;g.hurt(boss,9999);g.update(0.01);
    assert.equal(g.snapshot().finalBossDefeated,stage===3);
    assert.equal(g.snapshot().state,stage===3?'victory':'play');
  }
});

test('crit upgrade applies to thunder ranks 1 through 4 and awakened katana wind hits', () => {
  for(const rank of [1,2,3,4]) {
    const g=loadGame();g.start();g.env.Math=Object.create(Math);g.env.Math.random=()=>0.5;
    const crits=[];g.env.RENDERER.spawnDamageNumber=(d,x,y,crit)=>crits.push(crit);
    for(let i=0;i<3;i++)g.tune('crit').f();
    g.combatScene('thunder',[{dx:100}],[],rank);g.weapons(0.01);
    assert.ok(crits.length>0);assert.ok(crits.every(Boolean),`rank ${rank}`);
  }
  const g=loadGame();g.start();g.env.Math=Object.create(Math);g.env.Math.random=()=>0.5;
  const crits=[];g.env.RENDERER.spawnDamageNumber=(d,x,y,crit)=>crits.push(crit);
  for(let i=0;i<3;i++)g.tune('crit').f();
  g.face(0);g.combatScene('katana',[{dx:400}],[],5);
  for(let i=0;i<10;i++)g.weapons(0.05);
  assert.ok(crits.length>0);assert.ok(crits.every(Boolean));
});

test('Xbox pad navigates level-up cards with stick or D-pad, A confirms focus, and B/X cannot misselect',()=>{
  const g=loadGame();g.start();g.offerUp();assert.equal(g.snapshot().state,'levelup');
  for(let n=1;n<=10;n++)g.frame(n*50);
  const buttons=Array.from({length:16},()=>({pressed:false})),axes=[0,0];
  g.env.navigator.getGamepads=()=>[{connected:true,axes,buttons}];
  const press=n=>{buttons[n].pressed=true;g.pollGamepad();buttons[n].pressed=false;g.pollGamepad();};
  axes[1]=0.9;g.pollGamepad();assert.equal(g.snapshot().levelupFocus,1);
  g.pollGamepad();assert.equal(g.snapshot().levelupFocus,1,'held stick does not repeat');
  axes[1]=0;g.pollGamepad();
  press(13);assert.equal(g.snapshot().levelupFocus,2,'D-pad down advances');
  press(13);assert.equal(g.snapshot().levelupFocus,2,'focus is clamped');
  press(1);press(2);assert.equal(g.snapshot().state,'levelup','B and X do not select arbitrary cards');
  press(12);assert.equal(g.snapshot().levelupFocus,1,'D-pad up moves back');
  press(0);assert.equal(g.snapshot().state,'play','A confirms focused card');
  assert.equal(g.snapshot().level,2);
});

test('Xbox Y rerolls once, and keyboard Enter confirms highlighted level-up without changing touch geometry',()=>{
  const g=loadGame();g.start();g.offerUp();
  for(let n=1;n<=10;n++)g.frame(n*50);
  const buttons=Array.from({length:16},()=>({pressed:false}));
  g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}];
  buttons[3].pressed=true;g.pollGamepad();g.pollGamepad();
  assert.equal(g.snapshot().rerolls,1,'holding Y cannot reroll twice');
  buttons[3].pressed=false;g.pollGamepad();
  assert.equal(g.snapshot().levelupFocus,0);
  for(let n=11;n<=21;n++)g.frame(n*50);
  g.events.keydown(key('ArrowDown'));assert.equal(g.snapshot().levelupFocus,1);
  g.events.keydown(key('Enter','Enter'));assert.equal(g.snapshot().state,'play');
  const t=loadGame();t.start();t.offerUp();
  for(let n=1;n<=10;n++)t.frame(n*50);
  const v=t.env.VIEWPORT.get(),cx=90+720/2,cy=176+122+54;
  t.canvasEvents.pointerdown(pointer((cx+v.offsetX)*v.scale,(cy+v.offsetY)*v.scale,'touch'));
  assert.equal(t.snapshot().state,'play','touch still selects second card via original hitbox');
});

test('menu action waits for its pressed frame and blocks duplicated confirmation',()=>{
  const g=loadGame();g.events.keydown(key('Enter','Enter'));
  assert.equal(g.snapshot().state,'menu');
  assert.equal(g.pendingMenuPress().id,'start');
  g.events.keydown(key('Enter','Enter'));
  assert.equal(g.pendingMenuPress().id,'start');
  g.flushMenuPress();
  assert.equal(g.snapshot().state,'overworld');
  assert.equal(g.pendingMenuPress(),null);
});
test('mouse hovering over a painted plaque focuses it without moving the hit target',()=>{
  const g=loadGame();g.start();g.setState('pause');
  const b=g.env.UI.pauseButtons()[2],v=g.env.VIEWPORT.get();
  const pt=pointer((b.x+b.w/2+v.offsetX)*v.scale,(b.y+b.h/2+v.offsetY)*v.scale);
  g.canvasEvents.pointermove(pt);assert.equal(g.snapshot().menuFocus,2);
  g.canvasEvents.pointerdown(pt);assert.equal(g.snapshot().state,'pause');
  assert.equal(g.pendingMenuPress().id,'codex');
  g.flushMenuPress();assert.equal(g.snapshot().state,'codex');
});
test('consecutive injury notices separate and rapidly fade their predecessors',()=>{
  const g=loadGame();
  g.notice('受創・燈油 −10',900,550);
  const old=g.snapshot().floats.at(-1);
  assert.equal(old.life,1.12);
  g.notice('受創・燈油 −10',900,550);
  const notices=g.snapshot().floats.slice(-2);
  assert.equal(notices.length,2);
  assert.ok(old.life<=0.12);
  assert.equal(old.y,528);
  assert.equal(notices[1].life,1.12);
  g.notice('新的學習提示',900,550);
  assert.equal(g.snapshot().floats.at(-1).life,1.8,'other notifications stay unchanged');
});

test('resizing the skill codex clamps mobile pages back to a visible desktop page',()=>{
  const g=loadGame();g.env.innerWidth=568;g.env.innerHeight=320;g.setState('codex');
  for(let i=0;i<4;i++)g.events.keydown(key('ArrowRight','ArrowRight'));
  assert.equal(g.snapshot().codexPage,4);
  g.env.innerWidth=900;g.env.innerHeight=600;g.frame(16);assert.equal(g.snapshot().codexPage,0);
});

test('misdelivery costs oil immediately, grants no farming score and hints recover their oil cost',()=>{
  const g=loadGame();g.start();g.setOil(50);g.prepareOrder();
  g.resolve(g.snapshot().job.ans.findIndex(w=>w!==g.snapshot().job.word));
  assert.equal(g.snapshot().oil,42);
  g.hurt(g.snapshot().enemies.find(e=>e.type==='mis'),999);assert.equal(g.snapshot().score,0);
  g.prepareOrder();const oil=g.snapshot().oil;g.triggerHint();g.update(0.6);g.triggerHint();
  g.resolve(g.snapshot().job.ans.indexOf(g.snapshot().job.word));assert.ok(Math.abs(g.snapshot().oil-(oil+5-0.6*0.43))<1e-8);
});

test('all quiz choices hide answer length and mix hiragana with katakana when possible',()=>{
  const g=loadGame();g.start();
  const charLen=s=>Array.from(s.normalize('NFC')).length;
  const script=s=>Array.from(s).every(ch=>/[ぁ-ゖー]/u.test(ch))?'hiragana':Array.from(s).every(ch=>/[ァ-ヺー]/u.test(ch))?'katakana':'mixed';
  for(const word of g.env.CONTENT.getAllWords()){
    const ans=g.answerChoices(word);
    assert.equal(ans.length,3,word.jp);
    assert.equal(new Set(ans.map(w=>w.jp)).size,3,word.jp);
    assert.ok(ans.every(w=>charLen(w.jp)===charLen(word.jp)),word.jp);
    const target=script(word.jp);
    if(target==='hiragana'||target==='katakana'){
      assert.ok(ans.some(w=>w!==word&&script(w.jp)===target),`${word.jp}: same script`);
      assert.ok(ans.some(w=>w!==word&&script(w.jp)!==target&&script(w.jp)!=='mixed'),`${word.jp}: mixed scripts`);
    }
  }

  const ramen=g.env.CONTENT.getAllWords().find(w=>w.jp==='ラーメン');
  const ramenAns=g.answerChoices(ramen);
  assert.ok(ramenAns.some(w=>w!==ramen&&['クーラー','アパート','スーパー','コーヒー'].includes(w.jp)));
  g.prepareBoss(ramen);
  assert.ok(g.snapshot().bossQ.ans.every(w=>charLen(w.jp)===charLen(ramen.jp)));
});
test('Boss wrong slots keep their position and cannot be selected again or by key repeat',()=>{
  const g=loadGame();g.start();g.prepareBoss();const q=g.snapshot().bossQ;
  q.ans=[...q.ans.filter(w=>w!==q.word),q.word];
  const original=[...q.ans];g.answerBoss(0);g.unlockBoss();
  assert.deepEqual([...q.ans],original);assert.ok(q.wrong.includes(0));
  const oil=g.snapshot().oil;g.answerBoss(0);assert.equal(g.snapshot().oil,oil);
  g.events.keydown({...key('Digit3','3'),repeat:true});
  assert.ok(g.snapshot().enemies.find(e=>e.type==='boss').shield);
  g.answerBoss(2);assert.ok(g.snapshot().floats.some(t=>t.v.includes(q.word.jp)));
});

test('Lv1–3 thunder strikes exactly its target count without nearby splash damage',()=>{
  for(const rank of [1,2,3]){
    const g=loadGame();g.start();
    g.combatScene('thunder',Array.from({length:5},(_,i)=>({dx:100+i*3,hp:999})),[],rank);
    g.weapons(0.01);
    assert.equal(g.snapshot().enemies.filter(e=>e.hp<999).length,rank);
  }
});


test('barrier Lv1–4 deals only 40 percent of same-rank katana damage; Lv5 deals half its former base damage',()=>{
  for(let rank=1;rank<=5;rank++){
    const g=loadGame();g.start();
    g.env.Math=Object.create(Math);g.env.Math.random=()=>1;
    g.combatScene('barrier',[{dx:100,speed:0}],[],rank);
    g.weapons(0.01);
    const e=g.snapshot().enemies[0],actual=999-e.hp;
    const expected=rank===5 ? (2+5*1.1)*1.2*0.5 : (1.2+(rank-1)*0.8)*0.4;
    assert.ok(Math.abs(actual-expected)<1e-8,`Lv${rank}: ${actual} vs ${expected}`);
    assert.equal((e.knockQueue||[]).length,rank<4?0:rank===4?1:2,
      'only Lv4+ can knock back, and Lv5 keeps its two-phase pull/push');
  }
});

test('barrier knockback is visible across frames instead of teleporting, including Lv5 pull then push',()=>{
  for(const rank of [4,5]){
    const g=loadGame();g.start();g.combatScene('barrier',[{dx:100,speed:0}],[],rank);
    const e=g.snapshot().enemies[0],origin=e.x;
    g.weapons(0.01);
    assert.equal(e.x,origin,'cast must not instantly change coordinates');
    g.update(0.016);
    assert.ok(Math.abs(e.x-origin)>0 && Math.abs(e.x-origin)<20,'first frame is a small displacement');
    assert.equal(Math.sign(e.x-origin),rank===5?-1:1,'Lv5 gathers before releasing');
    for(let i=0;i<28;i++)g.update(0.016);
    assert.ok(e.x>origin+45,'after animation the target is pushed away');
    assert.equal((e.knockQueue||[]).length,0);
  }
});

test('barrier push stops at a blocking wall without tunneling and never knocks back a boss',()=>{
  const g=loadGame();g.start();
  g.combatScene('barrier',[{dx:100,speed:0}], [{x0:128,x1:144,y0:-70,y1:70}],4);
  const e=g.snapshot().enemies[0],initial=e.x;
  g.weapons(0.01);
  for(let i=0;i<30;i++)g.stepKnock(e,0.016);
  assert.ok(e.x>=initial && e.x<initial+13,'wall blocks knockback movement');
  g.combatScene('barrier',[{dx:100,speed:0,type:'boss',shield:false}],[],5);
  const boss=g.snapshot().enemies[0],bossX=boss.x;
  g.weapons(0.01);
  assert.equal((boss.knockQueue||[]).length,0);
  for(let i=0;i<24;i++)g.update(0.016);
  assert.equal(boss.x,bossX);
});

test('night-town misdelivery can approach contact range without ranged shots',()=>{
  const g=loadGame();g.start();g.clearSolids();g.combatScene('katana',[{dx:86,type:'mis',w:g.env.CONTENT.getStageWords('night-town')[0],speed:200}],[],0);
  const oil=g.snapshot().oil;for(let i=0;i<32;i++)g.update(0.05);
  assert.ok(g.snapshot().oil<oil-1);assert.equal(g.snapshot().enemyBullets.length,0);
});

test('enemy attack drawings are triggered by actual contact or projectile release and expire with gameplay time',()=>{
  const g=loadGame();g.start('rain-port');g.combatScene('katana',[{dx:100,type:'shooter',speed:0,shootCd:0.005}],[],0);
  g.update(0.01);const shooter=g.snapshot().enemies[0];assert.ok(shooter.attackT>0);assert.ok(g.snapshot().enemyBullets.length>0);
  g.update(0.3);assert.equal(shooter.attackT,0);
  g.combatScene('katana',[{dx:10,type:'tank',speed:0}],[],0);g.update(1.3);assert.ok(g.snapshot().enemies[0].attackT>0);
});

test('exhausted upgrades consume one level without trapping the run or granting invented rewards',()=>{
  const g=loadGame();g.start();g.maxOutUpgrades();g.setXp(10000);
  const before=g.snapshot(),req=g.stageTuning().xp;
  g.offerUp();assert.equal(g.snapshot().state,'play');assert.equal(g.currentChoices().length,0);
  assert.equal(g.snapshot().level,before.level+1);assert.equal(g.currentXp(),10000-req);
  assert.equal(g.snapshot().oil,before.oil);assert.equal(g.snapshot().score,before.score);
  g.update(0.01);assert.equal(g.snapshot().state,'play');assert.equal(g.snapshot().level,before.level+2);
});

test('uncollected gems stay bounded under repeated kills and merging preserves all nearby XP',()=>{
  const g=loadGame();g.start();const p=g.snapshot();
  for(let i=0;i<1200;i++)g.hurt({type:'ghost',hp:1,x:p.x+1000+(i%200),y:p.y},10);
  const gems=g.snapshot().gems;assert.ok(gems.length<=512);assert.equal(gems.reduce((sum,q)=>sum+q.v,0),2400);
  g.update(0.01);assert.equal(g.snapshot().gems.reduce((sum,q)=>sum+q.v,0),2400);
  g.hurt({type:'boss',hp:1,x:p.x+1000,y:p.y,shield:false},10);
  assert.ok(g.snapshot().gems.length<=512);assert.equal(g.snapshot().gems.reduce((sum,q)=>sum+q.v,0),2450);
});

test('leaving distant drops reclaims them while nearby and boundary drops remain collectible',()=>{
  const g=loadGame();g.start();const p=g.snapshot();
  for(const d of [500,2390,2500])g.hurt({type:'ghost',hp:1,x:p.x+d,y:p.y},10);
  // Generated drops have a small random offset; place them exactly at the intended boundaries.
  g.snapshot().gems.forEach((q,i)=>{q.x=p.x+[500,2400,2500][i];q.y=p.y;});
  g.update(0.01);assert.equal(g.snapshot().gems.length,2);assert.equal(g.currentXp(),0);
  g.placeAt(p.x+500,p.y);g.update(0.01);assert.equal(g.currentXp(),2);
});

test('a full gem pool cannot merge a new local reward into an abandoned drop due for reclamation',()=>{
  const g=loadGame();g.start();const p=g.snapshot();
  for(let i=0;i<600;i++)g.hurt({type:'ghost',hp:1,x:p.x+1000,y:p.y},10);
  g.placeAt(p.x+10000,p.y);g.hurt({type:'ghost',hp:1,x:p.x+10000,y:p.y},10);
  g.update(0.01);assert.equal(g.currentXp(),2);assert.equal(g.snapshot().gems.length,0);
});

test('tutorials freeze oil regeneration, time and Boss schedule even after long-lantern upgrades',()=>{
  for(const replay of [false,true]) {
    const g=loadGame(!replay);g.start();g.upgradeOil();g.upgradeOil();g.setOil(50);
    if(replay)g.replayTutorial();assert.ok(g.tutorialState());const before=g.snapshot();
    for(let i=0;i<120;i++)g.update(0.05);
    const after=g.snapshot();assert.equal(after.oil,50);assert.equal(after.elapsed,before.elapsed);assert.equal(after.bossT,before.bossT);
  }
});

test('Boss replacement lock ignores early keyboard or gamepad input but accepts a fresh press after expiry',()=>{
  for (const input of ['keyboard','gamepad']) {
    const g=loadGame();g.start();g.prepareBoss();g.moveBoss(200);
    const bs=g.snapshot().enemies.find(e=>e.type==='boss'),old=bs.word.jp;
    for (const w of g.env.CONTENT.getStageWords('night-town'))g.snapshot().enemies.push({type:'mis',w,hp:999,x:g.snapshot().x+1600,y:g.snapshot().y,speed:0,flash:0,wob:0});
    g.answerBoss(g.snapshot().bossQ.ans.findIndex((w,i)=>w!==bs.word&&!g.snapshot().bossQ.wrong.includes(i)));g.unlockBoss();
    g.answerBoss(g.snapshot().bossQ.ans.findIndex((w,i)=>w!==bs.word&&!g.snapshot().bossQ.wrong.includes(i)));
    assert.notEqual(bs.word.jp,old);assert.equal(g.snapshot().bossQ.lock,1);assert.equal(bs.wasAssisted,true);
    const gp={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
    g.env.navigator.getGamepads=()=>[gp];
    const press=()=>{
      const i=g.snapshot().bossQ.ans.indexOf(bs.word);
      if(input==='keyboard'){g.events.keydown(key(`Digit${i+1}`,`${i+1}`));g.events.keyup(key(`Digit${i+1}`,`${i+1}`));}
      else {const button=[4,5,3][i];gp.buttons[button].pressed=true;g.pollGamepad();gp.buttons[button].pressed=false;g.pollGamepad();}
    };
    press();assert.equal(bs.shield,true);
    for(let i=0;i<21;i++)g.update(0.05);
    assert.ok(g.snapshot().bossQ.lock===0);press();assert.equal(bs.shield,false);assert.equal(g.snapshot().bossQ,null);
  }
});

test('small cargo pools still receive three defined, unique quiz choices',()=>{
  for(const size of [1,2,3]) {
    const g=loadGame();g.start();const word={jp:'試験',zh:'測試',packId:'absent'};
    const words=[word,...Array.from({length:size-1},(_,i)=>({jp:`別${i}`,zh:`其他${i}`,packId:'absent'}))];
    g.restrictWords(words);g.pickupWord(word);g.prepareBoss(word);
    for(const ans of [g.snapshot().job.ans,g.snapshot().bossQ.ans]) {
      assert.ok(ans.every(Boolean));assert.equal(ans.length,3);
      assert.equal(new Set(ans.map(w=>w.jp)).size,3);assert.equal(ans.filter(w=>w===word).length,1);
    }
    assert.doesNotThrow(()=>g.drawWorld());
    g.unlockBoss();g.answerBoss(g.snapshot().bossQ.ans.indexOf(word));
    g.resolve(g.snapshot().job.ans.indexOf(word));assert.equal(g.snapshot().delivered,1);
  }
});

test('starting again cannot pick up the previous run pending order before its first update',()=>{
  const g=loadGame();g.start();g.preparePickup();assert.ok(g.pendingPickup());
  g.start();assert.equal(g.pendingPickup(),null);
  g.events.keydown(key('KeyE','e'));assert.equal(g.snapshot().job,null);
});

test('frame recovery removes a tutorial overlay from the aborted run',()=>{
  const g=loadGame(true);g.start();assert.ok(g.tutorialState());
  g.env.console={error(){}};g.env.RENDERER.drawGround=()=>{throw new Error('draw failed');};
  g.frame(16);g.events.keydown(key('Enter','Enter'));
  assert.equal(g.snapshot().state,'menu');assert.equal(g.tutorialState(),null);
});

test('settlement learning summary measures this run only and keeps assisted answers separate from star gains',()=>{
  const g=loadGame(),s=g.env.STORE;
  s.rec('ねこ',true);s.rec('ねこ',true);g.start();
  s.rec('ねこ',false);s.rec('いぬ',true);s.recAssisted('うさぎ');
  g.setState('lost');g.frame(16);
  const l=g.summary().learning;assert.equal(l.practiced,3);assert.equal(l.gained,1);assert.equal(l.lost,1);assert.equal(l.review,1);
  s.rec('いぬ',true);assert.equal(g.summary().learning.gained,1,'settlement is a snapshot');
  g.start();g.setState('lost');g.frame(32);assert.deepEqual({...g.summary().learning},{practiced:0,gained:0,lost:0,review:0});
});

test('Lv5 katana pierces buildings while only targeting the forward-facing arc',()=>{
  for(const walls of [[],[{x0:140,x1:160,y0:-100,y1:100}]]){
    const g=loadGame();g.start();g.face(0);g.combatScene('katana',[{dx:360},{dx:-150}],walls,5);
    for(let i=0;i<31;i++)g.weapons(0.01);assert.ok(g.snapshot().winds.length>0);
    for(let i=0;i<80;i++)g.weapons(0.01);
    assert.equal(g.snapshot().enemies[1].hp,999);
    assert.equal(g.snapshot().enemies[0].hp<999,true,'MAX wave is explicitly allowed through buildings');
  }
});

test('Lv5 katana uses only the flying blade visual while lower ranks keep the local slash',()=>{
  for(const level of [4,5]){
    const g=loadGame();g.start();g.face(0);g.combatScene('katana',[{dx:150}],[],level);
    let localSlash=0;const plays=[];
    g.env.RENDERER.addSlashArc=()=>localSlash++;
    g.env.SKILLFX.play=(...args)=>plays.push(args);
    for(let i=0;i<40;i++)g.weapons(0.01);
    assert.equal(localSlash,level===5?0:1);
    assert.equal(plays.some(c=>c[0]==='katana'&&c[1]==='swing'),level<5);
    assert.equal(g.snapshot().winds.length>0,level===5);
  }
});

test('Lv5 wind blade stays alive across the screen and keeps piercing with distance and hit-count decay',()=>{
  const g=loadGame();g.start();g.env.Math=Object.create(Math);g.env.Math.random=()=>0.99;
  g.face(0);g.combatScene('katana',[{dx:280},{dx:360},{dx:440},{dx:520}],[],5);
  for(let i=0;i<45;i++)g.weapons(0.01);
  assert.ok(g.snapshot().winds.length>0,'blade should not retract after only a few hits');
  for(let i=0;i<55;i++)g.weapons(0.01);
  const damage=g.snapshot().enemies.map(e=>999-e.hp);
  assert.ok(damage.every(v=>v>0),damage);
  assert.ok(damage[0]>damage[1]&&damage[1]>damage[2]&&damage[2]>damage[3],damage);
});

test('MAX ice needles hit and freeze distinct foes in eight directions',()=>{
  const g=loadGame();g.start();
  const foes=Array.from({length:8},(_,i)=>({dx:Math.cos(i*Math.PI/4)*220,dy:Math.sin(i*Math.PI/4)*220,speed:0}));
  g.combatScene('needle',foes,[],5);g.weapons(0.01);
  assert.equal(new Set(g.snapshot().needles.map(n=>n.target)).size,8);
  for(let i=0;i<38;i++)g.weapons(0.01);
  assert.ok(g.snapshot().enemies.every(e=>e.hp<999&&e.freezeT===0.5));
});

test('frozen shooter cannot move or fire until the ice expires',()=>{
  const g=loadGame();g.start('rain-port');g.combatScene('katana',[{dx:180,type:'shooter',speed:100,shootCd:0.01}],[],0);
  const e=g.snapshot().enemies[0],x=e.x;e.freezeT=0.5;
  g.update(0.1);assert.equal(e.x,x);assert.equal(g.snapshot().enemyBullets.length,0);
  g.update(0.41);assert.notEqual(e.x,x);assert.equal(g.snapshot().enemyBullets.length,1);
});

test('Lv5 paper talismans actually explode over an area; Lv4 still only hits its flight path',()=>{
  for(const level of [4,5]){
    const g=loadGame();g.start();g.combatScene('boom',[{dx:180},{dx:180,dy:-130},{dx:180,dy:240}],[],level);
    for(let i=0;i<42;i++)g.weapons(0.01);
    const foes=g.snapshot().enemies;assert.ok(foes[0].hp<999);
    assert.equal(foes[1].hp<999,level===5);assert.equal(foes[2].hp,999);
    if(level===5){assert.equal(foes[0].hp,993);assert.equal(foes[1].hp,993);}
  }
});

test('Lv5 foxfire keeps six orbiting flames and summons a targeted brief dragon',()=>{
  const g=loadGame();g.start();g.env.Math=Object.create(Math);g.env.Math.random=()=>0.25;
  g.combatScene('fire',[{dx:330,dy:60}],[],5);g.weapons(0.01);
  const dragon=g.snapshot().ghosts[0];assert.ok(dragon?.dragon);assert.equal(dragon.launchAng,0);assert.ok(dragon.entry.startX<dragon.entry.endX);assert.ok(dragon.size>=300&&dragon.size<=680);
  const flames=[];g.env.SKILLFX.paint=(ctx,id,lv,p)=>{if(id==='fire')flames.push({lv,p});};
  g.drawWorld();assert.equal(flames.length,6);assert.ok(flames.every(f=>f.p.orbit===true));
});

test('MAX dragon approaches from offscreen, pauses inside, and fires once',()=>{
  const g=loadGame();g.start();g.env.Math=Object.create(Math);g.env.Math.random=()=>0;
  g.combatScene('fire',[{dx:360}],[],5);g.weapons(0.001);
  const dragon=g.snapshot().ghosts[0],start=dragon.x;
  for(let i=0;i<145;i++)g.weapons(0.01);
  assert.ok(dragon.x>start+150);assert.ok(Math.abs(dragon.x-dragon.entry.endX)<4);assert.equal(dragon.shot,true);assert.ok(dragon.age<3);
});

test('fireball impacts a building before reaching a distant target',()=>{
  const g=loadGame();g.start();g.env.Math=Object.create(Math);g.env.Math.random=()=>0;
  g.combatScene('fire',[{dx:330}], [{x0:140,x1:160,y0:-500,y1:500}],5);
  for(let i=0;i<200;i++)g.weapons(0.01);assert.equal(g.snapshot().enemies[0].hp,999);
});

test('Lv5 needles bend once after launch while Lv4 stays straight',()=>{
  for(const level of [4,5]){
    const g=loadGame();g.start();g.face(0);g.combatScene('needle',[{dx:420}],[],level);g.weapons(0.01);
    const nd=g.snapshot().needles[0],initial=Math.atan2(nd.vy,nd.vx);
    for(let i=0;i<12;i++)g.weapons(0.01);
    const turned=Math.abs(Math.atan2(nd.vy,nd.vx)-initial)>0.03;
    assert.equal(turned,level===5);
  }
});

test('awakening mid-flight does not turn old straight needles or returning talismans into a different attack',()=>{
  for(const skill of ['needle','boom']){
    const g=loadGame();g.start();g.combatScene(skill,[{dx:420}],[],4);g.weapons(0.01);
    const old=skill==='needle'?g.snapshot().needles[0]:g.snapshot().proj[0];assert.equal(old.level,4);
    g.setWeaponRank(skill,5);for(let i=0;i<(skill==='needle'?20:65);i++)g.weapons(0.01);
    assert.equal(old.level,4);if(skill==='needle')assert.equal(old.curve,false);else assert.equal(old.back,true);
  }
});

test('Lv5 thunder spawns paired random clouds and bolts, excludes distant foes and preserves the Boss shield',()=>{
  const g=loadGame();g.start();g.combatScene('thunder',Array.from({length:6},(_,i)=>({dx:120+i*30,dy:i%2*80})).concat([{dx:550},{dx:200,shield:true,type:'boss'}]),[],5);
  g.env.Math=Object.create(Math);g.env.Math.random=()=>0.5;
  const calls=[];g.env.SKILLFX.play=(...args)=>calls.push(args);g.weapons(0.01);
  const clouds=calls.filter(c=>c[0]==='thunder'&&c[1]==='storm'),bolts=calls.filter(c=>c[0]==='thunder'&&c[1]==='strike');
  assert.equal(clouds.length,3);assert.equal(bolts.length,3);
  for(let i=0;i<3;i++){assert.equal(clouds[i][3].x,bolts[i][3].x);assert.equal(clouds[i][3].y,bolts[i][3].y);}
  const foes=g.snapshot().enemies;assert.ok(foes.slice(0,6).some(e=>e.hp<999));assert.equal(foes[6].hp,999);assert.equal(foes[7].hp,999);
});

test('Lv1–3 thunder radius exactly matches magnet Lv1–3 (190 / 270 / 350) without owning it',()=>{
  for (const rank of [1,2,3]) {
    const radius=110+rank*80,g=loadGame();g.start();
    g.combatScene('thunder',[{dx:radius-0.1,hp:80},{dx:radius+0.1,hp:80}],[],rank);
    g.weapons(0.01);
    assert.ok(g.snapshot().enemies[0].hp<80,'target inside radius must be struck at rank '+rank);
    assert.equal(g.snapshot().enemies[1].hp,80,'target outside radius must remain safe at rank '+rank);
  }
});

test('noncritical Lv1 is weak, Lv2 needs two attacks for a basic ghost, Lv3 kills basic mobs but not a tank or Boss',()=>{
  const a=loadGame();a.start();a.env.Math=Object.create(Math);a.env.Math.random=()=>0.99;
  a.combatScene('thunder',[{dx:110,hp:2}],[],1);
  a.weapons(0.01);
  assert.ok(a.snapshot().enemies[0].hp>1 && a.snapshot().enemies[0].hp<2);

  const b=loadGame();b.start();b.env.Math=Object.create(Math);b.env.Math.random=()=>0.99;
  b.combatScene('thunder',[{dx:100,hp:2},{dx:130,hp:2}],[],2);
  b.weapons(0.01);
  assert.ok(b.snapshot().enemies.every(e=>e.hp>0 && e.hp<2),'both targets survive first Lv2 bolt');
  b.weapons(2);
  assert.ok(b.snapshot().enemies.every(e=>e.hp<=0),'second Lv2 bolt kills both ordinary ghosts');

  const c=loadGame();c.start();c.combatScene('thunder',[
    {dx:100,hp:18,type:'ghost'}, {dx:160,hp:12,type:'runner'}, {dx:240,hp:40,type:'tank'}
  ],[],3);
  c.weapons(0.01);
  const [ghost,runner,tank]=c.snapshot().enemies;
  assert.ok(ghost.hp<=0 && runner.hp<=0,'ordinary small enemies fall in one Lv3 volley');
  assert.ok(tank.hp>0,'Lv3 must not erase heavy tanks regardless of their HP');
  const d=loadGame();d.start();d.combatScene('thunder',[{dx:160,type:'boss',hp:200,shield:false}],[],3);
  d.weapons(0.01);
  assert.ok(d.snapshot().enemies[0].hp>0,'Boss cannot be killed through Lv3 execute damage');
});

test('Lv4 randomly kills 3–5 distinct visible normal enemies and never offscreen foes or bosses',()=>{
  for(const [roll,expected] of [[0,3],[0.999,5]]){
    const g=loadGame();g.start();
    const normal=Array.from({length:7},(_,i)=>({dx:-340+i*110,dy:0,hp:60,type:'ghost'}));
    g.combatScene('thunder',normal.concat([
      {dx:470,hp:60,type:'ghost'}, {dx:0,dy:320,hp:60,type:'ghost'},
      {dx:110,hp:500,type:'boss',shield:false}, {dx:120,hp:500,type:'boss',shield:true}
    ]),[],4);
    g.env.Math=Object.create(Math);g.env.Math.random=()=>roll;
    const calls=[];g.env.SKILLFX.play=(...args)=>calls.push(args);
    g.weapons(0.01);
    const enemies=g.snapshot().enemies;
    assert.equal(enemies.slice(0,7).filter(e=>e.hp<=0).length,expected);
    assert.ok(enemies.slice(7).every(e=>e.hp>0),'out-of-frame targets and bosses remain untouched');
    assert.equal(calls.filter(c=>c[0]==='thunder'&&c[1]==='strike').length,expected);
  }
  const g=loadGame();g.start();g.combatScene('thunder',[{dx:100,hp:7}],[],4);
  g.weapons(0.01);
  assert.ok(g.snapshot().enemies[0].hp<=0,'fewer than three visible foes are all struck once');
});

test('awakening projectiles reset on restart and none bypass a shielded Boss',()=>{
  for(const skill of ['katana','fire','boom','needle','thunder']){
    const g=loadGame();g.start();g.face(0);g.combatScene(skill,[{dx:180,shield:true,type:'boss',hp:999}],[],5);
    for(let i=0;i<200;i++)g.weapons(0.01);
    assert.equal(g.snapshot().enemies[0].hp,999,skill);
    g.start();assert.equal(g.snapshot().winds.length+g.snapshot().ghosts.length,0);
  }
});

test('a long MAX volley run keeps wind, spirits, needles and explosive talismans bounded',()=>{
  const g=loadGame();g.start();g.face(0);
  for(const skill of ['katana','fire','needle','boom']){
    g.combatScene(skill,Array.from({length:40},(_,i)=>({dx:280+i*2,dy:(i%7-3)*32,hp:999999})),[],5);
    for(let i=0;i<1000;i++)g.weapons(0.05);
    const s=g.snapshot();assert.ok(s.winds.length<=8&&s.ghosts.length<=20&&s.needles.length<=21&&s.proj.length<=9);
  }
});

test('foxfire keeps its orbit at every rank including MAX',()=>{
  const g=loadGame();g.start();const counts=[1,2,4,6,6];
  for(const level of [1,2,3,4,5]){
    g.combatScene('fire',[],[],level);const flames=[];
    g.env.SKILLFX.paint=(ctx,id,lv,p)=>{if(id==='fire')flames.push({lv,p});};
    g.drawWorld();assert.equal(flames.length,counts[level-1]);
    for(const {lv,p} of flames){assert.equal(lv,level);assert.ok(Math.abs(Math.hypot(p.x-g.snapshot().x,p.y-g.snapshot().y)-98)<1e-8);assert.equal(p.origin.x,g.snapshot().x);assert.equal(p.origin.y,g.snapshot().y);assert.equal(p.orbit,true);}
  }
});

test('Lv1–3 foxfire only orbits and never detaches to seek enemies',()=>{
  for(const rank of [1,2,3]){
    const g=loadGame();g.start();
    g.combatScene('fire',[{dx:350,dy:0,hp:999999}],[],rank);
    for(let i=0;i<180;i++)g.weapons(.05);
    assert.equal(g.snapshot().ghosts.filter(p=>p.fireAttack).length,0,'rank '+rank+' should never launch');
    const flames=[];
    g.env.SKILLFX.paint=(ctx,id,level,p)=>{if(id==='fire'&&p.orbit)flames.push(p);};
    g.drawWorld();
    assert.equal(flames.length,[1,2,4][rank-1],'rank '+rank+' orbit count');
  }
});

test('Lv4 foxfire detaches exactly three of six guardians while they attack, then restores the ring',()=>{
  const g=loadGame();g.start();g.combatScene('fire',[{dx:320,dy:0,hp:999}],[],4);
  g.weapons(0.01);
  const attackers=g.snapshot().ghosts.filter(p=>p.fireAttack);
  assert.equal(attackers.length,3);assert.equal(attackers.map(p=>p.slot).join(','),'0,2,4');
  const flames=[];g.env.SKILLFX.paint=(ctx,id,lv,p)=>{if(id==='fire')flames.push(p);};
  g.drawWorld();assert.equal(flames.length,3);
  attackers.forEach(p=>{p.returning=true;p.x=g.snapshot().x+10;p.y=g.snapshot().y;});
  g.weapons(0.05);const restored=[];g.env.SKILLFX.paint=(ctx,id,lv,p)=>{if(id==='fire')restored.push(p);};
  g.drawWorld();assert.equal(restored.length,6);
});

test('hit stop still advances oil and the Boss clock',()=>{
  const g=loadGame();g.start();const before=g.snapshot();
  g.env.RENDERER.updateEffects=()=>true;g.frame(50);
  const after=g.snapshot();assert.ok(after.elapsed>before.elapsed);assert.ok(after.oil<before.oil);assert.ok(after.bossT<before.bossT);
});

test('pause stops speech and ages visual effects',()=>{
  const g=loadGame();g.start();let updates=0;g.env.RENDERER.updateEffects=()=>{updates++;return false;};
  g.events.keydown(key('Escape','Escape'));g.frame(16);
  assert.ok(g.audioCalls.includes('stopSpeech'));assert.equal(updates,1);
});

test('rain is static when reduced motion is requested',()=>{
  const g=loadGame();g.start('rain-port');g.env.matchMedia=()=>({matches:true});
  const points=[];g.env.RENDERER.getCtx().moveTo=(x,y)=>points.push([x,y]);
  g.drawStageWeather(0);const first=JSON.stringify(points);points.length=0;g.drawStageWeather(1);
  assert.equal(JSON.stringify(points),first);
});

test('mobile menu and codex tabs accept expanded touch targets',()=>{
  const g=loadGame();g.env.innerWidth=844;g.env.innerHeight=390;g.frame(16);
  const v=g.env.VIEWPORT.get(),bt=g.env.UI.MENU_BTNS.find(b=>b.id==='codex');
  const tap=(x,y)=>{g.canvasEvents.pointerdown(pointer((x+v.offsetX)*v.scale,(y+v.offsetY)*v.scale,'touch'));g.flushMenuPress();};
  tap(bt.x+bt.w/2,bt.y+bt.h+8);assert.equal(g.snapshot().state,'codex');
  tap(360,49);assert.equal(g.snapshot().codexTab,'cards');
});

test('pause hit target stays inside the HUD edge and outside score text',()=>{
  const g=loadGame();g.env.innerWidth=568;g.env.innerHeight=320;g.start();g.frame(16);
  const v=g.env.VIEWPORT.get(),bounds=g.env.VIEWPORT.hudBounds(),bt=g.buttonGeometry().pause,half=Math.max(0,(44/v.scale-bt.w)/2);
  assert.ok(bt.x+bt.w+half<=bounds.right+1e-8);
  g.canvasEvents.pointerdown(pointer((bounds.right-90+v.offsetX)*v.scale,(bt.y+bt.h/2+v.offsetY)*v.scale,'touch'));
  assert.equal(g.snapshot().state,'play');
});

test('enemy bullets expire inside buildings',()=>{
  const g=loadGame();g.start();g.wallBullet();g.update(0.01);
  assert.equal(g.snapshot().enemyBullets.length,0);
});

test('distant misdelivery enemies despawn without clearing the saved mistake',()=>{
  const g=loadGame();g.start();g.prepareOrder();const j=g.snapshot().job;
  g.resolve((j.ans.indexOf(j.word)+1)%3);g.placeAt(20000,20000);g.env.RENDERER.getCam=()=>({x:19550,y:19700});g.update(1);
  assert.equal(g.snapshot().enemies.some(e=>e.type==='mis'),false);
  assert.equal(g.env.STORE.get(j.word.jp).missBoost,2.5);
});

test('defeating the previous Boss does not postpone an already due final Boss',()=>{
  const g=loadGame();g.start();
  for(let i=0;i<3;i++){g.advanceBossClock(0);g.update(0.01);const boss=g.snapshot().enemies.find(e=>e.type==='boss');boss.shield=false;if(i===2)g.setElapsed(589);g.hurt(boss,99999);g.update(0.01);}
  assert.ok(g.snapshot().bossT<2);
});

test('rain motion follows its streak direction and rain-port has no petals or fireflies',()=>{
  const g=loadGame();g.start('rain-port');
  const ctx=g.env.RENDERER.getCtx(),points=[];ctx.moveTo=(x,y)=>points.push([x,y]);ctx.lineTo=(x,y)=>points.at(-1).push(x,y);
  g.drawStageWeather(0);const first=points[0];points.length=0;g.drawStageWeather(0.01);const next=points[0];
  const dx=next[0]-first[0],dy=next[1]-first[1];
  assert.ok(dy>0);assert.ok(Math.abs(dx/dy-(first[2]-first[0])/(first[3]-first[1]))<1e-9);
  const calls=[];g.env.RENDERER.drawAtmosphere=(...args)=>calls.push(args);g.drawWorld();
  assert.deepEqual(calls[0].slice(1),[0,0]);
});

test('two oil upgrades still consume oil at rest',()=>{
  const g=loadGame();g.start();g.upgradeOil();g.upgradeOil();g.setOil(100);g.update(1);
  assert.ok(g.snapshot().oil<100);
});

test('misdelivery finds a clear spawn when the answer and adjacent fallback are blocked',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.blockWrongSpawn();const j=g.snapshot().job;
  g.resolve((j.ans.indexOf(j.word)+1)%3);
  const mis=g.snapshot().enemies.find(e=>e.type==='mis');assert.ok(mis);assert.equal(g.enemyBlocked(mis),false);
});

test('frame errors pause the run, show recovery text and keep the next frame scheduled',()=>{
  const g=loadGame();g.start();let scheduled=0;g.env.requestAnimationFrame=()=>scheduled++;
  g.env.console={error(){}};g.env.RENDERER.drawGround=()=>{throw new Error('draw failed');};
  assert.doesNotThrow(()=>g.frame(16));assert.equal(scheduled,1);assert.equal(g.snapshot().state,'pause');
  assert.ok(g.drawnText.some(t=>t.includes('重新整理')));
  g.events.keydown(key('Enter','Enter'));assert.equal(g.snapshot().state,'menu');
  g.env.RENDERER.drawGround=()=>{throw new Error('draw failed');};
  g.setState('play');assert.doesNotThrow(()=>g.frame(32));assert.equal(g.snapshot().state,'pause');
  g.canvasEvents.pointerdown(pointer(20,20));assert.equal(g.snapshot().state,'menu');
});

test('shield hit feedback is throttled and colored rings fade',()=>{
  const g=loadGame();g.start();let hits=0;g.env.RENDERER.spawnDamageNumber=()=>hits++;
  const e={hp:100,shield:true,x:0,y:0};for(let i=0;i<20;i++)g.hurt(e,1);assert.equal(hits,1);
  const ctx=g.env.RENDERER.getCtx(),alphas=[];ctx.stroke=()=>{if(ctx.strokeStyle==='#ffffff')alphas.push(ctx.globalAlpha);};
  g.addRing();g.drawWorld();assert.ok(alphas.includes(0.25));
});

test('enemy fireballs render above night lighting and weather',()=>{
  const g=loadGame();g.start('rain-port');g.addBullet();
  const ctx=g.env.RENDERER.getCtx(),calls=[];g.env.RENDERER.renderLighting=()=>calls.push('night');
  ctx.arc=(x,y,r)=>{if(r===8)calls.push('bullet');};g.drawWorld();
  assert.ok(calls.includes('bullet'));assert.ok(calls.indexOf('bullet')>calls.indexOf('night'));
});

test('a trapped misdelivery enemy recovers to a clear position',()=>{
  const g=loadGame();g.start();g.addMis();g.trapMis();g.update(1);g.update(1);g.update(1);
  const e=g.snapshot().enemies.find(e=>e.type==='mis');assert.ok(e);assert.equal(g.enemyBlocked(e),false);
});

test('small pause targets accept clicks within a 44 CSS pixel hit area',()=>{
  const g=loadGame();g.env.innerWidth=844;g.env.innerHeight=390;g.start();g.frame(16);
  const v=g.env.VIEWPORT.get(),bt=g.buttonGeometry().pause;
  const x=(bt.x-6+v.offsetX)*v.scale,y=(bt.y+bt.h/2+v.offsetY)*v.scale;
  g.canvasEvents.pointerdown(pointer(x,y));assert.equal(g.snapshot().state,'pause');
});

test('rain-port runtime uses reduced shooter pressure and the intended recovery pacing',t=>{
  const results={};
  for(const stage of ['night-town','rain-port']) {
    const g=loadGame();g.start(stage);g.clearSolids();g.setElapsed(300);
    g.env.Math=Object.create(Math);
    for(let i=0;i<100;i++){g.env.Math.random=()=>(i+0.5)/100;g.spawnEnemy(3,560);}
    const enemies=g.snapshot().enemies;
    results[stage]={...g.stageTuning(),shooters:enemies.filter(e=>e.type==='shooter').length,ghostSpeed:enemies.find(e=>e.type==='ghost').speed};
    g.combatScene('needle',[]);g.advanceBossClock(0.01);g.update(0.01);
    results[stage].firstBossHp=g.snapshot().enemies.find(e=>e.type==='boss').hp;
  }
  assert.equal(results['rain-port'].shooters,6);
  assert.equal(results['night-town'].shooters,0); // 第一關新手關不出現燈籠怪
  assert.equal(results['rain-port'].ghostSpeed,results['night-town'].ghostSpeed);
  assert.equal(results['rain-port'].goal,6);assert.equal(results['rain-port'].xp,30);
  assert.ok(Math.abs(results['rain-port'].spawnInterval/results['night-town'].spawnInterval-1.15)<1e-9);
  assert.equal(results['rain-port'].firstBossHp,33);
  t.diagnostic(JSON.stringify({scenario:'runtime-stage-pressure',results}));
});

test('shooters are fragile and bosses resist skill knockback', () => {
  const g=loadGame();g.start('rain-port');g.clearSolids();g.setElapsed(300);
  g.env.Math=Object.create(Math);g.env.Math.random=()=>0.40;g.spawnEnemy(3,560);
  assert.equal(g.snapshot().enemies[0].type,'shooter');
  assert.equal(g.snapshot().enemies[0].hp,3);
  g.combatScene('barrier',[{dx:100,type:'boss',speed:0}]);
  const x=g.snapshot().enemies[0].x;g.weapons(0.01);
  assert.equal(g.snapshot().enemies[0].x,x);
  assert.ok(g.snapshot().enemies[0].hp<999);
});

test('rain-port shooter rate remains 6 percent before tanks start spawning',()=>{
  const g=loadGame();g.start('rain-port');g.clearSolids();g.setElapsed(180);
  g.env.Math=Object.create(Math);
  for(let i=0;i<100;i++){g.env.Math.random=()=>(i+0.5)/100;g.spawnEnemy(3,560);}
  assert.equal(g.snapshot().enemies.filter(e=>e.type==='shooter').length,6);
});

test('a shield absorbs the boss heavy attack instead of oil',()=>{
  const g=loadGame();g.start();g.update(1.3);g.tune('shield').f();
  g.combatScene('katana',[{dx:100,type:'boss',speed:0}],[],0);
  const before=g.snapshot().oil;for(let i=0;i<13;i++)g.update(0.1);
  assert.ok(before-g.snapshot().oil<1);assert.ok(g.audioCalls.includes('breakShield'));
});

test('each surge plays one warning cue throughout its preparation and arrival',()=>{
  const g=loadGame();g.start();g.scheduleSurge();
  for(let i=0;i<27;i++)g.update(0.1);
  assert.equal(g.audioCalls.filter(name=>name==='warningPulse').length,1);
  assert.equal(g.audioCalls.filter(name=>name==='thunder').length,0);
  assert.ok(g.snapshot().enemies.length>=10);
});

test('boss slam warns, locks its center, hits once for 20 oil, and can be dodged', () => {
  for(const dodge of [false,true]) {
    const g=loadGame();g.start();g.update(1.3);g.combatScene('katana',[{dx:100,type:'boss',speed:40}],[],0);
    g.update(0.01);const boss=g.snapshot().enemies[0],x=boss.x;
    assert.ok(boss.slam);const before=g.snapshot().oil;
    if(dodge)g.placeAt(g.snapshot().x-250,g.snapshot().y);
    for(let i=0;i<10;i++)g.update(0.1);
    assert.equal(boss.x,x);assert.ok(before-g.snapshot().oil<1);
    g.update(0.11);assert.equal(boss.slam,null);
    assert.ok(Math.abs(before-g.snapshot().oil-(dodge?0:20)-0.43*1.11)<1e-6);
    const after=g.snapshot().oil;g.update(0.1);
    assert.ok(after-g.snapshot().oil<1);
  }
});

test('abandon confirmation defaults to keeping the paused run and blocks covered actions',()=>{
  const g=loadGame();g.start();g.prepareOrder();g.prepareBoss();
  const before=g.snapshot();g.env.STORE.rec(before.job.word.jp,false);
  const savedBefore=g.env.localStorage.getItem('yokai-delivery-v1');
  let finishes=0;const finish=g.env.STORE.finish;g.env.STORE.finish=(...args)=>{finishes++;return finish(...args);};
  g.events.keydown(key('Escape','Escape'));
  const enter=()=>{g.events.keydown(key('Enter','Enter'));g.flushMenuPress();};
  const request=()=>{for(let i=0;i<g.env.UI.PAUSE_BTNS.findIndex(b=>b.id==='menu');i++)g.events.keydown(key('ArrowDown'));enter();};
  request();assert.equal(g.snapshot().state,'pause');assert.equal(g.snapshot().quitConfirm,true);
  assert.equal(g.snapshot().menuFocus,0);
  g.events.keydown(key('KeyC','c'));g.events.keydown({...key('Enter','Enter'),repeat:true});g.update(1);
  assert.equal(g.snapshot().quitConfirm,true);assert.equal(g.snapshot().state,'pause');
  assert.equal(g.snapshot().job,before.job);assert.equal(g.snapshot().bossQ,before.bossQ);
  assert.equal(g.snapshot().elapsed,before.elapsed);assert.equal(g.snapshot().oil,before.oil);
  enter();assert.equal(g.snapshot().quitConfirm,false);assert.equal(g.snapshot().state,'pause');
  request();g.events.keydown(key('Escape','Escape'));assert.equal(g.snapshot().state,'pause');assert.equal(g.snapshot().quitConfirm,false);
  request();g.events.keydown(key('ArrowRight'));enter();assert.equal(g.snapshot().state,'menu');
  assert.equal(g.env.localStorage.getItem('yokai-delivery-v1'),savedBefore);
  assert.equal(finishes,0); // Abandonment is not a win/loss settlement; prior word history survives.
});

test('abandon confirmation works for touch and gamepad without leaking confirmation',()=>{
  for(const mode of ['touch','gamepad']) {
    const g=loadGame();g.env.innerWidth=844;g.env.innerHeight=390;g.start();g.setState('pause');
    const v=g.env.VIEWPORT.get();
    const click=b=>{g.canvasEvents.pointerdown(pointer((b.x+b.w/2+v.offsetX)*v.scale,(b.y+b.h/2+v.offsetY)*v.scale,'touch'));g.flushMenuPress();};
    const request=()=>click(g.env.UI.pauseButtons().find(b=>b.id==='menu'));
    request();assert.equal(g.snapshot().state,'pause');assert.equal(g.snapshot().quitConfirm,true);
    if(mode==='touch') {
      click(g.env.UI.EXIT_BTNS[0]);assert.equal(g.snapshot().state,'pause');request();click(g.env.UI.EXIT_BTNS[1]);
    } else {
      const buttons=Array.from({length:16},()=>({pressed:false}));g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}];
      const press=i=>{buttons[i].pressed=true;g.pollGamepad();buttons[i].pressed=false;g.pollGamepad();g.flushMenuPress();};
      press(1);assert.equal(g.snapshot().state,'pause');assert.equal(g.snapshot().quitConfirm,false);
      request();press(15);buttons[0].pressed=true;g.pollGamepad();g.pollGamepad();
      assert.equal(g.snapshot().state,'pause','pressed sprite is shown before navigation');
      g.flushMenuPress();
      assert.equal(g.snapshot().state,'menu'); // Holding A must not immediately enter the map.
    }
    assert.equal(g.snapshot().state,'menu');assert.equal(g.snapshot().quitConfirm,false);
  }
});

test('Boss pointer answers use the rendered layout without covering bottom controls',()=>{
  for(const [width,height] of [[844,390],[900,600],[2560,1080]]) {
    const g=loadGame();g.env.innerWidth=width;g.env.innerHeight=height;g.start();g.prepareBoss();
    const q=g.snapshot().bossQ,layout=g.env.UI.bossQuizLayout(q.ans.length),v=g.env.VIEWPORT.get();
    const answer=layout.options[q.ans.indexOf(q.word)];
    g.canvasEvents.pointerdown(pointer((answer.x+answer.w/2+v.offsetX)*v.scale,(answer.y+answer.h/2+v.offsetY)*v.scale,'touch'));
    assert.equal(g.snapshot().bossQ,null);
    assert.equal(g.snapshot().enemies.find(e=>e.type==='boss').shield,false);
    assert.equal(g.snapshot().joy,null);assert.equal(g.snapshot().dashCd,0);
  }
});
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
  assert.equal(g.snapshot().state,'lampout'); // 先演出燈滅，再結算
  assert.equal(g.reviewWords().length,1);
  for(let i=1;i<=60;i++) g.frame(i*50);
  assert.equal(g.snapshot().state,'lost');
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
  assert.ok(Math.abs(submitted.oil-oilBefore-12)<0.01);
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

test('Boss assistance stays on a changed word and clears on a replay',t=>{
  const g=loadGame();g.start();g.prepareBoss();
  const old=g.snapshot().bossQ.word.jp;
  g.answerBoss(g.snapshot().bossQ.ans.findIndex((w,i)=>w.jp!==old&&!g.snapshot().bossQ.wrong.includes(i)));g.unlockBoss();
  g.answerBoss(g.snapshot().bossQ.ans.findIndex((w,i)=>w.jp!==old&&!g.snapshot().bossQ.wrong.includes(i)));g.unlockBoss();
  const next=g.snapshot().bossQ;assert.notEqual(next.word.jp,old);
  assert.equal(next.wasAssisted,true);
  g.answerBoss(next.ans.indexOf(next.word));assert.equal(g.env.STORE.get(next.word.jp).box,0);
  t.diagnostic(JSON.stringify({scenario:'changed-word-keeps-assistance',assisted:next.wasAssisted,afterAnswer:{...g.env.STORE.get(next.word.jp)}}));
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
 g.flushMenuPress();
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
test('misdelivery enemy settles away from player and retains a ranged penalty after the tutorial stage', () => {
  const g = loadGame(); g.start('rain-port'); g.addMis();
  for (let i = 0; i < 65; i++) g.update(0.05);
  const s = g.snapshot(), enemy = s.enemies.find(e => e.type === 'mis');
  assert.ok(enemy);
  assert.ok(Math.hypot(enemy.x - s.x, enemy.y - s.y) >= 80);
  assert.ok(s.enemyBullets.length > 0 || s.oil < 95);
});
test('first stage enemies never fire bullets', () => {
  const g = loadGame(); g.start(); g.addMis();
  for (let i = 0; i < 65; i++) g.update(0.05);
  const s = g.snapshot();
  assert.ok(s.enemies.some(e => e.type === 'mis'));
  assert.equal(s.enemyBullets.length, 0);
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

test('cargo icon is painted behind the courier, never over the face', () => {
  const g = loadGame(); g.start(); g.prepareOrder();
  g.env.UI.drawWordCue = () => g.actorCalls.push('cargo');
  g.drawWorld();
  const i = g.actorCalls.indexOf('player');
  assert.ok(i > 0);
  assert.equal(g.actorCalls[i - 1], 'cargo');
  assert.equal(g.actorCalls.filter(n => n === 'cargo').length, 1);
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
  assert.equal(g.snapshot().enemies.filter(e=>e.type==='boss' && e.hp>0).length,1);
  assert.equal(g.snapshot().bossStage,2);
  assert.ok(g.snapshot().bossT>170);
  t.diagnostic(JSON.stringify({scenario:'boss-kill-and-breather',killScore:400,killOil:35,gemDrops:9,masteryBefore:learned.box,masteryAfter:g.env.STORE.get(q.word.jp).box,bossStage:g.snapshot().bossStage,bossT:g.snapshot().bossT}));
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
      const q=g.snapshot().bossQ;g.answerBoss(q.ans.findIndex((w,i)=>w!==q.word&&!q.wrong.includes(i)));g.unlockBoss();
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
  g.setElapsed(700);g.update(0.01);
  assert.equal(g.snapshot().state,'play');
  g.setElapsed(590);g.meetDeliveryGoal();g.update(0.01);
  assert.equal(g.snapshot().state,'play');
  g.setElapsed(600);g.update(0.01);
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

test('final victory sequence: boss shakes and explodes, minions burn away, dawn rises, then settlement after 2s',()=>{
  const g=loadGame();g.start();g.clearSolids();
  for(let stage=0;stage<4;stage++) {
    g.advanceBossClock(0.01);g.setOil(100);g.update(0.01);
    const boss=g.snapshot().enemies.find(e=>e.type==='boss');
    g.moveBoss(200);g.update(0.01);g.unlockBoss();
    const q=g.snapshot().bossQ;g.answerBoss(q.ans.indexOf(q.word));
    g.hurt(boss,999);g.update(0.01);
  }
  g.env.Math=Object.create(Math);g.env.Math.random=()=>0.3;
  for(let i=0;i<5;i++) g.spawnEnemy(1,300);
  g.setElapsed(590);g.meetDeliveryGoal();g.setElapsed(600);g.update(0.01);
  assert.equal(g.snapshot().state,'victory');
  const shakes=[];const trigger=g.env.RENDERER.triggerShake;g.env.RENDERER.triggerShake=n=>{shakes.push(n);return trigger(n);};
  const at=ms=>{const s=g.snapshot();return {state:s.state,boss:s.enemies.filter(e=>e.type==='boss').length,minions:s.enemies.filter(e=>e.type!=='boss').length};};
  let i=0;const run=sec=>{while(i*50<sec*1000)g.frame(++i*50);};
  run(0.8);assert.deepEqual(at(),{state:'victory',boss:1,minions:5});          // 小怪定格、Boss 還在抖動爆炸
  run(1.8);assert.deepEqual(at(),{state:'victory',boss:0,minions:5});          // Boss 大爆後消失，小怪尚在
  run(2.5);assert.ok(at().minions>0);                                            // 小怪燃燒中
  run(3.05);assert.deepEqual(at(),{state:'victory',boss:0,minions:0});         // 小怪燒光，曙光才開始
  run(4.8);assert.equal(at().state,'victory');                                  // 曙光亮起後仍停留約 2 秒
  run(5.2);assert.equal(at().state,'won');
  assert.deepEqual(shakes,[]);                                                  // 全程沒有整個畫面的地震式震動
});

test('running out of oil snuffs the lamp, fades the BGM, and settles only after two dark seconds',()=>{
  const g=loadGame();g.start();g.setOil(0.01);
  let i=0;const run=sec=>{while(i*50<sec*1000)g.frame(++i*50);};
  run(0.3);assert.equal(g.snapshot().state,'lampout');
  assert.ok(g.audioCalls.includes('fadeOutMusic'));
  assert.equal(g.audioCalls.includes('lose'),false);
  run(0.8+2.0-0.3);assert.equal(g.snapshot().state,'lampout'); // 燈滅後的 2 秒黑暗還沒走完
  run(0.8+2.0+0.4);assert.equal(g.snapshot().state,'lost');
  assert.equal(g.audioCalls.filter(n=>n==='lose').length,1);
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
  assert.equal(g.codexCount(), 27);
  for (let i=0; i<4; i++) g.events.keydown(key('ArrowRight', 'ArrowRight'));
  assert.equal(g.snapshot().codexPage, 1);
  g.events.keydown(key('ArrowLeft', 'ArrowLeft')); assert.equal(g.snapshot().codexPage, 0);
  const buttons = Array.from({length:16}, () => ({pressed:false}));
  g.env.navigator.getGamepads = () => [{connected:true, axes:[0,0], buttons}];
  buttons[15].pressed=true; g.pollGamepad(); assert.equal(g.snapshot().codexPage, 1);
  buttons[15].pressed=false; buttons[14].pressed=true; g.pollGamepad(); assert.equal(g.snapshot().codexPage, 0);
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
  g.combatScene('thunder',[{dx:180,type:'boss',shield:true,hp:9999},{dx:-180,hp:999}]);
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
 const g=loadGame();
 const enter=()=>{g.events.keydown(key('Enter','Enter'));g.flushMenuPress();};
 g.events.keydown(key('ArrowDown'));enter();assert.equal(g.env.document.getElementById('controls-open').clicked,true);
 g.events.keydown(key('ArrowDown'));enter();assert.equal(g.snapshot().state,'codex');assert.equal(g.snapshot().codexTab,'cards');
 g.events.keydown(key('Escape','Escape'));g.events.keydown(key('ArrowDown'));enter();assert.equal(g.snapshot().codexTab,'words');
 g.start();g.prepareOrder();g.events.keydown(key('Escape','Escape'));
 for(let i=0;i<3;i++)g.events.keydown(key('ArrowDown'));enter();assert.ok(g.audioCalls.includes('toggleMute'));
 for(let i=0;i<3;i++)g.events.keydown(key('ArrowDown'));enter();
 assert.equal(g.snapshot().quitConfirm,true);g.events.keydown(key('ArrowRight'));enter();assert.equal(g.snapshot().state,'menu');
 g.start();assert.equal(g.snapshot().job,null);assert.equal(g.snapshot().elapsed,0);assert.equal(g.snapshot().oil,100);assert.equal(g.snapshot().enemies.length,0);
});
test('gamepad directional menus confirm once without leaking actions into the new screen',()=>{
 const g=loadGame();g.start();g.events.keydown(key('Escape','Escape'));
 const buttons=Array.from({length:16},()=>({pressed:false}));g.env.navigator.getGamepads=()=>[{connected:true,axes:[0,0],buttons}];
 const press=i=>{buttons[i].pressed=true;g.pollGamepad();buttons[i].pressed=false;g.pollGamepad();g.flushMenuPress();};
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
 g.events.keydown(key('Enter','Enter'));g.flushMenuPress();assert.equal(g.snapshot().state,'overworld');
 g.canvasEvents.pointerdown(pointer(30,30));assert.equal(g.snapshot().state,'menu');
 g.start();g.events.keydown(key('KeyD','d'));g.events.keydown(key('Escape','Escape'));
 for(let i=0;i<g.env.UI.PAUSE_BTNS.findIndex(b=>b.id==='menu');i++)g.events.keydown(key('ArrowDown'));g.events.keydown(key('Enter','Enter'));g.flushMenuPress();
 assert.equal(g.snapshot().quitConfirm,true);g.events.keydown(key('ArrowRight'));g.events.keydown(key('Enter','Enter'));g.flushMenuPress();
 assert.equal(g.snapshot().state,'menu');assert.equal(g.snapshot().keys.length,0);
 g.start();assert.equal(g.snapshot().joy,null);
});

test('pickup speaks the word once and delivery does not repeat it', () => {
  const g = loadGame(); g.start(); g.setOil(80); g.prepareOrder();
  assert.equal(g.audioCalls.filter(n => n === 'speak').length, 1);
  const before = g.snapshot().oil;
  g.triggerHint(); g.update(0.6); g.triggerHint();
  const hinted = g.snapshot().oil;
  assert.ok(before - hinted >= 7);
  g.resolve(g.snapshot().job.ans.indexOf(g.snapshot().job.word));
  assert.ok(g.snapshot().oil > before);
  assert.equal(g.snapshot().score, 25);
  assert.equal(g.audioCalls.filter(n => n === 'speak').length, 2); // 取貨 1 次 + 提示重播 1 次
});

test('dawn does not end a run that still needs the delivery goal or the boss', () => {
  const g = loadGame(); g.start(); g.setOil(80); g.setElapsed(644); g.update(0.5);
  assert.equal(g.snapshot().state, 'play');
  g.setElapsed(900); g.update(0.01);
  assert.equal(g.snapshot().state, 'play');
  assert.ok(g.snapshot().oil > 70);
});

test('level-up freezes oil drain and waits until a card is chosen', () => {
  const g = loadGame(); g.start(); g.setOil(90); g.offerUp();
  for (let i = 1; i <= 160; i++) g.frame(i * 50);
  assert.equal(g.snapshot().state, 'levelup');
  assert.equal(g.snapshot().level, 1);
  assert.equal(g.snapshot().oil, 90);
  g.events.keydown(key('Digit1', '1'));
  assert.equal(g.snapshot().state, 'play');
  assert.equal(g.snapshot().level, 2);
});

test('misdelivery speed ignores movement upgrades', () => {
  const g = loadGame(); g.start();
  const spd = g.tune('spd');
  while (spd.ok()) spd.f();
  g.addMis(); g.update(0.01);
  const enemy = g.snapshot().enemies.find(e => e.type === 'mis');
  assert.ok(enemy.speed <= 200);
  assert.ok(enemy.speed < 230);
});

test('priority orders prefer a house that teaches the same word', () => {
  const g = loadGame(); g.start(); g.clearOrders();
  const target = g.housesNow().find(h => h.word);
  g.env.STORE.rec(target.word.jp, false);
  g.placeAt(target.x, target.y);
  g.makeOrder();
  const order = g.snapshot().orders[0];
  assert.equal(order.word.jp, target.word.jp);
  assert.equal(order.from.word.jp, target.word.jp);
});

test('expired orders cost neither oil nor misdelivery count, and the open slot refills immediately', () => {
  const g = loadGame(); g.start(); g.setOil(40); g.ageOrders(200); g.update(0.01);
  assert.equal(g.failCount(), 0);
  assert.ok(g.snapshot().oil > 39.9);
  assert.equal(g.snapshot().state, 'play');
  assert.equal(g.snapshot().orders.length, 1);
});

test('gamepad select opens the codex from pause and not during play', () => {
  const g = loadGame(); g.start();
  const buttons = Array.from({length:16}, () => ({pressed:false}));
  g.env.navigator.getGamepads = () => [{connected:true, axes:[0,0], buttons}];
  const press = i => { buttons[i].pressed = true; g.pollGamepad(); buttons[i].pressed = false; g.pollGamepad(); };
  press(8); assert.equal(g.snapshot().state, 'play');
  g.events.keydown(key('Escape', 'Escape'));
  press(8); assert.equal(g.snapshot().state, 'codex');
});

test('damage and oil-heal upgrades stop after their stack caps', () => {
  const g = loadGame(); g.start();
  const dmg = g.tune('dmg'); let stacks = 0;
  while (dmg.ok && dmg.ok()) { dmg.f(); stacks++; }
  assert.equal(stacks, 6); assert.equal(dmg.ok(), false);
  const heal = g.tune('oil_heal'); stacks = 0;
  while (heal.ok && heal.ok()) { heal.f(); stacks++; }
  assert.equal(stacks, 3); assert.equal(heal.ok(), false);
});

test('MAX dragon impact leaves a burning ground zone that ticks after the projectile vanishes',()=>{
  const g=loadGame();g.start();g.combatScene('fire',[{dx:280}],[],5);
  g.weapons(0.01);
  assert.equal(g.snapshot().ghosts.filter(v=>v.dragon).length,1);
  for(let i=0;i<325;i++)g.weapons(0.01);
  const first=g.snapshot(),enemy=first.enemies[0];
  assert.equal(first.dragonShots.length,0,'projectile should impact and disappear');
  assert.equal(first.ghosts.some(v=>v.dragon),false,'summon should not stay onscreen');
  assert.equal(first.dragonScorches.length,1,'hit must ignite the ground');
  assert.ok(enemy.hp<999,'fireball must damage the target');
  const hpAfterImpact=enemy.hp;
  for(let i=0;i<55;i++)g.weapons(0.01);
  assert.ok(enemy.hp<hpAfterImpact,'staying on hot ground causes repeated damage');
  assert.equal(g.snapshot().dragonScorches.length,1);
  g.setWeaponRank('fire',0);
  for(let i=0;i<750;i++)g.weapons(0.01);
  assert.equal(g.snapshot().dragonScorches.length,0,'burning zone expires');
});

test('giant dragon renders after houses and the courier without duplicate passes',()=>{
  const g=loadGame();g.start();g.combatScene('fire',[{dx:290}],[],5);g.weapons(0.01);
  const events=[];
  const oldPaint=g.env.SKILLFX.paint;
  g.env.SKILLFX.paint=(ctx,id,lv,p)=>{if(p?.dragon)events.push('dragon');return oldPaint(ctx,id,lv,p);};
  g.env.RENDERER.drawPlayer=()=>events.push('player');
  g.env.RENDERER.drawHouse=()=>events.push('house');
  g.occlusionScene(900);
  g.drawWorld();
  assert.equal(events.filter(v=>v==='dragon').length,1);
  assert.ok(events.indexOf('dragon')>events.indexOf('player'));
  assert.ok(events.includes('house'));
  assert.ok(events.lastIndexOf('dragon')>events.lastIndexOf('house'));
});

test('MAX katana triple-speed projectile keeps the same facing and damage model',()=>{
  const g=loadGame();g.start();g.face(0);g.combatScene('katana',[{dx:280}],[],5);
  for(let i=0;i<31;i++)g.weapons(0.01);
  const wave=g.snapshot().winds[0];
  assert.ok(wave);
  assert.equal(wave.vx,1680);
  assert.equal(wave.vy,0);
  assert.equal(wave.size,360);
  assert.ok(wave.maxTravel>=1400);
});

test('the giant dragon can also enter from the right edge toward a left-side target',()=>{
  const g=loadGame();g.start();g.combatScene('fire',[{dx:-300}],[],5);
  g.weapons(0.01);
  const d=g.snapshot().ghosts.find(p=>p.dragon);
  assert.ok(d);
  assert.equal(d.faceX,-1);
  assert.ok(d.entry.startX>d.entry.endX);
  assert.ok(d.size>=300&&d.size<=680,'restrained dragon sprite range');
  assert.ok(d.size<550,'smaller than the former minimum');
});

test('a flying dragon fireball paints its art with visible ink embers and a bounded glow',()=>{
  const g=loadGame();g.start();g.combatScene('fire',[{dx:480}],[],5);
  for(let i=0;i<112;i++)g.weapons(0.01);
  assert.equal(g.snapshot().dragonShots.length,1,'fireball should be visible mid-flight');
  const ball={naturalWidth:256,naturalHeight:256},imageDraws=[],inkMarks=[];
  g.env.ART={dragon_fireball_l5:ball};
  g.ctx.drawImage=(img,...rest)=>{if(img===ball)imageDraws.push(rest);};
  g.ctx.quadraticCurveTo=(...args)=>inkMarks.push(args);
  g.drawWorld();
  assert.equal(imageDraws.length,1,'fireball texture must render once');
  assert.deepEqual(imageDraws[0],[-72,-72,144,144]);
  assert.ok(inkMarks.length>=4,'comet needs brush-stroke sparks, not just a still image');
});
