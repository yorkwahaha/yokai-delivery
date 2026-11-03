// Pure barrier geometry, extracted without touching game state or controls.
// Caller supplies the current ground-plane Y compression factor.
window.GAME_GEOMETRY = (() => {
  function deliveryBarrierContains(point, house, tilt, padding = 0) {
    if (!point || !house) return false;
    const rx = 245 + padding;
    const ry = 165 / tilt + padding;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (point.x - house.x) / rx;
    const dy = (point.y - (house.y + 70)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  // Strictly filter both endpoints before rounding. In particular, houses
  // at x=191 and x=1610 must not leak into interior 50px columns.
  function countInteriorHouseColumns(houseXs, x1, x2) {
    const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
    const columns = new Set();
    for (const x of houseXs) {
      if (x > lo && x < hi) columns.add(Math.round(x / 50) * 50);
    }
    return columns.size;
  }
  return Object.freeze({ deliveryBarrierContains, countInteriorHouseColumns });
})();
