const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadRenderer(width, height, dpr = 1, CanvasContext) {
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
    const c = {width:0, height:0, getContext: (...args) => { c.contextOptions = args[1] || null; return ctx; }, transforms, fills, ctx};
    canvases.push(c); return c;
  }
  const main = canvas();
  const env = {innerWidth:width, innerHeight:height, devicePixelRatio:dpr,
    matchMedia:()=>({matches:false,addEventListener:(type,fn)=>{env.motionChange=fn;}}), document:{createElement:canvas}, ART:{}, UI:{readableFont: () => '20px sans-serif'}, CanvasRenderingContext2D:CanvasContext};
  env.window=env;
  const context=vm.createContext(env);
  for (const name of ['viewport','renderer']) vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);
  context.RENDERER.init(main);
  return {env:context, main, canvases, texts, images};
}

test('roundRect fallback supports scalar and numeric corner lists, scales radii, and preserves native implementations',()=>{
  const calls=[];
  class Legacy {moveTo(...a){calls.push(['move',...a]);}arcTo(...a){calls.push(['arc',...a]);}closePath(){calls.push(['close']);}}
  loadRenderer(900,600,1,Legacy);const ctx=new Legacy();
  assert.equal(typeof ctx.roundRect,'function');
  assert.equal(ctx.roundRect(0,0,100,40,[10,20]),undefined);
  assert.deepEqual(calls.filter(c=>c[0]==='arc').map(c=>c.at(-1)),[20,10,20,10]);
  calls.length=0;ctx.roundRect(0,0,20,10,20);assert.ok(calls.filter(c=>c[0]==='arc').every(c=>c.at(-1)===5));
  calls.length=0;ctx.roundRect(100,0,-100,40,[1,2,3,4]);assert.deepEqual(calls.filter(c=>c[0]==='arc').map(c=>c.at(-1)),[1,4,3,2]);
  assert.throws(()=>ctx.roundRect(0,0,10,10,[]),{name:'RangeError'});
  assert.throws(()=>ctx.roundRect(0,0,10,10,-1),{name:'RangeError'});
  class Native extends Legacy {roundRect(){return 'native';}}const native=Native.prototype.roundRect;
  loadRenderer(900,600,1,Native);assert.equal(Native.prototype.roundRect,native);
});

test('enemy movement alternates a second drawing; attacks override walking and reduced motion keeps walking static',()=>{
  const r=loadRenderer(900,600),base={naturalWidth:184,naturalHeight:208},atlas={naturalWidth:1774,naturalHeight:887};
  r.env.ART.ghost=base;r.env.ART.ghost_motion_v1=atlas;
  const e={type:'ghost',x:450,y:300,walking:true,wob:0};
  r.env.RENDERER.drawMonster(e,{x:600},0);assert.equal(r.images.at(-1)[0],base);
  r.env.RENDERER.drawMonster(e,{x:600},0.2);assert.equal(r.images.at(-1)[0],atlas);
  e.attackT=0.2;r.env.RENDERER.drawMonster(e,{x:600},0);assert.ok(r.images.at(-1)[1]>=atlas.naturalWidth/2);
  r.env.motionChange({matches:true});e.attackT=0;r.env.RENDERER.drawMonster(e,{x:600},0.2);assert.equal(r.images.at(-1)[0],base);
});

test('dash uses its dedicated drawing and absent new art falls back to existing sprites',()=>{
  const r=loadRenderer(900,600),base={naturalWidth:216,naturalHeight:352},dash={naturalWidth:1024,naturalHeight:1024};
  r.env.ART.player=base;r.env.ART.player_dash_v1=dash;
  r.env.RENDERER.drawPlayer({x:450,y:300},true,0,0,{x:0,y:0});assert.equal(r.images.at(-1)[0],dash);
  delete r.env.ART.player_dash_v1;r.env.RENDERER.drawPlayer({x:450,y:300},true,0,0,{x:0,y:0});assert.equal(r.images.at(-1)[0],base);
});

test('missing specialized enemy art uses the fallback image crop rather than an incompatible atlas rectangle',()=>{
  const r=loadRenderer(900,600),ghost={naturalWidth:149,naturalHeight:208};r.env.ART.ghost=ghost;
  r.env.RENDERER.drawMonster({type:'runner',x:450,y:300},{x:600},0);
  const a=r.images.at(-1);assert.equal(a[0],ghost);assert.ok(a[1]+a[3]<=ghost.naturalWidth);
});

test('misdelivery monster word badge stays above the face',()=>{
  const src=fs.readFileSync('js/renderer.js','utf8');
  assert.match(src,/const badgeY = e\.y - 108/);
  assert.doesNotMatch(src,/roundRect\(e\.x - bw \/ 2, e\.y - 72/);
});

test('atlas crops stay inside shipped images and every frame shares its requested ground anchor',()=>{
  const r=loadRenderer(900,600);
  const names=['ghost','runner','boss','mis','tank','shooter'].map(k=>k+'_motion_v1').concat(['player_dash_v1','player_win_v1','player_kneel_v1','map_night_town_v1','map_rain_port_v1']);
  for(const name of names){
    const png=fs.readFileSync(`assets/img/${name}.png`),image={naturalWidth:png.readUInt32BE(16),naturalHeight:png.readUInt32BE(20)};
    for(const i of [0,1]){
      const b=r.env.RENDERER.drawFrame(r.main.ctx,image,name,i,50,80,100);
      assert.ok(b.sx>=0&&b.sy>=0&&b.sx+b.sw<=image.naturalWidth&&b.sy+b.sh<=image.naturalHeight,name);
      assert.ok(Math.abs(b.dy+b.dh-80)<1e-8,name);
    }
  }
});

test('shield labels remain text and effects expire even during hit stop', () => {
  const r=loadRenderer(900,600);
  r.env.RENDERER.spawnDamageNumber('結界',100,100);
  r.env.RENDERER.drawDamageNumbers();
  assert.ok(r.texts.includes('結界'));
  r.env.RENDERER.triggerShake(14);r.env.RENDERER.triggerHitStop(1);
  r.env.RENDERER.updateEffects(0.8);r.texts.length=0;r.env.RENDERER.drawDamageNumbers();
  assert.equal(r.texts.length,0);
  assert.deepEqual({...r.env.RENDERER.getShakeOffset()},{x:0,y:0});
});

test('reduced motion disables shake and hit stop', () => {
  const r=loadRenderer(900,600);r.env.motionChange({matches:true});
  r.env.RENDERER.triggerShake(14);r.env.RENDERER.triggerHitStop(1);
  assert.deepEqual({...r.env.RENDERER.getShakeOffset()},{x:0,y:0});
  assert.equal(r.env.RENDERER.updateEffects(0.01),false);
});

test('katana local slash mirrors the ukiyo-e art so the convex edge faces attack direction, with Canvas fallback',()=>{
  const r=loadRenderer(900,600),art={naturalWidth:261,naturalHeight:300};
  r.env.ART.katana_wave_ukiyoe=art;
  let arcs=0;const scales=[];r.main.ctx.arc=()=>arcs++;r.main.ctx.scale=(...args)=>scales.push(args);
  r.env.RENDERER.addSlashArc(0,0,120,0,2.2,3);r.env.RENDERER.drawSlashArcs();
  assert.ok(r.images.some(a=>a[0]===art),'loaded katana art must be composited with drawImage');
  assert.ok(scales.some(([x,y])=>x===-1&&y===1),'local slash must mirror the source raster just like the flying blade');
  assert.equal(arcs,0,'loaded art must skip the old procedural crescent');

  delete r.env.ART.katana_wave_ukiyoe;r.images.length=0;
  r.env.RENDERER.addSlashArc(0,0,120,0,2.2,2);r.env.RENDERER.drawSlashArcs();
  assert.ok(arcs>0,'missing asset keeps the old safe fallback');
});

test('katana renderer selects the exact five-rank raster before the legacy crescent',()=>{
  const r=loadRenderer(900,600),legacy={naturalWidth:261,naturalHeight:300},rank4={naturalWidth:300,naturalHeight:220},scales=[];
  r.main.ctx.scale=(...args)=>scales.push(args);
  r.env.ART.katana_wave_ukiyoe=legacy;r.env.ART.katana_l4=rank4;
  r.env.skillVfxArt=(id,rank)=>id==='katana'?r.env.ART['katana_l'+rank]:null;
  r.env.RENDERER.addSlashArc(0,0,120,0,2.2,4);r.env.RENDERER.drawSlashArcs();
  assert.ok(r.images.some(a=>a[0]===rank4));
  assert.ok(!r.images.some(a=>a[0]===legacy));
  assert.ok(!scales.some(([x,y])=>x===-1&&y===1),'five-rank katana art already faces the intended direction and must not be mirrored');
});

test('katana Lv1-Lv4 ranked slashes stay close to the courier instead of floating far forward',()=>{
  const r=loadRenderer(900,600),art={naturalWidth:1254,naturalHeight:1254},translates=[];
  r.main.ctx.translate=(...args)=>translates.push(args);
  r.env.ART.katana_l4=art;
  r.env.skillVfxArt=(id,rank)=>id==='katana'&&rank===4?art:null;
  r.env.RENDERER.addSlashArc(0,0,120,0,2.2,4);
  r.env.RENDERER.drawSlashArcs();
  const forwardTranslations=translates.filter(([x,y])=>x>0&&y===0).map(([x])=>x);
  assert.ok(forwardTranslations.length>0);
  assert.ok(Math.max(...forwardTranslations)<45,'Lv4 local slash should remain attached to the player-side attack origin');
});

test('Canvas backings preserve viewport mapping within bounded raster budgets', () => {
  for (const [width,height,dpr] of [[1920,1080,1],[844,390,3],[1280,800,1.25]]) {
    const r=loadRenderer(width,height,dpr), light=r.canvases[1];
    const density=r.env.RENDERER.getDpr(), v=r.env.VIEWPORT.get();
    assert.ok(density<=Math.min(dpr,2));assert.ok(density>=0.34);
    assert.ok(r.main.width*r.main.height<=921600+4000);
    assert.deepEqual([r.main.width,r.main.height],[Math.round(width*density),Math.round(height*density)]);
    assert.ok(light.width*light.height<=282000);
    assert.ok(light.width<=width && light.height<=height);
    const transform=light.transforms.at(-1);
    assert.ok(Math.abs(transform[0]/v.scale-light.width/width)<1/width);
    assert.equal(transform[4],v.offsetX*transform[0]);
    assert.equal(r.main.ctx.imageSmoothingQuality,'low');
    assert.equal(r.main.contextOptions.alpha,false);
    assert.equal(light.contextOptions,null);
    r.env.RENDERER.renderLighting({x:450,y:300},[],95,0,600);
    const overlay=r.images.find(args=>args[0]===light);
    assert.ok(overlay);
    assert.deepEqual(overlay.slice(1),[-v.offsetX,-v.offsetY,v.width,v.height]);
  }
});

test('large high-DPR windows do not multiply the scene into over six million pixels',()=>{
  const r=loadRenderer(1680,949,2);
  assert.ok(r.main.width*r.main.height<=921600+4000);
  assert.ok(r.env.RENDERER.getDpr()<1);
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

test('courtyard paving arriving late refreshes the cached terrain only once',()=>{
  const r=loadRenderer(900,600),chunks=[{x:0,y:0,w:900,h:600,theme:'water',name:'港',houses:[{x:210,y:175}]}];
  r.env.RENDERER.drawGround(0,600,chunks,'ground_dirt');const cached=r.canvases.at(-1),before=cached.fills.length;
  r.env.ART.ground={complete:true,naturalWidth:512};r.env.RENDERER.drawGround(1,600,chunks,'ground_dirt');
  assert.ok(cached.fills.length>before);const after=cached.fills.length;
  r.env.RENDERER.drawGround(2,600,chunks,'ground_dirt');assert.equal(cached.fills.length,after);
});

test('terrain uses the actual float32 transform for a one-to-one buffered blit',()=>{
  const r=loadRenderer(1080,720),scale=1.2000000476837158;
  r.main.ctx.getTransform=()=>({a:scale,d:scale});
  r.env.RENDERER.drawGround(0,600,[]);
  const blit=r.images.find(args=>args.length===5&&r.canvases.includes(args[0])&&args[0]!==r.main&&args[0].width>1000);
  assert.ok(blit);assert.ok(Math.abs(blit[3]*scale-blit[0].width)<1e-8);assert.ok(Math.abs(blit[4]*scale-blit[0].height)<1e-8);
  let boundsCalls=0;const bounds=r.env.VIEWPORT.bounds;r.env.VIEWPORT.bounds=()=>{boundsCalls++;return bounds();};
  r.env.RENDERER.updateEffects(0.016);assert.equal(boundsCalls,1);
});

test('stone roads do not paint pale curb stripes or a dark road cross',()=>{
  const src=fs.readFileSync('js/renderer.js','utf8');
  assert.equal(src.includes('#333d52'),false);
  assert.equal(src.includes('ROAD_W'),false);
  assert.equal(src.includes('rgba(8, 10, 18, 0.28)'),false);
});

test('water districts do not paint breathing stripes and terrain still refreshes on resize',()=>{
  const r=loadRenderer(844,390,2),waves=[],chunks=[{x:0,y:0,w:900,h:600,cx:0,theme:'water',name:'海邊',sub:''}];
  r.main.ctx.roundRect=(x,y,w,h)=>{if(h===28)waves.push(y);};
  r.env.RENDERER.drawGround(0,600,chunks);
  r.env.RENDERER.drawGround(3.1,600,chunks);
  assert.equal(waves.length,0);
  const src=fs.readFileSync('js/renderer.js','utf8');
  assert.equal(src.includes('rgba(100, 210, 255, 0.06)'),false);
  const cached=r.canvases.at(-1),fills=cached.fills.length;
  r.env.innerWidth=1280;r.env.innerHeight=720;r.env.RENDERER.resize();r.env.RENDERER.drawGround(2,600,chunks);
  assert.ok(cached.fills.length>fills);
});

test('resize refreshes DPR and backing resolution when moving between displays', () => {
  const r=loadRenderer(1920,1080);
  r.env.innerWidth=844; r.env.innerHeight=390; r.env.devicePixelRatio=2;
  r.env.RENDERER.resize();
  const density=r.env.RENDERER.getDpr();
  assert.deepEqual([r.main.width,r.main.height],[Math.round(844*density),Math.round(390*density)]);
  assert.ok(density>1 && density<2);
  assert.ok(r.main.width*r.main.height<=921600+4000);
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

test('night midtones stay readable and warm light stays on the lamps', () => {
  const r = loadRenderer(900, 600), light = r.canvases[1], styles = [];
  let fill = '';
  Object.defineProperty(light.ctx, 'fillStyle', { configurable: true, get() { return fill; }, set(v) { fill = v; styles.push(String(v)); } });
  let warm = 0;
  r.main.ctx.createRadialGradient = () => { warm++; return { addColorStop() {} }; };
  const canvases = r.canvases.length;
  r.env.RENDERER.renderLighting({ x: 450, y: 300 }, [{ x: 520, y: 340 }], 100, 0, 600);
  assert.equal(r.images.filter(args => args[0] === light).length, 1);
  assert.ok(styles.some(v => v.startsWith('rgba(28, 32, 58,')));
  assert.ok(!styles.some(v => v.startsWith('rgba(7, 10, 26,')));
  assert.ok(warm >= 2);
  assert.equal(r.canvases.length, canvases);
});

test('reduced motion drops drifting petals and fireflies', () => {
  const r = loadRenderer(900, 600);
  r.env.motionChange({matches:true});
  let marks = 0;
  r.main.ctx.arc = () => { marks++; };
  r.main.ctx.ellipse = () => { marks++; };
  r.env.RENDERER.drawAtmosphere(1, 17, 30);
  assert.equal(marks, 0);
});

test('house signs identify shops and never expose unrelated vocabulary or hint translations', () => {
  const r=loadRenderer(900,600);
  for (const [i, bType] of ['house_shop','house_tavern','house_shrine'].entries()) {
    r.env.RENDERER.drawHouse({x:450,y:300,bType,id:i * 7 + 1,color:'#4f7a5b',word:{jp:'ひみつ',zh:'不應顯示的答案'}},4);
  }
  assert.deepEqual(r.texts,['夜行商店','宵待酒屋','稻荷社']);
  assert.doesNotThrow(() => r.env.RENDERER.drawHouse({x:450,y:300,bType:'unknown'}));
});

test('phase-two houses keep separate visual widths and the original depth foot anchor', () => {
  const r=loadRenderer(900,600);
  for(const [bType,width] of [['house_shop',166],['house_tavern',175],['house_shrine',158]]) {
    const image={naturalWidth:320,naturalHeight:400};
    r.env.ART[bType]=image;
    r.env.RENDERER.drawHouse({x:450,y:300,bType});
    const draw=r.images.findLast(call=>call[0]===image);
    assert.ok(draw,bType);
    assert.equal(draw[3],width,bType);
    assert.equal(draw[2]+draw[4],348,bType);
  }
});

test('phase-two ground atlas crops meet on every horizontal and vertical tile boundary', () => {
  const r=loadRenderer(900,600);
  const source=new Uint8ClampedArray(1024*1024*4);
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
    const i=(y*1024+x)*4;
    source[i]=x/4;source[i+1]=y/4;source[i+2]=(x*7+y*3)%256;source[i+3]=255;
  }
  let atlas;
  const originalCreate=r.env.document.createElement;
  r.env.document.createElement=()=>{
    const canvas=originalCreate();
    canvas.ctx.getImageData=()=>({data:source});
    canvas.ctx.createImageData=(w,h)=>({data:new Uint8ClampedArray(w*h*4)});
    canvas.ctx.putImageData=image=>{atlas=image.data;};
    canvas.ctx.createPattern=()=>({setTransform(){}});
    return canvas;
  };
  r.env.ART.ground_dirt={naturalWidth:1024,naturalHeight:1024,complete:true};
  r.env.RENDERER.drawGround(0,600,[],'ground_dirt');
  assert.ok(atlas);
  const sample=(tile,x,y,ch)=>atlas[(((tile>>1)*512+y)*1024+(tile&1)*512+x)*4+ch];
  for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let n=0;n<512;n+=7)for(let ch=0;ch<4;ch++){
    assert.equal(sample(a,511,n,ch),sample(b,0,n,ch),'horizontal crop seam');
    assert.equal(sample(a,n,511,ch),sample(b,n,0,ch),'vertical crop seam');
  }
});

test('quiet ground removes dark rectangular courtyards and wide ink-road borders', () => {
  const r=loadRenderer(900,600);
  r.env.RENDERER.drawGround(0,600,[],'ground_dirt');
  const c=r.canvases.at(-1).ctx, rectangles=[], strokes=[];
  c.roundRect=(...args)=>rectangles.push(args);
  c.stroke=()=>strokes.push({color:c.strokeStyle,width:c.lineWidth});
  const chunks=[{x:0,y:0,w:900,h:600,theme:'market',name:'街',sub:'',houses:[{x:220,y:160}]}];
  r.env.RENDERER.drawGround(1,600,chunks,'ground_dirt');
  assert.deepEqual(rectangles,[],'ground should not draw courtyard rectangles');
  assert.ok(strokes.every(s=>!String(s.color).includes('18,16,19')),'no near-black road borders');
  assert.ok(strokes.every(s=>s.width<=72),'no oversized stroke outlines');
  assert.ok(strokes.length<=2,'no repeating dry-brush grid');
});
