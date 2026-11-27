window.LATE_STAGE_COMBAT = (() => {
  const attacks = {
    "soul-splash": { rx: 103, warning: 1.05, damage: 15, round: true },
    "spirit-tide": { rx: 218, ry: 39, warning: 1.15, damage: 16 },
    "oar-sweep": { rx: 194, ry: 46, warning: 1.12, damage: 18 },
    "cinder-burst": { rx: 108, warning: 1.07, damage: 15, round: true },
    "fault-line": { rx: 215, ry: 42, warning: 1.12, damage: 17 },
    eclipse: { rx: 154, inner: 71, warning: 1.34, damage: 18, round: true }
  };
  const STAGGER_GAP = 0.75;
  const IMPACT_SEPARATION = 0.35;
  const PLAYER_RADIUS = 16;

  const supports = (enemy, options) => {
    const stage = enemy?.stageId || options.stageId;
    return !!enemy && (stage === "spirit-ferry" || stage === "yomi");
  };

  function pathClear(x0, y0, x1, y1, blockedFn, radius = PLAYER_RADIUS) {
    if (typeof blockedFn !== "function") return true;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (blockedFn(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius)) return false;
    }
    return true;
  }

  // Terrain-fair eccentric ring center: verifies actual walkable inward/outward escape paths
  // with player collision radius; falls back to safe non-trap configuration if boxed in.
  function pickEccentricCenter(enemy, player, offsetDist, blockedFn, radius = PLAYER_RADIUS) {
    const baseAng = Math.atan2(player.y - (enemy.y || 0), player.x - (enemy.x || 0));
    const inner = attacks.eclipse.inner;
    const outer = attacks.eclipse.rx;
    const offsets = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI];
    let bestPartial = null;

    for (const delta of offsets) {
      const ang = baseAng + delta;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const cx = player.x + ux * offsetDist;
      const cy = player.y + uy * offsetDist;
      // Inward escape: verify core itself is clear AND player can walk safely inside inner core
      const inStep = Math.max(24, offsetDist - inner + radius + 8);
      const inTargetX = player.x + ux * inStep, inTargetY = player.y + uy * inStep;
      const coreClear = typeof blockedFn !== "function" || !blockedFn(cx, cy, radius);
      const inwardOk = coreClear && pathClear(player.x, player.y, inTargetX, inTargetY, blockedFn, radius);
      // Outward escape: walk from player away from center until safely outside outer edge
      const outStep = Math.max(24, outer - offsetDist + radius + 8);
      const outTargetX = player.x - ux * outStep, outTargetY = player.y - uy * outStep;
      const outwardOk = pathClear(player.x, player.y, outTargetX, outTargetY, blockedFn, radius);

      if (inwardOk && outwardOk) {
        return { x: cx, y: cy, inwardOk: true, outwardOk: true, fallback: false };
      }
      if ((inwardOk || outwardOk) && !bestPartial) {
        bestPartial = { x: cx, y: cy, inwardOk, outwardOk, fallback: false };
      }
    }
    if (bestPartial) return bestPartial;
    // All 8 ring placements boxed in by walls/rocks: use fair smaller non-ring burst fallback
    return { x: player.x, y: player.y, inwardOk: false, outwardOk: false, fallback: true };
  }

  // Verify whether a linear fault-line (horizontal or vertical) has a walkable perpendicular escape
  function findSafeFaultOrientation(player, blockedFn, preferVertical = false, halfThick = 36, radius = PLAYER_RADIUS) {
    const step = halfThick + radius + 8;
    const horizOk = pathClear(player.x, player.y, player.x, player.y - step, blockedFn, radius) ||
      pathClear(player.x, player.y, player.x, player.y + step, blockedFn, radius);
    const vertOk = pathClear(player.x, player.y, player.x - step, player.y, blockedFn, radius) ||
      pathClear(player.x, player.y, player.x + step, player.y, blockedFn, radius);
    if (preferVertical) {
      if (vertOk) return { swap: true, rx: halfThick, ry: 215 };
      if (horizOk) return { swap: false, rx: 215, ry: halfThick };
    } else {
      if (horizOk) return { swap: false, rx: 215, ry: halfThick };
      if (vertOk) return { swap: true, rx: halfThick, ry: 215 };
    }
    return null;
  }

  // Verify whether a shrinking ring at (cx, cy) has a walkable escape from the player's current position
  function ringHasWalkableEscape(cx, cy, outer, inner, player, blockedFn, radius = PLAYER_RADIUS) {
    if (typeof blockedFn !== "function") return true;
    const dx = player.x - cx, dy = player.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < inner - 4 || d > outer + 4) return true; // already in safe zone
    const ux = d > 1 ? dx / d : 1, uy = d > 1 ? dy / d : 0;
    const inDist = Math.max(20, d - inner + radius + 8);
    const outDist = Math.max(20, outer - d + radius + 8);
    const inwardOk = !blockedFn(cx, cy, radius) && pathClear(player.x, player.y, player.x - ux * inDist, player.y - uy * inDist, blockedFn, radius);
    const outwardOk = pathClear(player.x, player.y, player.x + ux * outDist, player.y + uy * outDist, blockedFn, radius);
    return inwardOk || outwardOk;
  }

  // Terrain-verified safe alternative when all 8 eccentric eclipse placements are blocked.
  // Returns a verified escapable lane spec, or null if no fair escape route exists (cast must defer/cancel).
  function findSafeEclipseAlternative(player, blockedFn, preferVertical = false, radius = PLAYER_RADIUS) {
    const fault = findSafeFaultOrientation(player, blockedFn, preferVertical, 36, radius);
    if (fault) {
      return { kind: "fault-line", swap: fault.swap, rx: fault.rx, ry: fault.ry, round: false, inner: 0, warning: 1.12, damage: 17 };
    }
    const compactR = 64;
    const escDist = compactR + radius + 8;
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      if (pathClear(player.x, player.y, player.x + Math.cos(ang) * escDist, player.y + Math.sin(ang) * escDist, blockedFn, radius)) {
        return { kind: "cinder-burst", rx: compactR, ry: compactR, round: true, inner: 0, warning: 1.12, damage: 15 };
      }
    }
    return null;
  }

  function zoneHit(z, player) {
    const dx = Math.abs(z.x - player.x), dy = Math.abs(z.y - player.y);
    if (z.round) {
      const d = Math.hypot(dx, dy);
      return d <= z.rx && d >= (z.inner || 0);
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
    const stage = enemy.stageId || options.stageId || "spirit-ferry";
    const attack = enemy.trialBoss?.attack || (stage === "yomi" ? "cinder-burst" : "soul-splash");
    const beat = enemy.lateCasts || 0;
    enemy.lateCasts = beat + 1;
    const { x, y } = player;
    const vertical = beat % 2 === 1 && attack !== "spirit-tide";
    const halfHp = enemy.hp <= (enemy.max || 1) * .5;
    const zone = (art, sx, sy, overrides = {}) => {
      const shape = attacks[art], w = overrides.rx ?? shape.rx, h = overrides.ry ?? shape.ry ?? w;
      const swap = !!overrides.swap;
      return {
        art, x: sx, y: sy,
        rx: swap ? h : w, ry: swap ? w : h,
        round: overrides.round ?? shape.round,
        inner: overrides.inner ?? shape.inner,
        damage: overrides.damage ?? shape.damage,
        warning: overrides.warning ?? shape.warning,
        ...(overrides.sync ? { sync: true } : {}),
        ...(overrides.zones ? { zones: overrides.zones } : {}),
        ...(overrides.mudSlow ? { mudSlow: overrides.mudSlow } : {}),
        ...(overrides.checkTerrain ? { checkTerrain: overrides.checkTerrain } : {}),
        ...(overrides.preferVertical != null ? { preferVertical: overrides.preferVertical } : {})
      };
    };

    const dx = x - (enemy.x || 0), dy = y - (enemy.y || 0);
    const distToP = Math.hypot(dx, dy) || 1;
    const ux = dx / distToP, uy = dy / distToP;
    let lanes;

    if (attack === "eclipse") {
      // P1-1 + Phase B.1 地形公平性：優先合法偏心赤月；失敗時只接受通過逃生驗證的替代招，完全無逃生路則取消本次施法
      const pick = pickEccentricCenter(enemy, player, 112, options.blocked, PLAYER_RADIUS);
      if (pick.fallback) {
        const alt = findSafeEclipseAlternative(player, options.blocked, beat % 2 === 0, PLAYER_RADIUS);
        if (!alt) {
          enemy.lateCasts = beat; // do not advance beat on deferred cast
          return null;
        }
        lanes = [zone(alt.kind, x, y, {
          rx: alt.rx, ry: alt.ry, round: alt.round, inner: alt.inner,
          warning: alt.warning, damage: alt.damage
        })];
      } else {
        lanes = [zone("eclipse", pick.x, pick.y)];
      }
      if (halfHp) {
        if (!pick.fallback && ringHasWalkableEscape(pick.x, pick.y, 134, 54, player, options.blocked, PLAYER_RADIUS)) {
          lanes.push(zone("eclipse", pick.x, pick.y, { rx: 134, inner: 54, warning: 0.98, damage: 18, checkTerrain: "ring" }));
        }
        const followFault = findSafeFaultOrientation(player, options.blocked, beat % 2 === 0, 36, PLAYER_RADIUS);
        if (followFault) {
          lanes.push(zone("fault-line", x, y, {
            rx: followFault.rx, ry: followFault.ry, warning: 1.06, checkTerrain: "fault", preferVertical: beat % 2 === 0
          }));
        }
      }
    } else if (attack === "soul-splash" && enemy.gatekeeper) {
      // S7 W3 沉鐘鬼將：大型沉鐘震波（附 2.5s 泥濘殘留減速）接外擴餘震環
      lanes = [
        zone("soul-splash", x, y, { rx: 130, ry: 130, warning: 1.16, damage: 17, mudSlow: { r: 122, duration: 2.5 } }),
        zone("soul-splash", x, y, { rx: 180, ry: 180, inner: 108, warning: 0.88, damage: 15 })
      ];
    } else if (attack === "soul-splash") {
      // S7 W1 靈河鎮岸獅（序列）：三點靈水柱
      lanes = [
        zone("soul-splash", x, y, { rx: 96, ry: 96, warning: 1.04, damage: 15 }),
        zone("soul-splash", x - 110, y, { rx: 82, ry: 82, warning: 0.76, damage: 15 }),
        zone("soul-splash", x + 110, y, { rx: 82, ry: 82, warning: 0.76, damage: 15 })
      ];
    } else if (attack === "spirit-tide") {
      // S7 W2 水鏡巫女（同步多區）：雙橫浪安全縫（第一道壓玩家站位，第二道平列 +122px，中留 54px 安全帶）
      const shift = 122, ry = 34;
      lanes = [zone("spirit-tide", x, y, {
        rx: 218, ry, sync: true, warning: 1.15, damage: 16,
        zones: [
          { x, y, rx: 218, ry },
          { x, y: y + shift, rx: 218, ry }
        ]
      })];
    } else if (attack === "oar-sweep") {
      // S7 W4 幽冥渡船使（序列）：長篙橫掃，半血接雙向浪潮
      lanes = [zone("oar-sweep", x, y, { swap: vertical })];
      if (halfHp) {
        const s = beat % 4 < 2 ? 1 : -1;
        lanes.push(zone("spirit-tide", x, y + s * 106, { warning: 1.02 }));
        lanes.push(zone("spirit-tide", x, y - s * 106, { warning: 0.92 }));
      }
    } else if (attack === "cinder-burst" && enemy.gatekeeper) {
      // S8 W3 玄巖墓蛇（序列）：四點依序破土追擊
      const stepDist = 86;
      lanes = [
        zone("cinder-burst", x, y, { rx: 82, ry: 82, warning: 0.96, damage: 15 }),
        zone("cinder-burst", x + ux * stepDist, y + uy * stepDist, { rx: 80, ry: 80, warning: 0.68, damage: 15 }),
        zone("cinder-burst", x + ux * stepDist * 2, y + uy * stepDist * 2, { rx: 78, ry: 78, warning: 0.68, damage: 15 }),
        zone("cinder-burst", x + ux * stepDist * 3, y + uy * stepDist * 3, { rx: 76, ry: 76, warning: 0.68, damage: 16 })
      ];
    } else if (attack === "cinder-burst") {
      // S8 W1 冥門骸武者：前向長條重斬
      const slashVert = Math.abs(dy) > Math.abs(dx);
      const slash = zone("cinder-burst", x, y, {
        round: false, rx: slashVert ? 48 : 184, ry: slashVert ? 184 : 48, warning: 1.04, damage: 16
      });
      slash.angle = slashVert ? (dy < 0 ? -Math.PI / 2 : Math.PI / 2) : (dx < 0 ? Math.PI : 0);
      lanes = [slash];
    } else if (attack === "fault-line") {
      // S8 W2 灰火祭姬（同步多區）：交叉雙裂線同時預警與爆發，四角為安全區
      lanes = [zone("fault-line", x, y, {
        rx: 215, ry: 215, sync: true, warning: 1.14, damage: 17,
        zones: [
          { x, y, rx: 215, ry: 36 },
          { x, y, rx: 36, ry: 215 }
        ]
      })];
    } else {
      lanes = [zone(attack, x, y, { swap: vertical })];
    }

    recordTelegraph(options);
    return enemy.hazard = {
      kind: "lateStage", attack, art: lanes[0].art, lanes, index: 0,
      x: lanes[0].x, y: lanes[0].y, phase: "telegraph", remaining: lanes[0].warning, hit: false
    };
  }

  function step(enemy, player, dt, options = {}) {
    const result = { hit: null, started: false, finished: false, mudZone: null, deferred: false };
    if (enemy.hp <= 0 || enemy.dying || enemy.shield || enemy.done) {
      delete enemy.hazard;
      return result;
    }
    if (options.paused || enemy.revealT > 0 || enemy.freezeT > 0 || !(dt > 0)) return result;

    const hazard = enemy.hazard;
    if (!hazard) {
      enemy.attackCd = Math.max(0, (enemy.attackCd || 0) - dt);
      if (!enemy.attackCd && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 356) {
        const st = options.stagger;
        const now = options.now;
        if (st && Number.isFinite(now)) {
          const sinceTel = now - (st.lastTelegraphAt ?? -99);
          if (sinceTel < STAGGER_GAP) {
            enemy.attackCd = Math.min(0.42, Math.max(0.15, STAGGER_GAP - sinceTel));
            return result;
          }
        }
        const created = start(enemy, player, options);
        if (!created) {
          // Boxed in with zero walkable escape route: defer cast rather than trapping player
          enemy.attackCd = 0.55;
          result.deferred = true;
          return result;
        }
        result.started = true;
      }
      return result;
    }
    const zone = hazard.lanes[hazard.index];
    hazard.remaining -= dt;
    if (hazard.phase === "telegraph") {
      if (hazard.remaining <= 0) {
        const delay = impactDelayRemaining(options);
        if (delay > 0) {
          hazard.remaining = delay;
          return result;
        }
        recordActualActive(options);
        Object.assign(hazard, { phase: "active", remaining: .32 });
        if (zone.mudSlow) {
          result.mudZone = { x: zone.x, y: zone.y, r: zone.mudSlow.r, life: zone.mudSlow.duration, maxLife: zone.mudSlow.duration };
        }
      }
    } else if (hazard.phase === "active") {
      const subZones = zone.zones || [zone];
      const inside = subZones.some(z => zoneHit(z, player));
      if (!hazard.hit && inside) {
        hazard.hit = true;
        result.hit = { kind: hazard.kind, damage: zone.damage, x: zone.x, y: zone.y };
      }
      if (hazard.remaining <= 0) Object.assign(hazard, { phase: "recovery", remaining: .54 });
    } else if (hazard.remaining <= 0) {
      let nextIdx = hazard.index + 1;
      let next = null;
      while (nextIdx < hazard.lanes.length) {
        const cand = hazard.lanes[nextIdx];
        if (cand.checkTerrain === "ring" && !ringHasWalkableEscape(cand.x, cand.y, cand.rx, cand.inner || 0, player, options.blocked, PLAYER_RADIUS)) {
          nextIdx++;
          continue;
        }
        if (cand.checkTerrain === "fault") {
          const orient = findSafeFaultOrientation(player, options.blocked, !!cand.preferVertical, 36, PLAYER_RADIUS);
          if (!orient) {
            nextIdx++;
            continue;
          }
          cand.x = player.x;
          cand.y = player.y;
          cand.rx = orient.rx;
          cand.ry = orient.ry;
        }
        next = cand;
        break;
      }
      if (next) {
        hazard.index = nextIdx;
        recordTelegraph(options);
        Object.assign(hazard, { x: next.x, y: next.y, art: next.art, phase: "telegraph", remaining: next.warning, hit: false });
      } else {
        delete enemy.hazard;
        enemy.attackCd = 1.45;
        result.finished = true;
      }
    }
    return result;
  }

  return Object.freeze({
    supports, start, step, pickEccentricCenter, findSafeEclipseAlternative,
    findSafeFaultOrientation, ringHasWalkableEscape, pathClear, STAGGER_GAP, IMPACT_SEPARATION
  });
})();
