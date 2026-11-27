window.SNOW_TEMPLE_COMBAT = (() => {
  const attacks = {
    "frost-bell": { radius: 98, warning: 1.06, damage: 15 },
    "ice-gale": { reach: 174, halfWidth: 38, warning: 1.14, damage: 16 },
    "blizzard-claws": { radius: 116, warning: 1.19, damage: 18 }
  };
  const STAGGER_GAP = 0.75;
  const IMPACT_SEPARATION = 0.35;

  const isSnowTemple = (enemy, options) =>
    !!enemy && (enemy.stageId || options.stageId) === "snow-temple";

  function clampLead(vx, vy, maxLead = 84) {
    const mag = Math.hypot(vx, vy);
    if (!(mag > 1)) return { x: 0, y: 0 };
    const scale = Math.min(maxLead, mag * 0.45) / mag;
    return { x: vx * scale, y: vy * scale };
  }

  function zoneHit(z, player) {
    const dx = Math.abs(z.x - player.x), dy = Math.abs(z.y - player.y);
    if (z.round) {
      const dist = Math.hypot(dx, dy);
      return dist <= z.rx && dist >= (z.inner || 0);
    }
    return dx <= z.rx && dy <= z.ry;
  }

  function recordTelegraph(options) {
    const st = options?.stagger;
    const now = options?.now;
    if (st && Number.isFinite(now)) {
      st.lastTelegraphAt = now;
    }
  }

  function impactDelayRemaining(options) {
    const st = options?.stagger;
    const now = options?.now;
    if (!st || !Number.isFinite(now)) return 0;
    const sinceActive = now - (st.lastActiveAt ?? -99);
    return sinceActive < IMPACT_SEPARATION ? Math.max(0.01, IMPACT_SEPARATION - sinceActive) : 0;
  }

  function recordActualActive(options) {
    const st = options?.stagger;
    const now = options?.now;
    if (st && Number.isFinite(now)) {
      st.lastActiveAt = now;
    }
  }

  function start(enemy, player, options = {}) {
    const attack = enemy.trialBoss?.attack || "frost-bell";
    const spec = attacks[attack];
    const beat = enemy.snowSpells || 0;
    enemy.snowSpells = beat + 1;
    const vertical = beat % 2 === 1;
    const x = player.x, y = player.y;
    const halfHp = enemy.hp <= (enemy.max || 1) * .5;
    let lanes;
    let chainThirdClaw = false;

    if (attack === "frost-bell" && enemy.gatekeeper) {
      // W3 守門霜鐘（序列攻擊）：連續三道冰柱破土
      const dx = x - (enemy.x || 0), dy = y - (enemy.y || 0);
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      lanes = [
        { x, y, rx: 78, ry: 78, round: true, warning: 0.98, damage: 15 },
        { x: x + ux * 92, y: y + uy * 92, rx: 76, ry: 76, round: true, warning: 0.74, damage: 15 },
        { x: x + ux * 184, y: y + uy * 184, rx: 74, ry: 74, round: true, warning: 0.74, damage: 16 }
      ];
    } else if (attack === "frost-bell") {
      // W1 霜鐘石將（序列攻擊）：內爆接外環擴散震波
      lanes = [
        { x, y, rx: 90, ry: 90, round: true, warning: spec.warning, damage: spec.damage },
        { x, y, rx: 168, ry: 168, inner: 82, round: true, warning: 0.84, damage: 16 }
      ];
    } else if (attack === "ice-gale") {
      // W2 雪衣姬：有限移動方向預判冰風（上限 84px，保持橫向可閃）
      const lead = clampLead(enemy._lastPVx || 0, enemy._lastPVy || 0, 84);
      lanes = [{
        x: x + lead.x, y: y + lead.y,
        rx: vertical ? spec.halfWidth : spec.reach,
        ry: vertical ? spec.reach : spec.halfWidth,
        warning: spec.warning, damage: spec.damage
      }];
    } else {
      // W4 雪嶺獅王（序列攻擊）：半血起手雙圈後動態追加第 3 步追擊爪印
      lanes = [{ x, y, rx: spec.radius, ry: spec.radius, round: true, warning: spec.warning, damage: spec.damage }];
      if (halfHp) {
        const sign = beat % 4 >= 2 ? -1 : 1;
        lanes.push({
          x: x + (vertical ? 0 : sign * 148), y: y + (vertical ? sign * 148 : 0),
          rx: 96, ry: 96, round: true, warning: 0.91, damage: 18
        });
        chainThirdClaw = true;
      }
    }

    recordTelegraph(options);
    const hazard = {
      kind: "snowTemple", attack, lanes, index: 0, x: lanes[0].x, y: lanes[0].y,
      phase: "telegraph", remaining: lanes[0].warning || spec.warning, hit: false,
      chainThirdClaw
    };
    enemy.hazard = hazard;
    return hazard;
  }

  function step(enemy, player, dt, options = {}) {
    const result = { hit: null, started: false, finished: false };
    if (enemy.hp <= 0 || enemy.dying || enemy.shield || enemy.done) {
      delete enemy.hazard;
      return result;
    }
    if (options.paused || enemy.revealT > 0 || enemy.freezeT > 0 || !(dt > 0)) return result;
    if (Number.isFinite(enemy._prevPX) && Number.isFinite(enemy._prevPY)) {
      enemy._lastPVx = (player.x - enemy._prevPX) / dt;
      enemy._lastPVy = (player.y - enemy._prevPY) / dt;
    }
    enemy._prevPX = player.x;
    enemy._prevPY = player.y;

    const h = enemy.hazard;
    if (!h) {
      enemy.attackCd = Math.max(0, (enemy.attackCd || 0) - dt);
      if (enemy.attackCd === 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 356) {
        const st = options.stagger;
        const now = options.now;
        if (st && Number.isFinite(now)) {
          const sinceTel = now - (st.lastTelegraphAt ?? -99);
          if (sinceTel < STAGGER_GAP) {
            enemy.attackCd = Math.min(0.42, Math.max(0.15, STAGGER_GAP - sinceTel));
            return result;
          }
        }
        start(enemy, player, options);
        result.started = true;
      }
      return result;
    }
    const zone = h.lanes[h.index];
    h.remaining -= dt;
    if (h.phase === "telegraph") {
      if (h.remaining <= 0) {
        const delay = impactDelayRemaining(options);
        if (delay > 0) {
          h.remaining = delay;
          return result;
        }
        recordActualActive(options);
        Object.assign(h, { phase: "active", remaining: .32 });
      }
    } else if (h.phase === "active") {
      const subZones = zone.zones || [zone];
      const inside = subZones.some(z => zoneHit(z, player));
      if (!h.hit && inside) {
        h.hit = true;
        result.hit = { kind: h.kind, damage: zone.damage ?? attacks[h.attack].damage, x: zone.x, y: zone.y };
      }
      if (h.remaining <= 0) Object.assign(h, { phase: "recovery", remaining: .50 });
    } else if (h.remaining <= 0) {
      if (h.index + 1 >= h.lanes.length && h.chainThirdClaw) {
        h.chainThirdClaw = false;
        h.lanes.push({ x: player.x, y: player.y, rx: 84, ry: 84, round: true, warning: 0.84, damage: 18 });
      }
      const next = h.lanes[h.index + 1];
      if (next) {
        h.index++;
        recordTelegraph(options);
        Object.assign(h, { x: next.x, y: next.y, phase: "telegraph", remaining: next.warning || .91, hit: false });
      } else {
        delete enemy.hazard;
        enemy.attackCd = 1.42;
        result.finished = true;
      }
    }
    return result;
  }

  return Object.freeze({ isSnowTemple, start, step, STAGGER_GAP, IMPACT_SEPARATION });
})();
