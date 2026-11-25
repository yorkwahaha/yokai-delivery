'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Module=require('node:module');
const {loadGame,stages,dt}=require('./measure-first-four-phase-b.cjs');
const {runtimeTransform,seedList,replace}=require('./run-first-four-phase-c.cjs');

// Use exactly the same input and archetype implementation as the prior probe.
const phaseBPath=require.resolve('./probe-first-four-phase-b.cjs');
const phaseB=new Module(phaseBPath,module);
phaseB.filename=phaseBPath;
phaseB.paths=module.paths;
let source=fs.readFileSync(phaseBPath,'utf8').replace(/\r\n/g,'\n');
source=replace(source,'const mode=process.argv[2];',`
module.exports={archetypes,playBoss,stageBosses,oilTrial,oilCases,finalFallback};
return;
const mode=process.argv[2];`);
source=replace(source,'function oilTrial(id,caseData,delay,seed,pressure,assisted){',
  'function oilTrial(id,caseData,delay,seed,pressure,assisted,transform){');
source=replace(source,'loadGame({location:baselineLocation,seed})','loadGame({location:baselineLocation,seed,transform})');
source=replace(source,"  game.startRun('night-town');\n  game.stopSpawns();","  game.startRun(caseData.stage||'night-town');\n  game.stopSpawns();");
source=replace(source,'  const initial=game.snapshot();\n  let recovery=',`
  let postBoss=null;
  if(caseData.boss){
    game.forceBossSchedule(caseData.boss-1);
    let e;
    for(let i=0;i<120&&!e;i++){
      game.update(dt);
      e=game.snapshot().enemies.find(x=>x.type==='boss');
    }
    assert.ok(e,'scheduled post-Boss probe');
    e.shield=false;
    game.setOil(caseData.oil);
    const before=game.snapshot().oil;
    game.hurt(e,e.hp);
    game.phaseBSetLevel(8);
    postBoss={before,after:game.snapshot().oil};
  }
  const initial=game.snapshot();
  let recovery=`);
source=replace(source,'return {id,seed,delay,pressure,assisted,initialOil:', 'return {id,seed,delay,pressure,assisted,postBoss,initialOil:');
phaseB._compile(source,phaseBPath);
const {archetypes,playBoss,stageBosses,oilTrial,oilCases,finalFallback}=phaseB.exports;
const local={hostname:'127.0.0.1',search:'?dev=1&stageLab=1&shikigami=1'};

function boss(mode){
  const game=loadGame({location:local,transform:runtimeTransform(mode)});
  vm.runInContext(fs.readFileSync(require.resolve('../js/sakura-art-data.js'),'utf8'),game.env);
  const included=mode==='original'?stages:['rain-port'];
  const setup=included.map(stage=>({stage,bosses:stageBosses(game,stage)}));
  const profiles=Object.keys(archetypes);
  const rows=included.flatMap(stage=>[0,1].flatMap(wave=>profiles.flatMap(id=>seedList.flatMap(seed=>
    (stage==='rain-port'?[65,100]:[100]).map(oil=>playBoss(game,stage,wave,id,seed,'dodge',oil===100?undefined:oil))
  ))));
  return {mode,setup,rows};
}

function oil(mode){
  const cases={first:oilCases.first,firstTwo:{...oilCases.first,losses:2},
    ...Object.fromEntries(Object.entries(oilCases).filter(([id])=>id!=='first'&&id!=='repeat')),
    harborPre:{...oilCases.preboss,stage:'rain-port'}, harborPost:{t:235,oil:3,boss:1,losses:0,stage:'rain-port'},
    harborPostFail:{t:370,oil:3,boss:2,losses:1,timeout:true,stage:'rain-port'}};
  return Object.entries(cases).flatMap(([id,scenario])=>[20,40,65].flatMap(delay=>[0,5,10].flatMap(pressure=>
    [false,true].map(assisted=>oilTrial(id,scenario,delay,117,pressure,assisted,runtimeTransform(mode))))));
}

const [kind,mode='original']=process.argv.slice(2);
const runners={boss,oil,final:finalFallback};
assert.ok(runners[kind], 'Usage: node tools/probe-first-four-phase-c.cjs boss | oil | final [original|A5|A|A15|B|C|D|production]');
process.stdout.write(JSON.stringify(runners[kind](mode)));
