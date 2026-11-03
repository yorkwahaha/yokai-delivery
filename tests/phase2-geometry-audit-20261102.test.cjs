'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');

test('two sealed Bosses: wrong answer cannot consume a second Boss safety timer',()=>{
 const g=loadGame({seed:82});
 g.start();g.stopSpawns();g.clearOrders();
 const words=g.env.CONTENT.getStageWords('night-town');
 g.prepareBoss(words[0]);g.prepareBoss(words[1]);
 const sample=g.snapshot();
 const bosses=sample.enemies.filter(e=>e.type==='boss');
 assert.equal(bosses.length,2);
 Object.assign(bosses[0],{x:sample.x+110,y:sample.y,speed:0});
 Object.assign(bosses[1],{x:sample.x+210,y:sample.y,speed:0});
 g.update(.05);
 g.unlockBoss();
 const question=g.snapshot().bossQ;
 const wrong=question.ans.findIndex(w=>w.jp!==question.word.jp);
 assert.ok(wrong>=0,'question has a wrong option');
 const far=bosses.find(b=>b!==bosses[0]);
 const timerBefore=far.barrierTimer;
 const enteredBefore=far.quizEntered;
 g.answerBoss(wrong);
 const before=g.snapshot().elapsed;
 for(let i=0;i<50;i++)g.update(.2);
 const after=g.snapshot();
 assert.ok(after.elapsed>before+9,'curse must run on the normal battlefield clock');
 assert.equal(far.barrierTimer,timerBefore,'the other Boss safety timer must not run');
 assert.equal(far.quizEntered,enteredBefore,'do not enter the other quiz during curse');
 assert.notEqual(far.quizClosed,true,'the other Boss safe reading must remain available');
 g.update(.05);
 assert.ok(far.barrierTimer===undefined || far.barrierTimer>0);
});

test('barrier geometry exactly retains old ellipse at tilts and padding',()=>{
 const env={window:{}};vm.runInNewContext(fs.readFileSync('js/game-geometry.js','utf8'),env);
 const contains=env.window.GAME_GEOMETRY.deliveryBarrierContains;
 const house={x:200,y:350};
 for(const tilt of [.6,1])for(const padding of [0,14]){
  const rx=245+padding,ry=165/tilt+padding;
  const cases=[
    [{x:200,y:420},true],
    [{x:200+rx,y:420},true],
    [{x:200+rx+.01,y:420},false],
    [{x:200,y:420+ry},true],
    [{x:200,y:420+ry+.01},false],
    [{x:200+rx/3,y:420+ry/4},true],
  ];
  for(const [point,answer] of cases){
   const expected=((point.x-house.x)/rx)**2+((point.y-(house.y+70))/ry)**2<=1;
   assert.equal(contains(point,house,tilt,padding),expected,JSON.stringify({tilt,padding,point}));
  }
 }
 assert.equal(contains(null,house,.6),false);
 assert.equal(contains({x:200,y:420},null,.6),false);
 assert.equal(contains(house,house,.6,-500),false);
});

test('runtime manifest hanging fetch settles within timeout and stage2 loading finishes',async()=>{
 const images=[];
 class MockImage{constructor(){images.push(this)}set src(v){this._src=v}get src(){return this._src}}
 class MockAudio{addEventListener(){}}
 const timers=[];
 const env={console,Image:MockImage,Audio:MockAudio,Date,location:{search:''},
   fetch:()=>new Promise(()=>{}),
   setTimeout:(fn,ms)=>{const timer={fn,ms,cancelled:false};timers.push(timer);return timer;},
   clearTimeout:timer=>{timer.cancelled=true;}};
 env.window=env;
 vm.runInNewContext(fs.readFileSync('js/assets.js','utf8'),env);
 env.__ACTIVE_STAGE='rain-port';
 env.STAGE_ART_RESOLVER.setActiveStage('rain-port');
 const task=env.loadS2ArtProdAssets();
 const timeout=timers.find(t=>t.ms===10000&&!t.cancelled);
 assert.ok(timeout,'manifest request starts 10sec timeout');
 timeout.fn();
 await task;
 assert.equal(env.S2_ART_PROD_CACHE.finished,true);
 assert.equal(env.S2_ART_PROD_CACHE.loaded,false);
 assert.ok(/MANIFEST/.test(env.S2_ART_PROD_CACHE.loadError||''),String(env.S2_ART_PROD_CACHE.loadError));
});

test('current browser build loads geometry before game and updates assets revision',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.indexOf('js/game-quiz-logic.js')<html.indexOf('js/game-geometry.js'));
 assert.ok(html.indexOf('js/game-geometry.js')<html.indexOf('js/game.js'));
 assert.ok(html.includes('js/assets.js?v=20261102-geometry-phase2'));
 assert.ok(html.includes('js/game.js?v=20261103-thunder-phase26'));
});
