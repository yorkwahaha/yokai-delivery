// Phases 3-5: deterministic charm math only. No player state or RNG here.
window.GAME_CHARM_MATH = (() => {
  function guardOilLoss(amount, level) {
    if (level <= 0) return amount;
    const mul = 1 - 0.10 * level;
    return Math.min(amount, Math.max(Number.MIN_VALUE, parseFloat((amount * mul).toPrecision(12))));
  }
  // Each input is a value read by game.js from the current run/build.
  // No player/build state, DOM, or random number generator enters this module.
  function effectiveDamage(damageRank, powerLevel) {
    const powerBonus = powerLevel * 0.20;
    return (damageRank || 1) + powerBonus;
  }
  function effectiveMoveSpeed(speedRank, stepLevel) {
    const stepBonus = stepLevel * 28;
    return 230 + (speedRank || 0) * 35 + stepBonus;
  }
  function effectiveMagnetRadius(baseRadius, portNormalBonus, gatherLevel) {
    const gatherBonus = gatherLevel * 75;
    return baseRadius + portNormalBonus + gatherBonus;
  }
  function effectiveRate(rateRank, cadenceLevel) {
    const cadenceBonus = cadenceLevel * 0.25;
    return (rateRank || 0) + cadenceBonus;
  }
  function effectiveReachMultiplier(reachLevel) {
    return reachLevel > 0 ? 1 + 0.10 * reachLevel : 1.0;
  }
  // Inputs are supplied by game.js, so old builds, active-run charms and
  // max-level rules can be resolved without reading or changing game state.
  function charmLevelOf(id, buildState = null, buildCharms, charmLevels, maxLevel) {
    const charms = (buildState && Array.isArray(buildState.charms)) ? buildState.charms : buildCharms;
    if (!charms.includes(id)) return 0;
    const table = (buildState && buildState.charmLevels && typeof buildState.charmLevels === "object")
      ? buildState.charmLevels
      : (buildState ? null : charmLevels);
    if (!table) return 1;
    const raw = table[id];
    const lv = Number.isFinite(raw) ? Math.floor(raw) : 1;
    return Math.max(1, Math.min(maxLevel, lv));
  }
  return Object.freeze({
    charmLevelOf,
    guardOilLoss,
    effectiveDamage,
    effectiveMoveSpeed,
    effectiveMagnetRadius,
    effectiveRate,
    effectiveReachMultiplier
  });
})();
