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
  return Object.freeze({ bossBlueprint, critChance, bladeArcContains, thunderTargetSelection });
})();
