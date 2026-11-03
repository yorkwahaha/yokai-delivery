'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync('js/game.js','utf8');
const geo=fs.readFileSync('js/game-geometry.js','utf8');
const oldImpl=function houseColumnsBetween(x1,x2,WORLD_STATE,runBounds) {
 const lo=Math.min(x1,x2),hi=Math.max(x1,x2),xs=new Set();
 if(!runBounds||!WORLD_STATE)return 0;
 const cx0=Math.floor(lo/WORLD_STATE.chunkWidth),cx1=Math.floor(hi/WORLD_STATE.chunkWidth);
 const cy0=Math.floor(runBounds.minY/WORLD_STATE.chunkHeight),cy1=Math.floor(runBounds.maxY/WORLD_STATE.chunkHeight);
 for(let cx=cx0;cx<=cx1;cx++){
  for(let cy=cy0;cy<=cy1;cy++){
   const chunk=WORLD_STATE.getChunk(cx,cy);
   if(!chunk||!chunk.houses)continue;
   for(const h of chunk.houses){
    if(h.x>lo&&h.x<hi)xs.add(Math.round(h.x/50)*50);
   }
  }
 }
 return xs.size;
};
function gameHelper(world,bounds) {
 const env={window:{},WORLD_STATE:world,runBounds:bounds};
 vm.runInNewContext(geo,env);
 const a=game.indexOf('  function houseColumnsBetween('), b=game.indexOf('\n  // Rain-port uses',a);
 assert.ok(a>=0&&b>a);
 vm.runInNewContext(game.slice(a,b)+'\nthis.houseColumnsBetween=houseColumnsBetween;',env);
 return env;
}
test('Phase6 pure column count excludes endpoints before rounding, dedupes by 50px',()=>{
 const env={window:{}};vm.runInNewContext(geo,env);
 const count=env.window.GAME_GEOMETRY.countInteriorHouseColumns;
 assert.ok(Object.isFrozen(env.window.GAME_GEOMETRY));
 assert.equal(count([191,200,249,250,1600,1610],191,1610),3);
 assert.equal(count([191,200,249,250,1600,1610],1610,191),3);
 assert.equal(count([200,200,201,225,249],199,250),2);
 assert.equal(count([-51,-49,-25,-24,0,25],-50,0),2);
 assert.equal(count([99,100,100.1,101],100,100),0);
 assert.equal(count([],0,100),0);
});
test('Phase6 wrapper matches original chunk scanning, duplicate Y rows, negative coordinates',()=>{
 const chunks=new Map();
 const width=600,height=350;
 const keys=[[-2,-1],[-2,0],[-1,0],[0,0],[0,1],[1,0],[2,1]];
 const coords=[-952,-949,-601,-299,-250,-210,-201,-200,-149,-50,-25,0,49,50,51,120,175,191,200,225,249,250,300,349,499,600,901,1600,1610];
 for(let i=0;i<keys.length;i++){
  const [cx,cy]=keys[i];
  chunks.set(cx+':'+cy,{houses:coords.filter((_,j)=>j%keys.length===i).map(x=>({x}))});
 }
 function getWorld(){return {chunkWidth:width,chunkHeight:height,getChunk:(cx,cy)=>chunks.get(cx+':'+cy)||null};}
 for(const bounds of [null,{minY:-400,maxY:400},{minY:0,maxY:800}]){
  const world=getWorld(),run=gameHelper(world,bounds);
  for(const [a,b] of [[0,600],[-1000,1000],[191,1610],[1610,191],[-350,-35],[100,100],[1000,1700]]){
   const expected=oldImpl(a,b,world,bounds);
   assert.equal(run.houseColumnsBetween(a,b),expected,JSON.stringify({a,b,bounds}));
  }
 }
});
test('Phase6 keeps world chunk cache access in main game and loads updated geometry before game',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/game-geometry.js?v=20261103-input-phase15'));
 assert.ok(html.includes('js/game.js?v=20261103-p1-hotfix-a'));
 assert.ok(html.indexOf('js/game-geometry.js')<html.indexOf('js/game.js'));
 assert.match(game,/WORLD_STATE\.getChunk\(cx, cy\)/);
 assert.match(game,/GAME_GEOMETRY\.countInteriorHouseColumns\(houseXs, lo, hi\)/);
});
