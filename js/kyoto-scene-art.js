// The local Stage Lab preloads scene art and the wave roster.
window.KYOTO_SCENE_ART = (() => {
  const roles = ["ground-grid", "grocery", "sweets-house", "noodle-house", "tea-house", "three-tier-pagoda",
    "stall", "crate-stack", "stone-lantern", "double-lantern", "block-frontage", "block-wall",
    "maple", "footbridge", "festival-kiosk", "festival-banners", "red-railing", "maple-leaves",
    "perimeter-gate", "cloth-merchant", "market-shrine", "rear-townhouses", "perimeter-ground",
    "stone-basin", "lantern-stand", "komainu", "maple-shrub"];
  const effects = ["taiko", "pennant", "procession"];
  const mobs = {
    ghost: ["kyoto-straw-sandal", 68],
    runner: ["kyoto-crow-bell-courier", 80],
    tank: ["kyoto-rice-bale-oni", 104],
    shooter: ["kyoto-box-bellows", 80]
  };
  const bosses = [
    { id: "kyoto-taiko-warden", title: "太鼓門將", height: 219 },
    { id: "kyoto-brocade-puppeteer", title: "錦幡伶", height: 230 },
    { id: "kyoto-crossroads-boss", title: "十字街鬼將", height: 219, poses: ["idle", "windup", "action"], audioId: "kyoto-taiko-warden" },
    { id: "kyoto-procession-marshal", title: "百鬼夜行主宰・酒吞", height: 252 }
  ];
  const frame = [0, 0, 512, 480, 256];
  const images = new Map();

  function load() {
    if (images.size || typeof Image !== "function") return;
    function request(key, path, height, root = "assets/img/") {
      const image = new Image();
      image.decoding = "async";
      if (height) {
        image.stageFrame = frame;
        image.kyotoHeight = height;
      }
      images.set(key, image);
      image.src = root + path + ".webp";
    }
    for (const role of roles) request(role, `stages/hyakki-kyoto/${/^(?:perimeter-)?ground/.test(role) ? "tiles" : "scene"}/hyakki-kyoto__${role}`);
    for (let variant = 0; variant < 6; variant++) request(`ground-${variant}`, `stages/hyakki-kyoto/tiles/hyakki-kyoto__ground-${variant}`);
    for (const effect of effects) for (const phase of ["warning", "impact"])
      request(`${effect}:${phase}`, `vfx/enemies/kyoto-${effect}/kyoto-${effect}__${phase}`);
    request("projectile", "vfx/enemies/kyoto-shooter/kyoto-shooter__projectile");
    request("arrival", "vfx/enemies/kyoto-boss/kyoto-boss__arrival");
    const characters = [...Object.values(mobs), ...bosses.map(({id, height, poses}) => [id, height, poses])];
    for (const [id, height, poses] of characters)
      for (const pose of poses || ["idle", "windup", "action"]) {
        const name = `${id}__sprite__${pose}`;
        if (poses) request(`${id}:${pose}`, name, height, `assets/img/enemies/${id}/`);
        else request(`${id}:${pose}`, `enemies/${id}/${name}`, height);
      }
    for (const [id, height] of Object.values(mobs))
      request(`${id}:walk`, `enemies/${id}/${id}__sprite__walk`, height);
  }

  function image(role) {
    const sprite = images.get(role);
    return sprite?.naturalWidth ? sprite : null;
  }

  function bossWave(index) {
    return bosses[index] ?? null;
  }

  function monster(enemy, player, elapsed = 0, motion = false) {
    const id = enemy.type === "boss" ? enemy.trialBoss?.id : mobs[enemy.type]?.[0];
    if (!id) return null;
    let pose = "idle";
    if (!enemy.shield && !enemy.dying && !enemy.revealT && !(enemy.freezeT > 0)) {
      if (enemy.type === "boss") {
        if (enemy.hazard?.phase === "telegraph") pose = "windup";
        if (enemy.hazard?.phase === "active") pose = "action";
      } else if (enemy.kyotoWarning > 0) {
        pose = "windup";
      } else if (enemy.attackT > 0) {
        pose = "action";
      } else if (enemy.kyotoShotWindup || (enemy.walking && player &&
          (enemy.type === "ghost" || enemy.type === "tank") &&
          Math.hypot(player.x - enemy.x, player.y - enemy.y) < (enemy.type === "tank" ? 57 : 46))) {
        pose = "windup";
      } else if (motion && enemy.walking && Math.floor((elapsed + (enemy.wob || 0) * .04) * 7) % 2) {
        pose = "walk";
      }
    }
    return image(`${id}:${pose}`) || image(`${id}:idle`);
  }

  function hazardImage(owner, phase) {
    const id = owner?.trialBoss?.id;
    const effect = id === "kyoto-brocade-puppeteer" ? "pennant"
      : id === "kyoto-procession-marshal" ? "procession" : "taiko";
    return image(`${effect}:${phase === "telegraph" ? "warning" : "impact"}`);
  }

  function terrainStamp() {
    let mask = (image("maple-leaves") ? 64 : 0) | (image("perimeter-ground") ? 128 : 0);
    for (let variant = 0; variant < 6; variant++) if (image(`ground-${variant}`)) mask |= 1 << variant;
    return mask;
  }

  return Object.freeze({ load, unload: () => images.clear(), image, bossWave, monster, hazardImage, terrainStamp,
    pending: () => ["ground-grid", "tea-house", "three-tier-pagoda", `${bosses[2].id}:idle`]
      .some(role => images.get(role)?.complete === false),
    terrain: variant => image(`ground-${variant}`) || image("ground-grid") });
})();
