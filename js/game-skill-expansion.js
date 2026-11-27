"use strict";

const YOKAI_SKILL_EXPANSION = (() => {
  const cards = {}, upgrades = {}, mutations = {}, releases = {};
  function define(id, zh, jp, category, stage, levels, variants) {
    cards[id] = {id, zh, jp, category, desc:levels[0], type:"active", ic:zh.slice(-1)};
    upgrades[id] = levels;
    releases[id] = Object.freeze({stage, published:true});
    for (const [key,n,s,d] of variants) {
      const variant = "mut_" + id + "_" + key;
      mutations[variant] = {id:variant, skillId:id, skillIds:[id], n, s, d,
        cat:"【 "+category+"變異 】", levelText:"◆ 變異",
        requirementText:"持有"+zh, limitText:"每種限一次；此技能最多 2 種變異", inPool:true};
    }
  }

  define("hamaya","破魔・神弓","はま・しんきゅう","遠距狙擊","bamboo-maze",[
    "凝出靈弓蓄弦，優先射向可受傷的首領。",
    "破魔箭傷害與索敵距離提高。",
    "沒有首領時，優先瞄準重甲、精英及遠程妖怪。",
    "縮短蓄弦，主箭最多貫穿兩隻。",
    "天降神矢。大型靈箭最多貫穿四隻，主目標單次重擊。"
  ],[
    ["distance","百步穿楊","ひゃっぽせんよう","索敵及射程 +20%。至少 310 px 的命中傷害 +15%。"],
    ["armor","破鎧神矢","はがいしんし","對首領傷害 +20%，對重甲／精英傷害 +30%。"],
    ["twin","雙弦追射","そうげんついしゃ","主箭 0.18 秒後補射一箭，造成 45% 傷害。"],
    ["quick","疾弦速射","しつげんそくしゃ","蓄力縮短 30%，基礎冷卻縮短 16%。"]
  ]);
  define("ice_ball","冰魄・妖毬","ひょうはく・ようきゅう","撞擊彈跳","snow-temple",[
    "發射冰晶妖毬，最多撞擊兩隻不同妖怪。",
    "提高撞擊傷害，每毬最多撞擊三隻。",
    "提高首發射程及下一目標搜尋距離。",
    "同時釋出兩顆妖毬，副毬造成 55% 傷害。",
    "冰華碎玉。每毬最多四撞，終點散射冰晶。"
  ],[
    ["chain","連珠躍擊","れんじゅやくげき","每顆妖毬最多再撞擊兩隻不同妖怪。"],
    ["weight","寒玉重擊","かんぎょくじゅうげき","妖毬撞擊傷害 +24%。"],
    ["shards","冰華散碎","ひょうかさんさい","Lv1–4 終點散射兩枚小冰晶。Lv5 增至七枚，範圍與傷害提高。"],
    ["speed","疾轉飛毬","しってんひきゅう","妖毬飛行速度 +25%，基礎冷卻縮短 15%。"]
  ]);
  define("spider_silk","絡新婦・妖絲","じょろうぐも・ようし","結網切割","hyakki-kyoto",[
    "連接兩隻妖怪，穿線受傷，普通端點減速。單一端點延遲切割。",
    "提高絲線存續時間與切割傷害。",
    "最多連接三個端點。",
    "普通端點進一步減速，最大線長提高。",
    "百絲封界。結束時收束切割有效綁定端點與網心附近敵人。"
  ],[
    ["bind","黏絲縛足","ねんしばくそく","普通端點額外減速 14 個百分點。"],
    ["range","千絲延界","せんしえんかい","妖絲最大線長 +25%。"],
    ["blade","鋒絲斷魂","ほうしだんこん","全部絲線切割傷害 +25%。"],
    ["return","斷絲回斬","だんしかいざん","結束時追加 55% 基礎切割。Lv1–4 回斬也命中有效綁定端點。"]
  ]);
  define("wind_hole","冥風・風穴","めいふう・かざあな","吸引聚怪","spirit-ferry",[
    "在安全位置打開短暫風穴，拉近普通妖怪，結束時爆發。",
    "提高吸引範圍與風壓傷害。",
    "延長風穴存續時間。",
    "提高吸力與可拖動妖怪數量。",
    "冥界吞風。大型風穴在爆發前向中心強力壓縮。"
  ],[
    ["range","風界擴張","ふうかいかくちょう","風穴半徑 +20%。"],
    ["linger","冥風長息","めいふうちょうそく","主風穴多維持 0.65 秒。"],
    ["burst","逆風裂體","ぎゃくふうれったい","主穴與次穴的最終爆發傷害 +28%。"],
    ["twin","二重風穴","にじゅうかざあな","主穴結束後在安全原位生成一次小風穴。"]
  ]);

  const tables = {
    hamaya: [
      [5.6,2.85,.42,410,1], [7.1,2.75,.42,460,1], [8.7,2.65,.40,490,1],
      [10.4,2.55,.29,520,2], [12.8,2.45,.25,560,4]
    ],
    ice_ball: [
      [3.9,3.2,335,145,2,1], [4.8,3.1,355,158,3,1], [5.8,3,375,200,3,1],
      [6.8,2.9,395,215,3,2], [7.9,2.8,420,230,4,2]
    ],
    spider_silk: [
      [2.1,5.6,2.2,270,175,2,.20], [2.7,5.4,2.6,290,190,2,.23], [3.3,5.3,2.8,310,205,3,.27],
      [4,5.1,3,335,235,3,.34], [4.8,5,3.2,360,255,3,.38]
    ],
    wind_hole: [
      [3.8,6.6,1.4,320,105,80,5,8], [4.8,6.4,1.6,340,125,95,7,10],
      [5.9,6.2,2.1,360,140,110,9,12], [7.1,6,2.3,380,155,145,12,15],
      [8.6,5.8,2.6,405,182,170,16,18]
    ]
  };
  const ids = ["hamaya","spider_silk","ice_ball","wind_hole"];
  function lab(host) {
    return host?.DEV_MODE?.isDevMode?.(host.location) === true &&
      !host.DEV_MODE.isFusionLab?.(host.location) &&
      new URLSearchParams(host.location.search).get("skillLab")==="expansion";
  }
  function catalogIds(host) { return ids.filter(id=>releases[id].published || lab(host)); }
  function guidedDraft(host) {
    return lab(host) && new URLSearchParams(host.location.search).get("draft") === "guided";
  }
  function randomFor(seed) {
    let value=seed>>>0;
    return () => {
      value=(Math.imul(1664525,value)+1013904223)>>>0;
      return value / 4294967296;
    };
  }
  function spec(id, level, {damage = 1, rate = 0, reach = 1, mutations: owned = []} = {}) {
    const row = tables[id]?.[level - 1];
    if (!row) return null;
    const has = key => owned.includes("mut_" + id + "_" + key);
    const awakened = level === 5;
    if (id === "hamaya") {
      const [coefficient, cooldown, charge, range, hits] = row;
      return {level, awakened, damage: coefficient * damage,
        cooldown:Math.max(1.35, cooldown * (has("quick") ? .84 : 1) - rate * .10),
        charge:charge * (has("quick") ? .70 : 1),
        range:Math.round(range * reach * (has("distance") ? 1.20 : 1)),
        hits, speed:920, radius:awakened ? 16 : 10,
        boss:1.10 * (has("armor") ? 1.20 : 1), armor:has("armor") ? 1.30 : 1,
        distant:has("distance") ? 1.15 : 1, follow:has("twin")};
    }
    if (id==="spider_silk") {
      const [coefficient,cooldown,life,range,length,count,slow]=row;
      return {level,awakened,damage:coefficient*damage*(has("blade") ? 1.25 : 1),
        cooldown:Math.max(3.8,cooldown-rate*.08), life, range, count,
        length:length*(has("range") ? 1.25 : 1), slow:Math.min(.52,slow+(has("bind") ? .14 : 0)),
        boss:.85, backcut:has("return") ? .55 : 0};
    }
    if (id==="wind_hole") {
      const [coefficient,cooldown,life,range,radius,power,pullCap,hitCap]=row;
      return {level,awakened,damage:coefficient*damage*(has("burst") ? 1.28 : 1),
        cooldown:Math.max(4.4,cooldown-rate*.08), life:life+(has("linger") ? .65 : 0), range,
        radius:radius*(has("range") ? 1.20 : 1), power,pullCap,hitCap,boss:.75,twin:has("twin")};
    }
    const [coefficient, cooldown, range, bounce, hits, count] = row;
    const shards = has("shards");
    return {level, awakened, damage:coefficient * damage,
      cooldown:Math.max(1.65, cooldown * (has("speed") ? .85 : 1) - rate * .10),
      range:Math.round(range * reach), bounce, hits:hits + (has("chain") ? 2 : 0),
      count, radius:14, speed:540 * (has("speed") ? 1.25 : 1), life:2.35,
      boss:.90, impact:has("weight") ? 1.24 : 1,
      shards:awakened ? (shards ? 7 : 5) : shards ? 2 : 0,
      shardRange:awakened ? (shards ? 115 : 95) : 70,
      shardDamage:awakened ? (shards ? .42 : .32) : .20};
  }

  const valid = enemy => enemy.hp > 0 && !enemy.dying && !enemy.shield && !enemy.vanish && !enemy.done;
  const armored = e => e.type === "tank" || !!(e.elite || e.isElite);
  const gap = (a,b) => (a.x-b.x)**2 + (a.y-b.y)**2;
  const cellSize = 128;
  const queryLimit = 96;
  function createGrid() {
    const rows = new Map(), members = new Set(), bosses = [];
    function clear() { rows.clear(); members.clear(); bosses.length = 0; }
    function rebuild(enemies) {
      clear();
      for (const e of enemies) {
        if (!valid(e)) continue;
        members.add(e);
        if (e.type === "boss") {
          if (bosses.length < 8) bosses.push(e);
          continue;
        }
        const x = Math.floor(e.x / cellSize), y = Math.floor(e.y / cellSize);
        let columns = rows.get(y);
        if (!columns) rows.set(y, columns = new Map());
        let cell = columns.get(x);
        if (!cell) columns.set(x, cell = []);
        cell.push(e);
      }
    }
    function visit(x0,y0,x1,y1,each, limit = queryLimit) {
      let remaining = limit;
      for (const e of bosses) if (valid(e) && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) {
        each(e);
        if (--remaining === 0) return;
      }
      // Start at the center so a full cell at the edge cannot starve near targets.
      const left = Math.floor(x0 / cellSize), right = Math.floor(x1 / cellSize);
      const top = Math.floor(y0 / cellSize), bottom = Math.floor(y1 / cellSize);
      const cx = Math.floor((x0+x1) / (2*cellSize)), cy = Math.floor((y0+y1) / (2*cellSize));
      const rings = Math.max(right-cx,cx-left,bottom-cy,cy-top);
      for (let r = 0; r <= rings; r++) {
        for (let y = Math.max(top, cy-r); y <= Math.min(bottom, cy+r); y++) {
          const columns = rows.get(y);
          if (!columns) continue;
          for (let x = Math.max(left, cx-r); x <= Math.min(right, cx+r); x++) {
            if (Math.max(Math.abs(x-cx),Math.abs(y-cy)) !== r) continue;
            const cell = columns.get(x);
            if (!cell) continue;
            for (const e of cell) {
              if (valid(e) && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) each(e);
              if (--remaining === 0) return;
            }
          }
        }
      }
    }
    function circle(point,r,each,limit) {
      visit(point.x-r,point.y-r,point.x+r,point.y+r,e=>{
        const distance = gap(point,e);
        if (distance <= r*r) each(e,distance);
      },limit);
    }
    function nearest(point,r,accept = () => true,priority = () => 0) {
      let winner, best = Infinity, bestRank = Infinity;
      circle(point,r,(e,distance)=>{
        if (!accept(e)) return;
        const rank = priority(e,distance);
        if (rank < bestRank || (rank === bestRank && distance < best)) {
          winner=e; best=distance; bestRank=rank;
        }
      });
      return winner;
    }
    return {rebuild,clear,visit,circle,nearest,has:e=>!!e && members.has(e) && valid(e)};
  }

  // First entry into the target's circle, expressed as a fraction of the sweep.
  function contact(ax,ay,bx,by,point,radius) {
    const dx=bx-ax, dy=by-ay, px=ax-point.x, py=ay-point.y;
    const c=px*px+py*py-radius*radius;
    if (c <= 0) return 0;
    const a=dx*dx+dy*dy;
    const b=px*dx+py*dy, discriminant=b*b-a*c;
    if (!a || discriminant < 0) return Infinity;
    const t=(-b-Math.sqrt(discriminant))/a;
    return t >= 0 && t <= 1 ? t : Infinity;
  }

  function closeSegments(a,b,c,d,radius) {
    const bx=b.x-a.x, by=b.y-a.y, dx=d.x-c.x, dy=d.y-c.y;
    const det=bx*dy-by*dx;
    if (det) {
      const x=c.x-a.x, y=c.y-a.y;
      const t=(x*dy-y*dx)/det, u=(x*by-y*bx)/det;
      if (t>=0 && t<=1 && u>=0 && u<=1) return true;
    }
    return contact(a.x,a.y,b.x,b.y,c,radius)!==Infinity ||
      contact(a.x,a.y,b.x,b.y,d,radius)!==Infinity ||
      contact(c.x,c.y,d.x,d.y,a,radius)!==Infinity ||
      contact(c.x,c.y,d.x,d.y,b,radius)!==Infinity;
  }

  const position = ({x,y}) => ({x,y});
  const eligibleForPull = e => valid(e) && e.type!=="boss" && !e.displacementImmune &&
    !e.knockbackImmune && !(e.freezeT>0) && !e.knockQueue?.length && !e.bambooRush &&
    !e.revealT && (!e.hazard || e.hazard.phase==="recover");

  function create() {
    const grid=createGrid();
    const cooldowns=Object.fromEntries(ids.map(id=>[id,0]));
    let arrows=[], balls=[], shards=[], flashes=[], bow=null, follow=null, web=null, wind=null;
    const clear = () => {
      arrows=[]; balls=[]; shards=[]; flashes=[]; bow=null; follow=null; web=null; wind=null; grid.clear();
    };
    function reset() {
      clear();
      for (const id of ids) cooldowns[id]=0;
    }
    function flash(id,event,x,y,extra={}) {
      if (flashes.length >= 16) flashes.shift();
      flashes.push({id,event,x,y,time:.26,...extra});
    }
    function damage(env,enemy,amount,critEligible=true,feedback="direct") {
      const crit=critEligible && env.crit?.();
      return env.hit(enemy,amount*(crit ? crit.mult : 1),!!crit?.isCrit,feedback);
    }
    function bowTarget(origin, s) {
      return grid.nearest(origin,s.range,undefined,(e,d)=>{
        if (e.type === "boss") return 0;
        if (s.level < 3) return 1;
        if (armored(e)) return 1;
        if (d <= 120**2) return 2;
        return ["ranged","thrower","shooter","shiome"].includes(e.type) || e.ranged ? 3 : 4;
      });
    }
    function arrow(env,target,s,secondary) {
      if (arrows.length >= 2) return;
      const origin={x:env.player.x,y:env.player.y};
      const aim=Math.atan2(target.y-origin.y,target.x-origin.x);
      arrows.push({...origin, id:"hamaya", event:!secondary && s.awakened ? "awaken" : "arrow",
        angle:aim, origin, vx:Math.cos(aim)*s.speed, vy:Math.sin(aim)*s.speed,
        travel:s.range+s.radius, hits:new Set(), target, s, secondary});
      env.cue?.("hamaya","release");
    }
    function stepArrows(dt,env) {
      for (const p of arrows) {
        if (!env.running()) break;
        const step=Math.min(dt,p.travel/p.s.speed);
        const x=p.x+p.vx*step, y=p.y+p.vy*step, margin=p.s.radius+34;
        const impacts=[];
        grid.visit(Math.min(p.x,x)-margin,Math.min(p.y,y)-margin,Math.max(p.x,x)+margin,Math.max(p.y,y)+margin,e=>{
          if (p.hits.has(e)) return;
          const t=contact(p.x,p.y,x,y,e,p.s.radius+(e.type==="boss"?33:17));
          if (t !== Infinity) impacts.push({e,t});
        });
        impacts.sort((a,b)=>a.t-b.t);
        const cap=p.secondary ? 1 : p.s.hits;
        const heavy=!p.secondary && p.s.awakened;
        for (const {e} of impacts) {
          if (p.hits.size >= cap || !env.running()) break;
          if (heavy && e !== p.target && !p.hits.has(p.target) &&
              p.hits.size === cap-1 && grid.has(p.target) && gap(p.origin,p.target) <= p.s.range**2) continue;
          const primary=heavy && e===p.target;
          const scale=p.secondary ? .45 : primary ? 1.30 : p.hits.size ? .65 : 1;
          const type=e.type==="boss" ? p.s.boss : armored(e) ? p.s.armor : 1;
          const distant=gap(p.origin,e) >= 310**2 ? p.s.distant : 1;
          p.hits.add(e);
          flash(p.id,primary ? "heavy" : "impact",e.x,e.y);
          env.cue?.(p.id,primary ? "heavy" : "impact");
          damage(env,e,p.s.damage*scale*type*distant);
        }
        p.x=x; p.y=y;
        p.travel=p.hits.size >= cap ? 0 : p.travel-p.s.speed*step;
      }
      arrows=arrows.filter(p=>p.travel>1e-5);
    }
    function bowTick(dt,env,s) {
      const id="hamaya";
      if (follow && (follow.left-=dt) <= 0) {
        const {target,s:shot}=follow; follow=null;
        const aim=grid.has(target) && gap(env.player,target)<=shot.range**2 ? target : bowTarget(env.player,shot);
        if (aim) arrow(env,aim,shot,true);
      }
      if (bow && (bow.left-=dt) <= 0) {
        const {target,s:shot}=bow; bow=null;
        const aim=grid.has(target) && gap(env.player,target)<=shot.range**2 ? target : bowTarget(env.player,shot);
        cooldowns[id]=aim ? shot.cooldown : .20;
        if (aim) {
          arrow(env,aim,shot,false);
          if (shot.follow) follow={left:.18,s:shot,target:aim};
        }
        return;
      }
      if (!bow && cooldowns[id] <= 0) {
        const target=bowTarget(env.player,s);
        if (target) {
          bow={left:s.charge, target, s};
          env.cue?.(id,"draw");
        } else cooldowns[id]=.20;
      }
    }

    function throwBalls(env,s) {
      const id="ice_ball";
      const first=grid.nearest(env.player,s.range);
      if (!first) return false;
      const cast={bossImpact:new Set(),bossShatter:new Set()};
      const second=s.count>1 && grid.nearest(env.player,s.range,e=>e!==first);
      const targets=s.count>1 ? [first,second || first] : [first];
      for (const [i,target] of targets.entries()) {
        const angle=Math.atan2(target.y-env.player.y,target.x-env.player.x);
        // A small offset keeps both trajectories visible even on a shared target.
        const x=env.player.x-i*(Math.sin(angle)*18+Math.cos(angle)*8);
        const y=env.player.y+i*(Math.cos(angle)*18-Math.sin(angle)*8);
        balls.push({x,y,id,event:"ball",target,s,cast,
          scale:i===0 ? 1 : .55, life:s.life, hits:new Set(), angle, spin:angle});
      }
      flash(id,"cast",env.player.x,env.player.y);
      env.cue?.(id,"cast");
      return true;
    }
    const canBounce = (ball,e) => !ball.hits.has(e) && (e.type!=="boss" || !ball.cast.bossImpact.has(e));
    function fracture(ball,env) {
      const {s,cast,lastImpact,id}=ball;
      if (!s.shards || !lastImpact || !env.running()) return;
      const {x,y}=lastImpact;
      flash(id,"shatter",x,y,{radius:s.shardRange});
      env.cue?.(id,"shatter");
      const cap=Math.min(s.shards,14-shards.length);
      const targets=[];
      grid.circle(lastImpact,s.shardRange,(e,d)=>{
        if (e.type==="boss" && cast.bossShatter.has(e)) return;
        targets.push({e,d});
      });
      targets.sort((a,b)=>a.d-b.d);
      for (const {e:target} of targets.slice(0,cap)) {
        if (target.type==="boss") cast.bossShatter.add(target);
        shards.push({x,y,id,event:"shard",target,life:.38,
          angle:Math.atan2(target.y-y,target.x-x),
          amount:s.damage*s.shardDamage*ball.scale*(target.type==="boss"?s.boss:1)});
      }
    }
    function advance(p,dt,speed) {
      const dx=p.target.x-p.x,dy=p.target.y-p.y;
      const length=Math.hypot(dx,dy);
      if (length) p.angle=Math.atan2(dy,dx);
      const t=Math.min(1,speed*dt/(length || 1));
      return {x:p.x+dx*t,y:p.y+dy*t};
    }
    function stepBalls(dt,env) {
      for (const p of shards) {
        if (!env.running()) break;
        p.life-=dt;
        if (p.life<=0 || !grid.has(p.target)) { p.life=0; continue; }
        const end=advance(p,dt,820);
        if (contact(p.x,p.y,end.x,end.y,p.target,11)!==Infinity) {
          p.life=0;
          damage(env,p.target,p.amount);
        } else Object.assign(p,end);
      }
      shards=shards.filter(p=>p.life>0);
      for (const p of balls) {
        if (!env.running()) break;
        p.life-=dt;
        p.spin+=dt*8;
        if (p.life>0 && (!grid.has(p.target) || !canBounce(p,p.target)))
          p.target=grid.nearest(p,p.s.bounce,e=>canBounce(p,e));
        if (p.life<=0 || !p.target) {
          p.life=0;
          fracture(p,env);
          continue;
        }
        const end=advance(p,dt,p.s.speed);
        const margin=p.s.radius+34;
        let target, time=Infinity;
        grid.visit(Math.min(p.x,end.x)-margin,Math.min(p.y,end.y)-margin,
          Math.max(p.x,end.x)+margin,Math.max(p.y,end.y)+margin,e=>{
            if (!canBounce(p,e)) return;
            const t=contact(p.x,p.y,end.x,end.y,e,p.s.radius+(e.type==="boss"?33:17));
            if (t<time) { time=t; target=e; }
          });
        if (!target) { Object.assign(p,end); continue; }
        p.x+=(end.x-p.x)*time; p.y+=(end.y-p.y)*time;
        p.lastImpact=position(p);
        p.hits.add(target);
        const boss=target.type==="boss";
        if (boss) p.cast.bossImpact.add(target);
        flash(p.id,"impact",p.x,p.y);
        env.cue?.(p.id,"impact");
        damage(env,target,p.s.damage*p.s.impact*p.scale*(boss?p.s.boss:1));
        p.target=p.hits.size<p.s.hits && grid.nearest(p,p.s.bounce,e=>canBounce(p,e));
        if (!p.target) { p.life=0; fracture(p,env); }
      }
      balls=balls.filter(p=>p.life>0);
    }

    function weave(env,s) {
      const first=grid.nearest(env.player,s.range);
      if (!first) return false;
      const nodes=[first], edges=[];
      while (nodes.length<s.count) {
        const next=grid.nearest(env.player,s.range,e=>!nodes.includes(e) &&
          nodes.some(node=>gap(node,e)<=s.length**2),
        e=>nodes.filter(node=>gap(node,e)>s.length**2).length);
        if (!next) break;
        for (const node of nodes) if (gap(node,next)<=s.length**2)
          edges.push({a:node,b:next,lastA:position(node),lastB:position(next)});
        nodes.push(next);
      }
      const solo=nodes.length===1;
      web={nodes,edges,solo,s,left:solo ? 1.1 : s.life,sample:0,age:0,count:0,
        observations:new Map(),lastHits:new Map()};
      env.cue?.("spider_silk","cast");
      return true;
    }
    function silkTick(dt,env) {
      const field=web, {s}=field, id="spider_silk";
      field.nodes=field.nodes.filter(grid.has);
      field.edges=field.edges.filter(({a,b})=>grid.has(a) && grid.has(b) && gap(a,b)<=s.length**2);
      if (!field.solo) field.nodes=field.nodes.filter(e=>field.edges.some(edge=>e===edge.a || e===edge.b));
      if (!field.nodes.length) { web=null; return; }
      field.left-=dt;
      field.age+=dt;
      if (field.left <= 1e-7) {
        web=null;
        const strength=(s.awakened ? 1.75 : field.solo ? 1.25 : 0)+s.backcut;
        if (!strength) return;
        const center=field.nodes.reduce((p,e)=>({x:p.x+e.x/field.nodes.length,y:p.y+e.y/field.nodes.length}),{x:0,y:0});
        const radius=s.awakened ? 95 : 70;
        flash(id,"collapse",center.x,center.y,{radius,ground:true});
        env.cue?.(id,"collapse");
        let remaining=12;
        function cut(e, scale) {
          if (!remaining || !scale || !env.running() || !grid.has(e)) return;
          remaining--;
          damage(env,e,s.damage*scale*(e.type==="boss" ? s.boss : 1),false,"burst");
        }
        // Reserve capacity for the active anchors before sampling the surrounding crowd.
        for (const node of field.nodes) cut(node,strength);
        const nearbyScale=!s.awakened && field.solo ? s.backcut : strength;
        if (nearbyScale) grid.circle(center,radius,e=>{
          if (!field.nodes.includes(e)) cut(e,nearbyScale);
        });
        return;
      }
      field.sample-=dt;
      if (field.sample>0 || !field.edges.length || field.count>=36) return;
      field.sample+=.10;
      const current=new Map(), margin=64;
      const minX=Math.min(...field.nodes.map(n=>n.x))-margin, maxX=Math.max(...field.nodes.map(n=>n.x))+margin;
      const minY=Math.min(...field.nodes.map(n=>n.y))-margin, maxY=Math.max(...field.nodes.map(n=>n.y))+margin;
      grid.visit(minX,minY,maxX,maxY,e=>{
        if (field.count>=36 || !env.running() || field.nodes.includes(e)) return;
        const previous=field.observations.get(e) || e;
        current.set(e,position(e));
        const history=field.lastHits.get(e);
        if (history && (history.count>=2 || field.age-history.age<.60-1e-7)) return;
        const crossed=field.edges.some(({a,b,lastA,lastB})=>
          closeSegments(previous,e,a,b,13) || closeSegments(previous,e,lastA,lastB,13) ||
          closeSegments(previous,e,lastA,a,13) || closeSegments(previous,e,lastB,b,13));
        if (!crossed) return;
        field.count++;
        field.lastHits.set(e,{age:field.age,count:(history?.count || 0)+1});
        if (damage(env,e,s.damage*(e.type==="boss" ? s.boss : 1),false,"periodic") !== false) {
          flash(id,"cut",e.x,e.y);
          env.cue?.(id,"cut");
        }
      });
      field.observations=current;
      for (const edge of field.edges) {
        edge.lastA=position(edge.a);
        edge.lastB=position(edge.b);
      }
    }

    const safeCenter = (point,env) => gap(point,env.player)>=110**2 && !env.blocked(point.x,point.y,25);
    function openWind(env,s) {
      const centers=[];
      grid.circle(env.player,s.range,e=>{
        if (centers.length>=8) return;
        const point=position(e);
        if (safeCenter(point,env)) centers.push(point);
      },48);
      if (!centers.length) {
        // A close target can still anchor a blast just beyond the courier's safe radius.
        const target=grid.nearest(env.player,s.range);
        if (!target) return false;
        const direction=Math.atan2(target.y-env.player.y,target.x-env.player.x);
        for (const offset of [0,-.55,.55]) {
          const angle=direction+offset;
          const point={x:env.player.x+Math.cos(angle)*112,y:env.player.y+Math.sin(angle)*112};
          if (gap(point,target)<=s.radius**2 && safeCenter(point,env)) centers.push(point);
        }
      }
      let chosen, best=-1;
      for (const center of centers) {
        let score=0;
        grid.circle(center,s.radius,e=>{ score+=eligibleForPull(e) ? 2 : 1; },24);
        if (score>best) { best=score; chosen=center; }
      }
      if (!chosen) return false;
      wind={...chosen,s,left:s.life,sample:0,affected:new Set(),secondary:false};
      env.cue?.("wind_hole","open");
      return true;
    }
    function windTick(dt,env) {
      const field=wind, {s}=field, id="wind_hole";
      field.left-=dt;
      if (field.left<=1e-7) {
        wind=null;
        flash(id,"burst",field.x,field.y,{radius:s.radius,ground:true});
        env.cue?.(id,"burst");
        let remaining=s.hitCap;
        grid.circle(field,s.radius,e=>{
          if (!remaining || !env.running()) return;
          remaining--;
          damage(env,e,s.damage*(e.type==="boss" ? s.boss : 1),false,"burst");
        });
        if (s.twin && !field.secondary && env.running() && safeCenter(field,env)) {
          const secondary={...s,awakened:false,twin:false,damage:s.damage*.50,radius:s.radius*.68,
            power:s.power*.72, life:.85,pullCap:Math.floor(s.pullCap/2),hitCap:Math.floor(s.hitCap/2)};
          wind={x:field.x,y:field.y,s:secondary,left:secondary.life,sample:0,affected:new Set(),secondary:true};
          env.cue?.(id,"open");
        }
        return;
      }
      if (s.awakened && field.left<=.35 && !field.compressed) {
        field.compressed=true;
        env.cue?.(id,"compress");
      }
      if (!field.suction && s.life-field.left>=.20) {
        field.suction=true;
        env.cue?.(id,"suction");
      }
      field.sample-=dt;
      if (field.sample>0) return;
      field.sample+=.12;
      field.affected.clear();
      grid.circle(field,s.radius,e=>{
        if (field.affected.size<s.pullCap && eligibleForPull(e)) field.affected.add(e);
      });
    }
    function pull(e,dt,player,blocked) {
      const field=wind;
      if (!field?.affected.has(e) || !eligibleForPull(e) || gap(field,player)<110**2) return false;
      const dx=field.x-e.x,dy=field.y-e.y;
      const distance=Math.hypot(dx,dy);
      if (distance<=14 || distance>field.s.radius) return false;
      const step=Math.min(distance-14,field.s.power*(field.compressed ? 1.45 : 1)*dt);
      const count=Math.max(1,Math.ceil(step/8));
      const sx=dx/distance*step/count,sy=dy/distance*step/count;
      let moved=false;
      for (let i=0;i<count;i++) {
        const next={x:e.x+sx,y:e.y+sy};
        if (gap(next,player)<Math.min(78**2,gap(e,player)) || blocked(next.x,next.y,16)) break;
        Object.assign(e,next);
        moved=true;
      }
      return moved;
    }
    function slow(e) {
      return web?.nodes.includes(e) && e.type!=="boss" && valid(e) ? 1-web.s.slow : 1;
    }

    function tick(dt,env) {
      let due=false;
      for (const id of ids) if (env.levels[id]>0) {
        cooldowns[id]=Math.max(0,cooldowns[id]-dt);
        due ||= cooldowns[id]===0;
      }
      for (const fx of flashes) fx.time-=dt;
      flashes=flashes.filter(fx=>fx.time>0);
      if (due || bow || follow || arrows.length || balls.length || shards.length || web || wind) {
        grid.rebuild(env.enemies);
        stepArrows(dt,env);
        stepBalls(dt,env);
        if (env.running() && web) silkTick(dt,env);
        if (env.running() && wind) windTick(dt,env);
        if (!env.running()) return;
        if (env.levels.hamaya>0) bowTick(dt,env,env.resolve("hamaya"));
        if (env.levels.ice_ball>0 && !cooldowns.ice_ball && balls.length===0) {
          const s=env.resolve("ice_ball");
          cooldowns.ice_ball=throwBalls(env,s) ? s.cooldown : .20;
        }
        if (env.levels.spider_silk>0 && !cooldowns.spider_silk && !web) {
          const s=env.resolve("spider_silk");
          cooldowns.spider_silk=weave(env,s) ? s.cooldown : .20;
        }
        if (env.levels.wind_hole>0 && !cooldowns.wind_hole && !wind) {
          const s=env.resolve("wind_hole");
          cooldowns.wind_hole=openWind(env,s) ? s.cooldown : .20;
        }
      }
      for (const id of ids) if (env.levels[id]>0) {
        const max=env.resolve(id).cooldown;
        env.cooldown?.(id,Math.max(cooldowns[id],bow && id==="hamaya" ? bow.left : 0),max);
      }
    }
    function visuals(player) {
      const draw=[];
      if (bow && player) {
        const angle=Math.atan2(bow.target.y-player.y,bow.target.x-player.x);
        draw.push({id:"hamaya",event:"draw",x:player.x+Math.cos(angle)*32,
          y:player.y+Math.sin(angle)*24,angle,lift:19,depth:player.y-.01});
      }
      if (web) {
        for (const {a,b} of web.edges) draw.push({id:"spider_silk",event:"thread",ground:true,
          x:a.x,y:a.y,angle:Math.atan2(b.y-a.y,b.x-a.x),length:Math.sqrt(gap(a,b)),awakened:web.s.awakened});
        if (web.solo) {
          const target=web.nodes[0], boss=target.type==="boss";
          draw.push({id:"spider_silk",event:"bind",...position(target),
            visualWidth:Math.max(boss ? 104 : 56,(target.r || (boss ? 42 : 18))*2.4),
            lift:boss ? 42 : 22,depth:target.y+(boss ? 45 : target.type==="mis" ? 28 : 20)});
        }
      }
      if (wind) draw.push({id:"wind_hole",event:"field",ground:true,x:wind.x,y:wind.y,
        radius:wind.s.radius,angle:wind.left*1.45,compressed:wind.compressed,awakened:wind.s.awakened});
      return [...draw,...arrows,...balls,...shards,...flashes];
    }
    return {tick,reset,suspend:clear,visuals,pull,slow};
  }

  const localArt=typeof window==="undefined" || !window.location || lab(window);
  const artRoot=localArt ? "art/skill-expansion-10-13/" : "assets/img/skills/";
  const trialImages=new Map();
  const trialCards=new Map();
  const touchArt=(Number(globalThis.navigator?.maxTouchPoints)||0)>0 ||
    !!globalThis.matchMedia?.("(pointer: coarse)")?.matches;
  const cardLimit=touchArt?10:26;
  let trialArt, artLoad;
  function loadArt() {
    return artLoad ??= fetch(artRoot+(localArt ? "manifest.json" : "expansion-manifest.json"),{cache:"no-cache"})
      .then(response=>{
        if (!response.ok) throw Error("Skill Lab manifest unavailable");
        return response.json();
      })
      .then(manifest=>{ trialArt=manifest.assets || {}; return true; })
      .catch(()=>{ artLoad=undefined; return false; });
  }
  function artPath(key) {
    const asset=trialArt?.[key];
    const path=asset?.labUse === true && asset.path;
    return typeof path==="string" && (path.startsWith(artRoot) || !localArt && path.startsWith("assets/img/vfx/skills/")) &&
      /^[a-z0-9/_-]+\.webp$/.test(path) ? path : null;
  }
  function artImage(key) {
    const path=artPath(key);
    if (!path) return null;
    if (!path.includes("/cards/")) return loadTrialImage(trialImages,path);
    const image=loadTrialImage(trialCards,path);
    const recent=trialCards.get(path);
    trialCards.delete(path);
    trialCards.set(path,recent);
    if (trialCards.size>cardLimit) trialCards.delete(trialCards.keys().next().value);
    return image;
  }
  function loadTrialImage(cache,path) {
    let image=cache.get(path);
    if (!image) {
      image=new Image();
      image.decoding="async";
      cache.set(path,image);
      image.src=path;
    }
    return image.complete && image.naturalWidth ? image : null;
  }
  const spriteWidths={
    arrow:85,awaken:147,draw:77,impact:62,heavy:150,
    cast:70,ball:43,shard:45,shatter:150,bind:50,cut:62,collapse:176,burst:200
  };
  function insideView(view, x, y, left, width, height, angle, scaleY=1) {
    if (!view) return true;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const center = left + width / 2;
    const cx = x + center * cos, cy = y + center * sin * scaleY;
    const rx = (Math.abs(cos) * width + Math.abs(sin) * height) / 2 + 2;
    const ry = (Math.abs(sin) * width + Math.abs(cos) * height) / 2 * scaleY + 2;
    return cx + rx >= view.left && cx - rx <= view.right &&
      cy + ry >= view.top && cy - ry <= view.bottom;
  }
  function paint(ctx,effect,diagnostics,view,tilt=1) {
    const {x,y,event,radius,angle}=effect;
    const key=effect.id+":"+(event==="field" && effect.compressed ? "compress" : event);
    const art=artImage(key) || (effect.compressed ? artImage(effect.id+":"+event) : null);
    if (art) {
      const width=event==="thread" ? effect.length : radius ? radius*2 : effect.visualWidth || spriteWidths[event] || 60;
      // This burst raster contains a pre-flattened ellipse (194 of 384 rows).
      // Normalize it in world space before applying the single ground projection.
      const preflattened=key==="wind_hole:burst" && /wind-hole__burst(?:__chatgpt)?\.webp$/.test(artPath(key)||"");
      const height=event==="thread" ? (effect.awakened ? 25 : 18) :
        width*art.naturalHeight/art.naturalWidth*(preflattened ? 384/194 : 1);
      const left=event==="thread" ? 0 : event==="arrow" || event==="awaken" || event==="shard" ? -width*.85 : -width/2;
      // Upright air sprites retain their aspect ratio and projected direction.
      const scaleY=effect.ground ? 1 : 1/tilt;
      const paintY=y-(effect.ground ? 0 : (effect.lift ?? 10)*scaleY);
      const rotation=effect.spin ?? (effect.ground ? angle ?? 0 : Math.atan2(Math.sin(angle ?? 0)*tilt,Math.cos(angle ?? 0)));
      if (insideView(view,x,paintY,left,width,height,rotation,scaleY)) {
        ctx.save();
        ctx.translate(x,paintY);
        if (scaleY!==1) ctx.scale(1,scaleY);
        ctx.rotate(rotation);
        ctx.globalAlpha*=(effect.time ? Math.min(1,effect.time/.17) : event==="field" ? .68 : 1)*(event==="draw" ? .76 : 1);
        ctx.drawImage(art,left,-height/2,width,height);
        ctx.restore();
      }
    }
    if (!diagnostics) return;
    const line=event==="arrow" || event==="awaken" || event==="thread";
    const guideRadius=radius || (event==="draw" ? 25 : 11);
    const guideLeft=event==="thread" ? 0 : line ? -36 : -guideRadius;
    const guideRight=line ? effect.length ?? 16 : guideRadius;
    if (!insideView(view,x,y,guideLeft,guideRight-guideLeft,line ? 2 : guideRadius*2,angle || 0)) return;
    ctx.save();
    ctx.translate(x,y);
    if (angle) ctx.rotate(angle);
    ctx.strokeStyle={hamaya:"#ffdf7e",ice_ball:"#91ecff",spider_silk:"#ffa7bf",wind_hole:"#8be9b2"}[effect.id];
    ctx.lineWidth=2;
    ctx.setLineDash([5,4]);
    ctx.beginPath();
    if (line) {
      ctx.moveTo(guideLeft,0);
      ctx.lineTo(guideRight,0);
    } else ctx.arc(0,0,guideRadius,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
  const sfxRoot="assets/audio/sfx/skills/";
  const sfxCatalog=Object.freeze({
    "hamaya:draw":Object.freeze({id:"hamaya",event:"draw",key:"hamaya:draw",name:"破魔・神弓・蓄弦",when:"蓄弦開始",path:sfxRoot+"hamaya/hamaya__draw.mp3",volume:.56,priority:"P1",throttleMs:160,loop:false}),
    "hamaya:release":Object.freeze({id:"hamaya",event:"release",key:"hamaya:release",name:"破魔・神弓・發射",when:"主箭及追射出膛",path:sfxRoot+"hamaya/hamaya__release.mp3",volume:.68,priority:"P0",throttleMs:110,loop:false}),
    "hamaya:impact":Object.freeze({id:"hamaya",event:"impact",key:"hamaya:impact",name:"破魔・神弓・命中",when:"一般箭擊及貫穿",path:sfxRoot+"hamaya/hamaya__impact.mp3",volume:.60,priority:"P1",throttleMs:90,loop:false}),
    "hamaya:heavy":Object.freeze({id:"hamaya",event:"heavy",key:"hamaya:heavy",name:"破魔・神弓・重擊 Lv5",when:"覺醒主目標重擊",path:sfxRoot+"hamaya/hamaya__heavy__lv05.mp3",volume:.80,priority:"P0",throttleMs:140,loop:false}),
    "spider_silk:cast":Object.freeze({id:"spider_silk",event:"cast",key:"spider_silk:cast",name:"絡新婦・妖絲・展開",when:"絲線展開或單體纏絲",path:sfxRoot+"spider-silk/spider-silk__cast.mp3",volume:.58,priority:"P1",throttleMs:180,loop:false}),
    "spider_silk:cut":Object.freeze({id:"spider_silk",event:"cut",key:"spider_silk:cut",name:"絡新婦・妖絲・切割",when:"穿線切割（含節流）",path:sfxRoot+"spider-silk/spider-silk__cut.mp3",volume:.48,priority:"P1",throttleMs:180,loop:false}),
    "spider_silk:collapse":Object.freeze({id:"spider_silk",event:"collapse",key:"spider_silk:collapse",name:"絡新婦・妖絲・收束",when:"終切、收束或斷絲回斬",path:sfxRoot+"spider-silk/spider-silk__collapse.mp3",volume:.76,priority:"P0",throttleMs:160,loop:false}),
    "ice_ball:cast":Object.freeze({id:"ice_ball",event:"cast",key:"ice_ball:cast",name:"冰魄・妖毬・發射",when:"冰毬發射（單雙毬共用）",path:sfxRoot+"ice-ball/ice-ball__cast.mp3",volume:.58,priority:"P1",throttleMs:140,loop:false}),
    "ice_ball:impact":Object.freeze({id:"ice_ball",event:"impact",key:"ice_ball:impact",name:"冰魄・妖毬・撞擊",when:"冰毬撞擊與彈跳改向",path:sfxRoot+"ice-ball/ice-ball__impact.mp3",volume:.62,priority:"P1",throttleMs:110,loop:false}),
    "ice_ball:shatter":Object.freeze({id:"ice_ball",event:"shatter",key:"ice_ball:shatter",name:"冰魄・妖毬・碎裂",when:"末次撞擊後碎裂爆發",path:sfxRoot+"ice-ball/ice-ball__shatter.mp3",volume:.76,priority:"P0",throttleMs:160,loop:false}),
    "wind_hole:open":Object.freeze({id:"wind_hole",event:"open",key:"wind_hole:open",name:"冥風・風穴・開啟",when:"主穴或次穴生成",path:sfxRoot+"wind-hole/wind-hole__open.mp3",volume:.64,priority:"P0",throttleMs:180,loop:false}),
    "wind_hole:suction":Object.freeze({id:"wind_hole",event:"suction",key:"wind_hole:suction",name:"冥風・風穴・吸引",when:"風穴持續吸引（單聲道不按怪複製）",path:sfxRoot+"wind-hole/wind-hole__suction.mp3",volume:.42,priority:"P1",throttleMs:700,loop:true}),
    "wind_hole:compress":Object.freeze({id:"wind_hole",event:"compress",key:"wind_hole:compress",name:"冥風・風穴・壓縮 Lv5",when:"Lv5 爆發前 0.35s 壓縮",path:sfxRoot+"wind-hole/wind-hole__compress__lv05.mp3",volume:.68,priority:"P0",throttleMs:220,loop:false}),
    "wind_hole:burst":Object.freeze({id:"wind_hole",event:"burst",key:"wind_hole:burst",name:"冥風・風穴・終爆",when:"風壓終爆（唯一扣血時點）",path:sfxRoot+"wind-hole/wind-hole__burst.mp3",volume:.80,priority:"P0",throttleMs:160,loop:false})
  });
  const cueLastAt=new WeakMap();
  function playCue(audio,id,event,elapsed) {
    if (!audio) return false;
    const key=id+":"+event;
    const spec=sfxCatalog[key];
    const now=Number.isFinite(elapsed) ? elapsed : (typeof performance!=="undefined" ? performance.now()/1000 : null);
    if (now!==null && spec?.throttleMs) {
      let table=cueLastAt.get(audio);
      if (!table) { table=new Map(); cueLastAt.set(audio,table); }
      const prev=table.get(key);
      if (prev!==undefined && now>=prev && (now-prev)*1000<spec.throttleMs) return false;
      table.set(key,now);
    }
    const fallback=()=>{
      const strong=["heavy","shatter","collapse","burst"].includes(event);
      if ((event==="release" || event==="open") && audio.boomerang) audio.boomerang();
      else audio.impact?.(strong ? "heavy" : "normal");
    };
    if (spec && typeof audio.playExpansionCue==="function") {
      return audio.playExpansionCue(spec,fallback);
    }
    fallback();
    return true;
  }
  return Object.freeze({ids,cards,upgrades,mutations,releases,spec,create,lab,catalogIds,guidedDraft,randomFor,
    paint,playCue,sfxCatalog,loadArt,artReady:()=>!!trialArt,artPath,artImage,
    cardCacheStats:()=>({retained:trialCards.size,limit:cardLimit,pinned:trialImages.size})});
})();

if (typeof window !== "undefined") window.GAME_SKILL_EXPANSION=YOKAI_SKILL_EXPANSION;
if (typeof module !== "undefined") module.exports=YOKAI_SKILL_EXPANSION;
