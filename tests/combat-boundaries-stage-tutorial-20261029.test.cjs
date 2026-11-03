'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const BOSS_AI = require('../js/boss-ai.js');
const game = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');

test('消除或本幀到期的敵彈不再傷人，存活敵彈仍可命中', () => {
  const start = game.indexOf('    for (const eb of enemyBullets) {', game.indexOf('// 敵人幽冥妖火彈更新'));
  const end = game.indexOf('    const despawnRadius', start);
  assert.ok(start >= 0 && end > start);
  for (const [life, expected] of [[0, 0], [-1, 0], [0.001, 0], [1, 1]]) {
    const context = { enemyBullets: [{x:0,y:0,vx:0,vy:0,life}], P:{x:0,y:0}, dt:1/60,
      blocked:()=>false, dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), damage:0 };
    context.hurtPlayer = amount => { context.damage += amount; return false; };
    vm.runInNewContext('(function(){' + game.slice(start, end) + '})()', context);
    assert.equal(context.damage, expected * 8, 'life=' + life);
    assert.equal(context.enemyBullets.length, 0);
  }
});

function fanHits(angle, rotation, dt) {
  const enemy = {hp:100,x:0,y:0,hazard:{kind:'tidalFan',phase:'active',t:0,duration:.15,
    x:0,y:0,startAngle:rotation-Math.PI/3,endAngle:rotation+Math.PI/3,r:200,hit:false}};
  const direction = rotation + angle * Math.PI / 180;
  const player = {x:150*Math.cos(direction),y:150*Math.sin(direction)};
  let hits = 0;
  for (let i=0;i<Math.ceil(.2/dt);i++) if (BOSS_AI.step(enemy,player,dt).hit) hits++;
  return hits;
}
test('扇形傷害不越過預警邊緣，跨正負PI與低幀率仍命中內側', () => {
  for (const rotation of [0, Math.PI-.05, -Math.PI+.05]) {
    for (const dt of [1/60, .05]) {
      for (const angle of [-70,70]) assert.equal(fanHits(angle,rotation,dt),0,'outside '+angle);
      for (const angle of [-59,0,59]) assert.equal(fanHits(angle,rotation,dt),1,'inside '+angle);
    }
  }
});

function vortexHit(t) {
  const hazard = {kind:'rainVortex',phase:'active',t,duration:.9,
    vortexes:[{x:0,y:0,r:28,hit:false},{x:500,y:0,r:28,hit:false},{x:700,y:0,r:28,hit:false}]};
  return BOSS_AI.step({hp:100,x:0,y:0,hazard},{x:0,y:0},.05).hit;
}
test('水柱只在自身顯示期間傷人，未落下及已消退均無傷害', () => {
  assert.equal(vortexHit(.30),null);
  assert.equal(vortexHit(.60),null);
  assert.equal(vortexHit(.45)?.damage,16);
});

const tutorialStart = game.indexOf('  const tutorialIds =');
const tutorialEnd = game.indexOf('  function replaceList(', tutorialStart);
function tutorialRuntime(saved, stage='rain-port') {
  const storage = new Map([['yokai-tutorial-v1',JSON.stringify(saved)]]);
  const c = {STAGE:{id:stage},window:{CONTENT:{STAGES:{'night-town':{},'rain-port':{}}}},
    touch:false,keys:new Set(),heldCodes:new Set(),joy:null,gpMove:{},bossQ:null,job:null,
    elapsed:0,P:{x:0,y:0},dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}};
  vm.createContext(c);
  // Phase20 moved persistence rules into an early-loaded production module.
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/game-tutorial-rules.js'), 'utf8'), c);
  vm.runInContext(game.slice(tutorialStart,tutorialEnd) + '\nthis.currentTutorial=()=>tutorial;this.saved=()=>JSON.parse(localStorage.getItem("yokai-tutorial-v1"));',c);
  return c;
}
test('舊夜行町教學記錄不吞雨港配送與Boss說明，完成後跨頁保留', () => {
  const c = tutorialRuntime(['pickup','listen','delivery','dash','boss']);
  c.checkTutorial(); assert.equal(c.currentTutorial(),null,'shared movement stays learned');
  c.job={to:{x:0,y:0}}; c.checkTutorial();
  assert.equal(c.currentTutorial()?.id,'delivery'); c.closeTutorial();
  c.job=null;c.bossQ={};c.checkTutorial();assert.equal(c.currentTutorial()?.id,'boss');c.closeTutorial();
  const reload=tutorialRuntime(c.saved());reload.job={to:{x:0,y:0}};reload.bossQ={};reload.checkTutorial();
  assert.equal(reload.currentTutorial(),null,'completed port tutorials stay learned');
  const town=tutorialRuntime(c.saved(),'night-town');town.job={to:{x:0,y:0}};town.bossQ={};town.checkTutorial();
  assert.equal(town.currentTutorial(),null,'legacy town progress preserved');
});
test('明確略過教學的設定仍受尊重', () => {
  const c=tutorialRuntime('skip');c.job={to:{x:0,y:0}};c.bossQ={};c.checkTutorial();
  assert.equal(c.currentTutorial(),null);
});
