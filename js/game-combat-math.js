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
  return Object.freeze({ bossBlueprint, critChance, bladeArcContains });
})();
