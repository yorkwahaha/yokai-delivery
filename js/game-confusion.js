// Violet-scent Lv5: ordinary enemies periodically choose either the courier
// or a nearby ordinary enemy. Boss behavior and its seal/quiz AI are untouched.
window.GAME_CONFUSION = (() => {
  function step(e,dt,enemies,player,random=Math.random){
    e.confuseImmuneT=Math.max(0,(e.confuseImmuneT||0)-dt);
    e.confusedT=Math.max(0,(e.confusedT||0)-dt);
    if(!(e.confusedT>0)||e.type==="boss"||e.shield){
      e.confuseTarget=null;e.confuseSwapT=0;return player;
    }
    e.confuseSwapT=Math.max(0,(e.confuseSwapT||0)-dt);
    const target=e.confuseTarget;
    const invalid=target && (target.hp<=0||target.dying||target.vanish||target.done||
      target.type==="boss"||Math.hypot(target.x-e.x,target.y-e.y)>300);
    if(e.confuseSwapT===0||invalid){
      // Small nearby list; bounded to prevent quadratic crowd scans at 20 FPS.
      const options=[];
      for(const foe of enemies){
        if(foe===e||foe.type==="boss"||foe.hp<=0||foe.dying||
          foe.shield||foe.vanish||foe.done)continue;
        if(Math.hypot(foe.x-e.x,foe.y-e.y)<=260)options.push(foe);
        if(options.length>=8)break;
      }
      e.confuseTarget=options.length && random()<.55
        ?options[Math.min(options.length-1,Math.floor(random()*options.length))]:null;
      e.confuseSwapT=.6+random()*.35;
    }
    return e.confuseTarget||player;
  }
  return Object.freeze({step});
})();
