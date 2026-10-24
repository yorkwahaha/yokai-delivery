'use strict';
// 真正執行 UI.drawCharmSwap，避免以複製的模擬公式冒充產品測試。
// Canvas stub 驗座標/文字呼叫；視覺圖像本身仍需 Chrome 與人眼。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CHARM_IDS = ['power','step','gather','cadence','reach','guard'];
const PASSIVE_IDS = ['shield','dmg','rate','crit','spd','dash','oil_max','mag'];
const ART = [
  ...CHARM_IDS.map(id => 'assets/img/ui/charm-passive/hud_omamori_' + id + '.webp'),
  ...PASSIVE_IDS.map(id => 'assets/img/ui/passive/hud_passive_' + id + '.webp')
];

test('14 款不同圖示均為真正 RIFF/WEBP，不接受 JPEG 換副檔名', () => {
  const hashes = [];
  for (const rel of ART) {
    const data = fs.readFileSync(path.join(ROOT, rel));
    assert.equal(data.toString('latin1', 0, 4), 'RIFF', rel);
    assert.equal(data.toString('latin1', 8, 12), 'WEBP', rel);
    assert.ok(data.length > 200, rel + ' 空檔');
    hashes.push(crypto.createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(new Set(hashes).size, ART.length, '不同圖示不能引用相同檔案');
});

function makeCanvas(w, h) {
  const text = [], rect = [];
  const gradient = () => ({addColorStop(){}});
  const target = {
    canvas: {width:w,height:h},
    measureText: value => ({width:String(value).length * 8,actualBoundingBoxAscent:10,actualBoundingBoxDescent:2}),
    fillText: (value,x,y,maxWidth) => text.push({value:String(value),x,y,maxWidth}),
    fillRect: (x,y,width,height) => rect.push({x,y,width,height}),
    createLinearGradient: gradient,createRadialGradient:gradient,
    getTransform: () => ({a:1,b:0,c:0,d:1,e:0,f:0})
  };
  return {ctx:new Proxy(target,{get(obj,k){return k in obj ? obj[k] : () => {};}}),text,rect};
}
function loadRealUi(w,h) {
  const window = {
    VIEWPORT: {
      bounds: () => ({left:0,top:0,right:w,bottom:h,width:w,height:h}),
      get: () => ({scale:1})
    },
    FX: {glow(){}}
  };
  const source = fs.readFileSync(path.join(ROOT,'js/ui.js'),'utf8');
  vm.runInNewContext(source,{window,location:{search:''},URLSearchParams,console,Date,Math},{filename:'js/ui.js',timeout:5000});
  assert.equal(typeof window.UI.drawCharmSwap,'function');
  return window.UI;
}
function disjoint(a,b) {
  return a.x+a.w <= b.x || b.x+b.w <= a.x || a.y+a.h <= b.y || b.y+b.h <= a.y;
}

for (const [w,h] of [[640,360],[844,390],[1280,720]]) {
  test('產品 drawCharmSwap 真呼叫，缺少 UI_CHARM_META 亦可讀：' + w + 'x' + h, () => {
    const ui=loadRealUi(w,h);
    const {ctx,text}=makeCanvas(w,h);
    const charms=[
      {id:'charm_power',name:'力紋守',level:1},
      {id:'charm_reach',name:'遠霞守',level:3},
      {id:'charm_cadence',name:'疾奏守',level:2}
    ];
    const hits=ui.drawCharmSwap(ctx,{charms,pending:{id:'charm_step',name:'風步守'},selectedIndex:1});
    assert.deepEqual(Array.from(hits,h=>h.id),['swap_0','swap_1','swap_2','swap_discard']);
    for(const hit of hits){
      assert.ok(hit.w>=44&&hit.h>=44,hit.id+' 熱區不足44');
      assert.ok(hit.x>=0&&hit.y>=0&&hit.x+hit.w<=w&&hit.y+hit.h<=h,hit.id+' 超出畫面');
    }
    for(let i=0;i<hits.length;i++) for(let j=i+1;j<hits.length;j++) assert.ok(disjoint(hits[i],hits[j]),hits[i].id+' 與 '+hits[j].id+' 重疊');
    const painted=text.map(c=>c.value).join('|');
    for(const label of ['御守替換','風步守','力紋守 Lv1','遠霞守 Lv3','射程/爆炸半徑 +30%','有效攻速 +0.50','放棄'])
      assert.ok(painted.includes(label),'漏畫文字：'+label);
    assert.ok(text.filter(c=>c.value.includes('射程/爆炸')).every(c=>c.maxWidth<=110),'效果字寬沒有限制');
  });
}

test('空御守槽與未知御守不會拋 ReferenceError', () => {
  const ui=loadRealUi(844,390);
  const {ctx}=makeCanvas(844,390);
  assert.equal(ui.drawCharmSwap(ctx,{charms:[null,{id:'charm_unknown',name:'未知御守',level:1},null],pending:{id:'charm_guard',name:'紙甲守'}}).length,4);
});
