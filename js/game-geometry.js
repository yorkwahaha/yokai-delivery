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
  return Object.freeze({ deliveryBarrierContains });
})();
