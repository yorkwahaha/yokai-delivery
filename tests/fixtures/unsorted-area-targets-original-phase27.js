// Two distinct Phase26 source expressions preserved as Phase27 golden baselines.
function originalInkfireTargets(enemies, im) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return enemies
    .filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(im, e) <= im.radius)
    .slice(0, 3);
}
function originalDuoShockTargets(enemies, sw) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return enemies
    .filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && dist(sw, e) <= sw.radius)
    .slice(0, 3);
}
