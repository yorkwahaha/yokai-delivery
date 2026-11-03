// Phase 10: delivery candidate filtering only.
// All randomness, world cache traversal and order state changes stay in game.js.
window.GAME_DELIVERY_RULES = (() => {
  function portPickupPool(openHouses, referenceX, colsBetween) {
    const minH = 480, maxH = 1650;
    const minBetweenHouses = 1, targetBetweenHouses = 2;
    let reachable = openHouses.filter(h => colsBetween(h.x, referenceX) >= minBetweenHouses);
    const preferred = reachable.filter(h =>
      colsBetween(h.x, referenceX) >= targetBetweenHouses && colsBetween(h.x, referenceX) <= 8);
    const pixelFiltered = (preferred.length ? preferred : reachable).filter(h => {
      const dx = Math.abs(h.x - referenceX);
      return dx >= minH && dx <= maxH;
    });
    const fallback = openHouses.filter(h => {
      const dx = Math.abs(h.x - referenceX);
      return dx >= 470 && dx <= 1750 && colsBetween(h.x, referenceX) >= minBetweenHouses;
    });
    return pixelFiltered.length ? pixelFiltered : fallback;
  }

  function portDestinationPools(destinationHouses, from, colsBetween) {
    const minH2 = 480, maxH2 = 1650, comMinH2 = 700;
    const reachable2 = destinationHouses.filter(h =>
      h.id !== from.id && Math.abs(h.x - from.x) >= minH2 && Math.abs(h.x - from.x) <= maxH2 &&
      colsBetween(h.x, from.x) >= 1);
    const pool2 = reachable2.length ? reachable2 : destinationHouses.filter(h =>
      h.id !== from.id && Math.abs(h.x - from.x) >= 470 && Math.abs(h.x - from.x) <= 1750 &&
      colsBetween(h.x, from.x) >= 1);
    const far2 = pool2.filter(h => Math.abs(h.x - from.x) >= comMinH2);
    const near2 = pool2.filter(h => Math.abs(h.x - from.x) < comMinH2);
    return {pool:pool2, far:far2, near:near2};
  }

  function townDestinationPools(houses, from, dist) {
    const reachable = houses.filter(h => h !== from && dist(h, from) >= 580 && dist(h, from) <= 1250);
    const pool = reachable.length ? reachable :
      houses.filter(h => h !== from && dist(h, from) >= 420 && dist(h, from) <= 1600);
    const far = pool.filter(h => dist(h, from) >= 850);
    const near = pool.filter(h => dist(h, from) < 850);
    return {pool, far, near};
  }

  return Object.freeze({portPickupPool, portDestinationPools, townDestinationPools});
})();
