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
  // All hit tests are in canvas/world coordinates. UI layout and actions
  // stay owned by game.js; keep strict edges and minimum touch dimensions.
  function pointerWorld(event, rect, viewport) {
    return {
      x: (event.clientX - rect.left) * viewport.width / rect.width - viewport.offsetX,
      y: (event.clientY - rect.top) * viewport.height / rect.height - viewport.offsetY
    };
  }
  function hitCircle(point, button) {
    return Math.hypot(point.x - button.x, point.y - button.y) < button.r + 10;
  }
  function hitButton(point, button, scale) {
    const minimum = 44 / (scale || 1);
    const px = Math.max(0, (minimum - button.w) / 2), py = Math.max(0, (minimum - button.h) / 2);
    return point.x >= button.x - px && point.x <= button.x + button.w + px &&
      point.y >= button.y - py && point.y <= button.y + button.h + py;
  }
  function levelUpCardIndex(point, cards, card, count) {
    for (let i = 0; i < count; i++) {
      const rect = cards?.[i] || {x:card.x,y:card.y+i*(card.h+card.gap),w:card.w,h:card.h};
      if (point.x >= rect.x && point.x <= rect.x + rect.w &&
          point.y >= rect.y && point.y <= rect.y + rect.h) {
        return i;
      }
    }
    return -1;
  }
  return Object.freeze({
    deliveryBarrierContains, countInteriorHouseColumns,
    pointerWorld, hitCircle, hitButton, levelUpCardIndex
  });
})();
