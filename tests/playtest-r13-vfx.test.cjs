'use strict';
// 第一關 R13：動態粒子需在圖片分支仍發生，避免只貼一張靜態圖。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadSkillFx() {
  const emitted = [];
  const img = {naturalWidth:256,naturalHeight:256};
  const window = {
    ART:{}, VIEWPORT:{tiltScale:()=>0.6},
    ofudaRasterArt:kind=>['hit','max','main'].includes(kind)?img:null,
    barrierCoreArt:()=>img
  };
  const FX = {
    count:n=>n, rnd:(a,b)=>(a+b)/2, allowsMotion:()=>true,
    emit:(kind,color,o)=>emitted.push({kind,color,...o})
  };
  const context = vm.createContext({window,FX,Math,console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/skillfx.js'),'utf8'),context);
  return {fx:window.SKILLFX,emitted};
}

test('陰陽符 Lv1-5 使用命中圖片時仍有完整向外爆裂的粒子與衝擊波',()=>{
  const {fx,emitted}=loadSkillFx();
  for(let rank=1;rank<=5;rank++){
    emitted.length=0;
    fx.play('boom','hit',rank,{x:130,y:150,target:{hp:20}});
    const movers=emitted.filter(p=>p.kind==='seal'||p.kind==='shard');
    const rings=emitted.filter(p=>p.kind==='edge');
    assert.ok(movers.length>=12,'Lv'+rank+' must explode outward, not just show a raster');
    assert.ok(rings.length>=2,'Lv'+rank+' must have shockwave');
    assert.ok(movers.some(p=>p.vx>10) && movers.some(p=>p.vx< -10),'Lv'+rank+' spreads horizontally');
    assert.ok(movers.some(p=>p.vy>10) && movers.some(p=>p.vy< -10),'Lv'+rank+' spreads vertically');
  }
});

test('戰鬥淨化靈陣不再誤用交貨結界噴湧光霧',()=>{
  const {fx,emitted}=loadSkillFx();
  for(let rank=1;rank<=5;rank++){
    emitted.length=0;
    fx.play('barrier','cast',rank,{x:50,y:80,r:140});
    assert.ok(!emitted.some(p=>p.kind==='flame'&&p.vy< -30&&p.sy>=1.8));
  }
});
