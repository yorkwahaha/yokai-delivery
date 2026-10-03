const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadGame() {
  const events = {}, canvasEvents = {}, documentEvents = {};
  const gradient = { addColorStop() {} };
  const drawnText = [], actorCalls = [], transforms = [];
  const ctx = new Proxy({ setTransform: (...args) => transforms.push(args), fillText: text => drawnText.push(text), measureText: () => ({ width: 40 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient }, { get: (o, k) => o[k] || (() => {}) });
  const canvas = { addEventListener: (k, f) => { canvasEvents[k] = f; }, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: env.innerWidth || 900, height: env.innerHeight || 600 }) };
  const controlsButton = { click() { this.clicked = true; } };
  const env = { console, Set, Map, Math, Date, performance: { now: () => 0 }, navigator: {}, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, document: { hidden: false, getElementById: id => id === 'controls-open' ? controlsButton : canvas, addEventListener: (k, f) => { documentEvents[k] = f; } }, addEventListener: (k, f) => { events[k] = f; } };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['words', 'world', 'store', 'config', 'viewport', 'controls', 'overworld']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  c.CONTROLS.mount = () => {};
  const audioCalls = [];
  c.AUDIO = new Proxy({}, { get: (o, name) => () => audioCalls.push(name) });
  c.RENDERER = new Proxy({ drawHouse: h => actorCalls.push(`house:${h.id}`), drawPlayer: () => actorCalls.push('player'), drawMonster: e => actorCalls.push(`enemy:${e.id}`), getCtx: () => ctx, getDpr: () => c.devicePixelRatio || 1, getCam: () => ({ x: 900, y: 600 }), getShakeOffset: () => ({x:0,y:0}), updateEffects: () => false }, { get: (o, k) => o[k] || (() => {}) });
  c.UI = new Proxy({ HINT_BTN: { x: 532, y: 20, w: 78, h: 40 }, readableFont: () => '20px sans-serif' }, { get: (o, k) => o[k] || (() => {}) });
  const source = fs.readFileSync('js/game.js', 'utf8');
  const end = source.lastIndexOf('})();');
  const hook = `window.fixture = { start, update, frame, drawWorld, makeOrder, hurt, pollGamepad, offerUp, triggerHint, resolve, spawnEnemy, weapons,
    combatScene: (weapon, foes, walls=[]) => { Object.keys(WL).forEach(k=>WL[k]=0); WL[weapon]=1; wT[weapon]=0; enemies=foes.map(e=>({x:P.x+e.dx,y:P.y+(e.dy||0),hp:999,max:999,type:'ghost',...e})); solids.splice(0,solids.length,...walls.map(s=>({x0:P.x+s.x0,x1:P.x+s.x1,y0:P.y+s.y0,y1:P.y+s.y1}))); },
    heal: () => UP.find(u=>u.id==='oil_heal').f(),
    blockBossRing: all => { syncWorld(); const radius=spawnRadius(520); solids.splice(0,solids.length,all?{x0:P.x-10000,x1:P.x+10000,y0:P.y-10000,y1:P.y+10000}:{x0:P.x+radius-60,x1:P.x+radius+60,y0:P.y-60,y1:P.y+60}); },
    clearSolids: () => solids.splice(0),
    enemyBlocked: e => blocked(e.x,e.y,16),
    occlusionScene: (playerY) => { houses.splice(0,houses.length,{id:1,x:1350,y:900}); orders=[]; job=null; enemies=[{id:1,x:1350,y:820,type:'ghost'},{id:2,x:1350,y:1000,type:'ghost',vanish:0.5}]; P.y=playerY; state='pause'; },
    preparePickup: () => { makeOrder(); inter=orders[0]; },
    prepareOrder: () => { makeOrder(); inter=orders[0]; interact(); job.lock=0; },
    scheduleBoss: () => { bossT=0; },
    prepareBoss: () => { const bs={x:P.x+200,y:P.y,type:'boss',word:ALL[0],hp:999,max:999,shield:true}; enemies.push(bs); bossQ=mkQ(bs); bossQ.lock=0; },
    setState: next => { state=next; ended=false; },
    snapshot: () => ({ state, x:P.x, y:P.y, joy, dashCd, oil, score, level, elapsed, cargo, job, orders, bossQ, codexTab, codexPage, floats:texts, enemies, enemyBullets, keys: [...keys] }),
    addMis: () => enemies.push({x:P.x+100,y:P.y,type:"mis",w:ALL[0],hp:999,max:999,speed:210,flash:0,wob:0}), emptyHouses: () => houses.splice(0) };`;
  vm.runInContext(source.slice(0, end) + hook + source.slice(end), c);
  return { ...c.fixture, events, canvasEvents, documentEvents, env: c, audioCalls, drawnText, actorCalls, transforms };
}
const pointer = (x, y, type = 'mouse') => ({ clientX: x, clientY: y, pointerId: 1, pointerType: type, button: 0, preventDefault() {} });
const key = (code, value = '') => ({ code, key: value, preventDefault() {} });
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
