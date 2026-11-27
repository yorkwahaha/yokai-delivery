// Kyoto's temporary rally applies only to enemies already in the encounter.
window.KYOTO_PROCESSION = (() => {
  const cues = Object.freeze({
    warning: "assets/audio/sfx/enemies/kyoto-bell-runner/kyoto-bell-runner__warning.mp3",
    rally: "assets/audio/sfx/enemies/kyoto-bell-runner/kyoto-bell-runner__rally.mp3",
    crossingWarning: "assets/audio/sfx/enemies/kyoto-procession-marshal/kyoto-procession-marshal__crossing-warning.mp3",
    crossingImpact: "assets/audio/sfx/enemies/kyoto-procession-marshal/kyoto-procession-marshal__crossing-impact.mp3"
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const eligible = e => e.hp > 0 && !e.dying && !e.shield && !e.revealT &&
    !(e.confusedT > 0) && !(e.freezeT > 0);

  // Initial candidate multi-boss stagger gap (seconds); driven strictly by shared per-run combat clock.
  const STAGGER_GAP = 0.75;
  const IMPACT_SEPARATION = 0.35;

  function destinationPool(houses, from, busy) {
    const walk = h => Math.abs(h.x - from.x) + Math.abs(h.y - from.y);
    const open = houses.filter(h => h.id !== from.id && !busy.has(h.id));
    const sameStreet = open.filter(h => h.chunkKey === from.chunkKey && walk(h) >= 360);
    if (sameStreet.length) return sameStreet;
    return open.filter(h => walk(h) >= 360 && walk(h) <= 1450);
  }

  function step(e, player, enemies, dt, diverted) {
    if (!(dt > 0) || !e.processionLeader) return null;
    if (!eligible(e) || diverted?.(e)) { e.kyotoWarning = 0; return null; }
    e.kyotoSignalCd = Math.max(0, (e.kyotoSignalCd || 0) - dt);
    if (!(e.kyotoWarning > 0)) {
      if (e.kyotoSignalCd > 0 || distance(e, player) > 300) return null;
      e.kyotoWarning = .8;
      e.kyotoSignalCd = 5;
      return "warning";
    }
    e.kyotoWarning = Math.max(0, e.kyotoWarning - dt);
    if (e.kyotoWarning > 0) return null;
    e.attackT = .24;
    let rallied = 0;
    for (const ally of enemies) {
      if (ally === e || ally.type === "boss" || ally.type === "mis" || !eligible(ally) ||
          ally.kyotoRally > 0 || distance(ally, e) > 165 || diverted?.(ally)) continue;
      ally.kyotoRally = 1.6;
      if (++rallied === 2) break;
    }
    return rallied ? "rally" : null;
  }

  function zoneHit(z, player) {
    return z.round
      ? Math.hypot(z.x - player.x, z.y - player.y) <= z.rx && Math.hypot(z.x - player.x, z.y - player.y) >= (z.inner || 0)
      : Math.abs(z.x - player.x) <= z.rx && Math.abs(z.y - player.y) <= z.ry;
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

  const isKyoto = (e, options) => !!e && (e.stageId || options.stageId) === "hyakki-kyoto";
  function startBoss(e, player, options = {}) {
    const index = e.kyotoCrossings || 0;
    const vertical = index % 2 === 1;
    const x = player.x, y = player.y;
    const bossId = e.trialBoss?.id || "";
    const halfHp = e.hp <= (e.max || 1) * .5;
    let lanes;
    let chainPointShock = false;

    if (e.final) {
      // W4 酒吞（序列攻擊）：橫/直封街；半血橫街→直街→追擊點震
      lanes = [{ x, y, rx: vertical ? 34 : 150, ry: vertical ? 150 : 34, warning: 1.10, damage: 15 }];
      if (halfHp) {
        const offset = index % 4 < 2 ? 82 : -82;
        lanes.push({
          x: x + (vertical ? 0 : offset), y: y + (vertical ? offset : 0),
          rx: vertical ? 145 : 34, ry: vertical ? 34 : 145, warning: 0.90, damage: 17
        });
        if (bossId === "kyoto-procession-marshal") chainPointShock = true;
      }
    } else if (e.gatekeeper) {
      // W3 守門門將（同步多區攻擊）：十字街口同時封鎖，四角為安全逃生區
      lanes = [{
        x, y, rx: 150, ry: 150, sync: true, warning: 1.12, damage: 16,
        zones: [
          { x, y, rx: 150, ry: 34 },
          { x, y, rx: 34, ry: 150 }
        ]
      }];
    } else if (bossId === "kyoto-brocade-puppeteer") {
      // W2 錦幡伶（同步多區攻擊）：雙平行夾道同時預警與爆發（一道壓站位、一道平列 +116px，中留 60px 安全走廊）
      const span = 148, thick = 28, shift = 116;
      lanes = [{
        x, y, rx: vertical ? thick : span, ry: vertical ? span : thick,
        sync: true, warning: 1.08, damage: 15,
        zones: vertical
          ? [{ x, y, rx: thick, ry: span }, { x: x + shift, y, rx: thick, ry: span }]
          : [{ x, y, rx: span, ry: thick }, { x, y: y + shift, rx: span, ry: thick }]
      }];
    } else if (bossId === "kyoto-taiko-warden") {
      // W1 太鼓門將（序列攻擊）：雙拍連震（第二拍沿玩家方向前移 72px）
      const dx = x - (e.x || 0), dy = y - (e.y || 0);
      const len = Math.hypot(dx, dy) || 1;
      const shiftX = vertical ? Math.sign(dx || 1) * 72 : (dx / len) * 72;
      const shiftY = vertical ? (dy / len) * 72 : Math.sign(dy || 1) * 72;
      lanes = [
        { x, y, rx: vertical ? 34 : 150, ry: vertical ? 150 : 34, warning: 1.08, damage: 15 },
        { x: x + shiftX, y: y + shiftY, rx: vertical ? 34 : 150, ry: vertical ? 150 : 34, warning: 0.80, damage: 15 }
      ];
    } else {
      lanes = [{ x, y, rx: vertical ? 34 : 150, ry: vertical ? 150 : 34, warning: 1.10, damage: 15 }];
    }

    e.kyotoCrossings = index + 1;
    recordTelegraph(options);
    e.hazard = {
      kind: "kyotoCrossing", lanes, index: 0, x: lanes[0].x, y: lanes[0].y,
      phase: "telegraph", remaining: lanes[0].warning || 1.10, hit: false,
      chainPointShock
    };
    return e.hazard;
  }

  function stepBoss(e, player, dt, options = {}) {
    const result = { hit: null, started: false, finished: false, cue: null };
    if (!eligible(e) || e.done) {
      if (e.shield || e.hp <= 0 || e.dying || e.done) delete e.hazard;
      return result;
    }
    if (options.paused || !(dt > 0)) return result;
    const crossing = e.hazard;
    if (!crossing) {
      e.attackCd = Math.max(0, (e.attackCd || 0) - dt);
      if (e.attackCd === 0 && distance(e, player) < 340) {
        const st = options.stagger;
        const now = options.now;
        if (st && Number.isFinite(now)) {
          const sinceTel = now - (st.lastTelegraphAt ?? -99);
          if (sinceTel < STAGGER_GAP) {
            e.attackCd = Math.min(0.42, Math.max(0.15, STAGGER_GAP - sinceTel));
            return result;
          }
        }
        startBoss(e, player, options);
        result.started = true;
        result.cue = "crossingWarning";
      }
      return result;
    }
    crossing.remaining -= dt;
    const lane = crossing.lanes[crossing.index];
    if (crossing.phase === "telegraph") {
      if (crossing.remaining <= 0) {
        const delay = impactDelayRemaining(options);
        if (delay > 0) {
          crossing.remaining = delay;
          return result;
        }
        recordActualActive(options);
        crossing.phase = "active";
        crossing.remaining = .32;
        result.cue = "crossingImpact";
      }
    } else if (crossing.phase === "active") {
      const subZones = lane.zones || [lane];
      const inside = subZones.some(z => zoneHit(z, player));
      if (!crossing.hit && inside) {
        crossing.hit = true;
        result.hit = { kind: crossing.kind, damage: lane.damage ?? (crossing.index === 0 ? 15 : 17), x: lane.x, y: lane.y };
      }
      if (crossing.remaining <= 0) { crossing.phase = "recovery"; crossing.remaining = .50; }
    } else if (crossing.remaining <= 0) {
      if (crossing.index + 1 >= crossing.lanes.length && crossing.chainPointShock) {
        crossing.chainPointShock = false;
        crossing.lanes.push({ x: player.x, y: player.y, rx: 86, ry: 86, round: true, warning: 0.85, damage: 17 });
      }
      const next = crossing.lanes[crossing.index + 1];
      if (next) {
        crossing.index++;
        recordTelegraph(options);
        Object.assign(crossing, { x: next.x, y: next.y, phase: "telegraph", remaining: next.warning || .90, hit: false });
        result.cue = "crossingWarning";
      } else {
        delete e.hazard;
        e.attackCd = 1.45;
        result.finished = true;
      }
    }
    return result;
  }

  return Object.freeze({ destinationPool, step, isKyoto, startBoss, stepBoss, cues, STAGGER_GAP, IMPACT_SEPARATION });
})();
