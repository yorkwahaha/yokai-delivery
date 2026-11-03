'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {loadGame}=require('./helpers/game-runtime.cjs');
const {scriptUrl}=require('./helpers/script-url.cjs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('tests/fixtures/needle-seek-original-phase30.js','utf8')+
  '\nthis.original=originalNeedleSeekTarget;',context);
vm.runInNewContext(fs.readFileSync('js/game-combat-math.js','utf8'),context);
const old=context.original;
const current=()=>context.window.GAME_COMBAT_MATH.needleSeekTarget;
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function parity(enemies,needle){
  assert.strictEqual(current()(enemies,needle),old(enemies,needle),
    'target identity (not merely equal coordinates) must match pre-extraction');
}

test('Phase30 20,000 seeded needles preserve exact nearest eligible target',()=>{
  const r=rng(30030);
  for(let run=0;run<20000;run++){
    const x=24.5,y=-18.25;
    const enemies=Array.from({length:run%25},(_,i)=>{
      const a=r()*Math.PI*2;
      const radius=[0,100,480,Math.floor(r()*700)][(run+i)%4];
      return Object.freeze({
        id:i,x:x+Math.cos(a)*radius,y:y+Math.sin(a)*radius,
        hp:[-1,0,1,5,NaN][(run+i)%5],
        shield:i%7===0,vanish:run%11===0&&i%3===0,done:run%13===0&&i%5===0
      });
    });
    const hits=new Set(enemies.filter((e,i)=>(run+i)%7===0));
    const needle=Object.freeze({
      x,y,hits,
      seekRange:[0,40,480,700,Infinity,NaN,-1,undefined][run%8]
    });
    parity(Object.freeze(enemies),needle);
  }
});

test('Phase30 strict range boundary, first-equal-distance tie, hits and null behavior',()=>{
  const needle={x:0,y:0,seekRange:100,hits:new Set()};
  const enemies=Object.freeze([
    {id:'at-boundary',x:100,y:0,hp:8},
    {id:'first',x:80,y:0,hp:8},
    {id:'tie',x:-80,y:0,hp:8},
    {id:'closer',x:30,y:0,hp:0}
  ].map(Object.freeze));
  parity(enemies,needle);
  assert.strictEqual(current()(enemies,needle),enemies[1],
    'strict < means at-boundary is excluded and first equal-distance wins');
  needle.hits.add(enemies[1]);
  parity(enemies,needle);
  assert.strictEqual(current()(enemies,needle),enemies[2]);
  needle.hits.add(enemies[2]);
  assert.strictEqual(current()(enemies,needle),null);
  for(const limit of [undefined,0,NaN,-1,Infinity])parity(enemies,{...needle,seekRange:limit});
});

test('Phase30 retains old hp-only eligibility; leaves enemy and projectile state immutable',()=>{
  const shield=Object.freeze({id:'shield',x:8,y:0,hp:1,shield:true,vanish:true,done:true});
  const normal=Object.freeze({id:'normal',x:20,y:0,hp:1});
  const enemies=Object.freeze([shield,normal]);
  const needle=Object.freeze({x:0,y:0,seekRange:100,hits:new Set()});
  parity(enemies,needle);
  assert.strictEqual(current()(enemies,needle),shield,
    'do not silently change shipped eligibility within a pure-extraction phase');
  assert.equal(needle.hits.size,0);
  assert.ok(Object.isFrozen(context.window.GAME_COMBAT_MATH));
});

test('Phase30 real game needle mut_seek keeps targeting the nearer foe',()=>{
  const g=loadGame({seed:30030,stage:'night-town'});
  g.start();g.stopSpawns();g.clearOrders();g.clearEnemies();g.clearSolids();
  g.combatScene('needle',[
    {id:'far',dx:180,dy:0,hp:10000,max:10000},
    {id:'near',dx:120,dy:0,hp:10000,max:10000}
  ],[],1);
  g.setBuildMutations(['mut_seek']);
  g.armWeapons();g.weapons(.1);
  const needles=g.snapshot().needles;
  assert.ok(needles.length>0,'real runtime emitted a needle volley');
  assert.ok(needles.every(n=>n.target?.id==='near'));
});

test('Phase30 only moves target selection; cooldown, homing and damage remain in game.js',()=>{
  const game=fs.readFileSync('js/game.js','utf8');
  const math=fs.readFileSync('js/game-combat-math.js','utf8');
  assert.match(game,/GAME_COMBAT_MATH\.needleSeekTarget\(enemies, nd\)/);
  assert.match(game,/nd\.retargetT = 0\.12/);
  assert.match(game,/nd\.ang \+= turn/);
  assert.match(game,/nd\.vx = Math\.cos\(nd\.ang\) \* nd\.speed/);
  assert.doesNotMatch(math,/Math\.random\s*\(/);
});

test('Phase30 HTML loads pure math before runtime with fresh cache revisions',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const combat=scriptUrl('game-combat-math');
  const game=scriptUrl('game');
  assert.ok(html.indexOf(combat)>=0 && html.indexOf(combat)<html.indexOf(game));
  assert.notEqual(combat,'js/game-combat-math.js?v=20261103-combat-auditfix');
  assert.notEqual(game,'js/game.js?v=20261103-dragon-phase29');
});
