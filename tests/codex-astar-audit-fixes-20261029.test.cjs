'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./helpers/game-runtime.cjs');
const BOSS_AI=require('../js/boss-ai.js');
const root=path.join(__dirname,'..');
const source=f=>fs.readFileSync(path.join(root,f),'utf8');
test('雨港新局多組亂數均有首張委託且長度受限',()=>{
  for(let seed=1;seed<=10;seed++){
    const g=loadGame({stage:'rain-port',seed});
    g.start('rain-port');g.makeOrder();
    const order=g.ordersNow()[0];
    assert.ok(order,'seed '+seed+' gets order');
    const dx=Math.abs(order.from.x-order.to.x);
    assert.ok(dx>=700&&dx<=3600,'seed '+seed+' route '+dx);
    assert.notEqual(order.from.id,order.to.id);
  }
});
test('冰針冰凍目標死亡時碎裂一次、波及鄰怪而不重複引爆',()=>{
  const g=loadGame({stage:'night-town',seed:2});g.start('night-town');
  const volley={used:false,hits:new Set()};
  g.combatScene('needle',[{dx:80,hp:1,freezeT:2,freezeEnds:999,shatterVolley:volley},
    {dx:120,hp:10}]);
  const foes=g.snapshot().enemies;
  g.hurt(foes[0],2);
  assert.equal(volley.used,true);
  assert.equal(foes[1].hp,7);
  g.hurt(foes[0],2);
  assert.equal(foes[1].hp,7);
});
test('潮汐扇形在60/20FPS均命中同一目標',()=>{
  function run(dt){
    const enemy={x:0,y:0,hp:100,max:100,hazard:{kind:'tidalFan',
      phase:'active',t:0,duration:.15,x:0,y:0,startAngle:-Math.PI/3,
      endAngle:Math.PI/3,r:200,hit:false}};
    let hits=0;
    for(let t=0;t<.2;t+=dt)if(BOSS_AI.step(enemy,{x:160,y:0},dt).hit)hits++;
    return hits;
  }
  assert.equal(run(1/60),1);assert.equal(run(.05),1);
});
test('雨夜渦流多水柱在不同幀依序落下',()=>{
  const h={kind:'rainVortex',phase:'active',t:0,duration:.9,
    vortexes:Array.from({length:3},()=>({x:50,y:0,r:28,hit:false}))};
  const enemy={x:0,y:0,hp:100,max:100,hazard:h};
  const frames=[];
  for(let i=0;i<17;i++) if(BOSS_AI.step(enemy,{x:50,y:0},.05).hit)frames.push(i);
  assert.equal(frames.length,3);
  assert.equal(new Set(frames).size,3);
  assert.ok(h.vortexes.every(v=>typeof v.fallProgress==='number'));
});
test('路線重選包含目的地上限/三列限制，圖鑑與教材說明一致',()=>{
  const game=source('js/game.js'),ui=source('js/ui.js');
  assert.match(game,/Math\.abs\(h\.x - o\.to\.x\) > 3600/);
  assert.match(game,/colsBetween\(h\.x, o\.to\.x\) < 3/);
  assert.match(game,/const needsIntro = bs\.introduced === false/);
  assert.match(ui,/有效頻率 \+0\.25/);
  assert.match(ui,/10 秒/);
  assert.match(ui,/實驗室限定/);
});
