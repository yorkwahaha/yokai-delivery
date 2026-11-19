// Shared Bamboo Maze art. Keep editable sources in art/.
window.BAMBOO_ART = (() => {
  const stage = "bamboo-maze";
  const scene = {
    tiles: ["forest-duff", "earth-track"],
    scene: ["tea-house", "produce-house"],
    props: ["bamboo-column", "bamboo-thicket", "bamboo-fork", "bamboo-fence", "stone-lantern", "shoot-baskets", "moss-rocks"]
  };
  const walks = ["walk__f01", "walk__f02", "walk__f03", "walk__f04"];
  const enemies = {
    runner: ["bamboo-shoot", 62, 376, ["idle", "windup", "rush", "recover", ...walks]],
    ghost: ["bamboo-hat-imp", 66, 376, ["idle", "attack"]],
    tank: ["bamboo-basket-crab", 74, 317, ["idle", "attack"]],
    shooter: ["reed-whistle-weasel", 69, 376, ["idle", "attack"]],
    boss: ["bamboo-warden", 154, 290, ["idle", "sealed", "cut", "shoots"]]
  };
  const frame = [0, 0, 512, 472, 256];
  const images = {};
  const effects = { bambooCut: "bamboo-cut", bambooShoots: "bamboo-shoots" };
  let requested = false;

  function load() {
    if (requested) return;
    requested = true;
    function loadImage(key, path, height) {
      const image = new Image();
      image.decoding = "async";
      if (height) {
        image.stageFrame = frame;
        image.bambooHeight = height;
      }
      images[key] = image;
      image.src = "assets/img/" + path + ".webp";
    }
    for (const [folder, roles] of Object.entries(scene))
      for (const role of roles) loadImage(role, `stages/${stage}/${folder}/${stage}__${role}`);
    for (const [id, visibleHeight, sourceHeight, poses] of Object.values(enemies))
      for (const pose of poses)
        loadImage(id + ":" + pose, `enemies/${id}/${id}__sprite__${pose}`, visibleHeight * frame[3] / sourceHeight);
    for (const [kind, id] of Object.entries(effects))
      for (const phase of ["warning", "impact"]) loadImage(kind + ":" + phase, `vfx/enemies/${id}/${id}__${phase}`);
  }

  function image(role) {
    return images[role]?.naturalWidth ? images[role] : null;
  }

  function monster(enemy, elapsed = 0, motion = false) {
    const type = enemy.bambooSkirmisher ? "runner" : enemy.type;
    const id = enemies[type]?.[0];
    if (!id) return null;
    let pose = "idle";
    if (type === "boss") {
      if (enemy.shield) pose = "sealed";
      else if (!enemy.dying && ["telegraph", "active"].includes(enemy.hazard?.phase))
        pose = enemy.hazard.kind === "bambooCut" ? "cut" : "shoots";
    } else if (type === "runner") {
      const rushPose = { telegraph: "windup", active: "rush", recovery: "recover" }[enemy.bambooRush?.phase];
      if (rushPose) pose = rushPose;
      else if (motion && enemy.walking && !enemy.dying && !enemy.revealT && !enemy.burning)
        pose = walks[Math.floor(elapsed * 8 + (enemy.wob || 0)) % walks.length];
    } else if (!enemy.dying && enemy.attackT > 0) pose = "attack";
    return image(id + ":" + pose) || image(id + ":idle");
  }

  function paintHazard(ctx, hazard) {
    if (!effects[hazard.kind] || hazard.phase === "recovery") return false;
    const warning = hazard.phase === "telegraph";
    const sprite = image(hazard.kind + (warning ? ":warning" : ":impact"));
    if (!sprite) return false;
    const sw = sprite.naturalWidth - 16, sh = sprite.naturalHeight - 16;
    for (const zone of hazard.zones) {
      ctx.save();
      ctx.translate(zone.x, zone.y);
      if (hazard.kind === "bambooCut") {
        const vertical = zone.ry > zone.rx;
        if (vertical) ctx.rotate(Math.PI / 2);
        const long = vertical ? zone.ry : zone.rx, short = vertical ? zone.rx : zone.ry;
        ctx.drawImage(sprite, 8, 8, sw, sh, -long, -short, long * 2, short * 2);
      } else if (warning) {
        ctx.drawImage(sprite, 8, 8, sw, sh, -zone.rx, -zone.rx, zone.rx * 2, zone.rx * 2);
      } else {
        const ring = image(hazard.kind + ":warning");
        if (ring) ctx.drawImage(ring, 8, 8, ring.naturalWidth - 16, ring.naturalHeight - 16,
          -zone.rx, -zone.rx, zone.rx * 2, zone.rx * 2);
        const paint = () => {
          const width = zone.rx * 2, height = width * sh / sw;
          ctx.drawImage(sprite, 8, 8, sw, sh, -zone.rx, -height * .94, width, height);
        };
        if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, 0, 0, paint);
        else paint();
      }
      ctx.restore();
    }
    return true;
  }

  return Object.freeze({ load, image, monster, paintHazard });
})();
