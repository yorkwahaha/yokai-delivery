// Literal Phase27 cinder explosion expression, before Phase28 extraction.
function originalCinderScorchTargets(enemies, scorch, dragonScorches, elapsed) {
  return enemies
    .filter(e => {
      if (e.hp <= 0 || e.shield || e.vanish || e.done) return false;
      if (e.scorchReady > elapsed) return false;
      const coveredByDragon = dragonScorches.some(s => !s.isCinder && s.life > 0 && Math.hypot(e.x - s.x, e.y - s.y) <= s.r);
      if (coveredByDragon) return false;
      return Math.hypot(e.x - scorch.x, e.y - scorch.y) <= scorch.r;
    })
    .slice(0, 3);
}
