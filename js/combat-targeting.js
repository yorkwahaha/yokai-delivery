// Pure targeting helpers. Keep stable first-in-list tie breaking and avoid
// sorting/copying the complete enemy array to select a single nearest target.
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  const squaredDistance = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  function nearest(list, origin, eligible = () => true) {
    let winner = null, best = Infinity;
    for (const candidate of list) {
      if (!eligible(candidate)) continue;
      const distance = squaredDistance(origin, candidate);
      if (distance < best) { winner = candidate; best = distance; }
    }
    return winner;
  }
  const api = Object.freeze({ squaredDistance, nearest });
  root.COMBAT_TARGETING = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
