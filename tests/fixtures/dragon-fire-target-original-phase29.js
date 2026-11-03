// Original Phase28 Lv5 dragon candidate, forward-cone and cluster expression.
function originalDragonFireTarget(enemies, P) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const face = P.faceAng || 0;
  const ahead = enemies.filter(e => {
    if (e.hp <= 0 || e.shield) return false;
    const d = dist(P, e);
    if (d < 90 || d > 560) return false;
    let diff = Math.abs(Math.atan2(e.y - P.y, e.x - P.x) - face);
    while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
    return diff <= 1.15;
  });
  const pool = ahead.length ? ahead : enemies.filter(e => e.hp > 0 && !e.shield && dist(P, e) > 90 && dist(P, e) < 560);
  let target = null, bestN = -1;
  for (const e of pool) {
    let n = 0;
    for (const o of pool) if (dist(o, e) < 140) n++;
    if (n > bestN) { target = e; bestN = n; }
  }
  return target;
}
