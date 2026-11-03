'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=fs.readFileSync('js/game.js','utf8');
const moduleText=fs.readFileSync('js/game-delivery-rules.js','utf8');
function api(){
 const env={window:{}};vm.runInNewContext(moduleText,env);
 return env.window.GAME_DELIVERY_RULES;
}
const houses=[-1800,-1680,-1500,-1200,-950,-720,-510,-480,-450,-200,0,250,470,480,500,610,700,850,
  1100,1300,1450,1650,1651,1750,1850,2450].map((x,i)=>({id:'h'+i,x,y:(i%3)*40,word:{jp:i%2?'カサ':'ねこ'}}));
function oldPickup(list,referenceX,colsBetween){
 const minH=480,maxH=1650;
 const minBetweenHouses=1,targetBetweenHouses=2;
 let reachable=list.filter(h=>colsBetween(h.x,referenceX)>=minBetweenHouses);
 const preferred=reachable.filter(h=>colsBetween(h.x,referenceX)>=targetBetweenHouses&&colsBetween(h.x,referenceX)<=8);
 const pixelFiltered=(preferred.length?preferred:reachable).filter(h=>{
  const dx=Math.abs(h.x-referenceX);return dx>=minH&&dx<=maxH;
 });
 const fallback=list.filter(h=>{
  const dx=Math.abs(h.x-referenceX);
  return dx>=470&&dx<=1750&&colsBetween(h.x,referenceX)>=minBetweenHouses;
 });
 return pixelFiltered.length?pixelFiltered:fallback;
}
function oldDest(list,from,colsBetween) {
 const minH2=480,maxH2=1650,comMinH2=700;
 const reachable2=list.filter(h=>h.id!==from.id&&Math.abs(h.x-from.x)>=minH2&&Math.abs(h.x-from.x)<=maxH2&&colsBetween(h.x,from.x)>=1);
 const pool2=reachable2.length?reachable2:list.filter(h=>h.id!==from.id&&Math.abs(h.x-from.x)>=470&&Math.abs(h.x-from.x)<=1750&&colsBetween(h.x,from.x)>=1);
 const far2=pool2.filter(h=>Math.abs(h.x-from.x)>=comMinH2);
 const near2=pool2.filter(h=>Math.abs(h.x-from.x)<comMinH2);
 return {pool:pool2,far:far2,near:near2};
}
function oldTown(list,from,dist) {
 const reachable=list.filter(h=>h!==from&&dist(h,from)>=580&&dist(h,from)<=1250);
 const pool=reachable.length?reachable:list.filter(h=>h!==from&&dist(h,from)>=420&&dist(h,from)<=1600);
 const far=pool.filter(h=>dist(h,from)>=850),near=pool.filter(h=>dist(h,from)<850);
 return {pool,far,near};
}
const ids=arr=>Array.from(arr,h=>h.id);
function traceFactory(out) {
 return (a,b)=>{out.push([a,b]);return Math.floor(Math.abs(a-b)/400)};
}
function distFactory(out) {
 return (a,b)=>{out.push([a.id,b.id]);return Math.hypot(a.x-b.x,a.y-b.y)};
}
test('Phase10: port pickup candidate order, fallback and chunk callback count identical',()=>{
 const actual=api().portPickupPool;
 for(const ref of [-1500,-720,0,480,700,1650,2800]){
  for(const count of [0,1,5,16,26]){
   const list=houses.slice(0,count);
   const prev=[],now=[];
   const before=JSON.stringify(list);
   const old=oldPickup(list,ref,traceFactory(prev));
   const next=actual(list,ref,traceFactory(now));
   assert.equal(JSON.stringify(ids(next)),JSON.stringify(ids(old)),JSON.stringify({ref,count}));
   assert.equal(JSON.stringify(now),JSON.stringify(prev),'house-column traversal order changed');
   assert.equal(JSON.stringify(list),before,'filtered original list is mutated');
  }
 }
});
test('Phase10: port destination candidate groups preserve far/near order and same-house exclusion',()=>{
 const select=api().portDestinationPools;
 for(const from of houses.slice(0,10))for(const count of [0,1,7,16,26]){
  const list=houses.slice(0,count),before=[],after=[];
  const old=oldDest(list,from,traceFactory(before));
  const got=select(list,from,traceFactory(after));
  for(const name of ['pool','far','near'])
   assert.equal(JSON.stringify(ids(got[name])),JSON.stringify(ids(old[name])),JSON.stringify({from:from.id,count,name}));
  assert.equal(JSON.stringify(after),JSON.stringify(before));
 }
});
test('Phase10: town destination pools preserve distance-callback order and original identity exclusion',()=>{
 const select=api().townDestinationPools;
 for(const from of houses.slice(3,9))for(const count of [0,1,4,16,26]){
  const list=houses.slice(0,count),before=[],after=[];
  const old=oldTown(list,from,distFactory(before));
  const got=select(list,from,distFactory(after));
  for(const name of ['pool','far','near'])
   assert.equal(JSON.stringify(ids(got[name])),JSON.stringify(ids(old[name])));
  assert.equal(JSON.stringify(after),JSON.stringify(before));
 }
});
test('Phase10: all RNG and order mutation remain in game.js; module loaded before main game',()=>{
 const rules=api();
 assert.ok(Object.isFrozen(rules));
 assert.doesNotMatch(moduleText,/Math\.random\s*\(|orders\.push\s*\(|localStorage|WORLD_STATE/);
 assert.match(game,/GAME_DELIVERY_RULES\.portPickupPool\(openHouses, referenceX, colsBetween\)/);
 assert.match(game,/GAME_DELIVERY_RULES\.portDestinationPools\(destinationHouses, from, colsBetween\)/);
 assert.match(game,/GAME_DELIVERY_RULES\.townDestinationPools\(houses, from2, dist\)/);
 assert.match(game,/orders\.push\(\{ from, to, word: chosenWord/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('js/game-delivery-rules.js?v=20261103-delivery-phase10'));
 assert.ok(html.includes('js/game.js?v=20261103-input-phase15'));
 assert.ok(html.indexOf('js/game-delivery-rules.js')<html.indexOf('js/game.js'));
});
