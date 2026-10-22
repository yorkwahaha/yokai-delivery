// Shared, testable gameplay pacing. Keep the browser build dependency-free.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const RUN_SECONDS = 600;

  function toFinite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampElapsed(value) {
    const n = Number(value);
    if (n === Infinity) return RUN_SECONDS;
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, RUN_SECONDS);
  }

  // 單一小怪難度來源：game.js 以 CFG.resolveMobDifficultyProfile(STAGE) 取同一凍結物件。
  // hard 保留既有曲線；night-town 預設 normal；rain-port 預設 rainPortNormal；其餘關卡 hard。
  const MOB_DIFFICULTY_PROFILES = Object.freeze({
    hard: Object.freeze({ hpScale: 1, speedScale: 1, timeScale: 1, powerScale: 1,
      intervalScale: 1, cap: 95, surgeCountScale: 1, surgePacingScale: 1, capSurges: false, xpNeedScale: 1 }),
    // Stage 1 (night-town) Normal：依凍結快照精確還原
    normal: Object.freeze({ hpScale: 0.55, speedScale: 0.75, timeScale: 0.25, powerScale: 0,
      intervalScale: 1.3, cap: 45, surgeCountScale: 0.4, surgePacingScale: 2.5, capSurges: true, xpNeedScale: 0.65 }),
    // Stage 2 (rain-port) Normal：怪物 HP/速度/生成/成長採 Hard 基底；玩家 XP 校準為 80%
    rainPortNormal: Object.freeze({ hpScale: 1, speedScale: 1, timeScale: 1, powerScale: 1,
      intervalScale: 1, cap: 95, surgeCountScale: 1, surgePacingScale: 1, capSurges: false, xpNeedScale: 0.8 }),
    // rain-port Hard 快照（改前保存，供回溯/對比）——保留既有 stage 參數與生成權重
    "rain-port-hard-snapshot": Object.freeze({
      hpScale: 1, speedScale: 1, timeScale: 1, powerScale: 1,
      intervalScale: 1, cap: 95, surgeCountScale: 1, surgePacingScale: 1, capSurges: false, xpNeedScale: 1,
      surgeFirst: 90, surgeInterval: 80, spawnIntervalScale: 1.15, spawnCountBonus: 0,
      enemySpeedScale: 1, bossHpScale: 1,
      shiomeChance: 0.17, runnerChance: 0.22, tankChance: 0.14, shooterChance: 0.06,
      fallbackShooterChance: 0.14,
      baseGhostHp: 2.0, baseGhostSpeed: 52, baseShiomeHp: 2.2, baseShiomeSpeed: 46,
      baseRunnerHp: 1.5, baseRunnerSpeed: 110, baseTankHp: 7.0, baseTankSpeed: 32,
      baseShooterHp: 1.0, baseShooterSpeed: 48, speedRampFactor: 75
    })
  });

  function resolveMobDifficultyProfile(stage) {
    const id = stage && stage.id;
    const mode = stage && stage.pacing && stage.pacing.mobDifficulty;
    if (id === "night-town") {
      return mode === "hard" ? MOB_DIFFICULTY_PROFILES.hard : MOB_DIFFICULTY_PROFILES.normal;
    }
    if (id === "rain-port") {
      return mode === "hard" ? MOB_DIFFICULTY_PROFILES.hard : MOB_DIFFICULTY_PROFILES.rainPortNormal;
    }
    return MOB_DIFFICULTY_PROFILES.hard;
  }

  const CONFIG = {
    RUN_SECONDS,
    GOAL_DELIVERIES: 6,
    BOSS_TIMES: [180, 360, 480, 540],
    BOSS_HP_BASE: [300, 650, 120, 1400],
    BOSS_OIL_REWARD: [35, 35, 20, 35],
    DELIVERY_XP: 26,
    AWAKEN_EVERY: 3,
    AWAKEN_MAX: 4,
    SURGE_FIRST: 75,
    SURGE_INTERVAL: 75,
    chaseStep(distance, speed, dt, type, canShoot = true) {
      const step = toFinite(speed, 0) * toFinite(dt, 0);
      const gap = Number(distance);
      // distance 0 is a valid firing distance; only invalid/negative distance is rejected.
      if (!(step > 0) || !Number.isFinite(gap) || gap < 0) return 0;
      return type === 'mis' && canShoot ? Math.max(-step, Math.min(step, gap - 86)) : Math.min(step, gap);
    },
    xpNeed(level) {
      const lv = Math.max(1, toFinite(level, 1));
      // Preserve Lv.1-20 pacing for four awakenings; raise late-game costs as enemy density grows.
      const openingNeed = Math.min(90, 24 + lv * 5 + Math.floor(Math.pow(lv, 1.35) * 1.2));
      return openingNeed + Math.max(0, lv - 20) * 12;
    },
    spawnInterval(elapsed) {
      const t = clampElapsed(elapsed);
      return Math.max(0.48, 1.8 - t * 0.0022);
    },
    spawnCount(elapsed) {
      const t = clampElapsed(elapsed);
      return Math.min(6, 1 + Math.floor(t / 100));
    },
    enemyTier(elapsed, power = 0) {
      const t = clampElapsed(elapsed);
      return 1 + t / 130 + Math.max(0, toFinite(power, 0)) * 0.05;
    },
    orderSlots(elapsed, delivered) {
      const t = clampElapsed(elapsed);
      const d = Math.max(0, toFinite(delivered, 0));
      if (d === 0) return 1;
      if (t < 120) return 2;
      return 3;
    },
    MOB_DIFFICULTY_PROFILES,
    resolveMobDifficultyProfile
  };

  root.GAME_CONFIG = CONFIG;
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
})();
