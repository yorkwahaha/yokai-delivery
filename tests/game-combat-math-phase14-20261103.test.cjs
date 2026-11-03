'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync('js/game.js','utf8');
const combat=fs.readFileSync('js/game-combat-math.js','utf8');
const originalBoss=(index,hpBase,oilBase,stage)=>{
 const role=['mid','mid','gate','final'][index]||'mid';
 let hp=hpBase[index];
 if(stage&&stage.id==='night-town'&&typeof hp==='number')
  hp=Math.round(hp*(role==='final'?.65:role==='gate'?.75:.5));
 return {hp,oil:oilBase[index],quiz:role!=='gate',role};
};
const originalChance=(base,step,critLvl,defaultCrit)=>{
 let chance;
 if(typeof base==='object'&&base!==null){
  if(typeof base.critChance==='number')chance=base.critChance;
  else {
   const lvl=typeof base.critLvl==='number'?base.critLvl:(defaultCrit||0);
   const bVal=typeof step==='number'?step:.2;
   const sVal=typeof critLvl==='number'?critLvl:.15;
   chance=Math.min(.5,bVal+lvl*sVal);
  }
 }else if(typeof step==='undefined')chance=Math.min(.5,base||0);
 else chance=Math.min(.5,base+(critLvl||0)*step);
 return chance;
};
function setup(stage='night-town',defaultCrit=1){
 const env={window:{},CFG:{BOSS_HP_BASE:[300,650,1100,1400],BOSS_OIL_REWARD:[35,35,20,35]},
  STAGE:stage?{id:stage}:null,b:{crit:defaultCrit},calls:0};
 const rng=Object.create(Math);rng.random=()=>{env.calls++;return .31};
 env.Math=rng;
 vm.runInNewContext(combat,env);
 const a=game.indexOf('  function bossBlueprint(');
 const b=game.indexOf('\n  const wMax = ',a);
 assert.ok(a>=0&&b>a);
 vm.runInNewContext(game.slice(a,b)+'\nthis.wrap={bossBlueprint,rollCrit};',env);
 return env;
}
test('Phase14 Boss blueprint role, HP and oil unchanged at every boss index',()=>{
 for(const stage of ['night-town','rain-port',null]){
  const env=setup(stage);
  for(const i of [-1,0,1,2,3,4,8]){
   const old=originalBoss(i,env.CFG.BOSS_HP_BASE,env.CFG.BOSS_OIL_REWARD,env.STAGE);
   const fresh=env.wrap.bossBlueprint(i);
   assert.equal(JSON.stringify(fresh),JSON.stringify(old),JSON.stringify({stage,i}));
  }
 }
});
test('Phase14 crit-chance overloads exactly preserve old input defaults and caps',()=>{
 const env=setup('night-town',2);
 const argsList=[
  [undefined],[null],[0],[0.2],[0.6],[-.3],
  [0.3,undefined],[0.2,.15],[0.2,.15,3],[0.2,0,0],[0.2,.2,undefined],
  [{critChance:.31}],[{critChance:0}],[{critChance:.9}],[{critChance:NaN}],
  [{critLvl:1}],[{critLvl:1},.25],[{critLvl:3},.2,.1],
  [{critLvl:undefined},undefined,undefined],
  [{critLvl:2},undefined,0],[{},.45,2],
  [{critChance:'0.5',critLvl:2}],[{critChance:-.1}],[{critChance:Infinity}]
 ];
 for(const args of argsList) {
  const crit=args.length>2 && args[2]!==undefined?args[2]:env.b.crit;
  const previous=originalChance(args[0],args[1],crit,env.b.crit);
  const now=env.window.GAME_COMBAT_MATH.critChance(args[0],args[1],crit,env.b.crit);
  assert.ok(Object.is(now,previous),JSON.stringify({args,now,previous}));
  const before=env.calls;
  const actual=env.wrap.rollCrit(...args);
  assert.equal(env.calls,before+1,'exactly one RNG draw per crit roll');
  const expectedCrit=.31<previous;
  assert.equal(actual.isCrit,expectedCrit,JSON.stringify({args,previous}));
  assert.equal(actual.mult,expectedCrit?1.8:1);
 }
});
test('Phase14 pure math module stays immutable and does not draw RNG or mutate combat state',()=>{
 const env=setup();
 assert.ok(Object.isFrozen(env.window.GAME_COMBAT_MATH));
 assert.equal(typeof env.window.GAME_COMBAT_MATH.critChance,'function');
 assert.equal(typeof env.window.GAME_COMBAT_MATH.bossBlueprint,'function');
 assert.doesNotMatch(combat,/Math\.random\s*\(|enemies\.push\s*\(|localStorage|document\./);
 assert.match(game,/const isCrit = Math\.random\(\) < chance/);
});
test('Phase14 browser loads combat helper before main game at identical cache revision',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const helper='js/game-combat-math.js?v=20261103-combat-phase28';
 const main='js/game.js?v=20261103-cinder-phase28';
 assert.ok(html.includes(helper)&&html.includes(main));
 assert.ok(html.indexOf(helper)<html.indexOf(main));
 assert.ok(html.includes('js/game-catalog.js?v=20261103-catalog-phase13'));
});
