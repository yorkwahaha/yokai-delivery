// Shared, testable gameplay pacing. Keep the browser build dependency-free.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const RUN_SECONDS = 600;

  const CONFIG = {
    RUN_SECONDS,
    GOAL_DELIVERIES: 6,
    BOSS_TIMES: [180, 360, 540, 590],
    SURGE_FIRST: 75,
    SURGE_INTERVAL: 75,
    xpNeed(level) {
      const lv = Math.max(1, Number(level) || 1);
      return 24 + lv * 5 + Math.floor(Math.pow(lv, 1.35) * 1.2);
    },
    spawnInterval(elapsed) {
      const t = Math.min(Math.max(0, elapsed || 0), RUN_SECONDS);
      return Math.max(0.48, 1.8 - t * 0.0022);
    },
    spawnCount(elapsed) {
      const t = Math.min(Math.max(0, elapsed || 0), RUN_SECONDS);
      return Math.min(6, 1 + Math.floor(t / 100));
    },
    enemyTier(elapsed, power = 0) {
      const t = Math.min(Math.max(0, elapsed || 0), RUN_SECONDS);
      return 1 + t / 130 + power * 0.05;
    },
    orderSlots(elapsed, delivered) {
      if ((delivered || 0) === 0) return 1;
      if ((elapsed || 0) < 120) return 2;
      return 3;
    }
  };

  root.GAME_CONFIG = CONFIG;
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
})();
