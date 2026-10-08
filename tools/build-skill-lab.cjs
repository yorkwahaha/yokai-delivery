// Validation-only seam: retain the real weapons/drawWorld functions, replace only the RAF entry point.
const fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const source=fs.readFileSync('js/game.js','utf8');
const anchor='  requestAnimationFrame(frame);',at=source.lastIndexOf(anchor);
if(at<0)throw new Error('game RAF entry point missing');
const hook=String.raw`
  let labSkill='katana',labLevel=1,labMixed=false,labPaused=false,labSpeed=1,labMoving=true,labRapid=true,labMode='swarm',labBulletT=0,labLast=performance.now();
  let labKillCount=0;
  function labSetup(skill,rank,mixed=false){
    labPaused=false;
    labSkill=Object.hasOwn(WI,skill)?skill:'katana';labLevel=clamp(Math.floor(rank)||1,1,5);labMixed=!!mixed;
    Object.keys(WL).forEach(k=>WL[k]=0);
    if(labMixed){for(const k of Object.keys(WL))WL[k]=5;}else WL[labSkill]=labLevel;
    Object.keys(wT).forEach(k=>wT[k]=0);atkT=0;fAng=0;fireEmitT=0;labBulletT=0;
    proj=[];needles=[];winds=[];ghosts=[];gems=[];texts=[];rings=[];orders=[];job=null;bossQ=null;tutorial=null;enemyBullets=[];
    houses.length=0;solids.length=0;LAMPS.length=0;activeChunks.splice(0,activeChunks.length,WORLD_STATE.getChunk(0,0));
    Object.assign(P,{x:450,y:320,faceX:1,faceAng:0,inv:0});RENDERER.setCam(0,20);
    state='play';elapsed=0;oil=maxOil=100;level=1;xp=0;score=0;finalBossDefeated=false;bossStage=0;dashT=0;

    if(labMode==='dummy'){
      const targets=labSkill==='needle'||labMixed?Array.from({length:8},(_,i)=>[450+Math.cos(i*Math.PI/4)*220,320+Math.sin(i*Math.PI/4)*180]):[[570,320],[660,270],[760,335],[615,400],[665,220],[820,360]];
      enemies=targets.map(([x,y],i)=>({x,y,baseY:y,hp:999999,max:999999,type:'ghost',flash:0,wob:i,slowT:0}));
    } else {
      enemies=Array.from({length:16},(_,i)=>{
        const a=i*6.283/16, d=190+(i%3)*60;
        return {x:450+Math.cos(a)*d,y:320+Math.sin(a)*d,baseY:320+Math.sin(a)*d,hp:28,max:28,type:i%4===0?'runner':i%5===0?'tank':'ghost',flash:0,wob:i,slowT:0};
      });
    }
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
    if(d.cmd==='rapid')labRapid=!!d.value;
    if(d.cmd==='mode'){labMode=d.value;labSetup(labSkill,labLevel,labMixed);}
    if(d.cmd==='keyframe'){
      labSetup(labSkill,labLevel,labMixed);
      const times={katana:0.12,barrier:0.3,needle:0.4,boom:0.43,fire:0.95,thunder:0.18};
      for(let left=labMixed?0.15:times[labSkill];left>0;){const dt=Math.min(1/60,left);labTick(dt);left-=dt;}
      labPaused=true;RENDERER.clearShake();
    }
  });
  function labTick(dt){
    elapsed+=dt;
    if(labRapid){
      if(WL.katana)atkT=Math.min(atkT,0.18);
      if(WL.barrier)wT.barrier=Math.min(wT.barrier,0.55);
      if(WL.needle)wT.needle=Math.min(wT.needle,0.22);
      if(WL.boom)wT.boom=Math.min(wT.boom,0.32);
      if(WL.fire)wT.fire=Math.min(wT.fire,0.3);
      if(WL.thunder)wT.thunder=Math.min(wT.thunder,0.35);
    }
    if(WL.katana===5||WL.boom===5||labMixed){
      labBulletT-=dt;
      if(labBulletT<=0){
        labBulletT=1.3;
        for(let i=-1;i<=1;i++){
          const a=i*0.35,bx=450+Math.cos(a)*280,by=320+Math.sin(a)*280;
          enemyBullets.push({x:bx,y:by,vx:-Math.cos(a)*140,vy:-Math.sin(a)*140,life:2.5});
        }
      }
    }
    for(const eb of enemyBullets){eb.x+=eb.vx*dt;eb.y+=eb.vy*dt;eb.life-=dt;}
    enemyBullets=enemyBullets.filter(b=>b.life>0);

    if(labMode==='swarm'){
      const deadCount=enemies.filter(e=>e.hp<=0).length;
      if(deadCount>0){
        labKillCount+=deadCount;
        enemies=enemies.filter(e=>e.hp>0);
      }
      while(enemies.length<16){
        const a=Math.random()*6.283,d=220+Math.random()*160;
        enemies.push({
          x:450+Math.cos(a)*d,y:320+Math.sin(a)*d,baseY:320+Math.sin(a)*d,
          hp:28,max:28,type:Math.random()<0.25?'runner':Math.random()<0.2?'tank':'ghost',
          flash:0,wob:Math.random()*6,slowT:0
        });
      }
    }
    for(const e of enemies){
      e.flash=Math.max(0,(e.flash||0)-dt);
      e.freezeT=Math.max(0,(e.freezeEnds||0)-elapsed);
      if(labMoving&&!e.freezeT){
        if(labMode==='swarm'){
          const dx=450-e.x,dy=320-e.y,d=Math.hypot(dx,dy)||1;
          if(d>110){e.x+=(dx/d)*38*dt;e.y+=(dy/d)*38*dt;}
        }else{
          e.y=e.baseY+Math.sin(elapsed*1.5+e.wob)*22;
        }
      }
    }
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
      if(now-labReport>200){
        labReport=now;
        document.getElementById('lab-status').textContent=
          (labMixed?'⚡ Lv5 六大覺醒全開':('★ Lv'+labLevel+' '+WI[labSkill].zh))+' · '+(labMode==='swarm'?('討伐狂潮 ('+labKillCount+' 隻消滅)'):'木樁練習')+
          (labRapid?' · ⚡極速連發':'')+' · '+(labPaused?'暫停':'播放');
      }
    }catch(err){document.getElementById('lab-status').textContent='ERROR: '+err.message;console.error(err);return;}
    requestAnimationFrame(labFrame);
  }
  const labQuery=new URLSearchParams(location.search);
  window.labEvidence=()=>({paused:labPaused,elapsed,skill:labSkill,level:labLevel,ghosts:ghosts.length,winds:winds.length,points:ghosts.map(p=>p.points?.length||0),fx:FX.stats()});
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
