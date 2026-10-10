const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const AI=fs.existsSync('js/boss-ai.js')?require('../js/boss-ai.js'):{};
function fresh(index=0,final=false) {
  assert.equal(typeof AI.start,'function','new boss attack controller is missing');
  assert.equal(typeof AI.step,'function');
  return {x:0,y:0,hp:final?1400:300,max:final?1400:300,bossIndex:index,final,shield:false};
}
const player=()=>({x:180,y:0});
function run(e,p,seconds,options={}) {
  const events=[];
  for(let left=seconds;left>1e-9;){const dt=Math.min(.01,left);events.push(AI.step(e,p,dt,options));left-=dt;}
  return events;
}
test('V3 Boss AI: slam locks the original target during its warning',()=>{
  const e=fresh(),p=player();AI.start(e,p,'night-town');const {x,y,angle}=e.hazard;
  p.x=-180;p.y=180;run(e,p,.8);
  assert.equal(e.hazard.kind,'slam');assert.equal(e.hazard.phase,'telegraph');
  assert.equal(e.hazard.x,x);assert.equal(e.hazard.y,y);assert.equal(e.hazard.angle,angle);
});
test('V3 Boss AI: locked slam hits once and opens a recovery window',()=>{
  const e=fresh(),p=player();AI.start(e,p,'night-town');const hits=run(e,p,1.3).filter(r=>r.hit);
  assert.equal(hits.length,1);assert.equal(hits[0].hit.damage,20);assert.equal(e.hazard.phase,'recovery');
  assert.ok(e.hazard.duration>=1.2&&e.hazard.duration<=1.5);assert.equal(run(e,p,.9).filter(r=>r.hit).length,0);
});
test('V3 Boss AI: moving away from a locked ground strike avoids the hit',()=>{
  const e=fresh(),p=player();AI.start(e,p,'night-town');p.x=500;
  assert.equal(run(e,p,1.3).filter(r=>r.hit).length,0);
});
test('V3 Boss AI: shielding and reading pause stop attacks and timers',()=>{
  const e=fresh(),p=player();e.shield=true;run(e,p,2);assert.ok(!e.hazard);
  e.shield=false;AI.start(e,p,'night-town');const before=JSON.stringify(e);
  run(e,p,2,{paused:true});assert.equal(JSON.stringify(e),before);
  AI.step(e,p,0);assert.equal(JSON.stringify(e),before);
});
test('V3 Boss AI: second boss alternates ground strike and straight charge',()=>{
  const e=fresh(1),p=player();AI.start(e,p,'night-town');assert.equal(e.hazard.kind,'slam');
  run(e,{x:1000,y:1000},3);AI.start(e,p,'night-town');assert.equal(e.hazard.kind,'charge');
  const locked=e.hazard.angle;p.y=500;run(e,p,.9);assert.equal(e.hazard.angle,locked);
});
test('V3 Boss AI: charge uses swept wall collision and cannot cross a thin building',()=>{
  const e=fresh(1),p=player();AI.start(e,p,'night-town');run(e,{x:1000,y:1000},3);
  AI.start(e,p,'night-town');run(e,p,1.8,{blocked:(x,y)=>x>=65&&x<=75});
  assert.ok(e.x<65,`charge crossed wall at ${e.x}`);assert.equal(e.hazard.phase,'recovery');
});
test('V3 Boss AI: full-health final boss has no ring and half-health unlocks one',()=>{
  const p=player(),e=fresh(3,true);const before=[];
  for(let i=0;i<4;i++){AI.start(e,p,'night-town');before.push(e.hazard.kind);run(e,{x:1000,y:1000},3);}
  assert.ok(!before.includes('ring'));
  e.hp=650;const after=[];
  for(let i=0;i<4;i++){AI.start(e,p,'night-town');after.push(e.hazard.kind);run(e,{x:1000,y:1000},3);}
  assert.ok(after.includes('ring'));
});
function ring() {
  const e=fresh(3,true);e.hp=650;const p=player();
  for(let i=0;i<5;i++){AI.start(e,p,'night-town');if(e.hazard.kind==='ring')return e;run(e,{x:1000,y:1000},3);}
  assert.fail('half-health final boss never offered a ring');
}
test('V3 Boss AI: ring has a real gap and hits an unsafe swept annulus only once',()=>{
  const safe=ring(),a=safe.hazard.gapAngle,c={x:safe.hazard.x,y:safe.hazard.y};
  const p={x:c.x+Math.cos(a)*220,y:c.y+Math.sin(a)*220};
  assert.equal(run(safe,p,2).filter(r=>r.hit).length,0);
  const unsafe=ring(),b=unsafe.hazard.gapAngle+Math.PI;
  const q={x:unsafe.hazard.x+Math.cos(b)*220,y:unsafe.hazard.y+Math.sin(b)*220};
  const hits=run(unsafe,q,2).filter(r=>r.hit);assert.equal(hits.length,1);
});
test('V3 Boss AI: tide is exclusive to the port and keeps a safe lane',()=>{
  const e=fresh(3,true),p=player();const kinds=[];let tide;
  for(let i=0;i<6;i++){AI.start(e,p,'rain-port');kinds.push(e.hazard.kind);if(e.hazard.kind==='tide'){tide=e;break;}run(e,{x:1000,y:1000},3);}
  assert.ok(tide,'port boss must offer a tide');const h=tide.hazard;
  assert.ok(h.safeWidth>=90);const a=h.angle;
  const safe={x:h.x-Math.sin(a)*h.safeOffset,y:h.y+Math.cos(a)*h.safeOffset};
  assert.equal(run(tide,safe,2.2,{stageId:'rain-port'}).filter(r=>r.hit).length,0);
});
test('V3 Boss AI: warning, impact and recovery never overlap a second main attack',()=>{
  const e=fresh(1),p=player();AI.start(e,p,'night-town');const original=e.hazard;
  for(let i=0;i<10;i++){AI.start(e,p,'night-town');assert.equal(e.hazard,original);AI.step(e,p,.05);}
  assert.equal(e.hazard.kind,'slam');
});
