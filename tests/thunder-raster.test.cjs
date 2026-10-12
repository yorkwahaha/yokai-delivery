const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

const SOURCE={
  cloud:'thunder_cloud_vfx.webp',
  mark:'thunder_sigil_vfx.webp',
  strike:'thunder_strike_vfx.webp',
  max:'thunder_strike_lv5_vfx.webp'
};
function harness(){
  const requests=[],uprights=[];let probe=null;
  class ImageMock{
    constructor(){this.naturalWidth=0;this.naturalHeight=0;this.edgeAlpha=0;}
    set src(value){this.url=value;requests.push(this);}
  }
  const gradient={addColorStop(){}},noop=()=>{};
  const canvas=new Proxy({
    drawImage(image){probe=image;},
    getImageData(){
      const data=new Uint8ClampedArray(32*32*4);
      for(let i=3;i<data.length;i+=4)data[i]=probe?.edgeAlpha??0;
      return {data};
    },
    createRadialGradient(){return gradient;},
    createLinearGradient(){return gradient;}
  },{get(o,k){return k in o?o[k]:noop;}});
  const env={Math,Date,Image:ImageMock,
    document:{createElement:()=>({getContext:()=>canvas})},
    console:{warn(){},log(){}},matchMedia:()=>({matches:false})};
  env.window=env;env.VIEWPORT={upright(ctx,x,y,draw){uprights.push([x,y]);draw();}};
  const scope=vm.createContext(env);
  for(const f of ['js/assets.js','js/fx.js','js/skillfx.js'])
    vm.runInContext(fs.readFileSync(f,'utf8'),scope,{filename:f});
  const find=kind=>requests.find(img=>img.url?.includes('/'+SOURCE[kind]));
  function load(kind){const img=find(kind);assert.ok(img,kind+' request');img.naturalWidth=1024;img.naturalHeight=kind==='cloud'?764:kind==='mark'?1024:1024;img.onload();return img;}
  return {env,requests,uprights,find,load};
}
function canvasDraw(){
  const draws=[],scales=[],stack=[],ctx={
    globalAlpha:1,tx:0,ty:0,
    save(){stack.push([this.globalAlpha,this.tx,this.ty]);},
    restore(){[this.globalAlpha,this.tx,this.ty]=stack.pop();},
    translate(x,y){this.tx+=x;this.ty+=y;},rotate(){},
    scale(x,y){scales.push([x,y]);},
    drawImage(img,x,y,w,h){draws.push({img,x:this.tx+x,y:this.ty+y,w,h,a:this.globalAlpha});}
  };
  return {ctx,draws,scales};
}
function advanceFX(env,t=.10){env.SKILLFX.update(t);}
function strikeImages(h,level,storm=false){
  h.env.FX.reset();h.env.SKILLFX.reset();
  h.env.SKILLFX.play('thunder','strike',level,{x:150,y:240,stormChild:storm,delay:0});
}
test('all four pngs are lazy and MAX alone is deferred until Lv5',()=>{
  const h=harness();
  assert.ok(!h.requests.some(img=>img.url?.includes('thunder_')));
  h.env.prepareSkillArt('thunder',2);
  for(const kind of ['cloud','mark','strike'])assert.ok(h.find(kind),kind);
  assert.equal(h.find('max'),undefined);
  for(const kind of ['cloud','mark','strike'])h.load(kind);
  h.env.prepareSkillArt('thunder',5);
  assert.ok(h.find('max'));h.load('max');
  const count=h.requests.filter(img=>img.url?.includes('/thunder_')).length;
  h.env.prepareSkillArt('thunder',5);
  assert.equal(h.requests.filter(img=>img.url?.includes('/thunder_')).length,count);
  assert.equal(h.env.thunderRasterArt('max'),h.find('max'));
});
test('Lv1–Lv4 use distinct upright regular strike and ground sigil without old bolt',()=>{
  const h=harness();
  for(const kind of ['cloud','mark','strike']){h.env.thunderRasterArt(kind);h.load(kind);}
  let bolts=0,old=0;
  h.env.FX.bolt=()=>bolts++;
  h.env.ONMYO_VFX={cloud(){old++},strike(){old++},lightningMark(){old++}};
  const {ctx,draws}=canvasDraw();
  for(let level=1;level<=4;level++){
    strikeImages(h,level);
    draws.length=0;h.uprights.length=0;advanceFX(h.env);
    h.env.SKILLFX.drawArtFx(ctx,true);
    assert.equal(draws.length,1,'single ground mark '+level);
    assert.equal(draws[0].img,h.find('mark'));
    h.env.SKILLFX.drawArtFx(ctx,false);
    assert.ok(draws.some(d=>d.img===h.find('cloud')),'cloud '+level);
    const bolt=draws.find(d=>d.img===h.find('strike'));
    assert.ok(bolt,'normal blue-white strike '+level);
    assert.equal(bolt.y+bolt.h,240,'bolt bottom exactly at world anchor');
    assert.equal(h.uprights.length,2,'upright cloud and bolt');
  }
  assert.equal(bolts,0,'do not draw duplicate FX.bolt');
  assert.equal(old,0,'do not draw old procedural bolt on top');
});
test('Lv5 pairs one cloud from storm with one dedicated MAX strike and ground mark',()=>{
  const h=harness();
  for(const kind of ['cloud','mark','max']){h.env.thunderRasterArt(kind);h.load(kind);}
  const {ctx,draws}=canvasDraw();
  h.env.SKILLFX.play('thunder','storm',5,{x:150,y:240,delay:0});
  h.env.SKILLFX.play('thunder','strike',5,{x:150,y:240,stormChild:true,delay:0});
  advanceFX(h.env);
  h.env.SKILLFX.drawArtFx(ctx,true);
  assert.equal(draws.filter(d=>d.img===h.find('mark')).length,1);
  h.env.SKILLFX.drawArtFx(ctx,false);
  assert.equal(draws.filter(d=>d.img===h.find('cloud')).length,1,'no duplicate sky cloud');
  assert.equal(draws.filter(d=>d.img===h.find('max')).length,1,'unique MAX sprite');
  assert.equal(draws.some(d=>d.img===h.find('strike')),false,'MAX is not enlarged generic bolt');
  const bolt=draws.find(d=>d.img===h.find('max'));
  assert.equal(bolt.y+bolt.h,240);
});
test('failed, opaque and invalid artwork do not suppress matching legacy bolt',()=>{
  for(const mode of ['network','opaque','invalid']){
    const h=harness();
    for(const kind of ['cloud','mark','strike'])h.env.thunderRasterArt(kind);
    for(const kind of ['cloud','mark','strike']){
      const img=h.find(kind);
      if(mode==='network')img.onerror();
      else if(mode==='opaque'){img.edgeAlpha=255;h.load(kind);}
      else img.onload();
    }
    const events=[];
    h.env.ONMYO_VFX={cloud(){events.push('cloud')},
      strike(){events.push('strike')},
      lightningMark(){events.push('mark')}};
    const {ctx,draws}=canvasDraw();strikeImages(h,3);
    advanceFX(h.env);
    h.env.SKILLFX.drawArtFx(ctx,true);
    h.env.SKILLFX.drawArtFx(ctx,false);
    assert.ok(events.includes('strike'),'legacy bolt fallback '+mode);
    assert.ok(events.includes('cloud'),'legacy cloud fallback '+mode);
    assert.ok(events.includes('mark'),'legacy mark fallback '+mode);
    assert.ok(!draws.some(d=>d.img===h.find('strike')));
  }
});
test('strike is upright at 2D, 0.8 transition, 0.60; mark never inverse-scales',()=>{
  const h=harness();h.env.location={search:'?tilt=1'};
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),h.env);
  for(const kind of ['cloud','mark','strike']){h.env.thunderRasterArt(kind);h.load(kind);}
  strikeImages(h,2);advanceFX(h.env);
  const {ctx,draws,scales}=canvasDraw();
  function verify(k){
    scales.length=0;draws.length=0;
    h.env.SKILLFX.drawArtFx(ctx,true);
    assert.equal(draws.length,1);
    assert.equal(scales.length,1,'ground sigil only its own local sprite scale');
    const sigil=draws[0];
    scales.length=0;draws.length=0;
    h.env.SKILLFX.drawArtFx(ctx,false);
    const bolt=draws.find(d=>d.img===h.find('strike'));
    assert.ok(bolt&&Math.abs(bolt.y+bolt.h-240)<1e-9);
    if(k!==1)assert.ok(scales.some(([x,y])=>x===1&&Math.abs(y-1/k)<1e-6),
      'inverse current world tilt k='+k);
    assert.ok(sigil.a>0);
  }
  verify(1);h.env.VIEWPORT.animateTiltScale(.6,.8);
  h.env.VIEWPORT.advanceTilt(.4);assert.ok(Math.abs(h.env.VIEWPORT.tiltScale()-.8)<1e-6);
  verify(.8);h.env.VIEWPORT.advanceTilt(.4);verify(.6);
});
test('alpha and lifetimes fade instead of hard cutoff',()=>{
  const h=harness();for(const kind of ['cloud','mark','strike']){h.env.thunderRasterArt(kind);h.load(kind);}
  const {ctx,draws}=canvasDraw();strikeImages(h,2);
  advanceFX(h.env,.1);h.env.SKILLFX.drawArtFx(ctx,false);
  const bright=draws.find(d=>d.img===h.find('strike'))?.a;assert.ok(bright>.9);
  draws.length=0;advanceFX(h.env,.13);h.env.SKILLFX.drawArtFx(ctx,false);
  const dim=draws.find(d=>d.img===h.find('strike'))?.a;assert.ok(dim<bright);
  advanceFX(h.env,.4);draws.length=0;h.env.SKILLFX.drawArtFx(ctx,false);
  assert.equal(draws.length,0);
});
test('game keeps thunder targeting, Lv5 three-anchors and existing damage path',()=>{
  const game=fs.readFileSync('js/game.js','utf8');
  assert.match(game,/const anchors = candidates\.slice\(0, 3\)/);
  assert.match(game,/dist\(e, anchor\) <= 90/);
  assert.match(game,/hurt\(e, 8 \* b\.dmg \* crit\.mult, crit\.isCrit\)/);
  assert.match(game,/SKILLFX\.play\("thunder", "strike", rank, \{ x: e\.x, y: e\.y, r: radius \}\)/);
});
