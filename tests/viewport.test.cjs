const test = require('node:test');
const assert = require('node:assert/strict');
const viewport = require('../js/viewport.js');
test('2D↔2.5D camera tilt interpolates smoothly and can reverse mid-transition',()=>{
  const previous=global.location;
  try {
    global.location={search:''}; viewport.setTiltScale(0.6);
    assert.equal(viewport.animateTiltScale(1,0.8),0.6);
    assert.equal(viewport.tiltTargetScale(),1);
    viewport.advanceTilt(0.2);
    assert.ok(viewport.tiltScale()>0.6&&viewport.tiltScale()<1);
    const quarter=viewport.tiltScale();
    viewport.advanceTilt(0.2);
    assert.ok(viewport.tiltScale()>quarter);
    assert.ok(Math.abs(viewport.tiltScale()-0.8)<1e-6,'smoothstep midpoint');
    const midpoint=viewport.tiltScale();
    viewport.animateTiltScale(0.6,0.8);
    assert.equal(viewport.tiltScale(),midpoint,'reverse begins without any jump');
    viewport.advanceTilt(0.4);
    assert.ok(viewport.tiltScale()>0.6&&viewport.tiltScale()<midpoint);
    assert.equal(viewport.spacingScaleY(),1.2,'world layout never changes during tween');
    viewport.advanceTilt(0.4);
    assert.equal(viewport.tiltScale(),0.6);
    assert.equal(viewport.tiltTargetScale(),0.6);
    assert.equal(viewport.animateTiltScale(1,0),1,'reduced motion bypasses animation');
  }finally{viewport.setTiltScale(null);global.location=previous;}
});

test('live projection switch preserves stage geometry and supports reset without reload',()=>{
  const previous=global.location;
  try {
    global.location={search:''};
    viewport.setTiltScale(null);
    assert.equal(viewport.tiltScale(),0.6);
    assert.equal(viewport.spacingScaleY(),1.2);
    assert.equal(viewport.setTiltScale(1),1);
    assert.equal(viewport.tiltScale(),1);
    assert.equal(viewport.spacingScaleY(),1.2,'running stage must retain its world layout');
    assert.equal(viewport.worldBounds().height,viewport.bounds().height);
    assert.equal(viewport.setTiltScale(0.6),0.6);
    assert.equal(viewport.worldBounds().height,viewport.bounds().height/0.6);
    assert.equal(viewport.setTiltScale(0.25),0.6,'other tilts cannot be selected at runtime');
  } finally {
    viewport.setTiltScale(null);
    global.location=previous;
  }
});

test('playable 0.60 default, explicit 2D fallback and coordinate reversibility',()=>{
  const old=global.location;
  viewport.setTiltScale(null);
  try {
    for(const [query,k,spacing] of [['',.6,1.2],['?tilt=0.85',.85,1],['?tilt=0.70',.7,1],['?tilt=0.60',.6,1.2],['?tilt=0.60&spacing=1',.6,1],['?tilt=1',1,1],['?tilt=off',1,1],['?tilt=0.01',.6,1.2]]) {
      global.location={search:query};
      assert.equal(viewport.tiltScale(),k);
      assert.equal(viewport.spacingScaleY(),spacing);
      const cam={x:500,y:290},shake={x:4,y:-2};
      const s=viewport.worldToScreen(703,444,cam,shake);
      assert.equal(s.x,207);
      assert.ok(Math.abs(s.y-152*k)<1e-8);
      const w=viewport.screenToWorld(s.x,s.y,cam,shake);
      assert.ok(Math.abs(w.x-703)<1e-8&&Math.abs(w.y-444)<1e-8);
      const a=viewport.bounds(),b=viewport.worldBounds();
      assert.equal(b.width,a.width);
      assert.ok(Math.abs(b.height-a.height/k)<1e-8);
      const events=[],ctx={save(){events.push('save')},restore(){events.push('restore')},translate(x,y){events.push(['translate',x,y])},scale(x,y){events.push(['scale',x,y])}};
      viewport.upright(ctx,20,40,()=>events.push('draw'));
      assert.deepEqual(events,k===1?['draw']:['save',['translate',20,40],['scale',1,1/k],['translate',-20,-40],'draw','restore']);
    }
  }finally{global.location=old;viewport.setTiltScale(null);}
});


test('viewport and bounds reuse their objects until window dimensions change',()=>{
  const oldW=global.innerWidth,oldH=global.innerHeight;
  try{
    global.innerWidth=568;global.innerHeight=320;
    const v=viewport.get(),b=viewport.bounds(),h=viewport.hudBounds();
    for(let i=0;i<100;i++){assert.equal(viewport.get(),v);assert.equal(viewport.bounds(),b);assert.equal(viewport.hudBounds(),h);}
    global.innerWidth=844;assert.notEqual(viewport.get(),v);assert.notEqual(viewport.bounds(),b);assert.notEqual(viewport.hudBounds(),h);
  }finally{global.innerWidth=oldW;global.innerHeight=oldH;}
});
test('fullscreen preserves uniform scale and keeps the complete interface visible', () => {
  for (const [w, h] of [[844,390], [1280,800], [1920,1080], [1024,768], [390,844]]) {
    const v = viewport.calculate(w,h);
    assert.ok(Math.abs(v.width * v.scale - w) < 0.001);
    assert.ok(Math.abs(v.height * v.scale - h) < 0.001);
    assert.ok(v.width >= 900 && v.height >= 600);
    assert.ok(Math.abs((450 + v.offsetX) * v.scale - w/2) < 0.001);
    assert.ok(Math.abs((300 + v.offsetY) * v.scale - h/2) < 0.001);
  }
});

test('each HUD edge adds exactly 20 CSS pixels across screen scales', () => {
  const oldW = global.innerWidth, oldH = global.innerHeight;
  try {
    for (const [w, h] of [[844,390], [1024,768], [1920,1080]]) {
      global.innerWidth = w; global.innerHeight = h;
      const b = viewport.bounds(), hud = viewport.hudBounds(), { scale } = viewport.get();
      for (const distance of [hud.left-b.left, hud.top-b.top, b.right-hud.right, b.bottom-hud.bottom]) {
        assert.ok(Math.abs(distance * scale - 20) < 0.001);
      }
    }
  } finally { global.innerWidth = oldW; global.innerHeight = oldH; }
});
