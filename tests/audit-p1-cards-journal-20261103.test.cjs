'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {scriptUrl}=require('./helpers/script-url.cjs');
const cardsText=fs.readFileSync('js/card-collection.js','utf8');
const bridgeText=fs.readFileSync('js/card-delivery-bridge.js','utf8');
const loc={hostname:'yorkwahaha.github.io',search:''};
const packs=[{id:'cats',name:'Cats',words:[{jp:'ねこ'},{jp:'いぬ'}]},
 {id:'single',name:'Single',words:[{jp:'そら'}]}];
function localStorageShared() {
 const items=new Map();
 return {
  items,
  get length(){return items.size;},
  key(index){return [...items.keys()][index]??null;},
  getItem(k){return items.has(k)?items.get(k):null;},
  setItem(k,v){items.set(k,String(v));},
  removeItem(k){items.delete(k);}
 };
}
function newTab(storage) {
 const context={localStorage:storage,location:loc,URLSearchParams,CONTENT:{WORD_PACKS:{}},crypto:{
  getRandomValues(arr){arr[0]=Math.floor(Math.random()*1000000);return arr;}}};
 context.globalThis=context;
 vm.runInNewContext(cardsText,context,{filename:'card-collection.js'});
 vm.runInNewContext(bridgeText,context,{filename:'card-delivery-bridge.js'});
 return context.CARD_DELIVERY;
}
const stamp=(id,jp,ok=true)=>({id,jp,kind:'delivery',ok});
test('Audit P1-2 two independently loaded tabs accumulate different and identical word marks',()=>{
 const storage=localStorageShared(),a=newTab(storage),b=newTab(storage);
 const oldA=a.openCards(storage,loc,packs),oldB=b.openCards(storage,loc,packs);
 assert.equal(oldA.record(stamp('tabA:1','ねこ')).persisted,true);
 assert.equal(oldB.record(stamp('tabB:1','いぬ')).persisted,true);
 assert.equal(oldA.record(stamp('tabA:2','ねこ')).persisted,true);
 assert.equal(oldB.record(stamp('tabB:2','ねこ')).persisted,true);
 const fresh=newTab(storage).openCards(storage,loc,packs);
 assert.equal(fresh.marks('ねこ'),3);
 assert.equal(fresh.marks('いぬ'),1);
 assert.equal(fresh.snapshot().events['tabA:1'],true);
 assert.equal(fresh.snapshot().events['tabB:2'],true);
 assert.equal(fresh.record(stamp('tabB:2','ねこ')).applied,false);
});
test('Audit P1-2 a racing old projection cannot erase a newer tab immutable event',()=>{
 const storage=localStorageShared(),a=newTab(storage),b=newTab(storage);
 const first=a.openCards(storage,loc,packs),second=b.openCards(storage,loc,packs);
 const baseline=JSON.stringify({v:1,marks:{},events:{},awards:{}});
 assert.equal(first.record(stamp('a-1','ねこ')).persisted,true);
 assert.equal(second.record(stamp('b-1','いぬ')).persisted,true);
 storage.setItem(a.OFFICIAL_KEY,baseline); // emulate stale tab clobbering whole projection
 const restored=newTab(storage).openCards(storage,loc,packs);
 assert.equal(restored.marks('ねこ'),1);
 assert.equal(restored.marks('いぬ'),1);
 assert.equal(restored.snapshot().events['a-1'],true);
 assert.equal(restored.snapshot().events['b-1'],true);
 assert.ok([...storage.items.keys()].filter(k=>k.startsWith(a.OFFICIAL_KEY+':journal-event:')).length>=2);
});
test('Audit P1-2 legacy already-full but unawarded pack is awarded only at next successful delivery',()=>{
 const storage=localStorageShared(),a=newTab(storage);
 storage.setItem(a.OFFICIAL_KEY,JSON.stringify({v:1,marks:{'そら':4},events:{},awards:{}}));
 const bag=a.openCards(storage,loc,packs);
 assert.equal(bag.snapshot().awards.single,undefined);
 assert.equal(bag.record(stamp('fail','そら',false)).newAwards.length,0);
 const result=bag.record(stamp('success','ねこ',true));
 assert.deepEqual(Array.from(result.newAwards),['single']);
 assert.equal(newTab(storage).openCards(storage,loc,packs).snapshot().awards.single,true);
 assert.equal(bag.record(stamp('second','いぬ',true)).newAwards.includes('single'),false);
});
test('Audit P1-2 failed projection save does not report persisted, but journal protects events',()=>{
 const storage=localStorageShared(),a=newTab(storage);
 const original=storage.setItem.bind(storage);
 let fail=true;
 storage.setItem=(k,v)=>{
  if(fail&&k===a.OFFICIAL_KEY)throw new Error('quota');
  original(k,v);
 };
 const bag=a.openCards(storage,loc,packs);
 const result=bag.record(stamp('first-fail','ねこ'));
 assert.equal(result.persisted,false);
 assert.equal(bag.marks('ねこ'),1);
 fail=false;
 assert.equal(bag.record(stamp('later','いぬ')).persisted,true);
 const reload=newTab(storage).openCards(storage,loc,packs);
 assert.equal(reload.marks('ねこ'),1);
 assert.equal(reload.marks('いぬ'),1);
});
test('Audit P1-2 falls back to before-write storage refresh in basic legacy storage mocks',()=>{
 const data=new Map();
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
 const a=newTab(storage),b=newTab(storage);
 const first=a.openCards(storage,loc,packs),second=b.openCards(storage,loc,packs);
 first.record(stamp('one','ねこ'));
 second.record(stamp('two','ねこ'));
 assert.equal(newTab(storage).openCards(storage,loc,packs).marks('ねこ'),2);
});

test('Audit P1-2 browser cache key for card journal',()=>{
 assert.ok(scriptUrl('card-delivery-bridge'));
});
