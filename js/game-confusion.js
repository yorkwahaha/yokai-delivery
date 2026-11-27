// Violet-scent Lv5: prefer nearby monsters, or wander slowly when alone.
window.GAME_CONFUSION = (() => {
  const MAX_SCAN=128, MAX_CHOICES=8, SEEK_RANGE=260;
  const allyTarget=(e,foe,range)=>foe&&foe!==e&&foe.type!=="boss"&&foe.hp>0&&
    !foe.dying&&!foe.shield&&!foe.vanish&&!foe.done&&!foe.invulnerable&&!foe.untargetable&&
    !(foe.revealT>0)&&(foe.x-e.x)**2+(foe.y-e.y)**2<=range**2;
  function step(e,dt,enemies,player,random=Math.random){
    e.confuseImmuneT=Math.max(0,(e.confuseImmuneT||0)-dt);
    e.confusedT=Math.max(0,(e.confusedT||0)-dt);
    if(!(e.confusedT>0)||e.type==="boss"||e.shield){
      if(e.confuseTarget||e.confuseWander||e.confuseSwapT){
        e.confuseTarget=null;e.confuseWander=null;e.confuseSwapT=0;
      }
      return player;
    }
    e.confuseSwapT=Math.max(0,(e.confuseSwapT||0)-dt);
    const target=e.confuseTarget;
    const invalid=target&&!allyTarget(e,target,300);
    if(e.confuseSwapT===0||invalid){
      const options=[];
      const start=(e.confuseScan||0)%Math.max(1,enemies.length);
      const count=Math.min(MAX_SCAN,enemies.length);
      let i=0;
      for(;i<count&&options.length<MAX_CHOICES;i++){
        const foe=enemies[(start+i)%enemies.length];
        if(allyTarget(e,foe,SEEK_RANGE))options.push(foe);
      }
      e.confuseScan=start+i;
      e.confuseTarget=options.length && random()<.85
        ?options[Math.min(options.length-1,Math.floor(random()*options.length))]:null;
      e.confuseWander=null;
      if(!options.length){
        const angle=random()*Math.PI*2;
        e.confuseWander={x:e.x+Math.cos(angle)*50,y:e.y+Math.sin(angle)*50};
      }
      e.confuseSwapT=.6+random()*.35;
    }
    return e.confuseTarget||e.confuseWander||player;
  }
  return Object.freeze({step,wanderSpeedMultiplier:.45});
})();
