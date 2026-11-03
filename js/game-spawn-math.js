// Phase 7: stage-independent arithmetic for enemy pacing.
// All live stage/difficulty settings are provided by game.js; no mutations/RNG.
window.GAME_SPAWN_MATH = (() => {
  function mobPacing(atElapsed, power, options) {
    const {
      dawn, config, difficulty, spawnIntervalScale,
      spawnCountBonus, nightTownNormal, clamp
    } = options;
    const cappedElapsed = Math.min(atElapsed, dawn);
    let interval = config.spawnInterval(cappedElapsed * difficulty.timeScale) * spawnIntervalScale * difficulty.intervalScale;
    let count = Math.max(1, config.spawnCount(cappedElapsed) + spawnCountBonus);

    // S1 Normal：前一分鐘持續生成威脅，之後逐步接近第二關的密度。
    if (nightTownNormal && cappedElapsed < 150) {
      if (cappedElapsed < 90) {
        interval = 1.5 - 0.42 * clamp(cappedElapsed / 90, 0, 1);
        count = 1;
      } else {
        interval = 2.16 + (interval - 2.16) * ((cappedElapsed - 90) / 60);
        count = 2;
      }
    }
    return {
      tier: config.enemyTier(Math.min(atElapsed, config.RUN_SECONDS) * difficulty.timeScale, power * difficulty.powerScale),
      interval,
      count
    };
  }
  return Object.freeze({mobPacing});
})();
