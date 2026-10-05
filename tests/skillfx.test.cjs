const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function load(reduced = false) {
  const env = { Math, Date, matchMedia: () => ({ matches: reduced }) };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['fx', 'skillfx']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  return { FX: env.FX, SKILLFX: env.SKILLFX };
}

const levelFor = {1:1,2:2,3:3,4:4,5:5};
const params = {
  katana: { swing: { x: 0, y: 0, ang: 0, reach: 120 }, hit: { x: 0, y: 0, ang: 0, crit: false } },
  barrier: { cast: { x: 0, y: 0, r: 170 } },
  needle: { fire: { x: 0, y: 0 }, trail: { x: 0, y: 0, ang: 0 }, hit: { x: 0, y: 0 } },
  boom: { trail: { x: 0, y: 0 }, hit: { x: 0, y: 0, target: { hp: 5, x: 0, y: 0 } } },
  fire: { ember: { x: 0, y: 0, ang: 0 }, hit: { x: 0, y: 0 } },
  thunder: { strike: { x: 0, y: 0 } }
};

test('all five levels retain local glow and crisp marks without fullscreen flashes',()=>{
  const {FX,SKILLFX}=load();let flashes=0;FX.flash=()=>flashes++;
  for(const [id,events] of Object.entries(params))for(const event of Object.keys(events))for(const level of [1,2,3,4,5]) {
    FX.reset();SKILLFX.play(id,event,level,params[id][event]);
    const glows=FX.particles().filter(p=>p.kind==='glow');
    if(!['trail','ember'].includes(event))assert.ok(glows.length>0,`${id}.${event}: needs local glow`);
    for(const p of glows)assert.ok(Math.max(p.s0,p.s1)<=190 && p.a<=0.32,`${id}.${event}: excessive halo`);
    assert.ok(FX.particles().filter(p=>p.kind!=='glow').every(p=>p.blend==='source-over'),`${id}.${event}: skill layers should not bleach actors by additive blending`);
    assert.ok(FX.particles().some(p=>['shard','stroke','seal','edge','flame'].includes(p.kind)),`${id}.${event}: needs a readable solid silhouette`);
  }
  assert.equal(flashes,0);
});

test('needle and foxfire bodies have five distinct silhouettes with bounded local glow',()=>{
  const {FX,SKILLFX}=load();const halos=[];FX.glow=(ctx,x,y,size,color,a)=>halos.push({size,a});
  const shapes=[];let commands=[];
  const ctx=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>commands.push([k,...args]))});
  for(const id of ['needle','fire']) {
    const sizes=[];
    for(const level of [1,2,3,4,5]){commands=[];SKILLFX.paint(ctx,id,level,{x:0,y:0,ang:0,spin:0,origin:{x:0,y:0},orbitR:98,time:0});shapes.push(JSON.stringify(commands));sizes.push(commands.length);}
    assert.equal(new Set(shapes.slice(-5)).size,5,`${id}: every rank needs distinct geometry`);
  }
  assert.ok(halos.some(h=>h.a>0.12));assert.ok(halos.every(h=>h.size<=86 && h.a<=0.32));
});

test('reduced motion retains tier structure with static short-lived accents',()=>{
  const {FX,SKILLFX}=load(true);FX.update(1/60);
  SKILLFX.play('barrier','cast',5,{x:0,y:0,r:170});
  const runes=FX.particles().filter(p=>p.kind?.startsWith('rune'));
  assert.ok(runes.length>=2);assert.ok(runes.every(p=>p.vr===0 && p.s0===p.s1));
});

test('reduced motion keeps the actual thunder domain size instead of a tiny initial circle',()=>{
  const {FX,SKILLFX}=load(true);FX.update(1/60);SKILLFX.play('thunder','storm',5,{x:0,y:0,r:380});
  const floor=FX.particles().find(p=>p.kind==='storm');assert.equal(floor.s0,760);assert.equal(floor.s1,760);
});

// 每個技能事件重複觸發多次，取平均以避開隨機數量與 count() 的取整。
function sample(level, id, event, runs = 60) {
  const { FX, SKILLFX } = load();
  let alpha = 0, n = 0;
  for (let i = 0; i < runs; i++) {
    FX.reset();
    SKILLFX.play(id, event, level, { ...params[id][event] });
    for (const p of FX.particles()) { alpha += p.a * Math.max(p.s0, p.s1) * (p.sx || 1); n++; }
    alpha += FX.stats().bolts * 200;
  }
  return { power: alpha / runs, particles: n / runs };
}

test('each level now has a distinct rank', () => {
  const { SKILLFX } = load();
  assert.deepEqual([1, 2, 3, 4, 5].map(SKILLFX.tier), [1,2,3,4,5]);
  assert.deepEqual([1,2,3,4,5].map(l=>SKILLFX.pick(l,'a','b','c','d','e')),['a','b','c','d','e']);
});

test('every skill grows across all five levels', () => {
  for (const [id, events] of Object.entries(params)) {
    for (const event of Object.keys(events)) {
      const values=[1,2,3,4,5].map(l=>sample(l,id,event).power),[a,b,c]=values;
      assert.ok(a > 0, `${id}.${event} tier 1 should still show something`);
      assert.ok(a <= b + 1e-6 && b <= c + 1e-6, `${id}.${event} must not shrink with level (${a.toFixed(1)}, ${b.toFixed(1)}, ${c.toFixed(1)})`);
      for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1],`${id}.${event} Lv${i+1}: ${values}`);
    }
  }
});

test('katana tier 1 is far subtler than the old always-max look', () => {
  const weak = sample(1, 'katana', 'hit').power, max = sample(5, 'katana', 'hit').power;
  assert.ok(weak < max * 0.45, `${weak} vs ${max}`);
});

test('purification array is a flattened ground ellipse behind actors with an asymmetric rune per tier', () => {
  const { FX, SKILLFX } = load();
  for (const level of [1, 3, 5]) {
    FX.reset();
    SKILLFX.play('barrier', 'cast', level, { x: 0, y: 0, r: 170 });
    const ground = FX.particles().filter(p => p.ground);
    assert.ok(ground.length >= 3, 'rings, rune and glow are on the ground layer');
    assert.ok(ground.every(p => p.sy === SKILLFX.SQ && p.sy < 1), 'ground pattern is squashed vertically');
    assert.ok(ground.some(p => p.rot !== 0 || p.vr !== 0), 'rune rotates inside the ground plane');
  }
  const src = fs.readFileSync('js/fx.js', 'utf8');
  assert.match(src, /function runeArt/);
  assert.match(src, /rnd1/, 'rune strokes use seeded jitter instead of regular symmetry');
});

test('rune sprites differ per tier so Lv5 gets a more elaborate array', () => {
  const { FX, SKILLFX } = load();
  const kinds = level => { FX.reset(); SKILLFX.play('barrier', 'cast', level, { x: 0, y: 0, r: 170 }); return FX.particles().filter(p => p.vr).length; };
  assert.ok(kinds(5) > kinds(1), 'MAX layers a second counter-rotating rune');
});

test('thunder inherits the old strongest strike at Lv3 and adds a domain at Lv5', () => {
  const { FX, SKILLFX } = load();
  const calls = [];
  const emit = FX.emit;
  for (const level of [1, 3, 5]) {
    FX.reset();
    SKILLFX.play('thunder', 'strike', level, { x: 0, y: 0 });
    calls.push(FX.stats().bolts);
  }
  assert.deepEqual(calls.map(n=>n>1),[false,true,true]);
  const src = fs.readFileSync('js/skillfx.js', 'utf8');
  const thunder = src.slice(src.indexOf('define("thunder"'), src.indexOf('// 小火焰附著'));
  FX.reset();SKILLFX.play('thunder','storm',5,{x:0,y:0,r:380});
  assert.ok(FX.particles().some(p=>p.kind==='storm'&&p.ground));
  void emit;
});

test('fire talisman ignites targets at Lv1-4 and explodes at Lv5', () => {
  const { FX, SKILLFX } = load();
  const target = { hp: 10, x: 50, y: 50, type: 'ghost' };
  SKILLFX.play('boom', 'hit', 1, { x: 50, y: 50, target });
  FX.reset();
  for (let i = 0; i < 20; i++) SKILLFX.update(0.1);
  assert.ok(FX.particles().some(p => p.x !== 0), 'burning flames spawn on the target');
  FX.reset(); SKILLFX.reset();
  SKILLFX.play('boom', 'hit', 3, { x: 0, y: 0, target });
  assert.ok(FX.particles().every(p => !p.ground || p.sy < 1));
  const small = FX.stats().particles;
  FX.reset(); SKILLFX.reset();
  SKILLFX.play('boom', 'hit', 5, { x: 0, y: 0, target });
  const explosion = FX.particles();
  assert.ok(explosion.some(p => p.kind==='edge' && p.s1>=200), 'MAX expands a thin fracture outline instead of a diffuse flash');
  assert.ok(explosion.length > small);
  FX.reset();
  for (let i = 0; i < 20; i++) SKILLFX.update(0.1);
  assert.equal(FX.stats().particles, 0, 'MAX hit does not leave the target burning');
});

test('burning stops when the target dies and the list stays bounded', () => {
  const { FX, SKILLFX } = load();
  const victims = Array.from({ length: 40 }, () => ({ hp: 3, x: 0, y: 0 }));
  victims.forEach(v => SKILLFX.play('boom', 'hit', 1, { x: 0, y: 0, target: v }));
  SKILLFX.update(0.1);
  assert.ok(FX.stats().particles <= 24 * 2 + 3 * 40 + 40 * 8, 'bounded');
  victims.forEach(v => { v.hp = 0; });
  FX.reset();
  SKILLFX.update(0.2);
  assert.equal(FX.stats().particles, 0);
});

test('new skills can be registered without touching fx.js', () => {
  const { FX, SKILLFX } = load();
  SKILLFX.define('demo', { cast(tier, p) { FX.emit('glow', '#fff', { x: p.x, y: p.y, life: 1, s0: 10 * tier, s1: 10 * tier }); } });
  assert.ok(SKILLFX.has('demo'));
  SKILLFX.play('demo', 'cast', 5, { x: 1, y: 2 });
  assert.equal(FX.particles()[0].s0, 50);
  assert.doesNotThrow(() => SKILLFX.play('missing', 'cast', 1, {}));
});

test('game wires every weapon through SKILLFX and draws the ground layer before actors', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  for (const call of ['"katana", "swing"', '"katana", "hit"', '"barrier", "cast"', '"needle", "fire"', '"needle", "trail"', '"needle", "hit"', '"boom", "trail"', '"boom", "hit"', '"fire", "ember"', '"fire", "hit"', '"thunder", "strike"']) {
    assert.ok(game.replace(/\s/g,'').includes(`SKILLFX.play(${call}`.replace(/\s/g,'')), call);
  }
  assert.ok(game.includes('SKILLFX.paint(ctx, "fire", WL.fire'));
  assert.ok(game.indexOf('FX.drawGround(') < game.indexOf('const actors = ['));
  assert.ok(game.indexOf('FX.drawGround(') > 0 && game.indexOf('FX.draw(ctx, cam, view)') > game.indexOf('renderLighting'));
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('js/fx.js') < html.indexOf('js/skillfx.js') && html.indexOf('js/skillfx.js') < html.indexOf('js/game.js'));
});
