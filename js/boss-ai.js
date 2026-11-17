// 妖怪快遞社：獨立首領攻擊狀態機（V3 Boss AI 控制器）
// 負責首領蓄勢預告、直線衝撞、缺口衝擊環與潮汐安全帶之鎖位與碰撞判定。
(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const sakuraAI = root.SAKURA_BOSS_AI || (typeof module !== 'undefined' && module.exports ? require('./boss-sakura.js') : null);

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalizeAngle(a) {
    let ang = a % (Math.PI * 2);
    if (ang > Math.PI) ang -= Math.PI * 2;
    if (ang < -Math.PI) ang += Math.PI * 2;
    return ang;
  }
  // Small preannounced circular tracking motion shared by warning art, water
  // columns and the real hitbox; never chase the player after cast begins.
  function advanceVortexOrbit(h, dt) {
    if (h.kind !== 'rainVortex' || !['telegraph','active'].includes(h.phase)) return;
    h.orbitClock = (h.orbitClock || 0) + dt;
    for (let i=0;i<(h.vortexes||[]).length;i++) {
      const v=h.vortexes[i];
      if (!Number.isFinite(v.anchorX) || !Number.isFinite(v.anchorY)) continue;
      const start=i*2.3999632297;
      const phase=start + h.orbitClock * (Math.PI * 2 / 1.85);
      const radius=8;
      v.x=v.anchorX + radius * (Math.cos(phase)-Math.cos(start));
      v.y=v.anchorY + radius * (Math.sin(phase)-Math.sin(start));
    }
  }

  // 各 bossTheme 對應的攻擊招式池（資料導向，不硬編碼 stageId）
  // slam/charge/ring/tide 為既有四大模板，未核准新招式不加入
  const BOSS_THEME_POOLS = Object.freeze({
    town:   Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    harbor: Object.freeze({ base: ['slam', 'charge', 'tide'], halfHp: ['slam', 'charge', 'ring', 'tide'] }),
    // rain-port 專屬：潮扇逼轉向、渦流封退路、潮道逼換線。
    // 不再複用夜行町的砸地、直線衝撞或圓環攻擊池。
    "rain-port": Object.freeze({
      base: ['rainVortex', 'tidalFan', 'tide'],
      halfHp: ['tidalFan', 'rainVortex', 'tide', 'tidalFan']
    }),
    sakura: Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    bamboo: Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    kyoto:  Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    temple: Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    ferry:  Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    yomi:   Object.freeze({ base: ['slam', 'charge', 'ring', 'tide'], halfHp: ['slam', 'charge', 'ring', 'tide'] })
  });

  function getBossTheme(e) {
    // Stage data is closed over inside game.js, not on window.
    // Each boss carries its own theme; never consult stale globals.
    return e?.bossTheme || 'town';
  }

  function getAttackPool(e) {
    const theme = getBossTheme(e);
    const pool = BOSS_THEME_POOLS[theme] || BOSS_THEME_POOLS.town;
    // 雨港專屬：以 stageId 判定，僅 rain-port 啟用 tidalFan/rainVortex
    const stageId = e?.stageId || '';
    const isRainPort = stageId === 'rain-port';
    const rainPortPool = isRainPort ? BOSS_THEME_POOLS['rain-port'] : null;
    const effectivePool = rainPortPool || pool;
    const isGate = e.bossIndex === 2 || e.gatekeeper;
    const isFinal = e.bossIndex === 3 || e.final;
    const halfHp = (e.hp || 0) <= 0.5 * (e.max || 1400);

    if (isRainPort && e.bossIndex === 0) return ['rainVortex', 'tidalFan'];
    if (isRainPort && isGate) return ['tidalFan', 'tide', 'rainVortex'];
    if (isGate || e.bossIndex === 0) {
      // 第一、三王固定 slam
      return ['slam'];
    }
    if (e.bossIndex === 1) {
      // 第二王：基礎輪換
      return effectivePool.base || ['slam', 'charge'];
    }
    if (isFinal) {
      // 最終王：依半血解鎖
      return halfHp ? (effectivePool.halfHp || effectivePool.base) : (effectivePool.base || ['slam', 'charge']);
    }
    return effectivePool.base || ['slam'];
  }

  function nextAttackKind(e) {
    // 終王半血後的返潮掃擊可緊接錯峰水柱，迫使第二次換路線。
    if(e.stageId === 'rain-port' && e._harborFollowup){
      e._harborFollowup = false;
      return 'rainVortex';
    }
    const pool = getAttackPool(e);
    const step = e._attackStep || 0;
    e._attackStep = step + 1;
    return pool[step % pool.length];
  }

  function footwork(e, player, dt, options = {}) {
    if (e?.stageId === 'sakura-pass' && sakuraAI) return sakuraAI.footwork(e,player,dt,options);
    // Stage 2 only: glide diagonally across the player's line of approach
    // between casts. Stage 1 keeps its existing straight pursuit unchanged.
    if (!e || e.stageId !== 'rain-port' || e.hp <= 0 || e.shield ||
        e.hazard || !(dt > 0) || !player) return false;
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 145 || d > 515) return false;
    e._harborSidestepAge = (e._harborSidestepAge || 0) + dt;
    const sign = Math.floor(e._harborSidestepAge / 1.65) % 2 ? -1 : 1;
    const forwardX = dx / d, forwardY = dy / d;
    const sideX = -forwardY * sign, sideY = forwardX * sign;
    // Obey the main enemy loop's slow/frost speed cap, not unslowed e.speed.
    const baseSpeed = Number.isFinite(options.speed) ? options.speed : (e.speed || 100);
    const speed = Math.min(200, Math.max(0, baseSpeed) * 1.55);
    if (speed <= 0) return false;
    const stepX = (forwardX * .58 + sideX * .81) * speed * dt;
    const stepY = (forwardY * .58 + sideY * .81) * speed * dt;
    const blocked = typeof options.blocked === 'function' ? options.blocked : () => false;
    const oldX = e.x, oldY = e.y;
    if (!blocked(e.x + stepX, e.y)) e.x += stepX;
    if (!blocked(e.x, e.y + stepY)) e.y += stepY;
    if (e.x === oldX && e.y === oldY) return false;
    e.faceAng = Math.atan2(e.y - oldY, e.x - oldX);
    return true;
  }

  function start(e, player, options = {}) {
    if (!e || (e.hp || 0) <= 0 || e.hazard || e.shield) return false;
    if ((e.stageId === 'sakura-pass' || options.stageId === 'sakura-pass') && sakuraAI) return sakuraAI.start(e,player,options);

    const kind = nextAttackKind(e);
    const p = player || { x: 0, y: 0 };
    const rainPort = options.stageId === 'rain-port' || e.stageId === 'rain-port';
    // Night-town Boss is drawn with its contact feet 44 upright pixels below
    // e.y. Its charge hazard and hit sweep must share the projected foot point.
    // Other stages and isolated AI tests keep their existing zero offset.
    const footOffsetY = kind === 'charge' && options.stageId === 'night-town'
      ? Math.max(0, Number(options.bossVisualFootOffsetY) || 0) : 0;
    const angle = Math.atan2(p.y - e.y - footOffsetY, p.x - e.x);

    if (kind === 'charge') {
      // Compute one physical path shared by the preview endpoint and the dash.
      // Clip to buildings up-front so a blocked dash never previews past a wall.
      const chargeSpeed = options.stageId === 'night-town' ? 1240 : 620;
      const maxTravel = chargeSpeed * (options.stageId === 'night-town' ? 0.70 : 0.65);
      let reachable = maxTravel;
      if ((options.stageId === 'night-town' || options.stageId === 'sakura-pass') && typeof options.blocked === 'function') {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const traceStep = 8;
        for (let d = traceStep; d <= maxTravel + traceStep; d += traceStep) {
          const trial = Math.min(d, maxTravel);
          if (options.blocked(e.x + cos * trial, e.y + sin * trial)) {
            reachable = Math.max(0, trial - traceStep); break;
          }
          if (trial >= maxTravel) break;
        }
      }
      e.hazard = {
        kind: 'charge',
        phase: 'telegraph',
        t: 0,
        duration: 1.0,
        x: e.x,
        y: e.y + footOffsetY,
        angle,
        footOffsetY,
        length: reachable,
        travelled: 0,
        speed: chargeSpeed,
        r: options.stageId === 'night-town' ? 76 : 52,
        hit: false
      };
    } else if (kind === 'ring') {
      e.hazard = {
        kind: 'ring',
        phase: 'telegraph',
        t: 0,
        duration: 1.1,
        x: e.x,
        y: e.y,
        angle,
        // Stage3's side walls must not swallow the only safe gap.
        gapAngle: e.stageId === 'sakura-pass' ? (p.y >= e.y ? Math.PI / 2 : -Math.PI / 2) : angle + Math.PI / 2,
        gapWidth: Math.PI / 2,
        r: 80,
        prevR: 80,
        hit: false
      };
    } else if (kind === 'tide') {
      e._tideFlip = !e._tideFlip;
      const safeOffset = e._tideFlip ? 100 : -100;
      e.hazard = {
        kind: 'tide',
        phase: 'telegraph',
        t: 0,
        duration: 1.1,
        x: p.x,
        y: p.y,
        angle,
        safeOffset,
        safeWidth: 130,
        progress: -280,
        hit: false
      };
    } else if (kind === 'tidalFan') {
      // Double the ACTUAL outer reach (r + 30), not just the painted fan:
      // normal 255 -> 510, final 275 -> 550. Keep the 120-degree sector and
      // the safe rear arc; slightly longer first warning offsets the reach.
      const originalFanReach = rainPort && e.final ? 275 : 255;
      e.hazard = {
        kind: 'tidalFan',
        phase: 'telegraph',
        t: 0,
        duration: rainPort && e.final ? 0.96 : 1.08,
        x: e.x,
        y: e.y,
        angle,
        startAngle: angle - Math.PI / 3,  // 120-degree sector, rear remains safe
        endAngle: angle + Math.PI / 3,
        r: originalFanReach * 2 - 30,
        sweepPass: 1,
        sweepReverse: false,
        doubleSweep: rainPort,
        ultimate: rainPort && e.final && e.hp <= e.max * .50,
        hit: false
      };
    } else if (kind === 'rainVortex') {
      // 渦流會鎖定施法當刻的玩家與側邊退路，而非隨機落在王身邊。
      const vortexCount = e.final ? 5 : 3;
      const vortexes = [];
      const forwardX = Math.cos(angle), forwardY = Math.sin(angle);
      const sideX = -forwardY, sideY = forwardX;
      const footprint = [[0,0],[115,105],[115,-105],[-105,95],[-105,-95]];
      for (let i = 0; i < vortexCount; i++) {
        const [front, side] = footprint[i];
        vortexes.push({
          x: p.x + forwardX * front + sideX * side,
          y: p.y + forwardY * front + sideY * side,
          anchorX: p.x + forwardX * front + sideX * side,
          anchorY: p.y + forwardY * front + sideY * side,
          angle: 0,
          r: e.final ? 35 : 32,
          hit: false
        });
      }
      e.hazard = {
        kind: 'rainVortex',
        phase: 'telegraph',
        t: 0,
        duration: e.final ? .78 : .88,
        x: e.x,
        y: e.y,
        angle,
        vortexes,
        hit: false
      };
    } else {
      // 預設 slam: 鎖定玩家發動當下之位置
      e.hazard = {
        kind: 'slam',
        phase: 'telegraph',
        t: 0,
        duration: 1.1,
        x: p.x,
        y: p.y,
        angle,
        r: 150,
        hit: false
      };
    }

    e.slamT = e.hazard.duration;
    e.slamRecoverT = 0;
    return true;
  }

  function step(e, player, dt, options = {}) {
    if ((e?.stageId === 'sakura-pass' || options.stageId === 'sakura-pass') && sakuraAI) return sakuraAI.step(e,player,dt,options);
    if (!e || (e.hp || 0) <= 0) {
      if (e && e.hazard) {
        delete e.hazard;
        e.slamT = 0;
        e.slamRecoverT = 0;
      }
      return { hit: null, started: false, finished: false };
    }

    const blocked = options.blocked || (() => false);
    const paused = !!options.paused;

    if (dt <= 0 || paused || e.shield) {
      return { hit: null, started: false, finished: false };
    }

    if (e.attackCd > 0) {
      e.attackCd = Math.max(0, e.attackCd - dt);
    }

    let started = false;
    const p = player || { x: 0, y: 0 };
    const isRainPort = options.stageId === 'rain-port' || e.stageId === 'rain-port';
    if (!e.hazard && (e.attackCd || 0) <= 0 && dist(e, p) < (isRainPort ? 520 : 340)) {
      started = start(e, p, options);
    }

    if (!e.hazard) {
      return { hit: null, started, finished: false };
    }

    const h = e.hazard;
    let hit = null;
    let finished = false;
    const previousT = h.t;
    h.t += dt;
    advanceVortexOrbit(h, dt);

    if (h.phase === 'telegraph') {
      e.slamT = Math.max(0, h.duration - h.t);
      e.slamRecoverT = 0;
      if (h.t >= h.duration) {
        h.phase = 'active';
        h.t = 0;
        if (h.kind === 'charge') h.duration = options.stageId === 'night-town' ? 0.70 : 0.65;
        else if (h.kind === 'ring') { h.duration = 0.7; h.r = 80; h.prevR = 80; }
        else if (h.kind === 'tide') { h.duration = 1.0; h.progress = -280; }
        else if (h.kind === 'tidalFan') { h.duration = h.sweepPass === 2 ? .48 : .55; }
        else if (h.kind === 'rainVortex') { h.duration = 1.02; }
        else { h.duration = 0.15; }
      }
      return { hit: null, started, finished: false };
    }

    if (h.phase === 'active') {
      e.slamT = 0;
      e.slamRecoverT = 0;

      if (h.kind === 'slam') {
        if (!h.hit && dist(p, { x: h.x, y: h.y }) <= h.r) {
          h.hit = true;
          hit = { damage: 20, kind: 'slam', x: h.x, y: h.y };
        }
        if (h.t >= h.duration) {
          h.phase = 'recovery';
          h.t = 0;
          h.duration = 1.35;
        }
      } else if (h.kind === 'charge') {
        const speed = Number.isFinite(h.speed) ? h.speed : 620;
        const limit = Number.isFinite(h.length) ? h.length : speed * h.duration;
        const totalTravel = Math.min(speed * dt, Math.max(0, limit - (h.travelled || 0)));
        const steps = Math.max(1, Math.ceil(totalTravel / 10));
        const stepDist = totalTravel / steps;
        const cos = Math.cos(h.angle), sin = Math.sin(h.angle);
        let wallHit = false;

        for (let i = 0; i < steps; i++) {
          const nx = e.x + cos * stepDist;
          const ny = e.y + sin * stepDist;
          if (blocked(nx, ny)) {
            wallHit = true;
            break;
          }
          e.x = nx;
          e.y = ny;
          h.travelled = (h.travelled || 0) + stepDist;
        }

        const contactY = e.y + (h.footOffsetY || 0);
        if (!h.hit && dist({ x: e.x, y: contactY }, p) <= h.r) {
          h.hit = true;
          hit = { damage: 18, kind: 'charge', x: e.x, y: contactY };
        }

        if (wallHit || (h.travelled || 0) >= limit - 0.01 || h.t >= h.duration) {
          h.phase = 'recovery';
          h.t = 0;
          h.duration = 1.35;
        }
      } else if (h.kind === 'ring') {
        const u = Math.min(1, h.t / h.duration);
        const curR = 80 + 320 * u;
        const prevR = h.prevR || 80;
        h.prevR = curR;
        h.r = curR;

        const d = dist(p, { x: h.x, y: h.y });
        const inBand = d >= (prevR - 28) && d <= (curR + 28);
        if (inBand && !h.hit) {
          const ang = Math.atan2(p.y - h.y, p.x - h.x);
          const diff = Math.abs(normalizeAngle(ang - h.gapAngle));
          const inGap = diff <= (h.gapWidth / 2);
          if (!inGap) {
            h.hit = true;
            hit = { damage: 20, kind: 'ring', x: p.x, y: p.y };
          }
        }

        if (h.t >= h.duration) {
          h.phase = 'recovery';
          h.t = 0;
          h.duration = 1.35;
        }
      } else if (h.kind === 'tide') {
        const u = Math.min(1, h.t / h.duration);
        const curProgress = -280 + 560 * u;
        h.progress = curProgress;

        const dx = p.x - h.x, dy = p.y - h.y;
        const cos = Math.cos(h.angle), sin = Math.sin(h.angle);
        const forward = dx * cos + dy * sin;
        const lateral = -dx * sin + dy * cos;
        const inSafeLane = Math.abs(lateral - h.safeOffset) <= (h.safeWidth / 2);
        const inWave = Math.abs(forward - curProgress) <= 60;

        if (inWave && !inSafeLane && !h.hit) {
          h.hit = true;
          hit = { damage: 18, kind: 'tide', x: p.x, y: p.y };
        }

        if (h.t >= h.duration) {
          h.phase = 'recovery';
          h.t = 0;
          h.duration = isRainPort ? .82 : 1.35;
        }
      } else if (h.kind === 'tidalFan') {
        // 第二段從原路反向折返；角度使用相對鎖定方向以免跨 PI 出錯。
        const u = Math.min(1, h.t / h.duration);
        const fanR = h.r;

        const dx = p.x - h.x, dy = p.y - h.y;
        const distToCenter = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);
        // 前幀到本幀掃過的整段扇面都需要判定，否則低 FPS 可直接跳過玩家。
        const prevU = Math.min(1, previousT / h.duration);
        const halfSpan = Math.abs(h.endAngle - h.startAngle) / 2;
        const startRelative = h.sweepReverse ? halfSpan : -halfSpan;
        const signedSpan = (h.sweepReverse ? -1 : 1) * halfSpan * 2;
        const prevSweep = startRelative + signedSpan * prevU;
        const curSweep = startRelative + signedSpan * u;
        // Legacy/test hazards may specify only the angular boundaries.
        const centerAngle = Number.isFinite(h.angle) ? h.angle : (h.startAngle + h.endAngle) / 2;
        const relative = normalizeAngle(angleToPlayer - centerAngle);
        const halfWidth = Math.PI / 12;
        const inSweptFan = relative >= Math.min(prevSweep, curSweep) - halfWidth
          && relative <= Math.max(prevSweep, curSweep) + halfWidth;
        // 掃掠厚度不可超出 renderer 裁切的整體預警扇面。
        const inFan = Math.abs(normalizeAngle(angleToPlayer - ((h.startAngle + h.endAngle) / 2)))
          <= Math.abs(h.endAngle - h.startAngle) / 2 + 1e-9;

        if (distToCenter <= fanR + 30 && inFan && inSweptFan && !h.hit) {
          h.hit = true;
          hit = { damage: 18, kind: 'tidalFan', x: p.x, y: p.y };
        }

        if (h.t >= h.duration) {
          if (h.doubleSweep && h.sweepPass === 1) {
            h.phase = 'telegraph';
            h.t = 0;
            h.duration = .25;
            h.sweepPass = 2;
            h.sweepReverse = true;
            h.hit = false;
          } else {
            if (h.ultimate) e._harborFollowup = true;
            h.phase = 'recovery';
            h.t = 0;
            h.duration = isRainPort ? .82 : 1.35;
          }
        }
      } else if (h.kind === 'rainVortex') {
        // 雨夜渦流/水柱：預警後多水柱交錯落下
        const u = Math.min(1, h.t / h.duration);

        // 從 active 22% 起按水柱序號錯峰落下；每根各自有進度，單幀最多判一次命中。
        const vortices = h.vortexes || [];
        // The prior five-spout sequence gave each pillar only ~0.13s at
        // 60 FPS (often just 2 frames on 20 FPS), so it looked like a tiny
        // blink. Let adjacent pillars overlap while preserving one hit per
        // vortex, its original radius, and the 1.02s overall active phase.
        const windowSize = 0.28;
        const launchSpacing = 0.52 / Math.max(1, vortices.length - 1);
        for (let i = 0; i < vortices.length; i++) {
          const v = vortices[i];
          const activation = 0.18 + i * launchSpacing;
          v.fallProgress = Math.max(0, Math.min(1, (u - activation) / windowSize));
          // 與水柱 renderer 的可見期間一致；落下前及消退後都不能傷人。
          if (!(v.fallProgress > 0 && v.fallProgress < 1) || v.hit || hit) continue;
          if (dist(p, v) <= v.r + 20) {
            v.hit = true;
            hit = { damage: 16, kind: 'rainVortex', x: v.x, y: v.y };
          }
        }

        if (h.t >= h.duration) {
          h.phase = 'recovery';
          h.t = 0;
          h.duration = isRainPort ? .82 : 1.35;
        }
      }

      return { hit, started, finished: false };
    }

    if (h.phase === 'recovery') {
      e.slamT = 0;
      e.slamRecoverT = Math.max(0, h.duration - h.t);
      if (h.t >= h.duration) {
        delete e.hazard;
        e.attackCd = isRainPort
          ? (e._harborFollowup ? .35 : e.final ? 1.25 : 1.85) : 3.5;
        e.slamT = 0;
        e.slamRecoverT = 0;
        finished = true;
      }
      return { hit: null, started, finished };
    }

    return { hit: null, started, finished: false };
  }

  const api = {
    start,
    step,
    footwork
  };

  root.BOSS_AI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
