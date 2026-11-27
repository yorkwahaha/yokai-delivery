window.SNOW_TEMPLE_ART = (() => {
  const props = ["shrine", "temple", "torii", "stone-lantern", "steps", "bridge", "boulders",
    "pine", "ice-cliff", "offertory", "paper-lantern", "cedar-fence", "ice-patch",
    "snowdrift", "octagonal-shrine", "juniper"];
  const mobs = {
    ghost: ["snow-rabbit", 65], runner: ["snow-kamaitachi", 76],
    tank: ["snow-ice-badger", 107], shooter: ["snow-lantern-monk", 82]
  };
  const bosses = [
    { id: "snow-frost-bell-guardian", title: "霜鐘石將", height: 226, attack: "frost-bell" },
    { id: "snow-white-kimono", title: "雪衣姬", height: 232, attack: "ice-gale" },
    { id: "snow-ice-pillar-boss", title: "冰柱法僧", height: 226, attack: "frost-bell",
      poses: ["idle", "windup", "action"], audioId: "snow-frost-bell-guardian" },
    { id: "snow-mountain-lion", title: "雪嶺獅王", height: 259, attack: "blizzard-claws" }
  ];
  const images = new Map();

  function load() {
    if (images.size || typeof Image !== "function") return;
    function request(key, path, height, root = "assets/img/") {
      const img = new Image();
      img.decoding = "async";
      if (height) {
        img.stageFrame = [0, 0, 384, 360, 192];
        img.stageSpriteHeight = height;
        if (key === "snow-ice-pillar-boss:action") {
          img.stageFrame = [0, 0, 384, 384, 192, 350];
          img.stageBaseHeight = 360;
        }
      }
      images.set(key, img);
      img.src = root + path + ".webp";
    }
    for (const role of props) request(role, `stages/snow-temple/scene/snow-temple__${role}`);
    for (let variant = 0; variant < 6; variant++) request(`ground-${variant}`, `stages/snow-temple/tiles/snow-temple__ground-${variant}`);
    const actors = [...Object.values(mobs), ...bosses.map(({id, height, poses}) => [id, height, poses])];
    for (const [id, height, poses] of actors) for (const pose of poses || ["idle", "windup", "action"]) {
      const name = `${id}__sprite__${pose}`;
      if (poses) request(`${id}:${pose}`, name, height, `assets/img/enemies/${id}/`);
      else request(`${id}:${pose}`, `enemies/${id}/${name}`, height);
    }
    for (const attack of new Set(bosses.map(boss => boss.attack))) for (const phase of ["warning", "impact"])
      request(`${attack}:${phase}`, `vfx/enemies/snow-${attack}/snow-${attack}__${phase}`);
    request("projectile", "vfx/enemies/snow-shooter/snow-shooter__projectile");
    request("arrival", "vfx/enemies/snow-boss/snow-boss__arrival");
  }

  function image(role) {
    const img = images.get(role);
    return img?.naturalWidth ? img : null;
  }

  function monster(enemy, elapsed, motion) {
    const id = enemy.type === "boss" ? enemy.trialBoss?.id : mobs[enemy.type]?.[0];
    if (!id) return null;
    let pose = "idle";
    if (!enemy.shield && !enemy.dying && !enemy.revealT && !(enemy.freezeT > 0)) {
      if (enemy.hazard?.phase === "active" || enemy.attackT > 0) pose = "action";
      else if (enemy.hazard?.phase === "telegraph" || enemy.snowShotWindup ||
          (motion && enemy.walking && Math.floor(elapsed * 7) % 2)) pose = "windup";
    }
    return image(`${id}:${pose}`) || image(`${id}:idle`);
  }

  function hazardImage(owner, phase) {
    const attack = owner?.trialBoss?.attack || "frost-bell";
    return image(`${attack}:${phase === "telegraph" ? "warning" : "impact"}`);
  }

  function terrainStamp() {
    let mask = (image("steps") ? 64 : 0) | (image("ice-patch") ? 128 : 0);
    for (let variant = 0; variant < 6; variant++) if (image(`ground-${variant}`)) mask |= 1 << variant;
    return mask;
  }

  return Object.freeze({
    load, unload: () => images.clear(), image, monster, hazardImage,
    bossWave: index => bosses[index] ?? null,
    pending: () => ["ground-0", "shrine", "temple", `${bosses[2].id}:idle`]
      .some(role => images.get(role)?.complete === false),
    terrain: variant => image(`ground-${variant}`) || image("ground-0"),
    terrainStamp
  });
})();
