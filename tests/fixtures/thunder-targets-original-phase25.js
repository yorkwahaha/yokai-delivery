// Snapshot of Phase24 thunder group selection, copied verbatim in computation.
function originalThunderTargetSelection(enemies, P, spec) {
  const radius = spec.radius;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const candidates = enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(P, e) <= radius);
  if (candidates.length) {
    const threat = e => spec.hasFocus
      ? (e.type === "boss" ? 0 : e.type === "tank" ? 1 : 2)
      : (e.type === "boss" ? 0 : (e.type === "shooter" || e.type === "shiome") ? 1 : e.type === "tank" ? 2 : 3);
    candidates.sort((a, b) => (spec.level >= 4 || spec.hasFocus) ? (threat(a) - threat(b) || dist(P, a) - dist(P, b)) : dist(P, a) - dist(P, b));
  }
  return { candidates, primaryTargets: candidates.slice(0, spec.targetCount) };
}
