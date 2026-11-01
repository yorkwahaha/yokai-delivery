'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
function boot(w,h){
  const draws=[],labels=[];
  class MockImage{
    constructor(){this.naturalWidth=0;this.naturalHeight=0;this.onload=null;this.complete=false;}
    set src(v){this._src=v;this.complete=true;this.naturalWidth=v.includes('/omamori_')?320:900;this.naturalHeight=v.includes('/omamori_')?640:720;this.onload?.();}
    get src(){return this._src;}
  }
  const window={location:{hostname:'127.0.0.1'},Image:MockImage,VIEWPORT:{
    bounds:()=>({left:0,top:0,right:w,bottom:h,width:w,height:h}),
    hudBounds:()=>({left:0,top:0,right:w,bottom:h,width:w,height:h}),
    get:()=>({scale:1})},FX:{glow(){}},innerWidth:w,innerHeight:h,ART:{hud_lantern_oil:{naturalWidth:384,naturalHeight:512}}};
  const gradient=()=>({addColorStop(){}});
  const base={canvas:{width:w,height:h},measureText:t=>({width:String(t).length*9}),
    createLinearGradient:gradient,createRadialGradient:gradient,fillText:(v,x,y,maxWidth)=>labels.push({v:String(v),x,y,maxWidth}),
    drawImage:(...args)=>{if(args.length===5)draws.push({src:args[0].src||'',x:args[1],y:args[2],w:args[3],h:args[4]});}};
  const ctx=new Proxy(base,{get:(o,k)=>k in o?o[k]:()=>{}});
  vm.runInNewContext(src,{window,document:{fonts:{check:()=>true}},location:{search:''},URLSearchParams,console,Date,Math},{filename:'js/ui.js',timeout:4000});
  return {ctx,ui:window.UI,draws,labels};
}
const charms=[
{id:'charm_power',name:'力紋守',level:1},
{id:'charm_reach',name:'遠霞守',level:3},
{id:'charm_cadence',name:'疾奏守',level:2}];
for(const [w,h] of [[640,360],[844,390],[1280,720]]){
  test('B10 illustrated menu portrait aspect and distinct tappable regions '+w+'x'+h,()=>{
    const {ctx,ui,draws,labels}=boot(w,h);
    const hits=ui.drawCharmSwap(ctx,{charms,pending:{id:'charm_step',name:'風步守'},selectedIndex:1});
    assert.deepEqual(Array.from(hits,x=>x.id),['swap_0','swap_1','swap_2','swap_discard']);
    for(const hit of hits){assert.ok(hit.w>=44&&hit.h>=44);assert.ok(hit.x>=0&&hit.y>=0&&hit.x+hit.w<=w&&hit.y+hit.h<=h);}
    const portraits=draws.filter(d=>d.src.includes('/b11/omamori_'));
    assert.equal(portraits.length,4,'new large banner and 3 existing art portraits');
    for(const d of portraits){assert.ok(d.w>15&&d.h>40);assert.ok(Math.abs(d.w/d.h-.5)<.002,'no squashed portrait '+d.src);}
    assert.ok(labels.some(t=>t.v.includes('御守替換')));
    assert.ok(labels.some(t=>t.v.includes('風步守')));
  });
  test('B10 lantern rail remains outside oil lantern painting '+w+'x'+h,()=>{
    const {ctx,ui,draws}=boot(w,h);
    ui.drawCharmHud(ctx,{charms,maxSlots:3});
    const portraits=draws.filter(d=>d.src.includes('/b11/omamori_'));
    assert.equal(portraits.length,3);
    const lanternRight=14+168*(384/512);
    for(const d of portraits){assert.ok(d.x>=lanternRight+7,'overlaps lantern');assert.ok(d.x+d.w<=w);assert.ok(Math.abs(d.w/d.h-.5)<.002);}
    assert.ok(portraits[0].y+portraits[0].h<portraits[1].y);
  });
}
test('B10 original B9 source and B10 cropped sprites preserved, nine passive symbols unchanged',()=>{
 const ui=src;
 for(const id of ['power','step','gather','cadence','reach','guard']){
  for(const gen of ['b9','b10']){
   const file=fs.readFileSync(path.join(root,'assets/img/ui/charm-passive',gen,'omamori_'+id+'.webp'));
   assert.equal(file.toString('ascii',0,4),'RIFF');
  }
 }
 assert.match(ui,/assets\/img\/ui\/b13\/passive_/);
 assert.doesNotMatch(ui,/illustratedCharms\[key\].*\.naturalHeight \* \(cardW\//);
});
