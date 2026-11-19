// Bamboo Maze combat state lives on each enemy so a fresh run has no timers
// or hit flags from the previous wave.
window.BAMBOO_COMBAT = (() => {
  const isBamboo = (e, options) => !!e && (e.stageId || options.stageId) === "bamboo-maze";
  const cueFiles = Object.freeze({
    bambooCutWarn: "assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__cut-warning.mp3",
    bambooCutImpact: "assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__cut-impact.mp3",
    bambooShootsWarn: "assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__shoots-warning.mp3",
    bambooShootsImpact: "assets/audio/sfx/enemies/bamboo-warden/bamboo-warden__shoots-impact.mp3"
  });
  function mobMotion(mob, aim, dt, speed, blocked) {
    let rush = mob.bambooRush;
    if (rush && rush.target !== aim) { delete mob.bambooRush; rush = null; }
    if (!rush) {
      mob.bambooRushCd = Math.max(0, (mob.bambooRushCd || 0) - dt);
      const d = Math.hypot(aim.x - mob.x, aim.y - mob.y);
      if (d < 78 || d > 210 || mob.bambooRushCd > 0 || speed <= 0) return { aim, speed };
      const dx = (aim.x - mob.x) / d, dy = (aim.y - mob.y) / d;
      let reach = 0;
      while (reach < 176 && !blocked?.(mob.x + dx * (reach + 8), mob.y + dy * (reach + 8), 16)) reach += 8;
      if (reach < 48) return { aim, speed };
      mob.bambooRush = { target: aim, point: { x: mob.x + dx * reach, y: mob.y + dy * reach },
        phase: "telegraph", remaining: .68 };
      mob.bambooRushCd = 2.8;
      return { aim, speed: 0 };
    }
    rush.remaining -= dt;
    if (rush.phase === "recovery") {
      mob.bambooRushCd = Math.max(0, mob.bambooRushCd - dt);
      if (rush.remaining <= 0) delete mob.bambooRush;
      return { aim, speed };
    }
    if (rush.phase === "telegraph") {
      if (rush.remaining <= 0) { rush.phase = "active"; rush.remaining = .46; }
      return { aim, speed: 0 };
    }
    if (rush.remaining <= 0 || Math.hypot(rush.point.x - mob.x, rush.point.y - mob.y) < 12) {
      rush.phase = "recovery"; rush.remaining = .24;
      return { aim, speed };
    }
    return { aim: rush.point, speed: Math.min(speed * 2.35, 190), rush: true };
  }

  const SHOOTS_STRIKES = 5;

  function markShoots(hazard, player) {
    hazard.strike++;
    hazard.x = player.x;
    hazard.y = player.y;
    hazard.zones = [{ x: player.x, y: player.y, rx: hazard.radius, ry: hazard.radius }];
    hazard.phase = "telegraph";
    hazard.remaining = .34;
    hazard.hit = false;
  }

  function start(e, player) {
    const step = e.bambooAttack || 0;
    const attacks = e.trialBoss?.attacks;
    const cut = attacks ? attacks[step % attacks.length] === "bambooCut" : step % 2 === 0;
    const intense = e.final && e.hp <= e.max * .5;
    const kind = cut ? "bambooCut" : "bambooShoots";
    const hazard = { kind, x: player.x, y: player.y, phase: "telegraph", remaining: 1.05, hit: false };
    if (cut) {
      const vertical = Math.abs(player.x - e.x) < Math.abs(player.y - e.y);
      const zone = (x, y, rx, ry) => ({ x, y, rx, ry });
      hazard.zones = [zone(player.x, player.y, vertical ? 36 : 145, vertical ? 145 : 36)];
      if (intense) {
        const side = (e.bambooAttack || 0) % 4 === 0 ? 1 : -1;
        hazard.zones.push(zone(player.x + (vertical ? 105 * side : 0),
          player.y + (vertical ? 0 : 105 * side), vertical ? 30 : 115, vertical ? 115 : 30));
      }
    } else {
      hazard.strike = 0;
      hazard.radius = intense ? 58 : 50;
      markShoots(hazard, player);
    }
    e.hazard = hazard;
    e.bambooAttack = step + 1;
    return e.hazard;
  }

  function step(e, player, dt, options = {}) {
    const result = { hit: null, started: false, finished: false };
    if (e.shield || e.dying || e.done || e.hp <= 0) { delete e.hazard; return result; }
    if (options.paused || !(dt > 0)) return result;
    const h = e.hazard;
    if (!h) {
      e.attackCd = Math.max(0, (e.attackCd || 0) - dt);
      if (e.attackCd === 0 && Math.hypot(player.x - e.x, player.y - e.y) < 320) {
        start(e, player);
        result.started = true;
      }
      return result;
    }
    h.remaining -= dt;
    if (h.phase === "telegraph") {
      if (h.remaining <= 0) { h.phase = "active"; h.remaining = h.kind === "bambooShoots" ? .22 : .28; }
    } else if (h.phase === "active") {
      if (!h.hit && h.zones.some(z => h.kind === "bambooCut"
        ? Math.abs(player.x - z.x) <= z.rx && Math.abs(player.y - z.y) <= z.ry
        : Math.hypot(player.x - z.x, player.y - z.y) <= z.rx)) {
        h.hit = true;
        result.hit = { kind: h.kind, damage: h.kind === "bambooCut" ? 16 : 18, x: player.x, y: player.y };
      }
      if (h.remaining <= 0) {
        if (h.kind === "bambooShoots" && h.strike < SHOOTS_STRIKES) {
          markShoots(h, player);
          result.started = true;
        } else {
          h.phase = "recovery";
          h.remaining = .72;
        }
      }
    } else if (h.remaining <= 0) {
      delete e.hazard;
      e.attackCd = e.final ? 1.1 : 1.75;
      result.finished = true;
    }
    return result;
  }

  return Object.freeze({ isBamboo, mobMotion, start, step, cueFiles });
})();
