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
  // Pure mob archetype selection. Caller supplies its one existing RNG
  // draw; no Math.random, enemy insertion, or state mutation occurs here.
  function enemySpec(tier, r, options) {
    const { elapsed, dawn, difficulty, stageEnemy, stageId, ring, rainPortNormal } = options;
    // 怪物速度曲線：封頂於 10 分鐘，破曉後加班不再增加怪物難度。
    const cappedElapsed = Math.min(elapsed, dawn);
    const speedRamp = (cappedElapsed / dawn) * 75 * difficulty.timeScale;
    const stageSpeed = (stageEnemy.speedScale || 1) * difficulty.speedScale;
    const shooterChance = stageEnemy.shooterChance ?? 0.14;
    const canShoot = stageEnemy.shots !== false;
    let t = { type: "ghost", hp: 2.0 * tier, speed: (52 + speedRamp * 0.9) * stageSpeed };

    // rain-port Normal：海妖 (shiome) 取代燈籠怪 (shooter)。
    if (rainPortNormal) {
      if (cappedElapsed > 90 && r < 0.25) {
        t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
      } else if (cappedElapsed > 200 && r < 0.40) {
        t = { type: "tank", hp: 7.0 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
      } else if (cappedElapsed > 160 && r < (cappedElapsed > 200 ? 0.40 : 0.25) + shooterChance && !ring && canShoot) {
        t = { type: "shiome", hp: 0.7 * tier, speed: (46 + speedRamp * 0.7) * stageSpeed, pose: "idle" };
      }
    } else {
      if (stageId === "rain-port" && !ring && r >= 0.55 && r < 0.72) {
        t = { type: "shiome", hp: 2.2 * tier, speed: (46 + speedRamp * 0.7) * stageSpeed, pose: "idle", shiomeCd: 0.8 };
      } else if (cappedElapsed > 90 && r < 0.22) {
        t = { type: "runner", hp: 1.5 * tier, speed: (110 + speedRamp * 1.1) * stageSpeed };
      } else if (cappedElapsed > 200 && r < 0.36) {
        t = { type: "tank", hp: 7.0 * tier, speed: (32 + speedRamp * 0.4) * stageSpeed };
      } else if (cappedElapsed > 160 && r < (cappedElapsed > 200 ? 0.36 : 0.22) + shooterChance && !ring && canShoot) {
        t = { type: "shooter", hp: tier, speed: (48 + speedRamp * 0.8) * stageSpeed };
      }
    }
    return t;
  }
  return Object.freeze({mobPacing, enemySpec});
})();
