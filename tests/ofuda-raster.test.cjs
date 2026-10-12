const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function harness(){
  const requested=[],uprights=[];
  let probeImage=null;
  class ImageMock {
    constructor(){this.naturalWidth=0;this.naturalHeight=0;this.cornerAlpha=0;}
    set src(url){this.url=url;requested.push(this);}
  }
  // FX pre-bakes particle sprites on Canvas; this mock supports that without a DOM.
  const gradient={addColorStop(){}},noop=()=>{};
  const canvasCtx=new Proxy({
    drawImage(image){probeImage=image;},
    getImageData(){const data=new Uint8ClampedArray(16*16*4);
      for(let i=0;i<data.length;i+=4)data[i+3]=probeImage?.cornerAlpha??0;
      return {data};},
    createRadialGradient(){return gradient;},createLinearGradient(){return gradient;}
  },{get(target,key){return key in target?target[key]:noop;}});
  const env={Math,Date,Image:ImageMock,matchMedia:()=>({matches:false}),
    document:{createElement:()=>({getContext:()=>canvasCtx})},
    console:{warn(){},log(){}},setTimeout(){}};
  env.window=env;
  env.VIEWPORT={upright(ctx,x,y,paint){uprights.push([x,y]);paint();}};
  const cx=vm.createContext(env);
  for(const file of ['js/assets.js','js/fx.js','js/skillfx.js'])
    vm.runInContext(fs.readFileSync(file,'utf8'),cx,{filename:file});
  function named(name){return requested.find(img=>img.url?.includes('/'+name+'.webp'));}
  function ready(image){assert.ok(image,'asset request missing');image.naturalWidth=image.naturalHeight=1024;image.onload();}
  return {env,requested,uprights,named,ready};
}
function drawHarness(){
  const draws=[],stack=[];
  const ctx={globalAlpha:1,save(){stack.push(this.globalAlpha);},
    restore(){this.globalAlpha=stack.pop();},translate(){},rotate(){},scale(){},
    drawImage(img,x,y,w,h){draws.push({img,x,y,w,h,alpha:this.globalAlpha});}};
  return {ctx,draws};
}
const sizeFactor=[.92,.96,1,1.04,1.08];

test('ofuda files are lazy and level-scoped instead of initial-map downloads',()=>{
  const {env,requested,named,ready}=harness();
  assert.ok(!requested.some(x=>x.url?.includes('/ofuda_')));
  env.prepareSkillArt('boom',2);
  assert.ok(named('ofuda_projectile'));
  assert.ok(named('ofuda_hit_burst'));
  assert.equal(named('ofuda_max_burst'),undefined);
  ready(named('ofuda_projectile'));
  ready(named('ofuda_hit_burst'));
  assert.equal(env.ofudaRasterArt('main'),named('ofuda_projectile'));
  assert.equal(env.ofudaRasterArt('hit'),named('ofuda_hit_burst'));
  env.prepareSkillArt('boom',5);
  assert.ok(named('ofuda_max_burst'));
  ready(named('ofuda_max_burst'));
  assert.equal(env.ofudaRasterArt('max'),named('ofuda_max_burst'));
  const count=requested.filter(x=>x.url?.includes('/ofuda_')).length;
  env.prepareSkillArt('boom',5);
  assert.equal(requested.filter(x=>x.url?.includes('/ofuda_')).length,count);
});

test('Lv1–Lv5 upright flying talismans use main image and small rank increments',()=>{
  const {env,named,ready}=harness();
  env.ofudaRasterArt('main');const main=named('ofuda_projectile');ready(main);
  const {ctx,draws}=drawHarness();
  for(let rank=1;rank<=5;rank++){
    draws.length=0;
    env.SKILLFX.paint(ctx,'boom',rank,{x:60,y:80,age:.20,life:1,spin:8});
    const drawn=draws.find(d=>d.img===main);
    assert.ok(drawn,'main image rank '+rank);
    assert.ok(Math.abs(drawn.w-104*sizeFactor[rank-1])<.0001,'scale rank '+rank);
    assert.ok(drawn.alpha>.99);
    assert.equal(drawn.y,-drawn.h/2);
  }
  draws.length=0;
  env.SKILLFX.paint(ctx,'boom',2,{x:60,y:80,age:.01,life:1});
  assert.ok(draws[0].alpha<.20,'projectile fades in');
  draws.length=0;
  env.SKILLFX.paint(ctx,'boom',2,{x:60,y:80,age:.2,life:.025});
  assert.ok(draws[0].alpha<.20,'projectile fades out when lifetime is nearly over');
  draws.length=0;
  env.SKILLFX.paint(ctx,'boom',2,{x:60,y:80,age:.2,life:1,exitAlpha:.25});
  assert.ok(draws[0].alpha<.26,'returning boomerang fades near its owner');
});

test('Lv1-Lv4 use regular upright hit and Lv5 uses larger MAX hit',()=>{
  const {env,named,ready,uprights}=harness();
  env.ofudaRasterArt('hit');env.ofudaRasterArt('max');
  const normal=named('ofuda_hit_burst'),max=named('ofuda_max_burst');
  ready(normal);ready(max);
  const {ctx,draws}=drawHarness();
  for(let rank=1;rank<=5;rank++){
    env.SKILLFX.reset();env.FX.reset();draws.length=0;uprights.length=0;
    env.SKILLFX.play('boom','hit',rank,{x:140,y:160,r:135,target:{hp:99}});
    env.SKILLFX.update(.10);
    env.SKILLFX.drawArtFx(ctx,true);
    assert.equal(draws.length,0,'impact is not the flattened ground pass');
    env.SKILLFX.drawArtFx(ctx,false);
    const drawn=draws.find(d=>d.img===(rank===5?max:normal));
    assert.ok(drawn,'correct impact art for rank '+rank);
    assert.equal(uprights.length,1,'viewport upright conversion');
    assert.deepEqual(uprights[0],[140,160]);
    assert.ok(drawn.alpha>.95,'main impact is visible');
    if(rank===5)assert.ok(drawn.w>200,'MAX impact visibly larger');
    else assert.ok(drawn.w<180,'normal impact stays smaller');
  }
});

test('hit raster naturally fades without abrupt removal',()=>{
  const {env,named,ready}=harness();
  env.ofudaRasterArt('hit');ready(named('ofuda_hit_burst'));
  const {ctx,draws}=drawHarness();
  env.SKILLFX.play('boom','hit',2,{x:80,y:90,target:{hp:100}});
  env.SKILLFX.update(.10);
  env.SKILLFX.drawArtFx(ctx,false);
  const steady=draws.at(-1).alpha;
  draws.length=0;env.SKILLFX.update(.22);
  env.SKILLFX.drawArtFx(ctx,false);
  assert.ok(draws[0].alpha<steady,'fades near end of lifetime');
  env.SKILLFX.update(.20);draws.length=0;
  env.SKILLFX.drawArtFx(ctx,false);
  assert.equal(draws.length,0,'expired image is cleared');
});

test('network/opaque/invalid image falls back to existing ofuda visuals',()=>{
  for(const mode of ['network','opaque','invalid']){
    const {env,named,ready}=harness();
    let oldDrawn=0;
    env.ONMYO_VFX={ofuda(){oldDrawn++;}};
    env.ofudaRasterArt('main');env.ofudaRasterArt('hit');env.ofudaRasterArt('max');
    for(const name of ['ofuda_projectile','ofuda_hit_burst','ofuda_max_burst']){
      const img=named(name);
      if(mode==='network') img.onerror();
      else if(mode==='opaque'){img.cornerAlpha=255;ready(img);}
      else {img.naturalWidth=0;img.naturalHeight=0;img.onload();}
    }
    const {ctx,draws}=drawHarness();
    env.SKILLFX.paint(ctx,'boom',1,{x:10,y:20,age:.2,life:1});
    assert.equal(oldDrawn,1,'legacy talisman fallback');
    assert.ok(!draws.some(d=>d.img===named('ofuda_projectile')));
    env.SKILLFX.play('boom','hit',3,{x:10,y:20,target:{hp:100}});
    assert.ok(env.FX.particles().length>0,'legacy hit FX fallback');
    env.FX.reset();
    env.SKILLFX.play('boom','hit',5,{x:10,y:20,r:135});
    assert.ok(env.FX.particles().length>0,'legacy MAX explosion fallback');
  }
});

test('impact cancels pitch compression at 2D, 0.80 mid-transition and 0.60',()=>{
  const {env,named,ready}=harness();
  env.location={search:'?tilt=1'};
  vm.runInNewContext(fs.readFileSync('js/viewport.js','utf8'),env);
  env.ofudaRasterArt('hit');ready(named('ofuda_hit_burst'));
  env.SKILLFX.play('boom','hit',2,{x:130,y:140,target:{hp:100}});
  env.SKILLFX.update(.1);
  const {ctx,draws}=drawHarness(),scales=[];
  ctx.scale=(x,y)=>scales.push([x,y]);
  function expectPitch(k){
    scales.length=0;draws.length=0;
    env.SKILLFX.drawArtFx(ctx,false);
    assert.ok(draws.some(d=>d.img===named('ofuda_hit_burst')));
    if(k===1) assert.equal(scales.length,1,'2D does not need inverse-pitch scale');
    else assert.ok(scales.some(([x,y])=>x===1&&Math.abs(y-1/k)<.000001),
      'upright compensates exact live camera tilt '+k);
  }
  expectPitch(1);
  env.VIEWPORT.animateTiltScale(.6,.8);
  env.VIEWPORT.advanceTilt(.4);
  assert.ok(Math.abs(env.VIEWPORT.tiltScale()-.8)<.00001);
  expectPitch(.8);
  env.VIEWPORT.advanceTilt(.4);
  assert.ok(Math.abs(env.VIEWPORT.tiltScale()-.6)<.00001);
  expectPitch(.6);
});

test('game projectile and impact use viewport upright, without camera overrides',()=>{
  const game=fs.readFileSync('js/game.js','utf8');
  const skill=fs.readFileSync('js/skillfx.js','utf8');
  assert.match(game,/for \(const q of proj\) upright\(q\.x,q\.y/);
  assert.match(game,/spin: elapsed \* 16, age:q\.t, life:q\.life/);
  assert.match(skill,/window\.VIEWPORT\?\.upright\) window\.VIEWPORT\.upright\(ctx,p\.x,p\.y,paint\)/);
  assert.doesNotMatch(skill,/ctx\.scale\(1,0\.6\)/);
});
