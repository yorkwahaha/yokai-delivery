const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRenderer(width, height, dpr = 1) {
  const canvases = [], texts = [], images = [];
  const gradient = { addColorStop() {} };
  function canvas() {
    const transforms = [];
    const ctx = new Proxy({
      setTransform: (...args) => transforms.push(args),
      fillText: text => texts.push(text), drawImage: (...args) => images.push(args),
      createLinearGradient: () => gradient, createRadialGradient: () => gradient,
      measureText: () => ({width:40})
    }, {get: (o,k) => o[k] ?? (() => {})});
    const c = {width:0, height:0, getContext: () => ctx, transforms, ctx};
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

test('Canvas backing follows CSS pixels with capped DPR; lighting uses one pixel per CSS pixel', () => {
  for (const [width,height,dpr] of [[1920,1080,1],[844,390,3],[1280,800,1.25]]) {
    const r=loadRenderer(width,height,dpr), light=r.canvases[1];
    const density=Math.min(dpr,2), v=r.env.VIEWPORT.get();
    assert.deepEqual([r.main.width,r.main.height],[Math.round(width*density),Math.round(height*density)]);
    assert.deepEqual([light.width,light.height],[width,height]);
    const transform=light.transforms.at(-1);
    assert.equal(transform[0],v.scale);
    assert.equal(transform[4],v.offsetX*v.scale);
    assert.equal(r.main.ctx.imageSmoothingQuality,'high');
    r.env.RENDERER.renderLighting({x:450,y:300},[],95,0,600);
    assert.equal(r.images.at(-1)[0],light);
    assert.deepEqual(r.images.at(-1).slice(1),[-v.offsetX,-v.offsetY,v.width,v.height]);
  }
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
