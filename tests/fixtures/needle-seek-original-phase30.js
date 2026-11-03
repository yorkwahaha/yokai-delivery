// Frozen pre-Phase30 needle selection from game.js. Golden parity input.
// Pure mirror of the original loop: no normalization of ties or eligibility.
function originalNeedleSeekTarget(enemies, needle) {
  let nearest = needle.seekRange || 480;
  let chosen = null;
  for (const e of enemies) {
    if (e.hp > 0 && !needle.hits?.has(e)) {
      const d = Math.hypot(needle.x - e.x, needle.y - e.y);
      if (d < nearest) {
        nearest = d;
        chosen = e;
      }
    }
  }
  return chosen;
}
