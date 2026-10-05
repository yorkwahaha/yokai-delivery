const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function loadFx(reduceMotion = false) {
  const env = { Math, Date, matchMedia: () => ({ matches: reduceMotion }) };
  env.window = env;
  vm.runInNewContext(fs.readFileSync('js/fx.js', 'utf8'), env);
  return env.FX;
}

const view = { left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 };
const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });

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
  FX.particles().forEach(p => { p.s = {}; });
  FX.update(0.3);
  FX.drawGround(spy, { x: 0, y: 0 }, view);
  assert.equal(drawn.length, 1);
  FX.draw(spy, { x: 0, y: 0 }, view);
  assert.equal(drawn.length, 2);
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
