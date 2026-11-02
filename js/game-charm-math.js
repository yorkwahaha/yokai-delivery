// Phase 3: deterministic charm math only. No player state or RNG here.
window.GAME_CHARM_MATH = (() => {
  function guardOilLoss(amount, level) {
    if (level <= 0) return amount;
    const mul = 1 - 0.10 * level;
    return Math.min(amount, Math.max(Number.MIN_VALUE, parseFloat((amount * mul).toPrecision(12))));
  }
  return Object.freeze({ guardOilLoss });
})();
