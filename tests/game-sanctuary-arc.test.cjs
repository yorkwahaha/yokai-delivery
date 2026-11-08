'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {draw}=require('../js/game-sanctuary-arc.js');

const context=()=>{
  const calls=[];
  const ctx={
    globalAlpha:1,
    save(){calls.push('save');},
    restore(){calls.push('restore');},
    translate(x,y){calls.push(['translate',x,y]);},
    scale(x,y){calls.push(['scale',x,y]);},
    createLinearGradient(){calls.push('gradient');return {addColorStop(){}};},
    beginPath(){calls.push('beginPath');},
    moveTo(x,y){calls.push(['moveTo',x,y]);},
    bezierCurveTo(...values){calls.push(['bezier',...values]);},
    ellipse(...values){calls.push(['ellipse',...values]);},
    closePath(){calls.push('closePath');},
    fill(){calls.push('fill');},
    stroke(){calls.push('stroke');}
  };
  return {ctx,calls};
};

test('the sanctified Lv5 dome is visual-only and never renders for levels 1–4',()=>{
  const {ctx,calls}=context();
  const base={x:0,y:0,r:220,life:1,maxLife:1.8};
  for(const level of [0,1,2,3,4]){
    assert.equal(draw(ctx,{...base,level},0,.6),false);
  }
  assert.deepEqual(calls,[]);
  assert.equal(draw(ctx,{...base,level:5,life:0},0,.6),false);
});

test('Lv5 has an airy curved dome above the ground art with saved canvas state',()=>{
  const {ctx,calls}=context();
  assert.equal(draw(ctx,{level:5,x:250,y:350,r:220,life:1,maxLife:1.8},2,.6),true);
  assert.equal(calls[0],'save');
  assert.equal(calls.at(-1),'restore');
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='bezier'));
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='ellipse'));
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='translate'&&v[1]===250&&v[2]===350));
  assert.ok(calls.filter(v=>v==='stroke').length<=2,'the effect should not stack giant rings');
  assert.equal(calls.filter(v=>v==='fill').length,1,'translucent shell uses just one gradient');
});

test('Lv5 canopy overlays the courier after lighting but stays below the game HUD',()=>{
 const game=fs.readFileSync('js/game.js','utf8');
 const start=game.indexOf('YOKAI_SANCTUARY_ARC?.draw(');
 const ground=game.indexOf('SKILLFX.drawArtFx?.(ctx, true);');
 const actors=game.indexOf('const actors = [');
 const front=game.indexOf('SKILLFX.drawArtFx?.(ctx, false);');
 assert.ok(start>front&&actors<start,'canopy must overlay the courier after all depth-sorted actors');
 assert.ok(ground<start,'dome must paint over the mandala, not under the opaque VFX');
 assert.match(game,/maxLife: spec\.sanctuary\.duration, level: spec\.level/);
 const index=fs.readFileSync('index.html','utf8');
 assert.ok(index.indexOf('js/game-sanctuary-arc.js')<index.indexOf('js/game.js'));
});
