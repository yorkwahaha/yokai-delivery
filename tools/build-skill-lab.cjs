// Validation-only seam: retain the real weapons/drawWorld functions, replace only the RAF entry point.
const fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const source=fs.readFileSync('js/game.js','utf8');
const anchor='  requestAnimationFrame(frame);',at=source.lastIndexOf(anchor);
if(at<0)throw new Error('game RAF entry point missing');
const hook=String.raw`
  let labSkill='katana',labLevel=1,labMixed=false,labPaused=false,labSpeed=1,labMoving=true,labLast=performance.now();
  function labSetup(skill,rank,mixed=false){
    labSkill=Object.hasOwn(WI,skill)?skill:'katana';labLevel=clamp(Math.floor(rank)||1,1,5);labMixed=!!mixed;
    Object.keys(WL).forEach(k=>WL[k]=0);
    if(labMixed){for(const k of ['barrier','boom','fire','thunder'])WL[k]=5;}else WL[labSkill]=labLevel;
    Object.keys(wT).forEach(k=>wT[k]=0);atkT=0;fAng=0;fireEmitT=0;
    proj=[];needles=[];winds=[];ghosts=[];gems=[];texts=[];rings=[];orders=[];job=null;bossQ=null;tutorial=null;
    houses.length=0;solids.length=0;LAMPS.length=0;activeChunks.splice(0,activeChunks.length,WORLD_STATE.getChunk(0,0));
    Object.assign(P,{x:450,y:320,faceX:1,faceAng:0,inv:0});RENDERER.setCam(0,20);
    state='play';elapsed=0;oil=maxOil=100;level=1;xp=0;score=0;finalBossDefeated=false;bossStage=0;dashT=0;
    enemies=[[570,320],[660,270],[760,335],[615,400],[665,220],[820,360]].map(([x,y],i)=>({x,y,baseY:y,hp:999999,max:999999,type:'ghost',flash:0,wob:i,slowT:0}));
    FX.reset();SKILLFX.reset();RENDERER.updateEffects(2);RENDERER.clearShake();
  }
  addEventListener('message',e=>{
    if(e.origin!==location.origin||e.data?.type!=='skillLab')return;
    const d=e.data;
    if(d.cmd==='select')labSetup(d.skill,labLevel,labMixed);
    if(d.cmd==='reset')labSetup(labSkill,labLevel,labMixed);
    if(d.cmd==='pause'){labPaused=!!d.value;RENDERER.clearShake();}
    if(d.cmd==='speed')labSpeed=d.value===0.5?0.5:1;
    if(d.cmd==='mixed')labSetup(labSkill,labLevel,!!d.value);
    if(d.cmd==='moving')labMoving=!!d.value;
    if(d.cmd==='keyframe'){
      labSetup(labSkill,labLevel,labMixed);
      const times={katana:0.14,barrier:0.15,needle:0.18,boom:0.34,fire:0.45,thunder:0.1};
      for(let left=labMixed?0.15:times[labSkill];left>0;){const dt=Math.min(1/60,left);labTick(dt);left-=dt;}
      labPaused=true;RENDERER.clearShake();
    }
  });
  function labTick(dt){
    elapsed+=dt;
    if(elapsed>5)labSetup(labSkill,labLevel,labMixed);
    for(const e of enemies){e.flash=Math.max(0,(e.flash||0)-dt);if(labMoving)e.y=e.baseY+Math.sin(elapsed*1.5+e.wob)*22;}
    RENDERER.updateEffects(dt);FX.update(dt);SKILLFX.update(dt);weapons(dt);
  }
  let labReport=0;
  function labFrame(now){
    const dt=Math.min(0.04,Math.max(0,(now-labLast)/1000))*labSpeed;labLast=now;
    try{
      if(!labPaused){
        labTick(dt);
      }
      const v=VIEWPORT.get(),s=v.scale*RENDERER.getDpr();ctx.setTransform(s,0,0,s,v.offsetX*s,v.offsetY*s);
      drawWorld();
      if(now-labReport>250){
        labReport=now;
        document.getElementById('lab-status').textContent='Lv'+labLevel+(labMixed?' 四技能同場':' '+WI[labSkill].zh)+' · '+(labPaused?'暫停':'播放')+' · '+Math.round(enemies.reduce((n,e)=>n+999999-e.hp,0))+' 傷害';
      }
    }catch(err){document.getElementById('lab-status').textContent='ERROR: '+err.message;console.error(err);return;}
    requestAnimationFrame(labFrame);
  }
  const labQuery=new URLSearchParams(location.search);
  labSetup(labQuery.get('skill'),Number(labQuery.get('level')),false);
  requestAnimationFrame(labFrame);
`;
const built='// Generated controlled lab, not loaded by production index.html.\n'+source.slice(0,at)+hook+source.slice(at+anchor.length);
new vm.Script(built);
fs.writeFileSync('artifacts/validation/game-skill-lab.js',built);
const cellPath='artifacts/validation/skillfx-lab-cell.html';
const cell=fs.readFileSync(cellPath,'utf8').replace(/src="(js\/[^"?]+\.js|artifacts\/validation\/game-skill-lab\.js)(?:\?v=[^"]*)?"/g,(_,path)=>{
  const hash=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex').slice(0,12);
  return 'src="'+path+'?v='+hash+'"';
});fs.writeFileSync(cellPath,cell);
fs.writeFileSync('artifacts/validation/game-skill-lab-source.json',JSON.stringify({source:'js/game.js',sha256:crypto.createHash('sha256').update(source).digest('hex'),isolation:'private in-memory localStorage, muted audio, real weapons and drawWorld, controlled targets and clock'},null,2));
console.log('Built isolated real-game skill lab');
