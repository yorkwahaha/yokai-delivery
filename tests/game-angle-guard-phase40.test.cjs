'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/game-combat-math.js'),'utf8');

// Execute the actual production module and predicate in a bounded VM, so a
// future accidental infinite loop fails as a timeout, not a hung test runner.
function evaluatePredicate(fn,enemy,shape){
  const scope={window:{},enemy,shape,Math};
  vm.runInNewContext(source+'\nresult=window.GAME_COMBAT_MATH.'+fn+'(enemy,shape);',
    scope,{timeout:250,filename:'game-combat-math.js'});
  return scope.result;
}
const enemy={x:10,y:0,type:'ghost'};
const wave=ang=>({x:0,y:0,originX:0,originY:0,ang,maxTravel:720});
const crosscut=crossAng=>({x:0,y:0,reach:20,arc:1,crossAng});

test('Phase40: Katana rejects infinite/oversized angles, but preserves NaN acceptance',()=>{
  for(const angle of [Infinity,-Infinity,10000,-10000])
    assert.equal(evaluatePredicate('katanaWaveContains',enemy,wave(angle)),false,String(angle));
  assert.equal(evaluatePredicate('katanaWaveContains',enemy,wave(NaN)),true,
    'legacy !(NaN > 1.22) contract must remain true');
});

test('Phase40: crosscut rejects infinite/oversized angles and preserves NaN rejection',()=>{
  for(const angle of [Infinity,-Infinity,10000,-10000,NaN])
    assert.equal(evaluatePredicate('crosscutContains',enemy,crosscut(angle)),false,String(angle));
});

test('Phase40: normal finite Katana angle folding retains old hit geometry',()=>{
  const old=(angle)=>{
    const along=Math.abs(10*Math.cos(angle)),side=Math.abs(-10*Math.sin(angle));
    if(along>=75||side>=202)return false;
    let ad=Math.abs(Math.atan2(0,10)-angle);
    while(ad>Math.PI)ad=Math.abs(ad-2*Math.PI);
    return !(ad>1.22);
  };
  for(let i=-80;i<=80;i++){
    const angle=i*Math.PI/20;
    assert.equal(evaluatePredicate('katanaWaveContains',enemy,wave(angle)),old(angle),String(angle));
  }
});

test('Phase40: normal finite crosscut angle folding and inclusive reach remain unchanged',()=>{
  const old=(angle)=>{
    let diff=Math.abs(Math.atan2(0,10)-angle);
    while(diff>Math.PI)diff=Math.abs(diff-2*Math.PI);
    return diff<=1;
  };
  for(let i=-80;i<=80;i++){
    const angle=i*Math.PI/20;
    assert.equal(evaluatePredicate('crosscutContains',enemy,crosscut(angle)),old(angle),String(angle));
  }
  assert.equal(evaluatePredicate('crosscutContains',enemy,{...crosscut(0),reach:10}),true);
  assert.equal(evaluatePredicate('crosscutContains',enemy,{...crosscut(0),reach:9.999}),false);
});
