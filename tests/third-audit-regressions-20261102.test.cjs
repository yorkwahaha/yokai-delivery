'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadGame} = require('./helpers/game-runtime.cjs');
require('../js/delivery-lexicon.js');
const CONTENT = require('../js/words.js');
const WORLD = require('../js/world.js');

test('rain-port: six successive deliveries always have a next reachable order', () => {
  const g = loadGame({stage:'rain-port',seed:42});
  g.start(); g.stopSpawns();
  for (let i=0;i<6;i++) {
    if (!g.snapshot().orders.length) g.preparePickup();
    assert.ok(g.snapshot().orders.length > 0, 'cannot generate delivery '+(i+1));
    assert.ok(g.prepareOrder(), 'cannot accept delivery '+(i+1));
    g.atAnswer();
    for(let f=0;f<120 && g.snapshot().job;f++) {
      if(g.snapshot().state==='levelup') {
        g.waitLevelUpCooldown(50); g.resolveLevelUps(40);
      }
      g.update(1/60);
    }
    const snap=g.snapshot();
    assert.equal(snap.delivered,i+1,'must complete every delivery');
    assert.equal(snap.state,'play','still playing after delivery '+(i+1));
  }
});

test('port teaching words occur within 23 nearby chunks, not only across the infinite map', () => {
  const stage = CONTENT.getStage('rain-port');
  const world=WORLD.createStageWorld(stage,CONTENT);
  const words=new Set();
  for(let cx=-10;cx<=12;cx++) for(const h of world.getChunk(cx,0).houses) words.add(h.word.jp);
  for(const w of CONTENT.getStageWords(stage)) assert.ok(words.has(w.jp), w.jp+' was missing locally');
});

test('oil_heal passive applies legal damage inside level-up; victory remains immune', () => {
  const g=loadGame({seed:65});
  g.start();g.stopSpawns();
  g.combatScene('katana',[{dx:85,dy:0,hp:1000,max:1000}]);
  const mob=g.snapshot().enemies[0];
  const before=mob.hp;
  g.setState('levelup');
  g.tune('oil_heal').f();
  assert.ok(mob.hp<before,'oil heal must damage nearby mob');
  const prev=mob.hp;
  g.setState('victory');g.hurt(mob,100);
  assert.equal(mob.hp,prev,'no ordinary damage after victory');
});

test('Boss wrong answer resumes elapsed clock even when a second sealed Boss is nearby', () => {
  const g=loadGame({seed:82});
  g.start();g.stopSpawns();
  const words=g.env.CONTENT.getStageWords('night-town');
  g.prepareBoss(words[0]);g.prepareBoss(words[1]);
  const snap=g.snapshot();
  const bosses=snap.enemies.filter(e=>e.type==='boss');
  Object.assign(bosses[0],{x:snap.x+110,y:snap.y,speed:0});
  Object.assign(bosses[1],{x:snap.x+210,y:snap.y,speed:0});
  g.update(.05); const q=g.snapshot().bossQ;
  assert.ok(q);
  g.unlockBoss();
  const wrong=q.ans.findIndex(w=>w!==bosses[0].word);
  assert.ok(wrong>=0);
  g.answerBoss(wrong);
  const before=g.snapshot();
  g.update(.15);const after=g.snapshot();
  assert.ok(after.elapsed>before.elapsed,'curse cannot be frozen by second Boss reading');
});

test('index refreshes the five changed JavaScript assets',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const key of ['store','assets'])
   assert.match(html,new RegExp('js/'+key+'\\.js\\?v='+ (key==='store'?'20261102-r3':'20261102-playtest-ui4')),key);
 for(const key of ['world','ui'])
   assert.match(html,new RegExp('js/'+key+'\\.js\\?v=20261102-playtest-ui5'),key);
 for(const key of ['renderer','game','audio'])
   assert.match(html,new RegExp('js/'+key+'\\.js\\?v=20261102-water-slam-sfx'),key);
});

test('core image that never answers eventually releases ART_READY',()=>{
  const images=[],timers=[];
  class Image {constructor(){images.push(this);}}
  class Audio {constructor(src){this.src=src;}addEventListener(){}}
  const env={console,Image,Audio,fetch:async()=>({ok:true,json:async()=>({})}),Date};
  env.setTimeout=(f,delay)=>{const job={f,delay,cancel:false};timers.push(job);return job;};
  env.clearTimeout=job=>{job.cancel=true;};
  env.window=env;
  vm.runInNewContext(fs.readFileSync('js/assets.js','utf8'),env);
  env.loadGameArt();
  const blade=images.find(i=>i.src?.includes('/katana_l1.webp'));
  assert.ok(blade);
  for(const img of [...images]) if(img!==blade) img.onload();
  assert.equal(env.ART_READY,false,'missing blade blocks initially');
  const timeout=timers.find(t=>!t.cancel && t.delay===10000);
  assert.ok(timeout);
  for(const t of timers) if(!t.cancel&&t.delay===10000) t.f();
  assert.equal(env.ART_READY,true,'loading must leave the screen');
  blade.naturalWidth=400;blade.onload();
  assert.ok(env.ART.katana_l1,'late approved image can still load');
});
