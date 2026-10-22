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
    // 優先從 STAGE_ENEMY.bossTheme 取得，其次從 e.bossTheme（相容舊碼）
    const stageEnemy = window.STAGE_ENEMY;
    return (stageEnemy && stageEnemy.bossTheme) || e.bossTheme || 'town';
  }

  function getAttackPool(e) {
    const theme = getBossTheme(e);
    const pool = BOSS_THEME_POOLS[theme] || BOSS_THEME_POOLS.town;
    // 雨港專屬：以 stageId 判定，僅 rain-port 啟用 tidalFan/rainVortex
    const stageId = (window.STAGE && window.STAGE.id) || (e && e.stageId) || '';
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

  function start(e, player) {
    if (!e || (e.hp || 0) <= 0 || e.hazard || e.shield) return false;

    const kind = nextAttackKind(e);
    const p = player || { x: 0, y: 0 };
    const angle = Math.atan2(p.y - e.y, p.x - e.x);

    if (kind === 'charge') {
      e.hazard = {
        kind: 'charge',
        phase: 'telegraph',
        t: 0,
        duration: 1.0,
        x: e.x,
        y: e.y,
        angle,
        r: 52,
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
      started = start(e, p);
    }

    if (!e.hazard) {
      return { hit: null, started, finished: false };
    }

    const h = e.hazard;
    let hit = null;
    let finished = false;
    h.t += dt;

    if (h.phase === 'telegraph') {
      e.slamT = Math.max(0, h.duration - h.t);
      e.slamRecoverT = 0;
      if (h.t >= h.duration) {
        h.phase = 'active';
        h.t = 0;
        if (h.kind === 'charge') h.duration = 0.65;
        else if (h.kind === 'ring') { h.duration = 0.7; h.r = 80; h.prevR = 80; }
        else if (h.kind === 'tide') { h.duration = 1.0; h.progress = -280; }
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
        const totalTravel = 620 * dt;
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
        }

        if (!h.hit && dist(e, p) <= h.r) {
          h.hit = true;
          hit = { damage: 18, kind: 'charge', x: e.x, y: e.y };
        }

        if (wallHit || h.t >= h.duration) {
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
        const angleDiff = Math.abs(normalizeAngle(angleToPlayer - sweepAngle));

        if (distToCenter <= fanR + 30 && angleDiff <= Math.PI / 12 && !h.hit) {
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

        if (u < 0.5) {
          // 預警階段：只顯示落點標記
        } else {
          // 落下階段：水柱逐個激活
          const fallProgress = (u - 0.5) * 2;
          for (const v of h.vortexes) {
            const vDist = dist(p, v);
            if (vDist <= v.r + 20 && !v.hit) {
              v.hit = true;
              hit = { damage: 16, kind: 'rainVortex', x: v.x, y: v.y };
            }
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
