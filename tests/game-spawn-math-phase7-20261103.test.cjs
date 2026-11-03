'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/game-spawn-math.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');

function original(atElapsed,power,o) {
 const {dawn,config,difficulty,spawnIntervalScale,spawnCountBonus,nightTownNormal,clamp}=o;
 const cappedElapsed=Math.min(atElapsed,dawn);
 let interval=config.spawnInterval(cappedElapsed*difficulty.timeScale)*spawnIntervalScale*difficulty.intervalScale;
 let count=Math.max(1,config.spawnCount(cappedElapsed)+spawnCountBonus);
 if(nightTownNormal&&cappedElapsed<150) {
  if(cappedElapsed<90) {
   interval=1.5-0.42*clamp(cappedElapsed/90,0,1);
   count=1;
  }else{
   interval=2.16+(interval-2.16)*((cappedElapsed-90)/60);
   count=2;
  }
 }
 return {
  tier:config.enemyTier(Math.min(atElapsed,config.RUN_SECONDS)*difficulty.timeScale,power*difficulty.powerScale),
  interval,count
 };
}
function load(){
 const env={window:{}};vm.runInNewContext(source,env);
 return env.window.GAME_SPAWN_MATH;
}
function makeOptions(normal,difficulty,logged) {
 return {
  dawn:600,
  config:{
   RUN_SECONDS:600,
   spawnInterval(t){logged.push(['interval',t]);return 4.4/(1+t/800);},
   spawnCount(t){logged.push(['count',t]);return Math.floor(t/50);},
   enemyTier(t,p){logged.push(['tier',t,p]);return Math.ceil((1+t/150)*(1+p/100));}
  },
  difficulty,
  spawnIntervalScale:1.15,spawnCountBonus:-1,
  nightTownNormal:normal,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n))
 };
}
test('Phase7: spawn pacing is frozen and has no stage/run mutable globals or RNG',()=>{
 const api=load();assert.ok(Object.isFrozen(api));
 assert.equal(typeof api.mobPacing,'function');
 assert.doesNotMatch(source,/Math\.random\s*\(|window\.(?!GAME_SPAWN_MATH)|localStorage|document\.|enemies\.push\s*\(/);
 assert.match(game,/window\.GAME_SPAWN_MATH\.mobPacing\(atElapsed, power/);
});
test('Phase7: same tier, spawn interval, count and call ordering at both stage modes',()=>{
 const api=load();
 for(const normal of [false,true])for(const difficulty of [
  {timeScale:1,powerScale:1,intervalScale:1},
  {timeScale:.9,powerScale:.85,intervalScale:1.15}
 ]){
  for(const elapsed of [-2,0,.5,10,89.99,90,90.01,120,149.99,150,200,480,600,950]){
   for(const power of [0,5,50,250]){
    const before=[],after=[];
    const expected=original(elapsed,power,makeOptions(normal,difficulty,before));
    const actual=api.mobPacing(elapsed,power,makeOptions(normal,difficulty,after));
    assert.equal(JSON.stringify(actual),JSON.stringify(expected),
      JSON.stringify({normal,elapsed,power,actual,expected}));
    assert.equal(JSON.stringify(after),JSON.stringify(before),'callback evaluation order unchanged');
   }
  }
 }
});
test('Phase7: does not mutate caller stage inputs and supports out-of-band high times',()=>{
 const api=load(),calls=[];
 const opts=makeOptions(true,{timeScale:.8,powerScale:.77,intervalScale:1.2},calls);
 const before=JSON.stringify({dawn:opts.dawn,difficulty:opts.difficulty,scale:opts.spawnIntervalScale});
 assert.equal(JSON.stringify(api.mobPacing(1e9,10,opts)),
   JSON.stringify(original(1e9,10,makeOptions(true,{timeScale:.8,powerScale:.77,intervalScale:1.2},[]))));
 assert.equal(JSON.stringify({dawn:opts.dawn,difficulty:opts.difficulty,scale:opts.spawnIntervalScale}),before);
});
test('Phase7: browser loads spawn formula before game and preserves other module versions',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const spawn='js/game-spawn-math.js?v=20261103-spawn-phase9';
 const game='js/game.js?v=20261103-summary-phase18';
 assert.ok(html.includes(spawn)&&html.includes(game));
 assert.ok(html.indexOf(spawn)<html.indexOf(game));
 assert.ok(html.includes('js/game-geometry.js?v=20261103-input-phase15'));
});
