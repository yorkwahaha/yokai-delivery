'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const golden=require('./fixtures/game-weather-golden-phase16-20261103.json');
const source=fs.readFileSync('js/game-weather.js','utf8');
const game=fs.readFileSync('js/game.js','utf8');

function load() {
 const env={window:{}};vm.runInNewContext(source,env);
 return env.window.GAME_WEATHER;
}
function render(row) {
 const actions=[];
 const gradient={addColorStop(...a){actions.push(['colorstop',...a]);}};
 const ctx=new Proxy({},{
  set(o,k,value){actions.push(['set',k,String(value===gradient?'gradient':value)]);o[k]=value;return true;},
  get(o,k){
   if(k in o)return o[k];
   return (...args)=>{
    actions.push(['call',k,...args.map(x=>x===gradient?'gradient':x)]);
    if(k==='createRadialGradient')return gradient;
   };
  }
 });
 const vp={left:-100,top:25,right:900,bottom:625,width:1000,height:600};
 const env={ctx,STAGE_VISUAL:{weather:row.wet,rainIntensity:1.2,fog:row.fog},
  STAGE:{id:row.stageId},rainLoad:row.load,W:900,H:600,
  liveMotion:()=>row.motion,viewBounds:()=>({...vp}),
  getRipple:()=>({naturalWidth:512})};
 load().drawStageWeather(row.t,env);
 return crypto.createHash('sha256').update(JSON.stringify(actions)).digest('hex');
}
test('Phase16 48 weather/rain/snow/fog draw-command traces exactly match original renderer',()=>{
 assert.equal(golden.length,48);
 for(const row of golden){
  assert.equal(render(row),row.hash,JSON.stringify(row));
 }
});
test('Phase16 noise hash and module export stay deterministic',()=>{
 const api=load();
 assert.ok(Object.isFrozen(api));
 assert.equal(typeof api.drawStageWeather,'function');
 for(const i of [0,1,2,18,220])for(const salt of [-2,0,3,8]){
  const expected=(()=>{
   let h=Math.imul((i+1)^(salt*0x9e3779b9),0x85ebca6b);
   h^=h>>>13;
   return (h>>>0)/4294967296;
  })();
  assert.equal(api.rainUnit(i,salt),expected);
 }
 assert.doesNotMatch(source,/Math\.random\s*\(|localStorage|document\.|window\.PORT_ART/);
});
test('Phase16 main game keeps live weather/stage and renderer context; HTML order valid',()=>{
 assert.match(game,/GAME_WEATHER\.drawStageWeather\(t, \{/);
 assert.match(game,/rainLoad, W, H,[\s\S]*?liveMotion, viewBounds, getRipple/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/game-weather.js?v=20261103-weather-phase16'));
 assert.ok(html.includes('js/game.js?v=20261103-blade-phase24'));
 assert.ok(html.indexOf('js/game-weather.js')<html.indexOf('js/game.js'));
});
