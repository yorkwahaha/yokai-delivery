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
  const shootsPeakTime = .082;
  // Crops of painted clods and bamboo leaf tips, with outward range and arc height.
  const shootsFragments = [
    { soil: true, crop: [101, 175, 38, 40], side: -.76, lift: .22, width: .13 },
    { soil: true, crop: [317, 99, 64, 63], side: .86, lift: .16, width: .16 },
    { crop: [8, 327, 120, 40], side: -1.08, lift: .36, width: .20 },
    { crop: [435, 382, 77, 49], side: .99, lift: .29, width: .16 }
  ];
  const cutFragments = [
    { soil: true, crop: [101, 175, 38, 40], along: -.42, side: -1, size: 12 },
    { crop: [245, 8, 81, 46], along: -.16, side: 1, size: 19 },
    { soil: true, crop: [317, 99, 64, 63], along: .26, side: 1, size: 14 },
    { crop: [245, 8, 81, 46], along: .49, side: -1, size: 17 }
  ];
  let cutLayers;
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
    if (window.DEV_MODE?.isStageLab?.(window.location)) {
      for (const [kind, id] of Object.entries(effects)) loadImage(kind + ":ink", `vfx/enemies/${id}/${id}__warning-ink`);
    }
    loadImage("bambooShoots:soil", "vfx/enemies/sakura-tengu/sakura-tengu__earth-break");
  }

  function unload() {
    for (const key of Object.keys(images)) delete images[key];
    cutLayers = null;
    requested = false;
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

  function paintShoots(ctx, hazard, zone, sprite, warning) {
    const duration = window.BAMBOO_COMBAT.shootsTiming[hazard.phase];
    const age = Number.isFinite(hazard.remaining)
      ? Math.max(0, Math.min(duration, duration - hazard.remaining))
      : warning ? 0 : shootsPeakTime;
    const progress = age / duration;
    const alpha = ctx.globalAlpha;
    const diameter = zone.rx * 2;
    const tail = warning ? 1 : Math.min(1, (duration - age) / .085);
    const ring = warning ? sprite : image("bambooShoots:warning");
    if (ring) {
      ctx.globalAlpha = alpha * (warning ? 1 : (.88 - .22 * progress) * tail);
      ctx.drawImage(ring, 8, 8, ring.naturalWidth - 16, ring.naturalHeight - 16,
        -zone.rx, -zone.rx, diameter, diameter);
    }

    const soil = image("bambooShoots:soil");
    if (soil) {
      const charge = progress ** 2;
      const burst = Math.max(0, 1 - Math.abs(age - shootsPeakTime) / .085);
      const width = diameter * (warning ? .38 + .37 * charge : .76 + .39 * progress);
      const height = diameter * (warning ? .13 + .13 * charge : .27 + .08 * burst);
      ctx.globalAlpha = alpha * (warning ? .16 + .31 * charge : (.43 + .41 * burst) * tail);
      ctx.drawImage(soil, 24, 24, 720, 474, -width / 2, -height / 2, width, height);
    }
    if (warning) return;

    const paint = () => {
      const sw = sprite.naturalWidth - 16, sh = sprite.naturalHeight - 16;
      const rise = Math.min(1, age / shootsPeakTime);
      const ease = 1 - (1 - rise) ** 2;
      const root = sh * .94;
      // Reveal the tip first and keep the visible base at ground level as the raster rises.
      const visible = root * (.05 + .95 * ease) + (sh - root) * Math.max(0, (rise - .75) * 4);
      const stretch = 1 + .075 * Math.max(0, 1 - Math.abs(age - shootsPeakTime) / .057);
      const scaleY = diameter / sw * stretch;
      const width = diameter * (.75 + .25 * ease);
      ctx.globalAlpha = alpha * tail;
      ctx.drawImage(sprite, 8, 8, sw, visible, -width / 2, -Math.min(visible, root) * scaleY,
        width, visible * scaleY);

      // Fixed raster fragments share this strike's clock and leave no particle state behind.
      const flight = (age - .018) / .167;
      if (flight <= 0 || flight >= 1) return;
      const arc = 4 * flight * (1 - flight);
      ctx.globalAlpha = alpha * Math.min(1, (1 - flight) * 2.5);
      for (const fragment of shootsFragments) {
        const source = fragment.soil ? soil : sprite;
        if (!source) continue;
        const [sx, sy, w, h] = fragment.crop;
        const size = diameter * fragment.width;
        const x = diameter * fragment.side * (.16 + .48 * flight);
        const y = diameter * (.04 - fragment.lift * arc);
        const height = size * h / w;
        ctx.drawImage(source, sx, sy, w, h, x - size / 2, y - height / 2, size, height);
      }
    };
    if (window.VIEWPORT?.upright) window.VIEWPORT.upright(ctx, 0, 0, paint);
    else paint();
  }

  // Reuse the painted path and ink rails. Bake the color and end caps once.
  function bambooCutLayers(warning) {
    if (cutLayers) return cutLayers;
    const track = image("earth-track");
    if (!track || !warning || !window.document?.createElement) return null;
    const band = document.createElement("canvas"), outline = document.createElement("canvas");
    const w = band.width = outline.width = 384, h = band.height = outline.height = 96;
    const ground = band.getContext("2d"), ink = outline.getContext("2d");
    if (!ground || !ink) return null;
    ground.drawImage(track, 0, track.naturalHeight * .32, track.naturalWidth, track.naturalHeight * .36, 0, 0, w, h);
    ground.globalCompositeOperation = "source-atop";
    ground.fillStyle = "rgba(133,45,35,.78)";
    ground.fillRect(0, 0, w, h);
    ink.drawImage(warning, 8, 8, 640, 38, 0, 0, w, 23);
    ink.drawImage(warning, 8, 61, 640, 38, 0, h - 23, w, 23);
    for (const x of [10, w - 10]) {
      ink.save();
      ink.translate(x, 0);
      ink.rotate(Math.PI / 2);
      ink.drawImage(warning, 125, 8, 406, 38, 0, -10, h, 20);
      ink.restore();
    }
    return cutLayers = { band, outline };
  }

  function paintCut(ctx, hazard, zone, sprite, pass, layers) {
    const timing = window.BAMBOO_COMBAT.cutTiming;
    const duration = timing[hazard.phase];
    const age = Number.isFinite(hazard.remaining) ? Math.max(0, Math.min(duration, duration - hazard.remaining)) : 0;
    const warning = hazard.phase === "telegraph", recovery = hazard.phase === "recovery";
    const vertical = zone.ry > zone.rx;
    const long = vertical ? zone.ry : zone.rx, short = vertical ? zone.rx : zone.ry;
    const dir = hazard.direction === -1 ? -1 : 1;
    const alpha = ctx.globalAlpha;
    if (vertical) ctx.rotate(Math.PI / 2);

    if (pass === "ground") {
      if (!recovery && layers) {
        ctx.globalAlpha = alpha * (warning ? .49 + .18 * age / duration : .58 - .26 * age / duration);
        ctx.drawImage(layers.band, -long, -short, long * 2, short * 2);
      } else if (recovery && age < .16) {
        ctx.scale(dir, 1);
        ctx.globalAlpha = alpha * .25 * (1 - age / .16);
        ctx.drawImage(sprite, 8, 8, sprite.naturalWidth - 16, sprite.naturalHeight - 16,
          -long, -short * .31, long * 2, short * .62);
      }
      return;
    }
    if (recovery) return;

    const rails = layers?.outline;
    const warningArt = image("bambooCut:warning");
    ctx.globalAlpha = alpha * (warning ? .79 + .21 * age / duration : .60);
    const ink = warning && image("bambooCut:ink");
    if (ink) ctx.drawImage(ink, -long, -short, long * 2, short * 2);
    else if (rails) ctx.drawImage(rails, -long, -short, long * 2, short * 2);
    else if (warningArt) ctx.drawImage(warningArt, 8, 8, 640, 91, -long, -short, long * 2, short * 2);
    if (warning) return;

    const sweep = Math.min(1, age / .085);
    const reveal = .18 + .82 * (1 - (1 - sweep) ** 2);
    const stretch = .56 + .44 * Math.max(0, 1 - Math.abs(age - .075) / .12);
    const fade = Math.min(1, (duration - age) / .12);
    ctx.scale(dir, 1);
    ctx.globalAlpha = alpha * fade;
    ctx.drawImage(sprite, 8, 8, (sprite.naturalWidth - 16) * reveal, sprite.naturalHeight - 16,
      -long, -short * stretch, long * 2 * reveal, short * 2 * stretch);
    const flight = (age - .02) / .20;
    if (flight <= 0 || flight >= 1) return;
    const soil = image("bambooShoots:soil");
    ctx.globalAlpha = alpha * Math.min(1, (1 - flight) * 2.5);
    for (const fragment of cutFragments) {
      const source = fragment.soil ? soil : sprite;
      if (!source) continue;
      const [sx, sy, sw, sh] = fragment.crop;
      const width = fragment.size, height = width * sh / sw;
      const x = long * (fragment.along + .34 * flight), y = short * fragment.side * (.22 + flight * .65);
      ctx.drawImage(source, sx, sy, sw, sh, x - width / 2, y - height / 2, width, height);
    }
  }

  function paintHazard(ctx, hazard, pass = "foreground") {
    const cut = hazard.kind === "bambooCut";
    if (!effects[hazard.kind] || (!cut && hazard.phase === "recovery")) return false;
    const warning = hazard.phase === "telegraph";
    const sprite = (!cut && warning && image(hazard.kind + ":ink")) ||
      image(hazard.kind + (warning ? ":warning" : ":impact"));
    if (!sprite) return false;
    const layers = cut && hazard.phase !== "recovery" ? bambooCutLayers(image("bambooCut:warning")) : null;
    for (const zone of hazard.zones) {
      ctx.save();
      ctx.translate(zone.x, zone.y);
      if (cut) paintCut(ctx, hazard, zone, sprite, pass, layers);
      else paintShoots(ctx, hazard, zone, sprite, warning);
      ctx.restore();
    }
    return true;
  }

  return Object.freeze({ load, unload, image, monster, paintHazard });
})();
