'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {loadGame} = require('./helpers/game-runtime.cjs');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
const renderer=fs.readFileSync(path.join(root,'js/renderer.js'),'utf8');
const audio=fs.readFileSync(path.join(root,'js/audio.js'),'utf8');

test('B5 needle return leaves after at least 2/3 visible edge, flies curved boomerang path and keeps its sprite angle',()=>{
 const g=loadGame({seed:37});g.start();g.stopSpawns();
 g.combatScene('needle',[],[],1);g.setBuildMutations(['mut_return']);
 let nd=null, takeoff=null, deviation=0, sawReturn=false, sampled=0;
 for(let i=0;i<40;i++){
   g.update(.05);
   if(!nd)nd=g.snapshot().needles[0];
   if(!nd)continue;
   if(nd.returning){
     if(!takeoff)takeoff={x:nd.returnStartX,y:nd.returnStartY};
     sawReturn=true;
     const dX=takeoff.x-nd.originX,dY=takeoff.y-nd.originY;
     const p=Math.max(0,Math.min(1,nd.returnElapsed/nd.returnDuration));
     const lineX=takeoff.x+(nd.originX-takeoff.x)*p;
     const lineY=takeoff.y+(nd.originY-takeoff.y)*p;
     deviation=Math.max(deviation,Math.hypot(nd.x-lineX,nd.y-lineY));
     sampled++;
   }
 }
 assert.ok(nd,'real projectile should be emitted');
 assert.ok(nd.returnDistance>300,'more than 2/3 of the 900px view halfspan, unlike former 220px');
 assert.ok(takeoff && Math.hypot(takeoff.x-nd.originX,takeoff.y-nd.originY)>=nd.returnDistance);
 assert.ok(sawReturn && sampled>4,'return arc had time to fly visibly');
 assert.ok(deviation>40,'return path must bend significantly, not retrace outbound straight path');
 assert.equal(nd.life,0,'returns terminate at player, no indefinite bullets');
 assert.match(game,/ang:nd.hasReturn \? nd.launchAng : Math.atan2\(nd.vy,nd.vx\)/);
});
test('B5 new octagonal shield is real WebP with local-only candidate routing; break has scatter effect',()=>{
 for (const name of ['ward_bagua_full','ward_bagua_break']) {
   const bytes=fs.readFileSync(path.join(root,'assets/img/vfx/shield',name+'.webp'));
   assert.equal(bytes.toString('ascii',0,4),'RIFF');
   assert.equal(bytes.toString('ascii',8,12),'WEBP');
   assert.ok(renderer.includes(name));
 }
 assert.match(renderer,/b3ComfyLocalTrial\(\)/);
 assert.match(renderer,/ctx.scale\(flipX, 1\)/);
 assert.match(renderer,/crackAge/);
});
test('B5 slam uses bottom-aligned painted image, timed debris, one impact SFX route without auto preloading missing file',()=>{
 assert.match(renderer,/const groundBottom = h.y \+ r \* 1.16/);
 assert.match(renderer,/impactLift/);
 assert.match(renderer,/const popScale/);
 assert.match(renderer,/const arcHeight/);
 assert.match(game,/slamWasWarning && e.hazard === h && h.phase === "active"/);
 assert.match(game,/AUDIO.bossSlamImpact\?\.\(\)/);
 assert.match(audio,/bossSlamImpact: "assets\/audio\/sfx\/boss-slam-impact.mp3"/);
 assert.match(audio,/\['fireDragon','fireDragonBall','fireGround','bossSlamImpact','charmPickup'\]/);
});
