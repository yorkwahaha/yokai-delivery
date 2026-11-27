// Ninth active skill: 式神・召喚 / shikigami. Coordinates use world space.
window.GAME_SHIKIGAMI = (() => {
  "use strict";
  const TIERS = Object.freeze([
    {maxHp:60, life:14, cooldown:18, speed:255, attackInterval:1.30, factor:2.5, seekRange:225, maxFollowDistance:275, aggroRange:155, aggroCap:2, aggroChance:.55},
    {maxHp:90, life:17, cooldown:17, speed:285, attackInterval:1.20, factor:3.2, seekRange:260, maxFollowDistance:315, aggroRange:180, aggroCap:3, aggroChance:.65},
    {maxHp:130,life:20, cooldown:15, speed:310, attackInterval:1.10, factor:4.0, seekRange:300, maxFollowDistance:355, aggroRange:200, aggroCap:3, aggroChance:.72},
    {maxHp:180,life:24, cooldown:14, speed:340, attackInterval:1.05, factor:4.9, seekRange:340, maxFollowDistance:400, aggroRange:225, aggroCap:4, aggroChance:.78},
    {maxHp:300,life:30, cooldown:12, speed:380, attackInterval:1.00, factor:5.4, seekRange:380, maxFollowDistance:450, aggroRange:250, aggroCap:8, aggroChance:.86}
  ]);
  const SPECIES = Object.freeze(["fox", "hound", "crow"]);
  const BOSS_DAMAGE_MULTIPLIER = 0.42;
  const AWAKENED_BOSS_FACTOR = 2.25;
  const SCAN_LIMIT = 128;
  const SCAN_INTERVAL = .20, AGGRO_INTERVAL = .55;
  const BODY_RADIUS = 15;
  const MOVE_STEP = 8;
  const BITE_HOLD = .75, FOLLOW_START = 42, FOLLOW_STOP = 12;
  const BLACK_FRAMES = new WeakMap();
  const houndPath = (pose, frame) => `assets/img/characters/shikigami/shikigami__sprite__hound-${pose}__f0${frame}.webp`;
  const houndIdle = houndPath("idle", 1);
  const trialArt = window.DEV_MODE?.isStageLab?.(window.location) === true;
  const CARD_ART_PATH = trialArt ? "assets/img/skills/shikigami/cards/shikigami__card.webp" : houndIdle;
  const CARD = Object.freeze({ id: "shikigami", jp: "しきがみ・しょうかん",
    zh: "式神・召喚", type: "active", category: "召喚夥伴", artPath: CARD_ART_PATH,
    desc: "白狼主動追擊並吸引小怪。Lv5 喚出黑白雙狼分頭獵殺，一口擊倒普通怪、兩口擊倒坦克。Boss 不受嘲諷，撲咬另計傷害。" });
  const UPGRADES = Object.freeze([
    "白狼主動索敵 225px，生命 60、存續 14 秒，至多吸引 2 隻小怪",
    "生命 90、存續 17 秒。索敵增至 260px，至多吸引 3 隻小怪",
    "生命 130、存續 20 秒。索敵 300px，咬擊間隔 1.1 秒",
    "生命 180、存續 24 秒。索敵 340px，至多吸引 4 隻小怪",
    "覺醒・雙狼。每隻生命 300，存續 30 秒，召喚冷卻 12 秒；每 1 秒可撲咬一次，原地咬擊 .75 秒，合計吸引至多 8 隻小怪"
  ]);
  const ART_PATHS = Object.freeze({
    fox: "assets/img/vfx/skills/shikigami/shikigami__fox.webp",
    hound: houndIdle,
    crow: "assets/img/vfx/skills/shikigami/shikigami__crow.webp",
    attack: "assets/img/vfx/skills/shikigami/shikigami__attack.webp",
    vanish: "assets/img/vfx/skills/shikigami/shikigami__vanish.webp"
  });
  const SFX_PATHS = Object.freeze({
    summon: "assets/audio/sfx/skills/shikigami/shikigami__summon.mp3",
    attack: "assets/audio/sfx/skills/shikigami/shikigami__attack.mp3",
    hurt: "assets/audio/sfx/skills/shikigami/shikigami__hurt.mp3",
    vanish: "assets/audio/sfx/skills/shikigami/shikigami__vanish.mp3"
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const distanceSquared = (a,b) => (a.x-b.x)**2+(a.y-b.y)**2;
  const targetable = e => !!e && e.hp > 0 && !e.dying && !e.vanish &&
    !e.done && !e.shield && !e.invulnerable && !e.untargetable && !(e.revealT > 0);
  function pathBlocked(from, to, blocked, radius) {
    if (!blocked) return false;
    const steps = Math.ceil(distance(from, to) / MOVE_STEP);
    for (let i = 1; i <= steps; i++)
      if (blocked(from.x + (to.x - from.x) * i / steps,
          from.y + (to.y - from.y) * i / steps, radius)) return true;
    return false;
  }
  function loadImage(path) {
    const image = new window.Image();
    image.decoding = "async";
    image.src = path;
    return image;
  }
  const trialFrames = (pose, count = 4) => Array.from({ length: count }, (_, i) =>
    loadImage(`assets/img/characters/shikigami/shikigami__sprite__${pose}__f0${i + 1}.webp`));
  function loadBlackArt(art) {
    if (!trialArt || typeof window.Image !== "function" || art.black) return;
    art.black = { idle: trialFrames("black-idle", 2), run: trialFrames("black-run"), bite: trialFrames("black-bite") };
  }
  function loadArt(species) {
    if (typeof window.Image !== "function") return {};
    if (species === "hound") {
      const frames = pose => [1, 2, 3, 4].map(n => loadImage(houndPath(pose, n)));
      const art = { hound: loadImage(ART_PATHS.hound), run: frames("run"), bite: frames("attack") };
      if (trialArt) {
        art.whiteBite = trialFrames("white-bite");
        art.summon = loadImage("assets/img/vfx/skills/shikigami/shikigami__summon.webp");
        art.vanish = loadImage("assets/img/vfx/skills/shikigami/shikigami__departure.webp");
      }
      return art;
    }
    return Object.fromEntries([species, "attack", "vanish"].map(key => [key, loadImage(ART_PATHS[key])]));
  }
  function spec(level, effectiveDamage = 1, mutations = []) {
    const lv = Math.max(1, Math.min(5, Math.floor(Number(level) || 1)));
    const base = TIERS[lv - 1];
    const fang = mutations.includes("mut_shikigami_fang") ? 1.25 : 1;
    const factor = base.factor * fang;
    return { ...base, level: lv, factor, damage: factor * effectiveDamage,
      maxHp: Math.round(base.maxHp * (mutations.includes("mut_shikigami_guard") ? 1.30 : 1)),
      life: base.life + (mutations.includes("mut_shikigami_life") ? 3 : 0),
      attackInterval: base.attackInterval * (mutations.includes("mut_shikigami_quick") ? .82 : 1),
      attackRange: lv === 5 ? 48 : 38, followRadius: lv === 5 ? 62 : 48, fang,
      bossFactor: lv === 5 ? AWAKENED_BOSS_FACTOR * fang : factor * BOSS_DAMAGE_MULTIPLIER,
      bossMultiplier: lv === 5 ? AWAKENED_BOSS_FACTOR / base.factor : BOSS_DAMAGE_MULTIPLIER, maxAllies: lv === 5 ? 2 : 1,
      maxEnemyScan: SCAN_LIMIT,
      cadenceEligible: false, critEligible: false, reachEligible: false };
  }
  function blackSprite(sprite) {
    if (BLACK_FRAMES.has(sprite)) return BLACK_FRAMES.get(sprite);
    const canvas = window.document?.createElement("canvas");
    if (!canvas) return sprite;
    canvas.width = Math.min(256, sprite.naturalWidth);
    canvas.height = Math.max(1, Math.round(sprite.naturalHeight * canvas.width / sprite.naturalWidth));
    const ctx = canvas.getContext("2d");
    if (!ctx) return sprite;
    ctx.drawImage(sprite, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(21,28,44,.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    BLACK_FRAMES.set(sprite, canvas);
    return canvas;
  }

  function create({ species = "fox", random = Math.random } = {}) {
    const kind = SPECIES.includes(species) ? species : "fox";
    const slots = ["white", "black"].map(coat => ({coat, body:null, cooldown:0, effect:null, taunted:new Set()}));
    const candidates = [];
    let paused = false, previousSpec = null, scanAt = 0, scanCursor = 0, aggroAt = 0;
    const preferred = () => slots[0].body || slots[1].body;
    const hostile = (enemy,player,ally,cfg) => targetable(enemy) &&
      distanceSquared(enemy,player) <= cfg.maxFollowDistance ** 2 &&
      distanceSquared(enemy,ally) <= cfg.seekRange ** 2;
    const validTaunt = (enemy,player,ally,cfg) => ally && ally.hp > 0 && targetable(enemy) &&
      enemy.type !== "boss" && !(enemy.confusedT > 0) &&
      distanceSquared(ally,player) <= cfg.maxFollowDistance ** 2 &&
      distanceSquared(enemy,ally) <= cfg.aggroRange ** 2 &&
      distanceSquared(enemy,player) <= (cfg.maxFollowDistance + cfg.aggroRange) ** 2;

    function dismiss(slot,event,onEvent) {
      const ally = slot.body;
      if (!ally) return;
      slot.effect = {x:ally.x,y:ally.y,facing:ally.facing,species:ally.species,kind:"vanish",life:.3};
      slot.body = null;
      slot.taunted.clear();
      scanAt = 0;
      onEvent?.(event, ally.species);
    }
    function reset() {
      for (const slot of slots) {
        slot.body = slot.effect = null;
        slot.cooldown = 0;
        slot.taunted.clear();
      }
      candidates.length = 0;
      paused = false;
      previousSpec = null;
      scanAt = scanCursor = aggroAt = 0;
    }
    function summon(slot,peer,player,cfg,blocked,onEvent) {
      const side = slot.coat === "black" ? 1 : -1;
      const spacing = cfg.maxAllies === 2 ? 80 : kind === "hound" ? 58 : 30;
      const spots = [[spacing*side,28],[spacing*side,-26],[-spacing*side,28],[-spacing*side,-26],
        [30*side,28],[-30*side,28],[0,0]];
      for (const [dx,dy] of spots) {
        const point = {x:player.x+dx,y:player.y+dy};
        if (blocked?.(point.x,point.y,BODY_RADIUS) || pathBlocked(player,point,blocked,BODY_RADIUS) ||
            (peer && distanceSquared(point,peer) < (BODY_RADIUS*2)**2)) continue;
        slot.body = {...point, hp:cfg.maxHp, maxHp:cfg.maxHp, life:cfg.life, maxLife:cfg.life,
          coat:slot.coat, species:cfg.level===5 ? "hound" : kind, scale:cfg.level===5 ? 1.5 : 1,
          facing:1, invulnerable:0, walkTime:0, biteRemaining:0, attackTimer:.25, target:null, following:false};
        if (trialArt && slot.body.species === "hound")
          slot.effect = {...point, facing:1, species:"hound", kind:"summon", life:.48};
        slot.cooldown = cfg.cooldown;
        scanAt = aggroAt = 0;
        onEvent?.("summon", slot.body.species);
        return;
      }
      // Avoid probing the same blocked summon spots on every simulation substep.
      slot.cooldown = .25;
    }
    function moveTowards(ally,peer,point,dt,speed,blocked,player,leash) {
      const dx=point.x-ally.x, dy=point.y-ally.y, d=Math.hypot(dx,dy);
      if(d<.5)return;
      const step=Math.min(speed*Math.min(dt,.25),d), angle=Math.atan2(dy,dx);
      const side=ally.detourSide || 1;
      const offsets=[0,side*.8,-side*.8,side*1.6,-side*1.6];
      for(let left=step;left>.01;left-=MOVE_STEP){
        const length=Math.min(left,MOVE_STEP);
        const separation=distanceSquared(ally,player);
        const peerLimit=peer ? Math.min((BODY_RADIUS*2)**2,distanceSquared(ally,peer)) : 0;
        let moved=false;
        for(const offset of offsets){
          const vx=Math.cos(angle+offset)*length, vy=Math.sin(angle+offset)*length;
          const x=ally.x+vx, y=ally.y+vy;
          if((x-player.x)**2+(y-player.y)**2>Math.max(leash**2,separation) ||
              (peer && (x-peer.x)**2+(y-peer.y)**2<peerLimit) || blocked?.(x,y,BODY_RADIUS))continue;
          ally.x=x; ally.y=y;
          if(offset)ally.detourSide=Math.sign(offset);
          if(Math.abs(vx)>=.2)ally.facing=Math.sign(vx);
          moved=true;
          break;
        }
        if(!moved)break;
      }
    }
    function chooseTarget(ally,otherTarget,player,cfg) {
      let normal=null, boss=null, normalScore=Infinity, bossScore=Infinity;
      // Keep a reachable lock while the bounded scan samples a different slice.
      for(let i=-1;i<candidates.length;i++){
        const enemy=i<0 ? ally.target : candidates[i];
        if(enemy===ally.avoidTarget || !hostile(enemy,player,ally,cfg))continue;
        const nearWolf=distanceSquared(enemy,ally), nearPlayer=distanceSquared(enemy,player);
        if(enemy.type==="boss"){
          if(nearWolf<bossScore){bossScore=nearWolf;boss=enemy;}
          continue;
        }
        if(enemy===otherTarget)continue;
        const ranged=enemy.type==="shooter" || enemy.type==="shiome";
        const score=ally.coat==="white" ? nearPlayer+.30*nearWolf
          : nearWolf*.42-nearPlayer*.36-(ranged ? 380**2*.38 : 0);
        if(score<normalScore){normalScore=score;normal=enemy;}
      }
      return normal || boss;
    }
    function refreshTargets(enemies,player,cfg) {
      candidates.length=0;
      const count=Math.min(SCAN_LIMIT,enemies.length);
      for(let i=0;i<count;i++){
        const e=enemies[(scanCursor+i)%enemies.length];
        if(targetable(e))candidates.push(e);
      }
      scanCursor=enemies.length ? (scanCursor+count)%enemies.length : 0;
      const white=slots[0].body,black=slots[1].body;
      if(white)white.target=chooseTarget(white,null,player,cfg);
      if(black)black.target=chooseTarget(black,white?.target,player,cfg);
    }
    function refreshAggro(player,cfg,dt) {
      for(const slot of slots)
        for(const e of slot.taunted)
          if(!validTaunt(e,player,slot.body,cfg))slot.taunted.delete(e);
      aggroAt-=dt;
      if(aggroAt>0)return;
      aggroAt=AGGRO_INTERVAL;
      const [white,black]=slots;
      const cap=cfg.aggroCap/cfg.maxAllies;
      for(const e of candidates){
        if(white.taunted.has(e)||black.taunted.has(e))continue;
        const a=white.taunted.size<cap && validTaunt(e,player,white.body,cfg);
        const b=black.taunted.size<cap && validTaunt(e,player,black.body,cfg);
        if((a||b) && random()<cfg.aggroChance){
          const slot=b && (!a || distanceSquared(e,black.body)<distanceSquared(e,white.body)) ? black : white;
          slot.taunted.add(e);
        }
        if(white.taunted.size>=cap && (!black.body || black.taunted.size>=cap))break;
      }
    }
    function tick({dt,level=0,player,enemies=[],effectiveDamage=1,mutations=[],blocked,hit,onEvent}={}) {
      if(!(dt>0)||!player||paused)return;
      for(const slot of slots)if(slot.effect&&(slot.effect.life-=dt)<=0)slot.effect=null;
      if(!(level>0)){
        for(const slot of slots)dismiss(slot,"vanish",onEvent);
        return;
      }
      const cfg=spec(level,effectiveDamage,mutations);
      for(const [i,slot] of slots.entries()){
        if(i>=cfg.maxAllies){dismiss(slot,"vanish",onEvent);slot.cooldown=0;continue;}
        if(previousSpec && cfg.level>previousSpec.level){
          slot.cooldown=Math.max(0,slot.cooldown-Math.max(0,previousSpec.cooldown-cfg.cooldown));
          scanAt=0;
        }
        slot.cooldown=Math.max(0,slot.cooldown-dt);
        if(!slot.body && slot.cooldown===0)summon(slot,slots[1-i].body,player,cfg,blocked,onEvent);
        const ally=slot.body;
        if(!ally)continue;
        if(ally.maxHp!==cfg.maxHp || ally.maxLife!==cfg.life){
          ally.hp=Math.max(0,ally.hp+cfg.maxHp-ally.maxHp);
          ally.life+=cfg.life-ally.maxLife;
          ally.maxHp=cfg.maxHp;
          ally.maxLife=cfg.life;
        }
        ally.species=cfg.level===5 ? "hound" : kind;
        ally.scale=cfg.level===5 ? 1.5 : 1;
        ally.life-=dt;
        if(ally.avoidTarget && (ally.avoidTime-=dt)<=0)ally.avoidTarget=null;
        ally.invulnerable=Math.max(0,ally.invulnerable-dt);
        ally.biteRemaining=Math.max(0,ally.biteRemaining-dt);
        ally.attackTimer=Math.max(0,Math.min(ally.attackTimer,cfg.attackInterval)-dt);
        if(ally.life<=0 || ally.hp<=0)dismiss(slot,ally.hp<=0?"death":"expire",onEvent);
      }
      previousSpec=cfg;
      if(!preferred())return;
      scanAt-=dt;
      if(scanAt<=0){
        refreshTargets(enemies,player,cfg);
        scanAt=SCAN_INTERVAL;
      }
      refreshAggro(player,cfg,dt);

      for(const [i,slot] of slots.entries()){
        const ally=slot.body;
        if(!ally)continue;
        const peer=slots[1-i].body;
        const separation=distanceSquared(ally,player);
        const target=separation<=cfg.maxFollowDistance**2 && hostile(ally.target,player,ally,cfg) ? ally.target : null;
        const reach=cfg.attackRange+(target?.r||0);
        const canBite=target && distanceSquared(target,ally)<=reach**2 && !pathBlocked(ally,target,blocked,3);
        const oldX=ally.x, oldY=ally.y;
        if(ally.biteRemaining>1e-9 && separation<=cfg.maxFollowDistance**2){
          ally.walkTime=0;
          ally.following=false;
          continue; // Finish the bite pose before moving on, even when the victim dies.
        }
        if(separation>cfg.maxFollowDistance**2){
          ally.following=false;
          moveTowards(ally,peer,player,dt,cfg.speed,blocked,player,cfg.maxFollowDistance);
        }else if(target&&!canBite){
          ally.following=false;
          if(ally.chasing!==target){
            ally.chasing=target;
            ally.bestChaseDistance=distance(target,ally);
            ally.stuckTime=0;
          }
          moveTowards(ally,peer,target,dt,cfg.speed,blocked,player,cfg.maxFollowDistance);
          const remaining=distance(target,ally);
          if(remaining<ally.bestChaseDistance-2){
            ally.bestChaseDistance=remaining;
            ally.stuckTime=0;
          }else if((ally.stuckTime+=Math.min(dt,.25))>=.5){
            ally.avoidTarget=target;
            ally.avoidTime=.8;
            ally.target=null;
            scanAt=0;
          }
        }else if(!target){
          const spacing=cfg.maxAllies===2?80:ally.species==="hound"?58:30;
          const at={x:player.x+(i===1?spacing:-spacing),y:player.y+28};
          const gap=distance(ally,at);
          // Loose formation: hysteresis prevents tiny corrective movements every frame.
          if(gap>FOLLOW_START)ally.following=true;
          else if(gap<=FOLLOW_STOP)ally.following=false;
          if(ally.following){
            const speed=Math.min(cfg.speed,Math.max(95,gap*4),Math.max(0,gap-FOLLOW_STOP)/Math.min(dt,.25));
            moveTowards(ally,peer,at,dt,speed,blocked,player,cfg.maxFollowDistance);
          }
        }else ally.following=false;
        if(!target||canBite||ally.target!==target)ally.chasing=null;
        ally.walkTime=ally.x!==oldX||ally.y!==oldY ? ally.walkTime+dt : 0;
        if(!target||ally.target!==target||ally.attackTimer>1e-9||(!canBite &&
            (distanceSquared(target,ally)>reach**2 || pathBlocked(ally,target,blocked,3))))continue;
        ally.attackTimer=cfg.attackInterval;
        ally.biteRemaining=BITE_HOLD;
        if(Math.abs(target.x-ally.x)>.2)ally.facing=Math.sign(target.x-ally.x);
        const damage=target.type==="boss" ? cfg.bossFactor*effectiveDamage : cfg.level!==5 ? cfg.damage
          : target.type==="tank" ? Math.ceil((target.max || target.hp)/2)*cfg.fang : target.hp;
        if(ally.species!=="hound")slot.effect={x:target.x,y:target.y,facing:ally.facing,
          species:ally.species,kind:"attack",life:.2};
        hit?.(target,damage,"shikigami");
        if(slot.body!==ally)return; // A finishing bite can synchronously settle and reset the run.
        onEvent?.("attack",ally.species);
        if(!targetable(target))scanAt=0;
      }
    }
    function targetForEnemy(enemy,player,existingAim=player) {
      if(paused||existingAim!==player||!previousSpec)return existingAim;
      for(const slot of slots)
        if(slot.taunted.has(enemy)&&validTaunt(enemy,player,slot.body,previousSpec))return slot.body;
      return existingAim;
    }
    function receiveEnemyAttack(enemy,damage,onEvent,{projectile=false,target}={}) {
      if(paused||enemy?.type==="boss")return false;
      const slot=target ? slots.find(x=>x.body===target) : slots.find(x=>x.body&&x.taunted.has(enemy));
      const ally=slot?.body;
      if(!ally || ally.hp<=0 || (!projectile && (!slot.taunted.has(enemy)||!targetable(enemy)||distanceSquared(enemy,ally)>60**2)))return false;
      if(ally.invulnerable>0)return true;
      ally.hp=Math.max(0,ally.hp-Math.max(0,Number(damage)||0));
      ally.invulnerable=.4;
      onEvent?.("hurt",ally.species);
      if(ally.hp===0)dismiss(slot,"death",onEvent);
      return true;
    }
    function stepProjectile(bullet,previous,blocked,onEvent) {
      const ally=bullet.target;
      if(!ally||!slots.some(slot=>slot.body===ally))return true;
      const steps=Math.max(1,Math.ceil(distance(previous,bullet)/MOVE_STEP));
      for(let i=1;i<=steps;i++){
        const point={x:previous.x+(bullet.x-previous.x)*i/steps,y:previous.y+(bullet.y-previous.y)*i/steps};
        if(blocked?.(point.x,point.y,8))return true;
        if(distanceSquared(ally,point)>=(BODY_RADIUS+5)**2)continue;
        receiveEnemyAttack(bullet.shooter,8,onEvent,{projectile:true,target:ally});
        return true;
      }
      return false;
    }
    function paint(ctx,art={},opacity=1,pose=preferred()) {
      if(!pose)return;
      let sprite=art[pose.kind||pose.species];
      const houndBody=pose.species==="hound" && !pose.kind && art.run;
      if(houndBody){
        const biting=pose.biteRemaining>0;
        const index=biting ? Math.min(3,Math.max(0,Math.floor((BITE_HOLD-pose.biteRemaining)/(BITE_HOLD/4))))
          : Math.floor(pose.walkTime*11)%4;
        const black=pose.coat==="black" && art.black;
        const realBlack=black && (biting ? black.bite[index] : pose.walkTime>0 ? black.run[index]
          : black.idle[Math.floor(Math.max(0,pose.maxLife-pose.life)*2)%2]);
        const whiteBite=biting && art.whiteBite?.[index];
        const frame=biting ? (whiteBite?.naturalWidth ? whiteBite : art.bite[index]) : pose.walkTime>0 ? art.run[index] : null;
        if(frame?.naturalWidth)sprite=frame;
        if(realBlack?.naturalWidth)sprite=realBlack;
        else if(pose.coat==="black" && sprite?.naturalWidth)sprite=blackSprite(sprite);
      }
      if(!(sprite?.naturalWidth>0 && sprite.naturalHeight>0))return;
      ctx.save();
      ctx.globalAlpha*=opacity*Math.min(1,pose.life/(pose.kind?.15:.4));
      ctx.translate(pose.x,pose.y);
      ctx.scale(pose.facing<0?-1:1,1);
      if(houndBody){
        const width=112*pose.scale,scale=width/512;
        const bite=pose.biteRemaining>0?Math.sin(Math.PI*Math.max(0,Math.min(1,1-pose.biteRemaining/BITE_HOLD))):0;
        const sx=scale*(1+.26*bite),sy=scale*(1+.12*bite);
        ctx.drawImage(sprite,-256*sx+width*.09*bite,-320*sy,width*(1+.26*bite),352*sy);
      }else if(pose.kind && pose.species==="hound"){
        const width=pose.kind==="summon"?112:82;
        const height=width*sprite.naturalHeight/sprite.naturalWidth;
        ctx.drawImage(sprite,-width/2,-height+12,width,height);
      }else{
        const width=pose.species==="crow"?78:94,height=pose.species==="crow"?68:82;
        ctx.drawImage(sprite,-width/2,-height+18,width,height);
      }
      ctx.restore();
    }
    function cooldownRemaining() {
      const [white,black]=slots;
      if(previousSpec?.maxAllies!==2)return white.cooldown;
      if(!!white.body===!!black.body)return Math.min(white.cooldown,black.cooldown);
      return white.body?black.cooldown:white.cooldown;
    }
    function snapshot() {
      const ally=preferred();
      const wolves=slots.filter(slot=>slot.body).map(({body:wolf,taunted})=>({
        coat:wolf.coat,hp:wolf.hp,maxHp:wolf.maxHp,remaining:wolf.life,aggroCount:taunted.size,
        position:[wolf.x,wolf.y]}));
      return {active:!!ally,species:ally?.species||kind,hp:ally?.hp||0,maxHp:ally?.maxHp||0,
        remaining:ally?.life||0,cooldown:cooldownRemaining(),aggroCount:slots[0].taunted.size+slots[1].taunted.size,
        position:ally?[ally.x,ally.y]:null,wolves};
    }
    return Object.freeze({tick,targetForEnemy,receiveEnemyAttack,reset,stepProjectile,paint,snapshot,cooldownRemaining,
      activeCount:()=>Number(!!slots[0].body)+Number(!!slots[1].body),
      suspend(){paused=true;},resume(){paused=false;},body:preferred,bodies:()=>slots.map(s=>s.body).filter(Boolean),
      effect:()=>slots[0].effect||slots[1].effect,effects:()=>slots.map(s=>s.effect).filter(Boolean),species:kind});
  }
  return Object.freeze({ spec, create, loadArt, loadBlackArt, SPECIES, ART_PATHS, SFX_PATHS, CARD_ART_PATH, CARD, UPGRADES });
})();
