// Phase 14: deterministic Boss blueprint and critical probability only.
// Combat random roll, damage application, and enemy state stay in game.js.
window.GAME_COMBAT_MATH = (() => {
  function bossBlueprint(index, bossHpBase, bossOilReward, stage) {
    const role = ["mid", "mid", "gate", "final"][index] || "mid";
    let hp = bossHpBase[index];
    if (stage && stage.id === "night-town" && typeof hp === "number") {
      // Third Boss has no quiz barrier; preserve 0.75 scaling.
      hp = Math.round(hp * (role === "final" ? 0.65 : role === "gate" ? 0.75 : 0.5));
    }
    return {
      hp,
      oil: bossOilReward[index],
      quiz: role !== "gate",
      role
    };
  }

  function critChance(base, step, critLvl, defaultCrit) {
    let chance;
    if (typeof base === "object" && base !== null) {
      if (typeof base.critChance === "number") {
        chance = base.critChance;
      } else {
        const lvl = typeof base.critLvl === "number" ? base.critLvl : (defaultCrit || 0);
        const bVal = typeof step === "number" ? step : 0.2;
        const sVal = typeof critLvl === "number" ? critLvl : 0.15;
        chance = Math.min(0.5, bVal + lvl * sVal);
      }
    } else if (typeof step === "undefined") {
      chance = Math.min(0.5, base || 0);
    } else {
      chance = Math.min(0.5, base + (critLvl || 0) * step);
    }
    return chance;
  }
  // Phase24: original Katana distance + facing-cone test shared by
  // the cast gate and the actual damage loop. Pure: no RNG, no mutations.
  function bladeArcContains(player, enemy, reach, faceAng, arc) {
    if (!(Math.hypot(player.x - enemy.x, player.y - enemy.y) <= reach)) return false;
    const eang = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    let diff = Math.abs(eang - faceAng);
    // Normal facing comes from atan2; reject abnormal angles that could make
    // this original subtraction loop non-terminating or prohibitively long.
    if (!Number.isFinite(diff) || diff > Math.PI * 128) return false;
    while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
    return diff <= arc;
  }
  // Phase25: preserve thunder's exact filter, native stable-sort comparator
  // and slice semantics. Damage, crit rolls and effect order remain in game.js.
  function thunderTargetSelection(enemies, player, spec) {
    const radius = spec.radius;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const candidates = enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(player, e) <= radius);
    if (candidates.length) {
      const threat = e => spec.hasFocus
        ? (e.type === "boss" ? 0 : e.type === "tank" ? 1 : 2)
        : (e.type === "boss" ? 0 : (e.type === "shooter" || e.type === "shiome") ? 1 : e.type === "tank" ? 2 : 3);
      candidates.sort((a, b) => (spec.level >= 4 || spec.hasFocus) ? (threat(a) - threat(b) || dist(player, a) - dist(player, b)) : dist(player, a) - dist(player, b));
    }
    return { candidates, primaryTargets: candidates.slice(0, spec.targetCount) };
  }
  // Phase26: first struck primary with any eligible nearby target wins.
  // Preserve native sort tie behavior and source identity; no combat mutation.
  function thunderBranchTarget(enemies, primaryTargets, struck, branchRadius) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let branchTarget = null;
    for (const pt of primaryTargets) {
      const subCandidates = enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && !struck.has(e) && dist(pt, e) <= branchRadius);
      if (subCandidates.length > 0) {
        subCandidates.sort((a, b) => dist(pt, a) - dist(pt, b));
        branchTarget = subCandidates[0];
        break;
      }
    }
    return branchTarget;
  }
  // Phase27: both delayed AoE queues select the first three eligible enemies
  // in source array order, not the three closest enemies.
  function unsortedAreaTargets(enemies, area) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    return enemies
      .filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(area, e) <= area.radius)
      .slice(0, 3);
  }
  // Phase28: preserve cinder's cooldown, living dragon-ground exclusion,
  // and original first-three enemy order. Damage remains in game.js.
  function cinderScorchTargets(enemies, scorch, dragonScorches, elapsed) {
    return enemies
      .filter(e => {
        if (e.hp <= 0 || e.shield || e.vanish || e.done) return false;
        if (e.scorchReady > elapsed) return false;
        const coveredByDragon = dragonScorches.some(s => !s.isCinder && s.life > 0 && Math.hypot(e.x - s.x, e.y - s.y) <= s.r);
        if (coveredByDragon) return false;
        return Math.hypot(e.x - scorch.x, e.y - scorch.y) <= scorch.r;
      })
      .slice(0, 3);
  }
  // Phase29: Lv5 dragon favors the forward cone, then picks the first
  // densest cluster, preserving strict fallback bounds and enemy order.
  function dragonFireTarget(enemies, player) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const face = player.faceAng || 0;
    const ahead = enemies.filter(e => {
      if (e.hp <= 0 || e.shield || e.vanish || e.done) return false;
      const d = dist(player, e);
      if (d < 90 || d > 560) return false;
      let diff = Math.abs(Math.atan2(e.y - player.y, e.x - player.x) - face);
      if (!Number.isFinite(diff) || diff > Math.PI * 128) return false;
      while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
      return diff <= 1.15;
    });
    const pool = ahead.length ? ahead : enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(player, e) > 90 && dist(player, e) < 560);
    let target = null, bestN = -1;
    for (const e of pool) {
      let n = 0;
      for (const o of pool) if (dist(o, e) < 140) n++;
      if (n > bestN) { target = e; bestN = n; }
    }
    return target;
  }
  // Phase30: needle's tracking mutation picks the nearest unhit living foe.
  // The original strict < threshold gives the first enemy priority on ties.
  // Do not filter shields/vanish/done here: preserve the exact shipped rule.
  // Retarget cooldown, homing turn, projectile state and damage stay in game.
  function needleSeekTarget(enemies, needle) {
    let nearest = needle.seekRange || 480;
    let chosen = null;
    for (const e of enemies) {
      if (e.hp > 0 && !needle.hits?.has(e)) {
        const d = Math.hypot(needle.x - e.x, needle.y - e.y);
        if (d < nearest) {
          nearest = d;
          chosen = e;
        }
      }
    }
    return chosen;
  }
  // Phase31: only Katana Lv5 flying-wave geometry. Pierce budget, shielding,
  // crit/damage and contact state remain in the weapons() caller.
  function katanaWaveContains(enemy, wave) {
    const along = Math.abs((enemy.x - wave.x) * Math.cos(wave.ang) + (enemy.y - wave.y) * Math.sin(wave.ang));
    const side = Math.abs(-(enemy.x - wave.x) * Math.sin(wave.ang) + (enemy.y - wave.y) * Math.cos(wave.ang));
    if (along >= (enemy.type === 'boss' ? 95 : 75) || side >= 180 + (enemy.type === 'boss' ? 40 : 22)) return false;
    const ox = enemy.x - wave.originX, oy = enemy.y - wave.originY;
    if (Math.hypot(ox, oy) > (wave.maxTravel || 720)) return false;
    let ad = Math.abs(Math.atan2(oy, ox) - wave.ang);
    while (ad > Math.PI) ad = Math.abs(ad - 2 * Math.PI);
    // Preserve original `if (ad > 1.22) continue` semantics, including NaN.
    return !(ad > 1.22);
  }
  return Object.freeze({ bossBlueprint, critChance, bladeArcContains, thunderTargetSelection, thunderBranchTarget, unsortedAreaTargets, cinderScorchTargets, dragonFireTarget, needleSeekTarget, katanaWaveContains });
})();
