"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const bridge=require("../js/card-delivery-bridge.js");

const pack=[{id:"p",name:"測試套卡",words:[{jp:"ねこ"},{jp:"いぬ"}]}];
const loc={hostname:"example.com",search:""};
const lock=async (_name,_opts,fn)=>fn({name:"locked"});
function storage(){
  const m=new Map();
  const gate={fails:0,blockBaseline:false};
  return {
    gate,keys:m,
    get length(){return m.size;},
    key:i=>[...m.keys()][i]??null,
    getItem:k=>m.get(k)??null,
    setItem(k,v){
      if(gate.blockBaseline&&k.endsWith(":journal-base"))throw Error("quota");
      m.set(k,String(v));
    },
    removeItem(k){
      if(gate.fails>0){gate.fails--;throw Error("interrupted");}
      m.delete(k);
    }
  };
}
function addEvents(s,n){
  const k=bridge.OFFICIAL_KEY,pre=k+":journal-event:";
  s.setItem(k+":journal-base",JSON.stringify({v:1,marks:{},events:{},awards:{}}));
  for(let i=0;i<n;i++){
    const id="delivery:e:"+String(i).padStart(4,"0");
    s.setItem(pre+encodeURIComponent(id),JSON.stringify({
      id,jp:i%2===0?"ねこ":"いぬ",kind:"delivery",ok:i%13!==0
    }));
  }
}
function state(s){return bridge.openCards(s,loc,pack).snapshot();}
const visible=s=>JSON.stringify({marks:s.marks,events:s.events,awards:s.awards});
const eventsCount=s=>[...s.keys.keys()].filter(k=>k.startsWith(bridge.OFFICIAL_KEY+":journal-event:")).length;

test("圖鑑 200 筆壓縮保留印記、套卡獎勵及去重，跨頁仍可繼續累積",async()=>{
  const s=storage();addEvents(s,230);
  const before=visible(state(s));
  const result=await bridge.compactCards(s,loc,pack,lock);
  assert.equal(result.ok,true);
  assert.equal(result.removed,200);
  assert.equal(eventsCount(s),30);
  assert.equal(visible(state(s)),before,"checkpoint must reproduce the same projection");
  const bag=bridge.openCards(s,loc,pack);
  assert.equal(bag.record({id:"delivery:new",jp:"ねこ",kind:"delivery",ok:true}).persisted,true);
  assert.equal(bag.record({id:"delivery:new",jp:"ねこ",kind:"delivery",ok:true}).reason,"duplicate");
  assert.equal(bag.marks("ねこ"),4);
});

test("另一分頁在壓縮後追加事件，舊袋子重讀時不會覆蓋資料",async()=>{
  const s=storage();addEvents(s,24);
  const a=bridge.openCards(s,loc,pack),b=bridge.openCards(s,loc,pack);
  const before=state(s);
  assert.equal((await bridge.compactCards(s,loc,pack,lock)).removed,24);
  assert.equal(visible(state(s)),visible(before));
  b.record({id:"delivery:tab-b",jp:"ちず",kind:"delivery",ok:true});
  a.record({id:"delivery:tab-a",jp:"ちず",kind:"delivery",ok:true});
  assert.equal(state(s).marks["ちず"],2);
  assert.equal(state(s).awards.p,true);
});

test("先持久化檢查點再刪鍵：中途失敗也不遺失任何印記",async()=>{
  const s=storage();addEvents(s,50);
  const before=visible(state(s));
  s.gate.fails=1;
  const first=await bridge.compactCards(s,loc,pack,lock);
  assert.equal(first.ok,false);
  assert.equal(first.reason,"interrupted");
  assert.equal(visible(state(s)),before);
  const second=await bridge.compactCards(s,loc,pack,lock);
  assert.equal(second.ok,true);
  assert.equal(eventsCount(s),0);
  assert.equal(visible(state(s)),before);
});

test("不支援刪鍵或配額不足時不清理事件，也不影響舊存檔",async()=>{
  const s=storage();addEvents(s,30);
  const before=visible(state(s));
  const noDelete=Object.assign({},s,{removeItem:undefined});
  assert.equal((await bridge.compactCards(noDelete,loc,pack,lock)).reason,"unsupported");
  assert.equal(eventsCount(s),30);
  s.gate.blockBaseline=true;
  assert.equal((await bridge.compactCards(s,loc,pack,lock)).reason,"checkpoint_write_failed");
  assert.equal(eventsCount(s),30);
  assert.equal(visible(state(s)),before);
});
