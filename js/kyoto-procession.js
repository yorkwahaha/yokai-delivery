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
    let rallied = 0;
    for (const ally of enemies) {
      if (ally === e || ally.type === "boss" || ally.type === "mis" || !eligible(ally) ||
          ally.kyotoRally > 0 || distance(ally, e) > 165 || diverted?.(ally)) continue;
      ally.kyotoRally = 1.6;
      if (++rallied === 2) break;
    }
    return rallied ? "rally" : null;
  }

  const isKyoto = (e, options) => !!e && (e.stageId || options.stageId) === "hyakki-kyoto";
  function startBoss(e, player) {
    const index = e.kyotoCrossings || 0;
    const vertical = index % 2 === 1;
    const x = player.x, y = player.y;
    const lanes = [{ x, y, rx: vertical ? 34 : 150, ry: vertical ? 150 : 34 }];
    if (e.final && e.hp <= e.max * .5) {
      const offset = index % 4 < 2 ? 82 : -82;
      lanes.push({ x: x + (vertical ? 0 : offset), y: y + (vertical ? offset : 0),
        rx: vertical ? 145 : 34, ry: vertical ? 34 : 145 });
    }
    e.kyotoCrossings = index + 1;
    e.hazard = { kind: "kyotoCrossing", lanes, index: 0, x, y,
      phase: "telegraph", remaining: 1.10, hit: false };
    return e.hazard;
  }

  function stepBoss(e, player, dt, options) {
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
        startBoss(e, player);
        result.started = true;
        result.cue = "crossingWarning";
      }
      return result;
    }
    crossing.remaining -= dt;
    const lane = crossing.lanes[crossing.index];
    if (crossing.phase === "telegraph") {
      if (crossing.remaining <= 0) {
        crossing.phase = "active";
        crossing.remaining = .32;
        result.cue = "crossingImpact";
      }
    } else if (crossing.phase === "active") {
      if (!crossing.hit && Math.abs(lane.x - player.x) <= lane.rx && Math.abs(lane.y - player.y) <= lane.ry) {
        crossing.hit = true;
        result.hit = { kind: crossing.kind, damage: crossing.index === 0 ? 15 : 17, x: lane.x, y: lane.y };
      }
      if (crossing.remaining <= 0) { crossing.phase = "recovery"; crossing.remaining = .50; }
    } else if (crossing.remaining <= 0) {
      const next = crossing.lanes[crossing.index + 1];
      if (next) {
        crossing.index++;
        Object.assign(crossing, { x: next.x, y: next.y, phase: "telegraph", remaining: .90, hit: false });
        result.cue = "crossingWarning";
      } else {
        delete e.hazard;
        e.attackCd = 1.45;
        result.finished = true;
      }
    }
    return result;
  }

  return Object.freeze({ destinationPool, step, isKyoto, startBoss, stepBoss, cues });
})();
