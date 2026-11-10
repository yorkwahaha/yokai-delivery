// 妖怪快遞社：獨立首領攻擊狀態機（V3 Boss AI 控制器）
// 負責首領蓄勢預告、直線衝撞、缺口衝擊環與潮汐安全帶之鎖位與碰撞判定。
(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalizeAngle(a) {
    let ang = a % (Math.PI * 2);
    if (ang > Math.PI) ang -= Math.PI * 2;
    if (ang < -Math.PI) ang += Math.PI * 2;
    return ang;
  }

  // 各 bossTheme 對應的攻擊招式池（資料導向，不硬編碼 stageId）
  // slam/charge/ring/tide 為既有四大模板，未核准新招式不加入
  const BOSS_THEME_POOLS = Object.freeze({
    town:   Object.freeze({ base: ['slam', 'charge'], halfHp: ['slam', 'charge', 'ring'] }),
    harbor: Object.freeze({ base: ['slam', 'charge', 'tide'], halfHp: ['slam', 'charge', 'ring', 'tide'] }),
    // rain-port 專屬：潮汐扇形/水平岸浪、雨夜渦流/水柱
    "rain-port": Object.freeze({
      base: ['slam', 'charge', 'tide', 'tidalFan', 'rainVortex'],
      halfHp: ['slam', 'charge', 'tide', 'tidalFan', 'rainVortex']
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
    const pool = getAttackPool(e);
    const step = e._attackStep || 0;
    e._attackStep = step + 1;
    return pool[step % pool.length];
  }

  function start(e, player, options = {}) {
    if (!e || (e.hp || 0) <= 0 || e.hazard || e.shield) return false;

    const kind = nextAttackKind(e);
    const p = player || { x: 0, y: 0 };
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
      if (options.stageId === 'night-town' && typeof options.blocked === 'function') {
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
        gapAngle: angle + Math.PI / 2,
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
      // 潮汐扇形/水平岸浪掃擊：預警扇形，隨後水平掃過
      e.hazard = {
        kind: 'tidalFan',
        phase: 'telegraph',
        t: 0,
        duration: 0.9,  // 0.6-1秒醒目預警
        x: e.x,
        y: e.y,
        angle,
        startAngle: angle - Math.PI / 3,  // 60度扇形
        endAngle: angle + Math.PI / 3,
        r: 200,
        hit: false
      };
    } else if (kind === 'rainVortex') {
      // 雨夜渦流/水柱警示落點：多個水柱落點預警，交錯落下
      const vortexCount = 3 + (e.bossIndex === 3 ? 2 : 0); // final 多2個
      const vortexes = [];
      for (let i = 0; i < vortexCount; i++) {
        const offsetAngle = (Math.random() - 0.5) * Math.PI * 0.6;
        const offsetDist = 80 + Math.random() * 120;
        vortexes.push({
          x: e.x + Math.cos(angle + offsetAngle) * offsetDist,
          y: e.y + Math.sin(angle + offsetAngle) * offsetDist,
          angle: 0,
          r: 28,
          hit: false
        });
      }
      e.hazard = {
        kind: 'rainVortex',
        phase: 'telegraph',
        t: 0,
        duration: 1.0,  // 預警 1 秒
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
    if (!e.hazard && (e.attackCd || 0) <= 0 && dist(e, p) < 340) {
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

    if (h.phase === 'telegraph') {
      e.slamT = Math.max(0, h.duration - h.t);
      e.slamRecoverT = 0;
      if (h.t >= h.duration) {
        h.phase = 'active';
        h.t = 0;
        if (h.kind === 'charge') h.duration = options.stageId === 'night-town' ? 0.70 : 0.65;
        else if (h.kind === 'ring') { h.duration = 0.7; h.r = 80; h.prevR = 80; }
        else if (h.kind === 'tide') { h.duration = 1.0; h.progress = -280; }
        else if (h.kind === 'rainVortex') { h.duration = 0.90; }
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
          h.duration = 1.35;
        }
      } else if (h.kind === 'tidalFan') {
        // 潮汐扇形/水平岸浪掃擊：預警後水平掃過
        const u = Math.min(1, h.t / h.duration);
        const sweepAngle = h.startAngle + (h.endAngle - h.startAngle) * u;
        const fanR = h.r;

        const dx = p.x - h.x, dy = p.y - h.y;
        const distToCenter = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);
        // 前幀到本幀掃過的整段扇面都需要判定，否則低 FPS 可直接跳過玩家。
        const prevU = Math.min(1, previousT / h.duration);
        const prevAngle = h.startAngle + (h.endAngle - h.startAngle) * prevU;
        const travel = normalizeAngle(sweepAngle - prevAngle);
        const relative = normalizeAngle(angleToPlayer - prevAngle);
        const halfWidth = Math.PI / 12;
        const inSweptFan = travel >= 0
          ? relative >= -halfWidth && relative <= travel + halfWidth
          : relative <= halfWidth && relative >= travel - halfWidth;
        // 掃掠厚度不可超出 renderer 裁切的整體預警扇面。
        const centerAngle = (h.startAngle + h.endAngle) / 2;
        const inFan = Math.abs(normalizeAngle(angleToPlayer - centerAngle))
          <= Math.abs(h.endAngle - h.startAngle) / 2 + 1e-9;

        if (distToCenter <= fanR + 30 && inFan && inSweptFan && !h.hit) {
          h.hit = true;
          hit = { damage: 18, kind: 'tidalFan', x: p.x, y: p.y };
        }

        if (h.t >= h.duration) {
          h.phase = 'recovery';
          h.t = 0;
          h.duration = 1.35;
        }
      } else if (h.kind === 'rainVortex') {
        // 雨夜渦流/水柱：預警後多水柱交錯落下
        const u = Math.min(1, h.t / h.duration);

        // 後半段按水柱序號錯峰落下；每根各自有進度，單幀最多判一次命中。
        const vortices = h.vortexes || [];
        const windowSize = 0.5 / Math.max(1, vortices.length);
        for (let i = 0; i < vortices.length; i++) {
          const v = vortices[i];
          const activation = 0.5 + i * windowSize;
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
          h.duration = 1.35;
        }
      }

      return { hit, started, finished: false };
    }

    if (h.phase === 'recovery') {
      e.slamT = 0;
      e.slamRecoverT = Math.max(0, h.duration - h.t);
      if (h.t >= h.duration) {
        delete e.hazard;
        e.attackCd = 3.5;
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
    step
  };

  root.BOSS_AI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
