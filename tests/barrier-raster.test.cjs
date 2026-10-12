const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function harness(withSkills=true){
  const requested=[];
  let probeImage=null;
  class ImageMock {
    constructor(){this.naturalWidth=0;this.naturalHeight=0;this.cornerAlpha=0;}
    set src(url){this.url=url;requested.push(this);}
  }
  const env={Math,Date,Image:ImageMock,matchMedia:()=>({matches:false}),
    document:{createElement:()=>({getContext:()=>new Proxy({
      drawImage(image){probeImage=image;},
      getImageData(){const data=new Uint8ClampedArray(16*16*4);
        for(let i=0;i<data.length;i+=4)data[i+3]=probeImage?.cornerAlpha??0;
        return {data};}
    },{get(target,key){return key in target?target[key]:(key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{});}})})},console:{warn(){},log(){}},setTimeout(){}};
  env.window=env;
  const context=vm.createContext(env);
  vm.runInContext(fs.readFileSync('js/assets.js','utf8'),context,{filename:'js/assets.js'});
  if(withSkills) for(const path of ['js/fx.js','js/skillfx.js'])
    vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
  const latest=substring=>requested.findLast(img=>img.url?.includes(substring));
  function ready(image){assert.ok(image);image.naturalWidth=image.naturalHeight=1024;image.onload();}
  return {env,requested,latest,ready};
}
function drawHarness(){
  const draws=[],positions=[];
  const stack=[];
  const ctx={globalAlpha:1,
    save(){stack.push(this.globalAlpha);},
    restore(){this.globalAlpha=stack.pop();},
    translate(x,y){positions.push([x,y]);},rotate(){},scale(){},
    drawImage(image,x,y,w,h){draws.push({image,x,y,w,h,alpha:this.globalAlpha});}
  };
  return {ctx,draws,positions};
}
const SCALES=[0.72,0.86,1.00,1.12,1.18];
const ALPHAS=[0.30,0.50,0.75,0.90,0.90];

test('tier config and lazily loaded separate Lv5 image',()=>{
  const {env,requested,latest,ready}=harness(false);
  const tiers=JSON.parse(JSON.stringify(env.BARRIER_ART_TIERS));
  assert.deepEqual(tiers.map(t=>t.scale),SCALES);
  assert.deepEqual(tiers.map(t=>t.alpha),ALPHAS);
  assert.deepEqual(tiers.map(t=>t.artKey),[
    'barrier_core_main','barrier_core_main','barrier_core_main','barrier_core_main','barrier_core_lv5']);
  assert.ok(!requested.some(img=>img.url?.includes('purification_array')),
    'barrier must not download during initial map loading');
  assert.equal(env.barrierCoreArt(1),null);
  const main=latest('purification_array_vfx.webp');
  assert.ok(main.url.includes('assets/img/vfx/purification_array_vfx.webp'));
  ready(main);
  assert.equal(env.barrierCoreArt(4),main);
  assert.equal(env.barrierCoreArt(5),main,'normal image is usable while Lv5 downloads');
  const lv5=latest('purification_array_lv5_vfx.webp');
  assert.ok(lv5.url.includes('assets/img/vfx/purification_array_lv5_vfx.webp'));
  assert.notEqual(lv5,main);
  ready(lv5);
  assert.equal(env.barrierCoreArt(5),lv5);
  assert.equal(env.barrierCoreArt(3),main);
  assert.equal(requested.filter(img=>img.url?.includes('purification_array_lv5_vfx.webp')).length,1);
});

test('all five casts use requested image, dimensions, alpha, and ground position',()=>{
  const {env,latest,ready}=harness();
  env.barrierCoreArt(5);
  const main=latest('purification_array_vfx.webp');
  const lv5=latest('purification_array_lv5_vfx.webp');
  ready(main);ready(lv5);
  const {ctx,draws,positions}=drawHarness();
  for(let rank=1;rank<=5;rank++){
    env.SKILLFX.reset();env.FX.reset();draws.length=0;positions.length=0;
    env.SKILLFX.play('barrier','cast',rank,{x:95,y:115,r:170});
    env.SKILLFX.drawArtFx(ctx,false);
    assert.equal(draws.length,0,'barrier is never an airborne sprite');
    env.SKILLFX.drawArtFx(ctx,true);
    const expected=rank===5?lv5:main;
    const opening=draws.find(d=>d.image===expected);
    assert.ok(opening,'level '+rank+' must use its designated image');
    assert.ok(Math.abs(opening.w-170*2.18*SCALES[rank-1]*0.67)<.01);
    env.SKILLFX.update(.2);draws.length=0;
    env.SKILLFX.drawArtFx(ctx,true);
    const sustained=draws.find(d=>d.image===expected);
    assert.ok(sustained,'level '+rank+' persists after cast');
    assert.ok(sustained.w>opening.w);
    assert.ok(Math.abs(sustained.w-170*2.18*SCALES[rank-1])<10);
    assert.ok(Math.abs(sustained.alpha-ALPHAS[rank-1])<.012,'tier alpha '+rank);
    assert.ok(positions.some(pos=>pos[0]===95&&pos[1]===115),
      'art remains at its ground anchor');
  }
});

test('Lv5 missing or opaque image falls back to the normal image',()=>{
  for(const outcome of ['network-error','opaque']){
    const {env,latest,ready}=harness();
    env.barrierCoreArt(5);
    const main=latest('purification_array_vfx.webp');
    const lv5=latest('purification_array_lv5_vfx.webp');
    ready(main);
    if(outcome==='network-error') lv5.onerror();
    else {lv5.cornerAlpha=255;ready(lv5);}
    assert.equal(env.barrierCoreArt(5),main,outcome);
    const {ctx,draws}=drawHarness();
    env.SKILLFX.play('barrier','cast',5,{x:20,y:30,r:170});
    env.SKILLFX.update(.2);env.SKILLFX.drawArtFx(ctx,true);
    assert.ok(draws.some(d=>d.image===main),'fallback image should paint');
  }
});

test('both raster files unavailable preserve earlier painted barrier',()=>{
  const {env,latest}=harness();
  const old={naturalWidth:512,naturalHeight:512};
  env.ART.barrier_mandala_ukiyoe=old;
  env.barrierCoreArt(5);
  latest('purification_array_vfx.webp').onerror();
  latest('purification_array_lv5_vfx.webp').onerror();
  const {ctx,draws}=drawHarness();
  env.SKILLFX.play('barrier','cast',3,{x:20,y:30,r:170});
  env.SKILLFX.drawArtFx(ctx,true);
  assert.ok(draws.some(d=>d.image===old));
});

test('Lv5 sustained sanctuary references dedicated tier with original ground layering',()=>{
  const source=fs.readFileSync('js/game.js','utf8');
  assert.match(source,/const coreArt = window\.barrierCoreArt\?\.\(5\)/);
  assert.match(source,/const width = sr\*2\.15\*tier\.scale/);
  assert.match(source,/ctx\.globalAlpha = tier\.alpha \* Math\.min\(1,lifeNorm\*1\.3\)/);
  assert.match(source,/技能的貼地圖案.*畫在所有角色之前/);
});
