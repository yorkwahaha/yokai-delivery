// Frozen Phase25 original game.js thunder-branch nearest-target selection.
function originalThunderBranchTarget(enemies, primaryTargets, struck, branchRadius) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let branchTarget = null;
  for (const pt of primaryTargets) {
    const subCandidates = enemies.filter(e => e.hp > 0 && !e.shield && !e.vanish && !e.done && !struck.has(e) && dist(pt, e) <= branchRadius);
    if (subCandidates.length > 0) {
      subCandidates.sort((a, b) => dist(pt, a) - dist(pt, b));
      branchTarget = subCandidates[0];
      break;
    }
  }
  return branchTarget;
}
