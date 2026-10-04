const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRenderer(width, height, dpr = 1) {
  const canvases = [], texts = [], images = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const transforms = [], fills = [];
    const ctx = new Proxy({
      setTransform: (...args) => transforms.push(args),
      fillRect: (...args) => fills.push(args),
      fillText: text => texts.push(text), drawImage: (...args) => images.push(args),
      createLinearGradient: () => gradient, createRadialGradient: () => gradient,
      measureText: () => ({width:40})
    }, {get: (o,k) => o[k] ?? (() => {})});
    const c = {width:0, height:0, getContext: () => ctx, transforms, fills, ctx};
    canvases.push(c); return c;
  }
  const main = canvas();
  const env = {innerWidth:width, innerHeight:height, devicePixelRatio:dpr,
    document:{createElement:canvas}, ART:{}, UI:{readableFont: () => '20px sans-serif'}};
  env.window=env;
  const context=vm.createContext(env);
  for (const name of ['viewport','renderer']) vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);
  context.RENDERER.init(main);
  return {env:context, main, canvases, texts, images};
}

test('Canvas backings preserve viewport mapping within bounded raster budgets', () => {
  for (const [width,height,dpr] of [[1920,1080,1],[844,390,3],[1280,800,1.25]]) {
    const r=loadRenderer(width,height,dpr), light=r.canvases[1];
    const density=r.env.RENDERER.getDpr(), v=r.env.VIEWPORT.get();
    assert.ok(density<=Math.min(dpr,2));assert.ok(density>=1);
    assert.ok(r.main.width*r.main.height<=Math.max(width*height,1500000)+3000);
    assert.deepEqual([r.main.width,r.main.height],[Math.round(width*density),Math.round(height*density)]);
    assert.ok(light.width*light.height<=502000);
    assert.ok(light.width<=width && light.height<=height);
    const transform=light.transforms.at(-1);
    assert.ok(Math.abs(transform[0]/v.scale-light.width/width)<1/width);
    assert.equal(transform[4],v.offsetX*transform[0]);
    assert.equal(r.main.ctx.imageSmoothingQuality,'high');
    r.env.RENDERER.renderLighting({x:450,y:300},[],95,0,600);
    const overlay=r.images.find(args=>args[0]===light);
    assert.ok(overlay);
    assert.deepEqual(overlay.slice(1),[-v.offsetX,-v.offsetY,v.width,v.height]);
  }
});

test('large high-DPR windows do not multiply the scene into over six million pixels',()=>{
  const r=loadRenderer(1680,949,2);
  assert.ok(r.main.width*r.main.height<=Math.max(1680*949,1500000)+3000);
  assert.ok(r.env.RENDERER.getDpr()<2);
  assert.ok(r.env.RENDERER.getDpr()>=1);
});

test('soft lighting raster stays bounded while the final layer covers the full viewport',()=>{
  const r=loadRenderer(1680,949,2),light=r.canvases[1],v=r.env.VIEWPORT.get();
  assert.ok(light.width*light.height<=502000);
  r.env.RENDERER.renderLighting({x:450,y:300},[],100,0,600);
  assert.deepEqual(r.images.find(args=>args[0]===light).slice(1),[-v.offsetX,-v.offsetY,v.width,v.height]);
});

test('static terrain reuses one buffered canvas and refreshes for camera bounds and late assets',()=>{
  const r=loadRenderer(900,600),count=r.canvases.length;
  const chunks=[{x:0,y:0,w:900,h:600,cx:0,theme:'market',name:'街',sub:''}];
  r.env.RENDERER.drawGround(0,600,chunks,'ground_dirt');
  assert.equal(r.canvases.length,count+1);const cached=r.canvases.at(-1),fills=cached.fills.length;
  r.env.RENDERER.setCam(40,40);r.env.RENDERER.drawGround(1,600,chunks,'ground_dirt');
  assert.equal(cached.fills.length,fills);assert.equal(r.images.at(-1)[0],cached);
  r.env.RENDERER.setCam(250,0);r.env.RENDERER.drawGround(2,600,chunks,'ground_dirt');
  assert.ok(cached.fills.length>fills);const shifted=cached.fills.length;
  r.env.ART.ground_dirt={complete:true,naturalWidth:512};r.env.RENDERER.drawGround(3,600,chunks,'ground_dirt');
  assert.ok(cached.fills.length>shifted);const loaded=cached.fills.length;
  r.env.RENDERER.drawGround(4,600,[{...chunks[0],theme:'mystic'}],'ground_dirt');assert.ok(cached.fills.length>loaded);
  assert.equal(r.canvases.length,count+1);
});

test('terrain caching keeps water animation live and invalidates its pixel scale on resize',()=>{
  const r=loadRenderer(844,390,2),waves=[],chunks=[{x:0,y:0,w:900,h:600,cx:0,theme:'water',name:'水',sub:''}];
  r.main.ctx.roundRect=(x,y,w,h)=>{if(h===28)waves.push(y);};
  r.env.RENDERER.drawGround(0,600,chunks);const initial=waves.slice();waves.length=0;
  r.env.RENDERER.drawGround(1,600,chunks);assert.notDeepEqual(waves,initial);
  const cached=r.canvases.at(-1),fills=cached.fills.length;
  r.env.innerWidth=1280;r.env.innerHeight=720;r.env.RENDERER.resize();r.env.RENDERER.drawGround(2,600,chunks);
  assert.ok(cached.fills.length>fills);
});

test('resize refreshes DPR and backing resolution when moving between displays', () => {
  const r=loadRenderer(1920,1080);
  r.env.innerWidth=844; r.env.innerHeight=390; r.env.devicePixelRatio=2;
  r.env.RENDERER.resize();
  assert.deepEqual([r.main.width,r.main.height],[1688,780]);
  assert.equal(r.env.RENDERER.getDpr(),2);
});

test('full upgraded oil capacity keeps the same lantern radius as full base capacity',()=>{
  const r=loadRenderer(900,600),radii=[];
  r.canvases[1].ctx.createRadialGradient=(...args)=>{radii.push(args[5]);return {addColorStop(){}};};
  r.env.RENDERER.renderLighting({x:450,y:300},[],100,0,600,100);
  r.env.RENDERER.renderLighting({x:450,y:300},[],160,0,600,160);
  assert.equal(radii[0],radii[1]);
});

test('monster hit flashes use a cached white silhouette without Canvas filter',()=>{
  const r=loadRenderer(900,600),sprite={naturalWidth:80,naturalHeight:100};r.env.ART.ghost=sprite;
  let filters=0;Object.defineProperty(r.main.ctx,'filter',{set(){filters++;}});
  const initial=r.canvases.length,e={type:'ghost',x:100,y:100,hp:1,flash:0.1};
  r.env.RENDERER.drawMonster(e,{x:200,y:100},0);const count=r.canvases.length;
  r.env.RENDERER.drawMonster(e,{x:200,y:100},0);
  assert.equal(filters,0);assert.equal(r.canvases.length,count);assert.equal(count,initial+1);
});

test('house signs identify shops and never expose unrelated vocabulary or hint translations', () => {
  const r=loadRenderer(900,600);
  for (const bType of ['house_shop','house_tavern','house_shrine']) {
    r.env.RENDERER.drawHouse({x:450,y:300,bType,word:{jp:'ひみつ',zh:'不應顯示的答案'}},4);
  }
  assert.deepEqual(r.texts,['夜行商店','宵待酒屋','稻荷社']);
  assert.doesNotThrow(() => r.env.RENDERER.drawHouse({x:450,y:300,bType:'unknown'}));
});
