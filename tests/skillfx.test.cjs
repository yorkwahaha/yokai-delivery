const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function load(reduced = false) {
  const env = { Math, Date, ART:{}, matchMedia: () => ({ matches: reduced }) };
  env.window = env;
  const c = vm.createContext(env);
  for (const name of ['fx', 'skillfx']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), c);
  return { FX: env.FX, SKILLFX: env.SKILLFX, env };
}

test('all new MAX effect sprites bake nonempty canvases',()=>{
  const gradient={addColorStop(){}};
  const ctx=new Proxy({createRadialGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
  const env={Math,Date,document:{createElement:()=>({width:0,height:0,getContext:()=>ctx})},matchMedia:()=>({matches:false})};env.window=env;
  vm.runInNewContext(fs.readFileSync('js/fx.js','utf8'),env);
  for(const kind of ['drum','rock','yin','current']){
    env.FX.emit(kind,'#ffffff',{x:0,y:0,life:1});const p=env.FX.particles().at(-1);
    assert.ok(p.s.width>0&&p.s.height>0,kind+' needs a drawable sprite');
  }
});

const levelFor = {1:1,2:2,3:3,4:4,5:5};
const params = {
  katana: { swing: { x: 0, y: 0, ang: 0, reach: 120 }, hit: { x: 0, y: 0, ang: 0, crit: false } },
  barrier: { cast: { x: 0, y: 0, r: 170 } },
  needle: { fire: { x: 0, y: 0 }, trail: { x: 0, y: 0, ang: 0 }, hit: { x: 0, y: 0 } },
  boom: { trail: { x: 0, y: 0 }, hit: { x: 0, y: 0, target: { hp: 5, x: 0, y: 0 } } },
  fire: { ember: { x: 0, y: 0, ang: 0 }, hit: { x: 0, y: 0 } },
  thunder: { strike: { x: 0, y: 0 } }
};

test('MAX sword wave keeps ranked art orientation while rotating it with travel direction',()=>{
  const {FX,SKILLFX,env}=load();SKILLFX.play('wind','trail',5,{x:0,y:0,ang:0});assert.equal(FX.particles().length,0);
  const art={naturalWidth:261,naturalHeight:300},drawn=[],rotations=[],scales=[];
  env.ART.katana_l5=art;env.skillVfxArt=(id,rank)=>id==='katana'&&rank===5?art:null;
  const ctx=new Proxy({
    drawImage:(...p)=>drawn.push(p),
    rotate:a=>rotations.push(a),
    scale:(x,y)=>scales.push([x,y])
  }, {get:(o,k)=>o[k]||(()=>{})});
  SKILLFX.paint(ctx,'wind',5,{x:0,y:0,ang:0,size:360});
  SKILLFX.paint(ctx,'wind',5,{x:0,y:0,ang:Math.PI,size:360});
  assert.ok(drawn.some(p=>p[0]===art),'MAX projectile must use the same hand-painted blade asset');
  assert.equal(scales.filter(([x,y])=>x===-1&&y===1).length,0,'ranked projectile art is already oriented correctly and must not be mirrored');
  assert.ok(Math.abs(rotations[0])<1e-9,'rightward projectile points the convex edge toward +X');
  assert.ok(Math.abs(Math.abs(rotations[1])-Math.PI)<1e-9,'leftward projectile rotates the same source art toward -X');
  delete env.ART.katana_l5;delete env.skillVfxArt;
  const arcs=[];ctx.arc=(...p)=>arcs.push(p);SKILLFX.paint(ctx,'wind',5,{x:0,y:0,ang:0,size:360});
  assert.ok(arcs.some(p=>p[2]>250),'asset failure keeps the procedural fallback');
});

test('the other five skills composite their ukiyo-e assets while retaining effect logic',()=>{
  const {SKILLFX,env}=load(),drawn=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(img){drawn.push(img);}};
  const keys=['barrier_mandala_ukiyoe','needle_hama_ukiyoe','needle_ice_ukiyoe','ofuda_ukiyoe','taiji_ofuda_ukiyoe','foxfire_ukiyoe','foxfire_dragon_ukiyoe','thunder_ukiyoe','thunder_drum_ukiyoe'];
  for(const key of keys)env.ART[key]={key,naturalWidth:128,naturalHeight:128};

  SKILLFX.paint(ctx,'needle',3,{x:0,y:0,ang:0});
  SKILLFX.paint(ctx,'needle',5,{x:0,y:0,ang:0});
  SKILLFX.paint(ctx,'boom',3,{x:0,y:0,spin:0});
  SKILLFX.paint(ctx,'boom',5,{x:0,y:0,spin:0});
  SKILLFX.paint(ctx,'fire',3,{x:20,y:0,ang:0,origin:{x:0,y:0},orbitR:98,time:0});
  SKILLFX.paint(ctx,'fire',5,{x:20,y:0,ang:0,points:[{x:-20,y:0},{x:0,y:0},{x:20,y:0}]});
  SKILLFX.play('barrier','cast',3,{x:0,y:0,r:170});
  SKILLFX.play('thunder','strike',3,{x:0,y:0,delay:0});
  SKILLFX.play('thunder','storm',5,{x:0,y:0,r:380});
  SKILLFX.drawArtFx(ctx,true);SKILLFX.drawArtFx(ctx,false);

  for(const key of keys)assert.ok(drawn.includes(env.ART[key]),key+' must reach drawImage');
});

test('ranked skill rasters keep Lv4 and Lv5 as independent art slots',()=>{
  const {SKILLFX,env}=load(),drawn=[];
  env.skillVfxKey=(id,rank)=>id+'_l'+rank;
  env.skillVfxArt=(id,rank)=>env.ART[id+'_l'+rank]||null;
  const ctx=new Proxy({globalAlpha:1,drawImage(img){drawn.push(img);}},{get:(o,k)=>o[k]??(()=>{})});
  for(const key of ['needle_l4','boom_l4','fire_l4','barrier_l5','thunder_l5'])env.ART[key]={key,naturalWidth:192,naturalHeight:192};
  SKILLFX.paint(ctx,'needle',4,{x:0,y:0,ang:0});
  SKILLFX.paint(ctx,'boom',4,{x:0,y:0,spin:0});
  SKILLFX.paint(ctx,'fire',4,{x:20,y:0,ang:0,origin:{x:0,y:0},orbitR:98,time:0});
  SKILLFX.play('barrier','cast',5,{x:0,y:0,r:170});
  SKILLFX.play('thunder','storm',5,{x:0,y:0,r:380});
  SKILLFX.drawArtFx(ctx,true);SKILLFX.drawArtFx(ctx,false);
  for(const key of ['needle_l4','boom_l4','fire_l4','barrier_l5','thunder_l5'])assert.ok(drawn.includes(env.ART[key]),key+' must keep its exact rank');
});

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
  const rocks=FX.particles().filter(p=>p.kind==='rock');
  assert.equal(rocks.length,8);assert.ok(rocks.every(p=>p.vx===0&&p.vy===0&&p.s0===p.s1));
});

test('thunder removes the player floor domain and places local currents on strike points',()=>{
  const {FX,SKILLFX}=load(true);FX.update(1/60);SKILLFX.play('thunder','storm',5,{x:0,y:0,r:380});
  assert.ok(!FX.particles().some(p=>p.kind==='storm'));
  SKILLFX.play('thunder','strike',5,{x:150,y:70,stormChild:true});
  const current=FX.particles().find(p=>p.kind==='current');assert.equal(current.x,150);assert.equal(current.y,70);assert.ok(current.s1<160);
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

test('MAX purification replaces rune layers with eight outward stone pillars', () => {
  const { FX, SKILLFX } = load();
  SKILLFX.play('barrier','cast',5,{x:0,y:0,r:170});
  const rocks=FX.particles().filter(p=>p.kind==='rock');assert.equal(rocks.length,8);
  assert.ok(rocks.every(p=>p.foot&&p.x*p.vx+p.y*p.vy>0));
});

test('thunder retains lower-tier strikes and uses the airborne cloud raster at MAX', () => {
  const { FX, SKILLFX, env } = load();
  const calls = [];
  for (const level of [1, 3, 5]) {
    FX.reset();
    SKILLFX.play('thunder', 'strike', level, { x: 0, y: 0 });
    calls.push(FX.stats().bolts);
  }
  assert.deepEqual(calls.map(n=>n>1),[false,true,true]);
  const cloud={key:'thunder_drum_ukiyoe',naturalWidth:256,naturalHeight:160};
  env.ART.thunder_drum_ukiyoe=cloud;
  const drawn=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(img){drawn.push(img);}};
  FX.reset();SKILLFX.play('thunder','storm',5,{x:0,y:0,r:380});SKILLFX.drawArtFx(ctx,false);
  assert.ok(drawn.includes(cloud));assert.ok(!FX.particles().some(p=>p.kind==='storm'));
});

test('foxfire raster remains upright around the orbit and adds upward secondary flame motion',()=>{
  const {FX,SKILLFX,env}=load();const fox={naturalWidth:80,naturalHeight:120};env.ART.foxfire_ukiyoe=fox;
  const rotations=[],draws=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(a){rotations.push(a);},scale(){},drawImage(img){draws.push(img);}};
  SKILLFX.paint(ctx,'fire',5,{x:20,y:10,ang:Math.PI,origin:{x:0,y:0},orbitR:98,time:0,orbit:true});
  assert.ok(draws.includes(fox));assert.ok(rotations.every(a=>Math.abs(a)<1e-9),'orbit angle must not rotate the flame upside down');
  SKILLFX.play('fire','ember',5,{x:20,y:10,ang:Math.PI,vx:100,vy:0});
  const flames=FX.particles().filter(p=>p.kind==='flame');assert.ok(flames.length>=3);assert.ok(flames.every(p=>p.vy<0));
});

test('foxfire ranked sprites breathe and mirror with the courier facing direction',()=>{
  const {SKILLFX,env}=load(),orbit={naturalWidth:512,naturalHeight:512},attack={naturalWidth:512,naturalHeight:512};
  env.skillVfxVariantArt=(id,variant,rank)=>id==='fire'&&rank===4?(variant==='orbit'?orbit:variant==='attack'?attack:null):null;
  const scales=[],rotations=[],draws=[];
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(a){rotations.push(a);},scale(x,y){scales.push([x,y]);},drawImage(img){draws.push(img);}};
  SKILLFX.paint(ctx,'fire',4,{x:20,y:10,ang:0.5,origin:{x:0,y:0,faceX:1},orbitR:98,time:.23,orbit:true});
  const orbitRight=scales.at(-1);
  SKILLFX.paint(ctx,'fire',4,{x:20,y:10,ang:0.5,origin:{x:0,y:0,faceX:-1},orbitR:98,time:.23,orbit:true});
  const orbitLeft=scales.at(-1);
  assert.ok(draws.includes(orbit));assert.ok(orbitRight[0]>0&&orbitLeft[0]<0,'orbit sprite mirrors with courier faceX');
  assert.ok(Math.abs(orbitRight[0])>=.92&&Math.abs(orbitRight[0])<=1.06&&orbitRight[1]>=.94&&orbitRight[1]<=1.12,'orbit breathing stays subtle');

  scales.length=0;rotations.length=0;draws.length=0;
  SKILLFX.paint(ctx,'ghost',4,{fireAttack:true,level:4,x:40,y:20,ang:.6,age:.31,vx:360,vy:80,faceX:-1});
  const attackScale=scales.at(-1);
  assert.ok(draws.includes(attack));assert.ok(attackScale[0]<-1.06&&attackScale[0]>=-1.22,'attack sprite stretches forward while facing left');
  assert.ok(attackScale[1]>=.88&&attackScale[1]<=.98,'attack sprite compresses across its flight stretch');
  assert.ok(Math.abs(rotations.at(-1))<.2,'attack keeps a readable left/right facing with only a mild flight tilt');
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

test('MAX sword raster uses 80 percent opacity while keeping the projectile visible',()=>{
  const {SKILLFX,env}=load(),passes=[],stack=[];
  const img={naturalWidth:250,naturalHeight:300};
  env.ART.katana_l5=img;
  env.skillVfxArt=(id,rank)=>id==='katana'&&rank===5?img:null;
  const ctx={
    globalAlpha:1,
    save(){stack.push(this.globalAlpha);},
    restore(){this.globalAlpha=stack.pop();},
    translate(){},rotate(){},scale(){},
    drawImage(){passes.push(this.globalAlpha);}
  };
  SKILLFX.paint(ctx,'wind',5,{x:0,y:0,ang:0,size:360});
  assert.ok(passes.includes(0.8),'main wind projectile must be exactly 80 percent opaque');
  assert.ok(passes.every(alpha=>alpha<=0.8),'ghost trail must remain subtle');
  assert.equal(ctx.globalAlpha,1,'canvas alpha must be restored');
});

test('large dragon image is rendered at the provided cinematic size',()=>{
  const {SKILLFX,env}=load(),draws=[];
  const img={naturalWidth:300,naturalHeight:180};
  env.ART.foxfire_dragon_ukiyoe=img;
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){draws.push(args);}};
  SKILLFX.paint(ctx,'ghost',5,{dragon:true,x:0,y:0,ang:0,age:1.5,size:380});
  assert.equal(draws.length,1);
  assert.equal(draws[0][3],380);
});
