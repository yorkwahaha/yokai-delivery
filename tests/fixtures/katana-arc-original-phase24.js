// Original pre-extraction cone calculation from the phase 23 deployed game.
function originalBladeArcContains(P, e, reach, faceAng, arc) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  if (dist(P, e) <= reach) {
    const eang = Math.atan2(e.y - P.y, e.x - P.x);
    let diff = Math.abs(eang - faceAng);
    while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
    if (diff <= arc) return true;
  }
  return false;
}
