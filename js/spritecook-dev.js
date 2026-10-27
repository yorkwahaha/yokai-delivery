// Shared player motion atlases for ALL stages and the overworld.
// Production sprites live under assets/img/player-actions; original stills remain as fallback.
// Keep this script path for existing page compatibility.
(() => {
  const enabled = true;
  const dir = "assets/img/player-actions/";
  const frames = Object.freeze({
    idle:   {name:"idle.webp", count:8, fps:8},
    walk:   {name:"walk.webp", count:8, fps:8},
    // Running is brisk and scales with movement speed; attacking has its own slower 0.52s timeline.
    run:    {name:"run.webp", count:10, fps:17},
    attack: {name:"attack.webp", count:8, fps:12}
  });
  const loaded = Object.create(null);
  const status = Object.create(null);
  let lastKind = null, attackStart = 0;
  let attackGeneration = 0, drawnAttackGeneration = -1;
  const retryAt = Object.create(null);
  const restartAttack = () => { attackGeneration++; };
  let runElapsed = null, runPhase = 0;
  let slashImage = null;
  // Alpha > 32 bottom edge measured from each approved 640x640 sprite cell.
  // Run frames 4 and 9 have naturally lifted feet. Compensating those frames
  // separately caused the entire character to snap down 4px on each stride.
  // Anchor ALL run frames to the same median bottom (617px), preserving
  // SpriteCook's natural leg/torso animation rather than adding a new bounce.
  const footBottom = Object.freeze({
    idle:   [639,639,639,639,639,639,639,639],
    walk:   [627,622,622,622,623,622,622,621],
    run:    [620,618,617,617,596,617,618,617,617,595],
    attack: [639,639,639,639,639,639,639,639]
  });
  const runFps = speed => {
    const actual = Number.isFinite(speed) && speed > 0 ? speed : 230;
    return Math.min(27, Math.max(14, 17 * actual / 230));
  };
  function frame(kind, elapsed, motion = true, moveSpeed = 230) {
    if (!enabled) return null;
    if (kind !== "run") { runElapsed = null; runPhase = 0; }
    if (kind !== "attack") lastKind = kind;
    else if (lastKind !== "attack" || drawnAttackGeneration !== attackGeneration) {
      attackStart = elapsed; lastKind = kind; drawnAttackGeneration = attackGeneration;
    }
    const image = loaded[kind], spec = frames[kind];
    if (!image || !spec) return null;
    // Attack has a separate, slower visual window (0.52s for all 8 frames).
    // It never inherits the movement-speed bonus used by runFps().
    let index;
    if (kind === "attack") {
      index = Math.min(spec.count-1, Math.max(0, Math.floor((elapsed-attackStart)/0.52*spec.count)));
    } else if (kind === "run") {
      if (motion) {
        if (runElapsed !== null && elapsed >= runElapsed)
          runPhase += Math.min(0.12, elapsed-runElapsed) * runFps(moveSpeed);
        else if (runElapsed !== null) runPhase = 0;
        runElapsed = elapsed;
      } else { runElapsed = null; runPhase = 0; }
      index = Math.floor(runPhase) % spec.count;
    } else {
      index = motion ? Math.floor(Math.max(0,elapsed)*spec.fps)%spec.count : 0;
    }
    const footPad = kind === "run" ? 22 : 639-footBottom[kind][index];
    return {image, index, size:640, count:spec.count, kind, footPad};
  }
  function drawSlash(ctx, index) {
    if (!enabled || index < 4 || index > 6 || !slashImage?.naturalWidth) return;
    ctx.save();
    // Short sword-path highlight over the blade/hand only; the skill system
    // already draws the large flying slash. Keep this from reading as a second.
    ctx.globalAlpha *= index === 5 ? 0.52 : index === 4 ? 0.34 : 0.24;
    // Use existing hand-painted art rather than procedural/vector effects.
    ctx.drawImage(slashImage, 6, -87, 56, 32);
    ctx.restore();
  }
  // Load lazily on entering a stage or drawing the travel-map player, never at the title screen.
  function ready(kind) { return status[kind] === "ready"; }
  function load() {
    if (typeof Image === "undefined") return;
    for (const [kind, spec] of Object.entries(frames)) {
      if (status[kind] === "loading" || status[kind] === "ready") continue;
      // Failed atlases can retry on the next level entry, with a short backoff.
      if (Date.now() < (retryAt[kind] || 0)) continue;
      status[kind] = "loading";
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = kind === "run" || kind === "attack" ? "high" : "low";
      img.onload = () => {
        if (img.naturalWidth === spec.count*640 && img.naturalHeight === 640) {
          loaded[kind] = img; status[kind] = "ready";
        } else {
          status[kind] = "invalid dimensions; original art preserved";
          retryAt[kind] = Date.now() + 3000;
        }
      };
      img.onerror = () => {
        status[kind] = "missing; original art preserved";
        retryAt[kind] = Date.now() + 3000;
      };
      const canonical = window.__RUNTIME_MANIFEST?.shared_actors?.player?.actions?.[kind + "_atlas"]?.path;
      img.src = (canonical || dir + spec.name) + "?v=20261027-atlas-retry1";
    }
    if (!slashImage) {
      slashImage = new Image();
      slashImage.src = "assets/img/vfx/raster/katana_l1.webp";
    }
  }
  window.SPRITECOOK_DEV = {enabled, frames, status, frame, drawSlash, runFps, ready, load, restartAttack};
})();
