const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadFx(reduceMotion = false, options = {}) {
  const env = { Math, Date, matchMedia: () => ({ matches: reduceMotion }), ...options };
  env.window = env;
  vm.runInNewContext(fs.readFileSync('js/fx.js', 'utf8'), env);
  return env.FX;
}

const view = { left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 };
const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });

test('full pool preserves structural strokes and seals and reduced motion covers all emitters',()=>{
  const FX=loadFx();for(let i=0;i<460;i++)FX.emit('glow','#fff',{life:1});
  for(const kind of ['stroke','seal'])FX.emit(kind,'#fff',{life:1});
  for(const kind of ['stroke','seal'])assert.ok(FX.particles().some(p=>p.kind===kind));
  const calm=loadFx(true);
  calm.burst(0,0);calm.death(0,0);calm.deliver(0,0);
  for(const p of calm.particles())assert.equal(Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.vr)+Math.abs(p.s1-p.s0),0);
});

test('FX works without a DOM and never exceeds the particle cap', () => {
  const FX = loadFx();
  for (let i = 0; i < 200; i++) FX.burst(100, 100, '#ff8a1f', 60);
  assert.ok(FX.stats().particles <= 460);
  assert.doesNotThrow(() => { FX.update(1 / 60); FX.draw(ctx, { x: 0, y: 0 }, view); FX.drawGround(ctx, { x: 0, y: 0 }, view); FX.drawFlash(ctx, view); });
});

test('a full particle pool still admits the essential awakened floor sigil without raising the cap',()=>{
  const FX=loadFx();for(let i=0;i<460;i++)FX.emit('glow','#fff',{life:1});
  FX.emit('storm','#88cfff',{life:1,ground:true});
  assert.equal(FX.stats().particles,460);assert.ok(FX.particles().some(p=>p.kind==='storm'));
});

test('general effects spawn something and all particles expire', () => {
  const FX = loadFx();
  const effects = [
    () => FX.death(0, 0, '#fff', true), () => FX.levelUp(0, 0), () => FX.deliver(0, 0), () => FX.gem(0, 0),
    () => FX.dashTrail(0, 0, 1, 0), () => FX.bolt(0, 0, { w: 1.5 })
  ];
  for (const fire of effects) {
    FX.reset();
    fire();
    assert.ok(FX.stats().particles + FX.stats().bolts > 0);
    for (let i = 0; i < 400; i++) FX.update(1 / 60);
    assert.equal(FX.stats().particles + FX.stats().bolts, 0);
  }
});

test('ground particles are drawn only by the ground pass and air particles only by the main pass', () => {
  const FX = loadFx();
  FX.emit('glow', '#fff', { x: 10, y: 10, life: 1, ground: true });
  FX.emit('glow', '#fff', { x: 20, y: 20, life: 1 });
  const drawn = [];
  const spy = new Proxy({}, { get: (o, k) => (k === 'drawImage' ? () => drawn.push(1) : k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  // 沒有 DOM 時貼圖為 null，改用不被略過的假貼圖
  FX.particles().forEach(p => { p.sprite.source = {}; });
  FX.update(0.3);
  FX.drawGround(spy, { x: 0, y: 0 }, view);
  assert.equal(drawn.length, 1);
  FX.draw(spy, { x: 0, y: 0 }, view);
  assert.equal(drawn.length, 2);
});

test('a cold particle atlas shares one canvas in original blend order and can switch back', () => {
  const canvases = [], draws = [];
  const config = {fxBatch:'canvas'};
  const painter = new Proxy({}, {get:(obj,key)=>obj[key] ?? (()=>{})});
  const FX = loadFx(false,{PORT_PERF:{config},document:{createElement() {
    const canvas = {getContext:()=>painter};
    canvases.push(canvas);
    return canvas;
  }}});
  FX.emit('stroke','#fff',{x:100,y:100,life:1,blend:'source-over'});
  FX.emit('shard','#fff',{x:100,y:100,life:1,blend:'lighter'});
  FX.update(.25);
  const target = {globalCompositeOperation:'source-over',save(){},restore(){},
    drawImage(image) {draws.push([image,this.globalCompositeOperation]);}};
  FX.draw(target,{x:0,y:0},view);
  assert.equal(canvases.length,1);
  assert.equal(canvases[0].width,512);
  assert.deepEqual(draws,[[canvases[0],'source-over'],[canvases[0],'lighter']]);
  config.fxBatch = 'original';
  FX.draw(target,{x:0,y:0},view);
  assert.equal(canvases.length,3);
  assert.deepEqual(draws.slice(2),[[canvases[1],'source-over'],[canvases[2],'lighter']]);
});

test('reduced motion emits fewer particles than normal motion', () => {
  const normal = loadFx(false), calm = loadFx(true);
  normal.update(1 / 60); calm.update(1 / 60);
  normal.burst(0, 0, '#fff', 40); calm.burst(0, 0, '#fff', 40);
  assert.ok(calm.stats().particles < normal.stats().particles);
});

test('adaptive budget only shrinks below roughly 25fps and recovers afterwards', () => {
  const FX = loadFx();
  for (let i = 0; i < 300; i++) FX.update(1 / 30);
  assert.equal(FX.stats().budget, 1, '30fps screens keep full effects');
  for (let i = 0; i < 600; i++) FX.update(1 / 15);
  assert.equal(FX.stats().budget, 0.5);
  for (let i = 0; i < 1500; i++) FX.update(1 / 60);
  assert.equal(FX.stats().budget, 1);
});

test('FX source avoids per-frame expensive canvas features', () => {
  const src = fs.readFileSync('js/fx.js', 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/shadowBlur|\.filter\s*=/.test(src));
  assert.match(src, /globalCompositeOperation\s*=\s*['"]lighter['"]/);
});

test('crisp skill sprites bake without a radial glow gradient',()=>{
  let bakes=0;
  const paint=new Proxy({createRadialGradient(){throw new Error('unexpected glow');}}, {get:(o,k)=>o[k]??(()=>{})});
  const env={Math,Date,matchMedia:()=>({matches:false}),document:{createElement:()=>({getContext:()=>{bakes++;return paint;}})}};env.window=env;
  vm.runInNewContext(fs.readFileSync('js/fx.js','utf8'),env);
  for(const kind of ['shard','stroke','seal','edge','flame']){env.FX.emit(kind,'#d9ba78',{life:1});env.FX.emit(kind,'#d9ba78',{life:1});}
  assert.equal(bakes,5,'same shape/color is baked once');
});

test('lightning follow-up branches wait for their beat without consuming their visible lifetime',()=>{
  const FX=loadFx();let strokes=0;
  const spy=new Proxy({stroke(){strokes++;}}, {get:(o,k)=>o[k]??(()=>{})});
  FX.bolt(100,100,{life:0.3});FX.bolt(100,100,{life:0.2,delay:0.1});
  FX.draw(spy,{x:0,y:0},view);assert.equal(strokes,3);
  FX.update(0.1);strokes=0;FX.draw(spy,{x:0,y:0},view);assert.equal(strokes,6);
  FX.update(0.11);assert.equal(FX.stats().bolts,2);
  FX.update(0.1);assert.equal(FX.stats().bolts,0);
});

test('air-particle diagnostic skips their images while retaining the same state and lightning strokes',()=>{
  const FX=loadFx();
  FX.emit('glow','#fff',{x:100,y:100,life:1});
  FX.particles()[0].sprite.source={};
  FX.bolt(100,100,{life:1});
  FX.update(.2);
  let images=0, strokes=0;
  const spy=new Proxy({drawImage(){images++;},stroke(){strokes++;}}, {get:(o,k)=>o[k]??(()=>{})});
  const before=FX.stats();
  FX.draw(spy,{x:0,y:0},view,false);
  assert.equal(images,0);
  assert.equal(strokes,3);
  assert.deepEqual(FX.stats(),before);
  FX.draw(spy,{x:0,y:0},view);
  assert.equal(images,1);
});

test('upright unrotated particles use destination coordinates without per-particle Canvas state changes',()=>{
  const FX=loadFx(false,{VIEWPORT:{tiltScale:()=>.5,upright(){throw Error('per-particle state');}}});
  FX.emit('glow','#fff',{x:100,y:120,life:1,s0:20,s1:20});
  FX.particles()[0].sprite.source={};
  FX.update(.25);
  let saves=0;
  const draws=[];
  const spy=new Proxy({save(){saves++;},drawImage(image,...coords){draws.push(coords);}}, {get:(o,k)=>o[k]??(()=>{})});
  FX.draw(spy,{x:0,y:0},view);
  assert.equal(saves,1);
  assert.deepEqual(draws,[[90,100,20,40]]);
});

test('rain-port airborne source-over strokes clip transparent rows without moving their anchors',()=>{
  const args=(stage,rot,blend,ground=false)=>{
    const FX=loadFx(false,{__ACTIVE_STAGE:stage});
    FX.emit('stroke','#fff',{x:100,y:120,life:1,s0:32,s1:32,sx:1.5,rot,blend,ground});
    const source={width:64,height:64};
    FX.particles()[0].sprite.source=source;
    FX.update(.25);
    const draws=[];
    const spy=new Proxy({drawImage(image,...rect){assert.equal(image,source);draws.push(rect);}}, {get:(o,k)=>o[k]??(()=>{})});
    if(ground) FX.drawGround(spy,{x:0,y:0},view);
    else FX.draw(spy,{x:0,y:0},view);
    return draws;
  };
  assert.deepEqual(args('rain-port',0,'source-over'),[[0,20,64,24,76,114,48,12]]);
  assert.deepEqual(args('rain-port',.4,'source-over'),[[0,20,64,24,-24,-6,48,12]]);
  assert.deepEqual(args('rain-port',0,'lighter'),[[76,104,48,32]]);
  assert.deepEqual(args('rain-port',0,'source-over',true),[[76,104,48,32]]);
  assert.deepEqual(args('night-town',0,'source-over'),[[76,104,48,32]]);
});

test('rain-port air sprites switch all existing and future particles to one immutable bitmap per art key',async()=>{
  const canvas={width:0,height:0,getContext:()=>new Proxy({}, {get:()=> ()=>({addColorStop(){}})})};
  const bitmap={width:64,height:64};
  const sources=[];
  let count=0, finish;
  const FX=loadFx(false,{__ACTIVE_STAGE:'rain-port',document:{createElement:()=>canvas},
    PORT_PERF:{registerParticleSource(...args){sources.push(args);}},
    createImageBitmap(source){assert.equal(source,canvas);count++;return new Promise(resolve=>{finish=resolve;});}});
  const spark={x:100,y:120,life:1};
  FX.emit('glow','#fff',spark);
  FX.emit('glow','#fff',spark);
  assert.equal(count,1);
  assert.equal(FX.particles()[0].sprite.source,canvas);
  finish(bitmap);
  await Promise.resolve();
  FX.emit('glow','#fff',spark);
  assert.equal(count,1);
  assert.ok(FX.particles().every(p=>p.sprite.source===bitmap));
  assert.equal(FX.stats().bitmapSprites,1);
  assert.deepEqual(sources,[[canvas,'glow','canvas'],[bitmap,'glow','imageBitmap']]);
});

test('a rejected bitmap request keeps the same drawable source for the rest of the run',async()=>{
  const canvas={width:0,height:0,getContext:()=>new Proxy({}, {get:()=> ()=>({addColorStop(){}})})};
  let attempts=0;
  const FX=loadFx(false,{__ACTIVE_STAGE:'rain-port',document:{createElement:()=>canvas},
    createImageBitmap(){attempts++;return Promise.reject(Error('unsupported source'));}});
  FX.emit('glow','#fff',{life:1});
  await Promise.resolve();
  FX.emit('glow','#fff',{life:1});
  assert.equal(attempts,1);
  assert.equal(FX.stats().bitmapPending,0);
  assert.equal(FX.stats().bitmapFailures,1);
  assert.ok(FX.particles().every(p=>p.sprite.source===canvas));
});
